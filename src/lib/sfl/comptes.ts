"use client";

// Le lien entre le nom de saison d'un joueur, la clé de toute l'app, et son
// compte (profiles.id), la clé de la base : les suivis et les félicitations
// s'écrivent par compte (suivis.ts, felicitations.ts), l'app les montre par
// nom. Seul un compte accepté par l'admin se suit et se félicite. Comme les
// identités (identites.ts), la liste est relue au lancement et au retour sur
// l'app, et gardée en cache.

import { supabase } from "@/lib/supabase";

const CACHE_KEY = "sfl-comptes";

/** Nom de saison → identifiant du compte accepté. */
let parNom: Record<string, string> | null = null;
let parId: Map<string, string> | null = null;

const hasWindow = () => typeof window !== "undefined" && !!window.localStorage;

function lire(): Record<string, string> {
  if (parNom) return parNom;
  parNom = {};
  if (hasWindow()) {
    try {
      const brut = window.localStorage.getItem(CACHE_KEY);
      if (brut) parNom = JSON.parse(brut) as Record<string, string>;
    } catch {}
  }
  parId = new Map(Object.entries(parNom).map(([n, id]) => [id, n]));
  return parNom;
}

/** Le compte d'un joueur, ou null (pas de compte, ou pas encore accepté). */
export function idDe(nom: string): string | null {
  return lire()[nom] ?? null;
}

/** Le nom de saison d'un compte, ou null. */
export function nomDeId(id: string): string | null {
  lire();
  return parId!.get(id) ?? null;
}

let enCours: Promise<boolean> | null = null;

/** Relit les comptes de la ligue ; false si la base n'a rien donné (le cache reste). */
export function rafraichirComptes(): Promise<boolean> {
  if (!hasWindow()) return Promise.resolve(false);
  enCours ??= (async () => {
    try {
      const { data, error } = await supabase().from("profiles").select("id, name, valide");
      if (error || !data || data.length === 0) return false;
      const next: Record<string, string> = {};
      for (const p of data as { id: string; name: string; valide: boolean | null }[]) if (p.valide) next[p.name] = p.id;
      if (JSON.stringify(next) !== JSON.stringify(lire())) {
        parNom = next;
        parId = new Map(Object.entries(next).map(([n, id]) => [id, n]));
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {}
      }
      return true;
    } catch {
      // Hors ligne : le cache suffit.
      return false;
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}
