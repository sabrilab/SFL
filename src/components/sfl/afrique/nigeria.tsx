// Le skin de nation « Adire » (Nigeria ; PACK AFRIQUE 2027).
//
// L'adire eleko des femmes yoruba d'Abeokuta et d'Ibadan : un coton blanc
// sur lequel on peint à main levée, à la plume ou à la nervure de palme,
// une pâte d'amidon de manioc (lafun) ; on plonge l'étoffe dans l'indigo, la
// pâte protège, et le dessin revient en clair, un peu bleui, avec les fines
// craquelures où la teinture a filé dans l'amidon séché. L'étoffe est
// partagée en carrés, et chaque carré reçoit sa géométrie.
// La carte est une de ces étoffes, bordée de ce qu'on tisse et bâtit autour :
//   · le papier : l'indigo presque noir d'une étoffe plusieurs fois teinte ;
//     l'encre : le blanc du kaolin ;
//   · la face : autour du portrait, une bordure peinte d'adire (deux traits
//     à main levée, des cases étroites, un point, une croix, trois grains) ;
//     dans la bande du bas, à peine, les bandes étroites de l'aso-oke cousues
//     côte à côte, leurs fils de chaîne beige sanyan ;
//   · le dos : l'étoffe entière, une grille de carrés réservés à l'amidon,
//     chacun une géométrie simple (carrés emboîtés, semis de points, croix,
//     échelle, chevrons, cercles peignés, losange, damier), tirée de la graine
//     du joueur : une étoffe par carte ; l'aigle (le totem, totems/nigeria.tsx)
//     s'y pose, les serres sur un perchoir tendu sur la couture du cinquième
//     rang (y 950 : son PERCHOIR_CARTE recopie HAUT_GRILLE), et les cases qu'il
//     touche restent unies (entières ou rien, jamais un motif coupé par ses
//     ailes) ; la lisière rayée d'une bande
//     d'aso-oke de chaque côté ; autour de la lune, en haut à gauche sous son
//     regard (LUNE_NG), une rosace en relief,
//     comme les zayyana des façades hausa de Zaria : un bourrelet d'enduit,
//     ses arêtes de poisson et des nœuds entrelacés (dagi), ton sur ton
//     dans l'indigo.
// Ce qu'on évite : les motifs d'adire nommés d'après une divinité (Olokun,
// entre autres) et toute figure ; les antiquités (Nok, Ifé) ; le rouge vif
// de l'alaari (ni rouge laqué) : le bois de camwood, une terre, le remplace
// à peine ; aucune silhouette de mosquée.

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, BANDE, f, H, W } from "./outils";
import { DECALE_NG, LUNE_NG, POSE_DOS_NG, SILHOUETTE_NG, sousAigleNG } from "./totems/nigeria";

type Pt = [number, number];

const deja = new Map<string, unknown>();
function memo<T>(cle: string, calcul: () => T): T {
  const v = deja.get(cle);
  if (v !== undefined) return v as T;
  if (deja.size > 64) deja.clear();
  const r = calcul();
  deja.set(cle, r);
  return r;
}

// La palette : l'indigo presque noir (à valider → Q2), le blanc bleui des
// réserves d'amidon, le kaolin de l'encre, le beige sanyan, le brun camwood.
const INDIGO = { haut: "#1b2236", milieu: "#121828", bas: "#0a0d18" };
const RESERVE = "208,218,232";
const KAOLIN = "236,234,226";
const SANYAN = "196,174,132";
const CAMWOOD = "116,62,46";

/* ------------------------------ La main levée ------------------------------ */

/**
 * Un trait à main levée : la polyligne coupée en pas de ~9, chaque point
 * écarté de sa normale par une dérive lissée (la plume tremble à peine).
 */
function main(pts: Pt[], rnd: () => number, amp: number, ferme = false): string {
  const chemin = ferme ? [...pts, pts[0]] : pts;
  let d = "";
  let derive = 0;
  for (let i = 0; i < chemin.length - 1; i++) {
    const [x0, y0] = chemin[i];
    const [x1, y1] = chemin[i + 1];
    const l = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / l;
    const ny = (x1 - x0) / l;
    const n = Math.max(1, Math.round(l / 9));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      derive = derive * 0.72 + (rnd() - 0.5) * amp;
      d += `${d ? "L" : "M"}${f(x0 + (x1 - x0) * t + nx * derive)} ${f(y0 + (y1 - y0) * t + ny * derive)}`;
    }
  }
  return d;
}

const cercle = (cx: number, cy: number, r: number, n = 0): Pt[] => {
  const k = n || Math.max(14, Math.round(r / 3));
  return Array.from({ length: k }, (_, i) => [cx + r * Math.cos((i / k) * Math.PI * 2), cy + r * Math.sin((i / k) * Math.PI * 2)] as Pt);
};

/** Un grain (point plein), au rayon qui varie à peine. */
const grain = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;

/* ------------------------------- Les cases ------------------------------- */

type Case = { trait: string; plein: string; grains: string };

const MOTIFS = ["carres", "points", "croix", "echelle", "chevrons", "peigne", "losange", "damier", "couronne"] as const;
type Geste = (typeof MOTIFS)[number];

/**
 * Une case d'adire : une géométrie simple, peinte à la pâte, dans un carré
 * (x, y, l, h). Rien qui porte un nom chargé de sens : des carrés, des points,
 * des lignes, des cercles peignés.
 */
function peindre(geste: Geste, x: number, y: number, l: number, h: number, rnd: () => number): Case {
  const m = 0.16;
  const x0 = x + l * m, y0 = y + h * m, x1 = x + l * (1 - m), y1 = y + h * (1 - m);
  const cx = x + l / 2, cy = y + h / 2;
  const a = 2.2;
  let trait = "";
  let plein = "";
  let grains = "";
  switch (geste) {
    case "carres":
      for (let i = 0; i < 4; i++) {
        const u = i * 0.115;
        const ax = x0 + (x1 - x0) * u, ay = y0 + (y1 - y0) * u, bx = x1 - (x1 - x0) * u, by = y1 - (y1 - y0) * u;
        trait += main([[ax, ay], [bx, ay], [bx, by], [ax, by]], rnd, a, true);
      }
      grains += grain(cx, cy, 6);
      break;
    case "points":
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) grains += grain(x0 + ((x1 - x0) * (i + 0.5)) / 4, y0 + ((y1 - y0) * (j + 0.5)) / 4, 5.2 + rnd() * 1.6);
      break;
    case "croix":
      trait += main([[x0, y0], [x1, y1]], rnd, a) + main([[x1, y0], [x0, y1]], rnd, a);
      trait += main([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], rnd, a, true);
      for (const [px, py] of [[cx, y0 + (cy - y0) * 0.45], [cx, y1 - (y1 - cy) * 0.45], [x0 + (cx - x0) * 0.45, cy], [x1 - (x1 - cx) * 0.45, cy]] as Pt[]) grains += grain(px, py, 6.5);
      break;
    case "echelle":
      trait += main([[x0, y0], [x0, y1]], rnd, a) + main([[x1, y0], [x1, y1]], rnd, a);
      for (let i = 0; i < 7; i++) {
        const yy = y0 + ((y1 - y0) * (i + 0.5)) / 7;
        trait += main([[x0 + 8, yy], [x1 - 8, yy]], rnd, a * 0.8);
      }
      break;
    case "chevrons":
      for (let i = 0; i < 4; i++) {
        const yy = y0 + ((y1 - y0) * (i + 0.3)) / 4;
        trait += main([[x0, yy + (y1 - y0) * 0.16], [cx, yy], [x1, yy + (y1 - y0) * 0.16]], rnd, a);
      }
      break;
    case "peigne": {
      // Les cercles peignés : la pâte posée en disque puis raclée au peigne.
      const r = Math.min(x1 - x0, y1 - y0) / 2;
      for (let i = 0; i < 5; i++) trait += main(cercle(cx, cy, r * (1 - i * 0.17)), rnd, a * 0.7, true);
      grains += grain(cx, cy, r * 0.12);
      break;
    }
    case "losange": {
      const ext: Pt[] = [[cx, y0], [x1, cy], [cx, y1], [x0, cy]];
      trait += main(ext, rnd, a, true);
      const k = 0.46;
      const int: Pt[] = ext.map(([px, py]) => [cx + (px - cx) * k, cy + (py - cy) * k]);
      plein += main(int, rnd, a * 0.6, true) + "Z";
      for (const [px, py] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Pt[]) grains += grain(px + (cx - px) * 0.12, py + (cy - py) * 0.12, 5);
      break;
    }
    case "damier": {
      const n = 4;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          if ((i + j) % 2) continue;
          const ax = x0 + ((x1 - x0) * i) / n, ay = y0 + ((y1 - y0) * j) / n;
          const s = (x1 - x0) / n, t = (y1 - y0) / n;
          plein += main([[ax + 2, ay + 2], [ax + s - 2, ay + 2], [ax + s - 2, ay + t - 2], [ax + 2, ay + t - 2]], rnd, 1.2, true) + "Z";
        }
      break;
    }
    case "couronne": {
      // Un disque réservé, cerné d'une couronne de traits courts.
      const r = Math.min(x1 - x0, y1 - y0) * 0.24;
      plein += main(cercle(cx, cy, r), rnd, 1.2, true) + "Z";
      const R = Math.min(x1 - x0, y1 - y0) * 0.48;
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2;
        trait += main([[cx + Math.cos(t) * r * 1.35, cy + Math.sin(t) * r * 1.35], [cx + Math.cos(t) * R, cy + Math.sin(t) * R]], rnd, 1.4);
      }
      break;
    }
  }
  return { trait, plein, grains };
}

/** Les craquelures : là où l'indigo a filé dans l'amidon séché, des veines fines. */
function craquelures(zones: [number, number, number, number][], rnd: () => number): string {
  let d = "";
  for (const [x, y, l, h] of zones) {
    const n = Math.round((l * h) / 1400);
    for (let i = 0; i < n; i++) {
      let px = x + rnd() * l;
      let py = y + rnd() * h;
      let ang = rnd() * Math.PI * 2;
      d += `M${f(px)} ${f(py)}`;
      const pas = 3 + Math.round(rnd() * 6);
      for (let k = 0; k < pas; k++) {
        ang += (rnd() - 0.5) * 1.1;
        px += Math.cos(ang) * 5;
        py += Math.sin(ang) * 5;
        d += `L${f(px)} ${f(py)}`;
      }
    }
  }
  return d;
}

/* ------------------------------- L'étoffe (dos) ------------------------------- */

// La rosace : le bourrelet intérieur, l'extérieur, le cerne du médaillon (pour une lune
// de 300 ; K les met à l'échelle de la lune, en haut à gauche sous le regard de l'aigle, LUNE_NG).
const K = LUNE_NG.d / 300;
const R_IN = 334 * K;
const R_OUT = 392 * K;
const R_CERNE = 410 * K;

const MARGE = 60;
// La couture du cinquième rang (y 950) porte le perchoir de l'aigle : totems/nigeria.tsx la recopie
// (PERCHOIR_CARTE) ; changer l'une et l'autre ensemble.
const HAUT_GRILLE = { y0: 60, y1: 1128, rangs: 6 };
const BAS_GRILLE = { y0: 1312, y1: 1520 };
const COLS = 5;

interface Etoffe {
  trait: string;
  plein: string;
  grains: string;
  crack: string;
  grille: string;
  semis: string;
}

/** La part d'une case que le médaillon laisse voir. */
function dehors(x: number, y: number, l: number, h: number): number {
  const { cx, cy } = LUNE_NG;
  let n = 0;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if (Math.hypot(x + ((i + 0.5) * l) / 8 - cx, y + ((j + 0.5) * h) / 8 - cy) > R_CERNE + 30) n++;
  return n / 64;
}

/** Une case que l'aigle (le totem) touche : laissée unie, entière ou rien (jamais un motif coupé par ses ailes). */
function sousAigle(x: number, y: number, l: number, h: number): boolean {
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) if (sousAigleNG(x + (i * l) / 6, y + (j * h) / 6, 14)) return true;
  return false;
}

/** Le dos : la grille de cases, ses doubles traits et le semis de points entre eux. */
function etoffe(seed: number): Etoffe {
  const rnd = alea(seed ^ 0x0ad1e5ee);
  const l = (W - 2 * MARGE) / COLS;
  const hh = (HAUT_GRILLE.y1 - HAUT_GRILLE.y0) / HAUT_GRILLE.rangs;
  const cases: [number, number, number, number][] = [];
  for (let j = 0; j < HAUT_GRILLE.rangs; j++) for (let i = 0; i < COLS; i++) cases.push([MARGE + i * l, HAUT_GRILLE.y0 + j * hh, l, hh]);
  for (let i = 0; i < COLS; i++) cases.push([MARGE + i * l, BAS_GRILLE.y0, l, BAS_GRILLE.y1 - BAS_GRILLE.y0]);
  // Le choix des gestes : jamais deux fois le même côte à côte ni l'un sur l'autre.
  const choix: Geste[] = [];
  let trait = "";
  let plein = "";
  let grains = "";
  const zonesPleines: [number, number, number, number][] = [];
  cases.forEach(([x, y, cl, ch], k) => {
    const gauche = k % COLS ? choix[k - 1] : undefined;
    const dessus = k >= COLS ? choix[k - COLS] : undefined;
    let g: Geste;
    do g = MOTIFS[Math.floor(rnd() * MOTIFS.length)];
    while (g === gauche || g === dessus);
    choix.push(g);
    const c = peindre(g, x, y, cl, ch, rnd);
    // Une case que le médaillon couvre presque, ou que l'aigle touche : laissée unie (le tirage reste le même).
    if (dehors(x, y, cl, ch) < 0.62 || sousAigle(x, y, cl, ch)) return;
    trait += c.trait;
    plein += c.plein;
    grains += c.grains;
    if (c.plein) zonesPleines.push([x + cl * 0.14, y + ch * 0.14, cl * 0.72, ch * 0.72]);
  });
  // La grille : des doubles traits, et entre eux, un semis de points.
  let grille = "";
  let semis = "";
  const e = 6;
  const hLignes = [
    ...Array.from({ length: HAUT_GRILLE.rangs + 1 }, (_, j) => HAUT_GRILLE.y0 + j * hh),
    BAS_GRILLE.y0,
    BAS_GRILLE.y1,
  ];
  for (const y of hLignes) {
    grille += main([[MARGE - e, y - e], [W - MARGE + e, y - e]], rnd, 1.6) + main([[MARGE - e, y + e], [W - MARGE + e, y + e]], rnd, 1.6);
  }
  for (let i = 0; i <= COLS; i++) {
    const x = MARGE + i * l;
    for (const [ya, yb] of [[HAUT_GRILLE.y0, HAUT_GRILLE.y1], [BAS_GRILLE.y0, BAS_GRILLE.y1]]) {
      grille += main([[x - e, ya - e], [x - e, yb + e]], rnd, 1.6) + main([[x + e, ya - e], [x + e, yb + e]], rnd, 1.6);
      for (let y = ya + 16; y < yb - 8; y += 17) semis += grain(x, y, 2.3);
    }
  }
  for (const y of hLignes) for (let x = MARGE + 16; x < W - MARGE - 8; x += 17) semis += grain(x, y, 2.3);
  return { trait, plein, grains, crack: craquelures(zonesPleines, rnd), grille, semis };
}

/* ---------------------------- La rosace de Zaria ---------------------------- */

interface Rosace {
  bourrelets: string;
  dagi: string;
  incises: string;
  cerne: string;
  semis: string;
}

/**
 * La rosace en relief autour de la lune : deux bourrelets d'enduit, entre eux
 * des incisions en arêtes de poisson ; huit nœuds dagi (deux boucles qui
 * s'entrelacent) sur la bande. (Les pinacles zankwaye d'un faîte, dont aucune
 * source ne décrit la forme, sont laissés de côté.) Autour, l'étoffe s'arrête sur un double
 * cerne peint et son semis de points, comme le médaillon d'un adire.
 */
function rosace(): Rosace {
  const { cx, cy } = LUNE_NG;
  const anneau = (r: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
  const bourrelets = anneau(R_IN) + anneau(R_OUT);
  // Les arêtes de poisson : deux rangs d'incisions penchées en sens contraire.
  let incises = "";
  const n = Math.round(120 * K);
  const rm = (R_IN + R_OUT) / 2;
  for (let k = 0; k < n; k++) {
    const t = (k / n) * Math.PI * 2;
    const d = 0.03;
    const p = (r: number, a: number) => `${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`;
    incises += `M${p(R_IN + 8 * K, t - d)}L${p(rm - 2, t)}M${p(R_OUT - 8 * K, t - d)}L${p(rm + 2, t)}`;
  }
  let dagi = "";
  for (let k = 0; k < 8; k++) {
    const t = (k / 8) * Math.PI * 2 - Math.PI / 2;
    const rx = cx + Math.cos(t) * rm, ry = cy + Math.sin(t) * rm;
    // Le nœud dagi : quatre boucles en croix, prises dans un losange qui les traverse.
    for (let i = 0; i < 4; i++) {
      const a = t + (i * Math.PI) / 2;
      const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
      const p = (u: number, v: number) => `${f(rx + (ux * u + vx * v) * K)} ${f(ry + (uy * u + vy * v) * K)}`;
      dagi += `M${p(4, 5)}C${p(14, 13)} ${p(27, 12)} ${p(27, 0)}C${p(27, -12)} ${p(14, -13)} ${p(4, -5)}`;
    }
    const s = 16 * K;
    const lo: Pt[] = [0, 1, 2, 3].map((i) => {
      const a = t + Math.PI / 4 + (i * Math.PI) / 2;
      return [rx + Math.cos(a) * s * Math.SQRT2, ry + Math.sin(a) * s * Math.SQRT2];
    });
    dagi += `M${lo.map((q) => `${f(q[0])} ${f(q[1])}`).join("L")}Z`;
    dagi += grain(rx, ry, 3.6 * K);
  }
  const rnd = alea(0x2a51a);
  const cerne = main(cercle(cx, cy, R_CERNE, 120), rnd, 1.4, true) + main(cercle(cx, cy, R_CERNE + 13, 120), rnd, 1.4, true);
  let semis = "";
  const ns = Math.round((2 * Math.PI * (R_CERNE + 6.5)) / 17);
  for (let k = 0; k < ns; k++) {
    const t = (k / ns) * Math.PI * 2;
    semis += grain(cx + Math.cos(t) * (R_CERNE + 6.5), cy + Math.sin(t) * (R_CERNE + 6.5), 2.3);
  }
  return { bourrelets, dagi, incises, cerne, semis };
}

/* ------------------------------ La bordure (face) ------------------------------ */

/** Un point du rectangle arrondi (inset d, rayon r), à l'abscisse curviligne s. */
function pourtour(d: number, r: number, bas = H - d) {
  const x0 = d, y0 = d, x1 = W - d, y1 = bas;
  const lh = x1 - x0 - 2 * r;
  const lv = y1 - y0 - 2 * r;
  const q = (Math.PI / 2) * r;
  const segs: { l: number; pt: (t: number) => [Pt, Pt] }[] = [
    { l: lh, pt: (t) => [[x0 + r + t, y0], [0, -1]] },
    { l: q, pt: (t) => { const a = -Math.PI / 2 + t / r; return [[x1 - r + r * Math.cos(a), y0 + r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; } },
    { l: lv, pt: (t) => [[x1, y0 + r + t], [1, 0]] },
    { l: q, pt: (t) => { const a = t / r; return [[x1 - r + r * Math.cos(a), y1 - r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; } },
    { l: lh, pt: (t) => [[x1 - r - t, y1], [0, 1]] },
    { l: q, pt: (t) => { const a = Math.PI / 2 + t / r; return [[x0 + r + r * Math.cos(a), y1 - r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; } },
    { l: lv, pt: (t) => [[x0, y1 - r - t], [-1, 0]] },
    { l: q, pt: (t) => { const a = Math.PI + t / r; return [[x0 + r + r * Math.cos(a), y0 + r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; } },
  ];
  const total = segs.reduce((a, s) => a + s.l, 0);
  const coins: number[] = [];
  let acc = 0;
  segs.forEach((s, i) => {
    if (i % 2 === 1) coins.push(acc + s.l / 2);
    acc += s.l;
  });
  const en = (s: number): [Pt, Pt] => {
    let t = ((s % total) + total) % total;
    for (const sg of segs) {
      if (t <= sg.l) return sg.pt(t);
      t -= sg.l;
    }
    return segs[segs.length - 1].pt(segs[segs.length - 1].l);
  };
  return { total, en, coins, segs };
}

interface Bordure {
  traits: string;
  marques: string;
  grains: string;
}

/**
 * La bordure peinte de la face, dans la marge du portrait : deux traits à main
 * levée, et entre eux des cases étroites séparées par deux barres ; dans
 * chaque case, à tour de rôle, un grain, une croix, trois grains. Aux coins,
 * un grain cerné.
 */
function bordure(seed: number): Bordure {
  const rnd = alea(seed ^ 0x7e11b0a2);
  const bas = BANDE - 20.5;
  const mi = pourtour(20.5, 71.5, bas);
  const ligne = (d: number, r: number) => {
    const p = pourtour(d, r, BANDE - d);
    const pts: Pt[] = [];
    for (let s = 0; s < p.total; s += 10) pts.push(p.en(s)[0]);
    return main(pts, rnd, 1.1, true);
  };
  let traits = ligne(8.5, 83.5) + ligne(32.5, 59.5);
  let marques = "";
  let grains = "";
  const n = Math.round(mi.total / 54);
  const pas = mi.total / n;
  const pres = (s: number) => mi.coins.some((c) => Math.abs(((s - c + mi.total * 1.5) % mi.total) - mi.total / 2) < 30);
  for (let k = 0; k < n; k++) {
    const s = k * pas;
    if (pres(s) || pres(s + pas)) continue;
    // La barre qui ferme la case.
    {
      const [[x, y], [nx, ny]] = mi.en(s);
      traits += main([[x - nx * 11, y - ny * 11], [x + nx * 11, y + ny * 11]], rnd, 0.7);
    }
    const [[x, y], [nx, ny]] = mi.en(s + pas / 2);
    const tx = -ny, ty = nx;
    switch (k % 4) {
      case 0:
        grains += grain(x, y, 4.2);
        break;
      case 1:
        // Un petit losange plein.
        grains += `M${f(x + tx * 11)} ${f(y + ty * 11)}L${f(x + nx * 6.5)} ${f(y + ny * 6.5)}L${f(x - tx * 11)} ${f(y - ty * 11)}L${f(x - nx * 6.5)} ${f(y - ny * 6.5)}Z`;
        break;
      case 2:
        for (const u of [-10, 0, 10]) grains += grain(x + tx * u, y + ty * u, 2.5);
        break;
      default:
        marques += main([[x - tx * 8 - nx * 6.5, y - ty * 8 - ny * 6.5], [x + tx * 8 + nx * 6.5, y + ty * 8 + ny * 6.5]], rnd, 0.5);
        marques += main([[x - tx * 8 + nx * 6.5, y - ty * 8 + ny * 6.5], [x + tx * 8 - nx * 6.5, y + ty * 8 - ny * 6.5]], rnd, 0.5);
    }
  }
  for (const c of mi.coins) {
    const [[x, y]] = mi.en(c);
    traits += main(cercle(x, y, 10, 16), rnd, 0.6, true);
    grains += grain(x, y, 3.8);
  }
  return { traits, marques, grains };
}

/* ------------------------------- L'aso-oke ------------------------------- */

/** Une bande d'aso-oke : ses fils de chaîne, en groupes (x dans la bande, largeur, ton). */
const BANDE_ASO: { x: number; l: number; c: "s" | "k" | "w" }[] = [
  { x: 6, l: 2, c: "s" },
  { x: 11, l: 2, c: "s" },
  { x: 18, l: 7, c: "w" },
  { x: 30, l: 1.5, c: "k" },
  { x: 36, l: 1.5, c: "s" },
  { x: 52, l: 14, c: "s" },
  { x: 70, l: 1.5, c: "k" },
  { x: 84, l: 1.5, c: "s" },
  { x: 90, l: 7, c: "w" },
  { x: 102, l: 2, c: "s" },
  { x: 107, l: 2, c: "s" },
];
const LARGEUR_ASO = 113.8;

/* --------------------------------- Le motif --------------------------------- */

/**
 * La teinture : une étoffe plongée bain après bain ne prend jamais l'indigo
 * tout à fait égal (des nuages plus clairs, d'autres plus profonds), puis on
 * la bat au maillet jusqu'au lustre ; et le fil filé main a ses grosseurs.
 * Stable pour une même graine.
 */
function Teinture({ graine, id, face }: { graine: number; id: string; face: boolean }) {
  const t = memo(`teinture:${face ? "f" : "d"}:${graine}`, () => {
    const rnd = alea(graine ^ 0x7e1a7);
    const y0 = face ? BANDE : 0;
    const nuages = Array.from({ length: face ? 3 : 7 }, (_, i) => ({
      x: rnd() * W,
      y: y0 + rnd() * (H - y0),
      r: 120 + rnd() * 200,
      clair: i % 2 === 0,
    }));
    let fils = "";
    for (let i = 0, n = face ? 70 : 180; i < n; i++) fils += `M${f(rnd() * W)} ${f(y0 + rnd() * (H - y0))}h${f(5 + rnd() * 18)}`;
    return { nuages, fils };
  });
  return (
    <>
      <defs>
        <radialGradient id={`tc-${id}`}>
          <stop offset="0" stopColor="#33416a" stopOpacity={0.3} />
          <stop offset="1" stopColor="#33416a" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`tf-${id}`}>
          <stop offset="0" stopColor="#03050b" stopOpacity={0.42} />
          <stop offset="1" stopColor="#03050b" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`tl-${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W} y2={H}>
          <stop offset="0.28" stopColor="#b8c6ea" stopOpacity={0} />
          <stop offset="0.4" stopColor="#b8c6ea" stopOpacity={0.07} />
          <stop offset="0.47" stopColor="#b8c6ea" stopOpacity={0.02} />
          <stop offset="0.55" stopColor="#b8c6ea" stopOpacity={0.06} />
          <stop offset="0.68" stopColor="#b8c6ea" stopOpacity={0} />
        </linearGradient>
      </defs>
      {t.nuages.map((n, i) => (
        <ellipse key={i} cx={f(n.x)} cy={f(n.y)} rx={f(n.r)} ry={f(n.r * 0.72)} fill={`url(#${n.clair ? "tc" : "tf"}-${id})`} />
      ))}
      <rect width={W} height={H} fill={`url(#tl-${id})`} />
      <path d={t.fils} stroke={`rgba(${RESERVE},0.07)`} strokeWidth={1.4} strokeLinecap="round" />
    </>
  );
}

function Adire({ cote, m, graine, id }: PropsMotifNation) {
  const dos = cote === "dos";
  const ton = (c: "s" | "k" | "w", force: number) =>
    c === "w" ? `rgba(${CAMWOOD},${0.9 * force})` : c === "k" ? `rgba(${KAOLIN},${0.32 * force})` : `rgba(${SANYAN},${0.42 * force})`;

  if (!dos) {
    const b = memo(`bord:${graine}`, () => bordure(graine));
    return (
      <>
        <defs>
          <linearGradient id={`af-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0} />
            <stop offset="0.3" stopColor="#fff" stopOpacity={1} />
            <stop offset="1" stopColor="#fff" stopOpacity={1} />
          </linearGradient>
          <mask id={`am-${id}`}>
            <rect x={0} y={BANDE} width={W} height={H - BANDE} fill={`url(#af-${id})`} />
          </mask>
          <pattern id={`ap-${id}`} width={LARGEUR_ASO} height={40} patternUnits="userSpaceOnUse" x={(W - LARGEUR_ASO * 9) / 2} y={0}>
            {BANDE_ASO.map((r, i) => (
              <rect key={i} x={r.x} y={0} width={r.l} height={40} fill={ton(r.c, 0.15)} />
            ))}
            {/* La couture entre deux bandes, ses points */}
            <rect x={0} y={0} width={1.4} height={40} fill="rgba(0,0,0,0.5)" />
            <path d="M-2 6L3 12M-2 26L3 32" stroke={`rgba(${SANYAN},0.14)`} strokeWidth={1.2} />
          </pattern>
        </defs>
        {/* Le fil de l'étoffe teinte, à peine ; la teinture inégale, le lustre du battage */}
        <Teinture graine={graine} id={id} face />
        <rect width={W} height={H} fill={`url(#tr-${id})`} />
        <defs>
          <pattern id={`tr-${id}`} width={6} height={6} patternUnits="userSpaceOnUse">
            <path d="M0 0.5H6M0.5 0V6" stroke={m.clair} strokeWidth={0.8} />
          </pattern>
        </defs>
        {/* La bande du bas : les bandes d'aso-oke cousues côte à côte, très bas */}
        <g mask={`url(#am-${id})`}>
          <rect x={0} y={BANDE} width={W} height={H - BANDE} fill={`url(#ap-${id})`} />
        </g>
        {/* La bordure peinte : le relief de l'amidon (l'ombre), puis la réserve */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={b.traits + b.marques} stroke="rgba(0,0,0,0.55)" strokeWidth={4.2} transform="translate(0.8 1.2)" />
          <path d={b.traits} stroke={`rgba(${RESERVE},0.74)`} strokeWidth={3.2} />
          <path d={b.marques} stroke={`rgba(${RESERVE},0.7)`} strokeWidth={2.2} />
        </g>
        <path d={b.grains} fill={`rgba(${RESERVE},0.8)`} />
      </>
    );
  }

  const e = memo(`etoffe:${graine}`, () => etoffe(graine));
  const r = memo("rosace", rosace);
  const { cx, cy } = LUNE_NG;
  const relief = (d: string, w: number, cle: string, plein = false) => (
    <g key={cle} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} fill={plein ? "rgba(0,0,0,0.55)" : "none"} stroke="rgba(0,0,0,0.6)" strokeWidth={w + 2} transform="translate(2 3)" />
      <path d={d} fill={plein ? "#2a3552" : "none"} stroke="#2c3754" strokeWidth={w} />
      <path d={d} fill="none" stroke={`rgba(${RESERVE},0.34)`} strokeWidth={w * 0.3} transform="translate(-1 -1.4)" />
    </g>
  );
  return (
    <>
      <defs>
        <mask id={`am-${id}`}>
          <rect width={W} height={H} fill="#fff" />
          <circle cx={cx} cy={cy} r={R_CERNE + 30} fill="#000" />
          {/* L'aigle (le totem) : l'étoffe s'arrête un peu avant lui. */}
          <g transform={`translate(${POSE_DOS_NG.x} ${POSE_DOS_NG.y}) scale(${POSE_DOS_NG.echelle}) ${DECALE_NG}`} fill="#000" stroke="#000" strokeWidth={34} strokeLinejoin="round">
            <path d={SILHOUETTE_NG} />
          </g>
        </mask>
        <clipPath id={`ac-${id}`}>
          <path d={e.plein} />
        </clipPath>
        <pattern id={`ap-${id}`} width={44} height={40} patternUnits="userSpaceOnUse" x={4} y={0}>
          {BANDE_ASO.filter((b) => b.x < 44).map((b, i) => (
            <rect key={i} x={b.x - 4} y={0} width={b.l} height={40} fill={ton(b.c, 0.8)} />
          ))}
        </pattern>
        <pattern id={`tr-${id}`} width={6} height={6} patternUnits="userSpaceOnUse">
          <path d="M0 0.5H6M0.5 0V6" stroke={m.clair} strokeWidth={0.8} />
        </pattern>
      </defs>

      {/* Le fil de l'étoffe, la teinture inégale des bains, le lustre du battage */}
      <Teinture graine={graine} id={id} face={false} />
      <rect width={W} height={H} fill={`url(#tr-${id})`} />

      {/* Les lisières : une bande d'aso-oke de chaque côté */}
      <rect x={4} y={0} width={40} height={H} fill={`url(#ap-${id})`} />
      <rect x={W - 44} y={0} width={40} height={H} fill={`url(#ap-${id})`} transform={`rotate(180 ${W - 24} ${H / 2})`} />

      {/* L'étoffe : la grille et ses cases, hors de la rosace */}
      <g mask={`url(#am-${id})`}>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={e.grille + e.trait} stroke="rgba(0,0,0,0.5)" strokeWidth={6} transform="translate(1 1.6)" />
          <path d={e.grille} stroke={`rgba(${RESERVE},0.5)`} strokeWidth={3.2} />
          <path d={e.trait} stroke={`rgba(${RESERVE},0.62)`} strokeWidth={4.2} />
        </g>
        <path d={e.plein} fill={`rgba(${RESERVE},0.6)`} />
        <path d={e.crack} clipPath={`url(#ac-${id})`} fill="none" stroke={INDIGO.milieu} strokeWidth={1.4} strokeOpacity={0.85} />
        <path d={e.grains} fill={`rgba(${RESERVE},0.66)`} />
        <path d={e.semis} fill={`rgba(${RESERVE},0.38)`} />
      </g>

      {/* La bande du logotype : l'étoffe laissée unie, cernée de deux filets */}
      <rect x={MARGE - 6} y={HAUT_GRILLE.y1 + 10} width={W - 2 * MARGE + 12} height={BAS_GRILLE.y0 - HAUT_GRILLE.y1 - 20} fill={INDIGO.milieu} opacity={0.94} />

      {/* Le médaillon : l'étoffe s'arrête sur un double cerne peint */}
      <g fill="none" strokeLinecap="round">
        <path d={r.cerne} stroke="rgba(0,0,0,0.5)" strokeWidth={5} transform="translate(1 1.6)" />
        <path d={r.cerne} stroke={`rgba(${RESERVE},0.5)`} strokeWidth={3.2} />
      </g>
      <path d={r.semis} fill={`rgba(${RESERVE},0.38)`} />

      {/* La rosace de Zaria, ton sur ton : les arêtes de poisson, les bourrelets, les nœuds */}
      <path d={r.incises} stroke="rgba(0,0,0,0.65)" strokeWidth={3} strokeLinecap="round" />
      <path d={r.incises} stroke={`rgba(${RESERVE},0.22)`} strokeWidth={1.3} strokeLinecap="round" transform="translate(-0.9 -1.1)" />
      {relief(r.bourrelets, 9 * K, "b")}
      <path d={r.dagi} fill="none" stroke={INDIGO.milieu} strokeWidth={11 * K} strokeLinejoin="round" />
      {relief(r.dagi, 4.4 * K, "d")}
    </>
  );
}

const adire: SkinNation = {
  nation: "ng",
  nom: "Adire",
  quoi: "L'adire eleko d'Abeokuta et d'Ibadan peint à l'amidon sur l'indigo, l'aso-oke tissé en bandes, les reliefs des façades de Zaria.",
  sources: [
    { titre: "Horniman Museum, Nigeria60 : les archives de l'adire (lafun, alun, Ibadan et Abeokuta)", url: "https://www.horniman.ac.uk/story/nigeria60-adire-archives/" },
    { titre: "Smarthistory, pagne Ibadandun, artiste yoruba non nommée (adire eleko peint à main levée)", url: "https://smarthistory.org/ibadandun-womans-wrapper-unrecorded-yoruba-artist/" },
    { titre: "Victoria and Albert Museum, adire eleko (pâte au pochoir, cercles peignés)", url: "https://api.vam.ac.uk/v2/object/O147379" },
    { titre: "The Guardian Nigeria, les couleurs de l'aso-oke (etu, sanyan, alaari)", url: "https://guardian.ng/life/the-rich-colours-of-aso-oke/" },
    { titre: "F. Schwerdtfeger, Hausa Urban Art and its Social Background (LIT Verlag), compte rendu, Africa 78.3", url: "https://muse.jhu.edu/article/250411/pdf" },
    { titre: "African History Extra, l'architecture urbaine hausa (zayyana, zankwaye)", url: "https://www.africanhistoryextra.com/p/hausa-urban-architecture-construction" },
    { titre: "The Bright Continent, la porte du palais de l'émir de Zaria (nœuds dagi)", url: "https://access.thebrightcontinent.org/items/show/20" },
  ],
  dessine: true,
  matiere: {
    titre: "adire",
    encre: KAOLIN,
    sombre: true,
    papier: [
      "radial-gradient(70% 45% at 30% 22%, rgba(60,78,120,0.22) 0%, rgba(60,78,120,0) 70%)",
      "radial-gradient(80% 50% at 75% 82%, rgba(40,52,88,0.18) 0%, rgba(40,52,88,0) 70%)",
      `linear-gradient(168deg, ${INDIGO.haut} 0%, ${INDIGO.milieu} 50%, ${INDIGO.bas} 100%)`,
    ].join(", "),
    motif: { clair: `rgba(${RESERVE},0.025)`, fonce: "rgba(0,0,0,0.3)" },
    fond: "#111626",
    lueur: "rgba(208,218,232,0.08)",
    rayures: 0.04,
    micro: 0.05,
    dos: { micro: 0.022 },
    reflet: 0.14,
    coins: 0.6,
    etiquette: { fond: "#0b0f1b", bord: `rgba(${KAOLIN},0.45)`, texte: `rgba(${KAOLIN},0.92)` },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(208,218,240,0.26)", ombre: "rgba(0,0,0,0.75)" },
    puce: "linear-gradient(135deg, #e6e8ec, #8d93a3 45%, #d3d6de 70%, #5b6172)",
    cadre: `linear-gradient(152deg, #263049 0%, ${INDIGO.bas} 42%, #1a2134 66%, #070911 100%)`,
    voile: "rgba(6,8,16,0.82)",
    onglet: { fond: "#ecebe4", encre: "#0f1422" },
    vive: "#c4ae84",
    tranche: { couleur: "#a8916a", metal: 0.05, rugosite: 0.72 },
    holo: { force: 0.2, teinte: [0.82, 0.88, 1] },
  },
  Motif: Adire,
};

export default adire;
