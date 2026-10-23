"use client";

// Écran de chargement au tout premier lancement de l'app : le temps que
// les polices, le chunk Three.js (moteur des cartes 3D), les shaders
// WebGL et les photos des joueurs soient prêts, on masque tout
// derrière un voile opaque — pas de flash de contenu 2D, et surtout
// aucun à-coup au tout premier rendu 3D puisque son moteur (JS + shaders
// compilés) est déjà chaud.
//
// Les photos préchargées sont les vignettes de la Map, la première page
// (lib/sfl/photos, photoMiniature) : quelques Ko chacune, toutes celles que
// l'appareil connaît, pour que les piles de joueurs aient leurs visages dès
// que le voile se lève. Jusqu'au 22/10, c'étaient les dix premières photos
// en entier (1,5 Mo), dont des portraits de repli qui n'existent plus.
//
// La barre de progression reflète le vrai travail effectué (chaque étape
// a un poids) plutôt qu'une animation décorative minutée à l'aveugle.

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { photoMiniature, photosPartagees } from "@/lib/sfl/photos";

const CardCanvas = dynamic(() => import("./card-3d-canvas").then((m) => m.CardCanvas), {
  ssr: false,
});

const MIN_DISPLAY_MS = 650;
/** Émis quand le voile se lève (et `data-splash="fini"` posé sur <html>). */
export const SPLASH_FINI = "sfl-splash-fini";
/** Au-delà, le voile n'attend plus les photos : elles finissent derrière. */
const PHOTOS_MAX_MS = 1500;

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
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(3);
  const [warmupOn, setWarmupOn] = useState(false);
  const doneWeight = useRef(0);
  const resolveShaders = useRef<() => void>(() => {});

  function bump(weight: number) {
    doneWeight.current = Math.min(100, doneWeight.current + weight);
    setProgress(Math.max(3, doneWeight.current));
  }

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

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

      await import("@/components/sfl/card-3d-canvas");
      if (cancelled) return;
      bump(WEIGHTS.chunk);
      // Monte un canvas caché : force la compilation des shaders (surface
      // + holo) pendant qu'on regarde encore l'écran de chargement.
      setWarmupOn(true);

      await Promise.all([fontsP, photosP, shadersWarm.then(() => bump(WEIGHTS.shaders))]);

      const wait = Math.max(0, MIN_DISPLAY_MS - (Date.now() - start));
      setTimeout(() => {
        if (cancelled) return;
        setReady(true);
        // La Map attend ce signal pour lancer son vol et ses entrées.
        document.documentElement.dataset.splash = "fini";
        window.dispatchEvent(new Event(SPLASH_FINI));
      }, wait);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {warmupOn && !ready && (
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

      <AnimatePresence>
        {!ready && (
          <motion.div
            key="splash"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeInOut" }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-4 bg-background"
          >
            <motion.span
              animate={{ scale: [1, 1.05, 1], opacity: [0.82, 1, 0.82] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="flex items-center"
            >
              <Image src="/bola/logo-blanc.svg" alt="Bola" width={126} height={30} priority />
            </motion.span>
            <span className="mono-label text-muted-foreground">sunday five league</span>
            <div className="mt-3 h-1 w-40 overflow-hidden rounded-full bg-foreground/10">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
