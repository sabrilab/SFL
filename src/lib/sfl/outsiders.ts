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
//
// La veille du dimanche, toute la ligue apprend dont c'est la journée, par
// notification (notificationOutsider, /api/outsider/annoncer).

import { jourMoisDuLibelle } from "./convocation-temps";
import { rankPlayers, type Player } from "./engine";
import {
  aParis,
  decouper,
  ecartsDecoupage,
  etatDivisions,
  FENETRE_NOTIFICATION,
  REGLES_DIVISIONS,
  type EtatDivisions,
} from "./divisions";
import { heureMin } from "./ligue-vierge";
import { matchsDeJournee, premierCoupDEnvoi } from "./matchs-du-jour";
import {
  classementNiveau,
  journalXp,
  rangsDesJoueurs,
  type FelicitationXp,
  type LigneXp,
  type RangJoueur,
  type Reponse,
} from "./missions";
import { computeJournees, deriveSeason, entryPP } from "./saisie/engine";
import { journeeJouee, journeeTerminee } from "./saisie/mutations";
import { numeroSaison, type Saison } from "./saisie/types";
import { classables, standingsJusqua } from "./rangs";
import { appliquerVotes, type VoteFigure } from "./votes";

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
  /** Ses points d'avance sur le premier de la D2 (null quand la D2 est vide) : ce qu'il doit garder dimanche. */
  avance: number | null;
}

/** Ce qu'un dimanche fait de son outsider. */
export type Issue =
  /** La feuille n'a pas encore de résultat. */
  | "a-venir"
  /** Pas joué (ni absence injustifiée), toujours en D1. */
  | "absent"
  /** Rang A, toujours en D1 : la quête est accomplie. */
  | "accomplie"
  /** Le Pépite d'Or du soir le fait redescendre en D2 (ou plus bas). */
  | "chute"
  /** Il reste en D1, toujours rang B : la quête continue. */
  | "tient";

export interface Chapitre {
  j: number;
  outsider: Outsider;
  issue: Issue;
  /** Ses points Pépite de la journée. */
  points: number;
  /** Son rang à l'XP à vie une fois la journée jouée (null avant) : le rang A de la quête accomplie. */
  rangApres: RangJoueur | null;
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
  const classes = rankPlayers(classables(standingsJusqua(saison)).filter((p) => etat.actuelle.get(p.name) === 1));
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
      avance: ecartsDecoupage(etat.decoupage, p.name).avance,
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
  // Un présent, ou une absence injustifiée, a joué sa journée.
  const lignes = saison.entries.filter((e) => e.j === j && e.player === outsider.nom);
  const compte = lignes.some((e) => (e.statut === "Présent" && !e.extraTime) || e.statut === "Absence injustifiée");
  const points = lignes.reduce((a, e) => a + entryPP(e), 0);
  const jouee = journeeJouee(saison, j);
  const rangApres = jouee ? (rangsEtSeuil(journalAvant(journal, numeroSaison(saison), j + 1), joueurs).rangs.get(outsider.nom) ?? null) : null;
  // Rester en D1, c'est rester dans ses 30 places au Pépite d'Or du soir :
  // même sans jouer, ceux qui marquent peuvent le passer.
  const enD1 = jouee && decouper(saison, j).parNom.get(outsider.nom)?.division === 1;
  let issue: Issue;
  if (!jouee) issue = "a-venir";
  else if (!enD1) issue = "chute";
  else if (!compte) issue = "absent";
  else issue = rangApres && rangApres.rang !== "B" ? "accomplie" : "tient";
  return { j, outsider, issue, points, rangApres };
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

/* ─────────────────────── La notification du samedi ─────────────────────── */
// La veille de chaque dimanche qui a son outsider, dès 18 h (Paris), comme
// l'annonce des divisions : « J4 · La journée de Miken ». Le prénom revient
// dans le texte au lieu d'un « il » : la notification ne suppose jamais le
// genre de personne.

/** Le texte que Sabri a retenu : le récit, ou les chiffres. */
export const TEXTE_NOTIFICATION: "recit" | "chiffres" = "recit";

/** Le dimanche dont l'outsider s'annonce : celui d'après la dernière journée jouée, dans l'arc. */
export function dimancheAAnnoncer(saison: Saison): number | null {
  if (numeroSaison(saison) !== REGLES_DIVISIONS.saison) return null;
  // Après la dernière feuille FINIE : un but saisi en direct ne fait pas sauter au dimanche suivant.
  const j = Math.max(0, ...saison.journees.map((m) => m.j).filter((x) => journeeTerminee(saison, x))) + 1;
  return j >= REGLES_DIVISIONS.depuis ? j : null;
}

/**
 * L'outsider du dimanche `j`, calculé comme les Actus le calculent
 * (SeasonProvider, hooks/use-missions.ts), depuis ce que la base garde : les
 * réponses aux missions, les votes de la saison, les félicitations. null si
 * ce dimanche n'en a pas.
 */
export function outsiderDuDimanche(
  saison: Saison,
  j: number,
  base: { reponses: Reponse[]; votes: VoteFigure[]; felicitations: FelicitationXp[] },
  maintenant: Date
): Outsider | null {
  const brut = deriveSeason(saison);
  const vote = appliquerVotes(saison, brut.journees, base.votes, maintenant);
  const derivee = vote === saison ? brut : deriveSeason(vote);
  const jugee = appliquerVotes(saison, derivee.journees, base.votes, maintenant);
  const journal = journalXp(jugee, base.reponses, base.votes, maintenant, base.felicitations);
  // Les divisions et le Pépite d'Or de l'arc : sur la saison des votes
  // appliqués, comme les Actus (avant le 27/10, la saison brute).
  return arcOutsider(vote, journal, derivee.players, j)?.chapitre?.outsider ?? null;
}

/** Un samedi soir ou un dimanche, à Paris : l'app ne sonne la route qu'alors (le serveur juge du reste). */
export function peutEtreLaVeille(maintenant: Date): boolean {
  const ici = aParis(maintenant);
  const jour = new Date(Date.UTC(ici.annee, ici.mois - 1, ici.jour)).getUTCDay();
  return (jour === 6 && ici.minutes >= FENETRE_NOTIFICATION.veille) || (jour === 0 && ici.minutes >= FENETRE_NOTIFICATION.matin);
}

/**
 * Quand part la notification du dimanche `j` : la veille dès 18 h, le jour
 * même de 9 h au coup d'envoi (Paris). La date est celle de la journée, sinon
 * celle de la convocation ouverte ; null hors de la fenêtre.
 */
export function fenetreOutsider(
  saison: Saison,
  j: number,
  maintenant: Date,
  convocation?: { date_label?: string | null; heure?: string | null } | null
): "veille" | "jour" | null {
  const meta = saison.journees.find((m) => m.j === j);
  const jm = jourMoisDuLibelle(meta?.date ?? convocation?.date_label ?? "");
  if (!jm) return null;
  const ici = aParis(maintenant);
  const veille = new Date(Date.UTC(ici.annee, jm.mois - 1, jm.jour - 1));
  if (ici.mois === veille.getUTCMonth() + 1 && ici.jour === veille.getUTCDate())
    return ici.minutes >= FENETRE_NOTIFICATION.veille ? "veille" : null;
  if (ici.mois !== jm.mois || ici.jour !== jm.jour) return null;
  const heure = meta?.heure ?? convocation?.heure ?? "13h00";
  const journee = computeJournees(saison).find((x) => x.j === j);
  const coupEnvoi = premierCoupDEnvoi(matchsDeJournee(journee, [], { heure, lieu: null }), heure);
  return ici.minutes >= FENETRE_NOTIFICATION.matin && ici.minutes < heureMin(coupEnvoi) ? "jour" : null;
}

/**
 * La notification, pour un joueur de la ligue : « J4 · La journée de Miken »,
 * « Personne ne l'attendait en D1. Demain, Miken joue son rang A. » ; pour
 * l'outsider : « J4 · Ta journée », « Personne ne t'attendait en D1. Demain,
 * tu joues ton rang A. » Le dimanche matin, « Aujourd'hui ». `qui` est le
 * prénom de l'outsider, tel que la ligue le lit.
 */
export function notificationOutsider(
  o: Outsider,
  j: number,
  pour: string,
  qui: string,
  moment: "veille" | "jour",
  texte: typeof TEXTE_NOTIFICATION = TEXTE_NOTIFICATION
): { titre: string; texte: string } {
  const toi = pour === o.nom;
  const quand = moment === "veille" ? "Demain" : "Aujourd'hui";
  const debut =
    texte === "recit"
      ? `Personne ne ${toi ? "t'" : "l'"}attendait en D1.`
      : `Rang B, ${o.placeD1 === 1 ? "en tête" : `${o.placeD1}e`} de la D1.`;
  const quete = `${quand}, ${toi ? "tu joues ton" : `${qui} joue son`} rang A${texte === "chiffres" ? " sans tomber en D2" : ""}.`;
  return { titre: toi ? `J${j} · Ta journée` : `J${j} · La journée de ${qui}`, texte: `${debut} ${quete}` };
}
