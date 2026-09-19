/**
 * L'état partagé de l'app.
 *
 * Volontairement minuscule et sans dépendance : un store externe lu par
 * `useSyncExternalStore`. Les écrans et les feuilles natives sont des routes
 * distinctes — passer par un contexte obligerait à les imbriquer, ce que la
 * présentation en feuille rend inutilement compliqué.
 *
 * Demain : remplacer `lire()`/`ecrire()` par Supabase, l'interface ne bouge pas.
 */
import { useSyncExternalStore } from 'react';

import { MATCHS_INITIAUX, PHOTOS, type Match } from '@/donnees/matchs';
import { CONVOCATION, STATS_JOUEUR } from '@/donnees/ligue';

export type Reponse = 'present' | 'absent' | null;

interface Etat {
  matchs: Match[];
  rejoints: string[];
  reponse: Reponse;
  stats: { cle: string; nom: string; valeur: number }[];
  vitesseGagnee: boolean;
}

let etat: Etat = {
  matchs: MATCHS_INITIAUX,
  rejoints: [],
  reponse: null,
  stats: STATS_JOUEUR,
  vitesseGagnee: false,
};

const abonnes = new Set<() => void>();
const publier = () => abonnes.forEach((f) => f());

function poser(suite: Partial<Etat>) {
  etat = { ...etat, ...suite };
  publier();
}

export function useEtat(): Etat {
  return useSyncExternalStore(
    (f) => { abonnes.add(f); return () => abonnes.delete(f); },
    () => etat,
    () => etat,
  );
}

export const actions = {
  /** Rejoindre ou quitter un match — la place se libère vraiment. */
  basculerMatch(id: string) {
    const dedans = etat.rejoints.includes(id);
    poser({
      rejoints: dedans ? etat.rejoints.filter((x) => x !== id) : [...etat.rejoints, id],
      matchs: etat.matchs.map((m) =>
        m.id === id ? { ...m, pris: m.pris + (dedans ? -1 : 1) } : m),
    });
    return !dedans;
  },

  /** Ouvrir son propre match : on en devient l'hôte, et on y est inscrit. */
  ouvrirMatch(champs: { lieu: string; titre: string; heure: string; niveau: string }) {
    const id = String(Date.now());
    const jour = champs.titre === 'Ce soir' ? 'jour'
      : champs.titre === 'Samedi' || champs.titre === 'Dimanche' ? 'weekend' : 'semaine';
    const neuf: Match = {
      id, titre: champs.titre, heure: champs.heure, jour,
      lieu: champs.lieu || 'Terrain sans nom', loin: '400 m',
      places: 10, pris: 1, niveau: champs.niveau, sfl: false,
      photo: PHOTOS.mien, x: 44 + Math.random() * 14, y: 46 + Math.random() * 10,
      hote: 'Toi', init: 'TOI', hoteNote: 'Ton premier match organisé',
      prix: 'Gratuit', prixNote: 'terrain libre', seuls: 0, gens: [],
    };
    poser({ matchs: [neuf, ...etat.matchs], rejoints: [...etat.rejoints, id] });
    return id;
  },

  /** Répondre à la convocation de la journée — retoucher annule la réponse. */
  repondre(r: Exclude<Reponse, null>) {
    poser({ reponse: etat.reponse === r ? null : r });
  },

  /** Le test de réflexes ne fait gagner son point qu'une fois. */
  gagnerVitesse() {
    if (etat.vitesseGagnee) return false;
    poser({
      vitesseGagnee: true,
      stats: etat.stats.map((s) =>
        s.cle === 'VIT' ? { ...s, valeur: Math.min(99, s.valeur + 1) } : s),
    });
    return true;
  },
};

export function compteConvocation(reponse: Reponse) {
  const presents = CONVOCATION.presents.length + (reponse === 'present' ? 1 : 0);
  const absents = CONVOCATION.absents.length + (reponse === 'absent' ? 1 : 0);
  return { presents, absents, sansReponse: Math.max(0, CONVOCATION.total - presents - absents) };
}
