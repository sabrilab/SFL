// Le sigle SFL (Sunday Five League), construit au compas et à la règle.
//
// Pourquoi : jusqu'au 23/10/2026, l'app montrait un tracé automatique du logo
// SFL (vectorisé depuis une image de 339 × 99 px du PDF « SFL X KIPSTADIUM »),
// avec la ligne « — SUNDAY FIVE LEAGUE — » en dessous, illisible sous 30 px.
// Ailleurs vivaient d'autres SFL : en Saira, en Inter, en police système…
// Sabri a voulu un seul sigle, utilisé partout.
//
// Ce que ce script dessine : les trois lettres du logo d'origine (le S en
// barres horizontales et panses rondes, le F au coin arrondi, le L au long
// pied, les bouts de barres coupés en biseau), redessinées proprement à la
// graisse et à l'angle du logo BOLA :
//   · italique de 21,8° (l'angle du B de la charte, tan = 0,4) ;
//   · fûts de 45 % de la hauteur de capitale, barres de 24,5 % (BOLA : 44 % et
//     21 à 25 %) ;
//   · métriques verticales de public/bola/logo-*.svg : un viewBox de 237 de
//     haut, capitales de 22,36 à 213,47. À hauteur égale (SigleLigue), SFL,
//     BOLA et BOLA TEAM ont donc des lettres de la même taille.
//
// Chaque lettre est un contour à coins arrondis, tracé droit puis cisaillé :
// x' = x + (100 − y) × 0,4 ; les arcs deviennent des courbes de Bézier, que le
// cisaillement garde exactes.
//
//   npx tsx tools/sigle-sfl.ts                    écrit public/bola/sfl.svg
//   npx tsx tools/sigle-sfl.ts <fichier>          l'écrit ailleurs
//   npx tsx tools/sigle-sfl.ts --serre <fichier>  cadré au plus près des lettres,
//     sans les marges du logo BOLA : le badge du maillot (bola-site,
//     public/sponsoring/sfl.svg), qui pose le sigle dans sa propre pastille.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Réglages du dessin, dans un repère de 100 de hauteur de capitale. */
const P = {
  k: 0.4, // italique : tan(21,8°)
  T: 24.5, // épaisseur des barres
  V: 45, // épaisseur des fûts (largeur horizontale)
  coupe: 0.7, // biseau des bouts de barres : recul horizontal par unité d'épaisseur
  ro: 2, // coins extérieurs
  ri: 3, // coins intérieurs
  rw: 2.5, // pointes des biseaux
  RF: 24, // le coin haut gauche du F
  WS: 128, // largeurs : S, F (barre du haut), F (barre du milieu), L
  WF: 114,
  WFm: 90,
  WL: 106,
  gSF: 8, // approches : S–F, F–L
  gFL: 6,
};

// Métriques verticales du logo BOLA (viewBox 1000 × 237).
const HAUT = 237;
const BASE = 213.47;
const CAP = 191.108;
const MARGE = 18;

type Sommet = [x: number, y: number, r: number];
type Pt = [number, number];
type Segment = { L: Pt } | { C: [Pt, Pt, Pt] };

function glyphes(): Sommet[][] {
  const { T, V, ro, ri, rw, WS, WF, WFm, WL } = P;
  const C = (100 - 3 * T) / 2; // les deux contreformes du S
  const m0 = T + C; // la barre du milieu, de m0 à m1 (S et F)
  const m1 = m0 + T;
  const d = P.coupe * T;
  const RS = m1 / 2; // panses du S en demi-cercles
  const rc = C / 2;
  const S: Sommet[] = [
    [WS, 0, rw], [0, 0, RS], [0, m1, RS], [WS - V, m1, rc], [WS - V, 100 - T, rc],
    [d, 100 - T, rw], [0, 100, rw], [WS, 100, RS], [WS, m0, RS], [V, m0, rc], [V, T, rc],
    [WS - d, T, rw],
  ];
  const xF = WS + P.gSF;
  const F: Sommet[] = [
    [0, 0, P.RF], [WF, 0, rw], [WF - d, T, rw], [V, T, ri], [V, m0, ri], [WFm, m0, rw],
    [WFm - d, m1, rw], [V, m1, ri], [V, 100, ro], [0, 100, ro],
  ];
  const xL = xF + WF + P.gFL;
  const L: Sommet[] = [[0, 0, ro], [V, 0, ro], [V, 100 - T, ri], [WL, 100 - T, rw], [WL - d, 100, rw], [0, 100, ro]];
  const decale = (g: Sommet[], dx: number) => g.map(([x, y, r]) => [x + dx, y, r] as Sommet);
  return [S, decale(F, xF), decale(L, xL)];
}

/** Arc de cercle de a0 à a1 (radians) en cubiques d'au plus un quart de tour. */
function arc(cx: number, cy: number, r: number, a0: number, a1: number): [Pt, Pt, Pt][] {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9));
  const da = (a1 - a0) / n;
  const out: [Pt, Pt, Pt][] = [];
  for (let i = 0; i < n; i++) {
    const s = a0 + i * da;
    const e = s + da;
    const h = (4 / 3) * Math.tan((e - s) / 4);
    const p0: Pt = [cx + r * Math.cos(s), cy + r * Math.sin(s)];
    const p3: Pt = [cx + r * Math.cos(e), cy + r * Math.sin(e)];
    out.push([
      [p0[0] - h * r * Math.sin(s), p0[1] + h * r * Math.cos(s)],
      [p3[0] + h * r * Math.sin(e), p3[1] - h * r * Math.cos(e)],
      p3,
    ]);
  }
  return out;
}

/** Un contour fermé dont chaque coin est arrondi par un arc tangent aux deux côtés. */
function contour(pts: Sommet[]): { depart: Pt; segs: Segment[] } {
  const n = pts.length;
  const coins = pts.map(([x, y, r0], i) => {
    const [px, py] = pts[(i + n - 1) % n];
    const [nx, ny] = pts[(i + 1) % n];
    if (r0 <= 0) return { a: [x, y] as Pt, b: [x, y] as Pt, arc: null };
    const lp = Math.hypot(px - x, py - y);
    const ln = Math.hypot(nx - x, ny - y);
    const u: Pt = [(px - x) / lp, (py - y) / lp];
    const v: Pt = [(nx - x) / ln, (ny - y) / ln];
    const ang = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    let r = r0;
    let t = r / Math.tan(ang / 2);
    if (t > Math.min(lp, ln) / 2 + 1e-6) {
      t = Math.min(lp, ln) / 2;
      r = t * Math.tan(ang / 2);
    }
    const a: Pt = [x + u[0] * t, y + u[1] * t];
    const b: Pt = [x + v[0] * t, y + v[1] * t];
    const lb = Math.hypot(u[0] + v[0], u[1] + v[1]);
    const dc = r / Math.sin(ang / 2);
    const c: Pt = [x + ((u[0] + v[0]) / lb) * dc, y + ((u[1] + v[1]) / lb) * dc];
    const a0 = Math.atan2(a[1] - c[1], a[0] - c[0]);
    let da = Math.atan2(b[1] - c[1], b[0] - c[0]) - a0;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    return { a, b, arc: { c, r, a0, a1: a0 + da } };
  });
  const segs: Segment[] = [];
  for (let i = 1; i <= n; i++) {
    const k = coins[i % n];
    segs.push({ L: k.a });
    if (k.arc) for (const cb of arc(k.arc.c[0], k.arc.c[1], k.arc.r, k.arc.a0, k.arc.a1)) segs.push({ C: cb });
  }
  return { depart: coins[0].b, segs };
}

const cisaille = ([x, y]: Pt): Pt => [x + (100 - y) * P.k, y];

export function sigleSfl(couleur = "#08090B", serre = false): string {
  const contours = glyphes().map(contour);
  const tous = contours.flatMap((c) => [c.depart, ...c.segs.flatMap((s) => ("L" in s ? [s.L] : s.C))]).map(cisaille);
  const x0 = Math.min(...tous.map((p) => p[0]));
  const x1 = Math.max(...tous.map((p) => p[0]));
  const sc = CAP / 100;
  const dx = MARGE - x0 * sc;
  const dy = BASE - 100 * sc;
  const largeur = Math.round((x1 - x0) * sc + 2 * MARGE);
  const f = (p: Pt) => {
    const [x, y] = cisaille(p);
    return `${+(x * sc + dx).toFixed(2)},${+(y * sc + dy).toFixed(2)}`;
  };
  const d = contours
    .map(({ depart, segs }) => {
      let s = `M${f(depart)}`;
      let dernier = depart;
      for (const sg of segs) {
        if ("L" in sg) {
          if (Math.hypot(sg.L[0] - dernier[0], sg.L[1] - dernier[1]) < 1e-6) continue;
          s += `L${f(sg.L)}`;
          dernier = sg.L;
        } else {
          s += `C${f(sg.C[0])} ${f(sg.C[1])} ${f(sg.C[2])}`;
          dernier = sg.C[2];
        }
      }
      return `${s}Z`;
    })
    .join("");
  const cadre = serre
    ? `${MARGE} ${+(BASE - CAP).toFixed(2)} ${+((x1 - x0) * sc).toFixed(2)} ${+CAP.toFixed(2)}`
    : `0 0 ${largeur} ${HAUT}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cadre}" role="img" aria-label="SFL">`,
    `<!-- Le sigle SFL (Sunday Five League), redessiné le 23/10/2026 d'après le logo d'origine, à la graisse et à l'angle de BOLA. Généré par tools/sigle-sfl.ts : ne pas éditer à la main. -->`,
    `<path fill="${couleur}" d="${d}"/>`,
    `</svg>`,
    ``,
  ].join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const serre = args.includes("--serre");
  const sortie = args.find((a) => a !== "--serre") ?? join(import.meta.dirname, "..", "public", "bola", "sfl.svg");
  writeFileSync(sortie, sigleSfl("#08090B", serre));
  console.log(`sigle SFL${serre ? " (serré)" : ""} écrit dans ${sortie}`);
}
