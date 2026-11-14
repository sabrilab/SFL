// L'IA des joueurs de champ (bola-app#23) : elle écrit des intentions, comme le pouce ou la manette, et subit donc la
// même inertie, les mêmes virages, les mêmes touches de balle et les mêmes contrôles. Plus de triche : pas de balle
// collée, pas de demi-tour instantané, ses frappes passent par la même puissance et la même erreur.
//
// Ses décisions reprennent celles d'avant (placement par formation, chasseur et couvreur, porteur qui va au but,
// passes, tirs, tacles), avec trois changements : le chasseur est celui qui arrive le premier à la balle (temps
// d'arrivée, élan compris) ; le hasard vient de la graine (flux « ia ») ; le couvreur contient (pas chassés face au
// porteur) au lieu de foncer.
import { PAS, CORPS as C, FORMATION, LB, BX, BZ, BUT_DL, butDe, sens } from './constantes.js';
import { clamp, libre } from './corps.js';
import { porteur, choisirPartenaire, adversaireProche } from './gestes.js';

/** Remet une intention à zéro. */
export function intentionVide(it = {}) {
  it.dx = 0; it.dz = 0; it.allure = 0; it.sprint = 0; it.regard = null;
  it.contenir = false; it.protege = false; it.charge = false; it.vaBalle = false; it.action = null;
  return it;
}

/** Aller vers (cx, cz) à vmax au plus, en freinant pour s'arrêter dessus. */
export function aller(j, it, cx, cz, vmax) {
  const dx = cx - j.p.x, dz = cz - j.p.z, d = Math.hypot(dx, dz);
  if (d < 0.25) { it.dx = 0; it.dz = 0; it.allure = 0; it.sprint = 0; return; }
  const v = Math.min(vmax, Math.sqrt(2 * 5 * Math.max(0, d - 0.2)));
  it.dx = dx / d; it.dz = dz / d;
  if (v <= C.vTrot) { it.allure = v / C.vTrot; it.sprint = 0; }
  else { it.allure = 1; it.sprint = clamp((v - C.vTrot) / (C.vSprint - C.vTrot), 0, 1); }
}

/** Temps pour qu'un joueur arrive au point (x, z), compte tenu de son élan (approché). */
export function tempsArrivee(j, x, z) {
  const dx = x - j.p.x, dz = z - j.p.z, d = Math.hypot(dx, dz);
  const s = Math.hypot(j.v.x, j.v.z);
  const dans = s > 0.3 ? (j.v.x * dx + j.v.z * dz) / (s * (d || 1)) : 0; // cos de l'écart
  const demi = (1 - dans) * 0.35 * (s / 4); // il faut d'abord tourner ou freiner
  return d / 6 + demi + (j.mode === 'sol' || j.mode === 'releve' ? 2 : j.mode === 'geste' ? 0.6 : 0);
}

/** L'intention d'un joueur de champ de l'IA. */
export function pasIA(m, j) {
  const it = intentionVide(j.int);
  const b = m.balle, rng = m.rng.ia;
  it.regard = b.p;
  if (!libre(j) && j.mode !== 'frein') return;
  const p = porteur(m);
  const notre = p ? p.e === j.e : b.garde != null ? m.joueurs[b.garde].e === j.e : null;
  j.decision = (j.decision ?? rng.u() * 0.3) - PAS;
  j.essai = (j.essai ?? 0) - PAS;

  if (p === j) {
    // le porteur : vers le but, en évitant le plus proche
    const zb = butDe(1 - j.e);
    let cx = clamp(-j.p.x * 0.2, -3, 3), cz = zb;
    const { o: proche, d: dp } = adversaireProche(m, j);
    if (proche && dp < 3.5) cx = j.p.x + Math.sign(j.p.x - proche.p.x || 1) * 4;
    // le long d'un panneau, il revient vers le milieu (la balle coincée contre le panneau ne se joue plus)
    if (Math.abs(j.p.x) > BX - 2.2) cx = Math.sign(j.p.x) * (BX - 5);
    cx = clamp(cx, -BX + 1.5, BX - 1.5);
    aller(j, it, cx, cz, 5.6);
    // il garde la balle : il court vers elle quand elle file devant
    conduire(m, j, it);
    // il protège un moment, puis s'en va de l'autre côté
    j.protegeT = proche && dp < 1.4 && Math.hypot(j.v.x, j.v.z) < 2 ? (j.protegeT ?? 0) + PAS : 0;
    if (j.protegeT > 0 && j.protegeT < 1.2) { it.protege = true; it.regard = proche.p; }
    else if (j.protegeT >= 1.2 && proche) { const ax = j.p.x - proche.p.x, az = j.p.z - proche.p.z, L = Math.hypot(ax, az) || 1; it.dx = ax / L; it.dz = az / L; it.allure = 0.8; if (j.protegeT > 2.4) j.protegeT = 0; }
    if (j.decision <= 0) {
      j.decision = 0.28 + rng.u() * 0.15;
      const dBut = Math.hypot(j.p.x, zb - j.p.z);
      if (dBut < 7 || (dBut < 9.5 && rng.u() < 0.55) || (dBut < 13 && Math.abs(j.p.x) < 6 && rng.u() < 0.22)) {
        const x = (rng.u() < 0.5 ? -1 : 1) * (0.35 + rng.u() * (BUT_DL - 0.6));
        const fin = rng.u() < 0.2;
        it.action = { type: fin ? 'finesse' : 'frappe', p: 0.5 + rng.u() * 0.4, x, y: 0.3 + rng.u() * 1.1 };
      } else if ((dp < 2.4 && rng.u() < 0.65) || (dp < 4 && rng.u() < 0.4) || rng.u() < 0.14 || Math.abs(j.p.x) > BX - 1.6) {
        const cible = choisirPartenaire(m, j, Math.sin(j.cap), Math.cos(j.cap) + sens(j.e) * 0.6);
        if (cible) {
          const d = Math.hypot(cible.p.x - j.p.x, cible.p.z - j.p.z);
          const prof = rng.u() < 0.25;
          // la force qu'il faut pour que la passe arrive à 4-5 m/s (roulement 1,08 m/s² et l'air)
          const v0 = Math.sqrt(4.5 * 4.5 + 2 * 1.35 * d);
          const lob = d > 14 && rng.u() < 0.4;
          it.action = { type: lob ? 'lob' : prof ? 'profondeur' : 'passe', p: clamp((v0 - 6) / 12, 0.05, 1), cible: cible.i, dx: cible.p.x - j.p.x, dz: cible.p.z - j.p.z };
        }
      }
    }
    return;
  }

  // le placement de base, poussé vers l'avant quand l'équipe a la balle, attiré par la balle
  const fBalle = b.p.z / (sens(j.e) * LB);
  const [bx, bf] = FORMATION[j.role];
  const pousse = notre === true ? 0.32 : notre === false ? -0.12 : 0.05;
  let cx = bx + b.p.x * 0.35;
  let cz = sens(j.e) * clamp(bf + pousse + fBalle * 0.42, -0.9, 0.85) * LB;
  let vmax = 5.2;
  if (notre !== true && b.garde == null) {
    // qui va chercher la balle : celui de l'équipe qui y arrive le premier (sauf le joueur humain, qui choisit)
    const humain = m.controle[j.e];
    const ia = m.joueurs.filter((o) => o.e === j.e && !o.gardien && !o.absent && o.i !== humain);
    const tb = (o) => tempsArrivee(o, b.p.x + b.v.x * 0.3, b.p.z + b.v.z * 0.3);
    ia.sort((a, c) => tb(a) - tb(c));
    const prochain = b.recepteur != null && m.joueurs[b.recepteur].e === j.e ? b.recepteur : null;
    const hj = humain != null ? m.joueurs[humain] : null;
    const humainPresse = hj && Math.hypot(hj.p.x - b.p.x, hj.p.z - b.p.z) < 4;
    const chasseur = prochain ?? (humainPresse ? null : ia[0]?.i);
    const couvreur = humainPresse ? ia[0]?.i : ia[1]?.i;
    if (j.i === chasseur) {
      const t = Math.min(0.7, Math.hypot(b.p.x - j.p.x, b.p.z - j.p.z) / 6.5);
      cx = b.p.x + b.v.x * t; cz = b.p.z + b.v.z * t;
      vmax = 6.6; it.vaBalle = true;
    } else if (j.i === couvreur && notre === false) {
      // le second : entre la balle et son but, à quelques pas, face au porteur
      const zb = butDe(j.e);
      const ux = -b.p.x, uz = zb - b.p.z, L = Math.hypot(ux, uz) || 1;
      cx = b.p.x + (ux / L) * 3.2; cz = b.p.z + (uz / L) * 3.2;
      if (Math.hypot(b.p.x - j.p.x, b.p.z - j.p.z) < 5) { it.contenir = true; it.regard = b.p; }
    }
  } else if (b.recepteur === j.i) {
    // une passe arrive : à sa rencontre
    cx = b.p.x + b.v.x * 0.3; cz = b.p.z + b.v.z * 0.3; vmax = 6; it.vaBalle = true;
  }
  cx = clamp(cx, -BX + 0.5, BX - 0.5); cz = clamp(cz, -BZ + 0.6, BZ - 0.6);
  aller(j, it, cx, cz, vmax);
  // le tacle, sur le porteur d'en face
  if (p && p.e !== j.e && j.essai <= 0) {
    const d = Math.hypot(p.p.x - j.p.x, p.p.z - j.p.z);
    const db = Math.hypot(b.p.x - j.p.x, b.p.z - j.p.z);
    if (d < 2.4) {
      j.essai = 0.7;
      const ch = m.controle[p.e] === p.i ? 0.3 : 0.2;
      // le tacle debout : la balle devant lui, pas derrière les jambes du porteur
      const devant = (b.p.x - j.p.x) * Math.sin(j.cap) + (b.p.z - j.p.z) * Math.cos(j.cap) > 0.3;
      // (une balle protégée derrière le porteur : le tacle debout passe par ses jambes et le déséquilibre)
      if (db < 1.1 && (devant || d < 0.8) && rng.u() < ch) it.action = { type: 'tacle', glisse: false };
      else if (db < 2.2 && db > 1.0 && rng.u() < ch * 0.4) it.action = { type: 'tacle', glisse: true };
      else if (d < 1.0 && rng.u() < 0.3) it.charge = true;
    }
  }
}

/** Aide de conduite (IA et humains) : la course se règle sur la balle qui file devant, pour la rattraper. */
export function conduire(m, j, it) {
  const b = m.balle;
  if (!(it.dx || it.dz)) return;
  const rx = b.p.x - j.p.x, rz = b.p.z - j.p.z, d = Math.hypot(rx, rz);
  if (d < 0.35 || d > 5) return;
  const al = (rx * it.dx + rz * it.dz) / d;
  if (al < 0.35) return;
  // viser un peu derrière la balle, sur sa course
  const t = 0.12;
  const tx = b.p.x + b.v.x * t - j.p.x, tz = b.p.z + b.v.z * t - j.p.z, L = Math.hypot(tx, tz) || 1;
  const w = clamp((d - 0.35) / 1.2, 0.3, 0.85);
  let ux = it.dx * (1 - w) + (tx / L) * w, uz = it.dz * (1 - w) + (tz / L) * w;
  const n = Math.hypot(ux, uz) || 1;
  it.dx = ux / n; it.dz = uz / n;
  // la balle file : on accélère pour la rejoindre
  if (d > 1.6) it.allure = Math.max(it.allure, 1);
}
