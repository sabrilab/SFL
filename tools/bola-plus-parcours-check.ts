// Banc du suivi des ventes Bola Plus (lib/sfl/bola-plus-parcours.ts) :
// le parcours noté sur le téléphone, ses métadonnées Stripe (bp_*), le
// nettoyage côté serveur et « Ce qui décide ».  npx tsx tools/bola-plus-parcours-check.ts
import assert from "node:assert/strict";
import { avecCarte, avecEntree, avecFiche, avecTemps, decision, lire, mrr, nettoyer, versMetadata, vide, type Vente } from "../src/lib/sfl/bola-plus-parcours";

const t0 = new Date("2026-11-16T20:00:00Z");
let p = vide(t0);
p = avecEntree(p, "bandeau");
p = avecEntree(p, "tuile");
p = avecFiche(p, "maillots");
p = avecFiche(p, "maillots");
p = avecFiche(p, "inconnue");
p = avecCarte(p, 4);
p = avecCarte(p, 2);
p = avecTemps(p, 75.6);
assert.equal(p.visites, 2);
assert.equal(p.derniere, "tuile");
assert.deepEqual(p.fiches, { maillots: 2 });
assert.equal(p.carte, 4);
assert.equal(p.secondes, 75);
assert.deepEqual(lire(JSON.stringify(p), t0), p);
assert.equal(lire("{pas du json", t0).visites, 0);

const m = versMetadata(p, 27 * 3_600_000);
assert.equal(m.bp_source, "tuile");
assert.equal(m.bp_fiches, "maillots:2");
assert.equal(m.bp_rebours_h, "27");
assert.deepEqual(nettoyer(m), m);

const sale = nettoyer({ bp_source: "<script>", bp_fiches: "maillots:3,x:9,cadeaux:abc", bp_visites: "1e9", bp_premiere: "hier", autre: "1" });
assert.equal(sale.bp_source, "direct");
assert.equal(sale.bp_fiches, "maillots:3");
assert.equal(sale.bp_visites, "0");
assert.equal(sale.bp_premiere, "");
assert.ok(!("autre" in sale));
assert.deepEqual(Object.keys(nettoyer(null)).length, 8);

const v = (formule: string, centimes: number, meta: Record<string, string>, statut = "active"): Vente => ({ id: Math.random().toString(), nom: "x", formule, statut, centimes, le: 0, meta });
const ventes = [
  v("mensuel", 990, { bp_source: "bandeau", bp_fiches: "maillots:1", bp_visites: "3", bp_secondes: "120", bp_rebours_h: "10" }),
  v("annuel", 9990, { bp_source: "bandeau", bp_fiches: "maillots:2,cadeaux:1", bp_visites: "1", bp_secondes: "60", bp_rebours_h: "30" }),
  v("mensuel", 990, {}),
];
const d = decision(ventes);
assert.equal(d.n, 3);
assert.deepEqual(d.sources, { bandeau: 2, direct: 1 });
assert.deepEqual(d.fiches, { maillots: 2, cadeaux: 1 });
assert.equal(d.reboursMoyH, 20);
assert.equal(d.minutesMoy, 1);
assert.equal(mrr(ventes), Math.round(990 + 990 + 9990 / 12));
assert.equal(mrr([v("mensuel", 990, {}, "canceled")]), 0);
console.log("bola-plus-parcours : ok");
