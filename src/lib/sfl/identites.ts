"use client";

// Le nom et le pseudo que chaque joueur a confirmés — partagés par la ligue.
//
// Le nom de saison (profiles.name) reste la clé de toute l'app ; ce que l'app
// MONTRE vient d'ici : profiles.nom_affiche (tiré du prénom que le joueur a
// corrigé, voir /api/identite) et son vrai pseudo (profiles.username). Comme
// les badges choisis (badges-choisis.ts), la liste est relue au lancement et
// au retour sur l'app, et gardée en cache pour un affichage immédiat.
// Sans entrée, on montre le nom de saison et le pseudo inventé (usernames.ts).

import { supabase } from "@/lib/supabase";
import { username } from "./usernames";

const CACHE_KEY = "sfl-identites";

/** Émis quand la liste change, pour rafraîchir noms et cartes. */
export const IDENTITE_EVENT = "sfl-identite";

/** a : nom affiché ; p : pseudo, sans @ ; c : identité confirmée. */
type Entree = { a?: string; p?: string; c?: boolean };

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

let liste: Record<string, Entree> | null = null;
/** La base connaît-elle déjà la confirmation (colonne identite_le migrée) ? */
let suiviConfirme = false;
let revision = 0;

function lire(): Record<string, Entree> {
  if (liste) return liste;
  liste = {};
  if (hasWindow()) {
    try {
      const brut = window.localStorage.getItem(CACHE_KEY);
      if (brut) {
        const d = JSON.parse(brut) as { l?: Record<string, Entree>; s?: boolean };
        liste = d.l ?? {};
        suiviConfirme = !!d.s;
      }
    } catch {}
  }
  return liste;
}

function ecrire(next: Record<string, Entree>, suivi: boolean) {
  liste = next;
  suiviConfirme = suivi;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ l: next, s: suivi }));
  } catch {}
  revision++;
  window.dispatchEvent(new Event(IDENTITE_EVENT));
}

/** Change à chaque mise à jour de la liste. */
export function identitesRevision(): number {
  lire();
  return revision;
}

/** Le nom à afficher pour un joueur. */
export function nomAffiche(nom: string): string {
  return lire()[nom]?.a ?? nom;
}

/** Le pseudo à afficher, avec son @. */
export function pseudoAffiche(nom: string): string {
  const p = lire()[nom]?.p;
  return p ? `@${p}` : username(nom);
}

/**
 * Le joueur a-t-il confirmé son prénom, son nom et son pseudo ? null tant
 * qu'on ne le sait pas (liste pas encore lue) : rien ne s'affiche alors.
 */
export function identiteConfirmee(nom: string): boolean | null {
  const l = lire();
  if (!suiviConfirme && Object.keys(l).length === 0) return null;
  return !!l[nom]?.c;
}

let enCours: Promise<void> | null = null;

/** Relit les identités de la ligue. */
export function rafraichirIdentites(): Promise<void> {
  if (!hasWindow()) return Promise.resolve();
  enCours ??= (async () => {
    try {
      type Ligne = { name: string; username: string; nom_affiche?: string | null; identite_le?: string | null };
      let suivi = true;
      let { data, error } = await supabase().from("profiles").select("name, username, nom_affiche, identite_le");
      if (error) {
        // Base pas encore migrée (aperçus) : pas de confirmation connue.
        suivi = false;
        ({ data, error } = await supabase().from("profiles").select("name, username"));
      }
      // Rien de lisible (pas encore membre, session tombée) : on garde le cache.
      if (error || !data || data.length === 0) return;
      const next: Record<string, Entree> = {};
      for (const p of data as Ligne[]) {
        const e: Entree = {};
        if (p.nom_affiche && p.nom_affiche !== p.name) e.a = p.nom_affiche;
        const pseudo = p.username?.replace(/^@/, "");
        if (pseudo && `@${pseudo}` !== username(p.name)) e.p = pseudo;
        if (p.identite_le) e.c = true;
        // Une entrée vide reste : elle dit que le joueur a un compte.
        next[p.name] = e;
      }
      if (JSON.stringify(next) !== JSON.stringify(lire()) || suivi !== suiviConfirme) ecrire(next, suivi);
    } catch {
      // Hors ligne : le cache suffit.
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

/** Le joueur connecté vient de confirmer : affiché tout de suite partout. */
export function poserIdentite(nom: string, affiche: string, pseudo: string) {
  const l = { ...lire() };
  const e: Entree = { c: true };
  if (affiche !== nom) e.a = affiche;
  if (`@${pseudo}` !== username(nom)) e.p = pseudo;
  l[nom] = e;
  ecrire(l, true);
}
