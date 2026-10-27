// Les classements de fin de saison — les badges les plus rares d'un joueur.
// Cinq classements : le Pépite d'Or, les meilleurs buteur, passeur, défenseur
// et MVP. À la clôture d'une saison, les trois premiers de chacun gagnent
// l'écusson : l'or au 1er, l'argent au 2e, le bronze au 3e. Ils le gardent
// pour toujours.
//
// Pendant la saison, rien n'est encore gagné : on montre seulement le rang du
// moment, pour savoir où on en est. Calculé à partir de la saison, rien n'est
// stocké.

import type { Player } from "./engine";
import { deriveSeason } from "./saisie/engine";
import { journeeJouee, saisonDepuisArchive } from "./saisie/mutations";
import type { Saison, SaisonArchivee } from "./saisie/types";
import { isHidden } from "./hidden";
import { rangDans } from "./rangs";

export type ClassementId = "pepite" | "buteur" | "passeur" | "defenseur" | "mvp";

export interface DefClassement {
  id: ClassementId;
  nom: string;
  valeur: (p: Player) => number;
  /** « 12 buts » : l'unité, au singulier et au pluriel. */
  unite: [string, string];
}

export const CLASSEMENTS: DefClassement[] = [
  { id: "pepite", nom: "Pépite d'Or", valeur: (p) => p.pp, unite: ["pt", "pts"] },
  { id: "buteur", nom: "Buteur", valeur: (p) => p.buts, unite: ["but", "buts"] },
  { id: "passeur", nom: "Passeur", valeur: (p) => p.passes, unite: ["passe", "passes"] },
  { id: "defenseur", nom: "Défenseur", valeur: (p) => p.def, unite: ["titre", "titres"] },
  { id: "mvp", nom: "MVP", valeur: (p) => p.mvp, unite: ["MVP", "MVP"] },
];

export interface Podium {
  /** 1, 2 ou 3. */
  rang: number;
  saison: string;
  valeur: number;
}

export interface EtatClassement {
  def: DefClassement;
  /** Le meilleur podium du joueur dans ce classement, saisons closes seulement. */
  meilleur: Podium | null;
  /** Tous ses podiums, de la saison la plus récente à la plus ancienne. */
  podiums: Podium[];
  /** Son rang dans la saison en cours, null si rien n'y est joué ou s'il est à zéro. */
  enCours: { rang: number; valeur: number } | null;
}

/**
 * Le rang d'un joueur : 1 + le nombre de joueurs devant lui, les ex aequo le
 * partagent — la règle des classements (rangs.ts) : les joueurs masqués
 * (Sabri, les arbitres, les places X) ne comptent pas, sauf lui-même.
 */
function rang(players: Player[], nom: string, valeur: (p: Player) => number): { rang: number; valeur: number } | null {
  const r = rangDans(players, nom, valeur, false);
  return r && { rang: r.rang, valeur: r.valeur };
}

/** Une saison close, dérivée comme elle l'était (élus des votes et titres faibles figés à la clôture). */
const joueursDeArchive = (a: SaisonArchivee) => deriveSeason(saisonDepuisArchive(a)).players;

/** Les cinq classements d'un joueur : ses podiums passés et son rang du moment. */
export function finsDeSaison(saison: Saison, nom: string, players: Player[]): EtatClassement[] {
  const closes = (saison.archives ?? []).map((a) => ({ nom: a.nom, players: joueursDeArchive(a) }));
  const jouee = saison.journees.some((m) => journeeJouee(saison, m.j));

  return CLASSEMENTS.map((def) => {
    const podiums: Podium[] = [];
    for (const s of closes) {
      const r = rang(s.players, nom, def.valeur);
      if (r && r.rang <= 3) podiums.push({ rang: r.rang, saison: s.nom, valeur: r.valeur });
    }
    podiums.reverse();
    const meilleur = podiums.reduce<Podium | null>((m, p) => (!m || p.rang < m.rang ? p : m), null);
    return { def, meilleur, podiums, enCours: jouee ? rang(players, nom, def.valeur) : null };
  });
}

/** Tous les podiums d'un classement, saison close par saison close, de la plus récente à la plus ancienne. */
export function podiumsDe(saison: Saison, id: ClassementId, noms?: Set<string>): { nom: string; rang: number; saison: string }[] {
  const def = CLASSEMENTS.find((c) => c.id === id)!;
  const out: { nom: string; rang: number; saison: string }[] = [];
  for (const a of [...(saison.archives ?? [])].reverse()) {
    const players = joueursDeArchive(a);
    const podium: { nom: string; rang: number; saison: string }[] = [];
    for (const p of players) {
      if (noms && !noms.has(p.name)) continue;
      // Un masqué ne monte sur aucun podium public.
      if (isHidden(p.name)) continue;
      const r = rang(players, p.name, def.valeur);
      if (r && r.rang <= 3) podium.push({ nom: p.name, rang: r.rang, saison: a.nom });
    }
    out.push(...podium.sort((x, y) => x.rang - y.rang || x.nom.localeCompare(y.nom)));
  }
  return out;
}

/** « 1er », « 2e »… */
export function ordinal(n: number): string {
  return n === 1 ? "1er" : `${n}e`;
}

/* ------------------------- Les trophées, saison par saison ------------------------- */

// Ce que Ma carte met en vitrine (Sabri, 22/10, d'après la planche « Tous les
// trophées & médailles ») : pour chaque saison close, les vrais trophées
// gagnés — les podiums des cinq classements —, la médaille du Top 15 au
// Pépite d'Or, et le trophée du joueur engagé, que reçoit tout joueur qui a
// disputé plus d'un match dans la saison.

/** Le rang le plus bas qui reçoit une médaille : les quinze premiers du Pépite d'Or. */
export const TOP_MEDAILLE = 15;

export interface TropheesDeSaison {
  saison: string;
  /** Les podiums de la saison, le Pépite d'Or d'abord, puis du 1er au 3e. */
  podiums: { id: ClassementId; rang: number; valeur: number }[];
  /** Son rang final au Pépite d'Or s'il est dans les quinze premiers. */
  top: number | null;
  /** Plus d'un match joué dans la saison. */
  engage: boolean;
}

/** Les trophées d'un joueur, saison close par saison close, de la plus récente à la plus ancienne. */
export function tropheesParSaison(saison: Saison, nom: string): TropheesDeSaison[] {
  return [...(saison.archives ?? [])]
    .sort((a, b) => b.numero - a.numero)
    .map((a) => {
      const players = joueursDeArchive(a);
      const moi = players.find((p) => p.name === nom);
      const podiums = CLASSEMENTS.flatMap((def) => {
        const r = rang(players, nom, def.valeur);
        return r && r.rang <= 3 ? [{ id: def.id, rang: r.rang, valeur: r.valeur }] : [];
      }).sort((x, y) => Number(y.id === "pepite") - Number(x.id === "pepite") || x.rang - y.rang);
      const pepite = rang(players, nom, (p) => p.pp);
      return {
        saison: a.nom,
        podiums,
        top: pepite && pepite.rang <= TOP_MEDAILLE ? pepite.rang : null,
        engage: (moi?.matchs ?? 0) > 1,
      };
    })
    .filter((s) => s.podiums.length || s.top || s.engage);
}
