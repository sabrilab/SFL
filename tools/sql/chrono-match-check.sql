-- Le banc SQL du chrono de la feuille en direct (23/11/2026,
-- public.chronos_direct, public.chrono_direct, public.chronos_du_jour).
--
-- À jouer sur un Postgres 16 local (ou une branche Supabase), JAMAIS sur la
-- base de la ligue : tools/sql/supabase-reduit.sql sur un Postgres nu, puis
-- supabase/schema.sql deux fois, puis ce fichier. Les données (celles de
-- feuille-direct-donnees.sql) sont posées dans une transaction annulée.
--
--   psql -v ON_ERROR_STOP=1 -f tools/sql/chrono-match-check.sql

\set ON_ERROR_STOP 1
begin;
\ir feuille-direct-donnees.sql

create function pg_temp.en(qui text, appel text) returns jsonb language plpgsql as $$
declare r jsonb; uid uuid;
begin
  select id into uid from public.profiles where name = qui and id::text like 'd0000000-%';
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  execute 'select (' || appel || ')::jsonb' into r;
  reset role;
  return r;
exception when others then
  reset role;
  return jsonb_build_object('erreur', sqlerrm, 'code', sqlstate);
end; $$;

create function pg_temp.ecrire_en(qui text, ordre text) returns text language plpgsql as $$
declare n bigint; uid uuid;
begin
  select id into uid from public.profiles where name = qui and id::text like 'd0000000-%';
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  execute ordre;
  get diagnostics n = row_count;
  reset role;
  return n::text;
exception when others then
  reset role;
  return 'refus ' || sqlerrm;
end; $$;

create function pg_temp.vrai(nom text, cond boolean, detail text default '') returns text language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC % %', nom, detail; end if;
  return nom || ' ok';
end; $$;

create function pg_temp.geste(qui text, g text, m int default 0) returns jsonb language sql as $$
  select pg_temp.en(qui, format('public.chrono_direct(4, %L, %L, %L, %s)', 'Noirs 1', 'Blancs 1', g, m));
$$;

-- 1 · Un joueur ne touche pas au chrono ; il le lit.
select pg_temp.vrai('1a joueur refusé', (pg_temp.geste('Théo', 'lancer') ->> 'code') = '42501', pg_temp.geste('Théo', 'lancer')::text);
select pg_temp.vrai('1b écriture directe refusée',
  pg_temp.ecrire_en('Ilyes', $q$insert into public.chronos_direct (saison, j, noirs, blancs, lance_le) values (1, 4, 'X', 'Y', now())$q$) like 'refus%');

-- 2 · Avant le coup d'envoi : ni 2e mi-temps, ni minutes.
select pg_temp.vrai('2a seconde avant', (pg_temp.geste('Ilyes', 'seconde') ->> 'ok')::boolean = false);
select pg_temp.vrai('2b ajout avant', (pg_temp.geste('Ilyes', 'ajout', 1) ->> 'ok')::boolean = false);
select pg_temp.vrai('2c rien en base', not exists (select 1 from public.chronos_direct));

-- 3 · Le coup d'envoi, à l'heure de la base ; relancé, le premier reste.
select pg_temp.vrai('3a lancer', (pg_temp.geste('Ilyes', 'lancer') -> 'chrono' ->> 'mt') = '1');
update public.chronos_direct set lance_le = now() - interval '10 minutes';
select pg_temp.vrai('3b relancer refusé', (pg_temp.geste('Sabri', 'lancer') ->> 'ok')::boolean = false);
select pg_temp.vrai('3c le premier reste', (select lance_le < now() - interval '9 minutes' from public.chronos_direct));
select pg_temp.vrai('3d maintenant rendu', (pg_temp.geste('Ilyes', 'lancer') ->> 'maintenant') is not null);

-- 4 · Les minutes s'ajoutent (deux appareils : +2), ±5 par geste, 30 au plus.
select pg_temp.geste('Ilyes', 'ajout', 1);
select pg_temp.geste('Sabri', 'ajout', 1);
select pg_temp.vrai('4a +2', (select ajout1 = 2 and ajout2 = 0 from public.chronos_direct));
select pg_temp.geste('Ilyes', 'ajout', -50);
select pg_temp.vrai('4b −5 au plus par geste', (select ajout1 = -3 from public.chronos_direct));
select pg_temp.geste('Ilyes', 'ajout', 5) from generate_series(1, 10);
select pg_temp.vrai('4c 30 au plus', (select ajout1 = 30 from public.chronos_direct));
select pg_temp.vrai('4d par', (select par_nom = 'Sabri' or par_nom = 'Ilyes' from public.chronos_direct));

-- 5 · La 2e mi-temps : une fois, ses minutes à elle.
select pg_temp.vrai('5a seconde', (pg_temp.geste('Ilyes', 'seconde') -> 'chrono' ->> 'mt') = '2');
select pg_temp.vrai('5b une seule fois', (pg_temp.geste('Sabri', 'seconde') ->> 'ok')::boolean = false);
select pg_temp.geste('Ilyes', 'ajout', -1);
select pg_temp.vrai('5c ajout2', (select ajout1 = 30 and ajout2 = -1 from public.chronos_direct));

-- 6 · La lecture du jour : la ligue lit, l'anonyme non.
select pg_temp.vrai('6a lu par un joueur', jsonb_array_length(pg_temp.en('Théo', 'public.chronos_du_jour(4)') -> 'chronos') = 1);
select pg_temp.vrai('6b select par un joueur', pg_temp.ecrire_en('Théo', 'select 1 from public.chronos_direct') = '1');
select pg_temp.vrai('6c autre journée vide', jsonb_array_length(pg_temp.en('Théo', 'public.chronos_du_jour(3)') -> 'chronos') = 0);
set local role anon;
select pg_temp.vrai('6d anon sans droit', not has_function_privilege('anon', 'public.chronos_du_jour(int)', 'execute'));
reset role;

-- 7 · Remettre à zéro, puis relancer.
select pg_temp.vrai('7a remettre', (pg_temp.geste('Ilyes', 'remettre') ->> 'ok')::boolean);
select pg_temp.vrai('7a plus de ligne', not exists (select 1 from public.chronos_direct));
select pg_temp.vrai('7b relancer', (pg_temp.geste('Ilyes', 'lancer') -> 'chrono' ->> 'ajout1') = '0');
select pg_temp.vrai('7c geste inconnu', (pg_temp.geste('Ilyes', 'pause') ->> 'refus') = 'geste');

rollback;
