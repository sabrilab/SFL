"use client";

import { useSyncExternalStore } from "react";
import { VILLES_EVENT, villesRevision } from "@/lib/sfl/villes";

function subscribe(onChange: () => void) {
  window.addEventListener(VILLES_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(VILLES_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Un compteur qui change avec les villes des joueurs (lib/sfl/villes) ; -1 au rendu serveur. */
export function useVillesRevision(): number {
  return useSyncExternalStore(subscribe, villesRevision, () => -1);
}
