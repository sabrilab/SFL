// Les icônes des stats de la carte (Sabri, 31/10/2026) : une icône pleine à
// la place du libellé (« vit », « réf »…), devant chaque chiffre, sur la
// carte des joueurs comme sur celle des gardiens (bola-card.tsx,
// lib/sfl/gardien.ts). Il a d'abord vu des icônes au trait à côté du nom :
// « il faut qu'elles soient en plein », et l'icône seule.
// Le joueur :
//   vit, vitesse  : la double flèche ;
//   tir, tir      : le ballon frappé, ses traînées ;
//   pas, passe    : la flèche ;
//   dri, dribble  : le zigzag ;
//   def, défense  : le bouclier ;
//   phy, physique : l'haltère.
// Le gardien :
//   plo, plongeon      : le ballon au-dessus de la courbe du plongeon ;
//   réf, réflexes      : l'éclair ;
//   dég, dégagement    : le ballon qui part loin, d'une flèche ;
//   jma, jeu à la main : le gant ;
//   pla, placement     : le repère où se tenir ;
//   phy, physique      : l'haltère.
// À la couleur de l'encre, dans le repère 24 × 24 : net à toutes les tailles,
// photographié tel quel par la 3D.

import type { StatKey } from "@/lib/sfl/engine";

const HALTERE = (
  <path d="M1.5 9.5h2v-2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3h9v-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2h2v5h-2v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3h-9v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2h-2z" />
);

const JOUEUR: Record<StatKey, React.ReactNode> = {
  VIT: <path d="M2 4.5l9.5 7.5L2 19.5zM12 4.5l9.5 7.5L12 19.5z" strokeLinejoin="round" stroke="currentColor" strokeWidth={1.5} />,
  TIR: (
    <>
      <circle cx={16} cy={12} r={6.5} />
      <rect x={1.5} y={6.5} width={6.5} height={2.4} rx={1.2} />
      <rect x={0.5} y={10.8} width={6.5} height={2.4} rx={1.2} />
      <rect x={1.5} y={15.1} width={6.5} height={2.4} rx={1.2} />
    </>
  ),
  PAS: <path d="M2 10h12.5V5.2L22.5 12l-8 6.8V14H2z" strokeLinejoin="round" stroke="currentColor" strokeWidth={1.2} />,
  DRI: <path d="M2.5 15.5l4.5-6 4.5 5 4-5.2V6h5.5v5.5h-3.3l-6.1 7.8-4.5-5-2.9 3.9z" strokeLinejoin="round" stroke="currentColor" strokeWidth={1} />,
  DEF: <path d="M12 1.8l8.8 3.4v6.3c0 5.4-3.7 9.4-8.8 10.9C6.9 20.9 3.2 16.9 3.2 11.5V5.2z" />,
  PHY: HALTERE,
};

const GARDIEN: Record<StatKey, React.ReactNode> = {
  VIT: (
    <>
      <circle cx={17} cy={6.5} r={4.5} />
      <path d="M1.5 21.5C3 12.5 8.5 9 13 10.2l-.6 3.1C9 12.7 6 15.5 5.2 21.5z" />
    </>
  ),
  TIR: <path d="M14 1.5L4.5 13.5h6.5L9.5 22.5l10-12.5h-6.5z" strokeLinejoin="round" stroke="currentColor" strokeWidth={1} />,
  PAS: (
    <>
      <circle cx={5.5} cy={18.5} r={4} />
      <path d="M9.5 12.5l6-6h-4V3.5H21V13h-3V9l-6 6z" strokeLinejoin="round" />
    </>
  ),
  DRI: (
    <>
      <rect x={6.5} y={3} width={2.8} height={11} rx={1.4} />
      <rect x={9.8} y={1.5} width={2.8} height={12} rx={1.4} />
      <rect x={13.1} y={2.2} width={2.8} height={11.5} rx={1.4} />
      <rect x={16.4} y={4} width={2.8} height={10} rx={1.4} />
      <rect x={6.5} y={10} width={12.7} height={11.5} rx={4.5} />
      <rect x={2.8} y={9.5} width={2.8} height={8} rx={1.4} transform="rotate(-35 4.2 13.5)" />
    </>
  ),
  DEF: (
    <path
      fillRule="evenodd"
      d="M12 1.5a7.5 7.5 0 0 1 7.5 7.5c0 5.3-5.5 10.6-7.5 13.5C10 19.6 4.5 14.3 4.5 9A7.5 7.5 0 0 1 12 1.5zm0 4.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
    />
  ),
  PHY: HALTERE,
};

/** L'icône pleine d'une case de la carte, à la couleur de l'encre. */
export function IconeStat({ k, gardien, taille, couleur }: { k: StatKey; gardien: boolean; taille: number; couleur: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={taille}
      height={taille}
      fill="currentColor"
      style={{ color: couleur, flexShrink: 0, alignSelf: "center" }}
    >
      {(gardien ? GARDIEN : JOUEUR)[k]}
    </svg>
  );
}
