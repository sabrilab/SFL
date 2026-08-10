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

import { ACCOUNTS, findAccount, type Account } from "./accounts";
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

/**
 * Borne une promesse dans le temps. Un projet Supabase en pause peut laisser
 * la requête pendre : sans ce garde-fou, l'écran de connexion resterait à
 * tourner indéfiniment au lieu de basculer sur la vérification locale.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

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

  // 1 · Le serveur d'abord — 5 secondes maximum, sinon repli local.
  try {
    const { data, error } = await withTimeout(
      supabase().auth.signInWithPassword({
        email: loginEmail(account.user),
        password,
      }),
      5000
    );
    if (!error && data.user) {
      // Le rôle admin vient de la table profiles (jamais des métadonnées).
      let admin = false;
      // PostgrestBuilder est un « thenable », pas une vraie promesse :
      // Promise.resolve le convertit pour le garde-fou de temps.
      const profileQuery = Promise.resolve(
        supabase()
          .from("profiles")
          .select("is_admin, name")
          .eq("id", data.user.id)
          .maybeSingle()
      );
      const profile = await withTimeout(profileQuery, 5000)
        .then((r) => r.data as { is_admin: boolean; name: string } | null)
        .catch(() => null);
      if (profile) admin = !!profile.is_admin;
      const session: Session = {
        user: account.user,
        name: profile?.name ?? account.name,
        admin,
        since: Date.now(),
        server: true,
      };
      storeSession(session);
      afterServerSignIn(data.user.id);
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

/* ────────────────── Connexion Google / Apple (OAuth) ────────────────── */

/**
 * Après une connexion serveur : journalise l'événement et capture l'email
 * réel du joueur (celui de son identité Google/Apple s'il en a lié une).
 * Fire-and-forget : jamais bloquant.
 */
function afterServerSignIn(userId: string) {
  const sb = supabase();
  sb.from("activity").insert({ player_id: userId, kind: "login" }).then(undefined, () => {});
  sb.auth
    .getUser()
    .then(async ({ data }) => {
      const identities = data.user?.identities ?? [];
      const oauthEmail = identities.find(
        (i) => i.provider !== "email" && i.identity_data?.email
      )?.identity_data?.email as string | undefined;
      if (!oauthEmail) return;
      await sb
        .from("profiles")
        .update({ contact_email: oauthEmail })
        .eq("id", userId)
        .is("contact_email", null);
    })
    .catch(() => {});
}

/**
 * Reprend une session Supabase déjà présente (retour d'une connexion
 * Google/Apple, ou session persistée) et la reflète dans la session locale.
 * Appelée au chargement de l'app ; sans effet si rien n'est en attente.
 */
export async function bootstrapServerSession(): Promise<boolean> {
  try {
    if (getSession()) return true;
    const { data } = await supabase().auth.getSession();
    const user = data.session?.user;
    if (!user) return false;

    const { data: profile } = await supabase()
      .from("profiles")
      .select("name, is_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.name) return false;

    const account = ACCOUNTS.find((a) => a.name === profile.name);
    const session: Session = {
      user: account?.user ?? profile.name.toLowerCase(),
      name: profile.name,
      admin: !!profile.is_admin,
      since: Date.now(),
      server: true,
    };
    storeSession(session);
    afterServerSignIn(user.id);
    return true;
  } catch {
    return false;
  }
}

/** Enregistre (ou met à jour) l'email de contact du joueur connecté. */
export async function saveContactEmail(email: string): Promise<boolean> {
  const session = getSession();
  if (!session?.server) return false;
  try {
    const { data } = await supabase().auth.getUser();
    const uid = data.user?.id;
    if (!uid) return false;
    const { error } = await supabase()
      .from("profiles")
      .update({ contact_email: email.trim().toLowerCase() })
      .eq("id", uid);
    return !error;
  } catch {
    return false;
  }
}

/** Email de contact du joueur connecté (null si absent ou hors serveur). */
export async function getContactEmail(): Promise<string | null> {
  const session = getSession();
  if (!session?.server) return null;
  try {
    const { data: auth } = await supabase().auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return null;
    const { data } = await supabase()
      .from("profiles")
      .select("contact_email")
      .eq("id", uid)
      .maybeSingle();
    return (data?.contact_email as string | null) ?? null;
  } catch {
    return null;
  }
}
