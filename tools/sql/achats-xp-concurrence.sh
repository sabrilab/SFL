#!/bin/sh
# Le PACK AFRIQUE 2027 ouvert six fois au même instant (01/11/2026) : avec de
# quoi payer un seul pack, un seul achat passe, les cinq autres sont refusés
# (« XP insuffisante. »), et le numéro de série ne se répète pas quand deux
# joueurs tirent la même nation ensemble.
#
# Sur un Postgres 16 local seulement :
#   PGHOST=… PGPORT=… PGDATABASE=… PGUSER=postgres sh tools/sql/achats-xp-concurrence.sh
set -eu
ici=$(dirname "$0")
(cd "$ici" && psql -q -v ON_ERROR_STOP=1 -f achats-xp-donnees.sql)
psql -qAt -c "delete from public.achats_xp where joueur::text like 'e0000000-%'"

ouvrir() { # $1 : le compte, $2 : la clé, $3 : les nations
  psql -qAt <<SQL 2>&1 | sed "s/^/$2 /"
set role service_role;
select coalesce(r ->> 'obtenu', '-') || ' ' || coalesce(r ->> 'serie', '-')
  from (select public.ouvrir_pack_xp('$1', 'pack-afrique-2027', 1200, 1500, $3, '$2') as r) x;
SQL
}

sortie=$(mktemp -d)
# 1 · Six ouvertures d'Ilyes au même instant, 1 500 XP : une seule passe.
for k in 1 2 3 4 5 6; do
  ouvrir e0000000-0000-0000-0000-00000000000a "30000000-0000-0000-0000-00000000000$k" "array['ke','ug','tz','ma','sn','ci']" > "$sortie/$k" &
done
wait
cat "$sortie"/[1-6]
passes=$(psql -qAt -c "select count(*) from public.achats_xp where joueur = 'e0000000-0000-0000-0000-00000000000a'")
refus=$(cat "$sortie"/[1-6] | grep -c "XP insuffisante" || true)
[ "$passes" = 1 ] && [ "$refus" = 5 ] || { echo "ÉCHEC simultané : $passes achat(s), $refus refus"; exit 1; }
echo "1 six ouvertures simultanées : 1 achat, 5 refus ok"

# 2 · Kader et Naïm tirent le Mali au même instant : n° 1 et n° 2, jamais deux fois le même.
ouvrir e0000000-0000-0000-0000-00000000000b 40000000-0000-0000-0000-000000000001 "array['ml']" > "$sortie/k" &
ouvrir e0000000-0000-0000-0000-00000000000c 40000000-0000-0000-0000-000000000002 "array['ml']" > "$sortie/n" &
wait
cat "$sortie/k" "$sortie/n"
series=$(psql -qAt -c "select string_agg(serie::text, ',' order by serie) from public.achats_xp where obtenu = 'ml' and joueur::text like 'e0000000-%'")
[ "$series" = "1,2" ] || { echo "ÉCHEC série : $series"; exit 1; }
echo "2 deux joueurs, même nation : n° 1 et n° 2 ok"

# Relecture adverse (02/11/2026).
# 3 · La même clé envoyée deux fois au même instant (double toucher, réseau qui rejoue) :
#     un seul achat, un seul débit, le même tirage rendu aux deux appels.
psql -qAt -c "delete from public.achats_xp where joueur::text like 'e0000000-%'"
for k in a b; do
  ouvrir e0000000-0000-0000-0000-00000000000a 50000000-0000-0000-0000-000000000001 "array['ke','ug','tz','ma','sn','ci']" > "$sortie/m$k" &
done
wait
cat "$sortie/ma" "$sortie/mb"
lignes=$(psql -qAt -c "select count(*) from public.achats_xp where joueur = 'e0000000-0000-0000-0000-00000000000a'")
a=$(cut -d' ' -f2- "$sortie/ma")
b=$(cut -d' ' -f2- "$sortie/mb")
[ "$lignes" = 1 ] && [ "$a" = "$b" ] || { echo "ÉCHEC même clé : $lignes ligne(s), « $a » et « $b »"; exit 1; }
echo "3 même clé, deux appels simultanés : un achat, le même tirage ok"

# 4 · Trois clés au même instant, de quoi payer trois packs, deux nations en jeu : deux achats,
#     deux nations différentes, et « Pack complet. » pour le troisième (jamais de doublon).
psql -qAt -c "delete from public.achats_xp where joueur::text like 'e0000000-%'"
ouvrir_riche() { # $1 : la clé
  psql -qAt <<SQL 2>&1 | sed "s/^/$1 /"
set role service_role;
select coalesce(r ->> 'obtenu', '-') || ' ' || coalesce(r ->> 'serie', '-')
  from (select public.ouvrir_pack_xp('e0000000-0000-0000-0000-00000000000b', 'pack-afrique-2027', 1200, 3600, array['ke','ug'], '$1') as r) x;
SQL
}
for k in 1 2 3; do ouvrir_riche "60000000-0000-0000-0000-00000000000$k" > "$sortie/r$k" & done
wait
cat "$sortie"/r[1-3]
achats=$(psql -qAt -c "select count(*) || ' ' || count(distinct obtenu) from public.achats_xp where joueur = 'e0000000-0000-0000-0000-00000000000b'")
complet=$(cat "$sortie"/r[1-3] | grep -c "Pack complet" || true)
[ "$achats" = "2 2" ] && [ "$complet" = 1 ] || { echo "ÉCHEC sans doublon simultané : $achats, $complet « Pack complet »"; exit 1; }
echo "4 trois ouvertures simultanées, deux nations : deux achats distincts, un pack complet ok"
psql -qAt -c "delete from public.achats_xp where joueur::text like 'e0000000-%'"
rm -rf "$sortie"
