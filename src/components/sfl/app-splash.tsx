"use client";

// Écran de chargement au tout premier lancement de l'app : le temps que
// les polices, le chunk Three.js (moteur des cartes 3D), les shaders
// WebGL et les premières photos joueur soient prêts, on masque tout
// derrière un voile opaque — pas de flash de contenu 2D, et surtout
// aucun à-coup au tout premier rendu 3D puisque son moteur (JS + shaders
// compilés) est déjà chaud.
//
// La barre de progression reflète le vrai travail effectué (chaque étape
// a un poids) plutôt qu'une animation décorative minutée à l'aveugle.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { PLAYERS } from "@/lib/sfl/data";

const CardCanvas = dynamic(() => import("./card-3d-canvas").then((m) => m.CardCanvas), {
  ssr: false,
});

// Le voile de chargement est en z-[200] : tout ce qui doit s'afficher
// par-dessus l'app au démarrage (pop-up, invite d'installation…) doit
// attendre sa disparition, sinon ça s'ouvre derrière lui sans être vu.
export const SPLASH_DONE_EVENT = "sfl-splash-done";

let splashFinished = false;

/** Vrai une fois l'écran de chargement retiré (pour les montages tardifs). */
export function isSplashDone() {
  return splashFinished;
}

const MIN_DISPLAY_MS = 650;
const PRELOAD_COUNT = 10;

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

      const photos = PLAYERS.slice(0, PRELOAD_COUNT).map((p) =>
        preloadImage(`/players/${p.name}.png`)
      );
      const photoStep = WEIGHTS.photos / photos.length;
      const photosP = Promise.all(photos.map((p) => p.then(() => bump(photoStep))));

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
        splashFinished = true;
        window.dispatchEvent(new Event(SPLASH_DONE_EVENT));
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
              className="font-sans text-3xl font-extrabold tracking-tighter"
            >
              Golder
            </motion.span>
            <span className="scale-y-90 text-[11px] font-black tracking-[0.35em] text-muted-foreground uppercase">
              Sunday Five League
            </span>
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
