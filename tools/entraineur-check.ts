// La carte d'entraîneur de Bola Team (étude du 02/11/2026, branche coach-etude,
// troisième version : trois caractéristiques, rés, pré, coh ; les défauts des
// relectures de la seconde version restent vérifiés fermés) :
//   1. rien ne descend ; tout reste entre 75 et 99 ; la note est l'arrondi
//      supérieur de la moyenne des trois ;
//   2. un entraîneur dans la moyenne reste à 75, même après 200 rencontres ; le
//      hasard ne paie presque rien (rés, 64 rencontres sans effet), un vrai
//      effet paie ;
//   3. le score du championnat à la fermeture : une défaite que son capitaine
//      ne saisit pas compte quand même ; un litige non tranché et le forfait de
//      l'adversaire, non ;
//   4. pré : 3 présents ou moins, c'est un forfait, annoncé ou pas ; 4, le 5
//      contre 4 ; un inscrit absent, ce n'est plus « au complet » ; un forfait
//      coûte plus que tout le reste ;
//   5. coh : une exclusion vaut un départ ; la dissolution et un changement de
//      place ne comptent pas ;
//   6. le journal ne dit jamais l'attendu en chiffres ; Champion à 40 % des
//      rencontres dirigées ;
//   7. les deux saisons de Lucien donnent la carte des captures ;
//   8. les matières : ni or, ni bleu, ni rouge, ni la braise, ni le mauve ;
//      aucune n'entre dans les finitions d'un joueur.
//   npx tsx tools/entraineur-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLES_ENTRAINEUR,
  championDe,
  evoluerEntraineur,
  LIBELLES_ENTRAINEUR,
  NORMES_DEPART,
  noteEntraineur,
  rencontreComptee,
  valeurPresence,
  type CarriereEntraineur,
  type CleEntraineur,
  type MembreEntraineur,
  type RencontreEntraineur,
} from "../src/lib/sfl/entraineur";
import { CARRIERE_DEMO } from "../src/lib/sfl/entraineur-demo";
import type { MatchTeam } from "../src/lib/sfl/championnat-team";
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
const membres = (n = 7): MembreEntraineur[] => IDS.slice(0, n).map((id) => ({ id, nom: id.toUpperCase(), arrivee: "2026-10-01" }));
let n = 0;
/** Une rencontre « dans la moyenne » : une semaine après l'autre, un nul attendu, six inscrits, tous venus. */
const match = (k: number, o: Partial<RencontreEntraineur> = {}): RencontreEntraineur => ({
  id: `m${String(++n).padStart(4, "0")}`,
  le: jour(k * 7),
  forfait: false,
  pour: 2,
  contre: 2,
  attendu: 0.5,
  feuille: 6,
  presents: 6,
  ...o,
});
const carriere = (rencontres: RencontreEntraineur[], m = membres()): CarriereEntraineur => ({ arrivee: "2026-10-15", rencontres, membres: m });
/** Des normes où la rencontre ci-dessus est exactement dans la moyenne. */
const NORMES = { ...NORMES_DEPART, presence: 1, departsParJour: 0 };
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
}

// 1 · Rien ne descend, tout reste entre 75 et 99, la note est l'arrondi supérieur de la moyenne.
{
  const rnd = mulberry32(7);
  const rs = Array.from({ length: 160 }, (_, k) => {
    const feuille = 5 + Math.floor(rnd() * 3);
    const presents = rnd() < 0.04 ? Math.floor(rnd() * 4) : rnd() < 0.05 ? 4 : feuille - (rnd() < 0.2 ? 1 : 0);
    return match(k, {
      pour: Math.floor(rnd() * 7),
      contre: Math.floor(rnd() * 7),
      attendu: rnd() < 0.2 ? null : 0.15 + rnd() * 0.7,
      forfait: presents <= 3 || rnd() < 0.02,
      feuille,
      presents,
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
  assert.equal(noteEntraineur({ RES: 77, PRES: 78, COH: 75 }), 77);
  assert.equal(noteEntraineur({ RES: 75, PRES: 75, COH: 75 }), 75);
}

// 2 · Dans la moyenne, il reste à 75, quel que soit le nombre de rencontres.
{
  const ev = evoluerEntraineur(carriere(Array.from({ length: 200 }, (_, k) => match(k))), { normes: NORMES });
  assert.deepEqual(ev.officielles, { RES: 75, PRES: 75, COH: 75 });
  assert.equal(ev.rencontres, 200);
  // Le hasard ne paie presque rien ; un vrai effet paie. rés seul, 64 rencontres, 400 carrières.
  const rnd = mulberry32(2026);
  const res = (d: number) =>
    moy(
      Array.from({ length: 400 }, () => {
        const rs = Array.from({ length: 64 }, (_, k) => {
          const e = 0.3 + rnd() * 0.4;
          const u = rnd();
          const s = u < e - 0.1 + d ? 1 : u < e + 0.1 + d ? 0.5 : 0;
          return match(k, { attendu: e, pour: s === 1 ? 3 : s ? 2 : 1, contre: 2 });
        });
        return gain(evoluerEntraineur(carriere(rs), { normes: NORMES }), "RES");
      })
    );
  const sansEffet = res(0);
  const bon = res(0.08);
  assert.ok(sansEffet < 1.2, `rés sans effet : +${sansEffet.toFixed(2)} en 64 rencontres`);
  assert.ok(bon > sansEffet + 1.5, `rés d'un bon entraîneur (+${bon.toFixed(2)}) contre le hasard (+${sansEffet.toFixed(2)})`);
  // Ce que la chance a donné se rembourse avant le prochain cran : deux victoires « contre plus fort », deux défaites « contre plus faible ».
  const yoyo = evoluerEntraineur(carriere(Array.from({ length: 8 }, (_, k) => match(k, { attendu: k % 2 ? 0.75 : 0.25, pour: k % 2 ? 0 : 3, contre: 1 }))), { normes: NORMES });
  assert.equal(gain(yoyo, "RES"), 0);
}

// 3 · Le score du championnat à la fermeture de la feuille.
{
  const base: MatchTeam = { id: 1, de: 10, a: 20, jour: "2026-11-14", heure: "20:00", lieu: "", statut: "accepte", forfaitDe: null, saisies: [], buteurs: [] };
  // Son capitaine (équipe 10) ne saisit pas la défaite : l'adversaire saisit seul, ça compte quand même.
  const seule = { ...base, saisies: [{ equipe: 20, pour: 4, contre: 1, le: "2026-11-14T21:00:00Z" }] };
  assert.deepEqual(rencontreComptee(seule, 10), { pour: 1, contre: 4, forfait: false });
  // Et l'adversaire n'efface pas sa victoire en se taisant.
  const gagnee = { ...base, saisies: [{ equipe: 10, pour: 3, contre: 0, le: "2026-11-14T21:00:00Z" }] };
  assert.deepEqual(rencontreComptee(gagnee, 10), { pour: 3, contre: 0, forfait: false });
  // Un litige à la fermeture : ni pour l'un ni pour l'autre, en attendant la revue.
  const litige = { ...base, saisies: [{ equipe: 10, pour: 3, contre: 0, le: "2026-11-14T21:00:00Z" }, { equipe: 20, pour: 1, contre: 3, le: "2026-11-14T21:05:00Z" }] };
  assert.equal(rencontreComptee(litige, 10), null);
  // Le forfait de l'adversaire ne dit rien de lui ; le sien compte.
  assert.equal(rencontreComptee({ ...base, statut: "forfait", forfaitDe: 20 }, 10), null);
  assert.deepEqual(rencontreComptee({ ...base, statut: "forfait", forfaitDe: 10 }, 10), { pour: 0, contre: 3, forfait: true });
}

// 4 · pré.
{
  assert.equal(valeurPresence({ forfait: false, feuille: 6, presents: 0 }).texte, "forfait");
  assert.equal(valeurPresence({ forfait: false, feuille: 6, presents: 3 }).texte, "forfait");
  assert.equal(valeurPresence({ forfait: true, feuille: 6, presents: 6 }).texte, "forfait");
  assert.equal(valeurPresence({ forfait: false, feuille: 5, presents: 4 }).texte, "5 contre 4");
  assert.equal(valeurPresence({ forfait: false, feuille: 7, presents: 6 }).texte, "1 inscrit absent");
  assert.equal(valeurPresence({ forfait: false, feuille: 7, presents: 5 }).texte, "2 inscrits absents");
  assert.equal(valeurPresence({ forfait: false, feuille: 5, presents: 5 }).texte, "au complet");
  // Un forfait coûte plus que tout le reste : 4 forfaits contre 4 rencontres au complet, à la norme 0.
  const f = evoluerEntraineur(carriere(Array.from({ length: 8 }, (_, k) => match(k, { forfait: k < 4 }))), { normes: { ...NORMES, presence: 0 } });
  assert.equal(gain(f, "PRES"), 0);
  // Au complet à chaque rencontre, quand la ligue l'est une fois sur deux : pré monte.
  const complet = evoluerEntraineur(carriere(Array.from({ length: 24 }, (_, k) => match(k))), { normes: { ...NORMES, presence: 0.5 } });
  assert.ok(gain(complet, "PRES") >= 3, `au complet : +${gain(complet, "PRES")}`);
}

// 5 · coh : une exclusion vaut un départ ; dissolution et changement de place ne comptent pas.
{
  const coh = (motif: NonNullable<MembreEntraineur["depart"]>["motif"]) => {
    const m = membres();
    m[2].depart = { le: jour(10), motif };
    return evoluerEntraineur(carriere(Array.from({ length: 4 }, (_, k) => match(k)), m)).compteurs.COH.avance;
  };
  const rien = evoluerEntraineur(carriere(Array.from({ length: 4 }, (_, k) => match(k)))).compteurs.COH.avance;
  assert.ok(Math.abs(coh("exclusion") - coh("depart")) < 0.01, "une exclusion pèse comme un départ");
  assert.ok(Math.abs(rien - coh("depart") - 1) < 0.05, "un départ, un départ de moins que la moyenne");
  for (const motif of ["dissolution", "changement-de-place"] as const) assert.ok(coh(motif) > coh("depart") + 0.9, `${motif} ne compte pas`);
  // Personne ne part pendant deux ans, quand la ligue perd un joueur par équipe tous les quatre mois : coh monte.
  const stable = evoluerEntraineur(carriere(Array.from({ length: 100 }, (_, k) => match(k))));
  assert.ok(gain(stable, "COH") >= 3, `personne ne part : +${gain(stable, "COH")}`);
}

// 6 · Le journal en mots ; Champion à 40 % des rencontres dirigées.
{
  const ev = evoluerEntraineur(CARRIERE_DEMO);
  for (const f of ev.journal.filter((x) => x.cle === "RES")) assert.ok(!/\d/.test(f.texte), `l'attendu ne sort pas : « ${f.texte} »`);
  assert.equal(championDe(6, 16), false);
  assert.equal(championDe(7, 16), true);
}

// 7 · Les deux saisons de Lucien : la carte des captures.
{
  const ev = evoluerEntraineur(CARRIERE_DEMO);
  assert.deepEqual(ev.officielles, { RES: 77, PRES: 78, COH: 75 });
  assert.equal(noteEntraineur(ev.officielles), 77);
  assert.equal(ev.rencontres, 24);
  assert.equal(ev.majs.length, 6);
  assert.deepEqual(ev.exploits, ["bb-21"]);
}

// 8 · Les matières : ni or, ni bleu, ni rouge, ni la braise, ni le mauve ; aucune n'entre dans les finitions d'un joueur.
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

console.log("entraineur-check : ok");
