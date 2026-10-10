// Une adresse → un point sur la Map.
//
// L'admin tape l'adresse d'un terrain ; on la fait lire par Nominatim
// (OpenStreetMap) et on renvoie les quelques lieux possibles, à lui de
// choisir le bon. Côté serveur pour porter un User-Agent qui nous nomme,
// comme la politique d'usage de Nominatim le demande, et parce que ça
// n'arrive qu'à la création d'un terrain : quelques appels par saison.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface LieuNominatim {
  lat: string;
  lon: string;
  display_name: string;
  address?: { city?: string; town?: string; village?: string; municipality?: string; suburb?: string };
}

export interface LieuGeocode {
  lat: number;
  lng: number;
  libelle: string;
  commune?: string;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 3) return NextResponse.json({ resultats: [] as LieuGeocode[] });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "fr");

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Bola-SFL/1.0 (https://sfl-eight.vercel.app)",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { resultats: [] as LieuGeocode[], erreur: `Le service d'adresses répond ${res.status}. Réessaie dans un instant.` },
        { status: 502 }
      );
    }
    const data = (await res.json()) as LieuNominatim[];
    const resultats: LieuGeocode[] = data
      .map((d) => ({
        lat: Number(d.lat),
        lng: Number(d.lon),
        libelle: d.display_name,
        commune: d.address?.city ?? d.address?.town ?? d.address?.village ?? d.address?.municipality,
      }))
      .filter((d) => Number.isFinite(d.lat) && Number.isFinite(d.lng));
    return NextResponse.json({ resultats });
  } catch {
    return NextResponse.json(
      { resultats: [] as LieuGeocode[], erreur: "Le service d'adresses est injoignable." },
      { status: 502 }
    );
  }
}
