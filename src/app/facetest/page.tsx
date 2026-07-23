"use client";

// Page TEMPORAIRE de validation : projection de 3 photos (face/gauche/droite)
// sur la tête 3D via projective texture mapping, blend pondéré par la normale.
// Prototype du pipeline photo -> avatar. À supprimer une fois validé.

import { Suspense, useMemo } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = "/models/avatar-base-hbm.glb";

function projectorMatrix(pos: THREE.Vector3, target: THREE.Vector3, halfW: number, halfH: number) {
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 4);
  cam.position.copy(pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
}

function Head() {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  const [front, left, right] = useLoader(THREE.TextureLoader, [
    "/models/test_face_front.png",
    "/models/test_face_left.png",
    "/models/test_face_right.png",
  ]);

  const material = useMemo(() => {
    for (const t of [front, left, right]) t.colorSpace = THREE.SRGBColorSpace;

    const box = new THREE.Box3().setFromObject(gltf.scene);
    const topY = box.max.y;
    const faceZ = box.max.z;
    const chinY = topY - 0.24;
    const centerY = (topY + chinY) / 2;
    const halfW = 0.11;
    const halfH = 0.135;
    const D = 0.6;

    // 3 projecteurs : face (+Z), gauche de la personne (+X), droite (-X)
    const mFront = projectorMatrix(
      new THREE.Vector3(0, centerY, faceZ + D),
      new THREE.Vector3(0, centerY, faceZ),
      halfW,
      halfH
    );
    const mLeft = projectorMatrix(
      new THREE.Vector3(D, centerY, faceZ * 0.4),
      new THREE.Vector3(0, centerY, faceZ * 0.4),
      halfW,
      halfH
    );
    const mRight = projectorMatrix(
      new THREE.Vector3(-D, centerY, faceZ * 0.4),
      new THREE.Vector3(0, centerY, faceZ * 0.4),
      halfW,
      halfH
    );

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uFront: { value: front },
        uLeft: { value: left },
        uRight: { value: right },
        uMFront: { value: mFront },
        uMLeft: { value: mLeft },
        uMRight: { value: mRight },
        uSkin: { value: new THREE.Color("#c98850") },
        uChinY: { value: chinY },
        uTopY: { value: topY },
      },
      vertexShader: /* glsl */ `
        varying vec4 vF; varying vec4 vL; varying vec4 vR;
        varying vec3 vN; varying vec3 vWP;
        uniform mat4 uMFront; uniform mat4 uMLeft; uniform mat4 uMRight;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vF = uMFront * wp; vL = uMLeft * wp; vR = uMRight * wp;
          vN = normalize(mat3(modelMatrix) * normal);
          vWP = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uFront; uniform sampler2D uLeft; uniform sampler2D uRight;
        uniform vec3 uSkin; uniform float uChinY; uniform float uTopY;
        varying vec4 vF; varying vec4 vL; varying vec4 vR;
        varying vec3 vN; varying vec3 vWP;

        // échantillonne une projection : renvoie rgb + poids (a) si dans le cadre
        vec4 sampleProj(sampler2D tex, vec4 proj, vec3 dir) {
          vec2 uv = (proj.xy / proj.w) * 0.5 + 0.5;
          float inR = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
          float facing = max(0.0, dot(normalize(vN), normalize(dir)));
          return vec4(texture2D(tex, uv).rgb, inR * facing);
        }

        void main() {
          vec4 sf = sampleProj(uFront, vF, vec3(0.0, 0.0, 1.0));
          vec4 sl = sampleProj(uLeft,  vL, vec3(1.0, 0.0, 0.0));
          vec4 sr = sampleProj(uRight, vR, vec3(-1.0, 0.0, 0.0));
          // pondération : la face domine (exposant plus doux), profils en appoint
          float wf = pow(sf.a, 1.5) * 1.3;
          float wl = pow(sl.a, 2.5);
          float wr = pow(sr.a, 2.5);
          float sum = wf + wl + wr;
          vec3 photo = uSkin;
          if (sum > 0.001) photo = (sf.rgb*wf + sl.rgb*wl + sr.rgb*wr) / sum;
          // couverture globale -> fondu vers la peau si aucun projecteur ne voit
          float cover = smoothstep(0.05, 0.4, sum);
          float headMask = smoothstep(uChinY - 0.03, uChinY + 0.03, vWP.y)
                         * (1.0 - smoothstep(uTopY - 0.02, uTopY + 0.02, vWP.y));
          vec3 col = mix(uSkin, photo, cover * headMask);
          float lgt = 0.55 + 0.45 * max(0.0, dot(normalize(vN), normalize(vec3(0.3, 0.4, 0.7))));
          gl_FragColor = vec4(col * lgt, 1.0);
        }
      `,
    });

    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if ((m as unknown as { isMesh?: boolean }).isMesh) m.material = mat;
    });
    return mat;
  }, [gltf, front, left, right]);

  void material;
  return <primitive object={gltf.scene} />;
}

export default function FaceTestPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#eee" }}>
      <Canvas
        camera={{ fov: 20, position: [0.9, 1.93, 1.1] }}
        onCreated={({ camera }) => camera.lookAt(0, 1.9, 0.15)}
      >
        <Suspense fallback={null}>
          <Head />
        </Suspense>
      </Canvas>
    </div>
  );
}
