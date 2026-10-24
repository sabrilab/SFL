"use client";

// Ce que chaque joueur a choisi de porter sur sa carte, dans la passe : la
// finition de la carte et le traitement de la photo — partagé par la ligue.
//
// Le choix vit dans profiles.habillage (supabase/schema.sql), sous la forme
// « finition/traitement » : « auto » (le dernier débloqué), « - » (rien) ou
// l'id d'une récompense (nuit, chrome, animee, onyx, et les skins du Passe
// Bola : givre, carbone, marbre, neon, aurore, ki, meteorite, et « Tes
// couleurs » avec son pays, couleurs:dz). Le traitement de la photo
// (argentique, gravure, marbre) n'est plus dans la passe depuis le 24/10
// (Sabri : « Tu peux tirer tout ce qui est carte argentique ») : il reste
// lisible, la carte ne le porte plus.
// Comme le badge (badges-choisis.ts), deux couches :
//   · la liste DISTANTE — nom → choix, relue au lancement et au retour sur
//     l'app, gardée en cache pour un affichage immédiat ;
//   · le choix EN ATTENTE — posé sur cet appareil et pas encore enregistré
//     (hors ligne, session non vérifiée) : il l'emporte jusqu'à l'envoi.
// Ce qui est débloqué ne s'enregistre pas : il se recalcule de l'XP de
// chacun (use-habillage.ts), et un choix qui n'est pas débloqué ne se porte
// pas.

import type { Finition, Traitement } from "@/components/sfl/finitions-carte";
import { estPaysCouleurs } from "@/components/sfl/skins-passe";
import { supabase } from "@/lib/supabase";

export type ChoixFinition = "auto" | "-" | Finition;
export type ChoixTraitement = "auto" | "-" | Traitement;

export interface ChoixHabillage {
  finition: ChoixFinition;
  /** « Tes couleurs » : le pays choisi. */
  pays?: string;
  traitement: ChoixTraitement;
}

const FINITIONS: readonly string[] = [
  "auto",
  "-",
  "nuit",
  "chrome",
  "animee",
  "onyx",
  "givre",
  "carbone",
  "marbre",
  "couleurs",
  "neon",
  "aurore",
  "ki",
  "meteorite",
];
const TRAITEMENTS: readonly string[] = ["auto", "-", "argentique", "gravure", "marbre"];

/** Le choix tel qu'il est enregistré ; rien ou illisible = « auto » des deux côtés. */
export function lireChoixHabillage(brut: string | null | undefined): ChoixHabillage {
  const [f, t] = (brut ?? "").split("/");
  const [finition, pays] = (f ?? "").split(":");
  return {
    finition: FINITIONS.includes(finition) ? (finition as ChoixFinition) : "auto",
    pays: finition === "couleurs" && estPaysCouleurs(pays) ? pays : undefined,
    traitement: TRAITEMENTS.includes(t) ? (t as ChoixTraitement) : "auto",
  };
}

export const ecrireChoixHabillage = (c: ChoixHabillage) =>
  `${c.finition === "couleurs" && c.pays ? `couleurs:${c.pays}` : c.finition}/${c.traitement}`;

const CACHE_KEY = "sfl-habillages-choisis";
const ATTENTE_KEY = "sfl-habillage-en-attente";

/** Émis à chaque changement de choix, pour rafraîchir les cartes. */
export const HABILLAGE_EVENT = "sfl-habillage";

function hasWindow() {
  return typeof window !== "undefined" && !!window.localStorage;
}

let distants: Record<string, string> | null = null;

function lireDistants(): Record<string, string> {
  if (distants) return distants;
  distants = {};
  if (hasWindow()) {
    try {
      const brut = window.localStorage.getItem(CACHE_KEY);
      if (brut) distants = JSON.parse(brut) as Record<string, string>;
    } catch {}
  }
  return distants;
}

function lireAttente(): { nom: string; choix: string } | null {
  if (!hasWindow()) return null;
  try {
    const brut = window.localStorage.getItem(ATTENTE_KEY);
    return brut ? (JSON.parse(brut) as { nom: string; choix: string }) : null;
  } catch {
    return null;
  }
}

let revision = 0;

function signaler() {
  revision++;
  window.dispatchEvent(new Event(HABILLAGE_EVENT));
}

/** Change à chaque changement de choix : la 3D s'en sert pour recapturer. */
export function habillageRevision(): number {
  return revision;
}

/** Le choix d'un joueur, tel qu'enregistré (une chaîne : un instantané stable), ou null. */
export function habillageChoisi(nom: string): string | null {
  const attente = lireAttente();
  if (attente?.nom === nom) return attente.choix;
  return lireDistants()[nom] ?? null;
}

let enCours: Promise<void> | null = null;

/** Relit les choix de la ligue. */
export function rafraichirHabillages(): Promise<void> {
  if (!hasWindow()) return Promise.resolve();
  enCours ??= (async () => {
    try {
      const { data, error } = await supabase().from("profiles").select("name, habillage");
      if (error || !data) return;
      const next: Record<string, string> = {};
      for (const p of data as { name: string; habillage: string | null }[]) if (p.habillage) next[p.name] = p.habillage;
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
export async function envoyerHabillageEnAttente(nom: string): Promise<void> {
  const attente = lireAttente();
  if (!attente || attente.nom !== nom) return;
  try {
    const { data: auth } = await supabase().auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return;
    const { error } = await supabase().from("profiles").update({ habillage: attente.choix }).eq("id", uid);
    if (error) return;
    window.localStorage.removeItem(ATTENTE_KEY);
    distants = { ...lireDistants(), [nom]: attente.choix };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(distants));
    signaler();
  } catch {
    // Réessayé au prochain lancement.
  }
}

/** Le joueur connecté choisit ce qu'il porte : affiché tout de suite, enregistré dès que possible. */
export async function choisirHabillage(nom: string, choix: ChoixHabillage): Promise<void> {
  try {
    window.localStorage.setItem(ATTENTE_KEY, JSON.stringify({ nom, choix: ecrireChoixHabillage(choix) }));
  } catch {}
  signaler();
  await envoyerHabillageEnAttente(nom);
}
