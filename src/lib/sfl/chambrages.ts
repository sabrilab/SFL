"use client";

// Le mur d'une équipe de Bola Team (Sabri, 23/11/2026 : sur la Map, toucher
// l'écusson d'une équipe ouvre « une fenêtre avec le trash talk, le clash,
// la provocation […] qu'on puisse affronter une équipe, lui envoyer une
// demande de confrontation »). Des phrases courtes, laissées par les joueurs
// des autres équipes ; la base en garde les règles (supabase/schema.sql,
// « le mur d'une équipe ») : 140 signes, 6 par heure, jamais sur son propre
// mur, retirées par leur auteur ou par le capitaine de l'équipe visée.
//
// Les provocations toutes prêtes (PROVOCATIONS) partent d'un toucher.
//
// En aperçu (jamais en production) avec le monde de démonstration
// (?apercu=1 sur la page Team), un mur tiré des joueurs des autres équipes,
// toujours le même, et rien n'est écrit.

import { supabase } from "@/lib/supabase";
import type { Equipe } from "@/lib/sfl/equipes";

export const MAX_CHAMBRAGE = 140;

export interface Chambrage {
  id: number;
  /** L'équipe de l'auteur. */
  equipe: number;
  auteur: string;
  /** Son id de compte : retirer le sien. */
  auteurId: string;
  texte: string;
  le: string;
}

/** Les provocations d'un toucher : courtes, sans insulte. */
export const PROVOCATIONS = [
  "Vous tenez pas 20 minutes.",
  "Dimanche, on vous attend.",
  "Ramenez des remplaçants.",
  "Votre gardien dort encore ?",
  "Même à 5 contre 4, on gagne.",
  "Prenez des notes.",
];

type Ligne = { id: number; equipe: number; auteur: string; texte: string; created_at: string; p: { name: string } | { name: string }[] | null };

/** Le mur d'une équipe, les plus récents d'abord (40 au plus). Sans la table (avant la mise en ligne) : vide. */
export async function lireChambrages(cible: number): Promise<Chambrage[]> {
  const { data, error } = await supabase()
    .from("equipe_chambrages")
    .select("id, equipe, auteur, texte, created_at, p:profiles!equipe_chambrages_auteur_fkey(name)")
    .eq("cible", cible)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    if (/42P01|PGRST20|does not exist/i.test(`${error.code} ${error.message}`)) return [];
    throw error;
  }
  return ((data ?? []) as unknown as Ligne[]).map((r) => ({
    id: r.id,
    equipe: r.equipe,
    auteurId: r.auteur,
    auteur: (Array.isArray(r.p) ? r.p[0]?.name : r.p?.name) ?? "?",
    texte: r.texte,
    le: r.created_at,
  }));
}

export async function chambrer(cible: number, texte: string): Promise<number> {
  const { data, error } = await supabase().rpc("equipe_chambrer", { cible, texte: texte.trim() });
  if (error) throw error;
  return data as number;
}

export async function retirerChambrage(id: number): Promise<void> {
  const { error } = await supabase().rpc("equipe_chambrage_retirer", { c: id });
  if (error) throw error;
}

export function direErreurChambrage(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  if (/does not exist|42P01|PGRST20|PGRST202/i.test(msg)) return "Le mur arrive avec la mise en ligne.";
  return msg || "Impossible pour l'instant. Réessaie dans un instant.";
}

/** « à l'instant », « 12 min », « 3 h », « 2 j ». */
export function depuis(iso: string, maintenant = Date.now()): string {
  const s = Math.max(0, (maintenant - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} j`;
}

/* ─────────────────────────── Démonstration ─────────────────────────── */

const PHRASES_DEMO = [
  "On a vu votre dernier match. Courage.",
  "Vous défiez qui, vous ? Venez.",
  "Le terrain est trop grand pour vous.",
  "Dimanche 20 h, si vous osez.",
  "Votre capitaine fait que parler.",
  "On ramène le ballon, vous ramenez les excuses.",
  "Ramenez des remplaçants.",
];

function graine(n: number): () => number {
  let x = (n * 2654435761) >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 10_000) / 10_000;
  };
}

/** Le mur d'une équipe dans le monde de démonstration : 3 à 5 messages d'autres équipes, toujours les mêmes. */
export function demoChambrages(cible: Equipe, equipes: Equipe[], maintenant = Date.now()): Chambrage[] {
  const hasard = graine(cible.id);
  const autres = equipes.filter((e) => e.id !== cible.id && e.membres.length > 0);
  if (autres.length === 0) return [];
  const n = 3 + Math.floor(hasard() * 3);
  const minutes = [4, 38, 190, 620, 1500];
  // Les phrases mélangées, sans redite.
  const phrases = PHRASES_DEMO.map((p) => ({ p, k: hasard() })).sort((a, b) => a.k - b.k).map((x) => x.p);
  return Array.from({ length: n }, (_, i) => {
    const e = autres[Math.floor(hasard() * autres.length)];
    const m = e.membres[Math.floor(hasard() * e.membres.length)];
    return {
      id: -(cible.id * 10 + i),
      equipe: e.id,
      auteur: m.name,
      auteurId: m.id,
      texte: phrases[i % phrases.length],
      le: new Date(maintenant - minutes[i] * 60_000).toISOString(),
    };
  });
}
