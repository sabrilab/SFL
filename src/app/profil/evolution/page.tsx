"use client";

// Mon évolution en grand, enfant de Ma carte (ma-carte/rubriques.tsx) : mon
// rang au Pépite d'Or ou la note de ma carte, journée après journée
// (carriere-joueur.tsx).

import { CourbeCarriere } from "@/components/sfl/carriere-joueur";
import { PageRubrique, useMaCarte } from "@/components/sfl/ma-carte/rubriques";

export default function PageEvolution() {
  const { courbe, joues } = useMaCarte();
  return (
    <PageRubrique titre="Évolution">
      <CourbeCarriere points={courbe} depart={joues > 0 ? "rang" : "note"} />
    </PageRubrique>
  );
}
