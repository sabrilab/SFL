// Les équipes d'un dimanche en divisions (Sabri, 23/10 : « Les matchs sont
// créés automatiquement en fonction des joueurs des divisions, de leur score,
// de leurs statistiques et des matchs qu'ils ont déjà joués, avec ou contre
// le joueur. Comme ça, c'est plus l'admin qui doit sélectionner »).
//
// Entrée : la saison et ceux qui viennent. Sortie : les équipes de la
// convocation, un match par terrain, les Noirs puis les Blancs (« Noirs 1 »
// contre « Blancs 1 », saisie/equipes.ts), dans l'ordre des terrains : la D1
// joue le Match 1. feuille.ts et la saisie les apparient deux à deux.
//
//   1. Les terrains. Chaque division joue sur le sien (divisions.ts), la D1
//      sur le premier. Une division de moins de 8 joueurs rejoint sa voisine
//      la moins remplie ; au-delà de 15, elle prend un terrain de plus, les
//      meilleurs niveaux ensemble. Jamais plus de TERRAINS_MAX terrains
//      (incident de la J4, 29/10) : au-delà, les divisions voisines jouent
//      ensemble au lieu d'ouvrir un terrain, et qui ne tient pas dans les
//      places (TERRAINS_MAX × 15) reste remplaçant, dans l'ordre d'arrivée.
//   2. Le niveau de chacun : la note de sa carte et ses points Pépite par
//      match, à parts égales, en écarts à la moyenne de ceux qui viennent. Les
//      points par match prennent la saison entière et les saisons d'avant pour
//      moitié, tirés vers la moyenne de la ligue tant qu'il a peu joué. Qui
//      n'a jamais joué compte sur sa note seule.
//   3. Sur chaque terrain, toutes les façons de faire deux équipes sont
//      essayées. D'abord un gardien de chaque côté quand il y en a ; puis les
//      plus équilibrées (à 0,05 près de la meilleure) ; parmi elles, celle qui
//      mélange le plus : deux joueurs qui ont souvent joué ensemble passent
//      l'un contre l'autre, deux qui se sont souvent affrontés jouent
//      ensemble.
//
// Les réponses tardives (completer) : un nouveau venu entre sur le terrain de
// sa division, dans l'équipe qui a le moins de joueurs, sans rien rebattre ;
// qui se désiste en sort. completer ne crée jamais d'équipe ni de terrain :
// un terrain plein (15) ne prend plus personne, et le retardataire reste
// remplaçant jusqu'à ce qu'une place se libère. C'est tout ce que peut faire
// le téléphone d'un joueur (/api/divisions/equipes) ; composer est réservé
// au cron du vendredi et à l'admin.
//
// Le calendrier (bas du fichier) : les équipes se composent le vendredi à
// 18 h, une heure avant d'être révélées (convocation-temps.ts), avec toutes
// les réponses de la semaine, et se tiennent à jour jusqu'au coup d'envoi.
//
// Déterministe : la même saison et les mêmes joueurs donnent les mêmes
// équipes, sur le serveur (/api/divisions/equipes) comme sur le téléphone de
// l'admin (admin/equipes-dimanche.tsx). Pur, pour se vérifier seul
// (tools/equipes-division-check.ts).

import { instantParis } from "./convocation-temps";
import { ovr, rareStats } from "./engine";
import { DIVISIONS, divisionDe, etatDivisions, nomDivision, REGLES_DIVISIONS, type Division, type EtatDivisions } from "./divisions";
import { isHidden } from "./hidden";
import { heureMin } from "./ligue-vierge";
import { journeeDuJour } from "./presence-feuille";
import { computeJournees, computeStandings, entryPP } from "./saisie/engine";
import { equipesDuMatch } from "./saisie/equipes";
import { journeeJouee, saisonDepuisArchive } from "./saisie/mutations";
import type { ConvocationTeam, Saison } from "./saisie/types";

/**
 * Le nombre de terrains du dimanche, au plus (l'Hippodrome). Seul endroit à
 * changer : composer, completer, l'aperçu et les confirmations de l'admin le
 * lisent tous ici. 2 en attendant la réponse de Sabri (incident de la J4,
 * 29/10 : un terrain par division, plus un au-delà de 15 joueurs, et rien ne
 * limitait leur nombre). À CONFIRMER PAR SABRI.
 */
export const TERRAINS_MAX = 2;

export const REGLES_EQUIPES = {
  /** Au-delà, une division prend un terrain de plus ; c'est aussi le plein d'un terrain (TERRAINS_MAX). */
  maxParTerrain: 15,
  /** En dessous, une division joue avec sa voisine. */
  minParTerrain: 8,
  /** L'écart de niveau accepté pour mieux mélanger, en écart-type. */
  tolerance: 0.05,
  /** Le poids des saisons d'avant dans les points par match. */
  poidsCarriere: 0.5,
  /** Des matchs « à la moyenne » ajoutés à chacun : qui a peu joué reste près de la moyenne. */
  lissage: 2,
} as const;

export interface Niveau {
  nom: string;
  division: Division;
  /** La note de sa carte (Rare). */
  note: number;
  /** Ses points Pépite par match, lissés ; null s'il n'a jamais joué. */
  ppm: number | null;
  /** Le niveau retenu, en écarts-types autour de la moyenne de ceux qui viennent. */
  valeur: number;
  gardien: boolean;
}

export interface TerrainCompose {
  /** Les divisions qui y jouent : deux quand une division trop courte a rejoint sa voisine. */
  divisions: Division[];
  equipes: [ConvocationTeam, ConvocationTeam];
  /** L'écart de niveau moyen entre les deux équipes, en écart-type. */
  ecart: number;
}

export interface Composition {
  terrains: TerrainCompose[];
  /** Les équipes dans l'ordre des terrains : ce que la convocation garde. */
  teams: ConvocationTeam[];
  /** Ceux qui viennent sans place sur les TERRAINS_MAX terrains, dans l'ordre d'arrivée. */
  remplacants: string[];
  niveaux: Map<string, Niveau>;
}

/* ------------------------------ L'historique ------------------------------ */

const cle = (a: string, b: string) => (a < b ? `${a}\u0001${b}` : `${b}\u0001${a}`);

/** Ce que chaque paire a déjà vécu, toutes saisons : les matchs ensemble, ceux l'un contre l'autre. */
export interface Historique {
  ensemble: Map<string, number>;
  contre: Map<string, number>;
}

function saisons(saison: Saison): Saison[] {
  return [...(saison.archives ?? [])].sort((a, b) => a.numero - b.numero).map(saisonDepuisArchive).concat(saison);
}

export function historique(saison: Saison): Historique {
  const ensemble = new Map<string, number>();
  const contre = new Map<string, number>();
  const plus = (m: Map<string, number>, a: string, b: string) => {
    if (a !== b) m.set(cle(a, b), (m.get(cle(a, b)) ?? 0) + 1);
  };
  for (const s of saisons(saison)) {
    for (const jour of computeJournees(s)) {
      // Une feuille composée mais pas encore jouée n'a rien appris à personne.
      if (!journeeJouee(s, jour.j)) continue;
      for (const m of jour.matches ?? []) {
        const a = m.teamA.players.map((p) => p.name);
        const b = m.teamB.players.map((p) => p.name);
        for (const eq of [a, b]) for (let i = 0; i < eq.length; i++) for (let k = i + 1; k < eq.length; k++) plus(ensemble, eq[i], eq[k]);
        for (const x of a) for (const y of b) plus(contre, x, y);
      }
    }
  }
  return { ensemble, contre };
}

/** Plus c'est haut, plus ces deux-là gagnent à jouer ensemble : souvent l'un contre l'autre, rarement côte à côte. */
function aRassembler(h: Historique, a: string, b: string): number {
  return (h.contre.get(cle(a, b)) ?? 0) - (h.ensemble.get(cle(a, b)) ?? 0);
}

/* -------------------------------- Le niveau -------------------------------- */

const moyenneEt = (xs: number[]) => {
  const m = xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length || 1);
  return { m, e: Math.sqrt(v) };
};
const centre = (x: number, { m, e }: { m: number; e: number }) => (e > 0 ? (x - m) / e : 0);

/** Le niveau de chacun de `noms`, rapporté à ceux-là. */
export function niveaux(saison: Saison, noms: string[], etat: EtatDivisions | null): Map<string, Niveau> {
  const { poidsCarriere, lissage } = REGLES_EQUIPES;
  // Les points par match : la saison en cours pleine, celles d'avant pour moitié.
  const total = new Map<string, { pts: number; matchs: number }>();
  for (const s of saisons(saison)) {
    const poids = s === saison ? 1 : poidsCarriere;
    const jouees = new Set(s.journees.map((m) => m.j).filter((j) => journeeJouee(s, j)));
    for (const e of s.entries) {
      if (e.statut !== "Présent" || e.extraTime || !jouees.has(e.j)) continue;
      const x = total.get(e.player) ?? { pts: 0, matchs: 0 };
      x.pts += entryPP(e) * poids;
      x.matchs += poids;
      total.set(e.player, x);
    }
  }
  let pts = 0;
  let matchs = 0;
  for (const x of total.values()) {
    pts += x.pts;
    matchs += x.matchs;
  }
  const ligue = matchs > 0 ? pts / matchs : 0;

  const fiche = new Map(saison.roster.map((r) => [r.name, r]));
  const notes = new Map(computeStandings(saison).map((p) => [p.name, ovr(rareStats(p.stats))]));
  const connues = noms.map((n) => notes.get(n)).filter((n): n is number => n != null);
  const noteParDefaut = connues.length ? [...connues].sort((a, b) => a - b)[Math.floor(connues.length / 2)] : 75;

  const bruts = noms.map((nom) => {
    const x = total.get(nom);
    return {
      nom,
      division: etat ? divisionDe(etat, nom) : (3 as Division),
      note: notes.get(nom) ?? noteParDefaut,
      ppm: x && x.matchs > 0 ? (x.pts + lissage * ligue) / (x.matchs + lissage) : null,
      gardien: /^G\b/.test(fiche.get(nom)?.poste ?? ""),
    };
  });
  const surNote = moyenneEt(bruts.map((b) => b.note));
  const surPoints = moyenneEt(bruts.flatMap((b) => (b.ppm == null ? [] : [b.ppm])));
  return new Map(
    bruts.map((b) => {
      const n = centre(b.note, surNote);
      const valeur = b.ppm == null ? n : (n + centre(b.ppm, surPoints)) / 2;
      return [b.nom, { ...b, valeur }];
    })
  );
}

/** Du plus fort au moins fort ; à niveau égal, l'ordre des noms. */
const parNiveau = (a: Niveau, b: Niveau) => b.valeur - a.valeur || a.nom.localeCompare(b.nom, "fr");

/* ------------------------------- Les terrains ------------------------------- */

const lesDivisions = (joueurs: Niveau[]) => [...new Set(joueurs.map((p) => p.division))].sort((a, b) => a - b);

/** Une division par terrain, sauf trop courte ou trop pleine : le calcul sans plafond. */
function parDivision(joueurs: Niveau[]): Niveau[][] {
  const { minParTerrain, maxParTerrain } = REGLES_EQUIPES;
  const groupes = DIVISIONS.map((d) => joueurs.filter((p) => p.division === d)).filter((g) => g.length > 0);
  // La plus courte des divisions trop courtes rejoint sa voisine la moins
  // remplie (celle du dessus à égalité), jusqu'à ce que toutes tiennent.
  for (;;) {
    const courtes = groupes.map((g, i) => ({ i, n: g.length })).filter((x) => x.n < minParTerrain);
    if (groupes.length < 2 || !courtes.length) break;
    const { i } = courtes.sort((a, b) => a.n - b.n || a.i - b.i)[0];
    const v = [i - 1, i + 1].filter((x) => x >= 0 && x < groupes.length).sort((x, y) => groupes[x].length - groupes[y].length || x - y)[0];
    const debut = Math.min(i, v);
    groupes.splice(debut, 2, [...groupes[debut], ...groupes[debut + 1]]);
  }
  // Trop pleine : un terrain de plus, par tranches de niveau.
  return groupes.flatMap((g) => trancher([...g].sort(parNiveau), Math.ceil(g.length / maxParTerrain)));
}

/** `tries` en `n` tranches qui se suivent, les plus grandes d'abord. */
function trancher(tries: Niveau[], n: number): Niveau[][] {
  if (n <= 1) return [tries];
  const base = Math.floor(tries.length / n);
  const reste = tries.length % n;
  const out: Niveau[][] = [];
  for (let t = 0, debut = 0; t < n; t++) {
    const taille = base + (t < reste ? 1 : 0);
    out.push(tries.slice(debut, debut + taille));
    debut += taille;
  }
  return out;
}

/**
 * Trop de terrains pour `plafond` : les divisions voisines se regroupent,
 * dans l'ordre D1, D2, D3. D'abord des divisions entières, la paire voisine
 * la moins remplie à chaque fois, si chaque terrain tient alors (8 à 15) ;
 * sinon l'échelle entière (la D1, puis la D2, puis la D3, les meilleurs
 * d'abord dans chacune) coupée en tranches égales qui se suivent.
 */
function regrouper(joueurs: Niveau[], plafond: number): Niveau[][] {
  const { minParTerrain, maxParTerrain } = REGLES_EQUIPES;
  const groupes = DIVISIONS.map((d) => joueurs.filter((p) => p.division === d)).filter((g) => g.length > 0);
  while (groupes.length > plafond) {
    let i = 0;
    for (let k = 1; k < groupes.length - 1; k++) {
      if (groupes[k].length + groupes[k + 1].length < groupes[i].length + groupes[i + 1].length) i = k;
    }
    groupes.splice(i, 2, [...groupes[i], ...groupes[i + 1]]);
  }
  const tiennent = groupes.every((g) => g.length <= maxParTerrain && (g.length >= minParTerrain || groupes.length === 1));
  if (tiennent) return groupes;
  const echelle = DIVISIONS.flatMap((d) => joueurs.filter((p) => p.division === d).sort(parNiveau));
  return trancher(echelle, Math.min(plafond, Math.ceil(echelle.length / maxParTerrain)));
}

export interface Repartition {
  /** Les terrains, TERRAINS_MAX au plus, la D1 sur le premier. */
  terrains: Niveau[][];
  /** Ceux qui n'ont pas de place : les derniers arrivés. */
  remplacants: Niveau[];
}

/**
 * Qui joue sur quel terrain. `joueurs` dans l'ordre d'arrivée : quand les
 * places manquent (plafond × 15), les premiers arrivés jouent, les autres
 * sont remplaçants. Jamais plus de `plafond` terrains.
 */
export function repartir(joueurs: Niveau[], plafond: number = TERRAINS_MAX): Repartition {
  const max = Math.max(1, Math.floor(plafond));
  const places = max * REGLES_EQUIPES.maxParTerrain;
  const retenus = joueurs.slice(0, places);
  const remplacants = joueurs.slice(places);
  const libres = parDivision(retenus);
  return { terrains: libres.length <= max ? libres : regrouper(retenus, max), remplacants };
}

/** Qui joue sur quel terrain, sans les remplaçants (repartir). */
export function repartirSurTerrains(joueurs: Niveau[], plafond: number = TERRAINS_MAX): Niveau[][] {
  return repartir(joueurs, plafond).terrains;
}

/* ------------------------------- Les équipes ------------------------------- */

/** Le gardien d'abord (il garde le but sur la feuille), puis la défense, le milieu, l'attaque. */
const LIGNE: [RegExp, number][] = [
  [/^G\b/, 0],
  [/^D/, 1],
  [/^M/, 2],
  [/^A/, 3],
];

/** Les noms des équipes, deux par terrain : « Noirs 1 », « Blancs 1 », « Noirs 2 »… */
export function nomsDEquipes(n: number): string[] {
  return Array.from({ length: Math.ceil(n / 2) }, (_, t) => equipesDuMatch(t + 1))
    .flat()
    .slice(0, n);
}

interface Partage {
  a: number[];
  b: number[];
  ecart: number;
}

/**
 * Les deux équipes d'un terrain. Toutes les façons de couper sont essayées
 * (au plus 15 joueurs par terrain : quelques milliers) ; au-delà, un
 * serpentin. L'équipe du plus fort passe en premier.
 */
function couper(joueurs: Niveau[], h: Historique): Partage {
  const n = joueurs.length;
  const v = joueurs.map((p) => p.valeur);
  const somme = v.reduce((s, x) => s + x, 0);
  const petite = Math.floor(n / 2);
  if (n < 2) return { a: joueurs.map((_, i) => i), b: [], ecart: 0 };
  if (n > 16) {
    const a: number[] = [];
    const b: number[] = [];
    joueurs.forEach((_, i) => ((i % 4 === 0 || i % 4 === 3 ? a : b).push(i)));
    const moy = (xs: number[]) => xs.reduce((s, i) => s + v[i], 0) / (xs.length || 1);
    return { a, b, ecart: Math.abs(moy(a) - moy(b)) };
  }
  const lien = joueurs.map((p) => joueurs.map((q) => (p === q ? 0 : aRassembler(h, p.nom, q.nom))));
  const gardiens = joueurs.map((p) => (p.gardien ? 1 : 0) as number);
  const totalGardiens = gardiens.reduce((s, x) => s + x, 0);

  const candidats: { masque: number; ecart: number; melange: number; gardiens: number }[] = [];
  // Les sous-ensembles de `petite` joueurs ; à tailles égales, ceux qui
  // contiennent le premier seulement (l'autre moitié en est le miroir).
  const choisir = (debut: number, reste: number, masque: number) => {
    if (reste === 0) {
      if (petite * 2 === n && !(masque & 1)) return;
      let sa = 0;
      let ga = 0;
      for (let i = 0; i < n; i++)
        if (masque & (1 << i)) {
          sa += v[i];
          ga += gardiens[i];
        }
      let ensemble = 0;
      for (let i = 0; i < n; i++)
        for (let k = i + 1; k < n; k++) if (!!(masque & (1 << i)) === !!(masque & (1 << k))) ensemble += lien[i][k];
      candidats.push({
        masque,
        ecart: Math.abs(sa / petite - (somme - sa) / (n - petite)),
        // Le mélange se mesure ensemble : plus il y a de « à rassembler » réunis, mieux c'est.
        melange: -ensemble,
        gardiens: Math.abs(ga - (totalGardiens - ga)),
      });
      return;
    }
    for (let i = debut; i <= n - reste; i++) choisir(i + 1, reste - 1, masque | (1 << i));
  };
  choisir(0, petite, 0);

  const peuDeGardiens = Math.min(...candidats.map((c) => c.gardiens));
  const justes = candidats.filter((c) => c.gardiens === peuDeGardiens);
  const meilleurEcart = Math.min(...justes.map((c) => c.ecart));
  const choix = justes
    .filter((c) => c.ecart <= meilleurEcart + REGLES_EQUIPES.tolerance + 1e-9)
    .sort((x, y) => x.melange - y.melange || x.ecart - y.ecart || x.masque - y.masque)[0];
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i++) (choix.masque & (1 << i) ? a : b).push(i);
  return a.includes(0) ? { a, b, ecart: choix.ecart } : { a: b, b: a, ecart: choix.ecart };
}

function ordreDeJeu(joueurs: Niveau[], fiche: Map<string, string>): string[] {
  const ligne = (nom: string) => LIGNE.find(([re]) => re.test(fiche.get(nom) ?? ""))?.[1] ?? 4;
  return joueurs.map((p) => p.nom).sort((x, y) => ligne(x) - ligne(y) || x.localeCompare(y, "fr"));
}

/**
 * Les équipes du dimanche pour `venus`, d'après les divisions de `etat` ; les
 * joueurs masqués n'y entrent pas. `venus` dans l'ordre d'arrivée
 * (ordreDArrivee) : tant que tout le monde a sa place, l'ordre ne change
 * rien ; au-delà de `plafond` terrains pleins, les derniers arrivés sont
 * remplaçants.
 */
export function composer(saison: Saison, venus: string[], etat: EtatDivisions | null, plafond: number = TERRAINS_MAX): Composition {
  const arrivee = [...new Set(venus)].filter((n) => !isHidden(n));
  const noms = [...arrivee].sort((a, b) => a.localeCompare(b, "fr"));
  const parNom = niveaux(saison, noms, etat);
  const h = historique(saison);
  const fiche = new Map(saison.roster.map((r) => [r.name, r.poste ?? ""]));
  const repartition = repartir(
    arrivee.map((n) => parNom.get(n)!),
    plafond
  );
  // Un terrain d'un seul joueur ne fait pas de match : il attend avec les remplaçants.
  const groupes = repartition.terrains.filter((g) => g.length >= 2);
  const seuls = repartition.terrains.filter((g) => g.length < 2).flat();
  const remplacants = arrivee.filter((n) => [...seuls, ...repartition.remplacants].some((p) => p.nom === n));
  const couleurs = nomsDEquipes(groupes.length * 2);
  const terrains: TerrainCompose[] = groupes.map((g, t) => {
    const tries = [...g].sort(parNiveau);
    const { a, b, ecart } = couper(tries, h);
    return {
      divisions: lesDivisions(g),
      equipes: [
        { name: couleurs[t * 2], players: ordreDeJeu(a.map((i) => tries[i]), fiche) },
        { name: couleurs[t * 2 + 1], players: ordreDeJeu(b.map((i) => tries[i]), fiche) },
      ],
      ecart,
    };
  });
  return { terrains, teams: terrains.flatMap((t) => t.equipes), remplacants, niveaux: parNom };
}

/* -------------------------- Les réponses tardives -------------------------- */

/**
 * Les équipes déjà composées, ajustées à ceux qui viennent maintenant : qui
 * se désiste sort ; un nouveau venu entre sur le terrain de sa division (le
 * plus proche de son niveau s'il y en a deux, le plus proche tout court si sa
 * division n'a pas de terrain), dans l'équipe qui a le moins de joueurs, la
 * plus faible à égalité. Un terrain plein (15) ne prend plus personne : sans
 * place libre, le nouveau venu reste remplaçant. `venus` dans l'ordre
 * d'arrivée : les places libres vont aux premiers arrivés. Jamais d'équipe ni
 * de terrain de plus. Un terrain qui se retrouve à deux joueurs d'écart en
 * fait passer un, celui qui équilibre le mieux. null si rien ne change.
 */
export function completer(saison: Saison, teams: ConvocationTeam[], venus: string[], etat: EtatDivisions | null): ConvocationTeam[] | null {
  const ici = new Set(venus.filter((n) => !isHidden(n)));
  const places = new Set(teams.flatMap((t) => t.players));
  const nouveaux = [...ici].filter((n) => !places.has(n));
  const partis = [...places].filter((n) => !ici.has(n));
  if (!nouveaux.length && !partis.length) return null;

  const parNom = niveaux(saison, [...new Set([...ici, ...places])], etat);
  const valeur = (nom: string) => parNom.get(nom)?.valeur ?? 0;
  const moy = (xs: string[]) => xs.reduce((s, n) => s + valeur(n), 0) / (xs.length || 1);
  const out = teams.map((t) => ({ ...t, players: t.players.filter((n) => ici.has(n)) }));
  const paires = Array.from({ length: Math.floor(out.length / 2) }, (_, i) => [out[i * 2], out[i * 2 + 1]] as const);
  if (!paires.length) return null;

  // Les places, dans l'ordre d'arrivée : chacun choisit son terrain parmi
  // ceux qui ont encore de la place.
  const tous = (p: (typeof paires)[number]) => [...p[0].players, ...p[1].players];
  const charge = paires.map((p) => tous(p).length);
  const admis = paires.map(() => [] as string[]);
  for (const nom of nouveaux) {
    const division = etat ? divisionDe(etat, nom) : 3;
    const libres = paires.map((p, i) => ({ p, i })).filter(({ i }) => charge[i] < REGLES_EQUIPES.maxParTerrain);
    if (!libres.length) continue;
    const siens = libres.filter(({ p }) => tous(p).some((n) => (parNom.get(n)?.division ?? 3) === division));
    const { i } = (siens.length ? siens : libres)
      .map((x) => ({ ...x, d: Math.abs(moy(tous(x.p)) - valeur(nom)) }))
      .sort((x, y) => x.d - y.d || x.i - y.i)[0];
    charge[i]++;
    admis[i].push(nom);
  }
  if (!partis.length && admis.every((a) => !a.length)) return null;

  // Sur chaque terrain, les admis entrent du plus fort au moins fort.
  paires.forEach(([a, b], i) => {
    for (const nom of [...admis[i]].sort((x, y) => valeur(y) - valeur(x) || x.localeCompare(y, "fr"))) {
      const cible = a.players.length !== b.players.length ? (a.players.length < b.players.length ? a : b) : moy(a.players) <= moy(b.players) ? a : b;
      cible.players.push(nom);
    }
  });

  for (const [a, b] of paires) {
    while (Math.abs(a.players.length - b.players.length) >= 2) {
      const [grand, petit] = a.players.length > b.players.length ? [a, b] : [b, a];
      const passe = [...grand.players].sort((x, y) => {
        const ecart = (n: string) => Math.abs(moy(grand.players.filter((m) => m !== n)) - moy([...petit.players, n]));
        return ecart(x) - ecart(y) || x.localeCompare(y, "fr");
      })[0];
      grand.players = grand.players.filter((n) => n !== passe);
      petit.players.push(passe);
    }
  }
  return out;
}

/* ------------------------------ L'ordre d'arrivée ------------------------------ */

/**
 * Ceux qui viennent, dans l'ordre où les places leur reviennent : les joueurs
 * que l'admin a posés sur la feuille d'abord (sa parole), puis les « Je
 * viens » du premier au dernier (`quand` : l'heure de la réponse, ISO ; sans
 * heure, après les autres, dans l'ordre donné).
 */
export function ordreDArrivee(presents: string[], feuille: string[], quand: (nom: string) => string | null | undefined): string[] {
  const rang = new Map(presents.map((n, i) => [n, i]));
  const parHeure = [...presents].sort((a, b) => {
    const x = quand(a) ?? "\uffff";
    const y = quand(b) ?? "\uffff";
    return x < y ? -1 : x > y ? 1 : rang.get(a)! - rang.get(b)!;
  });
  return [...new Set([...feuille, ...parHeure])];
}

/* ------------------------------ Les confirmations ------------------------------ */

export interface Resume {
  equipes: number;
  /** Un terrain par paire d'équipes. */
  terrains: number;
  /** Ceux qui viennent sans être dans une équipe : les remplaçants. */
  sansEquipe: string[];
  /** Plus de terrains que TERRAINS_MAX. */
  auDela: boolean;
}

/** Ce que des équipes font de ceux qui viennent : de quoi le dire avant d'écrire. */
export function resumer(teams: ConvocationTeam[], venus: string[], plafond: number = TERRAINS_MAX): Resume {
  const dedans = new Set(teams.flatMap((t) => t.players));
  const terrains = Math.floor(teams.length / 2);
  return {
    equipes: teams.length,
    terrains,
    sansEquipe: [...new Set(venus)].filter((n) => !isHidden(n) && !dedans.has(n)),
    auDela: terrains > plafond,
  };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

/** « 4 équipes sur 2 terrains, 3 joueurs sans équipe : continuer ? » */
export function questionDeComposition(r: Resume): string {
  const sans = r.sansEquipe.length ? `${pluriel(r.sansEquipe.length, "joueur")} sans équipe` : "chacun a son équipe";
  return `${pluriel(r.equipes, "équipe")} sur ${pluriel(r.terrains, "terrain")}, ${sans} : continuer ?`;
}

/* ------------------------------- Les étiquettes ------------------------------- */

/**
 * Les équipes deux par deux, match par match, avec les divisions de leurs
 * joueurs : « D1 », « D1–D2 » (une division trop courte avec sa voisine).
 * Une division sur deux terrains joue deux matchs : « Match 1 · D1 »,
 * « Match 2 · D1 ».
 */
export function terrainsDesEquipes(
  teams: ConvocationTeam[],
  etat: EtatDivisions
): { n: number; divisions: string; label: string; equipes: readonly [ConvocationTeam, ConvocationTeam] }[] {
  const paires = Array.from({ length: Math.floor(teams.length / 2) }, (_, i) => [teams[i * 2], teams[i * 2 + 1]] as const);
  return paires.map((equipes, i) => {
    const divisions = [...new Set([...equipes[0].players, ...equipes[1].players].map((nom) => divisionDe(etat, nom)))]
      .sort((x, y) => x - y)
      .map(nomDivision)
      .join("–");
    return { n: i + 1, divisions, label: `Match ${i + 1} · ${divisions}`, equipes };
  });
}

/* ------------------------------- Le calendrier ------------------------------- */

/** Le vendredi à 18 h, heure de Paris : une heure avant que les joueurs ne découvrent leurs équipes. */
export const HEURE_DES_EQUIPES = { jourIso: 5, heure: 18 } as const;

/** Du vendredi 18 h au coup d'envoi du dimanche, les équipes se font et se tiennent à jour. */
export function equipesEnCours(maintenant: Date, coupDEnvoi = "13h00"): boolean {
  const { jourIso, heure, minute } = instantParis(maintenant);
  if (jourIso === HEURE_DES_EQUIPES.jourIso) return heure >= HEURE_DES_EQUIPES.heure;
  if (jourIso === 6) return true;
  return jourIso === 7 && heure * 60 + minute < heureMin(coupDEnvoi);
}

/** La journée que vise une convocation : celle de sa date si l'admin l'a ouverte, sinon la suivante. */
export function journeeDeConvocation(saison: Saison, dateLabel: string): number {
  return journeeDuJour(saison, dateLabel) ?? Math.max(0, ...saison.journees.map((m) => m.j)) + 1;
}

/**
 * Les divisions de la journée `j`, si elle se joue en divisions et ne compte
 * pas encore ; sinon null. La saison à donner est la vue figée
 * (useSeason().saison, lue.saison) : jusqu'à la révélation, une journée en
 * direct garde ses divisions. Plus loin que la prochaine journée (`pour`) :
 * les mêmes, marquées `perimee` (la précédente n'est pas encore révélée).
 */
export function divisionsDeLaJournee(saison: Saison, j: number, etat: EtatDivisions | null = etatDivisions(saison)): EtatDivisions | null {
  if (etat?.phase !== "divisions" || j < REGLES_DIVISIONS.depuis || j < etat.pour) return null;
  return j === etat.pour ? etat : { ...etat, perimee: true };
}
