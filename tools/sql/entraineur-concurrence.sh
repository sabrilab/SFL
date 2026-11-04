#!/bin/sh
# Une même personne qui signe deux invitations au même instant (Bola Team,
# correctifs du 03/11/2026, contrôle adverse, défaut 1) : jamais une place
# d'entraîneur ouverte sans sa ligne de membre, jamais deux places ouvertes,
# jamais deux équipes. equipe_signer se met en file par personne (le verrou
# de son profil), puis vérifie que sa ligne d'invité est bien devenue celle
# d'un membre avant d'ouvrir la place.
#   1. Bilal, invité joueur au Racing et entraîneur d'AS Fives, signe les
#      deux au même instant, quarante fois (l'ordre alterne) ;
#   2. Bilal, invité entraîneur d'AS Fives et de Sunday Five, signe les deux
#      au même instant, quarante fois ;
#   3. la course tenue ouverte : il signe au Racing et garde sa transaction
#      deux secondes ; la signature d'AS Fives attend, puis est refusée.
# Après chaque essai : au plus une équipe, au plus une place ouverte, et
# aucune place ouverte sans la ligne de membre (entraîneur) qui va avec.
#
# Sur un Postgres 16 local seulement :
#   supabase/schema.sql joué deux fois (après tools/sql/supabase-reduit.sql sur
#   un Postgres nu), puis
#   PGHOST=… PGPORT=… PGDATABASE=… PGUSER=postgres sh tools/sql/entraineur-concurrence.sh [essais]
set -eu
ici=$(cd "$(dirname "$0")" && pwd)
N=${1:-40}

(cd "$ici" && psql -q -v ON_ERROR_STOP=1 >/dev/null) <<'SQL'
\i entraineur-donnees.sql
SQL

uid() { psql -qAt -c "select id from public.profiles where name = '$1' and id::text like 'e0000000-%'"; }
eq() { psql -qAt -c "select id from public.equipes where nom = '$1'"; }
BILAL=$(uid Bilal)
SF=$(eq 'Sunday Five'); RW=$(eq 'Racing Wazemmes'); AF=$(eq 'AS Fives')

# Bilal sans équipe, invité par chacune des deux équipes ($1, $2 : « joueur:<id> » ou « entraineur:<id> »).
inviter() {
  psql -q -v ON_ERROR_STOP=1 -c "
    delete from public.equipe_membres where joueur = '$BILAL';
    delete from public.equipe_entraineurs where joueur = '$BILAL';
    delete from public.equipe_departs where joueur = '$BILAL';
    insert into public.equipe_membres (equipe_id, joueur, statut, role, invite_par)
    select split_part(x, ':', 2)::bigint, '$BILAL', 'invite',
           case when split_part(x, ':', 1) = 'entraineur' then 'entraineur' else 'membre' end,
           (select capitaine from public.equipes where id = split_part(x, ':', 2)::bigint)
      from unnest(array['$1', '$2']) x;" >/dev/null
}
# Bilal signe dans l'équipe $1, comme dans l'app (son jeton), et garde sa transaction $2 secondes.
signer() {
  psql -qAt -v ON_ERROR_STOP=1 2>&1 <<SQL | sed -n 's/^.*NOTICE:  //p'
begin;
select set_config('request.jwt.claim.sub', '$BILAL', true) \\g /dev/null
set local role authenticated;
do \$\$
begin
  perform public.equipe_signer($1);
  raise notice '$1 ok';
exception when others then
  raise notice '$1 refus %', sqlerrm;
end;
\$\$;
select pg_sleep($2) \\g /dev/null
commit;
SQL
}
# Ce qu'il en reste : ses équipes de membre, ses places ouvertes, celles sans ligne de membre.
etat() {
  psql -qAt -c "
    select (select count(*) from public.equipe_membres m where m.joueur = '$BILAL' and m.statut = 'membre') || ' ' ||
           (select count(*) from public.equipe_entraineurs t where t.joueur = '$BILAL' and t.fin is null) || ' ' ||
           (select count(*) from public.equipe_entraineurs t where t.joueur = '$BILAL' and t.fin is null
               and not exists (select 1 from public.equipe_membres m where m.equipe_id = t.equipe_id and m.joueur = t.joueur
                                  and m.statut = 'membre' and m.role = 'entraineur'))"
}

sortie=$(mktemp -d)
course() { # $1, $2 : les invitations ; $3 : le nom de l'essai
  ok=0
  k=1
  while [ "$k" -le "$N" ]; do
    inviter "$1" "$2"
    a=$(echo "$1" | cut -d: -f2); b=$(echo "$2" | cut -d: -f2)
    if [ $((k % 2)) -eq 0 ]; then x=$a; y=$b; else x=$b; y=$a; fi
    signer "$x" 0 > "$sortie/a" &
    signer "$y" 0 > "$sortie/b" &
    wait
    r=$(etat)
    equipes=$(echo "$r" | cut -d' ' -f1); places=$(echo "$r" | cut -d' ' -f2); fantomes=$(echo "$r" | cut -d' ' -f3)
    if [ "$equipes" -gt 1 ] || [ "$places" -gt 1 ] || [ "$fantomes" -gt 0 ]; then
      echo "ÉCHEC $3, essai $k : $equipes équipe(s), $places place(s) ouverte(s), $fantomes sans ligne de membre [$(cat "$sortie/a") / $(cat "$sortie/b")]"
      exit 1
    fi
    [ "$equipes" -eq 1 ] && ok=$((ok + 1))
    k=$((k + 1))
  done
  echo "$3 ok : $N essais, une seule équipe à chaque fois ($ok signés), aucune place fantôme"
}

# 1 · Joueur au Racing, entraîneur d'AS Fives, au même instant.
course "joueur:$RW" "entraineur:$AF" "1 joueur et entraîneur"
# 2 · Entraîneur d'AS Fives et de Sunday Five, au même instant.
course "entraineur:$AF" "entraineur:$SF" "2 deux places d'entraîneur"

# 3 · La course tenue ouverte : la signature au Racing garde sa transaction, celle d'AS Fives arrive pendant.
inviter "joueur:$RW" "entraineur:$AF"
signer "$RW" 2 > "$sortie/racing" &
sleep 0.5
signer "$AF" 0 > "$sortie/asf"
wait
r=$(etat)
cat "$sortie/racing" "$sortie/asf"
grep -q "^$RW ok$" "$sortie/racing" || { echo "ÉCHEC 3 : la signature au Racing n'est pas passée"; exit 1; }
grep -q "^$AF refus " "$sortie/asf" || { echo "ÉCHEC 3 : la signature d'AS Fives est passée ($(cat "$sortie/asf"))"; exit 1; }
[ "$r" = "1 0 0" ] || { echo "ÉCHEC 3 : $r (équipes, places ouvertes, places sans ligne)"; exit 1; }
echo "3 ok : la signature d'AS Fives a attendu, puis a été refusée ($(cat "$sortie/asf" | cut -d' ' -f2-))"

# Rien ne reste.
psql -q -v ON_ERROR_STOP=1 <<'SQL'
delete from public.equipe_entraineurs where joueur::text like 'e0000000-%';
delete from public.equipes where nom in ('Sunday Five', 'Racing Wazemmes', 'AS Fives');
delete from public.team_offerts where joueur::text like 'e0000000-%';
delete from auth.users where id::text like 'e0000000-%';
SQL
rm -r "$sortie"
echo "entraineur-concurrence : tout est ok"
