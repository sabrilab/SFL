"use client";

// Écran d'ouverture de l'app : l'intro Bola (intro-bola.ts : la lune du
// symbole qui naît, les lettres qui en sortent) sur un voile opaque, le temps
// que les polices, le chunk Three.js (moteur des cartes 3D), les shaders WebGL
// et les photos des joueurs soient prêts — pas de flash de contenu 2D, et
// surtout aucun à-coup au tout premier rendu 3D puisque son moteur (JS +
// shaders compilés) est déjà chaud.
//
// Les photos préchargées sont les vignettes de la Map, la première page
// (lib/sfl/photos, photoMiniature) : quelques Ko chacune, toutes celles que
// l'appareil connaît, pour que les piles de joueurs aient leurs visages dès
// que le voile se lève. Jusqu'au 22/10, c'étaient les dix premières photos
// en entier (1,5 Mo), dont des portraits de repli qui n'existent plus.
//
// Le voile se lève quand le logo est posé et que tout est prêt. S'il faut
// attendre encore, un filet paraît sous le logo et suit le vrai travail
// effectué (chaque étape a un poids). Au-delà de MAX_MS, le voile se lève
// quoi qu'il arrive : un chunk introuvable (hors ligne) ne bloque plus l'app.
// Jusqu'au 24/10, l'écran portait le logo qui pulsait, « sunday five league »
// et une barre de progression ; et en mode clair, le logo blanc sur le blanc.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { photoMiniature, photosPartagees } from "@/lib/sfl/photos";
import { jouerIntro, PLACES, TRACES, type Intro } from "./intro-bola";

const CardCanvas = dynamic(() => import("./card-3d-canvas").then((m) => m.CardCanvas), {
  ssr: false,
});

/** Émis quand le voile se lève (et `data-splash="fini"` posé sur <html>). */
export const SPLASH_FINI = "sfl-splash-fini";
/** Au-delà, le voile n'attend plus les photos : elles finissent derrière. */
const PHOTOS_MAX_MS = 1500;
/** Au-delà, le voile se lève, que tout soit prêt ou non. */
const MAX_MS = 9000;
/** Le logo posé, on attend encore tant avant de montrer le filet de progression. */
const FILET_MS = 450;

// Poids de chaque étape (somme = 100) — le préchauffage des shaders est
// la part la plus lourde, c'est aussi celle qui évite le plus de latence
// perçue à l'apparition des cartes.
const WEIGHTS = { fonts: 15, chunk: 20, shaders: 35, photos: 30 };

const TRANSPARENT_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function preloadImage(src: string) {
  return new Promise<void>((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export function AppSplash() {
  /** Le voile se lève (le préchauffage 3D n'a plus lieu d'être). */
  const [sortie, setSortie] = useState(false);
  /** Le voile est levé : plus rien à montrer. */
  const [leve, setLeve] = useState(false);
  const [filet, setFilet] = useState(false);
  const [progress, setProgress] = useState(3);
  const [warmupOn, setWarmupOn] = useState(false);
  const doneWeight = useRef(0);
  const resolveShaders = useRef<() => void>(() => {});
  const intro = useRef<Intro | null>(null);
  const voile = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const lettres = useRef<HTMLDivElement>(null);
  const rideau = useRef<HTMLDivElement>(null);
  const cache = useRef<HTMLDivElement>(null);
  const lune = useRef<HTMLDivElement>(null);
  const ombre = useRef<HTMLDivElement>(null);
  const symbole = useRef<HTMLDivElement>(null);
  const barre = useRef<HTMLDivElement>(null);

  function bump(weight: number) {
    doneWeight.current = Math.min(100, doneWeight.current + weight);
    setProgress(Math.max(3, doneWeight.current));
  }

  // L'intro part avant la première image, de son premier état.
  useLayoutEffect(() => {
    const p = [voile, scene, lettres, rideau, cache, lune, ombre, symbole].map((r) => r.current);
    if (p.some((el) => !el)) return;
    const [v, s, l, r, c, lu, o, sy] = p as HTMLDivElement[];
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const i = jouerIntro(
      { voile: v, scene: s, lettres: l, rideau: r, cache: c, lune: lu, ombre: o, symbole: sy, barre: barre.current },
      reduit
    );
    intro.current = i;
    return () => i.arreter();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let pret = false;

    const shadersWarm = new Promise<void>((resolve) => {
      resolveShaders.current = resolve;
    });

    async function run() {
      const fontsP = document.fonts.ready.then(() => bump(WEIGHTS.fonts));

      // Les vignettes de la Map, telles que ses piles les demanderont : le
      // cache du navigateur les lui rendra sans attendre.
      const photos = photosPartagees();
      const photoStep = WEIGHTS.photos / Math.max(1, photos.length);
      let photosRestant = WEIGHTS.photos;
      const photosP = Promise.race([
        Promise.all(
          photos.map((url) =>
            preloadImage(photoMiniature(url)).then(() => {
              if (photosRestant <= 0) return;
              photosRestant -= photoStep;
              bump(photoStep);
            })
          )
        ),
        new Promise<void>((r) => setTimeout(r, PHOTOS_MAX_MS)),
      ]).then(() => {
        // Ce qui n'est pas arrivé à temps compte quand même dans la barre.
        bump(Math.max(0, photosRestant));
        photosRestant = 0;
      });

      let shadersP: Promise<void>;
      try {
        await import("@/components/sfl/card-3d-canvas");
        if (cancelled) return;
        bump(WEIGHTS.chunk);
        // Monte un canvas caché : force la compilation des shaders (surface
        // + holo) pendant qu'on regarde encore l'écran de chargement.
        setWarmupOn(true);
        shadersP = shadersWarm.then(() => bump(WEIGHTS.shaders));
      } catch {
        // Chunk introuvable (hors ligne, version retirée) : les cartes 3D
        // chaufferont à leur première apparition.
        bump(WEIGHTS.chunk + WEIGHTS.shaders);
        shadersP = Promise.resolve();
      }

      await Promise.all([fontsP, photosP, shadersP]);
    }

    const i = intro.current;
    const leVoileAttend = new Promise<void>((r) => setTimeout(r, MAX_MS));
    Promise.race([run(), leVoileAttend])
      .then(() => {
        pret = true;
        return i?.pose;
      })
      .then(() => {
        if (cancelled) return;
        setSortie(true);
        // La Map attend ce signal pour lancer son vol et ses entrées.
        document.documentElement.dataset.splash = "fini";
        window.dispatchEvent(new Event(SPLASH_FINI));
        return i?.sortir();
      })
      .then(() => {
        if (!cancelled) setLeve(true);
      });
    // Le logo posé, si tout n'est pas encore prêt, le filet dit où on en est.
    i?.pose.then(() =>
      setTimeout(() => {
        if (!pret && !cancelled) setFilet(true);
      }, FILET_MS)
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {warmupOn && !sortie && (
        <div
          aria-hidden
          style={{ position: "fixed", top: 0, left: -9999, width: 130, height: 188 }}
        >
          <CardCanvas
            background={TRANSPARENT_PX}
            playerLayer={TRANSPARENT_PX}
            stats={TRANSPARENT_PX}
            holo
            mode="rare"
            interactive={false}
            onReady={() => resolveShaders.current()}
          />
        </div>
      )}

      {!leve && (
        <div
          ref={voile}
          role="progressbar"
          aria-label="Bola"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="fixed inset-0 z-[200] overflow-hidden bg-background text-foreground"
        >
          {/* Le logo (repère 1000 × 237), du dessous au dessus : les lettres,
              les deux papiers qui les cachent, le symbole. */}
          <div ref={scene} aria-hidden className="absolute top-1/2 left-1/2 origin-top-left">
            <div ref={lettres} className="absolute inset-0">
              <svg viewBox={PLACES.vueLogo} className="block size-full" fill="currentColor">
                <path d={TRACES.logotype} fillRule="evenodd" />
                <path d={TRACES.marque} fillRule="evenodd" />
              </svg>
            </div>
            <div ref={rideau} className="absolute bg-background" style={PLACES.rideau} />
            <div ref={cache} className="absolute bg-background" style={PLACES.cache} />
            <div ref={lune} className="absolute" style={PLACES.symbole}>
              <svg viewBox={PLACES.vueSymbole} className="block size-full" fill="currentColor">
                <circle cx={PLACES.disque.cx} cy={PLACES.disque.cy} r={PLACES.disque.r} />
              </svg>
              <div ref={ombre} className="absolute rounded-full bg-background" style={PLACES.ombre} />
            </div>
            <div ref={symbole} className="absolute opacity-0" style={PLACES.symbole}>
              <svg viewBox={PLACES.vueSymbole} className="block size-full" fill="currentColor">
                <path d={TRACES.symbole} fillRule="evenodd" />
              </svg>
            </div>
          </div>
          {/* Le filet de progression, s'il faut attendre (placé par l'intro). */}
          <div
            ref={barre}
            aria-hidden
            className={`absolute top-1/2 left-1/2 h-0.5 overflow-hidden rounded-full bg-foreground/12 transition-opacity duration-300 ${
              filet ? "opacity-100" : "opacity-0"
            }`}
          >
            <div
              className="size-full origin-left rounded-full bg-foreground transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>
        </div>
      )}
    </>
  );
}
