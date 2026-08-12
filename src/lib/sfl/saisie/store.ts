// Couche de stockage de la saison — volontairement isolée derrière une interface
// pour que le passage localStorage → Supabase ne touche ni au moteur ni à l'UI.
//
// Maquette : tout vit dans le localStorage du navigateur, initialisé depuis le
// seed (historique J1→J5). Demain : implémenter `SupabaseStore` avec la même
// interface `SaisieStore` et changer le seul export `saisieStore`.

import { SEED_ENTRIES, SEED_JOURNEES, SEED_ROSTER } from "./seed";
import type { Saison } from "./types";

const STORAGE_KEY = "sfl-saisie-v1";
const SEED_VERSION_KEY = "sfl-saisie-seed";

// Version du seed livré avec le code. Tant que la saisie admin n'est pas
// persistée côté serveur, le seed reste la source de vérité : à chaque
// journée ajoutée dans seed.ts, on incrémente ce numéro pour que les
// appareils qui ont déjà une saison en cache repartent des données à jour
// au lieu de rester bloqués sur l'ancienne.
const SEED_VERSION = 12;

/** Copie fraîche du seed (données initiales). */
export function seedSaison(): Saison {
  return {
    journees: structuredClone(SEED_JOURNEES),
    roster: structuredClone(SEED_ROSTER),
    entries: structuredClone(SEED_ENTRIES),
    // Convocation de démo pour la J9 — quelques réponses déjà arrivées.
    convocations: [
      {
        id: 1,
        jour: "Dimanche",
        date: "16 août",
        heure: "13h00",
        lieu: "Terrain extérieur — 5 vs 5",
        statut: "ouverte",
        reponses: { Ilies: "present", Kader: "present", Naim: "absent" },
      },
    ],
  };
}

/** Complète les champs apparus après une sauvegarde plus ancienne. */
function migrate(s: Saison): Saison {
  if (!s.convocations) s.convocations = [];
  return s;
}

export interface SaisieStore {
  /** Charge la saison courante (seed si rien n'est encore stocké). */
  load(): Saison;
  /** Persiste la saison. */
  save(saison: Saison): void;
  /** Réinitialise au seed et renvoie la copie. */
  reset(): Saison;
}

function hasWindow(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    // Safari « bloquer tous les cookies » : le simple accès lève une erreur.
    return false;
  }
}

/**
 * Écrit sans jamais lever.
 *
 * `load()` est appelé PENDANT le rendu (useMemo du provider de saison) et
 * peut avoir à réécrire le stockage. Si l'écriture échoue — quota dépassé,
 * stockage interdit par le navigateur — une exception à cet endroit fait
 * tomber l'app entière sur l'écran d'erreur. Or la saison est parfaitement
 * utilisable en mémoire : ne pas réussir à la mettre en cache n'est pas une
 * raison de refuser de l'afficher.
 */
function ecrire(cle: string, valeur: string): void {
  try {
    window.localStorage.setItem(cle, valeur);
  } catch {
    // Tant pis pour le cache : la saison vit en mémoire pour cette session.
  }
}

export const localStorageStore: SaisieStore = {
  load() {
    if (!hasWindow()) return seedSaison();
    try {
      // Seed plus récent que la copie locale : on repart des données livrées.
      const stored = Number(window.localStorage.getItem(SEED_VERSION_KEY) ?? 0);
      if (stored < SEED_VERSION) return this.reset();
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedSaison();
      return migrate(JSON.parse(raw) as Saison);
    } catch {
      // Stockage illisible, corrompu ou interdit : le seed reste jouable.
      return seedSaison();
    }
  },
  save(saison) {
    if (!hasWindow()) return;
    ecrire(STORAGE_KEY, JSON.stringify(saison));
    ecrire(SEED_VERSION_KEY, String(SEED_VERSION));
  },
  reset() {
    const fresh = seedSaison();
    if (hasWindow()) {
      ecrire(STORAGE_KEY, JSON.stringify(fresh));
      ecrire(SEED_VERSION_KEY, String(SEED_VERSION));
    }
    return fresh;
  },
};

/** Version du seed embarqué — la synchro s'en sert pour arbitrer. */
export const CURRENT_SEED_VERSION = SEED_VERSION;

/**
 * Adopte une saison venue de la base : elle remplace la copie locale et
 * marque le seed comme à jour (sinon load() croirait la copie périmée et la
 * réécraserait par le seed au prochain chargement).
 */
export function adoptSaison(saison: Saison) {
  if (!hasWindow()) return;
  ecrire(STORAGE_KEY, JSON.stringify(saison));
  ecrire(SEED_VERSION_KEY, String(SEED_VERSION));
}

// Le stockage local reste la mémoire de travail ; chaque sauvegarde part
// AUSSI vers la base quand l'appelant est un admin en session serveur (la
// synchro refuse silencieusement sinon). Import paresseux pour ne pas créer
// de cycle : sync.ts importe ce module.
export const saisieStore: SaisieStore = {
  load: () => localStorageStore.load(),
  save(saison) {
    localStorageStore.save(saison);
    void import("./sync").then((m) => m.pushSaison(saison)).catch(() => {});
  },
  reset: () => localStorageStore.reset(),
};
