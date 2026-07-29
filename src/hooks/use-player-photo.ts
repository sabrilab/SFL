"use client";

import { useCallback, useSyncExternalStore } from "react";
import { PHOTO_EVENT, photoSrc } from "@/lib/sfl/photos";

function subscribe(onChange: () => void) {
  window.addEventListener(PHOTO_EVENT, onChange);
  // `storage` couvre le cas d'un autre onglet de la même app.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PHOTO_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Source d'image d'un joueur, réévaluée dès qu'une photo change.
 *
 * Le stockage est un système extérieur à React : on s'y abonne plutôt que de
 * recopier son état dans un effet. L'instantané serveur renvoie toujours le
 * fichier statique, pour que le rendu serveur et l'hydratation concordent.
 */
export function usePlayerPhoto(name: string): string {
  const getSnapshot = useCallback(() => photoSrc(name), [name]);
  const getServerSnapshot = useCallback(() => `/players/${name}.png`, [name]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
