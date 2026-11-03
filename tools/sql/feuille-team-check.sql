-- Le banc SQL de la feuille d'avant-match de Bola Team (03/11/2026 ; Ilyes,
-- 02/11 : « une équipe = 7 joueurs + 1 entraîneur », la feuille est le geste
-- de l'entraîneur).
--
-- À jouer sur un Postgres 16 local (ou une branche Supabase), JAMAIS sur la
-- base de la ligue : d'abord supabase/schema.sql en entier, deux fois de
-- suite, puis ce fichier (tools/sql/supabase-reduit.sql avant, sur un
-- Postgres nu).
--
--   psql -v ON_ERROR_STOP=1 -f tools/sql/feuille-team-check.sql
--
-- Les données d'entraineur-donnees.sql, dans une transaction annulée à la
-- fin ; Lucien devient l'entraîneur de Sunday Five, qui monte à 7 joueurs.
-- Les matchs sont posés directement, à leur heure (dans 72 h, dans 1 h,
-- passés). Ce qu'on vérifie :
--   F1 l'entraîneur dépose 5, 6, 7 joueurs ; 4, 8, un doublon, un vide, un
--      non-membre, l'entraîneur lui-même, un exclu dont le départ tombe
--      avant le match sont refusés ; un match qui n'est pas programmé ;
--   F2 le capitaine et le vice : refusés avant H-2 quand il y a un
--      entraîneur ; permis sans entraîneur ; permis à H-1 si la feuille
--      n'est pas celle de l'entraîneur, plus après lui ; un joueur sans
--      brassard, jamais ; l'entraîneur exclu, plus rien ;
--   F3 un nouveau dépôt remplace les joueurs et l'auteur ; ceux qui restent
--      gardent leur avertissement ;
--   F4 au coup d'envoi et après, la feuille est fermée ;
--   F5 qui lit : l'équipe avant le coup d'envoi, l'adversaire seulement
--      « déposée » ; toute la ligue ensuite ; jamais un compte en attente ;
--      aucune écriture directe ;
--   F6 la feuille de score : seuls les joueurs de la feuille marquent ; un
--      joueur parti, non plus ; sans feuille, les joueurs de l'équipe ;
--   F7 un joueur sur une seule des deux feuilles ; un défi effacé emporte
--      ses feuilles ;
--   F8 le 5 contre 4 dans la feuille de score : les présents des deux
--      équipes, de 3 à 5 ; l'appel d'avant, par les noms et sans eux, passe
--      (5 et 5) ; deux saisies qui collent, présents compris, valident le
--      match ; des présents qui diffèrent ne le valident pas ; à 3 ou moins,
--      ni score du terrain ni buteurs.

\set ON_ERROR_STOP 1
begin;

-- ═══ Données ═══
\ir entraineur-donnees.sql
\ir equipe-outils.sql

select pg_temp.comme('Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Lucien'));
select pg_temp.comme('Lucien', pg_temp.appel('equipe_signer', 'Sunday Five'));
select pg_temp.comme('Ilyes', pg_temp.appel('equipe_inviter', 'Sunday Five', j)), pg_temp.comme(j, pg_temp.appel('equipe_signer', 'Sunday Five'))
  from unnest(array['Naim', 'Anis']) j;
-- d1 : Sunday Five – Racing dans 72 h.
select pg_temp.match('Sunday Five', 'Racing Wazemmes', 72) as d1 \gset
select pg_temp.vrai('F0 Sunday Five : 7 joueurs et Lucien, entraîneur', public.equipe_effectif(pg_temp.eq('Sunday Five')) = 7
  and (pg_temp.ligne('Sunday Five', 'Lucien')).role = 'entraineur' and (pg_temp.ligne('Sunday Five', 'Lucien')).statut = 'membre');

-- ═══ F1 · L'entraîneur dépose ═══
select pg_temp.passe('F1 cinq joueurs', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader']));
select pg_temp.vrai('F1 la feuille de Lucien, cinq inscrits',
  (select f.deposee_par = pg_temp.uid('Lucien') and f.deposee_le = now() from public.equipe_feuilles f where f.defi_id = :d1 and f.equipe_id = pg_temp.eq('Sunday Five'))
  and pg_temp.inscrits(:d1, 'Sunday Five') = 'Badis,Ilyes,Kader,Sami,Théo');
select pg_temp.passe('F1 six joueurs', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader', 'Naim']));
select pg_temp.passe('F1 sept joueurs', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader', 'Naim', 'Anis']));
select pg_temp.vrai('F1 sept inscrits', pg_temp.inscrits(:d1, 'Sunday Five') = 'Anis,Badis,Ilyes,Kader,Naim,Sami,Théo');
select pg_temp.refuse('F1 quatre, non', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami']), 'P0001', 'De 5 à 7');
select pg_temp.refuse('F1 huit, non', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader', 'Naim', 'Anis', 'Malik']), 'P0001', 'De 5 à 7');
select pg_temp.refuse('F1 un doublon, non', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Sami']), '22023', 'deux fois');
select pg_temp.refuse('F1 une case vide, non', 'Lucien',
  format('public.equipe_feuille(%s, array[%L::uuid, %L::uuid, %L::uuid, %L::uuid, null])', :d1, pg_temp.uid('Ilyes'), pg_temp.uid('Théo'), pg_temp.uid('Badis'), pg_temp.uid('Sami')), '22023');
select pg_temp.refuse('F1 sans joueurs, non', 'Lucien', format('public.equipe_feuille(%s, null)', :d1), '22023');
select pg_temp.refuse('F1 un joueur d''une autre équipe, non', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Yanis']), 'P0001', 'Seuls les joueurs');
select pg_temp.refuse('F1 un compte sans équipe, non', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Malik']), 'P0001', 'Seuls les joueurs');
select pg_temp.refuse('F1 l''entraîneur lui-même, jamais', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Lucien']), 'P0001', 'Seuls les joueurs');
select pg_temp.passe('F1 Kader exclu (départ dans 48 h, avant le match)', 'Ilyes', pg_temp.appel('equipe_exclure', 'Sunday Five', 'Kader'));
select pg_temp.refuse('F1 un exclu qui part avant le coup d''envoi, non', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader']), 'P0001', 'Seuls les joueurs');
select pg_temp.passe('F1 Kader gardé', 'Ilyes', pg_temp.appel('equipe_exclure', 'Sunday Five', 'Kader'));
select pg_temp.passe('F1 Kader revient sur la feuille', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader']));
-- Un défi encore proposé, puis un match annulé : pas de feuille.
insert into public.equipe_defis (de, a, jour, heure, lieu)
values (pg_temp.eq('Racing Wazemmes'), pg_temp.eq('Sunday Five'), pg_temp.jour(96), pg_temp.heure(96), 'Urban Lomme');
select pg_temp.refuse('F1 un défi proposé n''a pas de feuille', 'Lucien', pg_temp.deposer(pg_temp.dernier(), array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader']), 'P0001', 'pas programmé');
update public.equipe_defis set statut = 'annule' where id = pg_temp.dernier();
select pg_temp.refuse('F1 un match annulé non plus', 'Lucien', pg_temp.deposer(pg_temp.dernier(), array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader']), 'P0001', 'pas programmé');

-- ═══ F2 · Le capitaine et le vice ═══
select pg_temp.refuse('F2 avant H-2, le capitaine laisse la feuille à l''entraîneur', 'Ilyes', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Naim']), '42501', 'Réservé à l''entraîneur');
select pg_temp.refuse('F2 le vice aussi', 'Théo', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Naim']), '42501', 'Réservé à l''entraîneur');
select pg_temp.refuse('F2 un joueur sans brassard, jamais', 'Badis', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Naim']), '42501');
select pg_temp.refuse('F2 ni l''adversaire', 'Rayan', pg_temp.deposer(:d1, array['Rayan', 'Wassim', 'Hugo', 'Omar', 'Yanis']), '42501');
select pg_temp.passe('F2 sans entraîneur, le capitaine du Racing dépose', 'Yanis', pg_temp.deposer(:d1, array['Yanis', 'Omar', 'Rayan', 'Wassim', 'Hugo']));
select pg_temp.passe('F2 et son vice redépose', 'Omar', pg_temp.deposer(:d1, array['Yanis', 'Omar', 'Rayan', 'Wassim', 'Hugo']));
select pg_temp.vrai('F2 la feuille du Racing est celle d''Omar',
  (select f.deposee_par = pg_temp.uid('Omar') from public.equipe_feuilles f where f.defi_id = :d1 and f.equipe_id = pg_temp.eq('Racing Wazemmes')));
-- d2 : dans une heure (après H-2), sans feuille.
select pg_temp.match('Sunday Five', 'Racing Wazemmes', 1) as d2 \gset
select pg_temp.passe('F2 à H-1, sans feuille de l''entraîneur, le capitaine dépose', 'Ilyes', pg_temp.deposer(:d2, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Naim']));
select pg_temp.passe('F2 et le vice la refait', 'Théo', pg_temp.deposer(:d2, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Anis']));
select pg_temp.passe('F2 l''entraîneur passe toujours', 'Lucien', pg_temp.deposer(:d2, array['Ilyes', 'Théo', 'Badis', 'Kader', 'Anis']));
select pg_temp.refuse('F2 après lui, le capitaine ne la change plus', 'Ilyes', pg_temp.deposer(:d2, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Naim']), '42501', 'Réservé à l''entraîneur');
select pg_temp.vrai('F2 la feuille de d2 est celle de Lucien',
  (select f.deposee_par = pg_temp.uid('Lucien') from public.equipe_feuilles f where f.defi_id = :d2 and f.equipe_id = pg_temp.eq('Sunday Five'))
  and pg_temp.inscrits(:d2, 'Sunday Five') = 'Anis,Badis,Ilyes,Kader,Théo');
-- L'entraîneur écarté (d1 dans 72 h, d2 dans 1 h : l'exclusion attend ; on la pose à la main) : plus aucun droit.
update public.equipe_membres set depart_le = now() + interval '48 hours' where equipe_id = pg_temp.eq('Sunday Five') and joueur = pg_temp.uid('Lucien');
select pg_temp.refuse('F2 l''entraîneur écarté ne dépose plus', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader']), '42501');
select pg_temp.passe('F2 sans entraîneur en place, le capitaine dépose', 'Ilyes', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader', 'Naim']));
update public.equipe_membres set depart_le = null where equipe_id = pg_temp.eq('Sunday Five') and joueur = pg_temp.uid('Lucien');

-- ═══ F3 · Le dernier dépôt fait foi ═══
update public.equipe_feuille_joueurs set notifie_le = now() - interval '1 hour' where defi_id = :d1 and joueur in (pg_temp.uid('Badis'), pg_temp.uid('Kader'));
select pg_temp.passe('F3 Lucien redépose d1', 'Lucien', pg_temp.deposer(:d1, array['Badis', 'Sami', 'Naim', 'Anis', 'Théo', 'Ilyes']));
select pg_temp.vrai('F3 les joueurs et l''auteur remplacés',
  pg_temp.inscrits(:d1, 'Sunday Five') = 'Anis,Badis,Ilyes,Naim,Sami,Théo'
  and (select f.deposee_par = pg_temp.uid('Lucien') from public.equipe_feuilles f where f.defi_id = :d1 and f.equipe_id = pg_temp.eq('Sunday Five'))
  and (select count(*) from public.equipe_feuilles f where f.defi_id = :d1) = 2);
select pg_temp.vrai('F3 qui reste garde son avertissement, qui entre n''en a pas encore',
  (select notifie_le = now() - interval '1 hour' from public.equipe_feuille_joueurs where defi_id = :d1 and joueur = pg_temp.uid('Badis'))
  and (select notifie_le is null from public.equipe_feuille_joueurs where defi_id = :d1 and joueur = pg_temp.uid('Anis'))
  and not exists (select 1 from public.equipe_feuille_joueurs where defi_id = :d1 and joueur = pg_temp.uid('Kader')));

-- ═══ F4 · Figée au coup d'envoi ═══
-- d3 : coup d'envoi il y a une heure ; d4 : à la minute qui commence.
select pg_temp.match('Sunday Five', 'Racing Wazemmes', -1) as d3 \gset
select pg_temp.match('Racing Wazemmes', 'Sunday Five', 0) as d4 \gset
select pg_temp.refuse('F4 après le coup d''envoi, l''entraîneur ne dépose plus', 'Lucien', pg_temp.deposer(:d3, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader']), 'P0001', 'fermée');
select pg_temp.refuse('F4 ni le capitaine', 'Ilyes', pg_temp.deposer(:d3, array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader']), 'P0001', 'fermée');
select pg_temp.refuse('F4 au coup d''envoi, c''est fermé', 'Yanis', pg_temp.deposer(:d4, array['Yanis', 'Omar', 'Rayan', 'Wassim', 'Hugo']), 'P0001', 'fermée');

-- ═══ F5 · Qui lit ═══
create function pg_temp.lignes(qui text, d bigint, equipe text) returns int language sql volatile as $$
  select pg_temp.lire(qui, format('select count(*) from public.equipe_feuille_joueurs where defi_id = %s and equipe_id = %s', d, pg_temp.eq(equipe)))::int $$;
create function pg_temp.entetes(qui text, d bigint, equipe text) returns int language sql volatile as $$
  select pg_temp.lire(qui, format('select count(*) from public.equipe_feuilles where defi_id = %s and equipe_id = %s', d, pg_temp.eq(equipe)))::int $$;
select pg_temp.vrai('F5 avant le coup d''envoi, l''entraîneur et les joueurs lisent leurs noms',
  pg_temp.lignes('Lucien', :d1, 'Sunday Five') = 6 and pg_temp.lignes('Kader', :d1, 'Sunday Five') = 6 and pg_temp.entetes('Badis', :d1, 'Sunday Five') = 1);
select pg_temp.vrai('F5 l''adversaire ne lit ni les noms ni l''auteur',
  pg_temp.lignes('Yanis', :d1, 'Sunday Five') = 0 and pg_temp.entetes('Yanis', :d1, 'Sunday Five') = 0);
select pg_temp.vrai('F5 il lit la sienne', pg_temp.lignes('Yanis', :d1, 'Racing Wazemmes') = 5);
select pg_temp.vrai('F5 le reste de la ligue non plus', pg_temp.lignes('Malik', :d1, 'Sunday Five') = 0 and pg_temp.lignes('Malik', :d1, 'Racing Wazemmes') = 0);
select pg_temp.vrai('F5 mais l''adversaire sait qu''elle est déposée, et quand',
  pg_temp.lire('Yanis', format('select count(*) from public.equipe_feuilles_deposees(array[%s]::bigint[]) x where x.equipe_id = %s and x.deposee_le = now()', :d1, pg_temp.eq('Sunday Five'))) = '1');
select pg_temp.vrai('F5 « déposée » ne dit pas les noms',
  pg_temp.lire('Yanis', format('select count(*) from public.equipe_feuilles_deposees(array[%s, %s]::bigint[])', :d1, :d2)) = '3');
select pg_temp.vrai('F5 un compte en attente ne lit rien',
  pg_temp.lire('Nolan', format('select count(*) from public.equipe_feuilles_deposees(array[%s]::bigint[])', :d1)) = '0'
  and pg_temp.lignes('Nolan', :d1, 'Sunday Five') = 0);
update public.profiles set is_admin = true where id = pg_temp.uid('Malik');
select pg_temp.vrai('F5 l''admin de la ligue lit', pg_temp.lignes('Malik', :d1, 'Sunday Five') = 6);
update public.profiles set is_admin = false where id = pg_temp.uid('Malik');
-- Après le coup d'envoi (d3, feuilles posées avant qu'il passe) : toute la ligue lit les deux.
insert into public.equipe_feuilles (defi_id, equipe_id, deposee_par, deposee_le)
values (:d3, pg_temp.eq('Sunday Five'), pg_temp.uid('Lucien'), now() - interval '3 hours'),
       (:d3, pg_temp.eq('Racing Wazemmes'), pg_temp.uid('Yanis'), now() - interval '2 hours');
insert into public.equipe_feuille_joueurs (defi_id, equipe_id, joueur)
select :d3, pg_temp.eq('Sunday Five'), pg_temp.uid(j) from unnest(array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader']) j
union all
select :d3, pg_temp.eq('Racing Wazemmes'), pg_temp.uid(j) from unnest(array['Yanis', 'Omar', 'Rayan', 'Wassim']) j;
select pg_temp.vrai('F5 après le coup d''envoi, l''adversaire lit les deux feuilles et leurs auteurs',
  pg_temp.lignes('Yanis', :d3, 'Sunday Five') = 5 and pg_temp.entetes('Yanis', :d3, 'Sunday Five') = 1
  and pg_temp.lire('Yanis', format('select p.name from public.equipe_feuilles f join public.profiles p on p.id = f.deposee_par where f.defi_id = %s and f.equipe_id = %s', :d3, pg_temp.eq('Sunday Five'))) = 'Lucien');
select pg_temp.vrai('F5 et toute la ligue', pg_temp.lignes('Sofiane', :d3, 'Sunday Five') = 5 and pg_temp.lignes('Sofiane', :d3, 'Racing Wazemmes') = 4);
select pg_temp.vrai('F5 un compte en attente, jamais', pg_temp.lignes('Nolan', :d3, 'Sunday Five') = 0);
select pg_temp.vrai('F5 personne n''écrit une feuille à la main',
  pg_temp.lire('Lucien', format('with x as (insert into public.equipe_feuilles (defi_id, equipe_id) values (%s, %s) returning 1) select count(*) from x', :d2, pg_temp.eq('Racing Wazemmes'))) like 'refus 42501%'
  and pg_temp.lire('Lucien', format('with x as (delete from public.equipe_feuille_joueurs where defi_id = %s returning 1) select count(*) from x', :d1)) like 'refus 42501%'
  and pg_temp.lire('Ilyes', format('with x as (update public.equipe_feuilles set deposee_par = null where defi_id = %s returning 1) select count(*) from x', :d1)) like 'refus 42501%');

-- ═══ F6 · La feuille de score : les joueurs de la feuille ═══
create function pg_temp.but(d bigint, qui text) returns jsonb language sql stable as $$
  select jsonb_build_array(jsonb_build_object('joueur', pg_temp.uid(qui), 'buts', 1, 'passes', 0)) $$;
select pg_temp.refuse('F6 un buteur hors de la feuille est refusé', 'Ilyes',
  format('public.equipe_resultat(%s, 2, 1, %L::jsonb)', :d3, pg_temp.but(:d3, 'Anis')), 'P0001', 'Seuls les joueurs de la feuille');
select pg_temp.passe('F6 un buteur de la feuille passe', 'Ilyes', format('public.equipe_resultat(%s, 2, 1, %L::jsonb)', :d3, pg_temp.but(:d3, 'Badis')));
select pg_temp.passe('F6 Sami quitte l''équipe', 'Sami', pg_temp.appel('equipe_quitter', 'Sunday Five'));
select pg_temp.refuse('F6 sur la feuille mais parti : il ne marque plus pour elle', 'Ilyes',
  format('public.equipe_resultat(%s, 2, 1, %L::jsonb)', :d3, pg_temp.but(:d3, 'Sami')), 'P0001', 'Seuls les joueurs de l''équipe');
select pg_temp.vrai('F6 il reste sur la feuille figée', pg_temp.inscrits(:d3, 'Sunday Five') = 'Badis,Ilyes,Kader,Sami,Théo');
delete from public.equipe_feuilles where defi_id = :d3 and equipe_id = pg_temp.eq('Racing Wazemmes');
select pg_temp.passe('F6 sans feuille, un joueur de l''équipe marque', 'Yanis', format('public.equipe_resultat(%s, 1, 2, %L::jsonb)', :d3, pg_temp.but(:d3, 'Hugo')));

-- ═══ F7 · Une seule feuille par joueur ; le défi effacé emporte ses feuilles ═══
-- Kader, comme s'il venait du Racing : une ligne posée à la main sur la feuille du Racing pour d1.
insert into public.equipe_feuille_joueurs (defi_id, equipe_id, joueur) values (:d1, pg_temp.eq('Racing Wazemmes'), pg_temp.uid('Kader'));
select pg_temp.refuse('F7 un joueur déjà sur l''autre feuille est refusé', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Kader', 'Naim']), 'P0001', 'l''autre feuille');
delete from public.equipe_feuille_joueurs where defi_id = :d1 and joueur = pg_temp.uid('Kader');
select pg_temp.passe('F7 sans lui ailleurs, il y va', 'Lucien', pg_temp.deposer(:d1, array['Ilyes', 'Théo', 'Badis', 'Kader', 'Naim']));
delete from public.equipe_defis where id = :d2;
select pg_temp.vrai('F7 le défi effacé emporte ses feuilles',
  not exists (select 1 from public.equipe_feuilles where defi_id = :d2) and not exists (select 1 from public.equipe_feuille_joueurs where defi_id = :d2));

-- ═══ F8 · Le 5 contre 4 dans la feuille de score ═══
-- d5, d6, d7 : trois matchs joués il y a deux heures, sans feuille d'avant-match.
select pg_temp.match('Sunday Five', 'Racing Wazemmes', -2) as d5 \gset
select pg_temp.match('Racing Wazemmes', 'Sunday Five', -2) as d6 \gset
select pg_temp.match('Sunday Five', 'Racing Wazemmes', -3) as d7 \gset
create function pg_temp.score(d bigint, pour int, contre int, presents int, adverses int, lignes jsonb default '[]') returns text language sql stable as $$
  select format('public.equipe_resultat(%s, %s, %s, %L::jsonb, %s, %s)', d, pour, contre, lignes, presents, adverses) $$;
create function pg_temp.saisie(d bigint, equipe text) returns public.equipe_resultats language sql volatile as $$
  select r.* from public.equipe_resultats r where r.defi_id = d and r.equipe_id = pg_temp.eq(equipe) $$;
select pg_temp.refuse('F8 des présents à 2, non', 'Ilyes', pg_temp.score(:d5, 2, 1, 2, 5), '22023', 'Présents');
select pg_temp.refuse('F8 à 6, non', 'Ilyes', pg_temp.score(:d5, 2, 1, 5, 6), '22023', 'Présents');
select pg_temp.refuse('F8 sans valeur, non', 'Ilyes', format('public.equipe_resultat(%s, 2, 1, %L::jsonb, null, 5)', :d5, '[]'), '22023', 'Présents');
select pg_temp.passe('F8 l''appel d''avant, par les noms et sans les présents', 'Ilyes',
  format('public.equipe_resultat(d => %s, pour => 1, contre => 0, lignes => %L::jsonb)', :d5, '[]'));
select pg_temp.vrai('F8 il vaut 5 et 5', (pg_temp.saisie(:d5, 'Sunday Five')).presents = 5 and (pg_temp.saisie(:d5, 'Sunday Five')).presents_adverses = 5);
select pg_temp.passe('F8 Sunday Five : 2 – 1, le Racing à 4', 'Ilyes', pg_temp.score(:d6, 2, 1, 5, 4));
select pg_temp.vrai('F8 les présents sont gardés', (pg_temp.saisie(:d6, 'Sunday Five')).presents = 5 and (pg_temp.saisie(:d6, 'Sunday Five')).presents_adverses = 4);
select pg_temp.passe('F8 le Racing dit 1 – 2 mais tout le monde à 5', 'Yanis', pg_temp.score(:d6, 1, 2, 5, 5));
select pg_temp.passe('F8 des présents qui diffèrent : la feuille reste ouverte, Yanis corrige', 'Yanis', pg_temp.score(:d6, 1, 2, 4, 5));
select pg_temp.refuse('F8 le score et les présents collent : le match est validé', 'Ilyes', pg_temp.score(:d6, 2, 1, 5, 4), 'P0001', 'validé');
select pg_temp.refuse('F8 et le Racing non plus ne la change plus', 'Omar', pg_temp.score(:d6, 1, 2, 4, 5), 'P0001', 'validé');
select pg_temp.passe('F8 à 3 ou moins : le forfait de Sunday Five', 'Ilyes', pg_temp.score(:d7, 3, 1, 3, 5, pg_temp.but(:d7, 'Badis')));
select pg_temp.vrai('F8 ni score du terrain ni buteurs',
  (pg_temp.saisie(:d7, 'Sunday Five')).pour = 0 and (pg_temp.saisie(:d7, 'Sunday Five')).contre = 0
  and (pg_temp.saisie(:d7, 'Sunday Five')).presents = 3
  and not exists (select 1 from public.equipe_resultat_joueurs j where j.defi_id = :d7));
select pg_temp.passe('F8 le Racing confirme le forfait', 'Yanis', pg_temp.score(:d7, 0, 0, 5, 3));
select pg_temp.refuse('F8 le forfait est validé', 'Ilyes', pg_temp.score(:d7, 0, 0, 3, 5), 'P0001', 'validé');
select pg_temp.refuse('F8 l''entraîneur ne déclare jamais les présents', 'Lucien', pg_temp.score(:d5, 1, 0, 5, 4), '42501');

select 'feuille-team-check : tout est ok' as fin;
rollback;
