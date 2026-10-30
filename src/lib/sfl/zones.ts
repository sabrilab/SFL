// Les zones Bola — la Map comme un territoire qui grandit (Sabri, 30/10 :
// « une zone qui se fait là où c'est ouvert […] si quelqu'un ouvre un match
// quelque part d'autre, ça puisse donner lieu à une zone qui s'ouvre »).
//
// Une zone ouverte naît d'un lieu où l'on joue : le terrain de la ligue, un
// match ouvert par un joueur, un défi d'équipe. Les lieux à moins de LIEN_KM
// les uns des autres font la même zone. Elle s'étend ensuite aux villes des
// joueurs qui vivent autour (à moins de VILLES_KM d'un de ses lieux) : la
// zone, c'est là où l'on joue et d'où l'on vient. Son contour est l'enveloppe
// de ces points, chacun pris avec un peu d'air (MARGE_KM).
//
// Les joueurs qui vivent loin de tout match font une zone en attente : pas
// encore ouverte, en pointillé, « 5 joueurs attendent ». Le premier match
// ouvert là-bas l'ouvre.
//
// Pur, sans React ni MapLibre : la page calcule, le plan dessine
// (map/carte-map.tsx). Les distances sont celles d'un plan local (la
// longitude resserrée par le cosinus de la latitude), assez juste à
// l'échelle d'une métropole.

export type GenreFoyer = "sfl" | "bola" | "team";

/** Un lieu où l'on joue (ou a joué). */
export interface Foyer {
  lat: number;
  lng: number;
  genre: GenreFoyer;
  nom: string;
  commune?: string;
  /** Depuis quand on y joue (ms) ; absent : depuis toujours (la ligue). */
  depuis?: number;
  /** Qui l'a ouvert, pour le récit (« ouverte par Sami »). */
  par?: string;
}

/** Une ville de joueurs (map/joueurs.ts, VillePlan réduite). */
export interface VilleZone {
  ville: string;
  lat: number;
  lng: number;
  n: number;
}

export interface Zone {
  id: string;
  /** 1, 2, 3… dans l'ordre où elles se sont ouvertes ; 0 pour une zone en attente. */
  numero: number;
  nom: string;
  ouverte: boolean;
  /** Nouvelle : ouverte depuis moins de NOUVELLE_JOURS. */
  nouvelle: boolean;
  centre: { lat: number; lng: number };
  /** Le contour, fermé, en [lng, lat]. */
  contour: [number, number][];
  foyers: Foyer[];
  villes: VilleZone[];
  joueurs: number;
  depuis?: number;
  par?: string;
  /** Les points qui la tiennent (lieux et villes) : son fondu en part. */
  appuis: { lat: number; lng: number }[];
  /** La zone où vit le joueur qui regarde (la page le dit) : « Ta zone ». */
  aMoi?: boolean;
  /** Ce que dit son étiquette sous le nom (la page l'écrit : « 62 joueurs · 4 dimanches »). */
  sous?: string;
}

export const LIEN_KM = 20;
export const VILLES_KM = 15;
export const MARGE_KM = 5;
const NOUVELLE_JOURS = 3;
/** Une zone en attente demande au moins ce nombre de joueurs. */
const ATTENTE_MIN = 2;

/** Les grands ensembles qui ont un nom à eux (le reste prend celui de sa ville). */
const METROPOLES: { nom: string; lat: number; lng: number; r: number }[] = [
  { nom: "Métropole lilloise", lat: 50.66, lng: 3.1, r: 16 },
  { nom: "Paris", lat: 48.8566, lng: 2.3522, r: 22 },
  { nom: "Lyon", lat: 45.764, lng: 4.8357, r: 15 },
  { nom: "Marseille", lat: 43.2965, lng: 5.3698, r: 15 },
  { nom: "Bruxelles", lat: 50.8503, lng: 4.3517, r: 12 },
  { nom: "Lens · Liévin", lat: 50.43, lng: 2.8, r: 10 },
  { nom: "Valenciennes", lat: 50.357, lng: 3.523, r: 10 },
];

const R = Math.PI / 180;

export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const d = Math.sin(((b.lat - a.lat) * R) / 2) ** 2 + Math.cos(a.lat * R) * Math.cos(b.lat * R) * Math.sin(((b.lng - a.lng) * R) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(d));
}

/** Les groupes de points reliés de proche en proche (à moins de `lien` km). */
function grouper<T extends { lat: number; lng: number }>(points: T[], lien: number): T[][] {
  const groupes: T[][] = [];
  const vu = new Set<number>();
  for (let i = 0; i < points.length; i++) {
    if (vu.has(i)) continue;
    vu.add(i);
    const g = [points[i]];
    for (let k = 0; k < g.length; k++) {
      for (let j = 0; j < points.length; j++) {
        if (vu.has(j) || km(g[k], points[j]) > lien) continue;
        vu.add(j);
        g.push(points[j]);
      }
    }
    groupes.push(g);
  }
  return groupes;
}

/** L'enveloppe convexe (chaîne monotone), en [x, y]. */
function enveloppe(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const croix = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const bas: [number, number][] = [];
  for (const x of p) {
    while (bas.length >= 2 && croix(bas[bas.length - 2], bas[bas.length - 1], x) <= 0) bas.pop();
    bas.push(x);
  }
  const haut: [number, number][] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    while (haut.length >= 2 && croix(haut[haut.length - 2], haut[haut.length - 1], p[i]) <= 0) haut.pop();
    haut.push(p[i]);
  }
  return [...bas.slice(0, -1), ...haut.slice(0, -1)];
}

/** Le contour d'un ensemble de points, chacun pris dans un cercle de `marge` km. */
export function contourDe(points: { lat: number; lng: number }[], marge = MARGE_KM): [number, number][] {
  if (!points.length) return [];
  const lat0 = points.reduce((s, x) => s + x.lat, 0) / points.length;
  const kx = 111.32 * Math.cos(lat0 * R);
  const ky = 110.57;
  const cercle: [number, number][] = [];
  const PAS = 36;
  for (const p of points) {
    for (let i = 0; i < PAS; i++) {
      const a = (i / PAS) * Math.PI * 2;
      cercle.push([p.lng * kx + Math.cos(a) * marge, p.lat * ky + Math.sin(a) * marge]);
    }
  }
  const env = enveloppe(cercle).map(([x, y]) => [x / kx, y / ky] as [number, number]);
  return [...env, env[0]];
}

/** Dedans, au sens du contour (le rayon qui traverse ses bords). */
export function dansContour(contour: [number, number][], lat: number, lng: number): boolean {
  let dedans = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const [xi, yi] = contour[i];
    const [xj, yj] = contour[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
}

function centreDe(points: { lat: number; lng: number }[]) {
  return { lat: points.reduce((s, x) => s + x.lat, 0) / points.length, lng: points.reduce((s, x) => s + x.lng, 0) / points.length };
}

function nomDe(centre: { lat: number; lng: number }, villes: VilleZone[], foyers: Foyer[]): string {
  const m = METROPOLES.find((x) => km(x, centre) < x.r);
  if (m) return m.nom;
  const v = [...villes].sort((a, b) => b.n - a.n)[0];
  return v?.ville ?? foyers[0]?.commune ?? foyers[0]?.nom ?? "Zone";
}

/**
 * Les zones : ouvertes (numérotées dans l'ordre de leur ouverture, la ligue
 * d'abord), puis en attente (les plus peuplées d'abord).
 */
export function calculerZones(foyers: Foyer[], villes: VilleZone[], maintenant: number): Zone[] {
  const groupes = grouper(foyers, LIEN_KM);
  // Chaque ville va à la zone dont un lieu est le plus proche, s'il est assez près.
  const villesDe = groupes.map(() => [] as VilleZone[]);
  const seules: VilleZone[] = [];
  for (const v of villes) {
    let mieux = -1;
    let d = VILLES_KM;
    groupes.forEach((g, i) =>
      g.forEach((f) => {
        const e = km(f, v);
        if (e <= d) [d, mieux] = [e, i];
      })
    );
    if (mieux >= 0) villesDe[mieux].push(v);
    else seules.push(v);
  }
  const ouvertes = groupes
    .map((g, i): Omit<Zone, "numero" | "id"> => {
      const premier = [...g].sort((a, b) => (a.depuis ?? 0) - (b.depuis ?? 0))[0];
      const vs = villesDe[i];
      const centre = centreDe(g);
      return {
        nom: nomDe(centre, vs, g),
        ouverte: true,
        nouvelle: premier.depuis != null && maintenant - premier.depuis < NOUVELLE_JOURS * 86_400_000,
        centre,
        contour: contourDe([...g, ...vs]),
        appuis: [...g, ...vs],
        foyers: g,
        villes: vs,
        joueurs: vs.reduce((s, v) => s + v.n, 0),
        depuis: premier.depuis,
        par: premier.par,
      };
    })
    .sort((a, b) => (a.depuis ?? 0) - (b.depuis ?? 0))
    .map((z, i) => ({ ...z, numero: i + 1, id: `z${i + 1}` }));
  const attente = grouper(seules, LIEN_KM)
    .map((vs): Zone => {
      const centre = centreDe(vs);
      const joueurs = vs.reduce((s, v) => s + v.n, 0);
      return { id: "", numero: 0, nom: nomDe(centre, vs, []), ouverte: false, nouvelle: false, centre, contour: contourDe(vs, 4), appuis: vs, foyers: [], villes: vs, joueurs };
    })
    .filter((z) => z.joueurs >= ATTENTE_MIN)
    .sort((a, b) => b.joueurs - a.joueurs)
    .map((z, i) => ({ ...z, id: `a${i + 1}` }));
  return [...ouvertes, ...attente];
}

/** L'aire signée d'un anneau (positive : sens trigonométrique). */
function aire(anneau: [number, number][]): number {
  let s = 0;
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) s += (anneau[j][0] - anneau[i][0]) * (anneau[j][1] + anneau[i][1]);
  return s / 2;
}

const dansLeSens = (anneau: [number, number][], trigo: boolean) => ((aire(anneau) > 0) === trigo ? anneau : [...anneau].reverse());

/** Le voile : le monde entier, troué par chaque zone ouverte. */
export function voileHorsZones(zones: Zone[]): GeoJSON.Feature<GeoJSON.Polygon> {
  const monde: [number, number][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Polygon",
      coordinates: [dansLeSens(monde, true), ...zones.filter((z) => z.ouverte && z.contour.length > 3).map((z) => dansLeSens(z.contour, false))],
    },
  };
}

/**
 * Le fondu (Sabri, 30/10 : « pas une fracture […] il faudrait que ça se
 * fonde ») : des voiles de plus en plus larges autour des zones ouvertes,
 * chacun presque transparent ; empilés, ils grisent le plan de plus en plus
 * à mesure qu'on s'éloigne, sans bord visible. Les marges croissent en
 * progression géométrique, de MARGE_KM (5 km) à 16 km des lieux et des villes : la
 * métropole lilloise reste claire jusqu'à Armentières et Mouscron, puis le gris
 * monte (Sabri, 30/10 : « ça commence à se terminer » vers là).
 */
export const FONDU_PAS = 10;
export function voilesEnFondu(zones: Zone[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const ouvertes = zones.filter((z) => z.ouverte && z.appuis.length);
  const monde: [number, number][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ];
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (let k = 0; k < FONDU_PAS; k++) {
    const marge = MARGE_KM * 1.14 ** k;
    features.push({
      type: "Feature",
      properties: { k },
      geometry: { type: "Polygon", coordinates: [dansLeSens(monde, true), ...ouvertes.map((z) => dansLeSens(contourDe(z.appuis, marge), false))] },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Les contours, pour leurs traits (ouverte ou en attente). */
export function contoursDesZones(zones: Zone[]): GeoJSON.FeatureCollection<GeoJSON.LineString, { id: string; ouverte: boolean; nouvelle: boolean }> {
  return {
    type: "FeatureCollection",
    features: zones
      .filter((z) => z.contour.length > 3)
      .map((z) => ({ type: "Feature", properties: { id: z.id, ouverte: z.ouverte, nouvelle: z.nouvelle }, geometry: { type: "LineString", coordinates: z.contour } })),
  };
}

/** La chaleur : les lieux où l'on joue pèsent lourd, les villes selon leurs joueurs. */
export function chaleur(zones: Zone[]): GeoJSON.FeatureCollection<GeoJSON.Point, { poids: number }> {
  const features: GeoJSON.Feature<GeoJSON.Point, { poids: number }>[] = [];
  for (const z of zones) {
    for (const f of z.foyers) features.push({ type: "Feature", properties: { poids: 1 }, geometry: { type: "Point", coordinates: [f.lng, f.lat] } });
    for (const v of z.villes) features.push({ type: "Feature", properties: { poids: Math.min(1, 0.25 + v.n / 20) }, geometry: { type: "Point", coordinates: [v.lng, v.lat] } });
  }
  return { type: "FeatureCollection", features };
}

/** « 01 » */
export const numeroZone = (n: number) => String(n).padStart(2, "0");

/** Un match qui a ouvert une zone : à qui en revient le mérite (l'XP, lib/sfl/missions.ts). */
export interface OuvertureDeZone {
  partieId: number;
  organisateurId: string;
  organisateur: string;
  /** ISO, « 2026-11-07 ». */
  jour: string;
  lieu: string;
}

/**
 * Les ouvertures de zones (Sabri, 30/10 : « donner un mérite à ceux qui
 * ouvrent des matchs dans une région ou dans une zone différente, leur
 * donner de l'XP ») : dans l'ordre des jours, un match ouvert JOUÉ (sa
 * feuille saisie) à plus de LIEN_KM de tout terrain de la ligue et de tout
 * match joué avant lui ouvre une zone ; le mérite revient à son
 * organisateur. Un match pas encore joué n'ouvre rien (ni ne compte pour
 * les suivants) : on ne gagne pas d'XP en annonçant un match qu'on annule.
 * Ne dépend que des matchs et des terrains, pas de ce que la Map montre :
 * le même calcul sur chaque téléphone.
 */
export function ouverturesDeZones(
  ligue: { lat: number; lng: number }[],
  parties: { id: number; organisateurId: string; organisateur: string; jour: string; lieu: string; lat: number | null; lng: number | null; saisiLe: string | null }[]
): OuvertureDeZone[] {
  const connus = [...ligue];
  const ouvertures: OuvertureDeZone[] = [];
  const jouees = parties
    .filter((p) => p.saisiLe && p.lat != null && p.lng != null)
    .sort((a, b) => a.jour.localeCompare(b.jour) || (a.saisiLe ?? "").localeCompare(b.saisiLe ?? "") || a.id - b.id);
  for (const p of jouees) {
    const ici = { lat: p.lat!, lng: p.lng! };
    if (connus.every((c) => km(c, ici) > LIEN_KM)) {
      ouvertures.push({ partieId: p.id, organisateurId: p.organisateurId, organisateur: p.organisateur, jour: p.jour, lieu: p.lieu });
    }
    connus.push(ici);
  }
  return ouvertures;
}
