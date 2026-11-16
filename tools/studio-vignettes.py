"""Les vignettes de Bola Studio (public/bola-plus/studio/), faites depuis les douze images fournies.

Version du 16/11/2026 au soir (Sabri a choisi Seedream 5.0 Pro, bola-app#22, demandes de 19:20 et
19:25) : douze WebP en couleur, avec l'avatar d'un joueur, aux mêmes noms et dans le même ordre que
ceux de l'après-midi (dépôt bola-app, passation/visuels/bola-studio/, commit 94b6fa7). Ils sont en
3:4 (1320 × 1764) : le modèle n'a pas de 4:5. L'écran les recadre dans sa boîte en 4:5
(object-fit: cover, object-position: 50% 30%, studio-bola.css) : il ôte 2 % de la hauteur en haut,
4,5 % en bas ; les têtes restent entières et le tiers bas sombre garde le nom et le prix.

  · l'original servi (« 01-ma-carte-en-vrai.webp », 1100 × 1470, pour la fiche d'un modèle) : le
    fichier fourni, réduit tout entier (Lanczos) à la largeur de la fiche en grand sur un iPhone
    à écran × 3 (366 px), et recodé en WebP à la qualité des fichiers fournis (86). Servis tels
    quels (1320 px), les vingt-quatre fichiers dépasseraient 1,5 Mo ;
  · sa copie légère (« 01-ma-carte-en-vrai-660.webp », 660 × 882, pour le rail et l'éventail) :
    le fichier fourni, réduit tout entier (Lanczos) et recodé en WebP (qualité 80).
Les deux gardent les proportions du fichier fourni (110:147, sans un pixel d'écart) : dans la
fiche d'un modèle, la copie légère est posée sous l'original le temps qu'il arrive, et les deux
se superposent au pixel.

Ni teinte, ni recadrage dans les fichiers, ni retouche. Les empreintes des vingt-quatre fichiers
sont écrites dans tools/studio-check.ts (EMPREINTES) : le script les affiche, prêtes à y être
recopiées. Fait avec Pillow 12.3 (libwebp 1.6) ; une autre version peut donner d'autres octets.

  python3 -I tools/studio-vignettes.py <dossier des douze fichiers fournis> [public/bola-plus/studio]
"""
import hashlib
import io
import os
import struct
import sys

from PIL import Image

FOURNI = (1320, 1764)   # les fichiers fournis : Seedream 5.0 Pro, en 3:4 (110:147)
IMAGE = (1100, 1470)    # l'original servi : la fiche en grand sur un iPhone (366 px × 3)
LEGERE = (660, 882)     # la copie légère, pour le rail et l'éventail
QUALITE_IMAGE = 86      # celle des fichiers fournis
QUALITE_LEGERE = 80     # comme le 16/11 après-midi


def verifie(octets, nom):
    """Le fichier fourni : un WebP simple (VP8), à la taille attendue."""
    assert octets[0:4] == b"RIFF" and octets[8:12] == b"WEBP" and octets[12:16] == b"VP8 ", f"{nom} : pas un WebP simple (VP8)"
    largeur, hauteur = struct.unpack_from("<HH", octets, 26)
    assert (largeur & 0x3FFF, hauteur & 0x3FFF) == FOURNI, f"{nom} : {largeur & 0x3FFF} × {hauteur & 0x3FFF}, attendu {FOURNI[0]} × {FOURNI[1]}"


def reduit(image, taille, qualite):
    """L'image entière, réduite à cette taille, en WebP."""
    tampon = io.BytesIO()
    image.resize(taille, Image.LANCZOS).save(tampon, "WEBP", quality=qualite, method=6)
    return tampon.getvalue()


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    source = sys.argv[1]
    sortie = sys.argv[2] if len(sys.argv) > 2 else os.path.join("public", "bola-plus", "studio")
    noms = sorted(f for f in os.listdir(source) if f.endswith(".webp"))
    assert len(noms) == 12 and [n[:2] for n in noms] == [f"{i:02d}" for i in range(1, 13)], f"douze fichiers numérotés de 01 à 12, trouvé : {noms}"
    # Les trois tailles ont exactement les mêmes proportions.
    for taille in (IMAGE, LEGERE):
        assert FOURNI[1] * taille[0] == FOURNI[0] * taille[1], taille
    os.makedirs(sortie, exist_ok=True)
    total = 0
    for nom in noms:
        with open(os.path.join(source, nom), "rb") as f:
            fourni = f.read()
        verifie(fourni, nom)
        image = Image.open(io.BytesIO(fourni)).convert("RGB")
        assert image.size == FOURNI, (nom, image.size)
        for fichier, octets in (
            (nom, reduit(image, IMAGE, QUALITE_IMAGE)),
            (f"{nom[:-5]}-{LEGERE[0]}.webp", reduit(image, LEGERE, QUALITE_LEGERE)),
        ):
            with open(os.path.join(sortie, fichier), "wb") as f:
                f.write(octets)
            total += len(octets)
            print(f'  "{fichier}": "{hashlib.sha256(octets).hexdigest()}",')
    print(f"# {2 * len(noms)} fichiers, {total} octets")


if __name__ == "__main__":
    main()
