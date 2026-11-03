// Un joueur qui cumule les titres d'un dimanche les voit tous. Ilyes,
// 02/11/2026 : un Impact et une Défensive pour chaque équipe, le MVP unique au
// match, et « oui, un joueur peut avoir la Défensive et l'Impact le même
// jour » (et le MVP en plus). Le calcul les posait déjà tous (votes.ts,
// puces, cartes, points) ; des textes n'en gardaient qu'un, reste du temps où
// il n'y avait qu'un titre par match.
//
// Le cas réel : Youss à la J4, Match 1, Noirs 1 (défaite, doublé et 3 passes),
// Joueur Impact (3 voix) et Défensive (2 voix) de son équipe. Les comptes de
// voix sont ceux du 1er novembre ; les votants sont inventés (jamais qui a
// voté pour qui). Et le triple d'Anas (Noirs 3) : MVP, Impact et Défensive.
//
// Ce que le banc vérifie, dans l'ordre des puces (MVP, Impact, Défensive) :
//   1 · les faits marquants de sa fiche (fiche-joueur.ts, faitDuJour) : tous
//       ses titres dans la même ligne, et chacun pèse ;
//   2 · son dimanche dans Ma saison (dimanchesDe, phraseDuJour) : l'Impact
//       et le Mur « de ton équipe », jamais « du match » ;
//   3 · la notification des résultats (annonces-ligue.ts) : ses titres
//       d'équipe, et « Tes 3 cartes » pour le MVP qui cumule ;
//   4 · la notification d'un bravo sur plusieurs de ses exploits
//       (exploits.ts, quoiDesExploits, pour /api/felicitations) : tous ;
//   5 · le débrief de Bola Agent (agent.ts) : tous ses titres du jour ;
//   6 · les écrans, par leur calcul pur (titres-ecrans.ts) : la ligne des
//       tops et le « repart avec » du récap, ses cartes du jour (la J1 sans
//       les J10 à J19), l'étiquette du palmarès de la Gazette, les cartes et
//       pastilles du mode « Titres » de la synthèse, la ligne des Actus (les
//       ex æquo équipe par équipe), « de ton équipe » dans Ma saison ;
//   7 · la notification d'un bravo (felicitations-notif.ts, pour la route) :
//       une par joueur, tous ses exploits dans l'ordre des puces même s'ils
//       arrivent dans le désordre, l'XP de chacun sous les plafonds, toute
//       une rubrique acceptée d'un coup ;
//   8 · le poids d'un fait marquant : un dimanche à deux titres passe devant
//       des dimanches à un doublé et deux passes ; « Le Mur » ne se coupe pas ;
//   9 · Mes cartes : quand un joueur a plus de cartes du jour que la rangée
//       n'en montre, la carte coupée au bord se voit (rangee-qui-defile.ts).
//   npx tsx tools/titres-cumul-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dossierJoueur, questionDebrief } from "../src/lib/sfl/agent";
import { texteResultats } from "../src/lib/sfl/annonces-ligue";
import { exploitsDeLaSaison, quoiDesExploits } from "../src/lib/sfl/exploits";
import { dimanchesDe, ficheJoueur, phraseDuJour } from "../src/lib/sfl/fiche-joueur";
import { definirArbitres } from "../src/lib/sfl/hidden";
import { computeJournees, deriveSeason } from "../src/lib/sfl/saisie/engine";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { appliquerVotes, type CategorieVote, type VoteFigure } from "../src/lib/sfl/votes";
import { titresDuDimanche } from "../src/lib/sfl/actus";
import type { BoostType } from "../src/lib/sfl/engine";
import { cleExploit, type Exploit, type Famille } from "../src/lib/sfl/exploits";
import { NOM_TITRE } from "../src/lib/sfl/fiche-joueur";
import {
  compteXp,
  exploitsDemandes,
  MAX_EXPLOITS_PAR_BRAVO,
  notificationsDesBravos,
  type Recue,
} from "../src/lib/sfl/felicitations-notif";
import {
  cartesDeLaJournee,
  etiquetteDuPalmares,
  motsDuTop,
  pastilleDesTitres,
  repartAvec,
  texteDesTitres,
  titreEnGrand,
  titresDeLaSynthese,
} from "../src/lib/sfl/titres-ecrans";
import { decalageQuiDepasse, DEPASSE } from "../src/lib/rangee-qui-defile";

definirArbitres([]);
const J = 4;
/** Bien après la J4 : ses votes sont tombés. */
const LOIN = new Date(2030, 0, 1);
/** Deux jours après la J4 : le débrief du coach est encore frais. */
const MARDI = new Date(2026, 10, 3, 12);

const ligne = (player: string, team: string, autre: Partial<MatchEntry> = {}): MatchEntry => ({
  j: J, player, team, statut: "Présent", result: team.startsWith("Noirs") ? "Défaite" : "Victoire", sflTime: false,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...autre,
});

/** La J4 de la saison 1 (MVP calculé, donc votée), un match : Noirs 1 contre Blancs 1. */
function journee(noirs: MatchEntry[], blancs: MatchEntry[]): Saison {
  return {
    numero: 1,
    journees: [{ j: J, date: "1 nov.", sflTime: false, mvpAuto: true, matchsDuJour: [{ equipes: ["Noirs 1", "Blancs 1"] }] }],
    roster: [],
    entries: [...noirs, ...blancs],
    convocations: [],
  };
}
const voix = (categorie: CategorieVote, candidat: string, votants: string[]): VoteFigure[] =>
  votants.map((votant) => ({ saison: 1, j: J, categorie, votant, candidat, match_id: "j4-m1", jour: "2026-11-01" }));
const poser = (s: Saison, votes: VoteFigure[]) => appliquerVotes(s, computeJournees(s), votes, LOIN);
/** Un exploit d'un autre joueur de la saison (le premier). */
const deAutre = (nom: string, tous: Exploit[]) => tous.find((e) => e.nom === nom)!;

/* ----------------- Youss, J4 : Impact (3 voix) et Défensive (2 voix) de Noirs 1 ----------------- */
const youss = poser(
  journee(
    [ligne("Youss", "Noirs 1", { buts: 2, passes: 3 }), ...["n2", "n3", "n4", "n5"].map((n) => ligne(n, "Noirs 1"))],
    [ligne("b1", "Blancs 1", { buts: 4, mvp: true }), ...["b2", "b3", "b4", "b5"].map((n) => ligne(n, "Blancs 1"))]
  ),
  [
    ...voix("impact", "Youss", ["b1", "b2", "b3"]),
    ...voix("impact", "n2", ["b4"]),
    ...voix("def", "Youss", ["b4", "b5"]),
    ...voix("def", "n3", ["b1"]),
    ...voix("impact", "b2", ["n2", "n3"]),
    ...voix("def", "b3", ["n4", "n5"]),
  ]
);
{
  const l = youss.entries.find((e) => e.player === "Youss")!;
  assert.ok(l.impact && l.def && !l.mvp, "Youss : Impact et Défensive de Noirs 1, pas MVP (le calcul, inchangé)");
  const joueurs = deriveSeason(youss).players;
  const moi = joueurs.find((p) => p.name === "Youss")!;

  // 1 · La fiche : les deux titres, l'Impact d'abord (l'ordre des puces).
  assert.deepEqual(
    ficheJoueur(youss, moi, joueurs).faits.map((f) => `${f.quand} ${f.quoi}`),
    ["J4 Impact et Le\u00a0Mur de son équipe, doublé et 3 passes"],
    "fiche : avant, « Le Mur de son équipe » seul, l'Impact perdu"
  );

  // 2 · Ma saison : dans l'ordre des puces, « de ton équipe ».
  const [d] = dimanchesDe(youss, "Youss");
  assert.deepEqual(d.titres, ["impact", "def"], "Ma saison : l'Impact puis le Mur, comme les puces");
  assert.equal(phraseDuJour(d), "Défaite, doublé et 3 passes. Impact et Le\u00a0Mur de ton équipe.", "avant : « Le Mur et Impact du match. »");

  // 3 · Les résultats : ses deux titres d'équipe, puis le MVP de son match.
  assert.deepEqual(texteResultats(youss, J, "Youss"), {
    titre: "J4 · Défaite 2 – 4",
    texte: "Avec les Noirs 1. Impact et Le\u00a0Mur de ton équipe. MVP du match : b1.",
  }, "résultats : avant, ni l'Impact ni la Défensive");

  // 4 · Un bravo sur la rubrique de son match : ses deux exploits dans une même phrase.
  // La rubrique des titres de son match : ses exploits Impact et Défensive (le Bravo les envoie d'un coup).
  const siens = exploitsDeLaSaison(youss).filter((e) => e.nom === "Youss" && ["mvp", "impact", "def"].includes(e.famille));
  assert.deepEqual(siens.map((e) => e.famille).sort(), ["def", "impact"]);
  assert.equal(quoiDesExploits(siens), "tes titres de Joueur Impact et de meilleur défenseur", "bravo : avant, le dernier seul restait");
  assert.equal(quoiDesExploits(siens.filter((e) => e.famille === "def")), "ton titre de meilleur défenseur", "un seul exploit : sa phrase");

  // 5 · Bola Agent : la question du débrief.
  const dossier = dossierJoueur(youss, moi, joueurs, MARDI);
  assert.deepEqual(dossier.dernierMatch?.titres, ["impact", "def"]);
  assert.equal(questionDebrief(dossier.dernierMatch!), "J4 : défaite, 2 buts, 3 passes, Impact et Le\u00a0Mur. Alors, c'était comment ?");
  assert.deepEqual(dossier.matchs[0].titres, ["impact", "def"], "le dossier du coach porte tous ses titres");
}

/* ----------------- Anas, J4 : MVP, Impact (1 voix, faible) et Défensive (2 voix) ----------------- */
const anas = poser(
  journee(
    ["n1", "n2", "n3", "n4"].map((n) => ligne(n, "Noirs 1")),
    [ligne("Anas", "Blancs 1", { buts: 2, passes: 4, mvp: true }), ...["b2", "b3", "b4"].map((n) => ligne(n, "Blancs 1"))]
  ),
  [...voix("impact", "Anas", ["n1"]), ...voix("def", "Anas", ["n2", "n3"]), ...voix("impact", "n1", ["b2"])]
);
{
  const l = anas.entries.find((e) => e.player === "Anas")!;
  assert.ok(l.impact && l.def, "Anas : Impact et Défensive des Blancs 1");
  const joueurs = deriveSeason(anas).players;
  const moi = joueurs.find((p) => p.name === "Anas")!;
  // Le MVP sort des stats (mvpAuto, saisie/mvp.ts) et le document le garde : Anas, 2 buts et 4 passes dans la victoire.
  assert.equal(moi.mvp, 1, "Anas : MVP du match");
  assert.deepEqual(
    ficheJoueur(anas, moi, joueurs).faits.map((f) => f.quoi),
    ["MVP du match, Impact et Le\u00a0Mur de son équipe, doublé et 4 passes"],
    "fiche : avant, « MVP du match » seul"
  );
  assert.deepEqual(texteResultats(anas, J, "Anas"), {
    titre: "J4 · Tu es le MVP",
    texte: "2 buts, 4 passes décisives. Impact et Le\u00a0Mur de ton équipe. Tes 3 cartes sont dans les Actus.",
  }, "résultats : avant, « Ta carte » pour trois cartes");
  assert.equal(
    quoiDesExploits(exploitsDeLaSaison(anas).filter((e) => e.nom === "Anas" && ["mvp", "impact", "def"].includes(e.famille))),
    "tes titres d'homme du dimanche, de Joueur Impact et de meilleur défenseur"
  );
  assert.equal(questionDebrief(dossierJoueur(anas, moi, joueurs, MARDI).dernierMatch!), "J4 : victoire, 2 buts, 4 passes, MVP, Impact et Le\u00a0Mur. Alors, c'était comment ?");
}

/* ----------------- MVP et un titre d'équipe (Youss à la J3 : MVP et Défensive) ----------------- */
{
  const mvpMur = poser(
    journee(
      ["n1", "n2", "n3"].map((n) => ligne(n, "Noirs 1")),
      [ligne("Youss", "Blancs 1", { buts: 4, passes: 4, mvp: true }), ...["b2", "b3"].map((n) => ligne(n, "Blancs 1"))]
    ),
    voix("def", "Youss", ["n1"])
  );
  const joueurs = deriveSeason(mvpMur).players;
  const moi = joueurs.find((p) => p.name === "Youss")!;
  assert.deepEqual(ficheJoueur(mvpMur, moi, joueurs).faits.map((f) => f.quoi), ["MVP du match et Le\u00a0Mur de son équipe, 4 buts et 4 passes"]);
  assert.equal(phraseDuJour(dimanchesDe(mvpMur, "Youss")[0]), "Victoire, 4 buts et 4 passes. MVP du match et Le\u00a0Mur de ton équipe.");
  assert.equal(texteResultats(mvpMur, J, "Youss").texte, "4 buts, 4 passes décisives. Le\u00a0Mur de ton équipe. Tes 2 cartes sont dans les Actus.");
}

/* ----------------- Un seul titre : la fiche d'avant ; Ma saison et les résultats le disent de son équipe ----------------- */
{
  const seul = poser(
    journee(
      [ligne("Kader", "Noirs 1", { buts: 1 }), ...["n2", "n3"].map((n) => ligne(n, "Noirs 1"))],
      ["b1", "b2", "b3"].map((n) => ligne(n, "Blancs 1"))
    ),
    voix("def", "Kader", ["b1", "b2"])
  );
  const joueurs = deriveSeason(seul).players;
  const moi = joueurs.find((p) => p.name === "Kader")!;
  assert.deepEqual(ficheJoueur(seul, moi, joueurs).faits.map((f) => f.quoi), ["Le\u00a0Mur de son équipe, 1 but"]);
  assert.equal(phraseDuJour(dimanchesDe(seul, "Kader")[0]), "Défaite, 1 but. Le\u00a0Mur de ton équipe.");
  assert.equal(texteResultats(seul, J, "Kader").texte.startsWith("Avec les Noirs 1. Le\u00a0Mur de ton équipe."), true);
}

/* ----------------- 6 · Les écrans ----------------- */
{
  // Le récap : la ligne des tops (les mots, l'écran pose les points entre eux) et le « repart avec ».
  const l = (autre: Partial<MatchEntry>) => ligne("x", "Noirs 1", autre);
  assert.deepEqual(motsDuTop(l({ buts: 2, passes: 4, mvp: true, impact: true, def: true })), ["2B", "4P", "MVP", "IMPACT", "DÉF"], "tops : avant, la Défensive tombait");
  assert.deepEqual(motsDuTop(l({ def: true, impact: true })), ["IMPACT", "DÉF"], "l'ordre des puces, quel que soit l'ordre des champs");
  assert.deepEqual(motsDuTop(l({ buts: 1 })), ["1B"]);
  assert.deepEqual(motsDuTop(l({})), ["Défaite"], "rien : son résultat");
  assert.deepEqual(motsDuTop(l({ result: null })), []);
  assert.equal(repartAvec(l({})), ".");
  assert.equal(repartAvec(l({ def: true })), " — et repart avec un titre.");
  assert.equal(repartAvec(l({ impact: true, def: true })), " — et repart avec deux titres.", "avant : « un titre » toujours");
  assert.equal(repartAvec(l({ mvp: true, impact: true, def: true })), " — et repart avec trois titres.");
  // Les cartes du jour : la J1 ne reprend pas celles des J10 à J19.
  const cartes = ["J1 · 18 oct.", "J10 · 3 janv.", "J12 · 17 janv.", "J1 · 18 oct.", "J2 · 25 oct."].map((date, i) => ({ date, i }));
  assert.deepEqual(cartesDeLaJournee(cartes, 1).map((c) => c.i), [0, 3], "J1 : ses deux cartes, ni la J10 ni la J12");
  assert.deepEqual(cartesDeLaJournee(cartes, 10).map((c) => c.i), [1]);

  // La Gazette : l'étiquette du palmarès dit tous ses titres.
  assert.equal(etiquetteDuPalmares({ mvp: true, impact: true, def: true }), "MVP · IMP · DÉF", "avant : « MVP » seul");
  assert.equal(etiquetteDuPalmares({ impact: true, def: true }), "IMP · DÉF");
  assert.equal(etiquetteDuPalmares({ def: true }), "DÉF");
  assert.equal(etiquetteDuPalmares({}), "");

  // La synthèse, mode « Titres » : cinq cartes, les MVP d'abord, puis le plus de titres, l'ordre de la feuille à égalité.
  const feuille: [string, BoostType[], boolean?][] = [
    ["Zakaria", ["mvp"]],
    ["Youss", ["impact", "def"]],
    ["Sidali", ["def"]],
    ["Selim", ["mvp"]],
    ["Jouneid", ["impact"]],
    ["Anas", ["mvp", "impact", "def"]],
    ["Ayman", ["mvp", "def"]],
    ["Venu", ["mvp"], true],
    ["Rien", []],
  ];
  const dict = new Map(feuille.map(([n, t]) => [n, t]));
  const posees = titresDeLaSynthese(feuille.map(([name, , extraTime]) => ({ name, extraTime })), (n) => dict.get(n) ?? []);
  assert.deepEqual(
    posees.map((p) => `${p.name} ${p.badge}${p.hot ? " *" : ""}`),
    ["Anas MVP·IMP·DÉF *", "Ayman MVP·DÉF *", "Zakaria MVP *", "Selim MVP *", "Youss IMP·DÉF"],
    "synthèse : avant, les cinq premiers de la feuille, Anas et Ayman dehors"
  );
  assert.equal(pastilleDesTitres(["def", "impact"]), "IMP·DÉF");
  assert.equal(pastilleDesTitres(["impact"]), "IMPACT");
  assert.equal(pastilleDesTitres(["def"]), "DÉF");

  // Les Actus : la ligne du bas d'un match. Le MVP ex æquo ; l'Impact et la Défensive, équipe par équipe.
  const t = (nom: string, types: BoostType[], equipe?: string) => ({ nom, types, ...(equipe ? { equipe } : {}) });
  assert.equal(
    texteDesTitres([t("Bilal", ["mvp", "impact"], "Vert"), t("Abdel", ["impact", "def"], "Jaune"), t("Faycal", ["impact", "def"], "Vert"), t("Moh", ["impact"], "Jaune")]),
    "MVP : Bilal · Impact : Bilal et Faycal (ex\u00a0æquo)\u00a0; Abdel et Moh (ex\u00a0æquo) · Défensive : Abdel, Faycal",
    "Actus : les ex æquo de chaque équipe dits, un élu par équipe sans « ex æquo »"
  );
  assert.equal(
    texteDesTitres([t("Anas", ["mvp", "impact", "def"], "Noirs 3"), t("Mehdi", ["impact"], "Noirs 3"), t("Ryad", ["impact"], "Noirs 3"), t("Yassine", ["impact"], "Blancs 3")]),
    "MVP : Anas · Impact : Anas, Mehdi et Ryad (ex\u00a0æquo)\u00a0; Yassine · Défensive : Anas"
  );
  assert.equal(
    texteDesTitres([t("Ilyes", ["impact"], "Bleu"), t("Selim", ["impact"], "Rouge"), t("Sidali", ["impact"], "Rouge")]),
    "Impact : Ilyes\u00a0; Selim et Sidali (ex\u00a0æquo)",
    "le seul élu d'une équipe ne se mêle pas aux ex æquo de l'autre"
  );
  assert.equal(texteDesTitres([t("A", ["mvp"], "Noirs 1"), t("B", ["mvp"], "Blancs 1")]), "MVP : A, B (ex\u00a0æquo)", "deux MVP : ex æquo, même d'équipes différentes");
  assert.equal(texteDesTitres([t("A", ["impact"]), t("B", ["impact"])]), "Impact : A, B", "sans équipe : chacun seul");
  assert.equal(texteDesTitres([t("A", ["def"], "N")], (n) => `${n}!`), "Défensive : A!", "le nom que la ligue voit");
  // Les titres des Actus portent l'équipe de chaque élu (actus.ts) : Youss à la J4, Noirs 1.
  const jn = computeJournees(youss).find((x) => x.j === J)!;
  const [m1] = titresDuDimanche(youss, J, jn);
  assert.deepEqual(m1.titres.map((x) => [x.nom, x.equipe]), [["b1", "Blancs 1"], ["Youss", "Noirs 1"], ["b2", "Blancs 1"], ["b3", "Blancs 1"]]);
  assert.equal(texteDesTitres(m1.titres), "MVP : b1 · Impact : Youss, b2 · Défensive : Youss, b3", "un élu par équipe : pas d'ex æquo");

  // Ma saison, en grand : le MVP du match, l'Impact et le Mur de ton équipe.
  assert.deepEqual((["mvp", "impact", "def"] as const).map(titreEnGrand), ["MVP du match", "Impact de ton équipe", "Le Mur de ton équipe"], "avant : « du match » partout");
}

/* ----------------- 7 · La notification d'un bravo ----------------- */
{
  const ex = (famille: Famille, nom: string, j = J): Exploit => ({ cle: cleExploit(1, j, famille, nom), saison: 1, j, famille, nom, quoi: "" });
  const tous = exploitsDeLaSaison(anas);
  const deAnas = (f: Famille) => tous.find((e) => e.nom === "Anas" && e.famille === f)!;
  const [mvp, imp, def] = (["mvp", "impact", "def"] as const).map(deAnas);
  // Le Bravo d'une rubrique envoie les exploits dans le désordre : la phrase garde l'ordre des puces.
  assert.equal(quoiDesExploits([def, mvp, imp]), "tes titres d'homme du dimanche, de Joueur Impact et de meilleur défenseur", "avant : l'ordre d'arrivée");
  assert.equal(quoiDesExploits([def, imp]), "tes titres de Joueur Impact et de meilleur défenseur");

  const exploits = new Map(tous.map((e) => [e.cle, e]));
  const recue = (id: number, de: string, e: Exploit, a = "id-anas"): Recue => ({ id, de, a, exploit: e.cle, saison: e.saison, j: e.j });
  // Deux autres l'avaient félicité pour son Impact ; Kader le félicite d'un coup pour ses trois titres.
  const avant = [recue(1, "x", imp), recue(2, "y", imp)];
  const neuves = [recue(10, "kader", def), recue(11, "kader", mvp), recue(12, "kader", imp)];
  const toutes = [...avant, ...neuves];
  const notifs = notificationsDesBravos(neuves.map(({ id, a, exploit }) => ({ id, a, exploit })), exploits, toutes, "Kader");
  assert.equal(notifs.size, 1, "une seule notification pour Anas : avant, la dernière seule restait");
  assert.deepEqual(notifs.get("id-anas"), {
    titre: "Kader et 2 autres t'ont félicité",
    texte: "Pour tes titres d'homme du dimanche, de Joueur Impact et de meilleur défenseur · J4 · +30 XP",
    url: `/ligue?exploit=${encodeURIComponent(mvp.cle)}`,
    tag: `felicitation-${[mvp.cle, imp.cle, def.cle].sort().join("+")}`,
    ref: `exploit:${mvp.cle}`,
  }, "trois titres, trois fois 10 XP, la notification ouvre le MVP");
  // Les plafonds : cinq bravos comptés par exploit, dix par joueur et par journée, dans l'ordre d'arrivée.
  const cinq = [1, 2, 3, 4, 5].map((i) => recue(i, `v${i}`, imp));
  assert.equal(compteXp([...cinq, recue(6, "kader", imp)], { id: 6, a: "id-anas" }, imp), false, "le sixième bravo d'un exploit ne compte plus");
  assert.equal(compteXp([...cinq, recue(6, "kader", def)], { id: 6, a: "id-anas" }, def), true, "un autre exploit, si");
  const dix = Array.from({ length: 10 }, (_, i) => recue(i + 1, `v${i}`, ex("badge", `b${i}`)));
  assert.equal(compteXp([...dix, recue(20, "kader", def)], { id: 20, a: "id-anas" }, def), false, "dix comptés ce jour-là : plus rien");
  const plein = notificationsDesBravos([{ id: 20, a: "id-anas", exploit: def.cle }], exploits, [...dix, recue(20, "kader", def)], "Kader");
  assert.equal(plein.get("id-anas")!.texte, "Pour ton titre de meilleur défenseur · J4", "sans XP, la notification ne l'annonce pas");
  // Deux joueurs dans le même appel : chacun la sienne.
  const deux = notificationsDesBravos(
    [{ id: 30, a: "id-anas", exploit: imp.cle }, { id: 31, a: "id-b2", exploit: deAutre("b2", tous).cle }],
    exploits,
    [recue(30, "kader", imp), recue(31, "kader", deAutre("b2", tous), "id-b2")],
    "Kader"
  );
  assert.deepEqual([...deux.keys()].sort(), ["id-anas", "id-b2"]);

  // Toute une rubrique d'un coup : la J3, Match 1 en comptait 10 ; au-delà de 10, le reste tombait sans un mot.
  const rubrique = Array.from({ length: 21 }, (_, i) => cleExploit(1, 3, (["mvp", "impact", "def"] as const)[i % 3], `joueur ${Math.floor(i / 3)}`));
  assert.deepEqual(exploitsDemandes({ exploits: [...rubrique, ...rubrique, "pas une clé", 42, "x".repeat(130)] }), rubrique, "21 exploits, doublons et intrus écartés");
  assert.equal(exploitsDemandes({ exploits: Array.from({ length: 80 }, (_, i) => cleExploit(1, 3, "badge", `j${i}`)) }).length, MAX_EXPLOITS_PAR_BRAVO);
  assert.deepEqual(exploitsDemandes(null), []);
  assert.deepEqual(exploitsDemandes({ exploits: "1-3-mvp-x" }), []);
}

/* ----------------- 6 bis · Les écrans posent ce calcul, rien d'autre ----------------- */
{
  // Chaque écran passe par sa fonction pure (vérifiée en 6 et 7) : un écran qui referait son calcul à part la perdrait.
  const RACINE = join(__dirname, "..", "src");
  const branche: [string, string[]][] = [
    ["components/sfl/feed/journee-recap.tsx", ["motsDuTop(", "repartAvec(", "cartesDeLaJournee("]],
    ["components/sfl/feed/la-une.tsx", ["etiquetteDuPalmares("]],
    ["components/sfl/feed/pitch-synthese.tsx", ["titresDeLaSynthese("]],
    ["components/sfl/actus/pelouse.tsx", ["texteDesTitres("]],
    ["components/sfl/ma-saison.tsx", ["titreEnGrand("]],
    ["app/api/felicitations/route.ts", ["exploitsDemandes(", "notificationsDesBravos("]],
  ];
  for (const [f, fns] of branche) {
    const src = readFileSync(join(RACINE, f), "utf8");
    for (const fn of fns) assert.ok(src.includes(fn), `${f} ne passe plus par ${fn.slice(0, -1)}`);
  }
}

/* ----------------- 8 · Le poids d'un fait marquant, « Le Mur » d'un bloc ----------------- */
{
  // J1 : l'Impact et le Mur de son équipe, sans but ; J2 à J4 : un doublé et deux passes. Les trois faits
  // retenus : le dimanche aux deux titres (3 + 3) passe devant un doublé et deux passes (3 + 2).
  const jour = (j: number, autre: Partial<MatchEntry>): MatchEntry => ({ ...ligne("Kader", "Noirs 1", autre), j });
  const s: Saison = {
    numero: 1,
    journees: [1, 2, 3, 4].map((j) => ({ j, date: `${j} oct.`, sflTime: false })),
    roster: [],
    entries: [
      jour(1, { impact: true, def: true }),
      jour(2, { buts: 2, passes: 2 }),
      jour(3, { buts: 2, passes: 2 }),
      jour(4, { buts: 2, passes: 2 }),
      ...[1, 2, 3, 4].map((j) => ({ ...ligne("autre", "Blancs 1"), j })),
    ],
    convocations: [],
  };
  const joueurs = deriveSeason(s).players;
  assert.deepEqual(
    ficheJoueur(s, joueurs.find((p) => p.name === "Kader")!, joueurs).faits.map((f) => `${f.quand} ${f.quoi}`),
    ["J1 Impact et Le Mur de son équipe", "J3 Doublé et 2 passes", "J4 Doublé et 2 passes"],
    "fiche : avant, un seul titre pesait, la J1 tombait"
  );
  // « Le Mur » ne se coupe jamais entre « Le » et « Mur » (la bulle de Bola Agent à 390 px).
  assert.equal(NOM_TITRE.def, "Le Mur");
}

/* ----------------- 9 · Mes cartes : la carte coupée au bord se voit ----------------- */
{
  // La rangée d'Anas (sa carte de saison, puis MVP, Impact, Défensive et une autre carte du jour),
  // mesurée à l'écran : 16 px de marge, 127 px la grande, 78,5 px les moyennes, 13 px d'écart.
  const rangee: [number, number][] = [[16, 143], [156, 234.5], [247.5, 326], [339, 417.5], [430.5, 509]];
  // 375 px (333,5 px de rangée) : la Défensive commençait au-delà du bord, entièrement cachée.
  assert.equal(decalageQuiDepasse(rangee, 333.5), 21, "375 : 34 px après la carte de saison, l'Impact coupé au bord");
  // 390 px : 9,5 px de la Défensive seulement ; 8 px d'écart en montrent 14,5.
  assert.equal(decalageQuiDepasse(rangee, 348.5), -5);
  // 414 px : 33 px de la Défensive se voient, rien ne bouge ; ni quand tout tient.
  assert.equal(decalageQuiDepasse(rangee, 372), 0);
  assert.equal(decalageQuiDepasse(rangee.slice(0, 3), 372), 0);
  assert.ok(DEPASSE >= 12);
}

console.log("titres-cumul-check : Youss J4 (Impact et Défensive) et Anas J4 (MVP, Impact, Défensive) voient tous leurs titres — fiche, Ma saison, résultats, bravo, Bola Agent, récap, Gazette, synthèse, Actus — ok");
