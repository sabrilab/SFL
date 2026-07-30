// Instantané de référence de la saison dérivée.
//
// Pourquoi : tout dans l'app (classements, journées, cartes) est DÉRIVÉ des
// données brutes par `deriveSeason()`. Une erreur dans cette fonction réécrit
// silencieusement l'historique de la ligue — rien à l'écran ne l'annonce, et
// `tsc` / `eslint` / `next build` ne peuvent pas la voir.
//
// Ce script fige la sortie actuelle dans un fichier de référence, puis sait la
// comparer. Il ne remplace pas la recette manuelle sur Vercel : il couvre la
// seule chose qu'un œil humain ne peut pas vérifier, à savoir que les 59
// joueurs et leurs dizaines de cartes n'ont pas bougé d'un point.
//
//   npm run saison:check    compare à la référence (échoue si écart)
//   npm run saison:bless    régénère la référence (changement intentionnel)
//
// Il est NORMAL que ce script échoue quand on change volontairement une règle
// de calcul : l'écart affiché est alors la liste exacte de ce que la nouvelle
// règle modifie. On relit, puis on régénère la référence.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { deriveSeason } from "../src/lib/sfl/saisie/engine";
import { seedSaison } from "../src/lib/sfl/saisie/store";

const REFERENCE = join(import.meta.dirname, "saison-reference.json");

/** Sortie réduite aux valeurs qui comptent, triée pour être comparable. */
function snapshot() {
  const d = deriveSeason(seedSaison());
  return {
    joueurs: d.players
      .map((p) => ({
        nom: p.name,
        poste: p.poste,
        pp: p.pp,
        matchs: p.matchs,
        buts: p.buts,
        passes: p.passes,
        mvp: p.mvp,
        impact: p.impact,
        def: p.def,
        stats: p.stats,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom)),
    cartesBoost: d.boostCards
      .map((c) => ({
        joueur: c.player,
        type: c.type,
        date: c.date,
        ovr: c.ovr,
        stats: c.stats,
      }))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.joueur.localeCompare(b.joueur) ||
          a.type.localeCompare(b.type)
      ),
    journees: d.journees.map((j) => ({ numero: j.j, date: j.date })),
  };
}

const actuel = snapshot();
const bless = process.argv.includes("--bless");

if (bless || !existsSync(REFERENCE)) {
  writeFileSync(REFERENCE, JSON.stringify(actuel, null, 2) + "\n");
  console.log(
    `Référence écrite : ${actuel.joueurs.length} joueurs, ` +
      `${actuel.cartesBoost.length} cartes boost, ${actuel.journees.length} journées.`
  );
  process.exit(0);
}

const attendu = JSON.parse(readFileSync(REFERENCE, "utf8")) as ReturnType<typeof snapshot>;
const ecarts: string[] = [];

// Joueurs : on compare champ par champ pour pointer la valeur fautive plutôt
// que d'afficher deux gros objets JSON à comparer à l'œil.
const parNom = new Map(attendu.joueurs.map((p) => [p.nom, p]));
for (const p of actuel.joueurs) {
  const ref = parNom.get(p.nom);
  if (!ref) {
    ecarts.push(`joueur ajouté : ${p.nom}`);
    continue;
  }
  parNom.delete(p.nom);
  for (const [cle, valeur] of Object.entries(p)) {
    const refVal = ref[cle as keyof typeof ref];
    const a = JSON.stringify(valeur);
    const b = JSON.stringify(refVal);
    if (a !== b) ecarts.push(`${p.nom} · ${cle} : ${b} -> ${a}`);
  }
}
for (const nom of parNom.keys()) ecarts.push(`joueur disparu : ${nom}`);

// Cartes boost : identifiées par (joueur, type, date).
const cle = (c: (typeof actuel.cartesBoost)[number]) => `${c.date} · ${c.joueur} · ${c.type}`;
const cartesRef = new Map(attendu.cartesBoost.map((c) => [cle(c), c]));
for (const c of actuel.cartesBoost) {
  const ref = cartesRef.get(cle(c));
  if (!ref) {
    ecarts.push(`carte ajoutée : ${cle(c)} (OVR ${c.ovr})`);
    continue;
  }
  cartesRef.delete(cle(c));
  if (ref.ovr !== c.ovr) ecarts.push(`${cle(c)} · OVR : ${ref.ovr} -> ${c.ovr}`);
  else if (JSON.stringify(ref.stats) !== JSON.stringify(c.stats))
    ecarts.push(`${cle(c)} · stats modifiées à OVR constant`);
}
for (const k of cartesRef.keys()) ecarts.push(`carte disparue : ${k}`);

if (ecarts.length === 0) {
  console.log(
    `Conforme : ${actuel.joueurs.length} joueurs, ` +
      `${actuel.cartesBoost.length} cartes boost, ${actuel.journees.length} journées.`
  );
  process.exit(0);
}

console.error(`${ecarts.length} écart(s) avec la référence :\n`);
for (const e of ecarts.slice(0, 60)) console.error("  " + e);
if (ecarts.length > 60) console.error(`  … et ${ecarts.length - 60} autres.`);
console.error(
  "\nSi ces écarts sont voulus (changement de règle), régénère la référence :" +
    "\n  npm run saison:bless"
);
process.exit(1);
