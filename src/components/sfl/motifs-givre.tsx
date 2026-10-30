"use client";

// Les motifs des skins de la Saison Givre (skins-passe.ts, PASSE_GIVRE),
// dans le même contrat que motifs-passe.tsx : du SVG dans le repère de la
// carte (1024 × 1656), des gravures ton sur ton et sans flou (une lueur, ce
// sont des traits superposés), tirées de la graine du joueur, calculées une
// fois (memo). L'hiver du Nord, sans bleu glacier (le bleu est à la
// Défensive), sans or ni rouge : du noir, du blanc, du métal, et le vert et
// le violet de l'aurore.
//   · bois brûlé : le bois brûlé à la flamme, fendu en écailles (les
//     écailles d'alligator du shou sugi ban), le fil du bois dessous ;
//   · fer : le fer martelé, chaque coup de marteau une cuvette, l'ombre en
//     haut et la lumière en bas ; des rivets le long du bord ;
//   · pierre : le granit gris des pierres runiques, son grain, et le ruban
//     torsadé qui court le long du bord, comme le serpent des stèles ;
//   · nuit polaire : le noir de décembre, les étoiles, une lune basse
//     d'argent et son halo en cercles, les collines de neige en bas ;
//   · frimas : la glace blanche, ses fêlures, et des cristaux de neige à six
//     branches ;
//   · damas : l'acier damassé des lames, ses couches pliées qui ondulent, se
//     serrent et s'écartent sans jamais se croiser ;
//   · aurore polaire : un seul grand rideau qui monte en diagonale, vert au
//     pied, violet en haut, au-dessus d'un fjord noir et de ses sommets
//     enneigés ;
//   · tempête : la neige poussée par le vent, des flocons et des traînées
//     en biais, et les rafales ;
//   · jarl : le fer noir martelé, un double filet d'argent rivé, la neige qui
//     tombe d'en haut, et le souffle qui fume en bas.

import { RAYON_CARTE } from "@/components/sfl/finitions-carte";
import type { TypeMotifGivre } from "@/components/sfl/skins-passe";

const W = 1024;
const H = 1656;

type Pt = [number, number];
type Couleurs = { clair: string; fonce: string };

const f = (n: number) => Math.round(n * 10) / 10;

/** Un générateur pseudo-aléatoire stable (xorshift), comme celui de motifs-passe.tsx. */
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
const rond = ([x, y]: Pt, r: number) =>
  `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
/** Un arc de cercle de centre c, de l'angle a1 à a2 (sens horaire à l'écran). */
const arc = ([x, y]: Pt, r: number, a1: number, a2: number) => {
  const p1 = vers([x, y], a1, r);
  const p2 = vers([x, y], a2, r);
  return `M${f(p1[0])} ${f(p1[1])}A${f(r)} ${f(r)} 0 ${a2 - a1 > Math.PI ? 1 : 0} 1 ${f(p2[0])} ${f(p2[1])}`;
};

/* ------------------------------- Bois brûlé ------------------------------- */

interface TraitsBois {
  fil: string;
  ecailles: string;
  aretes: string;
}

function traitsBois(seed: number): TraitsBois {
  const rnd = alea(seed ^ 0x6b43a9b5);
  // Le fil du bois : des veines verticales qui ondulent et s'écartent autour des nœuds.
  let fil = "";
  for (let k = 0; k < 46; k++) {
    const x0 = rnd() * (W + 80) - 40;
    const lam = 260 + rnd() * 420;
    const ph = rnd() * 6.28;
    const A = 6 + rnd() * 18;
    const pts: Pt[] = [];
    for (let y = -20; y <= H + 20; y += 24) pts.push([x0 + A * Math.sin(y / lam * 6.28 + ph) + 4 * Math.sin(y / 37 + k), y]);
    fil += ligne(pts);
  }
  // Les écailles : le bois se fend le long du fil, en colonnes, puis en
  // travers, à des hauteurs qui ne s'alignent jamais d'une colonne à l'autre
  // (sinon ce serait un mur de briques) ; chaque bloc un polygone de travers,
  // aux bords qui hésitent, sa fente tout autour, son arête en haut à gauche.
  let ecailles = "";
  let aretes = "";
  const j = (a: number) => (rnd() - 0.5) * a;
  const bord = (p: Pt, q: Pt, n: number, amp: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      out.push([p[0] + (q[0] - p[0]) * t + j(amp), p[1] + (q[1] - p[1]) * t + j(amp)]);
    }
    return out;
  };
  for (let x = -20 - rnd() * 30; x < W + 20; ) {
    const l = 34 + rnd() * 40;
    for (let y = -40 - rnd() * 120; y < H + 20; ) {
      const h = 46 + rnd() ** 1.5 * 150;
      const g = 2.5 + rnd() * 3;
      const a: Pt = [x + g + j(5), y + g + j(5)];
      const b: Pt = [x + l - g + j(5), y + g + j(8)];
      const c: Pt = [x + l - g + j(5), y + h - g + j(5)];
      const d: Pt = [x + g + j(5), y + h - g + j(8)];
      const haut = bord(a, b, 3, 5);
      const droite = bord(b, c, Math.max(2, Math.round(h / 30)), 4);
      const bas = bord(c, d, 3, 5);
      const gauche = bord(d, a, Math.max(2, Math.round(h / 30)), 4);
      ecailles += `${ligne([a, ...haut, b, ...droite, c, ...bas, d, ...gauche])}Z`;
      aretes += ligne([d, ...gauche, a, ...haut, b]);
      y += h;
    }
    x += l;
  }
  return { fil, ecailles, aretes };
}

function BoisBrule({ m, seed }: { m: Couleurs; seed: number }) {
  const t = memo(`bois:${seed}`, () => traitsBois(seed));
  return (
    <>
      <path d={t.fil} fill="none" stroke={m.clair} strokeWidth={1.1} opacity={0.07} />
      {/* La fente : le noir entre les écailles, puis l'écaille un peu plus claire. */}
      <path d={t.ecailles} fill={m.clair} fillOpacity={0.035} stroke={m.fonce} strokeWidth={5} strokeOpacity={0.75} strokeLinejoin="round" />
      <path d={t.aretes} fill="none" stroke={m.clair} strokeWidth={1.3} opacity={0.32} strokeLinejoin="round" transform="translate(1.5 1.5)" />
    </>
  );
}

/* ------------------------------ Fer martelé ------------------------------ */

interface TraitsFer {
  ombres: string;
  lumieres: string;
  creux: string;
}

/** Les coups de marteau : une cuvette chacun, son ombre en haut à gauche, sa lumière en bas à droite. */
function traitsFer(seed: number, densite = 1): TraitsFer {
  const rnd = alea(seed ^ 0x2545f491);
  const t: TraitsFer = { ombres: "", lumieres: "", creux: "" };
  const pas = 46 / Math.sqrt(densite);
  for (let y = -20, rang = 0; y < H + 30; y += pas * 0.86, rang++) {
    for (let x = -20 + (rang % 2) * (pas / 2); x < W + 30; x += pas) {
      const c: Pt = [x + (rnd() - 0.5) * pas * 0.6, y + (rnd() - 0.5) * pas * 0.6];
      const r = pas * (0.42 + rnd() * 0.3);
      const tourne = (rnd() - 0.5) * 0.6;
      t.ombres += arc(c, r, Math.PI * 1.08 + tourne, Math.PI * 1.62 + tourne);
      t.lumieres += arc(c, r * 0.9, Math.PI * 0.12 + tourne, Math.PI * 0.62 + tourne);
      if (rnd() < 0.3) t.creux += rond(c, r * 0.7);
    }
  }
  return t;
}

/** Les rivets le long du bord, à `marge` : un tous les `pas` environ, et un à chaque coin. */
function rivets(marge: number, pas: number): Pt[] {
  const out: Pt[] = [];
  const r = RAYON_CARTE - marge;
  const x0 = marge + r * 0.3;
  const y0 = marge + r * 0.3;
  const x1 = W - x0;
  const y1 = H - y0;
  out.push([x0, y0], [x1, y0], [x1, y1], [x0, y1]);
  const nx = Math.max(1, Math.round((x1 - x0) / pas));
  for (let i = 1; i < nx; i++) out.push([x0 + ((x1 - x0) * i) / nx, marge], [x0 + ((x1 - x0) * i) / nx, H - marge]);
  const ny = Math.max(1, Math.round((y1 - y0) / pas));
  for (let i = 1; i < ny; i++) out.push([marge, y0 + ((y1 - y0) * i) / ny], [W - marge, y0 + ((y1 - y0) * i) / ny]);
  return out;
}

function Rivets({ m, pts, r }: { m: Couleurs; pts: Pt[]; r: number }) {
  const d = (k: number, dx = 0, dy = 0) => pts.map(([x, y]) => rond([x + dx, y + dy], r * k)).join("");
  return (
    <>
      <path d={d(1.15, 0.8, 1.6)} fill={m.fonce} opacity={0.55} />
      <path d={d(1)} fill={m.clair} opacity={0.45} />
      <path d={d(0.72, 0.6, 0.8)} fill={m.fonce} opacity={0.35} />
      <path d={d(0.32, -r * 0.3, -r * 0.3)} fill={m.clair} opacity={0.85} />
    </>
  );
}

function Martele({ m, t, force }: { m: Couleurs; t: TraitsFer; force: number }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={t.creux} fill={m.fonce} opacity={0.035 * force} />
      <path d={t.ombres} stroke={m.fonce} strokeWidth={7} opacity={0.1 * force} />
      <path d={t.ombres} stroke={m.fonce} strokeWidth={2.6} opacity={0.22 * force} />
      <path d={t.lumieres} stroke={m.clair} strokeWidth={4} opacity={0.06 * force} />
      <path d={t.lumieres} stroke={m.clair} strokeWidth={1.4} opacity={0.14 * force} />
    </g>
  );
}

function Fer({ m, seed }: { m: Couleurs; seed: number }) {
  const t = memo(`fer:${seed}`, () => traitsFer(seed));
  return (
    <>
      <Martele m={m} t={t} force={1} />
      <Rivets m={m} pts={rivets(20, 150)} r={7} />
    </>
  );
}

/* ------------------------------ Pierre runique ------------------------------ */

const CARREAU_PIERRE = 150;

interface TraitsPierre {
  grains: string;
  eclats: string;
  fissures: string;
  brins: [string, string];
}

/** Le chemin du bord (un rectangle aux coins arrondis, à `marge`), un point tous les `pas`. */
function tourDuBord(marge: number, pas: number): Pt[] {
  const r = RAYON_CARTE - marge;
  const pts: Pt[] = [];
  const cotes: { de: Pt; a: Pt; coin: Pt; a0: number }[] = [
    { de: [marge + r, marge], a: [W - marge - r, marge], coin: [W - marge - r, marge + r], a0: -Math.PI / 2 },
    { de: [W - marge, marge + r], a: [W - marge, H - marge - r], coin: [W - marge - r, H - marge - r], a0: 0 },
    { de: [W - marge - r, H - marge], a: [marge + r, H - marge], coin: [marge + r, H - marge - r], a0: Math.PI / 2 },
    { de: [marge, H - marge - r], a: [marge, marge + r], coin: [marge + r, marge + r], a0: Math.PI },
  ];
  for (const { de, a, coin, a0 } of cotes) {
    const l = Math.hypot(a[0] - de[0], a[1] - de[1]);
    const n = Math.max(1, Math.round(l / pas));
    for (let i = 0; i < n; i++) pts.push([de[0] + ((a[0] - de[0]) * i) / n, de[1] + ((a[1] - de[1]) * i) / n]);
    const na = Math.max(2, Math.round((r * Math.PI) / 2 / pas));
    for (let i = 0; i < na; i++) pts.push(vers(coin, a0 + ((Math.PI / 2) * i) / na, r));
  }
  return pts;
}

function traitsPierre(seed: number): TraitsPierre {
  const rnd = alea(seed ^ 0x7f4a7c15);
  let grains = "";
  let eclats = "";
  for (let k = 0; k < 150; k++) {
    const c: Pt = [rnd() * CARREAU_PIERRE, rnd() * CARREAU_PIERRE];
    if (rnd() < 0.62) grains += rond(c, 0.7 + rnd() ** 2 * 2.2);
    else eclats += rond(c, 0.6 + rnd() ** 2 * 1.4);
  }
  // Quelques fissures longues, qui hésitent.
  let fissures = "";
  for (let k = 0; k < 5; k++) {
    let p: Pt = [rnd() * W, rnd() * H];
    let a = rnd() * 6.28;
    const pts: Pt[] = [p];
    for (let i = 0; i < 26; i++) {
      a += (rnd() - 0.5) * 0.7;
      p = vers(p, a, 12 + rnd() * 14);
      pts.push(p);
    }
    fissures += ligne(pts);
  }
  // Le ruban torsadé : deux brins qui s'enroulent l'un sur l'autre autour du chemin du bord.
  const chemin = tourDuBord(22, 3);
  const brin = (phase: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= chemin.length; i++) {
      const p = chemin[i % chemin.length];
      const q = chemin[(i + 1) % chemin.length];
      const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
      pts.push(vers(p, a, 7.5 * Math.sin((i * 3) / 26 + phase)));
    }
    return ligne(pts);
  };
  return { grains, eclats, fissures, brins: [brin(0), brin(Math.PI)] };
}

function Pierre({ m, seed, id }: { m: Couleurs; seed: number; id: string }) {
  const t = memo(`pierre:${seed}`, () => traitsPierre(seed));
  return (
    <>
      <defs>
        <pattern id={`pierre-${id}`} width={CARREAU_PIERRE} height={CARREAU_PIERRE} patternUnits="userSpaceOnUse">
          <path d={t.grains} fill={m.fonce} opacity={0.5} />
          <path d={t.eclats} fill={m.clair} opacity={0.8} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#pierre-${id})`} />
      <path d={t.fissures} fill="none" stroke={m.fonce} strokeWidth={1.2} opacity={0.3} />
      <path d={t.fissures} fill="none" stroke={m.clair} strokeWidth={1} opacity={0.5} transform="translate(1 1.4)" />
      {/* Le ruban gravé : le creux de chaque brin, puis son arête. */}
      {t.brins.map((b, i) => (
        <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={b} stroke={m.fonce} strokeWidth={6.5} opacity={0.42} />
          <path d={b} stroke={m.clair} strokeWidth={1.6} opacity={0.75} transform="translate(-0.8 -1)" />
        </g>
      ))}
    </>
  );
}

/* ------------------------------- Nuit polaire ------------------------------- */

const LUNE: Pt = [770, 236];
const R_LUNE = 58;

interface TraitsNuit {
  etoiles: string;
  vives: string;
  crete: string;
  neige: string;
}

/** La ligne des collines de neige, autour de `y`, et le noir dessous. */
function collines(rnd: () => number, y: number, amplitude: number): { crete: string; neige: string } {
  const ph = [rnd() * 6.28, rnd() * 6.28];
  const pts: Pt[] = [];
  for (let x = -20; x <= W + 20; x += 8)
    pts.push([x, y - amplitude * (0.6 * Math.sin(x / 190 + ph[0]) + 0.4 * Math.sin(x / 71 + ph[1]))]);
  return { crete: ligne(pts), neige: `${ligne([...pts, [W + 20, H + 20], [-20, H + 20]])}Z` };
}

function traitsNuit(seed: number): TraitsNuit {
  const rnd = alea(seed ^ 0x4d2c6dfc);
  let etoiles = "";
  let vives = "";
  for (let k = 0; k < 140; k++) {
    const p: Pt = [rnd() * W, rnd() * H * 0.86];
    if (Math.hypot(p[0] - LUNE[0], p[1] - LUNE[1]) < R_LUNE * 2) continue;
    const r = 0.7 + rnd() ** 3 * 2;
    etoiles += rond(p, r);
    // Les plus vives scintillent : une croix fine.
    if (r > 1.9) vives += seg([p[0] - 9, p[1]], [p[0] + 9, p[1]]) + seg([p[0], p[1] - 9], [p[0], p[1] + 9]);
  }
  return { etoiles, vives, ...collines(rnd, 1520, 26) };
}

function NuitPolaire({ m, seed, id }: { m: Couleurs; seed: number; id: string }) {
  const t = memo(`nuit-polaire:${seed}`, () => traitsNuit(seed));
  return (
    <>
      <defs>
        <mask id={`croissant-${id}`}>
          <circle cx={LUNE[0]} cy={LUNE[1]} r={R_LUNE} fill="#fff" />
          <circle cx={LUNE[0] + R_LUNE * 0.42} cy={LUNE[1] - R_LUNE * 0.2} r={R_LUNE * 0.9} fill="#000" />
        </mask>
      </defs>
      <path d={t.etoiles} fill={m.clair} opacity={0.6} />
      <path d={t.vives} stroke={m.clair} strokeWidth={0.9} opacity={0.5} />
      {/* Le halo de la lune : des cercles de plus en plus pâles. */}
      {[0.07, 0.05, 0.035, 0.022].map((o, i) => (
        <circle key={o} cx={LUNE[0]} cy={LUNE[1]} r={R_LUNE * (1.35 + i * 0.55)} fill={m.clair} opacity={o} />
      ))}
      <circle cx={LUNE[0]} cy={LUNE[1]} r={R_LUNE} fill={m.clair} opacity={0.92} mask={`url(#croissant-${id})`} />
      <path d={t.neige} fill={m.clair} opacity={0.05} />
      <path d={t.crete} fill="none" stroke={m.clair} strokeWidth={8} opacity={0.06} />
      <path d={t.crete} fill="none" stroke={m.clair} strokeWidth={1.6} opacity={0.5} />
    </>
  );
}

/* --------------------------------- Frimas --------------------------------- */

interface TraitsFrimas {
  fentes: string;
  cristaux: string;
  fins: string;
}

/** Un cristal de neige : six branches, et sur chacune des rameaux à 60° de plus en plus courts. */
function cristal(rnd: () => number, c: Pt, r: number): { gros: string; fins: string } {
  let gros = "";
  let fins = "";
  const a0 = rnd() * Math.PI;
  const rameaux = 2 + Math.floor(rnd() * 2);
  for (let k = 0; k < 6; k++) {
    const a = a0 + (k * Math.PI) / 3;
    gros += seg(c, vers(c, a, r));
    for (let i = 1; i <= rameaux; i++) {
      const p = vers(c, a, (r * i) / (rameaux + 1));
      const l = r * 0.42 * (1 - (i - 1) / (rameaux + 1));
      fins += seg(p, vers(p, a + Math.PI / 3, l)) + seg(p, vers(p, a - Math.PI / 3, l));
    }
  }
  return { gros, fins };
}

function traitsFrimas(seed: number): TraitsFrimas {
  const rnd = alea(seed ^ 0x9e3779b9);
  // Les fêlures : d'un point d'impact, quelques fentes qui partent en zigzag, et leurs branches.
  let fentes = "";
  const fente = (p: Pt, a: number, n: number) => {
    const pts: Pt[] = [p];
    for (let i = 0; i < n; i++) {
      a += (rnd() - 0.5) * 0.9;
      p = vers(p, a, 14 + rnd() * 22);
      pts.push(p);
      if (n > 6 && rnd() < 0.18) fente(p, a + (rnd() < 0.5 ? 1 : -1) * (0.6 + rnd() * 0.6), Math.floor(n / 3));
    }
    fentes += ligne(pts);
  };
  for (let k = 0; k < 6; k++) {
    const p: Pt = [rnd() * W, rnd() * H];
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) fente(p, rnd() * 6.28, 6 + Math.floor(rnd() * 12));
  }
  // Les cristaux : quelques grands dans les marges et en bas, des petits partout.
  let cristaux = "";
  let fins = "";
  for (let k = 0; k < 34; k++) {
    const grand = k < 7;
    const c: Pt = [rnd() * W, rnd() * H];
    const x = cristal(rnd, c, grand ? 34 + rnd() * 30 : 8 + rnd() * 16);
    cristaux += x.gros;
    fins += x.fins;
  }
  return { fentes, cristaux, fins };
}

function Frimas({ m, seed }: { m: Couleurs; seed: number }) {
  const t = memo(`frimas:${seed}`, () => traitsFrimas(seed));
  const traits = (c: string) => (
    <>
      <path d={t.cristaux} stroke={c} strokeWidth={2.2} />
      <path d={t.fins} stroke={c} strokeWidth={1.3} />
    </>
  );
  return (
    <>
      {/* La glace prend aux bords : deux bandes blanches, la large et pâle, la fine. */}
      {[
        { l: 70, o: 0.35 },
        { l: 22, o: 0.5 },
      ].map(({ l, o }) => (
        <rect key={l} width={W} height={H} rx={RAYON_CARTE} fill="none" stroke={m.clair} strokeWidth={l} opacity={o} />
      ))}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={t.fentes} stroke={m.fonce} strokeWidth={1.3} opacity={0.4} />
        <path d={t.fentes} stroke={m.clair} strokeWidth={1.2} transform="translate(1.2 1.2)" />
      </g>
      <g fill="none" strokeLinecap="round" transform="translate(1.2 1.6)">
        {traits(m.fonce)}
      </g>
      <g fill="none" strokeLinecap="round">
        {traits(m.clair)}
      </g>
    </>
  );
}

/* --------------------------------- Damas --------------------------------- */

interface TraitsDamas {
  claires: string;
  sombres: string;
}

// Chaque couche est une ligne y = y0 + g(x, y0) ; g bouge moins vite avec y0
// que y0 lui-même (A/μ + B/ν < 1), donc deux couches ne se croisent jamais :
// elles se serrent et s'écartent, comme l'acier plié.
function traitsDamas(seed: number): TraitsDamas {
  const rnd = alea(seed ^ 0x85ebca6b);
  const ph = Array.from({ length: 5 }, () => rnd() * 6.28);
  const g = (x: number, y0: number) =>
    62 * Math.sin(x / 150 + y0 / 96 + ph[0]) +
    24 * Math.sin(x / 61 - y0 / 130 + ph[1]) +
    10 * Math.sin((x + y0) / 33 + ph[2]) * Math.sin(y0 / 210 + ph[3]);
  let claires = "";
  let sombres = "";
  let k = 0;
  for (let y0 = -120; y0 < H + 120; y0 += 9, k++) {
    const pts: Pt[] = [];
    for (let x = -20; x <= W + 20; x += 12) pts.push([x, y0 + g(x, y0)]);
    if (k % 2) claires += ligne(pts);
    else sombres += ligne(pts);
  }
  return { claires, sombres };
}

function Damas({ m, seed }: { m: Couleurs; seed: number }) {
  const t = memo(`damas:${seed}`, () => traitsDamas(seed));
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={t.sombres} stroke={m.fonce} strokeWidth={4.6} opacity={0.22} />
      <path d={t.claires} stroke={m.clair} strokeWidth={2.2} opacity={0.16} />
    </g>
  );
}

/* ----------------------------- Aurore polaire ----------------------------- */

interface TraitsAurorePolaire {
  /** Les rayons en trois tronçons, du pied vif au haut pâle : chacun s'éteint en montant. */
  rayons: [string, string, string];
  bord: string;
  etoiles: string;
  fjord: string;
  sommets: string;
  neige: string;
}

/** Le pied du rideau : une diagonale qui ondule, du bas à gauche vers le haut à droite. */
const PIED = (x: number, ph: number) => 1180 - 0.62 * x + 70 * Math.sin(x / 140 + ph) + 26 * Math.sin(x / 47 + ph * 2);

function traitsAurorePolaire(seed: number): TraitsAurorePolaire {
  const rnd = alea(seed ^ 0x27d4eb2f);
  const ph = rnd() * 6.28;
  const rayons: [string, string, string] = ["", "", ""];
  const bas: Pt[] = [];
  for (let x = -40; x <= W + 40; x += 5) {
    const y = PIED(x, ph);
    const h = (330 + 160 * Math.sin(x / 210 + ph * 1.7) ** 2) * (0.55 + rnd() * 0.5);
    bas.push([x, y]);
    if (rnd() > 0.55) continue;
    // Le rideau se plie : le rayon penche un peu, selon le pli.
    const penche = 18 * Math.sin(x / 90 + ph);
    const p = (t: number): Pt => [x + penche * t, y - h * t];
    rayons[0] += seg(p(0), p(0.22));
    rayons[1] += seg(p(0.22), p(0.55));
    rayons[2] += seg(p(0.55), p(1));
  }
  let etoiles = "";
  for (let k = 0; k < 90; k++) etoiles += rond([rnd() * W, rnd() * H * 0.85], 0.7 + rnd() ** 3 * 2);
  // Le fjord : deux pentes noires qui descendent vers l'eau, des sommets de neige.
  const ligneFjord: Pt[] = [];
  const pics: Pt[] = [];
  for (let x = -20; x <= W + 20; x += 6) {
    const v = Math.abs((x - W * 0.45) / (W / 2));
    const y = 1560 - 150 * v ** 1.4 - 28 * Math.abs(Math.sin(x / 53 + ph)) - 14 * Math.abs(Math.sin(x / 19 + ph));
    ligneFjord.push([x, y]);
  }
  for (let i = 2; i < ligneFjord.length - 2; i++) {
    const [a, b, c] = [ligneFjord[i - 1], ligneFjord[i], ligneFjord[i + 1]];
    if (b[1] < a[1] && b[1] < c[1] && b[1] < 1470) pics.push(b);
  }
  // La neige sur les sommets : un chevron court sous chaque pic.
  let neige = "";
  for (const [x, y] of pics) neige += ligne([[x - 16, y + 12], [x, y], [x + 16, y + 12]]);
  return {
    rayons,
    bord: ligne(bas),
    etoiles,
    fjord: `${ligne([...ligneFjord, [W + 20, H + 20], [-20, H + 20]])}Z`,
    sommets: ligne(ligneFjord),
    neige,
  };
}

function AurorePolaire({ m, seed }: { m: Couleurs; seed: number }) {
  const t = memo(`aurore-polaire:${seed}`, () => traitsAurorePolaire(seed));
  return (
    <>
      <path d={t.etoiles} fill="#ffffff" opacity={0.5} />
      <g fill="none" strokeWidth={3}>
        <path d={t.rayons[0]} stroke={m.clair} opacity={0.6} />
        <path d={t.rayons[1]} stroke={m.clair} opacity={0.26} />
        <path d={t.rayons[1]} stroke={m.fonce} opacity={0.14} />
        <path d={t.rayons[2]} stroke={m.fonce} opacity={0.16} />
      </g>
      {/* Le pied du rideau brille sans trait net : trois passes, de la plus large à la plus fine. */}
      <path d={t.bord} fill="none" stroke={m.clair} strokeWidth={22} opacity={0.05} />
      <path d={t.bord} fill="none" stroke={m.clair} strokeWidth={9} opacity={0.08} />
      <path d={t.bord} fill="none" stroke={m.clair} strokeWidth={3} opacity={0.14} />
      <path d={t.fjord} fill="#000" opacity={0.6} />
      <path d={t.sommets} fill="none" stroke="#ffffff" strokeWidth={1.4} opacity={0.35} />
      <path d={t.neige} fill="none" stroke="#ffffff" strokeWidth={2.2} opacity={0.6} strokeLinejoin="round" />
    </>
  );
}

/* -------------------------------- Tempête -------------------------------- */

interface TraitsTempete {
  trainees: string;
  fines: string;
  flocons: string;
  rafales: string;
}

/** La neige qui tombe et que le vent pousse vers la droite ; `haut` : plus dense en haut (le jarl). */
function traitsNeige(seed: number, n: number, haut = false): TraitsTempete {
  const rnd = alea(seed ^ 0x165667b1);
  const vent = 0.95; // en radians depuis l'horizontale : la neige tombe en biais
  let trainees = "";
  let fines = "";
  let flocons = "";
  for (let k = 0; k < n; k++) {
    const y = haut ? H * rnd() ** 1.8 : rnd() * H;
    const p: Pt = [rnd() * W, y];
    const l = 14 + rnd() ** 2 * 70;
    const a = vent + (rnd() - 0.5) * 0.18;
    if (rnd() < 0.45) trainees += seg(p, vers(p, a, l));
    else if (rnd() < 0.5) fines += seg(p, vers(p, a, l * 0.6));
    else flocons += rond(p, 1.2 + rnd() ** 2 * 3.4);
  }
  let rafales = "";
  for (let k = 0; k < (haut ? 0 : 9); k++) {
    const y0 = rnd() * H;
    const pts: Pt[] = [];
    const ph = rnd() * 6.28;
    const x0 = rnd() * W * 0.5 - 100;
    const l = 300 + rnd() * 500;
    for (let x = x0; x <= x0 + l; x += 10) pts.push([x, y0 + (x - x0) * 0.32 + 18 * Math.sin((x - x0) / 90 + ph)]);
    rafales += ligne(pts);
  }
  return { trainees, fines, flocons, rafales };
}

function Neige({ m, t, force = 1 }: { m: Couleurs; t: TraitsTempete; force?: number }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={t.rafales} stroke={m.clair} strokeWidth={14} opacity={0.06 * force} />
      <path d={t.rafales} stroke={m.clair} strokeWidth={1.2} opacity={0.3 * force} />
      {/* L'ombre de chaque flocon, puis le flocon : il se lit sur le clair comme sur le sombre. */}
      <g transform="translate(1.2 1.8)" opacity={0.28 * force}>
        <path d={t.trainees} stroke={m.fonce} strokeWidth={3.4} />
        <path d={t.flocons} fill={m.fonce} />
      </g>
      <path d={t.trainees} stroke={m.clair} strokeWidth={3.4} opacity={0.85 * force} />
      <path d={t.fines} stroke={m.clair} strokeWidth={1.8} opacity={0.6 * force} />
      <path d={t.flocons} fill={m.clair} opacity={0.9 * force} />
    </g>
  );
}

function Tempete({ m, seed }: { m: Couleurs; seed: number }) {
  const t = memo(`tempete:${seed}`, () => traitsNeige(seed, 420));
  return <Neige m={m} t={t} />;
}

/* ---------------------------------- Jarl ---------------------------------- */

function Jarl({ m, seed }: { m: Couleurs; seed: number }) {
  const fer = memo(`jarl-fer:${seed}`, () => traitsFer(seed ^ 0x51, 0.7));
  const neige = memo(`jarl-neige:${seed}`, () => traitsNeige(seed ^ 0x7a, 170, true));
  const souffle = memo(`jarl-souffle:${seed}`, () => {
    const rnd = alea(seed ^ 0x3c6ef372);
    let d = "";
    for (let k = 0; k < 7; k++) {
      const y0 = 1330 + k * 42 + rnd() * 20;
      const ph = rnd() * 6.28;
      const pts: Pt[] = [];
      for (let x = -20; x <= W + 20; x += 10) pts.push([x, y0 + 16 * Math.sin(x / (110 + k * 13) + ph)]);
      d += ligne(pts);
    }
    return d;
  });
  const argent: Couleurs = { clair: m.clair, fonce: "rgba(0,0,0,0.9)" };
  return (
    <>
      <Martele m={{ clair: "rgba(255,255,255,0.6)", fonce: m.fonce }} t={fer} force={0.8} />
      {/* Le souffle qui fume, en bas : des volutes larges et pâles. */}
      <g fill="none" stroke={m.clair} strokeLinecap="round">
        <path d={souffle} strokeWidth={34} opacity={0.035} />
        <path d={souffle} strokeWidth={12} opacity={0.05} />
        <path d={souffle} strokeWidth={1} opacity={0.18} />
      </g>
      <Neige m={argent} t={neige} force={0.75} />
      {/* Le double filet d'argent, rivé. */}
      {[
        { marge: 15, l: 3.2 },
        { marge: 27, l: 1.4 },
      ].map(({ marge, l }) => (
        <g key={marge} fill="none">
          <rect x={marge} y={marge + 1.5} width={W - 2 * marge} height={H - 2 * marge} rx={RAYON_CARTE - marge} stroke="#000" strokeWidth={l} opacity={0.5} />
          <rect x={marge} y={marge} width={W - 2 * marge} height={H - 2 * marge} rx={RAYON_CARTE - marge} stroke={m.clair} strokeWidth={l} opacity={0.85} />
        </g>
      ))}
      <Rivets m={argent} pts={rivets(21, 170)} r={6} />
    </>
  );
}

/* --------------------------------- Le motif -------------------------------- */

export function MotifGivre({ type, m, graine, id }: { type: TypeMotifGivre; m: Couleurs; graine: number; id: string }) {
  switch (type) {
    case "bois-brule":
      return <BoisBrule m={m} seed={graine} />;
    case "fer":
      return <Fer m={m} seed={graine} />;
    case "pierre":
      return <Pierre m={m} seed={graine} id={id} />;
    case "nuit-polaire":
      return <NuitPolaire m={m} seed={graine} id={id} />;
    case "frimas":
      return <Frimas m={m} seed={graine} />;
    case "damas":
      return <Damas m={m} seed={graine} />;
    case "aurore-polaire":
      return <AurorePolaire m={m} seed={graine} />;
    case "tempete":
      return <Tempete m={m} seed={graine} />;
    case "jarl":
      return <Jarl m={m} seed={graine} />;
  }
}
