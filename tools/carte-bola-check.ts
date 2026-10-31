// Vérifie la carte, l'XP, la carte MVP et les missions perso d'un joueur
// Bola (lib/sfl/carte-bola.ts, lib/sfl/missions-perso.ts) :
//   npx tsx tools/carte-bola-check.ts
import assert from "node:assert/strict";
import { BASE_BOLA, carteBola, cartesDesJoueursBola, cartesSuccessives, enDirect, evolutionBrute, mesMatchsValides, RAISON_SERIE_BOLA, saisonBola, saisonsBolaDe } from "../src/lib/sfl/carte-bola";
import { ovr } from "../src/lib/sfl/engine";
import { classementAVie, compterMatchs, type LigneBola, type MatchBola } from "../src/lib/sfl/ligue-vierge";
import { bilanDe, classementNiveau, journalXp, rangsDesJoueurs, XP_DIMANCHE } from "../src/lib/sfl/missions";
import { ajouterBola, instantParis, lignesXpBola, missionsPerso, semaineDe } from "../src/lib/sfl/missions-perso";
import { vitrine } from "../src/lib/sfl/trophees";
import { EPREUVES, EPREUVES_BOLA } from "../src/lib/sfl/passe";
import { deriveSeason, statsCarteTitre } from "../src/lib/sfl/saisie/engine";
import { evoluer } from "../src/lib/sfl/saisie/evolution";
import type { Saison } from "../src/lib/sfl/saisie/types";
import { seedSaison } from "../src/lib/sfl/saisie/store";

const MOI = "u-moi";
const NOM = "Yanis";
let seq = 0;
/** Un match de 8 : moi chez les clairs avec mes buts et passes ; un autre clair et deux foncés peuvent marquer. */
function match(
  jour: string,
  heure: string,
  moi: { buts: number; passes: number },
  score: [number, number],
  opts: { etat?: MatchBola["etat"]; joueurs?: number; genre?: MatchBola["genre"]; autre?: { buts: number; passes: number } } = {}
): MatchBola {
  const n = opts.joueurs ?? 8;
  const joueurs: LigneBola[] = [{ id: MOI, name: NOM, equipe: "clairs", ...moi }];
  for (let i = 1; i < n; i++)
    joueurs.push({ id: `p${i}`, name: `J${i}`, equipe: i < n / 2 ? "clairs" : "fonces", buts: 0, passes: 0, ...(i === 1 && opts.autre ? opts.autre : {}) });
  return {
    id: ++seq,
    jour,
    heure,
    genre: opts.genre ?? "match",
    scoreClairs: score[0],
    scoreFonces: score[1],
    joueurs,
    ...(opts.etat !== undefined ? { etat: opts.etat } : {}),
  };
}

// ── 1. La carte : la même échelle que la SFL ──
const trois = [
  match("2026-10-20", "19h00", { buts: 2, passes: 0 }, [5, 1], { autre: { buts: 3, passes: 0 } }),
  match("2026-10-22", "19h00", { buts: 0, passes: 1 }, [2, 1], { autre: { buts: 2, passes: 0 } }),
  match("2026-10-24", "19h00", { buts: 1, passes: 1 }, [2, 0]),
];
const c3 = carteBola(compterMatchs(trois), MOI, NOM, "Attaquant");
assert.equal(c3.valides.length, 3);
// Match 1 : 2 buts → TIR 2 crans (jauge 2 sous 80) → TIR 76.
// Match 2 : 1 passe → PAS 1 cran. Match 3 : 1 but, 1 passe, MVP (2 = buts+passes, seul) → TIR +1 cran,
// PAS +1 cran (→ 76), MVP 2 crans sur ses deux meilleures (TIR 76 puis VIT 75, l'ordre de la carte) ;
// série de 3 matchs → PHY 3 crans.
assert.equal(c3.valides[2].ligne.mvp, true);
const ev3 = evolutionBrute(c3.valides, NOM)!;
const f3 = ev3.journal[0].faits.map((f) => `${f.raison}>${f.stat}:${f.crans}`);
assert.ok(f3.includes(`${RAISON_SERIE_BOLA}>PHY:3`), f3.join(", "));
assert.equal(RAISON_SERIE_BOLA, "3 matchs validés");
assert.deepEqual(c3.stats, enDirect(ev3));
assert.equal(c3.stats.TIR, 77, "TIR : 2 crans puis 1 + 2 MVP = 76 puis 77");
assert.equal(c3.stats.PAS, 76);
assert.equal(c3.stats.PHY, 76, "PHY : 3 crans pour 3 matchs de suite → +1, 1 cran en jauge");
assert.equal(c3.stats.VIT, 77, "VIT : 2 crans MVP → +1, puis +1 combinée (TIR et PAS ont pris un point)");
assert.deepEqual(c3.valides.map((v) => v.ligne.mvp), [false, false, true]);
// la note bouge à chaque match et ne descend jamais
assert.deepEqual(
  c3.notes.map((n) => n.note),
  c3.notes.map((n) => n.note).slice().sort((a, b) => a - b)
);
assert.ok(c3.notes[2].note > ovr(BASE_BOLA));

// Même échelle : la saison synthétique jouée par le moteur SFL donne la même carte en direct.
const sfl = evoluer({ ...saisonBola(c3.valides, NOM) }, () => BASE_BOLA);
const evS = sfl.joueurs.get(NOM)!;
for (const k of Object.keys(BASE_BOLA) as (keyof typeof BASE_BOLA)[]) assert.equal(enDirect(evS)[k], c3.stats[k], k);
// Au bout de 4 matchs, la mise à jour tombe : la carte en direct ne bouge pas d'un cran à ce moment-là.
const quatre = [...trois, match("2026-10-26", "19h00", { buts: 0, passes: 0 }, [0, 1])];
const c4 = carteBola(compterMatchs(quatre), MOI, NOM, null);
for (const k of Object.keys(BASE_BOLA) as (keyof typeof BASE_BOLA)[]) assert.ok(c4.stats[k] >= c3.stats[k], k);
assert.equal(c4.ev!.majs.length, 0, "aucune mise à jour à l'écran");
assert.deepEqual(c4.ev!.enAttente, {});
assert.equal(c4.player.poste, "—");
assert.equal(c4.player.matchs, 4);
assert.equal(c4.player.buts, 3);
assert.equal(c4.player.mvp, 1);

// ── 2. Ce qui ne compte pas ──
const ignores = [
  match("2026-10-20", "19h00", { buts: 3, passes: 0 }, [3, 0], { etat: "en_attente" }),
  match("2026-10-20", "20h00", { buts: 3, passes: 0 }, [3, 0], { etat: "conteste" }),
  match("2026-10-20", "21h00", { buts: 3, passes: 0 }, [3, 0], { etat: "ne_compte_pas" }),
  match("2026-10-21", "19h00", { buts: 3, passes: 0 }, [3, 0], { joueurs: 7 }),
  match("2026-10-21", "20h00", { buts: 3, passes: 0 }, [3, 0], { genre: "exhibition" }),
];
const cI = carteBola(compterMatchs(ignores), MOI, NOM, null);
assert.equal(cI.valides.length, 0);
assert.deepEqual(cI.stats, BASE_BOLA);
assert.equal(cI.cartesMvp.length, 0);
assert.equal(missionsPerso(cI.valides, new Date("2026-10-22T12:00:00Z")).faites.length, 0);
// Un match « compte », ou sans état (saisi avant le 28/10) : compté.
assert.equal(carteBola(compterMatchs([match("2026-10-20", "19h", { buts: 1, passes: 0 }, [1, 0], { etat: "compte" }), match("2026-10-19", "19h", { buts: 1, passes: 0 }, [1, 0])]), MOI, NOM, null).valides.length, 2);
// Pas sur la feuille : rien.
assert.equal(mesMatchsValides(compterMatchs(trois), "inconnu").length, 0);

// ── 3. Deux matchs le même jour : les deux pour la carte, un seul classé ──
const memeJour = [match("2026-10-20", "18h00", { buts: 1, passes: 0 }, [1, 0]), match("2026-10-20", "21h00", { buts: 1, passes: 0 }, [1, 0])];
const cm = compterMatchs(memeJour);
assert.equal(mesMatchsValides(cm, MOI).length, 2);
assert.equal(classementAVie(cm).find((c) => c.id === MOI)!.matchs, 1);

// ── 4. Cartes MVP ──
const mvp = [
  match("2026-10-20", "19h00", { buts: 2, passes: 1 }, [3, 0]),
  match("2026-10-21", "19h00", { buts: 1, passes: 1 }, [2, 0], { autre: { buts: 1, passes: 1 } }), // ex æquo parfait
  match("2026-10-22", "19h00", { buts: 0, passes: 0 }, [0, 0], { autre: { buts: 0, passes: 0 } }), // personne
];
const cM = compterMatchs(mvp);
assert.deepEqual(cM[1].mvps.sort(), ["p1", MOI].sort());
const cMv = carteBola(cM, MOI, NOM, "Milieu");
assert.equal(cMv.cartesMvp.length, 2);
assert.equal(new Set(cMv.cartesMvp.map((c) => c.carte.date)).size, 2, "une date par match");
assert.equal(cMv.cartesMvp[0].carte.date, "Bola · 20 oct. · 19h00");
assert.deepEqual(cMv.cartesMvp[0].carte.stats, statsCarteTitre(BASE_BOLA, "mvp", 2, 1), "la base : 75 avant le premier match");
const avant2 = enDirect(evolutionBrute(cMv.valides.slice(0, 1), NOM)!);
assert.deepEqual(cMv.cartesMvp[1].carte.stats, statsCarteTitre(avant2, "mvp", 1, 1), "la base : la carte d'avant le match");
assert.equal(cMv.cartesMvp[1].carte.type, "mvp");
assert.equal(cMv.cartesMvp[1].carte.ovr, ovr(cMv.cartesMvp[1].carte.stats));

// ── 5. Missions ──
assert.equal(semaineDe("2026-10-25"), "2026-10-19"); // dimanche
assert.equal(semaineDe("2026-10-26"), "2026-10-26"); // lundi
assert.equal(semaineDe("2026-10-19"), "2026-10-19");
const mi = [
  match("2026-10-19", "19h00", { buts: 3, passes: 0 }, [3, 0]), // lun : Triplé, MVP, V1
  match("2026-10-21", "19h00", { buts: 3, passes: 3 }, [4, 0]), // mer : Triplé déjà fait ; Triple caviar ; Série (V2)
  match("2026-10-21", "21h00", { buts: 0, passes: 0 }, [0, 0], { etat: "en_attente" }), // ignoré, ne casse rien
  match("2026-10-22", "19h00", { buts: 0, passes: 0 }, [1, 0], { autre: { buts: 1, passes: 0 } }), // jeu : 3 jours → Régulier ; V1
  match("2026-10-25", "23h30", { buts: 0, passes: 0 }, [0, 1]), // dim 23h30 : défaite, casse la série
  match("2026-10-26", "00h10", { buts: 3, passes: 0 }, [3, 0]), // lun 00h10 : nouvelle semaine : Triplé à nouveau
];
const valM = mesMatchsValides(compterMatchs(mi), MOI);
assert.equal(valM.length, 5);
const bp = missionsPerso(valM, new Date("2026-10-26T10:00:00Z"));
assert.deepEqual(
  bp.faites.map((f) => `${f.semaine}:${f.genre}`),
  ["2026-10-19:triple", "2026-10-19:mvp", "2026-10-19:caviar", "2026-10-19:serie", "2026-10-19:regulier", "2026-10-26:triple", "2026-10-26:mvp"]
);
assert.equal(bp.faites.filter((f) => f.troisieme).length, 1);
assert.equal(bp.faites.find((f) => f.troisieme)!.genre, "caviar");
const prog = Object.fromEntries(bp.semaine.map((p) => [p.m.genre, `${p.progres}/${p.m.objectif}${p.faite ? "✓" : ""}`]));
assert.deepEqual(prog, { triple: "3/3✓", caviar: "0/3", mvp: "1/1✓", regulier: "1/3", serie: "1/2" });
// Régulier : trois matchs le même jour ne suffisent pas.
const tripleJour = [0, 1, 2].map((i) => match("2026-10-20", `${18 + i}h00`, { buts: 0, passes: 0 }, [0, 1]));
assert.equal(missionsPerso(mesMatchsValides(compterMatchs(tripleJour), MOI), new Date("2026-10-20T22:00:00Z")).faites.length, 0);
// Série : enjambe deux semaines, et un nul la casse.
const serie = [match("2026-10-25", "19h00", { buts: 0, passes: 0 }, [1, 0]), match("2026-10-26", "19h00", { buts: 0, passes: 0 }, [1, 0])];
assert.deepEqual(missionsPerso(mesMatchsValides(compterMatchs(serie), MOI), new Date("2026-10-27T10:00:00Z")).faites.map((f) => `${f.semaine}:${f.genre}`), ["2026-10-26:serie"]);
const casse = [match("2026-10-20", "19h", { buts: 0, passes: 0 }, [1, 0]), match("2026-10-21", "19h", { buts: 0, passes: 0 }, [1, 1]), match("2026-10-22", "19h", { buts: 0, passes: 0 }, [1, 0])];
assert.ok(!missionsPerso(mesMatchsValides(compterMatchs(casse), MOI), new Date("2026-10-23T10:00:00Z")).faites.some((f) => f.genre === "serie"));

// ── 6. XP ──
const seed = seedSaison();
const maintenant = new Date("2026-10-27T10:00:00Z");
const lignes = lignesXpBola(valM, bp.faites, seed, maintenant);
assert.equal(lignes.filter((l) => l.quoi === "Match Bola").length, 5);
assert.ok(lignes.filter((l) => l.quoi === "Match Bola").every((l) => l.xp === XP_DIMANCHE));
assert.ok(lignes.every((l) => l.horsRang && l.bola));
assert.equal(
  lignes.reduce((a, l) => a + l.xp, 0),
  5 * 100 + 150 + 120 + 150 + 110 + 100 + 150 + 120
);
assert.equal(lignes.find((l) => l.quoi === "Mission Triplé")!.mission!.rang, "S");
assert.equal(lignes.find((l) => l.quoi === "Mission Régulier")!.mission!.rang, "A");
// Un match à venir (heure future) ne rapporte rien.
assert.equal(lignesXpBola(valM, bp.faites, seed, new Date("2026-10-19T12:00:00")).length, 0);

const journal = journalXp(seed, [], [], maintenant);
const avantRangs = rangsDesJoueurs(classementNiveau(journal, deriveSeason(seed).players, { pourLeRang: true }));
const nomSfl = deriveSeason(seed).players[0].name;
const j2 = new Map(journal);
ajouterBola(j2, nomSfl, lignes);
const apresRangs = rangsDesJoueurs(classementNiveau(j2, deriveSeason(seed).players, { pourLeRang: true }));
assert.deepEqual([...apresRangs], [...avantRangs], "le rang B, A, S ne bouge pas");
// Le Passe d'un joueur Bola : ses épreuves ouvrent les paliers ; celles de la SFL l'arrêteraient au 4.
const jb = new Map<string, { lignes: typeof lignes; reussies: number }>();
const beaucoup = [...lignes];
const unMatch = lignes.find((l) => l.quoi === "Match Bola")!;
for (let i = 0; i < 30; i++) beaucoup.push({ ...unMatch });
ajouterBola(jb, NOM, beaucoup);
// La saison du Passe de fin octobre 2026 : la Saison 1 (saisons-passe.ts).
const finOctobre = new Date("2026-10-30T12:00:00Z");
const bSfl = bilanDe(jb, NOM, finOctobre, EPREUVES);
const bBola = bilanDe(jb, NOM, finOctobre, EPREUVES_BOLA);
assert.equal(bSfl.passe.palier, 4, "« Signer » ne s'ouvre pas avec une mission perso");
assert.ok(bBola.passe.palier >= 5, `palier Bola ${bBola.passe.palier}`);
assert.ok(bBola.passe.epreuves.every((e) => e.j !== null), "les quatre épreuves Bola faites");
assert.equal(jb.get(NOM)!.reussies, 7);
// Aucune épreuve de la SFL ne s'ouvre avec une ligne Bola (rang S d'une mission perso compris) :
// le Passe SFL d'un filleul entré en SFL ne change pas.
assert.ok(lignes.some((l) => l.mission?.rang === "S"));
assert.ok(bSfl.passe.epreuves.every((e) => e.j === null), "aucune épreuve SFL par le Bola");
for (const e of EPREUVES) assert.ok(!lignes.some((l) => e.faite(l)), `épreuve SFL ${e.romain}`);

// ── 6 bis. L'heure du match est celle de Paris, quel que soit le téléphone ──
assert.equal(instantParis("2026-10-20", "19h00").toISOString(), "2026-10-20T17:00:00.000Z"); // été
assert.equal(instantParis("2026-10-26", "19h00").toISOString(), "2026-10-26T18:00:00.000Z"); // hiver
assert.equal(instantParis("2026-10-25", "03h30").toISOString(), "2026-10-25T02:30:00.000Z"); // la nuit du changement
assert.equal(instantParis("2026-03-29", "12:00").toISOString(), "2026-03-29T10:00:00.000Z");
// Match validé 30 min après son coup d'envoi : son XP est là, même sur un téléphone à New York.
const juste = mesMatchsValides(compterMatchs([match("2026-10-27", "20h00", { buts: 0, passes: 0 }, [1, 0])]), MOI);
assert.equal(lignesXpBola(juste, [], seed, new Date("2026-10-27T19:30:00Z")).length, 1);
assert.equal(lignesXpBola(juste, [], seed, new Date("2026-10-27T18:59:00Z")).length, 0);

// ── 6 ter. La courbe en un passage, la Ligue, les badges ──
const succ = cartesSuccessives(c4.valides, NOM);
assert.equal(succ.length, 5);
assert.deepEqual(succ[0], BASE_BOLA);
assert.deepEqual(succ[4], c4.stats);
assert.deepEqual(c4.notes.map((n) => n.note), succ.slice(1).map(ovr));
// La Ligue : la carte d'un autre joueur ne suit que ses lignes `carteBola` (filleul, avant son entrée en SFL).
const marques = compterMatchs(quatre.map((m, i) => ({ ...m, joueurs: m.joueurs.map((j) => ({ ...j, carteBola: j.id === MOI ? i < 3 : false })) })));
const ligue = cartesDesJoueursBola(marques);
assert.deepEqual(ligue.get(MOI)!.stats, c3.stats, "trois lignes comptées sur quatre");
assert.equal(ligue.get(MOI)!.matchs, 3);
assert.deepEqual(ligue.get("p1")!.stats, BASE_BOLA, "non filleul : 75");
assert.equal(ligue.size, 8);
assert.equal(cartesDesJoueursBola(compterMatchs(quatre)).get(MOI)!.matchs, 0, "sans drapeau : rien ne compte");
// Badges : mes matchs Bola validés y comptent, sur mon téléphone ; pas pour un autre nom.
const vSans = vitrine(seed, NOM);
const vAvec = vitrine(seed, NOM, undefined, saisonsBolaDe(cMv, NOM));
const val = (v: typeof vSans, id: string) => v.find((e) => e.def.id === id)!.valeur;
assert.equal(val(vAvec, "mvp") - val(vSans, "mvp"), 2);
assert.equal(val(vAvec, "matchs") - val(vSans, "matchs"), 3);
assert.equal(val(vAvec, "buts") - val(vSans, "buts"), 3);
assert.equal(val(vAvec, "victoires") - val(vSans, "victoires"), 2);
assert.equal(saisonsBolaDe(cMv, "Autre").length, 0);

// ── 7. La SFL ne change pas ──
const snap = (s: Saison) => {
  const d = deriveSeason(s);
  return JSON.stringify({ p: d.players, b: d.boostCards, x: [...journalXp(s, [], [], maintenant)].map(([n, v]) => [n, v.lignes.length, v.lignes.reduce((a, l) => a + l.xp, 0)]) });
};
const ref = snap(seed);
assert.ok(ref.length > 1000);
assert.equal(snap(seed), ref);
assert.ok(!journalXp(seed, [], [], maintenant).get(nomSfl)!.lignes.some((l) => l.bola));

console.log("carte-bola-check : tout passe");
