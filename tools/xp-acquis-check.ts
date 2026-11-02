// Une seule source pour les paliers (lib/sfl/xp-acquis.ts, 01/11/2026 :
// Ilyes voyait ses paliers ouverts au téléphone, fermés à l'ordinateur).
// Le palier affiché est le plus haut entre le calcul de l'appareil et celui
// que le serveur a gardé ; un calcul incomplet (sans les réponses aux
// missions) ne montre jamais un 4/16 quand le serveur a gardé plus ; le
// serveur ne garde rien du compte vitrine.
//   npx tsx tools/xp-acquis-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bilanDe } from "../src/lib/sfl/missions";
import { journalComplet } from "../src/lib/sfl/xp-calcul";
import { bilanAffiche, palierAAnnoncer, paliersAuPlusHaut } from "../src/lib/sfl/xp-acquis";
import { bilanServeurDe, paliersAGarder, type XpServeur } from "../src/lib/sfl/xp-serveur.server";
import { reponsesDemoXp, saisonDemoXp } from "./xp-demo";

const maintenant = new Date("2026-11-01T18:00:00+01:00");
const s = saisonDemoXp(maintenant.getTime(), "xp");
const avec = journalComplet({ jugee: s, reponses: reponsesDemoXp(s, "xp"), votes: [], felicitations: [], pronos: [], ligueRecrues: [], moi: null, bolaCarte: null, maintenant });
const sans = journalComplet({ jugee: s, reponses: [], votes: [], felicitations: [], pronos: [], ligueRecrues: [], moi: null, bolaCarte: null, maintenant });
const juste = bilanDe(avec, "Ilyes", maintenant);
const incomplet = bilanDe(sans, "Ilyes", maintenant);
console.log(`  avec les réponses : palier ${juste.palier}, ${juste.total} XP ; sans : palier ${incomplet.palier}, ${incomplet.total} XP`);
assert.ok(incomplet.palier < juste.palier, "sans les réponses, l'épreuve fait tomber le Passe");

// 1 · Les paliers au plus haut, saison par saison.
assert.deepEqual(paliersAuPlusHaut({ s1: 4 }, { s1: 13, givre: 2 }), { s1: 13, givre: 2 });
assert.deepEqual(paliersAuPlusHaut({ s1: 14 }, { s1: 13 }), { s1: 14 });
assert.deepEqual(paliersAuPlusHaut({ s1: 4 }, undefined), { s1: 4 });

// 2 · Un calcul incomplet, avec le dernier bilan du serveur : on montre le serveur, jamais le 4/16.
const xs: XpServeur = { journal: avec, bola: false, effectif: new Set(["Ilyes", "Kader"]), idDeNom: new Map([["Ilyes", "u-ilyes"], ["Kader", "u-kader"], ["Sabri", "u-sabri"]]) };
const serveur = bilanServeurDe(xs, "Ilyes", maintenant);
assert.equal(serveur.total, juste.total);
assert.equal(serveur.saisons.s1.palier, juste.palier);
const vu = bilanAffiche(incomplet, { complet: false, serveur });
assert.equal(vu.palier, juste.palier);
assert.equal(vu.total, juste.total);
assert.equal(vu.niveau, juste.niveau);
assert.equal(vu.dansLeNiveau, juste.dansLeNiveau);
// Un calcul complet garde son total (l'XP peut baisser : un contrat raté), mais jamais sous le palier gardé.
const garde13 = bilanAffiche(incomplet, { complet: true, serveur, garde: { s1: 13 } });
assert.equal(garde13.palier, 13);
assert.equal(garde13.total, incomplet.total);
// Sans réponses mais avec un acquis de 13 : 13, plus jamais 4.
assert.equal(bilanAffiche(incomplet, { complet: false, serveur: null, garde: { s1: 13 } }).palier, 13);
// Le bilan du serveur d'un autre compte ne sert pas.
assert.equal(bilanAffiche(incomplet, { complet: false, serveur: { ...serveur, nom: "" } }).palier, incomplet.palier);

// 3 · Ce que le serveur garde : l'effectif (et l'appelant), jamais un nom hors effectif ni le compte vitrine.
const lignes = paliersAGarder(xs, "Ilyes", maintenant);
assert.ok(lignes.some((l) => l.joueur === "u-ilyes" && l.saison_passe === "s1" && l.palier === juste.palier));
assert.ok(!lignes.some((l) => l.joueur === "u-sabri"), "le compte vitrine n'est jamais écrit");
assert.ok(lignes.every((l) => l.palier >= 1));
const source = readFileSync(new URL("../src/lib/sfl/xp-serveur.server.ts", import.meta.url), "utf8");
assert.ok(!/compte-vitrine|avecVitrineXp/.test(source.replace(/^\/\/.*$/gm, "")), "le serveur ne lit pas la vitrine");

// 4 · Un palier qui s'ouvre s'annonce une fois.
assert.equal(palierAAnnoncer(13, null), 13);
assert.equal(palierAAnnoncer(13, 13), null);
assert.equal(palierAAnnoncer(12, 13), null);
assert.equal(palierAAnnoncer(14, 13), 14);
assert.equal(palierAAnnoncer(0, null), null);
console.log("xp-acquis : ok");
