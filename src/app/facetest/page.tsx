"use client";

// Prototype interactif du pipeline photo -> avatar : on importe 3 photos
// (face / profil gauche / profil droit), elles sont projetées en direct sur
// la tête 3D (projective texture mapping, blend par normale). TEMPORAIRE.

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { preparePhoto } from "@/lib/sfl/face-crop";

const MODEL_URL = "/models/avatar-base-hbm.glb";
const DEFAULTS = {
  front: "/models/test_face_front.png",
  left: "/models/test_face_left.png",
  right: "/models/test_face_right.png",
};

function projMatrix(pos: THREE.Vector3, target: THREE.Vector3, hw: number, hh: number) {
  const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.01, 4);
  cam.position.copy(pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
}

type Urls = { front: string; left: string; right: string };
type Tints = { front: RGB; left: RGB; right: RGB };
type RGB = [number, number, number];

function Head({ urls, tints, rot }: { urls: Urls; tints: Tints; rot: React.RefObject<number> }) {
  const gltf = useLoader(GLTFLoader, MODEL_URL);
  const front = useLoader(THREE.TextureLoader, urls.front);
  const left = useLoader(THREE.TextureLoader, urls.left);
  const right = useLoader(THREE.TextureLoader, urls.right);
  const group = useRef<THREE.Group>(null);

  const material = useMemo(() => {
    for (const t of [front, left, right]) t.colorSpace = THREE.SRGBColorSpace;
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const topY = box.max.y;
    const faceZ = box.max.z;
    const chinY = topY - 0.24;
    const cY = (topY + chinY) / 2;
    const hw = 0.11;
    const hh = 0.135;
    const D = 0.6;

    // Harmonisation : chaque profil est ramené à la teinte de la photo de
    // face, qui sert de référence. Sans ça, une photo prise en intérieur et
    // l'autre dehors donnent deux moitiés de visage de couleurs différentes.
    const ratio = (ref: RGB, other: RGB): THREE.Vector3 =>
      new THREE.Vector3(
        THREE.MathUtils.clamp(ref[0] / Math.max(other[0], 0.03), 0.6, 1.6),
        THREE.MathUtils.clamp(ref[1] / Math.max(other[1], 0.03), 0.6, 1.6),
        THREE.MathUtils.clamp(ref[2] / Math.max(other[2], 0.03), 0.6, 1.6)
      );

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uFront: { value: front },
        uLeft: { value: left },
        uRight: { value: right },
        uMFront: { value: projMatrix(new THREE.Vector3(0, cY, faceZ + D), new THREE.Vector3(0, cY, faceZ), hw, hh) },
        uMLeft: { value: projMatrix(new THREE.Vector3(D, cY, faceZ * 0.4), new THREE.Vector3(0, cY, faceZ * 0.4), hw, hh) },
        uMRight: { value: projMatrix(new THREE.Vector3(-D, cY, faceZ * 0.4), new THREE.Vector3(0, cY, faceZ * 0.4), hw, hh) },
        uCorrL: { value: ratio(tints.front, tints.left) },
        uCorrR: { value: ratio(tints.front, tints.right) },
        uSkin: { value: new THREE.Color("#c98850") },
        uChinY: { value: chinY },
        uTopY: { value: topY },
      },
      vertexShader: /* glsl */ `
        varying vec4 vF; varying vec4 vL; varying vec4 vR; varying vec3 vN; varying vec3 vWP;
        uniform mat4 uMFront; uniform mat4 uMLeft; uniform mat4 uMRight;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vF = uMFront * wp; vL = uMLeft * wp; vR = uMRight * wp;
          vN = normalize(mat3(modelMatrix) * normal); vWP = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uFront; uniform sampler2D uLeft; uniform sampler2D uRight;
        uniform vec3 uCorrL; uniform vec3 uCorrR;
        uniform vec3 uSkin; uniform float uChinY; uniform float uTopY;
        varying vec4 vF; varying vec4 vL; varying vec4 vR; varying vec3 vN; varying vec3 vWP;

        // Poids d'un projecteur : dans le cadre, orienté vers lui, et fondu
        // sur les bords de l'image pour que les raccords ne soient pas nets.
        vec4 sp(sampler2D tex, vec4 p, vec3 d) {
          vec2 uv = (p.xy / p.w) * 0.5 + 0.5;
          vec2 edge = min(uv, 1.0 - uv);
          float inR = smoothstep(0.0, 0.06, min(edge.x, edge.y));
          float f = max(0.0, dot(normalize(vN), normalize(d)));
          return vec4(texture2D(tex, uv).rgb, inR * f);
        }

        void main() {
          vec4 sf = sp(uFront, vF, vec3(0.0,0.0,1.0));
          vec4 sl = sp(uLeft,  vL, vec3(1.0,0.0,0.0));
          vec4 sr = sp(uRight, vR, vec3(-1.0,0.0,0.0));

          // Les profils sont ramenés à la teinte de la photo de face.
          sl.rgb *= uCorrL;
          sr.rgb *= uCorrR;

          // La face domine largement de trois quarts avant ; les profils ne
          // reprennent la main que sur les côtés (exposant élevé), sinon leur
          // couleur bave sur les joues.
          float wf = pow(sf.a, 2.0) * 2.2;
          float wl = pow(sl.a, 4.0);
          float wr = pow(sr.a, 4.0);
          float sum = wf + wl + wr;
          vec3 photo = uSkin;
          if (sum > 0.0001) photo = (sf.rgb*wf + sl.rgb*wl + sr.rgb*wr) / sum;

          float cover = smoothstep(0.02, 0.25, sum);
          // Masque tête : fondu sous le menton et au sommet du crâne.
          float headMask = smoothstep(uChinY - 0.035, uChinY + 0.045, vWP.y)
                         * (1.0 - smoothstep(uTopY - 0.06, uTopY - 0.005, vWP.y));
          // L'arrière du crâne n'est vu par aucune photo : on y reste en peau.
          float backFade = smoothstep(-0.10, 0.0, vWP.z);
          vec3 col = mix(uSkin, photo, cover * headMask * backFade);
          float lgt = 0.55+0.45*max(0.0,dot(normalize(vN),normalize(vec3(0.3,0.4,0.7))));
          gl_FragColor = vec4(col*lgt, 1.0);
        }
      `,
    });
    // Seul le corps reçoit la projection. Les cheveux gardent leur matériau
    // (sinon la coque de cheveux affiche un second visage par-dessus le vrai)
    // et les sourcils/pupilles dessinés sont masqués : la photo les apporte.
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x140d08 });
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!(m as unknown as { isMesh?: boolean }).isMesh) return;
      if (m.name === "Traits") {
        m.visible = false;
      } else if (m.name.startsWith("Cheveux")) {
        m.visible = m.name === "CheveuxCourt";
        m.material = hairMat;
      } else {
        m.material = mat;
      }
    });
    return mat;
  }, [gltf, front, left, right, tints]);

  void material;
  useFrame(() => {
    if (group.current && rot.current != null) group.current.rotation.y = rot.current;
  });
  return (
    <group ref={group}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function Slot({
  label, url, status, onPick,
}: {
  label: string; url: string; status: string; onPick: (f: File) => void;
}) {
  return (
    <label
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#333",
      }}
    >
      <div style={{ width: 78, height: 78, borderRadius: 12, overflow: "hidden", border: "2px solid #ccc", background: "#fff" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      {label}
      <span style={{ fontSize: 10, fontWeight: 500, color: status.startsWith("✓") ? "#128a4a" : "#999" }}>
        {status}
      </span>
      <input type="file" accept="image/*" style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </label>
  );
}

export default function FaceTestPage() {
  const [urls, setUrls] = useState<Urls>(DEFAULTS);
  const [tints, setTints] = useState<Tints>({
    front: [0.78, 0.53, 0.31], left: [0.78, 0.53, 0.31], right: [0.78, 0.53, 0.31],
  });
  const [status, setStatus] = useState<Record<keyof Urls, string>>({
    front: "test", left: "test", right: "test",
  });
  const rot = useRef(0.35);
  const drag = useRef<{ x: number } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (drag.current) { rot.current += (e.clientX - drag.current.x) * 0.01; drag.current.x = e.clientX; }
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  // Chaque photo importée passe par la détection de visage : on projette le
  // recadrage normalisé, pas l'original (fonds et cadrages sont quelconques).
  const pick = (slot: keyof Urls) => async (f: File) => {
    const raw = URL.createObjectURL(f);
    setStatus((s) => ({ ...s, [slot]: "analyse…" }));
    try {
      const p = await preparePhoto(raw);
      setUrls((u) => ({ ...u, [slot]: p.url }));
      setTints((t) => ({ ...t, [slot]: p.meanColor }));
      setStatus((s) => ({
        ...s,
        [slot]: p.detected
          ? `✓ ${p.isProfile ? "profil" : "visage"} détecté`
          : "aucun visage — photo brute",
      }));
    } catch (err) {
      setUrls((u) => ({ ...u, [slot]: raw }));
      setStatus((s) => ({ ...s, [slot]: "erreur détection" }));
      console.error(err);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#eaeaea", position: "relative" }}>
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 20, zIndex: 10 }}>
        <Slot label="Face" url={urls.front} status={status.front} onPick={pick("front")} />
        <Slot label="Profil gauche" url={urls.left} status={status.left} onPick={pick("left")} />
        <Slot label="Profil droit" url={urls.right} status={status.right} onPick={pick("right")} />
      </div>
      <div style={{ position: "absolute", inset: 0 }} onPointerDown={(e) => (drag.current = { x: e.clientX })}>
        <Canvas camera={{ fov: 20, position: [0, 1.92, 1.15] }} onCreated={({ camera }) => camera.lookAt(0, 1.9, 0.15)}>
          <hemisphereLight args={["#ffffff", "#b9c0cc", 1.1]} />
          <directionalLight position={[2, 3, 4]} intensity={1.4} />
          <Suspense fallback={null}>
            <Head urls={urls} tints={tints} rot={rot} />
          </Suspense>
        </Canvas>
      </div>
      <p style={{ position: "absolute", bottom: 20, width: "100%", textAlign: "center", fontSize: 12, color: "#666" }}>
        Glisse pour tourner · importe 3 photos pour tester
      </p>
    </div>
  );
}
