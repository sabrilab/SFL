"use client";

// Les motifs des skins du Passe Bola (skins-passe.ts), que dessine
// motif-carte.tsx comme les autres : du SVG dans le repère de la carte
// (1024 × 1656), étiré sur toute la carte, net à toutes les tailles, sans
// image et sans flou (un flou SVG ne passe pas la capture de la 3D) : une
// lueur, ce sont des traits superposés, du plus large et du plus pâle au plus
// fin. Comme les motifs des cartes à titre, ce sont des gravures, ton sur
// ton, pas des illustrations : la photo, le nom et la note restent devant.
//   · givre : la poussière de cristal du métal givré, et des plumes de givre
//     fines qui poussent des bords ;
//   · carbone : le sergé 2/2 de la fibre, des mèches d'un sens puis de
//     l'autre, qui font les diagonales ;
//   · marbre : quatre grandes veines à peu près parallèles, leurs ramures et
//     leurs fils, chacune dans sa brume ;
//   · tes couleurs : la maille d'un maillot, et les bandes du drapeau le long
//     des deux bords, comme ses côtés : en gris d'encre sur la face, en
//     couleurs au dos ;
//   · néon : un tube fuchsia qui suit le bord, ouvert en bas, ses attaches et
//     ses électrodes ;
//   · aurore : trois rideaux de rayons, vifs et verts en bas, qui pâlissent en
//     violet vers le haut, et des étoiles ;
//   · ki : l'aura de lumière blanche, des langues de flamme pleines qui
//     s'éteignent vers leur pointe, montent des côtés et des coins du bas (le
//     milieu du bas reste au texte), des traînées qui montent, les éclairs,
//     les étincelles ; au dos, la boule Bola dans sa couronne d'aura ;
//   · météorite : les lamelles croisées du fer, en trois familles à 60°,
//     chaque grain du métal tourné à sa façon.
// Ce qui est tiré au hasard l'est de la graine du joueur : chacun a son
// givre, son marbre, son aurore, ses éclairs, sa météorite, et toujours les
// mêmes. Ceux de la Saison Givre sont dans motifs-givre.tsx. Les tracés
// ne dépendent que du skin et de la graine : ils sont
// calculés une fois (memo), les couleurs viennent de la matière.

import { useId } from "react";
import { RAYON_CARTE } from "@/components/sfl/finitions-carte";
import { MotifGivre } from "@/components/sfl/motifs-givre";
import { estMotifGivre, type MotifPasse } from "@/components/sfl/skins-passe";

const W = 1024;
const H = 1656;

type Pt = [number, number];
type Couleurs = { clair: string; fonce: string };

const f = (n: number) => Math.round(n * 10) / 10;

/** Un générateur pseudo-aléatoire stable (xorshift), comme celui de motif-carte.tsx. */
function alea(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

const deja = new Map<string, unknown>();

/** Un tracé, calculé une fois par skin et par graine. */
function memo<T>(cle: string, calcul: () => T): T {
  const v = deja.get(cle);
  if (v !== undefined) return v as T;
  if (deja.size > 256) deja.clear();
  const r = calcul();
  deja.set(cle, r);
  return r;
}

const seg = (a: Pt, b: Pt) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
const ligne = (pts: Pt[]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}`;
const vers = ([x, y]: Pt, a: number, l: number): Pt => [x + Math.cos(a) * l, y + Math.sin(a) * l];
const entre = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const rond = ([x, y]: Pt, r: number) =>
  `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;

/* --------------------------------- Givre --------------------------------- */

interface TraitsGivre {
  tiges: string;
  branches: string;
  brindilles: string;
  /** La poussière de cristal, sur un carreau de 160 répété : ses éclats, ses creux. */
  eclats: string;
  creux: string;
}

const CARREAU_GIVRE = 160;

function traitsGivre(seed: number): TraitsGivre {
  const rnd = alea(seed ^ 0x2c1b3c6d);
  const j = (a: number) => (rnd() - 0.5) * a;
  let tiges = "";
  let branches = "";
  let brindilles = "";

  // Une plume de givre : une tige qui se courbe à peine, une branche à 60° à
  // chaque pas, d'un côté puis de l'autre, de plus en plus courte vers la
  // pointe, et deux brindilles sur chaque branche.
  const plume = (depart: Pt, a: number, longueur: number) => {
    const pas = 9;
    const n = Math.max(3, Math.round(longueur / pas));
    const courbe = j(0.05);
    let p = depart;
    const pts: Pt[] = [p];
    for (let i = 1; i <= n; i++) {
      a += courbe + j(0.07);
      p = vers(p, a, pas);
      pts.push(p);
      const lb = longueur * 0.3 * (1 - i / (n + 1)) * (0.6 + rnd() * 0.6);
      if (lb < 5) continue;
      const cote = i % 2 ? 1 : -1;
      const ab = a + cote * (Math.PI / 3) * (0.9 + rnd() * 0.2);
      const bout = vers(p, ab, lb);
      branches += seg(p, bout);
      for (const t of [0.35, 0.65]) {
        const lr = lb * 0.34 * (1.1 - t) * (0.7 + rnd() * 0.6);
        if (lr < 3) continue;
        const q = entre(p, bout, t);
        brindilles += seg(q, vers(q, ab + (rnd() < 0.5 ? 1 : -1) * (Math.PI / 3), lr));
      }
    }
    tiges += ligne(pts);
  };

  // Les coins : deux ou trois grandes plumes, vers l'intérieur.
  const coins: { p: Pt; cap: number }[] = [
    { p: [0, 0], cap: Math.PI / 4 },
    { p: [W, 0], cap: (3 * Math.PI) / 4 },
    { p: [W, H], cap: (-3 * Math.PI) / 4 },
    { p: [0, H], cap: -Math.PI / 4 },
  ];
  for (const { p, cap } of coins) {
    const bas = p[1] === H;
    for (let k = 0; k < 3; k++) {
      const ecart = (k - 1) * 0.42 + j(0.2);
      const depart: Pt = vers(p, cap + ecart * 1.4, 18 + rnd() * 26);
      plume(depart, cap + ecart, (bas ? 120 : 190) + rnd() * (bas ? 50 : 90));
    }
  }
  // Les bords : des plumes serrées, vers l'intérieur ; en bas, courtes (la note, la série).
  for (let y = 150 + rnd() * 40; y < H - 150; y += 44 + rnd() * 40) {
    plume([-4, y], j(1.1), 50 + rnd() * 90);
    plume([W + 4, y + j(40)], Math.PI + j(1.1), 50 + rnd() * 90);
  }
  for (let x = 150 + rnd() * 30; x < W - 150; x += 46 + rnd() * 40) {
    plume([x, -4], Math.PI / 2 + j(1.1), 50 + rnd() * 70);
    plume([x + j(30), H + 4], -Math.PI / 2 + j(1.1), 26 + rnd() * 30);
  }

  // La poussière de cristal : des éclats qui prennent la lumière, et leurs creux.
  let eclats = "";
  let creux = "";
  for (let k = 0; k < 110; k++) {
    const c: Pt = [rnd() * CARREAU_GIVRE, rnd() * CARREAU_GIVRE];
    if (rnd() < 0.6) eclats += rond(c, 0.7 + rnd() ** 2 * 1.3);
    else creux += rond(c, 0.6 + rnd() ** 2 * 0.9);
  }
  return { tiges, branches, brindilles, eclats, creux };
}

function Givre({ m, seed, id }: { m: Couleurs; seed: number; id: string }) {
  const t = memo(`givre:${seed}`, () => traitsGivre(seed));
  const traits = (c: string) => (
    <>
      <path d={t.tiges} stroke={c} strokeWidth={1.7} />
      <path d={t.branches} stroke={c} strokeWidth={1.1} />
      <path d={t.brindilles} stroke={c} strokeWidth={0.75} />
    </>
  );
  return (
    <>
      <defs>
        <pattern id={`givre-${id}`} width={CARREAU_GIVRE} height={CARREAU_GIVRE} patternUnits="userSpaceOnUse">
          <path d={t.creux} fill={m.fonce} opacity={0.55} />
          <path d={t.eclats} fill={m.clair} opacity={0.85} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#givre-${id})`} />
      {/* Le bord, plus blanc là où le givre prend : deux bandes, la large et pâle, la fine. */}
      {[
        { l: 52, o: 0.16 },
        { l: 18, o: 0.24 },
      ].map(({ l, o }) => (
        <rect key={l} width={W} height={H} rx={RAYON_CARTE} fill="none" stroke={m.clair} strokeWidth={l} opacity={o} />
      ))}
      {/* Gravé : le creux décalé, puis l'arête qui prend la lumière. */}
      <g fill="none" strokeLinecap="round" transform="translate(1.1 1.6)" opacity={0.8}>
        {traits(m.fonce)}
      </g>
      <g fill="none" strokeLinecap="round">
        {traits(m.clair)}
      </g>
    </>
  );
}

/* -------------------------------- Carbone -------------------------------- */

/** Le sergé 2/2 : la mèche (i, j) passe en trame si (i + j) mod 4 < 2, sinon en chaîne. */
const MECHE = 18;
const SERGE = Array.from({ length: 16 }, (_, k) => {
  const i = k % 4;
  const jj = Math.floor(k / 4);
  return { x: i * MECHE, y: jj * MECHE, trame: (i + jj) % 4 < 2 };
});

function Carbone({ m, id }: { m: Couleurs; id: string }) {
  const degrade = (sens: "h" | "v") => (
    <linearGradient id={`cb-${sens}-${id}`} x1="0" y1="0" x2={sens === "v" ? "1" : "0"} y2={sens === "h" ? "1" : "0"}>
      <stop offset="0" stopColor={m.clair} />
      <stop offset="0.45" stopColor="rgba(0,0,0,0)" />
      <stop offset="1" stopColor={m.fonce} />
    </linearGradient>
  );
  return (
    <>
      <defs>
        {degrade("h")}
        {degrade("v")}
        <pattern id={`cb-${id}`} width={MECHE * 4} height={MECHE * 4} patternUnits="userSpaceOnUse">
          {SERGE.map((c) => (
            <rect
              key={`${c.x}-${c.y}`}
              x={c.x}
              y={c.y}
              width={MECHE}
              height={MECHE}
              fill={`url(#cb-${c.trame ? "h" : "v"}-${id})`}
            />
          ))}
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#cb-${id})`} />
    </>
  );
}

/* --------------------------------- Marbre --------------------------------- */

interface Reglages {
  sel: number;
  /** Les grandes veines : départ et cap. */
  grandes: { p: Pt; a: number }[];
  pas: number;
  /** Ce que le cap s'agite, ce qu'il revient vers son cap, et la chance d'une cassure à chaque pas. */
  agite: number;
  rappel: number;
  cassure: number;
  largeur: [number, number];
  ramures: number;
  fils: number;
  poussiere: number;
}

// Le marbre : quatre veines à peu près parallèles, en diagonale, comme une dalle.
const MARBRE: Reglages = {
  sel: 0x3b9ac9ff,
  grandes: [-920, -400, 120, 640].map((x) => ({ p: [x, -150] as Pt, a: 1 })),
  pas: 16,
  agite: 0.09,
  rappel: 0.05,
  cassure: 0,
  largeur: [1.6, 9],
  ramures: 3,
  fils: 7,
  poussiere: 0,
};

/** Une veine : un pas après l'autre, le cap qui s'agite et revient. */
function trace(rnd: () => number, depart: Pt, a: number, longueur: number, r: Reglages): Pt[] {
  const cap = a;
  let v = 0;
  let p = depart;
  const pts: Pt[] = [p];
  for (let s = 0; s < longueur; s += r.pas) {
    v = v * 0.8 + (rnd() - 0.5) * r.agite;
    a += v + (cap - a) * r.rappel;
    if (rnd() < r.cassure) a += (rnd() - 0.5) * 1.1;
    p = vers(p, a, r.pas);
    pts.push(p);
    if (p[0] < -220 || p[0] > W + 220 || p[1] < -220 || p[1] > H + 220) break;
  }
  return pts;
}

/** Une veine en ruban : sa largeur enfle et maigrit, et s'effile aux deux bouts. */
function ruban(pts: Pt[], min: number, max: number, phase: number): string {
  const n = pts.length;
  if (n < 2) return "";
  const g: string[] = [];
  const d: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / l;
    const ny = (b[0] - a[0]) / l;
    const t = i / (n - 1);
    const enfle = (0.5 + 0.5 * Math.sin(t * 11 + phase)) * (0.6 + 0.4 * Math.sin(t * 3.7 + phase * 2));
    const w = ((min + (max - min) * enfle) * Math.min(1, t * 8, (1 - t) * 8)) / 2;
    g.push(`${f(pts[i][0] + nx * w)} ${f(pts[i][1] + ny * w)}`);
    d.push(`${f(pts[i][0] - nx * w)} ${f(pts[i][1] - ny * w)}`);
  }
  return `M${g.join("L")}L${d.reverse().join("L")}Z`;
}

interface TraitsVeines {
  brume: string;
  grandes: string;
  ramures: string;
  fils: string;
  lumiere: string;
  poussiere: string;
}

function traitsVeines(seed: number, r: Reglages): TraitsVeines {
  const rnd = alea(seed ^ r.sel);
  const t: TraitsVeines = { brume: "", grandes: "", ramures: "", fils: "", lumiere: "", poussiere: "" };
  const parcours: Pt[] = [];
  for (const g of r.grandes) {
    const depart: Pt = [g.p[0] + (rnd() - 0.5) * 160, g.p[1] + (rnd() - 0.5) * 120];
    const pts = trace(rnd, depart, g.a + (rnd() - 0.5) * 0.3, 2800, r);
    parcours.push(...pts);
    t.brume += ligne(pts);
    t.grandes += ruban(pts, r.largeur[0], r.largeur[1], rnd() * 6);
    t.lumiere += ligne(pts.map(([x, y]) => [x - 2.2, y - 2.2] as Pt));
    for (let b = 0; b < r.ramures; b++) {
      const i = Math.max(1, Math.floor(pts.length * (0.15 + rnd() * 0.7)));
      const ai = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
      const ram = trace(rnd, pts[i], ai + (rnd() < 0.5 ? -1 : 1) * (0.35 + rnd() * 0.45), 280 + rnd() * 480, r);
      t.ramures += ruban(ram, r.largeur[0] * 0.5, r.largeur[1] * 0.42, rnd() * 6);
    }
  }
  for (let k = 0; k < r.fils; k++) {
    t.fils += ligne(trace(rnd, [rnd() * W, rnd() * H], rnd() * Math.PI * 2, 240 + rnd() * 420, r));
  }
  for (let k = 0; k < r.poussiere && parcours.length; k++) {
    const [x, y] = parcours[Math.floor(rnd() * parcours.length)];
    t.poussiere += rond([x + (rnd() - 0.5) * 70, y + (rnd() - 0.5) * 70], 0.8 + rnd() ** 2 * 1.8);
  }
  return t;
}

function Marbre({ m, seed }: { m: Couleurs; seed: number }) {
  const v = memo(`marbre:${seed}`, () => traitsVeines(seed, MARBRE));
  return (
    <>
      <g fill="none" stroke={m.fonce} strokeLinecap="round" strokeLinejoin="round">
        <path d={v.brume} strokeWidth={64} opacity={0.14} />
        <path d={v.brume} strokeWidth={26} opacity={0.18} />
        <path d={v.fils} strokeWidth={0.9} opacity={0.7} />
      </g>
      <path d={v.ramures} fill={m.fonce} opacity={0.8} />
      <path d={v.grandes} fill={m.fonce} />
      <path d={v.lumiere} fill="none" stroke={m.clair} strokeWidth={1.4} opacity={0.75} />
    </>
  );
}

/* -------------------------------- Météorite -------------------------------- */

// Les figures de Widmanstätten : dans chaque grain du fer, des lamelles en
// trois familles à 60° (l'octaèdre), longues, serrées et parallèles, qui se
// croisent et prennent la lumière chacune à sa façon ; un grain à côté, tout
// tourne. Les grains, ce sont cinq centres tirés au hasard : une lamelle
// prend l'orientation du centre le plus proche de son milieu.
const GRAINS = 5;
const LAMELLES = 720;

interface TraitsMeteorite {
  vives: string;
  claires: string;
  sombres: string;
  creux: string;
}

function traitsMeteorite(seed: number): TraitsMeteorite {
  const rnd = alea(seed ^ 0x1b873593);
  const grains = Array.from({ length: GRAINS }, () => ({
    c: [rnd() * W, rnd() * H] as Pt,
    a: rnd() * Math.PI,
  }));
  const t: TraitsMeteorite = { vives: "", claires: "", sombres: "", creux: "" };
  for (let k = 0; k < LAMELLES; k++) {
    const c: Pt = [rnd() * (W + 120) - 60, rnd() * (H + 120) - 60];
    let g = grains[0];
    for (const x of grains) if (Math.hypot(x.c[0] - c[0], x.c[1] - c[1]) < Math.hypot(g.c[0] - c[0], g.c[1] - c[1])) g = x;
    const a = g.a + ((k % 3) * Math.PI) / 3 + (rnd() - 0.5) * 0.025;
    const l = 120 + rnd() ** 1.4 * 620;
    const e = 7 + rnd() ** 1.8 * 30;
    const u: Pt = [Math.cos(a) * (l / 2), Math.sin(a) * (l / 2)];
    const n: Pt = [-Math.sin(a) * (e / 2), Math.cos(a) * (e / 2)];
    const p1: Pt = [c[0] - u[0] + n[0], c[1] - u[1] + n[1]];
    const p2: Pt = [c[0] + u[0] + n[0], c[1] + u[1] + n[1]];
    const p3: Pt = [c[0] + u[0] - n[0], c[1] + u[1] - n[1]];
    const p4: Pt = [c[0] - u[0] - n[0], c[1] - u[1] - n[1]];
    const bande = `${ligne([p1, p2, p3, p4])}Z`;
    const r = rnd();
    if (r < 0.12) t.vives += bande;
    else if (r < 0.5) t.claires += bande;
    else t.sombres += bande;
    // Le liseré de l'attaque à l'acide, d'un seul côté : un creux fin.
    if (rnd() < 0.5) t.creux += seg(p4, p3);
  }
  return t;
}

function Meteorite({ m, seed }: { m: Couleurs; seed: number }) {
  const t = memo(`meteorite:${seed}`, () => traitsMeteorite(seed));
  return (
    <>
      <path d={t.sombres} fill={m.fonce} opacity={0.13} />
      <path d={t.claires} fill={m.clair} opacity={0.045} />
      <path d={t.vives} fill={m.clair} opacity={0.09} />
      <path d={t.creux} fill="none" stroke={m.fonce} strokeWidth={1} opacity={0.3} />
    </>
  );
}

/* ------------------------------ Tes couleurs ------------------------------ */

// Les bandes du drapeau, de l'extérieur vers l'intérieur, le long des deux
// bords : 30 de large, à 8 du bord (le portrait commence à 41).
const BANDES = { x: 8, l: 30 };

function Couleurs({ m, bandes, trame, id }: { m: Couleurs; bandes: string[]; trame: string; id: string }) {
  const n = Math.max(1, bandes.length);
  const b = BANDES.l / n;
  const gauche = (i: number) => BANDES.x + i * b;
  const droite = (i: number) => W - BANDES.x - (i + 1) * b;
  const bords = [BANDES.x, BANDES.x + BANDES.l, W - BANDES.x - BANDES.l, W - BANDES.x];
  return (
    <>
      <defs>
        <pattern id={`maille-${id}`} width={14} height={12} patternUnits="userSpaceOnUse">
          <circle cx={3.5} cy={3} r={2.1} fill={trame} />
          <circle cx={10.5} cy={9} r={2.1} fill={trame} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#maille-${id})`} />
      {bandes.map((c, i) => (
        <g key={i}>
          <rect x={f(gauche(i))} y={0} width={f(b)} height={H} fill={c} />
          <rect x={f(droite(i))} y={0} width={f(b)} height={H} fill={c} />
        </g>
      ))}
      {/* Cousues : un filet sombre entre deux bandes et de part et d'autre, une arête claire contre le blanc. */}
      <g stroke={m.fonce}>
        {bandes.slice(1).map((_, i) => (
          <g key={i} strokeWidth={0.9}>
            <line x1={f(gauche(i + 1))} y1={0} x2={f(gauche(i + 1))} y2={H} />
            <line x1={f(droite(i))} y1={0} x2={f(droite(i))} y2={H} />
          </g>
        ))}
        {bords.map((x) => (
          <line key={x} x1={x} y1={0} x2={x} y2={H} strokeWidth={1.4} />
        ))}
      </g>
      <g stroke={m.clair} strokeWidth={1.2}>
        <line x1={BANDES.x + BANDES.l + 1.6} y1={0} x2={BANDES.x + BANDES.l + 1.6} y2={H} />
        <line x1={W - BANDES.x - BANDES.l - 1.6} y1={0} x2={W - BANDES.x - BANDES.l - 1.6} y2={H} />
      </g>
    </>
  );
}

/* ---------------------------------- Néon ---------------------------------- */

// Le tube : à 22 du bord, concentrique aux coins, ouvert en bas au-dessus de la série.
const TUBE = { d: 22, bas: 1536 };

function tube(): string {
  const { d, bas } = TUBE;
  const r = RAYON_CARTE - d;
  return `M${d} ${bas}L${d} ${f(d + r)}A${f(r)} ${f(r)} 0 0 1 ${f(d + r)} ${d}L${f(W - d - r)} ${d}A${f(r)} ${f(r)} 0 0 1 ${W - d} ${f(d + r)}L${W - d} ${bas}`;
}

// Ses attaches : sur les côtés et en haut, en travers du tube.
const ATTACHES: { x: number; y: number; h: boolean }[] = [
  { x: TUBE.d, y: 560, h: true },
  { x: TUBE.d, y: 1100, h: true },
  { x: W - TUBE.d, y: 560, h: true },
  { x: W - TUBE.d, y: 1100, h: true },
  { x: 330, y: TUBE.d, h: false },
  { x: W - 330, y: TUBE.d, h: false },
];

function Neon({ m }: { m: Couleurs }) {
  const d = tube();
  return (
    <>
      {/* Les fils des électrodes, jusqu'au bord. */}
      <g stroke="#2a262c" strokeWidth={2.2}>
        <line x1={TUBE.d} y1={TUBE.bas} x2={TUBE.d} y2={H} />
        <line x1={W - TUBE.d} y1={TUBE.bas} x2={W - TUBE.d} y2={H} />
      </g>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {[
          { l: 46, o: 0.06, c: m.fonce },
          { l: 26, o: 0.12, c: m.fonce },
          { l: 13, o: 0.3, c: m.fonce },
          { l: 6.5, o: 0.95, c: m.fonce },
          { l: 2.4, o: 1, c: m.clair },
        ].map(({ l, o, c }) => (
          <path key={l} d={d} stroke={c} strokeWidth={l} opacity={o} />
        ))}
      </g>
      {/* Les électrodes au bout du tube, et ses attaches. */}
      {[TUBE.d, W - TUBE.d].map((x) => (
        <g key={x}>
          <rect x={x - 6} y={TUBE.bas - 4} width={12} height={22} rx={3} fill="#1d1a20" />
          <line x1={x - 2.5} y1={TUBE.bas} x2={x - 2.5} y2={TUBE.bas + 14} stroke="rgba(255,255,255,0.22)" strokeWidth={1.4} />
        </g>
      ))}
      {ATTACHES.map(({ x, y, h }) => (
        <rect
          key={`${x}-${y}`}
          x={h ? x - 9 : x - 3}
          y={h ? y - 3 : y - 9}
          width={h ? 18 : 6}
          height={h ? 6 : 18}
          rx={2}
          fill="#1d1a20"
          opacity={0.92}
        />
      ))}
    </>
  );
}

/* --------------------------------- Aurore --------------------------------- */

// Trois rideaux : en haut, au milieu (le dos ; sur la face, sous le portrait),
// et en bas, au-dessus de la série. Chaque rayon est un seul trait, dont la
// couleur suit la hauteur : vert vif au pied du rideau, violet pâle en haut,
// puis rien.
const RIDEAUX = [
  { yb: 470, A: 70, lam: 1150, h: 400, penche: 34 },
  { yb: 1010, A: 46, lam: 820, h: 270, penche: -22 },
  { yb: 1562, A: 26, lam: 960, h: 340, penche: 26 },
];

interface TraitsAurore {
  rideaux: { rayons: string; voile: string; bord: string }[];
  etoiles: string;
}

function traitsAurore(seed: number): TraitsAurore {
  const rnd = alea(seed ^ 0x51ed270b);
  const rideaux = RIDEAUX.map(({ yb, A, lam, h, penche }) => {
    const ph = [rnd() * 6.28, rnd() * 6.28, rnd() * 6.28];
    let rayons = "";
    const bas: Pt[] = [];
    const haut: Pt[] = [];
    for (let x = -40; x <= W + 40; x += 5) {
      const y =
        yb + A * Math.sin((2 * Math.PI * x) / lam + ph[0]) + A * 0.35 * Math.sin((2 * Math.PI * x) / (lam * 0.37) + ph[1]);
      const enveloppe = h * (0.5 + 0.25 * (1 + Math.sin((2 * Math.PI * x) / (lam * 0.55) + ph[2])));
      const hr = enveloppe * (0.7 + rnd() * 0.45);
      bas.push([x, y]);
      haut.push([x + penche, y - enveloppe]);
      // Un rayon sur deux seulement, en longueurs inégales : les plis du rideau.
      if (rnd() < 0.55) rayons += seg([x, y], [x + penche * (hr / h), y - hr]);
    }
    return { rayons, voile: `${ligne([...bas, ...haut.reverse()])}Z`, bord: ligne(bas) };
  });
  let etoiles = "";
  for (let k = 0; k < 70; k++) etoiles += rond([rnd() * W, rnd() * H], 0.8 + rnd() ** 3 * 2.2);
  return { rideaux, etoiles };
}

function Aurore({ m, seed, id }: { m: Couleurs; seed: number; id: string }) {
  const t = memo(`aurore:${seed}`, () => traitsAurore(seed));
  return (
    <>
      <defs>
        {RIDEAUX.map(({ yb, A, h }, i) => (
          <linearGradient key={i} id={`aur-${i}-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1={yb + A} x2="0" y2={yb - A - h}>
            <stop offset="0" stopColor={m.clair} stopOpacity={0.9} />
            <stop offset="0.22" stopColor={m.clair} stopOpacity={0.5} />
            <stop offset="0.5" stopColor={m.fonce} stopOpacity={0.32} />
            <stop offset="0.8" stopColor={m.fonce} stopOpacity={0.1} />
            <stop offset="1" stopColor={m.fonce} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>
      <path d={t.etoiles} fill="#ffffff" opacity={0.55} />
      {t.rideaux.map((r, i) => (
        <g key={i} opacity={i === 2 ? 0.8 : 1}>
          <path d={r.voile} fill={`url(#aur-${i}-${id})`} opacity={0.28} />
          <path d={r.rayons} fill="none" stroke={`url(#aur-${i}-${id})`} strokeWidth={3.2} opacity={0.75} />
          <path d={r.bord} fill="none" stroke={m.clair} strokeWidth={9} opacity={0.08} />
          <path d={r.bord} fill="none" stroke={m.clair} strokeWidth={1.8} opacity={0.55} />
        </g>
      ))}
    </>
  );
}

/* ----------------------------------- Ki ----------------------------------- */

/**
 * Une langue de l'aura : son pied large en `pied`, sa pointe à `h` dans la
 * direction `cap` (−π/2 : vers le haut), décalée de `penche` sur le côté.
 * Flancs galbés, pointe nette : la flamme d'un trait de manga, pas une bougie.
 */
function langue(pied: Pt, cap: number, w: number, h: number, penche: number): string {
  const ux = Math.cos(cap);
  const uy = Math.sin(cap);
  // a : le long de la langue (0 au pied, h à la pointe) ; b : en travers, à sa droite.
  const P = (a: number, b: number) => `${f(pied[0] + ux * a - uy * b)} ${f(pied[1] + uy * a + ux * b)}`;
  return (
    `M${P(0, -w / 2)}` +
    `C${P(0.34 * h, -0.62 * w)} ${P(0.72 * h, -0.16 * w + 0.6 * penche)} ${P(h, penche)}` +
    `C${P(0.64 * h, 0.1 * w + 0.72 * penche)} ${P(0.3 * h, 0.6 * w)} ${P(0, w / 2)}Z`
  );
}

/**
 * La couronne de l'aura autour de la boule (le dos) : un arc sous elle, et
 * des pointes tout autour du haut, plus hautes au sommet, qui montent toutes
 * vers le ciel ; les flancs de chaque pointe se creusent vers son pied.
 */
function couronne(rnd: () => number, c: Pt, r: number, n: number, haut: number): string {
  const de = (-200 * Math.PI) / 180;
  const a = (20 * Math.PI) / 180;
  const pas = (a - de) / n;
  const sur = (t: number, rr = r): Pt => [c[0] + Math.cos(t) * rr, c[1] + Math.sin(t) * rr];
  const P = (p: Pt) => `${f(p[0])} ${f(p[1])}`;
  let v0 = sur(de);
  let d = `M${P(v0)}`;
  const phase = rnd() < 0.5 ? 0 : 1;
  for (let i = 0; i < n; i++) {
    const t1 = de + (i + 1) * pas;
    const tm = de + (i + 0.5 + (rnd() - 0.5) * 0.3) * pas;
    const v1 = i === n - 1 ? sur(a) : sur(t1, r * (0.97 + rnd() * 0.06));
    const pied = sur(tm);
    // Plus haute au sommet (−sin tm = 1), courte sur les côtés ; toujours vers le haut.
    const leve = Math.max(0, -Math.sin(tm));
    const h = haut * (0.28 + 0.72 * leve ** 1.4) * (0.72 + rnd() * 0.56) * ((i + phase) % 2 ? 0.66 : 1);
    const vent = (rnd() - 0.5) * 0.5;
    const dx = Math.cos(tm) * 0.5 + vent;
    const dy = Math.sin(tm) * 0.5 - 1;
    const l = Math.hypot(dx, dy);
    const pointe: Pt = [pied[0] + (dx / l) * h, pied[1] + (dy / l) * h];
    d += `Q${P(entre(entre(v0, pointe, 0.5), pied, 0.34))} ${P(pointe)}`;
    d += `Q${P(entre(entre(pointe, v1, 0.5), pied, 0.34))} ${P(v1)}`;
    v0 = v1;
  }
  const debut = sur(de);
  return `${d}A${f(r)} ${f(r)} 0 0 1 ${P(debut)}Z`;
}

/** Un éclair : des pas cassés autour de son cap, retenu près de son axe (il ne part pas sur le texte). */
function eclair(rnd: () => number, depart: Pt, cap: number, n: number, rappel: number): Pt[] {
  const ux = Math.cos(cap);
  const uy = Math.sin(cap);
  let p = depart;
  let cote = rnd() < 0.5 ? 1 : -1;
  const pts: Pt[] = [p];
  for (let i = 0; i < n; i++) {
    if (rnd() < 0.72) cote = -cote;
    p = vers(p, cap + cote * (0.4 + rnd() * 0.55), 16 + rnd() * 30);
    const ecart = (p[0] - depart[0]) * -uy + (p[1] - depart[1]) * ux;
    p = [p[0] + uy * ecart * rappel, p[1] - ux * ecart * rappel];
    pts.push(p);
  }
  return pts;
}

/** Une traînée qui monte : un trait effilé, large de `w` en bas, en pointe en haut. */
const trainee = ([x, y]: Pt, l: number, w: number) =>
  `M${f(x - w / 2)} ${f(y)}L${f(x + w / 2)} ${f(y)}L${f(x)} ${f(y - l)}Z`;

// Le centre de la rosace du dos (dos-carte.tsx, ROSACE) : la boule dans son aura.
const BOULE: Pt = [512, 738];

interface TraitsKi {
  /** Les langues de l'aura, chacune son tracé (son dégradé la suit) : le halo, le corps, le cœur. */
  langues: { halo: string; corps: string; coeur: string }[];
  /** Le dos : la couronne autour de la boule, du dehors au dedans. */
  couronnes: string[];
  stries: string;
  striesVives: string;
  eclairs: string;
  ramures: string;
  etincelles: string;
}

function traitsKi(seed: number, dos: boolean): TraitsKi {
  const rnd = alea(seed ^ 0x7f4a7c15);
  const t: TraitsKi = {
    langues: [],
    couronnes: [],
    stries: "",
    striesVives: "",
    eclairs: "",
    ramures: "",
    etincelles: "",
  };
  const haut = -Math.PI / 2;
  const ajoute = (pied: Pt, w: number, h: number, penche: number) =>
    t.langues.push({
      halo: langue(pied, haut, w * 1.34, h * 1.1, penche * 1.1),
      corps: langue(pied, haut, w, h, penche),
      coeur: langue([pied[0] + penche * 0.04, pied[1]], haut, w * 0.4, h * 0.6, penche * 0.5),
    });
  // Les côtés (la face) : de bas en haut, des langues qui penchent vers l'intérieur, de plus en
  // plus en montant ; derrière le portrait, on n'en voit que le bord, et les pointes dans les coins
  // du haut. Au dos, la couronne suffit.
  for (let y = H + 40; !dos && y > 300; y -= 100 + rnd() * 50) {
    const monte = 1 - y / H;
    const h = 320 + rnd() * 200;
    const w = 54 + rnd() * 30;
    const penche = 14 + rnd() * 22 + monte * 30;
    ajoute([-14 + rnd() * 44, y], w, h, penche);
    ajoute([W + 14 - rnd() * 44, y - rnd() * 50], w, h * (0.9 + rnd() * 0.2), -penche);
  }
  // Les coins du bas : hautes au bord, plus courtes vers le milieu, rien au milieu (la note, les chiffres).
  for (const cote of [1, -1]) {
    for (let k = 0; k < 3; k++) {
      const x = cote > 0 ? 40 + k * 70 + rnd() * 20 : W - 40 - k * 70 - rnd() * 20;
      ajoute([x, H + 30], 96 + rnd() * 40, (430 - k * 120) * (0.85 + rnd() * 0.3), cote * (12 + rnd() * 18));
    }
  }
  // Les traînées qui montent : le long des côtés, dans les coins du bas, et au dos autour de la boule.
  const strie = (x: number, y: number) => {
    const l = 30 + rnd() ** 1.6 * 170;
    const s = trainee([x, y], l, 1.6 + rnd() * 2.4);
    if (rnd() < 0.3) t.striesVives += s;
    else t.stries += s;
  };
  for (let k = 0; k < 64; k++) {
    const gauche = k % 2 === 0;
    const bas = rnd() < 0.3;
    const x = bas ? (gauche ? 10 + rnd() * 190 : W - 10 - rnd() * 190) : gauche ? 4 + rnd() * 36 : W - 4 - rnd() * 36;
    const y = bas ? H - rnd() * 170 : 120 + rnd() * (H - 140);
    strie(x, y);
  }
  // Les éclairs : un long de chaque côté, qui monte, et un court en haut à droite ; une ramure chacun.
  const ECLAIRS: { p: Pt; cap: number; n: number }[] = [
    { p: [16, 1460], cap: haut, n: 17 },
    { p: [1008, 1230], cap: haut, n: 15 },
    { p: [1010, 560], cap: haut, n: 8 },
  ];
  if (dos)
    ECLAIRS.push(
      { p: [BOULE[0] - 372, BOULE[1] + 120], cap: haut - 0.2, n: 13 },
      { p: [BOULE[0] + 360, BOULE[1] + 40], cap: haut + 0.22, n: 11 }
    );
  for (const e of ECLAIRS) {
    const pts = eclair(rnd, e.p, e.cap, e.n, 0.55);
    t.eclairs += ligne(pts);
    const i = 2 + Math.floor(rnd() * (pts.length - 4));
    const cote = e.p[0] < W / 2 ? -1 : 1;
    t.ramures += ligne(eclair(rnd, pts[i], e.cap + cote * (0.5 + rnd() * 0.35), 3 + Math.floor(rnd() * 3), 0.2));
  }
  // Les étincelles qui montent : des points, le long des côtés et dans les coins du bas.
  for (let k = 0; k < 40; k++) {
    const ou = rnd();
    const x = ou < 0.4 ? 6 + rnd() * 80 : ou < 0.8 ? W - 6 - rnd() * 80 : rnd() < 0.5 ? rnd() * 220 : W - rnd() * 220;
    const y = ou < 0.8 ? 140 + rnd() * (H - 240) : H - 30 - rnd() * 260;
    t.etincelles += rond([x, y], 1.1 + rnd() ** 2 * 2.6);
  }
  if (dos) {
    // La couronne, en trois couches ; ses traînées et ses étincelles autour.
    t.couronnes = [couronne(rnd, BOULE, 372, 15, 430), couronne(rnd, BOULE, 352, 13, 290), couronne(rnd, BOULE, 334, 11, 160)];
    for (let k = 0; k < 46; k++) {
      const a = -Math.PI * (0.06 + rnd() * 0.88) - (rnd() < 0.5 ? 0 : Math.PI * 0.08);
      const r = 340 + rnd() * 220;
      strie(BOULE[0] + Math.cos(a) * r, BOULE[1] + Math.sin(a) * r * 0.85 + 40);
    }
    for (let k = 0; k < 30; k++) {
      const a = -Math.PI * rnd() * 1.1 + 0.05;
      const r = 380 + rnd() * 300;
      t.etincelles += rond([BOULE[0] + Math.cos(a) * r, BOULE[1] + Math.sin(a) * r], 1.1 + rnd() ** 2 * 2.6);
    }
  }
  return t;
}

function Ki({ m, seed, id, dos }: { m: Couleurs; seed: number; id: string; dos: boolean }) {
  const t = memo(`ki:${seed}:${dos ? 1 : 0}`, () => traitsKi(seed, dos));
  // Chaque langue s'éteint de son pied à sa pointe (un dégradé dans sa boîte) ; la couronne, depuis la boule.
  const pied = (cle: string, stops: [number, number][], couleur = m.clair) => (
    <linearGradient id={`${cle}-${id}`} x1="0" y1="1" x2="0" y2="0">
      {stops.map(([o, a]) => (
        <stop key={o} offset={o} stopColor={couleur} stopOpacity={a} />
      ))}
    </linearGradient>
  );
  return (
    <>
      <defs>
        {pied("kh", [
          [0, 0],
          [0.18, 0.1],
          [0.55, 0.05],
          [1, 0],
        ])}
        {pied("kc", [
          [0, 0],
          [0.14, 0.26],
          [0.45, 0.15],
          [0.85, 0.04],
          [1, 0.01],
        ])}
        {pied("kk", [
          [0, 0],
          [0.12, 0.7],
          [0.4, 0.45],
          [0.8, 0.12],
          [1, 0.03],
        ])}
        {pied("ks", [
          [0, 0],
          [0.12, 0.6],
          [0.6, 0.26],
          [1, 0.06],
        ])}
        {dos && (
          <radialGradient id={`kr-${id}`} gradientUnits="userSpaceOnUse" cx={BOULE[0]} cy={BOULE[1]} r={800}>
            <stop offset={0} stopColor={m.clair} stopOpacity={0} />
            <stop offset={0.3} stopColor={m.clair} stopOpacity={0} />
            <stop offset={0.41} stopColor={m.clair} stopOpacity={0.3} />
            <stop offset={0.48} stopColor={m.clair} stopOpacity={0.2} />
            <stop offset={0.72} stopColor={m.clair} stopOpacity={0.06} />
            <stop offset={1} stopColor={m.clair} stopOpacity={0} />
          </radialGradient>
        )}
        {dos && (
          // L'aura monte : pleine en haut, elle s'éteint sous la boule.
          <linearGradient id={`kv-${id}`} gradientUnits="userSpaceOnUse" x1="0" y1={BOULE[1] - 120} x2="0" y2={BOULE[1] + 380}>
            <stop offset={0} stopColor="#fff" stopOpacity={1} />
            <stop offset={1} stopColor="#fff" stopOpacity={0.3} />
          </linearGradient>
        )}
        {dos && (
          <mask id={`km-${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect width={W} height={H} fill={`url(#kv-${id})`} />
          </mask>
        )}
      </defs>
      <g mask={dos ? `url(#km-${id})` : undefined}>
        {t.couronnes.map((d, i) => (
          <path key={i} d={d} fill={`url(#kr-${id})`} />
        ))}
        {t.couronnes.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={m.clair} strokeWidth={[2, 1.5, 1.2][i]} opacity={[0.18, 0.34, 0.6][i]} />
        ))}
      </g>
      {t.langues.map((l, i) => (
        <path key={i} d={l.halo} fill={`url(#kh-${id})`} />
      ))}
      {t.langues.map((l, i) => (
        <path key={i} d={l.corps} fill={`url(#kc-${id})`} stroke={`url(#ks-${id})`} strokeWidth={1.4} />
      ))}
      {t.langues.map((l, i) => (
        <path key={i} d={l.coeur} fill={`url(#kk-${id})`} />
      ))}
      <path d={t.stries} fill={m.clair} opacity={0.3} />
      <path d={t.striesVives} fill={m.clair} opacity={0.7} />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={t.eclairs} stroke={m.fonce} strokeWidth={14} opacity={0.08} />
        <path d={t.eclairs} stroke={m.fonce} strokeWidth={6} opacity={0.24} />
        <path d={t.eclairs} stroke={m.clair} strokeWidth={2.2} />
        <path d={t.ramures} stroke={m.fonce} strokeWidth={5} opacity={0.2} />
        <path d={t.ramures} stroke={m.clair} strokeWidth={1.4} />
      </g>
      <path d={t.etincelles} fill={m.clair} opacity={0.85} />
    </>
  );
}

/* --------------------------------- Le motif -------------------------------- */

export function MotifPasseSvg({
  motif,
  graine = 1,
  dos = false,
}: {
  motif: MotifPasse & Couleurs;
  graine?: number;
  /** Le dos de la carte : le ki y pose la boule dans sa couronne d'aura, tes couleurs y prennent leurs couleurs. */
  dos?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const style: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%" };
  const m = { clair: motif.clair, fonce: motif.fonce };
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={style}>
      {estMotifGivre(motif) ? (
        <MotifGivre type={motif.type} m={m} graine={graine} id={id} />
      ) : motif.type === "givre" ? (
        <Givre m={m} seed={graine} id={id} />
      ) : motif.type === "carbone" ? (
        <Carbone m={m} id={id} />
      ) : motif.type === "marbre" ? (
        <Marbre m={m} seed={graine} />
      ) : motif.type === "couleurs" ? (
        <Couleurs m={m} bandes={dos ? motif.bandes : motif.encre} trame={motif.trame} id={id} />
      ) : motif.type === "neon" ? (
        <Neon m={m} />
      ) : motif.type === "aurore" ? (
        <Aurore m={m} seed={graine} id={id} />
      ) : motif.type === "ki" ? (
        <Ki m={m} seed={graine} id={id} dos={dos} />
      ) : (
        <Meteorite m={m} seed={graine} />
      )}
    </svg>
  );
}
