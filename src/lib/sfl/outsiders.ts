// L'outsider de l'arc 1. Sabri, 23/10 : « si on a un gars qui est rang B
// […] et qui se retrouve en division 1, lui va faire l'objet d'une quête.
// C'est-à-dire que c'est comme un personnage qui est un peu sous-estimé, mais
// qui fait partie d'une grosse histoire dans l'arc 1. Donc lui, il ne faut pas
// oublier de le gonfler dans l'actu […] à la limite qu'il y ait une journée
// qui tourne autour de sa gueule ».
//
// L'arc 1, c'est la saison des divisions (divisions.ts) : la J3 jouée, la
// ligue est coupée, et un joueur de rang B (l'XP à vie, rangsDesJoueurs dans
// missions.ts) qui joue en D1 est un outsider. Sa quête : gagner son rang A
// sans quitter la D1. Elle s'accomplit le dimanche où il passe rang A en
// restant en D1 ; elle s'arrête s'il retombe en D2.
//
// Chaque dimanche a son outsider, celui dont c'est la journée : le mieux
// placé des rangs B de la D1 au Pépite d'Or (à égalité, le plus loin en XP,
// le plus sous-estimé). Il est choisi sur l'état d'avant le dimanche, si bien
// qu'il ne change pas pendant que la feuille se remplit ; ce que le dimanche
// fait de lui (ses points, sa division, son rang) se lit ensuite, en direct
// puis définitif. Le dimanche d'après, un autre peut prendre sa place.
//
// Rien n'est stocké : comme les divisions, tout se relit dans les feuilles et
// dans le journal de l'XP (chaque ligne porte sa saison et sa journée).

import { rankPlayers, type Player } from "./engine";
import { apresLaJournee, etatDivisions, REGLES_DIVISIONS, type EtatDivisions } from "./divisions";
import { isHidden } from "./hidden";
import { classementNiveau, rangsDesJoueurs, type LigneXp, type RangJoueur } from "./missions";
import { computeStandings, entryPP } from "./saisie/engine";
import { journeeJouee } from "./saisie/mutations";
import { numeroSaison, type Saison } from "./saisie/types";

type Journal = Map<string, { lignes: LigneXp[]; reussies: number }>;

export interface Outsider {
  nom: string;
  /** Sa place dans la D1 au Pépite d'Or de la saison (ex æquo à la même place), et combien ils sont en D1. */
  placeD1: number;
  surD1: number;
  /** Sa place à l'XP à vie, sur combien de joueurs qui en ont. */
  placeXp: number;
  surXp: number;
  xp: number;
  /** L'XP qui lui manque pour le rang A. */
  pourLeRangA: number;
}

/** Ce qu'un dimanche fait de son outsider. */
export type Issue =
  /** La feuille n'a pas encore de résultat. */
  | "a-venir"
  /** Pas joué (ni absence injustifiée) : rien ne bouge. */
  | "absent"
  /** Rang A, toujours en D1 : la quête est accomplie. */
  | "accomplie"
  /** Ses points le font redescendre en D2. */
  | "chute"
  /** Il reste en D1, toujours rang B : la quête continue. */
  | "tient";

export interface Chapitre {
  j: number;
  outsider: Outsider;
  issue: Issue;
  /** Ses points Pépite de la journée. */
  points: number;
}

export interface ArcOutsider {
  /** L'arc : le numéro de la saison des divisions. */
  arc: number;
  /** Le dimanche à venir (ou en cours) : celui de l'outsider. */
  j: number;
  /** Tous les rangs B de la D1 avant ce dimanche, celui dont c'est la journée d'abord. */
  outsiders: Outsider[];
  /** Ce dimanche, pour son outsider. */
  chapitre: Chapitre | null;
  /** Le dimanche d'avant, pour le sien : la suite de l'histoire. */
  precedent: Chapitre | null;
}

/** Les points qu'il faut à un joueur de D1 pour y rester (descendre, c'est DESCENTE ou moins). */
export const POUR_RESTER_EN_D1 = REGLES_DIVISIONS.descente + 1;

/** Le journal de l'XP tel qu'il était avant la journée `j` de la saison `numero`. */
export function journalAvant(journal: Journal, numero: number, j: number): Journal {
  const out: Journal = new Map();
  for (const [nom, x] of journal)
    out.set(nom, { lignes: x.lignes.filter((l) => l.saison < numero || (l.saison === numero && l.j < j)), reussies: x.reussies });
  return out;
}

/** La saison telle qu'elle était avant la journée `j` : ses feuilles d'avant. */
function saisonAvant(saison: Saison, j: number): Saison {
  return { ...saison, entries: saison.entries.filter((e) => e.j < j) };
}

/** Les rangs à l'XP à vie, et l'XP qui ouvre le rang A (le moins d'XP parmi ceux qui l'ont). */
function rangsEtSeuil(journal: Journal, joueurs: Player[]): { rangs: Map<string, RangJoueur>; seuilA: number } {
  const classement = classementNiveau(journal, joueurs);
  const rangs = rangsDesJoueurs(classement);
  const placeA = [...rangs.values()].find((r) => r.rang === "B")?.suivant?.place ?? 0;
  const dansA = classement.filter((c) => c.rank <= placeA && c.xp > 0);
  return { rangs, seuilA: dansA.length ? Math.min(...dansA.map((c) => c.xp)) : 0 };
}

/** Les rangs B de la D1 : le mieux placé au Pépite d'Or d'abord, à égalité le plus loin en XP. */
export function outsidersDe(
  saison: Saison,
  etat: EtatDivisions,
  rangs: Map<string, RangJoueur>,
  seuilA: number
): Outsider[] {
  if (etat.phase !== "divisions") return [];
  // Le Pépite d'Or des journées jouées, comme le découpage (decouper).
  const jouees = new Set(saison.journees.map((m) => m.j).filter((j) => journeeJouee(saison, j)));
  const classes = rankPlayers(
    computeStandings({ ...saison, entries: saison.entries.filter((e) => jouees.has(e.j)) }).filter(
      (p) => etat.actuelle.get(p.name) === 1 && !isHidden(p.name)
    )
  );
  const out: Outsider[] = [];
  for (const p of classes) {
    const r = rangs.get(p.name);
    if (!r || r.rang !== "B") continue;
    out.push({
      nom: p.name,
      placeD1: p.rank,
      surD1: classes.length,
      placeXp: r.place,
      surXp: r.sur,
      xp: r.xp,
      pourLeRangA: Math.max(1, seuilA - r.xp),
    });
  }
  return out.sort((a, b) => a.placeD1 - b.placeD1 || b.placeXp - a.placeXp || a.nom.localeCompare(b.nom, "fr"));
}

/** Les outsiders d'avant la journée `j`, celui dont c'est la journée d'abord. */
function outsidersAvant(saison: Saison, journal: Journal, joueurs: Player[], j: number): Outsider[] {
  const s = saisonAvant(saison, j);
  const etat = etatDivisions(s);
  if (!etat) return [];
  const { rangs, seuilA } = rangsEtSeuil(journalAvant(journal, numeroSaison(saison), j), joueurs);
  return outsidersDe(s, etat, rangs, seuilA);
}

/** Ce que la journée `j` fait de son outsider ; null si elle n'en a pas. */
function chapitreDe(saison: Saison, journal: Journal, joueurs: Player[], j: number, outsiders?: Outsider[]): Chapitre | null {
  const outsider = (outsiders ?? outsidersAvant(saison, journal, joueurs, j))[0];
  if (!outsider) return null;
  // Comme les divisions : un présent, ou une absence injustifiée, compte.
  const lignes = saison.entries.filter((e) => e.j === j && e.player === outsider.nom);
  const compte = lignes.some((e) => (e.statut === "Présent" && !e.extraTime) || e.statut === "Absence injustifiée");
  const points = lignes.reduce((a, e) => a + entryPP(e), 0);
  let issue: Issue;
  if (!journeeJouee(saison, j)) issue = "a-venir";
  else if (!compte) issue = "absent";
  else if (apresLaJournee(1, points) > 1) issue = "chute";
  else {
    const apres = rangsEtSeuil(journalAvant(journal, numeroSaison(saison), j + 1), joueurs).rangs.get(outsider.nom);
    issue = apres && apres.rang !== "B" ? "accomplie" : "tient";
  }
  return { j, outsider, issue, points };
}

/**
 * L'arc des outsiders au dimanche `j` (le prochain, ou celui qui se joue) :
 * ses outsiders, ce que le dimanche fait du sien, et le chapitre d'avant.
 * null hors de la saison des divisions, ou avant le premier dimanche joué
 * en divisions.
 */
export function arcOutsider(saison: Saison, journal: Journal, joueurs: Player[], j: number): ArcOutsider | null {
  const arc = numeroSaison(saison);
  if (arc !== REGLES_DIVISIONS.saison || j < REGLES_DIVISIONS.depuis) return null;
  const outsiders = outsidersAvant(saison, journal, joueurs, j);
  const precedent = j - 1 >= REGLES_DIVISIONS.depuis ? chapitreDe(saison, journal, joueurs, j - 1) : null;
  if (!outsiders.length && !precedent) return null;
  return { arc, j, outsiders, chapitre: chapitreDe(saison, journal, joueurs, j, outsiders), precedent };
}
