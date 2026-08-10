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

-- À l'inscription, le profil est créé par trigger depuis les métadonnées
-- d'identité (nom, pseudo). is_admin est FORCÉ à false : les métadonnées sont
-- modifiables par l'utilisateur, elles ne portent jamais d'autorisation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, username, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'username', '@' || split_part(new.email, '@', 1)),
    -- L'admin est reconnu par son email technique EXACT (jamais par les
    -- métadonnées, modifiables par l'utilisateur). La fenêtre de risque se
    -- limite à la période d'inscriptions ouvertes, refermée sitôt les comptes
    -- créés — et le compte ilyes est créé en premier.
    new.email = 'ilyes@sfl.local'
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

drop policy if exists "profiles: lecture ligue" on public.profiles;
create policy "profiles: lecture ligue"
  on public.profiles for select
  to authenticated
  using (true);

-- Chacun ne modifie que sa fiche. L'auto-promotion admin est déjà impossible :
-- le grant de colonnes (plus bas) ne permet de modifier que name et username.
drop policy if exists "profiles: mise à jour de soi" on public.profiles;
create policy "profiles: mise à jour de soi"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

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

alter table public.convocations enable row level security;

drop policy if exists "convocations: lecture ligue" on public.convocations;
create policy "convocations: lecture ligue"
  on public.convocations for select
  to authenticated
  using (true);

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
  using (true);

-- Mais personne ne répond à la place d'un autre.
drop policy if exists "presence: je réponds pour moi" on public.presence;
create policy "presence: je réponds pour moi"
  on public.presence for insert
  to authenticated
  with check ((select auth.uid()) = player_id);

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
grant update (name, username) on public.profiles to authenticated;
grant insert, update, delete on public.presence to authenticated;
grant insert, update, delete on public.convocations to authenticated;

-- Diffusion temps réel : les réponses apparaissent sans rafraîchir.
do $$
begin
  alter publication supabase_realtime add table public.presence;
exception
  when duplicate_object then null;
end;
$$;

-- ───────────────────────── Rôle admin ────────────────────────────────
-- À exécuter APRÈS la création des comptes (l'étape « Créer les comptes »
-- de la page /admin/setup). Sans effet tant que le compte n'existe pas.
update public.profiles set is_admin = true where username = '@ilyes';
