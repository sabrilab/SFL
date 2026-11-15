// L'animation des joueurs calée sur la simulation (bola-app#23) : le corps suit ce que la simulation a décidé, au lieu
// de l'inverse. Rien ici ne change une position de jeu.
//
//   · Locomotion : un mélange de clips synchronisé sur la vitesse réelle. Tous les cycles (idle, jog, run, sprint au-delà
//     de 6 m/s, drib, back,
//     strafe_l, strafe_r ; pour le gardien k_idle, k_side_l, k_side_r) sont posés au temps que donne la phase de foulée
//     de la simulation (φ, corps.js), calée pour chaque clip sur l'appui de son pied gauche : le pied d'appui ne saute
//     jamais d'un clip à l'autre, et la cadence suit la vitesse sans borne. Poids : idle ↔ jog ↔ run selon la vitesse
//     (drib balle au pied, sous 4,4 m/s) et avant / arrière / côtés selon l'angle entre le cap et la course.
//   · Gestes : le clip est posé au temps que la simulation lui donne (impact affiché = impact simulé) ; fondu 0,08 s à
//     l'entrée, 0,25 s à la sortie, sans fondu quand la racine a sauté (fin de plongeon).
//   · Procédural, filtré (ressorts amortis, aucun bruit) : buste penché à l'accélération et plus bas en sprint, en
//     arrière au freinage (Spine, Spine1), roulis dans les virages, au déséquilibre et vers l'adversaire dans un duel
//     d'épaule (tout le corps, autour des pieds), tête et cou vers la balle (60° au plus). « Réduire les animations »
//     divise ces amplitudes par deux. Le gardien est remonté quand ses orteils passeraient sous le gazon.
//   · Pieds verrouillés : pendant un appui (table des appuis de sim/clips.js), le pied est tenu à sa place au sol par
//     une IK à deux os (cuisse, tibia ; le genou reste dans son plan), correction plafonnée à 8 cm et relâchée en 60 ms ;
//     presque à l'arrêt, les deux pieds tiennent leur place (25 cm) et ne sont reposés que par un vrai pas. Pendant une
//     touche de balle, le pied le plus proche va au contact (IK, 30 cm au plus).
//     Les bras du gardien s'allongent vers la balle de la même façon (allongeBras, ± 0,4 m).
// Les bras de course viennent des clips, sans retouche (le retour « un bras devant, un derrière » visait une course
// raide : rien de procédural n'y touche).
import * as THREE from 'three';
import { CLIPS } from '../sim/clips.js';

const LOCO = ['idle', 'jog', 'run', 'sprint', 'drib', 'back', 'strafe_l', 'strafe_r'];
const LOCO_G = ['k_idle', 'k_side_l', 'k_side_r'];
const clamp = THREE.MathUtils.clamp;
const DEG = Math.PI / 180;

/** Le décalage de phase d'un cycle : l'instant (part du clip) où le pied gauche se pose. */
function calage(nom) {
  const c = CLIPS[nom];
  const a = c?.appuis?.[0]?.[0]?.[0];
  return a ?? 0;
}
/** Le pied (0 gauche, 1 droit) est-il posé à cette part u du cycle ? */
function enAppui(nom, u, pied) {
  const iv = CLIPS[nom]?.appuis?.[pied];
  if (!iv) return false;
  for (const [a, b] of iv) { if (a <= b ? u >= a && u <= b : u >= a || u <= b) return true; }
  return false;
}

// un ressort amorti critique (aucun dépassement, aucun tremblement), intégré par sous-pas de 1/120 s au plus : stable
// quel que soit le temps d'une image (une image lente ne le fait jamais diverger)
function ressort(etat, cle, cible, dt, w = 14) {
  let x = etat[cle] ?? cible, v = etat[cle + 'V'] ?? 0;
  const k = w * w, c = 2 * w;
  const n = Math.min(30, Math.ceil(dt * 120));
  const h = n ? Math.min(dt, 0.25) / n : 0;
  for (let i = 0; i < n; i++) { v += (k * (cible - x) - c * v) * h; x += v * h; }
  etat[cle] = x; etat[cle + 'V'] = v;
  return x;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), vt = new THREE.Vector3(), ax = new THREE.Vector3(), ax2 = new THREE.Vector3();

/** Tourne un os d'un angle autour d'un axe du monde (passant par l'os). */
function tournerMonde(os, axe, angle) {
  if (!angle) return;
  os.getWorldQuaternion(qa);
  ax.copy(axe).applyQuaternion(qb.copy(qa).invert()).normalize();
  os.quaternion.multiply(qc.setFromAxisAngle(ax, angle));
}

const I = { ac: new THREE.Vector3(), ab: new THREE.Vector3(), ba: new THREE.Vector3(), bc: new THREE.Vector3(), at: new THREE.Vector3(), axe0: new THREE.Vector3(), axe2: new THREE.Vector3(), cible: new THREE.Vector3() };
/** IK à deux os (Holden) : place l'extrémité `bout` de la chaîne haut → milieu → bout sur la cible (monde). */
function ik2(haut, milieu, bout, cible0) {
  const cible = I.cible.copy(cible0);
  haut.getWorldPosition(va); milieu.getWorldPosition(vb); bout.getWorldPosition(vc);
  const lab = va.distanceTo(vb), lcb = vb.distanceTo(vc);
  const lat = clamp(vt.copy(cible).sub(va).length(), 0.01, lab + lcb - 0.005);
  const ac = I.ac.copy(vc).sub(va), ab = I.ab.copy(vb).sub(va), ba = I.ba.copy(va).sub(vb), bc = I.bc.copy(vc).sub(vb);
  const ang = (u, v) => Math.acos(clamp(u.dot(v) / (u.length() * v.length() || 1), -1, 1));
  const acab0 = ang(ac, ab), babc0 = ang(ba, bc);
  const acab1 = Math.acos(clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
  const babc1 = Math.acos(clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
  ax2.crossVectors(ac, ab);
  if (ax2.lengthSq() < 1e-10) return;
  ax2.normalize();
  const axe0 = I.axe0.copy(ax2);
  tournerMonde(haut, axe0, acab1 - acab0);
  haut.updateMatrixWorld(true);
  tournerMonde(milieu, axe0, babc1 - babc0);
  milieu.updateMatrixWorld(true);
  bout.getWorldPosition(vc); haut.getWorldPosition(va);
  const ac2 = I.ac.copy(vc).sub(va), at2 = I.at.copy(cible).sub(va);
  const axe2 = I.axe2.crossVectors(ac2, at2);
  if (axe2.lengthSq() > 1e-10) { tournerMonde(haut, axe2.normalize(), ang(ac2, at2)); haut.updateMatrixWorld(true); }
}

/**
 * L'animateur d'un joueur. perso : creerPersonnage (personnage.js) ; gardien : bool ; reduit : mouvement réduit.
 * maj(e, dt) avec e = { vx, vz (m/s, repère du jeu), cap, phase, balle, geste: { nom, t } | null, saut, aLong, aLat,
 * d, regard: { x, z } | null (jeu), pos: { x, z } (jeu), allonge (m), appui: { x, z, f, age } | null (épaule),
 * touche: { age, b: { x, y, z } } | null (balle touchée) } ; versMonde(jeu → monde three) pour la tête et la balle.
 */
export function creerAnimateur(perso, { gardien = false, reduit = false, versMonde3 } = {}) {
  const { actions, mixer, os, corps, racine } = perso;
  const noms = (gardien ? LOCO_G : LOCO).filter((n) => actions[n]);
  for (const n of Object.keys(actions)) { const a = actions[n]; a.stop(); a.enabled = true; a.setEffectiveTimeScale(0); a.setEffectiveWeight(0); }
  for (const n of noms) actions[n].play();
  const etat = {};
  let geste = null, gesteAction = null, poidsG = 0, sortie = 0, precNom = null, precT = 0;
  const amp = reduit ? 0.5 : 1;
  const pieds = [
    { haut: os.leftupleg, milieu: os.leftleg, bout: os.leftfoot, lock: null, mix: 0, cible: new THREE.Vector3(), verrou: new THREE.Vector3() },
    { haut: os.rightupleg, milieu: os.rightleg, bout: os.rightfoot, lock: null, mix: 0, cible: new THREE.Vector3(), verrou: new THREE.Vector3() },
  ];
  const bras = [
    { haut: os.leftarm, milieu: os.leftforearm, bout: os.lefthand },
    { haut: os.rightarm, milieu: os.rightforearm, bout: os.righthand },
  ];
  const lateral = new THREE.Vector3(), haut = new THREE.Vector3(0, 1, 0), avant = new THREE.Vector3(), cible = new THREE.Vector3(), bal = new THREE.Vector3();

  function poserLoco(e, total) {
    const s = Math.hypot(e.vx, e.vz);
    // vitesse dans le repère du joueur (x = sa gauche, z = devant)
    const c = Math.cos(e.cap), sn = Math.sin(e.cap);
    const lx = e.vx * c - e.vz * sn, lz = e.vx * sn + e.vz * c;
    const w = {};
    for (const n of noms) w[n] = 0;
    if (gardien) {
      const cote = s > 0.3 ? clamp(Math.abs(lx) / s, 0, 1) : 0;
      const k = clamp(s / 1.2, 0, 1) * cote;
      w.k_idle = 1 - k;
      if (lx > 0) w.k_side_l = k; else w.k_side_r = k;
    } else {
      const fw = s > 0.05 ? Math.max(0, lz / s) : 1, bk = s > 0.05 ? Math.max(0, -lz / s) : 0;
      const lf = s > 0.05 ? Math.max(0, lx / s) : 0, rt = s > 0.05 ? Math.max(0, -lx / s) : 0;
      const q = fw * fw + bk * bk + lf * lf + rt * rt || 1;
      const marche = clamp(s / 1.4, 0, 1); // sous 1,4 m/s, le cycle se mêle au repos (pas de clip de marche)
      // l'avant : idle ↔ jog ↔ run (ou la conduite)
      let jog = 0, run = 0, drib = 0, sprint = 0;
      if (e.balle && s < 4.4) drib = 1;
      else if (s < 2.85) jog = 1;
      else if (s < 5.39) { run = (s - 2.85) / (5.39 - 2.85); jog = 1 - run; }
      else run = 1;
      if (e.balle && s >= 3.8 && s < 4.4) { const u = (s - 3.8) / 0.6; drib = 1 - u; run = u; }
      // au-delà de 6 m/s, la course de sprint (buste plus bas, bras plus amples) prend le relais de la course
      if (run > 0 && s > 6 && actions.sprint) { sprint = run * clamp((s - 6) / 0.8, 0, 1); run -= sprint; }
      w.jog = (fw * fw / q) * jog * marche; w.run = (fw * fw / q) * run * marche; w.drib = (fw * fw / q) * drib * marche;
      if ('sprint' in w) w.sprint = (fw * fw / q) * sprint * marche;
      w.back = (bk * bk / q) * marche; w.strafe_l = (lf * lf / q) * marche; w.strafe_r = (rt * rt / q) * marche;
      w.idle = 1 - marche;
    }
    let dom = null, dw = -1;
    for (const n of noms) {
      const a = actions[n], cl = CLIPS[n];
      const dur = a.getClip().duration;
      const u = n === 'drib' ? (((e.phase / 2) + calage(n)) % 1 + 1) % 1 : n === 'idle' || n === 'k_idle' ? ((total % dur) / dur) : ((e.phase % 1) + calage(n)) % 1;
      a.time = u * dur;
      a.setEffectiveWeight(w[n] * (1 - poidsG));
      if (w[n] > dw && cl?.appuis && n !== 'idle' && n !== 'k_idle') { dw = w[n]; dom = { nom: n, u }; }
    }
    return { dom, s };
  }

  let total = 0;
  function maj(e, dt) {
    total += dt;
    // le geste
    const g = e.geste;
    if (g && actions[g.nom]) {
      const neuf = g.nom !== precNom || g.t + 1e-6 < precT;
      if (neuf) {
        if (gesteAction && gesteAction !== actions[g.nom]) gesteAction.setEffectiveWeight(0);
        gesteAction = actions[g.nom]; gesteAction.play(); gesteAction.setEffectiveTimeScale(0);
        poidsG = e.saut ? 1 : Math.min(poidsG, 0.4);
      }
      const dur = gesteAction.getClip().duration;
      const boucle = gesteAction.getClip().userData?.loop;
      gesteAction.time = boucle ? g.t % dur : Math.min(g.t, dur - 1e-4);
      poidsG = Math.min(1, poidsG + dt / 0.08);
      sortie = 0.25;
      geste = g.nom; precNom = g.nom; precT = g.t;
    } else if (gesteAction) {
      // la sortie du geste, fondue vers la course (sauf saut de la racine)
      if (e.saut) poidsG = 0; else poidsG = Math.max(0, poidsG - dt / sortie);
      if (poidsG <= 0) { gesteAction.setEffectiveWeight(0); gesteAction = null; geste = null; }
      precNom = null;
    }
    if (gesteAction) gesteAction.setEffectiveWeight(poidsG);
    const { dom, s } = poserLoco(e, total);
    mixer.update(0);

    // le buste et le roulis (corps entier, autour des pieds), filtrés : penché à l'accélération, en arrière au
    // freinage (10° au plus), plus bas en sprint (9° de plus au-delà de 6 m/s)
    const penSprint = gardien ? 0 : clamp((s - 6) / 1.2, 0, 1) * 9 * DEG;
    const tangage = ressort(etat, 'tg', (clamp(0.03 * (e.aLong ?? 0), -10 * DEG, 14 * DEG) + penSprint) * amp * (1 - poidsG), dt, 10);
    // l'épaule contre épaule : le corps s'appuie vers l'adversaire (13° au plus), selon la poussée, et se relâche en
    // 0,35 s ; le perdant, déséquilibré, roule aussi par l'accélération latérale
    let appui = 0;
    const A = e.appui;
    if (A && A.age < 0.35) {
      const gx = Math.cos(e.cap), gz = -Math.sin(e.cap); // la gauche du joueur (repère du jeu)
      appui = -(A.x * gx + A.z * gz) * 13 * DEG * clamp(A.f, 0, 1) * (1 - A.age / 0.35);
    }
    const roulis = ressort(etat, 'rl', (clamp(-0.6 * Math.atan((e.aLat ?? 0) / 9.81), -16 * DEG, 16 * DEG) + appui) * amp * (1 - poidsG), dt, 9);
    corps.rotation.z = roulis;
    corps.rotation.x = 0;
    // le gardien : ses captures enfoncent les orteils dans le gazon (jusqu'à 11 cm) ; le corps remonte d'autant
    if (gardien && os.lefttoebase && os.righttoebase) {
      corps.position.y = 0; racine.updateMatrixWorld(true);
      os.lefttoebase.getWorldPosition(va); os.righttoebase.getWorldPosition(vb);
      const bas = Math.min(va.y, vb.y) - racine.position.y;
      corps.position.y = ressort(etat, 'pied', clamp(0.012 - bas, 0, 0.12), dt, 16);
    }
    racine.updateMatrixWorld(true);
    // l'axe latéral du joueur, dans le monde three
    avant.set(Math.sin(e.cap), 0, Math.cos(e.cap));
    if (versMonde3) versMonde3(avant, avant);
    lateral.crossVectors(haut, avant).normalize();
    if (os.spine) tournerMonde(os.spine, lateral, tangage * 0.5);
    if (os.spine1) tournerMonde(os.spine1, lateral, tangage * 0.5);
    // la tête vers la balle
    let lacet = 0;
    if (e.regard && e.pos) {
      const a = Math.atan2(e.regard.x - e.pos.x, e.regard.z - e.pos.z) - e.cap;
      let d = a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      lacet = clamp(d, -60 * DEG, 60 * DEG);
    }
    lacet = ressort(etat, 'lc', lacet * amp * (1 - poidsG * 0.7), dt, 7);
    if (os.neck) tournerMonde(os.neck, haut, lacet * 0.5);
    if (os.head) tournerMonde(os.head, haut, lacet * 0.5);
    racine.updateMatrixWorld(true);

    // les pieds verrouillés pendant l'appui ; presque à l'arrêt (sous 0,5 m/s), les deux pieds tiennent leur place
    // (jusqu'à 25 cm de correction) et un pied n'est reposé que quand il s'en écarte de plus de 25 cm : plus de pieds
    // qui patinent sur place
    const lent = !gesteAction && s < 0.5 && !gardien;
    for (let p = 0; p < 2; p++) {
      const P = pieds[p];
      if (!P.haut || !P.milieu || !P.bout) continue;
      const appui = lent || (!gesteAction && dom && s > 0.3 && enAppui(dom.nom, dom.u, p));
      P.bout.getWorldPosition(cible);
      if (appui && P.lock && lent && Math.hypot(P.lock.x - cible.x, P.lock.z - cible.z) > 0.25) P.lock = null;
      if (appui && !P.lock) P.lock = P.verrou.copy(cible);
      if (!appui && P.lock) { P.lock = null; }
      P.mix = appui ? 1 : Math.max(0, P.mix - dt / 0.06);
      if (P.lock) P.cible.set(P.lock.x, cible.y, P.lock.z);
      if (P.mix > 0) {
        const off = vt.copy(P.cible).sub(cible);
        const L = off.length(), plafond = lent ? 0.25 : 0.08;
        if (L > plafond) off.multiplyScalar(plafond / L);
        if (L > 0.002) ik2(P.haut, P.milieu, P.bout, cible.add(off.multiplyScalar(P.mix)));
      }
    }
    // le pied qui touche la balle : pendant les 0,12 s d'une touche (conduite, contrôle, amorti), le pied le plus proche
    // va au contact de la balle (30 cm de correction au plus), puis la suit ; le pied qui frappe, lui, vient du clip
    const T = e.touche;
    if (T && T.age >= 0 && T.age < 0.12 && versMonde3 && (!gesteAction || geste === 'receive')) {
      const bw = versMonde3(T.b, bal);
      let best = null, bd = 0.6;
      for (const P of pieds) {
        if (!P.bout || P.lock) continue;
        P.bout.getWorldPosition(cible);
        const d = Math.hypot(cible.x - bw.x, cible.z - bw.z);
        if (d < bd) { bd = d; best = P; }
      }
      if (best) {
        best.bout.getWorldPosition(cible);
        const dx = bw.x - cible.x, dz = bw.z - cible.z, L = Math.hypot(dx, dz) || 1;
        // au contact : le pied derrière la balle, pas dedans
        vt.set(bw.x - (dx / L) * 0.12, Math.max(cible.y, Math.min(bw.y - 0.02, cible.y + 0.15)), bw.z - (dz / L) * 0.12).sub(cible);
        const k = 1 - T.age / 0.12, Lc = vt.length();
        if (Lc > 0.3) vt.multiplyScalar(0.3 / Lc);
        if (Lc > 0.005) ik2(best.haut, best.milieu, best.bout, cible.add(vt.multiplyScalar(k)));
      }
    }
    // les bras du gardien vers la balle
    if (gardien && e.allonge) {
      for (const B of bras) {
        if (!B.haut || !B.milieu || !B.bout) continue;
        B.bout.getWorldPosition(cible);
        cible.y += e.allonge;
        ik2(B.haut, B.milieu, B.bout, cible);
      }
    }
    if (perso.majTete) perso.majTete();
  }

  return { maj, get geste() { return geste; } };
}
