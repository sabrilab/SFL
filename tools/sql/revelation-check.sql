-- Le banc SQL de la fin du vote et de la fin des matchs (02/11/2026,
-- src/lib/sfl/revelation.ts ; supabase/schema.sql, « L'heure du vote, la fin
-- des matchs »).
--
-- À jouer sur un Postgres 16 local (ou une branche Supabase), JAMAIS sur la
-- base de la ligue : d'abord tools/sql/supabase-reduit.sql sur un Postgres
-- nu, puis supabase/schema.sql en entier, deux fois de suite, puis ce fichier
-- (depuis tools/sql, pour l'\ir des données) :
--
--   psql -v ON_ERROR_STOP=1 -f tools/sql/revelation-check.sql
--
-- Tout se passe dans une transaction annulée à la fin : rien ne reste.
-- Chaque ligne finit par « ok » ; le fichier s'arrête au premier ÉCHEC.
--   1 · sceller_feuille pose le tampon quand la dernière feuille du jour l'est ;
--   2 · fin_du_vote donne les heures de revelation-check.ts (J4 minuit ;
--       15 h 10 → 18 h ; 17 h 40 → 18 h 40 ; 22 h 30 → 23 h 30 ; 23 h 15 →
--       minuit ; sans tampon minuit ; brouillon et date illisible null ;
--       l'heure d'été ; la saison 2 dès la J1) ;
--   3 · vote_ouvert : 17 h 59 ouvert, 18 h fermé, la veille fermé ; la J4
--       ouverte à 23 h 59, fermée à minuit ;
--   4 · les politiques de votes_figures : la J4 du jour acceptée, une J5
--       d'hier refusée (même avec `jour` d'aujourd'hui), un brouillon refusé ;
--   5 · le tampon : posé une fois, gardé sans lui, jamais déplacé ; une
--       valeur de l'app à plus de 5 min remplacée, à moins gardée ; retiré
--       d'une journée pas finie ou d'un autre jour ; publier_saison le garde ;
--   6 · feuille_saine refuse une vue figée.

\set ON_ERROR_STOP 1
begin;

-- ═══ Données ═══ (comptes de test, saison 1 avec la J4 du jour)
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

-- Une heure de Paris : « 2026-11-08 18:00 » → l'instant.
create function pg_temp.p(t text) returns timestamptz language sql immutable as $$
  select t::timestamp at time zone 'Europe/Paris'
$$;

-- Poser un document tel quel, sans le déclencheur du tampon (les heures d'essai sont d'autres jours).
create function pg_temp.poser(doc jsonb) returns void language plpgsql as $$
begin
  alter table public.saison disable trigger saison_fin_des_matchs;
  update public.saison set data = doc where id = 1;
  alter table public.saison enable trigger saison_fin_des_matchs;
end; $$;

-- Le tampon d'une journée, tel qu'il est en base.
create function pg_temp.tampon(j int) returns text language sql stable as $$
  select m ->> 'finDesMatchs' from public.saison s, jsonb_array_elements(s.data -> 'journees') m
   where s.id = 1 and (m ->> 'j')::int = j
$$;

create function pg_temp.iso(t timestamptz) returns text language sql stable as $$
  select to_char(t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

-- ═══ 1 · sceller_feuille pose le tampon ═══
select pg_temp.vrai('T1 pas de tampon avant', pg_temp.tampon(4) is null);
select pg_temp.vrai('T1 Théo prend le match 1', (pg_temp.en('Théo', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T1 Théo scelle le match 1', (pg_temp.en('Théo', $$public.sceller_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T1 un match encore à jouer : pas de tampon', pg_temp.tampon(4) is null);
select pg_temp.vrai('T1 Kader prend le match 2', (pg_temp.en('Kader', $$public.prendre_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T1 Kader scelle le match 2', (pg_temp.en('Kader', $$public.sceller_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T1 la dernière feuille scellée : le tampon', pg_temp.tampon(4) is not null
  and abs(extract(epoch from public.instant_sur(pg_temp.tampon(4)) - now())) < 5, coalesce(pg_temp.tampon(4), 'null'));

-- ═══ 2 · Les heures de la fin du vote ═══
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb, 'entries', '[]'::jsonb,
  'journees', jsonb_build_array(
    jsonb_build_object('j', 4, 'date', '1 nov.', 'sflTime', true),
    jsonb_build_object('j', 5, 'date', '8 nov.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-11-08 15:10'))),
    jsonb_build_object('j', 6, 'date', '15 nov.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-11-15 17:40'))),
    jsonb_build_object('j', 7, 'date', '22 nov.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-11-22 22:30'))),
    jsonb_build_object('j', 8, 'date', '29 nov.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-11-29 23:15'))),
    jsonb_build_object('j', 9, 'date', '6 déc.', 'sflTime', true),
    jsonb_build_object('j', 10, 'date', '13 déc.', 'sflTime', true, 'brouillon', '{"depuis":"x","par":"Sabri"}'::jsonb),
    jsonb_build_object('j', 11, 'date', 'bientôt', 'sflTime', true))));
select pg_temp.vrai('T2 J4 : minuit', public.fin_du_vote_a(1, 4, pg_temp.p('2026-11-01 12:00')) = pg_temp.p('2026-11-02 00:00'));
select pg_temp.vrai('T2 J5, 15 h 10 : 18 h', public.fin_du_vote_a(1, 5, pg_temp.p('2026-11-08 12:00')) = pg_temp.p('2026-11-08 18:00'));
select pg_temp.vrai('T2 17 h 40 : 18 h 40', public.fin_du_vote_a(1, 6, pg_temp.p('2026-11-15 12:00')) = pg_temp.p('2026-11-15 18:40'));
select pg_temp.vrai('T2 22 h 30 : 23 h 30', public.fin_du_vote_a(1, 7, pg_temp.p('2026-11-22 12:00')) = pg_temp.p('2026-11-22 23:30'));
select pg_temp.vrai('T2 23 h 15 : minuit', public.fin_du_vote_a(1, 8, pg_temp.p('2026-11-29 12:00')) = pg_temp.p('2026-11-30 00:00'));
select pg_temp.vrai('T2 sans tampon : minuit', public.fin_du_vote_a(1, 9, pg_temp.p('2026-12-06 12:00')) = pg_temp.p('2026-12-07 00:00'));
select pg_temp.vrai('T2 un brouillon : null', public.fin_du_vote_a(1, 10, pg_temp.p('2026-12-13 12:00')) is null);
select pg_temp.vrai('T2 une date illisible : null', public.fin_du_vote_a(1, 11, pg_temp.p('2026-12-13 12:00')) is null);
select pg_temp.vrai('T2 une autre saison : null', public.fin_du_vote_a(2, 5, pg_temp.p('2026-11-08 12:00')) is null);
-- L'heure d'été (dimanche 28 mars 2027) et la saison 2 dès sa J1.
select pg_temp.poser(jsonb_build_object('numero', 2, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb, 'entries', '[]'::jsonb,
  'journees', jsonb_build_array(
    jsonb_build_object('j', 1, 'date', '28 mars', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2027-03-28 15:00'))),
    jsonb_build_object('j', 2, 'date', '4 avr.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2027-04-04 17:30'))))));
select pg_temp.vrai('T2 heure d''été : 18 h à Paris = 16 h UTC', public.fin_du_vote_a(2, 1, pg_temp.p('2027-03-28 12:00')) = '2027-03-28 16:00:00+00'::timestamptz);
select pg_temp.vrai('T2 heure d''été : 17 h 30 → 18 h 30', public.fin_du_vote_a(2, 2, pg_temp.p('2027-04-04 12:00')) = pg_temp.p('2027-04-04 18:30'));

-- ═══ 3 · vote_ouvert ═══
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb, 'entries', '[]'::jsonb,
  'journees', jsonb_build_array(
    jsonb_build_object('j', 4, 'date', '1 nov.', 'sflTime', true),
    jsonb_build_object('j', 5, 'date', '8 nov.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-11-08 15:00'))))));
select pg_temp.vrai('T3 J5 17 h 59 : ouvert', public.vote_ouvert_a(1, 5, pg_temp.p('2026-11-08 17:59')));
select pg_temp.vrai('T3 J5 18 h 00 : fermé', not public.vote_ouvert_a(1, 5, pg_temp.p('2026-11-08 18:00')));
select pg_temp.vrai('T3 J5 la veille : fermé', not public.vote_ouvert_a(1, 5, pg_temp.p('2026-11-07 12:00')));
select pg_temp.vrai('T3 J4 23 h 59 : ouvert', public.vote_ouvert_a(1, 4, pg_temp.p('2026-11-01 23:59')));
select pg_temp.vrai('T3 J4 00 h 00 : fermé', not public.vote_ouvert_a(1, 4, pg_temp.p('2026-11-02 00:00')));

-- ═══ 4 · Les politiques de votes_figures ═══
-- La J4 du jour (ancien régime : jusqu'à minuit), une J5 d'hier, une J6 du jour en brouillon.
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb, 'entries', '[]'::jsonb,
  'journees', jsonb_build_array(
    jsonb_build_object('j', 4, 'date', pg_temp.libelle((now() at time zone 'Europe/Paris')::date), 'sflTime', true),
    jsonb_build_object('j', 5, 'date', pg_temp.libelle((now() at time zone 'Europe/Paris')::date - 1), 'sflTime', true),
    jsonb_build_object('j', 6, 'date', pg_temp.libelle((now() at time zone 'Europe/Paris')::date), 'sflTime', true,
      'brouillon', '{"depuis":"x","par":"Sabri"}'::jsonb))));
select pg_temp.vrai('T4 vote_ouvert J4 du jour', public.vote_ouvert(1, 4));
select pg_temp.vrai('T4 vote_ouvert J5 d''hier', not public.vote_ouvert(1, 5));
select pg_temp.vrai('T4 la J4 du jour : acceptée', pg_temp.ecrire_en('Théo', $$insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour)
  values (1, 4, 'impact', 'Théo', 'Badis', 'm1', (now() at time zone 'Europe/Paris')::date)$$) = '1');
select pg_temp.vrai('T4 changer d''avis sur la J4 : accepté', pg_temp.ecrire_en('Théo', $$update public.votes_figures set candidat = 'Sami'
  where saison = 1 and j = 4 and votant = 'Théo'$$) = '1');
select pg_temp.vrai('T4 la J5 d''hier, daté du jour : refusée', pg_temp.ecrire_en('Théo', $$insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour)
  values (1, 5, 'impact', 'Théo', 'Badis', 'm1', (now() at time zone 'Europe/Paris')::date)$$) like 'refus%');
select pg_temp.vrai('T4 un brouillon : refusé', pg_temp.ecrire_en('Théo', $$insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour)
  values (1, 6, 'impact', 'Théo', 'Badis', 'm1', (now() at time zone 'Europe/Paris')::date)$$) like 'refus%');
-- Un vote de la J5 déjà là (posé avant la fermeture) ne se change plus.
insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour, votant_id)
  select 1, 5, 'def', 'Théo', 'Badis', 'm1', (now() at time zone 'Europe/Paris')::date, id from public.profiles where name = 'Théo' and id::text like 'd0000000-%';
select pg_temp.vrai('T4 changer d''avis sur la J5 fermée : rien', pg_temp.ecrire_en('Théo', $$update public.votes_figures set candidat = 'Sami'
  where saison = 1 and j = 5 and votant = 'Théo'$$) = '0');

-- ═══ 5 · Le tampon de la fin des matchs ═══
create function pg_temp.jour(d int default 0) returns text language sql stable as $$
  select pg_temp.libelle((now() at time zone 'Europe/Paris')::date + d)
$$;
create function pg_temp.match(j int, resultat text) returns jsonb language sql immutable as $$
  select jsonb_build_array(
    jsonb_build_object('j', j, 'player', 'Théo', 'team', 'Noirs 1', 'statut', 'Présent', 'result', resultat, 'buts', 0, 'passes', 0),
    jsonb_build_object('j', j, 'player', 'Badis', 'team', 'Blancs 1', 'statut', 'Présent',
      'result', case resultat when 'Victoire' then 'Défaite' when 'Défaite' then 'Victoire' else resultat end, 'buts', 0, 'passes', 0))
$$;
-- La J5 du jour, posée, pas jouée.
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true)),
  'entries', pg_temp.match(5, null)));
-- Le résultat saisi (l'éditeur, comme le ferait publier_saison) : le tampon se pose.
update public.saison set data = jsonb_set(data, '{entries}', pg_temp.match(5, 'Victoire')) where id = 1;
select pg_temp.vrai('T5 posé à la fin des matchs', abs(extract(epoch from public.instant_sur(pg_temp.tampon(5)) - now())) < 5, coalesce(pg_temp.tampon(5), 'null'));
create temp table t5 as select pg_temp.tampon(5) as v;
-- Une écriture qui ne le porte pas : gardé.
update public.saison set data = jsonb_set(data, '{journees}', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true))) where id = 1;
select pg_temp.vrai('T5 gardé sans lui', pg_temp.tampon(5) = (select v from t5));
-- Une écriture qui en porte un autre (à 2 min) : jamais déplacé.
update public.saison set data = jsonb_set(data, '{journees}', jsonb_build_array(
  jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true, 'finDesMatchs', pg_temp.iso(now() - interval '2 minutes')))) where id = 1;
select pg_temp.vrai('T5 jamais déplacé', pg_temp.tampon(5) = (select v from t5));
-- Rouverte (un match sans résultat) : gardé.
update public.saison set data = jsonb_set(data, '{entries}', pg_temp.match(5, 'Victoire') || jsonb_build_array(
  jsonb_build_object('j', 5, 'player', 'Kader', 'team', 'Noirs 2', 'statut', 'Présent', 'result', null, 'buts', 0, 'passes', 0))) where id = 1;
select pg_temp.vrai('T5 rouverte : gardé', pg_temp.tampon(5) = (select v from t5));
-- La valeur de l'app : gardée à 2 min de l'heure du serveur, remplacée à 1 h ;
-- retirée d'une journée pas finie, ou d'un autre jour.
update public.saison set data = data || jsonb_build_object(
  'journees', data -> 'journees' || jsonb_build_array(
    jsonb_build_object('j', 6, 'date', pg_temp.jour(), 'sflTime', true, 'finDesMatchs', pg_temp.iso(now() - interval '2 minutes')),
    jsonb_build_object('j', 7, 'date', pg_temp.jour(), 'sflTime', true, 'finDesMatchs', pg_temp.iso(now() - interval '1 hour')),
    jsonb_build_object('j', 8, 'date', pg_temp.jour(), 'sflTime', true, 'finDesMatchs', pg_temp.iso(now())),
    jsonb_build_object('j', 9, 'date', pg_temp.jour(-1), 'sflTime', true, 'finDesMatchs', pg_temp.iso(now()))),
  'entries', data -> 'entries' || pg_temp.match(6, 'Nul') || pg_temp.match(7, 'Victoire') || pg_temp.match(8, null) || pg_temp.match(9, 'Nul'))
 where id = 1;
select pg_temp.vrai('T5 à 2 min : la valeur de l''app', abs(extract(epoch from public.instant_sur(pg_temp.tampon(6)) - (now() - interval '2 minutes'))) < 0.01);
select pg_temp.vrai('T5 à 1 h : l''heure du serveur', abs(extract(epoch from public.instant_sur(pg_temp.tampon(7)) - now())) < 5);
select pg_temp.vrai('T5 pas finie : retiré', pg_temp.tampon(8) is null);
select pg_temp.vrai('T5 un autre jour : retiré', pg_temp.tampon(9) is null);
-- publier_saison (l'admin, insert … on conflict) : le tampon en base l'emporte.
select pg_temp.vrai('T5 publier sans le tampon', (pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, false)',
  (select jsonb_set(data, '{journees,0}', (data -> 'journees' -> 0) - 'finDesMatchs') from public.saison where id = 1),
  (select version from public.saison where id = 1))) ->> 'ok') = 'true');
select pg_temp.vrai('T5 publier : gardé', pg_temp.tampon(5) = (select v from t5));

-- ═══ 6 · Une vue figée ne se publie pas ═══
select pg_temp.vrai('T6 feuille_saine refuse figee', 'I10 vue figée' = any (public.feuille_saine(
  (select data || '{"figee":{"a":"x","caches":[5]}}'::jsonb from public.saison where id = 1),
  (select data from public.saison where id = 1))));
select pg_temp.vrai('T6 publier une vue figée : refusé', (pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, true)',
  (select data || '{"figee":{"a":"x","caches":[5]}}'::jsonb from public.saison where id = 1),
  (select version from public.saison where id = 1))) ->> 'hint') = 'feuille-saine');

select 'revelation-check : tout est ok' as bilan;
rollback;
