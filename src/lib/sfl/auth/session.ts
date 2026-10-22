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
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { loginEmail, supabase, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase";
import { accordConnu } from "@/lib/sfl/consentement";
import { emailDe } from "@/lib/sfl/contacts";

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
  /**
   * Pourquoi le serveur n'a pas pris la connexion (repli local seulement) :
   * « mot-de-passe-local » — le mot de passe tapé n'existe que sur cet
   * appareil (changé ici quand la session était locale) ; « refuse » — le
   * serveur ne reconnaît pas ce mot de passe ; « injoignable » — pas de
   * réponse du serveur.
   */
  refus?: "mot-de-passe-local" | "refuse" | "injoignable";
  /**
   * true = compte créé par le joueur lui-même (/inscription), pas encore
   * accepté par l'admin. La base ne lui ouvre rien de la ligue : AuthGate lui
   * montre sa carte et l'écran d'attente à la place de l'app.
   */
  enAttente?: boolean;
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

/**
 * Le compte est-il accepté dans la ligue ? Lu À PART du reste du profil : si
 * la colonne manque (migration pas encore passée), la requête échoue et on
 * répond « oui » — l'erreur ne doit jamais enfermer dehors un membre, ni
 * faire perdre son rôle à l'admin dont le profil se lit dans la même requête.
 */
async function estValide(uid: string): Promise<boolean> {
  try {
    const r = await withTimeout(
      Promise.resolve(supabase().from("profiles").select("valide").eq("id", uid).maybeSingle()),
      5000
    );
    if (r.error || !r.data) return true;
    return (r.data as { valide?: boolean }).valide !== false;
  } catch {
    return true;
  }
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "unknown-user" | "bad-password" | "unavailable" | "mot-de-passe-local" };

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

async function signInLocal(
  account: Account,
  password: string,
  refus?: Session["refus"]
): Promise<SignInResult> {
  if (typeof crypto === "undefined" || !crypto.subtle) return { ok: false, reason: "unavailable" };
  const hash = await hashPassword(account.user, password);
  if (hash !== expectedHash(account)) return { ok: false, reason: "bad-password" };
  const session: Session = {
    user: account.user,
    name: account.name,
    admin: !!account.admin,
    since: Date.now(),
    server: false,
    ...(refus ? { refus } : {}),
  };
  storeSession(session);
  return { ok: true, session };
}

export async function signIn(user: string, password: string): Promise<SignInResult> {
  // La table embarquée est figée à la compilation : un joueur ajouté à
  // l'effectif en cours de saison n'y figure pas. Elle sert donc de REPLI,
  // plus de portail — le serveur, lui, connaît tout le monde.
  const account = findAccount(user);
  let identifiant = account?.user ?? user.trim().replace(/^@+/, "").toLowerCase();

  // 1 · Le serveur d'abord — 12 secondes maximum, sinon repli local. Une
  //     session locale ne lit plus rien de la ligue : mieux vaut attendre un
  //     peu un réseau lent (5G, navigateur intégré de Snapchat ou d'Instagram)
  //     que d'ouvrir une app vide.
  let refusServeur: Session["refus"];
  try {
    const essai = (id: string) =>
      withTimeout(supabase().auth.signInWithPassword({ email: loginEmail(id), password }), 12000);
    let { data, error } = await essai(identifiant);
    // Un joueur qui a changé de pseudo garde son identifiant technique
    // d'origine : la base dit lequel correspond au pseudo tapé.
    if (error && !isAuthRetryableFetchError(error)) {
      const { data: origine } = await withTimeout(
        Promise.resolve(supabase().rpc("identifiant_de_connexion", { pseudo: identifiant })),
        5000
      ).catch(() => ({ data: null }));
      if (typeof origine === "string" && origine && origine !== identifiant) {
        ({ data, error } = await essai(origine));
        if (!error) identifiant = origine;
      }
    }
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
      const valide = await estValide(data.user.id);
      const session: Session = {
        user: identifiant,
        // Le nom CANONIQUE vient du compte embarqué quand il existe : un
        // profil serveur créé sans métadonnées porte un nom déduit de l'email
        // (« sabri ») qui ne correspond à rien dans la saison. Pour un joueur
        // ajouté après coup, le profil est la seule source.
        name: account?.name ?? profile?.name ?? identifiant,
        admin,
        since: Date.now(),
        server: true,
        ...(valide ? {} : { enAttente: true }),
      };
      storeSession(session);
      // Le serveur fait foi : un mot de passe changé autrefois sur cet
      // appareil seulement (en session locale) ne doit plus ouvrir de
      // session locale qui contredit le serveur.
      try {
        localStorage.removeItem(`${OVERRIDE_PREFIX}${identifiant}`);
      } catch {}
      afterServerSignIn(data.user.id, session.name);
      return { ok: true, session };
    }
    // Le serveur n'a pas répondu (réseau) : c'est une panne, pas un refus.
    if (error && isAuthRetryableFetchError(error)) throw error;
    // Identifiants refusés par le serveur : en mode strict, on s'arrête là.
    if (ENFORCE_SERVER_AUTH) return { ok: false, reason: "bad-password" };
    refusServeur = "refuse";
  } catch {
    // Réseau ou projet en pause : on tente le repli local.
    if (ENFORCE_SERVER_AUTH) return { ok: false, reason: "unavailable" };
    refusServeur = "injoignable";
  }

  // 2 · Repli local — impossible sans empreinte embarquée : un compte créé
  //     en cours de saison n'existe que sur le serveur.
  if (!account) return { ok: false, reason: "unknown-user" };
  // Le serveur a refusé un mot de passe que cet appareil connaît parce qu'il
  // y a été changé : on le dit, pour que la personne sache quoi faire.
  let local = false;
  try {
    local = localStorage.getItem(`${OVERRIDE_PREFIX}${account.user}`) !== null;
  } catch {}
  // Le serveur a répondu non : une session locale ne lirait plus rien de la
  // ligue (la base ne s'ouvre qu'aux connexions vérifiées) et n'écrirait rien
  // non plus. C'était le bandeau « Connexion non vérifiée » qui revenait après
  // chaque « Me reconnecter » : un joueur qui a changé son mot de passe sur le
  // serveur tape l'ancien, celui d'origine, que l'empreinte embarquée accepte
  // encore. On refuse, en disant pourquoi.
  if (refusServeur === "refuse") {
    const tape = await hashPassword(account.user, password);
    if (local && tape === expectedHash(account)) return { ok: false, reason: "mot-de-passe-local" };
    return { ok: false, reason: "bad-password" };
  }
  // Serveur injoignable : repli local, en attendant qu'il réponde (voir
  // suivreSessionServeur, qui la revérifie dès que Supabase se connecte).
  return signInLocal(account, password, refusServeur);
}

/**
 * Rafraîchit la session depuis le serveur — appelée à chaque ouverture de
 * l'app et à chaque retour au premier plan. Le rôle admin vit dans la table
 * profiles : quand il change en base (migration, promotion), les sessions
 * déjà ouvertes doivent le voir sans que personne n'ait à se déconnecter.
 * Corrige aussi un nom de session hérité d'un ancien profil mal formé.
 *
 * Elle répare aussi une session marquée « non vérifiée » à tort : si le
 * jeton Supabase du même joueur est toujours là et valide, la session
 * redevient vérifiée, sans reconnexion.
 */
export async function refreshSession(): Promise<void> {
  const session = getSession();
  if (!session) return;
  const account = findAccount(session.user);
  try {
    const { data: auth, error } = await withTimeout(supabase().auth.getUser(), 5000);
    const user = auth.user;
    if (!user) {
      // getUser ne lève pas sur une panne de réseau : il rend « pas
      // d'utilisateur » avec une erreur réessayable. Ce n'est pas une
      // déconnexion — c'est un iPhone en 5G qui rouvre l'app après une heure,
      // le jeton à rafraîchir et la requête qui échoue. Rétrograder la
      // session là-dessus la coupait de la ligue pour de bon (elle ne se
      // revérifiait plus), bandeau « Connexion non vérifiée » et Map vide.
      // On ne rétrograde que si le serveur dit vraiment non.
      if (isAuthRetryableFetchError(error)) return;
      // Le jeton Supabase a disparu — expiré, révoqué, ou effacé par le
      // navigateur (iOS purge le stockage des sites peu visités). Notre propre
      // session, elle, survit indéfiniment : elle continuerait d'affirmer
      // « vérifiée par le serveur » pendant que chaque écriture est refusée,
      // en silence. On la remet à la vérité, pour que l'écran réclame une
      // reconnexion.
      if (session.server) storeSession({ ...session, server: false });
      return;
    }
    const profileQuery = Promise.resolve(
      supabase().from("profiles").select("is_admin, name").eq("id", user.id).maybeSingle()
    );
    const profile = await withTimeout(profileQuery, 5000)
      .then((r) => r.data as { is_admin: boolean; name: string } | null)
      .catch(() => null);

    if (!session.server) {
      // Le jeton est valide : est-ce bien celui de ce joueur ? Identifiant
      // (connexion par mot de passe) ou nom du profil (Google / Apple).
      const memeJoueur =
        user.email === loginEmail(session.user) || (!!profile?.name && profile.name === session.name);
      if (!memeJoueur || !profile) return;
      const { refus: _refus, enAttente: _avant, ...reste } = session;
      void _refus;
      void _avant;
      const attente = !(await estValide(user.id));
      storeSession({ ...reste, admin: !!profile.is_admin, server: true, ...(attente ? { enAttente: true } : {}) });
      return;
    }

    if (!profile) return;
    const admin = !!profile.is_admin;
    // profiles.name est le nom de saison : il corrige un nom de session mal
    // formé (profil pas lu à la connexion, réseau lent → identifiant brut).
    const nom = account?.name ?? profile.name ?? session.name;
    const enAttente = !(await estValide(user.id));
    if (session.admin !== admin || session.name !== nom || !!session.enAttente !== enAttente) {
      const { enAttente: _avant, ...reste } = session;
      void _avant;
      storeSession({ ...reste, admin, name: nom, ...(enAttente ? { enAttente: true } : {}) });
    }
  } catch {
    // Hors ligne : la session actuelle reste ce qu'elle est.
  }
}

/**
 * Suit la connexion Supabase : une connexion qui aboutit après le délai de
 * l'écran de connexion, un jeton rafraîchi ou perdu remettent la session à la
 * vérité sans attendre la prochaine ouverture de l'app. Renvoie l'arrêt.
 */
export function suivreSessionServeur(): () => void {
  const { data } = supabase().auth.onAuthStateChange((event) => {
    if (event !== "SIGNED_IN" && event !== "TOKEN_REFRESHED" && event !== "SIGNED_OUT") return;
    // Jamais d'appel Supabase dans ce rappel (il tient le verrou d'auth) :
    // on attend le tour suivant.
    setTimeout(() => void refreshSession(), 0);
  });
  return () => data.subscription.unsubscribe();
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  // Sans await : la session locale meurt tout de suite, le serveur suit.
  // Portée « local » : seulement CET appareil. Par défaut Supabase ferme
  // toutes les sessions du compte, partout : un joueur qui touchait « Me
  // reconnecter » dans Snapchat déconnectait son app installée, qui
  // affichait à son tour le bandeau « Connexion non vérifiée »… et ainsi de
  // suite (journaux d'auth du 21/10 : /logout suivi de « Session not found »
  // et « Refresh Token Not Found » sur l'autre appareil).
  supabase()
    .auth.signOut({ scope: "local" })
    .catch(() => {});
  emit();
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    // Un compte créé en cours de saison n'est pas dans la table embarquée :
    // sa session, vérifiée par le serveur, reste parfaitement valable.
    return findAccount(s.user) || s.server ? s : null;
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

  // Hors connexion vérifiée, on ne change plus le mot de passe : un mot de
  // passe changé sur l'appareil seulement est celui que le serveur refuse
  // ensuite, et la personne se retrouve coupée de la ligue sans le savoir.
  return { ok: false, reason: "unavailable" };
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
 * Après une connexion serveur : journalise l'événement (une fois l'accord à
 * la politique de confidentialité connu et donné, comme tout le journal
 * d'usage) et capture l'email réel du joueur (celui de son identité
 * Google/Apple s'il en a lié une). Fire-and-forget : jamais bloquant.
 */
function afterServerSignIn(userId: string, nom: string) {
  const sb = supabase();
  accordConnu(nom)
    .then((ok) => (ok ? sb.from("activity").insert({ player_id: userId, kind: "login" }) : null))
    .then(undefined, () => {});
  sb.auth
    .getUser()
    .then(async ({ data }) => {
      const identities = data.user?.identities ?? [];
      const oauthEmail = identities.find(
        (i) => i.provider !== "email" && i.identity_data?.email
      )?.identity_data?.email as string | undefined;
      if (!oauthEmail) return;
      // Seulement s'il n'en a pas encore donné un. L'email est rangé à part
      // (table contacts) : on y regarde, puis on l'écrit par profiles, que la
      // base range aussitôt.
      if (await emailDe(sb, userId)) return;
      await sb.from("profiles").update({ contact_email: oauthEmail }).eq("id", userId);
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
      .select("name, username, is_admin, pseudo_a_choisir")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.name) return false;
    // Arrivé par Google ou Apple sans avoir fini son inscription : pas encore
    // de session de ligue, l'écran d'inscription demande la suite.
    if (profile.pseudo_a_choisir) return false;

    const account = ACCOUNTS.find((a) => a.name === profile.name);
    const valide = await estValide(user.id);
    const session: Session = {
      user: account?.user ?? (profile.username as string | null)?.replace(/^@/, "") ?? profile.name.toLowerCase(),
      name: profile.name,
      admin: !!profile.is_admin,
      since: Date.now(),
      server: true,
      ...(valide ? {} : { enAttente: true }),
    };
    storeSession(session);
    afterServerSignIn(user.id, session.name);
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
    return await emailDe(supabase(), uid);
  } catch {
    return null;
  }
}

/* ────────────────── Inscription par Google / Apple ────────────────── */

export type Fournisseur = "google" | "apple";

/**
 * Les fournisseurs que Supabase a vraiment activés, et si les nouveaux
 * comptes y sont permis. Lu dans les réglages publics du projet
 * (/auth/v1/settings) : un bouton n'apparaît que quand l'admin a branché le
 * fournisseur, sans rien changer dans l'app.
 */
export async function fournisseursActifs(): Promise<{ actifs: Fournisseur[]; inscriptions: boolean }> {
  try {
    const r = await withTimeout(
      fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } }),
      5000
    );
    if (!r.ok) return { actifs: [], inscriptions: false };
    const d = (await r.json()) as { external?: Record<string, boolean>; disable_signup?: boolean };
    return {
      actifs: (["apple", "google"] as const).filter((p) => d.external?.[p]),
      inscriptions: !d.disable_signup,
    };
  } catch {
    return { actifs: [], inscriptions: false };
  }
}

/**
 * Le refus rapporté par Supabase au retour du fournisseur (dans l'adresse),
 * en clair. null si rien n'a été refusé.
 */
export function refusAuRetour(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(
    `${window.location.search.slice(1)}&${window.location.hash.replace(/^#/, "")}`
  );
  const code = params.get("error_code") ?? params.get("error");
  if (!code) return null;
  if (/signup/i.test(code + (params.get("error_description") ?? ""))) return "Les inscriptions sont fermées pour l'instant.";
  if (code === "access_denied") return null; // le joueur a fait demi-tour chez le fournisseur
  return "La connexion n'a pas abouti. Réessaie.";
}

/**
 * Part chez Google ou Apple ; on revient sur `retour` (même origine). Au
 * retour, un membre qui avait lié ce compte entre dans la ligue ; un nouveau
 * venu arrive sur l'inscription, où il choisit son pseudo.
 */
export async function connexionSociale(fournisseur: Fournisseur, retour = "/inscription"): Promise<string | null> {
  try {
    const { error } = await supabase().auth.signInWithOAuth({
      provider: fournisseur,
      options: { redirectTo: `${window.location.origin}${retour}` },
    });
    return error ? "Connexion impossible pour l'instant." : null;
  } catch {
    return "Pas de réseau. Réessaie dans un instant.";
  }
}

/** Le jeton de la session Supabase en cours, pour les routes serveur. */
export async function jetonServeur(): Promise<string | null> {
  try {
    const { data } = await supabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Revenu de Google ou Apple sans compte fini ? Renvoie le fournisseur, sinon
 * null. Sert à l'inscription (mode « sans mot de passe ») et à la porte
 * d'entrée (qui l'y renvoie).
 */
export async function inscriptionSocialeEnCours(): Promise<Fournisseur | null> {
  try {
    const { data } = await supabase().auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    const fournisseur = user.app_metadata?.provider as string | undefined;
    if (fournisseur !== "google" && fournisseur !== "apple") return null;
    const { data: profil } = await supabase()
      .from("profiles")
      .select("pseudo_a_choisir")
      .eq("id", user.id)
      .maybeSingle();
    return (profil as { pseudo_a_choisir?: boolean } | null)?.pseudo_a_choisir ? fournisseur : null;
  } catch {
    return null;
  }
}

/** Ferme la session Supabase (compte provisoire abandonné). */
export async function oublierSessionServeur(): Promise<void> {
  try {
    await supabase().auth.signOut({ scope: "local" });
  } catch {}
}
