"use client";

// Page TEMPORAIRE de validation : projection d'une photo sur la tête 3D
// (projective texture mapping) — prototype du pipeline photo -> avatar.
// À supprimer une fois le principe validé.

import { Suspense, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = "/models/avatar-base-hbm.glb";
const PHOTO_URL = "/models/test_face_front.png";

function Head() {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  const photo = useLoader(THREE.TextureLoader, PHOTO_URL);

  const { material, headCenter } = useMemo(() => {
    photo.colorSpace = THREE.SRGBColorSpace;

    // bbox globale -> le sommet du crâne (les bras écartés faussent la largeur,
    // on fixe donc des dimensions de tête réalistes en mètres)
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const headTopY = box.max.y;
    const faceZ = box.max.z;
    // eslint-disable-next-line no-console
    console.log("BBOX", JSON.stringify({ min: box.min.toArray(), max: box.max.toArray() }));
    // repères anthropométriques : tête ~23 cm, yeux ~11 cm sous le sommet
    const HEAD_H = 0.24;
    const eyesY = headTopY - 0.115;
    const chinY = headTopY - HEAD_H;
    const halfW = 0.095; // demi-largeur visage
    const halfH = HEAD_H * 0.52;
    const centerY = (headTopY + chinY) / 2;
    const center = new THREE.Vector3(0, eyesY, faceZ);

    // caméra projecteur ortho, cadrée sur le visage, devant (+Z), regardant -Z
    const proj = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 3);
    proj.position.set(0, centerY, faceZ + 0.5);
    proj.up.set(0, 1, 0);
    proj.lookAt(0, centerY, faceZ);
    proj.updateMatrixWorld(true);
    proj.updateProjectionMatrix();
    const projMatrix = new THREE.Matrix4().multiplyMatrices(
      proj.projectionMatrix,
      proj.matrixWorldInverse
    );
    void eyesY;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uPhoto: { value: photo },
        uProjMatrix: { value: projMatrix },
        uProjDir: { value: new THREE.Vector3(0, 0, 1) }, // vers le projecteur
        uSkin: { value: new THREE.Color("#c98850") },
        uChinY: { value: chinY },
        uTopY: { value: headTopY },
      },
      vertexShader: /* glsl */ `
        varying vec4 vProj;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        uniform mat4 uProjMatrix;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vProj = uProjMatrix * wp;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uPhoto;
        uniform vec3 uProjDir;
        uniform vec3 uSkin;
        uniform float uChinY;
        uniform float uTopY;
        varying vec4 vProj;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 base = uSkin;
          vec2 uv = (vProj.xy / vProj.w) * 0.5 + 0.5;
          float facing = dot(normalize(vWorldNormal), normalize(uProjDir));
          float inRange = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
          // masque tête : fondu sous le menton, coupe au-dessus du sommet
          float headMask = smoothstep(uChinY - 0.03, uChinY + 0.03, vWorldPos.y)
                         * (1.0 - smoothstep(uTopY - 0.01, uTopY + 0.02, vWorldPos.y));
          float w = smoothstep(0.1, 0.5, facing) * inRange * headMask;
          vec3 photo = texture2D(uPhoto, uv).rgb;
          vec3 col = mix(base, photo, w);
          float l = 0.55 + 0.45 * max(0.0, dot(normalize(vWorldNormal), normalize(vec3(0.3, 0.4, 0.7))));
          gl_FragColor = vec4(col * l, 1.0);
        }
      `,
    });

    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as unknown as { isMesh?: boolean }).isMesh) m.material = mat;
    });

    return { material: mat, headCenter: center };
  }, [gltf, photo]);

  void material;
  void headCenter;
  return <primitive object={gltf.scene} />;
}

export default function FaceTestPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#eee" }}>
      <Canvas
        camera={{ fov: 18, position: [0.5, 1.93, 1.35] }}
        onCreated={({ camera }) => camera.lookAt(0, 1.9, 0.15)}
      >
        <Suspense fallback={null}>
          <Head />
        </Suspense>
      </Canvas>
    </div>
  );
}
