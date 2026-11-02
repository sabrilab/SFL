// Le totem du Mali (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// L'aigle ravisseur (les Aigles), l'aigle des savanes du Sahel, en vol plané,
// vu de dessous, un peu incliné dans le virage, la tête vers la lune : les
// ailes longues et larges, au bord d'attaque bombé jusqu'au poignet, au bord
// de fuite presque droit ; au bout de chaque main, sept primaires écartées en
// doigts, sombres, de longueurs graduées ; la queue courte et arrondie ; la
// tête courte qui dépasse à peine, fauve. Le dessous de l'aigle ravisseur :
// le corps et les couvertures fauves, les rémiges grises barrées, une fenêtre
// claire à la base des primaires internes, les doigts noirs. Rien de commun
// avec l'aigle du Nigeria (de trois quarts, qui freine, tête sombre), ni avec
// le faucon d'Égypte (perché) : un oiseau en croix dans le ciel.
// Il est fait comme le bògòlan (../mali.tsx) : l'oiseau est une réserve
// claire dans la boue. Le fauve est le jaune de n'gallama qu'on n'a pas
// blanchi (le corps, la tête, les couvertures), le dessin y est peint à la
// boue en rangs de chevrons et de points ; les rémiges sont le coton nu barré
// de boue, plus serré là où l'oiseau est gris, plus lâche dans la fenêtre ;
// les doigts sont pleins de boue, cernés de coton ; tout est tracé au bout de
// bois, d'une main qui tremble un peu (la graine fait trembler le trait,
// jamais la silhouette).
//   · au dos : le héros, en bas du champ de boue, les ailes d'un bord à
//     l'autre, incliné vers la lune, montée en haut à droite dans son
//     médaillon (LUNE_ML) ; le skin y pose le médaillon et laisse le champ uni
//     autour de l'oiseau (sousAigleML) ;
//   · à la face : l'oiseau entier, en gaufrage dans le coin bas gauche du
//     portrait, à droite de l'équerre.

import type { PropsTotem, TotemNation } from "../types";
import { alea, f } from "../outils";

/** La lune, montée en haut à droite (le skin, ../mali.tsx, y pose le médaillon). */
export const LUNE_ML = { cx: 742, cy: 332, d: 190 } as const;

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
 * Le bout de bois qui peint la boue : le tracé tremble le long de sa normale,
 * le trait s'épaissit et s'amincit (la charge), et, ouvert, s'effile aux deux
 * bouts. Rend le ruban (à remplir) et la forme tremblée (fermé).
 */
function bois(pts: readonly P[], rnd: Rnd, o: { ferme?: boolean; amp?: number; w: [number, number]; pas?: number }): { ruban: string; forme: string } {
  const ferme = o.ferme ?? true;
  const pas = o.pas ?? 4;
  const ech = echantillons(pts, pas, ferme);
  const L = ech[ech.length - 1][4] + (ferme ? pas : 0);
  const amp = o.amp ?? 1.4;
  const tremble = onde(L, rnd, ferme, [[110, amp * 0.6], [36, amp * 0.4]]);
  const charge = onde(L, rnd, ferme, [[140, 1], [50, 0.4]]);
  const [w0, w1] = o.w;
  const g: string[] = [];
  const d: string[] = [];
  const c: string[] = [];
  for (const [x, y, nx, ny, s] of ech) {
    const dep = tremble(s);
    let w = (w0 + (w1 - w0) * Math.max(0, Math.min(1, 0.5 + charge(s) * 0.36))) / 2;
    if (!ferme) w *= Math.min(1, Math.pow(Math.min(s, L - s) / 8, 0.7)) * 0.8 + 0.2;
    g.push(`${f(x + nx * (dep + w))} ${f(y + ny * (dep + w))}`);
    d.push(`${f(x + nx * (dep - w))} ${f(y + ny * (dep - w))}`);
    c.push(`${f(x + nx * dep)} ${f(y + ny * dep)}`);
  }
  return {
    ruban: ferme ? `M${g.join("L")}ZM${d.reverse().join("L")}Z` : `M${g.join("L")}L${d.reverse().join("L")}Z`,
    forme: `M${c.join("L")}${ferme ? "Z" : ""}`,
  };
}

/** Un point de boue, un peu inégal. */
function point(x: number, y: number, r: number, rnd: Rnd): string {
  const rx = r * (0.84 + rnd() * 0.32);
  const ry = r * (0.84 + rnd() * 0.32);
  return `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`;
}

/** Un trait court au bout de bois. */
function trait(x1: number, y1: number, x2: number, y2: number, rnd: Rnd, amp: number): string {
  const j = () => (rnd() - 0.5) * amp;
  return `M${f(x1 + j())} ${f(y1 + j())}Q${f((x1 + x2) / 2 + j() * 1.6)} ${f((y1 + y2) / 2 + j() * 1.6)} ${f(x2 + j())} ${f(y2 + j())}`;
}

/* ------------------------------ Les pennes ------------------------------ */

/** Une penne : sa base, son angle (degrés), sa longueur, sa largeur ; cintre : sa courbe ; fin : la largeur du bout ; doigt : l'échancrure. */
interface Penne {
  b: Pt;
  a: number;
  l: number;
  w: number;
  cintre: number;
  fin: number;
  doigt?: boolean;
}

function sur(p: Penne, t: number, s = 0): Pt {
  const r = (p.a * Math.PI) / 180;
  const [ux, uy] = [Math.cos(r), Math.sin(r)];
  const [nx, ny] = [-uy, ux];
  const o = s + p.l * p.cintre * t * t;
  return [p.b[0] + ux * p.l * t + nx * o, p.b[1] + uy * p.l * t + ny * o];
}

function profil(p: Penne, t: number): number {
  const h = p.w / 2;
  if (p.doigt) {
    if (t < 0.4) return h;
    if (t < 0.52) return h * (1 - 0.36 * ((t - 0.4) / 0.12));
    return h * (0.64 - (0.64 - p.fin) * Math.pow((t - 0.52) / 0.48, 1.4));
  }
  return h * (t < 0.5 ? 1 : 1 - (1 - p.fin) * Math.pow((t - 0.5) / 0.5, 1.6));
}

function pointsPenne(p: Penne): P[] {
  const ts = [0, 0.2, 0.4, 0.5, 0.6, 0.72, 0.84, 0.93];
  const g = ts.map((t) => sur(p, t, -profil(p, t)));
  const d = ts.map((t) => sur(p, t, profil(p, t))).reverse();
  return [...g, sur(p, 0.985, -profil(p, 0.97) * 0.55), sur(p, 1), sur(p, 0.985, profil(p, 0.97) * 0.55), ...d];
}

/*
 * L'aile droite, à plat, vue de dessous : l'épaule à l'origine, l'envergure le
 * long de x, le bord de fuite vers y (vers la queue). L'aile gauche est son
 * miroir. Les mesures de l'aigle ravisseur : l'envergure 2,6 fois la longueur
 * du bec à la queue, l'aile large (la corde 0,37 de l'aile), sept doigts.
 */
const POIGNET: Pt = [184, -12];
const BOUT_MAIN: Pt = [272, 0];
/** Les primaires, de P10 à P1 : [angle, longueur, largeur]. */
const PRIM: [number, number, number][] = [
  [-12, 118, 24], [-4, 146, 25], [4, 160, 26], [12, 164, 27], [21, 158, 28], [31, 148, 29], [42, 136, 30],
  [54, 126, 30], [65, 120, 31], [76, 116, 32],
];
/** Les secondaires, du poignet au corps : un bord de fuite presque droit, pincé près du corps. */
const SEC = [138, 145, 150, 154, 157, 158, 158, 156, 152, 146, 137, 126];

function pennesAile(rnd: Rnd): { prim: Penne[]; sec: Penne[] } {
  const prim = PRIM.map(([a, l, w], i) => {
    const t = i / (PRIM.length - 1);
    const b: Pt = [BOUT_MAIN[0] + (POIGNET[0] - BOUT_MAIN[0]) * t, BOUT_MAIN[1] + (POIGNET[1] - BOUT_MAIN[1]) * t + 8];
    return { b, a: a + (rnd() - 0.5) * 2.4, l: l * (0.97 + rnd() * 0.06), w: w * (0.94 + rnd() * 0.12), cintre: i < 7 ? -0.03 : -0.01, fin: i < 7 ? 0.42 : 0.66, doigt: i < 7 };
  });
  const n = SEC.length;
  const sec = SEC.map((l, k) => {
    const t = (k + 0.5) / n;
    const b: Pt = [POIGNET[0] + (4 - POIGNET[0]) * t, POIGNET[1] + (2 - POIGNET[1]) * t + 6];
    return { b, a: 86 + (k / n) * 8 + (rnd() - 0.5) * 3, l: l * (0.96 + rnd() * 0.08), w: 28 * (0.92 + rnd() * 0.16), cintre: 0, fin: 0.86 };
  });
  return { prim, sec };
}

/** Les couvertures du dessous (fauves) : du bord d'attaque bombé au tiers de la corde, le bord festonné. */
const PTS_COUVERTURES: P[] = [
  [-6, 12], [28, -6], [70, -18], [114, -24], [156, -22], [POIGNET[0], POIGNET[1] - 2, 2], [222, -8], [252, -4], [278, 2, 2],
  [266, 18], [252, 28, 1], [242, 38], [226, 42, 1], [214, 52], [196, 54, 1], [184, 62], [166, 62, 1], [152, 68], [134, 66, 1],
  [120, 70], [102, 68, 1], [88, 72], [70, 70, 1], [56, 74], [38, 70, 1], [24, 72], [-4, 64],
];

/* ------------------------------ Le corps ------------------------------ */

// Le repère : les points sont posés le bec en haut (y 230), la queue en bas (y 590), le corps centré sur x 500 ;
// DECALE les ramène dans la boîte 1000 × 400.
const DECALE = "translate(0 -222)";
const EPAULE = 44;
const EPAULE_Y = 332;

/** Le corps vu de dessous : la gorge, le poitrail, le ventre, les culottes, les sous-caudales. */
const PTS_CORPS: P[] = [
  [500, 256], [518, 259], [532, 270], [538, 288], [538, 306], [546, 330], [554, 362], [554, 400], [546, 436], [532, 462],
  [516, 478], [500, 484], [484, 478], [468, 462], [454, 436], [446, 400], [446, 362], [454, 330], [462, 306], [462, 288],
  [468, 270], [482, 259],
];
/** Le bec vu de dessous : la mandibule, le crochet au bout ; la cire et la commissure jaunes. */
const PTS_BEC: P[] = [[487, 262], [486, 250], [490, 240], [496, 233], [500, 230, 1], [504, 233], [510, 240], [514, 250], [513, 262]];
const PTS_CIRE: P[] = [[484, 262], [490, 254], [500, 252], [510, 254], [516, 262], [510, 268], [500, 270], [490, 268]];
/** La queue courte, arrondie : douze rectrices en éventail. */
const QUEUE: Penne[] = Array.from({ length: 12 }, (_, i) => {
  const k = i - 5.5;
  return { b: [500 + k * 3.2, 456] as Pt, a: 90 - k * 7, l: 130 - k * k * 0.5, w: 28, cintre: 0, fin: 0.92 };
});
/** Les pattes repliées sous les sous-caudales : les doigts jaunes serrés, les serres. */
const PATTES = "M482 462C476 468 476 478 484 480C490 476 492 468 490 462ZM518 462C524 468 524 478 516 480C510 476 508 468 510 462Z";

/* ------------------------------ La peinture ------------------------------ */

const deja = new Map<number, ReturnType<typeof peindre>>();

/** Une aile peinte, à plat (repère de l'aile) : chaque penne, ses barres ; les couvertures et leurs chevrons. */
function peindreAile(rnd: Rnd) {
  const { prim, sec } = pennesAile(rnd);
  const ordre = [...[...sec].reverse(), ...[...prim].reverse()];
  const pennes = ordre.map((p) => {
    const k = prim.indexOf(p);
    // les doigts (P10 → P5) : pleins de boue ; la fenêtre (P4 → P1) : le coton à peine barré ; les secondaires : barrées serré.
    const doigt = k >= 0 && k < 6;
    const fenetre = k >= 6;
    const t = bois(pointsPenne(p), rnd, { w: [2.2, 3.4], amp: 0.9, pas: 6 });
    let barres = "";
    const ts = doigt ? [] : fenetre ? [0.62, 0.8] : [0.36, 0.48, 0.6, 0.72, 0.84];
    for (const t0 of ts) {
      const tt = t0 + (rnd() - 0.5) * 0.03;
      const w = profil(p, tt) * 0.86;
      const [g, d] = [sur(p, tt - 0.01, -w), sur(p, tt + 0.01, w)];
      barres += trait(g[0], g[1], d[0], d[1], rnd, 1.2);
    }
    // Le bout plongé dans la boue : les secondaires et la fenêtre ont un bord sombre.
    const bout = 0.89;
    const bord = doigt ? "" : lisse([sur(p, bout, -profil(p, bout)), sur(p, 0.95, -profil(p, 0.95)), sur(p, 1), sur(p, 0.95, profil(p, 0.95)), sur(p, bout, profil(p, bout))]);
    return { forme: t.forme, contour: t.ruban, barres, bord, doigt };
  });
  const couv = bois(PTS_COUVERTURES, rnd, { w: [2.4, 3.6], amp: 1 });
  // Les couvertures : des rangs de chevrons, la pointe vers le corps, un point sous chacun.
  let chevrons = "";
  let points = "";
  for (let rg = 0; rg < 4; rg++)
    for (let x = 12 + (rg % 2) * 13; x < 268; x += 26) {
      const y = 4 + rg * 16 - (x > 180 ? (x - 180) * (0.12 + rg * 0.06) : 0);
      if (y < -14) continue;
      chevrons += trait(x + 8, y - 4, x - 1, y + 4, rnd, 1) + trait(x - 1, y + 4, x + 8, y + 11, rnd, 1);
      points += point(x + 10, y + 4, 1.9, rnd);
    }
  return { pennes, couv, chevrons, points };
}

function peindre(graine: number) {
  const rnd = alea(graine ^ 0x6d61);
  const ailes = [peindreAile(rnd), peindreAile(rnd)];
  const corps = bois(PTS_CORPS, rnd, { w: [2.6, 3.8], amp: 1 });
  // Le corps : des rangs de chevrons qui descendent (les plumes), un point dans chaque ; la tête, des points fins.
  let chevrons = "";
  let points = "";
  for (let y = 318, i = 0; y < 476; y += 15, i++)
    for (let x = 462 + (i % 2) * 8; x < 540; x += 16) {
      chevrons += trait(x - 6, y - 4, x, y + 3, rnd, 1) + trait(x, y + 3, x + 6, y - 4, rnd, 1);
      points += point(x, y - 3, 1.6, rnd);
    }
  let tete = "";
  for (let y = 272, i = 0; y < 316; y += 9, i++) for (let x = 470 + (i % 2) * 5; x < 532; x += 10) tete += point(x, y, 1.5, rnd);
  const queue = [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11].map((i) => {
    const p = QUEUE[i];
    const t = bois(pointsPenne(p), rnd, { w: [2, 3], amp: 0.8, pas: 6 });
    let barres = "";
    for (const tt of [0.42, 0.56, 0.7, 0.84]) {
      const [g, d] = [sur(p, tt + (rnd() - 0.5) * 0.03, -p.w * 0.42), sur(p, tt + (rnd() - 0.5) * 0.03, p.w * 0.42)];
      barres += trait(g[0], g[1], d[0], d[1], rnd, 1);
    }
    return { forme: t.forme, contour: t.ruban, barres };
  });
  // L'usure : le coton qui remonte un peu sur la boue des doigts et des barres (la graine).
  let usure = "";
  for (let k = 0; k < 14; k++) usure += point(60 + rnd() * 880, 250 + rnd() * 320, 6 + rnd() * 10, rnd);
  return { ailes, corps, chevrons, points, tete, queue, usure };
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

const COTON = "#eadfc6";
const BOUE = "#231a13";
const NGALLAMA = "#b88d4c";
/** L'aile droite part de l'épaule droite ; la gauche est son miroir. */
const AILE_D = `translate(${500 + EPAULE} ${EPAULE_Y})`;
const AILE_G = `translate(${500 - EPAULE} ${EPAULE_Y}) scale(-1 1)`;

/** Le dos : l'oiseau réservé dans la boue. */
function Bogolan({ graine, id }: PropsTotem) {
  const p = peinture(graine);
  const aile = (k: 0 | 1) => {
    const a = p.ailes[k];
    return (
      <g key={k} transform={k ? AILE_D : AILE_G}>
        {a.pennes.map((q, i) => (
          <g key={i}>
            <path d={q.forme} fill={q.doigt ? BOUE : COTON} />
            <path d={q.bord} fill={BOUE} opacity={0.85} />
            <path d={q.barres} fill="none" stroke={BOUE} strokeWidth={2.4} strokeLinecap="round" />
            <path d={q.contour} fill={q.doigt ? COTON : BOUE} />
          </g>
        ))}
        <path d={a.couv.forme} fill={NGALLAMA} />
        <g clipPath={`url(#mlc${k}${id})`}>
          <path d={a.chevrons} fill="none" stroke={BOUE} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          <path d={a.points} fill={BOUE} />
        </g>
        <path d={a.couv.ruban} fill={BOUE} />
      </g>
    );
  };
  return (
    <g transform={DECALE}>
      <defs>
        {p.ailes.map((a, k) => (
          <clipPath key={k} id={`mlc${k}${id}`}>
            <path d={a.couv.forme} />
          </clipPath>
        ))}
        <clipPath id={`mlb${id}`}>
          <path d={p.corps.forme} />
        </clipPath>
      </defs>
      {/* La réserve : un liseré de coton nu autour de l'oiseau, qui le détache de la boue. */}
      <g fill={COTON} stroke={COTON} strokeWidth={7} strokeLinejoin="round">
        <path d={p.queue.map((q) => q.forme).join("") + p.corps.forme} />
        {p.ailes.map((a, k) => (
          <path key={k} transform={k ? AILE_D : AILE_G} d={a.pennes.map((q) => q.forme).join("") + a.couv.forme} />
        ))}
      </g>
      {/* La queue, ses barres. */}
      {p.queue.map((q, i) => (
        <g key={i}>
          <path d={q.forme} fill={COTON} />
          <path d={q.barres} fill="none" stroke={BOUE} strokeWidth={2.2} strokeLinecap="round" />
          <path d={q.contour} fill={BOUE} />
        </g>
      ))}
      {aile(0)}
      {aile(1)}
      {/* Le corps fauve, ses chevrons ; la tête ; le bec. */}
      <path d={p.corps.forme} fill={NGALLAMA} />
      <g clipPath={`url(#mlb${id})`}>
        <path d={p.chevrons} fill="none" stroke={BOUE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={p.points + p.tete} fill={BOUE} />
      </g>
      <path d={p.corps.ruban} fill={BOUE} />
      <path d={PATTES} fill={NGALLAMA} stroke={BOUE} strokeWidth={2} />
      <path d={lisse(PTS_BEC)} fill={BOUE} stroke={COTON} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={lisse(PTS_CIRE)} fill={NGALLAMA} stroke={BOUE} strokeWidth={1.8} />
    </g>
  );
}

/** Le pourtour d'une aile, d'un seul trait : le bord d'attaque, le bout de chaque doigt et l'échancrure entre deux, le bout de chaque secondaire. */
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

/** La silhouette (pour le gaufrage de la face et pour le skin, qui laisse le champ uni autour) : un pourtour par aile, la queue, le corps. */
function silhouette(): { d: string; pts: Pt[] } {
  const rnd = alea(7);
  let d = "";
  const pts: Pt[] = [];
  // Les points du pourtour, tous les 8 (pour le skin, qui laisse le champ uni autour).
  const garde = (c: P[]) => pts.push(...echantillons(c, 8).map(([x, y]) => [x, y] as Pt));
  for (const sens of [1, -1]) {
    const c = contourAile(rnd).map(([x, y]) => [500 + sens * (EPAULE + x), EPAULE_Y + y] as Pt);
    d += lisse(c);
    garde(c);
  }
  const queue: Pt[] = [...QUEUE.map((q) => sur(q, 1)), [QUEUE[11].b[0], QUEUE[11].b[1]], [QUEUE[0].b[0], QUEUE[0].b[1]]];
  d += lisse(queue) + lisse(PTS_CORPS) + lisse(PTS_BEC);
  garde(queue);
  garde(PTS_CORPS);
  garde(PTS_BEC);
  return { d, pts };
}
const SILHOUETTE = silhouette();

/** La face : l'oiseau entier en gaufrage (lumière en haut à gauche, ombre en bas à droite), le corps et les couvertures en creux. */
function Gaufre({ photo, tons, id }: PropsTotem) {
  const ombre = photo ? "rgba(10,7,5,0.6)" : "rgba(0,0,0,0.5)";
  const lumiere = photo ? "rgba(246,238,222,0.6)" : `rgba(${tons.encre},0.38)`;
  const creux = lisse(PTS_CORPS) + lisse(PTS_COUVERTURES.map(([x, y]) => [500 + EPAULE + x, EPAULE_Y + y] as const)) + lisse(PTS_COUVERTURES.map(([x, y]) => [500 - EPAULE - x, EPAULE_Y + y] as const));
  return (
    <g transform={DECALE} fill="none" strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <mask id={`mg${id}`} maskUnits="userSpaceOnUse" x={0} y={180} width={1000} height={480}>
          <rect x={0} y={180} width={1000} height={480} fill="#fff" />
          <path d={SILHOUETTE.d} fill="#000" />
        </mask>
      </defs>
      <path d={SILHOUETTE.d} fill={photo ? "rgba(246,238,222,0.1)" : `rgba(${tons.encre},0.04)`} />
      <g mask={`url(#mg${id})`}>
        <path d={SILHOUETTE.d} stroke={ombre} strokeWidth={10} transform="translate(3 4)" />
        <path d={SILHOUETTE.d} stroke={lumiere} strokeWidth={10} transform="translate(-3 -4)" />
      </g>
      <path d={creux} stroke={ombre} strokeWidth={3.5} transform="translate(-1.5 -2)" />
      <path d={creux} stroke={lumiere} strokeWidth={3.5} transform="translate(1.5 2)" />
    </g>
  );
}

const BOITE = { w: 1000, h: 400 } as const;
/** La pose du dos : en bas du champ, incliné vers la lune (le skin s'en sert pour laisser le champ uni autour). */
const POSE_DOS = { x: 512 - (BOITE.w * 0.97) / 2, y: 820 - (BOITE.h * 0.97) / 2, echelle: 0.97, rotation: 12 } as const;

/** La silhouette posée au dos, dans le repère de la carte. */
const ENVELOPPE: Pt[] = (() => {
  // La silhouette posée au dos : la boîte, l'échelle, la rotation autour du centre de la boîte.
  const r = (POSE_DOS.rotation * Math.PI) / 180;
  const [cx, cy] = [BOITE.w / 2, BOITE.h / 2];
  const carte = ([x, y]: Pt): Pt => {
    const [bx, by] = [x - cx, y - 222 - cy];
    const [rx, ry] = [bx * Math.cos(r) - by * Math.sin(r), bx * Math.sin(r) + by * Math.cos(r)];
    return [POSE_DOS.x + (cx + rx) * POSE_DOS.echelle, POSE_DOS.y + (cy + ry) * POSE_DOS.echelle];
  };
  return SILHOUETTE.pts.map(carte);
})();
/** Les cases de 8 du repère de la carte que l'oiseau touche, à 18 près (calculées une fois). */
const SOUS_AIGLE: Set<number> = (() => {
  const s = new Set<number>();
  const m = 18;
  for (const [px, py] of ENVELOPPE)
    for (let x = Math.floor((px - m) / 8); x <= Math.floor((px + m) / 8); x++)
      for (let y = Math.floor((py - m) / 8); y <= Math.floor((py + m) / 8); y++) s.add(y * 256 + x);
  return s;
})();
/** Le point (repère de la carte) est-il sous l'oiseau, ou à moins de 18 de son bord ? Le skin y laisse le champ uni. */
export function sousAigleML(x: number, y: number): boolean {
  return SOUS_AIGLE.has(Math.floor(y / 8) * 256 + Math.floor(x / 8));
}

const totem: TotemNation = {
  nation: "ml",
  animal: "aigle",
  quoi: "L'aigle ravisseur en vol plané, vu de dessous, incliné vers la lune : réservé dans la boue comme un bògòlan, le corps et les couvertures fauves en chevrons, les rémiges barrées, sept doigts sombres au bout de chaque aile.",
  sources: [
    { titre: "Oiseaux-birds, fiche de l'aigle ravisseur : plumage, vol, queue arrondie", url: "https://www.oiseaux-birds.com/card-tawny-eagle.html" },
    { titre: "BirdForum Opus, Aquila rapax : rémiges sombres, dos fauve, commissure jusqu'au milieu de l'œil", url: "https://www.birdforum.net/opus/Aquila_rapax" },
    { titre: "Bird Count India, identifier les aigles Aquila sombres en vol : doigts, fenêtre des primaires, bord de fuite", url: "https://birdcount.in/identifying-dark-aquila-and-clanga-eagles/" },
    { titre: "ELA Foundation, fiche de l'aigle ravisseur : la queue courte et arrondie tenue droite en vol", url: "https://www.elafoundation.org/ela/wp-content/uploads/2017/03/Fact-file-8_-TWANY-EAGLE.pdf" },
    { titre: "Smarthistory : le bògòlanfini, la boue fermentée, le motif réservé", url: "https://smarthistory.org/?p=72599" },
  ],
  dessine: true,
  boite: BOITE,
  pose: {
    // Au dos : en bas du champ, les ailes d'un bord à l'autre, incliné vers la lune (LUNE_ML).
    dos: { ...POSE_DOS, devant: true, lune: LUNE_ML },
    // À la face : l'oiseau entier, dans le coin bas gauche du portrait, à droite de l'équerre (x 71 → 114).
    face: { portrait: { x: 122, y: 968 - BOITE.h * 0.25, echelle: 0.25 } },
  },
  Dessin: (p) => {
    if (p.couche === "dos") return <Bogolan {...p} />;
    if (p.couche === "face-portrait") return <Gaufre {...p} />;
    return null;
  },
};

export default totem;
