// Les deux maillots du dimanche : chaque match se joue les Noirs contre les
// Blancs (décision de Sabri, 17/10/2026, sur la feuille de match de la Map).
// Dans chaque paire d'équipes que forme le moteur (saisie/engine.ts), la
// première (teamA) joue en noir, la seconde (teamB) en blanc. Depuis le
// 23/10, les récaps le disent aussi (Sabri : « quand on regarde les récaps
// de match, on voie qui est noir et qui est blanc ») : le terrain des Actus
// et de la Ligue, le récap de la journée, le fil, le Vestiaire, la recherche.
//
// Le nom interne d'une équipe reste la clé de la saisie et des calculs :
// « Noirs 2 », « Blancs 2 » depuis le 23/10 (saisie/equipes.ts, qui tient
// aussi la couleur de chaque camp), une couleur (Orange, Bleu…) dans les
// journées d'avant, qui ne se montre plus. Un jour à plusieurs matchs, ils se
// distinguent par leur numéro, « Match 1 », « Match 2 » (Sabri, 23/10 : plus
// aucune couleur ; « Terrain » désigne le terrain réel sur place, voir
// lib/sfl/matchs-du-jour.ts). Ici, ce que les écrans des joueurs en disent.

import type { Journee, JourneeMatch, MatchTeam } from "@/lib/sfl/engine";
import { MAILLOT, type Camp } from "@/lib/sfl/saisie/equipes";

export type { Camp };

export interface Maillot {
  /** « Noirs », « Blancs » : le camp. */
  nom: Camp;
  /** « les Noirs », pour une phrase. */
  les: string;
  /** « des Noirs » (« 40 % des buts des Noirs »). */
  des: string;
  /** Le fond (pastille du nom, onglet de la note) et l'encre posée dessus. */
  fond: string;
  encre: string;
}

export const MAILLOTS: Record<Camp, Maillot> = {
  Noirs: { nom: "Noirs", les: "les Noirs", des: "des Noirs", fond: MAILLOT.Noirs, encre: "#F4F5F2" },
  Blancs: { nom: "Blancs", les: "les Blancs", des: "des Blancs", fond: MAILLOT.Blancs, encre: MAILLOT.Noirs },
};

/** Le camp d'une équipe dans son match : la première de la paire joue en noir. */
export function campDansLeMatch(match: JourneeMatch, equipe: MatchTeam | string): Camp {
  const nom = typeof equipe === "string" ? equipe : equipe.name;
  return match.teamA.name === nom ? "Noirs" : "Blancs";
}

/** Le maillot d'une équipe dans son match. */
export function maillotDe(match: JourneeMatch, equipe: MatchTeam | string): Maillot {
  return MAILLOTS[campDansLeMatch(match, equipe)];
}

export interface CampDuJour {
  camp: Camp;
  maillot: Maillot;
  match: JourneeMatch;
  /** « Match 2 » un jour à plusieurs matchs, sinon null. */
  numero: string | null;
}

/** Où jouait une équipe (son nom interne) ce jour-là ; null si elle n'a pas joué. */
export function campDuJour(journee: Journee | undefined, equipe: string | null | undefined): CampDuJour | null {
  if (!equipe) return null;
  const matches = journee?.matches ?? [];
  const i = matches.findIndex((m) => m.teamA.name === equipe || m.teamB.name === equipe);
  if (i < 0) return null;
  const match = matches[i];
  const camp = campDansLeMatch(match, equipe);
  return { camp, maillot: MAILLOTS[camp], match, numero: matches.length > 1 ? `Match ${i + 1}` : null };
}

/** Le numéro d'un match quand la journée en a plusieurs (« Match 2 »), sinon null. */
export function numeroDu(journee: Journee | undefined, match: JourneeMatch): string | null {
  const matches = journee?.matches ?? [];
  if (matches.length < 2) return null;
  const i = matches.findIndex((m) => m.id === match.id);
  return i < 0 ? null : `Match ${i + 1}`;
}

/**
 * Le nom d'une équipe tel que les joueurs le lisent : « Noirs », ou
 * « Noirs · Match 2 » quand on le demande un jour à plusieurs matchs.
 * Une équipe absente des matchs garde son nom.
 */
export function nomDuCamp(journee: Journee | undefined, equipe: string, avecNumero = false): string {
  const c = campDuJour(journee, equipe);
  if (!c) return equipe;
  return avecNumero && c.numero ? `${c.maillot.nom} · ${c.numero}` : c.maillot.nom;
}

/** Le vainqueur d'un match, en clair : « les Noirs », « les Blancs », ou null s'il est nul. */
export function vainqueurDu(match: JourneeMatch): Maillot | null {
  if (match.teamA.score === match.teamB.score) return null;
  return MAILLOTS[match.teamA.score > match.teamB.score ? "Noirs" : "Blancs"];
}
