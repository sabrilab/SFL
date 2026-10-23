// Le calque du maillot : la photo de studio d'un joueur, repeinte au maillot
// de son camp par le code, sans nouvelle génération.
//
// Sabri, 23/10/2026 (« Maillots noir et blanc ») : « est-ce que tu peux faire
// en sorte de coder quelque chose qui fait que tu prends un maillot noir et un
// maillot blanc, et que tu arrives à bien le mettre en espèce d'overlay sur
// chaque joueur ? […] Sans que ce soit encore une génération ». Mis devant
// une retouche par l'IA, il a choisi le calque : gratuit et immédiat, au prix
// d'un maillot uni (le col, les manches et les logos prennent la couleur du
// maillot).
//
// Les photos du studio se ressemblent toutes (le prompt de la route
// /api/photo-studio) : de face, de la tête à mi-poitrine, le maillot Bola
// blanc ou noir en bas de l'image, et derrière un fond gris ou un drapeau,
// toujours flou. Le calque s'appuie là-dessus :
//   1. la photo est réduite (≈ 448 px) pour chercher le maillot vite ;
//   2. sa couleur se lit en bas au centre, sur la poitrine : blanc ou noir ;
//   3. le fond est ce qui est flou et touche le haut ou les côtés de l'image
//      (la netteté se mesure en pleine définition : le grain du tissu, les
//      plis et les cheveux sont nets, le fond ne l'est jamais) ; son bord
//      exact est repris sur le contour le plus franc, dans une bande étroite ;
//   4. dans le joueur, le maillot est trouvé par ligne de partage des eaux :
//      des graines de tissu sous le cou, des graines « autre » sur la peau, la
//      tête (du haut jusqu'au bas du cou) et les couleurs vives ;
//   5. des garde-fous : un maillot trop petit, trop haut ou trop
//      dissymétrique, et la photo reste telle quelle (le camp se lit alors à
//      l'onglet de la note) ;
//   6. le maillot est repeint en pleine définition, à l'ombrage de la photo :
//      chaque ton du maillot d'origine prend le ton de même rang de l'autre
//      maillot, relevé sur les photos du studio (TONS, plus bas).
//
// Rien ici ne touche au DOM : le module prend et rend des pixels RGBA, pour
// tourner dans un worker (calque-maillot.worker.ts) comme dans Node. Les
// photos repeintes restent gardées sur les téléphones (maillot-des-photos.ts) :
// toute retouche de ce calcul demande d'y changer le nom du cache (CACHE).

export type Teinte = "blanc" | "noir";

/** Ce que le calque a vu, pour les garde-fous et les essais. */
export interface Diagnostic {
  /** La couleur du maillot sur la photo, ou null si ce n'en est pas un. */
  maillot: Teinte | null;
  /** Pourquoi la photo est restée telle quelle. */
  refus?: string;
  /** Le masque du maillot à la définition de travail (1 = maillot). */
  masque?: Uint8Array;
  /** Les étiquettes (1 maillot, 2 autre, 3 fond) et les graines. */
  etiquettes?: Uint8Array;
  graines?: Uint8Array;
  /** Le bas de la zone de la tête, colonne par colonne (-1 : aucune), et le visage. */
  limite?: Int32Array;
  visage?: Uint8Array;
  /** La part de marquage de chaque pixel, en pleine définition (0 à 1). */
  marquage?: Float32Array;
  largeur?: number;
  hauteur?: number;
}

/** Le côté de travail visé pour chercher le maillot. */
const COTE_TRAVAIL = 448;
/** Sous ce grain (écart moyen à l'image adoucie, en pleine définition), c'est flou : le fond. */
const SEUIL_FLOU = 0.003;

const MAILLOT = 1;
const AUTRE = 2;
const FOND = 3;
const JOUEUR = 4;
const BRAS = 5;

const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * La peau : chaude et assez saturée, d'une teinte entre le rouge et le jaune
 * (le vert un peu au-dessus du bleu). Un reflet de drapeau rouge sur le
 * satin, rouge pur ou rose pâle, n'en est pas.
 */
const estPeau = (r: number, g: number, b: number) => {
  if (r < g || g < b * 0.97 || r - b <= 0.04 || r - b < 0.18 * r) return false;
  const k = (g - b) / (r - b);
  return k >= 0.12 && k <= 0.8;
};

/** Une couleur vive : un drapeau, des lèvres, jamais le tissu du maillot. */
const estVif = (r: number, g: number, b: number) => Math.max(r, g, b) - Math.min(r, g, b) > 0.18;

interface Petite {
  w: number;
  h: number;
  f: number;
  R: Float32Array;
  G: Float32Array;
  B: Float32Array;
  L: Float32Array;
  /** Le grain : l'écart moyen de la luminance à sa version adoucie, en pleine définition. */
  grain: Float32Array;
}

/** Flou en boîte de rayon r, ou r × ry (sommes glissantes, bords prolongés). */
function flou(src: Float32Array, w: number, h: number, r: number, ry = r): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let s = 0;
    for (let i = -r; i <= r; i++) s += src[o + Math.min(w - 1, Math.max(0, i))];
    for (let x = 0; x < w; x++) {
      tmp[o + x] = s / (2 * r + 1);
      s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let i = -ry; i <= ry; i++) s += tmp[Math.min(h - 1, Math.max(0, i)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / (2 * ry + 1);
      s += tmp[Math.min(h - 1, y + ry + 1) * w + x] - tmp[Math.max(0, y - ry) * w + x];
    }
  }
  return out;
}

/** Le flou de `src` pondéré par `poids` (0 à 1) ; là où il n'y a aucun poids, `defaut` (ou `src`). */
function flouPondere(
  src: Float32Array,
  poids: Float32Array,
  w: number,
  h: number,
  r: number,
  ry = r,
  defaut: Float32Array = src,
): Float32Array {
  const N = w * h;
  const sp = new Float32Array(N);
  for (let p = 0; p < N; p++) sp[p] = src[p] * poids[p];
  const num = flou(sp, w, h, r, ry);
  const den = flou(poids, w, h, r, ry);
  for (let p = 0; p < N; p++) num[p] = den[p] > 1e-3 ? num[p] / den[p] : defaut[p];
  return num;
}

function luminance(rgba: Uint8ClampedArray, W: number, H: number): Float32Array {
  const L = new Float32Array(W * H);
  for (let p = 0, o = 0; p < W * H; p++, o += 4) L[p] = lum(rgba[o], rgba[o + 1], rgba[o + 2]) / 255;
  return L;
}

function reduire(rgba: Uint8ClampedArray, W: number, H: number, Lp: Float32Array): Petite {
  const f = Math.max(1, Math.round(Math.max(W, H) / COTE_TRAVAIL));
  const w = Math.floor(W / f);
  const h = Math.floor(H / f);
  const adouci = flou(Lp, W, H, 1);
  const R = new Float32Array(w * h);
  const G = new Float32Array(w * h);
  const B = new Float32Array(w * h);
  const L = new Float32Array(w * h);
  const grain = new Float32Array(w * h);
  const n = f * f;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let e = 0;
      for (let j = 0; j < f; j++) {
        const ligne = (y * f + j) * W + x * f;
        for (let i = 0; i < f; i++) {
          const o = (ligne + i) * 4;
          r += rgba[o];
          g += rgba[o + 1];
          b += rgba[o + 2];
          e += Math.abs(Lp[ligne + i] - adouci[ligne + i]);
        }
      }
      const k = y * w + x;
      R[k] = r / (n * 255);
      G[k] = g / (n * 255);
      B[k] = b / (n * 255);
      L[k] = lum(R[k], G[k], B[k]);
      grain[k] = e / n;
    }
  return { w, h, f, R, G, B, L, grain };
}

/** Dilatation (ou érosion) d'un masque par un carré de côté 2r + 1. */
function morpho(m: Uint8Array, w: number, h: number, r: number, dilater: boolean): Uint8Array {
  const cible = dilater ? 1 : 0;
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let compte = 0;
    for (let i = 0; i <= r && i < w; i++) if (m[o + i] === cible) compte++;
    for (let x = 0; x < w; x++) {
      tmp[o + x] = compte > 0 ? cible : 1 - cible;
      if (x + r + 1 < w && m[o + x + r + 1] === cible) compte++;
      if (x - r >= 0 && m[o + x - r] === cible) compte--;
    }
  }
  for (let x = 0; x < w; x++) {
    let compte = 0;
    for (let i = 0; i <= r && i < h; i++) if (tmp[i * w + x] === cible) compte++;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = compte > 0 ? cible : 1 - cible;
      if (y + r + 1 < h && tmp[(y + r + 1) * w + x] === cible) compte++;
      if (y - r >= 0 && tmp[(y - r) * w + x] === cible) compte--;
    }
  }
  return out;
}

/**
 * Les régions d'un seul tenant d'un masque (4-connexité) : le numéro de
 * région de chaque pixel (-1 hors masque) et la taille de chacune.
 */
function regions(m: Uint8Array, w: number, h: number): { id: Int32Array; tailles: number[] } {
  const N = w * h;
  const id = new Int32Array(N).fill(-1);
  const file = new Int32Array(N);
  const tailles: number[] = [];
  for (let p0 = 0; p0 < N; p0++) {
    if (!m[p0] || id[p0] >= 0) continue;
    const n = tailles.length;
    let tete = 0;
    let queue = 0;
    file[queue++] = p0;
    id[p0] = n;
    while (tete < queue) {
      const p = file[tete++];
      const x = p % w;
      if (x > 0 && m[p - 1] && id[p - 1] < 0) {
        id[p - 1] = n;
        file[queue++] = p - 1;
      }
      if (x < w - 1 && m[p + 1] && id[p + 1] < 0) {
        id[p + 1] = n;
        file[queue++] = p + 1;
      }
      if (p >= w && m[p - w] && id[p - w] < 0) {
        id[p - w] = n;
        file[queue++] = p - w;
      }
      if (p + w < N && m[p + w] && id[p + w] < 0) {
        id[p + w] = n;
        file[queue++] = p + w;
      }
    }
    tailles.push(queue);
  }
  return { id, tailles };
}

function plusGrandeRegion(m: Uint8Array, w: number, h: number): Uint8Array {
  const { id, tailles } = regions(m, w, h);
  let meilleure = -1;
  for (let i = 0; i < tailles.length; i++) if (meilleure < 0 || tailles[i] > tailles[meilleure]) meilleure = i;
  const out = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) out[p] = id[p] === meilleure && meilleure >= 0 ? 1 : 0;
  return out;
}

/** Bouche les trous du masque : ce qui n'est pas relié au bord de l'image. */
function boucher(m: Uint8Array, w: number, h: number): Uint8Array {
  const N = w * h;
  const dehors = new Uint8Array(N);
  const file = new Int32Array(N);
  let queue = 0;
  for (let p = 0; p < N; p++) {
    const x = p % w;
    const y = (p / w) | 0;
    if ((x === 0 || y === 0 || x === w - 1 || y === h - 1) && !m[p]) {
      dehors[p] = 1;
      file[queue++] = p;
    }
  }
  let tete = 0;
  while (tete < queue) {
    const p = file[tete++];
    const x = p % w;
    if (x > 0 && !m[p - 1] && !dehors[p - 1]) {
      dehors[p - 1] = 1;
      file[queue++] = p - 1;
    }
    if (x < w - 1 && !m[p + 1] && !dehors[p + 1]) {
      dehors[p + 1] = 1;
      file[queue++] = p + 1;
    }
    if (p >= w && !m[p - w] && !dehors[p - w]) {
      dehors[p - w] = 1;
      file[queue++] = p - w;
    }
    if (p + w < N && !m[p + w] && !dehors[p + w]) {
      dehors[p + w] = 1;
      file[queue++] = p + w;
    }
  }
  const out = new Uint8Array(N);
  for (let p = 0; p < N; p++) out[p] = dehors[p] ? 0 : 1;
  return out;
}

/** L'intensité des contours, en 256 niveaux (Sobel sur l'image à peine adoucie). */
function contours(P: Petite): Uint8Array {
  const { w, h } = P;
  const canaux = [P.R, P.G, P.B].map((c) => flou(c, w, h, 1));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const xm = Math.max(0, x - 1);
      const xp = Math.min(w - 1, x + 1);
      const ym = Math.max(0, y - 1);
      const yp = Math.min(h - 1, y + 1);
      let s = 0;
      for (const c of canaux) {
        const gx =
          c[ym * w + xp] + 2 * c[y * w + xp] + c[yp * w + xp] - c[ym * w + xm] - 2 * c[y * w + xm] - c[yp * w + xm];
        const gy =
          c[yp * w + xm] + 2 * c[yp * w + x] + c[yp * w + xp] - c[ym * w + xm] - 2 * c[ym * w + x] - c[ym * w + xp];
        s += gx * gx + gy * gy;
      }
      out[y * w + x] = Math.min(255, Math.round(Math.sqrt(s) * 255));
    }
  return out;
}

/**
 * Ligne de partage des eaux à partir de graines : les pixels sont pris dans
 * l'ordre des contours les plus faibles, chacun rejoint la région qui
 * l'atteint la première. Les étiquettes de `murs` (masque de bits) ne
 * s'étendent pas.
 */
function partager(grad: Uint8Array, lab: Uint8Array, w: number, h: number, murs = 0): void {
  const N = w * h;
  const tetes = new Int32Array(256).fill(-1);
  const cap = 4 * N + 4;
  const pix = new Int32Array(cap);
  const etiq = new Uint8Array(cap);
  const suiv = new Int32Array(cap);
  let n = 0;
  const pousser = (q: number, l: number, niveau: number) => {
    pix[n] = q;
    etiq[n] = l;
    suiv[n] = tetes[niveau];
    tetes[niveau] = n;
    n++;
  };
  const voisins = (p: number, l: number, plancher: number) => {
    const x = p % w;
    if (x > 0 && !lab[p - 1]) pousser(p - 1, l, Math.max(grad[p - 1], plancher));
    if (x < w - 1 && !lab[p + 1]) pousser(p + 1, l, Math.max(grad[p + 1], plancher));
    if (p >= w && !lab[p - w]) pousser(p - w, l, Math.max(grad[p - w], plancher));
    if (p + w < N && !lab[p + w]) pousser(p + w, l, Math.max(grad[p + w], plancher));
  };
  for (let p = 0; p < N; p++) if (lab[p] && !((murs >> lab[p]) & 1)) voisins(p, lab[p], 0);
  let niveau = 0;
  while (niveau < 256) {
    const i = tetes[niveau];
    if (i < 0) {
      niveau++;
      continue;
    }
    tetes[niveau] = suiv[i];
    const p = pix[i];
    if (lab[p]) continue;
    lab[p] = etiq[i];
    if (n + 4 <= cap) voisins(p, etiq[i], niveau);
  }
}

/** La couleur du maillot, lue sur la poitrine (en bas au centre), hors peau. */
function couleurDuMaillot(P: Petite): Teinte | null {
  const { w, h, R, G, B, L } = P;
  const lums: number[] = [];
  for (let y = Math.floor(h * 0.88); y < Math.floor(h * 0.99); y++)
    for (let x = Math.floor(w * 0.3); x < Math.floor(w * 0.7); x++) {
      const k = y * w + x;
      if (!estPeau(R[k], G[k], B[k]) && !estVif(R[k], G[k], B[k])) lums.push(L[k]);
    }
  if (lums.length < 50) return null;
  lums.sort((a, b) => a - b);
  const mediane = lums[lums.length >> 1];
  if (mediane >= 0.5) return "blanc";
  if (mediane <= 0.3) return "noir";
  return null;
}

/**
 * Un tissu sûr du maillot : neutre, clair pour le blanc (ses ombres les plus
 * profondes aussi, sous le bras, plus sombres qu'une peau à l'ombre et sans
 * sa chaleur, et ses marquages noirs), sombre pour le noir (et ses marquages
 * blancs : le col, les logos, les bandes des manches).
 */
const estTissu = (teinte: Teinte, r: number, g: number, b: number) => {
  const c = Math.max(r, g, b) - Math.min(r, g, b);
  const l = lum(r, g, b);
  if (teinte === "noir") return (c < 0.1 && l < 0.25) || (c < 0.06 && l > 0.6);
  return (c < 0.1 && l > 0.5) || (c < 0.05 && l < 0.3);
};

/**
 * Le fond : ce qui est flou et relié au haut ou aux côtés de l'image, puis
 * son bord exact, repris sur le contour le plus franc d'une bande étroite.
 * Rend 1 pour le joueur, 0 pour le fond.
 */
function detourer(P: Petite, grad: Uint8Array): Uint8Array {
  const { w, h } = P;
  const N = w * h;
  const net = flou(P.grain, w, h, 3);
  const fond = new Uint8Array(N);
  const file = new Int32Array(N);
  let queue = 0;
  for (let p = 0; p < N; p++) {
    const x = p % w;
    const y = (p / w) | 0;
    const bord = y < h * 0.03 || ((x < w * 0.03 || x >= w * 0.97) && y < h * 0.6);
    if (bord && net[p] < SEUIL_FLOU) {
      fond[p] = 1;
      file[queue++] = p;
    }
  }
  let tete = 0;
  while (tete < queue) {
    const p = file[tete++];
    const x = p % w;
    const essayer = (q: number) => {
      if (!fond[q] && net[q] < SEUIL_FLOU) {
        fond[q] = 1;
        file[queue++] = q;
      }
    };
    if (x > 0) essayer(p - 1);
    if (x < w - 1) essayer(p + 1);
    if (p >= w) essayer(p - w);
    if (p + w < N) essayer(p + w);
  }
  // Le flou du grain déborde de 3 px sur le joueur : on rend la bande au partage.
  const surFond = morpho(fond, w, h, 1, false);
  const surJoueur = morpho(fond, w, h, 6, true);
  const lab = new Uint8Array(N);
  for (let p = 0; p < N; p++) lab[p] = surFond[p] ? FOND : surJoueur[p] ? 0 : JOUEUR;
  partager(grad, lab, w, h);
  const joueur = new Uint8Array(N);
  for (let p = 0; p < N; p++) joueur[p] = lab[p] === JOUEUR ? 1 : 0;
  return joueur;
}

/**
 * La peau qui compte : le visage (la plus grande peau du milieu de l'image),
 * avec ce qui pend juste dessous, au milieu (le cou sous une barbe, le creux
 * du col), et le cœur des bras (une peau qui touche le bas ou les côtés de
 * l'image, rongée de 2 px : le satin à l'ombre contre le bras, rougi par un
 * drapeau, peut en avoir la couleur). Le reste de ce qui a la couleur de la
 * peau est un reflet sur le satin : il n'en est pas.
 *
 * Rend aussi la limite basse de la tête, colonne par colonne (-1 : aucune) :
 * le bas du visage et du cou dans la colonne, sans descendre sous le haut du
 * col (le bas du cou au milieu du visage), un peu élargi pour les cheveux.
 */
function peauEtTete(
  P: Petite,
  peau: Uint8Array,
): { visage: Uint8Array; bras: Uint8Array; limite: Int32Array } | null {
  const { w, h } = P;
  const N = w * h;
  const { id, tailles } = regions(peau, w, h);
  const n = tailles.length;
  const sx = new Float64Array(n);
  const sy = new Float64Array(n);
  const haut = new Int32Array(n).fill(h);
  const auBord = new Uint8Array(n);
  for (let p = 0; p < N; p++) {
    const i = id[p];
    if (i < 0) continue;
    const x = p % w;
    const y = (p / w) | 0;
    sx[i] += x;
    sy[i] += y;
    if (y < haut[i]) haut[i] = y;
    if (y === h - 1 || ((x === 0 || x === w - 1) && y > h * 0.5)) auBord[i] = 1;
  }
  let visage = -1;
  for (let i = 0; i < n; i++) {
    const cx = sx[i] / tailles[i];
    const cy = sy[i] / tailles[i];
    if (cx < w * 0.3 || cx > w * 0.7 || cy > h * 0.7) continue;
    if (visage < 0 || tailles[i] > tailles[visage]) visage = i;
  }
  if (visage < 0 || tailles[visage] < N * 0.04) return null;
  let x0 = w;
  let x1 = -1;
  let basVisage = 0;
  for (let p = 0; p < N; p++)
    if (id[p] === visage) {
      x0 = Math.min(x0, p % w);
      x1 = Math.max(x1, p % w);
      basVisage = Math.max(basVisage, (p / w) | 0);
    }
  const l = x1 - x0;
  const duVisage = new Uint8Array(n);
  duVisage[visage] = 1;
  for (let i = 0; i < n; i++) {
    const cx = sx[i] / tailles[i];
    const auMilieu = cx >= x0 + l * 0.25 && cx <= x1 - l * 0.25;
    if (i !== visage && tailles[i] > N * 0.002 && auMilieu && haut[i] <= basVisage + h * 0.15) duVisage[i] = 1;
  }
  // Un bras a la saturation d'une peau, au moins les trois quarts de celle du
  // visage ; un reflet chaud sur le satin blanc, à côté du bras, est plus gris.
  const { R, B } = P;
  const saturation = (p: number) => (R[p] - B[p]) / Math.max(R[p], 1e-3);
  const parRegion: number[][] = [];
  for (let i = 0; i < n; i++) parRegion.push([]);
  for (let p = 0; p < N; p++) {
    const i = id[p];
    if (i >= 0 && (i === visage || (auBord[i] && tailles[i] > N * 0.002))) parRegion[i].push(saturation(p));
  }
  const mediane = (v: number[]) => (v.length ? v.sort((a, b) => a - b)[v.length >> 1] : 0);
  const satVisage = mediane(parRegion[visage]);
  const estBras = new Uint8Array(n);
  for (let i = 0; i < n; i++)
    if (i !== visage && !duVisage[i] && parRegion[i].length && mediane(parRegion[i]) >= satVisage * 0.75) estBras[i] = 1;
  const visageEtCou = new Uint8Array(N);
  const bras = new Uint8Array(N);
  const bas = new Int32Array(w).fill(-1);
  for (let p = 0; p < N; p++) {
    const i = id[p];
    if (i < 0) continue;
    if (duVisage[i]) {
      const x = p % w;
      const y = (p / w) | 0;
      if (y > bas[x]) bas[x] = y;
      visageEtCou[p] = 1;
    } else if (estBras[i]) bras[p] = 1;
  }
  // Le haut du col : le plus haut des bas du cou, au milieu du visage.
  let col = h;
  for (let x = Math.round(x0 + l * 0.3); x <= Math.round(x1 - l * 0.3); x++) if (bas[x] >= 0) col = Math.min(col, bas[x]);
  if (col === h) return null;
  const marge = Math.round(l * 0.08);
  const limite = new Int32Array(w).fill(-1);
  for (let x = Math.max(0, x0 - marge); x <= Math.min(w - 1, x1 + marge); x++)
    limite[x] = Math.min(col, bas[Math.min(x1, Math.max(x0, x))]);
  return { visage: visageEtCou, bras: auBordSeulement(morpho(bras, w, h, 2, false), w, h), limite };
}

/** Les morceaux d'un masque qui touchent le bas de l'image, ou ses côtés sous la mi-hauteur. */
function auBordSeulement(m: Uint8Array, w: number, h: number): Uint8Array {
  const { id, tailles } = regions(m, w, h);
  const garde = new Uint8Array(tailles.length);
  for (let p = 0; p < w * h; p++) {
    if (id[p] < 0) continue;
    const x = p % w;
    const y = (p / w) | 0;
    if (y === h - 1 || ((x === 0 || x === w - 1) && y > h * 0.5)) garde[id[p]] = 1;
  }
  const out = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) out[p] = id[p] >= 0 && garde[id[p]] ? 1 : 0;
  return out;
}

/**
 * Les bras : leur cœur, regagné de quelques pixels dans la peau brute qui le
 * touche (les bords que la peau ouverte et rongée avait perdus), pas plus :
 * un reflet chaud sur le satin, collé au bras, reste au maillot. Sous la
 * manche d'un maillot blanc, l'ombre très sombre collée au bras est du bras
 * (trop sombre pour avoir la couleur d'une peau) : `peauBrute` la compte.
 */
function brasGagnes(coeur: Uint8Array, peauBrute: Uint8Array, w: number, h: number, pas: number): Uint8Array {
  let bras = coeur;
  for (let i = 0; i < pas; i++) {
    const plus = morpho(bras, w, h, 1, true);
    for (let p = 0; p < w * h; p++) plus[p] = bras[p] || (plus[p] && peauBrute[p]) ? 1 : 0;
    bras = plus;
  }
  return bras;
}

/**
 * La tête : ce qu'on atteint depuis le visage sans sortir de la zone de la
 * tête ni traverser un tissu clair (le maillot blanc, ou le col blanc du
 * maillot noir) : les cheveux, la barbe, le cou. Le haut des épaules, que la
 * zone touche parfois à côté du col, reste au maillot.
 */
function teteGagnee(P: Petite, teinte: Teinte, visage: Uint8Array, limite: Int32Array, joueur: Uint8Array): Uint8Array {
  const { w, h, R, G, B, L } = P;
  const N = w * h;
  const tete = new Uint8Array(N);
  const file = new Int32Array(N);
  let queue = 0;
  for (let p = 0; p < N; p++)
    if (visage[p]) {
      tete[p] = 1;
      file[queue++] = p;
    }
  const passe = (q: number) => {
    if (tete[q] || !joueur[q] || ((q / w) | 0) > limite[q % w]) return false;
    const c = Math.max(R[q], G[q], B[q]) - Math.min(R[q], G[q], B[q]);
    // Un tissu clair arrête la tête ; sur un maillot blanc, ses ombres grises aussi
    // (près du col), alors que la peau reste chaude et les cheveux sombres.
    if (L[q] > 0.5 && c < 0.1) return false;
    return !(teinte === "blanc" && L[q] > 0.3 && c < 0.07);
  };
  let tete0 = 0;
  while (tete0 < queue) {
    const p = file[tete0++];
    const x = p % w;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p + w < N ? p + w : -1])
      if (q >= 0 && passe(q)) {
        tete[q] = 1;
        file[queue++] = q;
      }
  }
  return tete;
}

/** Le masque du maillot (et celui du joueur) à la définition de travail, ou un refus. */
function trouverMaillot(
  P: Petite,
  diag: Diagnostic,
  vers?: Teinte,
): { maillot: Uint8Array; joueur: Uint8Array } | null {
  const { w, h, R, G, B } = P;
  const N = w * h;
  const teinte = couleurDuMaillot(P);
  diag.maillot = teinte;
  if (!teinte) {
    diag.refus = "maillot ni blanc ni noir";
    return null;
  }
  // Déjà dans la couleur voulue : rien à chercher de plus.
  if (teinte === vers) return null;
  const grad = contours(P);
  const joueur = detourer(P, grad);
  // La peau sur le joueur seulement (le fondu entre deux couleurs d'un drapeau
  // en a parfois la teinte), sans les ponts de 1 ou 2 px qui la relient à un
  // reflet chaud sur le satin.
  const peauBrute = new Uint8Array(N);
  for (let p = 0; p < N; p++) peauBrute[p] = joueur[p] && estPeau(R[p], G[p], B[p]) ? 1 : 0;
  const peau = morpho(morpho(peauBrute, w, h, 2, false), w, h, 2, true);
  const tete = peauEtTete(P, peau);
  if (!tete) {
    diag.refus = "pas de visage";
    return null;
  }
  diag.limite = tete.limite;
  diag.visage = tete.visage;
  const laTete = teteGagnee(P, teinte, tete.visage, tete.limite, joueur);
  const milieuBras = peauBrute.slice();
  if (teinte === "blanc") for (let p = 0; p < N; p++) if (joueur[p] && P.L[p] < 0.12) milieuBras[p] = 1;
  const bras = brasGagnes(tete.bras, milieuBras, w, h, 5);
  const lab = new Uint8Array(N);
  for (let p = 0; p < N; p++) {
    const y = (p / w) | 0;
    if (!joueur[p]) lab[p] = FOND;
    else if (laTete[p]) lab[p] = AUTRE;
    else if (bras[p]) lab[p] = BRAS;
    else if (y > h * 0.45 && y > tete.limite[p % w] && estTissu(teinte, R[p], G[p], B[p])) lab[p] = MAILLOT;
  }
  diag.graines = lab.slice();
  partager(grad, lab, w, h, (1 << FOND) | (1 << BRAS));
  diag.etiquettes = lab.slice();
  let m: Uint8Array = new Uint8Array(N);
  for (let p = 0; p < N; p++) m[p] = lab[p] === MAILLOT ? 1 : 0;
  // Les miettes se détachent, la plus grande pièce reste, ses trous se bouchent (hors peau).
  m = morpho(morpho(m, w, h, 1, false), w, h, 1, true);
  m = boucher(plusGrandeRegion(m, w, h), w, h);
  // Ni le visage, ni le fond, ni une couleur franchement vive (un bout de drapeau).
  for (let p = 0; p < N; p++)
    if (tete.visage[p] || !joueur[p] || Math.max(R[p], G[p], B[p]) - Math.min(R[p], G[p], B[p]) > 0.3) m[p] = 0;
  diag.masque = m;
  // Garde-fous.
  let aire = 0;
  let gauche = 0;
  let haut = 0;
  let bas = 0;
  for (let p = 0; p < N; p++) {
    if (!m[p]) continue;
    aire++;
    const x = p % w;
    const y = (p / w) | 0;
    if (x < w / 2) gauche++;
    if (y < h * 0.4) haut++;
    if (y === h - 1) bas++;
  }
  if (aire < N * 0.12) diag.refus = "maillot trop petit";
  else if (aire > N * 0.7) diag.refus = "maillot trop grand";
  else if (haut > N * 0.004) diag.refus = "maillot trop haut";
  else if (bas < w * 0.35) diag.refus = "maillot loin du bas";
  else if (gauche / aire < 0.36 || gauche / aire > 0.64) diag.refus = "maillot dissymétrique";
  return diag.refus ? null : { maillot: m, joueur };
}

/**
 * Repeint le maillot de la photo (RGBA, W × H) en `vers`. Rend les nouveaux
 * pixels, ou null si la photo doit rester telle quelle (déjà dans la bonne
 * couleur, ou maillot introuvable).
 */
export function calquerMaillot(
  rgba: Uint8ClampedArray,
  W: number,
  H: number,
  vers: Teinte,
  diag: Diagnostic = { maillot: null },
): Uint8ClampedArray | null {
  const Lp = luminance(rgba, W, H);
  const P = reduire(rgba, W, H, Lp);
  diag.largeur = P.w;
  diag.hauteur = P.h;
  const trouve = trouverMaillot(P, diag, vers);
  if (!trouve || !diag.maillot || diag.maillot === vers) return null;
  return repeindre(rgba, W, H, Lp, P, trouve.maillot, trouve.joueur, diag.maillot, vers, diag);
}

/**
 * Les tons du tissu de chaque maillot, relevés sur les photos du studio
 * (23/10/2026 : 12 maillots noirs, 29 blancs, sans les galons ni les logos) :
 * la luminance aux rangs RANGS, moyenne des photos. Le noir est un satin
 * froid, à peine bleuté ; le blanc est neutre.
 */
const RANGS = [0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.98, 1];
const TONS: Record<Teinte, number[]> = {
  noir: [0, 0.007, 0.013, 0.019, 0.026, 0.033, 0.045, 0.059, 0.075, 0.095, 0.118, 0.148, 0.169, 0.2, 0.25, 0.305, 0.45],
  blanc: [0.2, 0.261, 0.337, 0.478, 0.593, 0.663, 0.737, 0.785, 0.822, 0.852, 0.876, 0.899, 0.911, 0.924, 0.939, 0.951, 0.996],
};
const TEINTES: Record<Teinte, [number, number, number]> = { noir: [0.904, 1.015, 1.12], blanc: [1, 1, 1] };
/**
 * L'ombrage est lu sur la photo adoucie (rayons en largeur et en hauteur,
 * pour une photo de 896 px) : bien plus large vers le blanc, et surtout en
 * largeur, où les reflets serrés du satin noir et ses fines rayures
 * verticales feraient un blanc marbré, rayé de gris (le vrai blanc est uni).
 * Le grain d'origine est remis par-dessus, à cette force.
 */
const ADOUCI: Record<Teinte, [number, number]> = { noir: [2, 2], blanc: [24, 6] };
const GRAIN: Record<Teinte, number> = { noir: 0.25, blanc: 0.3 };
/**
 * Les marquages de l'autre maillot sont l'inverse : le col, les logos et les
 * bandes des manches du blanc sont noirs, ceux du noir sont blancs. Leur
 * luminance une fois inversés : le noir d'une encre, ou le blanc du tissu
 * blanc juste autour (il garde l'éclairage).
 */
const ENCRE_NOIRE = 0.035;

/** La luminance au rang t (0 à 1) du maillot `teinte`. */
function tonAuRang(teinte: Teinte, t: number): number {
  const tons = TONS[teinte];
  let i = 1;
  while (i < RANGS.length - 1 && RANGS[i] < t) i++;
  const u = (t - RANGS[i - 1]) / (RANGS[i] - RANGS[i - 1]);
  return tons[i - 1] + Math.min(1, Math.max(0, u)) * (tons[i] - tons[i - 1]);
}

/** Un masque de travail agrandi à la pleine définition (bilinéaire, 0 à 1). */
function agrandir(m: Uint8Array, w: number, h: number, f: number, W: number, H: number): Float32Array {
  const out = new Float32Array(W * H);
  for (let Y = 0; Y < H; Y++) {
    const fy = Math.min(h - 1, Math.max(0, (Y + 0.5) / f - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(h - 1, y0 + 1);
    const v = fy - y0;
    for (let X = 0; X < W; X++) {
      const fx = Math.min(w - 1, Math.max(0, (X + 0.5) / f - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(w - 1, x0 + 1);
      const u = fx - x0;
      out[Y * W + X] =
        (1 - v) * ((1 - u) * m[y0 * w + x0] + u * m[y0 * w + x1]) + v * ((1 - u) * m[y1 * w + x0] + u * m[y1 * w + x1]);
    }
  }
  return out;
}

/**
 * Le bord du maillot contre le fond, repris en pleine définition : le masque
 * de travail n'a qu'un pixel sur deux. Dans une bande de quelques pixels, un
 * pixel est d'autant plus maillot que sa couleur est proche de celle du
 * maillot juste à côté, et loin de celle du fond juste à côté. Le maillot à
 * côté, c'est son tissu sombre ou son tissu clair, le plus proche des deux
 * (une bande blanche de la manche du noir touche le bord), sauf celui qui a
 * presque la couleur du fond (un liseré de lumière contre un fond clair).
 *
 * Rend aussi, dans cette bande, la couleur du fond juste à côté : un pixel de
 * bord est un mélange de l'ancien tissu et du fond, on le recompose avec le
 * nouveau tissu et ce fond (sinon l'ancien tissu y reste, en liseré).
 */
function bordAuFond(
  rgba: Uint8ClampedArray,
  W: number,
  H: number,
  Lp: Float32Array,
  brut: Float32Array,
  fond: Float32Array,
): { alpha: Float32Array; fondVoisin: Float32Array } {
  const N = W * H;
  const alpha = flou(brut, W, H, 1);
  const sombre = new Float32Array(N);
  const clair = new Float32Array(N);
  const dehors = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    const dedans = brut[p] > 0.999;
    sombre[p] = dedans && Lp[p] < 0.45 ? 1 : 0;
    clair[p] = dedans && Lp[p] >= 0.45 ? 1 : 0;
    dehors[p] = brut[p] < 0.001 && fond[p] > 0.5 ? 1 : 0;
  }
  const R = 5;
  const parts = [sombre, clair, dehors].map((poids) => {
    const n = flou(poids, W, H, R);
    const somme = [0, 1, 2].map((c) => {
      const a = new Float32Array(N);
      for (let p = 0; p < N; p++) a[p] = poids[p] * rgba[p * 4 + c];
      return flou(a, W, H, R);
    });
    return { n, somme };
  });
  const distance = (p: number, i: number) => {
    const { n, somme } = parts[i];
    let d = 0;
    for (let c = 0; c < 3; c++) d += (rgba[p * 4 + c] - somme[c][p] / n[p]) ** 2;
    return Math.sqrt(d);
  };
  // Un tissu à moins de 60 (sur 441) de la couleur du fond ne départage rien.
  const distinct = (p: number, i: number) => {
    const a = parts[i];
    const b = parts[2];
    let d = 0;
    for (let c = 0; c < 3; c++) d += (a.somme[c][p] / a.n[p] - b.somme[c][p] / b.n[p]) ** 2;
    return d > 60 * 60;
  };
  const proche = flou(brut, W, H, 3);
  const doux = flou(brut, W, H, 3);
  for (let p = 0; p < N; p++) doux[p] = doux[p] * doux[p] * (3 - 2 * doux[p]);
  // La couleur du fond voisin (RGB, 0 à 255), -1 hors de la bande.
  const fondVoisin = new Float32Array(N * 3).fill(-1);
  for (let p = 0; p < N; p++) {
    if (proche[p] <= 0.001 || proche[p] >= 0.999 || parts[2].n[p] < 0.05) continue;
    for (let c = 0; c < 3; c++) fondVoisin[p * 3 + c] = parts[2].somme[c][p] / parts[2].n[p];
    const nS = parts[0].n[p];
    const nC = parts[1].n[p];
    if (nS + nC < 0.05) continue;
    const dS = nS >= 0.02 && distinct(p, 0) ? distance(p, 0) : Infinity;
    const dC = nC >= 0.02 && distinct(p, 1) ? distance(p, 1) : Infinity;
    const dIn = Math.min(dS, dC);
    if (dIn === Infinity) {
      alpha[p] = doux[p];
      continue;
    }
    const dOut = distance(p, 2);
    const a = dOut / (dIn + dOut + 1e-6);
    alpha[p] = a * a * (3 - 2 * a);
  }
  return { alpha, fondVoisin };
}

/**
 * Les marquages du maillot : sur le blanc, ce qui est noir et neutre, bien
 * plus sombre que le tissu autour (pas une ombre, large et douce) ; sur le
 * noir, ce qui est blanc et neutre. Une zone de marquage part d'un pixel
 * franc (encre noire, blanc pur) et s'étend à ce qui lui ressemble, plus un
 * pixel de bord ; chaque pixel y vaut sa part d'encre (0 à 1), lue entre le
 * tissu autour (sans les marquages) et l'encre. Rend aussi ce tissu autour.
 */
function marquages(
  rgba: Uint8ClampedArray,
  W: number,
  H: number,
  Lp: Float32Array,
  alpha: Float32Array,
  fond: Float32Array,
  de: Teinte,
): { part: Float32Array; tissuAutour: Float32Array } {
  const N = W * H;
  const r = Math.round((12 * W) / 896);
  const encre = de === "blanc" ? 0.04 : 0.9;
  const neutre = (o: number) => Math.max(rgba[o], rgba[o + 1], rgba[o + 2]) - Math.min(rgba[o], rgba[o + 1], rgba[o + 2]);
  // Le niveau du tissu autour, une première fois avec les marquages.
  let autour = flouPondere(Lp, alpha, W, H, r);
  const membre = new Uint8Array(N);
  const file = new Int32Array(N);
  let queue = 0;
  const candidat = new Uint8Array(N);
  for (let p = 0, o = 0; p < N; p++, o += 4) {
    if (alpha[p] <= 0.02) continue;
    const c = neutre(o) / 255;
    if (c >= 0.15) continue;
    const l = Lp[p];
    if (de === "blanc" ? l < 0.45 && l < 0.6 * autour[p] : l > 0.4) candidat[p] = 1;
    // Franc : l'encre des lettres est d'un gris très sombre, pas toujours noire.
    if (c < 0.12 && (de === "blanc" ? l < 0.2 && l < 0.3 * autour[p] : l > 0.72)) {
      membre[p] = 1;
      file[queue++] = p;
    }
  }
  let tete = 0;
  while (tete < queue) {
    const p = file[tete++];
    const x = p % W;
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W])
      if (q >= 0 && q < N && candidat[q] && !membre[q]) {
        membre[q] = 1;
        file[queue++] = q;
      }
  }
  // Le liseré de lumière (ou d'ombre) le long du bord contre le fond n'en est
  // pas un : une zone surtout à moins de 10 px du fond est rendue au tissu.
  const auFond = new Uint8Array(N);
  for (let p = 0; p < N; p++) auFond[p] = fond[p] > 0.5 ? 1 : 0;
  const presDuFond = morpho(auFond, W, H, Math.round((10 * W) / 896), true);
  // Un marquage est cousu sur le tissu : une zone dont le tour est surtout
  // hors du maillot (l'ombre sous la manche, contre le bras) n'en est pas un.
  const { id, tailles } = regions(membre, W, H);
  const pres = new Int32Array(tailles.length);
  const tour = new Int32Array(tailles.length);
  const tourDehors = new Int32Array(tailles.length);
  for (let p = 0; p < N; p++) {
    if (id[p] >= 0) {
      if (presDuFond[p]) pres[id[p]]++;
      continue;
    }
    const x = p % W;
    const voisin = Math.max(
      x > 0 ? id[p - 1] : -1,
      x < W - 1 ? id[p + 1] : -1,
      p >= W ? id[p - W] : -1,
      p + W < N ? id[p + W] : -1,
    );
    if (voisin < 0) continue;
    tour[voisin]++;
    if (alpha[p] < 0.5) tourDehors[voisin]++;
  }
  for (let p = 0; p < N; p++) {
    const i = id[p];
    if (i >= 0 && (pres[i] > tailles[i] * 0.5 || tourDehors[i] > tour[i] * 0.6)) membre[p] = 0;
  }
  // Le tissu autour, cette fois sans les marquages (loin de tout tissu : le tissu moyen).
  const poids = new Float32Array(N);
  let somme = 0;
  let nombre = 0;
  for (let p = 0; p < N; p++) {
    poids[p] = membre[p] ? 0 : alpha[p];
    if (poids[p] > 0.5) {
      somme += Lp[p];
      nombre++;
    }
  }
  const moyen = new Float32Array(N).fill(nombre ? somme / nombre : de === "blanc" ? 0.85 : 0.08);
  const large = flouPondere(Lp, poids, W, H, r * 4, r * 4, moyen);
  autour = flouPondere(Lp, poids, W, H, r, r, large);
  const zone = morpho(membre, W, H, 1, true);
  const part = new Float32Array(N);
  for (let p = 0; p < N; p++) {
    if (!zone[p] || alpha[p] <= 0.02) continue;
    const t = (Lp[p] - autour[p]) / (encre - autour[p]);
    part[p] = Math.min(1, Math.max(0, t));
  }
  return { part, tissuAutour: autour };
}

/**
 * Le maillot repeint en pleine définition : chaque pixel du tissu prend le
 * ton de même rang dans l'autre maillot (l'ombrage de la photo est gardé, le
 * blanc le plus clair devient le noir le plus clair), un peu du grain
 * d'origine par-dessus, à la teinte du maillot ; les marquages s'inversent ;
 * le bord contre le fond est repris au pixel près, celui contre la peau fondu
 * sur un pixel.
 */
function repeindre(
  rgba: Uint8ClampedArray,
  W: number,
  H: number,
  Lp: Float32Array,
  P: Petite,
  m: Uint8Array,
  joueur: Uint8Array,
  de: Teinte,
  vers: Teinte,
  diag: Diagnostic,
): Uint8ClampedArray {
  const { w, h, f } = P;
  const N = W * H;
  const fond = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) fond[p] = joueur[p] ? 0 : 1;
  const fondPlein = agrandir(fond, w, h, f, W, H);
  const { alpha, fondVoisin } = bordAuFond(rgba, W, H, Lp, agrandir(m, w, h, f, W, H), fondPlein);
  const { part: mk, tissuAutour } = marquages(rgba, W, H, Lp, alpha, fondPlein, de);
  diag.marquage = mk;
  // L'ombrage du tissu seul : la luminance adoucie sans les marquages ni le fond.
  const tissu = new Float32Array(N);
  for (let p = 0; p < N; p++) tissu[p] = alpha[p] * (1 - mk[p]);
  const k = W / 896;
  const [rx, ry] = ADOUCI[vers];
  const adoucie = flouPondere(Lp, tissu, W, H, Math.max(1, Math.round(rx * k)), Math.max(1, Math.round(ry * k)));
  // Les rangs : l'histogramme de la luminance adoucie sur le tissu.
  const CASES = 1024;
  const histo = new Float64Array(CASES + 1);
  let total = 0;
  for (let p = 0; p < N; p++)
    if (alpha[p] > 0.5 && mk[p] < 0.5) {
      histo[Math.min(CASES - 1, Math.floor(adoucie[p] * CASES))]++;
      total++;
    }
  const cumul = new Float64Array(CASES + 1);
  for (let i = 0; i < CASES; i++) cumul[i + 1] = cumul[i] + histo[i] / Math.max(1, total);
  // Le ton visé pour chaque luminance d'origine : celui de son rang dans l'autre maillot.
  const ton = new Float32Array(CASES + 1);
  for (let i = 0; i <= CASES; i++) ton[i] = tonAuRang(vers, cumul[i]);
  const [tr, tg, tb] = TEINTES[vers];
  const grain = GRAIN[vers];
  const out = new Uint8ClampedArray(rgba);
  for (let p = 0, o = 0; p < N; p++, o += 4) {
    const a = alpha[p];
    if (a <= 0.002 && fondVoisin[p * 3] < 0) continue;
    const x = Math.min(CASES - 1e-6, Math.max(0, adoucie[p] * CASES));
    const i = Math.floor(x);
    const base = ton[i] + (x - i) * (ton[i + 1] - ton[i]);
    const l = Math.min(1, Math.max(0, base + grain * (Lp[p] - adoucie[p])));
    // Le marquage inversé : l'encre noire, ou le blanc du tissu d'origine autour.
    const encre = vers === "noir" ? Math.min(0.95, tissuAutour[p]) : ENCRE_NOIRE;
    const u = mk[p];
    // Contre le fond, le reste du pixel est le fond voisin, pas l'ancien tissu.
    const surFond = fondVoisin[p * 3] >= 0;
    const r0 = surFond ? fondVoisin[p * 3] : rgba[o];
    const g0 = surFond ? fondVoisin[p * 3 + 1] : rgba[o + 1];
    const b0 = surFond ? fondVoisin[p * 3 + 2] : rgba[o + 2];
    out[o] = (1 - a) * r0 + a * Math.min(255, ((1 - u) * l * tr + u * encre) * 255);
    out[o + 1] = (1 - a) * g0 + a * Math.min(255, ((1 - u) * l * tg + u * encre) * 255);
    out[o + 2] = (1 - a) * b0 + a * Math.min(255, ((1 - u) * l * tb + u * encre) * 255);
  }
  return out;
}
