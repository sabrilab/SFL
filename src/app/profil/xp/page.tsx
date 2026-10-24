"use client";

// Mon Niveau XP, enfant de Ma carte (ma-carte/rubriques.tsx) : le mode Passe,
// en plein écran, hors de l'app (mode-passe.tsx).

import { ModePasse } from "@/components/sfl/mode-passe";
import { useMaCarte } from "@/components/sfl/ma-carte/rubriques";

export default function PageNiveauXp() {
  const { player, saison } = useMaCarte();
  return <ModePasse saison={saison.numero ?? 0} player={player} />;
}
