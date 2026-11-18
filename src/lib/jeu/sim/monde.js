// Le match Bola en simulation pure (bola-app#23) : l'état complet et le pas fixe, sans three ni DOM.
//
// creerMonde({ graine, duree, humains }) → monde ; pas(monde, entrees) avance de PAS (1/120 s). Les entrées sont les
// intentions des humains, une par équipe (null = l'IA joue cette équipe). La page (match.js) enchaîne les pas avec un
// accumulateur et interpole l'affichage ; le banc (tools/jeu-banc.ts) appelle les mêmes pas sans navigateur. Même
// graine + mêmes entrées = même match, au bit près (empreinte).
//
// Les règles de Bola (un five en salle) : la balle ne sort jamais, elle rebondit sur les panneaux et les filets ; pas
// de touche, pas de corner, pas de hors-jeu ; après un but, l'équipe qui l'a pris engage au rond central. Les phases :
// attente, intro, engagement, jeu, but, fin.
//
// (bola-app#26, lot 2) Les fautes légères, avec l'avantage (JEU.fautes : RÈGLE À FAIRE VALIDER PAR SABRI) : une faute
// notée (contacts.js) laisse jouer ; si l'équipe fautée garde ou reprend la balle dans les 2,5 s, l'avantage joue
// (événement « avantage ») ; si l'équipe fautive la prend, ou si rien n'est venu, coup franc au point de la faute
// (pasArret : la balle posée, hors des surfaces, les adversaires reculent à 3 m, le joueur fauté, ou le plus proche
// debout, vient la jouer ; puis les adversaires restent à 3 m jusqu'à ce qu'elle soit jouée, 2,5 s au plus). La phase
// reste « jeu » (l'horloge tourne, comme en salle).
//
// Ce que les humains (pouce ou manettes, entrees/) ajoutent à l'intention d'un joueur : presse (aller au porteur),
// renfort (un coéquipier de l'IA presse aussi), sortie (le gardien sort), changer (prendre un autre joueur, au plus
// proche de la balle ou dans une direction), et les actions crochet et semelle en plus des passes, frappes, tacles et
// roulette. Pour l'IA, rien ne change : l'IA contre l'IA garde la même empreinte.
// (bola-app#26, lot 3) Les gestes du stick droit (entrees/geste-stick.js) : crochet (court aux gestes fins),
// feinte de corps, passement (double aux gestes fins), roulette, talonnade (de côté aux gestes fins), tirer en arrière
// (drag back), sombrero, petit pont, pousser (balle poussée devant), jonglage, feinte de frappe ; et le une-deux d'un
// humain (passe « appel » : le passeur repart, l'IA le fait courir ; passe « remise » : vers lui, lancée devant). Le
// joueur que tient un humain garde UNE action en file (j.file) : demandée pendant un geste, elle part au premier
// instant libre (ou dès 60 % d'un geste coupable : roulette, feinte, semelle, contrôle), au plus tard 0,9 s après ;
// c'est ce qui enchaîne crochet → roulette → frappe. L'IA n'a pas de file (son empreinte ne change pas).
//
// (bola-app#32, lot A) Les actions d'un humain portent leur `commande` (id de entrees/touches.js) et partent à
// l'appui, chargées (gestes.js) ; ○ sur une balle libre la prend (prendre : elle vient au pied à 1,2 m) ; un second appui
// de la frappe juste avant l'impact la rend parfaite (timing) ; un geste technique raté (deux à moins de 0,25 s, ou à
// pleine vitesse collé à un défenseur) coûte la balle ; le receveur d'une passe de son équipe vient au-devant, même tenu
// par un humain tant que son stick est au repos ; une balle libre lente vient au pied de l'IA la plus proche (1,2 m), et
// une passe au pied de son receveur. L'engagement est au joueur qui engage (balle aimantée tout de suite).
// Ordre d'un pas de jeu : main au bon joueur → intentions (humains, IA, gardiens) → gestes demandés → corps
// (locomotion, gestes à root motion ; un demi-tour balle au pied passe par le crochet) → frappes et tacles en cours →
// contacts entre corps → balle (conduite, contrôle, intégration, corps qui la bloquent, gardiens, but) → horloge.
// Pendant le but et la fin, les corps se démêlent aussi. Une intention NaN ou infinie est remise à zéro à l'entrée. Le monde publie la liste des événements du pas (ev) pour le rendu, le son et
// les vibrations ; la simulation n'en dépend pas.
import { PAS, JEU, ROLES, ENGAGEMENT, BX, BZ, LB, butDe, sens, BALLON, TERRAIN } from './constantes.js';
import { creerHasard } from './hasard.js';
import { creerCorps, pasCorps, libre, lancerGeste, finirGeste, clamp, impactDe, duree } from './corps.js';
import { creerBalle, pasBalle, antiBlocage, poserBalle } from './ballon.js';
import { pasConduite, pasControle, demanderFrappe, pasDemande, pasFrappe, porteur, pasAnticipation, estFrappe, gestePrise } from './gestes.js';
import { pasCorpsACorps, demanderTacle, pasTacle, desequilibrer, demeler, balleCorps } from './contacts.js';
import { pasGardien, pasCorpsGardien, contactGardien, tenirBalle } from './gardien.js';
import { pasIA, intentionVide, conduire, aller, contourner, auDevant } from './ia.js';
import { acos, atan2, cos, hypot, sin } from './maths.js';
import { exigerMesures, CLIPS } from './clips.js';

/**
 * Crée un match. humains : [bool, bool] (une équipe jouée par un humain) ; aides : [aide0, aide1] (1 = pouce,
 * 0,5 = manette, 0 = IA) ; journal : une fonction (type, ...valeurs) pour le banc.
 */
export function creerMonde({ graine = 1, duree = JEU.duree, humains = [true, false], aides = [1, 0], journal = null, presents = null } = {}) {
  // (les mesures des clips, public/jeu/anims/mesures.pak, doivent être chargées : sim/clips.js)
  exigerMesures();
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
    stats: { passes: 0, tirs: 0, tacles: 0, vols: 0, arrets: 0, buts: 0, epaules: 0, plongeons: 0, chutes: 0, antiBlocages: 0, demandes: 0, impacts: [],
      // (bola-app#26, lot 2)
      fautes: 0, avantages: 0, coupsFrancs: 0, tirages: 0, contresTacle: 0, uneDeux: 0, aeriens: 0, appels: 0 },
    avantage: null,           // une faute notée : l'arbitre regarde l'avantage (pasAvantage)
    arret: null,              // un coup franc : la balle posée, les adversaires à 3 m (pasArret)
    passes: [],               // les deux dernières passes { de, a, t } (une-deux)
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
  // (bola-app#32 : l'engagement est à lui tout de suite, balle aimantée au pied ; avant, dernierT = −9 la laissait libre)
  b.garde = null; b.dernier = porteurE.i; b.dernierT = m.t; b.possesseur = porteurE.i; b.recepteur = null; b.tir = null;
  for (const eq of [0, 1]) {
    if (!m.humains[eq]) { m.controle[eq] = null; continue; }
    m.controle[eq] = eq === e ? porteurE.i : m.joueurs.find((j) => j.e === eq && j.role === 'A').i;
  }
  m.buteur = null;
  m.avantage = null; m.arret = null; m.ecart = null; m.passes.length = 0;
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
const fini = (x) => (Number.isFinite(x) ? x : 0);
function copierIntention(j, src) {
  const it = j.int;
  // (une entrée folle, NaN ou infinie, ne doit jamais entrer dans la simulation : elle contaminerait les dix joueurs)
  it.dx = fini(src.dx); it.dz = fini(src.dz);
  const L = hypot(it.dx, it.dz);
  if (L > 1e-6 && Number.isFinite(L)) { it.dx /= L; it.dz /= L; } else { it.dx = 0; it.dz = 0; }
  it.allure = clamp(fini(src.allure), 0, 1); it.sprint = clamp(fini(src.sprint), 0, 1);
  it.recupere = false;
  it.regard = src.regard ?? null; it.contenir = !!src.contenir; it.protege = !!src.protege; it.charge = !!src.charge; it.vaBalle = true;
  it.tire = !!src.tire;
  // (bola-app#32, lot A) la charge en cours : touche tenue, puissance de la jauge, appui bref, côté du but visé
  it.tenir = !!src.tenir; it.bref = !!src.bref;
  it.puissance = Number.isFinite(src.puissance) ? clamp(src.puissance, 0, 1) : null;
  it.viseX = Number.isFinite(src.viseX) ? clamp(src.viseX, -2, 2) : null;
  it.action = src.action ?? null;
}

// (lot 3) les gestes du stick droit, et ce qui peut attendre en file pendant un geste
const GESTES = new Set(['roulette', 'crochet', 'semelle', 'feinte', 'passement', 'talonnade', 'sombrero', 'petitPont', 'pousser', 'tirerArriere', 'jongle', 'feinteFrappe']);
const COUPABLES = new Set(['roulette', 'feinte', 'semelle', 'controle', 'feinteFrappe']);
// (bola-app#32, lot A : une touche coupe un geste coupable dès 30 % au lieu de 60 % ; la réactivité avant la beauté du clip)
const COUPE = 0.3;
const enFile = (a) => GESTES.has(a.type) || a.type === 'passe' || a.type === 'lob' || a.type === 'profondeur' || a.type === 'centre' || estFrappe(a.type);

/** Exécute l'action demandée par l'intention (passe, frappe, tacle, gestes) ; celle d'un humain attend en file pendant un geste. */
function agir(m, j) {
  let a = j.int.action;
  const humain = m.humains[j.e] && m.controle[j.e] === j.i;
  if (!humain) j.file = null;
  if (!a && j.file) {
    const F = j.file;
    if (m.t - F.t > 0.9) j.file = null;
    else if (libre(j) || (j.mode === 'geste' && j.g && COUPABLES.has(j.g.type) && j.g.t >= COUPE * j.g.fin)) {
      if (!libre(j)) { finirGeste(j); j.recup = 0; }
      a = F.a; j.file = null;
      // (une frappe enchaînée sur un geste : frappée sur appuis, la balle est contre le pied, pas de course d'élan)
      if (estFrappe(a.type) || a.type === 'passe') a = { ...a, enchaine: true };
      m.ev('enchaine', { j: j.i, action: a.type });
    }
  }
  if (!a) return;
  j.int.action = null;
  const p = porteur(m);
  // (bola-app#32, lot A) une action d'humain porte sa commande (id de touches.js) et se charge : la simulation le sait
  if (humain && a.type !== 'tacle' && !a.humain) a = { ...a, humain: true };
  // (lot A) ○ / B sur une balle libre au sol : il va la chercher, elle vient au pied (aimantée) dans les 0,6 s
  if (a.type === 'prendre') { j.prendreT = m.t + 0.6; m.ev('prendre', { j: j.i }); return; }
  // (lot A, profondeur technique) le second appui de la frappe : parfait à 0,07 s de l'impact, sinon raté
  if (a.type === 'timing') { timing(m, j); return; }
  if (a.type === 'tacle') { if ((!p || p.e !== j.e) && m.ecart?.e !== j.e) demanderTacle(m, j, !!a.glisse); return; }
  // (la feinte de frappe annule l'élan d'une frappe déjà lancée : elle ne va pas en file derrière cette frappe)
  if (a.type === 'feinteFrappe' && (j.demande || (j.g && j.g.type === 'frappe' && !j.g.fait))) { feinteFrappe(m, j); return; }
  // (un humain balle au pied, dans un geste : l'action attend son tour)
  if (humain && !libre(j) && j.mode === 'geste' && enFile(a) && (p === j || p == null)) { j.file = { a, t: m.t }; return; }
  // (lot A, profondeur technique) un geste technique raté coûte la balle : deux gestes à moins de 0,25 s, ou un geste
  // lancé à pleine vitesse (plus de 6,8 m/s) avec un défenseur à moins de 1,5 m
  if (humain && GESTES.has(a.type) && a.type !== 'jongle' && a.type !== 'feinteFrappe' && p === j) {
    if (gesteRate(m, j)) return;
    j.gesteT = m.t;
  }
  if (a.type === 'roulette') { roulette(m, j, a.dx ?? 1, a.dz ?? 0); return; }
  if (a.type === 'crochet') { crochet(m, j, a.dx ?? 1, a.dz ?? 0, a.court ? 70 : 100); return; }
  if (a.type === 'semelle') { semelle(m, j); return; }
  if (a.type === 'feinte' || a.type === 'passement') { feinte(m, j, a.dx ?? 1, a.dz ?? 0, a.type, !!a.double); return; }
  if (a.type === 'talonnade') { talonnade(m, j, a.cote ?? 0); return; }
  if (a.type === 'sombrero') { sombrero(m, j); return; }
  if (a.type === 'petitPont') { petitPont(m, j); return; }
  if (a.type === 'pousser') { pousser(m, j, a.dx ?? sin(j.cap), a.dz ?? cos(j.cap)); return; }
  if (a.type === 'tirerArriere') { if (balleAuPied(m, j)) crochet(m, j, -sin(j.cap), -cos(j.cap), 170, 'tirerArriere'); return; }
  if (a.type === 'jongle') { jongler(m, j); return; }
  if (a.type === 'feinteFrappe') { feinteFrappe(m, j); return; }
  // une passe ou une frappe : il faut la balle à portée
  if (p && p.e !== j.e) return;
  // (le une-deux d'un humain : la remise vise le passeur, lancée devant lui)
  if (a.uneDeux === 'remise') {
    const der = m.passes[m.passes.length - 1];
    const X = der && der.a === j.i ? m.joueurs[der.de] : null;
    if (X && !X.absent) {
      const xx = X.p.x + X.v.x * 0.5, xz = X.p.z + X.v.z * 0.5, d = hypot(xx - m.balle.p.x, xz - m.balle.p.z);
      const v0 = Math.sqrt(5.5 * 5.5 + 2 * 1.35 * d);
      a = { ...a, cible: X.i, dx: xx - j.p.x, dz: xz - j.p.z, v0, p: clamp((v0 - 6) / 12, 0.2, 1) };
    }
  }
  if (demanderFrappe(m, j, a)) {
    m.stats.demandes++;
    if (a.uneDeux === 'appel') {
      // le passeur repart dans l'espace, devant, du côté opposé au défenseur le plus proche (l'IA le fait courir)
      let o = null, od = 9;
      for (const q of m.joueurs) if (q.e !== j.e && !q.gardien && !q.absent) { const d = hypot(q.p.x - j.p.x, q.p.z - j.p.z); if (d < od) { od = d; o = q; } }
      const s = sens(j.e), lat = o ? Math.sign(j.p.x - o.p.x || 1) : 1;
      j.uneDeux = { t: m.t, cible: null, x: clamp(j.p.x + lat * 1.6, -BX + 1.2, BX - 1.2), z: clamp(j.p.z + s * 5.5, -LB + 2, LB - 2) };
      m.ev('appelUneDeux', { j: j.i });
    }
  }
}

/**
 * (bola-app#32, lot A) Le second appui de la frappe (○ / B de nouveau, juste après le relâché) : à 0,07 s de l'impact
 * ou moins, la frappe est parfaite (gestes.js lancer : erreur divisée par 2,5) ; plus tôt, ou une fois la balle partie,
 * rien ; trop tôt pendant l'élan (plus de 0,15 s avant), elle est ratée (erreur × 1,6). Rien ne change sans second appui.
 */
function timing(m, j) {
  const g = j.g;
  if (!g || g.type !== 'frappe' || g.fait || !estFrappe(g.donnees?.spec?.type)) return;
  const spec = g.donnees.spec, avant = (g.impact - g.t) / g.taux;
  if (spec.timing) return;
  if (avant <= JEU.parfait) { spec.timing = 'parfait'; m.ev('frappeParfaite', { j: j.i }); }
  else if (avant > 0.15) spec.timing = 'rate';
}

/** (lot A) Le geste technique raté : la balle part trop long, à 2 à 3 m, à ±40° de la course ; il ne l'a plus. */
function gesteRate(m, j) {
  const s = hypot(j.v.x, j.v.z);
  let colle = false;
  for (const o of m.joueurs) if (o.e !== j.e && !o.absent && !o.gardien && o.mode !== 'sol' && hypot(o.p.x - j.p.x, o.p.z - j.p.z) < 1.5) colle = true;
  const spam = m.t - (j.gesteT ?? -9) < 0.25;
  if (!spam && !(s > 6.8 && colle)) return false;
  const b = m.balle, r = m.rng.touches;
  const h = (s > 0.5 ? atan2(j.v.x, j.v.z) : j.cap) + (r.u() * 2 - 1) * 0.7, v = s + 3 + r.u() * 1.5;
  b.v.x = sin(h) * v; b.v.z = cos(h) * v; b.v.y = 0;
  b.w.z = -b.v.x / BALLON.R; b.w.x = b.v.z / BALLON.R;
  b.possesseur = null; b.recepteur = null; b.dernier = j.i; b.dernierT = m.t;
  j.recup = Math.max(j.recup, 0.35); j.gesteT = m.t;
  m.ev('gesteRate', { j: j.i, spam });
  return true;
}

/**
 * La roulette : un pas de côté balle au pied, vers (dx, dz) ; le défenseur trop près reste planté un instant. Le corps
 * tourne du côté demandé : vers la gauche, soccer_spin (« roulette ») ; vers la droite, son miroir (« roulette_l »,
 * la roulette inversée, aeriea). (Contrôle du 15/11 : tourner à l'envers du côté où l'on part, drapeau inverse du stick,
 * met le pied qui tire dans la balle, 6 cm de pénétration : le drapeau reste sans effet, comme avant.)
 */
function roulette(m, j, dx, dz) {
  if (!libre(j) || porteur(m) !== j) return;
  const s = hypot(j.v.x, j.v.z);
  // la roulette part en biais : moitié devant, moitié du côté demandé
  const fx = sin(j.cap), fz = cos(j.cap), L = hypot(dx, dz) || 1;
  const gauche = (fz * dx - fx * dz) / L > 0;
  j.cap = atan2(fx * 0.55 + (dx / L) * 0.85, fz * 0.55 + (dz / L) * 0.85);
  lancerGeste(j, gauche || !CLIPS.roulette_l ? 'roulette' : 'roulette_l', { taux: 1.25, rm: true, echelle: clamp(Math.max(2.5, s) / 3.4, 0.7, 1.3), type: 'roulette', fin: 0.85 * 1.267 });
  j.intouchable = 0.75;
  for (const o of m.joueurs) if (o.e !== j.e && !o.gardien && !o.absent && hypot(o.p.x - j.p.x, o.p.z - j.p.z) < 2.6) { o.plante = 0.85; desequilibrer(m, o, 0.2); }
  m.ev('roulette', { j: j.i });
}

/**
 * Le crochet (stick droit, quart de tour) : le porteur pique la balle de l'extérieur du pied vers ce côté, de 45 à
 * 100° de sa course, freine et vire très court sur ses appuis (sim/corps.js, crochetT) ; le défenseur lancé devant
 * lui est pris à contre-pied un instant.
 */
function crochet(m, j, dx, dz, angMax = 100, nomEv = 'crochet') {
  const b = m.balle;
  if (!libre(j) || porteur(m) !== j || b.p.y > 0.4 || hypot(b.p.x - j.p.x, b.p.z - j.p.z) > 1.0) return;
  const L = hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  const fx = sin(j.cap), fz = cos(j.cap);
  const cote = Math.sign(fz * ux - fx * uz) || 1; // > 0 : à gauche du cap
  const ang = clamp(acos(clamp(fx * ux + fz * uz, -1, 1)), (45 * Math.PI) / 180, (angMax * Math.PI) / 180);
  const h = j.cap + cote * ang;
  const s = hypot(j.v.x, j.v.z);
  const vb = clamp(1.4 + 0.5 * s, 2.2, 4.2);
  b.v.x = sin(h) * vb; b.v.z = cos(h) * vb; b.v.y = 0;
  b.w.z = -b.v.x / BALLON.R; b.w.x = b.v.z / BALLON.R;
  b.dernier = j.i; b.dernierT = m.t; b.possesseur = j.i;
  j.toucheT = m.t;
  j.v.x *= 0.55; j.v.z *= 0.55;
  j.crochetH = h; j.crochetT = 0.32; j.horsAimant = m.t + 0.22;
  for (const o of m.joueurs) {
    if (o.e === j.e || o.gardien || o.absent) continue;
    const rx = o.p.x - j.p.x, rz = o.p.z - j.p.z, d = hypot(rx, rz);
    if (d < 2.4 && rx * fx + rz * fz > 0) { o.plante = Math.max(o.plante, 0.45); desequilibrer(m, o, 0.12); }
  }
  m.ev(nomEv, { j: j.i });
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

// ── les gestes techniques balle au pied (bola-app#26) : le lot 3 les branche sur le stick droit ──
/** Les adversaires près du porteur et face à lui : ceux qu'un geste peut tromper. */
function trompes(m, j, rayon) {
  const fx = sin(j.cap), fz = cos(j.cap), out = [];
  for (const o of m.joueurs) {
    if (o.e === j.e || o.gardien || o.absent || o.mode !== 'loco') continue;
    const rx = o.p.x - j.p.x, rz = o.p.z - j.p.z, d = hypot(rx, rz);
    if (d < rayon && rx * fx + rz * fz > 0.2 * d) out.push(o);
  }
  return out;
}
const balleAuPied = (m, j, d = 1.0) => libre(j) && porteur(m) === j && m.balle.p.y < 0.4 && hypot(m.balle.p.x - j.p.x, m.balle.p.z - j.p.z) < d;

/**
 * La feinte (de corps, à l'arrêt : standing_dodge, gauche ou droite) ou le passement de jambes (en course : le pied
 * fait le tour de la balle, couche du rendu) : la balle n'est pas touchée ; un défenseur à moins de 2 m, face au
 * porteur, part du mauvais côté (déséquilibre vers ce côté, planté 0,4 s).
 */
function feinte(m, j, dx, dz, type, double = false) {
  if (!balleAuPied(m, j, 1.3)) return;
  const fx = sin(j.cap), fz = cos(j.cap);
  const cote = Math.sign(fz * dx - fx * dz) || 1; // > 0 : vers la gauche du porteur
  const s = hypot(j.v.x, j.v.z);
  if (type === 'feinte' && s < 2.5 && CLIPS.feint_r) {
    // (standing_dodge_right esquive vers la droite du joueur ; le miroir, vers la gauche)
    lancerGeste(j, cote > 0 ? 'feint_l' : 'feint_r', { taux: 1.5, type: 'feinte', fin: 0.62 });
  } else j.figure = { type: 'passement', t0: m.t, duree: double ? 0.8 : 0.42, cote, double };
  // (le double passement : le défenseur part deux fois, plus longtemps planté)
  for (const o of trompes(m, j, 2)) {
    o.plante = Math.max(o.plante, double ? 0.6 : 0.4);
    desequilibrer(m, o, double ? 0.24 : 0.18, { x: cote * fz, z: -cote * fx });
  }
  m.ev(type === 'feinte' && s < 2.5 ? 'feinte' : 'passement', { j: j.i, cote, double });
}

/**
 * La talonnade : la balle part vers l'arrière, de 3 à 6 m, du talon (couche du rendu : le pied part en arrière) ; de
 * côté (cote = 1 à gauche, -1 à droite, aux gestes fins), à 35° de l'arrière.
 */
function talonnade(m, j, cote = 0) {
  if (!balleAuPied(m, j)) return;
  const b = m.balle, s = hypot(j.v.x, j.v.z);
  const h = j.cap + Math.PI - cote * (35 * Math.PI) / 180, fx = -sin(h), fz = -cos(h);
  const v = 3.2 + 0.25 * s;
  b.v.x = -fx * v + j.v.x * 0.2; b.v.z = -fz * v + j.v.z * 0.2; b.v.y = 0;
  b.w.z = -b.v.x / BALLON.R; b.w.x = b.v.z / BALLON.R;
  b.dernier = j.i; b.dernierT = m.t; b.possesseur = null; b.recepteur = null; b.tir = null;
  j.toucheT = m.t; j.recup = 0.35;
  j.figure = { type: 'talon', t0: m.t, duree: 0.34, cote };
  m.ev('talonnade', { j: j.i, cote });
}

/**
 * Le sombrero : la balle levée au-dessus du défenseur (2 à 2,3 m au sommet), devant le porteur. À l'arrêt, le clip
 * kick_up_soccerball (le pied glisse sous la balle et la lève) ; en course, la pointe du pied la lève (couche du rendu).
 */
function sombrero(m, j) {
  if (!balleAuPied(m, j)) return;
  const s = hypot(j.v.x, j.v.z);
  if (s < 2.2 && CLIPS.kickup) {
    const b = m.balle, fx = sin(j.cap), fz = cos(j.cap);
    const gauche = (b.p.x - j.p.x) * fz - (b.p.z - j.p.z) * fx > 0;
    const nom = (CLIPS.kickup.piedImpact?.pied === 'g') === gauche ? 'kickup' : 'kickup_l';
    lancerGeste(j, nom, { taux: 1.7, type: 'sombrero', depuis: Math.max(0, impactDe(nom) - 0.3) / duree(nom), fin: impactDe(nom) + 0.25, donnees: {} });
  } else { leverBalle(m, j); j.figure = { type: 'sombrero', t0: m.t, duree: 0.3, cote: 0 }; }
}
function leverBalle(m, j) {
  const b = m.balle, fx = sin(j.cap), fz = cos(j.cap), s = hypot(j.v.x, j.v.z);
  const vy = 6.2 + m.rng.touches.u() * 0.4, vh = Math.max(1.8, s * 0.9 + 0.6);
  b.v.x = fx * vh; b.v.z = fz * vh; b.v.y = vy; b.w.x = b.w.y = b.w.z = 0;
  b.dernier = j.i; b.dernierT = m.t; b.possesseur = j.i;
  j.toucheT = m.t; j.horsAimant = m.t + 0.3;
  // (le défenseur pris de vitesse : planté, et trop tard pour la reprendre de la tête pendant 0,6 s)
  for (const o of trompes(m, j, 3)) { o.plante = Math.max(o.plante, 0.35); o.recup = Math.max(o.recup, 0.6); }
  m.ev('sombrero', { j: j.i });
}
/** Pendant le sombrero à l'arrêt : la balle part à l'impact du clip. */
function pasSombrero(m, j) {
  const g = j.g;
  if (!g || g.type !== 'sombrero' || g.fait || g.t < g.impact) return;
  g.fait = true;
  if (porteur(m) === j && m.balle.p.y < 0.5) leverBalle(m, j);
}

/**
 * Le petit pont : la balle glissée entre les jambes du défenseur le plus proche devant (à moins de 1,4 m). Elle
 * passe si ses pieds sont écartés (foulée entre deux appuis, ou pas chassé) : ses jambes ne la bloquent pas pendant
 * 0,35 s ; sinon, elle les heurte (contacts.js, balleCorps).
 */
function petitPont(m, j) {
  if (!balleAuPied(m, j)) return;
  const [o] = trompes(m, j, 1.4).sort((a, c) => hypot(a.p.x - j.p.x, a.p.z - j.p.z) - hypot(c.p.x - j.p.x, c.p.z - j.p.z));
  if (!o) return;
  const b = m.balle, rx = o.p.x - b.p.x, rz = o.p.z - b.p.z, L = hypot(rx, rz) || 1;
  const v = 5.5 + hypot(j.v.x, j.v.z) * 0.5;
  b.v.x = (rx / L) * v; b.v.z = (rz / L) * v; b.v.y = 0;
  b.w.z = -b.v.x / BALLON.R; b.w.x = b.v.z / BALLON.R;
  b.dernier = j.i; b.dernierT = m.t; b.possesseur = null; b.tir = null; b.recepteur = null;
  j.toucheT = m.t;
  const u = (o.phase * 2) % 1, ecartes = hypot(o.v.x, o.v.z) < 0.6 ? (o.int?.contenir ?? false) : u > 0.2 && u < 0.8;
  if (ecartes) { o.ouvertT = m.t + 0.35; o.plante = Math.max(o.plante, 0.5); }
  m.ev('petitPont', { j: j.i, o: o.i, passe: ecartes });
}

/**
 * (lot 3) Pousser la balle (coup sec avant, sans défenseur collé) : une touche longue devant, 4,5 à 9,5 m/s selon la
 * course, pour la reprendre lancé ; la main reste au porteur (receveur de sa propre touche).
 */
function pousser(m, j, dx, dz) {
  if (!balleAuPied(m, j)) return;
  const b = m.balle, s = hypot(j.v.x, j.v.z), L = hypot(dx, dz) || 1;
  const v = clamp(s + 3.2, 4.5, 9.5);
  b.v.x = (dx / L) * v; b.v.z = (dz / L) * v; b.v.y = 0;
  b.w.z = -b.v.x / BALLON.R; b.w.x = b.v.z / BALLON.R;
  b.dernier = j.i; b.dernierT = m.t; b.possesseur = null; b.tir = null; b.recepteur = j.i;
  j.toucheT = m.t;
  m.ev('pousser', { j: j.i });
}

/**
 * (lot 3) Le jonglage sur place (LB + RB tenus, à l'arrêt) : le pied glisse sous la balle et la relève (kick_up),
 * à 0,6 m ; elle retombe sur le pied (le contrôle la reprend, pied levé), et le geste recommence tant que c'est tenu.
 */
function jongler(m, j) {
  if (!balleAuPied(m, j, 0.9) || hypot(j.v.x, j.v.z) > 1.5 || !CLIPS.kickup || m.balle.v.y > 0.5 || m.balle.p.y > 0.3) return;
  const b = m.balle, fx = sin(j.cap), fz = cos(j.cap);
  const gauche = (b.p.x - j.p.x) * fz - (b.p.z - j.p.z) * fx > 0;
  const nom = (CLIPS.kickup.piedImpact?.pied === 'g') === gauche ? 'kickup' : 'kickup_l';
  lancerGeste(j, nom, { taux: 1.7, type: 'jongle', depuis: Math.max(0, impactDe(nom) - 0.3) / duree(nom), fin: impactDe(nom) + 0.25, donnees: {} });
}
function pasJongle(m, j) {
  const g = j.g;
  if (!g || g.type !== 'jongle' || g.fait || g.t < g.impact) return;
  g.fait = true;
  const b = m.balle;
  if (porteur(m) !== j || b.p.y > 0.5 || b.v.y > 1) return;
  // (la balle remonte au-dessus du pied, un peu devant : elle retombe dans sa portée)
  const fx = sin(j.cap), fz = cos(j.cap);
  b.v.x = j.v.x * 0.3 + fx * 0.25 + (j.p.x + fx * 0.3 - b.p.x) * 0.8; b.v.z = j.v.z * 0.3 + fz * 0.25 + (j.p.z + fz * 0.3 - b.p.z) * 0.8;
  b.v.y = 3.4; b.w.x = b.w.y = b.w.z = 0;
  b.dernier = j.i; b.dernierT = m.t; b.possesseur = j.i;
  j.toucheT = m.t; j.horsAimant = m.t + 0.3;
  m.ev('jongle', { j: j.i });
}

/**
 * (lot 3) La feinte de frappe (X puis A avant l'impact) : la frappe demandée est annulée ; l'élan part et s'arrête
 * juste avant la balle (la jambe passe au-dessus), et le défenseur devant, ou le gardien proche, part pour la frappe.
 */
function feinteFrappe(m, j) {
  const g = j.g;
  if (j.demande) j.demande = null;
  if (g && g.type === 'frappe' && !g.fait && g.t < g.impact - 0.02) {
    // l'élan déjà lancé : il finit avant l'impact, la balle n'est pas frappée
    g.fait = true; g.type = 'feinteFrappe'; g.fin = Math.min(g.fin, g.impact - 0.02);
    // (bola-app#32 : une frappe chargée tenue armée repart, pour finir son élan sans frapper)
    g.gel = false; g.charge = false; j.vise = null;
  } else {
    if (!balleAuPied(m, j, 1.2)) return;
    const b = m.balle, fx = sin(j.cap), fz = cos(j.cap), s = hypot(j.v.x, j.v.z);
    const gauche = (b.p.x - j.p.x) * fz - (b.p.z - j.p.z) * fx > 0.08;
    // (aeriea) en course, le grand armé de la frappe en course (strike_foward_jog : la pointe monte à 0,5 m et recule
    // de 0,6 m derrière, de 0,20 à 0,30 s) ; arrêté, l'élan court de kick_soccerball. Dans les deux cas le joueur freine
    // (×0,6) et le clip est joué sur place : avec son root motion, la fente du clip le lançait à 7 m/s, il dépassait la
    // balle et posait le pied d'appui dessus (contrôle du 15/11)
    const course = s > 2.2 && CLIPS.strike_run && CLIPS.strike_run_l;
    const nom = course ? (gauche ? 'strike_run_l' : 'strike_run') : gauche && CLIPS.shoot_l ? 'shoot_l' : 'shoot';
    if (!CLIPS[nom]) return;
    const imp = impactDe(nom);
    if (course) lancerGeste(j, nom, { taux: clamp(imp / 0.26, 0.8, 2.4), type: 'feinteFrappe', depuis: 0.05 / duree(nom), fin: imp - 0.03 });
    else lancerGeste(j, nom, { taux: clamp(imp / 0.22, 0.8, 2.4), type: 'feinteFrappe', depuis: Math.max(0, imp - 0.32) / duree(nom), fin: imp - 0.03 });
    j.v.x *= 0.6; j.v.z *= 0.6;
  }
  for (const o of trompes(m, j, 3)) { o.plante = Math.max(o.plante, 0.5); desequilibrer(m, o, 0.16); }
  m.ev('feinteFrappe', { j: j.i });
}

// (bola-app#32, lot A) l'ancien demi-tour balle au pied (aller chercher la balle qui file, puis un crochet de 170°) est
// retiré : la balle aimantée (gestes.js pasConduite) tourne autour du joueur et repart dans le nouveau sens avant lui.

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

// ── les fautes, l'avantage, le coup franc (bola-app#26, lot 2) ──
/**
 * L'arbitre regarde l'avantage d'une faute notée (m.avantage) : l'équipe fautive prend la balle (passé 0,25 s) →
 * coup franc ; au bout de 2,5 s (JEU.avantage), l'équipe fautée a la balle (ou l'a touchée en dernier, ou a frappé) →
 * l'avantage a joué ; sinon coup franc.
 */
function pasAvantage(m) {
  const A = m.avantage;
  if (!A) return;
  const b = m.balle, p = porteur(m), age = m.t - A.t0;
  const eqDe = (i) => (i != null ? m.joueurs[i].e : -1);
  const fautive = 1 - A.e;
  const aEux = (p && p.e === fautive) || eqDe(b.garde) === fautive;
  const aNous = (p && p.e === A.e) || eqDe(b.garde) === A.e || b.tir?.e === A.e;
  if (aEux && age > 0.25) { coupFranc(m, A); return; }
  if (b.tir?.e === A.e || age >= JEU.avantage) {
    if (aNous || (b.possesseur == null && eqDe(b.dernier) === A.e)) { m.avantage = null; m.stats.avantages++; m.ev('avantage', { e: A.e, x: A.x, z: A.z }); }
    else coupFranc(m, A);
  }
}

/** Le point d'un coup franc : sur le terrain, à 1,5 m des panneaux de côté et des lignes de but (de la place pour reculer), hors des deux surfaces (pas de penalty en Bola). */
function pointCoupFranc(x, z) {
  x = clamp(x, -BX + 1.5, BX - 1.5); z = clamp(z, -LB + 1.5, LB - 1.5);
  for (const s of [-1, 1]) {
    const zb = s * LB, rx = x, rz = z - zb, d = hypot(rx, rz), lim = TERRAIN.surface + 0.6;
    if (d < lim) { const L = d || 1; x = (rx / L) * lim; z = zb + (rz / L) * lim; if (Math.abs(z) > LB - 1.5) z = Math.sign(z) * (LB - 1.5); }
  }
  return { x, z };
}

/** Siffle un coup franc pour l'équipe A.e au point de la faute. */
function coupFranc(m, A) {
  m.avantage = null;
  const b = m.balle;
  let pt = pointCoupFranc(A.x, A.z);
  // (correctifs #26) pas sous un corps au sol : la balle était posée sur le bassin du joueur fauté, encore couché ;
  // elle va à côté de lui (à 0,7 m de son corps, couché le long de son cap sur 0,8 m de part et d'autre des hanches)
  for (let passe = 0; passe < 3; passe++) {
    let bouge = false;
    for (const j of m.joueurs) {
      if (j.absent || (j.mode !== 'sol' && j.mode !== 'releve')) continue;
      const ux = sin(j.cap), uz = cos(j.cap);
      const u = clamp((pt.x - j.p.x) * ux + (pt.z - j.p.z) * uz, -0.8, 0.8);
      const qx = j.p.x + ux * u, qz = j.p.z + uz * u, dx = pt.x - qx, dz = pt.z - qz, d = hypot(dx, dz);
      if (d >= 0.7) continue;
      const nx = d > 1e-3 ? dx / d : uz, nz = d > 1e-3 ? dz / d : -ux;
      pt = pointCoupFranc(qx + nx * 0.75, qz + nz * 0.75); bouge = true;
    }
    if (!bouge) break;
  }
  // le joueur fauté s'il est debout, sinon le coéquipier debout le plus proche du point
  const debout = (j) => !j.absent && !j.gardien && j.mode !== 'sol' && j.mode !== 'releve';
  let tireur = debout(m.joueurs[A.victime]) ? m.joueurs[A.victime] : null;
  if (!tireur) { let bd = Infinity; for (const j of m.joueurs) if (j.e === A.e && debout(j)) { const d = hypot(j.p.x - pt.x, j.p.z - pt.z); if (d < bd) { bd = d; tireur = j; } } }
  if (!tireur) tireur = m.joueurs[A.victime];
  for (const j of m.joueurs) { j.demande = null; j.file = null; if (j.tireCible != null) { j.tireCible = null; j.tireT = 0; } }
  poserBalle(b, pt.x, pt.z);
  b.garde = null; b.tir = null; b.recepteur = null; b.possesseur = tireur.i; b.dernier = tireur.i; b.dernierT = m.t;
  m.arret = { t: JEU.coupFranc.pause, age: 0, x: pt.x, z: pt.z, e: A.e, tireur: tireur.i };
  m.stats.coupsFrancs++;
  m.ev('coupFranc', { e: A.e, j: tireur.i, x: pt.x, z: pt.z });
}

/**
 * Pendant le coup franc : la balle reste posée ; le tireur vient derrière elle, les adversaires reculent à 3 m, les
 * coéquipiers se placent (IA), les gardiens restent dans leur but. Fin : la pause passée, le tireur à la balle et les adversaires à 3 m (4,5 s au
 * plus, 6 s si un adversaire n'est pas encore à 2,4 m) ; ensuite les adversaires restent à 3 m (tenirEcart) tant qu'elle n'est pas jouée.
 */
function pasArret(m) {
  const A = m.arret, b = m.balle, dist = JEU.coupFranc.distance;
  A.t -= PAS; A.age += PAS;
  poserBalle(b, A.x, A.z);
  b.possesseur = A.tireur; b.dernier = A.tireur; b.dernierT = m.t;
  const T = m.joueurs[A.tireur];
  const zb = butDe(1 - A.e), ux = -A.x, uz = zb - A.z, L = hypot(ux, uz) || 1;
  for (const j of m.joueurs) {
    if (j.absent) continue;
    const it = intentionVide(j.int);
    it.regard = b.p;
    if (j.gardien) { pasGardien(m, j); continue; }
    if (j === T) { aller(j, it, A.x - (ux / L) * 0.5, A.z - (uz / L) * 0.5, 4); continue; }
    const d = hypot(j.p.x - A.x, j.p.z - A.z);
    if (j.e !== A.e) {
      if (d < dist + 0.3) {
        // (bola-app#32 : le point de recul est gardé 0,6 s ; recalculé à chaque pas, il sautait d'un côté à l'autre pour
        // quelques millimètres et le joueur, plus vif, oscillait sur place)
        if (!j.recul || j.recul.arret !== A || m.t > j.recul.t + 0.6) j.recul = { ...pointRecul(m, j, A.x, A.z, dist + 0.6), t: m.t, arret: A };
        const q = j.recul; aller(j, it, q.x, q.z, 5); contourner(m, j, it);
        // (bola-app#32 : il recule face à la balle, en pas chassés ; avec les demi-tours rapides du lot A, un recul qui
        // hésitait enchaînait les pivots sur place, collé à 1,5 m de la balle jusqu'à la reprise forcée de 6 s)
        it.contenir = true; it.regard = b.p;
        // (correctifs #26) collé au tireur qui vient à la balle (contre un panneau, ils se poussaient 5 s) : il
        // s'efface sur le côté de son chemin, tant que le tireur n'est pas à la balle
        const tx = A.x - T.p.x, tz = A.z - T.p.z, TL = hypot(tx, tz) || 1;
        if (hypot(j.p.x - T.p.x, j.p.z - T.p.z) < 1.1 && hypot(T.p.x - A.x, T.p.z - A.z) > 1.0) {
          const cote = Math.sign((j.p.x - T.p.x) * tz - (j.p.z - T.p.z) * tx) || 1;
          let sx = (tz / TL) * cote, sz = (-tx / TL) * cote;
          // (pas vers un panneau : de l'autre côté du chemin)
          if (Math.abs(j.p.x + sx) > BX - 0.5 || Math.abs(j.p.z + sz) > BZ - 0.5) { sx = -sx; sz = -sz; }
          // (sans oublier de reculer : le pas de côté s'ajoute au recul)
          const rx = (it.dx ?? 0) + sx * 1.2, rz = (it.dz ?? 0) + sz * 1.2, RL = hypot(rx, rz) || 1;
          it.dx = rx / RL; it.dz = rz / RL; it.allure = Math.max(it.allure ?? 0, 0.8);
        }
      }
      continue;
    }
    pasIA(m, j);
    j.int.action = null;
  }
  for (const j of m.joueurs) {
    if (j.absent) continue;
    if (j.gardien && pasCorpsGardien(j, PAS)) { borner(j); continue; }
    pasCorps(j, PAS, false);
  }
  pasCorpsACorps(m, PAS);
  for (const j of m.joueurs) if (!j.absent) borner(j);
  m.reste -= PAS;
  // (prêt : le tireur à la balle, et les adversaires debout à 3 m, à 0,3 m près)
  const loin = m.joueurs.every((o) => o.absent || o.gardien || o.e === A.e || o.mode === 'sol' || o.mode === 'releve' || hypot(o.p.x - A.x, o.p.z - A.z) >= dist - 0.3);
  const pret = hypot(T.p.x - A.x, T.p.z - A.z) < 1.0 && T.mode === 'loco' && loin;
  // (correctifs #26 : passé 4,5 s, la reprise attend encore que les adversaires soient à 2,4 m au moins, 6 s au plus ;
  // un fautif relevé tard sur le point du coup franc restait à 1,2 m de la balle)
  const presque = m.joueurs.every((o) => o.absent || o.gardien || o.e === A.e || hypot(o.p.x - A.x, o.p.z - A.z) >= dist - 0.6);
  if ((A.t <= 0 && pret) || (A.age > 4.5 && presque) || A.age > 6) {
    m.arret = null;
    m.ecart = { e: 1 - A.e, x: A.x, z: A.z, tireur: A.tireur, fin: m.t + JEU.coupFranc.garde };
    T.decision = 0.05;
    m.ev('reprise', { e: A.e, j: A.tireur });
  }
}

/**
 * Où reculer pour être à dist de la balle (bx, bz) : dans l'axe balle → joueur, ou, si un panneau est derrière lui ou
 * qu'un autre corps barre le chemin, en tournant autour de la balle (par pas de 30°) jusqu'à un point libre.
 */
function pointRecul(m, j, bx, bz, dist) {
  let ux = j.p.x - bx, uz = j.p.z - bz; const L = hypot(ux, uz);
  if (L < 1e-6) { ux = -Math.sign(bx || 1); uz = 0; } else { ux /= L; uz /= L; }
  // (correctifs #26 : sans chemin libre, le point dont le chemin passe le plus loin des autres corps, et non le
  // premier venu : collé au tireur contre un panneau, il le poussait au lieu de le contourner)
  let repli = null, repliMarge = -1;
  for (let k = 0; k < 12; k++) {
    const a = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 6), c = cos(a), sn = sin(a);
    const dx = ux * c + uz * sn, dz = -ux * sn + uz * c;
    const x = bx + dx * dist, z = bz + dz * dist;
    if (!(Math.abs(x) < BX - 0.6 && Math.abs(z) < BZ - 0.6)) continue;
    // (le chemin du joueur à ce point : aucun autre corps à moins de 0,7 m)
    const ex = x - j.p.x, ez = z - j.p.z, E = ex * ex + ez * ez || 1;
    let marge = Infinity;
    for (const o of m.joueurs) {
      if (o === j || o.absent) continue;
      const u = clamp(((o.p.x - j.p.x) * ex + (o.p.z - j.p.z) * ez) / E, 0, 1);
      marge = Math.min(marge, hypot(o.p.x - j.p.x - ex * u, o.p.z - j.p.z - ez * u));
    }
    if (marge >= 0.7) return { x, z };
    if (marge > repliMarge) { repliMarge = marge; repli = { x, z }; }
  }
  return repli ?? { x: bx + ux * dist, z: bz + uz * dist };
}

/** Après le coup franc : les adversaires restent à 3 m de la balle tant qu'elle n'est pas jouée (2,5 s au plus). */
function tenirEcart(m) {
  const E = m.ecart, b = m.balle;
  if (m.t > E.fin || b.dernier !== E.tireur || hypot(b.p.x - E.x, b.p.z - E.z) > 0.8 || hypot(b.v.x, b.v.z) > 1.5) { m.ecart = null; return; }
  const dist = JEU.coupFranc.distance;
  for (const j of m.joueurs) {
    if (j.absent || j.gardien || j.e !== E.e) continue;
    const d = hypot(j.p.x - b.p.x, j.p.z - b.p.z);
    j.int.action = null; j.int.tire = false; j.int.charge = false;
    if (d < dist + 0.2) {
      // (bola-app#32 : même point de recul gardé 0,6 s qu'au coup franc)
      if (!j.recul || j.recul.arret !== E || m.t > j.recul.t + 0.6) j.recul = { ...pointRecul(m, j, b.p.x, b.p.z, dist + 0.5), t: m.t, arret: E };
      const it = j.int, q = j.recul; aller(j, it, q.x, q.z, 4); contourner(m, j, it); it.regard = b.p; it.vaBalle = false;
    }
  }
}

function borner(j) {
  const lim = 0.35;
  if (j.p.x > BX - lim) { j.p.x = BX - lim; if (j.v.x > 0) j.v.x = 0; }
  if (j.p.x < -BX + lim) { j.p.x = -BX + lim; if (j.v.x < 0) j.v.x = 0; }
  if (j.p.z > BZ - lim) { j.p.z = BZ - lim; if (j.v.z > 0) j.v.z = 0; }
  if (j.p.z < -BZ + lim) { j.p.z = -BZ + lim; if (j.v.z < 0) j.v.z = 0; }
}

/**
 * (bola-app#26, lot 4) Chaque choc du ballon (sol, panneau, filet, poteau), avec sa place et sa vitesse : pour la vue
 * seulement (le son, le filet qui bouge). Rien de la simulation n'en dépend : l'empreinte ne change pas. Au plus un
 * événement de chaque genre tous les 30 ms (un ballon qui roule contre le filet n'en fait pas cent).
 */
function chocBalle(m, genre, f) {
  const d = (m._chocs ??= {});
  if (m.t - (d[genre] ?? -1) < 0.03) return;
  d[genre] = m.t;
  const b = m.balle;
  m.ev('balleChoc', { genre, f, x: b.p.x, y: b.p.y, z: b.p.z, vx: b.v.x, vy: b.v.y, vz: b.v.z });
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
    for (const j of m.joueurs) { intentionVide(j.int); j.int.regard = b.p; pasCorps(j, PAS, false); }
    // (pendant le ralenti du but et la fin, les corps se démêlent aussi : personne ne se fond dans un autre)
    demeler(m);
    for (const j of m.joueurs) borner(j);
    pasBalle(b, (type, f) => chocBalle(m, type, f));
    balleCorps(m);
    if (m.phase === 'but') {
      const avant = m.phaseT;
      m.phaseT -= PAS;
      if (avant > JEU.butPause - 0.35 && m.phaseT <= JEU.butPause - 0.35 && m.buteur != null) {
        const j = m.joueurs[m.buteur];
        // (bola-app#26 : quatre célébrations de plus ; la glissade de joie part avec son élan, root motion)
        const nom = m.humains[j.e] ? m.rng.fetes.choix(['victory', 'fist_pump', 'cheering', 'c_chest', 'c_slide']) : m.rng.fetes.choix(['fist_pump', 'c_chest']);
        const glisse = nom === 'c_slide' && !!CLIPS.c_slide;
        lancerGeste(j, nom, { type: 'fete', fin: glisse ? duree(nom) : 1e9, rm: glisse, echelle: 0.85 });
        m.ev('fete', { j: j.i, nom });
        // le coéquipier le plus proche vient applaudir (pouce levé)
        let q = null, dq = 9;
        for (const o of m.joueurs) if (o.e === j.e && o !== j && !o.gardien && !o.absent) { const d = hypot(o.p.x - j.p.x, o.p.z - j.p.z); if (d < dq) { dq = d; q = o; } }
        // (correctifs #26 : seulement s'il est debout et libre ; au sol, il se retrouvait debout d'un coup)
        if (q && q.mode === 'loco') lancerGeste(q, 'c_thumbs', { type: 'fete', fin: 1e9, depuis: 0.05 });
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
  // (bola-app#26, lot 2) un coup franc : la balle posée, chacun se place, puis le jeu reprend
  if (m.arret) { pasArret(m); return; }
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
      // (bola-app#32, lot A) ○ sur une balle libre : il va la chercher (elle vient au pied à 1,2 m, plus bas) ; (lot A2) il
      // ralentit en arrivant, pour l'amorti du pied (gestes.js gestePrise)
      if (!p && j.prendreT > m.t && b.garde == null && b.p.y < 0.6) {
        const dx = b.p.x + b.v.x * 0.15 - j.p.x, dz = b.p.z + b.v.z * 0.15 - j.p.z, d = hypot(dx, dz);
        if (d < JEU.aimant.prendre && d > 1e-6) { j.int.dx = dx / d; j.int.dz = dz / d; j.int.allure = clamp(d / 1.6, 0.45, 1); j.int.sprint = Math.max(j.int.sprint, d > 1.8 ? 0.5 : 0); }
      }
      // (lot A) le receveur d'une passe de son équipe vient au-devant de la balle, comme sur console, tant que le stick
      // est au repos (le joueur reprend la main en le poussant)
      if (!p && b.recepteur === j.i && (entrees[e].allure ?? 0) < 0.25) {
        const r = auDevant(m, j);
        if (r) { aller(j, j.int, r.x, r.z, 7); j.int.regard = b.p; j.int.vaBalle = true; }
      }
      j.aide = m.aides[e];
    } else { pasIA(m, j); j.aide = 0; }
  }
  if (m.ecart) tenirEcart(m);
  for (const j of m.joueurs) if (!j.absent) { agir(m, j); pasDemande(m, j); pasAnticipation(m, j); }
  const p = porteur(m);
  for (let i = 0; i < m.joueurs.length; i++) {
    const j = m.joueurs[i];
    if (j.absent) continue;
    m._phases[i] = j.phase;
    if (j.gardien && pasCorpsGardien(j, PAS)) { borner(j); continue; }
    pasCorps(j, PAS, p === j);
    if (j.g?.type === 'frappe') pasFrappe(m, j, PAS);
    if (j.vise && !j.demande && !(j.g?.type === 'frappe' && !j.g.fait)) j.vise = null;
    if (j.g?.type === 'tacle' || j.g?.type === 'tacleDebout') pasTacle(m, j);
    if (j.g?.type === 'roulette') pasRoulette(m, j);
    if (j.g?.type === 'sombrero') pasSombrero(m, j);
    if (j.g?.type === 'jongle') pasJongle(m, j);
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
    // (bola-app#32, lot A) la balle libre au sol, lente (moins de 4 m/s, pas une passe en route) : elle vient au pied du
    // joueur de l'IA le plus proche à 1,2 m (prise automatique), ou de l'humain qui a appuyé sur ○ (6 m/s au plus) ; et
    // la passe vient au pied de son receveur, humain ou IA, qui est venu au-devant (10 m/s au plus) : elle arrive
    let touche = false;
    if (!q && b.p.y < 0.45 && b.garde == null) {
      const vb = hypot(b.v.x, b.v.z);
      let best = null, bd = JEU.aimant.prise;
      for (const j of m.joueurs) {
        if (j.gardien || j.absent || !libre(j)) continue;
        const hum = m.humains[j.e] && m.controle[j.e] === j.i;
        const pourLui = b.recepteur === j.i && vb < 10;
        if (!pourLui && (hum ? !(j.prendreT > m.t && vb < 6) : !(vb < 4 && b.recepteur == null))) continue;
        const d = hypot(j.p.x - b.p.x, j.p.z - b.p.z);
        if (d < bd) { bd = d; best = j; }
      }
      if (best) {
        // (lot A2) la prise sur ○ d'un humain se voit : l'amorti du pied (gestes.js gestePrise)
        const priseHumaine = m.humains[best.e] && m.controle[best.e] === best.i && best.prendreT > m.t;
        touche = pasControle(m, best, false, true);
        if (touche) { best.prendreT = 0; if (priseHumaine) gestePrise(m, best); }
      }
    }
    // les autres : le plus proche d'abord
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
    const marque = pasBalle(b, (type, f) => { if (type === 'poteau') m.ev('poteau', { force: f }); else if (type === 'panneau' && f > 6) m.ev('panneau', { force: f }); chocBalle(m, type, f); });
    // personne n'est traversé : jambes, buste, corps au sol (contacts.js)
    balleCorps(m);
    for (const k of m.joueurs) if (k.gardien && !k.absent && contactGardien(m, k, p0)) break;
    if (antiBlocage(b)) { m.stats.antiBlocages++; m.ev('relanceCoin', {}); }
    melee(m);
    if (marque >= 0) but(m, marque);
  }
  if (m.phase === 'jeu') pasAvantage(m);

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
  m.avantage = null; m.ecart = null;
  m.ev('but', { e, j: tireur.i });
}

function fin(m) {
  m.phase = 'fin';
  const gagne = m.score[0] > m.score[1] ? 0 : m.score[1] > m.score[0] ? 1 : -1;
  for (const j of m.joueurs) {
    // (correctifs #26 : les corps freinent sur leurs appuis, pasCorps de la phase « fin », au lieu de s'arrêter net :
    // la vitesse à 0 d'un coup faisait sauter la pose de course à l'arrêt, 91° à l'avant-bras en 1/60 s)
    if (j.gardien) { j.v.x = 0; j.v.z = 0; j.g = null; j.mode = 'loco'; continue; }
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
