"use client";

// Poser l'épingle pile sur le terrain, sur la photo satellite.
//
// Une recherche d'adresse donne l'entrée d'un lieu, pas son terrain : à
// l'hippodrome de Marcq, le point tombe au milieu de la piste, les terrains
// sont deux cents mètres plus loin. Ici l'admin voit la photo satellite et
// déplace l'épingle (ou touche le terrain) ; on garde le point qu'il pose.
// Jamais rendu côté serveur : Leaflet a besoin de `window`.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SATELLITE } from "./style-snap";

export function AjusterPoint({
  lat,
  lng,
  onChange,
  className,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  className?: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const epingle = useRef<L.Marker | null>(null);
  const rappel = useRef(onChange);
  useEffect(() => {
    rappel.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    const map = L.map(conteneur.current, { zoomControl: true, attributionControl: false }).setView([lat, lng], 17);
    L.tileLayer(SATELLITE, { maxZoom: 19, maxNativeZoom: 18 }).addTo(map);
    const icone = L.divIcon({ className: "ajuster-ancre", iconSize: [0, 0], iconAnchor: [0, 0], html: '<span class="ajuster-pin"></span>' });
    const m = L.marker([lat, lng], { icon: icone, draggable: true, autoPan: true }).addTo(map);
    m.on("dragend", () => {
      const p = m.getLatLng();
      rappel.current(p.lat, p.lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      m.setLatLng(e.latlng);
      rappel.current(e.latlng.lat, e.latlng.lng);
    });
    carte.current = map;
    epingle.current = m;
    return () => {
      map.remove();
      carte.current = null;
      epingle.current = null;
    };
    // La carte se crée une fois ; les changements de point passent par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Un nouveau lieu choisi dans la liste : on y recentre.
  useEffect(() => {
    const m = epingle.current;
    const map = carte.current;
    if (!m || !map) return;
    const actuel = m.getLatLng();
    if (Math.abs(actuel.lat - lat) > 1e-7 || Math.abs(actuel.lng - lng) > 1e-7) {
      m.setLatLng([lat, lng]);
      map.setView([lat, lng], Math.max(map.getZoom(), 17));
    }
  }, [lat, lng]);

  return <div ref={conteneur} className={className} role="application" aria-label="Photo satellite : déplace l'épingle sur le terrain" />;
}
