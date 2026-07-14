"use client";

// Verrou du rebond élastique natif de Safari/iOS : `overflow: hidden` sur
// html/body ne suffit pas toujours à empêcher ce geste (certaines
// versions d'iOS Safari laissent quand même l'utilisateur "tirer" toute
// la page hors de son cadre au swipe). Ceinture-bretelles en JS : on
// bloque le comportement de scroll natif du navigateur en dehors des
// zones prévues pour défiler (le conteneur de page, les carrousels
// horizontaux) — ces zones-là gardent leur scroll normal, tout le reste
// (header, tab bar, contenu statique) ne peut plus jamais être traîné
// hors de l'écran.

import { useEffect } from "react";

const SCROLLABLE_SELECTOR = "#app-scroll, .overflow-x-auto, .overflow-y-auto, canvas";

export function ViewportLock() {
  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length > 1) return; // pincer/zoomer laissé tel quel
      const target = e.target as HTMLElement | null;
      if (target?.closest(SCROLLABLE_SELECTOR)) return;
      e.preventDefault();
    }
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => document.removeEventListener("touchmove", onTouchMove);
  }, []);

  return null;
}
