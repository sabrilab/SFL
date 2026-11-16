// Les ventes Bola Plus, pour l'admin seul (admin/activite/ventes-bola-plus.tsx) :
// les abonnements lus chez Stripe, avec le parcours avant l'achat (bp_*).
// Sans Stripe branché : { branche: false, ventes: [] }.

import { NextRequest, NextResponse } from "next/server";
import { appelant, estAdmin, serveur } from "@/lib/sfl/serveur-ligue.server";
import { stripeBranche, ventesBolaPlus } from "@/lib/server/stripe.server";

export async function GET(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  if (!(await estAdmin(sb, moi.id))) return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });
  if (!stripeBranche()) return NextResponse.json({ branche: false, ventes: [] });
  try {
    return NextResponse.json({ branche: true, ventes: await ventesBolaPlus() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[stripe] ventes", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Stripe injoignable." }, { status: 502 });
  }
}
