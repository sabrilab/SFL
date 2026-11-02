"use client";

// L'écusson de son équipe sur la carte d'entraîneur (étude du 02/11/2026,
// branche coach-etude), à la place du numéro de maillot d'un joueur, et dans
// la pastille. La leçon de Football Manager rendue visible : on juge
// l'entraîneur à son équipe. C'est aussi le signe qui dit « entraîneur »
// quand la carte est trop petite pour que la matière suffise (78 et 48 px) :
// une pastille de joueur n'a rien en haut à droite.
//
// Le vrai écusson de l'équipe (equipe/ecusson.tsx : sa forme, son motif, son
// emblème ou ses initiales), redessiné d'une seule couleur, celle de l'encre
// de la carte, dans le trait de la matière :
//   · craie (le tableau) : le contour en trois brins interrompus, le motif
//     hachuré, l'emblème plein ;
//   · aimant (le tableau magnétique) : un aimant découpé à la forme de
//     l'écusson, posé sur le tableau : plein dans l'encre, le motif un ton
//     plus clair, l'emblème en blanc, l'arête claire en haut à gauche et
//     l'ombre portée sur le tableau ;
//   · fil (le manteau) : brodé au passé plat, le motif en aplat de fil, une
//     piqûre le long du contour, l'ombre du relief sur le drap.
// Sous 30 px, le trait se simplifie (un contour plein) pour rester net. Rien
// n'est importé : la forme et l'emblème sont ceux du blason (lib/sfl/blason.ts).

import { useId } from "react";
import { DessinMotif, FORME_PATH } from "@/components/sfl/equipe/ecusson";
import { DESSINS } from "@/components/sfl/equipe/emblemes";
import { blasonParDefaut } from "@/lib/sfl/blason";
import type { EquipeEntraineur } from "@/lib/sfl/entraineur";

export type TraitEcusson = "craie" | "aimant" | "fil";

const ANTON = "var(--font-anton), Anton, sans-serif";

/**
 * Les brins d'un trait de craie, à l'échelle du schéma de la mi-temps
 * (motifs-entraineur.tsx) : un voile de poussière, puis trois brins décalés
 * et interrompus, chacun à son rythme.
 */
export const BRINS_CRAIE = [
  { dx: 0, dy: 0, l: 3, o: 0.95, tirets: "13 2.2 21 1.6 8 3 17 2" },
  { dx: 1, dy: -0.8, l: 1.9, o: 0.62, tirets: "7 4 15 3 5 6 11 3" },
  { dx: -0.9, dy: 1, l: 1.5, o: 0.48, tirets: "4 7 10 4 3 8 9 5" },
] as const;

export function EcussonEntraineur({
  equipe,
  encre,
  trait,
  hauteur,
  halo,
}: {
  equipe: EquipeEntraineur;
  /** L'encre de la carte, « r,g,b ». */
  encre: string;
  trait: TraitEcusson;
  /** La hauteur à l'écran, en px. */
  hauteur: number;
  /** Un halo sombre dessous, pour se lire sur une photo. */
  halo?: string;
}) {
  const id = `ee-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const b = equipe.blason ?? blasonParDefaut(equipe.fond);
  const forme = FORME_PATH[b.forme];
  const petit = hauteur < 30;
  const ink = (a: number) => `rgba(${encre},${a})`;
  const n = equipe.initiales.length;
  const dessin = b.embleme === "initiales" ? null : DESSINS[b.embleme];
  const aimant = trait === "aimant";
  // Le contour : plus épais en petit, pour rester lisible.
  const epaisseur = petit ? 7 : trait === "fil" ? 5.2 : 4.4;
  // En grand, le fil se voit : le passé plat (des points serrés en biais).
  const satin = trait === "fil" && hauteur >= 70;
  // L'emblème : à la craie et au fil, dans l'encre ; sur l'aimant, en blanc.
  const plein = aimant ? "rgba(255,255,255,0.96)" : satin ? `url(#${id}-s)` : ink(0.95);
  const embleme = dessin ? (
    <path d={dessin.d} fillRule="evenodd" fill={plein} />
  ) : (
    <text
      x="50"
      y={56}
      textAnchor="middle"
      dominantBaseline="central"
      fill={plein}
      style={{ fontFamily: ANTON, letterSpacing: "0.01em" }}
      fontSize={n >= 3 ? 38 : n === 2 ? 46 : 54}
    >
      {equipe.initiales}
    </text>
  );
  return (
    <svg viewBox="-4 -4 108 114" width={(hauteur * 108) / 114} height={hauteur} aria-label={equipe.initiales} role="img" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <clipPath id={`${id}-f`}>
          <path d={forme} />
        </clipPath>
        {/* Les hachures du motif : à la craie, en biais. */}
        <pattern id={`${id}-h`} width={petit ? 9 : 6} height={petit ? 9 : 6} patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <line x1="0" y1="0" x2="0" y2={petit ? 9 : 6} stroke={ink(0.62)} strokeWidth={petit ? 3 : 1.6} />
        </pattern>
        {/* Le passé plat : le fil plein, et la lumière qui accroche un point sur trois. */}
        <pattern id={`${id}-s`} width={2.4} height={2.4} patternUnits="userSpaceOnUse" patternTransform="rotate(52)">
          <rect width={2.4} height={2.4} fill={ink(0.95)} />
          <line x1="0" y1="0" x2="0" y2="2.4" stroke="rgba(0,0,0,0.22)" strokeWidth={0.7} />
        </pattern>
        <pattern id={`${id}-m`} width={2.4} height={2.4} patternUnits="userSpaceOnUse" patternTransform="rotate(-38)">
          <rect width={2.4} height={2.4} fill={ink(0.34)} />
          <line x1="0" y1="0" x2="0" y2="2.4" stroke="rgba(0,0,0,0.18)" strokeWidth={0.7} />
        </pattern>
        {/* L'aimant : la lumière sur sa face, en biais. */}
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.22} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.18} />
        </linearGradient>
      </defs>
      {halo && <path d={forme} fill="none" stroke={halo} strokeWidth={epaisseur + 7} strokeLinejoin="round" />}
      {halo && <path d={forme} fill={halo} opacity={0.5} />}
      {/* L'aimant pose son ombre sur le tableau (deux couches, sans flou : la capture de la 3D les prend). */}
      {aimant && (
        <>
          <path d={forme} transform="translate(2.5 4.5)" fill="rgba(10,20,14,0.12)" />
          <path d={forme} transform="translate(1.2 2.2)" fill="rgba(10,20,14,0.2)" />
        </>
      )}
      {/* La broderie est en relief : son ombre portée sur le drap. */}
      {trait === "fil" && !petit && <path d={forme} transform="translate(1.8 2.6)" fill="rgba(0,0,0,0.42)" />}
      {aimant && <path d={forme} fill={ink(1)} />}
      {/* Le motif, dans la forme. */}
      <g clipPath={`url(#${id}-f)`}>
        <DessinMotif
          motif={b.motif}
          couleur={aimant ? "rgba(255,255,255,0.16)" : satin ? `url(#${id}-m)` : trait === "fil" && !petit ? ink(0.3) : `url(#${id}-h)`}
          w={100}
          h={106}
        />
        {aimant && !petit && <rect x={-4} y={-4} width={108} height={114} fill={`url(#${id}-a)`} />}
      </g>
      {/* Le contour. */}
      {trait === "craie" && !petit ? (
        <>
          <path d={forme} fill="none" stroke={ink(0.1)} strokeWidth={9} strokeLinejoin="round" />
          {BRINS_CRAIE.map((r, i) => (
            <path
              key={i}
              d={forme}
              transform={`translate(${r.dx} ${r.dy})`}
              fill="none"
              stroke={ink(r.o)}
              strokeWidth={r.l}
              strokeDasharray={r.tirets}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </>
      ) : aimant ? (
        // L'arête de l'aimant : claire en haut à gauche.
        !petit && <path d={forme} transform="translate(-0.6 -0.6)" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.6} strokeLinejoin="round" />
      ) : (
        <path d={forme} fill="none" stroke={ink(0.95)} strokeWidth={epaisseur} strokeLinejoin="round" />
      )}
      {/* La piqûre de la broderie, juste dedans. */}
      {trait === "fil" && !petit && (
        <path d={forme} transform="translate(50 53) scale(0.86) translate(-50 -53)" fill="none" stroke={ink(0.7)} strokeWidth={1.3} strokeDasharray="3 2.4" />
      )}
      {/* L'emblème, ou les initiales, au cœur ; ses gravures (le pentagone et les coutures du ballon) dans le fond. */}
      {dessin ? (
        <g transform="translate(50 53) scale(0.84) translate(-50 -53)">
          {embleme}
          {dessin.creux && <path d={dessin.creux} fillRule="evenodd" fill={aimant ? ink(1) : "rgba(10,18,14,0.82)"} />}
        </g>
      ) : (
        embleme
      )}
    </svg>
  );
}
