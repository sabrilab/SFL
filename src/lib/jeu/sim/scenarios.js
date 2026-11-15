// Les scènes rejouables du jeu (bola-app#23) : placements, graine et suites d'intentions au pas près, pour les captures
// 01 à 09 des comptes rendus et les essais. Une scène = { graine, presents?, creer(monde) → { entrees(monde) } } ;
// entrees rend, à chaque pas, les intentions des deux équipes (null = l'IA joue). Le même scénario rejoué donne la même
// image (la simulation est à graine et à pas fixe) ; la page l'avance par _test.avancer(n), sans dépendre des images
// par seconde. Rien ici n'est montré au joueur : c'est un outil de banc, appelé seulement par /jouer?banc.
import { PAS, BALLON } from './constantes.js';
import { rouler, demanderFrappe } from './gestes.js';
import { faute } from './contacts.js';
import { cos, hypot, sin } from './maths.js';

const R = BALLON.R;
const intention = (dx, dz, allure, sprint = 0, extra = {}) => ({ dx, dz, allure, sprint, ...extra });

function poser(j, x, z, cap, vx = 0, vz = 0) { j.p.x = x; j.p.z = z; j.cap = cap; j.v.x = vx; j.v.z = vz; }
function balleA(M, x, z, vx = 0, vz = 0, possesseur = null) {
  const b = M.balle;
  b.p.x = x; b.p.y = R; b.p.z = z; b.v.x = vx; b.v.y = 0; b.v.z = vz; rouler(b);
  b.possesseur = possesseur; b.dernier = possesseur; b.dernierT = M.t; b.garde = null; b.tir = null; b.recepteur = null;
}

export const SCENARIOS = {
  // 01 : course lancée et virage. Le n° 10 Noir part de sa moitié balle au pied, sprint plein, puis tourne de 80°.
  course: {
    graine: 101, presents: [0, 4, 5, 6, 8],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [4, null];
      poser(M.joueurs[4], 2.5, 11, Math.PI, 0, -5.5);
      balleA(M, 2.5, 10.2, 0, -6.4, 4);
      poser(M.joueurs[6], -4, -6, 0); poser(M.joueurs[8], 3, -9, 0);
      const t0 = M.t;
      return {
        entrees(m) {
          const t = m.t - t0;
          // le virage : le stick tourne de 80° vers le haut de l'écran (−x), en 0,3 s
          const a = t < 1.4 ? 0 : Math.min(1, (t - 1.4) / 0.3) * (80 * Math.PI) / 180;
          return [intention(-sin(a), -cos(a), 1, 1), null];
        },
      };
    },
  },
  // 02 : duel épaule contre épaule le long du panneau du bas de l'écran (+x).
  epaule: {
    graine: 102, presents: [0, 4, 5, 6],
    creer(M) {
      M.humains = [true, true]; M.controleFixe = [4, 6];
      poser(M.joueurs[4], 7.6, 6, Math.PI, 0, -6);
      balleA(M, 7.6, 5.0, 0, -6.6, 4);
      poser(M.joueurs[6], 7.0, 6.6, Math.PI, 0, -6.4);
      return {
        entrees(m) {
          // le défenseur serre le porteur : il vise son épaule, en courant dans le même sens
          const a = m.joueurs[4], d = m.joueurs[6];
          const ex = (a.p.x - 0.55 - d.p.x) * 1.6;
          return [intention(0.05, -1, 1, 0.5), intention(ex, -1, 1, 0.75, { charge: true })];
        },
      };
    },
  },
  // 03 : tacle glissé de trois quarts arrière sur un porteur Blanc lancé à 5 m/s ; chute, balle qui file.
  tacle: {
    graine: 103, presents: [0, 2, 5, 9],
    creer(M) {
      M.humains = [true, true]; M.controleFixe = [2, 9];
      poser(M.joueurs[9], 1.5, -2, 0, 0, 5);
      balleA(M, 1.5, -1.2, 0, 5.6, 9);
      poser(M.joueurs[2], 3.6, -4.4, 0.5, 1.5, 5.5);
      let fait = false;
      return {
        entrees(m) {
          const t = m.joueurs[2], b = m.balle;
          const dx = b.p.x - t.p.x, dz = b.p.z - t.p.z, d = hypot(dx, dz) || 1;
          const act = !fait && d < 2.1 ? { type: 'tacle', glisse: true } : null;
          if (act) fait = true;
          return [intention(dx / d, dz / d, 1, 0.6, { action: act }), intention(0, 1, 1, 0.1)];
        },
      };
    },
  },
  // 04 : une passe Blanche à 21 m/s sur un Noir, qui veut la contrôler en se tournant de 90°.
  controle: {
    graine: 104, presents: [0, 3, 5, 8],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [3, null];
      poser(M.joueurs[3], 1, 2, Math.PI / 2);
      poser(M.joueurs[8], -8, 2.5, -Math.PI / 2);
      balleA(M, -7.2, 2.4, 21, -0.4, null);
      M.balle.dernier = 8; M.balle.recepteur = 3;
      return { entrees: () => [intention(0, -1, 0.06, 0), null] };
    },
  },
  // 05 : frappe à 11 m, pleine puissance, vers la lucarne opposée ; le gardien plonge.
  frappe: {
    graine: 105, presents: [4, 5],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [4, null];
      poser(M.joueurs[4], -1.2, -3.4, Math.PI);
      balleA(M, -1.1, -4.0, 0, 0, 4);
      poser(M.joueurs[5], -0.2, -14, 0);
      let n = 0;
      return {
        entrees() {
          n++;
          return [intention(0, 0, 0, 0, { action: n === 12 ? { type: 'frappe', p: 0.42, x: 1.05, y: 1.1 } : null }), null];
        },
      };
    },
  },
  // (bola-app#26) 06 : une balle à hauteur de poitrine sur un Noir arrêté : l'amorti de la poitrine, anticipé.
  poitrine: {
    graine: 106, presents: [0, 3, 5, 8],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [3, null];
      poser(M.joueurs[3], 1, 2, -Math.PI / 2);
      poser(M.joueurs[8], -8, 2.5, -Math.PI / 2);
      const b = M.balle;
      b.p.x = -5; b.p.y = 1.05; b.p.z = 2; b.v.x = 9; b.v.y = 3.3; b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
      b.possesseur = null; b.dernier = 8; b.dernierT = M.t; b.garde = null; b.tir = null; b.recepteur = 3;
      return { entrees: () => [intention(0, 0, 0, 0), null] };
    },
  },
  // 07 : passement de jambes en course face à un défenseur.
  passement: {
    graine: 107, presents: [0, 4, 5, 6],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [4, null];
      poser(M.joueurs[4], 0, 6, Math.PI, 0, -3);
      balleA(M, 0, 5.4, 0, -3.3, 4);
      poser(M.joueurs[6], 0.2, 2.4, 0);
      let n = 0;
      return {
        entrees() {
          n++;
          return [intention(0, -1, 0.6, 0, { action: n === 30 ? { type: 'passement', dx: 1, dz: 0 } : null }), null];
        },
      };
    },
  },
  // 09 : sombrero à l'arrêt (kick_up_soccerball) au-dessus d'un défenseur qui arrive.
  sombrero: {
    graine: 109, presents: [0, 4, 5, 6],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [4, null];
      poser(M.joueurs[4], 0, 4, Math.PI, 0, 0);
      balleA(M, 0, 3.6, 0, 0, 4);
      poser(M.joueurs[6], 0.1, 1.6, 0);
      let n = 0;
      return { entrees() { n++; return [intention(0, -1, n < 140 ? 0 : 0.6, 0, { action: n === 6 ? { type: 'sombrero' } : null, regard: M.balle.p }), null]; } };
    },
  },
  // 08 : frappe basse vers le poteau : le plongeon bas du gardien, couché sur le côté.
  plongeonBas: {
    graine: 108, presents: [4, 5],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [4, null];
      poser(M.joueurs[4], 0.4, -1.6, Math.PI);
      balleA(M, 0.4, -2.2, 0, 0, 4);
      poser(M.joueurs[5], 0, -14, 0);
      let n = 0;
      return { entrees() { n++; return [intention(0, 0, 0, 0, { action: n === 12 ? { type: 'frappe', p: 0.3, x: 1.15, y: 0.2 } : null }), null]; } };
    },
  },
  // ── (bola-app#26, lot 2) duels, ballon, IA collective ──
  // 10 : tirage de maillot. Le n° 10 Noir file balle au pied, le défenseur Blanc collé dans son dos le tient (faute au
  // bout de 0,8 s, l'arbitre regarde l'avantage).
  tirage: {
    graine: 110, presents: [0, 4, 5, 6],
    creer(M) {
      M.humains = [true, true]; M.controleFixe = [4, 6];
      poser(M.joueurs[4], 1, 5, Math.PI, 0, -4.2);
      balleA(M, 1, 4.4, 0, -5, 4);
      poser(M.joueurs[6], 1.05, 5.62, Math.PI, 0, -4.2);
      return {
        entrees(m) {
          const p = m.joueurs[4], d = m.joueurs[6];
          return [intention(0, -1, 1, 0), intention((p.p.x - d.p.x) * 2, -1, 1, 0.3, { tire: true })];
        },
      };
    },
  },
  // 11 : centre du côté gauche, l'attaquant Noir le reprend de la tête au point de penalty.
  centre: {
    graine: 61, presents: [1, 4, 5, 7],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [1, null];
      poser(M.joueurs[1], -6.5, -9.5, Math.PI / 2);
      balleA(M, -6.05, -9.5, 0, 0, 1);
      poser(M.joueurs[4], 0.3, -9.8, Math.PI);
      poser(M.joueurs[5], 0, -14.2, 0);
      poser(M.joueurs[7], 2.5, -11.5, 0);
      let n = 0;
      return { entrees() { n++; return [intention(0, 0, 0, 0, { action: n === 6 ? { type: 'centre', p: 0.9, cible: 4 } : null }), null]; } };
    },
  },
  // 12 : frappe brossée de l'intérieur du pied droit, de 12 m : la balle part à droite du but et revient sur le poteau.
  brossee: {
    graine: 112, presents: [4, 5],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [4, null];
      poser(M.joueurs[4], 2.2, -2.4, Math.PI);
      balleA(M, 2.36, -3.0, 0, 0, 4);
      poser(M.joueurs[5], 0.3, -14, 0);
      let n = 0;
      return { entrees() { n++; return [intention(0, 0, 0, 0, { action: n === 12 ? { type: 'finesse', p: 0.6, x: -1.0, y: 1.0 } : null }), null]; } };
    },
  },
  // 13 : coup franc. Une faute notée sur le porteur Noir, le Blanc prend la balle : coup franc au point de la faute, les
  // Blancs reculent à 3 m, le Noir fauté le joue.
  coupFranc: {
    graine: 113, presents: [0, 2, 4, 5, 6, 8, 9],
    creer(M) {
      M.humains = [false, false];
      poser(M.joueurs[4], 1, 2, Math.PI, 0, -3); balleA(M, 1, 1.55, 0, -3.3, 4);
      poser(M.joueurs[6], 1.3, 2.8, Math.PI); poser(M.joueurs[8], 2.2, 0.6, 0); poser(M.joueurs[9], -0.4, -1.4, 0);
      poser(M.joueurs[2], -4, -2, Math.PI);
      faute(M, M.joueurs[6], M.joueurs[4], 'debout');
      const o = M.joueurs[8]; balleA(M, o.p.x, o.p.z + 0.4, 0, 0, 8);
      return { entrees: () => [null, null] };
    },
  },
  // 14 : une-deux. Le Noir passe au mur, repart dans le dos du défenseur planté, reçoit la remise.
  uneDeux: {
    graine: 84, presents: [2, 4, 5, 8],
    creer(M) {
      M.humains = [false, true]; M.controleFixe = [null, 8];
      poser(M.joueurs[2], -2, 2, Math.PI); balleA(M, -2, 1.55, 0, 0, 2);
      poser(M.joueurs[4], 1.2, -1.6, Math.PI * 0.8); poser(M.joueurs[8], -2.0, 0.6, 0);
      let n = 0;
      return {
        entrees(m) {
          n++;
          if (n === 3) { const a = m.joueurs[2]; a.uneDeux = { t: m.t, cible: 4, x: -3.4, z: -3.5 }; demanderFrappe(m, a, { type: 'passe', p: 0.25, cible: 4 }); }
          return [null, intention(0, 0, 0, 0)];
        },
      };
    },
  },
  // 15 : pressing coordonné sur un porteur Blanc dos au but : le chasseur, le second presseur qui ferme le milieu, le
  // couvreur entre la balle et le but.
  pressing: {
    graine: 121, presents: [0, 1, 2, 3, 4, 8, 9],
    creer(M) {
      M.humains = [false, true]; M.controleFixe = [null, 9];
      poser(M.joueurs[9], 0.5, -0.7, Math.PI); balleA(M, 0.5, -1.1, 0, 0, 9);
      poser(M.joueurs[8], 4.5, 2.5, 0);
      poser(M.joueurs[1], 0, 9, Math.PI); poser(M.joueurs[2], -2, 3.5, Math.PI); poser(M.joueurs[3], 2.5, 4.5, Math.PI); poser(M.joueurs[4], 0, 3, Math.PI);
      return { entrees(m) { m.balle.dernierT = m.t; return [null, intention(0, 0, 0, 0)]; } };
    },
  },
  // ── (bola-app#26, lot 3) les gestes des touches ──
  // 16 : double passement (LT + quart de cercle) en course face à un défenseur.
  doublePassement: {
    graine: 116, presents: [0, 4, 5, 6],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [4, null];
      poser(M.joueurs[4], 0, 6, Math.PI, 0, -3);
      balleA(M, 0, 5.4, 0, -3.3, 4);
      poser(M.joueurs[6], 0.2, 2.4, 0);
      let n = 0;
      return { entrees() { n++; return [intention(0, -1, 0.6, 0, { action: n === 30 ? { type: 'passement', dx: 1, dz: 0, double: true } : null }), null]; } };
    },
  },
  // 17 : jonglage sur place (LB + RB tenus).
  jongle: {
    graine: 117, presents: [0, 4, 5],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [4, null];
      poser(M.joueurs[4], 0, 4, Math.PI, 0, 0);
      balleA(M, 0, 3.6, 0, 0, 4);
      let n = 0;
      return { entrees() { n++; return [intention(0, 0, 0, 0, { action: n % 36 === 6 ? { type: 'jongle' } : null, regard: M.balle.p }), null]; } };
    },
  },
  // 18 : feinte de frappe (X puis A) devant un défenseur, qui part pour la frappe.
  feinteFrappe: {
    graine: 118, presents: [0, 4, 5, 6],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [4, null];
      poser(M.joueurs[4], 0, 2, Math.PI, 0, 0);
      balleA(M, 0, 1.55, 0, 0, 4);
      poser(M.joueurs[6], 0.3, -0.6, 0);
      let n = 0;
      return { entrees() { n++; return [intention(0, -1, n < 60 ? 0 : 0.5, 0, { action: n === 6 ? { type: 'feinteFrappe' } : null }), null]; } };
    },
  },
  // 19 : l'enchaînement crochet → roulette → frappe, la frappe en file pendant la roulette.
  enchainement: {
    graine: 119, presents: [0, 4, 5, 7],
    creer(M) {
      M.humains = [true, false]; M.controleFixe = [4, null];
      poser(M.joueurs[4], 1, 6, Math.PI, 0, -4.2);
      balleA(M, 1, 5.4, 0, -4.6, 4);
      poser(M.joueurs[7], -2.5, -1, 0);
      let n = 0;
      const A = { 12: { type: 'crochet', dx: -1, dz: 0 }, 48: { type: 'roulette', dx: 0, dz: -1 }, 70: { type: 'frappe', p: 0.55, x: -0.8 } };
      return { entrees() { n++; return [intention(0, -1, 1, 0, { action: A[n] ?? null }), null]; } };
    },
  },
};

export { PAS };
