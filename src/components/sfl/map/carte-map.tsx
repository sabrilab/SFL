"use client";

// La Map — le plan et ce qu'on pose dessus.
//
// MapLibre sur notre propre plan (map/style-snap.ts, le 22/10 : Sabri la
// voulait « plus mignonne, plus accueillante », à la Snapchat, avec du
// relief) : des tuiles vectorielles d'OpenStreetMap, sans clé, dessinées en
// pastel ; en s'approchant, les bâtiments se lèvent et le plan s'incline
// (PENTE), comme la Snap Map. Ni boutons de zoom ni rotation : on pince, et
// deux doigts qui glissent inclinent le plan. Sur un ordinateur (22/10,
// map/gestes-ordinateur.ts), le pavé tactile déplace le plan, le pincement et
// la molette zooment, et le plan s'incline de lui-même en s'approchant (rien
// ne l'incline à la main). Dessus, à la manière de la
// carte de « Jouer » de l'app iOS : le sticker mini-stade du match (vignette
// à bord blanc, pastille calendrier, badge braise du manque), les autres
// terrains en simples points, et « toi », ta carte en miniature, quand tu as
// donné ta position. Ce sont des éléments HTML (les marqueurs de MapLibre),
// toujours debout face à l'écran. Le composant ne connaît ni la saison ni la
// convocation : il reçoit des repères et les pose. Jamais rendu côté serveur
// (import dynamique dans app/map/page.tsx) : MapLibre a besoin de `window`.
//
// Le mouvement (17/10, Sabri veut une Map « plus animée ») : au premier
// cadrage, le plan vole de la France jusqu'aux matchs ; les stickers tombent
// ensuite un à un, du nord au sud. Toucher un sticker l'agrandit avec un
// ressort, lâche une onde sur le terrain et fait glisser le plan pour le
// poser au centre, au-dessus du carrousel. Changer de fond fait monter la
// photo satellite en fondu sur le plan (une couche du même style). Les
// classes sont dans app/map/animations.css ; « Réduire les animations »
// coupe le vol et les ressorts.
//
// La discussion d'un match dont je suis (22/10) : une bulle de messages au
// coin de son sticker (map/stade.ts), qui saute quand un message arrive ;
// la toucher ouvre la discussion.
//
// Les joueurs (22/10, façon Snap Map) : chacun dans sa ville, sous les
// matchs. De loin des piles, de près des tournesols de cartes (la
// disposition est dans map/joueurs.ts), refaits à chaque fin de zoom.
// Toucher une pile approche la ville ; toucher le nom d'une ville ouverte ou
// une carte, la page ouvre le catalogue ou le profil.
//
// Les terrains où l'on peut ouvrir un match (23/10, Sabri : « en mode grisé,
// comme s'il fallait ouvrir le match ») : tous ceux du Nord
// (lib/sfl/terrains-nord.ts), sauf ceux qui ont déjà le leur. De loin des
// points ; en s'approchant, des stickers vides (map/stade.ts, fantomeSvg) ;
// tout près, leur nom. Ce sont des couches du plan, pas des éléments HTML :
// cent cinquante terrains ne coûtent rien, restent sous les matchs, les
// joueurs et toi, et s'effacent l'un devant l'autre quand ils se
// chevauchent. Toucher un terrain lâche l'onde et le lève en mini-stade,
// son nom à côté, au-dessus de la fiche que la page ouvre.

import { useEffect, useRef } from "react";
import maplibregl, { type LngLatBoundsLike, type Map as PlanMap, type Marker, type PaddingOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SPLASH_FINI } from "@/components/sfl/app-splash";
import { couleurFantome, fantomeSvg, pointHtml, stickerHtml, toiHtml, type StickerPlan, type TeinteFantome, type VarianteStade } from "./stade";
import {
  centreHtml,
  disposer,
  FUSION_PILE,
  groupeHtml,
  grouperMatchs,
  joueurHtml,
  OUVERTE_MAX,
  pileHtml,
  R_STICKER,
  ZOOM_OUVERTURE,
  type VillePlan,
} from "./joueurs";
import { gestesOrdinateur } from "./gestes-ordinateur";
import { FONDU, LIBELLES, styleSnap } from "./style-snap";

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

/** Un terrain où l'on peut ouvrir un match. */
export interface PossiblePlan {
  id: string;
  lat: number;
  lng: number;
  nom: string;
  /** Qui passe devant quand deux se chevauchent : le plus petit (la ligue, puis les plus grands complexes). */
  rang: number;
}

export type FondCarte = "plan" | "satellite";
/** Le centre quand rien n'est posé : la France entière. */
const FRANCE: [number, number] = [2.4, 46.6];
const ZOOM_FRANCE = 4;
/** Le zoom le plus proche (la photo satellite s'arrête là). */
const ZOOM_MAX = 17.5;
/** Le cadrage des matchs ne descend pas plus près que la rue. */
const ZOOM_CADRE = 14;
/** La place des surcouches : lettrage en haut, carrousel en bas. */
const MARGE_HAUT = 140;
const MARGE_BAS = 380;
/** Le premier vol, et l'écart entre deux stickers qui tombent. */
const VOL = 1.5;
const CADENCE = 110;
/**
 * Les terrains possibles : des points jusque-là, des stickers vides au-delà ;
 * leur nom, de tout près (un zoom entier : le texte se calcule au zoom des
 * tuiles, un nom réglé à 14,5 n'apparaissait qu'à 15).
 */
const ZOOM_FANTOMES = 11.5;
const ZOOM_NOMS = 15;
const COUCHES_POSSIBLES = ["possibles", "possibles-points"];

/** L'inclinaison du plan : à plat de loin, penché sur la ville, comme la Snap Map. */
function pente(zoom: number): number {
  return Math.min(1, Math.max(0, (zoom - 9) / 4)) * 45;
}

const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Un repère HTML posé sur le plan, ancré par son coin (les dessins se placent eux-mêmes). */
function repere(
  map: PlanMap,
  lat: number,
  lng: number,
  html: string,
  { classe, z = 0, actif = true, taille, ancre }: { classe: string; z?: number; actif?: boolean; taille?: [number, number]; ancre?: [number, number] }
): Marker {
  const el = document.createElement("div");
  el.className = classe;
  el.innerHTML = html;
  el.style.width = `${taille?.[0] ?? 0}px`;
  el.style.height = `${taille?.[1] ?? 0}px`;
  el.style.zIndex = String(z);
  if (!actif) el.style.pointerEvents = "none";
  return new maplibregl.Marker({ element: el, anchor: "top-left", offset: ancre ? [-ancre[0], -ancre[1]] : [0, 0] }).setLngLat([lng, lat]).addTo(map);
}

/** Les marges des surcouches, sans jamais dépasser l'écran (MapLibre refuse un cadre impossible). */
function marges(map: PlanMap, haut: number, bas: number, cote = 40): PaddingOptions {
  const h = map.getContainer().clientHeight;
  const w = map.getContainer().clientWidth;
  const b = Math.max(0, Math.min(bas, h - haut - 80));
  return { top: Math.min(haut, h / 3), bottom: b, left: Math.min(cote, w / 4), right: Math.min(cote, w / 4) };
}

/** L'onde : trois anneaux qui partent du terrain touché, et un petit coup sous le doigt là où le téléphone sait le faire. */
function onde(map: PlanMap, lat: number, lng: number, clair: boolean) {
  navigator.vibrate?.(8);
  if (calme()) return;
  const r = repere(map, lat, lng, `<span class="onde${clair ? " onde--clair" : ""}"></span>`.repeat(3), { classe: "stk-ancre", z: 2, actif: false });
  window.setTimeout(() => r.remove(), 1150);
}

function collectionPossibles(possibles: PossiblePlan[]): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; nom: string; rang: number }> {
  return {
    type: "FeatureCollection",
    features: possibles.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { id: p.id, nom: p.nom, rang: p.rang },
    })),
  };
}

function imageSvg(svg: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = ko;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/**
 * Les couches des terrains possibles, posées tout en haut du style (sous les
 * repères HTML, toujours au-dessus) : les points, puis les stickers vides et
 * leur nom. Les quatre images (gris ou ciel, plan ou satellite) d'abord.
 */
async function poserPossibles(map: PlanMap, donnees: () => PossiblePlan[], encore: () => boolean): Promise<boolean> {
  const tons = (["gris", "ciel"] as const).flatMap((t) => (["plan", "satellite"] as const).map((f) => [t, f] as const));
  const images = await Promise.all(tons.map(([t, f]) => imageSvg(fantomeSvg(t, f)).then((img) => [`fantome-${t}-${f}`, img] as const)));
  if (!encore() || map.getSource("possibles")) return false;
  for (const [nom, img] of images) if (!map.hasImage(nom)) map.addImage(nom, img, { pixelRatio: 2 });
  map.addSource("possibles", { type: "geojson", data: collectionPossibles(donnees()) });
  map.addLayer({
    id: "possibles-points",
    type: "circle",
    source: "possibles",
    minzoom: 7,
    maxzoom: ZOOM_FANTOMES + 0.5,
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 2, ZOOM_FANTOMES, 3.4],
      "circle-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 0.6, ZOOM_FANTOMES, 0.6, ZOOM_FANTOMES + 0.5, 0],
      "circle-stroke-width": 1.2,
      "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 0.9, ZOOM_FANTOMES, 0.9, ZOOM_FANTOMES + 0.5, 0],
    },
  });
  map.addLayer({
    id: "possibles",
    type: "symbol",
    source: "possibles",
    minzoom: ZOOM_FANTOMES,
    layout: {
      "icon-image": "fantome-gris-plan",
      "icon-anchor": "bottom",
      "icon-size": ["interpolate", ["linear"], ["zoom"], ZOOM_FANTOMES, 0.6, 13.5, 0.8, 16, 1],
      // Deux terrains qui se chevauchent : le premier rang reste. Les noms
      // des rues et des villes, eux, se posent par-dessus sans les chasser.
      "icon-allow-overlap": false,
      "icon-ignore-placement": true,
      "icon-padding": 3,
      "icon-pitch-alignment": "viewport",
      "icon-rotation-alignment": "viewport",
      "symbol-sort-key": ["get", "rang"],
      "text-field": ["step", ["zoom"], "", ZOOM_NOMS, ["get", "nom"]],
      "text-font": ["Noto Sans Bold"],
      "text-size": 11,
      "text-anchor": "top",
      "text-offset": [0, 0.35],
      "text-max-width": 9,
      "text-optional": true,
    },
    paint: {
      "icon-opacity": ["interpolate", ["linear"], ["zoom"], ZOOM_FANTOMES, 0, ZOOM_FANTOMES + 0.5, 1],
      "text-halo-width": 1.4,
    },
  });
  return true;
}

/** Le ton des terrains possibles, selon le fond (et le gris ou le ciel). */
function teinterPossibles(map: PlanMap, fond: FondCarte, teinte: TeinteFantome) {
  if (!map.getLayer("possibles")) return;
  const sat = fond === "satellite";
  const trait = couleurFantome(teinte, fond);
  map.setLayoutProperty("possibles", "icon-image", `fantome-${teinte}-${fond}`);
  map.setPaintProperty("possibles-points", "circle-color", trait);
  map.setPaintProperty("possibles-points", "circle-stroke-color", sat ? "rgba(10, 11, 13, 0.7)" : "#ffffff");
  map.setPaintProperty("possibles", "text-color", sat ? "#f4f5f2" : teinte === "ciel" ? "#1673d6" : "#55575c");
  map.setPaintProperty("possibles", "text-halo-color", sat ? "rgba(10, 11, 13, 0.85)" : "#ffffff");
}

/** Voler (ou sauter, en mouvement réduit) sur une boîte, le plan incliné selon le zoom atteint. */
function cadrer(map: PlanMap, boite: LngLatBoundsLike, padding: PaddingOptions, maxZoom: number, duree: number) {
  const cam = map.cameraForBounds(boite, { padding, maxZoom });
  if (!cam) return;
  const zoom = Math.min(maxZoom, cam.zoom ?? map.getZoom());
  const vise = { center: cam.center, zoom, pitch: pente(zoom), bearing: 0 };
  if (duree > 0) map.flyTo({ ...vise, duration: duree * 1000, essential: false });
  else map.jumpTo(vise);
}

const AUCUN_POSSIBLE: PossiblePlan[] = [];

export function CarteMap({
  stickers,
  points,
  toi,
  choisi,
  onChoisir,
  onBulle,
  onPoint,
  fond = "plan",
  villes = [],
  onVille,
  onJoueur,
  viser,
  cadrerSur,
  matchsEnRetrait = false,
  margeBas = MARGE_BAS,
  possibles = AUCUN_POSSIBLE,
  possibleChoisi = null,
  onPossible,
  teinteFantome = "gris",
  className,
}: {
  fond?: FondCarte;
  /** Les terrains où l'on peut ouvrir un match, sans ceux qui ont déjà le leur. */
  possibles?: PossiblePlan[];
  /** Le terrain possible touché, dont la page montre la fiche : il se lève en mini-stade. */
  possibleChoisi?: string | null;
  onPossible?: (id: string) => void;
  /** Le gris du plan, ou le bleu du ciel. */
  teinteFantome?: TeinteFantome;
  /** Les joueurs, ville par ville. */
  villes?: VillePlan[];
  /** Toucher le nom d'une ville ouverte (ou une pile tout au bout du zoom) : ses dossiers. */
  onVille?: (ids: string[]) => void;
  onJoueur?: (name: string) => void;
  /** Aller voir une ville choisie ailleurs (le catalogue) ; `n` change à chaque demande. */
  viser?: { lat: number; lng: number; n: number } | null;
  /** Cadrer sur des lieux choisis ailleurs (le filtre Contrats : ses cibles) ; `n` change à chaque demande, `null` revient sur les matchs. */
  cadrerSur?: { lieux: { lat: number; lng: number }[]; n: number } | null;
  /** Les matchs s'effacent du plan (le filtre Contrats) : les joueurs ne se rangent plus sous leurs stickers. */
  matchsEnRetrait?: boolean;
  stickers: StickerPlan[];
  points: PointPlan[];
  toi: ToiPlan | null;
  choisi: string | null;
  onChoisir: (id: string) => void;
  /** Toucher la bulle de messages d'un match : sa discussion. */
  onBulle?: (id: string) => void;
  /** Toucher un terrain libre (un match possible) ; sans elle, les terrains ne réagissent pas. */
  onPoint?: (id: string) => void;
  /** La place que prennent les surcouches du bas (moins quand le carrousel est replié). */
  margeBas?: number;
  className?: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carte = useRef<PlanMap | null>(null);
  const reperes = useRef<Marker[]>([]);
  const joueursReperes = useRef<Marker[]>([]);
  // Les stickers posés, et le groupe que chacun mène quand des matchs se
  // chevauchent (ses ids, et les villes de joueurs rangées dessous).
  const stickersPoses = useRef<{ s: StickerPlan; el: HTMLElement }[]>([]);
  const groupeDe = useRef(new Map<string, { ids: string[]; villes: string[] }>());
  const choisiRef = useRef(choisi);
  // Tout recomposer (regroupements et joueurs) : à chaque fin de zoom, et quand la liste change.
  const recomposer = useRef<() => void>(() => {});
  const margeBasRef = useRef(margeBas);
  // L'entrée de chaque sticker, en ms après `origine` (la fin du premier
  // vol). Les stickers sont refaits à chaque changement : on repose la
  // classe d'entrée, avec le retard qui reste, tant qu'elle n'est pas finie.
  const entrees = useRef(new Map<string, number>());
  const origine = useRef<number | null>(null);
  const toiVu = useRef(false);
  const dernierChoisi = useRef<string | null>(null);
  // Le premier vol : il attend que l'écran de chargement se lève, et vise le
  // dernier cadrage demandé d'ici là.
  const aVole = useRef(false);
  const volFini = useRef(Infinity);
  const cibleVol = useRef<maplibregl.LngLatBounds | null>(null);
  const choisirRef = useRef(onChoisir);
  const bulleRef = useRef(onBulle);
  // Les messages pas lus de chaque match, la dernière fois : la bulle saute quand il y en a plus.
  const nonLusVus = useRef(new Map<string, number>());
  const pointRef = useRef(onPoint);
  const villeRef = useRef(onVille);
  const joueurRef = useRef(onJoueur);
  const fondRef = useRef(fond);
  // Les villes déjà ouvertes : seules celles qui s'ouvrent lâchent leurs cartes.
  const ouvertes = useRef(new Set<string>());
  // Ce qui a été cadré la dernière fois : changer de fond redessine les
  // stades sans recadrer.
  const cadre = useRef<unknown[]>([]);
  // Le dernier cadrage des matchs : on y revient après avoir cadré ailleurs (cadrerSur).
  const maison = useRef<maplibregl.LngLatBounds | null>(null);
  const ailleurs = useRef(false);
  const retraitRef = useRef(matchsEnRetrait);
  // Les terrains possibles : leurs données et leur ton, lus quand leurs
  // couches se posent ; celui qui est levé, et le filtre qui l'ôte des couches.
  const possiblesRef = useRef(possibles);
  const possibleRef = useRef(onPossible);
  const teinteRef = useRef(teinteFantome);
  const leve = useRef<Marker | null>(null);
  const filtreLeve = useRef<maplibregl.FilterSpecification | null>(null);
  useEffect(() => {
    choisirRef.current = onChoisir;
    bulleRef.current = onBulle;
    pointRef.current = onPoint;
    villeRef.current = onVille;
    joueurRef.current = onJoueur;
    possibleRef.current = onPossible;
    margeBasRef.current = margeBas;
    retraitRef.current = matchsEnRetrait;
  }, [onChoisir, onBulle, onPoint, onVille, onJoueur, onPossible, margeBas, matchsEnRetrait]);
  const pointsActifs = !!onPoint;

  // La carte, une fois.
  useEffect(() => {
    if (!conteneur.current || carte.current) return;
    // Un ordinateur : ni doigts ni écran tactile.
    const ordinateur = navigator.maxTouchPoints === 0;
    const map = new maplibregl.Map({
      container: conteneur.current,
      style: styleSnap(),
      center: FRANCE,
      zoom: ZOOM_FRANCE,
      maxZoom: ZOOM_MAX,
      maxPitch: 60,
      attributionControl: false,
      dragRotate: false,
      // Un téléphone à 3× dessine trois fois plus pour un œil qui n'y voit pas mieux.
      pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      fadeDuration: 180,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.on("load", () => {
      appliquerFond(map, fondRef.current, false);
      // L'attribution reste repliée en un petit « i » : elle s'ouvre au toucher.
      map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      poserPossibles(map, () => possiblesRef.current, () => carte.current === map)
        .then((pose) => {
          if (!pose) return;
          teinterPossibles(map, fondRef.current, teinteRef.current);
          for (const id of COUCHES_POSSIBLES) map.setFilter(id, filtreLeve.current);
        })
        .catch(() => {});
    });
    // Toucher un terrain possible : le plus proche du doigt, dans un carré
    // de 36 px (un point de loin est petit sous le doigt). Un sticker, une
    // carte ou toi, posés dessus, gardent le toucher pour eux.
    map.on("click", (e) => {
      const toucher = possibleRef.current;
      if (!toucher || !map.getLayer("possibles")) return;
      const cible = e.originalEvent?.target;
      if (cible instanceof Element && cible.closest(".maplibregl-marker")) return;
      const r = 18;
      const vus = map.queryRenderedFeatures(
        [
          [e.point.x - r, e.point.y - r],
          [e.point.x + r, e.point.y + r],
        ],
        { layers: COUCHES_POSSIBLES }
      );
      let mieux: { id: string; lat: number; lng: number; d: number } | null = null;
      for (const v of vus) {
        const id = v.properties?.id;
        if (typeof id !== "string" || v.geometry.type !== "Point") continue;
        const [lng, lat] = v.geometry.coordinates;
        const p = map.project([lng, lat]);
        // Le sticker vide se dessine au-dessus de son point.
        const d = Math.hypot(p.x - e.point.x, p.y - (v.layer.id === "possibles" ? 20 : 0) - e.point.y);
        if (!mieux || d < mieux.d) mieux = { id, lat, lng, d };
      }
      if (!mieux) return;
      onde(map, mieux.lat, mieux.lng, fondRef.current === "satellite");
      toucher(mieux.id);
    });
    map.on("mouseenter", "possibles", () => possibleRef.current && (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "possibles", () => (map.getCanvas().style.cursor = ""));
    // Au doigt, deux doigts inclinent le plan ; sur un ordinateur, il suit le zoom.
    const debrancher = gestesOrdinateur(map, ordinateur ? pente : null);
    // Une vignette qui ne vient pas (l'optimiseur d'images au bout de son
    // forfait) : la photo entière, gardée dans `data-secours` (map/joueurs.ts).
    const secours = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.dataset.secours) return;
      img.src = img.dataset.secours;
      delete img.dataset.secours;
    };
    map.getContainer().addEventListener("error", secours, true);
    carte.current = map;
    // Captures en développement : viser une ville à la main.
    if (process.env.NODE_ENV === "development") (window as unknown as { __bolaMap?: PlanMap }).__bolaMap = map;
    const entreesAuMontage = entrees.current;
    return () => {
      debrancher();
      map.getContainer().removeEventListener("error", secours, true);
      map.remove();
      carte.current = null;
      reperes.current = [];
      joueursReperes.current = [];
      cadre.current = [];
      entreesAuMontage.clear();
      origine.current = null;
      toiVu.current = false;
      dernierChoisi.current = null;
      aVole.current = false;
      volFini.current = Infinity;
      cibleVol.current = null;
      leve.current = null;
    };
  }, []);

  // Le fond : le plan, ou la vue satellite qui monte en fondu dessus.
  useEffect(() => {
    fondRef.current = fond;
    const map = carte.current;
    if (!map) return;
    map.getContainer().classList.toggle("fond-satellite", fond === "satellite");
    if (!map.isStyleLoaded()) return;
    teinterPossibles(map, fond, teinteRef.current);
    return appliquerFond(map, fond, !calme());
  }, [fond]);

  // Les terrains possibles : leurs données, puis leur ton.
  useEffect(() => {
    possiblesRef.current = possibles;
    const source = carte.current?.getSource("possibles");
    if (source && "setData" in source) (source as maplibregl.GeoJSONSource).setData(collectionPossibles(possibles));
  }, [possibles]);
  useEffect(() => {
    teinteRef.current = teinteFantome;
    const map = carte.current;
    if (map) teinterPossibles(map, fondRef.current, teinteFantome);
  }, [teinteFantome]);

  // Le terrain possible touché se lève : le mini-stade et son nom, à sa
  // place, et le plan glisse pour le poser au-dessus de la fiche qui monte.
  useEffect(() => {
    const map = carte.current;
    if (!map) return;
    leve.current?.remove();
    leve.current = null;
    const p = possibleChoisi ? possiblesRef.current.find((x) => x.id === possibleChoisi) : undefined;
    filtreLeve.current = p ? ["!=", ["get", "id"], p.id] : null;
    for (const id of COUCHES_POSSIBLES) if (map.getLayer(id)) map.setFilter(id, filtreLeve.current);
    if (!p) return;
    const variante: VarianteStade = fondRef.current === "satellite" ? "marbre" : "mono";
    leve.current = repere(map, p.lat, p.lng, pointHtml(p.nom, variante), { classe: "ter-ancre", z: 2, actif: false });
    const h = map.getContainer().clientHeight;
    const ici = map.project([p.lng, p.lat]);
    const cible = { x: map.getContainer().clientWidth / 2, y: Math.max(MARGE_HAUT + 50, h * 0.3) };
    const ecart: [number, number] = [ici.x - cible.x, ici.y - cible.y];
    if (Math.abs(ecart[0]) + Math.abs(ecart[1]) > 24) map.panBy(ecart, { duration: calme() ? 0 : 650 });
  }, [possibleChoisi]);

  // Tout ce qui est posé, à chaque changement de la liste (la page la mémorise).
  useEffect(() => {
    const map = carte.current;
    if (!map) return;
    reperes.current.forEach((m) => m.remove());
    const poses: Marker[] = [];
    // Noir et blanc sur le plan clair, marbre sur le satellite sombre.
    const variante: VarianteStade = fond === "satellite" ? "marbre" : "mono";

    for (const p of points) {
      const m = repere(map, p.lat, p.lng, pointHtml(p.nom, variante), { classe: "ter-ancre", z: 1, actif: pointsActifs });
      if (pointsActifs) m.getElement().addEventListener("click", () => pointRef.current?.(p.id));
      poses.push(m);
    }
    // Du nord au sud : le sud passe devant.
    const doux = !calme();
    // Les stickers tombent quand le premier vol se pose ; ceux qui arrivent
    // plus tard tombent à leur arrivée.
    const maintenant = performance.now();
    const depuis = origine.current == null ? 0 : maintenant - origine.current;
    let rang = 0;
    const avant = dernierChoisi.current;
    const ordre = [...stickers].sort((a, b) => b.lat - a.lat);
    const stickersVus: { s: StickerPlan; el: HTMLElement }[] = [];
    ordre.forEach((s, k) => {
      const est = s.id === choisi;
      const m = repere(map, s.lat, s.lng, stickerHtml(s, est, variante), { classe: "stk-ancre", z: est ? 3 + ordre.length : 3 + k });
      m.getElement().addEventListener("click", (e) => {
        // Sa bulle de messages : droit à la discussion.
        if (bulleRef.current && (e.target as HTMLElement).closest(".stk__bulle")) {
          navigator.vibrate?.(6);
          bulleRef.current(s.id);
          return;
        }
        // Un sticker qui en range d'autres : s'approcher pour les séparer ;
        // sa pastille de joueurs seuls ouvre leurs villes.
        const g = groupeDe.current.get(s.id);
        if (g && (g.ids.length > 1 || (g.villes.length && (e.target as HTMLElement).closest(".stk__groupe")))) {
          navigator.vibrate?.(6);
          if (g.ids.length === 1 || map.getZoom() >= map.getMaxZoom() - 0.5) {
            if (g.villes.length) villeRef.current?.(g.villes);
            else choisirRef.current(s.id);
            return;
          }
          const dans = stickers.filter((x) => g.ids.includes(x.id));
          const b = dans.reduce((x, v) => x.extend([v.lng, v.lat]), new maplibregl.LngLatBounds([s.lng, s.lat], [s.lng, s.lat]));
          cadrer(map, b, marges(map, MARGE_HAUT, margeBasRef.current, 90), Math.max(map.getZoom() + 2, ZOOM_OUVERTURE), doux ? 0.9 : 0);
          return;
        }
        onde(map, s.lat, s.lng, fond === "satellite");
        choisirRef.current(s.id);
      });
      poses.push(m);
      stickersVus.push({ s, el: m.getElement() });
      const el = m.getElement().querySelector<HTMLElement>(".stk");
      // Un message de plus depuis la dernière fois : la bulle saute.
      const nonLus = s.discussion?.nonLus ?? 0;
      const avantNonLus = nonLusVus.current.get(s.id);
      if (doux && avantNonLus !== undefined && nonLus > avantNonLus)
        m.getElement().querySelector(".stk__bulle")?.classList.add("stk__bulle--saute");
      nonLusVus.current.set(s.id, nonLus);
      if (!entrees.current.has(s.id)) entrees.current.set(s.id, Math.max(0, depuis) + rang++ * CADENCE);
      if (el && doux) {
        const retard = (entrees.current.get(s.id) ?? 0) - depuis + (origine.current == null ? VOL * 1000 - 250 : 0);
        if (retard > -900) {
          el.classList.add("stk--entre");
          el.style.setProperty("--delai", `${Math.round(retard)}ms`);
        } else if (est && avant !== s.id) el.classList.add("stk--vient");
        else if (!est && avant === s.id) el.classList.add("stk--part");
      }
    });
    dernierChoisi.current = choisi;
    if (toi) {
      const m = repere(map, toi.lat, toi.lng, toiHtml(toi.note, toi.teinte), { classe: "toi-ancre", z: 2, actif: false, taille: [44, 59], ancre: [22, 52] });
      if (!toiVu.current && doux) m.getElement().querySelector(".toi")?.classList.add("toi--entre");
      toiVu.current = true;
      poses.push(m);
    }
    reperes.current = poses;
    stickersPoses.current = stickersVus;
    choisiRef.current = choisi;
    recomposer.current();

    // Le cadrage suit où sont les stickers, pas leur liste : la page la refait
    // à chaque rendu (l'horloge de la convocation en lance un par minute), et
    // le plan revenait alors sur les matchs en plein zoom (22/10).
    const lieux = stickers.map((s) => `${s.lat},${s.lng}`).sort().join(";");
    const deps = [lieux, points, toi, choisi];
    if (deps.every((d, i) => d === cadre.current[i])) return;
    // Seul le choix a changé : le plan glisse pour poser le choisi au centre
    // de ce qui reste visible, sans changer de zoom.
    const seulLeChoix = aVole.current && deps.slice(0, 3).every((d, i) => d === cadre.current[i]);
    cadre.current = deps;
    if (seulLeChoix) {
      const s = stickers.find((x) => x.id === choisi);
      if (!s) return;
      const h = map.getContainer().clientHeight;
      const ici = map.project([s.lng, s.lat]);
      const cible = { x: map.getContainer().clientWidth / 2, y: (MARGE_HAUT + Math.max(MARGE_HAUT, h - margeBasRef.current)) / 2 + 40 };
      const ecart: [number, number] = [ici.x - cible.x, ici.y - cible.y];
      if (Math.abs(ecart[0]) + Math.abs(ecart[1]) > 24) map.panBy(ecart, { duration: doux ? 700 : 0 });
      return;
    }

    const tous: [number, number][] = [
      ...stickers.map((s) => [s.lng, s.lat] as [number, number]),
      ...points.map((p) => [p.lng, p.lat] as [number, number]),
      ...(toi ? [[toi.lng, toi.lat] as [number, number]] : []),
    ];
    const boite = () => (maison.current = tous.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(tous[0], tous[0])));
    // Le sticker choisi mérite l'écran : on cadre large autour de lui, les
    // surcouches (lettrage en haut, carrousel en bas) prennent leur place.
    // Un seul point compris : la boîte est réduite à lui, le zoom plafonne
    // et le point se pose au-dessus des cartes du bas, pas derrière.
    // La première fois, on vole de la France jusqu'aux matchs.
    if (!tous.length) map.jumpTo({ center: FRANCE, zoom: ZOOM_FRANCE, pitch: 0 });
    else if (aVole.current && maintenant < volFini.current) {
      // Le vol attend ou vole déjà : il visera ce nouveau cadrage.
      cibleVol.current = boite();
    } else if (!aVole.current && doux) {
      aVole.current = true;
      cibleVol.current = boite();
      const voler = () => {
        if (carte.current !== map || !cibleVol.current) return;
        origine.current = performance.now() + VOL * 1000 - 250;
        volFini.current = performance.now() + VOL * 1000;
        cadrer(map, cibleVol.current, marges(map, MARGE_HAUT, margeBasRef.current), ZOOM_CADRE, VOL);
      };
      // Sous l'écran de chargement, le vol attend qu'il se lève (les
      // stickers, eux, sont en pause dans leur CSS jusque-là).
      if (document.documentElement.dataset.splash === "fini") voler();
      else window.addEventListener(SPLASH_FINI, voler, { once: true });
    } else {
      aVole.current = true;
      cadrer(map, boite(), marges(map, MARGE_HAUT, margeBasRef.current), ZOOM_CADRE, doux ? 0.8 : 0);
    }
  }, [stickers, points, toi, choisi, fond, pointsActifs]);

  // Les joueurs : refaits à chaque fin de zoom (la place de chaque ville à
  // l'écran change), et à chaque changement de la liste.
  useEffect(() => {
    const map = carte.current;
    if (!map) return;
    const doux = !calme();
    const vues = new Set<string>();
    const vider = () => {
      joueursReperes.current.forEach((m) => m.remove());
      joueursReperes.current = [];
    };
    const dessiner = () => {
      vider();
      // Les matchs qui se chevauchent d'abord : un sticker reste, les autres s'y rangent.
      // Effacés (matchsEnRetrait), ils ne gardent plus de joueurs sous eux.
      const ecran = retraitRef.current ? [] : stickersPoses.current.map(({ s }) => ({ id: s.id, ...map.project([s.lng, s.lat]) }));
      const groupes = grouperMatchs(ecran, choisiRef.current);
      const absorbees = new Map<string, { villes: string[]; joueurs: number }>();
      const zoom = map.getZoom();
      const dispo = villes.length
        ? disposer(
            villes,
            zoom,
            (lat, lng) => map.project([lng, lat]),
            groupes.map((g) => ({ x: g.x, y: g.y - 40, r: R_STICKER }))
          )
        : [];
      const avant = ouvertes.current;
      const maintenant = new Set<string>();
      const poses: Marker[] = [];
      for (const d of dispo) {
        if (d.genre === "pile") {
          // Une pile sous un sticker s'y range : la pastille du sticker la compte.
          const p = map.project([d.lng, d.lat]);
          const sous = groupes.find((g) => Math.hypot(g.x - p.x, g.y - 40 - p.y) < FUSION_PILE);
          if (sous) {
            const a = absorbees.get(sous.tete) ?? { villes: [], joueurs: 0 };
            a.villes.push(...d.villes.map((v) => v.id));
            a.joueurs += d.joueurs.length;
            absorbees.set(sous.tete, a);
            continue;
          }
          const m = repere(map, d.lat, d.lng, pileHtml(d), { classe: "jr-ancre" });
          poses.push(m);
          if (doux && (avant.has(d.id) || !vues.has(d.id))) m.getElement().querySelector(".grp")?.classList.add("grp--entre");
          vues.add(d.id);
          // Toucher une pile l'ouvre en collection : les cartes de ses joueurs.
          m.getElement().addEventListener("click", () => {
            navigator.vibrate?.(6);
            villeRef.current?.(d.villes.map((v) => v.id));
          });
          continue;
        }
        maintenant.add(d.id);
        const sort = doux && !avant.has(d.id);
        const html =
          d.joueurs.slice(0, OUVERTE_MAX).map((j, i) => joueurHtml(j, i, sort)).join("") + centreHtml(d.ville, d.joueurs.length);
        const m = repere(map, d.lat, d.lng, html, { classe: "jr-ancre" });
        poses.push(m);
        const el = m.getElement();
        if (sort) el.querySelector(".vil")?.classList.add("vil--entre");
        // Un seul repère pour la ville : on lit ce que le doigt a touché.
        el.addEventListener("click", (e) => {
          const cible = e.target as HTMLElement;
          const carteJ = cible.closest<HTMLElement>(".jr");
          if (carteJ) {
            const i = [...el.querySelectorAll(".jr")].indexOf(carteJ);
            const j = d.joueurs[i];
            if (j) {
              navigator.vibrate?.(5);
              joueurRef.current?.(j.name);
            }
          } else if (cible.closest(".vil")) {
            navigator.vibrate?.(5);
            villeRef.current?.([d.id]);
          }
        });
      }
      joueursReperes.current = poses;
      ouvertes.current = maintenant;

      // Les stickers : les rangés s'effacent, la tête porte la pastille.
      const tetes = new Map(groupes.map((g) => [g.tete, g]));
      const rangeDans = new Set(groupes.flatMap((g) => g.ids.filter((id) => id !== g.tete)));
      groupeDe.current.clear();
      for (const { s, el } of stickersPoses.current) {
        el.classList.toggle("stk-ancre--range", rangeDans.has(s.id));
        el.querySelector(".stk__groupe")?.remove();
        const g = tetes.get(s.id);
        const a = absorbees.get(s.id);
        const html = g ? groupeHtml(g.ids.length, a?.joueurs ?? 0) : "";
        el.querySelector(".stk")?.classList.toggle("stk--groupe", !!g && g.ids.length > 1);
        if (!g || !html) continue;
        el.querySelector(".stk")?.insertAdjacentHTML("beforeend", html);
        groupeDe.current.set(s.id, { ids: g.ids, villes: a?.villes ?? [] });
      }
    };
    recomposer.current = dessiner;
    dessiner();
    map.on("zoomend", dessiner);
    return () => {
      map.off("zoomend", dessiner);
      recomposer.current = () => {};
      vider();
    };
  }, [villes]);

  // Aller voir une ville choisie dans le catalogue : assez près pour qu'elle s'ouvre.
  useEffect(() => {
    const map = carte.current;
    if (!map || !viser) return;
    const z = Math.max(map.getZoom(), ZOOM_OUVERTURE + 1);
    map.flyTo({ center: [viser.lng, viser.lat], zoom: z, pitch: pente(z), duration: calme() ? 0 : 1000 });
  }, [viser]);

  // Les matchs s'effacent ou reviennent : les joueurs se redisposent sans eux.
  useEffect(() => {
    conteneur.current?.classList.toggle("carte--matchs-en-retrait", matchsEnRetrait);
    recomposer.current();
  }, [matchsEnRetrait]);

  // Cadrer sur des lieux que la page demande (les cibles des contrats), puis
  // revenir sur les matchs. Une seule ville : assez près pour qu'elle s'ouvre.
  useEffect(() => {
    const map = carte.current;
    if (!map) return;
    const duree = calme() ? 0 : 0.9;
    const marge = marges(map, MARGE_HAUT, margeBasRef.current, 60);
    if (!cadrerSur?.lieux.length) {
      if (ailleurs.current && maison.current) cadrer(map, maison.current, marge, ZOOM_CADRE, duree);
      ailleurs.current = false;
      return;
    }
    ailleurs.current = true;
    const [a, ...autres] = cadrerSur.lieux;
    const b = autres.reduce((x, p) => x.extend([p.lng, p.lat]), new maplibregl.LngLatBounds([a.lng, a.lat], [a.lng, a.lat]));
    cadrer(map, b, marge, ZOOM_OUVERTURE + 1, duree);
  }, [cadrerSur]);

  return <div ref={conteneur} className={className} role="region" aria-label="La Map des matchs" />;
}

/**
 * Le plan ou la photo : la couche satellite monte (ou s'efface) en fondu,
 * les volumes s'effacent sous la photo et les libellés passent en blanc.
 * Renvoie de quoi annuler la fin du fondu.
 */
function appliquerFond(map: PlanMap, fond: FondCarte, doux: boolean): (() => void) | undefined {
  const sat = fond === "satellite";
  const duree = doux ? FONDU : 0;
  map.setPaintProperty("satellite", "raster-opacity-transition", { duration: duree, delay: 0 });
  for (const id of LIBELLES) {
    map.setPaintProperty(id, "text-color", sat ? "#f4f5f2" : id === "noms-rues" ? "#6d6a64" : id === "noms-eau" ? "#3d8fbf" : "#6b6d72");
    map.setPaintProperty(id, "text-halo-color", sat ? "rgba(10, 11, 13, 0.85)" : "#ffffff");
  }
  if (sat) {
    map.setLayoutProperty("satellite", "visibility", "visible");
    map.setPaintProperty("satellite", "raster-opacity", 1);
    const t = window.setTimeout(() => map.setLayoutProperty("volumes", "visibility", "none"), duree);
    return () => window.clearTimeout(t);
  }
  map.setLayoutProperty("volumes", "visibility", "visible");
  map.setPaintProperty("satellite", "raster-opacity", 0);
  const t = window.setTimeout(() => map.setLayoutProperty("satellite", "visibility", "none"), duree);
  return () => window.clearTimeout(t);
}
