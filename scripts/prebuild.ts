// Prébuild — exécuté avant chaque `npm run build` (donc à chaque déploiement
// Vercel) :
//   1. régénère le module serveur qui embarque le SQL (pour /api/migrate,
//      réservée à l'admin) ;
//   2. applique le schéma à la base s'il a changé (migration automatique).
//
// Le schéma n'est plus copié dans public/ : il s'y lisait par tout le monde,
// règles de sécurité comprises. Le copier-coller de la page d'installation le
// demande à /api/migrate, avec la session de l'admin.
//
// L'étape 0, elle, ARRÊTE le build : un joueur présent dans l'effectif mais
// absent de la table des comptes ne peut pas se connecter du tout, et rien
// ne le signale à l'exécution — sa session est simplement refusée. Mieux
// vaut un déploiement bloqué avec la marche à suivre qu'une app livrée où
// quelqu'un reste dehors.
//
// La migration n'échoue JAMAIS le build : sans SUPABASE_DB_URL ou sans accès
// réseau, elle se contente de le dire et laisse le déploiement continuer —
// la page d'installation garde le copier-coller en repli.

import { readFileSync, writeFileSync } from "node:fs";
import { migrateSchema } from "../src/lib/server/migrate";
import { ACCOUNTS } from "../src/lib/sfl/auth/accounts";
import { SEED_ROSTER } from "../src/lib/sfl/saisie/seed";

// 0 · Personne ne reste à la porte.
{
  const comptes = new Set(ACCOUNTS.map((a) => a.name));
  const sansCompte = SEED_ROSTER.filter((r) => !comptes.has(r.name)).map((r) => r.name);

  if (sansCompte.length > 0) {
    console.error(`[comptes] Dans l'effectif mais sans compte : ${sansCompte.join(", ")}`);
    console.error("[comptes] Régénère la table : npx tsx tools/generate-accounts.ts");
    process.exit(1);
  }
  console.log(`[comptes] ${ACCOUNTS.length} comptes pour ${SEED_ROSTER.length} joueurs ✓`);
}

const sql = readFileSync("supabase/schema.sql", "utf8");

// 1 · Module serveur — le SQL embarqué pour la route /api/migrate.
writeFileSync(
  "src/lib/sfl/db/schema-sql.server.ts",
  [
    "// GÉNÉRÉ par scripts/prebuild.ts depuis supabase/schema.sql — ne pas modifier.",
    "// SERVEUR UNIQUEMENT : importé par app/api/migrate/route.ts (admin seul).",
    "",
    `export const SCHEMA_SQL = ${JSON.stringify(sql)};`,
    "",
  ].join("\n")
);

// 2 · Migration automatique.
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
