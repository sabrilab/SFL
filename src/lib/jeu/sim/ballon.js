// Le ballon du jeu : un objet libre, toujours. Personne ne pose sa position (sauf dans les mains du gardien qui le
// tient) : les joueurs le touchent par des impulsions (gestes.js), et ce fichier l'intègre au pas fixe.
//
// Physique (constantes.js, BALLON) :
//   en l'air   gravité, traînée −k_d |v| v (avec la crise de traînée : C_d de 0,45 à 0,25 entre 9 et 13 m/s), effet
//              Magnus (ρA/2m) C_L |v|² (ω̂ × v̂) avec C_L = min(0,22 ; 0,7 R|ω|/|v|), la rotation qui s'amortit (τ = 6 s) ;
//   au rebond  restitution qui baisse avec la vitesse, frottement de Coulomb au point de contact : la rotation change,
//              une balle brossée repart de côté, un rétro-effet freine ;
//   au sol     glissement jusqu'au roulement (μ = 0,40), puis résistance au roulement (μ_r = 0,11, synthétique) ;
//   panneaux   (0,95 m) restitution 0,66 − 0,006 |v_n| ; au-dessus, le filet (jusqu'à 6,15 m) amortit presque tout ;
//   buts       poteaux et barre en cylindres (r = 5 cm, e = 0,55), filets du but (e = 0,10), fermés de l'extérieur.
// Le déplacement d'un pas est découpé en sous-pas de 5 cm au plus : à 30 m/s, rien ne traverse un poteau ni un panneau.
// Le but est compté quand le ballon entier a passé la ligne entre les poteaux et sous la barre (on ne peut entrer dans
// la cage que par devant), sans tirage au sort. Un ballon arrêté dans un coin plus de 1,5 s reçoit une petite poussée
// vers le centre (anti-blocage, compté par le banc).
//
// Rien ici ne dépend de three ni du DOM : le même code tourne dans la page, dans le banc node et dans la prédiction du
// gardien (predire), qui rejoue l'intégrateur sur une copie.
import { PAS, G, BALLON as B, BX, BZ, LB, BUT_DL, BUT_H, BUT_P, HAUT_FILET, TERRAIN } from './constantes.js';

const R = B.R;
const COTES = [-1, 1];
const KI = (B.masse * R * R) / B.inertie; // m R² / I = 1,5 pour une sphère creuse

export function creerBalle() {
  return {
    p: { x: 0, y: R, z: 0 }, v: { x: 0, y: 0, z: 0 }, w: { x: 0, y: 0, z: 0 },
    garde: null,          // le gardien qui la tient (index), ou null
    dernier: null, dernierT: -9, // le dernier joueur à l'avoir touchée, et quand
    possesseur: null,     // le joueur qui la conduit (dernier toucher contrôlé), ou null
    recepteur: null,      // le destinataire d'une passe en cours
    tir: null,            // la frappe en cours vers un but : { e (équipe qui frappe), t0 }
    coinT: 0,             // temps passé arrêtée dans un coin
    sol: true,            // au sol (roule ou glisse)
  };
}

export function copierBalle(b, o = creerBalle()) {
  o.p.x = b.p.x; o.p.y = b.p.y; o.p.z = b.p.z;
  o.v.x = b.v.x; o.v.y = b.v.y; o.v.z = b.v.z;
  o.w.x = b.w.x; o.w.y = b.w.y; o.w.z = b.w.z;
  o.garde = b.garde; o.sol = b.sol;
  return o;
}

const cd = (v) => (v <= B.vCrise1 ? B.cdBas : v >= B.vCrise2 ? B.cdHaut : B.cdBas + ((B.cdHaut - B.cdBas) * (v - B.vCrise1)) / (B.vCrise2 - B.vCrise1));

/** Les forces de l'air sur la vitesse (traînée, Magnus), pendant dt. */
function air(b, dt) {
  const v = b.v, s = Math.hypot(v.x, v.y, v.z);
  if (s < 1e-6) return;
  const k = B.kAir * cd(s);
  // traînée
  let ax = -k * s * v.x, ay = -k * s * v.y, az = -k * s * v.z;
  // Magnus : C_L = min(0,22 ; 0,7 R |ω| / |v|) ; direction ω̂ × v̂
  const w = b.w, wn = Math.hypot(w.x, w.y, w.z);
  if (wn > 1e-3) {
    const cl = Math.min(B.clMax, (B.clPente * R * wn) / s);
    const m = (B.kAir * cl * s * s) / (wn * s);
    ax += m * (w.y * v.z - w.z * v.y);
    ay += m * (w.z * v.x - w.x * v.z);
    az += m * (w.x * v.y - w.y * v.x);
  }
  v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
}

/**
 * Un choc contre une surface de normale n (unité, vers le ballon), restitution e, frottement tangent mu (part de
 * l'impulsion normale). Rien si le ballon s'éloigne déjà. Renvoie la vitesse normale d'arrivée (≥ 0).
 */
function choc(b, nx, ny, nz, e, mu) {
  const v = b.v, vn = v.x * nx + v.y * ny + v.z * nz;
  if (vn >= 0) return 0;
  const jn = -(1 + e) * vn; // impulsion normale par unité de masse
  v.x += jn * nx; v.y += jn * ny; v.z += jn * nz;
  if (mu > 0) {
    // vitesse du point de contact (r = −R n) : v + ω × r
    const rx = -R * nx, ry = -R * ny, rz = -R * nz, w = b.w;
    let cx = v.x + (w.y * rz - w.z * ry), cy = v.y + (w.z * rx - w.x * rz), cz = v.z + (w.x * ry - w.y * rx);
    const cn = cx * nx + cy * ny + cz * nz;
    cx -= cn * nx; cy -= cn * ny; cz -= cn * nz;
    const c = Math.hypot(cx, cy, cz);
    if (c > 1e-6) {
      // le frottement qui annulerait le glissement : Δv = −c / (1 + mR²/I), borné par Coulomb
      const dv = Math.min(c / (1 + KI), mu * jn);
      const tx = -(cx / c) * dv, ty = -(cy / c) * dv, tz = -(cz / c) * dv;
      v.x += tx; v.y += ty; v.z += tz;
      // Δω = (r × Δv) m / I
      const f = KI / (R * R);
      w.x += (ry * tz - rz * ty) * f; w.y += (rz * tx - rx * tz) * f; w.z += (rx * ty - ry * tx) * f;
    }
  }
  return -vn;
}

/** Un cylindre (poteau, barre) : axe passant par (ax, ay, az) de direction unité d (un des axes), rayon r. */
function cylindre(b, ax, ay, az, dx, dy, dz, lmin, lmax, r, e, ev) {
  const p = b.p;
  const qx = p.x - ax, qy = p.y - ay, qz = p.z - az;
  const l = qx * dx + qy * dy + qz * dz;
  if (l < lmin || l > lmax) return;
  const ox = qx - l * dx, oy = qy - l * dy, oz = qz - l * dz;
  const d = Math.hypot(ox, oy, oz), rr = r + R;
  if (d >= rr || d < 1e-9) return;
  const nx = ox / d, ny = oy / d, nz = oz / d;
  p.x += nx * (rr - d); p.y += ny * (rr - d); p.z += nz * (rr - d);
  const vn = choc(b, nx, ny, nz, e, 0.2);
  if (vn > 0.5) ev?.('poteau', vn);
}

/** Un panneau (ou le filet au-dessus) perpendiculaire à l'axe x ou z, à la distance lim du centre. */
function mur(b, axe, lim, ev) {
  const p = b.p, q = axe === 'x' ? p.x : p.z;
  if (Math.abs(q) <= lim) return;
  const s = Math.sign(q);
  if (axe === 'x') p.x = s * lim; else p.z = s * lim;
  const panneau = p.y < TERRAIN.panneau;
  const vn = Math.abs(axe === 'x' ? b.v.x : b.v.z);
  const e = panneau ? Math.max(B.panneauMin, B.panneauE - B.panneauPente * vn) : B.filetE;
  if (axe === 'x') choc(b, -s, 0, 0, e, panneau ? B.panneauT : 0); else choc(b, 0, 0, -s, e, panneau ? B.panneauT : 0);
  if (!panneau) {
    // le filet : la balle glisse le long, amortie
    if (axe === 'x') b.v.z *= 1 - B.filetT * 0.5; else b.v.x *= 1 - B.filetT * 0.5;
    b.v.y *= 0.7;
  }
  if (vn > 1) ev?.(panneau ? 'panneau' : 'filet', vn);
}

/** Les murs et les buts, après un sous-pas. ev(type, force) signale les chocs (panneau, filet, poteau). */
function bords(b, ev) {
  const p = b.p;
  // panneaux de côté et du fond (au-dessus : le filet, puis le toit)
  mur(b, 'x', BX - R, ev);
  mur(b, 'z', BZ - R, ev);
  if (p.y > HAUT_FILET + 8) { p.y = HAUT_FILET + 8; if (b.v.y > 0) b.v.y = -b.v.y * 0.2; }
  // les deux buts
  for (const s of COTES) {
    const zl = s * LB;
    const dz = (p.z - zl) * s; // > 0 : derrière la ligne
    if (dz > -0.4 && dz < BUT_P + 0.4 && Math.abs(p.x) < BUT_DL + 0.4 && p.y < BUT_H + 0.4) {
      // poteaux (verticaux) et barre (horizontale), sur la ligne
      for (const sx of COTES) cylindre(b, sx * BUT_DL, 0, zl, 0, 1, 0, 0, BUT_H, B.poteauR, B.poteauE, ev);
      cylindre(b, 0, BUT_H, zl, 1, 0, 0, -BUT_DL, BUT_DL, B.poteauR, B.poteauE, ev);
      // les filets : le fond, les côtés, le toit ; fermés des deux côtés (on n'entre que par devant)
      const dedans = Math.abs(p.x) < BUT_DL && p.y < BUT_H;
      if (dz > 0 && dz < BUT_P + R) {
        for (const sx of COTES) {
          const ox = (p.x - sx * BUT_DL) * sx; // > 0 : dehors, de ce côté
          if (Math.abs(ox) < R && p.y < BUT_H) {
            p.x = sx * BUT_DL + Math.sign(ox || -1) * R * sx;
            choc(b, Math.sign(ox || -1) * sx, 0, 0, B.filetBut, 0.3);
          }
        }
        if (Math.abs(p.x) < BUT_DL && Math.abs(p.y - BUT_H) < R) {
          const dessus = p.y > BUT_H;
          p.y = BUT_H + (dessus ? R : -R);
          choc(b, 0, dessus ? 1 : -1, 0, B.filetBut, 0.3);
        }
      }
      if (dedans && dz > BUT_P - R && dz < BUT_P + R) {
        const derriere = dz > BUT_P;
        p.z = zl + s * (BUT_P + (derriere ? R : -R));
        choc(b, 0, 0, derriere ? s : -s, B.filetBut, 0.3);
      }
    }
  }
}

/**
 * Un pas de ballon libre (dt = PAS). ev(type, force) : les chocs. Ne fait rien si le ballon est gardé.
 * Renvoie l'équipe qui marque (0 ou 1) si le ballon vient d'entrer dans un but, sinon -1.
 */
export function pasBalle(b, ev, dt = PAS) {
  if (b.garde != null) return -1;
  const p = b.p, v = b.v, w = b.w;
  air(b, dt);
  const auSol = p.y <= R + 1e-4 && v.y <= B.finRebond && v.y >= -B.finRebond;
  if (!auSol) {
    v.y -= G * dt;
    const k = Math.exp(-dt / B.tauRotation);
    w.x *= k; w.y *= k; w.z *= k;
  } else {
    p.y = R; v.y = 0;
    // vitesse du point de contact (r = (0, −R, 0)) : v + ω × r = (v.x + R ω_z, 0, v.z − R ω_x)
    const cx = v.x + R * w.z, cz = v.z - R * w.x, c = Math.hypot(cx, cz);
    if (c > 0.05) {
      // glissement : le frottement tend vers le roulement (la vitesse de contact baisse de (1 + mR²/I) × Δv)
      const dv = Math.min(B.muGlisse * G * dt, c / (1 + KI));
      const tx = (-cx / c) * dv, tz = (-cz / c) * dv;
      v.x += tx; v.z += tz;
      const f = KI / R; // Δω = (r × Δv) m / I, r = (0, −R, 0)
      w.x += -tz * f; w.z += tx * f;
    } else {
      w.z = -v.x / R; w.x = v.z / R;
    }
    // résistance au roulement, et la rotation sur place qui meurt
    const s = Math.hypot(v.x, v.z);
    if (s > 0) {
      const ns = Math.max(0, s - B.muRoule * G * dt);
      v.x *= ns / s; v.z *= ns / s;
      if (c <= 0.05) { w.z = -v.x / R; w.x = v.z / R; }
    }
    w.y *= Math.exp(-dt / 0.8);
  }
  // le déplacement, en sous-pas de 5 cm au plus
  const d = Math.hypot(v.x, v.y, v.z) * dt;
  const n = Math.min(8, Math.max(1, Math.ceil(d / 0.05)));
  const zAvant = p.z;
  for (let i = 0; i < n; i++) {
    p.x += (v.x * dt) / n; p.y += (v.y * dt) / n; p.z += (v.z * dt) / n;
    if (p.y < R) {
      p.y = R;
      if (v.y < -B.finRebond) {
        const e = Math.max(B.enMin, B.enBase - B.enPente * -v.y);
        const vn = choc(b, 0, 1, 0, e, B.mu);
        if (vn > 2) ev?.('rebond', vn);
      } else if (v.y < 0) v.y = 0;
    }
    bords(b, ev);
  }
  b.sol = p.y <= R + 1e-3 && Math.abs(v.y) < 1e-6;
  // le but : le ballon entier derrière la ligne, entre les poteaux, sous la barre
  for (const s of COTES) {
    const lim = s * (LB + R);
    if ((p.z - lim) * s > 0 && (zAvant - lim) * s <= 0 && Math.abs(p.x) < BUT_DL && p.y < BUT_H) return s < 0 ? 0 : 1;
  }
  return -1;
}

/** Anti-blocage : un ballon arrêté dans un coin (ou collé à un panneau) plus de 1,5 s est relancé vers le centre. */
export function antiBlocage(b, dt = PAS) {
  const s = Math.hypot(b.v.x, b.v.z);
  const coin = (Math.abs(b.p.x) > BX - 0.7 && Math.abs(b.p.z) > BZ - 0.7);
  if (b.garde == null && coin && s < 0.3) b.coinT += dt; else b.coinT = 0;
  if (b.coinT > 1.5) {
    b.coinT = 0;
    const L = Math.hypot(b.p.x, b.p.z) || 1;
    b.v.x = (-b.p.x / L) * 2.2; b.v.z = (-b.p.z / L) * 2.2;
    return true;
  }
  return false;
}

const prediction = creerBalle();
/**
 * La trajectoire prédite (sans hasard, avec la même physique) jusqu'à ce que test(b, t) soit vrai, ou tMax secondes.
 * Renvoie { t, p: {x, y, z}, v } au moment où test devient vrai, ou null.
 */
export function predire(b, test, tMax = 2.5) {
  const q = copierBalle(b, prediction);
  q.garde = null;
  for (let t = 0; t <= tMax; t += PAS) {
    pasBalle(q, null);
    if (test(q, t + PAS)) return { t: t + PAS, p: { ...q.p }, v: { ...q.v } };
  }
  return null;
}

/** La position du ballon dans t secondes (prédiction complète). */
export function positionDans(b, t) {
  const q = copierBalle(b, prediction);
  q.garde = null;
  for (let s = 0; s < t; s += PAS) pasBalle(q, null);
  return { x: q.p.x, y: q.p.y, z: q.p.z };
}
