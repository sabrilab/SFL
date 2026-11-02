-- Vérification de la mise en base de novembre 2026 (adm-ui : feuille de match
-- prise par un joueur, cartons, révélation à 19 h, Passe, Pack Afrique en XP S).
--
-- À coller dans l'éditeur SQL de Supabase (Run) juste après avoir joué
-- supabase/schema.sql, ou après le déploiement (le prébuild l'applique).
-- Une ligne par objet attendu, « ok » ou « MANQUE », puis le total : tout doit
-- être « ok ». Sur une base pas encore migrée, les objets nouveaux sortent en
-- « MANQUE » ; ce qui existait déjà (déclencheurs des matchs) reste « ok ».
--
-- LECTURE SEULE : une seule requête SELECT, sur le catalogue de Postgres
-- seulement (pg_class, pg_attribute, pg_constraint, pg_proc, pg_trigger,
-- pg_policies, pg_publication_tables, droits). Aucune table de la ligue n'est
-- lue : ni profils, ni saison, ni votes, ni achats, aucune donnée personnelle.
-- Elle passe aussi sous un rôle sans aucun droit sur public, et dans une
-- transaction en lecture seule (vérifié le 02/11/2026 sur Postgres 16).
--
-- Rien n'est écrit ici que supabase/schema.sql ne dise : la liste suit
-- l'inventaire de la fusion (feuilles_direct 922f4c1/a3e794a, cartons 07efb61,
-- révélation 648b433/655084c, XP 5fb3e63/b06bd93/a4af3f0). Une ligne MANQUE
-- dit quoi chercher dans schema.sql ; rejouer le fichier entier la répare.
with
-- Les tables nouvelles, avec leur RLS.
tables_(objet) as (values
  ('public.feuilles_direct'), ('public.fins_des_matchs'), ('public.passe_acquis'), ('public.achats_xp')
),
-- Les colonnes : type, non nul, défaut (null : pas de défaut contrôlé).
colonnes(tab, col, typ, non_nul, defaut) as (values
  ('public.feuilles_direct', 'saison', 'integer', true, null),
  ('public.feuilles_direct', 'j', 'integer', true, null),
  ('public.feuilles_direct', 'noirs', 'text', true, null),
  ('public.feuilles_direct', 'blancs', 'text', true, null),
  ('public.feuilles_direct', 'preneur', 'uuid', false, null),
  ('public.feuilles_direct', 'preneur_nom', 'text', false, null),
  ('public.feuilles_direct', 'pris_le', 'timestamp with time zone', false, null),
  ('public.feuilles_direct', 'debut', 'timestamp with time zone', true, 'now()'),
  ('public.feuilles_direct', 'fin', 'timestamp with time zone', false, null),
  ('public.feuilles_direct', 'scelle_par', 'uuid', false, null),
  ('public.feuilles_direct', 'version', 'bigint', false, null),
  ('public.feuilles_direct', 'compteurs', 'jsonb', true, '''{}''::jsonb'),
  ('public.feuilles_direct', 'journal', 'jsonb', true, '''[]''::jsonb'),
  ('public.feuilles_direct', 'maj_le', 'timestamp with time zone', true, 'now()'),
  ('public.fins_des_matchs', 'saison', 'integer', true, null),
  ('public.fins_des_matchs', 'j', 'integer', true, null),
  ('public.fins_des_matchs', 'jour', 'date', true, null),
  ('public.fins_des_matchs', 'fin', 'timestamp with time zone', true, null),
  ('public.fins_des_matchs', 'pose_le', 'timestamp with time zone', true, 'now()'),
  ('public.passe_acquis', 'joueur', 'uuid', true, null),
  ('public.passe_acquis', 'saison_passe', 'text', true, null),
  ('public.passe_acquis', 'palier', 'integer', true, null),
  ('public.passe_acquis', 'xp_saison', 'integer', true, '0'),
  ('public.passe_acquis', 'calcule_le', 'timestamp with time zone', true, 'now()'),
  ('public.achats_xp', 'id', 'bigint', true, null),
  ('public.achats_xp', 'joueur', 'uuid', true, null),
  ('public.achats_xp', 'article', 'text', true, null),
  ('public.achats_xp', 'obtenu', 'text', true, null),
  ('public.achats_xp', 'monnaie', 'text', true, '''xp''::text'),
  ('public.achats_xp', 'xp', 'integer', true, null),
  ('public.achats_xp', 'serie', 'integer', true, null),
  ('public.achats_xp', 'cle', 'uuid', true, null),
  ('public.achats_xp', 'le', 'timestamp with time zone', true, 'now()'),
  ('public.profiles', 'cartons_vus', 'text[]', true, '''{}''::text[]')
),
-- Les contraintes : leur sorte (p, f, u, c) et ce que leur définition doit dire.
contraintes(tab, nom, sorte, motifs) as (values
  ('public.feuilles_direct', 'feuilles_direct_pkey', 'p', array['(saison, j, noirs, blancs)']),
  ('public.feuilles_direct', 'feuilles_direct_preneur_fkey', 'f', array['(preneur)', 'profiles(id)', 'ON DELETE SET NULL']),
  ('public.feuilles_direct', 'feuilles_direct_scelle_par_fkey', 'f', array['(scelle_par)', 'profiles(id)', 'ON DELETE SET NULL']),
  ('public.fins_des_matchs', 'fins_des_matchs_pkey', 'p', array['(saison, j)']),
  ('public.passe_acquis', 'passe_acquis_pkey', 'p', array['(joueur, saison_passe)']),
  ('public.passe_acquis', 'passe_acquis_joueur_fkey', 'f', array['(joueur)', 'profiles(id)', 'ON DELETE CASCADE']),
  ('public.passe_acquis', 'passe_acquis_saison_passe_check', 'c', array['saison_passe', '^[a-z0-9-]{1,24}$']),
  ('public.passe_acquis', 'passe_acquis_palier_check', 'c', array['palier >= 1', 'palier <= 100']),
  ('public.passe_acquis', 'passe_acquis_xp_saison_check', 'c', array['xp_saison >= 0']),
  ('public.achats_xp', 'achats_xp_pkey', 'p', array['(id)']),
  ('public.achats_xp', 'achats_xp_joueur_fkey', 'f', array['(joueur)', 'profiles(id)', 'ON DELETE CASCADE']),
  ('public.achats_xp', 'achats_xp_une_fois', 'u', array['(joueur, cle)']),
  ('public.achats_xp', 'achats_xp_sans_doublon', 'u', array['(joueur, article, obtenu)']),
  ('public.achats_xp', 'achats_xp_serie', 'u', array['(article, obtenu, serie)']),
  ('public.achats_xp', 'achats_xp_article_check', 'c', array['^pack-[a-z0-9-]{1,40}$']),
  ('public.achats_xp', 'achats_xp_obtenu_check', 'c', array['^[a-z]{2}$']),
  ('public.achats_xp', 'achats_xp_xp_check', 'c', array['xp >= 1', 'xp <= 100000']),
  ('public.achats_xp', 'achats_xp_serie_check', 'c', array['serie >= 1']),
  ('public.achats_xp', 'achats_xp_monnaie', 'c', array['''xp''', '''xp-s''']),
  ('public.achats_xp', 'achats_xp_afrique_en_xps', 'c', array['pack-afrique-2027', '''xp-s''']),
  ('public.profiles', 'profiles_habillage_check', 'c', array['bois-brule', 'nuit-polaire', 'aurore-polaire', 'jarl', 'afrique-[a-z]{2}', 'lisere-fer', 'nom-runes'])
),
index_(nom, tab) as (values
  ('public.feuilles_direct_preneur', 'public.feuilles_direct'),
  ('public.feuilles_direct_scelle_par', 'public.feuilles_direct'),
  ('public.achats_xp_joueur', 'public.achats_xp')
),
-- Les fonctions nouvelles et qui peut les exécuter :
--   authenticated · les joueurs connectés, jamais anon ;
--   interne       · ni anon ni authenticated (appelée par d'autres fonctions) ;
--   service_role  · la clé secrète du serveur seule.
fonctions(sig, regle) as (values
  ('public.appliquer_feuille(jsonb,integer,text,text,jsonb)', 'interne'),
  ('public.chiffres_du_match(jsonb,integer,text,text)', 'interne'),
  ('public.compter_feuille(integer,text,text,jsonb)', 'authenticated'),
  ('public.compteurs_du_document(jsonb,integer,text,text)', 'interne'),
  ('public.droit_feuille(jsonb,integer,text,text,text,timestamp with time zone)', 'interne'),
  ('public.feuille_admin(integer,text,text,text)', 'authenticated'),
  ('public.feuille_hors_jeu(jsonb,integer,text,text)', 'interne'),
  ('public.feuilles_ecrasees(jsonb,jsonb,bigint,boolean)', 'authenticated'),
  ('public.joue_le_match(jsonb,integer,text,text,text)', 'interne'),
  ('public.lignes_du_match(jsonb,integer,text,text)', 'interne'),
  ('public.passer_feuille(integer,text,text,text)', 'authenticated'),
  ('public.prendre_feuille(integer,text,text)', 'authenticated'),
  ('public.sceller_feuille(integer,text,text)', 'authenticated'),
  ('public.fin_du_vote(integer,integer)', 'authenticated'),
  ('public.vote_ouvert(integer,integer)', 'authenticated'),
  ('public.fin_du_vote_a(integer,integer,timestamp with time zone)', 'interne'),
  ('public.vote_ouvert_a(integer,integer,timestamp with time zone)', 'interne'),
  ('public.journee_terminee(jsonb,integer)', 'interne'),
  ('public.saison_fin_des_matchs()', 'interne'),
  ('public.nouveau_regime(integer,integer)', 'interne'),
  ('public.fin_du_vote_de(date,timestamp with time zone)', 'interne'),
  ('public.revelation_de(date,timestamp with time zone)', 'interne'),
  ('public.dates_illisibles(jsonb,jsonb)', 'interne'),
  ('public.poser_paliers_acquis(jsonb)', 'service_role'),
  ('public.mes_achats_xp()', 'authenticated'),
  ('public.ouvrir_pack_xp(uuid,text,text,integer,integer,text[],uuid)', 'service_role')
),
-- Les fonctions modifiées : ce que leur nouveau corps contient.
modifiees(sig, motifs, quoi) as (values
  ('public.feuille_saine(jsonb,jsonb)', array['I10 vue figée', 'dates_illisibles'], 'I10 vue figée, I11 date illisible'),
  ('public.publier_saison(jsonb,integer,bigint,boolean)', array['feuilles_ecrasees', 'feuille-tenue', '''fins'''], 'refuse une feuille tenue, rend fins'),
  ('public.match_bola_json(bigint)', array['''saisiLe'''], 'rend saisiLe'),
  ('public.match_feuille_gardee()', array['match déjà passé'], 'pas redaté à plus de 24 h dans le passé'),
  ('public.match_naissance_gardee()', array['match déjà passé'], 'ne naît pas à plus de 24 h dans le passé'),
  ('public.pronostiquer(integer,integer,text,text)', array['Saison close.'], 'Saison close. hors de la saison en cours')
),
declencheurs(tab, nom, fonction, motifs) as (values
  ('public.saison', 'saison_fin_des_matchs', 'public.saison_fin_des_matchs()', array['BEFORE INSERT OR UPDATE OF data ON', 'FOR EACH ROW']),
  ('public.matchs', 'matchs_feuille', 'public.match_feuille_gardee()', array['BEFORE UPDATE ON', 'FOR EACH ROW']),
  ('public.match_joueurs', 'match_joueurs_feuille', 'public.match_feuille_gardee()', array['BEFORE UPDATE ON', 'FOR EACH ROW']),
  ('public.matchs', 'matchs_naissance', 'public.match_naissance_gardee()', array['BEFORE INSERT ON', 'FOR EACH ROW'])
),
-- Les politiques : la commande, et ce que using / with check doivent appeler.
politiques(tab, nom, cmd, dans_using, dans_check) as (values
  ('feuilles_direct', 'feuilles_direct: lecture ligue', 'SELECT', 'est_membre()', null),
  ('passe_acquis', 'passe_acquis: les membres lisent', 'SELECT', 'est_membre()', null),
  ('achats_xp', 'achats_xp: les membres lisent', 'SELECT', 'est_membre()', null),
  ('votes_figures', 'votes_figures: je vote aujourd''hui', 'INSERT', null, 'vote_ouvert(saison, j)'),
  ('votes_figures', 'votes_figures: je change d''avis aujourd''hui', 'UPDATE', 'vote_ouvert(saison, j)', 'vote_ouvert(saison, j)')
),
-- Les droits sur les tables et colonnes (role, objet, colonne, privilège, attendu).
droits(role_, tab, col, priv, attendu) as (values
  ('authenticated', 'public.feuilles_direct', null, 'SELECT', true),
  ('authenticated', 'public.feuilles_direct', null, 'INSERT', false),
  ('authenticated', 'public.feuilles_direct', null, 'UPDATE', false),
  ('authenticated', 'public.feuilles_direct', null, 'DELETE', false),
  ('authenticated', 'public.fins_des_matchs', null, 'SELECT', false),
  ('anon', 'public.fins_des_matchs', null, 'SELECT', false),
  ('authenticated', 'public.passe_acquis', null, 'SELECT', true),
  ('authenticated', 'public.passe_acquis', null, 'INSERT', false),
  ('authenticated', 'public.passe_acquis', null, 'UPDATE', false),
  ('anon', 'public.passe_acquis', null, 'SELECT', false),
  ('authenticated', 'public.achats_xp', 'id', 'SELECT', true),
  ('authenticated', 'public.achats_xp', 'joueur', 'SELECT', true),
  ('authenticated', 'public.achats_xp', 'article', 'SELECT', true),
  ('authenticated', 'public.achats_xp', 'obtenu', 'SELECT', true),
  ('authenticated', 'public.achats_xp', 'serie', 'SELECT', true),
  ('authenticated', 'public.achats_xp', 'le', 'SELECT', true),
  ('authenticated', 'public.achats_xp', 'xp', 'SELECT', false),
  ('authenticated', 'public.achats_xp', 'monnaie', 'SELECT', false),
  ('authenticated', 'public.achats_xp', 'cle', 'SELECT', false),
  ('authenticated', 'public.achats_xp', null, 'INSERT', false),
  ('authenticated', 'public.achats_xp', null, 'UPDATE', false),
  ('anon', 'public.achats_xp', 'joueur', 'SELECT', false),
  ('authenticated', 'public.profiles', 'cartons_vus', 'UPDATE', true)
),
lignes(rang, genre, objet, attendu, ok) as (
  select 1, 'table', t.objet, 'existe, RLS active',
         coalesce((select c.relkind = 'r' and c.relrowsecurity from pg_class c where c.oid = to_regclass(t.objet)), false)
    from tables_ t
  union all
  select 1, 'séquence', 'public.achats_xp.id', 'identité (generated always)',
         coalesce((select a.attidentity = 'a' from pg_attribute a
                    where a.attrelid = to_regclass('public.achats_xp') and a.attname = 'id' and not a.attisdropped), false)
  union all
  select 2, 'colonne', c.tab || '.' || c.col,
         c.typ || case when c.non_nul then ' not null' else '' end || coalesce(' default ' || c.defaut, ''),
         coalesce((select format_type(a.atttypid, a.atttypmod) = c.typ
                          and a.attnotnull = c.non_nul
                          and (c.defaut is null or pg_get_expr(d.adbin, d.adrelid) = c.defaut)
                     from pg_attribute a
                     left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                    where a.attrelid = to_regclass(c.tab) and a.attname = c.col and a.attnum > 0 and not a.attisdropped), false)
    from colonnes c
  union all
  select 3, 'contrainte', k.tab || '.' || k.nom, array_to_string(k.motifs, ' · '),
         coalesce((select x.contype::text = k.sorte
                          and (select bool_and(strpos(pg_get_constraintdef(x.oid), m) > 0) from unnest(k.motifs) m)
                     from pg_constraint x
                    where x.conrelid = to_regclass(k.tab) and x.conname = k.nom), false)
    from contraintes k
  union all
  select 4, 'index', i.nom, 'sur ' || i.tab,
         coalesce((select x.indrelid = to_regclass(i.tab) from pg_index x where x.indexrelid = to_regclass(i.nom)), false)
    from index_ i
  union all
  select 5, 'fonction', f.sig, 'exécutable : ' || f.regle,
         coalesce((select case f.regle
                            when 'authenticated' then has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                                      and not has_function_privilege('anon', p.oid, 'EXECUTE')
                            when 'interne' then not has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                                and not has_function_privilege('anon', p.oid, 'EXECUTE')
                            when 'service_role' then has_function_privilege('service_role', p.oid, 'EXECUTE')
                                                     and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                                     and not has_function_privilege('anon', p.oid, 'EXECUTE')
                          end
                     from pg_proc p where p.oid = to_regprocedure(f.sig)), false)
    from fonctions f
  union all
  select 5, 'fonction', 'public.mes_achats_xp() : la monnaie', 'rend article, obtenu, monnaie, xp, serie, le',
         coalesce((select strpos(pg_get_function_result(p.oid), 'monnaie text') > 0
                     from pg_proc p where p.oid = to_regprocedure('public.mes_achats_xp()')), false)
  union all
  select 5, 'fonction', 'public.ouvrir_pack_xp(uuid,text,integer,integer,text[],uuid)', 'ancienne signature supprimée',
         to_regprocedure('public.ouvrir_pack_xp(uuid,text,integer,integer,text[],uuid)') is null
  union all
  select 6, 'fonction modifiée', m.sig, m.quoi,
         coalesce((select bool_and(strpos(p.prosrc, x) > 0) from pg_proc p, unnest(m.motifs) x
                    where p.oid = to_regprocedure(m.sig)), false)
    from modifiees m
  union all
  select 7, 'déclencheur', d.tab || '.' || d.nom, d.fonction,
         coalesce((select t.tgenabled <> 'D'
                          and t.tgfoid = to_regprocedure(d.fonction)
                          and (select bool_and(strpos(pg_get_triggerdef(t.oid), m) > 0) from unnest(d.motifs) m)
                     from pg_trigger t
                    where t.tgrelid = to_regclass(d.tab) and t.tgname = d.nom and not t.tgisinternal), false)
    from declencheurs d
  union all
  select 8, 'politique', 'public.' || p.tab || ' · ' || p.nom,
         p.cmd || ' to authenticated' || coalesce(', using ' || p.dans_using, '') || coalesce(', check ' || p.dans_check, ''),
         coalesce((select x.cmd = p.cmd
                          and 'authenticated' = any (x.roles)
                          and (p.dans_using is null or strpos(coalesce(x.qual, ''), p.dans_using) > 0)
                          and (p.dans_check is null or strpos(coalesce(x.with_check, ''), p.dans_check) > 0)
                     from pg_policies x
                    where x.schemaname = 'public' and x.tablename = p.tab and x.policyname = p.nom), false)
    from politiques p
  union all
  select 8, 'politique', 'public.fins_des_matchs · aucune', 'RLS sans politique : personne ne lit',
         to_regclass('public.fins_des_matchs') is not null
         and not exists (select 1 from pg_policies x where x.schemaname = 'public' and x.tablename = 'fins_des_matchs')
  union all
  select 9, 'droit', d.role_ || ' ' || d.priv || ' ' || d.tab || coalesce('.' || d.col, ''),
         case when d.attendu then 'accordé' else 'refusé' end,
         coalesce((select case
                            when d.col is null then has_table_privilege(d.role_, c.oid, d.priv)
                            else has_column_privilege(d.role_, c.oid, a.attnum, d.priv)
                          end = d.attendu
                     from pg_class c
                     left join pg_attribute a on a.attrelid = c.oid and a.attname = d.col and not a.attisdropped
                    where c.oid = to_regclass(d.tab) and (d.col is null or a.attnum is not null)), false)
    from droits d
  union all
  select 10, 'temps réel', 'supabase_realtime · public.feuilles_direct', 'la ligue suit la feuille en direct',
         exists (select 1 from pg_publication_tables x
                  where x.pubname = 'supabase_realtime' and x.schemaname = 'public' and x.tablename = 'feuilles_direct')
  union all
  select 11, 'commentaire', 'public.achats_xp.' || c.col, c.dit,
         coalesce((select col_description(a.attrelid, a.attnum) is not null from pg_attribute a
                    where a.attrelid = to_regclass('public.achats_xp') and a.attname = c.col and not a.attisdropped), false)
    from (values ('xp', 'le prix, dans la monnaie de la ligne'), ('monnaie', 'xp ou xp-s')) c(col, dit)
)
select genre, objet, attendu, case when ok then 'ok' else 'MANQUE' end as etat
  from (
    select rang, genre, objet, attendu, ok from lignes
    union all
    select 99, 'TOTAL', count(*) || ' objets', count(*) filter (where ok) || ' ok · ' || count(*) filter (where not ok) || ' MANQUE',
           bool_and(ok)
      from lignes
  ) r
 order by rang, genre, objet;
