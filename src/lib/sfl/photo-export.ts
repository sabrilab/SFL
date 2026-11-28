// L'image d'une photo de journée, à republier (Bola, 28/11/2026 : « je
// voudrais le mettre dans ma story Instagram, il faut que ça soit stylé. Je
// voudrais le mettre dans mon Snapchat […] soit dans les stories, soit
// carrément en publication »). Deux formats : la story (1080 × 1920) et la
// publication (1080 × 1350, le 4:5 d'Instagram).
//
// La photo prend tout le cadre quand elle y tient sans perdre plus d'un tiers
// de sa largeur (une photo en hauteur) ; sinon (une photo en largeur), elle
// se pose en carte arrondie, au carré dans une story, en 16:10 dans une
// publication, sur elle-même floutée et assombrie. En bas, sur un dégradé noir : la journée en Archivo 900 élargi
// (les titres des Actus), la date, les joueurs qu'on y voit, puis le logo
// Bola et getbola.app. En haut à gauche, le logo de la ligue. Rien d'autre :
// pas de bouton, pas de texte d'aide.
//
// Pur dessin sur un canvas (pas de React) : la feuille de partage
// (components/sfl/photos/partage-photo.tsx) charge les images et les polices,
// dessine, puis partage le fichier seul (sans texte : sur iPhone, un texte
// joint passe avant le fichier et Snapchat s'y perd, story-dimanche.tsx).

export type FormatImage = "story" | "publication";

export const TAILLES: Record<FormatImage, { l: number; h: number }> = {
  story: { l: 1080, h: 1920 },
  publication: { l: 1080, h: 1350 },
};

export interface PolicesExport {
  /** Archivo (titres). */
  titre: string;
  /** Inter (texte). */
  texte: string;
}

export interface DonneesExport {
  photo: HTMLImageElement;
  /** Le logo Bola, blanc. */
  logo: HTMLImageElement | null;
  /** Le sigle de la ligue (SFL), blanc. */
  sigle: HTMLImageElement | null;
  journee: number;
  /** « dimanche 22 novembre » */
  date: string;
  /** Les noms affichés des joueurs qu'on voit. */
  joueurs: string[];
  /** « getbola.app » */
  adresse: string;
  polices: PolicesExport;
}

function couvrir(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, l: number, h: number) {
  const r = Math.max(l / img.naturalWidth, h / img.naturalHeight);
  const lw = img.naturalWidth * r;
  const hh = img.naturalHeight * r;
  // Un peu au-dessus du centre : les visages plutôt que les pieds.
  ctx.drawImage(img, x + (l - lw) / 2, y + (h - hh) * 0.4, lw, hh);
}

function arrondi(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

/** Le logo à la hauteur voulue, sa largeur suivant ses proportions. */
function logo(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, h: number, aDroite = false): number {
  if (!img || !img.naturalWidth) return 0;
  const l = (img.naturalWidth / img.naturalHeight) * h;
  ctx.drawImage(img, aDroite ? x - l : x, y, l, h);
  return l;
}

/** Les noms sur une ou deux lignes, sans déborder ; au-delà, « +N ». */
function lignesDeNoms(ctx: CanvasRenderingContext2D, noms: string[], largeur: number): string[] {
  const lignes: string[] = [];
  let ligne = "";
  for (let i = 0; i < noms.length; i++) {
    const essai = ligne ? `${ligne} · ${noms[i]}` : noms[i];
    if (ctx.measureText(essai).width <= largeur) {
      ligne = essai;
      continue;
    }
    if (lignes.length === 1) {
      lignes.push(`${ligne} +${noms.length - i}`);
      return lignes;
    }
    lignes.push(ligne);
    ligne = noms[i];
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

export function dessinerImage(ctx: CanvasRenderingContext2D, format: FormatImage, d: DonneesExport): void {
  const { l: L, h: H } = TAILLES[format];
  const m = 72;
  ctx.save();
  ctx.clearRect(0, 0, L, H);
  ctx.fillStyle = "#050806";
  ctx.fillRect(0, 0, L, H);

  // La photo.
  const rImg = d.photo.naturalWidth / d.photo.naturalHeight;
  const rCadre = L / H;
  const perte = rImg > rCadre ? 1 - rCadre / rImg : 0;
  if (perte <= 1 / 3) {
    couvrir(ctx, d.photo, 0, 0, L, H);
  } else {
    ctx.save();
    ctx.filter = "blur(48px) brightness(0.45) saturate(1.1)";
    couvrir(ctx, d.photo, -80, -80, L + 160, H + 160);
    ctx.restore();
    // La photo en carte, recadrée au carré (story) ou en 16:10 (publication), au-dessus du texte.
    const l = L - 2 * 48;
    const h = format === "story" ? l : (l * 10) / 16;
    const y = format === "story" ? 250 : 176;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 18;
    arrondi(ctx, 48, y, l, h, 36);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();
    ctx.save();
    arrondi(ctx, 48, y, l, h, 36);
    ctx.clip();
    couvrir(ctx, d.photo, 48, y, l, h);
    ctx.restore();
  }

  // Le dégradé du bas, et un voile léger en haut pour le sigle.
  const bas = ctx.createLinearGradient(0, H * 0.48, 0, H);
  bas.addColorStop(0, "rgba(0,0,0,0)");
  bas.addColorStop(0.55, "rgba(0,0,0,0.62)");
  bas.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = bas;
  ctx.fillRect(0, H * 0.48, L, H * 0.52);
  const haut = ctx.createLinearGradient(0, 0, 0, 280);
  haut.addColorStop(0, "rgba(0,0,0,0.45)");
  haut.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = haut;
  ctx.fillRect(0, 0, L, 280);

  // En haut : le sigle de la ligue, et la journée en étiquette.
  const yHaut = format === "story" ? 112 : 72;
  logo(ctx, d.sigle, m, yHaut, 52);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  ctx.font = `700 30px ${d.polices.texte}`;
  ctx.letterSpacing = "6px";
  ctx.fillText("SUNDAY FIVE LEAGUE", L - m + 6, yHaut + 26);
  ctx.letterSpacing = "0px";

  // En bas, de bas en haut : getbola.app et le logo, les joueurs, la date, la journée.
  const yPied = H - (format === "story" ? 150 : 72);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const lLogo = logo(ctx, d.logo, m, yPied - 44, 44);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `600 30px ${d.polices.texte}`;
  ctx.textAlign = "right";
  ctx.fillText(d.adresse, L - m, yPied - 6);
  ctx.textAlign = "left";
  if (!lLogo) {
    ctx.fillStyle = "#fff";
    ctx.font = `900 40px ${d.polices.titre}`;
    ctx.fillText("BOLA", m, yPied - 4);
  }
  // Un filet entre le pied et le reste.
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(m, yPied - 84, L - 2 * m, 2);

  let y = yPied - 128;
  ctx.font = `600 36px ${d.polices.texte}`;
  const noms = lignesDeNoms(ctx, d.joueurs, L - 2 * m);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  for (let i = noms.length - 1; i >= 0; i--) {
    ctx.fillText(noms[i], m, y);
    y -= 50;
  }
  if (noms.length) y -= 10;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `500 34px ${d.polices.texte}`;
  ctx.fillText(d.date.charAt(0).toUpperCase() + d.date.slice(1), m, y);
  y -= 64;

  ctx.fillStyle = "#fff";
  ctx.font = `900 ${format === "story" ? 250 : 210}px ${d.polices.titre}`;
  (ctx as CanvasRenderingContext2D & { fontStretch?: string }).fontStretch = "expanded";
  ctx.letterSpacing = "-6px";
  ctx.fillText(`J${d.journee}`, m - 8, y);
  ctx.letterSpacing = "0px";
  ctx.restore();
}

/** « dimanche 22 novembre » */
export function dateLongue(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
