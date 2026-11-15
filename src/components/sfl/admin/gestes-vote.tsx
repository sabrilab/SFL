"use client";

// La main de l'admin sur le vote d'une journée (Ilyes, 15/11/2026 : « un
// bouton fermer les votes, réouvrir les votes, clore »). Les mêmes pastilles
// sur la page de la journée et dans la feuille « Votes » : garder le vote
// ouvert jusqu'à minuit, le rouvrir, le fermer (avec confirmation, et l'heure
// de la révélation). La règle est dans revelation.ts (reglageDuVote) : rien à
// montrer quand il n'y a rien à régler.

import { Pastille } from "@/components/sfl/admin/journee/ui";
import type { Confirmation } from "@/components/sfl/admin/confirmer";
import { haptique } from "@/lib/sfl/haptique";
import { maintenant as heureDeLaLigue } from "@/lib/sfl/horloge";
import { aLHeure, fermerLeVote, garderLeVoteOuvert, libelleRevelation, reglageDuVote } from "@/lib/sfl/revelation";
import { saisieStore } from "@/lib/sfl/saisie/store";
import type { Saison } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

/** Ce qu'il faut pour agir : la saison de l'admin, son enregistrement, sa fenêtre de confirmation. */
export interface MainAdmin {
  saison: Saison;
  commit: (suivante: Saison, libelle?: string) => boolean;
  confirmer: (c: Confirmation) => void;
}

export function GestesVote({ j, t, main, className }: { j: number; t: Date; main: MainAdmin; className?: string }) {
  const { saison, commit, confirmer } = main;
  const reglage = reglageDuVote(saison, j, t);
  if (!reglage) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {(reglage.garder || reglage.rouvrir) && (
        <Pastille
          onClick={() => {
            const avant = saisieStore.load();
            const apres = garderLeVoteOuvert(avant, j, heureDeLaLigue());
            if (apres !== avant && commit(apres, `Votes de la J${j} ouverts jusqu'à minuit`)) haptique.sceau();
          }}
        >
          {reglage.rouvrir ? "Rouvrir les votes" : "Garder les votes ouverts"}
        </Pastille>
      )}
      {reglage.fermer && (
        <Pastille
          onClick={() => {
            const maintenant = heureDeLaLigue();
            confirmer({
              titre: `Fermer les votes de la J${j} ?`,
              detail: `Révélation ${aLHeure(libelleRevelation(fermerLeVote(saison, j, maintenant), j, maintenant))}.`,
              action: "Fermer",
              faire: () => {
                const avant = saisieStore.load();
                const apres = fermerLeVote(avant, j, heureDeLaLigue());
                if (apres !== avant && commit(apres, `Votes de la J${j} fermés`)) haptique.sceau();
              },
            });
          }}
        >
          Fermer les votes
        </Pastille>
      )}
    </div>
  );
}
