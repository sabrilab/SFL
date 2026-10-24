"use client";

// Tous les contrats en jeu du dimanche : face-à-face, rangs S, A et B, défi
// et ligue. Les Actus n'en montrent que les rangs S, en aperçu (Sabri,
// 24/10) ; leur « Tout voir » mène ici. Le bloc : actus/contrats-en-jeu.tsx.

import { BoutonRetour } from "@/components/layout/bouton-retour";
import { ContratsEnJeu } from "@/components/sfl/actus/contrats-en-jeu";

export default function ContratsPage() {
  return (
    <div className="actus-gabarit flex flex-col gap-4 pt-4 pb-8 md:gap-[var(--fib-21)] lg:pt-[var(--fib-34)]">
      <div className="px-5 md:px-0">
        <BoutonRetour />
      </div>
      <ContratsEnJeu />
    </div>
  );
}
