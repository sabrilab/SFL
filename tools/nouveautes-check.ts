// Vérifie le registre des nouveautés annoncées (lib/sfl/nouveautes.ts) et son
// branchement (components/sfl/nouveautes), avec l'annonce du parrainage du
// 12/11/2026 (Sabri : « la fonction est déjà en ligne mais n'a jamais
// vraiment été annoncée ») :
//   · le registre : des ids tous différents (la base les retient, jamais
//     réutilisés), des dates lisibles, `le` avant `jusquAu`, de la plus
//     ancienne à la plus récente ;
//   · l'entrée « parrainage » : pour tous, quatre semaines, sa page /parrainage ;
//   · nouveautesEnCours : rien avant la mise en ligne ni après la fin, chacun
//     ne voit que ce qui est pour lui, la plus ancienne d'abord ;
//   · estSurPlace : ouverte sur la page de la nouveauté, l'app ne l'annonce pas ;
//   · par lecture des sources : chaque id a ses diapos (DIAPOS), le
//     parrainage mène à /parrainage en bouton principal, « Invite. Monte. »
//     n'est plus dans l'annonce du 27/10 (pas deux annonces du parrainage),
//     et Admin → Notification sait ouvrir Inviter (le lien du push).
//   npx tsx tools/nouveautes-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { estSurPlace, NOUVEAUTES, nouveautesEnCours, type Nouveaute } from "../src/lib/sfl/nouveautes";
import { estLienDeLApp, TEXTE_MAX, TITRE_MAX } from "../src/lib/sfl/push";

const source = (chemin: string) => readFileSync(join(__dirname, "..", chemin), "utf8");
const JOUR = 86_400_000;
const ids = (l: readonly Nouveaute[]) => l.map((n) => n.id);

/* ------------------------------- Le registre ------------------------------- */

assert.equal(new Set(ids(NOUVEAUTES)).size, NOUVEAUTES.length, "deux nouveautés portent le même id");
for (const n of NOUVEAUTES) {
  assert.match(n.id, /^[a-z0-9-]+$/, `${n.id} : un id en minuscules, chiffres et tirets`);
  const le = Date.parse(n.le);
  const fin = Date.parse(n.jusquAu);
  assert.ok(Number.isFinite(le), `${n.id} : « le » illisible (${n.le})`);
  assert.ok(Number.isFinite(fin), `${n.id} : « jusquAu » illisible (${n.jusquAu})`);
  assert.ok(le < fin, `${n.id} : « le » doit précéder « jusquAu »`);
  assert.ok(!(n.ligueSeulement && n.bolaSeulement), `${n.id} : pour la ligue seulement et pour Bola seulement, donc pour personne`);
  if (n.ici !== undefined) assert.ok(estLienDeLApp(n.ici), `${n.id} : « ici » doit être une page de l'app (${n.ici})`);
}
for (let i = 1; i < NOUVEAUTES.length; i++) {
  assert.ok(
    Date.parse(NOUVEAUTES[i - 1].le) <= Date.parse(NOUVEAUTES[i].le),
    `${NOUVEAUTES[i].id} est plus ancienne que ${NOUVEAUTES[i - 1].id}, rangée avant elle : le registre va de la plus ancienne à la plus récente`
  );
}

/* --------------------------- L'entrée « parrainage » --------------------------- */

const parrainage = NOUVEAUTES.find((n) => n.id === "parrainage");
assert.ok(parrainage, "l'entrée « parrainage » manque au registre");
assert.equal(parrainage.ligueSeulement, undefined, "le parrainage s'annonce à tous, pas à la ligue seulement");
assert.equal(parrainage.bolaSeulement, undefined, "le parrainage s'annonce à tous, pas aux joueurs Bola seulement");
assert.equal(Date.parse(parrainage.jusquAu) - Date.parse(parrainage.le), 28 * JOUR, "le parrainage s'annonce quatre semaines");
assert.equal(parrainage.ici, "/parrainage", "le parrainage se trouve sur la page Inviter");
assert.equal(NOUVEAUTES[NOUVEAUTES.length - 1].id, "parrainage", "la dernière annoncée : celle que montre ?invitation=nouveaute");

/* ----------------------------- nouveautesEnCours ----------------------------- */

const LIGUE = { ligue: true, bola: false };
const BOLA = { ligue: false, bola: true };
const ARBITRE = { ligue: false, bola: false };
const le = new Date(parrainage.le);
const avant = new Date(le.getTime() - 1);
const fin = new Date(parrainage.jusquAu);
const juste = new Date(fin.getTime() - 1);

for (const qui of [LIGUE, BOLA, ARBITRE]) {
  assert.ok(!ids(nouveautesEnCours(NOUVEAUTES, avant, qui)).includes("parrainage"), "rien avant la mise en ligne");
  assert.ok(ids(nouveautesEnCours(NOUVEAUTES, le, qui)).includes("parrainage"), "annoncée dès l'instant de la mise en ligne, à tous");
  assert.ok(ids(nouveautesEnCours(NOUVEAUTES, juste, qui)).includes("parrainage"), "annoncée jusqu'à la dernière milliseconde");
  assert.ok(!ids(nouveautesEnCours(NOUVEAUTES, fin, qui)).includes("parrainage"), "plus rien à la fin");
}

// Chacun ne voit que ce qui est pour lui : à la mise en ligne du parrainage,
// les nouveautés d'octobre sont encore annoncées (jusqu'au 24 et au 25/11).
{
  const t = le;
  const ligue = ids(nouveautesEnCours(NOUVEAUTES, t, LIGUE));
  const bola = ids(nouveautesEnCours(NOUVEAUTES, t, BOLA));
  const arbitre = ids(nouveautesEnCours(NOUVEAUTES, t, ARBITRE));
  assert.ok(ligue.includes("journees-et-blessures") && !ligue.includes("carte-bola"), "un joueur de la ligue ne voit pas « carte-bola »");
  assert.ok(bola.includes("carte-bola") && !bola.includes("journees-et-blessures"), "un joueur Bola ne voit pas « journees-et-blessures »");
  assert.ok(!arbitre.includes("carte-bola") && !arbitre.includes("journees-et-blessures"), "un arbitre ne voit ni l'une ni l'autre");
  for (const vu of [ligue, bola, arbitre]) {
    assert.ok(vu.includes("parrainage"), "tous voient le parrainage");
    // La plus ancienne d'abord : l'ordre du registre, sans trou.
    assert.deepEqual(vu, ids(NOUVEAUTES).filter((id) => vu.includes(id)), "la plus ancienne d'abord");
  }
  assert.equal(ligue[ligue.length - 1], "parrainage", "le parrainage passe après les nouveautés plus anciennes");
}

// Une liste à la main : les bornes, et rien quand rien n'est annoncé.
{
  const une: Nouveaute[] = [{ id: "essai", le: "2026-01-01T00:00:00+01:00", jusquAu: "2026-01-02T00:00:00+01:00" }];
  assert.deepEqual(nouveautesEnCours(une, new Date("2025-12-31T22:59:59Z"), LIGUE), [], "avant « le » : rien");
  assert.deepEqual(ids(nouveautesEnCours(une, new Date("2025-12-31T23:00:00Z"), LIGUE)), ["essai"], "à « le » : annoncée");
  assert.deepEqual(nouveautesEnCours(une, new Date("2026-01-01T23:00:00Z"), LIGUE), [], "à « jusquAu » : plus rien");
  assert.deepEqual(nouveautesEnCours([], new Date(), LIGUE), [], "registre vide : rien");
}

/* -------------------------------- Déjà sur place -------------------------------- */

assert.equal(estSurPlace("/parrainage", "/parrainage"), true, "ouverte sur Inviter : sur place");
assert.equal(estSurPlace("/parrainage/", "/parrainage"), true, "la barre finale ne change rien");
assert.equal(estSurPlace("/parrainage/x", "/parrainage"), true, "une page en dessous : sur place");
assert.equal(estSurPlace("/parrainages", "/parrainage"), false, "une autre page qui commence pareil : pas sur place");
assert.equal(estSurPlace("/profil", "/parrainage"), false, "Ma carte : pas sur place");
assert.equal(estSurPlace("/", "/parrainage"), false, "l'accueil : pas sur place");

/* ----------------------------- Le branchement (sources) ----------------------------- */

const annonce = source("src/components/sfl/nouveautes/annonce-nouveaute.tsx");
const table = annonce.slice(annonce.indexOf("const DIAPOS"), annonce.indexOf("export function AnnonceNouveaute"));
assert.ok(table.length > 0, "la table DIAPOS est introuvable dans annonce-nouveaute.tsx");
/** La ligne de DIAPOS d'un id (clé entre guillemets ou nue). */
const ligneDe = (id: string) => table.split("\n").find((l) => new RegExp(`^\\s*(?:"${id}"|${id})\\s*:`).test(l));
for (const n of NOUVEAUTES) assert.ok(ligneDe(n.id), `${n.id} est au registre mais n'a pas ses diapos dans DIAPOS : rien ne s'afficherait`);
const cles = [...table.matchAll(/^\s*(?:"([a-z0-9-]+)"|([a-z0-9-]+))\s*:\s*\{\s*diapos/gm)].map((m) => m[1] ?? m[2]);
assert.deepEqual([...cles].sort(), [...ids(NOUVEAUTES)].sort(), "DIAPOS et le registre ne portent pas les mêmes nouveautés");

const ligneParrainage = ligneDe("parrainage") ?? "";
assert.match(ligneParrainage, /diapos:\s*diaposParrainage/, "le parrainage montre ses propres diapos");
assert.match(ligneParrainage, /href:\s*"\/parrainage"/, "le bouton du parrainage mène à la page Inviter");
assert.match(ligneParrainage, /label:\s*"Inviter"/, "le bouton du parrainage dit « Inviter »");
assert.match(ligneParrainage, /principal:\s*true/, "« Inviter » est le bouton principal de la dernière diapo");
assert.equal(parrainage.ici, /href:\s*"([^"]+)"/.exec(ligneParrainage)?.[1], "la page du bouton est celle où l'annonce ne vient pas (« ici »)");
for (const n of NOUVEAUTES) {
  if (n.id !== "parrainage") assert.doesNotMatch(ligneDe(n.id) ?? "", /principal/, `${n.id} : « C'est compris » reste son bouton principal`);
}

// Les trois diapos du parrainage, leurs titres.
const diapos = source("src/components/sfl/nouveautes/parrainage.tsx");
for (const titre of ['"Ramène tes potes."', "`Une recrue, +${XP_RECRUE} XP.`", '"À 10, la carte Fondateur."']) {
  assert.ok(diapos.includes(`titre: ${titre}`), `la diapo ${titre} manque à parrainage.tsx`);
}
assert.equal((diapos.match(/^\s*titre:/gm) ?? []).length, 3, "le parrainage s'annonce en trois diapos");
// L'annonce ne crée pas de code et ne note aucun partage : la page Inviter le fait.
for (const interdit of ["monCode", "mon_code_parrain", "noterPartage", "publierMaCarte", "navigator.share"]) {
  assert.ok(!new RegExp(`\\b${interdit.replace(".", "\\.")}\\b`).test(diapos.replace(/^\s*\/\/.*$/gm, "")), `l'annonce ne doit pas appeler ${interdit}`);
}

// Le parrainage n'est pas annoncé deux fois : l'ancienne diapo est partie.
const ancienne = source("src/components/sfl/nouveautes/nouveautes-27-10.tsx");
assert.ok(!/titre:\s*"Invite\. Monte\."/.test(ancienne), "« Invite. Monte. » est encore une diapo de l'annonce du 27/10");
assert.ok(!ancienne.includes("PaliersRecrues"), "le visuel des paliers est encore dans l'annonce du 27/10");
assert.equal((ancienne.match(/^\s*titre:/gm) ?? []).length, 2, "l'annonce du 27/10 garde ses deux autres diapos");

// Le diaporama : le geste de la nouveauté en principal seulement quand elle le demande.
const diaporama = source("src/components/sfl/nouveautes/diaporama.tsx");
assert.match(diaporama, /derniere && !!aller\?\.principal/, "le bouton de la nouveauté ne passe en principal que sur la dernière diapo, et si elle le demande");

/* ------------------------- Admin → Notification : le lien du push ------------------------- */

const admin = source("src/app/admin/notifications/page.tsx");
const pages = admin.slice(admin.indexOf("const PAGES"), admin.indexOf("] as const"));
const urls = [...pages.matchAll(/url:\s*"([^"]+)"/g)].map((m) => m[1]);
assert.ok(urls.includes("/parrainage"), "Admin → Notification ne propose pas la page Inviter : le push ne peut pas l'ouvrir");
assert.equal(new Set(urls).size, urls.length, "une page proposée deux fois dans Admin → Notification");
for (const u of urls) assert.ok(estLienDeLApp(u), `${u} n'est pas une page de l'app`);
assert.equal(estLienDeLApp("/parrainage"), true, "le lien du push est une page de l'app");
assert.match(pages, /url:\s*"\/parrainage",\s*label:\s*"Inviter"/, "la page Inviter porte son nom");
// Les bornes d'une notification, que les textes proposés doivent tenir.
assert.deepEqual([TITRE_MAX, TEXTE_MAX], [60, 180], "les bornes du titre et du texte d'une notification ont changé : revoir les textes du push");

console.log(`nouveautes-check : ${NOUVEAUTES.length} nouveautés, le parrainage annoncé du ${parrainage.le} au ${parrainage.jusquAu} : ok`);
