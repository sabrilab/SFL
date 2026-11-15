-- Le banc SQL de la main de l'admin sur le vote (15/11/2026,
-- src/lib/sfl/revelation.ts ; supabase/schema.sql, public.fin_du_vote_meta,
-- public.revelation_meta, public.saison_fin_des_matchs). Le miroir de
-- tools/votes-main-check.ts.
--
-- À jouer sur un Postgres 16 local (ou une branche Supabase), JAMAIS sur la
-- base de la ligue : d'abord tools/sql/supabase-reduit.sql sur un Postgres
-- nu, puis supabase/schema.sql en entier, deux fois de suite, puis ce fichier
-- (depuis tools/sql, pour l'\ir des données) :
--
--   psql -v ON_ERROR_STOP=1 -f tools/sql/votes-main-check.sql
--
-- Tout se passe dans une transaction annulée à la fin : rien ne reste.
-- Chaque ligne finit par « ok » ; le fichier s'arrête au premier ÉCHEC.
--   1 · les heures (J6 du 15 novembre, F = 18 h 11 min 55 s) : sans geste
--       19 h 11 min 55 s et 20 h 11 min 55 s ; gardé ouvert, minuit et
--       minuit ; fermé à 18 h 20, 18 h 20 et 19 h 20 ; fermé à 23 h 30,
--       révélé à minuit ; les deux gestes, la fermeture l'emporte ; un geste
--       d'un autre jour ou illisible, la règle ; sans fin des matchs ;
--   2 · fin_du_vote_a et vote_ouvert_a lisent ces gestes dans le document ;
--       l'ancien régime et une journée en suspens les ignorent ;
--   3 · les politiques de votes_figures : fermé à la main, le vote est
--       refusé ; gardé ouvert, il passe ;
--   4 · le déclencheur : la main bouge librement avant la révélation, sans
--       toucher à la fin des matchs ; une journée révélée garde la main
--       qu'elle avait (un geste tardif est retiré, un geste effacé est
--       remis), une correction de stat passe ; publier_saison de même, y
--       compris quand la publication tardive rouvre une feuille (les deux
--       passages d'insert … on conflict) ; la première écriture passe ;
--       publier_saison rend la main gardée (`mains`) ; une main qui
--       révélerait la journée sur-le-champ est refusée, fermer à l'instant
--       reste accepté ;
--   5 · les deux fonctions sont fermées aux joueurs.
-- Les essais de 3 et 4 se font « maintenant » : entre minuit et 0 h 02, un
-- geste « d'il y a une minute » date de la veille, et ces lignes sont
-- passées (elles le disent).

\set ON_ERROR_STOP 1
begin;

-- ═══ Données ═══ (comptes de test)
\ir feuille-direct-donnees.sql

create function pg_temp.en(qui text, appel text) returns jsonb language plpgsql as $$
declare r jsonb; h text; uid uuid;
begin
  select id into uid from public.profiles where name = qui and id::text like 'd0000000-%';
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  execute 'select (' || appel || ')::jsonb' into r;
  reset role;
  return r;
exception when others then
  get stacked diagnostics h = pg_exception_hint;
  reset role;
  return jsonb_build_object('erreur', sqlerrm, 'hint', h);
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

-- Une heure de Paris : « 2026-11-15 18:00 » → l'instant.
create function pg_temp.p(t text) returns timestamptz language sql immutable as $$
  select t::timestamp at time zone 'Europe/Paris'
$$;

create function pg_temp.iso(t timestamptz) returns text language sql stable as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- Poser un document tel quel, sans le déclencheur du tampon.
create function pg_temp.poser(doc jsonb) returns void language plpgsql as $$
begin
  alter table public.saison disable trigger saison_fin_des_matchs;
  update public.saison set data = doc where id = 1;
  alter table public.saison enable trigger saison_fin_des_matchs;
end; $$;

-- Un champ de la journée j, tel qu'il est en base.
create function pg_temp.lu(j int, cle text) returns text language sql stable as $$
  select m ->> cle from public.saison s, jsonb_array_elements(s.data -> 'journees') m
   where s.id = 1 and (m ->> 'j')::int = j
$$;

create function pg_temp.jour(d int default 0) returns text language sql stable as $$
  select pg_temp.libelle((now() at time zone 'Europe/Paris')::date + d)
$$;

create function pg_temp.match(j int, resultat text, buts int default 0) returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('j', j, 'player', 'Théo', 'team', 'Noirs 1', 'statut', 'Présent', 'result', resultat, 'buts', buts, 'passes', 0),
    jsonb_build_object('j', j, 'player', 'Badis', 'team', 'Blancs 1', 'statut', 'Présent',
      'result', case resultat when 'Victoire' then 'Défaite' when 'Défaite' then 'Victoire' else resultat end, 'buts', 0, 'passes', 0))
$$;

-- Un geste « d'il y a une minute » date-t-il bien d'aujourd'hui (pas entre minuit et 0 h 02) ?
create function pg_temp.en_journee() returns boolean language sql stable as $$
  select ((now() - interval '2 minutes') at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
$$;

-- ═══ 1 · Les heures ═══
create temp table h as select
  date '2026-11-15' as jour,
  pg_temp.p('2026-11-15 18:11:55') as f,
  pg_temp.p('2026-11-16 00:00') as minuit;
select pg_temp.vrai('V1 sans geste : F + 1 h, puis une heure après',
  public.fin_du_vote_meta('{}'::jsonb, jour, f) = pg_temp.p('2026-11-15 19:11:55')
  and public.revelation_meta('{}'::jsonb, jour, f) = pg_temp.p('2026-11-15 20:11:55')
  and public.fin_du_vote_meta('{}'::jsonb, jour, f) = public.fin_du_vote_de(jour, f)
  and public.revelation_meta('{}'::jsonb, jour, f) = public.revelation_de(jour, f)) from h;
select pg_temp.vrai('V1 gardé ouvert : minuit, et la révélation à minuit',
  public.fin_du_vote_meta(jsonb_build_object('votesOuvertsLe', pg_temp.iso(pg_temp.p('2026-11-15 18:40'))), jour, f) = minuit
  and public.revelation_meta(jsonb_build_object('votesOuvertsLe', pg_temp.iso(pg_temp.p('2026-11-15 18:40'))), jour, f) = minuit) from h;
select pg_temp.vrai('V1 fermé à 18 h 20 : 18 h 20, révélé à 19 h 20',
  public.fin_du_vote_meta(jsonb_build_object('votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-15 18:20'))), jour, f) = pg_temp.p('2026-11-15 18:20')
  and public.revelation_meta(jsonb_build_object('votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-15 18:20'))), jour, f) = pg_temp.p('2026-11-15 19:20')) from h;
select pg_temp.vrai('V1 fermé à 21 h : révélé à 22 h',
  public.revelation_meta(jsonb_build_object('votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-15 21:00'))), jour, f) = pg_temp.p('2026-11-15 22:00')) from h;
select pg_temp.vrai('V1 fermé à 23 h 30 : révélé à minuit, jamais après',
  public.revelation_meta(jsonb_build_object('votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-15 23:30'))), jour, f) = minuit) from h;
select pg_temp.vrai('V1 les deux gestes : la fermeture l''emporte',
  public.fin_du_vote_meta(jsonb_build_object('votesOuvertsLe', pg_temp.iso(pg_temp.p('2026-11-15 18:40')),
    'votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-15 18:50'))), jour, f) = pg_temp.p('2026-11-15 18:50')) from h;
select pg_temp.vrai('V1 un geste d''un autre jour : la règle',
  public.fin_du_vote_meta(jsonb_build_object('votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-08 18:20'))), jour, f) = pg_temp.p('2026-11-15 19:11:55')
  and public.fin_du_vote_meta(jsonb_build_object('votesOuvertsLe', pg_temp.iso(pg_temp.p('2026-11-08 18:20'))), jour, f) = pg_temp.p('2026-11-15 19:11:55')
  and public.fin_du_vote_meta(jsonb_build_object('votesOuvertsLe', pg_temp.iso(pg_temp.p('2026-11-16 00:00'))), jour, f) = pg_temp.p('2026-11-15 19:11:55')) from h;
select pg_temp.vrai('V1 un geste illisible : la règle',
  public.fin_du_vote_meta('{"votesFermesLe":"hier soir","votesOuvertsLe":""}'::jsonb, jour, f) = pg_temp.p('2026-11-15 19:11:55')
  and public.fin_du_vote_meta('{"votesFermesLe":null,"votesOuvertsLe":12}'::jsonb, jour, f) = pg_temp.p('2026-11-15 19:11:55')
  and public.fin_du_vote_meta(null, jour, f) = pg_temp.p('2026-11-15 19:11:55')) from h;
select pg_temp.vrai('V1 sans fin des matchs : minuit, fermé à la main, gardé ouvert',
  public.fin_du_vote_meta('{}'::jsonb, jour, null) = minuit
  and public.fin_du_vote_meta(jsonb_build_object('votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-15 18:20'))), jour, null) = pg_temp.p('2026-11-15 18:20')
  and public.fin_du_vote_meta(jsonb_build_object('votesOuvertsLe', pg_temp.iso(pg_temp.p('2026-11-15 18:40'))), jour, null) = minuit) from h;
-- La première et la dernière seconde du jour (Paris).
select pg_temp.vrai('V1 un geste à 0 h 00 du jour compte, à 0 h 00 du lendemain non',
  public.fin_du_vote_meta(jsonb_build_object('votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-15 00:00'))), jour, f) = pg_temp.p('2026-11-15 00:00')
  and public.fin_du_vote_meta(jsonb_build_object('votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-15 23:59:59'))), jour, f) = pg_temp.p('2026-11-15 23:59:59')
  and public.fin_du_vote_meta(jsonb_build_object('votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-16 00:00'))), jour, f) = pg_temp.p('2026-11-15 19:11:55')) from h;

-- ═══ 2 · Le document : fin_du_vote_a, vote_ouvert_a ═══
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb, 'entries', '[]'::jsonb,
  'journees', jsonb_build_array(
    jsonb_build_object('j', 4, 'date', '15 nov.', 'sflTime', true, 'votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-15 18:20'))),
    jsonb_build_object('j', 6, 'date', '15 nov.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-11-15 18:11:55'))),
    jsonb_build_object('j', 7, 'date', '15 nov.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-11-15 18:11:55')),
      'votesOuvertsLe', pg_temp.iso(pg_temp.p('2026-11-15 18:40'))),
    jsonb_build_object('j', 8, 'date', '15 nov.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-11-15 18:11:55')),
      'votesFermesLe', pg_temp.iso(pg_temp.p('2026-11-15 18:20'))),
    jsonb_build_object('j', 9, 'date', '15 nov.', 'sflTime', true, 'votesOuvertsLe', pg_temp.iso(pg_temp.p('2026-11-15 18:40')),
      'suspens', '{"le":"2026-11-15T16:00:00.000Z","par":"Ilyes"}'::jsonb),
    jsonb_build_object('j', 10, 'date', '15 nov.', 'sflTime', true, 'votesOuvertsLe', pg_temp.iso(pg_temp.p('2026-11-15 18:40')),
      'brouillon', '{"depuis":"x","par":"Sabri"}'::jsonb))));
select pg_temp.vrai('V2 sans geste : 19 h 11 min 55 s', public.fin_du_vote_a(1, 6, pg_temp.p('2026-11-15 12:00')) = pg_temp.p('2026-11-15 19:11:55'));
select pg_temp.vrai('V2 gardé ouvert : minuit', public.fin_du_vote_a(1, 7, pg_temp.p('2026-11-15 12:00')) = pg_temp.p('2026-11-16 00:00'));
select pg_temp.vrai('V2 fermé à la main : 18 h 20', public.fin_du_vote_a(1, 8, pg_temp.p('2026-11-15 12:00')) = pg_temp.p('2026-11-15 18:20'));
select pg_temp.vrai('V2 l''ancien régime ignore la main : minuit', public.fin_du_vote_a(1, 4, pg_temp.p('2026-11-15 12:00')) = pg_temp.p('2026-11-16 00:00'));
select pg_temp.vrai('V2 en suspens, en brouillon : pas de vote', public.fin_du_vote_a(1, 9, pg_temp.p('2026-11-15 12:00')) is null
  and public.fin_du_vote_a(1, 10, pg_temp.p('2026-11-15 12:00')) is null);
select pg_temp.vrai('V2 sans geste : ouvert à 19 h 11, fermé à 19 h 12', public.vote_ouvert_a(1, 6, pg_temp.p('2026-11-15 19:11'))
  and not public.vote_ouvert_a(1, 6, pg_temp.p('2026-11-15 19:12')));
select pg_temp.vrai('V2 gardé ouvert : ouvert à 19 h 12 et à 23 h 59, fermé à minuit', public.vote_ouvert_a(1, 7, pg_temp.p('2026-11-15 19:12'))
  and public.vote_ouvert_a(1, 7, pg_temp.p('2026-11-15 23:59'))
  and not public.vote_ouvert_a(1, 7, pg_temp.p('2026-11-16 00:00'))
  and not public.vote_ouvert_a(1, 7, pg_temp.p('2026-11-14 23:59')));
select pg_temp.vrai('V2 fermé à la main : ouvert à 18 h 19, fermé à 18 h 20', public.vote_ouvert_a(1, 8, pg_temp.p('2026-11-15 18:19'))
  and not public.vote_ouvert_a(1, 8, pg_temp.p('2026-11-15 18:20'))
  and not public.vote_ouvert_a(1, 8, pg_temp.p('2026-11-15 19:00')));

-- ═══ 3 · Les politiques de votes_figures, maintenant ═══
-- La J5 du jour (nouveau régime), sa fin des matchs il y a dix minutes.
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb, 'entries', pg_temp.match(5, 'Victoire'),
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true, 'mvpAuto', true,
    'finDesMatchs', pg_temp.iso(now() - interval '10 minutes'), 'votesFermesLe', pg_temp.iso(now() - interval '1 minute')))));
select pg_temp.vrai('V3 fermé à la main : vote_ouvert faux', not pg_temp.en_journee() or not public.vote_ouvert(1, 5),
  case when pg_temp.en_journee() then '' else '(passé : minuit)' end);
select pg_temp.vrai('V3 fermé à la main : le vote est refusé', not pg_temp.en_journee() or pg_temp.ecrire_en('Théo',
  $$insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour)
    values (1, 5, 'impact', 'Théo', 'Badis', 'm1', (now() at time zone 'Europe/Paris')::date)$$) like 'refus%');
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb, 'entries', pg_temp.match(5, 'Victoire'),
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true, 'mvpAuto', true,
    'finDesMatchs', pg_temp.iso(now() - interval '10 minutes'), 'votesOuvertsLe', pg_temp.iso(now() - interval '1 minute')))));
select pg_temp.vrai('V3 gardé ouvert : vote_ouvert vrai, jusqu''à minuit', not pg_temp.en_journee() or (public.vote_ouvert(1, 5)
  and public.fin_du_vote(1, 5) = ((((now() at time zone 'Europe/Paris')::date + 1)::timestamp) at time zone 'Europe/Paris')));
select pg_temp.vrai('V3 gardé ouvert : le vote passe', not pg_temp.en_journee() or pg_temp.ecrire_en('Théo',
  $$insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour)
    values (1, 5, 'impact', 'Théo', 'Badis', 'm1', (now() at time zone 'Europe/Paris')::date)$$) = '1');
select pg_temp.vrai('V3 gardé ouvert : changer d''avis passe', not pg_temp.en_journee() or pg_temp.ecrire_en('Théo',
  $$update public.votes_figures set candidat = 'Sami' where saison = 1 and j = 5 and votant = 'Théo'$$) = '1');
delete from public.votes_figures where saison = 1 and j = 5;

-- ═══ 4 · Le déclencheur ═══
-- La J5 du jour finie à l'instant : le tampon est posé par la base.
delete from public.fins_des_matchs;
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true, 'mvpAuto', true)),
  'entries', pg_temp.match(5, null)));
update public.saison set data = jsonb_set(data, '{entries}', pg_temp.match(5, 'Victoire')) where id = 1;
create temp table t4 as select pg_temp.lu(5, 'finDesMatchs') as f;
select pg_temp.vrai('V4 la fin des matchs posée', (select f from t4) is not null);
-- Avant la révélation, la main bouge librement.
update public.saison set data = jsonb_set(data, '{journees,0,votesOuvertsLe}', to_jsonb(pg_temp.iso(now()))) where id = 1;
select pg_temp.vrai('V4 gardé ouvert avant la révélation : accepté', pg_temp.lu(5, 'votesOuvertsLe') = pg_temp.iso(now())
  and pg_temp.lu(5, 'finDesMatchs') = (select f from t4), coalesce(pg_temp.lu(5, 'votesOuvertsLe'), 'null'));
update public.saison set data = jsonb_set(data #- '{journees,0,votesOuvertsLe}', '{journees,0,votesFermesLe}', to_jsonb(pg_temp.iso(now()))) where id = 1;
select pg_temp.vrai('V4 puis fermé : accepté, la fin des matchs tenue', pg_temp.lu(5, 'votesFermesLe') = pg_temp.iso(now())
  and pg_temp.lu(5, 'votesOuvertsLe') is null and pg_temp.lu(5, 'finDesMatchs') = (select f from t4));
update public.saison set data = jsonb_set(data #- '{journees,0,votesFermesLe}', '{journees,0,votesOuvertsLe}', to_jsonb(pg_temp.iso(now()))) where id = 1;
select pg_temp.vrai('V4 puis rouvert (pas encore révélée) : accepté', pg_temp.lu(5, 'votesOuvertsLe') = pg_temp.iso(now())
  and pg_temp.lu(5, 'votesFermesLe') is null);
-- Gardé ouvert, la journée rouverte (un résultat effacé) : avant la révélation (minuit), le tampon est retiré, la main reste.
update public.saison set data = jsonb_set(data, '{entries}', pg_temp.match(5, null)) where id = 1;
select pg_temp.vrai('V4 gardé ouvert, rouverte : la fin des matchs retirée, la main gardée', not pg_temp.en_journee()
  or (pg_temp.lu(5, 'finDesMatchs') is null and pg_temp.lu(5, 'votesOuvertsLe') = pg_temp.iso(now())));

-- Une J5 d'il y a 7 jours, révélée depuis longtemps : la main ne bouge plus.
delete from public.fins_des_matchs;
insert into public.fins_des_matchs (saison, j, jour, fin)
  values (1, 5, (now() at time zone 'Europe/Paris')::date - 7, now() - interval '7 days');
create temp table t4b as select pg_temp.iso(now() - interval '7 days') as f, pg_temp.iso(now() - interval '7 days' + interval '5 minutes') as geste;
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(-7), 'sflTime', true, 'mvpAuto', true, 'finDesMatchs', (select f from t4b))),
  'entries', pg_temp.match(5, 'Victoire')));
update public.saison set data = jsonb_set(data, '{journees,0,votesOuvertsLe}', to_jsonb((select geste from t4b))) where id = 1;
select pg_temp.vrai('V4 révélée : un « garder ouvert » tardif est retiré', pg_temp.lu(5, 'votesOuvertsLe') is null
  and pg_temp.lu(5, 'finDesMatchs') = (select f from t4b), coalesce(pg_temp.lu(5, 'votesOuvertsLe'), 'null'));
update public.saison set data = jsonb_set(data, '{journees,0,votesFermesLe}', to_jsonb((select geste from t4b))) where id = 1;
select pg_temp.vrai('V4 révélée : une fermeture tardive est retirée', pg_temp.lu(5, 'votesFermesLe') is null);
-- Une correction de stat après la révélation passe, la main intacte.
update public.saison set data = jsonb_set(data, '{entries}', pg_temp.match(5, 'Victoire', 3)) where id = 1;
select pg_temp.vrai('V4 révélée : une correction de stat passe', (select (data -> 'entries' -> 0 ->> 'buts')::int from public.saison where id = 1) = 3
  and pg_temp.lu(5, 'votesOuvertsLe') is null and pg_temp.lu(5, 'votesFermesLe') is null and pg_temp.lu(5, 'finDesMatchs') = (select f from t4b));
-- Révélée avec sa main (fermée à la main ce jour-là) : un document qui l'efface ou la change la retrouve.
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(-7), 'sflTime', true, 'mvpAuto', true, 'finDesMatchs', (select f from t4b),
    'votesFermesLe', (select geste from t4b))),
  'entries', pg_temp.match(5, 'Victoire')));
update public.saison set data = data #- '{journees,0,votesFermesLe}' where id = 1;
select pg_temp.vrai('V4 révélée : la fermeture effacée est remise', pg_temp.lu(5, 'votesFermesLe') = (select geste from t4b));
update public.saison set data = jsonb_set(data #- '{journees,0,votesFermesLe}', '{journees,0,votesOuvertsLe}', to_jsonb((select geste from t4b))) where id = 1;
select pg_temp.vrai('V4 révélée : la fermeture changée en ouverture est remise', pg_temp.lu(5, 'votesFermesLe') = (select geste from t4b)
  and pg_temp.lu(5, 'votesOuvertsLe') is null);
-- publier_saison (l'admin) : même garde, et la publication passe.
create temp table pub4 as select pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, false)',
  jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
    'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(-7), 'sflTime', true, 'mvpAuto', true, 'finDesMatchs', (select f from t4b),
      'votesOuvertsLe', (select geste from t4b))),
    'entries', pg_temp.match(5, 'Victoire', 2)),
  (select version from public.saison where id = 1))) as r;
select pg_temp.vrai('V4 publier_saison, révélée, un geste tardif : publié', ((select r from pub4) ->> 'ok') = 'true', (select r::text from pub4));
select pg_temp.vrai('V4 publier_saison rend la main gardée (`mains`) : l''appareil de l''admin la reprend',
  ((select r from pub4) -> 'mains' -> '5' ->> 'votesFermesLe') = (select geste from t4b)
  and jsonb_typeof((select r from pub4) -> 'mains' -> '5' -> 'votesOuvertsLe') = 'null', (select (r -> 'mains')::text from pub4));
select pg_temp.vrai('V4 publier_saison, révélée : la main d''avant, la correction passée', pg_temp.lu(5, 'votesOuvertsLe') is null
  and pg_temp.lu(5, 'votesFermesLe') = (select geste from t4b)
  and (select (data -> 'entries' -> 0 ->> 'buts')::int from public.saison where id = 1) = 2);
-- publier_saison, la J6 du jour finie à l'instant : le geste de l'admin est gardé.
select pg_temp.vrai('V4 publier_saison, la J6 du jour : « garder ouvert » publié', (pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, false)',
  jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
    'journees', jsonb_build_array(
      jsonb_build_object('j', 5, 'date', pg_temp.jour(-7), 'sflTime', true, 'mvpAuto', true, 'finDesMatchs', (select f from t4b), 'votesFermesLe', (select geste from t4b)),
      jsonb_build_object('j', 6, 'date', pg_temp.jour(), 'sflTime', true, 'mvpAuto', true, 'votesOuvertsLe', pg_temp.iso(now()))),
    'entries', pg_temp.match(5, 'Victoire', 2) || pg_temp.match(6, 'Nul')),
  (select version from public.saison where id = 1))) ->> 'ok') = 'true');
select pg_temp.vrai('V4 publier_saison, la J6 du jour : le geste gardé, la fin des matchs posée', pg_temp.lu(6, 'votesOuvertsLe') = pg_temp.iso(now())
  and pg_temp.lu(6, 'finDesMatchs') is not null and pg_temp.lu(5, 'votesFermesLe') = (select geste from t4b));
select pg_temp.vrai('V4 la J6 gardée ouverte : le vote tient jusqu''à minuit', not pg_temp.en_journee()
  or public.fin_du_vote(1, 6) = ((((now() at time zone 'Europe/Paris')::date + 1)::timestamp) at time zone 'Europe/Paris'));

-- Une publication tardive qui change la main ET rouvre une feuille (relecture
-- du 15/11) : publier_saison fait insert … on conflict, le déclencheur passe
-- deux fois. Au passage INSERT la main tardive doit déjà être remise, sinon
-- la révélation se lit avec elle (minuit), la fin des matchs est effacée et
-- la journée révélée est décomptée. La J5 du jour : finie il y a 3 h, fermée
-- à la main il y a 2 h, donc révélée depuis 1 h. (Avant 2 h 05 du matin, ces
-- gestes datent de la veille : les lignes sont passées.)
create function pg_temp.apres_2h() returns boolean language sql stable as $$
  select ((now() - interval '2 hours 5 minutes') at time zone 'Europe/Paris')::date = (now() at time zone 'Europe/Paris')::date
$$;
delete from public.fins_des_matchs;
insert into public.fins_des_matchs (saison, j, jour, fin)
  values (1, 5, (now() at time zone 'Europe/Paris')::date, now() - interval '3 hours');
create temp table t4c as select pg_temp.iso(now() - interval '3 hours') as f, pg_temp.iso(now() - interval '2 hours') as ferme,
  pg_temp.iso(now() - interval '61 minutes') as tardif;
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true, 'mvpAuto', true, 'finDesMatchs', (select f from t4c),
    'votesFermesLe', (select ferme from t4c))),
  'entries', pg_temp.match(5, 'Victoire')));
select pg_temp.vrai('V4 la J5 du jour, fermée à la main il y a 2 h : révélée', not pg_temp.apres_2h()
  or now() >= public.revelation_meta((select data -> 'journees' -> 0 from public.saison where id = 1), (now() at time zone 'Europe/Paris')::date, now() - interval '3 hours'));
select pg_temp.vrai('V4 publier_saison, révélée, la main changée et une feuille rouverte : publié', (pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, false)',
  jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
    'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true, 'mvpAuto', true,
      'votesOuvertsLe', (select tardif from t4c))),
    'entries', pg_temp.match(5, 'Victoire') || jsonb_build_array(
      jsonb_build_object('j', 5, 'player', 'Kader', 'team', 'Noirs 2', 'statut', 'Présent', 'result', null, 'buts', 0, 'passes', 0))),
  (select version from public.saison where id = 1))) ->> 'ok') = 'true');
select pg_temp.vrai('V4 … la fin des matchs gardée, la main d''avant remise : la journée reste comptée', not pg_temp.apres_2h()
  or (pg_temp.lu(5, 'finDesMatchs') = (select f from t4c)
    and exists (select 1 from public.fins_des_matchs where saison = 1 and j = 5)
    and pg_temp.lu(5, 'votesFermesLe') = (select ferme from t4c) and pg_temp.lu(5, 'votesOuvertsLe') is null
    and not public.vote_ouvert(1, 5)),
  coalesce(pg_temp.lu(5, 'finDesMatchs'), 'null') || ' / ouverts ' || coalesce(pg_temp.lu(5, 'votesOuvertsLe'), 'null') || ' / fermés ' || coalesce(pg_temp.lu(5, 'votesFermesLe'), 'null'));
-- Une main qui révélerait la journée sur-le-champ est refusée (relecture du
-- 15/11 : annuler après l'heure de la règle un « Garder les votes ouverts »,
-- ou rétablir une vieille fermeture). La J5 du jour gardée ouverte il y a
-- 2 h (révélation à minuit) ; un document rétablit une fermeture d'il y a
-- 2 h, dont la révélation est passée depuis 1 h.
delete from public.fins_des_matchs;
insert into public.fins_des_matchs (saison, j, jour, fin)
  values (1, 5, (now() at time zone 'Europe/Paris')::date, now() - interval '3 hours');
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true, 'mvpAuto', true, 'finDesMatchs', (select f from t4c),
    'votesOuvertsLe', (select ferme from t4c))),
  'entries', pg_temp.match(5, 'Victoire')));
update public.saison set data = jsonb_set(data #- '{journees,0,votesOuvertsLe}', '{journees,0,votesFermesLe}', to_jsonb((select ferme from t4c))) where id = 1;
select pg_temp.vrai('V4 une main qui révélerait la journée sur-le-champ : refusée, la main d''avant reste', not pg_temp.apres_2h()
  or (pg_temp.lu(5, 'votesOuvertsLe') = (select ferme from t4c) and pg_temp.lu(5, 'votesFermesLe') is null and public.vote_ouvert(1, 5)),
  'ouverts ' || coalesce(pg_temp.lu(5, 'votesOuvertsLe'), 'null') || ' / fermés ' || coalesce(pg_temp.lu(5, 'votesFermesLe'), 'null'));
-- Fermer à l'instant reste accepté : la révélation est dans une heure.
update public.saison set data = jsonb_set(data #- '{journees,0,votesOuvertsLe}', '{journees,0,votesFermesLe}', to_jsonb(pg_temp.iso(now()))) where id = 1;
select pg_temp.vrai('V4 fermer à l''instant : accepté', pg_temp.lu(5, 'votesFermesLe') = pg_temp.iso(now()) and pg_temp.lu(5, 'votesOuvertsLe') is null
  and pg_temp.lu(5, 'finDesMatchs') = (select f from t4c));

-- La première publication (table vide : un seul passage, INSERT) passe avec une main.
alter table public.saison disable trigger user;
delete from public.saison;
alter table public.saison enable trigger user;
delete from public.fins_des_matchs;
insert into public.saison (id, data, version, seed)
  values (1, jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
    'journees', jsonb_build_array(jsonb_build_object('j', 6, 'date', pg_temp.jour(), 'sflTime', true, 'mvpAuto', true, 'votesOuvertsLe', pg_temp.iso(now()))),
    'entries', pg_temp.match(6, 'Nul')), 1, 0);
select pg_temp.vrai('V4 première écriture (table vide) : la main gardée, la fin des matchs posée', pg_temp.lu(6, 'votesOuvertsLe') = pg_temp.iso(now())
  and pg_temp.lu(6, 'finDesMatchs') is not null);

-- ═══ 5 · Les droits ═══
select pg_temp.vrai('V5 fin_du_vote_meta et revelation_meta fermées aux joueurs',
  (pg_temp.en('Théo', $$to_jsonb(public.fin_du_vote_meta('{}'::jsonb, current_date, now()))$$)) ? 'erreur'
  and (pg_temp.en('Théo', $$to_jsonb(public.revelation_meta('{}'::jsonb, current_date, now()))$$)) ? 'erreur');

select 'votes-main-check : tout est ok' as bilan;
rollback;
