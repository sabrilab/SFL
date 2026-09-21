# `player-card-3d`

Carte de joueur au format 2:3, manipulable en 3D. Un seul fichier, aucun framework : un custom element qui peint sa face dans un `<canvas>` et l'applique comme texture sur une plaque extrudée dans three.js.

> **Pour un portage (React Native ou autre) : lire `SPEC.md`.** Il décrit le design lui-même — grille, calques, typographie, matière, physique de la manipulation — en valeurs normalisées, indépendamment de cette implémentation web. Le présent fichier ne documente que la démo.

## Utilisation

```html
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Instrument+Serif&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">

<div style="width: 420px; height: 620px;">
  <player-card-3d
    photo="/img/kim.png"
    player-name="KIM"
    username="@kimsj"
    club="FC PANTIN"
    position-label="MILIEU OFF."
    overall="84"
    number="7"
    accent="#A9CDFF"
    stats="VIT:88|TIR:84|PAS:91|DRI:86|DEF:52|PHY:71"></player-card-3d>
</div>

<script src="player-card-3d.js"></script>
```

Le composant remplit son parent : c'est le conteneur qui fixe la taille. Prévoir un ratio proche de 2:3 avec un peu de marge pour la rotation.

## Attributs

| Attribut | Rôle |
| --- | --- |
| `photo` | URL de l'image. Cadrage *cover* ancré vers le haut pour garder le visage. |
| `player-name` | Nom en display, taille auto-ajustée à la largeur. |
| `username` | Pseudo sous le nom. |
| `club` | Ligne du haut à gauche. |
| `position-label` | Poste, sous le club, en couleur d'accent. |
| `overall` | Note générale, 60 à 100. Bloc chiffré en bas à droite, à hauteur du nom. |
| `number` | Numéro géant en filigrane. Reprend `overall` si absent. |
| `badge` | Pastille optionnelle au-dessus du nom (« Meilleur buteur »…). |
| `accent` | Couleur unique de la carte (hex). |
| `stats` | Six critères, `CLÉ:VALEUR` séparés par `\|`. |

Les attributs sont observés : les changer à chaud repeint la face sans reconstruire la scène.

## Interaction

Glisser pour faire tourner, avec inertie puis retour lent à l'angle de repos. Double-clic pour retourner la carte. Le rendu s'arrête quand la carte sort du viewport (`IntersectionObserver`).

## Comment c'est construit

**La face est un canvas 1024 × 1536**, peint une fois puis posé en texture. L'ordre de peinture fait tout le design :

1. Fond dégradé sombre, puis la photo en *cover* ancrée à 10 % du haut.
2. Le numéro géant par-dessus, en mode `screen` à 30 % : il se fond dans la photo au lieu de la couvrir.
3. Deux voiles verticaux — léger en haut, appuyé en bas — qui creusent la place du texte sans assombrir le visage.
4. Les textes : club et poste en haut à gauche ; en bas, le nom en display à gauche et la note générale en gros chiffre à droite, sur la même ligne de base ; pseudo, filet, bandeau des six critères.
5. Vignettage et grain, pour que la photo et la typographie appartiennent à la même image.

**La 3D est volontairement pauvre en lumière** : ambiante à 1,9 et deux directionnelles très faibles (0,25 et 0,12). Le matériau de la face est presque mat (`roughness: 0.95`, `envMapIntensity: 0.03`) avec un `emissiveMap` à 0,62 — sans ça, un reflet spéculaire tourne sur la photo à chaque rotation et la rend illisible. L'environnement est un simple dégradé vertical, sans point chaud.

La plaque est une `ExtrudeGeometry` à coins arrondis : c'est elle qui donne la tranche visible de profil. Face et dos sont deux `ShapeGeometry` plaquées de part et d'autre, avec des UV planaires calculées à la main.

Le dos est neutre — surface unie, lueur douce au centre, filet intérieur. Aucune marque : à remplir selon le produit.

La note générale porte une ombre portée douce plutôt qu'un fond : elle reste lisible sur une photo claire comme sombre, et le nom se réduit automatiquement pour ne jamais la heurter.

## Dépendance

three.js 0.160, chargé en ESM depuis unpkg (constante `THREE_URL` en tête de fichier). Pour un bundle, remplacer l'`import()` dynamique par un import statique de `three`.

## Points d'attention

- Les photos doivent être servies avec CORS ouvert (`crossOrigin = 'anonymous'`), sinon le canvas est marqué *tainted*.
- Les polices doivent être chargées avant la première peinture : le composant attend `document.fonts.load` pour Anton et JetBrains Mono.
- Sur une grille de plusieurs cartes, prévoir un ordonnanceur : un contexte WebGL par carte sature vite le navigateur (limite autour de 8 à 16 contextes). Une solution : garder les N plus proches du centre en 3D et rendre les autres avec le même `paintFace` dans un canvas 2D simple.
