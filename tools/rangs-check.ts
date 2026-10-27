// Vérifie qu'un joueur a la MÊME place partout (lib/sfl/rangs.ts) : Ma carte
// (le chiffre « Pépite d'Or », la courbe Évolution, Ma saison, les badges
// « en ce moment »), son profil, les Actus (« Toi · Ne », les flèches ▲/▼),
// le découpage des divisions — et le classement de la Ligue.
//
// Le cas d'Ilyes (27/10) : 7e au Pépite d'Or dans Ma carte, 6e au classement.
// La courbe de Ma carte lisait la saison brute, sans les Impact et Défensive
// élus par vote (+1 point chacun) ; le classement les comptait.
//
// La saison de test : le seed du dépôt passé en saison 1, J1 à J3, avec tout
// ce qui faisait diverger les écrans :
//   · des titres votés à la J3 (Impact et Défensive d'Ilyes, d'autres) ;
//   · une ligne d'extra time qui marque (le +1 automatique) ;
//   · des joueurs masqués devant tout le monde (Sabri, un arbitre, une place X1) ;
//   · la feuille de la J4 posée mais pas jouée ;
//   · un vote envoyé après minuit.
//   npx tsx tools/rangs-check.ts
// Avec la vraie saison (le document de la table saison) et ses votes (les
// lignes de votes_figures), en JSON, exportés en lecture seule : imprime en
// plus qui change de division et de place une fois les votes comptés.
//   npx tsx tools/rangs-check.ts saison.json votes.json [Fabio,…arbitres]
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { courbeDeCarriere } from "../src/lib/sfl/carriere";
import { rankByMetric, type Player } from "../src/lib/sfl/engine";
import { ficheJoueur } from "../src/lib/sfl/fiche-joueur";
import { CLASSEMENTS, finsDeSaison, ordinal, podiumsDe } from "../src/lib/sfl/fin-de-saison";
import { definirArbitres, isHidden, publicOnly } from "../src/lib/sfl/hidden";
import { decouper, etatDivisions, rangDansDivision } from "../src/lib/sfl/divisions";
import { voisins } from "../src/lib/sfl/actus-toi";
import { rangDans, rangPepiteApres } from "../src/lib/sfl/rangs";
import { computeJournees, deriveSeason, entryPP, journeeTerminee } from "../src/lib/sfl/saisie/engine";
import { cloturerSaison, journeeJouee } from "../src/lib/sfl/saisie/mutations";
import { noteDeMatch } from "../src/lib/sfl/saisie/mvp";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { appliquerVotes, titresFaibles, votesDuJour, type VoteFigure } from "../src/lib/sfl/votes";
import { saisonAvecVotes } from "../src/lib/sfl/saison-serveur.server";

const seed = seedSaison();
const J = 3;
const ligne = (j: number, player: string, autre: Partial<MatchEntry> = {}): MatchEntry => ({
  j, player, team: null, statut: "Présent", result: "Défaite", sflTime: true,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...autre,
});

// Saison 1, J1 à J3 du seed ; la J3 a son vote (MVP calculé).
const base: Saison = {
  ...seed,
  numero: 1,
  archives: [],
  journees: seed.journees.filter((m) => m.j <= J).map((m) => (m.j === J ? { ...m, mvpAuto: true } : m)),
  // À la J3, les titres viennent des votes : rien n'est coché dans le document.
  entries: seed.entries.filter((e) => e.j <= J && !e.extraTime).map((e) => (e.j === J ? { ...e, impact: false, def: false } : e)),
};
const jJ3 = computeJournees(base).find((m) => m.j === J)!;
const matchDe = (nom: string) => jJ3.matches!.find((m) => [...m.teamA.players, ...m.teamB.players].some((p) => p.name === nom))!;
const adversaires = (nom: string) => {
  const m = matchDe(nom);
  return (m.teamA.players.some((p) => p.name === nom) ? m.teamB : m.teamA).players.map((p) => p.name);
};
const brut0 = deriveSeason(base).players;
const NOMS = brut0.filter((p) => p.matchs > 0).map((p) => p.name);
const ILYES = "Ilyes";
assert.ok(NOMS.includes(ILYES) && matchDe(ILYES), "Ilyes joue la J3");

// Les ajouts qui faisaient diverger les écrans.
const voisin = NOMS[3];
const arbitre = NOMS.find((n) => n !== ILYES && n !== voisin && !!matchDe(n))!;
const saison: Saison = {
  ...base,
  journees: [...base.journees, { j: 4, date: "1 nov.", sflTime: true, mvpAuto: true }],
  roster: [...base.roster, { name: "Sabri", poste: null, profil: "Actif", base: null }],
  entries: [
    ...base.entries,
    // L'extra time qui marque : +1 automatique (SFL#187) plus son bonus.
    ligne(J, voisin, { extraTime: true, buts: 1, team: null, result: null }),
    // Des masqués devant tout le monde.
    ligne(J, "Sabri", { pepiteBonus: 200 }),
    ligne(J, "X1", { result: "Victoire", buts: 9, passes: 9 }),
    ligne(1, arbitre, { pepiteBonus: 150 }),
    // La feuille de la J4, posée, pas jouée : un point de présence en apparence.
    ...NOMS.slice(4, 14).map((n) => ligne(4, n, { result: null, team: "Noirs" })),
  ],
};
definirArbitres([arbitre]);

// Les votes de la J3 : Ilyes élu Impact et Défensive ; un vote parti après minuit.
const vote = (votant: string, candidat: string, categorie: VoteFigure["categorie"], jour?: string): VoteFigure => ({
  saison: 1, j: J, categorie, votant, candidat, match_id: matchDe(candidat).id, ...(jour ? { jour } : {}),
});
const autreElu = NOMS.find((n) => n !== ILYES && !adversaires(ILYES).includes(n) && n !== arbitre)!;
const votes: VoteFigure[] = [
  ...adversaires(ILYES).slice(0, 2).map((v) => vote(v, ILYES, "impact", "2026-07-05")),
  ...adversaires(ILYES).slice(0, 2).map((v) => vote(v, ILYES, "def", "2026-07-05")),
  vote(adversaires(autreElu)[0], autreElu, "impact", "2026-07-05"),
  // Le lendemain : ne compte pas (votesDuJour).
  ...adversaires(ILYES).slice(2, 5).map((v) => vote(v, adversaires(ILYES)[5] ?? v, "def", "2026-07-06")),
];
const maintenant = new Date(2030, 0, 1);

/* ---------------------- La saison des téléphones ---------------------- */
// Ce que fait le SeasonProvider (et saisonServeur côté serveur).
const journees = computeJournees(saison);
const titree = appliquerVotes(saison, journees, votes, maintenant);
const faibles = titresFaibles(saison, journees, votes, maintenant);
const vue: Saison = { ...titree, ...(faibles.size ? { titresFaibles: [...faibles] } : {}) };
const derived = deriveSeason(titree, faibles);
const allPlayers = derived.players;
const players = publicOnly(allPlayers);
assert.deepEqual(saisonAvecVotes(saison, votes, maintenant).entries, titree.entries, "le serveur lit la même saison que les téléphones");

const elu = titree.entries.find((e) => e.j === J && e.player === ILYES && !e.extraTime)!;
assert.ok(elu.impact && elu.def, "Ilyes est élu Impact et Défensive");
assert.equal(saison.entries.find((e) => e.j === J && e.player === ILYES)!.impact, false, "le document brut n'a pas les titres");
assert.equal(votesDuJour(votes, "5 juil.").length, votes.length - 3, "le vote d'après minuit est écarté");
assert.equal(votesDuJour(votes, "5 juil.", J).length, votes.length - 3, "écarté aussi décompté par journée");
// La date de la journée corrigée après le vote : aucun vote n'est du jour affiché, on les garde tous.
assert.equal(votesDuJour(votes, "12 juil.", J).length, votes.length, "date corrigée après coup : les élus restent");

/* ------------------- Le cas d'Ilyes : avant le correctif ------------------- */
// En prod, la courbe de Ma carte lisait la saison brute : 2 points de moins.
const ppBrut = deriveSeason(saison).players.find((p) => p.name === ILYES)!.pp;
const ppVue = allPlayers.find((p) => p.name === ILYES)!.pp;
assert.equal(ppVue - ppBrut, 2, "Impact + Défensive votés : +2 points Pépite");

// L'ancienne courbe (carriere.ts en prod) : saison brute, sa propre somme de
// points (l'extra time sans son +1), les ex æquo à part. Elle place mal des
// joueurs : c'est exactement le « 7e au lieu de 6e » d'Ilyes.
const ancienneCourbe = (s: Saison, nom: string): number | null => {
  const pp = new Map<string, number>();
  const joues = new Set<string>();
  for (const e of s.entries) {
    if (!journeeJouee(s, e.j)) continue;
    pp.set(e.player, (pp.get(e.player) ?? 0) + (e.extraTime ? (e.pepiteBonus ?? 0) : entryPP(e)));
    if (e.statut === "Présent" && !e.extraTime) joues.add(e.player);
  }
  const classes = [...joues].filter((n) => n === nom || !isHidden(n));
  return joues.has(nom) ? 1 + classes.filter((n) => (pp.get(n) ?? 0) > (pp.get(nom) ?? 0)).length : null;
};

/* --------------- Le classement de la Ligue, la référence --------------- */
// Pépite d'Or : les joueurs publics qui ont joué (le découpage, les places des divisions).
const classement = (valeur: (p: Player) => number, tous = false) =>
  rankByMetric(players.filter((p) => p.matchs > 0), valeur).filter((p) => tous || p.value > 0);
const reference = new Map(classement((p) => p.pp, true).map((p) => [p.name, p.rank]));
const derniereJ = Math.max(...saison.journees.map((m) => m.j).filter((j) => journeeJouee(saison, j)));
assert.equal(derniereJ, J, "la J4 posée n'est pas jouée");

// La feuille de la J4 ne donne rien avant d'être jouée.
const sansJ4 = deriveSeason({ ...titree, entries: titree.entries.filter((e) => e.j !== 4) }, faibles).players;
for (const p of allPlayers) assert.equal(p.pp, sansJ4.find((q) => q.name === p.name)?.pp, `${p.name} : la feuille posée de la J4 ne compte pas`);
// Aucun masqué dans la référence.
assert.ok(![...reference.keys()].some(isHidden));
// L'extra time compte son +1 partout.
assert.equal(
  allPlayers.find((p) => p.name === voisin)!.pp,
  titree.entries.filter((e) => e.player === voisin && e.j <= J).reduce((n, e) => n + entryPP(e), 0)
);

const etat = etatDivisions(vue)!;
const decoupage = decouper(vue);
const fausses = NOMS.filter((n) => !isHidden(n) && ancienneCourbe(saison, n) !== reference.get(n));
assert.ok(fausses.includes(ILYES), "l'ancienne courbe plaçait mal Ilyes");
console.log(
  `avant : ${fausses.length} joueurs mal placés par Ma carte, dont Ilyes (${ordinal(ancienneCourbe(saison, ILYES)!)} au lieu de ${ordinal(reference.get(ILYES)!)})`
);
let verifies = 0;
for (const nom of NOMS) {
  if (isHidden(nom)) continue;
  const attendu = reference.get(nom)!;
  const moi = allPlayers.find((p) => p.name === nom)!;
  // Ma carte, le chiffre du haut (profil/page.tsx) et le profil (profil-joueur.tsx).
  assert.equal(rangDans(allPlayers, nom)?.rang, attendu, `${nom} : Ma carte`);
  // La courbe : tuile Évolution, flèches de Ma saison, /profil/evolution.
  const courbe = courbeDeCarriere(vue, nom, derived.evolution);
  assert.equal(courbe.at(-1)?.rang, attendu, `${nom} : courbe de Ma carte`);
  // Les flèches ▲/▼ des Actus et du Classement.
  assert.equal(rangPepiteApres(vue, nom, J, derived.evolution), attendu, `${nom} : Actus`);
  // « Toi · Ne au Pépite d'Or » et ton rival.
  assert.equal(voisins(vue, nom)?.moi.rank, attendu, `${nom} : Ton rival`);
  // Le découpage des divisions, et la place dans la division (rangDansDivision).
  const place = decoupage.parNom.get(nom)!;
  assert.equal(place.rang, attendu, `${nom} : découpage`);
  const division = rankByMetric(
    players.filter((p) => p.matchs > 0 && decoupage.parNom.get(p.name)?.division === place.division),
    (p) => p.pp
  );
  assert.equal(rangDansDivision(decoupage, place), division.find((p) => p.name === nom)!.rank, `${nom} : place dans la division`);
  assert.equal(etat.actuelle.get(nom), place.division);
  // Badges « en ce moment » et points forts de Ma saison, pour les cinq classements.
  const fins = finsDeSaison(vue, nom, allPlayers);
  const fiche = ficheJoueur(vue, moi, allPlayers);
  for (const def of CLASSEMENTS) {
    const ref = classement(def.valeur).find((p) => p.name === nom)?.rank ?? null;
    assert.equal(fins.find((f) => f.def.id === def.id)!.enCours?.rang ?? null, ref, `${nom} : badge ${def.nom}`);
    const id = { pepite: "pp", buteur: "buts", passeur: "passes", defenseur: "def", mvp: "mvp" }[def.id];
    const fort = fiche.forts.find((f) => f.classement === id);
    if (fort) assert.equal(fort.place, ref, `${nom} : point fort ${def.nom}`);
  }
  verifies += 1;
}

/* ----------------------------- Les invariants ----------------------------- */
// Une place X ne prend jamais le MVP.
assert.equal(noteDeMatch(ligne(J, "X2", { result: "Victoire", buts: 5 })), 0);
// Le premier but saisi en direct rend la journée jouée, pas terminée.
const enDirect: Saison = { ...vue, entries: vue.entries.map((e) => (e.j === 4 && e.player === NOMS[4] ? { ...e, buts: 1 } : e)) };
assert.ok(journeeJouee(enDirect, 4) && !journeeTerminee(enDirect, 4));
assert.deepEqual(
  [...etatDivisions(enDirect)!.actuelle],
  [...etat.actuelle],
  "un but saisi en direct ne recoupe pas les divisions"
);
// La clôture garde les titres votés et leurs points.
const close = cloturerSaison(vue, "Saison 1", { entries: titree.entries, faibles });
const archive = close.archives!.at(-1)!;
assert.ok(archive.entries.find((e) => e.j === J && e.player === ILYES && !e.extraTime)!.impact, "l'archive garde l'Impact voté");
const podium = podiumsDe(close, "pepite");
assert.ok(podium.length && !podium.some((p) => isHidden(p.nom)), "aucun masqué sur un podium");
assert.equal(podium.find((p) => p.rang === 1)?.nom, classement((p) => p.pp)[0].name, "le podium de l'archive est celui du classement");

console.log(`rangs-check : ${verifies} joueurs, la même place partout (Ma carte, courbe, Actus, rival, divisions, badges, fiche) — ok`);

/* ------------------------ Sur la vraie saison ------------------------ */
const [fichierSaison, fichierVotes, listeArbitres] = process.argv.slice(2);
if (fichierSaison) {
  const reelle = JSON.parse(readFileSync(fichierSaison, "utf8")) as Saison;
  const lus = fichierVotes ? (JSON.parse(readFileSync(fichierVotes, "utf8")) as VoteFigure[]) : [];
  definirArbitres(listeArbitres ? listeArbitres.split(",") : []);
  const lue = saisonAvecVotes(reelle, lus, new Date());
  const avant = decouper(reelle);
  const apres = decouper(lue);
  console.log(`\nSaison ${reelle.numero ?? 0} : ${lus.length} votes, ${apres.classes} joueurs classés.`);
  for (const [nom, p] of apres.parNom) {
    const a = avant.parNom.get(nom);
    const carte = ancienneCourbe(reelle, nom);
    const division = a && a.division !== p.division ? `  D${a.division} → D${p.division}` : "";
    const maCarte = carte !== p.rang ? `  Ma carte affichait ${carte == null ? "–" : ordinal(carte)}` : "";
    if (division || maCarte) console.log(`${ordinal(p.rang).padStart(4)} ${nom} (${p.pp} pts)${division}${maCarte}`);
  }
}
