#!/bin/sh
# La feuille d'avant-match déposée au même instant (Bola Team, 03/11/2026) :
# le verrou du match met les dépôts l'un après l'autre, le dernier fait foi,
# et la feuille reste entière (ses joueurs sont ceux de son auteur). Quatre
# essais, sur un match dans une heure (après H-2 : le capitaine peut déposer
# tant que la feuille n'est pas celle de l'entraîneur) :
#   1. Lucien (l'entraîneur) dépose et garde sa transaction ouverte deux
#      secondes ; Ilyes (le capitaine) dépose pendant ce temps : il attend,
#      puis lit que la feuille est celle de l'entraîneur ;
#   2. Lucien et Ilyes au même instant : une seule feuille, celle de Lucien,
#      avec ses joueurs à lui, quel que soit l'ordre ;
#   3. les deux équipes du match au même instant : deux feuilles, chacune
#      entière ;
#   4. cinq dépôts de Lucien en rafale, cinq compositions : une seule
#      feuille, exactement l'une des cinq.
#
# Sur un Postgres 16 local seulement :
#   supabase/schema.sql joué deux fois (après tools/sql/supabase-reduit.sql sur
#   un Postgres nu), puis
#   PGHOST=… PGPORT=… PGDATABASE=… PGUSER=postgres sh tools/sql/feuille-team-concurrence.sh
set -eu
ici=$(cd "$(dirname "$0")" && pwd)

# Les données, validées : chaque session doit les voir. Lucien, entraîneur
# de Sunday Five, qui monte à 7 joueurs ; le match, dans une heure.
(cd "$ici" && psql -q -v ON_ERROR_STOP=1 >/dev/null) <<'SQL'
\i entraineur-donnees.sql
select pg_temp.comme('Ilyes', format('public.equipe_entraineur_inviter(%s, %L::uuid)', pg_temp.eq('Sunday Five'), pg_temp.uid('Lucien')));
select pg_temp.comme('Lucien', format('public.equipe_signer(%s)', pg_temp.eq('Sunday Five')));
select pg_temp.comme('Ilyes', format('public.equipe_inviter(%s, %L::uuid)', pg_temp.eq('Sunday Five'), pg_temp.uid(j))),
       pg_temp.comme(j, format('public.equipe_signer(%s)', pg_temp.eq('Sunday Five')))
  from unnest(array['Naim', 'Anis']) j;
insert into public.equipe_defis (de, a, jour, heure, lieu, statut)
select pg_temp.eq('Sunday Five'), pg_temp.eq('Racing Wazemmes'),
       ((now() + interval '1 hour') at time zone 'Europe/Paris')::date,
       to_char((now() + interval '1 hour') at time zone 'Europe/Paris', 'HH24:MI'), 'Banc concurrence', 'accepte';
SQL

# Un dépôt comme un joueur : « <qui> ok » ou « <qui> refus <message> », puis l'attente avant de valider.
depot() { # $1 : qui, $2 : les joueurs (noms, séparés par des virgules), $3 : l'attente (s)
  psql -qAt -v ON_ERROR_STOP=1 2>&1 <<SQL | sed -n 's/^.*NOTICE:  //p'
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where name = '$1' and id::text like 'e0000000-%'), true) \\g /dev/null
set local role authenticated;
do \$\$
begin
  perform public.equipe_feuille(
    (select id from public.equipe_defis where lieu = 'Banc concurrence'),
    array(select p.id from unnest(string_to_array('$2', ',')) with ordinality t(n, o)
            join public.profiles p on p.name = t.n and p.id::text like 'e0000000-%' order by o));
  raise notice '$1 ok';
exception when others then
  raise notice '$1 refus %', sqlerrm;
end;
\$\$;
select pg_sleep($3) \\g /dev/null
commit;
SQL
}
# La feuille d'une équipe : son auteur, puis ses joueurs (dans l'ordre alphabétique).
feuille() { # $1 : l'équipe
  psql -qAt -v ON_ERROR_STOP=1 -c "
    select coalesce((select p.name from public.profiles p where p.id = f.deposee_par), '-') || ' ' ||
           coalesce((select string_agg(p.name, ',' order by p.name) from public.equipe_feuille_joueurs j join public.profiles p on p.id = j.joueur
                      where j.defi_id = f.defi_id and j.equipe_id = f.equipe_id), '')
      from public.equipe_feuilles f join public.equipe_defis d on d.id = f.defi_id
     where d.lieu = 'Banc concurrence' and f.equipe_id = (select id from public.equipes where nom = '$1')"
}
entetes() { psql -qAt -c "select count(*) from public.equipe_feuilles f join public.equipe_defis d on d.id = f.defi_id where d.lieu = 'Banc concurrence'"; }
effacer() { psql -q -c "delete from public.equipe_feuilles f using public.equipe_defis d where d.id = f.defi_id and d.lieu = 'Banc concurrence'"; }

sortie=$(mktemp -d)
LUCIEN="Ilyes,Théo,Badis,Sami,Kader"
ILYES="Ilyes,Théo,Badis,Naim,Anis"
RACING="Yanis,Omar,Rayan,Wassim,Hugo"

# 1 · L'entraîneur tient sa transaction, le capitaine arrive pendant.
depot Lucien "$LUCIEN" 2 > "$sortie/lucien" &
sleep 0.5
debut=$(date +%s%N)
depot Ilyes "$ILYES" 0 > "$sortie/ilyes"
attente=$(( ($(date +%s%N) - debut) / 1000000 ))
wait
cat "$sortie/lucien" "$sortie/ilyes"
grep -q '^Lucien ok$' "$sortie/lucien" || { echo "ÉCHEC 1 : Lucien n'a pas déposé"; exit 1; }
grep -q "^Ilyes refus Réservé à l'entraîneur.$" "$sortie/ilyes" || { echo "ÉCHEC 1 : Ilyes ne lit pas la feuille de l'entraîneur"; exit 1; }
[ "$attente" -ge 1000 ] || { echo "ÉCHEC 1 : Ilyes n'a pas attendu Lucien ($attente ms)"; exit 1; }
[ "$(feuille 'Sunday Five')" = "Lucien Badis,Ilyes,Kader,Sami,Théo" ] || { echo "ÉCHEC 1 : la feuille n'est pas celle de Lucien ($(feuille 'Sunday Five'))"; exit 1; }
echo "1 ok : Ilyes a attendu $attente ms, puis lu la feuille de l'entraîneur"

# 2 · Au même instant : une seule feuille, celle de l'entraîneur, entière.
effacer
for k in 1 2 3; do
  depot Lucien "$LUCIEN" 0.3 > "$sortie/l$k" &
  depot Ilyes "$ILYES" 0.3 > "$sortie/i$k" &
  wait
  [ "$(entetes)" -eq 1 ] || { echo "ÉCHEC 2 : $(entetes) feuilles"; exit 1; }
  [ "$(feuille 'Sunday Five')" = "Lucien Badis,Ilyes,Kader,Sami,Théo" ] || { echo "ÉCHEC 2 : la feuille n'est pas entière ($(feuille 'Sunday Five'))"; exit 1; }
  grep -q '^Lucien ok$' "$sortie/l$k" || { echo "ÉCHEC 2 : Lucien refusé ($(cat "$sortie/l$k"))"; exit 1; }
  effacer
done
echo "2 ok : trois fois au même instant, une seule feuille, celle de Lucien, entière ($(cat "$sortie"/i1 "$sortie"/i2 "$sortie"/i3 | tr '\n' ';'))"

# 3 · Les deux équipes du match au même instant.
depot Lucien "$LUCIEN" 0.5 > "$sortie/sf" &
depot Yanis "$RACING" 0.5 > "$sortie/rw" &
wait
cat "$sortie/sf" "$sortie/rw"
[ "$(entetes)" -eq 2 ] || { echo "ÉCHEC 3 : $(entetes) feuilles au lieu de 2"; exit 1; }
[ "$(feuille 'Sunday Five')" = "Lucien Badis,Ilyes,Kader,Sami,Théo" ] && [ "$(feuille 'Racing Wazemmes')" = "Yanis Hugo,Omar,Rayan,Wassim,Yanis" ] \
  || { echo "ÉCHEC 3 : $(feuille 'Sunday Five') / $(feuille 'Racing Wazemmes')"; exit 1; }
echo "3 ok : deux feuilles, chacune entière"

# 4 · Cinq dépôts en rafale : la feuille est exactement l'une des cinq.
effacer
for c in "Ilyes,Théo,Badis,Sami,Kader" "Naim,Anis,Badis,Sami,Kader" "Ilyes,Théo,Naim,Anis,Kader,Sami" "Ilyes,Théo,Badis,Sami,Kader,Naim,Anis" "Théo,Badis,Sami,Naim,Anis"; do
  depot Lucien "$c" 0.1 >> "$sortie/rafale" &
done
wait
[ "$(grep -c '^Lucien ok$' "$sortie/rafale")" -eq 5 ] || { echo "ÉCHEC 4 : $(cat "$sortie/rafale")"; exit 1; }
finale=$(feuille 'Sunday Five' | cut -d' ' -f2)
trouve=0
for c in "Badis,Ilyes,Kader,Sami,Théo" "Anis,Badis,Kader,Naim,Sami" "Anis,Ilyes,Kader,Naim,Sami,Théo" "Anis,Badis,Ilyes,Kader,Naim,Sami,Théo" "Anis,Badis,Naim,Sami,Théo"; do
  [ "$finale" = "$c" ] && trouve=1
done
[ "$(entetes)" -eq 1 ] && [ "$trouve" -eq 1 ] || { echo "ÉCHEC 4 : la feuille mêle des dépôts ($finale)"; exit 1; }
echo "4 ok : cinq dépôts, une feuille, exactement l'une d'eux ($finale)"

# Rien ne reste.
psql -q -v ON_ERROR_STOP=1 <<'SQL'
delete from public.equipe_defis where lieu = 'Banc concurrence';
delete from public.equipes where nom in ('Sunday Five', 'Racing Wazemmes', 'AS Fives');
delete from public.team_offerts where joueur::text like 'e0000000-%';
delete from auth.users where id::text like 'e0000000-%';
SQL
rm -r "$sortie"
echo "feuille-team-concurrence : tout est ok"
