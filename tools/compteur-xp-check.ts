// Le compteur d'XP (lib/sfl/compteur-xp.ts, 01/11/2026) : « 1 630 XP ·
// niveau 6 · 470 XP avant le niveau 7 » ; à 1 840 XP, 260 XP avant le niveau
// 7 (et non 360) ; les bornes 0, 100, 2 100 ; les espaces insécables.
//   npx tsx tools/compteur-xp-check.ts
import assert from "node:assert/strict";
import { ligneCompteur, partDuNiveau, resteAvantNiveau, xpFr } from "../src/lib/sfl/compteur-xp";
import { debutNiveau, niveauDe } from "../src/lib/sfl/missions";

const compte = (total: number) => {
  const niveau = niveauDe(total);
  return { total, niveau, dansLeNiveau: total - debutNiveau(niveau), pourLeSuivant: 100 * niveau };
};
// L'affichage avec des espaces ordinaires, pour lire les assertions.
const lu = (s: string) => s.replace(/[  ]/g, " ");

assert.equal(lu(ligneCompteur(compte(1630))), "1 630 XP · niveau 6 · 470 XP avant le niveau 7");
assert.equal(lu(ligneCompteur(compte(1840))), "1 840 XP · niveau 6 · 260 XP avant le niveau 7");
assert.equal(lu(ligneCompteur(compte(0))), "0 XP · niveau 1 · 100 XP avant le niveau 2");
assert.equal(lu(ligneCompteur(compte(99))), "99 XP · niveau 1 · 1 XP avant le niveau 2");
assert.equal(lu(ligneCompteur(compte(100))), "100 XP · niveau 2 · 200 XP avant le niveau 3");
assert.equal(lu(ligneCompteur(compte(2100))), "2 100 XP · niveau 7 · 700 XP avant le niveau 8");
assert.equal(resteAvantNiveau(compte(2099)), 1);
assert.equal(partDuNiveau(compte(1630)), 130 / 600);
assert.equal(partDuNiveau(compte(0)), 0);
// Les espaces ne se cassent pas : entre le nombre et XP, et dans le nombre.
assert.ok(xpFr(1630).includes(" XP"));
assert.ok(!/ /.test(ligneCompteur(compte(1630)).replace(/ · /g, "").replace(/ avant le /g, "")), "seules les séparations « · » et « avant le » sont des espaces sécables");
console.log("compteur-xp : ok");
