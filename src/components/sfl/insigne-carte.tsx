"use client";

// Les insignes de carte : le badge que le joueur porte sur sa carte
// (lib/sfl/badge-carte.ts), redessiné le 24/10. Sabri : « Si je vais sur la
// carte d'Ilyes, son badge en haut à droite, c'est un écusson simple. On ne
// reconnaît pas très bien le diamant qui est à l'intérieur, qui correspond
// quand même au trophée Pépite d'Or de la saison 0. Il faudrait quelque chose
// de plus visible, plus reconnaissable, plus stylé. »
//
// L'objet 3D du badge (badge-3d.tsx) devenait une tache de 30 px sur la
// carte : la pierre, vue d'en haut, ressemblait à un œil. L'insigne est donc
// dessiné, comme un bijou taillé : chaque emblème est fait de facettes
// planes dans les tons de son métal (l'éclat, le clair, le moyen, le sombre,
// la nuit), éclairées d'en haut à gauche, et sa silhouette reste nette à
// toutes les tailles. Le diamant de la Pépite d'Or est un brillant vu de
// profil, la table, la couronne et la culasse, avec son étincelle.
//
// Deux familles, deux formes, comme avant (Sabri, 19/10 : « il faut qu'on
// les distingue mieux ») :
//   · fin de saison : un hexagone taillé, son biseau en six pans, et le rang
//     (1er or, 2e argent, 3e bronze) sur sa pastille ;
//   · palier : une pièce ronde, sa tranche crénelée, et un point par palier
//     sous l'emblème (bronze, argent, or, puis rouge et or).
// Dedans, un émail noir où brille le métal ; au rouge et or, l'émail est
// rouge et le métal en or.
//
// Sur la grande carte, l'insigne est au bout d'une bulle qui dit ce qu'il
// récompense (BulleBadge : « PÉPITE D'OR 1er · S0 »), à gauche du nom,
// au-dessus de la note (Sabri, 24/10 : « essaie de le mettre juste au-dessus
// de la grande note […] à la gauche du prénom […] une espèce de bulle et,
// peut-être au bout, le badge »). Sur la petite carte, il reste en haut à
// droite, seul.
//
// Tout est en SVG peint (pas de flou d'arrière-plan, pas de texte découpé) :
// html-to-image le capture tel quel pour la carte 3D.

import { useId } from "react";
import { PastilleRang } from "@/components/sfl/badge-3d";
import type { BadgeCarte } from "@/lib/sfl/badge-carte";
import { CLASSEMENTS, ordinal, type ClassementId } from "@/lib/sfl/fin-de-saison";
import { metal, NOM_METAL, TROPHEES, type Metal, type TropheeId } from "@/lib/sfl/trophees";

const ANTON = "var(--font-anton), Anton, sans-serif";
const MONO = "var(--font-jbmono), ui-monospace, monospace";

type Ton = "eclat" | "clair" | "moyen" | "sombre" | "nuit";
type Tons = Record<Ton, string> & {
  /** L'émail du fond : la lueur du métal au centre, puis le noir. */
  email: [string, string, string];
  /** Le texte de la bulle, dans le métal. */
  texte: string;
};

/** Les métaux, du plus clair au plus foncé. */
export const TONS: Record<Metal, Tons> = {
  or: {
    eclat: "#fff8dc",
    clair: "#f8d77e",
    moyen: "#dcaa3a",
    sombre: "#9b6a14",
    nuit: "#4a3104",
    email: ["#5e4510", "#1c1508", "#070604"],
    texte: "#f6d98d",
  },
  argent: {
    eclat: "#ffffff",
    clair: "#e9edf2",
    moyen: "#b9c0c9",
    sombre: "#7b828c",
    nuit: "#363b42",
    email: ["#3e4657", "#14161c", "#060708"],
    texte: "#eef1f5",
  },
  bronze: {
    eclat: "#ffe4ca",
    clair: "#eeb482",
    moyen: "#c27a44",
    sombre: "#87461b",
    nuit: "#40200a",
    email: ["#5c3116", "#1a0f07", "#070403"],
    texte: "#f1bd90",
  },
  // Rouge et or : le métal en or, l'émail rouge.
  legende: {
    eclat: "#fff8dc",
    clair: "#f8d77e",
    moyen: "#dcaa3a",
    sombre: "#9b6a14",
    nuit: "#4a3104",
    email: ["#c2201f", "#540708", "#1a0202"],
    texte: "#f6d98d",
  },
};

const METAL_RANG: Record<number, Metal> = { 1: "or", 2: "argent", 3: "bronze" };

export function metalInsigne(b: BadgeCarte): Metal {
  return b.famille === "saison" ? METAL_RANG[b.rang] ?? "bronze" : metal(b.palier) ?? "bronze";
}

/** Le dégradé d'un métal, pour un liseré en CSS. */
export function degradeMetal(m: Metal, angle = 135): string {
  const t = TONS[m];
  return `linear-gradient(${angle}deg, ${t.eclat} 0%, ${t.moyen} 30%, ${t.clair} 52%, ${t.sombre} 78%, ${t.clair} 100%)`;
}

/* -------------------------------- Emblèmes -------------------------------- */

type Embleme = "diamant" | "ballon" | "crampon" | "etoile" | "bouclier" | "eclair" | "terrain" | "coupe";

const EMBLEME_SAISON: Record<ClassementId, Embleme> = {
  pepite: "diamant",
  buteur: "ballon",
  passeur: "crampon",
  mvp: "etoile",
  defenseur: "bouclier",
};

const EMBLEME_PALIER: Record<TropheeId, Embleme> = {
  buts: "ballon",
  passes: "crampon",
  matchs: "terrain",
  victoires: "coupe",
  mvp: "etoile",
  mur: "bouclier",
  impact: "eclair",
};

type P = [number, number];
const poly = (pts: P[]) => `M${pts.map(([x, y]) => `${x} ${y}`).join(" L")} Z`;

/** La lumière vient d'en haut, un peu à gauche : la teinte d'une facette selon sa normale. */
function tonDe(nx: number, ny: number): Ton {
  const l = Math.hypot(nx, ny) || 1;
  const d = (-0.42 * nx - 0.91 * ny) / l;
  return d > 0.62 ? "eclat" : d > 0.2 ? "clair" : d > -0.2 ? "moyen" : d > -0.62 ? "sombre" : "nuit";
}

/** L'étincelle : une étoile à quatre branches, blanche, sur son halo. */
function Etincelle({ x, y, r, id }: { x: number; y: number; r: number; id: string }) {
  const k = r / 10;
  return (
    <g>
      <circle cx={x} cy={y} r={r * 1.1} fill={`url(#${id}h)`} />
      <path
        transform={`translate(${x - r} ${y - r}) scale(${k})`}
        d="M10 0 C10.8 7 13 9.2 20 10 C13 10.8 10.8 13 10 20 C9.2 13 7 10.8 0 10 C7 9.2 9.2 7 10 0 Z"
        fill="#ffffff"
      />
    </g>
  );
}

/** Le brillant, vu de profil : la table, la couronne en cinq facettes, la culasse en trois. */
function Diamant({ t, id }: { t: Tons; id: string }) {
  const T1: P = [35, 29];
  const Tm: P = [50, 29];
  const T2: P = [65, 29];
  const G1: P = [21, 41];
  const A: P = [39, 41];
  const B: P = [61, 41];
  const G2: P = [79, 41];
  const C: P = [50, 76];
  const L = (p: P) => `${p[0]} ${p[1]}`;
  return (
    <g strokeLinejoin="round">
      <path d={poly([G1, T1, A])} fill={t.clair} />
      <path d={poly([T1, Tm, A])} fill={t.eclat} />
      <path d={poly([Tm, B, A])} fill={t.moyen} />
      <path d={poly([Tm, T2, B])} fill={t.clair} />
      <path d={poly([T2, G2, B])} fill={t.sombre} />
      <path d={poly([G1, A, C])} fill={t.clair} />
      <path d={poly([A, B, C])} fill={t.sombre} />
      <path d={poly([B, G2, C])} fill={t.nuit} />
      <path
        d={`M${L(G1)} L${L(G2)} M${L(T1)} L${L(A)} L${L(Tm)} L${L(B)} L${L(T2)} M${L(A)} L${L(C)} M${L(B)} L${L(C)}`}
        fill="none"
        stroke={t.nuit}
        strokeOpacity={0.5}
        strokeWidth={0.8}
      />
      <path d={poly([T1, T2, G2, C, G1])} fill="none" stroke={t.nuit} strokeWidth={1.5} />
      <Etincelle x={68} y={27} r={7.5} id={id} />
    </g>
  );
}

/** Le ballon : une sphère de métal, le pentagone au centre et les cinq du bord en émail. */
function Ballon({ t, id }: { t: Tons; id: string }) {
  const cx = 50;
  const cy = 52;
  const R = 25;
  const pent = (x: number, y: number, r: number, rot: number) =>
    poly(
      Array.from({ length: 5 }, (_, i) => {
        const a = ((rot + i * 72) * Math.PI) / 180;
        return [x + r * Math.cos(a), y + r * Math.sin(a)] as P;
      })
    );
  const dirs = [-90, -18, 54, 126, 198];
  return (
    <g>
      <clipPath id={`${id}b`}>
        <circle cx={cx} cy={cy} r={R} />
      </clipPath>
      <circle cx={cx} cy={cy} r={R} fill={t.sombre} />
      <g clipPath={`url(#${id}b)`}>
        <circle cx={cx - 4} cy={cy - 4} r={R - 2} fill={t.moyen} />
        <circle cx={cx - 7} cy={cy - 7} r={R - 7} fill={t.clair} />
        {dirs.map((d) => {
          const a = (d * Math.PI) / 180;
          const x0 = cx + 8.6 * Math.cos(a);
          const y0 = cy + 8.6 * Math.sin(a);
          const x1 = cx + 15.5 * Math.cos(a);
          const y1 = cy + 15.5 * Math.sin(a);
          return <path key={d} d={`M${x0} ${y0} L${x1} ${y1}`} stroke={t.nuit} strokeWidth={1.3} />;
        })}
        {dirs.map((d) => {
          const a = (d * Math.PI) / 180;
          return <path key={`p${d}`} d={pent(cx + 24 * Math.cos(a), cy + 24 * Math.sin(a), 8.6, d + 180)} fill={t.nuit} />;
        })}
      </g>
      <path d={pent(cx, cy, 8.6, -90)} fill={t.nuit} />
      <ellipse cx={41} cy={42} rx={5.5} ry={3.4} transform="rotate(-38 41 42)" fill={t.eclat} opacity={0.85} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={t.nuit} strokeWidth={1.5} />
    </g>
  );
}

/** Le crampon, de profil : la tige, le laçage, la semelle et ses crampons. */
function Crampon({ t }: { t: Tons }) {
  const corps =
    "M27 33 H41 C43.5 33 45 34.2 46.2 36.4 L49.5 42.5 C58 44.5 69 47.8 76.5 51.2 C80.6 53 82.5 56 82.5 59.5 V64 H22.5 V37.5 C22.5 35 24.5 33 27 33 Z";
  const dessus =
    "M22.5 37.5 C22.5 35 24.5 33 27 33 H41 C43.5 33 45 34.2 46.2 36.4 L49.5 42.5 C58 44.5 69 47.8 76.5 51.2 C79 52.3 80.6 53.8 81.6 55.6 C70 52.6 58 50.4 47 50 C38 49.7 30 50.4 22.5 51.8 Z";
  const semelle = "M22.5 64 H82.5 V65.5 C82.5 67.5 81 69 79 69 H25.5 C23.8 69 22.5 67.7 22.5 66 Z";
  return (
    <g strokeLinejoin="round">
      <path d={corps} fill={t.moyen} />
      <path d={dessus} fill={t.clair} />
      <path d="M22.5 40 H29 V64 H22.5 Z" fill={t.sombre} />
      <path d="M41 33 C43.5 33 45 34.2 46.2 36.4 L49.5 42.5 L46 43.5 L42.2 36.8 C41.6 35.6 41.2 34.4 41 33 Z" fill={t.eclat} opacity={0.9} />
      {[
        [50.5, 46.4, 52.6, 43.1],
        [55, 47.6, 57.1, 44.3],
        [59.5, 48.9, 61.6, 45.6],
      ].map(([a, b, c, d]) => (
        <path key={a} d={`M${a} ${b} L${c} ${d}`} stroke={t.nuit} strokeWidth={1.5} strokeLinecap="round" opacity={0.75} />
      ))}
      <path d={semelle} fill={t.nuit} />
      {[26, 35, 57, 66, 75].map((x) => (
        <rect key={x} x={x} y={68.5} width={5} height={6} rx={1.4} fill={t.sombre} stroke={t.nuit} strokeWidth={0.9} />
      ))}
      <path d={corps} fill="none" stroke={t.nuit} strokeWidth={1.4} />
    </g>
  );
}

/** L'étoile à cinq branches, chaque branche en deux pans, l'un dans la lumière. */
function Etoile({ t, id }: { t: Tons; id: string }) {
  const cx = 50;
  const cy = 53;
  const Rx = 29;
  const rx = 12;
  const pt = (i: number): P => {
    const r = i % 2 ? rx : Rx;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const facettes = Array.from({ length: 10 }, (_, i) => {
    const a = pt(i);
    const b = pt(i + 1);
    // La normale du pan : du centre vers le milieu de son arête.
    const mx = (a[0] + b[0]) / 2 - cx;
    const my = (a[1] + b[1]) / 2 - cy;
    return { d: poly([[cx, cy], a, b]), ton: tonDe(mx, my) };
  });
  const contour = poly(Array.from({ length: 10 }, (_, i) => pt(i)));
  return (
    <g strokeLinejoin="round">
      {facettes.map((f, i) => (
        <path key={i} d={f.d} fill={t[f.ton]} />
      ))}
      <path d={contour} fill="none" stroke={t.nuit} strokeWidth={1.5} />
      <Etincelle x={70} y={30} r={5.5} id={id} />
    </g>
  );
}

/** Le bouclier : l'écu en deux moitiés, la lumière à gauche, et son champ biseauté. */
function Bouclier({ t }: { t: Tons }) {
  const gauche = "M50 23.5 C43 25.5 35 27 27 29 V50 C27 64.5 36.5 74 50 80 Z";
  const droite = "M50 23.5 C57 25.5 65 27 73 29 V50 C73 64.5 63.5 74 50 80 Z";
  const dedans = "translate(50 51) scale(0.64) translate(-50 -51)";
  return (
    <g strokeLinejoin="round">
      <path d={gauche} fill={t.clair} />
      <path d={droite} fill={t.sombre} />
      <g transform={dedans}>
        <path d={gauche} fill={t.moyen} />
        <path d={droite} fill={t.nuit} />
        <path d="M50 23.5 V80" stroke={t.eclat} strokeWidth={1.6} opacity={0.6} />
      </g>
      <path d={`${gauche} ${droite}`} fill="none" stroke={t.nuit} strokeWidth={1.5} />
    </g>
  );
}

/** L'éclair : deux triangles en Z, chacun en deux pans. */
function Eclair({ t }: { t: Tons }) {
  const Ut: P = [63, 15];
  const Ul: P = [29, 58];
  const Ur: P = [51, 58];
  const Mu: P = [40, 58];
  const Ll: P = [49, 42];
  const Lr: P = [71, 42];
  const Lb: P = [37, 87];
  const Ml: P = [60, 42];
  return (
    <g strokeLinejoin="round">
      <path d={poly([Ll, Ml, Lb])} fill={t.moyen} />
      <path d={poly([Ml, Lr, Lb])} fill={t.sombre} />
      <path d={poly([Ut, Ul, Mu])} fill={t.clair} />
      <path d={poly([Ut, Mu, Ur])} fill={t.eclat} />
      <path d={poly([Ut, Ul, Ur])} fill="none" stroke={t.nuit} strokeWidth={1.4} />
      <path d={poly([Ll, Lr, Lb])} fill="none" stroke={t.nuit} strokeWidth={1.4} />
    </g>
  );
}

/** Le terrain, vu de dessus : le rond central, la ligne médiane, les deux surfaces. */
function Terrain({ t, id }: { t: Tons; id: string }) {
  return (
    <g>
      <clipPath id={`${id}t`}>
        <rect x={20} y={32} width={60} height={40} rx={5.5} />
      </clipPath>
      <rect x={20} y={32} width={60} height={40} rx={5.5} fill={t.moyen} />
      <g clipPath={`url(#${id}t)`}>
        <rect x={20} y={32} width={60} height={18} fill={t.clair} />
        <rect x={20} y={66} width={60} height={6} fill={t.sombre} />
      </g>
      <g fill="none" stroke={t.nuit} strokeWidth={1.7}>
        <rect x={24.5} y={36.5} width={51} height={31} rx={1.2} />
        <path d="M50 36.5 V67.5" />
        <circle cx={50} cy={52} r={6.5} />
        <rect x={24.5} y={44} width={7.5} height={16} />
        <rect x={68} y={44} width={7.5} height={16} />
      </g>
      <circle cx={50} cy={52} r={1.4} fill={t.nuit} />
      <rect x={20} y={32} width={60} height={40} rx={5.5} fill="none" stroke={t.nuit} strokeWidth={1.4} />
    </g>
  );
}

/** La coupe : deux anses, le pied, le socle à deux marches. */
function Coupe({ t }: { t: Tons }) {
  const gauche = "M50 26 H32 V30 C32 46 39 56 50 57.5 Z";
  const droite = "M50 26 H68 V30 C68 46 61 56 50 57.5 Z";
  return (
    <g strokeLinejoin="round">
      <path d="M33 31 C22 30.5 21.5 45.5 35 47.5" fill="none" stroke={t.moyen} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M67 31 C78 30.5 78.5 45.5 65 47.5" fill="none" stroke={t.sombre} strokeWidth={3.6} strokeLinecap="round" />
      <path d={gauche} fill={t.clair} />
      <path d={droite} fill={t.sombre} />
      <path d="M30 24 H70 V28.5 H30 Z" fill={t.eclat} />
      <path d="M36 31 C36 41 39.5 48.5 44 52" fill="none" stroke={t.eclat} strokeWidth={1.8} strokeLinecap="round" opacity={0.85} />
      <path d="M47 57 H53 L54.5 66 H45.5 Z" fill={t.moyen} />
      <path d="M38 66 H62 V71 H38 Z" fill={t.clair} />
      <path d="M35 71 H65 V77 H35 Z" fill={t.sombre} />
      <path d={`${gauche} ${droite}`} fill="none" stroke={t.nuit} strokeWidth={1.3} />
      <path d="M30 24 H70 V28.5 H30 Z M38 66 H62 V71 H38 Z M35 71 H65 V77 H35 Z" fill="none" stroke={t.nuit} strokeWidth={1.2} />
    </g>
  );
}

function DessinEmbleme({ e, t, id }: { e: Embleme; t: Tons; id: string }) {
  switch (e) {
    case "diamant":
      return <Diamant t={t} id={id} />;
    case "ballon":
      return <Ballon t={t} id={id} />;
    case "crampon":
      return <Crampon t={t} />;
    case "etoile":
      return <Etoile t={t} id={id} />;
    case "bouclier":
      return <Bouclier t={t} />;
    case "eclair":
      return <Eclair t={t} />;
    case "terrain":
      return <Terrain t={t} id={id} />;
    case "coupe":
      return <Coupe t={t} />;
  }
}

/* --------------------------------- Montures -------------------------------- */

const hexagone = (r: number): P[] =>
  Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
  });

/** L'hexagone taillé des fins de saison : six pans de biseau, chacun dans sa lumière. */
function Hexagone({ t, id }: { t: Tons; id: string }) {
  const O = hexagone(48);
  const I = hexagone(39);
  const pans = O.map((o, i) => {
    const j = (i + 1) % 6;
    const mx = (o[0] + O[j][0]) / 2 - 50;
    const my = (o[1] + O[j][1]) / 2 - 50;
    return { d: poly([o, O[j], I[j], I[i]]), ton: tonDe(mx, my) };
  });
  return (
    <g strokeLinejoin="round">
      {pans.map((p, i) => (
        <path key={i} d={p.d} fill={t[p.ton]} />
      ))}
      <path d={poly(I)} fill={`url(#${id}e)`} />
      <path d={poly(I)} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={1.4} />
      <path d={poly(hexagone(37.6))} fill="none" stroke={t.clair} strokeOpacity={0.28} strokeWidth={0.7} />
      {I.map((p, i) => (
        <path key={i} d={`M${O[i][0]} ${O[i][1]} L${p[0]} ${p[1]}`} stroke={t.nuit} strokeOpacity={0.35} strokeWidth={0.6} />
      ))}
      <path d={poly(O)} fill="none" stroke={t.nuit} strokeWidth={1.1} />
    </g>
  );
}

/** La pièce ronde des paliers : la tranche crénelée, le biseau, l'émail, un point par palier. */
function Piece({ t, id, palier }: { t: Tons; id: string; palier: number }) {
  const n = Math.max(1, Math.min(4, palier));
  return (
    <g>
      <circle cx={50} cy={50} r={48} fill={`url(#${id}r)`} />
      {Array.from({ length: 60 }, (_, i) => {
        const a = (i * 6 * Math.PI) / 180;
        return (
          <path
            key={i}
            d={`M${50 + 44.6 * Math.cos(a)} ${50 + 44.6 * Math.sin(a)} L${50 + 47.4 * Math.cos(a)} ${50 + 47.4 * Math.sin(a)}`}
            stroke={t.nuit}
            strokeOpacity={0.32}
            strokeWidth={1}
          />
        );
      })}
      <circle cx={50} cy={50} r={39} fill={`url(#${id}e)`} />
      <circle cx={50} cy={50} r={39} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={1.4} />
      <circle cx={50} cy={50} r={40.4} fill="none" stroke={t.eclat} strokeOpacity={0.4} strokeWidth={0.8} />
      <circle cx={50} cy={50} r={48} fill="none" stroke={t.nuit} strokeWidth={1.1} />
      {Array.from({ length: n }, (_, i) => {
        const a = ((90 + (i - (n - 1) / 2) * 14) * Math.PI) / 180;
        return <circle key={i} cx={50 + 43.6 * Math.cos(a)} cy={50 + 43.6 * Math.sin(a)} r={2.5} fill={t.eclat} stroke={t.nuit} strokeWidth={0.8} />;
      })}
    </g>
  );
}

/**
 * L'ombre portée, en aplats qui se superposent : un filtre CSS (drop-shadow)
 * ne passe pas toujours dans la capture html-to-image de WebKit.
 */
function Ombre({ saison }: { saison: boolean }) {
  return (
    <g fill="#000000">
      {[
        { dy: 2, k: 1.0, a: 0.16 },
        { dy: 3.5, k: 1.02, a: 0.1 },
        { dy: 5, k: 1.04, a: 0.06 },
      ].map(({ dy, k, a }) => (
        <g key={dy} transform={`translate(50 ${50 + dy}) scale(${k}) translate(-50 -50)`} opacity={a}>
          {saison ? <path d={poly(hexagone(48))} /> : <circle cx={50} cy={50} r={48} />}
        </g>
      ))}
    </g>
  );
}

/**
 * L'insigne d'un badge : sa monture (hexagone de fin de saison, pièce de
 * palier), son émail, son emblème taillé. `rang` : la pastille du rang
 * d'une fin de saison (la bulle l'écrit déjà en toutes lettres).
 */
export function InsigneCarte({ badge, largeur, rang = true }: { badge: BadgeCarte; largeur: number; rang?: boolean }) {
  const id = `i${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const m = metalInsigne(badge);
  const t = TONS[m];
  const saison = badge.famille === "saison";
  const e = saison ? EMBLEME_SAISON[badge.id] : EMBLEME_PALIER[badge.id];
  return (
    <span role="img" aria-label={`Badge : ${nomInsigne(badge)}`} className="relative block shrink-0" style={{ width: largeur, height: largeur }}>
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        width={largeur}
        height={largeur}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <radialGradient id={`${id}e`} cx="50%" cy="38%" r="62%">
            <stop offset="0%" stopColor={t.email[0]} />
            <stop offset="58%" stopColor={t.email[1]} />
            <stop offset="100%" stopColor={t.email[2]} />
          </radialGradient>
          <linearGradient id={`${id}r`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor={t.eclat} />
            <stop offset="28%" stopColor={t.clair} />
            <stop offset="55%" stopColor={t.moyen} />
            <stop offset="80%" stopColor={t.sombre} />
            <stop offset="100%" stopColor={t.nuit} />
          </linearGradient>
          <radialGradient id={`${id}h`}>
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>
        </defs>
        <Ombre saison={saison} />
        {saison ? <Hexagone t={t} id={id} /> : <Piece t={t} id={id} palier={badge.palier} />}
        <g transform="translate(50 50) scale(0.92) translate(-50 -50)">
          <DessinEmbleme e={e} t={t} id={id} />
        </g>
      </svg>
      {saison && rang && (
        <span className="pointer-events-none absolute" style={{ right: -largeur * 0.1, bottom: -largeur * 0.06 }}>
          <PastilleRang rang={badge.rang} taille={largeur * 0.38} />
        </span>
      )}
    </span>
  );
}

/* ---------------------------------- La bulle ---------------------------------- */

/** Le nom d'un badge, en toutes lettres : « Pépite d'Or, 1er, Saison 0 », « Buts, Or ». */
export function nomInsigne(b: BadgeCarte): string {
  if (b.famille === "saison") {
    const nom = CLASSEMENTS.find((c) => c.id === b.id)!.nom;
    return `${nom}, ${ordinal(b.rang)}${b.saison ? `, ${b.saison}` : ""}`;
  }
  const m = metal(b.palier)!;
  return `${TROPHEES.find((t) => t.id === b.id)!.nom}, ${NOM_METAL[m]}`;
}

/** Ce qu'un palier dit sur la carte : le seuil atteint (« 25 buts », « MVP ×3 »). */
function titrePalier(id: TropheeId, palier: number): string {
  const def = TROPHEES.find((t) => t.id === id)!;
  const seuil = def.paliers[Math.min(palier, def.paliers.length) - 1];
  switch (id) {
    case "buts":
    case "passes":
    case "matchs":
    case "victoires":
      return `${seuil} ${seuil > 1 ? def.unite[1] : def.unite[0]}`;
    case "mvp":
      return seuil > 1 ? `MVP ×${seuil}` : "MVP du match";
    case "mur":
      return seuil > 1 ? `Le Mur ×${seuil}` : "Le Mur";
    case "impact":
      return seuil > 1 ? `Impact ×${seuil}` : "Impact";
  }
}

/** « S0 » pour « Saison 0 ». */
const courte = (saison?: string) => {
  const n = saison?.match(/\d+/)?.[0];
  return n != null ? `S${n}` : null;
};

/**
 * Ce que la bulle écrit : le classement (« Pépite d'Or », « Buteur »), puis
 * le rang et la saison (« 1er · S0 ») ; pour un palier, le seuil atteint,
 * puis le métal.
 */
export function libelleInsigne(b: BadgeCarte): { titre: string; detail: string } {
  if (b.famille === "saison") {
    const s = courte(b.saison);
    const nom = CLASSEMENTS.find((c) => c.id === b.id)!.nom;
    return { titre: nom, detail: s ? `${ordinal(b.rang)} · ${s}` : ordinal(b.rang) };
  }
  return { titre: titrePalier(b.id, b.palier), detail: NOM_METAL[metal(b.palier)!] };
}

/**
 * La chasse d'un texte en capitales d'Anton, en em, un peu large exprès
 * (mesurée le 24/10 : « PÉPITE D'OR » 4,29 em ; I et les blancs étroits, M et
 * W larges, le reste ≈ 0,47).
 */
function chasseAnton(texte: string): number {
  let w = 0;
  for (const c of texte.toUpperCase()) {
    w += " '’·.".includes(c) ? 0.24 : c === "I" || c === "1" ? 0.34 : c === "M" || c === "W" ? 0.75 : c === "×" ? 0.35 : 0.5;
  }
  return w;
}

/**
 * La bulle de la grande carte : une capsule d'encre cerclée du métal, qui
 * dit le badge en toutes lettres, et l'insigne posé à son bout. Les cotes
 * sont dans le repère de la carte (1024 × 1656) : `u` les met à l'écran,
 * `x` est le bord gauche de l'insigne, `centre` sa hauteur, `fin` la limite
 * à droite (la colonne du nom commence après). Le titre se resserre s'il
 * est trop long pour la place.
 */
export function BulleBadge({
  badge,
  u,
  x,
  centre,
  fin,
}: {
  badge: BadgeCarte;
  u: (n: number) => number;
  x: number;
  centre: number;
  fin: number;
}) {
  const D = 150; // l'insigne
  const H = 70; // la capsule
  const BORD = 3.5;
  const AVANT = D + 16; // du bord gauche de l'insigne au texte
  const APRES = 30;
  const ECART = 14;
  const PAS = 1.5; // l'interlettrage du titre
  const DETAIL = 24;
  const m = metalInsigne(badge);
  const t = TONS[m];
  const { titre, detail } = libelleInsigne(badge);
  const place = fin - x - AVANT - APRES - 2 * BORD - ECART - detail.length * 0.6 * DETAIL;
  const taille = Math.min(48, (place - titre.length * PAS) / chasseAnton(titre));
  return (
    <div style={{ position: "absolute", left: u(x), top: u(centre - D / 2), height: u(D), display: "flex", alignItems: "center" }}>
      <div
        style={{
          marginLeft: u(D / 2),
          height: u(H),
          maxWidth: u(fin - x - D / 2),
          boxSizing: "border-box",
          paddingLeft: u(AVANT - D / 2 - BORD),
          paddingRight: u(APRES),
          borderRadius: u(H / 2),
          border: `${u(BORD)}px solid transparent`,
          background: `linear-gradient(180deg, #1e1f23, #0a0b0d) padding-box, ${degradeMetal(m)} border-box`,
          boxShadow: `inset 0 ${u(2)}px 0 rgba(255,255,255,0.09), 0 ${u(6)}px ${u(16)}px rgba(0,0,0,0.3)`,
          display: "flex",
          alignItems: "center",
          gap: u(ECART),
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <span style={{ fontFamily: ANTON, fontSize: u(taille), lineHeight: 1, letterSpacing: u(PAS), color: t.texte, textTransform: "uppercase" }}>
          {titre}
        </span>
        <span style={{ fontFamily: MONO, fontSize: u(DETAIL), fontWeight: 600, lineHeight: 1, color: "rgba(255,255,255,0.66)" }}>
          {detail}
        </span>
      </div>
      <span style={{ position: "absolute", left: 0, top: 0 }}>
        <InsigneCarte badge={badge} largeur={u(D)} rang={false} />
      </span>
    </div>
  );
}
