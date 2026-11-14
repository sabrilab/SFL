"use client";

// Styles d'interface à l'essai (Sabri, 02/11/2026 ; app/styles-ui.css) ;
// 7 à 11 : variations de l'Affiche, le style qu'il a retenu ; 12 à 17
// (styles-ui-2.css) : six autres, chacun avec son plan et sa surcouche ;
// 18 à 23 (styles-ui-3.css) : variations de Bulle (12), qu'il a retenu le 03/11 ;
// 24 à 26 (styles-ui-4.css) : la famille Pelouse, le 16 arrondi (12/11), sombre
// la nuit et clair le jour (lib/sfl/mode-pelouse.ts), trois clairs à l'essai.
// Sur l'aperçu seulement, jamais en production : ?style=1…23 pose
// html[data-style] et le garde sur ce téléphone (bola-style-ui), ?style=0
// revient au style d'origine. Une pastille en haut à gauche dit le style
// affiché ; la toucher passe au suivant. Chaque style choisit son thème
// (clair ou sombre), parce que ses couleurs ont été faites pour lui.

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { estPelouse, styleDuJour } from "@/lib/sfl/mode-pelouse";
import { modeResolu, styleDuMode } from "@/lib/sfl/apparence";

// Nouvelle clé le 14/11 : la Pelouse est le style de l'app (Sabri : « publier
// partout ») ; chaque aperçu repart d'elle. Le style 0 et le 16 sont la Pelouse
// de l'app (components/layout/apparence.tsx) ; les autres restent à l'essai.
const CLE = "bola-style-ui-3";
export const STYLES_UI = ["Pelouse", "Galet", "Or", "Vestiaire", "Pelouse", "Velours", "Affiche", "Affiche nuit", "Riso", "Billet", "Pop", "Brutal", "Bulle", "Chaleur", "Trace", "Sticker", "Pelouse", "Gravure", "Bulle", "Bulle nuit", "Bulle pêche", "Bulle lilas", "Bulle encre", "Bulle verre", "Pelouse craie", "Pelouse gazon", "Pelouse tribune"] as const;
const SOMBRES = new Set([3, 5, 7, 13, 16, 19]);
/** 18 et 23 suivent le réglage Apparence (clair, sombre, auto) : ils ont leurs deux modes (Sabri, 03/11). */
const DEUX_MODES = new Set([18, 23]);
/** La famille Affiche (6 à 11) partage ses règles, réglées par des variables (styles-ui.css). */
const AFFICHE = 6;

function lire(): number {
  try {
    const q = new URLSearchParams(window.location.search).get("style");
    if (q != null) {
      const n = Number(q);
      if (n >= 0 && n < STYLES_UI.length) {
        localStorage.setItem(CLE, String(n));
        return n;
      }
    }
    const n = Number(localStorage.getItem(CLE) ?? 0);
    return n >= 0 && n < STYLES_UI.length ? n : 0;
  } catch {
    return 0;
  }
}

export function EssaiStyleUi() {
  const [style, setStyle] = useState(0);
  const { setTheme } = useTheme();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BOLA_ENV === "production") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lu après l'hydratation : le serveur ne connaît ni l'adresse ni le téléphone.
    setStyle(lire());
  }, []);

  // Le style de l'app (0, 16) : l'apparence garde la main. Un autre : à l'essai.
  const essai = style !== 0 && style !== 16;

  useEffect(() => {
    const html = document.documentElement;
    if (!essai) {
      delete html.dataset.essai;
      const m = modeResolu();
      setTheme(m);
      html.dataset.famille = "pelouse";
      html.dataset.style = styleDuMode(m);
      return;
    }
    html.dataset.essai = "1";
    if (estPelouse(style)) {
      // 24 à 26 : leur clair le jour, le 16 la nuit, selon l'heure.
      const relire = () => {
        const m = modeResolu();
        html.dataset.style = m === "light" ? String(styleDuJour(style)) : "16";
        html.dataset.famille = "pelouse";
        setTheme(m);
      };
      relire();
      const id = window.setInterval(relire, 60_000);
      return () => window.clearInterval(id);
    }
    html.dataset.style = String(style);
    if (style >= AFFICHE && style <= 11) html.dataset.famille = "affiche";
    else if (style >= 18 && style <= 23) html.dataset.famille = "bulle";
    else delete html.dataset.famille;
    if (!DEUX_MODES.has(style)) setTheme(SOMBRES.has(style) ? "dark" : "light");
  }, [style, essai, setTheme]);

  if (process.env.NEXT_PUBLIC_BOLA_ENV === "production" || !style) return null;
  // ?pastille=0 : les captures sans la pastille.
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("pastille") === "0") return null;
  return (
    <button
      type="button"
      onClick={() => {
        const n = (style + 1) % STYLES_UI.length;
        try {
          localStorage.setItem(CLE, String(n));
        } catch {}
        setStyle(n);
      }}
      className="fixed top-[calc(env(safe-area-inset-top,0px)+4px)] left-1/2 z-[9999] -translate-x-1/2 rounded-full bg-foreground px-3 py-1 text-[11px] font-bold tracking-[0.6px] text-background uppercase opacity-80"
    >
      Style {style} · {STYLES_UI[style]}
    </button>
  );
}
