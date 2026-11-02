// Le skin de nation « Lamu » (Kenya, pays hôte ; PACK AFRIQUE 2027).
//
// La vieille ville de Lamu (patrimoine mondial de l'UNESCO, 2001), la plus
// ancienne ville swahilie encore habitée de la côte : des maisons de pierre
// de corail et des portes de bois sombre, dont le chambranle est sculpté.
// La carte est une de ces portes, et ce qu'on porte et tresse sur la côte :
//   · le papier : le bois sombre des portes, son fil vertical, tiré de la
//     graine (une planche par joueur) ; l'encre : le blanc de la pierre de
//     corail passée à la chaux ;
//   · la face : le chambranle autour du portrait, une chaîne sculptée (deux
//     brins entrelacés, une perle dans chaque maille), et une rosette à
//     chaque coin, comme les blocs d'angle d'un encadrement ; sous le
//     portrait, la bande du bas tissée comme un kikoi, ses rayures fines de
//     chaîne serrées en lisière, à peine ;
//   · le dos : la porte entière, la chaîne sur tout le pourtour et le linteau
//     de rosettes ; autour de la lune, la spirale tressée du kiondo (le panier
//     de sisal), ses rangs de torsades qui changent de sens d'un rang à
//     l'autre, une couronne de triangles teints ; sous le logotype, la lisière
//     rayée d'un kikoi et sa frange nouée.
// Ce qu'on évite : les inscriptions (souvent religieuses) de certaines portes,
// le poisson des montants, et tout perlage, dont celui des Maasaï (la Maasai
// Intellectual Property Initiative en revendique l'usage).

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

// La palette : le bois sombre, le sisal, le blanc de corail, le brun du bois sculpté et des fils, le brun foncé des fibres teintes.
const BOIS = { haut: "#2d2018", milieu: "#1e150f", bas: "#130d09" };
const SISAL = "216,200,164";
const CORAIL = "240,232,218";
const TEINT = "62,36,20";
const BRUN = "92,54,30";

/* --------------------------- Le pourtour arrondi --------------------------- */

/**
 * Un point d'un rectangle arrondi (inset `d`, rayon `r`), à l'abscisse
 * curviligne `s`, et sa normale vers l'extérieur. On part du milieu du haut,
 * dans le sens des aiguilles d'une montre.
 */
function pourtour(d: number, r: number, bas = H - d) {
  const x0 = d, y0 = d, x1 = W - d, y1 = bas;
  const lh = x1 - x0 - 2 * r;
  const lv = y1 - y0 - 2 * r;
  const q = (Math.PI / 2) * r;
  const segs: { l: number; pt: (t: number) => [Pt, Pt] }[] = [
    { l: lh / 2, pt: (t) => [[W / 2 + t, y0], [0, -1]] },
    { l: q, pt: (t) => { const a = -Math.PI / 2 + t / r; return [[x1 - r + r * Math.cos(a), y0 + r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; } },
    { l: lv, pt: (t) => [[x1, y0 + r + t], [1, 0]] },
    { l: q, pt: (t) => { const a = t / r; return [[x1 - r + r * Math.cos(a), y1 - r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; } },
    { l: lh, pt: (t) => [[x1 - r - t, y1], [0, 1]] },
    { l: q, pt: (t) => { const a = Math.PI / 2 + t / r; return [[x0 + r + r * Math.cos(a), y1 - r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; } },
    { l: lv, pt: (t) => [[x0, y1 - r - t], [-1, 0]] },
    { l: q, pt: (t) => { const a = Math.PI + t / r; return [[x0 + r + r * Math.cos(a), y0 + r + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; } },
    { l: lh / 2, pt: (t) => [[x0 + r + t, y0], [0, -1]] },
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

/* ------------------------------ La chaîne ------------------------------ */

interface Chaine {
  /** Les deux brins, en morceaux (coupés autour des rosettes). */
  brins: string;
  /** Les passages « dessus » à chaque croisement : l'entrelacs. */
  dessus: string;
  perles: string;
  rosettes: Pt[];
}

/**
 * La chaîne sculptée d'un chambranle : deux brins en opposition de phase qui
 * se croisent tous les demi-pas, une perle dans chaque maille ; une rosette à
 * chaque coin (la chaîne s'y interrompt). L'entrelacs : à chaque croisement,
 * l'un puis l'autre brin passe dessus.
 */
function chaine(d: number, r: number, bas: number, amp: number, pas0: number, rosette: number): Chaine {
  const { total, en, coins } = pourtour(d, r, bas);
  const n = Math.round(total / pas0);
  const pas = total / n;
  const hors = (s: number) => coins.some((c) => Math.abs(((s - c + total * 1.5) % total) - total / 2) < rosette + 4);
  const brin = (signe: number, s: number): Pt => {
    const [[x, y], [nx, ny]] = en(s);
    const o = signe * amp * Math.sin((2 * Math.PI * s) / pas);
    return [x + nx * o, y + ny * o];
  };
  let brins = "";
  for (const signe of [1, -1]) {
    let ouvert = false;
    for (let s = 0; s <= total; s += 3) {
      if (hors(s)) {
        ouvert = false;
        continue;
      }
      const [x, y] = brin(signe, s);
      brins += `${ouvert ? "L" : "M"}${f(x)} ${f(y)}`;
      ouvert = true;
    }
  }
  let dessus = "";
  let perles = "";
  for (let k = 0; k < n * 2; k++) {
    const s = (k * pas) / 2;
    if (!hors(s)) {
      // Le brin qui passe dessus alterne : un croisement sur deux.
      const signe = k % 2 === 0 ? 1 : -1;
      dessus += `M${brin(signe, s - pas * 0.13).map(f).join(" ")}`;
      for (let u = -0.1; u <= 0.131; u += 0.03) dessus += `L${brin(signe, s + pas * u).map(f).join(" ")}`;
    }
    const sp = s + pas / 4;
    if (!hors(sp)) {
      const [[x, y]] = en(sp);
      perles += `M${f(x - 3.4)} ${f(y)}a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0 -6.8 0`;
    }
  }
  return { brins, dessus, perles, rosettes: coins.map((c) => en(c)[0]) };
}

/** Une rosette sculptée : huit pétales en amande autour d'un bouton, et un anneau. */
function rosette([cx, cy]: Pt, r: number): { petales: string; anneau: string; bouton: string } {
  let petales = "";
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const ex = cx + Math.cos(a) * r * 0.82;
    const ey = cy + Math.sin(a) * r * 0.82;
    const lx = Math.cos(a + Math.PI / 2) * r * 0.2;
    const ly = Math.sin(a + Math.PI / 2) * r * 0.2;
    const mx = cx + Math.cos(a) * r * 0.42;
    const my = cy + Math.sin(a) * r * 0.42;
    petales += `M${f(cx + Math.cos(a) * r * 0.22)} ${f(cy + Math.sin(a) * r * 0.22)}Q${f(mx + lx)} ${f(my + ly)} ${f(ex)} ${f(ey)}Q${f(mx - lx)} ${f(my - ly)} ${f(cx + Math.cos(a) * r * 0.22)} ${f(cy + Math.sin(a) * r * 0.22)}Z`;
  }
  const rond = (rr: number) => `M${f(cx - rr)} ${f(cy)}a${f(rr)} ${f(rr)} 0 1 0 ${f(2 * rr)} 0a${f(rr)} ${f(rr)} 0 1 0 ${f(-2 * rr)} 0`;
  return { petales, anneau: rond(r), bouton: rond(r * 0.17) };
}

/* ------------------------------- Le bois ------------------------------- */

/** Le fil du bois : des veines verticales, ondulées à peine, propres à la graine. */
function fil(seed: number): { clair: string; fonce: string } {
  const rnd = alea(seed ^ 0x51a7c0de);
  let clair = "";
  let fonce = "";
  let x = -10 + rnd() * 8;
  while (x < W + 10) {
    const amp = 2 + rnd() * 9;
    const per = 260 + rnd() * 520;
    const ph = rnd() * Math.PI * 2;
    const derive = (rnd() - 0.5) * 30;
    let d = "";
    for (let y = -20; y <= H + 20; y += 24) {
      const xx = x + amp * Math.sin((y / per) * Math.PI * 2 + ph) + (derive * y) / H;
      d += `${y === -20 ? "M" : "L"}${f(xx)} ${y}`;
    }
    if (rnd() < 0.62) fonce += d;
    else clair += d;
    x += 5 + rnd() * 16;
  }
  return { clair, fonce };
}

/* ------------------------------- Le kiondo ------------------------------- */

/**
 * La spirale tressée du kiondo autour de la lune : des rangs de torsades (deux
 * brins qui s'enroulent autour de la chaîne du panier), inclinées dans un
 * sens puis dans l'autre d'un rang au suivant ; au milieu, une couronne de
 * triangles teints, comme les bandes de couleur d'un panier.
 */
function kiondo(): { nature: string; teint: string; ombre: string; filets: string } {
  const { cx, cy } = CENTRE_DOS;
  const r0 = 330;
  const rangs = 9;
  const h = 10.5;
  const pointes = 20;
  let nature = "";
  let teint = "";
  let ombre = "";
  let filets = "";
  for (let i = 0; i < rangs; i++) {
    const rm = r0 + i * h + h / 2;
    const n = Math.round((2 * Math.PI * rm) / 7.2);
    const sens = i % 2 === 0 ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const da = (sens * 2.6) / rm;
      const p0: Pt = [cx + Math.cos(a - da) * (rm - h * 0.42), cy + Math.sin(a - da) * (rm - h * 0.42)];
      const p1: Pt = [cx + Math.cos(a + da) * (rm + h * 0.42), cy + Math.sin(a + da) * (rm + h * 0.42)];
      const s = `M${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}`;
      ombre += `M${f(p0[0] + 1.2)} ${f(p0[1] + 1.6)}L${f(p1[0] + 1.2)} ${f(p1[1] + 1.6)}`;
      // La couronne de triangles : rangs 2 à 5, pointes vers l'extérieur.
      const u = ((a / (Math.PI * 2)) * pointes) % 1;
      const largeur = 0.78 * (1 - (i - 2) / 5);
      const dansTriangle = i >= 2 && i <= 6 && Math.abs(u - 0.5) < largeur * 0.5;
      if (dansTriangle) teint += s;
      else nature += s;
    }
    const rr = r0 + i * h;
    filets += `M${f(cx - rr)} ${f(cy)}a${f(rr)} ${f(rr)} 0 1 0 ${f(2 * rr)} 0a${f(rr)} ${f(rr)} 0 1 0 ${f(-2 * rr)} 0`;
  }
  const rr = r0 + rangs * h;
  filets += `M${f(cx - rr)} ${f(cy)}a${f(rr)} ${f(rr)} 0 1 0 ${f(2 * rr)} 0a${f(rr)} ${f(rr)} 0 1 0 ${f(-2 * rr)} 0`;
  return { nature, teint, ombre, filets };
}

/* -------------------------------- Le kikoi -------------------------------- */

/** Les rayures d'un kikoi : des groupes de fils fins, serrés en lisière. */
const RAYURES_KIKOI: { x: number; l: number; c: "s" | "c" | "t" }[] = [
  { x: 0, l: 5, c: "s" },
  { x: 9, l: 2, c: "c" },
  { x: 14, l: 2, c: "c" },
  { x: 22, l: 9, c: "t" },
  { x: 35, l: 2, c: "s" },
  { x: 40, l: 2, c: "s" },
  { x: 48, l: 4, c: "c" },
];

/* --------------------------------- Le motif --------------------------------- */

function Lamu({ cote, m, graine, id }: PropsMotifNation) {
  const dos = cote === "dos";
  const bois = memo(`fil:${graine}`, () => fil(graine));
  // La face : le chambranle dans la marge du portrait ; le dos : sur le pourtour, plus large.
  const ch = memo(`ch:${dos ? 1 : 0}`, () =>
    dos ? chaine(36, 56, 1570, 14, 50, 26) : chaine(20.5, 71.5, BANDE - 20.5, 12, 44, 19)
  );
  const k = memo("kiondo", kiondo);
  const linteau = memo("linteau", () => {
    const rs: Pt[] = [];
    for (let i = 0; i < 7; i++) rs.push([152 + i * 120, 142]);
    return rs.map((c) => rosette(c, 34));
  });
  const coins = ch.rosettes.map((c) => rosette(c, dos ? 24 : 18));
  const sculpte = (d: string, w: number, cle: string) => (
    <g key={cle} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke="rgba(0,0,0,0.62)" strokeWidth={w + 2.4} transform="translate(1.6 2.4)" />
      <path d={d} stroke={`rgba(${BRUN},0.9)`} strokeWidth={w} />
      <path d={d} stroke={`rgba(${SISAL},0.55)`} strokeWidth={w * 0.34} transform="translate(-0.7 -0.9)" />
    </g>
  );
  const fleur = (r: ReturnType<typeof rosette>, i: number) => (
    <g key={`r${i}`}>
      <path d={r.petales} fill="rgba(0,0,0,0.55)" transform="translate(1.4 2)" />
      <path d={r.petales} fill={`rgba(${BRUN},0.95)`} stroke={`rgba(${SISAL},0.5)`} strokeWidth={1.1} />
      <path d={r.anneau} fill="none" stroke={`rgba(${SISAL},0.32)`} strokeWidth={1.6} />
      <path d={r.bouton} fill={`rgba(${SISAL},0.55)`} />
    </g>
  );
  return (
    <>
      <defs>
        <linearGradient id={`kf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0} />
          <stop offset="0.35" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={1} />
        </linearGradient>
        <mask id={`km-${id}`}>
          <rect x={0} y={BANDE} width={W} height={H - BANDE} fill={`url(#kf-${id})`} />
        </mask>
      </defs>

      {/* Le fil du bois */}
      <path d={bois.fonce} fill="none" stroke={m.fonce} strokeWidth={1.6} />
      <path d={bois.clair} fill="none" stroke={m.clair} strokeWidth={1.1} />

      {dos ? (
        <>
          {/* Le linteau : sept rosettes, entre deux filets */}
          <path d="M96 92H928M96 192H928" stroke="rgba(0,0,0,0.5)" strokeWidth={3} transform="translate(1 2)" />
          <path d="M96 92H928M96 192H928" stroke={`rgba(${SISAL},0.3)`} strokeWidth={1.6} />
          {linteau.map(fleur)}
          {/* Le kiondo autour de la lune */}
          <path d={k.ombre} stroke="rgba(0,0,0,0.5)" strokeWidth={3.2} strokeLinecap="round" />
          <path d={k.nature} stroke={`rgba(${SISAL},0.5)`} strokeWidth={2.9} strokeLinecap="round" />
          <path d={k.teint} stroke={`rgba(${TEINT},0.95)`} strokeWidth={2.9} strokeLinecap="round" />
          <path d={k.filets} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={1} />
          {/* La lisière d'un kikoi sous le logotype, et sa frange */}
          <rect x={64} y={1400} width={W - 128} height={64} fill={`url(#kd-${id})`} />
          <defs>
            <pattern id={`kd-${id}`} width={8} height={64} patternUnits="userSpaceOnUse" x={0} y={1400}>
              {[
                [0, 3, "s"],
                [6, 2, "c"],
                [11, 2, "c"],
                [18, 12, "t"],
                [34, 2, "s"],
                [39, 2, "s"],
                [46, 5, "c"],
                [56, 3, "s"],
              ].map(([y, l, c], i) => (
                <rect key={i} x={0} y={y as number} width={8} height={l as number} fill={c === "t" ? `rgba(${BRUN},0.95)` : c === "c" ? `rgba(${CORAIL},0.16)` : `rgba(${SISAL},0.26)`} />
              ))}
            </pattern>
          </defs>
          <path
            d={memo("frange", () => {
              let d = "";
              for (let x = 70; x <= W - 70; x += 14) d += `M${x} 1466L${x - 2} 1502M${x + 4} 1466L${x + 3} 1502`;
              return d;
            })}
            stroke={`rgba(${SISAL},0.28)`}
            strokeWidth={1.4}
          />
          <path
            d={memo("noeuds", () => {
              let d = "";
              for (let x = 72; x <= W - 70; x += 14) d += `M${x - 2.6} 1470a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0`;
              return d;
            })}
            fill={`rgba(${SISAL},0.32)`}
          />
        </>
      ) : (
        /* La bande du bas : les deux lisières rayées d'un kikoi, le long des bords, à peine */
        <g mask={`url(#km-${id})`}>
          {RAYURES_KIKOI.flatMap((r, i) =>
            [24 + r.x, W - 24 - r.x - r.l].map((x, j) => (
              <rect
                key={`${i}-${j}`}
                x={x}
                y={BANDE}
                width={r.l}
                height={H - BANDE}
                fill={r.c === "t" ? `rgba(${BRUN},0.55)` : r.c === "c" ? `rgba(${CORAIL},0.1)` : `rgba(${SISAL},0.13)`}
              />
            ))
          )}
        </g>
      )}

      {/* Le chambranle : la chaîne entrelacée, ses perles, les rosettes d'angle */}
      {sculpte(ch.brins, dos ? 5.2 : 4.4, "b")}
      <path d={ch.dessus} fill="none" stroke="rgba(0,0,0,0.7)" strokeWidth={dos ? 9 : 8} strokeLinecap="butt" />
      {sculpte(ch.dessus, dos ? 5.2 : 4.4, "d")}
      <path d={ch.perles} fill="rgba(0,0,0,0.5)" transform="translate(1 1.6)" />
      <path d={ch.perles} fill={`rgba(${SISAL},0.6)`} />
      {coins.map(fleur)}
    </>
  );
}

const lamu: SkinNation = {
  nation: "ke",
  nom: "Lamu",
  quoi: "Le chambranle sculpté des portes de Lamu, le kikoi tissé de la côte et la spirale du kiondo.",
  sources: [
    { titre: "UNESCO, Vieille ville de Lamu (patrimoine mondial, 2001)", url: "https://whc.unesco.org/en/list/1055" },
    { titre: "A. Komba, les styles de portes de la côte swahilie, Sanaa Journal (Dar es Salaam)", url: "https://sanaajournal.ac.tz/index.php/sanaa/article/download/33/10/" },
    { titre: "To Engrave Beauty (Kutia Nakshi) : une porte sculptée de Lamu, CSMC, université de Hambourg", url: "https://www.csmc.uni-hamburg.de/publications/aom/030-en.html" },
    { titre: "Paukwa, le kikoi de la côte kényane", url: "https://www.paukwa.or.ke/?p=17954" },
    { titre: "Musées nationaux du Kenya, panier tressé (kiondo), via Google Arts & Culture", url: "https://artsandculture.google.com/asset/basket/oQHLkcKcbPVl4g?hl=en" },
  ],
  dessine: true,
  matiere: {
    titre: "lamu",
    encre: CORAIL,
    sombre: true,
    papier: [
      "linear-gradient(112deg, rgba(255,236,200,0) 30%, rgba(255,236,200,0.05) 42%, rgba(255,236,200,0) 54%)",
      "radial-gradient(95% 60% at 50% 28%, rgba(120,80,48,0.28) 0%, rgba(120,80,48,0) 70%)",
      `linear-gradient(170deg, ${BOIS.haut} 0%, ${BOIS.milieu} 52%, ${BOIS.bas} 100%)`,
    ].join(", "),
    motif: { clair: `rgba(${SISAL},0.05)`, fonce: "rgba(0,0,0,0.28)" },
    fond: "#1a120d",
    lueur: "rgba(240,224,196,0.08)",
    rayures: 0.04,
    micro: 0.05,
    reflet: 0.12,
    coins: 0.6,
    etiquette: { fond: "#120c08", bord: `rgba(${CORAIL},0.45)`, texte: `rgba(${CORAIL},0.92)` },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,232,196,0.3)", ombre: "rgba(0,0,0,0.75)" },
    puce: "linear-gradient(135deg, #e6d7b8, #8f7650 45%, #d2bf98 70%, #5d4a30)",
    cadre: `linear-gradient(152deg, #3a2a1f 0%, ${BOIS.bas} 40%, #2a1d15 64%, #0c0806 100%)`,
    voile: "rgba(10,6,4,0.82)",
    onglet: { fond: "#efe7da", encre: "#1a120c" },
    vive: "#d4c6a6",
    tranche: { couleur: "#22170f", metal: 0.08, rugosite: 0.62 },
    holo: { force: 0.22, teinte: [1, 0.9, 0.76] },
  },
  Motif: Lamu,
};

export default lamu;
