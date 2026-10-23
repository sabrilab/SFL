"use client";

// Le clavier, sur les écrans de discussion (le Vestiaire, la discussion d'un
// match ou de l'équipe, Bola Agent) : la barre d'écriture se pose juste
// au-dessus du clavier, le titre reste en haut, seul le fil défile.
//
// Sur iPhone, en PWA comme dans Safari, le clavier ne redimensionne pas la
// page : il la recouvre, et iOS fait glisser la partie visible pour montrer
// le champ touché (visualViewport). Tant que le clavier est là, l'écran prend
// la hauteur et le décalage de cette partie visible ; sans clavier, il garde
// toute la hauteur de l'écran (100dvh), quoi que dise visualViewport. Avant
// le 23/10, l'écran suivait visualViewport en permanence : or iOS 26 laisse
// parfois, une fois le clavier parti, une partie visible trop courte (24 px)
// ou décalée qui ne revient pas à zéro (bug WebKit 297779), et n'envoie pas
// toujours le dernier événement. Selon le téléphone, la barre d'écriture
// restait alors figée au milieu de l'écran, ou une bande vide restait en bas.
//
// Le clavier est « là » quand on écrit dans un champ de l'écran et que la
// partie visible a perdu plus de 120 px (ni un résidu d'iOS, ni le clavier
// physique d'un iPad). Il est parti quand elle les a retrouvés, ou au plus
// tard 0,7 s après qu'on a quitté le champ, même sans nouvelle d'iOS.
//
// Tout passe par le DOM, sans rendu React : l'écran porte data-clavier et les
// variables --vue-h et --vue-haut (globals.css, .ecran-discussion), <html>
// porte data-clavier, qui efface la barre d'onglets (bottom-nav.tsx). La
// hauteur, le décalage, la barre d'onglets et le bas de la barre d'écriture
// changent ainsi dans la même image : plus de saut en deux temps, et le fil
// n'est plus redessiné à chaque événement du clavier.

import { useEffect, useRef } from "react";

/** En deçà, ce n'est pas un clavier : la barre de Safari, le résidu d'iOS 26. */
const SEUIL = 120;
/** Le champ quitté, le clavier est réputé parti au plus tard après ce délai (ms). */
const DELAI_SORTIE = 700;
const PAS_DU_TEXTE = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

/** Le champ où l'on écrit, où qu'il soit (null : aucun). */
function champActif(): HTMLElement | null {
  const el = document.activeElement;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled ? el : null;
  if (el instanceof HTMLInputElement) return !el.readOnly && !el.disabled && !PAS_DU_TEXTE.has(el.type) ? el : null;
  return el instanceof HTMLElement && el.isContentEditable ? el : null;
}

/** À poser sur l'écran de discussion (ref) : il suit le clavier tant qu'il est monté. */
export function useEcranClavier() {
  const ecran = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ecran.current;
    const vv = window.visualViewport;
    if (!el || !vv) return;
    const html = document.documentElement;
    /** La hauteur visible sans clavier, pour cette largeur d'écran. */
    let plein = 0;
    let largeur = -1;
    let ouvert = false;
    /** Quand on a quitté le champ, clavier encore ouvert (0 : on y écrit). */
    let quitte = 0;
    let image = 0;
    let minuteurs: number[] = [];

    const fermer = () => {
      ouvert = false;
      quitte = 0;
      delete el.dataset.clavier;
      delete html.dataset.clavier;
      el.style.removeProperty("--vue-h");
      el.style.removeProperty("--vue-haut");
    };

    const maj = () => {
      image = 0;
      if (vv.width !== largeur) {
        largeur = vv.width;
        plein = Math.max(vv.height, html.clientHeight);
      }
      const champ = champActif();
      const ecrit = !!champ && el.contains(champ);
      if (!ecrit && !ouvert) plein = Math.max(plein, vv.height);
      const zoom = vv.scale > 1.05;
      const parti = plein - vv.height <= SEUIL;

      if (!ouvert) {
        if (!ecrit || zoom || parti) {
          // Sans clavier ni champ, la page n'a aucune raison d'être décalée : iOS l'y laisse parfois.
          if (!champ && !zoom && window.scrollY !== 0) window.scrollTo(0, 0);
          return;
        }
        ouvert = true;
        el.dataset.clavier = "";
        html.dataset.clavier = "";
      } else {
        if (ecrit) quitte = 0;
        else if (!quitte) quitte = performance.now();
        if (zoom || parti || (quitte && performance.now() - quitte >= DELAI_SORTIE)) {
          fermer();
          // iOS laisse parfois la page décalée une fois le clavier parti (pas
          // si l'on écrit ailleurs : il y montre le champ).
          if (!champ) window.scrollTo(0, 0);
          return;
        }
      }
      el.style.setProperty("--vue-h", `${Math.round(vv.height)}px`);
      el.style.setProperty("--vue-haut", `${Math.max(0, Math.round(vv.offsetTop))}px`);
    };

    const planifier = () => {
      if (!image) image = requestAnimationFrame(maj);
    };
    // iOS n'envoie pas toujours le dernier événement du clavier : on
    // remesure encore un peu après chaque entrée ou sortie d'un champ.
    const relancer = () => {
      planifier();
      for (const m of minuteurs) window.clearTimeout(m);
      minuteurs = [120, 360, DELAI_SORTIE + 60].map((t) => window.setTimeout(planifier, t));
    };

    maj();
    vv.addEventListener("resize", planifier);
    vv.addEventListener("scroll", planifier);
    window.addEventListener("resize", planifier);
    window.addEventListener("pageshow", relancer);
    document.addEventListener("focusin", relancer);
    document.addEventListener("focusout", relancer);
    document.addEventListener("visibilitychange", relancer);
    return () => {
      vv.removeEventListener("resize", planifier);
      vv.removeEventListener("scroll", planifier);
      window.removeEventListener("resize", planifier);
      window.removeEventListener("pageshow", relancer);
      document.removeEventListener("focusin", relancer);
      document.removeEventListener("focusout", relancer);
      document.removeEventListener("visibilitychange", relancer);
      cancelAnimationFrame(image);
      for (const m of minuteurs) window.clearTimeout(m);
      if (ouvert) fermer();
    };
  }, []);
  return ecran;
}
