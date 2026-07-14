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

// Soldes de départ offerts à certains profils (crédités à la première
// lecture du portefeuille sur l'appareil).
const SEED_BALANCES: Record<string, number> = {
  Ilyes: 12000,
};

export function getBalance(voter: string): number {
  const raw = localStorage.getItem(walletKey(voter));
  if (raw === null && SEED_BALANCES[voter]) {
    localStorage.setItem(walletKey(voter), String(SEED_BALANCES[voter]));
    appendLog(voter, { amount: SEED_BALANCES[voter], reason: "Solde de bienvenue", ts: Date.now() });
    return SEED_BALANCES[voter];
  }
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
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
