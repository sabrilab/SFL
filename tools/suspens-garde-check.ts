// Les garde-fous de la journée en suspens (saisie/suspens.ts, 12/11/2026) :
// aucun chemin ne doit la compter en contournant la règle.
//   1 · tout fichier de src/ qui lit le brouillon (estBrouillon) lit aussi le
//       suspens, ou figure dans les exceptions, chacune avec sa raison : un
//       nouvel écran qui teste le brouillon sans penser au suspens échoue ici ;
//   2 · tout lecteur du direct (la liste de tools/lecteurs-check.ts, les seuls
//       qui contournent la vue figée) le lit aussi, ou dit pourquoi non ;
//   3 · dans journeeComptee, le suspens est testé AVANT le régime (sinon une
//       J4 ou avant, de l'ancien régime, compterait en suspens) ;
//   4 · dans supabase/schema.sql, chaque fonction qui appelle est_brouillon(,
//       sauf sans_brouillons (la lecture des joueurs, qui garde la journée),
//       appelle aussi est_en_suspens( ;
//   5 · le libellé « En suspens · à rattraper » n'est écrit qu'une fois
//       (suspens.ts) ;
//   6 · la preuve par mutation : les contrôles 3 et 4, joués sur une copie
//       dont on a retiré la ligne du suspens, échouent.
//   npx tsx tools/suspens-garde-check.ts
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
const sansImports = (t: string) => t.replace(/^import[\s\S]*?;$/gm, "");
const LIT_LE_SUSPENS = /\b(estEnSuspens|journeesEnSuspens|resteUneJourneeEnSuspens|libelleSuspens|premiereAVenir|prochaineAJouer|MarqueSuspens|CarteSuspens)\b/;
const fautes: string[] = [];

// 1 · Le brouillon lu sans le suspens.
const EXCEPTIONS_BROUILLON: Record<string, string> = {
  "lib/sfl/cartons.ts": "décision D3 : les cartons d'une journée en suspens restent (la discipline ne dépend pas du score)",
};
const lecteursBrouillon = tous.filter((f) => /\bestBrouillon\b/.test(sansImports(f.texte)));
assert.ok(lecteursBrouillon.length >= 10, "les lecteurs du brouillon sont trouvés");
for (const f of lecteursBrouillon) {
  if (EXCEPTIONS_BROUILLON[f.chemin]) continue;
  if (!LIT_LE_SUSPENS.test(sansImports(f.texte))) fautes.push(`${f.chemin} lit le brouillon sans le suspens (estEnSuspens)`);
}
for (const c of Object.keys(EXCEPTIONS_BROUILLON)) assert.ok(lecteursBrouillon.some((f) => f.chemin === c), `exception périmée : ${c}`);

// 2 · Les lecteurs du direct (tools/lecteurs-check.ts) : le suspens, ou la raison.
const lecteursCheck = readFileSync(join(__dirname, "lecteurs-check.ts"), "utf8");
const bloc = /const LECTEURS_DU_DIRECT = new Set\(\[([\s\S]*?)\]\);/.exec(lecteursCheck);
assert.ok(bloc, "la liste LECTEURS_DU_DIRECT est trouvée");
const LECTEURS_DU_DIRECT = [...bloc[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
assert.ok(LECTEURS_DU_DIRECT.length >= 15, "les lecteurs du direct sont lus");
const EXCEPTIONS_DIRECT: Record<string, string> = {
  "app/api/cartons/annoncer/route.ts": "D3 : un carton tiré d'une journée en suspens s'annonce",
  "components/sfl/cartons/mes-cartons.tsx": "D3 : les cartons restent",
  "components/sfl/invitation-carte.tsx": "D3 : les cartons restent",
  "app/api/ligue/annoncer/route.ts": "lit revelationAttendue, qui saute les journées en suspens",
  "components/sfl/actus/fil.tsx": "le vote du jour passe par voteOuvertA (fermé : finDuVote nul)",
  "components/sfl/vote-figures.tsx": "voteOuvertA (fermé : finDuVote nul)",
  "components/sfl/admin/resultats-votes.tsx": "lit etatRevelation, qui rend « a-rattraper »",
  "components/sfl/direct/direct-du-match.tsx": "lit droitDePrendre, qui rend « suspens »",
  "components/sfl/feed/arbitre-du-match.tsx": "la note de l'arbitre est refusée par la base (noter_arbitre)",
  "components/sfl/season-provider.tsx": "rend la vue figée (figer → journeeComptee)",
  "lib/sfl/saison-serveur.server.ts": "rend la vue figée (figer → journeeComptee)",
  "components/sfl/vitrine.tsx": "une variable à lui, pas le direct",
  "hooks/use-feuilles-direct.ts": "les feuilles : la base les gèle (feuille_hors_jeu)",
  "hooks/use-presence.ts": "la convocation, sans points",
};
for (const c of LECTEURS_DU_DIRECT) {
  const f = tous.find((x) => x.chemin === c);
  if (!f) continue;
  if (EXCEPTIONS_DIRECT[c]) continue;
  if (!LIT_LE_SUSPENS.test(sansImports(f.texte))) fautes.push(`${c} lit le direct sans le suspens (estEnSuspens ou libelleSuspens)`);
}
for (const c of Object.keys(EXCEPTIONS_DIRECT)) assert.ok(LECTEURS_DU_DIRECT.includes(c), `exception du direct périmée : ${c}`);

// 3 · Dans journeeComptee, le suspens avant le régime.
function suspensAvantRegime(texte: string): boolean {
  const m = /export function journeeComptee\([\s\S]*?\n\}/.exec(texte);
  if (!m) return false;
  const corps = m[0];
  const s = corps.search(/estEnSuspens\(meta\)\)\s*return false/);
  const r = corps.indexOf("nouveauRegime(");
  return s >= 0 && r >= 0 && s < r;
}
const revelation = tous.find((f) => f.chemin === "lib/sfl/revelation.ts")!.texte;
if (!suspensAvantRegime(revelation)) fautes.push("revelation.ts : journeeComptee doit refuser une journée en suspens avant le test du régime");

// 4 · Le SQL : est_brouillon( appelle aussi est_en_suspens(.
function fonctionsSql(texte: string): { nom: string; corps: string }[] {
  const out: { nom: string; corps: string }[] = [];
  const re = /create (?:or replace )?function public\.(\w+)\s*\(([\s\S]*?)\n\$\$;/gi;
  for (const m of texte.matchAll(re)) out.push({ nom: m[1], corps: m[0] });
  return out;
}
function sqlSansTrou(texte: string): string[] {
  const trous: string[] = [];
  for (const f of fonctionsSql(texte)) {
    if (f.nom === "est_brouillon" || f.nom === "sans_brouillons" || f.nom === "est_en_suspens") continue;
    if (/public\.est_brouillon\(/.test(f.corps) && !/public\.est_en_suspens\(/.test(f.corps)) trous.push(f.nom);
  }
  return trous;
}
const schema = readFileSync(join(__dirname, "..", "supabase", "schema.sql"), "utf8");
const avecBrouillon = fonctionsSql(schema).filter((f) => /public\.est_brouillon\(/.test(f.corps)).map((f) => f.nom);
assert.ok(avecBrouillon.length >= 6, `les fonctions qui lisent le brouillon sont trouvées (${avecBrouillon.join(", ")})`);
for (const nom of ["fin_du_vote_a", "saison_fin_des_matchs", "presences_reelles", "noter_arbitre", "feuille_hors_jeu"])
  assert.ok(avecBrouillon.includes(nom), `${nom} est vue par le contrôle`);
for (const nom of sqlSansTrou(schema)) fautes.push(`schema.sql : ${nom} lit le brouillon sans le suspens`);
assert.ok(fonctionsSql(schema).some((f) => f.nom === "saison_reprise"), "le déclencheur de la reprise existe");
assert.ok(/create trigger saison_reprise after update of data on public\.saison/.test(schema), "et il est posé");

// 5 · Un seul libellé.
for (const f of tous) if (f.chemin !== "lib/sfl/saisie/suspens.ts" && /En suspens · à rattraper/.test(f.texte)) fautes.push(`${f.chemin} écrit le libellé à la main : libelleSuspens`);

// 6 · La preuve par mutation : sans la ligne, les contrôles échouent.
const revelationMutee = revelation.replace(/\n\s*if \(meta && estEnSuspens\(meta\)\) return false;/, "");
assert.notEqual(revelationMutee, revelation, "la mutation de journeeComptee s'applique");
assert.equal(suspensAvantRegime(revelationMutee), false, "sans la ligne, le contrôle 3 échoue");
const deplacee = revelationMutee.replace("  if (!meta || !nouveauRegime(numero, j)) return true;", "  if (!meta || !nouveauRegime(numero, j)) return true;\n  if (meta && estEnSuspens(meta)) return false;");
assert.equal(suspensAvantRegime(deplacee), false, "la ligne après le régime : le contrôle 3 échoue");
const schemaMute = schema.replace("if public.est_en_suspens(meta) then\n    return 'suspens';\n  end if;", "");
assert.notEqual(schemaMute, schema, "la mutation de feuille_hors_jeu s'applique");
assert.deepEqual(sqlSansTrou(schemaMute), ["feuille_hors_jeu"], "sans la ligne, le contrôle 4 échoue");

assert.deepEqual(fautes, [], fautes.join("\n"));
console.log(
  `suspens-garde-check : ${lecteursBrouillon.length} lecteurs du brouillon, ${LECTEURS_DU_DIRECT.length} lecteurs du direct, journeeComptee, ${avecBrouillon.length} fonctions SQL, un seul libellé, mutations — ok`
);
