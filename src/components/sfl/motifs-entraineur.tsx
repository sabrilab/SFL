"use client";

// Le motif de la carte d'entraîneur (skins-entraineur.ts : le Tableau, la
// causerie), que dessine motif-carte.tsx comme les autres : du SVG dans le
// repère de la carte (1024 × 1656), étiré sur toute la carte, sans image,
// sans flou ni filtre (la capture de la 3D le prend tel quel). La craie se
// fait en couches, et dessine son dos elle-même, la lune et le logotype
// compris (Matiere.dos.logo = false) : le grain du tableau (deux trames de
// tailles premières entre elles, pour que la répétition ne se voie pas) ; les
// passes d'effacement, à bouts carrés, striées par la brosse, à gauche de la
// colonne des chiffres ; les schémas des causeries d'avant, mal effacés (sous
// la note, la course fléchée d'une autre mi-temps) ; la poussière au pied, en
// traînées ; sans photo, le schéma de la mi-temps dans le portrait ; photo ou
// pas, le rond central autour de la note. Au dos, le rond central autour de
// la lune ; la lune et BOLA à la craie, couchée à plat en passes, le tableau
// entre elles, et cernées de trois brins. Chaque trait est fait de brins de
// craie interrompus, tirés de la graine. En petit, les traits s'épaississent
// (`epaisseur`) : le rond de craie se lit encore à 78 px autour de la note.

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
const o2 = (n: number) => Math.round(n * 100) / 100;

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
const sLogo = DOS.logo.h / BOITE_LOGOTYPE.h;
/** La lune, centrée en (cx, cy), de diamètre d. */
const luneT = (cx: number, cy: number, d: number) => {
  const s = d / BOITE_SYMBOLE.c;
  return `translate(${f(cx - (BOITE_SYMBOLE.x + BOITE_SYMBOLE.c / 2) * s)} ${f(cy - (BOITE_SYMBOLE.y + BOITE_SYMBOLE.c / 2) * s)}) scale(${f(s * 1000) / 1000})`;
};
const LUNE_T = luneT(DOS.cx, DOS.cy, DOS.lune);
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
 * Les causeries d'avant, mal effacées. Sur la face : sous la note, la course
 * fléchée d'une autre mi-temps (la seule marque de tactique qui reste quand
 * il y a une photo), et une croix au bord ; au dos, une autre mi-temps autour
 * du rond.
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
  const fleche = courbe([70, 1562], [320, 1508], [574, 1568]);
  return [{ pts: fleche, force: 0.55 }, ...pointe(fleche, 30, 26, 0.55), ...croix(40, 1062, 15, 0.24)];
}

/**
 * Une passe de brosse : une bande de traînées, chacune à son début et à sa
 * fin (la brosse attaque et lâche le tableau en biais), à bouts carrés. Le
 * voile d'abord, plus large et plus pâle, puis les stries du feutre.
 */
function PasseBrosse({ d, l, o, m, rnd, stries = 11 }: { d: string; l: number; o: number; m: Couleurs; rnd: () => number; stries?: number }) {
  const traits = Array.from({ length: stries }, (_, i) => {
    const t = stries > 1 ? i / (stries - 1) - 0.5 : 0;
    const a = rnd() * 110;
    const b = 880 + rnd() * 120;
    return { dy: t * l * 0.9 + (rnd() - 0.5) * 3, w: 1.5 + rnd() * (l / 14), a, b, op: o * (0.45 + rnd() * 1.1) * (1 - Math.abs(t) * 0.7) };
  });
  return (
    <>
      <path d={d} pathLength={1000} fill="none" stroke={m.clair} strokeWidth={l} strokeLinecap="butt" strokeDasharray="930 2000" strokeDashoffset={-35} opacity={o2(o * 0.55)} />
      {traits.map((s, i) => (
        <path
          key={i}
          d={d}
          pathLength={1000}
          transform={`translate(0 ${f(s.dy)})`}
          fill="none"
          stroke={m.clair}
          strokeWidth={f(s.w)}
          strokeLinecap="butt"
          strokeDasharray={`${f(s.b - s.a)} 2000`}
          strokeDashoffset={f(-s.a)}
          opacity={o2(s.op)}
        />
      ))}
    </>
  );
}

/**
 * L'effacement : de grandes passes de brosse là où la craie d'avant s'est
 * étalée en voile. Sur la face, dans la bande, elles restent à gauche de la
 * colonne des chiffres (jusqu'à 590) ; dans le portrait, elles traversent.
 */
function Effacement({ m, dos, rnd }: { m: Couleurs; dos: boolean; rnd: () => number }) {
  const passes = dos
    ? [
        { d: "M-20 420 C200 330 420 500 700 410 S960 330 1044 380", l: 150, o: 0.05 },
        { d: "M-20 1100 C240 1000 520 1170 760 1070 S1000 990 1044 1040", l: 160, o: 0.045 },
        { d: "M-20 1440 C300 1380 600 1500 1044 1410", l: 120, o: 0.045 },
        { d: "M30 270 Q520 130 1000 300", l: 110, o: 0.06 },
      ]
    : [
        // Sous la note, à gauche de la bande : là où la photo ne cache rien et où il n'y a pas de chiffres.
        { d: "M-10 1176 C150 1120 360 1222 590 1150", l: 130, o: 0.075 },
        { d: "M-10 1440 C170 1392 390 1478 584 1424", l: 104, o: 0.065 },
        // Dans le portrait (sous la photo) : les grandes passes d'une autre causerie.
        { d: "M-10 300 C220 190 520 410 820 270 S1000 230 1034 260", l: 140, o: 0.05 },
        { d: "M-10 690 C260 620 560 790 1034 650", l: 120, o: 0.04 },
        { d: "M20 112 Q500 28 1004 238", l: 96, o: 0.06 },
      ];
  return (
    <>
      {passes.map((p, i) => (
        <PasseBrosse key={i} d={p.d} l={p.l} o={p.o} m={m} rnd={rnd} />
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
        <line key={i} x1={f(t.x)} y1={f(t.y)} x2={f(t.x2)} y2={f(t.y2)} stroke={m.clair} strokeWidth={1.2} strokeLinecap="butt" opacity={o2(t.o)} />
      ))}
    </>
  );
}

/**
 * Le grain du tableau : des points de craie restés dans les pores, et
 * quelques creux plus sombres ; deux trames de tailles premières entre elles
 * (131 et 89), pour que la répétition ne se voie pas.
 */
function GrainCraie({ id, m, graine }: { id: string; m: Couleurs; graine: number }) {
  const rnd = alea(graine ^ 0x2a7d3c11);
  const tuile = (T: number, n: number, r0: number, r1: number, o0: number, o1: number) =>
    Array.from({ length: n }, () => ({ x: rnd() * T, y: rnd() * T, r: r0 + rnd() * (r1 - r0), o: o0 + rnd() * (o1 - o0), sombre: rnd() < 0.35 }));
  const tuiles = [
    { T: 131, g: tuile(131, 80, 0.6, 1.7, 0.07, 0.22) },
    { T: 89, g: tuile(89, 26, 0.9, 2.3, 0.05, 0.14) },
  ];
  return (
    <>
      <defs>
        {tuiles.map((t, k) => (
          <pattern key={k} id={`gr${k}-${id}`} width={t.T} height={t.T} patternUnits="userSpaceOnUse">
            {t.g.map((p, i) => (
              <circle key={i} cx={f(p.x)} cy={f(p.y)} r={f(p.r)} fill={p.sombre ? m.fonce : m.clair} opacity={o2(p.o)} />
            ))}
          </pattern>
        ))}
      </defs>
      {tuiles.map((_, k) => (
        <rect key={k} width={W} height={H} fill={`url(#gr${k}-${id})`} />
      ))}
    </>
  );
}

/** La poussière tombée au pied du tableau : de courtes traînées couchées, serrées dans le bas, de plus en plus rares en montant. */
function Poussiere({ m, rnd }: { m: Couleurs; rnd: () => number }) {
  const traines = Array.from({ length: 230 }, () => {
    const y = H - 3 - Math.pow(rnd(), 2.2) * 60;
    const x = rnd() * W;
    const l = 4 + rnd() * 14;
    const a = (rnd() - 0.5) * 0.14;
    return { x, y, x2: x + l * Math.cos(a), y2: y + l * Math.sin(a), w: 0.8 + rnd() * 1.4, o: 0.06 + rnd() * 0.14 };
  });
  return (
    <>
      {traines.map((g, i) => (
        <line key={i} x1={f(g.x)} y1={f(g.y)} x2={f(g.x2)} y2={f(g.y2)} stroke={m.clair} strokeWidth={f(g.w)} strokeLinecap="butt" opacity={o2(g.o)} />
      ))}
    </>
  );
}

/**
 * La lune et BOLA à la craie (le dos) : la craie couchée à plat, en passes
 * penchées comme la main qui ombre, aux bords déchirés, qui se chevauchent
 * mal : plus claires là où deux passes se recouvrent, le tableau visible
 * dans les minces jours entre elles ; dans chaque passe, le grain du tableau
 * que la craie a sauté, en points et en courtes stries sombres. Puis trois
 * brins de craie qui cernent le dessin, chacun à son rythme.
 */
function MarqueCraie({ id, m, rnd }: { id: string; m: Craie; rnd: () => number }) {
  type Passe = { d: string; o: number; a: number; cx: number; cy: number; stries: { x: number; y: number; l: number; w: number; o: number }[] };
  const passes: Passe[] = [];
  // Sur la lune et sur BOLA, chaque passe penchée de 6 à 14° comme la main qui ombre ; le repère tourne, le dessin reste.
  for (const [y0, y1, x0, x1] of [
    [540, 940, 300, 726],
    [1120, 1326, 230, 796],
  ] as const) {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    let y = y0;
    while (y < y1) {
      const h = 26 + rnd() * 18;
      const haut: P[] = [];
      const bas: P[] = [];
      for (let x = x0; x <= x1; x += 12 + rnd() * 8) {
        haut.push([x, y + (rnd() - 0.5) * 5]);
        bas.push([x, y + h + (rnd() - 0.5) * 6]);
      }
      const d = `M${haut.map(([a, b]) => `${f(a)} ${f(b)}`).join("L")}L${[...bas].reverse().map(([a, b]) => `${f(a)} ${f(b)}`).join("L")}Z`;
      const stries = Array.from({ length: Math.round(((x1 - x0) * h) / 70) }, () => {
        const court = rnd() < 0.85;
        return { x: x0 + rnd() * (x1 - x0), y: y + 2 + rnd() * (h - 4), l: court ? 1.2 + rnd() * 3 : 5 + rnd() * 9, w: 0.7 + rnd() * 1, o: 0.2 + rnd() * 0.35 };
      });
      passes.push({ d, o: 0.5 + rnd() * 0.12, a: -(6 + rnd() * 8), cx, cy, stries });
      // La passe suivante recouvre un peu celle-ci ; parfois un mince jour où le tableau se voit.
      y += h * (0.66 + rnd() * 0.26);
    }
  }
  const brins = [
    { dx: 0, dy: 0, l: 2.6, o: 0.66, tirets: "38 6 64 3 22 9 51 4" },
    { dx: 1.6, dy: -1.2, l: 1.7, o: 0.48, tirets: "21 11 37 6 12 13 30 8" },
    { dx: -1.4, dy: 1.5, l: 1.4, o: 0.36, tirets: "11 15 26 9 7 17 20 11" },
  ];
  return (
    <>
      <defs>
        <clipPath id={`mq-${id}`}>
          <Marque />
        </clipPath>
      </defs>
      <g clipPath={`url(#mq-${id})`}>
        <rect width={W} height={H} fill={m.craie} opacity={0.14} />
        {passes.map((p, i) => (
          <g key={i} transform={`rotate(${f(p.a)} ${f(p.cx)} ${f(p.cy)})`}>
            <path d={p.d} fill={m.craie} opacity={o2(p.o)} />
            {p.stries.map((t, j) => (
              <line key={j} x1={f(t.x)} y1={f(t.y)} x2={f(t.x + t.l)} y2={f(t.y)} stroke={m.fonce} strokeWidth={f(t.w)} strokeLinecap="butt" opacity={o2(t.o)} />
            ))}
          </g>
        ))}
      </g>
      {/* Le bord : trois brins de craie, comme les traits du schéma. */}
      {brins.map((b, i) => (
        <g key={i} transform={`translate(${b.dx} ${b.dy})`}>
          <Marque fill="none" stroke={m.craie} strokeWidth={b.l} opacity={b.o} strokeDasharray={b.tirets} strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}
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
      <Effacement m={m} dos={dos} rnd={rnd} />
      <Rayures m={m} rnd={rnd} />
      {vieux.map((t, i) => (
        <TraitCraie key={`v${i}`} t={t} m={m} k={k} />
      ))}
      <Poussiere m={m} rnd={rnd} />
      {traces.map((t, i) => (
        <TraitCraie key={i} t={t} m={m} k={k} />
      ))}
      {dos && <MarqueCraie id={id} m={m} rnd={rnd} />}
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
      <Tableau m={{ ...m, craie: motif.craie }} graine={graine} dos={dos} noteCentree={noteCentree} k={k} id={id} />
    </svg>
  );
}
