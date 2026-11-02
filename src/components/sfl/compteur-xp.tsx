"use client";

// Le compteur d'XP (lib/sfl/compteur-xp.ts) : la ligne « 1 630 XP · niveau 6 ·
// 470 XP avant le niveau 7 » et la barre fine du niveau, sous la tuile Niveau
// XP de Ma carte et en haut du mode Passe. Il reprend la barre de l'ancien
// niveau-xp.tsx, qui n'était plus monté nulle part (#165). Le solde à
// dépenser du Pack Afrique 2027 s'y ajoute, s'il diffère du total.

import { ligneCompteur, nombreFr, partDuNiveau } from "@/lib/sfl/compteur-xp";
import type { BilanXp } from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";

export function CompteurXp({
  b,
  solde,
  onSolde,
  className,
  barre = "passe__barre",
}: {
  b: Pick<BilanXp, "total" | "niveau" | "dansLeNiveau" | "pourLeSuivant">;
  /** L'XP qui reste à dépenser (Pack Afrique 2027), montrée seulement si elle diffère du total. */
  solde?: number | null;
  /** Toucher le solde : l'onglet Packs du mode Passe. */
  onSolde?: () => void;
  className?: string;
  /** La classe de la barre (celle du mode Passe, ou celle de la tuile). */
  barre?: string;
}) {
  const montrerSolde = solde != null && solde !== b.total;
  return (
    <span className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="mono-label tabular-nums leading-snug">
        {ligneCompteur(b)}
        {montrerSolde &&
          (onSolde ? (
            <>
              {" · "}
              <button type="button" onClick={onSolde} className="underline decoration-1 underline-offset-2">
                {nombreFr(solde)} à dépenser
              </button>
            </>
          ) : (
            <span> · {nombreFr(solde)} à dépenser</span>
          ))}
      </span>
      <span className={barre} aria-hidden>
        <span style={{ width: `${partDuNiveau(b) * 100}%` }} />
      </span>
    </span>
  );
}
