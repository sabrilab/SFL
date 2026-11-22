"use client";

// La main de l'admin sur le vote d'une journée (Ilyes, 15/11/2026 : « un
// bouton fermer les votes, réouvrir les votes, clore »). Les mêmes pastilles
// sur la page de la journée et dans la feuille « Votes » : garder le vote
// ouvert, le rouvrir (jusqu'à 19 h, ou minuit passé 19 h), le fermer (avec
// confirmation, et l'heure de la révélation), et « Heure de fin » (Sabri,
// 22/11/2026 : « un bouton déterminer l'heure de fin de vote »), qui ouvre
// une fenêtre où choisir l'heure. La règle est dans revelation.ts
// (reglageDuVote, finTenue, fixerFinDuVote) : rien à montrer quand il n'y a
// rien à régler.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pastille } from "@/components/sfl/admin/journee/ui";
import type { Confirmation } from "@/components/sfl/admin/confirmer";
import { haptique } from "@/lib/sfl/haptique";
import { maintenant as heureDeLaLigue } from "@/lib/sfl/horloge";
import {
  aLHeure,
  fermerLeVote,
  finDuVote,
  finTenue,
  fixerFinDuVote,
  garderLeVoteOuvert,
  heureDeChamp,
  heureDeLaJournee,
  heureLisible,
  libelleRevelation,
  reglageDuVote,
} from "@/lib/sfl/revelation";
import { saisieStore } from "@/lib/sfl/saisie/store";
import { numeroSaison, type Saison } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

/** Ce qu'il faut pour agir : la saison de l'admin, son enregistrement, sa fenêtre de confirmation. */
export interface MainAdmin {
  saison: Saison;
  commit: (suivante: Saison, libelle?: string) => boolean;
  confirmer: (c: Confirmation) => void;
}

/** L'heure saisie (« 19:00 ») le jour de la journée ; null si elle ne se lit pas. */
function instantSaisi(saison: Saison, j: number, t: Date, saisie: string): Date | null {
  const lu = /^(\d{1,2}):(\d{2})/.exec(saisie);
  return lu ? heureDeLaJournee(saison, j, t, Number(lu[1]), Number(lu[2])) : null;
}

export function GestesVote({ j, t, main, className }: { j: number; t: Date; main: MainAdmin; className?: string }) {
  const { saison, commit, confirmer } = main;
  /** La fenêtre « Heure de fin » : l'heure en cours de saisie, null fermée. */
  const [saisie, setSaisie] = useState<string | null>(null);
  const reglage = reglageDuVote(saison, j, t);
  if (!reglage) return null;

  const ouvrirLHeure = () => {
    const maintenant = heureDeLaLigue();
    const meta = saison.journees.find((m) => m.j === j);
    const enCours = reglage.fermer && meta ? finDuVote(meta, numeroSaison(saison), maintenant) : null;
    const proposee = enCours ?? finTenue(saison, j, maintenant);
    setSaisie(proposee ? heureDeChamp(proposee) : "19:00");
  };
  const maintenant = heureDeLaLigue();
  const fin = saisie != null ? instantSaisi(saison, j, maintenant, saisie) : null;
  const apres = fin ? fixerFinDuVote(saison, j, maintenant, fin) : saison;
  const valable = apres !== saison;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {(reglage.garder || reglage.rouvrir) && (
        <Pastille
          onClick={() => {
            const instant = heureDeLaLigue();
            const avant = saisieStore.load();
            const tenue = finTenue(avant, j, instant);
            const suivante = garderLeVoteOuvert(avant, j, instant);
            if (suivante !== avant && commit(suivante, `Votes de la J${j} ouverts jusqu'à ${tenue ? heureLisible(tenue) : "minuit"}`)) haptique.sceau();
          }}
        >
          {reglage.rouvrir ? "Rouvrir les votes" : "Garder les votes ouverts"}
        </Pastille>
      )}
      {reglage.fermer && (
        <Pastille
          onClick={() => {
            const instant = heureDeLaLigue();
            confirmer({
              titre: `Fermer les votes de la J${j} ?`,
              detail: `Révélation ${aLHeure(libelleRevelation(fermerLeVote(saison, j, instant), j, instant))}.`,
              action: "Fermer",
              faire: () => {
                const avant = saisieStore.load();
                const suivante = fermerLeVote(avant, j, heureDeLaLigue());
                if (suivante !== avant && commit(suivante, `Votes de la J${j} fermés`)) haptique.sceau();
              },
            });
          }}
        >
          Fermer les votes
        </Pastille>
      )}
      <Pastille onClick={ouvrirLHeure}>Heure de fin</Pastille>

      <Dialog open={saisie != null} onOpenChange={(o) => !o && setSaisie(null)}>
        <DialogContent showCloseButton={false} className="gap-3 rounded-3xl p-5 text-center sm:max-w-xs">
          <DialogTitle className="text-titre leading-snug font-semibold">Fin des votes de la J{j}</DialogTitle>
          <Input
            type="time"
            value={saisie ?? ""}
            onChange={(e) => setSaisie(e.target.value)}
            aria-label="L'heure de fin des votes"
            className="mx-auto h-12 w-44 justify-center rounded-2xl text-center text-xl font-semibold tabular-nums"
          />
          <DialogDescription className="text-corps">
            {valable ? `Révélation ${aLHeure(libelleRevelation(apres, j, maintenant))}.` : "Une heure à venir, ce soir."}
          </DialogDescription>
          <DialogFooter className="mx-0 mb-0 grid grid-cols-2 gap-2 rounded-none border-0 bg-transparent p-0 pt-2 sm:flex-none">
            <Button variant="secondary" onClick={() => setSaisie(null)} className="rounded-full">
              Annuler
            </Button>
            <Button
              disabled={!valable}
              onClick={() => {
                const instant = heureDeLaLigue();
                const avant = saisieStore.load();
                const choisie = saisie != null ? instantSaisi(avant, j, instant, saisie) : null;
                const suivante = choisie ? fixerFinDuVote(avant, j, instant, choisie) : avant;
                setSaisie(null);
                if (choisie && suivante !== avant && commit(suivante, `Votes de la J${j} jusqu'à ${heureLisible(choisie)}`)) haptique.sceau();
              }}
              className="rounded-full"
            >
              Régler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
