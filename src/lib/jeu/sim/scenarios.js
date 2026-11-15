// Les scènes rejouables du jeu (bola-app#23) : placements, graine et suites d'intentions au pas près, pour les captures
// 01 à 05 du compte rendu et les essais. Une scène = { graine, presents?, creer(monde) → { entrees(monde) } } ;
// entrees rend, à chaque pas, les intentions des deux équipes (null = l'IA joue). Le même scénario rejoué donne la même
// image (la simulation est à graine et à pas fixe) ; la page l'avance par _test.avancer(n), sans dépendre des images
// par seconde. Rien ici n'est montré au joueur : c'est un outil de banc, appelé seulement par /jouer?banc.
import { PAS, BALLON } from './constantes.js';
import { rouler } from './gestes.js';
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
};

export { PAS };
