"use client";

import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from "react";
import { STYLE_EVENT, styleCarte, styleRevision, type StyleCarte } from "@/lib/sfl/style-carte";

function subscribe(onChange: () => void) {
  window.addEventListener(STYLE_EVENT, onChange);
  return () => window.removeEventListener(STYLE_EVENT, onChange);
}

/** Un style imposé à un morceau d'arbre (les vignettes du choix de style). */
const Force = createContext<StyleCarte | null>(null);

export function StyleForce({ style, children }: { style: StyleCarte; children: ReactNode }) {
  return createElement(Force.Provider, { value: style }, children);
}

/** Le style des cartes choisi sur cet appareil (classique côté serveur). */
export function useStyleCarte(): StyleCarte {
  const force = useContext(Force);
  const choisi = useSyncExternalStore(subscribe, styleCarte, () => "classique" as const);
  return force ?? choisi;
}

/** Change avec le style : la clé des cartes 3D, pour les recapturer. */
export function useStyleRevision(): number {
  return useSyncExternalStore(subscribe, styleRevision, () => 0);
}
