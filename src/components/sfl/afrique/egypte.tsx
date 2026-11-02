// Le skin de nation « Telli » (Égypte ; PACK AFRIQUE 2027).
//
// Le tulle bi telli d'Assiout, en Haute-Égypte : un filet de coton noir sur
// lequel on noue, une à une, de fines lamelles de métal battu, puis qu'on
// roule pour les aplatir ; les lamelles, serrées en rangs, dessinent des
// losanges, des chevrons, des triangles et des soleils, et l'étoffe scintille
// quand elle bouge. Autour, le bois tourné des moucharabiehs du Caire
// historique, et le tissage à la main de Haute-Égypte.
// La carte est un châle de telli, vu au travers d'une fenêtre :
//   · le papier : le filet noir, ses mailles en losange, à peine ; l'encre :
//     l'argent mat des lamelles (du maillechort, jamais de l'or) ;
//   · la face : autour du portrait, le treillis d'un moucharabieh, des
//     fuseaux de bois tourné croisés à 45°, leurs perles et leurs nœuds,
//     entre deux traverses ; dans la bande du bas, à peine, un treillis de
//     losanges en lamelles ;
//   · le dos : le châle entier. Une bordure de dents et de chevrons, un champ
//     de losanges dont chaque cœur est plein, coupé large autour du totem, le
//     faucon en lamelles (totems/egypte.tsx), posé à gauche sur sa pierre ; la
//     lune devant son regard (LUNE_EG), cernée, à distance, d'une couronne de
//     seize losanges pleins, sans rais (plus de soleil de triangles : avec un
//     faucon, un disque rayonnant serait celui d'un dieu ; la couronne est à
//     valider par Ilyes) ; sous le logotype, une lisière rayée
//     tissée à la main ; tout en lamelles, chacune posée sur le filet, qui
//     prennent le reflet quand la carte tourne ;
//   · le filet : ses mailles ont du jeu (le tulle se tend inégal), et le noir
//     se moire d'un reflet plus doux là où l'étoffe a été roulée.
// Ce qu'on évite : toute image pharaonique (hiéroglyphes, pyramides, Sphinx,
// ankh, œil d'Horus dessiné comme signe, disque sur une tête), toute
// calligraphie, et les figures (personnages, animaux autres que le totem,
// objets) qu'on trouve aussi sur le telli ; l'or, le laiton.

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, BANDE, f, H, W } from "./outils";
import { DECALE_EG, LUNE_EG, POSE_DOS_EG, SILHOUETTE_EG } from "./totems/egypte";

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

// La palette : le noir du filet, l'argent mat, le bois des moucharabiehs, le lin écru.
const NOIR = { haut: "#18181b", milieu: "#0f0f11", bas: "#08080a" };
const ARGENT = "222,224,228";
const BOIS = "80,58,42";
const BOIS_CLAIR = "146,116,90";
const LIN = "214,204,184";

/* ----------------------------- Les lamelles ----------------------------- */

/**
 * Le dessin en lamelles : une grille de points (les mailles où l'on noue),
 * en quinconce ; là où la forme veut du métal, une lamelle (un petit
 * rectangle, que l'aplatissage penche à peine). Rend le corps et l'arête.
 */
function lamelles(dedans: (x: number, y: number) => boolean, seed: number, zone = { x0: 0, y0: 0, x1: W, y1: H }, px = 9, py = 12) {
  const rnd = alea(seed);
  let corps = "";
  let arete = "";
  let j = 0;
  for (let y = zone.y0 + py / 2; y < zone.y1; y += py, j++) {
    for (let x = zone.x0 + (j % 2 ? px / 2 : 0) + px / 2; x < zone.x1; x += px) {
      if (!dedans(x, y)) continue;
      const pen = (rnd() - 0.5) * 1.6;
      const l = 6.2;
      const h = 9.6;
      corps += `M${f(x - l / 2 + pen)} ${f(y - h / 2)}h${l}l${f(-pen * 2)} ${h}h${-l}Z`;
      arete += `M${f(x - l / 2 + pen + 0.6)} ${f(y - h / 2 + 1.2)}h${f(l - 1.4)}`;
    }
  }
  return { corps, arete };
}

/** La fraction d'un nombre, toujours positive. */
const fr = (v: number) => v - Math.floor(v);

/* ------------------------------- Le châle (dos) ------------------------------- */

const BORD = 44;
const CHAMP = { x0: 122, y0: 124, x1: W - 122, y1: 1120 };
const LISIERE = { y0: 1330, y1: 1500 };

/** Le châle du dos : toutes les formes, en une fonction « ici, du métal ? ». */
function chale(seed: number) {
  const { cx, cy } = LUNE_EG;
  // Le cercle de la lune, à l'échelle de LUNE_EG (pour une lune de 300).
  const K = LUNE_EG.d / 300;
  const dedans = (x: number, y: number): boolean => {
    // La bordure : un rang de dents tournées vers l'intérieur, puis un filet.
    const dg = x, dd = W - x, dh = y, db = H - 70 - y;
    const d = Math.min(dg, dd, dh, db);
    const coin = (x < 150 || x > W - 150) && (y < 150 || y > H - 220);
    if (!coin && d >= BORD && d < BORD + 64) {
      const v = d - BORD;
      const u = d === dg || d === dd ? y : x;
      if (v < 34) return Math.abs(fr(u / 46) - 0.5) * 2 < 1 - v / 34;
      if (v >= 44 && v < 54) return true;
      return false;
    }
    // Les coins : un losange plein, cerné d'un rang.
    if (coin) {
      const ox = x < W / 2 ? 98 : W - 98;
      const oy = y < H / 2 ? 98 : H - 168;
      const l = Math.abs(x - ox) / 40 + Math.abs(y - oy) / 40;
      return l < 0.62 || (l > 0.84 && l < 1.08);
    }
    // Autour de la lune : le filet nu, puis une couronne de seize losanges pleins, sans rais
    // (un faucon devant un disque rayonnant, ce serait une image de dieu : à valider par Ilyes).
    const r = Math.hypot(x - cx, y - cy);
    if (r < 560 * K) {
      // La couronne : seize losanges pleins, carrés sur la pointe, détachés par le filet nu de la lune et du champ.
      if (r < 350 * K || r > 450 * K) return false;
      const a = Math.atan2(y - cy, x - cx);
      const t = (((a / (Math.PI * 2)) * 16) % 1 + 1) % 1;
      const u = (Math.abs(t - 0.5) * ((2 * Math.PI * 400 * K) / 16)) / (50 * K);
      const v = Math.abs(r - 400 * K) / (50 * K);
      return u + v < 1;
    }
    // Le champ : un treillis de losanges, un cœur plein dans chacun.
    if (x > CHAMP.x0 && x < CHAMP.x1 && y > CHAMP.y0 && y < CHAMP.y1) {
      const lx = 130, ly = 156;
      const u = (x - W / 2) / lx;
      const v = (y - CHAMP.y0) / ly;
      const a = fr(u + v), b = fr(u - v);
      const trait = Math.min(a, 1 - a) * lx * 0.7 < 5.4 || Math.min(b, 1 - b) * lx * 0.7 < 5.4;
      // Le cœur de chaque losange, plein : les losanges sont centrés en (½, 0) et (0, ½).
      const coeur = (cu: number, cv: number) => (Math.abs(fr(u - cu + 0.5) - 0.5) * lx) / 30 + (Math.abs(fr(v - cv + 0.5) - 0.5) * ly) / 36 < 1;
      return trait || coeur(0.5, 0) || coeur(0, 0.5);
    }
    // La lisière tissée sous le logotype : on n'y pose que des filets de lamelles.
    if (y > LISIERE.y0 && y < LISIERE.y1 && x > 110 && x < W - 110) {
      const v = y - LISIERE.y0;
      if (v < 10 || v > LISIERE.y1 - LISIERE.y0 - 10) return true;
      // Un rang de losanges au milieu.
      const u = (x - W / 2) / 66 + 0.5;
      const t = Math.abs(v - (LISIERE.y1 - LISIERE.y0) / 2) / 36;
      return Math.abs(fr(u) - 0.5) * 2 + t < 0.9;
    }
    return false;
  };
  return lamelles(dedans, seed ^ 0x7e111);
}

/** La lisière rayée tissée à la main (Haute-Égypte), sous le logotype : rayures de chaîne. */
const RAYURES: { y: number; h: number; c: "l" | "b" | "a" }[] = [
  { y: 16, h: 6, c: "l" },
  { y: 26, h: 2, c: "a" },
  { y: 31, h: 2, c: "a" },
  { y: 43, h: 8, c: "b" },
  { y: 58, h: 3, c: "l" },
  { y: 108, h: 3, c: "l" },
  { y: 118, h: 8, c: "b" },
  { y: 133, h: 2, c: "a" },
  { y: 138, h: 2, c: "a" },
  { y: 146, h: 6, c: "l" },
];

/* --------------------------- Le moucharabieh (face) --------------------------- */

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
  const en = (s: number): [Pt, Pt] => {
    let t = ((s % total) + total) % total;
    for (const sg of segs) {
      if (t <= sg.l) return sg.pt(t);
      t -= sg.l;
    }
    return segs[segs.length - 1].pt(segs[segs.length - 1].l);
  };
  return { total, en };
}

/**
 * Le treillis d'un moucharabieh dans la marge du portrait : deux traverses,
 * et entre elles des fuseaux de bois tourné qui se croisent à 45°, une perle
 * au milieu de chacun, un nœud carré à chaque croisement.
 */
function moucharabieh() {
  const mi = 20.5;
  const demi = 11;
  const p = pourtour(mi, 71.5, BANDE - mi);
  const n = Math.round(p.total / 30);
  const pas = p.total / n;
  const au = (s: number, o: number): Pt => {
    const [[x, y], [nx, ny]] = p.en(s);
    return [x + nx * o, y + ny * o];
  };
  let fuseaux = "";
  let perles = "";
  let noeuds = "";
  for (let k = 0; k < n; k++) {
    const s = k * pas;
    // Deux fuseaux par pas, en X : de l'intérieur à l'extérieur, et retour.
    for (const [a, b] of [
      [au(s, -demi), au(s + pas / 2, demi)],
      [au(s + pas / 2, demi), au(s + pas, -demi)],
      [au(s, demi), au(s + pas / 2, -demi)],
      [au(s + pas / 2, -demi), au(s + pas, demi)],
    ] as [Pt, Pt][]) {
      fuseaux += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      perles += `M${f(mx - 2.7)} ${f(my)}a2.7 2.7 0 1 0 5.4 0a2.7 2.7 0 1 0 -5.4 0`;
    }
    // Le nœud au croisement (sur la ligne du milieu), et les talons contre les traverses.
    const [[cx, cy], [nx, ny]] = p.en(s + pas / 4);
    const tx = -ny, ty = nx;
    const c = 3.4;
    noeuds += `M${f(cx + (tx + nx) * c)} ${f(cy + (ty + ny) * c)}L${f(cx + (tx - nx) * c)} ${f(cy + (ty - ny) * c)}L${f(cx - (tx + nx) * c)} ${f(cy - (ty + ny) * c)}L${f(cx - (tx - nx) * c)} ${f(cy - (ty - ny) * c)}Z`;
    const [[dx, dy]] = p.en(s + (3 * pas) / 4);
    noeuds += `M${f(dx + (tx + nx) * c)} ${f(dy + (ty + ny) * c)}L${f(dx + (tx - nx) * c)} ${f(dy + (ty - ny) * c)}L${f(dx - (tx + nx) * c)} ${f(dy - (ty + ny) * c)}L${f(dx - (tx - nx) * c)} ${f(dy - (ty - ny) * c)}Z`;
  }
  const rail = (o: number) => {
    let d = "";
    for (let s = 0; s <= p.total + 4; s += 6) {
      const [x, y] = au(s, o);
      d += `${d ? "L" : "M"}${f(x)} ${f(y)}`;
    }
    return d + "Z";
  };
  return { fuseaux, perles, noeuds, rails: rail(-demi - 2.5) + rail(demi + 2.5) };
}

/** La bande du bas : un treillis de losanges en lamelles, à peine. */
function treillisBas(seed: number) {
  return lamelles(
    (x, y) => {
      const u = (x - W / 2) / 104;
      const v = (y - BANDE) / 124;
      const a = fr(u + v), b = fr(u - v);
      const trait = Math.min(a, 1 - a) * 72 < 4.4 || Math.min(b, 1 - b) * 72 < 4.4;
      const coeur = (Math.abs(fr(u) - 0.5) * 104) / 18 + (Math.abs(fr(v) - 0.5) * 124) / 22 < 1;
      return x > 26 && x < W - 26 && (trait || coeur);
    },
    seed ^ 0xba5,
    { x0: 0, y0: BANDE, x1: W, y1: H - 40 }
  );
}

/* --------------------------------- Le motif --------------------------------- */

function Telli({ cote, m, graine, id }: PropsMotifNation) {
  const dos = cote === "dos";
  const filet = (
    <>
      <defs>
        <pattern id={`ef-${id}`} width={9} height={12} patternUnits="userSpaceOnUse">
          <path d="M0 0L4.5 6L0 12M9 0L4.5 6L9 12" fill="none" stroke={m.clair} strokeWidth={0.9} />
        </pattern>
        {/* Le tulle tendu inégal : une seconde maille, à peine tournée, qui moire la première. */}
        <pattern id={`ew-${id}`} width={9} height={12} patternUnits="userSpaceOnUse" patternTransform={`rotate(${f(1.6 + (graine % 7) * 0.12)} ${W / 2} ${H / 2})`}>
          <path d="M0 0L4.5 6L0 12M9 0L4.5 6L9 12" fill="none" stroke={m.clair} strokeWidth={0.7} />
        </pattern>
        {/* Le reflet doux là où l'étoffe a été roulée pour aplatir les lamelles. */}
        <linearGradient id={`er-${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={H}>
          {[0, 0.18, 0.3, 0.5, 0.62, 0.8, 1].map((o, i) => (
            <stop key={o} offset={o} stopColor="#e6e8ee" stopOpacity={[0, 0.035, 0, 0.03, 0, 0.04, 0][i]} />
          ))}
        </linearGradient>
        {/* L'argent : des bandes plus ou moins claires en biais, le scintillement des lamelles */}
        <linearGradient id={`eg-${id}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={W} y2={H}>
          {[0, 0.12, 0.22, 0.33, 0.45, 0.56, 0.68, 0.79, 0.9, 1].map((o, i) => (
            <stop key={o} offset={o} stopColor={i % 2 ? "#c9ccd2" : "#8e929b"} />
          ))}
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#ef-${id})`} />
      <rect width={W} height={H} fill={`url(#ew-${id})`} opacity={0.55} />
      <rect width={W} height={H} fill={`url(#er-${id})`} />
    </>
  );
  const metal = (l: { corps: string; arete: string }, force: number) => (
    <g opacity={force}>
      <path d={l.corps} fill="rgba(0,0,0,0.7)" transform="translate(0.8 1.3)" />
      <path d={l.corps} fill={`url(#eg-${id})`} />
      <path d={l.arete} stroke={`rgba(${ARGENT},0.9)`} strokeWidth={1.1} />
    </g>
  );

  if (!dos) {
    const mo = memo("moucharabieh", moucharabieh);
    const bas = memo(`bas:${graine}`, () => treillisBas(graine));
    return (
      <>
        {filet}
        <defs>
          <linearGradient id={`ea-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity={0} />
            <stop offset="0.3" stopColor="#fff" stopOpacity={1} />
            <stop offset="1" stopColor="#fff" stopOpacity={1} />
          </linearGradient>
          <mask id={`em-${id}`}>
            <rect x={0} y={BANDE} width={W} height={H - BANDE} fill={`url(#ea-${id})`} />
          </mask>
        </defs>
        <g mask={`url(#em-${id})`}>{metal(bas, 0.2)}</g>
        {/* Le moucharabieh : l'ombre, les traverses, les fuseaux, les perles, les nœuds */}
        <g fill="none" strokeLinecap="round">
          <path d={mo.rails + mo.fuseaux} stroke="rgba(0,0,0,0.75)" strokeWidth={5.4} transform="translate(1 1.6)" />
          <path d={mo.rails} stroke={`rgb(${BOIS})`} strokeWidth={4.4} />
          <path d={mo.fuseaux} stroke={`rgb(${BOIS})`} strokeWidth={2.6} />
          <path d={mo.rails + mo.fuseaux} stroke={`rgba(${BOIS_CLAIR},0.55)`} strokeWidth={0.9} transform="translate(-0.5 -0.7)" />
        </g>
        <path d={mo.perles + mo.noeuds} fill="rgba(0,0,0,0.6)" transform="translate(0.8 1.2)" />
        <path d={mo.perles} fill={`rgb(${BOIS})`} stroke={`rgba(${BOIS_CLAIR},0.6)`} strokeWidth={0.8} />
        <path d={mo.noeuds} fill={`rgb(${BOIS_CLAIR})`} fillOpacity={0.75} />
      </>
    );
  }

  const ch = memo(`chale:${graine}`, () => chale(graine));
  return (
    <>
      {filet}
      {/* La lisière tissée à la main : rayures de chaîne en lin, bois et argent */}
      {RAYURES.map((r, i) => (
        <rect
          key={i}
          x={110}
          y={LISIERE.y0 + r.y - 8}
          width={W - 220}
          height={r.h}
          fill={r.c === "l" ? `rgba(${LIN},0.2)` : r.c === "b" ? `rgba(${BOIS_CLAIR},0.4)` : `rgba(${ARGENT},0.3)`}
        />
      ))}
      {/* Le châle, coupé large autour du faucon (le totem, totems/egypte.tsx) et de sa pierre. */}
      <defs>
        <mask id={`ek-${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
          <rect width={W} height={H} fill="#fff" />
          <g transform={`translate(${POSE_DOS_EG.x} ${POSE_DOS_EG.y}) scale(${POSE_DOS_EG.echelle}) ${DECALE_EG}`} fill="#000" stroke="#000" strokeWidth={56} strokeLinejoin="round">
            <path d={SILHOUETTE_EG.d} />
            <path d={SILHOUETTE_EG.pierre} />
          </g>
        </mask>
      </defs>
      <g mask={`url(#ek-${id})`}>{metal(ch, 0.92)}</g>
    </>
  );
}

const telli: SkinNation = {
  nation: "eg",
  nom: "Telli",
  quoi: "Le tulle bi telli d'Assiout, ses lamelles d'argent nouées sur le filet noir, au travers d'un moucharabieh du Caire.",
  sources: [
    { titre: "Egyptian Streets, le tulle bi telli d'Assiout (2022)", url: "https://egyptianstreets.com/2022/03/01/the-assiut-heritage-tulle-bi-telli-embroidery/" },
    { titre: "Textile Research Centre (Leyde), TRC Needles : tulle bi telli", url: "https://trc-leiden.nl/trc-needles/regional-traditions/middle-east-and-north-africa/pre-modern-middle-east-and-north-africa/tulle-bi-telli" },
    { titre: "UNESCO, le tissage à la main en Haute-Égypte (Sa'eed), patrimoine immatériel à sauvegarder d'urgence, 2020", url: "https://ich.unesco.org/fr/RL/handmade-weaving-in-upper-egypt-sa-eed-01605" },
    { titre: "Ahram Online, l'art du tissage ferka et kabaty (Naqada, Akhmim)", url: "https://english.ahram.org.eg/NewsContent/32/98/397387/Folk/Folk-Arts/The-art-of-ferka-and-kabaty-weaving.aspx" },
    { titre: "UNESCO, Le Caire historique (patrimoine mondial, 1979)", url: "https://whc.unesco.org/fr/list/89" },
    { titre: "The Met, les moucharabiehs de bois tourné du Caire", url: "https://www.metmuseum.org/art/collection/search/456288" },
  ],
  dessine: true,
  matiere: {
    titre: "telli",
    encre: ARGENT,
    sombre: true,
    papier: [
      "linear-gradient(118deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.045) 46%, rgba(255,255,255,0) 58%)",
      "radial-gradient(90% 55% at 50% 30%, rgba(70,72,80,0.25) 0%, rgba(70,72,80,0) 70%)",
      `linear-gradient(170deg, ${NOIR.haut} 0%, ${NOIR.milieu} 52%, ${NOIR.bas} 100%)`,
    ].join(", "),
    motif: { clair: "rgba(200,204,212,0.07)", fonce: "rgba(0,0,0,0.3)" },
    fond: "#111113",
    lueur: "rgba(222,224,228,0.1)",
    rayures: 0.04,
    micro: 0.05,
    reflet: 0.2,
    coins: 0.6,
    etiquette: { fond: "#0a0a0c", bord: `rgba(${ARGENT},0.5)`, texte: `rgba(${ARGENT},0.94)` },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(230,232,238,0.32)", ombre: "rgba(0,0,0,0.8)" },
    puce: "linear-gradient(135deg, #f0f1f3, #9a9ea6 45%, #dfe1e5 70%, #6d7178)",
    cadre: `linear-gradient(152deg, #2a2a2e 0%, ${NOIR.bas} 42%, #1c1c1f 66%, #040405 100%)`,
    voile: "rgba(6,6,8,0.82)",
    onglet: { fond: "#e6e7ea", encre: "#0d0d10" },
    vive: "#c9ccd2",
    tranche: { couleur: "#1a1a1d", metal: 0.45, rugosite: 0.4 },
    holo: { force: 0.38, teinte: [0.96, 0.97, 1] },
    dos: { micro: 0.018 },
  },
  Motif: Telli,
};

export default telli;
