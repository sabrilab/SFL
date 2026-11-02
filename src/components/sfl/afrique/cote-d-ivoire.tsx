// Le skin de nation « Korhogo » (Côte d'Ivoire ; PACK AFRIQUE 2027).
//
// La toile de Korhogo, des peintres sénoufo du nord de la Côte d'Ivoire : un
// coton filé et tissé à la main en bandes étroites, cousues bord à bord, puis
// peint à main levée d'une boue riche en fer, fermentée, que les feuilles
// bouillies font virer au brun-noir, et qui fonce avec les années. Elle est
// née du fila, une toile de six bandes peintes de rayures ; ses premières
// pièces peintes gardaient la grille des bandes. Et le pagne baoulé, tissé
// en bandes étroites, la chaîne teinte en réserve avant le tissage (l'ikat) :
// ses barres se rompent et s'effrangent d'une bande à l'autre.
//   · le papier : le coton écru, son grain de chaîne et de trame ;
//     l'encre : le brun-noir de la boue ;
//   · la face : autour du portrait, une bordure peinte à la main entre deux
//     traits, des échelles de hachures et des points ; sous le portrait, les
//     bandes cousues et des champs de hachures, à peine ;
//   · le dos : la toile entière. La grille des bandes, chaque case peinte
//     d'une géométrie (hachures, croisillons, carrés emboîtés, points,
//     damiers, losanges), tirée de la graine et d'un tracé qui tremble un peu
//     (une toile par joueur) ; sur les deux bords, des bandes baoulé et leurs
//     barres d'ikat rompues ; au centre, la lune dans un cercle de coton nu,
//     cerné de deux traits et d'un rang de points.
// Ce qu'on évite : toutes les figures de la toile (animaux, personnages,
// masques), souvent liées au poro, la société d'initiation ; les rayures en
// zigzag du fila, que les sources lient au léopard ; les soleils et les
// étoiles, liés à la création ; les couleurs du drapeau. Rien que des
// bordures et des champs géométriques.

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, BANDE, CENTRE_DOS, f, H, LOGOTYPE_DOS, W } from "./outils";

type Pt = [number, number];

// La palette : le coton écru, la boue brun-noir, son lavis plus clair.
const ECRU = "#ebe2cf";
const BOUE = "#2f2219";
const LAVIS = "#7a5b3e";
const FIL = "#5a4330";

/** Huit bandes de coton sur la largeur (les bandes de 10 à 12 cm des métiers étroits). */
const BANDES = 8;
const LB = W / BANDES;

const deja = new Map<string, unknown>();
function memo<T>(cle: string, calcul: () => T): T {
  const v = deja.get(cle);
  if (v !== undefined) return v as T;
  if (deja.size > 48) deja.clear();
  const r = calcul();
  deja.set(cle, r);
  return r;
}

/* ------------------------------ La main levée ------------------------------ */

type Rnd = () => number;

/** Un trait à main levée : les bouts qui bougent un peu, le milieu qui s'écarte. */
function trait(x1: number, y1: number, x2: number, y2: number, rnd: Rnd, amp = 1.6): string {
  const j = () => (rnd() - 0.5) * amp;
  const mx = (x1 + x2) / 2 + j() * 1.4;
  const my = (y1 + y2) / 2 + j() * 1.4;
  return `M${f(x1 + j())} ${f(y1 + j())}Q${f(mx)} ${f(my)} ${f(x2 + j())} ${f(y2 + j())}`;
}

/** Une ligne longue à main levée, en plusieurs reprises du pinceau. */
function ligne(pts: Pt[], rnd: Rnd, amp = 2.2): string {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) d += trait(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rnd, amp);
  return d;
}

/** Un point posé au pinceau : un petit disque un peu inégal. */
function point(x: number, y: number, r: number, rnd: Rnd): string {
  const rx = r * (0.85 + rnd() * 0.3);
  const ry = r * (0.85 + rnd() * 0.3);
  return `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`;
}

/** Une droite (passant par c, d'angle a) coupée au rectangle : les deux bouts, ou rien. */
function dansRect(cx: number, cy: number, a: number, x0: number, y0: number, x1: number, y1: number): [Pt, Pt] | null {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let t0 = -1e5;
  let t1 = 1e5;
  const bords: [number, number][] = [
    [-dx, cx - x0],
    [dx, x1 - cx],
    [-dy, cy - y0],
    [dy, y1 - cy],
  ];
  for (const [p, q] of bords) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
  }
  if (t0 >= t1) return null;
  return [
    [cx + t0 * dx, cy + t0 * dy],
    [cx + t1 * dx, cy + t1 * dy],
  ];
}

/** Des hachures parallèles dans un rectangle, d'angle a, au pas p. */
function hachures(x0: number, y0: number, x1: number, y1: number, a: number, p: number, rnd: Rnd): string {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2 / p);
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  let d = "";
  for (let i = -n; i <= n; i++) {
    const s = dansRect(cx + nx * i * p, cy + ny * i * p, a, x0, y0, x1, y1);
    if (s && Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) > 4) d += trait(s[0][0], s[0][1], s[1][0], s[1][1], rnd, 1.8);
  }
  return d;
}

/* --------------------------------- Les cases -------------------------------- */

interface Peinture {
  /** Les traits fins (hachures), les traits appuyés (contours), les aplats et points. */
  fin: string;
  appuye: string;
  plein: string;
  /** Le lavis : la boue diluée, sous certaines cases. */
  lavis: string;
  /** Les réserves : le coton laissé nu dans un aplat de boue. */
  reserve: string;
}

const vide = (): Peinture => ({ fin: "", appuye: "", plein: "", lavis: "", reserve: "" });

type Case = (x0: number, y0: number, x1: number, y1: number, rnd: Rnd, p: Peinture) => void;

/** Les cases de la grille : rien que de la géométrie. */
const CASES: Case[] = [
  // Les hachures en biais.
  (x0, y0, x1, y1, rnd, p) => {
    p.fin += hachures(x0 + 10, y0 + 10, x1 - 10, y1 - 10, Math.PI / 4, 11, rnd);
  },
  // Les croisillons, sur un lavis.
  (x0, y0, x1, y1, rnd, p) => {
    p.lavis += `M${x0 + 8} ${y0 + 8}H${x1 - 8}V${y1 - 8}H${x0 + 8}Z`;
    p.fin += hachures(x0 + 12, y0 + 12, x1 - 12, y1 - 12, Math.PI / 4, 16, rnd) + hachures(x0 + 12, y0 + 12, x1 - 12, y1 - 12, -Math.PI / 4, 16, rnd);
  },
  // Les carrés emboîtés.
  (x0, y0, x1, y1, rnd, p) => {
    for (let k = 0; k < 4; k++) {
      const e = 14 + k * ((Math.min(x1 - x0, y1 - y0) / 2 - 22) / 3.4);
      const a: Pt = [x0 + e, y0 + e];
      const b: Pt = [x1 - e, y0 + e];
      const c: Pt = [x1 - e, y1 - e];
      const d: Pt = [x0 + e, y1 - e];
      p.appuye += ligne([a, b, c, d, a], rnd, 2.4);
    }
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    p.plein += point(cx, cy, 6, rnd);
  },
  // Les rangs de points.
  (x0, y0, x1, y1, rnd, p) => {
    const pas = 19;
    for (let y = y0 + 18; y < y1 - 10; y += pas) for (let x = x0 + 18 + ((((y - y0) / pas) | 0) % 2) * (pas / 2); x < x1 - 10; x += pas) p.plein += point(x, y, 3.3, rnd);
  },
  // Le damier : un carreau hachuré sur deux.
  (x0, y0, x1, y1, rnd, p) => {
    const n = 3;
    const lx = (x1 - x0 - 16) / n;
    const ly = (y1 - y0 - 16) / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const a = x0 + 8 + i * lx;
        const b = y0 + 8 + j * ly;
        p.appuye += ligne([[a + 3, b + 3], [a + lx - 3, b + 3], [a + lx - 3, b + ly - 3], [a + 3, b + ly - 3], [a + 3, b + 3]], rnd, 1.6);
        if ((i + j) % 2 === 0) p.fin += hachures(a + 7, b + 7, a + lx - 7, b + ly - 7, (j % 2 ? 1 : -1) * Math.PI / 4, 7.5, rnd);
      }
  },
  // Le losange, hachuré en travers, et ses quatre coins pointés.
  (x0, y0, x1, y1, rnd, p) => {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = (x1 - x0) / 2 - 16;
    const ry = (y1 - y0) / 2 - 16;
    p.appuye += ligne([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy], [cx, cy - ry]], rnd, 2.2);
    for (let y = cy - ry + 10; y < cy + ry - 6; y += 9) {
      const w = rx * (1 - Math.abs(y - cy) / ry) - 9;
      if (w > 4) p.fin += trait(cx - w, y, cx + w, y, rnd, 1.6);
    }
    for (const [x, y] of [[x0 + 20, y0 + 20], [x1 - 20, y0 + 20], [x1 - 20, y1 - 20], [x0 + 20, y1 - 20]] as Pt[]) p.plein += point(x, y, 5, rnd);
  },
  // Les bandes de hachures, d'un sens puis de l'autre.
  (x0, y0, x1, y1, rnd, p) => {
    const n = 4;
    const h = (y1 - y0 - 16) / n;
    for (let k = 0; k < n; k++) {
      const a = y0 + 8 + k * h;
      p.fin += hachures(x0 + 10, a + 4, x1 - 10, a + h - 4, k % 2 ? Math.PI / 2.6 : Math.PI - Math.PI / 2.6, 8.5, rnd);
      if (k > 0) p.appuye += trait(x0 + 8, a, x1 - 8, a, rnd, 1.8);
    }
  },
  // La case pleine : la boue étalée, des points de réserve.
  (x0, y0, x1, y1, rnd, p) => {
    p.plein += `M${f(x0 + 10 + rnd() * 2)} ${f(y0 + 10)}L${f(x1 - 10)} ${f(y0 + 10 + rnd() * 2)}L${f(x1 - 10 - rnd() * 2)} ${f(y1 - 10)}L${f(x0 + 10)} ${f(y1 - 10 - rnd() * 2)}Z`;
    for (let y = y0 + 30; y < y1 - 22; y += 26)
      for (let x = x0 + 30 + ((((y - y0) / 26) | 0) % 2) * 13; x < x1 - 22; x += 26) p.reserve += point(x, y, 3.6, rnd);
  },
];

/* --------------------------------- La toile -------------------------------- */

interface Toile extends Peinture {
  coutures: string;
  points: string;
  reserves: string;
  ikat: string;
  bordure: Peinture;
}

/** Le pourtour d'un rectangle arrondi, en points (les coins en six reprises du pinceau). */
function pourtour(x0: number, y0: number, x1: number, y1: number, r: number): Pt[] {
  const pts: Pt[] = [];
  const coin = (cx: number, cy: number, a0: number) => {
    for (let k = 0; k <= 6; k++) {
      const a = a0 + (k / 6) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  coin(x1 - r, y0 + r, -Math.PI / 2);
  coin(x1 - r, y1 - r, 0);
  coin(x0 + r, y1 - r, Math.PI / 2);
  coin(x0 + r, y0 + r, Math.PI);
  pts.push(pts[0]);
  return pts;
}

/**
 * La bordure peinte : deux traits qui suivent le bord arrondi, et entre eux,
 * le long des côtés droits, une échelle de hachures puis trois points, tour à tour.
 */
function bordure(x0: number, y0: number, x1: number, y1: number, ep: number, pas: number, r: number, rnd: Rnd, p: Peinture) {
  p.appuye += ligne(pourtour(x0, y0, x1, y1, r), rnd, 2.2) + ligne(pourtour(x0 + ep, y0 + ep, x1 - ep, y1 - ep, Math.max(4, r - ep)), rnd, 2.2);
  const cotes: [Pt, Pt][] = [
    [[x0 + r, y0], [x1 - r, y0]],
    [[x1, y0 + r], [x1, y1 - r]],
    [[x1 - r, y1], [x0 + r, y1]],
    [[x0, y1 - r], [x0, y0 + r]],
  ];
  for (const [[ax, ay], [bx, by]] of cotes) {
    const l = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / l;
    const uy = (by - ay) / l;
    // La normale vers l'intérieur (sens horaire : à droite de la marche).
    const nx = -uy;
    const ny = ux;
    const n = Math.max(1, Math.round(l / pas));
    const q = l / n;
    for (let i = 0; i < n; i++) {
      const s = i * q + q / 2;
      const mx = ax + ux * s;
      const my = ay + uy * s;
      if (i % 2 === 0) {
        for (let k = -2; k <= 2; k++) {
          const ox = mx + ux * k * (q / 6.5);
          const oy = my + uy * k * (q / 6.5);
          p.fin += trait(ox + nx * 5, oy + ny * 5, ox + nx * (ep - 5), oy + ny * (ep - 5), rnd, 1.4);
        }
      } else {
        for (let k = -1; k <= 1; k++) p.plein += point(mx + ux * k * (q / 4.2) + (nx * ep) / 2, my + uy * k * (q / 4.2) + (ny * ep) / 2, 3.4, rnd);
      }
    }
  }
  // Aux quatre coins : un point appuyé, au milieu de la bordure.
  const m = ep / 2;
  const c = (r - m) * (1 - Math.SQRT1_2) + m;
  for (const [x, y] of [[x0 + c, y0 + c], [x1 - c, y0 + c], [x1 - c, y1 - c], [x0 + c, y1 - c]] as Pt[]) p.plein += point(x, y, 5.5, rnd);
}

/** Les rangs de la grille du dos (le médaillon au centre, le bandeau du logotype sous lui). */
const GRILLE = { haut: 90, champ: 334, bandeau: 1146, bas: LOGOTYPE_DOS.cy + 76, fin: H - 90 };

/** La toile du dos : les bandes et leurs coutures, la bordure, la grille peinte, les bandes baoulé des bords. */
function toile(graine: number): Toile {
  return memo(`dos-${graine}`, () => {
    const rnd = alea(graine ^ 0x6b6f);
    const t: Toile = { ...vide(), coutures: "", points: "", reserves: "", ikat: "", bordure: vide() };
    // Les coutures des bandes, au fil brun, à points réguliers.
    for (let k = 1; k < BANDES; k++) {
      const x = k * LB;
      t.coutures += `M${f(x)} 0V${H}`;
      for (let y = 8; y < H; y += 17) t.points += trait(x - 4, y, x + 4, y + 5, rnd, 0.8);
    }
    // Les bandes baoulé des deux bords : la chaîne teinte en réserve, des barres qui se rompent.
    for (const x0 of [14, W - LB / 2]) {
      const l = LB / 2 - 14;
      for (let y = 40; y < H - 40; ) {
        const h = 26 + rnd() * 70;
        const blanc = 14 + rnd() * 36;
        // Une barre : des fils de chaîne serrés, chacun plus ou moins long (la réserve qui a bavé).
        for (let x = x0 + 3; x < x0 + l - 2; x += 4.2) {
          const a = y + (rnd() - 0.5) * 9;
          const b = y + h + (rnd() - 0.5) * 9;
          t.ikat += `M${f(x)} ${f(a)}V${f(b)}`;
        }
        y += h + blanc;
      }
    }
    // La bordure peinte, à l'intérieur des bandes baoulé.
    const bx0 = LB / 2 + 8;
    const bx1 = W - LB / 2 - 8;
    bordure(bx0, 34, bx1, H - 34, 44, 46, 46, rnd, t.bordure);
    // La grille peinte : un rang de trois cases en haut, le grand champ du médaillon, le bandeau, un rang en bas.
    const gx0 = bx0 + 56;
    const gx1 = bx1 - 56;
    const n = 3;
    const lc = (gx1 - gx0) / n;
    const ordre = Array.from({ length: CASES.length }, (_, i) => i);
    for (let i = ordre.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
    }
    let k = 0;
    const cadre = (x: number, y: number, l: number, h: number) => ligne([[x, y], [x + l, y], [x + l, y + h], [x, y + h], [x, y]], rnd, 2.6);
    for (const [y, h] of [[GRILLE.haut, GRILLE.champ - GRILLE.haut], [GRILLE.bas, GRILLE.fin - GRILLE.bas]] as Pt[])
      for (let c = 0; c < n; c++) {
        const x = gx0 + c * lc;
        t.appuye += cadre(x, y, lc, h);
        CASES[ordre[k++ % ordre.length]](x + 4, y + 4, x + lc - 4, y + h - 4, rnd, t);
      }
    // Le grand champ : hachuré en quatre quartiers qui se répondent ; le médaillon s'y pose.
    const y0 = GRILLE.champ;
    const y1 = GRILLE.bandeau;
    const mx = (gx0 + gx1) / 2;
    const my = CENTRE_DOS.cy;
    t.appuye += cadre(gx0, y0, gx1 - gx0, y1 - y0);
    t.lavis += `M${gx0 + 8} ${y0 + 8}H${gx1 - 8}V${y1 - 8}H${gx0 + 8}Z`;
    t.fin += hachures(gx0 + 12, y0 + 12, mx - 3, my - 3, -Math.PI / 4, 12, rnd) + hachures(mx + 3, y0 + 12, gx1 - 12, my - 3, Math.PI / 4, 12, rnd);
    t.fin += hachures(gx0 + 12, my + 3, mx - 3, y1 - 12, Math.PI / 4, 12, rnd) + hachures(mx + 3, my + 3, gx1 - 12, y1 - 12, -Math.PI / 4, 12, rnd);
    return t;
  });
}

/** La face : la bordure du portrait, les coutures et des champs de hachures sous le portrait. */
function face(graine: number) {
  return memo(`face-${graine}`, () => {
    const rnd = alea(graine ^ 0x666b);
    const bord = vide();
    // La bordure : sur la marge du portrait, de 9 à 39, de haut en bas jusqu'à la bande du bas.
    bordure(9, 9, W - 9, BANDE - 6, 30, 34, 83, rnd, bord);
    let coutures = "";
    let points = "";
    for (let k = 1; k < BANDES; k++) {
      const x = k * LB;
      coutures += `M${f(x)} ${BANDE}V${H}`;
      for (let y = BANDE + 8; y < H; y += 17) points += trait(x - 4, y, x + 4, y + 5, rnd, 0.8);
    }
    // Sous le portrait : des champs de hachures, une bande sur deux, à peine.
    const champs = vide();
    for (let k = 0; k < BANDES; k++) {
      const x = k * LB;
      for (let y = BANDE + 30 + (k % 2) * 150; y < H - 60; y += 300) {
        champs.fin += hachures(x + 14, y, x + LB - 14, y + 120, k % 4 < 2 ? Math.PI / 4 : -Math.PI / 4, 12, rnd);
      }
    }
    return { bord, coutures, points, champs };
  });
}

/* --------------------------------- Le motif -------------------------------- */

function Coton({ id, pas }: { id: string; pas: number }) {
  return (
    <pattern id={id} width={pas} height={pas} patternUnits="userSpaceOnUse">
      <path d={`M0 ${pas / 2}H${pas}`} stroke={LAVIS} strokeOpacity={0.035} strokeWidth={1.2} />
      <path d={`M${pas / 2} 0V${pas}`} stroke={LAVIS} strokeOpacity={0.025} strokeWidth={1} />
    </pattern>
  );
}

function Peint({ p, force = 1 }: { p: Peinture; force?: number }) {
  return (
    <g strokeLinecap="round" fill="none">
      <path d={p.lavis} fill={LAVIS} opacity={0.14 * force} />
      <path d={p.fin} stroke={BOUE} strokeWidth={2.4} opacity={0.82 * force} />
      <path d={p.appuye} stroke={BOUE} strokeWidth={4.2} opacity={0.92 * force} strokeLinejoin="round" />
      <path d={p.plein} fill={BOUE} opacity={0.9 * force} />
      <path d={p.reserve} fill={ECRU} opacity={force} />
    </g>
  );
}

function Korhogo({ cote, m, graine, id }: PropsMotifNation) {
  if (cote === "face") {
    const fc = face(graine);
    return (
      <>
        <defs>
          <Coton id={`kh-c-${id}`} pas={5} />
        </defs>
        <rect width={W} height={H} fill={`url(#kh-c-${id})`} />
        <path d={fc.coutures} stroke={m.fonce} strokeWidth={2.2} />
        <path d={fc.points} stroke={FIL} strokeWidth={1.6} opacity={0.5} strokeLinecap="round" />
        <Peint p={fc.champs} force={0.13} />
        <Peint p={fc.bord} />
      </>
    );
  }

  const t = toile(graine);
  const { cx, cy } = CENTRE_DOS;
  const rnd = alea(graine ^ 0x6c75);
  const bandeau = { y: GRILLE.bandeau, h: GRILLE.bas - GRILLE.bandeau };
  let rond = "";
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2;
    rond += point(cx + 344 * Math.cos(a), cy + 344 * Math.sin(a), 3.6, rnd);
  }
  const cercle = (r: number) => {
    const pts: Pt[] = [];
    // Le pinceau suit le rond en petites reprises : un cercle qui tremble, sans facettes.
    for (let k = 0; k <= 96; k++) {
      const a = (k / 96) * Math.PI * 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return ligne(pts, rnd, 1.3);
  };
  const bx0 = LB / 2 + 8;
  const bx1 = W - LB / 2 - 8;
  return (
    <>
      <defs>
        <Coton id={`kh-c-${id}`} pas={5} />
      </defs>
      <rect width={W} height={H} fill={`url(#kh-c-${id})`} />
      <path d={t.coutures} stroke={m.fonce} strokeWidth={2.4} />
      <path d={t.points} stroke={FIL} strokeWidth={1.8} opacity={0.6} strokeLinecap="round" />
      <path d={t.ikat} stroke={BOUE} strokeWidth={2.6} opacity={0.78} />
      <Peint p={t.bordure} />
      <Peint p={t} />
      {/* Le bandeau du logotype : le coton nu entre deux traits. */}
      <path
        d={trait(bx0 + 56, bandeau.y + 12, bx1 - 56, bandeau.y + 12, rnd, 2.4) + trait(bx0 + 56, bandeau.y + bandeau.h - 12, bx1 - 56, bandeau.y + bandeau.h - 12, rnd, 2.4)}
        stroke={BOUE}
        strokeWidth={4.2}
        fill="none"
        strokeLinecap="round"
      />
      {/* Le cercle de coton nu autour de la lune : deux traits peints, un rang de points. */}
      <circle cx={cx} cy={cy} r={366} fill={ECRU} />
      <circle cx={cx} cy={cy} r={366} fill={`url(#kh-c-${id})`} />
      <g fill="none" stroke={BOUE} strokeLinecap="round">
        <path d={cercle(366)} strokeWidth={4.6} />
        <path d={cercle(356)} strokeWidth={2} opacity={0.8} />
      </g>
      <path d={rond} fill={BOUE} opacity={0.6} />
    </>
  );
}

const coteDIvoire: SkinNation = {
  nation: "ci",
  nom: "Korhogo",
  quoi: "La toile de Korhogo, peinte à main levée d'une boue brune sur le coton écru, et les bandes tissées du pagne baoulé.",
  sources: [
    { titre: "Korhogo cloth : coton tissé en bandes, peint d'une boue fermentée qui fonce avec le temps ; né du fila", url: "https://en.wikipedia.org/wiki/Korhogo_cloth" },
    { titre: "The Textile Museum (GWU), manteau baoulé : ikat de chaîne à l'indigo, bandes étroites cousues", url: "https://collectionstories.museum.gwu.edu/?p=354" },
    { titre: "Whitworth University Art Collection : toile de Korhogo, traits tracés au couteau puis peints", url: "https://publicforms.whitworth.edu/art/collection/collection/artwork/1627" },
    { titre: "Brown University, Off the Roll : textile de Korhogo (Sénoufo)", url: "https://engagingtheamericas.digitalscholarship.brown.edu/off-the-roll-highlights-of-a-global-textiles-project/korhogo-textile-senufo" },
  ],
  dessine: true,
  matiere: {
    titre: "korhogo",
    encre: "40,29,21",
    sombre: false,
    // Le coton écru : son grain de chaîne et de trame, une lumière douce, des bords plus bis.
    papier: [
      "radial-gradient(80% 46% at 30% 18%, rgba(255,252,244,0.7) 0%, rgba(255,252,244,0) 70%)",
      "radial-gradient(60% 40% at 80% 86%, rgba(176,150,112,0.22) 0%, rgba(176,150,112,0) 70%)",
      "repeating-linear-gradient(90deg, rgba(122,91,62,0.05) 0 1px, rgba(0,0,0,0) 1px 4px)",
      "repeating-linear-gradient(0deg, rgba(122,91,62,0.045) 0 1px, rgba(0,0,0,0) 1px 3px)",
      "linear-gradient(165deg, #f1e9d8 0%, #e7ddc8 50%, #d9ccb1 100%)",
    ].join(", "),
    motif: { clair: "rgba(255,252,244,0.6)", fonce: "rgba(90,67,48,0.28)" },
    fond: "rgba(238,230,214,0.94)",
    lueur: "rgba(255,252,244,0.85)",
    rayures: 0.012,
    micro: 0.035,
    reflet: 0.22,
    coins: 0.6,
    etiquette: { fond: "transparent", bord: "rgba(40,29,21,0.5)", texte: "rgba(40,29,21,0.8)" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,252,244,0.9)", ombre: "rgba(70,52,36,0.26)" },
    puce: "linear-gradient(135deg, #fbf8f1, #c3b8a3 45%, #ece5d6 70%, #9c907a)",
    // La carte photo : le coton, une bande de hachures brunes.
    cadre: [
      "repeating-linear-gradient(45deg, rgba(47,34,25,0.55) 0 1.5px, rgba(0,0,0,0) 1.5px 5px)",
      "linear-gradient(160deg, #ece3cf 0%, #d9ccb1 100%)",
    ].join(", "),
    voile: "rgba(30,22,16,0.55)",
    onglet: { fond: "#ebe2cf", encre: "#2f2219" },
    vive: "#7a5b3e",
    dos: { micro: 0.018 },
    // La 3D : une tranche de coton bis, mate ; un reflet faible, chaud.
    tranche: { couleur: "#cbbd9f", metal: 0, rugosite: 0.9 },
    holo: { force: 0.18, teinte: [1, 0.96, 0.9] },
  },
  Motif: Korhogo,
};

export default coteDIvoire;
