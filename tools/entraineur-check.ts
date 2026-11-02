// La carte d'entraîneur de Bola Team (étude du 02/11/2026, branche coach-etude,
// seconde version : les défauts des deux relectures adverses, vérifiés fermés) :
//   1. rien ne descend ; tout reste entre 75 et 99 ; la note est l'arrondi
//      supérieur de la moyenne des six ;
//   2. un entraîneur dans la moyenne reste à 75, même après 200 rencontres ; le
//      hasard ne paie presque rien (res, 64 rencontres sans effet), un vrai
//      effet paie (D5, D8) ;
//   3. le score du championnat à la fermeture : une défaite que son capitaine
//      ne saisit pas compte quand même ; un litige non tranché et le forfait de
//      l'adversaire, non (D1, D2) ;
//   4. prés : 3 présents ou moins, c'est un forfait, annoncé ou pas ; un inscrit
//      absent compte, même excusé après coup ; « présent sans check-in », c'est
//      un retard (D6, D9) ;
//   5. tour : n'aligner que les forts ne paie pas ; le membre fantôme bloque ;
//      les absences annoncées comptent pour une sur deux au plus (D3, D15) ;
//   6. coh : une exclusion vaut un départ ; la dissolution et l'abonnement fini
//      ne comptent pas (D10, D11) ;
//   7. fair : contre l'habitude de celui qui note, quelle que soit la ligue ;
//      −2 par sanction d'un joueur, −4 pour la sienne (D10, D14) ;
//   8. rec : une recrue qui joue et reste ; celle qui part ou ne joue pas, non ;
//   9. le journal ne dit jamais l'attendu en chiffres (D12) ; Champion à 40 %
//      des rencontres dirigées (D14) ;
//  10. les deux saisons de Lucien donnent la carte des captures ;
//  11. les matières : ni or, ni bleu, ni rouge, ni la braise ; aucune n'entre
//      dans les finitions d'un joueur.
//   npx tsx tools/entraineur-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CLES_ENTRAINEUR,
  championDe,
  evoluerEntraineur,
  NORMES_DEPART,
  noteEntraineur,
  rencontreComptee,
  type CarriereEntraineur,
  type CleEntraineur,
  type LigneEffectif,
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
const ligne = (id: string, o: Partial<LigneEffectif> = {}): LigneEffectif => ({ id, inscrit: true, indisponible: false, venu: "heure", ...o });
const membres = (n = 7): MembreEntraineur[] => IDS.slice(0, n).map((id) => ({ id, nom: id.toUpperCase(), arrivee: "2026-10-01" }));
let n = 0;
/** Une rencontre « dans la moyenne » : une semaine après l'autre, cinq inscrits venus à l'heure sur sept. */
const match = (k: number, o: Partial<RencontreEntraineur> = {}): RencontreEntraineur => ({
  id: `m${String(++n).padStart(4, "0")}`,
  le: jour(k * 7),
  forfait: false,
  pour: 2,
  contre: 2,
  attendu: 0.5,
  effectif: IDS.map((id, i) => ligne(id, i < 5 ? {} : { inscrit: false })),
  fairPlay: { note: 4.2, habitude: 4.2 },
  sanctions: { joueurs: 0, entraineur: 0 },
  ...o,
});
const carriere = (rencontres: RencontreEntraineur[], m = membres()): CarriereEntraineur => ({ arrivee: "2026-10-15", rencontres, membres: m });
/** Des normes où la rencontre ci-dessus est exactement dans la moyenne. */
const NORMES = { ...NORMES_DEPART, presence: 1, tour: 1, departsParJour: 0, recrues: 0.5 };
const gain = (ev: ReturnType<typeof evoluerEntraineur>, k: CleEntraineur) => ev.officielles[k] - 75;
const moy = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

// 1 · Rien ne descend, tout reste entre 75 et 99, la note est l'arrondi supérieur de la moyenne.
{
  const rnd = mulberry32(7);
  const rs = Array.from({ length: 160 }, (_, k) =>
    match(k, {
      pour: Math.floor(rnd() * 7),
      contre: Math.floor(rnd() * 7),
      attendu: rnd() < 0.2 ? null : 0.15 + rnd() * 0.7,
      forfait: rnd() < 0.04,
      effectif: IDS.map((id) => ligne(id, { inscrit: rnd() > 0.2, indisponible: rnd() < 0.1, venu: rnd() < 0.12 ? null : rnd() < 0.1 ? "retard" : "heure" })),
      fairPlay: rnd() < 0.1 ? null : { note: 1 + Math.floor(rnd() * 5), habitude: 3.6 + rnd() },
      sanctions: { joueurs: rnd() < 0.05 ? 1 : 0, entraineur: rnd() < 0.01 ? 1 : 0 },
    })
  );
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
  assert.equal(noteEntraineur({ RES: 80, PRES: 81, TOUR: 80, COH: 80, FAIR: 80, REC: 80 }), 81);
  assert.equal(noteEntraineur({ RES: 75, PRES: 75, TOUR: 75, COH: 75, FAIR: 75, REC: 75 }), 75);
}

// 2 · Dans la moyenne, il reste à 75, quel que soit le nombre de rencontres (D5).
{
  const ev = evoluerEntraineur(carriere(Array.from({ length: 200 }, (_, k) => match(k))), { normes: NORMES });
  assert.deepEqual(ev.officielles, { RES: 75, PRES: 75, TOUR: 75, COH: 75, FAIR: 75, REC: 75 });
  assert.equal(ev.rencontres, 200);
  // Le hasard ne paie presque rien ; un vrai effet paie (D8). res seul, 64 rencontres, 400 carrières.
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
  assert.ok(sansEffet < 1.2, `res sans effet : +${sansEffet.toFixed(2)} en 64 rencontres`);
  assert.ok(bon > sansEffet + 1.5, `res d'un bon entraîneur (+${bon.toFixed(2)}) contre le hasard (+${sansEffet.toFixed(2)})`);
  // Ce que la chance a donné se rembourse avant le prochain cran : deux victoires « contre plus fort », deux défaites « contre plus faible ».
  const yoyo = evoluerEntraineur(carriere(Array.from({ length: 8 }, (_, k) => match(k, { attendu: k % 2 ? 0.75 : 0.25, pour: k % 2 ? 0 : 3, contre: 1 }))), { normes: NORMES });
  assert.equal(gain(yoyo, "RES"), 0);
}

// 3 · Le score du championnat à la fermeture de la feuille (D1, D2).
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

// 4 · prés (D6, D9).
{
  const pres = (r: Partial<RencontreEntraineur>) => evoluerEntraineur(carriere([match(0, r)]), { normes: NORMES }).journal.find((f) => f.cle === "PRES")!.texte;
  // Personne n'est venu et rien n'a été annoncé : un forfait.
  assert.equal(pres({ effectif: IDS.map((id) => ligne(id, { venu: null })) }), "forfait");
  assert.equal(pres({ effectif: IDS.map((id, i) => ligne(id, { venu: i < 3 ? "heure" : null })) }), "forfait");
  assert.equal(pres({ effectif: IDS.map((id, i) => ligne(id, { venu: i < 4 ? "heure" : null })) }), "5 contre 4");
  // Six venus à l'heure, un inscrit absent (excusé après H-2 ou non) : pas « au complet ».
  assert.equal(pres({ effectif: IDS.map((id, i) => ligne(id, { venu: i < 6 ? "heure" : null })) }), "1 inscrit absent");
  // Marqué « présent, arrivé en retard » sans check-in : un retard.
  assert.equal(pres({ effectif: IDS.map((id, i) => ligne(id, { venu: i ? "heure" : "retard" })) }), "1 retard");
  // Un forfait coûte plus que tout le reste : 4 forfaits contre 4 rencontres au complet.
  const f = evoluerEntraineur(carriere([...Array.from({ length: 8 }, (_, k) => match(k, { forfait: k < 4 }))]), { normes: { ...NORMES, presence: 0 } });
  assert.equal(gain(f, "PRES"), 0);
}

// 5 · tour : tout l'effectif, pas seulement les présents (D3, D15).
{
  const tour = (lignes: (k: number) => LigneEffectif[]) =>
    gain(evoluerEntraineur(carriere(Array.from({ length: 24 }, (_, k) => match(k, { effectif: lignes(k) }))), { normes: { ...NORMES, tour: 0.5 } }), "TOUR");
  // F et G jamais sur la feuille, les cinq mêmes à chaque rencontre : rien.
  assert.equal(tour(() => IDS.map((id, i) => ligne(id, i < 5 ? {} : { inscrit: false }))), 0);
  // Tout le monde inscrit et venu : tour monte.
  assert.ok(tour(() => IDS.map((id) => ligne(id))) >= 2);
  // F inscrit mais ne vient jamais (le fantôme) : rien.
  assert.equal(tour(() => IDS.map((id, i) => ligne(id, i === 5 ? { venu: null } : {}))), 0);
  // F annonce son absence à chaque fois : la moitié seulement est neutre, il reste le moins servi.
  assert.equal(tour(() => IDS.map((id, i) => ligne(id, i === 5 ? { inscrit: false, indisponible: true } : {}))), 0);
  // F annonce une absence sur deux et joue l'autre : comme s'il jouait tout.
  assert.ok(tour((k) => IDS.map((id, i) => ligne(id, i === 5 && k % 2 ? { inscrit: false, indisponible: true } : {}))) >= 2);
}

// 6 · coh : une exclusion vaut un départ ; dissolution et abonnement fini ne comptent pas (D10, D11).
{
  const coh = (motif: NonNullable<MembreEntraineur["depart"]>["motif"]) => {
    const m = membres();
    m[2].depart = { le: jour(10), motif };
    return evoluerEntraineur(carriere(Array.from({ length: 4 }, (_, k) => match(k)), m)).compteurs.COH.avance;
  };
  const rien = evoluerEntraineur(carriere(Array.from({ length: 4 }, (_, k) => match(k)))).compteurs.COH.avance;
  assert.ok(Math.abs(coh("exclusion") - coh("depart")) < 0.01, "une exclusion pèse comme un départ");
  // Un départ : un départ de plus que la moyenne (à peine plus, ses jours en moins dans l'attendu).
  assert.ok(Math.abs(rien - coh("depart") - 1) < 0.05, "un départ, un départ de moins que la moyenne");
  for (const motif of ["dissolution", "inactivite", "changement-de-place"] as const) assert.ok(coh(motif) > coh("depart") + 0.9, `${motif} ne compte pas`);
}

// 7 · fair : contre l'habitude de celui qui note (D10), les sanctions (D14).
{
  const fair = (note: number, habitude: number, s = { joueurs: 0, entraineur: 0 }) =>
    gain(evoluerEntraineur(carriere(Array.from({ length: 16 }, (_, k) => match(k, { fairPlay: { note, habitude }, sanctions: s }))), { normes: NORMES }), "FAIR");
  // Une ligue qui note large ou serré : noté comme d'habitude, rien.
  assert.equal(fair(4.0, 4.0), 0);
  assert.equal(fair(4.8, 4.8), 0);
  // Salué au-dessus de l'habitude : fair monte.
  assert.ok(fair(4.8, 4.2) >= 2);
  const s = (r: Partial<RencontreEntraineur>) => evoluerEntraineur(carriere([match(0, r)]), { normes: NORMES }).compteurs.FAIR.avance;
  assert.equal(s({ sanctions: { joueurs: 1, entraineur: 0 } }), -2);
  assert.equal(s({ sanctions: { joueurs: 0, entraineur: 1 } }), -4);
}

// 8 · rec : la recrue qui joue et reste.
{
  const rec = (depart?: string, joue = true) => {
    const m = [...membres(6), { id: "g", nom: "Gaby", arrivee: "2026-11-01", depart: depart ? { le: depart, motif: "depart" as const } : undefined }];
    const rs = Array.from({ length: 16 }, (_, k) => match(k, { effectif: IDS.map((id) => ligne(id, id === "g" ? (joue ? {} : { inscrit: false }) : {})) }));
    return evoluerEntraineur(carriere(rs, m), { normes: NORMES }).journal.find((f) => f.cle === "REC")!.texte;
  };
  assert.equal(rec(), "Gaby s'est installé");
  assert.equal(rec("2026-12-10"), "Gaby n'a pas pris sa place");
  assert.equal(rec(undefined, false), "Gaby n'a pas pris sa place");
}

// 9 · Le journal en mots (D12) ; Champion à 40 % des rencontres dirigées (D14).
{
  const ev = evoluerEntraineur(CARRIERE_DEMO);
  for (const f of ev.journal.filter((x) => x.cle === "RES")) assert.ok(!/\d/.test(f.texte), `l'attendu ne sort pas : « ${f.texte} »`);
  assert.equal(championDe(6, 16), false);
  assert.equal(championDe(7, 16), true);
}

// 10 · Les deux saisons de Lucien : la carte des captures.
{
  const ev = evoluerEntraineur(CARRIERE_DEMO);
  assert.deepEqual(ev.officielles, { RES: 77, PRES: 79, TOUR: 75, COH: 75, FAIR: 77, REC: 75 });
  assert.equal(noteEntraineur(ev.officielles), 77);
  assert.equal(ev.rencontres, 24);
  assert.equal(ev.majs.length, 6);
  assert.deepEqual(ev.exploits, ["bb-21"]);
}

// 11 · Les matières : ni or, ni bleu, ni rouge, ni la braise ; aucune n'entre dans les finitions d'un joueur.
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
