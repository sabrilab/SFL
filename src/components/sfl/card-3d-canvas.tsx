"use client";

// Rendu Three.js de la carte : trois plans (le papier, le portrait, le
// texte) à des profondeurs différentes, fermés par une tranche arrondie,
// et le dos de la carte — on peut la faire tourner librement (jusqu'à voir
// le dos), l'inertie s'amortit naturellement et la carte se pose d'elle-même
// sur la face la plus proche.
//
// Depuis le 23/10 (Sabri : « un peu plus fine et un peu plus belle, avec
// des bords arrondis », et « que le derrière des cartes suive aussi la même
// couleur que l'avant ») :
//   · plus fine : 0,042 d'épaisseur au lieu de 0,069 (la carte fait ~1,22
//     de haut), les calques resserrés d'autant, la parallaxe gardée ;
//   · la tranche est bombée, éclairée comme un bord arrondi, et ses coins
//     sont ceux de la carte (RAYON_CARTE, finitions-carte.ts) ;
//   · la matière de la carte (data-matiere, que lit card-3d.tsx) donne la
//     couleur et le métal de la tranche, la teinte et la force du reflet
//     irisé, la lueur des bords ; sur la finition animée, la lumière passe
//     d'elle-même, comme sur la carte plate (jamais en mouvement réduit) ;
//   · le dos est la photo de DosCarte (dos-carte.tsx), de la même matière,
//     avec le même reflet : plus de dos noir ni de « sunday five league ».
//
// Le geste est suivi en delta de pointeur au niveau window (pas de raycast
// pendant le drag : un doigt qui sort du mesh ne coupe jamais la rotation).
//
// frameloop="demand" : aucun rendu tant que rien ne bouge (la finition
// animée ne réveille le rendu que le temps de chaque passage de lumière).

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { MATIERES, RAYON_CARTE, type NomMatiere } from "@/components/sfl/finitions-carte";

const MAX_TILT_X = 0.3; // rad, bascule verticale (clampée, revient à plat)
const ROT_PER_PX = 0.011; // rad de rotation Y par pixel glissé (libre, 360°)
const DRAG_RANGE_PX = 150;
const LERP_DRAG = 0.3; // suivi du doigt (réactif)
const LERP_SETTLE = 0.09; // pose finale + intro (doux)
const INERTIA_DAMPING = 0.93; // amortissement de la vitesse après relâche
const SNAP_VELOCITY = 0.6; // rad/s — sous ce seuil, on se pose sur une face

// Les profondeurs (unités monde ; la carte fait ~1,22 de haut) : le dos,
// le papier à 0, le portrait, puis le texte, au ras de la tranche.
const DOS_Z = -0.006;
const PLAYER_Z = 0.02;
const STATS_Z = 0.036;
// La tranche déborde à peine du contour à mi-épaisseur…
const BOMBE = 0.005;
// …mais sa lumière tourne comme sur un bord bien rond (jusqu'à ~55°).
const ARRONDI = 1.4;

// Marge autour de la carte dans le cadre (moins la carte remplit le
// frustum, plus elle a de la place pour tourner sans que les bords ou
// les coins arrondis ne sortent du canvas).
const FILL_RATIO = 0.72;

// Sans matière connue (le préchauffage de l'écran de chargement) : l'argent
// de l'ancienne carte.
const BEZEL_COLOR: Record<"simple" | "rare", string> = {
  simple: "#C9CAC5",
  rare: "#A7A8A3",
};

// La lumière qui passe sur la finition animée : le rythme de .carte-lumiere
// (globals.css), 5,2 s dont 58 % de repos.
const PASSAGE = { periode: 5.2, repos: 0.58 };

// Le symbole Bola (public/bola/symbole-blanc.svg), pour le dos de repli.
const SYMBOLE_BOLA =
  "M451.133,255.531c0-108.009-87.559-195.567-195.567-195.567S60,147.522,60,255.531s87.558,195.566,195.566,195.566c8.771,0,17.407-.577,25.872-1.696-57.091-9.652-100.572-59.334-100.572-119.17,0-66.753,54.113-120.867,120.866-120.867s120.867,54.114,120.867,120.867c0,12.206-1.81,23.99-5.175,35.098,21.275-31.301,33.707-69.097,33.707-109.797Z";

/** Le contour de la carte : un rectangle aux coins en arcs de cercle, comme le border-radius de la carte plate. */
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x + w, y + h - r);
  shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  shape.lineTo(x + r, y + h);
  shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + r);
  shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/**
 * La tranche : un anneau qui suit le contour de la carte du dos (z0) à la
 * face (z1), bombé vers l'extérieur en demi-sinus, sans fond ni couvercle
 * (les calques image restent visibles). Ses normales penchent vers l'arrière
 * au dos et vers l'avant à la face : la lumière y tourne comme sur un bord
 * arrondi. Lissées d'un point à l'autre, coins compris.
 */
function trancheGeometry(shape: THREE.Shape, z0: number, z1: number): THREE.BufferGeometry {
  // Le contour, sans les points doublés aux jonctions des droites et des arcs.
  const pts: THREE.Vector2[] = [];
  for (const p of shape.getPoints(12)) {
    const prec = pts[pts.length - 1];
    if (!prec || prec.distanceTo(p) > 1e-6) pts.push(p);
  }
  if (pts.length > 1 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-6) pts.pop();

  const n = pts.length;
  const anneaux = 8;
  const positions = new Float32Array(n * (anneaux + 1) * 3);
  const normals = new Float32Array(n * (anneaux + 1) * 3);
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // Contour tracé dans le sens direct : la normale sortante est (dy, −dx).
    const nx = (b.y - a.y) / l;
    const ny = -(b.x - a.x) / l;
    for (let k = 0; k <= anneaux; k++) {
      const t = k / anneaux;
      const s = BOMBE * Math.sin(Math.PI * t);
      const nz = -ARRONDI * Math.cos(Math.PI * t);
      const ln = Math.hypot(1, nz);
      const j = (i * (anneaux + 1) + k) * 3;
      positions[j] = pts[i].x + nx * s;
      positions[j + 1] = pts[i].y + ny * s;
      positions[j + 2] = z0 + (z1 - z0) * t;
      normals[j] = nx / ln;
      normals[j + 1] = ny / ln;
      normals[j + 2] = nz / ln;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    for (let k = 0; k < anneaux; k++) {
      const a = i * (anneaux + 1) + k;
      const b = i2 * (anneaux + 1) + k;
      index.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setIndex(index);
  return geo;
}

/**
 * Le dos de repli, le temps que la photo du vrai dos arrive (ou sans
 * carte, au préchauffage) : la couleur de la tranche, le symbole Bola.
 */
function makeBackTexture(fond: string, encre: string): THREE.CanvasTexture {
  const w = 256;
  const h = 413;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, w, h);
  const taille = w * 0.3;
  ctx.save();
  ctx.translate((w - taille) / 2, h * 0.445 - taille / 2);
  ctx.scale(taille / 391.133, taille / 391.133);
  ctx.translate(-60, -59.964);
  ctx.fillStyle = encre;
  ctx.fill(new Path2D(SYMBOLE_BOLA), "evenodd");
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const HOLO_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Masque rectangle-arrondi partagé : coupe les coins des plans texturés
// pour qu'aucune face ne dépasse en rectangle du bloc arrondi.
const ROUNDED_MASK_GLSL = /* glsl */ `
  uniform float uAspect;
  uniform float uRadius;
  float roundedMask(vec2 uv) {
    vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);
    vec2 half_ = vec2(uAspect * 0.5, 0.5) - uRadius;
    vec2 q = abs(p) - half_;
    return length(max(q, 0.0)) - uRadius;
  }
`;

// Le reflet irisé : une bande d'arc-en-ciel qui glisse quand on penche la
// carte, ramenée vers la teinte de la matière (l'or, le rouge, le cobalt…),
// et, sur la finition animée, la lumière qui passe d'elle-même.
const HOLO_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uTiltX;
  uniform float uTiltY;
  uniform float uStrength;
  uniform vec3 uTeinte;
  uniform float uIrise;
  uniform float uPassage;
  ${ROUNDED_MASK_GLSL}

  void main() {
    if (roundedMask(vUv) > 0.0) discard;
    float diag = vUv.x * 0.7 + vUv.y * 0.3;
    float shift = uTiltX * 0.6 - uTiltY * 0.6;
    float band = fract((diag + shift) * 2.4);
    vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (vec3(band) + vec3(0.0, 0.33, 0.67)));
    vec3 couleur = mix(uTeinte * (0.7 + 0.6 * rainbow.g), rainbow, uIrise);
    float edge = clamp(abs(uTiltX) / 0.52 + abs(uTiltY) / 0.3, 0.0, 1.0);
    float alpha = (0.05 + edge * 0.22) * uStrength;
    // La lumière qui passe : une bande en biais (105°, comme la carte plate).
    float d = (vUv.x - uPassage) + (vUv.y - 0.5) * 0.27;
    float lumiere = exp(-d * d * 260.0) * 0.5;
    gl_FragColor = vec4(couleur * alpha + mix(vec3(1.0), rainbow, 0.35) * lumiere, 1.0);
  }
`;

// Matériau "surface" — texture captée + réponse à la lumière (bump grain,
// spéculaire, lueur des bords à la teinte de la matière) + masque de coins
// arrondis.
const SURFACE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SURFACE_FRAGMENT = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uLueur;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  ${ROUNDED_MASK_GLSL}

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    if (roundedMask(vUv) > 0.0) discard;
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.01) discard;

    float e = 0.004;
    float n0 = vnoise(vUv * 900.0);
    float n1 = vnoise((vUv + vec2(e, 0.0)) * 900.0);
    float n2 = vnoise((vUv + vec2(0.0, e)) * 900.0);
    vec3 bump = normalize(vec3((n0 - n1) * 5.0, (n0 - n2) * 5.0, 1.0));

    vec3 N = normalize(vNormal + bump * 0.045);
    vec3 V = normalize(vViewPosition);
    vec3 L = normalize(vec3(2.0, 3.0, 4.0));
    vec3 H = normalize(L + V);

    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 60.0);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.5);

    vec3 color = tex.rgb * (0.82 + 0.2 * diff)
      + vec3(1.0) * spec * 0.1
      + uLueur * fresnel * 0.16;

    gl_FragColor = vec4(color, tex.a);
    #include <colorspace_fragment>
  }
`;

// La tranche : la couleur de la matière, mate ou métal. Sans carte
// d'environnement, le métal reflète un studio de photo (clair en haut, sombre
// en bas, une rampe de lumière) : l'or et le chrome brillent au lieu de virer
// au noir.
const TRANCHE_FRAGMENT = /* glsl */ `
  uniform vec3 uCouleur;
  uniform float uMetal;
  uniform float uRugosite;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vViewPosition);
    vec3 L = normalize(vec3(2.0, 3.0, 4.0));
    vec3 H = normalize(L + V);
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), mix(90.0, 8.0, uRugosite));
    vec3 R = reflect(-V, N);
    float ciel = smoothstep(-0.7, 0.8, R.y);
    float rampe = exp(-pow((R.y - 0.3) * 5.0, 2.0));
    vec3 studio = mix(vec3(0.16), vec3(1.0), ciel) + vec3(rampe * 0.55);
    vec3 mat = uCouleur * (0.62 + 0.45 * diff) + vec3(spec * (1.0 - uRugosite) * 0.3);
    vec3 metal = uCouleur * studio * 1.15 + vec3(spec * 0.5);
    vec3 c = mix(mat, metal, uMetal);
    c += vec3(pow(1.0 - abs(dot(N, V)), 3.0) * 0.1);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

function useLayerTexture(url: string | null) {
  const { invalidate } = useThree();
  return useMemo(() => {
    if (!url) return null;
    const tex = new THREE.TextureLoader().load(url, () => invalidate());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [url, invalidate]);
}

/** Ce que la matière de la carte change en 3D ; sans matière, l'allure d'avant. */
function allureDe(matiere: NomMatiere | null | undefined, mode: "simple" | "rare", holo: boolean) {
  const m = matiere ? MATIERES[matiere] : null;
  return {
    tranche: m?.tranche ?? { couleur: BEZEL_COLOR[mode], metal: 0.35, rugosite: 0.45 },
    holo: m ? m.holo.force : holo ? 1 : 0.3,
    teinte: m?.holo.teinte ?? null,
    anime: !!m?.anime,
    particules: m?.vive ?? (holo ? "#F4F5F2" : "#D9DAD5"),
    dos: m ? { fond: m.tranche.couleur, encre: `rgba(${m.encre},0.9)` } : { fond: "#16181c", encre: "rgba(247,246,244,0.9)" },
  };
}

const PARTICLE_COUNT = 20;
const BURST_DURATION = 0.7;

function CardMesh({
  background,
  playerLayer,
  stats,
  dos,
  matiere,
  mode,
  holo,
  startFace = "front",
  interactive = true,
  posee = false,
  onAffichee,
}: {
  background: string;
  playerLayer: string;
  stats: string;
  dos?: string;
  matiere?: NomMatiere | null;
  mode: "simple" | "rare";
  holo: boolean;
  /** "back" démarre déjà retournée (le dos Bola) — pour les visuels de pack scellé. */
  startFace?: "front" | "back";
  /** false = décorative, ne répond pas au glissement (fans de pack). */
  interactive?: boolean;
  /** true = déjà posée de face, sans l'arrivée en tournant (elle prend la place de la carte plate). */
  posee?: boolean;
  /** Appelé dès la première image avec les trois calques chargés. */
  onAffichee?: () => void;
}) {
  const { camera, invalidate } = useThree();
  const allure = useMemo(() => allureDe(matiere, mode, holo), [matiere, mode, holo]);
  const bgTex = useLayerTexture(background);
  const playerTex = useLayerTexture(playerLayer);
  const statsTex = useLayerTexture(stats);
  const dosTex = useLayerTexture(dos ?? null);
  const dosRepli = useMemo(() => makeBackTexture(allure.dos.fond, allure.dos.encre), [allure]);
  const affichee = useRef(false);

  const persp = camera as THREE.PerspectiveCamera;
  const distance = persp.position.z;
  const vFOV = THREE.MathUtils.degToRad(persp.fov);
  const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
  const height = visibleHeight * FILL_RATIO;
  const width = height * persp.aspect;

  const groupRef = useRef<THREE.Group>(null);
  const holoMesh = useRef<THREE.Mesh>(null);
  const dosMesh = useRef<THREE.Mesh>(null);
  // Machine à états du mouvement : intro (arrivée lente) → idle ;
  // drag (suivi du doigt) → inertia (élan amorti puis pose sur une face).
  const etat = useRef<"intro" | "idle" | "drag" | "inertia">("intro");
  const face = startFace === "back" ? Math.PI : 0;
  const current = useRef(posee ? { x: 0, y: face, scale: 1 } : { x: 0.2, y: -2.6, scale: 0.7 });
  const target = useRef({ x: 0, y: face, scale: 1 });
  const velY = useRef(0);
  const drag = useRef({ startX: 0, startY: 0, baseRotY: 0 });
  /** Le prochain passage de lumière (finition animée), programmé pendant le repos. */
  const reveil = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduit = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const particlesGeo = useRef<THREE.BufferGeometry>(null);
  const particlesMat = useRef<THREE.PointsMaterial>(null);
  const burst = useRef({
    active: false,
    t: 0,
    origins: new Float32Array(PARTICLE_COUNT * 3),
    velocities: new Float32Array(PARTICLE_COUNT * 3),
  });
  const particlePositions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  // Les coins de la carte, en unités monde : ceux de la carte plate.
  const wallRadius = (width * RAYON_CARTE) / 1024;
  const wallGeo = useMemo(
    () => trancheGeometry(roundedRectShape(width, height, wallRadius), DOS_Z, STATS_Z),
    [width, height, wallRadius]
  );

  // Les matériaux, refaits seulement quand la carte change de taille ou de
  // matière. Leurs uniforms sont à eux : on ne change ensuite que des valeurs
  // (three ne relit pas un objet uniforms remplacé).
  const materiaux = useMemo(() => {
    const masque = () => ({ uAspect: { value: width / height }, uRadius: { value: wallRadius / height } });
    const lueur = new THREE.Vector3(...(allure.teinte ?? [1, 0.96, 0.9]));
    const surface = (map: THREE.Texture | null, transparent: boolean) =>
      new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: SURFACE_FRAGMENT,
        uniforms: { map: { value: map }, uLueur: { value: lueur }, ...masque() },
        transparent,
        depthWrite: !transparent,
      });
    return {
      papier: surface(bgTex, false),
      portrait: surface(playerTex, true),
      texte: surface(statsTex, true),
      // Le dos de repli d'abord ; la photo du vrai dos le remplace dès qu'elle est décodée (useFrame).
      dos: surface(dosRepli, false),
      tranche: new THREE.ShaderMaterial({
        vertexShader: SURFACE_VERTEX,
        fragmentShader: TRANCHE_FRAGMENT,
        uniforms: {
          uCouleur: { value: new THREE.Color(allure.tranche.couleur) },
          uMetal: { value: allure.tranche.metal },
          uRugosite: { value: allure.tranche.rugosite },
        },
        side: THREE.DoubleSide,
      }),
      // Un seul reflet pour la face et le dos : la même matière des deux côtés.
      holo: new THREE.ShaderMaterial({
        vertexShader: HOLO_VERTEX,
        fragmentShader: HOLO_FRAGMENT,
        uniforms: {
          uTiltX: { value: 0 },
          uTiltY: { value: 0 },
          uStrength: { value: allure.holo },
          uTeinte: { value: new THREE.Vector3(...(allure.teinte ?? [1, 1, 1])) },
          uIrise: { value: allure.teinte ? 0.3 : 1 },
          uPassage: { value: -9 },
          ...masque(),
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    };
  }, [width, height, wallRadius, allure, bgTex, playerTex, statsTex, dosRepli]);
  useEffect(() => () => Object.values(materiaux).forEach((m) => m.dispose()), [materiaux]);
  useEffect(() => () => wallGeo.dispose(), [wallGeo]);
  useEffect(() => () => dosRepli.dispose(), [dosRepli]);

  useEffect(() => {
    invalidate();
  }, [invalidate]);

  useEffect(
    () => () => {
      if (reveil.current) clearTimeout(reveil.current);
    },
    []
  );

  useFrame((state, delta) => {
    // TextureLoader ne pose `image` qu'une fois le calque chargé.
    if (!affichee.current && bgTex?.image && playerTex?.image && statsTex?.image) {
      // Cette image-ci est la première complète : on le dit une fois dessinée.
      affichee.current = true;
      requestAnimationFrame(() => onAffichee?.());
    }
    const c = current.current;
    const t = target.current;
    const m = etat.current;
    const dt = Math.min(delta, 0.05);

    if (m === "drag") {
      c.x += (t.x - c.x) * LERP_DRAG;
      const prevY = c.y;
      c.y += (t.y - c.y) * LERP_DRAG;
      velY.current = (c.y - prevY) / Math.max(dt, 1e-4);
      c.scale += (t.scale - c.scale) * LERP_DRAG;
    } else if (m === "inertia") {
      c.y += velY.current * dt;
      velY.current *= Math.pow(INERTIA_DAMPING, dt * 60);
      c.x += (0 - c.x) * LERP_SETTLE;
      c.scale += (1 - c.scale) * LERP_SETTLE;
      if (Math.abs(velY.current) < SNAP_VELOCITY) {
        // Élan épuisé : on vise la face la plus proche (avant ou dos).
        target.current = { x: 0, y: Math.round(c.y / Math.PI) * Math.PI, scale: 1 };
        etat.current = "idle";
      }
    } else {
      // intro + idle : pose douce vers la cible
      const lerp = LERP_SETTLE;
      c.x += (t.x - c.x) * lerp;
      c.y += (t.y - c.y) * lerp;
      c.scale += (t.scale - c.scale) * lerp;
      if (m === "intro" && Math.abs(t.y - c.y) < 0.002 && Math.abs(t.x - c.x) < 0.002) {
        etat.current = "idle";
      }
    }

    if (groupRef.current) {
      groupRef.current.rotation.y = c.y;
      groupRef.current.rotation.x = c.x;
      groupRef.current.scale.setScalar(c.scale);
    }
    // Le reflet suit l'angle par rapport à la face la plus proche, avant ou dos
    // (un seul matériau pour les deux, lu par le plan de la face).
    const holo = (holoMesh.current?.material as THREE.ShaderMaterial | undefined)?.uniforms;
    if (holo) {
      holo.uTiltX.value = c.y - Math.round(c.y / Math.PI) * Math.PI;
      holo.uTiltY.value = c.x;
    }
    // Le vrai dos, dès que sa photo est décodée (le chargeur relance le rendu).
    const dosMat = dosMesh.current?.material as THREE.ShaderMaterial | undefined;
    if (dosMat && dosTex?.image && dosMat.uniforms.map.value !== dosTex) dosMat.uniforms.map.value = dosTex;

    // La lumière qui passe (finition animée) : seulement pendant le passage ;
    // au repos, un réveil programmé relance le rendu pour le suivant.
    let passe = false;
    if (holo && allure.anime && !reduit) {
      const phase = (state.clock.elapsedTime % PASSAGE.periode) / PASSAGE.periode;
      if (phase >= PASSAGE.repos) {
        const k = (phase - PASSAGE.repos) / (1 - PASSAGE.repos);
        const doux = k * k * (3 - 2 * k);
        holo.uPassage.value = -0.35 + doux * 1.7;
        passe = true;
      } else {
        holo.uPassage.value = -9;
        if (!reveil.current) {
          reveil.current = setTimeout(() => {
            reveil.current = null;
            invalidate();
          }, (PASSAGE.repos - phase) * PASSAGE.periode * 1000 + 16);
        }
      }
    }

    const settled =
      etat.current !== "inertia" &&
      etat.current !== "drag" &&
      Math.abs(t.y - c.y) < 0.0006 &&
      Math.abs(t.x - c.x) < 0.0006 &&
      Math.abs(t.scale - c.scale) < 0.0006;

    const b = burst.current;
    if (b.active) {
      b.t += delta;
      const pos = particlesGeo.current?.attributes.position as THREE.BufferAttribute | undefined;
      if (pos) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          pos.array[i * 3 + 0] = b.origins[i * 3 + 0] + b.velocities[i * 3 + 0] * b.t;
          pos.array[i * 3 + 1] = b.origins[i * 3 + 1] + b.velocities[i * 3 + 1] * b.t - 0.4 * b.t * b.t;
          pos.array[i * 3 + 2] = b.origins[i * 3 + 2];
        }
        pos.needsUpdate = true;
      }
      if (particlesMat.current) {
        particlesMat.current.opacity = Math.max(0, 1 - b.t / BURST_DURATION);
      }
      if (b.t >= BURST_DURATION) b.active = false;
    }

    if (!settled || b.active || passe) invalidate();
  });

  // Suivi du glissement au niveau window : robuste même si le pointeur
  // sort des limites du plan pendant le geste (cas fréquent au doigt).
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (etat.current !== "drag") return;
      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;
      // Rotation libre autour de Y (on peut retourner la carte)…
      target.current.y = drag.current.baseRotY + dx * ROT_PER_PX;
      // …bascule verticale clampée, sens naturel (glisser bas = pencher vers soi).
      target.current.x = THREE.MathUtils.clamp(
        (dy / DRAG_RANGE_PX) * MAX_TILT_X,
        -MAX_TILT_X,
        MAX_TILT_X
      );
      invalidate();
    }
    function onUp() {
      if (etat.current !== "drag") return;
      etat.current = "inertia";
      target.current.scale = 1;
      invalidate();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [invalidate]);

  const spawnBurst = useCallback(() => {
    const b = burst.current;
    b.active = true;
    b.t = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.35 + Math.random() * 0.55;
      b.origins[i * 3 + 0] = (Math.random() - 0.5) * width * 0.4;
      b.origins[i * 3 + 1] = (Math.random() - 0.5) * height * 0.4;
      b.origins[i * 3 + 2] = STATS_Z + 0.03;
      b.velocities[i * 3 + 0] = Math.cos(angle) * speed;
      b.velocities[i * 3 + 1] = Math.sin(angle) * speed + 0.25;
      b.velocities[i * 3 + 2] = 0;
    }
  }, [width, height]);

  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      etat.current = "drag";
      drag.current.startX = e.nativeEvent.clientX;
      drag.current.startY = e.nativeEvent.clientY;
      drag.current.baseRotY = current.current.y;
      target.current.y = current.current.y;
      target.current.scale = 1.045;
      velY.current = 0;
      spawnBurst();
      invalidate();
    },
    [invalidate, spawnBurst]
  );

  return (
    <group ref={groupRef} onPointerDown={interactive ? onDown : undefined}>
      {/* La tranche, bombée, de la couleur de la carte */}
      <mesh geometry={wallGeo} material={materiaux.tranche} />

      {/* Le dos : Bola, de la même matière que la face, visible en la retournant */}
      <mesh ref={dosMesh} position={[0, 0, DOS_Z]} rotation={[0, Math.PI, 0]} material={materiaux.dos}>
        <planeGeometry args={[width, height, 24, 32]} />
      </mesh>
      <mesh position={[0, 0, DOS_Z - 0.004]} rotation={[0, Math.PI, 0]} material={materiaux.holo}>
        <planeGeometry args={[width, height]} />
      </mesh>

      <mesh position={[0, 0, 0]} material={materiaux.papier}>
        <planeGeometry args={[width, height, 24, 32]} />
      </mesh>
      <mesh position={[0, 0, PLAYER_Z]} material={materiaux.portrait}>
        <planeGeometry args={[width, height, 24, 32]} />
      </mesh>
      <mesh position={[0, 0, STATS_Z]} material={materiaux.texte}>
        <planeGeometry args={[width, height, 24, 32]} />
      </mesh>
      <mesh ref={holoMesh} position={[0, 0, STATS_Z + 0.004]} material={materiaux.holo}>
        <planeGeometry args={[width, height]} />
      </mesh>

      {/* Particules — petit éclat au début de la manipulation, dans la couleur de la carte */}
      <points>
        <bufferGeometry ref={particlesGeo}>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={particlesMat}
          color={allure.particules}
          size={0.045}
          sizeAttenuation
          transparent
          opacity={0}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

// Force la compilation des programmes shader (surface, tranche, reflet) dès
// le montage, sans attendre un vrai draw call — utilisé par l'écran de
// chargement pour préchauffer le rendu WebGL avant la première carte
// visible, afin qu'elle apparaisse sans à-coup.
function ShaderWarmup({ onReady }: { onReady: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    gl.compile(scene, camera);
    onReady();
  }, [gl, scene, camera, onReady]);
  return null;
}

export function CardCanvas({
  background,
  playerLayer,
  stats,
  dos,
  matiere,
  holo,
  mode,
  startFace = "front",
  interactive = true,
  posee,
  onAffichee,
  onReady,
}: {
  background: string;
  playerLayer: string;
  stats: string;
  /** Le dos (dos-carte.tsx photographié) ; à défaut, un dos uni de la couleur de la carte. */
  dos?: string;
  /** La matière de la carte (finitions-carte.ts) : la tranche, le reflet, la lueur. */
  matiere?: NomMatiere | null;
  holo: boolean;
  mode: "simple" | "rare";
  startFace?: "front" | "back";
  interactive?: boolean;
  /** Appelé une fois les shaders compilés (préchauffe WebGL, voir AppSplash). */
  onReady?: () => void;
  posee?: boolean;
  onAffichee?: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ position: [0, 0, 3.4], fov: 28 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%", touchAction: interactive ? "none" : "auto" }}
    >
      <CardMesh
        background={background}
        playerLayer={playerLayer}
        stats={stats}
        dos={dos}
        matiere={matiere}
        mode={mode}
        holo={holo}
        startFace={startFace}
        interactive={interactive}
        posee={posee}
        onAffichee={onAffichee}
      />
      {onReady && <ShaderWarmup onReady={onReady} />}
    </Canvas>
  );
}
