// Les finitions de la carte joueur : un seul endroit pour tout ce qui
// change son allure sans changer sa disposition (Sabri, 23/10 : « plutôt
// que de faire bleu ou or comme ça, réfléchis à un meilleur design, tout en
// gardant notre même disposition », et « que le derrière des cartes suive
// aussi la même couleur que l'avant »).
//
// Deux choses s'y décident :
//   · l'édition, qui vient de la carte elle-même : la carte de saison
//     (base), ou une carte à titre, MVP, Impact ou Défensive ;
//   · l'habillage, qui vient du joueur : ce qu'il a débloqué dans la passe
//     et choisi de porter (fil « Missions », profiles.habillage). La
//     finition n'habille que la carte de saison : une carte à titre garde
//     sa matière. Signes, cran et rang vont sur toutes ses cartes.
//
// La face (bola-card.tsx), la carte photo (carte-photo.tsx) et le dos de la
// 3D (card-3d-canvas.tsx) lisent ce module : une carte est de la même
// matière des deux côtés.

/** L'édition d'une carte : la carte de saison, ou une carte à titre. */
export type EditionCarte = "base" | "mvp" | "impact" | "def";

/** Les finitions de la passe : elles habillent la carte de saison. */
export type Finition = "nuit" | "chrome" | "animee";

/** Le traitement de la photo, sans IA. */
export type Traitement = "argentique" | "gravure" | "marbre";

/** Les signes distinctifs, à poser en plus. */
export type Signe = "lisere-argent" | "lisere-or" | "sceau" | "puce-or" | "nom-grave";

/** Le rang du joueur selon son XP, aux couleurs des rangs de mission. */
export type RangCarte = "B" | "A" | "S";

/**
 * Ce que le joueur porte sur sa carte, tout facultatif. Le fil « Missions »
 * dit ce qu'il a débloqué et choisi (useHabillage) ; l'écran de la passe en
 * passe un autre à PlayerCard pour l'essayer.
 */
export interface HabillageCarte {
  finition?: Finition;
  traitement?: Traitement;
  signes?: Signe[];
  /** Le cadre, construit coin par coin : de 0 (rien) à 4 (complet). */
  cran?: 0 | 1 | 2 | 3 | 4;
  rang?: RangCarte;
}
