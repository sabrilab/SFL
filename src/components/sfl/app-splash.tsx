"use client";

// Écran de chargement au tout premier lancement de l'app : le temps que
// les polices, le chunk Three.js (moteur des cartes 3D) et les premières
// photos joueur soient prêts, on masque tout derrière un voile opaque —
// pas de flash de contenu 2D ni de re-chargement une fois les cartes
// affichées ensuite.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PLAYERS } from "@/lib/sfl/data";

const MIN_DISPLAY_MS = 650;
const PRELOAD_COUNT = 10;

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

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    async function warm() {
      await Promise.allSettled([
        document.fonts.ready,
        import("@/components/sfl/card-3d-canvas"),
        ...PLAYERS.slice(0, PRELOAD_COUNT).map((p) => preloadImage(`/players/${p.name}.png`)),
      ]);
      const wait = Math.max(0, MIN_DISPLAY_MS - (Date.now() - start));
      setTimeout(() => {
        if (!cancelled) setReady(true);
      }, wait);
    }

    warm();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          key="splash"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: "easeInOut" }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-background"
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
