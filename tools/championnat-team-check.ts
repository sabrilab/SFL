// Le 5 contre 4 dans le championnat de Bola Team (03/11/2026 ; Règlement
// Team art. 7.2 et 7.3, règle du fondateur ; Q4 à Ilyes, la recommandation
// appliquée) :
//   1. les cinq exemples officiels de l'art. 7.3 (l'équipe B à 4, A à 5 ou
//      plus) : 9-9 → 9-8, 0-0 → 1-0, 2-0 → 3-0, 3-4 → 3-3, 2-5 → 2-4, avec
//      la victoire, le nul et la défaite, et les points 2 / 1 / 0 ; puis les
//      mêmes vus de l'autre côté (l'équipe qui reçoit à 4) ;
//   2. deux équipes à 4 : un amical, sans points ni buteurs, qui ne prend
//      pas l'une des deux rencontres de la saison ;
//   3. 3 ou moins : le forfait de cette équipe, 0 – 3, compté (une
//      rencontre) et sans buteurs ; les deux : non classé ;
//   4. des présents qui ne collent pas : litige, puis non classé ;
//   5. une saisie seule avec un 5 contre 4 : validée au bout de 24 h ;
//   6. une feuille d'avant le 03/11/2026, sans présents : inchangée ;
//   7. la carte d'entraîneur lit toujours le score du terrain
//      (rencontreComptee), et le forfait par présents comme un forfait ;
//   8. une saisie seule faite juste avant la fermeture : l'autre équipe a
//      encore ses 24 h pour répondre, elle seule (fermeturePour, la même règle
//      que equipe_resultat) ; un litige né ainsi se corrige jusqu'au bout de
//      ces 24 h, puis il n'est pas classé ;
//   9. un litige jamais tranché, pour la carte d'entraîneur : la version de
//      l'adversaire, s'il aurait été classé (MatchCompteTeam.classable) ;
//  10. le gel de fin de saison (enGel) : les 14 derniers jours, les mêmes que
//      equipe_gel dans la base.
//   npx tsx tools/championnat-team-check.ts
import assert from "node:assert/strict";
import {
  championnat,
  collent,
  enGel,
  etatMatch,
  fermeture,
  fermeturePour,
  scoreFinal,
  type EquipeChampionnat,
  type MatchTeam,
  type Presents,
  type SaisieTeam,
} from "../src/lib/sfl/championnat-team";
import { rencontreComptee } from "../src/lib/sfl/entraineur";

const A = 1;
const B = 2;
const C = 3;
const equipes: EquipeChampionnat[] = [A, B, C].map((id) => ({ id, nom: `E${id}`, creeLe: "2026-10-01T00:00:00Z", active: true }));
let n = 0;
/** Un match de A contre B, les deux saisies d'accord (score du terrain vu de A, présents de A puis de B). */
function match(terrain: [number, number], presents: [Presents, Presents], o: { de?: number; a?: number; jour?: string; seule?: boolean; sans?: boolean } = {}): MatchTeam {
  const de = o.de ?? A;
  const a = o.a ?? B;
  const jour = o.jour ?? "2026-11-14";
  const le = `${jour}T21:30:00Z`;
  const p = (x: Presents, y: Presents) => (o.sans ? {} : { presents: x, presentsAdverses: y });
  const sDe: SaisieTeam = { equipe: de, pour: terrain[0], contre: terrain[1], le, ...p(presents[0], presents[1]) };
  const sA: SaisieTeam = { equipe: a, pour: terrain[1], contre: terrain[0], le, ...p(presents[1], presents[0]) };
  return {
    id: ++n,
    de,
    a,
    jour,
    heure: "20:00",
    lieu: "Five Lille Sud",
    statut: "accepte",
    forfaitDe: null,
    saisies: o.seule ? [sDe] : [sDe, sA],
    buteurs: terrain[0] > 0 ? [{ equipe: de, joueur: "j1", name: "Ilyes", buts: terrain[0], passes: 0 }] : [],
  };
}
const apres = new Date("2026-11-20T12:00:00Z");
const ligne = (c: ReturnType<typeof championnat>, id: number) => c.divisions[0].lignes.find((l) => l.equipe === id)!;

// 1 · Les cinq exemples officiels (A à 5 ou plus, B à 4), vus de A, puis la même chose quand A reçoit à 4.
const EXEMPLES: [terrain: [number, number], final: [number, number], pointsA: number, pointsB: number][] = [
  [[9, 9], [9, 8], 2, 0],
  [[0, 0], [1, 0], 2, 0],
  [[2, 0], [3, 0], 2, 0],
  [[3, 4], [3, 3], 1, 1],
  [[2, 5], [2, 4], 0, 2],
];
for (const [terrain, final, pA, pB] of EXEMPLES) {
  assert.deepEqual(scoreFinal(terrain, [5, 4]).final, final, `B à 4 : ${terrain.join("-")} donne ${final.join("-")}`);
  assert.equal(scoreFinal(terrain, [5, 4]).aQuatre, 1);
  const m = match(terrain, [5, 4]);
  const e = etatMatch(m, apres);
  assert.ok(e.etat === "valide" && e.aQuatre === B && e.forfaitDe === null, "le match est validé, B à 4");
  assert.deepEqual(e.etat === "valide" && e.buts, terrain, "le score du terrain reste");
  assert.deepEqual(e.etat === "valide" && e.final, final, "le score final décide");
  const c = championnat(1, equipes, [m], apres);
  assert.equal(ligne(c, A).pts, pA, `A prend ${pA} point(s) sur ${terrain.join("-")}`);
  assert.equal(ligne(c, B).pts, pB, `B prend ${pB} point(s) sur ${terrain.join("-")}`);
  assert.equal(ligne(c, A).bp - ligne(c, A).bc, final[0] - final[1], "la différence de buts est celle du score final");
  assert.equal(c.buteurs.find((x) => x.joueur === "j1")?.buts ?? 0, terrain[0], "les buts du terrain gardent leur valeur");
  // Le même match quand c'est l'équipe qui reçoit (de) qui est à 4 : tout s'inverse.
  const inverse = match([terrain[1], terrain[0]], [4, 5]);
  const ei = etatMatch(inverse, apres);
  assert.ok(ei.etat === "valide" && ei.aQuatre === A);
  assert.deepEqual(ei.etat === "valide" && ei.final, [final[1], final[0]], "le côté qui reçoit à 4 suit la même règle");
}
assert.deepEqual(scoreFinal([3, 1], [5, 5]), { final: [3, 1], aQuatre: null, forfait: null, amical: false, nonClasse: false }, "à 5 et plus des deux côtés, rien ne change");

// 2 · Deux équipes à 4 : un amical, qui ne prend pas de rencontre.
{
  const amical = match([2, 1], [4, 4], { jour: "2026-11-07" });
  const e = etatMatch(amical, apres);
  assert.ok(e.etat === "valide" && e.amical === "deux-a-quatre" && e.aQuatre === null);
  assert.deepEqual(e.etat === "valide" && e.final, [2, 1], "rien de retiré");
  const deux = [match([1, 0], [5, 5], { jour: "2026-11-14" }), match([0, 2], [5, 5], { jour: "2026-11-21" })];
  const c = championnat(1, equipes, [amical, ...deux], new Date("2026-11-25T12:00:00Z"));
  const compte = c.matchs.find((x) => x.m.id === amical.id)!;
  assert.equal(compte.compte, false);
  assert.equal(compte.amical, "deux-a-quatre");
  assert.equal(ligne(c, A).j, 2, "l'amical ne compte pas : deux rencontres comptées après lui");
  assert.ok(c.matchs.filter((x) => x.compte).length === 2, "il ne prend pas l'une des deux rencontres de la saison");
  assert.equal(c.buteurs.find((x) => x.joueur === "j1")?.buts, 1, "ses buts n'entrent pas au classement des buteurs");
}

// 3 · Trois ou moins : le forfait, 0 – 3, compté ; les deux : non classé.
{
  assert.deepEqual(scoreFinal([0, 0], [3, 5]), { final: [0, 3], aQuatre: null, forfait: 0, amical: false, nonClasse: false });
  assert.deepEqual(scoreFinal([0, 0], [4, 3]).final, [3, 0], "à 4 contre 3 ou moins, l'équipe à 4 gagne par forfait");
  const f = match([0, 0], [5, 3], { jour: "2026-11-07" });
  const e = etatMatch(f, apres);
  assert.ok(e.etat === "valide" && e.forfaitDe === B, "le forfait de B");
  assert.deepEqual(e.etat === "valide" && e.final, [3, 0]);
  assert.deepEqual(e.etat === "valide" && e.buts, [3, 0], "comme un forfait par annulation : 3 – 0");
  const deux = [match([1, 0], [5, 5], { jour: "2026-11-14" }), match([0, 2], [5, 5], { jour: "2026-11-21" })];
  const c = championnat(1, equipes, [f, ...deux], new Date("2026-11-25T12:00:00Z"));
  assert.equal(c.matchs.find((x) => x.m.id === f.id)!.compte, true, "le forfait par présents compte");
  assert.equal(c.matchs.find((x) => x.m.id === deux[1].id)!.amical, "rencontres", "et prend l'une des deux rencontres de la saison (Q28)");
  assert.equal(ligne(c, A).pts, 2 + 2, "A : le forfait de B, puis la victoire 1 – 0");
  const vide = { ...f, buteurs: [{ equipe: A, joueur: "j9", name: "Badis", buts: 2, passes: 0 }] };
  assert.ok(!championnat(1, equipes, [vide], apres).buteurs.some((x) => x.joueur === "j9"), "un forfait n'a pas de buteurs");
  const nc = etatMatch(match([0, 0], [3, 3]), apres);
  assert.equal(nc.etat, "non-classe", "les deux à 3 ou moins : non classé");
  assert.deepEqual(scoreFinal([0, 0], [3, 3]).nonClasse, true);
}

// 4 · Des présents qui ne collent pas : litige, puis non classé.
{
  const m = match([2, 1], [5, 5]);
  m.saisies[1] = { ...m.saisies[1], presents: 5, presentsAdverses: 4 };
  assert.equal(collent(m.saisies[0], m.saisies[1]), false, "le score colle, pas les présents");
  assert.equal(etatMatch(m, new Date("2026-11-15T12:00:00Z")).etat, "litige");
  assert.equal(etatMatch(m, new Date("2026-11-18T12:00:00Z")).etat, "non-classe", "la feuille fermée sans accord : non classé");
  const ok = match([2, 1], [4, 5]);
  assert.equal(collent(ok.saisies[0], ok.saisies[1]), true, "les présents vus de chaque côté collent");
}

// 5 · Une saisie seule avec un 5 contre 4 : validée au bout de 24 h, présents compris.
{
  const m = match([2, 2], [5, 4], { seule: true });
  const avant = etatMatch(m, new Date("2026-11-15T12:00:00Z"));
  assert.equal(avant.etat, "a-confirmer");
  const apres24 = etatMatch(m, new Date("2026-11-15T22:00:00Z"));
  assert.ok(apres24.etat === "valide" && apres24.aQuatre === B);
  assert.deepEqual(apres24.etat === "valide" && apres24.final, [2, 1], "seule, la saisie vaut avec ses présents");
  const parB = match([2, 2], [5, 4], { seule: true });
  parB.saisies = [{ equipe: B, pour: 2, contre: 2, le: "2026-11-14T21:30:00Z", presents: 4, presentsAdverses: 5 }];
  const eB = etatMatch(parB, apres);
  assert.ok(eB.etat === "valide" && eB.aQuatre === B, "la saisie de l'équipe à 4 elle-même vaut aussi");
}

// 6 · Une feuille d'avant le 03/11/2026 : pas de présents, rien ne change.
{
  const m = match([3, 1], [5, 5], { sans: true });
  const e = etatMatch(m, apres);
  assert.ok(e.etat === "valide" && e.aQuatre === null && e.forfaitDe === null);
  assert.deepEqual(e.etat === "valide" && [e.buts, e.final], [[3, 1], [3, 1]]);
  assert.deepEqual(e.etat === "valide" && e.presents, [5, 5]);
  const forfait: MatchTeam = { ...m, statut: "forfait", forfaitDe: A, saisies: [] };
  const ef = etatMatch(forfait, apres);
  assert.ok(ef.etat === "valide" && ef.forfaitDe === A);
  assert.deepEqual(ef.etat === "valide" && ef.final, [0, 3], "un forfait par annulation, comme avant");
}

// 7 · La carte d'entraîneur : le score du terrain, et le forfait par présents comme un forfait.
{
  const lecture = new Date("2026-11-30T12:00:00Z");
  const m = match([3, 4], [5, 4]);
  const c = championnat(1, equipes, [m], lecture);
  const mc = c.matchs.find((x) => x.m.id === m.id)!;
  assert.deepEqual(rencontreComptee(mc, B, lecture), { pour: 4, contre: 3, forfait: false, aQuatre: "nous", saisieSeule: false, litige: false }, "rés lit le score du terrain");
  const f = match([0, 0], [5, 3]);
  const cf = championnat(1, equipes, [f], lecture);
  const mf = cf.matchs.find((x) => x.m.id === f.id)!;
  assert.deepEqual(rencontreComptee(mf, B, lecture), { pour: 0, contre: 3, forfait: true, aQuatre: null, saisieSeule: false, litige: false }, "son forfait par présents est un forfait");
  assert.equal(rencontreComptee(mf, A, lecture), null, "le forfait de l'adversaire ne dit rien de lui");
  const amical = match([1, 1], [4, 4]);
  const ca = championnat(1, equipes, [amical], lecture);
  assert.equal(rencontreComptee(ca.matchs.find((x) => x.m.id === amical.id)!, A, lecture), null, "deux équipes à 4 : rien ne compte");
}

// 8 · La saisie seule de la dernière minute : l'autre équipe a ses 24 h, elle seule.
{
  const m = match([2, 1], [5, 5], { seule: true });
  const ferme = fermeture(m).getTime();
  // B saisit seul, deux minutes avant la fermeture : « A à 3 ou moins » (un forfait de A).
  m.saisies = [{ equipe: B, pour: 0, contre: 0, le: new Date(ferme - 120_000).toISOString(), presents: 5, presentsAdverses: 3 }];
  assert.equal(fermeturePour(m, A).getTime(), ferme - 120_000 + 24 * 3_600_000, "A peut répondre jusqu'à 24 h après la saisie de B");
  assert.equal(fermeturePour(m, B).getTime(), ferme, "B, lui, ne change plus la sienne après la fermeture");
  const e = etatMatch(m, new Date(ferme + 3_600_000));
  assert.ok(e.etat === "a-confirmer" && e.ferme.getTime() === ferme - 120_000 + 24 * 3_600_000, "à confirmer, et A sait jusqu'à quand");
  // A répond une heure après la fermeture, autre chose : un litige, qu'A peut corriger jusqu'au bout de ses 24 h.
  m.saisies.push({ equipe: A, pour: 2, contre: 1, le: new Date(ferme + 3_600_000).toISOString(), presents: 5, presentsAdverses: 5 });
  const l = etatMatch(m, new Date(ferme + 2 * 3_600_000));
  assert.ok(l.etat === "litige" && l.ferme.getTime() === ferme - 120_000 + 24 * 3_600_000, "le litige reste ouvert le temps de la réponse");
  assert.equal(fermeturePour(m, A).getTime(), ferme - 120_000 + 24 * 3_600_000, "A peut encore corriger la sienne");
  assert.equal(etatMatch(m, new Date(ferme + 25 * 3_600_000)).etat, "non-classe", "puis, sans accord : non classé");
  // Sans réponse, la saisie de B vaut à son heure (24 h après elle), comme avant.
  const seule = { ...m, saisies: [m.saisies[0]] };
  assert.equal(etatMatch(seule, new Date(ferme + 24 * 3_600_000)).etat, "valide");
  // Une saisie seule faite tôt : rien de plus que la fermeture.
  const tot = { ...m, saisies: [{ ...m.saisies[0], le: new Date(ferme - 48 * 3_600_000).toISOString() }] };
  assert.equal(fermeturePour(tot, A).getTime(), ferme);
}

// 9 · Un litige jamais tranché, pour la carte d'entraîneur : la version de l'adversaire, s'il aurait été classé.
{
  const lecture = new Date("2026-11-30T12:00:00Z");
  // B perd 1 – 3 (le dit), A dit avoir gagné 3 – 0 : un litige, non classé au championnat.
  const m = match([3, 1], [5, 5]);
  m.saisies[0] = { ...m.saisies[0], contre: 0 };
  const c = championnat(1, equipes, [m], lecture);
  const mc = c.matchs.find((x) => x.m.id === m.id)!;
  assert.equal(mc.etat.etat, "non-classe");
  assert.equal(mc.compte, false, "le championnat ne le classe pas");
  assert.equal(mc.classable, true, "mais il l'aurait classé");
  assert.deepEqual(rencontreComptee(mc, A, lecture), { pour: 3, contre: 1, forfait: false, aQuatre: null, saisieSeule: false, litige: true }, "pour A, la version de B");
  assert.deepEqual(rencontreComptee(mc, B, lecture), { pour: 0, contre: 3, forfait: false, aQuatre: null, saisieSeule: false, litige: true }, "pour B, la version de A");
  // Trois rencontres validées contre la même équipe : la troisième est un amical, son litige n'aurait pas compté non plus.
  const v = [match([1, 0], [5, 5], { jour: "2026-11-07" }), match([2, 0], [5, 5], { jour: "2026-11-10" })];
  const t = match([3, 1], [5, 5], { jour: "2026-11-14" });
  t.saisies[0] = { ...t.saisies[0], contre: 0 };
  const ct = championnat(1, equipes, [...v, t], lecture).matchs.find((x) => x.m.id === t.id)!;
  assert.equal(ct.classable, false);
  assert.equal(rencontreComptee(ct, A, lecture), null);
}

// 10 · Le gel de fin de saison : les 14 derniers jours (heure de Paris), les mêmes que equipe_gel.
{
  const gel = (iso: string) => enGel(new Date(iso));
  assert.deepEqual(
    [gel("2026-10-31T11:00:00Z"), gel("2026-11-01T00:00:00+01:00"), gel("2027-02-14T22:59:00Z"), gel("2027-02-14T23:00:00Z"), gel("2027-02-28T22:59:00Z")],
    [false, false, false, true, true]
  );
  assert.deepEqual([gel("2027-02-28T23:00:00Z"), gel("2027-06-16T21:59:00Z"), gel("2027-06-16T22:00:00Z"), gel("2027-10-17T21:59:00Z"), gel("2027-10-17T22:00:00Z")], [false, false, true, false, true]);
  assert.deepEqual([gel("2028-02-15T11:00:00Z"), gel("2028-02-15T23:00:00Z"), gel("2028-02-29T22:59:00Z"), gel("2028-02-29T23:00:00Z")], [false, true, true, false], "février 2028 a 29 jours");
}

console.log("championnat-team-check : ok");
