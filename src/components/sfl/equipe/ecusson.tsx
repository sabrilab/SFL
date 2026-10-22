// L'écusson d'une équipe du mode Team : un blason noir et blanc, ses
// initiales au cœur (Inter 800, serrées). Noir sur fond blanc ou blanc sur
// fond noir, toujours cerclé du contraire : il se lit sur l'app sombre comme
// sur le terrain. Pas d'image importée (règles officielles, Q17).

import type { Fond } from "@/lib/sfl/equipes";

const BLASON = "M50 3 L93 14 V52 C93 79 74 95 50 103 C26 95 7 79 7 52 V14 Z";

export function Ecusson({ initiales, fond, taille = 48, className }: { initiales: string; fond: Fond; taille?: number; className?: string }) {
  const plein = fond === "noir" ? "#0a0b0d" : "#f4f3ef";
  const encre = fond === "noir" ? "#f4f3ef" : "#0a0b0d";
  const n = initiales.length;
  return (
    <svg viewBox="0 0 100 106" width={taille} height={taille * 1.06} className={className} role="img" aria-label={initiales}>
      <path d={BLASON} fill={plein} stroke={encre} strokeWidth={4} strokeLinejoin="round" />
      <path d="M50 12 L84 21 V52 C84 73 69 86 50 93 C31 86 16 73 16 52 V21 Z" fill="none" stroke={encre} strokeWidth={1.2} opacity={0.45} />
      <text
        x="50"
        y="58"
        textAnchor="middle"
        dominantBaseline="middle"
        fill={encre}
        style={{ fontFamily: "var(--font-sans), Inter, sans-serif", fontWeight: 800, letterSpacing: "-0.04em" }}
        fontSize={n >= 3 ? 30 : n === 2 ? 38 : 46}
      >
        {initiales}
      </text>
    </svg>
  );
}
