"use client";

// Session du joueur connecté.
//
// Aujourd'hui la vérification se fait sur l'appareil : l'app compare
// l'empreinte du mot de passe saisi à celle embarquée dans accounts.ts. C'est
// une porte d'entrée, pas une sécurité — quelqu'un de motivé peut lire le code
// de la page. Elle suffit pour que chacun retrouve SON profil et réponde en son
// nom, et elle disparaîtra derrière Supabase Auth : seules les trois fonctions
// `signIn`, `signOut` et `getSession` changeront, pas les écrans.
//
// Le stockage est volontairement isolé ici pour que cette bascule soit locale.

import { findAccount, type Account } from "./accounts";

const SESSION_KEY = "sfl-session";
const OVERRIDE_PREFIX = "sfl-pwd-"; // mot de passe changé par le joueur
export const SESSION_EVENT = "sfl-session";

export interface Session {
  user: string;
  name: string;
  admin: boolean;
  since: number;
}

function emit() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

/** SHA-256 hexadécimal — même formule que le générateur de comptes. */
export async function hashPassword(user: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`sfl:${user}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Empreinte attendue : celle choisie par le joueur, sinon celle par défaut. */
function expectedHash(account: Account): string {
  try {
    return localStorage.getItem(`${OVERRIDE_PREFIX}${account.user}`) ?? account.hash;
  } catch {
    return account.hash;
  }
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "unknown-user" | "bad-password" | "unavailable" };

export async function signIn(user: string, password: string): Promise<SignInResult> {
  const account = findAccount(user);
  if (!account) return { ok: false, reason: "unknown-user" };
  // crypto.subtle n'existe qu'en contexte sécurisé (https ou localhost).
  if (typeof crypto === "undefined" || !crypto.subtle) return { ok: false, reason: "unavailable" };

  const hash = await hashPassword(account.user, password);
  if (hash !== expectedHash(account)) return { ok: false, reason: "bad-password" };

  const session: Session = {
    user: account.user,
    name: account.name,
    admin: !!account.admin,
    since: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Le reste de l'app lit encore `sfl-me` : on garde les deux alignés.
  localStorage.setItem("sfl-me", session.name);
  emit();
  return { ok: true, session };
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  emit();
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return findAccount(s.user) ? s : null;
  } catch {
    return null;
  }
}

/** Change le mot de passe du compte connecté (stocké sur cet appareil). */
export async function changePassword(
  user: string,
  current: string,
  next: string
): Promise<{ ok: true } | { ok: false; reason: "bad-password" | "too-short" }> {
  const account = findAccount(user);
  if (!account) return { ok: false, reason: "bad-password" };
  if (next.trim().length < 6) return { ok: false, reason: "too-short" };
  const hash = await hashPassword(account.user, current);
  if (hash !== expectedHash(account)) return { ok: false, reason: "bad-password" };
  localStorage.setItem(`${OVERRIDE_PREFIX}${account.user}`, await hashPassword(account.user, next));
  return { ok: true };
}

/** Le joueur a-t-il déjà changé son mot de passe par défaut ? */
export function hasCustomPassword(user: string): boolean {
  try {
    return localStorage.getItem(`${OVERRIDE_PREFIX}${user}`) !== null;
  } catch {
    return false;
  }
}
