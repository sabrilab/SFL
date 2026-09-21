# Golder — l'app mobile

Une seule base de code, deux magasins : **App Store** et **Google Play**.
Expo SDK 57 / React Native 0.86, routage par fichiers avec `expo-router`.

L'interface reprend les composants du système partout où ils existent, et se
replie proprement là où ils n'existent pas — c'est ce qui permet de garder un
seul code sans que l'app ait l'air d'un portage sur l'une des deux plateformes.

| Élément | iOS | Android |
| --- | --- | --- |
| Barre d'onglets | `UITabBar` native, Liquid Glass sur iOS 26, elle se réduit au défilement | barre Material native |
| Icônes d'onglet | SF Symbols (`soccerball`, `person.text.rectangle`, `trophy`) | drawables système |
| Fiche d'un match | feuille `formSheet` UIKit : poignée, glisser pour fermer, voile | bottom sheet Material, mêmes gestes |
| Capsules de verre | `UIGlassEffect` via `expo-glass-effect` | surface teintée + liseré (repli assumé) |
| Retour haptique | Taptic Engine | vibreur |
| Texte courant | SF Pro | Roboto |

La typographie de titre (Archivo) et les libellés (DM Mono) sont embarqués :
c'est la signature de la marque, elle ne doit pas dépendre de la plateforme.

## Démarrer

```bash
cd mobile
npm install
npx expo start          # puis « i » pour iOS, « a » pour Android
```

Expo Go suffit pour le gros de l'interface. Le vrai verre d'iOS 26
(`expo-glass-effect`) et la barre d'onglets native demandent une *development
build* :

```bash
npx eas build --profile development --platform ios
```

## Regarder l'app sans téléphone

Le serveur de développement sert aussi l'app en web. `outils/apercu.mjs` ouvre
cette version dans un navigateur sans fenêtre, joue huit parcours réels — ouvrir
une fiche, rejoindre un match, répondre à la convocation, parcourir les trois
rubriques de la ligue — et enregistre une capture de chacun plus une planche
contact dans `.apercu/`.

```bash
npx expo start --web --port 8081   # dans un terminal, laissé tourner
node outils/apercu.mjs             # dans un autre, autant de fois qu'on veut
node outils/apercu.mjs ligue carte # ou seulement certaines scènes
```

Le rafraîchissement d'Expo étant automatique, il n'y a rien à reconstruire entre
deux modifications : on réexécute le script.

**Ce n'est pas le rendu iOS.** Trois choses diffèrent, et il faut les avoir en
tête en regardant les images : la barre d'onglets native passe en haut et
recouvre le titre (en vrai elle est en bas), le verre du système devient une
surface opaque, et les feuilles natives deviennent des pages entières. Tout le
reste — mise en page, typographie, couleurs, textes, comportement — est fidèle.
Pour juger du verre, des gestes et des vraies transitions, il faut un appareil.

## Vérifier avant de livrer

```bash
npm run typecheck   # TypeScript strict
npm run verifier    # typecheck + bundle Metro pour iOS et Android
```

## Publier sur les deux magasins

Les builds iOS se font dans le cloud EAS : **aucun Mac n'est nécessaire**.

```bash
npm install -g eas-cli
eas login
eas build:configure

# Binaires de production : .ipa pour l'App Store, .aab pour le Play Store
eas build --platform all --profile production

# Dépôt sur les deux magasins
eas submit --platform ios
eas submit --platform android
```

Il faut par ailleurs, une fois : un compte Apple Developer (99 $/an), un compte
Google Play (25 $ une fois), une fiche par magasin et les captures d'écran.
`app.golder.sfl` est l'identifiant réservé des deux côtés (`ios.bundleIdentifier`
et `android.package` dans `app.json`).

Les corrections de pur JavaScript peuvent ensuite partir sans repasser par la
revue, avec `eas update`.

## L'organisation du code

```
src/app/                 les écrans, un fichier = une route
  (tabs)/index.tsx       Jouer — les matchs autour de soi
  (tabs)/carte.tsx       Ma carte — la fiche joueur et le test de réflexes
  (tabs)/ligue.tsx       Ligue — Journée, Classement, Matchs
  match/[id].tsx         la fiche d'un match, en feuille native
  ouvrir.tsx             ouvrir son propre match, en feuille native
src/composants/          les briques partagées (Verre, Tuile, Ligne, Segment…)
src/da/theme.ts          la direction artistique, en un seul endroit
src/donnees/             les données de démonstration
src/etat/store.ts        l'état partagé, prêt à être remplacé par Supabase
```

## Ce qui reste à faire

- **Brancher les vraies données.** Tout vient de `src/donnees/`. Seul le store
  (`src/etat/store.ts`) parle à ces données : c'est le seul fichier à réécrire
  pour passer à Supabase.
- **Remplacer les photos** de `assets/terrains/` (voir le `CREDITS.md` qui s'y
  trouve : elles sont sous licence CC BY-SA, ce sont des images de substitution).
- **Les chiffres du classement** sont plausibles mais inventés, sauf ceux
  d'Ilyes qui viennent de la vraie saison.
- **La carte géographique** n'est pas encore là : elle demande
  `react-native-maps` (Apple Maps sur iOS, Google Maps sur Android) et une clé
  Google côté Android.
