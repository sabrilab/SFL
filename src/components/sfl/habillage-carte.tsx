"use client";

// L'habillage de la carte joueur : ce que le joueur a débloqué dans la passe
// et choisi de porter (fil « Missions » : useHabillage, l'écran de la passe ;
// le type est dans finitions-carte.ts), dessiné ici par du code, sans image
// ni IA (Sabri, 23/10 : « des changements de code au niveau de la carte ou
// des signes distinctifs »).
//   · le traitement de la photo : argentique (noir et blanc, grain,
//     vignette), gravure (contraste dur et tailles-douces, comme un billet),
//     marbre (le blanc d'une statue, ses veines) ;
//   · le liseré d'argent ou d'or : un filet de métal autour du portrait
//     (l'or remplace l'argent) ;
//   · le cran, de 1 à 4 : les coins de ce cadre, posés un par un dans le sens
//     des aiguilles d'une montre ; à 4, le cadre est fermé ;
//   · le sceau : un tampon à ses initiales sur le bas de la photo, comme sur
//     une pièce d'identité ;
//   · la puce dorée, et son nom gravé dans le microtexte (bola-card.tsx) ;
//   · le rang B, A ou S : l'insigne hexagonal des fiches de mission
//     (actus/missions.css), à côté de l'étiquette.
// Tout est en SVG ou en CSS dans le repère de la carte (1024 × 1656) : net à
// toutes les tailles, et photographié tel quel par la 3D (html-to-image).

import { useId } from "react";
import {
  initiales,
  METAUX,
  RANGS,
  type Metal,
  type RangCarte,
  type Traitement,
} from "@/components/sfl/finitions-carte";

const W = 1024;
const H = 1656;
const ANTON = "var(--font-anton), Anton, sans-serif";
const MONO = "var(--font-jbmono), ui-monospace, monospace";

/** Un rectangle aux coins arrondis, dans le repère de la carte. */
export interface Boite {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

const plein: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" };

/** Un id SVG sûr (useId donne des « : »). */
function useIdSvg(prefixe: string) {
  return `${prefixe}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

function DegradeMetal({ id, metal }: { id: string; metal: Metal }) {
  const tons = METAUX[metal];
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      {tons.map((c, i) => (
        <stop key={i} offset={i / (tons.length - 1)} stopColor={c} />
      ))}
    </linearGradient>
  );
}

/** Le liseré : un filet de métal qui suit la boîte (le portrait, ou le bord de la carte photo). */
export function Lisere({ metal, boite, epaisseur = 4 }: { metal: Metal; boite: Boite; epaisseur?: number }) {
  const id = useIdSvg("lisere");
  const { x, y, w, h, r } = boite;
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={plein}>
      <defs>
        <DegradeMetal id={id} metal={metal} />
      </defs>
      {/* Une ombre fine sous le filet : il est posé, pas imprimé. */}
      <rect x={x} y={y + 2} width={w} height={h} rx={r} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth={epaisseur} />
      <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={`url(#${id})`} strokeWidth={epaisseur} />
    </svg>
  );
}

/** Les coins du cadre, un par cran : en haut à gauche, en haut à droite, en bas à droite, en bas à gauche. */
export function Crans({ cran, metal, boite }: { cran: number; metal: Metal; boite: Boite }) {
  const id = useIdSvg("cran");
  if (cran <= 0) return null;
  const { x, y, w, h, r } = boite;
  const L = 118; // les bras de chaque coin, le long des côtés
  const coins = [
    `M${x + r + L} ${y}L${x + r} ${y}A${r} ${r} 0 0 0 ${x} ${y + r}L${x} ${y + r + L}`,
    `M${x + w - r - L} ${y}L${x + w - r} ${y}A${r} ${r} 0 0 1 ${x + w} ${y + r}L${x + w} ${y + r + L}`,
    `M${x + w} ${y + h - r - L}L${x + w} ${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}L${x + w - r - L} ${y + h}`,
    `M${x + r + L} ${y + h}L${x + r} ${y + h}A${r} ${r} 0 0 1 ${x} ${y + h - r}L${x} ${y + h - r - L}`,
  ].slice(0, Math.min(4, cran));
  return (
    <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={plein}>
      <defs>
        <DegradeMetal id={id} metal={metal} />
      </defs>
      {cran >= 4 && <rect x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={`url(#${id})`} strokeWidth={4} />}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {coins.map((d, i) => (
          <path key={`o${i}`} d={d} stroke="rgba(0,0,0,0.28)" strokeWidth={11} transform="translate(0 3)" />
        ))}
        {coins.map((d, i) => (
          <path key={`m${i}`} d={d} stroke={`url(#${id})`} strokeWidth={10} />
        ))}
      </g>
    </svg>
  );
}

/**
 * Le sceau : un tampon rond aux initiales du joueur, « BOLA · CERTIFIÉ »
 * tout autour, penché, à l'encre de la carte sur un voile de son papier.
 * `cote` = son diamètre en px à l'écran.
 */
export function Sceau({ nom, encre, papier, cote }: { nom: string; encre: string; papier: string; cote: number }) {
  const id = useIdSvg("sceau");
  const ink = (a: number) => `rgba(${encre},${a})`;
  const lettres = initiales(nom);
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      style={{ position: "absolute", width: cote, height: cote, transform: "rotate(-14deg)", pointerEvents: "none" }}
    >
      <defs>
        <path id={id} d="M100 100m-71 0a71 71 0 1 1 142 0a71 71 0 1 1 -142 0" />
      </defs>
      <circle cx={100} cy={100} r={92} fill={papier} />
      <circle cx={100} cy={100} r={92} fill="none" stroke={ink(0.85)} strokeWidth={6} />
      <circle cx={100} cy={100} r={56} fill="none" stroke={ink(0.6)} strokeWidth={2.5} />
      <text
        fill={ink(0.8)}
        style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, letterSpacing: 3.2 }}
      >
        <textPath href={`#${id}`}>BOLA · CERTIFIÉ · BOLA · CERTIFIÉ ·</textPath>
      </text>
      <text
        x={100}
        y={100}
        textAnchor="middle"
        dominantBaseline="central"
        fill={ink(0.92)}
        style={{ fontFamily: ANTON, fontSize: lettres.length > 1 ? 58 : 70, letterSpacing: 1 }}
      >
        {lettres}
      </text>
    </svg>
  );
}

/** L'insigne du rang : l'hexagone des fiches de mission, sa lettre en Anton. `hauteur` en px à l'écran. */
export function InsigneRang({ rang, hauteur }: { rang: RangCarte; hauteur: number }) {
  const id = useIdSvg("rang");
  const c = RANGS[rang];
  const hexa = (i: number) => {
    const w = 54 - i * 2;
    const h = 62 - i * 2;
    const x = i;
    const y = i;
    return `${x + w / 2},${y} ${x + w},${y + h / 4} ${x + w},${y + (h * 3) / 4} ${x + w / 2},${y + h} ${x},${y + (h * 3) / 4} ${x},${y + h / 4}`;
  };
  return (
    <svg aria-label={`Rang ${rang}`} role="img" viewBox="0 0 54 62" style={{ width: (hauteur * 54) / 62, height: hauteur, flexShrink: 0 }}>
      <defs>
        <linearGradient id={`${id}-b`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor={`rgb(${c.feu})`} />
          <stop offset="0.48" stopColor={`rgb(${c.lueur})`} />
          <stop offset="1" stopColor={c.sombre} />
        </linearGradient>
        <linearGradient id={`${id}-c`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor={`rgb(${c.lueur})`} />
          <stop offset="0.52" stopColor={`rgb(${c.feu})`} />
          <stop offset="1" stopColor={`rgb(${c.lueur})`} />
        </linearGradient>
      </defs>
      <polygon points={hexa(0)} fill={`url(#${id}-b)`} />
      <polygon points={hexa(3)} fill={`url(#${id}-c)`} />
      <text
        x={27}
        y={33.5}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#0a0b0d"
        style={{ fontFamily: ANTON, fontSize: 34 }}
      >
        {rang}
      </text>
    </svg>
  );
}

// Le grain de l'argentique : un bruit gris, en tuile.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E\")";

// Les veines du marbre : les lignes de niveau d'un bruit étiré (une seule
// valeur du bruit sur 64 devient un trait), en deux réseaux, l'un large et
// franc, l'autre fin.
const VEINES = [
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400' preserveAspectRatio='none'%3E%3Cfilter id='m' x='0' y='0' width='1' height='1'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.0045 0.012' numOctaves='5' seed='11'/%3E%3CfeColorMatrix type='luminanceToAlpha'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='table' tableValues='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0.5 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23m)'/%3E%3C/svg%3E")`,
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400' preserveAspectRatio='none'%3E%3Cfilter id='m' x='0' y='0' width='1' height='1'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.011 0.024' numOctaves='4' seed='4'/%3E%3CfeColorMatrix type='luminanceToAlpha'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='table' tableValues='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.7 0 0 0 0 0 0.5 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23m)'/%3E%3C/svg%3E")`,
];

const VISAGE_LIBRE = "radial-gradient(ellipse 30% 26% at 50% 36%, transparent 40%, black 100%)";

/** Le filtre de la photo, selon le traitement. */
export function filtrePhoto(traitement?: Traitement): string | undefined {
  if (traitement === "argentique") return "grayscale(1) contrast(1.16) brightness(1.03)";
  if (traitement === "gravure") return "grayscale(1) contrast(1.45) brightness(1.06)";
  if (traitement === "marbre") return "grayscale(1) sepia(0.08) brightness(1.2) contrast(0.82)";
  return undefined;
}

/**
 * Ce qui se pose sur la photo traitée, dans son cadre (position absolue,
 * plein cadre). `u` convertit le repère de la carte en px à l'écran.
 */
export function VoileTraitement({ traitement, u }: { traitement?: Traitement; u: (n: number) => number }) {
  if (traitement === "argentique")
    return (
      <>
        <div style={{ ...plein, backgroundImage: GRAIN, backgroundSize: `${Math.max(90, u(300))}px`, opacity: 0.28, mixBlendMode: "overlay" }} />
        <div style={{ ...plein, background: "radial-gradient(ellipse 72% 72% at 50% 42%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.42) 100%)" }} />
      </>
    );
  if (traitement === "gravure") {
    // Les tailles d'une taille-douce : des traits clairs qui ne se voient que
    // dans les ombres (les blancs restent le papier), serrés mais jamais sous
    // 3 px d'écart, puis des hachures en biais, plus légères.
    const pas = Math.max(3, u(9));
    const trait = Math.max(1, u(3.2));
    const pas2 = Math.max(4, u(13));
    const trait2 = Math.max(1, u(2.4));
    return (
      <>
        <div
          style={{
            ...plein,
            background: `repeating-linear-gradient(0deg, rgba(255,255,255,0.95) 0 ${trait}px, rgba(255,255,255,0) ${trait}px ${pas}px)`,
            mixBlendMode: "screen",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            ...plein,
            background: `repeating-linear-gradient(62deg, rgba(255,255,255,0.95) 0 ${trait2}px, rgba(255,255,255,0) ${trait2}px ${pas2}px)`,
            mixBlendMode: "screen",
            opacity: 0.22,
          }}
        />
        {/* L'encre du billet : un noir à peine vert. */}
        <div style={{ ...plein, background: "rgba(214,232,220,0.12)", mixBlendMode: "multiply" }} />
      </>
    );
  }
  if (traitement === "marbre")
    return (
      <>
        {/* Les veines, qui s'écartent du visage (en haut, au milieu). */}
        <div
          style={{
            ...plein,
            backgroundImage: `${VEINES[0]}, ${VEINES[1]}`,
            backgroundSize: "100% 100%",
            opacity: 0.32,
            maskImage: VISAGE_LIBRE,
            WebkitMaskImage: VISAGE_LIBRE,
          }}
        />
        <div
          style={{
            ...plein,
            background: "linear-gradient(170deg, rgba(255,255,255,0.22) 0%, rgba(232,236,240,0.08) 55%, rgba(90,98,110,0.18) 100%)",
          }}
        />
      </>
    );
  return null;
}
