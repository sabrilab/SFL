// Les noms des joueurs Bola — SERVEUR, ADMIN SEUL.
//
// L'espace admin ne crée pas un joueur de l'effectif sous le nom d'un joueur
// Bola (venu par un parrain, hors de l'effectif) : son compte se lie au nom,
// et le nouveau venu aurait pris le sien (28/10/2026). La fenêtre « Nouveau
// joueur » lit ici ces noms, en minuscules, comme les compare l'inscription
// (dejaPris, lib/sfl/serveur-ligue.server.ts). /api/comptes/creer refait le
// contrôle de son côté.

import { NextRequest, NextResponse } from "next/server";
import { appelant, estAdmin, nomsJoueursBola, serveur } from "@/lib/sfl/serveur-ligue.server";

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "Fermé sur cet environnement." }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session serveur requise." }, { status: 401 });
  if (!(await estAdmin(sb, moi.id))) return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });
  try {
    return NextResponse.json({ noms: [...(await nomsJoueursBola(sb)).keys()] });
  } catch {
    return NextResponse.json({ error: "Lecture impossible." }, { status: 500 });
  }
}
