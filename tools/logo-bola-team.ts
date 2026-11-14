// Le logo Bola Team, construit au compas et à la règle (pistes du 14/11/2026).
//
// Pourquoi : depuis le 22/10, « Bola Team » s'écrivait avec le logo BOLA
// suivi de TEAM en Inter Black italique (SigleLigue). Le 14/11, Sabri a
// demandé un vrai logo Bola Team, pour l'app et pour la vidéo de lancement.
//
// Les lettres TEAM sont dessinées comme le sigle SFL (tools/sigle-sfl.ts) :
// repère de 100 de hauteur de capitale, fûts de 45, barres de 24,5, bouts de
// barres coupés en biseau, coins arrondis, puis l'italique de BOLA (21,8°,
// tan = 0,4). Le E garde le coin arrondi du F de SFL ; le A reprend celui de
// BOLA : plat en haut, l'œil en triangle, la barre basse. À hauteur égale,
// BOLA, SFL et TEAM ont des lettres de la même taille.
//
// Trois pistes, à faire choisir par Sabri :
//   · mot     : BOLA TEAM sur une ligne (le logo BOLA, symbole compris) ;
//   · bloc    : le ballon BOLA sur deux lignes, BOLA sur TEAM à la même chasse ;
//   · insigne : l'écu des équipes (equipe/ecusson.tsx), une pièce noire où
//               le ballon et TEAM sont taillés à jour ; en grand, une couronne
//               de guilloché gravée autour du ballon (insigne-grave).
// Les fichiers d'app sont d'une seule couleur, sans blanc peint : on les
// emploie en masque (SigleLigue), les jours laissent voir le fond.
//
//   node --experimental-strip-types tools/logo-bola-team.ts [dossier]
//     écrit team-mot.svg, team-bloc.svg, team-insigne.svg (public/bola) et
//     team-insigne-grave.svg (blanc sur noir, pour la vidéo).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// repère de 100 de hauteur de capitale, coins arrondis, puis cisaillement
// d'italique 0,4 (21,8°, l'angle du B de BOLA).
type Pt = [number, number];
type Sommet = [number, number, number];
type Segment = { L: Pt } | { C: [Pt, Pt, Pt] };

const P = { k: 0.4, T: 24.5, V: 45, coupe: 0.7, ro: 2, ri: 3, rw: 2.5, RF: 24 };

function arc(cx: number, cy: number, r: number, a0: number, a1: number): [Pt, Pt, Pt][] {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9));
  const da = (a1 - a0) / n;
  const out: [Pt, Pt, Pt][] = [];
  for (let i = 0; i < n; i++) {
    const s = a0 + i * da, e = s + da, h = (4 / 3) * Math.tan((e - s) / 4);
    const p0: Pt = [cx + r * Math.cos(s), cy + r * Math.sin(s)];
    const p3: Pt = [cx + r * Math.cos(e), cy + r * Math.sin(e)];
    out.push([[p0[0] - h * r * Math.sin(s), p0[1] + h * r * Math.cos(s)], [p3[0] + h * r * Math.sin(e), p3[1] - h * r * Math.cos(e)], p3]);
  }
  return out;
}
function contour(pts: Sommet[]): { depart: Pt; segs: Segment[] } {
  const n = pts.length;
  const coins = pts.map(([x, y, r0], i) => {
    const [px, py] = pts[(i + n - 1) % n];
    const [nx, ny] = pts[(i + 1) % n];
    if (r0 <= 0) return { a: [x, y] as Pt, b: [x, y] as Pt, arc: null };
    const lp = Math.hypot(px - x, py - y), ln = Math.hypot(nx - x, ny - y);
    const u: Pt = [(px - x) / lp, (py - y) / lp], v: Pt = [(nx - x) / ln, (ny - y) / ln];
    const ang = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    let r = r0, t = r / Math.tan(ang / 2);
    if (t > Math.min(lp, ln) / 2 + 1e-6) { t = Math.min(lp, ln) / 2; r = t * Math.tan(ang / 2); }
    const a: Pt = [x + u[0] * t, y + u[1] * t], b: Pt = [x + v[0] * t, y + v[1] * t];
    const lb = Math.hypot(u[0] + v[0], u[1] + v[1]), dc = r / Math.sin(ang / 2);
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

/** Les contours de TEAM (A a deux contours : sa forme et son œil). Renvoie aussi la largeur. */
function team(espace = 1): { contours: Sommet[][]; largeur: number } {
  const { T, V, ro, ri, rw, RF } = P;
  const d = P.coupe * T;
  const m0 = T + (100 - 3 * T) / 2, m1 = m0 + T;
  const out: Sommet[][] = [];
  let x = 0;
  const pose = (g: Sommet[], w: number, gap: number) => { out.push(g.map(([a, b, r]) => [a + x, b, r] as Sommet)); x += w + gap * espace; };
  // T
  const WT = 124, c = WT / 2;
  pose([[d, 0, rw], [WT, 0, rw], [WT - d, T, rw], [c + V / 2, T, ri], [c + V / 2, 100, ro], [c - V / 2, 100, ro], [c - V / 2, T, ri], [0, T, rw]], 122, 0);
  // E (le coin arrondi du F de SFL)
  const WE = 112, WEm = 92, WEb = 116;
  pose([[0, 0, RF], [WE, 0, rw], [WE - d, T, rw], [V, T, ri], [V, m0, ri], [WEm, m0, rw], [WEm - d, m1, rw], [V, m1, ri], [V, 100 - T, ri], [WEb, 100 - T, rw], [WEb - d, 100, rw], [0, 100, ro]], 114, 0);
  // A : le A de BOLA, plat en haut, l'œil en triangle, la barre basse
  const A: Sommet[] = [[30, 0, ro], [100, 0, ro], [130, 100, ro], [86, 100, ro], [80.9, 83, ri], [49.1, 83, ri], [44, 100, ro], [0, 100, ro]];
  const oeil: Sommet[] = [[65, 30, 1.5], [73.55, 58.5, 1.5], [56.45, 58.5, 1.5]];
  out.push(A.map(([a, b, r]) => [a + x, b, r] as Sommet));
  out.push(oeil.map(([a, b, r]) => [a + x, b, r] as Sommet));
  x += 130 + 7 * espace;
  // M
  const M: Sommet[] = [[0, 0, ro], [52, 0, ro], [76, 42, ri], [100, 0, ro], [152, 0, ro], [152, 100, ro], [110, 100, ro], [110, 52, ri], [86, 92, ro], [66, 92, ro], [42, 52, ri], [42, 100, ro], [0, 100, ro]];
  out.push(M.map(([a, b, r]) => [a + x, b, r] as Sommet));
  x += 152;
  return { contours: out, largeur: x };
}

/** Chemin SVG : lettres de hauteur `cap`, ligne de base en `base`, bord gauche (au pied) en `x0`. */
function chemin(contours: Sommet[][], cap: number, base: number, x0: number): string {
  const sc = cap / 100;
  const f = ([x, y]: Pt) => { const xs = x + (100 - y) * P.k; return `${+(x0 + xs * sc).toFixed(2)},${+(base - (100 - y) * sc).toFixed(2)}`; };
  return contours.map(contour).map(({ depart, segs }) => {
    let s = `M${f(depart)}`;
    let der = depart;
    for (const sg of segs) {
      if ("L" in sg) { if (Math.hypot(sg.L[0] - der[0], sg.L[1] - der[1]) < 1e-6) continue; s += `L${f(sg.L)}`; der = sg.L; }
      else { s += `C${f(sg.C[0])} ${f(sg.C[1])} ${f(sg.C[2])}`; der = sg.C[2]; }
    }
    return s + "Z";
  }).join("");
}

const src = readFileSync(join(import.meta.dirname, "..", "public", "bola", "logo-noir.svg"), "utf8");
const SYM = src.match(/id="symbole" d="([^"]*)"/)![1]; // le ballon : cercle (73,186 ; 159,672), r 56,187
const LOGO = src.match(/id="logotype" d="([^"]*)"/)![1]; // BOLA, de x 150,41 à 933,70
const BASE = 213.47, CAP = 191.108; // métriques du logo BOLA (viewBox 1000 × 237)
const SC = { cx: 73.186, cy: 159.672, r: 56.187 };
const t = team();
/** Chasse de TEAM à la hauteur de capitale de BOLA, italique comprise. */
const chasseTeam = (cap: number) => (t.largeur + 100 * P.k) * cap / 100;

const svg = (vb: string, label: string, corps: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${label}">\n` +
  `<!-- Bola Team, piste du 14/11/2026. Généré par tools/logo-bola-team.ts : ne pas éditer à la main. -->\n${corps}\n</svg>\n`;

/** Le ballon BOLA posé à un centre et un rayon donnés, en chemin absolu (pour le combiner en evenodd). */
function symbole(cx: number, cy: number, r: number): string {
  const k = r / SC.r;
  // Le chemin du symbole est en coordonnées relatives après son M : on le
  // transforme en absolu en le faisant passer par une matrice simple.
  return transforme(SYM, (x, y) => [cx + (x - SC.cx) * k, cy + (y - SC.cy) * k], k);
}

/** Applique une similitude (translation + échelle k) à un chemin SVG M/c/s/l/h/v/Z. */
function transforme(d: string, f: (x: number, y: number) => [number, number], k: number): string {
  const jetons = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g)!;
  let i = 0, cmd = "", x = 0, y = 0, out = "";
  let cb: number[] | null = null; // dernier point de contrôle (pour s)
  const n = () => parseFloat(jetons[i++]);
  const pt = (px: number, py: number) => { const [a, b] = f(px, py); return `${+a.toFixed(2)},${+b.toFixed(2)}`; };
  while (i < jetons.length) {
    if (/[a-zA-Z]/.test(jetons[i])) cmd = jetons[i++];
    switch (cmd) {
      case "M": x = n(); y = n(); out += "M" + pt(x, y); cmd = "L"; break;
      case "L": x = n(); y = n(); out += "L" + pt(x, y); break;
      case "l": x += n(); y += n(); out += "L" + pt(x, y); break;
      case "h": x += n(); out += "L" + pt(x, y); break;
      case "v": y += n(); out += "L" + pt(x, y); break;
      case "c": { const a = [x + n(), y + n()], b = [x + n(), y + n()]; x += n(); y += n(); out += `C${pt(a[0], a[1])} ${pt(b[0], b[1])} ${pt(x, y)}`; cb = b; break; }
      case "C": { const a = [n(), n()], b = [n(), n()]; x = n(); y = n(); out += `C${pt(a[0], a[1])} ${pt(b[0], b[1])} ${pt(x, y)}`; cb = b; break; }
      case "s": {
        const a = cb ? [2 * x - cb[0], 2 * y - cb[1]] : [x, y];
        const b = [x + n(), y + n()]; x += n(); y += n();
        out += `C${pt(a[0], a[1])} ${pt(b[0], b[1])} ${pt(x, y)}`; cb = b; break;
      }
      case "Z": case "z": out += "Z"; cmd = ""; break;
      default: throw new Error("commande " + cmd);
    }
  }
  return out;
}

/** Piste « mot » : BOLA TEAM sur une ligne, dans le repère du logo BOLA. */
export function mot(c = "#08090B") {
  const x0 = 933.7 + 70;
  const w = Math.round(x0 + chasseTeam(CAP) + 18);
  return svg(`0 0 ${w} 237`, "Bola Team", `<path fill="${c}" fill-rule="evenodd" d="${SYM}${LOGO}${chemin(t.contours, CAP, BASE, x0)}"/>`);
}

/** Piste « bloc » : le ballon sur deux lignes, BOLA sur TEAM à la même chasse. */
export function bloc(c = "#08090B") {
  const chasseB = 933.7 - 150.41;
  const capT2 = (chasseB / (t.largeur + 100 * P.k)) * 100; // TEAM ramené à la chasse de BOLA
  const base2 = BASE + 44 + capT2;
  const haut = 22.36;
  const r = (base2 - haut) / 2;
  const cx = 150.41 - 40 - r;
  const x0 = cx - r - 18;
  const d = symbole(cx, haut + r, r) + LOGO + chemin(t.contours, capT2, base2, 150.41);
  return svg(`${x0.toFixed(1)} 4 ${(933.7 + 18 - x0).toFixed(1)} ${(base2 + 18 - 4).toFixed(1)}`, "Bola Team", `<path fill="${c}" fill-rule="evenodd" d="${d}"/>`);
}

// L'insigne : l'écu des équipes (ecusson.tsx), dans sa boîte 100 × 106.
const ECU = "M50 3L93 14V52C93 79 74 95 50 103C26 95 7 79 7 52V14Z";
const FILET = "M50 7.6L88.6 17.5V52C88.6 76.5 71.6 91.2 50 98.3C28.4 91.2 11.4 76.5 11.4 52V17.5Z";
const FILET2 = "M50 9.4L86.8 18.9V52C86.8 75.4 70.6 89.4 50 96.4C29.4 89.4 13.2 75.4 13.2 52V18.9Z";
const CY = 41, CAPI = 10.5;
const corpsInsigne = () => {
  const wT = (t.largeur + 100 * P.k) * CAPI / 100;
  return ECU + FILET + FILET2 + symbole(50, CY, 18.5) + chemin(t.contours, CAPI, 79, 50 - wT / 2 - 2);
};

/** Une couronne de guilloché : des anneaux ondulés décalés d'un cran, comme sur les billets et les cartes. */
function couronne(cx: number, cy: number, r0: number, r1: number, n = 16, lobes = 22, amp = 1.1) {
  let d = "";
  for (let i = 0; i < n; i++) {
    const r = r0 + ((r1 - r0) * i) / (n - 1), phi = i * 0.42;
    for (let j = 0; j <= 360; j++) {
      const a = (j / 360) * 2 * Math.PI;
      const rr = r + amp * Math.sin(lobes * a + phi);
      d += (j ? "L" : "M") + (cx + rr * Math.cos(a)).toFixed(2) + " " + (cy + rr * Math.sin(a)).toFixed(2);
    }
  }
  return d;
}

/** Piste « insigne » : une seule pièce, les jours en evenodd (masque, petites tailles). */
export function insigne(c = "#08090B") {
  return svg("2 -2 96 110", "Bola Team", `<path fill="${c}" fill-rule="evenodd" d="${corpsInsigne()}"/>`);
}

/** L'insigne gravé, en grand (vidéo, affiches) : la pièce claire sur le noir, une couronne de guilloché gravée autour du ballon. */
export function insigneGrave(piece = "#F4F5F2", gravure = "#08090B") {
  return svg("2 -2 96 110", "Bola Team",
    `<clipPath id="champ"><path d="${FILET2}"/></clipPath>` +
    `<path fill="${piece}" fill-rule="evenodd" d="${corpsInsigne()}"/>` +
    `<g clip-path="url(#champ)" fill="none" stroke="${gravure}" stroke-width="0.16" opacity=".5"><path d="${couronne(50, CY, 21.5, 27.5, 14)}"/></g>`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dossier = process.argv[2] ?? join(import.meta.dirname, "..", "public", "bola");
  writeFileSync(join(dossier, "team-mot.svg"), mot());
  writeFileSync(join(dossier, "team-bloc.svg"), bloc());
  writeFileSync(join(dossier, "team-insigne.svg"), insigne());
  if (process.argv[2]) writeFileSync(join(dossier, "team-insigne-grave.svg"), insigneGrave());
  console.log(`logo Bola Team écrit dans ${dossier}`);
}
