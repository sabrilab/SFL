// Bola Club : les cartes des joueurs du club évoluent avec les règles Bola
// existantes (bola-app#14 : « saisie rapide des stats → les cartes évoluent
// avec les règles Bola existantes »). Rien n'est réécrit : comme la carte
// d'un joueur Bola (lib/sfl/carte-bola.ts), on donne au moteur des cartes
// (saisie/evolution.ts, evoluer) une saison synthétique où chaque match du
// joueur est une « journée », et on lit ce qu'il rend : les mêmes crans, les
// mêmes jauges, les mêmes combinées, le même plafond.
//
// Ce qui compte, en club (choix par défaut, à confirmer par Sabri) :
//   · les matchs seulement : but → 1 cran de TIR, passe décisive → 1 cran de
//     PAS, MVP → 2 crans sur ses deux meilleures stats, 3 matchs de suite
//     présent et à l'heure → 3 crans de PHY ; un gardien suit son barème
//     (lib/sfl/gardien.ts), un match sans but encaissé compris (pour le
//     seul gardien dans la cage : le premier gardien présent de la feuille). Les
//     entraînements comptent pour l'assiduité (classements.ts), pas pour la
//     carte ;
//   · le MVP est choisi par l'app sur la feuille du match (saisie/mvp.ts,
//     mvpsDuMatch), ex æquo compris. Tout le monde y est de la même équipe :
//     le résultat, le même pour tous, n'entre pas dans la note de match,
//     sinon un 0-0 ferait de chaque présent un MVP ;
//   · la carte officielle change tous les 4 matchs du joueur (convoqué,
//     présent ou non), comme en SFL (JOURNEES_PAR_MAJ) ; entre deux, les
//     points gagnés se lisent « +1 » ;
//   · une saison par joueur : ses matchs le suivent d'une catégorie à
//     l'autre (surclassé, déplacé), sa carte ne redescend jamais. Un absent
//     convoqué casse sa série, rien de plus.
// Un joueur sans match garde sa carte de départ. Pur : ni React ni réseau.

import { ovr, STAT_KEYS, type StatKey, type Stats } from "@/lib/sfl/engine";
import { jourCourt } from "@/lib/sfl/carte-bola";
import { estGardien } from "@/lib/sfl/gardien";
import { evoluer, SAISON_DEPART, SERIE, type CalendrierEvolution, type EvolutionJoueur } from "@/lib/sfl/saisie/evolution";
import { mvpsDuMatch } from "@/lib/sfl/saisie/mvp";
import type { MatchEntry, MatchResult, Saison } from "@/lib/sfl/saisie/types";
import type { Club, Membre, Seance } from "./types";

export const RAISON_SERIE_CLUB = `${SERIE} matchs de suite`;

const resultat = (s: Seance): MatchResult | null =>
  s.score === null ? null : s.score.nous > s.score.eux ? "Victoire" : s.score.nous < s.score.eux ? "Défaite" : "Nul";

/** Les matchs joués, dans l'ordre : le jour, l'heure, puis l'identifiant. */
export function matchsJoues(club: Pick<Club, "seances">): Seance[] {
  return club.seances
    .filter((s) => s.genre === "match" && s.score !== null)
    .sort((a, b) => a.jour.localeCompare(b.jour) || a.heure.localeCompare(b.heure) || a.id.localeCompare(b.id));
}

/** La feuille d'un match, telle que le moteur la lit : une ligne par convoqué. `j` : la journée à écrire. */
export function lignesDuMatch(club: Pick<Club, "membres">, s: Seance, j = 1): MatchEntry[] {
  const poste = new Map(club.membres.map((m) => [m.id, m.poste]));
  // Un seul gardien garde la cage : le premier gardien présent de la feuille prend le match sans but encaissé.
  const dansLaCage = s.convoques.find((id) => estGardien(poste.get(id)) && (s.appel[id] ?? "absent") !== "absent");
  const lignes = s.convoques.map((id): MatchEntry => {
    const etat = s.appel[id] ?? "absent";
    const present = etat !== "absent";
    return {
      j,
      player: id,
      team: null,
      statut: present ? "Présent" : "Absent justifié",
      result: resultat(s),
      sflTime: false,
      buts: present ? (s.stats[id]?.buts ?? 0) : 0,
      passes: present ? (s.stats[id]?.passes ?? 0) : 0,
      cleanSheet: id === dansLaCage && s.score?.eux === 0,
      mvp: false,
      impact: false,
      def: false,
      retard: etat === "retard",
    };
  });
  // Le MVP se lit sur la feuille, sans le résultat (le même pour toute l'équipe).
  const elus = new Set(mvpsDuMatch(lignes.map((l) => ({ ...l, result: null }))));
  return lignes.map((l) => (elus.has(l.player) ? { ...l, mvp: true } : l));
}

/** Les MVP d'un match joué. */
export const mvpsDe = (club: Pick<Club, "membres">, s: Seance): string[] =>
  s.score === null ? [] : lignesDuMatch(club, s).filter((l) => l.mvp).map((l) => l.player);

/** « 7 nov. · AS Exemple » : un match dans le journal d'un joueur. */
export const libelleMatchClub = (s: Seance) => `${jourCourt(s.jour)} · ${s.adversaire ?? "Match"}`;

/** La saison synthétique d'un joueur : un de ses matchs joués par « journée », et le match de chaque journée. */
export function saisonDuMembre(club: Pick<Club, "seances" | "membres">, id: string): { saison: Saison; matchs: Seance[] } {
  const matchs = matchsJoues(club).filter((s) => s.convoques.includes(id));
  return {
    matchs,
    saison: {
      numero: SAISON_DEPART,
      journees: matchs.map((s, i) => ({ j: i + 1, date: libelleMatchClub(s), sflTime: false })),
      roster: [],
      convocations: [],
      entries: matchs.map((s, i) => lignesDuMatch(club, s, i + 1).find((l) => l.player === id)!),
    },
  };
}

export interface CarteClub {
  membre: Membre;
  /** Ce que rend le moteur ; null sans match joué. */
  ev: EvolutionJoueur | null;
  calendrier: CalendrierEvolution | null;
  /** Ses matchs joués, dans l'ordre : le match de la journée j est matchs[j − 1]. */
  matchs: Seance[];
  /** La carte officielle : celle de la dernière mise à jour (ou la carte de départ). */
  stats: Stats;
  note: number;
  /** La carte en direct : l'officielle et les points en attente. */
  enDirect: Stats;
}

const plus = (s: Stats, g: Partial<Record<StatKey, number>>): Stats => {
  const out = { ...s };
  for (const k of STAT_KEYS) out[k] += g[k] ?? 0;
  return out;
};

/** La carte d'un joueur du club, rejouée par le vrai moteur. */
export function carteDuMembre(club: Pick<Club, "seances" | "membres">, membre: Membre): CarteClub {
  const { saison, matchs } = saisonDuMembre(club, membre.id);
  const e = evoluer(saison, () => membre.base, new Set(), { raisonSerie: RAISON_SERIE_CLUB, gardien: () => estGardien(membre.poste) });
  const ev = e.joueurs.get(membre.id) ?? null;
  const stats = ev ? ev.officielles : membre.base;
  return { membre, ev, calendrier: matchs.length ? e.calendrier : null, matchs, stats, note: ovr(stats), enDirect: ev ? plus(ev.officielles, ev.enAttente) : stats };
}

const CARTES = new WeakMap<object, Map<string, CarteClub>>();

/** Les cartes de tout le club, par joueur ; gardées tant que le club ne change pas. */
export function cartesDuClub(club: Club): Map<string, CarteClub> {
  let cartes = CARTES.get(club);
  if (!cartes) {
    cartes = new Map(club.membres.map((m) => [m.id, carteDuMembre(club, m)]));
    CARTES.set(club, cartes);
  }
  return cartes;
}
