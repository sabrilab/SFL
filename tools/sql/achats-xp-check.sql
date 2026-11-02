-- Le banc SQL du PACK AFRIQUE 2027 (achats_xp, ouvrir_pack_xp, mes_achats_xp ;
-- 01/11/2026). À jouer sur un Postgres 16 local, JAMAIS sur la base de la
-- ligue : tools/sql/supabase-reduit.sql sur un Postgres nu, supabase/schema.sql
-- (une première fois, puis une fois avec ON_ERROR_STOP), puis
--   psql -v ON_ERROR_STOP=1 -f tools/sql/achats-xp-check.sql
-- Tout se passe dans une transaction annulée : rien ne reste. Chaque ligne
-- finit par ok ; le fichier s'arrête au premier ÉCHEC. Les appels simultanés
-- sont dans achats-xp-concurrence.sh.

\set ON_ERROR_STOP 1
begin;
\ir achats-xp-donnees.sql

-- La route (clé secrète) : ouvrir_pack_xp comme service_role.
create function pg_temp.ouvrir(qui text, prix int, gagne int, choix text[], cle text) returns jsonb language plpgsql as $$
declare r jsonb; uid uuid;
begin
  select id into uid from public.profiles where name = qui and id::text like 'e0000000-%';
  set local role service_role;
  r := public.ouvrir_pack_xp(uid, 'pack-afrique-2027', prix, gagne, choix, cle::uuid);
  reset role;
  return r;
exception when others then
  reset role;
  return jsonb_build_object('erreur', sqlerrm);
end; $$;

-- Comme un joueur (son jeton), avec ses seuls droits : le résultat, ou « refus … ».
create function pg_temp.en(qui text, ordre text) returns text language plpgsql as $$
declare r text; uid uuid;
begin
  select id into uid from public.profiles where name = qui and id::text like 'e0000000-%';
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  execute ordre into r;
  reset role;
  return coalesce(r, 'null');
exception when others then
  reset role;
  return 'refus ' || sqlerrm;
end; $$;

create function pg_temp.vrai(nom text, cond boolean, detail text default '') returns text language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC % %', nom, detail; end if;
  return nom || ' ok';
end; $$;

create temp table r (k text primary key, v jsonb);
grant all on r to service_role, authenticated;

-- 1 · Solde insuffisant : 1 100 < 1 200, rien n'est écrit.
insert into r values ('1', pg_temp.ouvrir('IlyesXp', 1200, 1100, array['ke','ug','tz'], '10000000-0000-0000-0000-000000000001'));
select pg_temp.vrai('1 solde insuffisant', (select v ->> 'erreur' from r where k = '1') = 'XP insuffisante.', (select v::text from r where k = '1'));
select pg_temp.vrai('1 rien écrit', (select count(*) from public.achats_xp) = 0);

-- 2 · Une ouverture : une nation tirée parmi le choix, numéro 1, solde 2 500.
insert into r values ('2', pg_temp.ouvrir('IlyesXp', 1200, 3700, array['ke','ug','tz'], '10000000-0000-0000-0000-000000000002'));
select pg_temp.vrai('2 ouverture', (select v ->> 'obtenu' from r where k = '2') = any (array['ke','ug','tz']) and (select (v ->> 'serie')::int from r where k = '2') = 1 and (select (v ->> 'solde')::int from r where k = '2') = 2500, (select v::text from r where k = '2'));

-- 3 · Double exécution (même clé) : le même tirage, pas de second débit.
insert into r values ('3', pg_temp.ouvrir('IlyesXp', 1200, 3700, array['ke','ug','tz'], '10000000-0000-0000-0000-000000000002'));
select pg_temp.vrai('3 même clé, même tirage', (select v ->> 'obtenu' from r where k = '3') = (select v ->> 'obtenu' from r where k = '2') and (select (v ->> 'deja')::boolean from r where k = '3'));
select pg_temp.vrai('3 un seul débit', (select count(*) from public.achats_xp) = 1 and (select sum(xp) from public.achats_xp) = 1200);

-- 4 · Le tirage est fait par le serveur, sans doublon : trois ouvertures donnent les trois nations.
insert into r values ('4a', pg_temp.ouvrir('IlyesXp', 1200, 3700, array['ke','ug','tz'], '10000000-0000-0000-0000-000000000004'));
insert into r values ('4b', pg_temp.ouvrir('IlyesXp', 1200, 3700, array['ke','ug','tz'], '10000000-0000-0000-0000-000000000005'));
select pg_temp.vrai('4 sans doublon', (select count(distinct obtenu) from public.achats_xp) = 3 and (select count(*) from public.achats_xp) = 3);
select pg_temp.vrai('4 solde 100', (select (v ->> 'solde')::int from r where k = '4b') = 100);

-- 5 · Pack complet (XP suffisante) : refus.
insert into r values ('5', pg_temp.ouvrir('IlyesXp', 1200, 99999, array['ke','ug','tz'], '10000000-0000-0000-0000-000000000006'));
select pg_temp.vrai('5 pack complet', (select v ->> 'erreur' from r where k = '5') = 'Pack complet.');

-- 6 · Le pack grandit : une nation ajoutée est tirée aussitôt.
insert into r values ('6', pg_temp.ouvrir('IlyesXp', 1200, 99999, array['ke','ug','tz','ma'], '10000000-0000-0000-0000-000000000007'));
select pg_temp.vrai('6 nation ajoutée', (select v ->> 'obtenu' from r where k = '6') = 'ma');

-- 7 · Demande invalide (code de nation, prix).
insert into r values ('7a', pg_temp.ouvrir('IlyesXp', 1200, 9999, array['KE; drop'], '10000000-0000-0000-0000-000000000008'));
insert into r values ('7b', pg_temp.ouvrir('IlyesXp', 0, 9999, array['sn'], '10000000-0000-0000-0000-000000000009'));
select pg_temp.vrai('7 demande invalide', (select v ->> 'erreur' from r where k = '7a') = 'Demande invalide.' and (select v ->> 'erreur' from r where k = '7b') = 'Demande invalide.');

-- 8 · Un autre joueur : son propre solde, la série de la nation continue (n° 2).
insert into r values ('8', pg_temp.ouvrir('KaderXp', 1200, 1200, array['ma'], '20000000-0000-0000-0000-000000000001'));
select pg_temp.vrai('8 série par nation', (select v ->> 'obtenu' from r where k = '8') = 'ma' and (select (v ->> 'serie')::int from r where k = '8') = 2, (select v::text from r where k = '8'));
select pg_temp.vrai('8 la dépense d''Ilyes ne touche pas Kader', (select (v ->> 'solde')::int from r where k = '8') = 0);

-- 9 · Les droits d'un joueur : ni appeler la fonction, ni lire le prix, ni écrire.
select pg_temp.vrai('9 joueur : pas d''ouverture', pg_temp.en('KaderXp', $q$select public.ouvrir_pack_xp(auth.uid(), 'pack-afrique-2027', 1, 99999, array['ke'], gen_random_uuid())::text$q$) like 'refus%');
select pg_temp.vrai('9 joueur : pas de prix', pg_temp.en('KaderXp', 'select sum(xp)::text from public.achats_xp') like 'refus%');
select pg_temp.vrai('9 joueur : pas d''écriture', pg_temp.en('KaderXp', $q$insert into public.achats_xp (joueur, article, obtenu, xp, serie, cle) values (auth.uid(), 'pack-afrique-2027', 'sn', 1, 1, gen_random_uuid()) returning 'écrit'$q$) like 'refus%');
select pg_temp.vrai('9 joueur : pas d''effacement', pg_temp.en('IlyesXp', $q$with d as (delete from public.achats_xp returning 1) select count(*)::text from d$q$) in ('0') or pg_temp.en('IlyesXp', $q$with d as (delete from public.achats_xp returning 1) select count(*)::text from d$q$) like 'refus%');
select pg_temp.vrai('9 membre : lit ce que chacun a obtenu', pg_temp.en('NaimXp', 'select count(*)::text from (select obtenu, serie, joueur from public.achats_xp) x') = '5');
select pg_temp.vrai('9 joueur : ses achats avec leur prix', pg_temp.en('KaderXp', 'select string_agg(obtenu || '':'' || xp, '','') from public.mes_achats_xp()') = 'ma:1200');
select pg_temp.vrai('9 anonyme : rien', (select has_function_privilege('anon', 'public.mes_achats_xp()', 'execute')) = false and (select has_table_privilege('anon', 'public.achats_xp', 'select')) = false);

-- 10 · Un membre non validé ne lit rien.
update public.profiles set valide = false where name = 'NaimXp' and id::text like 'e0000000-%';
select pg_temp.vrai('10 non validé : rien', pg_temp.en('NaimXp', 'select count(*)::text from (select obtenu from public.achats_xp) x') = '0');

-- 11 · Le tirage est uniforme côté serveur : 300 joueurs fictifs sur trois nations, chacune entre 60 et 140.
do $$ declare i int; begin
  for i in 1..300 loop
    insert into auth.users (id, email, raw_user_meta_data) values (('f0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'f' || i || '@test.local', jsonb_build_object('name', 'Tirage' || i, 'username', '@tirage' || i));
    perform public.ouvrir_pack_xp(('f0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'pack-afrique-2027', 1200, 1200, array['sn','ci','ng'], gen_random_uuid());
  end loop;
end $$;
select pg_temp.vrai('11 tirage uniforme', (select bool_and(n between 60 and 140) from (select count(*) n from public.achats_xp where obtenu in ('sn','ci','ng') group by obtenu) x), (select string_agg(obtenu || '=' || n, ' ') from (select obtenu, count(*) n from public.achats_xp where obtenu in ('sn','ci','ng') group by obtenu) x));
select pg_temp.vrai('11 séries sans trou', (select bool_and(m = n) from (select obtenu, max(serie) m, count(*) n from public.achats_xp group by obtenu) x));

-- Relecture adverse (02/11/2026) : ce que le banc ne disait pas encore.
-- L'appel tel que la route le fait, avec le DÉTAIL de l'erreur (le solde réel), par identifiant de compte.
create function pg_temp.ouvrir_id(uid uuid, prix int, gagne int, choix text[], cle text) returns jsonb language plpgsql as $$
declare r jsonb; m text; d text;
begin
  set local role service_role;
  r := public.ouvrir_pack_xp(uid, 'pack-afrique-2027', prix, gagne, choix, cle::uuid);
  reset role;
  return r;
exception when others then
  get stacked diagnostics m = message_text, d = pg_exception_detail;
  reset role;
  return jsonb_build_object('erreur', m, 'detail', d);
end; $$;
create function pg_temp.id(qui text) returns uuid language sql as $$
  select id from public.profiles where name = qui and id::text like 'e0000000-%'
$$;

-- 12 · Acheter avec la clé d'un autre : la clé est à chacun. Kader rejoue la clé d'Ilyes : un achat
--      à lui, débité à lui, jamais le tirage d'Ilyes ; la ligne d'Ilyes ne bouge pas.
insert into r values ('12', pg_temp.ouvrir_id(pg_temp.id('KaderXp'), 1200, 2400, array['ke'], '10000000-0000-0000-0000-000000000002'));
select pg_temp.vrai('12 clé d''un autre : un achat à soi', (select v ->> 'obtenu' from r where k = '12') = 'ke' and (select (v ->> 'deja')::boolean from r where k = '12') = false and (select (v ->> 'solde')::int from r where k = '12') = 0, (select v::text from r where k = '12'));
select pg_temp.vrai('12 la ligne d''Ilyes ne bouge pas', (select count(*) from public.achats_xp where cle = '10000000-0000-0000-0000-000000000002' and joueur = pg_temp.id('IlyesXp')) = 1 and (select obtenu from public.achats_xp where cle = '10000000-0000-0000-0000-000000000002' and joueur = pg_temp.id('IlyesXp')) = (select v ->> 'obtenu' from r where k = '2'));
select pg_temp.vrai('12 Kader a payé deux packs, pas plus', (select sum(xp) from public.achats_xp where joueur = pg_temp.id('KaderXp')) = 2400);

-- 13 · L'XP gagnée retombe sous ce qui est déjà dépensé (un contrat raté, une feuille corrigée) :
--      refus, le solde dit 0 (jamais négatif), rien n'est écrit, aucun achat n'est repris.
insert into r values ('13', pg_temp.ouvrir_id(pg_temp.id('IlyesXp'), 1200, 1000, array['ke','ug','tz','ma','sn'], '10000000-0000-0000-0000-000000000013'));
select pg_temp.vrai('13 XP retombée : refus, solde 0', (select v ->> 'erreur' from r where k = '13') = 'XP insuffisante.' and (select v ->> 'detail' from r where k = '13') = '0', (select v::text from r where k = '13'));
select pg_temp.vrai('13 rien d''écrit, rien de repris', (select count(*) from public.achats_xp where joueur = pg_temp.id('IlyesXp')) = 4);
-- Le solde rendu au refus est le vrai : 5 000 gagnés − 4 800 dépensés = 200.
insert into r values ('13b', pg_temp.ouvrir_id(pg_temp.id('IlyesXp'), 1200, 5000, array['sn'], '10000000-0000-0000-0000-000000000014'));
select pg_temp.vrai('13 le solde du refus est le vrai', (select v ->> 'detail' from r where k = '13b') = '200', (select v::text from r where k = '13b'));

-- 14 · Un joueur ne lit ni la clé ni le prix des autres, et ne change rien à ses achats.
select pg_temp.vrai('14 joueur : pas de clé', pg_temp.en('KaderXp', 'select count(cle)::text from public.achats_xp') like 'refus%');
select pg_temp.vrai('14 joueur : pas de changement', pg_temp.en('KaderXp', $q$update public.achats_xp set obtenu = 'sn' where joueur = auth.uid() returning 'écrit'$q$) like 'refus%');
select pg_temp.vrai('14 joueur : pas d''effacement de son achat', pg_temp.en('KaderXp', $q$delete from public.achats_xp where joueur = auth.uid() returning 'effacé'$q$) like 'refus%');

-- 15 · Mes achats : les miens seulement, avec leur prix.
select pg_temp.vrai('15 mes achats, rien d''autre', pg_temp.en('KaderXp', $q$select string_agg(obtenu || ':' || xp, ',' order by obtenu) from public.mes_achats_xp()$q$) = 'ke:1200,ma:1200');
select pg_temp.vrai('15 anonyme : ni ouvrir ni lire', not has_function_privilege('anon', 'public.ouvrir_pack_xp(uuid, text, int, int, text[], uuid)', 'execute') and not has_function_privilege('authenticated', 'public.ouvrir_pack_xp(uuid, text, int, int, text[], uuid)', 'execute') and not has_function_privilege('anon', 'public.mes_achats_xp()', 'execute'));

-- 16 · Un compte inconnu, un prix hors bornes : refus, rien d'écrit.
select pg_temp.vrai('16 compte inconnu : refus', pg_temp.ouvrir_id('e0000000-0000-0000-0000-0000000000ff', 1200, 9999, array['sn'], '10000000-0000-0000-0000-000000000016') ? 'erreur');
select pg_temp.vrai('16 prix hors bornes : refus', pg_temp.ouvrir_id(pg_temp.id('KaderXp'), 100001, 999999, array['sn'], '10000000-0000-0000-0000-000000000017') ? 'erreur');
select pg_temp.vrai('16 rien d''écrit', (select count(*) from public.achats_xp where cle in ('10000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000017')) = 0);

-- 17 · Une ligne d'achat porte toujours le débit ET la nation : ni pack sans débit, ni débit sans pack.
select pg_temp.vrai('17 débit et nation, toujours ensemble', (select bool_and(xp >= 1 and obtenu ~ '^[a-z]{2}$' and serie >= 1) from public.achats_xp));

rollback;
