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

## Voir l'app sur son téléphone, et la retrouver

```bash
cd mobile            # le script vit ici, pas dans le dossier personnel
npx expo login       # une fois
npx expo start       # à chaque session — ou `npm run tel`, qui fait pareil
```

**Sur iPhone, Expo Go n'ouvre un projet que si le terminal et l'application sont
connectés au même compte Expo.** C'est la cause n°1 des « je n'arrive plus à
rouvrir l'app » : sans cette connexion, le QR code ne donne rien. Une fois les
deux côtés connectés au même compte, le projet apparaît tout seul dans l'onglet
*Development servers* de Expo Go — plus besoin de chercher un QR code.

`npm run tel` n'est qu'un raccourci : il rappelle ce point puis démarre le
serveur. En cas de doute, `npx expo start` fait exactement le même travail et ne
dépend d'aucun script maison.

Si le téléphone ne voit pas l'ordinateur alors qu'ils sont sur le même wifi —
beaucoup de box opérateur isolent les appareils entre eux — ajoute le tunnel,
qui passe par internet : `npx expo start --tunnel` (plus lent, et il installe
`@expo/ngrok` au premier lancement).

Une fois l'app ouverte : secouer le téléphone affiche le menu de développement,
et chaque enregistrement de fichier se recharge tout seul.

### Le cycle de travail

Le serveur reste allumé. On ne le relance pas entre deux modifications, et on ne
rescanne jamais de QR code.

```bash
# onglet 1 — on le laisse tourner toute la session
npx expo start --tunnel

# onglet 2 — à chaque fois que du code arrive
git pull
```

Metro surveille les fichiers : dès qu'ils changent, l'app se recharge sur le
téléphone en une seconde ou deux, en gardant l'écran où on était. Que la
modification vienne de l'éditeur ou d'un `git pull` ne fait aucune différence.

Il faut en revanche **relancer le serveur** quand `app.json` change ou qu'un
paquet est installé (`npm install`), parce que ces deux-là ne sont lus qu'au
démarrage. Après un `git pull` qui touche `package.json`, faire `npm install`
puis relancer. Et si l'app se perd, secouer le téléphone ouvre le menu de
développement, où **Reload** repart d'un écran propre.

### Quand Expo Go reste bloqué sur « Opening project »

Le téléphone a bien reçu l'adresse du projet mais n'arrive pas à télécharger le
code depuis l'ordinateur. Deux causes, dans cet ordre :

1. **Le pare-feu de macOS** bloque les connexions entrantes vers `node`
   (Réglages Système → Réseau → Pare-feu).
2. **La box** isole les appareils du wifi entre eux.

Dans les deux cas, le tunnel règle le problème sans rien avoir à configurer :

```bash
npx expo start --tunnel
```

Pour savoir laquelle des deux : `ipconfig getifaddr en0` donne l'adresse du Mac,
et `http://<cette-adresse>:8081` ouvert dans Safari sur le téléphone doit
afficher quelque chose. Si ça tourne dans le vide, c'est bien le réseau.

## Voir le rendu iOS sans Mac

Trois façons, de la plus simple à la plus lourde.

**Expo Go, sur ton iPhone.** Gratuit, dix minutes, et c'est du vrai iOS : le
Liquid Glass, la barre d'onglets du système, les gestes. `expo-glass-effect` est
inclus dans Expo Go, donc rien ne manque. C'est la bonne réponse dans presque
tous les cas.

**Un simulateur iOS dans le navigateur.** Utile quand on veut montrer l'app à
quelqu'un qui n'a pas d'iPhone, ou la regarder depuis un ordinateur. Un build
« simulateur » n'est pas signé et **ne demande aucun compte Apple Developer** :

```bash
export APPETIZE_TOKEN=<ton-jeton-appetize>
./outils/simulateur.sh
```

Le script lance le build sur EAS, confie l'archive à Appetize et rend un lien
public. Le palier gratuit d'Appetize donne 30 minutes par mois et deux
appareils — de quoi regarder, pas de quoi travailler dedans toute la journée.

**Un appareil réel dans le cloud** (BrowserStack, LambdaTest). Ces services font
tourner de vrais iPhone, mais ils exigent un `.ipa` signé, donc un compte Apple
Developer à 99 $/an. À ne considérer qu'une fois l'app prête à sortir.

## La carte joueur

Le badge social de l'app : elle rend visible ce qu'un joueur a mis dans la ligue,
et on reconnaît les gens à leur carte plutôt qu'à des initiales. Elle vit en tête
de *Ma carte* (en volume), dans la fiche d'un match à la place des pastilles de
joueurs (en petit, à faire défiler), et en feuille quand on touche la carte de
quelqu'un.

Le design suit le document `docs/carte/SPEC.md`, livré avec le kit `player-card-3d`, sur sa
grille de référence 1024 × 1536 (`src/composants/carte/grille.ts`).

- **La face** (`face.skia.tsx`) est peinte en Skia. Deux effets imposaient Skia
  plutôt que des vues empilées : le numéro géant fondu dans la photo en
  `screen`, et le grain en `overlay` — sans eux, la typographie a l'air collée
  sur l'image. Anton et JetBrains Mono sont celles du kit ; la carte a sa propre
  typographie, distincte de celle de l'app, parce qu'elle est un objet, pas un
  écran.
- **Le volume** (`volume.tsx`) n'a pas de moteur 3D : perspective, deux rotations,
  inertie au lâcher, retour lent à l'angle de repos, retournement au
  double-toucher. Les valeurs de manipulation sont celles du document.
- **Sur le web** (`face.web.tsx`), Skia tourne sur CanvasKit, qui doit être chargé
  *avant* que le module soit importé — d'où un import différé. C'est ce qui
  permet à l'aperçu de montrer les cartes.

Les joueurs et leurs cartes sont dans `src/donnees/joueurs.ts`. Un joueur sans
photo — l'état de tout nouvel inscrit — a une face propre et un appel à créer sa
photo. Le seul portrait présent est celui de Yacine, déjà dans l'app Next
(`public/players/Yacine.png`) : c'est un membre de la ligue, avec le cadrage et
la lumière qu'on voudra obtenir pour tous.

**À venir** : la création du portrait à l'inscription (photos de l'utilisateur en
entrée, prompt système, modèle de génération côté serveur — jamais de clé dans
l'app), et les raretés du système de cartes existant du PWA (Standard, Rare,
Défensive, Impact, MVP).

## La feuille de match, côté hôte

Celui qui ouvre un match tient sa feuille. C'est l'acte sans lequel rien ne
remonte — ni les buts, ni les passes, ni les classements — et l'app le traite
comme tel.

Quatre états, dans l'ordre, définis dans `src/donnees/feuille.ts` :

```
ouvert ──démarrer──▶ en_cours ──terminer──▶ a_valider ──valider──▶ validee
```

- **Ouvert** : l'hôte compose. Il touche les cartes des joueurs de la ligue pour
  les ajouter, et l'équipe sous chaque carte pour la changer.
- **En cours** : un bouton « + But » par joueur. Chaque but s'enregistre à
  l'instant, le score s'en déduit (il ne peut pas se désynchroniser), et un
  bandeau propose d'attribuer la passe à un coéquipier. « Annuler le dernier »
  répare une erreur.
- **À valider** : le match est fini, l'hôte peut encore corriger et désigner
  l'homme du match. C'est le délai voulu : on valide à froid, pas dans le
  vestiaire. Le bouton **Valider la feuille de match** reste collé en bas de
  l'écran, quoi qu'on fasse défiler.
- **Validée** : figée. Plus aucune modification n'est acceptée.

Tant qu'une feuille est en cours ou à valider, un rappel occupe le haut de
l'onglet *Jouer* et une pastille marque l'onglet dans la barre. Il ne disparaît
qu'à la validation.

**Tout est sauvegardé à chaque geste** — la feuille et le match créé — dans le
stockage clé-valeur d'expo-sqlite (`src/etat/persistance.native.ts`, natif,
inclus dans Expo Go ; localStorage sur le web). Un but marqué survit à la
fermeture de l'app. Le passage à Supabase se fera dans ce seul fichier.

## Le journal de la ligue

Dans *Ligue → Matchs*, chaque dimanche est une rubrique qu'on déplie : la
manchette et son chapeau, le score, meilleur buteur, meilleur passeur et homme
du match, les tops au barème Pépite, et les faits du jour. Repris de la version
web : la manchette se déduit des chiffres (`src/donnees/journal.ts`), rien n'est
inventé, et deux lectures de la même journée donnent le même titre.

Les chiffres sont ceux de la démonstration : les totaux d'Ilyes correspondent à
la vraie saison, les autres joueurs sont plausibles mais inventés.

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

Le script corrige les artefacts du web *vers* la vérité : il redescend la barre
d'onglets en capsule flottante, réserve la place de l'encoche et de la barre
d'accueil, et recompose les feuilles natives par-dessus l'écran d'où elles
sortent — deux captures réelles superposées, comme iOS les empile. Il ne corrige
rien d'autre : ce qui reste à l'écran est ce que le code produit.

**Ce n'est pas pour autant le rendu iOS.** Le verre du système est approché par
un `backdrop-filter`, les icônes SF Symbols n'existent pas côté web, et aucune
transition ni aucun geste n'est reproduit. Ces images servent à juger la mise en
page, la typographie, les textes et le comportement. Pour la matière et le
toucher, il faut un appareil — Expo Go suffit.

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
