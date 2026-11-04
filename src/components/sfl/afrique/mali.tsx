// Le skin de nation « Bogolan » (Mali ; PACK AFRIQUE 2027).
//
// Le bògòlanfini des Bamana (bogo, la terre ; lan, avec ; fini, l'étoffe) :
// un coton filé et tissé en bandes étroites, cousues bord à bord, trempé
// dans un bain jaune de feuilles (n'gallama), puis peint à la main d'une
// boue de rivière riche en fer, fermentée des mois en jarre. La boue fonce le
// coton là où elle passe ; on la reprend pour noircir, puis on blanchit le
// jaune qui reste. Le dessin est ce qu'on a laissé nu : des réserves claires
// sur un fond brun-noir. Et deux voisins de la même terre :
//   · le banco de Djenné, l'enduit de terre et de balle de riz qu'on remonte
//     chaque année sur les murs, et le rythme des toron, les pieux de palmier
//     qui en sortent et servent d'échafaudage ;
//   · la couverture de laine des Peuls (kaasa), tissée en bandes, ses bouts
//     rayés, ses losanges en trame flottée, sa lisière tressée.
//   · le papier : le coton passé à la boue, brun-noir ; l'encre : le coton nu ;
//   · la face : autour du portrait, une bordure réservée, entre deux traits,
//     des rangs de points et des barreaux ; sous le portrait, les bandes
//     cousues et des cases, à peine ;
//   · le dos : la pièce entière. Six bandes cousues ; le grand champ de boue
//     pleine, où plane le totem, l'aigle réservé dans la boue (totems/mali.tsx),
//     vu de dessous, incliné vers la lune, montée en haut à droite dans son
//     médaillon cerné de points (LUNE_ML) ; autour de l'oiseau, le champ reste
//     uni (sousAigleML : aucun point ne le touche) ; sous le logotype, un rang de
//     cases un peu décalées d'une bande à l'autre comme sur un vrai pagne
//     (une pièce par joueur, tirée de la graine) ; en haut et en bas, les
//     bouts de laine rayés ; sur les deux bords, le banco et ses toron ;
//   · la terre, partout : la boue reprise deux ou trois fois ne fonce pas
//     égal (des nuées plus sombres, d'autres où le coton remonte), le jaune
//     de n'gallama qui reste par endroits, les grosseurs du fil filé main.
// Ce qu'on évite : la silhouette de la Grande Mosquée de Djenné et de tout
// édifice ; tout animal autre que le totem ; les objets, masques et sanctuaires dogon ; les motifs nommés du
// bògòlan (on garde une géométrie élémentaire : points, barreaux, carrés,
// traits) ; les couleurs du drapeau.

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, BANDE, f, H, LOGOTYPE_DOS, W } from "./outils";
import { LUNE_ML, sousAigleML } from "./totems/mali";

type Pt = [number, number];
type Rnd = () => number;

// La palette : la boue brun-noir, le coton nu, le jaune de n'gallama resté, le banco.
const BOUE = "#231a13";
const COTON = "#eadfc6";
const NGALLAMA = "#b88d4c";
const BANCO = "#a87a4b";
const LAINE = "#e9e0cc";
const NOIR = "#1a1410";

/** Six bandes de coton sur la largeur. */
const BANDES = 6;
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

/** Un trait réservé à main levée (le bout de bois qui contourne). */
function trait(x1: number, y1: number, x2: number, y2: number, rnd: Rnd, amp = 1.6): string {
  const j = () => (rnd() - 0.5) * amp;
  const mx = (x1 + x2) / 2 + j() * 1.3;
  const my = (y1 + y2) / 2 + j() * 1.3;
  return `M${f(x1 + j())} ${f(y1 + j())}Q${f(mx)} ${f(my)} ${f(x2 + j())} ${f(y2 + j())}`;
}

function ligne(pts: Pt[], rnd: Rnd, amp = 2): string {
  let d = "";
  for (let i = 0; i < pts.length - 1; i++) d += trait(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], rnd, amp);
  return d;
}

/** Un point réservé : un petit disque inégal. */
function point(x: number, y: number, r: number, rnd: Rnd): string {
  const rx = r * (0.82 + rnd() * 0.36);
  const ry = r * (0.82 + rnd() * 0.36);
  return `M${f(x - rx)} ${f(y)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`;
}

/** Un carré réservé, un peu de travers. */
function carre(x: number, y: number, c: number, rnd: Rnd): string {
  const j = () => (rnd() - 0.5) * 1.6;
  return `M${f(x + j())} ${f(y + j())}L${f(x + c + j())} ${f(y + j())}L${f(x + c + j())} ${f(y + c + j())}L${f(x + j())} ${f(y + c + j())}Z`;
}

/* --------------------------------- Les cases -------------------------------- */

interface Reserve {
  /** Les traits réservés (coton nu), les aplats et points réservés, le jaune resté. */
  trait: string;
  plein: string;
  jaune: string;
}

const vide = (): Reserve => ({ trait: "", plein: "", jaune: "" });

type Case = (x0: number, y0: number, x1: number, y1: number, rnd: Rnd, r: Reserve) => void;

/** Les cases : une géométrie élémentaire, jamais un motif nommé. */
const CASES: Case[] = [
  // Les rangs de points, en quinconce.
  (x0, y0, x1, y1, rnd, r) => {
    const pas = 17;
    for (let y = y0 + 14; y < y1 - 8; y += pas)
      for (let x = x0 + 14 + ((((y - y0) / pas) | 0) % 2) * (pas / 2); x < x1 - 8; x += pas) r.plein += point(x, y, 3.1, rnd);
  },
  // Les carrés emboîtés, le cœur jaune.
  (x0, y0, x1, y1, rnd, r) => {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const m = Math.min(x1 - x0, y1 - y0) / 2 - 12;
    for (let k = 0; k < 3; k++) {
      const e = m - k * (m / 3.2);
      r.trait += ligne([[cx - e, cy - e], [cx + e, cy - e], [cx + e, cy + e], [cx - e, cy + e], [cx - e, cy - e]], rnd, 2);
    }
    r.jaune += carre(cx - m / 4.4, cy - m / 4.4, m / 2.2, rnd);
  },
  // Les barreaux : des traits courts en travers, deux rangs, un point entre.
  (x0, y0, x1, y1, rnd, r) => {
    const n = 3;
    const h = (y1 - y0 - 12) / n;
    for (let k = 0; k < n; k++) {
      const a = y0 + 6 + k * h;
      for (let x = x0 + 14; x < x1 - 10; x += 12) r.trait += trait(x, a + 8, x, a + h - 8, rnd, 1.4);
      if (k > 0) r.plein += `M${f(x0 + 8)} ${f(a - 1.6)}H${f(x1 - 8)}V${f(a + 1.6)}H${f(x0 + 8)}Z`;
    }
  },
  // Le damier de petits carrés, un point au cœur des cases sombres.
  (x0, y0, x1, y1, rnd, r) => {
    const c = 22;
    const nx = Math.floor((x1 - x0 - 12) / c);
    const ny = Math.floor((y1 - y0 - 12) / c);
    const ox = x0 + (x1 - x0 - nx * c) / 2;
    const oy = y0 + (y1 - y0 - ny * c) / 2;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const x = ox + i * c;
        const y = oy + j * c;
        if ((i + j) % 2 === 0) r.plein += carre(x + 2, y + 2, c - 4, rnd);
        else r.plein += point(x + c / 2, y + c / 2, 2.6, rnd);
      }
  },
  // Les ronds à point central, en rangs.
  (x0, y0, x1, y1, rnd, r) => {
    const pas = 34;
    for (let y = y0 + 24; y < y1 - 16; y += pas)
      for (let x = x0 + 24; x < x1 - 16; x += pas) {
        const pts: Pt[] = [];
        for (let k = 0; k <= 10; k++) pts.push([x + 11 * Math.cos((k / 10) * Math.PI * 2), y + 11 * Math.sin((k / 10) * Math.PI * 2)]);
        r.trait += ligne(pts, rnd, 1.2);
        r.plein += point(x, y, 3, rnd);
      }
  },
  // Les peignes : des rangées de traits courts verticaux, alternés d'un rang au suivant.
  (x0, y0, x1, y1, rnd, r) => {
    let k = 0;
    for (let y = y0 + 12; y < y1 - 24; y += 26, k++) {
      r.trait += trait(x0 + 8, y, x1 - 8, y, rnd, 1.4);
      for (let x = x0 + 14 + (k % 2) * 7; x < x1 - 10; x += 14) r.trait += trait(x, y, x, y + 16, rnd, 1.2);
    }
  },
  // L'épi : des traits obliques, d'un sens puis de l'autre, colonne après colonne ; un jaune au pied.
  (x0, y0, x1, y1, rnd, r) => {
    const n = 3;
    const l = (x1 - x0 - 16) / n;
    for (let c = 0; c < n; c++) {
      const a = x0 + 8 + c * l;
      const s = c % 2 ? 1 : -1;
      for (let y = y0 + 12; y < y1 - 22; y += 13) r.trait += trait(a + 4, y + (s > 0 ? 0 : 10), a + l - 4, y + (s > 0 ? 10 : 0), rnd, 1.2);
    }
    r.jaune += `M${f(x0 + 10)} ${f(y1 - 14)}H${f(x1 - 10)}V${f(y1 - 8)}H${f(x0 + 10)}Z`;
  },
  // Les losanges en chaîne, au trait.
  (x0, y0, x1, y1, rnd, r) => {
    const cx = (x0 + x1) / 2;
    const h = 40;
    for (let y = y0 + 10; y + h <= y1 - 6; y += h) {
      const a = (x1 - x0) / 2 - 14;
      r.trait += ligne([[cx, y], [cx + a, y + h / 2], [cx, y + h], [cx - a, y + h / 2], [cx, y]], rnd, 1.6);
      r.plein += point(cx, y + h / 2, 3.4, rnd);
    }
  },
];

/* --------------------------------- La pièce -------------------------------- */

/** Le dos : les rangs de cases, en haut et en bas du champ de la lune (y). */
const PIECE = { champ: 166, bandeau: LOGOTYPE_DOS.cy - 96, bas: LOGOTYPE_DOS.cy + 92, fin: H - 182 };
/** Le médaillon de la lune, à l'échelle de LUNE_ML (346 pour une lune de 300). */
const KM = LUNE_ML.d / 300;
const KAASA = 150;
const BORD = 30;

function piece(graine: number) {
  return memo(`dos-${graine}`, () => {
    const rnd = alea(graine ^ 0x6d6c);
    const r = vide();
    let cadres = "";
    let coutures = "";
    let points = "";
    // Les coutures des bandes.
    for (let k = 1; k < BANDES; k++) {
      const x = k * LB;
      coutures += `M${f(x)} 0V${H}`;
      for (let y = 6; y < H; y += 15) points += trait(x - 3, y, x + 3, y + 5, rnd, 0.7);
    }
    // Chaque bande a son décalage : le pagne cousu ne retombe jamais tout à fait juste.
    const decal = Array.from({ length: BANDES }, () => (rnd() - 0.5) * 22);
    const ordre = Array.from({ length: CASES.length }, (_, i) => i);
    for (let i = ordre.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
    }
    let n = 0;
    const rangs: [number, number][] = [[PIECE.bas, PIECE.fin]];
    for (const [ya, yb] of rangs)
      for (let b = BORD > 0 ? 0 : 0; b < BANDES; b++) {
        const xa = b * LB + (b === 0 ? BORD : 6);
        const xb = (b + 1) * LB - (b === BANDES - 1 ? BORD : 6);
        const y0 = ya + decal[b];
        const y1 = yb + decal[b];
        cadres += ligne([[xa, y0], [xb, y0], [xb, y1], [xa, y1], [xa, y0]], rnd, 2.2);
        CASES[ordre[n++ % ordre.length]](xa + 4, y0 + 4, xb - 4, y1 - 4, rnd, r);
      }
    // Le champ : de la boue pleine, et sur chaque bande, des rangs de points, hors du médaillon de la lune.
    const { cx, cy } = LUNE_ML;
    for (let b = 0; b < BANDES; b++) {
      const xa = b * LB + (b === 0 ? BORD : 6);
      const xb = (b + 1) * LB - (b === BANDES - 1 ? BORD : 6);
      const y0 = PIECE.champ + 14 + decal[b];
      const y1 = PIECE.bandeau - 14 + decal[b];
      for (let y = y0 + 10; y < y1 - 6; y += 22)
        for (let x = xa + 10 + ((((y - y0) / 22) | 0) % 2) * 9; x < xb - 6; x += 18) {
          const d = Math.hypot(x - cx, y - cy);
          // hors du médaillon, et le champ uni autour de l'aigle (le totem)
          const p = point(x, y, 2.4, rnd);
          if (d > 392 * KM && !sousAigleML(x, y)) r.plein += p;
        }
    }
    // Les cernes du médaillon : deux traits, un rang de points, un peigne de rayons.
    const cercle = (rr: number) => {
      const pts: Pt[] = [];
      for (let k = 0; k <= 48; k++) pts.push([cx + rr * Math.cos((k / 48) * Math.PI * 2), cy + rr * Math.sin((k / 48) * Math.PI * 2)]);
      return ligne(pts, rnd, 2);
    };
    let medaillon = cercle(372 * KM) + cercle(352 * KM);
    let rond = "";
    const nr = Math.round(80 * KM);
    for (let k = 0; k < nr; k++) {
      const a = (k / nr) * Math.PI * 2;
      rond += point(cx + 384 * KM * Math.cos(a), cy + 384 * KM * Math.sin(a), 3.4, rnd);
      if (k % 2 === 0) medaillon += trait(cx + 356 * KM * Math.cos(a), cy + 356 * KM * Math.sin(a), cx + 368 * KM * Math.cos(a), cy + 368 * KM * Math.sin(a), rnd, 0.6);
    }
    // Le banco des bords : l'enduit, et les toron qui en sortent, réguliers, un peu inégaux.
    let toron = "";
    let toronOmbre = "";
    let lissage = "";
    for (let y = KAASA + 30; y < H - KAASA - 20; y += 62) {
      for (const x of [BORD / 2, W - BORD / 2]) {
        const yy = y + (rnd() - 0.5) * 6;
        const rr = 5.6 + rnd() * 1.6;
        // Le bout du pieu, vu de face, et son ombre qui tombe en biais sur l'enduit.
        toron += point(x, yy, rr, rnd);
        const lo = 14 + rnd() * 8;
        toronOmbre += `M${f(x - rr * 0.7)} ${f(yy + rr * 0.5)}L${f(x + rr)} ${f(yy)}L${f(x + rr * 0.6 + 4)} ${f(yy + lo)}L${f(x - rr * 0.2 + 2)} ${f(yy + lo * 0.8)}Z`;
      }
    }
    // L'enduit lissé à la main : des traînées verticales.
    for (const x0 of [3, W - BORD + 3])
      for (let k = 0; k < 7; k++) {
        const x = x0 + rnd() * (BORD - 6);
        const ya = KAASA + rnd() * (H - 2 * KAASA - 300);
        lissage += trait(x, ya, x + (rnd() - 0.5) * 3, ya + 120 + rnd() * 200, rnd, 1.5);
      }
    return { r, cadres, coutures, points, medaillon, rond, toron, toronOmbre, lissage, decal };
  });
}

/** Les bouts de laine (kaasa) : rayures de trame, un rang de losanges flottés, la lisière tressée. */
function kaasa(y0: number, sens: 1 | -1, rnd: Rnd) {
  let noir = "";
  let ocre = "";
  let flotte = "";
  let tresse = "";
  const L = W;
  // Les rayures, du bout vers le champ.
  const ry = (t: number) => (sens === 1 ? y0 + t : y0 - t);
  const raie = (t: number, h: number) => {
    const a = ry(t);
    const b = ry(t + h);
    return `M0 ${f(Math.min(a, b))}H${L}V${f(Math.max(a, b))}H0Z`;
  };
  noir += raie(14, 6) + raie(26, 3) + raie(KAASA - 30, 3) + raie(KAASA - 21, 7);
  ocre += raie(36, 4) + raie(KAASA - 40, 4);
  // Le rang de losanges flottés : chaque losange fait de flottés de trame horizontaux.
  const yc = ry(KAASA / 2 + 3);
  const pas = 46;
  for (let x = pas / 2; x < L; x += pas) {
    const a = 17;
    const b = 17;
    for (let t = -b + 2; t <= b - 2; t += 3.4) {
      const w = a * (1 - Math.abs(t) / b);
      if (w > 1.5) flotte += `M${f(x - w)} ${f(yc + t)}H${f(x + w)}`;
    }
    // Entre deux losanges : deux flottés courts en ocre.
    ocre += `M${f(x + pas / 2 - 4)} ${f(yc - 5)}h8v2.2h-8ZM${f(x + pas / 2 - 4)} ${f(yc + 3)}h8v2.2h-8Z`;
  }
  // La lisière tressée (sembiyaji) : une torsade au bout.
  const yt = ry(5);
  for (let x = 0; x < L; x += 7) tresse += `M${f(x)} ${f(yt - 4 * sens)}L${f(x + 6 + (rnd() - 0.5))} ${f(yt + 4 * sens)}`;
  return { noir, ocre, flotte, tresse, haut: Math.min(y0, ry(KAASA)), bas: Math.max(y0, ry(KAASA)) };
}

/** La face : la bordure réservée du portrait, les bandes et des cases à peine, sous le portrait. */
function face(graine: number) {
  return memo(`face-${graine}`, () => {
    const rnd = alea(graine ^ 0x6661);
    const bord = vide();
    const x0 = 9;
    const y0 = 9;
    const x1 = W - 9;
    const y1 = BANDE - 6;
    const ep = 30;
    const r = 84;
    const pourtour = (a: number, b: number, c: number, d: number, rr: number): Pt[] => {
      const pts: Pt[] = [];
      const coin = (cx: number, cy: number, a0: number) => {
        for (let k = 0; k <= 6; k++) pts.push([cx + rr * Math.cos(a0 + (k / 6) * (Math.PI / 2)), cy + rr * Math.sin(a0 + (k / 6) * (Math.PI / 2))]);
      };
      coin(c - rr, b + rr, -Math.PI / 2);
      coin(c - rr, d - rr, 0);
      coin(a + rr, d - rr, Math.PI / 2);
      coin(a + rr, b + rr, Math.PI);
      pts.push(pts[0]);
      return pts;
    };
    bord.trait += ligne(pourtour(x0, y0, x1, y1, r), rnd, 2) + ligne(pourtour(x0 + ep, y0 + ep, x1 - ep, y1 - ep, r - ep), rnd, 2);
    // Le long des côtés : trois points, puis un barreau de cinq traits, tour à tour.
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
      const nx = -uy;
      const ny = ux;
      // Deux rangs de petits carrés en damier ; tous les sept, un point jaune à la place.
      const c = 8.4;
      const n = Math.max(1, Math.floor(l / c));
      const q = l / n;
      for (let i = 0; i < n; i++) {
        const s = i * q + q / 2;
        for (const k of [-1, 1]) {
          if ((i + (k > 0 ? 1 : 0)) % 2) continue;
          const mx = ax + ux * s + nx * (ep / 2 + k * 4.6);
          const my = ay + uy * s + ny * (ep / 2 + k * 4.6);
          if (i % 14 === 7) bord.jaune += point(mx, my, 3.2, rnd);
          else bord.plein += carre(mx - 3.4, my - 3.4, 6.8, rnd);
        }
      }
    }
    // Aux coins : un carré réservé, le cœur jaune.
    const m = ep / 2;
    const c = (r - m) * (1 - Math.SQRT1_2) + m;
    for (const [x, y] of [[x0 + c, y0 + c], [x1 - c, y0 + c], [x1 - c, y1 - c], [x0 + c, y1 - c]] as Pt[]) {
      bord.plein += carre(x - 8, y - 8, 16, rnd);
      bord.jaune += point(x, y, 3.4, rnd);
    }
    // Sous le portrait : les bandes cousues, et une case sur deux, à peine.
    let coutures = "";
    let points = "";
    for (let k = 1; k < BANDES; k++) {
      const x = k * LB;
      coutures += `M${f(x)} ${BANDE}V${H}`;
      for (let y = BANDE + 6; y < H; y += 15) points += trait(x - 3, y, x + 3, y + 5, rnd, 0.7);
    }
    const champs = vide();
    let k = 0;
    for (let b = 0; b < BANDES; b++)
      for (let y = BANDE + 34 + (b % 2) * 140; y < H - 150; y += 280) {
        CASES[(b * 3 + k++) % CASES.length](b * LB + 10, y, (b + 1) * LB - 10, y + 160, rnd, champs);
      }
    return { bord, coutures, points, champs };
  });
}

/* --------------------------------- Le motif -------------------------------- */

function Coton({ id }: { id: string }) {
  return (
    <pattern id={id} width={5} height={5} patternUnits="userSpaceOnUse">
      <path d="M0 2.5H5" stroke="rgba(234,223,198,0.035)" strokeWidth={1.1} />
      <path d="M2.5 0V5" stroke="rgba(0,0,0,0.05)" strokeWidth={1} />
    </pattern>
  );
}

function Reserves({ r, force = 1 }: { r: Reserve; force?: number }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={r.jaune} fill={NGALLAMA} opacity={0.92 * force} />
      <path d={r.trait} stroke={COTON} strokeWidth={3.4} opacity={0.9 * force} />
      <path d={r.plein} fill={COTON} opacity={0.92 * force} />
    </g>
  );
}

/**
 * La terre : la boue reprise deux ou trois fois ne fonce pas égal (des nuées
 * plus sombres, d'autres où le coton remonte), le jaune de n'gallama reste par
 * endroits, et le fil filé main a ses grosseurs. Stable pour une même graine.
 */
function Terre({ graine, id, face }: { graine: number; id: string; face: boolean }) {
  const t = memo(`terre-${face ? "f" : "d"}-${graine}`, () => {
    const rnd = alea(graine ^ 0x7e77e);
    const y0 = face ? BANDE : 0;
    const nuees = Array.from({ length: face ? 4 : 8 }, (_, i) => ({ x: rnd() * W, y: y0 + rnd() * (H - y0), r: 110 + rnd() * 190, ton: i % 3 }));
    let fils = "";
    for (let i = 0, n = face ? 80 : 200; i < n; i++) fils += `M${f(rnd() * W)} ${f(y0 + rnd() * (H - y0))}h${f(5 + rnd() * 18)}`;
    return { nuees, fils };
  });
  const tons = [`tm-${id}`, `tc-${id}`, `tj-${id}`];
  return (
    <>
      <defs>
        <radialGradient id={tons[0]}>
          <stop offset="0" stopColor="#0d0907" stopOpacity={0.4} />
          <stop offset="1" stopColor="#0d0907" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={tons[1]}>
          <stop offset="0" stopColor="#6e5238" stopOpacity={0.28} />
          <stop offset="1" stopColor="#6e5238" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={tons[2]}>
          <stop offset="0" stopColor={NGALLAMA} stopOpacity={0.12} />
          <stop offset="1" stopColor={NGALLAMA} stopOpacity={0} />
        </radialGradient>
      </defs>
      {t.nuees.map((n, i) => (
        <ellipse key={i} cx={f(n.x)} cy={f(n.y)} rx={f(n.r)} ry={f(n.r * 0.75)} fill={`url(#${tons[n.ton]})`} />
      ))}
      <path d={t.fils} stroke="rgba(234,223,198,0.08)" strokeWidth={1.5} strokeLinecap="round" />
    </>
  );
}

function Bogolan({ cote, m, graine, id }: PropsMotifNation) {
  if (cote === "face") {
    const fc = face(graine);
    return (
      <>
        <defs>
          <Coton id={`bg-c-${id}`} />
        </defs>
        <Terre graine={graine} id={id} face />
        <rect width={W} height={H} fill={`url(#bg-c-${id})`} />
        <path d={fc.coutures} stroke={m.fonce} strokeWidth={2.4} />
        <path d={fc.points} stroke={COTON} strokeWidth={1.4} opacity={0.18} strokeLinecap="round" />
        <Reserves r={fc.champs} force={0.11} />
        <Reserves r={fc.bord} />
      </>
    );
  }

  const t = piece(graine);
  const rnd = alea(graine ^ 0x6b61);
  const k1 = kaasa(0, 1, rnd);
  const k2 = kaasa(H, -1, rnd);
  const { cx, cy } = LUNE_ML;
  return (
    <>
      <defs>
        <Coton id={`bg-c-${id}`} />
        <linearGradient id={`bg-b-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f6439" />
          <stop offset="0.45" stopColor={BANCO} />
          <stop offset="1" stopColor="#7d5532" />
        </linearGradient>
      </defs>
      <Terre graine={graine} id={id} face={false} />
      <rect width={W} height={H} fill={`url(#bg-c-${id})`} />
      <path d={t.coutures} stroke={m.fonce} strokeWidth={2.6} />
      <path d={t.points} stroke={COTON} strokeWidth={1.5} opacity={0.22} strokeLinecap="round" />
      <path d={t.cadres} stroke={COTON} strokeWidth={4} fill="none" opacity={0.9} strokeLinecap="round" />
      <Reserves r={t.r} />
      {/* Le médaillon de la lune : la boue pleine, deux cernes, le peigne, un rang de points. */}
      <circle cx={cx} cy={cy} r={346 * KM} fill={BOUE} />
      <circle cx={cx} cy={cy} r={346 * KM} fill={`url(#bg-c-${id})`} />
      <path d={t.medaillon} stroke={COTON} strokeWidth={3.6} fill="none" opacity={0.9} strokeLinecap="round" />
      <path d={t.rond} fill={NGALLAMA} opacity={0.95} />
      {/* Le bandeau du logotype : la boue pleine, entre deux traits. */}
      <rect x={BORD} y={PIECE.bandeau} width={W - 2 * BORD} height={PIECE.bas - PIECE.bandeau} fill={BOUE} />
      <path
        d={ligne([[BORD + 10, PIECE.bandeau + 10], [W - BORD - 10, PIECE.bandeau + 10]], rnd, 2) + ligne([[BORD + 10, PIECE.bas - 10], [W - BORD - 10, PIECE.bas - 10]], rnd, 2)}
        stroke={COTON}
        strokeWidth={3.4}
        fill="none"
        strokeLinecap="round"
        opacity={0.85}
      />
      {/* Les bouts de laine. */}
      {[k1, k2].map((k, i) => (
        <g key={i}>
          <rect x={0} y={k.haut} width={W} height={k.bas - k.haut} fill={LAINE} />
          <path d={k.noir} fill={NOIR} />
          <path d={k.ocre} fill={NGALLAMA} />
          <path d={k.flotte} stroke={NOIR} strokeWidth={2.2} />
          <path d={k.tresse} stroke={NOIR} strokeWidth={2.6} strokeLinecap="round" opacity={0.8} />
        </g>
      ))}
      {/* Le banco des bords et ses toron. */}
      {[0, W - BORD].map((x) => (
        <rect key={x} x={x} y={KAASA} width={BORD} height={H - 2 * KAASA} fill={`url(#bg-b-${id})`} />
      ))}
      <path d={`M${BORD} ${KAASA}V${H - KAASA}M${W - BORD} ${KAASA}V${H - KAASA}`} stroke="rgba(20,14,10,0.6)" strokeWidth={2} />
      <path d={t.lissage} stroke="rgba(255,236,206,0.14)" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d={t.toronOmbre} fill="rgba(40,24,12,0.3)" />
      <path d={t.toron} fill="#5e4027" />
      <path d={t.toron} fill="none" stroke="rgba(255,226,186,0.4)" strokeWidth={1.3} transform="translate(-1 -1.2)" />
    </>
  );
}

const mali: SkinNation = {
  nation: "ml",
  nom: "Bogolan",
  quoi: "Le coton peint à la boue des Bamana, la laine tissée des Peuls et la terre des murs de Djenné.",
  sources: [
    { titre: "Smarthistory : le bògòlanfini, coton tissé en bandes, bain de n'gallama, boue fermentée", url: "https://smarthistory.org/?p=72599" },
    { titre: "Bowers Museum : mud cloth (bogolanfini), Bamana, Mali", url: "https://collections.bowers.org/objects/144805/mud-cloth-bogolanfini" },
    { titre: "UNESCO, patrimoine mondial : villes anciennes de Djenné (1988)", url: "https://whc.unesco.org/en/list/116" },
    { titre: "CyArk : Djenné, le crépissage annuel au banco et les toron", url: "https://tapestry.cyark.org/content/djenne/about" },
    { titre: "British Museum : couverture kaasa des Peuls, bandes cousues, lisière tressée (sembiyaji)", url: "https://www.britishmuseum.org/collection/object/E_Af1990-12-1" },
    { titre: "Cleveland Museum of Art : couverture (kaasa), six bandes cousues", url: "https://www.clevelandart.org/art/2024.72" },
  ],
  dessine: true,
  matiere: {
    titre: "bogolan",
    encre: "236,226,204",
    sombre: true,
    // Le coton passé à la boue : brun-noir, une lumière de terre en haut, plus noir au pied.
    papier: [
      "radial-gradient(80% 44% at 30% 16%, rgba(120,88,58,0.38) 0%, rgba(120,88,58,0) 70%)",
      "repeating-linear-gradient(90deg, rgba(234,223,198,0.022) 0 1px, rgba(0,0,0,0) 1px 4px)",
      "repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0 1px, rgba(0,0,0,0) 1px 3px)",
      "linear-gradient(165deg, #33271c 0%, #271e16 52%, #1b140f 100%)",
    ].join(", "),
    motif: { clair: "rgba(234,223,198,0.3)", fonce: "rgba(234,223,198,0.16)" },
    fond: "rgba(38,29,21,0.94)",
    lueur: "rgba(234,223,198,0.35)",
    rayures: 0.04,
    micro: 0.05,
    reflet: 0.2,
    coins: 0.6,
    etiquette: { fond: "rgba(234,223,198,0.08)", bord: "rgba(234,223,198,0.55)", texte: COTON },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(234,223,198,0.3)", ombre: "rgba(0,0,0,0.55)" },
    puce: "linear-gradient(135deg, #f2ebdc, #b9a684 45%, #e4d8bf 70%, #8f7a58)",
    // La carte photo : la boue, des barreaux réservés.
    cadre: [
      "repeating-linear-gradient(90deg, rgba(234,223,198,0.6) 0 2px, rgba(0,0,0,0) 2px 7px)",
      "linear-gradient(160deg, #33271c 0%, #1b140f 100%)",
    ].join(", "),
    voile: "rgba(20,15,11,0.62)",
    onglet: { fond: COTON, encre: BOUE },
    vive: NGALLAMA,
    dos: { micro: 0.03 },
    // La 3D : une tranche de banco, mate ; un reflet faible, de terre.
    tranche: { couleur: "#8f6740", metal: 0, rugosite: 0.95 },
    holo: { force: 0.14, teinte: [1, 0.93, 0.84] },
  },
  Motif: Bogolan,
};

export default mali;
