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
import { pointHtml, stickerHtml, toiHtml, type StickerPlan, type VarianteStade } from "./stade";

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
/** La vue satellite d'Esri, sans clé : on y voit le terrain lui-même. */
export const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, Maxar, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
/** Le « Light Gray » s'arrête au niveau 16 ; le satellite descend au terrain. */
const ZOOM_MAX = { plan: 16, satellite: 18 } as const;

export type FondCarte = "plan" | "satellite";
/** Le centre quand rien n'est posé : la France entière. */
const FRANCE: L.LatLngTuple = [46.6, 2.4];

export function CarteMap({
  stickers,
  points,
  toi,
  choisi,
  onChoisir,
  onPoint,
  fond = "plan",
  className,
}: {
  fond?: FondCarte;
  stickers: StickerPlan[];
  points: PointPlan[];
  toi: ToiPlan | null;
  choisi: string | null;
  onChoisir: (id: string) => void;
  /** Toucher un terrain libre (un match possible) ; sans elle, les terrains ne réagissent pas. */
  onPoint?: (id: string) => void;
  className?: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<L.Map | null>(null);
  const calque = useRef<L.LayerGroup | null>(null);
  const tuiles = useRef<L.LayerGroup | null>(null);
  const choisirRef = useRef(onChoisir);
  const pointRef = useRef(onPoint);
  // Ce qui a été cadré la dernière fois : changer de fond redessine les
  // stades sans recadrer.
  const cadre = useRef<unknown[]>([]);
  useEffect(() => {
    choisirRef.current = onChoisir;
    pointRef.current = onPoint;
  }, [onChoisir, onPoint]);
  const pointsActifs = !!onPoint;

  // La carte, une fois.
  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    const map = L.map(conteneur.current, { zoomControl: false, attributionControl: true });
    map.attributionControl.setPrefix(false);
    map.setView(FRANCE, 5);
    carte.current = map;
    tuiles.current = L.layerGroup().addTo(map);
    calque.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      carte.current = null;
      calque.current = null;
      tuiles.current = null;
      cadre.current = [];
    };
  }, []);

  // Le fond : le plan clair, ou la vue satellite.
  useEffect(() => {
    const map = carte.current;
    const groupe = tuiles.current;
    if (!map || !groupe) return;
    groupe.clearLayers();
    if (fond === "satellite") {
      L.tileLayer(SATELLITE, { attribution: ATTRIBUTION, maxZoom: ZOOM_MAX.satellite }).addTo(groupe);
    } else {
      L.tileLayer(FOND, { attribution: ATTRIBUTION, maxZoom: ZOOM_MAX.plan }).addTo(groupe);
      L.tileLayer(LIBELLES, { maxZoom: ZOOM_MAX.plan, pane: "shadowPane" }).addTo(groupe);
    }
    map.setMaxZoom(ZOOM_MAX[fond]);
  }, [fond]);

  // Tout ce qui est posé, à chaque changement de la liste (la page la mémorise).
  useEffect(() => {
    const map = carte.current;
    const groupe = calque.current;
    if (!map || !groupe) return;
    groupe.clearLayers();
    // Noir et blanc sur le plan clair, marbre sur le satellite sombre.
    const variante: VarianteStade = fond === "satellite" ? "marbre" : "mono";

    for (const p of points) {
      const icone = L.divIcon({ className: "ter-ancre", iconSize: [0, 0], iconAnchor: [0, 0], html: pointHtml(p.nom, variante) });
      const m = L.marker([p.lat, p.lng], { icon: icone, keyboard: false, interactive: pointsActifs }).addTo(groupe);
      if (pointsActifs) m.on("click", () => pointRef.current?.(p.id));
    }
    // Du nord au sud : le sud passe devant.
    for (const s of [...stickers].sort((a, b) => b.lat - a.lat)) {
      const est = s.id === choisi;
      const icone = L.divIcon({
        className: "stk-ancre",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: stickerHtml(s, est, variante),
      });
      const m = L.marker([s.lat, s.lng], { icon: icone, keyboard: false, zIndexOffset: est ? 1000 : 0 }).addTo(groupe);
      m.on("click", () => choisirRef.current(s.id));
    }
    if (toi) {
      const icone = L.divIcon({ className: "toi-ancre", iconSize: [44, 59], iconAnchor: [22, 52], html: toiHtml(toi.note, toi.teinte) });
      L.marker([toi.lat, toi.lng], { icon: icone, keyboard: false, interactive: false }).addTo(groupe);
    }

    const deps = [stickers, points, toi, choisi];
    if (deps.every((d, i) => d === cadre.current[i])) return;
    cadre.current = deps;

    const tous: L.LatLngTuple[] = [
      ...stickers.map((s) => [s.lat, s.lng] as L.LatLngTuple),
      ...points.map((p) => [p.lat, p.lng] as L.LatLngTuple),
      ...(toi ? [[toi.lat, toi.lng] as L.LatLngTuple] : []),
    ];
    // Le sticker choisi mérite l'écran : on cadre large autour de lui, les
    // surcouches (lettrage en haut, carrousel en bas) prennent leur place.
    const pad: L.FitBoundsOptions = { paddingTopLeft: [40, 140], paddingBottomRight: [40, 380], maxZoom: 15 };
    // Un seul point compris : la boîte est réduite à lui, le zoom plafonne à 15
    // et le point se pose au-dessus des cartes du bas, pas derrière.
    if (tous.length) map.fitBounds(L.latLngBounds(tous), { ...pad, animate: true });
    else map.setView(FRANCE, 5);
  }, [stickers, points, toi, choisi, fond, pointsActifs]);

  return <div ref={conteneur} className={className} role="region" aria-label="La Map des matchs" />;
}
