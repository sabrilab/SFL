-- Les données des bancs du PACK AFRIQUE 2027 et des paliers gardés
-- (achats-xp-check.sql, achats-xp-concurrence.sh, passe-acquis-check.sql) :
-- trois comptes de test. Jamais sur la base de la ligue.
insert into auth.users (id, email, raw_user_meta_data) values
  ('e0000000-0000-0000-0000-00000000000a', 'ilyes-xp@test.local', '{"name":"IlyesXp","username":"@ilyesxp"}'),
  ('e0000000-0000-0000-0000-00000000000b', 'kader-xp@test.local', '{"name":"KaderXp","username":"@kaderxp"}'),
  ('e0000000-0000-0000-0000-00000000000c', 'naim-xp@test.local',  '{"name":"NaimXp","username":"@naimxp"}')
on conflict (id) do nothing;
update public.profiles set valide = true where id::text like 'e0000000-%';
