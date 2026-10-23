"use client";

// L'XP de toute la ligue, calculé une seule fois pour l'app (hooks/
// use-missions.ts) : mon Niveau XP et mon passe (Ma carte), celui d'un
// profil, et le rang de chaque joueur (B, A, S), que chaque carte lit sans
// rien recalculer.

import type { ReactNode } from "react";
import { useXpLigueCalcule, XpLigueContext } from "@/hooks/use-missions";

export function XpLigueProvider({ children }: { children: ReactNode }) {
  const xp = useXpLigueCalcule();
  return <XpLigueContext.Provider value={xp}>{children}</XpLigueContext.Provider>;
}
