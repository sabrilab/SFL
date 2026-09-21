#!/usr/bin/env bash
#
# Voir l'app dans un vrai simulateur iOS, depuis un navigateur, sans Mac.
#
# Le principe : EAS compile un build « simulateur » — non signé, et donc sans
# compte Apple Developer — puis on confie l'archive à Appetize, qui fait tourner
# un simulateur iOS dans le navigateur et renvoie un lien partageable.
#
# L'archive n'est jamais téléchargée ici : EAS la publie à une adresse publique
# qu'on transmet telle quelle à Appetize.
#
#   export APPETIZE_TOKEN=...      # jeton API, dans les réglages du compte
#   ./outils/simulateur.sh
#
# Le palier gratuit d'Appetize donne 30 minutes par mois et deux appareils :
# assez pour regarder l'app, pas pour la laisser ouverte en arrière-plan.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${APPETIZE_TOKEN:-}" ]; then
  echo "APPETIZE_TOKEN n'est pas défini." >&2
  echo "Crée un compte sur appetize.io, copie le jeton API, puis :" >&2
  echo "  export APPETIZE_TOKEN=<ton-jeton>" >&2
  exit 1
fi

echo "→ Compilation du build simulateur sur EAS (compte 10 à 20 minutes)…"
sortie=$(npx eas build --platform ios --profile simulateur --non-interactive --wait --json)

# EAS a changé le nom de ce champ au fil des versions : on accepte les deux.
archive=$(node -e '
  const builds = JSON.parse(process.argv[1]);
  const b = Array.isArray(builds) ? builds[0] : builds;
  const a = b?.artifacts ?? {};
  const url = a.applicationArchiveUrl ?? a.buildUrl ?? b?.artifacts?.xcodeBuildLogsUrl;
  if (!url) { console.error("Aucune archive dans la réponse EAS."); process.exit(1); }
  console.log(url);
' "$sortie")

echo "→ Archive : $archive"
echo "→ Envoi à Appetize…"

reponse=$(curl -sS -X POST https://api.appetize.io/v1/apps \
  -H "X-API-KEY: $APPETIZE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(node -e '
    console.log(JSON.stringify({
      url: process.argv[1],
      platform: "ios",
      fileType: "tar.gz",
      note: "Golder — build simulateur",
      // Sans cela, il faudrait être connecté au compte pour ouvrir le lien,
      // et on ne pourrait le partager avec personne.
      appPermissions: { run: "public" },
    }));
  ' "$archive")")

cle=$(node -e '
  const r = JSON.parse(process.argv[1]);
  if (!r.publicKey) { console.error("Réponse inattendue :", process.argv[1]); process.exit(1); }
  console.log(r.publicKey);
' "$reponse")

echo
echo "✓ Simulateur iOS prêt :"
echo "   https://appetize.io/app/$cle?device=iphone16pro&osVersion=26.0"
echo
echo "Le lien est public : tu peux l'ouvrir depuis n'importe quel navigateur,"
echo "et me le donner pour que je regarde le rendu iOS moi aussi."
