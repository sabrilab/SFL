// La grosse tête des joueurs du jeu : la photo du studio Bola (et seulement elle : Sabri, 22/10, les photos de carte
// ne viennent que du studio IA) posée sur une tête stylisée, plus grosse que nature.
//
// Pas de reconstruction 3D du visage (proposition validée par Sabri le 02/11) : on ne fabrique aucun modèle du
// visage, on projette la photo de face sur un œuf, comme un autocollant bombé. Ça ressemble au joueur, ça reste drôle,
// et c'est léger (une texture de 512 px, aucun appel réseau en plus de la photo).
//
// 1. analyserPhoto : repère le visage dans la photo (peau dans les tons chair, au centre, au-dessus du maillot), en
//    déduit un carré qui prend les cheveux et le menton, la couleur de peau et celle des cheveux. Les photos du studio
//    sont toutes cadrées pareil (buste de face sur fond uni) : la mesure tient sans bibliothèque de détection.
//    Le studio du jeu (/jouer/studio) permet de corriger le cadrage à la main (decalage).
// 2. creerTete : l'œuf, avec un shader qui pose le visage de face dans une ellipse douce, les cheveux autour et
//    derrière, la peau sur les joues et le cou, et une lumière de studio (douce, liseré).
import * as THREE from 'three';

const ANALYSE = 128; // la photo est mesurée en 128 × 128
const SORTIE = 512; // le visage recadré

function chargerImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('photo illisible'));
    img.src = src;
  });
}

/**
 * Mesure le visage d'une photo du studio.
 * decalage : { x, y, taille } en fractions de la photo, ajoutés au cadrage trouvé (studio du jeu).
 * Renvoie { canvas (le visage recadré, 512 px), peau, cheveux (THREE.Color), boite (fractions, pour le studio) }.
 */
export async function analyserPhoto(src, decalage = null) {
  const img = await chargerImage(src);
  const c = document.createElement('canvas');
  c.width = c.height = ANALYSE;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, ANALYSE, ANALYSE);
  const px = g.getImageData(0, 0, ANALYSE, ANALYSE).data;

  // masque de peau (YCbCr), pondéré vers le centre : le visage est au milieu, un chat ou un drapeau sur les côtés
  const peau = new Uint8Array(ANALYSE * ANALYSE);
  const lignes = new Float32Array(ANALYSE);
  const poidsX = new Float32Array(ANALYSE);
  for (let x = 0; x < ANALYSE; x++) poidsX[x] = Math.exp(-(((x - 64) / 30) ** 2));
  let sr = 0, sg = 0, sb = 0, sn = 0;
  for (let y = 0; y < ANALYSE; y++) {
    for (let x = 0; x < ANALYSE; x++) {
      const i = (y * ANALYSE + x) * 4, R = px[i], G = px[i + 1], B = px[i + 2];
      const Y = 0.299 * R + 0.587 * G + 0.114 * B;
      const Cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B;
      const Cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B;
      if (Cr > 135 && Cr < 175 && Cb > 80 && Cb < 130 && Y > 50 && R > G && G > B * 0.9) {
        peau[y * ANALYSE + x] = 1;
        lignes[y] += poidsX[x];
      }
    }
  }
  // lignes du visage : dans les trois quarts du haut, celles où la peau est franche
  let max = 0;
  for (let y = 0; y < 100; y++) max = Math.max(max, lignes[y]);
  let y0 = 20, y1 = 90;
  if (max > 0) {
    y0 = -1;
    for (let y = 0; y < 100; y++) if (lignes[y] > max * 0.35) { if (y0 < 0) y0 = y; y1 = y; }
  }
  const cols = new Float32Array(ANALYSE);
  let cmax = 0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < ANALYSE; x++) if (peau[y * ANALYSE + x]) cols[x] += poidsX[x];
  for (let x = 0; x < ANALYSE; x++) cmax = Math.max(cmax, cols[x]);
  let x0 = 44, x1 = 84;
  if (cmax > 0) {
    x0 = -1;
    for (let x = 0; x < ANALYSE; x++) if (cols[x] > cmax * 0.3) { if (x0 < 0) x0 = x; x1 = x; }
  }
  // couleur de peau : la moyenne du masque dans la boîte du visage
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!peau[y * ANALYSE + x]) continue;
    const i = (y * ANALYSE + x) * 4;
    sr += px[i]; sg += px[i + 1]; sb += px[i + 2]; sn++;
  }
  const couleurPeau = sn ? new THREE.Color(sr / sn / 255, sg / sn / 255, sb / sn / 255) : new THREE.Color(0.78, 0.6, 0.48);

  // le carré de la tête : deux fois la largeur du visage, le haut un demi-visage au-dessus du front (les cheveux)
  const fw = Math.max(16, x1 - x0);
  let taille = fw * 1.85;
  let cx = (x0 + x1) / 2;
  let haut = y0 - fw * 0.26;
  if (decalage) {
    cx += (decalage.x || 0) * ANALYSE;
    haut += (decalage.y || 0) * ANALYSE;
    taille *= 1 + (decalage.taille || 0);
  }
  // cheveux : juste au-dessus du front, au milieu
  let hr = 0, hg = 0, hb = 0, hn = 0;
  const hy0 = Math.max(0, Math.round(y0 - fw * 0.35)), hy1 = Math.max(1, Math.round(y0 - fw * 0.12));
  for (let y = hy0; y < hy1; y++) for (let x = Math.round(cx - fw * 0.25); x < Math.round(cx + fw * 0.25); x++) {
    const i = (y * ANALYSE + x) * 4;
    hr += px[i]; hg += px[i + 1]; hb += px[i + 2]; hn++;
  }
  let cheveux = hn ? new THREE.Color(hr / hn / 255, hg / hn / 255, hb / hn / 255) : new THREE.Color(0.08, 0.06, 0.05);
  // un front dégarni ou rasé : la mesure tombe sur la peau, on garde des cheveux sombres
  const hsl = {}; cheveux.getHSL(hsl);
  if (hsl.l > 0.45) cheveux = new THREE.Color(0.1, 0.08, 0.07);

  const out = document.createElement('canvas');
  out.width = out.height = SORTIE;
  const o = out.getContext('2d');
  const k = img.naturalWidth / ANALYSE;
  o.fillStyle = `#${cheveux.getHexString()}`;
  o.fillRect(0, 0, SORTIE, SORTIE);
  o.drawImage(img, (cx - taille / 2) * k, haut * k, taille * k, taille * k, 0, 0, SORTIE, SORTIE);

  // le fond du studio (uni) devient transparent : la tête ne garde que le visage et les cheveux, le shader
  // remplit le reste avec la couleur des cheveux. Le fond est lu dans les coins hauts de la photo entière.
  let br = 0, bgc = 0, bb = 0, bn = 0;
  for (const [x, y] of [[2, 2], [ANALYSE - 3, 2], [2, 12], [ANALYSE - 3, 12], [8, 4], [ANALYSE - 9, 4]]) {
    const i = (y * ANALYSE + x) * 4;
    br += px[i]; bgc += px[i + 1]; bb += px[i + 2]; bn++;
  }
  br /= bn; bgc /= bn; bb /= bn;
  const d = o.getImageData(0, 0, SORTIE, SORTIE), q = d.data;
  for (let i = 0; i < q.length; i += 4) {
    const dist = Math.hypot(q[i] - br, q[i + 1] - bgc, q[i + 2] - bb);
    q[i + 3] = Math.round(255 * Math.min(1, Math.max(0, (dist - 18) / 30)));
  }
  o.putImageData(d, 0, 0);

  return {
    canvas: out,
    peau: couleurPeau,
    cheveux,
    boite: { x: (cx - taille / 2) / ANALYSE, y: haut / ANALYSE, taille: taille / ANALYSE },
    visage: { x0: x0 / ANALYSE, y0: y0 / ANALYSE, x1: x1 / ANALYSE, y1: y1 / ANALYSE },
  };
}

const VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uVisage;
  uniform float uAPhoto;
  uniform vec3 uPeau;
  uniform vec3 uCheveux;
  uniform vec3 uMatiere;
  uniform float uStatue;
  uniform vec3 uLumiere;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // repère de la tête : x à droite, y en haut, z vers l'avant ; l'œuf mesure 1 de rayon
    vec3 p = normalize(vPos);
    // le visage, projeté de face : le carré de la photo couvre [-1, 1] en x et en y
    vec2 uv = vec2(vPos.x * 0.5 + 0.5, vPos.y * 0.5 + 0.5 - 0.09);
    vec4 photoA = texture2D(uVisage, uv);
    vec3 photo = photoA.rgb;
    // ellipse douce du visage et des cheveux de face, seulement sur l'avant
    float d = length(vec2(vPos.x / 0.86, (vPos.y - 0.08) / 1.05));
    float face = (1.0 - smoothstep(0.82, 1.02, d)) * smoothstep(-0.1, 0.35, p.z);
    // autour : les cheveux en haut et derrière, la peau sur le bas des joues
    float bas = smoothstep(0.15, -0.45, p.y) * smoothstep(-0.6, 0.2, p.z);
    vec3 tour = mix(uCheveux, uPeau, bas);
    vec3 albedo = mix(tour, photo, face * uAPhoto * photoA.a);
    albedo = mix(albedo, uMatiere, uStatue);

    // lumière de studio : douce, un peu de contre-jour, et la photo garde sa propre lumière
    vec3 n = normalize(vNormal);
    float lam = max(dot(n, normalize(uLumiere)), 0.0);
    float ciel = 0.5 + 0.5 * n.y;
    float rim = pow(1.0 - max(dot(n, vView), 0.0), 3.0);
    float eclairage = mix(0.45 + 0.2 * ciel + 0.45 * lam, 0.85 + 0.15 * lam, face * uAPhoto * (1.0 - uStatue));
    vec3 col = albedo * eclairage + rim * 0.08 * vec3(1.0);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const geometrieTete = (() => {
  let g = null;
  return () => {
    if (g) return g;
    g = new THREE.SphereGeometry(1, 48, 36);
    // un œuf : un peu plus haut que large, la mâchoire resserrée
    const pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const machoire = v.y < 0 ? 1 - 0.18 * (-v.y) ** 1.5 : 1;
      pos.setXYZ(i, v.x * 0.86 * machoire, v.y * 1.0, v.z * 0.9 * machoire);
    }
    g.computeVertexNormals();
    return g;
  };
})();

/**
 * La grosse tête. analyse : résultat d'analyserPhoto, ou null pour une tête sans photo.
 * statue : couleur de matière (marbre, obsidienne) pour les adversaires sans visage, ou null.
 */
export function creerTete(analyse, { statue = null } = {}) {
  const tex = analyse ? new THREE.CanvasTexture(analyse.canvas) : null;
  if (tex) { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; }
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uVisage: { value: tex },
      uAPhoto: { value: tex ? 1 : 0 },
      uPeau: { value: (analyse?.peau ?? new THREE.Color(0.7, 0.55, 0.45)).clone().convertSRGBToLinear() },
      uCheveux: { value: (analyse?.cheveux ?? new THREE.Color(0.08, 0.07, 0.06)).clone().convertSRGBToLinear() },
      uMatiere: { value: new THREE.Color(statue ?? 0xffffff).convertSRGBToLinear() },
      uStatue: { value: statue != null ? 1 : 0 },
      uLumiere: { value: new THREE.Vector3(0.4, 0.8, 0.6) },
    },
  });
  const mesh = new THREE.Mesh(geometrieTete(), mat);
  mesh.castShadow = true;
  mesh.userData.dispose = () => { tex?.dispose(); mat.dispose(); };
  return mesh;
}
