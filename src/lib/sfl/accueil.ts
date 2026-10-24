"use client";

// L'accueil de l'app : l'état du parcours de l'ouverture
// (components/sfl/accueil) et la trace de sa fin.
//
// Sabri, 24/10/2026 : « que tu te rappelles toutes les choses qu'on demande
// à l'utilisateur : le fait qu'il change son mot de passe, le fait qu'il
// mette son nom, son mail, etc. Il faudrait que ça lui arrive au début, en
// onboarding, pour qu'avant de lui montrer l'application, on ait toutes ces
// informations […] Je veux un vrai onboarding avec même une explication de
// l'app dedans, qui peut être skip, mais il y a une partie qui ne peut pas
// être skip. »
//
// Trois états, partagés avec le reste de l'app : « verif » (on regarde ce
// qui manque au joueur), « ouvert » (le parcours est à l'écran) et « fini ».
// <html data-accueil> les porte aussi : la Map garde son entrée (le vol de la
// France jusqu'aux matchs, les stickers qui tombent) pour la fin du parcours,
// comme elle l'attend déjà de l'écran de chargement, et les cérémonies et
// les invitations de l'ouverture (ApresAccueil) attendent « fini ».
//
// La fin du premier parcours est notée dans la base (profiles.accueil_le) :
// la visite ne revient pas sur un autre téléphone. Base pas encore migrée
// (aperçus Vercel) : la fin est gardée sur cet appareil seulement.

import { supabase } from "@/lib/supabase";

export type EtatAccueil = "verif" | "ouvert" | "fini";

/** Émis à chaque changement d'état. */
export const ACCUEIL_EVENT = "bola-accueil";

let etat: EtatAccueil | null = null;

/** L'état du parcours ; null tant que personne ne l'a regardé. */
export function etatAccueil(): EtatAccueil | null {
  return etat;
}

export function poserEtatAccueil(e: EtatAccueil) {
  if (etat === e || typeof window === "undefined") return;
  etat = e;
  document.documentElement.dataset.accueil = e;
  window.dispatchEvent(new Event(ACCUEIL_EVENT));
}

/** Rien du parcours à l'écran, ni en vue : l'app peut jouer son entrée. */
export function accueilLibre(): boolean {
  return etat !== "verif" && etat !== "ouvert";
}

/** Appelle `f` dès que l'accueil est libre (tout de suite s'il l'est). Renvoie l'arrêt. */
export function quandAccueilLibre(f: () => void): () => void {
  if (accueilLibre()) {
    f();
    return () => {};
  }
  const ecouter = () => {
    if (!accueilLibre()) return;
    window.removeEventListener(ACCUEIL_EVENT, ecouter);
    f();
  };
  window.addEventListener(ACCUEIL_EVENT, ecouter);
  return () => window.removeEventListener(ACCUEIL_EVENT, ecouter);
}

const cleIci = (nom: string) => `bola-accueil-${nom}`;

/** Cet appareil sait-il le premier accueil de ce joueur fini ? Sans attendre la base. */
export function accueilFaitIci(nom: string): boolean {
  try {
    return window.localStorage.getItem(cleIci(nom)) !== null;
  } catch {
    return false;
  }
}

/**
 * Le joueur connecté a-t-il déjà fini son premier accueil ? null : on ne
 * sait pas (pas de réseau, pas de session) ; on ne lui remontre alors pas la
 * visite.
 */
export async function accueilDejaFait(nom: string): Promise<boolean | null> {
  if (accueilFaitIci(nom)) return true;
  try {
    const { data: auth } = await supabase().auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return null;
    const { data, error } = await supabase().from("profiles").select("accueil_le").eq("id", uid).maybeSingle();
    // Base pas encore migrée (aperçus) : ce que sait cet appareil, c'est-à-dire rien.
    if (error) return /accueil_le/.test(error.message ?? "") ? false : null;
    const le = (data as { accueil_le?: string | null } | null)?.accueil_le;
    // Fini sur un autre téléphone : celui-ci s'en souvient aussi.
    if (le) {
      try {
        window.localStorage.setItem(cleIci(nom), le);
      } catch {}
    }
    return !!le;
  } catch {
    return null;
  }
}

/** Le premier accueil est fini : dans la base, et sur cet appareil. */
export async function noterAccueilFait(nom: string): Promise<void> {
  try {
    window.localStorage.setItem(cleIci(nom), new Date().toISOString());
  } catch {}
  try {
    const { data: auth } = await supabase().auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return;
    await supabase().from("profiles").update({ accueil_le: new Date().toISOString() }).eq("id", uid);
  } catch {
    // Hors ligne : l'appareil s'en souvient.
  }
}
