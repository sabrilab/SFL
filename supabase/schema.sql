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
-- le grant de colonnes (plus bas) ne permet de modifier que name et username.
drop policy if exists "profiles: mise à jour de soi" on public.profiles;
create policy "profiles: mise à jour de soi"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Email de contact du joueur — collecté après la première connexion, ou
-- automatiquement quand il lie Google/Apple (colonne ajoutée plus haut, avec
-- le pseudo). C'est LA table des emails.

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
    'compo'       -- une composition 5v5 déposée dans l'Arène
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
grant update (name) on public.profiles to authenticated;
grant update (contact_email) on public.profiles to authenticated;
grant update (badge) on public.profiles to authenticated;
grant update (ville, ville_lat, ville_lng, ville_cachee) on public.profiles to authenticated;
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
alter table public.messages drop constraint if exists messages_piece_forme;
alter table public.messages add constraint messages_piece_forme check (
  piece is null
  or (
    jsonb_typeof(piece) = 'object'
    and piece->>'type' in ('carte', 'feuille', 'classement', 'vocal', 'photo', 'video', 'ligue')
    and pg_column_size(piece) <= 4000
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
--   · tout le monde liste le bucket (c'est ainsi que l'app sait qui a une photo) ;
--   · chacun ne pose, remplace ou retire QUE la sienne ;
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
    to anon, authenticated
    using (bucket_id = 'photos');

  drop policy if exists "photos: je pose la mienne" on storage.objects;
  create policy "photos: je pose la mienne"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'photos'
      and (
        lower(public.photo_joueur(name)) = (
          select lower(p.name) from public.profiles p where p.id = (select auth.uid())
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
        lower(public.photo_joueur(name)) = (
          select lower(p.name) from public.profiles p where p.id = (select auth.uid())
        )
        or (select public.is_league_admin())
      )
    )
    with check (
      bucket_id = 'photos'
      and (
        lower(public.photo_joueur(name)) = (
          select lower(p.name) from public.profiles p where p.id = (select auth.uid())
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
        lower(public.photo_joueur(name)) = (
          select lower(p.name) from public.profiles p where p.id = (select auth.uid())
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
-- profiles.contact_email). Le gabarit sert aux maillots et, plus tard, au
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
         x.visibilite = 'public'
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
    visibilite = 'public'
    or organisateur = (select auth.uid())
    or (select public.voit_match(id))
  );

drop policy if exists "matchs: j'ouvre le mien" on public.matchs;
create policy "matchs: j'ouvre le mien"
  on public.matchs for insert
  to authenticated
  with check (organisateur = (select auth.uid()));

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

-- L'organisateur invite (et inscrit) qui il veut ; un joueur ne prend
-- lui-même qu'une place d'un match public. La capacité est gardée par le
-- trigger plus bas, pas par la règle.
drop policy if exists "match_joueurs: on entre" on public.match_joueurs;
create policy "match_joueurs: on entre"
  on public.match_joueurs for insert
  to authenticated
  with check (
    (select public.organise_match(match_id))
    or (
      player_id = (select auth.uid())
      and statut = 'inscrit'
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

-- On se retire soi-même ; l'organisateur retire n'importe qui de son match.
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

-- ─────────────────────────── Disponibilités ──────────────────────────
-- Chaque joueur dit quand il peut jouer : un jour, un moment. La ligue s'en
-- sert pour composer des matchs et inviter (matchmaking), et chacun voit,
-- en ouvrant l'app, qui est libre en même temps que lui.
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
  using (true);

drop policy if exists "disponibilites: je dis les miennes" on public.disponibilites;
create policy "disponibilites: je dis les miennes"
  on public.disponibilites for insert
  to authenticated
  with check (player_id = (select auth.uid()));

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
