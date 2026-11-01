// Les « Je viens » de la convocation, posés sur les terrains de la journée
// (Sabri, 31/10/2026 : « quand je fais ouvrir la journée 5, tu me proposes
// déjà, sur les terrains, les joueurs qui ont répondu présents »).
//
// Une seule fonction, pure, que lisent « Préparer la J5 » et la page de la
// journée :
//   · la feuille n'a encore personne sur ses terrains → les équipes déjà
//     composées pour la convocation s'il y en a (au moins deux pleines),
//     sinon celles du moteur des divisions (composer, au plus TERRAINS_MAX
//     terrains ; qui n'a pas de place reste remplaçant) ;
//   · la feuille a déjà ses joueurs → chacun garde sa place et les venus pas
//     encore placés entrent là où il y en a (completer, jamais de terrain de
//     plus). Un joueur posé à la main sans avoir répondu reste où il est.
// null quand il n'y a rien à poser.

import { completer, composer, divisionsDeLaJournee } from "../equipes-division";
import { sansSuspendus } from "../cartons";
import { matchsDeclares } from "./mutations";
import type { ConvocationTeam, Saison } from "./types";

export function equipesDesVenus(
  saison: Saison,
  j: number,
  venusBruts: string[],
  composees: ConvocationTeam[] | null = null
): ConvocationTeam[] | null {
  // Un suspendu (carton rouge) ne prend pas de place, même s'il a dit « Je viens ».
  const venus = sansSuspendus(saison, j, venusBruts);
  const etat = divisionsDeLaJournee(saison, j);
  const declares = matchsDeclares(saison, j);
  const lignes = saison.entries.filter((e) => e.j === j && !e.extraTime && e.statut === "Présent" && e.team);
  const teams: ConvocationTeam[] = declares.flatMap((m) => m.equipes.map((name) => ({ name, players: lignes.filter((e) => e.team === name).map((e) => e.player) })));
  const places = new Set(teams.flatMap((t) => t.players.map((n) => n.trim().toLowerCase())));

  if (!places.size) {
    const pleines = (composees ?? []).filter((t) => t.players.length > 0);
    if (pleines.length >= 2) return pleines;
    const { teams: neuves } = composer(saison, venus, etat);
    return neuves.length >= 2 ? neuves : null;
  }

  const nouveaux = venus.filter((n) => !places.has(n.trim().toLowerCase()));
  if (!nouveaux.length || teams.length < 2) return null;
  return completer(saison, teams, [...teams.flatMap((t) => t.players), ...nouveaux], etat);
}

/** Combien de joueurs une proposition met sur les terrains. */
export function joueursPoses(teams: ConvocationTeam[] | null): number {
  return (teams ?? []).reduce((n, t) => n + t.players.length, 0);
}
