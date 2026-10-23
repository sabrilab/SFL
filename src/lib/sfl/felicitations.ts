"use client";

// Les félicitations des Actus (Sabri, 22/10 : « que les joueurs puissent
// féliciter des joueurs pour leur achievement […] tel utilisateur vous a
// félicité pour tel accomplissement, et ça peut donner l'XP »).
//
// Une félicitation, c'est un joueur qui dit bravo à un autre pour un exploit
// d'un dimanche (exploits.ts : l'homme du dimanche, le chiffre, le duo, ceux
// qui montent, un badge, l'équipe type). Elles vivent dans
// public.felicitations, que toute la ligue lit ; seule la route
// /api/felicitations les écrit, après avoir retrouvé l'exploit dans la saison
// de la base, et c'est elle qui prévient le joueur sur son téléphone. Chacun
// retire les siennes. Comme les suivis (suivis.ts), la liste est relue au
// lancement et au retour sur l'app, et gardée en cache ; un bravo s'affiche
// tout de suite.
//
// L'XP se calcule sur ces lignes (lib/sfl/missions.ts, lireFelicitationsXp) :
// une félicitation retirée retire son XP. +10 XP pour qui la reçoit, cinq
// comptées au plus par exploit ; +2 XP pour qui la donne.
//
// Aperçus Vercel et développement : la base n'a pas encore la table. Les
// exploits de la saison y reçoivent des félicitations de démonstration,
// tirées de leur clé (toujours les mêmes), et un bravo ne s'enregistre que
// sur l'appareil. Jamais en production.

import { supabase } from "@/lib/supabase";
import { nomDeId, rafraichirComptes } from "./comptes";
import { exploitsDeLaSaison, type Exploit } from "./exploits";
import type { Saison } from "./saisie/types";
import { toutesLesLignes } from "./suivis";

const CACHE_KEY = "sfl-felicitations";
const DEMO_KEY = "sfl-felicitations-demo";
export const FELICITATIONS_EVENT = "sfl-felicitations";

/** Les aperçus et le développement, jamais la production. */
export const DEMO_FELICITATIONS = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

/** Ce que l'XP lit d'une félicitation (lib/sfl/missions.ts) : de et a en noms de saison. */
export interface FelicitationXp {
  de: string;
  a: string;
  /** La clé de l'exploit, « 1-2-mvp-Kader » (exploits.ts). */
  exploit: string;
  saison: number;
  j: number;
}

export interface Felicitation extends FelicitationXp {
  /** Quand, en millisecondes. */
  le: number;
}

/** L'XP d'une félicitation reçue, et combien comptent au plus par exploit. */
export const XP_RECUE = 10;
export const RECUES_COMPTEES = 5;

const hasWindow = () => typeof window !== "undefined" && !!window.localStorage;

let lignes: Felicitation[] | null = null;
let revision = 0;
let lue = false;

function lire(): Felicitation[] {
  if (lignes) return lignes;
  lignes = [];
  if (hasWindow()) {
    try {
      const brut = window.localStorage.getItem(CACHE_KEY);
      if (brut) lignes = JSON.parse(brut) as Felicitation[];
    } catch {}
  }
  return lignes;
}

function signaler() {
  revision++;
  window.dispatchEvent(new Event(FELICITATIONS_EVENT));
}

function ecrire(next: Felicitation[]) {
  lignes = next;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {}
  signaler();
}

export function felicitationsRevision(): number {
  lire();
  return revision;
}

/* ─────────────────────────── La démonstration ─────────────────────────── */

export function enDemo(): boolean {
  return DEMO_FELICITATIONS && !lue && lire().length === 0;
}

function hache(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ (c.codePointAt(0) ?? 0), 16777619) >>> 0;
  return h;
}

/** Les bravos posés sur cet appareil en démonstration, et ceux retirés. */
function lireRetouches(): { plus: Felicitation[]; moins: string[] } {
  try {
    const brut = window.localStorage.getItem(DEMO_KEY);
    if (brut) return JSON.parse(brut) as { plus: Felicitation[]; moins: string[] };
  } catch {}
  return { plus: [], moins: [] };
}

const cleDe = (f: { de: string; a: string; exploit: string }) => `${f.de}>${f.a}>${f.exploit}`;

function retoucher(ajout: Felicitation[], retrait: string[]) {
  const r = lireRetouches();
  const ajoutes = new Set(ajout.map(cleDe));
  const plus = [...r.plus.filter((f) => !retrait.includes(cleDe(f)) && !ajoutes.has(cleDe(f))), ...ajout];
  const moins = [...r.moins.filter((c) => !ajoutes.has(c)), ...retrait.filter((c) => !r.moins.includes(c))];
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify({ plus, moins }));
  } catch {}
  signaler();
}

/**
 * Les félicitations de démonstration : chaque exploit de la saison en reçoit
 * de zéro à six, de joueurs tirés de sa clé. `noms` : la ligue ; `moi` n'en
 * a encore donné aucune.
 */
export function felicitationsDemo(saison: Saison, noms: string[], moi?: string): Felicitation[] {
  const sortie: Felicitation[] = [];
  const autour = noms.filter((n) => n !== moi);
  if (autour.length === 0) return sortie;
  const t0 = Date.now() - 36 * 3600_000;
  for (const e of exploitsDeLaSaison(saison)) {
    const h = hache(e.cle);
    const combien = h % 7;
    for (let i = 0; i < combien; i++) {
      const de = autour[hache(`${e.cle}#${i}`) % autour.length];
      if (de === e.nom || sortie.some((f) => f.de === de && f.exploit === e.cle)) continue;
      sortie.push({ de, a: e.nom, exploit: e.cle, saison: e.saison, j: e.j, le: t0 + (h % 3600) * 1000 + i * 60_000 });
    }
  }
  const r = hasWindow() ? lireRetouches() : { plus: [], moins: [] };
  const plus = new Set(r.plus.map(cleDe));
  return [...sortie.filter((f) => !r.moins.includes(cleDe(f)) && !plus.has(cleDe(f))), ...r.plus];
}

/* ─────────────────────────────── Lecture ─────────────────────────────── */

/** Les félicitations de la base (le cache, tant qu'elle n'a pas répondu). */
export function felicitationsDeLaBase(): Felicitation[] {
  return lire();
}

let enCours: Promise<void> | null = null;

/** Relit les félicitations de la ligue. */
export function rafraichirFelicitations(): Promise<void> {
  if (!hasWindow()) return Promise.resolve();
  enCours ??= (async () => {
    try {
      type Ligne = { de: string; a: string; exploit: string; saison: number; j: number; created_at: string };
      const [, data] = await Promise.all([
        rafraichirComptes(),
        toutesLesLignes<Ligne>("felicitations", "de, a, exploit, saison, j, created_at", "id"),
      ]);
      // Base pas encore migrée (aperçus), pas encore membre, hors ligne : on garde le cache.
      if (!data) return;
      const next: Felicitation[] = [];
      for (const l of data) {
        const de = nomDeId(l.de);
        const a = nomDeId(l.a);
        if (de && a) next.push({ de, a, exploit: l.exploit, saison: l.saison, j: l.j, le: new Date(l.created_at).getTime() });
      }
      const avant = lue;
      lue = true;
      if (!avant || JSON.stringify(next) !== JSON.stringify(lire())) ecrire(next);
    } catch {
      // Hors ligne : le cache suffit.
    } finally {
      enCours = null;
    }
  })();
  return enCours;
}

/**
 * Toutes les félicitations de la ligue, pour l'XP (lib/sfl/missions.ts) :
 * relues de la base, sinon le cache. En aperçu, `saison` donne celles de la
 * démonstration.
 */
export async function lireFelicitationsXp(saison?: Saison, noms?: string[]): Promise<FelicitationXp[]> {
  await rafraichirFelicitations();
  const liste = enDemo() && saison ? felicitationsDemo(saison, noms ?? saison.roster.map((r) => r.name)) : lire();
  return liste.map(({ de, a, exploit, saison: s, j }) => ({ de, a, exploit, saison: s, j }));
}

/* ────────────────────────────── Écriture ────────────────────────────── */

/**
 * Le joueur connecté félicite un ou plusieurs joueurs pour leurs exploits :
 * affiché tout de suite, enregistré par la route (qui vérifie l'exploit et
 * prévient chacun). Renvoie un message d'erreur, ou null.
 */
export async function feliciter(moi: string, exploits: Exploit[], deja: Felicitation[]): Promise<string | null> {
  const neufs = exploits.filter((e) => e.nom !== moi && !deja.some((f) => f.de === moi && f.exploit === e.cle));
  if (neufs.length === 0) return null;
  const maintenant = Date.now();
  const rangs = neufs.map((e) => ({ de: moi, a: e.nom, exploit: e.cle, saison: e.saison, j: e.j, le: maintenant }));
  if (enDemo()) {
    retoucher(rangs, []);
    return null;
  }
  const avant = lire();
  ecrire([...avant, ...rangs]);
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) throw new Error("session");
    const r = await fetch("/api/felicitations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ exploits: neufs.map((e) => e.cle) }),
    });
    if (!r.ok) throw new Error(String(r.status));
    return null;
  } catch {
    ecrire(avant);
    return "Pas envoyé. Réessaie.";
  }
}

/** Le joueur connecté retire ses félicitations pour ces exploits. Renvoie un message d'erreur, ou null. */
export async function retirerFelicitations(moi: string, cles: string[]): Promise<string | null> {
  if (enDemo()) {
    retoucher(
      [],
      lireRetouches()
        .plus.filter((f) => f.de === moi && cles.includes(f.exploit))
        .map(cleDe)
    );
    return null;
  }
  const avant = lire();
  ecrire(avant.filter((f) => !(f.de === moi && cles.includes(f.exploit))));
  try {
    const { data } = await supabase().auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) throw new Error("session");
    const { error } = await supabase().from("felicitations").delete().eq("de", uid).in("exploit", cles);
    if (error) throw error;
    return null;
  } catch {
    ecrire(avant);
    return "Pas enregistré. Réessaie.";
  }
}
