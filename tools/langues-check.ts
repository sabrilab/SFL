// Les langues de l'app (lib/i18n), le 03/11/2026 :
//   1. la langue d'office et les langues proposées selon le pays : français
//      en France et au Maghreb (l'arabe proposé en Algérie, au Maroc, en
//      Tunisie), arabe d'office en Égypte ou dans le Golfe, rien à choisir
//      ailleurs sauf téléphone en arabe ;
//   2. chaque phrase traduite garde ses {repères}, ni plus ni moins ;
//   3. chaque t("…") écrit en toutes lettres dans les écrans traduits a sa
//      traduction arabe (aucune phrase oubliée dans ces écrans).
//   npx tsx tools/langues-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { langueDuPays, languesProposees, remplir } from "../src/lib/i18n/langues";
import { AR } from "../src/lib/i18n/ar";

// 1 · Le pays
assert.equal(langueDuPays("FR"), "fr");
assert.equal(langueDuPays("DZ"), "fr", "Algérie : français d'office");
assert.equal(langueDuPays("EG"), "ar");
assert.equal(langueDuPays(null), "fr");
assert.deepEqual(languesProposees("DZ"), ["fr", "ar"]);
assert.deepEqual(languesProposees("MA"), ["fr", "ar"]);
assert.deepEqual(languesProposees("SA"), ["ar", "fr"]);
assert.deepEqual(languesProposees("FR"), ["fr"]);
assert.deepEqual(languesProposees("FR", ["ar-DZ", "fr"]), ["fr", "ar"], "téléphone en arabe");
assert.deepEqual(languesProposees(null, ["fr-FR"]), ["fr"]);
assert.equal(remplir("Bienvenue, {nom}.", { nom: "Ilyes" }), "Bienvenue, Ilyes.");

// 2 · Les repères
const reperes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
for (const [fr, ar] of Object.entries(AR)) assert.equal(reperes(ar), reperes(fr), `repères de « ${fr} »`);

// 3 · Les écrans traduits
const ECRANS = [
  "components/sfl/auth/login-screen.tsx",
  "components/sfl/auth/boutons-sociaux.tsx",
  "components/sfl/auth/account-card.tsx",
  "components/sfl/auth/bouton-deconnexion.tsx",
  "app/inscription/page.tsx",
  "app/reglages/page.tsx",
  "components/sfl/notifications/reglage-notifications.tsx",
  "components/sfl/confidentialite/reglage.tsx",
  "components/sfl/confidentialite/consentement.tsx",
  "components/layout/bottom-nav.tsx",
  "components/sfl/langue/choix-langue.tsx",
];
const manquantes: string[] = [];
for (const f of ECRANS) {
  const code = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
  for (const m of code.matchAll(/\bt\(\s*(?:[\w.]+\s*\?\s*)?"((?:[^"\\]|\\.)*)"(?:\s*:\s*"((?:[^"\\]|\\.)*)")?/g)) {
    for (const brut of [m[1], m[2]]) {
      if (brut === undefined) continue;
      const fr = JSON.parse(`"${brut}"`) as string;
      if (!(fr in AR)) manquantes.push(`${f} : « ${fr} »`);
    }
  }
}
assert.deepEqual(manquantes, [], "phrases sans arabe");
console.log("langues : ok");
