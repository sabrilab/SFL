// Régénère l'historique des mises en ligne (lib/sfl/mises-en-ligne.ts) depuis
// la branche de production : chaque commit qu'elle a reçu (--first-parent :
// une PR fusionnée, ou un envoi direct) et qui touche l'app elle-même.
//
//   npx tsx tools/mises-en-ligne.ts
//
// À relancer seulement si l'historique d'avant la table mises_en_ligne doit
// être refait : depuis le 24/10/2026, chaque build de production pose sa
// version dans la table (scripts/postbuild.ts), et Admin → Activité lit les
// deux. Le dépôt doit avoir tout son historique (git fetch --unshallow).

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { decouperCommit, TOUCHE_L_APP } from "../src/lib/sfl/mises-en-ligne";

const FICHIER = "src/lib/sfl/mises-en-ligne.ts";
const DEPUIS = "2026-08-01";

const brut = execFileSync(
  "git",
  ["log", "--first-parent", "-m", `--since=${DEPUIS}`, "--reverse", "--name-only", "--format=%x1e%h%x1f%cI%x1f%B%x1f"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
);

const lignes: string[] = [];
const vus = new Set<string>();
for (const bloc of brut.split("\x1e").slice(1)) {
  const [sha, le, message, fichiers = ""] = bloc.split("\x1f");
  if (vus.has(sha)) continue;
  vus.add(sha);
  const touche = fichiers
    .split("\n")
    .map((f) => f.trim())
    .filter(Boolean);
  if (!touche.some((f) => TOUCHE_L_APP.test(f))) continue;
  const { titre, pr } = decouperCommit(message);
  if (!titre) continue;
  lignes.push(`  [${JSON.stringify(new Date(le).toISOString())}, ${JSON.stringify(sha)}, ${pr ?? "null"}, ${JSON.stringify(titre)}],`);
}

const source = readFileSync(FICHIER, "utf8");
const debut = source.indexOf("// <historique>");
const fin = source.indexOf("// </historique>");
if (debut < 0 || fin < 0) throw new Error(`Marques // <historique> introuvables dans ${FICHIER}`);
writeFileSync(
  FICHIER,
  `${source.slice(0, debut)}// <historique>\n${lignes.join("\n")}\n  ${source.slice(fin)}`
);
console.log(`${lignes.length} mises en ligne depuis le ${DEPUIS} → ${FICHIER}`);
