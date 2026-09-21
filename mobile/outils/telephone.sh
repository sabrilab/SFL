#!/usr/bin/env bash
#
# Démarre le serveur de développement, avec un rappel utile avant.
#
# Ce script n'est qu'un raccourci : `npx expo start` fait le même travail et
# reste toujours la commande de secours si quoi que ce soit ici échoue.
#
#   npm run tel                # réseau local (le plus rapide)
#   npm run tel -- --tunnel    # si le téléphone ne voit pas l'ordinateur
#
# Le tunnel passe par internet et contourne les box opérateur qui isolent les
# appareils entre eux. Il demande à installer @expo/ngrok la première fois, et
# il est plus lent : à n'utiliser que si le réseau local ne marche pas.

# Pas de `set -e` : un avertissement ne doit jamais empêcher le serveur de
# démarrer. La commande de la fin est le seul but de ce script.
set -uo pipefail
cd "$(dirname "$0")/.."

compte=$(npx expo whoami 2>/dev/null | tail -n 1 | tr -d '\r')

case "$compte" in
  ''|*"not logged in"*|*"Not logged in"*)
    echo "⚠  Ce terminal n'est pas connecté à Expo."
    echo "   Sur iPhone, Expo Go n'ouvre un projet que si le terminal ET"
    echo "   l'application sont connectés au même compte Expo."
    echo "   → npx expo login, puis connecte Expo Go au même compte."
    echo
    ;;
  *)
    echo "Terminal connecté : $compte"
    echo "Connecte Expo Go au même compte, sinon le projet ne s'ouvrira pas."
    echo
    ;;
esac

exec npx expo start "$@"
