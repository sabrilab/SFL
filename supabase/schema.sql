-- Schéma SFL — à exécuter tel quel dans l'éditeur SQL de Supabase.
--
-- Deux tables suffisent pour la première étape : les comptes de la ligue
-- (liés à auth.users) et les réponses de présence. Le reste de la saison
-- (journées, lignes de match) restera local tant qu'on ne l'aura pas migré.

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

-- Tout le monde voit la liste des joueurs (classements, effectif).
create policy "profiles: lecture ligue"
  on public.profiles for select
  to authenticated
  using (true);

-- Chacun ne modifie que sa propre fiche.
create policy "profiles: mise à jour de soi"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─────────────────────────── Convocations ────────────────────────────
create table if not exists public.convocations (
  id          bigint generated always as identity primary key,
  journee     int not null,
  jour        text not null,
  date_label  text not null,
  heure       text not null,
  lieu        text not null,
  effectif    int not null default 10,
  statut      text not null default 'ouverte' check (statut in ('ouverte','cloturee')),
  created_at  timestamptz not null default now()
);

alter table public.convocations enable row level security;

create policy "convocations: lecture ligue"
  on public.convocations for select
  to authenticated
  using (true);

create policy "convocations: écriture admin"
  on public.convocations for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ──────────────────────────── Présence ───────────────────────────────
create table if not exists public.presence (
  convocation_id bigint not null references public.convocations(id) on delete cascade,
  player_id      uuid   not null references public.profiles(id) on delete cascade,
  reponse        text   not null check (reponse in ('present','absent')),
  updated_at     timestamptz not null default now(),
  primary key (convocation_id, player_id)
);

alter table public.presence enable row level security;

-- Toute la ligue voit qui vient : c'est le but même de la fonctionnalité.
create policy "presence: lecture ligue"
  on public.presence for select
  to authenticated
  using (true);

-- Mais personne ne répond à la place d'un autre.
create policy "presence: je réponds pour moi"
  on public.presence for insert
  to authenticated
  with check (auth.uid() = player_id);

create policy "presence: je modifie ma réponse"
  on public.presence for update
  to authenticated
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

create policy "presence: je retire ma réponse"
  on public.presence for delete
  to authenticated
  using (auth.uid() = player_id);

-- L'admin peut corriger une réponse (quelqu'un qui prévient par téléphone).
create policy "presence: correction admin"
  on public.presence for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Horodatage automatique des changements de réponse.
create or replace function public.touch_presence()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists presence_touch on public.presence;
create trigger presence_touch before update on public.presence
  for each row execute function public.touch_presence();

-- Diffusion temps réel : les réponses apparaissent sans rafraîchir.
alter publication supabase_realtime add table public.presence;
