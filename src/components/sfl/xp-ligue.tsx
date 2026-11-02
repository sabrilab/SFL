"use client";

// L'XP de toute la ligue, calculé une seule fois pour l'app (hooks/
// use-missions.ts) : mon Niveau XP et mon passe (Ma carte), celui d'un
// profil, et le rang de chaque joueur (B, A, S). Les cartes, elles, ne lisent
// que ce que l'XP pose dessus (CartesXpContext, use-habillage.ts) : il ne
// change qu'avec un rang, un palier ou un cran, pas avec l'horloge des
// missions, qui recalcule tout chaque minute.

//
// Depuis le 01/11 (Ilyes : des paliers ouverts au téléphone, fermés à
// l'ordinateur), le palier de chacun est pris au plus haut avec celui que le
// serveur a gardé (passe_acquis, /api/xp/bilan ; lib/sfl/xp-acquis.ts).

import { useMemo, type ReactNode } from "react";
import { useAchatsLigue, useSuiviAchatsXp } from "@/hooks/use-achats-xp";
import { useSuiviBilanServeur, usePaliersGardes } from "@/hooks/use-bilan-serveur";
import { CartesXpContext, empreinte, lireCartesXp } from "@/hooks/use-habillage";
import { useXpLigueCalcule, XpLigueContext } from "@/hooks/use-missions";
import { nationsMontrees } from "@/lib/sfl/pack-afrique";
import { paliersAuPlusHaut } from "@/lib/sfl/xp-acquis";

export function XpLigueProvider({ children }: { children: ReactNode }) {
  const xp = useXpLigueCalcule();
  useSuiviBilanServeur();
  useSuiviAchatsXp();
  const gardes = usePaliersGardes();
  const achats = useAchatsLigue();
  const vitrine = xp?.vitrine ?? null;
  const surLesCartes = xp?.surLesCartes ?? null;
  const cartes = useMemo(() => {
    if (surLesCartes === null) return null;
    const c = lireCartesXp(surLesCartes);
    // Le compte vitrine voit le PACK AFRIQUE 2027 plein, sur son seul téléphone (un aperçu, jamais écrit).
    const nations: Record<string, readonly (readonly [string, number])[]> = vitrine
      ? { ...achats, [vitrine]: nationsMontrees().map((n) => [n, 0] as const) }
      : achats;
    if (!Object.keys(gardes).length && !Object.keys(nations).length) return c;
    const parJoueur = new Map(c.parJoueur);
    for (const nom of new Set([...Object.keys(gardes), ...Object.keys(nations)])) {
      const x = parJoueur.get(nom);
      if (x) parJoueur.set(nom, { ...x, paliers: paliersAuPlusHaut(x.paliers, gardes[nom]), afrique: nations[nom] });
    }
    return { parJoueur, revision: `${c.revision}.${empreinte(JSON.stringify([gardes, nations]))}` };
  }, [surLesCartes, gardes, achats, vitrine]);
  return (
    <XpLigueContext.Provider value={xp}>
      <CartesXpContext.Provider value={cartes}>{children}</CartesXpContext.Provider>
    </XpLigueContext.Provider>
  );
}
