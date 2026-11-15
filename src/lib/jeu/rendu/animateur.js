// L'animation des joueurs calée sur la simulation (bola-app#23, graphe d'animation de bola-app#26) : le corps suit ce
// que la simulation a décidé, au lieu de l'inverse. Rien ici ne change une position de jeu.
//
//   · Graphe d'états (rendu/graphe.js) : locomotion, départ, arrêt, demi-tour sur place, gestes de la simulation
//     (passes, frappes, contrôles, tacles, chutes, relevés, pivots, célébrations, arrêts du gardien). Chaque clip est
//     une couche dont le poids va vers sa cible à la vitesse du fondu choisi par le graphe (FONDUS, entrée ; sortie
//     vers la course calée sur l'appui du pied, dureeSortie) ; une couche qui sort continue à son rythme pendant son
//     fondu (le geste finit, il ne se fige pas), et deux couches du même clip (contrôle après contrôle) passent par
//     un double du clip : jamais de pose qui saute, sauf quand la racine saute (fin de plongeon).
//   · Locomotion : un mélange de clips synchronisé sur la vitesse réelle. Tous les cycles (idle, jog, run, sprint au-delà
//     de 6 m/s, drib, back, strafe_l, strafe_r ; pour le gardien k_idle, k_side_l, k_side_r) sont posés au temps que
//     donne la phase de foulée de la simulation (φ, corps.js), calée pour chaque clip sur l'appui de son pied gauche :
//     le pied d'appui ne saute jamais d'un clip à l'autre, et la cadence suit la vitesse sans borne.
//   · Couches procédurales, filtrées (ressorts amortis, aucun bruit) : buste penché à l'accélération et plus bas en
//     sprint, en arrière au freinage et au contrôle de la poitrine (18°), roulis dans les virages, au déséquilibre et
//     vers l'adversaire dans un duel d'épaule, tête et cou vers la balle (60° au plus) ; le coup reçu (hit_l / hit_r,
//     clip additif du haut du corps, du côté d'où vient la poussée, au poids du déséquilibre) ; les gestes techniques
//     sans clip (passement : le pied fait le tour de la balle par-dessus ; talonnade ; sombrero en course) en IK du
//     pied sur une courbe. « Réduire les animations » divise ces amplitudes par deux.
//   · Pieds verrouillés : pendant un appui (table des appuis de sim/clips.js, des cycles et des gestes sur place), le
//     pied est tenu à sa place au sol par une IK à deux os (cuisse, tibia ; le genou reste dans son plan), correction
//     plafonnée à 8 cm et relâchée en 60 ms ; le bassin descend (6 cm au plus) quand un pied tenu serait hors de
//     portée, au lieu de tendre la jambe ; presque à l'arrêt, les deux pieds tiennent leur place (25 cm) et ne sont
//     reposés que par un vrai pas. Pendant une touche de balle, le pied le plus proche va au contact (IK, 30 cm au
//     plus). Les bras du gardien s'allongent vers la balle de la même façon (allongeBras, ± 0,4 m).
// Les bras de course viennent des clips, sans retouche.
import * as THREE from 'three';
import { CLIPS } from '../sim/clips.js';
import { creerGraphe, fondu, dureeSortie, enAppui, partCycle, vitessePhase } from './graphe.js';
import { boneKey } from '../library.js';

const LOCO = ['idle', 'jog', 'run', 'sprint', 'drib', 'back', 'strafe_l', 'strafe_r'];
const LOCO_G = ['k_idle', 'k_side_l', 'k_side_r'];
const clamp = THREE.MathUtils.clamp;
const DEG = Math.PI / 180;

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

// le haut du corps, pour le coup reçu additif (hit_l, hit_r)
const HAUT = /^(spine\d?|neck|head|(left|right)(shoulder|arm|forearm|hand))$/;

/**
 * L'animateur d'un joueur. perso : creerPersonnage (personnage.js) ; gardien : bool ; reduit : mouvement réduit.
 * maj(e, dt) avec e = l'état d'animation (rendu/etat.js : vitesse, cap, phase, geste { nom, t, type, taux, surface },
 * appui, touche, choc, figure, balle…) ; versMonde3(jeu → monde three) pour la tête, la balle et les pieds.
 * diag : ce que le banc d'animation mesure (état du graphe, appuis tenus, couches).
 */
export function creerAnimateur(perso, { gardien = false, reduit = false, versMonde3 } = {}) {
  const { actions, mixer, os, corps, racine } = perso;
  const noms = (gardien ? LOCO_G : LOCO).filter((n) => actions[n]);
  for (const n of Object.keys(actions)) { const a = actions[n]; a.stop(); a.enabled = true; a.setEffectiveTimeScale(0); a.setEffectiveWeight(0); }
  for (const n of noms) actions[n].play();
  const graphe = creerGraphe({ gardien });
  // les doubles des clips (un contrôle qui suit un contrôle : deux couches du même clip, fondues l'une dans l'autre)
  const doubles = {};
  const actionLibre = (nom, prise) => {
    if (!prise.has(actions[nom])) return actions[nom];
    if (!doubles[nom]) { const a = mixer.clipAction(actions[nom].getClip().clone()); if (!actions[nom].getClip().userData?.loop) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } a.enabled = true; doubles[nom] = a; }
    return doubles[nom];
  };
  // le coup reçu : hit_l / hit_r additifs, haut du corps seulement, référence = leur première image
  const coups = {};
  for (const n of ['hit_l', 'hit_r']) {
    if (!actions[n]) continue;
    const c = actions[n].getClip().clone();
    c.tracks = c.tracks.filter((t) => HAUT.test(boneKey(t.name.slice(0, t.name.lastIndexOf('.')))));
    THREE.AnimationUtils.makeClipAdditive(c, 0, c, 30);
    const a = mixer.clipAction(c);
    a.blendMode = THREE.AdditiveAnimationBlendMode; a.enabled = true; a.play(); a.setEffectiveTimeScale(0); a.setEffectiveWeight(0);
    coups[n] = a;
  }
  const etat = {};
  const amp = reduit ? 0.5 : 1;
  const pieds = [
    { haut: os.leftupleg, milieu: os.leftleg, bout: os.leftfoot, lock: null, mix: 0, cible: new THREE.Vector3(), verrou: new THREE.Vector3() },
    { haut: os.rightupleg, milieu: os.rightleg, bout: os.rightfoot, lock: null, mix: 0, cible: new THREE.Vector3(), verrou: new THREE.Vector3() },
  ];
  const bras = [
    { haut: os.leftarm, milieu: os.leftforearm, bout: os.lefthand },
    { haut: os.rightarm, milieu: os.rightforearm, bout: os.righthand },
  ];
  // les os que les couches procédurales retouchent (buste, cou, tête, IK des jambes et des bras)
  const retouches = [os.spine, os.spine1, os.neck, os.head, os.leftupleg, os.leftleg, os.rightupleg, os.rightleg, os.leftarm, os.leftforearm, os.rightarm, os.rightforearm].filter(Boolean);
  const posesMixer = retouches.map((o) => o.quaternion.clone());
  // la longueur des jambes (cuisse + tibia), au repos : le bassin descend quand un pied tenu serait plus loin
  racine.updateMatrixWorld(true);
  for (const P of pieds) if (P.haut && P.milieu && P.bout) { P.haut.getWorldPosition(va); P.milieu.getWorldPosition(vb); P.bout.getWorldPosition(vc); P.longueur = va.distanceTo(vb) + vb.distanceTo(vc); }
  const lateral = new THREE.Vector3(), haut = new THREE.Vector3(0, 1, 0), avant = new THREE.Vector3(), cible = new THREE.Vector3(), bal = new THREE.Vector3(), tmpv = new THREE.Vector3();
  // les couches de clips : { a, nom, poids, cible, duree, t, taux, cat }
  const couches = [];
  const prises = new Set();
  let active = null, catPrec = 'loco';
  const diag = { etat: 'loco', tenus: [false, false], couches: 0, sortie: null, appuiLoco: [false, false], pose: [0, 0] };
  let dom = null;

  let phaseG = 0;
  const foulee = (n) => Math.max(0.3, (CLIPS[n]?.vitesse ?? 1) * (CLIPS[n]?.dur ?? 0.5));
  const calageG = (n) => CLIPS[n]?.appuis?.[0]?.[0]?.[0] ?? 0;
  function poserLoco(e, total, wLoco, dt = 0) {
    const s = Math.hypot(e.vx, e.vz);
    if (gardien) phaseG = (phaseG + (dt * s) / foulee('k_side_l')) % 1;
    // vitesse dans le repère du joueur (x = sa gauche, z = devant)
    const c = Math.cos(e.cap), sn = Math.sin(e.cap);
    const lx = e.vx * c - e.vz * sn, lz = e.vx * sn + e.vz * c;
    const w = {};
    for (const n of noms) w[n] = 0;
    if (gardien) {
      const cote = s > 0.3 ? clamp(Math.abs(lx) / s, 0, 1) : 0;
      const k = clamp(s / 1.2, 0, 1) * cote;
      w.k_idle = 1 - k;
      // (le pas chassé qui va du bon côté : celui dont le root motion part vers x > 0 quand il va à sa gauche ;
      // « k_side_l », miroir de la capture, va vers sa droite)
      const versGauche = (CLIPS.k_side_r?.root?.[(CLIPS.k_side_r.n - 1) * 2] ?? 1) > 0 ? 'k_side_r' : 'k_side_l';
      w[lx > 0 ? versGauche : versGauche === 'k_side_r' ? 'k_side_l' : 'k_side_r'] = k;
    } else {
      const fw = s > 0.05 ? Math.max(0, lz / s) : 1, bk = s > 0.05 ? Math.max(0, -lz / s) : 0;
      const lf = s > 0.05 ? Math.max(0, lx / s) : 0, rt = s > 0.05 ? Math.max(0, -lx / s) : 0;
      const q = fw * fw + bk * bk + lf * lf + rt * rt || 1;
      const marche = clamp(s / 1.4, 0, 1); // sous 1,4 m/s, le cycle se mêle au repos (pas de clip de marche)
      let jog = 0, run = 0, drib = 0, sprint = 0;
      if (e.balle && s < 4.4) drib = 1;
      else if (s < 2.85) jog = 1;
      else if (s < 5.39) { run = (s - 2.85) / (5.39 - 2.85); jog = 1 - run; }
      else run = 1;
      if (e.balle && s >= 3.8 && s < 4.4) { const u = (s - 3.8) / 0.6; drib = 1 - u; run = u; }
      if (run > 0 && s > 6 && actions.sprint) { sprint = run * clamp((s - 6) / 0.8, 0, 1); run -= sprint; }
      w.jog = (fw * fw / q) * jog * marche; w.run = (fw * fw / q) * run * marche; w.drib = (fw * fw / q) * drib * marche;
      if ('sprint' in w) w.sprint = (fw * fw / q) * sprint * marche;
      w.back = (bk * bk / q) * marche; w.strafe_l = (lf * lf / q) * marche; w.strafe_r = (rt * rt / q) * marche;
      w.idle = 1 - marche;
    }
    let d = null, dw = -1;
    for (const n of noms) {
      const a = actions[n], cl = CLIPS[n];
      const dur = a.getClip().duration;
      // (le gardien : ses pas chassés ont leur propre cadence, celle de leur foulée, pas celle de la course)
      const u = n === 'idle' || n === 'k_idle' ? ((total % dur) / dur) : gardien ? (phaseG + calageG(n)) % 1 : partCycle(n, e.phase);
      a.time = u * dur;
      a.setEffectiveWeight(w[n] * wLoco);
      if (w[n] > dw && cl?.appuis && n !== 'idle' && n !== 'k_idle') { dw = w[n]; d = { nom: n, u, w: w[n] }; }
    }
    return { dom: d, s };
  }

  /** Les couches : l'active va vers 1, les autres vers 0 à la vitesse de leur fondu ; leur somme ne dépasse pas 1. */
  function majCouches(e, dt) {
    const r = graphe.maj(e, dt);
    diag.tGraphe = r.clip?.t ?? null;
    const cat = r.etat;
    const clip = r.clip && actions[r.clip.nom] ? r.clip : null;
    if (clip) {
      const neuf = !active || active.nom !== clip.nom || clip.t + 1e-6 < active.t - 0.05;
      if (neuf) {
        const d = e.saut ? 0 : fondu(catPrec, cat);
        if (active) { active.cible = 0; active.duree = d; }
        prises.clear(); for (const c of couches) if (c.poids > 0 || c.cible > 0) prises.add(c.a);
        const a = actionLibre(clip.nom, prises);
        // (la même action qui sortait : elle reprend sa place, sans repartir de zéro)
        let c = couches.find((x) => x.a === a);
        if (!c) { c = { a, nom: clip.nom, poids: 0, cible: 1, duree: d, t: clip.t, taux: 1, cat }; couches.push(c); a.play(); a.setEffectiveTimeScale(0); }
        c.cible = 1; c.duree = d; c.cat = cat; c.t = clip.t;
        if (e.saut) { for (const x of couches) x.poids = x === c ? 1 : 0; }
        active = c;
      }
      if (dt > 0) active.taux = e.geste?.taux ?? Math.max(0, (clip.t - active.t) / dt);
      active.t = clip.t; active.cat = cat;
    } else if (active) {
      // la sortie : vers la course, calée sur l'appui ; sinon le fondu de la table
      let d = fondu(catPrec, cat);
      if (cat === 'loco' && !gardien) {
        const sor = dureeSortie(active.nom, active.t, dom?.nom, e.phase, vitessePhase(Math.hypot(e.vx, e.vz), e.balle));
        d = sor.duree; diag.sortie = { nom: active.nom, pied: sor.pied, duree: d, reste: d, trouve: sor.trouve, cycle: dom?.nom };
      }
      active.cible = 0; active.duree = e.saut ? 0 : d;
      if (e.saut) active.poids = 0;
      active = null;
    }
    catPrec = cat;
    diag.etat = cat;
    let W = 0;
    for (let i = couches.length - 1; i >= 0; i--) {
      const c = couches[i];
      const dur = c.a.getClip().duration, boucle = c.a.getClip().userData?.loop;
      if (c !== active) c.t += c.taux * dt; // (la couche qui sort finit son geste à son rythme)
      const pas = c.duree > 0 ? dt / c.duree : 1;
      c.poids = c.cible > c.poids ? Math.min(c.cible, c.poids + pas) : Math.max(c.cible, c.poids - pas);
      if (c.poids <= 0 && c.cible <= 0) { c.a.setEffectiveWeight(0); couches.splice(i, 1); continue; }
      c.a.time = boucle ? c.t % dur : Math.min(Math.max(0, c.t), dur - 1e-4);
    }
    // l'active garde son poids ; les couches qui sortent se partagent le reste (la somme ne dépasse jamais 1)
    const wa = active ? active.poids : 0;
    let reste = 0; for (const c of couches) if (c !== active) reste += c.poids;
    const k = reste > 1 - wa ? (1 - wa) / reste : 1;
    for (const c of couches) { const p = c === active ? c.poids : c.poids * k; c.a.setEffectiveWeight(p); W += p; }
    diag.couches = couches.length; diag.enFondu = couches.some((c) => c.poids > 0.02 && c.poids < 0.98); diag.noms = couches.map((c) => `${c.nom}:${c.poids.toFixed(2)}@${c.t.toFixed(2)}`);
    if (diag.sortie) { diag.sortie.reste -= dt; }
    return Math.min(1, W);
  }

  let total = 0;
  function maj(e, dt) {
    total += dt;
    const W = majCouches(e, dt);
    const lo = poserLoco(e, total, 1 - W, dt);
    dom = lo.dom;
    const s = lo.s;
    // le coup reçu : additif, du côté d'où vient la poussée (poussé vers sa droite : touché à gauche)
    for (const n in coups) coups[n].setEffectiveWeight(0);
    const C = e.choc;
    if (C && !gardien && (coups.hit_l || coups.hit_r)) {
      const gx = Math.cos(e.cap), gz = -Math.sin(e.cap); // la gauche du joueur (jeu)
      const n = C.x * gx + C.z * gz < 0 ? 'hit_l' : 'hit_r';
      const a = coups[n] ?? coups.hit_l ?? coups.hit_r;
      const env = clamp(C.age / 0.06, 0, 1) * clamp(1 - (C.age - 0.3) / 0.5, 0, 1);
      a.time = Math.min(a.getClip().duration - 1e-4, C.age * 1.25);
      a.setEffectiveWeight(clamp(C.f * 1.4, 0.25, 1) * env * amp * (1 - W * 0.6));
    }
    corps.position.y = 0;
    // (le mélangeur de three ne réécrit un os que si la valeur mélangée a changé depuis l'image d'avant : un geste
    // figé, au sol par exemple, laisserait les retouches de l'image d'avant s'empiler — la tête tournait sur elle-même.
    // Les os retouchés reprennent donc la pose du mélangeur avant chaque image.)
    for (let i = 0; i < retouches.length; i++) retouches[i].quaternion.copy(posesMixer[i]);
    mixer.update(0);
    for (let i = 0; i < retouches.length; i++) posesMixer[i].copy(retouches[i].quaternion);
    const gesteW = W;

    // le buste et le roulis (corps entier, autour des pieds), filtrés : penché à l'accélération, en arrière au
    // freinage (10° au plus), plus bas en sprint (9° de plus au-delà de 6 m/s) ; en arrière au contrôle de la poitrine
    const penSprint = gardien ? 0 : clamp((s - 6) / 1.2, 0, 1) * 9 * DEG;
    let poitrine = 0;
    const G = e.geste;
    if (G && G.surface === 'poitrine' && G.impact != null) {
      const x = (G.t - G.impact) / 0.3;
      poitrine = -18 * DEG * Math.exp(-x * x * 2);
    }
    const tangage = ressort(etat, 'tg', (clamp(0.03 * (e.aLong ?? 0), -10 * DEG, 14 * DEG) + penSprint) * amp * (1 - gesteW) + poitrine * amp, dt, 12);
    let appui = 0;
    const A = e.appui;
    if (A && A.age < 0.35) {
      const gx = Math.cos(e.cap), gz = -Math.sin(e.cap);
      appui = -(A.x * gx + A.z * gz) * 13 * DEG * clamp(A.f, 0, 1) * (1 - A.age / 0.35);
    }
    // (le passement : les hanches suivent le pied qui fait le tour de la balle)
    const F = e.figure;
    const uF0 = F ? clamp(F.age / F.duree, 0, 1) : 0;
    // (lot 3 : le double passement, deux demi-tours de pied, un de chaque côté)
    const uF = F?.double ? (uF0 * 2) % 1 : uF0;
    const coteF = F ? (F.double && uF0 >= 0.5 ? -F.cote : F.cote) : 0;
    const balancier = F && F.type === 'passement' ? coteF * 9 * DEG * Math.sin(Math.PI * uF) : 0;
    const roulis = ressort(etat, 'rl', (clamp(-0.6 * Math.atan((e.aLat ?? 0) / 9.81), -16 * DEG, 16 * DEG) + appui) * amp * (1 - gesteW) + balancier * amp, dt, 9);
    corps.rotation.z = roulis;
    corps.rotation.x = 0;
    // le gardien : ses captures enfoncent les orteils dans le gazon (jusqu'à 11 cm) ; le corps remonte d'autant
    if (gardien && os.lefttoebase && os.righttoebase) {
      racine.updateMatrixWorld(true);
      os.lefttoebase.getWorldPosition(va); os.righttoebase.getWorldPosition(vb);
      const bas = Math.min(va.y, vb.y) - racine.position.y;
      corps.position.y = ressort(etat, 'pied', clamp(0.012 - bas, 0, 0.12), dt, 16);
    }
    racine.updateMatrixWorld(true);
    avant.set(Math.sin(e.cap), 0, Math.cos(e.cap));
    if (versMonde3) versMonde3(avant, avant);
    lateral.crossVectors(haut, avant).normalize();
    if (os.spine) tournerMonde(os.spine, lateral, tangage * 0.5);
    if (os.spine1) tournerMonde(os.spine1, lateral, tangage * 0.5);
    let lacet = 0;
    if (e.regard && e.pos) {
      const a = Math.atan2(e.regard.x - e.pos.x, e.regard.z - e.pos.z) - e.cap;
      let d = a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      lacet = clamp(d, -60 * DEG, 60 * DEG);
    }
    lacet = ressort(etat, 'lc', lacet * amp * (1 - gesteW * 0.7), dt, 7);
    if (os.neck) tournerMonde(os.neck, haut, lacet * 0.5);
    if (os.head) tournerMonde(os.head, haut, lacet * 0.5);
    racine.updateMatrixWorld(true);

    // les pieds verrouillés pendant l'appui : celui du cycle de course (W faible), ou celui du geste sur place qui
    // tient le pied au sol (table des appuis du geste) ; presque à l'arrêt (sous 0,5 m/s), les deux pieds tiennent
    // leur place (25 cm de correction au plus) et un pied n'est reposé que quand il s'en écarte de plus de 25 cm
    const surPlace = active && !e.saut && (e.geste?.type === 'controle' || e.geste?.type === 'amorti' || e.geste?.type === 'feinte');
    const lent = W < 0.05 && s < 0.5 && !gardien;
    diag.lent = lent; diag.dom = dom?.nom ?? null;
    for (let p = 0; p < 2; p++) {
      const P = pieds[p];
      if (!P.haut || !P.milieu || !P.bout) continue;
      // (le cycle qui domine le mélange, à plus de 45 % : sinon ses appuis ne sont pas ceux qu'on voit)
      const enLoco = W < 0.05 && dom && dom.w > 0.45 && s > 0.3 && enAppui(dom.nom, dom.u, p);
      diag.appuiLoco[p] = !!(dom && enAppui(dom.nom, dom.u, p));
      const enGeste = surPlace && active.poids > 0.9 && enAppui(active.nom, clamp(active.t / active.a.getClip().duration, 0, 1), p);
      P.pas = Math.max(0, (P.pas ?? 0) - dt);
      const tient = (lent || enLoco || enGeste) && P.pas <= 0;
      P.bout.getWorldPosition(cible);
      // (un pied tenu trop loin de sa pose : il fait un pas, 0,14 s sans verrou, fondu, au lieu de sauter)
      if (tient && P.lock && Math.hypot(P.lock.x - cible.x, P.lock.z - cible.z) > (lent ? 0.25 : 0.22)) { P.lock = null; P.pas = 0.14; }
      else if (tient && !P.lock && P.mix <= 0.02) P.lock = P.verrou.copy(cible);
      if (!(tient && P.pas <= 0) && P.lock) { P.lock = null; }
      P.mix = P.lock ? Math.min(1, P.mix + dt / (enGeste ? 0.12 : 0.05)) : Math.max(0, P.mix - dt / (P.pas > 0 ? 0.12 : 0.06));
      if (P.lock) P.cible.set(P.lock.x, cible.y, P.lock.z);
      // (la correction plafonnée : 25 cm à l'arrêt, 22 cm en course ; les cycles de course n'ont pas tous la foulée
      // de la simulation, le pied d'appui reste où il s'est posé)
      P.plafond = lent ? 0.25 : 0.22;
      diag.tenus[p] = !!P.lock;
    }
    // le bassin : si un pied tenu est hors de portée de la jambe (tendue à 99 %), le corps descend d'autant (6 cm
    // au plus), filtré ; puis l'IK de chaque pied tenu
    let baisse = 0;
    for (const P of pieds) {
      if (!P.lock || !P.longueur || P.mix <= 0) continue;
      P.haut.getWorldPosition(va);
      P.bout.getWorldPosition(cible);
      const off = vt.copy(P.cible).sub(cible);
      const L = off.length();
      if (L > P.plafond) off.multiplyScalar(P.plafond / L);
      tmpv.copy(cible).add(off.multiplyScalar(P.mix));
      baisse = Math.max(baisse, va.distanceTo(tmpv) - P.longueur * 0.99);
    }
    const bassin = ressort(etat, 'bas', clamp(baisse, 0, 0.06), dt, 18);
    if (bassin > 1e-4) { corps.position.y -= bassin; racine.updateMatrixWorld(true); }
    for (const P of pieds) {
      if (!P.haut || !P.milieu || !P.bout || P.mix <= 0) continue;
      P.bout.getWorldPosition(cible);
      const off = vt.copy(P.cible).sub(cible);
      const L = off.length();
      if (L > P.plafond) off.multiplyScalar(P.plafond / L);
      if (L > 0.002) ik2(P.haut, P.milieu, P.bout, cible.add(off.multiplyScalar(P.mix)));
    }
    diag.pose[0] = bassin;
    // les gestes techniques sans clip : le pied suit une courbe autour de la balle (IK, 35 cm de correction au plus)
    if (F && versMonde3 && e.boule && !gardien) {
      const bw = versMonde3(e.boule, bal);
      const env = Math.sin(Math.PI * uF);
      const fx = avant.x, fz = avant.z, gx = -lateral.x, gz = -lateral.z; // avant et gauche du joueur (monde)
      let P = null;
      if (F.type === 'passement') P = coteF > 0 ? pieds[0] : pieds[1];
      else {
        // (talonnade, sombrero : le pied le plus proche de la balle)
        let bd = Infinity;
        for (const Q of pieds) { if (!Q.bout) continue; Q.bout.getWorldPosition(cible); const d = Math.hypot(cible.x - bw.x, cible.z - bw.z); if (d < bd) { bd = d; P = Q; } }
      }
      if (P?.bout) {
        P.bout.getWorldPosition(cible);
        if (F.type === 'passement') {
          // de l'intérieur de la balle, par-dessus, vers l'extérieur : un demi-cercle de 0,24 m, 0,14 m au plus haut
          const a = Math.PI * uF, r = 0.24;
          tmpv.set(bw.x + (-Math.cos(a) * coteF) * r * gx + Math.sin(a) * r * fx, 0.09 + 0.14 * Math.sin(a), bw.z + (-Math.cos(a) * coteF) * r * gz + Math.sin(a) * r * fz);
        } else if (F.type === 'talon') {
          // le talon part en arrière, derrière la jambe d'appui
          tmpv.set(cible.x - fx * 0.32 * env, cible.y + 0.22 * env, cible.z - fz * 0.32 * env);
        } else {
          // la pointe du pied sous la balle, qui la lève
          tmpv.set(bw.x - fx * 0.08, Math.max(cible.y, 0.05 + 0.25 * env), bw.z - fz * 0.08);
        }
        const k = (F.type === 'passement' ? Math.min(1, env * 3) : env) * (reduit ? 0.6 : 1);
        vt.copy(tmpv).sub(cible);
        const Lc = vt.length();
        if (Lc > 0.35) vt.multiplyScalar(0.35 / Lc);
        if (Lc > 0.003) ik2(P.haut, P.milieu, P.bout, cible.add(vt.multiplyScalar(k)));
      }
    }
    // le pied qui touche la balle : pendant les 0,12 s d'une touche (conduite, contrôle en course), le pied le plus
    // proche va au contact de la balle (30 cm de correction au plus), puis la suit ; le pied qui frappe, lui, vient du clip
    const T = e.touche;
    if (T && T.age >= 0 && T.age < 0.12 && versMonde3 && (W < 0.3 || active?.nom === 'receive') && !F) {
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
    // (bola-app#26, lot 2) le tirage de maillot : la main la plus proche tend vers le dos du porteur (0,45 m au plus
    // de sa place dans le clip), avec un fondu de 0,15 s à l'entrée et à la sortie
    etat.tireW = clamp((etat.tireW ?? 0) + (e.tire ? dt : -dt) / 0.15, 0, 1);
    if (e.tire) { etat.tireDer ??= { x: 0, y: 0, z: 0 }; etat.tireDer.x = e.tire.x; etat.tireDer.y = e.tire.y; etat.tireDer.z = e.tire.z; }
    if (etat.tireW > 0.01 && etat.tireDer && versMonde3 && !gardien) {
      const bw = versMonde3(etat.tireDer, bal);
      let best = null, bd = Infinity;
      for (const B of bras) { if (!B.haut || !B.milieu || !B.bout) continue; B.bout.getWorldPosition(cible); const d = cible.distanceTo(bw); if (d < bd) { bd = d; best = B; } }
      if (best) {
        best.bout.getWorldPosition(cible);
        tmpv.copy(bw).sub(cible);
        const Lt = tmpv.length();
        if (Lt > 0.45) tmpv.multiplyScalar(0.45 / Lt);
        ik2(best.haut, best.milieu, best.bout, cible.add(tmpv.multiplyScalar(etat.tireW)));
      }
    }
    if (perso.majTete) perso.majTete();
  }

  return { maj, diag, get geste() { return active?.nom ?? null; }, get etat() { return diag.etat; } };
}
