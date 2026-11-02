// La Saison Givre au même régime pour tous (01/11/2026 ; Sabri, 30/10 : elle
// s'ouvre à tous le lundi 9 novembre, gratuite, par l'XP du Passe) :
//   1. chaque skin et chaque signe qu'une carte peut porter (Givre et
//      PACK AFRIQUE 2027 compris) se relit (habillages-choisis.ts) ET passe la
//      contrainte profiles_habillage_check de supabase/schema.sql ;
//   2. la bascule : le 8/11 à 23:59 à Paris, la Saison 1 ; le 9/11 à 00:00, Givre ;
//   3. une ligne d'XP sans date ne change pas de saison entre le 1/11 et le 10/11 ;
//   4. le jour ISO d'une ligne ne dépend pas de l'heure du calcul ;
//   5. rien n'ouvre Givre avant le 9/11 (relecture du 02/11) : ni une ligne
//      datée d'avance, ni le serveur, ni un palier gardé par erreur ;
//   6. à l'heure du serveur (horloge.ts, mise en ligne du 02/11) : la carte et
//      Personnaliser ouvrent Givre à minuit à Paris pour tout le monde, que le
//      téléphone retarde ou qu'il avance.
//   npx tsx tools/givre-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FINITIONS, SIGNES_JOUEUR } from "../src/components/sfl/finitions-carte";
import { ecrireChoixHabillage, lireChoixHabillage } from "../src/lib/sfl/habillages-choisis";
import type { LigneXp } from "../src/lib/sfl/missions";
import { bilanDe, paliersDe } from "../src/lib/sfl/missions";
import { finitionsDe } from "../src/hooks/use-habillage";
import { decalageHorloge, noterHeureServeur } from "../src/lib/sfl/horloge";
import { bilanServeurDe, paliersAGarder, type XpServeur } from "../src/lib/sfl/xp-serveur.server";
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

// 5 · Relecture adverse (02/11/2026) : rien n'ouvre Givre avant le 9/11, pas même une ligne datée
//     d'avance (une journée du 15/11 saisie trop tôt) : ni le palier de l'appareil, ni ce que le
//     serveur garde (passe_acquis, ratchet sans retour), ni le bilan qu'il rend, ni un skin porté.
{
  const davance = new Map([["Ilyes", { lignes: [L({ j: 9, date: "15 nov.", quoi: "Dimanche joué", xp: 2000 })], reussies: 0 }]]);
  const avant = new Date("2026-11-02T12:00:00Z");
  const apres = new Date("2026-11-16T12:00:00Z");
  assert.equal(paliersDe(davance, "Ilyes", avant).givre, undefined, "aucun palier Givre le 2/11");
  assert.ok((paliersDe(davance, "Ilyes", apres).givre ?? 0) > 0, "le palier Givre compte une fois la saison ouverte");
  const xs: XpServeur = { journal: davance, journalS: new Map(), bola: false, effectif: new Set(["Ilyes"]), idDeNom: new Map([["Ilyes", "u-ilyes"]]) };
  assert.ok(!paliersAGarder(xs, "Ilyes", avant).some((l) => l.saison_passe === "givre"), "le serveur ne garde rien de Givre avant le 9/11");
  assert.equal(bilanServeurDe(xs, "Ilyes", avant).saisons.givre, undefined, "le bilan du serveur ne montre pas Givre avant le 9/11");
  assert.ok(paliersAGarder(xs, "Ilyes", apres).some((l) => l.saison_passe === "givre" && l.palier > 0));
  // Même un palier Givre gardé par erreur ne s'enfile pas avant le 9/11.
  const givreSkins = PASSE_GIVRE.flatMap((p) => (p.habille?.finition ? [p.habille.finition] : []));
  const portables = finitionsDe("Ilyes", { s1: 16, givre: 12 }, 0, null, [], avant);
  assert.ok(!givreSkins.some((f) => (portables as string[]).includes(f)), "aucun skin Givre portable le 2/11");
  assert.ok(portables.length > 0, "les skins de la Saison 1 restent");
  const ouverte = finitionsDe("Ilyes", { s1: 16, givre: 12 }, 0, null, [], new Date("2026-11-10T12:00:00Z"));
  assert.ok(givreSkins.every((f) => (ouverte as string[]).includes(f)), "les skins Givre gagnés se portent dès le 9/11");
}

// 6 · À l'heure du serveur (horloge.ts) : le 9/11 à 00 h 05, un téléphone qui retarde de 10 min porte
//     déjà les skins Givre gagnés ; la veille à 23 h 30, un téléphone qui avance d'une heure ne les porte
//     pas. La carte (useHabillage), le choix par défaut de finitionsDe et Personnaliser lisent cette heure.
{
  const givreSkins = PASSE_GIVRE.flatMap((p) => (p.habille?.finition ? [p.habille.finition] : []));
  const portes = () => finitionsDe("Ilyes", { s1: 16, givre: 12 }) as string[];
  const avant = Date.now;
  try {
    const minuit5 = new Date("2026-11-08T23:05:00Z").getTime();
    Date.now = () => minuit5 - 10 * 60_000;
    noterHeureServeur(minuit5, Date.now() - 100, Date.now() + 100);
    assert.ok(givreSkins.every((f) => portes().includes(f)), "00 h 05 le 9/11 : Givre se porte, même sur un téléphone qui retarde");
    const veille = new Date("2026-11-08T22:30:00Z").getTime();
    Date.now = () => veille + 3600_000;
    noterHeureServeur(veille, Date.now() - 100, Date.now() + 100);
    assert.ok(!givreSkins.some((f) => portes().includes(f)), "23 h 30 le 8/11 : un téléphone qui avance n'ouvre pas Givre");
  } finally {
    Date.now = avant;
    noterHeureServeur(Date.now(), Date.now(), Date.now());
  }
  assert.equal(decalageHorloge(), 0);
  const lire = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
  assert.match(lire("hooks/use-habillage.ts"), /const maintenant = new Date\(maintenantMs\(\)\);/, "la carte : l'heure du serveur");
  assert.match(lire("components/sfl/personnaliser-carte.tsx"), /saisonsPasseOuvertes\(new Date\(maintenantMs\(\)\)\)/, "Personnaliser : la même heure");
}
console.log("givre : ok");
