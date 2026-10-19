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

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { EMBLEMES, EMBLEMES_SAISON } from "@/components/sfl/emblemes";
import type { BadgeCarte } from "@/lib/sfl/badge-carte";
import type { Objet } from "@/lib/sfl/badges-3d/objets";
import { camera, construire, eclat, environnement, IMAGE_EVENT, imageBadge, liberer, regler, sansTroisD, type Matiere } from "@/lib/sfl/badges-3d/rendu";
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

/** Les mêmes éclats, en arrêts de dégradé SVG (le liseré du socle). */
const ECLATS: Record<Metal, [string, string, string, string]> = {
  bronze: ["#f0c09a", "#8f4f22", "#e2a77c", "#6a3815"],
  argent: ["#ffffff", "#8f959d", "#e9ebee", "#6d737b"],
  or: ["#f7e3a6", "#b8862b", "#f3d48a", "#8a6416"],
  legende: ["#ff8f80", "#9a1712", "#e2493c", "#5a0806"],
};

/** La teinte du verre du socle : la lumière du métal, au fond d'un verre fumé. */
const TEINTE: Record<Metal, string> = {
  bronze: "#d9773a",
  argent: "#c9d3e2",
  or: "#ffbf3a",
  legende: "#e2281f",
};

/** Le halo sous un objet gagné : la lumière de son métal, posée sur le fond. */
const AURA: Record<Metal, string> = {
  bronze: "rgba(224,122,58,0.16)",
  argent: "rgba(190,205,255,0.13)",
  or: "rgba(255,185,56,0.17)",
  legende: "rgba(255,59,47,0.18)",
};

function Aura({ matiere, taille }: { matiere: Matiere; taille: number }) {
  if (matiere === "fantome") return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        // Discrète (Sabri, 18/10 : « la lueur un peu moins prépondérante ») :
        // un reflet du métal resserré sous l'objet, pas un halo.
        inset: taille * 0.08,
        background: `radial-gradient(closest-side, ${AURA[matiere]} 0%, transparent 100%)`,
        transform: "translateY(16%) scaleY(0.7)",
      }}
    />
  );
}

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
  aura = false,
}: {
  objet: Objet;
  matiere: Matiere;
  taille: number;
  embleme: typeof EMBLEMES.buts;
  ombre?: boolean;
  /** Le halo du métal sous l'objet (la vitrine, les feuilles). */
  aura?: boolean;
}) {
  const src = useImageBadge(objet, matiere);
  if (aura) {
    return (
      <span className="relative block" style={{ width: taille, height: taille }}>
        <Aura matiere={matiere} taille={taille} />
        <span className="absolute inset-0">
          <Objet3D objet={objet} matiere={matiere} taille={taille} embleme={Embleme} ombre={ombre} />
        </span>
      </span>
    );
  }
  if (!src) {
    return (
      // data-attente-3d : la carte 3D attend l'image avant de se capturer (card-3d).
      <span className="grid place-items-center" style={{ width: taille, height: taille }} aria-hidden data-attente-3d={sansTroisD() ? undefined : ""}>
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

// L'écusson des fins de saison, dans un carré de 100 : une pointe en bas.
const ECUSSON = "M50 5 L89 15.5 V47 C89 71 72 87 50 95.5 C28 87 11 71 11 47 V15.5 Z";

/**
 * Le socle d'un badge posé sur une photo (la carte, la feuille de choix). Deux
 * choses doivent se lire d'un coup d'œil, même à 20 px (Sabri, 19/10 : « il
 * faut qu'on les distingue mieux ») :
 *   · la famille, par la forme : un rond pour un palier, un écusson pour une
 *     fin de saison ;
 *   · le niveau, par le métal : un liseré épais de métal poli, et un verre
 *     fumé éclairé de la couleur du métal, d'où l'objet se détache.
 * En SVG peint (pas de flou d'arrière-plan) : html-to-image le capture tel quel.
 */
function Socle({ m, ecusson, largeur }: { m: Metal; ecusson: boolean; largeur: number }) {
  const id = useId().replace(/:/g, "");
  const [a, b, c, d] = ECLATS[m];
  const trait = ecusson ? 7 : 7.5;
  const forme = (props: React.SVGProps<SVGPathElement> & React.SVGProps<SVGCircleElement>) =>
    ecusson ? <path d={ECUSSON} {...props} /> : <circle cx={50} cy={50} r={50 - trait / 2 - 0.5} {...props} />;
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      width={largeur}
      height={largeur}
      className="absolute inset-0"
      style={{ filter: `drop-shadow(0 ${largeur * 0.05}px ${largeur * 0.08}px rgba(0,0,0,0.45))`, overflow: "visible" }}
    >
      <defs>
        <radialGradient id={`v${id}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor={TEINTE[m]} stopOpacity={0.6} />
          <stop offset="60%" stopColor={TEINTE[m]} stopOpacity={0.15} />
          <stop offset="100%" stopColor="#060608" stopOpacity={0.9} />
        </radialGradient>
        <linearGradient id={`m${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={a} />
          <stop offset="48%" stopColor={b} />
          <stop offset="72%" stopColor={c} />
          <stop offset="100%" stopColor={d} />
        </linearGradient>
      </defs>
      {forme({ fill: "#0a0a0d" })}
      {forme({ fill: `url(#v${id})` })}
      {forme({ fill: "none", stroke: `url(#m${id})`, strokeWidth: trait, strokeLinejoin: "round" })}
      {/* Le filet de lumière sur le bord intérieur du métal */}
      {ecusson ? (
        <path d={ECUSSON} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.9} transform="translate(50 50) scale(0.86) translate(-50 -50)" />
      ) : (
        <circle cx={50} cy={50} r={50 - trait - 1} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.9} />
      )}
    </svg>
  );
}

/** Un badge gagné, en 3D : son objet dans son métal, et son rang s'il vient d'une fin de saison. */
export function Badge3D({ badge, largeur, socle = false }: { badge: BadgeCarte; largeur: number; socle?: boolean }) {
  const ecusson = badge.famille === "saison";
  const Embleme = ecusson ? EMBLEMES_SAISON[badge.id] : EMBLEMES[badge.id];
  const m = metalBadge(badge);
  // Sur le socle, l'objet tient dans le verre, à l'intérieur du liseré ; dans
  // l'écusson, il remonte un peu, au large de la pointe.
  const objet = socle ? largeur * (ecusson ? 0.74 : 0.8) : largeur;
  const place = socle
    ? { left: (largeur - objet) / 2, top: ecusson ? largeur * 0.11 : (largeur - objet) / 2 }
    : { left: 0, top: 0 };
  return (
    <span role="img" aria-label={`Badge : ${nomBadge(badge)}`} className="relative block shrink-0" style={{ width: largeur, height: largeur }}>
      {socle && <Socle m={m} ecusson={ecusson} largeur={largeur} />}
      <span className="absolute" style={place}>
        <Objet3D objet={objetBadge(badge)} matiere={m} taille={objet} embleme={Embleme} ombre={!socle} />
      </span>
      {ecusson && (
        <span className="absolute" style={socle ? { right: -largeur * 0.08, bottom: -largeur * 0.06 } : { right: -largeur * 0.04, bottom: -largeur * 0.02 }}>
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
    let vitesse = 0; // rad/s, l'élan du doigt
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
        // L'élan du doigt retombe, puis l'objet revient de face et se balance
        // autour de sa pose : un bouclier ou une étoile ne passe jamais par la
        // tranche, où leur face (verre, logo) disparaît dans le noir.
        vitesse *= Math.exp(-dt * 2.4);
        pivot.rotation.y += vitesse * dt;
        const tour = Math.PI * 2;
        const face = Math.round(pivot.rotation.y / tour) * tour;
        const cible = face + (reduit ? 0 : Math.sin(t / 1700) * 0.5);
        const rappel = Math.max(0, 1 - Math.abs(vitesse) / 1.5);
        pivot.rotation.y += (cible - pivot.rotation.y) * Math.min(1, dt * 1.8) * rappel;
      }
      // Il flotte, à peine : une respiration lente.
      if (!reduit) pivot.position.y = Math.sin(t / 900) * 0.05;
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
      <Aura matiere={matiere} taille={taille} />
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
