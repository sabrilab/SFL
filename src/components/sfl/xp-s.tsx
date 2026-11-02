"use client";

// La pastille des XP S (lib/sfl/xp-s.ts, 02/11/2026), de la couleur du texte,
// suivie du nombre : « ▣S 59 », « ▣S 35 / 40 ». Le lecteur d'écran lit
// « 59 XP S ». Le seul endroit où elle se dessine : Ma carte, l'en-tête du
// Passe, les Packs, le journal et l'annonce la reprennent. Jamais d'or
// (réservé au MVP), jamais de couleur de rang.
//
// Deux tailles (contrôle visuel du 02/11 : à la taille du texte, le S logé
// dans la balle faisait 4 px, on lisait « (lune) 63 ») :
//   · au fil du texte (11 à 15 px), le jeton : la balle de l'insigne du rang
//     S (actus/lune.tsx, InsigneLune) agrandie à toute la pastille, le S gras
//     évidé au centre, qui se lit comme une pièce ;
//   · en grand (le prix d'un pack, `lune`), l'insigne entier : le symbole
//     Bola, la lettre dans la balle.

import { useId } from "react";
import { LUNE } from "@/components/sfl/actus/lune";
import { LOGO_BOLA } from "@/components/sfl/finitions-carte";
import { nombreFr, xpSFr } from "@/lib/sfl/compteur-xp";
import { cn } from "@/lib/utils";

const ANTON_SVG = { fontFamily: "var(--font-anton), Anton, sans-serif" } as const;

/**
 * La pastille seule, un peu plus haute que le texte (1,2 em) ; décorative :
 * le nombre porte le libellé. `lune` : l'insigne entier, pour les grandes
 * tailles (au-delà de 18 px).
 */
export function PastilleS({ className, lune }: { className?: string; lune?: boolean }) {
  const masque = `pastille-s${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const classe = cn("inline-block h-[1.2em] w-[1.2em] shrink-0 align-[-0.25em]", className);
  if (lune)
    return (
      <svg viewBox="0 0 100 100" aria-hidden className={classe}>
        <path d={LOGO_BOLA.symbole} transform={LUNE.transform} fill="currentColor" />
        <text x={LUNE.balle.x} y={LUNE.balle.y} dy="0.36em" textAnchor="middle" fill="currentColor" style={{ ...ANTON_SVG, fontSize: 46 }}>
          S
        </text>
      </svg>
    );
  // Le jeton : un disque de la couleur du texte, le S évidé (le fond se lit à travers).
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={classe}>
      <mask id={masque}>
        <rect width="100" height="100" fill="white" />
        <text x="50" y="50" dy="0.355em" textAnchor="middle" fill="black" style={{ ...ANTON_SVG, fontSize: 76 }}>
          S
        </text>
      </mask>
      <circle cx="50" cy="50" r="50" fill="currentColor" mask={`url(#${masque})`} />
    </svg>
  );
}

/** « 59 XP S » : ce que lit le lecteur d'écran ; « 35 XP S sur 40 » avec un prix. */
export const libelleXpS = (n: number, sur?: number) => `${xpSFr(n)}${sur != null ? ` sur ${nombreFr(sur)}` : ""}`;

/** La pastille et le nombre (« ▣S 59 ») ; avec `sur`, ce qui manque (« ▣S 35 / 40 »). */
export function MontantXpS({ n, sur, className, lune }: { n: number; sur?: number; className?: string; lune?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-[0.3em] whitespace-nowrap tabular-nums", className)} aria-label={libelleXpS(n, sur)} role="img">
      <PastilleS lune={lune} />
      <span aria-hidden>
        {nombreFr(n)}
        {sur != null && ` / ${nombreFr(sur)}`}
      </span>
    </span>
  );
}
