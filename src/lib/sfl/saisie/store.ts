// Couche de stockage de la saison — volontairement isolée derrière une interface
// pour que le passage localStorage → Supabase ne touche ni au moteur ni à l'UI.
//
// Maquette : tout vit dans le localStorage du navigateur, initialisé depuis le
// seed (historique J1→J5). Demain : implémenter `SupabaseStore` avec la même
// interface `SaisieStore` et changer le seul export `saisieStore`.

import { SEED_ENTRIES, SEED_JOURNEES, SEED_ROSTER } from "./seed";
import type { Saison } from "./types";

const STORAGE_KEY = "sfl-saisie-v1";

/** Copie fraîche du seed (données initiales). */
export function seedSaison(): Saison {
  return {
    journees: structuredClone(SEED_JOURNEES),
    roster: structuredClone(SEED_ROSTER),
    entries: structuredClone(SEED_ENTRIES),
    // Convocation de démo pour la J6 — quelques réponses déjà arrivées.
    convocations: [
      {
        id: 1,
        jour: "Dimanche",
        date: "26 juillet",
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
  return typeof window !== "undefined" && !!window.localStorage;
}

export const localStorageStore: SaisieStore = {
  load() {
    if (!hasWindow()) return seedSaison();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedSaison();
    try {
      return migrate(JSON.parse(raw) as Saison);
    } catch {
      return seedSaison();
    }
  },
  save(saison) {
    if (!hasWindow()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saison));
  },
  reset() {
    const fresh = seedSaison();
    if (hasWindow()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  },
};

// Point de bascule unique le jour où Supabase arrive.
export const saisieStore: SaisieStore = localStorageStore;
