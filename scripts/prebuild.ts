// Prébuild — exécuté avant chaque `npm run build` (donc à chaque déploiement
// Vercel) :
//   1. copie le schéma vers public/ (bouton « Copier le SQL » de la page
//      d'installation) ;
//   2. régénère le module serveur qui embarque le SQL (pour /api/migrate) ;
//   3. applique le schéma à la base s'il a changé (migration automatique).
//
// La migration n'échoue JAMAIS le build : sans SUPABASE_DB_URL ou sans accès
// réseau, elle se contente de le dire et laisse le déploiement continuer —
// la page d'installation garde le copier-coller en repli.

import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { migrateSchema } from "../src/lib/server/migrate";

const sql = readFileSync("supabase/schema.sql", "utf8");

// 1 · Copie publique (fallback copier-coller).
copyFileSync("supabase/schema.sql", "public/supabase-schema.sql");

// 2 · Module serveur — le SQL embarqué pour la route /api/migrate.
writeFileSync(
  "src/lib/sfl/db/schema-sql.server.ts",
  [
    "// GÉNÉRÉ par scripts/prebuild.ts depuis supabase/schema.sql — ne pas modifier.",
    "// SERVEUR UNIQUEMENT : importé par app/api/migrate/route.ts.",
    "",
    `export const SCHEMA_SQL = ${JSON.stringify(sql)};`,
    "",
  ].join("\n")
);

// 3 · Migration automatique.
migrateSchema(sql)
  .then((r) => {
    const label = {
      applied: "schéma appliqué ✓",
      "up-to-date": "schéma déjà à jour ✓",
      "not-configured": "SUPABASE_DB_URL absente — migration sautée (copier-coller en repli)",
      error: `migration impossible (${r.message}) — le build continue`,
    }[r.status];
    console.log(`[migrate] ${label}`);
  })
  .catch((e) => console.log(`[migrate] imprévu (${e}) — le build continue`));
