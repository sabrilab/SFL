"use client";

// Les badges en 3D (direction de Sabri, 18/10 : « utilise du three.js pour
// les badges, avec l'univers de Bola : des ballons, des crampons, des
// trophées, des buts »). Chaque badge est un objet de foot en chrome irisé et
// en verre, qui dit ce qu'il récompense :
//   · Buts, Buteur → le ballon ;      · Passes, Passeur → le crampon ;
//   · Matchs → le terrain ;           · Victoires → le trophée ;
//   · Pépite d'Or → la pépite ;       · MVP → l'étoile ;
//   · Le Mur, Défenseur → le bouclier ; · Impact → l'éclair ;
//   · Cage inviolée → la cage ;       · Série → la flamme ;
//   · Ancienneté → le sablier.
// Le métal dit le niveau (bronze, argent, or ; rouge et or au dernier palier).
// Un badge de fin de saison porte en plus son rang, gravé sur une pastille de
// métal en bas à droite : c'est ce qui le distingue d'un palier.
//
// Objet3D est une image, faite une fois par le moteur partagé (rendu.ts) :
// on peut en mettre des dizaines à l'écran, et la carte 3D la photographie.
// Objet3DVivant est la vraie 3D, qui tourne et se fait tourner au doigt :
// seulement dans la feuille d'un badge, le temps qu'elle est ouverte.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { EMBLEMES, EMBLEMES_SAISON } from "@/components/sfl/emblemes";
import type { BadgeCarte } from "@/lib/sfl/badge-carte";
import type { Objet } from "@/lib/sfl/badges-3d/objets";
import { camera, construire, eclat, environnement, IMAGE_EVENT, imageBadge, liberer, regler, type Matiere } from "@/lib/sfl/badges-3d/rendu";
import { CLASSEMENTS, ordinal, type ClassementId } from "@/lib/sfl/fin-de-saison";
import { metal, NOM_METAL, TROPHEES, type Metal, type TropheeId } from "@/lib/sfl/trophees";

const ANTON = "var(--font-anton), Anton, sans-serif";

export const OBJET_PALIER: Record<TropheeId, Objet> = {
  buts: "ballon",
  passes: "crampon",
  matchs: "terrain",
  victoires: "trophee",
  mvp: "etoile",
  mur: "bouclier",
  impact: "eclair",
  cleanSheet: "cage",
  serie: "flamme",
  saisons: "sablier",
};

export const OBJET_SAISON: Record<ClassementId, Objet> = {
  pepite: "pepite",
  buteur: "ballon",
  passeur: "crampon",
  defenseur: "bouclier",
  mvp: "etoile",
};

const RANG_METAL: Record<number, Metal> = { 1: "or", 2: "argent", 3: "bronze" };

/** Le métal poli de la pastille du rang : un dégradé à deux éclats. */
const POLI: Record<Metal, string> = {
  bronze: "linear-gradient(140deg, #f0c09a 0%, #8f4f22 48%, #e2a77c 72%, #6a3815 100%)",
  argent: "linear-gradient(140deg, #ffffff 0%, #8f959d 48%, #e9ebee 72%, #6d737b 100%)",
  or: "linear-gradient(140deg, #f7e3a6 0%, #b8862b 48%, #f3d48a 72%, #8a6416 100%)",
  legende: "linear-gradient(140deg, #ff8f80 0%, #9a1712 48%, #e2493c 72%, #5a0806 100%)",
};

/** Le nom du badge, en toutes lettres (lecteur d'écran, feuille de choix). */
export function nomBadge(b: BadgeCarte): string {
  if (b.famille === "saison") return `${CLASSEMENTS.find((c) => c.id === b.id)!.nom}, ${ordinal(b.rang)}`;
  const m = metal(b.palier)!;
  return `${TROPHEES.find((t) => t.id === b.id)!.nom}, ${NOM_METAL[m]}`;
}

export function metalBadge(b: BadgeCarte): Metal {
  return b.famille === "saison" ? RANG_METAL[b.rang] : metal(b.palier)!;
}

export function objetBadge(b: BadgeCarte): Objet {
  return b.famille === "saison" ? OBJET_SAISON[b.id] : OBJET_PALIER[b.id];
}

function abonner(onChange: () => void) {
  window.addEventListener(IMAGE_EVENT, onChange);
  return () => window.removeEventListener(IMAGE_EVENT, onChange);
}

/** L'image d'un objet dans une matière, demandée au moteur partagé et suivie jusqu'à ce qu'elle soit prête. */
export function useImageBadge(objet: Objet, m: Matiere): string | null {
  return useSyncExternalStore(
    abonner,
    () => imageBadge(objet, m),
    () => null
  );
}

/** Un objet de badge, en image. Sans WebGL (ou le temps du premier rendu), son emblème le remplace. */
export function Objet3D({
  objet,
  matiere,
  taille,
  embleme: Embleme,
  ombre = true,
}: {
  objet: Objet;
  matiere: Matiere;
  taille: number;
  embleme: typeof EMBLEMES.buts;
  ombre?: boolean;
}) {
  const src = useImageBadge(objet, matiere);
  if (!src) {
    return (
      <span className="grid place-items-center" style={{ width: taille, height: taille }} aria-hidden>
        <Embleme style={{ width: taille * 0.5, height: taille * 0.5 }} strokeWidth={2} className="opacity-60" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      width={taille}
      height={taille}
      style={{
        display: "block",
        width: taille,
        height: taille,
        filter: ombre ? `drop-shadow(0 ${taille * 0.05}px ${taille * 0.07}px rgba(0,0,0,0.45))` : undefined,
      }}
    />
  );
}

/** La pastille du rang (fin de saison) : un rond de métal poli, le chiffre gravé. */
export function PastilleRang({ rang, taille }: { rang: number; taille: number }) {
  const m = RANG_METAL[rang];
  return (
    <span
      aria-hidden
      style={{
        display: "grid",
        placeItems: "center",
        width: taille,
        height: taille,
        borderRadius: "50%",
        background: POLI[m],
        boxShadow: `inset 0 0 0 ${Math.max(1, taille * 0.05)}px rgba(255,255,255,0.7), 0 ${taille * 0.08}px ${taille * 0.2}px rgba(0,0,0,0.4)`,
        fontFamily: ANTON,
        fontSize: taille * 0.62,
        lineHeight: 1,
        color: "#0b0c0e",
      }}
    >
      {rang}
    </span>
  );
}

/** Un badge gagné, en 3D : son objet dans son métal, et son rang s'il vient d'une fin de saison. */
export function Badge3D({ badge, largeur, socle = false }: { badge: BadgeCarte; largeur: number; socle?: boolean }) {
  const ecusson = badge.famille === "saison";
  const Embleme = ecusson ? EMBLEMES_SAISON[badge.id] : EMBLEMES[badge.id];
  return (
    <span role="img" aria-label={`Badge : ${nomBadge(badge)}`} className="relative block shrink-0" style={{ width: largeur, height: largeur }}>
      {socle && (
        // Sur la photo de la carte, un rond de verre fumé détache l'objet du
        // portrait, quel qu'il soit (html-to-image ne sait pas faire de flou
        // d'arrière-plan : le verre est peint).
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            background: "radial-gradient(circle at 50% 30%, rgba(60,62,74,0.55) 0%, rgba(10,10,14,0.72) 70%)",
            boxShadow: `inset 0 0 0 ${Math.max(0.6, largeur * 0.018)}px rgba(255,255,255,0.38), 0 ${largeur * 0.05}px ${largeur * 0.12}px rgba(0,0,0,0.35)`,
          }}
        />
      )}
      <span className="absolute" style={socle ? { inset: largeur * 0.06 } : { inset: 0 }}>
        <Objet3D objet={objetBadge(badge)} matiere={metalBadge(badge)} taille={socle ? largeur * 0.88 : largeur} embleme={Embleme} ombre={!socle} />
      </span>
      {ecusson && (
        <span className="absolute" style={{ right: -largeur * 0.04, bottom: -largeur * 0.02 }}>
          <PastilleRang rang={badge.rang} taille={largeur * 0.4} />
        </span>
      )}
    </span>
  );
}

/* ------------------------------ La 3D vivante ------------------------------ */

function mouvementReduit() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * L'objet en vraie 3D : il tourne doucement sur lui-même, et se fait tourner
 * au doigt (avec un peu d'élan). Son propre moteur WebGL, créé à l'ouverture
 * de la feuille et libéré à sa fermeture. Tant qu'il n'a pas rendu sa
 * première image, ou sans WebGL, l'image fixe tient sa place.
 */
export function Objet3DVivant({
  objet,
  matiere,
  taille,
  embleme,
}: {
  objet: Objet;
  matiere: Matiere;
  taille: number;
  embleme: typeof EMBLEMES.buts;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.setSize(taille, taille, false);
    regler(renderer);
    const env = environnement(renderer);
    const scene = new THREE.Scene();
    scene.add(eclat());
    const cam = camera();
    const objet3d = construire(objet, matiere, env);
    const pivot = new THREE.Group();
    pivot.add(objet3d);
    scene.add(pivot);

    const reduit = mouvementReduit();
    let vitesse = reduit ? 0 : 0.5; // rad/s
    const repos = vitesse;
    let tire: { x: number; t: number } | null = null;
    const bas = (e: PointerEvent) => {
      tire = { x: e.clientX, t: performance.now() };
      canvas.setPointerCapture(e.pointerId);
    };
    const bouge = (e: PointerEvent) => {
      if (!tire) return;
      const t = performance.now();
      const dx = e.clientX - tire.x;
      pivot.rotation.y += (dx / taille) * Math.PI;
      vitesse = ((dx / taille) * Math.PI) / Math.max(0.008, (t - tire.t) / 1000);
      tire = { x: e.clientX, t };
    };
    const haut = () => {
      tire = null;
    };
    canvas.addEventListener("pointerdown", bas);
    canvas.addEventListener("pointermove", bouge);
    canvas.addEventListener("pointerup", haut);
    canvas.addEventListener("pointercancel", haut);

    let raf = 0;
    let avant = performance.now();
    let premiere = true;
    const image = (t: number) => {
      const dt = Math.min(0.05, (t - avant) / 1000);
      avant = t;
      if (!tire) {
        // L'élan du doigt retombe doucement vers la rotation de repos.
        vitesse += (repos - vitesse) * Math.min(1, dt * 2.2);
        pivot.rotation.y += vitesse * dt;
      }
      renderer.render(scene, cam);
      if (premiere) {
        premiere = false;
        setPret(true);
      }
      raf = requestAnimationFrame(image);
    };
    raf = requestAnimationFrame(image);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", bas);
      canvas.removeEventListener("pointermove", bouge);
      canvas.removeEventListener("pointerup", haut);
      canvas.removeEventListener("pointercancel", haut);
      liberer(env);
      renderer.dispose();
      setPret(false);
    };
  }, [objet, matiere, taille]);

  return (
    <span className="relative block" style={{ width: taille, height: taille }}>
      {!pret && (
        <span className="absolute inset-0">
          <Objet3D objet={objet} matiere={matiere} taille={taille} embleme={embleme} />
        </span>
      )}
      <canvas
        ref={ref}
        aria-hidden
        className="absolute inset-0 touch-pan-y"
        style={{
          width: taille,
          height: taille,
          opacity: pret ? 1 : 0,
          filter: `drop-shadow(0 ${taille * 0.05}px ${taille * 0.07}px rgba(0,0,0,0.45))`,
        }}
      />
    </span>
  );
}
