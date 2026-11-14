"use client";

// Tient le mode de l'app à jour (lib/sfl/apparence.ts) : au choix du joueur,
// ou, en Auto, à l'heure (relue chaque minute et au retour sur l'app), et pose
// le style Pelouse qui va avec (data-style 24 le jour, 16 la nuit). Un style à
// l'essai sur un aperçu (style-ui/essai.tsx) pose data-essai et garde la main.

import { useEffect, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { ecouterApparence, lireApparence, modeResolu, styleDuMode, type Apparence } from "@/lib/sfl/apparence";

/** Le choix du joueur : auto, clair ou sombre. */
export function useApparence(): Apparence {
  return useSyncExternalStore(ecouterApparence, lireApparence, () => "auto");
}

export function ApparenceAuto() {
  const { setTheme } = useTheme();
  const apparence = useApparence();

  useEffect(() => {
    const appliquer = () => {
      const html = document.documentElement;
      if (html.dataset.essai) return;
      const m = modeResolu(apparence);
      setTheme(m);
      html.dataset.famille = "pelouse";
      html.dataset.style = styleDuMode(m);
    };
    appliquer();
    const id = window.setInterval(appliquer, 60_000);
    document.addEventListener("visibilitychange", appliquer);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", appliquer);
    };
  }, [apparence, setTheme]);

  return null;
}
