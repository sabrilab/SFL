"use client";

// Les blessures déclarées (lib/sfl/blessures.ts) : les charger, se déclarer
// blessé, se dire remis.
//
// En base (supabase/schema.sql, table blessures) : on n'écrit que par
// se_declarer_blesse(), qui pose le nom (mon_nom) et l'heure du serveur.
// Toute la ligue lit tout.
//
// Dans un aperçu (NEXT_PUBLIC_BOLA_ENV ≠ production), comme pour les pronos,
// la déclaration reste sur le téléphone : un essai ne doit jamais se lire
// dans la vraie ligue.

import { supabase } from "@/lib/supabase";
import type { Blessure } from "./blessures";

export const BLESSURES_EVENT = "sfl-blessures";
export const APERCU_BLESSURES = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";
const CLE_APERCU = "sfl-blessures-apercu";

let cache: Blessure[] = [];

const emit = () => window.dispatchEvent(new Event(BLESSURES_EVENT));

function lireApercu(): Blessure[] {
  if (!APERCU_BLESSURES) return [];
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_APERCU) ?? "[]");
    return Array.isArray(brut) ? (brut as Blessure[]) : [];
  } catch {
    return [];
  }
}

function ecrireApercu(liste: Blessure[]) {
  try {
    localStorage.setItem(CLE_APERCU, JSON.stringify(liste));
  } catch {
    /* stockage plein ou interdit : la déclaration vit le temps de la page */
  }
}

export function blessuresEnMemoire(): Blessure[] {
  return cache;
}

/** Charge les blessures que la base montre (et, dans un aperçu, celles du téléphone). */
export async function chargerBlessures(depuisLaBase: boolean): Promise<void> {
  let lignes: Blessure[] = [];
  if (depuisLaBase && !APERCU_BLESSURES) {
    const { data, error } = await supabase().from("blessures").select("saison, joueur, depuis, fin, le");
    if (error) throw error;
    lignes = (data ?? []) as Blessure[];
  }
  const apercu = lireApercu();
  const meme = (a: Blessure, b: Blessure) => a.saison === b.saison && a.joueur === b.joueur;
  cache = [...lignes.filter((l) => !apercu.some((a) => meme(a, l))), ...apercu];
  emit();
}

/**
 * Se déclarer blessé à partir de la journée `j` (la prochaine à jouer), ou
 * remis : la blessure en cours se ferme sur la journée d'avant `j`, ou
 * disparaît si aucune journée n'a été manquée. Même règle qu'en base.
 */
export async function declarerBlessure(saison: number, joueur: string, j: number, blesse: boolean): Promise<void> {
  let le = new Date().toISOString();
  if (!APERCU_BLESSURES) {
    const { data, error } = await supabase().rpc("se_declarer_blesse", { p_saison: saison, p_j: j, p_blesse: blesse });
    if (error) throw new Error("Pas enregistré. Reconnecte-toi, puis réessaie.");
    if (typeof data === "string") le = data;
  }
  const appliquer = (liste: Blessure[]): Blessure[] => {
    const ouverte = liste.find((b) => b.saison === saison && b.joueur === joueur && b.fin == null);
    if (blesse) return ouverte ? liste : [...liste.filter((b) => !(b.saison === saison && b.joueur === joueur && b.depuis === j)), { saison, joueur, depuis: j, fin: null, le }];
    if (!ouverte) return liste;
    const reste = liste.filter((b) => b !== ouverte);
    return j - 1 < ouverte.depuis ? reste : [...reste, { ...ouverte, fin: j - 1, le }];
  };
  if (APERCU_BLESSURES) ecrireApercu(appliquer(lireApercu()));
  cache = appliquer(cache);
  emit();
}
