"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getBalance } from "@/lib/sfl/ballons";

// Solde de Ballons réactif : se met à jour dès qu'un crédit/débit est
// émis (événement "sfl-ballons"), y compris depuis un autre onglet.
export function useBallons(voter: string): number {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("sfl-ballons", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("sfl-ballons", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => getBalance(voter),
    () => 0
  );
}
