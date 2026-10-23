"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { abonnerMaillots, demanderMaillot, photoAuMaillot, versionMaillots } from "@/lib/sfl/maillot-des-photos";
import type { Camp } from "@/lib/sfl/maillots";

/**
 * La photo d'un joueur dans le maillot de son camp (lib/sfl/maillot-des-photos.ts).
 * Sans camp, ou tant que la photo repeinte n'est pas prête, la photo elle-même :
 * la carte change d'image quand le calque a fini.
 */
export function usePhotoAuMaillot(photo: string | null, camp?: Camp): string | null {
  useEffect(() => {
    if (photo && camp) demanderMaillot(photo, camp);
  }, [photo, camp]);
  const getSnapshot = useCallback(
    () => (photo && camp ? (photoAuMaillot(photo, camp) ?? photo) : photo),
    [photo, camp],
  );
  const getServerSnapshot = useCallback(() => photo, [photo]);
  return useSyncExternalStore(abonnerMaillots, getSnapshot, getServerSnapshot);
}

/** Un compteur qui change avec chaque photo repeinte prête : de quoi reprendre une image partagée. */
export function useVersionMaillots(): number {
  return useSyncExternalStore(abonnerMaillots, versionMaillots, () => 0);
}
