"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Une requête média, lue comme un état React — sans setState dans un effet.
 * Rend `false` au rendu serveur : le mobile est le cas par défaut, et
 * l'hydratation corrige aussitôt sur les grands écrans.
 *
 * Réservé à ce que le CSS ne sait pas faire : ici, la TAILLE d'une carte 3D,
 * qui est un nombre passé à three.js et non une classe. Tout ce qui peut être
 * fait en CSS doit rester en CSS.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Le palier « grand écran » du gabarit de page (cf. .shell dans globals.css). */
export const useGrandEcran = () => useMediaQuery("(min-width: 1024px)");
