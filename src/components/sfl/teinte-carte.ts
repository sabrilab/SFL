// La couleur des cartes à titre (Sabri, 22/10) : « une couleur dorée pour
// les cartes MVP, rouge sur les joueurs impact, bleue sur les défensives ».
// Les cartes gagnées en saison 0 comme les suivantes : c'est la carte qui
// porte la couleur, partout où elle s'affiche (classique, carte photo,
// pastille, 3D).
//
// Depuis le 23/10, la couleur fait partie de la matière de la carte
// (finitions-carte.ts, MATIERES : l'or et ses rayons, le rouge et ses ondes,
// le cobalt et ses alvéoles). Ce fichier n'en garde que ce que lisent les
// écrans hors de la carte : carriere-joueur.tsx et ma-saison.tsx (les ronds
// des courbes, dans la couleur franche).

import { MATIERES } from "@/components/sfl/finitions-carte";
import type { BoostType } from "@/lib/sfl/engine";

export interface TeinteCarte {
  /** La couleur franche (ronds, filets). */
  vive: string;
  /** Le métal du cadre : un dégradé qui accroche la lumière. */
  cadre: string;
  /** Le voile du bas de la carte photo, dans la couleur. */
  voile: string;
  /** L'onglet de la note en pastille. */
  onglet: { fond: string; encre: string };
}

const teinte = (t: BoostType): TeinteCarte => {
  const { vive, cadre, voile, onglet } = MATIERES[t];
  return { vive, cadre, voile, onglet };
};

export const TEINTES: Record<BoostType, TeinteCarte> = {
  mvp: teinte("mvp"),
  impact: teinte("impact"),
  def: teinte("def"),
};
