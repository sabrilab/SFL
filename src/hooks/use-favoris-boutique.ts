"use client";

// Les favoris de la boutique : la liste des pièces marquées d'un cœur, gardée
// sur l'appareil (localStorage), sans compte ni base. Changer de téléphone
// les perd : c'est dit à Sabri dans le compte rendu du 12/11/2026. Même forme
// que use-ballons.ts : un magasin externe, réveillé par un événement (et par
// « storage » pour un autre onglet).

import { useCallback, useSyncExternalStore } from "react";

const CLE = "bola-boutique-favoris-v1";
const EVENEMENT = "bola-favoris";
const AUCUN: string[] = [];

// useSyncExternalStore veut la même référence tant que rien n'a changé.
let brut: string | null = null;
let liste: string[] = AUCUN;

/** La liste gardée sur l'appareil ; un contenu abîmé (pas une liste, pas des textes) ne casse rien. */
export function lireFavoris(): string[] {
  let lu: string | null = null;
  try {
    lu = localStorage.getItem(CLE);
  } catch {
    // Stockage refusé (navigation privée stricte) : pas de favoris, rien de cassé.
  }
  if (lu === brut) return liste;
  brut = lu;
  try {
    const v: unknown = lu ? JSON.parse(lu) : [];
    liste = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : AUCUN;
  } catch {
    liste = AUCUN;
  }
  return liste;
}

export function basculerFavori(id: string) {
  const l = lireFavoris();
  const suite = l.includes(id) ? l.filter((x) => x !== id) : [...l, id];
  try {
    localStorage.setItem(CLE, JSON.stringify(suite));
  } catch {
    return;
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

/** Les ids des pièces en favori, dans l'ordre où elles ont été ajoutées. */
export function useFavorisBoutique(): string[] {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(EVENEMENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENEMENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return useSyncExternalStore(subscribe, lireFavoris, () => AUCUN);
}
