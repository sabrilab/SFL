// MVP automatique — le titre ne se vote plus, il se lit sur la feuille de match.
//
// Règle (demande de Sabri, 15/10) : dans un match Bola, le MVP est choisi par
// l'app d'après les statistiques des joueurs du match. Le ou les meilleurs
// prennent la carte MVP ; à égalité, ils l'ont tous. Pas de vote des joueurs.
// Le vote (meilleur joueur, meilleur défenseur, MVP) reste pour le mode Team.
// Ce module ne sert qu'aux journées de la SFL : les matchs Bola ouverts par
// les joueurs ont leur propre règle (le plus de passes départage, Sabri 28/10),
// dans lib/sfl/ligue-vierge.ts (mvpsDuMatch).
//
// La note de match reprend le barème Pépite, sans ce qui ne dit rien du jeu
// (présence, retard, bonus manuel) ni les titres eux-mêmes (MVP, Impact,
// Défensive) — sinon un titre voté se réélirait tout seul :
//   but 1 · passe décisive 1 · clean sheet 3 · 2 arrêts 1 · 2 interceptions 1
//   victoire 2 (3 en SFL Time) · nul 1
//
// Elle ne s'applique qu'aux journées marquées `mvpAuto` : toutes celles créées
// depuis ce changement. Les journées déjà jouées gardent leurs MVP, et donc
// les classements de la saison ne bougent pas d'un point.
//
// Un « match », c'est ce que le moteur affiche : les équipes de la journée
// prises deux à deux dans leur ordre d'apparition (Terrain 1, Terrain 2…).
// Une journée sans équipes est un seul match.

import type { MatchEntry, Saison } from "./types";
import { isPlaceExtraTime } from "../hidden";

export function noteDeMatch(e: MatchEntry): number {
  // Une place « X1 », « X2 »… complète une équipe : ce n'est pas un joueur,
  // elle ne prend jamais le MVP (27/10 : elle l'aurait pris dans la grille et
  // la notification des résultats, alors que l'app la masque partout).
  if (e.statut !== "Présent" || e.extraTime || isPlaceExtraTime(e.player)) return 0;
  let n = e.buts + e.passes;
  if (e.cleanSheet) n += 3;
  n += Math.floor((e.arrets ?? 0) / 2) + Math.floor((e.interceptions ?? 0) / 2);
  if (e.result === "Victoire") n += e.sflTime ? 3 : 2;
  else if (e.result === "Nul") n += 1;
  return n;
}

/**
 * Les matchs d'une journée, en indices de lignes : les équipes deux à deux,
 * comme `computeJournees`. Les lignes sans équipe forment un seul groupe.
 */
export function matchsDeLaJournee(entries: MatchEntry[], indices: number[]): number[][] {
  const order: string[] = [];
  const parEquipe = new Map<string, number[]>();
  const sansEquipe: number[] = [];
  for (const i of indices) {
    const t = entries[i].team;
    if (!t) {
      sansEquipe.push(i);
      continue;
    }
    if (!parEquipe.has(t)) {
      parEquipe.set(t, []);
      order.push(t);
    }
    parEquipe.get(t)!.push(i);
  }
  const matchs: number[][] = [];
  for (let k = 0; k < order.length; k += 2) {
    matchs.push([...parEquipe.get(order[k])!, ...(parEquipe.get(order[k + 1]) ?? [])]);
  }
  if (sansEquipe.length) matchs.push(sansEquipe);
  return matchs;
}

/** Les MVP d'un match : la meilleure note, tous ex æquo compris ; personne si tout est à zéro. */
export function mvpsDuMatch(entries: MatchEntry[]): string[] {
  const notes = entries.map((e) => [e.player, noteDeMatch(e)] as const);
  const max = Math.max(0, ...notes.map(([, n]) => n));
  if (max <= 0) return [];
  return notes.filter(([, n]) => n === max).map(([p]) => p);
}

/**
 * Pose les MVP des journées automatiques sur leurs lignes. Renvoie la même
 * saison (même référence) si rien ne change, pour ne pas réveiller la synchro.
 */
export function appliquerMvpAuto(saison: Saison): Saison {
  const auto = new Set(saison.journees.filter((m) => m.mvpAuto).map((m) => m.j));
  if (auto.size === 0) return saison;

  const parJ = new Map<number, number[]>();
  saison.entries.forEach((e, i) => {
    if (!auto.has(e.j)) return;
    const l = parJ.get(e.j) ?? [];
    l.push(i);
    parJ.set(e.j, l);
  });

  const mvp = new Set<number>();
  for (const indices of parJ.values()) {
    for (const match of matchsDeLaJournee(saison.entries, indices)) {
      const lignes = match.map((i) => saison.entries[i]);
      const elus = new Set(mvpsDuMatch(lignes));
      for (const i of match) if (elus.has(saison.entries[i].player)) mvp.add(i);
    }
  }

  let change = false;
  const entries = saison.entries.map((e, i) => {
    if (!auto.has(e.j)) return e;
    const doit = mvp.has(i);
    if (e.mvp === doit) return e;
    change = true;
    return { ...e, mvp: doit };
  });
  return change ? { ...saison, entries } : saison;
}

/** Une journée dont le MVP est choisi par l'app (aucun vote MVP pour elle). */
export function mvpAutomatique(saison: Pick<Saison, "journees">, j: number): boolean {
  return !!saison.journees.find((m) => m.j === j)?.mvpAuto;
}
