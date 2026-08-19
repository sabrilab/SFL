"use client";

// Synchronisation de la saison — le stockage local devient un cache.
//
// La vérité vit dans la table `saison` (un document jsonb versionné) :
//   · POUSSER : chaque sauvegarde d'un admin en session serveur part en base
//     (saisieStore.save l'appelle) — corriger une journée corrige pour tous ;
//   · TIRER   : à l'ouverture puis en temps réel, chaque client compare la
//     version distante à la sienne et adopte la plus récente ;
//   · ARBITRER: un document bâti sur un seed plus ancien que celui embarqué
//     dans l'app est refusé — après un déploiement qui corrige les données,
//     le premier passage d'un admin re-pousse le seed corrigé.
//
// Tout est silencieux et non bloquant : sans session serveur, l'app reste
// exactement ce qu'elle était (stockage local seul).

import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/sfl/auth/session";
import { adoptSaison, CURRENT_SEED_VERSION } from "./store";
import type { Saison } from "./types";

// Même canal d'événement que SeasonProvider (littéral pour éviter le cycle
// d'imports : season-provider importe store, qui importe ce module).
const SAISIE_EVENT = "sfl-saisie";
const VERSION_KEY = "sfl-saison-remote-version";

// Une sauvegarde qui n'a pas atteint la base laisse une marque. Sans elle,
// l'envoi raté était perdu pour de bon : il fallait que quelqu'un pense à
// rouvrir l'espace admin et à presser « Publier ». Avec elle, l'app rattrape
// toute seule dès que la connexion au serveur revient.
const EN_ATTENTE_KEY = "sfl-saison-a-publier";

function marquerAPublier(oui: boolean) {
  try {
    if (oui) localStorage.setItem(EN_ATTENTE_KEY, "1");
    else localStorage.removeItem(EN_ATTENTE_KEY);
  } catch {
    /* stockage indisponible */
  }
}

export function publicationEnAttente(): boolean {
  try {
    return localStorage.getItem(EN_ATTENTE_KEY) === "1";
  } catch {
    return false;
  }
}

function localVersion(): number {
  const n = parseInt(localStorage.getItem(VERSION_KEY) ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Le document distant doit-il remplacer la copie locale ? PUR, testable :
 * plus récent que ce qu'on a déjà adopté, et bâti sur un seed au moins aussi
 * neuf que celui de l'app (sinon il ferait reculer des corrections livrées).
 */
export function accepteRemote(
  remoteSeed: number,
  remoteVersion: number,
  versionLocale: number,
  seedApp: number = CURRENT_SEED_VERSION
): boolean {
  return remoteSeed >= seedApp && remoteVersion > versionLocale;
}

/**
 * Tire la saison distante et l'adopte si elle est plus récente.
 *
 * SAUF si cet appareil porte une saisie qui n'a pas encore été publiée :
 * adopter écraserait un travail que personne d'autre n'a. Une journée saisie
 * hors ligne serait effacée par la version de la base au premier retour du
 * réseau — la perte la plus bête qui soit. On la laisse tranquille ; c'est
 * elle qui partira en base au rattrapage.
 */
export async function pullSaison(): Promise<boolean> {
  const session = getSession();
  if (!session?.server) return false;
  if (publicationEnAttente()) return false;
  try {
    const { data, error } = await supabase()
      .from("saison")
      .select("data, version, seed")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return false;
    const doc = data as { data: Saison; version: number; seed: number };
    if (!accepteRemote(doc.seed, doc.version, localVersion())) return false;
    adoptSaison(doc.data);
    localStorage.setItem(VERSION_KEY, String(doc.version));
    window.dispatchEvent(new Event(SAISIE_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** Issue d'une synchronisation — le motif sert à l'afficher tel quel. */
export type Resultat = { ok: true } | { ok: false; raison: string };

/** Date de la dernière publication réussie, pour l'afficher à l'admin. */
const PUBLIE_KEY = "sfl-saison-publiee-le";

export function dernierePublication(): number | null {
  try {
    const n = Number(localStorage.getItem(PUBLIE_KEY) ?? 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Pourquoi la publication est impossible — null si elle l'est. */
export function blocage(): string | null {
  const session = getSession();
  if (!session) return "Personne n'est connecté sur cet appareil.";
  if (!session.server)
    return "Ta session n'est pas vérifiée par le serveur. Déconnecte-toi puis reconnecte-toi.";
  if (!session.admin) return "Ce compte n'est pas administrateur.";
  return null;
}

/**
 * Pousse la saison en base — admin en session serveur uniquement, refus
 * silencieux sinon (c'est ce qui permet à saisieStore.save de l'appeler sans
 * réfléchir). Écriture document entier : la dernière sauvegarde gagne.
 *
 * Renvoie le MOTIF de l'échec : « ça n'a pas marché » sans dire pourquoi
 * laisse l'admin sans rien à faire, et c'est exactement la situation où il a
 * besoin d'agir.
 */
export async function publierSaison(saison: Saison): Promise<Resultat> {
  const empeche = blocage();
  if (empeche) return { ok: false, raison: empeche };
  try {
    const version = Date.now();
    const { error } = await supabase().from("saison").upsert(
      {
        id: 1,
        data: saison,
        version,
        seed: CURRENT_SEED_VERSION,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      const manque = /relation .*saison.* does not exist|schema cache/i.test(error.message);
      return {
        ok: false,
        raison: manque
          ? "La table « saison » n'existe pas encore en base. Passe une fois par Réglages → Installation Supabase."
          : error.message,
      };
    }
    // Se souvenir de sa propre version : l'écho temps réel ne re-adoptera pas
    // ce qu'on vient d'écrire.
    localStorage.setItem(VERSION_KEY, String(version));
    localStorage.setItem(PUBLIE_KEY, String(version));
    return { ok: true };
  } catch (e) {
    return { ok: false, raison: e instanceof Error ? e.message : "Base injoignable." };
  }
}

/* --------------------- Mémoire du dernier envoi auto --------------------- */
//
// Chaque sauvegarde de l'admin part en base toute seule, sans rien attendre.
// C'était une bonne idée avec un défaut grave : l'échec était avalé. On
// enregistrait sa journée, le localStorage la gardait, la base ne la voyait
// jamais, et l'écran affichait la même chose dans les deux cas. On garde donc
// l'issue du dernier envoi, et l'espace admin l'affiche.

export const SYNC_EVENT = "sfl-synchro";

export interface EnvoiAuto {
  at: number;
  ok: boolean;
  raison?: string;
}

let dernier: EnvoiAuto | null = null;

export function dernierEnvoiAuto(): EnvoiAuto | null {
  return dernier;
}

/** Envoi automatique — appelé par saisieStore.save à chaque sauvegarde. */
export async function pushSaison(saison: Saison): Promise<boolean> {
  const r = await publierSaison(saison);
  dernier = { at: Date.now(), ok: r.ok, ...(r.ok ? {} : { raison: r.raison }) };
  marquerAPublier(!r.ok);
  try {
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    /* hors navigateur */
  }
  return r.ok;
}

/**
 * Rattrape une sauvegarde restée en local. Appelée à l'ouverture de l'app et
 * à chaque changement de session : dès qu'un admin retrouve une session
 * serveur, ce qu'il avait saisi hors ligne part enfin.
 */
export async function rattraperPublication(): Promise<boolean> {
  if (!publicationEnAttente()) return false;
  if (blocage()) return false;
  const { saisieStore } = await import("./store");
  return pushSaison(saisieStore.load());
}

/* ------------------------------ Diagnostic ------------------------------ */

export interface Etape {
  titre: string;
  ok: boolean;
  detail: string;
}

/**
 * Remonte la chaîne complète, maillon par maillon, et dit lequel casse.
 * C'est la réponse à « pourquoi ça ne se publie pas ? » — une question à
 * laquelle personne ne pouvait répondre depuis un téléphone.
 */
export async function diagnostic(): Promise<Etape[]> {
  const etapes: Etape[] = [];
  const session = getSession();

  etapes.push(
    session
      ? { titre: "Session sur cet appareil", ok: true, detail: `Connecté comme ${session.name}.` }
      : { titre: "Session sur cet appareil", ok: false, detail: "Personne n'est connecté." }
  );
  if (!session) return etapes;

  etapes.push({
    titre: "Vérifiée par le serveur",
    ok: !!session.server,
    detail: session.server
      ? "Ta connexion a été validée par Supabase."
      : "Connexion validée sur l'appareil seulement — c'est ce qui empêche toute écriture en base. Déconnecte-toi puis reconnecte-toi.",
  });

  let uid: string | null = null;
  try {
    const { data, error } = await supabase().auth.getUser();
    uid = data.user?.id ?? null;
    etapes.push({
      titre: "Compte Supabase",
      ok: !!uid,
      detail: uid
        ? "Le serveur reconnaît ta session."
        : `Aucune session Supabase active${error ? ` (${error.message})` : ""}. Le compte existe-t-il ? Sinon, passe par Réglages → Installation Supabase.`,
    });
  } catch (e) {
    etapes.push({
      titre: "Compte Supabase",
      ok: false,
      detail: `Base injoignable : ${e instanceof Error ? e.message : "réseau"}.`,
    });
    return etapes;
  }
  if (!uid) return etapes;

  try {
    const { data, error } = await supabase()
      .from("profiles")
      .select("name, is_admin")
      .eq("id", uid)
      .maybeSingle();
    const prof = data as { name: string; is_admin: boolean } | null;
    etapes.push({
      titre: "Rôle administrateur en base",
      ok: !!prof?.is_admin,
      detail: !prof
        ? `Aucun profil en base pour ce compte${error ? ` (${error.message})` : ""}.`
        : prof.is_admin
          ? `« ${prof.name} » est administrateur.`
          : `« ${prof.name} » n'est pas administrateur en base : les règles de sécurité refusent l'écriture.`,
    });
  } catch (e) {
    etapes.push({
      titre: "Rôle administrateur en base",
      ok: false,
      detail: e instanceof Error ? e.message : "Lecture impossible.",
    });
  }

  try {
    const { data, error } = await supabase()
      .from("saison")
      .select("version, seed, updated_at")
      .eq("id", 1)
      .maybeSingle();
    const doc = data as { version: number; updated_at: string } | null;
    etapes.push({
      titre: "Table de la saison",
      ok: !error,
      detail: error
        ? `Illisible : ${error.message}`
        : doc
          ? `Dernière version en base : ${new Date(doc.updated_at).toLocaleString("fr-FR")}.`
          : "La table existe mais ne contient encore aucune saison.",
    });
  } catch (e) {
    etapes.push({
      titre: "Table de la saison",
      ok: false,
      detail: e instanceof Error ? e.message : "Lecture impossible.",
    });
  }

  return etapes;
}

/**
 * Reprend la version en base, quoi qu'il arrive localement. C'est la sortie
 * de secours quand une saisie a dérapé : on ne répare pas à la main, on
 * revient à ce que la ligue voit.
 */
export async function reprendreDeLaBase(): Promise<Resultat> {
  const session = getSession();
  if (!session?.server) return { ok: false, raison: "Session serveur requise." };
  try {
    const { data, error } = await supabase()
      .from("saison")
      .select("data, version, seed")
      .eq("id", 1)
      .maybeSingle();
    if (error) return { ok: false, raison: error.message };
    if (!data) return { ok: false, raison: "Aucune saison en base pour l'instant." };
    const doc = data as { data: Saison; version: number; seed: number };
    adoptSaison(doc.data);
    localStorage.setItem(VERSION_KEY, String(doc.version));
    window.dispatchEvent(new Event(SAISIE_EVENT));
    return { ok: true };
  } catch (e) {
    return { ok: false, raison: e instanceof Error ? e.message : "Base injoignable." };
  }
}

/**
 * S'assure que la base PORTE une saison à jour — admin en session serveur
 * uniquement. Si la table est vide (installation neuve) ou bâtie sur un seed
 * plus ancien que celui de l'app (déploiement correctif), la copie locale de
 * l'admin part en base sans qu'il ait rien à presser : ouvrir l'app suffit.
 */
export async function ensureRemoteSaison(): Promise<void> {
  const session = getSession();
  if (!session?.server || !session.admin) return;
  try {
    const { data, error } = await supabase()
      .from("saison")
      .select("version, seed")
      .eq("id", 1)
      .maybeSingle();
    if (error) return;
    const doc = data as { version: number; seed: number } | null;
    if (!doc || doc.seed < CURRENT_SEED_VERSION) {
      const { saisieStore } = await import("./store");
      await pushSaison(saisieStore.load());
    }
  } catch {
    // Base injoignable : le prochain passage réessaiera.
  }
}

/**
 * Démarre la synchro : un tirage immédiat, puis le temps réel sur la table.
 * Renvoie la fonction d'arrêt. Sans session serveur : ne fait rien.
 */
// Compteur de noms de canaux : redemander un nom déjà pris renvoie le canal
// existant, déjà souscrit, et son `.on()` lève. Le redémarrage de la synchro
// (événement sfl-session) recréait « sfl-saison » avant que l'ancien soit
// vraiment retiré — chaque démarrage reçoit donc son propre nom.
let saisonSeq = 0;

export function startSaisonSync(): () => void {
  const session = getSession();
  if (!session?.server) return () => {};

  // Tirer d'abord (adopter le plus récent), puis garantir que la base est
  // peuplée — l'ordre évite d'écraser une base plus fraîche que soi.
  void pullSaison()
    .then(() => ensureRemoteSaison())
    // Puis on rattrape ce qui n'était jamais parti.
    .then(() => rattraperPublication());
  try {
    const sb = supabase();
    const channel = sb
      .channel(`sfl-saison-${++saisonSeq}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "saison" }, () => {
        void pullSaison();
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}
