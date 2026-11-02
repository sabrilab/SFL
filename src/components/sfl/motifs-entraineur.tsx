"use client";

// Les motifs de la carte d'entraîneur (skins-entraineur.ts), que dessine
// motif-carte.tsx comme les autres : du SVG dans le repère de la carte
// (1024 × 1656), étiré sur toute la carte, sans image, sans flou ni filtre
// (la capture de la 3D le prend tel quel).
//   · tableau-craie : sur la face, le schéma de la mi-temps à la craie dans
//     le portrait (le terrain de five, nos ronds, leurs croix, la passe, la
//     course, le tir : il se lit quand il n'y a pas de photo), et, photo ou
//     pas, le rond central derrière la note, la ligne médiane de part et
//     d'autre, et les passes de brosse mal effacées ; au dos, le rond central
//     autour de la lune (le ballon posé pour le coup d'envoi). Chaque trait
//     est fait de quelques brins de craie interrompus, tirés de la graine :
//     le même tableau pour un entraîneur, un autre pour le suivant ;
//   · carnet-carreaux : les petits carreaux de 5 mm et la ligne de
//     prédécoupe en haut, face et dos (plus de spirale peinte) ;
//   · survetement-maille : la maille en V du tissu, gravée ton sur ton, et
//     un seul liseré qui fait le tour de la carte en suivant ses coins.

import { useId } from "react";
import type { MotifEntraineur } from "@/components/sfl/skins-entraineur";

const W = 1024;
const H = 1656;

type Couleurs = { clair: string; fonce: string };
type P = readonly [number, number];

const f = (n: number) => Math.round(n * 10) / 10;

/** Un générateur pseudo-aléatoire stable (xorshift). */
function alea(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/* ------------------------------- La craie -------------------------------- */

/** Un tracé à main levée : la ligne redécoupée tous les ~22, chaque point un peu à côté. */
function aMainLevee(points: P[], rnd: () => number, tremble = 1.6): P[] {
  const out: P[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 22));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([x0 + (x1 - x0) * t + (rnd() - 0.5) * tremble, y0 + (y1 - y0) * t + (rnd() - 0.5) * tremble]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

const chemin = (pts: P[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("");

/** Un cercle (ou un arc, de a0 à a1 en degrés) en points : un point tous les ~16, jamais moins de 28 pour un tour. */
function arc(cx: number, cy: number, r: number, a0 = 0, a1 = 360): P[] {
  const part = Math.abs(a1 - a0) / 360;
  const n = Math.max(Math.ceil(28 * part), Math.round((part * 2 * Math.PI * r) / 16));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as P;
  });
}

/** Une courbe de Bézier (la course, la passe) en points. */
function courbe(a: P, c: P, b: P, n = 24): P[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as P;
  });
}

/**
 * Les pointillés d'un brin, comme la craie qui accroche le grain du tableau :
 * le brin du milieu presque plein (des manques d'un ou deux), les brins du
 * bord plus hachés.
 */
function pointilles(rnd: () => number, brin: number): string {
  const v: number[] = [];
  for (let i = 0; i < 24; i++) {
    if (brin === 0) v.push(6 + rnd() * 22, 0.8 + rnd() * 1.8);
    else if (brin === 1) v.push(8 + rnd() * 30, 2.5 + rnd() * 8);
    else v.push(3 + rnd() * 14, 4 + rnd() * 12);
  }
  return v.map(f).join(" ");
}

interface Trait {
  pts: P[];
  /** La force du trait (0 à 1), et des tirets (une passe) au lieu d'un trait plein. */
  force?: number;
  tirets?: boolean;
}

/** Un trait de craie tout tracé : son chemin à main levée, les pointillés de ses trois brins. */
interface TraitTrace {
  d: string;
  force: number;
  tirets: boolean;
  brins: string[];
}

/** On tire tout de la graine avant de dessiner : le même tableau à chaque rendu. */
function tracer(t: Trait, rnd: () => number): TraitTrace {
  const d = chemin(aMainLevee(t.pts, rnd));
  return { d, force: t.force ?? 1, tirets: !!t.tirets, brins: [0, 1, 2].map((i) => pointilles(rnd, i)) };
}

const BRINS = [
  { dx: 0, dy: 0, l: 4.2, o: 0.9 },
  { dx: 1.6, dy: -1.2, l: 2.6, o: 0.65 },
  { dx: -1.4, dy: 1.5, l: 2, o: 0.5 },
] as const;

/**
 * Un trait de craie : un voile de poussière, puis trois brins décalés et
 * interrompus. Pas d'ombre : la craie est posée sur le tableau, pas gravée.
 */
function TraitCraie({ t, m }: { t: TraitTrace; m: Couleurs }) {
  const tirets = "30 24";
  return (
    <g opacity={t.force}>
      <path d={t.d} fill="none" stroke={m.clair} strokeWidth={13} strokeLinecap="round" opacity={0.1} strokeDasharray={t.tirets ? tirets : undefined} />
      {BRINS.map((b, i) => (
        <path
          key={i}
          d={t.d}
          transform={`translate(${b.dx} ${b.dy})`}
          fill="none"
          stroke={m.clair}
          strokeWidth={b.l}
          strokeLinecap="round"
          opacity={b.o}
          strokeDasharray={t.tirets ? tirets : t.brins[i]}
        />
      ))}
    </g>
  );
}

/** La pointe d'une flèche au bout d'une course : deux petits traits. */
function pointe(pts: P[], l = 34, ouverture = 26): Trait[] {
  const [x1, y1] = pts[pts.length - 1];
  const [x0, y0] = pts[Math.max(0, pts.length - 3)];
  const a = Math.atan2(y1 - y0, x1 - x0);
  return [-1, 1].map((s) => {
    const b = a + Math.PI + (s * ouverture * Math.PI) / 180;
    return { pts: [[x1 + l * Math.cos(b), y1 + l * Math.sin(b)], [x1, y1]] as P[] };
  });
}

const rond = (x: number, y: number, r = 25, debut = 0): Trait => ({ pts: arc(x, y, r, debut, debut + 336) });
const croix = (x: number, y: number, c = 19): Trait[] => [
  { pts: [[x - c, y - c], [x + c, y + c]] },
  { pts: [[x + c, y - c + 3], [x - c + 2, y + c]] },
];

/**
 * La moitié de terrain qu'on attaque, dans la fenêtre du portrait (41 à
 * 983) : la ligne de but en haut, sous l'étiquette, la ligne médiane en bas,
 * au-dessus de la puce. Le rond central n'y est pas : il est dessiné autour
 * de la note (ROND), où on le voit aussi avec une photo.
 */
const DEMI = { x0: 120, x1: 904, but: 168, mediane: 836, zone: 190 } as const;

function demiTerrain(): Trait[] {
  const { x0, x1, but, mediane, zone } = DEMI;
  const cx = W / 2;
  const f2 = 0.6;
  return [
    { pts: [[x0, mediane], [x0, but], [x1, but], [x1, mediane]], force: f2 },
    { pts: [[x0, mediane], [x1, mediane]], force: f2 },
    { pts: arc(cx, but, zone, 0, 180), force: f2 },
    { pts: [[cx - 58, but], [cx - 58, but - 34], [cx + 58, but - 34], [cx + 58, but]], force: 0.5 },
  ];
}

/**
 * Le rond central derrière la note (la carte complète : la note est à
 * gauche de la bande, de 1101 à ~1450 ; la colonne du nom et des chiffres
 * commence à 622) : la note posée au centre du terrain, comme la lune au dos.
 * La ligne médiane de part et d'autre, sans entrer dans la colonne des chiffres.
 */
const ROND = { cx: 318, cy: 1322, r: 196, gauche: 44, droite: 596 } as const;
/** La carte réduite centre sa note sur toute la largeur : le rond la suit. */
const ROND_CENTRE = { cx: 512, cy: 1300, r: 206, gauche: 44, droite: 980 } as const;

function rondCentral(centree = false): Trait[] {
  const { cx, cy, r, gauche, droite } = centree ? ROND_CENTRE : ROND;
  return [
    { pts: arc(cx, cy, r, -96, 250), force: 0.55 },
    { pts: [[gauche, cy], [cx - r - 14, cy]], force: 0.5 },
    { pts: [[cx + r + 14, cy], [droite, cy]], force: 0.5 },
  ];
}

/** Le schéma de la mi-temps : leurs croix, nos ronds, la passe en tirets, la course, le relais, le tir au but. */
function schema(): Trait[] {
  const passe: P[] = [[496, 764], [324, 684]];
  const course = courbe([292, 640], [204, 496], [354, 300]);
  const relais: P[] = [[722, 640], [654, 498]];
  const tir = courbe([640, 446], [610, 292], [542, 186]);
  return [
    ...croix(512, 214),
    ...croix(356, 404),
    ...croix(668, 394),
    ...croix(448, 592),
    ...croix(624, 606),
    rond(512, 790, 25, 70),
    rond(300, 664, 25, 40),
    rond(724, 664, 25, 200),
    rond(394, 470, 25, 120),
    rond(640, 470, 25, 300),
    { pts: passe, tirets: true },
    ...pointe(passe, 28),
    { pts: course },
    ...pointe(course),
    { pts: relais, tirets: true },
    ...pointe(relais, 28),
    { pts: tir },
    ...pointe(tir),
  ];
}

/** Une passe de brosse : une bande de traînées fines, inégales, là où la craie n'est pas partie. */
function passeBrosse(d: string, largeur: number, force: number, rnd: () => number) {
  const n = 11;
  return Array.from({ length: n }, (_, i) => ({
    d,
    dy: (i / (n - 1) - 0.5) * largeur,
    l: 3 + rnd() * 9,
    o: force * (0.35 + rnd() * 0.9) * (1 - Math.abs(i / (n - 1) - 0.5) * 0.9),
  }));
}

function Brosse({ m, dos, rnd }: { m: Couleurs; dos: boolean; rnd: () => number }) {
  const passes = dos
    ? [
        { d: "M10 270 Q520 110 1014 300", l: 130, o: 0.12 },
        { d: "M10 1490 Q520 1380 1014 1560", l: 140, o: 0.12 },
      ]
    : [
        // Sous la note, à gauche de la bande : là où la photo ne cache rien et où il n'y a pas de chiffres.
        { d: "M6 1186 Q300 1120 640 1210", l: 120, o: 0.2 },
        { d: "M6 1560 Q300 1500 600 1585", l: 80, o: 0.18 },
        { d: "M20 120 Q500 20 1004 250", l: 110, o: 0.14 },
      ];
  const traits = passes.flatMap((p) => passeBrosse(p.d, p.l, p.o, rnd));
  return (
    <>
      {traits.map((t, i) => (
        <path key={i} d={t.d} transform={`translate(0 ${f(t.dy)})`} fill="none" stroke={m.clair} strokeWidth={f(t.l)} strokeLinecap="round" opacity={f(t.o * 100) / 100} />
      ))}
    </>
  );
}

function Tableau({ m, graine, dos, noteCentree }: { m: Couleurs; graine: number; dos: boolean; noteCentree?: boolean }) {
  const rnd = alea(graine ^ 0x6c1b3a57);
  // Au dos, la lune est le ballon posé au centre : le rond central autour de sa rosace, la ligne médiane de part et d'autre, les quatre coins.
  const traits: Trait[] = dos
    ? [
        { pts: arc(512, 738, 392), force: 0.7 },
        { pts: [[54, 738], [118, 738]], force: 0.7 },
        { pts: [[906, 738], [970, 738]], force: 0.7 },
        { pts: arc(54, 54, 46, 0, 90), force: 0.6 },
        { pts: arc(970, 54, 46, 90, 180), force: 0.6 },
        { pts: arc(54, 1602, 46, 270, 360), force: 0.6 },
        { pts: arc(970, 1602, 46, 180, 270), force: 0.6 },
      ]
    : [...demiTerrain(), ...schema(), ...rondCentral(noteCentree)];
  const traces = traits.map((t) => tracer(t, rnd));
  return (
    <>
      <Brosse m={m} dos={dos} rnd={rnd} />
      {traces.map((t, i) => (
        <TraitCraie key={i} t={t} m={m} />
      ))}
    </>
  );
}

/* ------------------------------ Le carnet -------------------------------- */

/** Les petits carreaux : 5 mm, soit 81 dans le repère (la carte fait 63 mm de large). */
const CARREAU = 81;

/** La page : ses carreaux, et la ligne de prédécoupe en haut (plus de spirale peinte : la 3D ne la suivait pas). */
function Carnet({ motif, id, dos }: { motif: Extract<MotifEntraineur, { type: "carnet-carreaux" }> & Couleurs; id: string; dos: boolean }) {
  const decoupe = dos ? 64 : 30;
  return (
    <>
      <defs>
        <pattern id={`car-${id}`} width={CARREAU} height={CARREAU} patternUnits="userSpaceOnUse" x={W / 2} y={decoupe + 6}>
          <path d={`M0 0H${CARREAU}M0 0V${CARREAU}`} fill="none" stroke={motif.grille} strokeWidth={2} />
        </pattern>
      </defs>
      <rect x={0} y={decoupe + 6} width={W} height={H - decoupe - 6} fill={`url(#car-${id})`} />
      {/* La prédécoupe : une ligne de petits trous, comme celle qui détache la page. */}
      <line x1={0} y1={decoupe} x2={W} y2={decoupe} stroke={motif.fonce} strokeWidth={2.2} strokeDasharray="3 7" opacity={0.55} />
    </>
  );
}

/* ---------------------------- Le survêtement ----------------------------- */

/** La maille : une colonne de V par 14, un rang par 10, gravée (l'arête décalée de 2). */
const MAILLE = { l: 14, h: 10 } as const;

/** Le rayon des coins de la carte (finitions-carte.ts, RAYON_CARTE = 1024 ÷ φ⁵). */
const RAYON = 1024 / ((1 + Math.sqrt(5)) / 2) ** 5;

/**
 * La maille, et un seul liseré qui fait le tour de la carte à 9 du bord, en
 * suivant ses coins (il n'est plus coupé par l'arrondi) : un passepoil, son
 * ombre, et rien d'autre. Il passe hors de la ligne de série (rentrée de 57,
 * bas à 1640) et des repères du portrait.
 */
function Survetement({ motif, id }: { motif: Extract<MotifEntraineur, { type: "survetement-maille" }> & Couleurs; id: string }) {
  const v = `M0 1L${MAILLE.l / 2} ${MAILLE.h - 1}L${MAILLE.l} 1`;
  const retrait = 9;
  const epaisseur = 6;
  const bord = { x: retrait, y: retrait, w: W - retrait * 2, h: H - retrait * 2, r: RAYON - retrait };
  return (
    <>
      <defs>
        <pattern id={`mai-o-${id}`} width={MAILLE.l} height={MAILLE.h} patternUnits="userSpaceOnUse" x={W / 2 + 2} y={2}>
          <path d={v} fill="none" stroke={motif.fonce} strokeWidth={1.6} />
        </pattern>
        <pattern id={`mai-c-${id}`} width={MAILLE.l} height={MAILLE.h} patternUnits="userSpaceOnUse" x={W / 2} y={0}>
          <path d={v} fill="none" stroke={motif.clair} strokeWidth={1.2} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#mai-o-${id})`} />
      <rect width={W} height={H} fill={`url(#mai-c-${id})`} />
      <rect {...{ x: bord.x + 1.5, y: bord.y + 2, width: bord.w, height: bord.h, rx: bord.r }} fill="none" stroke="rgba(0,0,0,0.38)" strokeWidth={epaisseur} />
      <rect {...{ x: bord.x, y: bord.y, width: bord.w, height: bord.h, rx: bord.r }} fill="none" stroke={motif.lisere} strokeWidth={epaisseur} />
    </>
  );
}

export function MotifEntraineurSvg({
  motif,
  graine = 1,
  dos = false,
  noteCentree,
}: {
  motif: MotifEntraineur & Couleurs;
  graine?: number;
  dos?: boolean;
  noteCentree?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const style: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };
  const m = { clair: motif.clair, fonce: motif.fonce };
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
      {motif.type === "tableau-craie" ? (
        <Tableau m={m} graine={graine} dos={dos} noteCentree={noteCentree} />
      ) : motif.type === "carnet-carreaux" ? (
        <Carnet motif={motif} id={id} dos={dos} />
      ) : (
        <Survetement motif={motif} id={id} />
      )}
    </svg>
  );
}
