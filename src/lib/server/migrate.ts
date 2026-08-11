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

/**
 * Réécrit l'URL avec `sslmode=no-verify` : les URLs de l'intégration portent
 * `sslmode=require`, et avec le pilote pg ce paramètre PREND LE PAS sur
 * l'option `ssl` du code — or les fonctions serverless ne peuvent pas vérifier
 * la chaîne de certificats du pooler Supabase (auto-signée). `no-verify` garde
 * le chiffrement ; l'authentification reste le mot de passe.
 */
export function normalizeDbUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("sslmode", "no-verify");
    return u.toString();
  } catch {
    return url;
  }
}

export interface MigrateResult {
  status: "applied" | "up-to-date" | "not-configured" | "error";
  hash?: string;
  message?: string;
}

/**
 * Chaînes de connexion candidates, dans l'ordre de préférence. Toutes ne
 * passent pas depuis les fonctions Vercel (la connexion directe à la base est
 * IPv6 seulement, par exemple) : on les essaie l'une après l'autre.
 */
export function candidateUrls(): { name: string; url: string }[] {
  return [
    { name: "SUPABASE_DB_URL", url: process.env.SUPABASE_DB_URL },
    { name: "POSTGRES_URL", url: process.env.POSTGRES_URL },
    { name: "POSTGRES_URL_NON_POOLING", url: process.env.POSTGRES_URL_NON_POOLING },
    { name: "POSTGRES_PRISMA_URL", url: process.env.POSTGRES_PRISMA_URL },
  ].filter((c): c is { name: string; url: string } => !!c.url);
}

export async function migrateSchema(sql: string, dbUrl?: string): Promise<MigrateResult> {
  const candidates = dbUrl ? [{ name: "explicite", url: dbUrl }] : candidateUrls();
  if (candidates.length === 0) return { status: "not-configured" };

  const hash = createHash("sha256").update(sql).digest("hex");
  const connectErrors: string[] = [];

  // Les URLs de l'intégration portent `sslmode=require` : avec le pilote pg,
  // ce paramètre PREND LE PAS sur l'option `ssl` du code (bug connu) et
  // impose la vérification de la chaîne de certificats — que les fonctions
  // serverless ne peuvent pas faire (le pooler Supabase présente un
  // certificat auto-signé). `no-verify` garde le chiffrement, sans la
  // vérification de chaîne ; l'authentification reste le mot de passe.

  for (const c of candidates) {
    const client = new Client({
      connectionString: normalizeDbUrl(c.url),
      connectionTimeoutMillis: 8000,
    });

    // Échec de CONNEXION → on tente l'adresse suivante. Échec SQL → on
    // s'arrête et on remonte l'erreur : c'est le schéma qu'il faut corriger.
    try {
      await client.connect();
    } catch (e) {
      connectErrors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
      await client.end().catch(() => {});
      continue;
    }

    try {
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
      return {
        status: "error",
        hash,
        message: `${c.name} · ${e instanceof Error ? e.message : String(e)}`,
      };
    } finally {
      await client.end().catch(() => {});
    }
  }

  return {
    status: "error",
    hash,
    message: `connexion impossible — ${connectErrors.join(" | ")}`,
  };
}
