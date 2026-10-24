"use client";

// Ma saison en grand, enfant de Ma carte (ma-carte/rubriques.tsx) : mon
// dernier dimanche, mes points forts, tous mes dimanches (ma-saison.tsx).

import { MaSaison } from "@/components/sfl/ma-saison";
import { PageRubrique, useMaCarte } from "@/components/sfl/ma-carte/rubriques";

export default function PageMaSaison() {
  const { saison, dimanches, fiche, rangs } = useMaCarte();
  return (
    <PageRubrique titre="Ma saison">
      <MaSaison saison={`Saison ${saison.numero ?? 0}`} dimanches={dimanches} forts={fiche.forts} rangs={rangs} />
    </PageRubrique>
  );
}
