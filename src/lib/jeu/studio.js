// Le studio des avatars (/jouer/studio) : les joueurs tels qu'ils apparaissent dans le jeu, en rang sur un sol noir,
// lumière de studio. On tourne autour au doigt ; un joueur touché passe devant. Sert à Sabri pour juger la technique
// (tenue peinte, grosse tête à la photo du studio) et à corriger un cadrage de visage raté.
import * as THREE from 'three';
import { analyserPhoto, creerTete } from './tete.js';
import { creerPersonnage } from './personnage.js';

const POSES = ['idle', 'victory', 'fist_pump', 'samba', 'jog', 'shoot'];

export function creerStudio(conteneur, { surChoix } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  conteneur.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0b);
  scene.fog = new THREE.Fog(0x0a0a0b, 9, 22);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  // lumière de studio : une douche principale, un contre-jour froid, un fond doux
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.3));
  const cle = new THREE.DirectionalLight(0xffffff, 3.0);
  cle.position.set(3, 6, 5);
  cle.castShadow = true;
  cle.shadow.mapSize.set(1024, 1024);
  Object.assign(cle.shadow.camera, { left: -8, right: 8, top: 6, bottom: -2, near: 1, far: 20 });
  scene.add(cle);
  const contre = new THREE.DirectionalLight(0xbcd2ff, 1.6);
  contre.position.set(-4, 4, -5);
  scene.add(contre);
  const sol = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.85 }));
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);
  // le cercle de lumière au sol, sous le rang
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(1, 64),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.002;
  scene.add(halo);

  let joueurs = []; // { nom, perso, x }
  let choisi = 0;
  let pose = 'idle';
  let jeton = 0;
  // orbite : angle autour du joueur choisi
  let az = 0.35, azCible = 0.35, el = 0.12;
  let regard = new THREE.Vector3(), regardCible = new THREE.Vector3();
  let distance = 4.2;

  const horloge = new THREE.Timer();
  let raf = 0;
  function boucle(t) {
    raf = requestAnimationFrame(boucle);
    horloge.update(t);
    const dt = Math.min(0.05, horloge.getDelta());
    for (const j of joueurs) {
      j.perso.update(dt);
    }
    az += (azCible - az) * Math.min(1, dt * 4);
    regard.lerp(regardCible, Math.min(1, dt * 3));
    camera.position.set(regard.x + Math.sin(az) * distance, 1.15 + Math.sin(el) * distance, regard.z + Math.cos(az) * distance);
    camera.lookAt(regard.x, 1.05, regard.z);
    halo.position.x += (regardCible.x - halo.position.x) * Math.min(1, dt * 4);
    renderer.render(scene, camera);
  }

  function taille() {
    const w = conteneur.clientWidth || 1, h = conteneur.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    // en portrait, on recule pour garder le joueur entier
    distance = w < h ? 5.6 : 4.2;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(taille);
  ro.observe(conteneur);
  taille();
  raf = requestAnimationFrame(boucle);

  // tourner au doigt
  let glisse = null;
  const el_ = renderer.domElement;
  el_.addEventListener('pointerdown', (e) => { glisse = { x: e.clientX, az: azCible, t: performance.now(), dx: 0 }; el_.setPointerCapture(e.pointerId); });
  el_.addEventListener('pointermove', (e) => { if (!glisse) return; glisse.dx = e.clientX - glisse.x; azCible = glisse.az - glisse.dx * 0.008; });
  el_.addEventListener('pointerup', (e) => {
    const g = glisse; glisse = null;
    if (!g || Math.abs(g.dx) > 6) return;
    // un toucher : le joueur sous le doigt passe devant
    const r = el_.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(v, camera);
    let best = null, bd = Infinity;
    for (const j of joueurs) {
      const p = j.perso.racine.position.clone().setY(1);
      const d = ray.ray.distanceToPoint(p);
      if (d < 0.6 && d < bd) { bd = d; best = j; }
    }
    if (best) { choisir(best.i); surChoix?.(best.nom); }
  });

  function choisir(i) {
    choisi = Math.max(0, Math.min(joueurs.length - 1, i));
    const j = joueurs[choisi];
    if (j) regardCible.set(j.x, 0, 0);
  }

  function jouerPose(j) {
    const name = pose;
    if (!j.perso.actions[name]) return;
    const loopee = j.perso.clips[name].userData.loop;
    if (loopee || name === 'idle') j.perso.boucle(name);
    else j.perso.jouer(name, { surFin: () => j.perso.jouer(name, { surFin: () => j.perso.boucle('idle') }) });
  }

  /** Montre ces joueurs : [{ nom, photo, tenue, decalage, joueuse }] ; renvoie leurs analyses (cadrage du visage). */
  async function montrer(liste, indexChoisi = 0) {
    const mon = ++jeton;
    const ecart = 1.25;
    const nouveaux = [];
    const analyses = {};
    await Promise.all(liste.map(async (d, i) => {
      let analyse = null;
      try { analyse = d.photo ? await analyserPhoto(d.photo, d.decalage) : null; } catch { analyse = null; }
      analyses[d.nom] = analyse;
      const tete = creerTete(analyse, { statue: d.tenue === 'marbre' ? 0xe9e6df : d.tenue === 'obsidienne' ? 0x1a1a1c : null });
      const perso = await creerPersonnage({ modele: d.joueuse ? 'femme' : 'homme', tenue: d.tenue ?? 'noirs', tete, peau: analyse?.peau, packs: ['player', 'celeb'] });
      const x = (i - (liste.length - 1) / 2) * ecart;
      perso.racine.position.set(x, 0, 0);
      nouveaux.push({ nom: d.nom, perso, x, i });
    }));
    if (mon !== jeton) { for (const j of nouveaux) j.perso.liberer(); return analyses; }
    for (const j of joueurs) { scene.remove(j.perso.racine); j.perso.liberer(); }
    joueurs = nouveaux.sort((a, b) => a.i - b.i);
    for (const j of joueurs) { scene.add(j.perso.racine); jouerPose(j); }
    halo.scale.setScalar(1.2);
    choisir(indexChoisi);
    regard.copy(regardCible);
    return analyses;
  }

  return {
    montrer,
    choisir,
    poses: POSES,
    poser(nom) { pose = nom; for (const j of joueurs) jouerPose(j); },
    tourner(da) { azCible += da; },
    capture() { return renderer.domElement.toDataURL('image/png'); },
    detruire() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      for (const j of joueurs) j.perso.liberer();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
