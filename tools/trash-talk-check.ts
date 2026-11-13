// Vérifie les règles pures du trash talk (Sabri, 12/11/2026 : « un texte […]
// transformé automatiquement en visuel style tweet ou article » ;
// lib/sfl/trash-talk.ts). La phrase publiée (une ligne, 180 caractères), la
// journée sur laquelle on écrit (la dernière jouée du dimanche soir au
// mercredi, sinon celle qui vient, jamais une journée en suspens), le corps
// du texte par paliers, les @pseudo découpés, les lignes des deux visuels, ce
// que le menu « ⋯ » propose à chacun (auteur, cité, membre, admin, post
// masqué), ce qui peut sortir de l'app (l'accord hors-app de l'auteur ET de
// chaque cité), le fil de chacun, l'ordre de l'admin, les noms de fichiers,
// et la lecture : une ligne de la base devenue un post (masqué, remis,
// signalé, partageable), la jointure qui nomme son lien vers profiles, ce
// qu'on montre sans les tables (rien en production).
// Les droits eux-mêmes sont tenus par la base : tools/sql/trash-talk-check.sql.
//   npx tsx tools/trash-talk-check.ts
import assert from "node:assert/strict";
import {
  CHASSE,
  citer,
  COLONNES,
  corpsDuTexte,
  decouperCitations,
  direRefus,
  espacesInsecables,
  gestesPossibles,
  ilYA,
  INTERLIGNE,
  journeeDuTrashTalk,
  lectureSansTable,
  lignesDeLaPhrase,
  limiteAtteinte,
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
  postDeLigne,
  postsDuFil,
  pseudosVises,
  type LigneTrashTalk,
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
assert.deepEqual(pseudosVises("@A1 @a1 @b2 @c3 @d4 @e5 @f6"), ["a1", "b2", "c3", "d4", "e5", "f6"], "tous les cités, sans doublon : le septième est protégé comme le premier");
// Le pseudo en fin de phrase : le point n'en fait pas partie.
assert.deepEqual(decouperCitations("T'es nul @sami."), [
  { texte: "T'es nul ", cite: false },
  { texte: "@sami", cite: true },
  { texte: ".", cite: false },
]);
assert.deepEqual(pseudosVises("T'es nul @sami."), ["sami"]);
assert.deepEqual(pseudosVises("@sami... @Sami- @sami_ @sami"), ["sami"], "points de suspension, tiret, soulignement : le même joueur");
assert.deepEqual(pseudosVises("@sami.b et @a.b."), ["sami.b", "a.b"], "un point au milieu d'un pseudo reste");
assert.equal(decouperCitations("Hé @sami... tu viens ?").map((m) => m.texte).join(""), "Hé @sami... tu viens ?", "rien ne se perd au découpage");
assert.deepEqual(decouperCitations("@.. rien"), [{ texte: "@.. rien", cite: false }], "que de la ponctuation : pas une citation");
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
    const corps = [10, 60, 100, 180].map((n) => corpsDuTexte("abcd ".repeat(40).slice(0, n).trim(), format, gabarit));
    assert.ok(corps.every((c, i) => i === 0 || c < corps[i - 1]), `${format} ${gabarit} : plus la phrase est longue, plus le corps est petit`);
    assert.ok(corps[3] >= 15, `${format} ${gabarit} : lisible même à 180 caractères`);
  }
// Une phrase courante garde le corps de son palier.
assert.equal(corpsDuTexte("Noirs 1, invaincus. Venez nous chercher.", "tweet", "fil"), 36);
assert.equal(corpsDuTexte("Les Blancs reviennent dimanche. Prévenez les Noirs.", "une", "fil"), 33);
// Un mot plus long que la ligne : le corps se réduit jusqu'à ce qu'il tienne, au lieu de le couper.
const sansFin = "Anticonstitutionnellementissime";
for (const format of ["tweet", "une"] as const) {
  const corps = corpsDuTexte(sansFin, format, "fil");
  assert.ok(corps < corpsDuTexte("Court", format, "fil"), `${format} : un mot de 31 lettres réduit le corps`);
  assert.ok(corps >= 13, `${format} : sans passer sous le corps minimal`);
}
assert.ok(corpsDuTexte("x".repeat(180), "une", "fil") >= 13, "un mot sans fin : le corps minimal, jamais moins");
assert.equal(espacesInsecables("Qui ? Moi : non ! Si ; « oui »"), "Qui\u00a0? Moi\u00a0: non\u00a0! Si\u00a0; «\u00a0oui\u00a0»", "jamais une ligne qui commence par un deux-points");
assert.equal(espacesInsecables("Hé @sami. Ça va"), "Hé @sami. Ça va", "le reste ne bouge pas");
assert.deepEqual(decouperCitations(espacesInsecables("Alors @sami ?")).filter((m) => m.cite), [{ texte: "@sami", cite: true }], "la citation reste entière");
// 180 capitales larges à la une : les lignes tiennent dans la hauteur de la place.
{
  const phrase = Array.from({ length: 30 }, () => "MAMAN").join(" ");
  const corps = corpsDuTexte(phrase, "une", "fil");
  const lignes = lignesDeLaPhrase(`«${phrase}»`.split(" "), Math.floor(304 / (corps * CHASSE.une)));
  assert.ok(lignes !== null && lignes * corps * INTERLIGNE.une <= 218, "la une de 180 signes tient dans sa place");
  assert.ok(corps < 22, "… en réduisant le corps du dernier palier");
}
assert.equal(lignesDeLaPhrase(["aaa", "bbb", "ccc"], 7), 2, "« aaa bbb » puis « ccc »");
assert.equal(lignesDeLaPhrase(["aaa", "bbb"], 3), 2);
assert.equal(lignesDeLaPhrase(["aaaa"], 3), null, "un mot plus long que la ligne");
assert.ok(INTERLIGNE.une >= 1.04, "la une en capitales accentuées : jamais des lignes qui se touchent");
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
  remis: false,
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
assert.deepEqual(gestesPossibles(post({ remis: true }), "cite", false), ["signaler"], "remis par l'admin : un cité ne le masque plus, il le signale");
assert.deepEqual(gestesPossibles(post({ remis: true }), "admin", true), ["masquer"], "l'admin peut encore le masquer");

// ── Trois par journée ──
const miens = [post({ id: 1, joueur: "moi" }), post({ id: 2, joueur: "moi", masque: "cite" }), post({ id: 3, joueur: "moi" }), post({ id: 4, joueur: "moi", j: 6 })];
assert.equal(limiteAtteinte(miens, 5, "moi"), true, "trois sur la journée, le masqué compris : « Écrire » s'éteint");
assert.equal(limiteAtteinte(miens, 6, "moi"), false);
assert.equal(limiteAtteinte(miens, 5, "autre"), false);
assert.equal(limiteAtteinte(miens.slice(1), 5, "moi"), false, "deux : on écrit encore");
assert.equal(limiteAtteinte(miens, 5, null), false);

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
  ids(ordreAdmin([post({ id: 1 }), post({ id: 2, signalements: 1 }), post({ id: 3 }), post({ id: 4, masque: "admin" }), post({ id: 5, signalements: 3, remis: true })])),
  [4, 2, 5, 3, 1],
  "signalés ou masqués d'abord, puis les récents ; un post remis ne demande plus de regard"
);

// ── La lecture : une ligne de la base devient un post ──
assert.match(COLONNES, /profiles!trash_talks_joueur_fkey\s*\(/, "deux liens vers profiles (auteur, masqué par) : la jointure nomme celui de l'auteur");
assert.ok(!/[, ]profiles\s*\(/.test(COLONNES), "jamais une jointure profiles sans son lien");
const ligne = (l: Partial<LigneTrashTalk> = {}): LigneTrashTalk => ({
  id: 7,
  joueur: "auteur",
  saison: 1,
  j: 5,
  match: 2,
  format: "une",
  texte: "Hé @sami",
  vises: ["cite"],
  masque_le: null,
  masque_motif: null,
  remis_le: null,
  created_at: "2026-11-08T13:32:00Z",
  profiles: { name: "Souley", username: "@souley" },
  ...l,
});
const signalements = [
  { post: 7, joueur: "membre" },
  { post: 7, joueur: "autre" },
  { post: 8, joueur: "membre" },
];
const lu = (l: Partial<LigneTrashTalk>, qui: string | null, admin = false, partageables: number[] = [7]) =>
  postDeLigne(ligne(l), { moi: qui, admin, partageables: new Set(partageables), signalements: admin ? signalements : signalements.filter((s) => s.joueur === qui) });
assert.deepEqual(lu({}, "membre"), {
  id: 7,
  joueur: "auteur",
  nom: "Souley",
  pseudo: "souley",
  saison: 1,
  j: 5,
  match: 2,
  format: "une",
  texte: "Hé @sami",
  vises: ["cite"],
  masque: null,
  remis: false,
  at,
  partageable: true,
  signale: true,
  signalements: 0,
});
assert.equal(lu({}, "membre").signalements, 0, "un membre ne sait pas combien l'ont signalé");
assert.equal(lu({}, "admin", true).signalements, 2, "l'admin les compte");
assert.equal(lu({}, "admin", true).signale, false, "… sans passer pour l'un d'eux");
assert.equal(lu({}, "cite").signale, false);
assert.equal(lu({}, null).signale, false, "sans compte, rien n'est dit signalé");
assert.equal(lu({ masque_le: "2026-11-08T14:00:00Z", masque_motif: "cite" }, "auteur").masque, "cite", "un post masqué se lit masqué");
assert.equal(lu({ masque_le: "2026-11-08T14:00:00Z", masque_motif: null }, "auteur").masque, "admin", "sans motif : l'admin");
assert.equal(lu({ masque_le: null, masque_motif: "cite" }, "auteur").masque, null, "le motif seul ne masque pas");
assert.equal(lu({ masque_le: "2026-11-08T14:00:00Z", masque_motif: "cite" }, "auteur").partageable, false, "masqué : il ne sort pas, quoi qu'on en dise");
assert.equal(lu({}, "membre", false, []).partageable, false, "la base n'a pas dit oui : il ne sort pas");
assert.equal(lu({ remis_le: "2026-11-09T10:00:00Z" }, "cite").remis, true);
assert.equal(lu({ vises: null }, "membre").vises.length, 0);
assert.equal(lu({ profiles: [{ name: "Souley", username: "souley" }] }, "membre").pseudo, "souley", "la jointure rendue en liste");
assert.equal(lu({ profiles: null }, "membre").nom, "?", "un profil illisible n'empêche pas de lire");
assert.deepEqual(gestesPossibles(lu({ remis_le: "2026-11-09T10:00:00Z" }, "cite"), "cite", false), ["signaler"]);

// ── Sans les tables ──
const gardes = [post({ id: 1, joueur: "moi", texte: "Tout seul", vises: [] }), post({ id: 2, joueur: "moi", texte: "Hé @sami", vises: [] }), post({ id: 3, joueur: "moi", saison: 2, texte: "Ailleurs", vises: [] })];
assert.deepEqual(lectureSansTable(true, gardes, 1, true, "compte"), { etat: "absent", posts: [], moi: "compte" }, "en production, sans table : rien, pas même mes posts gardés");
const apercu = lectureSansTable(false, gardes, 1, true, "compte");
assert.equal(apercu.etat, "demo");
assert.equal(apercu.moi, "moi", "dans un aperçu, l'auteur est « moi »");
assert.deepEqual(ids(apercu.posts), [1, 2], "les posts de la saison seulement");
assert.equal(apercu.posts[0].partageable, true, "mon post, mon accord : il sort");
assert.equal(apercu.posts[1].partageable, false, "il cite un joueur dont personne n'a l'accord : il ne sort pas");
assert.equal(lectureSansTable(false, gardes, 1, false, "compte").posts[0].partageable, false, "sans mon accord, rien ne sort");

// ── Les refus de la base ──
assert.equal(direRefus({ code: "P0001", message: "Trois par journée." }), "Trois par journée.");
assert.equal(direRefus({ code: "42501", message: 'new row violates row-level security policy for table "trash_talks"' }), "Tu ne peux pas publier pour l'instant.");
assert.equal(direRefus(new Error("réseau")), null, "le reste garde le message habituel");

console.log("trash-talk: ok");
