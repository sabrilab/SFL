"use client";

// La Map — le plan clair et ce qu'on pose dessus.
//
// Leaflet sur un fond clair et sobre (le « Light Gray » d'Esri, fond puis
// libellés), sans clé, sans boutons de zoom : on pince, comme dans l'app. Dessus, à la
// manière de la carte de « Jouer » de l'app iOS : le sticker mini-stade du
// match (vignette à bord blanc, pastille calendrier, badge braise du manque),
// les autres terrains en simples points, et « toi », ta carte en miniature,
// quand tu as donné ta position. Le composant ne connaît ni la saison ni la
// convocation : il reçoit des repères et les pose. Jamais rendu côté serveur
// (import dynamique dans app/map/page.tsx) : Leaflet a besoin de `window`.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { pointHtml, stickerHtml, toiHtml, type StickerPlan } from "./stade";

export interface PointPlan {
  id: string;
  lat: number;
  lng: number;
  nom: string;
}

export interface ToiPlan {
  lat: number;
  lng: number;
  note: number;
  teinte: string;
}

const FOND = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}";
const LIBELLES = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
/** Le « Light Gray » s'arrête au niveau 16 : assez pour voir le quartier du terrain. */
const ZOOM_MAX = 16;
/** Le centre quand rien n'est posé : la France entière. */
const FRANCE: L.LatLngTuple = [46.6, 2.4];

export function CarteMap({
  stickers,
  points,
  toi,
  choisi,
  onChoisir,
  className,
}: {
  stickers: StickerPlan[];
  points: PointPlan[];
  toi: ToiPlan | null;
  choisi: string | null;
  onChoisir: (id: string) => void;
  className?: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const calque = useRef<L.LayerGroup | null>(null);
  const choisirRef = useRef(onChoisir);
  useEffect(() => {
    choisirRef.current = onChoisir;
  }, [onChoisir]);

  // La carte, une fois.
  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    const map = L.map(conteneur.current, { zoomControl: false, attributionControl: true });
    L.tileLayer(FOND, { attribution: ATTRIBUTION, maxZoom: ZOOM_MAX }).addTo(map);
    L.tileLayer(LIBELLES, { maxZoom: ZOOM_MAX, pane: "shadowPane" }).addTo(map);
    map.setMaxZoom(ZOOM_MAX);
    map.attributionControl.setPrefix(false);
    map.setView(FRANCE, 5);
    carte.current = map;
    calque.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      carte.current = null;
      calque.current = null;
    };
  }, []);

  // Tout ce qui est posé, à chaque changement de la liste (la page la mémorise).
  useEffect(() => {
    const map = carte.current;
    const groupe = calque.current;
    if (!map || !groupe) return;
    groupe.clearLayers();

    for (const p of points) {
      const icone = L.divIcon({ className: "pt", iconSize: [0, 0], iconAnchor: [0, 0], html: pointHtml(p.nom) });
      L.marker([p.lat, p.lng], { icon: icone, keyboard: false, interactive: false }).addTo(groupe);
    }
    // Du nord au sud : le sud passe devant.
    for (const s of [...stickers].sort((a, b) => b.lat - a.lat)) {
      const est = s.id === choisi;
      const icone = L.divIcon({
        className: "stk-ancre",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: stickerHtml(s, est),
      });
      const m = L.marker([s.lat, s.lng], { icon: icone, keyboard: false, zIndexOffset: est ? 1000 : 0 }).addTo(groupe);
      m.on("click", () => choisirRef.current(s.id));
    }
    if (toi) {
      const icone = L.divIcon({ className: "toi-ancre", iconSize: [44, 59], iconAnchor: [22, 52], html: toiHtml(toi.note, toi.teinte) });
      L.marker([toi.lat, toi.lng], { icon: icone, keyboard: false, interactive: false }).addTo(groupe);
    }

    const tous: L.LatLngTuple[] = [
      ...stickers.map((s) => [s.lat, s.lng] as L.LatLngTuple),
      ...points.map((p) => [p.lat, p.lng] as L.LatLngTuple),
      ...(toi ? [[toi.lat, toi.lng] as L.LatLngTuple] : []),
    ];
    // Le sticker choisi mérite l'écran : on cadre large autour de lui, les
    // surcouches (lettrage en haut, carrousel en bas) prennent leur place.
    const pad: L.FitBoundsOptions = { paddingTopLeft: [40, 120], paddingBottomRight: [40, 230], maxZoom: 15 };
    if (tous.length === 1) map.setView(tous[0], 15, { animate: true });
    else if (tous.length > 1) map.fitBounds(L.latLngBounds(tous), { ...pad, animate: true });
    else map.setView(FRANCE, 5);
  }, [stickers, points, toi, choisi]);

  return <div ref={conteneur} className={className} role="region" aria-label="La Map des matchs" />;
}
