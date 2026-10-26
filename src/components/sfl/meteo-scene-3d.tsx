"use client";

// La petite scène 3D de la météo d'un match : le coin du terrain, son
// drapeau de corner, le but au loin, et le ciel derrière, qui montrent le
// temps du coup d'envoi (Sabri, 26/10 : « un terrain en 3D sur le coin […]
// et derrière, le ciel […] ce qu'il fera sur le terrain, s'il pleut, s'il
// vente, s'il est ensoleillé »). Les réglages viennent de lib/sfl/meteo-scene.ts.
//
// Ce qu'on voit :
//   · la pelouse tondue en bandes, ses lignes à la craie, l'arc de corner ;
//     mouillée, elle fonce et brille ;
//   · le drapeau de corner, qui pend par temps calme et bat d'autant plus
//     vite que le vent forcit, tourné vers où il souffle ;
//   · le ciel en dégradé, le soleil (ou la lune) d'autant plus voilé que le
//     ciel est couvert, des nuages qui filent avec le vent ;
//   · la pluie en traits penchés par le vent, la neige en flocons, la brume
//     qui rapproche l'horizon, l'éclair de l'orage, les traînées des
//     rafales fortes.
//
// La caméra ne bouge jamais (aucun tremblement) : seul le temps est animé.
// En mouvement réduit, une seule image, sans rien qui bouge. Hors de l'écran
// ou l'app en arrière-plan, plus aucun rendu.

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { forceDuVent, type Ambiance } from "@/lib/sfl/meteo-scene";

// Le coin du terrain est à l'origine, le terrain du côté des x et z négatifs
// (40 × 25 m, le but au milieu de la ligne de but x = 0), le nord vers -z.
// La caméra, à hauteur d'homme accroupi derrière la ligne de touche, regarde
// le long de la ligne de but : le drapeau au tiers droit, le but au fond,
// l'horizon un peu sous le milieu, le ciel au-dessus.
const CAMERA = { position: [-1.6, 0.7, 3.4] as const, cible: [-1.8, 1.15, -6] as const, fov: 34 };
/** Le soleil qu'on voit, haut à gauche dans le cadre ; la lumière qui éclaire vient de derrière l'épaule gauche. */
const SOLEIL = new THREE.Vector3(-20, 13, -42);
const LUMIERE = new THREE.Vector3(-10, 14, 12);
/** La boîte où tombent la pluie et la neige, devant la caméra. */
const BOITE = { centre: [-1.8, -1.6] as const, demi: 6.5, haut: 6 };

/** Un tirage pseudo-aléatoire fixe (les mêmes nuages, les mêmes gouttes à chaque ouverture). */
function tirage(graine: number): () => number {
  let s = graine;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Ramène une coordonnée dans la boîte (sortie d'un côté, retour de l'autre). */
function dansLaBoite(v: number, centre: number): number {
  const d = BOITE.demi * 2;
  return centre - BOITE.demi + ((((v - centre + BOITE.demi) % d) + d) % d);
}

/** Vers où souffle le vent, dans le plan du sol (x vers l'est, z vers le sud). */
function sousLeVent(a: Ambiance): [number, number] {
  return [Math.sin(a.versOu), -Math.cos(a.versOu)];
}

function texture(dessin: (c: CanvasRenderingContext2D, n: number) => void, n = 128): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const c = canvas.getContext("2d")!;
  dessin(c, n);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Une lueur ronde (soleil, lune, flocon). */
const lueur = () =>
  texture((c, n) => {
    const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(255,255,255,0.95)");
    g.addColorStop(0.32, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, n, n);
  });

/** Un nuage : des boules floues serrées, plus denses au ventre. */
const bouffee = (graine: number) =>
  texture((c, n) => {
    const hasard = tirage(graine);
    for (let i = 0; i < 14; i++) {
      const x = n * (0.2 + hasard() * 0.6);
      const y = n * (0.42 + hasard() * 0.22);
      const r = n * (0.12 + hasard() * 0.16);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, n, n);
    }
  }, 256);

/** La pelouse : deux bandes de tonte et un grain fin, répétées sur tout le sol. */
function pelouseTexture(a: Ambiance): THREE.CanvasTexture {
  const t = texture((c, n) => {
    a.pelouse.forEach((teinte, i) => {
      c.fillStyle = teinte;
      c.fillRect((i * n) / 2, 0, n / 2, n);
    });
    const hasard = tirage(7);
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = hasard() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
      c.fillRect(hasard() * n, hasard() * n, 1.5, 1.5);
    }
  }, 512);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // Une bande de tonte fait 5 m : la texture (deux bandes) couvre 10 m.
  t.repeat.set(40, 40);
  t.anisotropy = 8;
  return t;
}

function Camera() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(...CAMERA.cible);
  }, [camera]);
  return null;
}

/** Le ciel : un dôme en dégradé, qui blanchit le temps d'un éclair. */
function Ciel({ a, eclairRef }: { a: Ambiance; eclairRef: RefObject<number> }) {
  const uniforms = useMemo(
    () => ({
      zenith: { value: new THREE.Color(a.zenith) },
      horizon: { value: new THREE.Color(a.horizon) },
      flash: { value: 0 },
    }),
    [a.zenith, a.horizon],
  );
  const matiere = useRef<THREE.ShaderMaterial>(null);
  useFrame(() => {
    if (matiere.current) matiere.current.uniforms.flash.value = eclairRef.current;
  });
  return (
    <mesh renderOrder={-1}>
      <sphereGeometry args={[80, 24, 12]} />
      <shaderMaterial
        ref={matiere}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        uniforms={uniforms}
        vertexShader={`varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`uniform vec3 zenith; uniform vec3 horizon; uniform float flash; varying vec3 vDir;
          void main(){ float h = max(vDir.y, 0.0); vec3 c = mix(horizon, zenith, smoothstep(0.0, 0.6, h));
          c += flash * vec3(0.55, 0.58, 0.66); gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
          }`}
      />
    </mesh>
  );
}

/** Le soleil ou la lune, voilés par la couverture. */
function Astre({ a }: { a: Ambiance }) {
  const t = useMemo(() => lueur(), []);
  const visible = a.nuit ? Math.max(0, 1 - a.couverture * 1.1) : Math.pow(Math.max(0, 1 - a.couverture), 1.2);
  if (visible < 0.04) return null;
  const p = SOLEIL;
  return (
    <group position={[p.x, p.y, p.z]}>
      <sprite scale={a.nuit ? 3.2 : 9}>
        <spriteMaterial map={t} transparent depthWrite={false} fog={false} opacity={visible} color={a.nuit ? "#DADDE2" : "#FFF8EC"} blending={THREE.AdditiveBlending} />
      </sprite>
      {!a.nuit && (
        <sprite scale={34}>
          <spriteMaterial map={t} transparent depthWrite={false} fog={false} opacity={visible * 0.18} color="#FFF4E2" blending={THREE.AdditiveBlending} />
        </sprite>
      )}
    </group>
  );
}

/** Les nuages, loin derrière le terrain, qui filent sous le vent. */
function Nuages({ a, anime }: { a: Ambiance; anime: boolean }) {
  const n = Math.round(1 + a.couverture * 10);
  const textures = useMemo(() => [11, 23, 47].map(bouffee), []);
  const groupe = useRef<THREE.Group>(null);
  const [vx, vz] = sousLeVent(a);
  const vitesse = 0.4 + forceDuVent(a) * 2.6;
  const nuages = useMemo(() => {
    const hasard = tirage(3);
    return Array.from({ length: n }, (_, i) => {
      // Sur un arc devant la caméra, de gauche à droite du cadre.
      const angle = -0.75 + (i / Math.max(1, n - 1)) * 1.5 + (hasard() - 0.5) * 0.25;
      const r = 40 + hasard() * 14;
      return {
        x: Math.sin(angle) * r,
        z: -Math.cos(angle) * r,
        y: 7 + hasard() * 9,
        largeur: 14 + hasard() * 12,
        hauteur: 5 + hasard() * 4,
        texture: textures[i % 3],
      };
    });
  }, [n, textures]);
  const gris = new THREE.Color(a.nuit ? "#3B4049" : "#FFFFFF").lerp(new THREE.Color(a.nuit ? "#20242B" : "#6E767C"), Math.min(1, a.pluie * 1.2 + (a.orage ? 0.5 : 0) + a.couverture * 0.25));
  useFrame((_, dt) => {
    if (!anime || !groupe.current) return;
    for (const s of groupe.current.children) {
      s.position.x += vx * vitesse * dt;
      s.position.z += vz * vitesse * dt;
      // Sortie d'un côté, retour de l'autre (hors du cadre, sur 70 m).
      const le = s.position.x * vx + (s.position.z + 45) * vz;
      if (le > 35) {
        s.position.x -= vx * 70;
        s.position.z -= vz * 70;
      }
    }
  });
  return (
    <group ref={groupe}>
      {nuages.map((c, i) => (
        <sprite key={i} position={[c.x, c.y, c.z]} scale={[c.largeur, c.hauteur, 1]}>
          <spriteMaterial map={c.texture} transparent depthWrite={false} fog={false} color={gris} opacity={0.5 + a.couverture * 0.45} />
        </sprite>
      ))}
    </group>
  );
}

/** La pelouse, ses lignes à la craie et l'arc de corner. */
function Terrain({ a }: { a: Ambiance }) {
  const t = useMemo(() => pelouseTexture(a), [a]);
  const craie = <meshLambertMaterial color={a.nuit ? "#9EA39C" : "#EEEEE6"} polygonOffset polygonOffsetFactor={-2} />;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial map={t} roughness={a.mouille ? 0.6 : 0.95} metalness={0} />
      </mesh>
      {/* La ligne de touche (le long de x) et la ligne de but (le long de z), 12 cm de large. */}
      <mesh rotation-x={-Math.PI / 2} position={[-30, 0.004, -0.06]}>
        <planeGeometry args={[60, 0.12]} />
        {craie}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-0.06, 0.004, -20]}>
        <planeGeometry args={[0.12, 40]} />
        {craie}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
        <ringGeometry args={[0.94, 1.06, 24, 1, Math.PI / 2, Math.PI / 2]} />
        {craie}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-20, 0.004, -24.94]}>
        <planeGeometry args={[40, 0.12]} />
        {craie}
      </mesh>
      {/* La surface, au pied du but. */}
      <mesh rotation-x={-Math.PI / 2} position={[-5.5, 0.004, -12.5]}>
        <planeGeometry args={[0.12, 12]} />
        {craie}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-2.75, 0.004, -6.56]}>
        <planeGeometry args={[5.6, 0.12]} />
        {craie}
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-2.75, 0.004, -18.44]}>
        <planeGeometry args={[5.6, 0.12]} />
        {craie}
      </mesh>
    </group>
  );
}

/** Le but au loin, sur la ligne de but, et son filet. */
function But({ a }: { a: Ambiance }) {
  const blanc = <meshLambertMaterial color={a.nuit ? "#B9BCB6" : "#F4F4EF"} />;
  const filet = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p: number[] = [];
    // Le fond du filet, 1 m derrière la ligne, et ses côtés : un maillage de 25 cm.
    for (let z = -14; z <= -11.001; z += 0.25) p.push(1, 0, z, 1, 2, z);
    for (let y = 0; y <= 2.001; y += 0.25) p.push(1, y, -14, 1, y, -11);
    for (let x = 0; x <= 1.001; x += 0.25) p.push(x, 2, -14, x, 2, -11);
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    return g;
  }, []);
  return (
    <group>
      <mesh position={[0, 1, -11]}>
        <cylinderGeometry args={[0.05, 0.05, 2, 10]} />
        {blanc}
      </mesh>
      <mesh position={[0, 1, -14]}>
        <cylinderGeometry args={[0.05, 0.05, 2, 10]} />
        {blanc}
      </mesh>
      <mesh position={[0, 2, -12.5]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.05, 0.05, 3.1, 10]} />
        {blanc}
      </mesh>
      <lineSegments geometry={filet}>
        <lineBasicMaterial color={a.nuit ? "#8E928C" : "#E8E8E2"} transparent opacity={0.45} />
      </lineSegments>
    </group>
  );
}

/** Le drapeau de corner : il pend par temps calme, bat avec le vent, tourné vers où il souffle. */
function Drapeau({ a, anime }: { a: Ambiance; anime: boolean }) {
  const force = forceDuVent(a);
  const [vx, vz] = sousLeVent(a);
  const maille = useRef<THREE.Mesh>(null);
  const geometrie = useMemo(() => {
    const g = new THREE.PlaneGeometry(DRAPEAU.long, DRAPEAU.haut, 16, 6);
    g.translate(DRAPEAU.long / 2, -DRAPEAU.haut / 2, 0);
    return g;
  }, []);
  const repos = useMemo(() => Float32Array.from(geometrie.attributes.position.array), [geometrie]);
  useEffect(() => {
    if (maille.current) onduler(maille.current.geometry, repos, force, 0.6);
  }, [repos, force]);
  useFrame(({ clock }) => {
    if (anime && maille.current) onduler(maille.current.geometry, repos, force, clock.elapsedTime);
  });
  // Calme : le drapeau tombe le long du mât ; tempête : à l'horizontale.
  const tombe = 0.1 + (1 - force) * 1.25;
  return (
    <group>
      {/* Le mât, 1,5 m, blanc à bagues d'encre. */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[0, 0.15 + i * 0.3, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.3, 8]} />
          <meshLambertMaterial color={i % 2 ? "#1A1A1A" : "#F4F4EF"} />
        </mesh>
      ))}
      <group position={[0, 1.5, 0]} rotation-y={Math.atan2(-vz, vx)}>
        <group rotation-z={-tombe}>
          <mesh ref={maille} geometry={geometrie}>
            <meshLambertMaterial color={a.nuit ? "#C9CBC6" : "#F2EFE7"} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

const DRAPEAU = { long: 0.44, haut: 0.3 };

/** Fait onduler le drapeau : la vague part du mât, plus ample et plus rapide avec le vent. */
function onduler(g: THREE.BufferGeometry, repos: Float32Array, force: number, t: number) {
  const pos = g.attributes.position as THREE.BufferAttribute;
  const w = 3.5 + force * 13;
  const amp = 0.025 + force * 0.06;
  for (let i = 0; i < pos.count; i++) {
    const x = repos[i * 3];
    const y = repos[i * 3 + 1];
    const k = x / DRAPEAU.long;
    pos.setZ(i, Math.sin(x * 15 - t * w + y * 2) * amp * k + Math.sin(x * 7 - t * w * 0.6) * amp * 0.5 * k);
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
}

/** Des points tirés au hasard dans la boîte de pluie, à leur place de départ. */
function dansLaBoiteAuHasard(n: number, graine: number): Float32Array {
  const hasard = tirage(graine);
  return Float32Array.from({ length: n * 3 }, (_, i) =>
    i % 3 === 1 ? hasard() * BOITE.haut : BOITE.centre[i % 3 === 0 ? 0 : 1] + (hasard() * 2 - 1) * BOITE.demi,
  );
}

const hauteur = (y: number) => ((y % BOITE.haut) + BOITE.haut) % BOITE.haut;

/** Une averse : des traits qui tombent, penchés par le vent. Chaque goutte se déduit du temps : rien à garder d'une image à l'autre. */
function Pluie({ a, anime }: { a: Ambiance; anime: boolean }) {
  const n = Math.round(150 + a.pluie * 900);
  const [vx, vz] = sousLeVent(a);
  const derive = (a.vent / 3.6) * 0.55;
  const v = useMemo(() => new THREE.Vector3(vx * derive, a.pluie < 0.3 ? -5 : -9, vz * derive), [vx, vz, derive, a.pluie]);
  const trace = a.pluie < 0.3 ? 0.03 : 0.045;
  const depart = useMemo(() => dansLaBoiteAuHasard(n, 5), [n]);
  const geometrie = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    return g;
  }, [n]);
  const traits = useRef<THREE.LineSegments>(null);
  const poser = (t: number) => {
    const g = traits.current?.geometry;
    if (!g) return;
    const p = g.attributes.position.array as Float32Array;
    const [cx, cz] = BOITE.centre;
    for (let i = 0; i < n; i++) {
      const x = dansLaBoite(depart[i * 3] + v.x * t, cx);
      const y = hauteur(depart[i * 3 + 1] + v.y * t);
      const z = dansLaBoite(depart[i * 3 + 2] + v.z * t, cz);
      p.set([x, y, z, x - v.x * trace, y - v.y * trace, z - v.z * trace], i * 6);
    }
    g.attributes.position.needsUpdate = true;
  };
  useEffect(() => poser(0));
  useFrame(({ clock }) => {
    if (anime) poser(clock.elapsedTime);
  });
  return (
    <lineSegments ref={traits} geometry={geometrie} frustumCulled={false}>
      <lineBasicMaterial color={a.nuit ? "#9BA3AD" : "#EEF1F2"} transparent opacity={a.nuit ? 0.35 : a.pluie < 0.3 ? 0.35 : 0.5} depthWrite={false} />
    </lineSegments>
  );
}

/** La neige : des flocons qui tombent lentement en se balançant. */
function Neige({ a, anime }: { a: Ambiance; anime: boolean }) {
  const n = Math.round(200 + a.neige * 500);
  const t = useMemo(() => lueur(), []);
  const [vx, vz] = sousLeVent(a);
  const derive = (a.vent / 3.6) * 0.3;
  const depart = useMemo(() => dansLaBoiteAuHasard(n, 9), [n]);
  const geometrie = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(depart.slice(), 3));
    return g;
  }, [depart]);
  const flocons = useRef<THREE.Points>(null);
  useFrame(({ clock }) => {
    const g = flocons.current?.geometry;
    if (!anime || !g) return;
    const p = g.attributes.position.array as Float32Array;
    const tt = clock.elapsedTime;
    const [cx, cz] = BOITE.centre;
    for (let i = 0; i < n; i++) {
      p[i * 3] = dansLaBoite(depart[i * 3] + tt * derive * vx, cx) + Math.sin(tt * 1.3 + i) * 0.25;
      p[i * 3 + 1] = hauteur(depart[i * 3 + 1] - 0.9 * tt);
      p[i * 3 + 2] = dansLaBoite(depart[i * 3 + 2] + tt * derive * vz, cz);
    }
    g.attributes.position.needsUpdate = true;
  });
  return (
    <points ref={flocons} geometry={geometrie} frustumCulled={false}>
      <pointsMaterial map={t} size={0.16} sizeAttenuation transparent depthWrite={false} color="#FFFFFF" opacity={0.9} />
    </points>
  );
}

/** Les rafales : de longues traînées pâles qui filent au ras du terrain. */
function Rafales({ a, anime }: { a: Ambiance; anime: boolean }) {
  const force = forceDuVent(a);
  const n = Math.round(force * 16);
  const [vx, vz] = sousLeVent(a);
  const vitesse = 9 + force * 18;
  const traines = useMemo(() => {
    const hasard = tirage(13);
    return Array.from({ length: n }, () => ({
      // Position le long du vent, de travers, hauteur, longueur.
      le: (hasard() * 2 - 1) * 12,
      travers: (hasard() * 2 - 1) * 6,
      y: 0.3 + hasard() * 2.6,
      long: 1.2 + hasard() * 1.6,
    }));
  }, [n]);
  const geometrie = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    // La queue transparente, la tête visible.
    g.setAttribute("color", new THREE.BufferAttribute(Float32Array.from({ length: n * 8 }, (_, i) => (i % 8 === 3 ? 0 : i % 8 === 7 ? 0.4 : 1)), 4));
    return g;
  }, [n]);
  const lignes = useRef<THREE.LineSegments>(null);
  const poser = (t: number) => {
    const g = lignes.current?.geometry;
    if (!g) return;
    const p = g.attributes.position.array as Float32Array;
    const [cx, cz] = BOITE.centre;
    traines.forEach((r, i) => {
      const le = ((((r.le + vitesse * t + 12) % 24) + 24) % 24) - 12;
      const hx = cx + vx * le - vz * r.travers;
      const hz = cz + vz * le + vx * r.travers;
      p.set([hx - vx * r.long, r.y, hz - vz * r.long, hx, r.y, hz], i * 6);
    });
    g.attributes.position.needsUpdate = true;
  };
  useEffect(() => poser(0));
  useFrame(({ clock }) => {
    if (anime) poser(clock.elapsedTime);
  });
  if (!n) return null;
  return (
    <lineSegments ref={lignes} geometry={geometrie} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent depthWrite={false} />
    </lineSegments>
  );
}

/** Les lumières, la brume, et l'éclair de l'orage. */
function Lumieres({ a, anime, eclairRef }: { a: Ambiance; anime: boolean; eclairRef: RefObject<number> }) {
  const hemi = useRef<THREE.HemisphereLight>(null);
  const prochain = useRef(1.5);
  const base = a.nuit ? 0.55 : 0.75 + a.lumiere * 0.35;
  useFrame((_, dt) => {
    if (!a.orage || !anime) return;
    prochain.current -= dt;
    if (prochain.current < 0) {
      eclairRef.current = 1;
      prochain.current = 3.5 + Math.random() * 4;
    }
    eclairRef.current = Math.max(0, eclairRef.current - dt * 4);
    if (hemi.current) hemi.current.intensity = base + eclairRef.current * 2.2;
  });
  return (
    <>
      <fog attach="fog" args={[a.horizon, 6 + (1 - a.brume) * 22, 30 + (1 - a.brume) * 90]} />
      <hemisphereLight ref={hemi} args={[a.nuit ? "#5A6478" : a.zenith, a.pelouse[0], base]} />
      {a.nuit ? (
        // Les projecteurs du terrain, la nuit : une lumière froide, du haut.
        <directionalLight position={[4, 12, 6]} intensity={0.9} color="#DDE6F0" />
      ) : (
        <directionalLight position={[LUMIERE.x, LUMIERE.y, LUMIERE.z]} intensity={0.4 + a.lumiere * 1.9} color="#FFF6E8" />
      )}
    </>
  );
}

/** Autour du terrain : les filets pare-ballons sur leurs poteaux, puis une ligne d'arbres au loin. */
function Abords({ a }: { a: Ambiance }) {
  const poteaux = useMemo(() => {
    const p: [number, number][] = [];
    for (let x = -42; x <= 3; x += 3) p.push([x, -27]);
    for (let z = -27; z <= -15; z += 3) p.push([3, z]);
    return p;
  }, []);
  const cable = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-42, 3.9, -27, 3, 3.9, -27, 3, 3.9, -27, 3, 3.9, -15], 3));
    return g;
  }, []);
  const arbres = useMemo(() => {
    const hasard = tirage(21);
    return Array.from({ length: 110 }, (_, i) => {
      const angle = -1.25 + (i / 109) * 2.5 + (hasard() - 0.5) * 0.02;
      const r = 78 + hasard() * 18;
      return { x: Math.sin(angle) * r - 2, z: -Math.cos(angle) * r, h: 3.5 + hasard() * 4.5, l: 2 + hasard() * 2.6 };
    });
  }, []);
  const encre = a.nuit ? "#0E1210" : "#26302A";
  return (
    <group>
      {poteaux.map(([x, z], i) => (
        <mesh key={i} position={[x, 2, z]}>
          <cylinderGeometry args={[0.03, 0.03, 4, 6]} />
          <meshLambertMaterial color="#2B2E2D" />
        </mesh>
      ))}
      {/* Le câble qui tient le filet, en haut des poteaux. */}
      <lineSegments geometry={cable}>
        <lineBasicMaterial color="#2B2E2D" transparent opacity={0.7} />
      </lineSegments>
      {a.nuit && <Projecteurs />}
      {arbres.map((t, i) => (
        <mesh key={i} position={[t.x, t.h * 0.5, t.z]} scale={[t.l, t.h * 0.62, t.l]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshLambertMaterial color={encre} />
        </mesh>
      ))}
    </group>
  );
}

/** La nuit, les projecteurs du terrain, en haut des poteaux du fond. */
function Projecteurs() {
  const t = useMemo(() => lueur(), []);
  return (
    <group>
      {[-33, -9].map((x) => (
        <group key={x} position={[x, 7, -27]}>
          <mesh position={[0, -3.5, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 7, 6]} />
            <meshLambertMaterial color="#202322" />
          </mesh>
          <sprite scale={2.2}>
            <spriteMaterial map={t} transparent depthWrite={false} fog={false} color="#F4F7FA" blending={THREE.AdditiveBlending} />
          </sprite>
          <sprite scale={9}>
            <spriteMaterial map={t} transparent depthWrite={false} fog={false} opacity={0.25} color="#DDE6F0" blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}
    </group>
  );
}

function Scene({ a, anime }: { a: Ambiance; anime: boolean }) {
  const eclair = useRef(0);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [a, invalidate]);
  return (
    <>
      <Camera />
      <Ciel a={a} eclairRef={eclair} />
      <Astre a={a} />
      <Nuages a={a} anime={anime} />
      <Lumieres a={a} anime={anime} eclairRef={eclair} />
      <Terrain a={a} />
      <But a={a} />
      <Abords a={a} />
      <Drapeau a={a} anime={anime} />
      {a.pluie > 0 && <Pluie a={a} anime={anime} />}
      {a.neige > 0 && <Neige a={a} anime={anime} />}
      <Rafales a={a} anime={anime} />
    </>
  );
}

/** La scène, qui ne tourne que visible à l'écran (et jamais en mouvement réduit). */
export function SceneMeteo({ ambiance, className }: { ambiance: Ambiance; className?: string }) {
  const boite = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [premierPlan, setPremierPlan] = useState(true);
  const [reduit] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const el = boite.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
    const vis = () => setPremierPlan(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  const anime = !reduit && visible && premierPlan;
  return (
    <div ref={boite} className={className}>
      <Canvas
        flat
        dpr={[1, 2]}
        frameloop={reduit ? "demand" : anime ? "always" : "never"}
        camera={{ fov: CAMERA.fov, position: [...CAMERA.position], near: 0.05, far: 200 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        style={{ pointerEvents: "none" }}
      >
        <Scene a={ambiance} anime={anime} />
      </Canvas>
    </div>
  );
}
