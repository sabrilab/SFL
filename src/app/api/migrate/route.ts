// Mise à jour de la base à la demande — ADMIN SEUL, appelée par la page
// d'installation (Réglages → Installation Supabase).
//
// POST applique le schéma embarqué au build (généré depuis supabase/schema.sql)
// si son empreinte a changé. Sans SUPABASE_DB_URL dans l'environnement,
// répond « not-configured » et la page montre le copier-coller en repli.
// GET rend ce schéma, pour ce copier-coller.
//
// Elle ne peut exécuter QUE le schéma figé au build (idempotent), jamais du
// SQL fourni par l'appelant. Elle restait pourtant ouverte à tous jusqu'au
// 22/10/2026 : n'importe qui pouvait faire rejouer tout le schéma à la base,
// et lire ses messages d'erreur. Le jeton de session d'un admin est désormais
// exigé (« Authorization: Bearer … »), vérifié par Supabase.

import { NextRequest, NextResponse } from "next/server";
import { migrateSchema } from "@/lib/server/migrate";
import { SCHEMA_SQL } from "@/lib/sfl/db/schema-sql.server";
import { appelant, estAdmin, serveur } from "@/lib/sfl/serveur-ligue.server";

async function refus(req: NextRequest): Promise<NextResponse | null> {
  const sb = serveur();
  if (!sb) return NextResponse.json({ status: "not-configured" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session serveur requise." }, { status: 401 });
  if (!(await estAdmin(sb, moi.id))) return NextResponse.json({ error: "Réservé à l'admin." }, { status: 403 });
  return null;
}

export async function POST(req: NextRequest) {
  const non = await refus(req);
  if (non) return non;
  const { status, message } = await migrateSchema(SCHEMA_SQL);
  return NextResponse.json({ status, message }, { status: status === "error" ? 500 : 200 });
}

export async function GET(req: NextRequest) {
  const non = await refus(req);
  if (non) return non;
  return new NextResponse(SCHEMA_SQL, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
