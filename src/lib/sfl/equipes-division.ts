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
//      meilleurs niveaux ensemble.
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
// qui se désiste en sort.
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
import { journeeJouee, journeeTerminee, saisonDepuisArchive } from "./saisie/mutations";
import type { ConvocationTeam, Saison } from "./saisie/types";

export const REGLES_EQUIPES = {
  /** Au-delà, une division prend un terrain de plus. */
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

/** Qui joue sur quel terrain : une division par terrain, sauf trop courte ou trop pleine. */
export function repartirSurTerrains(joueurs: Niveau[]): Niveau[][] {
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
  return groupes.flatMap((g) => {
    const n = Math.ceil(g.length / maxParTerrain);
    if (n <= 1) return [g];
    const tries = [...g].sort(parNiveau);
    const base = Math.floor(tries.length / n);
    const reste = tries.length % n;
    const out: Niveau[][] = [];
    for (let t = 0, debut = 0; t < n; t++) {
      const taille = base + (t < reste ? 1 : 0);
      out.push(tries.slice(debut, debut + taille));
      debut += taille;
    }
    return out;
  });
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
 * Les équipes du dimanche pour `venus` (dans n'importe quel ordre ; les
 * joueurs masqués n'y entrent pas), d'après les divisions de `etat`.
 */
export function composer(saison: Saison, venus: string[], etat: EtatDivisions | null): Composition {
  const noms = [...new Set(venus)].filter((n) => !isHidden(n)).sort((a, b) => a.localeCompare(b, "fr"));
  const parNom = niveaux(saison, noms, etat);
  const h = historique(saison);
  const fiche = new Map(saison.roster.map((r) => [r.name, r.poste ?? ""]));
  const groupes = repartirSurTerrains([...parNom.values()]).filter((g) => g.length >= 2);
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
  return { terrains, teams: terrains.flatMap((t) => t.equipes), niveaux: parNom };
}

/* -------------------------- Les réponses tardives -------------------------- */

/**
 * Les équipes déjà composées, ajustées à ceux qui viennent maintenant : qui
 * se désiste sort ; un nouveau venu entre sur le terrain de sa division (le
 * plus proche de son niveau s'il y en a deux, le plus proche tout court si sa
 * division n'a pas de terrain), dans l'équipe qui a le moins de joueurs, la
 * plus faible à égalité. Un terrain qui se retrouve à deux joueurs d'écart
 * en fait passer un, celui qui équilibre le mieux. null si rien ne change.
 */
export function completer(saison: Saison, teams: ConvocationTeam[], venus: string[], etat: EtatDivisions | null): ConvocationTeam[] | null {
  const ici = new Set(venus.filter((n) => !isHidden(n)));
  const places = new Set(teams.flatMap((t) => t.players));
  const nouveaux = [...ici].filter((n) => !places.has(n)).sort((a, b) => a.localeCompare(b, "fr"));
  const partis = [...places].filter((n) => !ici.has(n));
  if (!nouveaux.length && !partis.length) return null;

  const parNom = niveaux(saison, [...new Set([...ici, ...places])], etat);
  const valeur = (nom: string) => parNom.get(nom)?.valeur ?? 0;
  const moy = (xs: string[]) => xs.reduce((s, n) => s + valeur(n), 0) / (xs.length || 1);
  const out = teams.map((t) => ({ ...t, players: t.players.filter((n) => ici.has(n)) }));
  const paires = Array.from({ length: Math.floor(out.length / 2) }, (_, i) => [out[i * 2], out[i * 2 + 1]] as const);
  if (!paires.length) return null;

  for (const nom of [...nouveaux].sort((a, b) => valeur(b) - valeur(a) || a.localeCompare(b, "fr"))) {
    const division = etat ? divisionDe(etat, nom) : 3;
    const tous = (p: (typeof paires)[number]) => [...p[0].players, ...p[1].players];
    const siens = paires.filter((p) => tous(p).some((n) => (parNom.get(n)?.division ?? 3) === division));
    const terrain = (siens.length ? siens : paires)
      .map((p, i) => ({ p, i, d: Math.abs(moy(tous(p)) - valeur(nom)) }))
      .sort((x, y) => x.d - y.d || x.i - y.i)[0].p;
    const [a, b] = terrain;
    const cible = a.players.length !== b.players.length ? (a.players.length < b.players.length ? a : b) : moy(a.players) <= moy(b.players) ? a : b;
    cible.players.push(nom);
  }

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

/** Les divisions de la journée `j`, si elle se joue en divisions et pas encore jouée ; sinon null. */
export function divisionsDeLaJournee(saison: Saison, j: number): EtatDivisions | null {
  const etat = etatDivisions(saison);
  // Jusqu'à la feuille finie : le premier but saisi en direct n'efface pas les divisions du dimanche.
  return etat?.phase === "divisions" && j >= REGLES_DIVISIONS.depuis && !journeeTerminee(saison, j) ? etat : null;
}
