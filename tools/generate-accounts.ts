// Génère la table des comptes de la ligue à partir du roster de la saison.
//
//   npx tsx tools/generate-accounts.ts
//
// Produit src/lib/sfl/auth/accounts.ts : l'identifiant de connexion et le nom
// de saison de chaque joueur, rien d'autre. AUCUN mot de passe, ni en clair
// ni en empreinte : le serveur (Supabase) est le seul à les connaître.
//
// Jusqu'au 22/10/2026, ce générateur écrivait aussi les mots de passe
// d'origine (docs/COMPTES.md, une graine serveur) et leurs empreintes dans
// l'app. Le dépôt étant public, tous ont dû être remplacés : chaque compte
// créé par l'admin choisit désormais le sien à sa première connexion, et un
// compte neuf reçoit un mot de passe provisoire tiré au hasard
// (/api/comptes/creer).

import { writeFileSync } from "node:fs";
import { SEED_ROSTER } from "../src/lib/sfl/saisie/seed";
import { username } from "../src/lib/sfl/usernames";
import { ADMIN_PLAYERS } from "../src/lib/sfl/admin";

function main() {
  const seen = new Set<string>();
  const rows = SEED_ROSTER.map((r) => {
    // L'identifiant reprend le pseudo affiché sur la carte, sans l'arobase.
    let user = username(r.name).slice(1);
    // Garde-fou : deux joueurs ne peuvent pas partager un identifiant.
    let n = 2;
    while (seen.has(user)) user = `${username(r.name).slice(1)}${n++}`;
    seen.add(user);
    return {
      user,
      name: r.name,
      admin: (ADMIN_PLAYERS as readonly string[]).includes(r.name),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const ts = [
    "// Comptes de la ligue — TABLE GÉNÉRÉE, ne pas modifier à la main.",
    "//",
    "// Produite par `npx tsx tools/generate-accounts.ts` depuis le roster de la",
    "// saison. L'identifiant de connexion et le nom de saison de chaque joueur,",
    "// sans aucun mot de passe : c'est le serveur (Supabase) qui les vérifie.",
    "",
    "export interface Account {",
    "  /** Identifiant de connexion, en minuscules. */",
    "  user: string;",
    "  /** Nom du joueur dans la saison — c'est la clé de tout le reste de l'app. */",
    "  name: string;",
    "  admin?: boolean;",
    "}",
    "",
    "export const ACCOUNTS: Account[] = [",
    ...rows.map(
      (r) =>
        `  { user: ${JSON.stringify(r.user)}, name: ${JSON.stringify(r.name)}${r.admin ? ", admin: true" : ""} },`
    ),
    "];",
    "",
    "export function findAccount(user: string): Account | undefined {",
    '  const needle = user.trim().replace(/^@+/, "").toLowerCase();',
    "  return ACCOUNTS.find((a) => a.user === needle);",
    "}",
    "",
  ].join("\n");
  writeFileSync("src/lib/sfl/auth/accounts.ts", ts);

  console.log(`${rows.length} comptes générés (sans mot de passe).`);
}

main();
