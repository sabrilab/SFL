// Bola, le jeu : « Cinq attaques ». Toi, balle au pied, contre un défenseur et un gardien de marbre, sur un five de
// nuit. Cinq ballons pour marquer le plus possible. Vertical, au pouce, dans le bas de l'écran (pouce.js).
//
// Ce que fait chaque geste :
//   glisser   tu cours dans cette direction ; loin du point de départ, tu sprintes ; la balle reste au pied
//   lancer    un coup sec du pouce puis lâcher : la frappe, dans la direction du geste, aussi forte que le geste est vif
//   toucher   un dribble (roulette) : tu passes de côté, le défenseur trop près est éliminé un instant
//
// Les animations sont celles de la bibliothèque Mixamo de Sabri (frappes, conduite, gardien, célébrations), sur des
// corps habillés en Noirs et en marbre par le code (personnage.js) ; ta tête porte ta photo du studio (tete.js).
// Tout ce qui ne dépend pas du navigateur (règles, IA) reste ici, en clair : pas de serveur, rien n'est enregistré.
import * as THREE from 'three';
import { creerTerrain, creerBallon, LARGEUR, LONGUEUR, BUT } from './terrain.js';
import { creerPersonnage } from './personnage.js';
import { analyserPhoto, creerTete } from './tete.js';
import { creerPouce } from './pouce.js';

const G = 9.81;
const R_BALLE = 0.11;
const ATTAQUES = 5;
const V_TROT = 4.6, V_SPRINT = 7.2; // m/s
const V_DEF = 5.4;
const Z_DEPART = 12;
const LIGNE = -LONGUEUR / 2;

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const angleVers = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };

/**
 * Lance le jeu dans conteneur. Renvoie { demarrer(), detruire() }.
 * @param {HTMLElement} conteneur
 * @param {{ photo?: string | null, surEtat?: (etat: any) => void, reduit?: boolean }} [options]
 *   photo : adresse de ta photo du studio ; surEtat : le tableau (HUD) ; reduit : « Réduire les animations ».
 */
export async function creerMatch(conteneur, { photo = null, surEtat = () => {}, reduit = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  conteneur.appendChild(renderer.domElement);
  Object.assign(renderer.domElement.style, { display: 'block', position: 'absolute', inset: '0', touchAction: 'none' });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070a);
  scene.fog = new THREE.Fog(0x05070a, 30, 80);
  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x1a2a1a, 0.75));
  const soleil = new THREE.DirectionalLight(0xffffff, 2.6);
  soleil.position.set(8, 22, 10);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  Object.assign(soleil.shadow.camera, { left: -14, right: 14, top: 22, bottom: -22, near: 1, far: 60 });
  soleil.shadow.bias = -0.0004;
  scene.add(soleil);
  const contre = new THREE.DirectionalLight(0xaec6ff, 0.9);
  contre.position.set(-10, 14, -20);
  scene.add(contre);

  creerTerrain(scene);
  const balle = creerBallon();
  scene.add(balle);

  // les joueurs : toi en Noirs avec ta tête, le défenseur et le gardien en marbre
  let analyse = null;
  try { analyse = photo ? await analyserPhoto(photo) : null; } catch { analyse = null; }
  const [moi, def, gardien] = await Promise.all([
    creerPersonnage({ modele: 'homme', tenue: 'noirs', tete: creerTete(analyse), peau: analyse?.peau, packs: ['player', 'celeb'] }),
    creerPersonnage({ modele: 'homme', tenue: 'marbre', tete: creerTete(null, { statue: 0xe9e6df }), packs: ['player'] }),
    creerPersonnage({ modele: 'homme', tenue: 'marbre', tete: creerTete(null, { statue: 0xe9e6df }), packs: ['keeper'] }),
  ]);
  for (const p of [moi, def, gardien]) scene.add(p.racine);

  const pouce = creerPouce(renderer.domElement);

  // ── état ──
  const etat = {
    phase: 'attente', // attente | intro | jeu | frappe | resultat | fin
    attaque: 0,
    buts: 0,
    resultats: [], // 'but' | 'arret' | 'perdu' | 'dehors'
    message: null,
  };
  const b = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), auPied: true, libre: false, garde: false };
  const me = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), cap: Math.PI, dribble: 0, intouchable: 0, touche: 0 };
  const d = { pos: new THREE.Vector3(), cap: 0, tacle: 0, sonne: 0, essai: 0.6 };
  const k = { x: 0, cible: 0, plonge: null, reaction: 0 };
  let tir = null; // { croiseX, croiseY, t, vitesse }
  let ralenti = 1, ralentiFin = 0;
  let cam = { pos: new THREE.Vector3(0, 12, 26), regard: new THREE.Vector3(0, 0, 0) };
  let horlogeResultat = 0;
  let horlogeIntro = 0, debutJeu = 0;

  const signaler = () => surEtat({ ...etat, resultats: [...etat.resultats] });

  function placer() {
    me.pos.set((Math.random() - 0.5) * 6, 0, Z_DEPART);
    me.vel.set(0, 0, 0);
    me.cap = Math.PI; // face au but du haut
    me.intouchable = 0;
    d.pos.set(me.pos.x * 0.4 + (Math.random() - 0.5) * 2, 0, -2);
    d.cap = 0; d.tacle = 0; d.sonne = 0; d.essai = 0.8;
    k.x = 0; k.cible = 0; k.plonge = null; k.reaction = 0;
    b.auPied = true; b.libre = false; b.garde = false;
    b.vel.set(0, 0, 0);
    b.pos.set(me.pos.x, R_BALLE, me.pos.z - 0.6);
    tir = null;
    moi.arreterPonctuel(); moi.loco(0);
    def.arreterPonctuel(); def.loco(0);
    gardien.arreterPonctuel(); gardien.loco(0, { force: 'k_idle' });
    gardien.racine.position.set(0, 0, LIGNE + 0.8);
    gardien.racine.rotation.y = 0;
  }

  function finAttaque(resultat) {
    if (etat.phase === 'resultat' || etat.phase === 'fin') return;
    etat.resultats.push(resultat);
    if (resultat === 'but') etat.buts++;
    etat.phase = 'resultat';
    etat.message = { but: 'BUT', arret: 'ARRÊT', perdu: 'PERDU', dehors: 'À CÔTÉ' }[resultat];
    horlogeResultat = resultat === 'but' ? 3.2 : 1.8;
    if (resultat === 'but') {
      if (!reduit) { ralenti = 0.3; ralentiFin = 1.1; }
      const cel = ['victory', 'fist_pump', 'cheering'][Math.floor(Math.random() * 3)];
      setTimeout(() => moi.jouer(cel, { fade: 0.25 }), 350);
      try { navigator.vibrate?.([30, 40, 60]); } catch {}
    }
    signaler();
  }

  function suivante() {
    etat.attaque++;
    etat.message = null;
    if (etat.attaque >= ATTAQUES) {
      etat.phase = 'fin';
      moi.jouer(etat.buts >= 3 ? 'samba' : 'clapping', { fade: 0.3 });
      signaler();
      return;
    }
    placer();
    intro();
  }

  /** Avant chaque attaque : un plan sur ton visage, puis la caméra file derrière toi. */
  function intro() {
    etat.phase = 'intro';
    horlogeIntro = reduit ? 0.2 : 1.3;
    cam.pos.set(me.pos.x + Math.sin(me.cap + 0.35) * 3.4, 1.75, me.pos.z + Math.cos(me.cap + 0.35) * 3.4);
    cam.regard.copy(me.pos).setY(1.45);
    signaler();
  }

  // ── gestes ──
  pouce.surTouche = () => {
    if (etat.phase !== 'jeu' || moi.occupe || !b.auPied) return;
    // la roulette : un pas de côté, à l'opposé du défenseur
    const cote = Math.sign(me.pos.x - d.pos.x) || 1;
    me.vel.x += cote * 4.5;
    me.intouchable = 0.75;
    moi.jouer('roulette', { fade: 0.08, timeScale: 1.25, surFin: () => moi.loco(me.vel.length()) });
    if (d.pos.distanceTo(me.pos) < 3.2) { d.sonne = 0.9; d.tacle = 0; }
    try { navigator.vibrate?.(12); } catch {}
  };

  pouce.surLancer = (dx, dy, force) => {
    if (etat.phase !== 'jeu' || !b.auPied) return;
    // direction du geste (écran : haut = vers le but)
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uz = dy / len; // uz > 0 = vers le haut de l'écran
    if (uz < 0.15) return; // un geste vers le bas n'est pas une frappe
    // la frappe est aidée (comme à la manette) : la pente du geste choisit le côté du but, un geste à 30° vise
    // le poteau ; trop fort, elle peut s'envoler à côté
    const f = clamp(force, 0, 1);
    const croiseX = clamp((ux / uz) * 3.4 + me.pos.x * 0.2 + (Math.random() - 0.5) * f * f * 1.6, -LARGEUR / 2, LARGEUR / 2);
    const croiseY = clamp(0.25 + f * 1.9 + (Math.random() - 0.5) * 0.25 * f, 0.15, 3.2);
    const vitesse = 15 + f * 15;
    etat.phase = 'frappe';
    signaler();
    const course = me.vel.length() > 3;
    const gauche = croiseX < me.pos.x - 1.5 && Math.random() < 0.5;
    const anim = course ? (gauche ? 'strike_run_l' : 'strike_run') : (gauche ? 'shoot_l' : 'shoot');
    me.cap = Math.atan2(croiseX - me.pos.x, LIGNE - me.pos.z);
    moi.jouer(anim, {
      fade: 0.08,
      impactDans: 0.2,
      surImpact: () => {
        b.auPied = false; b.libre = true;
        const cible = new THREE.Vector3(croiseX, croiseY, LIGNE);
        const h = new THREE.Vector3(cible.x - b.pos.x, 0, cible.z - b.pos.z);
        const L = h.length();
        const t = L / vitesse;
        h.normalize().multiplyScalar(vitesse);
        b.vel.set(h.x, (croiseY - b.pos.y + 0.5 * G * t * t) / t, h.z);
        b.spin.set(-vitesse * 2, (Math.random() - 0.5) * 6, 0);
        tir = { croiseX, croiseY, t, vitesse, depart: performance.now() };
        k.reaction = 0.16 + Math.random() * 0.08 + (1 - f) * 0.05;
        try { navigator.vibrate?.(18); } catch {}
      },
      surFin: () => moi.loco(0),
    });
  };

  // ── boucle ──
  const horloge = new THREE.Timer();
  let raf = 0, temps = 0;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

  function majMoi(dt) {
    const enJeu = etat.phase === 'jeu';
    const st = pouce.stick; // x à droite, y vers le haut, longueur 0..1
    const amp = enJeu ? Math.min(1, Math.hypot(st.x, st.y)) : 0;
    const vmax = amp > 0.85 ? V_SPRINT : V_TROT * Math.min(1, amp / 0.6);
    const cible = tmp.set(st.x, 0, -st.y);
    if (amp > 0.05) cible.normalize().multiplyScalar(vmax); else cible.set(0, 0, 0);
    const occupe = moi.occupe && moi.ponctuelNom !== 'roulette';
    if (occupe) cible.set(0, 0, 0);
    const acc = amp > 0.05 ? 9 : 7;
    me.vel.x = lerp(me.vel.x, cible.x, Math.min(1, dt * acc));
    me.vel.z = lerp(me.vel.z, cible.z, Math.min(1, dt * acc));
    me.pos.addScaledVector(me.vel, dt);
    me.pos.x = clamp(me.pos.x, -LARGEUR / 2 + 0.5, LARGEUR / 2 - 0.5);
    me.pos.z = clamp(me.pos.z, LIGNE + 0.6, LONGUEUR / 2 - 0.5);
    const v = Math.hypot(me.vel.x, me.vel.z);
    if (v > 0.4 && !occupe) me.cap = angleVers(me.cap, Math.atan2(me.vel.x, me.vel.z), Math.min(1, dt * 10));
    moi.racine.position.copy(me.pos);
    moi.racine.rotation.y = me.cap;
    // penché dans les virages, un peu en avant au sprint
    const virage = clamp((cible.x * me.vel.z - cible.z * me.vel.x) * 0.004, -0.12, 0.12);
    moi.pencher(lerp(moi.corps.rotation.z, -virage, dt * 6), lerp(moi.corps.rotation.x, v > 5.6 ? 0.08 : 0, dt * 4));
    if (!moi.occupe && etat.phase !== 'fin' && etat.phase !== 'resultat') moi.loco(v);
    me.intouchable = Math.max(0, me.intouchable - dt);
  }

  function majBalle(dt) {
    if (b.garde) {
      gardien.osMonde('RightHand', tmp);
      gardien.osMonde('LeftHand', tmp2);
      b.pos.copy(tmp).add(tmp2).multiplyScalar(0.5);
      b.vel.set(0, 0, 0);
    } else if (b.auPied) {
      // conduite : la balle devant le pied, poussée à petites touches au rythme de la course
      const v = Math.hypot(me.vel.x, me.vel.z);
      const avance = 0.45 + Math.min(1.1, v * 0.13) + Math.sin(temps * (6 + v)) * 0.12 * Math.min(1, v / 3);
      const cible = tmp.set(Math.sin(me.cap), 0, Math.cos(me.cap)).multiplyScalar(avance).add(me.pos);
      if (moi.ponctuelNom && /shoot|strike/.test(moi.ponctuelNom)) cible.copy(b.pos); // la balle attend la frappe
      cible.y = R_BALLE;
      const k2 = Math.min(1, dt * 14);
      const avant = b.pos.clone();
      b.pos.lerp(cible, k2);
      b.vel.copy(b.pos).sub(avant).divideScalar(Math.max(dt, 1e-4));
    } else {
      b.vel.y -= G * dt;
      // effet : un peu de courbe
      b.vel.x += b.spin.y * 0.02 * dt;
      b.pos.addScaledVector(b.vel, dt);
      if (b.pos.y < R_BALLE) {
        b.pos.y = R_BALLE;
        if (b.vel.y < -1) { b.vel.y = -b.vel.y * 0.55; b.vel.x *= 0.85; b.vel.z *= 0.85; }
        else { b.vel.y = 0; b.vel.x *= Math.max(0, 1 - dt * 1.4); b.vel.z *= Math.max(0, 1 - dt * 1.4); }
      }
      // palissade
      const mx = LARGEUR / 2 - R_BALLE;
      if (Math.abs(b.pos.x) > mx && b.pos.y < 0.9) { b.pos.x = Math.sign(b.pos.x) * mx; b.vel.x *= -0.6; }
      if (b.pos.z > LONGUEUR / 2 - R_BALLE) { b.pos.z = LONGUEUR / 2 - R_BALLE; b.vel.z *= -0.6; }
      // ligne de but
      if (b.pos.z < LIGNE && etat.phase === 'frappe') {
        const dedans = Math.abs(b.pos.x) < BUT.demiLargeur - R_BALLE && b.pos.y < BUT.hauteur - R_BALLE;
        if (dedans) {
          finAttaque('but');
          // le filet freine la balle
          b.vel.multiplyScalar(0.25);
        } else {
          finAttaque(Math.abs(b.pos.x) < BUT.demiLargeur + 0.3 && b.pos.y < BUT.hauteur + 0.3 ? 'arret' : 'dehors');
          b.vel.z *= -0.4;
        }
      }
      if (b.pos.z < LIGNE - BUT.profondeur + R_BALLE) { b.pos.z = LIGNE - BUT.profondeur + R_BALLE; b.vel.z = 0; b.vel.x *= 0.5; }
      // rotation du ballon
      const v = Math.hypot(b.vel.x, b.vel.z);
      if (v > 0.01) balle.rotateOnWorldAxis(tmp.set(b.vel.z, 0, -b.vel.x).normalize(), (v / R_BALLE) * dt);
      // une balle qui meurt sans résultat
      if (etat.phase === 'frappe' && v < 0.6 && b.pos.y <= R_BALLE + 0.01 && tir && performance.now() - tir.depart > 1500) finAttaque('dehors');
    }
    if (b.auPied) {
      const v = Math.hypot(b.vel.x, b.vel.z);
      if (v > 0.01) balle.rotateOnWorldAxis(tmp.set(b.vel.z, 0, -b.vel.x).normalize(), (v / R_BALLE) * dt);
    }
    balle.position.copy(b.pos);
  }

  function majDefenseur(dt) {
    d.sonne = Math.max(0, d.sonne - dt);
    if (etat.phase !== 'jeu') {
      def.loco(0);
      def.racine.position.copy(d.pos);
      return;
    }
    // il se place entre toi et le but, à un pas devant la balle
    const vise = tmp.set(b.pos.x - me.pos.x * 0.15, 0, b.pos.z - 1.2);
    const versBut = tmp2.set(0 - b.pos.x, 0, LIGNE - b.pos.z).normalize();
    vise.addScaledVector(versBut, 0.9);
    const delta = vise.sub(d.pos);
    delta.y = 0;
    const dist = delta.length();
    const vmax = d.sonne > 0 ? 1.2 : V_DEF;
    const v = dist > 0.2 ? Math.min(vmax, dist * 3) : 0;
    if (!def.occupe && dist > 0.05) {
      d.pos.addScaledVector(delta.normalize(), v * dt);
      d.cap = angleVers(d.cap, Math.atan2(b.pos.x - d.pos.x, b.pos.z - d.pos.z), Math.min(1, dt * 8));
    }
    def.loco(def.occupe ? 0 : v);
    def.racine.position.copy(d.pos);
    def.racine.rotation.y = d.cap;
    // le tacle
    d.essai -= dt;
    const pres = d.pos.distanceTo(b.pos);
    if (!def.occupe && d.sonne <= 0 && pres < 1.5 && d.essai <= 0 && b.auPied && !moi.occupe) {
      d.essai = 0.5;
      if (Math.random() < 0.42) {
        def.jouer('tackle', {
          fade: 0.08,
          impactDans: 0.22,
          surImpact: () => {
            if (etat.phase !== 'jeu') return;
            def.osMonde('RightFoot', tmp);
            if (tmp.distanceTo(b.pos) < 1.25 && me.intouchable <= 0) {
              // la balle s'en va de côté
              b.auPied = false; b.libre = true;
              b.vel.set((Math.random() - 0.5) * 8, 1.5, 3 + Math.random() * 3);
              moi.jouer('trip', { fade: 0.1, surFin: () => moi.jouer('getup') });
              finAttaque('perdu');
            }
          },
        });
      }
    }
  }

  function majGardien(dt) {
    const gx = gardien.racine.position;
    if (tir && etat.phase === 'frappe') {
      const age = (performance.now() - tir.depart) / 1000;
      if (!k.plonge && age > k.reaction) {
        const ecart = tir.croiseX - gx.x;
        const restant = Math.max(0.05, tir.t - age);
        const portee = Math.abs(ecart);
        // ce que le gardien peut faire, selon l'écart et le temps qui reste
        let arrete = false;
        if (Math.abs(tir.croiseX) > BUT.demiLargeur + 0.2 || tir.croiseY > BUT.hauteur + 0.2) {
          k.plonge = { anim: 'k_idle', dx: 0 };
        } else if (portee < 0.55) {
          arrete = tir.croiseY < 1.9 && Math.random() < 0.92 - (tir.vitesse - 15) * 0.012;
          k.plonge = { anim: tir.croiseY > 1.4 ? 'k_catch' : 'k_block', dx: ecart };
        } else {
          const atteint = portee < 1.0 + restant * 3.4;
          const coin = (portee > 1.7 ? 0.25 : 0) + (tir.croiseY > 1.45 || tir.croiseY < 0.35 ? 0.18 : 0);
          arrete = atteint && Math.random() < 0.82 - coin - (tir.vitesse - 15) * 0.018;
          k.plonge = { anim: ecart > 0 ? 'k_dive_r' : 'k_dive_l', dx: arrete ? ecart : ecart * 0.62 };
        }
        k.plonge.arrete = arrete;
        k.plonge.x0 = gx.x;
        k.plonge.t0 = age;
        k.plonge.duree = Math.max(0.2, restant);
        if (k.plonge.anim !== 'k_idle') gardien.jouer(k.plonge.anim, { fade: 0.06, timeScale: 1.3 });
      }
      if (k.plonge) {
        const u = clamp((age - k.plonge.t0) / k.plonge.duree, 0, 1);
        gx.x = clamp(k.plonge.x0 + k.plonge.dx * (1 - (1 - u) * (1 - u)), -BUT.demiLargeur - 0.4, BUT.demiLargeur + 0.4);
        // l'arrêt : quand la balle arrive sur la ligne du gardien
        if (k.plonge.arrete && !k.plonge.fait && b.pos.z < gx.z + 0.3) {
          k.plonge.fait = true;
          if (tir.vitesse < 21 && tir.croiseY < 1.6 && Math.random() < 0.55) {
            b.garde = true; b.libre = false;
          } else {
            b.vel.set((Math.random() - 0.5) * 6 + Math.sign(b.pos.x || 1) * 3, 2 + Math.random() * 2, 4 + Math.random() * 3);
          }
          finAttaque('arret');
          try { navigator.vibrate?.(10); } catch {}
        }
      }
    } else if (etat.phase === 'jeu') {
      // placement : sur la bissectrice de l'angle de tir, un peu sorti
      k.cible = clamp(b.pos.x * 0.32, -1.6, 1.6);
      const avant = gx.x;
      gx.x = lerp(gx.x, k.cible, Math.min(1, dt * 3));
      const v = (gx.x - avant) / Math.max(dt, 1e-4);
      if (!gardien.occupe) gardien.loco(0, { force: Math.abs(v) > 0.5 ? (v > 0 ? 'k_side_r' : 'k_side_l') : 'k_idle' });
    }
    gardien.racine.rotation.y = 0;
  }

  function majCamera(dt) {
    // plan de télé en vertical : derrière et au-dessus de toi, le but en haut de l'écran
    let foyer = me.pos;
    if (etat.phase === 'frappe' || (etat.phase === 'resultat' && etat.resultats.at(-1) !== 'but')) foyer = tmp2.copy(b.pos).lerp(me.pos, 0.4);
    // le but, la fin, et le début de chaque attaque : la caméra passe devant toi, sur ton visage
    const face = (etat.phase === 'resultat' && etat.resultats.at(-1) === 'but') || etat.phase === 'fin' || etat.phase === 'intro';
    let voulu, regard;
    if (face) {
      const ang = me.cap + (etat.phase === 'intro' ? 0.35 : -0.5);
      voulu = tmp.set(me.pos.x + Math.sin(ang) * 3.4, 1.75, me.pos.z + Math.cos(ang) * 3.4);
      regard = tmp2.copy(me.pos).setY(1.45);
    } else {
      voulu = tmp.set(foyer.x * 0.55, 10, foyer.z + 8.5);
      regard = tmp2.set(foyer.x * 0.7, 0, foyer.z - 7.5);
    }
    const k = Math.min(1, dt * (face ? 2.2 : etat.phase === 'jeu' && temps - debutJeu < 1.2 ? 2.2 : 3.2));
    cam.pos.lerp(voulu, k);
    cam.regard.lerp(regard, Math.min(1, k * 1.15));
    camera.position.copy(cam.pos);
    camera.lookAt(cam.regard);
  }

  function boucle(t) {
    raf = requestAnimationFrame(boucle);
    horloge.update(t);
    let dt = Math.min(0.05, horloge.getDelta());
    if (ralentiFin > 0) { ralentiFin -= dt; if (ralentiFin <= 0) ralenti = 1; }
    dt *= ralenti;
    temps += dt;
    if (etat.phase === 'jeu' || etat.phase === 'frappe' || etat.phase === 'resultat' || etat.phase === 'fin') {
      majMoi(dt);
      majDefenseur(dt);
      majGardien(dt);
      majBalle(dt);
    }
    if (etat.phase === 'resultat') {
      horlogeResultat -= dt / ralenti;
      if (horlogeResultat <= 0) suivante();
    }
    if (etat.phase === 'intro') {
      majBalle(dt);
      moi.racine.position.copy(me.pos); moi.racine.rotation.y = me.cap;
      def.racine.position.copy(d.pos); def.racine.rotation.y = d.cap;
      horlogeIntro -= dt;
      if (horlogeIntro <= 0) { etat.phase = 'jeu'; debutJeu = temps; signaler(); }
    }
    for (const p of [moi, def, gardien]) p.update(dt);
    majCamera(dt / ralenti);
    pouce.dessiner?.();
    renderer.render(scene, camera);
  }

  function taille() {
    const w = conteneur.clientWidth || 1, h = conteneur.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    // en paysage (ordinateur), on garde tout le terrain en hauteur
    camera.fov = w > h ? 36 : 46;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(taille);
  ro.observe(conteneur);
  taille();
  placer();
  // avant le coup d'envoi : la caméra est déjà là
  cam.pos.set(me.pos.x * 0.55, 10, me.pos.z + 8.5);
  cam.regard.set(me.pos.x * 0.7, 0, me.pos.z - 7.5);
  raf = requestAnimationFrame(boucle);
  signaler();

  return {
    demarrer() {
      etat.attaque = 0; etat.buts = 0; etat.resultats = []; etat.message = null;
      placer();
      intro();
    },
    // banc d'essai : un état figé pour les captures
    _test: { etat, me, b, d, k, pouce, frapper: (dx, dy, f) => pouce.surLancer(dx, dy, f), dribbler: () => pouce.surTouche() },
    detruire() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      pouce.detruire();
      for (const p of [moi, def, gardien]) p.liberer();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
