"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import { badgeDeCarte, type BadgeCarte, type ChoixBadge } from "@/lib/sfl/badge-carte";
import { BADGE_EVENT, badgeChoisi, badgeRevision } from "@/lib/sfl/badges-choisis";

function subscribe(onChange: () => void) {
  window.addEventListener(BADGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(BADGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const rien = () => null;

/** Le choix d'un joueur (null : rien choisi, donc le meilleur), réévalué à chaque changement. */
export function useChoixBadge(nom: string): ChoixBadge | null {
  const getSnapshot = useCallback(() => badgeChoisi(nom), [nom]);
  return useSyncExternalStore(subscribe, getSnapshot, rien);
}

/** Le badge posé sur la carte d'un joueur, ou null si le coin reste vide. */
export function useBadgeCarte(nom: string): BadgeCarte | null {
  const { saison } = useSeason();
  const choix = useChoixBadge(nom);
  return useMemo(() => badgeDeCarte(saison, nom, choix), [saison, nom, choix]);
}

/** Un compteur qui change avec les choix de badge : de quoi recapturer les cartes 3D (les images 3D, elles, sont attendues par la capture). */
export function useBadgeRevision(): number {
  return useSyncExternalStore(subscribe, badgeRevision, () => 0);
}
