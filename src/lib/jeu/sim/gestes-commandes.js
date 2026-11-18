// Une animation distincte par commande (bola-app#32, lot A2 ; retour de Sabri du 18/11, 21:19 : « on voit que c'est un
// truc différent qu'on fait »). Chaque commande de la table des touches (entrees/touches.js, son id) a ici SON geste :
//   · le clip, arrêté (sur appuis) et en course (le root motion de la frappe en course), choisi dans les paquets
//     (player, player2 : soccer_pass « pass » = intérieur du pied, kick_soccerball « shoot » = cou-de-pied court,
//     strike_foward_jog « strike_run » = frappe en course au grand armé, kick_soccerball (1) « shoot2 » = jambe tendue,
//     kick_up_soccerball « kickup » = la pointe sous la balle ; les gestes aériens, retournée, ciseau, demi-volée, sont
//     choisis par la hauteur de la balle dans gestes.js) ;
//   · l'élan : la part du clip jouée avant le contact (elanA arrêté, elanC en course, en s de clip ; null = tout l'élan),
//     et le temps jusqu'au contact (t, pour un humain : l'action part dès l'appui, le contact tombe t s après ;
//     l'IA prend 1,6 t) : une passe a un élan court et part en 0,12 s, une passe puissante prend tout l'élan (0,2 s) ;
//   · l'après-contact rendu à la course (apres, s de jeu) ;
//   · la posture, appliquée par le rendu (rendu/animateur.js, couche « geste de commande ») sans rien changer au jeu :
//     surface du pied qui frappe (intérieur : la hanche ouverte, le pied tourné vers l'extérieur ; cou-de-pied : la
//     pointe tendue vers le bas ; extérieur : le pied tourné vers l'intérieur ; dessous : la pointe relevée, le pied
//     sous la balle ; pointe : le pied tendu vers la balle), buste (tangage, + en avant, ° ), roulis (+ : penché du
//     côté opposé au pied qui frappe, °), suivi (hauteur maximale du pied après le contact, m ; null : celle du clip),
//     bras (ouverture du bras opposé, °), regard (la tête relevée vers le jeu). buste et roulis sont des CIBLES au contact
//     (la pose du buste, pas un ajout) : le rendu mesure celle du clip et tourne le dos de ce qui manque ;
//   · pas : arrêté, le geste fait un pas d'élan (le root motion de la frappe en course, à petite échelle) — la frappe et
//     la passe puissante arrêtées ont ainsi leur grand armé et leur jambe qui accompagne.
// Le clip et le pied (gauche ou droit, la version miroir « _l ») sont choisis par gestes.js (clipFrappe) au moment où
// l'action part ; le rendu lit la commande dans l'état d'animation (rendu/etat.js, e.geste.commande).
// Pur : ni three, ni DOM ; lu par la simulation, le rendu et les bancs (tools/jeu-banc-gestes.ts).

/** Les gestes de balle par commande (id de entrees/touches.js). */
export const GESTES = {
  // ✕ : intérieur du pied, élan court ; en course, la frappe en course prise au sommet de l'armé (élan de 0,1 s)
  passe: { arrete: 'pass', course: 'strike_run', elanA: 0.2, elanC: 0.1, t: 0.12, apres: 0.15, surface: 'interieur', buste: 2, roulis: 0, suivi: 0.45 },
  // L1 + ✕ : la même passe, et le passeur repart aussitôt
  uneDeux: { arrete: 'pass', course: 'strike_run', elanA: 0.2, elanC: 0.1, t: 0.12, apres: 0.1, surface: 'interieur', buste: 2, roulis: 0, suivi: 0.4 },
  // R1 + ✕ : tout l'élan, cou-de-pied à plat, le buste au-dessus de la balle, la jambe qui accompagne
  passePuissante: { arrete: 'strike_run', course: 'strike_run', elanA: 0.2, elanC: null, pas: true, t: 0.2, apres: 0.25, surface: 'coudepied', buste: 14, roulis: 0, suivi: 0.75 },
  // ○ : cou-de-pied, grand armé, la jambe qui suit haut
  frappe: { arrete: 'strike_run', course: 'strike_run', elanA: 0.2, elanC: null, pas: true, t: 0.15, apres: 0.25, surface: 'coudepied', buste: -6, roulis: 0, suivi: null },
  // R1 + ○ : l'enroulée, intérieur du pied, tout l'élan de la passe, le corps penché sur le côté et en arrière
  finesse: { arrete: 'pass', course: 'strike_run', elanA: null, elanC: null, t: 0.17, apres: 0.25, surface: 'interieur', buste: -10, roulis: 16, suivi: null },
  // L1 + ○ : le piqué, la pointe sous la balle, frappe courte, buste en arrière, la jambe qui ne remonte pas
  pique: { arrete: 'kickup', course: 'strike_run', elanA: 0.25, elanC: 0.12, t: 0.12, apres: 0.12, surface: 'dessous', buste: -20, roulis: 0, suivi: 0.4 },
  // R2 + ○ au sol : frappe sèche à ras de terre, le buste au-dessus de la balle, la jambe qui ne remonte pas
  ras: { arrete: 'shoot', course: 'strike_run', elanA: null, elanC: 0.25, t: 0.12, apres: 0.2, surface: 'coudepied', buste: 18, roulis: 0, suivi: 0.3 },
  // R2 + ○ en l'air : retournée, ciseau ou demi-volée (gestes.js, selon la hauteur) ; au sol, comme la frappe
  acrobatique: { arrete: 'strike_run', course: 'strike_run', elanA: 0.2, elanC: null, pas: true, t: 0.15, apres: 0.25, surface: 'coudepied', buste: -6, roulis: 0, suivi: null },
  // L2 + ○ : l'extérieur du pied, la hanche fermée, penché du côté du pied
  exterieur: { arrete: 'shoot', course: 'strike_run', elanA: null, elanC: null, t: 0.15, apres: 0.25, surface: 'exterieur', buste: 0, roulis: -10, suivi: 0.6 },
  // □ : le centre, cou-de-pied sous la balle, buste en arrière, bras ouvert
  centre: { arrete: 'shoot', course: 'strike_run', elanA: null, elanC: null, t: 0.16, apres: 0.25, surface: 'sous', buste: -14, roulis: 8, suivi: null, bras: 45 },
  // L1 + □ : le centre lobé, la jambe tendue sous la balle, buste très en arrière, plus lent
  centreLobe: { arrete: 'shoot2', course: 'strike_run', elanA: null, elanC: null, t: 0.2, apres: 0.3, surface: 'dessous', buste: -26, roulis: 10, suivi: null, bras: 60 },
  // R1 + □ : le centre tendu, coup sec du cou-de-pied, buste droit
  centreTendu: { arrete: 'shoot', course: 'strike_run', elanA: null, elanC: 0.25, t: 0.12, apres: 0.2, surface: 'coudepied', buste: 2, roulis: 0, suivi: 0.6, bras: 20 },
  // △ : intérieur du pied dans la course du receveur, la tête relevée vers le jeu
  profondeur: { arrete: 'pass', course: 'strike_run', elanA: 0.25, elanC: 0.12, t: 0.13, apres: 0.15, surface: 'interieur', buste: 6, roulis: 0, suivi: 0.5, regard: 1 },
  // L1 + △ : le petit lob par-dessus la défense, la pointe sous la balle
  profondeurLobee: { arrete: 'kickup', course: 'strike_run', elanA: 0.25, elanC: 0.12, t: 0.14, apres: 0.15, surface: 'dessous', buste: -18, roulis: 0, suivi: 0.45, regard: 1 },
  // R1 + △ : la profondeur appuyée, coup sec de l'intérieur, buste en avant
  profondeurTendue: { arrete: 'pass', course: 'strike_run', elanA: 0.15, elanC: 0.1, t: 0.11, apres: 0.15, surface: 'interieur', buste: 12, roulis: 0, suivi: 0.35, regard: 1 },
  // ○ en défense : récupérer du pied, debout, la jambe tendue vers la balle (tacle debout, contacts.js)
  recuperer: { arrete: 'shoot2', course: 'shoot2', elanA: null, elanC: null, t: 0.15, apres: 0.2, surface: 'pointe', buste: 12, roulis: 0, suivi: 0.3 },
};

/**
 * La commande d'une demande : celle de la touche (spec.commande, posée par entrees/commande.js), sinon celle qui
 * correspond à ce que l'IA demande (type, puissante, lobe, haut, tendu, ras, acro).
 */
export function commandeDe(spec) {
  if (!spec) return 'frappe';
  if (spec.commande && GESTES[spec.commande]) return spec.commande;
  if (spec.commande === 'frappeParfaite' || spec.commande === 'feinteFrappe') return 'frappe';
  switch (spec.type) {
    case 'frappe': return spec.acro ? 'acrobatique' : spec.ras ? 'ras' : 'frappe';
    case 'finesse': return 'finesse';
    case 'lobFrappe': return 'pique';
    case 'exterieur': return 'exterieur';
    case 'centre': return spec.haut ? 'centreLobe' : spec.tendu ? 'centreTendu' : 'centre';
    case 'lob': return spec.haut ? 'centreLobe' : 'centre';
    case 'profondeur': return spec.lobe ? 'profondeurLobee' : spec.puissante ? 'profondeurTendue' : 'profondeur';
    case 'passe': return spec.uneDeux ? 'uneDeux' : spec.puissante ? 'passePuissante' : 'passe';
    default: return 'passe';
  }
}

/** Le geste d'une commande (la passe à défaut). */
export const gesteDe = (commande) => GESTES[commande] ?? GESTES.passe;

/** Le temps de l'élan jusqu'au contact (s de jeu) : t pour un humain, 1,6 t pour l'IA (0,17 à 0,3 s). */
export function tempsContact(G, humain) {
  return humain ? G.t : Math.min(0.3, Math.max(0.17, G.t * 1.6));
}
