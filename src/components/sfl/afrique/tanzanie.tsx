// Le skin de nation « Kanga » (Tanzanie, pays hôte ; PACK AFRIQUE 2027).
//
// Le kanga, l'étoffe de coton imprimée que l'on porte, offre et noue sur
// toute la côte swahilie depuis la fin du XIXe siècle. Il se lit toujours de
// la même façon : une bordure (pindo) tout autour, un centre (mji), et un
// cartouche (jina) où s'écrit d'ordinaire un message.
//   · le papier : le vert profond d'un kanga, l'encre crème ;
//   · le pindo : une bande noire tout autour de la carte, des losanges terre
//     de Sienne en aplat, cernés de points crème, et des points entre eux :
//     la manière de la peinture tingatinga de Dar es Salaam (aplats de laque,
//     contours pointillés), sans aucun animal ;
//   · aux coins, les clous des portes sculptées de la ville de pierre de
//     Zanzibar (patrimoine mondial, 2000), en fer sombre (pas en laiton) ;
//   · la face : le mji, un semis de points crème, derrière le portrait, et à
//     peine sur la bande du bas ;
//   · le dos : le mji en grand, un médaillon de lobes autour de la lune, et le
//     jina sous le logotype, qui porte le nom du joueur. Jamais un proverbe :
//     on n'invente pas un dicton swahili ;
//   · le totem (totems/tanzanie.tsx, 02/11/2026) : la girafe masaï peinte à la
//     manière tingatinga, le cou tendu vers la lune ; la lune et son médaillon
//     montent en haut à droite, au bout de son museau (LUNE_TANZANIE) ; au
//     dos, le microtexte se fait discret (0,02) ;
//   · le coton a vécu : les flammes du fil, la teinture passée par endroits,
//     l'ombre d'un second passage sous chaque point du mji, et, au dos, les
//     plis du pliage en quatre puis en huit (la face reste calme) ; tirés de
//     la graine.
// Ce qu'on évite : les animaux de la tingatinga, un proverbe inventé ou mal
// traduit, le laiton (l'or reste aux cartes MVP).

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, f, H, W } from "./outils";
import { LUNE_TANZANIE } from "./totems/tanzanie";

/** La lune et le médaillon au dos : montés en haut à droite, au bout du museau de la girafe (totems/tanzanie.tsx). */
const CENTRE_DOS = { cx: LUNE_TANZANIE.cx, cy: LUNE_TANZANIE.cy } as const;
/** L'échelle du médaillon : la lune passe de 300 à LUNE_TANZANIE.d. */
const K = LUNE_TANZANIE.d / 300;

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

// La palette : le vert profond, le noir, la crème, la terre de Sienne, le fer.
const VERT = { haut: "#18442f", milieu: "#0f3123", bas: "#092117" };
const NOIR = "#0a0e0b";
const CREME = "244,236,214";
const SIENNE = "#8f5131";
const SIENNE_OMBRE = "#6f3a1f";

/** Le pindo : son milieu (inset), sa demi-largeur, son rayon, et son bas (au-dessus de la ligne de série). */
const PINDO = { d: 25, demi: 15, r: 67, bas: 1590 };

/* --------------------------- Le pourtour arrondi --------------------------- */

/** Un point d'un rectangle arrondi à l'abscisse curviligne s, et sa direction. */
function pourtour(d: number, r: number, bas: number) {
  const x0 = d, y0 = d, x1 = W - d, y1 = bas;
  const lh = x1 - x0 - 2 * r;
  const lv = y1 - y0 - 2 * r;
  const q = (Math.PI / 2) * r;
  const arc = (cx: number, cy: number, a0: number) => (t: number): [Pt, number] => {
    const a = a0 + t / r;
    return [[cx + r * Math.cos(a), cy + r * Math.sin(a)], a + Math.PI / 2];
  };
  const segs: { l: number; pt: (t: number) => [Pt, number] }[] = [
    { l: lh, pt: (t) => [[x0 + r + t, y0], 0] },
    { l: q, pt: arc(x1 - r, y0 + r, -Math.PI / 2) },
    { l: lv, pt: (t) => [[x1, y0 + r + t], Math.PI / 2] },
    { l: q, pt: arc(x1 - r, y1 - r, 0) },
    { l: lh, pt: (t) => [[x1 - r - t, y1], Math.PI] },
    { l: q, pt: arc(x0 + r, y1 - r, Math.PI / 2) },
    { l: lv, pt: (t) => [[x0, y1 - r - t], -Math.PI / 2] },
    { l: q, pt: arc(x0 + r, y0 + r, Math.PI) },
  ];
  const total = segs.reduce((a, s) => a + s.l, 0);
  const coins: Pt[] = [];
  let acc = 0;
  const debuts: number[] = [];
  segs.forEach((s) => {
    debuts.push(acc);
    acc += s.l;
  });
  const en = (s: number): [Pt, number] => {
    let t = ((s % total) + total) % total;
    for (const sg of segs) {
      if (t <= sg.l) return sg.pt(t);
      t -= sg.l;
    }
    return segs[0].pt(0);
  };
  [1, 3, 5, 7].forEach((i) => coins.push(en(debuts[i] + segs[i].l / 2)[0]));
  return { total, en, coins, debuts, segs };
}

/** Un rectangle arrondi, en chemin. */
function rectArrondi(x0: number, y0: number, x1: number, y1: number, r: number): string {
  return `M${f(x0 + r)} ${f(y0)}H${f(x1 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)}V${f(y1 - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)}H${f(x0 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)}V${f(y0 + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)}Z`;
}

/* -------------------------------- Le pindo -------------------------------- */

interface Pindo {
  bande: string;
  losanges: string;
  contours: string;
  points: string;
  clous: Pt[];
}

/**
 * La bordure : une bande noire, des losanges en aplat de Sienne posés le long
 * du pourtour (on saute les coins, où vont les clous), leurs contours en
 * points crème, un point entre deux losanges.
 */
function pindo(): Pindo {
  const { d, demi, r, bas } = PINDO;
  const { en, debuts, segs, coins } = pourtour(d, r, bas);
  const bande =
    rectArrondi(d - demi, d - demi, W - d + demi, bas + demi, r + demi) +
    rectArrondi(d + demi, d + demi, W - d - demi, bas - demi, Math.max(4, r - demi));
  let losanges = "";
  let contours = "";
  let points = "";
  const demiL = 15;
  const demiH = 9.5;
  // Les côtés droits seulement : un nombre entier de losanges, centrés.
  [0, 2, 4, 6].forEach((i) => {
    const l = segs[i].l;
    const n = Math.max(1, Math.floor((l - 30) / 44));
    const pas = l / n;
    for (let k = 0; k < n; k++) {
      const [[x, y], a] = en(debuts[i] + pas * (k + 0.5));
      const c = Math.cos(a);
      const s = Math.sin(a);
      const p = (u: number, v: number): Pt => [x + c * u - s * v, y + s * u + c * v];
      const q = [p(-demiL, 0), p(0, -demiH), p(demiL, 0), p(0, demiH)];
      const chemin = `M${q.map(([a1, b1]) => `${f(a1)} ${f(b1)}`).join("L")}Z`;
      losanges += chemin;
      const q2 = [p(-demiL - 5, 0), p(0, -demiH - 3.4), p(demiL + 5, 0), p(0, demiH + 3.4)];
      contours += `M${q2.map(([a1, b1]) => `${f(a1)} ${f(b1)}`).join("L")}Z`;
      if (k < n - 1) {
        const [px, py] = p(pas / 2, 0);
        points += `M${f(px - 2.6)} ${f(py)}a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`;
      }
    }
  });
  return { bande, losanges, contours, points, clous: coins };
}

/** Un clou de porte de Zanzibar, vu de face : un cône de fer, sa rondelle, son reflet. */
function Clou({ c: [x, y], r, id }: { c: Pt; r: number; id: string }) {
  return (
    <g>
      <circle cx={f(x + 1.5)} cy={f(y + 2.5)} r={f(r * 1.12)} fill="rgba(0,0,0,0.55)" />
      <circle cx={f(x)} cy={f(y)} r={f(r * 1.12)} fill="#1c211e" stroke="rgba(160,170,165,0.35)" strokeWidth={1} />
      <circle cx={f(x)} cy={f(y)} r={f(r * 0.78)} fill={`url(#clou-${id})`} />
      <circle cx={f(x - r * 0.22)} cy={f(y - r * 0.26)} r={f(r * 0.16)} fill="rgba(226,232,228,0.75)" />
    </g>
  );
}

/* --------------------------------- Le mji --------------------------------- */

/** Le semis du mji : un point crème sur une grille en quinconce. */
const PAS_MJI = 34;

/**
 * Le médaillon du dos : une couronne de pétales effilés autour de la lune, à
 * la manière tingatinga, un long pétale d'aplat de Sienne cerné de noir et
 * pointillé de crème, puis un court pétale noir et un point crème au-delà, en alternance.
 */
function medaillon(): { longs: string; pointilles: string; courts: string; coeurs: string } {
  const { cx, cy } = CENTRE_DOS;
  const n = 20;
  const r0 = 338 * K;
  let longs = "";
  let pointilles = "";
  let courts = "";
  let coeurs = "";
  const P = (r: number, a: number): Pt => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const petale = (a: number, r1: number, r2: number, large: number) => {
    const m = (r1 + r2) / 2;
    const b = P(r1, a);
    const t = P(r2, a);
    const g = P(m, a - large / m);
    const d = P(m, a + large / m);
    return `M${f(b[0])} ${f(b[1])}Q${f(g[0])} ${f(g[1])} ${f(t[0])} ${f(t[1])}Q${f(d[0])} ${f(d[1])} ${f(b[0])} ${f(b[1])}Z`;
  };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    longs += petale(a, r0, 426 * K, 33 * K);
    pointilles += petale(a, r0 + 16 * K, 407 * K, 18 * K);
    const a2 = a + Math.PI / n;
    courts += petale(a2, r0 + 4 * K, 392 * K, 18 * K);
    const [hx, hy] = P(404 * K, a2);
    const rc = 4.2 * K + 0.6;
    coeurs += `M${f(hx - rc)} ${f(hy)}a${f(rc)} ${f(rc)} 0 1 0 ${f(2 * rc)} 0a${f(rc)} ${f(rc)} 0 1 0 ${f(-2 * rc)} 0`;
  }
  return { longs, pointilles, courts, coeurs };
}

/* --------------------------------- Le coton --------------------------------- */

/**
 * Le coton d'un kanga qu'on a porté et plié : les flammes du fil (des bouts
 * de trame plus épais), les plis du pliage en quatre puis en huit, un peu
 * gondolés, et la teinture passée par endroits. Tiré de la graine : chaque
 * étoffe a été pliée et portée à sa façon.
 */
function coton(seed: number): { flammes: string; plis: string; passe: { x: number; y: number; rx: number; ry: number; a: number }[] } {
  const rnd = alea(seed ^ 0x6b616e67);
  let flammes = "";
  for (let i = 0; i < 420; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const l = 6 + rnd() * 22;
    flammes += `M${f(x)} ${f(y)}h${f(l)}`;
  }
  const pli = (vertical: boolean, c: number) => {
    let d = "";
    const L = vertical ? H : W;
    for (let t = -10, k = 0; t <= L + 10; t += 60, k++) {
      const o = c + (rnd() - 0.5) * 3;
      d += vertical ? `${k ? "L" : "M"}${f(o)} ${t}` : `${k ? "L" : "M"}${t} ${f(o)}`;
    }
    return d;
  };
  const plis = pli(true, W / 2 + (rnd() - 0.5) * 16) + pli(false, H / 2 + (rnd() - 0.5) * 20) + pli(false, H / 4 + (rnd() - 0.5) * 20) + pli(false, (3 * H) / 4 + (rnd() - 0.5) * 20);
  const passe: { x: number; y: number; rx: number; ry: number; a: number }[] = [];
  for (let i = 0; i < 7; i++) passe.push({ x: rnd() * W, y: rnd() * H, rx: 90 + rnd() * 200, ry: 50 + rnd() * 120, a: 0.035 + rnd() * 0.04 });
  return { flammes, plis, passe };
}

/* --------------------------------- Le motif --------------------------------- */

function Kanga({ cote, m, nom, graine, id }: PropsMotifNation) {
  const dos = cote === "dos";
  const co = memo(`coton:${graine}`, () => coton(graine));
  const p = memo("pindo", pindo);
  const md = memo("medaillon", medaillon);
  const jina = dos && nom ? nom.toLocaleUpperCase("fr-FR") : null;
  const pointille = { strokeDasharray: "0 7.5", strokeLinecap: "round" as const };
  return (
    <>
      <defs>
        <pattern id={`mji-${id}`} width={PAS_MJI} height={PAS_MJI} patternUnits="userSpaceOnUse" x={W / 2} y={0}>
          {/* L'impression : le point crème, et l'ombre d'un second passage un peu décalé */}
          <circle cx={PAS_MJI / 4 + 0.9} cy={PAS_MJI / 4 + 1} r={dos ? 2.4 : 2} fill="rgba(0,0,0,0.22)" />
          <circle cx={(PAS_MJI * 3) / 4 + 0.9} cy={(PAS_MJI * 3) / 4 + 1} r={dos ? 2.4 : 2} fill="rgba(0,0,0,0.22)" />
          <circle cx={PAS_MJI / 4} cy={PAS_MJI / 4} r={dos ? 2.4 : 2} fill={m.clair} />
          <circle cx={(PAS_MJI * 3) / 4} cy={(PAS_MJI * 3) / 4} r={dos ? 2.4 : 2} fill={m.clair} />
          <circle cx={(PAS_MJI * 3) / 4} cy={PAS_MJI / 4} r={1.1} fill={m.fonce} />
          <circle cx={PAS_MJI / 4} cy={(PAS_MJI * 3) / 4} r={1.1} fill={m.fonce} />
        </pattern>
        <linearGradient id={`mf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={1} />
          <stop offset={dos ? 1 : 0.57} stopColor="#fff" stopOpacity={1} />
          <stop offset={dos ? 1 : 0.66} stopColor="#fff" stopOpacity={0.35} />
          <stop offset="1" stopColor="#fff" stopOpacity={0.35} />
        </linearGradient>
        <mask id={`mm-${id}`}>
          <rect width={W} height={H} fill={`url(#mf-${id})`} />
        </mask>
        <radialGradient id={`kp-${id}`}>
          <stop offset="0" stopColor="#ffffff" stopOpacity={1} />
          <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`clou-${id}`} cx="0.38" cy="0.34" r="0.75">
          <stop offset="0" stopColor="#8e9792" />
          <stop offset="0.45" stopColor="#3a413d" />
          <stop offset="1" stopColor="#0d100e" />
        </radialGradient>
      </defs>

      {/* Le coton : la teinture passée par endroits, les flammes du fil */}
      {co.passe.map((e, i) => (
        <ellipse key={`p${i}`} cx={f(e.x)} cy={f(e.y)} rx={f(e.rx)} ry={f(e.ry)} fill={`url(#kp-${id})`} opacity={f(e.a * 100) / 100} />
      ))}
      <path d={co.flammes} fill="none" stroke="rgba(255,255,255,0.045)" strokeWidth={1.6} strokeLinecap="round" />

      {/* Le mji : le semis de points (sur la face, à peine sous le portrait) */}
      <rect width={W} height={H} fill={`url(#mji-${id})`} mask={`url(#mm-${id})`} />

      {/* Les plis du pliage, au dos : un pli creux, sa lèvre claire (la face reste calme) */}
      {dos && (
        <>
          <path d={co.plis} fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth={16} />
          <path d={co.plis} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={1.3} />
          <path d={co.plis} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1} transform="translate(1.6 1.6)" />
        </>
      )}

      {dos && (
        <>
          {/* Le médaillon du mji autour de la lune */}
          <path d={md.longs} fill="rgba(0,0,0,0.45)" transform="translate(2 3)" />
          <path d={md.longs} fill={SIENNE} stroke={NOIR} strokeWidth={4} strokeLinejoin="round" />
          <path d={md.pointilles} fill="none" stroke={`rgba(${CREME},0.9)`} strokeWidth={3} {...pointille} />
          <path d={md.courts} fill={NOIR} stroke={`rgba(${CREME},0.55)`} strokeWidth={1.4} />
          <path d={md.coeurs} fill={`rgba(${CREME},0.8)`} />
          <circle cx={CENTRE_DOS.cx} cy={CENTRE_DOS.cy} r={332 * K} fill="none" stroke={NOIR} strokeWidth={6 * K + 1} />
          <circle cx={CENTRE_DOS.cx} cy={CENTRE_DOS.cy} r={324 * K} fill="none" stroke={`rgba(${CREME},0.75)`} strokeWidth={3.4 * K + 0.6} {...pointille} />

          {/* Le jina : le nom du joueur dans son cartouche */}
          {jina && (
            <g>
              <path d={rectArrondi(150, 1350, 874, 1446, 12)} fill="rgba(0,0,0,0.45)" transform="translate(2 3)" />
              <path d={rectArrondi(150, 1350, 874, 1446, 12)} fill={NOIR} stroke={SIENNE} strokeWidth={4} />
              <path d={rectArrondi(162, 1362, 862, 1434, 6)} fill="none" stroke={`rgba(${CREME},0.8)`} strokeWidth={3} {...pointille} />
              <text
                x={W / 2 + 7}
                y={1413}
                textAnchor="middle"
                style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
                fontWeight={800}
                fontSize={42}
                letterSpacing={14}
                fill={`rgba(${CREME},0.95)`}
              >
                {jina}
              </text>
            </g>
          )}
        </>
      )}

      {/* Le pindo : la bande noire, ses filets, les losanges cernés de points */}
      <path d={p.bande} fill={NOIR} fillRule="evenodd" />
      <path d={rectArrondi(PINDO.d - PINDO.demi + 4, PINDO.d - PINDO.demi + 4, W - PINDO.d + PINDO.demi - 4, PINDO.bas + PINDO.demi - 4, PINDO.r + PINDO.demi - 4)} fill="none" stroke={`rgba(${CREME},0.5)`} strokeWidth={1.4} />
      <path d={rectArrondi(PINDO.d + PINDO.demi - 4, PINDO.d + PINDO.demi - 4, W - PINDO.d - PINDO.demi + 4, PINDO.bas - PINDO.demi + 4, PINDO.r - PINDO.demi + 4)} fill="none" stroke={`rgba(${CREME},0.5)`} strokeWidth={1.4} />
      <path d={p.losanges} fill={SIENNE} stroke={SIENNE_OMBRE} strokeWidth={1} />
      <path d={p.contours} fill="none" stroke={`rgba(${CREME},0.85)`} strokeWidth={2.6} strokeDasharray="0 5.2" strokeLinecap="round" />
      <path d={p.points} fill={`rgba(${CREME},0.85)`} />

      {/* Les clous de fer, aux coins */}
      {p.clous.map((c, i) => (
        <Clou key={i} c={c} r={dos ? 18 : 16} id={id} />
      ))}
    </>
  );
}

const kanga: SkinNation = {
  nation: "tz",
  nom: "Kanga",
  quoi: "Le kanga de la côte swahilie, sa bordure et son cartouche, peint à la manière tingatinga, et les clous des portes de Zanzibar.",
  sources: [
    { titre: "Swahili Proverbs, université de l'Illinois : les kangas (pindo, mji, jina)", url: "https://swahiliproverbs.afrst.illinois.edu/kangas.htm" },
    { titre: "Google Arts & Culture, Kanga : une étoffe qui rassemble", url: "https://artsandculture.google.com/story/UQXRRgiEQNcJLA" },
    { titre: "UNESCO, Ville de pierre de Zanzibar (patrimoine mondial, 2000)", url: "https://whc.unesco.org/en/list/173" },
    { titre: "The Citizen (Tanzanie), les portes de Stone Town et leurs clous d'origine indienne", url: "https://www.thecitizen.co.tz/tanzania/zanzibar/round-topped-zanzibari-doors-the-indian-legacy-carved-into-stone-town-s-heart-5034980" },
    { titre: "Indigo Arts, Tinga Tinga Today : la peinture populaire tanzanienne", url: "https://indigoarts.com/exhibitions/tinga-tinga-today-tanzanian-popular-art-transition?page=1" },
  ],
  dessine: true,
  matiere: {
    titre: "kanga",
    encre: CREME,
    sombre: true,
    papier: [
      "radial-gradient(90% 55% at 50% 30%, rgba(80,150,110,0.22) 0%, rgba(80,150,110,0) 70%)",
      "linear-gradient(118deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.05) 44%, rgba(255,255,255,0) 54%)",
      `linear-gradient(170deg, ${VERT.haut} 0%, ${VERT.milieu} 52%, ${VERT.bas} 100%)`,
    ].join(", "),
    motif: { clair: `rgba(${CREME},0.13)`, fonce: "rgba(0,0,0,0.35)" },
    fond: "#0f3123",
    lueur: "rgba(220,240,226,0.1)",
    rayures: 0.04,
    micro: 0.05,
    reflet: 0.16,
    coins: 0.6,
    etiquette: { fond: NOIR, bord: `rgba(${CREME},0.5)`, texte: `rgba(${CREME},0.92)` },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(226,244,232,0.3)", ombre: "rgba(0,0,0,0.7)" },
    puce: "linear-gradient(135deg, #a9b2ad, #2a302c 45%, #8a938e 70%, #0d100e)",
    cadre: `linear-gradient(152deg, #1e4d37 0%, ${VERT.bas} 42%, #143c2a 66%, #04120b 100%)`,
    voile: "rgba(4,14,9,0.82)",
    onglet: { fond: "#f4ecd6", encre: "#0a0e0b" },
    vive: SIENNE,
    // Au dos, le microtexte s'écrit par-dessus la girafe et le vert du mji : à peine.
    dos: { micro: 0.02 },
    tranche: { couleur: "#141a16", metal: 0.55, rugosite: 0.38 },
    holo: { force: 0.24, teinte: [0.86, 1, 0.9] },
  },
  Motif: Kanga,
};

export default kanga;
