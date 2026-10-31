// Le trajet jusqu'au match (31/10, le tableau de bord : « ton trajet qui
// brille »). Le chemin par les rues vient du calcul d'itinéraire ouvert de
// FOSSGIS (routing.openstreetmap.de, OSRM sur les données d'OpenStreetMap,
// sans clé ni compte) : à pied jusqu'à 2,5 km, en voiture au-delà. Sans
// réponse, une ligne droite et un temps estimé, pour que rien ne manque.
// Un trajet demandé une fois est gardé le temps de la visite.

export interface Trajet {
  /** Les points du chemin, [lon, lat]. */
  coords: [number, number][];
  minutes: number;
  mode: "pied" | "voiture";
}

type Point = { lat: number; lng: number };

const memoire = new Map<string, Promise<Trajet>>();

function km(a: Point, b: Point): number {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.hypot(x, y) * 6371;
}

/** « 12 min », « 1 h 05 ». */
export function dureeLisible(minutes: number): string {
  const m = Math.max(1, Math.round(minutes));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

export function trajetVers(de: Point, a: Point): Promise<Trajet> {
  const cle = [de.lat, de.lng, a.lat, a.lng].map((n) => n.toFixed(4)).join(",");
  const deja = memoire.get(cle);
  if (deja) return deja;
  const distance = km(de, a);
  const mode: Trajet["mode"] = distance <= 2.5 ? "pied" : "voiture";
  const droit: Trajet = {
    coords: [
      [de.lng, de.lat],
      [a.lng, a.lat],
    ],
    minutes: (distance * 1.3) / (mode === "pied" ? 5 : 28) * 60,
    mode,
  };
  const url = `https://routing.openstreetmap.de/routed-${mode === "pied" ? "foot" : "car"}/route/v1/driving/${de.lng},${de.lat};${a.lng},${a.lat}?overview=full&geometries=geojson`;
  const p = fetch(url, { signal: AbortSignal.timeout(6000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { routes?: { duration: number; geometry: { coordinates: [number, number][] } }[] } | null) => {
      const route = j?.routes?.[0];
      return route && route.geometry.coordinates.length > 1 ? { coords: route.geometry.coordinates, minutes: route.duration / 60, mode } : droit;
    })
    .catch(() => droit);
  memoire.set(cle, p);
  return p;
}
