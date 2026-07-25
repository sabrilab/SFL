"use client";

// Aperçu 3D de l'avatar, rendu « 3D à pâte 2D » (cel-shading) :
//  - les matériaux Principled du GLB sont convertis en MeshToonMaterial
//    (3 bandes de lumière, façon dessin animé) ;
//  - un contour noir est tracé par « coque inversée » : clone du mesh
//    skinné, gonflé le long des normales, faces retournées ;
//  - le visage est une texture anime échangée selon la teinte de peau ;
//  - morph targets (corpulence, forme de tête) et échelle (taille)
//    appliqués à chaud ; idle Mixamo en boucle ; drag pour tourner.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  CHEVEUX_MESH,
  corpulenceMorphs,
  teteMorphs,
  PEAU_HEX,
  TAILLE_SCALE,
  type AvatarConfig,
  type Peau,
} from "@/lib/sfl/avatar";
import { headFrame, makeFaceProjectionMaterial, type FacePhotos } from "@/lib/sfl/face-projection";

const MODEL_URL = "/models/avatar-base-hbm.glb";
const FACE_TEXTURE_URL: Record<Peau, string> = {
  claire: "/models/face_claire.png",
  medium: "/models/face_medium.png",
  foncee: "/models/face_foncee.png",
};
const OUTLINE_WIDTH = 0.006; // m, épaisseur du trait
const ROT_PER_PX = 0.012;
const LERP = 0.18;

// Rampe de lumière à 3 tons : c'est elle qui donne les ombres « à bords
// nets » du cel-shading.
function makeGradientMap(): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    new Uint8Array([120, 200, 255]),
    3,
    1,
    THREE.RedFormat
  );
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

interface RotState {
  target: number;
  current: number;
}

/** Charge les trois photos en textures ; `null` tant qu'il n'y en a pas. */
function usePhotoTextures(photos?: FacePhotos) {
  const [textures, setTextures] = useState<{
    front: THREE.Texture;
    left: THREE.Texture;
    right: THREE.Texture;
  } | null>(null);

  useEffect(() => {
    if (!photos) {
      setTextures(null);
      return;
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const load = (url: string) =>
      new Promise<THREE.Texture>((resolve, reject) => loader.load(url, resolve, undefined, reject));
    Promise.all([load(photos.front.url), load(photos.left.url), load(photos.right.url)])
      .then(([front, left, right]) => {
        if (cancelled) {
          for (const t of [front, left, right]) t.dispose();
          return;
        }
        setTextures({ front, left, right });
      })
      .catch(() => setTextures(null));
    return () => {
      cancelled = true;
    };
  }, [photos]);

  return textures;
}

function AvatarModel({ config, photos }: { config: AvatarConfig; photos?: FacePhotos }) {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  const faceTextures = useLoader(THREE.TextureLoader, [
    FACE_TEXTURE_URL.claire,
    FACE_TEXTURE_URL.medium,
    FACE_TEXTURE_URL.foncee,
  ]);
  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), [gltf]);

  // Les textures chargées à part doivent matcher la convention glTF.
  useEffect(() => {
    for (const t of faceTextures) {
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
    }
  }, [faceTextures]);

  // Conversion toon + contours — une seule fois par chargement du GLB.
  // (idempotent : en dev, React ré-exécute ce memo sur la même scène)
  const toonMaterials = useMemo(() => {
    const cached = gltf.scene.userData.__toonMaterials as
      | Map<string, THREE.MeshToonMaterial>
      | undefined;
    if (cached) return cached;
    const gradientMap = makeGradientMap();
    const byName = new Map<string, THREE.MeshToonMaterial>();
    const outlineMat = new THREE.MeshBasicMaterial({
      color: 0x14100c,
      side: THREE.BackSide,
    });
    outlineMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\n\ttransformed += objectNormal * ${OUTLINE_WIDTH};`
      );
    };

    const outlines: THREE.Object3D[] = [];
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.SkinnedMesh;
      if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;

      const src = mesh.material as THREE.MeshStandardMaterial;
      let toon = byName.get(src.name);
      if (!toon) {
        toon = new THREE.MeshToonMaterial({
          name: src.name,
          color: src.color?.clone() ?? new THREE.Color("#ffffff"),
          map: src.map ?? null,
          gradientMap,
        });
        byName.set(src.name, toon);
      }
      mesh.material = toon;

      // Coque inversée : suit le squelette et les morphs du mesh d'origine.
      const outline = mesh.clone();
      outline.name = `${mesh.name}__outline`;
      outline.material = outlineMat;
      if (mesh.morphTargetInfluences) {
        outline.morphTargetInfluences = mesh.morphTargetInfluences;
      }
      outlines.push(outline);
    });
    // Ajout après la traversée (on ne modifie pas l'arbre en le parcourant).
    for (const o of outlines) {
      gltf.scene.add(o);
    }
    gltf.scene.userData.__toonMaterials = byName;
    return byName;
  }, [gltf]);

  useEffect(() => {
    if (gltf.animations.length > 0) {
      mixer.clipAction(gltf.animations[0]).play();
    }
    return () => {
      mixer.stopAllAction();
    };
  }, [gltf, mixer]);

  useFrame((_, delta) => mixer.update(delta));

  // Application de la config : morphs, peau (teinte + texture visage).
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
    });

    // Coupe de cheveux : on n'affiche que le mesh choisi (et son contour).
    const hairTarget = CHEVEUX_MESH[config.cheveux];
    gltf.scene.traverse((obj) => {
      const base = obj.name.replace(/__outline$/, "");
      if (base.startsWith("Cheveux")) obj.visible = base === hairTarget;
    });

    const skin = toonMaterials.get("Skin");
    if (skin) skin.color.set(PEAU_HEX[config.peau]);

    const face = toonMaterials.get("FaceTex");
    if (face) {
      const idx = config.peau === "claire" ? 0 : config.peau === "medium" ? 1 : 2;
      face.map = faceTextures[idx];
      face.needsUpdate = true;
    }
  }, [gltf, config, toonMaterials, faceTextures]);

  // Photos de l'utilisateur : le corps passe du toon uni à la projection des
  // trois clichés. Les cheveux et les traits dessinés gardent leur matériau —
  // la photo apporte déjà yeux et sourcils.
  const photoTextures = usePhotoTextures(photos);
  useEffect(() => {
    const bodies: THREE.Mesh[] = [];
    gltf.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
      const base = mesh.name.replace(/__outline$/, "");
      if (base.startsWith("Cheveux") || base === "Traits") return;
      if (mesh.name.endsWith("__outline")) return;
      bodies.push(mesh);
    });

    if (!photos || !photoTextures) {
      // retour au rendu toon
      for (const mesh of bodies) {
        const saved = mesh.userData.__toonMat as THREE.Material | undefined;
        if (saved) mesh.material = saved;
      }
      return;
    }

    // La carnation vient de la photo, pas du réglage « Peau » : sinon le
    // visage photographié tranche avec le reste du corps.
    const [r, g, b] = photos.front.meanColor;
    const skin = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    const frame = headFrame(gltf.scene);
    const mat = makeFaceProjectionMaterial(photos, photoTextures, frame, skin);
    for (const mesh of bodies) {
      if (!mesh.userData.__toonMat) mesh.userData.__toonMat = mesh.material;
      mesh.material = mat;
    }
    return () => {
      mat.dispose();
    };
  }, [gltf, photos, photoTextures, config.peau]);

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

export function AvatarViewer({ config, photos }: { config: AvatarConfig; photos?: FacePhotos }) {
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
        {/* Le toon shading aime une lumière directionnelle franche */}
        <hemisphereLight args={["#ffffff", "#b9c0cc", 0.55]} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} />
        <Suspense fallback={null}>
          <Turntable rot={rot}>
            <AvatarModel config={config} photos={photos} />
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
