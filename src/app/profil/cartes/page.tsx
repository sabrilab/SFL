"use client";

// Mes cartes en grand, enfant de Ma carte (ma-carte/rubriques.tsx) : la carte
// de chaque saison et les cartes spéciales gagnées (carriere-joueur.tsx).

import { CartesCarriere } from "@/components/sfl/carriere-joueur";
import { PageRubrique, useMaCarte } from "@/components/sfl/ma-carte/rubriques";

export default function PageMesCartes() {
  const { mesCartes } = useMaCarte();
  return (
    <PageRubrique titre="Mes cartes">
      <CartesCarriere saisons={mesCartes} titre="Mes cartes" />
    </PageRubrique>
  );
}
