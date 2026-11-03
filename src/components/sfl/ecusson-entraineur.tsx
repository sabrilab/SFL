"use client";

// L'écusson de son équipe sur la carte d'entraîneur (Ilyes, 02/11/2026 : la
// carte Entraîneur, direction « Tableau »), à la place du numéro de maillot
// d'un joueur, et dans la pastille. La leçon de Football Manager rendue
// visible : on juge l'entraîneur à son équipe. C'est aussi le signe qui dit
// « entraîneur » quand la carte est trop petite pour que la matière suffise
// (78 et 48 px) : une pastille de joueur n'a rien en haut à droite.
//
// Le vrai écusson de l'équipe (equipe/ecusson.tsx : sa forme, son motif, son
// emblème ou ses initiales), redessiné d'une seule couleur, celle de l'encre
// de la carte, à la craie (le Tableau) : le contour en trois brins
// interrompus, le motif hachuré, l'emblème plein. Sous 30 px, le trait se
// simplifie (un contour plein) pour rester net. Rien n'est importé : la forme
// et l'emblème sont ceux du blason (lib/sfl/blason.ts).

import { useId } from "react";
import { DessinMotif, FORME_PATH } from "@/components/sfl/equipe/ecusson";
import { DESSINS } from "@/components/sfl/equipe/emblemes";
import { blasonParDefaut } from "@/lib/sfl/blason";
import type { EquipeEntraineur } from "@/lib/sfl/entraineur";

/** Le trait de l'écusson : la craie du Tableau. */
export type TraitEcusson = "craie";

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
  hauteur,
  halo,
}: {
  equipe: EquipeEntraineur;
  /** L'encre de la carte, « r,g,b ». */
  encre: string;
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
  // Le contour : plus épais en petit, pour rester lisible.
  const epaisseur = petit ? 7 : 4.4;
  const plein = ink(0.95);
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
      </defs>
      {halo && <path d={forme} fill="none" stroke={halo} strokeWidth={epaisseur + 7} strokeLinejoin="round" />}
      {halo && <path d={forme} fill={halo} opacity={0.5} />}
      {/* Le motif, dans la forme. */}
      <g clipPath={`url(#${id}-f)`}>
        <DessinMotif motif={b.motif} couleur={`url(#${id}-h)`} w={100} h={106} />
      </g>
      {/* Le contour : trois brins de craie ; en petit, un trait plein. */}
      {petit ? (
        <path d={forme} fill="none" stroke={ink(0.95)} strokeWidth={epaisseur} strokeLinejoin="round" />
      ) : (
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
      )}
      {/* L'emblème, ou les initiales, au cœur ; ses gravures (le pentagone et les coutures du ballon) dans le fond. */}
      {dessin ? (
        <g transform="translate(50 53) scale(0.84) translate(-50 -53)">
          {embleme}
          {dessin.creux && <path d={dessin.creux} fillRule="evenodd" fill="rgba(10,18,14,0.82)" />}
        </g>
      ) : (
        embleme
      )}
    </svg>
  );
}
