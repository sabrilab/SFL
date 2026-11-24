// La refonte de l'admin (24/11/2026) : les quatre onglets et leurs retours
// (lib/nav.ts), ce que l'onglet Joueurs dit de chacun (lib/sfl/admin-joueurs.ts)
// et la tête d'Analytics (lib/sfl/analytics-tete.ts).
//   npx tsx tools/admin-refonte-check.ts
import assert from "node:assert/strict";
import { ongletAdmin, parentDe, RACINES_ADMIN, RACINES_MEMOIRE, titreDe } from "../src/lib/nav";
import { CODE_DE_FAMILLE, dernieresVenues, famillePoste, libelleVu, texteDAcces } from "../src/lib/sfl/admin-joueurs";
import { plafondRond, teteAnalytics } from "../src/lib/sfl/analytics-tete";
import { debutJour, DAY } from "../src/lib/sfl/retention";

// ─── Les onglets ───
assert.equal(ongletAdmin("/admin"), "journee");
assert.equal(ongletAdmin("/admin/joueurs"), "joueurs");
assert.equal(ongletAdmin("/admin/comptes"), "joueurs");
assert.equal(ongletAdmin("/admin/ligue/effectif"), "joueurs");
assert.equal(ongletAdmin("/admin/activite"), "analytics");
for (const p of ["/admin/plus", "/admin/ligue", "/admin/tableau", "/admin/notifications", "/admin/setup", "/admin/design"]) assert.equal(ongletAdmin(p), "plus", p);
for (const p of ["/", "/profil", "/reglages", "/administration", "/ligue"]) assert.equal(ongletAdmin(p), null, p);
// Les racines n'ont pas de retour (la barre suffit) ; leurs sous-pages reviennent à leur onglet.
for (const r of RACINES_ADMIN) {
  assert.equal(parentDe(r), null, r);
  assert.ok(RACINES_MEMOIRE.includes(r), r);
  assert.ok(titreDe(r), r);
}
assert.equal(parentDe("/admin/comptes")?.href, "/admin/joueurs");
assert.equal(parentDe("/admin/ligue/effectif")?.href, "/admin/joueurs");
assert.equal(parentDe("/admin/tableau")?.href, "/admin/plus");
assert.equal(parentDe("/admin/setup")?.href, "/admin/plus");
assert.equal(titreDe("/admin/activite"), "Analytics");

// ─── Les postes ───
assert.equal(famillePoste("G"), "GB");
for (const p of ["DG", "DC", "DD"]) assert.equal(famillePoste(p), "DEF");
for (const p of ["MDC", "MC", "MC/AT"]) assert.equal(famillePoste(p), "MIL");
for (const p of ["AG", "AT", "AD"]) assert.equal(famillePoste(p), "ATT");
for (const p of ["—", "", null, undefined]) assert.equal(famillePoste(p), null);
for (const [f, code] of Object.entries(CODE_DE_FAMILLE)) assert.equal(famillePoste(code), f);

// ─── « vu … », en jours de Paris ───
const mardi = new Date("2026-11-24T15:49:00+01:00");
assert.equal(libelleVu(new Date("2026-11-24T00:10:00+01:00"), mardi), "vu aujourd'hui");
assert.equal(libelleVu(new Date("2026-11-23T23:50:00+01:00"), mardi), "vu hier");
assert.equal(libelleVu(new Date("2026-11-22T11:00:00+01:00"), mardi), "vu dimanche");
assert.equal(libelleVu(new Date("2026-11-12T11:00:00+01:00"), mardi), "vu le 12/11");
const venues = dernieresVenues([
  { player_id: "a", created_at: "2026-11-20T10:00:00Z" },
  { player_id: "a", created_at: "2026-11-23T10:00:00Z" },
  { player_id: null, created_at: "2026-11-24T10:00:00Z" },
  { player_id: "b", created_at: "2026-11-21T10:00:00Z" },
]);
assert.equal(venues.get("a"), "2026-11-23T10:00:00Z");
assert.equal(venues.size, 2);
assert.equal(texteDAcces("Karim", "karim", "k7mp-3xq9-hw2d"), "Karim\nIdentifiant : karim\nMot de passe provisoire : k7mp-3xq9-hw2d");

// ─── La tête d'Analytics ───
const now = new Date(2026, 10, 24, 15, 49).getTime();
const minuit = debutJour(now);
const jour = (i: number, h = 12) => debutJour(minuit + DAY / 2 - i * DAY) + h * 3600_000;
const ev = [
  { name: "Souley", at: jour(0, 9) },
  { name: "Gaïl", at: jour(0, 14) },
  { name: "Souley", at: jour(0, 15) },
  { name: "Ilyes", at: jour(0, 15) }, // admin : jamais compté
  { name: "Souley", at: jour(1) },
  { name: "Abdel", at: jour(3) },
  { name: "Yamin", at: jour(3) },
  { name: "Zakary", at: jour(9) }, // hors des 7 jours
];
const profils = [
  { name: "Ilyes", contact_email: "i@x.fr", created_at: jour(200), admin: true },
  { name: "Souley", contact_email: "s@x.fr", created_at: jour(100) },
  { name: "Gaïl", contact_email: null, created_at: jour(50) },
  { name: "Lilian", contact_email: "l@x.fr", created_at: jour(4) },
  { name: "Abdel", contact_email: null, created_at: jour(7) }, // il y a 7 jours : hors de « 7 j »
];
const t = teteAnalytics(ev, profils, now, 7);
assert.deepEqual(t.aujourdhui, ["Souley", "Gaïl"]);
assert.equal(t.parJour.length, 7);
assert.equal(t.parJour.at(-1)?.t, minuit);
assert.deepEqual(t.parJour.map((j) => j.n), [0, 0, 0, 2, 0, 1, 2]);
assert.equal(t.moyenne, Math.round(3 / 6)); // sans aujourd'hui
assert.deepEqual(t.mails.map((m) => m.name), ["Lilian", "Souley", "Ilyes"]);
assert.equal(t.comptes, 5);
assert.deepEqual(t.inscrits.map((i) => i.name), ["Lilian"]);
assert.equal(teteAnalytics(ev, profils, now, 30).parJour.length, 30);
assert.equal(teteAnalytics(ev, profils, now, 30).parJour[20].n, 1); // Zakary, il y a 9 jours
assert.equal(plafondRond(33 * 1.15), 40);
assert.equal(plafondRond(3), 3);

console.log("admin-refonte : ok");
