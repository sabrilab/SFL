"use client";

// L'accord de chaque joueur à la politique de confidentialité — la case de
// l'ouverture (components/sfl/confidentialite/consentement.tsx) et celle de
// l'inscription.
//
// La preuve vit côté serveur, dans la table consentements : une ligne par
// accord, datée par la base, jamais réécrite (supabase/schema.sql). Ce module
// en garde une copie sur le téléphone, par nom de joueur, pour ne pas voiler
// l'app à chaque ouverture ni attendre le réseau :
//   · au lancement, la ligne la plus récente du joueur est relue ; tant
//     qu'elle n'est pas revenue, on ne sait pas (accordDonne → null) et la
//     case ne s'affiche pas, pour ne pas la montrer à qui a déjà accepté sur
//     un autre téléphone ;
//   · un accord donné hors ligne, sans session serveur, ou avant que la base
//     ait la table (aperçus Vercel), reste « en attente » ici et part à la
//     prochaine ouverture avec une session.
// Un nouvel accord porte la version en vigueur (VERSION_POLITIQUE) ; un accord
// vaut tant que sa version n'est pas plus ancienne que VERSION_ACCEPTEE :
// quand celle-ci monte, la case revient.

import { supabase } from "@/lib/supabase";
import { VERSION_POLITIQUE, accordValable, ageDe } from "./confidentialite";

const CACHE_KEY = "bola-accord";
/** Émis quand un accord change ou revient du serveur. */
export const ACCORD_EVENT = "bola-accord";

export type OuAccord = "ouverture" | "inscription" | "reglages";

export interface Accord {
  /** La version acceptée (sa date). */
  version: string;
  /** Quand, en ISO : l'heure du serveur une fois enregistré. */
  le: string;
  /** Sa carte et sa photo dans les vidéos et posts de Bola, hors de l'app. */
  horsApp: boolean;
  /** Moins de 15 ans : un parent a donné son accord avec lui. */
  parent: boolean;
  /** Pas encore enregistré par le serveur. */
  enAttente?: boolean;
  /** Où il a coché, pour l'envoi en attente. */
  ou?: OuAccord;
}

type Cache = Record<string, Accord>;

const hasWindow = () => typeof window !== "undefined" && !!window.localStorage;

let cache: Cache | null = null;
let revision = 0;
/** Les joueurs dont l'accord a été relu (ou ne peut pas l'être) depuis le lancement. */
const relus = new Set<string>();
const enCours = new Map<string, Promise<void>>();

function lire(): Cache {
  if (cache) return cache;
  cache = {};
  if (hasWindow()) {
    try {
      const brut = window.localStorage.getItem(CACHE_KEY);
      if (brut) cache = JSON.parse(brut) as Cache;
    } catch {}
  }
  return cache;
}

function signaler() {
  revision++;
  if (hasWindow()) window.dispatchEvent(new Event(ACCORD_EVENT));
}

function ecrire(nom: string, accord: Accord | null) {
  const next = { ...lire() };
  if (accord) next[nom] = accord;
  else delete next[nom];
  cache = next;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {}
  signaler();
}

/** Change à chaque mise à jour, pour les hooks. */
export function accordRevision(): number {
  lire();
  return revision;
}

/** Le dernier accord connu du joueur, quelle que soit sa version. */
export function monAccord(nom: string): Accord | null {
  return lire()[nom] ?? null;
}

/**
 * true : accord donné à une version qui vaut encore (accordValable) ; false :
 * aucun, ou d'une version trop ancienne ; null : on ne sait pas encore
 * (relecture en cours).
 */
export function accordDonne(nom: string): boolean | null {
  if (accordValable(lire()[nom]?.version)) return true;
  return relus.has(nom) ? false : null;
}

/** La table n'existe pas encore : base pas migrée (aperçus Vercel). */
const sansTable = (code: string | undefined) => code === "42P01" || code === "PGRST205";

/** Envoie un accord à la base, sous la session du joueur. */
async function envoyer(accord: Accord, ou: OuAccord): Promise<{ le: string } | null> {
  const sb = supabase();
  const { data: auth } = await sb.auth.getSession();
  if (!auth.session) return null;
  const { data, error } = await sb
    .from("consentements")
    .insert({ version: accord.version, hors_app: accord.horsApp, parent: accord.parent, ou })
    .select("created_at")
    .single();
  if (error || !data) return null;
  return { le: (data as { created_at: string }).created_at };
}

/**
 * Relit l'accord du joueur connecté. `serveur` : sa session est vérifiée par
 * Supabase (sinon, rien à relire : la copie du téléphone fait foi).
 */
export function rafraichirAccord(nom: string, serveur: boolean): Promise<void> {
  if (!hasWindow()) return Promise.resolve();
  if (!serveur) {
    if (!relus.has(nom)) {
      relus.add(nom);
      signaler();
    }
    return Promise.resolve();
  }
  const deja = enCours.get(nom);
  if (deja) return deja;
  const p = (async () => {
    try {
      const sb = supabase();
      const { data: auth } = await sb.auth.getSession();
      const uid = auth.session?.user.id;
      if (!uid) return;
      const { data, error } = await sb
        .from("consentements")
        .select("version, hors_app, parent, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1);
      // Base pas migrée ou réseau absent : la copie du téléphone reste.
      if (error) return;
      const ligne = (data?.[0] ?? null) as { version: string; hors_app: boolean; parent: boolean; created_at: string } | null;
      const local = lire()[nom];
      // Un accord donné ici et pas encore parti, plus récent que le serveur : il part.
      const plusRecent =
        !!local?.enAttente &&
        local.version === VERSION_POLITIQUE &&
        (ligne?.version !== VERSION_POLITIQUE || Date.parse(local.le) > Date.parse(ligne.created_at));
      if (plusRecent) {
        const r = await envoyer(local, local.ou ?? "ouverture");
        if (r) ecrire(nom, { ...local, le: r.le, enAttente: false, ou: undefined });
        return;
      }
      if (ligne) {
        ecrire(nom, { version: ligne.version, le: ligne.created_at, horsApp: ligne.hors_app, parent: ligne.parent });
      } else if (local && !local.enAttente) {
        // Le serveur n'en a aucune trace : la case revient.
        ecrire(nom, null);
      }
    } catch {
      // Hors ligne : la copie du téléphone suffit.
    } finally {
      relus.add(nom);
      enCours.delete(nom);
      signaler();
    }
  })();
  enCours.set(nom, p);
  return p;
}

/**
 * Le joueur accepte la version en vigueur. L'app s'ouvre tout de suite ;
 * l'accord part à la base, ou attend la prochaine ouverture. Renvoie true
 * s'il est déjà enregistré par le serveur.
 */
export async function donnerAccord(
  nom: string,
  choix: { horsApp: boolean; parent: boolean; ou: OuAccord }
): Promise<boolean> {
  if (!hasWindow()) return false;
  const accord: Accord = {
    version: VERSION_POLITIQUE,
    le: new Date().toISOString(),
    horsApp: choix.horsApp,
    parent: choix.parent,
    enAttente: true,
    ou: choix.ou,
  };
  ecrire(nom, accord);
  relus.add(nom);
  try {
    const r = await envoyer(accord, choix.ou);
    if (!r) return false;
    ecrire(nom, { ...accord, le: r.le, enAttente: false, ou: undefined });
    return true;
  } catch {
    return false;
  }
}

/**
 * L'âge du joueur connecté, d'après sa fiche (lisible par lui seul et
 * l'admin) : sous AGE_ACCORD_PARENT, la case d'un parent s'ajoute. null sans
 * fiche ni date (comptes faits par l'admin), ou hors ligne.
 */
export async function monAge(): Promise<number | null> {
  try {
    const sb = supabase();
    const { data: auth } = await sb.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return null;
    const { data } = await sb.from("fiches").select("naissance").eq("player_id", uid).maybeSingle();
    return ageDe((data as { naissance: string | null } | null)?.naissance);
  } catch {
    return null;
  }
}

/**
 * Le journal d'usage attend l'accord (lib/sfl/activity.ts). Connu : tout de
 * suite ; pas encore relu (nouveau téléphone) : après la relecture.
 */
export async function accordConnu(nom: string): Promise<boolean> {
  const tout = accordDonne(nom);
  if (tout !== null) return tout;
  await rafraichirAccord(nom, true);
  return accordDonne(nom) === true;
}

/** Réglages : il change d'avis sur l'usage de sa carte hors de l'app. */
export async function changerHorsApp(nom: string, horsApp: boolean): Promise<boolean> {
  const actuel = lire()[nom];
  return donnerAccord(nom, { horsApp, parent: actuel?.parent ?? false, ou: "reglages" });
}

/** Pour les écrans qui lisent la table directement (admin) : la base a-t-elle la table ? */
export function erreurSansTable(code: string | undefined): boolean {
  return sansTable(code);
}
