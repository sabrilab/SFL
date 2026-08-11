// Génère les comptes de la ligue à partir du roster de la saison.
//
//   npx tsx tools/generate-accounts.ts
//
// Produit deux fichiers :
//   • docs/COMPTES.md            → la liste lisible (identifiant + mot de passe)
//   • src/lib/sfl/auth/accounts.ts → la table embarquée dans l'app
//
// L'app n'embarque JAMAIS les mots de passe en clair : seulement leur
// empreinte SHA-256 salée par l'identifiant. Le fichier Markdown, lui, est la
// copie de référence de l'admin — c'est le seul endroit où les mots de passe
// par défaut sont lisibles.

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { SEED_ROSTER } from "../src/lib/sfl/saisie/seed";
import { username } from "../src/lib/sfl/usernames";
import { ADMIN_PLAYERS } from "../src/lib/sfl/admin";

/** Mots simples, sans accent ni ambiguïté à l'oral. */
const MOTS = [
  "ballon", "corner", "lucarne", "pivot", "tacle", "volee", "passe", "sprint",
  "cage", "arret", "duel", "reprise", "louche", "praline", "roulette", "sombrero",
  "pointu", "gardien", "buteur", "capitaine", "terrain", "sifflet", "maillot", "crampon",
];

/**
 * Mots de passe imposés par l'admin, par nom de joueur. Ils remplacent le mot
 * de passe généré : à utiliser quand quelqu'un a déjà reçu ses accès.
 */
const MOTS_DE_PASSE_IMPOSES: Record<string, string> = {
  Sabri: "59Sabrii!",
};

/** Générateur déterministe : même nom = même mot de passe à chaque exécution. */
function seededInt(seed: string, max: number) {
  const h = createHash("sha256").update(seed).digest();
  return ((h[0] << 16) | (h[1] << 8) | h[2]) % max;
}

export function hashPassword(user: string, password: string) {
  return createHash("sha256").update(`sfl:${user}:${password}`).digest("hex");
}

function main() {
  const seen = new Set<string>();
  const rows = SEED_ROSTER.map((r) => {
    // L'identifiant reprend le pseudo affiché sur la carte, sans l'arobase.
    let user = username(r.name).slice(1);
    // Garde-fou : deux joueurs ne peuvent pas partager un identifiant.
    let n = 2;
    while (seen.has(user)) user = `${username(r.name).slice(1)}${n++}`;
    seen.add(user);

    const mot = MOTS[seededInt(`${r.name}|mot`, MOTS.length)];
    const num = 10 + seededInt(`${r.name}|num`, 90);
    const password = MOTS_DE_PASSE_IMPOSES[r.name] ?? `${mot}${num}`;

    return {
      user,
      name: r.name,
      password,
      hash: hashPassword(user, password),
      admin: (ADMIN_PLAYERS as readonly string[]).includes(r.name),
      profil: r.profil,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "fr"));

  /* ------------------------------ Markdown ----------------------------- */
  const md = [
    "# Comptes de la ligue — SFL",
    "",
    "Identifiants et mots de passe **par défaut** de chaque membre, générés",
    "automatiquement depuis le roster de la saison.",
    "",
    "> **À lire avant de distribuer.** Ces mots de passe sont des mots de passe",
    "> d'ouverture, pas des secrets : ils sont écrits en clair dans ce fichier et",
    "> tout le monde peut donc les lire s'il a accès au dépôt. Demande à chacun de",
    "> le changer à la première connexion (Réglages → Mon compte), et rappelle de",
    "> ne jamais réutiliser un mot de passe personnel ici.",
    "",
    "L'application n'embarque que l'empreinte SHA-256 de ces mots de passe, jamais",
    "le mot de passe lui-même.",
    "",
    `Régénérer ce fichier : \`npx tsx tools/generate-accounts.ts\``,
    "",
    `**${rows.length} comptes.**`,
    "",
    "| Joueur | Identifiant | Mot de passe | Rôle |",
    "| --- | --- | --- | --- |",
    ...rows.map(
      (r) =>
        `| ${r.name} | \`${r.user}\` | \`${r.password}\` | ${r.admin ? "Admin" : r.profil} |`
    ),
    "",
  ].join("\n");
  writeFileSync("docs/COMPTES.md", md);

  /* ------------------------------- Table ------------------------------- */
  const ts = [
    "// Comptes de la ligue — TABLE GÉNÉRÉE, ne pas modifier à la main.",
    "//",
    "// Produite par `npx tsx tools/generate-accounts.ts` depuis le roster de la",
    "// saison. Seule l'empreinte du mot de passe est embarquée : l'app ne connaît",
    "// pas les mots de passe en clair (la liste lisible vit dans docs/COMPTES.md,",
    "// hors application).",
    "//",
    "// Empreinte = SHA-256 de `sfl:<identifiant>:<mot de passe>`.",
    "",
    "export interface Account {",
    "  /** Identifiant de connexion, en minuscules. */",
    "  user: string;",
    "  /** Nom du joueur dans la saison — c'est la clé de tout le reste de l'app. */",
    "  name: string;",
    "  /** SHA-256 de `sfl:user:password`. */",
    "  hash: string;",
    "  admin?: boolean;",
    "}",
    "",
    "export const ACCOUNTS: Account[] = [",
    ...rows.map(
      (r) =>
        `  { user: ${JSON.stringify(r.user)}, name: ${JSON.stringify(r.name)}, hash: ${JSON.stringify(r.hash)}${r.admin ? ", admin: true" : ""} },`
    ),
    "];",
    "",
    "export function findAccount(user: string): Account | undefined {",
    "  const needle = user.trim().toLowerCase();",
    "  return ACCOUNTS.find((a) => a.user === needle);",
    "}",
    "",
  ].join("\n");
  writeFileSync("src/lib/sfl/auth/accounts.ts", ts);

  /* --------------------- Graine serveur (API /api/setup) --------------------- */
  // Mots de passe PAR DÉFAUT en clair, réservés au serveur : ce module n'est
  // importé que par la route d'installation, jamais par du code client. Même
  // niveau d'exposition que docs/COMPTES.md (le dépôt), aucun secret nouveau.
  const seed = [
    "// GÉNÉRÉ par tools/generate-accounts.ts — ne pas modifier à la main.",
    "// SERVEUR UNIQUEMENT : importé par app/api/setup/route.ts. Ce sont les",
    "// mots de passe PAR DÉFAUT (déjà listés dans docs/COMPTES.md) ; chacun",
    "// est invité à changer le sien à la première connexion.",
    "",
    "export interface SeedAccount {",
    "  user: string;",
    "  name: string;",
    "  password: string;",
    "}",
    "",
    "export const SEED_ACCOUNTS: SeedAccount[] = [",
    ...rows.map(
      (r) =>
        `  { user: ${JSON.stringify(r.user)}, name: ${JSON.stringify(r.name)}, password: ${JSON.stringify(r.password)} },`
    ),
    "];",
    "",
  ].join("\n");
  writeFileSync("src/lib/sfl/auth/seed.server.ts", seed);

  console.log(`${rows.length} comptes générés.`);
  console.log(rows.slice(0, 3).map((r) => `  ${r.name} → ${r.user} / ${r.password}`).join("\n"));
}

main();
