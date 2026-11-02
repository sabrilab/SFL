// La carte d'entraîneur de Bola Team (étude du 02/11/2026, branche coach-etude) :
//   1. rien ne descend : chaque mise à jour garde ou monte chaque caractéristique ;
//      tout reste entre 75 (le départ) et 99 (le plafond) ; la note est
//      l'arrondi supérieur de la moyenne des six ;
//   2. RES : rien avant que l'Indice de Force soit calé ; un demi-point
//      d'avance sur l'attendu vaut un cran ; ce qu'un entraîneur prend à
//      l'autre, l'autre le perd (somme nulle) ; battre plus faible ne rapporte
//      presque rien ;
//   3. une dette bloque : après un forfait (−3), trois matchs au complet ne
//      font rien monter ; un forfait ne touche que l'effectif ; absent, rien ne
//      compte pour lui, sauf le 5 contre 4 et le forfait ;
//   4. PRO : sept joueurs ne gagnent pas au nombre sur cinq ; un joueur ne
//      verse pas plus de 3 crans ; ceux qui partent de plus bas comptent double ;
//   5. JEU : le même cinq de départ à chaque match, rien ; un vrai partage, 2 crans ;
//   6. COH : un départ −1, une exclusion −2 ; TEN : les paliers de la note fair-play ;
//   7. la saison inventée de Lucien donne la carte des captures ;
//   8. les matières de la carte : ni or, ni bleu, ni rouge, ni la braise, et
//      aucune n'entre dans les finitions qu'un joueur peut porter.
//   npx tsx tools/entraineur-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLES_ENTRAINEUR,
  evoluerEntraineur,
  noteEntraineur,
  type PresentEntraineur,
  type RencontreEntraineur,
} from "../src/lib/sfl/entraineur";
import { ARRIVEE_DEMO, JOUEURS_DEMO, MOUVEMENTS_DEMO, RENCONTRES_DEMO } from "../src/lib/sfl/entraineur-demo";
import { FINITIONS, MATIERES } from "../src/components/sfl/finitions-carte";
import { MATIERES_ENTRAINEUR } from "../src/components/sfl/skins-entraineur";

const NOMS = ["A", "B", "C", "D", "E", "F", "G"];
const present = (nom: string, o: Partial<PresentEntraineur> = {}): PresentEntraineur => ({ nom, aLHeure: true, titulaire: true, buts: 0, passes: 0, ...o });
let n = 0;
const match = (o: Partial<RencontreEntraineur> = {}): RencontreEntraineur => ({
  id: `m${++n}`,
  le: `2026-11-${String(1 + (n % 28)).padStart(2, "0")}T${String(n).padStart(4, "0")}`,
  classee: true,
  forfait: false,
  pour: 2,
  contre: 2,
  attendu: 0.5,
  indiceCale: true,
  presents: NOMS.slice(0, 5).map((x) => present(x)),
  absentsInscrits: 0,
  fairPlay: 4,
  sanctions: 0,
  litigeFautif: false,
  ...o,
});

// 1 · Rien ne descend, tout reste entre 75 et 99, la note est l'arrondi supérieur de la moyenne.
{
  let x = 7;
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648), x / 2147483648);
  const rencontres = Array.from({ length: 160 }, () =>
    match({
      pour: Math.floor(rnd() * 7),
      contre: Math.floor(rnd() * 7),
      attendu: 0.15 + rnd() * 0.7,
      forfait: rnd() < 0.05,
      presents: NOMS.slice(0, 4 + Math.floor(rnd() * 4)).map((nom) =>
        present(nom, { aLHeure: rnd() > 0.1, titulaire: rnd() > 0.3, buts: Math.floor(rnd() * 3), passes: Math.floor(rnd() * 2) })
      ),
      fairPlay: rnd() < 0.1 ? null : 1 + rnd() * 4,
      sanctions: rnd() < 0.05 ? 1 : 0,
      litigeFautif: rnd() < 0.03,
    })
  );
  const ev = evoluerEntraineur(rencontres, [{ le: "2026-11-10", nom: "B", quoi: "exclusion" }], { noteJoueur: (nom) => 70 + NOMS.indexOf(nom) * 3 });
  const suite = [...ev.majs].reverse();
  assert.equal(suite.length, 40);
  let avant = ev.depart;
  for (const m of suite) {
    for (const k of CLES_ENTRAINEUR) {
      assert.ok(m.stats[k] >= avant[k], `${k} descend après ${m.apres}`);
      assert.ok(m.stats[k] >= 75 && m.stats[k] <= 99, `${k} hors de 75–99`);
    }
    avant = m.stats;
  }
  assert.equal(noteEntraineur({ RES: 80, PRO: 81, EFF: 80, COH: 80, JEU: 80, TEN: 80 }), 81);
  assert.equal(noteEntraineur({ RES: 75, PRO: 75, EFF: 75, COH: 75, JEU: 75, TEN: 75 }), 75);
}

// 2 · RES : l'Indice calé d'abord ; un demi-point, un cran ; la somme nulle ; battre plus faible ne paie pas.
{
  const res = (rs: RencontreEntraineur[]) => evoluerEntraineur(rs).faits.filter((f) => f.cle === "RES").reduce((t, f) => t + f.crans, 0);
  assert.equal(res([match({ pour: 5, contre: 0, attendu: 0.2, indiceCale: false })]), 0);
  assert.equal(res([match({ pour: 5, contre: 0, attendu: 0.2 })]), 1); // +0,80 : un cran, 0,30 en réserve
  assert.equal(res([match({ pour: 5, contre: 0, attendu: 0.2 }), match({ pour: 3, contre: 1, attendu: 0.8 })]), 2); // +0,20 : 0,30 + 0,20 en réserve, un cran de plus
  assert.equal(res([match({ pour: 5, contre: 0, attendu: 0.2 }), match({ pour: 0, contre: 3, attendu: 0.6 }), match({ pour: 3, contre: 0, attendu: 0.5 })]), 1); // la défaite (−0,60) est une dette que la victoire suivante rembourse
  // L'adversaire du même match : son attendu est 1 − E, son résultat 1 − S.
  const a = evoluerEntraineur([match({ pour: 4, contre: 2, attendu: 0.36 })]);
  const b = evoluerEntraineur([match({ pour: 2, contre: 4, attendu: 0.64 })]);
  assert.ok(Math.abs(a.reserveRes + 0.5 * a.faits.filter((f) => f.cle === "RES").length + b.reserveRes) < 1e-9, "somme nulle");
  // Dix victoires contre bien plus faible (attendu 0,95) : au plus un cran.
  assert.ok(res(Array.from({ length: 10 }, () => match({ pour: 6, contre: 1, attendu: 0.95 }))) <= 1);
}

// 3 · Une dette bloque, un forfait ne touche que l'effectif.
{
  const ev = evoluerEntraineur([match({ forfait: true }), match(), match(), match()]);
  assert.equal(ev.officielles.EFF, 75);
  assert.equal(ev.jauges.EFF.crans, 0);
  const seul = evoluerEntraineur([match({ forfait: true })]);
  assert.deepEqual(new Set(seul.faits.map((f) => f.cle)), new Set(["EFF"]));
  // Un 5 contre 4 : −1 ; un retard ou un inscrit absent : rien.
  const ev2 = evoluerEntraineur([match({ presents: NOMS.slice(0, 4).map((x) => present(x)) }), match({ absentsInscrits: 1 }), match({ presents: NOMS.slice(0, 5).map((x, i) => present(x, { aLHeure: i > 0 })) })]);
  assert.deepEqual(ev2.faits.filter((f) => f.cle === "EFF").map((f) => f.crans), [-1]);
}

// 3 bis · Absent, rien ne compte pour lui, sauf le 5 contre 4 et le forfait.
{
  const ev = evoluerEntraineur([
    match({ entraineurPresent: false, pour: 6, contre: 0, attendu: 0.2 }),
    match({ entraineurPresent: false, presents: NOMS.slice(0, 4).map((x) => present(x)) }),
  ]);
  assert.equal(ev.rencontres, 1);
  assert.deepEqual(ev.faits.map((f) => [f.cle, f.crans]), [["EFF", -1]]);
}

// 4 · PRO : pas d'avantage au nombre, 3 crans au plus par joueur, le double pour ceux d'en bas.
{
  const pro = (noms: string[], buts: number, notes?: (nom: string) => number) =>
    evoluerEntraineur(Array.from({ length: 4 }, () => match({ presents: noms.map((x) => present(x, { buts, aLHeure: false })) })), [], { noteJoueur: notes }).faits.find((f) => f.cle === "PRO")?.crans ?? 0;
  assert.equal(pro(NOMS.slice(0, 5), 1), pro(NOMS, 1));
  assert.equal(pro(NOMS.slice(0, 5), 1), 3); // 4 buts chacun, plafonnés à 3
  assert.equal(pro(NOMS.slice(0, 5), 5), 3); // 20 buts chacun : toujours 3
  const bas = pro(NOMS.slice(0, 4), 1, (nom) => (nom === "A" || nom === "B" ? 70 : 80));
  assert.equal(bas, Math.floor((3 * 2 * 2 + 3 * 2) / 4)); // les deux d'en bas comptent double
}

// 5 · JEU : le même cinq, rien ; tourner, 2 crans.
{
  const jeu = (titulaires: (i: number) => string[]) =>
    evoluerEntraineur(Array.from({ length: 4 }, (_, i) => match({ presents: NOMS.map((x) => present(x, { titulaire: titulaires(i).includes(x) })) }))).faits.find((f) => f.cle === "JEU")?.crans ?? 0;
  assert.equal(jeu(() => NOMS.slice(0, 5)), 0);
  assert.equal(jeu((i) => NOMS.map((_, k) => NOMS[(k + i * 2) % 7]).slice(0, 5)), 2);
}

// 6 · COH : départ −1, exclusion −2 ; TEN : les paliers.
{
  const coh = (m: { le: string; nom: string; quoi: "depart" | "exclusion" }[]) =>
    evoluerEntraineur(Array.from({ length: 4 }, () => match({ le: "2026-12-01" })), m, { arrivee: "2026-11-01" }).faits.find((f) => f.cle === "COH")?.crans ?? 0;
  assert.equal(coh([]), 2);
  assert.equal(coh([{ le: "2026-11-15", nom: "A", quoi: "depart" }]), 1);
  assert.equal(coh([{ le: "2026-11-15", nom: "A", quoi: "exclusion" }]), 0);
  assert.equal(coh([{ le: "2026-10-15", nom: "A", quoi: "exclusion" }]), 2); // avant son arrivée : rien
  const ten = (fp: number | null, o: Partial<RencontreEntraineur> = {}) =>
    evoluerEntraineur([match({ fairPlay: fp, ...o })]).faits.filter((f) => f.cle === "TEN").reduce((t, f) => t + f.crans, 0);
  assert.deepEqual([ten(5), ten(4.5), ten(4), ten(3), ten(2), ten(null)], [1, 1, 0, -1, -2, 0]);
  assert.equal(ten(5, { sanctions: 1, litigeFautif: true }), -3);
}

// 7 · La saison de Lucien : la carte des captures.
{
  const ev = evoluerEntraineur(RENCONTRES_DEMO, MOUVEMENTS_DEMO, { noteJoueur: (nom) => JOUEURS_DEMO[nom] ?? 75, arrivee: ARRIVEE_DEMO });
  assert.deepEqual(ev.officielles, { RES: 76, PRO: 80, EFF: 79, COH: 77, JEU: 77, TEN: 78 });
  assert.equal(noteEntraineur(ev.officielles), 78);
  assert.equal(ev.majs.length, 3);
}

// 8 · Les matières : ni or, ni bleu, ni rouge, ni la braise ; aucune n'entre dans les finitions d'un joueur.
{
  const source = readFileSync(new URL("../src/components/sfl/skins-entraineur.ts", import.meta.url), "utf8") + readFileSync(new URL("../src/components/sfl/motifs-entraineur.tsx", import.meta.url), "utf8");
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
  }
  for (const nom of [...Object.keys(MATIERES_ENTRAINEUR), "entraineur"]) {
    assert.ok(nom in MATIERES, `${nom} manque dans MATIERES`);
    assert.ok(!(FINITIONS as readonly string[]).includes(nom), `${nom} ne doit pas être une finition de joueur`);
  }
}

console.log("entraineur-check : ok");
