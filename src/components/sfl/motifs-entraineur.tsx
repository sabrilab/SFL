"use client";

// Les motifs de la carte d'entraîneur (skins-entraineur.ts), que dessine
// motif-carte.tsx comme les autres : du SVG dans le repère de la carte
// (1024 × 1656), étiré sur toute la carte, sans image, sans flou ni filtre
// (la capture de la 3D le prend tel quel).
//   · tableau-craie : le schéma de la mi-temps à la craie, sur la face (le
//     terrain de five, nos ronds, leurs croix, la passe, la course, le
//     tir), et les passes de brosse mal effacées ; au dos, le rond central
//     autour de la lune (le ballon posé pour le coup d'envoi). Chaque trait
//     est fait de quelques brins de craie interrompus, tirés de la graine :
//     le même tableau pour un entraîneur, un autre pour le suivant ;
//   · carnet-carreaux : les petits carreaux de 5 mm, la spirale (ses trous
//     et son fil) et la ligne de prédécoupe, en haut, face et dos ;
//   · survetement-maille : la maille en V du tissu, gravée ton sur ton, et
//     le liseré cousu le long des deux bords, face et dos ; au dos, la
//     glissière qui descend du col, son curseur et sa tirette.

import { Fragment, useId } from "react";
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
 * au-dessus de la puce. Rien ne descend sur la bande du nom et de la note.
 */
const DEMI = { x0: 120, x1: 904, but: 168, mediane: 836, zone: 190, rond: 130 } as const;

function demiTerrain(): Trait[] {
  const { x0, x1, but, mediane, zone, rond: r } = DEMI;
  const cx = W / 2;
  const f2 = 0.6;
  return [
    { pts: [[x0, mediane], [x0, but], [x1, but], [x1, mediane]], force: f2 },
    { pts: [[x0, mediane], [x1, mediane]], force: f2 },
    { pts: arc(cx, but, zone, 0, 180), force: f2 },
    { pts: arc(cx, mediane, r, 180, 360), force: f2 },
    { pts: [[cx - 58, but], [cx - 58, but - 34], [cx + 58, but - 34], [cx + 58, but]], force: 0.5 },
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
        { d: "M10 1240 Q520 1390 1014 1170", l: 130, o: 0.12 },
        { d: "M380 1606 Q700 1506 1014 1526", l: 70, o: 0.1 },
        { d: "M20 120 Q500 20 1004 250", l: 110, o: 0.1 },
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

function Tableau({ m, graine, dos }: { m: Couleurs; graine: number; dos: boolean }) {
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
    : [...demiTerrain(), ...schema()];
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

function Carnet({ motif, id, dos }: { motif: Extract<MotifEntraineur, { type: "carnet-carreaux" }> & Couleurs; id: string; dos: boolean }) {
  // La spirale : ses trous dans la marge du haut, son fil qui passe par-dessus le bord ; la prédécoupe dessous.
  const haut = dos ? 66 : 22;
  const trou = dos ? { l: 22, h: 30 } : { l: 15, h: 19 };
  const pas = dos ? 54 : 48;
  const n = Math.floor((W - 260) / pas) + 1;
  const debut = (W - (n - 1) * pas) / 2;
  const trous = Array.from({ length: n }, (_, i) => debut + i * pas);
  const decoupe = dos ? 112 : 36;
  return (
    <>
      <defs>
        <pattern id={`car-${id}`} width={CARREAU} height={CARREAU} patternUnits="userSpaceOnUse" x={W / 2} y={decoupe + 6}>
          <path d={`M0 0H${CARREAU}M0 0V${CARREAU}`} fill="none" stroke={motif.grille} strokeWidth={2} />
        </pattern>
        <linearGradient id={`fil-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6d7176" />
          <stop offset="0.45" stopColor="#ffffff" />
          <stop offset="1" stopColor={motif.spirale} />
        </linearGradient>
      </defs>
      <rect x={0} y={decoupe + 6} width={W} height={H - decoupe - 6} fill={`url(#car-${id})`} />
      {/* La prédécoupe : une ligne de petits trous, comme celle qui détache la page. */}
      <line x1={0} y1={decoupe} x2={W} y2={decoupe} stroke={motif.fonce} strokeWidth={2.2} strokeDasharray="3 7" opacity={0.55} />
      {trous.map((x) => (
        <g key={x}>
          {/* Le trou, son bord éclairé en bas. */}
          <rect x={x - trou.l / 2} y={haut - trou.h / 2} width={trou.l} height={trou.h} rx={trou.l / 2} fill="rgba(20,20,24,0.62)" />
          <rect x={x - trou.l / 2} y={haut - trou.h / 2 + 2} width={trou.l} height={trou.h} rx={trou.l / 2} fill="none" stroke={motif.clair} strokeWidth={1.4} />
          {/* Le fil : du trou jusqu'au bord, en biais, son ombre sur la page. */}
          <path d={`M${x - 2} ${haut + 2}L${x + trou.l * 0.55} ${-6}`} stroke="rgba(0,0,0,0.22)" strokeWidth={trou.l * 0.5} strokeLinecap="round" transform="translate(3 3)" />
          <path d={`M${x - 2} ${haut + 2}L${x + trou.l * 0.55} ${-6}`} stroke={`url(#fil-${id})`} strokeWidth={trou.l * 0.42} strokeLinecap="round" />
        </g>
      ))}
    </>
  );
}

/* ---------------------------- Le survêtement ----------------------------- */

/** La maille : une colonne de V par 14, un rang par 10, gravée (l'arête décalée de 2). */
const MAILLE = { l: 14, h: 10 } as const;

/**
 * La fermeture du dos : la glissière qui descend du col jusqu'au-dessus de la
 * rosace, ses dents en quinconce, le curseur et sa tirette.
 */
function Glissiere({ couleur, id }: { couleur: string; id: string }) {
  const cx = W / 2;
  const fin = 300;
  const dents = Array.from({ length: Math.floor(fin / 9) }, (_, i) => 4 + i * 9);
  return (
    <>
      <defs>
        <linearGradient id={`cur-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8e8790" />
          <stop offset="0.45" stopColor={couleur} />
          <stop offset="1" stopColor="#6f6871" />
        </linearGradient>
      </defs>
      <rect x={cx - 24} y={0} width={48} height={fin + 8} fill="rgba(0,0,0,0.2)" />
      {dents.map((y) => (
        <Fragment key={y}>
          <rect x={cx - 12} y={y + 1.5} width={12} height={5.5} rx={2} fill="rgba(0,0,0,0.35)" transform="translate(1.5 0)" />
          <rect x={cx - 12} y={y} width={12} height={5.5} rx={2} fill={couleur} opacity={0.9} />
          <rect x={cx} y={y + 6} width={12} height={5.5} rx={2} fill="rgba(0,0,0,0.35)" transform="translate(1.5 0)" />
          <rect x={cx} y={y + 4.5} width={12} height={5.5} rx={2} fill={couleur} opacity={0.9} />
        </Fragment>
      ))}
      {/* Le curseur, puis la tirette qui pend. */}
      <path d={`M${cx - 21} ${fin - 6}L${cx + 21} ${fin - 6}L${cx + 15} ${fin + 46}L${cx - 15} ${fin + 46}Z`} fill="rgba(0,0,0,0.4)" transform="translate(3 3)" />
      <path d={`M${cx - 21} ${fin - 6}L${cx + 21} ${fin - 6}L${cx + 15} ${fin + 46}L${cx - 15} ${fin + 46}Z`} fill={`url(#cur-${id})`} />
      <rect x={cx - 9} y={fin + 34} width={18} height={50} rx={9} fill="rgba(0,0,0,0.4)" transform="translate(3 3)" />
      <rect x={cx - 9} y={fin + 34} width={18} height={50} rx={9} fill={`url(#cur-${id})`} />
      <rect x={cx - 3.5} y={fin + 56} width={7} height={18} rx={3.5} fill="rgba(0,0,0,0.45)" />
    </>
  );
}

function Survetement({ motif, id, dos }: { motif: Extract<MotifEntraineur, { type: "survetement-maille" }> & Couleurs; id: string; dos: boolean }) {
  const v = `M0 1L${MAILLE.l / 2} ${MAILLE.h - 1}L${MAILLE.l} 1`;
  // Le liseré : une bande et un filet, le long des deux bords ; la couture en points juste à côté.
  // Tout tient dans la marge de 41 : la note, le nom et les stats s'arrêtent à 41 du bord.
  const bandes = [
    { x: 5, l: 12 },
    { x: 21, l: 3.5 },
  ];
  const cote = (x: number, l: number) => [x, W - x - l];
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
      {bandes.flatMap((b) =>
        cote(b.x, b.l).map((x) => (
          <Fragment key={`${b.x}-${x}`}>
            <rect x={x + 1.5} y={0} width={b.l} height={H} fill="rgba(0,0,0,0.35)" />
            <rect x={x} y={0} width={b.l} height={H} fill={motif.lisere} />
          </Fragment>
        ))
      )}
      {[30, W - 30].map((x) => (
        <line key={x} x1={x} y1={0} x2={x} y2={H} stroke={motif.lisere} strokeWidth={1.6} strokeDasharray="7 6" opacity={0.55} />
      ))}
      {dos && <Glissiere couleur={motif.lisere} id={id} />}
    </>
  );
}

export function MotifEntraineurSvg({ motif, graine = 1, dos = false }: { motif: MotifEntraineur & Couleurs; graine?: number; dos?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const style: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };
  const m = { clair: motif.clair, fonce: motif.fonce };
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
      {motif.type === "tableau-craie" ? (
        <Tableau m={m} graine={graine} dos={dos} />
      ) : motif.type === "carnet-carreaux" ? (
        <Carnet motif={motif} id={id} dos={dos} />
      ) : (
        <Survetement motif={motif} id={id} dos={dos} />
      )}
    </svg>
  );
}
