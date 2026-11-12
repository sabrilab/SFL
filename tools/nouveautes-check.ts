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
//   · choisirNouveaute, le choix d'une ouverture : sur la page d'une
//     nouveauté en cours rien ne vient la couvrir (ni elle, notée vue, ni une
//     plus ancienne), sinon la plus ancienne pas vue (ni ici ni en base),
//     pour ce public, mise en ligne après l'accueil du joueur ;
//   · gestesDeFin, les deux boutons : « Suivant » avant la fin, « C'est
//     compris » en principal sauf pour le parrainage (« Inviter », mauve) ;
//   · les textes du parrainage (lib/sfl/annonce-parrainage.ts) : composés
//     depuis la table des paliers, « Bola Team offert un mois » pour un
//     joueur de la SFL seulement, le numéro de la carte Fondateur ;
//   · par lecture des sources : chaque id a ses diapos (DIAPOS), le
//     parrainage mène à /parrainage en bouton principal, « Inviter » ferme
//     puis ouvre la page, les diapos lisent les textes purs, « Invite.
//     Monte. » n'est plus dans l'annonce du 27/10 (pas deux annonces du
//     parrainage), et Admin → Notification sait ouvrir Inviter (le lien du push).
//   npx tsx tools/nouveautes-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FONDATEURS_MAX, numeroFondateur, PALIERS_RECRUES, XP_RECRUE, type PalierRecrues } from "../src/components/sfl/skins-recrues";
import { lignesInvitation, NUMERO_EXEMPLE, numeroAnnonce, numeroSeul, paliersSkins, textesParrainage } from "../src/lib/sfl/annonce-parrainage";
import { choisirNouveaute, estSurPlace, gestesDeFin, NOUVEAUTES, nouveautesEnCours, type Nouveaute } from "../src/lib/sfl/nouveautes";
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

/* ------------------------- Le choix d'une ouverture ------------------------- */

{
  const A: Nouveaute = { id: "ancienne", le: "2026-01-01T00:00:00+01:00", jusquAu: "2026-03-01T00:00:00+01:00", ligueSeulement: true };
  const B: Nouveaute = { id: "bola", le: "2026-01-02T00:00:00+01:00", jusquAu: "2026-03-01T00:00:00+01:00", bolaSeulement: true };
  const P: Nouveaute = { id: "neuve", le: "2026-01-10T00:00:00+01:00", jusquAu: "2026-03-01T00:00:00+01:00", ici: "/parrainage" };
  const L = [A, B, P];
  const t = new Date("2026-01-15T12:00:00+01:00");
  const jamais = () => false;
  const vues = (...v: string[]) => (id: string) => v.includes(id);
  const profil = (v: string[] = [], accueil: string | null = "2025-10-01T10:00:00Z") => ({ vues: v, accueil });
  const choix = (o: { qui?: typeof LIGUE; chemin?: string; ici?: (id: string) => boolean; profil?: ReturnType<typeof profil> | null; quand?: Date }) =>
    choisirNouveaute(L, o.quand ?? t, o.qui ?? LIGUE, o.chemin ?? "/", o.ici ?? jamais, o.profil === undefined ? profil() : o.profil);
  const rien = { aMontrer: null, aNoterVues: [], aRetenir: [] };

  // La plus ancienne d'abord, une seule par ouverture.
  assert.deepEqual(choix({}), { aMontrer: A, aNoterVues: [], aRetenir: [] }, "la plus ancienne pas vue d'abord");
  assert.deepEqual(choix({ ici: vues("ancienne") }), { aMontrer: P, aNoterVues: [], aRetenir: [] }, "vue sur cet appareil : la suivante");
  assert.deepEqual(choix({ ici: vues("ancienne", "neuve") }), rien, "tout est vu : rien");
  // Vue sur un autre téléphone : pas montrée, et cet appareil s'en souvient.
  assert.deepEqual(choix({ profil: profil(["ancienne"]) }), { aMontrer: P, aNoterVues: [], aRetenir: ["ancienne"] }, "vue en base : la suivante, l'appareil la retient");
  assert.deepEqual(choix({ profil: profil(["ancienne", "neuve"]) }), { aMontrer: null, aNoterVues: [], aRetenir: ["ancienne", "neuve"] }, "tout est vu en base : rien, l'appareil retient");
  // Le public : chacun ne voit que ce qui est pour lui.
  assert.equal(choix({ qui: BOLA }).aMontrer, B, "un joueur Bola : sa nouveauté à lui d'abord, pas celle de la ligue");
  assert.equal(choix({ qui: ARBITRE }).aMontrer, P, "un arbitre : ni celle de la ligue ni celle de Bola");
  assert.equal(choix({ qui: LIGUE, ici: vues("ancienne") }).aMontrer, P, "un joueur de la ligue ne voit jamais celle de Bola");
  // Les dates.
  assert.deepEqual(choix({ quand: new Date("2025-12-31T12:00:00+01:00") }), rien, "avant toute mise en ligne : rien");
  assert.equal(choix({ quand: new Date("2026-01-05T12:00:00+01:00"), ici: vues("ancienne") }).aMontrer, null, "la neuve n'est pas encore en ligne");
  assert.deepEqual(choix({ quand: new Date("2026-03-01T00:00:00+01:00") }), rien, "après la fin : rien");
  // Arrivé après la mise en ligne : son accueil lui a montré l'app telle qu'elle est.
  assert.equal(choix({ profil: profil([], "2026-01-05T12:00:00+01:00") }).aMontrer, P, "accueil fini entre les deux : seule la plus récente");
  assert.deepEqual(choix({ profil: profil([], "2026-01-12T12:00:00+01:00") }), rien, "accueil fini après les deux : rien, et rien de noté");
  assert.equal(choix({ profil: profil([], null) }).aMontrer, A, "pas de date d'accueil : comme un ancien");
  // La base n'a pas répondu : ce que sait l'appareil.
  assert.equal(choix({ profil: null }).aMontrer, A, "base muette : la plus ancienne pas vue ici");
  assert.deepEqual(choix({ profil: null, ici: vues("ancienne", "neuve") }), rien, "base muette, tout vu ici : rien");

  // Sur la page de la nouveauté (le toucher du push) : rien ne la couvre.
  assert.deepEqual(choix({ chemin: "/parrainage", ici: vues("ancienne") }), { aMontrer: null, aNoterVues: ["neuve"], aRetenir: [] }, "sur place : pas montrée, notée vue");
  assert.deepEqual(choix({ chemin: "/parrainage" }), { aMontrer: null, aNoterVues: ["neuve"], aRetenir: [] }, "sur place avec une plus ancienne en retard : rien ne couvre Inviter à cette ouverture");
  assert.deepEqual(choix({ chemin: "/parrainage", qui: BOLA }), { aMontrer: null, aNoterVues: ["neuve"], aRetenir: [] }, "sur place, joueur Bola en retard : rien non plus");
  assert.deepEqual(choix({ chemin: "/parrainage", ici: vues("neuve") }), rien, "sur place, déjà vue : rien à montrer, rien à noter");
  assert.deepEqual(choix({ chemin: "/parrainage", profil: null }), { aMontrer: null, aNoterVues: ["neuve"], aRetenir: [] }, "sur place, base muette : notée vue quand même");
  assert.equal(choix({ chemin: "/parrainage/", ici: vues("ancienne") }).aMontrer, null, "la barre finale ne change rien");
  // L'ouverture suivante, ailleurs : la plus ancienne revient, la neuve est vue.
  assert.deepEqual(choix({ chemin: "/profil", ici: vues("neuve") }), { aMontrer: A, aNoterVues: [], aRetenir: [] }, "à l'ouverture suivante, la plus ancienne vient");
  // Sur place seulement tant que la nouveauté est en cours, et pour son public.
  assert.equal(choix({ chemin: "/parrainage", quand: new Date("2026-01-05T12:00:00+01:00") }).aMontrer, A, "avant la mise en ligne de la neuve, sa page n'arrête rien");
  assert.equal(choix({ chemin: "/parrainages" }).aMontrer, A, "une autre page qui commence pareil : pas sur place");
  const reservee: Nouveaute[] = [A, { ...P, bolaSeulement: true }];
  assert.equal(choisirNouveaute(reservee, t, LIGUE, "/parrainage", jamais, profil()).aMontrer, A, "la page d'une nouveauté qui n'est pas pour lui n'arrête rien");

  // Le vrai registre, à la mise en ligne du parrainage : ouvert sur Inviter par le push, rien ne vient.
  const quand = new Date(Date.parse(parrainage.le) + 3_600_000);
  for (const qui of [LIGUE, BOLA, ARBITRE]) {
    assert.deepEqual(choisirNouveaute(NOUVEAUTES, quand, qui, "/parrainage", jamais, profil()), { aMontrer: null, aNoterVues: ["parrainage"], aRetenir: [] }, "le push ouvre Inviter : aucune annonce par-dessus, le parrainage noté vu");
    const ailleurs = choisirNouveaute(NOUVEAUTES, quand, qui, "/", (id) => id !== "parrainage", profil());
    assert.equal(ailleurs.aMontrer?.id, "parrainage", "ailleurs, les anciennes vues : le parrainage s'annonce");
  }
  assert.equal(choisirNouveaute(NOUVEAUTES, quand, LIGUE, "/", jamais, profil()).aMontrer?.id, "journees-et-blessures", "un joueur de la ligue en retard voit d'abord la plus ancienne");
}

/* --------------------------- Les deux boutons du bas --------------------------- */

{
  const voir = { label: "Voir Ma carte", href: "/profil" };
  const inviter = { label: "Inviter", href: "/parrainage", principal: true };
  const suivant = { principal: { label: "Suivant", geste: "suivant", ton: "vert" }, discret: null };
  assert.deepEqual(gestesDeFin(false), suivant, "avant la dernière diapo : « Suivant », seul");
  assert.deepEqual(gestesDeFin(false, voir), suivant, "avant la dernière diapo : pas encore de second geste");
  assert.deepEqual(gestesDeFin(false, inviter), suivant, "avant la dernière diapo, même pour le parrainage : « Suivant », en vert");
  assert.deepEqual(gestesDeFin(true), { principal: { label: "C'est compris", geste: "fermer", ton: "vert" }, discret: null }, "dernière diapo sans page : « C'est compris », seul");
  assert.deepEqual(
    gestesDeFin(true, voir),
    { principal: { label: "C'est compris", geste: "fermer", ton: "vert" }, discret: { label: "Voir Ma carte", geste: "aller" } },
    "une nouveauté ordinaire : « C'est compris » ferme en principal, son geste mène à sa page, dessous"
  );
  assert.deepEqual(
    gestesDeFin(true, inviter),
    { principal: { label: "Inviter", geste: "aller", ton: "mauve" }, discret: { label: "C'est compris", geste: "fermer" } },
    "le parrainage : « Inviter » en principal, mauve, mène à la page ; « C'est compris » dessous ferme sans y aller"
  );
}

/* ------------------------- Les textes du parrainage ------------------------- */

{
  const [lien, recrue, cartes] = textesParrainage();
  assert.equal(textesParrainage().length, 3, "le parrainage s'annonce en trois diapos");
  assert.deepEqual(lien, { titre: "Ramène tes potes.", ligne: "Ton lien ouvre ta carte." }, "la diapo 1");
  assert.deepEqual(recrue, { titre: "Une recrue, +100 XP.", ligne: "Elle compte dès son premier match joué. Sans plafond." }, "la diapo 2");
  const sansInsecable = (t: string) => t.replace(/\u00a0/g, " ");
  assert.equal(sansInsecable(cartes.titre), "À 10, la carte Fondateur.", "le titre de la diapo 3");
  assert.equal(sansInsecable(cartes.ligne), "Recruteur à 3, Filigrane à 5. Fondateur à 10 : numérotée sur 500, jamais réémise.", "la ligne de la diapo 3");
  assert.ok(cartes.titre.includes("la\u00a0carte"), "le titre se coupe « À 10, / la carte Fondateur. », pas après « la »");
  assert.ok(cartes.ligne.includes("à\u00a010\u00a0:"), "« à 10 : » ne se coupe pas");
  for (const t of textesParrainage()) assert.ok(t.ligne.length <= 90 && !/\n/.test(t.ligne), "une ligne courte sous chaque titre");
  assert.ok(lien.ligne.length <= 26, "la ligne de la diapo 1 tient sur une ligne (petits écrans)");
  // Rien en dur à côté de la table : un palier qui bouge bouge l'annonce.
  assert.deepEqual(paliersSkins().map((p) => [p.n, p.titre]), [[3, "Recruteur"], [5, "Filigrane"], [10, "Fondateur"]], "les paliers à skin, du plus bas au plus haut");
  assert.deepEqual(paliersSkins().map((p) => p.n), PALIERS_RECRUES.filter((p) => p.finition).map((p) => p.n), "les paliers de l'annonce sont ceux de la table");
  const autres: PalierRecrues[] = PALIERS_RECRUES.map((p) => (p.finition === "recruteur" ? { ...p, n: 4 } : p.finition === "fondateur" ? { ...p, n: 12 } : p));
  const [, , bouge] = textesParrainage(autres);
  assert.equal(sansInsecable(bouge.titre), "À 12, la carte Fondateur.", "le titre suit la table");
  assert.ok(sansInsecable(bouge.ligne).startsWith("Recruteur à 4, Filigrane à 5. Fondateur à 12 :"), "la ligne suit la table");
  assert.equal(recrue.titre, `Une recrue, +${XP_RECRUE} XP.`, "l'XP d'une recrue vient de la table");
  assert.ok(cartes.ligne.includes(`sur ${FONDATEURS_MAX}`), "les places de Fondateur viennent de la table");

  // Ce que dit la carte de la diapo 1.
  assert.deepEqual(lignesInvitation("Toi", false), { invite: "Toi t'invite.", offert: "Bola Team offert un mois" }, "le lien d'un joueur de la SFL offre Bola Team");
  assert.deepEqual(lignesInvitation("Toi", true), { invite: "Toi t'invite.", offert: null }, "le lien d'un joueur Bola n'offre pas Bola Team");

  // Le numéro de la carte Fondateur.
  assert.equal(numeroAnnonce(42, true, 60), 42, "mon numéro, si j'en ai un");
  assert.equal(numeroAnnonce(42, false, 0), 42, "mon numéro, même avant la réponse de la base");
  assert.equal(numeroAnnonce(null, false, 0), NUMERO_EXEMPLE, "la base n'a pas répondu : l'exemple");
  assert.equal(NUMERO_EXEMPLE, 97, "l'exemple est celui de skins-recrues.ts (097)");
  assert.equal(numeroAnnonce(null, true, 0), 1, "aucun Fondateur : le n° 001 est le prochain");
  assert.equal(numeroAnnonce(null, true, 12), 13, "le prochain à poser : le plus haut numéro posé, plus un");
  assert.equal(numeroAnnonce(null, true, FONDATEURS_MAX), FONDATEURS_MAX, "jamais au-delà des places");
  assert.equal(numeroSeul(1), "N° 001 / 500", "le numéro seul, sous « Fondateur »");
  assert.ok(numeroFondateur(97).endsWith(numeroSeul(97)) && numeroFondateur(97).startsWith("FONDATEUR"), "c'est la fin de la ligne de série de la carte");
}

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

// Les trois diapos du parrainage lisent les textes purs, sans rien réécrire en dur.
const diapos = source("src/components/sfl/nouveautes/parrainage.tsx");
const diaposCode = diapos.replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
assert.match(diaposCode, /const \[lien, recrue, cartes\] = textesParrainage\(\);/, "les titres et les lignes viennent de textesParrainage");
assert.equal((diaposCode.match(/visuel: </g) ?? []).length, 3, "le parrainage s'annonce en trois diapos");
assert.ok(!/titre:\s*["`]|ligne:\s*["`]/.test(diaposCode), "un titre ou une ligne écrit en dur dans parrainage.tsx");
assert.match(diaposCode, /lignesInvitation\(useIdentites\(\)\.nom\(player\.name\), bola\)/, "la diapo 1 dit qui invite, et sait si c'est un joueur Bola");
assert.match(diaposCode, /\{offert && </, "« Bola Team offert un mois » ne s'affiche que s'il est offert");
assert.ok(!/Bola Team|t'invite/.test(diaposCode), "le texte de la carte de la diapo 1 est écrit en dur dans parrainage.tsx");
assert.match(diaposCode, /const numero = numeroAnnonce\(mien, recrues\.charge, recrues\.plusHaut\);/, "le numéro de la diapo 3 : le mien, sinon le prochain à poser");
assert.match(diaposCode, /fondateur: p\.finition === "fondateur" \? numero : undefined/, "la carte Fondateur porte ce numéro");
assert.match(diaposCode, /\{numeroSeul\(numero\)\}/, "et il est écrit sous « Fondateur »");
assert.ok(!diaposCode.includes("numeroFondateur"), "« FONDATEUR » ne s'écrit pas deux fois sous la carte");
assert.equal((diaposCode.match(/\+\{XP_RECRUE\}/g) ?? []).length, 1, "le journal de la diapo 2 compte +XP_RECRUE par recrue");
assert.ok(!/[>"`]\s*\+\d/.test(diaposCode), "un gain écrit en dur dans parrainage.tsx");
assert.match(source("src/lib/sfl/recrues-store.ts"), /^\s*plusHaut,$/m, "le plus haut numéro de Fondateur posé est gardé dans l'état des recrues");
// L'annonce ne crée pas de code et ne note aucun partage : la page Inviter le fait.
for (const interdit of ["monCode", "mon_code_parrain", "noterPartage", "publierMaCarte", "navigator.share"]) {
  assert.ok(!new RegExp(`\\b${interdit.replace(".", "\\.")}\\b`).test(diapos.replace(/^\s*\/\/.*$/gm, "")), `l'annonce ne doit pas appeler ${interdit}`);
}

// Le parrainage n'est pas annoncé deux fois : l'ancienne diapo est partie.
const ancienne = source("src/components/sfl/nouveautes/nouveautes-27-10.tsx");
assert.ok(!/titre:\s*"Invite\. Monte\."/.test(ancienne), "« Invite. Monte. » est encore une diapo de l'annonce du 27/10");
assert.ok(!ancienne.includes("PaliersRecrues"), "le visuel des paliers est encore dans l'annonce du 27/10");
assert.equal((ancienne.match(/^\s*titre:/gm) ?? []).length, 2, "l'annonce du 27/10 garde ses deux autres diapos");

// Le diaporama branche chaque geste sur son bouton : « aller » ferme (la vue
// est notée) puis ouvre la page, « fermer » ferme sans y aller.
const diaporama = source("src/components/sfl/nouveautes/diaporama.tsx");
assert.match(diaporama, /const \{ principal, discret \} = gestesDeFin\(derniere, aller\);/, "les deux boutons suivent gestesDeFin");
assert.match(diaporama, /function yAller\(\) \{\n\s*onFini\(\);\n\s*if \(aller\) router\.push\(aller\.href\);\n\s*\}/, "« y aller » ferme l'annonce (elle est vue) puis ouvre la page");
assert.match(
  diaporama,
  /const faire: Record<GesteNouveaute, \(\) => void> = \{ suivant: \(\) => vers\(i \+ 1\), fermer: onFini, aller: yAller \};/,
  "chaque geste a son action : la diapo suivante, fermer, fermer et y aller"
);
assert.match(diaporama, /<BoutonPrincipal ton=\{principal\.ton\} onClick=\{faire\[principal\.geste\]\}>\s*\{principal\.label\}/, "le bouton principal porte son ton, son geste et son nom");
assert.match(diaporama, /<BoutonDiscret onClick=\{discret \? faire\[discret\.geste\] : \(\) => \{\}\}>\{discret\?\.label \?\? " "\}/, "le bouton discret porte son geste et son nom");
assert.ok(!/ton="|allerDAbord/.test(diaporama), "un ton ou une règle de bouton écrits en dur dans diaporama.tsx");

// nouveauteAMontrer ne fait que lire et écrire ce que choisirNouveaute décide.
const registre = source("src/lib/sfl/nouveautes.ts");
const lecture = registre.slice(registre.indexOf("export async function nouveauteAMontrer"), registre.indexOf("/** La nouveauté est vue : sur cet appareil"));
assert.match(lecture, /choisirNouveaute\(NOUVEAUTES, maintenant, \{ ligue, bola \}, window\.location\.pathname, \(id\) => vueIci\(id, nom\), profil\)/, "le choix lit le vrai registre, le public, la page ouverte et ce que sait l'appareil");
assert.match(lecture, /for \(const id of ici\.aNoterVues\) void noterNouveauteVue\(id, nom\);/, "sur place : notée vue");
assert.match(lecture, /if \(!ici\.aMontrer\) return null;/, "rien à montrer : rien, sans lire la base");
assert.match(lecture, /const choix = choisir\(await lireProfil\(\)\);/, "puis avec ce que sait la base");
assert.match(lecture, /return choix\.aMontrer;/, "ce que le choix a décidé");
assert.equal((lecture.match(/nouveautesEnCours|estSurPlace/g) ?? []).length, 0, "nouveauteAMontrer ne refait pas le choix à la main");

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
