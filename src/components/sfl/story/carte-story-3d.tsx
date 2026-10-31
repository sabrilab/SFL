"use client";

// Ta vraie carte 3D dans la story (Sabri, 31/10 : « accroît drastiquement le
// livrable ») : la même que Ma carte (CardMesh, card-3d-canvas.tsx : son
// épaisseur, sa tranche, sa matière, son vrai dos), filmée par une vraie
// caméra. La grue part en bas, en contre-plongée, et monte se mettre de face
// pendant que la carte arrive au-dessus d'elle en faisant un tour.
//
// Le canvas WebGL ne tourne jamais tout seul (frameloop « never ») : chaque
// image de la story le fait avancer d'un pas puis le recopie dans la story
// (lib/sfl/story-dimanche.ts, `carte3d`). Pendant que la carte tourne vite,
// trois à six instants sont moyennés : un flou de mouvement d'obturateur de cinéma.

import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { CardMesh, type PoseCarte } from "@/components/sfl/card-3d-canvas";
import type { CapturedLayers } from "@/components/sfl/card-3d";
import { CARTE_STORY, STORY, type Carte3DStory, type MouvementCarte } from "@/lib/sfl/story-dimanche";

/** La caméra posée : celle de la carte de l'app. */
const FOV = 28;
const DISTANCE = 3.4;
/** Pixels de la story par unité monde, au plan de la carte posée. */
const PAR_UNITE = STORY.hauteur / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * DISTANCE);

function Pilote({ calques, onPret }: { calques: CapturedLayers; onPret: (f: Carte3DStory) => void }) {
  const { gl, camera, advance } = useThree();
  const pose = useRef<PoseCarte>({ x: 0, y: 0, scale: 1 });
  const groupe = useRef<THREE.Group>(null);
  const largeur = CARTE_STORY.largeur / PAR_UNITE;
  const hauteur = largeur * (calques.height / calques.width);
  const cadre = useMemo(() => ({ largeur, hauteur }), [largeur, hauteur]);
  // La carte posée : son centre à la place prévue dans la story.
  const yPosee = (STORY.hauteur / 2 - (CARTE_STORY.haut + (CARTE_STORY.largeur * calques.height) / calques.width / 2)) / PAR_UNITE;
  const accu = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = STORY.largeur;
    c.height = STORY.hauteur;
    return c;
  }, []);
  const temps = useRef(0);

  const placer = useCallback(
    (m: MouvementCarte) => {
      const cam = camera as THREE.PerspectiveCamera;
      // La grue : basse, proche et levée vers la carte au départ ; de face à la fin.
      cam.position.set(0, -0.95 * m.bas, DISTANCE * (1 - 0.22 * m.bas));
      cam.lookAt(0, m.bas * (yPosee + 0.25), 0);
      const g = groupe.current;
      if (g) {
        g.position.set(0, yPosee + m.montee * 0.32, 0);
        g.rotation.z = m.montee * -0.14;
      }
      pose.current.x = m.montee * 0.3;
      pose.current.y = -m.angle;
      pose.current.scale = 1;
    },
    [camera, yPosee],
  );

  const rendre = useCallback<Carte3DStory>(
    (m, avant) => {
      const ctx = accu.getContext("2d")!;
      ctx.clearRect(0, 0, accu.width, accu.height);
      // Le flou de mouvement : seulement quand la carte tourne vite.
      const vitesse = avant ? Math.abs(m.angle - avant.angle) + Math.abs(m.bas - avant.bas) * 2 : 0;
      const n = vitesse > 0.15 ? 6 : vitesse > 0.04 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const k = n === 1 ? 1 : (i + 1) / n;
        const mix = (a: number, b: number) => b + (a - b) * k;
        placer(
          avant && n > 1
            ? { bas: mix(m.bas, avant.bas), montee: mix(m.montee, avant.montee), angle: mix(m.angle, avant.angle) }
            : m,
        );
        temps.current += 1 / STORY.ips / n;
        advance(temps.current * 1000);
        ctx.globalAlpha = 1 / (i + 1);
        ctx.drawImage(gl.domElement, 0, 0, accu.width, accu.height);
      }
      ctx.globalAlpha = 1;
      return accu;
    },
    [accu, advance, gl, placer],
  );

  // Tant que les calques ne sont pas chargés, le plateau avance de lui-même
  // (CardMesh dit « affichée » dans son useFrame, à la première image complète).
  const affichee = useRef(false);
  useEffect(() => {
    placer({ bas: 1, montee: 1, angle: 0 });
    const id = setInterval(() => {
      if (affichee.current) clearInterval(id);
      else advance(performance.now());
    }, 120);
    return () => clearInterval(id);
  }, [placer, advance]);

  return (
    <group ref={groupe}>
      <CardMesh
        background={calques.background}
        playerLayer={calques.playerLayer}
        stats={calques.stats}
        dos={calques.dos}
        matiere={calques.matiere}
        mode="simple"
        holo={false}
        interactive={false}
        posee
        pose={pose}
        cadre={cadre}
        onAffichee={() => {
          affichee.current = true;
          onPret(rendre);
        }}
      />
    </group>
  );
}

/** Le plateau 3D, invisible : la story le fait avancer et le recopie. */
export function CarteStory3D({ calques, onPret }: { calques: CapturedLayers; onPret: (f: Carte3DStory) => void }) {
  const pret = useRef(false);
  const une = useCallback(
    (f: Carte3DStory) => {
      if (pret.current) return;
      pret.current = true;
      onPret(f);
    },
    [onPret],
  );
  return (
    <div aria-hidden className="pointer-events-none fixed top-0 left-[-20000px]" style={{ width: STORY.largeur, height: STORY.hauteur }}>
      <Canvas
        dpr={1}
        frameloop="never"
        camera={{ position: [0, 0, DISTANCE], fov: FOV }}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        style={{ width: STORY.largeur, height: STORY.hauteur }}
      >
        <Pilote calques={calques} onPret={une} />
      </Canvas>
    </div>
  );
}
