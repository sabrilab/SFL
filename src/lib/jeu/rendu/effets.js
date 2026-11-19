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
//   - LE FILET DU BUT (creerFilet ; bola-app#32, lot C : « des vrais filets, un vrai maillage très construit », avant :
//     les 16 triangles du plateau redécoupés, une onde dans le shader à chaque choc) : un vrai filet, construit sur le
//     cadre des tubes du but (toit incliné, fond incliné, deux côtés ; sim/constantes.js BUT_COIN), tendu à la barre,
//     aux poteaux, aux tubes et au sol, avec son mou au repos (la poche au fond). Ses nœuds (tous les 15 cm, 511 par
//     but) sont une toile en Verlet (creerToile, pasToile : sans three, rejouée par le banc) : des fils qui ne
//     s'allongent pas, une mémoire de la forme de repos, un amorti ; la balle affichée pousse les nœuds devant elle
//     (vers l'extérieur du but quand elle y est entrée, vers l'intérieur si elle frappe le filet du dehors), au pas de
//     la simulation (1/120 s), et la toile s'endort quand elle est calme et la balle loin : rien à calculer ni à
//     renvoyer à la carte graphique le reste du temps. La maille elle-même (losanges de 12 cm, fil de 1 cm) est
//     dessinée dans le shader, nette de près, voile léger de loin (anticrénelée par les dérivées : pas de moiré) ; un
//     seul appel de dessin pour les deux buts. La balle, elle, est retenue par la poche de la simulation
//     (sim/ballon.js) : le filet affiché suit la balle, et la balle suit le filet de la simulation.
import * as THREE from 'three';
import { LB, BUT_DL, BUT_H, BUT_P, BUT_COIN, BALLON } from '../sim/constantes.js';

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

// ─────────────────────────── le filet du but (bola-app#32, lot C) ───────────────────────────
export const TOILE = {
  pas: 1 / 120,             // s : le pas de la toile (celui de la simulation)
  ecart: 0.15,              // m : l'écart des nœuds (la maille dessinée, plus fine, est dans le shader)
  maille: 0.12, fil: 0.01,  // m : le losange du filet et l'épaisseur du fil
  sac: 0.035, sacCote: 0.02, // m : le mou du filet au repos (la poche), au toit et au fond / sur les côtés
  memoire: 0.035,           // part du chemin vers la forme de repos reprise à chaque pas (le filet revient)
  amorti: 0.045,            // part de la vitesse perdue à chaque pas
  mou: 1.03,                // un fil ne s'allonge pas au-delà de 1,03 fois sa longueur au repos
  iterations: 3,            // passes sur les fils, à chaque pas
  rayon: BALLON.R + 0.012,  // m : la balle tient les nœuds à cette distance de son centre
  calme: 2e-5,              // m : sous ce déplacement par pas, la balle loin, la toile s'endort
};

/**
 * La toile du filet d'un but (s = −1 ou 1 : son côté), sans three, dans le repère du jeu : le pan principal (toit puis
 * fond, de la barre au sol, x de poteau à poteau) et les deux côtés (quadrilatères poteau, sol, tube du fond, tube du
 * toit). Tous les bords sont tenus (fixe) ; les nœuds libres ont une forme de repos avec le mou du filet (sac), et une
 * normale sortante (vers l'extérieur du but). uv : les coordonnées de la maille, en mètres le long du filet.
 */
export function creerToile(s, T = TOILE) {
  const [dc, yc] = BUT_COIN;
  const Lt = Math.hypot(dc, yc - BUT_H), Lf = Math.hypot(BUT_P - dc, yc);
  const NX = Math.max(2, Math.round((2 * BUT_DL) / T.ecart)), NT = Math.max(3, Math.round((Lt + Lf) / T.ecart));
  const NA = Math.max(2, Math.round(BUT_P / T.ecart)), NB = Math.max(2, Math.round(BUT_H / T.ecart));
  const nP = (NX + 1) * (NT + 1), nC = (NA + 1) * (NB + 1), n = nP + 2 * nC;
  const R0 = new Float32Array(3 * n), N = new Float32Array(3 * n), uv = new Float32Array(2 * n), fixe = new Uint8Array(n);
  const nt = { d: 0, y: 0 }, nn = { d: 0, y: 0 };
  const toit = { d: -(yc - BUT_H) / Lt, y: dc / Lt }, fond = { d: yc / Lf, y: (BUT_P - dc) / Lf };
  const profil = (t) => {
    if (t <= Lt) { const u = t / Lt; nt.d = dc * u; nt.y = BUT_H + (yc - BUT_H) * u; } else { const u = (t - Lt) / Lf; nt.d = dc + (BUT_P - dc) * u; nt.y = yc * (1 - u); }
    const a = t < Lt - 1e-6 ? toit : t > Lt + 1e-6 ? fond : null;
    if (a) { nn.d = a.d; nn.y = a.y; } else { const d = toit.d + fond.d, y = toit.y + fond.y, l = Math.hypot(d, y); nn.d = d / l; nn.y = y / l; }
  };
  const poser = (i, x, y, d, nx, ny, nd, sac, u, v, tenu) => {
    const o = 3 * i;
    R0[o] = x + nx * sac; R0[o + 1] = y + ny * sac; R0[o + 2] = s * (LB + d + nd * sac);
    N[o] = nx; N[o + 1] = ny; N[o + 2] = s * nd;
    uv[2 * i] = u; uv[2 * i + 1] = v; fixe[i] = tenu ? 1 : 0;
  };
  for (let k = 0; k <= NT; k++) {
    const t = ((Lt + Lf) * k) / NT;
    profil(t);
    for (let i = 0; i <= NX; i++) {
      const x = -BUT_DL + (2 * BUT_DL * i) / NX, tenu = i === 0 || i === NX || k === 0 || k === NT;
      const sac = tenu ? 0 : T.sac * Math.sin((Math.PI * i) / NX) * Math.pow(Math.sin((Math.PI * k) / NT), 0.8);
      poser(k * (NX + 1) + i, x, nt.y, nt.d, 0, nn.y, nn.d, sac, x, t, tenu);
    }
  }
  for (let c = 0; c < 2; c++) {
    const sx = c ? 1 : -1, base = nP + c * nC;
    for (let b = 0; b <= NB; b++) for (let a = 0; a <= NA; a++) {
      const u = a / NA, v = b / NB;
      // le quadrilatère du côté : (0 ; 0), (BUT_P ; 0), le coin (dc ; yc), (0 ; BUT_H) en (d ; y)
      const d = u * (1 - v) * BUT_P + u * v * dc, y = (1 - u) * v * BUT_H + u * v * yc;
      const tenu = a === 0 || a === NA || b === 0 || b === NB;
      const sac = tenu ? 0 : T.sacCote * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      poser(base + b * (NA + 1) + a, sx * BUT_DL, y, d, sx, 0, 0, sac, d, y, tenu);
    }
  }
  // les fils (les arêtes de la grille, sauf entre deux nœuds tenus) et les triangles
  const A = [], L = [], tri = [];
  const fil = (p, q) => { if (fixe[p] && fixe[q]) return; A.push(p, q); L.push(Math.hypot(R0[3 * q] - R0[3 * p], R0[3 * q + 1] - R0[3 * p + 1], R0[3 * q + 2] - R0[3 * p + 2])); };
  const grille = (base, nx, ny) => {
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const p = base + j * (nx + 1) + i;
      if (i < nx) fil(p, p + 1);
      if (j < ny) fil(p, p + nx + 1);
      if (i < nx && j < ny) tri.push(p, p + 1, p + nx + 1, p + 1, p + nx + 2, p + nx + 1);
    }
  };
  grille(0, NX, NT); grille(nP, NA, NB); grille(nP + nC, NA, NB);
  return {
    s, n, NX, NT, NA, NB, R0, N, uv, fixe, P: R0.slice(), Q: R0.slice(),
    A: Uint16Array.from(A), L: Float32Array.from(L), index: Uint16Array.from(tri),
    dedans: false, eveille: false, bouge: 0,
  };
}

/** La toile au repos (un nouveau match, un saut dans le temps du ralenti). */
export function reposToile(t) { t.P.set(t.R0); t.Q.set(t.R0); t.dedans = false; t.eveille = false; t.bouge = 0; }

/**
 * Un pas de la toile (TOILE.pas), la balle affichée en b ({ x, y, z }, repère du jeu ; null : pas de balle). Renvoie
 * vrai si la toile a bougé (à renvoyer à la carte graphique). Une balle entrée dans le but par devant (dedans), ou du
 * côté intérieur du filet au repos, pousse les nœuds vers l'extérieur ; du dehors, vers l'intérieur. Seuls les nœuds qui sont dans l'ombre de la balle le long
 * de leur normale sont poussés : une balle qui s'est déjà enfoncée ne passe jamais à travers la toile affichée.
 */
export function pasToile(t, b, T = TOILE) {
  const { P, Q, R0, N, fixe, A, L, n } = t;
  let proche = false;
  if (b) {
    const d = (b.z - t.s * LB) * t.s;
    if (t.dedans) { if (d < -BALLON.R) t.dedans = false; } else if (d > 0 && d < BUT_P && Math.abs(b.x) < BUT_DL && b.y < BUT_H) t.dedans = true;
    proche = d > -0.6 && d < BUT_P + 0.6 && Math.abs(b.x) < BUT_DL + 0.6 && b.y < BUT_H + 0.7;
  }
  if (!proche && !t.eveille) return false;
  const am = 1 - T.amorti, me = T.memoire;
  for (let i = 0; i < n; i++) {
    if (fixe[i]) continue;
    for (let o = 3 * i, c = 0; c < 3; c++, o++) { const p = P[o], v = (p - Q[o]) * am; Q[o] = p; P[o] = p + v + (R0[o] - p) * me; }
  }
  for (let it = 0; it < T.iterations; it++) {
    for (let e = 0; e < L.length; e++) {
      const ia = A[2 * e], ic = A[2 * e + 1], a = 3 * ia, c = 3 * ic;
      const dx = P[c] - P[a], dy = P[c + 1] - P[a + 1], dz = P[c + 2] - P[a + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz), lm = L[e] * T.mou;
      if (d <= lm || d < 1e-9) continue;
      const fa = fixe[ia] ? 0 : fixe[ic] ? 1 : 0.5, fc = fixe[ic] ? 0 : fixe[ia] ? 1 : 0.5, k = (d - lm) / d;
      P[a] += dx * k * fa; P[a + 1] += dy * k * fa; P[a + 2] += dz * k * fa;
      P[c] -= dx * k * fc; P[c + 1] -= dy * k * fc; P[c + 2] -= dz * k * fc;
    }
  }
  if (b && proche) {
    const R2 = T.rayon * T.rayon;
    for (let i = 0; i < n; i++) {
      if (fixe[i]) continue;
      const o = 3 * i, rx = P[o] - b.x, ry = P[o + 1] - b.y, rz = P[o + 2] - b.z;
      const h = rx * N[o] + ry * N[o + 1] + rz * N[o + 2];
      if (h < -0.6 || h > 0.6) continue;
      const l2 = rx * rx + ry * ry + rz * rz - h * h;
      if (l2 >= R2) continue;
      const besoin = Math.sqrt(R2 - l2);
      // de quel côté est la balle : dedans si elle est entrée par devant, ou si elle est du côté intérieur du filet au
      // repos (une balle devant la bouche du but, sous le toit, n'est pas « au-dessus du toit »)
      const dedans = t.dedans || (b.x - R0[o]) * N[o] + (b.y - R0[o + 1]) * N[o + 1] + (b.z - R0[o + 2]) * N[o + 2] < 0;
      const k = dedans ? (h < besoin ? besoin - h : 0) : (h > -besoin ? -besoin - h : 0);
      if (k) { P[o] += N[o] * k; P[o + 1] += N[o + 1] * k; P[o + 2] += N[o + 2] * k; }
    }
  }
  let bouge = 0;
  for (let o = 0; o < 3 * n; o++) { const v = Math.abs(P[o] - Q[o]); if (v > bouge) bouge = v; }
  t.bouge = bouge;
  t.eveille = proche || bouge > T.calme;
  return true;
}

/** L'écart le plus grand de la toile à sa forme de repos (m) : ce que le banc mesure. */
export function ecartToile(t) {
  let m = 0;
  for (let i = 0; i < t.n; i++) { const o = 3 * i; m = Math.max(m, Math.hypot(t.P[o] - t.R0[o], t.P[o + 1] - t.R0[o + 1], t.P[o + 2] - t.R0[o + 2])); }
  return m;
}

/**
 * Les filets des deux buts, dans le groupe du jeu (parent) ; le filet du plateau (st_filets_buts) est caché. suivre(b,
 * t) à chaque image : la balle affichée b (repère du jeu) au temps de jeu t (celui du direct, ou celui du ralenti, qui
 * revient en arrière : la toile repart du repos). stats : le temps passé (ms) et les pas, pour la mesure.
 */
export function creerFilet(parent, scene) {
  const ancien = scene?.getObjectByName('st_filets_buts');
  if (ancien) { ancien.visible = false; ancien.geometry?.dispose?.(); }
  const toiles = [creerToile(-1), creerToile(1)];
  const n0 = toiles[0].n, n = n0 + toiles[1].n;
  const pos = new Float32Array(3 * n), nor = new Float32Array(3 * n), uv = new Float32Array(2 * n);
  const idx = new Uint16Array(toiles[0].index.length + toiles[1].index.length);
  toiles.forEach((T, k) => {
    pos.set(T.P, 3 * k * n0); uv.set(T.uv, 2 * k * n0);
    for (let i = 0; i < T.index.length; i++) idx[k * toiles[0].index.length + i] = T.index[i] + k * n0;
  });
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage), aNor = new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos); geo.setAttribute('normal', aNor); geo.setAttribute('aMaille', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const normales = (k) => {
    const T = toiles[k], o0 = 3 * k * n0, P = T.P, I = T.index;
    nor.fill(0, o0, o0 + 3 * T.n);
    for (let i = 0; i < I.length; i += 3) {
      const a = 3 * I[i], b = 3 * I[i + 1], c = 3 * I[i + 2];
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const q of [a, b, c]) { nor[o0 + q] += nx; nor[o0 + q + 1] += ny; nor[o0 + q + 2] += nz; }
    }
    for (let o = o0; o < o0 + 3 * T.n; o += 3) { const l = Math.hypot(nor[o], nor[o + 1], nor[o + 2]) || 1; nor[o] /= l; nor[o + 1] /= l; nor[o + 2] /= l; }
  };
  normales(0); normales(1);
  geo.computeBoundingSphere();
  const T0 = TOILE;
  const mat = new THREE.MeshBasicMaterial({ color: 0xe2e2df, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aMaille; varying vec2 vMaille; varying vec3 vNw;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMaille = aMaille; vNw = normalize(mat3(modelMatrix) * normal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vMaille; varying vec3 vNw;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          // la maille en losanges (la grille de B. Golus : nette de près, la couverture moyenne de loin, sans moiré)
          vec2 q = vec2(vMaille.x + vMaille.y, vMaille.x - vMaille.y) * ${(Math.SQRT1_2 / T0.maille).toFixed(5)};
          vec2 dq = max(fwidth(q), vec2(1e-6));
          float lw = ${(T0.fil / T0.maille).toFixed(4)};
          vec2 dw = clamp(vec2(lw), dq, vec2(0.5));
          vec2 aa = dq * 1.5;
          vec2 g = 1.0 - abs(fract(q) * 2.0 - 1.0);
          vec2 l = smoothstep(dw + aa, dw - aa, g) * clamp(lw / dw, 0.0, 1.0);
          l = mix(l, vec2(lw), clamp(dq * 2.0 - 1.0, 0.0, 1.0));
          float m = mix(l.x, 1.0, l.y);
          float loin = clamp(max(dq.x, dq.y) * 2.0 - 0.5, 0.0, 1.0);
          diffuseColor.a *= min(1.0, m * (1.0 + 1.4 * loin));
          // un modelé discret (la lumière des projecteurs, d'en haut) : la poche se lit quand le filet se creuse
          diffuseColor.rgb *= 0.74 + 0.26 * abs(dot(normalize(vNw), vec3(0.2, 0.93, 0.3)));
          if (diffuseColor.a < 0.004) discard;
        }`);
  };
  mat.customProgramCacheKey = () => 'bola-jeu-filet-v4';
  const o = new THREE.Mesh(geo, mat);
  o.name = 'filets_buts'; o.frustumCulled = false; o.renderOrder = 1;
  parent.add(o);
  let tPrec = null, accu = 0;
  const bP = { x: 0, y: 0, z: 0 }, bC = { x: 0, y: 0, z: 0 }, bI = { x: 0, y: 0, z: 0 };
  const sale = [false, false];
  const stats = { ms: 0, images: 0, pas: 0, envois: 0 };
  function repos() { for (const T of toiles) reposToile(T); toiles.forEach((T, k) => pos.set(T.P, 3 * k * n0)); normales(0); normales(1); aPos.needsUpdate = true; aNor.needsUpdate = true; }
  return {
    objet: o, toiles, stats,
    /** une image : la balle affichée (repère du jeu) au temps de jeu t */
    suivre(b, t) {
      const t0 = performance.now();
      bC.x = b.x; bC.y = b.y; bC.z = b.z;
      if (tPrec == null || t < tPrec - 1e-6 || t - tPrec > 0.5) {
        if (tPrec != null && t < tPrec - 1e-6) repos();
        tPrec = t; accu = 0; bP.x = bC.x; bP.y = bC.y; bP.z = bC.z;
      }
      accu += t - tPrec; tPrec = t;
      const nPas = Math.min(8, Math.floor(accu / T0.pas + 1e-6));
      accu -= nPas * T0.pas; if (accu > T0.pas) accu = 0;
      for (let j = 1; j <= nPas; j++) {
        const u = j / nPas;
        bI.x = bP.x + (bC.x - bP.x) * u; bI.y = bP.y + (bC.y - bP.y) * u; bI.z = bP.z + (bC.z - bP.z) * u;
        for (let k = 0; k < 2; k++) if (pasToile(toiles[k], bI)) sale[k] = true;
        stats.pas++;
      }
      if (nPas) { bP.x = bC.x; bP.y = bC.y; bP.z = bC.z; }
      for (let k = 0; k < 2; k++) {
        if (!sale[k]) continue;
        sale[k] = false;
        pos.set(toiles[k].P, 3 * k * n0); normales(k);
        aPos.addUpdateRange(3 * k * n0, 3 * toiles[k].n); aNor.addUpdateRange(3 * k * n0, 3 * toiles[k].n);
        aPos.needsUpdate = true; aNor.needsUpdate = true; stats.envois++;
      }
      stats.ms += performance.now() - t0; stats.images++;
    },
    /** un nouveau match */
    vider() { tPrec = null; accu = 0; repos(); },
    /** les sommets et les triangles dessinés (pour la mesure) */
    taille: () => ({ sommets: n, triangles: idx.length / 3, appels: 1 }),
    liberer() { geo.dispose(); mat.dispose(); o.removeFromParent(); },
  };
}
