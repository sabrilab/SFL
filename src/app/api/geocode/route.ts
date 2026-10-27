// Une saisie → des lieux possibles, pendant la frappe.
//
// Deux sources, sans clé, interrogées ensemble :
//   · la Base Adresse Nationale (Géoplateforme de l'IGN), faite pour
//     l'auto-complétion : « 12 rue des post » trouve déjà « 12 Rue des
//     Postes, Lille » ;
//   · Photon (OpenStreetMap), pour les lieux par leur nom : un five, un city
//     stade, un complexe (« urban soccer lille »).
// Les adresses d'abord, les lieux nommés ensuite, sans doublon. Côté serveur
// pour borner chaque source à quelques secondes et ne jamais exposer de
// détail au navigateur.
//
// `type=commune` (la ville d'un joueur, lib/sfl/villes) : les communes
// seules, leur centre et leur département, sans adresse ni lieu.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface LieuGeocode {
  lat: number;
  lng: number;
  /** Ce qu'on affiche et qu'on garde comme adresse. */
  libelle: string;
  commune?: string;
  /** Le nom du lieu quand c'en est un (« Urban Soccer ») : il propose le nom du terrain. */
  nom?: string;
  genre: "adresse" | "lieu";
}

interface Ban {
  features?: {
    geometry: { coordinates: [number, number] };
    properties: { label: string; city?: string; type?: string; name?: string; postcode?: string; context?: string };
  }[];
}

interface Photon {
  features?: {
    geometry: { coordinates: [number, number] };
    properties: {
      name?: string;
      street?: string;
      housenumber?: string;
      postcode?: string;
      city?: string;
      countrycode?: string;
      osm_value?: string;
    };
  }[];
}

async function lire<T>(url: string, ms = 4000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Bola-SFL/1.0 (https://getbola.app)", Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(ms),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ resultats: [] as LieuGeocode[] });
  const lat = req.nextUrl.searchParams.get("lat");
  const lon = req.nextUrl.searchParams.get("lon");
  const pres = lat && lon ? `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` : "";

  if (req.nextUrl.searchParams.get("type") === "commune") {
    const communes = await lire<Ban>(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(q)}&limit=6&autocomplete=1&type=municipality${pres}`);
    if (!communes) return NextResponse.json({ resultats: [] as LieuGeocode[], erreur: "Le service des communes ne répond pas. Réessaie dans un instant." }, { status: 502 });
    const resultats: LieuGeocode[] = (communes.features ?? [])
      .map((f) => ({
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        commune: f.properties.city ?? f.properties.name ?? f.properties.label,
        libelle: [f.properties.city ?? f.properties.label, f.properties.context?.split(",")[1]?.trim()].filter(Boolean).join(" · "),
        genre: "adresse" as const,
      }))
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
    return NextResponse.json({ resultats });
  }

  const [ban, photon] = await Promise.all([
    lire<Ban>(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(q)}&limit=5&autocomplete=1${pres}`),
    lire<Photon>(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=fr${pres}`),
  ]);

  const adresses: LieuGeocode[] = (ban?.features ?? []).map((f) => ({
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    libelle: f.properties.label,
    commune: f.properties.city,
    genre: "adresse",
  }));

  const lieux: LieuGeocode[] = (photon?.features ?? [])
    .filter((f) => f.properties.name && (f.properties.countrycode ?? "FR") === "FR")
    .map((f) => {
      const p = f.properties;
      const rue = [p.housenumber, p.street].filter(Boolean).join(" ");
      const ville = [p.postcode, p.city].filter(Boolean).join(" ");
      return {
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        libelle: [p.name, rue, ville].filter(Boolean).join(", "),
        commune: p.city,
        nom: p.name,
        genre: "lieu" as const,
      };
    });

  // Une saisie qui commence par un numéro est une adresse : les adresses
  // d'abord. Sinon on cherche un lieu (« hippodrome marcq ») : les lieux
  // nommés d'abord, puis les adresses.
  const parAdresse = /^\s*\d/.test(q);
  const ordre = parAdresse ? [...adresses, ...lieux] : [...lieux, ...adresses];

  // Sans doublon : deux résultats à moins de ~50 m et de même libellé n'en font qu'un.
  const vus = new Set<string>();
  const resultats = ordre
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .filter((r) => {
      const cle = `${r.libelle.toLowerCase()}|${r.lat.toFixed(3)}|${r.lng.toFixed(3)}`;
      if (vus.has(cle)) return false;
      vus.add(cle);
      return true;
    })
    .slice(0, 10);

  if (!ban && !photon) {
    return NextResponse.json(
      { resultats: [] as LieuGeocode[], erreur: "Les services d'adresses ne répondent pas. Réessaie dans un instant." },
      { status: 502 }
    );
  }
  return NextResponse.json({ resultats });
}
