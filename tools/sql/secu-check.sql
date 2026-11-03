-- Le banc SQL de l'audit de sécurité du 03/11/2026 (T1.2, T2, T17) :
--   · T1.2 : un compte qui a une ligne dans mot_de_passe_a_changer (mot de
--     passe d'origine, devenu public, ou provisoire) n'est ni membre ni admin
--     pour la base, mais lit toujours sa ligne et change son mot de passe ;
--   · T2 : un vocal, une photo ou une vidéo (buckets « vocaux » et
--     « images ») ne s'ouvre que pour son auteur et pour qui lit le message,
--     de son auteur, qui le porte : un privé, un match, une équipe, le
--     Vestiaire. Le lien signé (lienSigne, lib/sfl/vestiaire.ts) suit la même
--     règle : le service Storage lit la ligne de storage.objects avec le
--     jeton du joueur, c'est ce SELECT que le banc joue ;
--   · T17 : anon et authenticated n'ont plus TRUNCATE, TRIGGER ni REFERENCES
--     sur aucune table de public, et l'app n'en a pas besoin ;
--   · contrôle adverse du 03/11 (17, 18) : ce compte n'abonne aucun
--     téléphone, n'a plus de rôle d'organisateur ni de capitaine, ne touche
--     plus à ses lignes de match, ni aux feuilles (Bola, SFL en direct), ni
--     aux missions d'arbitre ; un lien signé trouve son message par l'index
--     et le relit par sa clé, sans lire toute la table messages.
--
-- À jouer sur un Postgres 16 local, JAMAIS sur la base de la ligue :
--   psql -f tools/sql/supabase-reduit.sql      (Postgres nu)
--   psql -f tools/sql/supabase-droits.sql      (les droits d'office de Supabase)
--   psql -f supabase/schema.sql                (une première fois, puis deux fois
--                                               avec -1 -v ON_ERROR_STOP=1)
--   psql -v ON_ERROR_STOP=1 -f tools/sql/secu-check.sql
-- Il passe aussi sur une base qui porte déjà des données (noms et identifiants
-- à part). Les joueurs y agissent comme par l'API : rôle anon ou
-- authenticated, jeton dans request.jwt.claims, comme PostgREST et Storage.
-- Tout se passe dans une transaction annulée : rien ne reste. Chaque ligne
-- finit par ok ; le fichier s'arrête au premier ÉCHEC.

\set ON_ERROR_STOP 1
begin;

-- ═══ Les joueurs (inventés) ═══
--   Ali, Bea, Cyr : membres de la SFL (dans l'effectif) ; Cyr n'est ni dans le
--     privé d'Ali et Bea, ni dans leur match, ni dans l'équipe d'Ali.
--   Dan : membre de la SFL qui n'a jamais changé son mot de passe d'origine.
--   Eva : joueuse Bola (acceptée, hors de l'effectif), dans l'équipe d'Ali.
--   Ada : admin qui a changé le sien. Ora : admin qui ne l'a pas changé.
create temp table banc (nom text primary key, id uuid not null);
insert into banc values
  ('Ali', 'f0000000-0000-0000-0000-0000000000a1'),
  ('Bea', 'f0000000-0000-0000-0000-0000000000b2'),
  ('Cyr', 'f0000000-0000-0000-0000-0000000000c3'),
  ('Dan', 'f0000000-0000-0000-0000-0000000000d4'),
  ('Eva', 'f0000000-0000-0000-0000-0000000000e5'),
  ('Ada', 'f0000000-0000-0000-0000-0000000000ad'),
  ('Ora', 'f0000000-0000-0000-0000-0000000000a0');
grant select on banc to anon, authenticated;

insert into auth.users (id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data)
select b.id, lower(b.nom) || '@banc.test', 'empreinte-inventee',
       jsonb_build_object('name', b.nom, 'username', '@banc_' || lower(b.nom)), '{"provider":"email"}'
  from banc b;
update public.profiles p set valide = true, is_admin = b.nom in ('Ada', 'Ora')
  from banc b where p.id = b.id;
insert into public.mot_de_passe_a_changer (user_id, motif)
select id, 'origine' from banc where nom in ('Dan', 'Ora')
on conflict (user_id) do update set motif = excluded.motif;

-- L'effectif de la saison (le Vestiaire est à lui) : tous sauf Eva.
insert into public.saison (id, data, version)
values (1, '{"numero": 1, "journees": [], "entries": [], "roster": []}', 1)
on conflict (id) do nothing;
update public.saison
   set data = jsonb_set(data, '{roster}', coalesce(data -> 'roster', '[]'::jsonb)
             || '[{"name":"Ali"},{"name":"Bea"},{"name":"Cyr"},{"name":"Dan"},{"name":"Ada"},{"name":"Ora"}]'::jsonb)
 where id = 1;
-- Ce que l'admin seul lit : l'email de contact et le journal d'usage d'Ali.
insert into public.contacts (user_id, email) values ('f0000000-0000-0000-0000-0000000000a1', 'ali.contact@banc.test')
on conflict (user_id) do nothing;
insert into public.activity (player_id, kind) values ('f0000000-0000-0000-0000-0000000000a1', 'open');
-- Un vote, pour que la ligue ait de quoi lire.
insert into public.votes_figures (saison, j, categorie, votant, candidat, match_id, jour, votant_id)
values (77, 1, 'impact', 'Ali', 'Bea', 'banc', current_date, 'f0000000-0000-0000-0000-0000000000a1');

-- Un match Bola d'Ali, avec Bea (et Dan) ; une équipe d'Ali, avec Eva.
insert into public.matchs (id, organisateur, visibilite, jour, heure, lieu, mode) overriding system value
values (99001, 'f0000000-0000-0000-0000-0000000000a1', 'public', current_date + 1, '10:00', 'Terrain du banc', 'bola');
insert into public.match_joueurs (match_id, player_id, statut, equipe) values
  (99001, 'f0000000-0000-0000-0000-0000000000b2', 'inscrit', 'fonces'),
  (99001, 'f0000000-0000-0000-0000-0000000000d4', 'inscrit', 'clairs');
insert into public.equipes (id, nom, initiales, capitaine) overriding system value
values (99701, 'Banc Ali', 'BA', 'f0000000-0000-0000-0000-0000000000a1');
insert into public.equipe_membres (equipe_id, joueur, statut, role) values
  (99701, 'f0000000-0000-0000-0000-0000000000a1', 'membre', 'capitaine'),
  (99701, 'f0000000-0000-0000-0000-0000000000e5', 'membre', 'membre');

-- Les fichiers, rangés comme l'app les range (<uuid de l'auteur>/<horodatage>.<ext>).
insert into storage.objects (bucket_id, name, owner) values
  ('vocaux', 'f0000000-0000-0000-0000-0000000000a1/1000.m4a', 'f0000000-0000-0000-0000-0000000000a1'),  -- privé Ali → Bea
  ('images', 'f0000000-0000-0000-0000-0000000000a1/1001.jpg', 'f0000000-0000-0000-0000-0000000000a1'),  -- privé Ali → Bea
  ('images', 'f0000000-0000-0000-0000-0000000000a1/1002.mp4', 'f0000000-0000-0000-0000-0000000000a1'),  -- privé Ali → Bea (vidéo)
  ('vocaux', 'f0000000-0000-0000-0000-0000000000b2/2000.m4a', 'f0000000-0000-0000-0000-0000000000b2'),  -- match, par Bea
  ('images', 'f0000000-0000-0000-0000-0000000000a1/3000.jpg', 'f0000000-0000-0000-0000-0000000000a1'),  -- équipe, par Ali
  ('images', 'f0000000-0000-0000-0000-0000000000b2/4000.jpg', 'f0000000-0000-0000-0000-0000000000b2'),  -- Vestiaire, par Bea
  ('vocaux', 'f0000000-0000-0000-0000-0000000000a1/5000.m4a', 'f0000000-0000-0000-0000-0000000000a1'),  -- sans message
  ('images', 'f0000000-0000-0000-0000-0000000000d4/6000.jpg', 'f0000000-0000-0000-0000-0000000000d4');  -- à Dan, sans message
insert into public.messages (canal, auteur, destinataire, match_id, equipe_id, texte, piece) values
  ('dm', 'f0000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000b2', null, null, '',
   '{"type":"vocal","chemin":"f0000000-0000-0000-0000-0000000000a1/1000.m4a","duree":4.2}'),
  ('dm', 'f0000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000b2', null, null, '',
   '{"type":"photo","chemin":"f0000000-0000-0000-0000-0000000000a1/1001.jpg","l":10,"h":10}'),
  ('dm', 'f0000000-0000-0000-0000-0000000000a1', 'f0000000-0000-0000-0000-0000000000b2', null, null, '',
   '{"type":"video","chemin":"f0000000-0000-0000-0000-0000000000a1/1002.mp4","l":9,"h":16,"duree":3}'),
  ('match', 'f0000000-0000-0000-0000-0000000000b2', null, 99001, null, '',
   '{"type":"vocal","chemin":"f0000000-0000-0000-0000-0000000000b2/2000.m4a","duree":2}'),
  ('equipe', 'f0000000-0000-0000-0000-0000000000a1', null, null, 99701, '',
   '{"type":"photo","chemin":"f0000000-0000-0000-0000-0000000000a1/3000.jpg","l":10,"h":10}'),
  ('sfl', 'f0000000-0000-0000-0000-0000000000b2', null, null, null, '',
   '{"type":"photo","chemin":"f0000000-0000-0000-0000-0000000000b2/4000.jpg","l":10,"h":10}'),
  -- Cyr pointe le vocal sans message d'Ali dans un privé à Bea : ce message
  -- n'est pas d'Ali, il n'ouvre rien.
  ('dm', 'f0000000-0000-0000-0000-0000000000c3', 'f0000000-0000-0000-0000-0000000000b2', null, null, '',
   '{"type":"vocal","chemin":"f0000000-0000-0000-0000-0000000000a1/5000.m4a","duree":1}');

-- ═══ Les outils ═══
-- Une requête comme un joueur (son jeton, ses droits) : le nombre rendu, ou -1 si refusée.
create function pg_temp.nb(qui text, requete text) returns bigint language plpgsql as $$
declare r bigint; uid uuid;
begin
  select id into uid from banc where nom = qui;
  perform set_config('request.jwt.claim.sub', '', true);
  if qui = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
  execute requete into r;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return coalesce(r, 0);
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return -1;
end; $$;

-- La même, pour un texte (ou « refus <message> »).
create function pg_temp.en(qui text, requete text) returns text language plpgsql as $$
declare r text; uid uuid;
begin
  select id into uid from banc where nom = qui;
  perform set_config('request.jwt.claim.sub', '', true);
  if qui = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
  execute requete into r;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return coalesce(r, 'null');
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'refus ' || sqlerrm;
end; $$;

-- Un ordre qui ne rend rien (TRUNCATE…) : « fait », ou « refus <message> ».
create function pg_temp.fait(qui text, ordre text) returns text language plpgsql as $$
declare uid uuid;
begin
  select id into uid from banc where nom = qui;
  perform set_config('request.jwt.claim.sub', '', true);
  if qui = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    set local role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
  end if;
  execute ordre;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'fait';
exception when others then
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return 'refus ' || sqlerrm;
end; $$;

create function pg_temp.vrai(nom text, cond boolean, detail text default '') returns text language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC % %', nom, detail; end if;
  return nom || ' ok';
end; $$;

-- Le fichier se lit-il (la ligne de storage.objects, celle que Storage signe) ?
create function pg_temp.lit(qui text, seau text, fichier text) returns bigint language sql as $$
  select pg_temp.nb(qui, format('select count(*) from storage.objects where bucket_id = %L and name = %L', seau, fichier)) $$;
-- Ce que la liste d'un dossier rend.
create function pg_temp.liste(qui text, seau text, dossier text) returns bigint language sql as $$
  select pg_temp.nb(qui, format('select count(*) from storage.objects where bucket_id = %L and name like %L', seau, dossier || '/%')) $$;

-- Tout ce qu'un joueur voit, table par table (public et storage).
create function pg_temp.vues(qui text) returns table (t text, n bigint) language plpgsql as $$
declare r record;
begin
  for r in select format('%I.%I', schemaname, tablename) as nom from pg_tables
            where schemaname in ('public', 'storage') order by 1 loop
    t := r.nom;
    n := pg_temp.nb(qui, format('select count(*) from %s', r.nom));
    return next;
  end loop;
end; $$;

\set a '''f0000000-0000-0000-0000-0000000000a1'
\set b '''f0000000-0000-0000-0000-0000000000b2'

-- ═══ T2 · les pièces jointes ═══
-- 1 · Un privé d'Ali à Bea : Cyr, membre de la ligue, n'en liste ni n'en ouvre rien.
select pg_temp.vrai('1 Cyr ne liste pas le dossier d''Ali (vocaux)', pg_temp.liste('Cyr', 'vocaux', :a') = 0);
select pg_temp.vrai('1 Cyr ne liste pas le dossier d''Ali (images)', pg_temp.liste('Cyr', 'images', :a') = 0);
select pg_temp.vrai('1 Cyr n''ouvre pas le vocal du privé', pg_temp.lit('Cyr', 'vocaux', :a/1000.m4a') = 0);
select pg_temp.vrai('1 Cyr n''ouvre pas la photo du privé', pg_temp.lit('Cyr', 'images', :a/1001.jpg') = 0);
select pg_temp.vrai('1 Cyr n''ouvre pas la vidéo du privé', pg_temp.lit('Cyr', 'images', :a/1002.mp4') = 0);
select pg_temp.vrai('1 Cyr ne lit pas le texte du privé non plus',
  pg_temp.nb('Cyr', 'select count(*) from public.messages where canal = ''dm'' and auteur <> auth.uid() and destinataire <> auth.uid()') = 0);
-- 2 · Bea, à qui le privé est écrit, ouvre le vocal, la photo et la vidéo.
select pg_temp.vrai('2 Bea ouvre le vocal du privé', pg_temp.lit('Bea', 'vocaux', :a/1000.m4a') = 1);
select pg_temp.vrai('2 Bea ouvre la photo du privé', pg_temp.lit('Bea', 'images', :a/1001.jpg') = 1);
select pg_temp.vrai('2 Bea ouvre la vidéo du privé', pg_temp.lit('Bea', 'images', :a/1002.mp4') = 1);
-- 3 · Ali, l'auteur, ouvre les siens, même sans message (le temps de l'envoi).
select pg_temp.vrai('3 Ali ouvre son vocal', pg_temp.lit('Ali', 'vocaux', :a/1000.m4a') = 1);
select pg_temp.vrai('3 Ali ouvre sa photo', pg_temp.lit('Ali', 'images', :a/1001.jpg') = 1);
select pg_temp.vrai('3 Ali ouvre son vocal sans message', pg_temp.lit('Ali', 'vocaux', :a/5000.m4a') = 1);
select pg_temp.vrai('3 Ali liste ses vocaux (2)', pg_temp.liste('Ali', 'vocaux', :a') = 2);
-- 4 · Le match d'Ali : le vocal de Bea s'ouvre pour Ali (l'organisateur), pas pour Cyr.
select pg_temp.vrai('4 Ali ouvre le vocal du match', pg_temp.lit('Ali', 'vocaux', :b/2000.m4a') = 1);
select pg_temp.vrai('4 Cyr n''ouvre pas le vocal du match', pg_temp.lit('Cyr', 'vocaux', :b/2000.m4a') = 0);
-- 5 · L'équipe d'Ali : Eva (joueuse Bola de l'équipe) voit la photo, pas Cyr.
select pg_temp.vrai('5 Eva voit la photo de l''équipe', pg_temp.lit('Eva', 'images', :a/3000.jpg') = 1);
select pg_temp.vrai('5 Cyr ne voit pas la photo de l''équipe', pg_temp.lit('Cyr', 'images', :a/3000.jpg') = 0);
-- 6 · Le Vestiaire : l'effectif voit la photo de Bea (Cyr) ; ni Eva (hors de
--     l'effectif), ni Dan (mot de passe d'origine), ni un visiteur.
select pg_temp.vrai('6 Cyr voit la photo du Vestiaire', pg_temp.lit('Cyr', 'images', :b/4000.jpg') = 1);
select pg_temp.vrai('6 Eva ne voit pas la photo du Vestiaire', pg_temp.lit('Eva', 'images', :b/4000.jpg') = 0);
select pg_temp.vrai('6 Dan ne voit pas la photo du Vestiaire', pg_temp.lit('Dan', 'images', :b/4000.jpg') = 0);
select pg_temp.vrai('6 un visiteur ne voit rien', pg_temp.nb('anon', 'select count(*) from storage.objects') = 0);
-- 7 · Un message qui pointe le fichier d'un autre n'ouvre rien : ni pour Cyr
--     qui l'écrit, ni pour Bea qui le reçoit.
select pg_temp.vrai('7 Cyr n''ouvre pas le vocal d''Ali par son message', pg_temp.lit('Cyr', 'vocaux', :a/5000.m4a') = 0);
select pg_temp.vrai('7 Bea non plus', pg_temp.lit('Bea', 'vocaux', :a/5000.m4a') = 0);
-- 8 · Le dépôt de l'app (upload, puis lecture de la ligne posée) marche pour
--     un membre ; Dan, au mot de passe d'origine, ne dépose plus rien.
select pg_temp.vrai('8 Ali dépose un vocal',
  pg_temp.en('Ali', format('insert into storage.objects (bucket_id, name, owner) values (''vocaux'', %L, auth.uid()) returning name',
                           'f0000000-0000-0000-0000-0000000000a1/7000.m4a')) like '%/7000.m4a');
select pg_temp.vrai('8 Dan ne dépose plus',
  pg_temp.en('Dan', format('insert into storage.objects (bucket_id, name, owner) values (''images'', %L, auth.uid()) returning name',
                           'f0000000-0000-0000-0000-0000000000d4/7001.jpg')) like 'refus %');
-- 9 · Le message retiré, la pièce ne s'ouvre plus que pour son auteur.
select pg_temp.vrai('9 Ali retire le privé au vocal',
  pg_temp.nb('Ali', format('with x as (delete from public.messages where auteur = auth.uid() and piece ->> ''chemin'' = %L returning 1) select count(*) from x',
                           'f0000000-0000-0000-0000-0000000000a1/1000.m4a')) = 1);
select pg_temp.vrai('9 Bea n''ouvre plus le vocal', pg_temp.lit('Bea', 'vocaux', :a/1000.m4a') = 0);
select pg_temp.vrai('9 Ali l''ouvre encore', pg_temp.lit('Ali', 'vocaux', :a/1000.m4a') = 1);
-- 10 · Les règles en place : les anciennes (« toute la ligue ») ont disparu.
select pg_temp.vrai('10 règles de lecture des pièces',
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd = 'SELECT'
      and policyname in ('vocaux: l''auteur et qui lit le message', 'images: l''auteur et qui lit le message')) = 2
  and not exists (select 1 from pg_policies where schemaname = 'storage' and policyname in ('vocaux: la ligue écoute', 'images: la ligue regarde')));
-- 11 · La pièce se retrouve par l'index sur son chemin.
create function pg_temp.plan(requete text) returns text language plpgsql as $$
declare l text; tout text := '';
begin
  for l in execute 'explain ' || requete loop tout := tout || l || E'\n'; end loop;
  return tout;
end; $$;
set local enable_seqscan = off;
select pg_temp.vrai('11 index messages_piece_chemin_idx',
  pg_temp.plan('select 1 from public.messages m where m.piece ->> ''chemin'' = ''x/1.m4a''') like '%messages_piece_chemin_idx%',
  pg_temp.plan('select 1 from public.messages m where m.piece ->> ''chemin'' = ''x/1.m4a'''));
reset enable_seqscan;

-- ═══ T1.2 · le mot de passe d'origine ═══
-- 12 · Pour la base, Dan n'est pas membre et Ora n'est pas admin ; Ada l'est.
select pg_temp.vrai('12 Dan n''est pas membre', pg_temp.en('Dan', 'select public.est_membre()::text') = 'false');
select pg_temp.vrai('12 Cyr est membre', pg_temp.en('Cyr', 'select public.est_membre()::text') = 'true');
select pg_temp.vrai('12 Ora n''est ni admin ni membre', pg_temp.en('Ora', 'select (public.is_league_admin() or public.est_membre())::text') = 'false');
select pg_temp.vrai('12 Ada est admin', pg_temp.en('Ada', 'select (public.is_league_admin() and public.est_membre())::text') = 'true');
select pg_temp.vrai('12 un visiteur n''appelle pas est_membre', pg_temp.en('anon', 'select public.est_membre()::text') like 'refus %');
-- 13 · Partout, Dan ne voit jamais plus que ce que voit un compte en attente
--     (ni membre ni admin) : rien de ce qu'un membre lit. Même chose pour
--     Ora. Il voit même moins : un compte en attente inscrit à un match le
--     voit, Dan non (voit_match, 17). Seule ligne en plus, par construction :
--     sa ligne à changer (15).
create temp table vu (qui text, etat text, t text, n bigint);
insert into vu select 'Cyr', 'membre', t, n from pg_temp.vues('Cyr');
insert into vu select 'Dan', 'ligne', t, n from pg_temp.vues('Dan');
insert into vu select 'Ora', 'ligne', t, n from pg_temp.vues('Ora');
insert into vu select 'Ada', 'admin', t, n from pg_temp.vues('Ada');
-- Les mêmes, sans ligne mais en attente (Ora sans son rôle d'admin), puis remis.
delete from public.mot_de_passe_a_changer where user_id in (select id from banc where nom in ('Dan', 'Ora'));
update public.profiles set valide = false, is_admin = false where id in (select id from banc where nom in ('Dan', 'Ora'));
insert into vu select 'Dan', 'attente', t, n from pg_temp.vues('Dan');
insert into vu select 'Ora', 'attente', t, n from pg_temp.vues('Ora');
update public.profiles set valide = true where id in (select id from banc where nom in ('Dan', 'Ora'));
update public.profiles set is_admin = true where id = (select id from banc where nom = 'Ora');
insert into public.mot_de_passe_a_changer (user_id, motif) select id, 'origine' from banc where nom in ('Dan', 'Ora');
select pg_temp.vrai('13 Dan ne voit jamais plus qu''un compte en attente, table par table',
  not exists (select 1 from vu l join vu a using (t) where l.qui = 'Dan' and l.etat = 'ligne' and a.qui = 'Dan' and a.etat = 'attente' and l.n > a.n and t <> 'public.mot_de_passe_a_changer'),
  (select string_agg(l.t || ' ' || l.n || '>' || a.n, ', ') from vu l join vu a using (t)
    where l.qui = 'Dan' and l.etat = 'ligne' and a.qui = 'Dan' and a.etat = 'attente' and l.n > a.n and t <> 'public.mot_de_passe_a_changer'));
select pg_temp.vrai('13 Ora ne voit jamais plus qu''un compte en attente, table par table',
  not exists (select 1 from vu l join vu a using (t) where l.qui = 'Ora' and l.etat = 'ligne' and a.qui = 'Ora' and a.etat = 'attente' and l.n > a.n and t <> 'public.mot_de_passe_a_changer'),
  (select string_agg(l.t || ' ' || l.n || '>' || a.n, ', ') from vu l join vu a using (t)
    where l.qui = 'Ora' and l.etat = 'ligne' and a.qui = 'Ora' and a.etat = 'attente' and l.n > a.n and t <> 'public.mot_de_passe_a_changer'));
-- Le banc n'est pas vide : un membre, et plus encore l'admin, voient bien plus que Dan.
select pg_temp.vrai('13 Cyr voit plus que Dan dans au moins 6 tables',
  (select count(*) from vu m join vu d using (t) where m.qui = 'Cyr' and d.qui = 'Dan' and d.etat = 'ligne' and m.n > d.n) >= 6,
  (select string_agg(m.t, ', ') from vu m join vu d using (t) where m.qui = 'Cyr' and d.qui = 'Dan' and d.etat = 'ligne' and m.n > d.n));
select pg_temp.vrai('13 Ada voit plus que Cyr dans au moins 3 tables',
  (select count(*) from vu a join vu m using (t) where a.qui = 'Ada' and m.qui = 'Cyr' and a.n > m.n) >= 3,
  (select string_agg(a.t, ', ') from vu a join vu m using (t) where a.qui = 'Ada' and m.qui = 'Cyr' and a.n > m.n));
select pg_temp.vrai('13 Dan : 0 ligne de la saison, des votes, du Vestiaire, du match',
  pg_temp.nb('Dan', 'select (select count(*) from public.saison) + (select count(*) from public.votes_figures)
                          + (select count(*) from public.messages where canal in (''sfl'', ''match''))') = 0);
select pg_temp.vrai('13 Dan ne voit des profils que le sien', pg_temp.nb('Dan', 'select count(*) from public.profiles') = 1);
select pg_temp.vrai('13 Dan ne voit pas son match ni ses joueurs ; en attente, il les voyait',
  (select l.n + l2.n = 0 and a.n > 0 and a2.n > 0
     from vu l, vu l2, vu a, vu a2
    where l.qui = 'Dan' and l.etat = 'ligne' and l.t = 'public.matchs'
      and l2.qui = 'Dan' and l2.etat = 'ligne' and l2.t = 'public.match_joueurs'
      and a.qui = 'Dan' and a.etat = 'attente' and a.t = 'public.matchs'
      and a2.qui = 'Dan' and a2.etat = 'attente' and a2.t = 'public.match_joueurs'));
-- Ce qui reste à Dan est à lui : sa fiche, ses privés, ses fichiers (voir le compte rendu).
select pg_temp.vrai('13 Dan garde son fichier', pg_temp.lit('Dan', 'images', 'f0000000-0000-0000-0000-0000000000d4/6000.jpg') = 1);
-- 14 · L'admin qui n'a pas changé son mot de passe ne fait plus rien d'admin.
select pg_temp.vrai('14 Ora ne valide personne',
  pg_temp.en('Ora', format('select public.valider_inscription(%L)::text', 'f0000000-0000-0000-0000-0000000000e5')) like 'refus %');
select pg_temp.vrai('14 Ora ne lit que sa propre ligne', pg_temp.nb('Ora', 'select count(*) from public.mot_de_passe_a_changer') = 1);
select pg_temp.vrai('14 Ada valide', pg_temp.en('Ada', format('select public.valider_inscription(%L)::text', 'f0000000-0000-0000-0000-0000000000e5')) = 'true');
select pg_temp.vrai('14 Ada lit toutes les lignes à changer',
  pg_temp.nb('Ada', 'select count(*) from public.mot_de_passe_a_changer') = (select count(*) from public.mot_de_passe_a_changer));
-- 15 · L'écran « Nouveau mot de passe » : Dan lit sa ligne et son profil
--      (session.ts : motDePasseAChanger, signIn, estValide)…
select pg_temp.vrai('15 Dan lit sa ligne',
  pg_temp.en('Dan', 'select motif from public.mot_de_passe_a_changer where user_id = auth.uid()') = 'origine');
select pg_temp.vrai('15 Dan lit son profil',
  pg_temp.en('Dan', 'select name || '' '' || is_admin || '' '' || valide from public.profiles where id = auth.uid()') = 'Dan false true');
select pg_temp.vrai('15 Dan n''efface pas sa ligne lui-même',
  pg_temp.en('Dan', 'with x as (delete from public.mot_de_passe_a_changer where user_id = auth.uid() returning 1) select count(*)::text from x') in ('0', 'refus permission denied for table mot_de_passe_a_changer'));
-- … puis change son mot de passe : Supabase Auth réécrit auth.users, le
-- trigger efface la ligne, et la ligue s'ouvre à lui.
update auth.users set encrypted_password = 'autre-empreinte-inventee' where id = (select id from banc where nom = 'Dan');
select pg_temp.vrai('15 la ligne de Dan est effacée',
  not exists (select 1 from public.mot_de_passe_a_changer where user_id = (select id from banc where nom = 'Dan')));
select pg_temp.vrai('15 Dan est membre', pg_temp.en('Dan', 'select public.est_membre()::text') = 'true');
select pg_temp.vrai('15 Dan lit la saison et le Vestiaire',
  pg_temp.nb('Dan', 'select count(*) from public.saison') = 1 and pg_temp.lit('Dan', 'images', :b/4000.jpg') = 1);
-- Même chose pour Ora, qui redevient admin.
update auth.users set encrypted_password = 'autre-empreinte-inventee' where id = (select id from banc where nom = 'Ora');
select pg_temp.vrai('15 Ora redevient admin', pg_temp.en('Ora', 'select public.is_league_admin()::text') = 'true');

-- ═══ T17 · les droits de table ═══
-- 16 · Ni anon ni authenticated n'ont TRUNCATE, TRIGGER ou REFERENCES sur une table de public.
select pg_temp.vrai('16 aucun TRUNCATE, TRIGGER, REFERENCES pour anon et authenticated',
  not exists (
    select 1 from pg_class c join pg_namespace s on s.oid = c.relnamespace, unnest(array['anon', 'authenticated']) r
     where s.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
       and (has_table_privilege(r, c.oid, 'TRUNCATE') or has_table_privilege(r, c.oid, 'TRIGGER')
            or has_table_privilege(r, c.oid, 'REFERENCES'))),
  (select string_agg(c.relname, ', ') from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relkind = 'r' and has_table_privilege('anon', c.oid, 'TRUNCATE')));
select pg_temp.vrai('16 un visiteur ne vide pas les votes', pg_temp.fait('anon', 'truncate public.votes_figures') like 'refus permission denied%');
select pg_temp.vrai('16 un joueur ne vide pas les messages', pg_temp.fait('Cyr', 'truncate public.messages') like 'refus permission denied%');
select pg_temp.vrai('16 les votes sont toujours là', (select count(*) from public.votes_figures where saison = 77) = 1);
-- Les autres droits restent : lecture, écriture par la RLS.
select pg_temp.vrai('16 les droits de lecture et d''écriture restent',
  has_table_privilege('authenticated', 'public.profiles', 'SELECT')
  and has_table_privilege('authenticated', 'public.messages', 'INSERT')
  and has_table_privilege('authenticated', 'public.messages', 'DELETE')
  and has_table_privilege('authenticated', 'public.agent_messages', 'INSERT'));
-- Sans REFERENCES ni TRIGGER, une clé étrangère se vérifie et un trigger se
-- déclenche : une réaction (clé vers messages) et une question au coach
-- (trigger du crédit) passent.
select pg_temp.vrai('16 Bea réagit au privé (clé étrangère)',
  pg_temp.nb('Bea', format('with x as (insert into public.message_reactions (message_id, emoji) select id, %L from public.messages
                             where piece ->> ''chemin'' = %L returning 1) select count(*) from x',
                           '🔥', 'f0000000-0000-0000-0000-0000000000a1/1001.jpg')) = 1);
select pg_temp.vrai('16 Ali pose une question au coach (trigger du crédit)',
  pg_temp.nb('Ali', 'with x as (insert into public.agent_messages (role, texte) values (''joueur'', ''Question du banc'') returning 1) select count(*) from x') = 1);

-- ═══ T1.2 · ce qui ne passait pas par est_membre (contrôle du 03/11) ═══
-- 17 · Ali, organisateur du match 99001 et capitaine de l'équipe 99701, puis
--      Bea (inscrite au match) et Eva (de l'équipe), reçoivent une ligne :
--      leur session ne change plus rien, ni par une fonction, ni par une
--      règle, ni dans les seaux. Chaque essai est annulé aussitôt (essai,
--      ci-dessous) : sur un schéma qui laisserait passer, un geste réussi ne
--      fausse pas les suivants. Chaque refus a son témoin : le même geste,
--      sans la ligne, passe.
create function pg_temp.essai(qui text, requete text) returns text language plpgsql as $$
declare r text; uid uuid;
begin
  select id into uid from banc where nom = qui;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
    set local role authenticated;
    execute requete into r;
    raise exception using errcode = 'P0099', message = coalesce(r, 'null');
  exception when others then
    reset role;
    perform set_config('request.jwt.claims', '', true);
    if sqlstate = 'P0099' then return sqlerrm; end if;
    return 'refus ' || sqlerrm;
  end;
end; $$;
insert into public.push_abonnements (endpoint, user_id, p256dh, auth)
values ('https://fcm.googleapis.com/fcm/send/banc-ali', :a', 'cle-inventee', 'auth-inventee');
update public.matchs set jour = current_date - 1 where id = 99001;
insert into public.match_joueurs (match_id, player_id, statut) values (99001, 'f0000000-0000-0000-0000-0000000000c3', 'invite');
update public.profiles set arbitre = true where id = :a';
insert into public.mot_de_passe_a_changer (user_id, motif) select id, 'origine' from banc where nom in ('Ali', 'Bea', 'Eva');
-- Les notifications (elles portent le texte des messages).
select pg_temp.vrai('17 Ali n''abonne pas un téléphone',
  pg_temp.essai('Ali', format('with x as (insert into public.push_abonnements (endpoint, user_id, p256dh, auth) values (%L, %L, %L, %L) returning 1) select count(*)::text from x',
    'https://fcm.googleapis.com/fcm/send/banc-ali-2', 'f0000000-0000-0000-0000-0000000000a1', 'k', 'a')) like 'refus new row violates row-level security%');
select pg_temp.vrai('17 Ali ne réécrit pas son abonnement',
  pg_temp.essai('Ali', 'with x as (update public.push_abonnements set p256dh = ''autre'' where user_id = auth.uid() returning 1) select count(*)::text from x') like 'refus new row violates row-level security%');
select pg_temp.vrai('17 témoin : Cyr abonne un téléphone',
  pg_temp.essai('Cyr', format('with x as (insert into public.push_abonnements (endpoint, user_id, p256dh, auth) values (%L, %L, %L, %L) returning 1) select count(*)::text from x',
    'https://fcm.googleapis.com/fcm/send/banc-cyr', 'f0000000-0000-0000-0000-0000000000c3', 'k', 'a')) = '1');
-- L'équipe : plus de rôle, donc plus aucune fonction de capitaine.
select pg_temp.vrai('17 Ali n''a plus de rôle dans son équipe', pg_temp.essai('Ali', 'select public.role_equipe(99701)') = 'null');
select pg_temp.vrai('17 Ali ne nomme pas de vice',
  pg_temp.essai('Ali', format('select public.equipe_vice(99701, %L)::text', 'f0000000-0000-0000-0000-0000000000e5')) like 'refus %');
select pg_temp.vrai('17 Ali ne tire pas de lien d''invitation', pg_temp.essai('Ali', 'select public.equipe_lien(99701)') like 'refus %');
select pg_temp.vrai('17 Ali n''invite pas',
  pg_temp.essai('Ali', format('select public.equipe_inviter(99701, %L)::text', 'f0000000-0000-0000-0000-0000000000c3')) like 'refus %');
select pg_temp.vrai('17 Ali n''exclut pas',
  pg_temp.essai('Ali', format('select public.equipe_exclure(99701, %L)::text', 'f0000000-0000-0000-0000-0000000000e5')) like 'refus %');
select pg_temp.vrai('17 Ali ne dissout pas', pg_temp.essai('Ali', 'select public.equipe_dissoudre(99701)::text') like 'refus %');
select pg_temp.vrai('17 Ali ne pose pas de couverture',
  pg_temp.essai('Ali', 'with x as (insert into storage.objects (bucket_id, name, owner) values (''couvertures'', ''99701.jpg'', auth.uid()) returning 1) select count(*)::text from x') like 'refus %');
select pg_temp.vrai('17 Eva ne signe pas la charte', pg_temp.essai('Eva', 'select public.equipe_signer_charte(99701)::text') like 'refus %');
-- Le match : ni le match, ni ses joueurs, ni sa feuille.
select pg_temp.vrai('17 Ali ne voit plus son match', pg_temp.essai('Ali', 'select count(*)::text from public.matchs where id = 99001') = '0');
select pg_temp.vrai('17 Ali ne change pas le lieu',
  pg_temp.essai('Ali', 'with x as (update public.matchs set lieu = ''ailleurs'' where id = 99001 returning 1) select count(*)::text from x') = '0');
select pg_temp.vrai('17 Ali n''annule pas',
  pg_temp.essai('Ali', 'with x as (delete from public.matchs where id = 99001 returning 1) select count(*)::text from x') = '0');
select pg_temp.vrai('17 Ali n''inscrit personne',
  pg_temp.essai('Ali', format('with x as (insert into public.match_joueurs (match_id, player_id, statut) values (99001, %L, ''invite'') returning 1) select count(*)::text from x',
    'f0000000-0000-0000-0000-0000000000a0')) like 'refus %');
select pg_temp.vrai('17 Ali ne sort personne',
  pg_temp.essai('Ali', 'with x as (delete from public.match_joueurs where match_id = 99001 returning 1) select count(*)::text from x') = '0');
select pg_temp.vrai('17 Ali ne fait pas la feuille',
  pg_temp.essai('Ali', format('select public.enregistrer_feuille_bola(99001, 3, 1, %L::jsonb)::text',
    '[{"playerId":"f0000000-0000-0000-0000-0000000000d4","equipe":"clairs","buts":3},{"playerId":"f0000000-0000-0000-0000-0000000000b2","equipe":"fonces","buts":1},{"playerId":"f0000000-0000-0000-0000-0000000000c3","equipe":"absent"}]'))
  like 'refus feuille réservée%');
select pg_temp.vrai('17 Bea ne voit plus le match', pg_temp.essai('Bea', 'select count(*)::text from public.match_joueurs where match_id = 99001') = '0');
select pg_temp.vrai('17 Bea ne touche pas sa ligne du match',
  pg_temp.essai('Bea', 'with x as (update public.match_joueurs set statut = statut where match_id = 99001 and player_id = auth.uid() returning 1) select count(*)::text from x') = '0');
-- La feuille SFL en direct et les missions d'arbitre : refusées dès l'identité.
select pg_temp.vrai('17 Ali ne prend pas la feuille en direct',
  pg_temp.essai('Ali', 'select public.prendre_feuille(1, ''Noirs 1'', ''Blancs 1'')::text') = 'refus Réservé aux joueurs de la ligue.');
select pg_temp.vrai('17 Ali ne compte rien sur la feuille en direct',
  pg_temp.essai('Ali', 'select public.compter_feuille(1, ''Noirs 1'', ''Blancs 1'', ''[]''::jsonb)::text') = 'refus Réservé aux joueurs de la ligue.');
select pg_temp.vrai('17 Ali ne scelle pas la feuille en direct',
  pg_temp.essai('Ali', 'select public.sceller_feuille(1, ''Noirs 1'', ''Blancs 1'')::text') = 'refus Réservé aux joueurs de la ligue.');
select pg_temp.vrai('17 Ali, arbitre, ne répond pas à une mission',
  pg_temp.essai('Ali', 'select public.repondre_mission_arbitre(77, 1, ''m1'', ''fait'')::text') = 'refus Réservé aux arbitres.');
-- Les témoins : la ligne effacée (comme par le trigger), tout repasse.
delete from public.mot_de_passe_a_changer where user_id in (select id from banc where nom in ('Ali', 'Bea', 'Eva'));
select pg_temp.vrai('17 témoin : Ali a son rôle', pg_temp.en('Ali', 'select public.role_equipe(99701)') = 'capitaine');
select pg_temp.vrai('17 témoin : Ali tire un lien', pg_temp.essai('Ali', 'select public.equipe_lien(99701)') not like 'refus %');
select pg_temp.vrai('17 témoin : Ali nomme un vice',
  pg_temp.essai('Ali', format('select public.equipe_vice(99701, %L)::text', 'f0000000-0000-0000-0000-0000000000e5')) not like 'refus %');
select pg_temp.vrai('17 témoin : Ali voit son match', pg_temp.essai('Ali', 'select count(*)::text from public.matchs where id = 99001') = '1');
select pg_temp.vrai('17 témoin : Ali sort un joueur',
  pg_temp.essai('Ali', format('with x as (delete from public.match_joueurs where match_id = 99001 and player_id = %L returning 1) select count(*)::text from x',
    'f0000000-0000-0000-0000-0000000000c3')) = '1');
select pg_temp.vrai('17 témoin : Bea voit le match', pg_temp.essai('Bea', 'select count(*)::text from public.match_joueurs where match_id = 99001') = '3');
select pg_temp.vrai('17 témoin : Bea touche sa ligne du match',
  pg_temp.essai('Bea', 'with x as (update public.match_joueurs set statut = statut where match_id = 99001 and player_id = auth.uid() returning 1) select count(*)::text from x') = '1');
select pg_temp.vrai('17 témoin : Eva signe la charte', pg_temp.en('Eva', 'select public.equipe_signer_charte(99701)::text') not like 'refus %');
select pg_temp.vrai('17 témoin : Ali change le lieu',
  pg_temp.nb('Ali', 'with x as (update public.matchs set lieu = ''Terrain du banc'' where id = 99001 returning 1) select count(*) from x') = 1);
select pg_temp.vrai('17 témoin : Ali fait la feuille',
  pg_temp.en('Ali', format('select public.enregistrer_feuille_bola(99001, 3, 1, %L::jsonb)::text',
    '[{"playerId":"f0000000-0000-0000-0000-0000000000d4","equipe":"clairs","buts":3},{"playerId":"f0000000-0000-0000-0000-0000000000b2","equipe":"fonces","buts":1},{"playerId":"f0000000-0000-0000-0000-0000000000c3","equipe":"absent"}]'))
  = '1');
select pg_temp.vrai('17 témoin : Ali passe la garde de la feuille en direct',
  pg_temp.en('Ali', 'select public.prendre_feuille(1, ''Noirs 1'', ''Blancs 1'')::text') <> 'refus Réservé aux joueurs de la ligue.');
select pg_temp.vrai('17 témoin : Ali, arbitre, passe la garde des missions',
  pg_temp.en('Ali', 'select public.repondre_mission_arbitre(77, 1, ''m1'', ''fait'')::text') <> 'refus Réservé aux arbitres.');
-- Confirmer un résultat : Bea est sur la feuille ; avec une ligne, non.
insert into public.mot_de_passe_a_changer (user_id, motif) select id, 'origine' from banc where nom = 'Bea';
select pg_temp.vrai('17 Bea ne confirme pas le résultat',
  pg_temp.essai('Bea', 'select public.repondre_resultat(99001, 1, ''confirme'')') = 'refus pas sur la feuille');
delete from public.mot_de_passe_a_changer where user_id = :b';
select pg_temp.vrai('17 témoin : Bea confirme le résultat',
  pg_temp.en('Bea', 'select public.repondre_resultat(99001, 1, ''confirme'')') not like 'refus %');

-- ═══ T2 · le coût de la règle des seaux (contrôle du 03/11) ═══
-- 18 · Les messages qui portent un fichier se trouvent par l'index, puis se
--      relisent par leur clé sous leurs règles : jamais de lecture de toute
--      la table messages à chaque lien signé (seqscan interdit : s'il n'y a
--      pas d'autre chemin, le plan le dit quand même).
create function pg_temp.plan_de(qui text, requete text) returns text language plpgsql as $$
declare l text; tout text := ''; uid uuid;
begin
  select id into uid from banc where nom = qui;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  for l in execute 'explain ' || requete loop tout := tout || l || E'\n'; end loop;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return tout;
end; $$;
set local enable_seqscan = off;
select pg_temp.vrai('18 un lien signé relit les messages par leur clé, jamais toute la table',
  pg_temp.plan_de('Cyr', format('select 1 from storage.objects where bucket_id = ''images'' and name = %L', 'f0000000-0000-0000-0000-0000000000b2/4000.jpg'))
    ~ 'Index Cond: \(id = ANY'
  and pg_temp.plan_de('Cyr', format('select 1 from storage.objects where bucket_id = ''images'' and name = %L', 'f0000000-0000-0000-0000-0000000000b2/4000.jpg'))
    !~ 'Seq Scan on messages',
  pg_temp.plan_de('Cyr', format('select 1 from storage.objects where bucket_id = ''images'' and name = %L', 'f0000000-0000-0000-0000-0000000000b2/4000.jpg')));
reset enable_seqscan;
select pg_temp.vrai('18 messages_de_piece : le message de l''auteur, pas celui qui pointe son fichier',
  cardinality(public.messages_de_piece('f0000000-0000-0000-0000-0000000000a1/1001.jpg')) = 1
  and cardinality(public.messages_de_piece('f0000000-0000-0000-0000-0000000000a1/5000.m4a')) = 0
  and cardinality(public.messages_de_piece('sans-dossier')) = 0);
select pg_temp.vrai('18 un visiteur n''appelle pas messages_de_piece',
  pg_temp.en('anon', 'select cardinality(public.messages_de_piece(''x/1.m4a''))::text') like 'refus %');

rollback;
