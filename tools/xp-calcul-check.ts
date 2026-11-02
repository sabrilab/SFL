// Une seule source pour l'XP (lib/sfl/xp-calcul.ts, 01/11/2026) : le
// téléphone et le serveur appellent journalComplet, qui doit rendre
// exactement le journal de l'ancien calcul du téléphone (le corps du useMemo
// de useXpLigueCalcule, recomposé ici), sur la saison de démo d'Ilyes et sur
// la saison de départ du dépôt.
//   npx tsx tools/xp-calcul-check.ts
import assert from "node:assert/strict";
import { bilanDe, journalXp, type Reponse } from "../src/lib/sfl/missions";
import { ajouterDefis } from "../src/lib/sfl/defis";
import { ajouterPronos, type Prono } from "../src/lib/sfl/pronos";
import { ajouterRecrues, type RecruesJoueur } from "../src/lib/sfl/recrues";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import type { Saison } from "../src/lib/sfl/saisie/types";
import { journalComplet } from "../src/lib/sfl/xp-calcul";
import { reponsesDemoXp, saisonDemoXp } from "./xp-demo";

const maintenant = new Date("2026-11-01T18:00:00+01:00");

/** L'ancien calcul du téléphone, tel qu'il était dans use-missions.ts. */
function ancien(jugee: Saison, reponses: Reponse[], pronos: Prono[], ligue: RecruesJoueur[]) {
  const journal = journalXp(jugee, reponses, [], maintenant, []);
  ajouterPronos(journal, jugee, pronos, maintenant);
  ajouterDefis(journal, jugee);
  ajouterRecrues(journal, jugee, ligue, null, maintenant);
  return journal;
}

const trie = (j: ReturnType<typeof journalComplet>) =>
  [...j].sort(([a], [b]) => a.localeCompare(b)).map(([n, x]) => [n, x.reussies, x.lignes.map((l) => `${l.saison}|${l.j}|${l.date}|${l.quoi}|${l.xp}`).sort()]);

for (const [titre, jugee, reponses] of [
  ["démo d'Ilyes", saisonDemoXp(maintenant.getTime(), "xp"), reponsesDemoXp(saisonDemoXp(maintenant.getTime(), "xp"), "xp")],
  ["démo sans les réponses", saisonDemoXp(maintenant.getTime(), "sans-missions"), []],
  ["saison de départ", seedSaison(), []],
] as const) {
  const pronos: Prono[] = [];
  const ligue: RecruesJoueur[] = [{ nom: "Kader", actives: 1, activations: ["2026-10-20T10:00:00.000Z"], fondateur: 12 }];
  const a = ancien(jugee, [...reponses], pronos, ligue);
  const b = journalComplet({ jugee, reponses: [...reponses], votes: [], felicitations: [], pronos, ligueRecrues: ligue, moi: null, bolaCarte: null, maintenant });
  assert.deepEqual(trie(b), trie(a), titre);
}

// Le chiffre d'Ilyes dans la démo : 1 630 XP, niveau 6, Passe 13/16.
{
  const s = saisonDemoXp(maintenant.getTime(), "xp");
  const j = journalComplet({ jugee: s, reponses: reponsesDemoXp(s, "xp"), votes: [], felicitations: [], pronos: [], ligueRecrues: [], moi: null, bolaCarte: null, maintenant });
  const b = bilanDe(j, "Ilyes", maintenant);
  console.log(`  démo : ${b.total} XP, niveau ${b.niveau}, palier ${b.palier}/${b.saisonPasse.paliers.length}`);
  assert.equal(b.niveau, niveauAttendu(b.total));
}
function niveauAttendu(x: number) {
  let n = 1;
  while (50 * (n + 1) * n <= x) n++;
  return n;
}
console.log("xp-calcul : ok");
