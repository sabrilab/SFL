// Le match Bola en simulation pure (bola-app#23) : l'état complet et le pas fixe, sans three ni DOM.
//
// creerMonde({ graine, duree, humains }) → monde ; pas(monde, entrees) avance de PAS (1/120 s). Les entrées sont les
// intentions des humains, une par équipe (null = l'IA joue cette équipe). La page (match.js) enchaîne les pas avec un
// accumulateur et interpole l'affichage ; le banc (tools/jeu-banc.ts) appelle les mêmes pas sans navigateur. Même
// graine + mêmes entrées = même match, au bit près (empreinte).
//
// Les règles de Bola (un five en salle) : la balle ne sort jamais, elle rebondit sur les panneaux et les filets ; pas
// de touche, pas de corner, pas de hors-jeu ; après un but, l'équipe qui l'a pris engage au rond central. Aucune
// faute sifflée (proposé à Sabri : la chute suffit). Les phases : attente, intro, engagement, jeu, but, fin.
//
// Ce que les humains (pouce ou manettes, entrees/) ajoutent à l'intention d'un joueur : presse (aller au porteur),
// renfort (un coéquipier de l'IA presse aussi), sortie (le gardien sort), changer (prendre un autre joueur, au plus
// proche de la balle ou dans une direction), et les actions crochet et semelle en plus des passes, frappes, tacles et
// roulette. Pour l'IA, rien ne change : l'IA contre l'IA garde la même empreinte.
//
// Ordre d'un pas de jeu : main au bon joueur → intentions (humains, IA, gardiens) → gestes demandés → corps
// (locomotion, gestes à root motion) → frappes et tacles en cours → contacts entre corps → balle (conduite, contrôle,
// gardiens, intégration, but) → horloge. Le monde publie la liste des événements du pas (ev) pour le rendu, le son et
// les vibrations ; la simulation n'en dépend pas.
import { PAS, JEU, ROLES, ENGAGEMENT, BX, BZ, LB, butDe, sens, BALLON } from './constantes.js';
import { creerHasard } from './hasard.js';
import { creerCorps, pasCorps, libre, lancerGeste, clamp } from './corps.js';
import { creerBalle, pasBalle, antiBlocage } from './ballon.js';
import { pasConduite, pasControle, demanderFrappe, pasDemande, pasFrappe, porteur } from './gestes.js';
import { pasCorpsACorps, demanderTacle, pasTacle, desequilibrer } from './contacts.js';
import { pasGardien, pasCorpsGardien, contactGardien, tenirBalle } from './gardien.js';
import { pasIA, intentionVide, conduire } from './ia.js';
import { atan2, cos, hypot, sin } from './maths.js';

/**
 * Crée un match. humains : [bool, bool] (une équipe jouée par un humain) ; aides : [aide0, aide1] (1 = pouce,
 * 0,5 = manette, 0 = IA) ; journal : une fonction (type, ...valeurs) pour le banc.
 */
export function creerMonde({ graine = 1, duree = JEU.duree, humains = [true, false], aides = [1, 0], journal = null, presents = null } = {}) {
  const joueurs = [];
  for (const e of [0, 1]) for (const role of ROLES) {
    const j = creerCorps(joueurs.length, e, role);
    j.int = intentionVide();
    j.aide = 0;
    joueurs.push(j);
  }
  const m = {
    graine, t: 0, pas: 0, duree,
    phase: 'attente', phaseT: 0, score: [0, 0], reste: duree, buteur: null, butEquipe: null,
    joueurs, balle: creerBalle(),
    humains: [...humains], aides: [...aides],
    controle: [null, null],   // le joueur que joue chaque humain (index), null pour l'IA
    changeT: [-9, -9],
    choixT: [-9, -9],         // le dernier changement de joueur demandé (LB / L1, stick droit) : la main ne bouge plus seule 1,5 s
    renfort: [false, false],  // l'humain demande le pressing d'un coéquipier (RB / R1 en défense)
    sortie: [false, false],   // l'humain demande la sortie de son gardien (Y / △ maintenu en défense)
    rng: creerHasard(graine),
    evts: [], journal,
    stats: { passes: 0, tirs: 0, tacles: 0, vols: 0, arrets: 0, buts: 0, epaules: 0, plongeons: 0, chutes: 0, antiBlocages: 0, demandes: 0, impacts: [] },
    _p0: { x: 0, y: 0, z: 0 },
    _phases: new Float64Array(joueurs.length),
  };
  // (banc et scènes : les joueurs absents ne jouent pas, ne touchent rien et ne gênent personne)
  if (presents) for (const j of joueurs) j.absent = !presents.includes(j.i);
  m.ev = (type, donnees) => { m.evts.push({ type, t: m.t, ...donnees }); if (type === 'chute') m.stats.chutes++; journal?.(type, donnees); };
  engagement(m, 0);
  return m;
}

/** Place les deux équipes pour un engagement ; l'équipe e engage. */
export function engagement(m, e) {
  for (const j of m.joueurs) {
    j.v.x = 0; j.v.z = 0; j.mode = 'loco'; j.g = null; j.d = 0; j.recup = 0; j.plante = 0; j.decision = 0.3; j.essai = 0.6;
    j.cap = sens(j.e) < 0 ? Math.PI : 0;
    if (j.gardien) { j.p.x = 0; j.p.z = butDe(j.e) - Math.sign(butDe(j.e)) * 0.7; }
    else { const [x, f] = ENGAGEMENT[j.role]; j.p.x = x; j.p.z = sens(j.e) * f * LB; }
  }
  const porteurE = m.joueurs.find((j) => j.e === e && j.role === 'A');
  porteurE.p.x = 0; porteurE.p.z = -sens(e) * 0.4;
  const b = m.balle;
  b.p.x = 0; b.p.y = BALLON.R; b.p.z = 0; b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
  b.garde = null; b.dernier = null; b.dernierT = -9; b.possesseur = porteurE.i; b.recepteur = null; b.tir = null;
  for (const eq of [0, 1]) {
    if (!m.humains[eq]) { m.controle[eq] = null; continue; }
    m.controle[eq] = eq === e ? porteurE.i : m.joueurs.find((j) => j.e === eq && j.role === 'A').i;
  }
  m.buteur = null;
}

/** Démarre le match (après l'écran d'attente) ; sans intro : le coup d'envoi tout de suite. */
export function demarrer(m, { intro = true, reduit = false } = {}) {
  m.score[0] = 0; m.score[1] = 0; m.reste = m.duree; m.buteur = null;
  engagement(m, 0);
  m.phase = intro ? 'intro' : 'jeu';
  m.phaseT = intro ? (reduit ? 0.3 : JEU.intro) : 0;
}

/** Change le nombre d'humains en cours de partie (manette branchée, débranchée). */
export function changerHumains(m, humains, aides) {
  for (const e of [0, 1]) {
    m.humains[e] = !!humains[e];
    if (aides) m.aides[e] = aides[e];
    if (!m.humains[e]) m.controle[e] = null;
    else if (m.controle[e] == null) m.controle[e] = m.joueurs.find((j) => j.e === e && j.role === 'A').i;
  }
}

/** La main passe au porteur, au receveur d'une passe, puis au joueur le plus près de la balle quand on défend. */
function majControle(m) {
  const b = m.balle, p = porteur(m);
  for (const e of [0, 1]) {
    if (!m.humains[e]) { m.controle[e] = null; continue; }
    // (une scène de capture tient la main sur un joueur choisi)
    if (m.controleFixe?.[e] != null) { m.controle[e] = m.controleFixe[e]; continue; }
    const c = m.controle[e];
    if (p && p.e === e && !p.gardien) { if (c !== p.i) { m.controle[e] = p.i; m.changeT[e] = m.t; } continue; }
    if (b.recepteur != null && m.joueurs[b.recepteur].e === e && !m.joueurs[b.recepteur].gardien) { m.controle[e] = b.recepteur; continue; }
    if (m.t - m.changeT[e] < 0.6 || m.t - m.choixT[e] < 1.5) continue;
    const cur = m.joueurs[c ?? 0];
    let best = cur, bd = hypot(cur.p.x - b.p.x, cur.p.z - b.p.z);
    for (const j of m.joueurs) {
      if (j.e !== e || j.gardien || j.absent) continue;
      const d = hypot(j.p.x - b.p.x, j.p.z - b.p.z);
      if (d < bd - 2) { bd = d; best = j; }
    }
    if (best !== cur || c == null) { m.controle[e] = best.i; m.changeT[e] = m.t; }
  }
}

/**
 * Changer de joueur (LB / L1, ou le stick droit poussé dans une direction) : sans direction, le coéquipier le plus
 * près de la balle prédite à 0,4 s ; avec une direction (repère du jeu), celui qui est le plus dans cette direction
 * depuis le joueur actuel. La main ne revient pas seule au plus proche pendant 1,5 s.
 */
export function changerJoueur(m, e, dir = null) {
  const b = m.balle, cur = m.controle[e] != null ? m.joueurs[m.controle[e]] : null;
  const px = b.p.x + b.v.x * 0.4, pz = b.p.z + b.v.z * 0.4;
  let best = null, bs = -Infinity;
  const L = dir ? hypot(dir.dx ?? 0, dir.dz ?? 0) : 0;
  for (const o of m.joueurs) {
    if (o.e !== e || o.gardien || o.absent || o === cur) continue;
    let sc;
    if (L > 1e-6 && cur) {
      const rx = o.p.x - cur.p.x, rz = o.p.z - cur.p.z, d = hypot(rx, rz) || 1;
      const c = (rx * dir.dx + rz * dir.dz) / (d * L);
      if (c < 0.4) continue;
      sc = c - d / 40;
    } else sc = -hypot(o.p.x - px, o.p.z - pz);
    if (sc > bs) { bs = sc; best = o; }
  }
  if (!best) return false;
  m.controle[e] = best.i; m.changeT[e] = m.t; m.choixT[e] = m.t;
  m.ev('changer', { e, j: best.i });
  return true;
}

/** Le pressing (A / ✕ maintenu en défense) : le joueur va au porteur, ou à la balle, au trot plein et plus. */
function presser(m, j) {
  const b = m.balle, it = j.int;
  const cx = b.p.x + b.v.x * 0.25 - j.p.x, cz = b.p.z + b.v.z * 0.25 - j.p.z, d = hypot(cx, cz);
  if (d < 0.5) return;
  it.dx = cx / d; it.dz = cz / d;
  it.allure = 1; it.sprint = Math.max(it.sprint, d > 3 ? 0.6 : 0.25);
}

/** Copie l'intention d'un humain sur le joueur qu'il joue (les actions sont consommées une fois). */
function copierIntention(j, src) {
  const it = j.int;
  it.dx = src.dx ?? 0; it.dz = src.dz ?? 0;
  const L = hypot(it.dx, it.dz);
  if (L > 1e-6) { it.dx /= L; it.dz /= L; }
  it.allure = clamp(src.allure ?? 0, 0, 1); it.sprint = clamp(src.sprint ?? 0, 0, 1);
  it.regard = src.regard ?? null; it.contenir = !!src.contenir; it.protege = !!src.protege; it.charge = !!src.charge; it.vaBalle = true;
  it.action = src.action ?? null;
}

/** Exécute l'action demandée par l'intention (passe, frappe, tacle, roulette). */
function agir(m, j) {
  const a = j.int.action;
  if (!a) return;
  j.int.action = null;
  const p = porteur(m);
  if (a.type === 'tacle') { if (!p || p.e !== j.e) demanderTacle(m, j, !!a.glisse); return; }
  if (a.type === 'roulette') { roulette(m, j, a.dx ?? 1, a.dz ?? 0); return; }
  if (a.type === 'crochet') { crochet(m, j, a.dx ?? 1, a.dz ?? 0); return; }
  if (a.type === 'semelle') { semelle(m, j); return; }
  // une passe ou une frappe : il faut la balle à portée
  if (p && p.e !== j.e) return;
  if (demanderFrappe(m, j, a)) m.stats.demandes++;
}

/** La roulette : un pas de côté balle au pied, vers (dx, dz) ; le défenseur trop près reste planté un instant. */
function roulette(m, j, dx, dz) {
  if (!libre(j) || porteur(m) !== j) return;
  const s = hypot(j.v.x, j.v.z);
  // la roulette part en biais : moitié devant, moitié du côté demandé
  const fx = sin(j.cap), fz = cos(j.cap), L = hypot(dx, dz) || 1;
  j.cap = atan2(fx * 0.55 + (dx / L) * 0.85, fz * 0.55 + (dz / L) * 0.85);
  lancerGeste(j, 'roulette', { taux: 1.25, rm: true, echelle: clamp(Math.max(2.5, s) / 3.4, 0.7, 1.3), type: 'roulette', fin: 0.85 * 1.267 });
  j.intouchable = 0.75;
  for (const o of m.joueurs) if (o.e !== j.e && !o.gardien && !o.absent && hypot(o.p.x - j.p.x, o.p.z - j.p.z) < 2.6) { o.plante = 0.85; desequilibrer(m, o, 0.2); }
  m.ev('roulette', { j: j.i });
}

/**
 * Le crochet (stick droit, quart de tour) : le porteur pique la balle de l'extérieur du pied vers ce côté, de 45 à
 * 100° de sa course, freine et vire très court sur ses appuis (sim/corps.js, crochetT) ; le défenseur lancé devant
 * lui est pris à contre-pied un instant.
 */
function crochet(m, j, dx, dz) {
  const b = m.balle;
  if (!libre(j) || porteur(m) !== j || b.p.y > 0.4 || hypot(b.p.x - j.p.x, b.p.z - j.p.z) > 1.0) return;
  const L = hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  const fx = sin(j.cap), fz = cos(j.cap);
  const cote = Math.sign(fz * ux - fx * uz) || 1; // > 0 : à gauche du cap
  const ang = clamp(Math.acos(clamp(fx * ux + fz * uz, -1, 1)), (45 * Math.PI) / 180, (100 * Math.PI) / 180);
  const h = j.cap + cote * ang;
  const s = hypot(j.v.x, j.v.z);
  const vb = clamp(1.4 + 0.5 * s, 2.2, 4.2);
  b.v.x = sin(h) * vb; b.v.z = cos(h) * vb; b.v.y = 0;
  b.w.z = -b.v.x / BALLON.R; b.w.x = b.v.z / BALLON.R;
  b.dernier = j.i; b.dernierT = m.t; b.possesseur = j.i;
  j.toucheT = m.t;
  j.v.x *= 0.55; j.v.z *= 0.55;
  j.crochetH = h; j.crochetT = 0.32;
  for (const o of m.joueurs) {
    if (o.e === j.e || o.gardien || o.absent) continue;
    const rx = o.p.x - j.p.x, rz = o.p.z - j.p.z, d = hypot(rx, rz);
    if (d < 2.4 && rx * fx + rz * fz > 0) { o.plante = Math.max(o.plante, 0.45); desequilibrer(m, o, 0.12); }
  }
  m.ev('crochet', { j: j.i });
}

/** L'arrêt sur la semelle (R3) : la balle meurt sous le pied, le porteur s'arrête sur ses appuis. */
function semelle(m, j) {
  const b = m.balle;
  if (!libre(j) || porteur(m) !== j || b.p.y > 0.35 || hypot(b.p.x - j.p.x, b.p.z - j.p.z) > 1.0) return;
  const s = hypot(j.v.x, j.v.z);
  b.v.x = j.v.x * 0.25; b.v.z = j.v.z * 0.25;
  b.w.x *= 0.2; b.w.y *= 0.2; b.w.z *= 0.2;
  b.dernier = j.i; b.dernierT = m.t; b.possesseur = j.i;
  j.toucheT = m.t;
  lancerGeste(j, 'stop', { rm: true, echelle: clamp(s / 4, 0.3, 1.2), type: 'semelle', fin: 0.7 });
  m.ev('semelle', { j: j.i });
}

/** Pendant la roulette, la balle suit la semelle par petites touches. */
function pasRoulette(m, j) {
  const b = m.balle, g = j.g;
  if (!g || g.type !== 'roulette' || m.t - (j.toucheT ?? -9) < 0.18) return;
  const fx = sin(g.cap0), fz = cos(g.cap0);
  const cx = j.p.x + fx * 0.4, cz = j.p.z + fz * 0.4;
  if (hypot(b.p.x - cx, b.p.z - cz) > 0.9 || b.p.y > 0.4) return;
  j.toucheT = m.t;
  b.v.x = j.v.x + clamp((cx - b.p.x) * 3, -2, 2); b.v.z = j.v.z + clamp((cz - b.p.z) * 3, -2, 2);
  b.w.z = -b.v.x / BALLON.R; b.w.x = b.v.z / BALLON.R;
  b.dernier = j.i; b.dernierT = m.t; b.possesseur = j.i;
}

/**
 * La mêlée : un porteur coincé (contre un panneau ou un adversaire, presque à l'arrêt) avec un adversaire collé plus de
 * 2,5 s : la balle gicle entre les jambes, vers le large. C'est ce qui finit une balle bloquée contre un panneau.
 */
function melee(m) {
  const b = m.balle, p = porteur(m);
  let serre = false;
  if (p && hypot(p.v.x, p.v.z) < 0.5) for (const o of m.joueurs) if (!o.absent && o.e !== p.e && hypot(o.p.x - p.p.x, o.p.z - p.p.z) < 0.85) serre = true;
  m.meleeT = serre ? (m.meleeT ?? 0) + PAS : 0;
  if (m.meleeT > 2.5) {
    m.meleeT = 0;
    const r = m.rng.contacts;
    const L = hypot(b.p.x, b.p.z) || 1, a = (r.u() - 0.5) * 1.2;
    const dx = -b.p.x / L, dz = -b.p.z / L;
    const s = 2.5 + r.u() * 1.5;
    b.v.x = (dx * cos(a) + dz * sin(a)) * s; b.v.z = (-dx * sin(a) + dz * cos(a)) * s; b.v.y = 0.8;
    b.possesseur = null; b.dernier = null; b.dernierT = m.t;
    m.stats.antiBlocages++;
    m.ev('melee', {});
  }
}

function borner(j) {
  const lim = 0.35;
  if (j.p.x > BX - lim) { j.p.x = BX - lim; if (j.v.x > 0) j.v.x = 0; }
  if (j.p.x < -BX + lim) { j.p.x = -BX + lim; if (j.v.x < 0) j.v.x = 0; }
  if (j.p.z > BZ - lim) { j.p.z = BZ - lim; if (j.v.z > 0) j.v.z = 0; }
  if (j.p.z < -BZ + lim) { j.p.z = -BZ + lim; if (j.v.z < 0) j.v.z = 0; }
}

/** Un pas de simulation. entrees : [intention | null, intention | null] pour les humains des deux équipes. */
export function pas(m, entrees = null) {
  m.t += PAS; m.pas++;
  const b = m.balle;
  if (m.phase === 'attente') return;
  if (m.phase === 'intro' || m.phase === 'engagement') {
    m.phaseT -= PAS;
    for (const j of m.joueurs) { intentionVide(j.int); j.int.regard = b.p; pasCorps(j, PAS, false); }
    if (m.phaseT <= 0) m.phase = 'jeu';
    return;
  }
  if (m.phase === 'but' || m.phase === 'fin') {
    for (const j of m.joueurs) { intentionVide(j.int); j.int.regard = b.p; pasCorps(j, PAS, false); borner(j); }
    pasBalle(b, null);
    if (m.phase === 'but') {
      const avant = m.phaseT;
      m.phaseT -= PAS;
      if (avant > JEU.butPause - 0.35 && m.phaseT <= JEU.butPause - 0.35 && m.buteur != null) {
        const j = m.joueurs[m.buteur];
        const nom = m.humains[j.e] ? m.rng.fetes.choix(['victory', 'fist_pump', 'cheering']) : 'fist_pump';
        lancerGeste(j, nom, { type: 'fete', fin: 1e9 });
        m.ev('fete', { j: j.i, nom });
      }
      if (m.phaseT <= 0) {
        if (m.reste <= 0) fin(m);
        else { engagement(m, 1 - m.butEquipe); m.phase = 'engagement'; m.phaseT = JEU.engagement; m.ev('engagement', {}); }
      }
    }
    return;
  }

  // ── le jeu ──
  for (const e of [0, 1]) {
    const src = m.humains[e] ? entrees?.[e] : null;
    m.renfort[e] = !!src?.renfort; m.sortie[e] = !!src?.sortie;
    if (src?.changer) changerJoueur(m, e, src.changer === true ? null : src.changer);
  }
  majControle(m);
  for (const j of m.joueurs) {
    const e = j.e;
    if (j.absent) continue;
    if (j.gardien) pasGardien(m, j);
    else if (m.humains[e] && m.controle[e] === j.i && entrees?.[e]) {
      copierIntention(j, entrees[e]);
      const p = porteur(m);
      if (entrees[e].presse && (!p || p.e !== e)) presser(m, j);
      if (p === j && !j.int.protege) conduire(m, j, j.int);
      j.aide = m.aides[e];
    } else { pasIA(m, j); j.aide = 0; }
  }
  for (const j of m.joueurs) if (!j.absent) { agir(m, j); pasDemande(m, j); }
  const p = porteur(m);
  for (let i = 0; i < m.joueurs.length; i++) {
    const j = m.joueurs[i];
    if (j.absent) continue;
    m._phases[i] = j.phase;
    if (j.gardien && pasCorpsGardien(j, PAS)) { borner(j); continue; }
    pasCorps(j, PAS, p === j);
    if (j.g?.type === 'frappe') pasFrappe(m, j, PAS);
    if (j.g?.type === 'tacle' || j.g?.type === 'tacleDebout') pasTacle(m, j);
    if (j.g?.type === 'roulette') pasRoulette(m, j);
  }
  pasCorpsACorps(m, PAS);
  for (const j of m.joueurs) if (!j.absent) borner(j);

  // ── la balle ──
  if (b.garde != null) tenirBalle(m);
  else {
    const q = porteur(m);
    // (une passe ou une frappe demandée : plus de touche de conduite, le joueur va à la balle pour la frapper)
    if (q && !q.demande) {
      const i = q.i, a = m._phases[i], c = q.phase;
      const appui = Math.floor(a * 2) !== Math.floor(c * 2);
      pasConduite(m, q, appui);
    }
    // les autres : le plus proche d'abord
    let touche = false;
    for (let n = 0; n < 2 && !touche; n++) {
      let best = null, bd = Infinity;
      for (const j of m.joueurs) {
        if (j === q || j.gardien || j.absent) continue;
        const d = hypot(j.p.x - b.p.x, j.p.z - b.p.z);
        if (d < bd) { bd = d; best = j; }
      }
      if (best && bd < 1) touche = pasControle(m, best);
      break;
    }
    const p0 = m._p0; p0.x = b.p.x; p0.y = b.p.y; p0.z = b.p.z;
    const marque = pasBalle(b, (type, f) => { if (type === 'poteau') m.ev('poteau', { force: f }); else if (type === 'panneau' && f > 6) m.ev('panneau', { force: f }); });
    for (const k of m.joueurs) if (k.gardien && !k.absent && contactGardien(m, k, p0)) break;
    if (antiBlocage(b)) { m.stats.antiBlocages++; m.ev('relanceCoin', {}); }
    melee(m);
    if (marque >= 0) but(m, marque);
  }

  m.reste -= PAS;
  if (m.reste <= 0 && m.phase === 'jeu' && !b.tir) { m.reste = 0; fin(m); }
  if (m.reste < -6 && m.phase === 'jeu') { m.reste = 0; fin(m); }
}

function but(m, e) {
  if (m.phase !== 'jeu') return;
  m.score[e]++;
  m.stats.buts++;
  const b = m.balle;
  const d = b.dernier != null ? m.joueurs[b.dernier] : null;
  const tireur = d && d.e === e ? d : m.joueurs.find((j) => j.e === e && j.role === 'A');
  m.buteur = tireur.i; m.butEquipe = e;
  m.phase = 'but'; m.phaseT = JEU.butPause;
  b.tir = null; b.recepteur = null; b.possesseur = null;
  m.ev('but', { e, j: tireur.i });
}

function fin(m) {
  m.phase = 'fin';
  const gagne = m.score[0] > m.score[1] ? 0 : m.score[1] > m.score[0] ? 1 : -1;
  for (const j of m.joueurs) {
    j.v.x = 0; j.v.z = 0;
    if (j.gardien) { j.g = null; j.mode = 'loco'; continue; }
    if (j.e === gagne) lancerGeste(j, m.humains[j.e] && j.role === 'A' ? 'samba' : 'clapping', { type: 'fete', fin: 1e9 });
    else { j.g = null; j.mode = 'loco'; }
  }
  m.ev('fin', { gagne });
}

/** L'empreinte du monde : un hachage FNV-1a des nombres de l'état (positions, vitesses, caps, balle, score). */
export function empreinte(m) {
  const f = new Float64Array(1), u = new Uint32Array(f.buffer);
  let h = 2166136261 >>> 0;
  const mix = (x) => { f[0] = x; for (let k = 0; k < 2; k++) { h ^= u[k]; h = Math.imul(h, 16777619) >>> 0; } };
  for (const j of m.joueurs) { mix(j.p.x); mix(j.p.z); mix(j.v.x); mix(j.v.z); mix(j.cap); mix(j.d); mix(j.phase); }
  const b = m.balle;
  mix(b.p.x); mix(b.p.y); mix(b.p.z); mix(b.v.x); mix(b.v.y); mix(b.v.z); mix(b.w.x); mix(b.w.y); mix(b.w.z);
  mix(m.score[0]); mix(m.score[1]); mix(m.pas);
  return h.toString(16).padStart(8, '0');
}

export { PAS };
