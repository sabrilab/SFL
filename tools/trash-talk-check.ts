// Vérifie les règles pures du trash talk (Sabri, 12/11/2026 : « un texte […]
// transformé automatiquement en visuel style tweet ou article » ;
// lib/sfl/trash-talk.ts). La phrase publiée (une ligne, 180 caractères), la
// journée sur laquelle on écrit (la dernière jouée du dimanche soir au
// mercredi, sinon celle qui vient, jamais une journée en suspens), le corps
// du texte par paliers, les @pseudo découpés, les lignes des deux visuels, ce
// que le menu « ⋯ » propose à chacun (auteur, cité, membre, admin, post
// masqué), ce qui peut sortir de l'app (l'accord hors-app de l'auteur ET de
// chaque cité), le fil de chacun, l'ordre de l'admin, les noms de fichiers.
// Les droits eux-mêmes sont tenus par la base : tools/sql/trash-talk-check.sql.
//   npx tsx tools/trash-talk-check.ts
import assert from "node:assert/strict";
import {
  citer,
  corpsDuTexte,
  decouperCitations,
  direRefus,
  gestesPossibles,
  ilYA,
  journeeDuTrashTalk,
  ligneDEdition,
  ligneDuPost,
  LONGUEUR_PHRASE,
  longueurPhrase,
  matchDuJoueur,
  nettoyerPhrase,
  nomDeFichier,
  ordreAdmin,
  palierDeLongueur,
  peutSortir,
  phraseEnCours,
  postsDuFil,
  pseudosVises,
  type TrashTalk,
} from "../src/lib/sfl/trash-talk";

// ── La phrase ──
assert.equal(nettoyerPhrase("  Dimanche \n on règle\tça.  "), "Dimanche on règle ça.");
assert.equal(nettoyerPhrase(" \n "), "");
assert.equal(longueurPhrase(nettoyerPhrase("a".repeat(300))), LONGUEUR_PHRASE);
assert.equal(longueurPhrase(nettoyerPhrase("🔥".repeat(200))), LONGUEUR_PHRASE, "un émoji compte pour un caractère, jamais coupé en deux");
assert.equal(nettoyerPhrase("a".repeat(179) + " b"), "a".repeat(179), "pas d'espace laissée en fin après la coupe");
assert.equal(phraseEnCours("Salut\ntoi  "), "Salut toi ", "pendant la frappe, l'espace de fin reste");
assert.equal(longueurPhrase(phraseEnCours("x".repeat(500))), LONGUEUR_PHRASE);

// ── Les citations ──
assert.deepEqual(decouperCitations("Hé @Souley, et @sami.b ?"), [
  { texte: "Hé ", cite: false },
  { texte: "@Souley", cite: true },
  { texte: ", et ", cite: false },
  { texte: "@sami.b", cite: true },
  { texte: " ?", cite: false },
]);
assert.deepEqual(decouperCitations("rien"), [{ texte: "rien", cite: false }]);
assert.deepEqual(decouperCitations(""), []);
assert.equal(decouperCitations("a@b @x c").map((m) => m.texte).join(""), "a@b @x c", "rien ne se perd au découpage");
assert.deepEqual(pseudosVises("@A1 @a1 @b2 @c3 @d4 @e5 @f6"), ["a1", "b2", "c3", "d4", "e5"], "cinq cités au plus, sans doublon");
assert.equal(citer("", "@Souley"), "@souley ");
assert.equal(citer("Dimanche ", "souley"), "Dimanche @souley ");
assert.equal(citer("x".repeat(176), "souley"), "x".repeat(176), "sans place, la phrase ne bouge pas");

// ── La journée du moment ──
const d = (j: number, iso: string | null) => ({ j, iso });
// Dimanche 8 nov. joué (J5), la J6 vient le 15.
assert.equal(journeeDuTrashTalk({ derniere: d(5, "2026-11-08"), prochaine: { j: 6, suspens: false }, aujourdhui: "2026-11-08" }), 5, "dimanche soir : la journée jouée");
assert.equal(journeeDuTrashTalk({ derniere: d(5, "2026-11-08"), prochaine: { j: 6, suspens: false }, aujourdhui: "2026-11-11" }), 5, "mercredi : encore elle");
assert.equal(journeeDuTrashTalk({ derniere: d(5, "2026-11-08"), prochaine: { j: 6, suspens: false }, aujourdhui: "2026-11-12" }), 6, "jeudi : celle qui vient");
assert.equal(journeeDuTrashTalk({ derniere: d(5, "2026-11-08"), prochaine: { j: 6, suspens: false }, aujourdhui: "2026-11-15" }), 6, "le dimanche du match, avant ses résultats : celle qui vient");
assert.equal(journeeDuTrashTalk({ derniere: d(5, "2026-11-08"), prochaine: { j: 6, suspens: true }, aujourdhui: "2026-11-13" }), null, "une journée en suspens : personne n'écrit");
assert.equal(journeeDuTrashTalk({ derniere: d(5, "2026-11-08"), prochaine: { j: 6, suspens: true }, aujourdhui: "2026-11-10" }), 5, "en suspens ensuite, mais la dernière jouée reste ouverte jusqu'au mercredi");
assert.equal(journeeDuTrashTalk({ derniere: d(5, "2026-11-08"), prochaine: null, aujourdhui: "2026-11-20" }), null, "rien de joué récemment, rien qui vient");
assert.equal(journeeDuTrashTalk({ derniere: null, prochaine: { j: 1, suspens: false }, aujourdhui: "2026-11-20" }), 1, "avant la première journée");
assert.equal(journeeDuTrashTalk({ derniere: d(5, null), prochaine: { j: 6, suspens: false }, aujourdhui: "2026-11-09" }), 6, "une date illisible ne bloque rien");
assert.equal(journeeDuTrashTalk({ derniere: d(5, "2026-11-08"), prochaine: null, aujourdhui: "2026-11-07" }), null, "une date à venir n'est pas « jouée »");

// ── Mon match ──
const t = (a: string[], b: string[]) => ({ a: { joueurs: a }, b: { joueurs: b } });
assert.equal(matchDuJoueur([t(["Ana"], ["Bea"]), t(["Cy"], ["Moi"])], "Moi"), 2);
assert.equal(matchDuJoueur([t(["Ana"], ["Moi"])], "Moi"), null, "un seul match : pas de numéro");
assert.equal(matchDuJoueur([t(["Ana"], ["Bea"]), t(["Cy"], ["Dan"])], "Moi"), null, "je ne joue pas : pas de numéro");
assert.equal(matchDuJoueur([], "Moi"), null);

// ── Le corps du texte ──
assert.deepEqual([0, 40, 41, 80, 81, 130, 131, 180].map(palierDeLongueur), [0, 0, 1, 1, 2, 2, 3, 3]);
for (const format of ["tweet", "une"] as const)
  for (const gabarit of ["fil", "post", "story"] as const) {
    const corps = [10, 60, 100, 180].map((n) => corpsDuTexte("a".repeat(n), format, gabarit));
    assert.ok(corps.every((c, i) => i === 0 || c < corps[i - 1]), `${format} ${gabarit} : plus la phrase est longue, plus le corps est petit`);
    assert.ok(corps[3] >= 19, `${format} ${gabarit} : lisible même à 180 caractères`);
  }
assert.ok(corpsDuTexte("court", "tweet", "story") > corpsDuTexte("court", "tweet", "post"), "la story a plus de place");
assert.equal(corpsDuTexte("court", "une", "fil"), corpsDuTexte("court", "une", "post"), "le post est le visuel du fil, à l'identique");

// ── Les lignes des visuels (heure de Paris) ──
const at = Date.parse("2026-11-08T13:32:00Z");
assert.equal(ligneDuPost({ j: 5, match: 2, at }), "J5 · Match 2 · dim. 8 nov. · 14:32");
assert.equal(ligneDuPost({ j: 5, match: null, at }), "J5 · dim. 8 nov. · 14:32", "sans match connu, pas de « Match »");
assert.equal(ligneDEdition({ j: 5, at, id: 12 }), "J5 · dimanche 8 novembre 2026 · N° 12");
assert.equal(ligneDEdition({ j: 5, at, id: 0 }), "J5 · dimanche 8 novembre 2026", "pas encore publié : pas de numéro");
assert.equal(ligneDuPost({ j: 5, match: null, at: Date.parse("2026-11-08T23:30:00Z") }), "J5 · lun. 9 nov. · 00:30", "minuit passé à Paris");
assert.equal(ilYA(at, at + 20_000), "à l'instant");
assert.equal(ilYA(at, at + 12 * 60_000), "il y a 12 min");
assert.equal(ilYA(at, at + 2 * 3600_000 + 5), "il y a 2 h");
assert.equal(ilYA(at, at + 3 * 86400_000), "8 nov.");
assert.equal(nomDeFichier(5, "story"), "trash-talk-j5-story-bola.png");
assert.equal(nomDeFichier(12, "post"), "trash-talk-j12-post-bola.png");

// ── Le menu « ⋯ » ──
const post = (p: Partial<TrashTalk> = {}): TrashTalk => ({
  id: 1,
  joueur: "auteur",
  nom: "Souley",
  pseudo: "souley",
  saison: 1,
  j: 5,
  match: null,
  format: "tweet",
  texte: "Hé @sami",
  vises: ["cite"],
  masque: null,
  at,
  partageable: false,
  signale: false,
  signalements: 0,
  ...p,
});
assert.deepEqual(gestesPossibles(post(), "auteur", false), ["retirer"], "l'auteur retire, rien d'autre");
assert.deepEqual(gestesPossibles(post(), "cite", false), ["masquer"], "un joueur cité masque");
assert.deepEqual(gestesPossibles(post(), "membre", false), ["signaler"], "un membre signale");
assert.deepEqual(gestesPossibles(post({ signale: true }), "membre", false), [], "déjà signalé : plus rien");
assert.deepEqual(gestesPossibles(post(), "admin", true), ["masquer"]);
assert.deepEqual(gestesPossibles(post({ masque: "cite" }), "admin", true), ["remettre"], "l'admin remet un post masqué");
assert.deepEqual(gestesPossibles(post({ masque: "cite" }), "auteur", false), ["retirer"], "masqué, l'auteur peut encore le retirer, pas le remettre");
assert.deepEqual(gestesPossibles(post({ masque: "signalements" }), "cite", false), [], "déjà masqué : un cité n'a plus de geste");
assert.deepEqual(gestesPossibles(post(), null, false), [], "sans compte, aucun geste");
assert.deepEqual(gestesPossibles(post({ joueur: "admin", masque: "signalements" }), "admin", true), ["remettre", "retirer"]);
assert.ok(!gestesPossibles(post(), "auteur", false).includes("signaler"), "on ne signale pas son propre post");
assert.ok(!gestesPossibles(post(), "membre", false).includes("masquer"), "un membre non cité ne masque pas");
assert.ok(!gestesPossibles(post({ masque: "admin" }), "cite", false).includes("remettre"), "seul l'admin remet");
assert.ok(!gestesPossibles(post(), "cite", false).includes("retirer"), "seul l'auteur retire dans le fil");

// ── Sortir de l'app ──
assert.equal(peutSortir(true, []), true);
assert.equal(peutSortir(true, [true, true]), true);
assert.equal(peutSortir(false, []), false, "sans l'accord de l'auteur, rien ne sort");
assert.equal(peutSortir(true, [true, false]), false, "un seul cité sans accord suffit à tout retenir");
assert.equal(peutSortir(true, [null]), false, "un accord inconnu compte pour un non");
assert.equal(peutSortir(null, []), false);
assert.equal(peutSortir(undefined, [true]), false);

// ── Le fil de chacun ──
const fil = [
  post({ id: 1 }),
  post({ id: 2, masque: "cite" }),
  post({ id: 3, signale: true }),
  post({ id: 4, j: 6 }),
  post({ id: 5, joueur: "membre", vises: [] }),
];
const ids = (l: TrashTalk[]) => l.map((p) => p.id);
assert.deepEqual(ids(postsDuFil(fil, 5, "membre", false)), [5, 1], "ni le masqué, ni celui que j'ai signalé ; le plus récent d'abord");
assert.deepEqual(ids(postsDuFil(fil, 5, "auteur", false)), [5, 3, 2, 1], "l'auteur garde le sien, même masqué");
assert.deepEqual(ids(postsDuFil(fil, 5, "admin", true)), [5, 3, 2, 1], "l'admin voit tout");
assert.deepEqual(ids(postsDuFil(fil, 6, "membre", false)), [4], "chaque journée a les siens");
assert.deepEqual(ids(postsDuFil(fil, 7, "membre", false)), []);

// ── L'ordre de l'admin ──
assert.deepEqual(
  ids(ordreAdmin([post({ id: 1 }), post({ id: 2, signalements: 1 }), post({ id: 3 }), post({ id: 4, masque: "admin" })])),
  [4, 2, 3, 1],
  "signalés ou masqués d'abord, puis les récents"
);

// ── Les refus de la base ──
assert.equal(direRefus({ code: "P0001", message: "Trois par journée." }), "Trois par journée.");
assert.equal(direRefus({ code: "42501", message: 'new row violates row-level security policy for table "trash_talks"' }), "Tu ne peux pas publier pour l'instant.");
assert.equal(direRefus(new Error("réseau")), null, "le reste garde le message habituel");

console.log("trash-talk: ok");
