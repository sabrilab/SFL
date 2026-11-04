// La carte d'entraîneur de Bola Team, recalculée par le serveur (lot B1,
// 03/11/2026 ; lib/sfl/entraineur-serveur.server.ts) : une fois par jour, à
// partir des faits de la base, rien de ce qu'un téléphone calcule.
//
// Qui l'appelle :
//   · le cron Vercel, chaque nuit à 4 h 30 UTC (vercel.json) : une rencontre
//     se lit 24 h après la fermeture de sa feuille (4 jours après le coup
//     d'envoi), un passage par jour suffit. Il présente CRON_SECRET ;
//   · l'admin de la ligue (sa session), pour relancer le calcul tout de suite.
//     Lui seul lit le bilan entier : le texte d'une erreur de la base, et les
//     paires à revoir (des victoires « contre bien plus fort » répétées contre
//     le même adversaire).
// En production, sans CRON_SECRET posé dans Vercel, le cron est refusé (503) :
// le calcul lit toute la ligue, il ne s'ouvre pas à n'importe qui (contrôle
// du 03/11/2026). L'admin, lui, peut toujours le lancer. Hors production (le
// serveur de développement), le cron passe sans secret, au plus une fois
// toutes les dix minutes par instance.
//
// Un admin qui doit encore changer son mot de passe (une ligne dans
// mot_de_passe_a_changer : d'origine, devenu public, ou provisoire) n'est
// pas admin ici, comme pour la base (is_league_admin, audit de sécurité du
// 03/11/2026) : une session ouverte avec ce mot de passe ne relance rien et
// ne lit pas le bilan.

import { NextRequest, NextResponse } from "next/server";
import { appelant, estAdmin, serveur } from "@/lib/sfl/serveur-ligue.server";
import { calculerCartesEntraineur } from "@/lib/sfl/entraineur-serveur.server";
import { motDePasseAChanger } from "@/lib/server/push-envoi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIX_MINUTES = 10 * 60_000;
let dernierAppel = 0;

/** Le cron de la nuit. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET manquant." }, { status: 503 });
  }
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const sb = serveur();
  if (!sb) return NextResponse.json({ statut: "pas-branche" }, { status: 503 });
  if (Date.now() - dernierAppel < DIX_MINUTES) return NextResponse.json({ statut: "a-jour" });
  dernierAppel = Date.now();
  const bilan = await calculerCartesEntraineur(sb);
  if (bilan.statut !== "ok") console.error(`[entraineurs] ${bilan.erreur ?? "erreur"}`);
  // Le cron n'a besoin que des comptes : ni le texte de la base, ni les paires à revoir.
  const { statut, entraineurs, ecrites, normes, ms } = bilan;
  return NextResponse.json({ statut, entraineurs, ecrites, normes, aRevoir: bilan.aRevoir.length, ms }, { status: statut === "ok" ? 200 : 500 });
}

/** L'admin, tout de suite. */
export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (!(await estAdmin(sb, moi.id))) return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });
  const aChanger = await motDePasseAChanger(sb, [moi.id]);
  if (!aChanger || aChanger.has(moi.id)) return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });
  dernierAppel = Date.now();
  const bilan = await calculerCartesEntraineur(sb);
  return NextResponse.json(bilan, { status: bilan.statut === "ok" ? 200 : 500 });
}
