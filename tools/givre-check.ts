// La Saison Givre au même régime pour tous (01/11/2026 ; Sabri, 30/10 : elle
// s'ouvre à tous le lundi 9 novembre, gratuite, par l'XP du Passe) :
//   1. chaque skin et chaque signe qu'une carte peut porter (Givre et
//      PACK AFRIQUE 2027 compris) se relit (habillages-choisis.ts) ET passe la
//      contrainte profiles_habillage_check de supabase/schema.sql ;
//   2. la bascule : le 8/11 à 23:59 à Paris, la Saison 1 ; le 9/11 à 00:00, Givre ;
//   3. une ligne d'XP sans date ne change pas de saison entre le 1/11 et le 10/11 ;
//   4. le jour ISO d'une ligne ne dépend pas de l'heure du calcul.
//   npx tsx tools/givre-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FINITIONS, SIGNES_JOUEUR } from "../src/components/sfl/finitions-carte";
import { ecrireChoixHabillage, lireChoixHabillage } from "../src/lib/sfl/habillages-choisis";
import type { LigneXp } from "../src/lib/sfl/missions";
import { bilanDe } from "../src/lib/sfl/missions";
import { PASSE_GIVRE, PASSE_SAISON_1 } from "../src/lib/sfl/passe";
import { NATIONS } from "../src/lib/sfl/pack-afrique";
import { jourDeLigne, saisonPasseA, saisonPasseDeLigne, saisonsPasseOuvertes } from "../src/lib/sfl/saisons-passe";

// 1 · La contrainte, lue dans schema.sql (la dernière posée).
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const poses = [...schema.matchAll(/add constraint profiles_habillage_check\s+check \(habillage is null or habillage ~ '([^']+)'\)/g)];
assert.ok(poses.length > 0, "la contrainte est dans schema.sql");
const contrainte = new RegExp(poses[poses.length - 1][1]);
const accepte = (brut: string) => contrainte.test(brut);

const skins = [...PASSE_SAISON_1, ...PASSE_GIVRE].flatMap((p) => (p.habille?.finition ? [p.habille.finition] : []));
const signes = [...PASSE_SAISON_1, ...PASSE_GIVRE].flatMap((p) => (p.habille?.signe ? [p.habille.signe] : []));
for (const f of skins) assert.ok((FINITIONS as readonly string[]).includes(f), `${f} est une finition portable`);
for (const g of signes) assert.ok((SIGNES_JOUEUR as readonly string[]).includes(g), `${g} est un signe portable`);
for (const n of NATIONS) assert.ok((FINITIONS as readonly string[]).includes(`afrique-${n.id}`), `afrique-${n.id} est portable`);

for (const f of FINITIONS) {
  const choix = { finition: f, pays: f === "couleurs" ? "dz" : undefined, traitement: "-" as const, signes: [] };
  const brut = ecrireChoixHabillage(choix);
  assert.equal(lireChoixHabillage(brut).finition, f, `${f} se relit`);
  assert.ok(accepte(brut), `${brut} passe la contrainte`);
}
for (const g of SIGNES_JOUEUR) {
  const brut = ecrireChoixHabillage({ finition: "auto", traitement: "auto", signes: [g] });
  assert.deepEqual(lireChoixHabillage(brut).signes, [g], `${g} se relit`);
  assert.ok(accepte(brut), `${brut} passe la contrainte`);
}
// Tous les signes de Givre ensemble, avec un skin Givre.
const givre = ecrireChoixHabillage({ finition: "jarl", traitement: "-", signes: ["lisere-fer", "runes", "nom-runes"] });
assert.ok(accepte(givre), givre);
// Ce qui ne doit pas passer.
for (const brut of ["afrique-KE/-/-", "afrique-ken/-/-", "inconnu/-/-", "jarl/-/sifflet", "auto/-/lisere-fer+drop"]) assert.ok(!accepte(brut), `${brut} refusé`);

// 2 · La bascule, à minuit à Paris (heure d'hiver : UTC+1).
assert.equal(saisonPasseA(new Date("2026-11-08T22:59:00Z")).id, "s1");
assert.equal(saisonPasseA(new Date("2026-11-08T23:00:00Z")).id, "givre");
assert.equal(saisonsPasseOuvertes(new Date("2026-11-08T22:59:00Z")).length, 1, "personne n'a Givre avant le 9/11");
assert.equal(saisonsPasseOuvertes(new Date("2026-11-08T23:00:00Z")).length, 2, "tout le monde a Givre le 9/11");

// 3 · Une ligne sans date reste dans la saison de sa saison SFL.
const L = (x: Partial<LigneXp>): LigneXp => ({ saison: 1, j: 3, date: "", quoi: "Félicitations reçues", xp: 10, ...x });
const lignes = [L({ date: "25 oct.", quoi: "Dimanche joué", xp: 100 }), L({})];
for (const quand of ["2026-11-01T12:00:00Z", "2026-11-08T23:30:00Z", "2026-11-10T12:00:00Z"]) {
  const t = new Date(quand);
  const repli = (s: number) => (s === 1 ? "2026-10-25" : null);
  assert.equal(saisonPasseDeLigne(L({}), t, repli).id, "s1", `ligne sans date, ${quand}`);
  assert.equal(saisonPasseDeLigne(L({ saison: 9 }), t).id, "s1", `ligne sans date ni repère, ${quand}`);
  const journal = new Map([["Ilyes", { lignes, reussies: 0 }]]);
  const b = bilanDe(journal, "Ilyes", t);
  if (b.saisonPasse.id === "s1") assert.equal(b.saison, 110, quand);
  else assert.equal(b.saison, 0, `${quand} : Givre ne reçoit rien d'une ligne sans date de la Saison 1`);
}

// 4 · Le jour ISO l'emporte sur le libellé, quelle que soit l'heure du calcul.
for (const quand of ["2026-11-01T12:00:00Z", "2027-06-01T12:00:00Z", "2027-12-15T12:00:00Z"])
  assert.equal(jourDeLigne({ date: "1 nov.", jour: "2026-11-01" }, new Date(quand)), "2026-11-01");
console.log("givre : ok");
