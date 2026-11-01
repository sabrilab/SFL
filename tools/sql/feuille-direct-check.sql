-- Le banc SQL de la feuille de match tenue par un joueur (01/11/2026).
--
-- À jouer sur un Postgres 16 local (ou une branche Supabase), JAMAIS sur la
-- base de la ligue : d'abord supabase/schema.sql en entier, deux fois de
-- suite (la migration est idempotente), puis ce fichier. Sur un Postgres nu,
-- tools/sql/supabase-reduit.sql pose avant le strict nécessaire de Supabase
-- (rôles, auth, storage, publication temps réel).
--
--   psql -v ON_ERROR_STOP=1 -f tools/sql/feuille-direct-check.sql
--
-- Les données (six comptes de test, une saison avec la J4 du jour) sont
-- posées dans une transaction annulée à la fin : rien ne reste. Chaque ligne
-- de résultat commence par son numéro d'essai et finit par ok / ÉCHEC ; le
-- fichier s'arrête au premier ÉCHEC. La prise simultanée par deux
-- téléphones, qui demande deux sessions, est dans feuille-direct-concurrence.sh.

\set ON_ERROR_STOP 1
begin;

-- ═══ Données ═══
\ir feuille-direct-donnees.sql

-- Appeler une fonction comme un joueur (son jeton), avec ses seuls droits.
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

-- Une écriture comme un joueur : le nombre de lignes touchées, ou « refus … ».
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

-- Publier comme l'admin Ilyes, sur la base `v` (la version que son appareil connaît).
create function pg_temp.publier(p jsonb, v bigint, forcer boolean default false) returns jsonb language plpgsql as $$
begin
  return pg_temp.en('Ilyes', format('public.publier_saison(%L::jsonb, 0, %s, %L::boolean)', p, v, forcer));
end; $$;

-- Un essai : ok, ou ÉCHEC et l'arrêt.
create function pg_temp.vrai(nom text, cond boolean, detail text default '') returns text language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC % %', nom, detail; end if;
  return nom || ' ok';
end; $$;

-- Une ligne de la saison, pour lire ses chiffres.
create function pg_temp.ligne(j int, joueur text, equipe text) returns jsonb language sql stable as $$
  select e from public.saison s, jsonb_array_elements(s.data -> 'entries') e
   where s.id = 1 and (e ->> 'j')::int = j and e ->> 'player' = joueur and e ->> 'team' = equipe
$$;

-- ═══ Essais ═══
-- 1 · Seulement un joueur de CE match, d'une journée publiée, le jour même.
select pg_temp.vrai('T1 un joueur d''un autre match', pg_temp.en('Kader', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'refus' = 'pas-ton-match');
select pg_temp.vrai('T1 l''admin qui ne joue pas', pg_temp.en('Sabri', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'refus' = 'pas-ton-match');
select pg_temp.vrai('T1 une journée en brouillon', pg_temp.en('Théo', $$public.prendre_feuille(5, 'Noirs 1', 'Blancs 1')$$) ->> 'refus' = 'brouillon');
select pg_temp.vrai('T1 une journée d''un autre jour', pg_temp.en('Ilyes', $$public.prendre_feuille(3, 'Noirs 1', 'Blancs 1')$$) ->> 'refus' = 'pas-du-jour');
select pg_temp.vrai('T1 deux camps qui ne jouent pas ensemble', pg_temp.en('Théo', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 2')$$) ->> 'refus' = 'match');
select pg_temp.vrai('T1 personne n''écrit la table', not has_table_privilege('authenticated', 'public.feuilles_direct', 'insert')
  and not has_table_privilege('authenticated', 'public.feuilles_direct', 'update')
  and not has_table_privilege('authenticated', 'public.feuilles_direct', 'delete'));

-- 2 · Théo prend la feuille du match 1 ; elle part du but qu'Ilyes a déjà.
select pg_temp.vrai('T2 Théo prend', (pg_temp.en('Théo', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) -> 'feuille' ->> 'preneur_nom') = 'Théo');
select pg_temp.vrai('T2 les compteurs de départ', (select compteurs = '{"Ilyes":{"buts":1}}'::jsonb from public.feuilles_direct where j = 4 and noirs = 'Noirs 1'));
select pg_temp.vrai('T2 la reprendre ne change rien', pg_temp.en('Théo', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok' = 'true');

-- 3 · Un second joueur du match : la feuille est tenue, il lit qui la tient.
select pg_temp.vrai('T3 Badis la trouve tenue', (select r ->> 'refus' = 'tenue' and r -> 'feuille' ->> 'preneur_nom' = 'Théo'
  from (select pg_temp.en('Badis', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) as r) x));
select pg_temp.vrai('T3 Badis ne compte pas', pg_temp.en('Badis', $$public.compter_feuille(4, 'Noirs 1', 'Blancs 1', '[{"joueur":"Badis","quoi":"buts","d":1}]')$$) ->> 'refus' = 'pas-preneur');

-- 4 · Théo compte : un but d'Ilyes et sa passe d'Anis, d'un seul geste ; puis
-- deux arrêts de Sami ; un joueur d'ailleurs et un −1 à zéro ne comptent pas.
select pg_temp.vrai('T4 but et passe', (pg_temp.en('Théo', $$public.compter_feuille(4, 'Noirs 1', 'Blancs 1', '[{"joueur":"Ilyes","quoi":"buts","d":1},{"joueur":"Anis","quoi":"passes","d":1}]')$$) -> 'feuille' -> 'compteurs' -> 'Ilyes' ->> 'buts') = '2');
select pg_temp.vrai('T4 deux arrêts', (pg_temp.en('Théo', $$public.compter_feuille(4, 'Noirs 1', 'Blancs 1', '[{"joueur":"Sami","quoi":"arrets","d":1},{"joueur":"Sami","quoi":"arrets","d":1}]')$$) -> 'feuille' -> 'compteurs' -> 'Sami' ->> 'arrets') = '2');
select pg_temp.vrai('T4 un joueur d''un autre match', pg_temp.en('Théo', $$public.compter_feuille(4, 'Noirs 1', 'Blancs 1', '[{"joueur":"Kader","quoi":"buts","d":1}]')$$) ->> 'refus' = 'geste');
select pg_temp.vrai('T4 un geste inconnu', pg_temp.en('Théo', $$public.compter_feuille(4, 'Noirs 1', 'Blancs 1', '[{"joueur":"Ilyes","quoi":"mvp","d":1}]')$$) ->> 'refus' = 'geste');
select pg_temp.vrai('T4 −1 à zéro ne s''écrit pas', (select jsonb_array_length(r -> 'feuille' -> 'journal') = 2
  from (select pg_temp.en('Théo', $$public.compter_feuille(4, 'Noirs 1', 'Blancs 1', '[{"joueur":"Badis","quoi":"passes","d":-1}]')$$) as r) x));
select pg_temp.vrai('T4 le document n''a pas bougé', (pg_temp.ligne(4, 'Ilyes', 'Noirs 1') ->> 'buts') = '1');

-- 5 · L'écriture de l'admin, pendant que Théo tient la feuille du match 1 :
-- les chiffres du match 1 sont refusés (même en écrasant), le reste passe.
select pg_temp.vrai('T5 un but du match 1 par l''admin', (select pg_temp.publier(jsonb_set(s.data, '{entries,4,buts}', '3'), s.version) ->> 'hint' = 'feuille-tenue' from public.saison s));
select pg_temp.vrai('T5 même en écrasant', (select pg_temp.publier(jsonb_set(s.data, '{entries,4,buts}', '3'), s.version, true) ->> 'hint' = 'feuille-tenue' from public.saison s));
select pg_temp.vrai('T5 un retard sur le match 1', (select pg_temp.publier(jsonb_set(s.data, '{entries,3,retard}', 'true'), s.version) ->> 'ok' = 'true' from public.saison s));
select pg_temp.vrai('T5 un but sur le match 2', (select pg_temp.publier(jsonb_set(s.data, '{entries,7,buts}', '1'), s.version) ->> 'ok' = 'true' from public.saison s));
select pg_temp.vrai('T5 un remplaçant ajouté au match 1, à zéro', (select pg_temp.publier(s.data || jsonb_build_object('entries', s.data -> 'entries'
  || '[{"j":4,"player":"Yanis","team":"Blancs 1","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":false,"retard":false}]'::jsonb), s.version) ->> 'ok' = 'true' from public.saison s));

-- 6 · Théo passe la main à Badis, puis l'admin libère et Sami la reprend :
-- les compteurs suivent.
select pg_temp.vrai('T6 passer à un joueur d''un autre match', pg_temp.en('Théo', $$public.passer_feuille(4, 'Noirs 1', 'Blancs 1', 'Kader')$$) ->> 'refus' = 'pas-ton-match');
select pg_temp.vrai('T6 passer à un joueur sans compte', pg_temp.en('Théo', $$public.passer_feuille(4, 'Noirs 1', 'Blancs 1', 'Anis')$$) ->> 'refus' = 'sans-compte');
select pg_temp.vrai('T6 passer à Badis', (pg_temp.en('Théo', $$public.passer_feuille(4, 'Noirs 1', 'Blancs 1', 'Badis')$$) -> 'feuille' ->> 'preneur_nom') = 'Badis');
select pg_temp.vrai('T6 Théo ne compte plus', pg_temp.en('Théo', $$public.compter_feuille(4, 'Noirs 1', 'Blancs 1', '[{"joueur":"Ilyes","quoi":"buts","d":1}]')$$) ->> 'refus' = 'pas-preneur');
select pg_temp.vrai('T6 Badis marque contre son camp', (pg_temp.en('Badis', $$public.compter_feuille(4, 'Noirs 1', 'Blancs 1', '[{"joueur":"Badis","quoi":"csc","d":1}]')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T6 un joueur ne libère pas', pg_temp.en('Badis', $$public.feuille_admin(4, 'Noirs 1', 'Blancs 1', 'liberer')$$) ->> 'erreur' is not null);
select pg_temp.vrai('T6 l''admin libère', (pg_temp.en('Ilyes', $$public.feuille_admin(4, 'Noirs 1', 'Blancs 1', 'liberer')$$) -> 'feuille' ->> 'preneur') is null);
select pg_temp.vrai('T6 Sami la reprend', (pg_temp.en('Sami', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) -> 'feuille' ->> 'preneur_nom') = 'Sami');
select pg_temp.vrai('T6 un but de Sami', (pg_temp.en('Sami', $$public.compter_feuille(4, 'Noirs 1', 'Blancs 1', '[{"joueur":"Sami","quoi":"buts","d":1}]')$$) -> 'feuille' -> 'compteurs' -> 'Sami' ->> 'buts') = '1');

-- 7 · « Fin du match » : seul le preneur (ou l'admin) scelle ; les chiffres
-- entrent dans la saison, sur les seules lignes du match 1.
create temp table avant as select data, version from public.saison where id = 1;
create temp table histo_avant as select count(*) as n from public.saison_historique;
select pg_temp.vrai('T7 un autre joueur ne scelle pas', pg_temp.en('Théo', $$public.sceller_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'refus' = 'pas-preneur');
select pg_temp.vrai('T7 Sami scelle', (pg_temp.en('Sami', $$public.sceller_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok') = 'true');
-- Noirs 1 : Ilyes 2 buts + le but contre son camp de Badis = 3 ; Blancs 1 : Sami 1.
select pg_temp.vrai('T7 Ilyes', (select (e ->> 'buts') = '2' and e ->> 'result' = 'Victoire' and (e ->> 'mvp')::boolean from (select pg_temp.ligne(4, 'Ilyes', 'Noirs 1') e) x));
select pg_temp.vrai('T7 Anis', (select (e ->> 'passes') = '1' and e ->> 'result' = 'Victoire' and not coalesce((e ->> 'mvp')::boolean, false) from (select pg_temp.ligne(4, 'Anis', 'Noirs 1') e) x));
select pg_temp.vrai('T7 le but contre son camp sur la première ligne des Noirs', (select (e ->> 'teamScoreBonus') = '1' from (select pg_temp.ligne(4, 'Ilyes', 'Noirs 1') e) x));
select pg_temp.vrai('T7 Sami (Blancs 1)', (select (e ->> 'buts') = '1' and (e ->> 'arrets') = '2' and e ->> 'result' = 'Défaite' from (select pg_temp.ligne(4, 'Sami', 'Blancs 1') e) x));
select pg_temp.vrai('T7 Badis (Blancs 1)', (select e ->> 'result' = 'Défaite' and (e ->> 'buts') = '0' from (select pg_temp.ligne(4, 'Badis', 'Blancs 1') e) x));
select pg_temp.vrai('T7 le match 2 n''a pas bougé', (select pg_temp.ligne(4, 'Kader', 'Noirs 2') = (select e from avant, jsonb_array_elements(avant.data -> 'entries') e where e ->> 'player' = 'Kader')
  and pg_temp.ligne(4, 'Sami', 'Blancs 2') = (select e from avant, jsonb_array_elements(avant.data -> 'entries') e where e ->> 'player' = 'Sami' and e ->> 'team' = 'Blancs 2')));
select pg_temp.vrai('T7 hors des lignes du match 1, rien ne change', (select
  (s.data - 'entries') = (a.data - 'entries')
  and (select jsonb_agg(e order by i) from jsonb_array_elements(s.data -> 'entries') with ordinality t(e, i) where not (e ->> 'j' = '4' and e ->> 'team' in ('Noirs 1', 'Blancs 1')))
    = (select jsonb_agg(e order by i) from jsonb_array_elements(a.data -> 'entries') with ordinality t(e, i) where not (e ->> 'j' = '4' and e ->> 'team' in ('Noirs 1', 'Blancs 1')))
  from public.saison s, avant a where s.id = 1));
select pg_temp.vrai('T7 la version avance', (select s.version > a.version from public.saison s, avant a where s.id = 1));
select pg_temp.vrai('T7 l''historique garde l''état d''avant, signé de Sami', (select count(*) = (select n from histo_avant) + 1 from public.saison_historique)
  and (select h.data = a.data and h.par = (select id from public.profiles where name = 'Sami' and id::text like 'd0000000-%')
         from public.saison_historique h, avant a order by h.id desc limit 1));
select pg_temp.vrai('T7 le signal suit', (select g.version = s.version from public.saison_signal g, public.saison s where s.id = 1));
select pg_temp.vrai('T7 la feuille est scellée', (select fin is not null and version = (select version from public.saison where id = 1) from public.feuilles_direct where j = 4 and noirs = 'Noirs 1'));

-- 8 · Après la fin, plus rien ne bouge sur la feuille.
select pg_temp.vrai('T8 compter', pg_temp.en('Sami', $$public.compter_feuille(4, 'Noirs 1', 'Blancs 1', '[{"joueur":"Sami","quoi":"buts","d":1}]')$$) ->> 'refus' = 'scellee');
select pg_temp.vrai('T8 sceller deux fois', pg_temp.en('Sami', $$public.sceller_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'refus' = 'scellee');
select pg_temp.vrai('T8 la reprendre', pg_temp.en('Théo', $$public.prendre_feuille(4, 'Noirs 1', 'Blancs 1')$$) ->> 'ok' = 'false');

-- 9 · Le conflit avec une publication de l'admin, dont l'appareil est resté
-- sur la version d'avant le sceau : sans écraser, il reprend la base ; en
-- écrasant, la feuille scellée est gardée ; à jour, il corrige.
select pg_temp.vrai('T9 sans écraser', (select pg_temp.publier(a.data, a.version) ->> 'ok' = 'false' from avant a));
select pg_temp.vrai('T9 en écrasant', (select pg_temp.publier(a.data, a.version, true) ->> 'hint' = 'feuille-tenue' from avant a));
select pg_temp.vrai('T9 le sceau tient', (pg_temp.ligne(4, 'Ilyes', 'Noirs 1') ->> 'buts') = '2');
select pg_temp.vrai('T9 à jour, l''admin corrige', (select pg_temp.publier(jsonb_set(s.data, '{entries,6,passes}', '1'), s.version) ->> 'ok' = 'true' from public.saison s));
select pg_temp.vrai('T9 sa correction reste', (pg_temp.ligne(4, 'Sami', 'Blancs 1') ->> 'passes') = '1');

-- 10 · Le match 2 : Kader prend, Naim marque contre son camp ; Sami y est en
-- Xtratime et marque. Pas de MVP pour une ligne Xtratime.
select pg_temp.vrai('T10 Kader prend', (pg_temp.en('Kader', $$public.prendre_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T10 un csc et un but en Xtratime', (pg_temp.en('Kader', $$public.compter_feuille(4, 'Noirs 2', 'Blancs 2', '[{"joueur":"Naim","quoi":"csc","d":1},{"joueur":"Sami","quoi":"buts","d":1}]')$$) ->> 'ok') = 'true');
select pg_temp.vrai('T10 l''admin scelle à la place du preneur', (pg_temp.en('Ilyes', $$public.sceller_feuille(4, 'Noirs 2', 'Blancs 2')$$) ->> 'ok') = 'true');
-- 1 – 2 en tenant compte du but de l'admin (T5) : Kader 1 + csc 1 = 2 ; Blancs 2 : Sami (Xtratime) 1.
select pg_temp.vrai('T10 Noirs 2', (select e ->> 'result' = 'Victoire' and (e ->> 'teamScoreBonus') = '1' and (e ->> 'mvp')::boolean from (select pg_temp.ligne(4, 'Kader', 'Noirs 2') e) x));
select pg_temp.vrai('T10 Blancs 2', (select e ->> 'result' = 'Défaite' from (select pg_temp.ligne(4, 'Naim', 'Blancs 2') e) x));
select pg_temp.vrai('T10 la ligne Xtratime', (select (e ->> 'buts') = '1' and e ->> 'result' is null and not coalesce((e ->> 'mvp')::boolean, false) from (select pg_temp.ligne(4, 'Sami', 'Blancs 2') e) x));

-- 11 · L'admin rouvre la feuille du match 1 : elle repart de la saison (sa correction comprise).
select pg_temp.vrai('T11 rouvrir', (select r ->> 'ok' = 'true' and r -> 'feuille' -> 'compteurs' -> 'Sami' ->> 'passes' = '1' and r -> 'feuille' ->> 'fin' is null
  from (select pg_temp.en('Ilyes', $$public.feuille_admin(4, 'Noirs 1', 'Blancs 1', 'rouvrir')$$) as r) x));
select pg_temp.vrai('T11 Sami la tient encore', (select preneur_nom = 'Sami' from public.feuilles_direct where j = 4 and noirs = 'Noirs 1'));

-- 12 · Les cartons vus : le joueur les pose sur sa ligne, pas sur celle d'un autre.
select pg_temp.vrai('T12 Théo note un carton vu', pg_temp.ecrire_en('Théo', $$update public.profiles set cartons_vus = cartons_vus || '{s1-j4-jaune}' where id = auth.uid()$$) = '1');
select pg_temp.vrai('T12 il est noté', (select cartons_vus = '{s1-j4-jaune}' from public.profiles where name = 'Théo' and id::text like 'd0000000-%'));
select pg_temp.vrai('T12 pas chez un autre', pg_temp.ecrire_en('Théo', $$update public.profiles set cartons_vus = '{x}' where name = 'Badis'$$) = '0');
select pg_temp.vrai('T12 ni ses autres colonnes', pg_temp.ecrire_en('Théo', $$update public.profiles set is_admin = true where id = auth.uid()$$) like 'refus%');

select 'feuille-direct-check : tout est ok' as bilan;
rollback;
