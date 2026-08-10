// Migration automatique du schéma — SERVEUR UNIQUEMENT.
//
// Le schéma (supabase/schema.sql) est idempotent : on peut le rejouer sans
// danger. Ce module l'applique quand il a changé, et seulement dans ce cas :
// l'empreinte SHA-256 du script est mémorisée dans public.schema_migrations,
// si elle est déjà là on ne touche à rien.
//
// La connexion vient des variables d'environnement de Vercel — jamais du
// code, jamais du navigateur (pas de préfixe NEXT_PUBLIC). Deux sources :
//   · SUPABASE_DB_URL, posée à la main (chaîne « Transaction pooler ») ;
//   · les variables injectées par l'intégration Vercel × Supabase
//     (POSTGRES_URL et déclinaisons) — reconnues automatiquement.

import { createHash } from "node:crypto";
import { Client } from "pg";

export interface MigrateResult {
  status: "applied" | "up-to-date" | "not-configured" | "error";
  hash?: string;
  message?: string;
}

/** Première chaîne de connexion disponible, selon la façon dont elle a été posée. */
function resolveDbUrl(): string | undefined {
  return (
    process.env.SUPABASE_DB_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.POSTGRES_PRISMA_URL
  );
}

export async function migrateSchema(sql: string, dbUrl?: string): Promise<MigrateResult> {
  const url = dbUrl ?? resolveDbUrl();
  if (!url) return { status: "not-configured" };

  const hash = createHash("sha256").update(sql).digest("hex");
  const client = new Client({
    connectionString: url,
    // Le pooler Supabase chiffre toujours ; on ne vérifie pas la chaîne de CA
    // (absente des environnements serverless), l'authentification reste le
    // mot de passe de la base.
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  try {
    await client.connect();
    await client.query(
      `create table if not exists public.schema_migrations (
         hash text primary key,
         applied_at timestamptz not null default now()
       )`
    );
    const seen = await client.query("select 1 from public.schema_migrations where hash = $1", [
      hash,
    ]);
    if ((seen.rowCount ?? 0) > 0) return { status: "up-to-date", hash };

    // Sans paramètres, pg utilise le protocole « simple » : le script
    // multi-instructions (DO $$ compris) passe en un seul appel.
    await client.query(sql);
    await client.query(
      "insert into public.schema_migrations (hash) values ($1) on conflict do nothing",
      [hash]
    );
    return { status: "applied", hash };
  } catch (e) {
    return { status: "error", hash, message: e instanceof Error ? e.message : String(e) };
  } finally {
    await client.end().catch(() => {});
  }
}
