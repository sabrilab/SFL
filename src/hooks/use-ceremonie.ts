"use client";

// Une cérémonie plein écran est ouverte (nouvelle-carte.tsx : le bilan des
// divisions, les nouvelles cartes) : les annonces discrètes de Ma carte (un
// palier du Passe, des XP S) attendent qu'elle se ferme. Contrôle visuel du
// 02/11 : à la révélation de 19 h, l'app ouverte, l'annonce des XP S tombait
// par-dessus « Nouvelle carte ». Un état du téléphone seulement, sans
// stockage.

import { useSyncExternalStore } from "react";

let ouverte = false;
const abonnes = new Set<() => void>();

/** La cérémonie s'ouvre (vrai) ou se ferme (faux). */
export function poserCeremonie(v: boolean): void {
  if (v === ouverte) return;
  ouverte = v;
  for (const f of abonnes) f();
}

/** Une cérémonie est-elle ouverte, à cet instant ? (Pour un minuteur qui tombe pendant.) */
export const ceremonieOuverte = () => ouverte;

function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

/** Une cérémonie est-elle ouverte ? Change à son ouverture et à sa fermeture. */
export function useCeremonieOuverte(): boolean {
  return useSyncExternalStore(abonner, ceremonieOuverte, () => false);
}
