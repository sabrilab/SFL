// Le compteur d'XP (Ilyes, 01/11/2026 : « Je gagne de l'XP mais il n'y a
// aucun compteur : je vois que je suis niveau 6, mais pas le nombre d'XP que
// j'ai gagné. C'est ça que j'ai envie de voir. »). Une ligne, la même dans la
// tuile Niveau XP de Ma carte et en haut du mode Passe :
//   « 1 630 XP · niveau 6 · 470 XP avant le niveau 7 »
// Un niveau n commence à 50·n·(n−1) XP (missions.ts, debutNiveau) : à
// 1 840 XP, le niveau 7 (2 100 XP) est à 260 XP.
//
// Pur : ni React ni réseau.

import type { BilanXp } from "./missions";

/** Un nombre à la française : 1 630 (l'espace fine insécable de fr-FR). */
export const nombreFr = (n: number) => Math.round(n).toLocaleString("fr-FR");

/** « 1 630 XP », l'espace avant XP insécable. */
export const xpFr = (n: number) => `${nombreFr(n)} XP`;

/** « 59 XP S » (lib/sfl/xp-s.ts) : ce que lit le lecteur d'écran derrière la pastille. */
export const xpSFr = (n: number) => `${nombreFr(n)} XP S`;

type Compte = Pick<BilanXp, "total" | "niveau" | "dansLeNiveau" | "pourLeSuivant">;

/** Ce qui reste avant le niveau suivant. */
export const resteAvantNiveau = (b: Compte) => Math.max(0, b.pourLeSuivant - b.dansLeNiveau);

/**
 * La ligne du compteur, en deux temps : l'XP gagnée (ce qu'on vient lire
 * d'un coup d'œil, l'écran la met en avant), puis le niveau et ce qui reste.
 */
export function partiesCompteur(b: Compte): { xp: string; suite: string } {
  return { xp: xpFr(b.total), suite: ` · niveau ${b.niveau} · ${xpFr(resteAvantNiveau(b))} avant le niveau ${b.niveau + 1}` };
}

/** La ligne du compteur. */
export function ligneCompteur(b: Compte): string {
  const { xp, suite } = partiesCompteur(b);
  return xp + suite;
}

/** La part du niveau déjà faite, de 0 à 1. */
export const partDuNiveau = (b: Compte) => Math.min(1, Math.max(0, b.dansLeNiveau / Math.max(1, b.pourLeSuivant)));
