/**
 * La grille de la carte — les valeurs du document de design, sur une
 * référence de 1024 × 1536. Tout est dessiné dans cette grille puis mis à
 * l'échelle : une carte de 120 px et une de 360 px sont le même dessin.
 */
export const L = 1024;
export const H = 1536;
export const PAD = 68;
export const RAYON = 0.093 * L; // 9,3 % de la largeur

export const ENCRE = (a: number) => `rgba(255,255,255,${a})`;
export const VOILE = (a: number) => `rgba(6,8,7,${a})`;
export const FOND = ['#2a2f36', '#181c21', '#0d1013'];
export const SUR_ACCENT = 'rgba(10,14,8,0.92)';

/** Lignes de base, en pixels de la grille. */
export const Y = {
  club: 132,
  poste: 182,
  nom: H - 356,       // 1180 — le nom et la note partagent cette ligne
  pseudo: H - 356 + 58,
  filet: H - 356 + 104,
  stats: H - 130,     // 1406 — valeurs ; libellés 34 px dessous
  numero: H - 300,
};

export const TAILLE = {
  club: 32, poste: 30, nom: 210, note: 240, general: 26,
  pseudo: 40, statValeur: 60, statLibelle: 24, mention: 28, numero: 640,
};

export const ESPACEMENT = {
  club: 9, poste: 5, general: 8, statLibelle: 3, mention: 4,
};
