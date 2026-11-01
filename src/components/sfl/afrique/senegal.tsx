// Le skin de nation « Manjak » (Sénégal ; PACK AFRIQUE 2027).
//
// Le pagne tissé manjak : des tisserands, souvent de familles venues de
// Guinée-Bissau et installées au Sénégal depuis des générations, tissent à la
// main, sur des métiers étroits, de longues bandes de coton qu'on coud
// ensuite bord à bord. Le dessin naît dans le tissage même : des flottés de
// trame supplémentaire (le fil passe par-dessus plusieurs fils de chaîne) qui
// font des losanges, des damiers, des chevrons, et des jours (des vides dans
// la toile). Ces pagnes s'amassent toute une vie et sortent aux baptêmes,
// aux mariages, aux funérailles. Et le sous-verre, la peinture sur verre de
// Dakar, peinte à l'envers : d'abord le contour noir, puis les aplats.
//   · le papier : la toile noire, son grain de trame ; l'encre : l'écru du
//     coton ;
//   · la face : autour du portrait, un liseré de sous-verre, des triangles
//     d'aplats ocre, vert et écru cernés de noir, sous le brillant du verre ;
//     sous le portrait, les bandes cousues bord à bord et leurs flottés, à
//     peine ;
//   · le dos : le pagne entier, sept bandes cousues à points apparents ;
//     sur chaque bande, des blocs de flottés qui se décalent d'une bande à
//     l'autre (le tissage propre à chaque joueur, tiré de la graine), des
//     rayures de trame ocre et verte, quelques fils d'argent (les tisserands
//     d'aujourd'hui y passent du lurex) ; au centre, la lune dans un cercle
//     de toile nue, cousu.
// Ce qu'on évite : toute figure du sous-verre (portraits, sujets religieux,
// scènes), Gorée, l'étoile et les bandes du drapeau. Pas de motif « à
// signification » inventé : rien que la géométrie du tissage.

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, BANDE, CENTRE_DOS, f, H, LOGOTYPE_DOS, PORTRAIT, W } from "./outils";

type Pt = [number, number];

// La palette : le noir de la toile, l'écru du coton, l'ocre et le vert des trames, l'argent du lurex.
const NOIR = "#121211";
const ECRU = "#e6dcc6";
const OCRE = "#9b6a43";
const VERT = "#5f7b57";
const ARGENT = "#c9c9c3";

/** Sept bandes sur la largeur de la carte. */
const BANDES = 7;
const LB = W / BANDES;

const deja = new Map<string, unknown>();
function memo<T>(cle: string, calcul: () => T): T {
  const v = deja.get(cle);
  if (v !== undefined) return v as T;
  if (deja.size > 48) deja.clear();
  const r = calcul();
  deja.set(cle, r);
  return r;
}

function rectArrondi(x: number, y: number, l: number, h: number, r: number): string {
  return `M${x + r} ${y}H${x + l - r}A${r} ${r} 0 0 1 ${x + l} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + l - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/** Un point d'un rectangle arrondi à l'abscisse curviligne s (depuis le milieu du haut), et sa normale sortante. */
function surLePourtour(x: number, y: number, l: number, h: number, r: number) {
  const lh = l - 2 * r;
  const lv = h - 2 * r;
  const q = (Math.PI / 2) * r;
  const total = 2 * lh + 2 * lv + 4 * q;
  const en = (s0: number): [Pt, Pt] => {
    let s = (((s0 + lh / 2) % total) + total) % total;
    const coin = (cx: number, cy: number, a0: number, t: number): [Pt, Pt] => {
      const a = a0 + t / r;
      return [[cx + r * Math.cos(a), cy + r * Math.sin(a)], [Math.cos(a), Math.sin(a)]];
    };
    if (s < lh) return [[x + r + s, y], [0, -1]];
    s -= lh;
    if (s < q) return coin(x + l - r, y + r, -Math.PI / 2, s);
    s -= q;
    if (s < lv) return [[x + l, y + r + s], [1, 0]];
    s -= lv;
    if (s < q) return coin(x + l - r, y + h - r, 0, s);
    s -= q;
    if (s < lh) return [[x + l - r - s, y + h], [0, 1]];
    s -= lh;
    if (s < q) return coin(x + r, y + h - r, Math.PI / 2, s);
    s -= q;
    if (s < lv) return [[x, y + h - r - s], [-1, 0]];
    s -= lv;
    return coin(x + r, y + r, Math.PI, s);
  };
  return { total, en };
}

/* ------------------------------ Les flottés ------------------------------- */

/** Un rang de flottés : une ligne de trame qui passe par-dessus la chaîne, coupée en brins. */
const rang = (x1: number, x2: number, y: number) => (x2 - x1 > 3 ? `M${f(x1)} ${f(y)}H${f(x2)}` : "");

/** Le pas des rangs de flottés. */
const PR = 7.5;

type Bloc = (cx: number, cy: number, l: number, h: number) => string;

/** Les blocs de flottés : la géométrie du tissage, rang par rang. */
const BLOCS: Bloc[] = [
  // Le losange plein, en escalier.
  (cx, cy, l, h) => {
    let d = "";
    for (let y = -h / 2; y <= h / 2; y += PR) {
      const w = (l / 2) * (1 - Math.abs(y) / (h / 2));
      d += rang(cx - w, cx + w, cy + y);
    }
    return d;
  },
  // Le losange évidé : deux losanges, le second en creux.
  (cx, cy, l, h) => {
    let d = "";
    for (let y = -h / 2; y <= h / 2; y += PR) {
      const t = 1 - Math.abs(y) / (h / 2);
      const w = (l / 2) * t;
      const v = (l / 2) * (t - 0.42);
      if (v > 4) d += rang(cx - w, cx - v, cy + y) + rang(cx + v, cx + w, cy + y);
      else d += rang(cx - w, cx + w, cy + y);
    }
    return d;
  },
  // Le damier : des carreaux de flottés, un sur deux.
  (cx, cy, l, h) => {
    let d = "";
    const n = 4;
    const c = l / n;
    for (let y = -h / 2; y <= h / 2; y += PR) {
      const ligne = Math.floor((y + h / 2) / (h / 5));
      for (let i = 0; i < n; i++) if ((i + ligne) % 2 === 0) d += rang(cx - l / 2 + i * c + 2, cx - l / 2 + (i + 1) * c - 2, cy + y);
    }
    return d;
  },
  // Les chevrons : des rangs qui se décalent, puis reviennent.
  (cx, cy, l, h) => {
    let d = "";
    const ep = l * 0.22;
    for (let y = -h / 2; y <= h / 2; y += PR) {
      const t = ((y + h / 2) % (h / 2)) / (h / 2);
      const x = -l / 2 + t * (l - ep);
      d += rang(cx + x, cx + x + ep, cy + y);
      d += rang(cx - x - ep, cx - x, cy + y);
    }
    return d;
  },
  // Le sablier : deux triangles pointe contre pointe.
  (cx, cy, l, h) => {
    let d = "";
    for (let y = -h / 2; y <= h / 2; y += PR) {
      const w = (l / 2) * Math.max(0.1, Math.abs(y) / (h / 2));
      d += rang(cx - w, cx + w, cy + y);
    }
    return d;
  },
];

/** Les jours : un rang de petites fenêtres dans la toile. */
function jours(x1: number, x2: number, y: number): { vides: string; bords: string } {
  let vides = "";
  let bords = "";
  const n = Math.max(2, Math.round((x2 - x1) / 22));
  const pas = (x2 - x1) / n;
  for (let i = 0; i < n; i++) {
    const a = x1 + i * pas + 4;
    const b = a + pas - 8;
    vides += `M${f(a)} ${f(y)}H${f(b)}V${f(y + 9)}H${f(a)}Z`;
    bords += `M${f(a)} ${f(y - 1.5)}H${f(b)}M${f(a)} ${f(y + 10.5)}H${f(b)}`;
  }
  return { vides, bords };
}

/* -------------------------------- Le pagne -------------------------------- */

interface Pagne {
  fonds: { x: number; c: string }[];
  ecru: string;
  ocre: string;
  vert: string;
  argent: string;
  trameOcre: string;
  trameVert: string;
  vides: string;
  bords: string;
  coutures: string;
  points: string;
}

/** Le pagne : sept bandes, des blocs de flottés décalés d'une bande à l'autre, les coutures à points apparents. */
function pagne(graine: number, y0: number, y1: number, force: "dos" | "face"): Pagne {
  return memo(`${force}-${graine}-${y0}`, () => {
    const rnd = alea(graine ^ 0x6d61);
    const p: Pagne = { fonds: [], ecru: "", ocre: "", vert: "", argent: "", trameOcre: "", trameVert: "", vides: "", bords: "", coutures: "", points: "" };
    const hb = force === "dos" ? 158 : 150;
    // L'ordre des blocs, mélangé (Fisher-Yates : le même partout, serveur ou navigateur).
    const ordre = Array.from({ length: BLOCS.length }, (_, i) => i);
    for (let i = ordre.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
    }
    for (let k = 0; k < BANDES; k++) {
      const x = k * LB;
      p.fonds.push({ x, c: k % 2 === 0 ? "#151513" : "#1a1917" });
      const cx = x + LB / 2;
      // Les blocs : un bloc sur deux, en quinconce d'une bande à l'autre, chacun encadré de deux rangs pleins.
      let ligne = 0;
      for (let y = y0 + (k % 2 === 0 ? 0 : hb) + hb / 2 - 10; y < y1 + hb; y += 2 * hb, ligne++) {
        const choix = ordre[(k + ligne * 2) % ordre.length];
        const d =
          BLOCS[choix](cx, y, LB - 30, hb - 44) +
          rang(x + 8, x + LB - 8, y - hb / 2 + 8) +
          rang(x + 8, x + LB - 8, y - hb / 2 + 8 + PR) +
          rang(x + 8, x + LB - 8, y + hb / 2 - 8) +
          rang(x + 8, x + LB - 8, y + hb / 2 - 8 - PR);
        const t = rnd();
        if (t < 0.62) p.ecru += d;
        else if (t < 0.8) p.ocre += d;
        else if (t < 0.94) p.vert += d;
        else p.argent += d;
        // Le carré de toile nue entre deux blocs : des rayures de trame, parfois un rang de jours.
        const yr = y + hb;
        const rayures = `M${f(x)} ${f(yr - 30)}H${f(x + LB)}M${f(x)} ${f(yr - 24)}H${f(x + LB)}M${f(x)} ${f(yr + 24)}H${f(x + LB)}M${f(x)} ${f(yr + 30)}H${f(x + LB)}`;
        if (rnd() < 0.5) p.trameOcre += rayures;
        else p.trameVert += rayures;
        if (rnd() < 0.45) {
          const j = jours(x + 12, x + LB - 12, yr - 5);
          p.vides += j.vides;
          p.bords += j.bords;
        }
      }
      // La couture : un creux le long du bord, et ses points qui passent d'une bande à l'autre.
      if (k > 0) {
        p.coutures += `M${f(x)} ${y0}V${y1}`;
        for (let y = y0 + 6; y < y1; y += 15) p.points += `M${f(x - 6)} ${f(y)}L${f(x + 6)} ${f(y + 7)}`;
      }
    }
    return p;
  });
}

/* ------------------------------ Le sous-verre ------------------------------ */

interface Lisere {
  fond: string;
  ocre: string;
  vert: string;
  noeuds: string;
}

/** La frise du liseré : de 9 (le bord) à 41 (le portrait), jusqu'à 1015 (la bande du bas). */
const FRISE = { ext: 9, bas: BANDE - 9 };

/**
 * Le liseré de sous-verre : un fond d'écru peint, des cartouches d'aplats
 * ocre et verts cernés d'un contour noir épais, un losange noir entre deux.
 */
function lisere(): Lisere {
  return memo("lisere", () => {
    const { ext, bas } = FRISE;
    const int = PORTRAIT.x;
    const m = (ext + int) / 2;
    const pr = surLePourtour(m, m, W - 2 * m, bas - (bas - (PORTRAIT.y + PORTRAIT.c)) / 2 - m, 51 + (int - m));
    const n = Math.round(pr.total / 92);
    const pas = pr.total / n;
    const P = (s: number, o: number): string => {
      const [[x, y], [nx, ny]] = pr.en(s);
      return `${f(x + nx * o)} ${f(y + ny * o)}`;
    };
    const l: Lisere = {
      fond: rectArrondi(ext, ext, W - 2 * ext, bas - ext, 92 - ext) + rectArrondi(PORTRAIT.x - 2, PORTRAIT.y - 2, PORTRAIT.c + 4, PORTRAIT.c + 4, 53),
      ocre: "",
      vert: "",
      noeuds: "",
    };
    const e = 7.5;
    for (let i = 0; i < n; i++) {
      const s0 = i * pas + 13;
      const s1 = (i + 1) * pas - 13;
      // Le cartouche : les deux bords suivis pas à pas (les coins tournent), les bouts en pointe.
      let d = `M${P(s0 - 6, 0)}`;
      for (let t = 0; t <= 8; t++) d += `L${P(s0 + ((s1 - s0) * t) / 8, e)}`;
      d += `L${P(s1 + 6, 0)}`;
      for (let t = 8; t >= 0; t--) d += `L${P(s0 + ((s1 - s0) * t) / 8, -e)}`;
      d += "Z";
      if (i % 2 === 0) l.ocre += d;
      else l.vert += d;
      const sn = (i + 1) * pas;
      l.noeuds += `M${P(sn - 6.5, 0)}L${P(sn, 6.5)}L${P(sn + 6.5, 0)}L${P(sn, -6.5)}Z`;
    }
    return l;
  });
}

/* --------------------------------- Le motif -------------------------------- */

function Trame({ id, pas, force }: { id: string; pas: number; force: number }) {
  return (
    <pattern id={id} width={pas} height={pas} patternUnits="userSpaceOnUse">
      <path d={`M0 ${pas / 2}H${pas}`} stroke={ECRU} strokeOpacity={force} strokeWidth={1.4} />
      <path d={`M${pas / 2} 0V${pas}`} stroke="#000" strokeOpacity={force * 3} strokeWidth={1} />
    </pattern>
  );
}

function Fils({ p, largeur }: { p: Pagne; largeur: number }) {
  const brin = { fill: "none", strokeWidth: largeur, strokeDasharray: "11 3.2" } as const;
  return (
    <>
      <path d={p.trameOcre} stroke={OCRE} strokeWidth={3.2} strokeDasharray="9 2.5" opacity={0.85} />
      <path d={p.trameVert} stroke={VERT} strokeWidth={3.2} strokeDasharray="9 2.5" opacity={0.85} />
      <path d={p.vides} fill="#050505" />
      <path d={p.bords} stroke={ECRU} strokeWidth={2} opacity={0.7} />
      <path d={p.ecru} stroke={ECRU} {...brin} />
      <path d={p.ocre} stroke={OCRE} {...brin} />
      <path d={p.vert} stroke={VERT} {...brin} />
      <path d={p.argent} stroke={ARGENT} {...brin} />
    </>
  );
}

function Manjak({ cote, m, graine, id }: PropsMotifNation) {
  if (cote === "face") {
    const p = pagne(graine, BANDE, H, "face");
    const l = lisere();
    return (
      <>
        <defs>
          <Trame id={`mj-t-${id}`} pas={6} force={0.045} />
          <clipPath id={`mj-b-${id}`}>
            <rect x={0} y={BANDE} width={W} height={H - BANDE} />
          </clipPath>
          <linearGradient id={`mj-v-${id}`} x1="0" y1="0" x2="1" y2="0.7">
            <stop offset="0" stopColor="#fff" stopOpacity={0.3} />
            <stop offset="0.35" stopColor="#fff" stopOpacity={0.04} />
            <stop offset="0.5" stopColor="#fff" stopOpacity={0.16} />
            <stop offset="0.62" stopColor="#fff" stopOpacity={0} />
            <stop offset="1" stopColor="#fff" stopOpacity={0.08} />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill={`url(#mj-t-${id})`} />
        {/* Sous le portrait : les bandes cousues, leurs flottés, à peine. */}
        <g clipPath={`url(#mj-b-${id})`}>
          {p.fonds.map((b) => (
            <rect key={b.x} x={b.x} y={BANDE} width={LB} height={H - BANDE} fill={b.c} opacity={0.6} />
          ))}
          <g opacity={0.16}>
            <Fils p={p} largeur={4.2} />
          </g>
          <path d={p.coutures} stroke="#000" strokeWidth={3} opacity={0.5} />
          <path d={p.points} stroke={m.clair} strokeWidth={1.8} opacity={0.32} />
        </g>
        {/* Le liseré de sous-verre : l'écru peint, les cartouches cernés de noir, les losanges ; puis le brillant du verre. */}
        <path d={l.fond} fill={ECRU} fillRule="evenodd" />
        <g stroke={NOIR} strokeWidth={3.6} strokeLinejoin="round">
          <path d={l.ocre} fill={OCRE} />
          <path d={l.vert} fill={VERT} />
        </g>
        <path d={l.noeuds} fill={NOIR} />
        <path d={rectArrondi(FRISE.ext, FRISE.ext, W - 2 * FRISE.ext, FRISE.bas - FRISE.ext, 92 - FRISE.ext)} fill="none" stroke={NOIR} strokeWidth={3} />
        <path d={l.fond} fill={`url(#mj-v-${id})`} fillRule="evenodd" />
      </>
    );
  }

  const p = pagne(graine, 0, H, "dos");
  const { cx, cy } = CENTRE_DOS;
  const bandeau = { y: LOGOTYPE_DOS.cy - 70, h: 140 };
  let pointsRond = "";
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2;
    const r1 = 352;
    const r2 = 364;
    pointsRond += `M${f(cx + r1 * Math.cos(a))} ${f(cy + r1 * Math.sin(a))}L${f(cx + r2 * Math.cos(a + 0.012))} ${f(cy + r2 * Math.sin(a + 0.012))}`;
  }
  return (
    <>
      <defs>
        <Trame id={`mj-t-${id}`} pas={6} force={0.05} />
      </defs>
      {p.fonds.map((b) => (
        <rect key={b.x} x={b.x} y={0} width={LB} height={H} fill={b.c} />
      ))}
      <rect width={W} height={H} fill={`url(#mj-t-${id})`} />
      <Fils p={p} largeur={4.4} />
      <path d={p.coutures} stroke="#000" strokeWidth={4} opacity={0.7} />
      <path d={p.points} stroke={ECRU} strokeWidth={2} opacity={0.75} strokeLinecap="round" />
      {/* Le bandeau du logotype : la toile nue, entre deux rangs de jours. */}
      <rect x={0} y={bandeau.y} width={W} height={bandeau.h} fill="#141412" />
      <rect x={0} y={bandeau.y} width={W} height={bandeau.h} fill={`url(#mj-t-${id})`} />
      <path d={`M0 ${bandeau.y}H${W}M0 ${bandeau.y + bandeau.h}H${W}`} stroke={ECRU} strokeWidth={2.4} opacity={0.6} />
      <path d={`M0 ${bandeau.y + 8}H${W}M0 ${bandeau.y + bandeau.h - 8}H${W}`} stroke={OCRE} strokeWidth={3} strokeDasharray="9 2.5" opacity={0.8} />
      {/* Le cercle de toile nue autour de la lune, cousu au point de surjet. */}
      <circle cx={cx} cy={cy} r={364} fill="#000" opacity={0.35} />
      <circle cx={cx} cy={cy} r={352} fill="#141412" />
      <circle cx={cx} cy={cy} r={352} fill={`url(#mj-t-${id})`} />
      <path d={pointsRond} stroke={ECRU} strokeWidth={2.2} strokeLinecap="round" opacity={0.85} />
      <circle cx={cx} cy={cy} r={376} fill="none" stroke={OCRE} strokeWidth={3} strokeDasharray="9 2.5" opacity={0.8} />
    </>
  );
}

const senegal: SkinNation = {
  nation: "sn",
  nom: "Manjak",
  quoi: "Le pagne tissé manjak, ses bandes cousues bord à bord et ses flottés, bordé comme un sous-verre de Dakar.",
  sources: [
    { titre: "The Met, Wrapper (Seru Njaago) : bandes étroites de coton, motifs géométriques en trame", url: "https://www.metmuseum.org/art/collection/search/687565" },
    { titre: "Au Sénégal, « Pagnes, panos » : l'histoire du tissage mandjak, exposition de Maï Diop (Ateliers Tësss)", url: "https://au-senegal.com/pagnes-panos-les-etoffes-magnetiques-des-mandjak,1622.html" },
    { titre: "Le Petit Journal Dakar : les tisserands manjak, familles venues de Guinée-Bissau", url: "https://lepetitjournal.com/dakar/a-voir-a-faire/tisserand-dakar-met-en-valeur-lexcellence-de-lartisanat-africain-247991" },
    { titre: "Au Sénégal : les peintures sous verre, art populaire, peintes à l'envers à partir du contour noir", url: "https://au-senegal.com/les-peintures-sous-verre-art-populaire-du-senegal,066.html" },
    { titre: "Vitromusée Romont : exposition du sous-verre sénégalais (dossier de presse, 2022)", url: "https://vitromusee.ch/wp-content/uploads/2024/02/DossierDePresse_Expo_Senegal_20220222.pdf" },
  ],
  dessine: true,
  matiere: {
    titre: "manjak",
    encre: "236,229,214",
    sombre: true,
    // La toile noire : le grain de la trame, la lumière douce du coton.
    papier: [
      "radial-gradient(90% 52% at 26% 14%, rgba(236,229,214,0.08) 0%, rgba(236,229,214,0) 70%)",
      "linear-gradient(118deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.05) 46%, rgba(255,255,255,0) 58%)",
      "repeating-linear-gradient(0deg, rgba(236,229,214,0.035) 0 1px, rgba(0,0,0,0) 1px 3px)",
      "linear-gradient(168deg, #1d1c1a 0%, #141412 55%, #0c0c0b 100%)",
    ].join(", "),
    motif: { clair: "rgba(236,229,214,0.6)", fonce: "rgba(0,0,0,0.5)" },
    fond: "rgba(20,20,18,0.94)",
    lueur: "rgba(236,229,214,0.14)",
    rayures: 0.012,
    micro: 0.045,
    reflet: 0.1,
    coins: 0.7,
    etiquette: { fond: "transparent", bord: "rgba(236,229,214,0.55)", texte: "rgba(236,229,214,0.88)" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(236,229,214,0.3)", ombre: "rgba(0,0,0,0.7)" },
    puce: "linear-gradient(135deg, #f1efe9, #9e9c95 45%, #dcdad3 70%, #6f6d67)",
    // La carte photo : la toile, ses bandes et un rang de flottés écrus.
    cadre: [
      "repeating-linear-gradient(0deg, rgba(230,220,198,0.16) 0 2px, rgba(0,0,0,0) 2px 5px)",
      "repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 22px, rgba(0,0,0,0.6) 22px 23px)",
      "linear-gradient(160deg, #1d1c1a 0%, #121211 70%)",
    ].join(", "),
    voile: "rgba(8,8,7,0.82)",
    onglet: { fond: "#e6dcc6", encre: "#121211" },
    vive: "#cfc4ad",
    // La 3D : une tranche de coton noir, mate ; un reflet d'argent, celui du lurex.
    dos: { micro: 0.02 },
    tranche: { couleur: "#171614", metal: 0.05, rugosite: 0.82 },
    holo: { force: 0.32, teinte: [0.94, 0.94, 0.92] },
  },
  Motif: Manjak,
};

export default senegal;
