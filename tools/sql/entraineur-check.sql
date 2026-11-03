-- Le banc SQL de la place d'entraîneur de Bola Team (03/11/2026 ; Ilyes,
-- 02/11 : « une équipe = 7 joueurs + 1 entraîneur »).
--
-- À jouer sur un Postgres 16 local (ou une branche Supabase), JAMAIS sur la
-- base de la ligue : d'abord supabase/schema.sql en entier, deux fois de
-- suite (la migration est idempotente), puis ce fichier. Sur un Postgres nu,
-- tools/sql/supabase-reduit.sql pose avant le strict nécessaire de Supabase
-- (rôles, auth, storage, publication temps réel).
--
--   psql -v ON_ERROR_STOP=1 -f tools/sql/entraineur-check.sql
--
-- Les données (entraineur-donnees.sql : trois équipes, vingt-six comptes de
-- test) sont posées dans une transaction annulée à la fin : rien ne reste.
-- Chaque ligne de résultat commence par son numéro d'essai et finit par ok ;
-- le fichier s'arrête au premier ÉCHEC, qui dit le refus reçu. Un geste et
-- ce qu'on en vérifie sont deux ordres : une lecture faite dans l'ordre du
-- geste ne verrait pas encore son effet. Ce qu'on vérifie :
--   E1  le capitaine seul nomme l'entraîneur, une invitation à la fois ;
--   E2  son invitation ne prend pas l'une des six ;
--   E3  il signe la version 3, sa place commence (equipe_entraineurs) ;
--   E4  ses droits, geste par geste : il recrute, défie, répond ; jamais le
--       score, l'excuse d'un absent, l'annulation d'un match, l'écusson, la
--       couverture, la direction ;
--   E5  il ne compte nulle part (5 pour défier, le ménage, le lien) ;
--   E6  une équipe à 7 joueurs l'invite, il signe, sa place ne tombe pas à 7 ;
--   E7  les refus : joueur ou invité de l'équipe, joueur ou entraîneur d'une
--       autre, compte en attente, ancien joueur, carence, sans Bola Team,
--       second entraîneur ; qui retire son invitation ;
--   E8  le brassard ne lui va jamais ;
--   E9  exclu, il garde sa place 48 h sans aucun droit ; puis il part
--       (equipe_departs, equipe_entraineurs) et ne revient pas ;
--   E10 son départ laisse la couverture ;
--   E11 la dissolution : l'entraîneur seul ne garde pas l'équipe ;
--   E12 une invitation tombée après 72 h ; une seule place, même à la main.

\set ON_ERROR_STOP 1
begin;

-- ═══ Données ═══
\ir entraineur-donnees.sql

\ir equipe-outils.sql

-- ═══ E1 · Le capitaine seul nomme l'entraîneur ═══
select pg_temp.refuse('E1 le vice ne nomme pas l''entraîneur', 'Théo', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Lucien'), '42501');
select pg_temp.refuse('E1 un joueur non plus', 'Badis', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Lucien'), '42501');
select pg_temp.passe('E1 le capitaine invite Lucien', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Lucien'));
select pg_temp.vrai('E1 Lucien est invité comme entraîneur, par Ilyes',
  (pg_temp.ligne('Sunday Five', 'Lucien')).statut = 'invite' and (pg_temp.ligne('Sunday Five', 'Lucien')).role = 'entraineur'
  and (pg_temp.ligne('Sunday Five', 'Lucien')).invite_par = pg_temp.uid('Ilyes'));
select pg_temp.refuse('E1 une invitation d''entraîneur à la fois', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Adil'), 'P0001', 'déjà un entraîneur');
select pg_temp.passe('E1 l''inviter comme joueur ne fait rien', 'Ilyes', pg_temp.appel('equipe_inviter', 'Sunday Five', 'Lucien'));
select pg_temp.vrai('E1 il reste invité comme entraîneur', (pg_temp.ligne('Sunday Five', 'Lucien')).role = 'entraineur');

-- ═══ E2 · Son invitation ne prend pas l'une des six ═══
select pg_temp.passe('E2 Ilyes invite ' || j, 'Ilyes', pg_temp.appel('equipe_inviter', 'Sunday Five', j))
  from unnest(array['Naim', 'Anis', 'Malik', 'Ryad', 'Bilal', 'Karim']) j;
select pg_temp.refuse('E2 la septième invitation de joueur est refusée', 'Ilyes', pg_temp.appel('equipe_inviter', 'Sunday Five', 'Mehdi'), 'P0001', '6 invitations');
select pg_temp.vrai('E2 sept invitations en attente, dont celle de l''entraîneur',
  (select count(*) from public.equipe_membres m where m.equipe_id = pg_temp.eq('Sunday Five') and m.statut = 'invite') = 7);

-- ═══ E3 · Il signe ═══
select pg_temp.passe('E3 Lucien signe', 'Lucien', pg_temp.appel('equipe_signer', 'Sunday Five'));
select pg_temp.vrai('E3 membre, toujours entraîneur, version 3',
  (pg_temp.ligne('Sunday Five', 'Lucien')).statut = 'membre' and (pg_temp.ligne('Sunday Five', 'Lucien')).role = 'entraineur'
  and (pg_temp.ligne('Sunday Five', 'Lucien')).reglement_version = 'v3');
select pg_temp.vrai('E3 la signature v3 est gardée',
  exists (select 1 from public.equipe_signatures s where s.equipe_id = pg_temp.eq('Sunday Five') and s.joueur = pg_temp.uid('Lucien') and s.version = 'v3'));
select pg_temp.vrai('E3 sa place commence à sa signature',
  (select t.debut = now() and t.fin is null and t.motif is null from public.equipe_entraineurs t
    where t.equipe_id = pg_temp.eq('Sunday Five') and t.joueur = pg_temp.uid('Lucien')));
select pg_temp.vrai('E3 l''effectif reste à 5 joueurs', public.equipe_effectif(pg_temp.eq('Sunday Five')) = 5);
select pg_temp.vrai('E3 la ligue lit sa place',
  pg_temp.lire('Yanis', format('select count(*) from public.equipe_entraineurs where equipe_id = %s', pg_temp.eq('Sunday Five'))) = '1');
select pg_temp.vrai('E3 personne n''écrit sa place à la main',
  pg_temp.lire('Lucien', format('with x as (update public.equipe_entraineurs set fin = now() where equipe_id = %s returning 1) select count(*) from x', pg_temp.eq('Sunday Five'))) like 'refus 42501%');
select pg_temp.vrai('E3 role_equipe dit sa place', pg_temp.lire('Lucien', format('select public.role_equipe(%s)', pg_temp.eq('Sunday Five'))) = 'entraineur');

-- ═══ E4 · Ses droits, geste par geste ═══
-- Ce qu'il fait : recruter (inviter, retirer l'invitation d'un joueur, le lien, qui ne peut pas venir), défier, répondre, retirer son défi.
select pg_temp.passe('E4 il retire l''invitation d''un joueur', 'Lucien', pg_temp.appel('equipe_retirer_invitation', 'Sunday Five', 'Karim'));
select pg_temp.vrai('E4 Karim n''est plus invité', pg_temp.ligne('Sunday Five', 'Karim') is null);
select pg_temp.passe('E4 il invite un joueur', 'Lucien', pg_temp.appel('equipe_inviter', 'Sunday Five', 'Mehdi'));
select pg_temp.vrai('E4 Mehdi, invité par Lucien', (pg_temp.ligne('Sunday Five', 'Mehdi')).invite_par = pg_temp.uid('Lucien'));
select pg_temp.vrai('E4 il partage le lien', length(pg_temp.lire('Lucien', format('select public.equipe_lien(%s)', pg_temp.eq('Sunday Five'))) ) = 16);
select pg_temp.vrai('E4 il voit qui ne peut pas venir',
  pg_temp.lire('Lucien', format('select count(*) from public.equipe_indisponibles(%s) where raison in (''equipe'', ''attente'', ''carence'')', pg_temp.eq('Sunday Five')))::int >= 3);
select pg_temp.passe('E4 il lance un défi', 'Lucien', pg_temp.defier('Sunday Five', 'Racing Wazemmes', 72));
select pg_temp.passe('E4 il retire son défi', 'Lucien', format('public.equipe_defi_statut(%s, %L)', pg_temp.dernier(), 'annule'));
select pg_temp.vrai('E4 le défi est retiré', (select statut from public.equipe_defis where id = pg_temp.dernier()) = 'annule');
select pg_temp.passe('E4 le Racing défie Sunday Five', 'Yanis', pg_temp.defier('Racing Wazemmes', 'Sunday Five', 96));
select pg_temp.passe('E4 il accepte un défi reçu', 'Lucien', format('public.equipe_defi_statut(%s, %L)', pg_temp.dernier(), 'accepte'));
-- Ce qu'il ne fait jamais : annuler un match programmé, la feuille de score, l'écusson, la couverture, la direction.
select pg_temp.refuse('E4 il n''annule pas un match programmé', 'Lucien', format('public.equipe_defi_statut(%s, %L)', pg_temp.dernier(), 'annule'), '42501');
select pg_temp.passe('E4 le vice, lui, l''annule (plus de 48 h avant)', 'Théo', format('public.equipe_defi_statut(%s, %L)', pg_temp.dernier(), 'annule'));
select pg_temp.vrai('E4 le match est annulé', (select statut from public.equipe_defis where id = pg_temp.dernier()) = 'annule');
select pg_temp.match('Sunday Five', 'Racing Wazemmes', -2);
select pg_temp.refuse('E4 il ne remplit jamais la feuille de score', 'Lucien', format('public.equipe_resultat(%s, 2, 1, %L::jsonb)', pg_temp.dernier(), '[]'), '42501');
select pg_temp.refuse('E4 personne ne marque à son nom', 'Ilyes',
  format('public.equipe_resultat(%s, 1, 0, %L::jsonb)', pg_temp.dernier(), jsonb_build_array(jsonb_build_object('joueur', pg_temp.uid('Lucien'), 'buts', 1, 'passes', 0))),
  'P0001', 'Seuls les joueurs');
select pg_temp.passe('E4 le capitaine, lui, la remplit', 'Ilyes',
  format('public.equipe_resultat(%s, 1, 0, %L::jsonb)', pg_temp.dernier(), jsonb_build_array(jsonb_build_object('joueur', pg_temp.uid('Badis'), 'buts', 1, 'passes', 0))));
select pg_temp.refuse('E4 il ne dessine pas l''écusson', 'Lucien',
  format('public.equipe_blason(%s, %L::jsonb)', pg_temp.eq('Sunday Five'), '{"forme":"ecu","motif":"uni","embleme":"etoile","couleurs":["#000000","#FFFFFF","#FF0000"]}'), '42501');
select pg_temp.refuse('E4 il ne pose pas la couverture', 'Lucien', format('public.equipe_couverture(%s, true)', pg_temp.eq('Sunday Five')), '42501');
select pg_temp.vrai('E4 il ne note pas de couverture (crédit de l''IA)',
  pg_temp.lire('Lucien', format('with x as (insert into public.equipe_couvertures (equipe_id) values (%s) returning 1) select count(*) from x', pg_temp.eq('Sunday Five'))) like 'refus 42501%');
-- Le Supabase réduit ne donne pas la table du stockage : on la donne, pour que seules ses règles décident.
grant select, insert, update on storage.objects to authenticated;
select pg_temp.vrai('E4 il ne dépose pas l''image de couverture',
  pg_temp.lire('Lucien', format($q$with x as (insert into storage.objects (bucket_id, name) values ('couvertures', '%s.jpg') returning 1) select count(*) from x$q$, pg_temp.eq('Sunday Five'))) like 'refus 42501%');
select pg_temp.vrai('E4 le capitaine, lui, la dépose',
  pg_temp.lire('Ilyes', format($q$with x as (insert into storage.objects (bucket_id, name) values ('couvertures', '%s.jpg') returning 1) select count(*) from x$q$, pg_temp.eq('Sunday Five'))) = '1');
select pg_temp.refuse('E4 il ne nomme pas le vice', 'Lucien', pg_temp.appel('equipe_vice', 'Sunday Five', 'Badis'), '42501');
select pg_temp.refuse('E4 il n''exclut personne', 'Lucien', pg_temp.appel('equipe_exclure', 'Sunday Five', 'Badis'), '42501');
select pg_temp.refuse('E4 il ne dissout pas l''équipe', 'Lucien', pg_temp.appel('equipe_dissoudre', 'Sunday Five'), '42501');
select pg_temp.refuse('E4 il ne nomme pas d''entraîneur', 'Lucien', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Adil'), '42501');
select pg_temp.passe('E4 le capitaine le nomme vice…', 'Ilyes', pg_temp.appel('equipe_vice', 'Sunday Five', 'Lucien'));
select pg_temp.vrai('E4 … mais il n''est jamais vice',
  (pg_temp.ligne('Sunday Five', 'Lucien')).role = 'entraineur'
  and not exists (select 1 from public.equipe_membres m where m.equipe_id = pg_temp.eq('Sunday Five') and m.role = 'vice'));
select pg_temp.passe('E4 Théo redevient vice', 'Ilyes', pg_temp.appel('equipe_vice', 'Sunday Five', 'Théo'));
select pg_temp.vrai('E4 equipe_droit : la table de l''entraîneur', pg_temp.droits('Lucien', 'Sunday Five')
  = 'annuler=false,couverture=false,defier=true,direction=false,ecusson=false,excuser=false,feuille=true,inviter=true,score=false');
select pg_temp.vrai('E4 celle du capitaine', pg_temp.droits('Ilyes', 'Sunday Five')
  = 'annuler=true,couverture=true,defier=true,direction=true,ecusson=true,excuser=true,feuille=true,inviter=true,score=true');
select pg_temp.vrai('E4 celle du vice', pg_temp.droits('Théo', 'Sunday Five')
  = 'annuler=true,couverture=true,defier=true,direction=false,ecusson=true,excuser=true,feuille=true,inviter=true,score=true');
select pg_temp.vrai('E4 celle d''un joueur sans brassard', pg_temp.droits('Badis', 'Sunday Five')
  = 'annuler=false,couverture=false,defier=false,direction=false,ecusson=false,excuser=false,feuille=false,inviter=false,score=false');
select pg_temp.vrai('E4 hors de l''équipe, aucun droit', pg_temp.droits('Yanis', 'Sunday Five')
  = 'annuler=false,couverture=false,defier=false,direction=false,ecusson=false,excuser=false,feuille=false,inviter=false,score=false');
select pg_temp.vrai('E4 il n''excuse jamais un absent (art. 7.6), le capitaine et le vice oui',
  pg_temp.lire('Lucien', format('select public.equipe_droit(%s, ''excuser'')', pg_temp.eq('Sunday Five'))) = 'false'
  and pg_temp.lire('Ilyes', format('select public.equipe_droit(%s, ''excuser'')', pg_temp.eq('Sunday Five'))) = 'true'
  and pg_temp.lire('Théo', format('select public.equipe_droit(%s, ''excuser'')', pg_temp.eq('Sunday Five'))) = 'true');
select pg_temp.vrai('E4 un geste inconnu, aucun droit', pg_temp.lire('Ilyes', format('select public.equipe_droit(%s, ''adjoint'')', pg_temp.eq('Sunday Five'))) = 'false');

-- ═══ E5 · Il ne compte nulle part ═══
create function pg_temp.lien() returns text language sql volatile as $$
  select jeton from public.equipe_liens where equipe_id = pg_temp.eq('Sunday Five') order by expire_le desc limit 1 $$;
select pg_temp.vrai('E5 le lien compte 5 joueurs', (public.equipe_lien_info(pg_temp.lien()) ->> 'membres')::int = 5);
select pg_temp.passe('E5 Yacine ouvre le lien', 'Yacine', format('public.equipe_par_lien(%L)', pg_temp.lien()));
select pg_temp.vrai('E5 le lien fait entrer un joueur, jamais un entraîneur',
  (pg_temp.ligne('Sunday Five', 'Yacine')).role = 'membre' and (pg_temp.ligne('Sunday Five', 'Yacine')).statut = 'invite');
select pg_temp.passe('E5 Yacine se retire', 'Yacine', pg_temp.appel('equipe_retirer_invitation', 'Sunday Five', 'Yacine'));
select pg_temp.passe('E5 un défi en attente, avant le départ de Kader', 'Lucien', pg_temp.defier('Sunday Five', 'Racing Wazemmes', 120));
select pg_temp.passe('E5 Kader part', 'Kader', pg_temp.appel('equipe_quitter', 'Sunday Five'));
select pg_temp.vrai('E5 4 joueurs et un entraîneur : 4', public.equipe_effectif(pg_temp.eq('Sunday Five')) = 4);
select pg_temp.vrai('E5 sous 5 joueurs, le défi en attente tombe', (select statut from public.equipe_defis where id = pg_temp.dernier()) = 'annule');
select pg_temp.refuse('E5 quatre joueurs et un entraîneur ne défient pas', 'Lucien', pg_temp.defier('Sunday Five', 'Racing Wazemmes', 120), 'P0001', 'Il faut 5 joueurs');
select pg_temp.refuse('E5 et ne se font pas défier', 'Yanis', pg_temp.defier('Racing Wazemmes', 'Sunday Five', 120), 'P0001', 'Il faut 5 joueurs');
select pg_temp.vrai('E5 le lien compte 4 joueurs', (public.equipe_lien_info(pg_temp.lien()) ->> 'membres')::int = 4);
select pg_temp.passe('E5 ' || j || ' signe', j, pg_temp.appel('equipe_signer', 'Sunday Five')) from unnest(array['Naim', 'Anis', 'Malik']) j;
select pg_temp.vrai('E5 7 joueurs, et l''entraîneur à part',
  public.equipe_effectif(pg_temp.eq('Sunday Five')) = 7 and (pg_temp.ligne('Sunday Five', 'Lucien')).role = 'entraineur');
select pg_temp.vrai('E5 à 7, les invitations de joueurs tombent',
  not exists (select 1 from public.equipe_membres m where m.equipe_id = pg_temp.eq('Sunday Five') and m.statut = 'invite'));

-- ═══ E6 · À 7 joueurs : une place d'entraîneur à part ═══
select pg_temp.passe('E6 le Racing invite Ryad', 'Yanis', pg_temp.appel('equipe_inviter', 'Racing Wazemmes', 'Ryad'));
select pg_temp.passe('E6 Ryad signe (6 joueurs)', 'Ryad', pg_temp.appel('equipe_signer', 'Racing Wazemmes'));
select pg_temp.passe('E6 Adil invité comme entraîneur', 'Yanis', pg_temp.appel('equipe_entraineur_inviter', 'Racing Wazemmes', 'Adil'));
select pg_temp.refuse('E6 le vice ne retire pas l''invitation de l''entraîneur', 'Omar', pg_temp.appel('equipe_retirer_invitation', 'Racing Wazemmes', 'Adil'), '42501');
select pg_temp.passe('E6 le Racing invite ' || j, 'Yanis', pg_temp.appel('equipe_inviter', 'Racing Wazemmes', j)) from unnest(array['Bilal', 'Farid']) j;
select pg_temp.passe('E6 Bilal signe', 'Bilal', pg_temp.appel('equipe_signer', 'Racing Wazemmes'));
select pg_temp.vrai('E6 7 joueurs', public.equipe_effectif(pg_temp.eq('Racing Wazemmes')) = 7);
select pg_temp.vrai('E6 à 7, l''invitation de Farid tombe, pas celle de l''entraîneur',
  pg_temp.ligne('Racing Wazemmes', 'Farid') is null and (pg_temp.ligne('Racing Wazemmes', 'Adil')).statut = 'invite');
select pg_temp.refuse('E6 au complet, un joueur de plus est refusé', 'Yanis', pg_temp.appel('equipe_inviter', 'Racing Wazemmes', 'Farid'), 'P0001', 'au complet');
select pg_temp.passe('E6 Adil signe à 7 / 7', 'Adil', pg_temp.appel('equipe_signer', 'Racing Wazemmes'));
select pg_temp.vrai('E6 Adil en place, l''effectif à 7',
  (pg_temp.ligne('Racing Wazemmes', 'Adil')).statut = 'membre' and public.equipe_effectif(pg_temp.eq('Racing Wazemmes')) = 7
  and exists (select 1 from public.equipe_entraineurs t where t.equipe_id = pg_temp.eq('Racing Wazemmes') and t.joueur = pg_temp.uid('Adil')));

-- ═══ E7 · Les refus (AS Fives : Sofiane, seul) ═══
select pg_temp.refuse('E7 pas un joueur de l''équipe (pas dans cette version)', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Sofiane'), 'P0001', 'Déjà dans l''équipe');
select pg_temp.passe('E7 Sofiane invite Karim comme joueur', 'Sofiane', pg_temp.appel('equipe_inviter', 'AS Fives', 'Karim'));
select pg_temp.refuse('E7 ni un invité de l''équipe', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Karim'), 'P0001', 'Déjà dans l''équipe');
select pg_temp.refuse('E7 pas un joueur d''une autre équipe', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Ilyes'), 'P0001', 'déjà une équipe');
select pg_temp.refuse('E7 pas l''entraîneur d''une autre équipe', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Lucien'), 'P0001', 'déjà une équipe');
select pg_temp.refuse('E7 pas un compte en attente', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Nolan'), 'P0001', 'pas encore validé');
select pg_temp.refuse('E7 pas un ancien joueur de l''équipe', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Zak'), 'P0001', 'quitté l''équipe');
select pg_temp.refuse('E7 pas un compte en carence (Kader vient de partir)', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Kader'), 'P0001', '14 jours');
delete from public.team_offerts where joueur = pg_temp.uid('Mehdi');
select pg_temp.refuse('E7 sans Bola Team, il faut l''invitation d''un joueur SFL', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Mehdi'), 'P0001', 'Bola Team');
select pg_temp.passe('E7 Sofiane invite Yacine', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Yacine'));
select pg_temp.refuse('E7 le second est refusé', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Farid'), 'P0001', 'déjà un entraîneur');
select pg_temp.passe('E7 Yacine refuse lui-même', 'Yacine', pg_temp.appel('equipe_retirer_invitation', 'AS Fives', 'Yacine'));
select pg_temp.vrai('E7 son invitation n''est plus', pg_temp.ligne('AS Fives', 'Yacine') is null);
select pg_temp.passe('E7 Sofiane le réinvite', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Yacine'));
select pg_temp.passe('E7 Sofiane invite Farid', 'Sofiane', pg_temp.appel('equipe_inviter', 'AS Fives', 'Farid'));
select pg_temp.passe('E7 Farid signe', 'Farid', pg_temp.appel('equipe_signer', 'AS Fives'));
select pg_temp.refuse('E7 un joueur sans brassard ne retire pas l''invitation de l''entraîneur', 'Farid', pg_temp.appel('equipe_retirer_invitation', 'AS Fives', 'Yacine'), '42501');
select pg_temp.passe('E7 Farid nommé vice', 'Sofiane', pg_temp.appel('equipe_vice', 'AS Fives', 'Farid'));
select pg_temp.refuse('E7 le vice non plus', 'Farid', pg_temp.appel('equipe_retirer_invitation', 'AS Fives', 'Yacine'), '42501');
select pg_temp.passe('E7 le capitaine, si', 'Sofiane', pg_temp.appel('equipe_retirer_invitation', 'AS Fives', 'Yacine'));
select pg_temp.vrai('E7 l''invitation est retirée', pg_temp.ligne('AS Fives', 'Yacine') is null);

-- ═══ E8 · Le brassard ne va jamais à l'entraîneur ═══
-- Racing : plus de vice ; Adil, l'entraîneur, a signé le premier ; Rayan est le plus ancien des joueurs.
select pg_temp.passe('E8 le Racing n''a plus de vice', 'Yanis', format('public.equipe_vice(%s, null)', pg_temp.eq('Racing Wazemmes')));
update public.equipe_membres m set signe_le = now() - case when m.joueur = pg_temp.uid('Adil') then interval '30 days'
                                                        when m.joueur = pg_temp.uid('Rayan') then interval '20 days'
                                                        else interval '10 days' end
 where m.equipe_id = pg_temp.eq('Racing Wazemmes') and m.joueur <> pg_temp.uid('Yanis');
select pg_temp.passe('E8 le capitaine part sans vice', 'Yanis', pg_temp.appel('equipe_quitter', 'Racing Wazemmes'));
select pg_temp.vrai('E8 le brassard va au plus ancien joueur, pas à l''entraîneur',
  (pg_temp.ligne('Racing Wazemmes', 'Rayan')).role = 'capitaine' and (pg_temp.ligne('Racing Wazemmes', 'Adil')).role = 'entraineur'
  and (select capitaine from public.equipes where id = pg_temp.eq('Racing Wazemmes')) = pg_temp.uid('Rayan'));
select pg_temp.vrai('E8 le départ du capitaine est noté avec sa place',
  (select d.motif = 'depart' and d.role = 'capitaine' from public.equipe_departs d where d.equipe_id = pg_temp.eq('Racing Wazemmes') and d.joueur = pg_temp.uid('Yanis')));

-- ═══ E9 · Exclu : 48 h sans aucun droit, puis le départ ═══
select pg_temp.match('Sunday Five', 'Racing Wazemmes', 30);
select pg_temp.refuse('E9 jamais à moins de 48 h d''un match', 'Ilyes', pg_temp.appel('equipe_exclure', 'Sunday Five', 'Lucien'), 'P0001', '48 h');
delete from public.equipe_defis where id = pg_temp.dernier();
select pg_temp.passe('E9 le capitaine l''écarte', 'Ilyes', pg_temp.appel('equipe_exclure', 'Sunday Five', 'Lucien'));
select pg_temp.vrai('E9 48 h de préavis, sa place gardée',
  (pg_temp.ligne('Sunday Five', 'Lucien')).depart_le = now() + interval '48 hours' and (pg_temp.ligne('Sunday Five', 'Lucien')).role = 'entraineur');
select pg_temp.vrai('E9 pendant le préavis, aucun droit', pg_temp.droits('Lucien', 'Sunday Five')
  = 'annuler=false,couverture=false,defier=false,direction=false,ecusson=false,excuser=false,feuille=false,inviter=false,score=false');
select pg_temp.refuse('E9 il n''invite plus', 'Lucien', pg_temp.appel('equipe_inviter', 'Sunday Five', 'Ilan'), '42501');
select pg_temp.refuse('E9 ni ne partage le lien', 'Lucien', pg_temp.appel('equipe_lien', 'Sunday Five'), '42501');
select pg_temp.vrai('E9 il ne compte toujours pas', public.equipe_effectif(pg_temp.eq('Sunday Five')) = 7);
select pg_temp.passe('E9 annuler le retrait', 'Ilyes', pg_temp.appel('equipe_exclure', 'Sunday Five', 'Lucien'));
select pg_temp.vrai('E9 lui rend tout', (pg_temp.ligne('Sunday Five', 'Lucien')).depart_le is null
  and pg_temp.droits('Lucien', 'Sunday Five') = 'annuler=false,couverture=false,defier=true,direction=false,ecusson=false,excuser=false,feuille=true,inviter=true,score=false');
select pg_temp.passe('E9 écarté de nouveau', 'Ilyes', pg_temp.appel('equipe_exclure', 'Sunday Five', 'Lucien'));
-- Les 48 h passent (son départ, une heure plus tôt) ; le ménage, au premier geste de l'équipe.
update public.equipe_membres set depart_le = now() - interval '1 hour' where equipe_id = pg_temp.eq('Sunday Five') and joueur = pg_temp.uid('Lucien');
select public.equipe_menage(pg_temp.eq('Sunday Five'));
select pg_temp.vrai('E9 le ménage le fait partir', pg_temp.ligne('Sunday Five', 'Lucien') is null);
select pg_temp.vrai('E9 son départ : à son heure, exclusion, entraîneur',
  (select d.parti_le = now() - interval '1 hour' and d.motif = 'exclusion' and d.role = 'entraineur'
     from public.equipe_departs d where d.equipe_id = pg_temp.eq('Sunday Five') and d.joueur = pg_temp.uid('Lucien')));
select pg_temp.vrai('E9 la fin de sa place, et pourquoi',
  (select t.fin = now() - interval '1 hour' and t.motif = 'exclusion' from public.equipe_entraineurs t
    where t.equipe_id = pg_temp.eq('Sunday Five') and t.joueur = pg_temp.uid('Lucien')));
select pg_temp.refuse('E9 il ne revient pas comme entraîneur', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Lucien'), 'P0001', 'quitté l''équipe');
select pg_temp.refuse('E9 ni comme joueur, même par le lien', 'Lucien', format('public.equipe_par_lien(%L)', pg_temp.lien()), 'P0001', 'quitté cette équipe');
select pg_temp.refuse('E9 un ancien joueur ne devient pas l''entraîneur', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Kader'), 'P0001', 'quitté l''équipe');
select pg_temp.refuse('E9 14 jours de carence avant une autre équipe', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Lucien'), 'P0001', '14 jours');
select pg_temp.passe('E9 un joueur exclu…', 'Ilyes', pg_temp.appel('equipe_exclure', 'Sunday Five', 'Théo'));
select pg_temp.vrai('E9 … perd son brassard (comme avant)', (pg_temp.ligne('Sunday Five', 'Théo')).role = 'membre');
select pg_temp.passe('E9 Théo gardé', 'Ilyes', pg_temp.appel('equipe_exclure', 'Sunday Five', 'Théo'));

-- ═══ E10 · Son départ laisse la couverture ═══
update public.equipes set couverture_le = now() where id = pg_temp.eq('Racing Wazemmes');
select pg_temp.passe('E10 Adil part de lui-même', 'Adil', pg_temp.appel('equipe_quitter', 'Racing Wazemmes'));
select pg_temp.vrai('E10 la couverture reste', (select couverture_le from public.equipes where id = pg_temp.eq('Racing Wazemmes')) = now());
select pg_temp.vrai('E10 l''équipe reste active à 6 joueurs', public.equipe_effectif(pg_temp.eq('Racing Wazemmes')) = 6
  and (select dissoute_le is null from public.equipes where id = pg_temp.eq('Racing Wazemmes')));
select pg_temp.vrai('E10 son départ et la fin de sa place',
  (select d.motif = 'depart' and d.role = 'entraineur' from public.equipe_departs d where d.equipe_id = pg_temp.eq('Racing Wazemmes') and d.joueur = pg_temp.uid('Adil'))
  and (select t.fin = now() and t.motif = 'depart' from public.equipe_entraineurs t where t.equipe_id = pg_temp.eq('Racing Wazemmes') and t.joueur = pg_temp.uid('Adil')));
select pg_temp.passe('E10 un joueur part', 'Hugo', pg_temp.appel('equipe_quitter', 'Racing Wazemmes'));
select pg_temp.vrai('E10 lui emporte la couverture', (select couverture_le is null from public.equipes where id = pg_temp.eq('Racing Wazemmes')));

-- ═══ E11 · La dissolution : l'entraîneur seul ne garde pas l'équipe ═══
-- AS Fives : Sofiane (capitaine), Farid (vice) ; Yacine nommé, il signe ; les deux joueurs partent.
select pg_temp.passe('E11 Yacine nommé chez AS Fives', 'Sofiane', pg_temp.appel('equipe_entraineur_inviter', 'AS Fives', 'Yacine'));
select pg_temp.passe('E11 Yacine signe', 'Yacine', pg_temp.appel('equipe_signer', 'AS Fives'));
select pg_temp.passe('E11 Farid part', 'Farid', pg_temp.appel('equipe_quitter', 'AS Fives'));
select pg_temp.passe('E11 Sofiane part', 'Sofiane', pg_temp.appel('equipe_quitter', 'AS Fives'));
select pg_temp.vrai('E11 l''équipe est dissoute, plus personne dedans',
  (select dissoute_le = now() from public.equipes where id = pg_temp.eq('AS Fives'))
  and not exists (select 1 from public.equipe_membres m where m.equipe_id = pg_temp.eq('AS Fives')));
select pg_temp.vrai('E11 l''entraîneur part avec la dissolution',
  (select d.motif = 'dissolution' and d.role = 'entraineur' from public.equipe_departs d where d.equipe_id = pg_temp.eq('AS Fives') and d.joueur = pg_temp.uid('Yacine'))
  and (select t.motif = 'dissolution' and t.fin = now() from public.equipe_entraineurs t where t.equipe_id = pg_temp.eq('AS Fives') and t.joueur = pg_temp.uid('Yacine')));

-- ═══ E12 · L'invitation de 72 h ; une seule place, même à la main ═══
select pg_temp.refuse('E12 Farid vient de partir : refusé', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Farid'), 'P0001', '14 jours');
select pg_temp.refuse('E12 Bilal, joueur du Racing : refusé', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Bilal'), 'P0001', 'déjà une équipe');
select pg_temp.passe('E12 Sunday Five (7 / 7) invite Karim', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Karim'));
update public.equipe_membres set created_at = now() - interval '73 hours' where equipe_id = pg_temp.eq('Sunday Five') and joueur = pg_temp.uid('Karim');
select pg_temp.passe('E12 après 72 h, la place se libère : Ilan', 'Ilyes', pg_temp.appel('equipe_entraineur_inviter', 'Sunday Five', 'Ilan'));
select pg_temp.vrai('E12 l''invitation de Karim est tombée',
  pg_temp.ligne('Sunday Five', 'Karim') is null and (pg_temp.ligne('Sunday Five', 'Ilan')).role = 'entraineur'
  and (select count(*) from public.equipe_membres m where m.equipe_id = pg_temp.eq('Sunday Five') and m.role = 'entraineur') = 1);
do $$
begin
  insert into public.equipe_membres (equipe_id, joueur, statut, role) values (pg_temp.eq('Sunday Five'), pg_temp.uid('Moussa'), 'invite', 'entraineur');
  raise exception 'ÉCHEC E12 un second entraîneur est entré par la table';
exception when unique_violation then
  raise notice 'E12 l''index refuse un second entraîneur ok';
end; $$;
do $$
begin
  update public.equipe_membres set role = 'adjoint' where equipe_id = pg_temp.eq('Sunday Five') and joueur = pg_temp.uid('Badis');
  raise exception 'ÉCHEC E12 un rôle inconnu est entré';
exception when check_violation then
  raise notice 'E12 la contrainte des rôles tient ok';
end; $$;

select 'entraineur-check : tout est ok' as fin;
rollback;
