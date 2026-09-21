/**
 * La sauvegarde des feuilles de match — iOS et Android.
 *
 * Un but marqué doit survivre à tout : l'app fermée, le téléphone redémarré.
 * On écrit à chaque changement dans le stockage clé-valeur d'expo-sqlite,
 * natif, synchrone et inclus dans Expo Go.
 *
 * Ce fichier n'existe que pour le natif : sur le web, Metro prend
 * `persistance.ts`, qui parle à localStorage. Importer expo-sqlite côté web
 * casserait le bundle — il y attend un worker WebAssembly qu'on n'a pas.
 *
 * Demain, Supabase : cette couche pousse aussi vers la base, les écrans ne
 * changent pas.
 */
import Storage from 'expo-sqlite/kv-store';

import type { Equipe } from '@/donnees/equipes';
import type { Feuille } from '@/donnees/feuille';
import type { Match } from '@/donnees/matchs';

/** Ce qui doit survivre à la fermeture de l'app. */
export interface Sauvegarde {
  feuilles: Record<string, Feuille>;
  /** Les matchs ouverts par l'utilisateur : sans eux, leurs feuilles n'auraient plus de sens. */
  matchsCrees: Match[];
  equipe: Equipe | null;
  amis: string[];
}

const VIDE: Sauvegarde = { feuilles: {}, matchsCrees: [], equipe: null, amis: [] };

const CLE = 'golder.sauvegarde.v2';

export function lire(): Sauvegarde {
  try {
    const brut = Storage.getItemSync(CLE);
    return brut ? { ...VIDE, ...(JSON.parse(brut) as Partial<Sauvegarde>) } : VIDE;
  } catch {
    return VIDE;
  }
}

export function ecrire(sauvegarde: Sauvegarde) {
  try {
    Storage.setItemSync(CLE, JSON.stringify(sauvegarde));
  } catch {
    // Ne jamais faire tomber une saisie pour un problème de stockage :
    // la feuille vit en mémoire, on réessaiera à la prochaine écriture.
  }
}
