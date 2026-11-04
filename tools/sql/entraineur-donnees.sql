-- Les données des bancs de l'entraîneur de Bola Team (03/11/2026 ; Ilyes,
-- 02/11 : « une équipe = 7 joueurs + 1 entraîneur ») : entraineur-check.sql,
-- feuille-team-check.sql et feuille-team-concurrence.sh. Jamais sur la base
-- de la ligue : un Postgres local, après supabase/schema.sql.
--
-- Vingt-six comptes de test (e0000000-…), tous avec Bola Team (offert par
-- un lien, comme un joueur venu par un joueur SFL), sauf Nolan, dont le
-- compte attend encore d'être accepté. Trois équipes, faites par les
-- fonctions de la base, chacune par son capitaine, comme dans l'app :
--   · Sunday Five : Ilyes (capitaine), Théo (vice), Badis, Sami, Kader ;
--   · Racing Wazemmes : Yanis (capitaine), Omar (vice), Rayan, Wassim, Hugo ;
--   · AS Fives : Sofiane (capitaine) ; Zak y est entré puis en est parti
--     (14 jours de carence).
-- Personne n'a encore d'entraîneur : chaque banc nomme le sien.

-- Les comptes passent par auth.users : le profil naît du déclencheur, comme en vrai.
insert into auth.users (id, email, raw_user_meta_data)
select ('e0000000-0000-0000-0000-' || lpad(to_hex(n), 12, '0'))::uuid, lower(nom) || '@coach.test', jsonb_build_object('name', nom, 'username', '@' || lower(nom))
  from unnest(array['Ilyes', 'Théo', 'Badis', 'Sami', 'Kader', 'Naim', 'Anis', 'Lucien', 'Adil', 'Yanis', 'Omar', 'Rayan',
                    'Wassim', 'Hugo', 'Malik', 'Zak', 'Nolan', 'Sofiane', 'Ryad', 'Bilal', 'Karim', 'Mehdi', 'Yacine', 'Farid', 'Ilan', 'Moussa'])
       with ordinality as t(nom, n);
update public.profiles set valide = true, ville = 'Lille' where id::text like 'e0000000-%' and name <> 'Nolan';
insert into public.team_offerts (joueur, via) select id, 'lien' from public.profiles where id::text like 'e0000000-%' and valide
on conflict (joueur) do nothing;

-- Un geste comme un joueur (son jeton), avec ses seuls droits : la donnée doit passer.
create function pg_temp.comme(qui text, appel text) returns text language plpgsql as $$
declare uid uuid; r text;
begin
  select id into uid from public.profiles where name = qui and id::text like 'e0000000-%';
  if uid is null then raise exception 'compte de test inconnu : %', qui; end if;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  execute 'select (' || appel || ')::text' into r;
  reset role;
  return r;
end; $$;

create function pg_temp.uid(qui text) returns uuid language sql stable as $$
  select id from public.profiles where name = qui and id::text like 'e0000000-%'
$$;
create function pg_temp.eq(nom text) returns bigint language sql stable as $$
  select id from public.equipes where equipes.nom = eq.nom
$$;

-- Une équipe : son capitaine la crée, invite ses joueurs, chacun signe.
create function pg_temp.equipe(nom text, initiales text, capitaine text, joueurs text[]) returns bigint language plpgsql as $$
declare e bigint; j text;
begin
  e := pg_temp.comme(capitaine, format('public.equipe_creer(%L, %L, %L)', nom, initiales, 'noir'))::bigint;
  foreach j in array joueurs loop
    perform pg_temp.comme(capitaine, format('public.equipe_inviter(%s, %L::uuid)', e, pg_temp.uid(j)));
    perform pg_temp.comme(j, format('public.equipe_signer(%s)', e));
  end loop;
  return e;
end; $$;

select pg_temp.equipe('Sunday Five', 'SF', 'Ilyes', array['Théo', 'Badis', 'Sami', 'Kader']);
select pg_temp.comme('Ilyes', format('public.equipe_vice(%s, %L::uuid)', pg_temp.eq('Sunday Five'), pg_temp.uid('Théo')));
select pg_temp.equipe('Racing Wazemmes', 'RW', 'Yanis', array['Omar', 'Rayan', 'Wassim', 'Hugo']);
select pg_temp.comme('Yanis', format('public.equipe_vice(%s, %L::uuid)', pg_temp.eq('Racing Wazemmes'), pg_temp.uid('Omar')));
select pg_temp.equipe('AS Fives', 'ASF', 'Sofiane', array['Zak']);
select pg_temp.comme('Zak', format('public.equipe_quitter(%s)', pg_temp.eq('AS Fives')));
