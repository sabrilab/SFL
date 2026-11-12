-- Le banc SQL de la journée en suspens (12/11/2026, saisie/suspens.ts).
--
-- À jouer sur un Postgres 16 local (ou une branche Supabase), JAMAIS sur la
-- base de la ligue : d'abord supabase/schema.sql en entier, deux fois de
-- suite (la migration est idempotente), puis ce fichier. Sur un Postgres nu,
-- tools/sql/supabase-reduit.sql pose avant le strict nécessaire de Supabase.
--
--   psql -v ON_ERROR_STOP=1 -f tools/sql/suspens-check.sql
--
-- Les données (sept comptes de test, la saison 1 avec la J4 jouée la semaine
-- passée, la J5 du jour en deux matchs et une J6 en brouillon) sont posées
-- dans une transaction annulée à la fin : rien ne reste. Chaque ligne de
-- résultat finit par ok ; le fichier s'arrête au premier ÉCHEC.

\set ON_ERROR_STOP 1
begin;

-- ═══ Données ═══
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-00000000000a', 'banc-ilyes', '{"name":"Ilyes","username":"@ilyes"}'),
  ('d0000000-0000-0000-0000-00000000000b', 'banc-sabri', '{"name":"Sabri","username":"@sabri"}'),
  ('d0000000-0000-0000-0000-00000000000c', 'banc-theo', '{"name":"Théo","username":"@theo"}'),
  ('d0000000-0000-0000-0000-00000000000d', 'banc-badis', '{"name":"Badis","username":"@badis"}'),
  ('d0000000-0000-0000-0000-00000000000e', 'banc-sami', '{"name":"Sami","username":"@sami"}'),
  ('d0000000-0000-0000-0000-00000000000f', 'banc-kader', '{"name":"Kader","username":"@kader"}'),
  ('d0000000-0000-0000-0000-000000000010', 'banc-naim', '{"name":"Naim","username":"@naim"}');
update public.profiles set valide = true where id::text like 'd0000000-%';
update public.profiles set is_admin = true where name in ('Ilyes', 'Sabri') and id::text like 'd0000000-%';
update public.profiles set joue = false where name = 'Sabri' and id::text like 'd0000000-%';

create function pg_temp.libelle(d date) returns text language sql immutable as $$
  select extract(day from d)::int || ' ' || (array['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'])[extract(month from d)::int]
$$;
create function pg_temp.auj() returns date language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;

delete from public.saison where id = 1;
insert into public.saison (id, data, version, seed)
select 1, jsonb_build_object(
  'numero', 1,
  'roster', '[{"name":"Ilyes"},{"name":"Théo"},{"name":"Badis"},{"name":"Sami"},{"name":"Kader"},{"name":"Naim"}]'::jsonb,
  'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(
    jsonb_build_object('j', 4, 'date', pg_temp.libelle(pg_temp.auj() - 7), 'sflTime', false),
    jsonb_build_object('j', 5, 'date', pg_temp.libelle(pg_temp.auj()), 'heure', '12h30', 'sflTime', true, 'mvpAuto', true,
      'publiee', '{"le":"2026-11-07T15:10:00.000Z","par":"Ilyes"}'::jsonb,
      'matchsDuJour', '[{"equipes":["Noirs 1","Blancs 1"]},{"equipes":["Noirs 2","Blancs 2"]}]'::jsonb),
    jsonb_build_object('j', 6, 'date', pg_temp.libelle(pg_temp.auj() + 7), 'sflTime', false,
      'brouillon', '{"depuis":"x","par":"Sabri"}'::jsonb)),
  'entries', '[
    {"j":4,"player":"Ilyes","team":"Noirs 1","statut":"Présent","result":"Victoire","buts":2,"passes":0,"retard":false},
    {"j":4,"player":"Théo","team":"Blancs 1","statut":"Présent","result":"Défaite","buts":0,"passes":1,"retard":false},
    {"j":5,"player":"Ilyes","team":"Noirs 1","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":true,"retard":false},
    {"j":5,"player":"Théo","team":"Noirs 1","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":true,"retard":false},
    {"j":5,"player":"Badis","team":"Blancs 1","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":true,"retard":false},
    {"j":5,"player":"Sami","team":"Blancs 1","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":true,"retard":false},
    {"j":5,"player":"Kader","team":"Noirs 2","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":true,"retard":false},
    {"j":5,"player":"Naim","team":"Blancs 2","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":true,"retard":false}
  ]'::jsonb), 1000, 0;
delete from public.feuilles_direct where saison = 1;
delete from public.fins_des_matchs where saison = 1;
delete from public.votes_figures where saison = 1;

-- Appeler une fonction comme un joueur (son jeton), avec ses seuls droits.
create function pg_temp.en(qui text, appel text) returns jsonb language plpgsql as $$
declare r jsonb; h text; uid uuid;
begin
  select id into uid from public.profiles where name = qui and id::text like 'd0000000-%';
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  execute 'select to_jsonb((' || appel || '))' into r;
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

-- Le document, la méta d'une journée, et une méta changée (la clé null : retirée).
create function pg_temp.doc() returns jsonb language sql stable as $$ select data from public.saison where id = 1 $$;
create function pg_temp.meta(p_j int) returns jsonb language sql stable as $$
  select m from jsonb_array_elements(pg_temp.doc() -> 'journees') m where (m ->> 'j')::int = p_j $$;
create function pg_temp.avec_meta(d jsonb, p_j int, patch jsonb) returns jsonb language sql immutable as $$
  select jsonb_set(d, '{journees}', (
    select jsonb_agg(case when (m ->> 'j')::int = p_j then jsonb_strip_nulls(m || patch) else m end order by i)
      from jsonb_array_elements(d -> 'journees') with ordinality t(m, i))) $$;
-- Les résultats d'une équipe de la J5.
create function pg_temp.resultat(d jsonb, p_team text, r text) returns jsonb language sql immutable as $$
  select jsonb_set(d, '{entries}', (
    select jsonb_agg(case when (e ->> 'j')::int = 5 and e ->> 'team' = p_team then e || jsonb_build_object('result', r) else e end order by i)
      from jsonb_array_elements(d -> 'entries') with ordinality t(e, i))) $$;

-- Publier comme un compte, sur la version courante.
create function pg_temp.publier_en(qui text, d jsonb) returns jsonb language sql as $$
  select pg_temp.en(qui, format('public.publier_saison(%L::jsonb, 0, %s, false)', d, (select version from public.saison where id = 1))) $$;
create function pg_temp.publier(d jsonb) returns jsonb language plpgsql as $$
declare r jsonb;
begin
  r := pg_temp.publier_en('Ilyes', d);
  if (r ->> 'ok') is distinct from 'true' then raise exception 'ÉCHEC publication %', r; end if;
  return r;
end; $$;

create function pg_temp.suspens(p_date text, motif text default 'Travaux sur les terrains') returns jsonb language sql immutable as $$
  select jsonb_build_object('depuis', '2026-11-08T13:05:00.000Z', 'par', 'Ilyes', 'date', p_date, 'motif', motif) $$;
create function pg_temp.sans_suspens(d jsonb, p_j int) returns jsonb language sql immutable as $$
  select jsonb_set(d, '{journees}', (
    select jsonb_agg(case when (m ->> 'j')::int = p_j
                          then (m - 'suspens') || jsonb_build_object('reprise', jsonb_build_object(
                                 'le', '2026-11-12T10:00:00.000Z', 'par', 'Ilyes', 'date', m -> 'suspens' ->> 'date'))
                          else m end order by i)
      from jsonb_array_elements(d -> 'journees') with ordinality t(m, i))) $$;

-- Un vote Impact posé à la main (le banc des votes vérifie la politique ailleurs).
create function pg_temp.vote_pose(p_j int, votant text, candidat text) returns void language sql as $$
  insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour, votant_id)
  select 1, p_j, 'impact', votant, candidat, 'm1', pg_temp.auj(), (select id from public.profiles where name = votant and id::text like 'd0000000-%')
  on conflict do nothing $$;

-- ═══ Essais ═══
-- 1 · La règle de lecture, comme estEnSuspens.
select pg_temp.vrai('S1 absent', not public.est_en_suspens('{"j":5}'));
select pg_temp.vrai('S1 null', not public.est_en_suspens('{"j":5,"suspens":null}'));
select pg_temp.vrai('S1 false', not public.est_en_suspens('{"j":5,"suspens":false}'));
select pg_temp.vrai('S1 objet', public.est_en_suspens('{"j":5,"suspens":{"depuis":"x","par":"Ilyes","date":"8 nov."}}'));
select pg_temp.vrai('S1 vrai', public.est_en_suspens('{"j":5,"suspens":true}'));
select pg_temp.vrai('S1 méta nulle', not public.est_en_suspens(null));

-- 2 · Avant : la J5 du jour est ouverte (vote, feuille, recrue d'un match joué).
select pg_temp.vrai('S2 vote ouvert avant', public.vote_ouvert_a(1, 5, now()));
select pg_temp.vrai('S2 Théo prend la feuille du match 1', (pg_temp.en('Théo', $$public.prendre_feuille(5, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true');
select pg_temp.vote_pose(5, 'Théo', 'Badis');
select pg_temp.vote_pose(4, 'Théo', 'Ilyes');
insert into public.arbitrages (saison, j, n, arbitre_id, equipes, ferme_le)
select 1, 5, 0, id, '{"Noirs 1","Blancs 1"}', (pg_temp.auj() + 3)::timestamp at time zone 'Europe/Paris' from public.profiles where name = 'Naim' and id::text like 'd0000000-%';
insert into public.arbitrages (saison, j, n, arbitre_id, equipes, ferme_le)
select 1, 4, 0, id, '{"Noirs 1","Blancs 1"}', (pg_temp.auj() - 4)::timestamp at time zone 'Europe/Paris' from public.profiles where name = 'Naim' and id::text like 'd0000000-%';
insert into public.fins_des_matchs (saison, j, jour, fin) values (1, 4, pg_temp.auj() - 7, now() - interval '7 days');

-- 3 · Seul l'admin pose le suspens, par publier_saison.
select pg_temp.vrai('S3 un joueur ne publie pas', pg_temp.publier_en('Théo', pg_temp.avec_meta(pg_temp.doc(), 5, jsonb_build_object('suspens', pg_temp.suspens(pg_temp.libelle(pg_temp.auj()))))) ->> 'erreur' is not null);
select pg_temp.vrai('S3 un joueur n''écrit pas la table', pg_temp.ecrire_en('Théo', $$update public.saison set data = data where id = 1$$) like 'refus%'
  or pg_temp.ecrire_en('Théo', $$update public.saison set data = data where id = 1$$) = '0');
select pg_temp.vrai('S3 toujours pas en suspens', not public.est_en_suspens(pg_temp.meta(5)));
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, jsonb_build_object('suspens', pg_temp.suspens(pg_temp.libelle(pg_temp.auj())))));
select pg_temp.vrai('S3 l''admin suspend', public.est_en_suspens(pg_temp.meta(5)) and pg_temp.meta(5) -> 'suspens' ->> 'motif' = 'Travaux sur les terrains');
select pg_temp.vrai('S3 la journée reste servie aux joueurs', exists (
  select 1 from jsonb_array_elements(public.sans_brouillons(pg_temp.doc()) -> 'journees') m where (m ->> 'j')::int = 5)
  and jsonb_array_length(public.sans_brouillons(pg_temp.doc()) -> 'entries') = 8);

-- 4 · Pas de vote.
select pg_temp.vrai('S4 fin du vote nulle', public.fin_du_vote_a(1, 5, now()) is null);
select pg_temp.vrai('S4 vote fermé', not public.vote_ouvert_a(1, 5, now()));
select pg_temp.vrai('S4 un vote est refusé', pg_temp.ecrire_en('Kader', format(
  $$insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour) values (1, 5, 'impact', 'Kader', 'Naim', 'm2', %L)$$, pg_temp.auj())) like 'refus%');
select pg_temp.vrai('S4 la J4 garde sa fin du vote', public.fin_du_vote_a(1, 4, now()) is not null);

-- 5 · La feuille gelée pour les joueurs, pas pour l'admin.
select pg_temp.vrai('S5 feuille_hors_jeu', public.feuille_hors_jeu(pg_temp.doc(), 5, 'Noirs 1', 'Blancs 1') = 'suspens');
select pg_temp.vrai('S5 Kader ne prend pas', pg_temp.en('Kader', $$public.prendre_feuille(5, 'Noirs 2', 'Blancs 2')$$) ->> 'refus' = 'suspens');
select pg_temp.vrai('S5 Théo ne compte plus', pg_temp.en('Théo', $$public.compter_feuille(5, 'Noirs 1', 'Blancs 1', '[{"joueur":"Ilyes","quoi":"buts","d":1}]')$$) ->> 'refus' = 'suspens');
select pg_temp.vrai('S5 Théo ne scelle pas', pg_temp.en('Théo', $$public.sceller_feuille(5, 'Noirs 1', 'Blancs 1')$$) ->> 'refus' = 'suspens');
select pg_temp.vrai('S5 l''admin libère', (pg_temp.en('Ilyes', $$public.feuille_admin(5, 'Noirs 1', 'Blancs 1', 'liberer')$$) ->> 'ok') = 'true');
select pg_temp.vrai('S5 l''admin scelle', (pg_temp.en('Ilyes', $$public.sceller_feuille(5, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true');
select pg_temp.vrai('S5 sceller garde le suspens', public.est_en_suspens(pg_temp.meta(5)));
select pg_temp.vrai('S5 la J4 reste hors suspens', public.feuille_hors_jeu(pg_temp.doc(), 4, 'Noirs 1', 'Blancs 1') is null);

-- 6 · Terminée le jour même pendant le suspens : pas de fin des matchs.
select pg_temp.publier(pg_temp.resultat(pg_temp.resultat(pg_temp.doc(), 'Noirs 2', 'Nul'), 'Blancs 2', 'Nul'));
select pg_temp.vrai('S6 terminée', public.journee_terminee(pg_temp.doc(), 5));
select pg_temp.vrai('S6 pas de F dans le document', not (pg_temp.meta(5) ? 'finDesMatchs'));
select pg_temp.vrai('S6 pas de F gardé', not exists (select 1 from public.fins_des_matchs where saison = 1 and j = 5));
-- Un F venu de l'app pendant le suspens n'est ni posé ni retiré : il reste tel quel.
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, '{"finDesMatchs":"2026-11-08T13:00:00.000Z"}'));
select pg_temp.vrai('S6 F de l''app laissé', pg_temp.meta(5) ->> 'finDesMatchs' = '2026-11-08T13:00:00.000Z'
  and not exists (select 1 from public.fins_des_matchs where saison = 1 and j = 5));
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, '{"finDesMatchs":null}'));

-- 7 · Ni recrue ni note d'arbitre pendant le suspens.
select pg_temp.vrai('S7 pas de présence réelle', not exists (select 1 from public.presences_reelles() where cle = 'j:c:5'));
select pg_temp.vrai('S7 la J4 compte toujours', exists (select 1 from public.presences_reelles() where cle = 'j:c:4'));
select pg_temp.vrai('S7 noter l''arbitre refusé', pg_temp.en('Ilyes', format('public.noter_arbitre(%s, 4)', (select id from public.arbitrages where saison = 1 and j = 5))) ->> 'erreur' is not null);

-- 8 · Reprise à la même date : la règle normale, rien d'effacé.
create temp table ferme_avant as select ferme_le from public.arbitrages where saison = 1 and j = 5;
select pg_temp.publier(pg_temp.sans_suspens(pg_temp.doc(), 5));
select pg_temp.vrai('S8 reprise', not public.est_en_suspens(pg_temp.meta(5)) and pg_temp.meta(5) ? 'reprise');
select pg_temp.vrai('S8 F posé (terminée le jour même)', pg_temp.meta(5) ? 'finDesMatchs' and exists (select 1 from public.fins_des_matchs where saison = 1 and j = 5));
select pg_temp.vrai('S8 le vote revient', public.fin_du_vote_a(1, 5, now()) is not null);
select pg_temp.vrai('S8 votes gardés', exists (select 1 from public.votes_figures where saison = 1 and j = 5));
select pg_temp.vrai('S8 feuille gardée', exists (select 1 from public.feuilles_direct where saison = 1 and j = 5));
select pg_temp.vrai('S8 fermeture des notes inchangée', (select ferme_le from public.arbitrages where saison = 1 and j = 5) = (select ferme_le from ferme_avant));
select pg_temp.vrai('S8 la recrue revient', exists (select 1 from public.presences_reelles() where cle = 'j:c:5'));
select pg_temp.vrai('S8 noter l''arbitre permis', (pg_temp.en('Ilyes', format('public.noter_arbitre(%s, 4)', (select id from public.arbitrages where saison = 1 and j = 5)))) = 'true'::jsonb);

-- 9 · Suspendue de nouveau : le F déjà posé est gardé, dans le document et en base.
create temp table f_avant as select fin from public.fins_des_matchs where saison = 1 and j = 5;
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, jsonb_build_object('suspens', pg_temp.suspens(pg_temp.libelle(pg_temp.auj())))));
select pg_temp.vrai('S9 F gardé dans le document', pg_temp.meta(5) ? 'finDesMatchs');
select pg_temp.vrai('S9 F gardé en base', (select fin from public.fins_des_matchs where saison = 1 and j = 5) = (select fin from f_avant));
select pg_temp.vrai('S9 vote refermé', public.fin_du_vote_a(1, 5, now()) is null);

-- 10 · Rattrapée à une autre date : la date change (toujours en suspens : rien),
-- puis la reprise fait le ménage de l'ancienne date, pour la J5 seulement.
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, jsonb_build_object('date', pg_temp.libelle(pg_temp.auj() + 14))));
select pg_temp.vrai('S10 en suspens, rien d''effacé', exists (select 1 from public.votes_figures where saison = 1 and j = 5)
  and exists (select 1 from public.feuilles_direct where saison = 1 and j = 5)
  and exists (select 1 from public.fins_des_matchs where saison = 1 and j = 5));
select pg_temp.publier(pg_temp.sans_suspens(pg_temp.doc(), 5));
select pg_temp.vrai('S10 votes de l''ancienne date effacés', not exists (select 1 from public.votes_figures where saison = 1 and j = 5));
select pg_temp.vrai('S10 feuilles effacées', not exists (select 1 from public.feuilles_direct where saison = 1 and j = 5));
select pg_temp.vrai('S10 fin des matchs effacée', not exists (select 1 from public.fins_des_matchs where saison = 1 and j = 5)
  and not (pg_temp.meta(5) ? 'finDesMatchs'));
select pg_temp.vrai('S10 notes fermées le mardi minuit d''après la nouvelle date',
  (select ferme_le from public.arbitrages where saison = 1 and j = 5) = (pg_temp.auj() + 14 + 3)::timestamp at time zone 'Europe/Paris');
select pg_temp.vrai('S10 la J4 intacte', exists (select 1 from public.votes_figures where saison = 1 and j = 4)
  and exists (select 1 from public.fins_des_matchs where saison = 1 and j = 4)
  and (select ferme_le from public.arbitrages where saison = 1 and j = 4) = (pg_temp.auj() - 4)::timestamp at time zone 'Europe/Paris');
select pg_temp.vrai('S10 notes d''arbitre de l''ancienne date effacées', not exists (
  select 1 from public.avis_arbitre av join public.arbitrages a on a.id = av.arbitrage_id where a.saison = 1 and a.j = 5));
select pg_temp.vrai('S10 une J5 à venir : la feuille ne se prend pas aujourd''hui', pg_temp.en('Kader', $$public.prendre_feuille(5, 'Noirs 2', 'Blancs 2')$$) ->> 'refus' = 'pas-du-jour');

-- 11 · Une journée qui n'a jamais été en suspens : une publication ne déclenche aucun ménage.
select pg_temp.vote_pose(4, 'Badis', 'Ilyes');
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 4, '{"sflTime":true}'));
select pg_temp.vrai('S11 rien d''effacé sur la J4', (select count(*) from public.votes_figures where saison = 1 and j = 4) = 2
  and exists (select 1 from public.fins_des_matchs where saison = 1 and j = 4));

-- Une feuille, un vote et une note d'arbitre « d'il y a quatre jours » (la J5 du 8 nov.).
create function pg_temp.traces_anciennes() returns void language sql as $$
  insert into public.feuilles_direct (saison, j, noirs, blancs, debut, fin)
  values (1, 5, 'Noirs 1', 'Blancs 1', now() - interval '4 days', now() - interval '4 days' + interval '50 minutes')
  on conflict (saison, j, noirs, blancs) do update set debut = excluded.debut, fin = excluded.fin;
  insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour, votant_id)
  select 1, 5, 'impact', 'Théo', 'Badis', 'm1', pg_temp.auj() - 4, id from public.profiles where name = 'Théo' and id::text like 'd0000000-%'
  on conflict (saison, j, categorie, votant) do update set jour = excluded.jour;
  insert into public.avis_arbitre (arbitrage_id, joueur_id, note, le)
  select a.id, p.id, 4, now() - interval '4 days' from public.arbitrages a, public.profiles p
   where a.saison = 1 and a.j = 5 and p.name = 'Badis' and p.id::text like 'd0000000-%'
  on conflict (arbitrage_id, joueur_id) do update set le = excluded.le;
$$;
create function pg_temp.vider_j5() returns void language sql as $$
  delete from public.feuilles_direct where saison = 1 and j = 5;
  delete from public.votes_figures where saison = 1 and j = 5;
  delete from public.fins_des_matchs where saison = 1 and j = 5;
  delete from public.avis_arbitre av using public.arbitrages a where av.arbitrage_id = a.id and a.saison = 1 and a.j = 5;
$$;
create function pg_temp.toutes(d jsonb, r text) returns jsonb language sql immutable as $$
  select pg_temp.resultat(pg_temp.resultat(pg_temp.resultat(pg_temp.resultat(d, 'Noirs 1', r), 'Blancs 1', r), 'Noirs 2', r), 'Blancs 2', r) $$;

-- 12 · Rattrapée aujourd'hui, reprise le soir APRÈS les matchs (contrôle du 12/11, défaut 1) :
-- la fin des matchs que saison_fin_des_matchs pose dans la même écriture est
-- gardée, ainsi que la feuille tenue par l'admin aujourd'hui ; seul l'ancien
-- jour est effacé.
select pg_temp.vider_j5();
select pg_temp.publier(pg_temp.avec_meta(pg_temp.toutes(pg_temp.doc(), null), 5, jsonb_build_object(
  'date', pg_temp.libelle(pg_temp.auj() - 4), 'suspens', pg_temp.suspens(pg_temp.libelle(pg_temp.auj() - 4)), 'reprise', null, 'finDesMatchs', null)));
select pg_temp.traces_anciennes();
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, jsonb_build_object('date', pg_temp.libelle(pg_temp.auj()))));
-- L'admin a tenu et scellé la feuille du match 2 aujourd'hui (feuille_admin passe outre le suspens).
insert into public.feuilles_direct (saison, j, noirs, blancs, debut, fin) values (1, 5, 'Noirs 2', 'Blancs 2', now(), now());
select pg_temp.publier(pg_temp.toutes(pg_temp.doc(), 'Nul'));
select pg_temp.vrai('S12 terminée en suspens, sans F', public.journee_terminee(pg_temp.doc(), 5)
  and not (pg_temp.meta(5) ? 'finDesMatchs') and not exists (select 1 from public.fins_des_matchs where saison = 1 and j = 5));
select pg_temp.publier(pg_temp.sans_suspens(pg_temp.doc(), 5));
select pg_temp.vrai('S12 F posé et gardé en base', exists (
  select 1 from public.fins_des_matchs f where f.saison = 1 and f.j = 5 and f.jour = pg_temp.auj()
     and to_char(f.fin at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') = pg_temp.meta(5) ->> 'finDesMatchs'));
select pg_temp.vrai('S12 la feuille du jour gardée', exists (select 1 from public.feuilles_direct where saison = 1 and j = 5 and noirs = 'Noirs 2'));
select pg_temp.vrai('S12 la feuille de l''ancien jour effacée', not exists (select 1 from public.feuilles_direct where saison = 1 and j = 5 and noirs = 'Noirs 1'));
select pg_temp.vrai('S12 le vote de l''ancien jour effacé', not exists (select 1 from public.votes_figures where saison = 1 and j = 5));
select pg_temp.vrai('S12 la note de l''ancien jour effacée', not exists (
  select 1 from public.avis_arbitre av join public.arbitrages a on a.id = av.arbitrage_id where a.saison = 1 and a.j = 5));
select pg_temp.vrai('S12 la reprise garde la date d''origine', pg_temp.meta(5) -> 'reprise' ->> 'date' = pg_temp.libelle(pg_temp.auj() - 4));
-- La publication suivante relit le F gardé (une valeur de l'app vieille de 10 min ne le déplace pas).
create temp table f12 as select pg_temp.meta(5) ->> 'finDesMatchs' as f;
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, jsonb_build_object('finDesMatchs',
  to_char((now() - interval '10 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))));
select pg_temp.vrai('S12 F ne bouge pas à la publication suivante', pg_temp.meta(5) ->> 'finDesMatchs' = (select f from f12)
  and exists (select 1 from public.fins_des_matchs where saison = 1 and j = 5));

-- 13 · Ordre inverse (défaut 3) : reprise à la même date passée, PUIS la date
-- change : le même ménage, une fois ; un report ensuite est un changement de
-- date ordinaire.
select pg_temp.vider_j5();
select pg_temp.publier(pg_temp.avec_meta(pg_temp.toutes(pg_temp.doc(), null), 5, jsonb_build_object(
  'date', pg_temp.libelle(pg_temp.auj() - 4), 'suspens', pg_temp.suspens(pg_temp.libelle(pg_temp.auj() - 4)), 'reprise', null, 'finDesMatchs', null)));
select pg_temp.traces_anciennes();
select pg_temp.publier(pg_temp.sans_suspens(pg_temp.doc(), 5));
select pg_temp.vrai('S13 reprise à la même date : rien d''effacé', exists (select 1 from public.feuilles_direct where saison = 1 and j = 5)
  and exists (select 1 from public.votes_figures where saison = 1 and j = 5)
  and exists (select 1 from public.avis_arbitre av join public.arbitrages a on a.id = av.arbitrage_id where a.saison = 1 and a.j = 5));
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, jsonb_build_object('date', pg_temp.libelle(pg_temp.auj()))));
select pg_temp.vrai('S13 date changée après la reprise : feuille effacée', not exists (select 1 from public.feuilles_direct where saison = 1 and j = 5));
select pg_temp.vrai('S13 vote effacé', not exists (select 1 from public.votes_figures where saison = 1 and j = 5));
select pg_temp.vrai('S13 note d''arbitre effacée', not exists (
  select 1 from public.avis_arbitre av join public.arbitrages a on a.id = av.arbitrage_id where a.saison = 1 and a.j = 5));
select pg_temp.vrai('S13 notes refermées le mardi minuit d''après', (select ferme_le from public.arbitrages where saison = 1 and j = 5)
  = (pg_temp.auj() + 3)::timestamp at time zone 'Europe/Paris');
select pg_temp.vrai('S13 rattrapage : Badis prend la feuille du match 1', (pg_temp.en('Badis', $$public.prendre_feuille(5, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true');
select pg_temp.vote_pose(5, 'Théo', 'Sami');
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, jsonb_build_object('date', pg_temp.libelle(pg_temp.auj() + 21))));
select pg_temp.vrai('S13 un report ensuite ne refait pas le ménage', exists (select 1 from public.feuilles_direct where saison = 1 and j = 5)
  and exists (select 1 from public.votes_figures where saison = 1 and j = 5));
-- Une reprise d'avant (sans date d'origine) : une date changée ne fait rien.
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, jsonb_build_object('date', pg_temp.libelle(pg_temp.auj()),
  'reprise', '{"le":"2026-11-12T10:00:00.000Z","par":"Ilyes"}'::jsonb)));
select pg_temp.publier(pg_temp.avec_meta(pg_temp.doc(), 5, jsonb_build_object('date', pg_temp.libelle(pg_temp.auj() + 21))));
select pg_temp.vrai('S13 reprise sans date d''origine : rien d''effacé', exists (select 1 from public.votes_figures where saison = 1 and j = 5));

select 'suspens-check : tout est ok' as bilan;
rollback;
