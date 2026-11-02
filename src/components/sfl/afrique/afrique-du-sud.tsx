// Le skin de nation « Ndebele » (Afrique du Sud ; PACK AFRIQUE 2027).
//
// Trois savoir-faire de femmes, en Afrique du Sud.
//   · La peinture murale des Ndebele du Sud (Mpumalanga) : les femmes
//     passent le mur à la chaux, tracent d'abord la géométrie au noir, d'un
//     trait épais, puis remplissent les champs. Avant les pigments du
//     commerce, la palette était celle de la terre : ocres, bruns, le noir
//     de suie, le blanc de chaux. On cite la tradition, jamais l'œuvre d'une
//     artiste ; et on garde cette palette d'avant, des terres, un vert éteint.
//   · La vannerie zouloue en palmier ilala : un panier monté en spirale, le
//     brin enroulé point après point, et des rangs de triangles teints.
//   · Le shweshwe : un coton imprimé par enlevage (la teinture ôtée en petits
//     motifs), ici dans son brun.
//   · le papier : la chaux ; l'encre : le noir de suie ;
//   · la face : autour du portrait, une bande murale de champs cernés de noir,
//     des gradins et des ocres ; sous le portrait, le shweshwe, à peine ;
//   · le dos : le mur. Une frise de gradins en haut et en bas (leurs couleurs
//     tirées de la graine, un mur par joueur), deux colonnes de champs sur
//     les côtés ; au centre, le couvercle d'un panier d'ilala vu d'en haut,
//     ses rangs enroulés et sa couronne de triangles, la lune au milieu.
// Ce qu'on évite : copier ou évoquer l'œuvre d'une artiste vivante (Esther
// Mahlangu et d'autres) ; les maisons, lampes, avions et lettres de certaines
// peintures ; les codes et messages du perlage zoulou (couleurs, triangles
// lus comme des signes) ; la marque « Three Cats » du shweshwe ; les couleurs
// du drapeau. Rien que des gradins, des cernes et des champs.

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, BANDE, CENTRE_DOS, f, H, LOGOTYPE_DOS, W } from "./outils";

type Rnd = () => number;

// La palette d'avant les pigments du commerce : chaux, suie, ocres, terre, un vert éteint.
const CHAUX = "#f2eee4";
const SUIE = "#171513";
const OCRE = "#c39143";
const TERRE = "#8c5534";
const VERT = "#6a7a5c";
const PAILLE = "#d9c291";
const BRIN = "#3e2b1e";
const BRUN = "#6e4a32";

const deja = new Map<string, unknown>();
function memo<T>(cle: string, calcul: () => T): T {
  const v = deja.get(cle);
  if (v !== undefined) return v as T;
  if (deja.size > 48) deja.clear();
  const r = calcul();
  deja.set(cle, r);
  return r;
}

/* -------------------------------- Les gradins ------------------------------- */

/** Des gradins : une pyramide à marches, base (x0..x1) au pied y, n marches de hauteur totale h (h < 0 : pendue). */
function gradins(x0: number, x1: number, y: number, h: number, n: number): string {
  const l = x1 - x0;
  const dx = l / (2 * n + 1);
  const dy = h / n;
  let d = `M${f(x0)} ${f(y)}`;
  for (let k = 0; k < n; k++) d += `V${f(y - dy * (k + 1))}H${f(x0 + dx * (k + 1))}`;
  d += `H${f(x1 - dx * n)}`;
  for (let k = n - 1; k >= 0; k--) d += `V${f(y - dy * k)}H${f(x1 - dx * k)}`;
  return d + "Z";
}

/** Un ordre de couleurs tiré de la graine. */
function melange(t: Teinte[], rnd: Rnd): Teinte[] {
  const r = [...t];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Un losange de demi-largeur a, de demi-hauteur b. */
const losange = (cx: number, cy: number, a: number, b: number) => `M${f(cx)} ${f(cy - b)}L${f(cx + a)} ${f(cy)}L${f(cx)} ${f(cy + b)}L${f(cx - a)} ${f(cy)}Z`;

const rect = (x: number, y: number, l: number, h: number) => `M${f(x)} ${f(y)}h${f(l)}v${f(h)}h${f(-l)}Z`;

interface Peinture {
  /** Les champs, par couleur ; les cernes noirs (traits) ; les aplats noirs. */
  ocre: string;
  terre: string;
  vert: string;
  chaux: string;
  cerne: string;
  noir: string;
}

const vide = (): Peinture => ({ ocre: "", terre: "", vert: "", chaux: "", cerne: "", noir: "" });
type Teinte = "ocre" | "terre" | "vert";

/**
 * Une case de la frise, pied en bas (sens 1) ou en haut (−1) : le cadre noir,
 * trois gradins emboîtés (couleur, chaux, noir), et à l'autre bout un bandeau
 * cerné de trois losanges.
 */
function caseFrise(x0: number, y0: number, l: number, h: number, sens: 1 | -1, t: Teinte, p: Peinture) {
  const pied = sens === 1 ? y0 + h : y0;
  p.cerne += rect(x0, y0, l, h);
  const m = 22;
  const g = gradins(x0 + m, x0 + l - m, pied - sens * 14, sens * (h - 96), 3);
  p[t] += g;
  p.cerne += g;
  const gi = gradins(x0 + m + 30, x0 + l - m - 30, pied - sens * 14, sens * (h - 138), 3);
  p.chaux += gi;
  p.cerne += gi;
  // Au cœur du gradin de chaux, un losange noir.
  const cx = x0 + l / 2;
  const cy = pied - sens * (14 + (h - 138) * 0.36);
  p.noir += losange(cx, cy, 13, 18);
  // À l'autre bout de la case : un bandeau cerné, d'une autre couleur, trois losanges de chaux dedans.
  const hb = 46;
  const yb = sens === 1 ? y0 + 18 : y0 + h - 18 - hb;
  const t2: Teinte = t === "ocre" ? "vert" : t === "vert" ? "terre" : "ocre";
  p[t2] += rect(x0 + m, yb, l - 2 * m, hb);
  p.cerne += rect(x0 + m, yb, l - 2 * m, hb);
  const lb = (l - 2 * m) / 3;
  for (let k = 0; k < 3; k++) {
    const cx2 = x0 + m + lb * k + lb / 2;
    const cy2 = yb + hb / 2;
    const d = `M${f(cx2)} ${f(cy2 - 15)}L${f(cx2 + 22)} ${f(cy2)}L${f(cx2)} ${f(cy2 + 15)}L${f(cx2 - 22)} ${f(cy2)}Z`;
    p.chaux += d;
    p.cerne += d;
    p.noir += `M${f(cx2)} ${f(cy2 - 5)}L${f(cx2 + 7)} ${f(cy2)}L${f(cx2)} ${f(cy2 + 5)}L${f(cx2 - 7)} ${f(cy2)}Z`;
  }
}

/* --------------------------------- La face -------------------------------- */

const CADRE = { x0: 7, y0: 7, x1: W - 7, y1: BANDE - 5, ep: 32, r: 85 };

function rectArrondi(x0: number, y0: number, x1: number, y1: number, r: number) {
  return `M${x0 + r} ${y0}H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
}

/** La bande murale d'un côté (repère local : x le long, y en travers de −h/2 à h/2). */
function bandeMurale(L: number, ordre: Teinte[]): Peinture {
  const p = vide();
  const pas = 58;
  const n = Math.max(1, Math.round(L / pas));
  const q = L / n;
  const h = 18;
  for (let i = 0; i < n; i++) {
    const x = i * q;
    if (i % 2 === 0) {
      // Un champ de couleur, cerné, un gradin de chaux dedans.
      const t = ordre[(i / 2) % ordre.length];
      p[t] += rect(x + 3, -h / 2, q - 6, h);
      p.cerne += rect(x + 3, -h / 2, q - 6, h);
      const gi = gradins(x + 12, x + q - 12, h / 2, h - 5, 2);
      p.chaux += gi;
      p.cerne += gi;
    } else {
      // Un champ de chaux : trois barres noires debout.
      for (const k of [-1, 0, 1]) p.noir += rect(x + q / 2 + k * 11 - 3, -h / 2 + 1, 6, h - 2);
    }
  }
  return p;
}

function face(graine: number) {
  return memo(`face-${graine}`, () => {
    const rnd = alea(graine ^ 0x6e64);
    const ordre = melange(["ocre", "vert", "terre"], rnd);
    const { x0, y0, x1, y1, ep, r } = CADRE;
    const m = ep / 2;
    const cotes = [
      { L: x1 - x0 - 2 * r, t: `translate(${x0 + r} ${y0 + m})` },
      { L: y1 - y0 - 2 * r, t: `translate(${x1 - m} ${y0 + r}) rotate(90)` },
      { L: x1 - x0 - 2 * r, t: `translate(${x1 - r} ${y1 - m}) rotate(180)` },
      { L: y1 - y0 - 2 * r, t: `translate(${x0 + m} ${y1 - r}) rotate(270)` },
    ].map((c) => ({ ...c, p: bandeMurale(c.L, ordre) }));
    // Aux coins : un carré noir sur la pointe, un cœur d'ocre.
    let coins = "";
    let coeurs = "";
    for (const [cx, cy, a] of [
      [x1 - r, y0 + r, -Math.PI / 4],
      [x1 - r, y1 - r, Math.PI / 4],
      [x0 + r, y1 - r, (3 * Math.PI) / 4],
      [x0 + r, y0 + r, (-3 * Math.PI) / 4],
    ] as [number, number, number][]) {
      const px = cx + (r - m) * Math.cos(a);
      const py = cy + (r - m) * Math.sin(a);
      coins += `M${f(px)} ${f(py - 12)}L${f(px + 12)} ${f(py)}L${f(px)} ${f(py + 12)}L${f(px - 12)} ${f(py)}Z`;
      coeurs += `M${f(px)} ${f(py - 5)}L${f(px + 5)} ${f(py)}L${f(px)} ${f(py + 5)}L${f(px - 5)} ${f(py)}Z`;
    }
    return { cotes, coins, coeurs, ordre };
  });
}

/* --------------------------------- Le dos --------------------------------- */

const MUR = { m: 26, frise: 268, haut: 52, bas: H - 52 - 268 };
const PANIER = { r: 382, couronne: 338 };
const LOGO = { y0: LOGOTYPE_DOS.cy - 66, y1: LOGOTYPE_DOS.cy + 66, x0: MUR.m + 34 + 46 + 18 };

function mur(graine: number) {
  return memo(`dos-${graine}`, () => {
    const rnd = alea(graine ^ 0x7a61);
    const p = vide();
    const teintes = melange(["ocre", "vert", "terre", "ocre"], rnd);
    // Les frises : quatre cases, la frise du bas en miroir (pied en haut), couleurs en miroir aussi.
    const x0 = MUR.m + 34;
    const l = (W - 2 * x0) / 4;
    for (let i = 0; i < 4; i++) {
      caseFrise(x0 + i * l, MUR.haut, l, MUR.frise, 1, teintes[i], p);
      caseFrise(x0 + i * l, MUR.bas, l, MUR.frise, -1, teintes[3 - i], p);
    }
    // Les colonnes des côtés, entre les frises : des champs empilés, cernés.
    const ya = MUR.haut + MUR.frise + 22;
    const yb = MUR.bas - 22;
    const lc = 46;
    for (const xc of [x0, W - x0 - lc]) {
      const n = 7;
      const hc = (yb - ya) / n;
      for (let k = 0; k < n; k++) {
        const y = ya + k * hc;
        p.cerne += rect(xc, y + 4, lc, hc - 8);
        const t: Teinte = (["ocre", "terre", "vert"] as Teinte[])[(k + (xc > W / 2 ? 1 : 0)) % 3];
        if (k % 2 === 0) {
          p[t] += rect(xc, y + 4, lc, hc - 8);
          const lz = losange(xc + lc / 2, y + hc / 2, lc / 2 - 7, hc / 2 - 16);
          p.chaux += lz;
          p.cerne += lz;
          p.noir += losange(xc + lc / 2, y + hc / 2, 6, 12);
        } else {
          for (let s = 0; s < 4; s++) p.noir += rect(xc + 8, y + 16 + s * ((hc - 32) / 4), lc - 16, (hc - 32) / 8);
        }
      }
    }
    // Le panier : les rangs enroulés, de plus en plus serrés vers le bord ; la couronne de triangles.
    const { cx, cy } = CENTRE_DOS;
    const rangs: number[] = [];
    for (let r = 26; r < PANIER.r - 6; r += 10.5) rangs.push(r);
    let tri = "";
    let triClair = "";
    const N = 44;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const da = (Math.PI * 2) / N;
      const pt = (r: number, a: number) => `${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
      const ri = PANIER.couronne;
      const re = PANIER.r - 10;
      // Un triangle sombre, pointe vers le bord, et dans son creux un triangle plus petit, pointe vers le centre.
      tri += `M${pt(ri, a0)}L${pt(re, a0 + da / 2)}L${pt(ri, a0 + da)}Z`;
      const rm = (ri + re) / 2;
      triClair += `M${pt(rm + 4, a0 + da * 0.82)}L${pt(re, a0 + da * 0.62)}L${pt(re, a0 + da * 1.02)}Z`;
    }
    return { p, rangs, tri, triClair };
  });
}

/* --------------------------------- Le motif -------------------------------- */

function Peint({ p, cerne = 7 }: { p: Peinture; cerne?: number }) {
  return (
    <g strokeLinejoin="miter">
      <path d={p.ocre} fill={OCRE} />
      <path d={p.terre} fill={TERRE} />
      <path d={p.vert} fill={VERT} />
      <path d={p.chaux} fill={CHAUX} />
      <path d={p.cerne} fill="none" stroke={SUIE} strokeWidth={cerne} />
      <path d={p.noir} fill={SUIE} />
    </g>
  );
}

/** Le shweshwe : un petit motif imprimé par enlevage (anneaux, points, losanges), en brun. */
function Shweshwe({ id }: { id: string }) {
  return (
    <pattern id={id} width={26} height={26} patternUnits="userSpaceOnUse" patternTransform="rotate(45 512 1300)">
      <circle cx={6.5} cy={6.5} r={3.6} fill="none" stroke={BRUN} strokeWidth={1.3} />
      <circle cx={6.5} cy={6.5} r={1} fill={BRUN} />
      <path d="M19.5 15.5l4 4-4 4-4-4z" fill={BRUN} />
      <circle cx={19.5} cy={6.5} r={1.1} fill={BRUN} />
      <circle cx={6.5} cy={19.5} r={1.1} fill={BRUN} />
      <path d="M0 13H26" stroke={BRUN} strokeWidth={0.6} strokeDasharray="1.5 2.5" />
    </pattern>
  );
}

function Chaux({ id }: { id: string }) {
  return (
    <pattern id={id} width={12} height={9} patternUnits="userSpaceOnUse">
      <path d="M1 2h3M7 6.5h2.5" stroke="rgba(120,104,84,0.08)" strokeWidth={1.2} strokeLinecap="round" />
    </pattern>
  );
}

function Ndebele({ cote, graine, id }: PropsMotifNation) {
  if (cote === "face") {
    const fc = face(graine);
    const { x0, y0, x1, y1, ep, r } = CADRE;
    return (
      <>
        <defs>
          <Chaux id={`nd-x-${id}`} />
          <Shweshwe id={`nd-s-${id}`} />
        </defs>
        <rect width={W} height={H} fill={`url(#nd-x-${id})`} />
        {/* Sous le portrait : le shweshwe brun, à peine. */}
        <rect x={0} y={BANDE + 8} width={W} height={H - BANDE - 8} fill={`url(#nd-s-${id})`} opacity={0.16} />
        {/* La bande murale : la chaux entre deux cernes noirs, des champs. */}
        <path d={rectArrondi(x0, y0, x1, y1, r) + rectArrondi(x0 + ep, y0 + ep, x1 - ep, y1 - ep, r - ep)} fill={CHAUX} fillRule="evenodd" />
        <g fill="none" stroke={SUIE}>
          <path d={rectArrondi(x0 + 2.5, y0 + 2.5, x1 - 2.5, y1 - 2.5, r - 2.5)} strokeWidth={5} />
          <path d={rectArrondi(x0 + ep - 2.5, y0 + ep - 2.5, x1 - ep + 2.5, y1 - ep + 2.5, r - ep + 2.5)} strokeWidth={5} />
        </g>
        {fc.cotes.map((c, i) => (
          <g key={i} transform={c.t}>
            <Peint p={c.p} cerne={3.4} />
          </g>
        ))}
        <path d={fc.coins} fill={SUIE} />
        <path d={fc.coeurs} fill={OCRE} />
      </>
    );
  }

  const t = mur(graine);
  const { cx, cy } = CENTRE_DOS;
  const { m } = MUR;
  return (
    <>
      <defs>
        <Chaux id={`nd-x-${id}`} />
        <Shweshwe id={`nd-s-${id}`} />
        <radialGradient id={`nd-p-${id}`} cx="0.42" cy="0.36" r="0.72">
          <stop offset="0" stopColor="#e6d3a8" />
          <stop offset="0.75" stopColor={PAILLE} />
          <stop offset="1" stopColor="#c4a970" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#nd-x-${id})`} />
      {/* Le cadre du mur : un cerne noir épais, un filet. */}
      <rect x={m} y={m} width={W - 2 * m} height={H - 2 * m} rx={64} fill="none" stroke={SUIE} strokeWidth={12} />
      <rect x={m + 18} y={m + 18} width={W - 2 * m - 36} height={H - 2 * m - 36} rx={48} fill="none" stroke={SUIE} strokeWidth={3} />
      <Peint p={t.p} />
      {/* Le bandeau du logotype, entre les deux colonnes : le shweshwe brun, à peine, entre deux cernes. */}
      <rect x={LOGO.x0} y={LOGO.y0} width={W - 2 * LOGO.x0} height={LOGO.y1 - LOGO.y0} fill={`url(#nd-s-${id})`} opacity={0.2} />
      <path d={`M${LOGO.x0} ${LOGO.y0}H${W - LOGO.x0}M${LOGO.x0} ${LOGO.y1}H${W - LOGO.x0}`} stroke={SUIE} strokeWidth={6} />
      <path d={`M${LOGO.x0} ${LOGO.y0 + 11}H${W - LOGO.x0}M${LOGO.x0} ${LOGO.y1 - 11}H${W - LOGO.x0}`} stroke={SUIE} strokeWidth={2} />
      {/* Le panier d'ilala vu d'en haut : la paille, les rangs enroulés, la couronne, un cerne noir. */}
      <circle cx={cx} cy={cy} r={PANIER.r + 16} fill={CHAUX} />
      <circle cx={cx} cy={cy} r={PANIER.r} fill={`url(#nd-p-${id})`} />
      <g fill="none" stroke="rgba(110,80,40,0.38)" strokeWidth={6.5} strokeDasharray="2.2 4.6">
        {t.rangs.map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} />
        ))}
      </g>
      <g fill="none" stroke="rgba(110,80,40,0.16)" strokeWidth={1}>
        {t.rangs.map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r + 5.2} />
        ))}
      </g>
      <path d={t.tri} fill={BRIN} />
      <path d={t.triClair} fill={TERRE} opacity={0.9} />
      <circle cx={cx} cy={cy} r={PANIER.couronne - 6} fill="none" stroke={BRIN} strokeWidth={4} />
      <circle cx={cx} cy={cy} r={PANIER.r} fill="none" stroke={SUIE} strokeWidth={12} />
      <circle cx={cx} cy={cy} r={PANIER.r + 16} fill="none" stroke={SUIE} strokeWidth={3} />
    </>
  );
}

const afriqueDuSud: SkinNation = {
  nation: "za",
  nom: "Ndebele",
  quoi: "Les murs peints par les femmes ndebele, la vannerie zouloue en palmier ilala et le brun du shweshwe.",
  sources: [
    { titre: "Ndebele house painting : tradition des femmes, tracé noir d'abord, palette de terres, de suie et de chaux avant les années 1940", url: "https://en.wikipedia.org/wiki/Ndebele_house_painting" },
    { titre: "Botero Medina, la fonction symbolique de la peinture ndebele, Cuadernos de Arte e Iconografía (Grenade)", url: "https://revistaseug.ugr.es/index.php/caug/article/download/5426/5086/11912" },
    { titre: "The Met : panier à couvercle en palmier ilala, Beauty Ngxongo, Hlabisa (vers 1990)", url: "https://www.metmuseum.org/art/collection/search/318684" },
    { titre: "Constitutional Court Art Collection : paniers de Hlabisa", url: "https://ccac.concourttrust.org.za/artworks/hlabisa-basket" },
    { titre: "Brand South Africa : le shweshwe, coton imprimé par enlevage, le bleu puis le brun et le rouge", url: "https://www.brandsouthafrica.com/stay-updated/quick-facts/2013/shweshwe-the-denim-of-south-africa/" },
  ],
  dessine: true,
  matiere: {
    titre: "ndebele",
    encre: "23,21,19",
    sombre: false,
    // La chaux : un blanc chaud, passé à la brosse, plus gris au pied du mur.
    papier: [
      "radial-gradient(80% 46% at 30% 16%, rgba(255,253,247,0.8) 0%, rgba(255,253,247,0) 70%)",
      "radial-gradient(70% 40% at 78% 92%, rgba(170,150,120,0.16) 0%, rgba(170,150,120,0) 70%)",
      "repeating-linear-gradient(100deg, rgba(140,120,96,0.025) 0 2px, rgba(0,0,0,0) 2px 9px)",
      "linear-gradient(165deg, #f6f2ea 0%, #eee9de 52%, #e3ddcf 100%)",
    ].join(", "),
    motif: { clair: "rgba(255,253,247,0.6)", fonce: "rgba(23,21,19,0.3)" },
    fond: "rgba(244,240,232,0.95)",
    lueur: "rgba(255,253,247,0.9)",
    rayures: 0.012,
    micro: 0.03,
    reflet: 0.24,
    coins: 0.6,
    etiquette: { fond: SUIE, bord: SUIE, texte: CHAUX },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,253,247,0.9)", ombre: "rgba(60,50,40,0.24)" },
    puce: "linear-gradient(135deg, #fbfaf6, #c9c2b3 45%, #efebe2 70%, #a39b8a)",
    // La carte photo : le cerne noir, la chaux, l'ocre, en bandes.
    cadre: [
      `repeating-linear-gradient(90deg, ${SUIE} 0 7px, ${CHAUX} 7px 9px, ${OCRE} 9px 16px, ${CHAUX} 16px 18px, ${SUIE} 18px 25px, ${CHAUX} 25px 27px, ${VERT} 27px 34px, ${CHAUX} 34px 36px)`,
    ].join(", "),
    voile: "rgba(23,21,19,0.58)",
    onglet: { fond: CHAUX, encre: SUIE },
    vive: OCRE,
    dos: { micro: 0.016 },
    // La 3D : une tranche noire de suie, mate, comme le cerne qui tient tout ; un reflet doux.
    tranche: { couleur: "#1d1a17", metal: 0.05, rugosite: 0.85 },
    holo: { force: 0.2, teinte: [1, 0.97, 0.92] },
  },
  Motif: Ndebele,
};

export default afriqueDuSud;
