// La carte d'entraîneur de Bola Team (étude du 02/11/2026, branche coach-etude,
// troisième version revue après la relecture : trois caractéristiques, rés,
// pré, coh ; les défauts D1 à D13 de la relecture vérifiés fermés) :
//   0. trois caractéristiques de trois lettres, aucune déjà prise ;
//   1. rien ne descend ; tout reste entre 75 et 99 ; la note est l'arrondi
//      supérieur de la moyenne des trois ;
//   2. dans la moyenne, il reste à 75 (200 rencontres) ; avec le hasard, un
//      entraîneur moyen ne monte presque pas avec l'ancienneté (D7) ;
//   3. le score du championnat lu 24 h après la fermeture (D3), seulement si
//      le championnat classe la rencontre (D11) ; un litige et le forfait de
//      l'adversaire ne comptent pas ; la saisie restée seule de son camp est
//      signalée ;
//   4. pré : forfait −3, 5 contre 4 −1, sinon 0 ; un chiffre que seul son
//      camp déclare ne compte pas (D1, D9) ; reprendre une équipe fiable ne
//      paie pas, la redresser si (D6) ;
//   5. coh : une exclusion vaut un départ ; dissolution et changement de
//      place ne comptent pas ; les fantômes et l'inactivité ne paient pas
//      (D4) ; partir entre deux mises à jour n'efface pas les départs (D5) ;
//   6. rés : l'attendu vient des cartes, pas de ses résultats (D2) ; une
//      rencontre par adversaire et par saison ; sa saisie seule ne compte que
//      contre lui ; le 5 contre 4 compté une fois (D10) ; le journal en mots
//      (D13) ;
//   7. les normes de chaque saison figées, la carte officielle en plancher
//      (D8) ;
//   8. les trois saisons de Lucien donnent la carte des captures ;
//   9. les matières : ni or, ni bleu, ni rouge, ni la braise, ni le mauve ;
//      aucune n'entre dans les finitions d'un joueur ;
//  10. le barème lent (Ilyes, 02/11 : la note lente), épinglé, et pas le vif ;
//  11. une saisie restée seule de son camp ne compte que contre lui, en pré
//      aussi ;
//  12. ses places s'enchaînent : ses compteurs le suivent, jamais deux mises
//      à jour le même mois ; avant les feuilles d'avant-match, tout joueur
//      compte actif.
//   npx tsx tools/entraineur-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  activite,
  attenduDe,
  BAREME_ENTRAINEUR,
  CLES_ENTRAINEUR,
  championDe,
  evoluerCarrieres,
  evoluerEntraineur,
  numeroDuJour,
  faceEntraineur,
  forceFeuille,
  LIBELLES_ENTRAINEUR,
  noteEntraineur,
  rencontreComptee,
  valeurPresence,
  type CarriereEntraineur,
  type CleEntraineur,
  type EquipeAvant,
  type MembreEntraineur,
  type NormesLigue,
  type RencontreEntraineur,
} from "../src/lib/sfl/entraineur";
import { CARRIERE_DEMO, EQUIPE_DEMO } from "../src/lib/sfl/entraineur-demo";
import type { MatchCompteTeam, MatchTeam } from "../src/lib/sfl/championnat-team";
import { FINITIONS, MATIERES } from "../src/components/sfl/finitions-carte";
import { MATIERES_ENTRAINEUR } from "../src/components/sfl/skins-entraineur";

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const IDS = ["a", "b", "c", "d", "e", "f", "g"];
const jour = (k: number) => new Date(Date.UTC(2026, 10, 7) + k * 86_400_000).toISOString().slice(0, 10);
const membres = (n = 7): MembreEntraineur[] => IDS.slice(0, n).map((id) => ({ id, nom: id.toUpperCase(), arrivee: "2026-08-01", derniereFeuille: "2026-10-31" }));
const feuille = (n = 6, note = 75) => IDS.slice(0, n).map((id) => ({ id, note }));
let n = 0;
/**
 * Une rencontre « dans la moyenne » : une semaine après l'autre, deux feuilles de même force (l'attendu 0,5), un nul,
 * six inscrits, un adversaire nouveau à chaque fois.
 */
const match = (k: number, o: Partial<RencontreEntraineur> = {}): RencontreEntraineur => ({
  id: `m${String(++n).padStart(4, "0")}`,
  le: jour(k * 7),
  saison: 1,
  adversaire: 1000 + n,
  forfait: false,
  pour: 2,
  contre: 2,
  cinqContreQuatre: null,
  feuille: feuille(),
  adverses: [75, 75, 75, 75, 75, 75],
  ...o,
});
const carriere = (rencontres: RencontreEntraineur[], m = membres(), o: Partial<CarriereEntraineur> = {}): CarriereEntraineur => ({ arrivee: "2026-11-01", rencontres, membres: m, ...o });
/** Des normes où la rencontre ci-dessus est exactement dans la moyenne, et où personne ne part. */
const NORMES: Partial<Record<number, NormesLigue>> = { 1: { presence: 0, departsParJour: 0 } };
const gain = (ev: ReturnType<typeof evoluerEntraineur>, k: CleEntraineur) => ev.officielles[k] - 75;
const moy = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

// 0 · Trois caractéristiques, trois lettres, aucune de joueur, de gardien ou d'arbitre.
{
  assert.equal(CLES_ENTRAINEUR.length, 3);
  const prises = ["vit", "tir", "pas", "dri", "def", "déf", "phy", "plo", "réf", "dég", "jma", "pla", "mat", "avis", "top", "der"];
  for (const k of CLES_ENTRAINEUR) {
    const l = LIBELLES_ENTRAINEUR[k];
    assert.equal([...l].length, 3, `${l} : trois lettres`);
    assert.ok(!prises.includes(l), `${l} est déjà pris`);
  }
  // Sous la note, trois chiffres et pas un de plus : son équipe sous son nom, pas ses rencontres.
  const face = faceEntraineur({ RES: 78, PRES: 76, COH: 75 }, { equipe: EQUIPE_DEMO });
  assert.equal(face.stats.length, 3);
  assert.equal(face.detail, "mons academy");
  assert.ok(!/\d/.test(face.detail ?? ""), "aucun nombre sous le nom");
}

// 1 · Rien ne descend, tout reste entre 75 et 99, la note est l'arrondi supérieur de la moyenne.
{
  const rnd = mulberry32(7);
  const rs = Array.from({ length: 160 }, (_, k) => {
    const forfait = rnd() < 0.05;
    return match(k, {
      saison: 1 + Math.floor(k / 16),
      adversaire: Math.floor(rnd() * 30),
      pour: Math.floor(rnd() * 7),
      contre: Math.floor(rnd() * 7),
      forfait,
      cinqContreQuatre: !forfait && rnd() < 0.06 ? "nous" : null,
      feuille: forfait ? [] : feuille(5 + Math.floor(rnd() * 3), 70 + Math.floor(rnd() * 10)),
      adverses: Array.from({ length: 6 }, () => 70 + Math.floor(rnd() * 10)),
    });
  });
  const m = membres();
  m[1].depart = { le: jour(40), motif: "exclusion" };
  m.push({ id: "h", nom: "H", arrivee: jour(45) });
  const ev = evoluerEntraineur(carriere(rs, m));
  const suite = [...ev.majs].reverse();
  assert.ok(suite.length >= 30, "une mise à jour toutes les 4 rencontres, une par mois au plus");
  const mois = suite.map((x) => x.apres.slice(0, 7));
  assert.equal(new Set(mois).size, mois.length, "jamais deux mises à jour le même mois");
  let avant = ev.depart;
  for (const x of suite) {
    for (const k of CLES_ENTRAINEUR) {
      assert.ok(x.stats[k] >= avant[k], `${k} descend après ${x.apres}`);
      assert.ok(x.stats[k] >= 75 && x.stats[k] <= 99, `${k} hors de 75–99`);
    }
    avant = x.stats;
  }
  assert.equal(noteEntraineur({ RES: 80, PRES: 81, COH: 80 }), 81);
  assert.equal(noteEntraineur({ RES: 78, PRES: 76, COH: 75 }), 77);
  assert.equal(noteEntraineur({ RES: 75, PRES: 75, COH: 75 }), 75);
}

// 2 · Dans la moyenne, il reste à 75 ; avec le hasard, l'ancienneté ne paie presque pas.
{
  const ev = evoluerEntraineur(carriere(Array.from({ length: 200 }, (_, k) => match(k))), { normes: NORMES });
  assert.deepEqual(ev.officielles, { RES: 75, PRES: 75, COH: 75 });
  assert.equal(ev.rencontres, 200);
  // 200 rencontres au hasard, sans aucun effet réel (rés : l'attendu juste ; pré : 4 % de 5 contre 4, 1 % de forfaits).
  const rnd = mulberry32(2026);
  const hasard = (N: number, d: number) =>
    Array.from({ length: 150 }, () => {
      const rs = Array.from({ length: N }, (_, k) => {
        const ecart = (rnd() - 0.5) * 12;
        const e = attenduDe(75 + ecart, 75);
        const u = rnd();
        const s = u < e - 0.1 + d ? 1 : u < e + 0.1 + d ? 0.5 : 0;
        const v = rnd();
        return match(k, {
          saison: 1 + Math.floor(k / 16),
          feuille: feuille(6, 75 + ecart),
          pour: s === 1 ? 3 : s ? 2 : 1,
          forfait: v < 0.01,
          cinqContreQuatre: v >= 0.01 && v < 0.05 ? "nous" : null,
        });
      });
      return evoluerEntraineur(carriere(rs), { normes: { 1: { presence: -0.07, departsParJour: 0 } } }).officielles;
    });
  const longue = hasard(200, 0);
  const note = moy(longue.map(noteEntraineur));
  assert.ok(note < 76.6, `un entraîneur moyen, 200 rencontres au hasard : note ${note.toFixed(2)}`);
  const res0 = moy(hasard(64, 0).map((s) => s.RES));
  const res8 = moy(hasard(64, 0.08).map((s) => s.RES));
  assert.ok(res0 < 76, `rés au hasard, 64 rencontres : ${res0.toFixed(2)}`);
  assert.ok(res8 > res0 + 1, `rés d'un bon entraîneur (${res8.toFixed(2)}) contre le hasard (${res0.toFixed(2)})`);
  // Ce que la chance a donné se rembourse avant le prochain cran : deux victoires « contre plus fort », deux défaites « contre plus faible ».
  const yoyo = evoluerEntraineur(
    carriere(Array.from({ length: 8 }, (_, k) => match(k, { feuille: feuille(6, k % 2 ? 82 : 68), pour: k % 2 ? 0 : 3, contre: 1 }))),
    { normes: NORMES }
  );
  assert.equal(gain(yoyo, "RES"), 0);
}

// 3 · Le score du championnat, lu 24 h après la fermeture, seulement pour une rencontre classée.
{
  const base: MatchTeam = { id: 1, de: 10, a: 20, jour: "2026-11-14", heure: "20:00", lieu: "", statut: "accepte", forfaitDe: null, saisies: [], buteurs: [] };
  const classe = (m: MatchTeam, compte = true): MatchCompteTeam => ({ m, etat: { etat: "a-venir" }, saison: 1, compte });
  const apres = new Date("2026-11-25T12:00:00Z");
  // Son capitaine (équipe 10) ne saisit pas la défaite : l'adversaire saisit seul, ça compte quand même.
  const seule = { ...base, saisies: [{ equipe: 20, pour: 4, contre: 1, le: "2026-11-14T21:00:00Z" }] };
  assert.deepEqual(rencontreComptee(classe(seule), 10, apres), { pour: 1, contre: 4, forfait: false, saisieSeule: false });
  // D3 : la même défaite saisie seule par son capitaine à J+2 23 h compte aussi (lue 24 h après la fermeture).
  const tard = { ...base, saisies: [{ equipe: 10, pour: 1, contre: 4, le: "2026-11-17T18:00:00Z" }] };
  assert.deepEqual(rencontreComptee(classe(tard), 10, apres), { pour: 1, contre: 4, forfait: false, saisieSeule: true });
  // Avant la lecture, rien (en attente).
  assert.equal(rencontreComptee(classe(tard), 10, new Date("2026-11-17T20:00:00Z")), null);
  // D11 : une rencontre que le championnat ne classe pas (3e contre la même équipe, deux divisions d'écart) ne compte pas.
  assert.equal(rencontreComptee(classe(seule, false), 10, apres), null);
  // Un litige : ni pour l'un ni pour l'autre, en attendant la revue.
  const litige = { ...base, saisies: [{ equipe: 10, pour: 3, contre: 0, le: "2026-11-14T21:00:00Z" }, { equipe: 20, pour: 1, contre: 3, le: "2026-11-14T21:05:00Z" }] };
  assert.equal(rencontreComptee(classe(litige), 10, apres), null);
  // Le forfait de l'adversaire ne dit rien de lui ; le sien compte.
  assert.equal(rencontreComptee(classe({ ...base, statut: "forfait", forfaitDe: 20 }), 10, apres), null);
  assert.deepEqual(rencontreComptee(classe({ ...base, statut: "forfait", forfaitDe: 10 }), 10, apres), { pour: 0, contre: 3, forfait: true, saisieSeule: false });
}

// 4 · pré.
{
  assert.equal(valeurPresence({ forfait: true, cinqContreQuatre: null }).valeur, -3);
  assert.equal(valeurPresence({ forfait: false, cinqContreQuatre: "nous" }).valeur, -1);
  assert.equal(valeurPresence({ forfait: false, cinqContreQuatre: "eux" }).valeur, 0);
  assert.equal(valeurPresence({ forfait: false, cinqContreQuatre: null }).valeur, 0);
  // D1 : « au complet » ne compte pas tant que le check-in n'existe pas : une feuille de 7 venus vaut une feuille de 5.
  const sept = evoluerEntraineur(carriere(Array.from({ length: 40 }, (_, k) => match(k, { feuille: feuille(7) }))), { normes: NORMES });
  const cinq = evoluerEntraineur(carriere(Array.from({ length: 40 }, (_, k) => match(k, { feuille: feuille(5) }))), { normes: NORMES });
  assert.equal(sept.compteurs.PRES.avance, cinq.compteurs.PRES.avance);
  // Un forfait coûte plus que tout le reste : 4 forfaits contre 4 rencontres sans rien, à la norme 0.
  const f = evoluerEntraineur(carriere(Array.from({ length: 8 }, (_, k) => match(k, { forfait: k < 4 }))), { normes: NORMES });
  assert.equal(gain(f, "PRES"), 0);
  // D6 : reprendre une équipe fiable ne paie pas ; la redresser, si.
  const L = -0.1;
  const fiable: EquipeAvant = { rencontres: 16, presence: 0, joursActifs: 840, departs: 0 };
  const perdue: EquipeAvant = { rencontres: 16, presence: -0.75, joursActifs: 840, departs: 0 };
  const quarante = () => Array.from({ length: 40 }, (_, k) => match(k));
  const pres = (av?: EquipeAvant) => evoluerEntraineur(carriere(quarante(), membres(), { equipeAvant: av }), { normes: { 1: { presence: L, departsParJour: 0 } } }).officielles.PRES;
  assert.ok(pres(fiable) <= pres(undefined), "une équipe déjà fiable ne lui rapporte rien de plus");
  assert.ok(pres(perdue) >= pres(undefined) + 2, `une équipe redressée : pré ${pres(perdue)} contre ${pres(undefined)}`);
}

// 5 · coh : une exclusion vaut un départ ; dissolution et changement de place ne comptent pas ; fantômes, inactivité, fin de place.
{
  const N = { 1: { presence: 0, departsParJour: 0.0012 } };
  const quatre = () => Array.from({ length: 4 }, (_, k) => match(k));
  const coh = (motif: NonNullable<MembreEntraineur["depart"]>["motif"]) => {
    const m = membres();
    m[2].depart = { le: jour(10), motif };
    return evoluerEntraineur(carriere(quatre(), m), { normes: N }).compteurs.COH.avance;
  };
  const rien = evoluerEntraineur(carriere(quatre()), { normes: N }).compteurs.COH.avance;
  assert.ok(Math.abs(coh("exclusion") - coh("depart")) < 0.01, "une exclusion pèse comme un départ");
  assert.ok(Math.abs(rien - coh("depart") - 1) < 0.05, "un départ, un départ de moins que la moyenne");
  for (const motif of ["dissolution", "changement-de-place"] as const) assert.ok(coh(motif) > coh("depart") + 0.9, `${motif} ne compte pas`);
  // D4 : deux membres fantômes (jamais inscrits) ne gonflent rien.
  const avecFantomes = [...membres(), { id: "x", nom: "X", arrivee: "2026-08-01" }, { id: "y", nom: "Y", arrivee: "2026-08-01" }];
  const cent = () => Array.from({ length: 100 }, (_, k) => match(k));
  assert.equal(evoluerEntraineur(carriere(cent(), avecFantomes), { normes: N }).compteurs.COH.poids.toFixed(6), evoluerEntraineur(carriere(cent()), { normes: N }).compteurs.COH.poids.toFixed(6));
  // D4 : le départ d'un joueur absent des feuilles depuis plus de 60 jours ne compte pas.
  const absent = membres();
  absent.push({ id: "z", nom: "Z", arrivee: "2026-08-01", derniereFeuille: "2026-08-15", depart: { le: jour(10), motif: "depart" } });
  assert.ok(Math.abs(evoluerEntraineur(carriere(quatre(), absent), { normes: N }).compteurs.COH.avance - rien) < 1e-9, "le départ d'un joueur qui ne venait plus est neutre");
  // D4 : 4 rencontres, 10 mois sans match, 4 rencontres : pas plus que 60 jours d'exposition dans le trou.
  const trou = evoluerEntraineur(carriere([...quatre(), ...Array.from({ length: 4 }, (_, k) => match(k + 44))]), { normes: N }).compteurs.COH.poids;
  const suivi = evoluerEntraineur(carriere(Array.from({ length: 8 }, (_, k) => match(k))), { normes: N }).compteurs.COH.poids;
  assert.ok(trou < suivi + 7 * 61 * 0.0012, `l'inactivité ne paie pas : ${trou.toFixed(2)} départs attendus contre ${suivi.toFixed(2)}`);
  // D5 : deux départs dans la dernière fenêtre, puis il part : ils comptent quand même.
  const m = membres();
  m[0].depart = { le: jour(30), motif: "depart" };
  m[1].depart = { le: jour(31), motif: "depart" };
  const sept = Array.from({ length: 7 }, (_, k) => match(k));
  const sansFin = evoluerEntraineur(carriere(sept, m), { normes: N }).compteurs.COH.avance;
  const avecFin = evoluerEntraineur(carriere(sept, m, { fin: jour(44) }), { normes: N }).compteurs.COH.avance;
  assert.ok(avecFin < sansFin - 1.5, `les départs de la dernière fenêtre comptent : ${avecFin.toFixed(2)} contre ${sansFin.toFixed(2)}`);
  // Personne ne part pendant deux ans, quand la ligue perd un joueur par équipe tous les quatre mois : coh monte.
  assert.ok(gain(evoluerEntraineur(carriere(cent()), { normes: N }), "COH") >= 3, "personne ne part : coh monte");
}

// 6 · rés : l'attendu des cartes ; une rencontre par adversaire et par saison ; sa saisie seule ; le 5 contre 4 une fois.
{
  // D2 : l'attendu ne dépend que des deux feuilles.
  assert.equal(attenduDe(80, 80), 0.5);
  assert.ok(Math.abs(attenduDe(85, 75) - 1 / (1 + 10 ** (-10 / 16))) < 1e-12);
  assert.equal(forceFeuille([90, 60, 80, 70, 75, 85, 65]), (90 + 85 + 80 + 75 + 70) / 5, "les cinq meilleurs inscrits");
  assert.equal(forceFeuille([]), null);
  // Seize victoires contre la même équipe dans la saison : une seule compte en rés.
  const meme = Array.from({ length: 16 }, (_, k) => match(k, { adversaire: 7, pour: 3, contre: 0 }));
  assert.equal(evoluerEntraineur(carriere(meme), { normes: NORMES }).compteurs.RES.poids, 1);
  // Sa saisie restée seule : une victoire ne compte pas, une défaite si.
  const seules = (pour: number, contre: number) =>
    evoluerEntraineur(carriere(Array.from({ length: 4 }, (_, k) => match(k, { pour, contre, saisieSeule: true }))), { normes: NORMES }).compteurs.RES.poids;
  assert.equal(seules(3, 0), 0);
  assert.equal(seules(0, 3), 4);
  // D10 : le 5 contre 4 ne coûte qu'en pré ; rés lit le score du terrain.
  const cinqQuatre = evoluerEntraineur(carriere([match(0, { cinqContreQuatre: "nous" })]), { normes: NORMES });
  assert.equal(cinqQuatre.compteurs.RES.avance, 0);
  assert.equal(cinqQuatre.compteurs.PRES.avance, -1);
  // D13 : le journal ne dit jamais l'attendu en chiffres.
  const ev = evoluerEntraineur(CARRIERE_DEMO);
  for (const f of ev.journal.filter((x) => x.cle === "RES")) assert.ok(!/\d/.test(f.texte), `l'attendu ne sort pas : « ${f.texte} »`);
  assert.equal(championDe(6, 16), false);
  assert.equal(championDe(7, 16), true);
}

// 7 · D8 : les normes de chaque saison, figées ; la carte officielle en plancher.
{
  const rs = Array.from({ length: 32 }, (_, k) => match(k, { saison: k < 16 ? 1 : 2 }));
  // La saison 2 pas encore figée : ses rencontres se jugent avec la norme de la saison 1.
  const enCours = evoluerEntraineur(carriere(rs), { normes: { 1: { presence: -0.2, departsParJour: 0 } } });
  const figee = evoluerEntraineur(carriere(rs), { normes: { 1: { presence: -0.2, departsParJour: 0 }, 2: { presence: -0.2, departsParJour: 0 } } });
  assert.equal(enCours.compteurs.PRES.avance.toFixed(9), figee.compteurs.PRES.avance.toFixed(9));
  // Une norme de saison 2 plus dure ne touche pas aux rencontres de la saison 1.
  const dure = evoluerEntraineur(carriere(rs), { normes: { 1: { presence: -0.2, departsParJour: 0 }, 2: { presence: 0, departsParJour: 0 } } });
  assert.ok(Math.abs(dure.compteurs.PRES.avance - (16 * 0.2 + 16 * 0)) < 1e-9);
  // La carte gardée en base est un plancher : un rejeu ne la fait jamais redescendre.
  const plancher = { RES: 77, PRES: 76, COH: 75 };
  const rejeu = evoluerEntraineur(carriere(rs), { normes: NORMES, plancher });
  for (const k of CLES_ENTRAINEUR) assert.ok(rejeu.officielles[k] >= plancher[k], `${k} sous le plancher`);
}

// 8 · Les trois saisons de Lucien : la carte des captures.
{
  const ev = evoluerEntraineur(CARRIERE_DEMO);
  assert.deepEqual(ev.officielles, { RES: 78, PRES: 76, COH: 75 });
  assert.equal(noteEntraineur(ev.officielles), 77);
  assert.ok(!Object.values(ev.officielles).includes(77), "aucun des trois ne répète la note");
  assert.equal(ev.rencontres, 40);
  assert.equal(ev.majs.length, 10);
  assert.deepEqual(ev.exploits, ["ma-23"]);
  assert.ok(ev.journal.some((f) => f.texte === "Samir est parti"));
  assert.ok(ev.journal.some((f) => f.texte === "5 contre 4"));
}

// 9 · Les matières : ni or, ni bleu, ni rouge, ni la braise, ni le mauve ; aucune n'entre dans les finitions d'un joueur.
{
  const source = ["skins-entraineur.ts", "motifs-entraineur.tsx", "ecusson-entraineur.tsx"]
    .map((f) => readFileSync(new URL(`../src/components/sfl/${f}`, import.meta.url), "utf8"))
    .join("\n");
  const teinte = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const s = max === 0 ? 0 : (max - min) / max;
    const h = max === min ? 0 : max === r ? (60 * ((g - b) / (max - min)) + 360) % 360 : max === g ? 60 * ((b - r) / (max - min)) + 120 : 60 * ((r - g) / (max - min)) + 240;
    return { h, s, v: max };
  };
  for (const hex of source.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
    const { h, s, v } = teinte(hex);
    assert.ok(hex.toLowerCase() !== "#ff8a4c", "la braise");
    if (s < 0.3 || v < 0.2) continue; // les gris, les noirs, les blancs cassés
    assert.ok(!(h >= 30 && h <= 60), `${hex} : de l'or`);
    assert.ok(!(h >= 195 && h <= 250), `${hex} : du bleu`);
    assert.ok(!(h >= 345 || h <= 15), `${hex} : du rouge`);
    assert.ok(!(h >= 280 && h <= 340), `${hex} : le mauve du rang A, le néon, l'aurore`);
  }
  for (const nom of [...Object.keys(MATIERES_ENTRAINEUR), "entraineur"]) {
    assert.ok(nom in MATIERES, `${nom} manque dans MATIERES`);
    assert.ok(!(FINITIONS as readonly string[]).includes(nom), `${nom} ne doit pas être une finition de joueur`);
  }
}

// 10 · Le barème lent (Ilyes, 02/11 : « la note lente ») : les marges et les crans du réglage proposé, pas du vif.
{
  const B = BAREME_ENTRAINEUR;
  assert.deepEqual(
    { RES: B.RES, PRES: B.PRES, COH: B.COH },
    { RES: { hasard: 0.62, cran: 0.2 }, PRES: { hasard: 0.7, cran: 1 }, COH: { hasard: 1.4, cran: 0.12 } },
    "le barème lent, tel que modele-v3.md le propose"
  );
  // Le vif de v3/sim4/variantes.out : RES 0,5, PRES 0,55 à 0,75, COH 1,0. Aucune marge du lent n'en est.
  assert.ok(B.RES.hasard > 0.5 && B.PRES.hasard > 0.55 && B.COH.hasard > 1.0, "pas le réglage vif");
  assert.equal(B.echelle, 16);
  assert.deepEqual(B.presence, { venue: 0, cinqContreQuatre: -1, forfait: -3 });
  assert.equal(B.maj.rencontres, 4);
  assert.equal(B.actifJours, 60);
  assert.deepEqual(B.poidsLigue, { rencontres: 16, joursActifs: 840 });
}

// 11 · Sa saisie restée seule : en pré, « venue » ne compte pas (l'adversaire ne l'a pas vérifiée) ; un 5 contre 4 ou un forfait déclaré, si.
{
  const N = { 1: { presence: -0.1, departsParJour: 0 } };
  const pres = (o: Partial<RencontreEntraineur>) => evoluerEntraineur(carriere(Array.from({ length: 4 }, (_, k) => match(k, o))), { normes: N }).compteurs.PRES;
  assert.equal(pres({ saisieSeule: true }).poids, 0, "« venue » saisie seule par son camp : rien");
  assert.equal(pres({ saisieSeule: true, cinqContreQuatre: "eux" }).poids, 0, "le 5 contre 4 de l'adversaire, saisi seul par son camp : rien");
  assert.equal(pres({ saisieSeule: true, cinqContreQuatre: "nous" }).poids, 4, "son propre 5 contre 4, même saisi seul, compte");
  assert.ok(Math.abs(pres({ saisieSeule: true, cinqContreQuatre: "nous" }).avance - 4 * (-1 + 0.1)) < 1e-9);
  assert.equal(pres({ saisieSeule: true, forfait: true }).poids, 4, "son forfait compte");
  assert.equal(pres({}).poids, 4, "saisies des deux camps : tout compte");
  // Le journal ne garde que ce qui a compté.
  const ev = evoluerEntraineur(carriere([match(0, { saisieSeule: true }), match(1)]), { normes: N });
  assert.equal(ev.journal.filter((f) => f.cle === "PRES").length, 1);
}

// 12 · Ses places s'enchaînent ; les feuilles d'avant-match et l'activité.
{
  const N = { 1: { presence: -0.3, departsParJour: 0 } };
  // Deux places : la seconde reprend les compteurs et la cadence de la première.
  const a = carriere(Array.from({ length: 6 }, (_, k) => match(k)), membres(), { fin: jour(6 * 7) });
  const b = { ...carriere(Array.from({ length: 6 }, (_, k) => match(k + 7)), membres()), arrivee: jour(7 * 7) };
  const seule = evoluerEntraineur(a, { normes: N });
  const deux = evoluerCarrieres([b, a], { normes: N });
  assert.equal(deux.rencontres, 12);
  assert.ok(Math.abs(deux.compteurs.PRES.avance - 12 * 0.3) < 1e-9, "les compteurs le suivent");
  assert.ok(deux.majs.length >= seule.majs.length);
  const mois = deux.majs.map((m) => m.apres.slice(0, 7));
  assert.equal(new Set(mois).size, mois.length, "jamais deux mises à jour le même mois, d'une place à l'autre");
  assert.deepEqual(deux.majs, [...deux.majs].sort((x, y) => y.apres.localeCompare(x.apres)), "les mises à jour, de la plus récente à la plus ancienne");
  // Sans place : la carte de départ.
  assert.deepEqual(evoluerCarrieres([]).officielles, { RES: 75, PRES: 75, COH: 75 });
  // Une place qui ne fait que commencer : 75 partout.
  assert.deepEqual(evoluerCarrieres([carriere([])]).officielles, { RES: 75, PRES: 75, COH: 75 });
  // Avant la première feuille de la ligue, tout joueur compte actif ; après, ses 60 jours et ses feuilles.
  const m: MembreEntraineur = { id: "x", nom: "X", arrivee: "2026-01-01" };
  const sans = activite([m], new Map());
  const avant = activite([m], new Map(), numeroDuJour("2026-11-03"));
  assert.equal(sans(m, numeroDuJour("2026-10-01")), false, "arrivé il y a neuf mois, sur aucune feuille : inactif");
  assert.equal(avant(m, numeroDuJour("2026-10-01")), true, "avant les feuilles : actif");
  assert.equal(avant(m, numeroDuJour("2026-11-05")), false, "après : la règle des feuilles");
  const inscrit = activite([m], new Map([["x", [numeroDuJour("2026-11-10")]]]), numeroDuJour("2026-11-03"));
  assert.equal(inscrit(m, numeroDuJour("2027-01-08")), true, "59 jours après sa feuille");
  assert.equal(inscrit(m, numeroDuJour("2027-01-09")), false, "60 jours après");
}

console.log("entraineur-check : ok");
