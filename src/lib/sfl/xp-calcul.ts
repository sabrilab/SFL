// Le journal d'XP de toute la ligue, en un seul endroit (Ilyes, 01/11/2026 :
// « sur mon téléphone j'en ai plein de déverrouillés […] sur l'ordinateur ils
// sont verrouillés »). Le téléphone (hooks/use-missions.ts,
// useXpLigueCalcule) et le serveur (lib/sfl/xp-serveur.server.ts, la route
// /api/xp/bilan et celle du Pack Afrique 2027) appellent la même fonction : le
// même chiffre des deux côtés, et le serveur fait foi.
//
// Ce que la fonction lit : la saison jugée (les élus des votes posés), les
// réponses aux missions, les votes, les félicitations, les pronos du Flair,
// les recrues, et les matchs Bola de celui qui calcule. Le compte vitrine
// n'y entre jamais (avecVitrineXp reste dans le hook, sur le seul téléphone
// de Sabri).
//
// Pur : ni React ni réseau.

import type { CarteBola } from "./carte-bola";
import { journalXp, type FelicitationXp, type LigneXp, type Reponse, type VoteLeger } from "./missions";
import { ajouterBola, lignesXpBola, missionsPerso } from "./missions-perso";
import { ajouterDefis } from "./defis";
import { ajouterPronos, type Prono } from "./pronos";
import { ajouterRecrues, type MaRecrue, type RecruesJoueur } from "./recrues";
import type { Saison } from "./saisie/types";

export type JournalXp = Map<string, { lignes: LigneXp[]; reussies: number }>;

export interface EntreesXp {
  /** La saison telle qu'on la juge : les élus des votes fermés posés (useSaisonJugee, saisonAvecVotes). */
  jugee: Saison;
  reponses: Reponse[];
  votes: VoteLeger[];
  felicitations: FelicitationXp[];
  pronos: Prono[];
  /** Les recrues de chacun (recrues_de_la_ligue). */
  ligueRecrues: readonly RecruesJoueur[];
  /** Les miennes (mes_recrues), avec mon nom. */
  moi: { nom: string; recrues: readonly MaRecrue[] } | null;
  /** Mes matchs Bola validés (mes_matchs_bola), s'il y en a. */
  bolaCarte: Pick<CarteBola, "nom" | "valides"> | null;
  maintenant: Date;
}

/** Le journal d'XP de chacun, toutes saisons : ce que le Niveau XP, le Passe et le Pack Afrique lisent. */
export function journalComplet(e: EntreesXp): JournalXp {
  const journal = journalXp(e.jugee, e.reponses, e.votes, e.maintenant, e.felicitations);
  ajouterPronos(journal, e.jugee, e.pronos, e.maintenant);
  // Les badges de palier franchis depuis S1 J4 : la prime de leur défi (lib/sfl/defis.ts).
  ajouterDefis(journal, e.jugee);
  // +100 par recrue active, hors du rang (lib/sfl/recrues.ts).
  ajouterRecrues(journal, e.jugee, e.ligueRecrues, e.moi, e.maintenant);
  // Mes matchs Bola validés et mes missions perso (lib/sfl/missions-perso.ts), hors du rang.
  // Gardés si je suis entré en SFL depuis.
  if (e.bolaCarte) {
    const { faites } = missionsPerso(e.bolaCarte.valides, e.maintenant);
    ajouterBola(journal, e.bolaCarte.nom, lignesXpBola(e.bolaCarte.valides, faites, e.jugee, e.maintenant));
  }
  return journal;
}
