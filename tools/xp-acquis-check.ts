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
import { bilanAffiche, cartesAvecServeur, palierAAnnoncer, paliersAuPlusHaut, parNom } from "../src/lib/sfl/xp-acquis";
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

// 3b · Relecture adverse (02/11/2026) : ce que la base garde se voit chez tout le monde, même pour
//      un joueur que cet appareil ne calcule pas (un joueur Bola, hors de l'effectif : ses matchs ne
//      sont lus que sur son téléphone). Avant, son skin de nation payé ne se voyait que chez lui.
{
  type Carte = { rang: null; paliers: Record<string, number>; cran: number; recrues: number; fondateur: number | null; afrique?: readonly (readonly [string, number])[] };
  const vide = (): Carte => ({ rang: null, paliers: {}, cran: 0, recrues: 0, fondateur: null });
  const ici = new Map<string, Carte>([["Kader", { ...vide(), paliers: { s1: 4 }, cran: 2 }]]);
  const fusion = cartesAvecServeur(ici, { Kader: { s1: 13 }, Moussa: { s1: 6 } }, { Moussa: [["sn", 42]], Kader: [["ke", 1]] }, vide);
  assert.deepEqual(fusion.get("Kader")?.paliers, { s1: 13 }, "le palier gardé l'emporte");
  assert.equal(fusion.get("Kader")?.cran, 2, "le reste de la carte ne bouge pas");
  assert.deepEqual(fusion.get("Kader")?.afrique, [["ke", 1]]);
  assert.deepEqual(fusion.get("Moussa")?.afrique, [["sn", 42]], "le joueur Bola porte son skin chez les autres");
  assert.deepEqual(fusion.get("Moussa")?.paliers, { s1: 6 }, "et ses paliers gardés");
  assert.equal(ici.get("Kader")?.paliers.s1, 4, "l'entrée de l'appareil n'est pas modifiée en place");
  assert.equal(cartesAvecServeur(ici, {}, {}, vide).size, 1, "rien de gardé : rien d'ajouté");
  // La base range sous le nom du compte (« kader ») : la carte d'effectif (« Kader ») le reçoit.
  const casse = cartesAvecServeur(ici, { kader: { s1: 9 } }, { kader: [["ma", 7]] }, vide);
  assert.equal(casse.size, 1, "pas de seconde carte pour le même joueur");
  assert.deepEqual(casse.get("Kader")?.paliers, { s1: 9 });
  assert.deepEqual(casse.get("Kader")?.afrique, [["ma", 7]]);
  assert.equal(parNom({ kader: 3 }, "Kader"), 3);
  assert.equal(parNom({ Kader: 3 }, "Kader"), 3);
  assert.equal(parNom({ kader: 3 }, "Kad"), undefined);
  assert.equal(parNom({ kader: 3 }, null), undefined);
}

// 3c · Un compte écrit autrement que l'effectif (« ilyes » pour Ilyes) : le serveur compte son XP sous
//      le nom de l'effectif, comme son téléphone ; avant, 0 XP côté serveur et le pack refusé.
{
  const xc: XpServeur = { journal: avec, bola: false, effectif: new Set(["Ilyes", "Kader"]), idDeNom: new Map([["ilyes", "u-ilyes"], ["Kader", "u-kader"]]), nom: "Ilyes" };
  const b = bilanServeurDe(xc, "ilyes", maintenant);
  assert.equal(b.total, juste.total, "le total du serveur est celui du téléphone");
  assert.equal(b.nom, "Ilyes", "le bilan porte le nom de l'effectif");
  assert.ok(paliersAGarder(xc, "ilyes", maintenant).some((l) => l.joueur === "u-ilyes" && l.saison_passe === "s1" && l.palier === juste.palier), "son palier se garde");
}

// 4 · Un palier qui s'ouvre s'annonce une fois.
assert.equal(palierAAnnoncer(13, null), 13);
assert.equal(palierAAnnoncer(13, 13), null);
assert.equal(palierAAnnoncer(12, 13), null);
assert.equal(palierAAnnoncer(14, 13), 14);
assert.equal(palierAAnnoncer(0, null), null);
console.log("xp-acquis : ok");
