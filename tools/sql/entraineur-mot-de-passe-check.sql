-- Le banc de l'entraîneur de Bola Team face aux comptes qui doivent encore
-- changer leur mot de passe (intégration du 04/11/2026 : l'entraîneur, écrit
-- avant l'audit de sécurité du 03/11, rejoint la production qui l'a fait).
--
-- Un compte qui a une ligne dans mot_de_passe_a_changer (mot de passe
-- d'origine, devenu public, ou provisoire) n'est ni membre ni admin pour la
-- base (est_membre, is_league_admin, mot_de_passe_choisi). Ce banc vérifie
-- qu'aucune des fonctions ni des règles que l'entraîneur crée ou remplace ne
-- lui rouvre quoi que ce soit : ni droit d'équipe (equipe_droit, qui sert
-- partout), ni invitation, signature, refus, feuille d'avant-match, score,
-- défi, couverture, écusson, direction ; ni lecture des feuilles, de sa
-- place d'entraîneur, de sa carte, des cartes et des normes de la ligue ; ni
-- fonction du serveur. Puis, les lignes effacées (mot de passe changé), que
-- les mêmes gestes repassent : le banc ne refuse pas tout par accident.
--
-- À jouer sur un Postgres 16 local (ou une branche Supabase), JAMAIS sur la
-- base de la ligue : tools/sql/supabase-reduit.sql et supabase-droits.sql sur
-- un Postgres nu, supabase/schema.sql deux fois, puis
--   psql -v ON_ERROR_STOP=1 -f tools/sql/entraineur-mot-de-passe-check.sql
-- Les données d'entraineur-donnees.sql, dans une transaction annulée à la fin ;
-- chaque ligne finit par ok, le fichier s'arrête au premier ÉCHEC.
--   M1 avant : Lucien entraîne Sunday Five, dépose la feuille, a sa carte ;
--   M2 les comptes verrouillés (Ilyes capitaine, Théo vice, Lucien
--      entraîneur, Adil invité comme entraîneur de Racing Wazemmes, Badis
--      joueur) : aucun droit d'équipe ;
--   M3 aucun geste d'équipe ;
--   M4 aucune lecture de l'entraîneur ;
--   M5 aucune fonction du serveur ;
--   M6 les lignes effacées : tout revient.

\set ON_ERROR_STOP 1
begin;

\ir entraineur-donnees.sql
\ir equipe-outils.sql

-- Le nombre de lignes qu'une lecture rend à un joueur (ou « refus … »).
create function pg_temp.combien(qui text, requete text) returns text language sql volatile as $$
  select pg_temp.lire(qui, format('select count(*)::text from (%s) x', requete))
$$;

-- ═══ M1 · Avant : tout passe ═══
select pg_temp.passe('M1 Ilyes invite Lucien comme entraîneur', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Lucien'));
select pg_temp.passe('M1 Lucien signe', 'Lucien', pg_temp.appel('equipe_signer', 'Sunday Five'));
select pg_temp.passe('M1 Yanis invite Adil comme entraîneur', 'Yanis', pg_temp.appel('equipe_entraineur_inviter', 'Racing Wazemmes', 'Adil'));
select pg_temp.passe('M1 Ilyes invite Naim comme joueur', 'Ilyes', pg_temp.appel('equipe_inviter', 'Sunday Five', 'Naim'));
select pg_temp.match('Sunday Five', 'Racing Wazemmes', 72) as d1 \gset
select pg_temp.match('Sunday Five', 'Racing Wazemmes', -2) as d2 \gset
select pg_temp.passe('M1 Lucien dépose la feuille', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader']));
-- Sa carte d'entraîneur, comme le serveur la pose, et des normes figées.
set local role service_role;
select public.poser_cartes_entraineur(jsonb_build_array(jsonb_build_object(
  'joueur', pg_temp.uid('Lucien'), 'equipe_id', pg_temp.eq('Sunday Five'), 'res', 80, 'pres', 78, 'coh', 77, 'rencontres', 3,
  'journal', '[{"t":"Sami a été exclu"}]'::jsonb)));
select public.figer_normes_entraineur(1, -0.5, 0.01);
reset role;
select pg_temp.vrai('M1 droits du capitaine', pg_temp.droits('Ilyes', 'Sunday Five') =
  'annuler=true,couverture=true,defier=true,direction=true,ecusson=true,excuser=true,feuille=true,inviter=true,score=true');
select pg_temp.vrai('M1 droits de l''entraîneur', pg_temp.droits('Lucien', 'Sunday Five') =
  'annuler=false,couverture=false,defier=true,direction=false,ecusson=false,excuser=false,feuille=true,inviter=true,score=false');
select pg_temp.vrai('M1 Lucien lit sa feuille', pg_temp.combien('Lucien', format('select 1 from public.equipe_feuille_joueurs where defi_id = %s', :d1)) = '5');
select pg_temp.vrai('M1 Lucien lit sa place', pg_temp.combien('Lucien', 'select 1 from public.equipe_entraineurs') = '1');
select pg_temp.vrai('M1 Lucien lit le détail de sa carte', pg_temp.combien('Lucien', 'select * from public.ma_carte_entraineur()') = '1');
select pg_temp.vrai('M1 Badis lit la face des cartes', pg_temp.combien('Badis', 'select joueur, note from public.entraineur_cartes') = '1');
select pg_temp.vrai('M1 Badis lit les normes', pg_temp.combien('Badis', 'select 1 from public.entraineur_normes') = '1');
select pg_temp.vrai('M1 Yanis voit que la feuille est déposée', pg_temp.combien('Yanis', format('select * from public.equipe_feuilles_deposees(array[%s]::bigint[])', :d1)) = '1');

-- ═══ M2 · Les comptes verrouillés : aucun droit ═══
insert into public.mot_de_passe_a_changer (user_id, motif)
select pg_temp.uid(n), case when n = 'Badis' then 'provisoire' else 'origine' end
  from unnest(array['Ilyes', 'Théo', 'Lucien', 'Adil', 'Badis']) n;
select pg_temp.vrai('M2 le capitaine : aucun droit', pg_temp.droits('Ilyes', 'Sunday Five') =
  'annuler=false,couverture=false,defier=false,direction=false,ecusson=false,excuser=false,feuille=false,inviter=false,score=false');
select pg_temp.vrai('M2 le vice : aucun droit', pg_temp.droits('Théo', 'Sunday Five') =
  'annuler=false,couverture=false,defier=false,direction=false,ecusson=false,excuser=false,feuille=false,inviter=false,score=false');
select pg_temp.vrai('M2 l''entraîneur : aucun droit', pg_temp.droits('Lucien', 'Sunday Five') =
  'annuler=false,couverture=false,defier=false,direction=false,ecusson=false,excuser=false,feuille=false,inviter=false,score=false');
select pg_temp.vrai('M2 role_equipe ne le dit plus membre', pg_temp.lire('Lucien', format('select coalesce(public.role_equipe(%s), ''aucun'')', pg_temp.eq('Sunday Five'))) = 'aucun');

-- ═══ M3 · Aucun geste d'équipe ═══
select pg_temp.refuse('M3 le capitaine n''invite pas d''entraîneur', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Malik'), '42501');
select pg_temp.refuse('M3 le capitaine n''invite pas de joueur', 'Ilyes', pg_temp.appel('equipe_inviter', 'Sunday Five', 'Anis'), '42501');
select pg_temp.refuse('M3 l''entraîneur n''invite pas de joueur', 'Lucien', pg_temp.appel('equipe_inviter', 'Sunday Five', 'Anis'), '42501');
select pg_temp.refuse('M3 le capitaine ne retire pas une invitation', 'Ilyes', pg_temp.appel('equipe_retirer_invitation', 'Sunday Five', 'Naim'), '42501');
select pg_temp.refuse('M3 l''invité verrouillé ne refuse pas la sienne', 'Adil', pg_temp.appel('equipe_retirer_invitation', 'Racing Wazemmes', 'Adil'), '42501');
select pg_temp.refuse('M3 l''invité verrouillé ne signe pas', 'Adil', pg_temp.appel('equipe_signer', 'Racing Wazemmes'), '42501');
select pg_temp.vrai('M3 son invitation est toujours là', (pg_temp.ligne('Racing Wazemmes', 'Adil')).statut = 'invite');
select pg_temp.refuse('M3 l''entraîneur ne dépose pas la feuille', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Sami', 'Kader', 'Badis']), '42501');
select pg_temp.refuse('M3 le capitaine ne dépose pas la feuille', 'Ilyes', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Sami', 'Kader', 'Badis']), '42501');
select pg_temp.refuse('M3 le capitaine ne saisit pas le score', 'Ilyes', format('public.equipe_resultat(%s, 3, 1, ''[]''::jsonb, 5, 5)', :d2), '42501');
select pg_temp.refuse('M3 le vice ne saisit pas le score', 'Théo', format('public.equipe_resultat(%s, 3, 1, ''[]''::jsonb, 5, 5)', :d2), '42501');
select pg_temp.refuse('M3 l''entraîneur ne défie pas', 'Lucien', pg_temp.defier('Sunday Five', 'Racing Wazemmes', 120), '42501');
select pg_temp.refuse('M3 le capitaine ne défie pas', 'Ilyes', pg_temp.defier('Sunday Five', 'Racing Wazemmes', 120), '42501');
select pg_temp.refuse('M3 le capitaine n''annule pas un match', 'Ilyes', format('public.equipe_defi_statut(%s, ''annule'')', :d1), '42501');
select pg_temp.refuse('M3 l''entraîneur n''annule pas un match', 'Lucien', format('public.equipe_defi_statut(%s, ''annule'')', :d1), '42501');
select pg_temp.refuse('M3 le capitaine n''exclut pas', 'Ilyes', pg_temp.appel('equipe_exclure', 'Sunday Five', 'Lucien'), '42501');
select pg_temp.refuse('M3 le capitaine ne nomme pas de vice', 'Ilyes', pg_temp.appel('equipe_vice', 'Sunday Five', 'Sami'), '42501');
select pg_temp.refuse('M3 le capitaine ne dissout pas', 'Ilyes', pg_temp.appel('equipe_dissoudre', 'Sunday Five'), '42501');
select pg_temp.refuse('M3 l''entraîneur ne crée pas de lien', 'Lucien', pg_temp.appel('equipe_lien', 'Sunday Five'), '42501');
select pg_temp.refuse('M3 le capitaine ne change pas l''écusson', 'Ilyes', format('public.equipe_blason(%s, ''{"forme":"ecu"}''::jsonb)', pg_temp.eq('Sunday Five')), '42501');
select pg_temp.refuse('M3 le capitaine ne pose pas de couverture', 'Ilyes', format('public.equipe_couverture(%s, true)', pg_temp.eq('Sunday Five')), '42501');
select pg_temp.vrai('M3 ni ne la note (equipe_couvertures)', pg_temp.lire('Ilyes',
  format('with x as (insert into public.equipe_couvertures (equipe_id, user_id) values (%s, auth.uid()) returning 1) select count(*)::text from x', pg_temp.eq('Sunday Five'))) like 'refus 42501 %');
select pg_temp.vrai('M3 ni ne la dépose (Storage)', pg_temp.lire('Ilyes',
  format('with x as (insert into storage.objects (bucket_id, name, owner) values (''couvertures'', %L, auth.uid()) returning 1) select count(*)::text from x', pg_temp.eq('Sunday Five') || '.jpg')) like 'refus 42501 %');
select pg_temp.refuse('M3 le joueur ne signe pas la charte', 'Badis', pg_temp.appel('equipe_signer_charte', 'Sunday Five'), '42501');
select pg_temp.vrai('M3 le capitaine ne voit pas qui est indisponible', pg_temp.combien('Ilyes', format('select * from public.equipe_indisponibles(%s)', pg_temp.eq('Sunday Five'))) = '0');
select pg_temp.refuse('M3 l''entraîneur verrouillé ne quitte pas (il n''est plus membre pour la base)', 'Lucien', pg_temp.appel('equipe_quitter', 'Sunday Five'), 'P0001');
select pg_temp.vrai('M3 la feuille n''a pas bougé', pg_temp.inscrits(:d1, 'Sunday Five') = 'Badis,Ilyes,Kader,Sami,Théo');

-- ═══ M4 · Aucune lecture de l'entraîneur ═══
select pg_temp.vrai('M4 l''entraîneur ne lit pas sa feuille', pg_temp.combien('Lucien', 'select 1 from public.equipe_feuille_joueurs') = '0');
select pg_temp.vrai('M4 ni la feuille déposée', pg_temp.combien('Lucien', 'select 1 from public.equipe_feuilles') = '0');
select pg_temp.vrai('M4 le capitaine non plus', pg_temp.combien('Ilyes', 'select 1 from public.equipe_feuille_joueurs') = '0');
select pg_temp.vrai('M4 equipe_feuille_lisible lui répond non', pg_temp.lire('Lucien', format('select public.equipe_feuille_lisible(%s, %s)::text', :d1, pg_temp.eq('Sunday Five'))) = 'false');
select pg_temp.vrai('M4 ni les feuilles déposées', pg_temp.combien('Lucien', format('select * from public.equipe_feuilles_deposees(array[%s]::bigint[])', :d1)) = '0');
select pg_temp.vrai('M4 ni sa place', pg_temp.combien('Lucien', 'select 1 from public.equipe_entraineurs') = '0');
select pg_temp.vrai('M4 ni le détail de sa carte', pg_temp.combien('Lucien', 'select * from public.ma_carte_entraineur()') = '0');
select pg_temp.vrai('M4 ni la face des cartes', pg_temp.combien('Badis', 'select joueur, note from public.entraineur_cartes') = '0');
select pg_temp.vrai('M4 ni les normes', pg_temp.combien('Badis', 'select 1 from public.entraineur_normes') = '0');
select pg_temp.vrai('M4 ni le journal de la carte (colonne fermée à tous)', pg_temp.lire('Sami', 'select count(journal)::text from public.entraineur_cartes') like 'refus 42501 %');

-- ═══ M5 · Aucune fonction du serveur ═══
select pg_temp.refuse('M5 poser_cartes_entraineur', 'Lucien', 'public.poser_cartes_entraineur(''[]''::jsonb)', '42501');
select pg_temp.refuse('M5 figer_normes_entraineur', 'Lucien', 'public.figer_normes_entraineur(2, -0.5, 0.01)', '42501');
select pg_temp.refuse('M5 matchs_bola_serveur', 'Lucien', 'public.matchs_bola_serveur()', '42501');
select pg_temp.vrai('M5 equipe_entraineur_fin (déclencheur) n''est pas appelable', pg_temp.lire('Lucien', 'select public.equipe_entraineur_fin()::text') like 'refus %');

-- ═══ M6 · Les lignes effacées : tout revient ═══
delete from public.mot_de_passe_a_changer where user_id in (select pg_temp.uid(n) from unnest(array['Ilyes', 'Théo', 'Lucien', 'Adil', 'Badis']) n);
select pg_temp.vrai('M6 droits de l''entraîneur revenus', pg_temp.droits('Lucien', 'Sunday Five') =
  'annuler=false,couverture=false,defier=true,direction=false,ecusson=false,excuser=false,feuille=true,inviter=true,score=false');
select pg_temp.passe('M6 l''entraîneur redépose la feuille', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Sami', 'Kader', 'Badis']));
select pg_temp.vrai('M6 il la lit', pg_temp.combien('Lucien', format('select 1 from public.equipe_feuille_joueurs where defi_id = %s', :d1)) = '5');
select pg_temp.vrai('M6 il lit sa place', pg_temp.combien('Lucien', 'select 1 from public.equipe_entraineurs') = '1');
select pg_temp.vrai('M6 et sa carte', pg_temp.combien('Lucien', 'select * from public.ma_carte_entraineur()') = '1');
select pg_temp.passe('M6 le capitaine saisit le score', 'Ilyes', format('public.equipe_resultat(%s, 3, 1, ''[]''::jsonb, 5, 5)', :d2));
select pg_temp.passe('M6 Adil signe', 'Adil', pg_temp.appel('equipe_signer', 'Racing Wazemmes'));
select pg_temp.passe('M6 Naim refuse son invitation', 'Naim', pg_temp.appel('equipe_retirer_invitation', 'Sunday Five', 'Naim'));

rollback;
