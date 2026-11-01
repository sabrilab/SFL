#!/bin/sh
# La prise simultanée de la feuille d'un match par deux téléphones (01/11/2026) :
# un seul gagne, l'autre lit le nom du gagnant. Trois essais :
#   1. Kader prend la feuille du match 2 et garde sa transaction ouverte deux
#      secondes ; Naim, du même match, la demande pendant ce temps : il attend,
#      puis lit « tenue · Kader » ;
#   2. quatre joueurs du match 1 la prennent au même instant : une seule prise
#      passe ;
#   3. une prise pendant que l'admin publie la fin du match : elle attend la
#      publication, puis lit « terminee » (relecture du 01/11).
#
# Sur un Postgres 16 local seulement (les données remplacent la saison) :
#   supabase/schema.sql joué deux fois (après tools/sql/supabase-reduit.sql sur
#   un Postgres nu), puis
#   PGHOST=… PGPORT=… PGDATABASE=… PGUSER=postgres sh tools/sql/feuille-direct-concurrence.sh
set -eu
ici=$(dirname "$0")

# Les données, validées : chaque session doit les voir.
(cd "$ici" && psql -q -v ON_ERROR_STOP=1 -f feuille-direct-donnees.sql)

prise() { # $1 : le joueur, $2 : le match (1 ou 2), $3 : l'attente avant de valider
  psql -qAt -v ON_ERROR_STOP=1 <<SQL
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where name = '$1' and id::text like 'd0000000-%'), true) \\g /dev/null
set local role authenticated;
select '$1 ' || (r ->> 'ok') || ' ' || coalesce(r ->> 'refus', '-') || ' ' || coalesce(r -> 'feuille' ->> 'preneur_nom', '-')
  from (select public.prendre_feuille(4, 'Noirs $2', 'Blancs $2') as r) x;
select pg_sleep($3) \\g /dev/null
commit;
SQL
}

sortie=$(mktemp -d)
# 1 · L'un tient sa transaction, l'autre arrive pendant.
prise Kader 2 2 > "$sortie/kader" &
sleep 0.5
debut=$(date +%s%N)
prise Naim 2 0 > "$sortie/naim"
attente=$(( ($(date +%s%N) - debut) / 1000000 ))
wait
cat "$sortie/kader" "$sortie/naim"
grep -q '^Kader true - Kader$' "$sortie/kader" || { echo "ÉCHEC 1 : Kader n'a pas la feuille"; exit 1; }
grep -q '^Naim false tenue Kader$' "$sortie/naim" || { echo "ÉCHEC 1 : Naim ne lit pas Kader"; exit 1; }
[ "$attente" -ge 1000 ] || { echo "ÉCHEC 1 : Naim n'a pas attendu Kader ($attente ms)"; exit 1; }
echo "1 ok : Naim a attendu $attente ms, puis lu la feuille de Kader"

# 2 · Quatre au même instant.
for qui in Ilyes Théo Badis Sami; do prise "$qui" 1 0 > "$sortie/m1-$qui" & done
wait
cat "$sortie"/m1-*
gagnants=$(cat "$sortie"/m1-* | grep -c ' true - ' || true)
[ "$gagnants" -eq 1 ] || { echo "ÉCHEC 2 : $gagnants prises sur quatre"; exit 1; }
tenant=$(psql -qAt -c "select preneur_nom from public.feuilles_direct where j = 4 and noirs = 'Noirs 1'")
perdants=$(cat "$sortie"/m1-* | grep -c " false tenue $tenant\$" || true)
[ "$perdants" -eq 3 ] || { echo "ÉCHEC 2 : les trois autres ne lisent pas $tenant"; exit 1; }
echo "2 ok : une prise sur quatre, $tenant tient la feuille"

# 3 · Relecture du 01/11 : Théo prend la feuille du match 1 pendant que
# l'admin publie sa fin (les résultats). Avant, la prise ne voyait pas la
# publication en cours et ouvrait une feuille qui l'aurait écrasée au sceau ;
# elle attend désormais la publication, puis lit « terminee ».
psql -q -v ON_ERROR_STOP=1 -c "delete from public.feuilles_direct where saison = 1"
fin_par_l_admin() {
  psql -qAt -v ON_ERROR_STOP=1 <<'SQL'
begin;
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where name = 'Ilyes' and id::text like 'd0000000-%'), true) \g /dev/null
set local role authenticated;
select 'admin ' || (public.publier_saison(
  (select s.data || jsonb_build_object('entries', (
     select jsonb_agg(case when e ->> 'j' = '4' and e ->> 'team' in ('Noirs 1', 'Blancs 1') and not (e ? 'extraTime')
                           then e || jsonb_build_object('result', case when e ->> 'team' = 'Noirs 1' then 'Victoire' else 'Défaite' end)
                           else e end order by i)
       from jsonb_array_elements(s.data -> 'entries') with ordinality t(e, i)))
     from public.saison s where s.id = 1),
  0, (select version from public.saison where id = 1)) ->> 'ok');
select pg_sleep(2) \g /dev/null
commit;
SQL
}
fin_par_l_admin > "$sortie/admin" &
sleep 0.5
debut=$(date +%s%N)
prise Théo 1 0 > "$sortie/theo"
attente=$(( ($(date +%s%N) - debut) / 1000000 ))
wait
cat "$sortie/admin" "$sortie/theo"
grep -q '^admin true$' "$sortie/admin" || { echo "ÉCHEC 3 : la publication de l'admin n'est pas passée"; exit 1; }
grep -q '^Théo false terminee ' "$sortie/theo" || { echo "ÉCHEC 3 : Théo a pris la feuille d'un match fini"; exit 1; }
[ "$attente" -ge 1000 ] || { echo "ÉCHEC 3 : la prise n'a pas attendu la publication ($attente ms)"; exit 1; }
ouvertes=$(psql -qAt -c "select count(*) from public.feuilles_direct where j = 4 and noirs = 'Noirs 1'")
[ "$ouvertes" -eq 0 ] || { echo "ÉCHEC 3 : une feuille s'est ouverte sur le match fini"; exit 1; }
echo "3 ok : la prise a attendu la publication ($attente ms), puis lu le match terminé"

# Rien ne reste.
psql -q -v ON_ERROR_STOP=1 <<'SQL'
delete from public.feuilles_direct where saison = 1;
delete from public.saison where id = 1;
delete from auth.users where id::text like 'd0000000-%';
SQL
rm -r "$sortie"
echo "feuille-direct-concurrence : tout est ok"
