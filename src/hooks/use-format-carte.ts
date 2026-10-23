"use client";

import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useGrandEcran } from "@/hooks/use-media-query";

/**
 * Les trois formats de carte (FORMAT_CARTE, mini-carte.tsx), à la taille de
 * l'écran. Sur grand écran (dès 1024 px, le palier de .shell et de
 * .grille-or), chacun grandit de √φ, comme les terrains (.terrain-grand,
 * globals.css) : d'un format au suivant, le rapport reste φ, et la
 * hiérarchie grande / moyenne / petite ne bouge pas. Sur téléphone et
 * tablette, FORMAT_CARTE tel quel.
 */
export const RACINE_PHI = Math.sqrt((1 + Math.sqrt(5)) / 2);

export type FormatsCarte = { readonly grande: number; readonly moyenne: number; readonly petite: number };

// Calculé au premier besoin, pas au chargement du module : mini-carte est
// dans un cycle d'imports (card-viewer → suivre → mini-carte).
let grands: FormatsCarte | null = null;

export function useFormatCarte(): FormatsCarte {
  const grand = useGrandEcran();
  if (!grand) return FORMAT_CARTE;
  grands ??= {
    grande: FORMAT_CARTE.grande * RACINE_PHI,
    moyenne: FORMAT_CARTE.moyenne * RACINE_PHI,
    petite: FORMAT_CARTE.petite * RACINE_PHI,
  };
  return grands;
}
