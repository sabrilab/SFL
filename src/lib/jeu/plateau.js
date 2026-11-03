// Copie du plateau BOLA pour le jeu (SFL /jouer, 03/11/2026, Sabri : « le plateau Bola avec un gameplay de 5 contre 5 »).
// Source : sabrilab/bola-site, branche claude/project-thread-lq5xj1, plateau3d/plateau.js, jet 7 (648d6a9), identique à
// bola-plateau.vercel.app. Seuls changent : les imports (three/examples/jsm au lieu de three/addons) et la qualité « jeu ».
// Un jet suivant du plateau se reporte ici en gardant ces deux écarts.
//
// Le plateau BOLA (02/11/2026, Sabri : « modéliser cet environnement le plus réaliste possible… pour pouvoir faire
// les vidéos… montrer des titres ou des cartes sur le terrain, sur l'écran suspendu en haut, mettre les pubs qu'on
// veut… mais toujours dans cet environnement »).
//
// D'après les images du plateau du 31/10 (videos/j4-compos/habillage-3d/image-01..08) : une salle couverte, charpente
// en treillis d'acier noir rayée de bandes LED chaudes, projecteurs en grappes, brume ; un terrain de foot à cinq en
// gazon synthétique entouré de panneaux LED et de filets ; des tribunes pleines sur trois côtés ; un mur noir « BOLA »
// au-dessus du tunnel d'entrée ; le cube d'écrans suspendu au-dessus du rond central.
//
// Une scène three.js r186 pure (ni drei ni dépendance), en mètres, terrain centré sur l'origine, grand axe = x.
// Tout le contenu passe par des EMPLACEMENTS nommés (plateau.emplacements) :
//   ecranN, ecranS, ecranE, ecranO   les quatre faces du cube suspendu (16:9)
//   bandeau                          la ceinture du cube (logos ; un seul visuel répété sur les quatre faces)
//   mur                              le grand mur au-dessus du tunnel (logo BOLA par défaut)
//   banniereG, banniereD             les deux kakémonos verticaux de part et d'autre du tunnel
//   panneauxN, panneauxS, panneauxE, panneauxO   les panneaux LED autour du terrain (pubs, défilent)
//   sol                              le marquage peint au rond central
//   studio, pupitre                  l'écran derrière le plateau TV et la face de son desk
//   commentateur                     la face du pupitre du commentateur
// Chaque emplacement a .poser(source) — source : canvas, image, vidéo, THREE.Texture ou URL — et .ancre, un Object3D
// posé à cet endroit pour y accrocher de la 3D (une vraie carte, un titre). Les points utiles (rond central, buts,
// tunnel, sous le cube, tribunes) sont dans plateau.points, les mouvements de caméra tout faits dans plateau.plans.
//
// Deux qualités : "telephone" (léger : deux ombres portées calculées une fois, gazon à 5 couches, foule réduite et
// moins détaillée, FXAA) pour un rendu dans le navigateur d'un téléphone, et "film" (quatre ombres douces, gazon à
// 14 couches, foule pleine, MSAA, traînées anamorphiques) pour les vidéos.
//
// Jet 6 (02/11, Sabri : « va beaucoup plus loin tout en restant optimisé, meilleur rendu, stade un peu plus grand ») :
// salle de 96 × 78 m sous 23 m, tribunes à deux étages (anneau bas, loges vitrées, anneau haut en encorbellement avec
// son plafond à spots), portique d'éclairage suspendu au-dessus du terrain, lyres qui balaient la brume, flashs de
// téléphones dans la foule, cube d'écrans agrandi.
//
// Jet 7 (02/11, Sabri : « accrois le réalisme, sans forcer sur la vignette… un emplacement pour des commentateurs, un
// truc de plusieurs places qui fait plateau TV, et un commentateur sportif… la DA de Bola avec les piliers ») :
// le plateau TV en marbre (desk à trois places, écran derrière : emplacements studio et pupitre) entre deux piliers,
// le pupitre du commentateur au bord du terrain (emplacement commentateur), deux piliers au tunnel, des caméras de
// télé autour du terrain ; l'étalonnage est presque neutre (vignette, grain et aberration réduits).
/* eslint-disable -- copie du plateau, gardée telle quelle pour suivre ses jets */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---------------------------------------------------------------- dimensions
export const DIM = {
  L: 30, l: 18,            // aire de jeu (lignes)
  TL: 32, Tl: 20,          // gazon jusqu'aux panneaux
  panneau: 0.95,           // hauteur des panneaux LED
  filet: 5.2,              // hauteur du filet au-dessus des panneaux
  but: [3, 2, 0.9],        // but de foot à cinq : largeur, hauteur, profondeur
  salle: [96, 78], toit: 23, // salle (x, z) et faîtage (jet 6 : plus grande)
  portique: 16.2,          // le cadre d'éclairage suspendu au-dessus du terrain
  cube: { y: 12, w: 8.3, h: 4.67, d: 8.3 },
  murX: -27,               // le mur BOLA (côté ouest)
};
const QUALITES = {
  telephone: { ombres: true, nOmbres: 2, tailleOmbre: 1024, couches: 5, foule: 0.42, fouleFine: false, texGazon: 2048, bloom: 0.5, msaa: 0, pr: 1, ao: false, sieges: false, fxaa: true, flashs: 260 },
  // le jeu (SFL /jouer) : dix joueurs animés en plus, donc le décor encore allégé
  jeu: { ombres: true, nOmbres: 2, tailleOmbre: 1024, couches: 3, foule: 0.3, fouleFine: false, texGazon: 2048, bloom: 0.5, msaa: 0, pr: 1, ao: false, sieges: false, fxaa: true, flashs: 140 },
  film: { ombres: true, nOmbres: 4, tailleOmbre: 2048, couches: 14, foule: 1, fouleFine: true, texGazon: 4096, bloom: 1, msaa: 4, pr: 1, ao: true, sieges: true, fxaa: false, flashs: 700 },
};
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
function alea(graine) { let s = graine >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- textures peintes
function toile(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function texDe(c, srgb = true, rep = null) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
async function svgImage(url, blanc = true, couleur = "#fff") {
  const txt = await (await fetch(url)).text();
  const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(txt); await img.decode();
  if (!blanc) return img;
  // en blanc pur, quelle que soit la couleur d'origine
  const [c, g] = toile(img.naturalWidth * 4 || 2000, img.naturalHeight * 4 || 500); g.drawImage(img, 0, 0, c.width, c.height);
  g.globalCompositeOperation = "source-in"; g.fillStyle = couleur; g.fillRect(0, 0, c.width, c.height); return c;
}
// le gazon : bandes de tonte, grain des fibres, usure au centre et devant les buts, lignes blanches
function peindreGazon(px, logoSol = null) {
  const W = px, H = Math.round(px * DIM.Tl / DIM.TL), m = W / DIM.TL; const [c, g] = toile(W, H); const r = alea(7);
  g.fillStyle = "#29592a"; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 14; k++) { g.fillStyle = k % 2 ? "rgba(255,255,230,0.045)" : "rgba(0,20,0,0.07)"; g.fillRect(k * W / 14, 0, W / 14 + 1, H); }
  const d = g.getImageData(0, 0, W, H), p = d.data;
  for (let i = 0; i < p.length; i += 4) { const n = (r() - 0.5) * 26, j = (r() - 0.5) * 10; p[i] += n * 0.6 + j; p[i + 1] += n; p[i + 2] += n * 0.4; }
  g.putImageData(d, 0, 0);
  const use = (x, y, rx, ry, a) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, `rgba(120,120,70,${a})`); gr.addColorStop(1, "rgba(120,120,70,0)");
    g.save(); g.translate(x, y); g.scale(rx, ry); g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); g.restore(); };
  use(W / 2, H / 2, 3.5 * m, 2.6 * m, 0.16); use(1.6 * m, H / 2, 2.2 * m, 1.8 * m, 0.22); use(W - 1.6 * m, H / 2, 2.2 * m, 1.8 * m, 0.22);
  for (let k = 0; k < 40; k++) use(r() * W, r() * H, (0.4 + r()) * m, (0.3 + r() * 0.6) * m, 0.05);
  const X = (x) => (x + DIM.TL / 2) * m, Y = (z) => (z + DIM.Tl / 2) * m;
  g.strokeStyle = "rgba(245,245,238,0.93)"; g.lineWidth = 0.09 * m; g.lineCap = "butt";
  const L = DIM.L / 2, l = DIM.l / 2;
  g.strokeRect(X(-L), Y(-l), DIM.L * m, DIM.l * m);
  g.beginPath(); g.moveTo(X(0), Y(-l)); g.lineTo(X(0), Y(l)); g.stroke();
  g.beginPath(); g.arc(X(0), Y(0), 3 * m, 0, Math.PI * 2); g.stroke();
  g.fillStyle = g.strokeStyle; g.beginPath(); g.arc(X(0), Y(0), 0.14 * m, 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) { g.beginPath(); g.arc(X(s * L), Y(0), 6 * m, s < 0 ? -Math.PI / 2 : Math.PI / 2, s < 0 ? Math.PI / 2 : Math.PI * 1.5); g.stroke();
    g.beginPath(); g.arc(X(s * (L - 6)), Y(0), 0.12 * m, 0, Math.PI * 2); g.fill(); }
  if (logoSol) { const w = 4.2 * m, h = w * logoSol.height / logoSol.width; g.globalAlpha = 0.5; g.drawImage(logoSol, X(0) - w / 2, Y(0) - h / 2, w, h); g.globalAlpha = 1; }
  // grain de peinture usée sur les lignes
  g.globalCompositeOperation = "destination-out"; for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(r() * W, r() * H, 2, 2); }
  return c;
}
function bruitNormal(px = 512, force = 2.2, graine = 3) {
  const [c, g] = toile(px, px); const r = alea(graine); const h = new Float32Array(px * px);
  for (let o = 0; o < 4; o++) { const n = 8 << o, v = new Float32Array((n + 1) * (n + 1)).map(() => r());
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) { const fx = x / px * n, fy = y / px * n, ix = fx | 0, iy = fy | 0, u = fx - ix, w = fy - iy;
      const a = v[iy * (n + 1) + ix], b = v[iy * (n + 1) + ((ix + 1) % n)], cc = v[((iy + 1) % n) * (n + 1) + ix], d = v[((iy + 1) % n) * (n + 1) + ((ix + 1) % n)];
      h[y * px + x] += ((a * (1 - u) + b * u) * (1 - w) + (cc * (1 - u) + d * u) * w) / (1 << o); } }
  const id = g.createImageData(px, px);
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) { const i = y * px + x, dx = (h[y * px + (x + 1) % px] - h[i]) * force * 8, dy = (h[((y + 1) % px) * px + x] - h[i]) * force * 8, l = Math.hypot(dx, dy, 1);
    id.data[i * 4] = (-dx / l * 0.5 + 0.5) * 255; id.data[i * 4 + 1] = (-dy / l * 0.5 + 0.5) * 255; id.data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; id.data[i * 4 + 3] = 255; }
  g.putImageData(id, 0, 0); return c;
}
function filetTex(maille = 32, ep = 3) { const [c, g] = toile(128, 128); g.strokeStyle = "#fff"; g.lineWidth = ep; g.beginPath();
  for (let k = 0; k <= 128; k += maille) { g.moveTo(k, 0); g.lineTo(k, 128); g.moveTo(0, k); g.lineTo(128, k); } g.stroke(); return c; }
// la foule : des silhouettes peintes (tête, épaules, vêtements sombres ou clairs), une par case
function peindreFoule() {
  const n = 16, cw = 96, ch = 192; const [c, g] = toile(cw * n, ch); const r = alea(11);
  const peaux = ["#f1c9a5", "#d9a77c", "#b97e55", "#8a5a3b", "#5e3b25", "#e8b894"], habits = ["#111", "#161616", "#f2f2f2", "#2a2a2a", "#3b3b40", "#6b6b6b", "#1d2330", "#e9e4da", "#402020", "#0b0b0b"];
  for (let k = 0; k < n; k++) { const x0 = k * cw, cx = x0 + cw / 2; const peau = peaux[(r() * peaux.length) | 0], habit = habits[(r() * habits.length) | 0];
    const ep = 30 + r() * 10, ht = 120 + r() * 24;
    g.fillStyle = habit; g.beginPath(); g.moveTo(cx - ep, ch); g.lineTo(cx - ep, ch - ht + 40); g.quadraticCurveTo(cx - ep, ch - ht + 18, cx - 12, ch - ht + 14); g.lineTo(cx + 12, ch - ht + 14);
    g.quadraticCurveTo(cx + ep, ch - ht + 18, cx + ep, ch - ht + 40); g.lineTo(cx + ep, ch); g.fill();
    const bras = r() < 0.18; if (bras) { g.strokeStyle = habit; g.lineWidth = 11; g.lineCap = "round"; const s = r() < 0.5 ? -1 : 1; g.beginPath(); g.moveTo(cx + s * (ep - 6), ch - ht + 34); g.lineTo(cx + s * (ep + 6), ch - ht - 40); g.stroke();
      g.fillStyle = peau; g.beginPath(); g.arc(cx + s * (ep + 7), ch - ht - 46, 7, 0, 7); g.fill(); }
    g.fillStyle = peau; g.beginPath(); g.ellipse(cx, ch - ht - 6, 13, 17, 0, 0, 7); g.fill();
    g.fillStyle = r() < 0.7 ? "#140f0c" : "#3a2a1c"; g.beginPath(); g.ellipse(cx, ch - ht - 15, 14, 10, 0, Math.PI, 2 * Math.PI); g.fill();
    if (r() < 0.25) { g.fillStyle = "#0d0d0d"; g.fillRect(cx - 16, ch - ht - 26, 32, 10); }
    const ombre = g.createLinearGradient(0, ch - ht, 0, ch); ombre.addColorStop(0, "rgba(0,0,0,0)"); ombre.addColorStop(1, "rgba(0,0,0,0.55)");
    g.globalCompositeOperation = "source-atop"; g.fillStyle = ombre; g.fillRect(x0, 0, cw, ch); g.globalCompositeOperation = "source-over"; }
  return [c, n];
}
// une rampe de projecteurs : des disques blancs dans des cerclages noirs
function peindreRampe(nx, ny) { const s = 64; const [c, g] = toile(nx * s, ny * s); g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = i * s + s / 2, y = j * s + s / 2; g.fillStyle = "#222"; g.beginPath(); g.arc(x, y, s * 0.46, 0, 7); g.fill();
    const gr = g.createRadialGradient(x, y, 0, x, y, s * 0.38); gr.addColorStop(0, "#fff"); gr.addColorStop(0.6, "#fff6e8"); gr.addColorStop(1, "#a08060"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, s * 0.38, 0, 7); g.fill(); }
  return c; }

// ---------------------------------------------------------------- matières à shader
// l'écran LED : l'image, la grille des diodes (qui s'efface de loin), le verre qui reflète la salle
const V_ECRAN = `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const F_ECRAN = `uniform sampler2D map; uniform float uLum; uniform vec2 uPix; uniform vec2 uDefile; uniform float uTemps; uniform samplerCube uEnv; uniform float uAEnv; uniform float uOn;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    vec2 uv = fract(vUv + uDefile * uTemps);
    vec3 c = texture2D(map, uv).rgb; c = pow(c, vec3(2.2));
    vec2 g = fract(vUv * uPix); vec2 fw = fwidth(vUv * uPix);
    float grille = smoothstep(0.5, 0.18, abs(g.x - 0.5)) * smoothstep(0.5, 0.18, abs(g.y - 0.5));
    float loin = clamp(max(fw.x, fw.y) * 1.6, 0.0, 1.0);
    c *= mix(0.25 + 1.15 * grille, 1.0, loin);
    vec3 N = normalize(vN), V = normalize(vV); float fr = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 R = reflect(-V, N); vec3 refl = textureCube(uEnv, vec3(-R.x, R.yz)).rgb;
    vec3 col = c * uLum * uOn + vec3(0.006) + refl * fr * uAEnv;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
// le faisceau dans la brume : un cône additif, dense près du projecteur, doux sur les bords
const V_CONE = `varying vec3 vN; varying vec3 vV; varying float vH; uniform float uLong;
  void main() { vH = -position.y / uLong + 0.5; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const F_CONE = `uniform vec3 uCouleur; uniform float uForce; varying vec3 vN; varying vec3 vV; varying float vH;
  void main() { float bord = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float a = bord * pow(1.0 - clamp(vH, 0.0, 1.0), 1.6) * uForce * smoothstep(2.0, 9.0, length(vV)); gl_FragColor = vec4(uCouleur * a, 1.0); }`;
// le dernier passage : étalonnage chaud, vignette, aberration légère, grain de pellicule
const ETALON = {
  uniforms: { tDiffuse: { value: null }, uTemps: { value: 0 }, uGrain: { value: 0.018 }, uVignette: { value: 0.045 }, uAberr: { value: 0.00015 }, uChaud: { value: 0.45 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTemps; uniform float uGrain; uniform float uVignette; uniform float uAberr; uniform float uChaud; varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec3 c = vec3(texture2D(tDiffuse, vUv - d * uAberr * r2 * 4.0).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * uAberr * r2 * 4.0).b);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      vec3 ombres = vec3(0.92, 0.97, 1.04), hautes = vec3(1.05, 1.0, 0.92);
      c *= mix(vec3(1.0), mix(ombres, hautes, smoothstep(0.1, 0.7, l)), uChaud);
      c = mix(vec3(l), c, 0.97);
      c = (c - 0.5) * 0.9 + 0.5;
      c = c * 0.93 + vec3(0.032, 0.03, 0.028); // des noirs débouchés, comme une image de télé (Sabri 02/11 : trop contrasté)
      c *= 1.0 - uVignette * smoothstep(0.08, 0.6, r2 * 1.6);
      c += (h(vUv * 1013.0 + fract(uTemps * 7.13)) - 0.5) * uGrain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

// ---------------------------------------------------------------- la scène
export async function creerPlateau(renderer, { qualite = "film", base = "./", largeur = 1080, hauteur = 1920 } = {}) {
  const Q = QUALITES[qualite] || QUALITES.film;
  const scene = new THREE.Scene();
  const brume = new THREE.Color(0x0e0b09); scene.background = new THREE.Color(0x050403); scene.fog = new THREE.FogExp2(brume, 0.0052);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = Q.ombres; renderer.shadowMap.type = THREE.VSMShadowMap; renderer.shadowMap.autoUpdate = false;
  const temps = { value: 0 };
  const majTemps = []; // fonctions (t) appelées à chaque image

  // matières de base
  const acier = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.85, roughness: 0.42 });
  const noirMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, metalness: 0.1, roughness: 0.55 });
  const noirBrillant = new THREE.MeshPhysicalMaterial({ color: 0x080808, metalness: 0.3, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 });
  const betonNorm = texDe(bruitNormal(512, 0.8, 21), false, [18, 14]);
  const beton = new THREE.MeshStandardMaterial({ color: 0x1b1a19, roughness: 0.38, metalness: 0.0, normalMap: betonNorm, normalScale: new THREE.Vector2(0.25, 0.25) });
  const blancTube = new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.35, metalness: 0.05 });

  // ---- sol de la salle
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(DIM.salle[0], DIM.salle[1]), beton); sol.rotation.x = -Math.PI / 2; sol.position.y = -0.01; sol.receiveShadow = true; scene.add(sol);

  // ---- le gazon : une base + des couches (shell texturing) qui donnent le relief des fibres
  const logoSymbole = await svgImage(base + "symbole-blanc.svg");
  const toileGazon = peindreGazon(Q.texGazon); const texGazon = texDe(toileGazon);
  const normGazon = texDe(bruitNormal(512, 3.2, 5), false, [90, 56]);
  const gazonGeo = new THREE.PlaneGeometry(DIM.TL, DIM.Tl); gazonGeo.rotateX(-Math.PI / 2);
  const base0 = new THREE.MeshStandardMaterial({ map: texGazon, roughness: 0.92, normalMap: normGazon, normalScale: new THREE.Vector2(0.9, 0.9), color: 0x9a9a9a });
  const g0 = new THREE.Mesh(gazonGeo, base0); g0.receiveShadow = true; scene.add(g0);
  const hauteurFibre = 0.032;
  for (let i = 1; i <= Q.couches; i++) {
    const u = i / Q.couches;
    const m = new THREE.MeshStandardMaterial({ map: texGazon, roughness: 0.85, color: new THREE.Color().setScalar((0.42 + 0.42 * u)), normalMap: normGazon, normalScale: new THREE.Vector2(0.6, 0.6) });
    m.onBeforeCompile = (s) => {
      s.uniforms.uCouche = { value: u };
      s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vMonde;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvMonde = (modelMatrix * vec4(transformed, 1.0)).xz;");
      s.fragmentShader = s.fragmentShader.replace("#include <common>", `#include <common>
        uniform float uCouche; varying vec2 vMonde;
        float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        { vec2 p = vMonde * 260.0; vec2 ip = floor(p), fp = fract(p) - 0.5; float hb = 0.55 + 0.45 * hh(ip); vec2 o = vec2(hh(ip + 3.1), hh(ip + 7.7)) - 0.5;
          float rr = length(fp - o * 0.5) / (0.5 * (1.0 - uCouche * 0.85));
          if (uCouche > hb || rr > 1.0) discard; }`);
    };
    const s = new THREE.Mesh(gazonGeo, m); s.position.y = u * hauteurFibre; s.receiveShadow = Q.ombres && i === Q.couches; s.renderOrder = -1; scene.add(s);
  }

  // ---- buts : tubes blancs et filets
  const filetT = texDe(filetTex(32, 4), true, [12, 8]);
  const matFilet = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, alphaMap: filetT, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.8 });
  const points = {};
  for (const s of [-1, 1]) {
    const [bw, bh, bd] = DIM.but, x = s * DIM.L / 2; const gr = new THREE.Group(); gr.position.set(x, 0, 0);
    const tube = (a, b, r = 0.045) => { const v = new THREE.Vector3().subVectors(b, a); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 14), blancTube);
      m.position.copy(a).addScaledVector(v, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); m.castShadow = true; gr.add(m); };
    const P = (a, b, c) => new THREE.Vector3(a * s, b, c);
    tube(P(0, 0, -bw / 2), P(0, bh, -bw / 2)); tube(P(0, 0, bw / 2), P(0, bh, bw / 2)); tube(P(0, bh, -bw / 2), P(0, bh, bw / 2));
    tube(P(0, bh, -bw / 2), P(bd * 0.6, bh * 0.8, -bw / 2), 0.025); tube(P(0, bh, bw / 2), P(bd * 0.6, bh * 0.8, bw / 2), 0.025);
    tube(P(bd, 0, -bw / 2), P(bd, 0, bw / 2), 0.025); tube(P(bd * 0.6, bh * 0.8, -bw / 2), P(bd, 0, -bw / 2), 0.025); tube(P(bd * 0.6, bh * 0.8, bw / 2), P(bd, 0, bw / 2), 0.025);
    // filet : le fond incliné, le toit, les deux côtés (des quadrilatères posés sur les tubes)
    const quad = (a, b, c, d, ru, rv) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([...a.toArray(), ...b.toArray(), ...c.toArray(), ...d.toArray()], 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, ru, 0, ru, rv, 0, rv], 2)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals(); gr.add(new THREE.Mesh(g, matFilet)); };
    const A = P(0, bh, -bw / 2), B = P(0, bh, bw / 2), Cc = P(bd * 0.6, bh * 0.8, bw / 2), D = P(bd * 0.6, bh * 0.8, -bw / 2), E = P(bd, 0, bw / 2), F = P(bd, 0, -bw / 2);
    quad(A, B, Cc, D, 6, 1.2); quad(D, Cc, E, F, 6, 3.4);
    for (const z of [-bw / 2, bw / 2]) quad(P(0, 0, z), P(bd, 0, z), P(bd * 0.6, bh * 0.8, z), P(0, bh, z), 1.8, 4);
    scene.add(gr); points[s < 0 ? "butOuest" : "butEst"] = new THREE.Vector3(x, 1, 0);
  }

  // ---- panneaux LED autour du terrain + filets de protection
  const emplacements = {};
  const envCube = { value: null };
  function matEcran(texture, pix, lum = 1.6, defile = [0, 0]) {
    return new THREE.ShaderMaterial({ vertexShader: V_ECRAN, fragmentShader: F_ECRAN, toneMapped: true, fog: false,
      uniforms: { map: { value: texture }, uLum: { value: lum }, uPix: { value: new THREE.Vector2(...pix) }, uDefile: { value: new THREE.Vector2(...defile) }, uTemps: temps, uEnv: envCube, uAEnv: { value: 0.0 }, uOn: { value: 1 } } });
  }
  function emplacement(nom, mats, format, ancre, defaut) {
    const e = { nom, format, ancre, materiaux: mats, texture: null,
      poser(src, { defile = null, lum = null } = {}) {
        let t = src;
        if (typeof src === "string") { t = new THREE.TextureLoader().load(src); }
        else if (src instanceof HTMLVideoElement) { t = new THREE.VideoTexture(src); }
        else if (src instanceof HTMLCanvasElement || src instanceof HTMLImageElement || src instanceof ImageBitmap) { t = new THREE.Texture(src); t.needsUpdate = true; }
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
        for (const m of mats) { m.uniforms.map.value = t; if (defile) m.uniforms.uDefile.value.set(...defile); if (lum != null) m.uniforms.uLum.value = lum; }
        e.texture = t; return e; },
      allumer(v) { for (const m of mats) m.uniforms.uOn.value = v; return e; },
    };
    emplacements[nom] = e; if (defaut) e.poser(defaut); return e;
  }
  const logoBola = await svgImage(base + "logo-blanc.svg"), sigleSfl = await svgImage(base + "sfl.svg");
  // un bandeau publicitaire : logos BOLA et SFL alternés sur noir
  const logoBolaNoir = await svgImage(base + "logo-blanc.svg", true, "#0a0a0a"), sigleSflNoir = await svgImage(base + "sfl.svg", true, "#0a0a0a");
  // un bandeau de panneaux : uniquement BOLA et SFL, en blanc sur noir ou en noir sur blanc, par cases de 4 m
  function bandeauPub(longueurM, hauteurM) {
    const ppm = 120; const [c, g] = toile(Math.min(8192, Math.round(longueurM * ppm)), Math.round(hauteurM * ppm));
    const pas = c.width / Math.max(1, Math.round(longueurM / 4)); let k = 0;
    for (let x = 0; x < c.width - 1; x += pas, k++) { const clair = k % 4 >= 2, im = k % 2 ? (clair ? sigleSflNoir : sigleSfl) : (clair ? logoBolaNoir : logoBola);
      g.fillStyle = clair ? "#ececea" : "#050505"; g.fillRect(x, 0, pas + 1, c.height); const h = c.height * 0.52, w = h * im.width / im.height; g.drawImage(im, x + (pas - w) / 2, (c.height - h) / 2, w, h); }
    return c;
  }
  const cotes = { N: [0, -DIM.Tl / 2, 0, DIM.TL], S: [0, DIM.Tl / 2, Math.PI, DIM.TL], O: [-DIM.TL / 2, 0, Math.PI / 2, DIM.Tl], E: [DIM.TL / 2, 0, -Math.PI / 2, DIM.Tl] };
  const filetHaut = texDe(filetTex(16, 2), true, [60, 10]);
  const matGrillage = new THREE.MeshStandardMaterial({ color: 0x020202, alphaMap: filetHaut, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, roughness: 1, metalness: 0, envMapIntensity: 0 });
  for (const [k, [x, z, ry, long]] of Object.entries(cotes)) {
    const gr = new THREE.Group(); gr.position.set(x, 0, z); gr.rotation.y = ry; scene.add(gr);
    const caisse = new THREE.Mesh(new THREE.BoxGeometry(long, DIM.panneau, 0.4), noirBrillant); caisse.position.set(0, DIM.panneau / 2, -0.2); caisse.castShadow = true; gr.add(caisse);
    const mat = matEcran(null, [long * 40, DIM.panneau * 40], 1.1, [0.012, 0]);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(long - 0.1, DIM.panneau * 0.8), mat); face.position.set(0, DIM.panneau / 2, 0.003); gr.add(face);
    const ancre = new THREE.Object3D(); ancre.position.set(0, DIM.panneau / 2, 0.05); gr.add(ancre);
    const c = bandeauPub(long, DIM.panneau * 0.8); emplacement("panneaux" + k, [mat], [c.width, c.height], ancre, c);
    // grillage noir au-dessus, poteaux tous les 4 m
    const gri = new THREE.Mesh(new THREE.PlaneGeometry(long, DIM.filet), matGrillage); gri.position.set(0, DIM.panneau + DIM.filet / 2, -0.3); gri.material = matGrillage.clone(); gri.material.alphaMap = filetHaut.clone(); gri.material.alphaMap.repeat.set(long * 2, DIM.filet * 2); gr.add(gri);
    for (let p = -long / 2; p <= long / 2 + 0.01; p += 4) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, DIM.filet + DIM.panneau, 0.08), acier); m.position.set(p, (DIM.filet + DIM.panneau) / 2, -0.32); gr.add(m); }
    const lisse = new THREE.Mesh(new THREE.BoxGeometry(long, 0.06, 0.06), acier); lisse.position.set(0, DIM.panneau + DIM.filet, -0.32); gr.add(lisse);
  }

  // ---- tribunes : gradins noirs, sièges, et la foule (instanciée)
  // la foule : des silhouettes lisses en volume (buste + tête), mates et sombres, que la lumière du terrain
  // ne fait que souligner ; pas de visages ni de détails, Sabri : « dans la pénombre, ce n'est pas grave »
  const matFoule = new THREE.MeshStandardMaterial({ color: 0x24211e, roughness: 0.5, metalness: 0.0, envMapIntensity: 0.6 });
  matFoule.onBeforeCompile = (s) => {
    s.uniforms.uTemps = temps;
    s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nattribute float aPhase; uniform float uTemps;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.y += max(0.0, sin(uTemps * (1.1 + fract(aPhase * 7.0)) + aPhase * 6.28)) * 0.035 * smoothstep(0.3, 0.9, position.y);");
  };
  const tribunes = [];
  // [centre x, centre z, rotation, longueur, rangs bas, rangs haut] ; l'anneau haut avance de 2,6 m au-dessus du bas
  const defsTrib = [[1.75, -15.2, 0, 56.5, 18, 12], [1.75, 15.2, Math.PI, 56.5, 18, 12], [20.2, 0, -Math.PI / 2, 30, 16, 10]];
  const r = alea(42); const personnes = [], sieges = [], spotsPlafond = [], flashs = [];
  const matMarche = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.62, 0.35).multiplyScalar(1.4) });
  const matNez = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.55, 0.3).multiplyScalar(0.12) });
  const matFond = new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.95 });
  const matSousface = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.9 });
  // les loges vitrées entre les deux anneaux : des baies chaudes, quelques silhouettes, des montants noirs
  const toileLoges = (long) => { const ppm = 40, [c, g] = toile(Math.round(long * ppm), Math.round(2.4 * ppm)); const rl = alea(long * 13);
    g.fillStyle = "#070605"; g.fillRect(0, 0, c.width, c.height);
    for (let x = 0; x < c.width; x += 4 * ppm) { const a = 0.35 + rl() * 0.65, gr = g.createLinearGradient(0, 0, 0, c.height);
      gr.addColorStop(0, `rgba(255,190,130,${0.55 * a})`); gr.addColorStop(1, `rgba(120,70,40,${0.35 * a})`); g.fillStyle = gr; g.fillRect(x + 4, 6, 4 * ppm - 8, c.height - 12);
      g.fillStyle = "rgba(10,8,6,0.85)"; for (let k = 0; k < 4; k++) if (rl() < 0.55) { const px = x + 10 + rl() * (4 * ppm - 24); g.beginPath(); g.ellipse(px, c.height - 22, 7, 20, 0, 0, 7); g.fill(); g.beginPath(); g.arc(px, c.height - 46, 6, 0, 7); g.fill(); }
      g.fillStyle = "#020202"; g.fillRect(x, 0, 5, c.height); g.fillRect(x + 2 * ppm, 0, 2, c.height); }
    g.fillStyle = "#020202"; g.fillRect(0, 0, c.width, 6); g.fillRect(0, c.height - 8, c.width, 8); return c; };
  for (const [cx, cz, ry, long, rangs, rangsH] of defsTrib) {
    const gr = new THREE.Group(); gr.position.set(cx, 0, cz); gr.rotation.y = ry; scene.add(gr); tribunes.push(gr);
    const pas = 0.82, mont = 0.44, pasH = 0.8, montH = 0.52;
    const allees = []; for (let a = -long / 2 + 5.5; a < long / 2 - 3; a += 11) allees.push(a);
    const range = (y, z, xs) => { for (let x = -long / 2 + 0.3; x < long / 2 - 0.3; x += 0.55) {
      if (allees.some((a) => Math.abs(x - a) < 0.75)) continue;
      sieges.push({ gr, x, y, z: z - 0.08 });
      if (r() > Q.foule * 0.8) continue; personnes.push({ gr, x: x + (r() - 0.5) * 0.06, y: y - 0.08, z: z + (r() - 0.5) * 0.05, s: 0.92 + r() * 0.16 });
      if (r() < 0.05) flashs.push({ gr, x, y: y + 1.0, z: z + 0.1 }); } };
    // l'anneau bas
    for (let k = 0; k < rangs; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(long, mont * (k + 1), pas), noirMat); m.position.set(0, mont * (k + 1) / 2, -k * pas - pas / 2); m.receiveShadow = true; gr.add(m);
      const nez = new THREE.Mesh(new THREE.BoxGeometry(long, 0.012, 0.02), matNez); nez.position.set(0, mont * (k + 1) + 0.006, -k * pas); gr.add(nez);
      range(mont * (k + 1), -k * pas - pas * 0.42);
      for (const a of allees) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.015, 0.03), matMarche); p.position.set(a, mont * (k + 1) + 0.01, -k * pas - 0.02); gr.add(p); }
    }
    const hB = mont * rangs, dB = rangs * pas, dH = dB - 2.6, yH = hB + 3.0;
    // les loges : la baie vitrée au fond de l'anneau bas, sous l'encorbellement
    const loges = new THREE.Mesh(new THREE.PlaneGeometry(long, yH - 1.0 - hB), new THREE.MeshBasicMaterial({ map: texDe(toileLoges(long)), color: new THREE.Color().setScalar(1.15) }));
    loges.position.set(0, (hB + yH - 1.0) / 2, -dB - 0.05); gr.add(loges);
    const allege = new THREE.Mesh(new THREE.BoxGeometry(long, 0.9, 0.12), noirBrillant); allege.position.set(0, hB + 0.45, -dB + 0.3); gr.add(allege);
    // l'anneau haut, en encorbellement : chaque rang est un caisson qui descend jusqu'à la sous-face
    for (let k = 0; k < rangsH; k++) {
      const h = montH * (k + 1) + 1.0; const m = new THREE.Mesh(new THREE.BoxGeometry(long, h, pasH), noirMat); m.position.set(0, yH - 1.0 + h / 2, -dH - k * pasH - pasH / 2); m.receiveShadow = true; gr.add(m);
      const nez = new THREE.Mesh(new THREE.BoxGeometry(long, 0.012, 0.02), matNez); nez.position.set(0, yH + montH * (k + 1) + 0.006, -dH - k * pasH); gr.add(nez);
      range(yH + montH * (k + 1), -dH - k * pasH - pasH * 0.42);
      for (const a of allees) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.015, 0.03), matMarche); p.position.set(a, yH + montH * (k + 1) + 0.01, -dH - k * pasH - 0.02); gr.add(p); }
    }
    // la sous-face de l'anneau haut et ses spots encastrés (une grille de points chauds)
    const sf = new THREE.Mesh(new THREE.PlaneGeometry(long, rangsH * pasH), matSousface); sf.rotation.x = Math.PI / 2; sf.position.set(0, yH - 1.0 - 0.01, -dH - rangsH * pasH / 2); gr.add(sf);
    for (let x = -long / 2 + 1.5; x < long / 2 - 1; x += 2.4) for (let z = 0.8; z < 2.6; z += 1.6) spotsPlafond.push({ gr, x, y: yH - 1.02, z: -dH - z });
    // le fond, la rambarde du bas et celle du haut
    const hFond = yH + montH * rangsH + 3.2; const fond = new THREE.Mesh(new THREE.BoxGeometry(long, hFond, 0.3), matFond); fond.position.set(0, hFond / 2, -dH - rangsH * pasH - 0.15); gr.add(fond);
    const ramb = new THREE.Mesh(new THREE.BoxGeometry(long, 0.05, 0.05), acier); ramb.position.set(0, 1.05, 0.05); gr.add(ramb);
    const verre = new THREE.Mesh(new THREE.BoxGeometry(long, 0.95, 0.02), new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false }));
    verre.position.set(0, yH + 0.5, -dH + 0.12); gr.add(verre);
    // les rubans LED : le devant de la tribune et le nez de l'anneau haut
    const nomT = ry === 0 ? "N" : ry === Math.PI ? "S" : "E";
    const rubans = [];
    for (const [y, h, z] of [[0.45, 0.5, 0.03], [yH - 0.45, 0.9, -dH + 0.04]]) {
      const mr = matEcran(null, [long * 40, h * 40], 1.25, [0.008 * (y > 1 ? -1 : 1), 0]); const rb = new THREE.Mesh(new THREE.PlaneGeometry(long, h), mr); rb.position.set(0, y, z); gr.add(rb); rubans.push(mr);
      const cad = new THREE.Mesh(new THREE.BoxGeometry(long, h + 0.08, 0.12), noirBrillant); cad.position.set(0, y, z - 0.07); gr.add(cad);
    }
    const anR = new THREE.Object3D(); anR.position.set(0, 0.45, 0.2); gr.add(anR);
    { const c = bandeauPub(long, 0.5); emplacement("ruban" + nomT, rubans, [c.width, c.height], anR, c); }
  }
  // les spots encastrés : un seul InstancedMesh de disques lumineux (aucune vraie lumière : rien ne coûte au rendu)
  { const geo = new THREE.CircleGeometry(0.09, 10); geo.rotateX(Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.84, 0.62).multiplyScalar(2.4) }), spotsPlafond.length); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), un = new THREE.Vector3(1, 1, 1);
    spotsPlafond.forEach((p, i) => { p.gr.updateMatrixWorld(); v.set(p.x, p.y, p.z).applyMatrix4(p.gr.matrixWorld); p.gr.getWorldQuaternion(q); M.compose(v, q, un); im.setMatrixAt(i, M); }); scene.add(im); }
  // les flashs de téléphones dans la foule : des points qui s'allument un court instant, chacun à son heure
  let flashsObj = null;
  { const n = Math.min(Q.flashs, flashs.length), pos = new Float32Array(n * 3), ph = new Float32Array(n), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { const p = flashs[(i * 7919) % flashs.length]; p.gr.updateMatrixWorld(); v.set(p.x, p.y, p.z).applyMatrix4(p.gr.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); ph[i] = r(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
    const mat = new THREE.ShaderMaterial({ uniforms: { uTemps: temps, uTaille: { value: hauteur / 900 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aPhase; uniform float uTemps; uniform float uTaille; varying float vA;
        void main() { float c = fract(uTemps * (0.05 + aPhase * 0.08) + aPhase * 17.0); vA = smoothstep(0.0, 0.01, c) * (1.0 - smoothstep(0.02, 0.08, c));
          vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = vA > 0.001 ? uTaille * 260.0 / -mv.z : 0.0; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; void main() { vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 26.0) * vA; gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * a * 6.0, 1.0); }` });
    flashsObj = new THREE.Points(geo, mat); flashsObj.frustumCulled = false; scene.add(flashsObj); }
  // les sièges : coque noire (assise + dossier), instanciés
  if (Q.sieges) {
    const assise = new THREE.BoxGeometry(0.44, 0.06, 0.4); assise.translate(0, 0.42, 0.02);
    const dos = new THREE.BoxGeometry(0.44, 0.42, 0.05); dos.rotateX(-0.12); dos.translate(0, 0.66, -0.2);
    const pied = new THREE.BoxGeometry(0.06, 0.4, 0.3); pied.translate(0, 0.2, -0.05);
    const geoS = mergeGeometries([assise, dos, pied]);
    const matS = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.38, metalness: 0.0 });
    const im = new THREE.InstancedMesh(geoS, matS, sieges.length); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), un = new THREE.Vector3(1, 1, 1);
    sieges.forEach((p, i) => { p.gr.updateMatrixWorld(); v.set(p.x, p.y, p.z).applyMatrix4(p.gr.matrixWorld); p.gr.getWorldQuaternion(q); M.compose(v, q, un); im.setMatrixAt(i, M); });
    im.receiveShadow = true; scene.add(im);
  }
  {
    const buste = Q.fouleFine ? new THREE.CapsuleGeometry(0.19, 0.34, 4, 10) : new THREE.CapsuleGeometry(0.19, 0.34, 2, 6); buste.scale(1.18, 1, 0.72); buste.translate(0, 0.36, 0);
    const tete = Q.fouleFine ? new THREE.SphereGeometry(0.105, 12, 8) : new THREE.SphereGeometry(0.105, 7, 5); tete.scale(0.92, 1.1, 1); tete.translate(0, 0.86, 0.01);
    const geo = mergeGeometries([buste.toNonIndexed(), tete.toNonIndexed()]); geo.deleteAttribute("uv");
    const n = personnes.length, phases = new Float32Array(n);
    const im = new THREE.InstancedMesh(geo, matFoule, n); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), e = new THREE.Vector3(), col = new THREE.Color();
    personnes.forEach((p, i) => { p.gr.updateMatrixWorld(); v.set(p.x, p.y, p.z).applyMatrix4(p.gr.matrixWorld); p.gr.getWorldQuaternion(q);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (r() - 0.5) * 0.5));
      M.compose(v, q, e.set(p.s * (0.9 + r() * 0.2), p.s, p.s)); im.setMatrixAt(i, M); phases[i] = r(); im.setColorAt(i, col.setScalar(r() < 0.25 ? 1.8 + r() * 1.5 : 0.5 + r() * 0.7)); });
    geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1)); im.castShadow = false;
    im.frustumCulled = false; scene.add(im);
  }

  // ---- le mur BOLA (ouest) avec le tunnel d'entrée et ses deux kakémonos
  {
    const gr = new THREE.Group(); gr.position.set(DIM.murX, 0, 0); gr.rotation.y = Math.PI / 2; scene.add(gr);
    // le mur, percé de l'ouverture du tunnel (4,4 × 3,4 m)
    const lm = (DIM.salle[1] - 4.4) / 2, hm = DIM.toit - 2.2;
    for (const [w, h, x, y] of [[lm, hm, -(2.2 + lm / 2), hm / 2], [lm, hm, 2.2 + lm / 2, hm / 2], [4.4, hm - 3.4, 0, 3.4 + (hm - 3.4) / 2]]) { const mur = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), noirMat); mur.position.set(x, y, -0.3); mur.receiveShadow = true; gr.add(mur); }
    // nervures verticales
    for (let x = -37.5; x <= 37.5; x += 2.5) { if (Math.abs(x) < 3) continue; const n = new THREE.Mesh(new THREE.BoxGeometry(0.12, hm, 0.18), acier); n.position.set(x, hm / 2, 0.05); gr.add(n); }
    // le panneau du logo (lumineux)
    const mat = matEcran(null, [20 * 30, 5 * 30], 1.5); const pan = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), mat); pan.position.set(0, 10.6, 0.2); gr.add(pan);
    const ancreMur = new THREE.Object3D(); ancreMur.position.set(0, 10.6, 0.6); gr.add(ancreMur);
    { const [c, g] = toile(2048, 512); g.fillStyle = "#000"; g.fillRect(0, 0, 2048, 512); const h = 330, w = h * logoBola.width / logoBola.height; g.drawImage(logoBola, (2048 - w) / 2, (512 - h) / 2, w, h); emplacement("mur", [mat], [2048, 512], ancreMur, c); }
    // le tunnel : un caisson noir, une arche, l'intérieur éclairé chaud
    const T = new THREE.Group(); T.position.set(0, 0, 0); gr.add(T);
    const arche = (w, h, z) => { const s = new THREE.Shape(); s.moveTo(-w / 2 - 0.6, 0); s.lineTo(w / 2 + 0.6, 0); s.lineTo(w / 2 + 0.6, h + 0.9); s.lineTo(-w / 2 - 0.6, h + 0.9); s.lineTo(-w / 2 - 0.6, 0);
      const t = new THREE.Path(); t.moveTo(-w / 2, 0); t.lineTo(-w / 2, h); t.lineTo(w / 2, h); t.lineTo(w / 2, 0); t.lineTo(-w / 2, 0); s.holes.push(t);
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false }), noirBrillant); m.position.z = z; T.add(m); };
    arche(4.4, 3.4, 0.2);
    const couloir = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.45, side: THREE.BackSide })); couloir.position.set(0, 1.7, -3.8); T.add(couloir);
    const fondLum = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.4), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.45).multiplyScalar(0.22) })); fondLum.position.set(0, 1.7, -7.7); T.add(fondLum);
    const lumT = new THREE.PointLight(0xffb57a, 14, 12, 2); lumT.position.set(0, 2.6, -2); T.add(lumT);
    // les réglettes du plafond du couloir
    for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.03, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.6).multiplyScalar(3) })); l.position.set(0, 3.37, -0.8 - k * 1.5); T.add(l); }
    // kakémonos verticaux
    for (const [nom, sx] of [["banniereG", -1], ["banniereD", 1]]) {
      const m = matEcran(null, [1.4 * 40, 4.6 * 40], 1.7); const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4.6), m); b.position.set(sx * 3.4, 2.5, 0.75); T.add(b);
      const cadre = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.8, 0.3), noirBrillant); cadre.position.set(sx * 3.4, 2.5, 0.58); T.add(cadre);
      const an = new THREE.Object3D(); an.position.set(sx * 3.4, 2.5, 0.9); T.add(an);
      const [c, g] = toile(280, 920); g.fillStyle = "#050505"; g.fillRect(0, 0, 280, 920); g.save(); g.translate(140, 460); g.rotate(-Math.PI / 2);
      const im = sx < 0 ? logoBola : sigleSfl, w = 700, h = w * im.height / im.width; g.drawImage(im, -w / 2, -h / 2, w, h); g.restore();
      emplacement(nom, [m], [280, 920], an, c);
    }
    points.tunnel = new THREE.Vector3(DIM.murX + 1.5, 1.6, 0);
    points.mur = new THREE.Vector3(DIM.murX + 0.5, 10.6, 0);
  }

  // ---- la salle : murs, charpente en treillis, bandes LED, projecteurs
  let lyresObj = null; const cones = []; // les faisceaux : on les éteint quand la caméra passe dedans (sinon un voile blanc)
  {
    const [X, Z] = DIM.salle, Ht = DIM.toit;
    const murs = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 });
    for (const [w, x, z, ry] of [[X, 0, -Z / 2, 0], [X, 0, Z / 2, Math.PI], [Z, X / 2, 0, -Math.PI / 2]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, Ht + 2), murs); m.position.set(x, (Ht + 2) / 2, z); m.rotation.y = ry; scene.add(m); }
    const toit = new THREE.Mesh(new THREE.PlaneGeometry(X, Z), murs); toit.rotation.x = Math.PI / 2; toit.position.y = Ht + 0.6; scene.add(toit);
    // treillis : membrures + diagonales, en instances
    const barres = [];
    const barre = (a, b, e) => barres.push([a, b, e]);
    const fermes = []; for (let x = -45; x <= 45; x += 6) fermes.push(x);
    const hb = Ht - 2.6;
    for (const x of fermes) {
      for (let z = -Z / 2; z < Z / 2; z += 2) { const z2 = z + 2;
        barre(new THREE.Vector3(x, Ht, z), new THREE.Vector3(x, Ht, z2), 0.16); barre(new THREE.Vector3(x, hb, z), new THREE.Vector3(x, hb, z2), 0.16);
        barre(new THREE.Vector3(x, hb, z), new THREE.Vector3(x, Ht, z2), 0.07); barre(new THREE.Vector3(x, hb, z), new THREE.Vector3(x, Ht, z), 0.06); }
    }
    for (let z = -Z / 2; z <= Z / 2; z += 6) barre(new THREE.Vector3(-X / 2, Ht, z), new THREE.Vector3(X / 2, Ht, z), 0.12);
    for (const z of [-24, -12, 0, 12, 24]) barre(new THREE.Vector3(-X / 2, hb, z), new THREE.Vector3(X / 2, hb, z), 0.1);
    // le portique d'éclairage : un cadre en treillis suspendu au-dessus du terrain, qui porte les grappes
    const yP = DIM.portique, PX = 22, PZ = 14;
    for (const [a, b2] of [[[-PX, -PZ], [PX, -PZ]], [[-PX, PZ], [PX, PZ]], [[-PX, -PZ], [-PX, PZ]], [[PX, -PZ], [PX, PZ]]]) {
      const A = new THREE.Vector3(a[0], yP, a[1]), B = new THREE.Vector3(b2[0], yP, b2[1]); const n = Math.round(A.distanceTo(B) / 1.2);
      for (const dy of [0, 0.9]) for (const dz of [-0.45, 0.45]) { const o = Math.abs(a[0] - b2[0]) < 1 ? new THREE.Vector3(dz, dy, 0) : new THREE.Vector3(0, dy, dz); barre(A.clone().add(o), B.clone().add(o), 0.07); }
      for (let k = 0; k < n; k++) { const P0 = A.clone().lerp(B, k / n), P1 = A.clone().lerp(B, (k + 1) / n); for (const dz of [-0.45, 0.45]) { const o = Math.abs(a[0] - b2[0]) < 1 ? new THREE.Vector3(dz, 0, 0) : new THREE.Vector3(0, 0, dz);
        barre(P0.clone().add(o), P1.clone().add(o).setY(yP + 0.9), 0.035); } }
    }
    for (const [x, z] of [[-PX, -PZ], [PX, -PZ], [-PX, PZ], [PX, PZ], [0, -PZ], [0, PZ]]) barre(new THREE.Vector3(x, yP + 0.9, z), new THREE.Vector3(x, hb, z), 0.03);
    // passerelles techniques (deux poutres-caissons longitudinales sous la charpente)
    for (const z of [-9, 9]) { barre(new THREE.Vector3(-X / 2, hb - 0.9, z), new THREE.Vector3(X / 2, hb - 0.9, z), 0.5); for (let x = -X / 2; x < X / 2; x += 3) barre(new THREE.Vector3(x, hb - 0.6, z), new THREE.Vector3(x, hb, z), 0.05); }
    const geoB = new THREE.BoxGeometry(1, 1, 1); const im = new THREE.InstancedMesh(geoB, acier, barres.length); const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
    barres.forEach(([a, b, e], i) => { v.subVectors(b, a); const L = v.length(); q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), v.normalize()); M.compose(a.clone().lerp(b, 0.5), q, new THREE.Vector3(L, e, e)); im.setMatrixAt(i, M); });
    scene.add(im);
    // bandes LED chaudes le long des membrures basses (les lignes de lumière des images)
    const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.7, 0.42).multiplyScalar(3.4) });
    for (const x of fermes) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, Z - 4), led); m.position.set(x, hb - 0.1, 0); scene.add(m); }
    for (const z of [-24, -12, 12, 24]) { const m = new THREE.Mesh(new THREE.BoxGeometry(X - 6, 0.04, 0.04), led); m.position.set(0, hb - 0.1, z); scene.add(m); }
    // un filet de LED sous le portique (la même lumière chaude, plus proche du terrain)
    for (const z of [-14, 14]) { const m = new THREE.Mesh(new THREE.BoxGeometry(44, 0.035, 0.035), led); m.position.set(0, DIM.portique - 0.05, z); scene.add(m); }
    // projecteurs : grappes accrochées à la charpente, au-dessus des lignes de touche
    const rampeT = texDe(peindreRampe(4, 2));
    const matRampe = new THREE.MeshBasicMaterial({ map: rampeT, color: new THREE.Color().setScalar(4.0) });
    const cible = new THREE.Object3D(); scene.add(cible);
    const projos = [];
    for (const [x, z] of [[-12, -14], [0, -14], [12, -14], [-12, 14], [0, 14], [12, 14], [-22, -6], [-22, 6], [22, -6], [22, 6]]) {
      const pos = new THREE.Vector3(x, DIM.portique - 0.6, z); const vise = new THREE.Vector3(x * 0.45, 0, z * 0.2);
      const boite = new THREE.Group(); boite.position.copy(pos); boite.lookAt(vise); scene.add(boite);
      const corps = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.75, 0.4), noirMat); corps.position.z = -0.2; boite.add(corps);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.68), matRampe); face.position.z = 0.01; boite.add(face);
      // le faisceau dans la brume
      const L = pos.distanceTo(vise) * 0.9; const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 3.0, L, 28, 1, true),
        new THREE.ShaderMaterial({ vertexShader: V_CONE, fragmentShader: F_CONE, uniforms: { uCouleur: { value: new THREE.Color(1, 0.86, 0.7) }, uForce: { value: 0.06 }, uLong: { value: L } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      cone.rotation.x = -Math.PI / 2; cone.position.z = L / 2; boite.add(cone); cones.push({ m: cone, h: L, r0: 0.55, r1: 3.0, f: 0.06 });
      projos.push({ pos, vise });
    }
    // la lumière qui éclaire vraiment : des spots doux depuis les grappes, quatre portent les ombres
    projos.forEach((p, i) => {
      const s = new THREE.SpotLight(0xfff1df, i < 6 ? 900 : 500, 60, 0.62, 0.65, 2); s.position.copy(p.pos); s.target.position.copy(p.vise); scene.add(s, s.target);
      if (Q.ombres && [1, 4, 6, 9].slice(0, Q.nOmbres).includes(i)) { s.castShadow = true; s.shadow.mapSize.set(Q.tailleOmbre, Q.tailleOmbre); s.shadow.bias = -0.0004; s.shadow.normalBias = 0.03; s.shadow.radius = 6; s.shadow.blurSamples = 12; s.shadow.camera.near = 4; s.shadow.camera.far = 40; }
    });
    scene.add(new THREE.HemisphereLight(0xffe2c4, 0x1a1612, 1.5));
    // les lyres (têtes mobiles) : huit faisceaux additifs qui balaient la salle, sans vraie lumière (aucun coût d'éclairage)
    const lyres = new THREE.Group(); scene.add(lyres);
    const matLyre = (L) => new THREE.ShaderMaterial({ vertexShader: V_CONE, fragmentShader: F_CONE, uniforms: { uCouleur: { value: new THREE.Color(1, 0.9, 0.78) }, uForce: { value: 0.026 }, uLong: { value: L } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const tetes = [];
    for (let i = 0; i < 8; i++) { const x = -21 + i * 6, z = i % 2 ? 14 : -14; const t = new THREE.Group(); t.position.set(x, DIM.portique - 0.4, z); lyres.add(t);
      const corps = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 12), noirMat); t.add(corps);
      const L = 24; const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 1.5, L, 20, 1, true), matLyre(L)); cone.position.y = -L / 2; t.add(cone); cones.push({ m: cone, h: L, r0: 0.12, r1: 1.5, f: 0.026 });
      const oeil = new THREE.Mesh(new THREE.CircleGeometry(0.15, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85).multiplyScalar(5) })); oeil.rotation.x = Math.PI / 2; oeil.position.y = -0.26; t.add(oeil);
      tetes.push({ t, ph: i * 0.7, sz: z > 0 ? 1 : -1 }); }
    majTemps.push((t) => { for (const h of tetes) { h.t.rotation.x = h.sz * (0.55 + 0.35 * Math.sin(t * 0.23 + h.ph)); h.t.rotation.z = 0.5 * Math.sin(t * 0.17 + h.ph * 1.7); } });
    lyresObj = lyres;
    // un peu de lumière sur les tribunes (les spectateurs ne sont pas dans le noir)
    for (const z of [-1, 1]) for (const x of [-14, 0, 14]) { const s = new THREE.SpotLight(0xffd8b0, 1100, 55, 0.8, 0.9, 2); s.position.set(x, hb - 1, z * 4); s.target.position.set(x, 7, z * 28); scene.add(s, s.target); }
    { const s = new THREE.SpotLight(0xffd8b0, 800, 55, 0.8, 0.9, 2); s.position.set(10, hb - 1, 0); s.target.position.set(32, 7, 0); scene.add(s, s.target); }
    // le mur BOLA en contre-jour : un lavis rasant
    { const s = new THREE.SpotLight(0xffe8d0, 160, 30, 0.9, 0.8, 2); s.position.set(DIM.murX + 6, 1, 0); s.target.position.set(DIM.murX, 10.6, 0); scene.add(s, s.target); }
  }

  // ---- le cube d'écrans suspendu (jet 6 : plus grand, pour la salle plus grande)
  {
    const C = DIM.cube; const gr = new THREE.Group(); gr.position.set(0, C.y, 0); scene.add(gr);
    const corps = new THREE.Mesh(new THREE.BoxGeometry(C.w, C.h + 1.0, C.d), noirBrillant); corps.position.y = 0.5 - 0.0; gr.add(corps);
    const faces = { ecranS: [0, C.d / 2, 0], ecranE: [C.w / 2, 0, Math.PI / 2], ecranN: [0, -C.d / 2, Math.PI], ecranO: [-C.w / 2, 0, -Math.PI / 2] };
    const bandeMats = [];
    const ew = C.w - 0.5, eh = ew * 9 / 16;
    const exemples = [];
    for (const [nom, [x, z, ry]] of Object.entries(faces)) {
      const f = new THREE.Group(); f.position.set(x, 0, z); f.rotation.y = ry; gr.add(f);
      const m = matEcran(null, [ew * 240, eh * 240], 1.55); m.uniforms.uAEnv.value = 0.35;
      const e = new THREE.Mesh(new THREE.PlaneGeometry(ew, eh), m); e.position.set(0, -0.15, 0.01); f.add(e);
      const an = new THREE.Object3D(); an.position.set(0, -0.15, 0.4); f.add(an);
      const [c, g] = toile(1920, 1080); g.fillStyle = "#040404"; g.fillRect(0, 0, 1920, 1080); const h = 260, w = h * logoBola.width / logoBola.height; g.drawImage(logoBola, (1920 - w) / 2, (1080 - h) / 2, w, h);
      emplacement(nom, [m], [1920, 1080], an, c);
      // la ceinture du haut : logos
      const mb = matEcran(null, [C.w * 40, 0.7 * 40], 2.2); const b = new THREE.Mesh(new THREE.PlaneGeometry(C.w - 0.1, 0.7), mb); b.position.set(0, C.h / 2 + 0.55, 0.01); f.add(b); bandeMats.push(mb);
      // le cadre
      const cad = (w, h, px, py) => { const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), acier); k.position.set(px, py, 0.04); f.add(k); };
      cad(ew + 0.3, 0.12, 0, eh / 2 - 0.15 + 0.06); cad(ew + 0.3, 0.12, 0, -eh / 2 - 0.15 - 0.06); cad(0.12, eh + 0.3, ew / 2 + 0.09, -0.15); cad(0.12, eh + 0.3, -ew / 2 - 0.09, -0.15);
    }
    { const [c, g] = toile(2400, 240); g.fillStyle = "#030303"; g.fillRect(0, 0, 2400, 240); const h = 150, w = h * logoBola.width / logoBola.height; g.drawImage(logoBola, (2400 - w) / 2, 45, w, h);
      const ancreB = new THREE.Object3D(); ancreB.position.y = C.h / 2 + 0.55; gr.add(ancreB); emplacement("bandeau", bandeMats, [2400, 240], ancreB, c); }
    // dessous : le gril de projecteurs et la caméra « spider »
    const gril = new THREE.Mesh(new THREE.BoxGeometry(C.w * 0.8, 0.25, C.d * 0.8), acier); gril.position.y = -C.h / 2 - 0.3; gr.add(gril);
    const matPetit = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.92, 0.8).multiplyScalar(3.2) });
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 16), noirMat); p.position.set(i * 1.8, -C.h / 2 - 0.6, j * 1.8); gr.add(p);
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.13, 16), matPetit); l.rotation.x = Math.PI / 2; l.position.set(i * 1.8, -C.h / 2 - 0.76, j * 1.8); gr.add(l); }
    // câbles jusqu'à la charpente
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const L = DIM.toit - 2.6 - (C.y + C.h / 2 + 1); const k = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, L, 6), acier); k.position.set(x * C.w * 0.4, C.h / 2 + 1 + L / 2, z * C.d * 0.4); gr.add(k); }
    // les grappes de son (line arrays) accrochées de part et d'autre du cube
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const g2 = new THREE.Group(); g2.position.set(sx * 8.6, 2.4, sz * 5.8); g2.lookAt(0, -C.y, 0); gr.add(g2);
      for (let k = 0; k < 8; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.32, 0.6), noirMat); b.position.set(0, -k * 0.34, k * k * 0.004); b.rotation.x = -k * 0.035; g2.add(b);
        const grille = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.26), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, metalness: 0.3 })); grille.position.set(0, -k * 0.34, k * k * 0.004 + 0.301); grille.rotation.x = -k * 0.035; g2.add(grille); }
      const k2 = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, DIM.toit - C.y, 6), acier); k2.position.y = (DIM.toit - C.y) / 2; g2.add(k2); }
    points.sousCube = new THREE.Vector3(0, C.y - C.h / 2 - 1, 0); points.cube = new THREE.Vector3(0, C.y, 0);
    // une lumière qui vient des écrans (ils éclairent le terrain d'un halo)
    const halo = new THREE.PointLight(0xdfe6ff, 55, 20, 2); halo.position.set(0, C.y - 3, 0); scene.add(halo);
  }

  points.rond = new THREE.Vector3(0, 0, 0); points.tribuneN = new THREE.Vector3(0, 4, -18); points.tribuneS = new THREE.Vector3(0, 4, 18);
  // le marquage du rond central : peint dans le gazon
  emplacements.sol = { nom: "sol", ancre: (() => { const a = new THREE.Object3D(); a.position.set(0, 0.04, 0); scene.add(a); return a; })(),
    poser(src) { const c = peindreGazon(Q.texGazon, src); texGazon.image = c; texGazon.needsUpdate = true; return this; } };


  // ---- le marbre de la DA BOLA : un blanc chaud veiné, poli (les piliers du stade « Olympe »)
  const toileMarbre = (() => { const [c, g] = toile(1024, 1024); const rm = alea(77); g.fillStyle = "#e8e4dd"; g.fillRect(0, 0, 1024, 1024);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${rm() < 0.5 ? "255,255,255" : "170,160,150"},${rm() * 0.05})`; g.beginPath(); g.arc(rm() * 1024, rm() * 1024, 10 + rm() * 70, 0, 7); g.fill(); }
    g.filter = "blur(1.2px)";
    for (let v = 0; v < 26; v++) { let x = rm() * 1024, y = rm() * 1024, a = rm() * 6.28; g.strokeStyle = `rgba(110,100,92,${0.12 + rm() * 0.3})`; g.lineWidth = 0.6 + rm() * 2.2; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 90; k++) { a += (rm() - 0.5) * 0.6; x += Math.cos(a) * 9; y += Math.sin(a) * 9 + 3; g.lineTo(x, y); } g.stroke(); }
    g.filter = "none"; return c; })();
  const texMarbre = texDe(toileMarbre, true, [1, 2]);
  const marbre = new THREE.MeshPhysicalMaterial({ map: texMarbre, roughness: 0.22, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 0.9 });
  // un pilier sobre : socle, fût cannelé légèrement galbé, chapiteau dorique
  function pilier(h, r) {
    const g = new THREE.Group(); const hf = h - r * 1.6;
    const plinthe = new THREE.Mesh(new THREE.BoxGeometry(r * 2.7, r * 0.42, r * 2.7), marbre); plinthe.position.y = r * 0.21; g.add(plinthe);
    const tore = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.2, r * 0.36, 48), marbre); tore.position.y = r * 0.6; g.add(tore);
    const fut = new THREE.CylinderGeometry(r, r, hf, 120, 12, true); const P = fut.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = y / hf + 0.5, th = Math.atan2(z, x);
      const k = (1 - 0.1 * t * t) * (1 - 0.035 * (0.5 + 0.5 * Math.cos(th * 20))); P.setXYZ(i, x * k, y, z * k); }
    fut.computeVertexNormals(); const f = new THREE.Mesh(fut, marbre); f.position.y = r * 0.78 + hf / 2; g.add(f);
    const ech = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.18, r * 0.9, r * 0.38, 48), marbre); ech.position.y = r * 0.78 + hf + r * 0.19; g.add(ech);
    const aba = new THREE.Mesh(new THREE.BoxGeometry(r * 2.5, r * 0.34, r * 2.5), marbre); aba.position.y = r * 0.78 + hf + r * 0.38 + r * 0.17; g.add(aba);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g;
  }
  // une personne assise, lisse (pas de visage, comme la foule) : buste, tête, bras posés sur la table
  const matCostume = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.55 });
  const matChemise = new THREE.MeshStandardMaterial({ color: 0x8c8882, roughness: 0.6 });
  const matPeau = new THREE.MeshStandardMaterial({ color: 0x3a2d26, roughness: 0.45 }); // des silhouettes, comme la foule : pas de visage dessiné
  function assis({ clair = false, casque = false } = {}) {
    const g = new THREE.Group(); const veste = clair ? matChemise : matCostume;
    const buste = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.36, 4, 14), veste); buste.scale.set(1.15, 1, 0.75); buste.position.set(0, 1.0, 0); g.add(buste);
    const cou = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.12, 12), matPeau); cou.position.set(0, 1.38, 0.01); g.add(cou);
    const tete = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), matPeau); tete.scale.set(0.9, 1.12, 1); tete.position.set(0, 1.53, 0.02); g.add(tete);
    for (const sx of [-1, 1]) { const bras = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.3, 4, 10), veste); bras.position.set(sx * 0.25, 1.05, 0.12); bras.rotation.x = -0.9; bras.rotation.z = sx * 0.15; g.add(bras);
      const av = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.26, 4, 10), veste); av.position.set(sx * 0.2, 0.9, 0.36); av.rotation.x = -1.45; av.rotation.z = -sx * 0.35; g.add(av);
      const main = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), matPeau); main.position.set(sx * 0.12, 0.88, 0.52); g.add(main); }
    if (casque) { const arc = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.012, 8, 24, Math.PI), noirMat); arc.position.set(0, 1.55, 0.02); g.add(arc);
      for (const sx of [-1, 1]) { const ec = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 16), noirMat); ec.rotation.z = Math.PI / 2; ec.position.set(sx * 0.115, 1.52, 0.02); g.add(ec); }
      const perche = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.17, 6), noirMat); perche.position.set(-0.08, 1.45, 0.1); perche.rotation.set(0.9, 0, -0.6); g.add(perche);
      const micro = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), noirMat); micro.position.set(-0.03, 1.42, 0.16); g.add(micro); }
    const chaise = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.48), noirMat); chaise.position.set(0, 0.5, -0.05); g.add(chaise);
    const dossier = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.62, 0.06), noirBrillant); dossier.position.set(0, 0.86, -0.3); dossier.rotation.x = -0.1; g.add(dossier);
    const pied = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.46, 8), acier); pied.position.set(0, 0.25, -0.05); g.add(pied);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g;
  }
  // un écran de régie posé sur une table (une lueur froide, rien de lisible)
  const matMoniteur = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.62, 0.75).multiplyScalar(0.55) });
  function moniteur() { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.27, 0.03), noirMat); b.position.y = 0.17; g.add(b);
    const e = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.24), matMoniteur); e.position.set(0, 0.17, 0.016); g.add(e); const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), noirMat); p.position.y = 0.03; g.add(p); return g; }
  const logoPanneau = (w, h, im, fond = "#050505", hk = 0.42) => { const [c, g] = toile(w, h); g.fillStyle = fond; g.fillRect(0, 0, w, h); const hh = h * hk, ww = hh * im.width / im.height; g.drawImage(im, (w - ww) / 2, (h - hh) / 2, ww, hh); return c; };

  // ---- le plateau TV : une estrade de marbre au pied du mur BOLA, le desk à trois places, l'écran derrière, deux piliers
  {
    const st = new THREE.Group(); st.position.set(-21.6, 0, -10.2); st.rotation.y = Math.PI / 2; scene.add(st); // son +z regarde le terrain
    const estrade = new THREE.Mesh(new THREE.BoxGeometry(9, 0.42, 6.4), marbre); estrade.position.y = 0.21; estrade.receiveShadow = true; estrade.castShadow = true; st.add(estrade);
    const marche = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.2, 7.0), noirBrillant); marche.position.y = 0.1; st.add(marche);
    const filetLum = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.025, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.92).multiplyScalar(2.6) })); filetLum.position.set(0, 0.03, 3.51); st.add(filetLum);
    // l'écran du fond (16:9) dans son cadre
    const mEc = matEcran(null, [8 * 120, 4.5 * 120], 1.25); mEc.uniforms.uAEnv.value = 0.06;
    const ec = new THREE.Mesh(new THREE.PlaneGeometry(8, 4.5), mEc); ec.position.set(0, 0.42 + 0.35 + 2.25, -3.0); st.add(ec);
    const cadre = new THREE.Mesh(new THREE.BoxGeometry(8.3, 4.8, 0.25), noirBrillant); cadre.position.set(0, ec.position.y, -3.14); st.add(cadre);
    const anS = new THREE.Object3D(); anS.position.set(0, ec.position.y, -2.8); st.add(anS);
    emplacement("studio", [mEc], [1920, 1080], anS, logoPanneau(1920, 1080, logoBola, "#060606", 0.2));
    // le desk : plateau noir laqué, face lumineuse, trois places
    const desk = new THREE.Group(); desk.position.set(0, 0.42, 0.9); st.add(desk);
    const dessus = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.06, 1.0), noirBrillant); dessus.position.set(0, 0.76, 0); dessus.castShadow = true; desk.add(dessus);
    const caisson = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.73, 0.7), noirMat); caisson.position.set(0, 0.365, 0.05); caisson.castShadow = true; desk.add(caisson);
    const mP = matEcran(null, [3.8 * 60, 0.55 * 60], 1.35); const face = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 0.55), mP); face.position.set(0, 0.4, 0.405); desk.add(face);
    const anP = new THREE.Object3D(); anP.position.set(0, 0.4, 0.5); desk.add(anP);
    emplacement("pupitre", [mP], [1520, 220], anP, logoPanneau(1520, 220, logoBola, "#050505", 0.5));
    [[-1.3, false], [0, true], [1.3, false]].forEach(([x, clair]) => { const a = assis({ clair }); a.position.set(x, 0.42 - 0.1, 0.05); st.add(a); });
    for (const x of [-1.3, 0, 1.3]) { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.12, 12), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.6, roughness: 0.05, transparent: true, opacity: 0.5 })); v.position.set(x + 0.35, 0.42 + 0.85, 1.0); st.add(v); }
    // les deux piliers qui cadrent le plateau, comme sur l'image « Olympe »
    for (const sx of [-1, 1]) { const pi = pilier(8.6, 0.42); pi.position.set(sx * 4.0, 0.42, 2.6); st.add(pi); }
    // la lumière du plateau : une face douce et un contre-jour
    const face1 = new THREE.SpotLight(0xfff4e8, 230, 18, 0.55, 0.85, 2); face1.position.set(-10.5, 6.5, -6.5); face1.target.position.set(-21.4, 1.4, -10.2); scene.add(face1, face1.target);
    const contre = new THREE.SpotLight(0xffe6cc, 220, 14, 0.7, 0.9, 2); contre.position.set(-25.5, 7.5, -10.2); contre.target.position.set(-20.6, 1.2, -10.2); scene.add(contre, contre.target);
    points.studio = new THREE.Vector3(-20.7, 1.6, -10.2);
  }

  // ---- le pupitre du commentateur : au bord du terrain, côté tribune sud, un commentateur au casque
  {
    const cm = new THREE.Group(); cm.position.set(-6.5, 0, 13.4); cm.rotation.y = Math.PI; scene.add(cm); // +z vers le terrain
    const socle = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 2.0), noirBrillant); socle.position.set(0, 0.08, -0.3); socle.receiveShadow = true; cm.add(socle);
    const dessus = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.05, 0.8), noirBrillant); dessus.position.set(0, 0.92, 0.35); dessus.castShadow = true; cm.add(dessus);
    const caisson = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.76, 0.6), noirMat); caisson.position.set(0, 0.16 + 0.38, 0.42); caisson.castShadow = true; cm.add(caisson);
    const mC = matEcran(null, [2.5 * 60, 0.5 * 60], 1.3); const face = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.5), mC); face.position.set(0, 0.52, 0.725); cm.add(face);
    const anC = new THREE.Object3D(); anC.position.set(0, 0.52, 0.8); cm.add(anC);
    emplacement("commentateur", [mC], [1000, 200], anC, logoPanneau(1000, 200, sigleSfl, "#050505", 0.5));
    // le panneau de fond du pupitre (il cache la tribune derrière, comme sur un vrai bord de terrain)
    const fondC = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.9, 0.08), noirMat); fondC.position.set(0, 0.16 + 1.45, -1.15); cm.add(fondC);
    const ligneC = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.92).multiplyScalar(2.2) })); ligneC.position.set(0, 2.95, -1.1); ligneC.scale.x = 1.8; cm.add(ligneC);
    { const [c, g] = toile(512, 128); g.fillStyle = "#000"; g.fillRect(0, 0, 512, 128); const h = 60, w = h * logoBola.width / logoBola.height; g.drawImage(logoBola, (512 - w) / 2, 34, w, h);
      const lg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: texDe(c), color: new THREE.Color().setScalar(1.3) })); lg.position.set(0, 2.45, -1.105); cm.add(lg); }
    const c1 = assis({ casque: true }); c1.position.set(-0.55, 0.16 - 0.1 + 0.08, 0.0); c1.rotation.y = 0.12; cm.add(c1);
    const chaiseVide = assis(); chaiseVide.children.slice(0, -3).forEach((o) => (o.visible = false)); chaiseVide.position.set(0.65, 0.14, 0.0); cm.add(chaiseVide);
    for (const x of [-0.95, 0.45]) { const m = moniteur(); m.position.set(x, 0.945, 0.6); m.rotation.y = Math.PI; cm.add(m); } // tournés vers le commentateur
    const lampe = new THREE.SpotLight(0xfff1e0, 70, 9, 0.6, 0.9, 2); lampe.position.set(-6.5, 4.8, 9.6); lampe.target.position.set(-6.9, 1.1, 13.4); scene.add(lampe, lampe.target);
    points.commentateur = new THREE.Vector3(-7.0, 1.4, 13.4);
  }

  // ---- deux piliers de marbre qui encadrent le tunnel (sobres, sous le grand panneau BOLA)
  for (const sz of [-1, 1]) { const pi = pilier(7.2, 0.46); pi.position.set(DIM.murX + 1.3, 0, sz * 5.6); scene.add(pi); }

  // ---- les caméras de télé autour du terrain (trépied, corps, objectif, viseur), et une grue
  {
    const cam = () => { const g = new THREE.Group();
      for (let k = 0; k < 3; k++) { const a = k * 2.094; const j = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 1.45, 6), acier); j.position.set(Math.sin(a) * 0.32, 0.68, Math.cos(a) * 0.32); j.rotation.set(Math.cos(a) * 0.24, 0, -Math.sin(a) * 0.24); g.add(j); }
      const tete = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.22), noirMat); tete.position.y = 1.42; g.add(tete);
      const corps = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.62), noirMat); corps.position.set(0, 1.64, 0); g.add(corps);
      const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.42, 16), noirBrillant); obj.rotation.x = Math.PI / 2; obj.position.set(0, 1.64, 0.5); g.add(obj);
      const verre = new THREE.Mesh(new THREE.CircleGeometry(0.065, 16), new THREE.MeshPhysicalMaterial({ color: 0x050812, roughness: 0.02, metalness: 0.3, clearcoat: 1 })); verre.position.set(0, 1.64, 0.715); g.add(verre);
      const viseur = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.04), noirMat); viseur.position.set(0, 1.86, -0.2); g.add(viseur);
      const tally = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.01), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.12, 0.08).multiplyScalar(2) })); tally.position.set(0.08, 1.8, 0.31); g.add(tally);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return g; };
    for (const [x, z, vise] of [[3, 12.2, [0, 1, 0]], [-12.5, 12.0, [-6, 1, 0]], [12.5, -12.2, [6, 1, 0]], [-17.2, 6.5, [-8, 1, 0]], [17.6, 3.5, [8, 1, -2]]]) {
      const c = cam(); c.position.set(x, 0, z); c.lookAt(vise[0], 0, vise[2]); scene.add(c); }
    // la grue près du plateau TV : pied, bras en treillis, tête caméra
    const grue = new THREE.Group(); grue.position.set(-17.6, 0, -15.0); scene.add(grue);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.3, 16), noirMat); base.position.y = 0.15; grue.add(base);
    const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.6, 10), acier); mat.position.y = 1.1; grue.add(mat);
    const bras = new THREE.Group(); bras.position.y = 1.9; bras.rotation.set(0, -0.9, 0.38); grue.add(bras);
    const poutre = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 0.12), acier); poutre.position.x = 1.6; bras.add(poutre);
    const contrep = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.3), noirMat); contrep.position.x = -1.1; bras.add(contrep);
    const tc = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.42), noirMat); tc.position.set(4.2, -0.3, 0); bras.add(tc);
    grue.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }

  // ---- ombres (une fois : la salle ne bouge pas ; refaire avec plateau.majOmbres() si on pose des objets)
  // ---- reflets : la salle elle-même, captée depuis le-dessus du rond central, sert d'environnement
  const pm = new THREE.PMREMGenerator(renderer);
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType }); const cubeCam = new THREE.CubeCamera(0.5, 120, cubeRT); cubeCam.position.set(0, 4, 0); scene.add(cubeCam);
  cubeCam.update(renderer, scene); envCube.value = cubeRT.texture;
  const envTex = pm.fromCubemap(cubeRT.texture).texture; scene.environment = envTex; scene.environmentIntensity = 0.55;
  renderer.shadowMap.needsUpdate = true;

  // ---- la caméra et la post-production
  const camera = new THREE.PerspectiveCamera(35, largeur / hauteur, 0.05, 200);
  const rt = new THREE.WebGLRenderTarget(largeur, hauteur, { type: THREE.HalfFloatType, samples: Q.msaa });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(Q.pr); composer.setSize(largeur, hauteur);
  composer.addPass(new RenderPass(scene, camera));
  // l'occlusion ambiante (GTAO) : ce qui ancre les objets (cartes posées, sièges, poteaux) dans la salle
  // (GTAO essayé le 02/11 : il voit les filets et les couches du gazon comme des surfaces pleines → halos sombres ; coupé)
  let ao = null; if (false) { ao = new GTAOPass(scene, camera, largeur, hauteur); ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = 0.85;
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 }); composer.addPass(ao); }
  const bloom = new UnrealBloomPass(new THREE.Vector2(largeur * Q.bloom, hauteur * Q.bloom), 0.38, 0.5, 1.7); composer.addPass(bloom);
  // les traînées horizontales d'un objectif anamorphique sur les sources très fortes (projecteurs, LED)
  const trainees = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uSeuil: { value: 2.2 }, uForce: { value: 0.09 }, uLong: { value: 0.22 } },
    vertexShader: ETALON.vertexShader,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uSeuil; uniform float uForce; uniform float uLong; varying vec2 vUv;
      void main() { vec3 c = texture2D(tDiffuse, vUv).rgb; vec3 s = vec3(0.0); float tot = 0.0;
        for (int i = -24; i <= 24; i++) { float f = float(i) / 24.0; vec3 e = texture2D(tDiffuse, vUv + vec2(f * uLong, 0.0)).rgb; float w = exp(-abs(f) * 4.0);
          s += max(e - vec3(uSeuil), vec3(0.0)) * w; tot += w; }
        gl_FragColor = vec4(c + s / tot * uForce * 24.0 * vec3(0.85, 0.92, 1.0), 1.0); }` });
  if (Q.ao) composer.addPass(trainees);
  composer.addPass(new OutputPass());
  // sans MSAA (téléphone), un FXAA après le passage en sRGB, avant le grain
  let fxaa = null; if (Q.fxaa) { fxaa = new FXAAPass(); composer.addPass(fxaa); }
  const etalon = new ShaderPass(ETALON); composer.addPass(etalon);

  // ---- les plans de caméra tout faits : des courbes (Catmull-Rom) de positions et de visées, et une focale
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const plans = {
    large: { duree: 6, pos: [V3(29, 11.5, 7), V3(28, 11, 5), V3(27, 10.6, 3)], vise: [V3(-8, 1.8, 0), V3(-8, 2.2, 0), V3(-8, 2.6, 0)], fov: [62, 60] },
    contrePlongee: { duree: 6, pos: [V3(3, 1.4, 9.4), V3(1, 1.5, 9.0), V3(-1, 1.6, 8.6)], vise: [V3(0, 9.6, 0), V3(0, 10, 0), V3(0, 10.4, 0)], fov: [52, 50] },
    orbiteCube: { duree: 8, orbite: { centre: V3(0, 9.6, 0), rayon: 17, haut: 7.4, de: 0.35, a: 1.25 }, fov: [50, 50] },
    bordTerrain: { duree: 6, pos: [V3(12, 0.5, 8.6), V3(5, 0.5, 8.6), V3(-3, 0.55, 8.6)], vise: [V3(2, 3.4, -4), V3(-5, 3.6, -4), V3(-12, 3.8, -4)], fov: [56, 56] },
    drone: { duree: 7, pos: [V3(13, 16.5, 13), V3(6, 8, 8), V3(1.6, 2.3, 4.6)], vise: [V3(0, 2, 0), V3(0, 1.2, 0), V3(0, 1.0, 0)], fov: [58, 44] },
    studio: { duree: 6, pos: [V3(-16.4, 2.5, -8.4), V3(-16.4, 2.35, -10.2), V3(-16.4, 2.2, -12.0)], vise: [V3(-24, 2.3, -10.6), V3(-24, 2.3, -10.2), V3(-24, 2.3, -9.8)], fov: [60, 58] },
    commentateur: { duree: 6, pos: [V3(-3.4, 1.7, 10.45), V3(-4.2, 1.65, 10.45), V3(-5.0, 1.6, 10.45)], vise: [V3(-6.8, 1.2, 13.4), V3(-6.8, 1.2, 13.4), V3(-6.8, 1.2, 13.4)], fov: [52, 50] },
    tunnel: { duree: 6, pos: [V3(-18.2, 1.5, 6.5), V3(-19.6, 1.55, 5.2), V3(-21, 1.6, 3.9)], vise: [V3(DIM.murX, 3.6, 0), V3(DIM.murX, 3.2, 0), V3(DIM.murX, 2.8, 0)], fov: [56, 54] },
    rondCentral: { duree: 6, pos: [V3(0.6, 1.0, 4.4), V3(0, 1.05, 4.0), V3(-0.6, 1.1, 3.6)], vise: [V3(0, 2.4, 0), V3(0, 2.6, 0), V3(0, 2.8, 0)], fov: [50, 48] },
  };
  const courbes = {};
  for (const [k, p] of Object.entries(plans)) if (p.pos) courbes[k] = [new THREE.CatmullRomCurve3(p.pos), new THREE.CatmullRomCurve3(p.vise)];
  const lisse = (u) => u * u * (3 - 2 * u);
  function cadrer(nom, u) {
    const p = plans[nom]; const s = lisse(cl(u)); const f = p.fov[0] + (p.fov[1] - p.fov[0]) * s;
    if (p.orbite) { const o = p.orbite, a = o.de + (o.a - o.de) * s; camera.position.set(o.centre.x + Math.sin(a) * o.rayon, o.haut, o.centre.z + Math.cos(a) * o.rayon); camera.lookAt(o.centre); }
    else { const [cp, cv] = courbes[nom]; camera.position.copy(cp.getPoint(s)); camera.lookAt(cv.getPoint(s)); }
    // en 16:9 la focale s'ouvre pour garder la même hauteur de champ vue en 9:16 ? non : on garde la largeur utile
    camera.fov = largeur > hauteur ? f * 0.62 : f; camera.updateProjectionMatrix();
  }

  const pc = new THREE.Vector3();
  function rendre(t) {
    temps.value = t; etalon.uniforms.uTemps.value = t; for (const f of majTemps) f(t);
    for (const c of cones) { c.m.updateWorldMatrix(true, false); c.m.worldToLocal(pc.copy(camera.position)); const u = THREE.MathUtils.clamp((c.h / 2 - pc.y) / c.h, 0, 1), rr = c.r0 + (c.r1 - c.r0) * u;
      const dedans = Math.abs(pc.y) < c.h / 2 + 1 ? THREE.MathUtils.smoothstep(Math.hypot(pc.x, pc.z), rr * 0.9, rr * 2.2) : 1; c.m.material.uniforms.uForce.value = c.f * dedans; }
    composer.render();
  }
  return { scene, camera, renderer, composer, emplacements, envCube, ao, trainees, points, plans, cadrer, rendre, majTemps, temps, bloom, etalon, DIM, fxaa,
    lyres: lyresObj, flashs: flashsObj,
    majOmbres() { renderer.shadowMap.needsUpdate = true; },
    majReflets() { cubeCam.update(renderer, scene); }, logos: { bola: logoBola, sfl: sigleSfl, symbole: logoSymbole } };
}
