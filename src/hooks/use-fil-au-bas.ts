"use client";

// Le fil d'une discussion tenu en place (vestiaire.tsx, agent.tsx).
//
// Au plus récent, il y reste : à l'ouverture, quand un message arrive, quand
// une photo ou une carte finit de charger, quand le clavier ou ce qui attend
// dans la barre d'écriture prennent de la place. Un ResizeObserver sur le fil
// et sur son contenu le rattrape avant que l'image ne s'affiche : plus de
// dernier message à moitié caché sous la barre, plus de saut.
//
// Quand on remonte lire, rien ne bouge sous les yeux : le message en haut de
// l'écran garde sa place, même si le plus ancien s'efface du haut du fil
// (seuls les 200 derniers sont lus) ou qu'une réaction s'ajoute au-dessus.
// Chrome le fait seul (overflow-anchor) ; Safari, donc l'iPhone, non : on le
// fait ici, et on ne touche au défilement que si quelque chose a bougé, pour
// ne pas couper un lancer du doigt.
//
// Chaque message du fil porte un id et data-ancre.

import { useCallback, useEffect, useRef } from "react";

/** À moins de ça du bas, on lit le plus récent : on y reste. */
const PRES_DU_BAS = 80;

export function useFilAuBas() {
  const fil = useRef<HTMLDivElement>(null);
  const contenu = useRef<HTMLDivElement>(null);
  /** Le fil est-il tenu au plus récent ? (faux dès qu'on remonte lire.) */
  const enBas = useRef(true);
  /** Le message en haut de l'écran quand on lit plus haut, et son écart au bord. */
  const ancre = useRef<{ id: string; dy: number } | null>(null);
  const image = useRef(0);

  /** Où en est la lecture : au plus récent, ou sur quel message. */
  const noter = useCallback(() => {
    const f = fil.current;
    if (!f) return;
    enBas.current = f.scrollHeight - f.scrollTop - f.clientHeight < PRES_DU_BAS;
    if (enBas.current) {
      ancre.current = null;
      return;
    }
    const haut = f.getBoundingClientRect().top;
    for (const el of f.querySelectorAll<HTMLElement>("[data-ancre]")) {
      const r = el.getBoundingClientRect();
      if (r.bottom > haut) {
        ancre.current = { id: el.id, dy: r.top - haut };
        return;
      }
    }
  }, []);

  /** Remet le fil en place : tout en bas, ou le message noté là où il était. */
  const tenir = useCallback(() => {
    const f = fil.current;
    if (!f) return;
    if (enBas.current) {
      if (f.scrollHeight - f.scrollTop - f.clientHeight > 1) f.scrollTop = f.scrollHeight;
      return;
    }
    const a = ancre.current;
    const el = a ? document.getElementById(a.id) : null;
    if (!a || !el || !f.contains(el)) return;
    const ecart = el.getBoundingClientRect().top - f.getBoundingClientRect().top - a.dy;
    if (Math.abs(ecart) >= 1) f.scrollTop += ecart;
  }, []);

  const onScroll = useCallback(() => {
    const f = fil.current;
    if (!f) return;
    enBas.current = f.scrollHeight - f.scrollTop - f.clientHeight < PRES_DU_BAS;
    if (!image.current)
      image.current = requestAnimationFrame(() => {
        image.current = 0;
        noter();
      });
  }, [noter]);

  useEffect(() => {
    const f = fil.current;
    const c = contenu.current;
    if (!f || !c || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => tenir());
    ro.observe(f);
    ro.observe(c);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(image.current);
    };
  }, [tenir]);

  /** Au plus récent (la discussion s'ouvre, mon message part). */
  const allerEnBas = useCallback(() => {
    enBas.current = true;
    ancre.current = null;
    tenir();
  }, [tenir]);

  /** Amène un message au milieu du fil, sans faire glisser la page (scrollIntoView l'aurait fait, clavier ouvert). */
  const montrer = useCallback((el: HTMLElement) => {
    const f = fil.current;
    if (!f || !f.contains(el)) return;
    const r = el.getBoundingClientRect();
    const cible = f.scrollTop + r.top - f.getBoundingClientRect().top - Math.max(0, (f.clientHeight - r.height) / 2);
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    f.scrollTo({ top: Math.max(0, cible), behavior: doux ? "smooth" : "auto" });
  }, []);

  return { fil, contenu, onScroll, noter, tenir, allerEnBas, montrer };
}
