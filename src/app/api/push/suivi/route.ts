// Ce qu'une notification devient sur le téléphone — appelée par le service
// worker (public/sw.js) quand elle arrive (« recue ») et quand le joueur la
// touche (« ouverte »). La page Activité en tire, motif par motif, combien
// arrivent et combien sont ouvertes (push_envois, lib/server/push-envoi.ts).
//
// Sans session : le service worker n'en a pas. L'identifiant suffit, tiré au
// hasard à l'envoi et connu du seul téléphone qui a reçu la notification ;
// on ne peut que dater, une fois, la sienne. Jamais d'erreur renvoyée : le
// téléphone n'a rien à en faire.

import { NextRequest, NextResponse } from "next/server";
import { serveur } from "@/lib/sfl/serveur-ligue.server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const corps = (await req.json().catch(() => ({}))) as { id?: unknown; quoi?: unknown };
  const id = typeof corps.id === "string" && UUID.test(corps.id) ? corps.id : null;
  const quoi = corps.quoi === "recue" || corps.quoi === "ouverte" ? corps.quoi : null;
  const sb = serveur();
  if (!id || !quoi || !sb) return NextResponse.json({ ok: false });

  const maintenant = new Date().toISOString();
  // Touchée, elle est forcément arrivée, même si le téléphone n'a pas pu le
  // dire (hors ligne à l'arrivée).
  await sb.from("push_envois").update({ recue_le: maintenant }).eq("id", id).is("recue_le", null);
  if (quoi === "ouverte")
    await sb.from("push_envois").update({ ouverte_le: maintenant }).eq("id", id).is("ouverte_le", null);
  return NextResponse.json({ ok: true });
}
