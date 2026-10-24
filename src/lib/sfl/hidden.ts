// Joueurs masqués — présents dans la saison, invisibles dans l'app.
//
// Un joueur masqué garde son compte, sa carte et sa fiche : il se voit
// lui-même, normalement. Mais il n'apparaît dans AUCUNE liste publique —
// ni classement, ni recherche, ni duel, ni convocation, ni catalogue.
//
// C'est volontairement une liste en dur, pas un réglage : masquer quelqu'un
// est une décision d'administration de la ligue, pas une préférence.

export const HIDDEN_PLAYERS = ["Sabri"] as const;

// Les arbitres (lib/sfl/arbitres.ts) ne jouent pas : ils ont leur compte et
// leur carte d'arbitre, mais ne remontent dans aucune liste de joueurs. Leur
// liste vient de la base (profiles.arbitre) ; arbitres.ts la pose ici.
let arbitres: ReadonlySet<string> = new Set();

/** Pose la liste des arbitres, en noms de saison (arbitres.ts). */
export function definirArbitres(noms: readonly string[]): void {
  arbitres = new Set(noms);
}

/** Ce nom est-il celui d'un arbitre ? */
export function isArbitre(name: string | null | undefined): boolean {
  return !!name && arbitres.has(name);
}

export function isHidden(name: string | null | undefined): boolean {
  return !!name && ((HIDDEN_PLAYERS as readonly string[]).includes(name) || arbitres.has(name));
}

/** Retire les joueurs masqués de n'importe quelle liste portant un `name`. */
export function publicOnly<T extends { name: string }>(list: T[]): T[] {
  return list.filter((x) => !isHidden(x.name));
}
