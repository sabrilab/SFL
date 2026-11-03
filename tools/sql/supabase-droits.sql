-- Les droits que Supabase donne d'office (03/11/2026), pour les bancs qui
-- regardent les droits de table (secu-check.sql) : tout sur ce que crée
-- postgres dans public, pour anon, authenticated et service_role, et tout sur
-- le stockage. La RLS filtre ensuite, comme en production. À jouer après
-- tools/sql/supabase-reduit.sql et avant supabase/schema.sql, sur un Postgres
-- 16 local seulement, jamais sur la base de la ligue.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
