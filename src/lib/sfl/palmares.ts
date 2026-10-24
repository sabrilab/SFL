// Le Wall of Fame — l'histoire de la ligue, saison après saison.
//
// Toutes les saisons, closes (archives) et en cours, rejouées dans le moteur
// exactement comme ailleurs dans l'app : mêmes classements, mêmes journées.
// On en tire trois lectures, de la plus simple à la plus détaillée :
//   1. les saisons, chacune avec son champion et son podium ;
//   2. les légendes, les records de carrière tous dimanches confondus ;
//   3. le parcours d'un joueur, saison par saison : rang, victoires, nuls,
//      défaites, buts et passes.
// Calculé à partir du document de saison, rien n'est stocké.

import { rankPlayers, type Player, type RankedPlayer } from "./engine";
import { deriveSeason } from "./saisie/engine";
import { journeeJouee, saisonDepuisArchive } from "./saisie/mutations";
import type { Saison } from "./saisie/types";
import { publicOnly } from "./hidden";

export interface Bilan {
  victoires: number;
  nuls: number;
  defaites: number;
}

export interface Lauriers {
  player: Player;
  n: number;
}

export interface SaisonPalmares {
  numero: number;
  nom: string;
  /** Date de clôture ISO ; null pour la saison en cours. */
  cloturee: string | null;
  journees: number;
  buts: number;
  /** Les joueurs classés (masqués retirés), du 1er au dernier. */
  classement: RankedPlayer[];
  /** Le même classement, masqués compris : un joueur masqué voit son propre parcours. */
  tous: RankedPlayer[];
  /** Le podium du Pépite d'Or : rangs 1 à 3, ex aequo compris. */
  podium: RankedPlayer[];
  /** Les meilleurs de chaque catégorie (le premier, s'il y a quelque chose à distinguer). */
  buteur: Lauriers | null;
  passeur: Lauriers | null;
  mvp: Lauriers | null;
  /** Victoires, nuls et défaites de chacun, par nom. */
  bilans: Map<string, Bilan>;
}

function meilleur(players: Player[], valeur: (p: Player) => number): Lauriers | null {
  const top = [...players].sort((a, b) => valeur(b) - valeur(a) || b.pp - a.pp)[0];
  return top && valeur(top) > 0 ? { player: top, n: valeur(top) } : null;
}

function lire(s: Saison, nom: string, cloturee: string | null): SaisonPalmares {
  const derived = deriveSeason(s);
  const tous = rankPlayers(derived.players.filter((p) => p.matchs > 0));
  const classement = rankPlayers(publicOnly(tous));
  const jouees = derived.journees.filter((j) => journeeJouee(s, j.j));
  const buts = jouees.reduce(
    (t, j) => t + (j.matches ?? []).reduce((u, m) => u + m.teamA.score + m.teamB.score, 0),
    0
  );

  const bilans = new Map<string, Bilan>();
  for (const e of s.entries) {
    if (e.statut !== "Présent" || e.extraTime || !e.result) continue;
    const b = bilans.get(e.player) ?? { victoires: 0, nuls: 0, defaites: 0 };
    if (e.result === "Victoire") b.victoires += 1;
    else if (e.result === "Nul") b.nuls += 1;
    else b.defaites += 1;
    bilans.set(e.player, b);
  }

  return {
    numero: s.numero ?? 0,
    nom,
    cloturee,
    journees: jouees.length,
    buts,
    classement,
    tous,
    podium: classement.filter((p) => p.pp > 0 && p.rank <= 3),
    buteur: meilleur(classement, (p) => p.buts),
    passeur: meilleur(classement, (p) => p.passes),
    mvp: meilleur(classement, (p) => p.mvp),
    bilans,
  };
}

/** Toutes les saisons, de la plus récente à la plus ancienne. La saison en cours n'y est que si elle a commencé. */
export function saisonsPalmares(saison: Saison): SaisonPalmares[] {
  const closes = (saison.archives ?? []).map((a) => lire(saisonDepuisArchive(a), a.nom, a.cloturee));
  const enCours = lire(saison, `Saison ${saison.numero ?? 0}`, null);
  return [...(enCours.journees > 0 ? [enCours] : []), ...[...closes].sort((a, b) => b.numero - a.numero)];
}

export interface Legende {
  player: Player;
  saisons: number;
  matchs: number;
  /** Les points Pépite d'Or de toutes ses saisons. */
  points: number;
  buts: number;
  passes: number;
  mvp: number;
  victoires: number;
  /** Saisons closes gagnées au Pépite d'Or. */
  titres: number;
  /** Saisons closes finies sur le podium. */
  podiums: number;
}

/** Les totaux de carrière de chaque joueur, toutes saisons confondues. */
export function legendes(saisons: SaisonPalmares[]): Legende[] {
  const out = new Map<string, Legende>();
  // De la plus ancienne à la plus récente : la carte retenue est la dernière.
  for (const s of [...saisons].reverse()) {
    for (const p of s.classement) {
      const l = out.get(p.name) ?? { player: p, saisons: 0, matchs: 0, points: 0, buts: 0, passes: 0, mvp: 0, victoires: 0, titres: 0, podiums: 0 };
      l.player = p;
      l.saisons += 1;
      l.matchs += p.matchs;
      l.points += p.pp;
      l.buts += p.buts;
      l.passes += p.passes;
      l.mvp += p.mvp;
      l.victoires += s.bilans.get(p.name)?.victoires ?? 0;
      if (s.cloturee && s.podium.some((x) => x.name === p.name)) {
        l.podiums += 1;
        if (p.rank === 1) l.titres += 1;
      }
      out.set(p.name, l);
    }
  }
  return [...out.values()];
}

export interface EtapeParcours {
  saison: SaisonPalmares;
  rang: number;
  sur: number;
  player: RankedPlayer;
  bilan: Bilan;
}

/** Le parcours d'un joueur : une étape par saison jouée, de la plus récente à la plus ancienne. */
export function parcours(saisons: SaisonPalmares[], nom: string): EtapeParcours[] {
  return saisons.flatMap((s) => {
    const player = s.tous.find((p) => p.name === nom);
    if (!player) return [];
    return [{ saison: s, rang: player.rank, sur: s.tous.length, player, bilan: s.bilans.get(nom) ?? { victoires: 0, nuls: 0, defaites: 0 } }];
  });
}
