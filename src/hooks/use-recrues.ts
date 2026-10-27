"use client";

// Les recrues de la ligue (lib/sfl/recrues-store.ts), chargées une fois pour
// toute l'app, relues au retour sur l'app et à l'ouverture d'Inviter
// (rechargerRecrues). À part de use-missions.ts, pour que le calcul de l'XP
// les lise sans boucle d'imports.

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { chargerRecrues, recruesEnMemoire, RECRUES_EVENT, type EtatRecrues } from "@/lib/sfl/recrues-store";

const VIDE: EtatRecrues = { ligue: [], miennes: [], complet: false, charge: false };
let abonnes = 0;
let base = false;

function abonner(onChange: () => void) {
  window.addEventListener(RECRUES_EVENT, onChange);
  return () => window.removeEventListener(RECRUES_EVENT, onChange);
}

/**
 * Relit les recrues (au retour sur l'app ; Inviter avec `numeroter`, qui pose
 * d'abord les nouveaux Fondateurs). Jamais bloquant.
 */
export function rechargerRecrues(numeroter = false): Promise<void> {
  return chargerRecrues(base, numeroter).catch(() => {
    /* base injoignable, ou fonctions pas encore en place : on garde ce qu'on a */
  });
}

function auRetour() {
  if (document.visibilityState === "visible") void rechargerRecrues();
}

function suivre(depuisLaBase: boolean): () => void {
  abonnes++;
  base = depuisLaBase;
  if (abonnes === 1) document.addEventListener("visibilitychange", auRetour);
  void rechargerRecrues();
  return () => {
    abonnes--;
    if (abonnes === 0) document.removeEventListener("visibilitychange", auRetour);
  };
}

/** Les recrues que l'app connaît : celles de la ligue, et les miennes. */
export function useRecrues(): EtatRecrues {
  const session = useSession();
  const depuisLaBase = !!session?.server;
  useEffect(() => suivre(depuisLaBase), [depuisLaBase]);
  return useSyncExternalStore(abonner, recruesEnMemoire, () => VIDE);
}
