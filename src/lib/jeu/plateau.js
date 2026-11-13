// Copie du plateau BOLA pour le jeu (SFL /jouer, 03/11/2026, Sabri : « le plateau Bola avec un gameplay de 5 contre 5 »).
// Source : sabrilab/bola-site, plateau3d/plateau.js (13/11/2026 : le décor vient de Blender, issue bola-app#13). Seuls
// changent : les imports (three/examples/jsm au lieu de three/addons, le décodeur meshopt pris dans three par le
// bundler) et cet en-tête. Les GLB sont dans public/jeu/plateau/ ; plateau-code.js (le jet 7 construit par le code)
// reste le repli si le GLB manque. Une version suivante du plateau se reporte ici en gardant ces écarts.
//
// Le plateau BOLA, rechargé depuis Blender (13/11/2026, issue bola-app#13, Sabri : « passer par Blender… tout
// regénérer… rendre le travail fait sur Blender dans le navigateur. Il me semble que ce sera plus optimisé »).
//
// Jusqu'au jet 7, ce fichier construisait toute la salle par le code à l'ouverture (1 104 maillages, 24 lumières,
// 804 draw calls par image en téléphone). Ce fichier-là est gardé tel quel sous le nom plateau-code.js : il sert de
// repli si le GLB ne se charge pas, et de point de comparaison (?decor=code).
//
// Ici, la salle vient de plateau-telephone.glb ou plateau-film.glb, exportés du fichier Blender versionné dans
// sabrilab/bola-app (blender/plateau/ : construire.py, plateau.blend, cuire.py, assembler.mjs, LISEZ-MOI.md) :
//   - le décor fixe est fusionné par matière (maillages st_*), compressé en meshopt, textures en WebP ;
//   - son éclairage est cuit dans Cycles : quatre lightmaps (rangées dans l'emplacement d'occlusion des matières du
//     GLB, déplacées ici vers lightMap), des couleurs de sommets pour la charpente et le mobilier, et la lumière
//     reçue à chacune des 6 820 places (couleur d'instance des sièges) ;
//   - les emplacements sont des nœuds vides nommés emplacement_<nom>, leurs surfaces d'affichage des maillages
//     plan_<nom>, les points des nœuds point_<nom> ;
//   - chaque matière porte son rôle dans userData.genre : cuit, cuit_sommets, brillant, emissif, emissif_tex, ecran,
//     gazon, alpha, verre, gabarit.
// Restent en code, parce qu'ils bougent ou se règlent : les écrans LED (shader), les fibres du gazon, la foule et son
// sursaut, les sièges, les flashs, les lyres, les faisceaux dans la brume, les reflets de la salle, la post-production.
//
// Lumières en temps réel : trois, pour ce qui n'est pas cuit (cartes, joueurs, ballon) et pour l'éclat des matières
// brillantes (sol, marbre, laque) : l'hémisphère du jet 7 et deux projecteurs au-dessus des lignes de touche, qui
// valent la somme des grappes. Le décor cuit ne les évalue pas. Les deux projecteurs portent l'ombre des objets posés
// (cartes), reçue par un plan transparent sur le gazon et calculée une seule fois (majOmbres()).
//
// L'API ne change pas : creerPlateau(renderer, { qualite, base, largeur, hauteur }) rend
// { scene, camera, renderer, composer, emplacements, points, plans, cadrer, rendre, majTemps, temps, bloom, etalon,
//   trainees, fxaa, ao, envCube, lyres, flashs, majOmbres, majReflets, logos, DIM }.
// Emplacements : ecranN, ecranS, ecranE, ecranO, bandeau, mur, banniereG, banniereD, panneauxN, panneauxS, panneauxE,
// panneauxO, sol, studio, pupitre, commentateur, rubanN, rubanS, rubanE. Chacun a .poser(source) (canvas, image,
// vidéo, THREE.Texture ou URL) et .ancre, le nœud du GLB posé à cet endroit.
//
// Qualités : "telephone" et "film" (viewer), "jeuTel", "jeuPlein" et "jeu" (SFL /jouer). telephone, jeuTel et jeu
// chargent plateau-telephone.glb ; film et jeuPlein chargent plateau-film.glb (gazon 4096). Le reste se règle ici.
//
// Le chargement est découpé en tâches courtes (une pause entre deux étapes, shaders liés hors du fil principal par
// compileAsync) ; chaque étape pose un performance.mark « plateau:<étape> » pour trouver celle qui traîne.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
/* eslint-disable -- copie du plateau, gardée telle quelle pour suivre ses versions */

// ---------------------------------------------------------------- dimensions (celles du jet 7 ; verifier.py contrôle le .blend contre elles)
export const DIM = {
  L: 30, l: 18,            // aire de jeu (lignes)
  TL: 32, Tl: 20,          // gazon jusqu'aux panneaux
  panneau: 0.95,           // hauteur des panneaux LED
  filet: 5.2,              // hauteur du filet au-dessus des panneaux
  but: [3, 2, 0.9],        // but de foot à cinq : largeur, hauteur, profondeur
  salle: [96, 78], toit: 23, // salle (x, z) et faîtage
  portique: 16.2,          // le cadre d'éclairage suspendu au-dessus du terrain
  cube: { y: 12, w: 8.3, h: 4.67, d: 8.3 },
  murX: -27,               // le mur BOLA (côté ouest)
};
// glb : le fichier chargé ; ombres : l'ombre des objets posés ; couches : fibres du gazon ; foule : part des places
// occupées (× 0,8) ; fouleFine : gabarit détaillé du spectateur ; le reste comme au jet 7
const QUALITES = {
  telephone: { glb: "telephone", ombres: true, tailleOmbre: 1024, couches: 5, foule: 0.42, fouleFine: false, bloom: 0.5, msaa: 0, pr: 1, trainees: false, sieges: false, fxaa: true, flashs: 260 },
  film: { glb: "film", ombres: true, tailleOmbre: 2048, couches: 14, foule: 1, fouleFine: true, bloom: 1, msaa: 4, pr: 1, trainees: true, sieges: true, fxaa: false, flashs: 700 },
  // le jeu (SFL /jouer) sur ordinateur : le plateau entier (sièges, foule fine, gazon épais), sans le MSAA
  jeuPlein: { glb: "film", ombres: true, tailleOmbre: 2048, couches: 10, foule: 1, fouleFine: true, bloom: 0.8, msaa: 0, pr: 1, trainees: false, sieges: true, fxaa: true, flashs: 520 },
  // le jeu sur téléphone : le plateau du téléphone, avec ses sièges et un gazon plus épais
  jeuTel: { glb: "telephone", ombres: true, tailleOmbre: 1024, couches: 7, foule: 0.75, fouleFine: false, bloom: 0.6, msaa: 0, pr: 1, trainees: false, sieges: true, fxaa: true, flashs: 300 },
  // l'ancien réglage du jeu, gardé pour les appareils faibles
  jeu: { glb: "telephone", ombres: true, tailleOmbre: 1024, couches: 3, foule: 0.3, fouleFine: false, bloom: 0.5, msaa: 0, pr: 1, trainees: false, sieges: false, fxaa: true, flashs: 140 },
};
// Réglages de l'éclairage cuit, faits en comparant les six plans aux captures du jet 7 (voir le compte rendu) :
// un facteur par atlas et par lot de sommets, sans toucher aux fichiers cuits.
const NIVEAUX = { LM_sols: 1, LM_tribunes: 0.8, LM_ouest: 1, LM_salle: 1, st_charpente: 1, st_mobilier: 1, places: 1.7, filets: 0.55, voileGazon: 0.04 };
// les deux projecteurs en temps réel : au-dessus des lignes de touche nord et sud, visés comme les grappes du centre
const PROJECTEURS = { intensite: 2800, portee: 60, angle: 0.95, penombre: 0.7 };

const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
function alea(graine) { let s = graine >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const pause = () => new Promise((r) => setTimeout(r, 0));
const marque = (nom) => { try { performance.mark("plateau:" + nom); } catch { /* sans importance */ } };

// ---------------------------------------------------------------- textures peintes (les écrans par défaut : seulement BOLA et SFL, en noir ou en blanc)
function toile(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function texDe(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
async function svgImage(url, blanc = true, couleur = "#fff") {
  const txt = await (await fetch(url)).text();
  const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(txt); await img.decode();
  if (!blanc) return img;
  // d'une seule couleur, quelle que soit la couleur d'origine
  const [c, g] = toile(img.naturalWidth * 4 || 2000, img.naturalHeight * 4 || 500); g.drawImage(img, 0, 0, c.width, c.height);
  g.globalCompositeOperation = "source-in"; g.fillStyle = couleur; g.fillRect(0, 0, c.width, c.height); return c;
}

// ---------------------------------------------------------------- matières à shader
// l'écran LED : l'image, la grille des diodes (qui s'efface de loin), le verre qui reflète la salle
// (les UV du GLB suivent la convention glTF, v vers le bas : on les retourne pour garder des textures posées comme au jet 7)
const V_ECRAN = `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() { vUv = vec2(uv.x, 1.0 - uv.y); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const F_ECRAN = `uniform sampler2D map; uniform float uLum; uniform vec2 uPix; uniform vec2 uDefile; uniform float uTemps; uniform samplerCube uEnv; uniform float uAEnv; uniform float uOn;
  varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
  void main() {
    vec2 uv = fract(vUv + uDefile * uTemps);
    vec3 c = texture2D(map, uv).rgb; c = pow(c, vec3(2.2));
    vec2 g = fract(vUv * uPix); vec2 fw = fwidth(vUv * uPix);
    float grille = smoothstep(0.5, 0.18, abs(g.x - 0.5)) * smoothstep(0.5, 0.18, abs(g.y - 0.5));
    float loin = clamp(max(fw.x, fw.y) * 1.6, 0.0, 1.0);
    c *= mix(0.25 + 1.15 * grille, 1.0, loin);
    vec3 N = normalize(vN), V = normalize(vV); if (!gl_FrontFacing) N = -N; float fr = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 R = reflect(-V, N); vec3 refl = textureCube(uEnv, vec3(-R.x, R.yz)).rgb;
    vec3 col = c * uLum * uOn + vec3(0.006) + refl * fr * uAEnv;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
// le faisceau dans la brume : un cône additif, dense près du projecteur, doux sur les bords. Tous les faisceaux d'un
// même gabarit sont un seul maillage instancié : la longueur et la force sont des attributs d'instance (le cône du
// gabarit a une hauteur de 1 ; la matrice d'instance l'étire).
const V_CONE = `attribute float aLong; attribute float aForce; varying vec3 vN; varying vec3 vV; varying float vH; varying float vF;
  void main() { vH = -position.y + 0.5; vF = aForce; mat4 mm = modelMatrix * instanceMatrix; vec4 w = mm * vec4(position, 1.0);
    vN = normalize(mat3(mm) * vec3(normal.x, normal.y / (aLong * aLong), normal.z)); vV = cameraPosition - w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const F_CONE = `uniform vec3 uCouleur; varying vec3 vN; varying vec3 vV; varying float vH; varying float vF;
  void main() { float bord = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float a = bord * pow(1.0 - clamp(vH, 0.0, 1.0), 1.6) * vF * smoothstep(2.0, 9.0, length(vV)); gl_FragColor = vec4(uCouleur * a, 1.0); }`;
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
export async function creerPlateau(renderer, options = {}) {
  const { qualite = "film", base = "./" } = options;
  const Q = QUALITES[qualite] || QUALITES.film;
  // ?decor=code : le plateau du jet 7 construit par le code (comparaison) ; même repli si le GLB manque
  const repli = async (raison) => { if (raison) console.warn("Plateau : repli sur le décor construit par le code.", raison); return (await import("./plateau-code.js")).creerPlateau(renderer, options); };
  if (typeof location !== "undefined" && new URLSearchParams(location.search).get("decor") === "code") return repli(null);
  let gltf;
  marque("debut");
  try { gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(base + "plateau-" + Q.glb + ".glb"); }
  catch (e) { return repli(e); }
  marque("glb");
  await pause();
  return monter(renderer, gltf, Q, options);
}

async function monter(renderer, gltf, Q, { base = "./", largeur = 1080, hauteur = 1920 } = {}) {
  const scene = new THREE.Scene();
  const brume = new THREE.Color(0x0e0b09); scene.background = new THREE.Color(0x050403); scene.fog = new THREE.FogExp2(brume, 0.0052);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = Q.ombres; renderer.shadowMap.type = THREE.VSMShadowMap; renderer.shadowMap.autoUpdate = false;
  const temps = { value: 0 };
  const majTemps = []; // fonctions (t) appelées à chaque image
  const camera = new THREE.PerspectiveCamera(35, largeur / hauteur, 0.05, 200);
  const envCube = { value: null };
  const decor = gltf.scene; decor.name = "plateau"; scene.add(decor); decor.updateMatrixWorld(true);
  const infos = gltf.scene.userData.plateau || {};

  // ---- les logos (SVG de la marque) et les images par défaut des écrans
  const [logoSymbole, logoBola, sigleSfl, logoBolaNoir, sigleSflNoir] = await Promise.all([svgImage(base + "symbole-blanc.svg"), svgImage(base + "logo-blanc.svg"), svgImage(base + "sfl.svg"),
    svgImage(base + "logo-blanc.svg", true, "#0a0a0a"), svgImage(base + "sfl.svg", true, "#0a0a0a")]);
  marque("logos");
  // un bandeau de panneaux : uniquement BOLA et SFL, en blanc sur noir ou en noir sur blanc, par cases de 4 m
  function bandeauPub(longueurM, hauteurM) {
    const ppm = 120; const [c, g] = toile(Math.min(8192, Math.round(longueurM * ppm)), Math.round(hauteurM * ppm));
    const pas = c.width / Math.max(1, Math.round(longueurM / 4)); let k = 0;
    for (let x = 0; x < c.width - 1; x += pas, k++) { const clair = k % 4 >= 2, im = k % 2 ? (clair ? sigleSflNoir : sigleSfl) : (clair ? logoBolaNoir : logoBola);
      g.fillStyle = clair ? "#ececea" : "#050505"; g.fillRect(x, 0, pas + 1, c.height); const h = c.height * 0.52, w = h * im.width / im.height; g.drawImage(im, x + (pas - w) / 2, (c.height - h) / 2, w, h); }
    return c;
  }
  const logoPanneau = (w, h, im, fond = "#050505", hk = 0.42, dy = null, hpx = null) => { const [c, g] = toile(w, h); g.fillStyle = fond; g.fillRect(0, 0, w, h); const hh = hpx || h * hk, ww = hh * im.width / im.height; g.drawImage(im, (w - ww) / 2, dy == null ? (h - hh) / 2 : dy, ww, hh); return c; };
  const kakemono = (im) => { const [c, g] = toile(280, 920); g.fillStyle = "#050505"; g.fillRect(0, 0, 280, 920); g.save(); g.translate(140, 460); g.rotate(-Math.PI / 2); const w = 700, h = w * im.height / im.width; g.drawImage(im, -w / 2, -h / 2, w, h); g.restore(); return c; };
  // une texture par image : les emplacements jumeaux (panneaux nord et sud, les quatre faces du cube) la partagent
  const cacheDefaut = new Map();
  const defaut = (cle, peindre) => { if (!cacheDefaut.has(cle)) cacheDefaut.set(cle, texDe(peindre())); return cacheDefaut.get(cle); };
  const DEFAUTS = {
    panneauxN: () => defaut("pub32", () => bandeauPub(DIM.TL, DIM.panneau * 0.8)), panneauxS: () => defaut("pub32", () => bandeauPub(DIM.TL, DIM.panneau * 0.8)),
    panneauxE: () => defaut("pub20", () => bandeauPub(DIM.Tl, DIM.panneau * 0.8)), panneauxO: () => defaut("pub20", () => bandeauPub(DIM.Tl, DIM.panneau * 0.8)),
    rubanN: () => defaut("ruban56", () => bandeauPub(56.5, 0.5)), rubanS: () => defaut("ruban56", () => bandeauPub(56.5, 0.5)), rubanE: () => defaut("ruban30", () => bandeauPub(30, 0.5)),
    mur: () => defaut("mur", () => logoPanneau(2048, 512, logoBola, "#000", 0, null, 330)),
    banniereG: () => defaut("kakG", () => kakemono(logoBola)), banniereD: () => defaut("kakD", () => kakemono(sigleSfl)),
    ecranN: () => defaut("ecran", () => logoPanneau(1920, 1080, logoBola, "#040404", 0, null, 260)), ecranS: () => DEFAUTS.ecranN(), ecranE: () => DEFAUTS.ecranN(), ecranO: () => DEFAUTS.ecranN(),
    bandeau: () => defaut("ceinture", () => logoPanneau(2400, 240, logoBola, "#030303", 0, 45, 150)),
    studio: () => defaut("studio", () => logoPanneau(1920, 1080, logoBola, "#060606", 0.2)),
    pupitre: () => defaut("pupitre", () => logoPanneau(1520, 220, logoBola, "#050505", 0.5)),
    commentateur: () => defaut("commentateur", () => logoPanneau(1000, 200, sigleSfl, "#050505", 0.5)),
  };

  // ---- les emplacements
  const emplacements = {};
  function matEcran(pix, lum = 1.6, defile = [0, 0], aEnv = 0) {
    return new THREE.ShaderMaterial({ vertexShader: V_ECRAN, fragmentShader: F_ECRAN, toneMapped: true, fog: false, side: THREE.DoubleSide,
      uniforms: { map: { value: null }, uLum: { value: lum }, uPix: { value: new THREE.Vector2(...pix) }, uDefile: { value: new THREE.Vector2(...defile) }, uTemps: temps, uEnv: envCube, uAEnv: { value: aEnv }, uOn: { value: 1 } } });
  }
  function emplacement(nom, mats, format, ancre) {
    const e = { nom, format, ancre, materiaux: mats, texture: null,
      poser(src, { defile = null, lum = null } = {}) {
        let t = src;
        if (typeof src === "string") { t = new THREE.TextureLoader().load(src); }
        else if (typeof HTMLVideoElement !== "undefined" && src instanceof HTMLVideoElement) { t = new THREE.VideoTexture(src); }
        else if (src instanceof HTMLCanvasElement || src instanceof HTMLImageElement || (typeof ImageBitmap !== "undefined" && src instanceof ImageBitmap)) { t = new THREE.Texture(src); t.needsUpdate = true; }
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping;
        for (const m of mats) { m.uniforms.map.value = t; if (defile) m.uniforms.uDefile.value.set(...defile); if (lum != null) m.uniforms.uLum.value = lum; }
        e.texture = t; return e; },
      allumer(v) { for (const m of mats) m.uniforms.uOn.value = v; return e; },
    };
    emplacements[nom] = e; return e;
  }

  // ---- les matières du décor, selon le rôle que le GLB leur donne (userData.genre)
  const noeuds = {}; decor.traverse((o) => { if (o.name) noeuds[o.name] = o; });
  const matieres = new Map(); // une matière par rôle et par atlas, partagée
  const une = (cle, creer) => { if (!matieres.has(cle)) matieres.set(cle, creer()); return matieres.get(cle); };
  const lumiereDe = (m, atlas) => { const t = m.aoMap; t.colorSpace = THREE.SRGBColorSpace; return { lightMap: t, lightMapIntensity: (m.userData.echelle || 1) * Math.PI * (NIVEAUX[atlas] ?? 1) }; };
  // une matière brillante garde le reflet de la salle et l'éclat des projecteurs ; son diffus vient de la lightmap :
  // on retire donc l'hémisphère (déjà cuite) et le diffus direct des projecteurs en temps réel
  const diffusCuit = (m) => { m.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader
    .replace("#include <lights_fragment_maps>", "irradiance = vec3(0.0);\n#include <lights_fragment_maps>")
    .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\nreflectedLight.directDiffuse = vec3(0.0);"); }; m.customProgramCacheKey = () => "bola-plateau-diffus-cuit-v1"; };
  const FACE = THREE.FrontSide; // le GLB sort de Blender en double face ; le décor fusionné n'a que des faces tournées vers la salle
  const plansEcran = {}; const gabarits = {}; const lotsPlaces = []; const aRetirer = [];
  let planSol = null;
  decor.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material, ex = m.userData || {}, genre = ex.genre;
    if (o.name.startsWith("gab_")) { gabarits[o.name] = o; aRetirer.push(o); return; }
    if (o.name.startsWith("places_")) { lotsPlaces.push(o); aRetirer.push(o); return; }
    if (genre === "ecran") { const d = o.userData; const mat = matEcran(d.pix || [100, 100], d.lum ?? 1.6, d.defile || [0, 0], d.aEnv || 0); o.material = mat; (plansEcran[d.emplacement] ||= []).push({ o, mat, format: d.format }); return; }
    if (genre === "gazon") { planSol = o; return; }
    if (genre === "cuit") o.material = une("cuit:" + ex.lumiere, () => new THREE.MeshBasicMaterial({ color: 0xffffff, side: FACE, ...lumiereDe(m, ex.lumiere) }));
    else if (genre === "cuit_sommets") o.material = une("sommets:" + o.name, () => new THREE.MeshBasicMaterial({ vertexColors: true, side: FACE, color: new THREE.Color().setScalar((o.userData.echelle || 1) * (NIVEAUX[o.name] ?? 1)) }));
    else if (genre === "emissif") o.material = une("emissif", () => new THREE.MeshBasicMaterial({ vertexColors: true, side: FACE, color: new THREE.Color().setScalar(ex.facteur || 1) }));
    else if (genre === "emissif_tex") o.material = une("emissif_tex", () => { m.map.anisotropy = 8; return new THREE.MeshBasicMaterial({ map: m.map, vertexColors: true, side: FACE, color: new THREE.Color().setScalar(ex.facteur || 1) }); });
    else if (genre === "alpha") o.material = une("alpha:" + m.name, () => ex.coupe
      ? new THREE.MeshBasicMaterial({ map: m.map, color: new THREE.Color(...ex.couleur).multiplyScalar(NIVEAUX.filets), alphaTest: ex.coupe, side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ map: m.map, color: new THREE.Color(...ex.couleur), transparent: true, opacity: ex.opacite ?? 1, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true }));
    else if (genre === "verre") { m.depthWrite = false; m.forceSinglePass = true; m.envMapIntensity = 1; }
    else if (genre === "brillant") { m.side = FACE; if (ex.env != null) m.envMapIntensity = ex.env;
      if (ex.lumiere && m.aoMap) { Object.assign(m, lumiereDe(m, ex.lumiere)); m.aoMap = null; diffusCuit(m); if (m.map) m.map.anisotropy = 8; } }
  });
  for (const o of aRetirer) o.removeFromParent();
  marque("matieres");

  // ---- les écrans : une matière par plan, un emplacement par nom, l'ancre est le nœud du GLB
  for (const [nom, plans] of Object.entries(plansEcran)) {
    const ancre = noeuds["emplacement_" + nom] || plans[0].o;
    const e = emplacement(nom, plans.map((p) => p.mat), plans[0].format || [1920, 1080], ancre);
    if (DEFAUTS[nom]) e.poser(DEFAUTS[nom]());
  }
  await pause();
  marque("ecrans");

  // ---- le gazon : la base cuite du GLB, et des couches (shell texturing) qui donnent le relief des fibres,
  // toutes dans un seul maillage instancié (le rang de la couche est un attribut d'instance)
  const hauteurFibre = 0.032;
  let texGazon = null, imageGazon = null;
  if (planSol) {
    const mg = planSol.material; texGazon = mg.map; imageGazon = texGazon.image; texGazon.anisotropy = 8;
    const lm = lumiereDe(mg, "LM_sols"); const teinte = new THREE.Color(...(mg.userData.couleur || [0.323, 0.323, 0.323]));
    // le gazon du jet 7 était une matière éclairée : sous une lumière rasante, son reflet mat le blanchissait un peu.
    // Sans éclairage au pixel, ce voile est rendu par une part de lumière non teintée.
    const VOILE = "reflectedLight.indirectDiffuse *= diffuseColor.rgb + vec3(" + NIVEAUX.voileGazon.toFixed(3) + ");";
    planSol.material = new THREE.MeshBasicMaterial({ map: texGazon, color: teinte, side: THREE.DoubleSide, ...lm });
    planSol.material.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace("reflectedLight.indirectDiffuse *= diffuseColor.rgb;", VOILE); }; planSol.material.customProgramCacheKey = () => "bola-plateau-gazon-v1";
    const geo = planSol.geometry.clone().applyMatrix4(planSol.matrixWorld);
    const fibres = new THREE.MeshBasicMaterial({ map: texGazon, side: THREE.DoubleSide, ...lm });
    fibres.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nattribute float aCouche; varying float vCouche; varying vec2 vMonde;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvCouche = aCouche; vMonde = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xz;");
      s.fragmentShader = s.fragmentShader.replace("#include <common>", `#include <common>
        varying float vCouche; varying vec2 vMonde;
        float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
        .replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>
        { vec2 p = vMonde * 260.0; vec2 ip = floor(p), fp = fract(p) - 0.5; float hb = 0.55 + 0.45 * hh(ip); vec2 o = vec2(hh(ip + 3.1), hh(ip + 7.7)) - 0.5;
          float rr = length(fp - o * 0.5) / (0.5 * (1.0 - vCouche * 0.85));
          if (vCouche > hb || rr > 1.0) discard; }`).replace("reflectedLight.indirectDiffuse *= diffuseColor.rgb;", VOILE);
    };
    fibres.customProgramCacheKey = () => "bola-plateau-fibres-v1";
    const im = new THREE.InstancedMesh(geo, fibres, Q.couches); const M = new THREE.Matrix4(), rangs = new Float32Array(Q.couches), col = new THREE.Color();
    for (let i = 1; i <= Q.couches; i++) { const u = i / Q.couches; im.setMatrixAt(i - 1, M.makeTranslation(0, u * hauteurFibre, 0)); rangs[i - 1] = u; im.setColorAt(i - 1, col.setScalar(0.42 + 0.42 * u)); }
    geo.setAttribute("aCouche", new THREE.InstancedBufferAttribute(rangs, 1)); im.name = "gazon_fibres"; im.frustumCulled = false; im.renderOrder = -1; scene.add(im);
  }
  // le marquage du rond central : le logo posé sur l'image du gazon (un drawImage, plus de peinture pixel par pixel)
  emplacements.sol = { nom: "sol", ancre: noeuds.emplacement_sol || scene, texture: texGazon,
    poser(src) { if (!texGazon || !imageGazon) return this;
      const [c, g] = toile(imageGazon.width, imageGazon.height); g.drawImage(imageGazon, 0, 0); const m = c.width / DIM.TL;
      if (src) { const w = 4.2 * m, h = w * src.height / src.width; g.globalAlpha = 0.5; g.drawImage(src, c.width / 2 - w / 2, c.height / 2 - h / 2, w, h); g.globalAlpha = 1; }
      texGazon.image = c; texGazon.needsUpdate = true; return this; } };
  // l'ombre des objets posés sur le terrain (cartes) : un plan transparent qui ne reçoit que l'ombre
  if (Q.ombres) { const g = new THREE.PlaneGeometry(DIM.TL, DIM.Tl); g.rotateX(-Math.PI / 2); const o = new THREE.Mesh(g, new THREE.ShadowMaterial({ opacity: 0.42, depthWrite: false }));
    o.position.y = hauteurFibre + 0.004; o.receiveShadow = true; o.name = "ombre_terrain"; scene.add(o); }
  marque("gazon");

  // ---- les places : sièges, foule, flashs. Le GLB porte les 6 820 places (dans l'ordre du jet 7) et la lumière cuite
  // à chacune ; le tirage du jet 7 (même générateur, graine 42) se rejoue dessus : mêmes personnes aux mêmes places.
  let flashsObj = null;
  {
    const r = alea(42); const personnes = [], flashs = [], sieges = []; const v = new THREE.Vector3(), q = new THREE.Quaternion(), M = new THREE.Matrix4(), col = new THREE.Color(), un = new THREE.Vector3(1, 1, 1);
    const ordre = ["places_N", "places_S", "places_E"].map((n) => lotsPlaces.find((o) => o.name === n)).filter(Boolean);
    for (const lot of ordre) {
      const mw = lot.matrixWorld, n = lot.count, im = lot.instanceMatrix.array; let ic = lot.instanceColor ? lot.instanceColor.array : null, pasC = 3;
      const norm = lot.instanceColor && lot.instanceColor.normalized ? 1 / (ic instanceof Uint16Array ? 65535 : 255) : 1;
      // la lumière des places tient en trois octets par place, alignés sur quatre dans le fichier ; la vue du GLB ne
      // déclare ce pas que dans son extension meshopt, que GLTFLoader ne lit pas : on relit donc le tampon au bon pas
      if (ic) { const def = (gltf.parser.json.nodes || []).find((d) => d.name === lot.name), acc = def && gltf.parser.json.accessors[def.extensions?.EXT_mesh_gpu_instancing?.attributes?._COLOR_0];
        const vue = acc && gltf.parser.json.bufferViews[acc.bufferView], pas = vue && (vue.byteStride || vue.extensions?.EXT_meshopt_compression?.byteStride);
        if (pas && pas !== 3 * ic.BYTES_PER_ELEMENT && ic.byteOffset + n * pas <= ic.buffer.byteLength) { pasC = pas / ic.BYTES_PER_ELEMENT; ic = new ic.constructor(ic.buffer, ic.byteOffset, n * pasC); } }
      const ech = (lot.userData.echelle || 1) * NIVEAUX.places; lot.getWorldQuaternion(q); const qt = q.clone();
      for (let i = 0; i < n; i++) {
        const x = im[i * 16 + 12], y = im[i * 16 + 13], z = im[i * 16 + 14] + 0.08; // la place du siège ; le siège lui-même recule de 8 cm
        const lum = ic ? [ic[i * pasC] * norm * ech, ic[i * pasC + 1] * norm * ech, ic[i * pasC + 2] * norm * ech] : [ech, ech, ech];
        sieges.push({ mw, qt, x, y, z: z - 0.08, lum });
        if (r() > Q.foule * 0.8) continue;
        personnes.push({ mw, qt, x: x + (r() - 0.5) * 0.06, y: y - 0.08, z: z + (r() - 0.5) * 0.05, s: 0.92 + r() * 0.16, lum });
        if (r() < 0.05) flashs.push({ mw, x, y: y + 1.0, z: z + 0.1 });
      }
    }
    // les flashs de téléphones dans la foule : des points qui s'allument un court instant, chacun à son heure
    { const n = Math.min(Q.flashs, flashs.length), pos = new Float32Array(n * 3), ph = new Float32Array(n);
      for (let i = 0; i < n; i++) { const p = flashs[(i * 7919) % flashs.length]; v.set(p.x, p.y, p.z).applyMatrix4(p.mw); pos.set([v.x, v.y, v.z], i * 3); ph[i] = r(); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aPhase", new THREE.BufferAttribute(ph, 1));
      const mat = new THREE.ShaderMaterial({ uniforms: { uTemps: temps, uTaille: { value: hauteur / 900 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: `attribute float aPhase; uniform float uTemps; uniform float uTaille; varying float vA;
          void main() { float c = fract(uTemps * (0.05 + aPhase * 0.08) + aPhase * 17.0); vA = smoothstep(0.0, 0.01, c) * (1.0 - smoothstep(0.02, 0.08, c));
            vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = vA > 0.001 ? uTaille * 260.0 / -mv.z : 0.0; gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying float vA; void main() { vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d, d) * 26.0) * vA; gl_FragColor = vec4(vec3(1.0, 0.97, 0.92) * a * 6.0, 1.0); }` });
      flashsObj = new THREE.Points(geo, mat); flashsObj.frustumCulled = false; flashsObj.name = "flashs"; if (n) scene.add(flashsObj); }
    // sièges et spectateurs ne sont plus éclairés au pixel : la lumière cuite de leur place les teinte, et un modelé
    // simple (le dessus et la face tournée vers le terrain plus clairs) leur garde du volume
    const modele = (m, cle, sursaut) => { m.onBeforeCompile = (s) => { s.uniforms.uTemps = temps;
      s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying float vModele;" + (sursaut ? "\nattribute float aPhase; uniform float uTemps;" : ""))
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvModele = 0.62 + 0.4 * normal.y + 0.3 * max(0.0, normal.z);"
          + (sursaut ? "\ntransformed.y += max(0.0, sin(uTemps * (1.1 + fract(aPhase * 7.0)) + aPhase * 6.28)) * 0.035 * smoothstep(0.3, 0.9, position.y);" : ""));
      s.fragmentShader = s.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vModele;").replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= vModele;"); };
      m.customProgramCacheKey = () => cle; return m; };
    if (Q.sieges && gabarits.gab_siege && sieges.length) {
      const g = gabarits.gab_siege, c0 = g.material.color;
      const im = new THREE.InstancedMesh(g.geometry, modele(new THREE.MeshBasicMaterial({ color: 0xffffff }), "bola-plateau-siege-v1", false), sieges.length);
      sieges.forEach((p, i) => { v.set(p.x, p.y, p.z).applyMatrix4(p.mw); M.compose(v, p.qt, un); im.setMatrixAt(i, M); im.setColorAt(i, col.setRGB(c0.r * p.lum[0], c0.g * p.lum[1], c0.b * p.lum[2])); });
      im.name = "sieges"; im.frustumCulled = false; scene.add(im);
    }
    const gab = (Q.fouleFine ? gabarits.gab_spectateur_fin : gabarits.gab_spectateur) || gabarits.gab_spectateur;
    if (gab && personnes.length) {
      const c0 = gab.material.color, geo = gab.geometry.clone(), n = personnes.length, phases = new Float32Array(n), qy = new THREE.Quaternion(), axe = new THREE.Vector3(0, 1, 0), e = new THREE.Vector3();
      const im = new THREE.InstancedMesh(geo, modele(new THREE.MeshBasicMaterial({ color: 0xffffff }), "bola-plateau-foule-v1", true), n);
      personnes.forEach((p, i) => { v.set(p.x, p.y, p.z).applyMatrix4(p.mw); q.copy(p.qt).multiply(qy.setFromAxisAngle(axe, (r() - 0.5) * 0.5));
        M.compose(v, q, e.set(p.s * (0.9 + r() * 0.2), p.s, p.s)); im.setMatrixAt(i, M); phases[i] = r(); const t = r() < 0.25 ? 1.8 + r() * 1.5 : 0.5 + r() * 0.7;
        im.setColorAt(i, col.setRGB(c0.r * p.lum[0] * t, c0.g * p.lum[1] * t, c0.b * p.lum[2] * t)); });
      geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1)); im.name = "foule"; im.frustumCulled = false; scene.add(im);
    }
  }
  await pause();
  marque("places");

  // ---- les faisceaux : les dix grappes fixes et les huit lyres qui balaient la salle (sans vraie lumière)
  const cones = []; // chaque faisceau s'éteint quand la caméra entre dedans (sinon un voile blanc)
  const matCone = (couleur) => new THREE.ShaderMaterial({ vertexShader: V_CONE, fragmentShader: F_CONE, uniforms: { uCouleur: { value: couleur } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
  function lotCones(n, r0, r1, seg, couleur, nom) {
    const geo = new THREE.CylinderGeometry(r0, r1, 1, seg, 1, true); const longs = new Float32Array(n), forces = new Float32Array(n);
    geo.setAttribute("aLong", new THREE.InstancedBufferAttribute(longs, 1)); const aF = new THREE.InstancedBufferAttribute(forces, 1); aF.setUsage(THREE.DynamicDrawUsage); geo.setAttribute("aForce", aF);
    const im = new THREE.InstancedMesh(geo, matCone(couleur), n); im.frustumCulled = false; im.name = nom; return { im, longs, forces, aF };
  }
  const T = new THREE.Matrix4(), S = new THREE.Matrix4(), RX = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  {
    const grappes = Object.keys(noeuds).filter((n) => /^grappe_\d+$/.test(n)).sort((a, b) => +a.slice(7) - +b.slice(7)).map((n) => noeuds[n]);
    if (grappes.length) { const lot = lotCones(grappes.length, 0.55, 3.0, 28, new THREE.Color(1, 0.86, 0.7), "faisceaux"); scene.add(lot.im);
      grappes.forEach((g, i) => { const [r0, r1, L, f] = g.userData.faisceau || [0.55, 3, 18, 0.06];
        const sans = new THREE.Matrix4().copy(g.matrixWorld).multiply(T.makeTranslation(0, 0, L / 2)).multiply(RX); // le repère du cône, sans l'étirement
        lot.im.setMatrixAt(i, new THREE.Matrix4().copy(sans).multiply(S.makeScale(1, L, 1))); lot.longs[i] = L; lot.forces[i] = f;
        cones.push({ lot, i, inv: sans.clone().invert(), h: L, r0, r1, f }); }); }
  }
  let lyresObj = null;
  {
    const tetes = Object.keys(noeuds).filter((n) => /^lyre_\d+$/.test(n)).sort((a, b) => +a.slice(5) - +b.slice(5)).map((n) => noeuds[n]);
    if (tetes.length) {
      const n = tetes.length, lyres = new THREE.Group(); lyres.name = "lyres"; scene.add(lyres); lyresObj = lyres;
      const [r0, r1, L, f] = tetes[0].userData.faisceau || [0.12, 1.5, 24, 0.026];
      const lot = lotCones(n, r0, r1, 20, new THREE.Color(1, 0.9, 0.78), "lyres_faisceaux"); lyres.add(lot.im); lot.im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const corps = gabarits.gab_lyre ? new THREE.InstancedMesh(gabarits.gab_lyre.geometry, gabarits.gab_lyre.material, n) : null;
      const oeil = gabarits.gab_oeil ? new THREE.InstancedMesh(gabarits.gab_oeil.geometry, une("emissif", () => new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color().setScalar(6) })), n) : null;
      for (const o of [corps, oeil]) if (o) { o.frustumCulled = false; o.instanceMatrix.setUsage(THREE.DynamicDrawUsage); lyres.add(o); }
      if (corps) corps.name = "lyres_corps"; if (oeil) oeil.name = "lyres_yeux";
      const etat = tetes.map((t, i) => { const p = new THREE.Vector3().setFromMatrixPosition(t.matrixWorld); lot.longs[i] = L; lot.forces[i] = f;
        const c = { lot, i, inv: new THREE.Matrix4(), h: L, r0, r1, f }; cones.push(c); return { p, ph: t.userData.phase ?? i * 0.7, sz: t.userData.sz ?? (p.z > 0 ? 1 : -1), c }; });
      const eu = new THREE.Euler(), qq = new THREE.Quaternion(), un = new THREE.Vector3(1, 1, 1), Mt = new THREE.Matrix4(), Mc = new THREE.Matrix4();
      majTemps.push((t) => { if (!lyres.visible) return;
        etat.forEach((h, i) => { eu.set(h.sz * (0.55 + 0.35 * Math.sin(t * 0.23 + h.ph)), 0, 0.5 * Math.sin(t * 0.17 + h.ph * 1.7)); Mt.compose(h.p, qq.setFromEuler(eu), un);
          if (corps) corps.setMatrixAt(i, Mt); if (oeil) oeil.setMatrixAt(i, Mt);
          Mc.copy(Mt).multiply(T.makeTranslation(0, -L / 2, 0)); h.c.inv.copy(Mc).invert(); lot.im.setMatrixAt(i, Mc.multiply(S.makeScale(1, L, 1))); });
        lot.im.instanceMatrix.needsUpdate = true; if (corps) corps.instanceMatrix.needsUpdate = true; if (oeil) oeil.instanceMatrix.needsUpdate = true; });
    }
  }
  marque("faisceaux");

  // ---- les trois lumières en temps réel (le décor est cuit : elles servent aux objets posés et à l'éclat des matières brillantes)
  scene.add(new THREE.HemisphereLight(0xffe2c4, 0x1a1612, 1.5));
  for (const sz of [-1, 1]) { const P = PROJECTEURS; const s = new THREE.SpotLight(0xfff1df, P.intensite, P.portee, P.angle, P.penombre, 2); s.position.set(0, DIM.portique - 0.6, sz * 14); s.target.position.set(0, 0, sz * 2.8); scene.add(s, s.target);
    if (Q.ombres) { s.castShadow = true; s.shadow.mapSize.set(Q.tailleOmbre, Q.tailleOmbre); s.shadow.bias = -0.0004; s.shadow.normalBias = 0.03; s.shadow.radius = 6; s.shadow.blurSamples = 12; s.shadow.camera.near = 4; s.shadow.camera.far = 40; } }

  // ---- les points utiles : les nœuds point_* du GLB (les valeurs du jet 7 en repli)
  const C = DIM.cube;
  const points = { rond: new THREE.Vector3(0, 0, 0), butOuest: new THREE.Vector3(-DIM.L / 2, 1, 0), butEst: new THREE.Vector3(DIM.L / 2, 1, 0), tunnel: new THREE.Vector3(DIM.murX + 1.5, 1.6, 0), mur: new THREE.Vector3(DIM.murX + 0.5, 10.6, 0),
    sousCube: new THREE.Vector3(0, C.y - C.h / 2 - 1, 0), cube: new THREE.Vector3(0, C.y, 0), tribuneN: new THREE.Vector3(0, 4, -18), tribuneS: new THREE.Vector3(0, 4, 18), studio: new THREE.Vector3(-20.7, 1.6, -10.2), commentateur: new THREE.Vector3(-7.0, 1.4, 13.4) };
  for (const [n, o] of Object.entries(noeuds)) if (n.startsWith("point_")) points[n.slice(6)] = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

  // ---- la post-production (celle du jet 7)
  const rt = new THREE.WebGLRenderTarget(largeur, hauteur, { type: THREE.HalfFloatType, samples: Q.msaa });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(Q.pr); composer.setSize(largeur, hauteur);
  composer.addPass(new RenderPass(scene, camera));
  const ao = null; // (GTAO essayé le 02/11 : halos sombres sur les filets et les fibres ; coupé depuis)
  const bloom = new UnrealBloomPass(new THREE.Vector2(largeur * Q.bloom, hauteur * Q.bloom), 0.38, 0.5, 1.7); composer.addPass(bloom);
  // les traînées horizontales d'un objectif anamorphique sur les sources très fortes (projecteurs, LED)
  const trainees = new ShaderPass({ uniforms: { tDiffuse: { value: null }, uSeuil: { value: 2.2 }, uForce: { value: 0.09 }, uLong: { value: 0.22 } },
    vertexShader: ETALON.vertexShader,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uSeuil; uniform float uForce; uniform float uLong; varying vec2 vUv;
      void main() { vec3 c = texture2D(tDiffuse, vUv).rgb; vec3 s = vec3(0.0); float tot = 0.0;
        for (int i = -24; i <= 24; i++) { float f = float(i) / 24.0; vec3 e = texture2D(tDiffuse, vUv + vec2(f * uLong, 0.0)).rgb; float w = exp(-abs(f) * 4.0);
          s += max(e - vec3(uSeuil), vec3(0.0)) * w; tot += w; }
        gl_FragColor = vec4(c + s / tot * uForce * 24.0 * vec3(0.85, 0.92, 1.0), 1.0); }` });
  if (Q.trainees) composer.addPass(trainees);
  composer.addPass(new OutputPass());
  // sans MSAA (téléphone), un FXAA après le passage en sRGB, avant le grain
  let fxaa = null; if (Q.fxaa) { fxaa = new FXAAPass(); composer.addPass(fxaa); }
  const etalon = new ShaderPass(ETALON); composer.addPass(etalon);

  // ---- la chauffe, par petites tâches : textures une à une, puis chaque matière dessinée seule dans une petite cible
  // (son programme se lie et ses tampons montent dans sa propre tâche), les reflets, et les passes une à une
  for (const f of majTemps) f(0);
  { const vues = new Set(); const tex = [];
    scene.traverse((o) => { for (const m of [].concat(o.material || [])) { for (const k of ["map", "lightMap", "normalMap", "alphaMap"]) if (m[k] && m[k].isTexture) tex.push(m[k]); if (m.uniforms && m.uniforms.map && m.uniforms.map.value) tex.push(m.uniforms.map.value); } });
    for (const t of tex) { if (vues.has(t) || !t.image) continue; vues.add(t); renderer.initTexture(t); await pause(); } }
  marque("textures");
  camera.position.set(44, 12, 0); camera.lookAt(-27, 7, 0); camera.fov = 110; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const petite = new THREE.WebGLRenderTarget(32, 32, { type: THREE.HalfFloatType });
  const lots = new Map(); scene.traverse((o) => { if ((o.isMesh || o.isPoints) && o.visible) { const m = [].concat(o.material)[0]; if (!lots.has(m)) lots.set(m, []); lots.get(m).push(o); } });
  const ombresVoulues = renderer.shadowMap.needsUpdate;
  async function chaufferScene(filtre) {
    for (const objets of lots.values()) for (const o of objets) o.visible = false;
    for (const [m, objets] of lots) { if (filtre && !filtre(m)) continue; for (const o of objets) o.visible = true;
      try { await renderer.compileAsync(scene, camera); } catch { /* le rendu qui suit compilera */ }
      renderer.setRenderTarget(petite); renderer.render(scene, camera); renderer.setRenderTarget(null);
      for (const o of objets) o.visible = false; await pause(); }
    for (const objets of lots.values()) for (const o of objets) o.visible = true;
  }
  await chaufferScene(null);
  marque("shaders");
  // les reflets : la salle elle-même, captée depuis le dessus du rond central, sert d'environnement
  const pm = new THREE.PMREMGenerator(renderer);
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType }); const cubeCam = new THREE.CubeCamera(0.5, 120, cubeRT); cubeCam.position.set(0, 4, 0); scene.add(cubeCam);
  cubeCam.update(renderer, scene); envCube.value = cubeRT.texture;
  marque("reflets");
  await pause();
  pm.compileCubemapShader(); await pause();
  const envTex = pm.fromCubemap(cubeRT.texture).texture; scene.environment = envTex; scene.environmentIntensity = 0.55;
  marque("environnement");
  await pause();
  // les matières brillantes changent de programme avec l'environnement : on les relie, une par tâche
  await chaufferScene((m) => m.isMeshStandardMaterial);
  marque("brillants");
  // les passes de la post-production, une par tâche (ce que ferait composer.render() d'un bloc)
  camera.fov = 35; camera.updateProjectionMatrix();
  for (const [i, p] of composer.passes.entries()) { if (!p.enabled) continue; p.renderToScreen = composer.isLastEnabledPass(i); p.render(renderer, composer.writeBuffer, composer.readBuffer, 0.016, false); if (p.needsSwap) composer.swapBuffers(); await pause(); }
  renderer.setRenderTarget(null); petite.dispose();
  marque("passes");
  renderer.shadowMap.needsUpdate = ombresVoulues || Q.ombres;
  await pause();

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
    camera.fov = largeur > hauteur ? f * 0.62 : f; camera.updateProjectionMatrix(); // en 16:9, on garde la largeur utile
  }

  const pc = new THREE.Vector3();
  function rendre(t) {
    temps.value = t; etalon.uniforms.uTemps.value = t; for (const f of majTemps) f(t);
    for (const c of cones) { pc.copy(camera.position).applyMatrix4(c.inv); const u = THREE.MathUtils.clamp((c.h / 2 - pc.y) / c.h, 0, 1), rr = c.r0 + (c.r1 - c.r0) * u;
      const dedans = Math.abs(pc.y) < c.h / 2 + 1 ? THREE.MathUtils.smoothstep(Math.hypot(pc.x, pc.z), rr * 0.9, rr * 2.2) : 1; const f = c.f * dedans;
      if (c.lot.forces[c.i] !== f) { c.lot.forces[c.i] = f; c.lot.aF.needsUpdate = true; } }
    composer.render();
  }
  marque("pret");
  return { scene, camera, renderer, composer, emplacements, envCube, ao, trainees, points, plans, cadrer, rendre, majTemps, temps, bloom, etalon, DIM, fxaa,
    lyres: lyresObj, flashs: flashsObj, infos,
    majOmbres() { renderer.shadowMap.needsUpdate = true; },
    majReflets() { cubeCam.update(renderer, scene); }, logos: { bola: logoBola, sfl: sigleSfl, symbole: logoSymbole } };
}
