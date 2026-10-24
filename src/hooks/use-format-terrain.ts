"use client";

// Le format des terrains qu'on veut voir (Sabri, 24/10 : « on fait
// actuellement du foot à 5 […] qu'on puisse filtrer facilement pour voir
// les terrains qui nous plaisent ») : à 3, 5, 7, 8 ou 11, ou tous. Choisi sur
// la Map (le bouton des terrains grisés) ou dans la feuille « Terrains du
// Nord », c'est le même aux deux endroits, et le téléphone le garde d'une
// visite à l'autre. Sans stockage (navigation privée), il tient jusqu'à la
// fermeture de l'app.

import { useSyncExternalStore } from "react";
import { FORMATS } from "@/lib/sfl/terrains-nord";

const CLE = "bola-format-terrain";
const EVENEMENT = "bola-format-terrain";

/** Le choix en mémoire ; undefined tant qu'il n'a pas été lu. */
let courant: number | null | undefined;

function lire(): number | null {
  if (courant === undefined) {
    try {
      const n = Number(localStorage.getItem(CLE));
      courant = (FORMATS as readonly number[]).includes(n) ? n : null;
    } catch {
      courant = null;
    }
  }
  return courant;
}

function abonner(onChange: () => void) {
  // Un autre onglet a choisi : on relit.
  const ailleurs = (e: StorageEvent) => {
    if (e.key !== CLE && e.key !== null) return;
    courant = undefined;
    onChange();
  };
  window.addEventListener(EVENEMENT, onChange);
  window.addEventListener("storage", ailleurs);
  return () => {
    window.removeEventListener(EVENEMENT, onChange);
    window.removeEventListener("storage", ailleurs);
  };
}

/** Le format choisi, en joueurs par équipe ; null : tous les terrains. */
export function useFormatTerrain(): number | null {
  return useSyncExternalStore(abonner, lire, () => null);
}

/** Choisir un format, ou null pour tous : la Map et la feuille suivent. */
export function choisirFormatTerrain(format: number | null) {
  courant = format;
  try {
    if (format == null) localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, String(format));
  } catch {
    // Pas de stockage : le choix vit en mémoire.
  }
  window.dispatchEvent(new Event(EVENEMENT));
}
