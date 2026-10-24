"use client";

// Le chargement d'une carte (card-3d.tsx), à la place de l'ancien rectangle
// brun qui pulsait. Sabri, 24/10 : « Tu mets juste un logo Bola, sans les
// lettres […] une espèce de chargement comme ça. »
//
// C'est le geste de l'intro (intro-bola.ts) : la lune naît. L'ombre couvre le
// disque, rétrécit et glisse jusqu'à devenir la balle du symbole, puis regrandit
// pour couvrir le disque à nouveau, en boucle. L'ombre est un masque, pas un
// papier de la couleur du fond : le symbole se pose sur n'importe quel fond.
// L'encre est currentColor (text-foreground) : clair et sombre.
//
// Mouvement réduit : le symbole posé, qui respire en opacité.

import { useId } from "react";

/** Le disque et la balle du symbole, repère du logo (intro-bola.ts). */
const DISQUE = { cx: 73.186, cy: 159.672, r: 56.187 };
const BALLE = { cx: 86.45, cy: 181.134, r: 34.726 };
/** L'ombre de la nouvelle lune déborde un peu le disque (aucun liseré). */
const COUVRE = 1.06;

const f = (n: number) => +n.toFixed(4);
const OMBRE = f(DISQUE.r * COUVRE);
/** L'ombre devenue la balle : son déplacement et son échelle. */
export const BALLE_POSEE = `translate(${f(BALLE.cx - DISQUE.cx)}px, ${f(BALLE.cy - DISQUE.cy)}px) scale(${f(BALLE.r / OMBRE)})`;

export function ChargementBola({ taille = 44 }: { taille?: number }) {
  const id = `lune-${useId().replace(/:/g, "")}`;
  const R = DISQUE.r;
  return (
    <svg
      role="progressbar"
      aria-label="Chargement"
      className="chargement-bola text-foreground"
      width={taille}
      height={taille}
      viewBox={`${-R * 1.1} ${-R * 1.1} ${R * 2.2} ${R * 2.2}`}
      style={{ ["--balle-posee" as string]: BALLE_POSEE }}
    >
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x={-R * 1.1} y={-R * 1.1} width={R * 2.2} height={R * 2.2}>
          <rect x={-R * 1.1} y={-R * 1.1} width={R * 2.2} height={R * 2.2} fill="#fff" />
          <circle className="chargement-bola__ombre" r={OMBRE} fill="#000" />
        </mask>
      </defs>
      {/* La face cachée de la lune, à peine là. */}
      <circle r={R} fill="currentColor" opacity={0.08} />
      <circle className="chargement-bola__lune" r={R} fill="currentColor" mask={`url(#${id})`} />
    </svg>
  );
}
