"use client";

// Qui suit qui dans la ligue (Sabri, 22/10 : « voir le nombre de followers de
// chaque utilisateur quand on clique sur sa carte […] qu'on puisse les
// suivre, et que quand on crée un nouveau match, on puisse ajouter les gens
// qu'on suit, qu'on puisse les voir en priorité »).
//
// La liste vit dans public.suivis (supabase/schema.sql) : une ligne par
// joueur suivi, que toute la ligue lit, écrite par compte et montrée par nom
// (comptes.ts). Comme les identités (identites.ts), elle est relue au
// lancement et au retour sur l'app, et gardée en cache. Suivre s'affiche
// tout de suite et s'écrit derrière ; la base refuse, on revient en arrière.
// Le joueur suivi en est prévenu sur son téléphone (/api/suivis).
//
// Aperçus Vercel et développement : la base n'a pas encore la table. Pour que
// Sabri voie les compteurs avant de publier, la ligue y reçoit des abonnés de
// démonstration, tirés de son nom (toujours les mêmes), et suivre ne
// s'enregistre que sur l'appareil. Jamais en production.

import { supabase } from "@/lib/supabase";
import { idDe, nomDeId, rafraichirComptes } from "./comptes";

const CACHE_KEY = "sfl-suivis";
const DEMO_KEY = "sfl-suivis-demo";
export const SUIVIS_EVENT = "sfl-suivis";

/** Les aperçus et le développement, jamais la production. */
export const DEMO_SUIVIS = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

/** [suiveur, suivi], en noms de saison. */
export type Lien = [string, string];

const hasWindow = () => typeof window !== "undefined" && !!window.localStorage;

let liens: Lien[] | null = null;
let revision = 0;
/** La liste a-t-elle été relue de la base depuis le lancement ? */
let lue = false;

function lire(): Lien[] {
  if (liens) return liens;
  liens = [];
  if (hasWindow()) {
    try {
      const brut = window.localStorage.getItem(CACHE_KEY);
      if (brut) liens = JSON.parse(brut) as Lien[];
    } catch {}
  }
  return liens;
}

function signaler() {
  revision++;
  window.dispatchEvent(new Event(SUIVIS_EVENT));
}

function ecrire(next: Lien[]) {
  liens = next;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {}
  signaler();
}

/** Change à chaque mise à jour de la liste. */
export function suivisRevision(): number {
  lire();
  return revision;
}

/** La liste a-t-elle été relue de la base depuis le lancement ? Sinon, c'est le cache. */
export function suivisLus(): boolean {
  return lue;
}

/* ─────────────────────────── La démonstration ─────────────────────────── */

/** La démonstration tient tant que la base n'a rien donné. */
export function enDemo(): boolean {
  return DEMO_SUIVIS && !lue && lire().length === 0;
}

function hache(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ (c.codePointAt(0) ?? 0), 16777619) >>> 0;
  return h;
}

/** Ce que l'appareil a changé à la démonstration. */
function lireRetouches(): { plus: Lien[]; moins: Lien[] } {
  try {
    const brut = window.localStorage.getItem(DEMO_KEY);
    if (brut) return JSON.parse(brut) as { plus: Lien[]; moins: Lien[] };
  } catch {}
  return { plus: [], moins: [] };
}

const meme = (a: Lien, b: Lien) => a[0] === b[0] && a[1] === b[1];

function retoucher(ajout: Lien[], retrait: Lien[]) {
  const r = lireRetouches();
  const plus = [...r.plus.filter((l) => !retrait.some((x) => meme(x, l))), ...ajout.filter((l) => !r.plus.some((x) => meme(x, l)))];
  const moins = [...r.moins.filter((l) => !ajout.some((x) => meme(x, l))), ...retrait.filter((l) => !r.moins.some((x) => meme(x, l)))];
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify({ plus, moins }));
  } catch {}
  signaler();
}

/**
 * Les abonnés de démonstration : chacun suit une partie de la ligue, d'autant
 * plus souvent que le joueur suivi est haut au Pépite d'Or. `noms` : la ligue,
 * du premier au dernier. `moi` ne suit personne : l'invitation à suivre ses
 * partenaires a de quoi s'ouvrir.
 */
export function liensDemo(noms: string[], moi?: string): Lien[] {
  const n = Math.max(1, noms.length - 1);
  const sortie: Lien[] = [];
  for (const a of noms) {
    if (a === moi) continue;
    noms.forEach((b, rang) => {
      if (a === b) return;
      const chance = 0.06 + 0.34 * (1 - rang / n);
      if ((hache(`${a}>${b}`) % 1000) / 1000 < chance) sortie.push([a, b]);
    });
  }
  const r = hasWindow() ? lireRetouches() : { plus: [], moins: [] };
  return [...sortie.filter((l) => !r.moins.some((x) => meme(x, l))), ...r.plus.filter((l) => !sortie.some((x) => meme(x, l)))];
}

/* ─────────────────────────────── Lecture ─────────────────────────────── */

/** Les liens de la base (le cache, tant qu'elle n'a pas répondu). */
export function liensDeLaBase(): Lien[] {
  return lire();
}

/** Une table entière, page par page : la base ne rend pas plus de 1 000 lignes d'un coup. */
export async function toutesLesLignes<T>(table: string, colonnes: string, ordre: string): Promise<T[] | null> {
  const PAGE = 1000;
  const lignes: T[] = [];
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await supabase().from(table).select(colonnes).order(ordre).range(de, de + PAGE - 1);
    if (error || !data) return null;
    lignes.push(...(data as T[]));
    if (data.length < PAGE) return lignes;
  }
}

let enCours: Promise<void> | null = null;

/** Relit les suivis de la ligue. */
export function rafraichirSuivis(): Promise<void> {
  if (!hasWindow()) return Promise.resolve();
  enCours ??= (async () => {
    try {
      const [, data] = await Promise.all([
        rafraichirComptes(),
        toutesLesLignes<{ suiveur: string; suivi: string }>("suivis", "suiveur, suivi", "created_at"),
      ]);
      // Base pas encore migrée (aperçus), pas encore membre, hors ligne : on garde le cache.
      if (!data) return;
      const next: Lien[] = [];
      for (const l of data) {
        const a = nomDeId(l.suiveur);
        const b = nomDeId(l.suivi);
        if (a && b) next.push([a, b]);
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

/* ────────────────────────────── Écriture ────────────────────────────── */

/** Le joueur suivi est prévenu (une notification « … te suit »). Sans attendre ni échouer. */
async function prevenir(ids: string[]): Promise<void> {
  try {
    const { data } = await supabase().auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton || ids.length === 0) return;
    await fetch("/api/suivis", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
      body: JSON.stringify({ suivis: ids }),
      keepalive: true,
    });
  } catch {}
}

/**
 * Le joueur connecté suit un ou plusieurs joueurs : affiché tout de suite,
 * enregistré derrière. Renvoie un message d'erreur, ou null.
 */
export async function suivre(moi: string, noms: string[]): Promise<string | null> {
  const neufs = [...new Set(noms)].filter((n) => n !== moi && !lire().some((l) => l[0] === moi && l[1] === n));
  if (neufs.length === 0) return null;
  if (enDemo()) {
    retoucher(
      neufs.map((n) => [moi, n]),
      []
    );
    return null;
  }
  const ids = neufs.map((n) => [n, idDe(n)] as const).filter((x): x is readonly [string, string] => !!x[1]);
  if (ids.length === 0) return "Ce joueur n'a pas encore de compte.";
  const avant = lire();
  ecrire([...avant, ...ids.map(([n]) => [moi, n] as Lien)]);
  try {
    const { error } = await supabase()
      .from("suivis")
      .upsert(
        ids.map(([, id]) => ({ suivi: id })),
        { onConflict: "suiveur,suivi", ignoreDuplicates: true }
      );
    if (error) throw error;
  } catch {
    ecrire(avant);
    return "Pas enregistré. Réessaie.";
  }
  void prevenir(ids.map(([, id]) => id));
  return null;
}

/** Le joueur connecté arrête de suivre quelqu'un. Renvoie un message d'erreur, ou null. */
export async function nePlusSuivre(moi: string, nom: string): Promise<string | null> {
  if (enDemo()) {
    retoucher([], [[moi, nom]]);
    return null;
  }
  const id = idDe(nom);
  const avant = lire();
  ecrire(avant.filter((l) => !(l[0] === moi && l[1] === nom)));
  if (!id) return null;
  try {
    const { data } = await supabase().auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) throw new Error("session");
    const { error } = await supabase().from("suivis").delete().eq("suiveur", uid).eq("suivi", id);
    if (error) throw error;
    return null;
  } catch {
    ecrire(avant);
    return "Pas enregistré. Réessaie.";
  }
}
