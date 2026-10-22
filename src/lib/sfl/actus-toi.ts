// Ce qui te regarde, toi — les modules des concepts d'Actus (Sabri, 22/10 :
// « quels peuvent être les modules qui vont susciter le plus d'intérêt, qui se
// rapprochent de là où ils mettent leur attention »).
//
// Le journal d'activité des 14 derniers jours (admins exclus) le dit sans
// détour : Ma carte est la page où les joueurs passent le plus de temps, la
// convocation du dimanche est le geste qu'ils font le plus, et les trois
// quarts du temps passé tombent du lundi au mercredi, après le match. Ils
// viennent voir où ils en sont, avec qui ils jouent, et ce qui les attend.
// D'où ces modules, tous tirés des chiffres de la saison :
//   · ta trajectoire : ton rang et tes points au soir de chaque dimanche ;
//   · ton rival      : celui juste devant toi, celui juste derrière, l'écart ;
//   · ton prochain cap : le badge le plus proche et ce qu'il te manque ;
//   · ta série       : tes derniers résultats d'affilée ;
//   · tes partenaires : ceux avec qui tu as le plus joué, et ce que ça donne ;
//   · les enjeux     : les places qui se jouent à un ou deux points.
// Pur : ni React ni réseau. Les joueurs masqués n'y paraissent pas.

import { rankPlayers, type RankedPlayer } from "./engine";
import { isHidden } from "./hidden";
import { computeStandings } from "./saisie/engine";
import { journeeJouee } from "./saisie/mutations";
import type { Saison } from "./saisie/types";
import { prochain, vitrine, type EtatTrophee } from "./trophees";

export interface PasDeTrajectoire {
  j: number;
  rang: number;
  pp: number;
}

const classes = (s: Saison) => rankPlayers(computeStandings(s).filter((p) => !isHidden(p.name)));

/** Les dimanches joués, du premier au dernier. */
export function joues(saison: Saison): number[] {
  return saison.journees
    .map((m) => m.j)
    .filter((j) => journeeJouee(saison, j))
    .sort((a, b) => a - b);
}

/** Ton rang et tes points au soir de chaque dimanche joué. */
export function trajectoire(saison: Saison, moi: string): PasDeTrajectoire[] {
  return joues(saison).flatMap((j) => {
    const r = classes({ ...saison, entries: saison.entries.filter((e) => e.j <= j) }).find((p) => p.name === moi);
    return r ? [{ j, rang: r.rank, pp: r.pp }] : [];
  });
}

export interface Voisins {
  moi: RankedPlayer;
  devant: RankedPlayer | null;
  derriere: RankedPlayer | null;
  total: number;
}

/** Ceux qui t'encadrent au Pépite d'Or. */
export function voisins(saison: Saison, moi: string): Voisins | null {
  const c = classes(saison);
  const i = c.findIndex((p) => p.name === moi);
  if (i < 0) return null;
  const me = c[i];
  const devant = [...c.slice(0, i)].reverse().find((p) => p.pp > me.pp) ?? null;
  const derriere = c.slice(i + 1).find((p) => p.pp < me.pp) ?? null;
  return { moi: me, devant, derriere, total: c.length };
}

/** Le badge le plus proche. */
export function prochainCap(saison: Saison, moi: string): EtatTrophee | null {
  return prochain(vitrine(saison, moi));
}

export interface Serie {
  /** Tes derniers résultats, du plus ancien au plus récent (V, N, D). */
  forme: ("V" | "N" | "D")[];
  /** Matchs d'affilée sans défaite, jusqu'au dernier. */
  invaincu: number;
  /** Victoires d'affilée, jusqu'au dernier. */
  victoires: number;
}

export function serie(saison: Saison, moi: string): Serie {
  const forme = saison.entries
    .filter((e) => e.player === moi && e.statut === "Présent" && !e.extraTime && e.result)
    .sort((a, b) => a.j - b.j)
    .map((e) => (e.result === "Victoire" ? "V" : e.result === "Nul" ? "N" : "D") as "V" | "N" | "D");
  let invaincu = 0;
  for (let i = forme.length - 1; i >= 0 && forme[i] !== "D"; i--) invaincu++;
  let victoires = 0;
  for (let i = forme.length - 1; i >= 0 && forme[i] === "V"; i--) victoires++;
  return { forme: forme.slice(-8), invaincu, victoires };
}

export interface Partenaire {
  nom: string;
  ensemble: number;
  victoires: number;
}

/** Ceux avec qui tu as le plus joué dans la même équipe, et ce que ça a donné. */
export function partenaires(saison: Saison, moi: string, n = 3): Partenaire[] {
  const miens = saison.entries.filter((e) => e.player === moi && e.statut === "Présent" && !e.extraTime && e.team);
  const parNom = new Map<string, Partenaire>();
  for (const m of miens) {
    for (const e of saison.entries) {
      if (e.j !== m.j || e.team !== m.team || e.player === moi || e.statut !== "Présent" || e.extraTime || isHidden(e.player)) continue;
      const p = parNom.get(e.player) ?? { nom: e.player, ensemble: 0, victoires: 0 };
      p.ensemble += 1;
      if (m.result === "Victoire") p.victoires += 1;
      parNom.set(e.player, p);
    }
  }
  return [...parNom.values()].sort((a, b) => b.ensemble - a.ensemble || b.victoires - a.victoires).slice(0, n);
}

export interface Enjeu {
  haut: RankedPlayer;
  bas: RankedPlayer;
  ecart: number;
}

/** Les places qui se jouent au prochain dimanche : deux voisins à `max` points ou moins, dans le haut du classement. */
export function enjeux(saison: Saison, max = 2, haut = 10): Enjeu[] {
  const c = classes(saison).slice(0, haut);
  const out: Enjeu[] = [];
  for (let i = 0; i + 1 < c.length; i++) {
    const ecart = c[i].pp - c[i + 1].pp;
    if (ecart > 0 && ecart <= max) out.push({ haut: c[i], bas: c[i + 1], ecart });
  }
  return out;
}
