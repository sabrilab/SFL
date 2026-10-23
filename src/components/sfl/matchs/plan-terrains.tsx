"use client";

// Le plan des terrains, dans la feuille « Terrains du Nord »
// (choisir-terrain.tsx) : le plan de la Map (map/style-snap.ts), à plat,
// chaque complexe en point noir cerné de blanc, ceux de la ligue en blanc
// cerné de noir ; celui qu'on regarde se lève en mini-stade, son nom en
// étiquette (le repère des terrains de la Map, map/stade.ts). Toucher un
// point le met en tête de la liste ; déplacer le plan range la liste autour
// de ce qu'il montre.
//
// Les points sont une couche du plan (une source GeoJSON), pas des éléments
// HTML : cent cinquante repères ne coûtent rien. Jamais rendu côté serveur :
// MapLibre a besoin de `window` (import dynamique dans choisir-terrain.tsx).

import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map as PlanMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { styleSnap } from "@/components/sfl/map/style-snap";
import { pointHtml } from "@/components/sfl/map/stade";
import type { TerrainPropose } from "@/lib/sfl/terrains-nord";

const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Assez près pour lire les rues autour d'un complexe. */
const ZOOM_TERRAIN = 14;

function collection(terrains: TerrainPropose[]): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; ligue: boolean }> {
  return {
    type: "FeatureCollection",
    features: terrains.map((t) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [t.lng, t.lat] },
      properties: { id: t.id, ligue: t.ligue != null },
    })),
  };
}

export function PlanTerrains({
  terrains,
  focus,
  centre,
  cadrage,
  ici,
  onToucher,
  onDeplace,
  className,
}: {
  /** Les complexes montrés : tous, ou ceux de la recherche. */
  terrains: TerrainPropose[];
  /** Celui qu'on regarde : le plan s'y pose, en mini-stade. */
  focus: TerrainPropose | null;
  /** Le premier cadrage, puis chaque fois que `cadrage` change : la position trouvée. */
  centre: { lat: number; lng: number };
  /** Change pour recadrer : sur `centre`, ou sur tous les `terrains` (une recherche). */
  cadrage: { n: number; sur: "centre" | "terrains" };
  /** Ta position, quand tu l'as donnée. */
  ici: { lat: number; lng: number } | null;
  onToucher: (id: string) => void;
  /** Le plan déplacé au doigt : son nouveau centre. */
  onDeplace: (c: { lat: number; lng: number }) => void;
  className?: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<PlanMap | null>(null);
  const pret = useRef(false);
  const repere = useRef<Marker | null>(null);
  const toi = useRef<Marker | null>(null);
  const donnees = useRef(terrains);
  const rappels = useRef({ onToucher, onDeplace });
  useEffect(() => {
    rappels.current = { onToucher, onDeplace };
  }, [onToucher, onDeplace]);

  // Le plan, une fois.
  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    const map = new maplibregl.Map({
      container: conteneur.current,
      style: styleSnap(),
      center: [centre.lng, centre.lat],
      zoom: 10.4,
      minZoom: 6.5,
      maxZoom: 17,
      maxPitch: 0,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      fadeDuration: 150,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => {
      map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      map.addSource("terrains", { type: "geojson", data: collection(donnees.current) });
      map.addLayer({
        id: "terrains-points",
        type: "circle",
        source: "terrains",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 3, 11, 5, 15, 7],
          "circle-color": ["case", ["get", "ligue"], "#f4f5f2", "#0a0b0d"],
          "circle-stroke-color": ["case", ["get", "ligue"], "#0a0b0d", "#f4f5f2"],
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 7, 1, 12, 2],
        },
      });
      // Un doigt n'est pas une souris : la zone à toucher déborde du point.
      map.addLayer({
        id: "terrains-cibles",
        type: "circle",
        source: "terrains",
        paint: { "circle-radius": 16, "circle-color": "#000000", "circle-opacity": 0 },
      });
      pret.current = true;
    });
    map.on("click", "terrains-cibles", (e) => {
      const id = e.features?.[0]?.properties?.id;
      if (typeof id === "string") rappels.current.onToucher(id);
    });
    map.on("mouseenter", "terrains-cibles", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "terrains-cibles", () => (map.getCanvas().style.cursor = ""));
    // Seul un geste range la liste : un vol lancé par la page n'a pas d'événement d'origine.
    map.on("moveend", (e) => {
      if (!(e as { originalEvent?: Event }).originalEvent) return;
      const c = map.getCenter();
      rappels.current.onDeplace({ lat: c.lat, lng: c.lng });
    });
    carte.current = map;
    return () => {
      map.remove();
      carte.current = null;
      pret.current = false;
      repere.current = null;
      toi.current = null;
    };
    // Le plan se crée une fois ; le reste passe par les effets suivants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Les points : tous, ou ceux de la recherche.
  useEffect(() => {
    donnees.current = terrains;
    const map = carte.current;
    if (!map || !pret.current) return;
    (map.getSource("terrains") as GeoJSONSource | undefined)?.setData(collection(terrains));
  }, [terrains]);

  // Recadrer : sur le centre (ta position), ou sur les complexes trouvés.
  useEffect(() => {
    const map = carte.current;
    if (!map || cadrage.n === 0) return;
    const duree = calme() ? 0 : 700;
    if (cadrage.sur === "terrains" && terrains.length > 1) {
      const b = new maplibregl.LngLatBounds();
      for (const t of terrains) b.extend([t.lng, t.lat]);
      map.fitBounds(b, { padding: 36, maxZoom: 13, duration: duree });
    } else if (cadrage.sur === "terrains" && terrains.length === 1) {
      map.easeTo({ center: [terrains[0].lng, terrains[0].lat], zoom: ZOOM_TERRAIN, duration: duree });
    } else {
      map.easeTo({ center: [centre.lng, centre.lat], zoom: Math.max(map.getZoom(), 11), duration: duree });
    }
    // Seul le compteur décide d'un recadrage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadrage.n]);

  // Celui qu'on regarde : le mini-stade et son nom, et le plan qui s'y pose.
  useEffect(() => {
    const map = carte.current;
    if (!map) return;
    repere.current?.remove();
    repere.current = null;
    if (!focus) return;
    const el = document.createElement("div");
    el.className = "ter-ancre";
    el.style.width = "0px";
    el.style.height = "0px";
    el.style.zIndex = "2";
    el.innerHTML = pointHtml(focus.nom, "mono");
    el.addEventListener("click", () => rappels.current.onToucher(focus.id));
    repere.current = new maplibregl.Marker({ element: el, anchor: "top-left" }).setLngLat([focus.lng, focus.lat]).addTo(map);
    map.easeTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), ZOOM_TERRAIN - 1), duration: calme() ? 0 : 600 });
  }, [focus]);

  // Toi, quand tu as donné ta position : un point bleu, comme partout.
  useEffect(() => {
    const map = carte.current;
    if (!map) return;
    toi.current?.remove();
    toi.current = null;
    if (!ici) return;
    const el = document.createElement("div");
    el.className = "plan-terrains-toi";
    el.setAttribute("aria-hidden", "true");
    toi.current = new maplibregl.Marker({ element: el }).setLngLat([ici.lng, ici.lat]).addTo(map);
  }, [ici]);

  return <div ref={conteneur} className={className} role="application" aria-label="Le plan des terrains" />;
}
