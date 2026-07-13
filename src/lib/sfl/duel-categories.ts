import type { StatKey } from "./engine";

// Types de duel — chacun cible une section de la carte plutôt que le
// joueur dans son ensemble, pour une collecte de données plus précise.
// Le résultat alimente toujours le même Elo global (aucune division,
// aucun coefficient différent d'une catégorie à l'autre).

export type DuelCategoryId = "vitesse" | "tir" | "passe" | "dribble" | "defense-physique";

export interface DuelCategory {
  id: DuelCategoryId;
  label: string;
  question: string;
  statKeys: StatKey[];
}

export const DUEL_CATEGORIES: DuelCategory[] = [
  { id: "vitesse", label: "Vitesse", question: "Qui est le plus rapide ?", statKeys: ["VIT"] },
  { id: "tir", label: "Tir", question: "Qui a la meilleure frappe ?", statKeys: ["TIR"] },
  { id: "passe", label: "Passe", question: "Qui distribue le mieux ?", statKeys: ["PAS"] },
  { id: "dribble", label: "Dribble", question: "Qui dribble le mieux ?", statKeys: ["DRI"] },
  {
    id: "defense-physique",
    label: "Défense & Physique",
    question: "Qui est le plus solide ?",
    statKeys: ["DEF", "PHY"],
  },
];

export function pickCategory(avoid?: DuelCategoryId): DuelCategory {
  const pool = avoid ? DUEL_CATEGORIES.filter((c) => c.id !== avoid) : DUEL_CATEGORIES;
  return pool[Math.floor(Math.random() * pool.length)];
}
