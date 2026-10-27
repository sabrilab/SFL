// Vérifie que les cartes à titre élues par vote (Impact, Défensive) sortent
// bien dans Ma carte (lib/sfl/carriere.ts) : elles n'existent que dans la
// saison où les votes sont posés (appliquerVotes), jamais dans le document
// brut (Sabri, 27/10 : la carte Impact de Bilal à la J3, absente de Ma carte).
//   npx tsx tools/cartes-titres-check.ts
import assert from "node:assert/strict";
import { cartesDeCarriere, courbeDeCarriere } from "../src/lib/sfl/carriere";
import { computeJournees, deriveSeason } from "../src/lib/sfl/saisie/engine";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import { appliquerVotes, titresFaibles, type VoteFigure } from "../src/lib/sfl/votes";

const brute = seedSaison();
const J = 3;
// La J3 votée : MVP calculé, équipes connues (journeeAvecVote).
const saison = { ...brute, journees: brute.journees.map((m) => (m.j === J ? { ...m, mvpAuto: true } : m)) };
const journees = computeJournees(saison);
const jour = journees.find((m) => m.j === J)!;
const match = jour.matches!.find((m) => [...m.teamA.players, ...m.teamB.players].some((p) => p.name === "Bilal"))!;
assert.ok(match, "Bilal a un match à la J3");
const autres = match.teamA.players.some((p) => p.name === "Bilal") ? match.teamB : match.teamA;
const numero = saison.numero ?? 0;
const votes: VoteFigure[] = autres.players
  .filter((p) => !p.extraTime)
  .slice(0, 3)
  .map((p) => ({ saison: numero, j: J, categorie: "impact", votant: p.name, candidat: "Bilal", match_id: "m" }));
// Bien après la J3 : le vote est fermé.
const maintenant = new Date(2030, 0, 1);

const titree = appliquerVotes(saison, journees, votes, maintenant);
assert.notEqual(titree, saison, "le vote pose l'élu");
assert.equal(saison.entries.find((e) => e.j === J && e.player === "Bilal")!.impact, false, "le document brut n'a pas le titre");

const impactJ3 = (c: ReturnType<typeof cartesDeCarriere>) =>
  c.find((s) => s.enCours)?.speciales.filter((x) => x.carte.type === "impact" && x.j === J) ?? [];

// Avant le correctif : Ma carte lisait la saison brute.
assert.equal(impactJ3(cartesDeCarriere(saison, "Bilal")).length, 0);
// Après : la saison titrée et son évolution, comme le provider.
const faibles = titresFaibles(saison, journees, votes, maintenant);
const { evolution, boostCards, players } = deriveSeason(titree, faibles);
const cartes = cartesDeCarriere(titree, "Bilal", evolution);
assert.equal(impactJ3(cartes).length, 1, "la carte Impact J3 de Bilal est dans Ma carte");
// La même carte, à la même note, que celle du reste de l'app (classements, récap).
const ailleurs = boostCards.find((c) => c.player === "Bilal" && c.type === "impact" && c.date.startsWith(`J${J} `))!;
assert.equal(impactJ3(cartes)[0].carte.ovr, ailleurs.ovr);
// La carte de saison a la note du classement.
assert.deepEqual(cartes.find((s) => s.enCours)!.player.stats, players.find((p) => p.name === "Bilal")!.stats);
// La courbe a son rond rouge ce jour-là.
const point = courbeDeCarriere(titree, "Bilal", evolution).find((p) => p.saison === numero && p.j === J)!;
assert.equal(point.speciale?.type, "impact");

console.log("cartes-titres-check : ok");
