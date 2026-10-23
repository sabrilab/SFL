// Les partenaires d'un joueur : ceux avec qui il a joué, et combien de fois —
// les lignes de feuille des journées où ils étaient présents tous les deux,
// saison en cours et archives. « Partenaires » du choix des joueurs d'un
// match (matchs/choisir-joueur.tsx), et les premiers joueurs que l'app
// propose de suivre (invitation-carte.tsx).
//
// PUR : tout vient de la saison déjà en mémoire.

import type { Saison } from "./saisie/types";

/** Nom → nombre de matchs ensemble, du plus fidèle au moins fidèle. */
export function partenaires(saison: Saison, moi: string): Map<string, number> {
  const entrees = [
    ...saison.entries.map((e) => ({ ...e, s: saison.numero ?? 0 })),
    ...(saison.archives ?? []).flatMap((a) => a.entries.map((e) => ({ ...e, s: a.numero }))),
  ].filter((e) => e.statut === "Présent");
  const mesJours = new Set(entrees.filter((e) => e.player === moi).map((e) => `${e.s}-${e.j}`));
  const ensemble = new Map<string, number>();
  for (const e of entrees) {
    if (e.player === moi || !mesJours.has(`${e.s}-${e.j}`)) continue;
    ensemble.set(e.player, (ensemble.get(e.player) ?? 0) + 1);
  }
  return new Map([...ensemble].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")));
}
