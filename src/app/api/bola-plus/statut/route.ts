// Mon abonnement Bola Plus, lu chez Stripe (lib/server/stripe.server.ts) :
// { abonne, formule, fin }. Sans Stripe branché : { abonne: false }.

import { NextRequest, NextResponse } from "next/server";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { abonnementDe, stripeBranche } from "@/lib/server/stripe.server";

export async function GET(req: NextRequest) {
  if (!stripeBranche()) return NextResponse.json({ abonne: false, branche: false });
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  try {
    const a = await abonnementDe(moi.id);
    return NextResponse.json({ abonne: !!a, branche: true, formule: a?.formule ?? null, fin: a?.fin ?? null, statut: a?.statut ?? null });
  } catch (e) {
    console.error("[stripe] statut", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Stripe injoignable." }, { status: 502 });
  }
}
