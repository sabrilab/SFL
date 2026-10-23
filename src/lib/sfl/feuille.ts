// La feuille de match : qui joue avec qui, et contre qui, terrain par terrain.
//
// C'était l'image qu'on s'envoyait sur Snap avant l'app. Elle se lit
// maintenant dans la fiche du match (Map) et se partage en image.
//
// Deux sources, une seule forme :
//   · une journée de ligue : ses lignes de saisie portent l'équipe du jour,
//     et le moteur apparie déjà les équipes deux à deux (saisie/engine.ts) ;
//   · la convocation du dimanche, tant qu'aucune journée n'existe : les
//     équipes composées par l'admin, révélées le vendredi à 19h.
//
// Sur la feuille, chaque match se joue les Noirs contre les Blancs (décision
// de Sabri, 17/10) : la couleur du jour de l'admin (Orange, Bleu…) n'y paraît
// pas ; la première équipe de chaque paire prend le noir, la seconde le blanc
// (lib/sfl/maillots.ts, que suivent aussi les récaps).
//
// Ici, rien que des calculs : les terrains, et où poser chaque joueur sur son
// demi-terrain.

import type { Journee } from "@/lib/sfl/engine";
import { MAILLOTS } from "@/lib/sfl/maillots";
import type { ConvocationTeam } from "@/lib/sfl/saisie/types";

export interface EquipeFeuille {
  nom: string;
  /** Le fond de l'équipe (pastille du nom, point), et l'encre posée dessus. */
  couleur: string;
  encre: string;
  joueurs: string[];
}

export interface TerrainFeuille {
  label: string;
  a: EquipeFeuille;
  b: EquipeFeuille;
}

const { noirs: NOIRS, blancs: BLANCS } = MAILLOTS;
const noirs = (joueurs: string[]): EquipeFeuille => ({ nom: NOIRS.nom, couleur: NOIRS.fond, encre: NOIRS.encre, joueurs });
const blancs = (joueurs: string[]): EquipeFeuille => ({ nom: BLANCS.nom, couleur: BLANCS.fond, encre: BLANCS.encre, joueurs });

/** Les terrains d'une journée de ligue ; vide tant que les équipes ne sont pas faites. */
export function feuilleDeJournee(journee: Journee | undefined): TerrainFeuille[] {
  if (!journee?.matches?.length) return [];
  const plusieurs = journee.matches.length > 1;
  return journee.matches.map((m, i) => ({
    label: plusieurs ? `Terrain ${i + 1}` : "Le match",
    a: noirs(m.teamA.players.map((p) => p.name)),
    b: blancs(m.teamB.players.map((p) => p.name)),
  }));
}

/** Les terrains de la convocation : ses équipes appariées deux à deux. */
export function feuilleDeConvocation(teams: ConvocationTeam[] | null): TerrainFeuille[] {
  const pleines = (teams ?? []).filter((t) => t.players.length > 0);
  const out: TerrainFeuille[] = [];
  const plusieurs = pleines.length > 3;
  for (let i = 0; i + 1 < pleines.length; i += 2) {
    out.push({
      label: plusieurs ? `Terrain ${i / 2 + 1}` : "Le match",
      a: noirs(pleines[i].players),
      b: blancs(pleines[i + 1].players),
    });
  }
  return out;
}

/** Le terrain où je joue, sinon le premier. */
export function monTerrain(terrains: TerrainFeuille[], moi: string): number {
  const i = terrains.findIndex((t) => t.a.joueurs.includes(moi) || t.b.joueurs.includes(moi));
  return Math.max(0, i);
}

/**
 * Où poser les joueurs d'une équipe sur sa moitié de terrain, en pourcentages
 * d'un terrain vu de côté (la profondeur va de 0, le fond de son but, à 50,
 * la ligne médiane ; la largeur de 0 à 100). Le premier garde le but, les
 * autres montent en deux lignes, comme le cinq de l'Arène : deux derrière,
 * deux devant.
 */
export function placesSurDemiTerrain(n: number): { profondeur: number; largeur: number }[] {
  if (n === 0) return [];
  const out = [{ profondeur: 8, largeur: 50 }];
  const reste = n - 1;
  const derriere = Math.ceil(reste / 2);
  const ligne = (combien: number, profondeur: number) => {
    for (let i = 0; i < combien; i++) {
      const largeur = combien === 1 ? 50 : 25 + (i * 50) / (combien - 1);
      out.push({ profondeur, largeur });
    }
  };
  ligne(derriere, 24);
  ligne(reste - derriere, 40);
  return out;
}
