"""Les vignettes de Bola Studio (public/bola-plus/studio/), faites depuis les douze images fournies.

Sabri a fourni douze WebP de 980 × 1226 (retour du 15/11/2026, bola-app#22 ; dépôt bola-app,
passation/visuels/bola-studio/), capturés depuis la visionneuse de l'outil qui les a générés. L'image
elle-même fait 978 × 1224 : la capture a pris en plus deux colonnes à droite et deux lignes en bas, qui
ne sont pas l'image (à l'écran, un liseré gris le long du bord droit de chaque vignette).

  · l'original servi (« 01-ma-carte-en-vrai.webp », 978 × 1224, pour la fiche d'un modèle) : le fichier
    fourni, où seule la taille écrite dans l'en-tête VP8 change (980 × 1226 → 978 × 1224, deux octets).
    Rien n'est recodé : la grille de macroblocs reste la même (62 × 77), le décodeur rend les mêmes pixels
    et s'arrête avant la marge. Le script le vérifie (au plus deux niveaux d'écart, sur le dernier rang) ;
  · sa copie légère (« 01-ma-carte-en-vrai-660.webp », 660 × 826, pour le rail et l'éventail) : l'original
    décodé, réduit tout entier (Lanczos) et recodé en WebP (qualité 82). Elle garde les proportions de
    l'original : dans la fiche d'un modèle, elle est posée dessous le temps qu'il arrive, et les deux se
    superposent au pixel.

Ni teinte, ni recadrage, ni retouche. Les empreintes des vingt-quatre fichiers sont écrites dans
tools/studio-check.ts (EMPREINTES) : le script les affiche, prêtes à y être recopiées. Fait avec
Pillow 12.3 (libwebp 1.6) ; une autre version peut donner d'autres octets pour les copies légères.

  python3 -I tools/studio-vignettes.py <dossier des douze fichiers fournis> [public/bola-plus/studio]

Depuis le 23/11/2026 (Sabri : « on avait fait d'autres images que t'as pas mises à jour »), les vignettes
sont la version Ilyes en Seedream 5.0 Pro (16/11, bola-app, branche claude/project-thread-v8813n,
passation/visuels/bola-studio/ilyes-seedream/, commit 94b6fa7 ; Ilyes a donné son accord le 15/11). Ces
fichiers font 1320 × 1764 (3:4, le modèle n'a pas de 4:5) : le script les recadre en 4:5 sur toute la
largeur, le haut de la coupe à 30 % de la hauteur retirée (les têtes restent entières, le tiers bas sombre
aussi), puis les réduit à 978 × 1224 (qualité 86, celle des fichiers fournis) et 660 × 826 (qualité 82).
Les fichiers de 980 × 1226 (la première série) passent toujours par le chemin d'origine, sans recodage.
"""
import hashlib
import io
import os
import struct
import sys

from PIL import Image, ImageChops

FOURNI = (980, 1226)   # la taille des fichiers fournis (la capture)
IMAGE = (978, 1224)    # l'image, sans la marge de la capture
LEGERE = (660, 826)    # la copie légère : l'image entière, aux proportions de l'original
QUALITE = 82
SEEDREAM = (1320, 1764)  # la série Ilyes en Seedream 5.0 Pro (3:4)
QUALITE_ORIGINAL = 86


def en_4_5(image):
    """Une image 3:4 recadrée en 4:5 sur toute sa largeur, le haut de la coupe à 30 % de ce qui est retiré."""
    largeur, hauteur = image.size
    garde = round(largeur * IMAGE[1] / IMAGE[0])
    haut = round((hauteur - garde) * 0.3)
    return image.crop((0, haut, largeur, haut + garde))


def blocs(n):
    """Le nombre de macroblocs (16 px) qui couvrent n pixels."""
    return (n + 15) >> 4


def sans_marge(octets, nom):
    """Le fichier fourni, à la taille de l'image : seul l'en-tête VP8 change."""
    assert octets[0:4] == b"RIFF" and octets[8:12] == b"WEBP" and octets[12:16] == b"VP8 ", f"{nom} : pas un WebP simple (VP8)"
    assert (octets[20] & 1) == 0 and octets[23:26] == b"\x9d\x01\x2a", f"{nom} : pas une image clé VP8"
    largeur, hauteur = struct.unpack_from("<HH", octets, 26)
    assert (largeur & 0x3FFF, hauteur & 0x3FFF) == FOURNI, f"{nom} : {largeur & 0x3FFF} × {hauteur & 0x3FFF}, attendu {FOURNI[0]} × {FOURNI[1]}"
    assert (blocs(FOURNI[0]), blocs(FOURNI[1])) == (blocs(IMAGE[0]), blocs(IMAGE[1])), "la grille de macroblocs changerait : il faudrait recoder"
    sortie = bytearray(octets)
    # Les deux bits du haut (l'échelle) sont gardés.
    struct.pack_into("<HH", sortie, 26, (largeur & 0xC000) | IMAGE[0], (hauteur & 0xC000) | IMAGE[1])
    return bytes(sortie)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    source = sys.argv[1]
    sortie = sys.argv[2] if len(sys.argv) > 2 else os.path.join("public", "bola-plus", "studio")
    noms = sorted(f for f in os.listdir(source) if f.endswith(".webp"))
    assert len(noms) == 12 and [n[:2] for n in noms] == [f"{i:02d}" for i in range(1, 13)], f"douze fichiers numérotés de 01 à 12, trouvé : {noms}"
    os.makedirs(sortie, exist_ok=True)
    total = 0
    for nom in noms:
        with open(os.path.join(source, nom), "rb") as f:
            fourni = f.read()
        if Image.open(io.BytesIO(fourni)).size == SEEDREAM:
            image = en_4_5(Image.open(io.BytesIO(fourni)).convert("RGB")).resize(IMAGE, Image.LANCZOS)
            tampon = io.BytesIO()
            image.save(tampon, "WEBP", quality=QUALITE_ORIGINAL, method=6)
            original = tampon.getvalue()
            legere = image.resize(LEGERE, Image.LANCZOS)
            tampon = io.BytesIO()
            legere.save(tampon, "WEBP", quality=QUALITE, method=6)
            for fichier, octets in ((nom, original), (f"{nom[:-5]}-{LEGERE[0]}.webp", tampon.getvalue())):
                with open(os.path.join(sortie, fichier), "wb") as f:
                    f.write(octets)
                total += len(octets)
                print(f'  "{fichier}": "{hashlib.sha256(octets).hexdigest()}",')
            continue
        original = sans_marge(fourni, nom)
        # Les mêmes pixels que le fichier fourni, moins la marge.
        avant = Image.open(io.BytesIO(fourni)).convert("RGB").crop((0, 0, *IMAGE))
        image = Image.open(io.BytesIO(original)).convert("RGB")
        assert image.size == IMAGE, (nom, image.size)
        ecart = max(haut for _, haut in ImageChops.difference(avant, image).getextrema())
        assert ecart <= 2, f"{nom} : l'image a changé ({ecart} niveaux)"
        # La copie légère : l'image entière, réduite, aux proportions de l'original.
        assert round(IMAGE[1] * LEGERE[0] / IMAGE[0]) == LEGERE[1]
        legere = image.resize(LEGERE, Image.LANCZOS)
        tampon = io.BytesIO()
        legere.save(tampon, "WEBP", quality=QUALITE, method=6)
        for fichier, octets in ((nom, original), (f"{nom[:-5]}-{LEGERE[0]}.webp", tampon.getvalue())):
            with open(os.path.join(sortie, fichier), "wb") as f:
                f.write(octets)
            total += len(octets)
            print(f'  "{fichier}": "{hashlib.sha256(octets).hexdigest()}",')
    print(f"# {2 * len(noms)} fichiers, {total} octets")


if __name__ == "__main__":
    main()
