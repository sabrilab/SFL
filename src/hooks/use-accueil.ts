"use client";

import { useSyncExternalStore } from "react";
import { ACCUEIL_EVENT, etatAccueil, type EtatAccueil } from "@/lib/sfl/accueil";

function subscribe(onChange: () => void) {
  window.addEventListener(ACCUEIL_EVENT, onChange);
  return () => window.removeEventListener(ACCUEIL_EVENT, onChange);
}

/** L'état de l'accueil (lib/sfl/accueil) : null au rendu serveur, et tant que personne ne l'a regardé. */
export function useEtatAccueil(): EtatAccueil | null {
  return useSyncExternalStore(subscribe, etatAccueil, () => null);
}
