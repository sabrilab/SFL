// Les noms des joueurs Bola — SERVEUR, ADMIN SEUL.
//
// L'espace admin ne crée pas un joueur de l'effectif sous le nom d'un joueur
// Bola (venu par un parrain, hors de l'effectif) sans le savoir : son compte
// se lie au nom, et le nouveau venu aurait pris le sien (28/10/2026). La
// fenêtre « Nouveau joueur » lit ici leurs noms exacts (ceux que compare
// /api/comptes/creer) et leurs pseudos : un nom pris demande confirmation,
// car c'est aussi ainsi qu'un joueur Bola passe dans la SFL, avec son compte
// (« lier », /api/comptes/creer).

import { NextRequest, NextResponse } from "next/server";
import { appelant, estAdmin, nomsJoueursBola, serveur } from "@/lib/sfl/serveur-ligue.server";

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "Fermé sur cet environnement." }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session serveur requise." }, { status: 401 });
  if (!(await estAdmin(sb, moi.id))) return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });
  try {
    const ids = [...new Set((await nomsJoueursBola(sb)).values())];
    if (ids.length === 0) return NextResponse.json({ joueurs: [] });
    const { data, error } = await sb.from("profiles").select("name, username").in("id", ids);
    if (error) throw error;
    return NextResponse.json({ joueurs: (data ?? []) as { name: string; username: string }[] });
  } catch {
    return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
