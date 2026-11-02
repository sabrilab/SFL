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
  check (habillage is null or habillage ~ '^(auto|-|nuit|chrome|animee)/(auto|-|argentique|gravure|marbre)(/(-|(lisere-argent|lisere-platine|sceau|puce-noire|nom-grave)(\+(lisere-argent|lisere-platine|sceau|puce-noire|nom-grave))*))?$');
-- Les skins du Passe Bola (24/10, src/lib/sfl/passe.ts et skins-passe.ts) :
-- la contrainte suit la liste des finitions ; « Tes couleurs » porte son pays
-- (couleurs:dz, couleurs:gb-eng) ; puis, depuis le 24/10, les signes choisis
-- (/sceau+nom-grave, ou /-). Les skins offerts aussi (onyx, verre, pepite,
-- palestine : finitions-offertes.ts), et ceux des recrues (recruteur,
-- filigrane, fondateur : skins-recrues.ts, 27/10). Refaite à chaque migration :
-- idempotente.
alter table public.profiles drop constraint if exists profiles_habillage_check;
alter table public.profiles add constraint profiles_habillage_check
  check (habillage is null or habillage ~ '^(auto|-|nuit|chrome|animee|onyx|verre|pepite|palestine|recruteur|filigrane|fondateur|givre|carbone|marbre|neon|aurore|ki|meteorite|couleurs(:[a-z]{2}(-[a-z]{3})?)?)/(auto|-|argentique|gravure|marbre)(/(-|(lisere-argent|lisere-platine|sceau|puce-noire|nom-grave)(\+(lisere-argent|lisere-platine|sceau|puce-noire|nom-grave))*))?$');

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

-- Les nouveautés annoncées (lib/sfl/nouveautes.ts, Sabri, 26/10) : à
-- l'ouverture, un diaporama par nouveauté que Sabri a choisi d'annoncer, une
-- fois par joueur. nouveautes_vues : les ids déjà vus. Posé par le joueur
-- seul (grant plus bas, RLS « mise à jour de soi »).
alter table public.profiles add column if not exists nouveautes_vues text[] not null default '{}';

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
    'notifs',     -- l'invitation aux notifications montrée, et la réponse
    'activation', -- « Ton premier match » d'un joueur Bola : vu, position, terrain, invitation
    'map'         -- un geste dans la Map (meta.geste : stade, y-aller, je-viens, ouvrir, zone)
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

-- ─────────── Journée en brouillon, membres qui ne jouent pas, feuille saine (30/10/2026) ───────────
-- Additif et idempotent (rejoué à chaque déploiement qui change ce fichier).
--   · profiles.joue : « ne joue pas » devient une donnée du compte, plus un
--     nom écrit en dur (Sabri apparaissait dans les compositions, 28/10).
--     Sabri passe à false une seule fois, à la création de la colonne : un
--     réglage fait ensuite par l'admin (poser_joue) n'est jamais écrasé.
--   · est_brouillon / sans_brouillons : la même règle que saisie/brouillon.ts.
--     Une journée sans le champ « brouillon » est publiée (toutes celles
--     d'avant) : aucune donnée à migrer.
--   · feuille_saine : refuse, sur les journées que la publication modifie,
--     un joueur de plus en double, un membre de plus qui ne joue pas, une
--     ligne vitrine, une deuxième journée pour une même date. Appelée par
--     publier_saison, MÊME avec « Écraser » : quel que soit l'écran,
--     l'appareil ou la version de l'app, les matchs 5 et 6 de la J3 et ses
--     doublons (28/10) ne passent plus. Un défaut ancien ne bloque jamais.
--   · saison_publique / saison_signal (plus bas) : la lecture des joueurs
--     sans les brouillons, livrée sans rien fermer. La fermeture de la lecture
--     brute aux joueurs viendra à part, quand toutes les versions de l'app en
--     service liront saison_publique (supprimer « saison: lecture ligue »).
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'joue'
  ) then
    alter table public.profiles add column joue boolean not null default true;
    update public.profiles set joue = false where name = 'Sabri';
  end if;
end;
$$;
-- Aucun « grant update (joue) » : un joueur ne se change pas lui-même.

create or replace function public.poser_joue(p_profil uuid, p_joue boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_league_admin() then
    raise exception 'Réservé à l''admin.' using errcode = '42501';
  end if;
  update public.profiles set joue = coalesce(p_joue, true) where id = p_profil;
end;
$$;
revoke execute on function public.poser_joue(uuid, boolean) from public, anon;
grant execute on function public.poser_joue(uuid, boolean) to authenticated;

-- La règle unique : absent, null ou false = publiée ; tout le reste = brouillon.
create or replace function public.est_brouillon(p_meta jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_meta -> 'brouillon', 'null'::jsonb) not in ('null'::jsonb, 'false'::jsonb);
$$;
grant execute on function public.est_brouillon(jsonb) to authenticated;

-- Le document sans les journées en brouillon, ni leurs lignes, ni leurs buts
-- minutés (même résultat que sansBrouillons) ; l'ordre est gardé.
create or replace function public.sans_brouillons(p_data jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with b as (
    select coalesce(array_agg(m ->> 'j'), '{}'::text[]) as js
      from jsonb_array_elements(
             case when jsonb_typeof(p_data -> 'journees') = 'array' then p_data -> 'journees' else '[]'::jsonb end
           ) m
     where public.est_brouillon(m)
  )
  select case
    when cardinality(b.js) = 0 then p_data
    else p_data
      || jsonb_build_object('journees', (
           select coalesce(jsonb_agg(x order by i), '[]'::jsonb)
             from jsonb_array_elements(p_data -> 'journees') with ordinality t(x, i)
            where not ((x ->> 'j') = any (b.js))))
      || case when jsonb_typeof(p_data -> 'entries') = 'array' then jsonb_build_object('entries', (
           select coalesce(jsonb_agg(x order by i), '[]'::jsonb)
             from jsonb_array_elements(p_data -> 'entries') with ordinality t(x, i)
            where not ((x ->> 'j') = any (b.js)))) else '{}'::jsonb end
      || case when jsonb_typeof(p_data -> 'events') = 'array' then jsonb_build_object('events', (
           select coalesce(jsonb_agg(x order by i), '[]'::jsonb)
             from jsonb_array_elements(p_data -> 'events') with ordinality t(x, i)
            where not ((x ->> 'j') = any (b.js)))) else '{}'::jsonb end
  end
  from b;
$$;
grant execute on function public.sans_brouillons(jsonb) to authenticated;

-- Une feuille saine. Ne regarde que les journées dont les lignes changent, et
-- n'y refuse que ce qui EMPIRE : un joueur une fois de plus en double, un
-- membre qui ne joue pas une fois de plus — la J3 se répare ligne à ligne.
-- Renvoie les défauts (vide = saine), au format « I1 J4 Ilyes » :
--   I0 une ligne du compte vitrine · I1 un joueur deux fois (sa ligne
--   Xtratime à part) · I2 un membre qui ne joue pas · I6 deux journées pour
--   une même date (seulement si ça empire) · I10 une vue figée (02/11/2026 :
--   une vue figée ne se publie pas).
create or replace function public.feuille_saine(p_nouveau jsonb, p_ancien jsonb)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  with
  n as (
    select e from jsonb_array_elements(
      case when jsonb_typeof(p_nouveau -> 'entries') = 'array' then p_nouveau -> 'entries' else '[]'::jsonb end) e
  ),
  a as (
    select e from jsonb_array_elements(
      case when jsonb_typeof(p_ancien -> 'entries') = 'array' then p_ancien -> 'entries' else '[]'::jsonb end) e
  ),
  ln as (select e ->> 'j' as j, jsonb_agg(e order by e::text) as l from n group by 1),
  la as (select e ->> 'j' as j, jsonb_agg(e order by e::text) as l from a group by 1),
  touchees as (select ln.j from ln left join la using (j) where la.l is distinct from ln.l),
  -- Les lignes « jouées » (hors Xtratime) par journée et par nom, avant et après.
  cn as (
    select e ->> 'j' as j, lower(btrim(e ->> 'player')) as nom, min(e ->> 'player') as affiche, count(*) as c
      from n where lower(coalesce(e ->> 'extraTime', 'false')) not in ('true', '1') group by 1, 2
  ),
  ca as (
    select e ->> 'j' as j, lower(btrim(e ->> 'player')) as nom, count(*) as c
      from a where lower(coalesce(e ->> 'extraTime', 'false')) not in ('true', '1') group by 1, 2
  ),
  tn as (select e ->> 'j' as j, lower(btrim(e ->> 'player')) as nom, min(e ->> 'player') as affiche, count(*) as c from n group by 1, 2),
  ta as (select e ->> 'j' as j, lower(btrim(e ->> 'player')) as nom, count(*) as c from a group by 1, 2),
  i0 as (  -- une ligne de la vitrine n'est jamais écrite
    select 'I0 J' || (e ->> 'j') || ' ' || (e ->> 'player') as d
      from n
     where (e ->> 'j') in (select j from touchees)
       and lower(coalesce(e ->> 'vitrine', 'false')) in ('true', '1')
  ),
  i1 as (  -- un joueur au plus une fois par journée
    select 'I1 J' || cn.j || ' ' || cn.affiche as d
      from cn left join ca using (j, nom)
     where cn.j in (select j from touchees)
       and cn.c > 1 and cn.c > coalesce(ca.c, 0)
  ),
  i2 as (  -- un membre qui ne joue pas n'a pas de ligne
    select 'I2 J' || tn.j || ' ' || tn.affiche as d
      from tn
      left join ta using (j, nom)
      join public.profiles p on lower(p.name) = tn.nom and not p.joue
     where tn.j in (select j from touchees)
       and tn.c > coalesce(ta.c, 0)
  ),
  dn as (
    select m ->> 'date' as date, count(*) as c
      from jsonb_array_elements(
        case when jsonb_typeof(p_nouveau -> 'journees') = 'array' then p_nouveau -> 'journees' else '[]'::jsonb end) m
     group by 1
  ),
  da as (
    select m ->> 'date' as date, count(*) as c
      from jsonb_array_elements(
        case when jsonb_typeof(p_ancien -> 'journees') = 'array' then p_ancien -> 'journees' else '[]'::jsonb end) m
     group by 1
  ),
  i6 as (  -- une seule journée par date (n'empire jamais)
    select 'I6 ' || dn.date as d from dn left join da using (date)
     where dn.c > 1 and dn.c > coalesce(da.c, 0)
  ),
  i10 as (  -- une vue figée (revelation.ts) ne se publie pas : ses résultats en attente sont effacés
    select 'I10 vue figée' as d where p_nouveau ? 'figee'
  )
  select coalesce(array_agg(d order by d), '{}'::text[])
    from (select d from i0 union all select d from i1 union all select d from i2 union all select d from i6 union all select d from i10) x;
$$;
revoke execute on function public.feuille_saine(jsonb, jsonb) from public, anon;
grant execute on function public.feuille_saine(jsonb, jsonb) to authenticated;

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
  ancien   jsonb;
  nouvelle bigint;
  defauts  text[];
  tenues   text[];
begin
  if not public.is_league_admin() then
    raise exception 'Réservé à l''admin.' using errcode = '42501';
  end if;
  select s.version, s.data into courante, ancien from public.saison s where s.id = 1 for update;
  if found and not p_forcer and courante is distinct from p_base then
    return jsonb_build_object('ok', false, 'version', courante);
  end if;
  -- Une feuille malsaine n'est jamais écrite, même en écrasant (30/10/2026).
  defauts := public.feuille_saine(p_data, coalesce(ancien, '{}'::jsonb));
  if cardinality(defauts) > 0 then
    raise exception 'Feuille refusée : %', array_to_string(defauts, ' · ')
      using errcode = 'P0001', hint = 'feuille-saine', detail = array_to_string(defauts, '|');
  end if;
  -- La feuille de match tenue par un joueur (01/11/2026, feuilles_direct plus
  -- bas) : l'admin ne change pas les chiffres d'un match dont la feuille est
  -- tenue, ni, en écrasant une base plus neuve, ceux d'une feuille scellée
  -- depuis sa dernière synchro. Même avec « Écraser ». La fonction n'existe
  -- qu'une fois ce fichier joué jusqu'au bout : avant, rien à garder.
  if to_regprocedure('public.feuilles_ecrasees(jsonb,jsonb,bigint,boolean)') is not null then
    tenues := public.feuilles_ecrasees(p_data, coalesce(ancien, '{}'::jsonb), p_base, p_forcer);
    if cardinality(tenues) > 0 then
      raise exception 'Feuille de match tenue : %', array_to_string(tenues, ' · ')
        using errcode = 'P0001', hint = 'feuille-tenue', detail = array_to_string(tenues, '|');
    end if;
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

-- La lecture des joueurs (30/10/2026) : le document sans les journées en
-- brouillon, et un signal temps réel qui ne porte que la version (le joueur
-- relit alors saison_publique). L'admin garde la lecture du document entier.
create or replace function public.saison_publique()
returns table (data jsonb, version bigint, seed int, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select public.sans_brouillons(s.data), s.version, s.seed, s.updated_at
    from public.saison s
   where s.id = 1
     and (select public.est_membre());
$$;
revoke execute on function public.saison_publique() from public, anon;
grant execute on function public.saison_publique() to authenticated;

create table if not exists public.saison_signal (
  id      int primary key default 1 check (id = 1),
  version bigint not null,
  le      timestamptz not null default now()
);
alter table public.saison_signal enable row level security;
drop policy if exists "saison_signal: lecture ligue" on public.saison_signal;
create policy "saison_signal: lecture ligue"
  on public.saison_signal for select
  to authenticated
  using ((select public.est_membre()));
revoke insert, update, delete, truncate on public.saison_signal from anon, authenticated;
grant select on public.saison_signal to authenticated;

create or replace function public.saison_vers_signal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.saison_signal (id, version, le)
  values (1, new.version, now())
  on conflict (id) do update set version = excluded.version, le = excluded.le;
  return new;
end;
$$;
revoke execute on function public.saison_vers_signal() from public, anon, authenticated;

drop trigger if exists saison_vers_signal on public.saison;
create trigger saison_vers_signal after insert or update on public.saison
  for each row execute function public.saison_vers_signal();

insert into public.saison_signal (id, version)
select 1, s.version from public.saison s where s.id = 1
on conflict (id) do nothing;

do $$
begin
  alter publication supabase_realtime add table public.saison_signal;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- ─────────────────── Historique et corbeille de la saison ───────────────────
-- 27/10/2026 : Afid a été retiré de l'effectif d'un geste, et la saison
-- n'avait aucune mémoire — chaque publication remplace le document entier.
-- Désormais, chaque publication garde l'état qu'elle remplace :
--   · saison_historique : le document précédent tel quel (les 200 derniers),
--     pour retrouver n'importe quel état en SQL ;
--   · saison_corbeille : ce que la publication a fait disparaître — un
--     joueur de l'effectif, une journée (avec ses lignes), une ligne d'une
--     journée qui reste. L'admin les voit et les remet d'un geste (Admin →
--     Historique → Corbeille), 60 jours durant.
-- Le passage d'une saison à la suivante (numero qui change) vide l'effectif
-- et les lignes par nature : il n'entre pas dans la corbeille.
create table if not exists public.saison_historique (
  id           bigint generated always as identity primary key,
  version      bigint not null,
  data         jsonb not null,
  seed         int not null default 0,
  remplacee_le timestamptz not null default now(),
  par          uuid
);

alter table public.saison_historique enable row level security;
revoke all on public.saison_historique from anon, authenticated;
grant select on public.saison_historique to authenticated;

drop policy if exists "saison_historique: l'admin lit" on public.saison_historique;
create policy "saison_historique: l'admin lit"
  on public.saison_historique for select to authenticated
  using ((select public.is_league_admin()));

create table if not exists public.saison_corbeille (
  id          bigint generated always as identity primary key,
  genre       text not null check (genre in ('joueur', 'journee', 'ligne')),
  cle         text not null,
  libelle     text not null,
  element     jsonb not null,
  supprime_le timestamptz not null default now(),
  par         uuid,
  restaure_le timestamptz
);

create index if not exists saison_corbeille_le on public.saison_corbeille (supprime_le desc);

alter table public.saison_corbeille enable row level security;
revoke all on public.saison_corbeille from anon, authenticated;
grant select on public.saison_corbeille to authenticated;
grant update (restaure_le) on public.saison_corbeille to authenticated;

drop policy if exists "saison_corbeille: l'admin lit" on public.saison_corbeille;
create policy "saison_corbeille: l'admin lit"
  on public.saison_corbeille for select to authenticated
  using ((select public.is_league_admin()));

drop policy if exists "saison_corbeille: l'admin remet" on public.saison_corbeille;
create policy "saison_corbeille: l'admin remet"
  on public.saison_corbeille for update to authenticated
  using ((select public.is_league_admin()))
  with check ((select public.is_league_admin()));

create or replace function public.saison_garde_trace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  qui uuid := auth.uid();
begin
  if old.data is not distinct from new.data then
    return new;
  end if;

  insert into public.saison_historique (version, data, seed, par)
  values (old.version, old.data, old.seed, qui);
  delete from public.saison_historique
   where id in (select h.id from public.saison_historique h order by h.id desc offset 200);
  delete from public.saison_corbeille where supprime_le < now() - interval '60 days';

  if coalesce(old.data->>'numero', '') is distinct from coalesce(new.data->>'numero', '') then
    return new;
  end if;

  -- Joueurs sortis de l'effectif.
  insert into public.saison_corbeille (genre, cle, libelle, element, par)
  select 'joueur', r->>'name', r->>'name', r, qui
    from jsonb_array_elements(coalesce(old.data->'roster', '[]'::jsonb)) r
   where not exists (
     select 1 from jsonb_array_elements(coalesce(new.data->'roster', '[]'::jsonb)) n
      where n->>'name' = r->>'name'
   );

  -- Journées supprimées, avec leurs lignes.
  insert into public.saison_corbeille (genre, cle, libelle, element, par)
  select 'journee', m->>'j', 'J' || (m->>'j'),
         jsonb_build_object(
           'journee', m,
           'lignes', coalesce((
             select jsonb_agg(e)
               from jsonb_array_elements(coalesce(old.data->'entries', '[]'::jsonb)) e
              where e->>'j' = m->>'j'
           ), '[]'::jsonb)
         ),
         qui
    from jsonb_array_elements(coalesce(old.data->'journees', '[]'::jsonb)) m
   where not exists (
     select 1 from jsonb_array_elements(coalesce(new.data->'journees', '[]'::jsonb)) n
      where n->>'j' = m->>'j'
   );

  -- Lignes retirées d'une journée qui reste : un joueur compte autant de
  -- lignes qu'il en a dans la journée ; s'il en a moins, les dernières
  -- manquent. Modifier une ligne (ses buts, son équipe) ne la jette pas.
  with avant as (
    select e, e->>'j' as j, e->>'player' as p,
           row_number() over (partition by e->>'j', e->>'player' order by o) as rang
      from jsonb_array_elements(coalesce(old.data->'entries', '[]'::jsonb)) with ordinality t(e, o)
  ),
  apres as (
    select e->>'j' as j, e->>'player' as p, count(*) as n
      from jsonb_array_elements(coalesce(new.data->'entries', '[]'::jsonb)) e
     group by 1, 2
  )
  insert into public.saison_corbeille (genre, cle, libelle, element, par)
  select 'ligne', a.j || '·' || a.p, a.p || ' · J' || a.j, a.e, qui
    from avant a
    left join apres b on b.j = a.j and b.p = a.p
   where a.rang > coalesce(b.n, 0)
     and exists (
       select 1 from jsonb_array_elements(coalesce(new.data->'journees', '[]'::jsonb)) m
        where m->>'j' = a.j
     );

  return new;
end;
$$;

revoke execute on function public.saison_garde_trace() from public, anon, authenticated;

drop trigger if exists saison_garde_trace on public.saison;
create trigger saison_garde_trace after update on public.saison
  for each row execute function public.saison_garde_trace();

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

-- Une réponse donnée est figée (Sabri, 27/10/2026) : on passait sur la
-- convocation, on décochait « Je viens » ou on cochait « Pas dispo » sans le
-- vouloir, un téléphone qui bugue faisait le reste, et la liste ne voulait
-- plus rien dire. Le joueur répond une fois (l'insertion ci-dessus) ; il ne
-- modifie ni ne retire plus sa réponse : sans règle d'update ni de delete
-- pour lui, la base refuse (un upsert sur une réponse existante lève une
-- erreur RLS). Seul l'admin la change (correction admin, plus bas), et la
-- feuille de la journée passe devant elle (lib/sfl/presence-feuille.ts).
drop policy if exists "presence: je modifie ma réponse" on public.presence;
drop policy if exists "presence: je retire ma réponse" on public.presence;

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
grant update (nouveautes_vues) on public.profiles to authenticated;
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
--   · {"type":"actu","video":"j3-le-recap","titre":"J3! Le Recap","montre":"carrousel"}
--     (26/10 : une vidéo des Actus, son carrousel ou une de ses images, 0…)
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
    and piece->>'type' in ('carte', 'feuille', 'classement', 'vocal', 'photo', 'video', 'ligue', 'rejoint', 'actu')
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

-- Un match dont la feuille est faite ne s'efface plus que par l'admin :
-- l'organisateur effaçait un match perdu, et la Ligue vierge oubliait la
-- défaite de tous ses joueurs (28/10/2026).
drop policy if exists "matchs: j'annule le mien" on public.matchs;
create policy "matchs: j'annule le mien"
  on public.matchs for delete
  to authenticated
  using ((organisateur = (select auth.uid()) and saisi_le is null) or (select public.is_league_admin()));

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
-- La confirmation des résultats (Sabri, 28/10 : « dans le mode Bola, il n'y
-- a pas de vote de la part des joueurs. Il n'y a qu'une confirmation des
-- statistiques du match » ; « Par un écran qui s'affiche confirmer ou
-- infirmer les résultats ») : chaque enregistrement qui change la feuille
-- en fait une nouvelle version (match_feuilles, plus bas), que les joueurs
-- confirment ou infirment (match_confirmations). Les matchs saisis avant
-- restent comptés tels quels : choix par défaut, 28/10. L'exemption tient
-- aux lignes présentes au déploiement (l'ajout de la colonne les met à
-- false), pas à la valeur par défaut : un match créé ensuite naît à true
-- (match_naissance_gardee le force), et le mode d'un match ne change plus
-- (match_feuille_gardee) — on saisissait un match en « team » pour le
-- repasser en « bola », compté sans personne. Seule la fonction
-- enregistrer_feuille_bola écrit ces deux colonnes (match_feuille_gardee).
alter table public.matchs add column if not exists feuille_version int not null default 0;
alter table public.matchs add column if not exists confirmation_requise boolean not null default false;
alter table public.matchs alter column confirmation_requise set default true;

-- equipe : null tant que rien n'est saisi, puis clairs, fonces ou absent.
alter table public.match_joueurs add column if not exists equipe text check (equipe in ('clairs', 'fonces', 'absent'));
alter table public.match_joueurs add column if not exists buts int not null default 0 check (buts between 0 and 99);
alter table public.match_joueurs add column if not exists passes int not null default 0 check (passes between 0 and 99);

-- Le coup d'envoi d'un match, heure de Paris : « 19h00 », « 19:00 », « 19h » ;
-- une heure illisible compte pour midi. Le même calcul que heureMin et
-- coupDEnvoiPasse (lib/sfl/ligue-vierge.ts), qui ouvrent la feuille dans
-- l'app : la base ne refuse pas une feuille que l'app propose, ni l'inverse.
create or replace function public.coup_d_envoi(j date, h text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (j + case
                when h ~* '^\d{1,2}\s*[h:]'
                  then make_interval(
                         hours => substring(h from '^(\d{1,2})')::int,
                         mins => coalesce(nullif(substring(h from '^\d{1,2}\s*[hH:]\s*(\d{0,2})'), '')::int, 0)
                       )
                else interval '12 hours'
              end) at time zone 'Europe/Paris';
$$;

-- Un joueur accepte son invitation (sa ligne), mais seul l'organisateur (ou
-- l'admin) écrit les stats ; une ligne ne change jamais de match ni de
-- joueur ; et une feuille ne se corrige plus 24 h après sa première saisie.
-- Depuis le 28/10/2026 : pas de feuille avant le coup d'envoi (on saisissait
-- un match pas encore joué), et une fois la feuille faite, le jour et l'heure
-- ne bougent plus (un match déplacé après coup changeait la journée où il
-- compte). L'admin passe toujours ; le serveur (clé secrète) aussi, pour ces
-- deux règles-là.
create or replace function public.match_feuille_gardee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  saisi timestamptz;
  m_jour date;
  m_heure text;
  m_mode text;
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
    -- La réponse du joueur est figée (27/10/2026) : de l'invitation, il passe
    -- une fois à « inscrit » (Je viens), puis plus rien ; seuls
    -- l'organisateur, l'admin (plus haut) et le serveur la changent.
    if new.statut is distinct from old.statut
       and (select auth.uid()) is not null
       and not public.organise_match(new.match_id)
       and not (old.statut = 'invite' and new.statut = 'inscrit') then
      raise exception 'réponse figée' using errcode = 'P0001';
    end if;
    -- Une invitation ne s'accepte plus, dans un match Bola, une fois la
    -- feuille faite (28/10/2026) : on entrait au classement d'un match où
    -- on n'avait rien dit.
    if old.statut = 'invite' and new.statut = 'inscrit'
       and (select auth.uid()) is not null
       and not public.organise_match(new.match_id)
       and exists (select 1 from public.matchs x where x.id = new.match_id and x.mode = 'bola' and x.saisi_le is not null) then
      raise exception 'match déjà joué' using errcode = 'P0001';
    end if;
    if (new.equipe, new.buts, new.passes) is distinct from (old.equipe, old.buts, old.passes) then
      if not public.organise_match(new.match_id) then
        raise exception 'feuille réservée à l''organisateur' using errcode = '42501';
      end if;
      select saisi_le, jour, heure, mode into saisi, m_jour, m_heure, m_mode from public.matchs where id = new.match_id;
      if saisi is not null and saisi < now() - interval '24 hours' then
        raise exception 'feuille close' using errcode = 'P0001';
      end if;
      if saisi is null and (select auth.uid()) is not null
         and public.coup_d_envoi(m_jour, m_heure) > now() then
        raise exception 'match pas commencé' using errcode = 'P0001';
      end if;
      -- Une feuille Bola ne s'écrit plus que par enregistrer_feuille_bola
      -- (28/10/2026) : une ligne changée à côté, après les confirmations des
      -- joueurs, ne ferait pas de nouvelle version. Une app restée en cache
      -- l'écrivait en direct : « Mets l'app à jour » (direErreur).
      if m_mode = 'bola' and (select auth.uid()) is not null
         and current_setting('bola.feuille', true) is distinct from '1' then
        raise exception 'feuille par l''app' using errcode = 'P0001';
      end if;
    end if;
  else
    -- Le mode d'un match ne change pas (28/10/2026) : saisi en « team »,
    -- repassé en « bola », il comptait sans confirmation. L'app ne le
    -- change jamais ; l'admin (plus haut) et le serveur passent.
    if new.mode is distinct from old.mode and (select auth.uid()) is not null then
      raise exception 'mode figé' using errcode = 'P0001';
    end if;
    -- La version de la feuille et sa confirmation : la fonction seule les
    -- écrit, et le score d'un match Bola ne change que par elle (28/10/2026).
    if current_setting('bola.feuille', true) is distinct from '1' then
      new.feuille_version := old.feuille_version;
      new.confirmation_requise := old.confirmation_requise;
      if new.mode = 'bola' and (select auth.uid()) is not null
         and (new.score_clairs, new.score_fonces) is distinct from (old.score_clairs, old.score_fonces) then
        raise exception 'feuille par l''app' using errcode = 'P0001';
      end if;
    end if;
    if old.saisi_le is null and (select auth.uid()) is not null
       and new.score_clairs is not null and new.score_fonces is not null
       and public.coup_d_envoi(new.jour, new.heure) > now() then
      raise exception 'match pas commencé' using errcode = 'P0001';
    end if;
    if old.saisi_le is not null and (select auth.uid()) is not null
       and (new.jour, new.heure) is distinct from (old.jour, old.heure) then
      raise exception 'match déjà joué' using errcode = 'P0001';
    end if;
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

-- Les refus d'invitation (27/10/2026) : « Pas dispo » retire la ligne de
-- l'invité (match_joueurs, comme avant : aucun lecteur des joueurs d'un
-- match ne change), et la base garde ici qu'il a répondu. Sa réponse est
-- figée comme un « Je viens » : il ne reprend pas une place de ce match de
-- lui-même (match_entree_gardee). L'organisateur peut le réinviter, l'admin
-- effacer le refus. Écrit seulement par match_sortie_gardee (security
-- definer) : aucune règle d'écriture pour les joueurs.
create table if not exists public.match_refus (
  match_id  bigint not null references public.matchs(id) on delete cascade,
  player_id uuid   not null references public.profiles(id) on delete cascade,
  refuse_le timestamptz not null default now(),
  primary key (match_id, player_id)
);

create index if not exists match_refus_player_idx on public.match_refus (player_id);

alter table public.match_refus enable row level security;

drop policy if exists "match_refus: lecture" on public.match_refus;
create policy "match_refus: lecture"
  on public.match_refus for select
  to authenticated
  using (
    player_id = (select auth.uid())
    or (select public.organise_match(match_id))
    or (select public.is_league_admin())
  );

drop policy if exists "match_refus: correction admin" on public.match_refus;
create policy "match_refus: correction admin"
  on public.match_refus for delete
  to authenticated
  using ((select public.is_league_admin()));

revoke insert, update, truncate on public.match_refus from anon, authenticated;
grant select, delete on public.match_refus to authenticated;

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
  -- Le serveur (clé secrète) et l'admin passent.
  if (select auth.uid()) is null or public.is_league_admin() then
    return new;
  end if;
  -- L'organisateur aussi, sauf dans un match Bola à la feuille faite : la
  -- ligne arrivait avec ses stats, hors de toute version de la feuille que
  -- les joueurs confirment (28/10/2026).
  if public.organise_match(new.match_id) then
    if exists (select 1 from public.matchs x where x.id = new.match_id and x.mode = 'bola' and x.saisi_le is not null) then
      raise exception 'match déjà joué' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.equipe is not null or new.buts <> 0 or new.passes <> 0 then
    raise exception 'feuille réservée à l''organisateur' using errcode = '42501';
  end if;
  if exists (select 1 from public.matchs x where x.id = new.match_id and x.saisi_le is not null) then
    raise exception 'match déjà joué' using errcode = 'P0001';
  end if;
  -- Il a dit « Pas dispo » à ce match : sa réponse est figée (match_refus).
  if exists (select 1 from public.match_refus r where r.match_id = new.match_id and r.player_id = new.player_id) then
    raise exception 'réponse figée' using errcode = 'P0001';
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
  -- pg_trigger_depth() > 1 : une suppression en cascade (le match annulé,
  -- un compte effacé) n'est pas une réponse du joueur.
  if (select auth.uid()) is null or public.is_league_admin() or pg_trigger_depth() > 1 then
    return old;
  end if;
  -- L'organisateur retire qui il veut, jusqu'à la feuille d'un match Bola :
  -- ensuite, un joueur qui n'est pas venu passe « Absent » sur la feuille
  -- (une nouvelle version, que les joueurs confirment). Retirer sa ligne
  -- changeait les stats sans rien dire à personne (28/10/2026).
  if public.organise_match(old.match_id) then
    if exists (select 1 from public.matchs x where x.id = old.match_id and x.mode = 'bola' and x.saisi_le is not null) then
      raise exception 'match déjà joué' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if exists (select 1 from public.matchs x where x.id = old.match_id and x.saisi_le is not null) then
    raise exception 'match déjà joué' using errcode = 'P0001';
  end if;
  -- Sa réponse est figée (27/10/2026) : qui a dit « Je viens » ne se retire
  -- plus de lui-même (l'organisateur ou l'admin le retirent) ; l'invité qui
  -- dit « Pas dispo » sort, et son refus est gardé (match_refus).
  if old.statut = 'inscrit' then
    raise exception 'réponse figée' using errcode = 'P0001';
  end if;
  insert into public.match_refus (match_id, player_id)
  values (old.match_id, old.player_id)
  on conflict (match_id, player_id) do update set refuse_le = now();
  return old;
end;
$$;

revoke execute on function public.match_sortie_gardee() from public, anon, authenticated;

drop trigger if exists match_joueurs_sortie on public.match_joueurs;
create trigger match_joueurs_sortie before delete on public.match_joueurs
  for each row execute function public.match_sortie_gardee();

-- ─────────────── Mode Bola : les joueurs confirment le résultat ───────────────
-- Sabri, 28/10 : « à la fin, ils puissent noter les résultats du match et,
-- par la même occasion, que le résultat puisse être envoyé à chaque joueur
-- qui confirme » ; « dans le mode Bola, il n'y a pas de vote de la part des
-- joueurs. Il n'y a qu'une confirmation des statistiques du match » ; « Par
-- un écran qui s'affiche confirmer ou infirmer les résultats ».
--
-- L'organisateur enregistre la feuille (enregistrer_feuille_bola) : chaque
-- enregistrement qui la change en fait une version (match_feuilles). Chaque
-- joueur de la feuille qui a un compte reçoit le résultat (notification,
-- /api/matchs/resultat) et l'écran « Résultat du match » à l'ouverture de
-- l'app (resultat-a-confirmer.tsx) : il confirme ou il infirme, une fois par
-- version (match_confirmations). Règles, choix par défaut, 28/10 (Sabri peut
-- les changer) :
--   · les destinataires : les joueurs de la feuille (Clairs, Foncés, ou
--     Absent après avoir dit « Je viens » : il peut dire qu'il y était),
--     comptes acceptés, sauf l'organisateur — sa saisie vaut sa déclaration ;
--   · la liste des destinataires est figée dans chaque version (une
--     invitation acceptée après coup ne change plus le compte), et ceux de
--     la version d'avant restent sur celle d'une correction ;
--   · le match compte dès que la moitié des destinataires confirme ; il ne
--     compte pas dès que la moitié infirme ; le premier seuil atteint fige
--     la décision (match_feuilles.decide ; à 4 contre 4 sur 8, c'est le
--     premier arrivé) ;
--   · 24 h après la version (la même fenêtre que la correction) : il compte
--     si personne n'a infirmé, sinon il ne compte pas ;
--   · une correction de l'organisateur (dans ses 24 h, comme avant) remet
--     les réponses à zéro : nouvelle version, nouvelle notification ;
--   · aucune notification quand le match bascule, pour ne pas faire de bruit ;
--   · les matchs saisis avant (confirmation_requise à false) comptent tels
--     quels, même corrigés après ;
--   · les journées de la SFL et le mode Team (equipe_resultat) ne sont pas
--     concernés.
-- L'état se calcule à la lecture (etat_resultat, comparé à now()) : aucune
-- tâche planifiée. Le même calcul, en TypeScript, dans
-- lib/sfl/confirmation-resultat.ts (etatResultat) : valeurs recopiées.

-- Une ligne par version enregistrée : ce que les joueurs ont jugé, et
-- l'historique en cas de litige. L'heure de la version fait partir les 24 h.
create table if not exists public.match_feuilles (
  match_id       bigint not null references public.matchs(id) on delete cascade,
  version        int    not null,
  enregistree_le timestamptz not null default now(),
  par            uuid references public.profiles(id) on delete set null,
  -- { scoreClairs, scoreFonces, lignes: [{ id, equipe, buts, passes }] }
  instantane     jsonb  not null,
  -- Les joueurs prévenus (/api/matchs/resultat, clé secrète) : une fois.
  resultat_notifie_le timestamptz,
  -- Ceux qui répondent à cette version, figés à l'enregistrement : une
  -- invitation acceptée après coup, un compte validé ou effacé ne changent
  -- plus le compte (n), et un joueur qui répondait reste sur la liste d'une
  -- correction (enregistrer_feuille_bola).
  destinataires  uuid[] not null default '{}',
  -- Le seuil atteint (la moitié confirme ou infirme) : la décision, figée.
  decide         text check (decide in ('compte', 'ne_compte_pas')),
  decide_le      timestamptz,
  primary key (match_id, version)
);

alter table public.match_feuilles add column if not exists destinataires uuid[] not null default '{}';
alter table public.match_feuilles add column if not exists decide text check (decide in ('compte', 'ne_compte_pas'));
alter table public.match_feuilles add column if not exists decide_le timestamptz;

alter table public.match_feuilles enable row level security;

drop policy if exists "match_feuilles: lecture" on public.match_feuilles;
create policy "match_feuilles: lecture"
  on public.match_feuilles for select
  to authenticated
  using ((select public.voit_match(match_id)));

revoke all on public.match_feuilles from anon, authenticated;
grant select on public.match_feuilles to authenticated;

-- Une réponse par joueur et par version : figée, comme « Je viens ». Le
-- motif d'un « infirme » reste entre le joueur, l'organisateur et l'admin.
create table if not exists public.match_confirmations (
  match_id  bigint not null references public.matchs(id) on delete cascade,
  joueur    uuid   not null references public.profiles(id) on delete cascade,
  version   int    not null,
  reponse   text   not null check (reponse in ('confirme', 'infirme')),
  motif     text   check (motif is null or char_length(btrim(motif)) between 1 and 140),
  le        timestamptz not null default now(),
  -- Un « infirme » signalé à l'organisateur (/api/matchs/resultat) : une fois.
  notifie_le timestamptz,
  primary key (match_id, joueur, version)
);

create index if not exists match_confirmations_joueur_idx on public.match_confirmations (joueur);

alter table public.match_confirmations enable row level security;

drop policy if exists "match_confirmations: lecture" on public.match_confirmations;
create policy "match_confirmations: lecture"
  on public.match_confirmations for select
  to authenticated
  using (
    joueur = (select auth.uid())
    or (select public.organise_match(match_id))
    or (select public.is_league_admin())
  );

-- Personne n'écrit ici en direct : repondre_resultat seule (et la clé secrète).
revoke all on public.match_confirmations from anon, authenticated;
grant select on public.match_confirmations to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.match_confirmations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- L'état d'un résultat, d'après ses chiffres : n destinataires, c « confirme »,
-- i « infirme », jusqua la fin des 24 h. Le premier cas vrai l'emporte. Le
-- même calcul que etatResultat (lib/sfl/confirmation-resultat.ts). Choix
-- par défaut, 28/10 : à l'échéance, un seul « infirme » sans la moitié de
-- confirmations suffit à ce que le match ne compte pas (la consigne : il
-- compte si la moitié confirme, ou si personne ne conteste) ; un joueur
-- bloque donc seul un match si les autres ne répondent pas. Sans
-- destinataire (n = 0), le match attend aussi ses 24 h.
create or replace function public.etat_resultat(requise boolean, saisi boolean, n int, c int, i int, jusqua timestamptz, maintenant timestamptz)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when not saisi then null
    when not requise then 'compte'
    when n = 0 then case when jusqua is null or maintenant >= jusqua then 'compte' else 'en_attente' end
    when i * 2 >= n then 'ne_compte_pas'
    when c * 2 >= n then 'compte'
    when jusqua is null or maintenant >= jusqua then case when i = 0 then 'compte' else 'ne_compte_pas' end
    when i > 0 then 'conteste'
    else 'en_attente'
  end;
$$;

grant execute on function public.etat_resultat(boolean, boolean, int, int, int, timestamptz, timestamptz) to authenticated;

-- Ceux qui répondent pour la feuille d'un match (voir plus haut), au moment
-- où elle s'enregistre : enregistrer_feuille_bola les fige dans la version.
-- Un « Absent » ne répond que s'il avait lui-même dit « Je viens »
-- (accepte_le) : l'organisateur inscrit qui il veut.
create or replace function public.destinataires_feuille(m bigint)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select j.player_id
    from public.match_joueurs j
    join public.matchs x on x.id = j.match_id
    join public.profiles p on p.id = j.player_id
   where j.match_id = m
     and j.player_id <> x.organisateur
     and p.valide
     and (j.equipe in ('clairs', 'fonces') or (j.equipe = 'absent' and j.statut = 'inscrit' and j.accepte_le is not null));
$$;

-- Le bilan de la version courante. Sans contrôle d'accès : réservé aux
-- fonctions plus bas, qui le font.
create or replace function public.bilan_feuille(m bigint)
returns table (requise boolean, saisi boolean, version int, n int, c int, i int, jusqua timestamptz, etat text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.requise, b.saisi, b.version, b.n, b.c, b.i, b.jusqua,
         coalesce(b.decide, public.etat_resultat(b.requise, b.saisi, b.n, b.c, b.i, b.jusqua, now()))
    from (
      select x.confirmation_requise as requise,
             (x.saisi_le is not null and x.score_clairs is not null and x.score_fonces is not null) as saisi,
             x.feuille_version as version,
             coalesce(cardinality(f.destinataires), 0) as n,
             (select count(*)::int from public.match_confirmations r
               where r.match_id = m and r.version = x.feuille_version and r.reponse = 'confirme'
                 and r.joueur = any (f.destinataires)) as c,
             (select count(*)::int from public.match_confirmations r
               where r.match_id = m and r.version = x.feuille_version and r.reponse = 'infirme'
                 and r.joueur = any (f.destinataires)) as i,
             -- La fenêtre de réponse : 24 h par version (choix par défaut, 28/10).
             f.enregistree_le + interval '24 hours' as jusqua,
             f.decide
        from public.matchs x
        left join public.match_feuilles f on f.match_id = x.id and f.version = x.feuille_version
       where x.id = m
    ) b;
$$;

create or replace function public.etat_feuille(m bigint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select b.etat from public.bilan_feuille(m) b;
$$;

revoke execute on function public.destinataires_feuille(bigint) from public, anon, authenticated;
revoke execute on function public.bilan_feuille(bigint) from public, anon, authenticated;
revoke execute on function public.etat_feuille(bigint) from public, anon, authenticated;

-- L'organisateur (ou l'admin) enregistre la feuille d'un match Bola, d'un
-- coup : les lignes, le score, puis la version. Les règles de la feuille
-- (match_feuille_gardee : le coup d'envoi, les 24 h, l'organisateur)
-- s'appliquent comme avant. Une feuille réenregistrée telle quelle ne fait
-- pas de version : rien ne repart à zéro. Renvoie la version courante.
create or replace function public.enregistrer_feuille_bola(m bigint, clairs int, fonces int, lignes jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  x public.matchs%rowtype;
  l jsonb;
  n int;
  premiere boolean;
  inst jsonb;
  avant jsonb;
  dest_avant uuid[];
  dest uuid[];
  v int;
begin
  select * into x from public.matchs where id = m for update;
  if not found or x.mode <> 'bola' then
    raise exception 'match inconnu' using errcode = 'P0002';
  end if;
  if x.organisateur is distinct from (select auth.uid()) and not public.is_league_admin() then
    raise exception 'feuille réservée à l''organisateur' using errcode = '42501';
  end if;
  if x.saisi_le is not null and x.saisi_le < now() - interval '24 hours' and not public.is_league_admin() then
    raise exception 'feuille close' using errcode = 'P0001';
  end if;
  if clairs is null or fonces is null or jsonb_typeof(lignes) is distinct from 'array' then
    raise exception 'feuille incomplète' using errcode = '22023';
  end if;
  premiere := x.saisi_le is null;
  perform set_config('bola.feuille', '1', true);
  for l in select * from jsonb_array_elements(lignes) loop
    -- Chaque ligne dans une équipe ou absente : une ligne remise à null
    -- sortait de la feuille un joueur qui avait infirmé.
    if (l ->> 'equipe') is null or (l ->> 'equipe') not in ('clairs', 'fonces', 'absent') then
      raise exception 'feuille incomplète' using errcode = '22023';
    end if;
    update public.match_joueurs j
       set equipe = l ->> 'equipe',
           buts   = case when l ->> 'equipe' = 'absent' then 0 else coalesce((l ->> 'buts')::int, 0) end,
           passes = case when l ->> 'equipe' = 'absent' then 0 else coalesce((l ->> 'passes')::int, 0) end
     where j.match_id = m and j.player_id = (l ->> 'playerId')::uuid;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'joueur absent de la feuille' using errcode = '22023';
    end if;
  end loop;
  -- Toute la feuille : aucun joueur du match laissé de côté.
  if exists (select 1 from public.match_joueurs j where j.match_id = m and j.equipe is null) then
    raise exception 'feuille incomplète' using errcode = '22023';
  end if;
  update public.matchs set score_clairs = clairs, score_fonces = fonces where id = m;
  -- Jamais plus de buts ni de passes qu'un score n'en compte.
  if exists (
    select 1
      from public.match_joueurs j
     where j.match_id = m and j.equipe in ('clairs', 'fonces')
     group by j.equipe
    having sum(j.buts) > case j.equipe when 'clairs' then clairs else fonces end
        or sum(j.passes) > case j.equipe when 'clairs' then clairs else fonces end
  ) then
    raise exception 'feuille incohérente' using errcode = '22023';
  end if;
  select jsonb_build_object(
           'scoreClairs', clairs,
           'scoreFonces', fonces,
           'lignes', coalesce(jsonb_agg(jsonb_build_object('id', j.player_id, 'equipe', j.equipe, 'buts', j.buts, 'passes', j.passes)
                                        order by j.player_id), '[]'::jsonb))
    into inst
    from public.match_joueurs j
   where j.match_id = m and j.equipe is not null;
  select f.instantane, f.destinataires into avant, dest_avant
    from public.match_feuilles f where f.match_id = m and f.version = x.feuille_version;
  if avant is not null and avant = inst then
    return x.feuille_version;
  end if;
  -- Les destinataires de la version : ceux d'aujourd'hui, plus ceux de la
  -- version d'avant (qui a infirmé juge aussi la correction).
  select coalesce(array_agg(distinct d order by d), '{}') into dest
    from (
      select public.destinataires_feuille(m) as d
      union
      select unnest(coalesce(dest_avant, '{}'))
    ) t
   where d is not null and d is distinct from x.organisateur;
  v := x.feuille_version + 1;
  insert into public.match_feuilles (match_id, version, par, instantane, destinataires)
  values (m, v, (select auth.uid()), inst, dest);
  update public.matchs
     set feuille_version = v,
         confirmation_requise = confirmation_requise or premiere
   where id = m;
  -- Une correction : ce qu'attendait la notification « Résultat infirmé ».
  if v > 1 then
    begin
      perform public.push_effet(x.organisateur, array['match-conteste'], 'match:' || m, 'corrige', interval '2 days');
    exception when others then
      raise warning 'enregistrer_feuille_bola : %', sqlerrm;
    end;
  end if;
  return v;
end;
$$;

revoke execute on function public.enregistrer_feuille_bola(bigint, int, int, jsonb) from public, anon;
grant execute on function public.enregistrer_feuille_bola(bigint, int, int, jsonb) to authenticated;

-- Un joueur confirme ou infirme la version v (celle qu'il a vue). Une
-- réponse par version, figée ; plus rien une fois le résultat décidé.
-- Renvoie le nouvel état.
create or replace function public.repondre_resultat(m bigint, v int, r text, motif text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  x public.matchs%rowtype;
  e text;
begin
  -- Le verrou : deux réponses au même instant ne passent pas un seuil à deux.
  select * into x from public.matchs where id = m for update;
  if not found or x.mode <> 'bola' or not x.confirmation_requise or x.saisi_le is null then
    raise exception 'aucun résultat à confirmer' using errcode = 'P0002';
  end if;
  if r is null or r not in ('confirme', 'infirme') then
    raise exception 'réponse inconnue' using errcode = '22023';
  end if;
  if v is distinct from x.feuille_version then
    raise exception 'feuille corrigée' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.match_feuilles f
                  where f.match_id = m and f.version = v and (select auth.uid()) = any (f.destinataires)) then
    raise exception 'pas sur la feuille' using errcode = '42501';
  end if;
  if exists (select 1 from public.match_confirmations c
              where c.match_id = m and c.joueur = (select auth.uid()) and c.version = v) then
    raise exception 'réponse figée' using errcode = 'P0001';
  end if;
  if public.etat_feuille(m) not in ('en_attente', 'conteste') then
    raise exception 'résultat décidé' using errcode = 'P0001';
  end if;
  insert into public.match_confirmations (match_id, joueur, version, reponse, motif)
  values (m, (select auth.uid()), v, r, case when r = 'infirme' then nullif(btrim(left(motif, 140)), '') end);
  e := public.etat_feuille(m);
  -- Un seuil franchi (la réponse arrive avant l'échéance) : la décision se
  -- fige dans la version.
  if e in ('compte', 'ne_compte_pas') then
    update public.match_feuilles set decide = e, decide_le = now()
     where match_id = m and version = v and decide is null;
  end if;
  return e;
end;
$$;

revoke execute on function public.repondre_resultat(bigint, int, text, text) from public, anon;
grant execute on function public.repondre_resultat(bigint, int, text, text) to authenticated;

-- Ce que montre l'écran « Résultat du match » : le match, la version
-- jugée (avec les noms), le bilan. Sans contrôle d'accès : réservé aux
-- fonctions qui le font.
create or replace function public.feuille_vue(m bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'id', x.id,
           'version', x.feuille_version,
           'jour', x.jour,
           'heure', x.heure,
           'lieu', x.lieu,
           'organisateurId', x.organisateur,
           'organisateur', o.name,
           'scoreClairs', f.instantane -> 'scoreClairs',
           'scoreFonces', f.instantane -> 'scoreFonces',
           'lignes', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', l ->> 'id', 'name', coalesce(p.name, '—'), 'equipe', l ->> 'equipe',
                      'buts', (l ->> 'buts')::int, 'passes', (l ->> 'passes')::int, 'poste', fi.poste)
                      order by p.name), '[]'::jsonb)
               from jsonb_array_elements(f.instantane -> 'lignes') l
               left join public.profiles p on p.id = (l ->> 'id')::uuid
               left join public.fiches fi on fi.player_id = (l ->> 'id')::uuid
           ),
           'n', b.n, 'c', b.c, 'i', b.i, 'etat', b.etat, 'jusqua', b.jusqua
         )
    from public.matchs x
    join public.match_feuilles f on f.match_id = x.id and f.version = x.feuille_version
    left join public.profiles o on o.id = x.organisateur
    cross join lateral public.bilan_feuille(x.id) b
   where x.id = m;
$$;

revoke execute on function public.feuille_vue(bigint) from public, anon, authenticated;

-- Les résultats qui attendent ma réponse : je suis sur la feuille, je n'ai
-- pas répondu à sa version courante, rien n'est décidé. Du plus ancien au
-- plus récent.
create or replace function public.mes_resultats_a_confirmer()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  -- Depuis mes lignes (match_joueurs_player_idx) : l'appel de chaque
  -- ouverture de l'app ne parcourt pas tous les matchs. Une version sans
  -- décision, de moins de 24 h, est forcément en attente ou contestée.
  select coalesce(jsonb_agg(public.feuille_vue(x.id) order by f.enregistree_le, x.id), '[]'::jsonb)
    from public.match_joueurs j
    join public.matchs x on x.id = j.match_id
    join public.match_feuilles f on f.match_id = x.id and f.version = x.feuille_version
   where j.player_id = (select auth.uid())
     and x.mode = 'bola' and x.confirmation_requise and x.saisi_le is not null
     and f.decide is null
     and f.enregistree_le > now() - interval '24 hours'
     and (select auth.uid()) = any (f.destinataires)
     and not exists (select 1 from public.match_confirmations c
                      where c.match_id = x.id and c.joueur = (select auth.uid()) and c.version = x.feuille_version);
$$;

revoke execute on function public.mes_resultats_a_confirmer() from public, anon;
grant execute on function public.mes_resultats_a_confirmer() to authenticated;

-- L'état des matchs que je vois (la fiche, mes derniers matchs), et ma
-- réponse : { "12": { etat, version, n, c, i, jusqua, requise, destinataire, mienne } }.
create or replace function public.bilans_feuilles(ids bigint[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(x.id::text, jsonb_build_object(
           'etat', b.etat, 'version', b.version, 'n', b.n, 'c', b.c, 'i', b.i, 'jusqua', b.jusqua,
           'requise', b.requise,
           'corrigerJusqua', x.saisi_le + interval '24 hours',
           'destinataire', exists (select 1 from public.match_feuilles f
                                    where f.match_id = x.id and f.version = x.feuille_version
                                      and (select auth.uid()) = any (f.destinataires)),
           'mienne', (select c.reponse from public.match_confirmations c
                       where c.match_id = x.id and c.joueur = (select auth.uid()) and c.version = x.feuille_version)
         )), '{}'::jsonb)
    from public.matchs x
    cross join lateral public.bilan_feuille(x.id) b
   where x.id = any (ids[1:100])
     and x.mode = 'bola'
     and public.voit_match(x.id);
$$;

revoke execute on function public.bilans_feuilles(bigint[]) from public, anon;
grant execute on function public.bilans_feuilles(bigint[]) to authenticated;

-- Les réponses à la version courante, pour l'organisateur (ou l'admin) :
-- chaque destinataire, sa réponse et son motif. Un autre joueur du match
-- n'a que le bilan et sa réponse.
create or replace function public.reponses_du_match(m bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'etat', b.etat, 'version', b.version, 'n', b.n, 'c', b.c, 'i', b.i, 'jusqua', b.jusqua, 'requise', b.requise,
           'corrigerJusqua', (select x.saisi_le + interval '24 hours' from public.matchs x where x.id = m),
           'mienne', (select c.reponse from public.match_confirmations c
                       where c.match_id = m and c.joueur = (select auth.uid()) and c.version = b.version),
           'reponses', case when public.organise_match(m) or public.is_league_admin() then (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', d, 'name', p.name, 'reponse', c.reponse, 'motif', c.motif, 'le', c.le)
                      order by (c.reponse = 'infirme') desc nulls last, p.name), '[]'::jsonb)
               from unnest((select f.destinataires from public.match_feuilles f
                             where f.match_id = m and f.version = b.version)) d
               join public.profiles p on p.id = d
               left join public.match_confirmations c on c.match_id = m and c.joueur = d and c.version = b.version
           ) end
         )
    from public.bilan_feuille(m) b
   where public.voit_match(m);
$$;

revoke execute on function public.reponses_du_match(bigint) from public, anon;
grant execute on function public.reponses_du_match(bigint) to authenticated;

-- Le résultat d'un match que je vois, même déjà répondu : l'écran « Résultat
-- du match » en lecture (Mes derniers matchs), avec ma réponse. Null pour un
-- match sans feuille versionnée (saisi avant le 28/10/2026).
create or replace function public.resultat_du_match(m bigint)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.feuille_vue(x.id) || jsonb_build_object(
           'mienne', (select c.reponse from public.match_confirmations c
                       where c.match_id = x.id and c.joueur = (select auth.uid()) and c.version = x.feuille_version),
           'destinataire', (select auth.uid()) = any (f.destinataires))
    from public.matchs x
    join public.match_feuilles f on f.match_id = x.id and f.version = x.feuille_version
   where x.id = m
     and x.mode = 'bola'
     and (select auth.uid()) is not null
     and public.voit_match(x.id);
$$;

revoke execute on function public.resultat_du_match(bigint) from public, anon;
grant execute on function public.resultat_du_match(bigint) to authenticated;

-- Une réponse donnée : ce qu'attendait la notification « Un résultat à
-- confirmer » (push_envois). « accepte » pour un oui, « refuse » pour un
-- non : la page Activité les compte comme les invitations.
create or replace function public.push_effet_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.push_effet(new.joueur, array['match-resultat'], 'match:' || new.match_id,
                              case when new.reponse = 'confirme' then 'accepte' else 'refuse' end, interval '2 days');
  exception when others then
    raise warning 'push_effet_confirmation : %', sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.push_effet_confirmation() from public, anon, authenticated;

drop trigger if exists match_confirmations_push_effet on public.match_confirmations;
create trigger match_confirmations_push_effet
  after insert on public.match_confirmations
  for each row execute function public.push_effet_confirmation();

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
    if new.canal = 'dm' then
      -- Un message privé, c'est la suite donnée aux notifications de cette
      -- conversation (« prive:<l'autre> »).
      perform public.push_effet(new.auteur, array['prive-message', 'prive-reaction'],
        'prive:' || new.destinataire, 'message', interval '2 hours');
    elsif coalesce(new.piece ->> 'type', '') <> 'rejoint' then
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
    select canal, match_id, equipe_id, auteur, destinataire into m from public.messages where id = new.message_id;
    if found and m.canal = 'dm' then
      perform public.push_effet(new.user_id, array['prive-message', 'prive-reaction'],
        'prive:' || (case when m.auteur = new.user_id then m.destinataire else m.auteur end), 'reaction', interval '2 hours');
    elsif found then
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
-- Règle : on vote le jour du match, jusqu'à la fin du vote (02/11/2026 :
-- 18 h, une heure au moins après la dernière feuille, minuit au plus tard ;
-- minuit jusqu'à la J4). La base le garde aussi : `jour` doit être aujourd'hui
-- à Paris, et public.vote_ouvert(saison, j) vrai — le jour de la journée lu
-- dans le document de saison, et l'heure de sa fin du vote (fin_du_vote), à
-- l'écriture comme à la modification.
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

-- ══ L'heure du vote, la fin des matchs (Sabri, 01/11 et 02/11/2026) ══
-- « Il faut voter avant 18h. Comme ça, à 19h, on a tous les points de la
-- journée qui sont entrés. » Puis : « une heure de vote minimum, jamais après
-- minuit ». La J4 (01/11) et avant gardent minuit. Même calcul que finDuVote
-- (src/lib/sfl/revelation.ts, REGLES_REVELATION) : changer les deux ensemble.
-- Les corps sont en plpgsql : date_de_journee, entier_sur et instant_sur
-- sont définies plus bas, et ne sont résolues qu'à l'exécution.

-- Le miroir de journeeTerminee (src/lib/sfl/saisie/engine.ts) : un résultat,
-- un but ou une passe saisi, et chaque équipe présente avec son résultat.
create or replace function public.journee_terminee(p_data jsonb, p_j int)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  l jsonb := case when jsonb_typeof(p_data -> 'entries') = 'array' then p_data -> 'entries' else '[]'::jsonb end;
begin
  if not exists (
    select 1 from jsonb_array_elements(l) e
     where e ->> 'j' = p_j::text
       and (coalesce(e ->> 'result', '') <> ''
            or coalesce(public.entier_sur(e ->> 'buts'), 0) > 0
            or coalesce(public.entier_sur(e ->> 'passes'), 0) > 0)
  ) then
    return false;
  end if;
  return not exists (
    select 1 from jsonb_array_elements(l) e
     where e ->> 'j' = p_j::text and e ->> 'statut' = 'Présent'
       and lower(coalesce(e ->> 'extraTime', 'false')) not in ('true', '1')
       and coalesce(e ->> 'team', '') <> ''
     group by e ->> 'team'
    having not bool_or(coalesce(e ->> 'result', '') <> '')
  );
end;
$$;
revoke execute on function public.journee_terminee(jsonb, int) from public, anon, authenticated;

-- La fin du vote d'une journée de la saison en cours : minuit jusqu'à la J4 ;
-- dès la J5, min(minuit, max(18 h, fin des matchs + 1 h)), et minuit tant que
-- la fin des matchs est inconnue. null : pas de journée publiée et datée.
-- `p_ref` fixe l'année du libellé (« 8 nov. ») ; fin_du_vote prend now().
create or replace function public.fin_du_vote_a(p_saison int, p_j int, p_ref timestamptz)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  doc    jsonb;
  meta   jsonb;
  jour   date;
  minuit timestamptz;
  fin    timestamptz;
begin
  select s.data into doc from public.saison s where s.id = 1;
  if doc is null or coalesce(public.entier_sur(doc ->> 'numero'), 0) <> p_saison then
    return null;
  end if;
  select m into meta
    from jsonb_array_elements(case when jsonb_typeof(doc -> 'journees') = 'array' then doc -> 'journees' else '[]'::jsonb end) m
   where m ->> 'j' = p_j::text
   limit 1;
  if meta is null or public.est_brouillon(meta) then
    return null;
  end if;
  jour := public.date_de_journee(meta ->> 'date', p_ref);
  if jour is null then
    return null;
  end if;
  minuit := (jour + 1)::timestamp at time zone 'Europe/Paris';
  -- REGLES_REVELATION.depuis : la J5 de la saison 1.
  if p_saison < 1 or (p_saison = 1 and p_j < 5) then
    return minuit;
  end if;
  fin := public.instant_sur(meta ->> 'finDesMatchs');
  if fin is null then
    return minuit;                                                    -- pas finie : la butée
  end if;
  return least(minuit, greatest((jour + time '18:00') at time zone 'Europe/Paris',   -- FIN_DU_VOTE
                                fin + interval '1 hour'));                           -- VOTE_APRES_FEUILLE_MS
end;
$$;
revoke execute on function public.fin_du_vote_a(int, int, timestamptz) from public, anon, authenticated;

create or replace function public.fin_du_vote(p_saison int, p_j int)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select public.fin_du_vote_a(p_saison, p_j, now());
$$;
revoke execute on function public.fin_du_vote(int, int) from public, anon;
grant execute on function public.fin_du_vote(int, int) to authenticated;

-- Le vote d'une journée est-il ouvert à cet instant ? Le jour même (Paris),
-- avant la fin du vote. vote_ouvert : maintenant (les politiques de votes_figures).
create or replace function public.vote_ouvert_a(p_saison int, p_j int, p_maintenant timestamptz)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  fin timestamptz := public.fin_du_vote_a(p_saison, p_j, p_maintenant);
begin
  if fin is null or p_maintenant >= fin then
    return false;
  end if;
  return (p_maintenant at time zone 'Europe/Paris')::date = ((fin - interval '1 microsecond') at time zone 'Europe/Paris')::date;
end;
$$;
revoke execute on function public.vote_ouvert_a(int, int, timestamptz) from public, anon, authenticated;

create or replace function public.vote_ouvert(p_saison int, p_j int)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.vote_ouvert_a(p_saison, p_j, now());
$$;
revoke execute on function public.vote_ouvert(int, int) from public, anon;
grant execute on function public.vote_ouvert(int, int) to authenticated;

-- Le tampon de la fin des matchs (JourneeMeta.finDesMatchs) : posé une fois
-- par la base, le jour même, quand la dernière feuille est remplie ; jamais
-- déplacé. La valeur déjà en base l'emporte. Une valeur venue de l'app est
-- gardée si elle est à 5 min de l'heure du serveur ; sinon c'est l'heure du
-- serveur. Personne d'autre ne le pose : une valeur sans fondement est
-- retirée. Joue pour publier_saison (l'admin : insert … on conflict, donc
-- deux fois, et c'est l'ancienne ligne qui décide à la seconde) comme pour
-- sceller_feuille (un joueur scelle la feuille de son match).
create or replace function public.saison_fin_des_matchs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  js         jsonb := new.data -> 'journees';
  avant      jsonb := case when tg_op = 'UPDATE' then old.data -> 'journees' end;
  m          jsonb;
  i          int;
  tampon     text;
  propose    timestamptz;
  change     boolean := false;
  aujourdhui date := (now() at time zone 'Europe/Paris')::date;
begin
  if jsonb_typeof(js) is distinct from 'array' then
    return new;
  end if;
  if jsonb_typeof(avant) is distinct from 'array' then
    avant := '[]'::jsonb;
  end if;
  for i in 0 .. jsonb_array_length(js) - 1 loop
    m := js -> i;
    tampon := null;
    select o ->> 'finDesMatchs' into tampon
      from jsonb_array_elements(avant) o
     where o ->> 'j' = m ->> 'j' and coalesce(o ->> 'finDesMatchs', '') <> ''
     limit 1;
    if tampon is null and not public.est_brouillon(m)
       and public.date_de_journee(m ->> 'date', now()) = aujourdhui
       and public.journee_terminee(new.data, public.entier_sur(m ->> 'j')) then
      propose := public.instant_sur(m ->> 'finDesMatchs');
      tampon := case
                  when propose is not null and abs(extract(epoch from propose - now())) <= 300 then m ->> 'finDesMatchs'
                  else to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                end;
    end if;
    if tampon is not null and (m ->> 'finDesMatchs') is distinct from tampon then
      js := jsonb_set(js, array[i::text, 'finDesMatchs'], to_jsonb(tampon));
      change := true;
    elsif tampon is null and m ? 'finDesMatchs' then
      js := jsonb_set(js, array[i::text], m - 'finDesMatchs');
      change := true;
    end if;
  end loop;
  if change then
    new.data := jsonb_set(new.data, '{journees}', js);
  end if;
  return new;
end;
$$;
revoke execute on function public.saison_fin_des_matchs() from public, anon, authenticated;
drop trigger if exists saison_fin_des_matchs on public.saison;
create trigger saison_fin_des_matchs before insert or update of data on public.saison
  for each row execute function public.saison_fin_des_matchs();

drop policy if exists "votes_figures: je vote aujourd'hui" on public.votes_figures;
create policy "votes_figures: je vote aujourd'hui"
  on public.votes_figures for insert
  to authenticated
  with check (
    (select public.est_membre())
    and votant_id = (select auth.uid())
    and votant = (select public.mon_nom())
    and jour = (now() at time zone 'Europe/Paris')::date
    and public.vote_ouvert(saison, j)
  );

drop policy if exists "votes_figures: je change d'avis aujourd'hui" on public.votes_figures;
create policy "votes_figures: je change d'avis aujourd'hui"
  on public.votes_figures for update
  to authenticated
  using (
    votant_id = (select auth.uid())
    and jour = (now() at time zone 'Europe/Paris')::date
    and public.vote_ouvert(saison, j)
  )
  with check (
    votant_id = (select auth.uid())
    and votant = (select public.mon_nom())
    and jour = (now() at time zone 'Europe/Paris')::date
    and public.vote_ouvert(saison, j)
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
--   · on signe une version du Règlement, case cochée (v1 ; v2 depuis le
--     24/10 : 2 points la victoire, et la Charte de déontologie) ;
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
-- L'écusson dessiné (Sabri, 24/10 : « designer un vrai écusson d'équipe et
-- choisir de vraies couleurs ») : forme, motif, trois couleurs, emblème
-- (lib/sfl/blason.ts), posé par equipe_blason. Null : l'écusson noir et
-- blanc des débuts, d'après fond.
alter table public.equipes add column if not exists blason jsonb;
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
-- (invitation d'un joueur SFL) ; jamais retiré. L'offre dure un mois (Sabri,
-- 26/10 : « un accès à Bola Team pendant un mois ; après, ils devront payer
-- pour rester dans l'équipe, ou garder leur abonnement Bola normal ») :
-- acces_team ne la compte que 30 jours après `le` (essai_team_fin).
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
      or exists (select 1 from public.team_offerts t where t.joueur = j and now() < t.le + interval '30 days');
$$;

-- La fin du mois Bola Team offert au joueur connecté (null : pas d'offre, ou
-- joueur SFL, qui l'a pour de bon). Passée, l'offre est finie : la page Team
-- le lui dit (hooks/use-acces-team.ts).
create or replace function public.essai_team_fin()
returns timestamptz
language sql
security definer
set search_path = ''
stable
as $$
  select t.le + interval '30 days'
    from public.team_offerts t
   where t.joueur = (select auth.uid())
     and not public.joueur_sfl((select auth.uid()));
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

revoke execute on function public.joueur_sfl(uuid), public.acces_team(uuid), public.team_sur_invitation(), public.mon_acces_team(), public.essai_team_fin() from public, anon;
grant execute on function public.joueur_sfl(uuid), public.acces_team(uuid), public.team_sur_invitation(), public.mon_acces_team(), public.essai_team_fin() to authenticated;

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
  values (e, moi, 'membre', 'capitaine', now(), 'v2');
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
  update public.equipe_membres m set statut = 'membre', signe_le = now(), reglement_version = 'v2'
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
    'id', x.id, 'nom', x.nom, 'initiales', x.initiales, 'fond', x.fond, 'blason', x.blason, 'ville', x.ville,
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

-- ──────────── Bola Team : écusson, charte, feuille, championnat ────────────
-- Sabri, 24/10 : un vrai écusson et de vraies couleurs ; un règlement
-- déontologique à signer ; un championnat façon Ligue 1, 2 points la
-- victoire, 1 le nul, 0 la défaite, sur des saisons de 4 mois, avec ses
-- buteurs et ses passeurs. Le classement se calcule dans l'app
-- (lib/sfl/championnat-team.ts) d'après ce qui suit.
--
-- L'écusson : le capitaine (ou son vice) le dessine. La base en vérifie la
-- forme ; l'app ne propose que la palette des couleurs de club.
create or replace function public.equipe_blason(e bigint, b jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.role_equipe(e), 'membre') = 'membre' then
    raise exception 'Réservé au capitaine.' using errcode = '42501';
  end if;
  if b is null or jsonb_typeof(b) <> 'object'
     or coalesce(b ->> 'forme', '') <> all (array['ecu', 'blason', 'rond', 'pointe', 'ovale'])
     or coalesce(b ->> 'motif', '') <> all (array['uni', 'parti', 'coupe', 'tranche', 'rayures', 'bande', 'echarpe', 'chevron', 'cercle'])
     or coalesce(b ->> 'embleme', '') <> all (array['initiales', 'etoile', 'ballon', 'couronne', 'eclair', 'lune', 'anneau', 'losange', 'chevrons', 'bandes', 'delta', 'hexagone', 'damier', 'cheval', 'lion', 'aigle', 'loup', 'taureau', 'coq'])
     or coalesce(jsonb_typeof(b -> 'couleurs'), '') <> 'array'
     or jsonb_array_length(b -> 'couleurs') <> 3
     or exists (select 1 from jsonb_array_elements(b -> 'couleurs') c
                 where jsonb_typeof(c) <> 'string' or upper(c #>> '{}') !~ '^#[0-9A-F]{6}$') then
    raise exception 'Écusson invalide.' using errcode = '22023';
  end if;
  update public.equipes x
     set blason = jsonb_build_object(
       'forme', b ->> 'forme',
       'motif', b ->> 'motif',
       'embleme', b ->> 'embleme',
       'couleurs', (select jsonb_agg(upper(t.c #>> '{}') order by t.o)
                      from jsonb_array_elements(b -> 'couleurs') with ordinality t(c, o)))
   where x.id = e and x.dissoute_le is null;
end;
$$;

-- Les signatures, version par version (Règlement Team art. 18.4) : chaque
-- fois qu'un membre signe une version (en créant l'équipe, en y entrant, ou
-- en signant la nouvelle), une ligne. Rien ne s'efface : on garde la trace.
create table if not exists public.equipe_signatures (
  equipe_id  bigint not null references public.equipes(id) on delete cascade,
  joueur     uuid   not null references public.profiles(id) on delete cascade,
  version    text   not null,
  le         timestamptz not null default now(),
  primary key (equipe_id, joueur, version)
);
alter table public.equipe_signatures enable row level security;
drop policy if exists "equipe_signatures: lecture" on public.equipe_signatures;
create policy "equipe_signatures: lecture" on public.equipe_signatures for select to authenticated
  using ((select public.est_membre()) or joueur = (select auth.uid()));
revoke all on public.equipe_signatures from anon, authenticated;
grant select on public.equipe_signatures to authenticated;

create or replace function public.equipe_signature_trace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut = 'membre' and new.reglement_version is not null
     and (tg_op = 'INSERT' or new.reglement_version is distinct from old.reglement_version) then
    insert into public.equipe_signatures (equipe_id, joueur, version)
    values (new.equipe_id, new.joueur, new.reglement_version)
    on conflict do nothing;
  end if;
  return null;
end;
$$;
revoke execute on function public.equipe_signature_trace() from public, anon, authenticated;
drop trigger if exists equipe_membres_signature on public.equipe_membres;
create trigger equipe_membres_signature
  after insert or update of reglement_version on public.equipe_membres
  for each row execute function public.equipe_signature_trace();
-- Les signatures d'avant le 24/10, une fois pour toutes.
insert into public.equipe_signatures (equipe_id, joueur, version, le)
select m.equipe_id, m.joueur, m.reglement_version, coalesce(m.signe_le, m.created_at)
  from public.equipe_membres m
 where m.statut = 'membre' and m.reglement_version is not null
on conflict do nothing;

-- La version 2 (24/10) : 2 points la victoire, et la Charte de
-- déontologie. Un membre qui avait signé la 1 (ou rien, avant le
-- règlement) signe la nouvelle, depuis l'app (art. 18.2).
create or replace function public.equipe_signer_charte(e bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := (select auth.uid());
begin
  if moi is null or not exists (
    select 1 from public.equipe_membres m where m.equipe_id = e and m.joueur = moi and m.statut = 'membre'
  ) then
    raise exception 'Réservé aux joueurs de l''équipe.' using errcode = '42501';
  end if;
  update public.equipe_membres m set reglement_version = 'v2'
   where m.equipe_id = e and m.joueur = moi and m.reglement_version is distinct from 'v2';
end;
$$;

-- La feuille d'un match Team (Règlement Team art. 8) : chaque capitaine (ou
-- son vice) saisit le score final et les buteurs et passeurs de son équipe,
-- du coup d'envoi jusqu'à 3 jours après. Deux saisies qui collent valident
-- le match (sa feuille se ferme) ; une seule vaut au bout de 24 h ; deux
-- qui ne collent pas : chacun peut corriger la sienne tant que la feuille
-- est ouverte, sinon le match n'est pas classé. Un forfait (equipe_defis,
-- 'forfait') se compte 3 – 0 sans feuille. Les buts attribués ne dépassent
-- jamais le score, les passes jamais les buts attribués (art. 8.4).
create table if not exists public.equipe_resultats (
  defi_id    bigint not null references public.equipe_defis(id) on delete cascade,
  equipe_id  bigint not null references public.equipes(id) on delete cascade,
  pour       int    not null check (pour between 0 and 99),
  contre     int    not null check (contre between 0 and 99),
  saisi_par  uuid   references public.profiles(id) on delete set null,
  saisi_le   timestamptz not null default now(),
  -- L'autre équipe prévenue (/api/equipes/notifier, 'resultat') : une fois par saisie.
  notifie_le timestamptz,
  primary key (defi_id, equipe_id)
);
create table if not exists public.equipe_resultat_joueurs (
  defi_id    bigint not null references public.equipe_defis(id) on delete cascade,
  equipe_id  bigint not null references public.equipes(id) on delete cascade,
  joueur     uuid   not null references public.profiles(id) on delete cascade,
  buts       int    not null default 0 check (buts between 0 and 99),
  passes     int    not null default 0 check (passes between 0 and 99),
  primary key (defi_id, joueur)
);
create index if not exists equipe_resultat_joueurs_joueur on public.equipe_resultat_joueurs (joueur);

alter table public.equipe_resultats enable row level security;
alter table public.equipe_resultat_joueurs enable row level security;
drop policy if exists "equipe_resultats: lecture" on public.equipe_resultats;
create policy "equipe_resultats: lecture" on public.equipe_resultats for select to authenticated
  using ((select public.est_membre()));
drop policy if exists "equipe_resultat_joueurs: lecture" on public.equipe_resultat_joueurs;
create policy "equipe_resultat_joueurs: lecture" on public.equipe_resultat_joueurs for select to authenticated
  using ((select public.est_membre()));
revoke all on public.equipe_resultats, public.equipe_resultat_joueurs from anon, authenticated;
grant select on public.equipe_resultats, public.equipe_resultat_joueurs to authenticated;

create or replace function public.equipe_resultat(d bigint, pour int, contre int, lignes jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  x record;
  e bigint;
  coup timestamptz;
  mien record;
  autre record;
  l record;
  tb int := 0;
  tp int := 0;
begin
  select * into x from public.equipe_defis f where f.id = d for update;
  if x is null or x.statut <> 'accepte' then
    raise exception 'Ce match n''a pas de feuille.' using errcode = 'P0001';
  end if;
  if coalesce(public.role_equipe(x.de), 'membre') <> 'membre' then
    e := x.de;
  elsif coalesce(public.role_equipe(x.a), 'membre') <> 'membre' then
    e := x.a;
  else
    raise exception 'Réservé aux capitaines.' using errcode = '42501';
  end if;
  coup := public.equipe_defi_heure(x.jour, x.heure);
  if now() < coup then
    raise exception 'La feuille s''ouvre au coup d''envoi.' using errcode = 'P0001';
  end if;
  if now() > coup + interval '3 days' then
    raise exception 'La feuille de ce match est fermée.' using errcode = 'P0001';
  end if;
  if pour is null or contre is null or pour not between 0 and 99 or contre not between 0 and 99 then
    raise exception 'Score invalide.' using errcode = '22023';
  end if;
  select r.* into mien from public.equipe_resultats r where r.defi_id = d and r.equipe_id = e;
  select r.* into autre from public.equipe_resultats r where r.defi_id = d and r.equipe_id <> e;
  -- Déjà validé : les deux saisies collent, ou l'une est seule depuis 24 h.
  if (mien.defi_id is not null and autre.defi_id is not null and mien.pour = autre.contre and mien.contre = autre.pour)
     or (mien.defi_id is null and autre.defi_id is not null and autre.saisi_le < now() - interval '24 hours')
     or (mien.defi_id is not null and autre.defi_id is null and mien.saisi_le < now() - interval '24 hours') then
    raise exception 'Ce résultat est validé.' using errcode = 'P0001';
  end if;
  if lignes is not null and jsonb_typeof(lignes) <> 'array' then
    raise exception 'Feuille invalide.' using errcode = '22023';
  end if;
  for l in select * from jsonb_to_recordset(coalesce(lignes, '[]'::jsonb)) as t(joueur uuid, buts int, passes int) loop
    if l.joueur is null or coalesce(l.buts, 0) not between 0 and 99 or coalesce(l.passes, 0) not between 0 and 99 then
      raise exception 'Feuille invalide.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.equipe_membres m where m.equipe_id = e and m.joueur = l.joueur and m.statut = 'membre') then
      raise exception 'Seuls les joueurs de l''équipe marquent pour elle.' using errcode = 'P0001';
    end if;
    tb := tb + coalesce(l.buts, 0);
    tp := tp + coalesce(l.passes, 0);
  end loop;
  if tb > pour then
    raise exception 'Plus de buts attribués que de buts marqués.' using errcode = 'P0001';
  end if;
  if tp > tb then
    raise exception 'Plus de passes décisives que de buts attribués.' using errcode = 'P0001';
  end if;
  insert into public.equipe_resultats (defi_id, equipe_id, pour, contre, saisi_par)
  values (d, e, equipe_resultat.pour, equipe_resultat.contre, (select auth.uid()))
  on conflict (defi_id, equipe_id) do update
    set pour = excluded.pour, contre = excluded.contre, saisi_par = excluded.saisi_par, saisi_le = now(), notifie_le = null;
  delete from public.equipe_resultat_joueurs j where j.defi_id = d and j.equipe_id = e;
  insert into public.equipe_resultat_joueurs (defi_id, equipe_id, joueur, buts, passes)
  select d, e, t.joueur, sum(coalesce(t.buts, 0)), sum(coalesce(t.passes, 0))
    from jsonb_to_recordset(coalesce(lignes, '[]'::jsonb)) as t(joueur uuid, buts int, passes int)
   group by t.joueur
  having sum(coalesce(t.buts, 0)) + sum(coalesce(t.passes, 0)) > 0;
end;
$$;

-- Le capitaine prévenu de la saisie de l'autre (motif 'equipe-resultat',
-- rattachée au match) : sa propre saisie, c'est la réponse attendue.
create or replace function public.push_effet_resultat()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform public.push_effet(new.saisi_par, array['equipe-resultat'], 'defi:' || new.defi_id, 'accepte', interval '72 hours');
  exception when others then
    raise warning 'push_effet_resultat : %', sqlerrm;
  end;
  return null;
end;
$$;
revoke execute on function public.push_effet_resultat() from public, anon, authenticated;
drop trigger if exists equipe_resultats_push_effet on public.equipe_resultats;
create trigger equipe_resultats_push_effet
  after insert or update of pour, contre on public.equipe_resultats
  for each row execute function public.push_effet_resultat();

-- La couverture de la page d'une équipe (Sabri, 24/10 : « un profil
-- d'équipe qui peut accueillir une couverture faite justement en IA aussi,
-- avec les joueurs présents de cette équipe, leur maillot et leur blason »).
-- Le capitaine (ou le vice) la crée (/api/equipes/couverture : les photos
-- de carte, le maillot et l'écusson partent chez fal.ai, comme au studio),
-- la voit, puis la pose : l'image dans le bucket public « couvertures »
-- (<id de l'équipe>.jpg), sa date dans couverture_le, qui en est la
-- version. Sans date, l'app dessine la couverture aux couleurs du maillot.
-- Le crédit fal est celui de Sabri : 2 créations par équipe et par jour
-- (heure de Paris), notées avant l'appel dans equipe_couvertures. Sur
-- l'image, seuls les joueurs qui ont signé le Règlement Team version 2, dont
-- le neuvième point le prévoit ; et un joueur qui quitte l'équipe (départ,
-- exclusion) emporte la couverture : sa date retombe.
alter table public.equipes add column if not exists couverture_le timestamptz;

create table if not exists public.equipe_couvertures (
  id          bigint generated always as identity primary key,
  equipe_id   bigint not null references public.equipes(id) on delete cascade,
  user_id     uuid   not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists equipe_couvertures_equipe_date on public.equipe_couvertures (equipe_id, created_at desc);
alter table public.equipe_couvertures enable row level security;
revoke all on public.equipe_couvertures from anon, authenticated;
grant select, insert on public.equipe_couvertures to authenticated;

drop policy if exists "equipe_couvertures: les dirigeants lisent" on public.equipe_couvertures;
create policy "equipe_couvertures: les dirigeants lisent" on public.equipe_couvertures for select to authenticated
  using (coalesce(public.role_equipe(equipe_id), 'membre') <> 'membre' or (select public.is_league_admin()));
drop policy if exists "equipe_couvertures: les dirigeants notent" on public.equipe_couvertures;
create policy "equipe_couvertures: les dirigeants notent" on public.equipe_couvertures for insert to authenticated
  with check (user_id = (select auth.uid()) and coalesce(public.role_equipe(equipe_id), 'membre') <> 'membre');

create or replace function public.equipe_couverture_credit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  faites int;
begin
  -- Jusqu'à la fin de la transaction : la demande suivante pour la même
  -- équipe attend celle-ci, puis la compte.
  perform pg_advisory_xact_lock(hashtextextended('credit:couverture:' || new.equipe_id::text, 0));
  select count(*) into faites from public.equipe_couvertures
   where equipe_id = new.equipe_id
     and created_at >= (date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris');
  if faites >= 2 then
    raise exception 'Crédit du jour épuisé.' using errcode = 'P0001', hint = 'credit-du-jour';
  end if;
  return new;
end;
$$;
revoke execute on function public.equipe_couverture_credit() from public, anon, authenticated;
drop trigger if exists equipe_couvertures_credit on public.equipe_couvertures;
create trigger equipe_couvertures_credit before insert on public.equipe_couvertures
  for each row execute function public.equipe_couverture_credit();

-- Poser (posee) ou retirer la couverture : capitaine et vice.
create or replace function public.equipe_couverture(e bigint, posee boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(public.role_equipe(e), 'membre') = 'membre' then
    raise exception 'Réservé au capitaine.' using errcode = '42501';
  end if;
  update public.equipes x
     set couverture_le = case when posee then now() end
   where x.id = e and x.dissoute_le is null;
end;
$$;

create or replace function public.equipe_couverture_depart()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.statut = 'membre' and (tg_op = 'DELETE' or new.statut is distinct from 'membre') then
    update public.equipes x set couverture_le = null
     where x.id = old.equipe_id and x.couverture_le is not null;
  end if;
  return null;
end;
$$;
revoke execute on function public.equipe_couverture_depart() from public, anon, authenticated;
drop trigger if exists equipe_membres_couverture on public.equipe_membres;
create trigger equipe_membres_couverture
  after update of statut or delete on public.equipe_membres
  for each row execute function public.equipe_couverture_depart();

-- L'équipe que nomme un fichier du bucket (« 12.jpg ») ; null sinon.
create or replace function public.couverture_cle_equipe(cle text)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when cle ~ '^[0-9]{1,18}\.jpg$' then split_part(cle, '.', 1)::bigint end;
$$;
revoke execute on function public.couverture_cle_equipe(text) from public, anon;
grant execute on function public.couverture_cle_equipe(text) to authenticated;

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('couvertures', 'couvertures', true, 3145728, array['image/jpeg'])
  on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when others then raise warning 'couvertures : bucket non créé (%)', sqlerrm;
end;
$$;

do $$
begin
  drop policy if exists "couvertures: lecture ligue" on storage.objects;
  create policy "couvertures: lecture ligue"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'couvertures' and (select public.est_membre()));

  drop policy if exists "couvertures: les dirigeants posent" on storage.objects;
  create policy "couvertures: les dirigeants posent"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'couvertures'
      and coalesce(public.role_equipe(public.couverture_cle_equipe(name)), 'membre') <> 'membre'
    );

  drop policy if exists "couvertures: les dirigeants remplacent" on storage.objects;
  create policy "couvertures: les dirigeants remplacent"
    on storage.objects for update
    to authenticated
    using (
      bucket_id = 'couvertures'
      and coalesce(public.role_equipe(public.couverture_cle_equipe(name)), 'membre') <> 'membre'
    )
    with check (
      bucket_id = 'couvertures'
      and coalesce(public.role_equipe(public.couverture_cle_equipe(name)), 'membre') <> 'membre'
    );
exception
  when others then raise warning 'couvertures : règles Storage non posées (%)', sqlerrm;
end;
$$;

revoke execute on function public.equipe_blason(bigint, jsonb), public.equipe_signer_charte(bigint),
  public.equipe_resultat(bigint, int, int, jsonb), public.equipe_couverture(bigint, boolean) from public, anon;
grant execute on function public.equipe_blason(bigint, jsonb), public.equipe_signer_charte(bigint),
  public.equipe_resultat(bigint, int, int, jsonb), public.equipe_couverture(bigint, boolean) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.equipe_resultats;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

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
  famille     text not null,
  created_at  timestamptz not null default now(),
  constraint felicitations_pas_soi check (de <> a),
  constraint felicitations_une_fois unique (de, a, exploit),
  constraint felicitations_cle check (exploit like saison::text || '-' || j::text || '-' || famille || '-_%')
);
create index if not exists felicitations_a on public.felicitations (a, exploit);
-- Les familles d'exploits (lib/sfl/exploits.ts). 26/10 : les titres de
-- match élus (Joueur Impact, Défensive) et les podiums du jour (buteurs,
-- passeurs) s'ajoutent à l'homme du dimanche.
alter table public.felicitations drop constraint if exists felicitations_famille_check;
alter table public.felicitations add constraint felicitations_famille_check
  check (famille in ('mvp', 'impact', 'def', 'chiffre', 'buteur', 'passeur', 'duo', 'montent', 'badge', 'equipe'));

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

-- ─────────────────────── Les recrues et leurs paliers ───────────────────────
-- Sabri, 27/10/2026 : une recrue (un filleul de parrainages) ne compte qu'une
-- fois qu'il a VRAIMENT joué son premier match après la création de son
-- compte. Jamais de limite au nombre de liens partagés ni de recrues. Par
-- recrue active, le parrain gagne 100 XP (lib/sfl/recrues.ts, hors du rang) ;
-- à 3, le skin Recruteur ; à 5, le Filigrane ; à 10, la carte Fondateur,
-- numérotée sur 500 dans l'ordre où chacun atteint 10, jamais réémise.
--
-- « Vraiment joué » : une ligne de feuille validée, pas une inscription. La
-- PWA n'a pas de check-in ; la présence se lit donc :
--   · match Bola : la feuille saisie (saisi_le et les deux scores), le joueur
--     chez les Clairs ou les Foncés (pas « absent ») ;
--   · journée SFL : statut « Présent », résultat saisi, pas d'extra time
--     (saison en cours et archives), comme noter_arbitre plus bas.
-- Les défis Bola Team ne gardent que les buteurs et les passeurs : on ne peut
-- pas y prouver qui était là, ils ne comptent pas (pour l'instant).
-- Le match compte s'il réunit au moins 4 présents distincts qui ne sont pas
-- tous les filleuls d'un même parrain. Un compte supprimé (cascade), un
-- parrain supprimé, un filleul non validé ou un code coupé : pas de recrue.

-- Une étiquette de journée (« 26 oct. », « 4 juil. », « 3 févr. », écrite par
-- toLocaleDateString, sans année) en date. L'année est celle de la référence
-- (maintenant, ou la clôture d'une saison archivée), moins un si la date
-- tomberait plus d'une semaine après elle. Illisible : null.
create or replace function public.date_de_journee(etiquette text, ref timestamptz)
returns date
language plpgsql
stable
set search_path = ''
as $$
declare
  t text := translate(lower(btrim(coalesce(etiquette, ''))), 'éèêëûùôîïàâç', 'eeeeuuoiiaac');
  d int;
  m int;
  y int;
  r date;
begin
  if ref is null or t = '' then
    return null;
  end if;
  if t ~ '^\d{4}-\d{2}-\d{2}' then
    y := substring(t from 1 for 4)::int;
    m := substring(t from 6 for 2)::int;
    d := substring(t from 9 for 2)::int;
    if m not between 1 and 12 or d < 1
       or d > extract(day from (make_date(y, m, 1) + interval '1 month' - interval '1 day'))::int then
      return null;
    end if;
    return make_date(y, m, d);
  end if;
  d := substring(t from '(\d{1,2})')::int;
  -- Quatre lettres au moins pour juin et juillet.
  m := case
         when t ~ 'janv' then 1 when t ~ 'fev' then 2 when t ~ 'mars' then 3
         when t ~ 'avr' then 4 when t ~ 'mai' then 5 when t ~ 'juin' then 6
         when t ~ 'juil' then 7 when t ~ 'aou' then 8 when t ~ 'sep' then 9
         when t ~ 'oct' then 10 when t ~ 'nov' then 11 when t ~ 'dec' then 12
       end;
  if d is null or m is null or d < 1 then
    return null;
  end if;
  y := extract(year from (ref at time zone 'Europe/Paris'))::int;
  -- Un 31 dans un mois de 30 jours, un 29 février hors bissextile : null,
  -- vérifié avant make_date (pas de bloc d'exception : une sous-transaction
  -- par appel, et il y en a un par ligne de journée).
  if d > extract(day from (make_date(y, m, 1) + interval '1 month' - interval '1 day'))::int then
    return null;
  end if;
  r := make_date(y, m, d);
  if r > (ref at time zone 'Europe/Paris')::date + 7 then
    if d > extract(day from (make_date(y - 1, m, 1) + interval '1 month' - interval '1 day'))::int then
      return null;
    end if;
    r := make_date(y - 1, m, d);
  end if;
  return r;
end;
$$;
revoke execute on function public.date_de_journee(text, timestamptz) from public, anon, authenticated;

-- Qui a lui-même pris sa place dans un match Bola (place libre d'un match
-- public, ou son invitation acceptée) : accepte_le, l'heure où il s'est
-- inscrit de son fait ; posée par le trigger, jamais par le client.
-- L'organisateur écrit seul la feuille, et pouvait inscrire n'importe qui :
-- un parrain créait un match passé, y mettait ses filleuls et un
-- « non-filleul » qui n'avait rien accepté, saisissait le score et les
-- activait tous d'un coup. Les présences des recrues (presences_reelles) ne
-- comptent donc, en Bola, que l'organisateur et ceux qui ont accepté. Les lignes déjà inscrites avant la règle (27/10) en
-- reprennent leur date de création : personne n'avait de quoi tricher avant.
alter table public.match_joueurs add column if not exists accepte_le timestamptz;
update public.match_joueurs
   set accepte_le = created_at
 where accepte_le is null
   and statut = 'inscrit'
   and created_at < timestamptz '2026-10-28 00:00:00+01';

create or replace function public.match_joueur_accepte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut <> 'inscrit' then
    new.accepte_le := null;
  elsif tg_op = 'UPDATE' and old.accepte_le is not null and old.statut = 'inscrit' then
    new.accepte_le := old.accepte_le;
  elsif new.player_id = (select auth.uid())
        and (tg_op = 'INSERT' or old.statut is distinct from 'inscrit') then
    new.accepte_le := now();
  elsif tg_op = 'UPDATE' then
    new.accepte_le := old.accepte_le;
  else
    new.accepte_le := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.match_joueur_accepte() from public, anon, authenticated;

drop trigger if exists match_joueurs_accepte on public.match_joueurs;
create trigger match_joueurs_accepte before insert or update on public.match_joueurs
  for each row execute function public.match_joueur_accepte();

-- Un match naît sans feuille : le score se saisit ensuite (match_feuille_gardee
-- date la première saisie). On créait un match déjà joué, score et saisi_le
-- compris, en une seule requête. Le serveur (clé secrète) et l'admin passent.
create or replace function public.match_naissance_gardee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.is_league_admin() then
    return new;
  end if;
  new.score_clairs := null;
  new.score_fonces := null;
  new.saisi_le := null;
  -- Un match né après le 28/10/2026 passe par la confirmation des joueurs.
  new.feuille_version := 0;
  new.confirmation_requise := true;
  return new;
end;
$$;
revoke execute on function public.match_naissance_gardee() from public, anon, authenticated;

drop trigger if exists matchs_naissance on public.matchs;
create trigger matchs_naissance before insert on public.matchs
  for each row execute function public.match_naissance_gardee();

-- Un nombre ou un instant lu dans le document saison, sans jamais casser : une
-- valeur mal formée donne null (avant, un seul cast raté faisait tomber les
-- quatre fonctions des recrues, parrainage_suivi de l'admin compris).
create or replace function public.entier_sur(x text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when x ~ '^\s*-?\d{1,9}\s*$' then btrim(x)::int end;
$$;
create or replace function public.instant_sur(x text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if x is null or x !~ '^\s*\d{4}-\d{2}-\d{2}' then
    return null;
  end if;
  return x::timestamptz;
exception when others then
  return null;
end;
$$;
revoke execute on function public.entier_sur(text), public.instant_sur(text) from public, anon, authenticated;

-- Les présences réelles, tous matchs : une ligne par (match, joueur présent).
--   · cle : « m:<id> » pour un match Bola ; en SFL, « j:c:<journée> » pour la
--     saison en cours, « j:a<rang>:<journée> » pour la rang-ième archive (un
--     rang, pas son numéro : deux archives sans numéro ne se mêlent pas) ;
--   · joueur : le compte ; null pour un nom de l'effectif sans compte
--     (présent, filleul de personne) ;
--   · quand : le coup d'envoi (Bola), ou le jour de la journée à minuit,
--     heure de Paris (SFL) ; jour_seul : seulement le jour est connu.
-- Bola : l'organisateur, ou un inscrit de son fait (accepte_le : pas une
-- invitation, ni une inscription posée par l'organisateur), chez les Clairs
-- ou les Foncés, la feuille saisie après le coup d'envoi. Brique interne des
-- fonctions ci-dessous : personne ne l'appelle.
drop function if exists public.presences_reelles();
create function public.presences_reelles()
returns table (cle text, joueur uuid, nom text, quand timestamptz, jour_seul boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select b.cle, b.joueur, b.nom, b.quand, b.jour_seul
    from (
      select 'm:' || m.id as cle, mj.player_id as joueur, p.name as nom,
             case
               when m.heure ~ '^\s*\d{1,2}\s*([:hH]\s*\d{0,2})?\s*$'
                 then (m.jour + make_interval(
                         hours => substring(m.heure from '^\s*(\d{1,2})')::int,
                         mins => coalesce(substring(m.heure from '[:hH]\s*(\d{2})')::int, 0)
                       )) at time zone 'Europe/Paris'
               else m.jour::timestamp at time zone 'Europe/Paris'
             end as quand,
             m.heure !~ '^\s*\d{1,2}\s*([:hH]\s*\d{0,2})?\s*$' as jour_seul,
             m.saisi_le
        from public.matchs m
        join public.match_joueurs mj
          on mj.match_id = m.id
         and mj.statut = 'inscrit'
         and mj.equipe in ('clairs', 'fonces')
         and (mj.accepte_le is not null or mj.player_id = m.organisateur)
        join public.profiles p on p.id = mj.player_id
       where m.mode = 'bola'
         and m.saisi_le is not null
         and m.score_clairs is not null
         and m.score_fonces is not null
    ) b
   where b.saisi_le >= b.quand
  union all
  select 'j:' || sa.tag || ':' || (e ->> 'j'), p.id, e ->> 'player',
         public.date_de_journee(jj.meta ->> 'date', sa.ref)::timestamp at time zone 'Europe/Paris',
         true
    from public.saison s
    cross join lateral (
      select 'c' as tag, now() as ref,
             s.data -> 'entries' as entries, s.data -> 'journees' as journees
      union all
      select 'a' || a.rang, coalesce(public.instant_sur(a.x ->> 'cloturee'), now()),
             a.x -> 'entries', a.x -> 'journees'
        from jsonb_array_elements(case when jsonb_typeof(s.data -> 'archives') = 'array' then s.data -> 'archives' else '[]'::jsonb end)
             with ordinality as a(x, rang)
    ) sa
    cross join lateral jsonb_array_elements(case when jsonb_typeof(sa.entries) = 'array' then sa.entries else '[]'::jsonb end) e
    join lateral (
      select x as meta
        from jsonb_array_elements(case when jsonb_typeof(sa.journees) = 'array' then sa.journees else '[]'::jsonb end) x
       where (x ->> 'j') = (e ->> 'j')
       limit 1
    ) jj on true
    left join public.profiles p on lower(p.name) = lower(e ->> 'player')
   where s.id = 1
     -- Une journée en brouillon n'est pas encore jouée pour la ligue (30/10/2026).
     and not public.est_brouillon(jj.meta)
     and e ->> 'statut' = 'Présent'
     and coalesce(e ->> 'result', '') <> ''
     and lower(coalesce(e ->> 'extraTime', 'false')) not in ('true', '1');
$$;
revoke execute on function public.presences_reelles() from public, anon, authenticated;

-- Chaque filleul et son premier vrai match après la création de son compte
-- (null : pas encore). Au jour près pour une journée SFL (elle n'a que son
-- jour), au coup d'envoi près pour un match Bola. Quel que soit l'état du
-- code ou du parrain : c'est ce que lit l'admin (parrainage_suivi) ; les
-- paliers, eux, passent par recrues(). Brique interne.
create or replace function public.premiers_matchs()
returns table (filleul uuid, parrain uuid, code text, inscrit_le timestamptz, joue_le timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  with pr as materialized (
    select * from public.presences_reelles()
  ),
  valides as (
    -- Au moins 4 présents distincts, pas tous filleuls d'un même parrain : un
    -- présent qui n'est le filleul de personne (le parrain lui-même, un joueur
    -- sans compte) suffit, ou des filleuls de deux parrains. Un filleul dont
    -- le parrain est parti n'est pas un « non-filleul ».
    select pr.cle
      from pr
      left join public.parrainages x on x.filleul = pr.joueur
     group by pr.cle
    having count(distinct coalesce(pr.joueur::text, 'n:' || lower(pr.nom))) >= 4
       and (count(*) filter (where x.filleul is null) > 0 or count(distinct x.parrain) > 1)
  ),
  joues as (
    select pr.joueur, pr.quand, pr.jour_seul
      from pr
      join valides v on v.cle = pr.cle
     where pr.joueur is not null
       and pr.quand <= now()
  )
  select pa.filleul, pa.parrain, pa.code, pa.created_at, min(j.quand)
    from public.parrainages pa
    left join joues j
      on j.joueur = pa.filleul
     and j.quand >= case
                      when j.jour_seul
                        then date_trunc('day', pa.created_at at time zone 'Europe/Paris') at time zone 'Europe/Paris'
                      else pa.created_at
                    end
   group by pa.filleul, pa.parrain, pa.code, pa.created_at;
$$;
revoke execute on function public.premiers_matchs() from public, anon, authenticated;

-- Les filleuls de chaque parrain, et s'ils comptent pour ses paliers
-- (compte) : parrain et filleul existants et validés, code ni coupé (le code
-- utilisé ; pour le lien d'une équipe, qui n'en porte pas toujours, celui du
-- parrain). active_le : son premier vrai match, null tant qu'il n'a pas joué.
-- Les paliers ne lisent que compte ; mes_recrues montre aussi les autres, en
-- attente. Brique interne.
drop function if exists public.recrues();
create function public.recrues()
returns table (parrain uuid, filleul uuid, nom text, inscrit_le timestamptz, active_le timestamptz, compte boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select pm.parrain, pm.filleul, f.name, pm.inscrit_le, pm.joue_le,
         f.valide
         and pp.valide
         and coalesce(
               (select c.actif from public.parrainage_codes c where c.code = pm.code),
               (select c.actif from public.parrainage_codes c where c.joueur = pm.parrain),
               true
             )
    from public.premiers_matchs() pm
    join public.profiles f on f.id = pm.filleul
    join public.profiles pp on pp.id = pm.parrain;
$$;
revoke execute on function public.recrues() from public, anon, authenticated;

-- Les Fondateurs : n° 1 à 500, dans l'ordre où chacun atteint 10 recrues
-- actives (atteint : sa dixième). Jamais renumérotés ni réémis : un compte
-- supprimé laisse son numéro vide (joueur à null), la ligne reste, et le
-- numéro suivant part toujours du plus haut posé. Au-delà de 500, fermé.
-- Lu par la ligue (la carte d'un autre montre son numéro) ; écrit seulement
-- par fondateurs_attribuer.
create table if not exists public.fondateurs (
  numero   smallint primary key check (numero between 1 and 500),
  joueur   uuid unique references public.profiles(id) on delete set null,
  atteint  timestamptz not null,
  le       timestamptz not null default now()
);
alter table public.fondateurs enable row level security;
drop policy if exists "fondateurs: lecture ligue" on public.fondateurs;
create policy "fondateurs: lecture ligue" on public.fondateurs for select to authenticated
  using ((select public.est_membre()));
revoke all on public.fondateurs from anon, authenticated;
grant select on public.fondateurs to authenticated;

-- Pose les numéros de ceux qui ont passé 10 recrues actives sans en avoir
-- encore, dans l'ordre de leur dixième. Appelée par l'app (à l'ouverture
-- d'Inviter, en production) et par le cron du lundi ; ne touche jamais un
-- numéro déjà posé. Le calcul des recrues est lourd : il ne se fait que si
-- quelqu'un sans numéro a au moins 10 filleuls (un simple compte), et hors du
-- verrou ; sous le verrou, seulement l'écriture, et deux appels en même temps
-- ne prennent pas le même numéro.
create or replace function public.fondateurs_attribuer()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  qui uuid[];
  quand timestamptz[];
  n int;
begin
  -- Sans session : le cron (connexion directe). Avec : un membre seulement.
  if (select auth.uid()) is not null and not public.est_membre() then
    return;
  end if;
  if (select coalesce(max(f.numero), 0) from public.fondateurs f) >= 500 then
    return;
  end if;
  if not exists (
    select 1
      from public.parrainages pa
     where pa.parrain is not null
       and not exists (select 1 from public.fondateurs f where f.joueur = pa.parrain)
     group by pa.parrain
    having count(*) >= 10
  ) then
    return;
  end if;
  select array_agg(c.parrain order by c.dixieme, c.parrain), array_agg(c.dixieme order by c.dixieme, c.parrain)
    into qui, quand
    from (
      select r.parrain, (array_agg(r.active_le order by r.active_le))[10] as dixieme
        from public.recrues() r
       where r.compte
         and r.active_le is not null
         and not exists (select 1 from public.fondateurs f where f.joueur = r.parrain)
       group by r.parrain
      having count(*) >= 10
    ) c;
  if qui is null then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('bola.fondateurs'));
  for i in 1 .. array_length(qui, 1) loop
    -- Numéroté entre-temps par un autre appel : on passe.
    continue when exists (select 1 from public.fondateurs f where f.joueur = qui[i]);
    select coalesce(max(f.numero), 0) + 1 into n from public.fondateurs f;
    exit when n > 500;
    insert into public.fondateurs (numero, joueur, atteint) values (n, qui[i], quand[i]);
  end loop;
end;
$$;

-- La ligue (XP, skins et cartes de chacun) : par parrain, le nombre de
-- recrues actives, la date de chaque activation et son numéro de Fondateur.
-- Sans un nom de filleul : qui a fait venir qui reste entre eux.
create or replace function public.recrues_de_la_ligue()
returns table (joueur uuid, nom text, actives int, activations timestamptz[], fondateur smallint)
language sql
security definer
set search_path = ''
stable
as $$
  with r as (
    select x.parrain,
           count(x.active_le)::int as n,
           array_agg(x.active_le order by x.active_le) filter (where x.active_le is not null) as a
      from public.recrues() x
     where x.compte
     group by x.parrain
  )
  select p.id, p.name, coalesce(r.n, 0), coalesce(r.a, '{}'::timestamptz[]), fo.numero
    from public.profiles p
    left join r on r.parrain = p.id
    left join public.fondateurs fo on fo.joueur = p.id
   where (select public.est_membre())
     and (r.n > 0 or fo.numero is not null);
$$;

-- Mes filleuls, nom par nom : depuis quand il joue (active_le), ou en attente
-- (null) ; compte : il compte pour mes paliers. Un filleul pas encore validé,
-- ou venu par un code coupé, reste dans la liste (en attente sur Inviter),
-- sans compter.
drop function if exists public.mes_recrues();
create function public.mes_recrues()
returns table (filleul uuid, nom text, inscrit_le timestamptz, active_le timestamptz, compte boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select r.filleul, r.nom, r.inscrit_le, r.active_le, r.compte
    from public.recrues() r
   where r.parrain = (select auth.uid())
     and (select public.est_membre())
   order by r.active_le desc nulls first, r.inscrit_le desc;
$$;

revoke execute on function public.fondateurs_attribuer(), public.recrues_de_la_ligue(), public.mes_recrues() from public, anon;
grant execute on function public.fondateurs_attribuer(), public.recrues_de_la_ligue(), public.mes_recrues() to authenticated;

-- Le bas du tunnel, pour l'admin (Activité → Parrainage) : chaque filleul
-- a-t-il vraiment joué (la règle des recrues : une ligne de feuille validée
-- après son inscription, dans un match de 4 présents au moins qui ne sont pas
-- tous ses frères de parrain), et rejoint une équipe Bola Team ? Avant le
-- 27/10, une simple inscription à un match passé suffisait. Vide pour tout
-- autre compte.
create or replace function public.parrainage_suivi()
returns table (filleul uuid, a_joue boolean, en_equipe boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select pm.filleul,
         pm.joue_le is not null,
         exists (select 1 from public.equipe_membres em where em.joueur = pm.filleul and em.statut = 'membre')
    from public.premiers_matchs() pm
   where (select public.is_league_admin());
$$;

revoke execute on function public.mon_code_parrain(), public.parrain_info(text), public.parrainage_vu(text, text, text),
  public.parrainage_code_actif(text, boolean), public.parrainage_ma_carte(text, jsonb), public.parrainage_partage(),
  public.parrainage_suivi()
  from public, anon;
grant execute on function public.mon_code_parrain(), public.parrainage_code_actif(text, boolean),
  public.parrainage_ma_carte(text, jsonb), public.parrainage_partage(), public.parrainage_suivi() to authenticated;
grant execute on function public.parrain_info(text), public.parrainage_vu(text, text, text) to anon, authenticated;

-- Un joueur Bola (Sabri, 26/10 : « utilisateur Bola qui n'est pas à la SFL :
-- le côté SFL doit lui être invisible ») : venu par un parrain, pas dans
-- l'effectif de la saison, pas admin. L'app lui cache la SFL (la Map sans les
-- journées, les Actus sur Bola ; hooks/use-hors-sfl.ts). Un compte accepté
-- par l'admin sans parrain reste comme avant.
create or replace function public.hors_sfl()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.parrainages x where x.filleul = (select auth.uid()))
     and not public.joueur_sfl((select auth.uid()))
     and not (select public.is_league_admin());
$$;
revoke execute on function public.hors_sfl() from public, anon;
grant execute on function public.hors_sfl() to authenticated;

-- La carte, l'XP et les missions d'un joueur Bola (Sabri, 28/10/2026 : « leur
-- carte s'actualise à chaque match », « Pareil pour xp etc ») : rien n'est
-- stocké, l'app les recalcule (lib/sfl/carte-bola.ts, missions-perso.ts) à
-- partir de ses matchs Bola saisis, lus ici.
--
-- L'entrée en SFL d'un filleul : le jour où son nom entre dans l'effectif
-- de la saison. Ce qu'il a gagné avant (XP, missions, cartes MVP) lui reste ;
-- ses matchs Bola d'après ne lui rapportent plus rien de Bola, et ses stats
-- Bola n'entrent jamais dans la saison SFL (choix par défaut, 28/10). Écrite
-- par le déclencheur ci-dessous seulement ; chacun lit la sienne.
create table if not exists public.entrees_sfl (
  joueur uuid primary key references public.profiles(id) on delete cascade,
  le     timestamptz not null default now()
);
alter table public.entrees_sfl enable row level security;
drop policy if exists "entrees_sfl: la mienne" on public.entrees_sfl;
create policy "entrees_sfl: la mienne"
  on public.entrees_sfl for select
  to authenticated
  using (joueur = (select auth.uid()));
revoke all on public.entrees_sfl from anon, authenticated;
grant select on public.entrees_sfl to authenticated;

-- Le nom d'un filleul est-il dans cet effectif ? Sans tenir compte de la
-- casse ni des espaces autour, comme l'app (memeNom, season-provider.tsx) :
-- « Nassim B » dans l'effectif et « nassim b » au profil, c'est lui.
create or replace function public.nom_dans_effectif(roster jsonb, nom text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(roster, '[]'::jsonb)) r
     where lower(btrim(r ->> 'name')) = lower(btrim(nom))
  );
$$;
revoke execute on function public.nom_dans_effectif(jsonb, text) from public, anon, authenticated;

-- Une seule fois (etapes_uniques) : les filleuls déjà dans l'effectif avant
-- cette règle sont entrés le jour de leur inscription (aucun match Bola
-- d'avant ne leur est rendu). Rejouée à chaque déploiement, elle aurait daté
-- de son inscription un filleul entré plus tard sans que le déclencheur le
-- voie, et lui aurait retiré après coup son XP Bola (revue, 28/10).
do $$
begin
  if not exists (select 1 from public.etapes_uniques where etape = 'entrees-sfl-2026-10') then
    insert into public.entrees_sfl (joueur, le)
    select x.filleul, x.created_at
      from public.parrainages x
      join public.profiles p on p.id = x.filleul
      join public.saison s on s.id = 1
     where public.nom_dans_effectif(s.data -> 'roster', p.name)
    on conflict (joueur) do nothing;
    insert into public.etapes_uniques (etape) values ('entrees-sfl-2026-10');
  end if;
end;
$$;

-- Ensuite, à chaque déploiement : un filleul que le déclencheur n'a pas vu
-- entrer (son nom de profil corrigé pour coller à l'effectif) est noté entré
-- maintenant ; une date déjà posée ne bouge jamais.
insert into public.entrees_sfl (joueur, le)
select x.filleul, now()
  from public.parrainages x
  join public.profiles p on p.id = x.filleul
  join public.saison s on s.id = 1
 where public.nom_dans_effectif(s.data -> 'roster', p.name)
on conflict (joueur) do nothing;

create or replace function public.noter_entrees_sfl()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.entrees_sfl (joueur, le)
  select x.filleul, now()
    from public.parrainages x
    join public.profiles p on p.id = x.filleul
   where public.nom_dans_effectif(new.data -> 'roster', p.name)
     and (tg_op = 'INSERT' or not public.nom_dans_effectif(old.data -> 'roster', p.name))
  on conflict (joueur) do nothing;
  return null;
end;
$$;
revoke execute on function public.noter_entrees_sfl() from public, anon, authenticated;

drop trigger if exists saison_entrees_sfl on public.saison;
create trigger saison_entrees_sfl
  after insert or update of data on public.saison
  for each row execute function public.noter_entrees_sfl();

-- La Ligue vierge lit tous les matchs Bola joués, privés compris : seulement
-- le jour, l'heure et qui a fait quoi — ni le lieu, ni les invités. Pour les
-- membres seulement : un compte en attente reçoit une liste vide. Avec le
-- poste de la fiche de chacun (28/10/2026) : la carte d'un joueur Bola, hors
-- de la SFL, le montrait en « — ». Depuis le 28/10/2026, l'état de chaque
-- match (etat : compte, en_attente, conteste, ne_compte_pas ; voir plus
-- haut) : le moteur (lib/sfl/ligue-vierge.ts) ne compte que « compte ». Et
-- dans un match à confirmer, un joueur mis sur la feuille sans avoir jamais
-- accepté de lui-même (accepte_le), ou dont le compte attend sa validation,
-- n'y paraît que s'il a confirmé (choix par défaut, 28/10) : sinon
-- l'organisateur remplissait le quorum avec des joueurs qui n'avaient rien dit.
-- Un match Bola saisi, tel que la Ligue vierge et mes_matchs_bola le lisent
-- (28/10/2026, carte des joueurs Bola) : la même brique pour les deux, pour
-- que la carte d'un joueur Bola et le classement ne divergent jamais. Interne.
-- Posée ici, après parrainages et entrees_sfl qu'elle lit (carteBola) : sur
-- une base neuve, une fonction sql ne se crée pas avant ses tables.
create or replace function public.match_bola_json(mid bigint)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
           'id', m.id,
           'jour', m.jour,
           'heure', m.heure,
           'genre', m.genre,
           'scoreClairs', m.score_clairs,
           'scoreFonces', m.score_fonces,
           -- Un match saisi avant le 28/10/2026 compte sans calcul.
           'etat', case when m.confirmation_requise then public.etat_feuille(m.id) else 'compte' end,
           'requise', m.confirmation_requise,
           'joueurs', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', j.player_id, 'name', p.name, 'equipe', j.equipe, 'buts', j.buts, 'passes', j.passes,
                      'poste', f.poste,
                      -- Ce match fait-il bouger SA carte Bola ? La règle de
                      -- mes_matchs_bola : un filleul, avant son entrée en SFL.
                      'carteBola', exists (select 1 from public.parrainages x where x.filleul = j.player_id)
                                   and public.coup_d_envoi(m.jour, m.heure)
                                       < coalesce((select e.le from public.entrees_sfl e where e.joueur = j.player_id),
                                                  'infinity'::timestamptz))), '[]'::jsonb)
               from public.match_joueurs j
               join public.profiles p on p.id = j.player_id
               left join public.fiches f on f.player_id = j.player_id
              where j.match_id = m.id and j.equipe in ('clairs', 'fonces')
                and (not m.confirmation_requise
                     or j.player_id = m.organisateur
                     or (j.statut = 'inscrit' and j.accepte_le is not null and p.valide)
                     or exists (select 1 from public.match_confirmations c
                                 where c.match_id = m.id and c.joueur = j.player_id
                                   and c.version = m.feuille_version and c.reponse = 'confirme'))
           )
         )
    from public.matchs m
   where m.id = mid;
$$;
revoke execute on function public.match_bola_json(bigint) from public, anon, authenticated;

create or replace function public.ligue_vierge()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(public.match_bola_json(m.id) order by m.jour, m.heure, m.id), '[]'::jsonb)
    from public.matchs m
   where public.est_membre()
     and m.mode = 'bola' and m.saisi_le is not null
     and m.score_clairs is not null and m.score_fonces is not null;
$$;

revoke execute on function public.ligue_vierge() from public, anon;
grant execute on function public.ligue_vierge() to authenticated;

-- Mes matchs Bola saisis, au format de ligue_vierge() (match_bola_json) :
-- seulement ceux où je suis compté (la même règle que le classement), et
-- seulement pour un filleul (un joueur venu par un lien) ; jusqu'à son entrée
-- en SFL. Toute la ligne des joueurs du match vient avec : le MVP se calcule
-- sur tous (ligue_vierge les montre déjà à tout membre).
create or replace function public.mes_matchs_bola()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  with moi as (select (select auth.uid()) as id),
  lus as (
    select m.id, m.jour, m.heure, public.match_bola_json(m.id) as j
      from public.matchs m, moi
     where public.est_membre()
       and exists (select 1 from public.parrainages x where x.filleul = moi.id)
       and m.mode = 'bola' and m.saisi_le is not null
       and m.score_clairs is not null and m.score_fonces is not null
       and exists (select 1 from public.match_joueurs mj where mj.match_id = m.id and mj.player_id = moi.id)
       and public.coup_d_envoi(m.jour, m.heure)
           < coalesce((select e.le from public.entrees_sfl e where e.joueur = moi.id), 'infinity'::timestamptz)
  )
  select coalesce(jsonb_agg(l.j order by l.jour, l.heure, l.id), '[]'::jsonb)
    from lus l, moi
   where exists (select 1 from jsonb_array_elements(l.j -> 'joueurs') x where x ->> 'id' = moi.id::text);
$$;
revoke execute on function public.mes_matchs_bola() from public, anon;
grant execute on function public.mes_matchs_bola() to authenticated;

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

-- ───────────────────────── Les pronos Bola ─────────────────────────
-- Sabri, 24/10 : « que le joueur puisse pronostiquer des choses dans les
-- matchs à venir ou les journées », « qui finira meilleur buteur, qui finira
-- meilleure Pépite d'Or ». Un prono par joueur et par sujet (lib/sfl/pronos.ts) :
--   · j > 0, la journée : par match, 'match:0' (Noirs, nul ou Blancs),
--     'ecart:0' (serré, net, large), 'duel:0', 'mvp:0', 'buteur:0',
--     'passeur:0' (un nom) ; pour la journée, 'pepite', 'buteur', 'passeur' ;
--   · j = 0, la saison : 'pepite', 'buteur', 'passeur'.
-- On ne pose que pour soi, par pronostiquer() : la base met le nom (mon_nom)
-- et l'heure (now()), jamais le téléphone. L'app ne retient qu'un prono posé
-- avant le coup d'envoi, qu'elle lit dans la saison, et calcule l'XP ; rien
-- d'autre n'est stocké. Toute la ligue lit tous les pronos : ce sont les parts
-- (« 62 % pour les Noirs »).
create table if not exists public.pronos (
  saison     integer not null,
  j          integer not null check (j >= 0),
  sujet      text    not null check (sujet ~ '^((match|ecart|duel|mvp|buteur|passeur):[0-9]{1,2}|buteur|pepite|passeur)$'),
  joueur     text    not null,
  choix      text    not null check (char_length(choix) between 1 and 80),
  joueur_id  uuid    not null references public.profiles(id) on delete cascade,
  le         timestamptz not null default now(),
  primary key (saison, j, sujet, joueur)
);

-- Sabri, 31/10 : chaque match a aussi son écart, son duel, son MVP, son
-- buteur et son passeur ('mvp:0'…), et la journée son passeur.
alter table public.pronos drop constraint if exists pronos_sujet_check;
alter table public.pronos add constraint pronos_sujet_check
  check (sujet ~ '^((match|ecart|duel|mvp|buteur|passeur):[0-9]{1,2}|buteur|pepite|passeur)$');

alter table public.pronos enable row level security;

drop policy if exists "pronos: la ligue lit tout" on public.pronos;
create policy "pronos: la ligue lit tout"
  on public.pronos for select
  to authenticated
  using ((select public.est_membre()));

revoke all on public.pronos from anon, authenticated;
grant select on public.pronos to authenticated;

-- Poser un prono, ou le retirer (p_choix vide) : la seule porte d'écriture.
-- Renvoie l'heure posée.
create or replace function public.pronostiquer(
  p_saison integer,
  p_j integer,
  p_sujet text,
  p_choix text default null
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
  if p_j < 0 or p_sujet !~ '^((match|ecart|duel|mvp|buteur|passeur):[0-9]{1,2}|buteur|pepite|passeur)$'
     or (p_j = 0 and p_sujet not in ('pepite', 'buteur', 'passeur')) then
    raise exception 'Prono inconnu.' using errcode = '22023';
  end if;
  if nullif(btrim(p_choix), '') is null then
    delete from public.pronos where saison = p_saison and j = p_j and sujet = p_sujet and joueur = v_nom;
    return v_le;
  end if;
  if (p_sujet like 'match:%' and p_choix not in ('noirs', 'nul', 'blancs'))
     or (p_sujet like 'ecart:%' and p_choix not in ('serre', 'net', 'large')) then
    raise exception 'Prono inconnu.' using errcode = '22023';
  end if;
  insert into public.pronos (saison, j, sujet, joueur, choix, joueur_id, le)
  values (p_saison, p_j, p_sujet, v_nom, btrim(p_choix), (select auth.uid()), v_le)
  on conflict (saison, j, sujet, joueur) do update
    set choix = excluded.choix, joueur_id = excluded.joueur_id, le = excluded.le;
  return v_le;
end;
$$;

revoke execute on function public.pronostiquer(integer, integer, text, text) from public, anon;
grant execute on function public.pronostiquer(integer, integer, text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.pronos;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- ───────────────────────── Les vidéos de Bola ─────────────────────────
-- Sabri, 24/10 : la vidéo de la journée (« L'Entrée », J3) « dans l'actu »,
-- qu'on ne puisse ouvrir que dans l'app ; savoir combien l'ont vue ; y
-- réagir, la commenter ; la partager par un lien (Snap) qui mène à l'app,
-- où seuls ceux qui ont un compte la voient vraiment (lib/sfl/videos.ts).
--
--   · videos : une ligne par vidéo, posée par l'admin (Admin → Activité →
--     Vidéos) ; publiee_le vide = brouillon, que l'admin seul voit ;
--   · le fichier et son image d'attente dans le bucket PRIVÉ « videos »
--     (<id>/video.mp4, <id>/affiche.jpg) : aucune adresse publique. Un
--     joueur de Bola ne les lit que si la vidéo est publiée, par une
--     adresse signée qui expire (deux heures) ; l'admin seul les pose ;
--   · video_vues : qui l'a vue, combien de fois, jusqu'où (une ligne par
--     joueur, par video_vue(), seulement après son accord à la politique) ;
--   · video_reactions, video_commentaires : toute l'app les lit ; chacun
--     pose et retire les siens, l'admin retire un commentaire ;
--   · video_partages : chaque partage du lien (qui, quand) ;
--   · video_liens : les ouvertures du lien hors de l'app, sans rien de
--     personnel (un identifiant tiré au hasard sur le téléphone, comme pour
--     le parrainage), et le code de celui qui l'a partagé.
-- L'admin lit tout. Les ouvertures de liens partent après 13 mois.
create table if not exists public.videos (
  id          text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  titre       text not null check (char_length(titre) between 1 and 80),
  legende     text check (char_length(legende) <= 200),
  fichier     text not null check (char_length(fichier) <= 200),
  affiche     text check (char_length(affiche) <= 200),
  largeur     integer check (largeur between 1 and 8000),
  hauteur     integer check (hauteur between 1 and 8000),
  duree       numeric check (duree between 0 and 3600),
  publiee_le  timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.videos enable row level security;

drop policy if exists "videos: publiées pour l'app, tout pour l'admin" on public.videos;
create policy "videos: publiées pour l'app, tout pour l'admin"
  on public.videos for select to authenticated
  using (((select public.est_membre()) and publiee_le is not null and publiee_le <= now()) or (select public.is_league_admin()));

drop policy if exists "videos: l'admin pose" on public.videos;
create policy "videos: l'admin pose"
  on public.videos for insert to authenticated
  with check ((select public.is_league_admin()));

drop policy if exists "videos: l'admin change" on public.videos;
create policy "videos: l'admin change"
  on public.videos for update to authenticated
  using ((select public.is_league_admin()))
  with check ((select public.is_league_admin()));

drop policy if exists "videos: l'admin retire" on public.videos;
create policy "videos: l'admin retire"
  on public.videos for delete to authenticated
  using ((select public.is_league_admin()));

revoke all on public.videos from anon, authenticated;
grant select, insert, update, delete on public.videos to authenticated;

-- Le bucket : 50 Mo au plus par fichier (la limite du projet), vidéos et images d'attente.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('videos', 'videos', false, 52428800,
          array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/webp'])
  on conflict (id) do update
    set public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when others then raise warning 'videos : bucket non créé (%)', sqlerrm;
end;
$$;

do $$
begin
  -- La sous-requête passe par la RLS de videos : un brouillon ne se lit pas.
  drop policy if exists "videos: l'app regarde les publiées" on storage.objects;
  create policy "videos: l'app regarde les publiées"
    on storage.objects for select
    to authenticated
    using (
      bucket_id = 'videos'
      and (
        exists (select 1 from public.videos v where v.id = (storage.foldername(name))[1])
        -- L'admin lit aussi un fichier pas encore rattaché à une ligne : le
        -- dépôt (upsert) en a besoin, sinon « new row violates row-level
        -- security policy » au premier envoi (Sabri, 25/10).
        or (select public.is_league_admin())
      )
    );

  drop policy if exists "videos: l'admin pose" on storage.objects;
  create policy "videos: l'admin pose"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'videos' and (select public.is_league_admin()));

  drop policy if exists "videos: l'admin remplace" on storage.objects;
  create policy "videos: l'admin remplace"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'videos' and (select public.is_league_admin()))
    with check (bucket_id = 'videos' and (select public.is_league_admin()));

  drop policy if exists "videos: l'admin retire" on storage.objects;
  create policy "videos: l'admin retire"
    on storage.objects for delete
    to authenticated
    using (bucket_id = 'videos' and (select public.is_league_admin()));
exception
  when others then raise warning 'videos : règles Storage non posées (%)', sqlerrm;
end;
$$;

create table if not exists public.video_vues (
  video     text not null references public.videos(id) on delete cascade,
  joueur    uuid not null references public.profiles(id) on delete cascade,
  premiere  timestamptz not null default now(),
  derniere  timestamptz not null default now(),
  fois      integer not null default 1 check (fois between 0 and 100000),
  vu_s      numeric not null default 0 check (vu_s between 0 and 3600),
  fini      boolean not null default false,
  primary key (video, joueur)
);
-- Comme le journal d'usage : 13 mois au plus.
delete from public.video_vues where derniere < now() - interval '13 months';

alter table public.video_vues enable row level security;

drop policy if exists "video_vues: les miennes, l'admin" on public.video_vues;
create policy "video_vues: les miennes, l'admin"
  on public.video_vues for select to authenticated
  using (joueur = (select auth.uid()) or (select public.is_league_admin()));

revoke all on public.video_vues from anon, authenticated;
grant select on public.video_vues to authenticated;

-- Je regarde : `p_debut` à chaque lecture lancée (une nouvelle fois compte
-- s'il y a dix minutes de plus depuis la dernière), puis jusqu'où je suis
-- allé, et si je l'ai vue jusqu'au bout. Une vidéo non publiée ne compte pas.
create or replace function public.video_vue(v text, p_debut boolean, p_secondes numeric, p_fini boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s numeric := least(greatest(coalesce(p_secondes, 0), 0), 3600);
begin
  if not public.est_membre() then
    return;
  end if;
  if not exists (select 1 from public.videos x where x.id = v and x.publiee_le is not null and x.publiee_le <= now()) then
    return;
  end if;
  insert into public.video_vues (video, joueur, vu_s, fini)
  values (v, (select auth.uid()), s, coalesce(p_fini, false))
  on conflict (video, joueur) do update
    set fois = least(public.video_vues.fois
                 + case when p_debut and public.video_vues.derniere < now() - interval '10 minutes' then 1 else 0 end, 100000),
        vu_s = greatest(public.video_vues.vu_s, s),
        fini = public.video_vues.fini or coalesce(p_fini, false),
        derniere = now();
end;
$$;

create table if not exists public.video_reactions (
  video       text not null references public.videos(id) on delete cascade,
  joueur      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji       text not null check (emoji in ('🔥', '🐐', '😮', '😂', '👏')),
  created_at  timestamptz not null default now(),
  primary key (video, joueur, emoji)
);

alter table public.video_reactions enable row level security;

drop policy if exists "video_reactions: l'app lit" on public.video_reactions;
create policy "video_reactions: l'app lit"
  on public.video_reactions for select to authenticated
  using (exists (select 1 from public.videos v where v.id = video));

drop policy if exists "video_reactions: je réagis pour moi" on public.video_reactions;
create policy "video_reactions: je réagis pour moi"
  on public.video_reactions for insert to authenticated
  with check (
    joueur = (select auth.uid())
    and (select public.est_membre())
    and exists (select 1 from public.videos v where v.id = video)
  );

drop policy if exists "video_reactions: je retire la mienne" on public.video_reactions;
create policy "video_reactions: je retire la mienne"
  on public.video_reactions for delete to authenticated
  using (joueur = (select auth.uid()));

revoke all on public.video_reactions from anon, authenticated;
grant select, delete on public.video_reactions to authenticated;
grant insert (video, emoji) on public.video_reactions to authenticated;

create table if not exists public.video_commentaires (
  id          bigint generated always as identity primary key,
  video       text not null references public.videos(id) on delete cascade,
  joueur      uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  texte       text not null check (char_length(btrim(texte)) between 1 and 400),
  created_at  timestamptz not null default now()
);
create index if not exists video_commentaires_video on public.video_commentaires (video, id);

alter table public.video_commentaires enable row level security;

drop policy if exists "video_commentaires: l'app lit" on public.video_commentaires;
create policy "video_commentaires: l'app lit"
  on public.video_commentaires for select to authenticated
  using (exists (select 1 from public.videos v where v.id = video));

-- Un joueur à qui l'admin a coupé la parole au Vestiaire ne commente pas non plus.
drop policy if exists "video_commentaires: j'écris pour moi" on public.video_commentaires;
create policy "video_commentaires: j'écris pour moi"
  on public.video_commentaires for insert to authenticated
  with check (
    joueur = (select auth.uid())
    and (select public.est_membre())
    and (select public.peut_parler_au_vestiaire())
    and exists (select 1 from public.videos v where v.id = video)
  );

drop policy if exists "video_commentaires: je retire le mien, l'admin aussi" on public.video_commentaires;
create policy "video_commentaires: je retire le mien, l'admin aussi"
  on public.video_commentaires for delete to authenticated
  using (joueur = (select auth.uid()) or (select public.is_league_admin()));

revoke all on public.video_commentaires from anon, authenticated;
grant select, delete on public.video_commentaires to authenticated;
grant insert (video, texte) on public.video_commentaires to authenticated;

create table if not exists public.video_partages (
  id      bigint generated always as identity primary key,
  video   text not null references public.videos(id) on delete cascade,
  joueur  uuid not null references public.profiles(id) on delete cascade,
  le      timestamptz not null default now()
);

alter table public.video_partages enable row level security;

drop policy if exists "video_partages: l'admin" on public.video_partages;
create policy "video_partages: l'admin"
  on public.video_partages for select to authenticated
  using ((select public.is_league_admin()));

revoke all on public.video_partages from anon, authenticated;
grant select on public.video_partages to authenticated;

-- J'ai partagé (ou copié) le lien d'une vidéo publiée.
create or replace function public.video_partage(v text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.est_membre() then
    return;
  end if;
  insert into public.video_partages (video, joueur)
  select x.id, (select auth.uid()) from public.videos x
   where x.id = v and x.publiee_le is not null and x.publiee_le <= now();
end;
$$;

create table if not exists public.video_liens (
  id          bigint generated always as identity primary key,
  video       text not null references public.videos(id) on delete cascade,
  visiteur    text not null check (visiteur ~ '^[0-9a-f-]{8,40}$'),
  etape       text not null check (etape in ('ouvert', 'app')),
  de          text check (de ~ '^[a-z0-9][a-z0-9._]{2,19}$'),
  jour        date not null default ((now() at time zone 'Europe/Paris')::date),
  created_at  timestamptz not null default now(),
  constraint video_liens_une_fois unique (video, visiteur, etape)
);
delete from public.video_liens where created_at < now() - interval '13 months';

alter table public.video_liens enable row level security;

drop policy if exists "video_liens: l'admin" on public.video_liens;
create policy "video_liens: l'admin"
  on public.video_liens for select to authenticated
  using ((select public.is_league_admin()));

revoke all on public.video_liens from anon, authenticated;
grant select on public.video_liens to authenticated;

-- Le lien ouvert hors de l'app (« ouvert »), puis le pas vers l'app
-- (« app » : se connecter ou créer son compte). Ouvert à tous, sans compte ;
-- une vidéo inconnue ou pas publiée n'écrit rien.
create or replace function public.video_lien_vu(v text, visiteur text, etape text, de text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.video_liens (video, visiteur, etape, de)
  select x.id, video_lien_vu.visiteur, video_lien_vu.etape, nullif(lower(btrim(video_lien_vu.de)), '')
    from public.videos x
   where x.id = v and x.publiee_le is not null and x.publiee_le <= now()
  on conflict on constraint video_liens_une_fois do nothing;
exception when check_violation then
  return;
end;
$$;

-- Ce que montre le lien hors de l'app : le titre, rien d'autre (ni image,
-- ni fichier). null : vidéo inconnue ou pas publiée.
create or replace function public.video_info(v text)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object('id', x.id, 'titre', x.titre)
    from public.videos x
   where x.id = v and x.publiee_le is not null and x.publiee_le <= now();
$$;

revoke execute on function public.video_vue(text, boolean, numeric, boolean), public.video_partage(text),
  public.video_lien_vu(text, text, text, text), public.video_info(text)
  from public, anon;
grant execute on function public.video_vue(text, boolean, numeric, boolean), public.video_partage(text)
  to authenticated;
grant execute on function public.video_lien_vu(text, text, text, text), public.video_info(text)
  to anon, authenticated;

-- La notification d'une nouvelle vidéo (motif « video », /api/videos/annoncer)
-- attend qu'on la regarde, dans la semaine.
create or replace function public.push_effet_video()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.push_effet(new.joueur, array['video'], 'video:' || new.video, 'a regardé la vidéo', interval '7 days');
  return new;
exception
  when others then
    raise warning 'push_effet_video : %', sqlerrm;
    return new;
end;
$$;

revoke execute on function public.push_effet_video() from public, anon, authenticated;

drop trigger if exists push_effet_video on public.video_vues;
create trigger push_effet_video
  after insert on public.video_vues
  for each row execute function public.push_effet_video();

do $$
begin
  alter publication supabase_realtime add table public.video_reactions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.video_commentaires;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- ───────────────────────────── Messages privés ─────────────────────────────
-- Sabri, 24/10 : « Permets aussi que les joueurs puissent envoyer des
-- messages privés. » Une conversation à deux vit dans la table des messages,
-- canal 'dm', avec son destinataire (colonne, contrôles et index posés dès la
-- création de la table, plus haut) : elle hérite des réponses, réactions,
-- vocaux, photos et du temps réel du Vestiaire. La lisent ses deux joueurs,
-- et eux seuls : ni le reste de la ligue, ni l'admin (règle « messages :
-- lecture », plus haut).
--
-- Écrire en privé : à un compte accepté, jamais à soi, et pas à qui m'a
-- bloqué ni à qui j'ai bloqué (débloquer pour lui écrire à nouveau). Celui
-- qui écrit ne sait pas qu'il est bloqué : son message est refusé comme si
-- l'autre n'était pas joignable.
create table if not exists public.prive_blocages (
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  bloque      uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, bloque),
  check (user_id <> bloque)
);

alter table public.prive_blocages enable row level security;

-- Chacun ne voit que ceux qu'il a bloqués : jamais qui l'a bloqué.
drop policy if exists "blocages: les miens" on public.prive_blocages;
create policy "blocages: les miens"
  on public.prive_blocages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.prive_blocages from anon;
revoke update on public.prive_blocages from authenticated;
grant select, insert, delete on public.prive_blocages to authenticated;

create or replace function public.peut_ecrire_en_prive(a uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select a is not null
     and a <> (select auth.uid())
     and exists (select 1 from public.profiles p where p.id = a and p.valide)
     and not exists (
       select 1 from public.prive_blocages b
        where (b.user_id = a and b.bloque = (select auth.uid()))
           or (b.user_id = (select auth.uid()) and b.bloque = a)
     );
$$;

revoke execute on function public.peut_ecrire_en_prive(uuid) from public, anon;
grant execute on function public.peut_ecrire_en_prive(uuid) to authenticated;

-- Restrictive : s'ajoute à « j'écris pour moi » (compte accepté, sous son nom).
drop policy if exists "messages: le privé à qui peut le recevoir" on public.messages;
create policy "messages: le privé à qui peut le recevoir"
  on public.messages as restrictive for insert to authenticated
  with check (canal <> 'dm' or public.peut_ecrire_en_prive(destinataire));

-- Où en est chaque joueur avec chaque conversation : jusqu'où il l'a lue
-- (les pastilles), ce qu'il en veut sur son téléphone ('tout' ou 'rien' ;
-- 'cite' vaut 'tout' : en privé, tout m'est adressé), s'il l'a sous les yeux
-- (devant_le, redit toutes les 20 s par l'app) et quand le serveur l'a
-- prévenu pour la dernière fois (notifie_le, au serveur seul).
create table if not exists public.prive_suivi (
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  autre       uuid not null references public.profiles(id) on delete cascade,
  lu_jusqua   timestamptz not null default now(),
  notifs      text not null default 'tout' check (notifs in ('tout', 'cite', 'rien')),
  devant_le   timestamptz,
  notifie_le  timestamptz,
  primary key (user_id, autre)
);

alter table public.prive_suivi enable row level security;

drop policy if exists "suivi privé: le mien" on public.prive_suivi;
create policy "suivi privé: le mien"
  on public.prive_suivi for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- notifie_le n'appartient qu'au serveur. Révoquer le droit de table AVANT de
-- donner les colonnes, sinon le droit de table les annule.
revoke all on public.prive_suivi from anon, authenticated;
grant select on public.prive_suivi to authenticated;
grant insert (user_id, autre, lu_jusqua, notifs, devant_le) on public.prive_suivi to authenticated;
grant update (user_id, autre, lu_jusqua, notifs, devant_le) on public.prive_suivi to authenticated;

-- La notification de la convocation du dimanche (motif « convocation »,
-- /api/ligue/annoncer, rattachée à 'convocation:<id>') attend une réponse
-- à cette convocation, Je viens ou Pas dispo, dans les six jours.
create or replace function public.push_effet_presence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.push_effet(new.player_id, array['convocation'], 'convocation:' || new.convocation_id,
    'a répondu à la convocation', interval '6 days');
  return new;
exception
  when others then
    raise warning 'push_effet_presence : %', sqlerrm;
    return new;
end;
$$;

revoke execute on function public.push_effet_presence() from public, anon, authenticated;

drop trigger if exists push_effet_presence on public.presence;
create trigger push_effet_presence
  after insert or update of reponse on public.presence
  for each row execute function public.push_effet_presence();

-- ───────────────────────────── Les arbitres ─────────────────────────────
-- Sabri, 24/10 : « un nouveau type d'utilisateur qui ne serait pas des
-- joueurs, mais des arbitres, avec une carte d'arbitre […] et des stats
-- associées : le nombre de matchs arbitrés. […] chaque joueur du match
-- puisse mettre une note de satisfaction à l'arbitre, et ça apparaît sur sa
-- carte au lieu de son score de joueur. »
--
-- Un arbitre a un compte comme tout le monde (il se connecte, il a sa
-- photo), mais il ne joue pas : l'app le retire de toutes les listes de
-- joueurs (hidden.ts) et lui montre sa carte d'arbitre. Tout vit ici, HORS
-- du document de la saison : une publication de la saison, qui remplace le
-- document entier, ne peut ni effacer un arbitrage ni une note.
--   · profiles.arbitre : posé par l'admin seul (poser_arbitre) ;
--   · arbitrages : qui arbitre quel match d'une journée (saison, j, n = la
--     place du match dans la journée, 0 pour le Match 1), et les deux
--     équipes de ce match, recopiées au moment du choix ;
--   · avis_arbitre : la note de 1 à 5 de chaque joueur du match. Chacun ne
--     lit que la sienne ; la ligue et l'arbitre ne voient que les totaux
--     (avis_des_arbitrages), pour que la note reste franche. Les notes
--     ferment le mardi à minuit qui suit le match (arbitrages.ferme_le) :
--     les missions d'arbitre sont jugées dessus, et ne bougent plus ;
--   · missions_arbitre : ses réponses à ses missions (missions-arbitre.ts),
--     que l'on n'écrit que par repondre_mission_arbitre() ;
--   · profiles.habillage_arbitre : ce qu'il porte sur sa carte, parmi ce que
--     son passe d'arbitre lui a fait gagner (passe-arbitre.ts).
alter table public.profiles add column if not exists arbitre boolean not null default false;

create or replace function public.poser_arbitre(p_profil uuid, p_arbitre boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_league_admin() then
    raise exception 'Réservé à l''admin.' using errcode = '42501';
  end if;
  update public.profiles set arbitre = p_arbitre where id = p_profil;
  if not found then
    return false;
  end if;
  if not p_arbitre then
    delete from public.arbitrages where arbitre_id = p_profil;
  end if;
  return true;
end;
$$;

create table if not exists public.arbitrages (
  id         bigint generated always as identity primary key,
  saison     integer not null,
  j          integer not null check (j > 0),
  n          integer not null check (n between 0 and 30),
  arbitre_id uuid    not null references public.profiles(id) on delete cascade,
  equipes    text[]  not null default '{}',
  ferme_le   timestamptz,
  cree_le    timestamptz not null default now(),
  unique (saison, j, n)
);

alter table public.arbitrages add column if not exists ferme_le timestamptz;

alter table public.arbitrages enable row level security;

drop policy if exists "arbitrages: la ligue lit tout" on public.arbitrages;
create policy "arbitrages: la ligue lit tout"
  on public.arbitrages for select
  to authenticated
  using ((select public.est_membre()));

drop policy if exists "arbitrages: l'admin les pose" on public.arbitrages;
create policy "arbitrages: l'admin les pose"
  on public.arbitrages for all
  to authenticated
  using ((select public.is_league_admin()))
  with check ((select public.is_league_admin()));

revoke all on public.arbitrages from anon, authenticated;
grant select, insert, update, delete on public.arbitrages to authenticated;

create table if not exists public.avis_arbitre (
  arbitrage_id bigint   not null references public.arbitrages(id) on delete cascade,
  joueur_id    uuid     not null references public.profiles(id) on delete cascade,
  note         smallint not null check (note between 1 and 5),
  le           timestamptz not null default now(),
  primary key (arbitrage_id, joueur_id)
);

alter table public.avis_arbitre enable row level security;

drop policy if exists "avis_arbitre: chacun lit le sien" on public.avis_arbitre;
create policy "avis_arbitre: chacun lit le sien"
  on public.avis_arbitre for select
  to authenticated
  using (joueur_id = (select auth.uid()));

revoke all on public.avis_arbitre from anon, authenticated;
grant select on public.avis_arbitre to authenticated;

-- Noter l'arbitre de son match : la seule porte d'écriture. La base vérifie
-- que l'appelant a joué CE match (sa ligne de la journée, présent, avec un
-- résultat, dans l'une des deux équipes de l'arbitrage), dans la saison en
-- cours ; l'arbitre ne se note pas. On peut changer sa note.
create or replace function public.noter_arbitre(p_arbitrage bigint, p_note integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := public.mon_nom();
  a     public.arbitrages;
  v_num integer;
begin
  if not public.est_membre() or v_nom is null then
    raise exception 'Réservé aux joueurs de la ligue.' using errcode = '42501';
  end if;
  if p_note is null or p_note < 1 or p_note > 5 then
    raise exception 'Une note de 1 à 5.' using errcode = '22023';
  end if;
  select * into a from public.arbitrages where id = p_arbitrage;
  if not found then
    raise exception 'Match inconnu.' using errcode = '22023';
  end if;
  if a.arbitre_id = (select auth.uid()) then
    raise exception 'L''arbitre ne se note pas.' using errcode = '42501';
  end if;
  if a.ferme_le is not null and now() > a.ferme_le then
    raise exception 'Seuls les joueurs du match notent son arbitre, jusqu''au mardi minuit.' using errcode = '42501';
  end if;
  select coalesce((s.data ->> 'numero')::integer, 0) into v_num from public.saison s where s.id = 1;
  if v_num is distinct from a.saison or not exists (
    select 1
    from public.saison s, jsonb_array_elements(s.data -> 'entries') e
    where s.id = 1
      -- Jamais une journée en brouillon (30/10/2026).
      and not exists (
        select 1 from jsonb_array_elements(s.data -> 'journees') m
         where (m ->> 'j')::integer = a.j and public.est_brouillon(m)
      )
      and (e ->> 'j')::integer = a.j
      and lower(e ->> 'player') = lower(v_nom)
      and e ->> 'statut' = 'Présent'
      and coalesce(e ->> 'result', '') <> ''
      and coalesce((e ->> 'extraTime')::boolean, false) = false
      and (cardinality(a.equipes) = 0 or e ->> 'team' = any (a.equipes))
  ) then
    raise exception 'Seuls les joueurs du match notent son arbitre.' using errcode = '42501';
  end if;
  insert into public.avis_arbitre (arbitrage_id, joueur_id, note, le)
  values (p_arbitrage, (select auth.uid()), p_note, now())
  on conflict (arbitrage_id, joueur_id) do update set note = excluded.note, le = excluded.le;
  return true;
end;
$$;

revoke execute on function public.noter_arbitre(bigint, integer) from public, anon;
grant execute on function public.noter_arbitre(bigint, integer) to authenticated;

-- Les totaux de chaque arbitrage : combien de notes, leur somme, combien de
-- 5 sur 5. Jamais qui a mis quoi.
create or replace function public.avis_des_arbitrages()
returns table (arbitrage_id bigint, avis integer, total integer, cinq integer)
language sql
security definer
set search_path = ''
stable
as $$
  select v.arbitrage_id, count(*)::integer, sum(v.note)::integer, count(*) filter (where v.note = 5)::integer
  from public.avis_arbitre v
  where public.est_membre()
  group by v.arbitrage_id;
$$;

revoke execute on function public.avis_des_arbitrages() from public, anon;
grant execute on function public.avis_des_arbitrages() to authenticated;

revoke execute on function public.poser_arbitre(uuid, boolean) from public, anon;
grant execute on function public.poser_arbitre(uuid, boolean) to authenticated;

-- Ce que l'arbitre porte sur sa carte : « finition/signes/grade », « - »
-- pour rien (passe-arbitre.ts). Il l'écrit lui-même, sur son profil.
alter table public.profiles add column if not exists habillage_arbitre text;
alter table public.profiles drop constraint if exists profiles_habillage_arbitre_check;
alter table public.profiles add constraint profiles_habillage_arbitre_check
  check (habillage_arbitre is null or habillage_arbitre ~ '^(-|orange-fluo|vert-fluo|rose-fluo|fluo-nuit|craie|ardoise|raye|damier|nuit-de-match|chrono|platine|filets)/(-|(lisere-argent|lisere-platine|puce-noire|nom-grave|sifflet|cartons)(\+(lisere-argent|lisere-platine|puce-noire|nom-grave|sifflet|cartons))*)/(-|ligue|national|elite|international)$');
grant update (habillage_arbitre) on public.profiles to authenticated;

-- Les missions d'arbitre (Sabri, 24/10 : « qu'ils puissent activer, accepter
-- et refuser aussi des missions ») : trois par journée qu'il arbitre. L'app
-- ne compte que la réponse donnée avant le coup d'envoi, à l'heure de la
-- base (comme missions_reponses).
create table if not exists public.missions_arbitre (
  saison     integer not null,
  j          integer not null check (j > 0),
  mission    text    not null check (mission in ('sang-froid', 'tribune', 'unanime')),
  arbitre_id uuid    not null references public.profiles(id) on delete cascade,
  reponse    text    not null check (reponse in ('acceptee', 'passee')),
  le         timestamptz not null default now(),
  primary key (saison, j, mission, arbitre_id)
);

alter table public.missions_arbitre enable row level security;

drop policy if exists "missions_arbitre: l'arbitre lit les siennes" on public.missions_arbitre;
create policy "missions_arbitre: l'arbitre lit les siennes"
  on public.missions_arbitre for select
  to authenticated
  using (arbitre_id = (select auth.uid()) or (select public.is_league_admin()));

revoke all on public.missions_arbitre from anon, authenticated;
grant select on public.missions_arbitre to authenticated;

create or replace function public.repondre_mission_arbitre(p_saison integer, p_j integer, p_mission text, p_reponse text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_le timestamptz := now();
begin
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.arbitre) then
    raise exception 'Réservé aux arbitres.' using errcode = '42501';
  end if;
  if p_mission not in ('sang-froid', 'tribune', 'unanime') or p_reponse not in ('acceptee', 'passee') then
    raise exception 'Réponse inconnue.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.arbitrages a where a.saison = p_saison and a.j = p_j and a.arbitre_id = (select auth.uid())
  ) then
    raise exception 'Réservé à l''arbitre de cette journée.' using errcode = '42501';
  end if;
  insert into public.missions_arbitre (saison, j, mission, arbitre_id, reponse, le)
  values (p_saison, p_j, p_mission, (select auth.uid()), p_reponse, v_le)
  on conflict (saison, j, mission, arbitre_id) do update set reponse = excluded.reponse, le = excluded.le;
  return v_le;
end;
$$;

revoke execute on function public.repondre_mission_arbitre(integer, integer, text, text) from public, anon;
grant execute on function public.repondre_mission_arbitre(integer, integer, text, text) to authenticated;

-- Une fois : Fabio, le premier arbitre de la ligue (Sabri, 24/10 : « Et tu
-- peux le faire pour Fabio »). Ensuite, c'est l'admin qui décide (Admin →
-- Arbitres), et le schéma rejoué ne revient pas sur son choix.
do $$
begin
  if not exists (select 1 from public.etapes_uniques where etape = 'arbitre-fabio-2026-10') then
    update public.profiles set arbitre = true where id = '7a459cee-1e12-480f-9937-6298f1d7558e';
    insert into public.etapes_uniques (etape) values ('arbitre-fabio-2026-10');
  end if;
end;
$$;

-- ───────────────────────── Les blessures déclarées ─────────────────────────
-- Sabri, 26/10 : « une fonctionnalité qui permet à chaque utilisateur de se
-- déclarer blessé », pour que tout le monde voie que ses stats sont restées
-- bloquées sur ces journées-là (lib/sfl/blessures.ts). Une blessure se compte
-- en journées : `depuis` est la première journée manquée, `fin` la dernière
-- (comprise), null tant qu'il n'est pas remis. On ne se déclare que soi-même,
-- par se_declarer_blesse() : la base pose le nom (mon_nom) et l'heure. Toute
-- la ligue lit tout : c'est ce qu'on lit dans les classements et les profils.
create table if not exists public.blessures (
  saison     integer not null,
  joueur     text    not null,
  depuis     integer not null check (depuis between 1 and 99),
  fin        integer check (fin is null or fin >= depuis),
  joueur_id  uuid    not null references public.profiles(id) on delete cascade,
  le         timestamptz not null default now(),
  primary key (saison, joueur, depuis)
);

alter table public.blessures enable row level security;

drop policy if exists "blessures: la ligue lit tout" on public.blessures;
create policy "blessures: la ligue lit tout"
  on public.blessures for select
  to authenticated
  using ((select public.est_membre()));

revoke all on public.blessures from anon, authenticated;
grant select on public.blessures to authenticated;

-- Se déclarer blessé (p_blesse) à partir de la journée p_j, la prochaine à
-- jouer ; ou remis (p_blesse = false) : la blessure en cours se ferme sur la
-- journée d'avant p_j, ou disparaît si aucune journée n'a été manquée.
create or replace function public.se_declarer_blesse(
  p_saison integer,
  p_j integer,
  p_blesse boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := public.mon_nom();
  v_le  timestamptz := now();
  v_depuis integer;
begin
  if not public.est_membre() or v_nom is null then
    raise exception 'Réservé aux joueurs de la ligue.' using errcode = '42501';
  end if;
  if p_j < 1 or p_j > 99 then
    raise exception 'Journée inconnue.' using errcode = '22023';
  end if;
  select b.depuis into v_depuis from public.blessures b
    where b.saison = p_saison and b.joueur = v_nom and b.fin is null
    order by b.depuis desc limit 1;
  if p_blesse then
    if v_depuis is null then
      insert into public.blessures (saison, joueur, depuis, fin, joueur_id, le)
      values (p_saison, v_nom, p_j, null, (select auth.uid()), v_le)
      on conflict (saison, joueur, depuis) do update
        set fin = null, joueur_id = excluded.joueur_id, le = excluded.le;
    end if;
  elsif v_depuis is not null then
    if p_j - 1 < v_depuis then
      delete from public.blessures where saison = p_saison and joueur = v_nom and depuis = v_depuis;
    else
      update public.blessures set fin = p_j - 1, le = v_le
        where saison = p_saison and joueur = v_nom and depuis = v_depuis;
    end if;
  end if;
  return v_le;
end;
$$;

revoke execute on function public.se_declarer_blesse(integer, integer, boolean) from public, anon;
grant execute on function public.se_declarer_blesse(integer, integer, boolean) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.blessures;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- ─────────────────── Map : l'affiche du match ───────────────────
-- L'affiche d'un match (Sabri, 31/10 : l'image générée des deux meilleurs
-- joueurs, « comme ça ça pourrait être l'affiche du match ») : une image par
-- paire de joueurs, faite une seule fois par fal côté serveur (api/affiche)
-- et gardée dans le bucket public « affiches ». Seuls les joueurs qui ont
-- accepté l'usage de leur carte hors de l'app (consentements.hors_app) et
-- qui ont une photo de carte y figurent. Seule la clé secrète écrit ici ;
-- tout le monde lit (l'image est publique, comme les photos de carte).
create table if not exists public.match_affiches (
  paire       text primary key,
  joueurs     text[] not null,
  chemin      text,
  statut      text not null default 'en_cours' check (statut in ('en_cours', 'prete', 'ratee')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists match_affiches_date on public.match_affiches (created_at desc);
alter table public.match_affiches enable row level security;
revoke all on public.match_affiches from anon, authenticated;
grant select on public.match_affiches to anon, authenticated;
drop policy if exists "match_affiches: tout le monde lit" on public.match_affiches;
create policy "match_affiches: tout le monde lit" on public.match_affiches for select to anon, authenticated
  using (statut = 'prete');

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('affiches', 'affiches', true, 3145728, array['image/jpeg'])
  on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception
  when others then raise warning 'affiches : bucket non créé (%)', sqlerrm;
end;
$$;

-- ─────────── La feuille de match tenue par un joueur (01/11/2026) ───────────
-- Sabri, 01/11 (jour de la J4) : « chaque joueur de l'application présent
-- dans un match [peut] prendre les stats lui-même de son match et uniquement
-- de son match […] à partir du moment où il y en a un qui a pris les stats,
-- on prend avec son téléphone », pour que les quatre matchs du dimanche se
-- prennent en direct et que le soir même on vote et on voie les classements.
--
-- Une feuille par match (saison, journée, Noirs N, Blancs N) d'une journée
-- SFL publiée, le jour même. Le premier joueur du match qui la prend la
-- tient : le verrou, c'est la clé primaire (deux téléphones en même temps,
-- une seule insertion passe, l'autre lit le nom de celui qui l'a). Il compte
-- buts, passes, arrêts, interceptions et buts contre son camp des deux
-- équipes ; toute la ligue suit en lecture, en temps réel. « Fin du match »
-- la scelle : le résultat et les chiffres entrent dans la saison tout de
-- suite (sceller_feuille), en n'écrivant que les lignes de ce match, par
-- la même voie que les publications de l'admin (version, historique,
-- signal). Il peut passer la main à un joueur du match ; l'admin la reprend,
-- la libère ou la rouvre. Ni la feuille ni une publication de l'admin
-- n'écrasent l'autre (feuilles_ecrasees, appelée par publier_saison).
-- La même règle côté app : lib/sfl/feuille-direct.ts. Mode Bola : rien.
create table if not exists public.feuilles_direct (
  saison      int  not null,
  j           int  not null,
  noirs       text not null,
  blancs      text not null,
  -- Celui qui tient la feuille ; null : libérée par l'admin, à reprendre.
  preneur     uuid references public.profiles(id) on delete set null,
  preneur_nom text,
  pris_le     timestamptz,
  -- Le coup d'envoi : la première prise (le chrono part de là).
  debut       timestamptz not null default now(),
  -- Scellée : la saison porte ses chiffres depuis la version `version`.
  fin         timestamptz,
  scelle_par  uuid references public.profiles(id) on delete set null,
  version     bigint,
  -- { « Ilyes » : { buts, passes, arrets, interceptions, csc } } ; absent = 0.
  compteurs   jsonb not null default '{}'::jsonb,
  -- Les gestes, dans l'ordre : { le, gestes : [{ joueur, quoi, d }] }.
  journal     jsonb not null default '[]'::jsonb,
  maj_le      timestamptz not null default now(),
  primary key (saison, j, noirs, blancs)
);
create index if not exists feuilles_direct_preneur on public.feuilles_direct (preneur);
create index if not exists feuilles_direct_scelle_par on public.feuilles_direct (scelle_par);

alter table public.feuilles_direct enable row level security;
drop policy if exists "feuilles_direct: lecture ligue" on public.feuilles_direct;
create policy "feuilles_direct: lecture ligue"
  on public.feuilles_direct for select
  to authenticated
  using ((select public.est_membre()));
-- Personne n'écrit la table : seulement les fonctions ci-dessous.
revoke insert, update, delete, truncate on public.feuilles_direct from anon, authenticated;
grant select on public.feuilles_direct to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.feuilles_direct;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- Les lignes d'un match dans un document de saison : ses deux camps, les
-- présents et les Xtratime, jamais une ligne vitrine (comme le moteur,
-- saisie/engine.ts). `i` : la place de la ligne dans entries (1, 2…).
create or replace function public.lignes_du_match(p_data jsonb, p_j int, p_noirs text, p_blancs text)
returns table (i bigint, e jsonb, joueur text, camp text, extra boolean)
language sql
immutable
set search_path = ''
as $$
  select t.i, t.e, t.e ->> 'player', t.e ->> 'team',
         lower(coalesce(t.e ->> 'extraTime', 'false')) in ('true', '1')
    from jsonb_array_elements(
           case when jsonb_typeof(p_data -> 'entries') = 'array' then p_data -> 'entries' else '[]'::jsonb end
         ) with ordinality t(e, i)
   where t.e ->> 'j' = p_j::text
     and t.e ->> 'team' in (p_noirs, p_blancs)
     and (t.e ->> 'statut' = 'Présent' or lower(coalesce(t.e ->> 'extraTime', 'false')) in ('true', '1'))
     and lower(coalesce(t.e ->> 'vitrine', 'false')) not in ('true', '1');
$$;
revoke execute on function public.lignes_du_match(jsonb, int, text, text) from public, anon, authenticated;

-- Ce que la feuille d'un match écrit, ligne à ligne (buts, passes, arrêts,
-- interceptions, résultat, buts d'équipe) : de quoi voir si une publication
-- y touche. Une ligne encore à zéro n'y est pas, si bien qu'un remplaçant
-- ajouté en plein match ne change rien.
create or replace function public.chiffres_du_match(p_data jsonb, p_j int, p_noirs text, p_blancs text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x::text), '[]'::jsonb)
    from (
      select jsonb_build_array(
               l.joueur, l.camp,
               coalesce(public.entier_sur(l.e ->> 'buts'), 0),
               coalesce(public.entier_sur(l.e ->> 'passes'), 0),
               coalesce(public.entier_sur(l.e ->> 'arrets'), 0),
               coalesce(public.entier_sur(l.e ->> 'interceptions'), 0),
               l.e ->> 'result',
               coalesce(public.entier_sur(l.e ->> 'teamScoreBonus'), 0)
             ) as x
        from public.lignes_du_match(p_data, p_j, p_noirs, p_blancs) l
    ) y
   where (x ->> 2)::int <> 0 or (x ->> 3)::int <> 0 or (x ->> 4)::int <> 0 or (x ->> 5)::int <> 0
      or x ->> 6 is not null or (x ->> 7)::int <> 0;
$$;
revoke execute on function public.chiffres_du_match(jsonb, int, text, text) from public, anon, authenticated;

-- Les feuilles qu'une publication écraserait : celles qu'un joueur tient
-- encore, et, quand l'admin écrase une base plus neuve que la sienne, celles
-- scellées depuis (leur version est au-delà de sa base). Vide : rien à
-- garder. Format « J4 · Noirs 1 – Blancs 1 · Ilyes ».
create or replace function public.feuilles_ecrasees(p_nouveau jsonb, p_ancien jsonb, p_base bigint, p_forcer boolean)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(format('J%s · %s – %s · %s', f.j, f.noirs, f.blancs, coalesce(f.preneur_nom, 'libre'))
                            order by f.j, f.noirs), '{}'::text[])
    from public.feuilles_direct f
   where (select public.est_membre())
     and f.saison = coalesce(public.entier_sur(p_ancien ->> 'numero'), 0)
     and (f.fin is null or (coalesce(p_forcer, false) and f.version > coalesce(p_base, 0)))
     and public.chiffres_du_match(p_nouveau, f.j, f.noirs, f.blancs)
         is distinct from public.chiffres_du_match(p_ancien, f.j, f.noirs, f.blancs);
$$;
revoke execute on function public.feuilles_ecrasees(jsonb, jsonb, bigint, boolean) from public, anon;
-- publier_saison est security invoker : l'admin l'appelle avec son rôle.
grant execute on function public.feuilles_ecrasees(jsonb, jsonb, bigint, boolean) to authenticated;

-- Les compteurs de départ d'une feuille : ce que la saison porte déjà pour
-- ce match (l'admin a pu compter avant qu'un joueur ne prenne la feuille).
create or replace function public.compteurs_du_document(p_data jsonb, p_j int, p_noirs text, p_blancs text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(x.joueur, x.c), '{}'::jsonb)
    from (
      select l.joueur, jsonb_strip_nulls(jsonb_build_object(
               'buts', nullif(coalesce(public.entier_sur(l.e ->> 'buts'), 0), 0),
               'passes', nullif(coalesce(public.entier_sur(l.e ->> 'passes'), 0), 0),
               'arrets', nullif(coalesce(public.entier_sur(l.e ->> 'arrets'), 0), 0),
               'interceptions', nullif(coalesce(public.entier_sur(l.e ->> 'interceptions'), 0), 0))) as c
        from public.lignes_du_match(p_data, p_j, p_noirs, p_blancs) l
    ) x
   where x.c <> '{}'::jsonb;
$$;
revoke execute on function public.compteurs_du_document(jsonb, int, text, text) from public, anon, authenticated;

-- La feuille d'un match peut-elle encore s'écrire, quel que soit le jour ?
-- null : oui ; sinon le motif.
--   journee · la journée n'existe pas ;  brouillon · pas (ou plus) publiée ;
--   match · ces deux camps ne forment pas un match de la journée.
-- Une journée remise en brouillon (avant son coup d'envoi, brouillon.ts) gèle
-- sa feuille : rien de la composition préparée ne doit passer par une
-- feuille que toute la ligue lit (relecture du 01/11).
create or replace function public.feuille_hors_jeu(p_data jsonb, p_j int, p_noirs text, p_blancs text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  meta jsonb;
  declares jsonb;
begin
  select m into meta
    from jsonb_array_elements(
           case when jsonb_typeof(p_data -> 'journees') = 'array' then p_data -> 'journees' else '[]'::jsonb end) m
   where m ->> 'j' = p_j::text
   limit 1;
  if meta is null then
    return 'journee';
  end if;
  if public.est_brouillon(meta) then
    return 'brouillon';
  end if;
  declares := case when jsonb_typeof(meta -> 'matchsDuJour') = 'array' then meta -> 'matchsDuJour' else '[]'::jsonb end;
  if jsonb_array_length(declares) > 0 then
    if not exists (
      select 1 from jsonb_array_elements(declares) m
       where m -> 'equipes' ->> 0 = p_noirs and m -> 'equipes' ->> 1 = p_blancs
    ) then
      return 'match';
    end if;
  elsif not (p_noirs ~ '^Noirs \d+$' and p_blancs = 'Blancs ' || substring(p_noirs from '\d+$')) then
    return 'match';
  end if;
  return null;
end;
$$;
revoke execute on function public.feuille_hors_jeu(jsonb, int, text, text) from public, anon, authenticated;

-- `p_nom` joue-t-il ce match (une ligne de présent ou d'Xtratime) ?
create or replace function public.joue_le_match(p_data jsonb, p_j int, p_noirs text, p_blancs text, p_nom text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_nom is not null and exists (
    select 1 from public.lignes_du_match(p_data, p_j, p_noirs, p_blancs) l
     where lower(btrim(l.joueur)) = lower(btrim(p_nom))
  );
$$;
revoke execute on function public.joue_le_match(jsonb, int, text, text, text) from public, anon, authenticated;

-- Peut-on prendre la feuille de ce match ? null : oui ; sinon le motif.
--   journee, brouillon, match · feuille_hors_jeu ;
--   pas-du-jour · elle ne se joue pas aujourd'hui (heure de Paris) ;
--   pas-ton-match · `p_nom` ne joue pas ce match ;
--   terminee · le match a déjà son résultat.
-- « pas-ton-match » passe AVANT « terminee » : prendre_feuille laisse
-- reprendre une feuille rouverte (match terminé) à un joueur du match, et à
-- lui seul (relecture du 01/11 : rouverte puis libérée, n'importe quel
-- membre la prenait).
create or replace function public.droit_feuille(p_data jsonb, p_j int, p_noirs text, p_blancs text, p_nom text, p_maintenant timestamptz)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  meta jsonb;
  refus text;
begin
  refus := public.feuille_hors_jeu(p_data, p_j, p_noirs, p_blancs);
  if refus is not null then
    return refus;
  end if;
  select m into meta
    from jsonb_array_elements(p_data -> 'journees') m
   where m ->> 'j' = p_j::text
   limit 1;
  if public.date_de_journee(meta ->> 'date', p_maintenant) is distinct from (p_maintenant at time zone 'Europe/Paris')::date then
    return 'pas-du-jour';
  end if;
  if not public.joue_le_match(p_data, p_j, p_noirs, p_blancs, p_nom) then
    return 'pas-ton-match';
  end if;
  if exists (
    select 1 from public.lignes_du_match(p_data, p_j, p_noirs, p_blancs) l
     where not l.extra and coalesce(l.e ->> 'result', '') <> ''
  ) then
    return 'terminee';
  end if;
  return null;
end;
$$;
revoke execute on function public.droit_feuille(jsonb, int, text, text, text, timestamptz) from public, anon, authenticated;

-- Le document de saison avec les chiffres d'une feuille posés sur les lignes
-- de ce match, et seulement elles (la même règle que appliquerFeuille,
-- lib/sfl/feuille-direct.ts) :
--   · buts et passes sur chaque ligne du match ; arrêts et interceptions sur
--     les lignes des présents (une ligne Xtratime n'en compte pas) ;
--   · le score de chaque camp : ses buts, ses buts d'équipe (teamScoreBonus)
--     et les buts contre son camp de l'adversaire, que porte la première
--     ligne de joueur du camp qui en profite ;
--   · le résultat (Victoire, Nul, Défaite) sur chaque présent des deux
--     camps, comme « Fin du match » dans l'admin (finDuMatch) ;
--   · le MVP, sur une journée au MVP calculé : la meilleure note de match
--     (saisie/mvp.ts, noteDeMatch), tous les ex æquo, personne à zéro.
create or replace function public.appliquer_feuille(p_data jsonb, p_j int, p_noirs text, p_blancs text, p_compteurs jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  entrees jsonb := case when jsonb_typeof(p_data -> 'entries') = 'array' then p_data -> 'entries' else '[]'::jsonb end;
  comptes jsonb := case when jsonb_typeof(p_compteurs) = 'object' then p_compteurs else '{}'::jsonb end;
  meta    jsonb;
  auto    boolean;
  l       record;
  c       jsonb;
  ligne   jsonb;
  sn int := 0;
  sb int := 0;
  csc_n int := 0;
  csc_b int := 0;
  rn text;
  rb text;
  premier_n bigint;
  premier_b bigint;
  neuves  jsonb := '{}'::jsonb;
  note    int;
  note_max int := 0;
  notes   jsonb := '{}'::jsonb;
  k       text;
  sortie  jsonb;
begin
  select m into meta
    from jsonb_array_elements(
           case when jsonb_typeof(p_data -> 'journees') = 'array' then p_data -> 'journees' else '[]'::jsonb end) m
   where m ->> 'j' = p_j::text
   limit 1;
  auto := lower(coalesce(meta ->> 'mvpAuto', 'false')) in ('true', '1');

  -- 1 · Les scores.
  for l in select * from public.lignes_du_match(p_data, p_j, p_noirs, p_blancs) loop
    c := coalesce(comptes -> l.joueur, '{}'::jsonb);
    if l.camp = p_noirs then
      sn := sn + coalesce(public.entier_sur(c ->> 'buts'), 0) + coalesce(public.entier_sur(l.e ->> 'teamScoreBonus'), 0);
      csc_n := csc_n + coalesce(public.entier_sur(c ->> 'csc'), 0);
      if not l.extra and premier_n is null then premier_n := l.i; end if;
    else
      sb := sb + coalesce(public.entier_sur(c ->> 'buts'), 0) + coalesce(public.entier_sur(l.e ->> 'teamScoreBonus'), 0);
      csc_b := csc_b + coalesce(public.entier_sur(c ->> 'csc'), 0);
      if not l.extra and premier_b is null then premier_b := l.i; end if;
    end if;
  end loop;
  sn := sn + csc_b;
  sb := sb + csc_n;
  rn := case when sn > sb then 'Victoire' when sn < sb then 'Défaite' else 'Nul' end;
  rb := case rn when 'Victoire' then 'Défaite' when 'Défaite' then 'Victoire' else 'Nul' end;

  -- 2 · Les lignes du match, réécrites.
  for l in select * from public.lignes_du_match(p_data, p_j, p_noirs, p_blancs) loop
    c := coalesce(comptes -> l.joueur, '{}'::jsonb);
    ligne := l.e || jsonb_build_object(
      'buts', greatest(coalesce(public.entier_sur(c ->> 'buts'), 0), 0),
      'passes', greatest(coalesce(public.entier_sur(c ->> 'passes'), 0), 0));
    if not l.extra then
      ligne := ligne || jsonb_build_object(
        'arrets', greatest(coalesce(public.entier_sur(c ->> 'arrets'), 0), 0),
        'interceptions', greatest(coalesce(public.entier_sur(c ->> 'interceptions'), 0), 0),
        'result', case when l.camp = p_noirs then rn else rb end);
    end if;
    if l.i = premier_n and csc_b > 0 then
      ligne := ligne || jsonb_build_object('teamScoreBonus', coalesce(public.entier_sur(l.e ->> 'teamScoreBonus'), 0) + csc_b);
    elsif l.i = premier_b and csc_n > 0 then
      ligne := ligne || jsonb_build_object('teamScoreBonus', coalesce(public.entier_sur(l.e ->> 'teamScoreBonus'), 0) + csc_n);
    end if;
    neuves := neuves || jsonb_build_object(l.i::text, ligne);
  end loop;

  -- 3 · Le MVP du match, sur une journée au MVP calculé.
  if auto then
    for k, ligne in select * from jsonb_each(neuves) loop
      if lower(coalesce(ligne ->> 'extraTime', 'false')) in ('true', '1') or btrim(coalesce(ligne ->> 'player', '')) ~* '^X\d+$' then
        note := 0;
      else
        note := coalesce(public.entier_sur(ligne ->> 'buts'), 0) + coalesce(public.entier_sur(ligne ->> 'passes'), 0)
              + case when lower(coalesce(ligne ->> 'cleanSheet', 'false')) in ('true', '1') then 3 else 0 end
              + coalesce(public.entier_sur(ligne ->> 'arrets'), 0) / 2
              + coalesce(public.entier_sur(ligne ->> 'interceptions'), 0) / 2
              + case ligne ->> 'result'
                  when 'Victoire' then case when lower(coalesce(ligne ->> 'sflTime', 'false')) in ('true', '1') then 3 else 2 end
                  when 'Nul' then 1
                  else 0
                end;
      end if;
      notes := notes || jsonb_build_object(k, note);
      note_max := greatest(note_max, note);
    end loop;
    for k, ligne in select * from jsonb_each(neuves) loop
      neuves := neuves || jsonb_build_object(k, ligne || jsonb_build_object('mvp', note_max > 0 and (notes ->> k)::int = note_max));
    end loop;
  end if;

  select coalesce(jsonb_agg(coalesce(neuves -> t.i::text, t.e) order by t.i), '[]'::jsonb)
    into sortie
    from jsonb_array_elements(entrees) with ordinality t(e, i);
  return sortie;
end;
$$;
revoke execute on function public.appliquer_feuille(jsonb, int, text, text, jsonb) from public, anon, authenticated;

-- Prendre la feuille de son match. Le premier qui la prend la tient ; un
-- second appel au même instant attend le premier, puis lit son nom. Une
-- feuille libérée par l'admin se reprend ; la sienne se reprend sans rien
-- changer. Renvoie { ok, feuille, refus }.
create or replace function public.prendre_feuille(p_j int, p_noirs text, p_blancs text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi   uuid := auth.uid();
  nom   text;
  doc   jsonb;
  n     int;
  refus text;
  existe boolean;
  f     public.feuilles_direct;
begin
  select p.name into nom from public.profiles p where p.id = moi and p.valide;
  if nom is null then
    raise exception 'Réservé aux joueurs de la ligue.' using errcode = '42501';
  end if;
  -- La saison, verrouillée en partage : une publication de l'admin en cours
  -- (publier_saison la tient « for update ») passe d'abord, et la prise lit
  -- ce qu'elle a écrit — la fin du match qu'il vient de poser refuse la
  -- prise, au lieu d'ouvrir une feuille qui l'écraserait au sceau. Deux
  -- prises au même instant ne s'attendent pas pour autant.
  select s.data into doc from public.saison s where s.id = 1 for share;
  n := coalesce(public.entier_sur(doc ->> 'numero'), 0);
  -- Une feuille déjà là : la sienne, une libérée, ou celle d'un autre.
  select * into f from public.feuilles_direct d
   where d.saison = n and d.j = p_j and d.noirs = p_noirs and d.blancs = p_blancs;
  existe := found;
  if existe and f.preneur = moi and f.fin is null then
    return jsonb_build_object('ok', true, 'feuille', to_jsonb(f));
  end if;
  refus := public.droit_feuille(doc, p_j, p_noirs, p_blancs, nom, now());
  -- Une feuille rouverte par l'admin se reprend, même si la saison porte
  -- déjà le résultat du match — par un joueur du match seulement :
  -- droit_feuille ne répond « terminee » qu'une fois « pas-ton-match » passé.
  if refus is not null and not (existe and f.fin is null and refus = 'terminee') then
    return jsonb_build_object('ok', false, 'refus', refus, 'feuille', case when existe then to_jsonb(f) end);
  end if;
  insert into public.feuilles_direct (saison, j, noirs, blancs, preneur, preneur_nom, pris_le, compteurs)
  values (n, p_j, p_noirs, p_blancs, moi, nom, now(), public.compteurs_du_document(doc, p_j, p_noirs, p_blancs))
  on conflict (saison, j, noirs, blancs) do nothing
  returning * into f;
  if found then
    return jsonb_build_object('ok', true, 'feuille', to_jsonb(f));
  end if;
  update public.feuilles_direct d
     set preneur = moi, preneur_nom = nom, pris_le = now(), maj_le = now()
   where d.saison = n and d.j = p_j and d.noirs = p_noirs and d.blancs = p_blancs
     and d.preneur is null and d.fin is null
  returning * into f;
  if found then
    return jsonb_build_object('ok', true, 'feuille', to_jsonb(f));
  end if;
  select * into f from public.feuilles_direct d
   where d.saison = n and d.j = p_j and d.noirs = p_noirs and d.blancs = p_blancs;
  return jsonb_build_object(
    'ok', f.preneur = moi and f.fin is null,
    'refus', case when f.fin is not null then 'scellee' when f.preneur = moi then null else 'tenue' end,
    'feuille', to_jsonb(f));
end;
$$;
revoke execute on function public.prendre_feuille(int, text, text) from public, anon;
grant execute on function public.prendre_feuille(int, text, text) to authenticated;

-- Compter : un ou quelques gestes d'un coup (un but et sa passe), +1 ou −1,
-- sur des joueurs du match, par celui qui tient la feuille seulement, avant
-- la fin. Un compteur reste entre 0 et 99. p_gestes : [{ joueur, quoi, d }],
-- quoi ∈ buts, passes, arrets, interceptions, csc.
-- Relecture du 01/11 : un compte en attente ne lit rien par les refus (la
-- feuille n'est qu'aux membres, comme sa lecture) ; une journée remise en
-- brouillon gèle sa feuille ; un joueur sorti du match par l'admin ne
-- compte plus (l'admin, lui, compte la feuille qu'il a reprise) ; le
-- journal garde ses 500 derniers gestes.
create or replace function public.compter_feuille(p_j int, p_noirs text, p_blancs text, p_gestes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := auth.uid();
  nom text;
  doc jsonb;
  n   int;
  f   public.feuilles_direct;
  g   jsonb;
  c   jsonb;
  joueurs text[];
  quoi text;
  d   int;
  v   int;
  refus text;
  faits jsonb := '[]'::jsonb;
begin
  select p.name into nom from public.profiles p where p.id = moi and p.valide;
  if nom is null then
    raise exception 'Réservé aux joueurs de la ligue.' using errcode = '42501';
  end if;
  select s.data into doc from public.saison s where s.id = 1;
  n := coalesce(public.entier_sur(doc ->> 'numero'), 0);
  select * into f from public.feuilles_direct x
   where x.saison = n and x.j = p_j and x.noirs = p_noirs and x.blancs = p_blancs
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'refus', 'sans-feuille');
  end if;
  if f.fin is not null then
    return jsonb_build_object('ok', false, 'refus', 'scellee', 'feuille', to_jsonb(f));
  end if;
  if f.preneur is distinct from moi then
    return jsonb_build_object('ok', false, 'refus', 'pas-preneur', 'feuille', to_jsonb(f));
  end if;
  refus := public.feuille_hors_jeu(doc, p_j, p_noirs, p_blancs);
  if refus is null and not public.joue_le_match(doc, p_j, p_noirs, p_blancs, nom) and not public.is_league_admin() then
    refus := 'pas-ton-match';
  end if;
  if refus is not null then
    return jsonb_build_object('ok', false, 'refus', refus, 'feuille', to_jsonb(f));
  end if;
  if jsonb_typeof(p_gestes) is distinct from 'array' or jsonb_array_length(p_gestes) not between 1 and 4 then
    return jsonb_build_object('ok', false, 'refus', 'geste', 'feuille', to_jsonb(f));
  end if;
  select coalesce(array_agg(l.joueur), '{}'::text[]) into joueurs
    from public.lignes_du_match(doc, p_j, p_noirs, p_blancs) l;
  c := f.compteurs;
  for g in select * from jsonb_array_elements(p_gestes) loop
    quoi := g ->> 'quoi';
    d := public.entier_sur(g ->> 'd');
    if quoi is null or quoi not in ('buts', 'passes', 'arrets', 'interceptions', 'csc')
       or d is null or d not in (-1, 1)
       or (g ->> 'joueur') is null or not ((g ->> 'joueur') = any (joueurs)) then
      return jsonb_build_object('ok', false, 'refus', 'geste', 'feuille', to_jsonb(f));
    end if;
    v := coalesce(public.entier_sur(c -> (g ->> 'joueur') ->> quoi), 0);
    if v + d between 0 and 99 then
      c := jsonb_set(c, array[g ->> 'joueur'], coalesce(c -> (g ->> 'joueur'), '{}'::jsonb) || jsonb_build_object(quoi, v + d));
      faits := faits || jsonb_build_object('joueur', g ->> 'joueur', 'quoi', quoi, 'd', d);
    end if;
  end loop;
  if jsonb_array_length(faits) > 0 then
    update public.feuilles_direct x
       set compteurs = c,
           journal = (
             select coalesce(jsonb_agg(e order by i), '[]'::jsonb)
               from jsonb_array_elements(x.journal || jsonb_build_array(jsonb_build_object('le', now(), 'gestes', faits)))
                    with ordinality t(e, i)
              where i > jsonb_array_length(x.journal) + 1 - 500),
           maj_le = now()
     where x.saison = n and x.j = p_j and x.noirs = p_noirs and x.blancs = p_blancs
    returning * into f;
  end if;
  return jsonb_build_object('ok', true, 'feuille', to_jsonb(f));
end;
$$;
revoke execute on function public.compter_feuille(int, text, text, jsonb) from public, anon;
grant execute on function public.compter_feuille(int, text, text, jsonb) to authenticated;

-- Passer la main : celui qui tient la feuille la donne à un joueur du match
-- qui a son compte (sinon : « sans-compte »). Un membre seulement, sur une
-- journée publiée (relecture du 01/11, comme compter_feuille) ; un preneur
-- que l'admin a sorti du match peut encore la donner à un joueur du match.
create or replace function public.passer_feuille(p_j int, p_noirs text, p_blancs text, p_a text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := auth.uid();
  doc jsonb;
  n   int;
  f   public.feuilles_direct;
  qui public.profiles;
  refus text;
begin
  if not public.est_membre() then
    raise exception 'Réservé aux joueurs de la ligue.' using errcode = '42501';
  end if;
  select s.data into doc from public.saison s where s.id = 1;
  n := coalesce(public.entier_sur(doc ->> 'numero'), 0);
  select * into f from public.feuilles_direct x
   where x.saison = n and x.j = p_j and x.noirs = p_noirs and x.blancs = p_blancs
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'refus', 'sans-feuille');
  end if;
  if f.fin is not null then
    return jsonb_build_object('ok', false, 'refus', 'scellee', 'feuille', to_jsonb(f));
  end if;
  if f.preneur is distinct from moi then
    return jsonb_build_object('ok', false, 'refus', 'pas-preneur', 'feuille', to_jsonb(f));
  end if;
  refus := public.feuille_hors_jeu(doc, p_j, p_noirs, p_blancs);
  if refus is not null then
    return jsonb_build_object('ok', false, 'refus', refus, 'feuille', to_jsonb(f));
  end if;
  if not public.joue_le_match(doc, p_j, p_noirs, p_blancs, p_a) then
    return jsonb_build_object('ok', false, 'refus', 'pas-ton-match', 'feuille', to_jsonb(f));
  end if;
  select p.* into qui from public.profiles p
   where lower(btrim(p.name)) = lower(btrim(p_a)) and p.valide
   limit 1;
  if qui.id is null then
    return jsonb_build_object('ok', false, 'refus', 'sans-compte', 'feuille', to_jsonb(f));
  end if;
  update public.feuilles_direct x
     set preneur = qui.id, preneur_nom = qui.name, pris_le = now(), maj_le = now()
   where x.saison = n and x.j = p_j and x.noirs = p_noirs and x.blancs = p_blancs
  returning * into f;
  return jsonb_build_object('ok', true, 'feuille', to_jsonb(f));
end;
$$;
revoke execute on function public.passer_feuille(int, text, text, text) from public, anon;
grant execute on function public.passer_feuille(int, text, text, text) to authenticated;

-- L'admin : « reprendre » (il la tient ; une feuille que personne n'a prise
-- naît à son nom), « liberer » (personne ne la tient, un joueur du match la
-- reprend), « rouvrir » (une feuille scellée repart des chiffres que porte
-- la saison, corrections de l'admin comprises). Reprendre et rouvrir
-- copient des chiffres de la saison dans une feuille que toute la ligue lit :
-- jamais sur une journée en brouillon, ni pour deux camps qui ne forment pas
-- un match de la journée (relecture du 01/11). Libérer, toujours.
create or replace function public.feuille_admin(p_j int, p_noirs text, p_blancs text, p_geste text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi uuid := auth.uid();
  nom text;
  doc jsonb;
  n   int;
  f   public.feuilles_direct;
  refus text;
begin
  if not public.is_league_admin() then
    raise exception 'Réservé à l''admin.' using errcode = '42501';
  end if;
  select p.name into nom from public.profiles p where p.id = moi;
  select s.data into doc from public.saison s where s.id = 1;
  n := coalesce(public.entier_sur(doc ->> 'numero'), 0);
  if p_geste in ('reprendre', 'rouvrir') then
    refus := public.feuille_hors_jeu(doc, p_j, p_noirs, p_blancs);
    if refus is not null then
      select * into f from public.feuilles_direct x
       where x.saison = n and x.j = p_j and x.noirs = p_noirs and x.blancs = p_blancs;
      return jsonb_build_object('ok', false, 'refus', refus, 'feuille', case when f.saison is not null then to_jsonb(f) end);
    end if;
  end if;
  if p_geste = 'reprendre' then
    insert into public.feuilles_direct (saison, j, noirs, blancs, preneur, preneur_nom, pris_le, compteurs)
    values (n, p_j, p_noirs, p_blancs, moi, nom, now(), public.compteurs_du_document(doc, p_j, p_noirs, p_blancs))
    on conflict (saison, j, noirs, blancs) do update
      set preneur = excluded.preneur, preneur_nom = excluded.preneur_nom, pris_le = now(), maj_le = now()
      where public.feuilles_direct.fin is null
    returning * into f;
  elsif p_geste = 'liberer' then
    update public.feuilles_direct x
       set preneur = null, preneur_nom = null, maj_le = now()
     where x.saison = n and x.j = p_j and x.noirs = p_noirs and x.blancs = p_blancs and x.fin is null
    returning * into f;
  elsif p_geste = 'rouvrir' then
    update public.feuilles_direct x
       set fin = null, scelle_par = null, version = null, maj_le = now(),
           compteurs = public.compteurs_du_document(doc, p_j, p_noirs, p_blancs)
     where x.saison = n and x.j = p_j and x.noirs = p_noirs and x.blancs = p_blancs and x.fin is not null
    returning * into f;
  else
    return jsonb_build_object('ok', false, 'refus', 'geste');
  end if;
  if f.saison is null then
    select * into f from public.feuilles_direct x
     where x.saison = n and x.j = p_j and x.noirs = p_noirs and x.blancs = p_blancs;
    return jsonb_build_object('ok', false, 'refus', case when f.fin is not null then 'scellee' else 'sans-feuille' end,
                              'feuille', case when f.saison is not null then to_jsonb(f) end);
  end if;
  return jsonb_build_object('ok', true, 'feuille', to_jsonb(f));
end;
$$;
revoke execute on function public.feuille_admin(int, text, text, text) from public, anon;
grant execute on function public.feuille_admin(int, text, text, text) to authenticated;

-- « Fin du match » : la feuille se scelle et ses chiffres entrent dans la
-- saison, par celui qui la tient (ou l'admin). Le document est relu sous
-- verrou et seules les lignes du match changent (appliquer_feuille) ; la
-- version avance comme pour une publication de l'admin, si bien que
-- l'historique garde l'état d'avant (saison_garde_trace, avec le joueur pour
-- auteur), que les téléphones relisent la saison (saison_signal) et qu'un
-- appareil d'admin resté sur l'ancienne version doit reprendre la base.
-- Un joueur ne scelle que la feuille d'un match qu'il joue encore, sur une
-- journée publiée ; l'admin scelle toute feuille ouverte (relecture du 01/11).
create or replace function public.sceller_feuille(p_j int, p_noirs text, p_blancs text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  moi      uuid := auth.uid();
  nom      text;
  admin    boolean := public.is_league_admin();
  doc      jsonb;
  neuf     jsonb;
  courante bigint;
  nouvelle bigint;
  n        int;
  defauts  text[];
  refus    text;
  f        public.feuilles_direct;
begin
  select p.name into nom from public.profiles p where p.id = moi and p.valide;
  if nom is null then
    raise exception 'Réservé aux joueurs de la ligue.' using errcode = '42501';
  end if;
  select s.data, s.version into doc, courante from public.saison s where s.id = 1 for update;
  if doc is null then
    return jsonb_build_object('ok', false, 'refus', 'sans-saison');
  end if;
  n := coalesce(public.entier_sur(doc ->> 'numero'), 0);
  select * into f from public.feuilles_direct x
   where x.saison = n and x.j = p_j and x.noirs = p_noirs and x.blancs = p_blancs
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'refus', 'sans-feuille');
  end if;
  if f.fin is not null then
    return jsonb_build_object('ok', false, 'refus', 'scellee', 'feuille', to_jsonb(f));
  end if;
  if f.preneur is distinct from moi and not admin then
    return jsonb_build_object('ok', false, 'refus', 'pas-preneur', 'feuille', to_jsonb(f));
  end if;
  if not admin then
    refus := public.feuille_hors_jeu(doc, p_j, p_noirs, p_blancs);
    if refus is null and not public.joue_le_match(doc, p_j, p_noirs, p_blancs, nom) then
      refus := 'pas-ton-match';
    end if;
    if refus is not null then
      return jsonb_build_object('ok', false, 'refus', refus, 'feuille', to_jsonb(f));
    end if;
  end if;
  neuf := doc || jsonb_build_object('entries', public.appliquer_feuille(doc, p_j, p_noirs, p_blancs, f.compteurs));
  defauts := public.feuille_saine(neuf, doc);
  if cardinality(defauts) > 0 then
    raise exception 'Feuille refusée : %', array_to_string(defauts, ' · ')
      using errcode = 'P0001', hint = 'feuille-saine', detail = array_to_string(defauts, '|');
  end if;
  nouvelle := greatest((extract(epoch from clock_timestamp()) * 1000)::bigint, coalesce(courante, 0) + 1);
  perform set_config('sfl.publication_saison', 'oui', true);
  update public.saison s set data = neuf, version = nouvelle, updated_at = now() where s.id = 1;
  perform set_config('sfl.publication_saison', '', true);
  update public.feuilles_direct x
     set fin = now(), scelle_par = moi, version = nouvelle, maj_le = now()
   where x.saison = n and x.j = p_j and x.noirs = p_noirs and x.blancs = p_blancs
  returning * into f;
  return jsonb_build_object('ok', true, 'version', nouvelle, 'feuille', to_jsonb(f));
end;
$$;
revoke execute on function public.sceller_feuille(int, text, text) from public, anon;
grant execute on function public.sceller_feuille(int, text, text) to authenticated;

-- ─────────────────────── Les cartons de la SFL (01/11/2026) ───────────────────────
-- Sabri, 01/11 : « à chaque fois que je vais mettre un retard à quelqu'un
-- […] cette personne-là reçoit un carton […] une animation qu'il reçoit dès
-- qu'il ouvre l'appli […] au bout de 3 cartons jaunes […] un carton rouge
-- [qui] lui bloque la prochaine journée ». Rien n'est stocké des cartons
-- eux-mêmes : ils se lisent dans les retards de la saison (lib/sfl/cartons.ts,
-- dès la J4 de la saison 1). La base ne garde que ceux que le joueur a déjà
-- vus, pour ne pas lui rejouer l'animation sur un autre téléphone. Posé par
-- le joueur seul (RLS « mise à jour de soi »), comme nouveautes_vues.
alter table public.profiles add column if not exists cartons_vus text[] not null default '{}';
grant update (cartons_vus) on public.profiles to authenticated;
