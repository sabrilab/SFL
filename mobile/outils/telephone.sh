#!/usr/bin/env bash
#
# Lance le serveur de développement pour ton téléphone, en évitant les deux
# pièges qui font qu'on n'arrive plus à rouvrir l'app.
#
# 1. Sur iPhone, Expo Go n'ouvre un projet QUE si le terminal et l'application
#    sont connectés au MÊME compte Expo. Sans ça, le QR code ne donne rien et on
#    croit que l'app est cassée. Ce script le vérifie avant de démarrer.
# 2. Beaucoup de box opérateur isolent les appareils entre eux : le téléphone et
#    l'ordinateur sont sur le même wifi mais ne se voient pas. Le tunnel passe
#    par internet et contourne le problème.

set -euo pipefail
cd "$(dirname "$0")/.."

compte=$(npx expo whoami 2>/dev/null | tr -d '\r' || true)

if [ -z "$compte" ] || echo "$compte" | grep -qi "not logged in"; then
  echo "Tu n'es pas connecté à Expo dans ce terminal."
  echo
  echo "  npx expo login"
  echo
  echo "Puis, dans Expo Go sur ton téléphone, connecte-toi au MÊME compte."
  echo "C'est la condition pour que le projet s'affiche tout seul dans l'onglet"
  echo "« Development servers » — et pour ne plus jamais chercher le QR code."
  exit 1
fi

echo "Terminal connecté en tant que : $compte"
echo "Vérifie que Expo Go est connecté au même compte, sinon le projet ne s'ouvrira pas."
echo
exec npx expo start --tunnel
