"use client";

// Session du joueur connecté — vérification Supabase d'abord, repli local.
//
// Depuis le branchement de Supabase, le mot de passe est vérifié PAR LE SERVEUR
// (supabase.auth.signInWithPassword) : c'est lui qui fait foi, et le changement
// de mot de passe est global, pas lié à un appareil.
//
// Le repli local (empreintes SHA-256 embarquées, voir accounts.ts) reste actif
// tant que les comptes ne sont pas tous créés côté serveur : il permet à toute
// la ligue de se connecter pendant la transition. Une fois l'installation
// terminée (page /admin/setup), passer ENFORCE_SERVER_AUTH à true pour que le
// serveur devienne l'unique juge.
//
// L'interface (signIn / signOut / getSession / changePassword) ne bouge pas :
// le reste de l'app ignore d'où vient la vérification.

import { findAccount, type Account } from "./accounts";
import { loginEmail, supabase } from "@/lib/supabase";

/**
 * false : Supabase d'abord, repli sur la vérification locale si indisponible.
 * true  : Supabase uniquement (à activer une fois les 71 comptes créés).
 */
const ENFORCE_SERVER_AUTH = false;

const SESSION_KEY = "sfl-session";
const OVERRIDE_PREFIX = "sfl-pwd-"; // mot de passe changé par le joueur (mode local)
export const SESSION_EVENT = "sfl-session";

export interface Session {
  user: string;
  name: string;
  admin: boolean;
  since: number;
  /** true = vérifié par le serveur Supabase, false = repli local. */
  server?: boolean;
}

function emit() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function storeSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Le reste de l'app lit encore `sfl-me` : on garde les deux alignés.
  localStorage.setItem("sfl-me", session.name);
  emit();
}

/** SHA-256 hexadécimal — même formule que le générateur de comptes. */
export async function hashPassword(user: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`sfl:${user}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Empreinte locale attendue : celle choisie par le joueur, sinon la défaut. */
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

async function signInLocal(account: Account, password: string): Promise<SignInResult> {
  if (typeof crypto === "undefined" || !crypto.subtle) return { ok: false, reason: "unavailable" };
  const hash = await hashPassword(account.user, password);
  if (hash !== expectedHash(account)) return { ok: false, reason: "bad-password" };
  const session: Session = {
    user: account.user,
    name: account.name,
    admin: !!account.admin,
    since: Date.now(),
    server: false,
  };
  storeSession(session);
  return { ok: true, session };
}

export async function signIn(user: string, password: string): Promise<SignInResult> {
  const account = findAccount(user);
  if (!account) return { ok: false, reason: "unknown-user" };

  // 1 · Le serveur d'abord.
  try {
    const { data, error } = await supabase().auth.signInWithPassword({
      email: loginEmail(account.user),
      password,
    });
    if (!error && data.user) {
      // Le rôle admin vient de la table profiles (jamais des métadonnées).
      let admin = false;
      const { data: profile } = await supabase()
        .from("profiles")
        .select("is_admin, name")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile) admin = !!profile.is_admin;
      const session: Session = {
        user: account.user,
        name: profile?.name ?? account.name,
        admin,
        since: Date.now(),
        server: true,
      };
      storeSession(session);
      return { ok: true, session };
    }
    // Identifiants refusés par le serveur : en mode strict, on s'arrête là.
    if (ENFORCE_SERVER_AUTH) return { ok: false, reason: "bad-password" };
  } catch {
    // Réseau ou projet en pause : on tente le repli local.
    if (ENFORCE_SERVER_AUTH) return { ok: false, reason: "unavailable" };
  }

  // 2 · Repli local (transition, tant que les comptes serveur n'existent pas).
  return signInLocal(account, password);
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  // Sans await : la session locale meurt tout de suite, le serveur suit.
  supabase()
    .auth.signOut()
    .catch(() => {});
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

/** Change le mot de passe — sur le serveur si la session vient de lui. */
export async function changePassword(
  user: string,
  current: string,
  next: string
): Promise<{ ok: true } | { ok: false; reason: "bad-password" | "too-short" | "unavailable" }> {
  const account = findAccount(user);
  if (!account) return { ok: false, reason: "bad-password" };
  if (next.trim().length < 6) return { ok: false, reason: "too-short" };

  const session = getSession();
  if (session?.server) {
    try {
      // Revalide l'actuel avant de changer (updateUser ne le vérifie pas).
      const { error: reauth } = await supabase().auth.signInWithPassword({
        email: loginEmail(account.user),
        password: current,
      });
      if (reauth) return { ok: false, reason: "bad-password" };
      const { error } = await supabase().auth.updateUser({ password: next });
      if (error) return { ok: false, reason: "unavailable" };
      return { ok: true };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }

  // Mode local.
  const hash = await hashPassword(account.user, current);
  if (hash !== expectedHash(account)) return { ok: false, reason: "bad-password" };
  localStorage.setItem(`${OVERRIDE_PREFIX}${account.user}`, await hashPassword(account.user, next));
  return { ok: true };
}

/** Le joueur a-t-il déjà changé son mot de passe par défaut ? (mode local) */
export function hasCustomPassword(user: string): boolean {
  const session = getSession();
  // Sur le serveur, on ne peut pas le savoir : on ne harcèle pas l'utilisateur.
  if (session?.server) return true;
  try {
    return localStorage.getItem(`${OVERRIDE_PREFIX}${user}`) !== null;
  } catch {
    return false;
  }
}
