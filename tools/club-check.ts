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
//       appel, stats (bornes), annonce, import, écusson ; le fil par rôle.
//   npx tsx tools/club-check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAT_KEYS, ovr } from "../src/lib/sfl/engine";
import { estGardien } from "../src/lib/sfl/gardien";
import { evoluer, JOURNEES_PAR_MAJ } from "../src/lib/sfl/saisie/evolution";
import { filDuClub } from "../src/lib/sfl/club/actus";
import { assiduite, buts, classementClub, pointsParMatch, progression, ranger, trierEffectif } from "../src/lib/sfl/club/classements";
import { ADVERSAIRES, clubDemo } from "../src/lib/sfl/club/demo";
import {
  ajouterNote,
  changerBlason,
  changerPoste,
  creerCategorie,
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
import { accordParentalRequis, ageLe, compteLicences, droits, licenceDe, membreDe, peutActiver, peutEcrireEnPrive, surclassementsPossibles } from "../src/lib/sfl/club/regles";
import { RAISON_SERIE_CLUB, carteDuMembre, cartesDuClub, lignesDuMatch, mvpsDe, saisonDuMembre } from "../src/lib/sfl/club/saison";
import type { Club, Moi } from "../src/lib/sfl/club/types";

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
  refuse(faireAppel(club, coach, "seniors-m9", "seniors-01", "present"), "l'appel d'une autre catégorie");
  refuse(saisirStats(club, joueur, "u17-m9", { nous: 1, eux: 0 }, {}), "des stats saisies par un joueur");
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
  const joue = passe(saisirStats(club, coach, match.id, { nous: 1, eux: 1 }, { [cible.id]: { buts: 1, passes: 0 } }), "saisir un but");
  const apres = carteDuMembre(joue, joue.membres.find((m) => m.id === cible.id)!);
  const dernier = apres.ev!.journal[0];
  ok(dernier.faits.some((f) => f.stat === "TIR" && f.crans === 1 && f.raison === "1 but"), "saisir un but verse un cran de TIR");
  ok(dernier.faits.some((f) => f.raison === "MVP"), "le seul buteur est MVP");
  egal(mvpsDe(joue, joue.seances.find((s) => s.id === match.id)!), [cible.id], "le MVP du match");
  ok(STAT_KEYS.every((k) => apres.enDirect[k] >= avant.enDirect[k]) && ovr(apres.enDirect) >= ovr(avant.enDirect), "la carte en direct ne descend pas");
  egal(apres.matchs.length, avant.matchs.length + 1, "un match de plus dans son journal");
  ok(filDuClub(joue, coach, "u13").some((p) => p.genre === "resultat" && p.seance.id === match.id), "le résultat arrive dans les actus");
  // Un 0-0 : personne n'est MVP, sauf le gardien qui n'a rien encaissé.
  const nul = passe(saisirStats(club, coach, match.id, { nous: 0, eux: 0 }, {}), "saisir un 0-0");
  const m00 = nul.seances.find((s) => s.id === match.id)!;
  ok(mvpsDe(nul, m00).every((id) => estGardien(membreDe(nul, id)!.poste)), "un 0-0 n'élit que le gardien (clean sheet)");
  const sansButeur = passe(saisirStats(club, coach, match.id, { nous: 1, eux: 1 }, {}), "saisir un 1-1 sans buteur");
  egal(mvpsDe(sansButeur, sansButeur.seances.find((s) => s.id === match.id)!), [], "un nul sans stat n'élit personne : le résultat n'entre pas dans le MVP");
  const perdu = passe(saisirStats(club, coach, match.id, { nous: 0, eux: 2 }, {}), "saisir un 0-2");
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
ok(classementClub(club, club.membres.filter((m) => m.categorie === "u13"), "assiduite", "saison").every((l) => l.valeur <= 100 && l.libelle.endsWith(" %")), "l'assiduité en %");
egal(classementClub(club, club.membres, "assiduite", "saison").length, 58, "sans séance, pas d'assiduité (les deux accords en attente)");

// 6 · les changements
{
  let c = passe(deplacerJoueur(club, coach, "u13-14", "u17"), "l'entraîneur déplace un U13 en U17");
  egal(membreDe(c, "u13-14")!.categorie, "u17", "le joueur a changé de catégorie");
  egal(carteDuMembre(c, membreDe(c, "u13-14")!).note, cartes.get("u13-14")!.note, "déplacé, sa carte ne bouge pas");
  c = passe(deplacerJoueur(club, coach, "u13-13", "u17"), "déplacer le surclassé dans sa catégorie de surclassement");
  egal(membreDe(c, "u13-13")!.surclasseEn, null, "son surclassement en U17 tombe : il y est");
  egal(surclassementsPossibles(membreDe(club, "u13-01")!, club.categories).map((x) => x.id), ["u17", "seniors"], "un U13 : U17 ou Seniors");
  egal(surclassementsPossibles(membreDe(club, "u17-01")!, club.categories).map((x) => x.id), ["seniors"], "un U17 : Seniors");
  egal(surclassementsPossibles(membreDe(club, "seniors-01")!, club.categories), [], "un Senior : aucun");
  egal(surclassementsPossibles(membreDe(club, "feminines-01")!, club.categories), [], "une Féminine : aucun");
  refuse(surclasser(club, coach, "u17-01", "u13"), "surclasser vers plus jeune");
  refuse(surclasser(club, coach, "u13-01", "feminines"), "surclasser un U13 chez les Féminines");
  c = passe(surclasser(club, coach, "u13-01", "seniors"), "surclasser un U13 en Seniors");
  egal(membreDe(c, "u13-01")!.surclasseEn, "seniors", "surclassé");
  c = passe(surclasser(c, coach, "u13-01", null), "retirer le surclassement");
  egal(membreDe(c, "u13-01")!.surclasseEn, null, "plus surclassé");
  c = passe(changerPoste(club, coach, "u13-14", "MC"), "changer de poste");
  egal(membreDe(c, "u13-14")!.poste, "MC", "le poste");
  c = passe(ajouterNote(club, coach, "u13-14", "  Bon match.  "), "ajouter une note");
  egal(c.notes.at(-1), { id: c.notes.at(-1)!.id, membre: "u13-14", auteur: coach.id, jour: club.jour, texte: "Bon match." }, "la note, datée et signée");
  refuse(ajouterNote(club, coach, "u13-14", "   "), "une note vide");
  c = passe(faireAppel(club, coach, "u13-m9", "u13-14", "retard"), "faire l'appel");
  egal(c.seances.find((s) => s.id === "u13-m9")!.appel["u13-14"], "retard", "l'appel est noté");
  refuse(faireAppel(club, coach, "u13-m9", "u13-06", "present"), "l'appel d'un non-convoqué");
  refuse(saisirStats(club, coach, "u13-m9", { nous: 1, eux: 0 }, { "u13-14": { buts: 2, passes: 0 } }), "plus de buts que le score");
  refuse(saisirStats(club, coach, "u13-m9", { nous: 1, eux: 0 }, { "u13-14": { buts: 1, passes: 0 }, "u13-15": { buts: 0, passes: 2 } }), "plus de passes que de buts");
  refuse(saisirStats(club, coach, "u13-e11", { nous: 1, eux: 0 }, {}), "des stats sur un entraînement");
  c = passe(faireAppel(club, coach, "u13-m9", "u13-14", "absent"), "noter un absent");
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
  egal(fa.filter((p) => p.genre === "convocation").length, 8, "les convocations à venir : un match et un entraînement par catégorie");
  ok(fa[0].genre === "convocation" && fa.findIndex((p) => p.genre !== "convocation") === 8, "ce qui vient d'abord");
  ok(fa.slice(0, 8).every((p, i, t) => i === 0 || t[i - 1].jour <= p.jour), "le plus proche en tête");
  ok(fa.some((p) => p.genre === "cartes" && p.cartes.length > 0), "des cartes qui montent");
  ok(filDuClub(club, admin, "u13").every((p) => p.categorie === "u13" || p.categorie === null), "le rail filtre sur la catégorie");
  ok(filDuClub(club, joueur, null).every((p) => p.categorie === "u17" || p.categorie === null), "un joueur : le club et sa catégorie");
  ok(filDuClub(club, joueur, "seniors").every((p) => p.categorie === null), "un joueur ne lit pas une autre catégorie, même demandée");
  egal(filDuClub(club, coach, null).length, fa.length, "l'entraîneur lit tout le club");
}

console.log(`club: ok (${n} vérifications)`);
