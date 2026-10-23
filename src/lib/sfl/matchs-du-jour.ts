// Les matchs d'une journée, chacun à son heure, à son lieu et sur son terrain.
//
// Sabri, 23/10 : « Dans une journée, il faudrait que je puisse changer
// l'heure de chaque terrain. Et également l'endroit. » Puis : « Noir contre
// blanc, juste match 1 et match 2, c'est ça qui les diffère. Même le terrain
// qu'ils vont occuper […], et l'heure à laquelle ils vont jouer, et même
// l'endroit où ils vont jouer, mais c'est dans la même journée. » Un match
// (« Match 2 ») prend l'heure et le lieu de la journée, sauf ceux que l'admin
// lui a donnés, avec le terrain qu'il occupe sur place
// (JourneeMeta.matchsDuJour, que le moteur reporte sur chaque match).
//
// Partout où l'app dit l'heure d'un dimanche, elle passe par ici : la Map
// (un sticker par lieu), la convocation, la feuille de match, les Missions.
// Le joueur voit l'heure, le lieu et le terrain de son match ; qui n'a pas de
// match voit le premier coup d'envoi. Les Missions ferment au premier coup
// d'envoi pour tout le monde : un joueur de 15h ne doit pas accepter un
// contrat en connaissant déjà le match de 13h.
//
// Pur : aucune lecture de base ni d'écran.

import type { Journee } from "./engine";
import type { Terrain } from "./saisie/types";

export interface MatchResolu {
  /** Sa place dans la journée : 0 pour le Match 1. */
  n: number;
  /** « Match 2 » ; « Le match » quand il est seul. */
  label: string;
  noirs: string[];
  blancs: string[];
  /** Son coup d'envoi : le sien, sinon celui de la journée. */
  heure: string;
  /** Son lieu : le sien, sinon celui de la journée (null : pas encore posé). */
  lieu: Terrain | null;
  /** Le terrain qu'il occupe sur place, « Terrain 3 » ; null quand l'admin ne l'a pas donné. */
  terrain: string | null;
  /** L'admin lui a donné son heure ou son lieu. */
  propre: boolean;
}

/** L'heure et le lieu de la journée : ceux de chaque match qui n'a pas les siens. */
export interface Repli {
  heure: string;
  lieu: Terrain | null;
}

/** « 3 » → « Terrain 3 » ; un autre texte tel quel ; rien → null. */
export function nomDuTerrain(texte: string | undefined): string | null {
  const t = texte?.trim();
  if (!t) return null;
  return /^\d+$/.test(t) ? `Terrain ${t}` : t;
}

/** Les matchs d'une journée, dans l'ordre ; vide tant que les équipes ne sont pas faites. */
export function matchsDeJournee(
  journee: Pick<Journee, "matches"> | undefined,
  lieux: Terrain[],
  repli: Repli
): MatchResolu[] {
  const matches = journee?.matches ?? [];
  const plusieurs = matches.length > 1;
  return matches.map((m, n) => {
    const heure = m.heure?.trim();
    const lieu = m.lieuId != null ? lieux.find((t) => t.id === m.lieuId) : undefined;
    return {
      n,
      label: plusieurs ? `Match ${n + 1}` : "Le match",
      noirs: m.teamA.players.map((p) => p.name),
      blancs: m.teamB.players.map((p) => p.name),
      heure: heure || repli.heure,
      lieu: lieu ?? repli.lieu,
      terrain: nomDuTerrain(m.terrain),
      propre: !!heure || !!lieu,
    };
  });
}

/** Le match où joue ce joueur, ou null. */
export function matchDuJoueur(matchs: MatchResolu[], nom: string): MatchResolu | null {
  return matchs.find((t) => t.noirs.includes(nom) || t.blancs.includes(nom)) ?? null;
}

/** « 13h », « 14h30 », « 13:30 » → les minutes depuis minuit ; null si illisible. */
export function minutesDe(heure: string): number | null {
  const m = heure.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  return m ? Number(m[1]) * 60 + Number(m[2] ?? 0) : null;
}

function extreme(heures: string[], repli: string, plusTot: boolean): string {
  let choisie = repli;
  let cle: number | null = null;
  for (const h of heures) {
    const m = minutesDe(h);
    if (m == null) continue;
    if (cle == null || (plusTot ? m < cle : m > cle)) [choisie, cle] = [h, m];
  }
  return choisie;
}

/** L'heure du match qui se joue le premier ; `repli` sans match. */
export function premierCoupDEnvoi(matchs: Pick<MatchResolu, "heure">[], repli: string): string {
  return extreme(matchs.map((t) => t.heure), repli, true);
}

/** L'heure du match qui se joue le dernier : la journée n'est finie qu'après lui. */
export function dernierCoupDEnvoi(matchs: Pick<MatchResolu, "heure">[], repli: string): string {
  return extreme(matchs.map((t) => t.heure), repli, false);
}

/** Les matchs regroupés par lieu, dans l'ordre où leur premier match arrive. */
export function matchsParLieu(matchs: MatchResolu[]): { lieu: Terrain | null; matchs: MatchResolu[] }[] {
  const groupes: { lieu: Terrain | null; matchs: MatchResolu[] }[] = [];
  for (const t of matchs) {
    const g = groupes.find((x) => (x.lieu?.id ?? null) === (t.lieu?.id ?? null));
    if (g) g.matchs.push(t);
    else groupes.push({ lieu: t.lieu, matchs: [t] });
  }
  return groupes;
}

export interface RendezVous {
  heure: string;
  /** Le nom du lieu. */
  lieu: string;
  /** « Match 2 » quand la journée en a plusieurs et que j'en ai un. */
  match: string | null;
  /** « Terrain 3 » quand l'admin a dit lequel. */
  terrain: string | null;
}

/**
 * Où et à quelle heure un joueur joue : l'heure, le lieu et le terrain de
 * son match ; sans match, le premier coup d'envoi et le lieu de la journée.
 * `lieuTexte` dit le lieu quand aucun lieu de la ligue n'est connu (celui
 * écrit sur la convocation).
 */
export function rendezVousDe(matchs: MatchResolu[], nom: string, repli: Repli, lieuTexte: string): RendezVous {
  const mien = matchDuJoueur(matchs, nom);
  if (mien) {
    return {
      heure: mien.heure,
      lieu: mien.lieu?.nom ?? lieuTexte,
      match: matchs.length > 1 ? mien.label : null,
      terrain: mien.terrain,
    };
  }
  return { heure: premierCoupDEnvoi(matchs, repli.heure), lieu: repli.lieu?.nom ?? lieuTexte, match: null, terrain: null };
}

/** « 14h30 · Croix · Match 2 · Terrain 3 » : la ligne d'une convocation. */
export function ligneDuRendezVous(r: RendezVous): string {
  return [r.heure, r.lieu, r.match, r.terrain].filter(Boolean).join(" · ");
}
