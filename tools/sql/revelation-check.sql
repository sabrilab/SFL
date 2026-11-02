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
--   1 · sceller_feuille pose le tampon quand la dernière feuille du jour l'est
--       (nouveau régime) ; jamais sur la J4 de la saison 1 ;
--   2 · fin_du_vote donne les heures de revelation-check.ts (J4 minuit ;
--       15 h 10 → 18 h ; 17 h 40 → 18 h 40 ; 22 h 30 → 23 h 30 ; 23 h 15 →
--       minuit ; sans tampon minuit ; brouillon et date illisible null ;
--       l'heure d'été ; la saison 2 dès la J1 ; F = 17 h 00 min 01 s → 18 h 00
--       min 01 s ; les deux changements d'heure) ;
--   3 · vote_ouvert : 17 h 59 ouvert, 18 h fermé, la veille fermé ; la J4
--       ouverte à 23 h 59, fermée à minuit ;
--   4 · les politiques de votes_figures : la J4 du jour acceptée, une J5
--       d'hier refusée (même avec `jour` d'aujourd'hui), un brouillon refusé ;
--   5 · le tampon : posé une fois, gardé sans lui, jamais déplacé tant que la
--       journée reste finie ; retiré d'une journée rouverte avant sa
--       révélation, reposé à sa nouvelle dernière feuille ; une valeur de
--       l'app à plus de 5 min remplacée, à moins gardée ; retiré d'une
--       journée pas finie ou d'un autre jour ; publier_saison le garde et le
--       rend (`fins`) ;
--   6 · feuille_saine refuse une vue figée ;
--   7 · relecture du 02/11 : la corbeille (retirée puis remise) et la clôture
--       annulée gardent le tampon ; rouverte après la révélation, gardé ; la
--       valeur de l'app réécrite au format de l'app ; fin_du_vote et
--       vote_ouvert fermés à qui n'est pas de la ligue ; une date illisible
--       refusée (I11) ; la feuille d'un match tardif se prend jusqu'à 1 h ;
--       une feuille rouverte puis scellée de nouveau avant la révélation
--       déplace F à ce sceau, après la révélation non ;
--       les politiques de votes_figures à 17 h 59 et 18 h 00 (l'horloge
--       fixée le temps du banc).

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
create temp table doc0 as select data from public.saison where id = 1;
-- La J4 de la saison 1 (l'ancien régime) : ses feuilles scellées, jamais de tampon.
select pg_temp.vrai('T1 J4 : Théo prend et scelle le match 1', (pg_temp.en('Théo', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true'
  and (pg_temp.en('Théo', $$public.sceller_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T1 J4 : Kader prend et scelle le match 2', (pg_temp.en('Kader', $$public.prendre_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true'
  and (pg_temp.en('Kader', $$public.sceller_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T1 la J4 de la saison 1 finie : jamais de tampon', pg_temp.tampon(4) is null
  and not exists (select 1 from public.fins_des_matchs where saison = 1 and j = 4));
-- La même journée en saison 2 (le nouveau régime dès la J1).
select pg_temp.poser(jsonb_set((select data from doc0), '{numero}', '2'));
select pg_temp.vrai('T1 pas de tampon avant', pg_temp.tampon(4) is null);
select pg_temp.vrai('T1 Théo prend le match 1', (pg_temp.en('Théo', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T1 Théo scelle le match 1', (pg_temp.en('Théo', $$public.sceller_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T1 un match encore à jouer : pas de tampon', pg_temp.tampon(4) is null);
select pg_temp.vrai('T1 Kader prend le match 2', (pg_temp.en('Kader', $$public.prendre_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T1 Kader scelle le match 2', (pg_temp.en('Kader', $$public.sceller_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T1 la dernière feuille scellée : le tampon', pg_temp.tampon(4) is not null
  and abs(extract(epoch from public.instant_sur(pg_temp.tampon(4)) - now())) < 5, coalesce(pg_temp.tampon(4), 'null'));
select pg_temp.vrai('T1 au format de l''app, gardé à part', pg_temp.tampon(4) ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
  and (select pg_temp.iso(fin) from public.fins_des_matchs where saison = 2 and j = 4) = pg_temp.tampon(4));
delete from public.fins_des_matchs;

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
-- Aux bords, et les deux changements d'heure (relecture du 02/11).
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb, 'entries', '[]'::jsonb,
  'journees', jsonb_build_array(
    jsonb_build_object('j', 4, 'date', '1 nov.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-11-01 15:00'))),
    jsonb_build_object('j', 5, 'date', '8 nov.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-11-08 17:00:01'))),
    jsonb_build_object('j', 6, 'date', '25 oct.', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2026-10-25 15:00'))),
    jsonb_build_object('j', 7, 'date', '28 mars', 'sflTime', true, 'finDesMatchs', pg_temp.iso(pg_temp.p('2027-03-28 23:15'))))));
select pg_temp.vrai('T2 J4 avec un tampon : toujours minuit', public.fin_du_vote_a(1, 4, pg_temp.p('2026-11-01 12:00')) = pg_temp.p('2026-11-02 00:00'));
select pg_temp.vrai('T2 F = 17 h 00 min 01 s : 18 h 00 min 01 s', public.fin_du_vote_a(1, 5, pg_temp.p('2026-11-08 12:00')) = pg_temp.p('2026-11-08 18:00:01'));
select pg_temp.vrai('T2 18 h 00 min 00 s ouvert, 18 h 00 min 01 s fermé',
  public.vote_ouvert_a(1, 5, pg_temp.p('2026-11-08 18:00:00')) and not public.vote_ouvert_a(1, 5, pg_temp.p('2026-11-08 18:00:01')));
select pg_temp.vrai('T2 25/10 (passage à l''hiver) : 17 h 59 ouvert, 18 h fermé (17 h UTC)',
  public.vote_ouvert_a(1, 6, pg_temp.p('2026-10-25 17:59')) and not public.vote_ouvert_a(1, 6, '2026-10-25 17:00:00+00'));
select pg_temp.vrai('T2 28/03 (passage à l''été), F 23 h 15 : 23 h 59 ouvert, minuit fermé (22 h UTC)',
  public.vote_ouvert_a(1, 7, pg_temp.p('2027-03-28 23:59')) and not public.vote_ouvert_a(1, 7, '2027-03-28 22:00:00+00'));
select pg_temp.vrai('T2 révélation : 19 h, 19 h 40, minuit',
  public.revelation_de('2026-11-08', pg_temp.p('2026-11-08 15:10')) = pg_temp.p('2026-11-08 19:00')
  and public.revelation_de('2026-11-08', pg_temp.p('2026-11-08 17:40')) = pg_temp.p('2026-11-08 19:40')
  and public.revelation_de('2026-11-08', pg_temp.p('2026-11-08 22:30')) = pg_temp.p('2026-11-09 00:00'));

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
-- Rouverte avant sa révélation (un match ajouté, sans résultat) : retiré —
-- sa dernière feuille n'est plus remplie.
update public.saison set data = jsonb_set(data, '{entries}', pg_temp.match(5, 'Victoire') || jsonb_build_array(
  jsonb_build_object('j', 5, 'player', 'Kader', 'team', 'Noirs 2', 'statut', 'Présent', 'result', null, 'buts', 0, 'passes', 0))) where id = 1;
select pg_temp.vrai('T5 rouverte avant la révélation : retiré', pg_temp.tampon(5) is null
  and not exists (select 1 from public.fins_des_matchs where saison = 1 and j = 5));
select pg_temp.vrai('T5 le vote rouvre (minuit, la butée)', public.fin_du_vote(1, 5) = ((((now() at time zone 'Europe/Paris')::date + 1)::timestamp) at time zone 'Europe/Paris'));
-- Sa nouvelle dernière feuille remplie : reposé (l'heure du serveur, l'ancienne valeur portée par l'app ne compte plus).
update public.saison set data = jsonb_set(jsonb_set(data, '{entries}', pg_temp.match(5, 'Victoire') || jsonb_build_array(
  jsonb_build_object('j', 5, 'player', 'Kader', 'team', 'Noirs 2', 'statut', 'Présent', 'result', 'Nul', 'buts', 0, 'passes', 0))),
  '{journees,0,finDesMatchs}', to_jsonb((select v from t5))) where id = 1;
select pg_temp.vrai('T5 reposé à la nouvelle dernière feuille', abs(extract(epoch from public.instant_sur(pg_temp.tampon(5)) - now())) < 5);
update public.saison set data = jsonb_set(data, '{entries}', pg_temp.match(5, 'Victoire')) where id = 1;
delete from public.fins_des_matchs;
update public.saison set data = jsonb_set(data, '{journees}', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true))) where id = 1;
drop table t5;
create temp table t5 as select pg_temp.tampon(5) as v;
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
-- La réponse rend le tampon gardé (l'appareil de l'admin l'adopte, sync.ts).
create temp table pub as select pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, false)',
  (select jsonb_set(data, '{journees,0,finDesMatchs}', to_jsonb(pg_temp.iso(now() - interval '10 minutes'))) from public.saison where id = 1),
  (select version from public.saison where id = 1))) as r;
select pg_temp.vrai('T5 publier : la réponse rend le tampon de la base', ((select r from pub) -> 'fins' ->> '5') = (select v from t5)
  and pg_temp.tampon(5) = (select v from t5), (select r::text from pub));

-- ═══ 6 · Une vue figée ne se publie pas ═══
select pg_temp.vrai('T6 feuille_saine refuse figee', 'I10 vue figée' = any (public.feuille_saine(
  (select data || '{"figee":{"a":"x","caches":[5]}}'::jsonb from public.saison where id = 1),
  (select data from public.saison where id = 1))));
select pg_temp.vrai('T6 publier une vue figée : refusé', (pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, true)',
  (select data || '{"figee":{"a":"x","caches":[5]}}'::jsonb from public.saison where id = 1),
  (select version from public.saison where id = 1))) ->> 'hint') = 'feuille-saine');

-- ═══ 7 · Relecture du 02/11 ═══
-- La corbeille : la J5 du jour finie (tampon T0, il y a 40 min), retirée
-- puis remise (corbeille.ts : la même méta, T0 compris). Gardé ; et une
-- remise qui porterait une autre heure n'y change rien.
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true)),
  'entries', pg_temp.match(5, null)));
update public.saison set data = jsonb_set(data, '{entries}', pg_temp.match(5, 'Victoire')) where id = 1;
update public.fins_des_matchs set fin = now() - interval '40 minutes' where saison = 1 and j = 5;
create temp table t7 as select pg_temp.iso(now() - interval '40 minutes') as t0;
update public.saison set data = jsonb_set(data, '{journees,0,finDesMatchs}', to_jsonb((select t0 from t7))) where id = 1;
select pg_temp.vrai('T7 tampon T0 en place', pg_temp.tampon(5) = (select t0 from t7));
select pg_temp.vrai('T7 la J5 à la corbeille', (pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, false)',
  jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb, 'journees', '[]'::jsonb, 'entries', '[]'::jsonb),
  (select version from public.saison where id = 1))) ->> 'ok') = 'true');
select pg_temp.vrai('T7 la J5 remise', (pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, false)',
  jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
    'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true, 'finDesMatchs', (select t0 from t7))),
    'entries', pg_temp.match(5, 'Victoire')),
  (select version from public.saison where id = 1))) ->> 'ok') = 'true');
select pg_temp.vrai('T7 la J5 remise garde T0', pg_temp.tampon(5) = (select t0 from t7), coalesce(pg_temp.tampon(5), 'null'));
update public.saison set data = jsonb_set(data, '{journees,0,finDesMatchs}', to_jsonb(pg_temp.iso(now()))) where id = 1;
select pg_temp.vrai('T7 remise avec une autre heure : T0', pg_temp.tampon(5) = (select t0 from t7));

-- La clôture annulée : une J5 d'il y a 7 jours (son tampon gardé), la saison
-- close (numero 2, journees vides), puis restaurée, tampons compris.
delete from public.fins_des_matchs;
insert into public.fins_des_matchs (saison, j, jour, fin)
  values (1, 5, (now() at time zone 'Europe/Paris')::date - 7, now() - interval '7 days');
create temp table t7b as select pg_temp.iso(now() - interval '7 days') as t;
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(-7), 'sflTime', true, 'mvpAuto', true, 'finDesMatchs', (select t from t7b))),
  'entries', pg_temp.match(5, 'Victoire')));
update public.saison set data = jsonb_build_object('numero', 2, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', '[]'::jsonb, 'entries', '[]'::jsonb,
  'archives', jsonb_build_array(jsonb_build_object('numero', 1, 'journees', data -> 'journees', 'entries', data -> 'entries'))) where id = 1;
update public.saison set data = jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', data -> 'archives' -> 0 -> 'journees', 'entries', data -> 'archives' -> 0 -> 'entries', 'archives', '[]'::jsonb) where id = 1;
select pg_temp.vrai('T7 la clôture annulée garde le tampon de la J5', pg_temp.tampon(5) = (select t from t7b), coalesce(pg_temp.tampon(5), 'null'));
-- Rouverte après sa révélation (la J5 d'il y a 7 jours) : gardé, la journée reste comptée.
update public.saison set data = jsonb_set(data, '{entries}', pg_temp.match(5, 'Victoire') || jsonb_build_array(
  jsonb_build_object('j', 5, 'player', 'Kader', 'team', 'Noirs 2', 'statut', 'Présent', 'result', null, 'buts', 0, 'passes', 0))) where id = 1;
select pg_temp.vrai('T7 rouverte après la révélation : gardé', pg_temp.tampon(5) = (select t from t7b));

-- La valeur de l'app, gardée à 5 min près, réécrite au format de l'app :
-- un fuseau nommé (que Date.parse ne lit pas) et une heure sans décalage
-- (que le téléphone lirait à l'heure de Paris).
delete from public.fins_des_matchs;
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true), jsonb_build_object('j', 6, 'date', pg_temp.jour(), 'sflTime', true)),
  'entries', pg_temp.match(5, null) || pg_temp.match(6, null)));
create temp table t7c as select
  to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD HH24:MI:SS') || ' Europe/Paris' as nomme,
  to_char(now() at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS') as nu;
update public.saison set data = jsonb_set(jsonb_set(jsonb_set(data, '{entries}', pg_temp.match(5, 'Victoire') || pg_temp.match(6, 'Nul')),
  '{journees,0,finDesMatchs}', to_jsonb((select nomme from t7c))), '{journees,1,finDesMatchs}', to_jsonb((select nu from t7c))) where id = 1;
select pg_temp.vrai('T7 un fuseau nommé : au format de l''app', pg_temp.tampon(5) ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
  and abs(extract(epoch from pg_temp.tampon(5)::timestamptz - now())) < 2, coalesce(pg_temp.tampon(5), 'null'));
select pg_temp.vrai('T7 sans décalage : au format de l''app', pg_temp.tampon(6) ~ 'Z$'
  and abs(extract(epoch from pg_temp.tampon(6)::timestamptz - now())) < 2, coalesce(pg_temp.tampon(6), 'null'));

-- fin_du_vote et vote_ouvert : à la ligue seulement.
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-0000000000ff', 'inconnu@test.local', '{"name":"Inconnu","username":"@inconnu"}');
update public.profiles set valide = false where id = 'd0000000-0000-0000-0000-0000000000ff';
select pg_temp.vrai('T7 un non-membre ne lit pas la fin du vote', coalesce(pg_temp.en('Inconnu', $$to_jsonb(public.fin_du_vote(1, 5))$$), 'null'::jsonb) = 'null'::jsonb);
select pg_temp.vrai('T7 ni le vote ouvert', pg_temp.en('Inconnu', $$to_jsonb(public.vote_ouvert(1, 5))$$) = 'false'::jsonb);
select pg_temp.vrai('T7 un joueur, si', coalesce(pg_temp.en('Théo', $$to_jsonb(public.fin_du_vote(1, 5))$$), 'null'::jsonb) <> 'null'::jsonb
  and pg_temp.en('Théo', $$to_jsonb(public.vote_ouvert(1, 5))$$) = 'true'::jsonb);
select pg_temp.vrai('T7 les fins des matchs ne se lisent pas', (pg_temp.en('Théo', $$to_jsonb((select count(*) from public.fins_des_matchs))$$)) ? 'erreur'
  or pg_temp.en('Théo', $$to_jsonb((select count(*) from public.fins_des_matchs))$$) = '0'::jsonb);
select pg_temp.vrai('T7 ni ne s''écrivent', pg_temp.ecrire_en('Théo', $$insert into public.fins_des_matchs (saison, j, jour, fin) values (1, 9, current_date, now())$$) like 'refus%');

-- Une date que la base ne lit pas : refusée (I11), seulement si elle est nouvelle.
select pg_temp.vrai('T7 I11 une date illisible', 'I11 J7 08/11' = any (public.feuille_saine(
  (select jsonb_set(data, '{journees}', data -> 'journees' || jsonb_build_array(jsonb_build_object('j', 7, 'date', '08/11', 'sflTime', true))) from public.saison where id = 1),
  (select data from public.saison where id = 1))));
select pg_temp.vrai('T7 I11 déjà là : ne bloque pas', not exists (select 1 from unnest(public.feuille_saine(
  (select jsonb_set(data, '{journees}', data -> 'journees' || jsonb_build_array(jsonb_build_object('j', 7, 'date', '08/11', 'sflTime', true))) from public.saison where id = 1),
  (select jsonb_set(data, '{journees}', data -> 'journees' || jsonb_build_array(jsonb_build_object('j', 7, 'date', '08/11', 'sflTime', true))) from public.saison where id = 1))) d
  where d like 'I11%'));
select pg_temp.vrai('T7 I11 publier : refusé', (pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, true)',
  (select jsonb_set(data, '{journees}', data -> 'journees' || jsonb_build_array(jsonb_build_object('j', 7, 'date', '08/11', 'sflTime', true))) from public.saison where id = 1),
  (select version from public.saison where id = 1))) ->> 'hint') = 'feuille-saine');

-- La feuille d'un match tardif qui déborde : jusqu'à 1 h, encore.
create temp table t7d as select jsonb_build_object('numero', 1, 'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', '8 nov.', 'sflTime', true,
    'matchsDuJour', '[{"equipes":["Noirs 1","Blancs 1"]}]'::jsonb)),
  'entries', pg_temp.match(5, null)) as d;
select pg_temp.vrai('T7 la nuit : 00 h 30, la feuille se prend', public.droit_feuille((select d from t7d), 5, 'Noirs 1', 'Blancs 1', 'Théo', pg_temp.p('2026-11-09 00:30')) is null);
select pg_temp.vrai('T7 1 h : non', public.droit_feuille((select d from t7d), 5, 'Noirs 1', 'Blancs 1', 'Théo', pg_temp.p('2026-11-09 01:00')) = 'pas-du-jour');
select pg_temp.vrai('T7 la veille : non', public.droit_feuille((select d from t7d), 5, 'Noirs 1', 'Blancs 1', 'Théo', pg_temp.p('2026-11-07 23:30')) = 'pas-du-jour');

-- Une feuille rouverte puis scellée de nouveau avant la révélation : F suit
-- ce sceau (c'est la dernière feuille) ; après la révélation, plus rien.
delete from public.fins_des_matchs;
select pg_temp.poser(jsonb_set((select data from doc0), '{numero}', '3'));
select pg_temp.vrai('T7 les deux feuilles scellées', (pg_temp.en('Théo', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true'
  and (pg_temp.en('Théo', $$public.sceller_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true'
  and (pg_temp.en('Kader', $$public.prendre_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true'
  and (pg_temp.en('Kader', $$public.sceller_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true');
update public.fins_des_matchs set fin = now() - interval '30 minutes' where saison = 3 and j = 4;
update public.saison set data = jsonb_set(data, '{journees,1,finDesMatchs}', to_jsonb(pg_temp.iso(now() - interval '30 minutes'))) where id = 1;
select pg_temp.vrai('T7 F il y a 30 min', abs(extract(epoch from public.instant_sur(pg_temp.tampon(4)) - (now() - interval '30 minutes'))) < 1);
select pg_temp.vrai('T7 l''admin rouvre le match 2', (pg_temp.en('Ilyes', $$public.feuille_admin(4, 'Noirs 2', 'Blancs 2', 'rouvrir')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T7 rouverte, la journée reste finie : F gardée', abs(extract(epoch from public.instant_sur(pg_temp.tampon(4)) - (now() - interval '30 minutes'))) < 1);
select pg_temp.vrai('T7 Kader la reprend et la scelle', (pg_temp.en('Kader', $$public.prendre_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true'
  and (pg_temp.en('Kader', $$public.sceller_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T7 F suit le nouveau sceau', abs(extract(epoch from public.instant_sur(pg_temp.tampon(4)) - now())) < 5, pg_temp.tampon(4));
-- La même journée d'hier, déjà révélée : le sceau d'une feuille rouverte ne déplace plus F.
create temp table t7e as select jsonb_set(data, '{journees,1,date}', to_jsonb(pg_temp.jour(-1))) as d from public.saison where id = 1;
select pg_temp.poser((select d from t7e));
update public.fins_des_matchs set jour = (now() at time zone 'Europe/Paris')::date - 1, fin = now() - interval '1 day' where saison = 3 and j = 4;
update public.saison set data = jsonb_set(data, '{journees,1,finDesMatchs}', to_jsonb(pg_temp.iso(now() - interval '1 day'))) where id = 1;
select pg_temp.vrai('T7 hier : rouverte, reprise et scellée par l''admin', (pg_temp.en('Ilyes', $$public.feuille_admin(4, 'Noirs 2', 'Blancs 2', 'rouvrir')$$) ->> 'ok') = 'true'
  and (pg_temp.en('Ilyes', $$public.feuille_admin(4, 'Noirs 2', 'Blancs 2', 'reprendre')$$) ->> 'ok') = 'true'
  and (pg_temp.en('Ilyes', $$public.sceller_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T7 après la révélation : F gardée', pg_temp.tampon(4) = pg_temp.iso(now() - interval '1 day'), pg_temp.tampon(4));

-- Les politiques de votes_figures à 17 h 59 et 18 h 00 : now() ne se truque
-- pas, vote_ouvert est réécrit le temps de la transaction pour lire
-- vote_ouvert_a à une heure fixée du jour même (la politique le référence par
-- son oid, elle suit le nouveau corps). Annulé avec le reste.
select pg_temp.poser(jsonb_build_object('numero', 1, 'roster', '[]'::jsonb, 'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(jsonb_build_object('j', 5, 'date', pg_temp.jour(), 'sflTime', true,
    'finDesMatchs', pg_temp.iso(((now() at time zone 'Europe/Paris')::date + time '15:00') at time zone 'Europe/Paris'))),
  'entries', pg_temp.match(5, 'Victoire')));
create table public.horloge_banc (t timestamptz);
grant select on public.horloge_banc to authenticated;
insert into public.horloge_banc values (((now() at time zone 'Europe/Paris')::date + time '17:59') at time zone 'Europe/Paris');
create or replace function public.vote_ouvert(p_saison int, p_j int) returns boolean language sql stable security definer set search_path = '' as $$
  select ((select auth.uid()) is null or (select public.est_membre())) and public.vote_ouvert_a(p_saison, p_j, (select t from public.horloge_banc))
$$;
delete from public.votes_figures where saison = 1 and j = 5;
select pg_temp.vrai('T7 17 h 59 : le vote passe', pg_temp.ecrire_en('Théo', $$insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour)
  values (1, 5, 'impact', 'Théo', 'Badis', 'm1', (now() at time zone 'Europe/Paris')::date)
  on conflict (saison, j, categorie, votant) do update set candidat = excluded.candidat$$) = '1');
update public.horloge_banc set t = t + interval '1 minute';
select pg_temp.vrai('T7 18 h 00 : un nouveau vote refusé', pg_temp.ecrire_en('Badis', $$insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour)
  values (1, 5, 'impact', 'Badis', 'Théo', 'm1', (now() at time zone 'Europe/Paris')::date)$$) like 'refus%');
select pg_temp.vrai('T7 18 h 00 : changer d''avis, rien', pg_temp.ecrire_en('Théo', $$update public.votes_figures set candidat = 'Sami'
  where saison = 1 and j = 5 and votant = 'Théo'$$) = '0');
select pg_temp.vrai('T7 le vote de 17 h 59 reste', (select candidat from public.votes_figures where saison = 1 and j = 5 and votant = 'Théo') = 'Badis');
select pg_temp.vrai('T7 l''heure en paramètre fermée aux joueurs', (pg_temp.en('Théo', $$to_jsonb(public.vote_ouvert_a(1, 5, now() - interval '3 hours'))$$)) ? 'erreur'
  and (pg_temp.en('Théo', $$to_jsonb(public.fin_du_vote_a(1, 5, now()))$$)) ? 'erreur');

select 'revelation-check : tout est ok' as bilan;
rollback;
