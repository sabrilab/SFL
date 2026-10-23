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
    const maj = () => {
      const hauteur = vv ? Math.round(vv.height) : 0;
      const haut = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0;
      // iOS envoie des rafales d'événements identiques : pas de rendu pour rien.
      setVue((v) => (v.hauteur === hauteur && v.haut === haut && v.tactile === tactile ? v : { hauteur, haut, tactile }));
    };
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
