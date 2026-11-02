// Les points figés, la fin du vote et la révélation du dimanche.
//
// Sabri, 01/11/2026 au soir (J4) : « Il faut voter avant 18h. Comme ça, à
// 19h, on a tous les points de la journée qui sont entrés. » Puis, le
// 02/11 : une heure de vote au moins après la dernière feuille, jamais après
// minuit ; et tout à 19 h, montées et descentes comprises.
//
// La règle, dès la J5 de la saison 1 (REGLES_REVELATION.depuis) :
//   · pendant la journée, le direct (la feuille, le score, les gestes, les
//     cartons) se voit en direct, mais les points, le classement, les
//     divisions, Ma carte, la note, l'XP et les titres restent ceux d'avant
//     la journée ;
//   · le vote d'un match s'ouvre avec sa feuille (votes.ts, feuilleRemplie)
//     et ferme pour toute la journée à
//       finDuVote = min(minuit, max(18 h, F + 1 h)),
//     F étant la fin des matchs (JourneeMeta.finDesMatchs, l'instant où la
//     dernière feuille a été remplie, posé par la base) ;
//   · la révélation tombe à min(minuit, finDuVote + 1 h) : 19 h dans le cas
//     normal. Tout entre d'un coup : points des matchs et des votes,
//     classement, divisions recoupées, montées et descentes, cartes de titres.
// La J4 et les journées d'avant gardent l'ancien régime : leurs points
// comptent dès qu'elles sont jouées, le vote ferme à minuit.
//
// Exemples (dernière feuille → fin du vote · révélation) : 15 h 10 → 18 h ·
// 19 h ; 17 h 40 → 18 h 40 · 19 h 40 ; 22 h 30 → 23 h 30 · minuit ; 23 h 15 →
// minuit · minuit ; jamais → minuit · aucune (la journée est « bloquée », et
// l'admin le voit).
//
// La vue figée (figer) est la saison que lit toute la ligue : les deux
// portes de lecture, le SeasonProvider et lireSaisonServeur, la rendent. Ses
// points et son découpage en divisions viennent du même objet et des mêmes
// journées : un joueur de D2 n'y a jamais plus de points qu'un joueur de D1.
// Le direct, lui, se lit à part (useSeason().saisonLue, lue.direct).
//
// LA COPIE SQL : public.fin_du_vote (supabase/schema.sql) recopie
// REGLES_REVELATION (depuis, FIN_DU_VOTE, VOTE_APRES_FEUILLE_MS). Changer les
// deux ensemble.
//
// Pur et isomorphe : l'instant est toujours donné par l'appelant. Heure de
// Paris partout, changement d'heure compris.

import { estLeJour, heureDuJour, minuitDuSoir } from "./convocation-temps";
import { journeeJouee, journeeTerminee } from "./saisie/engine";
import { estBrouillon } from "./saisie/brouillon";
import { numeroSaison, type JourneeMeta, type MatchEntry, type Saison } from "./saisie/types";

export const REGLES_REVELATION = {
  /** Première journée du nouveau régime : la J5 de la saison 1 (8/11/2026). Avant, l'ancien (minuit, points en direct). */
  depuis: { saison: 1, j: 5 },
  /** Fin du vote, heure de Paris. Sabri : « Il faut voter avant 18h. » */
  FIN_DU_VOTE: { h: 18, min: 0 },
  /** La révélation, heure de Paris. Sabri : « à 19h, on a tous les points de la journée qui sont entrés ». */
  REVELATION: { h: 19, min: 0 },
  /** Au moins ce temps de vote après la dernière feuille remplie (Sabri, 02/11 : « une heure de vote minimum, jamais après minuit »). */
  VOTE_APRES_FEUILLE_MS: 60 * 60_000,
} as const;

const MINUTE = 60_000;
/** L'écart entre la fin du vote et la révélation, déduit des deux heures (1 h). */
const ECART_REVELATION_MS =
  (REGLES_REVELATION.REVELATION.h * 60 + REGLES_REVELATION.REVELATION.min - (REGLES_REVELATION.FIN_DU_VOTE.h * 60 + REGLES_REVELATION.FIN_DU_VOTE.min)) *
  MINUTE;

type SaisonHeures = Pick<Saison, "numero" | "journees">;
type SaisonLignes = Pick<Saison, "numero" | "journees" | "entries">;

/** La journée j de la saison numéro relève-t-elle de la révélation (dès la J5 de la saison 1) ? */
export function nouveauRegime(numero: number, j: number): boolean {
  const { saison, j: depuis } = REGLES_REVELATION.depuis;
  return numero > saison || (numero === saison && j >= depuis);
}

/** Un instant ISO lisible, sinon null. */
function instant(iso: string | undefined): Date | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
}

/** La fin des matchs d'une journée (JourneeMeta.finDesMatchs), si la base l'a posée. */
export function finDesMatchs(meta: Pick<JourneeMeta, "finDesMatchs">): Date | null {
  return instant(meta.finDesMatchs);
}

const metaDe = (s: Pick<Saison, "journees">, j: number) => s.journees.find((m) => m.j === j);

/**
 * La fin du vote d'une journée. Ancien régime : minuit. Nouveau régime :
 * min(minuit, max(18 h, F + 1 h)), et minuit tant que F est inconnu (la
 * butée). null pour une journée en brouillon ou sans date lisible.
 */
export function finDuVote(meta: JourneeMeta, numero: number, ref: Date): Date | null {
  if (estBrouillon(meta)) return null;
  const minuit = minuitDuSoir(meta.date, ref);
  if (!minuit) return null;
  if (!nouveauRegime(numero, meta.j)) return minuit;
  const f = finDesMatchs(meta);
  if (!f) return minuit;
  const { h, min } = REGLES_REVELATION.FIN_DU_VOTE;
  const ferme = heureDuJour(meta.date, ref, h, min)!;
  return new Date(Math.min(minuit.getTime(), Math.max(ferme.getTime(), f.getTime() + REGLES_REVELATION.VOTE_APRES_FEUILLE_MS)));
}

/**
 * La révélation d'une journée. Ancien régime : minuit. Nouveau régime :
 * min(minuit, finDuVote + 1 h), et null tant que F est inconnu. null pour
 * une journée en brouillon ou sans date lisible.
 */
export function revelation(meta: JourneeMeta, numero: number, ref: Date): Date | null {
  const fin = finDuVote(meta, numero, ref);
  if (!fin) return null;
  if (!nouveauRegime(numero, meta.j)) return fin;
  if (!finDesMatchs(meta)) return null;
  const minuit = minuitDuSoir(meta.date, ref)!;
  return new Date(Math.min(minuit.getTime(), fin.getTime() + ECART_REVELATION_MS));
}

/** Une journée où l'on vote : MVP calculé, équipes posées (comme votes.journeeAvecVote). */
function avecVote(s: Pick<Saison, "entries">, meta: JourneeMeta): boolean {
  return !!meta.mvpAuto && s.entries.some((e) => e.j === meta.j && !!e.team);
}

/**
 * Une journée compte-t-elle à l'instant t ? Se calcule sur la saison PUBLIÉE
 * (le direct), jamais sur une vue figée. Ancien régime : dès qu'elle est
 * jouée. Nouveau régime : à la révélation ; sans F (feuille finie après
 * minuit, ou base sans le déclencheur), la feuille finie et la nuit passée.
 * `votesPrets: false` (un téléphone qui n'a pas encore ses votes) retient
 * une journée avec vote : sans eux, elle serait coupée sans ses Impact et
 * Défensive, puis recoupée une seconde plus tard.
 */
export function journeeComptee(s: SaisonLignes, j: number, t: Date, o: { votesPrets?: boolean } = {}): boolean {
  if (!journeeJouee(s, j)) return false;
  const meta = metaDe(s, j);
  const numero = numeroSaison(s);
  if (!meta || !nouveauRegime(numero, j)) return true;
  if (o.votesPrets === false && avecVote(s, meta)) return false;
  const rev = revelation(meta, numero, t);
  if (rev) return t.getTime() >= rev.getTime();
  const minuit = minuitDuSoir(meta.date, t);
  return journeeTerminee(s, j) && (!minuit || t.getTime() >= minuit.getTime());
}

/** Les journées qui comptent à l'instant t. */
export function journeesComptees(s: SaisonLignes, t: Date, o: { votesPrets?: boolean } = {}): Set<number> {
  return new Set(s.journees.map((m) => m.j).filter((j) => journeeComptee(s, j, t, o)));
}

/**
 * La première journée jouée qui attend encore sa révélation (le direct ne
 * compte pas encore) ; null sinon. La clôture de saison l'attend : sans
 * elle, l'archive perdrait les Impact et Défensive de la dernière journée.
 */
export function revelationAttendue(s: SaisonLignes, t: Date): number | null {
  const j = s.journees
    .map((m) => m.j)
    .sort((a, b) => a - b)
    .find((x) => journeeJouee(s, x) && !journeeComptee(s, x, t));
  return j ?? null;
}

/** Le vote de la journée j est-il ouvert à l'instant t ? Le jour même, jusqu'à la fin du vote. */
export function voteOuvertA(s: SaisonHeures, j: number, t: Date): boolean {
  const meta = metaDe(s, j);
  if (!meta || !estLeJour(meta.date, t)) return false;
  const fin = finDuVote(meta, numeroSaison(s), t);
  return !!fin && t.getTime() < fin.getTime();
}

/**
 * Les élus des votes (Impact, Défensive) sont-ils connus à l'instant t ?
 * Ancien régime : passé le jour du match, comme avant. Nouveau : à la
 * révélation — entre 18 h et 19 h, personne ne voit les élus.
 */
export function titresTombes(s: SaisonLignes, j: number, t: Date): boolean {
  const meta = metaDe(s, j);
  if (!meta) return true;
  if (!nouveauRegime(numeroSaison(s), j)) return !estLeJour(meta.date, t);
  return journeeComptee(s, j, t);
}

export type EtatRevelation = "a-venir" | "en-direct" | "vote" | "attente" | "revelee" | "bloquee";

/**
 * Où en est une journée, pour l'admin et la frise de la Map :
 *   · a-venir : rien de saisi ;
 *   · en-direct : des chiffres entrent, une feuille au moins n'est pas finie ;
 *   · vote : les feuilles finies, le vote ouvert ;
 *   · attente : le vote fermé, la révélation pas encore là ;
 *   · revelee : la journée compte ;
 *   · bloquee : le jour est passé et une feuille n'a jamais été finie.
 */
export function etatRevelation(s: SaisonLignes, j: number, t: Date): EtatRevelation {
  if (!journeeJouee(s, j)) return "a-venir";
  const meta = metaDe(s, j);
  if (!meta) return "revelee";
  const numero = numeroSaison(s);
  const leJour = estLeJour(meta.date, t);
  if (!nouveauRegime(numero, j)) {
    if (!leJour) return "revelee";
    return journeeTerminee(s, j) ? "vote" : "en-direct";
  }
  if (journeeComptee(s, j, t)) return "revelee";
  const fin = finDuVote(meta, numero, t);
  if (finDesMatchs(meta)) return fin && t.getTime() < fin.getTime() ? "vote" : "attente";
  if (journeeTerminee(s, j)) return leJour ? "vote" : "attente";
  return leJour ? "en-direct" : "bloquee";
}

/**
 * La prochaine heure après t où ce que la ligue voit peut changer : une fin
 * de vote, une révélation, un minuit, ou 17 h (le libellé de la fin du vote,
 * tant que F est inconnu). null s'il n'y en a plus. Le minuteur du
 * SeasonProvider s'y règle.
 */
export function prochaineTransition(s: SaisonHeures, t: Date): Date | null {
  const numero = numeroSaison(s);
  let prochaine: number | null = null;
  const garder = (d: Date | null) => {
    if (d && d.getTime() > t.getTime() && (prochaine == null || d.getTime() < prochaine)) prochaine = d.getTime();
  };
  for (const meta of s.journees) {
    if (estBrouillon(meta)) continue;
    garder(finDuVote(meta, numero, t));
    garder(revelation(meta, numero, t));
    garder(minuitDuSoir(meta.date, t));
    if (nouveauRegime(numero, meta.j)) garder(heureDuJour(meta.date, t, 17));
  }
  return prochaine == null ? null : new Date(prochaine);
}

/** Une ligne remise dans la forme d'une feuille posée (poserEquipes) : qui, où, quand ; rien de joué. */
function posee(e: MatchEntry): MatchEntry {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { arrets, interceptions, teamScoreBonus, pepiteBonus, ...reste } = e;
  return {
    ...reste,
    result: null,
    buts: 0,
    passes: 0,
    cleanSheet: false,
    mvp: false,
    impact: false,
    def: false,
    retard: false,
  };
}

/**
 * La vue figée : chaque journée jouée qui ne compte pas encore est remise en
 * feuille posée (ses équipes, statuts et heures gardés ; résultats, buts,
 * passes, titres, retards et bonus remis à zéro ; ses buts minutés retirés),
 * et la saison porte la marque `figee`. Rien à figer : la même référence.
 * Idempotente : une journée figée n'est plus jouée. À appliquer après les
 * votes : figer(appliquerVotes(publiée, …), t).
 */
export function figer(s: Saison, t: Date, o: { votesPrets?: boolean } = {}): Saison {
  const caches = [...new Set(s.entries.map((e) => e.j))].filter((j) => journeeJouee(s, j) && !journeeComptee(s, j, t, o)).sort((a, b) => a - b);
  if (!caches.length) return s;
  const set = new Set(caches);
  return {
    ...s,
    entries: s.entries.map((e) => (set.has(e.j) ? posee(e) : e)),
    ...(s.events ? { events: s.events.filter((ev) => !set.has(ev.j)) } : {}),
    figee: { a: t.toISOString(), caches },
  };
}

/**
 * La fin des matchs proposée par l'app (saisieStore.save) : sur chaque
 * journée du nouveau régime qui devient terminée aujourd'hui sans tampon,
 * l'heure du téléphone. La base la garde si elle est à 5 min de la sienne,
 * sinon pose la sienne (public.saison_fin_des_matchs) ; une fois posée,
 * elle ne bouge plus. Même référence si rien n'est posé.
 */
export function proposerFinDesMatchs(s: Saison, t: Date): Saison {
  const numero = numeroSaison(s);
  let change = false;
  const journees = s.journees.map((m) => {
    if (m.finDesMatchs || estBrouillon(m) || !nouveauRegime(numero, m.j) || !estLeJour(m.date, t) || !journeeTerminee(s, m.j)) return m;
    change = true;
    return { ...m, finDesMatchs: t.toISOString() };
  });
  return change ? { ...s, journees } : s;
}

/* ------------------------------ Les libellés ------------------------------ */

/** « 18 h », « 18 h 40 », « minuit », à Paris. */
export function heureLisible(d: Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value);
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  if (h === 0 && m === 0) return "minuit";
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** Avant 17 h, le jour d'une journée dont la fin des matchs est encore inconnue. */
function tot(meta: JourneeMeta, t: Date): boolean {
  const dixSept = heureDuJour(meta.date, t, 17);
  return !dixSept || t.getTime() < dixSept.getTime();
}

/**
 * L'heure de la fin du vote, à l'écran : « 18 h », « 18 h 40 », « minuit ».
 * Tant que la fin des matchs est inconnue : « 18 h » avant 17 h, puis « 1 h
 * après le dernier match ». La J4 et avant : « minuit ».
 */
export function libelleFinDuVote(s: SaisonHeures, j: number, t: Date): string {
  const meta = metaDe(s, j);
  const numero = numeroSaison(s);
  if (!meta || !nouveauRegime(numero, j)) return "minuit";
  const fin = finDuVote(meta, numero, t);
  if (finDesMatchs(meta) && fin) return heureLisible(fin);
  const { h, min } = REGLES_REVELATION.FIN_DU_VOTE;
  const ferme = heureDuJour(meta.date, t, h, min);
  return tot(meta, t) && ferme ? heureLisible(ferme) : "1 h après le dernier match";
}

/**
 * L'heure de la révélation, à l'écran : « 19 h », « 19 h 40 », « minuit ».
 * Tant que la fin des matchs est inconnue : « 19 h » avant 17 h, puis « 2 h
 * après le dernier match ». La J4 et avant : « minuit ».
 */
export function libelleRevelation(s: SaisonHeures, j: number, t: Date): string {
  const meta = metaDe(s, j);
  const numero = numeroSaison(s);
  if (!meta || !nouveauRegime(numero, j)) return "minuit";
  const rev = revelation(meta, numero, t);
  if (rev) return heureLisible(rev);
  const { h, min } = REGLES_REVELATION.REVELATION;
  const tombe = heureDuJour(meta.date, t, h, min);
  return tot(meta, t) && tombe ? heureLisible(tombe) : "2 h après le dernier match";
}
