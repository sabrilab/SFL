// « S'abonner » à Bola Plus : la page de paiement Stripe (Checkout), pour le
// compte qui appelle (lib/server/stripe.server.ts). Tant que Bola Plus n'est
// pas ouvert à tous (voitBolaPlus), seuls les admins y arrivent ; sans les
// variables Stripe, la route répond 503 et l'app garde « Je suis intéressé ».

import { NextRequest, NextResponse } from "next/server";
import { appelant, estAdmin, serveur } from "@/lib/sfl/serveur-ligue.server";
import { sessionPaiement, stripeBranche } from "@/lib/server/stripe.server";
import { FORMULES, type Formule } from "@/lib/sfl/bola-plus";

export async function POST(req: NextRequest) {
  if (!stripeBranche()) return NextResponse.json({ error: "Le paiement n'est pas encore ouvert." }, { status: 503 });
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  // Pour l'instant, Bola Plus n'est visible que des admins (voitBolaPlus) : la route suit.
  if (!(await estAdmin(sb, moi.id))) return NextResponse.json({ error: "Pas encore ouvert." }, { status: 403 });
  const corps = (await req.json().catch(() => null)) as { formule?: string } | null;
  const formule = FORMULES.find((f) => f === corps?.formule) as Formule | undefined;
  if (!formule) return NextResponse.json({ error: "Formule inconnue." }, { status: 400 });
  const { data: profil } = await sb.from("profiles").select("name").eq("id", moi.id).maybeSingle();
  try {
    const url = await sessionPaiement({
      formule,
      joueur: moi.id,
      email: moi.email ?? null,
      nom: (profil as { name?: string } | null)?.name ?? "",
      origine: req.nextUrl.origin,
    });
    return NextResponse.json({ url });
  } catch (e) {
    console.error("[stripe] paiement", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Le paiement n'a pas pu s'ouvrir." }, { status: 502 });
  }
}
