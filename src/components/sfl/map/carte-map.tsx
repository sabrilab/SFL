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
//
// Le mouvement (17/10, Sabri veut une Map « plus animée ») : au premier
// cadrage, le plan vole de la France jusqu'aux matchs ; les stickers tombent
// ensuite un à un, du nord au sud. Toucher un sticker l'agrandit avec un
// ressort, lâche une onde sur le terrain et fait glisser le plan pour le
// poser au centre, au-dessus du carrousel. Changer de fond fait monter le
// nouveau en fondu sur l'ancien. Les classes sont dans app/map/animations.css ;
// « Réduire les animations » coupe le vol et les ressorts.

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SPLASH_FINI } from "@/components/sfl/app-splash";
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
/** La place des surcouches : lettrage en haut, carrousel en bas. */
const MARGE_HAUT = 140;
const MARGE_BAS = 380;
/** Le premier vol, et l'écart entre deux stickers qui tombent. */
const VOL = 1.5;
const CADENCE = 110;

const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  const effets = useRef<L.LayerGroup | null>(null);
  // L'entrée de chaque sticker, en ms après `origine` (la fin du premier
  // vol). Leaflet refait les stickers à chaque changement : on repose la
  // classe d'entrée, avec le retard qui reste, tant qu'elle n'est pas finie.
  const entrees = useRef(new Map<string, number>());
  const origine = useRef<number | null>(null);
  const toiVu = useRef(false);
  const dernierChoisi = useRef<string | null>(null);
  // Le premier vol : il attend que l'écran de chargement se lève, et vise le
  // dernier cadrage demandé d'ici là.
  const aVole = useRef(false);
  const volFini = useRef(Infinity);
  const cibleVol = useRef<L.LatLngBounds | null>(null);
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
    effets.current = L.layerGroup().addTo(map);
    const entreesAuMontage = entrees.current;
    return () => {
      map.remove();
      carte.current = null;
      calque.current = null;
      tuiles.current = null;
      effets.current = null;
      cadre.current = [];
      entreesAuMontage.clear();
      origine.current = null;
      toiVu.current = false;
      dernierChoisi.current = null;
      aVole.current = false;
      volFini.current = Infinity;
      cibleVol.current = null;
    };
  }, []);

  // Le fond : le plan clair, ou la vue satellite.
  useEffect(() => {
    const map = carte.current;
    const groupe = tuiles.current;
    if (!map || !groupe) return;
    // L'ancien fond reste dessous le temps que le nouveau monte en fondu.
    const anciens = groupe.getLayers();
    const entre = calme() ? "" : "fond-entre";
    if (fond === "satellite") {
      L.tileLayer(SATELLITE, { attribution: ATTRIBUTION, maxZoom: ZOOM_MAX.satellite, className: entre }).addTo(groupe);
    } else {
      L.tileLayer(FOND, { attribution: ATTRIBUTION, maxZoom: ZOOM_MAX.plan, className: entre }).addTo(groupe);
      L.tileLayer(LIBELLES, { maxZoom: ZOOM_MAX.plan, pane: "shadowPane", className: entre }).addTo(groupe);
    }
    map.setMaxZoom(ZOOM_MAX[fond]);
    if (!anciens.length) return;
    const t = window.setTimeout(() => anciens.forEach((l) => groupe.removeLayer(l)), entre ? 650 : 0);
    return () => {
      window.clearTimeout(t);
      anciens.forEach((l) => groupe.removeLayer(l));
    };
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
    const doux = !calme();
    // Les stickers tombent quand le premier vol se pose ; ceux qui arrivent
    // plus tard tombent à leur arrivée.
    const maintenant = performance.now();
    const depuis = origine.current == null ? 0 : maintenant - origine.current;
    let rang = 0;
    const avant = dernierChoisi.current;
    for (const s of [...stickers].sort((a, b) => b.lat - a.lat)) {
      const est = s.id === choisi;
      const icone = L.divIcon({
        className: "stk-ancre",
        iconSize: [0, 0],
        iconAnchor: [0, 0],
        html: stickerHtml(s, est, variante),
      });
      const m = L.marker([s.lat, s.lng], { icon: icone, keyboard: false, zIndexOffset: est ? 1000 : 0 }).addTo(groupe);
      m.on("click", () => {
        onde(s.lat, s.lng);
        choisirRef.current(s.id);
      });
      const el = m.getElement()?.querySelector<HTMLElement>(".stk");
      if (!entrees.current.has(s.id)) entrees.current.set(s.id, Math.max(0, depuis) + rang++ * CADENCE);
      if (el && doux) {
        const retard = (entrees.current.get(s.id) ?? 0) - depuis + (origine.current == null ? VOL * 1000 - 250 : 0);
        if (retard > -900) {
          el.classList.add("stk--entre");
          el.style.setProperty("--delai", `${Math.round(retard)}ms`);
        } else if (est && avant !== s.id) el.classList.add("stk--vient");
        else if (!est && avant === s.id) el.classList.add("stk--part");
      }
    }
    dernierChoisi.current = choisi;
    if (toi) {
      const icone = L.divIcon({ className: "toi-ancre", iconSize: [44, 59], iconAnchor: [22, 52], html: toiHtml(toi.note, toi.teinte) });
      const m = L.marker([toi.lat, toi.lng], { icon: icone, keyboard: false, interactive: false }).addTo(groupe);
      if (!toiVu.current && doux) m.getElement()?.querySelector(".toi")?.classList.add("toi--entre");
      toiVu.current = true;
    }

    // L'onde : trois anneaux qui partent du terrain touché, et un petit coup
    // sous le doigt là où le téléphone sait le faire.
    function onde(lat: number, lng: number) {
      navigator.vibrate?.(8);
      if (!doux || !effets.current) return;
      const clair = fond === "satellite" ? " onde--clair" : "";
      const icone = L.divIcon({ className: "stk-ancre", iconSize: [0, 0], iconAnchor: [0, 0], html: `<span class="onde${clair}"></span>`.repeat(3) });
      const fx = effets.current;
      const r = L.marker([lat, lng], { icon: icone, keyboard: false, interactive: false }).addTo(fx);
      window.setTimeout(() => fx.removeLayer(r), 1150);
    }

    const deps = [stickers, points, toi, choisi];
    if (deps.every((d, i) => d === cadre.current[i])) return;
    // Seul le choix a changé : le plan glisse pour poser le choisi au centre
    // de ce qui reste visible, sans changer de zoom.
    const seulLeChoix = aVole.current && deps.slice(0, 3).every((d, i) => d === cadre.current[i]);
    cadre.current = deps;
    if (seulLeChoix) {
      const s = stickers.find((x) => x.id === choisi);
      if (!s) return;
      const taille = map.getSize();
      const ici = map.latLngToContainerPoint([s.lat, s.lng]);
      const cible = L.point(taille.x / 2, (MARGE_HAUT + Math.max(MARGE_HAUT, taille.y - MARGE_BAS)) / 2 + 40);
      const ecart = ici.subtract(cible);
      if (Math.abs(ecart.x) + Math.abs(ecart.y) > 24) map.panBy(ecart, { animate: doux, duration: 0.7, easeLinearity: 0.12 });
      return;
    }

    const tous: L.LatLngTuple[] = [
      ...stickers.map((s) => [s.lat, s.lng] as L.LatLngTuple),
      ...points.map((p) => [p.lat, p.lng] as L.LatLngTuple),
      ...(toi ? [[toi.lat, toi.lng] as L.LatLngTuple] : []),
    ];
    // Le sticker choisi mérite l'écran : on cadre large autour de lui, les
    // surcouches (lettrage en haut, carrousel en bas) prennent leur place.
    const pad: L.FitBoundsOptions = { paddingTopLeft: [40, MARGE_HAUT], paddingBottomRight: [40, MARGE_BAS], maxZoom: 15 };
    // Un seul point compris : la boîte est réduite à lui, le zoom plafonne à 15
    // et le point se pose au-dessus des cartes du bas, pas derrière.
    // La première fois, on vole de la France jusqu'aux matchs.
    if (!tous.length) map.setView(FRANCE, 5);
    else if (aVole.current && maintenant < volFini.current) {
      // Le vol attend ou vole déjà : il visera ce nouveau cadrage.
      cibleVol.current = L.latLngBounds(tous);
    } else if (!aVole.current && doux) {
      aVole.current = true;
      cibleVol.current = L.latLngBounds(tous);
      const voler = () => {
        if (carte.current !== map || !cibleVol.current) return;
        origine.current = performance.now() + VOL * 1000 - 250;
        volFini.current = performance.now() + VOL * 1000;
        map.flyToBounds(cibleVol.current, { ...pad, duration: VOL, easeLinearity: 0.2 });
      };
      // Sous l'écran de chargement, le vol attend qu'il se lève (les
      // stickers, eux, sont en pause dans leur CSS jusque-là).
      if (document.documentElement.dataset.splash === "fini") voler();
      else window.addEventListener(SPLASH_FINI, voler, { once: true });
    } else {
      aVole.current = true;
      map.fitBounds(L.latLngBounds(tous), { ...pad, animate: doux });
    }
  }, [stickers, points, toi, choisi, fond, pointsActifs]);

  return <div ref={conteneur} className={className} role="region" aria-label="La Map des matchs" />;
}
