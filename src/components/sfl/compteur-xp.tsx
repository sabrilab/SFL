"use client";

// Le compteur d'XP (lib/sfl/compteur-xp.ts) : la ligne « 1 630 XP · niveau 6 ·
// 470 XP avant le niveau 7 » et la barre fine du niveau, en haut du mode
// Passe (la tuile Niveau XP de Ma carte en reprend l'XP et la barre). Il
// reprend la barre de l'ancien niveau-xp.tsx, qui n'était plus monté nulle
// part (#165). Une seule ligne, sur tous les téléphones (02/11 : la ligne
// passait sur deux lignes et la carte, sur un téléphone bas, sous les
// onglets). Les XP S qui restent à dépenser (lib/sfl/xp-s.ts, « ▣S 59 »)
// se posent au bout de la barre, pas dans la ligne : elle ne se casse pas ;
// un toucher ouvre les Packs quand il y en a.

import { partiesCompteur, partDuNiveau } from "@/lib/sfl/compteur-xp";
import type { BilanXp } from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";
import { libelleXpS, MontantXpS } from "@/components/sfl/xp-s";

export function CompteurXp({
  b,
  className,
  barre = "passe__barre",
  xpS,
  onXpS,
}: {
  b: Pick<BilanXp, "total" | "niveau" | "dansLeNiveau" | "pourLeSuivant">;
  className?: string;
  /** La classe de la barre (celle du mode Passe, ou celle de la tuile). */
  barre?: string;
  /** Les XP S qui restent à dépenser ; null ou absent : rien au bout de la barre. */
  xpS?: number | null;
  /** Un toucher sur les XP S (les Packs). */
  onXpS?: () => void;
}) {
  const { xp, suite } = partiesCompteur(b);
  const jauge = (
    <span className={cn(barre, xpS != null && "min-w-0 flex-1")} aria-hidden>
      <span style={{ width: `${partDuNiveau(b) * 100}%` }} />
    </span>
  );
  return (
    <span className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {/* L'XP gagnée en blanc plein : c'est elle qu'on vient lire (Ilyes, 01/11). */}
      <span className="mono-label tabular-nums leading-snug">
        <span className="text-white">{xp}</span>
        {suite}
      </span>
      {xpS == null ? (
        jauge
      ) : (
        <span className="flex items-center gap-2.5">
          {jauge}
          {onXpS ? (
            <button type="button" onClick={onXpS} className="mono-label -my-2 py-2 text-white" aria-label={`Packs, ${libelleXpS(xpS)}`}>
              <MontantXpS n={xpS} />
            </button>
          ) : (
            <MontantXpS n={xpS} className="mono-label text-white" />
          )}
        </span>
      )}
    </span>
  );
}
