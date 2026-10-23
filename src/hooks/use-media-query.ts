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

/**
 * Le palier où la carte 3D d'un profil prend un cran de plus (√φ) : assez
 * large pour sa colonne (.shell à 1200 px), assez haut pour que la colonne
 * qui la porte tienne à l'écran dès l'ouverture, au-dessus de la barre
 * d'onglets (.colonne-fixe, globals.css). Un grand moniteur, pas un portable.
 */
export const useTresGrandEcran = () => useMediaQuery("(min-width: 1440px) and (min-height: 1200px)");
