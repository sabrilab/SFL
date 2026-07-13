"use client";

// Rendu Three.js du plan de carte texturé — tilt au pointeur/tactile façon
// carte à collectionner, plus un sweep holographique sur les cartes Rare.
// frameloop="demand" : aucun rendu tant que rien ne bouge (pas de boucle
// continue), pour rester léger sur mobile.

import { useCallback, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

const MAX_TILT_Y = 0.5; // rad, rotation autour de l'axe Y (mouvement horizontal)
const MAX_TILT_X = 0.32; // rad, rotation autour de l'axe X (mouvement vertical)
const LERP = 0.14;

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
    float edge = clamp(abs(uTiltX) / 0.5 + abs(uTiltY) / 0.32, 0.0, 1.0);
    float alpha = (0.05 + edge * 0.22) * uStrength;
    gl_FragColor = vec4(rainbow, alpha);
  }
`;

function CardMesh({ imageUrl, holo }: { imageUrl: string; holo: boolean }) {
  const { camera, invalidate } = useThree();
  const texture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(imageUrl, () => invalidate());
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [imageUrl, invalidate]);

  const persp = camera as THREE.PerspectiveCamera;
  const distance = persp.position.z;
  const vFOV = THREE.MathUtils.degToRad(persp.fov);
  const visibleHeight = 2 * Math.tan(vFOV / 2) * distance;
  const height = visibleHeight * 0.98;
  const width = height * persp.aspect;

  const groupRef = useRef<THREE.Group>(null);
  const holoMat = useRef<THREE.ShaderMaterial>(null);
  const target = useRef({ x: 0, y: 0, scale: 1 });
  const current = useRef({ x: 0, y: 0, scale: 1 });

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

  // frameloop="demand" : chaque handler doit relancer le rendu lui-même,
  // sinon useFrame ne se redéclenche jamais après le premier repos.
  const onMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!e.uv) return;
      const u = e.uv.x - 0.5;
      const v = e.uv.y - 0.5;
      target.current.x = THREE.MathUtils.clamp(u, -0.5, 0.5) * MAX_TILT_Y;
      target.current.y = THREE.MathUtils.clamp(-v, -0.5, 0.5) * MAX_TILT_X;
      invalidate();
    },
    [invalidate]
  );

  const onLeave = useCallback(() => {
    target.current.x = 0;
    target.current.y = 0;
    target.current.scale = 1;
    invalidate();
  }, [invalidate]);

  const onDown = useCallback(() => {
    target.current.scale = 1.045;
    invalidate();
  }, [invalidate]);

  // Le relâchement (souris ou tactile) remet la carte bien à plat, comme
  // si on la lâchait — cohérent sur mobile où il n'y a pas de "survol".
  const onUp = useCallback(() => {
    target.current.x = 0;
    target.current.y = 0;
    target.current.scale = 1;
    invalidate();
  }, [invalidate]);

  return (
    <group
      ref={groupRef}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerDown={onDown}
      onPointerUp={onUp}
    >
      <mesh>
        <planeGeometry args={[width, height, 24, 32]} />
        <meshStandardMaterial map={texture} roughness={0.4} metalness={0.06} transparent />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
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
  imageUrl,
  holo,
  className,
}: {
  imageUrl: string;
  holo: boolean;
  className?: string;
}) {
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ position: [0, 0, 3.4], fov: 28 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%", touchAction: "none" }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[2, 3, 4]} intensity={0.7} />
      <CardMesh imageUrl={imageUrl} holo={holo} />
    </Canvas>
  );
}
