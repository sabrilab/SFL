"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import { badgeDeCarte, type BadgeCarte, type ChoixBadge } from "@/lib/sfl/badge-carte";
import { BADGE_EVENT, badgeChoisi, badgeRevision } from "@/lib/sfl/badges-choisis";
import { IMAGE_EVENT, imageRevision } from "@/lib/sfl/badges-3d/rendu";

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

function subscribeImages(onChange: () => void) {
  const off = subscribe(onChange);
  window.addEventListener(IMAGE_EVENT, onChange);
  return () => {
    off();
    window.removeEventListener(IMAGE_EVENT, onChange);
  };
}

const revisions = () => badgeRevision() * 100000 + imageRevision();

/** Un compteur qui change avec les choix de badge et les images 3D prêtes : de quoi recapturer les cartes 3D. */
export function useBadgeRevision(): number {
  return useSyncExternalStore(subscribeImages, revisions, () => 0);
}
