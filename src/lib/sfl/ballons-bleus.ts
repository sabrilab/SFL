"use client";

// Ballons bleus — la SECONDE monnaie de la ligue, celle qui ne s'achète pas.
//
// Décision de l'admin : deux monnaies distinctes.
//   · les Ballons ⚽ s'achètent et se dépensent (cartes, packs, boutique) ;
//   · les Ballons bleus 🔵 se GAGNENT uniquement en jouant dans l'Arène —
//     1 par match gagné, 5 pour une victoire en duel direct contre un ami.
// Ils ne servent encore à rien : ils s'accumulent, et débloqueront plus tard
// l'échange de cartes entre joueurs. Aucun débit n'existe donc ici.
//
// Même modèle de stockage que les Ballons : localStorage par profil, journal
// des mouvements, événement pour rafraîchir l'UI.

export const MATCH_WIN_BLUE = 1;
export const DUEL_DIRECT_BLUE = 5; // duel direct contre un ami — quand les amis existeront

export interface BallonsBleusEntry {
  amount: number;
  reason: string;
  ts: number;
}

function walletKey(voter: string) {
  return `sfl-ballons-bleus-${voter}`;
}
function logKey(voter: string) {
  return `sfl-ballons-bleus-log-${voter}`;
}

function emitChange() {
  window.dispatchEvent(new Event("sfl-ballons-bleus"));
}

export function getBlueBalance(voter: string): number {
  const raw = localStorage.getItem(walletKey(voter));
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function getBlueLog(voter: string): BallonsBleusEntry[] {
  try {
    return JSON.parse(localStorage.getItem(logKey(voter)) ?? "[]");
  } catch {
    return [];
  }
}

export function creditBlue(voter: string, amount: number, reason: string) {
  localStorage.setItem(walletKey(voter), String(getBlueBalance(voter) + amount));
  const log = getBlueLog(voter);
  log.push({ amount, reason, ts: Date.now() });
  localStorage.setItem(logKey(voter), JSON.stringify(log.slice(-200)));
  emitChange();
}

/** Nombre de matchs d'Arène gagnés — lu dans le journal, pas de compteur à part. */
export function blueMatchWins(voter: string): number {
  return getBlueLog(voter).filter((e) => e.reason === "Match d'Arène gagné").length;
}
