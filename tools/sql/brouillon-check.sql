-- Le banc SQL de la journée en brouillon et de la feuille saine (30/10/2026).
-- À jouer sur une branche Supabase (ou un Postgres 16 local) : d'abord un schéma
-- réduit (ci-dessous, partie STUB), puis le bloc « Journée en brouillon » de
-- supabase/schema.sql (de « ─── Journée en brouillon » à la fin de publier_saison,
-- puis de « La lecture des joueurs (30/10/2026) » à l'ajout de saison_signal au
-- temps réel) dans le fichier :l1a, deux fois de suite, enfin la partie TEST.
-- Résultats attendus : T3 ok, T4 cinq REFUS, T5/T6 sans la J4 pour le joueur, T7 ok puis REFUS.

-- ═══ STUB ═══
-- Le strict nécessaire de Supabase et de schema.sql pour essayer l1a.sql / l1b.sql.
create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
create table public.profiles (
  id uuid primary key, name text not null unique, is_admin boolean not null default false,
  valide boolean not null default true
);
alter table public.profiles enable row level security;
create function public.is_league_admin() returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_admin) $$;
create function public.est_membre() returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.valide) $$;
create policy "profiles: lecture" on public.profiles for select to authenticated using ((select public.est_membre()));
grant usage on schema public to anon, authenticated;
grant select on public.profiles to authenticated;
create table public.saison (
  id int primary key default 1 check (id = 1), data jsonb not null, version bigint not null,
  seed int not null default 0, updated_at timestamptz not null default now()
);
alter table public.saison enable row level security;
create policy "saison: lecture ligue" on public.saison for select to authenticated using ((select public.est_membre()));
create policy "saison: écriture admin" on public.saison for all to authenticated
  using ((select public.is_league_admin())) with check ((select public.is_league_admin()));
grant select, insert, update on public.saison to authenticated;
create function public.saison_par_publication() returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and coalesce(current_setting('sfl.publication_saison', true), '') <> 'oui' then
    raise exception 'Mets l''app à jour' using errcode = 'P0001', hint = 'saison-app-a-jour';
  end if;
  return new;
end; $$;
create trigger saison_par_publication before insert or update on public.saison
  for each row execute function public.saison_par_publication();

insert into public.profiles (id, name, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'Ilyes', true),
  ('00000000-0000-0000-0000-00000000000b', 'Sabri', true),
  ('00000000-0000-0000-0000-00000000000c', 'Théo', false);

-- J1 à J3 publiées ; la J2 a déjà un doublon ancien (ne doit rien bloquer).
insert into public.saison (id, data, version) values (1, '{
  "numero": 2,
  "journees": [
    {"j": 1, "date": "12 oct.", "sflTime": true},
    {"j": 2, "date": "19 oct.", "sflTime": true},
    {"j": 3, "date": "26 oct.", "sflTime": true, "brouillon": null}
  ],
  "entries": [
    {"j": 1, "player": "Ilyes", "team": "Noirs 1", "statut": "Présent", "result": "Victoire"},
    {"j": 2, "player": "Théo", "team": "Noirs 1", "statut": "Présent", "result": "Victoire"},
    {"j": 2, "player": "Théo", "team": "Blancs 1", "statut": "Présent", "result": "Défaite"},
    {"j": 3, "player": "Ilyes", "team": "Blancs 1", "statut": "Présent", "result": null}
  ],
  "events": [{"j": 3, "minute": 4, "team": "Blancs 1", "player": "Ilyes"}],
  "roster": [{"name": "Ilyes"}, {"name": "Sabri"}, {"name": "Théo"}]
}', 100);

-- ═══ TEST ═══ (remplacer les chemins \i par ceux de vos fichiers)
\set ON_ERROR_STOP 1
-- 1 · Sabri ne joue pas ; un réglage ultérieur n'est pas écrasé par un nouveau passage.
select 'T1 sabri joue', joue from public.profiles where name = 'Sabri';
update public.profiles set joue = true where name = 'Sabri';
\i ./l1a.sql
select 'T1 rejoué, reste', joue from public.profiles where name = 'Sabri';
update public.profiles set joue = false where name = 'Sabri';

-- 2 · sans_brouillons.
select 'T2 est_brouillon', public.est_brouillon('{"brouillon":{"depuis":"x"}}'), public.est_brouillon('{"brouillon":true}'),
       public.est_brouillon('{"brouillon":null}'), public.est_brouillon('{}'), public.est_brouillon('{"brouillon":false}');
select 'T2 filtre', jsonb_path_query_array(public.sans_brouillons(d), '$.journees[*].j'),
       jsonb_array_length(public.sans_brouillons(d) -> 'entries'), jsonb_array_length(public.sans_brouillons(d) -> 'events')
  from (select (data || '{"journees":[{"j":1,"date":"a"},{"j":4,"date":"b","brouillon":{"depuis":"x"}},{"j":2,"date":"c"}],
                          "events":[{"j":4},{"j":1}]}')::jsonb as d from public.saison) s;

-- Fonctions d'essai : publier en tant qu'Ilyes.
create function pg_temp.publier(p jsonb, forcer boolean default false) returns text language plpgsql as $$
declare r jsonb; v bigint; h text;
begin
  select version into v from public.saison where id = 1;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
  set local role authenticated;
  r := public.publier_saison(p, 0, v, forcer);
  reset role;
  return r::text;
exception when others then
  get stacked diagnostics h = pg_exception_hint;
  reset role;
  return 'REFUS ' || sqlerrm || ' [' || coalesce(h, '') || ']';
end; $$;
grant execute on function pg_temp.publier(jsonb, boolean) to authenticated;

-- 3 · Une J4 saine, en brouillon : acceptée (le vieux doublon de la J2 ne bloque pas).
select 'T3 J4 saine', pg_temp.publier(data
  || jsonb_build_object('journees', data -> 'journees' || '[{"j":4,"date":"2 nov.","sflTime":true,"brouillon":{"depuis":"t","par":"Ilyes"}}]')
  || jsonb_build_object('entries', data -> 'entries' || '[{"j":4,"player":"Ilyes","team":"Noirs 1","statut":"Présent"},
                                                         {"j":4,"player":"Théo","team":"Blancs 1","statut":"Présent"},
                                                         {"j":4,"player":"Ilyes","team":"Blancs 1","statut":"Présent","extraTime":true}]'))
  from public.saison;
-- 4 · Les refus.
select 'T4 doublon', pg_temp.publier(data || jsonb_build_object('entries', data -> 'entries' || '[{"j":4,"player":"ilyes ","team":"Blancs 1","statut":"Présent"}]')) from public.saison;
select 'T4 doublon forcé', pg_temp.publier(data || jsonb_build_object('entries', data -> 'entries' || '[{"j":4,"player":"Ilyes","team":"Blancs 1","statut":"Présent"}]'), true) from public.saison;
select 'T4 sabri', pg_temp.publier(data || jsonb_build_object('entries', data -> 'entries' || '[{"j":4,"player":"Sabri","team":"Blancs 1","statut":"Présent"}]')) from public.saison;
select 'T4 vitrine', pg_temp.publier(data || jsonb_build_object('entries', data -> 'entries' || '[{"j":4,"player":"Toto","team":"Blancs 1","statut":"Présent","vitrine":true}]')) from public.saison;
select 'T4 même date', pg_temp.publier(data || jsonb_build_object('journees', data -> 'journees' || '[{"j":5,"date":"2 nov."}]')) from public.saison;
select 'T4 version', version, jsonb_array_length(data -> 'entries') from public.saison;

-- 5 · Le signal suit la version ; un joueur lit sans le brouillon.
select 'T5 signal = version', (select version from public.saison_signal) = (select version from public.saison);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select 'T5 joueur, saison_publique', jsonb_path_query_array(data, '$.journees[*].j'), jsonb_array_length(data -> 'entries') from public.saison_publique();
select 'T5 joueur, table brute (avant L1b)', count(*) from public.saison;
select 'T5 joueur, signal', count(*) from public.saison_signal;
reset role;

-- 6 · L1b.
\i ./l1b.sql
set role authenticated;
select 'T6 joueur, table brute (après L1b)', count(*) from public.saison;
select 'T6 joueur, saison_publique', jsonb_path_query_array(data, '$.journees[*].j') from public.saison_publique();
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select 'T6 admin, table brute', jsonb_path_query_array(data, '$.journees[*].j') from public.saison;
reset role;
-- 7 · Réparer une J2 qui a déjà un doublon ancien : modifier une autre ligne de la J2 passe ; ajouter un 3e Théo est refusé.
select 'T7 J2 autre ligne', pg_temp.publier(jsonb_set(data, '{entries,0,result}', '"Nul"')) from public.saison;
select 'T7 J2 3e Théo', pg_temp.publier(data || jsonb_build_object('entries', data -> 'entries' || '[{"j":2,"player":"Théo","team":"Blancs 1","statut":"Présent"}]')) from public.saison;
