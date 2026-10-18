"use client";

// La feuille de match en direct, tenue par un joueur du match.
//
// Demande de Sabri (18/10) : chaque joueur d'un match peut prendre la feuille
// au bord du terrain — buts, passes décisives, arrêts, interceptions. Le
// premier qui l'ouvre la garde : les autres la suivent, sans pouvoir y écrire.
// Un admin peut la reprendre.
//
// Elle vit dans sa propre table (supabase/schema.sql, feuilles_direct), une
// ligne par match, jamais dans le document de saison : une publication admin
// partie d'une vieille copie ne peut pas l'effacer, et elle-même ne réécrit
// rien d'autre que son match. Ses chiffres sont posés sur les lignes de la
// journée au moment de la dériver (appliquerDirect, appelé par le
// SeasonProvider) — comme les votes Impact et Défensive.
//
// Toute écriture passe par des fonctions SQL qui vérifient qui écrit : la
// première prise gagne (clé primaire), seul le teneur note tant que le match
// n'est pas fini, l'admin toujours.

import { supabase } from "@/lib/supabase";
import { computeJournees } from "./saisie/engine";
import { appliquerMvpAuto } from "./saisie/mvp";
import type { MatchEntry, MatchResult, Saison } from "./saisie/types";

export const COMPTEURS_DIRECT = ["buts", "passes", "arrets", "interceptions"] as const;
export type CompteurDirect = (typeof COMPTEURS_DIRECT)[number];
export type Compteurs = Record<CompteurDirect, number>;

export interface FeuilleDirect {
  saison: number;
  j: number;
  match_id: string;
  teneur_id: string;
  teneur: string;
  stats: Record<string, Compteurs>;
  finie: boolean;
  updated_at: string;
}

export const ZERO: Compteurs = { buts: 0, passes: 0, arrets: 0, interceptions: 0 };

export function compteursDe(e: Pick<MatchEntry, CompteurDirect>): Compteurs {
  return { buts: e.buts, passes: e.passes, arrets: e.arrets ?? 0, interceptions: e.interceptions ?? 0 };
}

/* ------------------------------ Le magasin ------------------------------ */
// Les feuilles de la saison en cours, en mémoire, rechargées en temps réel.
// Une ligne par match joué : on prend tout d'un coup.

export const DIRECT_EVENT = "sfl-direct";
let cache: FeuilleDirect[] = [];

function emit() {
  window.dispatchEvent(new Event(DIRECT_EVENT));
}

export function feuillesEnMemoire(): FeuilleDirect[] {
  return cache;
}

function retenir(f: FeuilleDirect | null) {
  if (!f || !f.match_id) return;
  cache = [...cache.filter((x) => !memeMatch(x, f)), f];
  emit();
}

const memeMatch = (a: Pick<FeuilleDirect, "saison" | "j" | "match_id">, b: Pick<FeuilleDirect, "saison" | "j" | "match_id">) =>
  a.saison === b.saison && a.j === b.j && a.match_id === b.match_id;

// Les notes partent une par une, dans l'ordre des gestes : deux « + » rapides
// envoyés en parallèle pouvaient arriver à l'envers et faire perdre un but.
// Tant qu'il en reste en route, l'écran garde ce qu'on a touché ; un
// rechargement demandé entre-temps (temps réel) attend la fin de la file.
let enVol = 0;
let file: Promise<unknown> = Promise.resolve();
let rechargerApres: number | null = null;

export async function chargerFeuilles(saison: number): Promise<void> {
  if (enVol > 0) {
    rechargerApres = saison;
    return;
  }
  const { data, error } = await supabase()
    .from("feuilles_direct")
    .select("saison, j, match_id, teneur_id, teneur, stats, finie, updated_at")
    .eq("saison", saison);
  if (error) throw error;
  if (enVol > 0) {
    rechargerApres = saison;
    return;
  }
  cache = (data ?? []) as FeuilleDirect[];
  emit();
}

function fileVide() {
  if (enVol > 0 || rechargerApres == null) return;
  const n = rechargerApres;
  rechargerApres = null;
  void chargerFeuilles(n).catch(() => {});
}

export function feuilleDuMatch(feuilles: FeuilleDirect[], saison: number, j: number, matchId: string) {
  return feuilles.find((f) => f.saison === saison && f.j === j && f.match_id === matchId) ?? null;
}

/* ------------------------------ Les gestes ------------------------------ */

type Cle = { saison: number; j: number; matchId: string };

async function appel(fn: string, args: Record<string, unknown>, refus: string): Promise<FeuilleDirect> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw new Error(/joues pas/.test(error.message) ? "Tu ne joues pas ce match." : refus);
  const f = data as FeuilleDirect | null;
  if (!f?.match_id) throw new Error(refus);
  retenir(f);
  return f;
}

/** Prend la feuille. Si quelqu'un l'a déjà, renvoie la sienne (on le voit à `teneur_id`). */
export function prendreFeuille(c: Cle, depart: Record<string, Compteurs>): Promise<FeuilleDirect> {
  return appel(
    "prendre_feuille",
    { p_saison: c.saison, p_j: c.j, p_match: c.matchId, p_stats: depart },
    "La feuille n'a pas pu être prise."
  );
}

/** Note les compteurs d'un joueur. Posé tout de suite à l'écran, puis envoyé à son tour. */
export function noterFeuille(c: Cle, joueur: string, valeurs: Compteurs): Promise<void> {
  const avant = cache.find((f) => memeMatch(f, { saison: c.saison, j: c.j, match_id: c.matchId }));
  if (avant) retenir({ ...avant, stats: { ...avant.stats, [joueur]: valeurs } });
  enVol++;
  const envoi = file.then(async () => {
    const { data, error } = await supabase().rpc("noter_feuille", {
      p_saison: c.saison,
      p_j: c.j,
      p_match: c.matchId,
      p_joueur: joueur,
      p_valeurs: valeurs,
    });
    const f = data as FeuilleDirect | null;
    if (error || !f?.match_id) throw new Error("Pas enregistré : la feuille est fermée ou tenue par un autre joueur.");
    return f;
  });
  file = envoi.catch(() => {});
  return envoi.then(
    (f) => {
      enVol--;
      if (enVol === 0) retenir(f);
      fileVide();
    },
    (e: unknown) => {
      enVol--;
      // Refusé : on revient à ce que la base porte.
      rechargerApres = c.saison;
      fileVide();
      throw e;
    }
  );
}

export function finirFeuille(c: Cle, finie: boolean): Promise<FeuilleDirect> {
  return appel(
    "finir_feuille",
    { p_saison: c.saison, p_j: c.j, p_match: c.matchId, p_finie: finie },
    "La feuille n'a pas pu être fermée."
  );
}

export function reprendreFeuille(c: Cle): Promise<FeuilleDirect> {
  return appel("reprendre_feuille", { p_saison: c.saison, p_j: c.j, p_match: c.matchId }, "Reprise refusée.");
}

/* --------------------------- Sur la saison ------------------------------ */

/**
 * Pose les chiffres des feuilles en direct sur les lignes de leur match :
 * buts, passes, arrêts et interceptions de chaque joueur du match (0 pour
 * ceux que la feuille n'a pas notés). Une feuille finie donne aussi le
 * résultat de chaque ligne, d'après le score. Les MVP automatiques sont
 * recalculés derrière. PUR — même référence renvoyée si rien ne change.
 */
export function appliquerDirect(saison: Saison, feuilles: FeuilleDirect[]): Saison {
  const numero = saison.numero ?? 0;
  const miennes = feuilles.filter((f) => f.saison === numero);
  if (!miennes.length) return saison;

  // joueur du match → feuille et équipe, journée par journée.
  const parJ = new Map<number, Map<string, { f: FeuilleDirect; equipe: string; adverse: string }>>();
  const journees = computeJournees(saison);
  for (const f of miennes) {
    const m = journees.find((x) => x.j === f.j)?.matches?.find((x) => x.id === f.match_id);
    if (!m) continue;
    const map = parJ.get(f.j) ?? new Map();
    m.teamA.players.forEach((p) => map.set(p.name, { f, equipe: m.teamA.name, adverse: m.teamB.name }));
    m.teamB.players.forEach((p) => map.set(p.name, { f, equipe: m.teamB.name, adverse: m.teamA.name }));
    parJ.set(f.j, map);
  }
  if (!parJ.size) return saison;

  let change = false;
  const entries = saison.entries.map((e) => {
    const x = parJ.get(e.j)?.get(e.player);
    if (!x || e.extraTime || e.statut !== "Présent" || e.team !== x.equipe) return e;
    const c = x.f.stats[e.player] ?? ZERO;
    const avant = compteursDe(e);
    if (COMPTEURS_DIRECT.every((k) => avant[k] === c[k])) return e;
    change = true;
    return { ...e, ...c };
  });
  let out: Saison = change ? { ...saison, entries } : saison;

  // Les feuilles finies : le score décide du résultat.
  const finies = miennes.filter((f) => f.finie);
  if (finies.length) {
    const score = (j: number, team: string) =>
      out.entries
        .filter((e) => e.j === j && e.team === team && (e.statut === "Présent" || e.extraTime))
        .reduce((s, e) => s + e.buts + (e.teamScoreBonus ?? 0), 0);
    let res = false;
    const avecResultat = out.entries.map((e) => {
      const x = parJ.get(e.j)?.get(e.player);
      if (!x?.f.finie || e.extraTime || e.statut !== "Présent" || e.team !== x.equipe) return e;
      const pour = score(e.j, x.equipe);
      const contre = score(e.j, x.adverse);
      const result: MatchResult = pour > contre ? "Victoire" : pour < contre ? "Défaite" : "Nul";
      if (e.result === result) return e;
      res = true;
      return { ...e, result };
    });
    if (res) out = { ...out, entries: avecResultat };
  }

  return out === saison ? saison : appliquerMvpAuto(out);
}
