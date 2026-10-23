"use client";

import { useEffect, useState } from "react";

/**
 * Sur grand écran, une colonne qui reste à l'écran pendant qu'on parcourt sa
 * voisine (le terrain d'un dimanche à côté de ses rubriques, dans les Actus)
 * — seulement si elle y tient en entier, barre d'onglets comprise : sinon son
 * bas serait inatteignable. Même idée que .colonne-fixe (globals.css), mais
 * mesurée, car la hauteur de ces colonnes dépend de ce qu'elles montrent.
 *
 * Rend [la référence à poser sur la colonne, si elle tient] : alors y mettre `sticky`.
 */
export function useCollant(marge = 130) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [tient, setTient] = useState(false);
  useEffect(() => {
    if (!el) return;
    const mesurer = () => setTient(el.offsetHeight > 0 && el.offsetHeight + marge <= window.innerHeight);
    const o = new ResizeObserver(mesurer);
    o.observe(el);
    window.addEventListener("resize", mesurer);
    return () => {
      o.disconnect();
      window.removeEventListener("resize", mesurer);
    };
  }, [el, marge]);
  return [setEl, tient] as const;
}
