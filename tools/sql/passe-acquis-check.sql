-- Le banc SQL des paliers du Passe gardés par le serveur (passe_acquis,
-- poser_paliers_acquis ; 01/11/2026). Même mise en place que
-- achats-xp-check.sql ; transaction annulée, arrêt au premier ÉCHEC.
--   psql -v ON_ERROR_STOP=1 -f tools/sql/passe-acquis-check.sql

\set ON_ERROR_STOP 1
begin;
\ir achats-xp-donnees.sql

create function pg_temp.poser(lignes jsonb) returns text language plpgsql as $$
declare n int;
begin
  set local role service_role;
  n := public.poser_paliers_acquis(lignes);
  reset role;
  return n::text;
exception when others then
  reset role;
  return 'refus ' || sqlerrm;
end; $$;

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

create function pg_temp.palier(qui text, s text) returns int language sql as $$
  select a.palier from public.passe_acquis a join public.profiles p on p.id = a.joueur where p.name = qui and a.saison_passe = s
$$;

-- 1 · Le serveur pose 13 en Saison 1.
select pg_temp.vrai('1 pose', pg_temp.poser('[{"joueur":"e0000000-0000-0000-0000-00000000000a","saison_passe":"s1","palier":13,"xp_saison":1630}]') = '1' and pg_temp.palier('IlyesXp', 's1') = 13);
-- 2 · Un calcul incomplet (4/16, sans les réponses) ne le fait jamais baisser ; l'XP de la saison suit.
select pg_temp.vrai('2 ne redescend jamais', pg_temp.poser('[{"joueur":"e0000000-0000-0000-0000-00000000000a","saison_passe":"s1","palier":4,"xp_saison":1320}]') = '1' and pg_temp.palier('IlyesXp', 's1') = 13);
-- 3 · Il monte.
select pg_temp.vrai('3 monte', pg_temp.poser('[{"joueur":"e0000000-0000-0000-0000-00000000000a","saison_passe":"s1","palier":14,"xp_saison":1725},{"joueur":"e0000000-0000-0000-0000-00000000000a","saison_passe":"givre","palier":2,"xp_saison":250}]') = '2' and pg_temp.palier('IlyesXp', 's1') = 14 and pg_temp.palier('IlyesXp', 'givre') = 2);
-- 4 · Les lignes invalides sont ignorées (compte inconnu, palier hors bornes, saison mal écrite).
select pg_temp.vrai('4 lignes invalides', pg_temp.poser('[{"joueur":"e0000000-0000-0000-0000-0000000000ff","saison_passe":"s1","palier":3},{"joueur":"e0000000-0000-0000-0000-00000000000b","saison_passe":"s1","palier":0},{"joueur":"e0000000-0000-0000-0000-00000000000b","saison_passe":"S1; drop","palier":3}]') = '0');
select pg_temp.vrai('4 pas un tableau', pg_temp.poser('{"a":1}') like 'refus%');
-- 5 · Un joueur ne peut ni appeler la fonction, ni écrire, ni effacer.
select pg_temp.vrai('5 joueur : pas d''appel', pg_temp.en('KaderXp', $q$select public.poser_paliers_acquis('[{"joueur":"e0000000-0000-0000-0000-00000000000b","saison_passe":"s1","palier":16}]')::text$q$) like 'refus%');
select pg_temp.vrai('5 joueur : pas d''écriture', pg_temp.en('KaderXp', $q$insert into public.passe_acquis (joueur, saison_passe, palier) values (auth.uid(), 's1', 16) returning 'écrit'$q$) like 'refus%');
select pg_temp.vrai('5 joueur : pas de mise à jour', pg_temp.en('IlyesXp', $q$update public.passe_acquis set palier = 16 returning 'écrit'$q$) like 'refus%' or pg_temp.palier('IlyesXp', 's1') = 14);
-- 6 · Les membres lisent ; un compte non validé et l'anonyme, non.
select pg_temp.vrai('6 membre lit', pg_temp.en('KaderXp', 'select count(*)::text from public.passe_acquis') = '2');
update public.profiles set valide = false where name = 'NaimXp' and id::text like 'e0000000-%';
select pg_temp.vrai('6 non validé : rien', pg_temp.en('NaimXp', 'select count(*)::text from public.passe_acquis') = '0');
select pg_temp.vrai('6 anonyme : rien', has_table_privilege('anon', 'public.passe_acquis', 'select') = false);
-- Relecture adverse (02/11/2026).
-- 7 · Deux lignes pour le même joueur et la même saison dans un appel : la plus haute, une seule écriture.
select pg_temp.vrai('7 doublons : le plus haut', pg_temp.poser('[{"joueur":"e0000000-0000-0000-0000-00000000000b","saison_passe":"s1","palier":15,"xp_saison":1800},{"joueur":"e0000000-0000-0000-0000-00000000000b","saison_passe":"s1","palier":16,"xp_saison":1900}]') = '1' and pg_temp.palier('KaderXp', 's1') = 16);
-- 8 · Une XP de saison négative ne s'écrit jamais telle quelle.
select pg_temp.vrai('8 posée', pg_temp.poser('[{"joueur":"e0000000-0000-0000-0000-00000000000b","saison_passe":"givre","palier":1,"xp_saison":-50}]') = '1');
select pg_temp.vrai('8 XP de saison jamais négative', (select a.xp_saison from public.passe_acquis a where a.joueur = 'e0000000-0000-0000-0000-00000000000b' and a.saison_passe = 'givre') = 0);
-- 9 · Ni l'anonyme ni un joueur n'appellent la fonction ; un joueur n'efface pas un palier gardé.
select pg_temp.vrai('9 droits de la fonction', not has_function_privilege('anon', 'public.poser_paliers_acquis(jsonb)', 'execute') and not has_function_privilege('authenticated', 'public.poser_paliers_acquis(jsonb)', 'execute'));
select pg_temp.vrai('9 joueur : pas d''effacement', pg_temp.en('KaderXp', $q$delete from public.passe_acquis where joueur = auth.uid() returning 'effacé'$q$) like 'refus%' and pg_temp.palier('KaderXp', 's1') = 16);
rollback;
