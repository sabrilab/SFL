"use client";

// Les recrues de la ligue (lib/sfl/recrues.ts), chargées une fois pour toute
// l'app : recrues_de_la_ligue() pour l'XP et les skins de chacun,
// mes_recrues() pour mes filleuls nom par nom, et le plus haut numéro de
// Fondateur posé (les 500 places prises : fermé). À l'ouverture d'Inviter
// seulement, et en production seulement, fondateurs_attribuer() pose d'abord
// les numéros de ceux qui viennent de passer 10 recrues actives (le cron du
// lundi le fait aussi) : pas à chaque lancement de l'app, le calcul est
// lourd ; jamais depuis un aperçu.
//
// La démo (aperçu et développement seulement, jamais en production) :
// /parrainage?paliers=0|1|3|5|10 pose N recrues actives (et deux en attente)
// sur ma carte, et le n° 97 de Fondateur à 10 : la page Inviter à chaque
// palier, et les trois cartes dans Personnaliser ma carte, jusqu'au
// rechargement de l'app.

import { supabase } from "@/lib/supabase";
import { FONDATEURS_MAX } from "@/components/sfl/skins-recrues";
import type { MaRecrue, RecruesJoueur } from "./recrues";

export const RECRUES_EVENT = "sfl-recrues";
const PRODUCTION = process.env.NEXT_PUBLIC_BOLA_ENV === "production";

export interface EtatRecrues {
  ligue: readonly RecruesJoueur[];
  miennes: readonly MaRecrue[];
  /** Les 500 numéros de Fondateur sont posés : le palier est fermé. */
  complet: boolean;
  /** La base a répondu (ou la démo est posée). */
  charge: boolean;
}

let etat: EtatRecrues = { ligue: [], miennes: [], complet: false, charge: false };
let demo = false;

const emit = () => window.dispatchEvent(new Event(RECRUES_EVENT));

export function recruesEnMemoire(): EtatRecrues {
  return etat;
}

type LigneLigue = { nom: string; actives: number; activations: string[] | null; fondateur: number | null };
type LigneMienne = { filleul: string; nom: string; inscrit_le: string; active_le: string | null; compte: boolean | null };

/**
 * Relit les recrues. `numeroter` (Inviter) : en production, pose d'abord les
 * nouveaux Fondateurs.
 */
export async function chargerRecrues(depuisLaBase: boolean, numeroter = false): Promise<void> {
  if (demo || !depuisLaBase) return;
  const sb = supabase();
  if (PRODUCTION && numeroter) {
    const { error } = await sb.rpc("fondateurs_attribuer");
    if (error) console.warn("[recrues] fondateurs :", error.message);
  }
  const [ligue, miennes, haut] = await Promise.all([
    sb.rpc("recrues_de_la_ligue"),
    sb.rpc("mes_recrues"),
    // Le plus haut numéro posé, même si son compte est parti (joueur à null).
    sb.from("fondateurs").select("numero").order("numero", { ascending: false }).limit(1),
  ]);
  if (ligue.error) throw ligue.error;
  if (demo) return;
  const plusHaut = haut.error ? 0 : (((haut.data ?? [])[0] as { numero: number } | undefined)?.numero ?? 0);
  etat = {
    ligue: ((ligue.data ?? []) as LigneLigue[]).map((l) => ({
      nom: l.nom,
      actives: l.actives,
      activations: l.activations ?? [],
      fondateur: l.fondateur ?? null,
    })),
    miennes: miennes.error
      ? []
      : ((miennes.data ?? []) as LigneMienne[]).map((l) => ({
          id: l.filleul,
          nom: l.nom,
          inscritLe: l.inscrit_le,
          activeLe: l.active_le,
          compte: l.compte !== false,
        })),
    complet: plusHaut >= FONDATEURS_MAX,
    charge: true,
  };
  emit();
}

const NOMS_DEMO = ["Inès", "Léo", "Awa", "Nolan", "Yanis", "Sofia", "Malik", "Jade", "Rayan", "Lina", "Adam", "Nour"];

/** La démo demandée par l'adresse (?paliers=N) ; null en production ou sans demande. */
export function paliersDemandes(): number | null {
  if (PRODUCTION || typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("paliers");
  if (v === null) return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 50 ? n : 10;
}

/** Pose la démo : `n` recrues actives sur la carte de `nom`, deux en attente. Jamais en production. */
export function poserDemoRecrues(n: number, nom: string): void {
  if (PRODUCTION) return;
  demo = true;
  const jour = 86400_000;
  const maintenant = Date.now();
  const activations = Array.from({ length: n }, (_, i) => new Date(maintenant - (n - i) * 2 * jour).toISOString());
  const miennes: MaRecrue[] = [
    ...activations.map((a, i) => ({
      id: `demo-${i}`,
      nom: NOMS_DEMO[i % NOMS_DEMO.length] + (i >= NOMS_DEMO.length ? ` ${Math.floor(i / NOMS_DEMO.length) + 1}` : ""),
      inscritLe: new Date(new Date(a).getTime() - 3 * jour).toISOString(),
      activeLe: a,
      compte: true,
    })),
    { id: "demo-a", nom: "Ilan", inscritLe: new Date(maintenant - jour).toISOString(), activeLe: null, compte: true },
    { id: "demo-b", nom: "Maya", inscritLe: new Date(maintenant - 2 * jour).toISOString(), activeLe: null, compte: true },
  ];
  etat = {
    ligue: [{ nom, actives: n, activations, fondateur: n >= 10 ? 97 : null }],
    miennes: miennes.reverse(),
    complet: false,
    charge: true,
  };
  emit();
}
