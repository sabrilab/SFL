"use client";

import { useSyncExternalStore } from "react";
import { ACCORD_EVENT, accordDonne, accordRevision, monAccord, type Accord } from "@/lib/sfl/consentement";

function subscribe(onChange: () => void) {
  window.addEventListener(ACCORD_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(ACCORD_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * L'accord du joueur à la politique de confidentialité (lib/sfl/consentement).
 * `donne` : true, false, ou null tant qu'on ne sait pas (rendu serveur,
 * relecture en cours).
 */
export function useAccord(nom: string | null | undefined): { donne: boolean | null; accord: Accord | null } {
  const rev = useSyncExternalStore(subscribe, accordRevision, () => -1);
  if (rev < 0 || !nom) return { donne: null, accord: null };
  return { donne: accordDonne(nom), accord: monAccord(nom) };
}
