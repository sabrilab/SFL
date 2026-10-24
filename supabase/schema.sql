-- Schéma SFL — à exécuter tel quel dans l'éditeur SQL de Supabase (Run).
-- Réexécutable sans danger : chaque objet est créé « si absent » ou remplacé.
--
-- Trois tables pour la première étape : les profils de joueurs (liés à
-- auth.users), les convocations, et les réponses de présence. Le reste de la
-- saison (journées, lignes de match) restera local tant qu'on ne l'aura pas
-- migré.
--
-- Règles de sécurité (RLS) :
--   · toute la ligue lit tout (c'est le but : voir qui vient dimanche) ;
--   · chacun n'écrit que pour lui (personne ne répond à la place d'un autre) ;
--   · l'admin corrige et gère les convocations ;
--   · le rôle admin ne vient JAMAIS des métadonnées utilisateur (modifiables
--     par l'utilisateur) : il est posé en SQL, à la main, en fin de script.

-- ───────────────────────── Profils de joueurs ─────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  -- Nom du joueur dans la saison : c'est la clé utilisée partout dans l'app.
  name        text not null unique,
  username    text not null unique,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Inscription autonome : un joueur qui crée lui-même son compte attend que
-- l'admin l'accepte. Les comptes déjà là sont validés (défaut true à l'ajout
-- de la colonne), tout compte créé ENSUITE naît en attente (défaut false) —
-- y compris par un appel direct à l'API : rien côté client ne peut s'auto-valider.
alter table public.profiles add column if not exists valide boolean not null default true;
alter table public.profiles alter column valide set default false;

-- Pseudo. Il est unique (contrainte de la colonne username) et ne se change
-- pas tout le temps : une fois tous les 30 jours, comme sur les réseaux
-- sociaux. La règle vit ICI, dans la base (trigger garde_pseudo plus bas) :
-- aucun appel, de l'app ou d'ailleurs, ne la contourne.
--   · pseudo_change_le : date du dernier pseudo choisi (null = jamais choisi
--     par le joueur, le premier choix est libre) ;
--   · pseudo_a_choisir : compte né d'une connexion Google ou Apple, qui
--     porte un nom et un pseudo provisoires tant que le joueur n'a pas fini
--     son inscription (son premier choix ne compte pas dans les 30 jours).
alter table public.profiles add column if not exists pseudo_change_le timestamptz;
alter table public.profiles add column if not exists pseudo_a_choisir boolean not null default false;
alter table public.profiles add column if not exists contact_email text;

-- Identité affichée. Le nom de saison (name) reste la clé de toute l'app
-- (journées, photos, compositions) : il ne change jamais, sinon les stats
-- d'un joueur se perdraient. Le joueur corrige plutôt son prénom et son nom
-- (dans sa fiche, privée) et l'app affiche partout nom_affiche, tiré de ce
-- prénom selon l'usage de la ligue (prénom seul, puis l'initiale du nom en
-- cas d'homonyme, voir nomDeLigue). Seule la route serveur /api/identite
-- l'écrit, après avoir vérifié qu'aucun autre joueur ne le porte.
--   · identite_le : quand le joueur a confirmé son prénom, son nom et son
--     pseudo (null = jamais : Ma carte le lui demande).
alter table public.profiles add column if not exists nom_affiche text;
alter table public.profiles add column if not exists identite_le timestamptz;
create unique index if not exists profiles_nom_affiche_unique
  on public.profiles (lower(nom_affiche)) where nom_affiche is not null;

-- Deux noms de saison qui ne diffèrent que par les majuscules ne cohabitent
-- pas : la photo de carte et les votes retrouvent un joueur par son nom, sans
-- tenir compte de la casse, et un compte nommé « abdel » touchait à la photo
-- d'« Abdel » (22/10/2026). Si un tel doublon existait déjà, l'index attend
-- qu'on le règle, sans faire échouer la migration.
do $$
begin
  create unique index if not exists profiles_name_casse_unique on public.profiles (lower(name));
exception
  when unique_violation then
    raise warning 'profiles : deux noms ne diffèrent que par la casse, index non créé (%)', sqlerrm;
end;
$$;

-- À l'inscription, le profil est créé par trigger depuis les métadonnées
-- d'identité (nom, pseudo). is_admin est FORCÉ à false : les métadonnées sont
-- modifiables par l'utilisateur, elles ne portent jamais d'autorisation.
--
-- Connexion Google ou Apple : les métadonnées viennent du fournisseur (nom
-- complet, email réel) et ne disent rien du nom de ligue ni du pseudo. Le
-- profil naît avec un nom et un pseudo PROVISOIRES, uniques par construction
-- (tirés de l'identifiant du compte), et pseudo_a_choisir : l'écran
-- d'inscription demande la suite, et la route serveur pose les vrais
-- (/api/inscription/sociale). Sans cela, deux « Thomas Martin » de Google se
-- heurteraient à l'unicité du nom et la connexion échouerait.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fournisseur text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  court text := left(replace(new.id::text, '-', ''), 12);
begin
  if fournisseur <> 'email' then
    insert into public.profiles (id, name, username, is_admin, valide, pseudo_a_choisir, contact_email)
    values (new.id, 'Nouveau ' || court, '@n' || court, false, false, true, lower(new.email))
    on conflict (id) do nothing;
    return new;
  end if;

  insert into public.profiles (id, name, username, is_admin, valide)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'username', '@' || split_part(new.email, '@', 1)),
    -- Les admins sont reconnus par leur email technique EXACT (jamais par
    -- les métadonnées, modifiables par l'utilisateur). La fenêtre de risque
    -- se limite à la période d'inscriptions ouvertes, refermée sitôt les
    -- comptes créés — et les comptes admin sont créés en premier.
    new.email in ('ilyes@sfl.local', 'sabri@sfl.local'),
    -- Tout autre compte naît en attente : l'admin l'accepte (ou le crée
    -- lui-même, et la route qui le crée le valide aussitôt).
    new.email in ('ilyes@sfl.local', 'sabri@sfl.local')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Personne n'appelle cette fonction directement : seul le trigger s'en sert.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Helper : « l'appelant est-il admin ? » — SECURITY DEFINER pour lire profiles
-- sans récursion de RLS, avec le contrôle d'identité DANS la fonction.
create or replace function public.is_league_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_admin
  );
$$;

revoke execute on function public.is_league_admin() from public, anon;
grant execute on function public.is_league_admin() to authenticated;

-- « L'appelant est-il membre de la ligue ? » — un compte validé. Un compte en
-- attente se connecte, voit sa propre fiche, et rien d'autre : ni la saison,
-- ni les joueurs, ni le salon. C'est ce qui rend l'inscription libre sans
-- risque pour la ligue.
create or replace function public.est_membre()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.valide
  );
$$;

revoke execute on function public.est_membre() from public, anon;
grant execute on function public.est_membre() to authenticated;

-- L'admin accepte une inscription. Le contrôle est DANS la fonction : la
-- colonne valide n'est modifiable par personne d'autre (grant de colonnes).
create or replace function public.valider_inscription(joueur uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_league_admin() then
    raise exception 'Réservé à l''admin.' using errcode = '42501';
  end if;
  update public.profiles set valide = true where id = joueur;
  return found;
end;
$$;

revoke execute on function public.valider_inscription(uuid) from public, anon;
grant execute on function public.valider_inscription(uuid) to authenticated;

drop policy if exists "profiles: lecture ligue" on public.profiles;
create policy "profiles: lecture ligue"
  on public.profiles for select
  to authenticated
  using ((select public.est_membre()) or id = (select auth.uid()));

-- Chacun ne modifie que sa fiche. L'auto-promotion admin est déjà impossible :
-- le grant de colonnes (plus bas) ne laisse modifier que l'email de contact,
-- le badge, l'habillage, la ville et la date de l'accueil. Ni le nom ni le
-- pseudo : ils passent par le serveur.
drop policy if exists "profiles: mise à jour de soi" on public.profiles;
create policy "profiles: mise à jour de soi"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Email de contact du joueur — collecté après la première connexion, ou
-- automatiquement quand il lie Google/Apple (colonne ajoutée plus haut, avec
-- le pseudo). Depuis le 22/10/2026, la colonne n'est plus qu'un passage : ce
-- qu'on y écrit part aussitôt dans public.contacts (en fin de script), que
-- seuls le joueur et l'admin lisent, et la colonne reste vide.

-- La règle du pseudo, appliquée à TOUTE modification (joueur, route serveur
-- ou admin en SQL) : un format propre, et un changement tous les 30 jours.
-- Le premier choix d'un compte Google/Apple ne compte pas. Pour débloquer un
-- joueur à la main : update profiles set pseudo_change_le = null where … ;
create or replace function public.garde_pseudo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.username is not distinct from old.username then
    return new;
  end if;
  if new.username !~ '^@[a-z0-9][a-z0-9._]{2,19}$' then
    raise exception 'Pseudo : 3 à 20 caractères, lettres, chiffres, point ou tiret bas.'
      using errcode = '22023';
  end if;
  if not old.pseudo_a_choisir
     and old.pseudo_change_le is not null
     and old.pseudo_change_le > now() - interval '30 days' then
    raise exception 'Pseudo : prochain changement possible le %.',
      to_char(old.pseudo_change_le + interval '30 days', 'DD/MM/YYYY')
      using errcode = 'P0001', hint = 'pseudo-30-jours';
  end if;
  new.pseudo_change_le := now();
  return new;
end;
$$;

drop trigger if exists profiles_garde_pseudo on public.profiles;
create trigger profiles_garde_pseudo before update of username on public.profiles
  for each row execute function public.garde_pseudo();

-- Connexion par pseudo. Les comptes à mot de passe se connectent avec un
-- email technique (pseudo@sfl.local) qui garde le PREMIER pseudo : après un
-- changement, l'écran de connexion demande ici à quel identifiant correspond
-- le nouveau. Ne répond que pour les emails techniques (jamais un email réel).
create or replace function public.identifiant_de_connexion(pseudo text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select split_part(u.email, '@', 1)
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = '@' || lower(btrim(pseudo, ' @'))
    and u.email like '%@sfl.local'
  limit 1;
$$;

revoke execute on function public.identifiant_de_connexion(text) from public;
grant execute on function public.identifiant_de_connexion(text) to anon, authenticated;

-- Le badge que le joueur pose sur sa carte (src/lib/sfl/badge-carte.ts) :
-- « auto » (le meilleur), « aucun », « s:<classement> » ou « p:<palier> ».
-- Lu par toute la ligue, modifiable par le joueur seul (grant plus bas).
alter table public.profiles add column if not exists badge text
  check (badge is null or badge ~ '^(auto|aucun|s:[a-z]+|p:[a-zA-Z]+)$');

-- Ce que le joueur porte sur sa carte depuis la passe (src/lib/sfl/
-- habillages-choisis.ts) : « finition/traitement », chacun « auto » (le
-- dernier débloqué), « - » (rien) ou l'id d'une récompense. Ce qui est
-- débloqué se recalcule de l'XP : un choix pas débloqué ne s'affiche pas.
-- Lu par toute la ligue, modifiable par le joueur seul (grant plus bas).
alter table public.profiles add column if not exists habillage text
  check (habillage is null or habillage ~ '^(auto|-|nuit|chrome|animee)/(auto|-|argentique|gravure|marbre)$');
-- Les skins du Passe Bola (24/10, src/lib/sfl/passe.ts et skins-passe.ts) :
-- la contrainte suit la liste des finitions ; « Tes couleurs » porte son pays
-- (couleurs:dz, couleurs:gb-eng). Refaite à chaque migration : idempotente.
alter table public.profiles drop constraint if exists profiles_habillage_check;
alter table public.profiles add constraint profiles_habillage_check
  check (habillage is null or habillage ~ '^(auto|-|nuit|chrome|animee|onyx|givre|carbone|marbre|neon|aurore|ki|meteorite|couleurs(:[a-z]{2}(-[a-z]{3})?)?)/(auto|-|argentique|gravure|marbre)$');

-- La ville du joueur sur la Map (lib/sfl/villes.ts, 22/10) : le nom de sa
-- commune et son CENTRE, tel que le donne le géocodeur — jamais sa position.
-- ville_cachee : il reste dans la ligue mais disparaît de la Map (le mode
-- fantôme de la Snap Map). Lu par toute la ligue, posé par le joueur seul
-- (grant plus bas, RLS « mise à jour de soi »).
alter table public.profiles add column if not exists ville text
  check (ville is null or char_length(btrim(ville)) between 1 and 80);
alter table public.profiles add column if not exists ville_lat double precision
  check (ville_lat is null or ville_lat between -90 and 90);
alter table public.profiles add column if not exists ville_lng double precision
  check (ville_lng is null or ville_lng between -180 and 180);
alter table public.profiles add column if not exists ville_cachee boolean not null default false;
-- ville_le : quand le joueur a choisi ou confirmé sa ville lui-même (null =
-- jamais : celle qu'il a, s'il en a une, a été devinée par sa connexion).
-- Tant qu'elle est vide, l'ouverture de l'app lui propose de la donner
-- (invitation-carte.tsx, Sabri, 22/10).
alter table public.profiles add column if not exists ville_le timestamptz;

-- L'accueil de l'app (components/sfl/accueil, Sabri, 24/10) : à la première
-- ouverture, tout ce que l'app demande au joueur, puis la visite de l'app.
-- accueil_le : quand il l'a fini (null = jamais : la visite l'attend à sa
-- prochaine ouverture). Posé par le joueur seul (grant plus bas, RLS « mise
-- à jour de soi »).
alter table public.profiles add column if not exists accueil_le timestamptz;

-- ──────────────────────────── Activité ───────────────────────────────
-- Journal d'usage : connexions, ouvertures quotidiennes, réponses de
-- présence. Alimente le tableau de bord admin (qui vient, quand, rétention).
create table if not exists public.activity (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('login', 'open', 'presence')),
  created_at timestamptz not null default now()
);

-- Enrichissement du journal (migration idempotente) : de quelle page vient
-- l'événement, à quelle session d'usage il appartient, et un sachet libre pour
-- le détail. C'est ce qui permet de mesurer un temps de connexion — la durée
-- d'une session, c'est l'écart entre son premier et son dernier événement.
alter table public.activity add column if not exists path       text;
alter table public.activity add column if not exists session_id text;
alter table public.activity add column if not exists meta       jsonb;

-- Le vocabulaire d'événements s'élargit : on remplace la contrainte fermée
-- plutôt que d'en ajouter une seconde (rejouable sans erreur).
alter table public.activity drop constraint if exists activity_kind_check;
alter table public.activity add constraint activity_kind_check
  check (kind in (
    'login',      -- une connexion réussie
    'open',       -- première ouverture de l'app du jour
    'heartbeat',  -- l'app est ouverte et visible (toutes les 90 s)
    'close',      -- l'onglet passe en arrière-plan ou se ferme
    'view',       -- une page consultée
    'presence',   -- réponse à une convocation
    'vote',       -- vote des figures de match
    'duel',       -- un duel joué dans l'Arène
    'match',      -- un match d'Arène
    'pack',       -- ouverture d'un pack
    'achat',      -- achat d'une carte
    'recherche',  -- une recherche lancée
    'compo',      -- une composition 5v5 déposée dans l'Arène
    'notifs'      -- l'invitation aux notifications montrée, et la réponse
  ));

create index if not exists activity_player_created_idx
  on public.activity (player_id, created_at desc);
create index if not exists activity_created_idx
  on public.activity (created_at desc);
create index if not exists activity_session_idx
  on public.activity (session_id, created_at);

alter table public.activity enable row level security;

-- Chacun écrit ses propres événements ; seul l'admin lit le journal.
drop policy if exists "activity: j'écris pour moi" on public.activity;
create policy "activity: j'écris pour moi"
  on public.activity for insert
  to authenticated
  with check ((select auth.uid()) = player_id);

drop policy if exists "activity: lecture admin" on public.activity;
create policy "activity: lecture admin"
  on public.activity for select
  to authenticated
  using ((select public.is_league_admin()));

-- ────────────────────────────── Saison ───────────────────────────────
-- LA saison entière — journées, lignes de match, effectif, convocations
-- locales — en un seul document jsonb versionné. C'est le format exact du
-- stockage local (types.ts) : l'admin corrige, pousse, tout le monde reçoit.
--   · version : horodatage croissant, départage les écritures ;
--   · seed    : la version du seed embarqué dont ce document est issu — un
--     client au seed plus récent refuse un document plus ancien.
create table if not exists public.saison (
  id         int primary key default 1 check (id = 1),
  data       jsonb not null,
  version    bigint not null,
  seed       int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.saison enable row level security;

-- Toute la ligue lit la même saison ; seuls les admins écrivent.
drop policy if exists "saison: lecture ligue" on public.saison;
create policy "saison: lecture ligue"
  on public.saison for select
  to authenticated
  using ((select public.est_membre()));

drop policy if exists "saison: écriture admin" on public.saison;
create policy "saison: écriture admin"
  on public.saison for all
  to authenticated
  using ((select public.is_league_admin()))
  with check ((select public.is_league_admin()));

-- Publier sans écraser plus neuf (22/10/2026). Chaque publication remplace
-- le document entier : un appareil admin resté sur une vieille copie
-- effaçait donc les journées saisies ailleurs depuis (la J11 de la saison 0,
-- perdue le 17/10). L'app publie désormais par publier_saison, en disant sur
-- quelle version elle a travaillé (p_base) : si la base a changé depuis,
-- rien n'est écrit et elle reçoit la version actuelle, pour reprendre la
-- base ou écraser en connaissance de cause (p_forcer). La version vient de
-- l'horloge du serveur, toujours croissante : un téléphone à l'heure fausse
-- ne fait plus passer sa publication pour plus ancienne qu'elle n'est.
create or replace function public.publier_saison(
  p_data jsonb,
  p_seed int,
  p_base bigint,
  p_forcer boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  courante bigint;
  nouvelle bigint;
begin
  if not public.is_league_admin() then
    raise exception 'Réservé à l''admin.' using errcode = '42501';
  end if;
  select s.version into courante from public.saison s where s.id = 1 for update;
  if found and not p_forcer and courante is distinct from p_base then
    return jsonb_build_object('ok', false, 'version', courante);
  end if;
  nouvelle := greatest((extract(epoch from clock_timestamp()) * 1000)::bigint, coalesce(courante, 0) + 1);
  perform set_config('sfl.publication_saison', 'oui', true);
  insert into public.saison (id, data, version, seed, updated_at)
  values (1, p_data, nouvelle, p_seed, now())
  on conflict (id) do update
    set data = excluded.data,
        version = excluded.version,
        seed = excluded.seed,
        updated_at = excluded.updated_at;
  perform set_config('sfl.publication_saison', '', true);
  return jsonb_build_object('ok', true, 'version', nouvelle);
end;
$$;

revoke execute on function public.publier_saison(jsonb, int, bigint, boolean) from public, anon;
grant execute on function public.publier_saison(jsonb, int, bigint, boolean) to authenticated;

-- L'app n'écrit plus la table directement : une version d'avant ce
-- correctif, restée en cache sur un téléphone, est refusée et doit se mettre
-- à jour. Le serveur (clé secrète) et l'éditeur SQL restent libres.
create or replace function public.saison_par_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and coalesce(current_setting('sfl.publication_saison', true), '') <> 'oui' then
    raise exception 'Mets l''app à jour (ferme-la puis rouvre-la) avant de publier la saison.'
      using errcode = 'P0001', hint = 'saison-app-a-jour';
  end if;
  return new;
end;
$$;

revoke execute on function public.saison_par_publication() from public, anon, authenticated;

drop trigger if exists saison_par_publication on public.saison;
create trigger saison_par_publication before insert or update on public.saison
  for each row execute function public.saison_par_publication();

-- ─────────────────────────── Compositions ────────────────────────────
-- Les compositions 5v5 déposées dans l'Arène : une par joueur et par
-- dimanche (la nouvelle remplace l'ancienne). Elles serviront à générer les
-- matchs populaires et les équipes « selon l'avis des joueurs ».
create table if not exists public.compositions (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.profiles(id) on delete cascade,
  dimanche   date not null,   -- le dimanche visé (clé stable)
  slots      jsonb not null,  -- { "G": "Hasbi", "DG": "...", ... }
  created_at timestamptz not null default now(),
  unique (player_id, dimanche)
);

create index if not exists compositions_dimanche_idx
  on public.compositions (dimanche);

alter table public.compositions enable row level security;

-- Chacun dépose la sienne ; toute la ligue peut les lire (elles ont vocation
-- à nourrir des choix collectifs, pas à rester secrètes).
drop policy if exists "compositions: lecture ligue" on public.compositions;
create policy "compositions: lecture ligue"
  on public.compositions for select
  to authenticated
  using ((select public.est_membre()));

drop policy if exists "compositions: je dépose la mienne" on public.compositions;
create policy "compositions: je dépose la mienne"
  on public.compositions for insert
  to authenticated
  with check ((select auth.uid()) = player_id and (select public.est_membre()));

drop policy if exists "compositions: je remplace la mienne" on public.compositions;
create policy "compositions: je remplace la mienne"
  on public.compositions for update
  to authenticated
  using ((select auth.uid()) = player_id)
  with check ((select auth.uid()) = player_id);

-- ─────────────────────────── Convocations ────────────────────────────
create table if not exists public.convocations (
  id          bigint generated always as identity primary key,
  journee     int not null,
  jour        text not null,
  date_label  text not null,
  heure       text not null,
  lieu        text not null,
  effectif    int not null default 10,
  statut      text not null default 'ouverte' check (statut in ('ouverte', 'cloturee')),
  created_at  timestamptz not null default now()
);

-- Les équipes composées par l'admin (couleur + joueurs), révélées aux
-- joueurs à partir du vendredi 19h — la fenêtre est jugée côté app.
alter table public.convocations add column if not exists teams jsonb;

alter table public.convocations enable row level security;

drop policy if exists "convocations: lecture ligue" on public.convocations;
create policy "convocations: lecture ligue"
  on public.convocations for select
  to authenticated
  using ((select public.est_membre()));

drop policy if exists "convocations: écriture admin" on public.convocations;
create policy "convocations: écriture admin"
  on public.convocations for all
  to authenticated
  using ((select public.is_league_admin()))
  with check ((select public.is_league_admin()));

-- ──────────────────────────── Présence ───────────────────────────────
create table if not exists public.presence (
  convocation_id bigint not null references public.convocations(id) on delete cascade,
  player_id      uuid   not null references public.profiles(id) on delete cascade,
  reponse        text   not null check (reponse in ('present', 'absent')),
  updated_at     timestamptz not null default now(),
  primary key (convocation_id, player_id)
);

-- Index de la clé étrangère joueur (la PK couvre déjà convocation_id).
create index if not exists presence_player_id_idx on public.presence (player_id);

alter table public.presence enable row level security;

-- Toute la ligue voit qui vient : c'est le but même de la fonctionnalité.
drop policy if exists "presence: lecture ligue" on public.presence;
create policy "presence: lecture ligue"
  on public.presence for select
  to authenticated
  using ((select public.est_membre()));

-- Mais personne ne répond à la place d'un autre.
drop policy if exists "presence: je réponds pour moi" on public.presence;
create policy "presence: je réponds pour moi"
  on public.presence for insert
  to authenticated
  with check ((select auth.uid()) = player_id and (select public.est_membre()));

drop policy if exists "presence: je modifie ma réponse" on public.presence;
create policy "presence: je modifie ma réponse"
  on public.presence for update
  to authenticated
  using ((select auth.uid()) = player_id)
  with check ((select auth.uid()) = player_id);

drop policy if exists "presence: je retire ma réponse" on public.presence;
create policy "presence: je retire ma réponse"
  on public.presence for delete
  to authenticated
  using ((select auth.uid()) = player_id);

-- L'admin peut corriger une réponse (quelqu'un qui prévient par téléphone).
drop policy if exists "presence: correction admin" on public.presence;
create policy "presence: correction admin"
  on public.presence for all
  to authenticated
  using ((select public.is_league_admin()))
  with check ((select public.is_league_admin()));

-- Horodatage automatique des changements de réponse.
create or replace function public.touch_presence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists presence_touch on public.presence;
create trigger presence_touch before update on public.presence
  for each row execute function public.touch_presence();

-- ──────────────── Accès Data API (REST) + temps réel ─────────────────
-- Les lignes restent filtrées par RLS ; ces grants ouvrent seulement l'accès
-- aux tables via l'API (certains projets ne l'accordent pas d'office).
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.convocations, public.presence to authenticated;
-- Le projet accorde d'office UPDATE sur toute la table : un joueur pouvait
-- alors se passer lui-même admin (is_admin) ou se valider (valide), et écrire
-- la saison. On retire le droit de table ; seules les colonnes ci-dessous
-- restent modifiables par le joueur, sur sa propre ligne (RLS).
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
-- Le pseudo ne passe plus que par la route serveur (/api/pseudo), qui vérifie
-- aussi les pseudos réservés aux comptes prévus ; la règle des 30 jours, elle,
-- est dans la base (garde_pseudo).
revoke update (username) on public.profiles from authenticated;
-- Le nom de saison non plus : c'est la clé du joueur partout (journées,
-- photos, votes), aucun écran ne le change, et un compte qui se renommait
-- pouvait prendre la place d'un joueur de l'effectif sans compte (22/10/2026).
revoke update (name) on public.profiles from authenticated;
grant update (contact_email) on public.profiles to authenticated;
grant update (badge) on public.profiles to authenticated;
grant update (habillage) on public.profiles to authenticated;
grant update (ville, ville_lat, ville_lng, ville_cachee, ville_le) on public.profiles to authenticated;
grant update (accueil_le) on public.profiles to authenticated;
grant insert, select on public.activity to authenticated;
grant insert, update, delete on public.presence to authenticated;
grant insert, update, select on public.compositions to authenticated;
grant select, insert, update on public.saison to authenticated;
grant insert, update, delete on public.convocations to authenticated;

-- Diffusion temps réel : les réponses apparaissent sans rafraîchir.
do $$
begin
  alter publication supabase_realtime add table public.saison;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.presence;
exception
  when duplicate_object then null;
end;
$$;



-- ────────────────────────────── Messages ─────────────────────────────
-- Le salon de la ligue et les messages privés, dans une seule table : un
-- message appartient soit au salon (canal 'sfl', lu par tout le monde),
-- soit à une conversation à deux (canal 'dm', avec un destinataire). Deux
-- tables auraient dupliqué les règles de sécurité sans rien apporter.
create table if not exists public.messages (
  id           bigint generated always as identity primary key,
  canal        text not null check (canal in ('sfl', 'dm')),
  auteur       uuid not null references public.profiles(id) on delete cascade,
  destinataire uuid references public.profiles(id) on delete cascade,
  texte        text not null check (char_length(btrim(texte)) between 1 and 2000),
  created_at   timestamptz not null default now(),
  -- Le salon n'a pas de destinataire ; un privé en a forcément un, et on ne
  -- s'écrit pas à soi-même.
  constraint messages_destinataire_coherent check (
    (canal = 'sfl' and destinataire is null)
    or (canal = 'dm' and destinataire is not null and destinataire <> auteur)
  )
);

create index if not exists messages_salon_idx
  on public.messages (created_at desc) where canal = 'sfl';
create index if not exists messages_prive_idx
  on public.messages (auteur, destinataire, created_at desc) where canal = 'dm';
create index if not exists messages_recu_idx
  on public.messages (destinataire, created_at desc) where canal = 'dm';

alter table public.messages enable row level security;

-- Lecture : le salon appartient à la ligue ; un privé n'est lu que par ses
-- deux extrémités. Personne d'autre, admin compris.
drop policy if exists "messages: lecture" on public.messages;
create policy "messages: lecture"
  on public.messages for select
  to authenticated
  using (
    (canal = 'sfl' and (select public.est_membre()))
    or auteur = (select auth.uid())
    or destinataire = (select auth.uid())
  );

-- Écriture : sous son propre nom, jamais sous celui d'un autre. La règle
-- vit plus bas (Vestiaire), avec la sourdine que l'admin peut poser.

-- Retrait : son propre message. L'admin peut retirer n'importe lequel du
-- salon — la modération d'un lieu public lui revient.
drop policy if exists "messages: je retire le mien" on public.messages;
create policy "messages: je retire le mien"
  on public.messages for delete
  to authenticated
  using (auteur = (select auth.uid()) or (select public.is_league_admin()));

-- Le salon en temps réel — APRÈS la création de la table (ajoutée plus
-- haut, elle faisait échouer toute la migration sur une base neuve).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_object then null;
end;
$$;

-- ───────────────────────────── Vestiaire ─────────────────────────────
-- Le salon de la ligue s'appelle désormais le Vestiaire (onglet Ligue). On
-- s'y chambre : un message peut porter une PIÈCE, ce que le joueur partage
-- en un geste (sa carte, une feuille de match, un classement). La pièce est
-- un petit JSON que l'app sait dessiner ; le texte devient alors facultatif.
--   · {"type":"carte","joueur":"Kader"}
--   · {"type":"feuille","j":11}
--   · {"type":"classement","id":"buts","top":[{"n":"Ilyes","v":20},…]}
--   · {"type":"vocal","chemin":"<uuid>/<horodatage>.m4a","duree":12.4}
--     (19/10 : les vocaux, fichier dans le bucket « vocaux » plus bas)
alter table public.messages add column if not exists piece jsonb;
-- Répondre à un message précis (19/10) : la réponse cite l'original. Si
-- l'original est retiré, la réponse reste, sans citation.
alter table public.messages add column if not exists reponse_a bigint references public.messages(id) on delete set null;
alter table public.messages drop constraint if exists messages_texte_check;
alter table public.messages drop constraint if exists messages_texte_ou_piece;
alter table public.messages add constraint messages_texte_ou_piece check (
  char_length(texte) <= 2000
  and (char_length(btrim(texte)) >= 1 or piece is not null)
);
-- 'rejoint' (22/10) n'existe que dans la discussion d'un match (plus bas) :
-- c'est la ligne « Kader a rejoint le match ». Ajoutée ICI, pas plus bas : ce
-- contrôle est reposé à chaque migration, et il doit déjà accepter les
-- lignes 'rejoint' en base quand il l'est.
alter table public.messages drop constraint if exists messages_piece_forme;
alter table public.messages add constraint messages_piece_forme check (
  piece is null
  or (
    jsonb_typeof(piece) = 'object'
    and piece->>'type' in ('carte', 'feuille', 'classement', 'vocal', 'photo', 'video', 'ligue', 'rejoint')
    and pg_column_size(piece) <= 4000
    and (piece->>'type' <> 'rejoint' or canal = 'match')
  )
);

-- Les réactions : une par émoji et par joueur sur un message. On ne lit que
-- les réactions des messages qu'on a le droit de lire (la sous-requête passe
-- par la RLS de messages).
create table if not exists public.message_reactions (
  message_id  bigint not null references public.messages(id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji       text not null check (emoji in ('😂', '🔥', '🐐', '🤡', '💀')),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

drop policy if exists "réactions: lecture" on public.message_reactions;
create policy "réactions: lecture"
  on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id));

drop policy if exists "réactions: je réagis pour moi" on public.message_reactions;
create policy "réactions: je réagis pour moi"
  on public.message_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.est_membre())
    and exists (select 1 from public.messages m where m.id = message_id)
  );

drop policy if exists "réactions: je retire la mienne" on public.message_reactions;
create policy "réactions: je retire la mienne"
  on public.message_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception
  when duplicate_object then null;
  when undefined_table then null;
  when undefined_object then null;
end;
$$;

-- La modération : l'admin retire n'importe quel message du Vestiaire (règle
-- « je retire le mien » plus haut) et peut couper la parole à un joueur pour
-- un temps. Un joueur coupé lit toujours, mais n'écrit plus au Vestiaire.
create table if not exists public.vestiaire_sourdines (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  jusqu_au    timestamptz not null,
  created_at  timestamptz not null default now()
);

alter table public.vestiaire_sourdines enable row level security;

drop policy if exists "sourdines: le joueur voit la sienne, l'admin tout" on public.vestiaire_sourdines;
create policy "sourdines: le joueur voit la sienne, l'admin tout"
  on public.vestiaire_sourdines for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_league_admin()));

drop policy if exists "sourdines: l'admin décide" on public.vestiaire_sourdines;
create policy "sourdines: l'admin décide"
  on public.vestiaire_sourdines for all to authenticated
  using ((select public.is_league_admin()))
  with check ((select public.is_league_admin()));

create or replace function public.peut_parler_au_vestiaire()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (
    select 1 from public.vestiaire_sourdines s
    where s.user_id = (select auth.uid()) and s.jusqu_au > now()
  );
$$;

revoke execute on function public.peut_parler_au_vestiaire() from public, anon;
grant execute on function public.peut_parler_au_vestiaire() to authenticated;

drop policy if exists "messages: j'écris pour moi" on public.messages;
create policy "messages: j'écris pour moi"
  on public.messages for insert
  to authenticated
  with check (
    auteur = (select auth.uid())
    and (select public.est_membre())
    and (canal <> 'sfl' or (select public.peut_parler_au_vestiaire()))
  );

-- Où en est chaque joueur avec le Vestiaire : jusqu'où il a lu (la pastille,
-- d'un téléphone à l'autre), ce qu'il veut en notification, et quand on l'a
-- notifié pour la dernière fois (une notification groupée par heure au plus).
--   · notifs : 'tout' (cité, réactions, et le groupé), 'cite' (seulement
--     quand on le cite ou réagit à son message), 'rien'.
create table if not exists public.vestiaire_suivi (
  user_id     uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  lu_jusqua   timestamptz not null default now(),
  notifs      text not null default 'tout' check (notifs in ('tout', 'cite', 'rien')),
  notifie_le  timestamptz
);
-- Le Vestiaire ouvert à l'écran (19/10) : l'app le redit toutes les 20 s
-- tant qu'il est visible, et l'efface en partant. Pas de notification à qui
-- l'a sous les yeux, mais dès qu'il quitte, les messages le rattrapent.
alter table public.vestiaire_suivi add column if not exists devant_le timestamptz;

alter table public.vestiaire_suivi enable row level security;

drop policy if exists "suivi: le mien" on public.vestiaire_suivi;
create policy "suivi: le mien"
  on public.vestiaire_suivi for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- notifie_le n'appartient qu'au serveur (clé secrète) : le joueur ne règle
-- que sa lecture et ses notifications. Révoquer le droit de table AVANT de
-- donner les colonnes, sinon le droit de table les annule.
revoke insert, update on public.vestiaire_suivi from authenticated, anon;
grant insert (user_id, lu_jusqua, notifs, devant_le) on public.vestiaire_suivi to authenticated;
-- user_id aussi : un upsert le réécrit (à l'identique, la RLS y veille).
grant update (user_id, lu_jusqua, notifs, devant_le) on public.vestiaire_suivi to authenticated;

-- Les vocaux du Vestiaire (19/10) : bucket PRIVÉ « vocaux »,
-- <uuid de l'auteur>/<horodatage>.<ext>. Toute la ligue les écoute (liens
-- signés), chacun ne pose et ne retire que les siens. Une minute au plus,
-- donc 3 Mo suffisent ; mp4/aac pour l'iPhone, webm/ogg pour le reste.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('vocaux', 'vocaux', false, 3145728,
          array['audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/webm', 'audio/ogg', 'audio/mpeg'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when others then raise warning 'vocaux : bucket non créé (%)', sqlerrm;
end;
$$;

do $$
begin
  drop policy if exists "vocaux: la ligue écoute" on storage.objects;
  create policy "vocaux: la ligue écoute"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'vocaux' and (select public.est_membre()));

  drop policy if exists "vocaux: je pose les miens" on storage.objects;
  create policy "vocaux: je pose les miens"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'vocaux'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and (select public.est_membre())
      and (select public.peut_parler_au_vestiaire())
    );

  drop policy if exists "vocaux: je retire les miens" on storage.objects;
  create policy "vocaux: je retire les miens"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'vocaux'
      and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_league_admin()))
    );
exception
  when others then raise warning 'vocaux : règles Storage non posées (%)', sqlerrm;
end;
$$;

-- Les photos et les vidéos du Vestiaire (19/10) : bucket PRIVÉ « images »,
-- même rangement et mêmes règles que les vocaux. L'app réduit chaque photo à
-- 1600 px en JPEG avant l'envoi (≈ 300 Ko) ; une vidéo dure 30 s au plus et
-- pèse 25 Mo au plus.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('images', 'images', false, 26214400,
          array['image/jpeg', 'image/webp', 'image/png', 'video/mp4', 'video/quicktime', 'video/webm'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when others then raise warning 'images : bucket non créé (%)', sqlerrm;
end;
$$;

do $$
begin
  drop policy if exists "images: la ligue regarde" on storage.objects;
  create policy "images: la ligue regarde"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'images' and (select public.est_membre()));

  drop policy if exists "images: je pose les miennes" on storage.objects;
  create policy "images: je pose les miennes"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'images'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and (select public.est_membre())
      and (select public.peut_parler_au_vestiaire())
    );

  drop policy if exists "images: je retire les miennes" on storage.objects;
  create policy "images: je retire les miennes"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'images'
      and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_league_admin()))
    );
exception
  when others then raise warning 'images : règles Storage non posées (%)', sqlerrm;
end;
$$;

-- ────────────────────────────── Photos ───────────────────────────────
-- Les photos de profil, partagées : celle qu'un joueur pose apparaît sur sa
-- carte chez tout le monde. Un bucket Storage PUBLIC « photos » (les images
-- sont servies par le CDN, comme les portraits de public/players), un fichier
-- par joueur : <nom du joueur en hexadécimal UTF-8>.jpg — l'hexadécimal évite
-- les accents et les espaces que les clés Storage refusent.
--   · les membres listent le bucket (c'est ainsi que l'app sait qui a une
--     photo) ; un compte en attente n'y voit que la sienne, et sans compte on
--     ne liste rien (22/10/2026 : la liste donnait à n'importe qui les noms et
--     les visages de toute la ligue). Les fichiers restent publics par leur
--     adresse, pour s'afficher partout ;
--   · un membre accepté ne pose, remplace ou retire QUE la sienne (un
--     compte en attente n'en pose aucune : n'importe qui peut s'inscrire,
--     et la photo de carte se voit partout) ;
--   · l'admin peut corriger celle de n'importe qui.
-- Chaque bloc rattrape ses erreurs : un projet où Storage refuserait ces
-- règles ne doit pas faire échouer le reste de la migration.

-- Le nom du joueur porté par une clé de photo (null si la clé est mal formée).
create or replace function public.photo_joueur(cle text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  return convert_from(decode(split_part(cle, '.', 1), 'hex'), 'UTF8');
exception
  when others then return null;
end;
$$;

revoke execute on function public.photo_joueur(text) from public;
grant execute on function public.photo_joueur(text) to anon, authenticated;

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('photos', 'photos', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when others then raise warning 'photos : bucket non créé (%)', sqlerrm;
end;
$$;

do $$
begin
  drop policy if exists "photos: lecture ligue" on storage.objects;
  create policy "photos: lecture ligue"
    on storage.objects for select
    to authenticated
    using (
      bucket_id = 'photos'
      and (
        (select public.est_membre())
        or (select public.is_league_admin())
        or lower(public.photo_joueur(name)) = (
          select lower(p.name) from public.profiles p where p.id = (select auth.uid())
        )
      )
    );

  drop policy if exists "photos: je pose la mienne" on storage.objects;
  create policy "photos: je pose la mienne"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'photos'
      and (
        (
          (select public.est_membre())
          and lower(public.photo_joueur(name)) = (
            select lower(p.name) from public.profiles p where p.id = (select auth.uid())
          )
        )
        or (select public.is_league_admin())
      )
    );

  drop policy if exists "photos: je remplace la mienne" on storage.objects;
  create policy "photos: je remplace la mienne"
    on storage.objects for update
    to authenticated
    using (
      bucket_id = 'photos'
      and (
        (
          (select public.est_membre())
          and lower(public.photo_joueur(name)) = (
            select lower(p.name) from public.profiles p where p.id = (select auth.uid())
          )
        )
        or (select public.is_league_admin())
      )
    )
    with check (
      bucket_id = 'photos'
      and (
        (
          (select public.est_membre())
          and lower(public.photo_joueur(name)) = (
            select lower(p.name) from public.profiles p where p.id = (select auth.uid())
          )
        )
        or (select public.is_league_admin())
      )
    );

  drop policy if exists "photos: je retire la mienne" on storage.objects;
  create policy "photos: je retire la mienne"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'photos'
      and (
        (
          (select public.est_membre())
          and lower(public.photo_joueur(name)) = (
            select lower(p.name) from public.profiles p where p.id = (select auth.uid())
          )
        )
        or (select public.is_league_admin())
      )
    );
exception
  when others then raise warning 'photos : règles Storage non posées (%)', sqlerrm;
end;
$$;

-- ─────────────────────────── Fiches joueur ───────────────────────────
-- Ce que le joueur donne en créant son compte et que la ligue n'affiche pas :
-- identité civile, naissance, gabarit. PRIVÉ — le joueur et l'admin seuls la
-- lisent (le prénom affiché vit dans profiles.name, l'email dans
-- public.contacts). Le gabarit sert aux maillots et, plus tard, au
-- personnage de référence des skins.
create table if not exists public.fiches (
  player_id   uuid primary key references public.profiles(id) on delete cascade,
  prenom      text not null check (char_length(btrim(prenom)) between 1 and 40),
  nom         text not null check (char_length(btrim(nom)) between 1 and 60),
  naissance   date not null,
  taille_cm   smallint check (taille_cm between 120 and 230),
  poids_kg    numeric(4, 1) check (poids_kg between 35 and 200),
  pointure    numeric(3, 1) check (pointure between 30 and 52),
  maillot     text check (maillot in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  pied        text check (pied in ('droit', 'gauche', 'les deux')),
  poste       text check (poste in ('G', 'DG', 'DC', 'DD', 'MDC', 'MC', 'AG', 'AT', 'AD')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.fiches enable row level security;

-- Les joueurs inscrits avant les fiches n'y ont que leur prénom et leur nom,
-- posés en confirmant leur identité depuis Ma carte : la naissance attend.
alter table public.fiches alter column naissance drop not null;

-- Homme ou femme (Sabri, 24/10) : demandé à l'accueil de l'app, juste après
-- l'identité (components/sfl/accueil). Privé comme le reste de la fiche.
alter table public.fiches add column if not exists sexe text check (sexe in ('homme', 'femme'));

drop policy if exists "fiches: la mienne ou admin" on public.fiches;
create policy "fiches: la mienne ou admin"
  on public.fiches for select
  to authenticated
  using (player_id = (select auth.uid()) or (select public.is_league_admin()));

drop policy if exists "fiches: je pose la mienne" on public.fiches;
create policy "fiches: je pose la mienne"
  on public.fiches for insert
  to authenticated
  with check (player_id = (select auth.uid()));

drop policy if exists "fiches: je corrige la mienne" on public.fiches;
create policy "fiches: je corrige la mienne"
  on public.fiches for update
  to authenticated
  using (player_id = (select auth.uid()))
  with check (player_id = (select auth.uid()));

grant select, insert, update on public.fiches to authenticated;

drop trigger if exists fiches_touch on public.fiches;
create trigger fiches_touch before update on public.fiches
  for each row execute function public.touch_presence();

-- ─────────────────────── Photos de référence ─────────────────────────
-- Les quatre photos en pied prises à l'inscription — face, droite, gauche,
-- dos — d'où naîtra le personnage de référence du joueur (skins, filtres).
-- Bucket PRIVÉ « references » : <uuid du joueur>/<angle>.jpg. Le joueur
-- pose et relit les siennes, l'admin les voit toutes ; personne d'autre.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('references', 'references', false, 3145728, array['image/jpeg'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when others then raise warning 'references : bucket non créé (%)', sqlerrm;
end;
$$;

do $$
begin
  drop policy if exists "references: les miennes ou admin" on storage.objects;
  create policy "references: les miennes ou admin"
    on storage.objects for select
    to authenticated
    using (
      bucket_id = 'references'
      and (
        (storage.foldername(name))[1] = (select auth.uid())::text
        or (select public.is_league_admin())
      )
    );

  drop policy if exists "references: je pose les miennes" on storage.objects;
  create policy "references: je pose les miennes"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'references'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );

  drop policy if exists "references: je remplace les miennes" on storage.objects;
  create policy "references: je remplace les miennes"
    on storage.objects for update
    to authenticated
    using (
      bucket_id = 'references'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    with check (
      bucket_id = 'references'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    );
exception
  when others then raise warning 'references : règles Storage non posées (%)', sqlerrm;
end;
$$;

-- ─────────────────────── Matchs créés par les joueurs ───────────────────────
-- N'importe quel joueur ouvre un match, sans être admin (demande de Sabri,
-- 15/10) :
--   · privé  : l'organisateur ajoute les joueurs par leur identifiant ;
--     personne d'autre ne le voit ni n'y entre ;
--   · public : il invite qui il veut, et les places restantes s'affichent
--     sur la Map ; n'importe qui de la ligue peut prendre une place libre.
-- « La ligue » : les membres acceptés. Un compte en attente (n'importe qui
-- peut s'inscrire) n'ouvre aucun match, ne voit pas les matchs publics et
-- n'y entre pas (22/10/2026 : il voyait le lieu, l'heure et les joueurs).
-- Ces matchs vivent à côté de la saison (document admin) : ils ne touchent
-- pas aux classements tant que l'admin ne les reprend pas en journée.
create table if not exists public.matchs (
  id            bigint generated always as identity primary key,
  organisateur  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  genre         text not null default 'match' check (genre in ('match', 'exhibition')),
  visibilite    text not null check (visibilite in ('public', 'prive')),
  jour          date not null,
  heure         text not null,
  lieu          text not null check (char_length(btrim(lieu)) between 1 and 120),
  adresse       text,
  lat           double precision,
  lng           double precision,
  places        int not null default 10 check (places between 2 and 22),
  created_at    timestamptz not null default now()
);

create index if not exists matchs_jour_idx on public.matchs (jour);
create index if not exists matchs_organisateur_idx on public.matchs (organisateur);

-- Les joueurs d'un match : invités par l'organisateur, ou inscrits (ils ont
-- accepté l'invitation, ou pris une place libre d'un match public).
create table if not exists public.match_joueurs (
  match_id   bigint not null references public.matchs(id) on delete cascade,
  player_id  uuid   not null references public.profiles(id) on delete cascade,
  statut     text   not null default 'invite' check (statut in ('invite', 'inscrit')),
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index if not exists match_joueurs_player_idx on public.match_joueurs (player_id);

alter table public.matchs enable row level security;
alter table public.match_joueurs enable row level security;

-- Helpers SECURITY DEFINER : les règles des deux tables se lisent l'une
-- l'autre, ce qui bouclerait en RLS. L'identité est vérifiée DANS la fonction.
create or replace function public.organise_match(m bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.matchs x where x.id = m and x.organisateur = (select auth.uid())
  );
$$;

create or replace function public.voit_match(m bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.matchs x
     where x.id = m
       and (
         (x.visibilite = 'public' and public.est_membre())
         or x.organisateur = (select auth.uid())
         or exists (
           select 1 from public.match_joueurs j
            where j.match_id = x.id and j.player_id = (select auth.uid())
         )
       )
  ) or public.is_league_admin();
$$;

revoke execute on function public.organise_match(bigint) from public, anon;
revoke execute on function public.voit_match(bigint) from public, anon;
grant execute on function public.organise_match(bigint) to authenticated;
grant execute on function public.voit_match(bigint) to authenticated;

drop policy if exists "matchs: lecture" on public.matchs;
create policy "matchs: lecture"
  on public.matchs for select
  to authenticated
  -- Les colonnes de la ligne d'abord : un match qu'on vient d'ouvrir doit se
  -- relire dans la même requête (insert … returning), avant que la fonction
  -- puisse le voir.
  using (
    (visibilite = 'public' and (select public.est_membre()))
    or organisateur = (select auth.uid())
    or (select public.voit_match(id))
  );

drop policy if exists "matchs: j'ouvre le mien" on public.matchs;
create policy "matchs: j'ouvre le mien"
  on public.matchs for insert
  to authenticated
  with check (organisateur = (select auth.uid()) and (select public.est_membre()));

drop policy if exists "matchs: je modifie le mien" on public.matchs;
create policy "matchs: je modifie le mien"
  on public.matchs for update
  to authenticated
  using (organisateur = (select auth.uid()) or (select public.is_league_admin()))
  with check (organisateur = (select auth.uid()) or (select public.is_league_admin()));

drop policy if exists "matchs: j'annule le mien" on public.matchs;
create policy "matchs: j'annule le mien"
  on public.matchs for delete
  to authenticated
  using (organisateur = (select auth.uid()) or (select public.is_league_admin()));

drop policy if exists "match_joueurs: lecture" on public.match_joueurs;
create policy "match_joueurs: lecture"
  on public.match_joueurs for select
  to authenticated
  using ((select public.voit_match(match_id)));

-- L'organisateur invite (et inscrit) qui il veut ; un membre ne prend
-- lui-même qu'une place d'un match public. La capacité est gardée par le
-- trigger plus bas, pas par la règle ; ce qu'il apporte en entrant (rien :
-- ni équipe ni stats), par match_entree_gardee.
drop policy if exists "match_joueurs: on entre" on public.match_joueurs;
create policy "match_joueurs: on entre"
  on public.match_joueurs for insert
  to authenticated
  with check (
    (select public.organise_match(match_id))
    or (
      player_id = (select auth.uid())
      and statut = 'inscrit'
      and (select public.est_membre())
      and exists (select 1 from public.matchs x where x.id = match_id and x.visibilite = 'public')
    )
  );

-- Accepter une invitation : on ne touche qu'à sa propre ligne.
drop policy if exists "match_joueurs: j'accepte" on public.match_joueurs;
create policy "match_joueurs: j'accepte"
  on public.match_joueurs for update
  to authenticated
  using (player_id = (select auth.uid()) or (select public.organise_match(match_id)))
  with check (player_id = (select auth.uid()) or (select public.organise_match(match_id)));

-- On se retire soi-même (avant la feuille : match_sortie_gardee, plus bas) ;
-- l'organisateur retire n'importe qui de son match.
drop policy if exists "match_joueurs: on sort" on public.match_joueurs;
create policy "match_joueurs: on sort"
  on public.match_joueurs for delete
  to authenticated
  using (
    player_id = (select auth.uid())
    or (select public.organise_match(match_id))
    or (select public.is_league_admin())
  );

-- Jamais plus de joueurs que de places : verrou sur le match, puis compte.
create or replace function public.match_complet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cap int;
  n   int;
begin
  select places into cap from public.matchs where id = new.match_id for update;
  select count(*) into n from public.match_joueurs where match_id = new.match_id;
  if n >= cap then
    raise exception 'match complet' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.match_complet() from public, anon, authenticated;

drop trigger if exists match_joueurs_capacite on public.match_joueurs;
create trigger match_joueurs_capacite before insert on public.match_joueurs
  for each row execute function public.match_complet();

grant select, insert, update, delete on public.matchs to authenticated;
grant select, insert, update, delete on public.match_joueurs to authenticated;

-- Une invitation n'est poussée qu'une fois sur le téléphone de l'invité
-- (/api/matchs/notifier) : l'heure de l'envoi, null tant qu'il n'est pas prévenu.
alter table public.match_joueurs add column if not exists notifie_le timestamptz;

-- ─────────────────── Mode Bola : le résultat et la Ligue vierge ───────────────────
-- Trois façons de jouer (Sabri, 22/10) : les matchs Bola, que n'importe quel
-- joueur ouvre hors de la SFL ; les matchs d'équipe (mode Team, à venir) ;
-- les journées de la ligue (le document saison, à part). Un match ouvert par
-- un joueur est un match Bola : l'organisateur en saisit le résultat (deux
-- équipes, Clairs et Foncés, les buts et les passes de chacun), et la Ligue
-- vierge les compte tous, à vie, jamais remise à zéro (règles officielles,
-- docs/gameplay/03-mode-bola.md). Le MVP n'est jamais voté : l'app le tire
-- des stats (lib/sfl/ligue-vierge.ts).
alter table public.matchs add column if not exists mode text not null default 'bola';
do $$
begin
  alter table public.matchs add constraint matchs_mode_check check (mode in ('bola', 'team'));
exception when duplicate_object then null;
end;
$$;
alter table public.matchs add column if not exists score_clairs int check (score_clairs between 0 and 99);
alter table public.matchs add column if not exists score_fonces int check (score_fonces between 0 and 99);
alter table public.matchs add column if not exists saisi_le timestamptz;

-- equipe : null tant que rien n'est saisi, puis clairs, fonces ou absent.
alter table public.match_joueurs add column if not exists equipe text check (equipe in ('clairs', 'fonces', 'absent'));
alter table public.match_joueurs add column if not exists buts int not null default 0 check (buts between 0 and 99);
alter table public.match_joueurs add column if not exists passes int not null default 0 check (passes between 0 and 99);

-- Un joueur accepte son invitation (sa ligne), mais seul l'organisateur (ou
-- l'admin) écrit les stats ; une ligne ne change jamais de match ni de
-- joueur ; et une feuille ne se corrige plus 24 h après sa première saisie.
create or replace function public.match_feuille_gardee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  saisi timestamptz;
begin
  if public.is_league_admin() then
    return new;
  end if;
  if tg_table_name = 'match_joueurs' then
    -- On emportait sa ligne, stats comprises, dans un autre match : plein,
    -- déjà joué, où personne ne l'avait invité (22/10/2026).
    if (new.match_id, new.player_id) is distinct from (old.match_id, old.player_id) then
      raise exception 'ligne de feuille figée' using errcode = '42501';
    end if;
    if (new.equipe, new.buts, new.passes) is distinct from (old.equipe, old.buts, old.passes) then
      if not public.organise_match(new.match_id) then
        raise exception 'feuille réservée à l''organisateur' using errcode = '42501';
      end if;
      select saisi_le into saisi from public.matchs where id = new.match_id;
      if saisi is not null and saisi < now() - interval '24 hours' then
        raise exception 'feuille close' using errcode = 'P0001';
      end if;
    end if;
  else
    if (new.score_clairs, new.score_fonces) is distinct from (old.score_clairs, old.score_fonces)
       and old.saisi_le is not null and old.saisi_le < now() - interval '24 hours' then
      raise exception 'feuille close' using errcode = 'P0001';
    end if;
    -- La première saisie date la feuille (l'heure du serveur) ; une
    -- correction ne la repousse pas.
    if old.saisi_le is not null then
      new.saisi_le := old.saisi_le;
    elsif new.score_clairs is not null and new.score_fonces is not null then
      new.saisi_le := now();
    else
      new.saisi_le := null;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.match_feuille_gardee() from public, anon, authenticated;

drop trigger if exists match_joueurs_feuille on public.match_joueurs;
create trigger match_joueurs_feuille before update on public.match_joueurs
  for each row execute function public.match_feuille_gardee();

drop trigger if exists matchs_feuille on public.matchs;
create trigger matchs_feuille before update on public.matchs
  for each row execute function public.match_feuille_gardee();

-- Qui prend lui-même une place n'apporte ni équipe ni stats : c'est
-- l'organisateur qui les écrit (match_feuille_gardee, juste au-dessus). Et il
-- n'entre pas dans un match dont la feuille est faite : on s'ajoutait à un
-- match déjà joué, avec les buts qu'on voulait, et la Ligue vierge les
-- comptait à vie (22/10/2026).
create or replace function public.match_entree_gardee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Le serveur (clé secrète), l'admin et l'organisateur passent.
  if (select auth.uid()) is null or public.is_league_admin() or public.organise_match(new.match_id) then
    return new;
  end if;
  if new.equipe is not null or new.buts <> 0 or new.passes <> 0 then
    raise exception 'feuille réservée à l''organisateur' using errcode = '42501';
  end if;
  if exists (select 1 from public.matchs x where x.id = new.match_id and x.saisi_le is not null) then
    raise exception 'match déjà joué' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.match_entree_gardee() from public, anon, authenticated;

drop trigger if exists match_joueurs_entree on public.match_joueurs;
create trigger match_joueurs_entree before insert on public.match_joueurs
  for each row execute function public.match_entree_gardee();

-- On se retire d'un match tant que sa feuille n'est pas faite ; ensuite,
-- seul l'organisateur (ou l'admin) en retire quelqu'un. On effaçait sa ligne
-- d'un match perdu, et la Ligue vierge oubliait la défaite (22/10/2026).
-- Le match annulé emporte ses lignes sans passer par ici : il n'est déjà
-- plus là quand elles partent.
create or replace function public.match_sortie_gardee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_league_admin() or public.organise_match(old.match_id) then
    return old;
  end if;
  if exists (select 1 from public.matchs x where x.id = old.match_id and x.saisi_le is not null) then
    raise exception 'match déjà joué' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

revoke execute on function public.match_sortie_gardee() from public, anon, authenticated;

drop trigger if exists match_joueurs_sortie on public.match_joueurs;
create trigger match_joueurs_sortie before delete on public.match_joueurs
  for each row execute function public.match_sortie_gardee();

-- La Ligue vierge lit tous les matchs Bola joués, privés compris : seulement
-- le jour, l'heure et qui a fait quoi — ni le lieu, ni les invités. Pour les
-- membres seulement : un compte en attente reçoit une liste vide.
create or replace function public.ligue_vierge()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', m.id,
           'jour', m.jour,
           'heure', m.heure,
           'genre', m.genre,
           'scoreClairs', m.score_clairs,
           'scoreFonces', m.score_fonces,
           'joueurs', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', j.player_id, 'name', p.name, 'equipe', j.equipe, 'buts', j.buts, 'passes', j.passes)), '[]'::jsonb)
               from public.match_joueurs j
               join public.profiles p on p.id = j.player_id
              where j.match_id = m.id and j.equipe in ('clairs', 'fonces')
           )
         ) order by m.jour, m.heure, m.id), '[]'::jsonb)
    from public.matchs m
   where public.est_membre()
     and m.mode = 'bola' and m.saisi_le is not null
     and m.score_clairs is not null and m.score_fonces is not null;
$$;

revoke execute on function public.ligue_vierge() from public, anon;
grant execute on function public.ligue_vierge() to authenticated;

-- ─────────────────────────── Disponibilités ──────────────────────────
-- Chaque joueur dit quand il peut jouer : un jour, un moment. La ligue s'en
-- sert pour composer des matchs et inviter (matchmaking), et chacun voit,
-- en ouvrant l'app, qui est libre en même temps que lui. La ligue seulement :
-- un compte en attente ne lit que les siennes et n'en pose pas (22/10/2026).
create table if not exists public.disponibilites (
  player_id  uuid not null references public.profiles(id) on delete cascade,
  jour       date not null,
  moment     text not null check (moment in ('matin', 'apres-midi', 'soir')),
  created_at timestamptz not null default now(),
  primary key (player_id, jour, moment)
);

create index if not exists disponibilites_jour_idx on public.disponibilites (jour);

alter table public.disponibilites enable row level security;

drop policy if exists "disponibilites: lecture ligue" on public.disponibilites;
create policy "disponibilites: lecture ligue"
  on public.disponibilites for select
  to authenticated
  using ((select public.est_membre()) or player_id = (select auth.uid()));

drop policy if exists "disponibilites: je dis les miennes" on public.disponibilites;
create policy "disponibilites: je dis les miennes"
  on public.disponibilites for insert
  to authenticated
  with check (player_id = (select auth.uid()) and (select public.est_membre()));

drop policy if exists "disponibilites: je retire les miennes" on public.disponibilites;
create policy "disponibilites: je retire les miennes"
  on public.disponibilites for delete
  to authenticated
  using (player_id = (select auth.uid()));

grant select, insert, delete on public.disponibilites to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.matchs;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.match_joueurs;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- ─────────────────────── Photos officielles (studio) ───────────────────────
-- Chaque photo de studio ou filtre généré par fal.ai (route /api/photo-studio)
-- laisse une ligne ici : la route compte les dernières 24 h du joueur pour
-- tenir le crédit fal. Le joueur n'écrit et ne lit que ses lignes ; personne
-- ne les efface (pas de politique delete), donc on ne remet pas son compteur
-- à zéro soi-même.
create table if not exists public.photo_studio (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  filtre      text not null,
  created_at  timestamptz not null default now()
);
create index if not exists photo_studio_user_date on public.photo_studio (user_id, created_at desc);
-- Le pays du filtre drapeau (son code, lib/sfl/photo-studio.ts), depuis le
-- 22/10 : la page Activité de l'admin montre la part de chaque pays choisi.
-- Les lignes plus anciennes n'en ont pas.
alter table public.photo_studio add column if not exists pays text;

alter table public.photo_studio enable row level security;

drop policy if exists "photo_studio: je lis les miennes" on public.photo_studio;
create policy "photo_studio: je lis les miennes"
  on public.photo_studio for select to authenticated
  using (user_id = (select auth.uid()));

-- L'admin lit tout : les pays choisis, dans Activité.
drop policy if exists "photo_studio: l'admin lit tout" on public.photo_studio;
create policy "photo_studio: l'admin lit tout"
  on public.photo_studio for select to authenticated
  using ((select public.is_league_admin()));

drop policy if exists "photo_studio: je note la mienne" on public.photo_studio;
create policy "photo_studio: je note la mienne"
  on public.photo_studio for insert to authenticated
  with check (user_id = (select auth.uid()));

-- ───────────────────── Notifications (web push) ─────────────────────
-- Un téléphone qui a accepté les notifications laisse ici son abonnement
-- (l'adresse du service de push de son navigateur et ses deux clés). Le
-- joueur n'écrit et n'efface que les siens ; seul l'admin les lit tous, avec
-- ses propres droits, pour envoyer depuis /api/push/envoyer, et efface ceux
-- que le service de push dit morts (appli supprimée, permission retirée).
create table if not exists public.push_abonnements (
  endpoint    text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists push_abonnements_user on public.push_abonnements (user_id);

alter table public.push_abonnements enable row level security;

drop policy if exists "push: je lis les miens, l'admin tout" on public.push_abonnements;
create policy "push: je lis les miens, l'admin tout"
  on public.push_abonnements for select to authenticated
  using (user_id = (select auth.uid()) or public.is_league_admin());

drop policy if exists "push: j'ajoute le mien" on public.push_abonnements;
create policy "push: j'ajoute le mien"
  on public.push_abonnements for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "push: je remplace le mien" on public.push_abonnements;
create policy "push: je remplace le mien"
  on public.push_abonnements for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "push: j'efface le mien, l'admin les morts" on public.push_abonnements;
create policy "push: j'efface le mien, l'admin les morts"
  on public.push_abonnements for delete to authenticated
  using (user_id = (select auth.uid()) or public.is_league_admin());

-- ─────────────── Notifications : ce qu'elles deviennent ───────────────
-- Sabri, 23/10 : « mets dans les analytics les gens qui répondent à la
-- notification, c'est-à-dire combien ont activé la notification et ce à
-- quoi ils ont répondu suite à un motif ». Admin → Activité & rétention →
-- Notifications (src/app/admin/activite/notifications.tsx) lit :
--   · push_envois : une ligne par notification et par joueur. Son motif
--     (lib/sfl/motifs-notif.ts), son heure, si un téléphone l'a reçue et si
--     le joueur l'a touchée (le service worker le dit à /api/push/suivi),
--     et s'il a fait ce qu'elle attendait (les triggers push_effet_*, plus
--     bas). Jamais son texte ;
--   · push_historique : chaque téléphone qui s'abonne ou s'en va, pour la
--     courbe des joueurs joignables (push_abonnements ne garde que le
--     présent) ;
--   · activity, kind 'notifs' : l'invitation de l'ouverture montrée, et ce
--     que le joueur en fait (activées, refusées, plus tard).
-- Le serveur seul écrit ici (clé secrète, triggers), l'admin seul lit. On
-- garde 13 mois, comme le journal d'usage.
create table if not exists public.push_envois (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  motif       text not null,
  -- Ce à quoi elle se rattache (« match:12 », « equipe:3 ») : le geste
  -- attendu doit avoir lieu là.
  ref         text,
  -- Ses téléphones, et ceux dont le service de push l'a prise : null tant
  -- que l'envoi n'est pas fini, 0 si elle n'est partie nulle part.
  appareils   smallint not null default 0,
  acceptes    smallint,
  envoyee_le  timestamptz not null default now(),
  recue_le    timestamptz,
  ouverte_le  timestamptz,
  -- Le geste attendu, une fois fait : 'message', 'reaction', 'accepte' ou
  -- 'refuse' (une invitation, les missions), 'suivi' (suivi en retour).
  effet       text,
  effet_le    timestamptz
);
-- Le joueur dont elle vient (24/10) : celui qui a écrit, réagi, invité,
-- suivi ou félicité ; null quand c'est l'app (rappels, annonces de la ligue,
-- missions). Admin → Activité en tire « Qui ramène du monde » : les joueurs
-- dont un geste fait revenir les autres. Avant cette colonne, la page le
-- déduit, quand elle le peut, du geste qui a déclenché la notification.
alter table public.push_envois add column if not exists de uuid references public.profiles(id) on delete set null;
create index if not exists push_envois_envoyee on public.push_envois (envoyee_le desc);
create index if not exists push_envois_en_attente
  on public.push_envois (user_id, envoyee_le desc) where effet_le is null;

alter table public.push_envois enable row level security;

drop policy if exists "push_envois: l'admin lit" on public.push_envois;
create policy "push_envois: l'admin lit"
  on public.push_envois for select to authenticated
  using ((select public.is_league_admin()));

revoke all on public.push_envois from anon, authenticated;
grant select on public.push_envois to authenticated;

create table if not exists public.push_historique (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- Le téléphone, sans son adresse : l'empreinte de son abonnement.
  appareil   text not null,
  -- Qui achemine : apple (iPhone, Mac), google (Android, Chrome), mozilla,
  -- microsoft, autre.
  service    text not null,
  evenement  text not null check (evenement in ('ajout', 'retrait')),
  le         timestamptz not null default now()
);
create index if not exists push_historique_le on public.push_historique (le);
create index if not exists push_historique_appareil on public.push_historique (appareil);

alter table public.push_historique enable row level security;

drop policy if exists "push_historique: l'admin lit" on public.push_historique;
create policy "push_historique: l'admin lit"
  on public.push_historique for select to authenticated
  using ((select public.is_league_admin()));

revoke all on public.push_historique from anon, authenticated;
grant select on public.push_historique to authenticated;

create or replace function public.push_service(endpoint text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when endpoint like 'https://web.push.apple.com/%' then 'apple'
    when endpoint like 'https://fcm.googleapis.com/%' or endpoint like 'https://android.googleapis.com/%' then 'google'
    when endpoint like '%mozilla.com/%' or endpoint like '%mozaws.net/%' then 'mozilla'
    when endpoint like '%.notify.windows.com/%' then 'microsoft'
    else 'autre'
  end;
$$;

revoke execute on function public.push_service(text) from public, anon, authenticated;

-- Chaque abonnement qui arrive, part, ou change de joueur (un autre s'est
-- connecté sur le téléphone). L'abonnement redonné à chaque ouverture ne
-- change rien. Un compte supprimé n'écrit plus rien : son historique part
-- avec lui. Le suivi n'empêche jamais un abonnement.
create or replace function public.push_historiser()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.user_id is distinct from new.user_id) then
      if exists (select 1 from auth.users u where u.id = old.user_id) then
        insert into public.push_historique (user_id, appareil, service, evenement)
        values (old.user_id, md5(old.endpoint), public.push_service(old.endpoint), 'retrait');
      end if;
    end if;
    if tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.user_id is distinct from new.user_id) then
      insert into public.push_historique (user_id, appareil, service, evenement)
      values (new.user_id, md5(new.endpoint), public.push_service(new.endpoint), 'ajout');
    end if;
  exception when others then
    raise warning 'push_historiser : %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.push_historiser() from public, anon, authenticated;

drop trigger if exists push_abonnements_historique on public.push_abonnements;
create trigger push_abonnements_historique
  after insert or update or delete on public.push_abonnements
  for each row execute function public.push_historiser();

-- Les téléphones abonnés avant le suivi : leur arrivée, à la date de leur
-- abonnement (une seule fois).
insert into public.push_historique (user_id, appareil, service, evenement, le)
select a.user_id, md5(a.endpoint), public.push_service(a.endpoint), 'ajout', a.created_at
from public.push_abonnements a
where not exists (select 1 from public.push_historique h where h.appareil = md5(a.endpoint));

-- Le geste qu'une notification attendait. Il revient à UNE notification du
-- joueur qui l'attend encore, du bon motif et au bon endroit : celle qu'il a
-- touchée dans l'heure d'abord, sinon la plus récente partie depuis moins de
-- `fenetre`. Un geste ne compte qu'une fois : cinq notifications du
-- Vestiaire suivies d'un seul message, c'est une sur cinq.
create or replace function public.push_effet(qui uuid, motifs text[], cle text, geste text, fenetre interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cible uuid;
begin
  if qui is null then
    return;
  end if;
  select e.id into cible
    from public.push_envois e
   where e.user_id = qui
     and e.motif = any (motifs)
     and (cle is null or e.ref = cle)
     and e.effet_le is null
     and coalesce(e.acceptes, 1) > 0
     and (e.ouverte_le > now() - interval '1 hour' or e.envoyee_le > now() - fenetre)
   order by (e.ouverte_le > now() - interval '1 hour') desc nulls last, e.envoyee_le desc
   limit 1;
  if cible is not null then
    update public.push_envois set effet = geste, effet_le = now() where id = cible;
  end if;
end;
$$;

revoke execute on function public.push_effet(uuid, text[], text, text, interval) from public, anon, authenticated;

-- Écrire ou réagir dans une discussion : ce qu'attendent ses notifications.
-- Au Vestiaire, toutes celles du Vestiaire ; dans un match ou une équipe,
-- celles de CE match ou de CETTE équipe (le rappel de la veille et le
-- nouveau rendez-vous compris : y répondre, c'est y avoir donné suite).
create or replace function public.push_effet_discussion(qui uuid, canal text, match bigint, equipe bigint, geste text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if canal = 'sfl' then
    perform public.push_effet(qui,
      array['vestiaire-message', 'vestiaire-reponse', 'vestiaire-cite', 'vestiaire-en-avant', 'vestiaire-reaction'],
      null, geste, interval '2 hours');
  elsif canal = 'match' and match is not null then
    perform public.push_effet(qui,
      array['match-message', 'match-reponse', 'match-cite', 'match-reaction', 'match-arrivee', 'match-veille', 'match-modifie'],
      'match:' || match, geste, interval '2 hours');
  elsif canal = 'equipe' and equipe is not null then
    perform public.push_effet(qui,
      array['equipe-message', 'equipe-reponse', 'equipe-cite', 'equipe-reaction'],
      'equipe:' || equipe, geste, interval '2 hours');
  end if;
end;
$$;

revoke execute on function public.push_effet_discussion(uuid, text, bigint, bigint, text) from public, anon, authenticated;

-- Un message (la ligne « … a rejoint le match » n'en est pas un : c'est
-- l'invitation acceptée, comptée plus bas), puis une réaction. Le suivi
-- n'empêche jamais d'écrire.
create or replace function public.push_effet_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if coalesce(new.piece ->> 'type', '') <> 'rejoint' then
      perform public.push_effet_discussion(new.auteur, new.canal, new.match_id, new.equipe_id, 'message');
    end if;
  exception when others then
    raise warning 'push_effet_message : %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.push_effet_message() from public, anon, authenticated;

drop trigger if exists messages_push_effet on public.messages;
create trigger messages_push_effet
  after insert on public.messages
  for each row execute function public.push_effet_message();

create or replace function public.push_effet_reaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  begin
    select canal, match_id, equipe_id into m from public.messages where id = new.message_id;
    if found then
      perform public.push_effet_discussion(new.user_id, m.canal, m.match_id, m.equipe_id, 'reaction');
    end if;
  exception when others then
    raise warning 'push_effet_reaction : %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.push_effet_reaction() from public, anon, authenticated;

drop trigger if exists message_reactions_push_effet on public.message_reactions;
create trigger message_reactions_push_effet
  after insert on public.message_reactions
  for each row execute function public.push_effet_reaction();

-- La réponse à une invitation : l'invité accepte (sa ligne passe à
-- 'inscrit'), ou la retire lui-même (refus). Ce que l'organisateur retire,
-- ou un match annulé, n'est pas une réponse.
create or replace function public.push_effet_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op = 'UPDATE' then
      if old.statut = 'invite' and new.statut = 'inscrit' then
        perform public.push_effet(new.player_id, array['match-invitation'], 'match:' || new.match_id, 'accepte', interval '14 days');
      end if;
    elsif old.statut = 'invite' and old.player_id = (select auth.uid()) then
      perform public.push_effet(old.player_id, array['match-invitation'], 'match:' || old.match_id, 'refuse', interval '14 days');
    end if;
  exception when others then
    raise warning 'push_effet_invitation : %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.push_effet_invitation() from public, anon, authenticated;

drop trigger if exists match_joueurs_push_effet on public.match_joueurs;
create trigger match_joueurs_push_effet
  after update of statut or delete on public.match_joueurs
  for each row execute function public.push_effet_invitation();

-- 13 mois au plus (aussi chaque lundi, /api/convocation/cron) ; l'arrivée
-- d'un téléphone toujours abonné reste, sans elle la courbe le perdrait.
delete from public.push_envois where envoyee_le < now() - interval '13 months';
delete from public.push_historique h
 where h.le < now() - interval '13 months'
   and not exists (select 1 from public.push_abonnements a where md5(a.endpoint) = h.appareil);

-- Un abonnement ne désigne qu'un vrai service de notifications (Apple,
-- Google, Mozilla, Microsoft) : le serveur appelle cette adresse à chaque
-- envoi, et une adresse quelconque faisait de lui un relais vers n'importe
-- quel site (22/10/2026). La même liste est recopiée côté serveur
-- (lib/server/web-push.ts, SERVICES_PUSH) : les changer ensemble. Les
-- abonnements déjà là sont vérifiés à part, sans faire échouer la migration.
do $$
begin
  alter table public.push_abonnements add constraint push_abonnements_service_connu check (
    endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
  ) not valid;
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  alter table public.push_abonnements validate constraint push_abonnements_service_connu;
exception
  when check_violation then
    raise warning 'push : des abonnements anciens visent un service inconnu (%)', sqlerrm;
end;
$$;

-- ───────────────────────── Rôle admin ────────────────────────────────
-- Remise d'aplomb des comptes admin — rejouée à chaque migration, donc à
-- chaque déploiement qui touche ce fichier. Elle répare TOUS les états de
-- départ : compte créé avant le trigger (profil absent), profil créé sans
-- métadonnées (nom « sabri » déduit de l'email au lieu de « Sabri »), ou
-- promotion jouée avant que le compte existe. Reconnaissance par email
-- technique EXACT, jamais par métadonnées ni par pseudo.
do $$
declare
  a record;
begin
  for a in
    select * from (values
      ('ilyes@sfl.local', 'Ilyes', '@ilyes'),
      ('sabri@sfl.local', 'Sabri', '@sabri')
    ) as t(email, name, username)
  loop
    begin
      insert into public.profiles (id, name, username, is_admin, valide)
      select u.id, a.name, a.username, true, true
        from auth.users u
       where u.email = a.email
      -- Le pseudo n'est posé qu'à la création : ensuite il appartient au
      -- joueur (garde_pseudo). Le réécrire ici faisait échouer TOUTE la
      -- migration dès qu'un admin avait changé le sien (19/10).
      on conflict (id) do update
        set is_admin = true, valide = true, name = excluded.name;
    exception
      -- Un autre profil porte déjà ce nom ou ce pseudo : on ne casse pas la
      -- migration pour ça, on promeut au moins le rôle.
      when unique_violation then
        update public.profiles p
           set is_admin = true, valide = true
          from auth.users u
         where u.id = p.id and u.email = a.email;
    end;
  end loop;
end;
$$;

-- ─────────────────────── Votes des figures de match ───────────────────────
-- Remis le 17/10 à la demande de Sabri : dans les journées dont le MVP sort
-- des stats, les joueurs élisent encore le Joueur Impact et le meilleur
-- défenseur. Un vote par joueur, par journée et par titre, pour un adversaire
-- de son match (contrôlé par l'app, qui connaît les équipes). Le plus voté de
-- chaque match prend la carte ; à égalité, tous les ex æquo.
--
-- Règle : on vote le jour du match, jusqu'à minuit heure de Paris. La base le
-- garde aussi : `jour` doit être aujourd'hui à Paris, à l'écriture comme à la
-- modification — passé minuit, plus rien ne s'écrit pour ce jour-là. (Que ce
-- jour soit bien celui de la journée, c'est l'app qui le vérifie : la date de
-- la journée vit dans le document de saison.)
create table if not exists public.votes_figures (
  saison     integer not null,
  j          integer not null,
  categorie  text    not null check (categorie in ('impact', 'def')),
  -- Les noms de joueurs de la saison, la clé utilisée partout dans l'app.
  votant     text    not null,
  candidat   text    not null,
  match_id   text    not null,
  jour       date    not null,
  votant_id  uuid    not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (saison, j, categorie, votant),
  check (candidat <> votant)
);

alter table public.votes_figures enable row level security;

-- Le nom de joueur de l'appelant (profiles.name).
create or replace function public.mon_nom()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select p.name from public.profiles p where p.id = (select auth.uid());
$$;

revoke execute on function public.mon_nom() from public, anon;
grant execute on function public.mon_nom() to authenticated;

drop policy if exists "votes_figures: la ligue lit" on public.votes_figures;
create policy "votes_figures: la ligue lit"
  on public.votes_figures for select
  to authenticated
  using ((select public.est_membre()));

drop policy if exists "votes_figures: je vote aujourd'hui" on public.votes_figures;
create policy "votes_figures: je vote aujourd'hui"
  on public.votes_figures for insert
  to authenticated
  with check (
    (select public.est_membre())
    and votant_id = (select auth.uid())
    and votant = (select public.mon_nom())
    and jour = (now() at time zone 'Europe/Paris')::date
  );

drop policy if exists "votes_figures: je change d'avis aujourd'hui" on public.votes_figures;
create policy "votes_figures: je change d'avis aujourd'hui"
  on public.votes_figures for update
  to authenticated
  using (votant_id = (select auth.uid()) and jour = (now() at time zone 'Europe/Paris')::date)
  with check (
    votant_id = (select auth.uid())
    and votant = (select public.mon_nom())
    and jour = (now() at time zone 'Europe/Paris')::date
  );

grant select, insert, update on public.votes_figures to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.votes_figures;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- ─────────────────────── Missions du dimanche ───────────────────────
-- Sabri, 22/10 : des missions tirées de la feuille de match, que chacun
-- accepte ou passe (lib/sfl/missions.ts). Trois par joueur et par journée :
-- le contrat contre son rival, le défi du dimanche, la ligue (le vote). Elles
-- ne donnent jamais de point Pépite, seulement de l'XP, que l'app recalcule
-- depuis la feuille : ici, on ne garde que les réponses.
--
-- Règles :
--   · on répond pour soi seulement, par repondre_mission() : la base pose le
--     nom (mon_nom) et l'heure (now()), jamais le téléphone. L'app ne retient
--     qu'une réponse donnée avant le coup d'envoi, qu'elle lit dans la saison ;
--   · chacun lit ses réponses ; la ligue voit toutes les missions acceptées
--     (Sabri, 23/10 : « montrer tous les contrats qui sont acceptés, les
--     missions qui sont en jeu », les Contrats en jeu des Actus). Un « passer »
--     reste à celui qui l'a donné.
create table if not exists public.missions_reponses (
  saison     integer not null,
  j          integer not null,
  mission    text    not null check (mission in ('contrat', 'defi', 'ligue')),
  -- Le nom de joueur de la saison, la clé utilisée partout dans l'app.
  joueur     text    not null,
  reponse    text    not null check (reponse in ('acceptee', 'passee')),
  -- Le rival du contrat au moment de répondre : si la feuille change, la réponse tombe.
  cible      text,
  joueur_id  uuid    not null references public.profiles(id) on delete cascade,
  le         timestamptz not null default now(),
  primary key (saison, j, mission, joueur)
);

alter table public.missions_reponses enable row level security;

-- Jusqu'au 23/10, la ligue ne voyait un contrat qu'accepté des deux côtés
-- (duel_accepte) : cette règle et sa fonction s'en vont.
drop policy if exists "missions_reponses: les miennes, et les duels des deux côtés" on public.missions_reponses;
drop function if exists public.duel_accepte(integer, integer, text, text);

drop policy if exists "missions_reponses: les miennes, et les acceptées" on public.missions_reponses;
create policy "missions_reponses: les miennes, et les acceptées"
  on public.missions_reponses for select
  to authenticated
  using (
    (select public.est_membre())
    and (joueur_id = (select auth.uid()) or reponse = 'acceptee')
  );

revoke all on public.missions_reponses from anon, authenticated;
grant select on public.missions_reponses to authenticated;

-- Répondre à une mission : la seule porte d'écriture. Renvoie l'heure posée.
create or replace function public.repondre_mission(
  p_saison integer,
  p_j integer,
  p_mission text,
  p_reponse text,
  p_cible text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := public.mon_nom();
  v_le  timestamptz := now();
begin
  if not public.est_membre() or v_nom is null then
    raise exception 'Réservé aux joueurs de la ligue.' using errcode = '42501';
  end if;
  if p_mission not in ('contrat', 'defi', 'ligue') or p_reponse not in ('acceptee', 'passee') then
    raise exception 'Réponse inconnue.' using errcode = '22023';
  end if;
  insert into public.missions_reponses (saison, j, mission, joueur, reponse, cible, joueur_id, le)
  values (p_saison, p_j, p_mission, v_nom, p_reponse, nullif(btrim(p_cible), ''), (select auth.uid()), v_le)
  on conflict (saison, j, mission, joueur) do update
    set reponse = excluded.reponse, cible = excluded.cible, joueur_id = excluded.joueur_id, le = excluded.le;
  return v_le;
end;
$$;

revoke execute on function public.repondre_mission(integer, integer, text, text, text) from public, anon;
grant execute on function public.repondre_mission(integer, integer, text, text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.missions_reponses;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- Répondre à ses missions : ce qu'attend la notification « Missions Bola ·
-- J3 » (/api/missions/annoncer, motif 'missions', rattachée à la journée ;
-- push_effet plus haut). Une mission acceptée en fait un oui ('accepte'),
-- même après en avoir passé une autre ; passer sans rien accepter, un non
-- ('refuse'). Le suivi n'empêche jamais de répondre.
create or replace function public.push_effet_missions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text := 'missions:' || new.saison || ':' || new.j;
begin
  begin
    if new.reponse = 'acceptee' then
      update public.push_envois e
         set effet = 'accepte'
       where e.user_id = new.joueur_id and e.motif = 'missions' and e.ref = v_ref and e.effet = 'refuse';
      if not found then
        perform public.push_effet(new.joueur_id, array['missions'], v_ref, 'accepte', interval '7 days');
      end if;
    else
      perform public.push_effet(new.joueur_id, array['missions'], v_ref, 'refuse', interval '7 days');
    end if;
  exception when others then
    raise warning 'push_effet_missions : %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.push_effet_missions() from public, anon, authenticated;

drop trigger if exists missions_reponses_push_effet on public.missions_reponses;
create trigger missions_reponses_push_effet
  after insert or update of reponse on public.missions_reponses
  for each row execute function public.push_effet_missions();

-- Les missions déjà annoncées par notification (/api/missions/annoncer) :
-- une fois par joueur et par journée. Fermée aux téléphones : seule la route
-- serveur, avec la clé secrète, la lit et l'écrit.
create table if not exists public.missions_envois (
  saison    integer not null,
  j         integer not null,
  joueur    text    not null,
  envoye_le timestamptz not null default now(),
  primary key (saison, j, joueur)
);

alter table public.missions_envois enable row level security;
revoke all on public.missions_envois from anon, authenticated;

-- ─────────────────────────── Bola Agent ───────────────────────────
-- La conversation d'un joueur avec son coach (/agent, route /api/agent) :
-- ses questions et les réponses du coach, avec leurs cartes (programme,
-- débrief, panier, santé). Privée : chacun ne lit et n'écrit que la sienne,
-- avec ses propres droits ; la route y compte aussi les questions du jour
-- (le crédit du modèle est celui de Sabri).
create table if not exists public.agent_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role        text not null check (role in ('joueur', 'coach')),
  texte       text not null default '' check (length(texte) <= 8000),
  cartes      jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists agent_messages_user_date on public.agent_messages (user_id, created_at desc);
-- L'image que le coach a fait faire pour montrer une zone (le corps, le
-- terrain, une posture) : { chemin, legende }, le fichier dans le bucket
-- « agent » plus bas.
alter table public.agent_messages add column if not exists image jsonb;
-- Le schéma que l'app dessine elle-même (le corps ou le terrain, cf.
-- lib/sfl/schemas-coach.ts) : { type, zones | joueurs, fleches, zone, ballon, legende }.
alter table public.agent_messages add column if not exists schema jsonb;

alter table public.agent_messages enable row level security;

drop policy if exists "agent: je lis la mienne" on public.agent_messages;
create policy "agent: je lis la mienne"
  on public.agent_messages for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "agent: j'écris la mienne" on public.agent_messages;
create policy "agent: j'écris la mienne"
  on public.agent_messages for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Pas d'effacement : les questions du jour y sont comptées.
drop policy if exists "agent: j'efface la mienne" on public.agent_messages;

revoke all on public.agent_messages from anon, authenticated;
grant select, insert on public.agent_messages to authenticated;

-- ───────────────── Les crédits de l'IA payante, comptés ici ─────────────────
-- fal (le studio photo) et Anthropic (le coach) sont payés par Sabri. Les
-- routes comptaient les demandes du jour, puis les notaient : dix demandes
-- envoyées d'un coup passaient toutes avant d'être comptées (22/10/2026). La
-- base compte donc elle-même, sous un verrou par joueur, dans le geste qui
-- note la demande : au-delà du crédit, la ligne est refusée (indice
-- « credit-du-jour ») et la route répond « reviens demain », sans appeler.
-- Les crédits recopient LIMITE_JOUR (lib/sfl/photo-studio.ts : 3 photos par
-- jour, remises à minuit heure de Paris, comme jourDeParis()) et
-- LIMITE_AGENT_JOUR (lib/sfl/agent.ts : 30 questions sur 24 h) : les changer
-- ensemble. Les images du coach restent comptées par la route : une par
-- question au plus, donc bornées par le crédit de questions.
create or replace function public.credit_du_jour()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  credit int;
  faites int;
begin
  if tg_table_name = 'photo_studio' then
    credit := 3;
  elsif tg_table_name = 'agent_messages' and new.role = 'joueur' then
    credit := 30;
  else
    return new;
  end if;
  -- Jusqu'à la fin de la transaction : la demande suivante du même joueur
  -- attend celle-ci, puis la compte.
  perform pg_advisory_xact_lock(hashtextextended('credit:' || tg_table_name || ':' || new.user_id::text, 0));
  if tg_table_name = 'photo_studio' then
    -- Depuis minuit, heure de Paris (juste aussi les nuits de changement
    -- d'heure : minuit n'y tombe jamais dans le trou ni dans le doublon).
    select count(*) into faites from public.photo_studio
     where user_id = new.user_id
       and created_at >= (date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris');
  else
    select count(*) into faites from public.agent_messages
     where user_id = new.user_id and role = 'joueur' and created_at > now() - interval '24 hours';
  end if;
  if faites >= credit then
    raise exception 'Crédit du jour épuisé.' using errcode = 'P0001', hint = 'credit-du-jour';
  end if;
  return new;
end;
$$;

revoke execute on function public.credit_du_jour() from public, anon, authenticated;

drop trigger if exists photo_studio_credit on public.photo_studio;
create trigger photo_studio_credit before insert on public.photo_studio
  for each row execute function public.credit_du_jour();

drop trigger if exists agent_messages_credit on public.agent_messages;
create trigger agent_messages_credit before insert on public.agent_messages
  for each row execute function public.credit_du_jour();

-- Les images du coach : bucket PRIVÉ « agent », <uuid du joueur>/<horodatage>.jpg.
-- La route /api/agent les y pose avec les droits du joueur ; lui seul les voit.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('agent', 'agent', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when others then raise warning 'agent : bucket non créé (%)', sqlerrm;
end;
$$;

do $$
begin
  drop policy if exists "agent: je vois les miennes" on storage.objects;
  create policy "agent: je vois les miennes"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'agent' and (storage.foldername(name))[1] = (select auth.uid())::text);

  drop policy if exists "agent: le coach pose les miennes" on storage.objects;
  create policy "agent: le coach pose les miennes"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'agent' and (storage.foldername(name))[1] = (select auth.uid())::text);
exception
  when others then raise warning 'agent : règles Storage non posées (%)', sqlerrm;
end;
$$;

-- Les sujets de Bola Agent, pour l'admin (Activité & rétention) : de quoi
-- parlent les joueurs avec leur coach et ce qui leur sert le plus, SANS ce
-- qu'ils se disent. Une ligne par réponse du coach : le sujet (un mot, rangé
-- par le coach lui-même), le raccourci touché, les types de cartes posées,
-- une image ou non. Le joueur l'écrit (via /api/agent) ; seul l'admin lit.
create table if not exists public.agent_sujets (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  sujet       text not null check (sujet in ('debrief', 'progression', 'tactique', 'physique', 'nutrition', 'sante', 'recuperation', 'mental', 'ligue', 'autre')),
  raccourci   text check (raccourci in ('progression', 'debrief', 'courses', 'douleur', 'debrief-auto')),
  cartes      text[] not null default '{}',
  image       boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists agent_sujets_date on public.agent_sujets (created_at desc);
create index if not exists agent_sujets_user on public.agent_sujets (user_id);

-- Le schéma dessiné dans la réponse (corps, terrain), s'il y en a un.
alter table public.agent_sujets add column if not exists schema text check (schema in ('corps', 'terrain'));

alter table public.agent_sujets enable row level security;

drop policy if exists "agent_sujets: j'écris le mien" on public.agent_sujets;
create policy "agent_sujets: j'écris le mien"
  on public.agent_sujets for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "agent_sujets: lecture admin" on public.agent_sujets;
create policy "agent_sujets: lecture admin"
  on public.agent_sujets for select to authenticated
  using ((select public.is_league_admin()));

revoke all on public.agent_sujets from anon, authenticated;
grant select, insert on public.agent_sujets to authenticated;

-- ───────────────────────────── Mode Team ─────────────────────────────
-- Les équipes (Sabri, 22/10 ; règles officielles : BOLA docs/gameplay/04 et
-- 11). Une équipe de 5 à 7 joueurs, un capitaine, un écusson noir et blanc
-- (ses initiales). Le capitaine invite des joueurs de Bola, ou partage un
-- lien : un nouveau y crée vite son compte (/api/inscription) et arrive
-- invité. Entrer, c'est signer le Règlement Team. Une équipe à 5 défie
-- les autres ; la rencontre se joue ensuite (feuille et points : à venir).
--
-- Toute écriture passe par les fonctions ci-dessous (SECURITY DEFINER, les
-- contrôles DANS la fonction) : les tables ne se lisent que pour la ligue.
create table if not exists public.equipes (
  id          bigint generated always as identity primary key,
  nom         text not null check (char_length(btrim(nom)) between 3 and 20),
  initiales   text not null check (initiales ~ '^[A-Z0-9]{1,3}$'),
  fond        text not null default 'noir' check (fond in ('noir', 'blanc')),
  ville       text,
  capitaine   uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);
create unique index if not exists equipes_nom_unique on public.equipes (lower(btrim(nom)));

create table if not exists public.equipe_membres (
  equipe_id   bigint not null references public.equipes(id) on delete cascade,
  joueur      uuid   not null references public.profiles(id) on delete cascade,
  statut      text   not null default 'invite' check (statut in ('invite', 'membre')),
  role        text   not null default 'membre' check (role in ('capitaine', 'vice', 'membre')),
  invite_par  uuid   references public.profiles(id) on delete set null,
  signe_le    timestamptz,
  created_at  timestamptz not null default now(),
  primary key (equipe_id, joueur)
);
-- Une seule équipe à la fois.
create unique index if not exists equipe_membres_une_equipe on public.equipe_membres (joueur) where statut = 'membre';

-- Qui a quitté une équipe n'y revient jamais (règle du fondateur).
create table if not exists public.equipe_departs (
  equipe_id  bigint not null references public.equipes(id) on delete cascade,
  joueur     uuid   not null references public.profiles(id) on delete cascade,
  parti_le   timestamptz not null default now(),
  primary key (equipe_id, joueur)
);

-- Le lien d'invitation : un jeton par équipe, valable 7 jours.
create table if not exists public.equipe_liens (
  jeton      text primary key,
  equipe_id  bigint not null references public.equipes(id) on delete cascade,
  cree_par   uuid   references public.profiles(id) on delete set null,
  expire_le  timestamptz not null default now() + interval '7 days'
);

-- Les défis entre équipes (le call-out) : proposé, puis accepté ou refusé.
create table if not exists public.equipe_defis (
  id          bigint generated always as identity primary key,
  de          bigint not null references public.equipes(id) on delete cascade,
  a           bigint not null references public.equipes(id) on delete cascade,
  jour        date   not null,
  heure       text   not null check (heure ~ '^[0-2][0-9]:[0-5][0-9]$'),
  lieu        text   not null check (char_length(btrim(lieu)) between 1 and 120),
  statut      text   not null default 'propose' check (statut in ('propose', 'accepte', 'refuse', 'annule')),
  created_at  timestamptz not null default now(),
  check (de <> a)
);
create index if not exists equipe_defis_de on public.equipe_defis (de);
create index if not exists equipe_defis_a on public.equipe_defis (a);

alter table public.equipes enable row level security;
alter table public.equipe_membres enable row level security;
alter table public.equipe_departs enable row level security;
alter table public.equipe_liens enable row level security;
alter table public.equipe_defis enable row level security;

drop policy if exists "equipes: lecture" on public.equipes;
create policy "equipes: lecture" on public.equipes for select to authenticated
  using ((select public.est_membre()));
drop policy if exists "equipe_membres: lecture" on public.equipe_membres;
create policy "equipe_membres: lecture" on public.equipe_membres for select to authenticated
  using ((select public.est_membre()) or joueur = (select auth.uid()));
drop policy if exists "equipe_defis: lecture" on public.equipe_defis;
create policy "equipe_defis: lecture" on public.equipe_defis for select to authenticated
  using ((select public.est_membre()));

revoke all on public.equipes, public.equipe_membres, public.equipe_departs, public.equipe_liens, public.equipe_defis from anon, authenticated;
grant select on public.equipes, public.equipe_membres, public.equipe_defis to authenticated;

-- Règles complètes (Sabri, 22/10 : « bien comprendre tous les tenants et
-- aboutissants de Team ») — docs 04 §6, 05 §5 et 11 art. 3, 4, 17 :
--   · une invitation (et le lien) vaut 72 h, et jamais au-delà de 7 ;
--   · on signe une version du Règlement (v1), case cochée ;
--   · 14 jours de carence après un départ avant une autre équipe ;
--   · le capitaine exclut avec 48 h de préavis, ou dissout l'équipe ; une
--     équipe dissoute garde son historique et son nom 180 jours ;
--   · sous 5, l'équipe est incomplète : ses défis en attente tombent ;
--   · un défi : créneau entre +48 h et +21 jours, réponse sous 48 h et au
--     plus tard 36 h avant, sinon il expire ; annulé librement jusqu'à 48 h
--     avant, forfait ensuite ; 3 défis en attente et 3 matchs programmés au
--     plus ; un seul défi en cours entre deux équipes ; 3 refus d'affilée
--     de la même équipe bloquent 14 jours.
alter table public.equipes add column if not exists dissoute_le timestamptz;
alter table public.equipes alter column capitaine drop not null;
do $$
begin
  alter table public.equipes drop constraint if exists equipes_capitaine_fkey;
  alter table public.equipes add constraint equipes_capitaine_fkey
    foreign key (capitaine) references public.profiles(id) on delete set null;
end;
$$;
alter table public.equipe_membres add column if not exists reglement_version text;
-- Exclusion programmée par le capitaine (préavis de 48 h).
alter table public.equipe_membres add column if not exists depart_le timestamptz;
-- Le dernier avertissement envoyé sur le téléphone pour cette ligne
-- (/api/equipes/notifier) : l'invitation ou sa relance, puis la signature.
-- Il garde de prévenir deux fois.
alter table public.equipe_membres add column if not exists notifie_le timestamptz;
alter table public.equipe_liens alter column expire_le set default now() + interval '72 hours';
alter table public.equipe_liens add column if not exists utilisations int not null default 0;
alter table public.equipe_defis add column if not exists forfait_de bigint references public.equipes(id) on delete set null;
do $$
begin
  alter table public.equipe_defis drop constraint if exists equipe_defis_statut_check;
  alter table public.equipe_defis add constraint equipe_defis_statut_check
    check (statut in ('propose', 'accepte', 'refuse', 'annule', 'expire', 'forfait'));
end;
$$;
grant select on public.equipe_departs to authenticated;
drop policy if exists "equipe_departs: les miens" on public.equipe_departs;
create policy "equipe_departs: les miens" on public.equipe_departs for select to authenticated
  using (joueur = (select auth.uid()));

-- Qui joue en Bola Team (Sabri, 24/10/2026) : Bola est gratuit, Bola Team
-- est payant, sauf pour les joueurs SFL et ceux qu'un joueur SFL a fait
-- venir — son lien de parrainage, le lien de son équipe ou son invitation
-- (« payant si ce n'est pas un lien de parrainage de quelqu'un de la
-- SFL »). Aucun paiement n'est codé : en attendant, sans joueur SFL
-- derrière soi, Bola Team reste fermé (team_sur_invitation ; la mettre à
-- false ouvre Bola Team à tous sans rien perdre des offres déjà notées).
--
-- Un joueur SFL : son nom est dans l'effectif de la saison en cours (le
-- document saison, que l'admin tient). C'est la seule source : aucune
-- colonne à tenir à jour à côté.
create or replace function public.joueur_sfl(j uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
      from public.profiles p
      join public.saison s on s.id = 1
      cross join lateral jsonb_array_elements(coalesce(s.data -> 'roster', '[]'::jsonb)) r
     where p.id = j and r ->> 'name' = p.name
  );
$$;

-- Bola Team offert : à qui, par quel joueur SFL, comment et quand. Écrit par
-- /api/inscription (lien de parrainage ou d'équipe) et par equipe_signer
-- (invitation d'un joueur SFL) ; jamais retiré. La durée de l'offre se
-- fixera avec le paiement.
create table if not exists public.team_offerts (
  joueur  uuid primary key references public.profiles(id) on delete cascade,
  par     uuid references public.profiles(id) on delete set null,
  via     text not null check (via in ('lien', 'code', 'equipe', 'invitation')),
  le      timestamptz not null default now()
);
alter table public.team_offerts enable row level security;
drop policy if exists "team_offerts: le mien, ceux que j'ai offerts, l'admin" on public.team_offerts;
create policy "team_offerts: le mien, ceux que j'ai offerts, l'admin" on public.team_offerts for select to authenticated
  using (joueur = (select auth.uid()) or par = (select auth.uid()) or (select public.is_league_admin()));
revoke all on public.team_offerts from anon, authenticated;
grant select on public.team_offerts to authenticated;

create or replace function public.team_sur_invitation()
returns boolean
language sql
immutable
set search_path = ''
as $$
  select true;
$$;

create or replace function public.acces_team(j uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not public.team_sur_invitation()
      or public.joueur_sfl(j)
      or exists (select 1 from public.team_offerts t where t.joueur = j);
$$;

-- Ce que l'app lit pour le joueur connecté (hooks/use-acces-team.ts).
create or replace function public.mon_acces_team()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.acces_team((select auth.uid()));
$$;

revoke execute on function public.joueur_sfl(uuid), public.acces_team(uuid), public.team_sur_invitation(), public.mon_acces_team() from public, anon;
grant execute on function public.joueur_sfl(uuid), public.acces_team(uuid), public.team_sur_invitation(), public.mon_acces_team() to authenticated;

-- Mon rôle dans une équipe (null : pas membre).
create or replace function public.role_equipe(e bigint)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select m.role from public.equipe_membres m
   where m.equipe_id = e and m.joueur = (select auth.uid()) and m.statut = 'membre';
$$;

create or replace function public.equipe_effectif(e bigint)
returns int
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::int from public.equipe_membres m where m.equipe_id = e and m.statut = 'membre';
$$;

-- Le coup d'envoi d'un défi, en heure de Paris.
create or replace function public.equipe_defi_heure(jour date, heure text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (jour + heure::time) at time zone 'Europe/Paris';
$$;

-- Dissoudre : l'équipe reste (historique, nom réservé 180 jours), plus personne dedans.
create or replace function public.equipe_dissolution(e bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.equipes x set dissoute_le = now(), capitaine = null where x.id = e and x.dissoute_le is null;
  insert into public.equipe_departs (equipe_id, joueur)
  select e, m.joueur from public.equipe_membres m where m.equipe_id = e and m.statut = 'membre'
  on conflict do nothing;
  delete from public.equipe_membres m where m.equipe_id = e;
  delete from public.equipe_liens l where l.equipe_id = e;
  update public.equipe_defis f set statut = 'annule'
   where (f.de = e or f.a = e) and (f.statut = 'propose'
     or (f.statut = 'accepte' and public.equipe_defi_heure(f.jour, f.heure) > now()));
end;
$$;

-- Le ménage, au début de chaque geste : exclusions arrivées à terme,
-- invitations de plus de 72 h, défis sans réponse expirés, défis en
-- attente d'une équipe passée sous 5, brassard orphelin.
create or replace function public.equipe_menage(e bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  suivant uuid;
begin
  if e is null then
    return;
  end if;
  insert into public.equipe_departs (equipe_id, joueur)
  select m.equipe_id, m.joueur from public.equipe_membres m
   where m.equipe_id = e and m.statut = 'membre' and m.depart_le is not null and m.depart_le <= now()
  on conflict do nothing;
  delete from public.equipe_membres m
   where m.equipe_id = e and m.statut = 'membre' and m.depart_le is not null and m.depart_le <= now();
  delete from public.equipe_membres m
   where m.equipe_id = e and m.statut = 'invite' and m.created_at < now() - interval '72 hours';
  update public.equipe_defis f set statut = 'expire'
   where (f.de = e or f.a = e) and f.statut = 'propose'
     and (f.created_at < now() - interval '48 hours'
          or public.equipe_defi_heure(f.jour, f.heure) < now() + interval '36 hours');
  if public.equipe_effectif(e) = 0 then
    if exists (select 1 from public.equipes x where x.id = e and x.dissoute_le is null) then
      perform public.equipe_dissolution(e);
    end if;
    return;
  end if;
  if public.equipe_effectif(e) < 5 then
    update public.equipe_defis f set statut = 'annule'
     where (f.de = e or f.a = e) and f.statut = 'propose';
  end if;
  if not exists (select 1 from public.equipe_membres m where m.equipe_id = e and m.statut = 'membre' and m.role = 'capitaine') then
    select m.joueur into suivant from public.equipe_membres m
     where m.equipe_id = e and m.statut = 'membre'
     order by (m.role = 'vice') desc, m.signe_le asc limit 1;
    update public.equipe_membres m set role = 'capitaine' where m.equipe_id = e and m.joueur = suivant;
    update public.equipes x set capitaine = suivant where x.id = e;
  end if;
end;
$$;

-- 14 jours de carence après un départ (art. 17.4).
create or replace function public.equipe_en_carence(j uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.equipe_departs d where d.joueur = j and d.parti_le > now() - interval '14 days');
$$;

create or replace function public.equipe_creer(nom text, initiales text, fond text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  e bigint;
  ancienne record;
begin
  if moi is null or not public.est_membre() then
    raise exception 'Réservé aux joueurs.' using errcode = '42501';
  end if;
  -- Bola Team : les joueurs SFL et ceux qu'ils ont fait venir (Parrainage, plus bas).
  if not public.acces_team(moi) then
    raise exception 'Bola Team : il te faut le lien d''un joueur SFL.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.equipe_membres where joueur = moi and statut = 'membre') then
    raise exception 'Tu as déjà une équipe.' using errcode = 'P0001';
  end if;
  if public.equipe_en_carence(moi) then
    raise exception 'Après un départ, 14 jours avant une autre équipe.' using errcode = 'P0001';
  end if;
  select * into ancienne from public.equipes x where lower(btrim(x.nom)) = lower(btrim(equipe_creer.nom));
  if ancienne.id is not null then
    if ancienne.dissoute_le is null or ancienne.dissoute_le > now() - interval '180 days' then
      raise exception 'Ce nom est déjà pris.' using errcode = 'P0001';
    end if;
    -- Plus de 180 jours après la dissolution, le nom se libère.
    update public.equipes x set nom = 'dissoute-' || x.id where x.id = ancienne.id;
  end if;
  insert into public.equipes (nom, initiales, fond, ville, capitaine)
  values (btrim(equipe_creer.nom), upper(equipe_creer.initiales), equipe_creer.fond,
          (select p.ville from public.profiles p where p.id = moi), moi)
  returning id into e;
  insert into public.equipe_membres (equipe_id, joueur, statut, role, signe_le, reglement_version)
  values (e, moi, 'membre', 'capitaine', now(), 'v1');
  return e;
end;
$$;

-- Le capitaine (ou son vice) invite un joueur de Bola : 72 h pour signer.
-- C'est l'effectif qui borne (7 membres, doc 13 §1.4 I1), pas les
-- invitations : on peut inviter plus de joueurs qu'il ne reste de places,
-- les premiers qui signent entrent, et à 7 les autres invitations tombent
-- (equipe_signer). Jusqu'au 23/10, membres et invités comptaient ensemble :
-- trois invités muets suffisaient à bloquer l'équipe 72 h. Six invitations
-- en attente au plus, la borne haute de la création (team_invitations_creation).
-- Inviter quelqu'un de déjà invité ne fait rien. L'invité doit pouvoir
-- signer : un compte validé, sans équipe, jamais parti de celle-ci, et
-- sorti de sa carence avant que l'invitation tombe.
create or replace function public.equipe_inviter(e bigint, joueur uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.equipes x where x.id = e and x.dissoute_le is null for update;
  if not found then
    raise exception 'Cette équipe n''existe plus.' using errcode = 'P0001';
  end if;
  perform public.equipe_menage(e);
  if coalesce(public.role_equipe(e), 'membre') = 'membre' then
    raise exception 'Réservé au capitaine.' using errcode = '42501';
  end if;
  if public.equipe_effectif(e) >= 7 then
    raise exception 'L''équipe est au complet.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.equipe_membres m where m.equipe_id = e and m.joueur = equipe_inviter.joueur) then
    return;
  end if;
  if not exists (select 1 from public.profiles p where p.id = equipe_inviter.joueur and p.valide) then
    raise exception 'Son compte n''est pas encore validé.' using errcode = 'P0001';
  end if;
  -- Bola Team : l'invitation d'un joueur SFL l'offre (à la signature) ; celle
  -- d'un autre suppose que l'invité l'ait déjà.
  if not public.acces_team(equipe_inviter.joueur) and not public.joueur_sfl((select auth.uid())) then
    raise exception 'Ce joueur n''a pas Bola Team : il lui faut le lien d''un joueur SFL.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.equipe_departs d where d.equipe_id = e and d.joueur = equipe_inviter.joueur) then
    raise exception 'Ce joueur a quitté l''équipe : il n''y revient pas.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.equipe_membres m where m.joueur = equipe_inviter.joueur and m.statut = 'membre') then
    raise exception 'Ce joueur a déjà une équipe.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.equipe_departs d
              where d.joueur = equipe_inviter.joueur and d.parti_le > now() - interval '14 days' + interval '72 hours') then
    raise exception 'Ce joueur vient de quitter son équipe : 14 jours avant une autre.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.equipe_membres m where m.equipe_id = e and m.statut = 'invite') >= 6 then
    raise exception '6 invitations en attente au plus.' using errcode = 'P0001';
  end if;
  insert into public.equipe_membres (equipe_id, joueur, statut, invite_par)
  values (e, equipe_inviter.joueur, 'invite', (select auth.uid()))
  on conflict on constraint equipe_membres_pkey do nothing;
end;
$$;

-- Ceux que le capitaine ne peut pas inviter, et pourquoi : la liste des
-- joueurs le dit sur leur ligne, au lieu d'une erreur après coup.
-- 'parti' : a quitté cette équipe ; 'equipe' : en a déjà une ; 'carence' :
-- vient de quitter la sienne (14 jours, et l'invitation tomberait avant) ;
-- 'attente' : compte pas encore validé ; 'team' : n'a pas Bola Team, et
-- l'invitation ne vient pas d'un joueur SFL (qui la lui offrirait).
-- Réservé au capitaine et au vice.
create or replace function public.equipe_indisponibles(e bigint)
returns table (joueur uuid, raison text)
language sql
security definer
set search_path = ''
stable
as $$
  select t.id, t.raison from (
    select p.id,
      case
        when exists (select 1 from public.equipe_departs d where d.equipe_id = e and d.joueur = p.id) then 'parti'
        when exists (select 1 from public.equipe_membres m where m.joueur = p.id and m.statut = 'membre' and m.equipe_id <> e) then 'equipe'
        when exists (select 1 from public.equipe_departs d
                      where d.joueur = p.id and d.parti_le > now() - interval '14 days' + interval '72 hours') then 'carence'
        when not p.valide then 'attente'
        when not public.joueur_sfl((select auth.uid())) and not public.acces_team(p.id) then 'team'
      end as raison
    from public.profiles p
    where coalesce(public.role_equipe(e), 'membre') <> 'membre'
  ) t
  where t.raison is not null;
$$;

-- Retirer une invitation (le capitaine), ou la refuser (l'invité).
create or replace function public.equipe_retirer_invitation(e bigint, joueur uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if joueur <> (select auth.uid()) and coalesce(public.role_equipe(e), 'membre') = 'membre' then
    raise exception 'Réservé au capitaine.' using errcode = '42501';
  end if;
  delete from public.equipe_membres m
   where m.equipe_id = e and m.joueur = equipe_retirer_invitation.joueur and m.statut = 'invite';
end;
$$;

-- Accepter, c'est signer le Règlement Team (sa version).
create or replace function public.equipe_signer(e bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  offert_par uuid;
begin
  if moi is null or not public.est_membre() then
    raise exception 'Réservé aux joueurs.' using errcode = '42501';
  end if;
  perform 1 from public.equipes x where x.id = e and x.dissoute_le is null for update;
  if not found then
    raise exception 'Cette équipe n''existe plus.' using errcode = 'P0001';
  end if;
  perform public.equipe_menage(e);
  if not exists (select 1 from public.equipe_membres m where m.equipe_id = e and m.joueur = moi and m.statut = 'invite') then
    raise exception 'Invitation introuvable ou expirée.' using errcode = 'P0001';
  end if;
  -- Bola Team (Parrainage, plus bas) : à qui ne l'a pas encore, l'invitation
  -- d'un joueur SFL l'offre ; une autre ne suffit pas.
  if not public.acces_team(moi) then
    select m.invite_par into offert_par from public.equipe_membres m
     where m.equipe_id = e and m.joueur = moi and m.statut = 'invite'
       and m.invite_par is not null and public.joueur_sfl(m.invite_par);
    if offert_par is null then
      raise exception 'Bola Team : il te faut le lien d''un joueur SFL.' using errcode = 'P0001';
    end if;
  end if;
  if exists (select 1 from public.equipe_membres m where m.joueur = moi and m.statut = 'membre') then
    raise exception 'Tu as déjà une équipe.' using errcode = 'P0001';
  end if;
  if public.equipe_en_carence(moi) then
    raise exception 'Après un départ, 14 jours avant une autre équipe.' using errcode = 'P0001';
  end if;
  if public.equipe_effectif(e) >= 7 then
    raise exception 'L''équipe est au complet.' using errcode = 'P0001';
  end if;
  if offert_par is not null then
    insert into public.team_offerts (joueur, par, via) values (moi, offert_par, 'invitation')
    on conflict (joueur) do nothing;
  end if;
  update public.equipe_membres m set statut = 'membre', signe_le = now(), reglement_version = 'v1'
   where m.equipe_id = e and m.joueur = moi;
  -- À 7, les autres invitations tombent.
  if public.equipe_effectif(e) >= 7 then
    delete from public.equipe_membres m where m.equipe_id = e and m.statut = 'invite';
  end if;
  -- Mes autres invitations n'ont plus lieu d'être.
  delete from public.equipe_membres m where m.joueur = moi and m.statut = 'invite';
end;
$$;

-- Quitter : pour toujours (art. 17.4). Le brassard passe au vice, sinon au
-- plus ancien ; le dernier qui part dissout l'équipe.
create or replace function public.equipe_quitter(e bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
begin
  -- Le verrou : deux départs en même temps se suivent, le brassard ne se perd pas.
  perform 1 from public.equipes x where x.id = e for update;
  if public.role_equipe(e) is null then
    raise exception 'Tu n''es pas dans cette équipe.' using errcode = 'P0001';
  end if;
  insert into public.equipe_departs (equipe_id, joueur) values (e, moi)
  on conflict on constraint equipe_departs_pkey do update set parti_le = now();
  delete from public.equipe_membres m where m.equipe_id = e and m.joueur = moi;
  perform public.equipe_menage(e);
end;
$$;

-- Le capitaine exclut un membre, avec 48 h de préavis (art. 17.2) ; jamais
-- quand un match est programmé dans ces 48 h. Le refaire annule l'exclusion.
create or replace function public.equipe_exclure(e bigint, joueur uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ligne record;
begin
  perform 1 from public.equipes x where x.id = e for update;
  perform public.equipe_menage(e);
  if public.role_equipe(e) is distinct from 'capitaine' then
    raise exception 'Réservé au capitaine.' using errcode = '42501';
  end if;
  select * into ligne from public.equipe_membres m
   where m.equipe_id = e and m.joueur = equipe_exclure.joueur and m.statut = 'membre';
  if ligne is null or ligne.role = 'capitaine' then
    raise exception 'Ce joueur ne peut pas être exclu.' using errcode = 'P0001';
  end if;
  if ligne.depart_le is not null then
    update public.equipe_membres m set depart_le = null where m.equipe_id = e and m.joueur = equipe_exclure.joueur;
    return;
  end if;
  if exists (select 1 from public.equipe_defis f
              where (f.de = e or f.a = e) and f.statut = 'accepte'
                and public.equipe_defi_heure(f.jour, f.heure) between now() and now() + interval '48 hours') then
    raise exception 'Un match est programmé dans les 48 h : l''exclusion attendra.' using errcode = 'P0001';
  end if;
  update public.equipe_membres m set depart_le = now() + interval '48 hours', role = 'membre'
   where m.equipe_id = e and m.joueur = equipe_exclure.joueur;
end;
$$;

-- Le capitaine dissout l'équipe (art. 17.7).
create or replace function public.equipe_dissoudre(e bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.equipes x where x.id = e for update;
  if public.role_equipe(e) is distinct from 'capitaine' then
    raise exception 'Réservé au capitaine.' using errcode = '42501';
  end if;
  perform public.equipe_dissolution(e);
end;
$$;

-- Le capitaine nomme (ou retire) son vice-capitaine.
create or replace function public.equipe_vice(e bigint, joueur uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.role_equipe(e) is distinct from 'capitaine' then
    raise exception 'Réservé au capitaine.' using errcode = '42501';
  end if;
  update public.equipe_membres m set role = 'membre' where m.equipe_id = e and m.role = 'vice';
  if joueur is not null then
    update public.equipe_membres m set role = 'vice'
     where m.equipe_id = e and m.joueur = equipe_vice.joueur and m.statut = 'membre'
       and m.role = 'membre' and m.depart_le is null;
  end if;
end;
$$;

-- Le lien d'invitation de l'équipe : 72 h, comme une invitation, et
-- seulement tant qu'il reste des places.
create or replace function public.equipe_lien(e bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j text;
begin
  perform public.equipe_menage(e);
  if coalesce(public.role_equipe(e), 'membre') = 'membre' then
    raise exception 'Réservé au capitaine.' using errcode = '42501';
  end if;
  if public.equipe_effectif(e) >= 7 then
    raise exception 'L''équipe est au complet.' using errcode = 'P0001';
  end if;
  select l.jeton into j from public.equipe_liens l
   where l.equipe_id = e and l.expire_le > now() + interval '12 hours'
   order by l.expire_le desc limit 1;
  if j is null then
    j := left(replace(gen_random_uuid()::text, '-', ''), 16);
    insert into public.equipe_liens (jeton, equipe_id, cree_par, expire_le)
    values (j, e, (select auth.uid()), now() + interval '72 hours');
  end if;
  return j;
end;
$$;

-- Ce que montre la page du lien, même sans compte.
create or replace function public.equipe_lien_info(j text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'id', x.id, 'nom', x.nom, 'initiales', x.initiales, 'fond', x.fond, 'ville', x.ville,
    'membres', (select count(*) from public.equipe_membres m where m.equipe_id = x.id and m.statut = 'membre'),
    'capitaine', (select coalesce(p.nom_affiche, p.name) from public.profiles p where p.id = x.capitaine)
  )
  from public.equipe_liens l join public.equipes x on x.id = l.equipe_id
  where l.jeton = j and l.expire_le > now() and x.dissoute_le is null;
$$;

-- Un joueur connecté ouvre le lien : il devient invité (il signe ensuite).
create or replace function public.equipe_par_lien(j text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  l record;
begin
  if moi is null or not public.est_membre() then
    raise exception 'Connecte-toi.' using errcode = '42501';
  end if;
  select x.* into l from public.equipe_liens x join public.equipes q on q.id = x.equipe_id
   where x.jeton = j and x.expire_le > now() and q.dissoute_le is null;
  if l is null then
    raise exception 'Ce lien n''est plus valable.' using errcode = 'P0001';
  end if;
  perform 1 from public.equipes x where x.id = l.equipe_id for update;
  perform public.equipe_menage(l.equipe_id);
  if exists (select 1 from public.equipe_departs d where d.equipe_id = l.equipe_id and d.joueur = moi) then
    raise exception 'Tu as quitté cette équipe : tu n''y reviens pas.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.equipe_membres m where m.equipe_id = l.equipe_id and m.joueur = moi) then
    return l.equipe_id;
  end if;
  if exists (select 1 from public.equipe_membres m where m.joueur = moi and m.statut = 'membre') then
    raise exception 'Tu as déjà une équipe.' using errcode = 'P0001';
  end if;
  -- Bola Team : le lien d'un joueur SFL l'offre (à la signature), un autre non.
  if not public.acces_team(moi) and (l.cree_par is null or not public.joueur_sfl(l.cree_par)) then
    raise exception 'Bola Team : il te faut le lien d''un joueur SFL.' using errcode = 'P0001';
  end if;
  -- Comme pour une invitation : seuls les membres comptent (equipe_inviter).
  if public.equipe_effectif(l.equipe_id) >= 7 then
    raise exception 'L''équipe est au complet.' using errcode = 'P0001';
  end if;
  insert into public.equipe_membres (equipe_id, joueur, statut, invite_par)
  values (l.equipe_id, moi, 'invite', l.cree_par)
  on conflict on constraint equipe_membres_pkey do nothing;
  return l.equipe_id;
end;
$$;

-- Défier une équipe (le call-out, doc 05 §5).
create or replace function public.equipe_defier(de bigint, a bigint, jour date, heure text, lieu text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  d bigint;
  coup timestamptz;
begin
  perform 1 from public.equipes x where x.id in (equipe_defier.de, equipe_defier.a) and x.dissoute_le is null order by x.id for update;
  perform public.equipe_menage(equipe_defier.de);
  perform public.equipe_menage(equipe_defier.a);
  if coalesce(public.role_equipe(equipe_defier.de), 'membre') = 'membre' then
    raise exception 'Réservé au capitaine.' using errcode = '42501';
  end if;
  if exists (select 1 from public.equipes x where x.id in (equipe_defier.de, equipe_defier.a) and x.dissoute_le is not null) then
    raise exception 'Cette équipe n''existe plus.' using errcode = 'P0001';
  end if;
  if public.equipe_effectif(equipe_defier.de) < 5 or public.equipe_effectif(equipe_defier.a) < 5 then
    raise exception 'Il faut 5 joueurs de chaque côté.' using errcode = 'P0001';
  end if;
  if heure !~ '^[0-2][0-9]:[0-5][0-9]$' then
    raise exception 'Heure invalide.' using errcode = '22023';
  end if;
  coup := public.equipe_defi_heure(equipe_defier.jour, equipe_defier.heure);
  if coup < now() + interval '48 hours' or coup > now() + interval '21 days' then
    raise exception 'Le match se joue entre 48 h et 21 jours d''ici.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.equipe_defis f
              where ((f.de = equipe_defier.de and f.a = equipe_defier.a) or (f.de = equipe_defier.a and f.a = equipe_defier.de))
                and (f.statut = 'propose' or (f.statut = 'accepte' and public.equipe_defi_heure(f.jour, f.heure) > now()))) then
    raise exception 'Un défi est déjà en cours avec cette équipe.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.equipe_defis f where f.de = equipe_defier.de and f.statut = 'propose') >= 3 then
    raise exception '3 défis en attente au plus.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.equipe_defis f
       where (f.de = equipe_defier.de or f.a = equipe_defier.de) and f.statut = 'accepte'
         and public.equipe_defi_heure(f.jour, f.heure) > now()) >= 3 then
    raise exception '3 matchs programmés au plus.' using errcode = 'P0001';
  end if;
  -- 3 refus d'affilée de la même équipe : 14 jours sans la redéfier.
  if (select count(*) = 3 and bool_and(t.statut = 'refuse') and max(t.created_at) > now() - interval '14 days'
        from (select f.statut, f.created_at from public.equipe_defis f
               where f.de = equipe_defier.de and f.a = equipe_defier.a
               order by f.created_at desc limit 3) t) then
    raise exception 'Cette équipe a refusé 3 fois : attends 14 jours.' using errcode = 'P0001';
  end if;
  insert into public.equipe_defis (de, a, jour, heure, lieu)
  values (equipe_defier.de, equipe_defier.a, equipe_defier.jour, equipe_defier.heure, btrim(equipe_defier.lieu))
  returning id into d;
  return d;
end;
$$;

-- Répondre (l'équipe défiée), retirer son défi (le challenger), ou annuler
-- un match programmé : libre jusqu'à 48 h avant, forfait ensuite.
create or replace function public.equipe_defi_statut(d bigint, statut text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x record;
  coup timestamptz;
  moi_de boolean;
  moi_a boolean;
begin
  select * into x from public.equipe_defis f where f.id = d for update;
  if x is null then
    raise exception 'Défi introuvable.' using errcode = 'P0001';
  end if;
  perform public.equipe_menage(x.de);
  perform public.equipe_menage(x.a);
  select * into x from public.equipe_defis f where f.id = d;
  coup := public.equipe_defi_heure(x.jour, x.heure);
  moi_de := coalesce(public.role_equipe(x.de), 'membre') <> 'membre';
  moi_a := coalesce(public.role_equipe(x.a), 'membre') <> 'membre';
  if statut in ('accepte', 'refuse') then
    if not moi_a then
      raise exception 'Réservé au capitaine défié.' using errcode = '42501';
    end if;
    if x.statut <> 'propose' then
      raise exception 'Ce défi n''attend plus de réponse.' using errcode = 'P0001';
    end if;
    if statut = 'accepte' and (public.equipe_effectif(x.de) < 5 or public.equipe_effectif(x.a) < 5) then
      raise exception 'Il faut 5 joueurs de chaque côté.' using errcode = 'P0001';
    end if;
    update public.equipe_defis f set statut = equipe_defi_statut.statut where f.id = d;
  elsif statut = 'annule' then
    if x.statut = 'propose' then
      if not moi_de then
        raise exception 'Seul le challenger retire son défi.' using errcode = '42501';
      end if;
      update public.equipe_defis f set statut = 'annule' where f.id = d;
    elsif x.statut = 'accepte' and coup > now() then
      if not (moi_de or moi_a) then
        raise exception 'Réservé aux capitaines.' using errcode = '42501';
      end if;
      if coup > now() + interval '48 hours' then
        update public.equipe_defis f set statut = 'annule' where f.id = d;
      else
        update public.equipe_defis f set statut = 'forfait', forfait_de = case when moi_de then x.de else x.a end where f.id = d;
      end if;
    else
      raise exception 'Ce match ne s''annule plus.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Statut inconnu.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.equipe_effectif(bigint), public.equipe_dissolution(bigint), public.equipe_menage(bigint),
  public.equipe_en_carence(uuid) from public, anon, authenticated;
revoke execute on function public.role_equipe(bigint), public.equipe_creer(text, text, text), public.equipe_inviter(bigint, uuid),
  public.equipe_retirer_invitation(bigint, uuid), public.equipe_signer(bigint), public.equipe_quitter(bigint),
  public.equipe_vice(bigint, uuid), public.equipe_lien(bigint), public.equipe_par_lien(text),
  public.equipe_defier(bigint, bigint, date, text, text), public.equipe_defi_statut(bigint, text),
  public.equipe_exclure(bigint, uuid), public.equipe_dissoudre(bigint), public.equipe_indisponibles(bigint) from public, anon;
grant execute on function public.role_equipe(bigint), public.equipe_creer(text, text, text), public.equipe_inviter(bigint, uuid),
  public.equipe_retirer_invitation(bigint, uuid), public.equipe_signer(bigint), public.equipe_quitter(bigint),
  public.equipe_vice(bigint, uuid), public.equipe_lien(bigint), public.equipe_par_lien(text),
  public.equipe_defier(bigint, bigint, date, text, text), public.equipe_defi_statut(bigint, text),
  public.equipe_exclure(bigint, uuid), public.equipe_dissoudre(bigint), public.equipe_indisponibles(bigint) to authenticated;
revoke execute on function public.equipe_lien_info(text) from public;
grant execute on function public.equipe_lien_info(text) to anon, authenticated;

do $$
begin
  alter publication supabase_realtime add table public.equipe_membres;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
do $$
begin
  alter publication supabase_realtime add table public.equipe_defis;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- La réponse à une invitation d'équipe : ce qu'attendent « Ilyes t'invite
-- · FC BENSOU » et sa relance (/api/equipes/notifier, motifs
-- 'equipe-invitation' et 'equipe-relance', rattachées à l'équipe ;
-- push_effet plus haut). Signer le Règlement en fait un oui (sa ligne passe
-- à 'membre') ; la refuser lui-même, ou signer ailleurs (equipe_signer
-- efface alors ses autres invitations, à son nom), un non. Ce que le
-- capitaine retire, ou une invitation tombée après 72 h, n'est pas une
-- réponse. Le suivi n'empêche jamais de signer.
create or replace function public.push_effet_equipe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if tg_op = 'UPDATE' then
      if old.statut = 'invite' and new.statut = 'membre' then
        perform public.push_effet(new.joueur, array['equipe-invitation', 'equipe-relance'], 'equipe:' || new.equipe_id, 'accepte', interval '72 hours');
      end if;
    elsif old.statut = 'invite' and old.joueur = (select auth.uid()) then
      perform public.push_effet(old.joueur, array['equipe-invitation', 'equipe-relance'], 'equipe:' || old.equipe_id, 'refuse', interval '72 hours');
    end if;
  exception when others then
    raise warning 'push_effet_equipe : %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.push_effet_equipe() from public, anon, authenticated;

drop trigger if exists equipe_membres_push_effet on public.equipe_membres;
create trigger equipe_membres_push_effet
  after update of statut or delete on public.equipe_membres
  for each row execute function public.push_effet_equipe();

-- ─────────────────── Confidentialité : les accords ───────────────────
-- L'accord de chaque joueur à la politique de confidentialité (22/10/2026) :
-- la case de l'ouverture et celle de l'inscription
-- (components/sfl/confidentialite). Une ligne par accord : la version
-- acceptée (sa date, VERSION_POLITIQUE dans lib/sfl/confidentialite.ts),
-- l'usage de sa carte hors de l'app, l'accord d'un parent avant 15 ans, et
-- où il a coché. La date est celle de la base : le joueur n'écrit que ces
-- quatre colonnes, jamais user_id ni created_at. Rien ne se réécrit ni ne
-- s'efface (ni update ni delete) : la dernière ligne fait foi, les autres
-- gardent l'historique, pour pouvoir le prouver. Le joueur lit les siennes,
-- l'admin toutes (Activité). /api/photo-studio et /api/agent la lisent avant
-- d'envoyer un visage ou une question à un prestataire.
create table if not exists public.consentements (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  version     text not null check (version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  hors_app    boolean not null default false,
  parent      boolean not null default false,
  ou          text not null default 'ouverture' check (ou in ('ouverture', 'inscription', 'reglages')),
  created_at  timestamptz not null default now()
);
create index if not exists consentements_user_date on public.consentements (user_id, created_at desc);

alter table public.consentements enable row level security;

drop policy if exists "consentements: je lis les miens" on public.consentements;
create policy "consentements: je lis les miens"
  on public.consentements for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "consentements: l'admin lit tout" on public.consentements;
create policy "consentements: l'admin lit tout"
  on public.consentements for select to authenticated
  using ((select public.is_league_admin()));

drop policy if exists "consentements: je donne le mien" on public.consentements;
create policy "consentements: je donne le mien"
  on public.consentements for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.consentements from anon, authenticated;
grant select on public.consentements to authenticated;
grant insert (version, hors_app, parent, ou) on public.consentements to authenticated;

-- Le journal d'usage ne garde que 13 mois, comme la politique le dit : le
-- plus ancien part chaque lundi (/api/convocation/cron) et à chaque
-- migration du schéma.
delete from public.activity where created_at < now() - interval '13 months';

-- ──────────────── Emails de contact : à part de profiles ────────────────
-- profiles est lu par toute la ligue (noms, pseudos, villes) : l'email de
-- contact y était lisible par n'importe quel membre qui interrogeait l'API,
-- même si l'app ne le montrait qu'à l'admin. Il vit désormais ici, lu par le
-- joueur lui-même et par l'admin, et par personne d'autre (22/10/2026).
--
-- Rien ne change pour ceux qui l'écrivent : la création de compte, les
-- routes serveur et l'app écrivent toujours profiles.contact_email, et le
-- trigger email_a_part le range ici en laissant la colonne vide. La lecture
-- passe par lib/sfl/contacts.ts. Un email par joueur (le dernier donné) ; la
-- règle « un email = un joueur » reste celle des routes d'inscription.
-- La clé vise auth.users : le trigger passe AVANT l'insertion du profil.
create table if not exists public.contacts (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  email    text not null check (email = lower(btrim(email)) and email <> ''),
  maj_le   timestamptz not null default now()
);
create index if not exists contacts_email on public.contacts (email);

alter table public.contacts enable row level security;

drop policy if exists "contacts: je lis le mien" on public.contacts;
create policy "contacts: je lis le mien"
  on public.contacts for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "contacts: l'admin lit tout" on public.contacts;
create policy "contacts: l'admin lit tout"
  on public.contacts for select to authenticated
  using ((select public.is_league_admin()));

-- Lecture seule pour l'app : l'écriture passe par profiles (trigger).
revoke all on public.contacts from anon, authenticated;
grant select on public.contacts to authenticated;

create or replace function public.email_a_part()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.contact_email is not null then
    if btrim(new.contact_email) <> '' then
      insert into public.contacts (user_id, email)
      values (new.id, lower(btrim(new.contact_email)))
      on conflict (user_id) do update set email = excluded.email, maj_le = now();
    end if;
    new.contact_email := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.email_a_part() from public, anon, authenticated;

drop trigger if exists profiles_email_a_part on public.profiles;
create trigger profiles_email_a_part
  before insert or update of contact_email on public.profiles
  for each row execute function public.email_a_part();

-- Les emails déjà donnés passent dans contacts, et la colonne se vide (une
-- seule fois : ensuite elle reste vide).
insert into public.contacts (user_id, email)
select p.id, lower(btrim(p.contact_email))
from public.profiles p
where p.contact_email is not null
  and btrim(p.contact_email) <> ''
  and exists (select 1 from auth.users u where u.id = p.id)
on conflict (user_id) do update set email = excluded.email, maj_le = now();
update public.profiles set contact_email = null where contact_email is not null;

-- ─────────────── Mots de passe à changer (sécurité, 22/10/2026) ───────────────
-- Les mots de passe d'origine, ceux que l'admin distribuait, ont été lisibles
-- par tout le monde : le dépôt du code était public et les contenait. Chaque
-- compte créé par l'admin doit donc en choisir un nouveau, une fois. Une
-- ligne ici = un compte qui doit le faire : l'app le retient sur l'écran
-- « Nouveau mot de passe » tant que la ligne existe.
--
-- La ligne disparaît d'elle-même quand le mot de passe change vraiment
-- (trigger sur auth.users) : personne ne peut l'effacer autrement. Les routes
-- admin en posent une à chaque mot de passe provisoire (compte créé, mot de
-- passe réinitialisé) : le provisoire ne sert qu'à entrer une fois.
create table if not exists public.mot_de_passe_a_changer (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  motif    text not null default 'origine' check (motif in ('origine', 'provisoire')),
  depuis   timestamptz not null default now()
);

alter table public.mot_de_passe_a_changer enable row level security;

drop policy if exists "mot_de_passe_a_changer: je lis le mien" on public.mot_de_passe_a_changer;
create policy "mot_de_passe_a_changer: je lis le mien"
  on public.mot_de_passe_a_changer for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "mot_de_passe_a_changer: l'admin lit tout" on public.mot_de_passe_a_changer;
create policy "mot_de_passe_a_changer: l'admin lit tout"
  on public.mot_de_passe_a_changer for select to authenticated
  using ((select public.is_league_admin()));

-- Lecture seule pour l'app : la ligne naît par les routes admin (clé
-- secrète) et meurt par le trigger.
revoke all on public.mot_de_passe_a_changer from anon, authenticated;
grant select on public.mot_de_passe_a_changer to authenticated;

create or replace function public.mot_de_passe_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.mot_de_passe_a_changer where user_id = new.id;
  return new;
exception when others then
  -- Jamais au prix d'un changement de mot de passe refusé.
  return new;
end;
$$;

revoke execute on function public.mot_de_passe_change() from public, anon, authenticated;

drop trigger if exists on_auth_password_changed on auth.users;
create trigger on_auth_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.mot_de_passe_change();

-- Les étapes qui ne se jouent qu'une fois, quelle que soit la migration qui
-- les porte : le schéma est rejoué à chaque changement, elles non.
create table if not exists public.etapes_uniques (
  etape    text primary key,
  faite_le timestamptz not null default now()
);
alter table public.etapes_uniques enable row level security;
revoke all on public.etapes_uniques from anon, authenticated;

-- Une fois : tous les comptes nés d'un mot de passe d'origine, c'est-à-dire
-- tous sauf les inscriptions libres (le joueur y choisit le sien) et les
-- comptes Google ou Apple (sans mot de passe).
do $$
begin
  if not exists (select 1 from public.etapes_uniques where etape = 'mots-de-passe-origine-2026-10') then
    insert into public.mot_de_passe_a_changer (user_id, motif)
    select u.id, 'origine'
    from auth.users u
    where coalesce(u.raw_user_meta_data ->> 'inscription', '') <> 'libre'
      and coalesce(u.raw_app_meta_data ->> 'provider', 'email') = 'email'
      and coalesce(u.encrypted_password, '') <> ''
    on conflict (user_id) do nothing;
    insert into public.etapes_uniques (etape) values ('mots-de-passe-origine-2026-10');
  end if;
end;
$$;

-- Le registre des migrations (créé par lib/server/migrate.ts) restait
-- ouvert à l'API publique, sans règle : n'importe qui pouvait y écrire, et
-- faire sauter une migration en y inscrivant son empreinte d'avance. Fermé :
-- seule la migration elle-même, propriétaire de la base, y touche.
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    alter table public.schema_migrations enable row level security;
    revoke all on public.schema_migrations from anon, authenticated;
  end if;
end;
$$;

-- ─────────────────────────── Discussion de match ───────────────────────────
-- Sabri, 22/10 : quand des joueurs rejoignent un match, ils se parlent entre
-- eux (« Le match, il est où ? », « vous connaissez quelqu'un de dispo ? »),
-- et chacun est prévenu sur son téléphone, d'un message comme d'une arrivée.
-- Sur la Map, une bulle de messages au coin du sticker du match dit ce qu'on
-- n'a pas lu.
--
-- La discussion d'un match ouvert par un joueur vit dans la table des
-- messages, canal 'match' : elle hérite des réponses, des réactions, des
-- vocaux, des photos et du temps réel du Vestiaire. La lisent et y écrivent
-- ceux du match, et eux seuls : l'organisateur, les inscrits et les invités
-- (pas encore décidés, ils voient ce qui se dit). Ni le reste de la ligue,
-- ni l'admin : comme un message privé. Qui quitte le match perd la
-- discussion ; le match annulé l'emporte avec lui.
alter table public.messages add column if not exists match_id bigint references public.matchs(id) on delete cascade;
create index if not exists messages_match_idx
  on public.messages (match_id, created_at desc) where canal = 'match';

-- La discussion d'une équipe du mode Team (plus bas, « Discussion d'équipe »)
-- vit à côté : canal 'equipe', avec son équipe. Ses contrôles sont posés ICI,
-- avec ceux du match : ils sont reposés à chaque migration, et doivent déjà
-- accepter les lignes d'équipe en base quand ils le sont.
alter table public.messages add column if not exists equipe_id bigint references public.equipes(id) on delete cascade;

alter table public.messages drop constraint if exists messages_canal_check;
alter table public.messages add constraint messages_canal_check check (canal in ('sfl', 'dm', 'match', 'equipe'));
alter table public.messages drop constraint if exists messages_destinataire_coherent;
alter table public.messages add constraint messages_destinataire_coherent check (
  (canal = 'sfl' and destinataire is null and match_id is null and equipe_id is null)
  or (canal = 'dm' and destinataire is not null and destinataire <> auteur and match_id is null and equipe_id is null)
  or (canal = 'match' and destinataire is null and match_id is not null and equipe_id is null)
  or (canal = 'equipe' and destinataire is null and equipe_id is not null and match_id is null)
);

-- Qui est du match : l'organisateur, et chaque joueur de sa liste (inscrit
-- ou invité). Un compte validé seulement, comme au Vestiaire.
create or replace function public.dans_le_match(m bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.est_membre()
     and (
       exists (select 1 from public.matchs x where x.id = m and x.organisateur = (select auth.uid()))
       or exists (select 1 from public.match_joueurs j where j.match_id = m and j.player_id = (select auth.uid()))
     );
$$;

revoke execute on function public.dans_le_match(bigint) from public, anon;
grant execute on function public.dans_le_match(bigint) to authenticated;

-- Lire : une règle de plus, à côté de celle du salon et des privés.
drop policy if exists "messages: la discussion du match" on public.messages;
create policy "messages: la discussion du match"
  on public.messages for select to authenticated
  using (canal = 'match' and public.dans_le_match(match_id));

-- Écrire : la règle commune (« j'écris pour moi ») laisse passer tout canal
-- autre que le salon ; celle-ci, restrictive, ferme le match à qui n'en est
-- pas. Les réactions suivent d'elles-mêmes (on ne réagit qu'à ce qu'on lit).
drop policy if exists "messages: le match à ceux du match" on public.messages;
create policy "messages: le match à ceux du match"
  on public.messages as restrictive for insert to authenticated
  with check (canal <> 'match' or public.dans_le_match(match_id));

-- Où en est chaque joueur avec la discussion d'un match : jusqu'où il a lu
-- (la bulle et les pastilles de la Map), ce qu'il en veut sur son téléphone
-- (comme au Vestiaire : 'tout', 'cite', 'rien'), s'il l'a sous les yeux
-- (devant_le, redit toutes les 20 s par l'app : pas de notification à qui la
-- lit), et quand le serveur l'a prévenu pour la dernière fois (notifie_le,
-- au serveur seul).
create table if not exists public.match_suivi (
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  match_id    bigint not null references public.matchs(id) on delete cascade,
  lu_jusqua   timestamptz not null default now(),
  notifs      text not null default 'tout' check (notifs in ('tout', 'cite', 'rien')),
  devant_le   timestamptz,
  notifie_le  timestamptz,
  primary key (user_id, match_id)
);

create index if not exists match_suivi_match_idx on public.match_suivi (match_id);

alter table public.match_suivi enable row level security;

drop policy if exists "suivi du match: le mien" on public.match_suivi;
create policy "suivi du match: le mien"
  on public.match_suivi for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.dans_le_match(match_id));

-- notifie_le n'appartient qu'au serveur. Révoquer le droit de table AVANT de
-- donner les colonnes, sinon le droit de table les annule.
revoke all on public.match_suivi from anon, authenticated;
grant select on public.match_suivi to authenticated;
grant insert (user_id, match_id, lu_jusqua, notifs, devant_le) on public.match_suivi to authenticated;
grant update (user_id, match_id, lu_jusqua, notifs, devant_le) on public.match_suivi to authenticated;

-- ─────────────────────────── Rappel de la veille ───────────────────────────
-- Sabri, 22/10 : la veille d'un match ouvert par un joueur, ceux qui jouent
-- (l'organisateur, les inscrits) reçoivent un rappel sur leur téléphone
-- (/api/matchs/rappel, que le cron de Vercel appelle chaque soir). Une ligne
-- par match et par jour : le cron peut passer deux fois, personne ne reçoit
-- deux rappels ; un match déplacé à un autre jour aura le sien. Au serveur
-- seul.
create table if not exists public.match_rappels (
  match_id   bigint not null references public.matchs(id) on delete cascade,
  jour       date not null,
  envoye_le  timestamptz not null default now(),
  primary key (match_id, jour)
);

alter table public.match_rappels enable row level security;
revoke all on public.match_rappels from anon, authenticated;

-- Les annonces de la ligue déjà envoyées par notification : une fois par
-- annonce et par joueur (« divisions-s1-j3 », /api/divisions/annoncer). Fermée
-- aux téléphones : seule la route serveur, avec la clé secrète, la lit et
-- l'écrit.
create table if not exists public.annonces_envois (
  annonce   text not null,
  joueur    text not null,
  envoye_le timestamptz not null default now(),
  primary key (annonce, joueur)
);

alter table public.annonces_envois enable row level security;
revoke all on public.annonces_envois from anon, authenticated;

-- ─────────────────────────── Discussion d'équipe ───────────────────────────
-- Sabri, 22/10 : « dans la discussion, […] discuter soit avec son match,
-- soit son équipe ». L'écran de discussion a deux onglets, Match et Équipe ;
-- l'équipe, c'est celle du mode Team dont je suis membre (une seule à la
-- fois). Un fil par équipe, dans la table des messages, canal 'equipe'
-- (colonne et contrôles posés avec ceux du match, plus haut) : les mêmes
-- bulles, réponses, réactions, vocaux et photos.
--
-- La lisent et y écrivent ses membres, ceux qui ont signé le Règlement, et
-- eux seuls : ni les invités qui n'ont pas encore signé, ni le reste de la
-- ligue, ni l'admin. Qui quitte l'équipe perd la discussion ; l'équipe
-- dissoute n'en a plus ; supprimée, elle l'emporte.
create index if not exists messages_equipe_idx
  on public.messages (equipe_id, created_at desc) where canal = 'equipe';

create or replace function public.dans_l_equipe(e bigint)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.est_membre()
     and exists (
       select 1
       from public.equipe_membres m
       join public.equipes q on q.id = m.equipe_id
       where m.equipe_id = e
         and m.joueur = (select auth.uid())
         and m.statut = 'membre'
         and q.dissoute_le is null
     );
$$;

revoke execute on function public.dans_l_equipe(bigint) from public, anon;
grant execute on function public.dans_l_equipe(bigint) to authenticated;

drop policy if exists "messages: la discussion de l'équipe" on public.messages;
create policy "messages: la discussion de l'équipe"
  on public.messages for select to authenticated
  using (canal = 'equipe' and public.dans_l_equipe(equipe_id));

drop policy if exists "messages: l'équipe à ses membres" on public.messages;
create policy "messages: l'équipe à ses membres"
  on public.messages as restrictive for insert to authenticated
  with check (canal <> 'equipe' or public.dans_l_equipe(equipe_id));

-- Où en est chaque membre avec la discussion de son équipe : comme pour un
-- match (match_suivi, plus haut) — jusqu'où il a lu, ce qu'il en veut sur
-- son téléphone, s'il l'a sous les yeux, et quand le serveur l'a prévenu
-- pour la dernière fois (notifie_le, au serveur seul).
create table if not exists public.equipe_suivi (
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  equipe_id   bigint not null references public.equipes(id) on delete cascade,
  lu_jusqua   timestamptz not null default now(),
  notifs      text not null default 'tout' check (notifs in ('tout', 'cite', 'rien')),
  devant_le   timestamptz,
  notifie_le  timestamptz,
  primary key (user_id, equipe_id)
);

create index if not exists equipe_suivi_equipe_idx on public.equipe_suivi (equipe_id);

alter table public.equipe_suivi enable row level security;

drop policy if exists "suivi de l'équipe: le mien" on public.equipe_suivi;
create policy "suivi de l'équipe: le mien"
  on public.equipe_suivi for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.dans_l_equipe(equipe_id));

-- notifie_le n'appartient qu'au serveur : le droit de table d'abord retiré.
revoke all on public.equipe_suivi from anon, authenticated;
grant select on public.equipe_suivi to authenticated;
grant insert (user_id, equipe_id, lu_jusqua, notifs, devant_le) on public.equipe_suivi to authenticated;
grant update (user_id, equipe_id, lu_jusqua, notifs, devant_le) on public.equipe_suivi to authenticated;

-- ─────────────────── Suivre des joueurs, les féliciter ───────────────────
-- Demandé par Sabri le 22/10/2026 : voir combien de joueurs en suivent un
-- autre en touchant sa carte, le suivre d'un geste, retrouver ceux qu'on suit
-- en premier quand on ajoute des joueurs à un match, et féliciter un joueur
-- pour un exploit des Actus, ce qui le prévient sur son téléphone et lui
-- donne de l'XP (lib/sfl/suivis.ts, lib/sfl/felicitations.ts).
--
-- Les suivis : une ligne par joueur suivi. Toute la ligue les lit (le nombre
-- d'abonnés est public, comme qui suit qui) ; chacun ne suit et n'arrête de
-- suivre que pour lui, un compte validé seulement. Arrêter de suivre efface
-- la ligne. Le joueur n'écrit que la colonne suivi : le suiveur, c'est lui
-- (auth.uid()), la date, celle de la base.
create table if not exists public.suivis (
  suiveur     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  suivi       uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (suiveur, suivi),
  constraint suivis_pas_soi check (suiveur <> suivi)
);
create index if not exists suivis_suivi on public.suivis (suivi);

alter table public.suivis enable row level security;

drop policy if exists "suivis: la ligue lit" on public.suivis;
create policy "suivis: la ligue lit"
  on public.suivis for select to authenticated
  using ((select public.est_membre()) or suiveur = (select auth.uid()));

drop policy if exists "suivis: je suis pour moi" on public.suivis;
create policy "suivis: je suis pour moi"
  on public.suivis for insert to authenticated
  with check (
    suiveur = (select auth.uid())
    and (select public.est_membre())
    and exists (select 1 from public.profiles p where p.id = suivi and p.valide)
  );

drop policy if exists "suivis: j'arrête de suivre" on public.suivis;
create policy "suivis: j'arrête de suivre"
  on public.suivis for delete to authenticated
  using (suiveur = (select auth.uid()));

revoke all on public.suivis from anon, authenticated;
grant select, delete on public.suivis to authenticated;
grant insert (suivi) on public.suivis to authenticated;

-- Suivre en retour : ce qu'attend la notification « Kader te suit · Suivre
-- en retour » (/api/suivis, motif 'suivi', rattachée au suiveur ;
-- push_effet plus haut). Le suivi n'empêche jamais de suivre.
create or replace function public.push_effet_suivi()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.push_effet(new.suiveur, array['suivi'], 'joueur:' || new.suivi, 'suivi', interval '7 days');
  exception when others then
    raise warning 'push_effet_suivi : %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.push_effet_suivi() from public, anon, authenticated;

drop trigger if exists suivis_push_effet on public.suivis;
create trigger suivis_push_effet
  after insert on public.suivis
  for each row execute function public.push_effet_suivi();

-- Les félicitations : un joueur en félicite un autre pour un exploit des
-- Actus (l'homme du dimanche, le chiffre, le duo, ils montent, un badge
-- décroché, l'équipe type). L'exploit est la clé que l'app tire de la saison
-- (« 0-2-mvp-Kader » : saison, journée, famille, nom de saison du joueur,
-- lib/sfl/exploits.ts). Une félicitation par joueur et par exploit, jamais à
-- soi-même. Toute la ligue les lit (combien, et qui) ; chacun retire les
-- siennes.
--
-- Elles donnent de l'XP (lib/sfl/missions.ts, calculé à la lecture : une
-- félicitation retirée retire son XP). C'est pourquoi l'app ne les écrit
-- pas elle-même : la route /api/felicitations vérifie sur la saison que
-- l'exploit existe et qu'il est bien à ce joueur, puis l'enregistre avec la
-- clé secrète. Aucun exploit inventé ne passe.
create table if not exists public.felicitations (
  id          bigint generated always as identity primary key,
  de          uuid not null references public.profiles(id) on delete cascade,
  a           uuid not null references public.profiles(id) on delete cascade,
  exploit     text not null check (char_length(exploit) <= 120),
  saison      integer not null check (saison between 0 and 999),
  j           integer not null check (j between 1 and 999),
  famille     text not null check (famille in ('mvp', 'chiffre', 'duo', 'montent', 'badge', 'equipe')),
  created_at  timestamptz not null default now(),
  constraint felicitations_pas_soi check (de <> a),
  constraint felicitations_une_fois unique (de, a, exploit),
  constraint felicitations_cle check (exploit like saison::text || '-' || j::text || '-' || famille || '-_%')
);
create index if not exists felicitations_a on public.felicitations (a, exploit);

alter table public.felicitations enable row level security;

drop policy if exists "felicitations: la ligue lit" on public.felicitations;
create policy "felicitations: la ligue lit"
  on public.felicitations for select to authenticated
  using ((select public.est_membre()) or de = (select auth.uid()) or a = (select auth.uid()));

drop policy if exists "felicitations: je retire la mienne" on public.felicitations;
create policy "felicitations: je retire la mienne"
  on public.felicitations for delete to authenticated
  using (de = (select auth.uid()));

revoke all on public.felicitations from anon, authenticated;
grant select, delete on public.felicitations to authenticated;

-- Les notifications déjà parties, par clé : « X te suit » ne part qu'une fois
-- par paire, et « X t'a félicité » qu'une fois par exploit et par joueur,
-- même si l'on arrête de suivre (ou retire sa félicitation) puis qu'on
-- recommence. Seules les routes serveur (clé secrète) la lisent et l'écrivent.
create table if not exists public.push_envoyes (
  cle  text primary key check (char_length(cle) <= 300),
  le   timestamptz not null default now()
);

alter table public.push_envoyes enable row level security;
revoke all on public.push_envoyes from anon, authenticated;

-- ───────────────────────────── Parrainage ─────────────────────────────
-- Passer de ~100 à 500 joueurs (Sabri, 24/10/2026) : chaque joueur a son
-- lien, /p/<code>. Un nouveau qui crée son compte par ce lien entre aussitôt
-- dans Bola — son parrain s'en porte garant, comme le capitaine avec le lien
-- d'une équipe — mais dans Bola, pas dans la SFL : il n'est pas ajouté à la
-- saison. Tout le monde parraine, filleuls compris (la boule de neige) ; le
-- lien d'un joueur SFL offre en plus Bola Team (team_offerts, mode Team).
--
--   · parrainage_codes : le code de chaque joueur, tiré de son pseudo la
--     première fois qu'il ouvre « Inviter », puis figé : un pseudo changé ne
--     casse aucun lien déjà partagé. L'admin peut couper un code ;
--   · parrainages : qui a fait venir qui. Une ligne par compte parrainé,
--     posée par /api/inscription à la création du compte, jamais modifiée :
--     un compte qui existe déjà ne se fait pas parrainer ;
--   · parrainage_visites : le haut du tunnel (lien ouvert, inscription
--     commencée), sans rien de personnel : le code, le jour, et un
--     identifiant tiré au hasard sur le téléphone pour ne pas compter deux
--     fois la même personne.
-- Seuls l'admin (tout) et les intéressés (leurs lignes) les lisent ;
-- personne ne les écrit directement.
create table if not exists public.parrainage_codes (
  code        text primary key check (code ~ '^[a-z0-9][a-z0-9._]{2,19}$'),
  joueur      uuid not null unique references public.profiles(id) on delete cascade,
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);
-- La carte que montre son lien (poste et stats), posée par son app chaque
-- fois qu'il ouvre « Inviter » (parrainage_ma_carte) : la page publique ne
-- lit pas la saison. Montrée seulement s'il a accepté que sa carte sorte de
-- l'app (parrain_info).
alter table public.parrainage_codes add column if not exists carte jsonb;
-- Combien de fois il a partagé son lien (ou l'a copié), et la dernière fois :
-- le premier étage du tunnel de l'admin.
alter table public.parrainage_codes add column if not exists partages int not null default 0;
alter table public.parrainage_codes add column if not exists partage_le timestamptz;

create table if not exists public.parrainages (
  filleul     uuid primary key references public.profiles(id) on delete cascade,
  parrain     uuid references public.profiles(id) on delete set null,
  code        text,
  -- 'lien' : son lien ouvert ; 'code' : son code tapé à l'inscription ;
  -- 'equipe' : le lien d'une équipe (le parrain est celui qui l'a créé).
  canal       text not null check (canal in ('lien', 'code', 'equipe')),
  equipe_id   bigint references public.equipes(id) on delete set null,
  -- Le parrain jouait en SFL ce jour-là : Bola Team offert (team_offerts).
  parrain_sfl boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint parrainages_pas_soi check (parrain is null or parrain <> filleul)
);
create index if not exists parrainages_parrain on public.parrainages (parrain);

create table if not exists public.parrainage_visites (
  id          bigint generated always as identity primary key,
  code        text not null references public.parrainage_codes(code) on delete cascade,
  visiteur    text not null check (visiteur ~ '^[0-9a-f-]{8,40}$'),
  etape       text not null check (etape in ('ouvert', 'commence')),
  jour        date not null default ((now() at time zone 'Europe/Paris')::date),
  created_at  timestamptz not null default now(),
  constraint parrainage_visites_une_fois unique (code, visiteur, etape)
);
create index if not exists parrainage_visites_jour on public.parrainage_visites (jour);
-- Les liens ouverts ne se gardent que 13 mois, comme le journal d'usage
-- (politique de confidentialité) : le plus ancien part chaque lundi
-- (/api/convocation/cron) et à chaque migration du schéma.
delete from public.parrainage_visites where created_at < now() - interval '13 months';

alter table public.parrainage_codes enable row level security;
alter table public.parrainages enable row level security;
alter table public.parrainage_visites enable row level security;

drop policy if exists "parrainage_codes: le mien, l'admin" on public.parrainage_codes;
create policy "parrainage_codes: le mien, l'admin" on public.parrainage_codes for select to authenticated
  using (joueur = (select auth.uid()) or (select public.is_league_admin()));
drop policy if exists "parrainages: mes filleuls, mon parrain, l'admin" on public.parrainages;
create policy "parrainages: mes filleuls, mon parrain, l'admin" on public.parrainages for select to authenticated
  using (parrain = (select auth.uid()) or filleul = (select auth.uid()) or (select public.is_league_admin()));
drop policy if exists "parrainage_visites: l'admin" on public.parrainage_visites;
create policy "parrainage_visites: l'admin" on public.parrainage_visites for select to authenticated
  using ((select public.is_league_admin()));

revoke all on public.parrainage_codes, public.parrainages, public.parrainage_visites from anon, authenticated;
grant select on public.parrainage_codes, public.parrainages, public.parrainage_visites to authenticated;

-- Mon code : créé à la première demande, d'après mon pseudo (sans le @) ;
-- déjà pris par un autre (un ancien pseudo devenu code), on y ajoute un
-- chiffre.
create or replace function public.mon_code_parrain()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
  base text;
  c text;
  i int := 1;
begin
  if moi is null or not public.est_membre() then
    raise exception 'Réservé aux joueurs.' using errcode = '42501';
  end if;
  select x.code into c from public.parrainage_codes x where x.joueur = moi;
  if c is not null then
    return c;
  end if;
  select left(regexp_replace(lower(p.username), '[^a-z0-9._]', '', 'g'), 20) into base
    from public.profiles p where p.id = moi;
  base := regexp_replace(coalesce(base, ''), '^[._]+', '');
  if base !~ '^[a-z0-9][a-z0-9._]{2,19}$' then
    base := 'bola' || left(replace(moi::text, '-', ''), 6);
  end if;
  c := base;
  loop
    begin
      insert into public.parrainage_codes (code, joueur) values (c, moi);
      return c;
    exception when unique_violation then
      -- Deux appels en même temps : le code du joueur vient d'être posé.
      select x.code into c from public.parrainage_codes x where x.joueur = moi;
      if c is not null then
        return c;
      end if;
      i := i + 1;
      if i > 99 then
        raise exception 'Code introuvable.' using errcode = 'P0001';
      end if;
      c := left(base, 20 - length(i::text)) || i::text;
    end;
  end loop;
end;
$$;

-- Ce que montre la page d'un lien, même sans compte : le nom du parrain (sa
-- clé de ligue et le nom que l'app affiche), son pseudo, s'il joue en SFL
-- (Bola Team offert) et, seulement si sa carte peut sortir de l'app (son
-- dernier accord à la politique : hors_app), sa carte et la version de sa
-- photo (le fichier du bucket « photos », nommé d'après son nom en
-- hexadécimal ; null s'il n'en a pas).
create or replace function public.parrain_info(c text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'code', x.code,
    'nom', p.name,
    'affiche', coalesce(p.nom_affiche, p.name),
    'pseudo', p.username,
    'sfl', public.joueur_sfl(p.id),
    'carte', case when h.hors_app then x.carte end,
    'photo', case when h.hors_app then (
      select (extract(epoch from coalesce(o.updated_at, o.created_at)) * 1000)::bigint
        from storage.objects o
       where o.bucket_id = 'photos' and o.name = encode(convert_to(p.name, 'UTF8'), 'hex') || '.jpg'
       limit 1
    ) end
  )
  from public.parrainage_codes x
  join public.profiles p on p.id = x.joueur
  left join lateral (
    select k.hors_app from public.consentements k
     where k.user_id = p.id order by k.created_at desc limit 1
  ) h on true
  where x.code = lower(btrim(c)) and x.actif and p.valide;
$$;

-- Ma carte, telle que mon app la montre, pour la page de mon lien. Seuls le
-- poste et les six stats sont gardés ; la note se recalcule (moyenne arrondie
-- au-dessus, comme ovr dans l'app).
create or replace function public.parrainage_ma_carte(poste text, stats jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text;
  v int;
  propres jsonb := '{}'::jsonb;
  somme int := 0;
begin
  if (select auth.uid()) is null or not public.est_membre() then
    raise exception 'Réservé aux joueurs.' using errcode = '42501';
  end if;
  if poste is null or char_length(poste) > 4 or jsonb_typeof(stats) is distinct from 'object' then
    raise exception 'Carte illisible.' using errcode = '22023';
  end if;
  foreach k in array array['VIT', 'TIR', 'PAS', 'DRI', 'DEF', 'PHY'] loop
    if jsonb_typeof(stats -> k) is distinct from 'number' then
      raise exception 'Carte illisible.' using errcode = '22023';
    end if;
    v := round((stats ->> k)::numeric);
    if v < 1 or v > 99 then
      raise exception 'Carte illisible.' using errcode = '22023';
    end if;
    propres := propres || jsonb_build_object(k, v);
    somme := somme + v;
  end loop;
  update public.parrainage_codes x
     set carte = jsonb_build_object('poste', poste, 'stats', propres, 'note', ceil(somme / 6.0)::int)
   where x.joueur = (select auth.uid());
end;
$$;

-- Le haut du tunnel : un lien ouvert, une inscription commencée. Une fois par
-- téléphone et par étape ; un code inconnu ou coupé ne laisse rien.
create or replace function public.parrainage_vu(c text, visiteur text, etape text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.parrainage_visites (code, visiteur, etape)
  select x.code, parrainage_vu.visiteur, parrainage_vu.etape
    from public.parrainage_codes x
   where x.code = lower(btrim(c)) and x.actif
  on conflict on constraint parrainage_visites_une_fois do nothing;
exception when check_violation then
  return;
end;
$$;

-- J'ai partagé (ou copié) mon lien.
create or replace function public.parrainage_partage()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.parrainage_codes x
     set partages = least(x.partages + 1, 100000), partage_le = now()
   where x.joueur = (select auth.uid());
$$;

-- L'admin coupe un code (un lien qui fuit), ou le rallume.
create or replace function public.parrainage_code_actif(c text, actif boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_league_admin() then
    raise exception 'Réservé à l''admin.' using errcode = '42501';
  end if;
  update public.parrainage_codes x set actif = parrainage_code_actif.actif where x.code = lower(btrim(c));
end;
$$;

-- Le bas du tunnel, pour l'admin (Activité → Parrainage) : chaque filleul a-t-il
-- joué un match (inscrit à un match passé) et rejoint une équipe Bola Team ?
-- Les matchs privés ne se lisent pas autrement. Vide pour tout autre compte.
create or replace function public.parrainage_suivi()
returns table (filleul uuid, a_joue boolean, en_equipe boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select p.filleul,
         exists (
           select 1
             from public.match_joueurs mj
             join public.matchs m on m.id = mj.match_id
            where mj.player_id = p.filleul and mj.statut = 'inscrit'
              and m.jour <= (now() at time zone 'Europe/Paris')::date
         ),
         exists (select 1 from public.equipe_membres em where em.joueur = p.filleul and em.statut = 'membre')
    from public.parrainages p
   where (select public.is_league_admin());
$$;

revoke execute on function public.mon_code_parrain(), public.parrain_info(text), public.parrainage_vu(text, text, text),
  public.parrainage_code_actif(text, boolean), public.parrainage_ma_carte(text, jsonb), public.parrainage_partage(),
  public.parrainage_suivi()
  from public, anon;
grant execute on function public.mon_code_parrain(), public.parrainage_code_actif(text, boolean),
  public.parrainage_ma_carte(text, jsonb), public.parrainage_partage(), public.parrainage_suivi() to authenticated;
grant execute on function public.parrain_info(text), public.parrainage_vu(text, text, text) to anon, authenticated;

-- Le Vestiaire est le salon de la SFL : un joueur Bola (venu par un parrain,
-- hors de la saison) ne le lit pas et n'y écrit pas. Ses messages privés et
-- les discussions de ses matchs et de son équipe restent les siens. Deux
-- règles restrictives, qui s'ajoutent à celles du salon (plus haut) : elles
-- vivent ici parce que joueur_sfl n'existe qu'à partir du mode Team.
drop policy if exists "messages: le Vestiaire, à la SFL" on public.messages;
create policy "messages: le Vestiaire, à la SFL" on public.messages as restrictive for select to authenticated
  using (canal <> 'sfl' or (select public.joueur_sfl((select auth.uid()))) or (select public.is_league_admin()));
drop policy if exists "messages: écrire au Vestiaire, la SFL" on public.messages;
create policy "messages: écrire au Vestiaire, la SFL" on public.messages as restrictive for insert to authenticated
  with check (canal <> 'sfl' or (select public.joueur_sfl((select auth.uid()))) or (select public.is_league_admin()));

-- ─────────────── Mises en ligne : les repères de la croissance ───────────────
-- Sabri, 24/10 : « quand on voit la croissance, voir rapidement les actions
-- qui ont été faites à ce moment-là de la part de l'application ». Chaque
-- build de production réussi pose ici sa version (scripts/postbuild.ts) :
-- le commit, son titre (celui de sa PR) et l'heure. Admin → Activité les
-- montre sous les courbes, avec l'historique d'avant cette table
-- (lib/sfl/mises-en-ligne.ts). Rien de personnel ; l'admin seul lit, le
-- build seul écrit (connexion directe à la base, hors API).
create table if not exists public.mises_en_ligne (
  sha    text primary key check (sha ~ '^[0-9a-f]{7,40}$'),
  titre  text not null check (char_length(titre) between 1 and 300),
  pr     integer,
  le     timestamptz not null default now()
);

alter table public.mises_en_ligne enable row level security;

drop policy if exists "mises_en_ligne: l'admin lit" on public.mises_en_ligne;
create policy "mises_en_ligne: l'admin lit"
  on public.mises_en_ligne for select to authenticated
  using ((select public.is_league_admin()));

revoke all on public.mises_en_ligne from anon, authenticated;
grant select on public.mises_en_ligne to authenticated;
