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
// carte fait ~1.5 unité de haut) — un vrai pop-out façon carte à
// collectionner, mais resserré pour rester crédible comme un seul bloc.
const PLAYER_Z = 0.06;
const STATS_Z = 0.11;

// Marge autour de la carte dans le cadre (moins la carte remplit le
// frustum, plus elle a de la place pour tourner sans que les bords ou
// les coins arrondis ne sortent du canvas).
const FILL_RATIO = 0.72;

const BEZEL_COLOR: Record<"simple" | "rare", string> = {
  simple: "#B99D66",
  rare: "#9C6F22",
};

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
  const current = useRef({ x: 0, y: 0, scale: 1 });
  const drag = useRef({ active: false, startX: 0, startY: 0 });

  useFrame(() => {
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
    if (!settled) invalidate();
  });

  // Suivi du glissement au niveau window : robuste même si le pointeur
  // sort des limites du plan pendant le geste (cas fréquent au doigt).
  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;
      target.current.x = THREE.MathUtils.clamp((dx / DRAG_RANGE_PX) * MAX_TILT_Y, -MAX_TILT_Y, MAX_TILT_Y);
      target.current.y = THREE.MathUtils.clamp((-dy / DRAG_RANGE_PX) * MAX_TILT_X, -MAX_TILT_X, MAX_TILT_X);
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

  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      drag.current.active = true;
      drag.current.startX = e.nativeEvent.clientX;
      drag.current.startY = e.nativeEvent.clientY;
      target.current.scale = 1.045;
      invalidate();
    },
    [invalidate]
  );

  // Murs latéraux : referment les tranches entre le fond et le dessus,
  // pour que la carte se lise comme un bloc hermétique plutôt que des
  // plans flottants séparés.
  const wallT = Math.min(width, height) * 0.012;
  const wallDepth = STATS_Z;
  const wallZ = STATS_Z / 2;

  const bgUniforms = useMemo(() => ({ map: { value: bgTex } }), [bgTex]);
  const playerUniforms = useMemo(() => ({ map: { value: playerTex } }), [playerTex]);
  const statsUniforms = useMemo(() => ({ map: { value: statsTex } }), [statsTex]);

  return (
    <group ref={groupRef} onPointerDown={onDown}>
      <mesh position={[-width / 2, 0, wallZ]}>
        <boxGeometry args={[wallT, height, wallDepth]} />
        <meshStandardMaterial color={bezel} roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[width / 2, 0, wallZ]}>
        <boxGeometry args={[wallT, height, wallDepth]} />
        <meshStandardMaterial color={bezel} roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[0, height / 2, wallZ]}>
        <boxGeometry args={[width, wallT, wallDepth]} />
        <meshStandardMaterial color={bezel} roughness={0.45} metalness={0.35} />
      </mesh>
      <mesh position={[0, -height / 2, wallZ]}>
        <boxGeometry args={[width, wallT, wallDepth]} />
        <meshStandardMaterial color={bezel} roughness={0.45} metalness={0.35} />
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
