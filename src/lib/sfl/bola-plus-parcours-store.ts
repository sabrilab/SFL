"use client";

// Le parcours Bola Plus sur le téléphone (lib/sfl/bola-plus-parcours.ts), par
// compte. Jamais bloquant : un stockage refusé, et rien n'est retenu.

import { getSession } from "@/lib/sfl/auth/session";
import { avecCarte, avecEntree, avecFiche, avecTemps, lire, versMetadata, type Parcours, type Source } from "@/lib/sfl/bola-plus-parcours";
import { FIN_PREMIERS_JOUEURS } from "@/lib/sfl/compte-a-rebours";

const cle = (nom: string) => `bola-plus-parcours-${nom}`;
/** D'où l'on part vers la page : posé au toucher, lu à l'arrivée. */
const CLE_SOURCE = "bola-plus-source";

function changer(f: (p: Parcours) => Parcours) {
  try {
    const nom = getSession()?.name;
    if (!nom) return;
    const p = f(lire(localStorage.getItem(cle(nom)), new Date()));
    localStorage.setItem(cle(nom), JSON.stringify(p));
  } catch {
    /* jamais bloquant */
  }
}

/** Au toucher qui mène à la page (tuile, bandeau, écran du jour, convocation). */
export function partirDe(s: Source) {
  try {
    sessionStorage.setItem(CLE_SOURCE, s);
  } catch {}
}

/** À l'arrivée sur la page : une visite, et d'où. */
export function noterArrivee() {
  let s: Source = "direct";
  try {
    const lu = sessionStorage.getItem(CLE_SOURCE) as Source | null;
    if (lu) s = lu;
    sessionStorage.removeItem(CLE_SOURCE);
  } catch {}
  changer((p) => avecEntree(p, s));
}

export const noterFiche = (id: string) => changer((p) => avecFiche(p, id));
export const noterCarte = (i: number) => changer((p) => avecCarte(p, i));
export const noterTemps = (s: number) => changer((p) => avecTemps(p, s));

/** Le parcours de ce téléphone (pour l'admin, et pour le paiement). */
export function parcoursIci(): Parcours | null {
  try {
    const nom = getSession()?.name;
    return nom ? lire(localStorage.getItem(cle(nom)), new Date()) : null;
  } catch {
    return null;
  }
}

/** Les métadonnées qui partent avec « S'abonner ». */
export function metadataIci(): Record<string, string> | null {
  const p = parcoursIci();
  return p ? versMetadata(p, FIN_PREMIERS_JOUEURS - Date.now()) : null;
}
