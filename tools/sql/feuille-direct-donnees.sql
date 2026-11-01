-- Les données des bancs de la feuille de match tenue par un joueur
-- (feuille-direct-check.sql, feuille-direct-concurrence.sh) : sept comptes de
-- test et la saison 1, avec la J3 jouée la semaine passée, la J4 du jour
-- (deux matchs, MVP calculé ; Ilyes a déjà un but saisi par l'admin) et une
-- J5 en brouillon. Remplace la saison : jamais sur la base de la ligue.

-- Les comptes passent par auth.users : le profil naît du déclencheur, comme en vrai.
insert into auth.users (id, email, raw_user_meta_data) values
  ('d0000000-0000-0000-0000-00000000000a', 'ilyes@test.local', '{"name":"Ilyes","username":"@ilyes"}'),
  ('d0000000-0000-0000-0000-00000000000b', 'sabri@test.local', '{"name":"Sabri","username":"@sabri"}'),
  ('d0000000-0000-0000-0000-00000000000c', 'theo@test.local',  '{"name":"Théo","username":"@theo"}'),
  ('d0000000-0000-0000-0000-00000000000d', 'badis@test.local', '{"name":"Badis","username":"@badis"}'),
  ('d0000000-0000-0000-0000-00000000000e', 'sami@test.local',  '{"name":"Sami","username":"@sami"}'),
  ('d0000000-0000-0000-0000-00000000000f', 'kader@test.local', '{"name":"Kader","username":"@kader"}'),
  ('d0000000-0000-0000-0000-000000000010', 'naim@test.local',  '{"name":"Naim","username":"@naim"}');
update public.profiles set valide = true where id::text like 'd0000000-%';
update public.profiles set is_admin = true where name in ('Ilyes', 'Sabri') and id::text like 'd0000000-%';
update public.profiles set joue = false where name = 'Sabri' and id::text like 'd0000000-%';

-- La date du jour à la façon des journées (« 1 nov. »), et celle de la semaine passée.
create function pg_temp.libelle(d date) returns text language sql immutable as $$
  select extract(day from d)::int || ' ' || (array['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'])[extract(month from d)::int]
$$;

-- La saison 1 : une J3 jouée la semaine passée, la J4 du jour (deux matchs,
-- MVP calculé ; Ilyes a déjà un but saisi par l'admin), une J5 en brouillon.
delete from public.saison where id = 1;
insert into public.saison (id, data, version, seed)
select 1, jsonb_build_object(
  'numero', 1,
  'roster', '[{"name":"Ilyes"},{"name":"Théo"},{"name":"Badis"},{"name":"Sami"},{"name":"Kader"},{"name":"Naim"},{"name":"Anis"}]'::jsonb,
  'convocations', '[]'::jsonb,
  'journees', jsonb_build_array(
    jsonb_build_object('j', 3, 'date', pg_temp.libelle((now() at time zone 'Europe/Paris')::date - 7), 'sflTime', false),
    jsonb_build_object('j', 4, 'date', pg_temp.libelle((now() at time zone 'Europe/Paris')::date), 'sflTime', false, 'mvpAuto', true,
      'matchsDuJour', '[{"equipes":["Noirs 1","Blancs 1"]},{"equipes":["Noirs 2","Blancs 2"]}]'::jsonb),
    jsonb_build_object('j', 5, 'date', pg_temp.libelle((now() at time zone 'Europe/Paris')::date + 7), 'sflTime', false,
      'brouillon', '{"depuis":"x","par":"Sabri"}'::jsonb,
      'matchsDuJour', '[{"equipes":["Noirs 1","Blancs 1"]}]'::jsonb)),
  'entries', '[
    {"j":3,"player":"Ilyes","team":"Noirs 1","statut":"Présent","result":"Victoire","buts":2,"passes":0,"retard":false},
    {"j":3,"player":"Théo","team":"Blancs 1","statut":"Présent","result":"Défaite","buts":0,"passes":1,"retard":false},
    {"j":4,"player":"Ilyes","team":"Noirs 1","statut":"Présent","result":null,"buts":1,"passes":0,"sflTime":false,"retard":false},
    {"j":4,"player":"Théo","team":"Noirs 1","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":false,"retard":false},
    {"j":4,"player":"Anis","team":"Noirs 1","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":false,"retard":false},
    {"j":4,"player":"Badis","team":"Blancs 1","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":false,"retard":false},
    {"j":4,"player":"Sami","team":"Blancs 1","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":false,"retard":false},
    {"j":4,"player":"Kader","team":"Noirs 2","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":false,"retard":false},
    {"j":4,"player":"Naim","team":"Blancs 2","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":false,"retard":false},
    {"j":4,"player":"Sami","team":"Blancs 2","statut":"Présent","result":null,"buts":0,"passes":0,"sflTime":false,"retard":false,"extraTime":true},
    {"j":5,"player":"Théo","team":"Noirs 1","statut":"Présent","result":null,"buts":0,"passes":0,"retard":false}
  ]'::jsonb), 1000, 0;
delete from public.feuilles_direct where saison = 1;

