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
import type { Saison } from "./saisie/types";

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

/** Le rang d'un joueur : 1 + le nombre de joueurs devant lui. Les ex aequo le partagent. */
function rang(players: Player[], nom: string, valeur: (p: Player) => number): { rang: number; valeur: number } | null {
  const moi = players.find((p) => p.name === nom);
  if (!moi || valeur(moi) <= 0) return null;
  const v = valeur(moi);
  return { rang: 1 + players.filter((p) => valeur(p) > v).length, valeur: v };
}

/** Les cinq classements d'un joueur : ses podiums passés et son rang du moment. */
export function finsDeSaison(saison: Saison, nom: string, players: Player[]): EtatClassement[] {
  const closes = (saison.archives ?? []).map((a) => ({ nom: a.nom, players: deriveSeason(saisonDepuisArchive(a)).players }));
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

/** « 1er », « 2e »… */
export function ordinal(n: number): string {
  return n === 1 ? "1er" : `${n}e`;
}
