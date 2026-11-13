// Bola Club (Sabri, 12/11/2026 : « que tu bosses Bola dans une version club
// […] un mode professionnel », bola-app#14) vit tout entier derrière ce
// drapeau, le même que les démonstrations de l'aperçu (ligue-vierge-demo.ts,
// next.config.ts : NEXT_PUBLIC_BOLA_ENV vaut « production » sur la seule
// production Vercel). Vrai en aperçu et en développement, faux en
// production, sans variable à créer : en production, /club affiche la page
// introuvable de l'app sans rien servir du club, l'entrée du menu des ligues
// n'existe pas, et rien d'autre ne lit le club (tools/club-drapeau-check.ts
// le garde).

export const BOLA_CLUB = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

/** Posé à la première visite de /club : à partir de là, le menu des ligues montre le club (sur ce téléphone). */
export const MARQUEUR_CLUB = "bola-club-demo";
/** L'état de la démo sur ce téléphone (store.ts) ; le chiffre change avec la forme des données. */
export const CLE_ETAT_CLUB = "bola-club-etat-1";
/** Le point de vue choisi (admin, entraîneur, joueur, parent). */
export const CLE_ROLE_CLUB = "bola-club-role";
