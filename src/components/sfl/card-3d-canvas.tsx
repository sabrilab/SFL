"use client";

// Rendu Three.js de la carte en trois plans profonds (fond doré, joueur,
// stats) — on incline l'ensemble au doigt/à la souris, la parallaxe entre
// les plans crée l'effet d'extrusion façon carte à collectionner.
//
// Le tilt suit le pointeur en delta (pixels glissés depuis l'appui), suivi
// au niveau window plutôt que par raycast sur le mesh : un raycast qui rate
// le plan (doigt sorti des bords pendant le geste) coupait le tilt net et
// donnait cette sensation buguée sur mobile. Le suivi par delta ne dépend
// plus jamais d'un hit.
//
// frameloop="demand" : aucun rendu tant que rien ne bouge.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

const MAX_TILT_Y = 0.52; // rad, rotation autour de l'axe Y (glissement horizontal)
const MAX_TILT_X = 0.34; // rad, rotation autour de l'axe X (glissement vertical)
const LERP = 0.16;
const DRAG_RANGE_PX = 130; // glissement (px) pour atteindre le tilt maximum

// Profondeur d'extrusion entre les trois calques (en unités monde, la
// carte fait ~1.5 unité de haut) — resserrée pour une carte fine, tout en
// gardant une vraie parallaxe visible au tilt.
const PLAYER_Z = 0.035;
const STATS_Z = 0.065;

// Marge autour de la carte dans le cadre (moins la carte remplit le
// frustum, plus elle a de la place pour tourner sans que les bords ou
// les coins arrondis ne sortent du canvas).
const FILL_RATIO = 0.72;

const BEZEL_COLOR: Record<"simple" | "rare", string> = {
  simple: "#B99D66",
  rare: "#9C6F22",
};

// Forme rectangle arrondi réutilisée pour la tranche (le bezel) — seule
// géométrie non texturée, donc aucun risque d'UV : on peut l'arrondir
// sans toucher à l'alignement des calques image.
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.closePath();
  return shape;
}

// Anneau latéral (tranche) construit à la main plutôt que via
// ExtrudeGeometry : uniquement les faces de côté, aucune face avant/
// arrière — pas d'ambiguïté de materialIndex, jamais de cap opaque qui
// vienne couvrir les calques image devant ou derrière.
function roundedWallGeometry(shape: THREE.Shape, depth: number, segments: number): THREE.BufferGeometry {
  const points = shape.getPoints(segments);
  const n = points.length;
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (let i = 0; i < n; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % n];
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len;
    const ny = -dx / len;

    positions.push(p0.x, p0.y, 0, p1.x, p1.y, 0, p1.x, p1.y, depth);
    positions.push(p0.x, p0.y, 0, p1.x, p1.y, depth, p0.x, p0.y, depth);
    for (let k = 0; k < 6; k++) normals.push(nx, ny, 0);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

const HOLO_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HOLO_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uTiltX;
  uniform float uTiltY;
  uniform float uStrength;

  void main() {
    float diag = vUv.x * 0.7 + vUv.y * 0.3;
    float shift = uTiltX * 0.6 - uTiltY * 0.6;
    float band = fract((diag + shift) * 2.4);
    vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (vec3(band) + vec3(0.0, 0.33, 0.67)));
    float edge = clamp(abs(uTiltX) / 0.52 + abs(uTiltY) / 0.34, 0.0, 1.0);
    float alpha = (0.05 + edge * 0.22) * uStrength;
    gl_FragColor = vec4(rainbow, alpha);
  }
`;

// Matériau "surface" — reprend la texture captée (déjà grainée en 2D) et
// lui ajoute une vraie réponse à la lumière : un bump procédural (grain
// qui accroche des micro-reflets), un spéculaire, et un liseré fresnel
// chaud sur les tranches inclinées. Le tout donne l'impression d'une
// carte physique plutôt que d'une image plaquée sur un plan.
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
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vViewPosition;

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
      + vec3(1.0, 0.9, 0.68) * fresnel * 0.16;

    gl_FragColor = vec4(color, tex.a);
  }
`;

function useLayerTexture(url: string) {
  const { invalidate } = useThree();
  return useMemo(() => {
    const tex = new THREE.TextureLoader().load(url, () => invalidate());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [url, invalidate]);
}

const PARTICLE_COUNT = 20;
const BURST_DURATION = 0.7;

function CardMesh({
  background,
  playerLayer,
  stats,
  holo,
  bezel,
}: {
  background: string;
  playerLayer: string;
  stats: string;
  holo: boolean;
  bezel: string;
}) {
  const { camera, invalidate } = useThree();
  const bgTex = useLayerTexture(background);
  const playerTex = useLayerTexture(playerLayer);
  const statsTex = useLayerTexture(stats);

  const persp = camera as THREE.PerspectiveCamera;
  const distance = persp.position.z;
  const vFOV = THREE.MathUtils.degToRad(persp.fov);
  const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
  const height = visibleHeight * FILL_RATIO;
  const width = height * persp.aspect;

  const groupRef = useRef<THREE.Group>(null);
  const holoMat = useRef<THREE.ShaderMaterial>(null);
  const target = useRef({ x: 0, y: 0, scale: 1 });
  // Départ dramatique — la carte arrive tournée et réduite, puis se pose
  // à plat avec l'amorti existant : effet d'intro "convoquée à l'écran".
  const current = useRef({ x: -1.35, y: 0.22, scale: 0.72 });
  const drag = useRef({ active: false, startX: 0, startY: 0 });
  const introDone = useRef(false);

  const particlesGeo = useRef<THREE.BufferGeometry>(null);
  const particlesMat = useRef<THREE.PointsMaterial>(null);
  const burst = useRef({
    active: false,
    t: 0,
    origins: new Float32Array(PARTICLE_COUNT * 3),
    velocities: new Float32Array(PARTICLE_COUNT * 3),
  });
  const particlePositions = useMemo(() => new Float32Array(PARTICLE_COUNT * 3), []);

  useEffect(() => {
    if (!introDone.current) {
      introDone.current = true;
      invalidate();
    }
  }, [invalidate]);

  useFrame((_, delta) => {
    const c = current.current;
    const t = target.current;
    c.x += (t.x - c.x) * LERP;
    c.y += (t.y - c.y) * LERP;
    c.scale += (t.scale - c.scale) * LERP;

    if (groupRef.current) {
      groupRef.current.rotation.y = c.x;
      groupRef.current.rotation.x = c.y;
      groupRef.current.scale.setScalar(c.scale);
    }
    if (holoMat.current) {
      holoMat.current.uniforms.uTiltX.value = c.x;
      holoMat.current.uniforms.uTiltY.value = c.y;
    }

    const settled =
      Math.abs(t.x - c.x) < 0.0006 &&
      Math.abs(t.y - c.y) < 0.0006 &&
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

    if (!settled || b.active) invalidate();
  });

  // Suivi du glissement au niveau window : robuste même si le pointeur
  // sort des limites du plan pendant le geste (cas fréquent au doigt).
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;
      target.current.x = THREE.MathUtils.clamp((dx / DRAG_RANGE_PX) * MAX_TILT_Y, -MAX_TILT_Y, MAX_TILT_Y);
      // Inversé : glisser vers le bas incline le haut de la carte vers soi,
      // comme quand on bascule une vraie carte tenue en main.
      target.current.y = THREE.MathUtils.clamp((dy / DRAG_RANGE_PX) * MAX_TILT_X, -MAX_TILT_X, MAX_TILT_X);
      invalidate();
    }
    function onUp() {
      if (!drag.current.active) return;
      drag.current.active = false;
      target.current.x = 0;
      target.current.y = 0;
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
      drag.current.active = true;
      drag.current.startX = e.nativeEvent.clientX;
      drag.current.startY = e.nativeEvent.clientY;
      target.current.scale = 1.045;
      spawnBurst();
      invalidate();
    },
    [invalidate, spawnBurst]
  );

  // Tranche (bezel) arrondie — une seule extrusion en anneau plutôt que
  // quatre murs droits à coins carrés, pour matcher les coins arrondis
  // du visuel de la carte.
  const wallRadius = Math.min(width, height) * 0.07;
  const wallShape = useMemo(() => roundedRectShape(width, height, wallRadius), [width, height, wallRadius]);
  const wallGeo = useMemo(() => roundedWallGeometry(wallShape, STATS_Z, 10), [wallShape]);

  const bgUniforms = useMemo(() => ({ map: { value: bgTex } }), [bgTex]);
  const playerUniforms = useMemo(() => ({ map: { value: playerTex } }), [playerTex]);
  const statsUniforms = useMemo(() => ({ map: { value: statsTex } }), [statsTex]);

  return (
    <group ref={groupRef} onPointerDown={onDown}>
      <mesh geometry={wallGeo}>
        <meshStandardMaterial color={bezel} roughness={0.45} metalness={0.35} side={THREE.DoubleSide} />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, height, 24, 32]} />
        <shaderMaterial vertexShader={SURFACE_VERTEX} fragmentShader={SURFACE_FRAGMENT} uniforms={bgUniforms} />
      </mesh>
      <mesh position={[0, 0, PLAYER_Z]}>
        <planeGeometry args={[width, height, 24, 32]} />
        <shaderMaterial
          vertexShader={SURFACE_VERTEX}
          fragmentShader={SURFACE_FRAGMENT}
          uniforms={playerUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, STATS_Z]}>
        <planeGeometry args={[width, height, 24, 32]} />
        <shaderMaterial
          vertexShader={SURFACE_VERTEX}
          fragmentShader={SURFACE_FRAGMENT}
          uniforms={statsUniforms}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0, STATS_Z + 0.005]}>
        <planeGeometry args={[width, height]} />
        <shaderMaterial
          ref={holoMat}
          vertexShader={HOLO_VERTEX}
          fragmentShader={HOLO_FRAGMENT}
          uniforms={{
            uTiltX: { value: 0 },
            uTiltY: { value: 0 },
            uStrength: { value: holo ? 1 : 0.3 },
          }}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Particules — petit éclat au début de la manipulation */}
      <points>
        <bufferGeometry ref={particlesGeo}>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={particlesMat}
          color={holo ? "#F4C542" : "#E8C87A"}
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

export function CardCanvas({
  background,
  playerLayer,
  stats,
  holo,
  mode,
}: {
  background: string;
  playerLayer: string;
  stats: string;
  holo: boolean;
  mode: "simple" | "rare";
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ position: [0, 0, 3.4], fov: 28 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[2, 3, 4]} intensity={0.7} />
      <CardMesh
        background={background}
        playerLayer={playerLayer}
        stats={stats}
        holo={holo}
        bezel={BEZEL_COLOR[mode]}
      />
    </Canvas>
  );
}
