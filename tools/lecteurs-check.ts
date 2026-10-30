// Les garde-fous qui empêchent d'oublier un lecteur de la saison (30/10/2026) :
// une journée en brouillon ne doit sortir de l'admin par aucun chemin, et le
// compte d'un admin qui ne joue pas ne doit tomber dans aucun sélecteur.
//   npx tsx tools/lecteurs-check.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE = join(__dirname, "..", "src");
function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const tous = fichiers(RACINE).map((p) => ({ chemin: relative(RACINE, p).replace(/\\/g, "/"), texte: readFileSync(p, "utf8") }));
const fautes: string[] = [];

// 1 · Une seule lecture brute de la table saison côté app et côté serveur.
const LECTEURS_PERMIS = new Set(["lib/sfl/saisie/sync.ts", "lib/sfl/saison-serveur.server.ts", "lib/sfl/db/schema-sql.server.ts"]);
for (const f of tous) if (/from\(\s*["']saison["']\s*\)/.test(f.texte) && !LECTEURS_PERMIS.has(f.chemin)) fautes.push(`${f.chemin} lit la table saison sans passer par lireSaisonServeur / lireEffectifServeur`);

// 2 · Les sélecteurs de joueurs d'une journée passent par effectifJouable.
const SELECTEURS = tous.filter(
  (f) =>
    /^components\/sfl\/admin\/(grille|new-journee-sheet|changer-joueur-sheet|choisir-joueurs|feuille-directe)\.tsx$/.test(f.chemin) ||
    f.chemin.startsWith("components/sfl/admin/journee/")
);
assert.ok(SELECTEURS.length >= 5, "les sélecteurs sont trouvés");
for (const f of SELECTEURS) if (/\.roster\b/.test(f.texte)) fautes.push(`${f.chemin} lit l'effectif brut : passer par effectifJouable`);

// 3 · Aucune écriture depuis la saison lue (sans brouillons) : un fichier qui
// lit useSeason() et écrit la saison doit partir de saisieStore.load().
for (const f of tous) {
  if (!f.texte.includes("saisieStore.save(") || !f.texte.includes("useSeason(")) continue;
  if (!f.texte.includes("saisieStore.load()")) fautes.push(`${f.chemin} écrit la saison sans repartir de saisieStore.load()`);
}
// …et jamais la valeur `saisonLue` passée telle quelle à une écriture.
for (const f of tous) if (/saisieStore\.save\(\s*saisonLue/.test(f.texte)) fautes.push(`${f.chemin} écrit saisonLue`);

// 4 · Le SeasonProvider filtre les brouillons.
const provider = tous.find((f) => f.chemin === "components/sfl/season-provider.tsx")!;
assert.ok(/sansBrouillons\(/.test(provider.texte), "le SeasonProvider passe par sansBrouillons");
// 5 · Plus aucun « match de plus » ni duplication dans l'admin.
for (const f of tous) {
  if (/duplicateEntryAt|ajouterEquipe\(/.test(f.texte)) fautes.push(`${f.chemin} : Dupliquer / Ajouter une équipe sont retirés`);
}

assert.deepEqual(fautes, [], fautes.join("\n"));
console.log(`lecteurs-check : ${tous.length} fichiers, une seule lecture de la saison, sélecteurs par effectifJouable, aucune écriture depuis la saison lue — ok`);
