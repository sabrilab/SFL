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
// « classique » : le plan d'avant, sans zones. Aucune des trois ne prend
// l'or, le bleu ni le rouge (réservés aux cartes MVP, Défensive, Impact).
// Les zones en attente (des joueurs, pas encore de match) sont en
// pointillé dans les trois.

import type { Map as PlanMap } from "maplibre-gl";
import { chaleur, contoursDesZones, voileHorsZones, type Zone } from "@/lib/sfl/zones";

export type Ambiance = "classique" | "territoire" | "nuit" | "encre";
export const AMBIANCES: Ambiance[] = ["territoire", "nuit", "encre", "classique"];

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

const PALETTES: Record<Ambiance, Palette> = { classique: SNAP, territoire: SNAP, nuit: NUIT, encre: ENCRE };

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

/** Les couches des zones, une fois, sous les libellés (et donc sous les terrains possibles et les repères). */
export function poserZones(map: PlanMap, zones: Zone[]) {
  if (map.getSource("zones-voile")) return;
  if (!map.hasImage("hachures")) map.addImage("hachures", hachures(), { pixelRatio: 2 });
  map.addSource("zones-chaleur", { type: "geojson", data: chaleur(zones) });
  map.addSource("zones-voile", { type: "geojson", data: voileHorsZones(zones) });
  map.addSource("zones-traits", { type: "geojson", data: contoursDesZones(zones) });
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
  map.addLayer({ id: "zones-voile", type: "fill", source: "zones-voile", paint: { "fill-opacity": 0, "fill-antialias": false } }, AVANT);
  map.addLayer({ id: "zones-hachures", type: "fill", source: "zones-voile", paint: { "fill-pattern": "hachures", "fill-opacity": 0, "fill-antialias": false } }, AVANT);
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
  set("zones-voile", voileHorsZones(zones));
  set("zones-traits", contoursDesZones(zones));
}

const loinPres = (loin: number, pres: number, z1 = 6, z2 = 13) => ["interpolate", ["linear"], ["zoom"], z1, loin, z2, pres];

/** Le ton des zones, selon l'ambiance (et le fond : la photo satellite n'a pas de voile). */
export function teinterZones(map: PlanMap, ambiance: Ambiance, satellite: boolean) {
  if (!map.getLayer("zones-voile")) return;
  const set = (id: string, prop: string, v: unknown) => map.setPaintProperty(id, prop, v);
  const sans = ambiance === "classique";
  // Le voile : papier hachuré, nuit, ou presque rien (l'encre dit la data par la chaleur).
  const voile = sans || satellite ? 0 : ambiance === "territoire" ? 0.62 : ambiance === "nuit" ? 0.7 : 0.5;
  set("zones-voile", "fill-color", ambiance === "nuit" ? "#030304" : ambiance === "encre" ? "#d6d5cf" : "#f3f1ea");
  set("zones-voile", "fill-opacity", voile);
  set("zones-hachures", "fill-opacity", ambiance === "territoire" && !satellite ? 1 : 0);
  // La chaleur : des projecteurs la nuit, de l'encre sur le papier.
  set("zones-chaleur", "heatmap-opacity", sans || satellite || ambiance === "territoire" ? 0 : ambiance === "nuit" ? 0.95 : 0.9);
  set(
    "zones-chaleur",
    "heatmap-color",
    ambiance === "nuit"
      ? ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(255,255,255,0)", 0.15, "rgba(255,255,255,0.06)", 0.5, "rgba(246,247,242,0.2)", 1, "rgba(246,247,242,0.42)"]
      : ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(10,11,13,0)", 0.15, "rgba(10,11,13,0.05)", 0.5, "rgba(10,11,13,0.14)", 1, "rgba(10,11,13,0.3)"]
  );
  // Le contour : encre sur liseré blanc, trait de lumière, ou double filet.
  const encre = ambiance === "nuit" || satellite ? "#f4f5f2" : "#0a0b0d";
  set("zones-trait", "line-color", encre);
  set("zones-trait", "line-opacity", sans ? 0 : 1);
  set("zones-trait", "line-width", ambiance === "encre" ? loinPres(0.7, 1.1) : loinPres(1.6, 2.6));
  set("zones-trait", "line-gap-width", ambiance === "encre" ? loinPres(2, 4) : 0);
  set("zones-trait", "line-blur", ambiance === "nuit" ? 0.6 : 0);
  set("zones-lisere", "line-color", ambiance === "nuit" ? "rgba(246,247,242,0.18)" : "#ffffff");
  set("zones-lisere", "line-opacity", sans || ambiance === "encre" ? 0 : 1);
  set("zones-lisere", "line-width", ambiance === "nuit" ? loinPres(8, 14) : loinPres(5, 8));
  set("zones-lisere", "line-blur", ambiance === "nuit" ? 6 : 0);
  set("zones-attente", "line-color", encre);
  set("zones-attente", "line-opacity", sans ? 0 : 0.55);
  // Les terrains possibles, de loin : des points cerclés, à peine la nuit.
  if (map.getLayer("possibles-points") && !satellite) {
    map.setPaintProperty("possibles-points", "circle-stroke-color", ambiance === "nuit" ? "rgba(246,247,242,0.35)" : "#ffffff");
    map.setPaintProperty("possibles-points", "circle-color", ambiance === "nuit" ? "#5d6067" : ambiance === "encre" ? "#6b6c70" : "#8a8c91");
  }
}
