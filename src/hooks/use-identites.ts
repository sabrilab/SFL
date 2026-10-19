"use client";

import { useSyncExternalStore } from "react";
import { username } from "@/lib/sfl/usernames";
import { IDENTITE_EVENT, identitesRevision, nomAffiche, pseudoAffiche } from "@/lib/sfl/identites";

function subscribe(onChange: () => void) {
  window.addEventListener(IDENTITE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(IDENTITE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const brut = { nom: (n: string) => n, pseudo: (n: string) => username(n) };
const affiches = { nom: nomAffiche, pseudo: pseudoAffiche };

/** Un compteur qui change avec les identités : de quoi recapturer les cartes 3D. */
export function useIdentitesRevision(): number {
  return useSyncExternalStore(subscribe, identitesRevision, () => -1);
}

/**
 * Le nom et le pseudo à afficher pour un joueur (clé = nom de saison). Au
 * rendu serveur et à l'hydratation : le nom de saison, pour que les deux
 * concordent ; la liste en cache prend le relais aussitôt après.
 */
export function useIdentites(): { nom: (n: string) => string; pseudo: (n: string) => string } {
  return useIdentitesRevision() < 0 ? brut : affiches;
}
