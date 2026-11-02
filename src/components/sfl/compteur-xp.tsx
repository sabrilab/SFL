"use client";

// Le compteur d'XP (lib/sfl/compteur-xp.ts) : la ligne « 1 630 XP · niveau 6 ·
// 470 XP avant le niveau 7 » et la barre fine du niveau, en haut du mode
// Passe (la tuile Niveau XP de Ma carte en reprend l'XP et la barre). Il
// reprend la barre de l'ancien niveau-xp.tsx, qui n'était plus monté nulle
// part (#165). Une seule ligne, sur tous les téléphones : ce qui reste à
// dépenser (Pack Afrique 2027) se lit dans l'onglet Packs et sur la tuile,
// pas ici (02/11 : la ligne passait sur deux lignes et la carte, sur un
// téléphone bas, sous les onglets).

import { ligneCompteur, partDuNiveau } from "@/lib/sfl/compteur-xp";
import type { BilanXp } from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";

export function CompteurXp({
  b,
  className,
  barre = "passe__barre",
}: {
  b: Pick<BilanXp, "total" | "niveau" | "dansLeNiveau" | "pourLeSuivant">;
  className?: string;
  /** La classe de la barre (celle du mode Passe, ou celle de la tuile). */
  barre?: string;
}) {
  return (
    <span className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="mono-label tabular-nums leading-snug">{ligneCompteur(b)}</span>
      <span className={barre} aria-hidden>
        <span style={{ width: `${partDuNiveau(b) * 100}%` }} />
      </span>
    </span>
  );
}
