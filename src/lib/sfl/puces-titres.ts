// Les puces des titres d'un match : une puce dorée pour le MVP, une rouge
// pour le joueur Impact, une bleue pour la Défensive (Ilyes, 02/11/2026 :
// « une fois l'attribution des cartes MVP, joueur Impact et Défensive, une
// fois que c'est attribué, […] une petite puce […] sur le récap des
// matchs », la J1 à la J4 et toutes les journées à venir, « sur tous les
// visuels avec un terrain et les cartes »).
//
// Ici, rien que le calcul : quelles puces porte un joueur, pour un match
// d'une journée. Les puces se posent sur la carte par
// components/sfl/puces-titres.tsx, et se lisent par useTitresDuJour
// (hooks/use-titres-du-jour.ts), le seul point de lecture.
//
// « Une fois que c'est attribué » : on lit les lignes de la saison que
// l'écran montre (useSeason().saison, où les votes fermés sont posés,
// appliquerVotes), jamais le document brut ni la feuille en direct. Une
// journée encore au vote, ou figée jusqu'à sa révélation, n'a donc aucun
// titre sur ses lignes, et aucune puce : ce fichier n'a pas d'heure à lui.
//
// Les règles :
//   · ex æquo : chaque élu a sa ligne à vrai, donc sa puce ;
//   · plusieurs titres : plusieurs puces, toujours MVP, Impact, Défensive ;
//   · une carte venue en extra time dans un autre match n'y porte rien : ses
//     titres sont ceux de son match à lui ;
//   · les équipes du match, quand on les donne, gardent les titres à ce
//     match-là (un nom écrit deux fois un même dimanche ne les mélange pas) ;
//   · une ligne du compte vitrine ne compte jamais.

import type { BoostType } from "./engine";
import type { MatchEntry } from "./saisie/types";

/** L'ordre des puces sur une carte. */
export const ORDRE_TITRES: readonly BoostType[] = ["mvp", "impact", "def"];

/** Le nom d'une puce, pour l'accessibilité (aria-label). */
export const NOM_PUCE: Record<BoostType, string> = { mvp: "MVP", impact: "Impact", def: "Défensive" };

/** Un nom comme les feuilles l'écrivent : sans espaces autour, en minuscules. */
export const nomNormalise = (nom: string) => nom.trim().toLowerCase();

/** Les titres d'une ligne (ou de ce qui en a la forme), dans l'ordre des puces. */
export function titresDeLigne(l: { mvp?: boolean; impact?: boolean; def?: boolean }): BoostType[] {
  return ORDRE_TITRES.filter((t) => !!l[t]);
}

/** Les lignes d'une journée qui peuvent porter un titre : ni extra time, ni vitrine. */
function lignesTitrables(entries: readonly MatchEntry[], j: number, equipes?: readonly [string, string]): MatchEntry[] {
  return entries.filter(
    (e) =>
      e.j === j &&
      !e.extraTime &&
      !e.vitrine &&
      // Une journée « à plat » (sans équipes) n'a qu'un match : toutes ses lignes en sont.
      (!equipes || e.team == null || e.team === equipes[0] || e.team === equipes[1]),
  );
}

/**
 * Les puces d'un joueur pour un match de la journée `j` : celles de ses
 * titres, dans l'ordre MVP, Impact, Défensive, chacun une seule fois.
 * `equipes` : les deux équipes du match (« Noirs 1 », « Blancs 1 ») ; sans,
 * toute la journée.
 */
export function titresDuJoueur(
  entries: readonly MatchEntry[],
  j: number,
  nom: string,
  equipes?: readonly [string, string],
): BoostType[] {
  const qui = nomNormalise(nom);
  const siens = lignesTitrables(entries, j, equipes).filter((e) => nomNormalise(e.player) === qui);
  return ORDRE_TITRES.filter((t) => siens.some((e) => e[t]));
}

/**
 * Les puces de tout un terrain en une passe : nom normalisé → titres. Un
 * joueur sans titre n'y est pas.
 */
export function titresDuJour(
  entries: readonly MatchEntry[],
  j: number,
  equipes?: readonly [string, string],
): Map<string, BoostType[]> {
  const parNom = new Map<string, Set<BoostType>>();
  for (const e of lignesTitrables(entries, j, equipes)) {
    const t = titresDeLigne(e);
    if (!t.length) continue;
    const cle = nomNormalise(e.player);
    const deja = parNom.get(cle) ?? new Set<BoostType>();
    t.forEach((x) => deja.add(x));
    parNom.set(cle, deja);
  }
  return new Map([...parNom].map(([nom, s]) => [nom, ORDRE_TITRES.filter((t) => s.has(t))]));
}
