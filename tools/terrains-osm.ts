// Les terrains hors de France : la part du catalogue des terrains
// (tools/terrains.ts) qui vient d'OpenStreetMap.
//
// Sabri, 26/10 : « la France, la Belgique, la Hollande, l'Allemagne,
// l'Italie, l'Angleterre, l'Espagne, la Suisse, les Pays-Bas, même le
// Maghreb ». Aucun de ces pays n'a de recensement ouvert comme celui de la
// France : on prend OpenStreetMap (© les contributeurs d'OpenStreetMap,
// ODbL 1.0), par l'API Overpass, pays par pays. Le Luxembourg vient avec la
// Belgique et les Pays-Bas ; « l'Angleterre » est tout le Royaume-Uni (GB).
//
// Le même genre de terrain que l'hippodrome : un terrain de foot
// (leisure=pitch, sport=soccer) en gazon synthétique (surface=artificial_turf),
// pas sous un toit, ni fermé au public, ni d'une école (ECOLE). Au Maghreb, très peu de terrains
// portent leur revêtement sur la carte (une quarantaine de synthétiques au
// Maroc sur 1 400 terrains) : on y prend tous les terrains de foot, sauf
// ceux en herbe, les grands stades.
//
// Un complexe = les terrains à moins de 150 m les uns des autres. Son nom :
// le centre sportif ou le stade qui l'entoure (le plus proche à moins de
// 300 m), sinon le nom d'un de ses terrains, sinon « Terrain synthétique ».
// Sa commune : la ville ou le village le plus proche (place=city, town,
// village). Son adresse : celle que portent ses terrains ou son centre,
// sinon sa commune seule. Le format de chaque terrain : son nom quand il le
// dit (« 5v5 », « 7-a-side », « à 5 »), sinon ses dimensions, lues sur son
// tracé (les mêmes seuils que le recensement, tools/terrains-france.ts),
// sinon « futsal » → à 5 ; 0 quand on ne sait pas.

import type { TerrainRecense } from "../src/lib/sfl/terrains";

export const PAYS_OSM = ["BE", "NL", "LU", "DE", "CH", "IT", "ES", "GB", "MA", "DZ", "TN"] as const;
/** Le Maghreb : tous les terrains de foot sauf ceux en herbe (voir plus haut). */
const MAGHREB = new Set(["MA", "DZ", "TN"]);

export const SOURCE_OSM = { nom: "OpenStreetMap, © ses contributeurs", licence: "ODbL 1.0" };

const zone = (pays: string) => `area["ISO3166-1:alpha2"="${pays}"][admin_level=2]->.a;`;

/** Les requêtes Overpass d'un pays : ses terrains (avec leur tracé), ses centres sportifs, ses villes. */
export function requetes(pays: string): { terrains: string; centres: string; villes: string } {
  const sol = MAGHREB.has(pays) ? `["surface"!~"^(grass|natural_grass)$"]` : `["surface"="artificial_turf"]`;
  return {
    terrains: `[out:json][timeout:600];${zone(pays)}nwr["leisure"="pitch"]["sport"~"soccer"]${sol}(area.a);out tags geom;`,
    // Seulement ceux à moins de 300 m d'un terrain retenu : les autres ne nomment rien.
    centres: `[out:json][timeout:600];${zone(pays)}nwr["leisure"="pitch"]["sport"~"soccer"]${sol}(area.a)->.p;nwr["leisure"~"^(sports_centre|stadium|sports_hall)$"]["name"](around.p:300);out center tags;`,
    villes: `[out:csv(::lat,::lon,name,"name:fr",place;false;"|")][timeout:600];${zone(pays)}node["place"~"^(city|town|village|suburb)$"]["name"](area.a);out;`,
  };
}

interface Element {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: ({ lat: number; lon: number } | null)[];
  tags?: Record<string, string>;
}

export interface ReponseOverpass {
  osm3s?: { timestamp_osm_base?: string };
  elements: Element[];
}

type Point = { lat: number; lng: number };

function km(a: Point, b: Point): number {
  const r = Math.PI / 180;
  const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(d));
}

/** Le centre d'un élément : son point, son centre, le milieu de son tracé ou de sa boîte. */
function centre(e: Element): Point | null {
  if (e.lat != null && e.lon != null) return { lat: e.lat, lng: e.lon };
  if (e.center) return { lat: e.center.lat, lng: e.center.lon };
  const pts = (e.geometry ?? []).filter((p): p is { lat: number; lon: number } => !!p);
  if (pts.length) {
    // Sans le dernier point d'un tracé fermé, qui répète le premier.
    const ouverts = pts.length > 2 && pts[0].lat === pts.at(-1)!.lat && pts[0].lon === pts.at(-1)!.lon ? pts.slice(0, -1) : pts;
    return { lat: ouverts.reduce((s, p) => s + p.lat, 0) / ouverts.length, lng: ouverts.reduce((s, p) => s + p.lon, 0) / ouverts.length };
  }
  if (e.bounds) return { lat: (e.bounds.minlat + e.bounds.maxlat) / 2, lng: (e.bounds.minlon + e.bounds.maxlon) / 2 };
  return null;
}

/** La longueur et la largeur d'un tracé, en mètres : le plus petit rectangle qui l'enferme, tourné sur l'un de ses côtés. */
function dimensions(e: Element): [number, number] | null {
  const pts = (e.geometry ?? []).filter((p): p is { lat: number; lon: number } => !!p);
  if (pts.length < 4) return null;
  const lat0 = pts[0].lat;
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const xy = pts.map((p) => [(p.lon - pts[0].lon) * kx, (p.lat - lat0) * 110_574] as const);
  let meilleur: [number, number] | null = null;
  for (let i = 0; i < xy.length - 1; i++) {
    const a = Math.atan2(xy[i + 1][1] - xy[i][1], xy[i + 1][0] - xy[i][0]);
    const c = Math.cos(a);
    const s = Math.sin(a);
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const [x, y] of xy) {
      const u = x * c + y * s;
      const v = -x * s + y * c;
      x0 = Math.min(x0, u);
      x1 = Math.max(x1, u);
      y0 = Math.min(y0, v);
      y1 = Math.max(y1, v);
    }
    const d: [number, number] = [x1 - x0, y1 - y0];
    if (d[0] * d[1] > 1 && (!meilleur || d[0] * d[1] < meilleur[0] * meilleur[1])) meilleur = d;
  }
  return meilleur ? (meilleur.sort((a, b) => b - a) as [number, number]) : null;
}

/**
 * Un format écrit dans le nom, en plusieurs langues : « 5v5 », « 5 vs 5 »,
 * « 5-a-side », « 7er », « calcetto » (à 5), « calciotto » (à 8),
 * « fútbol 7 », « à 5 ». Jamais un numéro de terrain (« Pitch 2 »).
 */
const ECRIT = [
  /(?<![0-9])(3|5|6|7|8|9|11) ?(?:v|vs|x|contre|tegen|gegen|contro|contra|-?a-?side|er)(?![a-z])/i,
  /(?:^|[^a-zà-ÿ0-9])(?:à|a|fútbol|futbol|calcio|f) ?(3|5|6|7|8|9|11)(?![0-9])/i,
];

function format(tags: Record<string, string>, dims: [number, number] | null): number {
  const nom = `${tags.name ?? ""} ${tags["name:fr"] ?? ""} ${tags.description ?? ""}`;
  for (const re of ECRIT) {
    const m = nom.match(re);
    if (m) {
      const n = Number(m[1]);
      return n === 6 ? 5 : n === 9 ? 8 : n;
    }
  }
  if (/calcetto|five|futsal|fünfer|soccer ?5/i.test(nom)) return 5;
  if (/calciotto/i.test(nom)) return 8;
  if (dims) {
    const [long, large] = dims;
    if (long < 30) return 3;
    if (long <= 50 && large <= 30) return 5;
    if (long <= 65 && large <= 45) return 7;
    return long < 88 ? 8 : 11;
  }
  if (/futsal/.test(tags.sport ?? "")) return 5;
  return 0;
}

/** Les terrains d'écoles et d'universités, fermés aux joueurs (comme au recensement). */
const ECOLE = /\b(school|schule|gymnasium|grundschule|scuola|liceo|colegio|instituto|universit|college|campus|academy|école|ecole|lycée|lycee|collège|basisschool|atheneum|internat)/i;

/** Fermé au public, sous un toit, dans un bâtiment, ou d'une école. */
function ecarte(tags: Record<string, string>): boolean {
  return (
    /^(private|no)$/.test(tags.access ?? "") ||
    tags.indoor === "yes" ||
    tags.covered === "yes" ||
    tags.location === "indoor" ||
    tags.building != null ||
    tags.disused === "yes" ||
    tags.abandoned === "yes" ||
    ECOLE.test(`${tags.name ?? ""} ${tags.operator ?? ""}`) ||
    PRO.test(tags.name ?? "")
  );
}

/** Un nom qui ne dit rien (« Pitch 2 », « Kunstrasen », « Terrain »). */
const SANS_NOM = /^(terrain|pitch|field|veld|campo|platz|kunstrasen(platz)?|kunstgras(veld)?|synthetic|astro(turf)?|3g|artificial|cancha|terreno|terrain synth[ée]tique|sportplatz)\b[\s\d\w-]{0,6}$/i;

function nomDe(tags: Record<string, string> | undefined, maghreb: boolean): string | null {
  if (!tags) return null;
  const n = ((maghreb ? tags["name:fr"] : null) ?? tags.name ?? tags["name:fr"] ?? "").replace(/\s+/g, " ").trim();
  // Au Maghreb, un nom en arabe sans traduction française se lit mal dans l'app : on garde le générique.
  if (!n || SANS_NOM.test(n) || (maghreb && /[؀-ۿ]/.test(n) && !/[a-z]/i.test(n))) return null;
  return n.slice(0, 80);
}

/** Les centres sportifs qui ne sont pas des terrains de foot. */
const PAS_FOOT = /aqua|piscine|zwembad|schwimm|bad\b|swim|pool|piscina|tennis|golf|padel|équestre|equestr|manège|reit|patinoire|ijs|eis|ski|bowling|fitness|hockey|cricket|rugby/i;

/** Les centres d'entraînement des clubs pros, fermés aux joueurs (comme le LOSC au recensement) : leurs terrains ne sont pas proposés. */
const PRO = /training ground|trainingsgel[äa]nde|trainingszentrum|centre d'entra[îi]nement|centre de formation|centro (di )?allenamento|ciudad deportiva|sports? academy/i;

function adresseDe(tags: Record<string, string> | undefined): string | null {
  if (!tags?.["addr:street"]) return null;
  const rue = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const ville = [tags["addr:postcode"], tags["addr:city"]].filter(Boolean).join(" ");
  return [rue, ville].filter(Boolean).join(", ");
}

/** Une grille de 0,05° pour trouver vite ce qui est près d'un point. */
class Grille<T extends Point> {
  private m = new Map<string, T[]>();
  constructor(
    items: T[],
    private pas = 0.05
  ) {
    for (const t of items) {
      const k = `${Math.floor(t.lat / pas)}_${Math.floor(t.lng / pas)}`;
      (this.m.get(k) ?? this.m.set(k, []).get(k)!).push(t);
    }
  }
  /** Ce qui est dans les cases voisines (à `anneaux` cases autour). */
  pres(p: Point, anneaux = 1): T[] {
    const [i, j] = [Math.floor(p.lat / this.pas), Math.floor(p.lng / this.pas)];
    const r: T[] = [];
    for (let a = -anneaux; a <= anneaux; a++) for (let b = -anneaux; b <= anneaux; b++) r.push(...(this.m.get(`${i + a}_${j + b}`) ?? []));
    return r;
  }
  plusProche(p: Point, maxKm: number, anneaux = 1): T | null {
    let best: T | null = null;
    let d = maxKm;
    for (const t of this.pres(p, anneaux)) {
      const x = km(p, t);
      if (x < d) [best, d] = [t, x];
    }
    return best;
  }
}

/** Les villes d'un pays, depuis le CSV d'Overpass (lat|lon|name|name:fr|place). */
function lireVilles(csv: string, maghreb: boolean): (Point & { nom: string; place: string })[] {
  return csv
    .split("\n")
    .map((l) => l.split("|"))
    .filter((c) => c.length >= 5 && c[4] !== "suburb")
    .map(([lat, lng, nom, nomFr, place]) => ({ lat: Number(lat), lng: Number(lng), nom: (maghreb && nomFr) || nom || nomFr, place }))
    .filter((v) => Number.isFinite(v.lat) && Number.isFinite(v.lng) && !!v.nom);
}

/** Les complexes d'un pays ; leur id est celui de leur plus grand terrain à OpenStreetMap (« w123456 »), sans sa case. */
export function complexesOsm(pays: string, terrains: ReponseOverpass, centres: ReponseOverpass, villesCsv: string): TerrainRecense[] {
  const maghreb = MAGHREB.has(pays);
  const pitches = terrains.elements
    .filter((e) => e.tags && !ecarte(e.tags))
    .map((e) => {
      const c = centre(e);
      const dims = dimensions(e);
      return c ? { ...c, e, f: format(e.tags!, dims), surface: dims ? dims[0] * dims[1] : 0 } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  // Un centre qui n'a rien du foot (une piscine, un tennis, un golf) ne donne pas son nom au complexe d'à côté.
  const lesCentres = new Grille(
    centres.elements
      .filter((e) => !PAS_FOOT.test(e.tags?.name ?? "") && !ECOLE.test(e.tags?.name ?? "") && (!e.tags?.sport || /soccer|football|multi/.test(e.tags.sport)))
      .map((e) => ({ ...(centre(e) ?? { lat: NaN, lng: NaN }), e })).filter((c) => Number.isFinite(c.lat))
  );
  const villes = lireVilles(villesCsv, maghreb);
  const lesVilles = new Grille(villes, 0.1);

  // Les terrains voisins (moins de 150 m) font un complexe.
  const parent = pitches.map((_, i) => i);
  const racine = (i: number): number => (parent[i] === i ? i : (parent[i] = racine(parent[i])));
  const indexes = pitches.map((p, i) => ({ lat: p.lat, lng: p.lng, i }));
  const grille = new Grille(indexes, 0.01);
  for (const a of indexes) for (const b of grille.pres(a)) if (b.i > a.i && km(a, b) < 0.15) parent[racine(b.i)] = racine(a.i);
  const groupes = new Map<number, typeof pitches>();
  pitches.forEach((p, i) => {
    const r = racine(i);
    (groupes.get(r) ?? groupes.set(r, []).get(r)!).push(p);
  });

  const sortie: TerrainRecense[] = [];
  for (const g of groupes.values()) {
    g.sort((a, b) => b.f - a.f || b.surface - a.surface);
    const tete = g[0];
    const lat = g.reduce((s, p) => s + p.lat, 0) / g.length;
    const lng = g.reduce((s, p) => s + p.lng, 0) / g.length;
    const ici = { lat, lng };
    const leCentre = lesCentres.plusProche(ici, 0.3);
    if (leCentre && PRO.test(leCentre.e.tags?.name ?? "")) continue;
    const ville = lesVilles.plusProche(ici, 12, 2);
    const commune = ville?.nom ?? "";
    const nom = nomDe(leCentre?.e.tags, maghreb) ?? g.map((p) => nomDe(p.e.tags, maghreb)).find(Boolean) ?? (maghreb && tete.e.tags?.surface !== "artificial_turf" ? "Terrain de foot" : "Terrain synthétique");
    const adresse = g.map((p) => adresseDe(p.e.tags)).find(Boolean) ?? adresseDe(leCentre?.e.tags) ?? commune;
    sortie.push({
      id: `${tete.e.type[0]}${tete.e.id}`,
      nom,
      commune,
      adresse,
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      formats: g.map((p) => p.f).sort((a, b) => b - a),
      eclaire: g.some((p) => p.e.tags?.lit === "yes"),
      libre: g.some((p) => /^(yes|public|permissive)$/.test(p.e.tags?.access ?? "")),
      pays,
    });
  }
  return sortie;
}
