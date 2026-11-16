// Le webhook Stripe (à déclarer dans Stripe : https://getbola.app/api/stripe/webhook).
// Il vérifie la signature (STRIPE_WEBHOOK_SECRET) et note les événements
// d'abonnement dans les journaux Vercel. Il n'écrit rien en base : l'état d'un
// abonnement se lit chez Stripe (/api/bola-plus/statut). Le jour où l'app
// gardera les abonnés dans une table (avec le ok de Sabri), c'est ici qu'elle
// sera tenue à jour.

import { NextRequest, NextResponse } from "next/server";
import { signatureValide } from "@/lib/server/stripe.server";

const SUIVIS = new Set(["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"]);

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const corps = await req.text();
  if (!signatureValide(corps, req.headers.get("stripe-signature"), secret)) return NextResponse.json({ error: "signature" }, { status: 400 });
  const evenement = JSON.parse(corps) as { type: string; data?: { object?: { metadata?: Record<string, string>; status?: string } } };
  if (SUIVIS.has(evenement.type)) {
    const o = evenement.data?.object;
    console.log("[stripe]", evenement.type, o?.metadata?.nom ?? "?", o?.metadata?.formule ?? "", o?.status ?? "");
  }
  return NextResponse.json({ recu: true });
}
