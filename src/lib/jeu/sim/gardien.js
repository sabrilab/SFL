// Les gardiens (bola-app#23) : placement, lecture du tir, plongeon calé sur les mains, capter ou repousser, relance.
//
//   · Placement : sur la bissectrice entre la balle et les deux poteaux, à 0,7-1,6 m de sa ligne selon la distance de
//     la balle, face au jeu, en pas chassés (contenir, 2-3 m/s).
//   · Lecture : après un temps de réaction à graine (0,26-0,36 s, plus lent sur une frappe de près ; le plongeon, lui, part sans élan). Trop
//     tard pour aller chercher une balle loin de lui (moins de 0,2 s avant qu'elle ne passe) : il ne plonge pas dans le
//     vide, il est battu sur ses appuis, la trajectoire
//     est PRÉDITE toutes les 30 ms avec le même intégrateur que le ballon (traînée, effet, rebonds), sans hasard,
//     jusqu'à la ligne : on obtient le point de passage et l'instant. À côté ou au-dessus : il regarde passer.
//   · Choix : près du corps et sous 1,9 m, arrêt debout (k_block en bas, k_catch à hauteur) ; sinon plongeon. La table
//     des mains du clip (sim/clips.js) donne, image par image, où sont les mains : on choisit l'image, le côté
//     (k_dive_r ou k_dive_l, joué depuis 0,45 s : l'élan de la capture est sauté), le cap et le rythme (0,8-1,3)
//     pour que les mains arrivent au point de passage à
//     l'instant prédit. L'écart qui reste (0,5 m au plus) est pris par un appel au départ. La racine ne bouge plus
//     pendant le plongeon (le clip porte déjà le déplacement des hanches) : c'est ce qui le faisait glisser deux fois.
//     À la fin du clip, il est debout à côté de sa racine : la racine le rejoint (le rendu enchaîne sans fondu).
//   · Contact : la balle est testée contre les mains (sphère de 0,14 m) et le corps (capsule jusqu'aux mains), sur
//     son segment du pas (rien ne passe à travers à 30 m/s). Captée sous 16 m/s de vitesse relative, au centre des
//     mains, sous 1,6 m ; repoussée sinon (restitution 0,35-0,5, vers l'extérieur du but) ; du bout des doigts au
//     bord : déviée de 5 à 20°. Plus de tirage au sort de l'arrêt : c'est la géométrie qui décide.
//   · (bola-app#26) Dans l'axe : parade couchée (k_block), arrêt face (k_catch_std), saut (k_high) ; balle basse loin
//     de lui : le plongeon bas sur le côté (k_low_l / k_low_r) concourt avec le plongeon haut ; trop tard : battu
//     (k_miss). Relance roulée (k_roll) pour un partenaire à moins de 8 m.
//   · (bola-app#26, lot 2) Placement sur l'angle (surAngle) : sur la bissectrice balle-poteaux ; sortie face à un
//     porteur seul à moins de 9 m (jusqu'à 3,2 m de la ligne).
//   · Après : relance à la main (k_throw, avec son root motion) ou au pied (k_kick) au bout de 0,9 à 3 s ; sortie sur
//     une balle libre de sa surface s'il y arrive le premier.
import { PAS, BALLON, BUT_DL, BUT_H, TERRAIN, butDe, LB } from './constantes.js';
import { lancerGeste, mainsA, piedA, versMonde, clamp, enrouler, duree, finirGeste, impactDe } from './corps.js';
import { CLIPS, FPS_CLIPS } from './clips.js';
import { predire } from './ballon.js';
import { choisirPartenaire, rouler } from './gestes.js';
import { atan2, cos, hypot, sin } from './maths.js';

const R = BALLON.R;
// un plongeon se joue au plus 1,3 fois plus vite que la capture Mixamo : au-delà, le gardien serait surhumain
const TAUX_MAX = 1.3;
// la prise d'élan de la capture est sautée : les mains ne partent de côté qu'à 0,5 s de clip (table des mains), le
// plongeon commence donc à 0,45 s, le gardien déjà sur son appel (avant : 0,2 s, et le corps ne bougeait qu'une fois
// la balle au fond)
// (bola-app#26) la parade couchée sur le côté (goalkeeper_body_block, hanches gardées) : ses mains partent à 0,4 s
const ELANS = { k_dive_r: 0.45, k_dive_l: 0.45, k_low_r: 0.35, k_low_l: 0.35 };
const t1 = { x: 0, y: 0, z: 0 }, t2 = { x: 0, y: 0, z: 0 }, t3 = { x: 0, y: 0, z: 0 };

/** Les mains du gardien dans le monde (x, y, z), d'après le clip qu'il joue. */
export function mainsMonde(k, out) {
  const g = k.g;
  if (g && CLIPS[g.nom]?.mains) mainsA(g.nom, g.t, t1);
  else mainsA('k_idle', 0, t1);
  versMonde(k.cap, t1.x, t1.z, t2);
  out.x = k.p.x + t2.x; out.y = t1.y; out.z = k.p.z + t2.z;
  // l'allonge des bras (IK, ± 0,4 m en hauteur) vers la balle, qui monte jusqu'à l'image visée et y reste
  const dy = g?.donnees?.dy;
  if (dy) out.y += dy * clamp(g.t / Math.max(0.05, g.donnees.tVise), 0, 1);
  // sur sa ligne, les gants s'arrêtent au poteau (le plongeon plus tôt les y menait : ils ne le traversent pas)
  const zb = butDe(k.e);
  if (Math.abs(out.z - zb) < 0.35 && out.y < BUT_H + 0.1) { const lim = BUT_DL - BALLON.poteauR - 0.08; if (out.x > lim) out.x = lim; else if (out.x < -lim) out.x = -lim; }
  return out;
}
/** L'allonge des bras du gardien pendant un arrêt (m), pour le rendu (IK des bras). */
export function allongeBras(k) {
  const g = k.g, dy = g?.donnees?.dy;
  return dy ? dy * clamp(g.t / Math.max(0.05, g.donnees.tVise), 0, 1) : 0;
}

const dedansDe = (e) => -Math.sign(butDe(e)); // vers le terrain

/** L'intention du gardien, et ses décisions (appelé avant la locomotion). */
export function pasGardien(m, k) {
  const b = m.balle, zb = butDe(k.e);
  const it = k.int;
  it.dx = 0; it.dz = 0; it.allure = 0; it.sprint = 0; it.contenir = true; it.regard = b.p; it.protege = false; it.charge = false; it.vaBalle = false; it.action = null;
  k.lecture ??= null;

  // il tient la balle : il attend, puis relance
  if (b.garde === k.i) {
    it.contenir = false;
    finPlongeon(m, k);
    k.attente = (k.attente ?? 1.5) - PAS;
    if (!k.g && k.attente <= 0) relancer(m, k);
    if (k.g?.type === 'relance') pasRelance(m, k);
    return;
  }
  k.attente = m.rng.gardiens.entre(0.9, 2.2);

  // un plongeon ou un arrêt en cours : rien d'autre
  if (k.g && (k.g.type === 'plongeon' || k.g.type === 'arret' || k.g.type === 'battu')) {
    finPlongeon(m, k);
    return;
  }
  if (k.g && k.g.type !== 'relance') return;

  // un tir vers son but : lecture puis action
  const t = b.tir;
  if (t && t.e !== k.e && b.garde == null) {
    if (!k.lecture || k.lecture.t0 !== t.t0) {
      const tireur = m.joueurs[t.j];
      const pres = hypot(tireur.p.x - k.p.x, tireur.p.z - k.p.z) < 6 ? 0.06 : 0;
      k.lecture = { t0: t.t0, reaction: m.rng.gardiens.entre(0.26, 0.36) + pres, prochaine: 0, fait: false, pred: null };
    }
    const L = k.lecture;
    const age = m.t - t.t0;
    if (!L.fait && age >= L.reaction && m.t >= L.prochaine) {
      L.prochaine = m.t + 0.03;
      const s = Math.sign(zb);
      // deux points de la trajectoire prédite : où elle passe la ligne (cadrée ou non), et où elle passe le plan du
      // gardien (c'est là que ses mains doivent être)
      const r = predire(b, (q) => (q.p.z - zb) * s >= 0 || (q.v.z * s <= 0 && Math.abs(q.p.z - zb) > 1), 2.2);
      if (r && (r.p.z - zb) * s >= 0) {
        L.pred = r;
        const cadre = Math.abs(r.p.x) < BUT_DL + 0.15 && r.p.y < BUT_H + 0.15;
        const zk = k.p.z;
        const rk = (b.p.z - zk) * s < 0 ? predire(b, (q) => (q.p.z - zk) * s >= 0, 2.2) : null;
        if (cadre) { decider(m, k, rk ?? r); L.fait = true; }
      } else L.pred = null;
    }
    if (!L.fait && L.pred) { it.dx = clamp(L.pred.p.x - k.p.x, -1, 1); it.allure = 0.6; }
    return;
  }

  // la balle libre dans sa surface, s'il y arrive le premier : il sort
  const dBut = hypot(b.p.x, b.p.z - zb);
  const libreB = b.possesseur == null || (m.joueurs[b.possesseur] && hypot(m.joueurs[b.possesseur].p.x - b.p.x, m.joueurs[b.possesseur].p.z - b.p.z) > 1.6);
  // (bola-app#26, lot 2) sur l'angle : sur la bissectrice de l'angle balle-poteaux, à une profondeur qui grandit
  // quand la balle approche ; face à un porteur seul (aucun coéquipier entre lui et le but) à moins de 9 m, il sort
  // fermer l'angle (jusqu'à 3,2 m de sa ligne, jamais à moins de 1,5 m du porteur)
  let prof = clamp(0.7 + (1 - clamp(hypot(b.p.x, b.p.z - zb) / 15, 0, 1)) * 0.9, 0.7, 1.6);
  const pa = b.possesseur != null ? m.joueurs[b.possesseur] : null;
  if (pa && pa.e !== k.e && dBut < 9 && b.p.y < 0.6) {
    let seul = true;
    for (const o of m.joueurs) {
      if (o.absent || o.e !== k.e || o.gardien || o.mode === 'sol') continue;
      // un coéquipier entre le porteur et le but (plus près du but, dans le couloir)
      if (hypot(o.p.x, o.p.z - zb) < dBut - 0.5 && Math.abs(o.p.x - b.p.x * (hypot(o.p.x, o.p.z - zb) / dBut)) < 1.6) seul = false;
    }
    if (seul) prof = clamp(Math.max(prof, 1.6 + (9 - dBut) * 0.35), 0.7, Math.min(3.2, dBut - 1.5));
  }
  const { x: cxA, z: czA } = surAngle(b.p.x, b.p.z, zb, prof);
  let cx = cxA, cz = czA;
  let vise = false;
  if (libreB && dBut < TERRAIN.surface - 0.3 && hypot(b.v.x, b.v.z) < 9 && b.p.y < 1.5) {
    const tk = hypot(k.p.x - b.p.x, k.p.z - b.p.z) / 5.4;
    const premier = m.joueurs.every((o) => o === k || o.gardien || o.absent || hypot(o.p.x - b.p.x, o.p.z - b.p.z) / 6.2 > tk - 0.1);
    if (premier) { cx = b.p.x; cz = b.p.z; vise = true; }
  }
  // la sortie demandée par l'humain (Y / △ maintenu) : au porteur ou à la balle, dans les 10 m de son but
  if (m.sortie?.[k.e] && dBut < 10 && b.p.y < 1.5) { cx = b.p.x + b.v.x * 0.2; cz = b.p.z + b.v.z * 0.2; vise = true; }
  const dx = cx - k.p.x, dz = cz - k.p.z, d = hypot(dx, dz);
  if (d > 0.15) {
    it.dx = dx / d; it.dz = dz / d;
    it.allure = clamp(d / 1.5, 0.2, 1); it.sprint = vise ? 0.3 : 0;
    it.contenir = !vise;
  }
  // il ramasse une balle lente à ses pieds (dans sa surface)
  if (b.garde == null && dBut < TERRAIN.surface && b.p.y < 1.7) {
    mainsMonde(k, t1);
    const pres = hypot(b.p.x - k.p.x, b.p.z - k.p.z) < 0.85;
    const vr = hypot(b.v.x - k.v.x, b.v.z - k.v.z);
    const passeDuPartenaire = false;
    if (pres && vr < 7 && !passeDuPartenaire && !(b.dernier === k.i && m.t - b.dernierT < 0.6)) capter(m, k, 'k_scoop');
  }
}

/**
 * Le point sur la bissectrice de l'angle balle-poteaux, à la profondeur prof de la ligne de but zb (vers le terrain).
 * La balle derrière la ligne ou presque sur elle : le poteau le plus proche, devant la ligne.
 */
export function surAngle(bx, bz, zb, prof) {
  const dedans = -Math.sign(zb), zk = zb + dedans * prof;
  const u1x = -BUT_DL - bx, u1z = zb - bz, u2x = BUT_DL - bx, u2z = zb - bz;
  const l1 = hypot(u1x, u1z) || 1, l2 = hypot(u2x, u2z) || 1;
  const vx = u1x / l1 + u2x / l2, vz = u1z / l1 + u2z / l2;
  // (la bissectrice doit aller vers le but : sinon, la balle est sur la ligne ou derrière)
  if ((bz - zk) * dedans < 0.3 || vz * -dedans < 0.15) return { x: clamp(bx, -BUT_DL + 0.25, BUT_DL - 0.25), z: zk };
  const t = (zk - bz) / vz;
  return { x: clamp(bx + vx * t, -BUT_DL + 0.2, BUT_DL - 0.2), z: zk };
}

/** La fin d'un plongeon : debout à côté de sa racine, la racine le rejoint (les pieds de la dernière image). */
function finPlongeon(m, k) {
  if (k.g?.type !== 'plongeon' || k.g.t < duree(k.g.nom) - 1e-6) return;
  const c = CLIPS[k.g.nom], i = (c.n - 1) * 6;
  const lx = (c.pieds[i] + c.pieds[i + 3]) / 200, lz = (c.pieds[i + 2] + c.pieds[i + 5]) / 200;
  versMonde(k.cap, lx, lz, t2);
  k.p.x += t2.x; k.p.z += t2.z;
  finirGeste(k);
  k.sauts = (k.sauts ?? 0) + 1;
}

/** Le choix de l'arrêt, sur la trajectoire prédite r = { t, p, v }. */
function decider(m, k, r) {
  const T = r.p, reste = r.t;
  const lat = T.x - k.p.x;
  if (Math.abs(lat) < 0.6 && T.y < 2.1) {
    // (bola-app#26) dans l'axe : la parade couchée en bas (k_block), l'arrêt face à hauteur de poitrine
    // (k_catch_std), le saut sur une balle haute (k_high, sinon k_catch)
    const nom = T.y <= 0.9 ? 'k_block' : T.y <= 1.55 && CLIPS.k_catch_std ? 'k_catch_std' : CLIPS.k_high ? 'k_high' : 'k_catch';
    // l'image où les mains sont les plus proches de la hauteur visée, dans la première moitié du clip
    const c = CLIPS[nom];
    let f = 10, best = Infinity;
    for (let i = 6; i < c.n / 2; i++) { const e = Math.abs(c.mains[i * 3 + 1] / 100 - T.y); if (e < best) { best = e; f = i; } }
    const taux = clamp(f / FPS_CLIPS / Math.max(0.1, reste), 0.8, 3);
    k.cap = dedansDe(k.e) > 0 ? 0 : Math.PI;
    const g = lancerGeste(k, nom, { taux, type: 'arret', fin: Math.min(duree(nom), (f / FPS_CLIPS) + 0.9 * taux) });
    g.donnees = { appel: { x: lat / Math.max(0.15, reste), z: 0, t: Math.min(reste, 0.3) }, dy: clamp(T.y - c.mains[f * 3 + 1] / 100, -0.4, 0.4), tVise: f / FPS_CLIPS };
    m.ev('arret', { j: k.i, nom });
    return;
  }
  // trop tard : la balle passe dans moins de 0,2 s loin de lui ; il ne plonge pas après coup, il est battu (k_miss :
  // l'élan qui part trop tard, sans les mains)
  if (reste < 0.2) {
    m.ev('battu', { j: k.i });
    if (CLIPS.k_miss && Math.abs(lat) < 2.5) { k.cap = dedansDe(k.e) > 0 ? 0 : Math.PI; lancerGeste(k, 'k_miss', { taux: 1.3, depuis: 0.25, type: 'battu', fin: duree('k_miss') * 0.8 }); }
    return;
  }
  // le plongeon : le côté, l'image, le cap, le rythme
  let meilleur = null;
  const face = dedansDe(k.e) > 0 ? 0 : Math.PI;
  // les plongeons : haut (k_dive) et, pour une balle basse, la parade couchée sur le côté (k_low, hanches gardées) ;
  // chacun saute sa prise d'élan (ELANS)
  const noms = T.y < 0.75 && CLIPS.k_low_l ? ['k_dive_r', 'k_dive_l', 'k_low_r', 'k_low_l'] : ['k_dive_r', 'k_dive_l'];
  for (const nom of noms) {
    const c = CLIPS[nom];
    const ELAN = ELANS[nom] ?? ELANS.k_dive_r;
    for (let i = nom.startsWith('k_low') ? Math.ceil(ELAN * FPS_CLIPS) + 2 : 9; i < Math.min(c.n, 46); i++) {
      const hx = c.mains[i * 3] / 100, hy = c.mains[i * 3 + 1] / 100, hz = c.mains[i * 3 + 2] / 100;
      const rho = hypot(hx, hz);
      const tx = T.x - k.p.x, tz = T.z - k.p.z, rt = hypot(tx, tz);
      const cap = enrouler(atan2(tx, tz) - atan2(hx, hz));
      const ecartFace = Math.abs(enrouler(cap - face));
      if (ecartFace > 1.3) continue;
      const taux = (i / FPS_CLIPS - ELAN) / Math.max(0.05, reste - 0.02);
      const pTaux = taux > TAUX_MAX ? (taux - TAUX_MAX) * 2 : taux < 0.8 ? (0.8 - taux) : 0;
      const dy = clamp(T.y - hy, -0.4, 0.5);
      const err = Math.max(0, Math.abs(rt - rho) - 0.5) + Math.abs(hy + dy - T.y) * 0.8 + pTaux + ecartFace * 0.05;
      if (!meilleur || err < meilleur.err) meilleur = { nom, i, cap, taux: clamp(taux, 0.8, TAUX_MAX), err, appel: rt - rho, tx, tz, rt, dy };
    }
  }
  if (!meilleur) return;
  k.cap = meilleur.cap;
  const g = lancerGeste(k, meilleur.nom, { taux: meilleur.taux, type: 'plongeon', depuis: (ELANS[meilleur.nom] ?? ELANS.k_dive_r) / duree(meilleur.nom) });
  const appel = clamp(meilleur.appel, -0.5, 0.5), ta = 0.15;
  g.donnees = { appel: { x: (meilleur.tx / meilleur.rt) * appel / ta, z: (meilleur.tz / meilleur.rt) * appel / ta, t: ta }, err: meilleur.err, dy: meilleur.dy, tVise: meilleur.i / FPS_CLIPS };
  m.ev('plongeon', { j: k.i, nom: meilleur.nom, err: meilleur.err });
  m.stats.plongeons++;
}

/** Le gardien pendant un arrêt : l'appel de départ (seul déplacement de la racine), puis immobile. */
export function pasCorpsGardien(k, dt) {
  const g = k.g;
  if (!g || (g.type !== 'plongeon' && g.type !== 'arret' && g.type !== 'battu')) return false;
  g.age += dt; g.t += dt * g.taux;
  const a = g.donnees?.appel;
  if (a && g.age <= a.t) { k.v.x = a.x; k.v.z = a.z; }
  else { k.v.x = 0; k.v.z = 0; }
  k.p.x += k.v.x * dt; k.p.z += k.v.z * dt;
  if ((g.type === 'arret' || g.type === 'battu') && g.t >= g.fin) finirGeste(k);
  return true;
}

/** Le contact du ballon avec les mains et le corps du gardien, sur le segment du pas. */
export function contactGardien(m, k, p0) {
  const b = m.balle;
  if (b.garde != null || k.mode === 'sol') return false;
  if (b.dernier === k.i && m.t - b.dernierT < 0.4) return false;
  // les gardiens ne jouent qu'avec les mains dans leur surface
  if (hypot(b.p.x, b.p.z - butDe(k.e)) > TERRAIN.surface + 0.5) return false;
  const h = mainsMonde(k, t1);
  // (battu, k_miss : ses mains partent trop tard, elles ne comptent pas ; seul le corps peut encore la contrer)
  if (k.g?.type === 'battu') h.y = -9;
  // la plus courte distance du segment p0 → p au centre des mains
  const sx = b.p.x - p0.x, sy = b.p.y - p0.y, sz = b.p.z - p0.z;
  const L2 = sx * sx + sy * sy + sz * sz;
  const u = L2 > 1e-9 ? clamp(((h.x - p0.x) * sx + (h.y - p0.y) * sy + (h.z - p0.z) * sz) / L2, 0, 1) : 1;
  let cx = p0.x + sx * u, cy = p0.y + sy * u, cz = p0.z + sz * u;
  const d = hypot(cx - h.x, cy - h.y, cz - h.z);
  // le corps : une capsule des pieds aux mains (0,18 m de rayon ; en plongeon, c'est le corps étendu), et debout le
  // buste, une capsule verticale de 0,3 à 1,65 m
  let dc = Infinity;
  {
    const g = k.g;
    let ax = k.p.x, ay = 0.25, az = k.p.z;
    if (g && CLIPS[g.nom]?.pieds) {
      piedA(g.nom, g.t, 0, t2); const lx = t2.x, ly = t2.y, lz = t2.z;
      piedA(g.nom, g.t, 1, t2);
      versMonde(k.cap, (lx + t2.x) / 2, (lz + t2.z) / 2, t3);
      ax = k.p.x + t3.x; ay = Math.max(0.15, (ly + t2.y) / 2); az = k.p.z + t3.z;
    }
    const ex = h.x - ax, ey = h.y - ay, ez = h.z - az, E2 = ex * ex + ey * ey + ez * ez;
    const w = E2 > 1e-9 ? clamp(((cx - ax) * ex + (cy - ay) * ey + (cz - az) * ez) / E2, 0, 1) : 0;
    dc = hypot(cx - (ax + ex * w), cy - (ay + ey * w), cz - (az + ez * w));
    if (!g || g.type !== 'plongeon') {
      const yb = clamp(cy, 0.3, 1.65);
      dc = Math.min(dc, hypot(cx - k.p.x, cy - yb, cz - k.p.z) - 0.04);
    }
  }
  const RM = 0.14; // le rayon des gants (les deux mains ensemble)
  if (d > RM + R && dc > 0.15 + R) return false;
  let dejaDedans = false; // les gants sont venus sur la balle (elle était déjà dans leur sphère au début du pas)
  // le point d'entrée dans la sphère des mains (et non le point le plus proche, qui peut être déjà derrière les gants)
  if (d <= RM + R && L2 > 1e-9) {
    const fx = p0.x - h.x, fy = p0.y - h.y, fz = p0.z - h.z, rr = RM + R;
    const bq = 2 * (fx * sx + fy * sy + fz * sz), c = fx * fx + fy * fy + fz * fz - rr * rr;
    const disc = bq * bq - 4 * L2 * c;
    const s0 = c <= 0 ? 0 : disc > 0 ? clamp((-bq - Math.sqrt(disc)) / (2 * L2), 0, 1) : u;
    cx = p0.x + sx * s0; cy = p0.y + sy * s0; cz = p0.z + sz * s0;
    dejaDedans = c <= 0;
  }
  const vr = hypot(b.v.x - k.v.x, b.v.y, b.v.z - k.v.z);
  // une balle lente qui vient dans ses jambes : il la ramasse
  if (vr < 4) { if (b.p.y < 1.6) { capter(m, k, b.p.y < 0.5 ? 'k_scoop' : null); return true; } return false; }
  // la balle est ramenée au point de contact du segment (elle ne traverse pas les gants)
  b.p.x = cx; b.p.y = Math.max(R, cy); b.p.z = cz;
  const mains = d <= RM + R;
  // la distance de la trajectoire (la droite de la balle, pas seulement le bout du pas) au centre des gants : au
  // premier contact, la balle n'est qu'au bord de leur sphère ; c'est ce passage qui dit « dans les mains » ou « du bout
  // des doigts »
  let dl = d;
  {
    const vl = hypot(b.v.x, b.v.y, b.v.z);
    if (vl > 1e-6) {
      const ux = b.v.x / vl, uy = b.v.y / vl, uz = b.v.z / vl, qx = h.x - p0.x, qy = h.y - p0.y, qz = h.z - p0.z;
      dl = hypot(qy * uz - qz * uy, qz * ux - qx * uz, qx * uy - qy * ux);
    }
  }
  const centre = dl < 0.12 + R * 0.5;
  if (mains && centre && vr < 16 && cy < 1.6) { capter(m, k, null); return true; }
  // repoussée : la normale des gants (ou du corps), vers l'extérieur du but
  let nx = cx - h.x, ny = cy - h.y, nz = cz - h.z;
  const nl = hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  const dedans = dedansDe(k.e);
  const rng = m.rng.gardiens;
  if (mains && dl > RM + R * 0.4) {
    // du bout des doigts : la balle est déviée de 5 à 20°, presque sans perte
    const dev = (5 + 15 * rng.u()) * (Math.PI / 180) * Math.sign(cx - k.p.x || 1) * -dedans;
    const c = cos(dev), s = sin(dev);
    const vx = b.v.x * c + b.v.z * s, vz = -b.v.x * s + b.v.z * c;
    b.v.x = vx * 0.85; b.v.z = vz * 0.85; b.v.y = b.v.y * 0.85 + 0.6;
    m.ev('parade', { j: k.i, doigts: true });
  } else {
    const e = 0.35 + 0.15 * rng.u();
    if (dejaDedans) { const vl = hypot(b.v.x, b.v.y, b.v.z) || 1; nx = -b.v.x / vl; ny = -b.v.y / vl; nz = -b.v.z / vl; }
    let vn = b.v.x * nx + b.v.y * ny + b.v.z * nz;
    // un contact de côté (le corps) : la balle est arrêtée de face
    if (vn > -0.3 * hypot(b.v.x, b.v.y, b.v.z)) { const vl = hypot(b.v.x, b.v.y, b.v.z) || 1; nx = -b.v.x / vl; ny = -b.v.y / vl; nz = -b.v.z / vl; vn = -vl; }
    if (vn < 0) { b.v.x -= (1 + e) * vn * nx; b.v.y -= (1 + e) * vn * ny; b.v.z -= (1 + e) * vn * nz; }
    // vers l'extérieur, loin de la cage
    b.v.x += Math.sign(cx || 1) * 2.2; b.v.z += dedans * 1.5; b.v.y = Math.max(b.v.y, 1 + rng.u() * 1.5);
    m.ev('parade', { j: k.i, doigts: false });
  }
  b.w.x *= 0.5; b.w.y *= 0.5; b.w.z *= 0.5;
  b.dernier = k.i; b.dernierT = m.t; b.possesseur = null; b.tir = null; b.recepteur = null;
  m.stats.arrets++;
  return true;
}

function capter(m, k, nom) {
  const b = m.balle;
  const tir = !!b.tir;
  b.garde = k.i; b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
  b.possesseur = null; b.tir = null; b.recepteur = null; b.dernier = k.i; b.dernierT = m.t;
  if (nom) { lancerGeste(k, nom, { taux: 1.6, type: 'arret', fin: duree(nom) * 0.42 }); }
  k.attente = m.rng.gardiens.entre(0.9, 2.2);
  if (tir) m.stats.arrets++;
  m.ev('capte', { j: k.i, tir });
}

/** Tenue de balle : la balle suit les mains du gardien. */
export function tenirBalle(m) {
  const b = m.balle;
  if (b.garde == null) return;
  const k = m.joueurs[b.garde];
  mainsMonde(k, t1);
  b.p.x = t1.x; b.p.y = Math.max(R, t1.y); b.p.z = t1.z;
  b.v.x = k.v.x; b.v.y = 0; b.v.z = k.v.z;
}

function relancer(m, k) {
  const dedans = dedansDe(k.e);
  const cible = choisirPartenaire(m, k, 0, dedans);
  if (!cible) { k.attente = 0.5; return; }
  const d = hypot(cible.p.x - k.p.x, cible.p.z - k.p.z);
  const pied = d > 14;
  k.cap = atan2(cible.p.x - k.p.x, cible.p.z - k.p.z);
  // k_throw : la balle part à 0,98 s de clip ; k_kick : à 1,25 s (mesuré à l'œil sur le clip) ; (bola-app#26) la
  // relance roulée à la main pour un partenaire à moins de 8 m (k_roll, goalie_throw : la main lâche à l'impact mesuré)
  const roule = !pied && d < 8 && CLIPS.k_roll;
  const nom = pied ? 'k_kick' : roule ? 'k_roll' : 'k_throw';
  const depart = roule ? impactDe('k_roll') : pied ? 1.25 : 0.98;
  const g = lancerGeste(k, nom, { taux: roule ? 1.5 : 1.4, rm: !roule, echelle: 0.45, type: 'relance', fin: roule ? depart + 0.6 : pied ? 1.9 : 1.6, donnees: { cible: cible.i, depart, roule } });
  void g;
}

function pasRelance(m, k) {
  const g = k.g, b = m.balle;
  if (g.donnees.parti || g.t < g.donnees.depart) return;
  g.donnees.parti = true;
  const c = m.joueurs[g.donnees.cible];
  const d = hypot(c.p.x - b.p.x, c.p.z - b.p.z);
  const tx = c.p.x + c.v.x * 0.6 - b.p.x, tz = c.p.z + c.v.z * 0.6 - b.p.z, L = hypot(tx, tz) || 1;
  const pied = g.nom === 'k_kick';
  const roule = !!g.donnees.roule;
  const v = pied ? clamp(8 + d * 0.45, 10, 18) : roule ? clamp(4 + d * 0.55, 5, 9) : clamp(Math.sqrt(4.5 * 4.5 + 2 * 1.3 * d), 7, 15);
  b.garde = null;
  if (roule) b.p.y = R;
  b.v.x = (tx / L) * v; b.v.z = (tz / L) * v; b.v.y = pied ? 5 + d * 0.12 : roule ? 0 : 2.2;
  b.w.x = b.w.y = b.w.z = 0;
  if (!pied) rouler(b);
  b.dernier = k.i; b.dernierT = m.t; b.recepteur = c.i; b.possesseur = null;
  m.stats.passes++;
  m.ev('relance', { j: k.i, pied });
}

export { LB };
