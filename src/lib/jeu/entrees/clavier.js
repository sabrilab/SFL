// Le clavier (bola-app#26, lot 3) : une manette faite de touches. Les touches tenues deviennent un état de manette
// rangé dans l'ordre standard (entrees/commande.js), que lit la même commande que les vraies manettes : à séquence
// égale, intention égale (le banc le vérifie). La table est dans entrees/touches.js (BOUTONS_CLAVIER) :
//   flèches stick gauche, Maj RT, D A, S B, F Y, Espace ou E X, Q LB, R RB, C LT, V L3, U R3, I J K L stick droit.
// I J K L sont RELATIVES AU JOUEUR, comme les gestes : I devant lui, K derrière, J sa gauche, L sa droite (on ne
// cherche pas où il regarde à l'écran) ; la page passe le cap du joueur tenu, et l'état de manette rendu est le stick
// d'écran qui va dans cette direction.
// Le stick droit au clavier garde sa dernière direction 0,09 s après qu'on a lâché I J K L : deux touches enchaînées
// sans se chevaucher font encore un quart de cercle (I puis L), trois un demi-cercle (K puis L puis I).
// Les touches sont lues par leur caractère (e.key, en minuscule) : la même lettre sur un clavier AZERTY ou QWERTY.
// La pause (Échap, P) reste lue par match.js.

const BOUTON = { d: 0, s: 1, ' ': 2, e: 2, f: 3, q: 4, r: 5, c: 6, shift: 7, v: 10, u: 11 };
const AXES = { arrowleft: [0, -1], arrowright: [0, 1], arrowup: [1, -1], arrowdown: [1, 1] };
const DROIT = { i: [1, 0], k: [-1, 0], j: [0, 1], l: [0, -1] }; // [devant, gauche] du joueur
export const TOUCHES_JEU = new Set([...Object.keys(BOUTON), ...Object.keys(AXES), ...Object.keys(DROIT)]);
const REMANENCE = 0.09;

/** La clé d'une touche (e.key en minuscule ; ' ' pour Espace). */
export const cleDe = (key) => (key === ' ' || key === 'Spacebar' ? ' ' : String(key ?? '').toLowerCase());

export function creerEtatClavier() {
  return { b: new Float64Array(17), ax: new Float64Array(4), rs: { x: 0, y: 0, t: -9 } };
}

/**
 * Écrit dans etat (b, ax) l'état de manette des touches tenues (un Set de clés), à l'heure t (s). cap : celui du
 * joueur tenu (I J K L relatives à lui) ; versEcran(gx, gz) → { sx, sy } : le repère du jeu vers l'écran (l'inverse de
 * versJeu de la commande). Sans cap, I J K L sont le haut, la gauche, le bas et la droite de l'écran.
 */
// (correctifs #26 : tables parcourues sans allocation par image)
let LBOUTON = null, LAXES = null, LDROIT = null;
const v = [0, 0, 0, 0];
export function etatDepuisTouches(tenues, t, etat, cap = null, versEcran = null) {
  LBOUTON ??= Object.entries(BOUTON); LAXES ??= Object.entries(AXES); LDROIT ??= Object.entries(DROIT);
  etat.b.fill(0);
  for (let n = 0; n < LBOUTON.length; n++) if (tenues.has(LBOUTON[n][0])) etat.b[LBOUTON[n][1]] = 1;
  v[0] = 0; v[1] = 0; v[2] = 0; v[3] = 0;
  for (let n = 0; n < LAXES.length; n++) { const [k, [a, s]] = LAXES[n]; if (tenues.has(k)) v[a] += s; }
  // le stick gauche : une diagonale reste à pleine allure (unitaire)
  const Lg = Math.hypot(v[0], v[1]);
  etat.ax[0] = Lg ? v[0] / Lg : 0; etat.ax[1] = Lg ? v[1] / Lg : 0;
  let av = 0, ga = 0;
  for (let n = 0; n < LDROIT.length; n++) { const [k, [a, g]] = LDROIT[n]; if (tenues.has(k)) { av += a; ga += g; } }
  const Lr = Math.hypot(av, ga);
  if (Lr) {
    av /= Lr; ga /= Lr;
    if (cap != null && versEcran) {
      // devant (sin cap, cos cap), gauche (cos cap, −sin cap) ; puis vers l'écran (y de la manette vers le bas)
      const gx = av * Math.sin(cap) + ga * Math.cos(cap), gz = av * Math.cos(cap) - ga * Math.sin(cap);
      const e = versEcran(gx, gz);
      v[2] = e.sx; v[3] = -e.sy;
    } else { v[2] = -ga; v[3] = -av; }
  }
  const Ld = Math.hypot(v[2], v[3]);
  if (Ld) { etat.rs.x = v[2] / Ld; etat.rs.y = v[3] / Ld; etat.rs.t = t; }
  const garde = Ld || t - etat.rs.t <= REMANENCE;
  etat.ax[2] = garde ? etat.rs.x : 0; etat.ax[3] = garde ? etat.rs.y : 0;
  return etat;
}

/** L'écoute du clavier (page) : les touches tenues, et l'heure du dernier vrai geste de jeu (vu, en ms). */
export function creerClavier() {
  const c = { tenues: new Set(), vu: -1e9, utilise: false };
  const bas = (e) => {
    const k = cleDe(e.key);
    if (!TOUCHES_JEU.has(k)) return;
    if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    c.tenues.add(k);
    // (Maj seule ne compte pas : c'est la touche qu'on presse pour autre chose)
    if (k !== 'shift') { c.utilise = true; c.vu = performance.now(); }
  };
  const haut = (e) => { c.tenues.delete(cleDe(e.key)); };
  const perdu = () => c.tenues.clear();
  addEventListener('keydown', bas);
  addEventListener('keyup', haut);
  addEventListener('blur', perdu);
  c.detruire = () => { removeEventListener('keydown', bas); removeEventListener('keyup', haut); removeEventListener('blur', perdu); };
  return c;
}
