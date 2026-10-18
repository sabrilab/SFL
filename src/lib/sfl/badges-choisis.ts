"use client";

// Le badge que chaque joueur a choisi pour sa carte — partagé par la ligue.
//
// Le choix vit dans profiles.badge (voir supabase/schema.sql) : chacun voit
// sur toutes les cartes le badge que leur joueur a choisi. Comme les photos
// (photos.ts), deux couches :
//   · la liste DISTANTE — nom → choix, relue au lancement et au retour sur
//     l'app, gardée en cache pour un affichage immédiat ;
//   · le choix EN ATTENTE — posé sur cet appareil et pas encore enregistré
//     (hors ligne, session non vérifiée) : il l'emporte jusqu'à l'envoi.
// Sans choix, la carte montre le meilleur badge (« auto », badge-carte.ts).

import { supabase } from "@/lib/supabase";
import type { ChoixBadge } from "./badge-carte";

const CACHE_KEY = "sfl-badges-choisis";
const ATTENTE_KEY = "sfl-badge-en-attente";

/** Émis à chaque changement de choix, pour rafraîchir les cartes. */
export const BADGE_EVENT = "sfl-badge";

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

let distants: Record<string, ChoixBadge> | null = null;

function lireDistants(): Record<string, ChoixBadge> {
  if (distants) return distants;
  distants = {};
  if (hasWindow()) {
    try {
      const brut = window.localStorage.getItem(CACHE_KEY);
      if (brut) distants = JSON.parse(brut) as Record<string, ChoixBadge>;
    } catch {}
  }
  return distants;
}

function lireAttente(): { nom: string; choix: ChoixBadge } | null {
  if (!hasWindow()) return null;
  try {
    const brut = window.localStorage.getItem(ATTENTE_KEY);
    return brut ? (JSON.parse(brut) as { nom: string; choix: ChoixBadge }) : null;
  } catch {
    return null;
  }
}

let revision = 0;

function signaler() {
  revision++;
  window.dispatchEvent(new Event(BADGE_EVENT));
}

/** Change à chaque changement de choix : la 3D s'en sert pour recapturer. */
export function badgeRevision(): number {
  return revision;
}

/** Le choix d'un joueur, ou null s'il n'a rien choisi (le meilleur, alors). */
export function badgeChoisi(nom: string): ChoixBadge | null {
  const attente = lireAttente();
  if (attente?.nom === nom) return attente.choix;
  return lireDistants()[nom] ?? null;
}

let enCours: Promise<void> | null = null;

/** Relit les choix de la ligue. */
export function rafraichirBadges(): Promise<void> {
  if (!hasWindow()) return Promise.resolve();
  enCours ??= (async () => {
    try {
      const { data, error } = await supabase().from("profiles").select("name, badge");
      if (error || !data) return;
      const next: Record<string, ChoixBadge> = {};
      for (const p of data as { name: string; badge: string | null }[]) if (p.badge) next[p.name] = p.badge;
      const avant = lireDistants();
      const pareil =
        Object.keys(next).length === Object.keys(avant).length && Object.entries(next).every(([n, c]) => avant[n] === c);
      if (!pareil) {
        distants = next;
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {}
        signaler();
      }
    } catch {
      // Hors ligne : le cache suffit.
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

/** Envoie le choix resté sur cet appareil, s'il y en a un. */
export async function envoyerBadgeEnAttente(nom: string): Promise<void> {
  const attente = lireAttente();
  if (!attente || attente.nom !== nom) return;
  try {
    const { data: auth } = await supabase().auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return;
    const { error } = await supabase().from("profiles").update({ badge: attente.choix }).eq("id", uid);
    if (error) return;
    window.localStorage.removeItem(ATTENTE_KEY);
    distants = { ...lireDistants(), [nom]: attente.choix };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(distants));
    signaler();
  } catch {
    // Réessayé au prochain lancement.
  }
}

/** Le joueur connecté choisit son badge : affiché tout de suite, enregistré dès que possible. */
export async function choisirBadge(nom: string, choix: ChoixBadge): Promise<void> {
  try {
    window.localStorage.setItem(ATTENTE_KEY, JSON.stringify({ nom, choix }));
  } catch {}
  signaler();
  await envoyerBadgeEnAttente(nom);
}
