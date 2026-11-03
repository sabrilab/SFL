// La carte d'entraîneur de Bola Team, recalculée par le serveur (lot B1,
// 03/11/2026 ; lib/sfl/entraineur-serveur.server.ts) : une fois par jour, à
// partir des faits de la base, rien de ce qu'un téléphone calcule.
//
// Qui l'appelle :
//   · le cron Vercel, chaque nuit à 4 h 30 UTC (vercel.json) : une rencontre
//     se lit 24 h après la fermeture de sa feuille (4 jours après le coup
//     d'envoi), un passage par jour suffit. Il présente CRON_SECRET quand il
//     est posé dans Vercel ;
//   · l'admin de la ligue (sa session), pour relancer le calcul tout de suite.
// Sans CRON_SECRET posé, n'importe qui peut appeler le cron : le calcul est
// rejouable (le même deux fois donne la même carte, et rien ne descend),
// mais il lit toute la ligue ; un appel au plus toutes les dix minutes par
// instance, sauf l'admin.

import { NextRequest, NextResponse } from "next/server";
import { appelant, estAdmin, serveur } from "@/lib/sfl/serveur-ligue.server";
import { calculerCartesEntraineur } from "@/lib/sfl/entraineur-serveur.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIX_MINUTES = 10 * 60_000;
let dernierAppel = 0;

/** Le cron de la nuit. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const sb = serveur();
  if (!sb) return NextResponse.json({ statut: "pas-branche" }, { status: 503 });
  if (Date.now() - dernierAppel < DIX_MINUTES) return NextResponse.json({ statut: "a-jour" });
  dernierAppel = Date.now();
  const bilan = await calculerCartesEntraineur(sb);
  return NextResponse.json(bilan, { status: bilan.statut === "ok" ? 200 : 500 });
}

/** L'admin, tout de suite. */
export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (!(await estAdmin(sb, moi.id))) return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });
  dernierAppel = Date.now();
  const bilan = await calculerCartesEntraineur(sb);
  return NextResponse.json(bilan, { status: bilan.statut === "ok" ? 200 : 500 });
}
