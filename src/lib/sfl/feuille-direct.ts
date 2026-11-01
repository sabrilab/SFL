// La feuille de match tenue par un joueur (Sabri, 01/11/2026, jour de la
// J4 : « chaque joueur de l'application présent dans un match [peut]
// prendre les stats lui-même de son match et uniquement de son match […]
// à partir du moment où il y en a un qui a pris les stats, on prend avec son
// téléphone »). Pour que les quatre matchs d'un dimanche se prennent en
// direct, et que le soir même on vote et on voie les classements.
//
// La vérité vit en base (supabase/schema.sql, public.feuilles_direct) :
//   · une feuille par match d'une journée SFL publiée, le jour même ; le
//     premier joueur du match qui la prend la tient (prendre_feuille : deux
//     téléphones en même temps, un seul gagne) ;
//   · il compte buts, passes, arrêts, interceptions et buts contre son camp
//     des deux équipes, d'un geste (un but et sa passe ensemble), avec un −
//     pour corriger ; toute la ligue suit en lecture, en temps réel ;
//   · il peut passer la main à un joueur du match ; l'admin la reprend, la
//     libère ou la rouvre ;
//   · « Fin du match » la scelle : le résultat et les chiffres entrent dans
//     la saison tout de suite, sur les seules lignes de ce match
//     (sceller_feuille) : les classements bougent, le MVP se calcule et le
//     vote du match s'ouvre (votes.ts, feuilleRemplie), jusqu'à minuit.
//
// Ce module, pur, dit la même chose côté app : qui peut prendre la feuille
// (droitDePrendre, le miroir de public.droit_feuille), le score en direct,
// le journal des gestes, et appliquerFeuille, le miroir exact de
// public.appliquer_feuille (le mode démo s'en sert, les deux bancs le
// vérifient sur les mêmes chiffres : tools/feuille-direct-check.ts,
// tools/sql/feuille-direct-check.sql). Mode Bola : rien de tout ça.

import type { Journee } from "./engine";
import { voteOuvert } from "./convocation-temps";
import { estBrouillon } from "./saisie/brouillon";
import type { MatchEntry, Saison } from "./saisie/types";
import { numeroSaison } from "./saisie/types";
import { isPlaceExtraTime } from "./hidden";

export type Compteur = "buts" | "passes" | "arrets" | "interceptions" | "csc";
export const COMPTEURS: readonly Compteur[] = ["buts", "passes", "arrets", "interceptions", "csc"];

/** « Ilyes » → { buts: 2, passes: 1 } ; un compteur absent vaut 0. */
export type Compteurs = Record<string, Partial<Record<Compteur, number>>>;

/** Un geste sur un joueur : +1 ou −1 sur un compteur. */
export interface Geste {
  joueur: string;
  quoi: Compteur;
  d: 1 | -1;
}

/** Une entrée du journal : les gestes d'un toucher (un but et sa passe). */
export interface EntreeJournal {
  le: string;
  gestes: Geste[];
}

/** Une ligne de public.feuilles_direct. */
export interface FeuilleDirect {
  saison: number;
  j: number;
  noirs: string;
  blancs: string;
  preneur: string | null;
  preneur_nom: string | null;
  pris_le: string | null;
  debut: string;
  fin: string | null;
  scelle_par: string | null;
  version: number | null;
  compteurs: Compteurs;
  journal: EntreeJournal[];
  maj_le: string;
}

/** Les deux camps d'un match : les Noirs, puis les Blancs (« Noirs 1 », « Blancs 1 »). */
export type Equipes = readonly [string, string];

export type RefusFeuille =
  | "journee"
  | "brouillon"
  | "pas-du-jour"
  | "match"
  | "terminee"
  | "pas-ton-match"
  | "tenue"
  | "scellee"
  | "pas-preneur"
  | "geste"
  | "sans-feuille"
  | "sans-saison"
  | "sans-compte"
  | "hors-ligne";

/** Ce que dit l'écran d'un refus, en quelques mots (sans phrase d'aide). */
export const MOTS_DU_REFUS: Record<RefusFeuille, string> = {
  journee: "Journée introuvable",
  brouillon: "Journée pas encore publiée",
  "pas-du-jour": "Pas aujourd'hui",
  match: "Match introuvable",
  terminee: "Match terminé",
  "pas-ton-match": "Pas ton match",
  tenue: "Déjà prise",
  scellee: "Feuille scellée",
  "pas-preneur": "Feuille tenue par un autre",
  geste: "Geste refusé",
  "sans-feuille": "Pas de feuille",
  "sans-saison": "Saison introuvable",
  "sans-compte": "Pas encore de compte",
  "hors-ligne": "Hors ligne",
};

export const cleFeuille = (j: number, e: Equipes) => `${j}|${e[0]}|${e[1]}`;
export const equipesDe = (f: Pick<FeuilleDirect, "noirs" | "blancs">): Equipes => [f.noirs, f.blancs];
const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/* ------------------------------ Les lignes ------------------------------ */

export interface LigneDuMatch {
  index: number;
  e: MatchEntry;
  camp: "noirs" | "blancs";
  extra: boolean;
}

/**
 * Les lignes d'un match : ses deux camps, les présents et les Xtratime,
 * jamais une ligne vitrine (comme le moteur ; public.lignes_du_match).
 */
export function lignesDuMatch(saison: Pick<Saison, "entries">, j: number, equipes: Equipes): LigneDuMatch[] {
  const out: LigneDuMatch[] = [];
  saison.entries.forEach((e, index) => {
    if (e.j !== j || !e.team || (e.team !== equipes[0] && e.team !== equipes[1])) return;
    if (e.statut !== "Présent" && !e.extraTime) return;
    if (e.vitrine) return;
    out.push({ index, e, camp: e.team === equipes[0] ? "noirs" : "blancs", extra: !!e.extraTime });
  });
  return out;
}

/** Les joueurs de chaque camp, dans l'ordre de la feuille (un Xtratime à la fin). */
export function joueursDuMatch(saison: Pick<Saison, "entries">, j: number, equipes: Equipes): { noirs: string[]; blancs: string[] } {
  const lignes = lignesDuMatch(saison, j, equipes).sort((a, b) => Number(a.extra) - Number(b.extra) || a.index - b.index);
  return {
    noirs: lignes.filter((l) => l.camp === "noirs").map((l) => l.e.player),
    blancs: lignes.filter((l) => l.camp === "blancs").map((l) => l.e.player),
  };
}

/** Le compteur d'un joueur. */
export function compte(c: Compteurs, joueur: string, quoi: Compteur): number {
  const v = c[joueur]?.[quoi];
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
}

/** Les compteurs avec quelques gestes de plus (0 à 99, comme public.compter_feuille). */
export function avecGestes(c: Compteurs, gestes: readonly Geste[]): Compteurs {
  const out: Compteurs = { ...c };
  for (const g of gestes) {
    const v = compte(out, g.joueur, g.quoi) + g.d;
    if (v < 0 || v > 99) continue;
    out[g.joueur] = { ...out[g.joueur], [g.quoi]: v };
  }
  return out;
}

/**
 * Le score en direct : les buts de chaque camp, ses buts d'équipe déjà
 * portés par la saison (teamScoreBonus), et les buts contre son camp de
 * l'adversaire. Le même calcul que public.appliquer_feuille.
 */
export function scoreDeLaFeuille(saison: Pick<Saison, "entries">, j: number, equipes: Equipes, c: Compteurs): [number, number] {
  let n = 0;
  let b = 0;
  let cscN = 0;
  let cscB = 0;
  for (const l of lignesDuMatch(saison, j, equipes)) {
    const pts = compte(c, l.e.player, "buts") + (l.e.teamScoreBonus ?? 0);
    if (l.camp === "noirs") {
      n += pts;
      cscN += compte(c, l.e.player, "csc");
    } else {
      b += pts;
      cscB += compte(c, l.e.player, "csc");
    }
  }
  return [n + cscB, b + cscN];
}

/* ------------------------------ Le sceau ------------------------------- */

const RESULTAT = (a: number, b: number): MatchEntry["result"] => (a > b ? "Victoire" : a < b ? "Défaite" : "Nul");

/** La note de match de saisie/mvp.ts (noteDeMatch), sur une ligne réécrite. */
function noteDeMatch(e: MatchEntry): number {
  if (e.statut !== "Présent" || e.extraTime || isPlaceExtraTime(e.player)) return 0;
  let n = e.buts + e.passes;
  if (e.cleanSheet) n += 3;
  n += Math.floor((e.arrets ?? 0) / 2) + Math.floor((e.interceptions ?? 0) / 2);
  if (e.result === "Victoire") n += e.sflTime ? 3 : 2;
  else if (e.result === "Nul") n += 1;
  return n;
}

/**
 * La saison avec les chiffres d'une feuille posés sur les lignes de ce match,
 * et seulement elles. Le miroir exact de public.appliquer_feuille :
 *   · buts et passes sur chaque ligne ; arrêts et interceptions sur les
 *     présents (une ligne Xtratime n'en compte pas) ;
 *   · les buts contre son camp de l'adversaire sur la première ligne de
 *     joueur du camp qui en profite (teamScoreBonus) ;
 *   · le résultat sur chaque présent des deux camps (finDuMatch) ;
 *   · le MVP, sur une journée au MVP calculé : la meilleure note, ex æquo
 *     compris, personne à zéro (saisie/mvp.ts).
 */
export function appliquerFeuille(saison: Saison, j: number, equipes: Equipes, c: Compteurs): Saison {
  const lignes = lignesDuMatch(saison, j, equipes);
  if (!lignes.length) return saison;
  const auto = !!saison.journees.find((m) => m.j === j)?.mvpAuto;
  const [sn, sb] = scoreDeLaFeuille(saison, j, equipes, c);
  const cscDe = (camp: "noirs" | "blancs") => lignes.filter((l) => l.camp === camp).reduce((s, l) => s + compte(c, l.e.player, "csc"), 0);
  const cscN = cscDe("noirs");
  const cscB = cscDe("blancs");
  const premierN = lignes.find((l) => l.camp === "noirs" && !l.extra)?.index;
  const premierB = lignes.find((l) => l.camp === "blancs" && !l.extra)?.index;

  const neuves = new Map<number, MatchEntry>();
  for (const l of lignes) {
    const p = l.e.player;
    let e: MatchEntry = { ...l.e, buts: compte(c, p, "buts"), passes: compte(c, p, "passes") };
    if (!l.extra)
      e = {
        ...e,
        arrets: compte(c, p, "arrets"),
        interceptions: compte(c, p, "interceptions"),
        result: l.camp === "noirs" ? RESULTAT(sn, sb) : RESULTAT(sb, sn),
      };
    if (l.index === premierN && cscB > 0) e = { ...e, teamScoreBonus: (l.e.teamScoreBonus ?? 0) + cscB };
    else if (l.index === premierB && cscN > 0) e = { ...e, teamScoreBonus: (l.e.teamScoreBonus ?? 0) + cscN };
    neuves.set(l.index, e);
  }
  if (auto) {
    const notes = new Map([...neuves].map(([i, e]) => [i, noteDeMatch(e)]));
    const max = Math.max(0, ...notes.values());
    for (const [i, e] of neuves) neuves.set(i, { ...e, mvp: max > 0 && notes.get(i) === max });
  }
  return { ...saison, entries: saison.entries.map((e, i) => neuves.get(i) ?? e) };
}

/* ----------------------------- Les droits ----------------------------- */

/**
 * Peut-on prendre la feuille de ce match ? null : oui ; sinon le motif. Le
 * miroir de public.droit_feuille, pour l'écran : la base décide.
 */
export function droitDePrendre(
  saison: Saison,
  j: number,
  equipes: Equipes,
  moi: string | null,
  maintenant: Date
): RefusFeuille | null {
  const meta = saison.journees.find((m) => m.j === j);
  if (!meta) return "journee";
  if (estBrouillon(meta)) return "brouillon";
  if (!voteOuvert(meta.date, maintenant)) return "pas-du-jour";
  const declares = meta.matchsDuJour ?? [];
  if (declares.length) {
    if (!declares.some((m) => m.equipes[0] === equipes[0] && m.equipes[1] === equipes[1])) return "match";
  } else {
    const n = equipes[0].match(/^Noirs (\d+)$/)?.[1];
    if (!n || equipes[1] !== `Blancs ${n}`) return "match";
  }
  const lignes = lignesDuMatch(saison, j, equipes);
  if (lignes.some((l) => !l.extra && !!l.e.result)) return "terminee";
  if (!moi || !lignes.some((l) => memeNom(l.e.player, moi))) return "pas-ton-match";
  return null;
}

/** Les matchs d'une journée tels que le moteur les affiche, avec leurs camps. */
export function matchsPourLaFeuille(journee: Journee | undefined): { n: number; label: string; equipes: Equipes }[] {
  return (journee?.matches ?? []).map((m, i) => ({ n: i + 1, label: m.label, equipes: [m.teamA.name, m.teamB.name] as const }));
}

/** Le joueur tient-il cette feuille ? Libre, tenue (par lui ou un autre), scellée. */
export type EtatFeuille = "libre" | "mienne" | "tenue" | "scellee";

export function etatDeLaFeuille(f: FeuilleDirect | null | undefined, monId: string | null): EtatFeuille {
  if (!f || (!f.preneur && !f.fin)) return "libre";
  if (f.fin) return "scellee";
  return monId && f.preneur === monId ? "mienne" : "tenue";
}

/* ----------------------------- Le journal ----------------------------- */

const inverseDe = (g: readonly Geste[]): Geste[] => g.map((x) => ({ ...x, d: (x.d === 1 ? -1 : 1) as 1 | -1 }));
const memesGestes = (a: readonly Geste[], b: readonly Geste[]) =>
  a.length === b.length && a.every((x, i) => x.joueur === b[i].joueur && x.quoi === b[i].quoi && x.d === b[i].d);

/**
 * Le journal une fois les annulations retirées : une entrée qui défait
 * exactement la précédente l'efface. Le sommet est « le dernier geste » que
 * l'écran montre, et ce que ↶ défait.
 */
export function pileDuJournal(journal: readonly EntreeJournal[]): EntreeJournal[] {
  const pile: EntreeJournal[] = [];
  for (const e of journal) {
    const haut = pile[pile.length - 1];
    if (haut && memesGestes(inverseDe(haut.gestes), e.gestes)) pile.pop();
    else pile.push(e);
  }
  return pile;
}

/** Ce qui défait une entrée du journal. */
export function annulation(e: EntreeJournal): Geste[] {
  return inverseDe(e.gestes);
}

const MOTS: Record<Compteur, string> = { buts: "But", passes: "Passe", arrets: "Arrêt", interceptions: "Interc.", csc: "Contre son camp" };

/** « But · Ilyes · passe Anis », « Arrêt · Sami », « − But · Ilyes ». */
export function libelleEntree(e: EntreeJournal): string {
  const g = e.gestes;
  if (!g.length) return "";
  const moins = g.every((x) => x.d === -1) ? "− " : "";
  const but = g.find((x) => x.quoi === "buts");
  const passe = g.find((x) => x.quoi === "passes");
  if (but && passe && g.length === 2) return `${moins}But · ${but.joueur} · passe ${passe.joueur}`;
  return moins + g.map((x) => `${MOTS[x.quoi]} · ${x.joueur}`).join(" · ");
}

/** La minute de jeu d'un instant, depuis la prise de la feuille (1re minute = 1′). */
export function minuteDe(debut: string, instant: Date | string): number {
  const t = (typeof instant === "string" ? Date.parse(instant) : instant.getTime()) - Date.parse(debut);
  return Math.max(1, Math.floor(t / 60_000) + 1);
}

/** La saison de la feuille : numéro de la saison en cours. */
export function saisonDeLaFeuille(saison: Pick<Saison, "numero">): number {
  return numeroSaison(saison);
}
