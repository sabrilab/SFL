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
//
// Les divisions : celles de la vue figée (useSeason().divisions,
// revelation.ts), que l'appelant donne — le document de l'admin, lui, porte
// déjà les chiffres du direct, qui ne comptent qu'à la révélation.

import { completer, composer, divisionsDeLaJournee, niveaux } from "../equipes-division";
import { etatDivisions, type EtatDivisions } from "../divisions";
import { sansSuspendus } from "../cartons";
import { lireEquipe, type Camp } from "./equipes";
import { matchsDeclares } from "./mutations";
import type { ConvocationTeam, MatchDuJour, Saison } from "./types";

export function equipesDesVenus(
  saison: Saison,
  j: number,
  venusBruts: string[],
  composees: ConvocationTeam[] | null = null,
  divisions: EtatDivisions | null = etatDivisions(saison)
): ConvocationTeam[] | null {
  // Un suspendu (carton rouge) ne prend pas de place, même s'il a dit « Je viens ».
  const venus = sansSuspendus(saison, j, venusBruts);
  const etat = divisionsDeLaJournee(saison, j, divisions);
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

/** Un joueur sous les terrains : pas encore dans un camp, à y glisser. */
export interface VenuAPlacer {
  nom: string;
  /** L'index de sa ligne s'il en a déjà une (sans équipe) ; null : un « Je viens » sans ligne. */
  ligne: number | null;
  /** Où la proposition le met : le match et le camp. null : pas de place proposée. */
  match: number | null;
  camp: Camp | null;
}

/**
 * Les joueurs à placer, rangés sous les terrains (Sabri, 20/11/2026 : « tu me
 * mets les gens qui ont répondu "je viens" en dessous des terrains […] rester
 * appuyé sur l'image du gars et venir le placer sur le terrain », « tu me les
 * tries en fonction du match 1 et du match 2 »).
 *
 * Chacun est rangé sous le match où la proposition (equipesDesVenus) le
 * mettrait, avec son camp ; qui n'y a pas de place est remplaçant. Dans chaque
 * rangée, les meilleurs niveaux d'abord (equipes-division.ts, niveaux : la note
 * de la carte et les points Pépite par match). Les lignes présentes sans
 * équipe y sont aussi, « Je viens » ou non.
 */
export function venusAPlacer(
  saison: Saison,
  j: number,
  declares: readonly MatchDuJour[],
  sansLigne: readonly string[],
  proposition: ConvocationTeam[] | null,
  divisions: EtatDivisions | null = etatDivisions(saison)
): { matchs: { n: number; joueurs: VenuAPlacer[] }[]; remplacants: VenuAPlacer[] } {
  const cle = (n: string) => n.trim().toLowerCase();
  const camps = new Set(declares.flatMap((m) => m.equipes));
  const proposes = new Map<string, { match: number; camp: Camp }>();
  (proposition ?? []).forEach((t, k) => {
    const i = declares.findIndex((m) => m.equipes.includes(t.name));
    const lue = lireEquipe(t.name);
    const match = i >= 0 ? i + 1 : (lue?.n ?? Math.floor(k / 2) + 1);
    const camp: Camp = i >= 0 ? (declares[i].equipes[0] === t.name ? "Noirs" : "Blancs") : (lue?.camp ?? (k % 2 === 0 ? "Noirs" : "Blancs"));
    for (const n of t.players) proposes.set(cle(n), { match, camp });
  });

  const tous: VenuAPlacer[] = [];
  const vus = new Set<string>();
  saison.entries.forEach((e, i) => {
    if (e.j !== j || e.extraTime || e.statut !== "Présent" || (e.team && camps.has(e.team))) return;
    vus.add(cle(e.player));
    tous.push({ nom: e.player, ligne: i, match: null, camp: null, ...proposes.get(cle(e.player)) });
  });
  for (const nom of sansLigne) {
    if (vus.has(cle(nom))) continue;
    vus.add(cle(nom));
    tous.push({ nom, ligne: null, match: null, camp: null, ...proposes.get(cle(nom)) });
  }

  const niveau = niveaux(saison, tous.map((v) => v.nom), divisionsDeLaJournee(saison, j, divisions));
  const valeur = (v: VenuAPlacer) => niveau.get(v.nom)?.valeur ?? 0;
  tous.sort((a, b) => valeur(b) - valeur(a) || a.nom.localeCompare(b.nom, "fr"));

  const numeros = [...new Set(tous.flatMap((v) => (v.match != null ? [v.match] : [])))].sort((a, b) => a - b);
  return {
    matchs: numeros.map((n) => ({ n, joueurs: tous.filter((v) => v.match === n) })),
    remplacants: tous.filter((v) => v.match == null),
  };
}
