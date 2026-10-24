"use client";

// La mémoire de la navigation, comme sur iPhone (Sabri, 24/10 : « des fois,
// on peut pas faire un retour ») :
//   · chaque page de l'historique porte sa marque (history.state.bola) : son
//     rang depuis l'ouverture de l'app et la page d'où l'on venait. Le bouton
//     retour (bouton-retour.tsx) sait ainsi s'il y a une page de l'app
//     derrière lui : il y revient, sinon il mène au parent (lib/nav.ts) ;
//   · chaque page garde l'endroit où on l'a laissée : revenir en arrière (le
//     bouton retour, le geste du bord de l'écran) la retrouve au même endroit.
//     Next ne s'en charge pas : tout défile dans #app-scroll, pas la page ;
//   · chaque racine de RACINES_MEMOIRE garde aussi sa place, comme un onglet
//     d'iOS : y revenir par la barre d'onglets la retrouve là où on l'avait
//     laissée ; retoucher l'onglet où l'on est remonte en haut (bottom-nav.tsx).
//
// La marque passe par history.pushState et replaceState, enveloppés une fois :
// Next les appelle à chaque navigation avec un état neuf, sans ce qu'on y
// avait mis. Les places sont gardées pour la session (sessionStorage) : une
// mise à jour de l'app, qui recharge la page, retrouve tout.

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RACINES_MEMOIRE } from "@/lib/nav";

interface Marque {
  /** Le rang de la page depuis l'ouverture de l'app : 0, la première. */
  i: number;
  /** La clé de sa place. */
  k: string;
  /** La page d'où l'on venait (chemin et paramètres). */
  de?: string;
}

const CLE = "bola-navigation-v1";
/** Les places de chaque page de l'historique, par clé. */
const places = new Map<string, number>();
/** Les places des racines, par chemin. */
const racines = new Map<string, number>();
/** La place à retrouver une fois la page affichée. */
let attente: { url: string; top: number; jusqua: number } | null = null;
/** Le temps d'une arrivée, le défilement n'est pas noté (l'ancienne page est encore là). */
let silence = 0;
/** La page affichée (chemin et paramètres), à son dernier rendu. */
let affichee: string | null = null;
let installe = false;
const abonnes = new Set<() => void>();

const maintenant = () => performance.now();
const adresse = () => window.location.pathname + window.location.search;
const nouvelleCle = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const defilant = () => document.getElementById("app-scroll");

function marque(): Marque | undefined {
  const m = window.history.state?.bola;
  return m && typeof m.i === "number" && typeof m.k === "string" ? m : undefined;
}

/** La page de l'app d'où l'on vient (chemin et paramètres) ; null si l'app s'est ouverte ici. */
export function pageDAvant(): string | null {
  if (typeof window === "undefined") return null;
  const m = marque();
  return m && m.i > 0 ? (m.de ?? "") : null;
}

/** pageDAvant, tenue à jour à chaque navigation. */
export function usePageDAvant(): string | null {
  return useSyncExternalStore(abonner, pageDAvant, () => null);
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

// Après coup : Next pousse la page pendant qu'il l'affiche, et React refuse
// qu'on lui demande un rendu à ce moment-là.
const prevenir = () => queueMicrotask(() => abonnes.forEach((f) => f()));

function installer() {
  if (installe) return;
  installe = true;
  try {
    const lu = JSON.parse(sessionStorage.getItem(CLE) ?? "null");
    for (const [k, v] of lu?.places ?? []) places.set(k, v);
    for (const [k, v] of lu?.racines ?? []) racines.set(k, v);
  } catch {}

  const h = window.history;
  const pousser = h.pushState;
  const remplacer = h.replaceState;
  h.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
    const avant = marque();
    const bola: Marque = { i: (avant?.i ?? 0) + 1, k: nouvelleCle(), de: adresse() };
    pousser.call(h, { ...(data as object | null), bola }, unused, url);
    prevenir();
  };
  h.replaceState = function (data: unknown, unused: string, url?: string | URL | null) {
    const avant = marque();
    const neuf = data as { bola?: Marque } | null;
    remplacer.call(h, avant && !neuf?.bola ? { ...neuf, bola: avant } : data, unused, url);
    prevenir();
  };

  // La première page de l'app : Next y a déjà mis son état ; sans le sien,
  // l'état reste tel quel (Next recharge une page dont l'état n'est pas le sien).
  if (h.state?.__NA && !marque()) remplacer.call(h, { ...h.state, bola: { i: 0, k: nouvelleCle() } satisfies Marque }, "");
  // Une page rechargée (une mise à jour) retrouve sa place, le temps que la
  // saison se charge.
  const m = marque();
  const top = m ? places.get(m.k) : undefined;
  if (top) {
    silence = maintenant() + 3000;
    restaurer(top, silence);
  }

  window.addEventListener("popstate", () => {
    // La page d'avant (ou d'après) revient : sa place, notée avant que
    // l'ancienne page, encore affichée, ne défile sous sa marque. React
    // affiche souvent la page d'un retour sur-le-champ, pendant l'écoute de
    // Next, qui passe avant celle-ci : elle est alors déjà là.
    const m = marque();
    const top = (m && places.get(m.k)) ?? 0;
    if (affichee === adresse()) {
      silence = maintenant() + 1500;
      restaurer(top, silence);
    } else attendre(adresse(), top, 1500);
    prevenir();
  });

  const garder = () => {
    try {
      sessionStorage.setItem(CLE, JSON.stringify({ places: [...places].slice(-60), racines: [...racines] }));
    } catch {}
  };
  window.addEventListener("pagehide", garder);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") garder();
  });
}

function attendre(url: string, top: number, duree: number) {
  attente = { url, top, jusqua: maintenant() + duree };
  silence = attente.jusqua;
}

/** Retrouver la place d'une racine, à la touche de son onglet. */
export function retrouverOnglet(href: string) {
  if (!RACINES_MEMOIRE.includes(href)) return;
  attendre(href, racines.get(href) ?? 0, 1500);
}

/** Remonter en haut de la page, à la touche de l'onglet où l'on est déjà. */
export function remonter() {
  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  defilant()?.scrollTo({ top: 0, behavior: reduit ? "auto" : "smooth" });
}

/**
 * Pose la page attendue à sa place, image après image, le temps que son
 * contenu arrive (une liste qui se charge) ; un doigt posé arrête tout.
 */
function restaurer(top: number, jusqua: number) {
  const el = defilant();
  if (!el) return void (silence = 0);
  let fini = false;
  const finir = () => {
    fini = true;
    silence = 0;
    el.removeEventListener("touchstart", finir);
    el.removeEventListener("wheel", finir);
  };
  el.addEventListener("touchstart", finir, { passive: true });
  el.addEventListener("wheel", finir, { passive: true });
  const pas = () => {
    if (fini) return;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTop = Math.min(top, max);
    if (max >= top || maintenant() > jusqua) return finir();
    requestAnimationFrame(pas);
  };
  pas();
}

export function MemoireNavigation() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  // Noter la place de la page affichée, et celle de sa racine.
  useEffect(() => {
    installer();
    const el = defilant();
    if (!el) return;
    const noter = () => {
      if (maintenant() < silence) return;
      const m = marque();
      if (m) places.set(m.k, el.scrollTop);
      if (!window.location.search && RACINES_MEMOIRE.includes(window.location.pathname)) racines.set(window.location.pathname, el.scrollTop);
    };
    el.addEventListener("scroll", noter, { passive: true });
    return () => el.removeEventListener("scroll", noter);
  }, []);

  // La page est affichée : la poser à sa place, si on en attend une, avant
  // qu'elle ne se peigne (et après le défilement de Next vers le haut, plus
  // haut dans l'arbre).
  useLayoutEffect(() => {
    affichee = pathname + (search ? `?${search}` : "");
    const a = attente;
    if (!a) return;
    if (maintenant() > a.jusqua) {
      attente = null;
      return;
    }
    if (a.url !== adresse()) return;
    attente = null;
    restaurer(a.top, a.jusqua);
  }, [pathname, search]);

  return null;
}
