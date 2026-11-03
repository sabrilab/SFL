// Bola, le jeu : « Cinq contre cinq » sur le plateau BOLA (Sabri, 03/11/2026 : « le plateau Bola avec un gameplay de
// 5 contre 5, à fond »). Les Noirs contre les Blancs, quatre joueurs et un gardien de chaque côté, un match minuté.
// Vertical, au pouce, dans le bas de l'écran (pouce.js).
//
// Les règles de Bola (un five en salle) : la balle ne sort jamais, elle rebondit sur les panneaux et les filets ; pas
// de touche, pas de corner, pas de hors-jeu ; après un but, l'équipe qui l'a pris engage au rond central.
//
// La caméra est celle de la télé (Sabri 03/11 : « vision sur le côté, même vue caméra que dans FIFA ») : en hauteur
// dans la tribune, le long du terrain ; les Noirs attaquent vers la droite de l'écran.
//
// Ce que fait chaque geste (on joue toujours les Noirs) :
//   glisser          courir dans cette direction ; loin du point de départ, sprinter. Balle au pied, elle suit.
//   toucher          avec la balle : la passe, vers le partenaire qui est dans la direction où tu cours (sinon
//                    celui que tu regardes) ; sans la balle, près du porteur adverse : le tacle
//   coup sec vers la droite avec la balle : la frappe, vers le côté du but que montre le geste, aussi forte que le geste est vif
//   coup sec vers le haut ou le bas avec la balle : un geste technique (roulette) : tu passes de ce côté, le défenseur trop près reste planté
// Comme à la manette, tu joues le porteur ; en défense, la main passe au Noir le plus près de la balle. Celui que tu
// joues porte un anneau blanc au pied.
//
// Le décor est le plateau BOLA (plateau.js, celui des vidéos) en qualité « jeu ». Le plateau a son grand axe en x ;
// le jeu, lui, compte en (x = largeur, z = longueur) : tout le match vit dans un groupe tourné d'un quart de tour
// (monde), si bien que le but attaqué par les Noirs (z = -15) est le but ouest du plateau, côté mur BOLA.
//
// Les visages : ta tête porte ta photo du studio (tete.js). Les autres joueurs sont des statues, d'obsidienne pour tes
// partenaires et de marbre pour les Blancs, tant que l'accord « Apparaître dans le jeu » n'existe pas.
// Les animations sont celles de la bibliothèque Mixamo de Sabri (.pak, personnage.js). Rien n'est enregistré.
import * as THREE from 'three';
import { creerPlateau, DIM } from './plateau.js';
import { creerPersonnage } from './personnage.js';
import { analyserPhoto, creerTete } from './tete.js';
import { creerPouce } from './pouce.js';

const G = 9.81;
const R = 0.11; // rayon du ballon
const LB = DIM.L / 2; // ligne de but (15 m)
const PX = DIM.Tl / 2 - R; // panneaux de côté (10 m)
const PZ = DIM.TL / 2 - R; // panneaux du fond (16 m)
const BUT = { dl: DIM.but[0] / 2, h: DIM.but[1], p: DIM.but[2] };
const FROT = 2.6; // m/s² : la balle qui roule ralentit
const V_TROT = 4.6, V_SPRINT = 7.0, V_IA = 5.3, V_PRESSE = 6.0;
const SURFACE = 6; // le rayon de la surface du gardien (l'arc peint)

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const angleVers = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
const vibrer = (m) => { try { navigator.vibrate?.(m); } catch {} };
/** le sens d'attaque d'une équipe, en z : les Noirs (0) montent vers -z, les Blancs (1) descendent vers +z */
const sens = (e) => (e === 0 ? -1 : 1);
/** le z de la ligne du but que défend l'équipe e */
const butDe = (e) => -sens(e) * LB;

// la formation : x (m) et profondeur f (-1 = sa ligne de but, 1 = celle d'en face), sans la balle
const FORMATION = { D: [0, -0.56], L: [-4.6, -0.12], R: [4.6, -0.12], A: [0, 0.32] };
const ENGAGEMENT = { D: [0, -0.62], L: [-5, -0.28], R: [5, -0.28], A: [0, -0.24] }; // l'attaquant d'en face hors du rond

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
 * Lance le jeu dans conteneur. Renvoie { demarrer(), detruire() }.
 * @param {HTMLElement} conteneur
 * @param {{ photo?: string | null, surEtat?: (etat: any) => void, reduit?: boolean, duree?: number, surProgres?: (p: number) => void }} [options]
 *   photo : ta photo du studio ; surEtat : le tableau (HUD) ; reduit : « Réduire les animations » ; duree : en secondes.
 */
export async function creerMatch(conteneur, { photo = null, surEtat = () => {}, reduit = false, duree = 150, surProgres = () => {} } = {}) {
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

  const pl = await creerPlateau(renderer, { qualite: 'jeu', base: '/jeu/plateau/', largeur: W, hauteur: H });
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

  // ── les joueurs ──
  let analyse = null;
  try { analyse = photo ? await analyserPhoto(photo) : null; } catch { analyse = null; }
  const tomber = texOmbre();
  const matOmbre = new THREE.MeshBasicMaterial({ map: tomber, transparent: true, depthWrite: false, opacity: 1 });
  const geoOmbre = new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2);
  const ROLES = ['G', 'D', 'L', 'R', 'A'];
  const specs = [];
  for (const e of [0, 1]) for (const role of ROLES) specs.push({ e, role, moi: e === 0 && role === 'A' });
  let charges = 0;
  const joueurs = await Promise.all(specs.map(async ({ e, role, moi }) => {
    const statue = moi ? null : e === 0 ? 0x1a1a1c : 0xe9e6df;
    const tete = moi ? creerTete(analyse) : creerTete(null, { statue });
    const perso = await creerPersonnage({
      modele: 'homme', tenue: moi ? 'noirs' : e === 0 ? 'obsidienne' : 'marbre', tete, peau: moi ? analyse?.peau : null,
      packs: role === 'G' ? ['keeper', 'celeb'] : ['player', 'celeb'],
    });
    perso.racine.traverse((o) => { o.castShadow = false; });
    surProgres(0.4 + (++charges / specs.length) * 0.55);
    const ombre = new THREE.Mesh(geoOmbre, matOmbre);
    ombre.renderOrder = 2;
    monde.add(perso.racine, ombre);
    return {
      e, role, moi, perso, ombre, gardien: role === 'G',
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), cap: 0,
      sonne: 0, intouchable: 0, essai: 0, decision: Math.random() * 0.3, geste: 0, but: null, lance: null, finGeste: 0, attente: 0.9,
    };
  }));
  const moi = joueurs.find((j) => j.moi);
  const gardiens = [joueurs.find((j) => j.e === 0 && j.gardien), joueurs.find((j) => j.e === 1 && j.gardien)];
  const champ = joueurs.filter((j) => !j.gardien);
  const equipe = (e) => champ.filter((j) => j.e === e);
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

  const pouce = creerPouce(renderer.domElement);

  // ── état ──
  const etat = { phase: 'attente', noirs: 0, blancs: 0, reste: duree, message: null, buteur: null };
  const b = { pos: new THREE.Vector3(0, R, 0), vel: new THREE.Vector3(), porteur: null, garde: null, dernier: null, dernierT: -9, recepteur: null, tir: null };
  let humain = moi;
  let changeT = -9;
  let horlogePhase = 0;
  let ralenti = 1, ralentiFin = 0;
  let temps = 0;
  const cam = { pos: new THREE.Vector3(0, 8.5, 12), regard: new THREE.Vector3(0, 0, 0), foyer: new THREE.Vector3() };
  let derniereSeconde = -1;

  const signaler = () => surEtat({ ...etat });
  // banc d'essai : l'IA joue aussi les Noirs (auto), le rendu peut être coupé, et on compte ce qui se passe
  const banc = { auto: false, rendu: true, pas: 1, stats: { passes: 0, tirs: 0, tacles: 0, vols: 0, arrets: 0, buts: 0 } };

  // ── placements ──
  function placer(e, base, j, poussee = 0) {
    const [x, f] = base[j.role];
    j.pos.set(x, 0, sens(e) * (f + poussee) * LB);
    j.vel.set(0, 0, 0);
    j.cap = sens(e) < 0 ? Math.PI : 0;
  }
  function engagement(e) {
    for (const j of joueurs) {
      j.sonne = 0; j.intouchable = 0; j.essai = 0.6; j.but = null; j.lance = null; j.finGeste = 0; j.attente = 0.9;
      j.perso.arreterPonctuel();
      if (j.gardien) {
        j.pos.set(0, 0, butDe(j.e) - Math.sign(butDe(j.e)) * 0.7);
        j.cap = sens(j.e) < 0 ? Math.PI : 0;
        j.perso.loco(0, { force: 'k_idle' });
      } else {
        placer(j.e, ENGAGEMENT, j);
        j.perso.loco(0);
      }
    }
    // l'attaquant de l'équipe qui engage, au point central
    const porteur = joueurs.find((j) => j.e === e && j.role === 'A');
    porteur.pos.set(0, 0, -sens(e) * 0.4);
    b.pos.set(0, R, 0); b.vel.set(0, 0, 0);
    b.porteur = porteur; b.garde = null; b.dernier = null; b.recepteur = null; b.tir = null;
    if (e === 0) humain = porteur;
    else humain = moi;
    etat.message = null; etat.buteur = null;
  }

  // ── actions ──
  /** une passe au sol (un peu levée si elle est longue) vers le partenaire, à l'endroit où il sera */
  function passer(j, cible, { profondeur = false, mains = false } = {}) {
    if (j.perso.occupe && !mains) return;
    const lancer = () => {
      if (!mains && b.porteur !== j) return;
      if (mains && b.garde !== j) return;
      const d0 = Math.hypot(cible.pos.x - b.pos.x, cible.pos.z - b.pos.z);
      const pt = cible.pos.clone().addScaledVector(cible.vel, Math.min(0.8, d0 / 15));
      if (profondeur) pt.z += sens(cible.e) * 3.5;
      pt.x = clamp(pt.x, -PX + 0.8, PX - 0.8); pt.z = clamp(pt.z, -PZ + 0.8, PZ - 0.8);
      const h = new THREE.Vector3(pt.x - b.pos.x, 0, pt.z - b.pos.z);
      const d = h.length();
      const v0 = clamp(Math.sqrt(4.5 * 4.5 + 2 * FROT * d), 6, 19);
      h.normalize().multiplyScalar(v0);
      b.porteur = null; b.garde = null;
      b.vel.set(h.x, d > 13 || mains ? 2.6 : 0, h.z);
      b.dernier = j; b.dernierT = temps; b.recepteur = cible; b.tir = null;
      banc.stats.passes++;
      if (cible.e === 0 && !cible.gardien) { humain = cible; changeT = temps; }
      vibrer(8);
    };
    if (mains) {
      // k_throw n'a pas d'instant d'impact mesuré : la balle part à 0,7 s, et le geste est écourté
      j.perso.jouer('k_throw', { fade: 0.1, timeScale: 1.4 });
      j.lance = { dans: 0.7, f: lancer };
      j.finGeste = 1.5;
      return;
    }
    const gauche = (cible.pos.x - j.pos.x) * Math.cos(j.cap) - (cible.pos.z - j.pos.z) * Math.sin(j.cap) < -1.2;
    j.cap = Math.atan2(cible.pos.x - j.pos.x, cible.pos.z - j.pos.z);
    j.perso.jouer(gauche ? 'pass_l' : 'pass', { fade: 0.08, impactDans: 0.13, apres: 2.2, surImpact: lancer, surFin: () => j.perso.loco(j.vel.length()) });
  }

  /** la frappe vers le but d'en face : croiseX, croiseY à l'endroit où la balle passe la ligne */
  function frapper(j, croiseX, croiseY, vitesse) {
    if (j.perso.occupe) return;
    const zBut = butDe(1 - j.e);
    const course = Math.hypot(j.vel.x, j.vel.z) > 3;
    const gauche = sens(j.e) < 0 ? croiseX < j.pos.x - 1.5 : croiseX > j.pos.x + 1.5;
    const anim = course ? (gauche ? 'strike_run_l' : 'strike_run') : (gauche ? 'shoot_l' : 'shoot');
    j.cap = Math.atan2(croiseX - j.pos.x, zBut - j.pos.z);
    j.perso.jouer(anim, {
      fade: 0.08, impactDans: 0.2,
      surImpact: () => {
        if (b.porteur !== j) return;
        b.porteur = null;
        const h = new THREE.Vector3(croiseX - b.pos.x, 0, zBut - b.pos.z);
        const t = h.length() / vitesse;
        h.normalize().multiplyScalar(vitesse);
        b.vel.set(h.x, (croiseY - b.pos.y + 0.5 * G * t * t) / t, h.z);
        b.dernier = j; b.dernierT = temps; b.recepteur = null;
        const k = gardiens[1 - j.e];
        banc.stats.tirs++;
        b.tir = { croiseX, croiseY, t, vitesse, depart: temps, gardien: k, reaction: 0.15 + Math.random() * 0.08, plonge: null, tireur: j };
        vibrer(18);
      },
      surFin: () => j.perso.loco(0),
    });
  }

  /** le tacle : réussi si le pied arrive sur la balle et que le porteur n'est pas en plein geste */
  function tacler(j) {
    if (j.perso.occupe || j.sonne > 0) return;
    const p = b.porteur;
    banc.stats.tacles++;
    j.perso.jouer('tackle', {
      fade: 0.08, impactDans: 0.22, apres: 2.6,
      surImpact: () => {
        const pied = j.perso.osMonde('RightFoot', new THREE.Vector3());
        monde.worldToLocal(pied);
        if (b.porteur && b.porteur.e !== j.e && Math.hypot(pied.x - b.pos.x, pied.z - b.pos.z) < 1.35 && b.porteur.intouchable <= 0) {
          const v = b.porteur;
          b.porteur = null;
          b.vel.set(Math.sin(j.cap) * 4.5 + (Math.random() - 0.5) * 2, 0.6, Math.cos(j.cap) * 4.5);
          b.dernier = v; b.dernierT = temps - 0.2; b.recepteur = null;
          v.sonne = 0.7;
          banc.stats.vols++;
          // la chute, puis la fin du relevé (le clip entier dure huit secondes)
          if (Math.random() < 0.35) { v.sonne = 1.6; v.perso.jouer('trip', { fade: 0.1, timeScale: 1.5, surFin: () => v.perso.jouer('getup', { fade: 0.15, depuis: 0.72, timeScale: 1.6, surFin: () => v.perso.loco(0) }) }); }
          vibrer(14);
        } else {
          j.sonne = 0.45;
        }
      },
      surFin: () => j.perso.loco(0),
    });
    if (p) { j.cap = Math.atan2(p.pos.x - j.pos.x, p.pos.z - j.pos.z); j.vel.set(Math.sin(j.cap) * 4, 0, Math.cos(j.cap) * 4); }
  }

  /** la roulette : un pas de côté, le défenseur trop près reste planté un instant */
  function roulette(j, cote) {
    if (j.perso.occupe || temps < j.geste) return;
    j.geste = temps + 0.9;
    j.vel.x += cote * 4.6;
    j.intouchable = 0.75;
    j.perso.jouer('roulette', { fade: 0.08, timeScale: 1.25, surFin: () => j.perso.loco(j.vel.length()) });
    for (const o of champ) if (o.e !== j.e && o.pos.distanceTo(j.pos) < 2.6) { o.sonne = 0.85; }
    vibrer(12);
  }

  /** le partenaire à qui donner la balle, dans la direction voulue (x, z) */
  function choisirPartenaire(j, dx, dz) {
    let best = null, score = -Infinity;
    const L = Math.hypot(dx, dz) || 1;
    for (const o of equipe(j.e)) {
      if (o === j) continue;
      const ox = o.pos.x - j.pos.x, oz = o.pos.z - j.pos.z, d = Math.hypot(ox, oz) || 1;
      const alignement = (ox * dx + oz * dz) / (d * L);
      let gene = 0;
      for (const a of champ) {
        if (a.e === j.e) continue;
        // un adversaire près de la ligne de passe
        const t = clamp(((a.pos.x - j.pos.x) * ox + (a.pos.z - j.pos.z) * oz) / (d * d), 0, 1);
        const px = j.pos.x + ox * t - a.pos.x, pz = j.pos.z + oz * t - a.pos.z;
        if (Math.hypot(px, pz) < 1.3) gene += 0.6;
      }
      const s = alignement * 1.4 - d * 0.03 - gene + (oz * sens(j.e) > 0 ? 0.25 : 0);
      if (s > score) { score = s; best = o; }
    }
    return best;
  }

  // ── les gestes du pouce (toujours les Noirs) ──
  // l'écran vu de la tribune : la droite de l'écran = vers le but attaqué (-z), le haut = vers l'autre côté (-x)
  const ecranVersJeu = (sx, sy) => ({ x: -sy, z: -sx });
  pouce.surTouche = () => {
    if (etat.phase !== 'jeu') return;
    const j = humain;
    if (b.porteur === j) {
      const st = pouce.stick;
      const a = Math.hypot(st.x, st.y) > 0.3;
      const g = ecranVersJeu(st.x, st.y);
      const dx = a ? g.x : Math.sin(j.cap), dz = a ? g.z : Math.cos(j.cap);
      const cible = choisirPartenaire(j, dx, dz);
      if (cible) passer(j, cible);
      return;
    }
    if (b.porteur && b.porteur.e !== j.e && b.porteur.pos.distanceTo(j.pos) < 2.2) tacler(j);
  };
  pouce.surLancer = (dx, dy, force) => {
    if (etat.phase !== 'jeu') return;
    const j = humain;
    const len = Math.hypot(dx, dy) || 1;
    const g = ecranVersJeu(dx / len, dy / len);
    const ux = g.x, uz = -g.z; // uz > 0 = vers le but attaqué (la droite de l'écran), ux = en travers
    if (b.porteur !== j) {
      if (b.porteur && b.porteur.e !== j.e && b.porteur.pos.distanceTo(j.pos) < 2.6) tacler(j);
      return;
    }
    if (uz > 0.45) {
      // la frappe est aidée : la pente du geste choisit le côté du but ; trop fort, elle peut partir au-dessus
      const f = clamp(force, 0, 1);
      const croiseX = clamp((ux / uz) * 2.1 + j.pos.x * 0.06 + (Math.random() - 0.5) * f * f * 1.3, -PX, PX);
      const croiseY = clamp(0.22 + f * 1.55 + (Math.random() - 0.5) * 0.3 * f, 0.15, 3);
      frapper(j, croiseX, croiseY, 14 + f * 14);
    } else {
      roulette(j, Math.sign(ux) || 1);
    }
  };

  // ── le jeu ──
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), w = new THREE.Vector3();

  function aller(j, cx, cz, vmax, dt, { regard = null } = {}) {
    const dx = cx - j.pos.x, dz = cz - j.pos.z, d = Math.hypot(dx, dz);
    const v = d > 0.25 ? Math.min(vmax, d * 2.6) : 0;
    const k = Math.min(1, dt * 6);
    j.vel.x = lerp(j.vel.x, d > 0.01 ? (dx / d) * v : 0, k);
    j.vel.z = lerp(j.vel.z, d > 0.01 ? (dz / d) * v : 0, k);
    const cible = regard ?? (v > 0.5 ? Math.atan2(j.vel.x, j.vel.z) : Math.atan2(b.pos.x - j.pos.x, b.pos.z - j.pos.z));
    j.cap = angleVers(j.cap, cible, Math.min(1, dt * 8));
  }

  function majHumain(j, dt) {
    const st = pouce.stick;
    const amp = Math.min(1, Math.hypot(st.x, st.y));
    let vmax = amp > 0.85 ? V_SPRINT : V_TROT * Math.min(1, amp / 0.6);
    if (b.porteur === j) vmax *= 0.93;
    if (j.sonne > 0) vmax = Math.min(vmax, 1.4);
    const g = ecranVersJeu(st.x / (Math.hypot(st.x, st.y) || 1), st.y / (Math.hypot(st.x, st.y) || 1));
    const cx = amp > 0.05 ? g.x * vmax : 0;
    const cz = amp > 0.05 ? g.z * vmax : 0;
    const occupe = j.perso.occupe && j.perso.ponctuelNom !== 'roulette';
    const k = Math.min(1, dt * (amp > 0.05 ? 9 : 7));
    j.vel.x = lerp(j.vel.x, occupe ? 0 : cx, k);
    j.vel.z = lerp(j.vel.z, occupe ? 0 : cz, k);
    const v = Math.hypot(j.vel.x, j.vel.z);
    if (v > 0.4 && !occupe) j.cap = angleVers(j.cap, Math.atan2(j.vel.x, j.vel.z), Math.min(1, dt * 10));
    else if (!occupe && b.porteur?.e !== j.e) j.cap = angleVers(j.cap, Math.atan2(b.pos.x - j.pos.x, b.pos.z - j.pos.z), Math.min(1, dt * 4));
  }

  /** l'IA d'un joueur de champ */
  function majIA(j, dt) {
    const avecBalle = b.porteur === j;
    const notre = b.porteur ? b.porteur.e === j.e : b.garde ? b.garde.e === j.e : null; // null : balle libre
    j.decision -= dt;
    if (j.sonne > 0) { aller(j, j.pos.x, j.pos.z, 0, dt); return; }
    if (avecBalle) {
      // le porteur (les Blancs seulement : chez les Noirs, c'est toi) : vers le but, en évitant le plus proche
      const zBut = butDe(1 - j.e);
      let cx = clamp(-j.pos.x * 0.2, -3, 3), cz = zBut;
      let proche = null, dp = Infinity;
      for (const o of champ) if (o.e !== j.e) { const d = o.pos.distanceTo(j.pos); if (d < dp) { dp = d; proche = o; } }
      if (proche && dp < 3.5) cx = j.pos.x + Math.sign(j.pos.x - proche.pos.x || 1) * 4;
      aller(j, cx, cz, V_IA * 0.92, dt);
      if (j.decision <= 0 && !j.perso.occupe) {
        j.decision = 0.28 + Math.random() * 0.15;
        const dBut = Math.hypot(j.pos.x, zBut - j.pos.z);
        if (dBut < 5.5 || (dBut < 10 && Math.abs(j.pos.x) < 6 && Math.random() < 0.24)) {
          const croiseX = (Math.random() - 0.5) * 2 * (BUT.dl - 0.25);
          frapper(j, croiseX, 0.25 + Math.random() * 1.4, 16 + Math.random() * 8);
        } else if ((dp < 2 && Math.random() < 0.55) || Math.random() < 0.07) {
          const cible = choisirPartenaire(j, Math.sin(j.cap), Math.cos(j.cap) + sens(j.e) * 0.6);
          if (cible) passer(j, cible, { profondeur: Math.random() < 0.3 });
        }
      }
      return;
    }
    // le placement de base, poussé vers l'avant quand l'équipe a la balle, attiré par la balle
    const fBalle = b.pos.z / (sens(j.e) * LB);
    const [bx, bf] = FORMATION[j.role];
    const pousse = notre === true ? 0.32 : notre === false ? -0.12 : 0.05;
    let cx = bx + b.pos.x * 0.35;
    let cz = sens(j.e) * clamp(bf + pousse + fBalle * 0.42, -0.9, 0.85) * LB;
    let vmax = V_IA;
    // qui va chercher la balle : le plus proche de l'équipe qui ne l'a pas (et le second couvre)
    if (notre !== true && !b.garde) {
      // chez les Noirs, si tu es déjà sur la balle, le plus proche des autres couvre au lieu de presser
      const ia = equipe(j.e).filter((o) => banc.auto || !(o === humain && j.e === 0)).sort((a, c) => a.pos.distanceTo(b.pos) - c.pos.distanceTo(b.pos));
      const prochain = b.recepteur && b.recepteur.e === j.e ? b.recepteur : null;
      const humainPresse = !banc.auto && j.e === 0 && humain.pos.distanceTo(b.pos) < 4;
      const chasseur = prochain ?? (humainPresse ? null : ia[0]);
      const couvreur = humainPresse ? ia[0] : ia[1];
      if (j === chasseur) {
        // à la balle : là où elle sera
        const t = Math.min(0.6, b.pos.distanceTo(j.pos) / 7);
        cx = b.pos.x + b.vel.x * t; cz = b.pos.z + b.vel.z * t;
        vmax = V_PRESSE;
      } else if (j === couvreur && notre === false) {
        // le second : entre la balle et son but, à quelques pas
        const zb = butDe(j.e);
        tmp.set(-b.pos.x, 0, zb - b.pos.z).normalize();
        cx = b.pos.x + tmp.x * 3.2; cz = b.pos.z + tmp.z * 3.2;
      }
    } else if (b.recepteur === j) {
      // une passe arrive : à sa rencontre
      cx = b.pos.x + b.vel.x * 0.3; cz = b.pos.z + b.vel.z * 0.3; vmax = V_PRESSE;
    }
    cx = clamp(cx, -PX + 0.5, PX - 0.5); cz = clamp(cz, -PZ + 0.6, PZ - 0.6);
    aller(j, cx, cz, vmax, dt);
    // le tacle de l'IA, sur le porteur d'en face
    j.essai -= dt;
    const p = b.porteur;
    if (p && p.e !== j.e && !j.perso.occupe && j.essai <= 0 && p.pos.distanceTo(j.pos) < 1.45) {
      j.essai = 0.6;
      if (Math.random() < (p === humain ? 0.36 : 0.22)) tacler(j);
    }
  }

  /** le gardien : sur la bissectrice, il sort sur une balle lâche dans sa surface, plonge sur les frappes */
  function majGardien(k, dt) {
    const zb = butDe(k.e), dedans = -Math.sign(zb);
    // les clips du gardien durent trois secondes : on les écourte pour qu'il revienne au jeu
    if (k.lance) { k.lance.dans -= dt; if (k.lance.dans <= 0) { const f = k.lance.f; k.lance = null; f(); } }
    if (k.finGeste > 0) { k.finGeste -= dt; if (k.finGeste <= 0) { k.perso.arreterPonctuel(); k.perso.loco(0, { force: 'k_idle', fade: 0.35 }); } }
    const t = b.tir;
    if (b.garde === k) {
      aller(k, k.pos.x, k.pos.z, 0, dt, { regard: dedans > 0 ? 0 : Math.PI });
      k.attente = (k.attente ?? 0.9) - dt;
      if (k.attente <= 0 && !k.lance) {
        k.attente = 3;
        const cible = choisirPartenaire(k, 0, dedans);
        if (cible) passer(k, cible, { mains: true });
      }
      return;
    }
    k.attente = 0.9;
    if (t && t.gardien === k) {
      const age = temps - t.depart;
      if (!t.plonge && age > t.reaction) {
        const ecart = t.croiseX - k.pos.x, restant = Math.max(0.05, t.t - age), portee = Math.abs(ecart);
        let arrete = false, anim = 'k_idle', dx = 0;
        if (Math.abs(t.croiseX) > BUT.dl + 0.2 || t.croiseY > BUT.h + 0.15) { /* à côté : il regarde passer */ }
        else if (portee < 0.5) { arrete = t.croiseY < 1.85 && Math.random() < 0.9 - (t.vitesse - 14) * 0.012; anim = t.croiseY > 1.3 ? 'k_catch' : 'k_block'; dx = ecart; }
        else {
          const atteint = portee < 1.1 + restant * 3.6;
          const coin = (portee > 1.2 ? 0.2 : 0) + (t.croiseY > 1.45 || t.croiseY < 0.3 ? 0.14 : 0);
          arrete = atteint && Math.random() < 0.86 - coin - (t.vitesse - 14) * 0.015;
          // le côté de la plongée, vu du gardien
          anim = (ecart > 0) === (dedans > 0) ? 'k_dive_r' : 'k_dive_l';
          dx = arrete ? ecart : ecart * 0.6;
        }
        t.plonge = { arrete, x0: k.pos.x, dx, t0: age, duree: Math.max(0.2, restant), fait: false };
        if (anim !== 'k_idle') { k.perso.jouer(anim, { fade: 0.06, timeScale: 1.3 }); k.finGeste = Math.max(1.2, t.t - age + 0.9); }
      }
      if (t.plonge) {
        const u = clamp((age - t.plonge.t0) / t.plonge.duree, 0, 1);
        k.pos.x = clamp(t.plonge.x0 + t.plonge.dx * (1 - (1 - u) * (1 - u)), -BUT.dl - 0.4, BUT.dl + 0.4);
        if (t.plonge.arrete && !t.plonge.fait && (b.pos.z - (k.pos.z + dedans * 0.3)) * dedans < 0) {
          t.plonge.fait = true;
          banc.stats.arrets++;
          b.tir = null;
          if (t.vitesse < 20 && t.croiseY < 1.6 && Math.random() < 0.55) {
            b.garde = k; b.vel.set(0, 0, 0);
          } else {
            b.vel.set((Math.random() - 0.5) * 5 + Math.sign(b.pos.x || 1) * 3, 2 + Math.random() * 2, dedans * (3 + Math.random() * 3));
            b.dernier = k; b.dernierT = temps;
          }
          if (k.e === 0) vibrer(10);
        }
      }
      k.vel.set(0, 0, 0);
      return;
    }
    // balle lâche dans sa surface, plus près de lui que de tout autre : il sort la prendre
    const dBut = Math.hypot(b.pos.x, b.pos.z - zb);
    const libre = !b.porteur && !b.garde;
    let cx = clamp(b.pos.x * 0.28, -1.1, 1.1), cz = zb + dedans * 0.7, vmax = 4;
    if (libre && dBut < SURFACE - 0.5 && Math.hypot(b.vel.x, b.vel.z) < 9) {
      const dk = k.pos.distanceTo(b.pos);
      if (champ.every((o) => o.pos.distanceTo(b.pos) > dk - 0.3)) { cx = b.pos.x; cz = b.pos.z; vmax = 5.4; }
    }
    if (k.perso.occupe) { k.vel.set(0, 0, 0); return; }
    aller(k, cx, cz, vmax, dt);
    // face au jeu, tourné vers la balle d'un radian au plus
    const base = dedans > 0 ? 0 : Math.PI;
    let ecart = Math.atan2(b.pos.x - k.pos.x, b.pos.z - k.pos.z) - base;
    while (ecart > Math.PI) ecart -= 2 * Math.PI; while (ecart < -Math.PI) ecart += 2 * Math.PI;
    k.cap = base + clamp(ecart, -1, 1);
  }

  function majBalle(dt) {
    if (b.garde) {
      b.garde.perso.osMonde('RightHand', tmp); b.garde.perso.osMonde('LeftHand', tmp2);
      tmp.add(tmp2).multiplyScalar(0.5);
      monde.worldToLocal(tmp);
      b.pos.copy(tmp); b.vel.set(0, 0, 0);
    } else if (b.porteur) {
      // la conduite : la balle devant le pied, à petites touches au rythme de la course
      const j = b.porteur;
      const v = Math.hypot(j.vel.x, j.vel.z);
      const avance = 0.45 + Math.min(1.0, v * 0.12) + Math.sin(temps * (6 + v)) * 0.11 * Math.min(1, v / 3);
      tmp.set(Math.sin(j.cap), 0, Math.cos(j.cap)).multiplyScalar(avance).add(j.pos);
      const nom = j.perso.ponctuelNom;
      if (nom && /shoot|strike|pass/.test(nom)) tmp.copy(b.pos); // la balle attend le pied
      tmp.y = R;
      const avant = tmp2.copy(b.pos);
      b.pos.lerp(tmp, Math.min(1, dt * 14));
      b.vel.copy(b.pos).sub(avant).divideScalar(Math.max(dt, 1e-4));
    } else {
      b.vel.y -= G * dt;
      b.pos.addScaledVector(b.vel, dt);
      if (b.pos.y < R) {
        b.pos.y = R;
        if (b.vel.y < -1.2) { b.vel.y = -b.vel.y * 0.5; b.vel.x *= 0.88; b.vel.z *= 0.88; }
        else {
          b.vel.y = 0;
          const v = Math.hypot(b.vel.x, b.vel.z);
          if (v > 0) { const nv = Math.max(0, v - FROT * dt - v * 0.12 * dt); b.vel.x *= nv / v; b.vel.z *= nv / v; }
        }
      }
      // le but : la balle passe la ligne entre les poteaux, sous la barre
      for (const e of [0, 1]) {
        const zb = butDe(e), s = Math.sign(zb);
        const avant = b.pos.z - b.vel.z * dt;
        if ((avant - zb) * s < 0 && (b.pos.z - zb) * s >= 0) {
          const ax = Math.abs(b.pos.x);
          if (ax < BUT.dl - R && b.pos.y < BUT.h - R) { but(1 - e); }
          else if ((ax < BUT.dl + R && b.pos.y < BUT.h + R) && (ax > BUT.dl - R || b.pos.y > BUT.h - R)) {
            // poteau ou barre
            b.pos.z = zb - s * R; b.vel.z *= -0.55; b.vel.x += (Math.random() - 0.5) * 2;
          }
        }
        // dans le filet
        if (etat.phase === 'but' && Math.abs(b.pos.x) < BUT.dl && (b.pos.z - (zb + s * (BUT.p - R))) * s > 0) {
          b.pos.z = zb + s * (BUT.p - R); b.vel.z *= -0.15; b.vel.x *= 0.5;
        }
      }
      // les panneaux et les filets : tout rebondit
      if (Math.abs(b.pos.x) > PX) { b.pos.x = Math.sign(b.pos.x) * PX; b.vel.x *= -0.62; }
      if (Math.abs(b.pos.z) > PZ) { b.pos.z = Math.sign(b.pos.z) * PZ; b.vel.z *= -0.62; }
      // le côté extérieur du filet : une balle qui passe derrière le but ne rentre pas par l'arrière
      for (const e of [0, 1]) {
        const zb = butDe(e), s = Math.sign(zb);
        if (etat.phase !== 'but' && Math.abs(b.pos.x) < BUT.dl + R && (b.pos.z - zb) * s > 0.02 && (b.pos.z - zb) * s < BUT.p && b.pos.y < BUT.h) {
          b.pos.x = Math.sign(b.pos.x || 1) * (BUT.dl + R); b.vel.x *= -0.5;
        }
      }
      if (b.tir && temps - b.tir.depart > b.tir.t + 0.6) b.tir = null;
    }
    // la rotation du ballon
    const v = Math.hypot(b.vel.x, b.vel.z);
    if (v > 0.01) balle.rotateOnWorldAxis(versMonde(tmp.set(b.vel.z, 0, -b.vel.x).normalize(), w), (v / R) * dt);
    balle.position.copy(b.pos);
    ombreBalle.position.set(b.pos.x, 0.045, b.pos.z);
    ombreBalle.material.opacity = 1;
  }

  /** qui récupère une balle libre : le plus proche à portée, sauf celui qui vient de la toucher */
  function majPrise() {
    if (b.porteur || b.garde || etat.phase !== 'jeu') return;
    if (b.pos.y > 1.15) return;
    let best = null, bd = Infinity;
    const vb = Math.hypot(b.vel.x, b.vel.z);
    for (const j of joueurs) {
      if (j.sonne > 0) continue;
      if (j === b.dernier && temps - b.dernierT < 0.32) continue;
      // une frappe : c'est le plongeon qui décide pour le gardien visé ; un joueur de champ ne la contre que basse
      if (b.tir && j === b.tir.gardien) continue;
      if (b.tir && !j.gardien && b.pos.y > 0.55) continue;
      const d = Math.hypot(j.pos.x - b.pos.x, j.pos.z - b.pos.z);
      const portee = j.gardien ? 0.95 : 0.72;
      if (d < portee && d < bd) {
        if (j.gardien && Math.hypot(b.pos.x, b.pos.z - butDe(j.e)) > SURFACE) continue;
        best = j; bd = d;
      }
    }
    if (!best) return;
    if (best.gardien) { b.garde = best; b.tir = null; b.recepteur = null; best.attente = 0.9; best.perso.jouer('k_scoop', { fade: 0.1, timeScale: 1.6 }); best.finGeste = 1.1; return; }
    // une balle très rapide qui n'était pas pour lui : il la dévie une fois sur deux
    if (vb > 15 && best !== b.recepteur && Math.random() < 0.5) {
      b.vel.multiplyScalar(0.35); b.vel.x += (Math.random() - 0.5) * 4; b.vel.y = 1.2;
      b.dernier = best; b.dernierT = temps; b.tir = null;
      return;
    }
    b.porteur = best; b.recepteur = null; b.tir = null;
    if (best.e === 0) { humain = best; changeT = temps; }
  }

  /** la main passe au Noir le plus près de la balle quand on défend */
  function majChangement() {
    if (b.porteur?.e === 0 && !b.porteur.gardien) { humain = b.porteur; return; }
    if (b.recepteur?.e === 0 && !b.recepteur.gardien) { humain = b.recepteur; return; }
    if (temps - changeT < 0.6) return;
    let best = humain, bd = humain.pos.distanceTo(b.pos);
    for (const j of equipe(0)) { const d = j.pos.distanceTo(b.pos); if (d < bd - 2) { bd = d; best = j; } }
    if (best !== humain) { humain = best; changeT = temps; }
  }

  function separer() {
    for (let i = 0; i < joueurs.length; i++) for (let k = i + 1; k < joueurs.length; k++) {
      const a = joueurs[i], c = joueurs[k];
      const dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.001 && d < 0.68) {
        const p = (0.68 - d) / 2;
        a.pos.x -= (dx / d) * p; a.pos.z -= (dz / d) * p;
        c.pos.x += (dx / d) * p; c.pos.z += (dz / d) * p;
      }
    }
  }

  function poser(j, dt) {
    if (!j.gardien) { j.pos.x = clamp(j.pos.x, -PX + 0.35, PX - 0.35); j.pos.z = clamp(j.pos.z, -PZ + 0.35, PZ - 0.35); }
    j.perso.racine.position.copy(j.pos);
    j.perso.racine.rotation.y = j.cap;
    j.ombre.position.set(j.pos.x, 0.04, j.pos.z);
    const v = Math.hypot(j.vel.x, j.vel.z);
    if (!j.perso.occupe && etat.phase !== 'fin' && etat.phase !== 'but') {
      if (j.gardien) {
        const lat = j.vel.x * Math.cos(j.cap) - j.vel.z * Math.sin(j.cap);
        j.perso.loco(0, { force: v < 0.5 ? 'k_idle' : Math.abs(lat) > v * 0.6 ? (lat > 0 ? 'k_side_r' : 'k_side_l') : 'k_idle' });
      } else j.perso.loco(v);
    }
    // penché dans les virages, un peu en avant au sprint
    if (!j.gardien) j.perso.pencher(lerp(j.perso.corps.rotation.z, 0, dt * 6), lerp(j.perso.corps.rotation.x, v > 5.6 ? 0.08 : 0, dt * 4));
    j.sonne = Math.max(0, j.sonne - dt);
    j.intouchable = Math.max(0, j.intouchable - dt);
  }

  function but(e) {
    if (etat.phase !== 'jeu') return;
    if (e === 0) etat.noirs++; else etat.blancs++;
    banc.stats.buts++;
    const tireur = b.dernier && b.dernier.e === e ? b.dernier : joueurs.find((j) => j.e === e && j.role === 'A');
    etat.phase = 'but';
    etat.message = 'BUT';
    etat.buteur = tireur === moi ? 'moi' : e === 0 ? 'noirs' : 'blancs';
    horlogePhase = 3.2;
    b.tir = null; b.recepteur = null;
    cam.buteur = tireur;
    if (!reduit) { ralenti = 0.3; ralentiFin = 1.1; }
    if (e === 0) {
      vibrer([30, 40, 60]);
      const cel = ['victory', 'fist_pump', 'cheering'][Math.floor(Math.random() * 3)];
      setTimeout(() => { if (etat.phase === 'but') tireur.perso.jouer(cel, { fade: 0.25 }); }, 350);
    } else {
      setTimeout(() => { if (etat.phase === 'but') tireur.perso.jouer('fist_pump', { fade: 0.25 }); }, 350);
    }
    signaler();
  }

  function fin() {
    etat.phase = 'fin';
    etat.message = null;
    const gagne = etat.noirs > etat.blancs;
    for (const j of joueurs) {
      j.vel.set(0, 0, 0);
      if (j.gardien) { j.perso.arreterPonctuel(); j.perso.loco(0, { force: 'k_idle' }); continue; }
      const heureux = (j.e === 0) === gagne && etat.noirs !== etat.blancs;
      if (heureux) j.perso.jouer(j === moi ? 'samba' : 'clapping', { fade: 0.3 });
      else { j.perso.arreterPonctuel(); j.perso.loco(0); }
    }
    if (!gagne && etat.noirs === etat.blancs) moi.perso.jouer('clapping', { fade: 0.3 });
    signaler();
  }

  const horlogeTexte = (s) => { const t = Math.max(0, Math.ceil(s)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

  function majCamera(dt) {
    const face = etat.phase === 'intro' || etat.phase === 'fin' || etat.phase === 'attente' || (etat.phase === 'but' && horlogePhase < 2.6);
    let voulu, regard;
    if (face) {
      const j = etat.phase === 'but' && cam.buteur ? cam.buteur : moi;
      const ang = j.cap + (etat.phase === 'intro' || etat.phase === 'attente' ? 0.35 : -0.5);
      const d = etat.phase === 'intro' || etat.phase === 'attente' ? 3.4 : 4.6; // la célébration : en pied
      voulu = tmp.set(j.pos.x + Math.sin(ang) * d, 1.7, j.pos.z + Math.cos(ang) * d);
      regard = tmp2.copy(j.pos).setY(1.45);
    } else {
      // le plan de la télé : en hauteur dans la tribune, le long du terrain (côté opposé au commentateur), qui suit
      // la balle en travelling ; les Noirs attaquent vers la droite de l'écran
      cam.foyer.lerp(tmp2.set(b.pos.x + b.vel.x * 0.2, 0, b.pos.z + b.vel.z * 0.35), Math.min(1, dt * 2.6));
      const large = cw > ch;
      const fx = clamp(cam.foyer.x, -6, 6), fz = clamp(cam.foyer.z, -(large ? 6 : 11), large ? 6 : 11);
      voulu = tmp.set(large ? 21 : 15.5, large ? 12.5 : 11, fz);
      regard = tmp2.set(fx * 0.3 + (large ? -1 : 0.6), 0, fz);
    }
    const k = Math.min(1, dt * (face ? 2.2 : 3));
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
    if (moyenne > 24 && e > 0.55) e = Math.max(0.55, e - 0.1);
    else if (moyenne < 15 && e < 1) e = Math.min(1, e + 0.05);
    if (e !== echelle) { echelle = e; compte = 0; taille(); }
  }

  function boucle(ms) {
    raf = requestAnimationFrame(boucle);
    adapter(ms);
    horloge.update(ms);
    const dt0 = Math.min(0.05, horloge.getDelta());
    for (let i = 0; i < banc.pas; i++) etape(dt0);
    const p = etat.phase;
    const h = humain;
    anneau.visible = p === 'jeu' || p === 'engagement';
    anneau.position.set(h.pos.x, 0.05, h.pos.z);
    peindreEcran(`${etat.noirs}-${etat.blancs}-${horlogeTexte(etat.reste)}`, etat.noirs, etat.blancs, horlogeTexte(etat.reste));
    majCamera(dt0);
    if (banc.rendu) pl.rendre(ms / 1000);
  }

  function etape(dtReel) {
    let dt = dtReel;
    if (ralentiFin > 0) { ralentiFin -= dt; if (ralentiFin <= 0) ralenti = 1; }
    dt *= ralenti;
    temps += dt;
    const p = etat.phase;
    if (p === 'jeu') {
      majChangement();
      for (const j of champ) (j === humain && !banc.auto ? majHumain : majIA)(j, dt);
      for (const k of gardiens) majGardien(k, dt);
      for (const j of joueurs) j.pos.addScaledVector(j.vel, dt);
      separer();
      majPrise();
      etat.reste -= dt;
      const s = Math.ceil(etat.reste);
      if (s !== derniereSeconde) { derniereSeconde = s; signaler(); }
      if (etat.reste <= 0 && !b.tir) { etat.reste = 0; fin(); }
    } else if (p === 'but' || p === 'fin') {
      for (const j of joueurs) { j.vel.multiplyScalar(Math.max(0, 1 - dt * 4)); j.pos.addScaledVector(j.vel, dt); }
    }
    if (p === 'jeu' || p === 'but' || p === 'fin' || p === 'engagement') majBalle(dt);
    if (p === 'but') {
      horlogePhase -= dtReel;
      if (horlogePhase <= 0) {
        if (etat.reste <= 0) fin();
        else { engagement(etat.buteur === 'blancs' ? 0 : 1); etat.phase = 'engagement'; horlogePhase = reduit ? 0.3 : 1.1; signaler(); }
      }
    } else if (p === 'intro' || p === 'engagement') {
      horlogePhase -= dtReel;
      if (horlogePhase <= 0) { etat.phase = 'jeu'; signaler(); }
    }
    for (const j of joueurs) { poser(j, dt); j.perso.update(dt); }
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
  engagement(0);
  for (const j of joueurs) poser(j, 0);
  majBalle(0);
  cam.foyer.copy(b.pos);
  {
    const ang = moi.cap + 0.35;
    cam.pos.set(moi.pos.x + Math.sin(ang) * 3.4, 1.75, moi.pos.z + Math.cos(ang) * 3.4);
    cam.regard.copy(moi.pos).setY(1.45);
  }
  surProgres(1);
  raf = requestAnimationFrame(boucle);
  signaler();

  return {
    demarrer() {
      etat.noirs = 0; etat.blancs = 0; etat.reste = duree; etat.message = null; etat.buteur = null;
      derniereSeconde = -1;
      engagement(0);
      etat.phase = 'intro';
      horlogePhase = reduit ? 0.3 : 1.6;
      signaler();
    },
    // banc d'essai : l'état, pour les captures (?banc)
    _test: {
      etat, joueurs, b, pouce, moi, banc, anneau,
      get humain() { return humain; },
      frapper: (dx, dy, f) => pouce.surLancer(dx, dy, f),
      toucher: () => pouce.surTouche(),
      // sans l'intro : le coup d'envoi tout de suite
      lancer: () => { etat.noirs = 0; etat.blancs = 0; etat.reste = duree; engagement(0); etat.phase = 'jeu'; derniereSeconde = -1; signaler(); },
    },
    detruire() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      pouce.detruire();
      for (const j of joueurs) j.perso.liberer();
      pl.composer.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
