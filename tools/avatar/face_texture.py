"""Texture de visage style anime (Galactik Football) dessinée par code.

La tête est une UV-sphere avec un mapping contrôlé :
  u = 0.5 + atan2(x, -y) / 2pi   (le devant du visage est à u = 0.5)
  v = 0.5 + asin(z / r) / pi     (l'équateur — ligne des yeux — à v ~ 0.5)
On dessine en 2x puis on réduit (antialiasing).
"""
from PIL import Image, ImageDraw, ImageFilter
import math

SIZE = 2048
SS = 2  # supersampling
W = SIZE * SS

SKIN_TONES = {
    "claire": (241, 201, 165),
    "medium": (198, 134, 80),
    "foncee": (122, 75, 40),
}
IRIS = (61, 127, 134)      # vert-bleu comme la ref
DARK = (24, 18, 14)        # traits

def uv_px(u, v):
    return (u * W, (1 - v) * W)

def build(tone_name, tone):
    img = Image.new("RGB", (W, W), tone)
    d = ImageDraw.Draw(img)

    line_dark = tuple(int(c * 0.30) for c in tone)
    shade = tuple(int(c * 0.82) for c in tone)

    eye_u_off = 0.060       # décalage longitude des yeux
    eye_v = 0.535           # ligne des yeux légèrement au-dessus de l'équateur
    eye_w, eye_h = 0.052, 0.030  # demi-axes en unités uv

    for s in (-1, 1):
        cx, cy = uv_px(0.5 + s * eye_u_off, eye_v)
        ew, eh = eye_w * W, eye_h * W

        # blanc de l'oeil (amande)
        d.ellipse([cx - ew, cy - eh, cx + ew, cy + eh], fill=(250, 248, 245))
        # iris : ellipse verticale
        ir_w, ir_h = eh * 0.85, eh * 1.05
        icx = cx - s * ew * 0.10
        d.ellipse([icx - ir_w, cy - ir_h, icx + ir_w, cy + ir_h], fill=IRIS)
        d.ellipse([icx - ir_w, cy - ir_h, icx + ir_w, cy + ir_h],
                  outline=(20, 40, 42), width=int(0.0035 * W))
        # pupille + reflet
        d.ellipse([icx - ir_w * 0.42, cy - ir_h * 0.45,
                   icx + ir_w * 0.42, cy + ir_h * 0.45], fill=(10, 12, 12))
        hw = ir_w * 0.30
        d.ellipse([icx - ir_w * 0.35 - hw, cy - ir_h * 0.55 - hw,
                   icx - ir_w * 0.35 + hw, cy - ir_h * 0.55 + hw], fill=(255, 255, 255))

        # paupière supérieure : trait épais qui déborde vers l'extérieur
        lid = int(0.0075 * W)
        d.arc([cx - ew * 1.15, cy - eh * 1.9, cx + ew * 1.15, cy + eh * 1.2],
              start=200 if s < 0 else 205, end=335 if s < 0 else 340,
              fill=DARK, width=lid)
        # paupière inférieure discrète
        d.arc([cx - ew * 0.9, cy - eh * 0.6, cx + ew * 0.9, cy + eh * 1.15],
              start=30 if s < 0 else 20, end=150 if s < 0 else 160,
              fill=line_dark, width=int(0.0028 * W))

        # sourcil : trait net mais détendu (expression neutre, pas fâchée)
        b_y = cy - eh * 2.9
        inner = (cx - s * ew * 0.90, b_y + eh * 0.35)
        mid = (cx + s * ew * 0.35, b_y - eh * 0.15)
        outer = (cx + s * ew * 1.15, b_y + eh * 0.30)
        d.line([inner, mid, outer], fill=DARK, width=int(0.0085 * W), joint="curve")

    # nez : arête discrète + ombre anguleuse à la base
    nx, ny = uv_px(0.5, 0.472)
    d.line([(nx + 0.006 * W, ny - 0.045 * W), (nx + 0.010 * W, ny - 0.004 * W)],
           fill=shade, width=int(0.0045 * W))
    d.polygon([(nx + 0.010 * W, ny - 0.006 * W),
               (nx + 0.016 * W, ny + 0.006 * W),
               (nx - 0.004 * W, ny + 0.007 * W)], fill=shade)

    # bouche : ligne neutre légèrement incurvée + ombre lèvre inférieure
    mx, my = uv_px(0.5, 0.425)
    mw = 0.030 * W
    d.arc([mx - mw, my - 0.010 * W, mx + mw, my + 0.012 * W],
          start=20, end=160, fill=line_dark, width=int(0.0042 * W))
    d.arc([mx - mw * 0.55, my + 0.004 * W, mx + mw * 0.55, my + 0.018 * W],
          start=200, end=340, fill=shade, width=int(0.0030 * W))

    out = img.resize((SIZE, SIZE), Image.LANCZOS)
    path = f"/tmp/claude-0/-home-user-SFL/f3643510-aa7d-5bd3-93fe-68890f1ebf77/scratchpad/face_{tone_name}.png"
    out.save(path)
    print("texture:", path)

for name, tone in SKIN_TONES.items():
    build(name, tone)
