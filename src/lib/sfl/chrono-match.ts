// Le chrono d'un match de la feuille en direct (Sabri, 23/11/2026 : « 2 mi-
// temps de 30 minutes, avec un chrono qui se lancerait dès que le match se
// lance, avec un coup de sifflet dès que c'est la mi-temps. Pouvoir rajouter
// des minutes additionnelles aussi […] ou retirer des minutes »).
//
// La vérité vit en base (supabase/schema.sql, public.chronos_direct), à part
// de la saison : un geste sur le chrono ne publie rien, ne se heurte à aucune
// version, et la tablette et le Mac de l'admin lisent la même ligne. Elle ne
// porte que des instants de la base : la mi-temps en cours, son coup d'envoi,
// et les minutes ajoutées à chaque mi-temps. Le temps qui passe, chaque écran
// le recalcule, recalé sur l'heure de la base (`decalage`) : un rechargement,
// un appareil à l'heure fausse ou un téléphone sorti de veille retrouvent le
// même chrono.
//
// Le déroulé : avant le coup d'envoi ; la 1re mi-temps, de 0:00 à 30:00 (plus
// ou moins les minutes ajoutées), puis le coup de sifflet ; la mi-temps, le
// chrono arrêté, jusqu'à « 2e mi-temps » ; la 2e, de 30:00 à 60:00 (plus ou
// moins les siennes), puis le coup de sifflet final.
//
// Ce module, pur, dit la même chose que public.chrono_direct (appliquerGeste :
// la démonstration du poste de dev et l'appareil sans la table s'en servent ;
// banc : tools/chrono-match-check.ts).

import type { Equipes } from "./feuille-direct";

/** La durée d'une mi-temps, en minutes. */
export const MI_TEMPS_MIN = 30;
const MIN = 60_000;
export const AJOUT_MIN = -29;
export const AJOUT_MAX = 30;

/** Une ligne de public.chronos_direct. */
export interface ChronoMatch {
  saison: number;
  j: number;
  noirs: string;
  blancs: string;
  mt: 1 | 2;
  /** Le coup d'envoi de la mi-temps en cours (ISO) ; null : pas lancé. */
  lance_le: string | null;
  ajout1: number;
  ajout2: number;
  par: string | null;
  par_nom: string | null;
  maj_le: string;
}

export type GesteChrono = "lancer" | "seconde" | "ajout" | "remettre";

export type Phase = "avant" | "mt1" | "pause" | "mt2" | "fin";

export interface EtatChrono {
  phase: Phase;
  /** Ce qu'affiche le chrono, en ms : 0 → 30:00 en 1re, 30:00 → 60:00 en 2e. */
  affiche: number;
  /** Les minutes ajoutées à la mi-temps en cours (ou à la dernière jouée). */
  ajout: number;
  /** L'instant (ms, horloge de la base) du coup de sifflet de la mi-temps en cours ; null avant le coup d'envoi. */
  sifflet: number | null;
  /** Dans le temps ajouté (au-delà des 30 minutes). */
  additionnel: boolean;
}

export const cleChrono = (j: number, e: Equipes) => `${j}|${e[0]}|${e[1]}`;
export const equipesDuChrono = (c: Pick<ChronoMatch, "noirs" | "blancs">): Equipes => [c.noirs, c.blancs];

const borne = (n: number) => Math.max(AJOUT_MIN, Math.min(AJOUT_MAX, n));

/** La durée de la mi-temps `mt`, minutes ajoutées comprises (1 minute au moins). */
export function dureeMiTemps(c: Pick<ChronoMatch, "ajout1" | "ajout2">, mt: 1 | 2): number {
  return Math.max(1, MI_TEMPS_MIN + (mt === 1 ? c.ajout1 : c.ajout2)) * MIN;
}

/**
 * Où en est le chrono à l'instant `maintenant` (ms, horloge de la base).
 * Arrêté au coup de sifflet : la mi-temps sifflée attend « 2e mi-temps », la
 * 2e sifflée, c'est la fin.
 */
export function etatDuChrono(c: ChronoMatch | null | undefined, maintenant: number): EtatChrono {
  if (!c || !c.lance_le) return { phase: "avant", affiche: 0, ajout: 0, sifflet: null, additionnel: false };
  const debut = Date.parse(c.lance_le);
  const duree = dureeMiTemps(c, c.mt);
  const sifflet = debut + duree;
  const ecoule = Math.max(0, Math.min(maintenant, sifflet) - debut);
  const base = c.mt === 1 ? 0 : MI_TEMPS_MIN * MIN;
  const fini = maintenant >= sifflet;
  return {
    phase: fini ? (c.mt === 1 ? "pause" : "fin") : c.mt === 1 ? "mt1" : "mt2",
    affiche: base + ecoule,
    ajout: c.mt === 1 ? c.ajout1 : c.ajout2,
    sifflet,
    additionnel: ecoule > MI_TEMPS_MIN * MIN,
  };
}

/** « 12:07 », « 61:30 » : les minutes ne s'arrêtent pas à 59. */
export function formatChrono(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** « +2 », « −1 », rien à 0. */
export function libelleAjout(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "";
}

/**
 * Le geste tel que le joue public.chrono_direct, pour la démonstration et
 * l'appareil sans la table : null si le geste ne change rien (lancer deux
 * fois, « 2e mi-temps » avant le coup d'envoi…). `remettre` rend null aussi :
 * la ligne disparaît. `minutes` est borné à ±5 par geste, et le total d'une
 * mi-temps entre −29 et +30.
 */
export function appliquerGeste(
  c: ChronoMatch | null,
  cible: { saison: number; j: number; equipes: Equipes; par: string | null; parNom: string | null },
  geste: GesteChrono,
  minutes: number,
  maintenant: number
): { ok: boolean; chrono: ChronoMatch | null } {
  const le = new Date(maintenant).toISOString();
  const signe = { par: cible.par, par_nom: cible.parNom, maj_le: le };
  if (geste === "remettre") return { ok: true, chrono: null };
  if (geste === "lancer") {
    if (c?.lance_le) return { ok: false, chrono: c };
    return {
      ok: true,
      chrono: {
        saison: cible.saison,
        j: cible.j,
        noirs: cible.equipes[0],
        blancs: cible.equipes[1],
        ajout1: c?.ajout1 ?? 0,
        ajout2: c?.ajout2 ?? 0,
        mt: 1,
        lance_le: le,
        ...signe,
      },
    };
  }
  if (!c || !c.lance_le) return { ok: false, chrono: c };
  if (geste === "seconde") {
    if (c.mt !== 1) return { ok: false, chrono: c };
    return { ok: true, chrono: { ...c, mt: 2, lance_le: le, ...signe } };
  }
  const d = Math.max(-5, Math.min(5, Math.trunc(minutes) || 0));
  if (geste !== "ajout" || d === 0) return { ok: false, chrono: c };
  return {
    ok: true,
    chrono: c.mt === 1 ? { ...c, ajout1: borne(c.ajout1 + d), ...signe } : { ...c, ajout2: borne(c.ajout2 + d), ...signe },
  };
}

/* ------------------------------ Les sifflets ------------------------------ */

/** Ce que siffle un chrono : la mi-temps, ou la fin. */
export type Sifflet = "mi-temps" | "fin";

/**
 * Le coup de sifflet attendu d'un chrono, et sa clé : une par mi-temps et par
 * coup d'envoi (un chrono remis à zéro puis relancé siffle de nouveau). Les
 * minutes ajoutées déplacent l'instant, pas la clé.
 */
export function siffletAttendu(c: ChronoMatch | null | undefined): { cle: string; quoi: Sifflet; a: number } | null {
  if (!c || !c.lance_le) return null;
  return {
    cle: `${c.saison}|${c.j}|${c.noirs}|${c.blancs}|${c.mt}|${c.lance_le}`,
    quoi: c.mt === 1 ? "mi-temps" : "fin",
    a: Date.parse(c.lance_le) + dureeMiTemps(c, c.mt),
  };
}

/** Un coup de sifflet passé depuis plus longtemps ne se siffle plus (l'app rouverte après coup). */
export const SIFFLET_EN_RETARD_MS = 15_000;

/**
 * Faut-il siffler maintenant ? `arme` : l'appareil a vu ce coup de sifflet à
 * venir (le chrono tournait sous ses yeux). Sinon, un coup de sifflet tombé
 * il y a moins de 15 s se siffle encore (l'app ouverte juste après) ; plus
 * vieux, il est déjà passé.
 */
export function doitSiffler(a: number, maintenant: number, arme: boolean): boolean {
  if (maintenant < a) return false;
  return arme || maintenant - a <= SIFFLET_EN_RETARD_MS;
}

/** Ajoute ou remplace un chrono dans une liste (par match). */
export function avecChrono(l: readonly ChronoMatch[], c: ChronoMatch): ChronoMatch[] {
  const k = cleChrono(c.j, equipesDuChrono(c));
  return [...l.filter((x) => cleChrono(x.j, equipesDuChrono(x)) !== k || x.saison !== c.saison), c];
}

export function sansChrono(l: readonly ChronoMatch[], saison: number, j: number, e: Equipes): ChronoMatch[] {
  const k = cleChrono(j, e);
  return l.filter((x) => x.saison !== saison || cleChrono(x.j, equipesDuChrono(x)) !== k);
}
