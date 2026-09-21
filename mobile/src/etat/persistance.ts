/**
 * La sauvegarde des feuilles de match — web (l'aperçu et `expo start --web`).
 *
 * Même interface que `persistance.native.ts`, sur localStorage. Le natif a sa
 * propre version parce qu'expo-sqlite ne se bundle pas côté web.
 */
import type { Feuille } from '@/donnees/feuille';
import type { Match } from '@/donnees/matchs';

/** Ce qui doit survivre à la fermeture de l'app. */
export interface Sauvegarde {
  feuilles: Record<string, Feuille>;
  /** Les matchs ouverts par l'utilisateur : sans eux, leurs feuilles n'auraient plus de sens. */
  matchsCrees: Match[];
}

const VIDE: Sauvegarde = { feuilles: {}, matchsCrees: [] };

const CLE = 'golder.sauvegarde.v2';

export function lire(): Sauvegarde {
  try {
    const brut = typeof localStorage !== 'undefined' ? localStorage.getItem(CLE) : null;
    return brut ? { ...VIDE, ...(JSON.parse(brut) as Partial<Sauvegarde>) } : VIDE;
  } catch {
    return VIDE;
  }
}

export function ecrire(sauvegarde: Sauvegarde) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(CLE, JSON.stringify(sauvegarde));
  } catch {
    // Stockage indisponible : la feuille vit en mémoire pour cette session.
  }
}
