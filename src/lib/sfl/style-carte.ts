"use client";

// Le style des cartes joueurs, choisi sur cet appareil (Ma carte → Style).
//
// Sabri, 19/10 : maintenant que beaucoup de joueurs ont leur photo
// officielle, des variantes de la carte plus épurées, toujours au nombre
// d'or, parfois en plein écran. Le choix ne change que l'appareil de celui
// qui le fait : il voit toutes les cartes de la ligue dans ce style, sans
// toucher à celles des autres. « classique » reste la carte de tout le monde.
//
// `?carte=nuit` (ou epuree, plein, verre, classique) dans l'adresse pose le
// style d'un coup, pour montrer une variante par un lien.

export const STYLES_CARTE = ["classique", "epuree", "nuit", "plein", "verre"] as const;
export type StyleCarte = (typeof STYLES_CARTE)[number];

export const NOMS_STYLE: Record<StyleCarte, string> = {
  classique: "Classique",
  epuree: "Épurée",
  nuit: "Nuit",
  plein: "Plein écran",
  verre: "Verre",
};

const KEY = "sfl-style-carte";

/** Émis à chaque changement de style, pour rafraîchir les cartes. */
export const STYLE_EVENT = "sfl-style-carte";

function estStyle(s: string | null): s is StyleCarte {
  return !!s && (STYLES_CARTE as readonly string[]).includes(s);
}

let lu = false;
let courant: StyleCarte = "classique";
let revision = 0;

function lire() {
  if (lu || typeof window === "undefined") return;
  lu = true;
  try {
    const demande = new URLSearchParams(window.location.search).get("carte");
    if (estStyle(demande)) {
      window.localStorage.setItem(KEY, demande);
      courant = demande;
      return;
    }
    const garde = window.localStorage.getItem(KEY);
    if (estStyle(garde)) courant = garde;
  } catch {}
}

/** Le style des cartes sur cet appareil. */
export function styleCarte(): StyleCarte {
  lire();
  return courant;
}

/** Un compteur qui change avec le style : de quoi recapturer les cartes 3D. */
export function styleRevision(): number {
  lire();
  return revision;
}

export function choisirStyle(s: StyleCarte) {
  lire();
  if (s === courant) return;
  courant = s;
  revision++;
  try {
    window.localStorage.setItem(KEY, s);
  } catch {}
  window.dispatchEvent(new Event(STYLE_EVENT));
}
