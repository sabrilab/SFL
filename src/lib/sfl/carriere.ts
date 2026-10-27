// La carrière d'un joueur, toutes saisons confondues — pour son profil
// (Sabri, 19/10 : « voir les cartes qu'il a débloquées dans les saisons
// précédentes […] la carte en elle-même a de la valeur […] une espèce de
// courbe pour voir comment le joueur évolue », puis « comparer sa carte avec
// celle d'un autre joueur »).
//
// Trois lectures, calculées à partir du document de saison, rien n'est stocké :
//   1. ses cartes, saison par saison : la carte de la saison (sa base de ce
//      moment-là, la note qu'il avait) et les cartes spéciales qu'il y a
//      débloquées (MVP, Impact, Défensive d'un dimanche, computeBoostCards) ;
//   2. sa courbe, journée après journée sur toutes les saisons : la note de
//      sa carte (elle change d'une saison à l'autre), la meilleure carte
//      spéciale du jour s'il en a eu une, et son rang au Pépite d'Or après
//      chaque journée ;
//   3. un face-à-face avec un autre joueur : les matchs joués ensemble, et
//      ceux joués l'un contre l'autre.
//
// La saison à donner est celle où les élus des votes sont posés
// (useSeason().saisonTitree ?? saison), avec son `evolution` : les titres
// Impact et Défensive votés ne sont jamais écrits dans le document de saison
// (votes.ts), et sans eux ni leurs cartes ni leurs points n'existent ici
// (Sabri, 27/10 : la carte Impact de Bilal à la J3, absente de Ma carte alors
// qu'il est au classement Impact). L'évolution porte les titres élus à une
// seule voix, qui ne font pas monter la note : la même que le reste de l'app.

import { ovr, type BoostCardData, type Player } from "./engine";
import { computeBoostCards, computeJournees, computeStandings, entryPP, evolutionDe } from "./saisie/engine";
import { journeeJouee, saisonDepuisArchive } from "./saisie/mutations";
import type { Evolution } from "./saisie/evolution";
import type { Saison } from "./saisie/types";
import { isHidden } from "./hidden";

/** Les saisons, closes puis en cours, de la plus ancienne à la plus récente. */
function toutesLesSaisons(saison: Saison): { s: Saison; nom: string; enCours: boolean }[] {
  const closes = [...(saison.archives ?? [])]
    .sort((a, b) => a.numero - b.numero)
    .map((a) => ({ s: saisonDepuisArchive(a), nom: a.nom, enCours: false }));
  return [...closes, { s: saison, nom: `Saison ${saison.numero ?? 0}`, enCours: true }];
}

/* ------------------------------- Ses cartes ------------------------------- */

export interface CarteSpeciale {
  carte: BoostCardData;
  /** Le joueur tel que la carte l'a figé ce jour-là : à passer à PlayerCard. */
  player: Player;
  j: number;
}

export interface CartesDeSaison {
  numero: number;
  nom: string;
  enCours: boolean;
  /** Sa carte de la saison : sa base d'alors, ses chiffres de la saison. */
  player: Player;
  note: number;
  speciales: CarteSpeciale[];
}

/** Ses cartes, une saison après l'autre, de la plus récente à la plus ancienne. */
export function cartesDeCarriere(saison: Saison, nom: string, evolution?: Evolution): CartesDeSaison[] {
  return toutesLesSaisons(saison)
    .flatMap(({ s, nom: nomSaison, enCours }) => {
      const ev = enCours && evolution ? evolution : evolutionDe(s);
      const player = computeStandings(s, ev).find((p) => p.name === nom);
      if (!player || player.matchs === 0) return [];
      const speciales = computeBoostCards(s, ev)
        .filter((c) => c.player === nom)
        .map((c) => ({
          carte: c,
          player: { ...player, stats: c.stats },
          j: Number(/^J(\d+)/.exec(c.date)?.[1] ?? 0),
        }))
        // La plus haute d'abord : c'est elle qui a le plus de valeur.
        .sort((a, b) => b.carte.ovr - a.carte.ovr || b.j - a.j);
      return [{ numero: s.numero ?? 0, nom: nomSaison, enCours, player, note: ovr(player.stats), speciales }];
    })
    .reverse();
}

/* -------------------------------- Sa courbe -------------------------------- */

export interface PointCourbe {
  saison: number;
  nomSaison: string;
  j: number;
  date: string;
  /** La note de sa carte ce jour-là (celle de la saison). */
  note: number;
  /** La meilleure carte spéciale débloquée ce jour-là, s'il en a eu une. */
  speciale: { type: BoostCardData["type"]; note: number } | null;
  /** Son rang au Pépite d'Or après la journée, et sur combien ; null s'il n'a pas encore joué. */
  rang: number | null;
  sur: number;
  /** A-t-il joué ce jour-là ? */
  joue: boolean;
}

/**
 * Sa courbe : un point par journée jouée par la ligue, toutes saisons à la
 * suite, depuis sa première. Le rang se recalcule après chaque journée,
 * comme le classement le ferait ce soir-là (masqués retirés, sauf lui).
 */
export function courbeDeCarriere(saison: Saison, nom: string, evolution?: Evolution): PointCourbe[] {
  const out: PointCourbe[] = [];
  for (const { s, nom: nomSaison, enCours } of toutesLesSaisons(saison)) {
    const ev = enCours && evolution ? evolution : evolutionDe(s);
    const base = computeStandings(s, ev).find((p) => p.name === nom);
    if (!base) continue;
    const note = ovr(base.stats);
    const speciales = computeBoostCards(s, ev).filter((c) => c.player === nom);
    const jours = [...s.journees].sort((a, b) => a.j - b.j).filter((m) => journeeJouee(s, m.j));

    const pp = new Map<string, number>();
    const joues = new Set<string>();
    for (const m of jours) {
      for (const e of s.entries) {
        if (e.j !== m.j) continue;
        pp.set(e.player, (pp.get(e.player) ?? 0) + (e.extraTime ? (e.pepiteBonus ?? 0) : entryPP(e)));
        if (e.statut === "Présent" && !e.extraTime) joues.add(e.player);
      }
      const classes = [...joues].filter((n) => n === nom || !isHidden(n));
      const mien = pp.get(nom) ?? 0;
      const rang = joues.has(nom) ? 1 + classes.filter((n) => (pp.get(n) ?? 0) > mien).length : null;
      const jour = speciales.filter((c) => c.date.startsWith(`J${m.j} `)).sort((a, b) => b.ovr - a.ovr)[0];
      out.push({
        saison: s.numero ?? 0,
        nomSaison,
        j: m.j,
        date: m.date,
        note,
        speciale: jour ? { type: jour.type, note: jour.ovr } : null,
        rang,
        sur: classes.length,
        joue: s.entries.some((e) => e.j === m.j && e.player === nom && e.statut === "Présent" && !e.extraTime),
      });
    }
  }
  // On commence à sa première journée : avant, il n'y a rien à dessiner.
  const premier = out.findIndex((p) => p.joue);
  return premier < 0 ? [] : out.slice(premier);
}

/* ------------------------------- Face-à-face ------------------------------- */

export interface Bilan3 {
  victoires: number;
  nuls: number;
  defaites: number;
}

export interface FaceAFace {
  /** Les matchs joués dans la même équipe, du point de vue de `a`. */
  ensemble: Bilan3;
  /** Les matchs joués l'un contre l'autre, du point de vue de `a`. */
  contre: Bilan3;
}

const ajoute = (b: Bilan3, r: string | null) => {
  if (r === "Victoire") b.victoires += 1;
  else if (r === "Nul") b.nuls += 1;
  else if (r === "Défaite") b.defaites += 1;
};

/** Les matchs de `a` avec `b` et contre `b`, toutes saisons confondues. */
export function faceAFace(saison: Saison, a: string, b: string): FaceAFace {
  const ensemble: Bilan3 = { victoires: 0, nuls: 0, defaites: 0 };
  const contre: Bilan3 = { victoires: 0, nuls: 0, defaites: 0 };
  for (const { s } of toutesLesSaisons(saison)) {
    for (const jour of computeJournees(s)) {
      for (const m of jour.matches ?? []) {
        const dansA = (n: string) => m.teamA.players.some((p) => p.name === n);
        const dansB = (n: string) => m.teamB.players.some((p) => p.name === n);
        const camp = dansA(a) ? m.teamA : dansB(a) ? m.teamB : null;
        if (!camp) continue;
        // Sa ligne de ce match-là (un joueur peut en avoir une par match du jour).
        const ligne = s.entries.find((e) => e.j === jour.j && e.player === a && e.team === camp.name && e.statut === "Présent" && !e.extraTime);
        if (!ligne) continue;
        if ((dansA(a) && dansA(b)) || (dansB(a) && dansB(b))) ajoute(ensemble, ligne.result);
        else if ((dansA(a) && dansB(b)) || (dansB(a) && dansA(b))) ajoute(contre, ligne.result);
      }
    }
  }
  return { ensemble, contre };
}

