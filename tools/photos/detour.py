#!/usr/bin/env python3
"""Détourage SFL : fond supprimé + orientation EXIF + cadrage tête/épaules 5:6.
Usage: python3 detour.py <fichier|dossier> [dossier_sortie]
Sortie : PNG transparent nommé par joueur, hauteur 1100px.
"""
import sys, os, glob
import numpy as np
from PIL import Image, ImageFilter, ImageOps
import mediapipe as mp

_seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=1)
_face = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.4)

AR = (5, 6)          # ratio carte
TARGET_H = 1100
HEADROOM = 0.7       # marge au-dessus de la tête (en hauteurs de visage)
CHEST = 3.2          # descente sous le visage (en hauteurs de visage)
FEATHER = 1.5        # adoucissement du bord du masque

def detour(path, out):
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    arr = np.asarray(img); H, W = arr.shape[:2]
    mask = np.clip(_seg.process(arr).segmentation_mask, 0, 1)
    mimg = Image.fromarray((mask * 255).astype("uint8"), "L").filter(ImageFilter.GaussianBlur(FEATHER))
    rgba = img.convert("RGBA"); rgba.putalpha(mimg)

    fr = _face.process(arr)
    if fr.detections:
        b = fr.detections[0].location_data.relative_bounding_box
        fx, fy, fw, fh = b.xmin * W, b.ymin * H, b.width * W, b.height * H
        cx = fx + fw / 2
        top = fy - HEADROOM * fh
        bot = fy + fh + CHEST * fh
        cw = (bot - top) * AR[0] / AR[1]
        box = [cx - cw / 2, top, cx + cw / 2, bot]
    else:  # pas de visage détecté -> bbox du sujet
        bb = mimg.point(lambda p: 255 if p > 90 else 0).getbbox() or (0, 0, W, H)
        box = list(bb)

    x0, y0, x1, y1 = [int(round(v)) for v in box]
    cw, ch = x1 - x0, y1 - y0
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.paste(rgba.crop((max(0, x0), max(0, y0), min(W, x1), min(H, y1))),
                 (max(0, -x0), max(0, -y0)))
    if ch > TARGET_H:
        canvas = canvas.resize((round(cw * TARGET_H / ch), TARGET_H), Image.LANCZOS)
    canvas.save(out)
    return canvas.size

if __name__ == "__main__":
    src = sys.argv[1]
    outdir = sys.argv[2] if len(sys.argv) > 2 else "photos_out"
    os.makedirs(outdir, exist_ok=True)
    files = sorted(glob.glob(os.path.join(src, "*"))) if os.path.isdir(src) else [src]
    files = [f for f in files if not os.path.basename(f).startswith("_")]
    for f in files:
        name = os.path.splitext(os.path.basename(f))[0]
        try:
            sz = detour(f, os.path.join(outdir, name + ".png"))
            print(f"OK  {name:16s} {sz}")
        except Exception as e:
            print(f"ERR {name:16s} {e}")
