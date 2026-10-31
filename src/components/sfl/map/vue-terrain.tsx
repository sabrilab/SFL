"use client";

// Le vrai terrain, dessiné (Sabri, 31/10 : « une image du terrain, mais du
// vrai terrain, même si on le voit un peu de haut, mais plus stylisé, qui
// fasse pas satellite »). Plus de photo d'Esri : le plan de la Map lui-même
// (map/style-snap.ts, les données d'OpenStreetMap), posé sur le terrain,
// incliné, les bâtiments levés en volumes de plâtre, le terrain de sport
// dans son vert franc.
//
// Une seule carte MapLibre, cachée hors de l'écran, sert toutes les vues :
// elle se pose sur chaque terrain l'un après l'autre, attend que tout soit
// dessiné, et en garde l'image (JPEG, en mémoire le temps de la visite).
// Les cartes du carrousel n'ont ainsi qu'une <img>, comme avant la photo.

import { useEffect, useState } from "react";
import type { Map as PlanMap } from "maplibre-gl";
import { cn } from "@/lib/utils";
import { LIBELLES, styleSnap } from "./style-snap";

/** La taille de l'image prise, en px CSS (×2 à l'écran). */
const LARGEUR = 392;
const HAUTEUR = 280;
/** Le cadrage : de près, incliné, un peu tourné, comme vu depuis un toit voisin. */
const VUE = { zoom: 16.7, pitch: 52, bearing: -20 };

const images = new Map<string, string>();
const attentes = new Map<string, ((url: string) => void)[]>();
const file: { cle: string; lat: number; lng: number }[] = [];
let plan: Promise<PlanMap> | null = null;
let occupe = false;

const cleDe = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

function lePlan(): Promise<PlanMap> {
  plan ??= import("maplibre-gl").then(({ default: maplibregl }) => {
    const boite = document.createElement("div");
    boite.setAttribute("aria-hidden", "true");
    boite.style.cssText = `position:fixed;left:-10000px;top:0;width:${LARGEUR}px;height:${HAUTEUR}px;pointer-events:none;`;
    document.body.appendChild(boite);
    const map = new maplibregl.Map({
      container: boite,
      style: styleSnap(),
      center: [3.06, 50.63],
      ...VUE,
      maxPitch: 60,
      interactive: false,
      attributionControl: false,
      pixelRatio: 2,
      fadeDuration: 0,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    });
    return new Promise<PlanMap>((ok) =>
      map.once("load", () => {
        // Sans noms de rues : une image, pas un plan à lire.
        for (const id of LIBELLES) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
        ok(map);
      })
    );
  });
  return plan;
}

async function suivante() {
  if (occupe) return;
  const t = file.shift();
  if (!t) return;
  occupe = true;
  try {
    const map = await lePlan();
    map.jumpTo({ center: [t.lng, t.lat], ...VUE });
    await new Promise<void>((ok) => {
      // Un plan qui ne se termine jamais (réseau coupé) rend quand même la main.
      const fin = window.setTimeout(ok, 8000);
      map.once("idle", () => {
        window.clearTimeout(fin);
        ok();
      });
    });
    const url = map.getCanvas().toDataURL("image/jpeg", 0.82);
    images.set(t.cle, url);
    for (const f of attentes.get(t.cle) ?? []) f(url);
  } catch {
    // Sans WebGL : la carte garde son dégradé.
  } finally {
    attentes.delete(t.cle);
    occupe = false;
    void suivante();
  }
}

function demander(lat: number, lng: number, f: (url: string) => void): () => void {
  const cle = cleDe(lat, lng);
  const deja = images.get(cle);
  if (deja) {
    f(deja);
    return () => {};
  }
  const liste = attentes.get(cle);
  if (liste) liste.push(f);
  else {
    attentes.set(cle, [f]);
    file.push({ cle, lat, lng });
    void suivante();
  }
  return () => {
    const l = attentes.get(cle);
    if (l) attentes.set(cle, l.filter((x) => x !== f));
  };
}

export function VueTerrain({ lat, lng, titre, className }: { lat: number; lng: number; /** Ce que dit l'image ; sans titre, elle est décorative. */ titre?: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(() => images.get(cleDe(lat, lng)) ?? null);
  useEffect(() => demander(lat, lng, setUrl), [lat, lng]);
  if (!url) return <div aria-hidden className={cn("bg-[#efebe1]", className)} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={titre ?? ""} aria-hidden={titre ? undefined : true} className={cn("object-cover", className)} draggable={false} />;
}
