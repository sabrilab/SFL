"use client";

// Ce qui entoure l'app suit son mode, clair ou sombre :
//   · la meta theme-color (la barre de Safari, la barre d'état d'Android),
//     au lieu du sombre figé du rendu serveur (layout.tsx, viewport) ;
//   · data-installee sur <html> quand l'app est ouverte depuis son icône :
//     l'heure et la batterie y sont blanches quoi qu'il arrive, le voile de
//     la barre d'état en tient compte (globals.css, .voile-etat).

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { lireEnvironnement } from "@/lib/pwa/environnement";

const COULEUR = { light: "#f4f5f2", dark: "#08090B" } as const;

export function CouleurTheme() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((m) => (m.content = COULEUR[resolvedTheme]));
  }, [resolvedTheme]);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-installee", lireEnvironnement().installee);
  }, []);
  return null;
}
