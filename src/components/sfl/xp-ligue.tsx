"use client";

// L'XP de toute la ligue, calculé une seule fois pour l'app (hooks/
// use-missions.ts) : mon Niveau XP et mon passe (Ma carte), celui d'un
// profil, et le rang de chaque joueur (B, A, S). Les cartes, elles, ne lisent
// que ce que l'XP pose dessus (CartesXpContext, use-habillage.ts) : il ne
// change qu'avec un rang, un palier ou un cran, pas avec l'horloge des
// missions, qui recalcule tout chaque minute.

import { useMemo, type ReactNode } from "react";
import { CartesXpContext, lireCartesXp } from "@/hooks/use-habillage";
import { useXpLigueCalcule, XpLigueContext } from "@/hooks/use-missions";

export function XpLigueProvider({ children }: { children: ReactNode }) {
  const xp = useXpLigueCalcule();
  const surLesCartes = xp?.surLesCartes ?? null;
  const cartes = useMemo(() => (surLesCartes === null ? null : lireCartesXp(surLesCartes)), [surLesCartes]);
  return (
    <XpLigueContext.Provider value={xp}>
      <CartesXpContext.Provider value={cartes}>{children}</CartesXpContext.Provider>
    </XpLigueContext.Provider>
  );
}
