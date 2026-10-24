// Le maillot d'une équipe de Bola Team, de face, dessiné d'après son
// écusson (lib/sfl/blason.ts) : le corps dans la couleur principale, le
// même motif que l'écusson dans la secondaire (rayures, cerclé, bande,
// écharpe…), le col et le bout des manches dans la troisième, l'écusson
// sur le cœur. Une ombre douce sur les flancs, un liseré gris pour qu'un
// maillot blanc se voie sur l'app claire.

import { useId } from "react";
import { DessinMotif, Ecusson } from "@/components/sfl/equipe/ecusson";
import { blasonParDefaut, type Blason } from "@/lib/sfl/blason";
import type { Fond } from "@/lib/sfl/equipes";

const CORPS =
  "M42 8 C46 14 54 17 60 17 C66 17 74 14 78 8 L98 14 L114 34 L100 46 L92 38 L92 112 Q60 116 28 112 L28 38 L20 46 L6 34 L22 14 Z";
const COL = "M42 8 C46 14 54 17 60 17 C66 17 74 14 78 8";

export function Maillot({
  initiales,
  fond,
  blason,
  taille = 120,
  className,
}: {
  initiales: string;
  fond: Fond;
  blason?: Blason | null;
  taille?: number;
  className?: string;
}) {
  const id = `ml-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const b = blason ?? blasonParDefaut(fond);
  const [c1, c2, c3] = b.couleurs;
  return (
    <svg viewBox="0 0 120 120" width={taille} height={taille} className={className} role="img" aria-label={`Maillot ${initiales}`}>
      <defs>
        <clipPath id={`${id}-c`}>
          <path d={CORPS} />
        </clipPath>
        <linearGradient id={`${id}-o`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity={0.22} />
          <stop offset="0.3" stopColor="#000" stopOpacity={0} />
          <stop offset="0.7" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.22} />
        </linearGradient>
        <linearGradient id={`${id}-l`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={0.2} />
          <stop offset="0.5" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        <rect width={120} height={120} fill={c1} />
        <DessinMotif motif={b.motif} couleur={c2} w={120} h={120} decalage={-24} />
        <rect width={120} height={120} fill={`url(#${id}-o)`} />
        <rect width={120} height={120} fill={`url(#${id}-l)`} />
        <line x1={6} y1={34} x2={20} y2={46} stroke={c3} strokeWidth={5} />
        <line x1={114} y1={34} x2={100} y2={46} stroke={c3} strokeWidth={5} />
      </g>
      <path d={CORPS} fill="none" stroke="rgba(128,128,128,0.55)" strokeWidth={1.1} strokeLinejoin="round" />
      <path d={COL} fill="none" stroke={c3} strokeWidth={4.5} strokeLinecap="round" />
      <g transform="translate(67 27)">
        <Ecusson initiales={initiales} fond={fond} blason={b} taille={15} />
      </g>
    </svg>
  );
}
