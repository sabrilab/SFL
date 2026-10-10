"use client";

// La Map — le fond de carte sombre et les repères de la ligue.
//
// Leaflet sur des tuiles CARTO « dark matter » (OpenStreetMap), sans clé.
// Chaque terrain est un point Blanc Craie avec son nom à la machine à écrire ;
// celui du prochain match bat doucement. Le composant ne connaît ni la saison
// ni la convocation : il reçoit des repères et les pose. Il n'est jamais rendu
// côté serveur (voir l'import dynamique dans app/map/page.tsx) — Leaflet a
// besoin de `window`.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface Repere {
  id: number;
  lat: number;
  lng: number;
  nom: string;
  /** Le terrain du prochain match : mis en avant. */
  match?: boolean;
  /** Une ligne sous le nom dans la bulle (journée, heure). */
  sousTitre?: string;
}

const TUILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
/** Le centre quand aucun terrain n'est posé : la France entière. */
const FRANCE: L.LatLngTuple = [46.6, 2.4];

const echapper = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function CarteMap({ reperes, className }: { reperes: Repere[]; className?: string }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const calque = useRef<L.LayerGroup | null>(null);

  // La carte, une fois.
  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    const map = L.map(conteneur.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    L.tileLayer(TUILES, { attribution: ATTRIBUTION, subdomains: "abcd", maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.setView(FRANCE, 5);
    carte.current = map;
    calque.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      carte.current = null;
      calque.current = null;
    };
  }, []);

  // Les repères, à chaque changement de la liste. La page la mémorise : la
  // carte n'est recadrée que quand un terrain ou le match change, jamais sous
  // le doigt de l'utilisateur.
  useEffect(() => {
    const map = carte.current;
    const groupe = calque.current;
    if (!map || !groupe) return;
    groupe.clearLayers();
    const points = reperes;
    for (const r of points) {
      const icone = L.divIcon({
        className: "bola-pin",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        popupAnchor: [0, -14],
        html: `<span class="bola-pin__dot${r.match ? " bola-pin__dot--match" : ""}"></span><span class="bola-pin__nom">${echapper(r.nom)}</span>`,
      });
      const bulle = `<strong>${echapper(r.nom)}</strong>${r.sousTitre ? `<br>${echapper(r.sousTitre)}` : ""}`;
      L.marker([r.lat, r.lng], { icon: icone, keyboard: false }).addTo(groupe).bindPopup(bulle);
    }
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15);
    else if (points.length > 1)
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as L.LatLngTuple)), { padding: [56, 56], maxZoom: 15 });
    else map.setView(FRANCE, 5);
  }, [reperes]);

  return <div ref={conteneur} className={className} role="region" aria-label="La Map des terrains" />;
}
