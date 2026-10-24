"use client";

// Mon Niveau XP en grand, enfant de Ma carte (ma-carte/rubriques.tsx) : le
// niveau à vie, le Passe Bola de la saison, les encadrés et le journal
// (niveau-xp.tsx).

import { NiveauXp } from "@/components/sfl/niveau-xp";
import { PageRubrique, useMaCarte } from "@/components/sfl/ma-carte/rubriques";

export default function PageNiveauXp() {
  const { player, saison } = useMaCarte();
  return (
    <PageRubrique titre="Niveau XP">
      <NiveauXp saison={saison.numero ?? 0} player={player} />
    </PageRubrique>
  );
}
