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
// La migration (étape 2) dépend de l'environnement Vercel (VERCEL_ENV) :
//   · aperçu (preview, development) : la base n'est JAMAIS touchée, même si
//     une variable de connexion y était donnée un jour — un simple push sur
//     une branche ne doit pas mettre à jour la base de la ligue ;
//   · production : une migration qui échoue (ou une base introuvable) ARRÊTE
//     le build. Vercel garde alors la version en ligne, l'ancienne app sur
//     l'ancien schéma, au lieu de servir la nouvelle app sur un schéma qui
//     n'a pas suivi (fonctions, tables, politiques manquantes). Le schéma est
//     rejoué en une transaction : un échec (par exemple un interblocage sous
//     charge) n'applique rien, il suffit de relancer le déploiement ;
//   · hors Vercel (build local) : comme avant, la migration se contente de
//     dire ce qu'elle a fait et le build continue — la page d'installation
//     garde le copier-coller en repli.

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

// 2 · Migration automatique (voir l'en-tête : aperçu, production, hors Vercel).
const environnement = process.env.VERCEL_ENV;
const production = environnement === "production";

function arreterLeBuild(raison: string): never {
  console.error(`[migrate] PRODUCTION : ${raison}`);
  console.error(
    "[migrate] Build arrêté : la version en ligne reste en place, rien n'a été appliqué. Relancer le déploiement (ou coller supabase/schema.sql dans l'éditeur SQL), puis passer supabase/verifications/2026-11-mise-en-ligne.sql."
  );
  process.exit(1);
}

if (environnement && !production) {
  console.log(`[migrate] aperçu (${environnement}) : la base n'est jamais touchée — migration sautée`);
} else {
  migrateSchema(sql)
    .then((r) => {
      const label = {
        applied: "schéma appliqué ✓",
        "up-to-date": "schéma déjà à jour ✓",
        "not-configured": "SUPABASE_DB_URL absente — migration sautée (copier-coller en repli)",
        error: `migration impossible (${r.message})`,
      }[r.status];
      console.log(`[migrate] ${label}`);
      if (production && (r.status === "error" || r.status === "not-configured")) {
        arreterLeBuild(r.status === "error" ? "le schéma n'a pas pu être appliqué" : "aucune connexion à la base");
      }
    })
    .catch((e) => {
      console.log(`[migrate] imprévu (${e})`);
      if (production) arreterLeBuild("erreur imprévue pendant la migration");
    });
}
