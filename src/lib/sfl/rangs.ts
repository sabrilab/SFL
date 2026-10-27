// Le rang d'un joueur dans un classement de la ligue — une seule règle pour
// tout l'app (Ma carte, les profils, les Actus, les badges, les récaps).
//
// Pourquoi ce fichier (27/10, Ilyes : « 7e au Pépite d'Or dans Ma carte, 6e
// au classement ») : chaque écran recomptait son rang à sa façon. Les uns
// lisaient la saison brute (sans les Impact et Défensive élus par vote), les
// autres comptaient les joueurs masqués (Sabri, les arbitres, les places X),
// la courbe de Ma carte avait sa propre formule de points (sans le +1 de
// l'extra time), et la feuille posée d'un dimanche pas encore joué donnait
// déjà son point de présence ici et pas là. Le même joueur avait deux places.
//
// La règle, celle du classement Pépite d'Or :
//   · la saison lue est celle des votes appliqués (useSeason().saison, et
//     côté serveur saisonServeur) ;
//   · seules les journées jouées comptent (saisonJouee, comme le découpage
//     des divisions) ;
//   · les points sont ceux du moteur (computeStandings → entryPP) ;
//   · la population : les joueurs publics qui ont joué au moins un match —
//     ceux du découpage (divisions.ts) — plus le joueur regardé, même masqué
//     (Sabri se voit lui-même) ;
//   · les ex æquo partagent leur place : 1 + le nombre de joueurs strictement
//     devant (rankPlayers, rankByMetric).
//
// En saison à divisions, le classement Pépite d'Or affiche la place DANS la
// division (rangDansDivision). Pour un joueur de la D1, c'est la même que le
// rang général ; plus bas, Ma carte montre le rang général (décision ouverte
// de Sabri, mémoire divisions-ligue).

import type { Player } from "./engine";
import { isHidden } from "./hidden";
import { computeStandings, saisonJouee } from "./saisie/engine";
import type { Evolution } from "./saisie/evolution";
import type { Saison } from "./saisie/types";

/** La population classée : publics ayant joué au moins un match, plus `moi`. */
export function classables<T extends { name: string; matchs: number }>(players: readonly T[], moi?: string | null): T[] {
  return players.filter((p) => p.name === moi || (p.matchs > 0 && !isHidden(p.name)));
}

export const pepite = (p: Player) => p.pp;

/**
 * Le rang de `nom` (1 + strictement devant) sur `valeur`, et la taille de la
 * population ; null s'il n'est pas dans la liste. `aZero` : rendre aussi un
 * rang quand sa valeur est nulle (le Pépite d'Or le fait, pas les buteurs).
 */
export function rangDans(
  players: readonly Player[],
  nom: string,
  valeur: (p: Player) => number = pepite,
  aZero = true
): { rang: number; sur: number; valeur: number } | null {
  const liste = classables(players, nom);
  const moi = liste.find((p) => p.name === nom);
  if (!moi) return null;
  const v = valeur(moi);
  if (!aZero && v <= 0) return null;
  return { rang: 1 + liste.filter((p) => valeur(p) > v).length, sur: liste.length, valeur: v };
}

/**
 * Le classement tel qu'il était après la journée `jusqua` (toutes si absent) :
 * les lignes des journées jouées jusque-là. `evolution` n'apporte que les
 * cartes (les points n'en dépendent pas) : la passer évite de la recalculer.
 */
export function standingsJusqua(saison: Saison, jusqua?: number | null, evolution?: Evolution): Player[] {
  const jouee = saisonJouee(saison);
  const entries = jusqua == null ? jouee.entries : jouee.entries.filter((e) => e.j <= jusqua);
  const s = entries === saison.entries ? saison : { ...saison, entries };
  return evolution ? computeStandings(s, evolution) : computeStandings(s);
}

/** Son rang au Pépite d'Or après la journée `jusqua`. */
export function rangPepiteApres(saison: Saison, nom: string, jusqua: number, evolution?: Evolution): number | null {
  return rangDans(standingsJusqua(saison, jusqua, evolution), nom)?.rang ?? null;
}
