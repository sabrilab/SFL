# Carte joueur — spécification de design

Document de transfert. Il décrit **ce qui fait tenir la carte**, pas l'implémentation web : les valeurs sont données sur une grille de référence de **1024 × 1536** (ratio 2:3) et en pourcentage, pour être portées telles quelles en React Native.

L'implémentation de référence est dans `player-card-3d.js` (canvas 2D + three.js). À lire comme une maquette exécutable, pas comme du code à traduire ligne à ligne.

---

## 1. Principe

La carte est **une seule image**. La photo n'est pas dans un cadre : elle occupe tout le fond, et la typographie est posée dessus. Tout le travail consiste à rendre le texte lisible sans masquer le joueur.

Trois règles, dans l'ordre :

1. **Le visage est en haut.** La photo est cadrée en *cover*, ancrée à 10 % du haut. Aucun voile sombre ne descend en dessous de 42 % de la hauteur.
2. **Le texte vit dans le tiers bas.** Un seul dégradé, qui va de transparent à presque opaque, y creuse la place. C'est le seul endroit où l'on peut écrire librement.
3. **Un seul accent coloré par carte.** Le poste, la note et le badge le portent. Tout le reste est blanc à différentes opacités.

---

## 2. Grille et zones

Référence 1024 × 1536. Marge latérale `PAD = 68` (6,6 % de la largeur).

| Zone | Position (px) | En % |
| --- | --- | --- |
| Marge latérale | 68 | 6,6 % L |
| Club | ligne de base y = 132 | 8,6 % H |
| Poste | ligne de base y = 182 | 11,8 % H |
| Nom + note | ligne de base y = 1180 | 76,8 % H |
| Pseudo | y = 1238 | 80,6 % H |
| Filet | y = 1284 | 83,6 % H |
| Stats (valeurs) | y = 1406 | 91,5 % H |
| Stats (libellés) | y = 1440 | 93,7 % H |

Le nom et la note partagent **la même ligne de base**. C'est ce qui tient le bloc bas.

---

## 3. Calques, dans l'ordre de peinture

L'ordre compte : chaque calque suppose les précédents.

**1. Fond.** Dégradé diagonal sombre, du coin haut-gauche au coin bas-droit : `#2a2f36` → `#181c21` → `#0d1013`. Visible seulement si la photo ne couvre pas tout.

**2. Photo.** Cover, facteur 1,04, ancrée à 10 % du haut (`(H - hauteurImage) × 0.1`). Le 1,04 évite un liseré de fond sur les bords après arrondi.

**3. Numéro géant.** Anton 640 px, couleur d'accent, aligné à droite sur `x = L - 40`, ligne de base `y = H - 300`. **Mode de fusion `screen`, opacité 30 %.** C'est le point technique le plus important du design : en fusion normale, le numéro flotte au-dessus de la photo comme un autocollant ; en `screen`, il n'éclaircit que ce qui est déjà clair, donc il se dépose *dans* l'image. En React Native : `mix-blend-mode` n'existe pas nativement, il faut passer par Skia (`BlendMode.Screen`) ou composer dans une texture.

**4. Voile haut.** Vertical, de `y = 0` à `y = 380` (24,7 % H) : `rgba(6,8,7,0.82)` → transparent. Discret, juste pour décrocher le club et le poste.

**5. Voile bas.** Vertical, de `y = 0.42 H` à `y = H` : transparent → `rgba(6,8,7,0.72)` à 55 % de la course → `rgba(6,8,7,0.96)`. Le point à 55 % est ce qui empêche une transition raide au milieu de la poitrine.

**6. Textes.** Détaillés au §4.

**7. Vignettage.** Radial, centre `(0.5 L, 0.44 H)` rayon `0.24 L`, vers `(0.5 L, 0.52 H)` rayon `0.95 L` : transparent → `rgba(6,8,7,0.40)`.

**8. Grain.** Bruit monochrome (valeurs 118 à 192), tuile de 180 px, en fusion `overlay` à 16 %. Sans lui, la photo et la typographie n'appartiennent pas à la même image : le texte a l'air collé. C'est peu coûteux et ça change beaucoup.

---

## 4. Typographie

Deux familles, aucune autre.

- **Display — Anton.** Le nom, la note, le numéro, les valeurs de stats.
- **Mono — JetBrains Mono.** Tout le reste : club, poste, pseudo, libellés de stats, badge. Toujours en capitales, toujours avec un interlettrage large.

| Élément | Police | Taille | Interlettrage | Couleur |
| --- | --- | --- | --- | --- |
| Club | Mono 700 | 32 | 9 px | blanc 86 % |
| Poste | Mono 700 | 30 | 5 px | accent |
| Nom | Anton 400 | 210 max, réduit pour tenir | — | blanc |
| Note | Anton 400 | 240 | — | accent |
| « GÉNÉRAL » | Mono 700 | 26 | 8 px | blanc 62 % |
| Pseudo | Mono 600 | 40 | — | blanc 60 % |
| Valeur de stat | Anton 400 | 60 | — | blanc |
| Libellé de stat | Mono 700 | 24 | 3 px | blanc 55 % |
| Badge | Mono 700 | 28 | 4 px | sombre sur accent |

**Le nom s'adapte.** On mesure d'abord la note, puis le nom est calé pour tenir dans `L - 2×PAD - largeurNote - 48`, en descendant de 210 px par pas de 4 jusqu'à ce qu'il rentre. Les deux ne se heurtent jamais, quel que soit le nom.

**La note ne porte pas de fond.** Une ombre portée douce suffit : noir 55 %, flou 38, décalage vertical 6. Un fond plein ferait une pastille, et une pastille sur une photo fait toujours interface, jamais objet.

---

## 5. Le bandeau de stats

Six colonnes égales de largeur `(L - 2×PAD) / 6`, valeur centrée puis libellé 34 px en dessous. Séparateurs verticaux entre les colonnes : blanc 14 %, 2 px de large, hauteur 74, commençant 46 px au-dessus de la ligne de base des valeurs.

Toujours six critères, toujours dans le même ordre. Le format d'entrée est une chaîne `VIT:88|TIR:84|PAS:91|DRI:86|DEF:52|PHY:71` — à remplacer par un tableau typé côté React Native.

---

## 6. Couleurs

| Rôle | Valeur |
| --- | --- |
| Encre | blanc, opacités 100 / 86 / 62 / 60 / 55 / 22 / 14 % |
| Voile | `#060807` |
| Fond dégradé | `#2a2f36` → `#181c21` → `#0d1013` |
| Accent (défaut) | `#A9CDFF` |
| Texte sur accent | `rgba(10,14,8,0.92)` |

L'accent est le seul paramètre de couleur. Il doit rester clair et désaturé : il tombe sur une photo, pas sur un aplat, et doit tenir en 4,5:1 sur le voile sombre.

---

## 7. Volume et matière (le rendu 3D)

Unités de scène ; la carte fait 1,4 × 2,1.

| Paramètre | Valeur |
| --- | --- |
| Épaisseur | 0,052 (3,7 % de la largeur) |
| Rayon des coins | 0,13 (9,3 % de la largeur) |
| Biseau | 0,012 |
| Face, retrait | 0,012, posée à `épaisseur/2 + 0,014` |
| Champ de vision | 30° |
| Exposition | ACES, 1,0 |

**L'éclairage est volontairement plat** : ambiante 1,9, directionnelle blanche 0,25 en haut à gauche, directionnelle d'accent 0,12 en bas à droite. La face est quasi mate (rugosité 0,95, réflexion d'environnement 0,03) avec une émission de 0,62 depuis sa propre texture.

C'est contre-intuitif, et c'est le deuxième point important de ce document : **dès qu'on éclaire la carte normalement, un reflet spéculaire balaie la photo à chaque rotation et le visage devient illisible.** La carte doit s'éclairer elle-même. Seule la tranche (rugosité 0,42, métal 0,12, vernis 0,6) accroche la lumière — c'est elle qui donne le volume.

L'environnement est un simple dégradé vertical blanc → gris → noir, sans point chaud.

**Ombre portée** : un plan 2,2 × 1,1 sous la carte, à `y = -1,42`, texturé d'un dégradé radial noir 55 % → transparent. Son opacité et son échelle suivent la rotation.

---

## 8. Le dos

Surface unie : même dégradé que le fond, une lueur radiale blanche à 7 % centrée un peu au-dessus du milieu, et un filet intérieur blanc 14 % à 24 px du bord, rayon 34. Aucune marque, aucun motif — la place est libre pour le logo du produit.

---

## 9. Manipulation

Toutes les valeurs sont en radians et en secondes.

| Comportement | Valeur |
| --- | --- |
| Sensibilité au glissé | 0,008 par pixel horizontal, 0,006 vertical |
| Amortissement de l'inertie | × 0,90 horizontal, × 0,88 vertical par image |
| Angle de repos | −0,30, plus `sin(t × 0,32) × 0,16` |
| Ressort de rappel | 0,012 pendant 0,6 s, puis 0,045 |
| Inclinaison au repos | `sin(t × 0,5) × 0,07`, ressort 0,03 |
| Limite d'inclinaison | ±0,7 |
| Flottement vertical | `sin(t × 0,8) × 0,028` |
| Retournement | double-clic, angle de repos + π |

Le délai de 0,6 s avant que le ressort ne durcisse est ce qui fait que la carte « glisse » après le lâcher au lieu de revenir sèchement. À garder.

---

## 10. Portage React Native

La carte se décompose en deux problèmes indépendants.

**La face** est une image composite. Deux voies :

- **react-native-skia** — la plus directe. `Canvas`, `Image` en cover, `Text` avec les polices chargées, `LinearGradient` / `RadialGradient` pour les voiles, `BlendMode.Screen` pour le numéro et `BlendMode.Overlay` pour le grain. La transposition est presque littérale : Skia a les mêmes primitives que le canvas 2D.
- **Vues empilées** — `ImageBackground` + `expo-linear-gradient` + `Text`. Plus simple, mais le numéro en `screen` et le grain ne sont pas reproductibles ; on perd les deux effets qui font tenir l'ensemble.

**Le volume** :

- **Sans 3D** : `Animated` / Reanimated avec `perspective` + `rotateY` + `rotateX` sur la vue de la face, plus une ombre. On garde 90 % de l'effet pour 5 % du coût. **C'est probablement le bon choix pour une liste de cartes.**
- **Avec 3D** : `react-three-fiber` sur `expo-gl`. Les valeurs du §7 se transposent telles quelles. À réserver à l'écran de détail — un contexte GL par carte ne passe pas à l'échelle.

**Performance.** La face doit être peinte une fois et mise en cache (`makeImageSnapshot` avec Skia), pas redessinée à chaque image. Sur une grille, prévoir un seul écran en volume à la fois.

**Polices.** Anton et JetBrains Mono doivent être chargées avant la première peinture, sinon la mesure du nom est fausse et la mise en page saute.

---

## 11. Paramètres de la carte

```
photo           URL de l'image
name            nom affiché, capitales
username        pseudo, avec @
club            nom du club, capitales
position        poste, capitales, en accent
overall         note générale, 60 à 100
number          numéro en filigrane (reprend la note si absent)
badge           mention optionnelle au-dessus du nom
accent          couleur unique de la carte
stats           six critères ordonnés
```

---

## 12. Ce qu'il ne faut pas faire

- **Ne pas encadrer la photo.** La carte perd son sujet dès que la photo devient une vignette.
- **Ne pas assombrir le haut.** Le visage est là. Le voile haut est à 82 % mais ne descend qu'à 24 % de la hauteur.
- **Ne pas ajouter une deuxième couleur.** Un accent, point.
- **Ne pas mettre la note dans une pastille.** Un chiffre nu, grand, en bas. Une pastille se lit comme un bouton.
- **Ne pas retirer le grain.** C'est lui qui fait que la typo et la photo sont le même objet.
