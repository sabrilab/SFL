"use client";

// Duel — comparaisons par paires entre joueurs, façon Elo.
// Chaque profil construit son propre classement personnel en choisissant,
// à chaque duel, le joueur qu'il juge meilleur. Stocké en localStorage par
// votant ; l'agrégation en classement global viendra avec le backend.

const DEFAULT_ELO = 1000;
const K = 32;

export interface PlayerRating {
  elo: number;
  duels: number;
}

export type Ratings = Record<string, PlayerRating>;

function storageKey(voter: string) {
  return `sfl-elo-${voter}`;
}

export function getRatings(voter: string): Ratings {
  try {
    return JSON.parse(localStorage.getItem(storageKey(voter)) ?? "{}");
  } catch {
    return {};
  }
}

function ratingOf(ratings: Ratings, name: string): PlayerRating {
  return ratings[name] ?? { elo: DEFAULT_ELO, duels: 0 };
}

export function eloOf(voter: string, name: string): number {
  return ratingOf(getRatings(voter), name).elo;
}

// Met à jour et renvoie les nouvelles notes après un duel (winner > loser).
export function recordDuel(voter: string, winner: string, loser: string): Ratings {
  const ratings = getRatings(voter);
  const rw = ratingOf(ratings, winner);
  const rl = ratingOf(ratings, loser);

  const expectedWin = 1 / (1 + 10 ** ((rl.elo - rw.elo) / 400));
  const expectedLose = 1 - expectedWin;

  ratings[winner] = {
    elo: Math.round(rw.elo + K * (1 - expectedWin)),
    duels: rw.duels + 1,
  };
  ratings[loser] = {
    elo: Math.round(rl.elo + K * (0 - expectedLose)),
    duels: rl.duels + 1,
  };

  localStorage.setItem(storageKey(voter), JSON.stringify(ratings));
  return ratings;
}

export function resetRatings(voter: string) {
  localStorage.removeItem(storageKey(voter));
}

// Choisit deux joueurs distincts au hasard, en évitant si possible de
// répéter la paire précédente.
export function pickPair<T extends { name: string }>(
  players: T[],
  avoid?: [string, string]
): [T, T] {
  for (let attempt = 0; attempt < 8; attempt++) {
    const a = players[Math.floor(Math.random() * players.length)];
    let b = players[Math.floor(Math.random() * players.length)];
    let guard = 0;
    while (b.name === a.name && guard < 10) {
      b = players[Math.floor(Math.random() * players.length)];
      guard++;
    }
    if (b.name === a.name) continue;
    const isSameAsAvoid =
      avoid && ((avoid[0] === a.name && avoid[1] === b.name) || (avoid[0] === b.name && avoid[1] === a.name));
    if (!isSameAsAvoid) return [a, b];
  }
  return [players[0], players[1]];
}
