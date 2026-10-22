"use client";

import { useEffect, useState } from "react";

/** La partie de la page qu'on voit vraiment : sa hauteur et son décalage
 *  (le clavier d'iPhone les change sans redimensionner la page), et si
 *  l'écran est tactile. */
export function useVueVisible() {
  const [vue, setVue] = useState({ hauteur: 0, haut: 0, tactile: false });
  useEffect(() => {
    const vv = window.visualViewport;
    const tactile = window.matchMedia("(pointer: coarse)").matches;
    const maj = () =>
      setVue({
        hauteur: vv ? Math.round(vv.height) : 0,
        haut: vv ? Math.max(0, Math.round(vv.offsetTop)) : 0,
        tactile,
      });
    maj();
    vv?.addEventListener("resize", maj);
    vv?.addEventListener("scroll", maj);
    return () => {
      vv?.removeEventListener("resize", maj);
      vv?.removeEventListener("scroll", maj);
    };
  }, []);
  return vue;
}
