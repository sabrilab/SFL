// Le skin de nation « Aït Yenni » (Algérie ; PACK AFRIQUE 2027).
//
// Trois savoir-faire d'Algérie, du Djurdjura au Sahara :
//   · les bijoux d'Aït Yenni (Grande Kabylie) : de l'argent, des alvéoles
//     d'émail cloisonné (vert, jaune) et des cabochons de corail sertis ;
//     les fibules rondes alternent rosaces d'émail et cabochons, cernées
//     d'un grènetis ;
//   · la vallée du M'zab (patrimoine mondial de l'UNESCO, 1982) : les cinq
//     ksour de Ghardaïa, leurs maisons serrées à la chaux et aux enduits
//     pâles, qui montent en gradins sur la colline ;
//   · la poterie kabyle, modelée et peinte à main levée par les femmes :
//     des triangles, des losanges et des filets brun-noir sur un engobe
//     clair, avec des touches d'ocre rouge (ni cercle ni spirale).
// La carte est un mur passé à la chaux :
//   · le papier : la chaux, ses passes de brosse ; l'encre : le brun-noir
//     de la peinture des potières ;
//   · la face : autour du portrait, une frise de poterie, des dents brunes et
//     d'ocre entre deux filets, et aux quatre coins un petit médaillon
//     d'argent, d'émail et de corail ; dans la bande du bas, à peine, les
//     maisons du M'zab en gradins, tirées de la graine (un ksar par joueur) ;
//   · le dos : la frise tout autour, une chaîne de losanges ; autour de la
//     lune, une grande fibule d'Aït Yenni, quatre rosaces d'émail et quatre
//     cabochons de corail sur un anneau cloisonné, entre deux grènetis ; sous
//     le logotype, le ksar, ses terrasses et ses ombres.
// Ce qu'on évite : tout emprunt au zellige marocain (ni étoile à huit
// branches, ni tesselles) ; les figures du Tassili ; les minarets et toute
// silhouette de mosquée ; l'émail bleu des bijoux (bleu cobalt : la DA le
// réserve) ; tout signe identitaire ou politique.

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, BANDE, CENTRE_DOS, f, H, W } from "./outils";

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

// La palette : la chaux, l'enduit pâle, le brun-noir des potières, l'ocre
// rouge, l'argent, l'émail vert ; le jaune et le corail (à valider → Q2).
const CHAUX = { haut: "#f4efe5", milieu: "#ece4d5", bas: "#e2d7c3" };
const BRUN = "46,36,30";
const OCRE_ROUGE = "156,82,52";
const SABLE = "214,190,150";
const VERT = { clair: "#5d9a7c", fonce: "#245a45" };
const JAUNE = { clair: "#e3c766", fonce: "#b08a2c" };
const CORAIL = { clair: "#d47a62", fonce: "#8e3524" };

/* --------------------------- Le pourtour arrondi --------------------------- */

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
  return { total, en, coins };
}

const rond = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;

/* ------------------------------ La frise de poterie ------------------------------ */

interface Frise {
  filets: string;
  dents: string;
  ocres: string;
  points: string;
  losanges: string;
  coins: Pt[];
}

/**
 * Une frise peinte de potière le long du pourtour : deux filets, et entre eux
 * des dents (triangles) tournées tour à tour vers l'intérieur, pleines de
 * brun, et vers l'extérieur, une sur deux à l'ocre rouge, l'autre marquée
 * d'un point. Au dos, une chaîne de losanges en plus. Les coins restent
 * libres pour les médaillons.
 */
function frise(seed: number, d: number, larg: number, bas: number, r: number, pas0: number, chaine: boolean): Frise {
  const rnd = alea(seed);
  const mi = d + larg / 2;
  const p = pourtour(mi, r, bas);
  const j = (v: number) => v + (rnd() - 0.5) * 1.2;
  const au = (s: number, o: number): Pt => {
    const [[x, y], [nx, ny]] = p.en(s);
    return [j(x + nx * o), j(y + ny * o)];
  };
  const libre = (s: number) => p.coins.some((c) => Math.abs(((s - c + p.total * 1.5) % p.total) - p.total / 2) < larg * 1.15);
  const n = Math.round(p.total / pas0);
  const pas = p.total / n;
  const h = larg / 2 - 5;
  let dents = "";
  let ocres = "";
  let points = "";
  let losanges = "";
  const seg = (a: Pt, b: Pt, c: Pt) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}L${f(c[0])} ${f(c[1])}Z`;
  for (let k = 0; k < n; k++) {
    const s = k * pas;
    if (libre(s) || libre(s + pas)) continue;
    // La dent vers l'intérieur (pointe vers le portrait), pleine.
    dents += seg(au(s, h), au(s + pas, h), au(s + pas / 2, -h));
    // La dent vers l'extérieur.
    if (k % 2) ocres += seg(au(s + pas / 2, -h), au(s + (3 * pas) / 2, -h), au(s + pas, h));
    else {
      const [x, y] = au(s + pas, -h * 0.25);
      points += rond(x, y, larg * 0.07);
    }
    if (chaine) {
      // La chaîne de losanges, au-dedans de la frise.
      const o = -larg / 2 - 14;
      const a = au(s, o), b = au(s + pas / 2, o - 9), c = au(s + pas, o), e = au(s + pas / 2, o + 9);
      losanges += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}L${f(c[0])} ${f(c[1])}L${f(e[0])} ${f(e[1])}Z`;
    }
  }
  const filet = (o: number) => {
    let dd = "";
    for (let s = 0; s <= p.total + 8; s += 8) {
      const [x, y] = au(s, o);
      dd += `${dd ? "L" : "M"}${f(x)} ${f(y)}`;
    }
    return dd;
  };
  const filets = filet(larg / 2) + filet(-larg / 2) + (chaine ? filet(-larg / 2 - 28) : "");
  return { filets, dents, ocres, points, losanges, coins: p.coins.map((c) => p.en(c)[0]) };
}

/* ------------------------------- Les médaillons ------------------------------- */

/** Un petit médaillon d'Aït Yenni : un serti d'argent, six alvéoles d'émail vert, un cabochon de corail, un grènetis. */
function Medaillon({ c, r, id }: { c: Pt; r: number; id: string }) {
  // Arrondis : le rendu du serveur et celui du téléphone écrivent les mêmes attributs.
  const cx = f(c[0]), cy = f(c[1]);
  let alveoles = "";
  let jaunes = "";
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2 + 0.12;
    const a1 = ((i + 1) / 6) * Math.PI * 2 - 0.12;
    const r0 = r * 0.46, r1 = r * 0.8;
    alveoles += `M${f(cx + Math.cos(a0) * r0)} ${f(cy + Math.sin(a0) * r0)}L${f(cx + Math.cos(a0) * r1)} ${f(cy + Math.sin(a0) * r1)}A${f(r1)} ${f(r1)} 0 0 1 ${f(cx + Math.cos(a1) * r1)} ${f(cy + Math.sin(a1) * r1)}L${f(cx + Math.cos(a1) * r0)} ${f(cy + Math.sin(a1) * r0)}A${f(r0)} ${f(r0)} 0 0 0 ${f(cx + Math.cos(a0) * r0)} ${f(cy + Math.sin(a0) * r0)}Z`;
    const am = (a0 + a1) / 2;
    jaunes += rond(cx + Math.cos(am) * r * 0.63, cy + Math.sin(am) * r * 0.63, r * 0.07);
  }
  let grenetis = "";
  const ng = Math.max(12, Math.round((2 * Math.PI * r * 0.92) / 6.5));
  for (let i = 0; i < ng; i++) {
    const a = (i / ng) * Math.PI * 2;
    grenetis += rond(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92, r * 0.06);
  }
  return (
    <g>
      <circle cx={f(cx + 1)} cy={f(cy + 1.6)} r={r} fill="rgba(46,36,30,0.28)" />
      <circle cx={cx} cy={cy} r={r} fill={`url(#ya-${id})`} />
      <path d={alveoles} fill={`url(#yv-${id})`} stroke="#c9cbcc" strokeWidth={f(r * 0.05)} />
      <path d={jaunes} fill={JAUNE.clair} />
      <circle cx={cx} cy={cy} r={f(r * 0.36)} fill="#cfd1d2" stroke="#8a8d90" strokeWidth={f(r * 0.04)} />
      <circle cx={cx} cy={cy} r={f(r * 0.27)} fill={`url(#yc-${id})`} />
      <circle cx={f(cx - r * 0.09)} cy={f(cy - r * 0.1)} r={f(r * 0.07)} fill="rgba(255,255,255,0.55)" />
      <path d={grenetis} fill="#e4e5e6" stroke="#7d8084" strokeWidth={f(r * 0.02)} />
    </g>
  );
}

/* --------------------------------- La fibule (dos) --------------------------------- */

interface Fibule {
  anneau: string;
  alveoles: string;
  jaunes: string;
  grenetis: string;
  rosaces: Pt[];
  cabochons: Pt[];
}

/**
 * La grande fibule autour de la lune : un anneau d'argent entre deux
 * grènetis, cloisonné d'alvéoles d'émail vert en écailles et de petits
 * triangles jaunes ; quatre rosaces d'émail alternent avec quatre cabochons
 * de corail sertis.
 */
function fibule(): Fibule {
  const { cx, cy } = CENTRE_DOS;
  const r0 = 340, r1 = 404;
  const anneau = rond(cx, cy, r1) + rond(cx, cy, r0);
  let alveoles = "";
  let jaunes = "";
  const n = 48;
  const pos = (a: number, r: number): Pt => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const centres = Array.from({ length: 8 }, (_, i) => -Math.PI / 2 + (i * Math.PI) / 4);
  const pres = (a: number) => centres.some((c) => Math.abs(Math.atan2(Math.sin(a - c), Math.cos(a - c))) < 0.15);
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((k + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const am = (a0 + a1) / 2;
    if (pres(am)) continue;
    const e = 0.012;
    const ri = r0 + 14, ro = r1 - 14;
    // Une alvéole en écaille : deux arcs, la pointe vers l'extérieur.
    const [ax, ay] = pos(a0 + e, ri);
    const [bx, by] = pos(a1 - e, ri);
    const [px, py] = pos(am, ro);
    const [c1x, c1y] = pos(a0 + e, ro - 4);
    const [c2x, c2y] = pos(a1 - e, ro - 4);
    alveoles += `M${f(ax)} ${f(ay)}Q${f(c1x)} ${f(c1y)} ${f(px)} ${f(py)}Q${f(c2x)} ${f(c2y)} ${f(bx)} ${f(by)}Z`;
    // Le petit triangle jaune entre deux écailles, la pointe vers l'intérieur.
    const [ux, uy] = pos(a1 - 0.03, ro + 2);
    const [vx, vy] = pos(a1 + 0.03, ro + 2);
    const [wx, wy] = pos(a1, ro - 18);
    if (!pres(a1)) jaunes += `M${f(ux)} ${f(uy)}L${f(vx)} ${f(vy)}L${f(wx)} ${f(wy)}Z`;
  }
  let grenetis = "";
  for (const [r, nn] of [[r0 + 6, 150], [r1 - 6, 176]] as [number, number][]) {
    for (let i = 0; i < nn; i++) {
      const [x, y] = pos((i / nn) * Math.PI * 2, r);
      grenetis += rond(x, y, 3.6);
    }
  }
  const rm = (r0 + r1) / 2;
  return {
    anneau,
    alveoles,
    jaunes,
    grenetis,
    rosaces: centres.filter((_, i) => i % 2 === 0).map((a) => pos(a, rm).map(f) as Pt),
    cabochons: centres.filter((_, i) => i % 2 === 1).map((a) => pos(a, rm).map(f) as Pt),
  };
}

/* ------------------------------- Le ksar du M'zab ------------------------------- */

interface Ksar {
  /** Les façades, par ton : chaux, enduit pâle, sable. */
  chaux: string;
  pale: string;
  sable: string;
  /** Les flancs à l'ombre, les acrotères, les ouvertures. */
  ombres: string;
  aretes: string;
  baies: string;
}

/**
 * Les maisons du M'zab en gradins : des rangs de cubes accolés qui montent
 * vers le haut de la colline, chaque rang un peu plus haut et plus petit que
 * celui de devant, qui le cache en partie ; les toits-terrasses bordés
 * d'acrotères, un flanc à l'ombre, de rares ouvertures. Ni minaret, ni
 * coupole. Un rang par entrée, du fond vers le devant.
 */
function ksar(seed: number, x0: number, x1: number, y0: number, y1: number, rangs: number): Ksar[] {
  const rnd = alea(seed ^ 0x6d7a6b);
  const rect = (x: number, y: number, l: number, h: number) => `M${f(x)} ${f(y)}h${f(l)}v${f(h)}h${f(-l)}Z`;
  const cx = x0 + (x1 - x0) * (0.4 + rnd() * 0.2);
  const rows: Ksar[] = [];
  for (let i = 0; i < rangs; i++) {
    const k: Ksar = { chaux: "", pale: "", sable: "", ombres: "", aretes: "", baies: "" };
    const t = i / Math.max(1, rangs - 1);
    const echelle = 0.6 + 0.4 * t;
    // La colline : le rang du fond monte au milieu, celui de devant est presque à plat.
    const colline = (x: number) => -(1 - t) * (y1 - y0) * 0.42 * Math.exp(-(((x - cx) / ((x1 - x0) * 0.32)) ** 2));
    const base = y0 + (y1 - y0) * (0.3 + 0.7 * t);
    let x = x0 - rnd() * 50 * echelle;
    while (x < x1) {
      const l = (54 + rnd() * 62) * echelle;
      const h = (40 + rnd() * 34) * echelle;
      const haut = base + colline(x + l / 2) - h + (rnd() - 0.5) * 12 * echelle;
      const bas = y1 + 10;
      const face = rect(x, haut, l, bas - haut);
      const ton = rnd();
      if (ton < 0.5) k.chaux += face;
      else if (ton < 0.8) k.pale += face;
      else k.sable += face;
      // Le flanc à l'ombre, à droite : la lumière vient de la gauche.
      const fl = 9 * echelle;
      k.ombres += rect(x + l - fl, haut, fl, bas - haut);
      // L'acrotère, et parfois une pièce en retrait sur la terrasse.
      k.aretes += `M${f(x)} ${f(haut)}h${f(l)}`;
      if (rnd() < 0.3) {
        const pl = l * 0.36, ph = 12 * echelle;
        const px = x + l * (0.12 + rnd() * 0.4);
        k.pale += rect(px, haut - ph, pl, ph);
        k.aretes += `M${f(px)} ${f(haut - ph)}h${f(pl)}`;
      }
      // Une ou deux baies, étroites, et parfois une porte basse.
      const nb = rnd() < 0.45 ? 2 : rnd() < 0.85 ? 1 : 0;
      for (let b = 0; b < nb; b++) k.baies += rect(x + l * (0.2 + b * 0.36 + rnd() * 0.08), haut + h * (0.22 + rnd() * 0.18), 5.5 * echelle, 9 * echelle);
      if (rnd() < 0.3) k.baies += rect(x + l * 0.3, haut + h * 0.62, 9 * echelle, 16 * echelle);
      x += l;
    }
    rows.push(k);
  }
  return rows;
}

/* -------------------------------- La chaux -------------------------------- */

/**
 * Les passes de brosse de la chaux : de larges traînées presque horizontales,
 * aux bords qui ondulent et qui s'amincissent aux deux bouts, plus claires
 * ou plus chargées, tirées de la graine (un mur par joueur).
 */
function brosse(seed: number): { clair: string; fonce: string } {
  const rnd = alea(seed ^ 0xc4a0);
  let clair = "";
  let fonce = "";
  for (let i = 0; i < 34; i++) {
    const y = rnd() * H;
    const x0 = -60 + rnd() * W * 0.6;
    const l = W * (0.4 + rnd() * 0.8);
    const e = 6 + rnd() * 26;
    const pente = (rnd() - 0.5) * 0.08;
    const ph = rnd() * 6;
    const haut: string[] = [];
    const bas: string[] = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const x = x0 + l * t;
      const yy = y + pente * l * t + Math.sin(t * 7 + ph) * 3;
      const ep = e * Math.sin(Math.PI * t) ** 0.6;
      haut.push(`${f(x)} ${f(yy - ep / 2 + Math.sin(t * 23 + ph) * 1.5)}`);
      bas.push(`${f(x)} ${f(yy + ep / 2 + Math.sin(t * 19 + ph * 2) * 1.5)}`);
    }
    const d = `M${haut.join("L")}L${bas.reverse().join("L")}Z`;
    if (rnd() < 0.62) clair += d;
    else fonce += d;
  }
  return { clair, fonce };
}

/* --------------------------------- Le motif --------------------------------- */

function AitYenni({ cote, m, graine, id }: PropsMotifNation) {
  const dos = cote === "dos";
  const br = memo(`brosse:${graine}`, () => brosse(graine));
  const defs = (
    <defs>
      <linearGradient id={`ya-${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f6f6f5" />
        <stop offset="0.45" stopColor="#a9acaf" />
        <stop offset="0.7" stopColor="#e2e3e4" />
        <stop offset="1" stopColor="#80838a" />
      </linearGradient>
      <linearGradient id={`yv-${id}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={VERT.clair} />
        <stop offset="1" stopColor={VERT.fonce} />
      </linearGradient>
      <radialGradient id={`yc-${id}`} cx="0.4" cy="0.35" r="0.7">
        <stop offset="0" stopColor={CORAIL.clair} />
        <stop offset="1" stopColor={CORAIL.fonce} />
      </radialGradient>
    </defs>
  );
  const ksarDe = (rows: Ksar[], force: number) => (
    <g opacity={force}>
      {rows.map((k, i) => (
        <g key={i}>
          <path d={k.chaux} fill="#f8f4ec" />
          <path d={k.pale} fill="#ecdcc2" />
          <path d={k.sable} fill={`rgb(${SABLE})`} />
          <path d={k.ombres} fill="rgba(120,88,58,0.26)" />
          <path d={k.aretes} fill="none" stroke="rgba(110,80,54,0.55)" strokeWidth={2} />
          <path d={k.baies} fill="rgba(70,52,38,0.6)" />
        </g>
      ))}
    </g>
  );
  const peint = (fr: Frise, w: number) => (
    <>
      <path d={fr.filets} fill="none" stroke={`rgba(${BRUN},0.85)`} strokeWidth={w} strokeLinejoin="round" />
      <path d={fr.dents} fill={`rgba(${BRUN},0.88)`} />
      <path d={fr.ocres} fill={`rgba(${OCRE_ROUGE},0.85)`} />
      <path d={fr.points + fr.losanges} fill={`rgba(${BRUN},0.85)`} />
    </>
  );

  if (!dos) {
    const fr = memo("frise-face", () => frise(0xa17, 8, 25, BANDE - 20.5, 71.5, 30, false));
    const k = memo(`ksar-face:${graine}`, () => ksar(graine, 20, W - 20, BANDE + 330, H - 24, 5));
    return (
      <>
        {defs}
        <path d={br.clair} fill={m.clair} />
        <path d={br.fonce} fill={m.fonce} />
        <defs>
          <linearGradient id={`yf-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0} />
            <stop offset="0.45" stopColor="#fff" stopOpacity={1} />
            <stop offset="1" stopColor="#fff" stopOpacity={1} />
          </linearGradient>
          <mask id={`ym-${id}`}>
            <rect x={0} y={BANDE} width={W} height={H - BANDE} fill={`url(#yf-${id})`} />
          </mask>
        </defs>
        <g mask={`url(#ym-${id})`}>{ksarDe(k, 0.34)}</g>
        {peint(fr, 2.2)}
        {fr.coins.map((c, i) => (
          <Medaillon key={i} c={c} r={19} id={id} />
        ))}
      </>
    );
  }

  const fr = memo("frise-dos", () => frise(0xa18, 36, 34, 1540, 64, 40, true));
  const fb = memo("fibule", fibule);
  const k = memo(`ksar-dos:${graine}`, () => ksar(graine, 112, W - 112, 1330, 1508, 4));
  return (
    <>
      {defs}
      <path d={br.clair} fill={m.clair} />
      <path d={br.fonce} fill={m.fonce} />
      {/* Le ksar, sous le logotype, dans la frise */}
      <defs>
        <clipPath id={`yk-${id}`}>
          <rect x={106} y={1294} width={W - 212} height={222} />
        </clipPath>
      </defs>
      <g clipPath={`url(#yk-${id})`}>{ksarDe(k, 0.9)}</g>
      {peint(fr, 2.6)}
      {fr.coins.map((c, i) => (
        <Medaillon key={i} c={c} r={30} id={id} />
      ))}
      {/* La fibule */}
      <path d={fb.anneau} fill="rgba(46,36,30,0.25)" fillRule="evenodd" transform="translate(2 3.5)" />
      <path d={fb.anneau} fill={`url(#ya-${id})`} fillRule="evenodd" stroke="#7d8084" strokeWidth={1.4} />
      <path d={fb.alveoles} fill={`url(#yv-${id})`} stroke="#d9dadb" strokeWidth={2.2} strokeLinejoin="round" />
      <path d={fb.jaunes} fill={JAUNE.clair} stroke={JAUNE.fonce} strokeWidth={0.8} />
      <path d={fb.grenetis} fill="#e9eaeb" stroke="#7d8084" strokeWidth={0.8} />
      {fb.rosaces.map((c, i) => (
        <Medaillon key={`r${i}`} c={c} r={36} id={id} />
      ))}
      {fb.cabochons.map(([x, y], i) => (
        <g key={`c${i}`}>
          <circle cx={f(x + 1.5)} cy={f(y + 2.5)} r={27} fill="rgba(46,36,30,0.3)" />
          <circle cx={x} cy={y} r={27} fill={`url(#ya-${id})`} stroke="#7d8084" strokeWidth={1.2} />
          <circle cx={x} cy={y} r={20} fill={`url(#yc-${id})`} stroke="#6f7276" strokeWidth={1} />
          <ellipse cx={f(x - 6)} cy={f(y - 7)} rx={6} ry={4} fill="rgba(255,255,255,0.45)" />
        </g>
      ))}
    </>
  );
}

const aitYenni: SkinNation = {
  nation: "dz",
  nom: "Aït Yenni",
  quoi: "L'argent, l'émail et le corail des bijoux d'Aït Yenni, la chaux des maisons du M'zab et la frise des potières kabyles.",
  sources: [
    { titre: "Smarthistory, les fibules kabyles d'Aït Yenni (émail vert, jaune et bleu, corail rouge)", url: "https://smarthistory.org/?p=80936" },
    { titre: "Michael Backman Ltd, collier berbère d'argent émaillé serti de corail (Grande Kabylie)", url: "https://www.michaelbackmanltd.com/object/berber-enamelled-silver-necklace-set-with-coral/" },
    { titre: "UNESCO, Vallée du M'Zab (patrimoine mondial, 1982)", url: "https://whc.unesco.org/fr/list/188" },
    { titre: "The Met, plats de Grande Kabylie peints de triangles, noir et beige, touches de rouge", url: "https://www.metmuseum.org/art/collection/search/635686" },
    { titre: "The Met, plat de Grande Kabylie : les potières combinent à leur manière des motifs convenus", url: "https://www.metmuseum.org/art/collection/search/635685" },
    { titre: "R. Randall-MacIver, la poterie kabyle classée par son décor, Journal of the Anthropological Institute (1902) ; J. L. Myres, sur l'absence du cercle et de la spirale" },
  ],
  dessine: true,
  matiere: {
    titre: "aït yenni",
    encre: BRUN,
    sombre: false,
    papier: [
      "radial-gradient(70% 40% at 24% 18%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
      "radial-gradient(60% 40% at 80% 70%, rgba(214,190,150,0.22) 0%, rgba(214,190,150,0) 70%)",
      `linear-gradient(166deg, ${CHAUX.haut} 0%, ${CHAUX.milieu} 55%, ${CHAUX.bas} 100%)`,
    ].join(", "),
    motif: { clair: "rgba(255,255,255,0.28)", fonce: "rgba(170,140,100,0.05)" },
    fond: "#f3eee4",
    lueur: "rgba(255,255,255,0.9)",
    rayures: 0.05,
    micro: 0.04,
    reflet: 0.3,
    coins: 0.55,
    etiquette: { fond: "transparent", bord: `rgba(${BRUN},0.5)`, texte: `rgba(${BRUN},0.8)` },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.9)", ombre: "rgba(70,52,38,0.16)" },
    puce: "linear-gradient(135deg, #f6f6f5, #a9acaf 45%, #e2e3e4 70%, #80838a)",
    cadre: `linear-gradient(152deg, #f4efe5 0%, #e2d7c3 50%, #d3c4a8 100%)`,
    voile: "rgba(46,36,30,0.55)",
    onglet: { fond: "#2e241e", encre: "#f4efe5" },
    vive: VERT.fonce,
    tranche: { couleur: "#e4dac7", metal: 0.08, rugosite: 0.7 },
    holo: { force: 0.28, teinte: [1, 0.97, 0.9] },
  },
  Motif: AitYenni,
};

export default aitYenni;
