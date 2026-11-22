// Le vendredi 19 h (Sabri, 20/11/2026) : un brouillon de journée que l'admin
// n'a pas publié se met en ligne tout seul, à l'heure où les équipes se
// révèlent (saisie/brouillon.ts, brouillon.jusqua).
//
// Le cron Vercel appelle cette route le vendredi à 17 h et à 18 h UTC
// (vercel.json) : 19 h à Paris l'été, puis l'hiver. La base fait tout
// (public.publier_brouillons_echus) : elle ne publie qu'un brouillon dont
// l'heure est passée, à son horloge à elle, si bien qu'un appel en avance, en
// double ou d'un inconnu (sans CRON_SECRET posé dans Vercel) ne fait rien.
// C'est la seule écriture du document de la saison par le serveur, et elle ne
// touche qu'aux champs « brouillon » et « publiee » des journées échues.
// Personne n'est prévenu : « Publier pour tout le monde » reste le geste qui
// annonce (api/ligue/publication).

import { NextRequest, NextResponse } from "next/server";
import { serveur } from "@/lib/sfl/serveur-ligue.server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const sb = serveur();
  if (!sb) return NextResponse.json({ statut: "pas-branche" }, { status: 503 });
  const { data, error } = await sb.rpc("publier_brouillons_echus");
  if (error) return NextResponse.json({ statut: "erreur" }, { status: 500 });
  return NextResponse.json(data);
}
