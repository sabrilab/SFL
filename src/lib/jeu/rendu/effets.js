// Les effets de la vue (bola-app#26, lot 4) : les ombres de contact des joueurs, l'herbe qui marque, le filet du but
// qui bouge. Rien ici ne touche à la simulation : ce sont des lectures de ce que l'écran montre (les os posés) et des
// événements du monde (balleChoc). Trois appels de dessin en tout, quelle que soit la scène :
//
//   - LES OMBRES DE CONTACT (creerOmbres) : un seul maillage instancié pour tout le terrain (il y avait un disque par
//     joueur et un pour le ballon : 11 appels de dessin, 1 maintenant). Par joueur : une tache sous le bassin, allongée
//     à l'opposé du projecteur le plus proche (les deux projecteurs du portique, au-dessus des lignes de touche, plateau.js
//     PROJECTEURS), plus longue et suivant le corps quand il est au sol (tacle glissé, chute) ; et une petite ellipse sous
//     chaque pied, dans l'axe du pied, qui s'efface quand le pied se lève (35 cm). Le ballon : une tache qui pâlit et
//     s'élargit quand il monte. Les joueurs ne projettent toujours pas d'ombre calculée (trop cher en mouvement).
//   - L'HERBE QUI MARQUE (creerMarques) : une toile 256 × 160 (12,5 cm par pixel) posée sur le gazon (repère du jeu, 20 × 32 m), où l'on
//     peint à la volée la trace d'un corps qui glisse (bassin à moins de 40 cm du sol qui avance : tacle glissé, glissade
//     de joie, chute lancée) — herbe couchée plus claire bordée de terre — et la griffure d'un appui fort. Tout s'efface
//     en 20 s. La toile n'est renvoyée à la carte graphique que lorsqu'elle change (au plus 2 fois par seconde ; l'effacement, une fois toutes les 4 s).
//   - LE FILET QUI BOUGE (creerFilet) : le filet des buts du plateau (st_filets_buts, 16 triangles) est redécoupé en
//     1 024 triangles au chargement, et chaque choc du ballon y lance une onde locale (gaussienne de 45 cm, amortie en
//     0,3 s, au plus 28 cm), calculée dans le shader des sommets : rien par image côté JS que deux uniformes.
import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;

// ─────────────────────────── l'onde du filet (le même calcul que le shader ; lu par le banc) ───────────────────────────
export const FILET = { sigma: 0.45, omega: 13.8, tau: 0.3, max: 0.28, parMs: 0.018, vie: 2.2 };
// le maximum de sin(ωt)·e^(−t/τ) (atteint quand tan(ωt) = ωτ) : la force est ramenée à « au plus FILET.max »
const PIC = (() => { const t = Math.atan(FILET.omega * FILET.tau) / FILET.omega; return Math.sin(FILET.omega * t) * Math.exp(-t / FILET.tau); })();
/** Le déplacement du filet (m) à d m du choc, age s après, pour un ballon à vn m/s. */
export function ondeFilet(d, age, vn, F = FILET) {
  if (age < 0 || age > F.vie) return 0;
  const force = Math.min(F.max, vn * F.parMs) / PIC;
  return force * Math.exp(-(d * d) / (2 * F.sigma * F.sigma)) * Math.sin(F.omega * age) * Math.exp(-age / F.tau);
}

// ─────────────────────────── les ombres de contact ───────────────────────────
const PROJ = [{ x: -14, z: 0, h: 15.6 }, { x: 14, z: 0, h: 15.6 }]; // les deux projecteurs du portique (repère du jeu)

/** La forme des ombres d'un joueur : lue par le banc (sans three). Écrit dans out [cx, cz, sx, sz, angle, opacité] ×3. */
export function formeOmbres(h, pg, pd, tete, out) {
  // h : bassin {x,y,z} ; pg, pd : pieds {x,y,z, ax, az (axe du pied)} ; tete : {x,y,z}
  let lx = 0, lz = 0;
  for (const P of PROJ) { const dx = h.x - P.x, dz = h.z - P.z, d = Math.hypot(dx, dz) || 1, w = 1 / (d * d); lx += (dx / d) * w; lz += (dz / d) * w; }
  const ll = Math.hypot(lx, lz) || 1; lx /= ll; lz /= ll;
  const sol = clamp((0.62 - h.y) / 0.4, 0, 1); // 0 debout, 1 couché
  const haut = clamp((h.y - 1.05) / 0.6, 0, 1); // en l'air (saut, tête)
  // au sol : la tache suit le corps (du bassin à la tête), sinon l'axe de la lumière
  const bx = tete.x - h.x, bz = tete.z - h.z, bl = Math.hypot(bx, bz);
  const axe = sol > 0.05 && bl > 0.2 ? Math.atan2(bx, bz) : Math.atan2(lx, lz);
  const long = 1.05 + sol * 1.0, large = 0.78 + sol * 0.05;
  const decal = 0.12 + sol * bl * 0.45;
  const ux = sol > 0.05 && bl > 0.2 ? bx / bl : lx, uz = sol > 0.05 && bl > 0.2 ? bz / bl : lz;
  out[0] = h.x + ux * decal; out[1] = h.z + uz * decal; out[2] = large * (1 - haut * 0.3); out[3] = long * (1 - haut * 0.3); out[4] = axe;
  out[5] = 0.78 * (1 - haut * 0.6);
  let i = 6;
  for (let q = 0; q < 2; q++) {
    const p = q ? pd : pg;
    const lev = clamp((p.y - 0.06) / 0.3, 0, 1);
    out[i] = p.x + p.ax * 0.05; out[i + 1] = p.z + p.az * 0.05; out[i + 2] = 0.2; out[i + 3] = 0.36; out[i + 4] = Math.atan2(p.ax, p.az);
    out[i + 5] = 0.9 * (1 - lev) * (1 - sol * 0.7);
    i += 6;
  }
  return out;
}

function texTache() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.62)'); gr.addColorStop(0.8, 'rgba(0,0,0,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** n joueurs (3 taches chacun) + le ballon, dans le groupe parent (repère du jeu). */
export function creerOmbres(parent, n) {
  const N = n * 3 + 1;
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const op = new Float32Array(N);
  const attr = new THREE.InstancedBufferAttribute(op, 1); attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aOpacite', attr);
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: texTache() } },
    transparent: true, depthWrite: false, fog: false,
    vertexShader: `attribute float aOpacite; varying float vO; varying vec2 vUv;
      void main() { vUv = uv; vO = aOpacite; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; varying float vO; varying vec2 vUv;
      void main() { float a = texture2D(map, vUv).a * vO; if (a < 0.004) discard; gl_FragColor = vec4(0.0, 0.0, 0.0, a); }`,
  });
  const im = new THREE.InstancedMesh(geo, mat, N);
  im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  im.frustumCulled = false; im.renderOrder = 2; im.name = 'ombres_contact';
  parent.add(im);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const forme = new Float32Array(18);
  const h = { x: 0, y: 0, z: 0 }, tete = { x: 0, y: 0, z: 0 }, pg = { x: 0, y: 0, z: 0, ax: 0, az: 1 }, pd = { x: 0, y: 0, z: 0, ax: 0, az: 1 };
  const w = new THREE.Vector3(), w2 = new THREE.Vector3(), bout = { x: 0, y: 0, z: 0 };
  // monde → jeu (le groupe du jeu est tourné d'un quart de tour : jeu (x, z) → monde (z, -x))
  const versJeu = (v, o) => { o.x = -v.z; o.y = v.y; o.z = v.x; return o; };
  function poser(i, cx, cz, sx, sz, ang, o, y) {
    p.set(cx, y, cz); q.setFromAxisAngle(Y, ang); s.set(sx, 1, sz);
    im.setMatrixAt(i, M.compose(p, q, s)); op[i] = o;
  }
  // ce que l'herbe qui marque lit : le bassin et le pied le plus bas de chaque joueur (repère du jeu), null s'il est absent
  const bassins = Array.from({ length: n }, () => null), pieds = Array.from({ length: n }, () => null);
  return {
    objet: im, bassins, pieds,
    /**
     * vus : les joueurs (perso, visibles) ; balle {x,y,z} ; après la pose des os de l'image. Les matrices des os sont
     * celles que l'animateur vient de calculer (il les remet à jour pour ses IK) ; majMatrices : les recalculer d'abord
     * (le ralenti, qui pose les os lui-même).
     */
    maj(vus, balle, majMatrices = false) {
      for (let k = 0; k < vus.length; k++) {
        const v = vus[k], os = v.perso.os, i = k * 3;
        if (!v.perso.racine.visible || !os.hips) { op[i] = op[i + 1] = op[i + 2] = 0; bassins[k] = null; pieds[k] = null; continue; }
        if (majMatrices) v.perso.racine.updateMatrixWorld(true);
        versJeu(w.setFromMatrixPosition(os.hips.matrixWorld), h);
        versJeu(w.setFromMatrixPosition((os.head ?? os.neck ?? os.hips).matrixWorld), tete);
        for (let q = 0; q < 2; q++) {
          const pied = q ? os.rightfoot : os.leftfoot, orteil = q ? os.righttoebase : os.lefttoebase, P = q ? pd : pg;
          if (!pied) { P.y = 9; continue; }
          versJeu(w.setFromMatrixPosition(pied.matrixWorld), P);
          if (orteil) { versJeu(w2.setFromMatrixPosition(orteil.matrixWorld), bout); const dx = bout.x - P.x, dz = bout.z - P.z, l = Math.hypot(dx, dz) || 1; P.ax = dx / l; P.az = dz / l; P.y = Math.min(P.y, bout.y); }
        }
        formeOmbres(h, pg, pd, tete, forme);
        const B = (bassins[k] ??= { x: 0, y: 0, z: 0 }); B.x = h.x; B.y = h.y; B.z = h.z;
        const bas = pg.y <= pd.y ? pg : pd, Pd = (pieds[k] ??= { x: 0, z: 0, ang: 0 }); Pd.x = bas.x; Pd.z = bas.z; Pd.ang = Math.atan2(bas.ax, bas.az);
        poser(i, forme[0], forme[1], forme[2], forme[3], forme[4], forme[5], 0.04);
        poser(i + 1, forme[6], forme[7], forme[8], forme[9], forme[10], forme[11], 0.041);
        poser(i + 2, forme[12], forme[13], forme[14], forme[15], forme[16], forme[17], 0.041);
      }
      const j = vus.length * 3, hb = Math.max(0, balle.y - 0.11);
      poser(j, balle.x, balle.z, 0.36 + hb * 0.12, 0.36 + hb * 0.12, 0, 0.75 * Math.max(0.15, 1 - hb / 3), 0.045);
      im.instanceMatrix.needsUpdate = true; attr.needsUpdate = true;
    },
    liberer() { geo.dispose(); mat.uniforms.map.value.dispose(); mat.dispose(); im.removeFromParent(); },
  };
}

// ─────────────────────────── l'herbe qui marque ───────────────────────────
export const MARQUES = { largeur: 20, longueur: 32, px: 256, py: 160, vie: 20, glisse: 0.4 };

/**
 * Les traces à peindre pour un joueur, d'après son bassin (repère du jeu) : une glissade quand le bassin est bas et
 * avance. Pur (le banc le rejoue sur un vrai tacle glissé). etat : un objet propre au joueur.
 */
export function traceGlisse(etat, h, t) {
  const bas = h.y < MARQUES.glisse;
  // (correctifs #26 : le point d'avant est mis à jour sur place, sans nouvel objet par image)
  const prec = etat.h;
  const px = prec?.x, pz = prec?.z, pt = prec?.t;
  if (prec) { prec.x = h.x; prec.z = h.z; prec.t = t; } else etat.h = { x: h.x, z: h.z, t };
  if (!bas || !prec || t - pt > 0.2) return null;
  const d = Math.hypot(h.x - px, h.z - pz), v = d / Math.max(1e-3, t - pt);
  if (d < 0.015 || v < 0.8 || d > 1.5) return null;
  return { x0: px, z0: pz, x1: h.x, z1: h.z, force: clamp((v - 0.8) / 4, 0.25, 1) };
}

export function creerMarques(parent) {
  const Mq = MARQUES;
  const c = document.createElement('canvas'); c.width = Mq.px; c.height = Mq.py;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(Mq.longueur, Mq.largeur).rotateX(-Math.PI / 2);
  // (la toile : u le long du terrain (z du jeu), v en travers (x du jeu))
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const o = new THREE.Mesh(geo, mat);
  o.rotation.y = Math.PI / 2; // le plan est fait le long de x : on le couche le long du z du jeu
  o.position.y = 0.036; o.renderOrder = 1; o.name = 'marques_gazon';
  parent.add(o);
  // jeu (x, z) → pixels de la toile (le plan couché : u = (16 − z) / 32, et la toile retournée : ligne 0 en x = −10)
  const versPx = (x, z) => [((Mq.longueur / 2 - z) / Mq.longueur) * Mq.px, ((x + Mq.largeur / 2) / Mq.largeur) * Mq.py];
  const echelle = Mq.px / Mq.longueur;
  let sale = false, envoi = 0, efface = 0, derniere = -1e9;
  const etats = [];
  function trait(T) {
    const [x0, y0] = versPx(T.x0, T.z0), [x1, y1] = versPx(T.x1, T.z1);
    g.lineCap = 'round';
    // la terre arrachée sur les bords, puis l'herbe couchée (plus claire, elle renvoie la lumière)
    g.strokeStyle = `rgba(58, 44, 26, ${0.22 * T.force})`; g.lineWidth = 0.42 * echelle; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = `rgba(205, 222, 176, ${0.2 * T.force})`; g.lineWidth = 0.26 * echelle; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    sale = true;
  }
  function crampons(x, z, ang) {
    // l'appui fort : l'herbe arrachée sous le pied, une petite griffure dans l'axe du pied (20 × 9 cm)
    const [px, py] = versPx(x, z);
    g.save(); g.translate(px, py); g.rotate(Math.atan2(Math.cos(ang), Math.sin(ang)));
    g.fillStyle = 'rgba(52, 40, 24, 0.22)'; g.beginPath(); g.ellipse(0, 0, 0.1 * echelle, 0.045 * echelle, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    sale = true;
  }
  return {
    objet: o,
    /** une image : t en secondes de jeu ; vus, leurs bassins (repère du jeu) lus par l'appelant ; appuis : [{x,z,ang}] */
    maj(t, bassins, appuis) {
      for (let i = 0; i < bassins.length; i++) {
        const e = (etats[i] ??= {});
        const T = bassins[i] ? traceGlisse(e, bassins[i], t) : null;
        if (T) { trait(T); derniere = t; }
      }
      for (const A of appuis) { crampons(A.x, A.z, A.ang); derniere = t; }
      // l'effacement : 60 % de l'opacité retirés toutes les 4 s (multiplicatif : 1 % au bout de 20 s)
      if (t - efface >= 4 && t - derniere < Mq.vie + 4) {
        efface = t;
        g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, Mq.px, Mq.py); g.globalCompositeOperation = 'source-over';
        sale = true;
      } else if (t - derniere >= Mq.vie + 4 && derniere > -1e9) { g.clearRect(0, 0, Mq.px, Mq.py); derniere = -1e9; sale = true; }
      if (t < efface) efface = t; // (un nouveau match)
      if (sale && (performance.now() - envoi > 500)) { tex.needsUpdate = true; sale = false; envoi = performance.now(); }
    },
    vider() { g.clearRect(0, 0, Mq.px, Mq.py); tex.needsUpdate = true; derniere = -1e9; for (const e of etats) if (e) e.h = null; },
    /** la toile renvoyée tout de suite (le banc de captures, qui fait des pas exacts entre deux images) */
    envoyer() { tex.needsUpdate = true; sale = false; },
    liberer() { geo.dispose(); tex.dispose(); mat.dispose(); o.removeFromParent(); },
  };
}

// ─────────────────────────── les impacts de l'élan ───────────────────────────
// L'ÉLAN (creerImpacts) : une onde blanche au sol qui s'ouvre et s'efface (départ d'une percée, charge qui emporte la
// balle, frappe surpuissante), et le sillage de la balle surpuissante (des points blancs qui s'éteignent derrière elle).
// La caméra ne bouge pas pour autant : l'impact est porté par le terrain, la balle, la manette et le son.
export const IMPACTS = { ondes: 6, vie: 0.45, points: 18, viePoint: 0.32, sillage: 0.9 };
/** Le rayon (m) et l'opacité d'une onde d'âge a (s), de force f (0..1). Pur. */
export function ondeImpact(a, f, I = IMPACTS) {
  const u = clamp(a / I.vie, 0, 1), k = 1 - (1 - u) * (1 - u) * (1 - u);
  return { r: 0.35 + (1.3 + 1.9 * f) * k, o: (0.35 + 0.5 * f) * (1 - u) * (1 - u) };
}
export function creerImpacts(parent) {
  const I = IMPACTS;
  const gOnde = new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2);
  const ondes = Array.from({ length: I.ondes }, () => {
    const o = new THREE.Mesh(gOnde, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    o.visible = false; o.renderOrder = 2; o.position.y = 0.045; parent.add(o);
    return { o, t0: -9, f: 0 };
  });
  const gPoint = new THREE.SphereGeometry(0.1, 10, 8);
  const points = Array.from({ length: I.points }, () => {
    const o = new THREE.Mesh(gPoint, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    o.visible = false; parent.add(o);
    return { o, t0: -9 };
  });
  let prochaine = 0, prochain = 0, sillageFin = -9, dernierPoint = -9;
  return {
    /** une onde au sol en (x, z), à l'heure de jeu t, de force f (0..1) */
    onde(t, x, z, f = 0.6) { const O = ondes[prochaine]; prochaine = (prochaine + 1) % ondes.length; O.t0 = t; O.f = f; O.o.position.x = x; O.o.position.z = z; },
    /** la balle laisse un sillage jusqu'à t + IMPACTS.sillage */
    sillage(t) { sillageFin = t + I.sillage; },
    /** une image : l'heure de jeu, la balle telle qu'elle est montrée */
    maj(t, b) {
      if (t < dernierPoint - 1) { sillageFin = -9; dernierPoint = -9; for (const O of ondes) O.t0 = -9; for (const P of points) P.t0 = -9; } // (un nouveau match)
      for (const O of ondes) {
        const a = t - O.t0, vu = a >= 0 && a < I.vie;
        O.o.visible = vu;
        if (vu) { const w = ondeImpact(a, O.f); O.o.scale.set(w.r, 1, w.r); O.o.material.opacity = w.o; }
      }
      if (t < sillageFin && t - dernierPoint >= 1 / 70) {
        const P = points[prochain]; prochain = (prochain + 1) % points.length;
        P.t0 = t; P.o.position.set(b.x, b.y, b.z); dernierPoint = t;
      }
      for (const P of points) {
        const a = t - P.t0, vu = a >= 0 && a < I.viePoint;
        P.o.visible = vu;
        if (vu) { const u = 1 - a / I.viePoint; P.o.material.opacity = 0.55 * u * u; P.o.scale.setScalar(0.35 + 0.65 * u); }
      }
    },
    vider() { sillageFin = -9; for (const O of ondes) { O.t0 = -9; O.o.visible = false; } for (const P of points) { P.t0 = -9; P.o.visible = false; } },
    liberer() { gOnde.dispose(); gPoint.dispose(); for (const O of ondes) { O.o.material.dispose(); O.o.removeFromParent(); } for (const P of points) { P.o.material.dispose(); P.o.removeFromParent(); } },
  };
}

// ─────────────────────────── le filet qui bouge ───────────────────────────
/** Découpe chaque triangle en 4^n (milieux des côtés) : positions, uv et normales interpolées (en flottants), géométrie sans index. */
export function decouper(geo, n) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const attrs = Object.keys(g.attributes).filter((k) => ['position', 'uv', 'normal'].includes(k));
  let tris = [];
  const P = g.attributes.position;
  // (getComponent : les attributs du GLB sont quantifiés — entiers normalisés — et parfois entrelacés)
  for (let i = 0; i < P.count; i += 3) tris.push([i, i + 1, i + 2].map((k) => Object.fromEntries(attrs.map((a) => [a, Array.from({ length: g.attributes[a].itemSize }, (_, c) => g.attributes[a].getComponent(k, c))]))));
  const mil = (a, b) => Object.fromEntries(attrs.map((k) => [k, a[k].map((x, c) => (x + b[k][c]) / 2)]));
  for (let r = 0; r < n; r++) {
    const s = [];
    for (const [a, b, c] of tris) { const ab = mil(a, b), bc = mil(b, c), ca = mil(c, a); s.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]); }
    tris = s;
  }
  const out = new THREE.BufferGeometry();
  for (const k of attrs) {
    const sz = g.attributes[k].itemSize, arr = new Float32Array(tris.length * 3 * sz);
    let o = 0; for (const t of tris) for (const v of t) for (let c = 0; c < sz; c++) arr[o++] = v[k][c];
    out.setAttribute(k, new THREE.BufferAttribute(arr, sz));
  }
  out.computeBoundingSphere();
  return out;
}

/** Le filet des buts du plateau (scene : la scène du plateau ; versMonde : jeu → monde). null s'il n'y en a pas. */
export function creerFilet(scene, versMonde) {
  const o = scene.getObjectByName('st_filets_buts');
  if (!o || !o.isMesh) return null;
  // (correctifs #26 : l'ancienne géométrie et l'ancien matériau sont rendus au GPU, et liberer() rend les nouveaux)
  const geo0 = o.geometry, mat0 = o.material;
  o.geometry = decouper(geo0, 3);
  geo0.dispose();
  const mat = mat0.clone();
  // les mailles du filet sont fines : en test alpha (0,3), les mipmaps les faisaient disparaître dès quelques mètres (le
  // filet du but ne se voyait presque pas). En transparence, le filet lointain devient un voile léger, le proche ses
  // mailles ; il ne cache rien (pas d'écriture de profondeur)
  // (la texture est en blanc prémultiplié : ses couleurs s'assombrissent avec ses mailles ; on garde la teinte du filet
  // et on ne lit dans la texture que la couverture des mailles, × 1,5 : de loin, un voile clair)
  mat.alphaTest = 0.02; mat.transparent = true; mat.depthWrite = false;
  if (mat.map) mat.map.anisotropy = 8;
  o.renderOrder = 1;
  const impacts = [new THREE.Vector4(0, 0, 0, -1), new THREE.Vector4(0, 0, 0, -1)], dirs = [new THREE.Vector4(), new THREE.Vector4()];
  const F = FILET;
  mat.onBeforeCompile = (s) => {
    s.uniforms.uImpact = { value: impacts }; s.uniforms.uDir = { value: dirs };
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = diffuse; diffuseColor.a = min( 1.0, diffuseColor.a * 1.5 );');
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform vec4 uImpact[2]; uniform vec4 uDir[2];')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        for (int i = 0; i < 2; i++) { float a = uImpact[i].w;
          if (a >= 0.0 && a < ${F.vie.toFixed(2)}) { vec3 dd = transformed - uImpact[i].xyz; float g = exp(-dot(dd, dd) / ${(2 * F.sigma * F.sigma).toFixed(4)});
            transformed += uDir[i].xyz * (uDir[i].w * g * sin(${F.omega.toFixed(2)} * a) * exp(-a / ${F.tau.toFixed(2)})); } }`);
  };
  mat.customProgramCacheKey = () => 'bola-jeu-filet-v3';
  o.material = mat;
  mat0.dispose();
  o.frustumCulled = false;
  const inv = new THREE.Matrix4(), w = new THREE.Vector3(), d = new THREE.Vector3(), nm = new THREE.Matrix3();
  // les derniers chocs, datés en temps de jeu : le filet se rejoue aussi dans le ralenti du but (temps(t) relu)
  const histoire = [];
  return {
    objet: o,
    /** un choc du ballon au temps de jeu t (repère du jeu) : place, direction du gonflement (unitaire), vitesse du choc */
    choc(t, x, y, z, dx, dy, dz, vn) {
      if (vn < 1.5) return;
      o.updateMatrixWorld(); inv.copy(o.matrixWorld).invert(); nm.getNormalMatrix(inv);
      versMonde({ x, y, z }, w).applyMatrix4(inv);
      versMonde({ x: dx, y: dy, z: dz }, d).applyMatrix3(nm).normalize();
      histoire.push({ t, p: w.clone(), d: d.clone(), f: Math.min(F.max, vn * F.parMs) / PIC });
      if (histoire.length > 8) histoire.shift();
    },
    /** le filet au temps de jeu t : les deux derniers chocs d'avant t qui vibrent encore */
    temps(t) {
      let n = 0;
      for (let i = histoire.length - 1; i >= 0 && n < 2; i--) {
        const H = histoire[i], a = t - H.t;
        if (a < 0) continue;
        if (a > F.vie) { if (t > H.t + 30) histoire.splice(0, i + 1); break; }
        impacts[n].set(H.p.x, H.p.y, H.p.z, a); dirs[n].set(H.d.x, H.d.y, H.d.z, H.f); n++;
      }
      for (; n < 2; n++) impacts[n].w = -1;
    },
    vider() { histoire.length = 0; },
    liberer() { o.geometry.dispose(); mat.dispose(); histoire.length = 0; },
  };
}
