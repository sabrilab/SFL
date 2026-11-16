"""Les vignettes de Bola Studio (public/bola-plus/studio/), faites depuis les douze images fournies.

Version du 16/11/2026 (retour de Sabri sur bola-app#22 : les vignettes noir et blanc « pas
engageantes », l'avatar d'un joueur dessus « pour que ce soit plus compréhensible ») : douze WebP
en couleur de 896 × 1120, du 4:5 exact, aux mêmes noms et dans le même ordre que ceux du 15/11
(dépôt bola-app, passation/visuels/bola-studio/, commit ad41c96).

  · l'original servi (« 01-ma-carte-en-vrai.webp », 896 × 1120, pour la fiche d'un modèle) : le
    fichier fourni, octet pour octet. Rien n'est recodé ;
  · sa copie légère (« 01-ma-carte-en-vrai-660.webp », 660 × 825, pour le rail et l'éventail) :
    l'original décodé, réduit tout entier (Lanczos) et recodé en WebP (qualité 80). Elle garde les
    proportions de l'original : dans la fiche d'un modèle, elle est posée dessous le temps qu'il
    arrive, et les deux se superposent au pixel.

Ni teinte, ni recadrage, ni retouche. Les empreintes des vingt-quatre fichiers sont écrites dans
tools/studio-check.ts (EMPREINTES) : le script les affiche, prêtes à y être recopiées. Fait avec
Pillow 12.3 (libwebp 1.6) ; une autre version peut donner d'autres octets pour les copies légères.

  python3 -I tools/studio-vignettes.py <dossier des douze fichiers fournis> [public/bola-plus/studio]
"""
import hashlib
import io
import os
import struct
import sys

from PIL import Image

IMAGE = (896, 1120)    # les fichiers fournis : du 4:5 exact
LEGERE = (660, 825)    # la copie légère : l'image entière, aux proportions de l'original
QUALITE = 80   # 82 le 15/11 ; en couleur, 80 garde les vingt-quatre fichiers sous 1,5 Mo (tools/studio-check.ts)


def verifie(octets, nom):
    """Le fichier fourni : un WebP simple (VP8), à la taille attendue."""
    assert octets[0:4] == b"RIFF" and octets[8:12] == b"WEBP" and octets[12:16] == b"VP8 ", f"{nom} : pas un WebP simple (VP8)"
    largeur, hauteur = struct.unpack_from("<HH", octets, 26)
    assert (largeur & 0x3FFF, hauteur & 0x3FFF) == IMAGE, f"{nom} : {largeur & 0x3FFF} × {hauteur & 0x3FFF}, attendu {IMAGE[0]} × {IMAGE[1]}"


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
        verifie(fourni, nom)
        image = Image.open(io.BytesIO(fourni)).convert("RGB")
        assert image.size == IMAGE, (nom, image.size)
        # La copie légère : l'image entière, réduite, aux proportions de l'original.
        assert IMAGE[1] * LEGERE[0] == IMAGE[0] * LEGERE[1]
        legere = image.resize(LEGERE, Image.LANCZOS)
        tampon = io.BytesIO()
        legere.save(tampon, "WEBP", quality=QUALITE, method=6)
        for fichier, octets in ((nom, fourni), (f"{nom[:-5]}-{LEGERE[0]}.webp", tampon.getvalue())):
            with open(os.path.join(sortie, fichier), "wb") as f:
                f.write(octets)
            total += len(octets)
            print(f'  "{fichier}": "{hashlib.sha256(octets).hexdigest()}",')
    print(f"# {2 * len(noms)} fichiers, {total} octets")


if __name__ == "__main__":
    main()
