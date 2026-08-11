"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getBlueBalance } from "@/lib/sfl/ballons-bleus";

// Solde de Ballons bleus réactif — le miroir exact de useBallons, sur la
// seconde monnaie (événement "sfl-ballons-bleus", y compris cross-onglet).
export function useBallonsBleus(voter: string): number {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("sfl-ballons-bleus", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("sfl-ballons-bleus", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => getBlueBalance(voter),
    () => 0
  );
}
