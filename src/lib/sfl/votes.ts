"use client";

// Moteur d'élection des figures de match (MVP, Joueur Impact, Défensive).
//
// Principe : on ne peut voter que pour un adversaire (jamais un coéquipier).
//
// Phase 1 — Nomination par équipe : dans chaque match de la journée, les
// joueurs de l'équipe A votent pour un joueur de l'équipe B (et vice-versa).
// Le joueur le plus voté de chaque côté devient le "nominé" de son équipe.
// Une journée à plusieurs matchs produit donc plusieurs nominés (2 par match).
//
// Phase 2 — Finale du jour : tous les participants de la journée votent parmi
// l'ensemble des nominés (toutes équipes confondues) pour élire le vainqueur
// unique qui recevra la carte Boost.
//
// Stockage : localStorage, un vote par (journée, [match], catégorie, votant).
// C'est un premier jet fonctionnel en attendant un vrai backend multi-utilisateurs.

import type { BoostType, Journee, JourneeMatch, MatchTeam } from "./engine";
import { journeeParticipants } from "./engine";

export type BoostCategory = BoostType;

export const CATEGORY_LABELS: Record<BoostCategory, string> = {
  mvp: "MVP du match",
  impact: "Joueur Impact",
  def: "Meilleur défenseur",
};

function phase1Key(j: number, matchId: string, cat: BoostCategory, voter: string) {
  return `sfl-vote1-j${j}-${matchId}-${cat}-${voter}`;
}
function phase2Key(j: number, cat: BoostCategory, voter: string) {
  return `sfl-vote2-j${j}-${cat}-${voter}`;
}

export function getPhase1Vote(
  j: number,
  matchId: string,
  cat: BoostCategory,
  voter: string
): string | null {
  return localStorage.getItem(phase1Key(j, matchId, cat, voter));
}

export function castPhase1Vote(
  j: number,
  matchId: string,
  cat: BoostCategory,
  voter: string,
  candidate: string
) {
  localStorage.setItem(phase1Key(j, matchId, cat, voter), candidate);
}

export function getPhase2Vote(j: number, cat: BoostCategory, voter: string): string | null {
  return localStorage.getItem(phase2Key(j, cat, voter));
}

export function castPhase2Vote(
  j: number,
  cat: BoostCategory,
  voter: string,
  candidate: string
) {
  localStorage.setItem(phase2Key(j, cat, voter), candidate);
}

export interface SideTally {
  voters: MatchTeam;
  candidates: MatchTeam;
  votes: Record<string, number>;
  votedCount: number;
  totalVoters: number;
  /** Nominé de ce côté — null si égalité ou aucun vote. */
  leader: string | null;
}

function tallySide(j: number, match: JourneeMatch, cat: BoostCategory, voters: MatchTeam, candidates: MatchTeam): SideTally {
  const votes: Record<string, number> = {};
  for (const c of candidates.players) votes[c.name] = 0;
  let votedCount = 0;
  for (const voter of voters.players) {
    const choice = getPhase1Vote(j, match.id, cat, voter.name);
    if (choice && choice in votes) {
      votes[choice]++;
      votedCount++;
    }
  }
  const max = Math.max(0, ...Object.values(votes));
  const leaders = Object.entries(votes).filter(([, n]) => n === max && max > 0).map(([n]) => n);
  return {
    voters,
    candidates,
    votes,
    votedCount,
    totalVoters: voters.players.length,
    leader: leaders.length === 1 ? leaders[0] : null,
  };
}

export interface MatchTally {
  match: JourneeMatch;
  fromA: SideTally; // voté par teamA, candidats = teamB
  fromB: SideTally; // voté par teamB, candidats = teamA
}

export function tallyMatch(j: number, match: JourneeMatch, cat: BoostCategory): MatchTally {
  return {
    match,
    fromA: tallySide(j, match, cat, match.teamA, match.teamB),
    fromB: tallySide(j, match, cat, match.teamB, match.teamA),
  };
}

export interface Nominee {
  name: string;
  matchLabel: string;
  nominatedBy: string; // nom de l'équipe qui l'a désigné
}

export function getNominees(journee: Journee, cat: BoostCategory): Nominee[] {
  const out: Nominee[] = [];
  for (const match of journee.matches ?? []) {
    const t = tallyMatch(journee.j, match, cat);
    if (t.fromA.leader) {
      out.push({ name: t.fromA.leader, matchLabel: match.label, nominatedBy: match.teamA.name });
    }
    if (t.fromB.leader) {
      out.push({ name: t.fromB.leader, matchLabel: match.label, nominatedBy: match.teamB.name });
    }
  }
  return out;
}

export interface Phase2Tally {
  nominees: Nominee[];
  votes: Record<string, number>;
  votedCount: number;
  totalVoters: number;
  /** Candidat actuellement en tête (peut encore être dépassé). */
  leader: string | null;
  tie: boolean;
  /** true si tous les matchs de la journée ont produit un nominé de chaque côté. */
  allNominationsReady: boolean;
  /** true une fois que tous les participants ont voté et qu'il n'y a pas d'égalité — la carte est attribuée. */
  decided: boolean;
}

export function tallyPhase2(journee: Journee, cat: BoostCategory): Phase2Tally {
  const matches = journee.matches ?? [];
  const nominees = getNominees(journee, cat);
  const allNominationsReady =
    matches.length > 0 && nominees.length === matches.length * 2;

  const uniqueNames = [...new Set(nominees.map((n) => n.name))];
  const votes: Record<string, number> = {};
  for (const n of uniqueNames) votes[n] = 0;

  const voters = journeeParticipants(journee);
  let votedCount = 0;
  for (const voter of voters) {
    const choice = getPhase2Vote(journee.j, cat, voter);
    if (choice && choice in votes) {
      votes[choice]++;
      votedCount++;
    }
  }
  const max = Math.max(0, ...Object.values(votes));
  const leaders = Object.entries(votes).filter(([, n]) => n === max && max > 0).map(([n]) => n);
  const leader = leaders.length === 1 ? leaders[0] : null;

  return {
    nominees,
    votes,
    votedCount,
    totalVoters: voters.length,
    leader,
    tie: leaders.length > 1,
    allNominationsReady,
    decided: voters.length > 0 && votedCount === voters.length && leader !== null,
  };
}
