// Le pays de la connexion, pour proposer la langue (lib/i18n/langues.ts).
//
// Vercel pose le pays de l'adresse IP sur chaque requête (x-vercel-ip-country).
// Rien n'est gardé : la route renvoie le code du pays (« FR », « DZ »…), ou
// null hors de Vercel. L'adresse IP n'est ni lue ni renvoyée.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const brut = req.headers.get("x-vercel-ip-country");
  const pays = brut && /^[A-Z]{2}$/i.test(brut) ? brut.toUpperCase() : null;
  return NextResponse.json({ pays }, { headers: { "Cache-Control": "no-store" } });
}
