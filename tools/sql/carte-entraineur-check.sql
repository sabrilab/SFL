-- Le banc de la carte d'entraîneur de Bola Team, gardée par le serveur
-- (lot B1, 03/11/2026 ; supabase/schema.sql : entraineur_cartes,
-- poser_cartes_entraineur, entraineur_normes, figer_normes_entraineur,
-- matchs_bola_serveur). Les données de entraineur-donnees.sql ; transaction
-- annulée, arrêt au premier ÉCHEC. Jamais sur la base de la ligue : un
-- Postgres local, après supabase/schema.sql.
--   psql -v ON_ERROR_STOP=1 -f tools/sql/carte-entraineur-check.sql

\set ON_ERROR_STOP 1
begin;
\ir entraineur-donnees.sql
\ir equipe-outils.sql

-- Un appel comme le serveur (la clé secrète) : la valeur, ou « refus <code> <message> ».
create function pg_temp.serveur(appel text) returns text language plpgsql as $$
declare r text;
begin
  set local role service_role;
  execute 'select (' || appel || ')::text' into r;
  reset role;
  return coalesce(r, 'null');
exception when others then
  reset role;
  return 'refus ' || sqlstate || ' ' || sqlerrm;
end; $$;

-- Une ligne de carte, en JSON, pour poser_cartes_entraineur.
create function pg_temp.ligne_carte(qui text, res int, pres int, coh int, equipe text default 'Sunday Five', journal jsonb default '[]'::jsonb)
returns jsonb language sql stable as $$
  select jsonb_build_object('joueur', pg_temp.uid(qui), 'equipe_id', pg_temp.eq(equipe), 'res', res, 'pres', pres, 'coh', coh,
                            'rencontres', 12, 'en_attente', '{"RES":1}'::jsonb, 'jauges', '{"RES":{"crans":1,"taille":2,"dette":0}}'::jsonb,
                            'journal', journal, 'majs', '[]'::jsonb, 'compteurs', '{}'::jsonb)
$$;
create function pg_temp.poser(lignes jsonb) returns text language sql as $$
  select pg_temp.serveur(format('public.poser_cartes_entraineur(%L::jsonb)', lignes))
$$;
-- La carte gardée, « res/pres/coh note ».
create function pg_temp.carte(qui text) returns text language sql volatile as $$
  select c.res || '/' || c.pres || '/' || c.coh || ' ' || c.note from public.entraineur_cartes c where c.joueur = pg_temp.uid(qui)
$$;

-- Lucien entraîne Sunday Five (le banc de la place : entraineur-check.sql).
select pg_temp.passe('0 invitation', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Lucien'));
select pg_temp.passe('0 signature', 'Lucien', pg_temp.appel('equipe_signer', 'Sunday Five'));

-- 1 · Un joueur, l'entraîneur lui-même et l'anonyme n'appellent jamais la fonction ; le serveur, si.
select pg_temp.vrai('1 droits de la fonction',
  not has_function_privilege('anon', 'public.poser_cartes_entraineur(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.poser_cartes_entraineur(jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.poser_cartes_entraineur(jsonb)', 'execute'));
select pg_temp.refuse('1 l''entraîneur ne pose pas sa carte', 'Lucien',
  format('public.poser_cartes_entraineur(%L::jsonb)', jsonb_build_array(pg_temp.ligne_carte('Lucien', 99, 99, 99))), '42501');
select pg_temp.refuse('1 le capitaine non plus', 'Ilyes',
  format('public.poser_cartes_entraineur(%L::jsonb)', jsonb_build_array(pg_temp.ligne_carte('Lucien', 90, 90, 90))), '42501');
select pg_temp.vrai('1 rien n''est posé', not exists (select 1 from public.entraineur_cartes));

-- 2 · Le serveur pose 78/76/75 : la note est l'arrondi supérieur de la moyenne (77), calculée par la base.
select pg_temp.vrai('2 pose', pg_temp.poser(jsonb_build_array(pg_temp.ligne_carte('Lucien', 78, 76, 75))) = '1');
select pg_temp.vrai('2 la carte', pg_temp.carte('Lucien') = '78/76/75 77', pg_temp.carte('Lucien'));
select pg_temp.vrai('2 son équipe, ses rencontres, ses jauges',
  (select c.equipe_id = pg_temp.eq('Sunday Five') and c.rencontres = 12 and c.jauges -> 'RES' ->> 'taille' = '2' and c.maj_le is not null
     from public.entraineur_cartes c where c.joueur = pg_temp.uid('Lucien')));

-- 3 · Rien ne descend : un calcul plus bas ne baisse aucune caractéristique ; ce qui monte monte, la note suit.
select pg_temp.vrai('3 posée', pg_temp.poser(jsonb_build_array(pg_temp.ligne_carte('Lucien', 75, 75, 75))) = '1');
select pg_temp.vrai('3 ne redescend jamais', pg_temp.carte('Lucien') = '78/76/75 77', pg_temp.carte('Lucien'));
update public.entraineur_cartes set maj_le = now() - interval '3 days' where joueur = pg_temp.uid('Lucien');
select pg_temp.vrai('3 un plus bas ne touche pas à la date de mise à jour',
  pg_temp.poser(jsonb_build_array(pg_temp.ligne_carte('Lucien', 77, 76, 75))) = '1'
  and (select c.maj_le < now() - interval '2 days' from public.entraineur_cartes c where c.joueur = pg_temp.uid('Lucien')));
select pg_temp.vrai('3 monte', pg_temp.poser(jsonb_build_array(pg_temp.ligne_carte('Lucien', 75, 79, 77))) = '1'
  and pg_temp.carte('Lucien') = '78/79/77 78', pg_temp.carte('Lucien'));
select pg_temp.vrai('3 la date de la mise à jour suit',
  (select c.maj_le > now() - interval '1 minute' from public.entraineur_cartes c where c.joueur = pg_temp.uid('Lucien')));

-- 4 · Les lignes invalides sont ignorées : compte ou équipe inconnus, hors de 75 à 99, journal qui n'est pas une liste.
select pg_temp.vrai('4 lignes invalides', pg_temp.poser(jsonb_build_array(
  jsonb_build_object('joueur', 'e0000000-0000-0000-0000-0000000000ff', 'res', 80, 'pres', 80, 'coh', 80),
  pg_temp.ligne_carte('Adil', 74, 80, 80),
  pg_temp.ligne_carte('Adil', 80, 100, 80),
  pg_temp.ligne_carte('Adil', 80, 80, 80) || '{"equipe_id": 999999}'::jsonb,
  pg_temp.ligne_carte('Adil', 80, 80, 80) || '{"journal": {"a": 1}}'::jsonb,
  pg_temp.ligne_carte('Adil', 80, 80, 80) || jsonb_build_object('journal', (select jsonb_agg(g) from generate_series(1, 401) g))
)) = '0' and pg_temp.carte('Adil') is null);
select pg_temp.vrai('4 pas un tableau', pg_temp.poser('{"a": 1}'::jsonb) like 'refus P0001%');
select pg_temp.vrai('4 sans équipe (un ancien entraîneur sans équipe), la ligne passe',
  pg_temp.poser(jsonb_build_array(pg_temp.ligne_carte('Adil', 76, 75, 75) - 'equipe_id')) = '1' and pg_temp.carte('Adil') = '76/75/75 76');

-- 5 · Deux lignes pour la même personne dans un appel : une seule écriture, la plus haute.
select pg_temp.vrai('5 doublons', pg_temp.poser(jsonb_build_array(pg_temp.ligne_carte('Adil', 76, 75, 75), pg_temp.ligne_carte('Adil', 80, 81, 79))) = '1'
  and pg_temp.carte('Adil') = '80/81/79 80', pg_temp.carte('Adil'));

-- 6 · La ligue lit ; un compte qui attend d'être accepté et l'anonyme, non.
select pg_temp.vrai('6 un joueur d''une autre équipe lit', pg_temp.lire('Yanis', 'select count(*)::text from public.entraineur_cartes') = '2');
select pg_temp.vrai('6 l''entraîneur lit la sienne', pg_temp.lire('Lucien', format('select note::text from public.entraineur_cartes where joueur = %L', pg_temp.uid('Lucien'))) = '78');
select pg_temp.vrai('6 non validé : rien', pg_temp.lire('Nolan', 'select count(*)::text from public.entraineur_cartes') = '0');
select pg_temp.vrai('6 anonyme : rien', has_table_privilege('anon', 'public.entraineur_cartes', 'select') = false);

-- 7 · Personne n'écrit directement : ni l'entraîneur, ni un joueur, ni le capitaine.
select pg_temp.vrai('7 pas d''écriture', pg_temp.lire('Lucien', format($q$insert into public.entraineur_cartes (joueur, res, pres, coh, note) values (%L, 99, 99, 99, 99) returning 'écrit'$q$, pg_temp.uid('Ilyes'))) like 'refus 42501%');
select pg_temp.vrai('7 pas de mise à jour', pg_temp.lire('Lucien', $q$update public.entraineur_cartes set res = 99 returning 'écrit'$q$) like 'refus 42501%'
  and pg_temp.carte('Lucien') = '78/79/77 78');
select pg_temp.vrai('7 pas d''effacement', pg_temp.lire('Ilyes', $q$delete from public.entraineur_cartes returning 'effacé'$q$) like 'refus 42501%'
  and (select count(*) from public.entraineur_cartes) = 2);

-- 8 · Les normes d'une saison : la seconde écriture ne change rien ; le serveur seul les fige.
select pg_temp.vrai('8 droits', not has_function_privilege('authenticated', 'public.figer_normes_entraineur(int, double precision, double precision)', 'execute')
  and has_function_privilege('service_role', 'public.figer_normes_entraineur(int, double precision, double precision)', 'execute'));
select pg_temp.vrai('8 figée', pg_temp.serveur('public.figer_normes_entraineur(1, -0.1, 0.0013)') = 'true');
select pg_temp.vrai('8 la seconde écriture ne change rien', pg_temp.serveur('public.figer_normes_entraineur(1, -2.5, 0.2)') = 'false'
  and (select n.presence = -0.1 and n.departs_par_jour = 0.0013 from public.entraineur_normes n where n.saison = 1));
select pg_temp.vrai('8 hors bornes', pg_temp.serveur('public.figer_normes_entraineur(2, 0.5, 0.001)') like 'refus 22023%'
  and pg_temp.serveur('public.figer_normes_entraineur(2, -0.1, 1.5)') like 'refus 22023%'
  and pg_temp.serveur($q$public.figer_normes_entraineur(2, 'NaN'::double precision, 0.001)$q$) like 'refus 22023%'
  and pg_temp.serveur('public.figer_normes_entraineur(0, -0.1, 0.001)') like 'refus 22023%');
select pg_temp.refuse('8 un joueur ne fige rien', 'Ilyes', 'public.figer_normes_entraineur(3, -0.1, 0.001)', '42501');
select pg_temp.vrai('8 la ligue lit les normes', pg_temp.lire('Badis', 'select count(*)::text from public.entraineur_normes') = '1'
  and pg_temp.lire('Nolan', 'select count(*)::text from public.entraineur_normes') = '0');

-- 9 · Les matchs Bola pour le serveur : la clé secrète seule (ligue_vierge ne lui rend rien sans session).
select pg_temp.vrai('9 droits', not has_function_privilege('authenticated', 'public.matchs_bola_serveur()', 'execute')
  and not has_function_privilege('anon', 'public.matchs_bola_serveur()', 'execute')
  and has_function_privilege('service_role', 'public.matchs_bola_serveur()', 'execute'));
select pg_temp.refuse('9 un joueur ne lit pas par là', 'Ilyes', 'public.matchs_bola_serveur()', '42501');
select pg_temp.vrai('9 le serveur lit une liste', pg_temp.serveur('jsonb_typeof(public.matchs_bola_serveur())') = 'array');
-- Un match Bola saisi, posé directement (sans session : la base laisse le serveur dater un match passé) : le serveur le lit.
select set_config('request.jwt.claim.sub', '', true);
with m as (
  insert into public.matchs (organisateur, visibilite, jour, heure, lieu, places, mode, score_clairs, score_fonces, saisi_le)
  values (pg_temp.uid('Badis'), 'prive', current_date - 10, '20h00', 'Terrain', 10, 'bola', 3, 2, now() - interval '9 days')
  returning id
)
insert into public.match_joueurs (match_id, player_id, statut, equipe, buts, passes)
select m.id, pg_temp.uid(n), 'inscrit', case when o <= 4 then 'clairs' else 'fonces' end, case when o = 1 then 2 else 0 end, 0
  from m, unnest(array['Badis', 'Sami', 'Kader', 'Naim', 'Anis', 'Karim', 'Mehdi', 'Yacine']) with ordinality t(n, o);
select pg_temp.vrai('9 le serveur lit le match, au format de ligue_vierge',
  pg_temp.serveur($q$(select jsonb_array_length(x)::text || '/' || (x -> 0 ->> 'scoreClairs') || '/' || (x -> 0 -> 'joueurs' -> 0 ->> 'name') from (select public.matchs_bola_serveur() x) y)$q$) = '1/3/Badis',
  pg_temp.serveur('public.matchs_bola_serveur()'));

-- 10 · La carte suit la personne : son compte effacé, sa carte part avec ; son équipe effacée, la carte reste, sans équipe.
select pg_temp.vrai('10 posée pour Malik chez AS Fives', pg_temp.poser(jsonb_build_array(pg_temp.ligne_carte('Malik', 77, 76, 75, 'AS Fives'))) = '1');
delete from public.equipes where id = pg_temp.eq('AS Fives');
select pg_temp.vrai('10 l''équipe effacée, la carte reste, sans équipe',
  (select c.equipe_id is null and c.res = 77 from public.entraineur_cartes c where c.joueur = pg_temp.uid('Malik')));
delete from public.profiles where id = pg_temp.uid('Adil');
select pg_temp.vrai('10 un compte effacé emporte sa carte', (select count(*) from public.entraineur_cartes) = 2);

-- 11 · Ce que lit le serveur (lib/sfl/entraineur-serveur.server.ts) : chaque colonne existe, sous ce nom.
create temp table lues (tab text, cols text[]);
insert into lues values
  ('equipe_entraineurs', '{equipe_id,joueur,debut,fin,motif,id}'),
  ('equipes', '{id,nom,created_at,dissoute_le}'),
  ('equipe_membres', '{equipe_id,joueur,statut,role,signe_le,created_at}'),
  ('equipe_signatures', '{equipe_id,joueur,le,version}'),
  ('equipe_departs', '{equipe_id,joueur,parti_le,motif,role}'),
  ('equipe_defis', '{id,de,a,jour,heure,lieu,statut,forfait_de}'),
  ('equipe_resultats', '{defi_id,equipe_id,pour,contre,saisi_le,presents,presents_adverses}'),
  ('equipe_feuilles', '{defi_id,equipe_id,deposee_le}'),
  ('equipe_feuille_joueurs', '{defi_id,equipe_id,joueur}'),
  ('profiles', '{id,name}'),
  ('entraineur_cartes', '{joueur,res,pres,coh,note,equipe_id,rencontres,en_attente,jauges,journal,majs,compteurs,maj_le,calcule_le}'),
  ('entraineur_normes', '{saison,presence,departs_par_jour}'),
  ('entrees_sfl', '{joueur,le}');
select pg_temp.vrai('11 les colonnes lues par le serveur', not exists (
  select 1 from lues t
   where (select count(*) from information_schema.columns i
           where i.table_schema = 'public' and i.table_name = t.tab and i.column_name = any (t.cols)) <> cardinality(t.cols)
), (select string_agg(t.tab, ', ') from lues t
     where (select count(*) from information_schema.columns i
             where i.table_schema = 'public' and i.table_name = t.tab and i.column_name = any (t.cols)) <> cardinality(t.cols)));
rollback;
