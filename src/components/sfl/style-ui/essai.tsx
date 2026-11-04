"use client";

// Styles d'interface à l'essai (Sabri, 02/11/2026 ; app/styles-ui.css) ;
// 7 à 11 : variations de l'Affiche, le style qu'il a retenu ; 12 à 17
// (styles-ui-2.css) : six autres, chacun avec son plan et sa surcouche ;
// 18 à 23 (styles-ui-3.css) : variations de Bulle (12), qu'il a retenu le 03/11.
// Sur l'aperçu seulement, jamais en production : ?style=1…23 pose
// html[data-style] et le garde sur ce téléphone (bola-style-ui), ?style=0
// revient au style d'origine. Une pastille en haut à gauche dit le style
// affiché ; la toucher passe au suivant. Chaque style choisit son thème
// (clair ou sombre), parce que ses couleurs ont été faites pour lui.

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

// Nouvelle clé le 04/11 : chaque téléphone repart du design actuel (Sabri :
// « garder le design actuel », l'UI se décide plus tard).
const CLE = "bola-style-ui-2";
export const STYLES_UI = ["Origine", "Galet", "Or", "Vestiaire", "Pelouse", "Velours", "Affiche", "Affiche nuit", "Riso", "Billet", "Pop", "Brutal", "Bulle", "Chaleur", "Trace", "Sticker", "Pelouse", "Gravure", "Bulle", "Bulle nuit", "Bulle pêche", "Bulle lilas", "Bulle encre", "Bulle verre"] as const;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lu après l'hydratation : le serveur ne connaît ni l'adresse ni le téléphone.
    setStyle(lire());
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (style) html.dataset.style = String(style);
    else delete html.dataset.style;
    if (style >= AFFICHE && style <= 11) html.dataset.famille = "affiche";
    else if (style >= 18 && style <= 23) html.dataset.famille = "bulle";
    else delete html.dataset.famille;
    if (style && !DEUX_MODES.has(style)) setTheme(SOMBRES.has(style) ? "dark" : "light");
  }, [style, setTheme]);

  if (process.env.NEXT_PUBLIC_BOLA_ENV === "production" || !style) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const n = (style % (STYLES_UI.length - 1)) + 1;
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
