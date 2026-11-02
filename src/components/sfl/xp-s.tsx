"use client";

// La pastille des XP S (lib/sfl/xp-s.ts, 02/11/2026) : l'insigne du rang S
// des missions (actus/lune.tsx, InsigneLune : le symbole Bola, la lettre dans
// la balle), en petit et en noir et blanc, de la couleur du texte. Suivie du
// nombre : « ▣S 59 », « ▣S 35 / 40 ». Le lecteur d'écran lit « 59 XP S ».
// Le seul endroit où elle se dessine : Ma carte, l'en-tête du Passe, les
// Packs, le journal et l'annonce la reprennent. Jamais d'or (réservé au MVP),
// jamais de couleur de rang.

import { LUNE } from "@/components/sfl/actus/lune";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import { nombreFr, xpSFr } from "@/lib/sfl/compteur-xp";
import { cn } from "@/lib/utils";

/** La pastille seule, un peu plus haute que le texte (1,2 em) ; décorative : le nombre porte le libellé. */
export function PastilleS({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={cn("inline-block h-[1.2em] w-[1.2em] shrink-0 align-[-0.25em]", className)}>
      <path d={LOGO_BOLA.symbole} transform={LUNE.transform} fill="currentColor" />
      <text
        x={LUNE.balle.x}
        y={LUNE.balle.y}
        dy="0.36em"
        textAnchor="middle"
        fill="currentColor"
        style={{ fontFamily: "var(--font-anton), Anton, sans-serif", fontSize: 46 }}
      >
        S
      </text>
    </svg>
  );
}

/** « 59 XP S » : ce que lit le lecteur d'écran ; « 35 XP S sur 40 » avec un prix. */
export const libelleXpS = (n: number, sur?: number) => `${xpSFr(n)}${sur != null ? ` sur ${nombreFr(sur)}` : ""}`;

/** La pastille et le nombre (« ▣S 59 ») ; avec `sur`, ce qui manque (« ▣S 35 / 40 »). */
export function MontantXpS({ n, sur, className }: { n: number; sur?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[0.3em] whitespace-nowrap tabular-nums", className)} aria-label={libelleXpS(n, sur)} role="img">
      <PastilleS />
      <span aria-hidden>
        {nombreFr(n)}
        {sur != null && ` / ${nombreFr(sur)}`}
      </span>
    </span>
  );
}
