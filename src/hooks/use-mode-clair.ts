"use client";

import { useTheme } from "next-themes";
import { useIsClient } from "./use-is-client";

/**
 * L'app est-elle en clair ? Choisi dans les réglages, ou « Auto » sur un
 * téléphone réglé en clair. Toujours faux avant l'hydratation, comme le
 * rendu serveur, qui sert le sombre (le thème par défaut).
 */
export function useModeClair(): boolean {
  const { resolvedTheme } = useTheme();
  const isClient = useIsClient();
  return isClient && resolvedTheme === "light";
}
