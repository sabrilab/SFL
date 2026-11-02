// La route des paliers du mode Passe (mode-passe.tsx, Route), sa logique pure.
//
// Ilyes, 01/11/2026 : « sur l'ordinateur […] c'est difficile de naviguer
// entre les passes qu'on a gagnées, ça bug un peu ». La piste se renvoyait la
// balle : chaque événement de défilement choisissait le palier du centre, et
// chaque choix relançait un défilement doux vers lui ; un clic du 9 vers le
// 16 s'arrêtait au 13, la flèche ← revenait en arrière. Et la souris n'avait
// aucun moyen de faire défiler la piste (ni molette verticale, ni glissé).
//
// Un seul comportement, une seule vérité (`choisi`) :
//   · l'app PILOTE (clic, flèche, bouton, molette, ouverture) : elle pose la
//     cible, lance le défilement, et tant qu'elle pilote, le défilement ne
//     choisit rien ; elle lâche à 2 px de la cible, ou 700 ms après le
//     dernier événement (Safari n'a pas `scrollend`) ;
//   · l'utilisateur GLISSE (doigt, trackpad horizontal, glissé à la souris) :
//     le palier du centre se choisit quand le défilement se calme (90 ms),
//     sans relancer de défilement ;
//   · la MOLETTE verticale : un cran de 40 px avance d'un palier, puis on
//     attend 250 ms (un geste, un palier : comme wheelIntent du site) ;
//   · un glissé à la souris de moins de 5 px reste un clic.
//
// Pur : ni React ni DOM.

/** Le pas d'un palier sur la route, en px (la largeur d'un arrêt). */
export const PAS_ROUTE = 76;
/** On lâche le pilotage à moins de ça de la cible… */
export const PRES_DE_LA_CIBLE = 2;
/** … ou après ce silence du défilement. */
export const FIN_DU_PILOTAGE = 700;
/** Le défilement au doigt s'est calmé : le palier du centre se choisit. */
export const CALME = 90;
/** La molette : le cran qui fait un palier, et le repos qui suit. */
export const CRAN_MOLETTE = 40;
export const REPOS_MOLETTE = 250;
/** En deçà, un glissé à la souris est un clic. */
export const SEUIL_CLIC = 5;

/** Le palier au centre de la piste, pour un défilement horizontal. */
export function palierAuCentre(scrollLeft: number, n: number, pas = PAS_ROUTE): number {
  return Math.min(n, Math.max(1, Math.round(scrollLeft / pas) + 1));
}

/** Où la piste doit défiler pour mettre le palier `n` au centre. */
export const positionDe = (n: number, pas = PAS_ROUTE) => (n - 1) * pas;

/** Un palier dans la piste : jamais avant le premier ni après le dernier. */
export const borner = (n: number, max: number) => Math.min(max, Math.max(1, n));

/** Le pilotage d'un défilement par l'app : la cible, et quand il se termine. */
export interface Pilote {
  cible: number | null;
  dernier: number;
}

export const sansPilote = (): Pilote => ({ cible: null, dernier: 0 });

/** L'app lance un défilement vers le palier `n`. */
export function piloter(p: Pilote, n: number, t: number): Pilote {
  return { cible: n, dernier: t };
}

/**
 * Un événement de défilement : pendant le pilotage, il ne choisit rien.
 * Renvoie le pilote suivant, et si le défilement peut choisir.
 */
export function surDefilement(p: Pilote, scrollLeft: number, t: number, pas = PAS_ROUTE): { pilote: Pilote; choisit: boolean } {
  if (p.cible === null) return { pilote: p, choisit: true };
  if (Math.abs(scrollLeft - positionDe(p.cible, pas)) < PRES_DE_LA_CIBLE) return { pilote: sansPilote(), choisit: false };
  return { pilote: { cible: p.cible, dernier: t }, choisit: false };
}

/** Le pilotage se termine de lui-même après un silence. */
export function piloteExpire(p: Pilote, t: number): Pilote {
  return p.cible !== null && t - p.dernier >= FIN_DU_PILOTAGE ? sansPilote() : p;
}

/** La molette, cumulée : un cran de 40 px fait un palier, puis 250 ms de repos. */
export interface Molette {
  cumul: number;
  reposJusqua: number;
}

export const molette = (): Molette => ({ cumul: 0, reposJusqua: 0 });

/**
 * Un événement de molette. `pris` : la piste le garde (preventDefault) ; un
 * défilement surtout horizontal (le trackpad) reste natif. `pas` : -1, 0, +1.
 */
export function surMolette(m: Molette, dx: number, dy: number, t: number): { molette: Molette; pris: boolean; pas: -1 | 0 | 1 } {
  if (Math.abs(dy) <= Math.abs(dx)) return { molette: m, pris: false, pas: 0 };
  if (t < m.reposJusqua) return { molette: { cumul: 0, reposJusqua: m.reposJusqua }, pris: true, pas: 0 };
  const cumul = m.cumul + dy;
  if (Math.abs(cumul) >= CRAN_MOLETTE) return { molette: { cumul: 0, reposJusqua: t + REPOS_MOLETTE }, pris: true, pas: cumul > 0 ? 1 : -1 };
  return { molette: { cumul, reposJusqua: m.reposJusqua }, pris: true, pas: 0 };
}

/** Un glissé à la souris de moins de 5 px est un clic. */
export const estUnClic = (dx: number, dy = 0) => Math.hypot(dx, dy) < SEUIL_CLIC;

/** Les touches de la route : ← →, Début et Fin. */
export function toucheRoute(touche: string, choisi: number, max: number): number | null {
  if (touche === "ArrowLeft") return borner(choisi - 1, max);
  if (touche === "ArrowRight") return borner(choisi + 1, max);
  if (touche === "Home") return 1;
  if (touche === "End") return max;
  return null;
}
