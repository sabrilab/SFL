-- Les outils des bancs de Bola Team (entraineur-check.sql, feuille-team-check.sql),
-- à inclure après entraineur-donnees.sql : un geste ou une lecture comme un
-- joueur (son jeton, ses seuls droits, ses règles de lecture), les essais
-- (ok, ou ÉCHEC avec ce que la base a répondu), et de quoi poser un match.
-- Un geste et ce qu'on en vérifie sont deux ordres : une lecture faite dans
-- l'ordre du geste ne verrait pas encore son effet.

-- Un geste comme un joueur, avec ses seuls droits : « ok », ou « refus <code> <message> ».
create function pg_temp.faire(qui text, appel text) returns text language plpgsql as $$
declare uid uuid; r text;
begin
  uid := pg_temp.uid(qui);
  if uid is null then raise exception 'compte de test inconnu : %', qui; end if;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  execute 'select (' || appel || ')::text' into r;
  reset role;
  return 'ok';
exception when others then
  reset role;
  return 'refus ' || sqlstate || ' ' || sqlerrm;
end; $$;

-- Une lecture comme un joueur (ses droits, ses règles de lecture) : la valeur, ou « refus … ».
create function pg_temp.lire(qui text, requete text) returns text language plpgsql as $$
declare uid uuid; r text;
begin
  uid := pg_temp.uid(qui);
  if uid is null then raise exception 'compte de test inconnu : %', qui; end if;
  perform set_config('request.jwt.claim.sub', uid::text, true);
  set local role authenticated;
  execute requete into r;
  reset role;
  return r;
exception when others then
  reset role;
  return 'refus ' || sqlstate || ' ' || sqlerrm;
end; $$;

-- Un refus attendu : son code et un bout de son message.
create function pg_temp.refus(r text, code text, bout text default '') returns boolean language sql immutable as $$
  select r like 'refus ' || code || ' %' and position(bout in r) > 0
$$;

-- Les essais : ok, ou ÉCHEC et l'arrêt (avec ce que la base a répondu).
create function pg_temp.vrai(nom text, cond boolean, detail text default '') returns text language plpgsql as $$
begin
  if cond is not true then raise exception 'ÉCHEC % %', nom, detail; end if;
  return nom || ' ok';
end; $$;
create function pg_temp.passe(nom text, qui text, appel text) returns text language plpgsql as $$
declare r text;
begin
  r := pg_temp.faire(qui, appel);
  if r <> 'ok' then raise exception 'ÉCHEC % : %', nom, r; end if;
  return nom || ' ok';
end; $$;
create function pg_temp.refuse(nom text, qui text, appel text, code text, bout text default '') returns text language plpgsql as $$
declare r text;
begin
  r := pg_temp.faire(qui, appel);
  if not pg_temp.refus(r, code, bout) then raise exception 'ÉCHEC % : %', nom, r; end if;
  return nom || ' ok';
end; $$;

-- L'appel d'une fonction d'équipe : « public.equipe_signer(12) », « public.equipe_inviter(12, '…'::uuid) ».
create function pg_temp.appel(fn text, equipe text, qui text default null) returns text language sql stable as $$
  select format('public.%s(%s%s)', fn, pg_temp.eq(equipe), case when qui is null then '' else format(', %L::uuid', pg_temp.uid(qui)) end)
$$;
-- Le dernier défi posé, relu à chaque appel.
create function pg_temp.dernier() returns bigint language sql volatile as $$ select max(id) from public.equipe_defis $$;
-- Un créneau à h heures d'ici, heure de Paris : le jour et l'heure d'un défi.
create function pg_temp.jour(h numeric) returns date language sql stable as $$
  select ((now() + make_interval(secs => (h * 3600)::double precision)) at time zone 'Europe/Paris')::date $$;
create function pg_temp.heure(h numeric) returns text language sql stable as $$
  select to_char((now() + make_interval(secs => (h * 3600)::double precision)) at time zone 'Europe/Paris', 'HH24:MI') $$;
create function pg_temp.defier(de text, a text, h numeric) returns text language sql stable as $$
  select format('public.equipe_defier(%s, %s, %L::date, %L, %L)', pg_temp.eq(de), pg_temp.eq(a), pg_temp.jour(h), pg_temp.heure(h), 'Five Lille Sud')
$$;
-- Un match programmé directement (comme s'il avait été accepté plus tôt), à h heures d'ici.
create function pg_temp.match(de text, a text, h numeric) returns bigint language sql as $$
  insert into public.equipe_defis (de, a, jour, heure, lieu, statut)
  values (pg_temp.eq(de), pg_temp.eq(a), pg_temp.jour(h), pg_temp.heure(h), 'Five Lille Sud', 'accepte')
  returning id $$;
-- La ligne d'une personne dans une équipe (relue à chaque appel).
create function pg_temp.ligne(equipe text, qui text) returns public.equipe_membres language sql volatile as $$
  select m.* from public.equipe_membres m where m.equipe_id = pg_temp.eq(equipe) and m.joueur = pg_temp.uid(qui)
$$;
-- Les huit gestes, « geste=oui » à la suite, pour un joueur dans une équipe.
create function pg_temp.droits(qui text, equipe text) returns text language sql volatile as $$
  select pg_temp.lire(qui, format($q$select string_agg(g || '=' || public.equipe_droit(%s, g), ',' order by g)
    from unnest(array['annuler', 'couverture', 'defier', 'direction', 'ecusson', 'feuille', 'inviter', 'score']) g$q$, pg_temp.eq(equipe)))
$$;
-- Déposer la feuille d'avant-match d'un match : « public.equipe_feuille(12, '{…}'::uuid[]) ».
create function pg_temp.deposer(d bigint, joueurs text[]) returns text language sql stable as $$
  select format('public.equipe_feuille(%s, %L::uuid[])', d, array(select pg_temp.uid(j) from unnest(joueurs) with ordinality t(j, o) order by o))
$$;
-- Les joueurs d'une feuille, par leur nom, dans l'ordre alphabétique (relue à chaque appel).
create function pg_temp.inscrits(d bigint, equipe text) returns text language sql volatile as $$
  select coalesce(string_agg(p.name, ',' order by p.name), '') from public.equipe_feuille_joueurs f join public.profiles p on p.id = f.joueur
   where f.defi_id = d and f.equipe_id = pg_temp.eq(equipe)
$$;
