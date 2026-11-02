-- Le banc SQL des matchs Bola antidatés (contrôle adverse des XP S, 02/11/2026).
-- Huit comptes d'accord montaient en novembre des matchs datés de juillet,
-- un par semaine passée : la feuille saisie aussitôt, confirmée entre eux,
-- chacun comptait dans sa semaine (13 XP S par semaine d'un coup). Ce banc
-- vérifie que :
--   · un joueur ne crée pas de match dont le coup d'envoi est passé de plus
--     de 24 h (match_naissance_gardee), ni ne le redate dans le passé avant
--     sa feuille (match_feuille_gardee) ; le reste de la fiche se modifie ;
--   · l'admin et le serveur (clé secrète) passent toujours ;
--   · match_bola_json rend l'heure de la première saisie (saisiLe), que le
--     calcul des XP S lit (lib/sfl/xp-s.ts, semaineXpSBola) ;
--   · le scénario du contrôle ne monte plus rien : mes_matchs_bola reste vide ;
--   · pronostiquer refuse une saison close (on posait le Flair de saison
--     d'une saison dont les vainqueurs étaient connus).
-- À jouer sur un Postgres 16 local, JAMAIS sur la base de la ligue :
-- tools/sql/supabase-reduit.sql sur un Postgres nu, supabase/schema.sql
-- (trois passages), puis
--   psql -v ON_ERROR_STOP=1 -f tools/sql/bola-dates-check.sql
-- Tout se passe dans une transaction annulée : rien ne reste. Chaque ligne
-- finit par ok ; le fichier s'arrête au premier ÉCHEC.

\set ON_ERROR_STOP 1
begin;

-- Huit comptes acceptés, venus par un lien (des filleuls : leurs matchs font leur carte Bola), et un admin.
insert into auth.users (id, email, raw_user_meta_data)
select ('b0000000-0000-0000-0000-00000000000' || k)::uuid, 'bd' || k || '@banc.local',
       jsonb_build_object('name', 'Datee' || k, 'username', '@datee' || k)
  from generate_series(1, 9) k;
update public.profiles set valide = true where id::text like 'b0000000-%';
update public.profiles set is_admin = true where id = 'b0000000-0000-0000-0000-000000000009';
insert into public.parrainages (filleul, parrain, canal)
select id, null, 'lien' from public.profiles where id::text like 'b0000000-%' and id <> 'b0000000-0000-0000-0000-000000000009';
-- La saison en cours : la 1 (pronostiquer lit son numéro).
insert into public.saison (id, data, version) values (1, '{"numero": 1, "journees": [], "entries": [], "roster": []}'::jsonb, 1)
on conflict (id) do update set data = jsonb_set(public.saison.data, '{numero}', '1'::jsonb);

create function pg_temp.vrai(nom text, cond boolean, detail text default '') returns text language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC % %', nom, detail; end if;
  return nom || ' ok';
end; $$;

-- Comme le compte k (son jeton), avec ses seuls droits : le résultat, ou « refus … ».
create function pg_temp.en(k int, ordre text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-00000000000' || k, true);
  set local role authenticated;
  execute ordre into r;
  reset role;
  return coalesce(r, 'null');
exception when others then
  reset role;
  return 'refus ' || sqlerrm;
end; $$;

-- Un match Bola ouvert par le compte k, au jour et à l'heure de Paris donnés : son id, ou « refus … ».
create function pg_temp.ouvrir(k int, jour date, heure text) returns text language plpgsql as $$
begin
  return pg_temp.en(k, format(
    $q$insert into public.matchs (visibilite, jour, heure, lieu, places, mode) values ('prive', %L, %L, 'Terrain', 10, 'bola') returning id::text$q$,
    jour, heure));
end; $$;

-- Un instant de Paris, en jour et heure (« 14h05 »).
create function pg_temp.jour_de(t timestamptz) returns date language sql as $$ select (t at time zone 'Europe/Paris')::date $$;
create function pg_temp.heure_de(t timestamptz) returns text language sql as $$ select to_char(t at time zone 'Europe/Paris', 'HH24"h"MI') $$;

create temp table r (k text primary key, v text);
grant all on r to authenticated, service_role;

-- 1 · Créé dans le passé : un match du 5 juillet, monté aujourd'hui (le scénario du contrôle) : refusé.
insert into r values ('1', pg_temp.ouvrir(1, pg_temp.jour_de(now() - interval '120 days'), '10h00'));
select pg_temp.vrai('1 antidaté de 120 jours : refusé', (select v from r where k = '1') like 'refus %match déjà passé%', (select v from r where k = '1'));
-- Juste au-delà de la marge : 25 h.
insert into r values ('1b', pg_temp.ouvrir(1, pg_temp.jour_de(now() - interval '25 hours'), pg_temp.heure_de(now() - interval '25 hours')));
select pg_temp.vrai('1b 25 h dans le passé : refusé', (select v from r where k = '1b') like 'refus %match déjà passé%', (select v from r where k = '1b'));

-- 2 · Le match du jour ouvert en retard (deux heures après son coup d'envoi) : il naît.
insert into r values ('2', pg_temp.ouvrir(1, pg_temp.jour_de(now() - interval '2 hours'), pg_temp.heure_de(now() - interval '2 hours')));
select pg_temp.vrai('2 deux heures de retard : il naît', (select v from r where k = '2') ~ '^\d+$', (select v from r where k = '2'));
-- Et un match à venir.
insert into r values ('2b', pg_temp.ouvrir(1, pg_temp.jour_de(now() + interval '30 days'), '19h00'));
select pg_temp.vrai('2b à venir : il naît', (select v from r where k = '2b') ~ '^\d+$', (select v from r where k = '2b'));

-- 3 · Redaté dans le passé avant sa feuille (créé pour dans un mois, puis ramené en septembre) : refusé.
select pg_temp.vrai('3 redaté 60 jours avant : refusé',
  pg_temp.en(1, format('update public.matchs set jour = %L where id = %s returning id::text', pg_temp.jour_de(now() - interval '60 days'), (select v from r where k = '2b'))) like 'refus %match déjà passé%');
select pg_temp.vrai('3 le jour n''a pas bougé', (select jour from public.matchs where id = (select v from r where k = '2b')::bigint) = pg_temp.jour_de(now() + interval '30 days'));
-- Redaté à une autre date à venir : il passe ; le lieu d'un match d'il y a deux heures, sans toucher à l'heure : il passe.
select pg_temp.vrai('3b redaté dans l''avenir',
  pg_temp.en(1, format('update public.matchs set jour = %L where id = %s returning id::text', pg_temp.jour_de(now() + interval '31 days'), (select v from r where k = '2b'))) ~ '^\d+$');
select pg_temp.vrai('3c le lieu d''un match passé se change',
  pg_temp.en(1, format('update public.matchs set lieu = %L where id = %s returning lieu', 'Autre terrain', (select v from r where k = '2'))) = 'Autre terrain');

-- 4 · L'admin et le serveur passent.
select pg_temp.vrai('4 l''admin crée un match passé', pg_temp.ouvrir(9, pg_temp.jour_de(now() - interval '120 days'), '10h00') ~ '^\d+$');
with x as (
  insert into public.matchs (organisateur, visibilite, jour, heure, lieu, places, mode)
  values ('b0000000-0000-0000-0000-000000000001', 'prive', pg_temp.jour_de(now() - interval '120 days'), '10h00', 'Terrain', 10, 'bola') returning id
)
insert into r select '4b', id::text from x;
select pg_temp.vrai('4b le serveur (clé secrète) crée un match passé', exists (select 1 from r where k = '4b'));

-- 5 · La feuille du match ouvert en retard : saisiLe la date, à l'heure du serveur, et match_bola_json la rend.
do $$
declare mid bigint := (select v from r where k = '2')::bigint; q int; lignes jsonb;
begin
  perform set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  insert into public.match_joueurs (match_id, player_id, statut)
  select mid, ('b0000000-0000-0000-0000-00000000000' || g.n)::uuid, case when g.n = 1 then 'inscrit' else 'invite' end
    from generate_series(1, 8) g(n);
  reset role;
  for q in 2..8 loop
    perform set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-00000000000' || q, true);
    set local role authenticated;
    update public.match_joueurs set statut = 'inscrit' where match_id = mid and player_id = ('b0000000-0000-0000-0000-00000000000' || q)::uuid;
    reset role;
  end loop;
  select jsonb_agg(jsonb_build_object('playerId', 'b0000000-0000-0000-0000-00000000000' || g.n,
                                      'equipe', case when g.n <= 4 then 'clairs' else 'fonces' end, 'buts', 1, 'passes', 0))
    into lignes from generate_series(1, 8) g(n);
  perform set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', true);
  set local role authenticated;
  perform public.enregistrer_feuille_bola(mid, 4, 4, lignes);
  reset role;
end $$;
select pg_temp.vrai('5 la feuille datée', (select saisi_le from public.matchs where id = (select v from r where k = '2')::bigint) is not null);
select pg_temp.vrai('5 match_bola_json rend saisiLe',
  (public.match_bola_json((select v from r where k = '2')::bigint) ->> 'saisiLe')::timestamptz = (select saisi_le from public.matchs where id = (select v from r where k = '2')::bigint),
  public.match_bola_json((select v from r where k = '2')::bigint)::text);
select pg_temp.vrai('5 saisiLe : une valeur du serveur, jamais avant le coup d''envoi',
  (select saisi_le >= public.coup_d_envoi(jour, heure) from public.matchs where id = (select v from r where k = '2')::bigint));

-- 6 · Le scénario du contrôle : trois matchs datés de trois semaines passées, chacun refusé à la naissance ; rien à confirmer, rien dans mes_matchs_bola de Datee8.
select pg_temp.vrai('6 trois matchs antidatés refusés',
  (select count(*) from generate_series(1, 3) k where pg_temp.ouvrir(1, pg_temp.jour_de(now() - make_interval(days => 120 - 7 * k)), '10h00') like 'refus %match déjà passé%') = 3);
select pg_temp.vrai('6 mes_matchs_bola de Datee8 : seulement le match du jour',
  (select count(*) from jsonb_array_elements(pg_temp.en(8, 'select public.mes_matchs_bola()::text')::jsonb) x
    where (x ->> 'jour')::date < pg_temp.jour_de(now() - interval '24 hours')) = 0);

-- 7 · pronostiquer : la saison en cours seulement.
select pg_temp.vrai('7 le Flair de la saison 0, close : refusé', pg_temp.en(2, 'select public.pronostiquer(0, 0, ''buteur'', ''Datee1'')::text') like 'refus %Saison close%');
select pg_temp.vrai('7 la saison 1, en cours : posé', pg_temp.en(2, 'select public.pronostiquer(1, 0, ''buteur'', ''Datee1'')::text') !~ '^refus');
select pg_temp.vrai('7 une journée d''une saison close : refusée', pg_temp.en(2, 'select public.pronostiquer(0, 3, ''pepite'', ''Datee1'')::text') like 'refus %Saison close%');

rollback;
