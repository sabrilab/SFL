// Les icônes des stats de gardien (Sabri, 31/10/2026 : « une petite icône
// pour qu'on sache rapidement à quoi ça correspond »), devant chaque libellé
// de la carte de gardien (bola-card.tsx, lib/sfl/gardien.ts) :
//   plo, plongeon      : la courbe du plongeon jusqu'au ballon ;
//   réf, réflexes      : l'éclair ;
//   dég, dégagement    : le ballon qui part loin, d'une flèche ;
//   jma, jeu à la main : la main ouverte ;
//   pla, placement     : le but, et le point où se tenir ;
//   phy, physique      : le pouls.
// Un trait d'encre, sans couleur, dans le repère 24 × 24 : net à toutes les
// tailles, photographié tel quel par la 3D.

import type { StatKey } from "@/lib/sfl/engine";

const TRACES: Record<StatKey, React.ReactNode> = {
  VIT: (
    <>
      <path d="M2.5 19C4 10 9.5 6 15.5 8.5" />
      <path d="M4.5 21.5h5M6.5 17.8h3" opacity={0.4} />
      <circle cx={18.5} cy={11} r={3} />
    </>
  ),
  TIR: <path d="M13.5 2.5L5 13.5h6.5L10 21.5l9-12h-6.5z" strokeLinejoin="round" />,
  PAS: (
    <>
      <circle cx={5} cy={18.5} r={2.6} />
      <path d="M7.4 16.4L20.5 4.5M20.5 4.5h-5M20.5 4.5v5" strokeLinejoin="round" />
    </>
  ),
  DRI: (
    <path
      d="M7.5 12.5V6.8a1.5 1.5 0 0 1 3 0v4.7M10.5 11.5V4.5a1.5 1.5 0 0 1 3 0v7M13.5 11.5V5.8a1.5 1.5 0 0 1 3 0v6.2M16.5 12V8.8a1.5 1.5 0 0 1 3 0v5.7a7 7 0 0 1-7 7h-.8a7 7 0 0 1-5.6-2.8L3.6 15a1.6 1.6 0 0 1 2.5-2l1.4 1.5"
      strokeLinejoin="round"
    />
  ),
  DEF: (
    <>
      <path d="M2.5 20V5.5h19V20" strokeLinejoin="round" />
      <path d="M2.5 10.5h19M8.8 5.5V20M15.2 5.5V20" opacity={0.3} />
      <circle cx={12} cy={15.5} r={2.2} fill="currentColor" stroke="none" />
    </>
  ),
  PHY: <path d="M2 12.5h4.5l2.4-5.5 4.2 11 2.6-5.5H22" strokeLinejoin="round" />,
};

/** L'icône d'une case de la carte de gardien, à la couleur de l'encre. */
export function IconeStatGardien({ k, taille, couleur }: { k: StatKey; taille: number; couleur: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      style={{ color: couleur, flexShrink: 0, alignSelf: "center" }}
    >
      {TRACES[k]}
    </svg>
  );
}
