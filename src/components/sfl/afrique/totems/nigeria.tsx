// Le totem du Nigeria (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// L'aigle martial (les Super Eagles), de trois quarts, à l'instant où il
// se pose : les serres viennent de se refermer sur le perchoir, les ailes
// sont encore levées, sans symétrie ; l'aile proche grande ouverte sur le
// côté, l'aile loin plus haute et raccourcie par la perspective ; les sept
// rémiges primaires de chaque main écartées en doigts effilés, un peu
// relevés, de longueurs graduées ; le poignet marqué ; le bord de fuite en
// S, des secondaires inégales ; la queue, étroite, qui tombe derrière le
// perchoir ; les culottes et les tarses emplumés jusqu'aux doigts ; trois
// doigts devant, refermés sur le perchoir, l'ongle du pouce qui revient
// dessous, et des serres qui le débordent (le pied d'un rapace, grand).
// Le perchoir est posé sur la couture de la grille d'adire (le skin la
// trace à y 950) : un bâton de réserve, ses points de couture au milieu.
// La tête de trois quarts, tournée vers la lune : celle de l'aigle martial,
// et non d'un pygargue ni d'un perroquet : sombre, comme la gorge et le
// haut du poitrail (le plastron), le crâne plat, une courte huppe couchée
// à la nuque ; l'œil en amande, l'iris crème et paille, la pupille grande,
// sous une arcade sombre qui lui mange le tiers du haut ; le bec noir fermé,
// crochu, la cire réduite à une bande étroite gris d'indigo ; sous le
// plastron, le ventre blanc semé de gouttes sombres. L'aigle du Mali, lui,
// plane vu de dessous ; le faucon d'Égypte est perché de profil sur sa
// pierre : trois oiseaux qu'on ne confond pas.
// Il est peint en adire eleko (../nigeria.tsx) : la pâte d'amidon posée à
// la plume sur le coton, puis l'indigo. Le blanc bleui est ce que la pâte a
// protégé : les pennes, le ventre, les culottes ; le dessin des plumes est
// ce que la plume a laissé nu (les hampes, les barres, le bord sombre des
// rémiges, les gouttes du ventre) ; la tête, le plastron et les couvertures
// du dessous de l'aile, sombres chez l'aigle martial, sont une pâte posée
// mince, que l'indigo a gagnée à moitié : un bleu moyen, et le dessin des
// plumes y revient en blanc. Tout est tracé à main levée : les pennes ont
// chacune leur longueur, leur courbe, leurs barres ; la graine fait trembler
// la plume (les contours, les barres, les craquelures), jamais la silhouette.
// Ni écusson ni symétrie : l'aigle ne se pose pas sur la lune, il la regarde.
//   · au dos : le héros, grand, les ailes d'un bord à l'autre du haut de
//     l'étoffe, posé sur la couture du cinquième rang (PERCHOIR_CARTE) ; la
//     lune en haut à gauche, sous son regard, dans la rosace de Zaria
//     (LUNE_NG : le skin la redessine autour), loin de ses serres ;
//   · à la face : le même aigle, en gaufrage dans le coin bas gauche du
//     portrait, à droite de l'équerre : une arête de lumière, une ombre.

import type { PropsTotem, TotemNation } from "../types";
import { alea, f } from "../outils";

/** La lune, en haut à gauche, sous le regard de l'aigle (le skin, ../nigeria.tsx, y pose la rosace de Zaria). */
export const LUNE_NG = { cx: 215, cy: 212, d: 120 } as const;
/** Le repère : les points sont posés dans un repère plus large, ramené par DECALE_NG dans la boîte 1032 × 950 qui serre l'aigle et son perchoir. */
export const DECALE_NG = "translate(-40 -60)";
const BOITE = { w: 1032, h: 950 } as const;
/** Ce que l'aigle couvre au dos, dans le repère de la carte (le skin y laisse l'étoffe unie). */
export const POSE_DOS_NG = { x: 512 - (BOITE.w * 0.915) / 2, y: 178, echelle: 0.915 } as const;

/* ------------------------------ Les tracés ------------------------------ */

type P = readonly [number, number] | readonly [number, number, number];
type Seg = [number, number, number, number, number, number, number, number];
type Rnd = () => number;
type Pt = [number, number];

/** Des points posés à la main, liés en béziers tendus (un tiers de corde) ; 1 : un angle, 2 : un angle adouci. */
function segments(pts: readonly P[], ferme = true): Seg[] {
  const n = pts.length;
  const at = (i: number) => pts[ferme ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const tg = (i: number): Pt => {
    const p = at(i);
    if (p[2] === 1 || (!ferme && (i <= 0 || i >= n - 1))) return [0, 0];
    const [a, b] = [at(i - 1), at(i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = p[2] === 2 ? 0.5 : 1;
    return [((b[0] - a[0]) / l) * k, ((b[1] - a[1]) / l) * k];
  };
  const out: Seg[] = [];
  for (let i = 0; i < (ferme ? n : n - 1); i++) {
    const [p, q] = [at(i), at(i + 1)];
    const c = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
    const [u, v] = [tg(i), tg(i + 1)];
    out.push([p[0], p[1], p[0] + u[0] * c, p[1] + u[1] * c, q[0] - v[0] * c, q[1] - v[1] * c, q[0], q[1]]);
  }
  return out;
}

function lisse(pts: readonly P[], ferme = true): string {
  const s = segments(pts, ferme);
  return `M${f(s[0][0])} ${f(s[0][1])}${s.map((g) => `C${f(g[2])} ${f(g[3])} ${f(g[4])} ${f(g[5])} ${f(g[6])} ${f(g[7])}`).join("")}${ferme ? "Z" : ""}`;
}

/** Le tracé lissé, échantillonné au pas donné : [x, y, normale x, normale y, abscisse]. */
function echantillons(pts: readonly P[], pas: number, ferme = true): [number, number, number, number, number][] {
  const fin: Pt[] = [];
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segments(pts, ferme))
    for (let k = fin.length ? 1 : 0; k <= 20; k++) {
      const t = k / 20;
      const u = 1 - t;
      fin.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
  const cum = [0];
  for (let i = 1; i < fin.length; i++) cum.push(cum[i - 1] + Math.hypot(fin[i][0] - fin[i - 1][0], fin[i][1] - fin[i - 1][1]));
  const L = cum[cum.length - 1];
  const n = Math.max(2, Math.round(L / pas));
  const pos: [number, number, number][] = [];
  let j = 0;
  for (let k = 0; k < (ferme ? n : n + 1); k++) {
    const s = (k / n) * L;
    while (j < cum.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    pos.push([fin[j][0] + (fin[j + 1][0] - fin[j][0]) * t, fin[j][1] + (fin[j + 1][1] - fin[j][1]) * t, s]);
  }
  const m = pos.length;
  return pos.map(([x, y, s], i) => {
    const a = pos[ferme ? (i - 1 + m) % m : Math.max(0, i - 1)];
    const b = pos[ferme ? (i + 1) % m : Math.min(m - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [x, y, (b[1] - a[1]) / l, -(b[0] - a[0]) / l, s];
  });
}

/** Une onde lente tirée de la graine (refermée sur elle-même pour un tracé fermé). */
function onde(L: number, rnd: Rnd, ferme: boolean, parts: [number, number][]): (s: number) => number {
  const o = parts.map(([l, a]) => ({ k: ferme ? Math.max(1, Math.round(L / l)) : L / l, a, p: rnd() * Math.PI * 2 }));
  return (s) => o.reduce((acc, { k, a, p }) => acc + a * Math.sin((2 * Math.PI * k * s) / L + p), 0);
}

/**
 * La plume qui peint : le tracé tremble le long de sa normale, le trait
 * s'épaissit et s'amincit (la charge), et, ouvert, s'effile aux deux bouts.
 * Rend le ruban (à remplir) et la forme tremblée (fermé).
 */
function plumeQuiPeint(pts: readonly P[], rnd: Rnd, o: { ferme?: boolean; amp?: number; w: [number, number]; pas?: number }): { ruban: string; forme: string } {
  const ferme = o.ferme ?? true;
  const pas = o.pas ?? 4;
  const ech = echantillons(pts, pas, ferme);
  const L = ech[ech.length - 1][4] + (ferme ? pas : 0);
  const amp = o.amp ?? 1.4;
  const tremble = onde(L, rnd, ferme, [[120, amp * 0.6], [40, amp * 0.4]]);
  const charge = onde(L, rnd, ferme, [[150, 1], [55, 0.4]]);
  const [w0, w1] = o.w;
  const g: string[] = [];
  const d: string[] = [];
  const c: string[] = [];
  for (const [x, y, nx, ny, s] of ech) {
    const dep = tremble(s);
    let w = (w0 + (w1 - w0) * Math.max(0, Math.min(1, 0.5 + charge(s) * 0.36))) / 2;
    if (!ferme) w *= Math.min(1, Math.pow(Math.min(s, L - s) / 10, 0.7)) * 0.8 + 0.2;
    g.push(`${f(x + nx * (dep + w))} ${f(y + ny * (dep + w))}`);
    d.push(`${f(x + nx * (dep - w))} ${f(y + ny * (dep - w))}`);
    c.push(`${f(x + nx * dep)} ${f(y + ny * dep)}`);
  }
  return {
    ruban: ferme ? `M${g.join("L")}ZM${d.reverse().join("L")}Z` : `M${g.join("L")}L${d.reverse().join("L")}Z`,
    forme: `M${c.join("L")}${ferme ? "Z" : ""}`,
  };
}

/** Un trait court à la plume, le milieu qui s'écarte un peu. */
function trait(x1: number, y1: number, x2: number, y2: number, rnd: Rnd, amp: number): string {
  const j = () => (rnd() - 0.5) * amp;
  return `M${f(x1 + j())} ${f(y1 + j())}Q${f((x1 + x2) / 2 + j() * 1.6)} ${f((y1 + y2) / 2 + j() * 1.6)} ${f(x2 + j())} ${f(y2 + j())}`;
}

const grain = (x: number, y: number, r: number) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;

/* ------------------------------ Les pennes ------------------------------ */

/** Une penne : sa base, son angle (degrés), sa longueur, sa largeur ; cintre : sa courbe (le bout relevé) ; fin : la largeur du bout ; doigt : l'échancrure des primaires. */
interface Penne {
  b: Pt;
  a: number;
  l: number;
  w: number;
  cintre: number;
  fin: number;
  doigt?: boolean;
}

/** Le point de l'axe d'une penne, à t de sa longueur, écarté de s (la courbe comprise). */
function sur(p: Penne, t: number, s = 0): Pt {
  const r = (p.a * Math.PI) / 180;
  const [ux, uy] = [Math.cos(r), Math.sin(r)];
  const [nx, ny] = [-uy, ux];
  const o = s + p.l * p.cintre * t * t;
  return [p.b[0] + ux * p.l * t + nx * o, p.b[1] + uy * p.l * t + ny * o];
}

/** La demi-largeur d'une penne à t : pleine, puis (doigt) l'échancrure qui l'amincit d'un coup, puis le bout. */
function profil(p: Penne, t: number): number {
  const h = p.w / 2;
  if (p.doigt) {
    if (t < 0.42) return h;
    if (t < 0.54) return h * (1 - 0.34 * ((t - 0.42) / 0.12));
    return h * (0.66 - (0.66 - p.fin) * Math.pow((t - 0.54) / 0.46, 1.4));
  }
  return h * (t < 0.5 ? 1 : 1 - (1 - p.fin) * Math.pow((t - 0.5) / 0.5, 1.6));
}

/** Le contour d'une penne : la base large, le bout arrondi. */
function pointsPenne(p: Penne): P[] {
  const ts = [0, 0.2, 0.4, 0.5, 0.6, 0.72, 0.84, 0.93];
  const g = ts.map((t) => sur(p, t, -profil(p, t)));
  const d = ts.map((t) => sur(p, t, profil(p, t))).reverse();
  return [...g, sur(p, 0.985, -profil(p, 0.97) * 0.55), sur(p, 1), sur(p, 0.985, profil(p, 0.97) * 0.55), ...d];
}

/*
 * L'aile, dessinée une fois, à plat, vue de dessous (l'aile droite) : l'épaule à
 * l'origine, l'envergure le long de x, le bord de fuite vers y. Chaque aile de
 * l'aigle en est la projection (une matrice : l'envergure u, la corde v, à
 * l'écran) : l'aile proche ouverte sur le côté, l'aile loin levée plus haut,
 * raccourcie par la perspective et retournée.
 */
const POIGNET: Pt = [252, -16];
/** La main fléchie au poignet : elle tourne de FLEXION (degrés) vers le bord de fuite, comme l'aile qui freine. */
const FLEXION = 12;
function flechi([x, y]: Pt): Pt {
  if (x <= POIGNET[0]) return [x, y];
  const r = (FLEXION * Math.PI) / 180;
  const [dx, dy] = [x - POIGNET[0], y - POIGNET[1]];
  return [POIGNET[0] + dx * Math.cos(r) - dy * Math.sin(r), POIGNET[1] + dx * Math.sin(r) + dy * Math.cos(r)];
}
const BOUT_MAIN: Pt = flechi([374, -6]);
/** Les primaires, de P10 à P1 : [angle, longueur, largeur]. Sept doigts (P10 → P4). */
const PRIM: [number, number, number][] = [
  [-16, 168, 30], [-7, 206, 31], [2, 230, 32], [11, 238, 33], [20, 232, 34], [30, 218, 36], [41, 200, 38],
  [53, 186, 42], [64, 178, 44], [75, 172, 46],
];
/** Les secondaires, du poignet au corps : leur longueur fait le bord de fuite en S. */
const SEC = [196, 207, 215, 222, 227, 231, 232, 230, 225, 217, 206, 193, 179, 166];

/** Les pennes d'une aile (la graine les fait varier un peu : chacune la sienne). */
function pennesAile(rnd: Rnd): { prim: Penne[]; sec: Penne[] } {
  const prim = PRIM.map(([a, l, w], i) => {
    const t = i / (PRIM.length - 1);
    const b: Pt = [BOUT_MAIN[0] + (POIGNET[0] - BOUT_MAIN[0]) * t, BOUT_MAIN[1] + (POIGNET[1] - BOUT_MAIN[1]) * t + 10];
    return { b, a: a + FLEXION * (1 - t * 0.5) + (rnd() - 0.5) * 2.6, l: l * (0.97 + rnd() * 0.06), w: w * (0.94 + rnd() * 0.12), cintre: i < 7 ? -0.035 : -0.01, fin: i < 7 ? 0.32 : 0.66, doigt: i < 7 };
  });
  const n = SEC.length;
  const sec = SEC.map((l, k) => {
    const t = (k + 0.5) / n;
    const b: Pt = [POIGNET[0] + (6 - POIGNET[0]) * t, POIGNET[1] + (4 - POIGNET[1]) * t + 8];
    return { b, a: 84 + (k / n) * 12 + (rnd() - 0.5) * 3, l: l * (0.96 + rnd() * 0.08), w: 39 * (0.92 + rnd() * 0.16), cintre: 0, fin: 0.84 };
  });
  return { prim, sec };
}

/** Les couvertures du dessous de l'aile (sombres chez l'aigle martial) : du bord d'attaque au tiers de la corde, le bord festonné. */
const PTS_COUVERTURES: P[] = ([
  [-6, 16], [36, -8], [92, -26], [150, -34], [206, -32], [POIGNET[0], POIGNET[1] - 4, 2], [300, -16], [344, -10], [380, -6, 2],
  [366, 14], [346, 26, 1], [334, 38], [314, 44, 1], [300, 56], [278, 60, 1], [264, 72], [240, 74, 1], [224, 84], [200, 82, 1],
  [184, 90], [160, 86, 1], [144, 92], [120, 88, 1], [104, 94], [80, 88, 1], [64, 92], [40, 86, 1], [22, 90], [-4, 78],
] as [number, number, number?][]).map(([x, y, k]) => (k ? [...flechi([x, y]), k] : flechi([x, y])) as P);

/** Une aile posée : l'épaule à l'écran, l'envergure u, la corde v (la matrice de la projection). */
interface Pose2 {
  S: Pt;
  u: Pt;
  v: Pt;
}
const AILE_PRES: Pose2 = { S: [622, 530], u: [0.77, -0.855], v: [0.1, 1.04] };
const AILE_LOIN: Pose2 = { S: [446, 524], u: [-0.7, -0.19], v: [0.06, 0.74] };
const matrice = (a: Pose2) => `matrix(${a.u[0]} ${a.u[1]} ${a.v[0]} ${a.v[1]} ${a.S[0]} ${a.S[1]})`;
const projette = (a: Pose2, [x, y]: Pt): Pt => [a.S[0] + a.u[0] * x + a.v[0] * y, a.S[1] + a.u[1] * x + a.v[1] * y];

/* ------------------------------ Le corps ------------------------------ */

/** Le plastron sombre : la tête tournée vers la lune, le crâne plat, la courte huppe couchée à la nuque, la gorge, le haut du poitrail ; le bord du plastron en mèches. */
const PTS_CAPUCHON: P[] = [
  [426, 392], [437, 377], [457, 367], [484, 362], [510, 362], [530, 366], [552, 363, 1], [543, 377], [565, 380, 1],
  [550, 393], [562, 432], [580, 481], [588, 516], [606, 556], [610, 598], [600, 630], [584, 644], [568, 628, 1], [550, 650],
  [530, 634, 1], [512, 654], [492, 636, 1], [472, 652], [456, 632, 1], [440, 640], [430, 610], [428, 570], [432, 530], [440, 494],
  [436, 471], [431, 446], [427, 428],
];
/** Le bec, de trois quarts, fermé : l'arête qui s'arque dès la cire jusqu'au crochet, le bord tranchant qui court jusqu'à la commissure. */
const PTS_BEC: P[] = [[430, 383], [414, 378], [397, 376], [381, 378], [367, 386], [358, 398], [356, 410], [361, 420, 1], [366, 410], [376, 404], [392, 405], [410, 411], [436, 420, 1], [437, 401]];
/** La mandibule, à peine visible sous le bord tranchant du bec fermé. */
const PTS_MANDIBULE: P[] = [[372, 409], [390, 409], [409, 415], [436, 421, 1], [421, 425], [400, 421], [382, 415]];
/** La cire : une bande étroite, gris d'indigo, à la base du bec ; la narine dessus. */
const PTS_CIRE: P[] = [[426, 381, 1], [434, 379], [441, 391], [440, 408], [435, 418, 1], [431, 404], [428, 392]];
const NARINE = "M431 391C433 388 437 389 437 393C435 396 432 395 431 391Z";
/** L'œil en amande, l'iris crème et jaune, une grande pupille ; l'arcade sombre en surplomb lui mange le tiers du haut ; la commissure jusque sous l'œil. */
const OEIL = { cx: 462, cy: 392 };
const PTS_OEIL: P[] = [[445, 394, 1], [452, 387], [463, 384], [474, 386], [481, 391, 1], [474, 398], [463, 401], [452, 399]];
const PTS_ARCADE: P[] = [[436, 391, 1], [443, 381], [458, 375], [476, 376], [490, 383], [494, 389, 1], [478, 388], [463, 388.5], [450, 390.5]];
const COMMISSURE: P[] = [[436, 421], [449, 421], [458, 419]];

/** Le ventre blanc, sous le plastron. */
const PTS_VENTRE: P[] = [
  [436, 590], [468, 572], [520, 566], [576, 572], [616, 596], [638, 644], [644, 700], [636, 748], [616, 791], [586, 820],
  [546, 836], [506, 836], [470, 820], [444, 791], [428, 748], [424, 700], [426, 640],
];

/** Les culottes : la cuisse emplumée qui se fond dans le ventre, le tarse emplumé jusqu'aux doigts. */
const PTS_CULOTTE_PRES: P[] = [[566, 752], [602, 740], [634, 752], [644, 783], [640, 817], [634, 845], [632, 866], [626, 886, 1], [586, 886, 1], [580, 866], [572, 836], [564, 806], [560, 777]];
const PTS_CULOTTE_LOIN: P[] = [[450, 755], [484, 745], [512, 758], [518, 789], [512, 822], [506, 848], [504, 868], [500, 888, 1], [462, 888, 1], [456, 866], [448, 836], [444, 807], [444, 781]];

/**
 * Un pied qui serre le perchoir, vu de face : trois doigts devant, posés sur le perchoir et refermés
 * dessus, l'ongle du pouce qui revient dessous ; chacun sa serre, qui déborde du perchoir.
 * Un doigt part de sa base b dans la direction a (degrés), long de l, large de w à la base ; il se
 * courbe de c degrés sur sa longueur (vers le doigt du milieu : le pied qui se referme) et
 * s'amincit vers le bout ; la serre continue la courbe, plus fort, noire, épaisse à sa base, en
 * croc. Le pied d'un rapace, plus grand d'un cinquième que celui de l'aigle qui freinait.
 */
interface Doigt {
  b: Pt;
  a: number;
  l: number;
  w: number;
  c: number;
  /** La longueur de la serre, en part de celle du doigt (0,6 par défaut). */
  k?: number;
}
/**
 * Le perchoir : posé sur la couture de la grille d'adire, un bâton de réserve, cerné d'indigo, ses points
 * de couture au milieu ; il dépasse des pieds. PERCHOIR_CARTE recopie la couture du cinquième rang du skin
 * (../nigeria.tsx : HAUT_GRILLE.y0 + 5 × (y1 − y0) / 6 = 60 + 5 × 178 = 950) : changer l'un et l'autre ensemble.
 */
const PERCHOIR_CARTE = 950;
const PERCH = { x0: 404, x1: 704, e: 11 };
/** Le milieu du perchoir, dans le repère des points : la couture de la carte ramenée par la pose. */
const PERCH_Y = 60 + (PERCHOIR_CARTE - POSE_DOS_NG.y) / POSE_DOS_NG.echelle;
/** Le bâton : ses bouts arrondis, à peine plus épais au milieu. */
const PTS_PERCHOIR: P[] = [
  [PERCH.x0, PERCH_Y + 1],
  [PERCH.x0 + 14, PERCH_Y - PERCH.e],
  [(PERCH.x0 + PERCH.x1) / 2, PERCH_Y - PERCH.e - 1],
  [PERCH.x1 - 14, PERCH_Y - PERCH.e + 1],
  [PERCH.x1, PERCH_Y],
  [PERCH.x1 - 14, PERCH_Y + PERCH.e],
  [(PERCH.x0 + PERCH.x1) / 2, PERCH_Y + PERCH.e + 1],
  [PERCH.x0 + 14, PERCH_Y + PERCH.e],
];
const PIED_PRES: Doigt[] = [
  { b: [589, 883], a: 108, l: 40, w: 17, c: -40, k: 0.85 },
  { b: [606, 887], a: 92, l: 43, w: 17.5, c: -12, k: 0.85 },
  { b: [623, 883], a: 76, l: 40, w: 17, c: 40, k: 0.85 },
];
const PIED_LOIN: Doigt[] = [
  { b: [465, 885], a: 110, l: 38, w: 16, c: -40, k: 0.85 },
  { b: [481, 889], a: 94, l: 41, w: 16.5, c: -12, k: 0.85 },
  { b: [497, 885], a: 78, l: 38, w: 16, c: 40, k: 0.85 },
];
/** Les pouces, derrière le perchoir : seule leur serre se voit, qui revient dessous, vers l'avant. */
const POUCES: Doigt[] = [
  { b: [599, 912], a: 100, l: 12, w: 16, c: 44, k: 1.3 },
  { b: [475, 913], a: 100, l: 11, w: 15, c: 44, k: 1.3 },
];

/** Le point et la direction d'un arc parti de b dans la direction a (degrés), tourné de c degrés sur la longueur l, à s de la base. */
function surArc(b: Pt, a: number, c: number, l: number, s: number): [number, number, number] {
  const a0 = (a * Math.PI) / 180;
  const th = (c * Math.PI) / 180;
  const ang = a0 + (th * s) / l;
  if (Math.abs(th) < 1e-6) return [b[0] + Math.cos(a0) * s, b[1] + Math.sin(a0) * s, ang];
  const R = l / th;
  return [b[0] + R * (Math.sin(ang) - Math.sin(a0)), b[1] - R * (Math.cos(ang) - Math.cos(a0)), ang];
}

function doigt(d: Doigt): { doigt: P[]; serre: P[]; bout: [number, number, number]; barres: [Pt, Pt][] } {
  const h = d.w / 2;
  const cote = (s: number, k: number): Pt => {
    const [x, y, ang] = surArc(d.b, d.a, d.c, d.l, s);
    return [x - Math.sin(ang) * k, y + Math.cos(ang) * k];
  };
  // Le doigt : plein à la base, une phalange qui renfle à peine, aminci au bout (0,62).
  const largeur = (t: number) => h * (1 - 0.38 * t + 0.05 * Math.sin(t * Math.PI * 2));
  const ts = [0, 0.22, 0.45, 0.68, 0.88, 1];
  const g = ts.map((t) => cote(t * d.l, -largeur(t)));
  const dr = ts.map((t) => cote(t * d.l, largeur(t))).reverse();
  const bout = surArc(d.b, d.a, d.c, d.l, d.l);
  const [bx, by, ba] = bout;
  const doigtPts: P[] = [...g, [bx + Math.cos(ba) * h * 0.5, by + Math.sin(ba) * h * 0.5], ...dr];
  // La serre : elle sort du bout du doigt, continue sa courbe (60° de plus, dans le même sens), épaisse
  // comme le bout du doigt, et finit en pointe.
  const sens = d.c === 0 ? 1 : Math.sign(d.c);
  const k = (d.k ?? 0.6) * d.l;
  const cs = d.c * 0.6 + sens * 62;
  const pt = (s: number, off: number): Pt => {
    const [x, y, ang] = surArc([bx, by], (ba * 180) / Math.PI, cs, k, s);
    return [x - Math.sin(ang) * off, y + Math.cos(ang) * off];
  };
  const e = h * 0.7;
  const serre: P[] = [pt(0, -e), pt(k * 0.35, -e * 0.82), pt(k * 0.7, -e * 0.45), [...pt(k, 0), 1] as P, pt(k * 0.7, e * 0.3), pt(k * 0.35, e * 0.7), pt(0, e)];
  // Les écailles du doigt : deux barres en travers, aux jointures.
  const barres: [Pt, Pt][] = [0.36, 0.66].map((t) => [cote(t * d.l, -largeur(t) * 0.8), cote(t * d.l, largeur(t) * 0.8)]);
  return { doigt: doigtPts, serre, bout, barres };
}

/** La queue, plus étroite : douze rectrices serrées, sous le ventre, qui tombent derrière le perchoir. */
const QUEUE: Penne[] = Array.from({ length: 12 }, (_, i) => {
  const k = i - 5.5;
  return { b: [530 + k * 3.4, 806] as Pt, a: 91 - k * 2.5, l: 176 - k * k * 0.42, w: 33, cintre: 0, fin: 0.9 };
});

/* ------------------------------ La peinture ------------------------------ */

const deja = new Map<number, ReturnType<typeof peindre>>();

/** Une aile peinte, dans son repère à plat : chaque penne (sa forme, son trait), sa hampe et ses barres ; les couvertures et leurs écailles. */
function peindreAile(rnd: Rnd) {
  const { prim, sec } = pennesAile(rnd);
  // Du corps vers le bout : la plus extérieure par-dessus.
  const ordre = [...[...sec].reverse(), ...[...prim].reverse()];
  const pennes = ordre.map((p) => {
    const primaire = prim.includes(p);
    const forme = plumeQuiPeint(pointsPenne(p), rnd, { w: primaire ? [2.6, 4] : [1.8, 3], amp: 1, pas: 6.5 });
    // Les barres : en bandes parallèles au bord de fuite (la même fraction d'une penne à l'autre), chacune un peu de travers ; la hampe sur les primaires.
    let barres = primaire ? plumeQuiPeint([sur(p, 0.12), sur(p, 0.5, 0.5), sur(p, 0.84)], rnd, { ferme: false, w: [1.4, 2.4], amp: 0.6, pas: 6 }).ruban : "";
    // Chaque penne sa façon : une barre de plus ou de moins, d'un côté ou de l'autre.
    const ts = (primaire ? [0.46, 0.58, 0.7, 0.81] : [0.5, 0.62, 0.74]).filter(() => rnd() > 0.14);
    if (rnd() < 0.3) ts.push(primaire ? 0.36 : 0.4);
    for (const t0 of ts) {
      const t = t0 + (rnd() - 0.5) * 0.03;
      const w = profil(p, t) * 0.86;
      const [g, d] = [sur(p, t - 0.012, -w), sur(p, t + 0.012, w)];
      barres += trait(g[0], g[1], d[0], d[1], rnd, 1.2);
    }
    // Le bord sombre des rémiges : le bout plus longtemps dans l'indigo, une bande coupée droit en travers.
    const bout = primaire ? 0.8 : 0.84;
    const ts2 = [bout, (bout + 1) / 2, 0.95];
    const bord = lisse([...ts2.map((t) => sur(p, t, -profil(p, t))), sur(p, 1), ...ts2.reverse().map((t) => sur(p, t, profil(p, t)))]);
    return { forme: forme.forme, contour: forme.ruban, barres, bord, primaire };
  });
  const couv = plumeQuiPeint(PTS_COUVERTURES, rnd, { w: [2.8, 4.4], amp: 1.2, pas: 5 });
  // Les écailles des couvertures : des rangs d'arcs le long du bras et de la main.
  let ecailles = "";
  for (let rg = 0; rg < 5; rg++)
    for (let x = 8 + (rg % 2) * 11; x < 372; x += 22) {
      const y = 6 + rg * 15 - (x > 250 ? (x - 250) * (0.14 + rg * 0.05) : 0);
      if (y < -8) continue;
      ecailles += trait(x - 9, y, x, y + 8, rnd, 1.2) + trait(x, y + 8, x + 9, y, rnd, 1.2);
    }
  return { pennes, couv, ecailles };
}

function peindre(graine: number) {
  const rnd = alea(graine ^ 0x4e47);
  const ailes = [peindreAile(rnd), peindreAile(rnd)];
  // Le corps : le plastron, ses plumes ; le ventre, ses gouttes ; les culottes.
  const capuchon = plumeQuiPeint(PTS_CAPUCHON, rnd, { w: [3, 4.6], amp: 1.2 });
  const ventre = plumeQuiPeint(PTS_VENTRE, rnd, { w: [3, 4.6], amp: 1.5 });
  const culottes = [PTS_CULOTTE_LOIN, PTS_CULOTTE_PRES].map((c) => ({
    forme: lisse(c),
    // le trait ne cerne que le bas : en haut, la culotte se fond dans le ventre
    ruban: plumeQuiPeint(c.slice(3, 12), rnd, { ferme: false, w: [2.6, 4], amp: 1.1 }).ruban,
  }));
  let gouttes = "";
  for (let y = 664, i = 0; y < 826; y += 26, i++)
    for (let x = 440 + (i % 2) * 17; x < 640; x += 34) {
      const [gx, gy] = [x + (rnd() - 0.5) * 8, y + (rnd() - 0.5) * 8];
      const h = 6.5 + rnd() * 4;
      gouttes += `M${f(gx)} ${f(gy - h)}C${f(gx + h * 0.7)} ${f(gy)} ${f(gx + h * 0.6)} ${f(gy + h * 0.9)} ${f(gx)} ${f(gy + h * 0.9)}C${f(gx - h * 0.6)} ${f(gy + h * 0.9)} ${f(gx - h * 0.7)} ${f(gy)} ${f(gx)} ${f(gy - h)}Z`;
    }
  let gouttesCulottes = "";
  for (const [x0, x1] of [[446, 514], [564, 640]] as Pt[])
    for (let y = 770, i = 0; y < 878; y += 20, i++)
      for (let x = x0 + 10 + (i % 2) * 10; x < x1 - 6; x += 21) gouttesCulottes += grain(x + (rnd() - 0.5) * 4, y + (rnd() - 0.5) * 4, 3.2 + rnd() * 1.4);
  // Le plastron : des plumes en écailles, tracées en blanc dans le bleu ; la tête, des traits courts.
  let plumesPlastron = "";
  for (let y = 500, i = 0; y < 630; y += 16, i++)
    for (let x = 442 + (i % 2) * 10; x < 606; x += 20) plumesPlastron += trait(x - 7, y - 3, x, y + 4, rnd, 1.2) + trait(x, y + 4, x + 7, y - 3, rnd, 1.2);
  let plumesTete = "";
  for (let y = 372, i = 0; y < 490; y += 12, i++)
    for (let x = 470 + (i % 2) * 7; x < 560; x += 14) {
      if (Math.hypot(x - OEIL.cx, y - OEIL.cy) < 28) continue;
      plumesTete += trait(x, y, x + 6, y + 3, rnd, 1);
    }
  // Les pattes : les doigts, les serres, les écailles des doigts (deux barres, aux jointures) ; les pouces,
  // derrière le perchoir, leur serre seulement.
  const pieds = [PIED_LOIN, PIED_PRES].map((pd) => {
    let doigts = "";
    let serres = "";
    let ecailles = "";
    for (const d of pd) {
      const g = doigt(d);
      doigts += plumeQuiPeint(g.doigt, rnd, { w: [2.2, 3], amp: 0.5, pas: 3 }).forme;
      serres += lisse(g.serre);
      for (const [[x0, y0], [x1, y1]] of g.barres) ecailles += trait(x0, y0, x1, y1, rnd, 0.6);
    }
    return { doigts, serres, ecailles };
  });
  const pouces = POUCES.map((d) => {
    const g = doigt(d);
    return lisse(g.doigt) + lisse(g.serre);
  }).join("");
  // Le perchoir : un bâton de réserve, cerné à la plume, ses points de couture le long du milieu.
  const perchoir = plumeQuiPeint(PTS_PERCHOIR, rnd, { w: [2.6, 4], amp: 0.8 });
  let points = "";
  for (let x = PERCH.x0 + 18; x < PERCH.x1 - 12; x += 17) points += grain(x + (rnd() - 0.5) * 2, PERCH_Y + (rnd() - 0.5) * 2, 2.3);
  // La queue : ses pennes, ses barres, son bord sombre.
  const queue = [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11].map((i) => {
    const p = QUEUE[i];
    const t = plumeQuiPeint(pointsPenne(p), rnd, { w: [2.4, 3.8], amp: 1, pas: 6.5 });
    let barres = "";
    for (const tt of [0.44, 0.62, 0.78]) {
      const [g, d] = [sur(p, tt + (rnd() - 0.5) * 0.03, -p.w * 0.43), sur(p, tt + (rnd() - 0.5) * 0.03, p.w * 0.43)];
      barres += trait(g[0], g[1], d[0], d[1], rnd, 1.2);
    }
    return { forme: t.forme, contour: t.ruban, barres };
  });
  // Les craquelures : là où l'indigo a filé dans l'amidon séché (la graine).
  let craquelures = "";
  for (let i = 0; i < 70; i++) {
    let [x, y] = [420 + rnd() * 230, 560 + rnd() * 300];
    let a = rnd() * Math.PI * 2;
    craquelures += `M${f(x)} ${f(y)}`;
    for (let k = 0, n = 3 + Math.round(rnd() * 5); k < n; k++) {
      a += (rnd() - 0.5) * 1.1;
      x += Math.cos(a) * 6;
      y += Math.sin(a) * 6;
      craquelures += `L${f(x)} ${f(y)}`;
    }
  }
  const arcade = plumeQuiPeint(PTS_ARCADE, rnd, { w: [1.6, 2.4], amp: 0.3, pas: 3 });
  const commissure = plumeQuiPeint(COMMISSURE, rnd, { ferme: false, w: [2, 3.4], amp: 0.5, pas: 3 }).ruban;
  return { ailes, capuchon, ventre, culottes, gouttes, gouttesCulottes, plumesPlastron, plumesTete, pieds, pouces, perchoir, points, queue, craquelures, arcade, commissure };
}

function peinture(graine: number) {
  let p = deja.get(graine);
  if (!p) {
    if (deja.size > 24) deja.clear();
    p = peindre(graine);
    deja.set(graine, p);
  }
  return p;
}

const RESERVE = "208,218,232";
const KAOLIN = "236,234,226";
const INDIGO = "#0f1422";
/** L'iris de l'aigle martial : un crème qui tire au jaune paille (jamais l'or). */
const IRIS = "#e2d6a0";
/** Les serres : un bleu d'indigo plus franc que la pâte mince, qui se lit sur la réserve comme sur le fond. */
const SERRE = "#2e3a5c";
/** La cire : la pâte posée plus mince encore, gris d'indigo. */
const CIRE = "#7a849e";
/** La pâte posée mince : l'indigo l'a gagnée à moitié (la tête, le plastron, les couvertures). */
const MI = "#46526e";

/** Le dos : l'aigle d'amidon sur l'indigo. */
function Adire({ graine, id }: PropsTotem) {
  const p = peinture(graine);
  const blanc = `rgb(${RESERVE})`;
  const ligne = { fill: "none", stroke: INDIGO, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const aile = (k: 0 | 1) => {
    const a = p.ailes[k];
    return (
      <g key={k} transform={matrice(k ? AILE_PRES : AILE_LOIN)}>
        {a.pennes.map((q, i) => (
          <g key={i}>
            <path d={q.forme} fill={blanc} />
            <path d={q.bord} fill={MI} />
            <path d={q.barres} {...ligne} strokeWidth={2.2} opacity={0.85} />
            <path d={q.contour} fill={INDIGO} />
          </g>
        ))}
        <path d={a.couv.forme} fill={MI} />
        <g clipPath={`url(#ngv${k}${id})`}>
          <path d={a.ecailles} fill="none" stroke={blanc} strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
        </g>
        <path d={a.couv.ruban} fill={INDIGO} />
      </g>
    );
  };
  return (
    <g transform={DECALE_NG}>
      <defs>
        {p.ailes.map((a, k) => (
          <clipPath key={k} id={`ngv${k}${id}`}>
            <path d={a.couv.forme} />
          </clipPath>
        ))}
        <clipPath id={`ngb${id}`}>
          <path d={p.ventre.forme} />
        </clipPath>
        <clipPath id={`ngh${id}`}>
          <path d={p.capuchon.forme} />
        </clipPath>
      </defs>
      {aile(0)}
      {/* La queue, ses barres. */}
      {p.queue.map((q, i) => (
        <g key={i}>
          <path d={q.forme} fill={blanc} />
          <path d={q.barres} {...ligne} strokeWidth={4.6} opacity={0.8} />
          <path d={q.contour} fill={INDIGO} />
        </g>
      ))}
      {/* Le ventre et ses gouttes. */}
      <path d={p.ventre.forme} fill={blanc} />
      <g clipPath={`url(#ngb${id})`}>
        <path d={p.gouttes} fill={INDIGO} opacity={0.85} />
        <path d={p.craquelures} {...ligne} strokeWidth={1.1} opacity={0.45} />
      </g>
      <path d={p.ventre.ruban} fill={INDIGO} />
      {aile(1)}
      {/* Le perchoir, sur la couture : les serres des pouces, qui reviennent dessous, puis le bâton. */}
      <path d={p.pouces} fill={SERRE} stroke={blanc} strokeWidth={2} strokeLinejoin="round" />
      <path d={p.perchoir.forme} fill={blanc} />
      <path d={p.points} fill={INDIGO} opacity={0.75} />
      <path d={p.perchoir.ruban} fill={INDIGO} />
      {/* Les pattes : les culottes et leurs gouttes, les doigts refermés sur le perchoir, les serres qui le débordent. */}
      {p.culottes.map((c, i) => (
        <g key={i}>
          <path d={c.forme} fill={blanc} />
          <path d={c.ruban} fill={INDIGO} />
        </g>
      ))}
      <path d={p.gouttesCulottes} fill={INDIGO} opacity={0.8} />
      {p.pieds.map((pd, i) => (
        <g key={i}>
          <path d={pd.serres} fill={SERRE} stroke={blanc} strokeWidth={2} strokeLinejoin="round" />
          <path d={pd.doigts} fill={`rgb(${KAOLIN})`} stroke={INDIGO} strokeWidth={2.6} strokeLinejoin="round" />
          <path d={pd.ecailles} {...ligne} strokeWidth={1.5} opacity={0.75} />
        </g>
      ))}
      {/* La tête et le plastron : la pâte mince, le dessin des plumes en blanc ; le bec noir fermé, la cire étroite, l'œil sous l'arcade. */}
      <path d={p.capuchon.forme} fill={MI} />
      <g clipPath={`url(#ngh${id})`}>
        <path d={p.plumesPlastron + p.plumesTete} fill="none" stroke={blanc} strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      </g>
      <path d={p.capuchon.ruban} fill={blanc} />
      <path d={lisse(PTS_MANDIBULE)} fill={INDIGO} stroke={blanc} strokeWidth={2} strokeLinejoin="round" />
      <path d={lisse(PTS_BEC)} fill={INDIGO} stroke={blanc} strokeWidth={3} strokeLinejoin="round" />
      <path d="M424 384C408 378 392 378 378 385" fill="none" stroke={blanc} strokeWidth={1.8} strokeLinecap="round" opacity={0.7} />
      <path d={lisse(PTS_CIRE)} fill={CIRE} stroke={INDIGO} strokeWidth={1.8} strokeLinejoin="round" />
      <path d={NARINE} fill={INDIGO} />
      <path d={p.commissure} fill={blanc} />
      <path d={lisse(PTS_OEIL)} fill={IRIS} stroke={INDIGO} strokeWidth={2.4} strokeLinejoin="round" />
      <circle cx={OEIL.cx - 1.5} cy={OEIL.cy + 0.5} r={6.6} fill={INDIGO} />
      <circle cx={OEIL.cx - 4.2} cy={OEIL.cy - 1.2} r={1.6} fill={`rgb(${KAOLIN})`} />
      <path d={p.arcade.forme} fill={INDIGO} />
      <path d={p.arcade.ruban} fill={INDIGO} />
    </g>
  );
}

/**
 * Le pourtour d'une aile, d'un seul trait (pour la silhouette : le gaufrage, le
 * skin) : le bord d'attaque, puis le bout de chaque primaire et l'échancrure
 * entre deux doigts, puis le bout de chaque secondaire, jusqu'au corps.
 */
function contourAile(rnd: Rnd): P[] {
  const { prim, sec } = pennesAile(rnd);
  const pts: P[] = PTS_COUVERTURES.slice(0, 9).map(([x, y]) => [x, y] as const);
  prim.forEach((p, i) => {
    pts.push(sur(p, 1));
    const q = prim[i + 1] ?? sec[0];
    const [a, b] = [sur(p, 0.5), sur(q, 0.5)];
    pts.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  });
  sec.forEach((p) => pts.push(sur(p, 1)));
  pts.push([0, sec[sec.length - 1].l * 0.9]);
  return pts;
}

/** La silhouette (pour le gaufrage de la face et le skin, qui y coupe l'étoffe) : un pourtour par aile, la queue, le corps. */
function silhouette(): string {
  const rnd = alea(7);
  let d = "";
  for (const a of [AILE_LOIN, AILE_PRES]) d += lisse(contourAile(rnd).map(([x, y]) => projette(a, [x, y])));
  d += lisse([...QUEUE.map((q) => sur(q, 1)), [QUEUE[11].b[0], QUEUE[11].b[1]], [QUEUE[0].b[0], QUEUE[0].b[1]]]);
  d += lisse(PTS_VENTRE) + lisse(PTS_CAPUCHON) + lisse(PTS_BEC) + lisse(PTS_CULOTTE_LOIN) + lisse(PTS_CULOTTE_PRES);
  for (const pd of [PIED_LOIN, PIED_PRES])
    for (const dg of pd) {
      const g = doigt(dg);
      d += lisse(g.doigt) + lisse(g.serre);
    }
  return d;
}
export const SILHOUETTE_NG = silhouette();

/** L'enveloppe convexe d'un nuage de points (la chaîne monotone). */
function enveloppe(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const x = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas: Pt[] = [];
  const haut: Pt[] = [];
  for (const q of p) {
    while (bas.length >= 2 && x(bas[bas.length - 2], bas[bas.length - 1], q) <= 0) bas.pop();
    bas.push(q);
  }
  for (const q of p.reverse()) {
    while (haut.length >= 2 && x(haut[haut.length - 2], haut[haut.length - 1], q) <= 0) haut.pop();
    haut.push(q);
  }
  return [...bas.slice(0, -1), ...haut.slice(0, -1)];
}

/** Les trois enveloppes de l'aigle au dos (l'aile loin, l'aile proche, le corps), dans le repère de la carte. */
const ENVELOPPES: Pt[][] = (() => {
  const rnd = alea(7);
  const carte = ([x, y]: readonly [number, number] | readonly [number, number, number]): Pt => [
    POSE_DOS_NG.x + (x - 40) * POSE_DOS_NG.echelle,
    POSE_DOS_NG.y + (y - 60) * POSE_DOS_NG.echelle,
  ];
  const ailes = [AILE_LOIN, AILE_PRES].map((a) => {
    const { prim, sec } = pennesAile(rnd);
    const pts = [...[...sec, ...prim].flatMap((q) => pointsPenne(q)), ...PTS_COUVERTURES].map((q) => carte(projette(a, [q[0], q[1]])));
    return enveloppe(pts);
  });
  const corps = [...PTS_CAPUCHON, ...PTS_BEC, ...PTS_VENTRE, ...PTS_CULOTTE_LOIN, ...PTS_CULOTTE_PRES, ...QUEUE.flatMap((q) => pointsPenne(q)), ...[...PIED_LOIN, ...PIED_PRES].flatMap((d) => doigt(d).doigt)].map(carte);
  return [...ailes, enveloppe(corps)];
})();

/** Le point (repère de la carte) est-il sous l'aigle, à la marge près ? Le skin y laisse ses cases entières ou rien. */
export function sousAigleNG(x: number, y: number, marge: number): boolean {
  return ENVELOPPES.some((e) => {
    let dedans = true;
    let proche = false;
    for (let i = 0; i < e.length; i++) {
      const [a, b] = [e[i], e[(i + 1) % e.length]];
      const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
      const c = dx * (y - a[1]) - dy * (x - a[0]);
      if (c < 0) dedans = false;
      const l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
      if (Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) < marge) proche = true;
    }
    return dedans || proche;
  });
}

/** La face : le gaufrage, la silhouette relevée (lumière en haut à gauche, ombre en bas à droite), la tête et l'œil en creux. */
function Gaufre({ photo, tons, id }: PropsTotem) {
  const ombre = photo ? "rgba(6,8,16,0.6)" : "rgba(0,0,0,0.55)";
  const lumiere = photo ? "rgba(236,240,248,0.55)" : `rgba(${RESERVE},0.42)`;
  const perchoir = lisse(PTS_PERCHOIR);
  // Le masque couvre toute l'envergure (le bout de l'aile proche passe x 1000 dans le repère des points).
  const [mx, my, mw, mh] = [-200, -200, 1500, 1500];
  return (
    <g transform={DECALE_NG} strokeLinejoin="round">
      <defs>
        <mask id={`ngg${id}`} maskUnits="userSpaceOnUse" x={mx} y={my} width={mw} height={mh}>
          <rect x={mx} y={my} width={mw} height={mh} fill="#fff" />
          <path d={SILHOUETTE_NG + perchoir} fill="#000" />
        </mask>
      </defs>
      <path d={SILHOUETTE_NG + perchoir} fill={photo ? "rgba(236,240,248,0.1)" : `rgba(${tons.encre},0.04)`} />
      <g mask={`url(#ngg${id})`} fill="none" strokeWidth={12}>
        <path d={SILHOUETTE_NG + perchoir} stroke={ombre} transform="translate(4 5)" />
        <path d={SILHOUETTE_NG + perchoir} stroke={lumiere} transform="translate(-4 -5)" />
      </g>
      <path d={lisse(PTS_CAPUCHON)} fill="none" stroke={ombre} strokeWidth={4} transform="translate(-1.5 -2)" />
      <path d={lisse(PTS_CAPUCHON)} fill="none" stroke={lumiere} strokeWidth={4} transform="translate(1.5 2)" />
      <path d={lisse(PTS_ARCADE)} fill={ombre} />
      <path d={lisse(PTS_OEIL)} fill={ombre} />
    </g>
  );
}

const totem: TotemNation = {
  nation: "ng",
  animal: "aigle",
  quoi: "L'aigle martial de trois quarts qui se pose, les serres refermées sur un perchoir tendu sur la couture de l'étoffe, les ailes encore levées sans symétrie, la tête sombre au crâne plat, l'œil en amande sous l'arcade, le bec fermé, tournée vers la lune : peint à l'amidon sur l'indigo comme un adire eleko, hampes, barres, gouttes et craquelures.",
  sources: [
    { titre: "eBird (Cornell Lab), aigle martial : tête, dos et haut du poitrail brun sombre, ventre blanc semé de taches, courte huppe", url: "https://ebird.org/species/mareag1" },
    { titre: "World Land Trust, aigle martial : plumage, envergure, pattes emplumées", url: "https://www.worldlandtrust.org/species/martial-eagle/" },
    { titre: "U.S. Fish and Wildlife Service, Feather Atlas : primaires échancrées, secondaires, couvertures", url: "https://www.fws.gov/lab/featheratlas/glossary.html" },
    { titre: "Birds Outside My Window : les couvertures et les secondaires de l'aile", url: "https://www.birdsoutsidemywindow.org/2010/01/02/anatomy-wing-coverts/" },
    { titre: "Horniman Museum, Nigeria60 : les archives de l'adire (amidon, indigo, Abeokuta, Ibadan)", url: "https://www.horniman.ac.uk/story/nigeria60-adire-archives/" },
  ],
  dessine: true,
  boite: BOITE,
  pose: {
    dos: { ...POSE_DOS_NG, devant: true, lune: LUNE_NG },
    face: { portrait: { x: 116, y: 976 - 920 * 0.25, echelle: 0.25 } },
  },
  Dessin: (p) => {
    if (p.couche === "dos") return <Adire {...p} />;
    if (p.couche === "face-portrait") return <Gaufre {...p} />;
    return null;
  },
};

export default totem;
