#!/bin/sh
# Le PACK AFRIQUE 2027 ouvert six fois au même instant (01/11/2026) : avec de
# quoi payer un seul pack, un seul achat passe, les cinq autres sont refusés
# (« XP S insuffisantes. »), et le numéro de série ne se répète pas quand deux
# joueurs tirent la même nation ensemble. Depuis le 02/11/2026, le pack se
# paie en XP S (40 le tirage) : vingt achats au même instant pour un solde de
# deux tirages, dix rejeux d'une même clé, un achat en XP et un en XP S
# ensemble (5 à 7).
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
  from (select public.ouvrir_pack_xp('$1', 'pack-afrique-2027', 'xp-s', 1200, 1500, $3, '$2') as r) x;
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
refus=$(cat "$sortie"/[1-6] | grep -c "XP S insuffisantes" || true)
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
  from (select public.ouvrir_pack_xp('e0000000-0000-0000-0000-00000000000b', 'pack-afrique-2027', 'xp-s', 1200, 3600, array['ke','ug'], '$1') as r) x;
SQL
}
for k in 1 2 3; do ouvrir_riche "60000000-0000-0000-0000-00000000000$k" > "$sortie/r$k" & done
wait
cat "$sortie"/r[1-3]
achats=$(psql -qAt -c "select count(*) || ' ' || count(distinct obtenu) from public.achats_xp where joueur = 'e0000000-0000-0000-0000-00000000000b'")
complet=$(cat "$sortie"/r[1-3] | grep -c "Pack complet" || true)
[ "$achats" = "2 2" ] && [ "$complet" = 1 ] || { echo "ÉCHEC sans doublon simultané : $achats, $complet « Pack complet »"; exit 1; }
echo "4 trois ouvertures simultanées, deux nations : deux achats distincts, un pack complet ok"

# Les XP S (02/11/2026).
# 5 · Vingt achats en XP S au même instant, une clé chacun, pour un solde de deux tirages (80 XP S
#     gagnées, 40 le tirage) : exactement deux lignes, dix-huit « XP S insuffisantes. ».
psql -qAt -c "delete from public.achats_xp where joueur::text like 'e0000000-%'"
ouvrir_s() { # $1 : la clé, $2 : la monnaie, $3 : l'article, $4 : le prix, $5 : gagné
  psql -qAt <<SQL 2>&1 | sed "s/^/$1 /"
set role service_role;
select coalesce(r ->> 'obtenu', '-') || ' ' || coalesce(r ->> 'serie', '-') || ' ' || coalesce(r ->> 'monnaie', '-')
  from (select public.ouvrir_pack_xp('e0000000-0000-0000-0000-00000000000c', '$3', '$2', $4, $5,
        array['ke','ug','tz','ma','sn','ci','ng','eg','dz','cm','ml','za'], '$1') as r) x;
SQL
}
for k in $(seq 10 29); do ouvrir_s "80000000-0000-0000-0000-0000000000$k" xp-s pack-afrique-2027 40 80 > "$sortie/s$k" & done
wait
lignes=$(psql -qAt -c "select count(*) || ' ' || coalesce(sum(xp), 0) || ' ' || count(distinct obtenu) from public.achats_xp where joueur = 'e0000000-0000-0000-0000-00000000000c' and monnaie = 'xp-s'")
refus=$(cat "$sortie"/s* | grep -c "XP S insuffisantes" || true)
[ "$lignes" = "2 80 2" ] && [ "$refus" = 18 ] || { cat "$sortie"/s*; echo "ÉCHEC vingt achats simultanés en XP S : « $lignes », $refus refus"; exit 1; }
echo "5 vingt achats simultanés en XP S, solde de deux tirages : 2 lignes, 80 XP S, 18 refus ok"

# 6 · Dix rejeux simultanés d'une même clé : une seule ligne, le même tirage rendu à chacun.
psql -qAt -c "delete from public.achats_xp where joueur::text like 'e0000000-%'"
for k in $(seq 0 9); do ouvrir_s 90000000-0000-0000-0000-000000000001 xp-s pack-afrique-2027 40 400 > "$sortie/c$k" & done
wait
lignes=$(psql -qAt -c "select count(*) from public.achats_xp where joueur = 'e0000000-0000-0000-0000-00000000000c'")
tirages=$(cut -d' ' -f2- "$sortie"/c* | sort -u | wc -l | tr -d ' ')
[ "$lignes" = 1 ] && [ "$tirages" = 1 ] || { cat "$sortie"/c*; echo "ÉCHEC dix rejeux : $lignes ligne(s), $tirages tirage(s) différent(s)"; exit 1; }
echo "6 dix rejeux simultanés d'une même clé : 1 ligne, le même tirage ok"

# 7 · Un achat en XP et un en XP S au même instant, pour le même joueur, chacun juste assez :
#     les deux passent, chacun sur son solde.
psql -qAt -c "delete from public.achats_xp where joueur::text like 'e0000000-%'"
ouvrir_s a0000000-0000-0000-0000-000000000001 xp pack-essai-xp 1200 1200 > "$sortie/mx" &
ouvrir_s a0000000-0000-0000-0000-000000000002 xp-s pack-afrique-2027 40 40 > "$sortie/ms" &
wait
cat "$sortie/mx" "$sortie/ms"
deux=$(psql -qAt -c "select string_agg(monnaie || ':' || xp, ',' order by monnaie) from public.achats_xp where joueur = 'e0000000-0000-0000-0000-00000000000c'")
[ "$deux" = "xp:1200,xp-s:40" ] || { echo "ÉCHEC deux monnaies au même instant : « $deux »"; exit 1; }
echo "7 un achat en XP et un en XP S au même instant : chacun sur son solde ok"
psql -qAt -c "delete from public.achats_xp where joueur::text like 'e0000000-%'"
rm -rf "$sortie"
