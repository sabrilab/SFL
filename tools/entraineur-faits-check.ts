// Des lignes de la base à la carte d'entraîneur (lot B1, 03/11/2026 ;
// lib/sfl/entraineur-faits.ts) : des lignes inventées, comme le serveur les lit,
//   1. les trois saisons de Lucien (entraineur-demo.ts) rejouées en lignes
//      (décalées de deux ans : avant la saison 1, en 2026, le championnat ne
//      compte rien) donnent la même carrière que l'étude, et la même carte
//      (rés 78, pré 76, coh 75, note 77) ; le calcul entier, deux fois, la
//      même carte ;
//   2. les bornes de la place ; l'entraîneur jamais parmi ses joueurs ; les
//      motifs de départ (l'exclusion compte, la dissolution non ; une ligne
//      d'avant sans motif) ; l'activité par les feuilles ;
//   3. le 5 contre 4 vu des deux côtés ; le forfait par les présents ;
//      l'amical à deux équipes de 4 ; sans les deux feuilles, rés saute ;
//   4. la note de carte au coup d'envoi : la journée SFL d'avant, pas celle
//      d'après ni celle du jour ; le dernier match Bola d'avant ; 75 sans
//      rien ;
//   5. les normes d'une saison finie, figées une fois lue en entier ; le
//      plancher tenu.
//   npx tsx tools/entraineur-faits-check.ts
import assert from "node:assert/strict";
import { CARRIERE_DEMO, AVANT_DEMO, MEMBRES_DEMO, RENCONTRES_DEMO } from "../src/lib/sfl/entraineur-demo";
import { evoluerEntraineur, noteEntraineur, type CarriereEntraineur, type RencontreEntraineur } from "../src/lib/sfl/entraineur";
import {
  aRevoirDe,
  carriereDe,
  cartesDeLaLigue,
  cartesEntraineurs,
  equipeAvantDe,
  faitsDeLaLigue,
  normesDeLaSaison,
  normesFigeables,
  placesReelles,
  type CartesDeLaLigue,
  type LignesEntraineur,
} from "../src/lib/sfl/entraineur-faits";
import type { MatchBola } from "../src/lib/sfl/ligue-vierge";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

/* ------------------------------ Les lignes ------------------------------ */

const ANS = 2;
const decaler = (iso: string) => `${Number(iso.slice(0, 4)) + ANS}${iso.slice(4)}`;
const MA = 30;
/** Les adversaires de Lucien, leurs noms, et les notes de carte de leur feuille (entraineur-demo.ts). */
const ADVERSES: Record<number, [string, number[]]> = {
  11: ["Lambersart Athletic", [85, 84, 83, 82, 81, 79]],
  12: ["Tourcoing United", [77, 76, 76, 75, 74]],
  13: ["Lomme Sporting", [78, 77, 75, 74, 74, 73]],
  14: ["Vauban FC", [76, 75, 75, 74, 73]],
  15: ["Hellemmes City", [79, 77, 76, 76, 75, 72]],
  16: ["Union Marcq", [75, 74, 74, 73, 72, 71]],
  17: ["Croix Rovers", [78, 78, 76, 75, 75]],
  18: ["Villeneuve Five", [77, 75, 74, 74, 73, 72]],
  19: ["Wattrelos Stars", [81, 79, 78, 77, 76, 75]],
  20: ["Euralille FC", [74, 74, 73, 72, 72]],
};
const NOTES: Record<string, number> = { "ma-yanis": 79, "ma-bilal": 76, "ma-theo": 74, "ma-medhi": 77, "ma-kevin": 73, "ma-ryad": 75, "ma-samir": 72, "ma-nassim": 76 };
const adverses = (e: number) => ADVERSES[e][1].map((_, i) => `adv-${e}-${i}`);
const coup = (jour: string) => `${jour}T19:00:00Z`;
const heures = (iso: string, h: number) => new Date(Date.parse(iso) + h * 3_600_000).toISOString();

/** La saison SFL de la fixture : chacun à la base de sa note, aucune journée (les cartes ne bougent pas). */
function saisonDesNotes(): Saison {
  const roster = [
    ...Object.entries(NOTES).map(([id, n]) => ({ name: MEMBRES_DEMO.find((m) => m.id === id)!.nom, poste: "M", profil: "Actif", base: [n, n, n, n, n, n] })),
    ...Object.entries(ADVERSES).flatMap(([e, [, ns]]) => ns.map((n, i) => ({ name: `Adv${e}x${i}`, poste: "M", profil: "Actif", base: [n, n, n, n, n, n] }))),
  ];
  return { numero: 1, journees: [], roster, entries: [], convocations: [] };
}

/**
 * Un match entre MA et un adversaire : le défi, les deux saisies (et leurs présents), les deux feuilles.
 * `conteste` : la saisie de MA dit autre chose (un litige jamais tranché ; l'adversaire dit le vrai score).
 */
function poserMatch(
  l: LignesEntraineur,
  id: number,
  jour: string,
  adversaire: number,
  [pour, contre]: [number, number],
  feuille: string[],
  o: { nous?: number; eux?: number; conteste?: [number, number] } = {}
) {
  const c = coup(jour);
  l.defis.push({ id, de: MA, a: adversaire, jour, heure: "20:00", lieu: "Five Lille Sud", statut: "accepte", forfait_de: null });
  const nous = o.nous ?? 5;
  const eux = o.eux ?? 5;
  const [dit, ditContre] = o.conteste ?? [pour, contre];
  l.resultats.push(
    { defi_id: id, equipe_id: MA, pour: dit, contre: ditContre, saisi_le: heures(c, 1), presents: nous, presents_adverses: eux },
    { defi_id: id, equipe_id: adversaire, pour: contre, contre: pour, saisi_le: heures(c, 2), presents: eux, presents_adverses: nous }
  );
  l.feuilles.push({ defi_id: id, equipe_id: MA, deposee_le: heures(c, -3) }, { defi_id: id, equipe_id: adversaire, deposee_le: heures(c, -4) });
  for (const j of feuille) l.feuilleJoueurs.push({ defi_id: id, equipe_id: MA, joueur: j });
  for (const j of adverses(adversaire)) l.feuilleJoueurs.push({ defi_id: id, equipe_id: adversaire, joueur: j });
}

/** Lucien et Mons Academy en lignes, comme le serveur les lit. */
function lignesDeLucien(): LignesEntraineur {
  const l: LignesEntraineur = {
    equipes: [
      { id: MA, nom: "Mons Academy", created_at: "2028-06-01T10:00:00Z", dissoute_le: null },
      ...Object.entries(ADVERSES).map(([e, [nom]]) => ({ id: Number(e), nom, created_at: "2028-06-01T10:00:00Z", dissoute_le: null })),
    ],
    membres: [],
    signatures: [],
    departs: [],
    entraineurs: [{ equipe_id: MA, joueur: "lucien", debut: "2028-10-24T12:00:00Z", fin: null, motif: null }],
    defis: [],
    resultats: [],
    feuilles: [],
    feuilleJoueurs: [],
    profils: [
      { id: "lucien", name: "Lucien" },
      ...MEMBRES_DEMO.map((m) => ({ id: m.id, name: m.nom })),
      ...Object.entries(ADVERSES).flatMap(([e, [, ns]]) => ns.map((_, i) => ({ id: `adv-${e}-${i}`, name: `Adv${e}x${i}` }))),
    ],
  };
  for (const m of MEMBRES_DEMO) {
    l.signatures.push({ equipe_id: MA, joueur: m.id, le: `${decaler(m.arrivee)}T12:00:00Z` });
    if (m.depart) l.departs.push({ equipe_id: MA, joueur: m.id, parti_le: `${decaler(m.depart.le)}T12:00:00Z`, motif: m.depart.motif === "depart" ? "depart" : "exclusion", role: "membre" });
    else l.membres.push({ equipe_id: MA, joueur: m.id, statut: "membre", role: "membre", signe_le: `${decaler(m.arrivee)}T12:00:00Z`, created_at: `${decaler(m.arrivee)}T09:00:00Z` });
  }
  l.signatures.push({ equipe_id: MA, joueur: "lucien", le: "2028-10-24T12:00:00Z" });
  l.membres.push({ equipe_id: MA, joueur: "lucien", statut: "membre", role: "entraineur", signe_le: "2028-10-24T12:00:00Z", created_at: "2028-10-23T12:00:00Z" });
  for (const [e] of Object.entries(ADVERSES))
    adverses(Number(e)).forEach((j, i) => {
      l.signatures.push({ equipe_id: Number(e), joueur: j, le: "2028-06-02T12:00:00Z" });
      l.membres.push({ equipe_id: Number(e), joueur: j, statut: "membre", role: i === 0 ? "capitaine" : "membre", signe_le: "2028-06-02T12:00:00Z", created_at: "2028-06-02T10:00:00Z" });
    });
  // Ses deux dernières feuilles d'avant lui (les derniereFeuille de l'étude) : la saison 6, avant son arrivée.
  poserMatch(l, 900, "2028-10-10", 19, [2, 2], ["ma-medhi", "ma-samir", "ma-yanis", "ma-bilal", "ma-theo"]);
  poserMatch(l, 901, "2028-10-17", 20, [1, 1], ["ma-yanis", "ma-bilal", "ma-theo", "ma-kevin", "ma-ryad"]);
  // Ses quarante rencontres.
  RENCONTRES_DEMO.forEach((r, i) =>
    poserMatch(l, 1000 + i, decaler(r.le), r.adversaire, [r.pour, r.contre], r.feuille.map((x) => x.id), {
      nous: r.cinqContreQuatre === "nous" ? 4 : 5,
      eux: r.cinqContreQuatre === "eux" ? 4 : 5,
      // Le litige de l'étude : son capitaine dit un nul ; Hellemmes, la défaite.
      ...(r.litige ? { conteste: [r.pour + 1, r.contre] as [number, number] } : {}),
    })
  );
  return l;
}

const MAINTENANT = new Date("2029-11-15T12:00:00Z");
const cartesFixture = (): CartesDeLaLigue => cartesDeLaLigue({ saison: saisonDesNotes(), maintenant: MAINTENANT, matchsBola: [] });
/** Une rencontre sans ce qui dépend de la base (son id, le nom de l'adversaire, l'ordre de l'effectif), sa saison ramenée à celle de l'étude. */
const nue = (r: RencontreEntraineur) => {
  const { id, adversaireNom, effectif, ...reste } = r;
  void id;
  void adversaireNom;
  return { ...reste, effectif: [...(effectif ?? [])].sort((a, b) => a - b) };
};

// 1 · Les trois saisons de Lucien, en lignes : la même carrière, la même carte.
{
  const l = lignesDeLucien();
  const f = faitsDeLaLigue(l, MAINTENANT);
  const c = carriereDe(f, l.entraineurs[0], cartesFixture());
  assert.equal(c.arrivee, "2028-10-24");
  assert.equal(c.fin, undefined);
  assert.equal(c.feuillesDepuis, "2028-10-10");
  assert.equal(c.rencontres.length, 40, "les 40 rencontres, pas celles d'avant lui");
  const attendues = RENCONTRES_DEMO.map((r) => nue({ ...r, le: decaler(r.le), saison: r.saison + 6 }));
  assert.deepEqual(c.rencontres.map(nue), attendues, "les rencontres de l'étude, à la lettre (feuilles, notes, 5 contre 4)");
  assert.equal(c.rencontres.find((r) => r.adversaire === 11)!.adversaireNom, "Lambersart Athletic");
  const parId = (t: { id: string }[]) => [...t].sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(
    parId(c.membres),
    parId(MEMBRES_DEMO.map((m) => ({ ...m, arrivee: decaler(m.arrivee), ...(m.depart ? { depart: { ...m.depart, le: decaler(m.depart.le) } } : {}), ...(m.derniereFeuille ? { derniereFeuille: decaler(m.derniereFeuille) } : {}) }))),
    "les joueurs de l'étude, leurs arrivées, le départ de Samir, leurs dernières feuilles d'avant"
  );
  assert.ok(!c.membres.some((m) => m.id === "lucien"), "l'entraîneur n'est jamais parmi ses joueurs");
  // Avec son équipe d'avant de l'étude (16 rencontres, deux forfaits), la carte de l'étude.
  const ev = evoluerEntraineur({ ...c, equipeAvant: AVANT_DEMO });
  const etude = evoluerEntraineur(CARRIERE_DEMO);
  assert.deepEqual(ev.officielles, { RES: 78, PRES: 75, COH: 75 });
  assert.deepEqual(ev.officielles, etude.officielles);
  assert.equal(noteEntraineur(ev.officielles), 76);
  assert.equal(ev.majs.length, etude.majs.length);
  assert.deepEqual(ev.exploits, ["1022"], "la victoire contre Lambersart, bien plus fort");
  assert.ok(ev.journal.some((x) => x.texte === "victoire contre bien plus fort" && x.adversaireNom === "Lambersart Athletic"));
  // Son équipe d'avant, d'après les lignes : deux rencontres (aucun forfait), et ses joueurs actifs depuis leur arrivée.
  const av = equipeAvantDe(f, MA, l.entraineurs[0].debut);
  assert.deepEqual({ rencontres: av.rencontres, presence: av.presence, departs: av.departs }, { rencontres: 2, presence: 0, departs: 0 });
  // Leurs jours dans les 120 jours d'avant : chacun depuis son arrivée jusqu'au 24 octobre (Nassim n'est pas encore là).
  const jours = MEMBRES_DEMO.filter((m) => m.arrivee < "2026-10-24").reduce((s, m) => s + (Date.parse("2028-10-24") - Date.parse(decaler(m.arrivee))) / 86_400_000, 0);
  assert.equal(av.joursActifs, jours);
  // Le calcul entier (le serveur) : la carte, deux fois la même.
  const un = cartesEntraineurs(l, { cartes: cartesFixture(), normes: {}, planchers: new Map(), maintenant: MAINTENANT });
  const deux = cartesEntraineurs(l, { cartes: cartesFixture(), normes: {}, planchers: new Map(), maintenant: MAINTENANT });
  assert.equal(un.cartes.length, 1);
  assert.equal(un.cartes[0].joueur, "lucien");
  assert.equal(un.cartes[0].equipe, MA);
  assert.deepEqual(un.cartes[0].stats, deux.cartes[0].stats, "le même calcul deux fois");
  assert.deepEqual(JSON.parse(JSON.stringify(un.cartes[0].ev)), JSON.parse(JSON.stringify(deux.cartes[0].ev)));
  assert.equal(un.cartes[0].ev.rencontres, 40);
  // Le plancher : une carte gardée plus haute ne redescend pas.
  const plancher = { RES: 80, PRES: 80, COH: 80 };
  const tenu = cartesEntraineurs(l, { cartes: cartesFixture(), normes: {}, planchers: new Map([["lucien", plancher]]), maintenant: MAINTENANT });
  for (const k of ["RES", "PRES", "COH"] as const) assert.ok(tenu.cartes[0].stats[k] >= 80, `${k} sous le plancher`);
  // Avant que la feuille ferme et soit lue (24 h après la fermeture, 3 jours après le coup d'envoi), la dernière rencontre attend.
  const tot = faitsDeLaLigue(l, new Date("2029-10-19T12:00:00Z"));
  assert.equal(carriereDe(tot, l.entraineurs[0], cartesFixture()).rencontres.length, 39);
}

// 2 · Les bornes de sa place ; les motifs de départ ; l'activité.
{
  const l = lignesDeLucien();
  // Sa place prend fin le 1er mars 2029 : les rencontres d'après ne sont plus à lui ; la fenêtre de coh se ferme.
  l.entraineurs[0] = { ...l.entraineurs[0], fin: "2029-03-01T10:00:00Z", motif: "depart" };
  const f = faitsDeLaLigue(l, MAINTENANT);
  const c = carriereDe(f, l.entraineurs[0], cartesFixture());
  assert.equal(c.fin, "2029-03-01");
  assert.equal(c.rencontres.length, 14, "la saison 1 de l'étude seulement");
  assert.ok(c.rencontres.every((r) => r.le < "2029-03-01"));
  // Une seconde place, ailleurs (Union Marcq), dès le 20 mars : ses compteurs le suivent.
  l.entraineurs.push({ equipe_id: 16, joueur: "lucien", debut: "2029-03-20T12:00:00Z", fin: null, motif: null });
  // Sa ligne de membre a suivi : entraîneur d'Union Marcq (une place ouverte sans elle ne serait pas une place).
  l.membres = l.membres.map((m) => (m.joueur === "lucien" ? { ...m, equipe_id: 16, signe_le: "2029-03-20T12:00:00Z", created_at: "2029-03-19T12:00:00Z" } : m));
  const deux = cartesEntraineurs(l, { cartes: cartesFixture(), normes: {}, planchers: new Map(), maintenant: MAINTENANT });
  assert.equal(deux.cartes.length, 1, "une carte par personne");
  assert.equal(deux.cartes[0].equipe, 16, "son équipe : celle qu'il entraîne");
  const parUnion = (lignesDeLucien().defis.filter((d) => d.a === 16 && d.jour >= "2029-03-20")).length;
  assert.equal(deux.cartes[0].ev.rencontres, 14 + parUnion, "les rencontres de ses deux places, vues de chaque équipe");

  // Les motifs de départ, d'après les lignes.
  const m = lignesDeLucien();
  m.departs.push(
    { equipe_id: MA, joueur: "ma-kevin", parti_le: "2029-01-05T12:00:00Z", motif: "exclusion", role: "membre" },
    // Une ligne d'avant le 03/11 : sans motif, un départ.
    { equipe_id: 13, joueur: "adv-13-0", parti_le: "2029-01-06T12:00:00Z", motif: null, role: null }
  );
  m.membres = m.membres.filter((x) => !(x.equipe_id === MA && x.joueur === "ma-kevin") && !(x.equipe_id === 13 && x.joueur === "adv-13-0"));
  // Lomme Sporting dissoute : la ligne sans motif qui tombe à l'instant de la dissolution est la dissolution.
  m.equipes = m.equipes.map((e) => (e.id === 14 ? { ...e, dissoute_le: "2029-02-01T08:00:00Z" } : e));
  m.departs.push({ equipe_id: 14, joueur: "adv-14-1", parti_le: "2029-02-01T08:00:00Z", motif: null, role: null });
  const fm = faitsDeLaLigue(m, MAINTENANT);
  const motif = (e: number, j: string) => fm.joueurs.get(e)!.find((x) => x.id === j)?.depart?.motif;
  assert.equal(motif(MA, "ma-kevin"), "exclusion");
  assert.equal(motif(MA, "ma-samir"), "depart");
  assert.equal(motif(13, "adv-13-0"), "depart");
  assert.equal(motif(14, "adv-14-1"), "dissolution");
  // L'exclusion de Kevin compte comme un départ ; la dissolution ne compte pas.
  const avec = evoluerEntraineur({ ...carriereDe(fm, m.entraineurs[0], cartesFixture()), equipeAvant: AVANT_DEMO });
  const sans = evoluerEntraineur({ ...carriereDe(faitsDeLaLigue(lignesDeLucien(), MAINTENANT), m.entraineurs[0], cartesFixture()), equipeAvant: AVANT_DEMO });
  assert.ok(avec.compteurs.COH.avance < sans.compteurs.COH.avance - 0.9, "l'exclusion d'un joueur actif vaut un départ");
  assert.ok(avec.journal.some((x) => x.texte.includes("Kevin a été exclu")));

  // L'entraîneur jamais parmi les joueurs, même quand sa ligne de départ dit « entraineur ».
  const e = lignesDeLucien();
  e.departs.push({ equipe_id: MA, joueur: "lucien", parti_le: "2029-11-01T12:00:00Z", motif: "depart", role: "entraineur" });
  e.membres = e.membres.filter((x) => x.joueur !== "lucien");
  e.entraineurs[0] = { ...e.entraineurs[0], fin: "2029-11-01T12:00:00Z", motif: "depart" };
  assert.ok(!faitsDeLaLigue(e, MAINTENANT).joueurs.get(MA)!.some((x) => x.id === "lucien"));

  // L'activité : un joueur sans feuille depuis plus de 60 jours ne compte plus, et son départ ne coûte rien.
  const a = lignesDeLucien();
  a.signatures.push({ equipe_id: MA, joueur: "ma-fantome", le: "2028-09-01T12:00:00Z" });
  a.profils.push({ id: "ma-fantome", name: "Fantôme" });
  a.departs.push({ equipe_id: MA, joueur: "ma-fantome", parti_le: "2029-06-01T12:00:00Z", motif: "depart", role: "membre" });
  const fa = faitsDeLaLigue(a, MAINTENANT);
  const ca = evoluerEntraineur({ ...carriereDe(fa, a.entraineurs[0], cartesFixture()), equipeAvant: AVANT_DEMO });
  assert.ok(!ca.journal.some((x) => x.texte.includes("Fantôme")), "le départ d'un joueur jamais inscrit, loin de ses 60 premiers jours : rien");
  // Il ne pèse que ses derniers jours d'arrivée (du 24 au 30 octobre 2028, la fin de ses 60 premiers jours) : 7 jours-joueurs.
  const ecart = ca.compteurs.COH.poids - evoluerEntraineur({ ...carriereDe(faitsDeLaLigue(lignesDeLucien(), MAINTENANT), a.entraineurs[0], cartesFixture()), equipeAvant: AVANT_DEMO }).compteurs.COH.poids;
  const taux = (AVANT_DEMO.departs + 840 * 0.0012) / (AVANT_DEMO.joursActifs + 840);
  assert.ok(Math.abs(ecart - 7 * taux) < 1e-9, `ses jours actifs : ${(ecart / taux).toFixed(2)}`);
}

// 3 · Le 5 contre 4 des deux côtés ; le forfait par les présents ; l'amical à deux équipes de 4 ; une feuille qui manque.
{
  const l = lignesDeLucien();
  const f = faitsDeLaLigue(l, MAINTENANT);
  const r = (e: number, defi: number) => f.rencontres.get(e)!.find((x) => x.defi === defi)!;
  const jan = 1000 + RENCONTRES_DEMO.findIndex((x) => x.le === "2027-01-09");
  assert.equal(r(MA, jan).cinqContreQuatre, "nous");
  assert.equal(r(20, jan).cinqContreQuatre, "eux", "vu de l'adversaire : l'autre était à 4");
  assert.deepEqual([r(MA, jan).pour, r(MA, jan).contre], [3, 3], "rés lit le score du terrain, avant le but retiré");
  // Trois présents ou moins : son forfait (0 – 3) ; l'adversaire n'en tire rien pour sa carte.
  const g = lignesDeLucien();
  g.resultats = g.resultats.map((x) => (x.defi_id === 1000 ? (x.equipe_id === MA ? { ...x, presents: 3 } : { ...x, presents_adverses: 3 }) : x));
  const fg = faitsDeLaLigue(g, MAINTENANT);
  assert.equal(fg.rencontres.get(MA)!.find((x) => x.defi === 1000)!.forfait, true);
  assert.equal(fg.rencontres.get(12)!.find((x) => x.defi === 1000), undefined, "le forfait de l'adversaire ne dit rien de lui");
  // Deux équipes à 4 : un amical, nulle part.
  const h = lignesDeLucien();
  h.resultats = h.resultats.map((x) => (x.defi_id === 1001 ? { ...x, presents: 4, presents_adverses: 4 } : x));
  const fh = faitsDeLaLigue(h, MAINTENANT);
  assert.equal(fh.rencontres.get(MA)!.find((x) => x.defi === 1001), undefined);
  assert.equal(fh.rencontres.get(16)!.find((x) => x.defi === 1001), undefined);
  // Un litige jamais tranché (deux saisies qui ne collent pas, feuille fermée) : non classé au championnat, mais lu pour la
  // carte avec la version de l'adversaire (contrôle du 03/11/2026 : contester une défaite l'effaçait).
  const k = lignesDeLucien();
  k.resultats = k.resultats.map((x) => (x.defi_id === 1002 && x.equipe_id === MA ? { ...x, pour: 9 } : x));
  const lk = faitsDeLaLigue(k, MAINTENANT).rencontres.get(MA)!.find((x) => x.defi === 1002)!;
  assert.deepEqual([lk.litige, lk.pour, lk.contre], [true, 5, 2], "la version de Lomme Sporting : 5 – 2");
  // Lomme Sporting conteste une défaite 2 – 5 en disant 6 – 0 : pour Lucien, sa version compte, contre lui.
  const k2 = lignesDeLucien();
  k2.resultats = k2.resultats.map((x) => (x.defi_id === 1002 && x.equipe_id === 13 ? { ...x, pour: 6, contre: 0 } : x));
  const fk2 = faitsDeLaLigue(k2, MAINTENANT);
  const l2 = fk2.rencontres.get(MA)!.find((x) => x.defi === 1002)!;
  assert.deepEqual([l2.litige, l2.pour, l2.contre], [true, 0, 6]);
  const ek2 = evoluerEntraineur({ ...carriereDe(fk2, k2.entraineurs[0], cartesFixture()), equipeAvant: AVANT_DEMO });
  assert.ok(ek2.journal.some((x) => x.source === "1002" && x.cle === "RES" && x.litige && x.texte.startsWith("défaite")), "elle compte en rés, marquée litige");
  // Sa saisie restée seule : marquée.
  const s = lignesDeLucien();
  s.resultats = s.resultats.filter((x) => !(x.defi_id === 1003 && x.equipe_id !== MA));
  assert.equal(faitsDeLaLigue(s, MAINTENANT).rencontres.get(MA)!.find((x) => x.defi === 1003)!.saisieSeule, true);
  // Sans la feuille adverse, rés saute la rencontre ; sa feuille compte encore pour l'activité.
  const n = lignesDeLucien();
  n.feuilles = n.feuilles.filter((x) => !(x.defi_id === 1004 && x.equipe_id !== MA));
  n.feuilleJoueurs = n.feuilleJoueurs.filter((x) => !(x.defi_id === 1004 && x.equipe_id !== MA));
  const cn = carriereDe(faitsDeLaLigue(n, MAINTENANT), n.entraineurs[0], cartesFixture());
  const sansAdverse = cn.rencontres.find((x) => x.id === "1004")!;
  assert.deepEqual(sansAdverse.adverses, []);
  assert.ok(sansAdverse.feuille.length >= 5);
  const evn = evoluerEntraineur({ ...cn, equipeAvant: AVANT_DEMO });
  assert.ok(!evn.journal.some((x) => x.source === "1004" && x.cle === "RES" && x.compte !== false), "rés ne la compte pas");
  assert.ok(evn.journal.some((x) => x.source === "1004" && x.cle === "RES" && x.compte === false), "le journal dit son issue, sans pastille");
  assert.ok(evn.journal.some((x) => x.source === "1004" && x.cle === "PRES"));
}

// 4 · La note de carte au coup d'envoi.
{
  // Alpha, 80 partout, marque quatre buts à chacune des quatre premières journées de novembre 2026 : sa carte monte après la J4.
  const ligne = (j: number): MatchEntry => ({ j, player: "Alpha", team: "Noirs", statut: "Présent", result: "Victoire", sflTime: false, buts: 4, passes: 1, cleanSheet: false, mvp: false, impact: false, def: false, retard: false });
  const saison: Saison = {
    numero: 1,
    journees: ["1 nov.", "8 nov.", "15 nov.", "22 nov.", "29 nov."].map((date, i) => ({ j: i + 1, date, sflTime: false })),
    roster: [{ name: "Alpha", poste: "M", profil: "Actif", base: [80, 80, 80, 80, 80, 80] }],
    entries: [1, 2, 3, 4].map(ligne),
    convocations: [],
  };
  // Bêta, joueur Bola (un filleul) : deux matchs validés, le 10 et le 24 novembre.
  const bola = (id: number, jour: string, buts: number): MatchBola => ({
    id,
    jour,
    heure: "20h00",
    genre: "match",
    scoreClairs: 5,
    scoreFonces: 1,
    etat: "compte",
    joueurs: Array.from({ length: 8 }, (_, i) => ({
      id: i === 0 ? "beta" : `b${i}`,
      name: i === 0 ? "Bêta" : `B${i}`,
      equipe: i < 4 ? ("clairs" as const) : ("fonces" as const),
      buts: i === 0 ? buts : 0,
      passes: 0,
      carteBola: true,
    })),
  });
  const cartes = cartesDeLaLigue({
    saison,
    maintenant: new Date("2026-12-15T12:00:00Z"),
    matchsBola: [bola(1, "2026-11-10", 6), bola(2, "2026-11-24", 6)],
    entreesSfl: new Map([["gamma", "2026-11-20T12:00:00Z"]]),
  });
  const alpha = { id: "alpha", nom: "Alpha" };
  const avantJ4 = cartes.noteAu(alpha, new Date("2026-11-20T19:00:00Z"));
  const jourDeJ4 = cartes.noteAu(alpha, new Date("2026-11-22T19:00:00Z"));
  const apresJ4 = cartes.noteAu(alpha, new Date("2026-11-25T19:00:00Z"));
  assert.equal(avantJ4, 80, "avant la J4 : la carte de départ");
  assert.equal(jourDeJ4, 80, "le jour même de la J4 : pas encore sa mise à jour");
  assert.ok(apresJ4 > 80, `après la J4, la carte mise à jour (${apresJ4})`);
  const beta = { id: "beta", nom: "Bêta" };
  assert.equal(cartes.noteAu(beta, new Date("2026-11-09T19:00:00Z")), 75, "Bêta avant son premier match : 75");
  const un = cartes.noteAu(beta, new Date("2026-11-15T19:00:00Z"));
  const deux = cartes.noteAu(beta, new Date("2026-11-30T19:00:00Z"));
  assert.ok(un > 75 && deux >= un, `sa carte Bola d'après le dernier match d'avant (${un}, puis ${deux})`);
  assert.equal(cartes.noteAu(beta, new Date("2026-11-24T18:00:00Z")), un, "le match du soir même n'est pas encore joué");
  assert.equal(cartes.noteAu({ id: "inconnu", nom: "Personne" }, new Date("2026-11-30T19:00:00Z")), 75, "sans rien : 75");
  // Gamma, dans l'effectif mais entré en SFL le 20 novembre : avant, pas de carte SFL (ni Bola) : 75.
  const g: Saison = { ...saison, roster: [...saison.roster, { name: "Gamma", poste: "M", profil: "Actif", base: [90, 90, 90, 90, 90, 90] }] };
  const cg = cartesDeLaLigue({ saison: g, maintenant: new Date("2026-12-15T12:00:00Z"), matchsBola: [], entreesSfl: new Map([["gamma", "2026-11-20T12:00:00Z"]]) });
  assert.equal(cg.noteAu({ id: "gamma", nom: "Gamma" }, new Date("2026-11-18T19:00:00Z")), 75);
  assert.equal(cg.noteAu({ id: "gamma", nom: "Gamma" }, new Date("2026-11-21T19:00:00Z")), 90);
  // Une saison close (les archives) : sa carte à elle, pour un match d'avant la clôture.
  const close: Saison = {
    ...g,
    numero: 2,
    journees: [],
    entries: [],
    roster: [{ name: "Alpha", poste: "M", profil: "Actif", base: [70, 70, 70, 70, 70, 70] }],
    archives: [{ numero: 1, nom: "Saison 1", cloturee: "2026-12-01T12:00:00Z", journees: saison.journees, roster: saison.roster, entries: saison.entries }],
  };
  const cc = cartesDeLaLigue({ saison: close, maintenant: new Date("2027-01-15T12:00:00Z"), matchsBola: [] });
  assert.equal(cc.noteAu(alpha, new Date("2026-11-25T19:00:00Z")), apresJ4, "un match de la saison close : sa carte de ce temps-là");
  assert.equal(cc.noteAu(alpha, new Date("2027-01-10T19:00:00Z")), 70, "après la clôture : la carte de la saison nouvelle");
}

// 5 · Les normes d'une saison finie, figées une fois lue en entier.
{
  const l = lignesDeLucien();
  const f = faitsDeLaLigue(l, MAINTENANT);
  const s7 = normesDeLaSaison(f, 7);
  // Saison 7 (novembre 2028 – février 2029) : 14 rencontres de Lucien, vues des deux côtés, un 5 contre 4 (à 4 : −1).
  assert.equal(s7.presence, -1 / 28);
  assert.ok(s7.departsParJour! > 0, "le départ de Samir");
  assert.deepEqual(normesDeLaSaison(f, 3), {}, "rien à mesurer : rien");
  assert.equal(normesFigeables(7, new Date("2029-03-04T12:00:00Z")), false, "le dernier jour d'une saison + 3 jours : des rencontres attendent encore");
  assert.equal(normesFigeables(7, new Date("2029-03-05T05:00:00Z")), true);
  // Le calcul fige les saisons finies qui ne le sont pas, et s'en sert aussitôt.
  const r = cartesEntraineurs(l, { cartes: cartesFixture(), normes: {}, planchers: new Map(), maintenant: MAINTENANT });
  assert.deepEqual(r.normes.map((x) => x.saison), [1, 2, 3, 4, 5, 6, 7, 8, 9], "toutes les saisons finies avant novembre 2029 (la 9e, finie le 31 octobre, lue le 5 novembre)");
  assert.equal(r.normes.find((x) => x.saison === 7)!.normes.presence, -1 / 28);
  // Une saison sans rencontre garde les normes d'avant (celles de départ).
  assert.deepEqual(r.normes.find((x) => x.saison === 1)!.normes, { presence: -0.08, departsParJour: 0.0012 });
  // Déjà figées : rien de plus.
  const deja = Object.fromEntries(r.normes.map((x) => [x.saison, x.normes]));
  assert.deepEqual(cartesEntraineurs(l, { cartes: cartesFixture(), normes: deja, planchers: new Map(), maintenant: MAINTENANT }).normes, []);
}

// 6 · Les correctifs du contrôle adverse (03/11/2026), du côté des lignes.
{
  // La place fantôme (la course d'equipe_signer) : une place ouverte sans ligne de membre entraîneur est ignorée.
  const l = lignesDeLucien();
  l.membres.push({ equipe_id: 12, joueur: "bilal-x", statut: "membre", role: "membre", signe_le: "2028-10-05T10:00:00Z", created_at: "2028-10-05T10:00:00Z" });
  l.profils.push({ id: "bilal-x", name: "Bilal X" });
  l.entraineurs.push({ equipe_id: 13, joueur: "bilal-x", debut: "2028-10-05T10:00:00Z", fin: null, motif: null });
  assert.deepEqual(placesReelles(l, MAINTENANT).map((p) => p.joueur), ["lucien"], "la place fantôme n'est pas une place");
  assert.ok(!cartesEntraineurs(l, { cartes: cartesFixture(), normes: {}, planchers: new Map(), maintenant: MAINTENANT }).cartes.some((c) => c.joueur === "bilal-x"));
  // Le préavis d'exclusion échu, pas encore relevé : sa place prend fin à l'heure du préavis.
  const e = lignesDeLucien();
  e.membres = e.membres.map((m) => (m.joueur === "lucien" ? { ...m, depart_le: "2029-03-01T10:00:00Z" } : m));
  const [p] = placesReelles(e, MAINTENANT);
  assert.deepEqual([p.fin, p.motif], ["2029-03-01T10:00:00Z", "exclusion"]);
  assert.equal(carriereDe(faitsDeLaLigue(e, MAINTENANT), p, cartesFixture()).rencontres.length, 14, "rien après la fin du préavis");
  // Un joueur exclu au préavis échu : parti à son heure, exclu (la cohésion le compte).
  const j = lignesDeLucien();
  j.membres = j.membres.map((m) => (m.joueur === "ma-kevin" ? { ...m, depart_le: "2029-01-05T12:00:00Z" } : m));
  const kevin = faitsDeLaLigue(j, MAINTENANT).joueurs.get(MA)!.find((x) => x.id === "ma-kevin")!;
  assert.deepEqual(kevin.depart, { le: "2029-01-05", motif: "exclusion" });
  // La qualification : une rencontre dans ses 7 premiers jours ne compte pas.
  const q = lignesDeLucien();
  poserMatch(q, 950, "2028-10-27", 14, [0, 4], ["ma-yanis", "ma-bilal", "ma-theo", "ma-medhi", "ma-kevin"]);
  const cq = carriereDe(faitsDeLaLigue(q, MAINTENANT), q.entraineurs[0], cartesFixture());
  assert.ok(!cq.rencontres.some((r) => r.id === "950"), "trois jours après sa signature : pas encore qualifié");
  assert.equal(cq.rencontres.length, 40);
  // Une carte inconnue (un compte sans carte SFL ni Bola) sur l'une des deux feuilles : rés saute.
  const u = lignesDeLucien();
  u.feuilleJoueurs = u.feuilleJoueurs.map((x) => (x.defi_id === 1005 && x.joueur === "adv-17-0" ? { ...x, joueur: "neuf" } : x));
  u.profils.push({ id: "neuf", name: "Nouveau" });
  const ru = carriereDe(faitsDeLaLigue(u, MAINTENANT), u.entraineurs[0], cartesFixture()).rencontres.find((r) => r.id === "1005")!;
  assert.equal(ru.cartesInconnues, true);
  assert.equal(carriereDe(faitsDeLaLigue(lignesDeLucien(), MAINTENANT), u.entraineurs[0], cartesFixture()).rencontres.find((r) => r.id === "1005")!.cartesInconnues, undefined);
  // L'effectif au coup d'envoi : les notes de ses joueurs du jour, inscrits ou non (Samir parti, Nassim pas encore là).
  const c = carriereDe(faitsDeLaLigue(lignesDeLucien(), MAINTENANT), lignesDeLucien().entraineurs[0], cartesFixture());
  assert.deepEqual([...c.rencontres[0].effectif!].sort(), [72, 73, 74, 75, 76, 77, 79], "le 7 novembre : Samir encore là");
  assert.deepEqual([...c.rencontres.find((r) => r.le === "2029-01-16")!.effectif!].sort(), [73, 74, 75, 76, 76, 77, 79], "le 16 janvier : Nassim, plus Samir");
  // Les matchs arrangés se répètent : deux victoires « contre bien plus fort » contre la même équipe, ou contre trois
  // mêmes joueurs sous un autre nom, sont signalées à l'admin (aRevoirDe) ; rien ne change sur la carte.
  const f = faitsDeLaLigue(lignesDeLucien(), MAINTENANT);
  const lambersart = f.rencontres.get(MA)!.filter((r) => r.adversaire === 11).map((r) => String(r.defi));
  assert.deepEqual(aRevoirDe(f, "lucien", [MA], lambersart.slice(0, 1)), []);
  assert.deepEqual(aRevoirDe(f, "lucien", [MA], lambersart.slice(0, 2)).map((x) => x.motif), ["equipe"]);
  const autre = f.rencontres.get(MA)!.find((r) => r.adversaire === 19)!;
  for (const x of f.feuilles.get(`${autre.defi}:19`)!.keys()) void x;
  f.feuilles.set(`${autre.defi}:19`, [...f.feuilles.get(`${lambersart[0]}:11`)!.slice(0, 3), "x1", "x2"]);
  assert.deepEqual(aRevoirDe(f, "lucien", [MA], [lambersart[0], String(autre.defi)]).map((x) => x.motif), ["joueurs"], "trois mêmes joueurs sous un autre nom");
}

const typesUtilises: CarriereEntraineur | null = null;
void typesUtilises;
console.log("entraineur-faits-check : ok");
