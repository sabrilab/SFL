// Les puces des titres d'un match : une puce dorée pour le MVP, une rouge
// pour le joueur Impact, une bleue pour la Défensive (Ilyes, 02/11/2026 :
// « une fois l'attribution des cartes MVP, joueur Impact et Défensive, une
// fois que c'est attribué, […] une petite puce […] sur le récap des
// matchs », la J1 à la J4 et toutes les journées à venir, « sur tous les
// visuels avec un terrain et les cartes »).
//
// Ici, rien que le calcul : quelles puces porte un joueur, pour un match
// d'une journée. Les puces se posent sur la carte par
// components/sfl/puces-titres.tsx, et se lisent par useTitresDuJour
// (hooks/use-titres-du-jour.ts), le seul point de lecture.
//
// « Une fois que c'est attribué » : on lit les lignes de la saison que
// l'écran montre (useSeason().saison, où les votes fermés sont posés,
// appliquerVotes), jamais le document brut ni la feuille en direct. Mais
// cette vue porte déjà le MVP automatique le jour même (appliquerMvpAuto,
// posé à chaque sauvegarde, dès le premier but saisi) : sans garde, la puce
// dorée bougeait pendant le direct et le vote (contrôle du 02/11). D'où
// titresAttribues : rien le jour du match, sauf une journée que la ligue
// compte déjà (la révélation, quand la vue de la saison la donne).
//
// Les règles :
//   · ex æquo : chaque élu a sa ligne à vrai, donc sa puce ;
//   · plusieurs titres : plusieurs puces, toujours MVP, Impact, Défensive ;
//   · une carte venue en extra time dans un autre match n'y porte rien : ses
//     titres sont ceux de son match à lui ;
//   · les équipes du match, quand on les donne, gardent les titres à ce
//     match-là (un nom écrit deux fois un même dimanche ne les mélange pas) ;
//   · le compte vitrine (compte-vitrine.ts) a ses titres sur son seul écran,
//     donc ses puces, partout où sa carte se pose (Sabri : « tout, tout,
//     tout ») ; ses lignes sont sans équipe, aucun match ne le montre.
//
// LE MODE BOLA (Ilyes, 02/11/2026 : « mets aussi les MVP avec une puce dorée
// dans le mode de jeu Bola ») : un seul titre, le MVP que l'app désigne
// (ligue-vierge.ts, mvpsDuMatch) ; ni vote, ni Impact, ni Défensive, donc la
// seule puce dorée, jamais rouge ni bleue. Elle se pose quand le MVP est
// officiellement attribué, au critère même de la carte MVP Bola
// (carte-bola.ts, mesMatchsValides puis cartesMvpBola) : le match compté par
// compterMatchs est `valide` (pas d'exhibition, au moins QUORUM = 8 joueurs
// sur la feuille que lit la ligue, et l'état « compte » de la confirmation
// des résultats, ou aucun état pour un match saisi avant le 28/10) et la
// ligne du joueur y porte `mvp`. Jamais sur un match à venir, en cours, en
// attente, contesté ou qui ne compte pas, même si le MVP y est déjà désigné ;
// ex æquo, chacun sa puce. Les lignes sont celles de ligue_vierge()
// (match_bola_json), jamais la feuille brute de la fiche : la ligue en écarte
// les joueurs qui n'ont rien accepté, et le MVP peut en changer ; une fois le
// match validé, la fiche écrit donc sous le score le MVP de la ligue, celui
// de la puce (mvpsDeLaFiche), et ses cartes y portent la puce aussi.

import type { BoostType } from "./engine";
import { jourMoisDuLibelle } from "./convocation-temps";
import type { MatchEntry } from "./saisie/types";
import type { MatchCompte } from "./ligue-vierge";

/** L'ordre des puces sur une carte. */
export const ORDRE_TITRES: readonly BoostType[] = ["mvp", "impact", "def"];

/** Le nom d'une puce, pour l'accessibilité (aria-label). */
export const NOM_PUCE: Record<BoostType, string> = { mvp: "MVP", impact: "Impact", def: "Défensive" };

/** Un nom comme les feuilles l'écrivent : sans espaces autour, en minuscules. */
export const nomNormalise = (nom: string) => nom.trim().toLowerCase();

/** Les titres d'une ligne (ou de ce qui en a la forme), dans l'ordre des puces. */
export function titresDeLigne(l: { mvp?: boolean; impact?: boolean; def?: boolean }): BoostType[] {
  return ORDRE_TITRES.filter((t) => !!l[t]);
}

/** Les lignes d'une journée qui peuvent porter un titre : pas d'extra time. */
function lignesTitrables(entries: readonly MatchEntry[], j: number, equipes?: readonly [string, string]): MatchEntry[] {
  return entries.filter(
    (e) =>
      e.j === j &&
      !e.extraTime &&
      // Une journée « à plat » (sans équipes) n'a qu'un match : toutes ses lignes en sont.
      (!equipes || e.team == null || e.team === equipes[0] || e.team === equipes[1]),
  );
}

/**
 * Les puces d'un joueur pour un match de la journée `j` : celles de ses
 * titres, dans l'ordre MVP, Impact, Défensive, chacun une seule fois.
 * `equipes` : les deux équipes du match (« Noirs 1 », « Blancs 1 ») ; sans,
 * toute la journée.
 */
export function titresDuJoueur(
  entries: readonly MatchEntry[],
  j: number,
  nom: string,
  equipes?: readonly [string, string],
): BoostType[] {
  const qui = nomNormalise(nom);
  const siens = lignesTitrables(entries, j, equipes).filter((e) => nomNormalise(e.player) === qui);
  return ORDRE_TITRES.filter((t) => siens.some((e) => e[t]));
}

/**
 * Les puces de tout un terrain en une passe : nom normalisé → titres. Un
 * joueur sans titre n'y est pas.
 */
export function titresDuJour(
  entries: readonly MatchEntry[],
  j: number,
  equipes?: readonly [string, string],
): Map<string, BoostType[]> {
  const parNom = new Map<string, Set<BoostType>>();
  for (const e of lignesTitrables(entries, j, equipes)) {
    const t = titresDeLigne(e);
    if (!t.length) continue;
    const cle = nomNormalise(e.player);
    const deja = parNom.get(cle) ?? new Set<BoostType>();
    t.forEach((x) => deja.add(x));
    parNom.set(cle, deja);
  }
  return new Map([...parNom].map(([nom, s]) => [nom, ORDRE_TITRES.filter((t) => s.has(t))]));
}

/** L'instant tombe-t-il le jour de ce libellé (« 8 nov. »), à Paris ? L'année n'est pas lue. */
export function leJourMeme(libelle: string, t: Date): boolean {
  const jm = jourMoisDuLibelle(libelle);
  if (!jm) return false;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", day: "numeric", month: "numeric" }).formatToParts(t);
  const v = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return v("day") === jm.jour && v("month") === jm.mois;
}

/**
 * Les titres de la journée `j` sont-ils attribués à l'instant `t` ? Pas le
 * jour du match : le MVP automatique s'y recalcule à chaque but, et le vote
 * Impact / Défensive court jusqu'au soir. Ils tombent à minuit (Paris), ou
 * plus tôt si la ligue compte déjà la journée (`comptees` : la révélation de
 * 19 h, revelation.ts, quand la vue de la saison la donne). Une journée sans
 * date lisible est attribuée telle que la vue la montre.
 *
 * C'est l'ancien régime de titresTombes (revelation.ts) : à la fusion de la
 * révélation, `titresTombes(saison, j, t)` peut le remplacer tel quel.
 */
export function titresAttribues(
  journees: readonly { j: number; date: string }[],
  j: number,
  t: Date,
  comptees?: ReadonlySet<number>,
): boolean {
  if (comptees?.has(j)) return true;
  const meta = journees.find((m) => m.j === j);
  return !meta || !leJourMeme(meta.date, t);
}

/* --------------------------------- Le mode Bola --------------------------------- */

/** La seule puce d'un match Bola. */
const MVP_SEUL: readonly BoostType[] = ["mvp"];
const AUCUNE: readonly BoostType[] = [];

/**
 * Les puces d'un joueur (son id) dans un match Bola compté (compterMatchs) :
 * la dorée s'il en est MVP et que le match est validé, sinon rien. Sans
 * match (pas encore lu, pas vu par la ligue), rien.
 */
export function titresBola(m: Pick<MatchCompte, "valide" | "joueurs"> | null | undefined, id: string): readonly BoostType[] {
  return m?.valide && m.joueurs.some((j) => j.id === id && j.mvp) ? MVP_SEUL : AUCUNE;
}

/** Les puces de tout un match Bola : id → ["mvp"]. Un match non validé n'en a aucune. */
export function pucesBola(m: Pick<MatchCompte, "valide" | "joueurs"> | null | undefined): Map<string, readonly BoostType[]> {
  return new Map(m?.valide ? m.joueurs.filter((j) => j.mvp).map((j) => [j.id, MVP_SEUL] as const) : []);
}

/**
 * Les MVP que la fiche d'un match Bola écrit sous le score (fiche-partie.tsx),
 * et s'ils sont officiels. Une fois le match validé : ceux que la ligue compte
 * (`compte`, ses lignes de ligue_vierge), les mêmes que la puce du terrain et
 * la carte MVP Bola, et leurs cartes portent la puce. Avant : ceux de la
 * feuille (`feuille`), désignés, sans puce. Sans ce choix, la puce dorée et
 * le « MVP » écrit dessous pouvaient nommer deux joueurs : la ligue écarte de
 * la feuille un joueur qui n'a jamais accepté ni confirmé, et le MVP change
 * avec lui (contrôle du 02/11/2026).
 */
export function mvpsDeLaFiche(
  compte: Pick<MatchCompte, "valide" | "mvps"> | null | undefined,
  feuille: readonly string[],
): { ids: readonly string[]; officiels: boolean } {
  return compte?.valide ? { ids: compte.mvps, officiels: true } : { ids: feuille, officiels: false };
}
