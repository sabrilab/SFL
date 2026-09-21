/**
 * Les équipes.
 *
 * Une équipe, c'est cinq à sept joueurs, un nom et un écusson. Cinq parce qu'en
 * dessous on n'a pas de quoi aligner un cinq ; sept parce qu'au-delà ce n'est
 * plus une équipe, c'est un groupe. La règle est tenue ici, pas seulement dans
 * l'interface.
 *
 * L'écusson est COMPOSÉ, pas généré : une forme, un motif, deux couleurs, un
 * monogramme. Ça se fait en dix secondes, ça tient à 24 px dans une ligne de
 * classement, ça ne dépend d'aucun service et ça ressemble toujours à un
 * écusson de la même ligue que les autres.
 */
export const MIN_JOUEURS = 5;
export const MAX_JOUEURS = 7;

export type Forme = 'ecu' | 'rond' | 'pointe';
export type Motif = 'uni' | 'bandes' | 'diagonale' | 'moitie';

export interface Ecusson {
  forme: Forme;
  motif: Motif;
  couleurs: [string, string];
  /** Une à trois lettres. Déduit du nom, modifiable. */
  monogramme: string;
}

export interface Equipe {
  id: string;
  nom: string;
  ecusson: Ecusson;
  /** Identifiants de joueurs, capitaine en premier. */
  joueurs: string[];
  creeLe: number;
}

export const FORMES: { cle: Forme; nom: string }[] = [
  { cle: 'ecu', nom: 'Écu' }, { cle: 'rond', nom: 'Rond' }, { cle: 'pointe', nom: 'Pointe' },
];
export const MOTIFS: { cle: Motif; nom: string }[] = [
  { cle: 'uni', nom: 'Uni' }, { cle: 'bandes', nom: 'Bandes' },
  { cle: 'diagonale', nom: 'Diagonale' }, { cle: 'moitie', nom: 'Moitié' },
];

/** Huit couleurs qui se distinguent entre elles et tiennent sur le noir de l'app. */
export const COULEURS = [
  '#E4572E', '#1F5FBF', '#F2C14E', '#2E8B57', '#7B2CBF', '#FF8A4C', '#F4F5F2', '#0B0C0E',
];

/** « Les Renards du Nord » → « RN » ; « Stalingrad » → « STA ». */
export function monogrammeDe(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter((m) => m.length > 2 || mots0(m));
  if (mots.length >= 2) return mots.slice(0, 3).map((m) => m[0]).join('').toUpperCase();
  return nom.trim().slice(0, 3).toUpperCase();
}
const mots0 = (m: string) => /^[A-Z]{2}$/.test(m); // « FC », « AS »

/** Ce qui empêche de créer ou de modifier une équipe, ou null si tout va bien. */
export function probleme(nom: string, joueurs: string[]): string | null {
  if (nom.trim().length < 2) return 'Donne un nom à ton équipe.';
  if (joueurs.length < MIN_JOUEURS) return `Il faut au moins ${MIN_JOUEURS} joueurs — il en manque ${MIN_JOUEURS - joueurs.length}.`;
  if (joueurs.length > MAX_JOUEURS) return `Pas plus de ${MAX_JOUEURS} joueurs.`;
  return null;
}

/* ── Le classement des équipes ── */

export interface Rencontre {
  a: string;
  b: string;
  sa: number;
  sb: number;
  date: string;
}

export interface LigneClassementEquipe {
  equipe: Equipe;
  joues: number;
  gagnes: number;
  nuls: number;
  perdus: number;
  pour: number;
  contre: number;
  points: number;
}

/** 3 points la victoire, 1 le nul. Départage : différence de buts, puis buts marqués. */
export function classementEquipes(equipes: Equipe[], rencontres: Rencontre[]): LigneClassementEquipe[] {
  const lignes = new Map<string, LigneClassementEquipe>(
    equipes.map((e) => [e.id, { equipe: e, joues: 0, gagnes: 0, nuls: 0, perdus: 0, pour: 0, contre: 0, points: 0 }]),
  );
  for (const r of rencontres) {
    const A = lignes.get(r.a), B = lignes.get(r.b);
    if (!A || !B) continue;
    A.joues++; B.joues++;
    A.pour += r.sa; A.contre += r.sb; B.pour += r.sb; B.contre += r.sa;
    if (r.sa > r.sb) { A.gagnes++; A.points += 3; B.perdus++; }
    else if (r.sa < r.sb) { B.gagnes++; B.points += 3; A.perdus++; }
    else { A.nuls++; B.nuls++; A.points++; B.points++; }
  }
  return [...lignes.values()].sort((x, y) =>
    y.points - x.points || (y.pour - y.contre) - (x.pour - x.contre) || y.pour - x.pour);
}

/** Équipes de démonstration : celles qu'on croise sur les matchs ouverts. */
export const EQUIPES_DEMO: Equipe[] = [
  {
    id: 'renards', nom: 'Les Renards', creeLe: 0,
    ecusson: { forme: 'ecu', motif: 'bandes', couleurs: ['#E4572E', '#0B0C0E'], monogramme: 'LR' },
    joueurs: ['kader', 'naim', 'bensou', 'sabri', 'yacine'],
  },
  {
    id: 'reaumur', nom: 'FC Réaumur', creeLe: 0,
    ecusson: { forme: 'pointe', motif: 'moitie', couleurs: ['#1F5FBF', '#F4F5F2'], monogramme: 'FCR' },
    joueurs: ['yb', 'am', 'kd', 'sf', 'mr'],
  },
  {
    id: 'stalingrad', nom: 'Stalingrad United', creeLe: 0,
    ecusson: { forme: 'rond', motif: 'diagonale', couleurs: ['#2E8B57', '#F2C14E'], monogramme: 'SU' },
    joueurs: ['mt', 'lp', 'ga', 'hc', 'yz', 'ob'],
  },
  {
    id: 'indoor', nom: 'Five Indoor Nord', creeLe: 0,
    ecusson: { forme: 'ecu', motif: 'uni', couleurs: ['#7B2CBF', '#F4F5F2'], monogramme: 'FIN' },
    joueurs: ['ab', 'cd', 'ef', 'gh', 'ij', 'kl', 'mn'],
  },
];

export const RENCONTRES_DEMO: Rencontre[] = [
  { a: 'renards', b: 'reaumur', sa: 6, sb: 4, date: '31 août' },
  { a: 'stalingrad', b: 'indoor', sa: 3, sb: 3, date: '31 août' },
  { a: 'reaumur', b: 'stalingrad', sa: 5, sb: 2, date: '7 sept.' },
  { a: 'indoor', b: 'renards', sa: 2, sb: 7, date: '7 sept.' },
  { a: 'renards', b: 'stalingrad', sa: 4, sb: 4, date: '14 sept.' },
  { a: 'reaumur', b: 'indoor', sa: 6, sb: 1, date: '14 sept.' },
];
