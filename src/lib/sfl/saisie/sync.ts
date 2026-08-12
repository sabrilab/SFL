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

/** Tire la saison distante et l'adopte si elle est plus récente. */
export async function pullSaison(): Promise<boolean> {
  const session = getSession();
  if (!session?.server) return false;
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

/**
 * Pousse la saison en base — admin en session serveur uniquement, refus
 * silencieux sinon (c'est ce qui permet à saisieStore.save de l'appeler sans
 * réfléchir). Écriture document entier : la dernière sauvegarde gagne.
 */
export async function pushSaison(saison: Saison): Promise<boolean> {
  const session = getSession();
  if (!session?.server || !session.admin) return false;
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
    if (error) return false;
    // Se souvenir de sa propre version : l'écho temps réel ne re-adoptera pas
    // ce qu'on vient d'écrire.
    localStorage.setItem(VERSION_KEY, String(version));
    return true;
  } catch {
    return false;
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

  void pullSaison();
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
