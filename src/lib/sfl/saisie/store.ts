// Couche de stockage de la saison — volontairement isolée derrière une interface
// pour que le passage localStorage → Supabase ne touche ni au moteur ni à l'UI.
//
// Maquette : tout vit dans le localStorage du navigateur, initialisé depuis le
// seed (historique J1→J5). Demain : implémenter `SupabaseStore` avec la même
// interface `SaisieStore` et changer le seul export `saisieStore`.

import { SEED_ENTRIES, SEED_JOURNEES, SEED_ROSTER } from "./seed";
import { appliquerMvpAuto } from "./mvp";
import { sansVitrine } from "../compte-vitrine";
import { bloquantsEcriture, nouveauxEcarts, type Ecart } from "./integrite";
import { proposerFinDesMatchs } from "../revelation";
import type { Saison } from "./types";

const STORAGE_KEY = "sfl-saisie-v1";
const SEED_VERSION_KEY = "sfl-saisie-seed";
// Posé dès la première sauvegarde d'un admin. Il marque une saison qui
// contient du travail humain — et qu'on n'écrase donc jamais tout seul.
const EDITED_KEY = "sfl-saisie-edite";

// Version du seed livré avec le code. On l'incrémente à chaque correction
// de données pour que les appareils qui ont une saison en cache repartent
// des données à jour.
//
// MAIS il ne remplace JAMAIS une saison éditée par un admin. Ce reset
// automatique a coûté cher : chaque déploiement qui incrémentait ce numéro
// effaçait en silence les feuilles de match saisies à la main, et les
// joueurs se retrouvaient avec moins de points qu'ils n'en avaient gagné.
// Une correction livrée ne vaut jamais la perte du travail de quelqu'un :
// pour repartir des données livrées, l'admin le demande explicitement
// (bouton « Réinitialiser » de l'espace admin).
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
  if (!s.archives) s.archives = [];
  if (!s.terrains) s.terrains = [];
  return s;
}

export interface OptionsSauvegarde {
  /** La journée en brouillon que ce geste jette exprès (« Jeter le brouillon »). */
  jeter?: number;
}

export interface SaisieStore {
  /** Charge la saison courante (seed si rien n'est encore stocké). */
  load(): Saison;
  /** Persiste la saison ; renvoie les écarts qui l'en ont empêché (vide : écrite). */
  save(saison: Saison, opts?: OptionsSauvegarde): Ecart[] | void;
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
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedSaison();
      // Seed plus récent que la copie locale : on repart des données livrées,
      // SAUF si cette copie porte des saisies — elles priment sur tout.
      const stored = Number(window.localStorage.getItem(SEED_VERSION_KEY) ?? 0);
      const editee = window.localStorage.getItem(EDITED_KEY) === "1";
      if (stored < SEED_VERSION && !editee) return this.reset();
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
    ecrire(EDITED_KEY, "1");
  },
  reset() {
    const fresh = seedSaison();
    if (hasWindow()) {
      ecrire(STORAGE_KEY, JSON.stringify(fresh));
      ecrire(SEED_VERSION_KEY, String(SEED_VERSION));
      // Repartir des données livrées, c'est repartir d'une saison non éditée.
      try {
        window.localStorage.removeItem(EDITED_KEY);
      } catch {
        /* stockage indisponible : sans importance ici */
      }
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
  // Elle vient de l'admin : elle vaut une saisie, et ne doit pas plus
  // qu'une autre être écrasée par un seed livré plus tard.
  ecrire(EDITED_KEY, "1");
}

// Le stockage local reste la mémoire de travail ; chaque sauvegarde part
// AUSSI vers la base quand l'appelant est un admin en session serveur (la
// synchro refuse silencieusement sinon). Import paresseux pour ne pas créer
// de cycle : sync.ts importe ce module.
//
// C'est aussi le seul chemin d'écriture : les MVP automatiques y sont posés,
// pour que la grille, les classements et la base lisent les mêmes lignes.
// Une écriture refusée (integrite.ts) : l'écran qui l'a tentée le montre sur
// l'objet en cause (detail : les écarts). Rien n'est écrit, rien ne part.
export const REFUS_EVENT = "sfl-saisie-refus";

export interface SaisieStoreSur extends Omit<SaisieStore, "save"> {
  save(saison: Saison, opts?: OptionsSauvegarde): Ecart[];
}

export const saisieStore: SaisieStoreSur = {
  load: () => localStorageStore.load(),
  save(input, opts = {}) {
    // Les lignes du compte vitrine ne vivent que sur son écran (compte-vitrine.ts).
    // La fin des matchs du jour, proposée à l'heure du téléphone (revelation.ts) :
    // la base la garde ou la corrige, puis ne la déplace plus. Une vue figée
    // (input.figee) est refusée plus bas (integrite.ts, I10).
    const saison = proposerFinDesMatchs(appliquerMvpAuto(sansVitrine(input)), new Date());
    // Une feuille saine (30/10, après les matchs 5 et 6 de la J3) : un doublon,
    // un membre qui ne joue pas, une deuxième journée pour un dimanche ou un
    // brouillon effacé par une saison filtrée ne s'écrivent pas.
    const refus = bloquantsEcriture(nouveauxEcarts(localStorageStore.load(), saison, opts));
    if (refus.length) {
      try {
        window.dispatchEvent(new CustomEvent(REFUS_EVENT, { detail: refus }));
      } catch {
        /* hors navigateur */
      }
      return refus;
    }
    localStorageStore.save(saison);
    void import("./sync").then((m) => m.pushSaison(saison)).catch(() => {});
    return [];
  },
  reset: () => localStorageStore.reset(),
};
