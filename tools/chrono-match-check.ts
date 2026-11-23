// Le chrono d'un match de la feuille en direct (lib/sfl/chrono-match.ts, 23/11/2026) :
// 2 × 30 minutes, les minutes en plus ou en moins, les coups de sifflet, et
// appliquerGeste, le miroir de public.chrono_direct.
//   npx tsx tools/chrono-match-check.ts
import assert from "node:assert/strict";
import {
  appliquerGeste,
  doitSiffler,
  etatDuChrono,
  formatChrono,
  libelleAjout,
  siffletAttendu,
  type ChronoMatch,
} from "../src/lib/sfl/chrono-match";

const MIN = 60_000;
const t0 = Date.parse("2026-11-29T13:00:00Z");
const cible = { saison: 1, j: 8, equipes: ["Noirs 1", "Blancs 1"] as const, par: "u1", parNom: "Ilyes" };

// Avant le coup d'envoi.
assert.deepEqual(etatDuChrono(null, t0), { phase: "avant", affiche: 0, ajout: 0, sifflet: null, additionnel: false });
assert.equal(appliquerGeste(null, cible, "seconde", 0, t0).ok, false, "pas de 2e mi-temps avant le coup d'envoi");
assert.equal(appliquerGeste(null, cible, "ajout", 1, t0).ok, false, "pas de minute ajoutée avant le coup d'envoi");

// Le coup d'envoi.
const l = appliquerGeste(null, cible, "lancer", 0, t0);
assert.ok(l.ok && l.chrono);
let c = l.chrono as ChronoMatch;
assert.equal(c.mt, 1);
assert.equal(c.noirs, "Noirs 1");
assert.equal(appliquerGeste(c, cible, "lancer", 0, t0 + 5000).ok, false, "lancé deux fois : le premier reste");

let e = etatDuChrono(c, t0 + 12 * MIN + 7000);
assert.equal(e.phase, "mt1");
assert.equal(formatChrono(e.affiche), "12:07");
assert.equal(e.sifflet, t0 + 30 * MIN);

// +2, puis −1 : 31 minutes.
c = appliquerGeste(c, cible, "ajout", 1, t0 + 20 * MIN).chrono!;
c = appliquerGeste(c, cible, "ajout", 1, t0 + 20 * MIN).chrono!;
c = appliquerGeste(c, cible, "ajout", -1, t0 + 21 * MIN).chrono!;
assert.equal(c.ajout1, 1);
assert.equal(libelleAjout(c.ajout1), "+1");
e = etatDuChrono(c, t0 + 30 * MIN + 30_000);
assert.equal(e.phase, "mt1", "dans le temps ajouté");
assert.equal(e.additionnel, true);
assert.equal(formatChrono(e.affiche), "30:30");

// Le coup de sifflet de la mi-temps, une fois le temps ajouté écoulé : le chrono s'arrête.
const s1 = siffletAttendu(c)!;
assert.equal(s1.quoi, "mi-temps");
assert.equal(s1.a, t0 + 31 * MIN);
e = etatDuChrono(c, t0 + 35 * MIN);
assert.equal(e.phase, "pause");
assert.equal(formatChrono(e.affiche), "31:00");

// Les sifflets : vu venir, il siffle même en retard ; pas vu, 15 s au plus.
assert.equal(doitSiffler(s1.a, s1.a - 1, true), false);
assert.equal(doitSiffler(s1.a, s1.a + 60_000, true), true);
assert.equal(doitSiffler(s1.a, s1.a + 10_000, false), true);
assert.equal(doitSiffler(s1.a, s1.a + 20_000, false), false);

// La 2e mi-temps : 30:00 → 60:00, ses minutes à elle.
const tm2 = t0 + 40 * MIN;
c = appliquerGeste(c, cible, "seconde", 0, tm2).chrono!;
assert.equal(c.mt, 2);
assert.equal(appliquerGeste(c, cible, "seconde", 0, tm2 + 1000).ok, false, "une seule 2e mi-temps");
e = etatDuChrono(c, tm2 + 5 * MIN);
assert.equal(e.phase, "mt2");
assert.equal(formatChrono(e.affiche), "35:00");
assert.equal(e.ajout, 0, "les minutes de la 1re ne passent pas à la 2e");
const s2 = siffletAttendu(c)!;
assert.equal(s2.quoi, "fin");
assert.notEqual(s2.cle, s1.cle, "un coup de sifflet par mi-temps");
assert.equal(s2.a, tm2 + 30 * MIN);

// Retirer des minutes : le sifflet avance (−3 → 27 minutes).
for (let i = 0; i < 3; i++) c = appliquerGeste(c, cible, "ajout", -1, tm2 + 10 * MIN).chrono!;
assert.equal(siffletAttendu(c)!.a, tm2 + 27 * MIN);
assert.equal(siffletAttendu(c)!.cle, s2.cle, "les minutes déplacent l'instant, pas la clé");
e = etatDuChrono(c, tm2 + 28 * MIN);
assert.equal(e.phase, "fin");
assert.equal(formatChrono(e.affiche), "57:00");

// Les bornes : ±5 par geste, −29 à +30 en tout, une minute au moins.
let b = appliquerGeste(null, cible, "lancer", 0, t0).chrono!;
b = appliquerGeste(b, cible, "ajout", 50, t0).chrono!;
assert.equal(b.ajout1, 5);
for (let i = 0; i < 10; i++) b = appliquerGeste(b, cible, "ajout", 5, t0).chrono!;
assert.equal(b.ajout1, 30);
for (let i = 0; i < 20; i++) b = appliquerGeste(b, cible, "ajout", -5, t0).chrono!;
assert.equal(b.ajout1, -29);
assert.equal(siffletAttendu(b)!.a, t0 + 1 * MIN);
assert.equal(appliquerGeste(b, cible, "ajout", 0, t0).ok, false);

// Remettre à zéro, puis relancer : un nouveau coup de sifflet.
assert.deepEqual(appliquerGeste(c, cible, "remettre", 0, t0), { ok: true, chrono: null });
const r = appliquerGeste(null, cible, "lancer", 0, t0 + 99 * MIN).chrono!;
assert.notEqual(siffletAttendu(r)!.cle, s1.cle);

// L'affichage.
assert.equal(formatChrono(0), "00:00");
assert.equal(formatChrono(61 * MIN + 30_000), "61:30");
assert.equal(libelleAjout(-2), "−2");
assert.equal(libelleAjout(0), "");

console.log("chrono-match : ok");
