// Bola, le jeu : « Cinq contre cinq » sur le plateau BOLA (Sabri, 03/11/2026 : « le plateau Bola avec un gameplay de
// 5 contre 5, à fond »). Les Noirs contre les Blancs, quatre joueurs et un gardien de chaque côté, un match minuté.
// Vertical, au pouce, dans le bas de l'écran (pouce.js).
//
// Depuis bola-app#23 (« jeu plus réaliste », 14/11/2026), ce fichier n'est plus que la VUE : le match lui-même est une
// simulation pure à pas fixe (sim/monde.js : corps, contacts, ballon, gestes, gardiens, IA), sans three ni DOM, la même
// que joue le banc node (tools/jeu-banc.ts). Ici : la scène, les personnages, la boucle à accumulateur (sim/boucle.js,
// pas de 1/120 s, rendu interpolé : rien ne dépend des images par seconde), l'animation calée sur la simulation
// (rendu/animateur.js), la caméra, le tableau, les vibrations et le banc d'essai (_test).
//
// Les manettes (bola-app#23, entrees/manettes.js et entrees/commande.js) : lues une fois par image, avant les pas.
// Une manette rangée chez les Noirs ou les Blancs joue cette équipe ; une équipe sans manette est jouée par l'IA, sauf
// les Noirs que joue le pouce (toujours sans manette ; avec des manettes, seulement sur un vrai geste de jeu, et
// rendus à l'IA après 2 s sans geste). Le partage est relu
// à chaque image : une manette débranchée rend son équipe à l'IA au pas suivant, sans pause. Les gardiens restent à
// l'IA. Menu / Options (ou Échap, P au clavier) met le match en pause ; un toucher sur le voile la lève, et elle se lève
// d'elle-même si plus aucune manette d'équipe n'est branchée. Les vibrations suivent les événements de la simulation (frappe, tacle,
// chute, épaule, poteau, but). Sous le joueur de chaque humain, un anneau : blanc pour les Noirs, noir cerclé de blanc
// pour les Blancs ; la jauge de puissance s'y remplit pendant qu'on charge une passe ou une frappe.
//
// Les règles de Bola (un five en salle) : la balle ne sort jamais, elle rebondit sur les panneaux et les filets ; pas
// de touche, pas de corner, pas de hors-jeu ; après un but, l'équipe qui l'a pris engage au rond central.
//
// La caméra est celle de la télé (Sabri 03/11 : « vision sur le côté, même vue caméra que dans FIFA ») : en hauteur
// dans la tribune, le long du terrain ; les Noirs attaquent vers la droite de l'écran. Elle suit la balle par un
// filtre doux, sans secousse ; une frappe fait reculer le cadre pour tenir la balle et le but visé (et 0,6 s après la
// ligne) ; au téléphone, le panneau proche reste au-dessus de la zone du pouce quand la balle s'en approche.
//
// Le clavier (bola-app#26, lot 3, entrees/clavier.js) est une manette faite de touches, lue par la même commande que
// les manettes, pour les Noirs : il les prend quand c'est lui qui a servi en dernier (avant le pouce), et, dans un
// match lancé avec des manettes, tant qu'une touche de jeu est tenue ou l'a été dans les 2 s. Le tableau des touches
// est dans entrees/touches.js.
//
// Ce que fait chaque geste du pouce (on joue toujours les Noirs) ; il produit la même intention qu'une manette :
//   glisser          courir dans cette direction ; loin du point de départ, sprinter (analogique de 85 à 100 % du rayon).
//                    Balle au pied, tu la conduis par touches : elle n'est plus collée au pied.
//   toucher          avec la balle : la passe (puissance moyenne), vers le partenaire dans la direction où tu cours ;
//                    sans la balle, près du porteur adverse : le tacle debout
//   coup sec vers la droite avec la balle : la frappe, vers le côté du but que montre le geste, aussi forte que le geste est vif
//   coup sec vers le haut ou le bas avec la balle : la roulette, de ce côté ; sans la balle, vers le porteur : le tacle glissé
//   second doigt     (lot 3) le stick droit des gestes techniques, comme à la manette (entrees/geste-stick.js) ;
//                    touché sans bouger : la semelle
// Comme à la manette, tu joues le porteur ; en défense, la main passe au Noir le plus près de la balle. Celui que tu
// joues porte un anneau blanc au pied.
//
// Le décor est le plateau BOLA (plateau.js, celui des vidéos) en qualité « jeu ». Le plateau a son grand axe en x ;
// le jeu, lui, compte en (x = largeur, z = longueur) : tout le match vit dans un groupe tourné d'un quart de tour
// (monde), si bien que le but attaqué par les Noirs (z = -15) est le but ouest du plateau, côté mur BOLA.
//
// Les joueurs : les dix sont le footballeur Mixamo choisi par Sabri (03/11), en tenue noire ou blanche, avec son
// propre visage. Les animations sont celles de la bibliothèque Mixamo de Sabri (.pak, personnage.js). Rien n'est
// enregistré.
import * as THREE from 'three';
import { creerPlateau, DIM } from './plateau.js';
import { creerPersonnage } from './personnage.js';
import { creerPouce } from './pouce.js';
import { creerAnimateur } from './rendu/animateur.js';
import { etatAnim } from './rendu/etat.js';
import { creerMonde, demarrer as demarrerMonde, empreinte } from './sim/monde.js';
import { creerBoucle, avancer, avancerPas, joueurInterpole, balleInterpolee } from './sim/boucle.js';
import { PAS, BALLON, JEU, butDe } from './sim/constantes.js';
import { porteur } from './sim/gestes.js';
import { SCENARIOS } from './sim/scenarios.js';
import { chargerMesuresUrl } from './sim/clips.js';
import { changerHumains } from './sim/monde.js';
import { creerManettes, EFFETS } from './entrees/manettes.js';
import { creerCommande, lireManette, intentionDe, oublier } from './entrees/commande.js';
import { creerClavier, creerEtatClavier, etatDepuisTouches } from './entrees/clavier.js';
import { creerLecteur, oublierLecteur, lireGesteStick } from './entrees/geste-stick.js';

const R = BALLON.R;
const PX = DIM.Tl / 2 - R;
const clamp = THREE.MathUtils.clamp;
const vibrer = (m) => { try { if (document.visibilityState === 'visible') navigator.vibrate?.(m); } catch {} };

function creerBallon() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2ef'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#121212';
  for (let k = 0; k < 2; k++) {
    g.beginPath();
    for (let x = 0; x <= 256; x += 4) { const y = 64 + Math.sin((x / 256) * Math.PI * 4 + k * Math.PI) * 26; if (x === 0) g.moveTo(x, y - 9); else g.lineTo(x, y - 9); }
    for (let x = 256; x >= 0; x -= 4) g.lineTo(x, 64 + Math.sin((x / 256) * Math.PI * 4 + k * Math.PI) * 26 + 9);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), new THREE.MeshStandardMaterial({ map: t, roughness: 0.45 }));
}

// l'ombre douce sous chaque joueur (les ombres du plateau sont calculées une fois, sans les joueurs)
function texOmbre() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}


/**
 * Lance le jeu dans conteneur. Renvoie { demarrer(), detruire(), _test }.
 * @param {HTMLElement} conteneur
 * @param {{ photo?: string | null, surEtat?: (etat: any) => void, reduit?: boolean, duree?: number, surProgres?: (p: number) => void, surSalon?: () => void, surDemarrer?: () => void, surTouches?: (marque: string) => void }} [options]
 *   photo : ta photo du studio ; surEtat : le tableau (HUD) ; reduit : « Réduire les animations » ; duree : en secondes ;
 *   surSalon : une manette demande l'écran Manettes (A / ✕ ou Menu avant le match) ; surDemarrer : Menu / Options
 *   dans l'écran Manettes.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function creerMatch(conteneur, { photo = null, surEtat = () => {}, reduit = false, duree = 150, surProgres = () => {}, surSalon = () => {}, surDemarrer = () => {}, surTouches = () => {} } = {}) {
  const pr = Math.min(window.devicePixelRatio || 1, 1.5);
  let echelle = 1; // la définition adaptative
  const dims = () => {
    const w = conteneur.clientWidth || 1, h = conteneur.clientHeight || 1;
    return [w, h, Math.max(1, Math.round(w * pr * echelle)), Math.max(1, Math.round(h * pr * echelle))];
  };
  let [cw, ch, W, H] = dims();
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  Object.assign(renderer.domElement.style, { display: 'block', position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none' });
  conteneur.appendChild(renderer.domElement);

  // les mesures des clips (sim/clips.js, mesures.pak) : avant le monde et les animateurs, en même temps que le plateau
  const mesures = chargerMesuresUrl();
  const pl = await creerPlateau(renderer, { qualite: Math.min(cw, ch) >= 600 ? 'jeuPlein' : 'jeuTel', base: '/jeu/plateau/', largeur: W, hauteur: H });
  await mesures;
  surProgres(0.4);
  if (pl.lyres && reduit) pl.lyres.visible = false;
  // le halo seulement sur les vraies sources (projecteurs, LED) : pas sur un col blanc ou le ballon sous les projecteurs
  if (pl.bloom) pl.bloom.threshold = 2.4;
  const camera = pl.camera;
  // le grillage du côté de la caméra (le côté nord du plateau) masquerait le bas du terrain : on n'en garde que les
  // panneaux LED, comme la caméra de la télé qui filme par-dessus
  const coteCamera = pl.emplacements.panneauxN?.ancre?.parent;
  if (coteCamera) for (const o of coteCamera.children) if (o.position.y > DIM.panneau) o.visible = false;
  const monde = new THREE.Group();
  monde.rotation.y = Math.PI / 2; // jeu (x, z) → plateau (z, -x)
  pl.scene.add(monde);
  const versMonde = (v, out) => out.set(v.z, v.y, -v.x);

  // le tableau d'affichage sur les quatre faces du cube suspendu
  const ecran = document.createElement('canvas'); ecran.width = 1024; ecran.height = 576;
  let policeEcran = 'system-ui, sans-serif';
  try {
    const f = new FontFace('BolaAnton', 'url(/jeu/plateau/anton-latin.woff2)');
    await f.load(); document.fonts.add(f); policeEcran = 'BolaAnton, system-ui, sans-serif';
  } catch {}
  const facesCube = ['ecranN', 'ecranS', 'ecranE', 'ecranO'].map((k) => pl.emplacements[k]).filter(Boolean);
  for (const e of facesCube) e.poser(ecran);
  let ecranTexte = '';
  function peindreEcran(texte, noirs, blancs, horloge) {
    if (texte === ecranTexte) return;
    ecranTexte = texte;
    const g = ecran.getContext('2d');
    g.fillStyle = '#050505'; g.fillRect(0, 0, 1024, 576);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#f2f2f2';
    g.font = `260px ${policeEcran}`;
    g.fillText(`${noirs}`, 300, 290); g.fillText(`${blancs}`, 724, 290);
    g.fillRect(482, 282, 60, 16);
    g.font = `64px ${policeEcran}`;
    g.fillStyle = '#9a9a9a';
    g.fillText('NOIRS', 300, 96); g.fillText('BLANCS', 724, 96);
    g.fillStyle = '#f2f2f2';
    g.fillText(horloge, 512, 492);
    for (const e of facesCube) if (e.texture) e.texture.needsUpdate = true;
  }


  // ── les joueurs (l'état de jeu est dans la simulation ; ici, leur corps à l'écran) ──
  const tomber = texOmbre();
  const matOmbre = new THREE.MeshBasicMaterial({ map: tomber, transparent: true, depthWrite: false, opacity: 1 });
  const geoOmbre = new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2);
  const ROLES = ['G', 'D', 'L', 'R', 'A'];
  const specs = [];
  for (const e of [0, 1]) for (const role of ROLES) specs.push({ e, role });
  let charges = 0;
  const vus = await Promise.all(specs.map(async ({ e, role }) => {
    // tous les joueurs sont le footballeur de Sabri, en tenue de leur camp ; sa propre tête, pas la grosse tête photo
    // (les têtes 3D des joueurs viendront après, avec leur accord)
    const perso = await creerPersonnage({
      modele: 'footballeur', tenue: e === 0 ? 'noirs' : 'blancs', tete: null, peau: null,
      // (bola-app#26 : player2, keeper2, celeb2, les clips de tools/jeu-anims.mjs)
      packs: role === 'G' ? ['keeper', 'keeper2', 'celeb', 'celeb2'] : ['player', 'player2', 'celeb', 'celeb2'],
    });
    perso.racine.traverse((o) => { o.castShadow = false; });
    surProgres(0.4 + (++charges / specs.length) * 0.55);
    const ombre = new THREE.Mesh(geoOmbre, matOmbre);
    ombre.renderOrder = 2;
    monde.add(perso.racine, ombre);
    const anim = creerAnimateur(perso, { gardien: role === 'G', reduit, versMonde3: (v, out) => versMondeDir(v, out) });
    return { e, role, perso, ombre, anim, interp: { x: 0, z: 0, cap: 0 }, prec: { x: 0, z: 0 }, cache: {} };
  }));
  // les ombres du décor, une fois pour toutes, avant que les joueurs ne bougent
  pl.majOmbres();

  const balle = creerBallon();
  const ombreBalle = new THREE.Mesh(geoOmbre, matOmbre);
  ombreBalle.scale.setScalar(0.35);
  ombreBalle.renderOrder = 2;
  monde.add(balle, ombreBalle);

  // l'anneau sous le joueur que tu joues
  const anneau = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.5, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
  );
  anneau.renderOrder = 3;
  monde.add(anneau);
  // celui des Blancs : noir cerclé de blanc, pour qu'il se voie sur le gazon
  const anneauB = new THREE.Group();
  {
    const mat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
    const a = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 48).rotateX(-Math.PI / 2), mat(0x050505));
    const b1 = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.53, 48).rotateX(-Math.PI / 2), mat(0xffffff));
    const b2 = new THREE.Mesh(new THREE.RingGeometry(0.39, 0.42, 48).rotateX(-Math.PI / 2), mat(0xffffff));
    for (const o of [a, b1, b2]) { o.renderOrder = 3; anneauB.add(o); }
  }
  anneauB.visible = false;
  monde.add(anneauB);
  // la jauge de puissance : un arc qui se remplit autour de l'anneau (une par équipe)
  const jauges = [0, 1].map((e) => {
    const g = new THREE.RingGeometry(0.55, 0.62, 48, 1, Math.PI / 2, -Math.PI * 2).rotateX(-Math.PI / 2);
    const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: e === 0 ? 0xffffff : 0xf2f2f2, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
    o.renderOrder = 3; o.visible = false; monde.add(o);
    return o;
  });

  const pouce = creerPouce(renderer.domElement);
  // l'écran vu de la tribune : la droite de l'écran = vers le but attaqué par les Noirs (-z), le haut = vers -x
  const ecranVersJeu = (sx, sy) => ({ x: -sy, z: -sx });
  const jeuVersEcran = (gx, gz) => ({ sx: -gz, sy: -gx });
  const manettes = creerManettes({ versJeu: ecranVersJeu });
  // le clavier : une manette de touches, pour les Noirs ; le second doigt du pouce : le stick droit
  const clavier = creerClavier();
  const cmdClavier = creerCommande(), etatClavier = creerEtatClavier();
  const lecteurPouce = creerLecteur();
  manettes.surSalon = () => surSalon();
  manettes.surDemarrer = () => surDemarrer();
  manettes.surTouches = (marque) => surTouches(marque);
  let pause = false, pauseManette = false;
  const poserPause = (v, parManette = false) => { if (v === pause) return; if (v && !(m().phase === 'jeu' || m().phase === 'engagement')) return; pause = v; pauseManette = v && parManette; etat.pause = pause; signaler(); };
  manettes.surPause = () => poserPause(!pause, true);
  // au clavier : Échap ou P met en pause et reprend (sans manette, rien d'autre ne le pourrait)
  const clavierPause = (e) => { if (e.repeat) return; if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') poserPause(!pause); };
  addEventListener('keydown', clavierPause);
  let avecManettes = false; // le match a commencé avec au moins une manette dans une équipe

  // ── la simulation ──
  const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
  let graine = Number(params?.get('graine')) || ((Date.now() >>> 0) % 100000) + 1;
  let monde0 = creerMonde({ graine, duree, humains: [true, false], aides: [1, 0] });
  let boucleSim = creerBoucle(monde0);
  const m = () => boucleSim.m;
  // banc d'essai : l'IA joue aussi les Noirs (auto), le rendu peut être coupé ; pas = secondes de simulation par image
  const banc = { auto: false, rendu: true, pas: 0, stats: monde0.stats };
  const etat = { phase: 'attente', noirs: 0, blancs: 0, reste: duree, message: null, buteur: null, pause: false, manettes: false };
  const MOI = 4; // l'attaquant des Noirs
  const signaler = () => surEtat({ ...etat });
  let ralenti = 1, ralentiFin = 0;
  const cam = { pos: new THREE.Vector3(0, 8.5, 12), regard: new THREE.Vector3(0, 0, 0), foyer: new THREE.Vector3(), buteur: null, recul: 0 };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), w = new THREE.Vector3();
  const qBalle = new THREE.Quaternion(), axeB = new THREE.Vector3();
  const bInterp = { x: 0, y: R, z: 0 };
  let derniereSeconde = -1;
  let scene = null; // un scénario de capture en cours (sim/scenarios.js)

  // ── le pouce → l'intention des Noirs ──
  const entree = { dx: 0, dz: 0, allure: 0, sprint: 0, action: null, regard: null, contenir: false, protege: false, charge: false };
  let actionPouce = null;
  function lireEntree() {
    const st = pouce.stick, amp = Math.min(1, Math.hypot(st.x, st.y));
    if (amp > 0.3) pouce.vu = performance.now();
    const g = ecranVersJeu(st.x / (amp || 1), st.y / (amp || 1));
    entree.dx = amp > 0.05 ? g.x : 0; entree.dz = amp > 0.05 ? g.z : 0;
    entree.allure = amp > 0.05 ? Math.min(1, amp / 0.85) : 0;
    entree.sprint = amp > 0.85 ? (amp - 0.85) / 0.15 : 0;
    entree.regard = m().balle.p;
    // le second doigt : le stick droit des gestes (le même lecteur que la manette)
    const M = m(), jc = M.joueurs[M.controle[0] ?? MOI];
    if (pouce.geste.actif || lecteurPouce.actif) {
      const a = lireGesteStick(lecteurPouce, pouce.geste.x, pouce.geste.y, performance.now() / 1000, M, jc, ecranVersJeu);
      if (a && porteur(M) === jc && !actionPouce) actionPouce = a;
    }
    entree.action = actionPouce; actionPouce = null;
    entree.changer = changerPouce; changerPouce = null;
    return entree;
  }
  let changerPouce = null;
  const entrees = [null, null];
  /**
   * Qui joue quoi : une manette par équipe, sinon le pouce pour les Noirs, sinon l'IA. Dans un match lancé avec des
   * manettes, le pouce ne prend les Noirs que sur un vrai geste de jeu (pas un clic pour rendre le focus), et les
   * rend à l'IA après 2 s sans geste : jamais un Noir planté jusqu'à la fin.
   */
  const pouceJoue = () => !avecManettes || (pouce.utilise && performance.now() - pouce.vu < 2000);
  const clavierTenu = () => { for (const k of clavier.tenues) if (k !== 'shift') return true; return false; };
  const clavierJoue = () => clavier.utilise && clavier.vu >= pouce.vu && (!avecManettes || clavierTenu() || performance.now() - clavier.vu < 2000);
  /** Le clavier : une lecture par image, comme une manette (seulement pendant le jeu, sans manette chez les Noirs). */
  function lireClavier(t) {
    if (m().phase !== 'jeu' || manettes.equipes()[0] || !clavier.utilise || pause) { if (cmdClavier.vu) oublier(cmdClavier); return; }
    const jc = m().controle[0] != null ? m().joueurs[m().controle[0]] : null;
    etatDepuisTouches(clavier.tenues, t, etatClavier, jc?.cap ?? null, jeuVersEcran);
    lireManette(cmdClavier, etatClavier, t, m(), 0, ecranVersJeu);
  }
  function lireEntrees() {
    if (scene) return scene.entrees(m());
    if (banc.auto || m().phase !== 'jeu') { entrees[0] = null; entrees[1] = null; return entrees; }
    const eq = manettes.equipes();
    entrees[0] = eq[0] ? manettes.intention(0) : clavierJoue() ? intentionDe(cmdClavier) : pouceJoue() ? lireEntree() : null;
    entrees[1] = eq[1] ? manettes.intention(1) : null;
    return entrees;
  }
  const humainsVoulus = [true, false], aidesVoulues = [1, 0];
  /** Relu à chaque image : une manette branchée, débranchée, rejointe, et le monde suit au pas suivant. */
  function majHumains() {
    const M = m();
    if (banc.auto || scene) return;
    const eq = manettes.equipes();
    humainsVoulus[0] = !!eq[0] || clavierJoue() || pouceJoue(); humainsVoulus[1] = !!eq[1];
    aidesVoulues[0] = eq[0] ? 0.5 : 1; aidesVoulues[1] = eq[1] ? 0.5 : 0;
    if (M.humains[0] !== humainsVoulus[0] || M.humains[1] !== humainsVoulus[1] || M.aides[0] !== aidesVoulues[0] || M.aides[1] !== aidesVoulues[1]) changerHumains(M, humainsVoulus, aidesVoulues);
  }
  pouce.surTouche = () => {
    if (m().phase !== 'jeu') return;
    const j = m().joueurs[m().controle[0] ?? MOI];
    const p = porteur(m());
    if (p === j) {
      const st = pouce.stick, a = Math.hypot(st.x, st.y) > 0.3, g = ecranVersJeu(st.x, st.y);
      actionPouce = { type: 'passe', p: 0.45, dx: a ? g.x : Math.sin(j.cap), dz: a ? g.z : Math.cos(j.cap) };
      return;
    }
    if (p && p.e !== j.e && Math.hypot(p.p.x - j.p.x, p.p.z - j.p.z) < 2.2) actionPouce = { type: 'tacle', glisse: false };
  };
  // le second doigt touché sans bouger : la semelle (R3)
  pouce.surSemelle = () => {
    if (m().phase !== 'jeu') return;
    const j = m().joueurs[m().controle[0] ?? MOI];
    if (porteur(m()) === j) actionPouce = { type: 'semelle' };
  };
  pouce.surLancer = (dx, dy, force) => {
    if (m().phase !== 'jeu') return;
    const j = m().joueurs[m().controle[0] ?? MOI];
    const len = Math.hypot(dx, dy) || 1;
    const g = ecranVersJeu(dx / len, dy / len);
    const ux = g.x, uz = -g.z; // uz > 0 = vers le but attaqué (la droite de l'écran), ux = en travers
    const p = porteur(m());
    if (p !== j) {
      if (p && p.e !== j.e && Math.hypot(p.p.x - j.p.x, p.p.z - j.p.z) < 3) actionPouce = { type: 'tacle', glisse: true };
      return;
    }
    if (uz > 0.45) {
      // la frappe : la pente du geste choisit le côté du but ; l'erreur et la hauteur viennent de la puissance
      const f = clamp(force, 0, 1);
      const x = clamp((ux / uz) * 2.1 + j.p.x * 0.06, -PX, PX);
      actionPouce = { type: 'frappe', p: 0.35 + f * 0.6, x };
    } else {
      actionPouce = { type: 'roulette', dx: Math.sign(ux) || 1, dz: 0 };
    }
  };

  // ── les événements de la simulation → vibrations, tableau, ralenti ──
  function evenements() {
    const M = m();
    const eq = banc.auto || scene ? [null, null] : manettes.equipes();
    // une vibration pour l'équipe e : sa manette, ou le téléphone si c'est le pouce qui joue les Noirs
    const secouer = (e, ef, ms) => { if (banc.auto || e == null) return; if (eq[e]) manettes.vibrer(e, ef); else if (e === 0 && M.humains[0]) vibrer(ms); };
    const eqDe = (i) => (i != null ? M.joueurs[i]?.e : null);
    const joue = (i) => i != null && M.controle[M.joueurs[i]?.e] === i;
    for (const e of M.evts) {
      switch (e.type) {
        case 'frappe': secouer(eqDe(e.j), EFFETS.frappe(e.p ?? 0.5), 18); break;
        case 'passe': if (!eq[eqDe(e.j)]) secouer(eqDe(e.j), null, 8); break;
        case 'tacleBalle': case 'tacleJambes': secouer(eqDe(e.j), EFFETS.tacle(), 14); break;
        case 'chute': if (joue(e.j)) secouer(eqDe(e.j), EFFETS.chute(), 22); break;
        case 'epaule': for (const i of [e.a, e.b]) if (joue(i) && eq[eqDe(i)]) manettes.vibrer(eqDe(i), EFFETS.epaule()); break;
        case 'poteau': if (!banc.auto) { for (const k of [0, 1]) if (eq[k]) manettes.vibrer(k, EFFETS.poteau()); if (!eq[0] && M.humains[0]) vibrer(12); } break;
        case 'but':
          banc.stats.buts = M.stats.buts;
          etat.message = 'BUT';
          etat.buteur = e.j === MOI ? 'moi' : e.e === 0 ? 'noirs' : 'blancs';
          cam.buteur = e.j;
          if (!reduit) { ralenti = 0.3; ralentiFin = 1.1; }
          secouer(e.e, EFFETS.but(), [30, 40, 60]);
          break;
        case 'engagement': etat.message = null; etat.buteur = null; break;
        default: break;
      }
    }
    M.evts.length = 0;
  }

  function majEtat() {
    const M = m();
    const changePhase = etat.phase !== M.phase;
    if (changePhase && M.phase === 'fin') { manettes.mode('repos'); pause = false; etat.pause = false; }
    etat.phase = M.phase; etat.noirs = M.score[0]; etat.blancs = M.score[1]; etat.reste = Math.max(0, M.reste);
    if (M.phase !== 'but') { etat.message = null; if (M.phase !== 'fin') etat.buteur = null; }
    const s = Math.ceil(etat.reste);
    if (changePhase || s !== derniereSeconde) { derniereSeconde = s; signaler(); }
  }

  // ── le rendu d'un état (interpolé) ──
  const sautes = new Uint8Array(10);
  function poserTout(dt) {
    const M = m(), bc = boucleSim;
    const p = porteur(M);
    for (let i = 0; i < vus.length; i++) {
      const v = vus[i], j = M.joueurs[i], I = v.interp;
      joueurInterpole(bc, i, I);
      const saut = Math.hypot(I.x - v.prec.x, I.z - v.prec.z) > 0.8;
      v.prec.x = I.x; v.prec.z = I.z;
      sautes[i] = saut ? 1 : 0;
      v.perso.racine.position.set(I.x, 0, I.z);
      v.perso.racine.rotation.y = I.cap;
      v.ombre.position.set(I.x, 0.04, I.z);
      v.perso.racine.visible = !j.absent;
      v.ombre.visible = !j.absent;
      v.cache.saut = saut;
      v.anim.maj(etatAnim(M, j, I, p, bInterp, v.cache), dt);
    }
    balleInterpolee(bc, bInterp);
    balle.position.set(bInterp.x, bInterp.y, bInterp.z);
    // la rotation affichée est celle de la simulation (ω), dans le repère du jeu (le parent du ballon)
    const wv = M.balle.w, wn = Math.hypot(wv.x, wv.y, wv.z);
    if (wn > 1e-4 && dt > 0) { axeB.set(wv.x / wn, wv.y / wn, wv.z / wn); qBalle.setFromAxisAngle(axeB, wn * dt * ralenti); balle.quaternion.premultiply(qBalle); }
    ombreBalle.position.set(bInterp.x, 0.045, bInterp.z);
    // l'anneau sous le joueur que tu joues
    const visibleJeu = !banc.auto && (M.phase === 'jeu' || M.phase === 'engagement');
    const c = M.controle[0], c1 = M.controle[1];
    anneau.visible = visibleJeu && c != null;
    if (c != null) { const I = vus[c].interp; anneau.position.set(I.x, 0.05, I.z); }
    anneauB.visible = visibleJeu && c1 != null;
    if (c1 != null) { const I = vus[c1].interp; anneauB.position.set(I.x, 0.05, I.z); }
    for (const e of [0, 1]) {
      const o = jauges[e], q = M.controle[e], f = e === 0 && !manettes.equipes()[0] && clavierJoue() ? cmdClavier.p : manettes.jauge(e);
      o.visible = visibleJeu && q != null && f > 0.02;
      if (o.visible) { const I = vus[q].interp; o.position.set(I.x, 0.055, I.z); o.geometry.setDrawRange(0, 6 * Math.max(1, Math.round(48 * f))); }
    }
  }

  function versMondeDir(v, out) { return out.set(v.z, v.y, -v.x); }

  const horlogeTexte = (s) => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  function majCamera(dt) {
    const M = m();
    // le banc peut poser la caméra (plan serré, immobile pendant la pose : aucun tremblement)
    if (cam.fixe) {
      cam.pos.set(...cam.fixe.pos); cam.regard.set(...cam.fixe.regard);
      versMonde(cam.pos, camera.position);
      camera.lookAt(versMonde(cam.regard, w));
      return;
    }
    const ph = M.phase;
    // (après la ligne, la caméra de la télé reste 0,6 s sur le but avant le plan de la célébration)
    const face = ph === 'intro' || ph === 'fin' || ph === 'attente' || (ph === 'but' && M.phaseT > 0.6 && M.phaseT < JEU.butPause - 0.6);
    let voulu, regard;
    if (face) {
      const i = ph === 'but' && cam.buteur != null ? cam.buteur : MOI;
      const I = vus[i].interp;
      const ang = I.cap + (ph === 'intro' || ph === 'attente' ? 0.35 : -0.5);
      const d = ph === 'intro' || ph === 'attente' ? 3.4 : 4.6; // la célébration : en pied
      voulu = tmp.set(I.x + Math.sin(ang) * d, 1.7, I.z + Math.cos(ang) * d);
      regard = tmp2.set(I.x, 1.45, I.z);
    } else {
      // le plan de la télé : en hauteur dans la tribune, le long du terrain, qui suit la balle en travelling
      const b = M.balle;
      const large = cw > ch;
      // une frappe vers un but (et les 0,6 s après la ligne) : le cadre tient la balle ET le but visé
      const zBut = b.tir ? butDe(1 - b.tir.e) : ph === 'but' && M.butEquipe != null ? butDe(1 - M.butEquipe) : null;
      const vise = zBut != null ? bInterp.z * 0.4 + zBut * 0.6 : bInterp.z + b.v.z * 0.35;
      cam.foyer.lerp(tmp2.set(bInterp.x + b.v.x * 0.2, 0, vise), 1 - Math.exp(-dt * (zBut != null ? 6 : 2.6)));
      const lim = large ? (zBut != null ? 8 : 6) : zBut != null ? 13.5 : 11;
      const fx = clamp(cam.foyer.x, -6, 6), fz = clamp(cam.foyer.z, -lim, lim);
      voulu = tmp.set(large ? 21 : 15.5, large ? 12.5 : 11, fz);
      let rx = fx * 0.3 + (large ? -1 : 0.6);
      if (!large) {
        // au téléphone, le panneau proche (x = +10) reste au-dessus de 72 % de la hauteur de l'écran (au-dessus du
        // pouce) quand la balle s'en approche : le foyer glisse vers lui, au même filtre (aucune secousse)
        const H = voulu.y, f = (camera.fov * Math.PI) / 360;
        const ap = Math.atan2(H, voulu.x - 10), a0 = ap - Math.atan(0.44 * Math.tan(f));
        const rxMin = voulu.x - H / Math.tan(a0);
        const w = THREE.MathUtils.smoothstep(cam.foyer.x, 2, 7.5);
        rx = Math.max(rx, rx + (rxMin - rx) * w);
      }
      regard = tmp2.set(rx, 0, fz);
      // et le recul : ce qu'il faut pour tenir la balle et le but dans la largeur du cadre
      cam.recul += ((zBut != null ? 1 : 0) - cam.recul) * (1 - Math.exp(-dt * 2.5));
      if (cam.recul > 1e-3 && zBut != null) {
        const D = Math.hypot(voulu.x - regard.x, voulu.y - regard.y);
        const demi = D * Math.tan(Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect));
        const besoin = Math.abs(bInterp.z - zBut) / 2 + 1.6;
        const k = 1 + (clamp(besoin / Math.max(1, demi), 1, 1.7) - 1) * cam.recul;
        voulu.x = regard.x + (voulu.x - regard.x) * k; voulu.y = regard.y + (voulu.y - regard.y) * k;
      } else if (cam.recul > 1e-3) {
        const k = 1 + 0.25 * cam.recul;
        voulu.x = regard.x + (voulu.x - regard.x) * k; voulu.y = regard.y + (voulu.y - regard.y) * k;
      }
    }
    // (une frappe : le cadre rejoint le but plus vite, au même filtre du premier ordre, sans dépassement)
    const k = 1 - Math.exp(-dt * (face ? 2.2 : cam.recul > 0.05 ? 5 : 3));
    cam.pos.lerp(voulu, k);
    cam.regard.lerp(regard, Math.min(1, k * 1.15));
    versMonde(cam.pos, camera.position);
    camera.lookAt(versMonde(cam.regard, w));
  }

  // ── la boucle ──
  const horloge = new THREE.Timer();
  let raf = 0, moyenne = 16.7, compte = 0, avantMs = 0;
  function adapter(ms) {
    const d = ms - avantMs; avantMs = ms;
    if (d <= 0 || d > 200) return;
    moyenne = moyenne * 0.92 + d * 0.08;
    if (++compte < 45) return;
    let e = echelle;
    if (moyenne > 24 && e > 0.7) e = Math.max(0.7, e - 0.1);
    else if (moyenne < 15 && e < 1) e = Math.min(1, e + 0.05);
    if (e !== echelle) { echelle = e; compte = 0; taille(); }
  }

  let gele = false; // le banc fait avancer la simulation lui-même (avancer(n)) : la boucle ne fait que rendre
  function boucle(ms) {
    raf = requestAnimationFrame(boucle);
    // (gelée par le banc : c'est avancer(n) qui fait les pas et le rendu)
    if (gele) return;
    adapter(ms);
    horloge.update(ms);
    const dtReel = Math.min(0.25, horloge.getDelta());
    // les manettes : une lecture par image, avant les pas ; puis qui joue quelle équipe
    manettes.lire(ms / 1000, m());
    lireClavier(ms / 1000);
    majHumains();
    // plus aucune manette d'équipe branchée (batterie, câble) : la pause qu'elle avait mise se lève d'elle-même
    if (pause && pauseManette && manettes.rangees() === 0) poserPause(false);
    if (pause) { evenements(); majEtat(); rendre(0); return; }
    if (ralentiFin > 0) { ralentiFin -= dtReel; if (ralentiFin <= 0) ralenti = 1; }
    let dtJeu = dtReel * ralenti;
    if (!gele) {
      if (banc.pas > 0) { avancerPas(boucleSim, Math.max(1, Math.round(banc.pas / PAS)), lireEntrees); dtJeu = banc.pas; }
      else avancer(boucleSim, dtReel, lireEntrees, ralenti);
    }
    evenements();
    majEtat();
    rendre(dtJeu);
  }
  function rendre(dtJeu) {
    poserTout(dtJeu);
    peindreEcran(`${etat.noirs}-${etat.blancs}-${horlogeTexte(etat.reste)}`, etat.noirs, etat.blancs, horlogeTexte(etat.reste));
    majCamera(Math.max(dtJeu, 1 / 120));
    if (banc.rendu) pl.rendre(performance.now() / 1000);
  }

  function taille() {
    [cw, ch, W, H] = dims();
    renderer.setSize(W, H, false);
    pl.composer.setSize(W, H);
    camera.aspect = cw / ch;
    camera.fov = cw > ch ? 34 : 60;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(taille);
  ro.observe(conteneur);
  taille();
  poserTout(0);
  cam.foyer.set(0, 0, 0);
  {
    const I = vus[MOI].interp;
    const ang = I.cap + 0.35;
    cam.pos.set(I.x + Math.sin(ang) * 3.4, 1.75, I.z + Math.cos(ang) * 3.4);
    cam.regard.set(I.x, 1.45, I.z);
  }
  surProgres(1);
  raf = requestAnimationFrame(boucle);
  signaler();

  /** Un nouveau monde (graine), avec ou sans humain (banc.auto). */
  function nouveauMonde(g = graine, { auto = banc.auto, presents = null } = {}) {
    graine = g;
    monde0 = creerMonde({ graine: g, duree, humains: auto ? [false, false] : [true, false], aides: auto ? [0, 0] : [1, 0], presents });
    boucleSim = creerBoucle(monde0);
    banc.stats = monde0.stats;
    ralenti = 1; ralentiFin = 0; cam.buteur = null; scene = null;
    return monde0;
  }

  return {
    /** Le match : avec les manettes rangées dans l'écran Manettes (s'il y en a), sinon au pouce. */
    demarrer() {
      if (m().phase !== 'attente') nouveauMonde(graine + 1);
      manettes.mode('match');
      avecManettes = !!(manettes.equipes()[0] || manettes.equipes()[1]);
      etat.manettes = avecManettes;
      pouce.utilise = false; pause = false; etat.pause = false;
      clavier.utilise = false; oublier(cmdClavier); oublierLecteur(lecteurPouce);
      majHumains();
      demarrerMonde(m(), { intro: true, reduit });
      etat.message = null; etat.buteur = null; derniereSeconde = -1;
      majEtat(); signaler();
    },
    /** L'écran Manettes ouvert (salon) ou fermé (repos) ; abonner / instantane pour l'écran (manettes.tsx). */
    salon(ouvert) { manettes.mode(ouvert ? 'salon' : 'repos'); },
    /** Lever la pause (le voile de pause est touchable : au doigt, à la souris) */
    reprendre() { poserPause(false); },
    manettes: { abonner: manettes.abonner, instantane: manettes.instantane, reconnues: manettes.reconnues },
    // banc d'essai (?banc) : l'état, la graine, des pas exacts, l'empreinte, les scénarios de capture
    _test: {
      etat, banc, anneau, anneauB, pouce, manettes, clavier, cmdClavier,
      get pause() { return pause; },
      get monde() { return m(); },
      get joueurs() { return m().joueurs; },
      get b() { return m().balle; },
      get humain() { return m().controle[0]; },
      get graine() { return graine; },
      get vus() { return vus; },
      frapper: (dx, dy, f) => pouce.surLancer(dx, dy, f),
      toucher: () => pouce.surTouche(),
      /** le coup d'envoi tout de suite, sans l'intro ; avec une graine (et l'IA des deux côtés si banc.auto) */
      lancer: (g = graine) => { nouveauMonde(g); demarrerMonde(m(), { intro: false }); etat.message = null; derniereSeconde = -1; majEtat(); signaler(); },
      /** n pas exacts de simulation, puis un rendu ; la boucle n'avance plus seule tant que geler(true) */
      avancer: (n = 1) => { avancerPas(boucleSim, n, lireEntrees); evenements(); majEtat(); rendre(n * PAS); return m().pas; },
      geler: (v = true) => { gele = v; },
      empreinte: () => empreinte(m()),
      /** un scénario de sim/scenarios.js : placements et intentions scriptées, rejouables au pas près */
      scenario: (nom, g) => {
        const S = SCENARIOS[nom];
        if (!S) throw new Error(`scénario inconnu : ${nom}`);
        const M = nouveauMonde(g ?? S.graine ?? 1, { auto: false, presents: S.presents ?? null });
        demarrerMonde(M, { intro: false });
        scene = S.creer(M);
        majEtat(); signaler();
        // la caméra se pose tout de suite sur l'action (pas de travelling depuis l'ancienne place)
        const b = M.balle; cam.foyer.set(b.p.x, 0, b.p.z);
        return { pas: S.pas ?? 0 };
      },
      /** un plan fixe (repère du jeu) pour les captures ; camera(null) rend la caméra de la télé */
      camera: (pos, regard) => { cam.fixe = pos ? { pos, regard } : null; },
    },
    detruire() {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', clavierPause);
      ro.disconnect();
      pouce.detruire();
      clavier.detruire();
      manettes.detruire();
      for (const v of vus) v.perso.liberer();
      pl.composer.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
