// La version de l'app que le serveur sert en ce moment.
//
// Chaque déploiement grave sa version dans le code (`NEXT_PUBLIC_BOLA_VERSION`,
// voir next.config.ts). Une app restée ouverte sur un téléphone compare la
// sienne à celle-ci : si elles diffèrent, un déploiement est passé depuis, et
// `MiseAJour` recharge l'app. Jamais en cache : ni Vercel, ni le navigateur,
// ni le service worker (qui ne touche pas à /api).

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: process.env.NEXT_PUBLIC_BOLA_VERSION ?? "" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
