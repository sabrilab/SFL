"use client";

// Session du joueur connecté — vérifiée par Supabase, et par lui seul.
//
// Le mot de passe est vérifié PAR LE SERVEUR (supabase.auth.signInWithPassword) :
// c'est lui qui fait foi, et le changement de mot de passe est global, pas lié
// à un appareil.
//
// Il y avait un repli local : les empreintes SHA-256 des mots de passe
// d'origine, embarquées dans l'app, ouvraient une session quand le serveur ne
// répondait pas. Ces empreintes partaient dans le code que reçoit chaque
// navigateur, et le dépôt public contenait les mots de passe eux-mêmes : le
// repli a disparu le 22/10/2026, avec les empreintes. Serveur injoignable =
// connexion impossible, on le dit et on réessaie.
//
// Chaque compte né d'un mot de passe d'origine ou provisoire doit en choisir
// un à lui (table mot_de_passe_a_changer) : la session le porte
// (motDePasseAChanger) et AuthGate retient le joueur sur l'écran « Nouveau
// mot de passe » tant que c'est à faire.

import { ACCOUNTS, findAccount } from "./accounts";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { loginEmail, supabase, SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase";
import { accordConnu } from "@/lib/sfl/consentement";
import { emailDe } from "@/lib/sfl/contacts";
import { BORNES } from "@/lib/sfl/inscription";

const SESSION_KEY = "sfl-session";
/** Ancien stockage des mots de passe changés sur l'appareil (repli local, retiré). */
const OVERRIDE_PREFIX = "sfl-pwd-";
export const SESSION_EVENT = "sfl-session";

export interface Session {
  user: string;
  name: string;
  admin: boolean;
  since: number;
  /**
   * true = vérifié par le serveur Supabase. false = session d'un ancien repli
   * local (il n'en naît plus) ou jeton perdu : rien de la ligue ne s'ouvre.
   */
  server?: boolean;
  /**
   * Pourquoi le serveur n'avait pas pris la connexion (anciennes sessions
   * locales seulement) : « mot-de-passe-local », « refuse », « injoignable ».
   */
  refus?: "mot-de-passe-local" | "refuse" | "injoignable";
  /**
   * true = compte créé par le joueur lui-même (/inscription), pas encore
   * accepté par l'admin. La base ne lui ouvre rien de la ligue : AuthGate lui
   * montre sa carte et l'écran d'attente à la place de l'app.
   */
  enAttente?: boolean;
  /**
   * Le compte doit choisir son mot de passe avant d'entrer : « origine » —
   * celui que la ligue distribuait, devenu public ; « provisoire » — donné par
   * l'admin à la création du compte ou après un oubli.
   */
  motDePasseAChanger?: "origine" | "provisoire";
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

/**
 * Le compte doit-il choisir son mot de passe ? Comme estValide, une erreur
 * de lecture (table pas encore migrée, réseau) répond « non » : elle ne doit
 * jamais enfermer un membre hors de l'app.
 */
async function motDePasseAChanger(uid: string): Promise<Session["motDePasseAChanger"]> {
  try {
    const r = await withTimeout(
      Promise.resolve(
        supabase().from("mot_de_passe_a_changer").select("motif").eq("user_id", uid).maybeSingle()
      ),
      5000
    );
    if (r.error || !r.data) return undefined;
    return (r.data as { motif?: string }).motif === "provisoire" ? "provisoire" : "origine";
  } catch {
    return undefined;
  }
}

/** La session, avec l'état du mot de passe tel que la base le dit. */
function avecMotDePasse(session: Session, motif: Session["motDePasseAChanger"]): Session {
  const { motDePasseAChanger: _avant, ...reste } = session;
  void _avant;
  return motif ? { ...reste, motDePasseAChanger: motif } : reste;
}

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: "bad-password" | "unavailable" };

/**
 * Borne une promesse dans le temps. Un projet Supabase en pause peut laisser
 * la requête pendre : sans ce garde-fou, l'écran de connexion resterait à
 * tourner indéfiniment.
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

export async function signIn(user: string, password: string): Promise<SignInResult> {
  // La table embarquée est figée à la compilation : un joueur ajouté à
  // l'effectif en cours de saison n'y figure pas. Elle ne sert qu'à retrouver
  // un identifiant et un nom canoniques — le serveur, lui, connaît tout le
  // monde.
  const account = findAccount(user);
  let identifiant = account?.user ?? user.trim().replace(/^@+/, "").toLowerCase();

  // 12 secondes maximum : mieux vaut attendre un peu un réseau lent (5G,
  // navigateur intégré de Snapchat ou d'Instagram) que d'abandonner.
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
      const motif = await motDePasseAChanger(data.user.id);
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
        ...(motif ? { motDePasseAChanger: motif } : {}),
      };
      storeSession(session);
      // Restes de l'ancien repli local : un mot de passe changé autrefois sur
      // cet appareil seulement. Le serveur fait foi, on les efface.
      try {
        localStorage.removeItem(`${OVERRIDE_PREFIX}${identifiant}`);
      } catch {}
      afterServerSignIn(data.user.id, session.name);
      return { ok: true, session };
    }
    // Le serveur n'a pas répondu (réseau) : c'est une panne, pas un refus.
    if (error && isAuthRetryableFetchError(error)) return { ok: false, reason: "unavailable" };
    return { ok: false, reason: "bad-password" };
  } catch {
    // Réseau coupé ou projet en pause.
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Rafraîchit la session depuis le serveur — appelée à chaque ouverture de
 * l'app et à chaque retour au premier plan. Le rôle admin vit dans la table
 * profiles : quand il change en base (migration, promotion), les sessions
 * déjà ouvertes doivent le voir sans que personne n'ait à se déconnecter.
 * Même chose pour le mot de passe à changer : une session ouverte depuis des
 * semaines passe sur l'écran « Nouveau mot de passe » à la prochaine
 * ouverture. Corrige aussi un nom de session hérité d'un ancien profil mal
 * formé.
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
      const motif = await motDePasseAChanger(user.id);
      storeSession(
        avecMotDePasse(
          { ...reste, admin: !!profile.is_admin, server: true, ...(attente ? { enAttente: true } : {}) },
          motif
        )
      );
      return;
    }

    if (!profile) return;
    const admin = !!profile.is_admin;
    // profiles.name est le nom de saison : il corrige un nom de session mal
    // formé (profil pas lu à la connexion, réseau lent → identifiant brut).
    const nom = account?.name ?? profile.name ?? session.name;
    const enAttente = !(await estValide(user.id));
    const motif = await motDePasseAChanger(user.id);
    if (
      session.admin !== admin ||
      session.name !== nom ||
      !!session.enAttente !== enAttente ||
      session.motDePasseAChanger !== motif
    ) {
      const { enAttente: _avant, ...reste } = session;
      void _avant;
      storeSession(avecMotDePasse({ ...reste, admin, name: nom, ...(enAttente ? { enAttente: true } : {}) }, motif));
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

export type RefusMotDePasse =
  /** Le mot de passe actuel tapé n'est pas le bon. */
  | "bad-password"
  /** Trop court (BORNES.motDePasse, comme à l'inscription). */
  | "too-short"
  /** L'identifiant ou le nom lui-même, ou refusé par Supabase comme trop faible. */
  | "weak"
  /** Le même que l'actuel : Supabase le refuse (et l'actuel doit changer). */
  | "same-password"
  /** Supabase veut d'abord le mot de passe actuel (session trop ancienne). */
  | "reauth"
  | "unavailable";

export type ResultatMotDePasse = { ok: true } | { ok: false; reason: RefusMotDePasse };

/** Les règles que l'app vérifie d'elle-même, avant tout appel. */
function refusLocal(next: string, session: Session): RefusMotDePasse | null {
  if (next.length < BORNES.motDePasse) return "too-short";
  const n = next.trim().toLowerCase();
  if (n === session.user.toLowerCase() || n === session.name.toLowerCase()) return "weak";
  return null;
}

/** L'adresse de connexion du compte ouvert (pas forcément celle de l'identifiant tapé). */
async function emailDuCompte(): Promise<string | null> {
  const { data } = await supabase().auth.getUser();
  return data.user?.email ?? null;
}

/** Revalide le mot de passe actuel : signInWithPassword ouvre une session fraîche. */
async function verifierActuel(current: string): Promise<RefusMotDePasse | null> {
  const email = await emailDuCompte();
  if (!email) return "unavailable";
  const { error } = await supabase().auth.signInWithPassword({ email, password: current });
  if (!error) return null;
  return isAuthRetryableFetchError(error) ? "unavailable" : "bad-password";
}

/**
 * Pose le nouveau mot de passe. Supabase refuse lui-même celui qui est
 * identique à l'actuel, et ferme les sessions du compte sur les autres
 * appareils (celle-ci reste ouverte).
 */
async function poser(next: string): Promise<ResultatMotDePasse> {
  const { error } = await supabase().auth.updateUser({ password: next });
  if (!error) return { ok: true };
  const code = (error as { code?: string }).code;
  if (code === "same_password") return { ok: false, reason: "same-password" };
  if (code === "weak_password") return { ok: false, reason: "weak" };
  if (code === "reauthentication_needed") return { ok: false, reason: "reauth" };
  return { ok: false, reason: "unavailable" };
}

/** Change le mot de passe depuis les réglages : l'actuel est redemandé. */
export async function changePassword(current: string, next: string): Promise<ResultatMotDePasse> {
  const session = getSession();
  // Hors connexion vérifiée, rien ne se change : la base ne connaît que le
  // mot de passe du serveur.
  if (!session?.server) return { ok: false, reason: "unavailable" };
  const local = refusLocal(next, session);
  if (local) return { ok: false, reason: local };
  try {
    const actuel = await verifierActuel(current);
    if (actuel) return { ok: false, reason: actuel };
    return await poser(next);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Le mot de passe que le joueur choisit quand il le DOIT (mot de passe
 * d'origine ou provisoire). La session ouverte prouve qui il est : l'actuel
 * n'est demandé que si Supabase l'exige (« reauth »), et alors `current`
 * le porte. La base efface d'elle-même la ligne mot_de_passe_a_changer dès
 * que le mot de passe a vraiment changé ; la session suit, et l'app s'ouvre.
 */
export async function choisirMotDePasse(next: string, current?: string): Promise<ResultatMotDePasse> {
  const session = getSession();
  if (!session?.server) return { ok: false, reason: "unavailable" };
  const local = refusLocal(next, session);
  if (local) return { ok: false, reason: local };
  try {
    if (current) {
      const actuel = await verifierActuel(current);
      if (actuel) return { ok: false, reason: actuel };
    }
    const r = await poser(next);
    if (!r.ok) return r;
    const { data } = await supabase().auth.getUser();
    const motif = data.user ? await motDePasseAChanger(data.user.id) : undefined;
    const apres = getSession();
    if (apres) storeSession(avecMotDePasse(apres, motif));
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
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
    const motif = await motDePasseAChanger(user.id);
    const session: Session = {
      user: account?.user ?? (profile.username as string | null)?.replace(/^@/, "") ?? profile.name.toLowerCase(),
      name: profile.name,
      admin: !!profile.is_admin,
      since: Date.now(),
      server: true,
      ...(valide ? {} : { enAttente: true }),
      ...(motif ? { motDePasseAChanger: motif } : {}),
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
