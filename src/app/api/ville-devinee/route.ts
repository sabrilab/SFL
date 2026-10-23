// La ville que la connexion laisse deviner — pour PROPOSER sa ville au
// joueur qui n'en a pas encore donné (Sabri, 22/10 : « récupérer ces
// données automatiquement sur nos inscrits »).
//
// Vercel pose sur chaque requête la ville de l'adresse IP (en-tête
// x-vercel-ip-city) : juste en wifi, souvent fausse sur le réseau mobile
// (la sortie de l'opérateur). Rien n'est donc écrit ici : la route renvoie
// la commune, centrée par la Base Adresse Nationale. L'app la pose sur la
// Map en attendant (lib/sfl/villes, poserVilleDevinee), et l'ouverture la
// propose au joueur, qui la confirme d'un toucher ou en choisit une autre
// (invitation-ville.tsx). Hors de France, ou si la ville est inconnue :
// rien. L'adresse IP n'est ni gardée ni renvoyée.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface Ban {
  features?: { geometry: { coordinates: [number, number] }; properties: { city?: string; name?: string; label: string } }[];
}

export async function GET(req: NextRequest) {
  const brut = req.headers.get("x-vercel-ip-city");
  const pays = req.headers.get("x-vercel-ip-country");
  if (!brut || (pays && pays !== "FR")) return NextResponse.json({ ville: null });
  let nom: string;
  try {
    nom = decodeURIComponent(brut);
  } catch {
    nom = brut;
  }
  const lat = req.headers.get("x-vercel-ip-latitude");
  const lon = req.headers.get("x-vercel-ip-longitude");
  const pres = lat && lon ? `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}` : "";
  try {
    const res = await fetch(`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(nom)}&limit=1&type=municipality${pres}`, {
      headers: { "User-Agent": "Bola-SFL/1.0 (https://sfl-eight.vercel.app)", Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const d = res.ok ? ((await res.json()) as Ban) : null;
    const f = d?.features?.[0];
    if (!f) return NextResponse.json({ ville: null });
    return NextResponse.json({
      ville: { ville: f.properties.city ?? f.properties.name ?? f.properties.label, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
    });
  } catch {
    return NextResponse.json({ ville: null });
  }
}
