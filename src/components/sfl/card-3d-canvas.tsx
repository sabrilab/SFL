"use client";

// Rendu Three.js de la carte en trois plans profonds (fond doré, joueur,
// stats) fermés par une tranche arrondie, avec un dos "SFL" — on peut la
// faire tourner librement (jusqu'à voir le dos), l'inertie s'amortit
// naturellement et la carte se pose d'elle-même sur la face la plus proche.
//
// Le geste est suivi en delta de pointeur au niveau window (pas de raycast
// pendant le drag : un doigt qui sort du mesh ne coupe jamais la rotation).
//
// frameloop="demand" : aucun rendu tant que rien ne bouge.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

const MAX_TILT_X = 0.3; // rad, bascule verticale (clampée, revient à plat)
const ROT_PER_PX = 0.011; // rad de rotation Y par pixel glissé (libre, 360°)
const DRAG_RANGE_PX = 150;
const LERP_DRAG = 0.3; // suivi du doigt (réactif)
const LERP_SETTLE = 0.09; // pose finale + intro (doux)
const INERTIA_DAMPING = 0.93; // amortissement de la vitesse après relâche
const SNAP_VELOCITY = 0.6; // rad/s — sous ce seuil, on se pose sur une face

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

// Forme rectangle arrondi réutilisée pour la tranche (le bezel).
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

// Anneau latéral (tranche) construit à la main : uniquement les faces de
// côté, aucune face avant/arrière — pas de cap opaque qui couvrirait les
// calques image.
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

// Dos de la carte : fond noir arrondi, logo SFL "gravé" en relief.
// Dessiné en canvas 2D (coins transparents inclus) et plaqué en texture.
function makeBackTexture(bezel: string): THREE.CanvasTexture {
  const w = 512;
  const h = 664;
  const r = 46;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.clip();

  const bg = ctx.createRadialGradient(w * 0.35, h * 0.25, 60, w / 2, h / 2, h * 0.85);
  bg.addColorStop(0, "#171310");
  bg.addColorStop(0.55, "#0B0906");
  bg.addColorStop(1, "#050403");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = `${bezel}66`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(12, 12, w - 24, h - 24, r - 10);
  ctx.stroke();

  // "SFL" extrudé : plusieurs couches décalées (ombre profonde → face or)
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "italic 900 172px 'Arial Black', sans-serif";
  for (let d = 9; d >= 3; d--) {
    ctx.fillStyle = `rgba(0,0,0,${0.5 + (9 - d) * 0.05})`;
    ctx.fillText("SFL", w / 2 + d, h / 2 - 20 + d);
  }
  const face = ctx.createLinearGradient(0, h / 2 - 120, 0, h / 2 + 80);
  face.addColorStop(0, "#FBE9A8");
  face.addColorStop(0.55, "#E8C266");
  face.addColorStop(1, "#8A5A18");
  ctx.fillStyle = face;
  ctx.fillText("SFL", w / 2, h / 2 - 20);

  ctx.font = "700 26px 'Arial Narrow', sans-serif";
  ctx.fillStyle = "#C9964Acc";
  const letterSpaced = "S U N D A Y   F I V E   L E A G U E";
  ctx.fillText(letterSpaced, w / 2, h / 2 + 96);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
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

const HOLO_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform float uTiltX;
  uniform float uTiltY;
  uniform float uStrength;
  ${ROUNDED_MASK_GLSL}

  void main() {
    if (roundedMask(vUv) > 0.0) discard;
    float diag = vUv.x * 0.7 + vUv.y * 0.3;
    float shift = uTiltX * 0.6 - uTiltY * 0.6;
    float band = fract((diag + shift) * 2.4);
    vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (vec3(band) + vec3(0.0, 0.33, 0.67)));
    float edge = clamp(abs(uTiltX) / 0.52 + abs(uTiltY) / 0.3, 0.0, 1.0);
    float alpha = (0.05 + edge * 0.22) * uStrength;
    gl_FragColor = vec4(rainbow, alpha);
  }
`;

// Matériau "surface" — texture captée + réponse à la lumière (bump grain,
// spéculaire, fresnel chaud) + masque de coins arrondis.
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
  startFace = "front",
  interactive = true,
}: {
  background: string;
  playerLayer: string;
  stats: string;
  holo: boolean;
  bezel: string;
  /** "back" démarre déjà retournée (dos SFL gravé) — pour les visuels de pack scellé. */
  startFace?: "front" | "back";
  /** false = décorative, ne répond pas au glissement (fans de pack). */
  interactive?: boolean;
}) {
  const { camera, invalidate } = useThree();
  const bgTex = useLayerTexture(background);
  const playerTex = useLayerTexture(playerLayer);
  const statsTex = useLayerTexture(stats);
  const backTex = useMemo(() => makeBackTexture(bezel), [bezel]);

  const persp = camera as THREE.PerspectiveCamera;
  const distance = persp.position.z;
  const vFOV = THREE.MathUtils.degToRad(persp.fov);
  const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
  const height = visibleHeight * FILL_RATIO;
  const width = height * persp.aspect;

  const groupRef = useRef<THREE.Group>(null);
  const holoMat = useRef<THREE.ShaderMaterial>(null);
  // Machine à états du mouvement : intro (arrivée lente) → idle ;
  // drag (suivi du doigt) → inertia (élan amorti puis pose sur une face).
  const mode = useRef<"intro" | "idle" | "drag" | "inertia">("intro");
  const current = useRef({ x: 0.2, y: -2.6, scale: 0.7 });
  const target = useRef({ x: 0, y: startFace === "back" ? Math.PI : 0, scale: 1 });
  const velY = useRef(0);
  const drag = useRef({ startX: 0, startY: 0, baseRotY: 0 });

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
    invalidate();
  }, [invalidate]);

  useFrame((_, delta) => {
    const c = current.current;
    const t = target.current;
    const m = mode.current;
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
        mode.current = "idle";
      }
    } else {
      // intro + idle : pose douce vers la cible
      const lerp = LERP_SETTLE;
      c.x += (t.x - c.x) * lerp;
      c.y += (t.y - c.y) * lerp;
      c.scale += (t.scale - c.scale) * lerp;
      if (m === "intro" && Math.abs(t.y - c.y) < 0.002 && Math.abs(t.x - c.x) < 0.002) {
        mode.current = "idle";
      }
    }

    if (groupRef.current) {
      groupRef.current.rotation.y = c.y;
      groupRef.current.rotation.x = c.x;
      groupRef.current.scale.setScalar(c.scale);
    }
    if (holoMat.current) {
      holoMat.current.uniforms.uTiltX.value = c.y % Math.PI;
      holoMat.current.uniforms.uTiltY.value = c.x;
    }

    const settled =
      mode.current !== "inertia" &&
      mode.current !== "drag" &&
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

    if (!settled || b.active) invalidate();
  });

  // Suivi du glissement au niveau window : robuste même si le pointeur
  // sort des limites du plan pendant le geste (cas fréquent au doigt).
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (mode.current !== "drag") return;
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
      if (mode.current !== "drag") return;
      mode.current = "inertia";
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
      mode.current = "drag";
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

  // Tranche (bezel) arrondie suivant les coins du visuel.
  const wallRadius = Math.min(width, height) * 0.07;
  const wallShape = useMemo(() => roundedRectShape(width, height, wallRadius), [width, height, wallRadius]);
  const wallGeo = useMemo(() => roundedWallGeometry(wallShape, STATS_Z, 10), [wallShape]);

  const maskUniforms = useMemo(
    () => ({ uAspect: width / height, uRadius: wallRadius / height }),
    [width, height, wallRadius]
  );
  const bgUniforms = useMemo(
    () => ({
      map: { value: bgTex },
      uAspect: { value: maskUniforms.uAspect },
      uRadius: { value: maskUniforms.uRadius },
    }),
    [bgTex, maskUniforms]
  );
  const playerUniforms = useMemo(
    () => ({
      map: { value: playerTex },
      uAspect: { value: maskUniforms.uAspect },
      uRadius: { value: maskUniforms.uRadius },
    }),
    [playerTex, maskUniforms]
  );
  const statsUniforms = useMemo(
    () => ({
      map: { value: statsTex },
      uAspect: { value: maskUniforms.uAspect },
      uRadius: { value: maskUniforms.uRadius },
    }),
    [statsTex, maskUniforms]
  );
  const holoUniforms = useMemo(
    () => ({
      uTiltX: { value: 0 },
      uTiltY: { value: 0 },
      uStrength: { value: holo ? 1 : 0.3 },
      uAspect: { value: maskUniforms.uAspect },
      uRadius: { value: maskUniforms.uRadius },
    }),
    [holo, maskUniforms]
  );

  return (
    <group ref={groupRef} onPointerDown={interactive ? onDown : undefined}>
      <mesh geometry={wallGeo}>
        <meshStandardMaterial color={bezel} roughness={0.45} metalness={0.35} side={THREE.DoubleSide} />
      </mesh>

      {/* Dos de la carte — SFL gravé sur fond noir, visible en la retournant */}
      <mesh position={[0, 0, -0.004]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={backTex} roughness={0.55} metalness={0.15} transparent />
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
          uniforms={holoUniforms}
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

// Force la compilation des programmes shader (surface + holo) dès le
// montage, sans attendre un vrai draw call — utilisé par l'écran de
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
  holo,
  mode,
  startFace = "front",
  interactive = true,
  onReady,
}: {
  background: string;
  playerLayer: string;
  stats: string;
  holo: boolean;
  mode: "simple" | "rare";
  startFace?: "front" | "back";
  interactive?: boolean;
  /** Appelé une fois les shaders compilés (préchauffe WebGL, voir AppSplash). */
  onReady?: () => void;
}) {
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ position: [0, 0, 3.4], fov: 28 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%", touchAction: interactive ? "none" : "auto" }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[2, 3, 4]} intensity={0.7} />
      <CardMesh
        background={background}
        playerLayer={playerLayer}
        stats={stats}
        holo={holo}
        bezel={BEZEL_COLOR[mode]}
        startFace={startFace}
        interactive={interactive}
      />
      {onReady && <ShaderWarmup onReady={onReady} />}
    </Canvas>
  );
}
