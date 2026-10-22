// La couleur des cartes à titre (Sabri, 22/10) : « une couleur dorée pour
// les cartes MVP, rouge sur les joueurs impact, bleue sur les défensives ».
// Les cartes gagnées en saison 0 comme les suivantes : c'est la carte qui
// porte la couleur, partout où elle s'affiche (classique, carte photo,
// pastille, 3D). La carte de saison reste en noir et blanc.
//
// Une seule source pour les trois teintes : bola-card.tsx (le papier de la
// classique), carte-photo.tsx (le cadre et le voile de la carte photo) et
// carriere-joueur.tsx (les ronds de la courbe) la lisent.

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

export const TEINTES: Record<BoostType, TeinteCarte> = {
  mvp: {
    vive: "#d4a73a",
    cadre: "linear-gradient(150deg, #fff3c4 0%, #e6c062 30%, #b3862b 58%, #f2d687 82%, #9c7020 100%)",
    voile: "rgba(74,50,6,0.78)",
    onglet: { fond: "#e2b955", encre: "#241803" },
  },
  impact: {
    vive: "#e0262e",
    cadre: "linear-gradient(150deg, #ff7a7e 0%, #e3262e 32%, #a5121a 60%, #ef4a50 82%, #7d0a10 100%)",
    voile: "rgba(110,6,12,0.78)",
    onglet: { fond: "#d8212a", encre: "#fff7f6" },
  },
  def: {
    vive: "#2a6ae6",
    cadre: "linear-gradient(150deg, #8db8ff 0%, #2f6fe6 32%, #1544a8 60%, #4f8cf2 82%, #0b2a75 100%)",
    voile: "rgba(8,30,96,0.78)",
    onglet: { fond: "#2462d9", encre: "#f4f8ff" },
  },
};
