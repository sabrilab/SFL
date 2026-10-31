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
// matchs, en piles qui restent fermées jusqu'au bout du zoom (24/10), puis en
// tournesols de cartes (la disposition est dans map/joueurs.ts), refaits à
// chaque fin de zoom. Toucher une pile ouvre sa collection ; toucher le nom
// d'une ville ouverte ou une carte, la page ouvre le catalogue ou le profil.
//
// Les matchs qui se chevauchent à l'écran font un paquet (24/10, Sabri :
// « Quand il y a deux matchs au même endroit, […] il faudrait que tu le
// fasses plus stylé, parce qu'on comprend pas ») : le premier devant, les
// vignettes des suivants qui dépassent derrière lui, leur nombre au coin
// (map/stade.ts). Toucher un paquet approche le plan jusqu'à les séparer ;
// au même endroit, il s'ouvre en éventail, chacun à toucher.
//
// Les terrains où l'on peut ouvrir un match (23/10, Sabri : « en mode grisé,
// comme s'il fallait ouvrir le match ») : ceux du recensement, en France,
// en Europe et au Maghreb (lib/sfl/terrains.ts), sauf ceux qui ont déjà le
// leur ; la page les lit case par case, d'après ce que le plan montre
// (onVue, à chaque arrêt). De loin des points ; en s'approchant, des
// stickers vides (map/stade.ts, fantomeSvg) ; tout près, leur nom. Ce sont
// des couches du plan, pas des éléments HTML : des milliers de terrains ne
// coûtent rien, restent sous les matchs, les
// joueurs et toi, et s'effacent l'un devant l'autre quand ils se
// chevauchent. Toucher un terrain lâche l'onde et le lève en mini-stade,
// son nom à côté, au-dessus de la fiche que la page ouvre.

import { useEffect, useRef } from "react";
import maplibregl, { type LngLatBoundsLike, type Map as PlanMap, type Marker, type PaddingOptions } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SPLASH_FINI } from "@/components/sfl/app-splash";
import { quandAccueilLibre } from "@/lib/sfl/accueil";
import {
  couleurFantome,
  dosHtml,
  fantomeSvg,
  nombreHtml,
  paquetHtml,
  pointHtml,
  stickerHtml,
  toiHtml,
  type StickerPlan,
  type TeinteFantome,
  type VarianteStade,
} from "./stade";
import {
  centreHtml,
  disposer,
  FUSION_MATCHS,
  FUSION_PILE,
  grouperMatchs,
  joueurHtml,
  joueursSousHtml,
  OUVERTE_MAX,
  pileHtml,
  R_STICKER,
  ZOOM_OUVERTURE,
  ZOOM_OUVERTURE_CONTRATS,
  ZOOM_VILLE,
  type JoueurPlan,
  type VillePlan,
} from "./joueurs";
import { gestesOrdinateur } from "./gestes-ordinateur";
import { FONDU, LIBELLES, styleSnap } from "./style-snap";
import { couleurLibelle, majZones, peindre, poserZones, teinterZones, type Ambiance } from "./ambiances";
import { dansContour, numeroZone, type Zone } from "@/lib/sfl/zones";

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
  /** Hors des zones Bola : son premier match ouvre une zone (en vert, 30/10). */
  horsZone?: boolean;
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
/** Le temps passé au-dessus de la zone, au premier vol, avant de plonger sur les matchs (ms). */
const PAUSE_ZONE = 1300;
/** Le survol d'une zone : assez haut pour la voir entière, assez près pour lire son étiquette. */
const ZOOM_SURVOL = 10.5;
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

function collectionPossibles(possibles: PossiblePlan[]): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; nom: string; rang: number; horsZone: boolean }> {
  return {
    type: "FeatureCollection",
    features: possibles.map((p) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: { id: p.id, nom: p.nom, rang: p.rang, horsZone: !!p.horsZone },
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
  const tons = (["gris", "ciel", "vert"] as const).flatMap((t) => (["plan", "satellite"] as const).map((f) => [t, f] as const));
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
  // Hors des zones, le terrain « à ouvrir » passe au vert, quel que soit le ton choisi.
  map.setLayoutProperty("possibles", "icon-image", ["case", ["get", "horsZone"], `fantome-vert-${fond}`, `fantome-${teinte}-${fond}`]);
  map.setPaintProperty("possibles-points", "circle-color", ["case", ["get", "horsZone"], couleurFantome("vert", fond), trait]);
  map.setPaintProperty("possibles-points", "circle-stroke-color", sat ? "rgba(10, 11, 13, 0.7)" : "#ffffff");
  map.setPaintProperty("possibles", "text-color", sat ? "#f4f5f2" : ["case", ["get", "horsZone"], "#1f8a45", teinte === "ciel" ? "#1673d6" : "#55575c"]);
  map.setPaintProperty("possibles", "text-halo-color", sat ? "rgba(10, 11, 13, 0.85)" : "#ffffff");
}

/** Un paquet de matchs que le zoom ne séparera pas : au bout du zoom, ils se chevauchent encore. */
function inseparables(map: PlanMap, lieux: { lat: number; lng: number }[]): boolean {
  const k = 2 ** (map.getMaxZoom() - map.getZoom());
  const pts = lieux.map((x) => map.project([x.lng, x.lat]));
  return pts.every((p) => pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) * k < FUSION_MATCHS));
}

/** Au même endroit : à moins de 200 m les uns des autres (le même complexe). */
function memeEndroit(lieux: { lat: number; lng: number }[]): boolean {
  const [a, ...autres] = lieux;
  const r = Math.PI / 180;
  return autres.every((b) => {
    const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(d)) < 0.2;
  });
}

/** L'écart entre deux stickers d'un éventail, en pixels (une vignette et un peu d'air). */
const EVENTAIL = 84;

const echapper = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

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
const AUCUNE_ZONE: Zone[] = [];
/** Plus près que ça, on est dans la zone : son étiquette se retire. */
const ZOOM_ETIQUETTES_ZONES = 12.5;
/** Plus loin, une zone n'est qu'une tache : pas d'étiquette. */
const ZOOM_ETIQUETTES_LOIN = 7;
/** En dessous, avec des zones, les piles de joueurs se fondent dans l'étiquette de leur zone (31/10). */
const ZOOM_REGION = 10.5;

/**
 * Les étiquettes sont posées dans l'ordre des zones : une étiquette qui en
 * chevauche une d'avant, un sticker de match ou une pile de joueurs, se
 * cache (de loin, la zone tient sous eux : ils passent devant).
 */
function degagerEtiquettes(reperes: Marker[]) {
  const plan = reperes[0]?.getElement().closest(".maplibregl-map");
  // Vue région avec des zones : les piles sont fondues dans l'étiquette, elles ne la cachent pas.
  const sansPiles = plan?.classList.contains("zones-region") && plan.classList.contains("avec-zones");
  const gardees: DOMRect[] = plan ? [...plan.querySelectorAll(sansPiles ? ".stk-ancre .stk" : ".stk-ancre .stk, .grp__pile")].map((x) => x.getBoundingClientRect()) : [];
  for (const m of reperes) {
    const b = m.getElement().querySelector<HTMLElement>(".zone-etiq");
    if (!b) continue;
    b.classList.remove("zone-etiq--cachee");
    const r = b.getBoundingClientRect();
    const touche = gardees.some((g) => r.left < g.right + 6 && r.right > g.left - 6 && r.top < g.bottom + 4 && r.bottom > g.top - 4);
    if (touche) b.classList.add("zone-etiq--cachee");
    else gardees.push(r);
  }
}

/** L'étiquette d'une zone, posée au-dessus de son contour : son numéro, son nom, ce qu'elle compte. */
function zoneHtml(z: Zone): string {
  const classe = `zone-etiq${z.ouverte ? "" : " zone-etiq--attente"}${z.nouvelle ? " zone-etiq--neuve" : ""}`;
  const tete = z.ouverte ? `${z.nouvelle ? "Nouvelle zone" : z.aMoi ? "Ta zone" : "Zone"} · ${numeroZone(z.numero)}` : z.aMoi ? "Ta zone · à ouvrir" : "Zone à ouvrir";
  return `<button type="button" class="${classe}" data-zone="${z.id}"><span class="zone-etiq__tete">${echapper(tete)}</span><span class="zone-etiq__nom">${echapper(z.nom)}</span>${z.sous ? `<span class="zone-etiq__sous">${echapper(z.sous)}</span>` : ""}</button>`;
}

/** Le haut d'un contour : l'étiquette s'y pose, au-dessus de la zone. */
function hautDe(z: Zone): { lat: number; lng: number } {
  const [lng, lat] = z.contour.reduce((a, p) => (p[1] > a[1] ? p : a), z.contour[0] ?? [z.centre.lng, z.centre.lat]);
  return { lat, lng: (lng + z.centre.lng) / 2 };
}

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
  onVue,
  zones = AUCUNE_ZONE,
  ambiance = "classique",
  onZone,
  trajet = null,
  className,
}: {
  /** Ton chemin jusqu'au match choisi (lon, lat), qui brille sur le plan (31/10, le tableau de bord). */
  trajet?: [number, number][] | null;
  /** Les zones Bola (lib/sfl/zones.ts) : ouvertes, puis en attente. */
  zones?: Zone[];
  /** L'ambiance du plan (map/ambiances.ts). */
  ambiance?: Ambiance;
  /** Toucher l'étiquette d'une zone : son récit. */
  onZone?: (id: string) => void;
  fond?: FondCarte;
  /** Les terrains où l'on peut ouvrir un match, sans ceux qui ont déjà le leur. */
  possibles?: PossiblePlan[];
  /** Le terrain possible touché, dont la page montre la fiche : il se lève en mini-stade. */
  possibleChoisi?: string | null;
  onPossible?: (id: string) => void;
  /** Le gris du plan, ou le bleu du ciel. */
  teinteFantome?: TeinteFantome;
  /** Ce que le plan montre, à chaque arrêt (ouest, sud, est, nord, zoom) : la page y lit les terrains (lib/sfl/terrains.ts). */
  onVue?: (o: number, s: number, e: number, n: number, zoom: number) => void;
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
  // Les stickers posés (leur rang : l'ordre du temps, le joué en dernier), et
  // le paquet que chacun mène quand des matchs se chevauchent (ses ids, et
  // les villes de joueurs rangées contre lui).
  const stickersPoses = useRef<{ s: StickerPlan; el: HTMLElement; rang: number }[]>([]);
  const groupeDe = useRef(new Map<string, { ids: string[]; villes: string[] }>());
  // Le paquet ouvert en éventail (sa tête), ou aucun.
  const evente = useRef<string | null>(null);
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
  const trajetRef = useRef(trajet);
  // Les terrains possibles : leurs données et leur ton, lus quand leurs
  // couches se posent ; celui qui est levé, et le filtre qui l'ôte des couches.
  const possiblesRef = useRef(possibles);
  const possibleRef = useRef(onPossible);
  const teinteRef = useRef(teinteFantome);
  const vueRef = useRef(onVue);
  const leve = useRef<Marker | null>(null);
  const filtreLeve = useRef<maplibregl.FilterSpecification | null>(null);
  const zonesRef = useRef(zones);
  const ambianceRef = useRef<Ambiance>(ambiance);
  const zoneRef = useRef(onZone);
  const etiquettes = useRef<Marker[]>([]);
  useEffect(() => {
    zoneRef.current = onZone;
  }, [onZone]);
  useEffect(() => {
    choisirRef.current = onChoisir;
    bulleRef.current = onBulle;
    pointRef.current = onPoint;
    villeRef.current = onVille;
    joueurRef.current = onJoueur;
    possibleRef.current = onPossible;
    vueRef.current = onVue;
    margeBasRef.current = margeBas;
    retraitRef.current = matchsEnRetrait;
  }, [onChoisir, onBulle, onPoint, onVille, onJoueur, onPossible, onVue, margeBas, matchsEnRetrait]);
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
    // Ce que le plan montre, à chaque arrêt : la page y lit les terrains.
    const montrer = () => {
      const b = map.getBounds();
      vueRef.current?.(b.getWest(), b.getSouth(), b.getEast(), b.getNorth(), map.getZoom());
    };
    map.on("moveend", montrer);
    const pres = () => {
      const c = map.getContainer().classList;
      c.toggle("zones-proches", map.getZoom() > ZOOM_ETIQUETTES_ZONES);
      c.toggle("zones-loin", map.getZoom() < ZOOM_ETIQUETTES_LOIN);
      c.toggle("zones-region", map.getZoom() < ZOOM_REGION);
    };
    map.on("zoom", pres);
    pres();
    // Deux étiquettes de zones qui se chevauchent : la plus ancienne zone reste.
    map.on("moveend", () => degagerEtiquettes(etiquettes.current));
    map.on("load", () => {
      montrer();
      peindre(map, ambianceRef.current);
      poserZones(map, zonesRef.current);
      teinterZones(map, ambianceRef.current, fondRef.current === "satellite");
      appliquerFond(map, fondRef.current, false, ambianceRef.current);
      poserTrajet(map, trajetRef.current, ambianceRef.current);
      // L'attribution reste repliée en un petit « i » : elle s'ouvre au toucher.
      map.getContainer().querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
      poserPossibles(map, () => possiblesRef.current, () => carte.current === map)
        .then((pose) => {
          if (!pose) return;
          teinterPossibles(map, fondRef.current, teinteRef.current);
          teinterZones(map, ambianceRef.current, fondRef.current === "satellite");
          for (const id of COUCHES_POSSIBLES) map.setFilter(id, filtreLeve.current);
        })
        .catch(() => {});
    });
    // Toucher un terrain possible : le plus proche du doigt, dans un carré
    // de 36 px (un point de loin est petit sous le doigt). Un sticker, une
    // carte ou toi, posés dessus, gardent le toucher pour eux.
    map.on("click", (e) => {
      // Un éventail ouvert : toucher à côté le referme, sans rien ouvrir dessous.
      const sur = e.originalEvent?.target;
      if (evente.current && !(sur instanceof Element && sur.closest(".maplibregl-marker"))) {
        evente.current = null;
        recomposer.current();
        return;
      }
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
    // Zoomer referme l'éventail : le paquet se refait au nouveau zoom.
    map.on("zoomstart", (e) => {
      if (!evente.current || !(e as { originalEvent?: Event }).originalEvent) return;
      evente.current = null;
      recomposer.current();
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
    teinterZones(map, ambianceRef.current, fond === "satellite");
    return appliquerFond(map, fond, !calme(), ambianceRef.current);
  }, [fond]);

  // Le trajet jusqu'au match : sa ligne et sa lueur, dans le ton du plan.
  useEffect(() => {
    trajetRef.current = trajet;
    const map = carte.current;
    if (map?.getLayer("terre")) poserTrajet(map, trajet, ambiance);
  }, [trajet, ambiance]);

  // L'ambiance : le plan repeint, les zones dans leur ton.
  useEffect(() => {
    ambianceRef.current = ambiance;
    const map = carte.current;
    if (!map) return;
    map.getContainer().dataset.ambiance = ambiance;
    if (!map.getLayer("zones-voile")) return;
    peindre(map, ambiance);
    teinterZones(map, ambiance, fondRef.current === "satellite");
    appliquerFond(map, fondRef.current, false, ambiance);
  }, [ambiance]);

  // Les zones : leurs couches, et leurs étiquettes en repères (au-dessus du
  // plan, sous les matchs). La nouvelle zone s'ouvre avec un anneau.
  useEffect(() => {
    zonesRef.current = zones;
    const map = carte.current;
    if (!map) return;
    if (map.getSource("zones-voile")) majZones(map, zones);
    etiquettes.current.forEach((m) => m.remove());
    etiquettes.current = [];
    map.getContainer().classList.toggle("avec-zones", ambiance !== "classique" && zones.some((z) => z.ouverte));
    if (ambiance === "classique") return;
    for (const z of zones) {
      if (z.contour.length < 4) continue;
      const h = hautDe(z);
      const m = repere(map, h.lat, h.lng, zoneHtml(z), { classe: "zone-ancre", z: 1 });
      m.getElement().querySelector("button")?.addEventListener("click", (e) => {
        e.stopPropagation();
        navigator.vibrate?.(8);
        zoneRef.current?.(z.id);
      });
      etiquettes.current.push(m);
    }
    degagerEtiquettes(etiquettes.current);
  }, [zones, ambiance]);

  // Les terrains possibles : leurs données, puis leur ton (plus discret la nuit).
  useEffect(() => {
    possiblesRef.current = possibles;
    const source = carte.current?.getSource("possibles");
    if (source && "setData" in source) (source as maplibregl.GeoJSONSource).setData(collectionPossibles(possibles));
  }, [possibles]);
  useEffect(() => {
    teinteRef.current = teinteFantome;
    const map = carte.current;
    if (!map) return;
    teinterPossibles(map, fondRef.current, teinteFantome);
    teinterZones(map, ambianceRef.current, fondRef.current === "satellite");
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
    // Levé, il passe devant les matchs voisins (sous l'éventail d'un paquet ouvert).
    leve.current = repere(map, p.lat, p.lng, pointHtml(p.nom, variante), { classe: "ter-ancre", z: 800, actif: false });
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
    const stickersVus: { s: StickerPlan; el: HTMLElement; rang: number }[] = [];
    // Un choix refait les stickers : l'éventail se referme sur le choisi, devant son paquet.
    evente.current = null;
    ordre.forEach((s, k) => {
      const est = s.id === choisi;
      const m = repere(map, s.lat, s.lng, stickerHtml(s, est, variante), { classe: "stk-ancre", z: est ? 3 + ordre.length : 3 + k });
      m.getElement().addEventListener("click", (e) => {
        const cible = e.target as HTMLElement;
        // Sa bulle de messages : droit à la discussion.
        if (bulleRef.current && cible.closest(".stk__bulle")) {
          navigator.vibrate?.(6);
          bulleRef.current(s.id);
          return;
        }
        const g = groupeDe.current.get(s.id);
        // Les joueurs rangés contre lui : leur collection.
        if (g?.villes.length && cible.closest(".stk__joueurs")) {
          navigator.vibrate?.(6);
          villeRef.current?.(g.villes);
          return;
        }
        // Un paquet : s'approcher jusqu'à séparer ses matchs ; au même
        // endroit (ou au bout du zoom), il s'ouvre en éventail.
        if (g && g.ids.length > 1 && evente.current !== s.id) {
          navigator.vibrate?.(6);
          const dans = stickers.filter((x) => g.ids.includes(x.id));
          if (map.getZoom() >= map.getMaxZoom() - 0.5 || inseparables(map, dans)) {
            evente.current = s.id;
            recomposer.current();
            // L'éventail tient dans l'écran : le plan glisse s'il déborde.
            const p = map.project([s.lng, s.lat]);
            const demi = ((g.ids.length - 1) / 2) * EVENTAIL + 46;
            const w = map.getContainer().clientWidth;
            const dx = p.x - demi < 12 ? p.x - demi - 12 : p.x + demi > w - 12 ? p.x + demi - (w - 12) : 0;
            if (dx) map.panBy([dx, 0], { duration: doux ? 420 : 0 });
            return;
          }
          const b = dans.reduce((x, v) => x.extend([v.lng, v.lat]), new maplibregl.LngLatBounds([s.lng, s.lat], [s.lng, s.lat]));
          cadrer(map, b, marges(map, MARGE_HAUT, margeBasRef.current, 90), ZOOM_MAX - 0.5, doux ? 0.9 : 0);
          return;
        }
        evente.current = null;
        onde(map, s.lat, s.lng, fond === "satellite");
        choisirRef.current(s.id);
      });
      poses.push(m);
      // L'ordre du temps (celui de la page), le joué en dernier : la tête d'un paquet est le prochain.
      stickersVus.push({ s, el: m.getElement(), rang: stickers.indexOf(s) + (s.etat.genre === "joue" ? stickers.length : 0) });
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
        // Avec les zones (30/10) : le vol se pose d'abord sur la zone des
        // matchs, son étiquette en titre, puis plonge sur eux.
        const c = cibleVol.current.getCenter();
        const zone = ambianceRef.current === "classique" ? undefined : zonesRef.current.find((z) => z.ouverte && dansContour(z.contour, c.lat, c.lng));
        const survol = zone ? VOL * 1000 + PAUSE_ZONE : 0;
        origine.current = performance.now() + survol + VOL * 1000 - 250;
        volFini.current = performance.now() + survol + VOL * 1000;
        const plonger = () => carte.current === map && cibleVol.current && cadrer(map, cibleVol.current, marges(map, MARGE_HAUT, margeBasRef.current), ZOOM_CADRE, VOL);
        if (!zone) return plonger();
        const b = zone.contour.reduce((x, p) => x.extend(p), new maplibregl.LngLatBounds(zone.contour[0], zone.contour[0]));
        cadrer(map, b, marges(map, MARGE_HAUT + 60, margeBasRef.current), ZOOM_SURVOL, VOL);
        window.setTimeout(plonger, survol);
      };
      // Sous l'écran de chargement, puis sous l'accueil de l'app
      // (components/sfl/accueil), le vol attend qu'ils se lèvent (les
      // stickers, eux, sont en pause dans leur CSS jusque-là).
      const apresAccueil = () => void quandAccueilLibre(voler);
      if (document.documentElement.dataset.splash === "fini") apresAccueil();
      else window.addEventListener(SPLASH_FINI, apresAccueil, { once: true });
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
    // Un sticker remis à plat : ni rangé, ni en paquet, ni en éventail.
    const remettre = (el: HTMLElement) => {
      el.classList.remove("stk-ancre--range");
      if (el.dataset.z) el.style.zIndex = el.dataset.z;
      el.querySelectorAll(".stk__dos, .stk__nombre, .stk__paquet, .stk__joueurs, .stk-eventail__nom").forEach((x) => x.remove());
      const stk = el.querySelector<HTMLElement>(".stk");
      if (!stk) return;
      stk.classList.remove("stk--paquet", "stk--paquet-loin", "stk--evente");
      for (const v of ["--ex", "--ey", "--er"]) stk.style.removeProperty(v);
    };
    const dessiner = () => {
      vider();
      // Les matchs qui se chevauchent d'abord : un paquet, le prochain devant.
      // Effacés (matchsEnRetrait), ils ne gardent plus de joueurs sous eux.
      const ecran = retraitRef.current ? [] : stickersPoses.current.map(({ s, rang }) => ({ id: s.id, rang, ...map.project([s.lng, s.lat]) }));
      const groupes = grouperMatchs(ecran, choisiRef.current);
      if (evente.current && !groupes.some((g) => g.tete === evente.current && g.ids.length > 1)) evente.current = null;
      const absorbees = new Map<string, { villes: string[]; joueurs: JoueurPlan[] }>();
      const zoom = map.getZoom();
      const dispo = villes.length
        ? disposer(
            villes,
            zoom,
            (lat, lng) => map.project([lng, lat]),
            groupes.map((g) => ({ x: g.x, y: g.y - 40, r: R_STICKER })),
            retraitRef.current ? ZOOM_OUVERTURE_CONTRATS : ZOOM_OUVERTURE
          )
        : [];
      const avant = ouvertes.current;
      const maintenant = new Set<string>();
      const poses: Marker[] = [];
      for (const d of dispo) {
        if (d.genre === "pile") {
          // Une pile sur un sticker ou ses noms s'y range : sa pile en petit, posée contre lui.
          const p = map.project([d.lng, d.lat]);
          const sous = groupes.find((g) => Math.abs(p.x - g.x) < FUSION_PILE && p.y - g.y > -FUSION_PILE - 40 && p.y - g.y < FUSION_PILE);
          if (sous) {
            const a = absorbees.get(sous.tete) ?? { villes: [], joueurs: [] };
            a.villes.push(...d.villes.map((v) => v.id));
            a.joueurs.push(...d.joueurs);
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

      // Les stickers : tous remis à plat, puis les paquets (les rangés
      // s'effacent, leurs vignettes dépassent derrière la tête) et l'éventail.
      const parId = new Map(stickersPoses.current.map((x) => [x.s.id, x]));
      const variante: VarianteStade = fondRef.current === "satellite" ? "marbre" : "mono";
      groupeDe.current.clear();
      for (const { el } of stickersPoses.current) remettre(el);
      for (const g of groupes) {
        const tete = parId.get(g.tete);
        const stk = tete?.el.querySelector<HTMLElement>(".stk");
        if (!tete || !stk) continue;
        const membres = g.ids.flatMap((id) => parId.get(id) ?? []);
        if (membres.length > 1 && evente.current === g.tete) {
          // En éventail : côte à côte au-dessus du terrain, du prochain au plus
          // lointain, un peu penchés vers l'extérieur ; le nom une seule fois.
          membres.forEach((x, i) => {
            const k = i - (membres.length - 1) / 2;
            const el = x.el.querySelector<HTMLElement>(".stk");
            if (!el) return;
            el.classList.add("stk--evente");
            el.style.setProperty("--ex", `${Math.round(k * EVENTAIL)}px`);
            el.style.setProperty("--ey", `${Math.round(16 - Math.abs(k) * 7)}px`);
            el.style.setProperty("--er", `${(k * 6).toFixed(1)}deg`);
            x.el.dataset.z ??= x.el.style.zIndex;
            x.el.style.zIndex = String(900 + i);
          });
          const ici = memeEndroit(membres.map((x) => x.s));
          tete.el.insertAdjacentHTML(
            "beforeend",
            `<span class="stk-eventail__nom">${ici ? `${echapper(tete.s.nom)} · ` : ""}${membres.length} matchs</span>`
          );
        } else if (membres.length > 1) {
          for (const x of membres.slice(1)) x.el.classList.add("stk-ancre--range");
          // Les dos sous la vignette, pas dedans : la vignette du choisi flotte
          // (une animation, donc un plan à elle) et les aurait posés sur son bord.
          membres.slice(1, 3).forEach((x, i) => stk.insertAdjacentHTML("afterbegin", dosHtml(x.s, (i + 1) as 1 | 2, variante)));
          stk.querySelector(".stk__vignette")?.insertAdjacentHTML("beforeend", nombreHtml(membres.length));
          const ici = memeEndroit(membres.map((x) => x.s));
          stk.classList.add("stk--paquet");
          stk.classList.toggle("stk--paquet-loin", !ici);
          stk.insertAdjacentHTML("beforeend", paquetHtml(membres.length, ici));
        }
        const a = absorbees.get(g.tete);
        if (a) stk.insertAdjacentHTML("beforeend", joueursSousHtml(a.joueurs));
        groupeDe.current.set(g.tete, { ids: g.ids, villes: a?.villes ?? [] });
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

  // Aller voir une ville choisie dans le catalogue : ses rues, sa pile.
  useEffect(() => {
    const map = carte.current;
    if (!map || !viser) return;
    const z = Math.max(map.getZoom(), ZOOM_VILLE);
    map.flyTo({ center: [viser.lng, viser.lat], zoom: z, pitch: pente(z), duration: calme() ? 0 : 1000 });
  }, [viser]);

  // Les matchs s'effacent ou reviennent : les joueurs se redisposent sans eux.
  useEffect(() => {
    conteneur.current?.classList.toggle("carte--matchs-en-retrait", matchsEnRetrait);
    recomposer.current();
  }, [matchsEnRetrait]);

  // Cadrer sur des lieux que la page demande (les cibles des contrats), puis
  // revenir sur les matchs. Une seule ville : assez près pour qu'elle s'ouvre
  // (les matchs effacés, elle s'ouvre dès le quartier).
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
    cadrer(map, b, marge, ZOOM_OUVERTURE_CONTRATS + 1, duree);
  }, [cadrerSur]);

  return <div ref={conteneur} className={className} role="region" aria-label="La Map des matchs" />;
}

/**
 * Le plan ou la photo : la couche satellite monte (ou s'efface) en fondu,
 * les volumes s'effacent sous la photo et les libellés passent en blanc.
 * Renvoie de quoi annuler la fin du fondu.
 */
function appliquerFond(map: PlanMap, fond: FondCarte, doux: boolean, ambiance: Ambiance): (() => void) | undefined {
  const sat = fond === "satellite";
  const duree = doux ? FONDU : 0;
  map.setPaintProperty("satellite", "raster-opacity-transition", { duration: duree, delay: 0 });
  for (const id of LIBELLES) {
    const { texte, halo } = couleurLibelle(ambiance, id, sat);
    map.setPaintProperty(id, "text-color", texte);
    map.setPaintProperty(id, "text-halo-color", halo);
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

/** Le trajet : une lueur large et floue sous un trait net ; la braise la nuit, le vert Bola le jour. */
function poserTrajet(map: PlanMap, trajet: [number, number][] | null, ambiance: Ambiance) {
  const donnees: GeoJSON.Feature<GeoJSON.LineString> = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: trajet && trajet.length > 1 ? trajet : [] } };
  const source = map.getSource("trajet") as maplibregl.GeoJSONSource | undefined;
  if (source) source.setData(donnees);
  else {
    map.addSource("trajet", { type: "geojson", data: donnees });
    const avant = map.getLayer("noms-rues") ? "noms-rues" : undefined;
    map.addLayer({ id: "trajet-lueur", type: "line", source: "trajet", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 16, "line-blur": 10, "line-opacity": 0.5 } }, avant);
    map.addLayer({ id: "trajet-trait", type: "line", source: "trajet", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-width": 3.5 } }, avant);
  }
  const couleur = ambiance.startsWith("nuit") ? "#FF6A1A" : "#1F8A45";
  map.setPaintProperty("trajet-lueur", "line-color", couleur);
  map.setPaintProperty("trajet-trait", "line-color", couleur);
}
