"use client";

// Aperçu 3D de l'avatar : le GLB riggé (squelette Mixamo + idle Neutral)
// est chargé une fois, puis la config est appliquée à chaud — morph
// targets (corpulence, forme de tête), teinte du matériau "Skin" et
// échelle globale (taille). Drag horizontal pour tourner autour du
// personnage, l'idle tourne en boucle.

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  corpulenceMorphs,
  teteMorphs,
  PEAU_HEX,
  TAILLE_SCALE,
  type AvatarConfig,
} from "@/lib/sfl/avatar";

const MODEL_URL = "/models/avatar-base.glb";
const ROT_PER_PX = 0.012;
const LERP = 0.18;

interface RotState {
  target: number;
  current: number;
}

function AvatarModel({ config }: { config: AvatarConfig }) {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), [gltf]);

  useEffect(() => {
    if (gltf.animations.length > 0) {
      mixer.clipAction(gltf.animations[0]).play();
    }
    return () => {
      mixer.stopAllAction();
    };
  }, [gltf, mixer]);

  useFrame((_, delta) => mixer.update(delta));

  useEffect(() => {
    const morphs = {
      ...corpulenceMorphs(config.corpulence),
      ...teteMorphs(config.tete),
    };
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        for (const [name, value] of Object.entries(morphs)) {
          const idx = mesh.morphTargetDictionary[name];
          if (idx !== undefined) mesh.morphTargetInfluences[idx] = value;
        }
      }
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (material?.name === "Skin") {
        material.color.set(PEAU_HEX[config.peau]);
      }
    });
  }, [gltf, config]);

  return <primitive object={gltf.scene} scale={TAILLE_SCALE[config.taille]} />;
}

function Turntable({
  rot,
  children,
}: {
  rot: React.RefObject<RotState>;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(() => {
    const r = rot.current;
    if (!r || !group.current) return;
    r.current += (r.target - r.current) * LERP;
    group.current.rotation.y = r.current;
  });

  return <group ref={group}>{children}</group>;
}

export function AvatarViewer({ config }: { config: AvatarConfig }) {
  const rot = useRef<RotState>({ target: 0.5, current: 0.5 });
  const drag = useRef<{ lastX: number } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      rot.current.target += (e.clientX - drag.current.lastX) * ROT_PER_PX;
      drag.current.lastX = e.clientX;
    };
    const onUp = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div
      className="h-full w-full cursor-grab touch-pan-y active:cursor-grabbing"
      onPointerDown={(e) => {
        drag.current = { lastX: e.clientX };
      }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 32, position: [0, 1.15, 3.6] }}
        onCreated={({ camera }) => camera.lookAt(0, 0.95, 0)}
      >
        <hemisphereLight args={["#ffffff", "#c8cdd6", 1.1]} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} />
        <directionalLight position={[-3, 2, -3]} intensity={0.5} />
        <Suspense fallback={null}>
          <Turntable rot={rot}>
            <AvatarModel config={config} />
            {/* Fausse ombre de contact, bien moins chère qu'une vraie */}
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
              <circleGeometry args={[0.55, 40]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.14} />
            </mesh>
          </Turntable>
        </Suspense>
      </Canvas>
    </div>
  );
}
