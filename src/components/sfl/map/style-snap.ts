// Le style du plan — la Map « plus mignonne, plus accueillante » (Sabri,
// 22/10 : « s'inspirer de Snapchat, mais elle peut avoir du relief »).
//
// Les données sont celles d'OpenStreetMap, en tuiles vectorielles
// d'OpenFreeMap (sans clé, sans compte) ; le dessin est le nôtre, à la
// manière de la Snap Map : une terre crème, des parcs vert tendre, une eau
// bleu ciel, des rues blanches cernées d'un gris chaud, les terrains de sport
// d'un vert plus franc (ce sont les nôtres). Le relief : l'ombrage du sol
// (les tuiles d'altitude ouvertes d'AWS) et, en s'approchant, les bâtiments
// qui se lèvent en volumes de plâtre, la carte inclinée.
//
// La vue satellite d'Esri est une couche du même style, éteinte au plan :
// passer de l'un à l'autre est un fondu de son opacité (FONDU), sans
// recharger le style ni les stickers. Les libellés restent au-dessus,
// blancs cernés de noir sur la photo.
//
// Les zooms sont ceux de MapLibre (tuiles de 512) : un cran de moins que
// ceux de Leaflet pour la même échelle.

import type { StyleSpecification } from "maplibre-gl";

/** La vue satellite d'Esri, sans clé : on y voit le terrain lui-même. */
export const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

/** Le fondu d'un fond à l'autre, en ms. */
export const FONDU = 500;

const C = {
  terre: "#f3f0e8",
  quartier: "#efebe1",
  parc: "#c6ecb0",
  bois: "#b4e2a0",
  terrain: "#9fe08e",
  eau: "#9bd8f6",
  eauBord: "#82cbf0",
  rue: "#ffffff",
  rueBord: "#e2dbcf",
  grande: "#fff3c4",
  grandeBord: "#ecd9a0",
  bati: "#e8e3da",
  volume: "#f7f4ef",
  rail: "#d6d0c6",
  texte: "#6b6d72",
  halo: "#ffffff",
};

const nom = ["coalesce", ["get", "name:fr"], ["get", "name:latin"], ["get", "name"]];
const ligne = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const horsTunnel = ["!=", ["get", "brunnel"], "tunnel"];

/** Une famille de routes : le bord, puis la chaussée, plus larges en s'approchant. */
function route(id: string, classes: string[], couleur: string, bord: string, largeurs: [number, number][], min = 5) {
  const filtre = ["all", ligne, horsTunnel, ["match", ["get", "class"], classes, true, false]];
  const largeur = (k: number) => ["interpolate", ["exponential", 1.4], ["zoom"], ...largeurs.flatMap(([z, w]) => [z, w * k])];
  return [
    {
      id: `${id}-bord`,
      type: "line",
      source: "osm",
      "source-layer": "transportation",
      minzoom: min,
      filter: filtre,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": bord, "line-width": largeur(1.35), "line-opacity": ["interpolate", ["linear"], ["zoom"], min, 0, min + 1, 1] },
    },
    {
      id,
      type: "line",
      source: "osm",
      "source-layer": "transportation",
      minzoom: min,
      filter: filtre,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": couleur, "line-width": largeur(1) },
    },
  ];
}

function etiquette(id: string, classes: string[], min: number, max: number, tailles: [number, number][], gras = true) {
  return {
    id,
    type: "symbol",
    source: "osm",
    "source-layer": "place",
    minzoom: min,
    maxzoom: max,
    filter: ["match", ["get", "class"], classes, true, false],
    layout: {
      "text-field": nom,
      "text-font": [gras ? "Noto Sans Bold" : "Noto Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], ...tailles.flat()],
      "text-max-width": 8,
      "text-letter-spacing": 0.01,
    },
    paint: { "text-color": C.texte, "text-halo-color": C.halo, "text-halo-width": 1.6, "text-halo-blur": 0.4 },
  };
}

export function styleSnap(): StyleSpecification {
  const style = {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    // Une lumière douce, presque de face : les volumes restent du plâtre clair.
    light: { anchor: "viewport", color: "#ffffff", intensity: 0.3, position: [1.2, 200, 35] },
    sources: {
      osm: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
      // Les tuiles d'altitude s'arrêtent au zoom 11 et sont agrandies au-delà
      // (22/10) : un ombrage un peu plus doux dans les montagnes, le même sur
      // la métropole, et un tiers de moins à charger à l'ouverture (1,7 Mo
      // devenus 1,2 sur un téléphone, 3,1 devenus 1,9 sur un ordinateur ;
      // elles allaient jusqu'au zoom 13, chacune de 50 à 150 Ko).
      relief: {
        type: "raster-dem",
        tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 11,
      },
      satellite: {
        type: "raster",
        tiles: [SATELLITE],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Esri, Maxar, Earthstar Geographics",
      },
    },
    layers: [
      { id: "terre", type: "background", paint: { "background-color": C.terre } },
      {
        id: "quartiers",
        type: "fill",
        source: "osm",
        "source-layer": "landuse",
        filter: ["match", ["get", "class"], ["residential", "suburb", "neighbourhood"], true, false],
        paint: { "fill-color": C.quartier, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 1] },
      },
      {
        id: "bois",
        type: "fill",
        source: "osm",
        "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["wood", "forest"], true, false],
        paint: { "fill-color": C.bois, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 10, 0.9] },
      },
      {
        id: "herbe",
        type: "fill",
        source: "osm",
        "source-layer": "landcover",
        filter: ["match", ["get", "class"], ["grass", "farmland", "wetland"], true, false],
        paint: { "fill-color": C.parc, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.25, 12, 0.6] },
      },
      { id: "parcs", type: "fill", source: "osm", "source-layer": "park", paint: { "fill-color": C.parc, "fill-opacity": 0.9 } },
      {
        id: "terrains",
        type: "fill",
        source: "osm",
        "source-layer": "landuse",
        filter: ["match", ["get", "class"], ["pitch", "stadium", "playground", "track"], true, false],
        paint: { "fill-color": C.terrain, "fill-outline-color": "#ffffff" },
      },
      {
        id: "ombrage",
        type: "hillshade",
        source: "relief",
        paint: {
          "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 5, 0.55, 12, 0.3, 15, 0.15],
          "hillshade-shadow-color": "rgba(92, 84, 70, 0.55)",
          "hillshade-highlight-color": "rgba(255, 255, 255, 0.6)",
          "hillshade-accent-color": "rgba(92, 84, 70, 0.25)",
          "hillshade-illumination-anchor": "map",
        },
      },
      {
        id: "rivieres",
        type: "line",
        source: "osm",
        "source-layer": "waterway",
        filter: horsTunnel,
        layout: { "line-cap": "round" },
        paint: { "line-color": C.eau, "line-width": ["interpolate", ["exponential", 1.4], ["zoom"], 8, 0.6, 14, 3, 18, 10] },
      },
      {
        id: "eau",
        type: "fill",
        source: "osm",
        "source-layer": "water",
        filter: horsTunnel,
        paint: { "fill-color": C.eau, "fill-outline-color": C.eauBord },
      },
      {
        id: "rails",
        type: "line",
        source: "osm",
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["all", ligne, horsTunnel, ["match", ["get", "class"], ["rail", "transit"], true, false]],
        paint: { "line-color": C.rail, "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 18, 3] },
      },
      ...route("chemins", ["path", "track"], "#fbfaf6", C.rueBord, [[14, 0.6], [18, 3]], 14),
      ...route("ruelles", ["minor", "service"], C.rue, C.rueBord, [[12, 0.5], [14, 2.2], [18, 14]], 12),
      ...route("rues", ["secondary", "tertiary"], C.rue, C.rueBord, [[8, 0.5], [12, 1.8], [14, 4], [18, 20]], 8),
      ...route("avenues", ["primary", "trunk"], C.grande, C.grandeBord, [[6, 0.6], [10, 1.6], [14, 5], [18, 24]], 6),
      ...route("autoroutes", ["motorway"], C.grande, C.grandeBord, [[5, 0.8], [10, 2.2], [14, 6], [18, 26]], 5),
      {
        id: "bati",
        type: "fill",
        source: "osm",
        "source-layer": "building",
        minzoom: 12.5,
        maxzoom: 14,
        paint: { "fill-color": C.bati, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 12.5, 0, 13, 1] },
      },
      {
        id: "volumes",
        type: "fill-extrusion",
        source: "osm",
        "source-layer": "building",
        minzoom: 13.5,
        paint: {
          "fill-extrusion-color": C.volume,
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 14.5, ["coalesce", ["get", "render_height"], 6]],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.92,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
        layout: { visibility: "none" },
        paint: { "raster-opacity": 0, "raster-opacity-transition": { duration: FONDU, delay: 0 }, "raster-fade-duration": 200 },
      },
      {
        id: "noms-rues",
        type: "symbol",
        source: "osm",
        "source-layer": "transportation_name",
        minzoom: 14,
        filter: ["match", ["get", "class"], ["primary", "secondary", "tertiary", "trunk", "minor"], true, false],
        layout: {
          "symbol-placement": "line",
          "text-field": nom,
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10.5, 18, 13],
          "text-rotation-alignment": "map",
          "text-pitch-alignment": "viewport",
        },
        paint: { "text-color": "#6d6a64", "text-halo-color": C.halo, "text-halo-width": 1.4 },
      },
      {
        id: "noms-eau",
        type: "symbol",
        source: "osm",
        "source-layer": "water_name",
        minzoom: 9,
        layout: { "text-field": nom, "text-font": ["Noto Sans Italic"], "text-size": 12, "text-max-width": 7 },
        paint: { "text-color": "#3d8fbf", "text-halo-color": "rgba(255,255,255,0.7)", "text-halo-width": 1.2 },
      },
      etiquette("noms-quartiers", ["suburb", "neighbourhood", "quarter"], 12, 17, [[12, 10.5], [16, 12]], false),
      etiquette("noms-villages", ["village", "hamlet"], 10, 16, [[10, 10.5], [14, 12.5]], false),
      etiquette("noms-villes", ["town"], 7, 15, [[7, 10.5], [12, 13]]),
      etiquette("noms-grandes-villes", ["city"], 4, 14, [[4, 11], [8, 13], [12, 16]]),
      etiquette("noms-pays", ["country"], 2, 6, [[2, 11], [6, 14]], false),
    ],
  };
  return style as unknown as StyleSpecification;
}

/** Les libellés : encre sur blanc au plan, blanc sur noir sur la photo. */
export const LIBELLES = ["noms-rues", "noms-eau", "noms-quartiers", "noms-villages", "noms-villes", "noms-grandes-villes", "noms-pays"];
