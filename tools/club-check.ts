// Bola Club (bola-app#14, lib/sfl/club/) : le club de démonstration, les
// règles du produit, l'évolution des cartes par le vrai moteur, les
// classements et les changements. Aucune donnée tirée de la base.
//
// Ce que le banc garde :
//   1 · le FC Démo : 4 catégories, 60 joueurs (15 / 15 / 18 / 12), 3
//       entraîneurs, 1 admin ; deux tirages donnent le même club ; aucun nom
//       de la démo n'est un nom de tools/saison-reference.json (pas de vrai
//       joueur), aucun adversaire ne l'est ; pas de photo dans les données ;
//   2 · les licences : 62 + 5 + 2 + 131 = 200 ; libérer rend une licence et
//       garde le joueur ; un moins de 15 ans ne s'active pas sans accord ;
//       pas de message privé adulte ↔ mineur ;
//   3 · les droits : un joueur ne lit ni les notes privées ni une autre
//       catégorie ; un entraîneur n'écrit que dans ses catégories ; seul
//       l'admin crée, renomme, range le staff, importe, libère ;
//   4 · l'évolution : les cartes sortent d'evoluer (égalité avec un appel
//       direct sur la même saison) ; un but verse un cran de TIR ; une note
//       ne descend jamais ; la mise à jour tombe au 4e match ; le MVP ne
//       dépend pas du résultat (un 0-0 n'élit personne) ;
//   5 · les classements : progression (la saison = la carte en direct moins
//       le départ), assiduité, buteurs, mois ⊂ saison, ex æquo ; le tri ;
//   6 · les changements : déplacer, surclasser (jamais vers plus jeune),
//       appel, stats (bornes), annonce, import, écusson ; le fil par rôle ;
//   7 · le contrôle adverse du 13/11 : sans licence active on sort du club ;
//       qui paraît devant qui (un compte en attente d'accord, une autre
//       catégorie) ; une séance n'est passée que par sa date ; un seul
//       gardien prend le match sans but ; convoquer, créer une séance ; l'âge
//       d'une catégorie renommée, d'un joueur déplacé ; l'état gardé d'une
//       autre forme ; le départage des ex æquo ; le drapeau en aperçu (en
//       production : tools/club-drapeau-check.ts).
//   npx tsx tools/club-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAT_KEYS, ovr } from "../src/lib/sfl/engine";
import { estGardien } from "../src/lib/sfl/gardien";
import { evoluer, JOURNEES_PAR_MAJ } from "../src/lib/sfl/saisie/evolution";
import { cartesQuiMontent, filDuClub } from "../src/lib/sfl/club/actus";
import { aUnPodium, assiduite, buts, classementClub, passes, pointsParMatch, progression, ranger, seancesDe, trierEffectif } from "../src/lib/sfl/club/classements";
import { BOLA_CLUB } from "../src/lib/sfl/club/drapeau";
import { clubOuvert } from "../src/lib/sfl/club/marqueur";
import { formeDuClub } from "../src/lib/sfl/club/store";
import { ADVERSAIRES, clubDemo } from "../src/lib/sfl/club/demo";
import {
  ajouterNote,
  changerBlason,
  changerPoste,
  convocationsTenues,
  convoquer,
  creerCategorie,
  creerSeance,
  dateVraie,
  deplacerJoueur,
  faireAppel,
  importerListe,
  libererLicence,
  lireListe,
  publierAnnonce,
  rangerEntraineur,
  renommerCategorie,
  repondreConvocation,
  saisirStats,
  surclasser,
  type Resultat,
} from "../src/lib/sfl/club/mutations";
import {
  aLAgeDe,
  accordParentalRequis,
  ageLe,
  compteLicences,
  droits,
  licenceActive,
  licenceDe,
  membreDe,
  peutActiver,
  peutEcrireEnPrive,
  seanceAVenir,
  seanceOuverte,
  seancePassee,
  surclassementsPossibles,
} from "../src/lib/sfl/club/regles";
import { RAISON_SERIE_CLUB, carteDuMembre, cartesDuClub, lignesDuMatch, mvpsDe, saisonDuMembre } from "../src/lib/sfl/club/saison";
import type { Club, Moi, Seance } from "../src/lib/sfl/club/types";

let n = 0;
const ok = (cond: unknown, quoi: string) => {
  assert.ok(cond, quoi);
  n++;
};
const egal = <T,>(a: T, b: T, quoi: string) => {
  assert.deepStrictEqual(a, b, quoi);
  n++;
};
const passe = (r: Resultat, quoi: string): Club => {
  assert.ok(r.ok, `${quoi} : ${r.ok ? "" : r.refus}`);
  n++;
  return (r as { club: Club }).club;
};
const refuse = (r: Resultat, quoi: string) => {
  assert.ok(!r.ok, `${quoi} aurait dû être refusé`);
  n++;
};

const club = clubDemo();
const admin: Moi = { role: "admin", id: club.demo.admin };
const coach: Moi = { role: "entraineur", id: club.demo.entraineur };
const joueur: Moi = { role: "joueur", id: club.demo.joueur };
const parent: Moi = { role: "parent", id: club.demo.parent };
// Le samedi du match des U13 et des U17 : l'appel et les stats de u13-m9 s'ouvrent ce jour-là, pas avant.
const jourJ: Club = { ...club, jour: "2026-11-14" };

// 1 · le FC Démo
egal(club.nom, "FC Démo", "le nom du club");
egal(club.categories.map((c) => c.nom), ["U13", "U17", "Seniors", "Féminines"], "les 4 catégories");
egal(club.categories.map((c) => club.membres.filter((m) => m.categorie === c.id).length), [15, 15, 18, 12], "15 / 15 / 18 / 12");
egal(club.membres.length, 60, "60 joueurs");
egal(club.staff.filter((s) => s.role === "entraineur").length, 3, "3 entraîneurs");
egal(club.staff.filter((s) => s.role === "admin").length, 1, "1 admin");
egal(JSON.stringify(clubDemo()), JSON.stringify(club), "deux tirages, le même club");
ok(new Set(club.membres.map((m) => `${m.prenom} ${m.nom}`)).size === 60, "pas deux joueurs du même nom");
ok(!/"\w*(photo|avatar|image)\w*":|\.(png|jpe?g|webp)|https?:/i.test(JSON.stringify(club)), "aucune photo dans les données");
{
  const ref = JSON.parse(readFileSync(new URL("./saison-reference.json", import.meta.url), "utf8")) as { joueurs: { nom: string }[] };
  const vrais = new Set(ref.joueurs.flatMap((j) => [j.nom.toLowerCase(), ...j.nom.toLowerCase().split(/[\s.-]+/)]));
  ok(vrais.size > 30, "la saison de référence a ses joueurs");
  const fictifs = [...club.membres, ...club.staff, ...club.parents];
  for (const p of fictifs) {
    ok(!vrais.has(p.prenom.toLowerCase()) && !vrais.has(p.nom.toLowerCase()) && !vrais.has(`${p.prenom} ${p.nom}`.toLowerCase()), `${p.prenom} ${p.nom} n'est pas un joueur de la saison`);
  }
  for (const l of club.licences) if (l.invite) ok(l.invite.nom.toLowerCase().split(" ").every((x) => !vrais.has(x)), `l'invité ${l.invite.nom} est fictif`);
  for (const a of ADVERSAIRES) ok(/Exemple|Modèle|Témoin|Factice|Essai|Fictif|Gabarit|Maquette/.test(a), `${a} : un adversaire visiblement fictif`);
}
for (const cat of club.categories) {
  const s = club.seances.filter((x) => x.categorie === cat.id);
  egal(s.filter((x) => x.genre === "match" && x.score).length, 8, `${cat.nom} : 8 matchs joués`);
  egal(s.filter((x) => x.genre === "entrainement" && x.jour < club.jour).length, 10, `${cat.nom} : 10 entraînements`);
  egal(s.filter((x) => x.genre === "match" && !x.score).map((x) => x.jour >= "2026-11-14" && x.jour <= "2026-11-15"), [true], `${cat.nom} : un match convoqué le week-end des 14-15/11`);
  egal(s.filter((x) => x.genre === "entrainement" && x.jour > club.jour).map((x) => x.jour), ["2026-11-18"], `${cat.nom} : un entraînement le 18/11`);
}
egal(club.membres.filter((m) => m.surclasseEn).map((m) => [m.categorie, m.surclasseEn]), [["u13", "u17"]], "un U13 surclassé en U17");

// 2 · les licences
egal(compteLicences(club), { total: 200, actives: 62, invitations: 5, accords: 2, libres: 131 }, "62 + 5 + 2 + 131 = 200");
{
  const attente = club.licences.filter((l) => l.statut === "attente_accord").map((l) => membreDe(club, l.compte!)!);
  ok(attente.every((m) => m.categorie === "u13" && accordParentalRequis(m.naissance, club.jour) && !peutActiver(m, club.jour)), "les deux accords en attente : des U13 de moins de 15 ans, non activables");
  ok(attente.every((m) => club.seances.every((s) => !s.convoques.includes(m.id))), "sans accord : jamais convoqué, aucune stat");
  ok(club.membres.filter((m) => licenceDe(club, m.id)?.statut === "active").every((m) => peutActiver(m, club.jour)), "aucune licence active sans l'accord requis");
  egal(ageLe("2011-11-13", "2026-11-12"), 14, "14 ans la veille de l'anniversaire");
  egal(ageLe("2011-11-12", "2026-11-12"), 15, "15 ans le jour de l'anniversaire");
  ok(!peutActiver({ naissance: "2012-01-01", accordParentalLe: null }, club.jour) && peutActiver({ naissance: "2012-01-01", accordParentalLe: "2026-09-01" }, club.jour), "l'accord parental ouvre l'activation");
  ok(peutActiver({ naissance: "2000-01-01", accordParentalLe: null }, club.jour), "un adulte s'active sans accord");
  ok(!peutEcrireEnPrive({ naissance: null }, { naissance: "2014-01-01" }, club.jour), "pas de message privé adulte → mineur");
  ok(!peutEcrireEnPrive({ naissance: "2014-01-01" }, { naissance: "1990-01-01" }, club.jour), "pas de message privé mineur → adulte");
  ok(peutEcrireEnPrive({ naissance: null }, { naissance: "1990-01-01" }, club.jour) && peutEcrireEnPrive({ naissance: "2014-01-01" }, { naissance: "2013-01-01" }, club.jour), "entre adultes, entre mineurs : oui");
  const libere = passe(libererLicence(club, admin, "u17-14"), "l'admin libère une licence");
  egal(compteLicences(libere), { total: 200, actives: 61, invitations: 5, accords: 2, libres: 132 }, "la licence redevient libre");
  ok(membreDe(libere, "u17-14") && carteDuMembre(libere, membreDe(libere, "u17-14")!).note === cartesDuClub(club).get("u17-14")!.note, "le joueur garde son compte, sa carte et son historique");
  refuse(libererLicence(libere, admin, "u17-14"), "libérer deux fois");
  refuse(libererLicence(club, coach, "u17-14"), "un entraîneur libère une licence");
  refuse(libererLicence(club, admin, admin.id), "l'admin libère la sienne");
}

// 3 · les droits
{
  const dj = droits(club, joueur);
  const dc = droits(club, coach);
  const da = droits(club, admin);
  const dp = droits(club, parent);
  const moi = membreDe(club, joueur.id)!;
  const u13 = membreDe(club, "u13-14")!;
  const senior = membreDe(club, "seniors-16")!;
  ok(dj.lit(moi.categorie) && !dj.lit("u13") && !dj.lit("seniors"), "un joueur ne lit que sa catégorie");
  ok(!dj.litNotes(moi) && !dj.litNotes(u13) && !dj.gereJoueur(moi) && !dj.administre, "un joueur ne lit aucune note privée, pas même les siennes");
  ok(dj.voitFiche(moi) && !dj.voitFiche(u13), "un joueur voit sa fiche, pas celle d'un autre");
  ok(dc.gere("u13") && dc.gere("u17") && !dc.gere("seniors") && !dc.gere("feminines") && dc.lit("seniors"), "l'entraîneur lit tout, n'écrit que dans U13 et U17");
  ok(dc.litNotes(u13) && !dc.litNotes(senior) && !dc.administre, "il lit les notes de ses joueurs seulement");
  ok(da.administre && da.gere("feminines") && da.litNotes(senior), "l'admin gère tout");
  const enfant = dp.joueur!;
  ok(enfant.categorie === "u13" && dp.repond(enfant) && dp.voitFiche(enfant) && !dp.litNotes(enfant) && !dp.voitFiche(u13), "le parent : son enfant, sans les notes privées");
  ok(dp.lit("u13") && dp.lit("u17") && !dp.lit("seniors"), "le parent lit les catégories de son enfant (surclassé en U17)");
  ok(!droits(club, { role: "admin", id: coach.id }).administre && !droits(club, { role: "entraineur", id: joueur.id }).gere("u17"), "un rôle ne vaut que pour sa ligne dans le club");
  refuse(ajouterNote(club, joueur, moi.id, "x"), "un joueur écrit une note");
  refuse(ajouterNote(club, coach, senior.id, "x"), "un entraîneur note un joueur d'une autre catégorie");
  refuse(creerCategorie(club, coach, "U15"), "un entraîneur crée une catégorie");
  refuse(renommerCategorie(club, coach, "u13", "U12"), "un entraîneur renomme");
  refuse(rangerEntraineur(club, coach, "s-e1", "seniors", true), "un entraîneur range le staff");
  refuse(importerListe(club, coach, "Nom"), "un entraîneur importe");
  refuse(changerBlason(club, coach, club.blason), "un entraîneur change l'écusson");
  refuse(publierAnnonce(club, coach, "seniors", "x"), "une annonce hors de ses catégories");
  refuse(publierAnnonce(club, coach, null, "x"), "une annonce à tout le club par un entraîneur");
  refuse(publierAnnonce(club, joueur, "u17", "x"), "une annonce d'un joueur");
  refuse(faireAppel(club, coach, "seniors-m8", club.seances.find((s) => s.id === "seniors-m8")!.convoques[0], "present"), "l'appel d'une autre catégorie");
  refuse(saisirStats(club, joueur, "u17-m8", { nous: 1, eux: 0 }, {}), "des stats saisies par un joueur");
  refuse(changerPoste(club, coach, senior.id, "AT"), "le poste d'un joueur d'une autre catégorie");
  refuse(deplacerJoueur(club, coach, u13.id, "seniors"), "déplacer vers une catégorie qu'il ne tient pas");
  refuse(deplacerJoueur(club, coach, senior.id, "u17"), "déplacer un joueur qu'il ne tient pas");
}

// 4 · l'évolution
const cartes = cartesDuClub(club);
for (const m of club.membres) {
  const c = cartes.get(m.id)!;
  const { saison } = saisonDuMembre(club, m.id);
  const direct = evoluer(saison, () => m.base, new Set(), { raisonSerie: RAISON_SERIE_CLUB, gardien: () => estGardien(m.poste) }).joueurs.get(m.id) ?? null;
  egal(c.ev, direct, `${m.id} : la carte sort d'evoluer`);
  egal(c.stats, direct ? direct.officielles : m.base, `${m.id} : la carte officielle`);
  ok(STAT_KEYS.every((k) => c.stats[k] >= m.base[k] && c.enDirect[k] >= c.stats[k]), `${m.id} : une note ne descend jamais`);
  egal(c.note, ovr(c.stats), `${m.id} : la note`);
  egal((c.ev?.majs ?? []).map((x) => x.apresJ).every((j) => j % JOURNEES_PAR_MAJ === 0), true, `${m.id} : les mises à jour tombent tous les 4 matchs`);
}
ok([...cartes.values()].some((c) => c.ev && Object.keys(c.ev.enAttente).length > 0), "des points en attente dans la démo");
ok([...cartes.values()].some((c) => (c.ev?.majs.length ?? 0) > 0), "des mises à jour officielles dans la démo");
{
  // Un but de plus : un cran de TIR de plus (ou un point, jauge pleine).
  const cible = club.membres.find((m) => m.id === "u13-14")!;
  const match = club.seances.find((s) => s.id === "u13-m9")!;
  const avant = carteDuMembre(club, cible);
  refuse(saisirStats(club, coach, match.id, { nous: 1, eux: 1 }, { [cible.id]: { buts: 1, passes: 0 } }), "saisir les stats d'un match à venir");
  const joue = passe(saisirStats(jourJ, coach, match.id, { nous: 1, eux: 1 }, { [cible.id]: { buts: 1, passes: 0 } }), "saisir un but");
  const apres = carteDuMembre(joue, joue.membres.find((m) => m.id === cible.id)!);
  const dernier = apres.ev!.journal[0];
  ok(dernier.faits.some((f) => f.stat === "TIR" && f.crans === 1 && f.raison === "1 but"), "saisir un but verse un cran de TIR");
  ok(dernier.faits.some((f) => f.raison === "MVP"), "le seul buteur est MVP");
  egal(mvpsDe(joue, joue.seances.find((s) => s.id === match.id)!), [cible.id], "le MVP du match");
  ok(STAT_KEYS.every((k) => apres.enDirect[k] >= avant.enDirect[k]) && ovr(apres.enDirect) >= ovr(avant.enDirect), "la carte en direct ne descend pas");
  egal(apres.matchs.length, avant.matchs.length + 1, "un match de plus dans son journal");
  ok(filDuClub(joue, coach, "u13").some((p) => p.genre === "resultat" && p.seance.id === match.id), "le résultat arrive dans les actus");
  // Un 0-0 : personne n'est MVP, sauf le gardien qui n'a rien encaissé.
  const nul = passe(saisirStats(jourJ, coach, match.id, { nous: 0, eux: 0 }, {}), "saisir un 0-0");
  const m00 = nul.seances.find((s) => s.id === match.id)!;
  egal(mvpsDe(nul, m00), ["u13-01"], "un 0-0 n'élit que le gardien dans la cage (clean sheet), pas le second gardien");
  const sansButeur = passe(saisirStats(jourJ, coach, match.id, { nous: 1, eux: 1 }, {}), "saisir un 1-1 sans buteur");
  egal(mvpsDe(sansButeur, sansButeur.seances.find((s) => s.id === match.id)!), [], "un nul sans stat n'élit personne : le résultat n'entre pas dans le MVP");
  const perdu = passe(saisirStats(jourJ, coach, match.id, { nous: 0, eux: 2 }, {}), "saisir un 0-2");
  egal(mvpsDe(perdu, perdu.seances.find((s) => s.id === match.id)!), [], "une défaite sans but : pas de MVP");
  ok(lignesDuMatch(perdu, perdu.seances.find((s) => s.id === match.id)!).every((l) => l.result === "Défaite"), "le résultat est sur chaque ligne");
}
{
  // La mise à jour tombe au 4e match, pas avant.
  const m = club.membres.find((x) => x.id === "u17-15")!;
  const c = cartes.get(m.id)!;
  ok(c.matchs.length >= 4 && c.ev!.majs.some((x) => x.apresJ === 4), "une mise à jour après son 4e match");
  const trois: Club = { ...club, seances: club.seances.filter((s) => !(s.genre === "match" && s.convoques.includes(m.id)) || c.matchs.slice(0, 3).some((x) => x.id === s.id)) };
  const c3 = carteDuMembre(trois, m);
  egal(c3.stats, m.base, "à 3 matchs, la carte officielle est encore celle de départ");
  egal(c3.calendrier?.avantProchaine, 1, "à 3 matchs : mise à jour dans 1 match");
}

// 5 · les classements
for (const m of club.membres) {
  const c = cartes.get(m.id)!;
  const total = STAT_KEYS.reduce((s, k) => s + c.enDirect[k] - m.base[k], 0);
  egal(progression(club, m.id, "saison"), total, `${m.id} : la progression de la saison = la carte en direct moins le départ`);
  ok(pointsParMatch(c).every((p) => p.points >= 0), `${m.id} : pas de points négatifs`);
  ok(progression(club, m.id, "mois") <= total && progression(club, m.id, "mois") >= 0, `${m.id} : le mois est dans la saison`);
  ok(buts(club, m.id, "mois") <= buts(club, m.id, "saison"), `${m.id} : les buts du mois sont dans la saison`);
  const a = assiduite(club, m.id, "saison");
  ok(a.presents <= a.total && (a.pct === null) === (a.total === 0), `${m.id} : l'assiduité`);
}
egal(
  club.seances.filter((s) => s.genre === "match" && s.score).reduce((t, s) => t + Object.values(s.stats).reduce((x, l) => x + l.buts, 0), 0),
  club.seances.reduce((t, s) => t + (s.score?.nous ?? 0), 0),
  "les buts des joueurs font le score du club",
);
egal(classementClub(club, club.membres, "buteurs", "saison").reduce((t, l) => t + l.valeur, 0), club.seances.reduce((t, s) => t + (s.score?.nous ?? 0), 0), "le classement des buteurs compte tous les buts");
{
  const m = (id: string, nom: string) => ({ ...club.membres[0], id, nom });
  const r = ranger([
    { membre: m("a", "Zed"), valeur: 3, libelle: "3" },
    { membre: m("b", "Abc"), valeur: 5, libelle: "5" },
    { membre: m("c", "Mno"), valeur: 3, libelle: "3" },
    { membre: m("d", "Def"), valeur: 1, libelle: "1" },
  ]);
  egal(r.map((l) => [l.membre.id, l.rang]), [["b", 1], ["c", 2], ["a", 2], ["d", 4]], "les ex æquo partagent leur rang, le suivant saute");
}
for (const tri of ["note", "progression", "presences", "buts"] as const) {
  const t = trierEffectif(club, club.membres, tri);
  egal(t.length, 60, `tri ${tri} : tout l'effectif`);
  ok(t.every((l, i) => i === 0 || t[i - 1].valeur >= l.valeur), `tri ${tri} : décroissant`);
}
egal(trierEffectif(club, club.membres, "note")[0].valeur, Math.max(...[...cartes.values()].map((c) => c.note)), "le premier du tri par note a la meilleure note");
ok(classementClub(club, club.membres.filter((m) => m.categorie === "u13"), "assiduite", "saison").every((l) => l.valeur <= 100 && /^\d+ \/ \d+$/.test(l.libelle)), "l'assiduité : « 16 / 17 », rangée au pourcentage");
egal(classementClub(club, club.membres, "assiduite", "saison").length, 58, "sans séance, pas d'assiduité (les deux accords en attente)");

// 6 · les changements
{
  let c = passe(deplacerJoueur(club, coach, "u13-14", "u17"), "l'entraîneur déplace un U13 en U17");
  egal(membreDe(c, "u13-14")!.categorie, "u17", "le joueur a changé de catégorie");
  egal(carteDuMembre(c, membreDe(c, "u13-14")!).note, cartes.get("u13-14")!.note, "déplacé, sa carte ne bouge pas");
  c = passe(deplacerJoueur(club, coach, "u13-13", "u17"), "déplacer le surclassé dans sa catégorie de surclassement");
  egal(membreDe(c, "u13-13")!.surclasseEn, null, "son surclassement en U17 tombe : il y est");
  egal(surclassementsPossibles(membreDe(club, "u13-01")!, club.categories).map((x) => x.id), ["u17"], "un U13 : U17, la catégorie juste au-dessus, pas Seniors");
  egal(surclassementsPossibles(membreDe(club, "u17-01")!, club.categories).map((x) => x.id), ["seniors"], "un U17 : Seniors");
  egal(surclassementsPossibles(membreDe(club, "seniors-01")!, club.categories), [], "un Senior : aucun");
  egal(surclassementsPossibles(membreDe(club, "feminines-01")!, club.categories), [], "une Féminine : aucun");
  refuse(surclasser(club, coach, "u17-01", "u13"), "surclasser vers plus jeune");
  refuse(surclasser(club, coach, "u13-01", "feminines"), "surclasser un U13 chez les Féminines");
  refuse(surclasser(club, coach, "u13-01", "seniors"), "surclasser un U13 de 12 ans en Seniors");
  c = passe(surclasser(club, coach, "u13-01", "u17"), "surclasser un U13 en U17");
  egal(membreDe(c, "u13-01")!.surclasseEn, "u17", "surclassé");
  c = passe(surclasser(c, coach, "u13-01", null), "retirer le surclassement");
  egal(membreDe(c, "u13-01")!.surclasseEn, null, "plus surclassé");
  c = passe(changerPoste(club, coach, "u13-14", "MC"), "changer de poste");
  egal(membreDe(c, "u13-14")!.poste, "MC", "le poste");
  c = passe(ajouterNote(club, coach, "u13-14", "  Bon match.  "), "ajouter une note");
  egal(c.notes.at(-1), { id: c.notes.at(-1)!.id, membre: "u13-14", auteur: coach.id, jour: club.jour, texte: "Bon match." }, "la note, datée et signée");
  refuse(ajouterNote(club, coach, "u13-14", "   "), "une note vide");
  refuse(faireAppel(club, coach, "u13-m9", "u13-14", "retard"), "l'appel d'un match à venir");
  c = passe(faireAppel(jourJ, coach, "u13-m9", "u13-14", "retard"), "faire l'appel");
  egal(c.seances.find((s) => s.id === "u13-m9")!.appel["u13-14"], "retard", "l'appel est noté");
  refuse(faireAppel(jourJ, coach, "u13-m9", "u13-06", "present"), "l'appel d'un non-convoqué");
  refuse(saisirStats(jourJ, coach, "u13-m9", { nous: 1, eux: 0 }, { "u13-14": { buts: 2, passes: 0 } }), "plus de buts que le score");
  refuse(saisirStats(jourJ, coach, "u13-m9", { nous: 1, eux: 0 }, { "u13-14": { buts: 1, passes: 0 }, "u13-15": { buts: 0, passes: 2 } }), "plus de passes que de buts");
  refuse(saisirStats(club, coach, "u13-e10", { nous: 1, eux: 0 }, {}), "des stats sur un entraînement");
  c = passe(faireAppel(jourJ, coach, "u13-m9", "u13-14", "absent"), "noter un absent");
  c = passe(saisirStats(c, coach, "u13-m9", { nous: 2, eux: 1 }, { "u13-14": { buts: 1, passes: 0 }, "u13-15": { buts: 1, passes: 1 } }), "saisir avec un absent");
  egal(c.seances.find((s) => s.id === "u13-m9")!.stats, { "u13-15": { buts: 1, passes: 1 } }, "un absent n'a ni but ni passe");
  c = passe(repondreConvocation(club, joueur, "u17-m9", "absent"), "le joueur répond à sa convocation");
  egal(c.seances.find((s) => s.id === "u17-m9")!.reponses[joueur.id], "absent", "sa réponse");
  c = passe(repondreConvocation(club, parent, "u13-m9", "present"), "le parent répond pour son enfant");
  egal(c.seances.find((s) => s.id === "u13-m9")!.reponses["u13-13"], "present", "la réponse du parent");
  refuse(repondreConvocation(club, coach, "u13-m9", "present"), "un entraîneur répond à une convocation");
  refuse(repondreConvocation(club, joueur, "u13-m9", "present"), "répondre à la convocation d'une autre catégorie");
  refuse(repondreConvocation(club, joueur, "u17-m8", "present"), "répondre à un match joué");
  c = passe(publierAnnonce(club, coach, "u13", "Rendez-vous 13h."), "publier une annonce");
  ok(filDuClub(c, parent, null).some((p) => p.genre === "annonce" && p.annonce.texte === "Rendez-vous 13h."), "le parent d'un U13 la lit");
  ok(!filDuClub(c, joueur, null).some((p) => p.genre === "annonce" && p.annonce.texte === "Rendez-vous 13h."), "un U17 ne la lit pas");
  c = passe(creerCategorie(club, admin, " U15 "), "l'admin crée une catégorie");
  egal(c.categories.at(-1), { id: c.categories.at(-1)!.id, nom: "U15", ordre: 5, entraineurs: [], ageMax: 15, feminine: undefined }, "la catégorie créée");
  refuse(creerCategorie(club, admin, "u13"), "une catégorie en double");
  refuse(creerCategorie(club, admin, ""), "une catégorie sans nom");
  c = passe(renommerCategorie(club, admin, "seniors", "Seniors A"), "renommer");
  egal(c.categories.find((x) => x.id === "seniors")!.nom, "Seniors A", "le nouveau nom");
  refuse(renommerCategorie(club, admin, "seniors", "U17"), "renommer comme une autre");
  c = passe(rangerEntraineur(club, admin, "s-e3", "u13", true), "ranger une entraîneuse en U13");
  ok(droits(c, { role: "entraineur", id: "s-e3" }).gere("u13"), "elle tient maintenant les U13");
  c = passe(rangerEntraineur(c, admin, "s-e3", "u13", false), "l'en sortir");
  ok(!droits(c, { role: "entraineur", id: "s-e3" }).gere("u13"), "elle ne les tient plus");
  refuse(rangerEntraineur(club, admin, "s-admin", "u13", true), "ranger l'admin comme entraîneur");
  egal(lireListe(club, "Jean Test, 12/03/2014, U13\n\n Paul Essai ;u17\nAnne Fictive"), [
    { nom: "Jean Test", naissance: "2014-03-12", categorie: "u13" },
    { nom: "Paul Essai", naissance: null, categorie: "u17" },
    { nom: "Anne Fictive", naissance: null, categorie: null },
  ], "lire une liste collée");
  c = passe(importerListe(club, admin, "Jean Test, 12/03/2014, U13\nPaul Essai"), "importer une liste");
  egal(compteLicences(c), { total: 200, actives: 62, invitations: 7, accords: 2, libres: 129 }, "deux invitations de plus");
  refuse(importerListe(club, admin, Array.from({ length: 132 }, (_, i) => `Nom ${i}`).join("\n")), "plus de noms que de licences libres");
  refuse(importerListe(club, admin, "  \n"), "une liste vide");
  c = passe(changerBlason(club, admin, { ...club.blason, forme: "rond" }), "changer l'écusson");
  egal(c.blason.forme, "rond", "l'écusson");
  refuse(changerBlason(club, admin, { ...club.blason, couleurs: ["rouge", "#fff", "#000"] } as never), "un écusson illisible");
}
{
  // Le fil par rôle.
  const fa = filDuClub(club, admin, null);
  egal(fa.filter((p) => p.genre === "resultat").map((p) => p.categorie).sort(), ["feminines", "seniors", "u13", "u17"], "un dernier résultat par catégorie");
  // Sous « Tout », le staff ne garde en tête que la prochaine séance de chaque catégorie qu'il entraîne.
  egal(fa.filter((p) => p.genre === "convocation").length, 0, "l'admin n'entraîne personne : sous « Tout », les résultats d'abord");
  const fc = filDuClub(club, coach, null);
  egal(fc.slice(0, 3).map((p) => p.id), ["c-u13-m9", "c-u17-m9", "a-1"], "l'entraîneur des U13 et des U17 : leurs deux prochains matchs, puis le fil");
  egal(filDuClub(club, admin, "u13").filter((p) => p.genre === "convocation").map((p) => p.id), ["c-u13-m9", "c-u13-e11"], "sous sa puce, toutes les convocations de la catégorie, la plus proche en tête");
  egal(filDuClub(club, coach, "seniors").filter((p) => p.genre === "convocation").length, 2, "l'entraîneur lit celles des autres catégories sous leur puce");
  egal(filDuClub(club, joueur, null).filter((p) => p.genre === "convocation").map((p) => p.id), ["c-u17-m9", "c-u17-e11"], "un joueur garde toutes les siennes sous « Tout »");
  ok(fa.some((p) => p.genre === "cartes" && p.cartes.length > 0), "des cartes qui montent");
  ok(filDuClub(club, admin, "u13").every((p) => p.categorie === "u13" || p.categorie === null), "le rail filtre sur la catégorie");
  ok(filDuClub(club, joueur, null).every((p) => p.categorie === "u17" || p.categorie === null), "un joueur : le club et sa catégorie");
  ok(filDuClub(club, joueur, "seniors").every((p) => p.categorie === null), "un joueur ne lit pas une autre catégorie, même demandée");
  egal(fc.length, fa.length + 2, "l'entraîneur lit tout le club, et ses deux convocations");
}

// 7 · le contrôle adverse du 13/11
const seance = (c: Club, id: string): Seance => c.seances.find((s) => s.id === id)!;
{
  // Sans licence active, on sort du club (D6).
  const libre = passe(libererLicence(club, admin, joueur.id), "libérer la licence du joueur");
  const d = droits(libre, joueur);
  ok(!d.actif && !d.lit("u17") && !d.repond(d.joueur!) && d.voitFiche(d.joueur!), "sans licence : il ne lit plus sa catégorie, ne répond plus, garde sa fiche");
  refuse(repondreConvocation(libre, joueur, "u17-m9", "present"), "sans licence, répondre à une convocation");
  egal(filDuClub(libre, joueur, null), [], "sans licence, le fil du club est vide, annonces du club comprises");
  ok(!seance(libre, "u17-m9").convoques.includes(joueur.id) && !(joueur.id in seance(libre, "u17-m9").reponses), "libéré, il sort des convocations à venir, sa réponse avec");
  ok(seance(libre, "u17-m8").convoques.includes(joueur.id), "ses matchs joués restent : l'histoire ne bouge pas");
  ok(!droits(libre, coach).voitJoueur(membreDe(libre, joueur.id)!) && !droits(libre, admin).voitJoueur(membreDe(libre, joueur.id)!) && d.voitJoueur(d.joueur!), "il n'est plus dans l'effectif de personne ; il se voit encore");
  const sansCoach = passe(libererLicence(club, admin, coach.id), "libérer la licence d'un entraîneur");
  const dc = droits(sansCoach, coach);
  ok(!dc.actif && !dc.gere("u13") && !dc.lit("u13") && !dc.litNotes(membreDe(club, "u13-14")!) && !dc.voitJoueur(membreDe(club, "u13-14")!), "un entraîneur sans licence ne gère ni ne lit plus rien");
  refuse(faireAppel({ ...sansCoach, jour: "2026-11-14" }, coach, "u13-m9", "u13-14", "present"), "un entraîneur sans licence fait l'appel");
  refuse(publierAnnonce(sansCoach, coach, "u13", "x"), "un entraîneur sans licence publie");
  ok(!droits({ ...club, licences: club.licences.filter((l) => l.compte !== admin.id) }, admin).administre, "un admin sans licence n'administre plus");
  ok(licenceActive(club, joueur.id) && !licenceActive(club, "u13-06") && !licenceActive(libre, joueur.id), "licence active : ni en attente d'accord, ni rendue");
}
{
  // Qui paraît devant qui (D4, D5).
  const dj = droits(club, joueur);
  const dp = droits(club, parent);
  const dc = droits(club, coach);
  const attente = membreDe(club, "u13-06")!;
  ok(!dj.voitJoueur(attente) && !dj.voitJoueur(membreDe(club, "seniors-16")!) && !dj.voitJoueur(membreDe(club, "u13-14")!), "un U17 ne voit ni un U13, ni un Senior, ni un compte en attente d'accord");
  ok(dj.voitJoueur(membreDe(club, "u17-03")!) && dj.voitJoueur(membreDe(club, "u13-13")!), "il voit ses coéquipiers, le surclassé compris");
  ok(dp.voitJoueur(membreDe(club, "u13-14")!) && !dp.voitJoueur(attente) && !dp.voitJoueur(membreDe(club, "u13-11")!), "le parent d'un U13 voit les licenciés actifs de la catégorie, pas les deux comptes en attente");
  egal(club.membres.filter((m) => dp.voitJoueur(m) && m.categorie === "u13").length, 13, "13 U13 devant un parent, pas 15");
  ok(dc.voitJoueur(attente) && droits(club, admin).voitJoueur(attente), "le staff les voit");
  const pAttente: Moi = { role: "parent", id: "p-u13-06" };
  const da = droits(club, pAttente);
  ok(!da.actif && !da.lit("u13") && da.voitFiche(attente) && da.voitJoueur(attente) && !da.voitJoueur(membreDe(club, "u13-14")!), "le parent d'un compte en attente ne voit que son enfant");
  const surParole = droits(club, { role: "entraineur", id: joueur.id });
  ok(!surParole.lit("seniors") && !surParole.voitJoueur(membreDe(club, "seniors-16")!) && !surParole.gere("u17"), "un rôle d'entraîneur sans ligne au staff ne lit pas le club");
  refuse(surclasser(club, joueur, "u13-01", "u17"), "un joueur surclasse");
  refuse(surclasser(club, { role: "entraineur", id: "s-e2" }, "u13-01", "u17"), "un entraîneur surclasse un joueur d'une autre catégorie");
  // L'entraîneur de la catégorie de surclassement suit le joueur (notes, poste) : voulu, à confirmer par Sabri.
  const sansU13 = passe(rangerEntraineur(club, admin, "s-e1", "u13", false), "sortir l'entraîneur des U13");
  const ds = droits(sansU13, coach);
  const surclasse = membreDe(sansU13, "u13-13")!;
  ok(!ds.gere("u13") && ds.gereJoueur(surclasse) && ds.litNotes(surclasse) && !ds.gereJoueur(membreDe(sansU13, "u13-14")!), "l'entraîneur des U17 suit le U13 surclassé chez lui, pas les autres U13");
  refuse(surclasser(sansU13, coach, "u13-13", null), "mais seul l'entraîneur de sa catégorie le surclasse");
  egal(filDuClub(club, parent, null).filter((p) => p.genre === "convocation").map((p) => p.id), ["c-u13-m9", "c-u17-m9", "c-u13-e11"], "le parent du surclassé : ses convocations, pas l'entraînement des U17 où il n'est pas convoqué");
}
{
  // Une séance n'est passée que par sa date, un match par son score (D7, D19).
  const e11 = seance(club, "u13-e11");
  ok(!seancePassee(e11, club.jour) && seanceAVenir(e11, club.jour) && !seanceOuverte(e11, club.jour), "l'entraînement du 18/11 est à venir le 12");
  refuse(faireAppel(club, coach, "u13-e11", "u13-01", "present"), "l'appel d'un entraînement à venir");
  const jour18: Club = { ...club, jour: "2026-11-18" };
  const avant = assiduite(jour18, "u13-02", "saison");
  const touche = passe(faireAppel(jour18, coach, "u13-e11", "u13-01", "present"), "un toucher dans l'appel, le jour de la séance");
  ok(!seancePassee(seance(touche, "u13-e11"), "2026-11-18"), "un appel commencé ne fait pas passer la séance");
  ok(filDuClub(touche, coach, "u13").some((p) => p.id === "c-u13-e11"), "la convocation reste dans le fil");
  egal(assiduite(touche, "u13-02", "saison"), avant, "les autres ne sont pas comptés absents");
  const lendemain: Club = { ...touche, jour: "2026-11-19" };
  ok(seancePassee(seance(lendemain, "u13-e11"), lendemain.jour), "le lendemain, elle est passée");
  egal(assiduite(lendemain, "u13-02", "saison"), avant, "sans ligne d'appel, la séance ne compte ni pour ni contre lui");
  egal(assiduite(lendemain, "u13-01", "saison").total, assiduite(club, "u13-01", "saison").total + 1, "elle compte pour celui dont l'appel est fait");
  ok(seancesDe(club, "u13-02").every((s) => s.appel["u13-02"] !== undefined && seancePassee(s, club.jour)), "ses séances : passées, et appelées");
  // Un match est passé quand son score est saisi ; l'appel seul ne le fait pas jouer.
  const appele = passe(faireAppel(jourJ, coach, "u13-m9", "u13-14", "present"), "l'appel du match, le jour du match");
  ok(!seancePassee(seance(appele, "u13-m9"), jourJ.jour) && assiduite(appele, "u13-14", "saison").total === assiduite(club, "u13-14", "saison").total, "l'appel d'un match sans score ne compte pas encore");
  refuse(repondreConvocation(club, joueur, "u17-e10", "absent"), "répondre à un entraînement passé");
  const joueLeJour = passe(saisirStats(jourJ, coach, "u17-m9", { nous: 1, eux: 0 }, {}), "le match des U17 joué, le jour même");
  refuse(repondreConvocation(joueLeJour, joueur, "u17-m9", "present"), "répondre à un match joué le jour même");
  passe(repondreConvocation(jourJ, joueur, "u17-m9", "present"), "répondre le matin du match");
  // Un convoqué sans ligne d'appel dans un match joué n'est pas compté présent ; un retard est un retard.
  const m8 = seance(club, "u13-m8");
  const [sansAppel, enRetard] = m8.convoques;
  const m8b: Seance = { ...m8, appel: { ...Object.fromEntries(Object.entries(m8.appel).filter(([id]) => id !== sansAppel)), [enRetard]: "retard" } };
  const lignes = lignesDuMatch(club, m8b);
  egal(lignes.find((l) => l.player === sansAppel)!.statut, "Absent justifié", "sans ligne d'appel, pas présent sur la feuille");
  ok(lignes.find((l) => l.player === enRetard)!.retard === true && lignes.find((l) => l.player === enRetard)!.statut === "Présent", "en retard : présent, et noté en retard");
  ok(lignes.filter((l) => l.player !== enRetard).every((l) => l.retard === (m8.appel[l.player] === "retard")), "les autres sont à l'heure, ou en retard comme à l'appel");
  // Un retard compte comme une présence dans l'assiduité.
  const retardataire = club.membres.find((m) => seancesDe(club, m.id).some((s) => s.appel[m.id] === "retard"))!;
  const a = assiduite(club, retardataire.id, "saison");
  const vues = seancesDe(club, retardataire.id);
  ok(a.retards > 0 && a.presents === vues.filter((s) => s.appel[retardataire.id] !== "absent").length && a.presents > vues.filter((s) => s.appel[retardataire.id] === "present").length, "un retard est une présence");
  // Un absent perd ses buts.
  const buteur = Object.keys(m8.stats)[0];
  const sorti = passe(faireAppel(club, coach, "u13-m8", buteur, "absent"), "noter absent un buteur");
  ok(!(buteur in seance(sorti, "u13-m8").stats), "un absent n'a plus ni but ni passe");
}
{
  // Un seul gardien prend le match sans but encaissé (D8).
  const m9 = seance(club, "u13-m9");
  const gardiens = m9.convoques.filter((id) => estGardien(membreDe(club, id)!.poste));
  egal(gardiens.length, 2, "les deux gardiens des U13 sont convoqués au match à venir");
  const at = club.membres.find((m) => m.categorie === "u13" && m.poste === "AT")!;
  const unZero = passe(saisirStats(jourJ, coach, "u13-m9", { nous: 1, eux: 0 }, { [at.id]: { buts: 1, passes: 0 } }), "saisir un 1-0");
  egal(lignesDuMatch(unZero, seance(unZero, "u13-m9")).filter((l) => l.cleanSheet).map((l) => l.player), [gardiens[0]], "un seul clean sheet : le premier gardien présent");
  ok(mvpsDe(unZero, seance(unZero, "u13-m9")).length === 1, "un 1-0 : un seul MVP, pas les deux gardiens");
  let c = passe(faireAppel(jourJ, coach, "u13-m9", gardiens[0], "absent"), "le premier gardien absent");
  c = passe(saisirStats(c, coach, "u13-m9", { nous: 1, eux: 0 }, { [at.id]: { buts: 1, passes: 0 } }), "saisir le 1-0 sans lui");
  egal(lignesDuMatch(c, seance(c, "u13-m9")).filter((l) => l.cleanSheet).map((l) => l.player), [gardiens[1]], "le second gardien, présent, prend le clean sheet");
  ok(lignesDuMatch(passe(saisirStats(jourJ, coach, "u13-m9", { nous: 1, eux: 1 }, {}), "un 1-1"), { ...m9, score: { nous: 1, eux: 1 }, appel: Object.fromEntries(m9.convoques.map((id) => [id, "present" as const])) }).every((l) => !l.cleanSheet), "un but encaissé : pas de clean sheet");
  for (const s of club.seances) if (s.score) ok(lignesDuMatch(club, s).filter((l) => l.cleanSheet).length <= 1, `${s.id} : au plus un clean sheet`);
}
{
  // Convoquer, créer une séance, et les convocations d'un joueur déplacé (D9).
  let c = passe(convoquer(club, coach, "u13-m9", "u13-02", false), "retirer un joueur de la convocation");
  ok(!seance(c, "u13-m9").convoques.includes("u13-02") && !("u13-02" in seance(c, "u13-m9").reponses), "retiré, sa réponse avec");
  c = passe(convoquer(c, coach, "u13-m9", "u13-02", true), "le convoquer de nouveau");
  ok(seance(c, "u13-m9").convoques.includes("u13-02"), "convoqué");
  egal(passe(convoquer(c, coach, "u13-m9", "u13-02", true), "convoquer deux fois"), c, "convoquer deux fois ne change rien");
  refuse(convoquer(club, coach, "u13-m9", "u13-06", true), "convoquer un compte en attente d'accord parental");
  refuse(convoquer(club, coach, "u13-m9", "u17-03", true), "convoquer un joueur d'une autre catégorie");
  refuse(convoquer(club, coach, "u13-m8", "u13-02", false), "toucher la convocation d'un match joué");
  refuse(convoquer(club, coach, "u13-e10", "u13-02", false), "toucher la convocation d'un entraînement passé");
  refuse(convoquer(club, coach, "seniors-m9", "seniors-01", false), "convoquer dans une catégorie qu'il ne tient pas");
  refuse(convoquer(club, joueur, "u17-m9", "u17-03", false), "un joueur retire un coéquipier");
  passe(convoquer(club, coach, "u17-e11", "u13-13", true), "convoquer le surclassé à l'entraînement des U17");
  const n = { genre: "match" as const, categorie: "u13", jour: "2026-11-21", heure: "14h00", lieu: " Stade  municipal ", adversaire: "US Modèle" };
  c = passe(creerSeance(club, coach, n), "créer un match");
  const cree = c.seances.at(-1)!;
  egal({ ...cree, convoques: cree.convoques.length }, { id: "u13-n1", genre: "match", categorie: "u13", jour: "2026-11-21", heure: "14h00", lieu: "Stade municipal", adversaire: "US Modèle", score: null, convoques: 13, reponses: {}, appel: {}, stats: {} }, "le match créé : les 13 licenciés actifs des U13 convoqués");
  ok(!cree.convoques.includes("u13-06") && !cree.convoques.includes("u13-11"), "sans les deux comptes en attente d'accord");
  ok(filDuClub(c, parent, null).some((p) => p.id === "c-u13-n1"), "la convocation arrive dans le fil des familles");
  egal(passe(creerSeance(c, coach, { ...n, genre: "entrainement", adversaire: undefined }), "créer un entraînement").seances.at(-1)!.id, "u13-n2", "un identifiant libre");
  ok(!("adversaire" in passe(creerSeance(club, coach, { ...n, genre: "entrainement" }), "un entraînement").seances.at(-1)!), "un entraînement n'a pas d'adversaire");
  egal(passe(creerSeance(club, coach, { ...n, categorie: "u17" }), "un match des U17").seances.at(-1)!.convoques.length, 16, "les U17 et le surclassé");
  refuse(creerSeance(club, coach, { ...n, categorie: "seniors" }), "créer une séance d'une catégorie qu'il ne tient pas");
  refuse(creerSeance(club, joueur, { ...n, categorie: "u17" }), "un joueur crée une séance");
  refuse(creerSeance(club, coach, { ...n, jour: "2026-11-11" }), "une séance dans le passé");
  refuse(creerSeance(club, coach, { ...n, jour: "2026-11-31" }), "une date à venir qui n'existe pas");
  refuse(creerSeance(club, coach, { ...n, heure: "25h00" }), "une heure qui n'existe pas");
  refuse(creerSeance(club, coach, { ...n, lieu: "  " }), "sans lieu");
  refuse(creerSeance(club, coach, { ...n, adversaire: "" }), "un match sans adversaire");
  refuse(creerSeance(club, coach, { ...n, categorie: "u99" }), "une catégorie inconnue");
  // Déplacé, il quitte les convocations à venir de son ancienne catégorie.
  c = passe(deplacerJoueur(club, coach, "u13-02", "u17"), "déplacer un U13 en U17");
  ok(!seance(c, "u13-m9").convoques.includes("u13-02") && !seance(c, "u13-e11").convoques.includes("u13-02"), "il n'est plus convoqué chez les U13");
  const joues = (k: Club) => k.seances.filter((x) => x.score && x.convoques.includes("u13-02")).length;
  ok(joues(c) > 0 && joues(c) === joues(club), "ses matchs joués restent");
  passe(convoquer(c, coach, "u17-m9", "u13-02", true), "son entraîneur le convoque chez les U17");
  c = passe(surclasser(club, coach, "u13-13", null), "retirer un surclassement");
  ok(!seance(c, "u17-m9").convoques.includes("u13-13") && seance(c, "u13-m9").convoques.includes("u13-13"), "il sort de la convocation des U17, reste dans celle des U13");
  egal(convocationsTenues(club), club, "le club de départ n'a que des convocations tenues");
}
{
  // L'âge d'une catégorie renommée, d'un joueur déplacé (D13, D14).
  let c = passe(renommerCategorie(club, admin, "u13", "U15"), "renommer U13 en U15");
  egal(c.categories.find((x) => x.id === "u13")!.ageMax, 15, "son âge limite suit son nom");
  egal(membreDe(c, "u13-13")!.surclasseEn, "u17", "un U15 surclassé en U17 le reste");
  c = passe(renommerCategorie(club, admin, "u13", "Poussins"), "renommer U13 en Poussins");
  ok(c.categories.find((x) => x.id === "u13")!.ageMax === null && membreDe(c, "u13-13")!.surclasseEn === null, "sans âge dans le nom : plus de limite, le surclassement tombe");
  ok(!seance(c, "u17-m9").convoques.includes("u13-13"), "et sa convocation chez les U17 avec");
  c = passe(renommerCategorie(club, admin, "u17", "U12"), "renommer U17 en U12");
  egal(membreDe(c, "u13-13")!.surclasseEn, null, "on ne reste pas surclassé vers plus jeune");
  egal(passe(renommerCategorie(club, admin, "seniors", "Féminines B"), "renommer en Féminines B").categories.find((x) => x.id === "seniors")!.feminine, true, "le côté suit le nom aussi");
  const u17 = membreDe(club, "u17-03")!;
  ok(ageLe(u17.naissance, club.jour) > 13 && !aLAgeDe(u17, club.categories[0], club.jour) && aLAgeDe(u17, club.categories[2], club.jour), "un U17 a passé l'âge des U13, pas celui des Seniors");
  refuse(deplacerJoueur(club, coach, "u17-03", "u13"), "déplacer un U17 de 15 ans en U13");
  refuse(deplacerJoueur(club, admin, "seniors-01", "u17"), "déplacer un Senior en U17");
  // L'entraîneur des Seniors ne prend pas un U17 chez lui : il faut tenir la catégorie de départ aussi.
  refuse(deplacerJoueur(club, { role: "entraineur", id: "s-e2" }, "u17-03", "seniors"), "prendre un joueur d'une catégorie qu'il ne tient pas");
  passe(deplacerJoueur(club, admin, "u17-03", "seniors"), "déplacer un U17 en Seniors");
  ok(aLAgeDe({ naissance: "2013-11-12" }, { ageMax: 13 }, club.jour) && !aLAgeDe({ naissance: "2012-11-12" }, { ageMax: 13 }, club.jour), "13 ans : encore U13 ; 14 ans : plus");
}
{
  // L'import : des identifiants uniques, des dates qui existent (D18).
  let c = passe(importerListe(club, admin, "Un Test"), "importer");
  c = passe(libererLicence(c, admin, joueur.id), "libérer");
  c = passe(importerListe(c, admin, "Deux Test\nTrois Test"), "importer encore");
  egal(new Set(c.licences.map((l) => l.id)).size, c.licences.length, "pas deux licences du même identifiant");
  ok(dateVraie("2024-02-29") && !dateVraie("2014-02-31") && !dateVraie("2014-13-01") && !dateVraie("14-01-01"), "une date qui existe");
  egal(lireListe(club, "A Test, 31/02/2014, U13"), [{ nom: "A Test", naissance: null, categorie: "u13", dateIllisible: "31/02/2014" }], "une date impossible est relevée");
  refuse(importerListe(club, admin, "A Test, 31/02/2014"), "importer une date impossible");
  refuse(importerListe(club, admin, "A Test, 01/01/2090"), "importer une naissance à venir");
  refuse(importerListe(club, admin, "A Test, 01/01/1850"), "importer une naissance d'un autre siècle");
  // Les limites de longueur.
  passe(publierAnnonce(club, coach, "u13", "x".repeat(400)), "une annonce de 400 caractères");
  refuse(publierAnnonce(club, coach, "u13", "x".repeat(401)), "une annonce de 401 caractères");
  passe(ajouterNote(club, coach, "u13-14", "x".repeat(500)), "une note de 500 caractères");
  refuse(ajouterNote(club, coach, "u13-14", "x".repeat(501)), "une note de 501 caractères");
}
{
  // L'état gardé sur le téléphone : une autre forme est jetée (D11).
  ok(formeDuClub(JSON.parse(JSON.stringify(club))), "le club de départ, relu, a la bonne forme");
  const abime = (f: (c: Record<string, unknown>) => void) => {
    const c = JSON.parse(JSON.stringify(club)) as Record<string, unknown>;
    f(c);
    return c;
  };
  ok(!formeDuClub({ jour: club.jour, membres: [], seances: [], licences: [] }), "l'état abîmé du contrôle est jeté");
  for (const cle of ["categories", "membres", "staff", "parents", "licences", "seances", "notes", "annonces", "demo", "blason", "nom", "licencesTotal"]) {
    ok(!formeDuClub(abime((c) => delete c[cle])), `sans « ${cle} », l'état est jeté`);
  }
  ok(!formeDuClub(abime((c) => (c.jour = "2026-01-01"))), "un autre jour de démo est jeté");
  ok(!formeDuClub(abime((c) => ((c.demo as Record<string, string>).joueur = "personne"))), "« moi » doit exister");
  ok(!formeDuClub(abime((c) => ((c.demo as Record<string, string>).admin = "u13-01"))), "l'admin de la démo est au staff");
  ok(!formeDuClub(abime((c) => ((c.seances as Record<string, unknown>[])[0].convoques = null))), "une séance sans convoqués est jetée");
  ok(!formeDuClub(abime((c) => ((c.membres as unknown[])[3] = "x"))), "un membre qui n'en est pas un est jeté");
  ok(!formeDuClub(null) && !formeDuClub([]) && !formeDuClub("club"), "ni null, ni une liste, ni un texte");
}
{
  // Le mois dans la saison, pour de bon.
  const novembre = (s: Seance) => s.jour.startsWith("2026-11");
  ok(club.membres.some((m) => progression(club, m.id, "mois") < progression(club, m.id, "saison")), "la progression du mois n'est pas celle de la saison");
  for (const m of club.membres.filter((x) => x.categorie === "u17")) {
    const carte = cartesDuClub(club).get(m.id)!;
    egal(progression(club, m.id, "mois"), pointsParMatch(carte).reduce((t, p) => t + (novembre(p.match) ? p.points : 0), 0), `${m.id} : la progression du mois, ce sont les points de novembre`);
    egal(buts(club, m.id, "mois"), club.seances.reduce((t, s) => t + (s.score && novembre(s) ? (s.stats[m.id]?.buts ?? 0) : 0), 0), `${m.id} : ses buts de novembre`);
    egal(passes(club, m.id, "saison"), club.seances.reduce((t, s) => t + (s.score ? (s.stats[m.id]?.passes ?? 0) : 0), 0), `${m.id} : ses passes de la saison`);
  }
  ok(club.membres.some((m) => buts(club, m.id, "mois") < buts(club, m.id, "saison")), "les buts du mois ne sont pas ceux de la saison");
  egal(buts(jourJ, "u13-14", "saison"), buts(club, "u13-14", "saison"), "un match sans score ne donne pas de but");
  // Le départage : seuls ceux que rien ne départage partagent leur rang.
  const m = (id: string, nom: string) => ({ ...club.membres[0], id, nom });
  const r = ranger([
    { membre: m("a", "Zed"), valeur: 5, libelle: "+5", departage: [78] },
    { membre: m("b", "Abc"), valeur: 5, libelle: "+5", departage: [81] },
    { membre: m("c", "Mno"), valeur: 5, libelle: "+5", departage: [78] },
    { membre: m("d", "Def"), valeur: 6, libelle: "+6", departage: [60] },
    { membre: m("e", "Ghi"), valeur: 5, libelle: "+5", departage: [78, 1] },
  ]);
  egal(r.map((l) => [l.membre.id, l.rang]), [["d", 1], ["b", 2], ["e", 3], ["c", 4], ["a", 4]], "la valeur, puis ce qui départage ; les vrais ex æquo partagent leur rang");
  ok(!("departage" in r[0]), "le départage ne sort pas dans la ligne");
  for (const [quoi, periode] of [["progression", "mois"], ["assiduite", "saison"], ["buteurs", "saison"]] as const) {
    const actifs = club.membres.filter((x) => licenceActive(club, x.id));
    const c = classementClub(club, actifs, quoi, periode);
    ok(c.every((l, i) => i === 0 || c[i - 1].valeur >= l.valeur) && c.every((l, i) => l.rang <= i + 1) && c[0].rang === 1, `${quoi} : décroissant, rangs dans l'ordre`);
    const note = (id: string) => cartesDuClub(club).get(id)!.note;
    const cle = (l: (typeof c)[number]) => {
      const a = assiduite(club, l.membre.id, periode);
      return quoi === "progression" ? [note(l.membre.id)] : quoi === "assiduite" ? [a.presents, -a.retards] : [passes(club, l.membre.id, periode)];
    };
    ok(c.every((l, i) => i === 0 || c[i - 1].valeur > l.valeur || cle(c[i - 1]).join() === cle(l).join() ? true : cle(c[i - 1]).some((x, k) => x > cle(l)[k])), `${quoi} : à valeur égale, le départage décide`);
    ok(c.every((l, i) => i === 0 || (c[i - 1].rang === l.rang) === (c[i - 1].valeur === l.valeur && cle(c[i - 1]).join() === cle(l).join())), `${quoi} : le rang n'est partagé que par les vrais ex æquo`);
  }
  const actifs = club.membres.filter((x) => licenceActive(club, x.id));
  ok(aUnPodium(classementClub(club, actifs, "progression", "mois")) && aUnPodium(classementClub(club, actifs, "buteurs", "saison")), "la progression et les buteurs ont leur podium");
  const sansAbsent = classementClub(club, actifs, "assiduite", "mois");
  ok(sansAbsent.filter((l) => l.rang === 1).length > 3 && !aUnPodium(sansAbsent), "plus de trois premiers ex æquo (l'assiduité de novembre) : pas de podium");
  ok(!aUnPodium([]) && aUnPodium(sansAbsent.slice(0, 3)), "ni podium vide ; trois ex æquo en ont un");
  const prog = classementClub(club, actifs, "progression", "mois");
  ok(new Set(prog.slice(0, 3).map((l) => l.rang)).size > 1, "le podium de la progression n'est plus trois fois « 1 »");
  ok(cartesQuiMontent(club, seance(club, "u13-m8")).every((x) => membreDe(club, x.id) && Object.values(x.gains).some((g) => (g ?? 0) > 0)), "les cartes qui montent ont un nom et un gain");
}
{
  // Le drapeau, hors production : le club existe en aperçu et en développement ; sans téléphone, pas de marqueur.
  ok(BOLA_CLUB === true && clubOuvert() === false, "en aperçu le drapeau est levé ; côté serveur, le menu n'a pas de club");
}

console.log(`club: ok (${n} vérifications)`);
