"use client";

// Le vote des figures de match — Joueur Impact et meilleur défenseur.
//
// Remis le 17/10 à la demande de Sabri, partagé en base (supabase/schema.sql,
// table votes_figures) : avant, chaque vote restait sur le téléphone de son
// auteur et personne ne voyait celui des autres.
//
// Règles :
//   · seulement dans les journées dont le MVP sort des stats (mvpAuto) : le
//     MVP ne se vote pas, Impact et Défensive si ;
//   · on vote pour un adversaire de son match, jamais un coéquipier ;
//   · un vote par joueur, par journée et par titre ; on peut changer d'avis
//     tant que le vote est ouvert ;
//   · ouvert le jour du match, fermé à minuit heure de Paris (voteOuvert) —
//     la base refuse aussi toute écriture qui n'est pas du jour même ;
//   · et seulement une fois la feuille de son match remplie (feuilleRemplie).
//     Sabri, 25/10 : « ces votes-là [doivent être] ouverts à partir du moment
//     où les feuilles de match ont été remplies […] tu peux le mettre en
//     grisé, et ça va jusqu'à minuit dimanche ». Avant, le vote s'affiche
//     grisé ; chaque match s'ouvre avec sa propre feuille (Match 1 et
//     Match 2 ne finissent pas à la même heure) ;
//   · à la fermeture, le plus voté de chaque match prend la carte ; à
//     égalité, tous les ex æquo. Personne si personne n'a voté.
//
// Les élus sont posés sur les lignes de la saison au moment de la dériver
// (appliquerVotes, appelé par le SeasonProvider) : rien n'est réécrit dans
// le document de saison, et l'admin n'a rien à saisir.

import type { Journee, JourneeMatch } from "./engine";
import type { Saison } from "./saisie/types";
import { jourMoisDuLibelle, voteOuvert } from "./convocation-temps";
import { supabase } from "@/lib/supabase";
import { isPlaceExtraTime } from "./hidden";
import { cleTitre, VOIX_MIN } from "./saisie/evolution";

export type CategorieVote = "impact" | "def";
export const CATEGORIES_VOTE: CategorieVote[] = ["impact", "def"];
export const LIBELLES_VOTE: Record<CategorieVote, string> = {
  impact: "Joueur Impact",
  def: "Meilleur défenseur",
};

export interface VoteFigure {
  saison: number;
  j: number;
  categorie: CategorieVote;
  votant: string;
  candidat: string;
  match_id: string;
  /** Le jour d'envoi à Paris (« 2026-10-25 ») ; absent des votes posés par ce téléphone. */
  jour?: string;
}

/**
 * Les votes envoyés le jour du match. La base n'exige que « le jour même de
 * l'envoi » sans le comparer à la journée : un téléphone resté ouvert passé
 * minuit pouvait encore poser un premier vote et changer un titre fermé.
 */
export function votesDuJour(votes: VoteFigure[], libelleJournee: string): VoteFigure[] {
  const jm = jourMoisDuLibelle(libelleJournee);
  if (!jm) return votes;
  return votes.filter((v) => {
    if (!v.jour) return true;
    const [, mois, jour] = v.jour.split("-").map(Number);
    return mois === jm.mois && jour === jm.jour;
  });
}

/* ------------------------------ Le magasin ------------------------------ */
// Les votes de la saison en cours, en mémoire, rechargés en temps réel.
// Quelques dizaines de lignes par journée, lues page par page (chargerVotes).

export const VOTES_EVENT = "sfl-votes";
let cache: VoteFigure[] = [];
let charge = false;

function emit() {
  window.dispatchEvent(new Event(VOTES_EVENT));
}

export function votesEnMemoire(): VoteFigure[] {
  return cache;
}

/**
 * Tous les votes de la saison, page par page et dans un ordre fixe : la base
 * n'en rend que 1 000 d'un coup, et sans ordre la page coupée changeait d'un
 * téléphone à l'autre (vers la J14, les élus auraient différé).
 */
export async function chargerVotes(saison: number): Promise<void> {
  const tous: VoteFigure[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase()
      .from("votes_figures")
      .select("saison, j, categorie, votant, candidat, match_id, jour")
      .eq("saison", saison)
      .order("j")
      .order("categorie")
      .order("votant")
      .range(de, de + 999);
    if (error) throw error;
    const page = (data ?? []) as VoteFigure[];
    tous.push(...page);
    if (page.length < 1000) break;
  }
  cache = tous;
  charge = true;
  emit();
}

export function votesCharges(): boolean {
  return charge;
}

/** Aujourd'hui à Paris, « 2026-10-18 » — la base n'accepte que ce jour-là. */
function aujourdhuiParis(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

/** Pose (ou remplace) mon vote. Lève une erreur lisible si la base refuse. */
export async function voter(v: VoteFigure): Promise<void> {
  const { error } = await supabase()
    .from("votes_figures")
    .upsert({ ...v, jour: aujourdhuiParis() }, { onConflict: "saison,j,categorie,votant" });
  if (error) throw new Error("Vote refusé : il ne s'ouvre que le jour du match, jusqu'à minuit.");
  // Mis à jour tout de suite, sans attendre le temps réel.
  cache = [
    ...cache.filter((x) => !(x.saison === v.saison && x.j === v.j && x.categorie === v.categorie && x.votant === v.votant)),
    v,
  ];
  emit();
}

/* ------------------------------ Le décompte ----------------------------- */

export interface Decompte {
  /** Voix par candidat, du plus voté au moins voté (les candidats à 0 exclus). */
  voix: [nom: string, n: number][];
  votants: number;
  inscrits: number;
  /** Les plus votés (ex æquo compris) ; vide si personne n'a voté. */
  elus: string[];
}

/** Le décompte d'un match pour un titre : seules comptent les voix d'un joueur du match pour un adversaire. */
export function decompterMatch(votes: VoteFigure[], saison: number, j: number, match: JourneeMatch, cat: CategorieVote): Decompte {
  const equipeDe = new Map<string, "A" | "B">();
  // Un joueur venu en extra time ne vote pas dans ce match et n'y est pas candidat.
  match.teamA.players.forEach((p) => !p.extraTime && equipeDe.set(p.name, "A"));
  match.teamB.players.forEach((p) => !p.extraTime && equipeDe.set(p.name, "B"));
  const compte = new Map<string, number>();
  let votants = 0;
  for (const v of votes) {
    if (v.saison !== saison || v.j !== j || v.categorie !== cat) continue;
    const a = equipeDe.get(v.votant);
    const b = equipeDe.get(v.candidat);
    if (!a || !b || a === b) continue;
    votants++;
    compte.set(v.candidat, (compte.get(v.candidat) ?? 0) + 1);
  }
  const voix = [...compte.entries()].sort((x, y) => y[1] - x[1]);
  const max = voix[0]?.[1] ?? 0;
  return {
    voix,
    votants,
    inscrits: equipeDe.size,
    elus: max > 0 ? voix.filter(([, n]) => n === max).map(([nom]) => nom) : [],
  };
}

/** Mon vote pour un titre dans une journée, s'il existe. */
export function monVote(votes: VoteFigure[], saison: number, j: number, cat: CategorieVote, moi: string): string | null {
  return votes.find((v) => v.saison === saison && v.j === j && v.categorie === cat && v.votant === moi)?.candidat ?? null;
}

/** Une journée où l'on vote : MVP calculé, équipes connues. */
export function journeeAvecVote(j: Journee): boolean {
  return !!j.mvpAuto && (j.matches?.length ?? 0) > 0;
}

/**
 * La feuille d'un match est remplie quand l'admin y a saisi un résultat
 * (victoire, nul ou défaite) pour au moins un joueur de chacune des deux
 * équipes. Les buts seuls ne suffisent pas : on les note pendant le match.
 */
export function feuilleRemplie(saison: Pick<Saison, "entries">, j: number, match: JourneeMatch): boolean {
  const avecResultat = (nom: string) => saison.entries.some((e) => e.j === j && e.team === nom && !!e.result);
  return avecResultat(match.teamA.name) && avecResultat(match.teamB.name);
}

/* ------------------------------ Les élus -------------------------------- */

/**
 * Pose les élus des votes fermés sur les lignes de la saison (Impact,
 * Défensive), journée par journée, match par match — comme appliquerMvpAuto
 * pour le MVP. Une journée sans aucune voix valable pour un titre garde ce que
 * l'admin a saisi. Même référence renvoyée si rien ne change.
 */
export function appliquerVotes(saison: Saison, journees: Journee[], votes: VoteFigure[], maintenant: Date): Saison {
  if (!votes.length) return saison;
  const numero = saison.numero ?? 0;
  // j → titre → élus (par nom), seulement pour les votes fermés.
  const elus = new Map<number, Map<CategorieVote, Set<string>>>();
  for (const jn of journees) {
    if (!journeeAvecVote(jn) || voteOuvert(jn.date, maintenant)) continue;
    for (const cat of CATEGORIES_VOTE) {
      if (!votes.some((v) => v.saison === numero && v.j === jn.j && v.categorie === cat)) continue;
      const set = new Set<string>();
      const valables = votesDuJour(votes, jn.date);
      for (const m of jn.matches ?? []) decompterMatch(valables, numero, jn.j, m, cat).elus.forEach((n) => set.add(n));
      if (!set.size) continue;
      if (!elus.has(jn.j)) elus.set(jn.j, new Map());
      elus.get(jn.j)!.set(cat, set);
    }
  }
  if (!elus.size) return saison;

  let change = false;
  const entries = saison.entries.map((e) => {
    const parCat = elus.get(e.j);
    if (!parCat || e.extraTime) return e;
    let next = e;
    for (const [cat, set] of parCat) {
      const doit = set.has(e.player);
      if (!!next[cat] !== doit) next = { ...next, [cat]: doit };
    }
    if (next !== e) change = true;
    return next;
  });
  return change ? { ...saison, entries } : saison;
}

/**
 * Les titres élus avec moins de VOIX_MIN voix : ils restent des titres (la
 * carte du jour, les points Pépite), mais ne font pas monter la note
 * (saisie/evolution.ts). Sabri a validé le seuil le 26/10 avec la
 * proposition : à la J3, 13 votants sur 36, tous les élus l'étaient à une voix.
 */
export function titresFaibles(saison: Saison, journees: Journee[], votes: VoteFigure[], maintenant: Date): Set<string> {
  const faibles = new Set<string>();
  const numero = saison.numero ?? 0;
  for (const jn of journees) {
    if (!journeeAvecVote(jn) || voteOuvert(jn.date, maintenant)) continue;
    for (const cat of CATEGORIES_VOTE) {
      for (const m of jn.matches ?? []) {
        const d = decompterMatch(votesDuJour(votes, jn.date), numero, jn.j, m, cat);
        if ((d.voix[0]?.[1] ?? 0) < VOIX_MIN) d.elus.forEach((n) => faibles.add(cleTitre(jn.j, cat, n)));
      }
    }
  }
  return faibles;
}

/* ------------------------------ Le bilan admin -------------------------- */
// Ce que l'admin voit des votes (Admin → Feuille → Votes), ouverts ou fermés :
// voix, élus, et qui a voté, match par match. Sabri, 25/10 : « montrer dans
// l'espace admin les résultats des votes ».

export interface BilanMatch {
  match: JourneeMatch;
  parCategorie: Record<CategorieVote, Decompte>;
  /** Les joueurs du match (hors extra time) qui ont voté au moins une fois, ou pas. */
  ontVote: string[];
  nontPasVote: string[];
}

export interface VoixEcartee {
  votant: string;
  candidat: string;
  categorie: CategorieVote;
  raison: string;
}

export interface BilanJournee {
  matchs: BilanMatch[];
  /** Joueurs de la journée (hors extra time) et ceux d'entre eux qui ont voté. */
  inscrits: number;
  votants: number;
  /** Les bulletins qui ne comptent dans aucun match, avec la raison. */
  ecartees: VoixEcartee[];
}

export function bilanJournee(votes: VoteFigure[], saison: number, jn: Journee): BilanJournee {
  const duJour = votes.filter((v) => v.saison === saison && v.j === jn.j);
  const equipeDe = new Map<string, { m: string; t: "A" | "B" }>();
  for (const m of jn.matches ?? []) {
    m.teamA.players.forEach((p) => !p.extraTime && equipeDe.set(p.name, { m: m.id, t: "A" }));
    m.teamB.players.forEach((p) => !p.extraTime && equipeDe.set(p.name, { m: m.id, t: "B" }));
  }
  const aVote = new Set(duJour.map((v) => v.votant));
  // Les places « X1 », « X2 »… complètent une équipe sans être des joueurs :
  // elles ne votent pas et ne comptent pas parmi les inscrits.
  const vrai = (n: string) => !isPlaceExtraTime(n);
  const matchs = (jn.matches ?? []).map((match) => {
    const joueurs = [...match.teamA.players, ...match.teamB.players]
      .filter((p) => !p.extraTime && vrai(p.name))
      .map((p) => p.name);
    const compter = (cat: CategorieVote) => ({ ...decompterMatch(votes, saison, jn.j, match, cat), inscrits: joueurs.length });
    return {
      match,
      parCategorie: { impact: compter("impact"), def: compter("def") },
      ontVote: joueurs.filter((n) => aVote.has(n)),
      nontPasVote: joueurs.filter((n) => !aVote.has(n)),
    };
  });
  const ecartees: VoixEcartee[] = [];
  for (const v of duJour) {
    const a = equipeDe.get(v.votant);
    const b = equipeDe.get(v.candidat);
    const raison = !a
      ? "votant hors des feuilles du jour"
      : !b
        ? "candidat hors des feuilles du jour"
        : a.m !== b.m
          ? "candidat d'un autre match"
          : a.t === b.t
            ? "vote pour un coéquipier"
            : null;
    if (raison) ecartees.push({ votant: v.votant, candidat: v.candidat, categorie: v.categorie, raison });
  }
  return {
    matchs,
    inscrits: [...equipeDe.keys()].filter(vrai).length,
    votants: [...equipeDe.keys()].filter((n) => vrai(n) && aVote.has(n)).length,
    ecartees,
  };
}
