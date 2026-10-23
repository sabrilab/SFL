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
//
// Sur un écran de discussion (data-ecran-fixe : le Vestiaire, la discussion
// d'un match ou d'une équipe, Bola Agent), on regarde de plus près : un fil
// trop court pour défiler, ou déjà à son bout, passait le geste à la page,
// et iOS faisait glisser tout l'écran (clavier ouvert : le titre et la barre
// d'écriture partaient de leur place). Le geste n'y passe que si ce qu'on
// touche défile vraiment dans ce sens ; clavier ouvert, pas au-delà du bout.

import { useEffect } from "react";

const SCROLLABLE_SELECTOR = "#app-scroll, .overflow-x-auto, .overflow-y-auto, canvas";
/** Sur un écran de discussion, ce qui peut défiler : le fil, une rangée, le champ. */
const DEFILE_ECRAN = ".overflow-y-auto, .overflow-x-auto, .overflow-auto, textarea, canvas";

/** `el` défile-t-il dans le sens du geste (dx, dy depuis le début du toucher) ? */
function defile(el: HTMLElement, dx: number, dy: number, clavier: boolean): boolean {
  if (el instanceof HTMLCanvasElement) return true;
  if (Math.abs(dx) > Math.abs(dy)) return el.scrollWidth - el.clientWidth > 1;
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 1) return false;
  if (!clavier) return true;
  // Le doigt descend : on remonte le fil, possible tant qu'on n'est pas en haut ; il monte : l'inverse.
  if (dy > 0) return el.scrollTop > 0;
  if (dy < 0) return el.scrollTop < max - 1;
  return true;
}

export function ViewportLock() {
  useEffect(() => {
    let x0 = 0;
    let y0 = 0;
    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      x0 = t.clientX;
      y0 = t.clientY;
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length > 1) return; // pincer/zoomer laissé tel quel
      const target = e.target as HTMLElement | null;
      const ecran = target?.closest<HTMLElement>("[data-ecran-fixe]");
      if (target && ecran) {
        const t = e.touches[0];
        const dx = t.clientX - x0;
        const dy = t.clientY - y0;
        const clavier = "clavier" in document.documentElement.dataset;
        let el = target.closest<HTMLElement>(DEFILE_ECRAN);
        while (el && ecran.contains(el)) {
          if (defile(el, dx, dy, clavier)) return;
          el = el.parentElement?.closest<HTMLElement>(DEFILE_ECRAN) ?? null;
        }
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (target?.closest(SCROLLABLE_SELECTOR)) return;
      e.preventDefault();
    }
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return null;
}
