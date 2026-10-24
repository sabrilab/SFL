"use client";

// Ce que la Map montre en plus des matchs (Sabri, 24/10 : « On a trop de
// cartes […] ça cache la visibilité quand on veut vraiment jouer et trouver
// un match ») : les joueurs dans leur ville, et les terrains libres où ouvrir
// un match. Les deux se masquent depuis le menu de la Map
// (map/menu-map.tsx) ; le téléphone garde le choix d'une visite à l'autre.
// Sans stockage (navigation privée), il tient jusqu'à la fermeture de l'app.

import { useSyncExternalStore } from "react";

export interface CalquesMap {
  joueurs: boolean;
  terrains: boolean;
}

const CLE = "bola-map-calques";
const EVENEMENT = "bola-map-calques";
const TOUT: CalquesMap = { joueurs: true, terrains: true };

/** Le choix en mémoire ; undefined tant qu'il n'a pas été lu. */
let courant: CalquesMap | undefined;

function lire(): CalquesMap {
  if (courant === undefined) {
    try {
      const lu = JSON.parse(localStorage.getItem(CLE) ?? "{}") as Partial<CalquesMap>;
      courant = { joueurs: lu.joueurs !== false, terrains: lu.terrains !== false };
    } catch {
      courant = TOUT;
    }
  }
  return courant;
}

function abonner(onChange: () => void) {
  // Un autre onglet a choisi : on relit.
  const ailleurs = (e: StorageEvent) => {
    if (e.key !== CLE && e.key !== null) return;
    courant = undefined;
    onChange();
  };
  window.addEventListener(EVENEMENT, onChange);
  window.addEventListener("storage", ailleurs);
  return () => {
    window.removeEventListener(EVENEMENT, onChange);
    window.removeEventListener("storage", ailleurs);
  };
}

/** Ce que la Map montre : les joueurs, les terrains libres (tout, par défaut). */
export function useCalquesMap(): CalquesMap {
  return useSyncExternalStore(abonner, lire, () => TOUT);
}

/** Montrer ou masquer un calque : la Map suit. */
export function montrerCalque(calque: keyof CalquesMap, montre: boolean) {
  courant = { ...lire(), [calque]: montre };
  try {
    localStorage.setItem(CLE, JSON.stringify(courant));
  } catch {
    // Pas de stockage : le choix vit en mémoire.
  }
  window.dispatchEvent(new Event(EVENEMENT));
}
