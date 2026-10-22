"use client";

// Team — les matchs d'équipe (Sabri, 22/10 : « League », « Bola » et « Team »
// en tête des Actus). Le mode Team des règles officielles (ilyesbensal/BOLA,
// docs/gameplay/04-mode-team.md) : une équipe fixe de 5 à 7 joueurs, des
// défis lancés à une autre équipe, 3 points la victoire, 1 le nul. Pas encore
// construit : l'onglet est posé, le classement des équipes attend ses
// premières équipes.

import { ChoixLigue } from "@/components/sfl/choix-ligue";

export default function BolaTeamPage() {
  return (
    <div className="mx-auto flex w-full max-w-[470px] flex-col gap-6 px-5 pt-2 pb-8 sm:pt-6">
      <h1 className="sr-only">Team</h1>
      <ChoixLigue actif="/bola-team" />
      <div className="glass-soft rounded-3xl px-6 py-10 text-center text-sm text-foreground/45">Aucune équipe pour l&apos;instant.</div>
    </div>
  );
}
