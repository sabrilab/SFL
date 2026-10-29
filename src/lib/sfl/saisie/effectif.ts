// Qui peut avoir une ligne sur une feuille de match : la seule porte.
//
// Le 28/10/2026, le compte de Sabri (admin, il ne joue pas) est apparu dans
// les compositions : les sélecteurs de l'admin lisaient l'effectif brut, où
// il est « Actif ». « Ajouter une équipe » prenait 6 noms par ordre
// alphabétique et finissait par tomber sur lui. Désormais, tous les
// sélecteurs de l'admin passent par `effectifJouable`, le moteur ne met dans
// une équipe que des lignes `jouable`, l'enregistrement refuse une ligne
// d'un non-joueur (integrite.ts, I2), et la base aussi (feuille_saine).
//
// Pur : la liste des non-joueurs est posée par hidden.ts (definirNonJoueurs).

import { isArbitre, neJouePas } from "../hidden";
import type { RosterEntry, Saison } from "./types";

export { definirNonJoueurs, neJouePas } from "../hidden";

/** Peut avoir une ligne sur une feuille : ni « ne joue pas », ni arbitre. Une place « X1 » reste jouable. */
export function jouable(nom: string | null | undefined): boolean {
  return !!nom && !!nom.trim() && !neJouePas(nom) && !isArbitre(nom);
}

/**
 * L'effectif des sélecteurs : les seuls joueurs, triés par nom ; ceux de
 * `devant` (les « Je viens » sans place) d'abord.
 */
export function effectifJouable(saison: Pick<Saison, "roster">, devant?: ReadonlySet<string>): RosterEntry[] {
  return saison.roster
    .filter((r) => jouable(r.name))
    .sort((a, b) => {
      const da = devant?.has(a.name) ? 0 : 1;
      const db = devant?.has(b.name) ? 0 : 1;
      return da - db || a.name.localeCompare(b.name, "fr");
    });
}

/** Les noms déjà sur la feuille de la journée `j` (toutes ses lignes, jamais un filtre d'écran). */
export function surLaFeuille(saison: Pick<Saison, "entries">, j: number): Set<string> {
  return new Set(saison.entries.filter((e) => e.j === j && !e.extraTime).map((e) => e.player.trim().toLowerCase()));
}

/** Ce nom est-il déjà sur la feuille de la journée ? Sans casse ni espaces. */
export function dejaSurLaFeuille(saison: Pick<Saison, "entries">, j: number, nom: string): boolean {
  return surLaFeuille(saison, j).has(nom.trim().toLowerCase());
}

/**
 * Où est chaque joueur sur la feuille de la journée : « NOIRS · M1 »,
 * « SANS ÉQUIPE », ou son statut (« ABSENT JUSTIFIÉ »). Clé : le nom sans casse.
 */
export function placementsDeLaJournee(
  saison: Pick<Saison, "entries" | "journees">,
  j: number,
  matchs: readonly { equipes: [string, string] }[]
): Map<string, string> {
  const out = new Map<string, string>();
  const plusieurs = matchs.length > 1;
  for (const e of saison.entries) {
    if (e.j !== j || e.extraTime) continue;
    const i = matchs.findIndex((m) => m.equipes[0] === e.team || m.equipes[1] === e.team);
    const camp = i < 0 ? null : matchs[i].equipes[0] === e.team ? "NOIRS" : "BLANCS";
    const lieu =
      e.statut !== "Présent" ? e.statut.toUpperCase() : camp ? `${camp}${plusieurs ? ` · M${i + 1}` : ""}` : "SANS ÉQUIPE";
    out.set(e.player.trim().toLowerCase(), lieu);
  }
  return out;
}
