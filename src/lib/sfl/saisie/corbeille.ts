// La corbeille de la saison — ce qu'une publication a fait disparaître.
//
// La base garde, à chaque publication, ce que la nouvelle version a perdu
// (table saison_corbeille, remplie par le déclencheur saison_garde_trace de
// schema.sql) : un joueur de l'effectif, une journée avec ses lignes, une
// ligne d'une journée qui reste. Cet écran les lit et les remet.
//
// Remettre, c'est une publication ordinaire : l'élément revient dans la
// saison telle qu'elle est maintenant, sans rien toucher d'autre — jamais un
// retour à un vieux document, qui effacerait les journées saisies depuis.
//
// Le même geste sert au « Annuler » qui suit chaque suppression : l'élément
// supprimé revient à sa place, même si une autre modification a eu lieu
// entre-temps (ce que la pile ⌘Z ne sait pas faire).

import { rosterHasName } from "./mutations";
import type { JourneeMeta, MatchEntry, RosterEntry, Saison } from "./types";

export type ElementCorbeille =
  | { genre: "joueur"; element: RosterEntry; index?: number }
  | { genre: "journee"; element: { journee: JourneeMeta; lignes: MatchEntry[] } }
  | { genre: "ligne"; element: MatchEntry; index?: number };

export interface LigneCorbeille {
  id: number;
  genre: ElementCorbeille["genre"];
  libelle: string;
  element: ElementCorbeille["element"];
  supprime_le: string;
  par: string | null;
}

/** Peut-on le remettre dans la saison telle qu'elle est ? Sinon, pourquoi. */
export function empechement(saison: Saison, x: ElementCorbeille): string | null {
  if (x.genre === "joueur") {
    return rosterHasName(saison, x.element.name) ? "Déjà dans l'effectif" : null;
  }
  if (x.genre === "journee") {
    return saison.journees.some((m) => m.j === x.element.journee.j) ? `La J${x.element.journee.j} existe` : null;
  }
  return saison.journees.some((m) => m.j === x.element.j) ? null : `La J${x.element.j} n'existe plus`;
}

/** La saison avec l'élément remis ; la même saison s'il ne peut pas l'être. */
export function remettre(saison: Saison, x: ElementCorbeille): Saison {
  if (empechement(saison, x)) return saison;
  if (x.genre === "joueur") {
    const roster = [...saison.roster];
    roster.splice(Math.min(x.index ?? roster.length, roster.length), 0, x.element);
    return { ...saison, roster };
  }
  if (x.genre === "journee") {
    return {
      ...saison,
      journees: [...saison.journees, x.element.journee].sort((a, b) => a.j - b.j),
      entries: [...saison.entries, ...x.element.lignes],
    };
  }
  const entries = [...saison.entries];
  entries.splice(Math.min(x.index ?? entries.length, entries.length), 0, x.element);
  return { ...saison, entries };
}

/** Le nom à montrer : « Afid », « J4 · 22 lignes », « Afid · J3 ». */
export function nommer(x: ElementCorbeille): string {
  if (x.genre === "joueur") return x.element.name;
  if (x.genre === "journee") {
    const n = x.element.lignes.length;
    return `J${x.element.journee.j} · ${n} ligne${n > 1 ? "s" : ""}`;
  }
  return `${x.element.player} · J${x.element.j}`;
}

/** Deux éléments identiques, quel que soit l'ordre de leurs clés (jsonb les range). */
export function meme(a: unknown, b: unknown): boolean {
  return canon(a) === canon(b);
}

function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Déjà revenu dans la saison (par « Annuler », ou remis à la main). */
export function dejaLa(saison: Saison, x: ElementCorbeille): boolean {
  if (x.genre === "joueur") return rosterHasName(saison, x.element.name);
  if (x.genre === "journee") return saison.journees.some((m) => m.j === x.element.journee.j);
  return saison.entries.some((e) => meme(e, x.element));
}

/**
 * Retire un élément de la saison ACTUELLE et rend ce qu'il faut pour le
 * remettre. Le joueur se retrouve par son nom, la ligne par son contenu
 * (l'index sert d'indice) : une synchro arrivée pendant la confirmation ne
 * fait pas supprimer le voisin.
 */
export function retirer(
  saison: Saison,
  quoi: { genre: "joueur"; nom: string } | { genre: "journee"; j: number } | { genre: "ligne"; ligne: MatchEntry; index: number }
): { saison: Saison; x: ElementCorbeille } | null {
  if (quoi.genre === "joueur") {
    const index = saison.roster.findIndex((r) => r.name === quoi.nom);
    if (index < 0) return null;
    return {
      saison: { ...saison, roster: saison.roster.filter((_, i) => i !== index) },
      x: { genre: "joueur", element: saison.roster[index], index },
    };
  }
  if (quoi.genre === "journee") {
    const journee = saison.journees.find((m) => m.j === quoi.j);
    if (!journee) return null;
    return {
      saison: {
        ...saison,
        journees: saison.journees.filter((m) => m.j !== quoi.j),
        entries: saison.entries.filter((e) => e.j !== quoi.j),
      },
      x: { genre: "journee", element: { journee, lignes: saison.entries.filter((e) => e.j === quoi.j) } },
    };
  }
  const index = meme(saison.entries[quoi.index], quoi.ligne)
    ? quoi.index
    : saison.entries.findIndex((e) => meme(e, quoi.ligne));
  if (index < 0) return null;
  return {
    saison: { ...saison, entries: saison.entries.filter((_, i) => i !== index) },
    x: { genre: "ligne", element: saison.entries[index], index },
  };
}
