// Joueurs masqués — présents dans la saison, invisibles dans l'app.
//
// Un joueur masqué garde son compte, sa carte et sa fiche : il se voit
// lui-même, normalement. Mais il n'apparaît dans AUCUNE liste publique —
// ni classement, ni recherche, ni duel, ni convocation, ni catalogue.
//
// C'est volontairement une liste en dur, pas un réglage : masquer quelqu'un
// est une décision d'administration de la ligue, pas une préférence.

export const HIDDEN_PLAYERS = ["Sabri"] as const;

export function isHidden(name: string | null | undefined): boolean {
  return !!name && (HIDDEN_PLAYERS as readonly string[]).includes(name);
}

/** Retire les joueurs masqués de n'importe quelle liste portant un `name`. */
export function publicOnly<T extends { name: string }>(list: T[]): T[] {
  return list.filter((x) => !isHidden(x.name));
}
