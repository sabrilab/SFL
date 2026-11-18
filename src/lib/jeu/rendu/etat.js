// L'état d'animation d'un joueur, lu dans la simulation (bola-app#26) : ce que rendu/animateur.js reçoit à chaque
// image. Une seule fonction pour la page (match.js) et pour le banc d'animation (tools/jeu-banc-anim.ts) : le banc
// mesure exactement ce que la page montre. Sans three ; aucune allocation par image (l'objet e et ses sous-objets
// sont gardés dans cache).
import { allongeBras } from '../sim/gardien.js';

const GESTES = new Set(['geste', 'sol', 'releve', 'pivot']);

/**
 * M : le monde ; j : le joueur ; I : sa position interpolée { x, z, cap } ; porteur : le porteur (ou null) ;
 * balle : la balle interpolée { x, y, z } ; cache : un objet propre au joueur.
 */
export function etatAnim(M, j, I, porteur, balle, cache) {
  const e = (cache.e ??= { geste: null, appui: null, touche: null, choc: null, figure: null });
  const g = j.g;
  e.vx = j.v.x; e.vz = j.v.z; e.cap = I.cap; e.phase = j.phase; e.balle = porteur === j; e.mode = j.mode;
  e.aLong = j.aLong; e.aLat = j.aLat; e.d = j.d; e.regard = M.balle.p; e.pos = I; e.boule = balle;
  e.allonge = j.gardien ? allongeBras(j) : 0;
  e.saut = !!cache.saut;
  if (g && GESTES.has(j.mode)) {
    const G = (cache.g ??= {});
    G.nom = g.nom; G.t = g.t; G.type = g.type; G.taux = g.taux; G.surface = g.donnees?.surface ?? null; G.impact = g.impact;
    // (bola-app#32) la commande jouée (id de la ligne de entrees/touches.js : passe, passePuissante, frappe, finesse, piqué…)
    // et l'élan tenu armé d'une charge : le rendu choisit le geste par la commande (lot A2)
    G.commande = g.donnees?.spec?.commande ?? g.donnees?.commande ?? null; G.gel = !!g.gel;
    // (lot A2) le pied qui frappe (0 gauche, 1 droit) et le début de l'élan (s de clip) : la couche « geste de commande »
    // du rendu y cale sa posture et son IK du pied
    G.pied = g.donnees?.pied ?? null; G.debut = g.debut ?? 0; G.fait = !!g.fait;
    e.geste = G;
  } else e.geste = null;
  e.appui = j.appuiT != null && M.t - j.appuiT < 0.35 ? Object.assign((cache.appui ??= {}), { x: j.appuiX, z: j.appuiZ, f: j.appuiF, age: M.t - j.appuiT }) : null;
  e.touche = j.toucheT != null && M.t - j.toucheT < 0.12 ? Object.assign((cache.touche ??= {}), { age: M.t - j.toucheT, b: balle }) : null;
  e.choc = j.chocT != null && M.t - j.chocT < 0.9 ? Object.assign((cache.choc ??= {}), { age: M.t - j.chocT, x: j.chocX, z: j.chocZ, f: j.chocF, t0: j.chocT }) : null;
  // (bola-app#26, lot 2) le tirage de maillot : le dos du porteur que le défenseur tient (repère du jeu)
  const tc = j.tireCible != null ? M.joueurs[j.tireCible] : null;
  e.tire = tc ? Object.assign((cache.tire ??= {}), { x: tc.p.x, y: 1.15, z: tc.p.z }) : null;
  const F = j.figure;
  e.figure = F && M.t - F.t0 < F.duree ? Object.assign((cache.figure ??= {}), { type: F.type, age: M.t - F.t0, duree: F.duree, cote: F.cote, double: !!F.double }) : null;
  return e;
}
