"use client";

// Le compteur d'XP (lib/sfl/compteur-xp.ts) : la ligne « 1 630 XP · niveau 6 ·
// 470 XP avant le niveau 7 » et la barre fine du niveau, en haut du mode
// Passe (la tuile Niveau XP de Ma carte en reprend l'XP et la barre). Il
// reprend la barre de l'ancien niveau-xp.tsx, qui n'était plus monté nulle
// part (#165). Une seule ligne, sur tous les téléphones (02/11 : la ligne
// passait sur deux lignes et la carte, sur un téléphone bas, sous les
// onglets). Les XP S (lib/sfl/xp-s.ts) n'y sont plus : posées au bout de la
// barre, leur pastille se lisait comme son curseur et le nombre comme sa
// cible (contrôle visuel du 02/11) ; elles ont leur bouton dans l'en-tête du
// Passe (mode-passe.tsx).

import { partiesCompteur, partDuNiveau } from "@/lib/sfl/compteur-xp";
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
  const { xp, suite } = partiesCompteur(b);
  return (
    <span className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {/* L'XP gagnée en blanc plein : c'est elle qu'on vient lire (Ilyes, 01/11). */}
      <span className="mono-label tabular-nums leading-snug">
        <span className="text-white">{xp}</span>
        {suite}
      </span>
      <span className={barre} aria-hidden>
        <span style={{ width: `${partDuNiveau(b) * 100}%` }} />
      </span>
    </span>
  );
}
