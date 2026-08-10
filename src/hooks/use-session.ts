"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getSession, SESSION_EVENT, type Session } from "@/lib/sfl/auth/session";

// La session vit en localStorage, un système extérieur à React : on s'y abonne
// plutôt que d'en recopier l'état dans un effet. L'instantané serveur est
// toujours `null` pour que rendu serveur et hydratation concordent.
let cached: string | null = null;
let parsed: Session | null = null;

function snapshot(): Session | null {
  const raw = typeof window === "undefined" ? null : localStorage.getItem("sfl-session");
  if (raw !== cached) {
    cached = raw;
    parsed = getSession();
  }
  return parsed;
}

export function useSession(): Session | null {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(SESSION_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(SESSION_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
