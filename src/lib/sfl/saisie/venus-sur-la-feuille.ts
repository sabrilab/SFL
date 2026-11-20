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

import { REGLES_EQUIPES, completer, composer, divisionsDeLaJournee, niveaux } from "../equipes-division";
import { etatDivisions, type EtatDivisions } from "../divisions";
import { sansSuspendus } from "../cartons";
import { estBrouillon } from "./brouillon";
import { lireEquipe, type Camp } from "./equipes";
import { addEntry, changerEquipeAt, ligneNeuve, matchsDeclares, poserEquipes } from "./mutations";
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

/**
 * La compo automatique du brouillon (Sabri, 20/11/2026 : « dès qu'il y a
 * quelqu'un qui rajoute sa présence, tu le fais automatiquement. Tu le mets
 * dans une composition […] Quand j'arrive dans la journée que je vais
 * préparer, je vois le brouillon et je vois ce qui est possible de faire »).
 *
 * Ce que la page de l'admin fait d'elle-même, à l'ouverture et à chaque
 * nouvelle réponse, sur une journée encore en brouillon :
 *   · terrains vides : la proposition entière (equipesDesVenus), comme
 *     « Placer les N Je viens » ;
 *   · un terrain encore vide à côté d'un terrain commencé : les nouveaux
 *     prennent les places que le moteur donnerait à tout le monde
 *     (aLaTailleDuMoteur : 19 venus, c'est 10 et 9, pas 15 et 4) ;
 *   · terrains déjà faits : chaque nouveau entre dans le camp que lui donne
 *     completer (sa division, l'équipe qui a le moins de joueurs), et rien
 *     d'autre ne bouge — ni un joueur placé à la main, ni un remplaçant.
 * Chaque « Je viens » n'est proposé qu'une fois (JourneeMeta.venusVus) : un
 * joueur que l'admin a sorti n'y revient pas tout seul. Sans place (terrains
 * pleins), il reste sous les terrains. null : rien à faire.
 */
export type EntreesAuto =
  | { genre: "composer"; teams: ConvocationTeam[]; vus: string[] }
  | { genre: "entrer"; entrees: { nom: string; equipe: string }[]; vus: string[] }
  | { genre: "voir"; vus: string[] };

export function entreesAuto(
  saison: Saison,
  j: number,
  venus: readonly string[],
  composees: ConvocationTeam[] | null = null,
  divisions: EtatDivisions | null = etatDivisions(saison)
): EntreesAuto | null {
  const meta = saison.journees.find((m) => m.j === j);
  if (!meta || !estBrouillon(meta)) return null;
  const cle = (n: string) => n.trim().toLowerCase();
  const vus = new Set((meta.venusVus ?? []).map(cle));
  const nouveaux = venus.filter((n) => !vus.has(cle(n)));
  if (!nouveaux.length) return null;
  const tousVus = [...new Set([...(meta.venusVus ?? []), ...nouveaux])];

  const declares = matchsDeclares(saison, j);
  const camps = new Set(declares.flatMap((m) => m.equipes));
  const lignes = saison.entries.filter((e) => e.j === j && !e.extraTime && e.statut === "Présent" && e.team && camps.has(e.team));
  if (!lignes.length) {
    // La première compo : la proposition entière (les équipes de la convocation d'abord, s'il y en a).
    const teams = equipesDesVenus(saison, j, nouveaux, vus.size ? null : composees, divisions);
    return teams ? { genre: "composer", teams, vus: tousVus } : { genre: "voir", vus: tousVus };
  }
  const avant = new Map(lignes.map((e) => [cle(e.player), e.team as string]));
  if (declares.some((m) => m.equipes.every((eq) => !lignes.some((e) => e.team === eq)))) {
    const entrees = aLaTailleDuMoteur(saison, j, declares, lignes, nouveaux, divisions);
    return entrees.length ? { genre: "entrer", entrees, vus: tousVus } : { genre: "voir", vus: tousVus };
  }
  const proposees = equipesDesVenus(saison, j, nouveaux, null, divisions);
  // completer peut rééquilibrer un terrain : on ne garde que la place des nouveaux.
  const entrees = (proposees ?? []).flatMap((t) =>
    t.players.filter((n) => !avant.has(cle(n)) && nouveaux.some((x) => cle(x) === cle(n))).map((nom) => ({ nom, equipe: t.name }))
  );
  return entrees.length ? { genre: "entrer", entrees, vus: tousVus } : { genre: "voir", vus: tousVus };
}

/**
 * Un terrain déclaré encore vide : completer remplirait le premier jusqu'à 15
 * avant d'en ouvrir un autre. Ici, le moteur compose tout le monde (placés et
 * nouveaux, autant de terrains que de matchs déclarés) : chaque terrain vise
 * la taille qu'il lui donne, et les nouveaux, dans l'ordre du moteur (son
 * terrain, puis le niveau), prennent les places qui manquent — le leur
 * d'abord, sinon le plus proche, sinon une place libre (15 au plus). Les
 * placés ne bougent pas. Dans un terrain, chaque nouveau va dans l'équipe qui
 * a le moins de joueurs, la plus faible à égalité, du plus fort au moins fort.
 */
function aLaTailleDuMoteur(
  saison: Saison,
  j: number,
  declares: readonly MatchDuJour[],
  lignes: readonly { player: string; team?: string | null }[],
  nouveaux: readonly string[],
  divisions: EtatDivisions | null
): { nom: string; equipe: string }[] {
  const cle = (n: string) => n.trim().toLowerCase();
  const camps = declares.map((m) => m.equipes.map((eq) => lignes.filter((e) => e.team === eq).map((e) => e.player)));
  const places = new Set(camps.flat(2).map(cle));
  const entrants = sansSuspendus(saison, j, [...nouveaux]).filter((n) => !places.has(cle(n)));
  if (!entrants.length) return [];

  const ideal = composer(saison, [...camps.flat(2), ...entrants], divisionsDeLaJournee(saison, j, divisions), declares.length);
  const valeur = (n: string) => ideal.niveaux.get(n)?.valeur ?? 0;
  const terrainIdeal = (n: string) => {
    const t = ideal.terrains.findIndex((x) => x.equipes.some((e) => e.players.includes(n)));
    return t < 0 ? declares.length : t;
  };
  const charge = camps.map((c) => c[0].length + c[1].length);
  const manque = declares.map((_, t) => Math.max(0, (ideal.terrains[t] ? ideal.terrains[t].equipes[0].players.length + ideal.terrains[t].equipes[1].players.length : 0) - charge[t]));
  const plein = REGLES_EQUIPES.maxParTerrain;

  const admis = declares.map(() => [] as string[]);
  const ordre = [...entrants].sort((a, b) => terrainIdeal(a) - terrainIdeal(b) || valeur(b) - valeur(a) || a.localeCompare(b, "fr"));
  for (const nom of ordre) {
    const vise = terrainIdeal(nom);
    const proche = (ts: number[]) => ts.sort((a, b) => Math.abs(a - vise) - Math.abs(b - vise) || a - b)[0];
    const indices = declares.map((_, t) => t);
    const t = proche(indices.filter((x) => manque[x] > 0)) ?? (vise < declares.length ? proche(indices.filter((x) => charge[x] < plein)) : undefined);
    if (t == null) continue;
    manque[t] = Math.max(0, manque[t] - 1);
    charge[t]++;
    admis[t].push(nom);
  }

  const moy = (xs: string[]) => xs.reduce((s, n) => s + valeur(n), 0) / (xs.length || 1);
  return declares.flatMap((m, t) => {
    const [a, b] = [[...camps[t][0]], [...camps[t][1]]];
    return [...admis[t]]
      .sort((x, y) => valeur(y) - valeur(x) || x.localeCompare(y, "fr"))
      .map((nom) => {
        const versA = a.length !== b.length ? a.length < b.length : moy(a) <= moy(b);
        (versA ? a : b).push(nom);
        return { nom, equipe: m.equipes[versA ? 0 : 1] };
      });
  });
}

/** Écrit ce qu'entreesAuto a décidé : les places, puis les « Je viens » vus. */
export function appliquerEntreesAuto(saison: Saison, j: number, r: EntreesAuto | null): Saison {
  if (!r) return saison;
  const meta = saison.journees.find((m) => m.j === j);
  if (!meta) return saison;
  let s = saison;
  if (r.genre === "composer") s = poserEquipes(s, j, r.teams, meta.date);
  if (r.genre === "entrer") {
    for (const { nom, equipe } of r.entrees) {
      const i = s.entries.findIndex((e) => e.j === j && !e.extraTime && e.player.trim().toLowerCase() === nom.trim().toLowerCase());
      s = i >= 0 ? changerEquipeAt(s, i, equipe) : addEntry(s, ligneNeuve(s, j, nom, equipe));
    }
  }
  return { ...s, journees: s.journees.map((m) => (m.j === j ? { ...m, venusVus: r.vus } : m)) };
}

/** Combien de joueurs la compo automatique pose sur les terrains. */
export function posesAuto(r: EntreesAuto | null): number {
  return !r ? 0 : r.genre === "composer" ? joueursPoses(r.teams) : r.genre === "entrer" ? r.entrees.length : 0;
}
