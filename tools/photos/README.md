# Photos des cartes SFL

## Où vivent les photos
Chaque joueur a une photo détourée (PNG transparent) dans **`public/players/`**,
nommée par son **prénom exact** tel qu'il apparaît dans `src/lib/sfl/data.ts`
(ex. `Smail.png`, `Sosso Coach.png`, `Selim laouadi.png`).

La carte charge automatiquement `/players/<Prénom>.png`. Si le fichier
n'existe pas, la carte affiche l'initiale du joueur — aucun réglage requis.

## Remplacer / ajouter une photo
1. Prépare une **photo normale** (pas une capture Snapchat/Insta : l'interface
   incrustée ne peut pas être détourée).
2. Détoure-la (voir ci-dessous) ou dépose directement un PNG transparent.
3. Nomme le fichier `<Prénom>.png` et place-le dans `public/players/`.
   Un fichier de même nom **remplace** l'ancien : la carte se met à jour seule.

## Détourage automatique
Script : `tools/photos/detour.py` (fond retiré, orientation EXIF corrigée,
cadrage tête/épaules 5:6, sortie PNG transparent 1100 px).

```bash
pip install pillow numpy "mediapipe==0.10.14"
# une photo ou un dossier entier -> dossier de sortie
python3 tools/photos/detour.py mes_photos/ public/players/
```

Le nom de sortie reprend le nom du fichier source, donc nomme tes fichiers
d'entrée par prénom (`Smail.jpg`) pour qu'ils atterrissent au bon endroit.

## Réglages utiles (en tête de `detour.py`)
- `AR` : ratio du cadre (défaut 5:6).
- `HEADROOM` / `CHEST` : marge au-dessus de la tête / descente sous le visage.
- `FEATHER` : adoucissement du bord du détourage.
