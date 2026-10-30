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
//     le premier passage d'un admin re-pousse le seed corrigé ;
//   · NE PAS ÉCRASER : depuis le 22/10/2026, l'admin publie par la fonction
//     publier_saison en disant sur quelle version il a travaillé. Si un
//     autre admin a publié entre-temps, rien n'est écrit : il reprend la base
//     ou écrase en connaissance de cause. Avant, la dernière sauvegarde
//     gagnait, et un appareil resté sur une vieille copie effaçait les
//     journées saisies ailleurs (la J11 de la saison 0, le 17/10).
//
// Tout est silencieux et non bloquant : sans session serveur, l'app reste
// exactement ce qu'elle était (stockage local seul).

import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/sfl/auth/session";
import { adoptSaison, CURRENT_SEED_VERSION } from "./store";
import type { Saison } from "./types";
import { sansVitrine } from "../compte-vitrine";

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

const LECTURE_KEY = "sfl-saison-lecture";

function lectureLocale(): string | null {
  try {
    return localStorage.getItem(LECTURE_KEY);
  } catch {
    return null;
  }
}

function retenirLecture(l: "entiere" | "publique") {
  try {
    localStorage.setItem(LECTURE_KEY, l);
  } catch {
    /* stockage indisponible */
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
  // Un compte qui n'est pas admin ne publiera jamais ce qu'il garde : on le
  // libère (les téléphones déjà figés repartent de la base).
  if (publicationEnAttente() && !session.admin) marquerAPublier(false);
  if (publicationEnAttente()) return false;
  try {
    const doc = await lireDocument(!!session.admin);
    if (!doc) return false;
    // Un admin sur un appareil qui n'avait que la saison des joueurs (sans
    // brouillons) reprend le document entier, même à version égale.
    const lecture = session.admin ? "entiere" : "publique";
    const versionConnue = lectureLocale() === lecture ? localVersion() : 0;
    if (!accepteRemote(doc.seed, doc.version, versionConnue)) return false;
    retenirLecture(lecture);
    adoptSaison(doc.data);
    localStorage.setItem(VERSION_KEY, String(doc.version));
    window.dispatchEvent(new Event(SAISIE_EVENT));
    return true;
  } catch {
    return false;
  }
}

/**
 * Le document à adopter. L'admin lit le document entier, brouillons compris :
 * c'est là qu'il prépare. Un joueur lit la saison sans les journées en
 * brouillon (public.saison_publique, 30/10/2026) ; une base qui n'a pas
 * encore la fonction répond par l'ancienne lecture, que l'app filtre de
 * toute façon (SeasonProvider, sansBrouillons).
 */
async function lireDocument(admin: boolean): Promise<{ data: Saison; version: number; seed: number } | null> {
  if (!admin) {
    const { data, error } = await supabase().rpc("saison_publique");
    if (!error) {
      const ligne = (Array.isArray(data) ? data[0] : data) as { data: Saison; version: number; seed: number } | undefined;
      return ligne?.data ? ligne : null;
    }
    if (error.code !== "PGRST202" && error.code !== "42883") return null;
  }
  const { data, error } = await supabase().from("saison").select("data, version, seed").eq("id", 1).maybeSingle();
  if (error || !data) return null;
  return data as { data: Saison; version: number; seed: number };
}

/**
 * Issue d'une synchronisation — le motif sert à l'afficher tel quel.
 * `conflit` : la base a changé depuis la version sur laquelle cet appareil a
 * travaillé ; l'admin choisit entre reprendre la base et écraser.
 */
export type Resultat = { ok: true } | { ok: false; raison: string; conflit?: true; feuille?: string[] };

const PUBLIQUE = "Cet appareil n'a que la saison des joueurs, sans les brouillons. Reprends la base avant d'écrire.";

const CONFLIT =
  "Un autre admin a publié depuis ta dernière synchro. Reprends la base pour repartir de sa version, ou écrase-la avec la tienne.";

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
  // Un environnement de travail (poste de dev, tests de bout en bout) pointe
  // par défaut sur la base de la ligue : ce verrou empêche d'y écrire sans
  // changer de projet Supabase. La lecture et le temps réel restent actifs.
  if (process.env.NEXT_PUBLIC_SFL_LECTURE_SEULE === "1")
    return "Publication désactivée sur cet environnement (NEXT_PUBLIC_SFL_LECTURE_SEULE=1).";
  const session = getSession();
  if (!session) return "Personne n'est connecté sur cet appareil.";
  if (!session.server) {
    if (session.refus === "mot-de-passe-local")
      return "Ton mot de passe a été changé sur cet appareil seulement : le serveur ne le connaît pas. Déconnecte-toi, reconnecte-toi avec ton mot de passe d'origine (celui donné par l'admin), puis change-le dans Réglages : il vaudra partout.";
    if (session.refus === "refuse")
      return "Le serveur ne reconnaît pas ce mot de passe. Déconnecte-toi et reconnecte-toi avec ton mot de passe d'origine (celui donné par l'admin).";
    if (session.refus === "injoignable")
      return "Le serveur n'a pas répondu à la connexion. Déconnecte-toi puis reconnecte-toi quand le réseau revient.";
    return "Ta session n'est pas vérifiée par le serveur. Déconnecte-toi puis reconnecte-toi.";
  }
  if (!session.admin) return "Ce compte n'est pas administrateur.";
  return null;
}

/**
 * Pousse la saison en base — admin en session serveur uniquement, refus
 * silencieux sinon (c'est ce qui permet à saisieStore.save de l'appeler sans
 * réfléchir). Écriture document entier, mais jamais par-dessus une version
 * plus neuve que celle d'où part cet appareil, sauf `forcer`.
 *
 * Une publication à la fois : chaque sauvegarde publie, et deux envois partis
 * ensemble se gêneraient (le second, bâti sur la même version que le premier,
 * passerait pour un conflit). Chacun attend le précédent, puis repart de la
 * version que celui-ci a laissée.
 *
 * Renvoie le MOTIF de l'échec : « ça n'a pas marché » sans dire pourquoi
 * laisse l'admin sans rien à faire, et c'est exactement la situation où il a
 * besoin d'agir.
 */
export function publierSaison(input: Saison, { forcer = false } = {}): Promise<Resultat> {
  // Jamais les lignes du compte vitrine (compte-vitrine.ts) : elles ne vivent que sur son écran.
  const saison = sansVitrine(input);
  const tour = fileDePublication.then(() => publierMaintenant(saison, forcer));
  fileDePublication = tour.catch(() => {});
  return tour;
}

let fileDePublication: Promise<unknown> = Promise.resolve();

async function publierMaintenant(saison: Saison, forcer: boolean): Promise<Resultat> {
  const empeche = blocage();
  if (empeche) return { ok: false, raison: empeche };
  // Un appareil qui n'a lu que la saison des joueurs (saison_publique, sans
  // les brouillons) n'écrit jamais : son document effacerait en base les
  // journées en brouillon, à version égale. « Écraser » n'y peut rien ;
  // « Reprendre la base » relit le document entier.
  if (lectureLocale() === "publique") return { ok: false, raison: PUBLIQUE, conflit: true };
  try {
    const { data, error } = await supabase().rpc("publier_saison", {
      p_data: saison,
      p_seed: CURRENT_SEED_VERSION,
      p_base: localVersion(),
      p_forcer: forcer,
    });
    // La base n'a pas encore la fonction (un aperçu avant la migration) :
    // l'ancien envoi.
    if (error?.code === "PGRST202") return ecrireDocument(saison);
    // La base refuse une feuille malsaine (public.feuille_saine) : un joueur
    // en double, un membre qui ne joue pas, deux journées pour un dimanche.
    // « Écraser » n'y peut rien, c'est voulu.
    if (error?.hint === "feuille-saine")
      return { ok: false, raison: "Feuille refusée par la base.", feuille: (error.details ?? "").split("|").filter(Boolean) };
    if (error) return { ok: false, raison: motif(error.message) };
    const r = data as { ok: boolean; version: number };
    if (!r.ok) return { ok: false, raison: CONFLIT, conflit: true };
    retenir(r.version);
    return { ok: true };
  } catch (e) {
    return { ok: false, raison: e instanceof Error ? e.message : "Base injoignable." };
  }
}

/** L'écriture d'avant publier_saison : le document entier, la dernière gagne. */
async function ecrireDocument(saison: Saison): Promise<Resultat> {
  const version = Math.max(Date.now(), localVersion() + 1);
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
  if (error) return { ok: false, raison: motif(error.message) };
  retenir(version);
  return { ok: true };
}

function motif(message: string): string {
  return /relation .*saison.* does not exist|schema cache/i.test(message)
    ? "La table « saison » n'existe pas encore en base. Passe une fois par Réglages → Installation Supabase."
    : message;
}

/**
 * Se souvenir de sa propre version : l'écho temps réel ne re-adoptera pas ce
 * qu'on vient d'écrire, et la publication suivante partira d'elle. Plus rien
 * n'attend de partir : l'échec d'un envoi précédent est réparé.
 */
function retenir(version: number) {
  localStorage.setItem(VERSION_KEY, String(version));
  localStorage.setItem(PUBLIE_KEY, String(version));
  marquerAPublier(false);
  dernier = { at: Date.now(), ok: true };
  signalerEnvoi();
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
  conflit?: boolean;
  /** Les défauts que la base a refusés (« I1 J4 Ilyes »). */
  feuille?: string[];
}

let dernier: EnvoiAuto | null = null;

export function dernierEnvoiAuto(): EnvoiAuto | null {
  return dernier;
}

/** Envoi automatique — appelé par saisieStore.save à chaque sauvegarde. */
export async function pushSaison(saison: Saison, { forcer = false } = {}): Promise<boolean> {
  const r = await publierSaison(saison, { forcer });
  dernier = {
    at: Date.now(),
    ok: r.ok,
    ...(r.ok ? {} : { raison: r.raison, ...(r.conflit ? { conflit: true } : {}), ...(r.feuille ? { feuille: r.feuille } : {}) }),
  };
  // « À publier » fige le téléphone sur sa copie (pullSaison n'adopte plus
  // rien) : seulement pour un échec que CET appareil pourra rattraper, celui
  // d'un admin. Un joueur (une présence posée en local avant le chargement de
  // la convocation, par exemple) ne publiera jamais : il restait figé sur de
  // vieux classements jusqu'à « Reprendre la base » (27/10).
  marquerAPublier(!r.ok && !!getSession()?.admin);
  signalerEnvoi();
  return r.ok;
}

function signalerEnvoi() {
  try {
    window.dispatchEvent(new Event(SYNC_EVENT));
  } catch {
    /* hors navigateur */
  }
}

/**
 * Rattrape une sauvegarde restée en local. Appelée à l'ouverture de l'app et
 * à chaque changement de session : dès qu'un admin retrouve une session
 * serveur, ce qu'il avait saisi hors ligne part enfin.
 */
export async function rattraperPublication(): Promise<boolean> {
  if (!publicationEnAttente()) return false;
  if (!getSession()?.admin) {
    marquerAPublier(false);
    return false;
  }
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
      ? "Ta connexion a été validée par le serveur de la ligue."
      : "Connexion validée sur l'appareil seulement : tu ne vois pas les dernières données de la ligue et tes modifications ne partent pas. Déconnecte-toi puis reconnecte-toi.",
  });

  let uid: string | null = null;
  try {
    const { data } = await supabase().auth.getUser();
    uid = data.user?.id ?? null;
    etapes.push({
      titre: "Compte de la ligue",
      ok: !!uid,
      detail: uid
        ? "Le serveur reconnaît ta session."
        : "Le serveur de la ligue ne te reconnaît pas sur cet appareil. Déconnecte-toi et reconnecte-toi avec ton mot de passe d'origine.",
    });
  } catch (e) {
    etapes.push({
      titre: "Compte de la ligue",
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
    const doc = await lireDocument(!!session.admin);
    if (!doc) return { ok: false, raison: "Aucune saison lisible en base pour l'instant." };
    adoptSaison(doc.data);
    retenirLecture(session.admin ? "entiere" : "publique");
    localStorage.setItem(VERSION_KEY, String(doc.version));
    // Plus rien n'attend de partir : ce qui restait ici a été remplacé.
    marquerAPublier(false);
    dernier = null;
    signalerEnvoi();
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
 * C'est la seule publication forcée d'office : le seed livré fait foi.
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
      await pushSaison(saisieStore.load(), { forcer: true });
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
    // Un joueur suit aussi saison_signal (30/10/2026) : la seule version, qui
    // lui fait relire saison_publique. Le jour où la lecture brute lui est
    // fermée (L1b), c'est par là que le temps réel lui arrive.
    const channel = sb
      .channel(`sfl-saison-${++saisonSeq}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "saison" }, () => {
        void pullSaison();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "saison_signal" }, () => {
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
