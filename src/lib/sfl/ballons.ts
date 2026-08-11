"use client";

// Ballons — la monnaie de la SFL, stockée en localStorage par profil
// (même modèle que l'Elo du Duel : v1 locale, migration backend plus tard).
//
// Gains journaliers :
//  · +2 Ballons à la première connexion du jour
//  · +1 Ballon au premier vote (figure de match) du jour
//  · +5 Ballons quand on termine ses 10 duels du jour (10 max/jour)
//
// Dépenses : packs booster et boutique (voir collection.ts).

export const DAILY_LOGIN_REWARD = 2;
export const DAILY_VOTE_REWARD = 1;
export const DAILY_DUEL_REWARD = 5;
export const DAILY_DUEL_CAP = 10;

/**
 * Ancrage monétaire de la ligue : 10 € = 1 000 Ballons, donc **1 Ballon vaut
 * 1 centime**. C'est ce taux qui donne son prix à tout ce qui s'achète :
 *   · une carte Standard à 20 ⚽ = 20 centimes ;
 *   · un textile affiché 29 € = 2 900 ⚽.
 * La marge se décide au moment de fixer le prix en euros de l'article ; la
 * conversion, elle, ne bouge pas — sinon plus personne ne s'y retrouve.
 */
export const BALLONS_PAR_EURO = 100;

/** Prix en Ballons d'un article dont on connaît le prix de vente en euros. */
export const ballonsPourEuros = (euros: number) => Math.round(euros * BALLONS_PAR_EURO);

export interface Recharge {
  euros: number;
  ballons: number;
  /** Ballons offerts en plus du taux normal (mis en avant dans la boutique). */
  bonus?: number;
}

/**
 * Recharges proposées. Le taux est le même partout — seule la plus grosse
 * porte un geste commercial, pour donner une raison de la préférer.
 */
export const RECHARGES: Recharge[] = [
  { euros: 2, ballons: 200 },
  { euros: 5, ballons: 500 },
  { euros: 10, ballons: 1000 },
  { euros: 20, ballons: 2200, bonus: 200 },
];

export interface BallonsEntry {
  amount: number; // positif = gain, négatif = dépense
  reason: string;
  ts: number;
}

function walletKey(voter: string) {
  return `sfl-ballons-${voter}`;
}
function logKey(voter: string) {
  return `sfl-ballons-log-${voter}`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Notifie l'UI (badge du header, pages ouvertes) qu'un solde a bougé.
function emitChange() {
  window.dispatchEvent(new Event("sfl-ballons"));
}

// Comptes "illimités" : profils de test qui ne doivent jamais être
// bloqués par leur solde. Leur portefeuille est remis à flot dès qu'il
// passe sous ce plancher (même s'il existait déjà avec un petit solde).
const BALANCE_FLOORS: Record<string, number> = {
  Ilyes: 12000,
};

export function getBalance(voter: string): number {
  const raw = localStorage.getItem(walletKey(voter));
  const n = raw ? parseInt(raw, 10) : 0;
  const balance = Number.isFinite(n) ? n : 0;
  const floor = BALANCE_FLOORS[voter];
  if (floor && balance < floor) {
    localStorage.setItem(walletKey(voter), String(floor));
    appendLog(voter, { amount: floor - balance, reason: "Recharge compte test", ts: Date.now() });
    return floor;
  }
  return balance;
}

export function getLog(voter: string): BallonsEntry[] {
  try {
    return JSON.parse(localStorage.getItem(logKey(voter)) ?? "[]");
  } catch {
    return [];
  }
}

function appendLog(voter: string, entry: BallonsEntry) {
  const log = getLog(voter);
  log.push(entry);
  localStorage.setItem(logKey(voter), JSON.stringify(log.slice(-200)));
}

export function credit(voter: string, amount: number, reason: string) {
  localStorage.setItem(walletKey(voter), String(getBalance(voter) + amount));
  appendLog(voter, { amount, reason, ts: Date.now() });
  emitChange();
}

// Renvoie false (sans rien changer) si le solde est insuffisant.
export function debit(voter: string, amount: number, reason: string): boolean {
  const balance = getBalance(voter);
  if (balance < amount) return false;
  localStorage.setItem(walletKey(voter), String(balance - amount));
  appendLog(voter, { amount: -amount, reason, ts: Date.now() });
  emitChange();
  return true;
}

/* ---------------- Récompenses journalières ---------------- */

// +2 Ballons, une fois par jour. Renvoie le montant crédité (0 si déjà pris).
export function claimDailyLogin(voter: string): number {
  const key = `sfl-daily-login-${voter}`;
  if (localStorage.getItem(key) === today()) return 0;
  localStorage.setItem(key, today());
  credit(voter, DAILY_LOGIN_REWARD, "Connexion du jour");
  return DAILY_LOGIN_REWARD;
}

// +1 Ballon au premier vote du jour. Renvoie le montant crédité.
export function claimVoteReward(voter: string): number {
  const key = `sfl-daily-vote-${voter}`;
  if (localStorage.getItem(key) === today()) return 0;
  localStorage.setItem(key, today());
  credit(voter, DAILY_VOTE_REWARD, "Vote du jour");
  return DAILY_VOTE_REWARD;
}

export function getDailyDuelCount(voter: string): number {
  const raw = localStorage.getItem(`sfl-daily-duels-${voter}`);
  if (!raw) return 0;
  try {
    const { date, count } = JSON.parse(raw);
    return date === today() ? count : 0;
  } catch {
    return 0;
  }
}

// Comptabilise un duel du jour. Renvoie le nouveau compte, si le duel a pu
// être joué (false = quota atteint) et les Ballons crédités (5 au dixième).
export function recordDailyDuel(voter: string): {
  count: number;
  allowed: boolean;
  rewarded: number;
} {
  const count = getDailyDuelCount(voter);
  if (count >= DAILY_DUEL_CAP) return { count, allowed: false, rewarded: 0 };

  const next = count + 1;
  localStorage.setItem(
    `sfl-daily-duels-${voter}`,
    JSON.stringify({ date: today(), count: next })
  );
  let rewarded = 0;
  if (next === DAILY_DUEL_CAP) {
    rewarded = DAILY_DUEL_REWARD;
    credit(voter, DAILY_DUEL_REWARD, `${DAILY_DUEL_CAP} duels du jour`);
  }
  return { count: next, allowed: true, rewarded };
}
