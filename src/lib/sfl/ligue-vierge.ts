// La Ligue vierge — le classement des matchs Bola, à vie.
//
// Trois façons de jouer dans Bola (Sabri, 22/10) :
//   · les matchs Bola : n'importe quel joueur en ouvre un, hors de la SFL,
//     avec les autres joueurs de Bola ; ils comptent ici ;
//   · les matchs d'équipe (mode Team) : à venir ;
//   · les journées de la ligue (la SFL du dimanche) : leur saison, leurs
//     classements, leurs cartes votées, à part.
//
// Le mode Bola suit les règles officielles (ilyesbensal/BOLA,
// docs/gameplay/03-mode-bola.md) :
//   · Points Perso d'un match = présence 1 + résultat (victoire 2, nul 1,
//     défaite 0) + 1 par but + 1 par passe + 1 si MVP ;
//   · MVP jamais voté : l'app prend le plus haut buts + passes du match,
//     toutes équipes confondues ; à 0, aucun. À égalité, celui qui a fait le
//     plus de passes (Sabri, 28/10 : « un joueur qui fait 5 buts, 2 passes D
//     a le même nombre de points qu'un joueur qui fait 2 buts, 5 passes D,
//     mais on choisira le MVP qui a mis plus de passes. Si vraiment c'est une
//     égalité, les deux reçoivent MVP. ») ; plusieurs MVP seulement si buts
//     et passes sont les mêmes ;
//   · un seul match Bola classé par jour et par joueur : les suivants sont
//     amicaux pour lui (il garde la carte MVP, pas les points) ;
//   · au moins 8 joueurs présents (un 4 contre 4) pour qu'un match compte ;
//   · une exhibition ne compte jamais ;
//   · ni Impact, ni Défensive, ni trophée de fin de saison : il n'y a pas de
//     saison, le classement cumule tout depuis le premier match.
// Pas encore là : l'absence injustifiée (−2), faute de check-in.
//
// Module pur, sans React ni base : la page (app/ligue-vierge) lui passe les
// matchs lus par la fonction `ligue_vierge()` (supabase/schema.sql).

export type Equipe = "clairs" | "fonces";

export interface LigneBola {
  id: string;
  name: string;
  equipe: Equipe;
  buts: number;
  passes: number;
}

export interface MatchBola {
  id: number;
  /** ISO, « 2026-10-22 ». */
  jour: string;
  heure: string;
  /** Plus aucune exhibition ne s'ouvre depuis le 23/10 (la base met « match ») ; restent d'éventuelles anciennes lignes. */
  genre: "match" | "exhibition";
  scoreClairs: number;
  scoreFonces: number;
  joueurs: LigneBola[];
}

/** Le quorum des règles : 8 présents, un 4 contre 4. */
export const QUORUM = 8;

export const BAREME = { presence: 1, victoire: 2, nul: 1, defaite: 0, but: 1, passe: 1, mvp: 1 } as const;

export interface LigneComptee extends LigneBola {
  mvp: boolean;
  /** Le match compte-t-il pour lui (1er match Bola classé de sa journée) ? */
  classe: boolean;
  points: number;
  resultat: "V" | "N" | "D";
}

export interface MatchCompte extends Omit<MatchBola, "joueurs"> {
  /** Le match compte (assez de joueurs, pas une exhibition). */
  valide: boolean;
  mvps: string[];
  joueurs: LigneComptee[];
}

export interface Classe {
  id: string;
  name: string;
  rank: number;
  points: number;
  matchs: number;
  victoires: number;
  buts: number;
  passes: number;
  mvp: number;
}

/**
 * Les MVP d'un match : le plus haut buts + passes ; à égalité, le plus de
 * passes (Sabri, 28/10) ; plusieurs seulement en égalité parfaite ; aucun à 0.
 */
export function mvpsDuMatch(joueurs: { id: string; buts: number; passes: number }[]): string[] {
  const meilleur = Math.max(0, ...joueurs.map((j) => j.buts + j.passes));
  if (meilleur === 0) return [];
  const top = joueurs.filter((j) => j.buts + j.passes === meilleur);
  const maxP = Math.max(...top.map((j) => j.passes));
  return top.filter((j) => j.passes === maxP).map((j) => j.id);
}

function resultat(m: MatchBola, e: Equipe): "V" | "N" | "D" {
  const pour = e === "clairs" ? m.scoreClairs : m.scoreFonces;
  const contre = e === "clairs" ? m.scoreFonces : m.scoreClairs;
  return pour > contre ? "V" : pour === contre ? "N" : "D";
}

/** Tous les matchs, comptés dans l'ordre du temps (le 1er de la journée de chacun est classé). */
export function compterMatchs(matchs: MatchBola[]): MatchCompte[] {
  const ordre = [...matchs].sort(
    (a, b) => a.jour.localeCompare(b.jour) || heureMin(a.heure) - heureMin(b.heure) || a.id - b.id
  );
  // Les journées où chacun a déjà son match classé.
  const dejaClasse = new Set<string>();
  return ordre.map((m) => {
    const valide = m.genre !== "exhibition" && m.joueurs.length >= QUORUM;
    const mvps = mvpsDuMatch(m.joueurs);
    const joueurs = m.joueurs.map((j): LigneComptee => {
      const r = resultat(m, j.equipe);
      const mvp = mvps.includes(j.id);
      const cle = `${j.id}|${m.jour}`;
      const classe = valide && !dejaClasse.has(cle);
      if (classe) dejaClasse.add(cle);
      const points = classe
        ? BAREME.presence +
          (r === "V" ? BAREME.victoire : r === "N" ? BAREME.nul : BAREME.defaite) +
          j.buts * BAREME.but +
          j.passes * BAREME.passe +
          (mvp ? BAREME.mvp : 0)
        : 0;
      return { ...j, mvp, classe, points, resultat: r };
    });
    return { ...m, valide, mvps, joueurs };
  });
}

/**
 * Le classement à vie : points, puis MVP, puis victoires, puis le moins de
 * matchs. `garder` écarte des joueurs AVANT de ranger (les masqués de
 * hidden.ts : ils ne paraissent dans aucun classement), pour que les places
 * se suivent sans trou.
 */
export function classementAVie(comptes: MatchCompte[], garder?: (c: Pick<Classe, "id" | "name">) => boolean): Classe[] {
  const parId = new Map<string, Classe>();
  for (const m of comptes) {
    for (const j of m.joueurs) {
      if (!j.classe) continue;
      const c = parId.get(j.id) ?? { id: j.id, name: j.name, rank: 0, points: 0, matchs: 0, victoires: 0, buts: 0, passes: 0, mvp: 0 };
      c.name = j.name;
      c.points += j.points;
      c.matchs += 1;
      c.victoires += j.resultat === "V" ? 1 : 0;
      c.buts += j.buts;
      c.passes += j.passes;
      c.mvp += j.mvp ? 1 : 0;
      parId.set(j.id, c);
    }
  }
  const tries = [...parId.values()].filter((c) => !garder || garder(c)).sort(
    (a, b) =>
      b.points - a.points || b.mvp - a.mvp || b.victoires - a.victoires || a.matchs - b.matchs || a.name.localeCompare(b.name, "fr")
  );
  // Les ex æquo parfaits partagent leur rang.
  tries.forEach((c, i) => {
    const p = tries[i - 1];
    c.rank = p && p.points === c.points && p.mvp === c.mvp && p.victoires === c.victoires && p.matchs === c.matchs ? p.rank : i + 1;
  });
  return tries;
}

/** « 19h30 » ou « 19:30 » → minutes depuis minuit. */
export function heureMin(h: string): number {
  const m = h.match(/^(\d{1,2})\s*[h:]\s*(\d{0,2})/i);
  if (!m) return 12 * 60;
  return Number(m[1]) * 60 + Number(m[2] || 0);
}

/** Le coup d'envoi est-il passé (heure de Paris) ? La feuille s'ouvre alors. */
export function coupDEnvoiPasse(jour: string, heure: string, maintenant = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(maintenant);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const auj = `${v("year")}-${v("month")}-${v("day")}`;
  if (jour !== auj) return jour < auj;
  return heureMin(heure) <= Number(v("hour")) * 60 + Number(v("minute"));
}

/** La feuille se corrige 24 h après sa première saisie (la base la ferme ensuite). */
export function feuilleOuverte(saisiLe: string | null, maintenant = new Date()): boolean {
  return !saisiLe || maintenant.getTime() - new Date(saisiLe).getTime() < 24 * 3600 * 1000;
}

// ─────────────── Les classements de Bola, et ses divisions ───────────────
// Sabri, 24/10 : « dans le classement Bola, c'est juste le classement des
// buteurs, des passeurs, et on a un semi-classement Pépite d'Or qui intègre
// les victoires, les nuls, les défaites et la carte MVP sélectionnée
// automatiquement » : trois classements, Points (le barème plus haut),
// Buteurs et Passeurs, tous à vie, sur les matchs classés.
//
// « On peut aussi faire des divisions une fois qu'on a assez
// d'utilisateurs […] c'est pareil qu'à la SFL : c'est au nombre de points.
// On peut très bien passer premier ou dixième » : les divisions de Bola ne
// sont que des tranches du classement des points, recoupées à chaque match
// (pas de règle de montée ni de descente). Des tranches de 30 comme la SFL,
// dès que le classement en remplit deux ; la dernière reçoit tous les
// autres. Un ex æquo à la dernière place d'une division y entre avec
// celui qu'il égale (comme la SFL, lib/sfl/divisions.ts).

export type ClassementBola = "points" | "buts" | "passes";

export const DIVISIONS_BOLA = {
  /** Joueurs par division, comme la SFL. */
  taille: 30,
} as const;

export interface LigneBolaClassee extends Classe {
  /** La valeur du classement (points, buts ou passes) et le rang qu'elle donne. */
  valeur: number;
  place: number;
}

/** Un classement à vie : points (le rang déjà calculé), buts ou passes (ex æquo au même rang ; personne à 0). */
export function classementBola(classement: Classe[], cle: ClassementBola): LigneBolaClassee[] {
  if (cle === "points") return classement.map((c) => ({ ...c, valeur: c.points, place: c.rank }));
  const autre = cle === "buts" ? "passes" : "buts";
  const t = classement
    .filter((c) => c[cle] > 0)
    .sort((a, b) => b[cle] - a[cle] || b[autre] - a[autre] || a.matchs - b.matchs || a.name.localeCompare(b.name, "fr"));
  const out: LigneBolaClassee[] = [];
  t.forEach((c, i) => {
    const p = out[i - 1];
    out.push({ ...c, valeur: c[cle], place: p && p.valeur === c[cle] ? p.place : i + 1 });
  });
  return out;
}

export interface DivisionBola {
  n: number;
  nom: string;
  lignes: LigneBolaClassee[];
}

/** Les divisions du classement des points ; aucune tant qu'il n'en remplit pas deux. */
export function divisionsBola(lignes: LigneBolaClassee[], taille: number = DIVISIONS_BOLA.taille): DivisionBola[] {
  if (taille < 1 || lignes.length < taille * 2) return [];
  const k = Math.floor(lignes.length / taille);
  const out: DivisionBola[] = [];
  let i = 0;
  for (let n = 1; n <= k && i < lignes.length; n++) {
    let fin = n === k ? lignes.length : Math.min(lignes.length, i + taille);
    // L'ex æquo du dernier entre avec lui.
    while (n < k && fin < lignes.length && lignes[fin].place === lignes[fin - 1].place) fin++;
    out.push({ n, nom: `D${n}`, lignes: lignes.slice(i, fin) });
    i = fin;
  }
  return out;
}
