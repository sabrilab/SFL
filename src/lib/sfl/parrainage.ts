"use client";

// Le parrainage (Sabri, 24/10/2026 : passer de ~100 joueurs à 500).
//
// Chaque joueur a un code, tiré de son pseudo la première fois qu'il ouvre
// « Inviter » (mon_code_parrain, supabase/schema.sql), et un lien :
// <adresse>/p/<code>. Celui qui l'ouvre voit qui l'invite (et sa carte, si
// elle peut sortir de l'app) puis crée son compte : il entre aussitôt dans
// Bola, son parrain s'en porte garant, comme le capitaine avec le lien d'une
// équipe. Le code est gardé 30 jours sur le téléphone : on peut ouvrir le
// lien un soir et créer son compte le lendemain. Un code peut aussi se taper
// à l'inscription.
//
// Un compte n'a qu'un parrain, fixé à sa création ; Bola Team lui est offert
// si ce parrain joue en SFL (hooks/use-acces-team.ts).
//
// L'adresse des liens : NEXT_PUBLIC_ADRESSE quand Bola aura son nom de
// domaine, sinon celle où l'app est ouverte. Le code ne dépend pas de
// l'adresse : un lien partagé avant le changement continue de marcher.
//
// Les liens ouverts sont comptés une fois par téléphone et par étape (ouvert,
// inscription commencée), avec un identifiant tiré au hasard sur l'appareil :
// ni adresse IP, ni empreinte.

import { supabase } from "@/lib/supabase";
import type { Stats } from "@/lib/sfl/engine";

/** Aperçus et développement : sans les fonctions en base, un parrain de démonstration. */
const DEMO = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

const CLE_CODE = "sfl-parrain";
const CLE_VISITEUR = "sfl-visiteur";
const GARDE_MS = 30 * 24 * 3600_000;

/** Le compteur de Sabri : l'objectif du parrainage. */
export const OBJECTIF_JOUEURS = 500;

export type Canal = "lien" | "code";

export interface CarteParrain {
  poste: string;
  note: number;
  stats: Stats;
}

export interface Parrain {
  code: string;
  /** Le nom de saison : la clé de la ligue, et le nom de sa photo. */
  nom: string;
  /** Le nom que l'app montre. */
  affiche: string;
  pseudo: string | null;
  /** Joueur SFL : son lien offre Bola Team. */
  sfl: boolean;
  /** Sa carte, seulement s'il a accepté qu'elle sorte de l'app. */
  carte: CarteParrain | null;
  /** La version de sa photo (même condition) ; null : pas de photo à montrer. */
  photo: number | null;
}

export function normaliserCode(brut: string): string {
  return brut.trim().toLowerCase().replace(/^@/, "");
}

export function codeValide(code: string): boolean {
  return /^[a-z0-9][a-z0-9._]{2,19}$/.test(code);
}

export function adresseDuLien(code: string): string {
  const base = (process.env.NEXT_PUBLIC_ADRESSE || window.location.origin).replace(/\/+$/, "");
  return `${base}/p/${code}`;
}

function demo(code: string): Parrain {
  const nom = code.charAt(0).toUpperCase() + code.slice(1).split(/[._]/)[0];
  return {
    code,
    nom,
    affiche: nom,
    pseudo: `@${code}`,
    sfl: true,
    carte: { poste: "MC", note: 78, stats: { VIT: 81, TIR: 77, PAS: 80, DRI: 79, DEF: 70, PHY: 78 } },
    photo: null,
  };
}

/** Qui invite, d'après un code ; null : code inconnu ou coupé. */
export async function lireParrain(brut: string): Promise<Parrain | null> {
  const code = normaliserCode(brut);
  if (!codeValide(code)) return null;
  const { data, error } = await supabase().rpc("parrain_info", { c: code });
  if (error) {
    if (DEMO) return demo(code);
    throw error;
  }
  return (data as Parrain | null) ?? null;
}

// ─────────────────────────── Sur le téléphone ───────────────────────────

/**
 * Garde le code d'un lien ouvert, ou d'un code tapé à l'inscription :
 * l'inscription le reprendra, même après un détour par Google ou Apple.
 */
export function garderCode(code: string, canal: Canal = "lien"): void {
  try {
    localStorage.setItem(CLE_CODE, JSON.stringify({ code: normaliserCode(code), canal, le: Date.now() }));
  } catch {}
}

/** Le code gardé ces 30 derniers jours, et comment il est venu ; null sinon. */
export function codeGarde(): { code: string; canal: Canal } | null {
  try {
    const brut = localStorage.getItem(CLE_CODE);
    if (!brut) return null;
    const { code, canal, le } = JSON.parse(brut) as { code?: string; canal?: string; le?: number };
    if (!code || !codeValide(code) || !le || Date.now() - le > GARDE_MS) return null;
    return { code, canal: canal === "code" ? "code" : "lien" };
  } catch {
    return null;
  }
}

export function oublierCode(): void {
  try {
    localStorage.removeItem(CLE_CODE);
  } catch {}
}

function visiteur(): string | null {
  try {
    let v = localStorage.getItem(CLE_VISITEUR);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(CLE_VISITEUR, v);
    }
    return v;
  } catch {
    return null;
  }
}

/** Le haut du tunnel, une fois par téléphone et par étape. Jamais bloquant. */
export function noterVisite(code: string, etape: "ouvert" | "commence"): void {
  const v = visiteur();
  if (!v) return;
  void supabase()
    .rpc("parrainage_vu", { c: normaliserCode(code), visiteur: v, etape })
    .then(
      () => {},
      () => {}
    );
}

// ─────────────────────────── Le parrain, connecté ───────────────────────────

/** Mon code, créé à la première demande. */
export async function monCode(pseudo: string | null): Promise<string | null> {
  const { data, error } = await supabase().rpc("mon_code_parrain");
  if (error) {
    if (DEMO && pseudo) return normaliserCode(pseudo);
    throw error;
  }
  return (data as string | null) ?? null;
}

/** Ma carte pour la page de mon lien (montrée seulement avec mon accord). */
export function publierMaCarte(poste: string, stats: Stats): void {
  void supabase()
    .rpc("parrainage_ma_carte", { poste: poste.slice(0, 4), stats })
    .then(
      () => {},
      () => {}
    );
}

/** J'ai partagé ou copié mon lien (le tunnel de l'admin). Jamais bloquant. */
export function noterPartage(): void {
  void supabase()
    .rpc("parrainage_partage")
    .then(
      () => {},
      () => {}
    );
}

export interface Filleul {
  id: string;
  nom: string;
  canal: "lien" | "code" | "equipe";
  le: string;
}

/** Ceux que j'ai fait venir, du plus récent au plus ancien. */
export async function mesFilleuls(moi: string): Promise<Filleul[]> {
  const { data, error } = await supabase()
    .from("parrainages")
    .select("filleul, canal, created_at, profiles!parrainages_filleul_fkey(name)")
    .eq("parrain", moi)
    .order("created_at", { ascending: false });
  if (error) {
    if (DEMO) return [];
    throw error;
  }
  type Ligne = { filleul: string; canal: Filleul["canal"]; created_at: string; profiles: { name: string } | { name: string }[] | null };
  return ((data ?? []) as unknown as Ligne[]).map((l) => {
    const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
    return { id: l.filleul, nom: p?.name ?? "", canal: l.canal, le: l.created_at };
  });
}
