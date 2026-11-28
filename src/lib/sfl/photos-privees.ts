"use client";

// Mes photos en privé ou en public (Bola, 28/11/2026 : « un clic privé, un
// clic public, et soit on a accès tous à leurs photos, soit il n'y a qu'eux
// qui les voient »).
//
// Le choix vit dans profiles.photos_privees (supabase/schema.sql), lu par
// toute la ligue, posé par le joueur seul (grant de colonne, RLS « mise à
// jour de soi »). Par défaut : public.
//
// La règle, pour une photo où l'on voit plusieurs joueurs : je la vois si je
// suis dessus, ou si aucun des joueurs qu'on y voit ne l'a mise en privé. Un
// seul joueur en privé suffit donc à la retirer de la vue des autres (sa
// grille, celle de ses coéquipiers vue par un tiers, les Actus, le partage),
// mais ceux qui sont sur la photo la gardent dans leur grille.
//
// Les noms en privé sont gardés en mémoire et sur l'appareil, relus à
// l'ouverture ; mon propre choix s'applique tout de suite.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import type { PhotoJournee } from "@/lib/sfl/photos-journees";

const CLE = "bola-photos-privees";

let privees: ReadonlySet<string> = lireCache();
const abonnes = new Set<() => void>();

function lireCache(): ReadonlySet<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(CLE) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function poser(next: ReadonlySet<string>) {
  privees = next;
  try {
    window.localStorage.setItem(CLE, JSON.stringify([...next]));
  } catch {
    // Stockage refusé : la mémoire suffit.
  }
  for (const f of abonnes) f();
}

/** La règle, pure : `moi` voit-il cette photo ? */
export function photoVisible(photo: Pick<PhotoJournee, "joueurs">, moi: string | null, enPrive: ReadonlySet<string>): boolean {
  if (moi && photo.joueurs.includes(moi)) return true;
  return !photo.joueurs.some((j) => enPrive.has(j));
}

let enCours: Promise<void> | null = null;

/** Relit, une fois à la fois, qui a mis ses photos en privé. */
export function rafraichirPhotosPrivees(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  enCours ??= (async () => {
    try {
      const { data, error } = await supabase().from("profiles").select("name").eq("photos_privees", true);
      // Colonne pas encore en base (aperçus) ou hors ligne : on garde le cache.
      if (error || !data) return;
      const next = new Set((data as { name: string }[]).map((p) => p.name));
      if (next.size !== privees.size || [...next].some((n) => !privees.has(n))) poser(next);
    } catch {
      // Hors ligne.
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => abonnes.delete(f);
}
const instantane = () => privees;
const vide: ReadonlySet<string> = new Set();
const instantaneServeur = () => vide;

/** Les joueurs qui ont mis leurs photos en privé. */
export function usePhotosPrivees(): ReadonlySet<string> {
  useEffect(() => {
    void rafraichirPhotosPrivees();
  }, []);
  return useSyncExternalStore(abonner, instantane, instantaneServeur);
}

/**
 * Le filtre à appeler partout où l'on montre des photos de journée (Ma
 * carte, le profil d'un joueur, les Actus, le partage) : `moi`, le joueur
 * connecté (null : personne).
 */
export function usePhotosVisibles(moi: string | null): (photo: Pick<PhotoJournee, "joueurs">) => boolean {
  const enPrive = usePhotosPrivees();
  return useCallback((photo) => photoVisible(photo, moi, enPrive), [moi, enPrive]);
}

/** Passe mes photos en privé (true) ou en public ; null si c'est fait, sinon le message à montrer. */
export async function choisirPhotosPrivees(moi: string, prive: boolean): Promise<string | null> {
  const avant = privees;
  const next = new Set(privees);
  if (prive) next.add(moi);
  else next.delete(moi);
  poser(next);
  try {
    const { data: u } = await supabase().auth.getUser();
    if (!u.user) throw new Error("hors connexion");
    const { error } = await supabase().from("profiles").update({ photos_privees: prive }).eq("id", u.user.id);
    if (error) throw error;
    return null;
  } catch {
    poser(avant);
    return "Ça n'a pas marché. Réessaie.";
  }
}
