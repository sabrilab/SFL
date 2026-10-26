"use client";

// Les pépites d'or qui flottent autour du podium de la Pépite d'Or, dans les
// Actus (Sabri, 26/10 : « le délire des pépites d'or […] il ne faut pas le
// perdre de vue », « des pépites qui flottent autour […] en géométrie »).
//
// De vraies pépites de métal brut, les mêmes que celle du badge (objets.ts,
// pepiteVariante : d'autres lobes, la même rivière), dans le studio du
// joaillier (rendu.ts). Elles tournent lentement sur des orbites tracées à
// l'encre d'un trait fin, comme une gravure : deux grands anneaux inclinés
// autour du podium, et une couronne à plat au-dessus du premier. Le trait
// s'éclaircit à l'arrière de l'anneau ; les pépites de l'arrière sont plus
// petites. À l'ouverture, elles partent du premier et gagnent leur orbite.
// Pas d'étincelles ni de rayons : le métal et la géométrie suffisent.
//
// La toile est derrière les cartes : une pépite qui passe derrière une
// carte disparaît, rien ne couvre jamais une carte ni un nom. Une seule
// toile, une caméra orthographique en pixels CSS (1 unité = 1 px), centrée
// sur le centre de la carte du premier, que mesure le podium (course.tsx).
// La caméra ne bouge jamais. En mouvement réduit : une seule image, les
// pépites posées. Hors de l'écran ou l'app en arrière-plan : plus de rendu.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { pepiteVariante } from "@/lib/sfl/badges-3d/objets";
import { eclat, environnement, liberer, matiereBrute, regler, teinteStudio } from "@/lib/sfl/badges-3d/rendu";

const PHI = (1 + Math.sqrt(5)) / 2;

/** Le centre de la carte du premier, en px depuis le coin haut gauche de la boîte, et la moitié de sa hauteur. */
export interface Repere {
  x: number;
  y: number;
  demiHauteur: number;
}

/**
 * Une orbite : son rayon (fraction du rayon de base), son inclinaison
 * (autour de l'horizontale : 0 de face, π/2 vue par la tranche), son roulis,
 * son décalage vertical (fraction de la demi-hauteur de la carte du
 * premier, vers le bas), sa période en secondes (signe = sens) et la taille de ses
 * pépites (fraction de la plus grande). Les rayons, les périodes et les
 * tailles vont par le nombre d'or.
 */
interface Orbite {
  r: number;
  inclinaison: number;
  roulis: number;
  dy: number;
  periode: number;
  tailles: number[];
}

const ORBITES: Orbite[] = [
  { r: 1, inclinaison: 1.3, roulis: 0.3, dy: 0.1, periode: 56, tailles: [1, 1 / PHI ** 2, 1 / PHI, 1 / PHI ** 2, 1, 1 / PHI ** 2, 1 / PHI] },
  { r: 1 / Math.sqrt(PHI), inclinaison: 1.22, roulis: -0.42, dy: 0.05, periode: -56 * PHI, tailles: [1 / PHI, 1 / PHI ** 2, 1, 1 / PHI ** 2, 1 / PHI] },
  // La couronne, à plat au-dessus du premier.
  { r: 1 / PHI, inclinaison: 1.4, roulis: 0.02, dy: -1.32, periode: 56 / PHI, tailles: [1 / PHI ** 2, 1 / PHI, 1 / PHI ** 2, 1 / PHI, 1 / PHI ** 2] },
];

/** La demi-largeur de la plus grande pépite, en px (avant la profondeur). */
const PEPITE = 18;

function matrice(o: Orbite): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationZ(o.roulis).multiply(new THREE.Matrix4().makeRotationX(o.inclinaison));
}

/** Les trois anneaux, d'un trait d'encre, plus clairs à l'arrière. */
function Anneaux({ rayon, encre, centre, demiHauteur }: { rayon: number; encre: THREE.Color; centre: THREE.Vector2; demiHauteur: number }) {
  const lignes = useMemo(
    () =>
      ORBITES.map((o) => {
        const m = matrice(o);
        const n = 160;
        const pos = new Float32Array((n + 1) * 3);
        const col = new Float32Array((n + 1) * 4);
        const p = new THREE.Vector3();
        for (let i = 0; i <= n; i++) {
          const t = (i / n) * Math.PI * 2;
          p.set(Math.cos(t) * rayon * o.r, Math.sin(t) * rayon * o.r, 0).applyMatrix4(m);
          pos.set([p.x, p.y, p.z], i * 3);
          // Devant (z > 0) le trait est franc, derrière il s'efface.
          const devant = p.z / (rayon * o.r);
          col.set([encre.r, encre.g, encre.b, 0.1 + 0.08 * devant], i * 4);
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("color", new THREE.BufferAttribute(col, 4));
        const l = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
        l.position.set(0, -o.dy * demiHauteur, 0);
        return { l };
      }),
    [rayon, encre, demiHauteur],
  );
  useEffect(
    () => () => {
      for (const { l } of lignes) {
        l.geometry.dispose();
        (l.material as THREE.Material).dispose();
      }
    },
    [lignes],
  );
  return (
    <group position={[centre.x, centre.y, 0]}>
      {lignes.map(({ l }, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  );
}

function Pepites({ repere, anime }: { repere: Repere; anime: boolean }) {
  const { gl, size, invalidate } = useThree();
  const env = useMemo(() => environnement(gl, teinteStudio("pepite", "or")), [gl]);
  useEffect(() => () => liberer(env), [env]);
  const matiere = useMemo(() => matiereBrute("or", env), [env]);
  // Le rayon de base : le podium, sans déborder d'un grand écran.
  const rayon = Math.min(size.width / 2 - PEPITE * 1.4, 220);
  const centre = useMemo(() => new THREE.Vector2(repere.x - size.width / 2, size.height / 2 - repere.y), [repere, size]);
  const encre = useMemo(() => {
    const c = getComputedStyle(gl.domElement).color;
    return new THREE.Color(c || "#ffffff");
  }, [gl]);
  // Chaque pépite : son orbite, sa place sur l'anneau, sa forme, son axe et sa vitesse de rotation propre.
  const pepites = useMemo(
    () =>
      ORBITES.flatMap((o, k) =>
        o.tailles.map((taille, i) => {
          const graine = k * 11 + i * 3 + 1;
          const axe = new THREE.Vector3(Math.sin(graine * 1.7), Math.cos(graine * 2.3), Math.sin(graine * 0.9)).normalize();
          return {
            o,
            m: matrice(o),
            phase: (i / o.tailles.length) * Math.PI * 2 + k * 0.7,
            taille,
            geo: pepiteVariante(graine),
            axe,
            tour: 0.12 + 0.1 * ((graine * 0.618) % 1),
            depart: new THREE.Quaternion().setFromEuler(new THREE.Euler(graine, graine * 0.5, graine * 0.25)),
          };
        }),
      ),
    [],
  );
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const debut = useRef<number | null>(null);
  const p = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (debut.current == null) debut.current = t;
    // L'éclosion : les pépites partent du premier et gagnent leur orbite (1,6 s).
    const e = anime ? Math.min(1, (t - debut.current) / 1.6) : 1;
    const ouvert = 1 - (1 - e) ** 3;
    pepites.forEach((pe, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const a = pe.phase + (anime ? (t / pe.o.periode) * Math.PI * 2 : 0);
      const r = rayon * pe.o.r * (0.25 + 0.75 * ouvert);
      p.set(Math.cos(a) * r, Math.sin(a) * r, 0).applyMatrix4(pe.m);
      const profondeur = p.z / (rayon * pe.o.r);
      // Une respiration lente, à peine : la pépite flotte sur son anneau.
      const flotte = anime ? Math.sin(t * 0.6 + pe.phase * 3) * 2 : 0;
      mesh.position.set(centre.x + p.x, centre.y + p.y - pe.o.dy * repere.demiHauteur + flotte, p.z);
      const s = PEPITE * pe.taille * (1 + 0.22 * profondeur) * (0.4 + 0.6 * ouvert);
      mesh.scale.setScalar(s / 0.95);
      q.setFromAxisAngle(pe.axe, anime ? t * pe.tour : 0);
      mesh.quaternion.copy(pe.depart).multiply(q);
    });
  });
  useEffect(() => invalidate(), [repere, size, invalidate]);
  const lumiere = useMemo(() => eclat(), []);
  return (
    <>
      <primitive object={lumiere} />
      <Anneaux rayon={rayon} encre={encre} centre={centre} demiHauteur={repere.demiHauteur} />
      {pepites.map((pe, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          geometry={pe.geo}
          material={matiere}
        />
      ))}
    </>
  );
}

/** La toile des pépites, derrière le podium : `repere` dit où est la carte du premier. */
export function PepitesFlottantes({ repere, className }: { repere: Repere; className?: string }) {
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
    <div ref={boite} aria-hidden className={className}>
      <Canvas
        orthographic
        dpr={[1, 2]}
        frameloop={reduit ? "demand" : anime ? "always" : "never"}
        camera={{ zoom: 1, position: [0, 0, 600], near: 1, far: 1200 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => regler(gl)}
        className="text-foreground"
        style={{ pointerEvents: "none" }}
      >
        <Pepites repere={repere} anime={!reduit} />
      </Canvas>
    </div>
  );
}
