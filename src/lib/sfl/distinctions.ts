// Les distinctions — ce qui fait qu'un joueur se démarque dans les classements.
// Une distinction partagée par plus de trois joueurs n'est pas donnée.
//
// Une distinction revient au premier d'une catégorie (ex aequo compris), et
// seulement s'il y a quelque chose à distinguer : personne n'est « meilleur
// buteur » à zéro but. Le podium du Pépite d'Or s'y ajoute. Calculé à partir
// de la liste des joueurs, rien n'est stocké.

import type { Player } from "./engine";

export type DistinctionId = "pepite" | "podium" | "buteur" | "passeur" | "mvp" | "muraille" | "impact" | "fidele";

export interface Distinction {
  id: DistinctionId;
  /** Le nom du badge, court : il tient dans une pastille. */
  titre: string;
  /** Ce qui l'a valu, avec le chiffre. */
  detail: string;
  /** L'ordre d'importance : la première distinction d'un joueur est son badge principal. */
  rang: number;
}

interface Regle {
  id: Exclude<DistinctionId, "podium">;
  titre: string;
  valeur: (p: Player) => number;
  detail: (n: number) => string;
}

const REGLES: Regle[] = [
  { id: "pepite", titre: "Pépite d'Or", valeur: (p) => p.pp, detail: (n) => `1er au Pépite d'Or · ${n} pts` },
  { id: "buteur", titre: "Buteur", valeur: (p) => p.buts, detail: (n) => `Meilleur buteur · ${n} but${n > 1 ? "s" : ""}` },
  { id: "passeur", titre: "Passeur", valeur: (p) => p.passes, detail: (n) => `Meilleur passeur · ${n} passe${n > 1 ? "s" : ""}` },
  { id: "mvp", titre: "MVP", valeur: (p) => p.mvp, detail: (n) => `Le plus de MVP · ${n}` },
  { id: "muraille", titre: "Muraille", valeur: (p) => p.def, detail: (n) => `Meilleur défenseur · ${n} titre${n > 1 ? "s" : ""}` },
  { id: "impact", titre: "Impact", valeur: (p) => p.impact, detail: (n) => `Le plus d'impact · ${n}` },
  { id: "fidele", titre: "Fidèle", valeur: (p) => p.matchs, detail: (n) => `Le plus présent · ${n} match${n > 1 ? "s" : ""}` },
];

/** Les distinctions de chaque joueur, par nom, rangées de la plus forte à la plus légère. */
export function distinctions(players: Player[]): Map<string, Distinction[]> {
  const out = new Map<string, Distinction[]>();
  const ajouter = (nom: string, d: Distinction) => out.set(nom, [...(out.get(nom) ?? []), d]);

  REGLES.forEach((r, i) => {
    const max = Math.max(0, ...players.map(r.valeur));
    if (max <= 0) return;
    // Partagée par plus de trois joueurs, une distinction ne distingue personne.
    const premiers = players.filter((p) => r.valeur(p) === max);
    if (premiers.length > 3) return;
    for (const p of premiers) if (r.valeur(p) === max) ajouter(p.name, { id: r.id, titre: r.titre, detail: r.detail(max), rang: i * 2 });
  });

  // Le podium du Pépite d'Or (2e et 3e ; le 1er a déjà sa distinction).
  const pps = [...new Set(players.map((p) => p.pp))].filter((n) => n > 0).sort((a, b) => b - a);
  pps.slice(1, 3).forEach((pp, k) => {
    if (players.filter((p) => p.pp === pp).length > 3) return;
    for (const p of players)
      if (p.pp === pp) ajouter(p.name, { id: "podium", titre: `${k + 2}e`, detail: `${k + 2}e au Pépite d'Or · ${pp} pts`, rang: 1 + k * 0.5 });
  });

  for (const [nom, ds] of out) out.set(nom, ds.sort((a, b) => a.rang - b.rang));
  return out;
}

/** Les joueurs qui se démarquent, du plus distingué au moins : un par distinction principale. */
export function demarques(players: Player[], max = 8): { player: Player; distinctions: Distinction[] }[] {
  const parNom = distinctions(players);
  return players
    .filter((p) => parNom.has(p.name))
    .map((p) => ({ player: p, distinctions: parNom.get(p.name)! }))
    .sort((a, b) => a.distinctions[0].rang - b.distinctions[0].rang || b.distinctions.length - a.distinctions.length || b.player.pp - a.player.pp)
    .slice(0, max);
}
