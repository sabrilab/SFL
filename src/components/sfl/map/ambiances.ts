// Les ambiances du plan et les zones Bola (30/10, Sabri : « changer de
// couleur la carte, faire en sorte qu'elle représente plus la data de
// Bola »). Trois essais, posés sur le même plan (map/style-snap.ts) sans
// recharger le style : on repeint ses couches.
//
//   · « territoire » : le plan crème de la Snap Map, mais hors des zones
//     ouvertes, un voile de papier hachuré, comme une terre pas encore
//     jouée ; chaque zone cernée d'un trait d'encre sur un liseré blanc,
//     comme un sticker découpé.
//   · « nuit » : le plan passe au noir ; les zones restent éclairées, comme
//     un terrain sous ses projecteurs, d'autant plus fort qu'on y joue et
//     qu'on y vit (la chaleur : lieux de match et villes des joueurs).
//   · « encre » : le noir et blanc de la carte de joueur, papier et encre ;
//     la data en encre plus dense là où vit Bola, chaque zone cernée d'un
//     double filet, comme le cadre imprimé d'une carte.
//
//   · « brume » (30/10 au soir, Sabri : « un bel effet de brume, des
//     nuages […] il faut qu'on voie qu'il y a des zones ») : hors des zones,
//     le plan s'efface sous une brume blanche et des nuages ; la zone reste
//     nette, bordée d'une lueur.
//   · « rouge » et « braise » (« peut-être que ça peut être rouge […] une
//     frontière ») : la zone teintée et bordée d'une frontière de couleur
//     franche qui luit, le dehors grisé. Le rouge est réservé aux cartes
//     Impact : la braise est l'essai de rechange.
//
// « classique » : le plan d'avant, sans zones. Seul l'essai « rouge »
// prend une couleur réservée (Impact), pour que Sabri tranche.
// Les zones en attente (des joueurs, pas encore de match) sont en
// pointillé dans les trois.

import type { Map as PlanMap } from "maplibre-gl";
import { chaleur, contoursDesZones, FONDU_PAS, voilesEnFondu, type Zone } from "@/lib/sfl/zones";

export type Ambiance = "classique" | "territoire" | "nuit" | "encre" | "brume" | "rouge" | "braise";
/** Les essais montrés dans l'aperçu (nuit et encre restent par l'adresse). */
export const AMBIANCES: Ambiance[] = ["brume", "rouge", "braise", "territoire", "classique"];
export const TOUTES_AMBIANCES: Ambiance[] = [...AMBIANCES, "nuit", "encre"];

interface Palette {
  terre: string;
  quartier: string;
  parc: string;
  bois: string;
  terrain: string;
  eau: string;
  eauBord: string;
  rue: string;
  rueBord: string;
  grande: string;
  grandeBord: string;
  bati: string;
  volume: string;
  rail: string;
  ombre: string;
  texte: string;
  texteRues: string;
  texteEau: string;
  halo: string;
}

/** Le plan d'avant (map/style-snap.ts) : « territoire » le garde. */
const SNAP: Palette = {
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
  ombre: "rgba(92, 84, 70, 0.55)",
  texte: "#6b6d72",
  texteRues: "#6d6a64",
  texteEau: "#3d8fbf",
  halo: "#ffffff",
};

const NUIT: Palette = {
  terre: "#111214",
  quartier: "#15171a",
  parc: "#16201a",
  bois: "#141d17",
  terrain: "#1f3b25",
  eau: "#0b0d10",
  eauBord: "#0b0d10",
  rue: "#2a2d32",
  rueBord: "#1b1d21",
  grande: "#3a3d43",
  grandeBord: "#22252a",
  bati: "#1a1c20",
  volume: "#26292e",
  rail: "#2b2e33",
  ombre: "rgba(0, 0, 0, 0.6)",
  texte: "#b9bcc1",
  texteRues: "#8d9096",
  texteEau: "#6e7278",
  halo: "#0a0b0d",
};

const ENCRE: Palette = {
  terre: "#f2f1ec",
  quartier: "#ebe9e3",
  parc: "#e1e3dc",
  bois: "#d9dcd4",
  terrain: "#cdd2c7",
  eau: "#dcdedd",
  eauBord: "#cfd2d1",
  rue: "#ffffff",
  rueBord: "#dcd9d1",
  grande: "#ffffff",
  grandeBord: "#c9c5bc",
  bati: "#e2e0da",
  volume: "#f7f6f2",
  rail: "#cfccc4",
  ombre: "rgba(40, 40, 40, 0.45)",
  texte: "#3a3b3e",
  texteRues: "#5b5c60",
  texteEau: "#6f7275",
  halo: "#ffffff",
};

const PALETTES: Record<Ambiance, Palette> = { classique: SNAP, territoire: SNAP, nuit: NUIT, encre: ENCRE, brume: SNAP, rouge: SNAP, braise: SNAP };

/** La couleur de frontière des essais « rouge » et « braise ». */
const FRONTIERE: Partial<Record<Ambiance, string>> = { rouge: "#E3262E", braise: "#FF6A1A" };

/** Les libellés d'une ambiance (le fond satellite garde son blanc sur noir). */
export function couleurLibelle(ambiance: Ambiance, id: string, satellite: boolean): { texte: string; halo: string } {
  if (satellite) return { texte: "#f4f5f2", halo: "rgba(10, 11, 13, 0.85)" };
  const p = PALETTES[ambiance];
  return { texte: id === "noms-rues" ? p.texteRues : id === "noms-eau" ? p.texteEau : p.texte, halo: p.halo };
}

const ROUTES: [string, keyof Palette, keyof Palette][] = [
  ["chemins", "rue", "rueBord"],
  ["ruelles", "rue", "rueBord"],
  ["rues", "rue", "rueBord"],
  ["avenues", "grande", "grandeBord"],
  ["autoroutes", "grande", "grandeBord"],
];

/** Repeindre le plan dans une ambiance. */
export function peindre(map: PlanMap, ambiance: Ambiance) {
  const p = PALETTES[ambiance];
  const set = (id: string, prop: string, v: unknown) => map.getLayer(id) && map.setPaintProperty(id, prop, v);
  set("terre", "background-color", p.terre);
  set("quartiers", "fill-color", p.quartier);
  set("bois", "fill-color", p.bois);
  set("herbe", "fill-color", p.parc);
  set("parcs", "fill-color", p.parc);
  set("terrains", "fill-color", p.terrain);
  set("terrains", "fill-outline-color", ambiance === "nuit" ? "#2c5a35" : "#ffffff");
  set("ombrage", "hillshade-shadow-color", p.ombre);
  set("ombrage", "hillshade-highlight-color", ambiance === "nuit" ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.6)");
  set("rivieres", "line-color", p.eau);
  set("eau", "fill-color", p.eau);
  set("eau", "fill-outline-color", p.eauBord);
  set("rails", "line-color", p.rail);
  for (const [id, c, b] of ROUTES) {
    set(id, "line-color", p[c]);
    set(`${id}-bord`, "line-color", p[b]);
  }
  set("chemins", "line-color", ambiance === "nuit" ? "#1f2125" : ambiance === "encre" ? "#f8f8f5" : "#fbfaf6");
  set("bati", "fill-color", p.bati);
  set("volumes", "fill-extrusion-color", p.volume);
}

/* ------------------------------ Les zones ------------------------------ */

const AVANT = "noms-rues";

/** Les hachures du voile « territoire » : un trait d'encre en biais, très léger. */
function hachures(): { width: number; height: number; data: Uint8Array } {
  const n = 14;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const d = Math.abs(((x + y) % n) - n / 2);
      const a = d < 0.9 ? 34 : d < 1.6 ? 14 : 0;
      const i = (y * n + x) * 4;
      data[i] = 10;
      data[i + 1] = 11;
      data[i + 2] = 13;
      data[i + 3] = a;
    }
  return { width: n, height: n, data };
}

/**
 * Les nuages de « brume » : un bruit de valeur fractal qui se raccorde sur
 * ses bords (256 px), blanc, dont l'alpha suit la densité.
 */
function nuages(): { width: number; height: number; data: Uint8Array } {
  const n = 256;
  const hash = (x: number, y: number, p: number) => {
    const h = Math.sin(((x % p) + p) % p * 127.1 + (((y % p) + p) % p) * 311.7 + p * 74.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const lisse = (t: number) => t * t * (3 - 2 * t);
  const bruit = (x: number, y: number, p: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = lisse(x - xi), v = lisse(y - yi);
    const a = hash(xi, yi, p), b = hash(xi + 1, yi, p), c = hash(xi, yi + 1, p), d = hash(xi + 1, yi + 1, p);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let f = 0, amp = 0.55, tot = 0;
      for (let o = 0, p = 4; o < 5; o++, p *= 2, amp *= 0.5) {
        f += amp * bruit((x / n) * p, (y / n) * p, p);
        tot += amp;
      }
      f /= tot;
      const a = Math.max(0, Math.min(1, (f - 0.38) / 0.32));
      const i = (y * n + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(lisse(a) * 235);
    }
  return { width: n, height: n, data };
}

/** L'aire de chaque zone ouverte (son contour fermé), pour la teinter. */
function airesDesZones(zones: Zone[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: zones
      .filter((z) => z.ouverte && z.contour.length > 3)
      .map((z) => ({ type: "Feature", properties: { id: z.id }, geometry: { type: "Polygon", coordinates: [z.contour] } })),
  };
}

/** Les couches des zones, une fois, sous les libellés (et donc sous les terrains possibles et les repères). */
export function poserZones(map: PlanMap, zones: Zone[]) {
  if (map.getSource("zones-voile")) return;
  if (!map.hasImage("hachures")) map.addImage("hachures", hachures(), { pixelRatio: 2 });
  if (!map.hasImage("nuages")) map.addImage("nuages", nuages(), { pixelRatio: 1 });
  map.addSource("zones-chaleur", { type: "geojson", data: chaleur(zones) });
  map.addSource("zones-voile", { type: "geojson", data: voilesEnFondu(zones) });
  map.addSource("zones-traits", { type: "geojson", data: contoursDesZones(zones) });
  map.addSource("zones-aires", { type: "geojson", data: airesDesZones(zones) });
  map.addLayer({ id: "zones-teinte", type: "fill", source: "zones-aires", paint: { "fill-opacity": 0, "fill-antialias": false } }, AVANT);
  map.addLayer({ id: "zones-voile", type: "fill", source: "zones-voile", paint: { "fill-opacity": 0, "fill-antialias": false } }, AVANT);
  map.addLayer(
    { id: "zones-nuages", type: "fill", source: "zones-voile", filter: [">=", ["get", "k"], 3], paint: { "fill-pattern": "nuages", "fill-opacity": 0, "fill-antialias": false } },
    AVANT
  );
  map.addLayer({ id: "zones-hachures", type: "fill", source: "zones-voile", paint: { "fill-pattern": "hachures", "fill-opacity": 0, "fill-antialias": false } }, AVANT);
  map.addLayer(
    {
      id: "zones-chaleur",
      type: "heatmap",
      source: "zones-chaleur",
      maxzoom: 16,
      paint: {
        "heatmap-weight": ["get", "poids"],
        "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 4, 14, 9, 60, 12, 220, 15, 900],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 4, 0.8, 12, 1.1],
        "heatmap-opacity": 0,
      },
    },
    AVANT
  );
  map.addLayer(
    {
      id: "zones-lueur",
      type: "line",
      source: "zones-traits",
      filter: ["get", "ouverte"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#ffffff", "line-width": 0, "line-blur": 0, "line-opacity": 0 },
    },
    AVANT
  );
  map.addLayer(
    {
      id: "zones-lisere",
      type: "line",
      source: "zones-traits",
      filter: ["get", "ouverte"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#ffffff", "line-width": 0, "line-opacity": 0 },
    },
    AVANT
  );
  map.addLayer(
    {
      id: "zones-trait",
      type: "line",
      source: "zones-traits",
      filter: ["get", "ouverte"],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#0a0b0d", "line-width": 0, "line-opacity": 0 },
    },
    AVANT
  );
  map.addLayer(
    {
      id: "zones-attente",
      type: "line",
      source: "zones-traits",
      filter: ["!", ["get", "ouverte"]],
      layout: { "line-join": "round", "line-cap": "butt" },
      paint: { "line-color": "#0a0b0d", "line-width": 1.4, "line-opacity": 0, "line-dasharray": [2, 2.5] },
    },
    AVANT
  );
}

/** De nouvelles zones (un match ouvert ailleurs, une ville de plus). */
export function majZones(map: PlanMap, zones: Zone[]) {
  const set = (id: string, data: GeoJSON.GeoJSON) => {
    const s = map.getSource(id);
    if (s && "setData" in s) (s as { setData: (d: GeoJSON.GeoJSON) => void }).setData(data);
  };
  set("zones-chaleur", chaleur(zones));
  set("zones-voile", voilesEnFondu(zones));
  set("zones-traits", contoursDesZones(zones));
  set("zones-aires", airesDesZones(zones));
}

/** Le ton des zones, selon l'ambiance (et le fond : la photo satellite n'a pas de voile). */
export function teinterZones(map: PlanMap, ambiance: Ambiance, satellite: boolean) {
  if (!map.getLayer("zones-voile")) return;
  const set = (id: string, prop: string, v: unknown) => map.setPaintProperty(id, prop, v);
  const sans = ambiance === "classique";
  // Le voile en fondu (zones.ts, voilesEnFondu) : seize voiles empilés, de
  // plus en plus larges ; l'opacité est celle de chacun. Plus de trait ni de
  // hachures (Sabri, 30/10 : « pas une fracture […] que ça se fonde ») : hors
  // des zones le plan se grise peu à peu, dedans il reste clair.
  const brume = ambiance === "brume";
  const frontiere = FRONTIERE[ambiance];
  const voile =
    sans || satellite ? 0 : (brume ? 0.2 : frontiere ? 0.17 : ambiance === "territoire" ? 0.15 : ambiance === "nuit" ? 0.18 : 0.12) * (10 / FONDU_PAS);
  set("zones-voile", "fill-color", ambiance === "nuit" ? "#030304" : ambiance === "encre" ? "#cfcec8" : brume ? "#f6f7f8" : frontiere ? "#bfc0bc" : "#c9cac6");
  set("zones-voile", "fill-opacity", voile);
  set("zones-hachures", "fill-opacity", 0);
  // La brume : des nuages blancs qui s'épaississent en s'éloignant de la zone.
  set("zones-nuages", "fill-opacity", brume && !satellite ? 0.14 : 0);
  // La zone teintée de sa couleur, à peine (« rouge », « braise »).
  set("zones-teinte", "fill-color", frontiere ?? "#ffffff");
  set("zones-teinte", "fill-opacity", frontiere && !satellite ? 0.07 : 0);
  // Les halos : de la lumière là où l'on joue et d'où l'on vient, plus
  // forte la nuit ; à l'encre, une encre plus dense.
  set("zones-chaleur", "heatmap-opacity", sans || satellite ? 0 : 1);
  set(
    "zones-chaleur",
    "heatmap-color",
    ambiance === "encre"
      ? ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(10,11,13,0)", 0.15, "rgba(10,11,13,0.04)", 0.5, "rgba(10,11,13,0.1)", 1, "rgba(10,11,13,0.22)"]
      : ambiance === "nuit"
        ? ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.15, "rgba(255,255,255,0.06)", 0.5, "rgba(246,247,242,0.2)", 1, "rgba(246,247,242,0.42)"]
        : ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.15, "rgba(255,255,253,0.18)", 0.5, "rgba(255,255,253,0.38)", 1, "rgba(255,255,253,0.6)"]
  );
  for (const id of ["zones-trait", "zones-lisere", "zones-attente", "zones-lueur"]) set(id, "line-opacity", 0);
  // La frontière (« rouge », « braise ») : un trait franc sur une lueur
  // large et floue ; la brume : seulement une ombre douce, celle d'un banc
  // de nuages posé au bord de la zone.
  if (!satellite && (frontiere || brume)) {
    const largeur = ["interpolate", ["linear"], ["zoom"], 6, 1.6, 10, 3, 14, 4.5];
    set("zones-lueur", "line-color", frontiere ?? "#3a3d42");
    set("zones-lueur", "line-width", ["interpolate", ["linear"], ["zoom"], 6, 10, 10, 26, 14, 44]);
    set("zones-lueur", "line-blur", ["interpolate", ["linear"], ["zoom"], 6, 8, 10, 20, 14, 34]);
    set("zones-lueur", "line-opacity", frontiere ? 0.38 : 0.16);
    if (frontiere) {
      set("zones-lisere", "line-color", "#ffffff");
      set("zones-lisere", "line-width", ["interpolate", ["linear"], ["zoom"], 6, 3.6, 10, 6, 14, 8.5]);
      set("zones-lisere", "line-opacity", 0.9);
      set("zones-trait", "line-color", frontiere);
      set("zones-trait", "line-width", largeur);
      set("zones-trait", "line-opacity", 1);
    }
  }
  // Les terrains possibles, de loin : des points cerclés, à peine la nuit.
  if (map.getLayer("possibles-points") && !satellite) {
    map.setPaintProperty("possibles-points", "circle-stroke-color", ambiance === "nuit" ? "rgba(246,247,242,0.35)" : "#ffffff");
    map.setPaintProperty("possibles-points", "circle-color", ["case", ["get", "horsZone"], ambiance === "nuit" ? "#84D68C" : "#1F8A45", ambiance === "nuit" ? "#5d6067" : ambiance === "encre" ? "#6b6c70" : "#8a8c91"]);
  }
}
