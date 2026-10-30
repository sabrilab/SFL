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

// Les places « X1 », « X2 »… : des joueurs qui n'existent pas, posés sur la
// feuille pour compléter une équipe (Sabri, 25/10). Ils ne remontent dans
// aucun classement. Mieux : la ligne du vrai joueur, case Xtratime cochée.
export function isPlaceExtraTime(name: string | null | undefined): boolean {
  return !!name && /^X\d+$/i.test(name.trim());
}

// Les membres qui ne jouent pas (profiles.joue = false, 30/10/2026) : un
// admin qui organise sans jouer. « Ne joue pas » est une donnée du compte,
// plus un nom écrit en dur ; tant que la base n'a pas répondu, la liste de
// départ est HIDDEN_PLAYERS, exactement la même aujourd'hui (rien ne
// clignote). Comparés sans casse ni espaces.
const cleNom = (n: string) => n.trim().toLowerCase();
let nonJoueurs: ReadonlySet<string> = new Set(HIDDEN_PLAYERS.map(cleNom));
let revisionNonJoueurs = 0;

/** Pose la liste des membres qui ne jouent pas (non-joueurs.ts, saison-serveur.server.ts). */
export function definirNonJoueurs(noms: readonly string[]): void {
  const next = new Set(noms.map(cleNom));
  if (next.size === nonJoueurs.size && [...next].every((n) => nonJoueurs.has(n))) return;
  nonJoueurs = next;
  revisionNonJoueurs++;
}

/** Change à chaque nouvelle liste : pour les mémos qui en dépendent. */
export function nonJoueursRevision(): number {
  return revisionNonJoueurs;
}

/** Ce membre ne joue pas (il organise) : aucune ligne, aucune équipe. */
export function neJouePas(name: string | null | undefined): boolean {
  return !!name && nonJoueurs.has(cleNom(name));
}

export function isHidden(name: string | null | undefined): boolean {
  return !!name && ((HIDDEN_PLAYERS as readonly string[]).includes(name) || neJouePas(name) || arbitres.has(name) || isPlaceExtraTime(name));
}

/** Retire les joueurs masqués de n'importe quelle liste portant un `name`. */
export function publicOnly<T extends { name: string }>(list: T[]): T[] {
  return list.filter((x) => !isHidden(x.name));
}
