"use client";

// Les motifs de la carte d'entraîneur (skins-entraineur.ts, troisième
// version), que dessine motif-carte.tsx comme les autres : du SVG dans le
// repère de la carte (1024 × 1656), étiré sur toute la carte, sans image,
// sans flou ni filtre (la capture de la 3D le prend tel quel). Chaque
// matière se fait en couches, et dessine son dos elle-même, la lune et le
// logotype compris (Matiere.dos.logo = false) :
//   · tableau-craie : le grain du tableau ; les schémas des causeries
//     d'avant, mal effacés ; les passes de brosse ; la poussière au pied ;
//     sans photo, le schéma de la mi-temps dans le portrait ; photo ou pas,
//     le rond central autour de la note et la ligne médiane. Au dos, le rond
//     central autour de la lune, la lune et BOLA à la craie. Chaque trait est
//     fait de brins de craie interrompus, tirés de la graine ;
//   · banc-matelasse : les boudins de la doudoune de banc, chacun en relief
//     (la lumière sur le haut, l'ombre dans la couture), les coutures et
//     leurs fronces, la piqûre qui fait le tour ; au dos, la lune et BOLA
//     brodés au passé plat ;
//   · carnet-cuir : le grain du cuir, la piqûre de la couverture,
//     l'élastique ivoire en travers, entre le portrait et la bande ; au dos,
//     la lune et BOLA gaufrés à sec, et l'élastique.
// En petit, les traits s'épaississent (`epaisseur`) : le rond de craie se lit
// encore à 78 px autour de la note.

import { useId } from "react";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import type { MotifEntraineur } from "@/components/sfl/skins-entraineur";

const W = 1024;
const H = 1656;

type Couleurs = { clair: string; fonce: string };
/** La craie franche (les lettres et la lune du dos). */
type Craie = Couleurs & { craie: string };
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

/* ------------------------- La lune et le logotype ------------------------ */

// Comme dos-carte.tsx : la lune au centre de la rosace, le logotype dessous.
const DOS = { cx: 512, cy: 738, lune: 300, logo: { cy: 1222, h: 104 } } as const;
const BOITE_SYMBOLE = { x: 17, y: 103.485, c: 112.373 };
const BOITE_LOGOTYPE = { x: 150.41, y: 32.445, l: 783.3, h: 183.7 };
const sLune = DOS.lune / BOITE_SYMBOLE.c;
const sLogo = DOS.logo.h / BOITE_LOGOTYPE.h;
const LUNE_T = `translate(${f(DOS.cx - (BOITE_SYMBOLE.x + BOITE_SYMBOLE.c / 2) * sLune)} ${f(DOS.cy - (BOITE_SYMBOLE.y + BOITE_SYMBOLE.c / 2) * sLune)}) scale(${f(sLune * 1000) / 1000})`;
const LOGO_T = `translate(${f(W / 2 - (BOITE_LOGOTYPE.x + BOITE_LOGOTYPE.l / 2) * sLogo)} ${f(DOS.logo.cy - (BOITE_LOGOTYPE.y + BOITE_LOGOTYPE.h / 2) * sLogo)}) scale(${f(sLogo * 1000) / 1000})`;

/** La lune et le logotype, comme formes (pour un clipPath ou un remplissage). */
function Marque({ ...props }: React.SVGProps<SVGPathElement>) {
  return (
    <>
      <path d={LOGO_BOLA.symbole} fillRule="evenodd" transform={LUNE_T} {...props} />
      <path d={LOGO_BOLA.logotype} fillRule="evenodd" transform={LOGO_T} {...props} />
    </>
  );
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

/** Un cercle (ou un arc, de a0 à a1 en degrés) en points. */
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

/** Les pointillés d'un brin, comme la craie qui accroche le grain du tableau. */
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

/** Un trait de craie : un voile de poussière, puis trois brins décalés et interrompus. */
function TraitCraie({ t, m, k = 1 }: { t: TraitTrace; m: Couleurs; k?: number }) {
  const tirets = "30 24";
  return (
    <g opacity={t.force}>
      <path d={t.d} fill="none" stroke={m.clair} strokeWidth={13 * k} strokeLinecap="round" opacity={0.1} strokeDasharray={t.tirets ? tirets : undefined} />
      {BRINS.map((b, i) => (
        <path
          key={i}
          d={t.d}
          transform={`translate(${b.dx * k} ${b.dy * k})`}
          fill="none"
          stroke={m.clair}
          strokeWidth={b.l * k}
          strokeLinecap="round"
          opacity={b.o}
          strokeDasharray={t.tirets ? tirets : k > 1.5 ? undefined : t.brins[i]}
        />
      ))}
    </g>
  );
}

/** La pointe d'une flèche au bout d'une course : deux petits traits. */
function pointe(pts: P[], l = 34, ouverture = 26, force = 1): Trait[] {
  const [x1, y1] = pts[pts.length - 1];
  const [x0, y0] = pts[Math.max(0, pts.length - 3)];
  const a = Math.atan2(y1 - y0, x1 - x0);
  return [-1, 1].map((s) => {
    const b = a + Math.PI + (s * ouverture * Math.PI) / 180;
    return { pts: [[x1 + l * Math.cos(b), y1 + l * Math.sin(b)], [x1, y1]] as P[], force };
  });
}

const rond = (x: number, y: number, r = 25, debut = 0, force = 1): Trait => ({ pts: arc(x, y, r, debut, debut + 336), force });
const croix = (x: number, y: number, c = 19, force = 1): Trait[] => [
  { pts: [[x - c, y - c], [x + c, y + c]], force },
  { pts: [[x + c, y - c + 3], [x - c + 2, y + c]], force },
];

/** La moitié de terrain qu'on attaque, dans la fenêtre du portrait (41 à 983). */
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
 * gauche de la bande, la colonne du nom et des chiffres commence à 622 ; la
 * réduite centre sa note) : la note posée au centre du terrain, comme la
 * lune au dos. La ligne médiane de part et d'autre.
 */
const ROND = { cx: 318, cy: 1326, r: 196, gauche: 44, droite: 596 } as const;
const ROND_CENTRE = { cx: 512, cy: 1300, r: 214, gauche: 30, droite: 994 } as const;

function rondCentral(centree = false): Trait[] {
  const { cx, cy, r, gauche, droite } = centree ? ROND_CENTRE : ROND;
  return [
    { pts: arc(cx, cy, r, -96, 250), force: 0.8 },
    { pts: [[gauche, cy], [cx - r - 14, cy]], force: 0.7 },
    { pts: [[cx + r + 14, cy], [droite, cy]], force: 0.7 },
    // Le point central, sous la note.
    { pts: arc(cx, cy, 7, 0, 340), force: 0.5 },
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

/**
 * Les causeries d'avant, mal effacées : quelques traits fantômes là où la
 * photo ne les cache pas (les marges, le bas de la bande), à peine plus
 * clairs que le tableau. Sur la face : une flèche qui file sous la note, des
 * ronds et des croix au bord ; au dos, une autre mi-temps autour du rond.
 */
function fantomes(dos: boolean): Trait[] {
  const F = 0.3;
  if (dos)
    return [
      ...croix(160, 250, 22, F),
      rond(250, 190, 27, 30, F),
      rond(820, 300, 27, 200, F),
      ...croix(880, 200, 22, F),
      { pts: courbe([120, 1480], [300, 1380], [470, 1470]), force: F },
      ...pointe(courbe([120, 1480], [300, 1380], [470, 1470]), 30, 26, F),
      rond(860, 1440, 27, 90, F),
      ...croix(760, 1500, 22, F),
      { pts: [[620, 1520], [900, 1380]], tirets: true, force: F },
    ];
  const fleche = courbe([70, 1560], [330, 1500], [600, 1572]);
  return [
    { pts: fleche, force: F },
    ...pointe(fleche, 30, 26, F),
    rond(980, 1190, 24, 60, F * 0.8),
    ...croix(28, 1060, 16, F * 0.8),
    { pts: [[560, 1046], [640, 1092]], tirets: true, force: F * 0.8 },
  ];
}

/** Une passe de brosse : une bande de traînées fines, inégales, là où la craie n'est pas partie. */
function passeBrosse(d: string, largeur: number, force: number, rnd: () => number) {
  const n = 13;
  return Array.from({ length: n }, (_, i) => ({
    d,
    dy: (i / (n - 1) - 0.5) * largeur,
    l: 2.5 + rnd() * 9,
    o: force * (0.3 + rnd() * 0.95) * (1 - Math.abs(i / (n - 1) - 0.5) * 0.9),
  }));
}

function Brosse({ m, dos, rnd }: { m: Couleurs; dos: boolean; rnd: () => number }) {
  const passes = dos
    ? [
        { d: "M10 270 Q520 110 1014 300", l: 130, o: 0.13 },
        { d: "M10 1490 Q520 1380 1014 1560", l: 140, o: 0.13 },
        { d: "M60 980 Q300 900 520 1010", l: 90, o: 0.09 },
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

/**
 * L'effacement : de grandes passes molles de brosse, en arcs qui se
 * chevauchent, là où la craie d'avant s'est étalée en voile.
 */
function Effacement({ m, dos }: { m: Couleurs; dos: boolean }) {
  const passes = dos
    ? [
        { d: "M-40 420 C200 300 420 520 700 400 S980 300 1080 380", l: 150, o: 0.035 },
        { d: "M-40 1100 C240 980 520 1180 760 1060 S1000 980 1080 1040", l: 170, o: 0.032 },
        { d: "M-40 1420 C300 1360 600 1500 1080 1400", l: 120, o: 0.03 },
      ]
    : [
        { d: "M-40 1160 C160 1060 420 1260 660 1150", l: 160, o: 0.055 },
        { d: "M-40 1420 C200 1340 460 1520 700 1420", l: 150, o: 0.05 },
        { d: "M-40 300 C220 180 520 420 820 260 S1000 220 1080 260", l: 150, o: 0.035 },
        { d: "M-40 700 C260 620 560 800 1080 640", l: 130, o: 0.03 },
      ];
  return (
    <>
      {passes.map((p, i) => (
        <g key={i}>
          <path d={p.d} fill="none" stroke={m.clair} strokeWidth={p.l} strokeLinecap="round" opacity={p.o * 2} />
          <path d={p.d} fill="none" stroke={m.clair} strokeWidth={p.l * 0.55} strokeLinecap="round" opacity={p.o * 2.4} />
        </g>
      ))}
    </>
  );
}

/** Les rayures du tableau : de fines griffures claires, au hasard, que la craie remplit. */
function Rayures({ m, rnd }: { m: Couleurs; rnd: () => number }) {
  const r = Array.from({ length: 34 }, () => {
    const x = rnd() * W;
    const y = rnd() * H;
    const l = 18 + rnd() * 70;
    const a = (rnd() - 0.5) * 1.2;
    return { x, y, x2: x + l * Math.cos(a), y2: y + l * Math.sin(a), o: 0.06 + rnd() * 0.12 };
  });
  return (
    <>
      {r.map((t, i) => (
        <line key={i} x1={f(t.x)} y1={f(t.y)} x2={f(t.x2)} y2={f(t.y2)} stroke={m.clair} strokeWidth={1.2} strokeLinecap="round" opacity={f(t.o * 100) / 100} />
      ))}
    </>
  );
}

/** Le grain du tableau : des points de craie restés dans les pores, et quelques creux plus sombres. */
function GrainCraie({ id, m, graine }: { id: string; m: Couleurs; graine: number }) {
  const rnd = alea(graine ^ 0x2a7d3c11);
  const T = 140;
  const points = Array.from({ length: 90 }, () => ({ x: rnd() * T, y: rnd() * T, r: 0.7 + rnd() * 1.6, o: 0.08 + rnd() * 0.18, sombre: rnd() < 0.35 }));
  return (
    <>
      <defs>
        <pattern id={`gr-${id}`} width={T} height={T} patternUnits="userSpaceOnUse">
          {points.map((p, i) => (
            <circle key={i} cx={f(p.x)} cy={f(p.y)} r={f(p.r)} fill={p.sombre ? m.fonce : m.clair} opacity={f(p.o * 100) / 100} />
          ))}
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#gr-${id})`} />
    </>
  );
}

/** La poussière tombée au pied du tableau : des grains serrés le long du bas, qui s'éclaircissent en montant. */
function Poussiere({ m, rnd }: { m: Couleurs; rnd: () => number }) {
  const grains = Array.from({ length: 260 }, () => {
    const y = H - 4 - Math.pow(rnd(), 2.4) * 150;
    return { x: rnd() * W, y, r: 0.8 + rnd() * 2.2, o: 0.18 + rnd() * 0.4 };
  });
  return (
    <>
      {grains.map((g, i) => (
        <circle key={i} cx={f(g.x)} cy={f(g.y)} r={f(g.r)} fill={m.clair} opacity={f(g.o * 100) / 100} />
      ))}
    </>
  );
}

/**
 * La lune et BOLA à la craie (le dos) : remplis à plat, du côté du bâton,
 * en passes presque horizontales qui se chevauchent ; le grain du tableau
 * les troue ; un contour de brins plus francs les tient.
 */
function MarqueCraie({ id, m, rnd }: { id: string; m: Craie; rnd: () => number }) {
  // Le grain du tableau qui perce la craie : des points sombres, et de courtes stries dans le sens du geste.
  const trous = Array.from({ length: 520 }, () => ({ x: 280 + rnd() * 470, y: 575 + rnd() * 715, r: 0.6 + rnd() * 1.9, o: 0.3 + rnd() * 0.55 }));
  const stries = Array.from({ length: 90 }, () => {
    const x = 280 + rnd() * 470;
    const y = 575 + rnd() * 715;
    const l = 10 + rnd() * 34;
    return { x, y, x2: x + l, y2: y - l * 0.3, o: 0.18 + rnd() * 0.3 };
  });
  // La pression de la main : des zones un peu plus chargées, d'autres plus maigres.
  const appuis = Array.from({ length: 9 }, () => ({ x: 300 + rnd() * 430, y: 600 + rnd() * 680, r: 50 + rnd() * 90, plus: rnd() < 0.5 }));
  return (
    <>
      <defs>
        <clipPath id={`mq-${id}`}>
          <Marque />
        </clipPath>
        <radialGradient id={`mqa-${id}`}>
          <stop offset="0" stopColor="#000" stopOpacity={0.32} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`mqb-${id}`}>
          <stop offset="0" stopColor="#fff" stopOpacity={0.25} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
      </defs>
      <g clipPath={`url(#mq-${id})`}>
        <rect width={W} height={H} fill={m.craie} opacity={0.82} />
        {appuis.map((a, i) => (
          <circle key={i} cx={f(a.x)} cy={f(a.y)} r={f(a.r)} fill={`url(#${a.plus ? "mqb" : "mqa"}-${id})`} />
        ))}
        {stries.map((t, i) => (
          <line key={`s${i}`} x1={f(t.x)} y1={f(t.y)} x2={f(t.x2)} y2={f(t.y2)} stroke={m.fonce} strokeWidth={1.4} strokeLinecap="round" opacity={f(t.o * 100) / 100} />
        ))}
        {trous.map((t, i) => (
          <circle key={i} cx={f(t.x)} cy={f(t.y)} r={f(t.r)} fill={m.fonce} opacity={f(t.o * 100) / 100} />
        ))}
      </g>
      {/* Le bord : la craie s'effrite un peu dehors. */}
      <Marque fill="none" stroke={m.craie} strokeWidth={3} opacity={0.45} strokeDasharray="3 2 9 3 2 4 14 2" strokeLinejoin="round" />
    </>
  );
}

function Tableau({ m, graine, dos, noteCentree, k, id }: { m: Craie; graine: number; dos: boolean; noteCentree?: boolean; k: number; id: string }) {
  const rnd = alea(graine ^ 0x6c1b3a57);
  // Au dos, la lune est le ballon posé au centre : le rond central autour d'elle, la ligne médiane de part et d'autre, les quatre coins.
  const traits: Trait[] = dos
    ? [
        { pts: arc(512, 738, 392), force: 0.75 },
        { pts: [[40, 738], [110, 738]], force: 0.7 },
        { pts: [[914, 738], [984, 738]], force: 0.7 },
        { pts: arc(54, 54, 46, 0, 90), force: 0.6 },
        { pts: arc(970, 54, 46, 90, 180), force: 0.6 },
        { pts: arc(54, 1602, 46, 270, 360), force: 0.6 },
        { pts: arc(970, 1602, 46, 180, 270), force: 0.6 },
      ]
    : [...demiTerrain(), ...schema(), ...rondCentral(noteCentree)];
  const vieux = fantomes(dos).map((t) => tracer(t, rnd));
  const traces = traits.map((t) => tracer(t, rnd));
  return (
    <>
      <GrainCraie id={id} m={m} graine={graine} />
      <Effacement m={m} dos={dos} />
      <Rayures m={m} rnd={rnd} />
      <Brosse m={m} dos={dos} rnd={rnd} />
      {vieux.map((t, i) => (
        <TraitCraie key={`v${i}`} t={t} m={m} />
      ))}
      <Poussiere m={m} rnd={rnd} />
      {traces.map((t, i) => (
        <TraitCraie key={i} t={t} m={m} k={k} />
      ))}
      {dos && <MarqueCraie id={id} m={m} rnd={rnd} />}
    </>
  );
}

/* ------------------------------ Le banc ---------------------------------- */

/** Un boudin de la doudoune : sa hauteur (11 sur la carte ; la dernière couture de la bande tombe au-dessus du filet de série). */
const BOUDIN = 146;

/**
 * Les boudins : chacun un tube de nylon gonflé, la lumière sur son haut
 * (plus ou moins vive selon où il prend le jour), l'ombre qui se creuse vers
 * la couture ; la couture, un pli sombre et sa piqûre ton sur ton ; de part
 * et d'autre, les fronces du tissu pincé, de petits coins d'ombre et de
 * lumière.
 */
function Boudins({ id, motif, graine, k, dos }: { id: string; motif: Extract<MotifEntraineur, { type: "banc-matelasse" }> & Couleurs; graine: number; k: number; dos: boolean }) {
  const rnd = alea(graine ^ 0x51ed270b);
  // Sur la face, une couture tombe juste sous le portrait : la bande garde des boudins entiers.
  const premier = dos ? 40 : 1004 - BOUDIN * 7;
  const coutures: number[] = [];
  for (let y = premier; y < H + BOUDIN; y += BOUDIN) coutures.push(y);
  const boudins = coutures.slice(0, -1).map((y) => ({ y, eclat: 0.65 + rnd() * 0.45 }));
  // Les fronces : de petits coins qui partent de la couture, vers le haut et vers le bas.
  const fronces = coutures.flatMap((y) =>
    Array.from({ length: 30 }, (_, i) => {
      const x = (i + 0.15 + rnd() * 0.7) * (W / 30);
      const l = 12 + rnd() * 26;
      const s = rnd() < 0.5 ? -1 : 1;
      const b = 2.2 + rnd() * 2.2;
      return { x, y, l, s, b, o: 0.22 + rnd() * 0.3, penche: (rnd() - 0.5) * 8 };
    })
  );
  return (
    <>
      <defs>
        <linearGradient id={`bd-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity={0.66} />
          <stop offset="0.05" stopColor="#000" stopOpacity={0.34} />
          <stop offset="0.14" stopColor="#000" stopOpacity={0.06} />
          <stop offset="0.5" stopColor="#000" stopOpacity={0} />
          <stop offset="0.8" stopColor="#000" stopOpacity={0.2} />
          <stop offset="0.94" stopColor="#000" stopOpacity={0.48} />
          <stop offset="1" stopColor="#000" stopOpacity={0.7} />
        </linearGradient>
        <linearGradient id={`bl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.12" stopColor={motif.lumiere} stopOpacity={0} />
          <stop offset="0.26" stopColor={motif.lumiere} stopOpacity={0.55} />
          <stop offset="0.33" stopColor={motif.lumiere} stopOpacity={1} />
          <stop offset="0.42" stopColor={motif.lumiere} stopOpacity={0.5} />
          <stop offset="0.62" stopColor={motif.lumiere} stopOpacity={0.08} />
          <stop offset="0.75" stopColor={motif.lumiere} stopOpacity={0} />
        </linearGradient>
      </defs>
      {boudins.map((b, i) => (
        <g key={i}>
          <rect x={0} y={b.y} width={W} height={BOUDIN} fill={`url(#bd-${id})`} />
          <rect x={0} y={b.y} width={W} height={BOUDIN} fill={`url(#bl-${id})`} opacity={f(b.eclat * 100) / 100} />
        </g>
      ))}
      {fronces.map((p, i) => {
        // Un coin : large contre la couture, effilé en s'en éloignant.
        const d = `M${f(p.x - p.b)} ${f(p.y)}L${f(p.x + p.penche)} ${f(p.y + p.s * p.l)}L${f(p.x + p.b)} ${f(p.y)}Z`;
        return (
          <g key={i} opacity={f(p.o * 100) / 100}>
            <path d={d} fill={motif.fonce} />
            <path d={d} transform={`translate(${f(p.b * 0.9)} 0)`} fill={motif.clair} opacity={0.6} />
          </g>
        );
      })}
      {coutures.map((y) => (
        <g key={y}>
          <line x1={0} y1={y} x2={W} y2={y} stroke="rgba(0,0,0,0.5)" strokeWidth={6 * k} />
          <line x1={0} y1={y} x2={W} y2={y} stroke="rgba(0,0,0,0.8)" strokeWidth={2 * k} />
          <line x1={0} y1={y - 3} x2={W} y2={y - 3} stroke={motif.fil} strokeWidth={1.3 * k} strokeDasharray={`${f(5 * k)} ${f(4 * k)}`} opacity={0.32} />
        </g>
      ))}
    </>
  );
}

/** Le rayon des coins de la carte (finitions-carte.ts, RAYON_CARTE = 1024 ÷ φ⁵). */
const RAYON = 1024 / ((1 + Math.sqrt(5)) / 2) ** 5;

/** Une piqûre qui fait le tour de la carte, à `retrait` du bord, en suivant ses coins : un sillon, puis les points. */
function PiqureTour({ retrait, fil, k, pas = [9, 7], ombre = "rgba(0,0,0,0.5)" }: { retrait: number; fil: string; k: number; pas?: [number, number]; ombre?: string }) {
  const b = { x: retrait, y: retrait, width: W - retrait * 2, height: H - retrait * 2, rx: RAYON - retrait };
  return (
    <>
      <rect {...b} fill="none" stroke={ombre} strokeWidth={4 * k} transform="translate(1 1.5)" />
      <rect {...b} fill="none" stroke={fil} strokeWidth={2.2 * k} strokeDasharray={`${f(pas[0] * k)} ${f(pas[1] * k)}`} strokeLinecap="round" />
    </>
  );
}

/**
 * La lune et BOLA brodés au passé plat (le dos) : des points serrés en
 * biais, alternés clairs et sombres comme la lumière sur le fil, puis un
 * point de contour qui les borde.
 */
function MarqueBrodee({ id, fil }: { id: string; fil: string }) {
  const lignes = Array.from({ length: 330 }, (_, i) => i * 4.2 - 300);
  return (
    <>
      <defs>
        <clipPath id={`mb-${id}`}>
          <Marque />
        </clipPath>
        <linearGradient id={`ml-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.28} />
          <stop offset="0.45" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.22} />
        </linearGradient>
      </defs>
      {/* Le relief de la broderie : son ombre portée sur le nylon. */}
      <g transform="translate(3 5)">
        <Marque fill="rgba(0,0,0,0.5)" />
      </g>
      <g clipPath={`url(#mb-${id})`}>
        <rect width={W} height={H} fill={fil} opacity={0.94} />
        {lignes.map((x, i) => (
          <line key={i} x1={x} y1={0} x2={x + 620} y2={H} stroke={i % 3 ? "rgba(0,0,0,0.09)" : "rgba(255,255,255,0.4)"} strokeWidth={1.3} />
        ))}
        <rect width={W} height={H} fill={`url(#ml-${id})`} />
      </g>
      {/* Le point de bourdon qui borde la broderie. */}
      <Marque fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth={2.4} strokeDasharray="4 2" />
    </>
  );
}

function Banc({ motif, id, graine, dos, k }: { motif: Extract<MotifEntraineur, { type: "banc-matelasse" }> & Couleurs; id: string; graine: number; dos: boolean; k: number }) {
  return (
    <>
      <Boudins id={id} motif={motif} graine={graine} k={k} dos={dos} />
      {/* Le biais qui borde la doudoune : une bande ton sur ton, piquée du même fil (pas de pointillé clair autour de la carte : c'est le bord des kangas). */}
      <PiqureTour retrait={9} fil="rgba(0,0,0,0.38)" k={k} pas={[6, 5]} ombre="rgba(255,255,255,0.05)" />
      {dos && <MarqueBrodee id={id} fil={motif.fil.replace(/,[\d.]+\)$/, ",1)")} />}
    </>
  );
}

/* ------------------------------ Le carnet -------------------------------- */

/** L'élastique du carnet : entre le bas du portrait (983) et le haut de la bande (1024). */
export const SANGLE = { y: 987, h: 34 } as const;

/**
 * Le grain du cuir : de petits galets en relief, la lumière en haut à gauche,
 * l'ombre en bas à droite ; deux tuiles de tailles premières entre elles se
 * superposent, pour que la répétition ne se voie pas.
 */
function GrainCuir({ id, m, graine }: { id: string; m: Couleurs; graine: number }) {
  const rnd = alea(graine ^ 0x1b873593);
  const tuile = (T: number, n: number, taille: number) => {
    const g: { x: number; y: number; rx: number; ry: number; a: number }[] = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) g.push({ x: (i + 0.5 + (rnd() - 0.5) * 0.8) * (T / n), y: (j + 0.5 + (rnd() - 0.5) * 0.8) * (T / n), rx: taille * (0.7 + rnd() * 0.7), ry: taille * (0.55 + rnd() * 0.5), a: rnd() * 180 });
    return g;
  };
  const tuiles = [
    { T: 131, g: tuile(131, 14, 3.6), o: 1 },
    { T: 89, g: tuile(89, 7, 4.8), o: 0.55 },
  ];
  return (
    <>
      <defs>
        {tuiles.map((t, k) => (
          <pattern key={k} id={`gc${k}-${id}`} width={t.T} height={t.T} patternUnits="userSpaceOnUse">
            {t.g.map((g, i) => (
              <g key={i} transform={`rotate(${f(g.a)} ${f(g.x)} ${f(g.y)})`}>
                <ellipse cx={f(g.x + 0.8)} cy={f(g.y + 1)} rx={f(g.rx)} ry={f(g.ry)} fill={m.fonce} />
                <ellipse cx={f(g.x - 0.4)} cy={f(g.y - 0.5)} rx={f(g.rx * 0.88)} ry={f(g.ry * 0.88)} fill={m.clair} />
              </g>
            ))}
          </pattern>
        ))}
      </defs>
      {tuiles.map((t, k) => (
        <rect key={k} width={W} height={H} fill={`url(#gc${k}-${id})`} opacity={t.o} />
      ))}
    </>
  );
}

/**
 * L'élastique : une bande tissée (de fines côtes verticales), bombée (plus
 * claire au milieu), qui jette son ombre sur le cuir dessous et dessus.
 */
function Sangle({ id, couleur, ombre, k }: { id: string; couleur: string; ombre: string; k: number }) {
  const { y, h } = SANGLE;
  return (
    <>
      <defs>
        <linearGradient id={`sb-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity={0.32} />
          <stop offset="0.3" stopColor="#fff" stopOpacity={0.18} />
          <stop offset="0.55" stopColor="#fff" stopOpacity={0.05} />
          <stop offset="1" stopColor="#000" stopOpacity={0.4} />
        </linearGradient>
        <pattern id={`sc-${id}`} width={5} height={h} patternUnits="userSpaceOnUse">
          <line x1={1} y1={0} x2={1} y2={h} stroke="rgba(0,0,0,0.16)" strokeWidth={1.3} />
          <line x1={3.5} y1={0} x2={3.5} y2={h} stroke="rgba(255,255,255,0.22)" strokeWidth={0.9} />
        </pattern>
        <linearGradient id={`so-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ombre} stopOpacity={1} />
          <stop offset="1" stopColor={ombre} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* L'ombre sur le cuir : dessous (la lumière vient d'en haut), un peu dessus. */}
      <rect x={0} y={y + h} width={W} height={14 * k} fill={`url(#so-${id})`} />
      <rect x={0} y={y - 4} width={W} height={4} fill={ombre} opacity={0.35} />
      <rect x={0} y={y} width={W} height={h} fill={couleur} />
      <rect x={0} y={y} width={W} height={h} fill={`url(#sc-${id})`} />
      <rect x={0} y={y} width={W} height={h} fill={`url(#sb-${id})`} />
    </>
  );
}

/**
 * La lune et BOLA gaufrés à sec dans le cuir (le dos) : le creux un peu plus
 * sombre, l'ombre sur son bord haut-gauche, la lumière sur son bord bas-droit.
 */
function MarqueGaufree({ id }: { id: string }) {
  return (
    <>
      <defs>
        <clipPath id={`mg-${id}`}>
          <Marque />
        </clipPath>
      </defs>
      <Marque fill="rgba(0,0,0,0.42)" />
      <g clipPath={`url(#mg-${id})`}>
        <g transform="translate(4 5)">
          <Marque fill="none" stroke="rgba(0,0,0,0.75)" strokeWidth={9} />
        </g>
        <g transform="translate(-2 -2)">
          <Marque fill="none" stroke="rgba(255,246,232,0.09)" strokeWidth={3} />
        </g>
      </g>
      {/* L'arête du gaufrage : un filet de lumière juste dehors, en bas à droite. */}
      <g transform="translate(1.5 2)">
        <Marque fill="none" stroke="rgba(255,246,232,0.05)" strokeWidth={2} />
      </g>
    </>
  );
}

function Carnet({ motif, id, graine, dos, k }: { motif: Extract<MotifEntraineur, { type: "carnet-cuir" }> & Couleurs; id: string; graine: number; dos: boolean; k: number }) {
  return (
    <>
      <GrainCuir id={id} m={motif} graine={graine} />
      <PiqureTour retrait={22} fil="rgba(236,230,216,0.34)" k={k} pas={[11, 7]} ombre="rgba(0,0,0,0.6)" />
      {dos && <MarqueGaufree id={id} />}
      <Sangle id={id} couleur={motif.sangle} ombre={motif.ombre} k={k} />
    </>
  );
}

export function MotifEntraineurSvg({
  motif,
  graine = 1,
  dos = false,
  noteCentree,
  epaisseur = 1,
}: {
  motif: MotifEntraineur & Couleurs;
  graine?: number;
  dos?: boolean;
  noteCentree?: boolean;
  /** En petit, les traits s'épaississent pour rester lisibles (1 à 3,4). */
  epaisseur?: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const style: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };
  const m = { clair: motif.clair, fonce: motif.fonce };
  const k = Math.max(1, Math.min(3.4, epaisseur));
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
      {motif.type === "tableau-craie" ? (
        <Tableau m={{ ...m, craie: motif.craie }} graine={graine} dos={dos} noteCentree={noteCentree} k={k} id={id} />
      ) : motif.type === "banc-matelasse" ? (
        <Banc motif={motif} id={id} graine={graine} dos={dos} k={k} />
      ) : (
        <Carnet motif={motif} id={id} graine={graine} dos={dos} k={k} />
      )}
    </svg>
  );
}
