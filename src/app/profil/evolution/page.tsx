"use client";

// Mon évolution en grand, enfant de Ma carte (ma-carte/rubriques.tsx) : ma
// note qui évolue, ses jauges et mes dimanches (ma-carte/ma-note.tsx, Sabri
// 26/10), puis mon rang au Pépite d'Or ou la note de ma carte, journée après
// journée (carriere-joueur.tsx).

import { CourbeCarriere } from "@/components/sfl/carriere-joueur";
import { MaNote } from "@/components/sfl/ma-carte/ma-note";
import { PageRubrique, useMaCarte } from "@/components/sfl/ma-carte/rubriques";

export default function PageEvolution() {
  const { courbe, joues } = useMaCarte();
  return (
    <PageRubrique titre="Évolution">
      <MaNote />
      <CourbeCarriere points={courbe} depart={joues > 0 ? "rang" : "note"} />
    </PageRubrique>
  );
}
