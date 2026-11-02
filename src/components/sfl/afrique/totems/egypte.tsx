// Le totem de l'Égypte (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// Le faucon pèlerin, perché sur une pierre, de profil, tourné vers la lune :
// la tête d'un faucon et non d'un perroquet : le dessus plat qui file vers le
// bec, l'arcade en surplomb au-dessus d'un grand œil sombre à l'anneau fin,
// le bec court et haut, au crochet net, avec sa petite dent ; le capuchon
// sombre, et dessous la large moustache verticale, séparée de la nuque par la
// joue blanche qui remonte derrière elle (la marque du pèlerin) ; le poitrail
// bombé et large, la bosse de l'aile à l'épaule, l'aile repliée dont la
// pointe tombe juste avant le bout de la queue (la pointe de l'autre aile
// croise la queue) ; les culottes emplumées, le tarse court, trois doigts
// enroulés sur la pierre avec leurs serres, le pouce derrière ; les deux
// pattes. On ne dessine que l'oiseau, sur une pierre de la falaise : ni dieu,
// ni couronne, ni disque sur sa tête, ni enseigne. L'aigle du Nigeria freine,
// celui du Mali plane : lui seul est posé.
// Il est fait comme le tulle bi telli d'Assiout (../egypte.tsx) : des
// lamelles d'argent nouées une à une sur le filet noir, en quinconce, chacune
// entière dans le contour (jamais coupée) ; le dessin est ce qu'on laisse
// vide. Le capuchon, la moustache et le bec : le filet nu ; la cire, la joue,
// la gorge et le haut du poitrail : les lamelles serrées ; le bas du poitrail,
// les flancs et les culottes : barrés (un rang vide sur trois) ; l'aile en
// trois zones : les petites couvertures en écailles, les grandes en festons,
// les rémiges en lignes qui convergent vers la pointe ; la queue sombre,
// barrée de lamelles ; la pierre en assises. Un fil d'argent cerne l'oiseau
// d'un seul contour (le capuchon reprend ses points), l'œil a son anneau fin.
//   · au dos : le héros, à gauche, sur sa pierre, face à la lune montée à
//     hauteur de son regard (LUNE_EG) ; le skin découpe le treillis autour de
//     lui (SILHOUETTE_EG) et pose autour de la lune une couronne de losanges ;
//   · à la face : le même faucon en gaufrage dans le coin bas gauche du
//     portrait, la queue à droite de l'équerre.

import type { PropsTotem, TotemNation } from "../types";
import { alea, f } from "../outils";

/** La lune, à hauteur du regard du faucon (le skin, ../egypte.tsx, la cerne d'une couronne de losanges). */
export const LUNE_EG = { cx: 704, cy: 298, d: 140 } as const;
/** La pose du dos : le skin y découpe le treillis autour du faucon. */
export const POSE_DOS_EG = { x: 70, y: 300, echelle: 1.06 } as const;
/** Le repère : les points sont posés directement dans la boîte 480 × 820 (rien à décaler). */
export const DECALE_EG = "";

/* ------------------------------ Les tracés ------------------------------ */

type P = readonly [number, number] | readonly [number, number, number];
type Seg = [number, number, number, number, number, number, number, number];
type Pt = [number, number];

/** Des points posés à la main, liés en béziers tendus (un tiers de corde) ; 1 : un angle, 2 : un angle adouci. */
function segments(pts: readonly P[]): Seg[] {
  const n = pts.length;
  const at = (i: number) => pts[(i + n) % n];
  const tg = (i: number): Pt => {
    const p = at(i);
    if (p[2] === 1) return [0, 0];
    const [a, b] = [at(i - 1), at(i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = p[2] === 2 ? 0.5 : 1;
    return [((b[0] - a[0]) / l) * k, ((b[1] - a[1]) / l) * k];
  };
  return pts.map((p, i) => {
    const q = at(i + 1);
    const c = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
    const [u, v] = [tg(i), tg(i + 1)];
    return [p[0], p[1], p[0] + u[0] * c, p[1] + u[1] * c, q[0] - v[0] * c, q[1] - v[1] * c, q[0], q[1]];
  });
}

const lisse = (pts: readonly P[]) => {
  const s = segments(pts);
  return `M${f(s[0][0])} ${f(s[0][1])}${s.map((g) => `C${f(g[2])} ${f(g[3])} ${f(g[4])} ${f(g[5])} ${f(g[6])} ${f(g[7])}`).join("")}Z`;
};

/** Un trait ouvert, lissé (Catmull-Rom au tiers de corde). */
function trace(pts: readonly P[]): string {
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [a, b, c, e] = [pts[Math.max(0, i - 1)], pts[i], pts[i + 1], pts[Math.min(pts.length - 1, i + 2)]];
    d += `C${f(b[0] + (c[0] - a[0]) / 6)} ${f(b[1] + (c[1] - a[1]) / 6)} ${f(c[0] - (e[0] - b[0]) / 6)} ${f(c[1] - (e[1] - b[1]) / 6)} ${f(c[0])} ${f(c[1])}`;
  }
  return d;
}

/** Le tracé en polygone (pour savoir si une lamelle est dedans). */
function polygone(pts: readonly P[]): Pt[] {
  const out: Pt[] = [];
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segments(pts))
    for (let k = 0; k < 12; k++) {
      const t = k / 12;
      const u = 1 - t;
      out.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
  return out;
}

function dans(poly: Pt[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * Les points sont posés l'oiseau droit, puis penchés vers la lune (PENCHE : le
 * haut part vers la droite, la queue vers la gauche), comme le pèlerin posé
 * qui regarde au loin ; la pierre reste d'aplomb.
 */
const PENCHE = 0.08;
const penche = (pts: readonly P[]): P[] => pts.map((p) => (p.length === 3 ? [p[0] + (430 - p[1]) * PENCHE, p[1], p[2]] : [p[0] + (430 - p[1]) * PENCHE, p[1]]));

// La tête : le crochet du bec, l'arête, la cire, le front qui file vers le bec, le crâne plat, la nuque.
const TETE: P[] = penche([
  [396, 142, 1], [394, 128], [388, 116], [378, 108], [368, 102], [358, 90], [342, 77], [320, 68], [296, 65], [272, 69], [254, 81], [243, 99],
]);
// Le dos : le cou, le manteau, la bosse de l'aile à l'épaule, puis le bord de l'aile repliée jusqu'à sa pointe.
const DOS: P[] = penche([[238, 122], [232, 148], [222, 172], [206, 200], [192, 236], [179, 288], [168, 348], [158, 414], [149, 482], [140, 548], [130, 610], [121, 664], [114, 714, 1]]);
// La queue au-delà de la pointe de l'aile, son bout carré ; le dessous, les sous-caudales, la culotte, le ventre, le poitrail bombé, la gorge.
const DESSOUS: P[] = penche([
  [110, 736], [106, 752], [104, 768, 1], [134, 772, 1], [142, 748], [152, 712], [162, 676], [176, 640], [192, 610], [210, 586],
  [228, 574], [244, 580], [262, 594], [282, 600], [300, 594], [313, 576], [324, 548], [339, 506], [357, 456], [375, 398],
  [386, 340], [390, 284], [384, 236], [372, 204], [361, 182], [356, 166], [358, 152],
]);
// Le bas du bec : la mandibule, la commissure, la dent du bec, jusqu'au crochet.
const BAS_DU_BEC: P[] = penche([[364, 148], [374, 147], [380, 143, 1], [384, 140], [388, 142, 1], [393, 145]]);
const PTS_FAUCON: P[] = [...TETE, ...DOS, ...DESSOUS, ...BAS_DU_BEC];

/** Le bec, court et haut : le filet nu, cerné ; la cire, en lamelles ; la dent. */
const PTS_BEC: P[] = penche([[368, 102], [378, 108], [388, 116], [394, 128], [396, 142, 1], [393, 145], [388, 142, 1], [384, 140], [380, 143, 1], [372, 138], [366, 128], [364, 114]]);
const PTS_CIRE: P[] = penche([[358, 95], [368, 102], [373, 112], [371, 124], [366, 132], [360, 126], [356, 114], [355, 104]]);
/**
 * Le capuchon : le crâne, la nuque, le tour de l'œil, et la moustache qui tombe
 * sous l'œil ; entre la nuque et la moustache, la joue blanche remonte jusque
 * derrière l'œil (ses points reprennent ceux du faucon : un seul contour).
 */
const PTS_CAPUCHON: P[] = [
  ...TETE.slice(5),
  ...penche([
    [238, 122], [236, 140], [246, 148], [256, 138], [266, 122], [282, 114], [302, 115], [312, 122], [312, 142], [314, 164], [318, 188],
    [332, 198, 1], [346, 182], [350, 160], [352, 140], [356, 126], [358, 112], [357, 101],
  ]),
];
/** L'œil : grand, sombre, l'anneau fin ; l'arcade en surplomb. */
const OEIL = (() => {
  const [[cx, cy]] = penche([[334, 108]]);
  return { cx, cy, r: 13.5 };
})();
const ARCADE: P[] = penche([[314, 93], [326, 87], [340, 87], [352, 92]]);
/** L'aile repliée : de l'épaule, le long du dos jusqu'à la pointe, puis son bord bas qui remonte au poignet. */
const PTS_AILE: P[] = penche([
  [228, 168], [206, 200], [192, 236], [179, 288], [168, 348], [158, 414], [149, 482], [140, 548], [130, 610], [121, 664], [114, 714, 1],
  [134, 676], [160, 620], [190, 556], [220, 486], [250, 414], [276, 346], [298, 290], [312, 252, 2], [304, 214], [282, 188], [254, 172],
]);
const POINTE = PTS_AILE[10];
/** La pointe de l'autre aile, qui croise la queue (l'oiseau n'est pas plat comme un signe). */
const PTS_AUTRE_AILE: P[] = penche([[146, 640], [132, 690], [124, 734, 1], [142, 702], [160, 662]]);
const POINTE_AUTRE = PTS_AUTRE_AILE[2];
/** La queue (pour ses barres) : sous la pointe de l'aile, jusqu'à son bout. */
const PTS_QUEUE: P[] = penche([[121, 664], [110, 736], [106, 752], [104, 768, 1], [134, 772, 1], [142, 748], [152, 712], [162, 676], [176, 640], [154, 640]]);
/** Les pattes : le tarse court, trois doigts enroulés sur la pierre, le pouce derrière ; les serres. */
const PATTE_PRES: P[] = penche([[276, 590], [300, 590], [304, 616], [310, 638], [332, 638], [350, 644], [356, 654, 1], [340, 657], [316, 659], [298, 660], [278, 659], [264, 655, 1], [274, 646], [280, 626]]);
const PATTE_LOIN: P[] = penche([[244, 582], [264, 584], [266, 614], [270, 638], [286, 642], [294, 653, 1], [274, 657], [252, 657], [243, 650, 1], [250, 634], [248, 610]]);
const SERRES: P[][] = (
  [
    [[354, 648], [364, 652], [368, 664], [362, 676, 1], [360, 666], [356, 660], [348, 658]],
    [[318, 654], [328, 658], [330, 670], [324, 680, 1], [322, 672], [318, 666], [310, 664]],
    [[266, 650], [258, 656], [258, 668], [264, 676, 1], [265, 668], [268, 662], [276, 659]],
  ] as P[][]
).map((l) => penche(l));
/** Les écailles du tarse, en travers. */
const ECAILLES_TARSE: P[][] = (
  [
    [[280, 600], [302, 600]], [[281, 610], [303, 610]], [[282, 620], [305, 620]], [[284, 630], [307, 630]],
    [[249, 594], [265, 594]], [[249, 604], [266, 604]], [[250, 614], [267, 614]], [[251, 624], [268, 624]],
  ] as P[][]
).map((l) => penche(l));
/** La pierre de la falaise, centrée sous les doigts, d'aplomb : le dessus, la face, le flanc à l'ombre. */
const DX_PIERRE = (430 - 650) * PENCHE;
const PTS_PIERRE: P[] = (
  [
    [204, 668, 1], [236, 656], [290, 652], [342, 652], [384, 656], [406, 667, 1], [414, 700], [408, 732, 1], [382, 752], [328, 758],
    [270, 756], [228, 752, 1], [208, 732], [200, 700],
  ] as P[]
).map((p) => (p.length === 3 ? [p[0] + DX_PIERRE, p[1], p[2]] : [p[0] + DX_PIERRE, p[1]]));
/** Les arêtes de la pierre : le bord du dessus, la face à l'ombre, une fente. */
const ARETES: P[][] = [
  [[206, 672], [260, 680], [330, 682], [404, 670]],
  [[404, 670], [398, 700], [392, 728], [384, 750]],
  [[300, 682], [297, 710], [294, 734], [292, 756]],
].map((l) => l.map(([x, y]) => [x + DX_PIERRE, y] as P));

const FAUCON = lisse(PTS_FAUCON);
const AILE = lisse(PTS_AILE);
const CAPUCHON = lisse(PTS_CAPUCHON);
const PIERRE = lisse(PTS_PIERRE);
const P_FAUCON = polygone(PTS_FAUCON);
const P_AILE = polygone(PTS_AILE);
const P_CAPUCHON = polygone(PTS_CAPUCHON);
const P_BEC = polygone(PTS_BEC);
const P_CIRE = polygone(PTS_CIRE);
const P_QUEUE = polygone(PTS_QUEUE);
const P_AUTRE = polygone(PTS_AUTRE_AILE);
const P_PIERRE = polygone(PTS_PIERRE);
const P_PATTES = [polygone(PATTE_PRES), polygone(PATTE_LOIN)];

/** La silhouette (le skin découpe le treillis autour, le gaufrage la relève). */
export const SILHOUETTE_EG = { d: FAUCON + lisse(PATTE_PRES) + lisse(PATTE_LOIN) + lisse(PTS_AUTRE_AILE), pierre: PIERRE } as const;

/* ------------------------------ Les lamelles ------------------------------ */

/** La maille du filet : les lamelles en quinconce, au pas du châle, un peu plus fines pour le dessin. */
const PX = 7.4;
const PY = 10.4;
const L = 5;
const HL = 8.2;

/** Une lamelle entière dans la forme : ses quatre coins dedans (jamais coupée au contour). */
const entiere = (poly: Pt[], x: number, y: number) =>
  dans(poly, x - L / 2 - 0.6, y - HL / 2) && dans(poly, x + L / 2 + 0.6, y - HL / 2) && dans(poly, x - L / 2 - 0.6, y + HL / 2) && dans(poly, x + L / 2 + 0.6, y + HL / 2);

/** Ce que fait le métal à la maille (x, y), rang j : « o » une lamelle, « » le filet nu. */
function motif(x: number, y: number, j: number): boolean {
  if (dans(P_BEC, x, y)) return dans(P_CIRE, x, y);
  if (Math.hypot(x - OEIL.cx, y - OEIL.cy) < OEIL.r + 5) return false;
  if (dans(P_CAPUCHON, x, y)) return false;
  if (dans(P_AILE, x, y)) {
    if (y < 318) {
      // Les petites couvertures : des écailles (des arcs de lamelles, en rangs décalés).
      const rg = Math.floor((y - 170) / 24);
      const u = ((((x - 160 + (rg % 2) * 17) % 34) + 34) % 34) - 17;
      const v = (((y - 170) % 24) + 24) % 24;
      return Math.abs(v - (16 - (u * u) / 24)) < 3.6;
    }
    if (y < 430) {
      // Les grandes couvertures : des festons plus larges.
      const rg = Math.floor((y - 318) / 36);
      const u = ((((x - 150 + (rg % 2) * 24) % 48) + 48) % 48) - 24;
      const v = (((y - 318) % 36) + 36) % 36;
      return Math.abs(v - (26 - (u * u) / 26)) < 3.6;
    }
    // Les rémiges : des lignes qui convergent vers la pointe de l'aile.
    const a = (Math.atan2(y - POINTE[1], x - POINTE[0]) * 180) / Math.PI;
    return ((a / 1.9) % 1 + 1) % 1 < 0.36;
  }
  if (dans(P_AUTRE, x, y)) return ((((Math.atan2(y - POINTE_AUTRE[1], x - POINTE_AUTRE[0]) * 180) / Math.PI / 2.2) % 1) + 1) % 1 < 0.34;
  if (dans(P_QUEUE, x, y)) return j % 3 === 0;
  // Le bas du poitrail, les flancs, les culottes : barrés ; la gorge, la joue et le haut du poitrail : pleins.
  if (y > 300) return j % 3 !== 0;
  return true;
}

function lamelles(graine: number) {
  const rnd = alea(graine ^ 0xfa1c0);
  let corps = "";
  let arete = "";
  const pose = (x: number, y: number) => {
    const pen = (rnd() - 0.5) * 1.4;
    corps += `M${f(x - L / 2 + pen)} ${f(y - HL / 2)}h${L}l${f(-pen * 2)} ${HL}h${-L}Z`;
    arete += `M${f(x - L / 2 + pen + 0.6)} ${f(y - HL / 2 + 1.1)}h${f(L - 1.3)}`;
  };
  let j = 0;
  for (let y = 56; y < 830; y += PY, j++) {
    for (let x = 90 + (j % 2 ? PX / 2 : 0); x < 460; x += PX) {
      // La pierre : des assises, le dessus plein, la face un rang sur deux, des joints.
      if (entiere(P_PIERRE, x, y) && !P_PATTES.some((p) => dans(p, x, y))) {
        // Le dessus éclairé : plein ; la face : un rang sur deux, des joints ; le flanc à l'ombre (au-delà de l'arête) : un rang sur trois.
        const xp = x - DX_PIERRE;
        const dessus = y < 680 - Math.abs(xp - 310) * 0.05;
        const ombre = xp > 402 - (y - 670) * 0.25;
        const joint = Math.abs(((xp - 200 + (Math.floor((y - 682) / 26) % 2) * 40) % 80) - 40) < 4;
        if (dessus || (ombre ? j % 3 === 0 : j % 2 === 0 && !joint)) pose(x, y);
        continue;
      }
      if (P_PATTES.some((p) => entiere(p, x, y))) {
        if (j % 4 !== 3) pose(x, y);
        continue;
      }
      if (!entiere(P_FAUCON, x, y) && !entiere(P_AUTRE, x, y)) continue;
      if (motif(x, y, j)) pose(x, y);
    }
  }
  return { corps, arete };
}

const deja = new Map<number, ReturnType<typeof lamelles>>();
function filet(graine: number) {
  let l = deja.get(graine);
  if (!l) {
    if (deja.size > 24) deja.clear();
    l = lamelles(graine);
    deja.set(graine, l);
  }
  return l;
}

const ARGENT = "222,224,228";
const NOIR = "#0e0e10";

/** Le dos : le faucon en lamelles d'argent sur le filet noir. */
function Telli({ graine, id }: PropsTotem) {
  const l = filet(graine);
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      <defs>
        {/* L'argent : des bandes plus ou moins claires en biais, le scintillement des lamelles. */}
        <linearGradient id={`fe${id}`} gradientUnits="userSpaceOnUse" x1={60} y1={40} x2={520} y2={900}>
          {[0, 0.1, 0.2, 0.31, 0.42, 0.52, 0.63, 0.74, 0.86, 1].map((o, i) => (
            <stop key={o} offset={o} stopColor={i % 2 ? "#d4d7dc" : "#8f939b"} />
          ))}
        </linearGradient>
      </defs>
      {/* Le filet nu sous lui : il cache ce qui passe derrière. */}
      <path d={FAUCON + PIERRE + lisse(PATTE_PRES) + lisse(PATTE_LOIN) + lisse(PTS_AUTRE_AILE)} fill={NOIR} />
      <path d={l.corps} fill="rgba(0,0,0,0.7)" transform="translate(0.8 1.3)" />
      <path d={l.corps} fill={`url(#fe${id})`} />
      <path d={l.arete} stroke={`rgba(${ARGENT},0.9)`} strokeWidth={1} />
      {/* Le fil d'argent : un seul contour pour l'oiseau ; l'aile, le capuchon, le bec, les pattes, la pierre. */}
      <g fill="none" stroke={`rgba(${ARGENT},0.85)`}>
        <path d={FAUCON} strokeWidth={2.2} />
        <path d={AILE} strokeWidth={1.6} />
        <path d={lisse(PTS_AUTRE_AILE)} strokeWidth={1.4} />
        <path d={CAPUCHON} strokeWidth={1.5} />
        <path d={lisse(PTS_BEC)} strokeWidth={1.8} />
        <path d={lisse(PATTE_PRES) + lisse(PATTE_LOIN)} strokeWidth={1.6} />
        <path d={PIERRE} strokeWidth={1.8} />
        <path d={ARETES.map(trace).join("")} strokeWidth={1.4} opacity={0.75} />
        <path d={ECAILLES_TARSE.map(trace).join("")} strokeWidth={1.2} opacity={0.8} />
        <path d={trace(ARCADE)} strokeWidth={2.6} />
      </g>
      <path d={SERRES.map(lisse).join("")} fill={NOIR} stroke={`rgba(${ARGENT},0.9)`} strokeWidth={1.4} />
      {/* L'œil : grand et sombre, l'anneau fin, un éclat. */}
      <circle cx={OEIL.cx} cy={OEIL.cy} r={OEIL.r} fill={NOIR} stroke={`rgb(${ARGENT})`} strokeWidth={1.5} />
      <circle cx={OEIL.cx + 3.5} cy={OEIL.cy - 4} r={2.8} fill={`rgb(${ARGENT})`} />
    </g>
  );
}

/** La face : le gaufrage (lumière en haut à gauche, ombre en bas à droite), le capuchon, l'aile et l'œil en creux. */
function Gaufre({ photo, tons, id }: PropsTotem) {
  const ombre = photo ? "rgba(4,4,6,0.62)" : "rgba(0,0,0,0.6)";
  const lumiere = photo ? "rgba(232,234,238,0.55)" : `rgba(${tons.encre},0.4)`;
  const forme = SILHOUETTE_EG.d + PIERRE;
  return (
    <g fill="none" strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <mask id={`fg${id}`} maskUnits="userSpaceOnUse" x={40} y={20} width={460} height={820}>
          <rect x={40} y={20} width={460} height={820} fill="#fff" />
          <path d={forme} fill="#000" />
        </mask>
      </defs>
      <path d={forme} fill={photo ? "rgba(232,234,238,0.1)" : `rgba(${tons.encre},0.04)`} />
      <g mask={`url(#fg${id})`}>
        <path d={forme} stroke={ombre} strokeWidth={12} transform="translate(4 5)" />
        <path d={forme} stroke={lumiere} strokeWidth={12} transform="translate(-4 -5)" />
      </g>
      <path d={AILE + CAPUCHON} stroke={ombre} strokeWidth={4} transform="translate(-1.5 -2)" />
      <path d={AILE + CAPUCHON} stroke={lumiere} strokeWidth={4} transform="translate(1.5 2)" />
      <path d={CAPUCHON} fill={photo ? "rgba(4,4,6,0.22)" : "rgba(0,0,0,0.2)"} />
      <circle cx={OEIL.cx} cy={OEIL.cy} r={OEIL.r} fill={ombre} />
    </g>
  );
}

const totem: TotemNation = {
  nation: "eg",
  animal: "faucon",
  quoi: "Le faucon pèlerin perché sur une pierre, de profil, la moustache noire et la joue blanche sous l'œil : en lamelles d'argent nouées sur le filet noir comme un châle de telli, le capuchon laissé vide.",
  sources: [
    { titre: "CBC, Peregrine Profile : la moustache plus large et le capuchon plus sombre du pèlerin", url: "https://www.cbc.ca/manitoba/features/falcon/profile.html" },
    { titre: "U.S. Fish and Wildlife Service, faucon pèlerin : la moustache sombre détachée par la joue claire", url: "https://legacy.fws.gov/species/peregrine-falcon-falco-peregrinus" },
    { titre: "The Falcon Project (UMass) : l'apparence des faucons, la dent du bec", url: "https://openbooks.library.umass.edu/thefalconproject/chapter/appearance/" },
    { titre: "Raptor Resource Project : les faucons, la tête ronde, le corps compact, les ailes pointues", url: "https://www.raptorresource.org/2021/10/16/who-doesnt-love-falcons/" },
    { titre: "R. Porter, Journal of Ancient Egyptian Interconnections : les faucons d'Horus et les vrais faucons (pèlerin, lanier, crécerelle)", url: "https://journals.librarypublishing.arizona.edu/jaei/article/id/963/" },
    { titre: "Textile Research Centre (Leyde) : le tulle bi telli, des lamelles nouées sur le filet", url: "https://trc-leiden.nl/trc-needles/regional-traditions/middle-east-and-north-africa/pre-modern-middle-east-and-north-africa/tulle-bi-telli" },
  ],
  dessine: true,
  boite: { w: 480, h: 820 },
  pose: {
    // Au dos : grand, à gauche, sur sa pierre, face à la lune à hauteur de son regard (LUNE_EG).
    dos: { ...POSE_DOS_EG, devant: true, lune: LUNE_EG },
    // À la face : dans le coin bas gauche du portrait, le bout de la queue à droite de l'équerre (x 71 → 114).
    face: { portrait: { x: 104, y: 972 - 790 * 0.3, echelle: 0.3 } },
  },
  Dessin: (p) => {
    if (p.couche === "dos") return <Telli {...p} />;
    if (p.couche === "face-portrait") return <Gaufre {...p} />;
    return null;
  },
};

export default totem;
