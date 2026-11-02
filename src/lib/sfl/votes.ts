// Le vote des figures de match — Joueur Impact et meilleur défenseur.
//
// Module partagé, sans "use client" (28/10) : les routes du serveur
// (félicitations, divisions, équipes du vendredi, outsider, missions,
// annonces ; saison-serveur.server.ts) appellent appliquerVotes et
// titresFaibles. Marqué client, Next.js leur passait une référence client à
// la place de la fonction : « Attempted to call appliquerVotes() from the
// server », et la route tombait. Seuls chargerVotes et voter parlent à la
// base, et seulement depuis le téléphone.
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
//   · ouvert le jour du match, jusqu'à la fin du vote (revelation.ts,
//     voteOuvertA) : 18 h, une heure au moins après la dernière feuille,
//     minuit au plus tard (minuit jusqu'à la J4). La base refuse aussi toute
//     écriture hors de ce créneau (public.vote_ouvert) ;
//   · et seulement une fois la feuille de son match remplie (feuilleRemplie).
//     Sabri, 25/10 : « ces votes-là [doivent être] ouverts à partir du moment
//     où les feuilles de match ont été remplies […] tu peux le mettre en
//     grisé, et ça va jusqu'à minuit dimanche » (18 h depuis la J5, Sabri,
//     01/11). Avant, le vote s'affiche
//     grisé ; chaque match s'ouvre avec sa propre feuille (Match 1 et
//     Match 2 ne finissent pas à la même heure) ;
//   · à la révélation (19 h ; minuit jusqu'à la J4), CHAQUE ÉQUIPE de chaque
//     match a son Joueur Impact et sa Défensive : le plus voté de ses
//     joueurs, par l'équipe adverse ; à égalité, tous les ex æquo ; personne
//     si aucune voix ne va à cette équipe. Un même joueur peut avoir
//     l'Impact et la Défensive. Ilyes, 02/11/2026 : « Le principe c'est
//     qu'il y en ait un par équipe : un joueur Impact pour chaque équipe et
//     un joueur Défensive pour chaque équipe. Il n'y a que le MVP qui est
//     unique, sauf en cas d'égalité. » Puis : « oui, un joueur peut avoir la
//     Défensive et l'Impact le même jour », et la règle vaut pour les
//     journées passées aussi. Avant, le décompte mêlait les deux équipes et
//     n'élisait que le plus voté du match : à la J4, au Match 1, Noirs 1
//     n'avait pas de Défensive, ni Blancs 1 d'Impact ;
//   · ni un joueur venu en extra time ni une place « X1 », « X2 »… ne votent
//     ni ne sont candidats dans le match qu'ils complètent ;
//   · entre la fin du vote et la révélation, personne ne voit les élus
//     (titresTombes).
//
// Les élus sont posés sur les lignes de la saison au moment de la dériver
// (appliquerVotes, appelé par le SeasonProvider) : rien n'est réécrit dans
// le document de saison, et l'admin n'a rien à saisir. La règle par équipe
// vaut donc d'un coup pour toutes les journées votées de la saison en
// cours ; une saison close garde les élus écrits dans son archive le jour de
// sa clôture (cloturerSaison).

import type { Journee, JourneeMatch, MatchTeam } from "./engine";
import type { Saison } from "./saisie/types";
import { jourMoisDuLibelle } from "./convocation-temps";
import { titresTombes } from "./revelation";
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
 *
 * `j` : la journée décomptée. Si AUCUN de ses votes datés n'est du jour de son
 * libellé, c'est la date de la journée qui a été corrigée après le vote (un
 * vote ne s'envoie que le jour affiché, revelation.voteOuvertA) : on les
 * garde tous, plutôt que d'effacer d'un coup les titres élus du dimanche.
 */
export function votesDuJour(votes: VoteFigure[], libelleJournee: string, j?: number): VoteFigure[] {
  const jm = jourMoisDuLibelle(libelleJournee);
  if (!jm) return votes;
  const bonJour = (v: VoteFigure) => {
    if (!v.jour) return true;
    const [, mois, jour] = v.jour.split("-").map(Number);
    return mois === jm.mois && jour === jm.jour;
  };
  if (j != null) {
    const dates = votes.filter((v) => v.j === j && v.jour);
    if (dates.length && !dates.some(bonJour)) return votes;
  }
  return votes.filter(bonJour);
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
  if (error) throw new Error("Vote refusé : il est fermé.");
  // Mis à jour tout de suite, sans attendre le temps réel.
  cache = [
    ...cache.filter((x) => !(x.saison === v.saison && x.j === v.j && x.categorie === v.categorie && x.votant === v.votant)),
    v,
  ];
  emit();
}

/* ------------------------------ Le décompte ----------------------------- */
// Une élection par équipe et par titre : les joueurs d'une équipe sont les
// candidats, ceux de l'équipe adverse votent (on vote pour un adversaire).

/** L'élection d'une équipe pour un titre. */
export interface DecompteEquipe {
  /** L'équipe dont les joueurs sont candidats (MatchTeam.name, « Noirs 1 »). */
  equipe: string;
  /** Voix par candidat de l'équipe, du plus voté au moins voté (les candidats à 0 exclus). */
  voix: [nom: string, n: number][];
  /** Les joueurs de l'équipe adverse qui ont voté pour ce titre, et ceux qui le pouvaient. */
  votants: number;
  inscrits: number;
  /** Ses plus votés (ex æquo compris) ; vide si aucune voix ne lui va. */
  elus: string[];
}

export interface Decompte {
  /** teamA puis teamB : chaque équipe a son élection. */
  equipes: [DecompteEquipe, DecompteEquipe];
  /** Les joueurs du match qui ont voté pour ce titre, et ceux qui le pouvaient. */
  votants: number;
  inscrits: number;
  /** Les élus des deux équipes. */
  elus: string[];
}

/** Ceux qui votent et sont candidats pour une équipe : ni l'extra time, ni une place X. */
function electeursDe(t: MatchTeam): string[] {
  return t.players.filter((p) => !p.extraTime && !isPlaceExtraTime(p.name)).map((p) => p.name);
}

/**
 * Le décompte d'un match pour un titre, équipe par équipe : seules comptent
 * les voix d'un joueur du match pour un adversaire, et chaque équipe élit le
 * plus voté de ses joueurs.
 */
export function decompterMatch(votes: VoteFigure[], saison: number, j: number, match: JourneeMatch, cat: CategorieVote): Decompte {
  const joueurs = [electeursDe(match.teamA), electeursDe(match.teamB)] as const;
  const cote = new Map<string, 0 | 1>();
  joueurs[0].forEach((n) => cote.set(n, 0));
  joueurs[1].forEach((n) => cote.set(n, 1));
  const compte = [new Map<string, number>(), new Map<string, number>()] as const;
  const votants = [0, 0];
  for (const v of votes) {
    if (v.saison !== saison || v.j !== j || v.categorie !== cat) continue;
    const de = cote.get(v.votant);
    const pour = cote.get(v.candidat);
    if (de == null || pour == null || de === pour) continue;
    votants[pour]++;
    compte[pour].set(v.candidat, (compte[pour].get(v.candidat) ?? 0) + 1);
  }
  const election = (i: 0 | 1, equipe: string): DecompteEquipe => {
    const voix = [...compte[i].entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], "fr"));
    const max = voix[0]?.[1] ?? 0;
    return {
      equipe,
      voix,
      votants: votants[i],
      // Les électeurs d'une équipe sont les joueurs de l'autre.
      inscrits: joueurs[1 - i].length,
      elus: max > 0 ? voix.filter(([, n]) => n === max).map(([nom]) => nom) : [],
    };
  };
  const equipes: [DecompteEquipe, DecompteEquipe] = [election(0, match.teamA.name), election(1, match.teamB.name)];
  return {
    equipes,
    votants: votants[0] + votants[1],
    inscrits: joueurs[0].length + joueurs[1].length,
    elus: [...equipes[0].elus, ...equipes[1].elus],
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
 * Pose les élus des votes tombés (titresTombes) sur les lignes de la saison (Impact,
 * Défensive), journée par journée, match par match et équipe par équipe —
 * comme appliquerMvpAuto pour le MVP. Une journée sans aucune voix valable
 * pour un titre garde ce que l'admin a saisi. Même référence renvoyée si
 * rien ne change.
 */
export function appliquerVotes(saison: Saison, journees: Journee[], votes: VoteFigure[], maintenant: Date): Saison {
  if (!votes.length) return saison;
  const numero = saison.numero ?? 0;
  // j → titre → élus (par nom), seulement pour les votes fermés.
  const elus = new Map<number, Map<CategorieVote, Set<string>>>();
  for (const jn of journees) {
    if (!journeeAvecVote(jn) || !titresTombes(saison, jn.j, maintenant)) continue;
    for (const cat of CATEGORIES_VOTE) {
      if (!votes.some((v) => v.saison === numero && v.j === jn.j && v.categorie === cat)) continue;
      const set = new Set<string>();
      const valables = votesDuJour(votes, jn.date, jn.j);
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
 * Jugés équipe par équipe : l'élu d'une équipe à une voix est faible, même
 * si l'autre équipe du match a le sien à trois.
 */
export function titresFaibles(saison: Saison, journees: Journee[], votes: VoteFigure[], maintenant: Date): Set<string> {
  const faibles = new Set<string>();
  const numero = saison.numero ?? 0;
  for (const jn of journees) {
    if (!journeeAvecVote(jn) || !titresTombes(saison, jn.j, maintenant)) continue;
    const valables = votesDuJour(votes, jn.date, jn.j);
    for (const cat of CATEGORIES_VOTE) {
      for (const m of jn.matches ?? []) {
        for (const eq of decompterMatch(valables, numero, jn.j, m, cat).equipes) {
          if ((eq.voix[0]?.[1] ?? 0) < VOIX_MIN) eq.elus.forEach((n) => faibles.add(cleTitre(jn.j, cat, n)));
        }
      }
    }
  }
  return faibles;
}

/* ------------------------------ Le bilan admin -------------------------- */
// Ce que l'admin voit des votes (Admin → Feuille → Votes), ouverts ou fermés :
// voix, élus, et qui a voté, match par match et équipe par équipe. Sabri,
// 25/10 : « montrer dans l'espace admin les résultats des votes ».

export interface BilanMatch {
  match: JourneeMatch;
  /** Par titre, l'élection de chaque équipe (Decompte.equipes). */
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
  // Le même décompte qu'appliquerVotes : un vote envoyé un autre jour que
  // celui du match ne compte pas, et l'admin le voit écarté.
  const valables = votesDuJour(duJour, jn.date, jn.j);
  const horsJour = new Set(duJour.filter((v) => !valables.includes(v)));
  // Les places « X1 », « X2 »… complètent une équipe sans être des joueurs, et
  // un joueur venu en extra time compte dans son propre match : ni les unes ni
  // l'autre ne votent ou ne sont candidats là (decompterMatch).
  const equipeDe = new Map<string, { m: string; t: "A" | "B" }>();
  const enExtraTime = new Set<string>();
  for (const m of jn.matches ?? []) {
    for (const [t, equipe] of [["A", m.teamA], ["B", m.teamB]] as const) {
      for (const p of equipe.players) {
        if (p.extraTime) enExtraTime.add(p.name);
        else if (!isPlaceExtraTime(p.name)) equipeDe.set(p.name, { m: m.id, t });
      }
    }
  }
  const aVote = new Set(valables.map((v) => v.votant));
  const matchs = (jn.matches ?? []).map((match) => {
    const joueurs = [...match.teamA.players, ...match.teamB.players]
      .filter((p) => !p.extraTime && !isPlaceExtraTime(p.name))
      .map((p) => p.name);
    const compter = (cat: CategorieVote) => decompterMatch(valables, saison, jn.j, match, cat);
    return {
      match,
      parCategorie: { impact: compter("impact"), def: compter("def") },
      ontVote: joueurs.filter((n) => aVote.has(n)),
      nontPasVote: joueurs.filter((n) => !aVote.has(n)),
    };
  });
  const horsFeuille = (nom: string, qui: "votant" | "candidat") =>
    isPlaceExtraTime(nom)
      ? `${qui} : une place X`
      : enExtraTime.has(nom)
        ? `${qui} venu en extra time`
        : `${qui} hors des feuilles du jour`;
  const ecartees: VoixEcartee[] = [];
  for (const v of duJour) {
    const a = equipeDe.get(v.votant);
    const b = equipeDe.get(v.candidat);
    const raison = horsJour.has(v)
      ? "envoyé après le jour du match"
      : !a
      ? horsFeuille(v.votant, "votant")
      : !b
        ? horsFeuille(v.candidat, "candidat")
        : a.m !== b.m
          ? "candidat d'un autre match"
          : a.t === b.t
            ? "vote pour un coéquipier"
            : null;
    if (raison) ecartees.push({ votant: v.votant, candidat: v.candidat, categorie: v.categorie, raison });
  }
  return {
    matchs,
    inscrits: equipeDe.size,
    votants: [...equipeDe.keys()].filter((n) => aVote.has(n)).length,
    ecartees,
  };
}
