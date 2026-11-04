"use client";

// Ma carte d'entraîneur en grand, enfant de Ma carte (ma-carte/rubriques.tsx,
// la tuile « Entraîneur ») : la carte, ses trois et leurs jauges, ses matchs
// dirigés, son journal en mots (fiche-entraineur.tsx). Sa carte de joueur
// reste en tête de Ma carte.

import { FicheEntraineur } from "@/components/sfl/fiche-entraineur";
import { PageRubrique } from "@/components/sfl/ma-carte/rubriques";
import { useMyPlayer } from "@/components/sfl/player-provider";

export default function PageEntraineur() {
  const { player } = useMyPlayer();
  return (
    <PageRubrique titre="Entraîneur">
      <FicheEntraineur nom={player.name} />
    </PageRubrique>
  );
}
