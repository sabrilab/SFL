// Le totem du Sénégal (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// Le lion assis qui veille, de profil, vers la gauche, la tête levée de 28°
// vers la lune : les pattes avant en colonnes, le poitrail sous la
// crinière, la hanche posée au sol, la cuisse ronde, le pied arrière à plat
// devant elle, la queue couchée derrière, sa touffe relevée. Ni le marcheur
// du Maroc, ni le rugissant du Cameroun : le gardien calme, celui qui
// accueille (la teranga). Sa tête est à lui : le front court, la truffe
// large, l'œil lourd sous la paupière, la mâchoire et les bajoues pleines,
// la barbe du menton.
// Il est tissé dans le pagne manjak (../senegal.tsx) : il n'existe que par
// ses rangs de flottés, la trame qui passe par-dessus la chaîne, rang après
// rang (PR) ; ses bords sont en escalier, au pas des rangs et des fils de
// chaîne (PC), sans aucun cerne. Les traits sont des jours : la toile nue
// entre deux flottés (la bouche, le pli de la cuisse, la séparation des
// pattes, les doigts, les mèches) ; l'œil et la truffe sont d'un fil
// sombre. L'ombre est dans la densité : là où la lumière ne vient pas, les
// flottés sont plus courts et les liages plus serrés, la toile paraît
// davantage. La crinière est teinte en réserve, en trois bandes (l'ocre
// près du visage, le brun, le brun sombre aux pointes)
// (le fil d'argent reste au pagne).
//   · au dos : le héros, sur un panneau de toile nue cousu au point de
//     surjet sur le pagne (PANNEAU_SENEGAL) ; la lune descendue en haut à
//     gauche, à 30° au-dessus de son regard, dans son cercle cousu
//     (LUNE_SENEGAL) ;
//   · à la face : le même lion brodé au point avant dans le coin bas du
//     portrait, un fil écru et son ombre ; la crinière remplie de rangs de
//     points qui suivent les mèches.
// Les tracés sont des points posés à la main, liés en béziers tendus ; le
// tissage en est tiré une fois (le même pour tous) : la graine n'y touche pas.

import type { PropsTotem, TotemNation } from "../types";
import { f } from "../outils";

/** La lune, descendue en haut à gauche, à 30° au-dessus du regard du lion (le skin, ../senegal.tsx, la lit). */
export const LUNE_SENEGAL = { cx: 202, cy: 408, d: 150 } as const;
/** Le panneau de toile nue, cousu sur le pagne, où le lion est tissé (le skin le dessine). */
export const PANNEAU_SENEGAL = { x: 62, y: 100, l: 900, h: 1040, r: 36 } as const;

/* ------------------------------ Les tracés ------------------------------ */

/** Un point posé à la main ; 1 : un angle, 2 : un angle adouci. */
type P = readonly [number, number] | readonly [number, number, number];
type Seg = readonly [number, number, number, number, number, number, number, number];

/** Des points liés en béziers tendus : chaque point prend la tangente de ses voisins, les poignées valent un tiers de la corde. */
function segments(pts: readonly P[], ferme = true): Seg[] {
  const n = pts.length;
  const at = (i: number) => (ferme ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const tangente = (i: number): [number, number] => {
    const p = at(i);
    if (p[2] === 1) return [0, 0];
    const [a, b] = !ferme && (i === 0 || i === n - 1) ? (i === 0 ? [at(0), at(1)] : [at(n - 2), at(n - 1)]) : [at(i - 1), at(i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = p[2] === 2 ? 0.5 : 1;
    return [((b[0] - a[0]) / l) * k, ((b[1] - a[1]) / l) * k];
  };
  const out: Seg[] = [];
  for (let i = 0; i < (ferme ? n : n - 1); i++) {
    const [p, q] = [at(i), at(i + 1)];
    const c = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
    const [u, v] = [tangente(i), tangente(i + 1)];
    out.push([p[0], p[1], p[0] + u[0] * c, p[1] + u[1] * c, q[0] - v[0] * c, q[1] - v[1] * c, q[0], q[1]]);
  }
  return out;
}
const lisse = (pts: readonly P[], ferme = true) => {
  const s = segments(pts, ferme);
  return `M${f(s[0][0])} ${f(s[0][1])}${s.map((g) => `C${f(g[2])} ${f(g[3])} ${f(g[4])} ${f(g[5])} ${f(g[6])} ${f(g[7])}`).join("")}${ferme ? "Z" : ""}`;
};
/** Le même tracé, aplati en polygone (pour le tissage). */
function polygone(pts: readonly P[], ferme = true): [number, number][] {
  const out: [number, number][] = [];
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segments(pts, ferme)) {
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const u = 1 - t;
      out.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
  }
  if (!ferme) {
    const l = pts[pts.length - 1];
    out.push([l[0], l[1]]);
  }
  return out;
}
/** Un trait ouvert de largeur l, en polygone (un jour : la toile nue le long du trait). */
function bande(pts: readonly P[], l: number): [number, number][] {
  const ligne = polygone(pts, false);
  const g: [number, number][] = [];
  const d: [number, number][] = [];
  for (let i = 0; i < ligne.length; i++) {
    const [a, b] = [ligne[Math.max(0, i - 1)], ligne[Math.min(ligne.length - 1, i + 1)]];
    const n = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const [nx, ny] = [(b[1] - a[1]) / n, -(b[0] - a[0]) / n];
    g.push([ligne[i][0] + (nx * l) / 2, ligne[i][1] + (ny * l) / 2]);
    d.push([ligne[i][0] - (nx * l) / 2, ligne[i][1] - (ny * l) / 2]);
  }
  return [...g, ...d.reverse()];
}

/* ------------------------------- Le corps ------------------------------- */

// Le repère : le sol à y 880, le garrot à y 345 (assis, l'avant reste à sa hauteur).

/** La queue, couchée sur le sol derrière la hanche ; la touffe relevée, détachée des pieds. */
const QUEUE: P[] = [[596, 846], [640, 862], [690, 870], [728, 860], [750, 838], [760, 828], [768, 840], [756, 866], [732, 884], [690, 890], [636, 884], [590, 872]];
const TOUFFE: P[] = [[746, 836], [752, 808], [772, 796], [792, 806], [794, 830], [778, 846], [758, 848]];
/** La patte avant lointaine, derrière la proche. */
const AVANT_LOIN: P[] = [[252, 630], [300, 634], [298, 720], [294, 800], [292, 836], [298, 858], [302, 876], [296, 880, 1], [232, 880, 1], [228, 870], [242, 858], [256, 842], [258, 800], [256, 720]];
/** L'arrière-train assis : le dos qui descend du garrot, la hanche, la cuisse ronde, la fesse au sol, le pied arrière à plat devant. */
const CORPS: P[] = [
  [330, 345], [400, 382], [462, 444], [520, 520], [566, 596], [600, 676], [616, 752], [612, 816], [596, 856], [572, 878, 1], [470, 880],
  [420, 880], [352, 882], [318, 880, 1], [314, 868], [326, 856], [360, 850], [398, 846], [380, 820], [366, 780], [370, 742], [350, 724], [300, 700], [260, 670], [240, 600], [244, 480], [270, 400],
];
/** La patte avant proche, en colonne : le coude sous la crinière, le poignet, le pied. */
const AVANT: P[] = [[188, 600], [262, 610], [258, 700], [252, 780], [250, 826], [256, 850], [258, 872], [250, 880, 1], [152, 880, 1], [146, 872], [158, 860], [184, 852], [198, 834], [200, 780], [196, 700]];

/* -------------------------------- La tête -------------------------------- */

/**
 * La tête, dessinée dans son repère (la truffe à gauche), levée par tete() de
 * 28° vers la lune : le front court, la truffe large, le museau gonflé, la
 * mâchoire lourde et la barbe du menton, la bajoue sous la joue.
 */
const A = (-28 * Math.PI) / 180;
const tete = (pts: readonly P[]): P[] =>
  pts.map((p) => {
    const [dx, dy] = [(p[0] - 120) * 1.42, (p[1] - 70) * 1.42];
    const q: [number, number] = [222 + dx * Math.cos(A) - dy * Math.sin(A), 266 + dx * Math.sin(A) + dy * Math.cos(A)];
    return p.length === 3 ? [q[0], q[1], p[2]] : q;
  });
const TETE = tete([[30, 88, 1], [48, 79], [72, 72], [94, 66], [110, 58], [124, 50], [142, 44], [158, 46], [168, 64], [172, 100], [170, 136], [160, 160], [142, 174], [118, 178], [94, 174], [74, 166], [58, 152], [50, 138], [40, 126], [33, 110]]);
const MUSEAU = tete([[33, 108], [48, 100], [70, 100], [92, 108], [108, 122], [112, 136], [100, 146], [80, 150], [62, 146], [48, 134], [38, 120]]);
const BARBE = tete([[58, 152], [78, 158], [104, 160], [128, 158], [146, 168], [128, 178], [100, 178], [76, 170]]);
const TRUFFE = tete([[30, 88, 1], [48, 80], [64, 80], [70, 90], [62, 102], [46, 108], [32, 104]]);
const OEIL = tete([[90, 77], [105, 62], [129, 57], [148, 64], [133, 81], [107, 86]]);
const IRIS = tete([[106, 72], [116, 63], [130, 63], [131, 73], [117, 78]]);
/** Le cerne clair autour de l'œil (le poil blanc des lions), qui le détache du fauve. */
const CERNE = tete([[80, 80], [100, 56], [130, 49], [158, 60], [142, 88], [104, 95]]);
const BOUCHE = tete([[50, 140], [72, 150], [98, 152], [118, 146], [128, 138]]);
const PAUPIERE = tete([[90, 60], [110, 51], [134, 50], [152, 58]]);

/** La fraise : la tête grandie, autour du visage, d'un ocre plus sombre que lui (elle le détache de la crinière). */
const FRAISE = tete([[36, 66], [70, 46], [110, 30], [150, 22], [188, 30], [204, 64], [208, 108], [200, 150], [180, 182], [146, 200], [108, 200], [74, 190], [52, 170]]);

/* ------------------------------ La crinière ------------------------------ */

/** La crinière : derrière la tête (la face sort de la silhouette), sur le cou et le garrot, l'épaule, le plastron entre les pattes. */
const CRINIERE: P[] = [
  [226, 226], [250, 196], [290, 184], [338, 196], [382, 228], [414, 274], [432, 330], [452, 388], [444, 436], [462, 480], [436, 520], [446, 566],
  [410, 590], [402, 632], [366, 640], [348, 672], [314, 652], [290, 684], [262, 650], [236, 684], [214, 646], [186, 668], [176, 620], [154, 604], [172, 566], [156, 528],
  [180, 498], [172, 456], [186, 420], [196, 396], [250, 380], [300, 340], [310, 280], [280, 230],
];
/** La teinture en réserve : deux bandes plus claires vers le visage (la crinière resserrée vers la nuque). */
const resserre = (pts: readonly P[], k: number, [cx, cy]: [number, number]): P[] => pts.map((p) => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
const CRINIERE_MI = resserre(CRINIERE, 0.8, [262, 300]);
const CRINIERE_IN = resserre(CRINIERE, 0.6, [250, 290]);
/** Les mèches : des jours qui partent de la nuque et descendent. */
const MECHES: P[][] = [
  [[300, 176], [352, 214], [390, 268]],
  [[290, 236], [350, 300], [400, 372], [420, 430]],
  [[280, 300], [330, 380], [370, 470], [396, 540]],
  [[262, 350], [290, 440], [320, 530], [340, 600]],
  [[236, 380], [242, 470], [256, 560], [272, 630]],
  [[208, 420], [200, 500], [208, 580], [222, 640]],
];

/* ------------------------------ Les jours ------------------------------- */

/** La cuisse : un ovale fermé, de la hanche au jarret. */
const CUISSE: P[] = [[560, 610], [596, 690], [600, 770], [574, 840], [520, 866], [452, 858], [404, 820], [392, 770], [420, 712], [480, 652]];
/** La séparation des pattes avant, et la patte du corps. */
const SEPARATIONS: P[][] = [
  [[262, 640], [258, 700], [252, 780], [250, 830], [256, 860]],
  [[300, 700], [338, 726], [368, 744]],
];
/** Les doigts. */
const DOIGTS: P[][] = [
  [[170, 880], [174, 866], [182, 858]],
  [[194, 880], [198, 866], [206, 860]],
  [[338, 880], [342, 868], [350, 860]],
  [[362, 880], [366, 868], [374, 862]],
];

/* ------------------------------ Le tissage ------------------------------- */

/** Le pas des rangs (la trame) et des fils de chaîne, dans la boîte (≈ 7,5 et 3,8 à la carte, le pas du pagne). */
const PR = 8;
const PC = 4;
const LARGEUR = 800;
const HAUTEUR = 900;

/** Les fils : leur couleur, et les flottés (en fils de chaîne), séparés d'un liage. */
interface Fil {
  couleur: string;
  flottes: readonly number[];
}
// L'écru du coton, l'ocre, le fauve, les bruns ; aucune teinte proche de l'or (saturation sous 0,40).
const FILS = {
  fauve: { couleur: "#b8976f", flottes: [6, 4, 7, 5] },
  clair: { couleur: "#c8ae8a", flottes: [7, 5, 8, 6] },
  ombre: { couleur: "#8f714f", flottes: [3, 2, 4, 2] },
  loin: { couleur: "#6a523a", flottes: [2, 3, 2] },
  tete: { couleur: "#c6a985", flottes: [5, 4, 6] },
  fraise: { couleur: "#7e5435", flottes: [3, 4, 3] },
  creme: { couleur: "#d8c8ac", flottes: [5, 6, 4] },
  sombre: { couleur: "#2d2119", flottes: [9] },
  ambre: { couleur: "#b08a55", flottes: [9] },
  ocre: { couleur: "#9b6a43", flottes: [5, 3, 6, 4] },
  brun: { couleur: "#6e4a2f", flottes: [4, 3, 5] },
  noir: { couleur: "#4a3324", flottes: [3, 2, 3, 4] },
} as const satisfies Record<string, Fil>;
type CleFil = keyof typeof FILS;
const CLES = Object.keys(FILS) as CleFil[];
const JOUR = 255;

/** Les zones du tissage, de l'arrière vers l'avant ; `sur` : seulement par-dessus ces fils (une bande de teinture, une ombre). */
type Zone = { poly: [number, number][]; fil: CleFil | "jour"; sur?: readonly CleFil[] };

/** Les ombres et les lumières, posées à la main : sous le ventre et la cuisse, le haut de la hanche. */
const OMBRE_VENTRE: P[] = [[250, 650], [330, 700], [390, 740], [400, 800], [380, 860], [320, 880], [240, 880], [230, 760]];
const OMBRE_CUISSE: P[] = [[404, 820], [452, 858], [520, 866], [574, 840], [600, 860], [580, 900], [380, 900]];
const LUMIERE_HANCHE: P[] = [[400, 380], [470, 452], [526, 528], [560, 600], [520, 610], [470, 560], [420, 480], [380, 420]];

const ZONES: Zone[] = [
  { poly: polygone(QUEUE), fil: "fauve" },
  { poly: polygone(TOUFFE), fil: "noir" },
  { poly: polygone(AVANT_LOIN), fil: "loin" },
  { poly: polygone(CORPS), fil: "fauve" },
  { poly: polygone(LUMIERE_HANCHE), fil: "clair", sur: ["fauve"] },
  { poly: polygone(OMBRE_VENTRE), fil: "ombre", sur: ["fauve"] },
  { poly: polygone(OMBRE_CUISSE), fil: "ombre", sur: ["fauve"] },
  { poly: bande(CUISSE.concat([CUISSE[0]]), 7), fil: "jour", sur: ["fauve", "clair", "ombre"] },
  { poly: polygone(CRINIERE), fil: "noir" },
  { poly: polygone(CRINIERE_MI), fil: "brun", sur: ["noir"] },
  { poly: polygone(CRINIERE_IN), fil: "ocre", sur: ["brun"] },
  ...MECHES.map((m): Zone => ({ poly: bande(m, 6), fil: "jour", sur: ["noir", "brun", "ocre"] })),
  { poly: polygone(AVANT), fil: "fauve" },
  ...SEPARATIONS.map((m): Zone => ({ poly: bande(m, 7), fil: "jour", sur: ["fauve", "ombre", "loin"] })),
  ...DOIGTS.map((m): Zone => ({ poly: bande(m, 6), fil: "jour", sur: ["fauve", "ombre", "loin"] })),
  { poly: polygone(FRAISE), fil: "fraise", sur: ["noir", "brun", "ocre"] },
  { poly: polygone(TETE), fil: "tete" },
  { poly: polygone(MUSEAU), fil: "creme" },
  { poly: polygone(BARBE), fil: "creme" },
  { poly: polygone(TRUFFE), fil: "sombre" },
  { poly: bande(BOUCHE, 6), fil: "jour" },
  { poly: bande(PAUPIERE, 5), fil: "jour", sur: ["tete"] },
  { poly: polygone(CERNE), fil: "creme", sur: ["tete"] },
  { poly: polygone(OEIL), fil: "sombre" },
  { poly: polygone(IRIS), fil: "ambre", sur: ["sombre"] },
];

/** Les abscisses où une horizontale coupe un polygone (pair-impair), en paires [entrée, sortie]. */
function coupes(poly: [number, number][], y: number): [number, number][] {
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [[x1, y1], [x2, y2]] = [poly[i], poly[j]];
    if (y1 > y !== y2 > y) xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
  }
  xs.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < xs.length; k += 2) out.push([xs[k], xs[k + 1]]);
  return out;
}

/**
 * Le tissage, tiré une fois : chaque rang est une ligne de cellules (une par
 * fil de chaîne) ; chaque zone peint les cellules qu'elle couvre, de
 * l'arrière vers l'avant ; puis chaque suite de cellules du même fil devient
 * des flottés, coupés d'un liage, décalés d'un rang à l'autre.
 */
function tisser(): Record<CleFil, string> {
  const out = Object.fromEntries(CLES.map((k) => [k, ""])) as Record<CleFil, string>;
  const colonnes = Math.ceil(LARGEUR / PC);
  const cellules = new Uint8Array(colonnes);
  for (let r = 0; r * PR < HAUTEUR; r++) {
    const y = r * PR + PR / 2;
    cellules.fill(0);
    for (const z of ZONES) {
      const code = z.fil === "jour" ? JOUR : CLES.indexOf(z.fil) + 1;
      const sur = z.sur?.map((k) => CLES.indexOf(k) + 1);
      for (const [a, b] of coupes(z.poly, y)) {
        for (let c = Math.ceil(a / PC - 0.5); c <= Math.floor(b / PC - 0.5); c++) {
          if (c < 0 || c >= colonnes) continue;
          const v = cellules[c];
          if (sur ? sur.includes(v) : z.fil !== "jour" || v !== 0) cellules[c] = code;
        }
      }
    }
    let c = 0;
    while (c < colonnes) {
      const v = cellules[c];
      let e = c;
      while (e + 1 < colonnes && cellules[e + 1] === v) e++;
      if (v !== 0 && v !== JOUR) {
        const cle = CLES[v - 1];
        const motif = FILS[cle].flottes;
        // Le décalage du rang : les liages ne s'alignent jamais d'un rang à l'autre.
        let k = (r * 3) % motif.length;
        let x = c - ((r * 2) % 3);
        while (x <= e) {
          const l = motif[k % motif.length];
          const [a, b] = [Math.max(x, c), Math.min(x + l - 1, e)];
          if (b >= a) out[cle] += `M${f(a * PC + 0.5)} ${y}H${f((b + 1) * PC - 0.5)}`;
          x += l + 1;
          k++;
        }
      }
      c = e + 1;
    }
  }
  return out;
}
let TISSAGE: Record<CleFil, string> | null = null;
const tissage = () => (TISSAGE ??= tisser());

function Lion() {
  const t = tissage();
  return (
    <g fill="none" strokeLinecap="butt">
      {CLES.map((k) => (
        <path key={k} d={t[k]} stroke={FILS[k].couleur} strokeWidth={5.6} />
      ))}
      {/* Le brillant du fil : une lumière fine sur le haut de chaque flotté. */}
      <path d={CLES.filter((k) => k !== "sombre").map((k) => t[k]).join("")} stroke="#fff" strokeOpacity={0.14} strokeWidth={1.4} transform="translate(0 -1.6)" />
    </g>
  );
}

/* ------------------------------- La broderie ------------------------------ */

/** Les rangs de point avant dans la crinière : ils suivent les mèches. */
const RANGS_CRINIERE = MECHES.map((m) => lisse(m, false)).join("");

/**
 * La face : le lion brodé au point avant dans un coin du portrait, un fil
 * écru qui passe dessus, dessous (le contour seul, les arêtes cachées
 * coupées par des découpes « hors de »), la crinière remplie de rangs qui
 * suivent les mèches, et l'ombre du fil sur la photo.
 */
function Broderie({ id, photo }: { id: string; photo: boolean }) {
  const c = (k: string) => `sn-b${k}-${id}`;
  const horsDe = (k: string, d: string) => (
    <clipPath id={c(k)}>
      <path d={`M-40 -40H840V960H-40Z${d}`} clipRule="evenodd" />
    </clipPath>
  );
  const fil = photo ? "rgba(240,232,214,0.92)" : "rgba(236,229,214,0.62)";
  const ombre = photo ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.5)";
  const point = (d: string, e = 12, pas = "26 13") => (
    <>
      <path d={d} fill="none" stroke={ombre} strokeWidth={e + 2} strokeDasharray={pas} transform="translate(4 5)" strokeLinecap="round" />
      <path d={d} fill="none" stroke={fil} strokeWidth={e} strokeDasharray={pas} strokeLinecap="round" />
    </>
  );
  const [corps, avant, crin, tet] = [lisse(CORPS), lisse(AVANT), lisse(CRINIERE), lisse(TETE)];
  return (
    <>
      <defs>
        {horsDe("c", corps)}
        {horsDe("a", avant)}
        {horsDe("m", crin)}
        {horsDe("t", tet)}
        <clipPath id={c("i")}>
          <path d={crin} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${c("c")})`}>
        <g clipPath={`url(#${c("a")})`}>{point(lisse(QUEUE) + lisse(TOUFFE) + lisse(AVANT_LOIN))}</g>
      </g>
      <g clipPath={`url(#${c("m")})`}>
        <g clipPath={`url(#${c("a")})`}>{point(corps + lisse(CUISSE))}</g>
        {point(avant)}
      </g>
      <g clipPath={`url(#${c("t")})`}>
        {point(crin)}
        <g clipPath={`url(#${c("i")})`}>{point(RANGS_CRINIERE, 9, "16 12")}</g>
      </g>
      {point(tet + lisse(TRUFFE) + lisse(OEIL))}
    </>
  );
}

function Dessin({ couche, id, photo }: PropsTotem) {
  if (couche === "dos") return <Lion />;
  if (couche === "face-portrait") return <Broderie id={id} photo={photo} />;
  return null;
}

const totem: TotemNation = {
  nation: "sn",
  animal: "lion",
  quoi: "Le lion assis qui veille, la tête levée vers la lune, tissé en flottés dans le pagne manjak (bords en escalier, jours, l'ombre par la densité) ; brodé au point avant dans le coin du portrait.",
  sources: [
    { titre: "Creative Bloq, How to draw a lion : le lion mâle de profil, du squelette à la forme", url: "https://www.creativebloq.com/how-to/how-to-draw-a-lion" },
    { titre: "K. Goldfinger, Animal Anatomy for Artists (Oxford University Press, 2004) : planches du lion, squelette et muscles", url: "https://academic.oup.com/book/41965" },
    { titre: "Wacom, Monika Zagrobelna, How to draw a realistic lion : la tête, le museau, les proportions", url: "https://community.wacom.com/en-us/how-to-draw-lion-monika-zagrobelna" },
    { titre: "The Met, Wrapper (Seru Njaago) : les flottés de trame sur bandes étroites, le tissage manjak", url: "https://www.metmuseum.org/art/collection/search/687565" },
  ],
  dessine: true,
  boite: { w: 800, h: 900 },
  pose: {
    dos: { x: 172, y: 263, echelle: 0.92, devant: true, lune: LUNE_SENEGAL },
    // À droite de l'équerre du coin bas gauche (x 72 → 112) : la touffe de la queue commence en x 125.
    face: { portrait: { x: 124, y: 744, echelle: 0.24, miroir: true } },
  },
  Dessin,
};

export default totem;
