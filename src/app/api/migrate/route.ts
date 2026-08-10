// Mise à jour de la base à la demande — appelée par la page d'installation.
//
// Applique le schéma embarqué au build (généré depuis supabase/schema.sql)
// si son empreinte a changé. Sans SUPABASE_DB_URL dans l'environnement,
// répond « not-configured » et la page montre le copier-coller en repli.
//
// Inoffensive par construction : elle ne peut exécuter QUE le schéma figé au
// build (idempotent), jamais du SQL fourni par l'appelant.

import { NextResponse } from "next/server";
import { migrateSchema } from "@/lib/server/migrate";
import { SCHEMA_SQL } from "@/lib/sfl/db/schema-sql.server";

export async function POST() {
  const result = await migrateSchema(SCHEMA_SQL);
  return NextResponse.json(result, { status: result.status === "error" ? 500 : 200 });
}
