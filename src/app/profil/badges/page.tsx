"use client";

// Mes badges en grand, enfant de Ma carte (ma-carte/rubriques.tsx) : le
// prochain à viser, les trophées de fin de saison, les paliers (vitrine.tsx).
// Les notifications de badge (« Voir ») mènent ici.

import { VitrineBadges } from "@/components/sfl/vitrine";
import { PageRubrique, useMaCarte } from "@/components/sfl/ma-carte/rubriques";

export default function PageBadges() {
  const { player } = useMaCarte();
  return (
    <PageRubrique titre="Badges">
      <VitrineBadges nom={player.name} />
    </PageRubrique>
  );
}
