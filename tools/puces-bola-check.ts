// Vérifie la puce dorée des MVP dans le mode Bola (Ilyes, 02/11/2026 : « mets
// aussi les MVP avec une puce dorée dans le mode de jeu Bola » ;
// lib/sfl/puces-titres.ts, titresBola et pucesBola). Bola n'a qu'un titre,
// le MVP désigné par l'app : jamais de rouge ni de bleu. La puce n'existe que
// sur un match validé, au critère même de la carte MVP Bola (carte-bola.ts) :
// à venir, en cours, en attente, contesté, sous le quorum, en exhibition,
// rien ; ex æquo, chacun la sienne. Et la fiche du match (mvpsDeLaFiche) :
// validé, le « MVP » écrit sous le score est celui de la puce (la ligue), même
// quand la feuille brute en désignait un autre.
//   npx tsx tools/puces-bola-check.ts
import assert from "node:assert/strict";
import { cartesMvpBola, mesMatchsValides } from "../src/lib/sfl/carte-bola";
import type { EtatResultat } from "../src/lib/sfl/confirmation-resultat";
import { compterMatchs, mvpsDuMatch, QUORUM, type LigneBola, type MatchBola, type MatchCompte } from "../src/lib/sfl/ligue-vierge";
import { mvpsDeLaFiche, pucesBola, titresBola } from "../src/lib/sfl/puces-titres";

const ligne = (id: string, equipe: "clairs" | "fonces", buts = 0, passes = 0): LigneBola => ({ id, name: id, equipe, buts, passes });

/** Huit joueurs (le quorum), Ana loin devant. */
const huit = (): LigneBola[] => [
  ligne("ana", "clairs", 3, 1),
  ligne("bea", "clairs", 1, 0),
  ligne("cy", "clairs"),
  ligne("dan", "clairs"),
  ligne("eli", "fonces", 1, 1),
  ligne("fa", "fonces"),
  ligne("gus", "fonces"),
  ligne("hu", "fonces"),
];

let seq = 0;
const match = (t: Partial<MatchBola> = {}): MatchBola => ({
  id: ++seq,
  jour: "2026-10-30",
  heure: "19h30",
  genre: "match",
  scoreClairs: 4,
  scoreFonces: 1,
  joueurs: huit(),
  etat: "compte",
  requise: true,
  ...t,
});

const compte = (m: MatchBola): MatchCompte => compterMatchs([m])[0];
const OR = ["mvp"];

/* ------------------------------ Le match validé ------------------------------ */

{
  const m = compte(match());
  assert.equal(m.valide, true);
  assert.deepEqual([...titresBola(m, "ana")], OR, "le MVP d'un match validé a sa puce dorée");
  for (const j of m.joueurs.filter((x) => x.id !== "ana")) assert.deepEqual([...titresBola(m, j.id)], [], `${j.id} n'est pas MVP : rien`);
  assert.deepEqual([...pucesBola(m)].map(([id, t]) => [id, [...t]]), [["ana", OR]], "une seule puce sur le terrain");
  assert.deepEqual([...titresBola(m, "inconnu")], [], "un joueur hors du match : rien");
}

// Un match saisi avant la confirmation (sans état, ou non requise) compte : sa puce aussi.
assert.deepEqual([...titresBola(compte(match({ etat: null, requise: false })), "ana")], OR, "match d'avant le 28/10 : la puce");
assert.deepEqual([...titresBola(compte(match({ etat: undefined })), "ana")], OR, "match sans état : la puce");

/* --------------------- Ex æquo : chacun sa puce, jamais d'autre couleur --------------------- */

{
  const j = huit();
  j[4] = ligne("eli", "fonces", 3, 1); // Eli égale Ana en buts et en passes
  const m = compte(match({ joueurs: j }));
  assert.deepEqual(m.mvps.sort(), ["ana", "eli"]);
  assert.deepEqual([...titresBola(m, "ana")], OR);
  assert.deepEqual([...titresBola(m, "eli")], OR);
  assert.equal(pucesBola(m).size, 2, "ex æquo : deux puces dorées");
  for (const t of pucesBola(m).values()) assert.deepEqual([...t], OR, "Bola : jamais d'Impact ni de Défensive");
}

// À égalité de buts + passes, le plus de passes l'emporte : une seule puce.
{
  const j = huit();
  j[4] = ligne("eli", "fonces", 1, 3);
  const m = compte(match({ joueurs: j }));
  assert.deepEqual([...pucesBola(m).keys()], ["eli"], "à égalité, le passeur est MVP, seul");
}

/* ------------------------- Pas validé : aucune puce ------------------------- */

const pasValide: [string, Partial<MatchBola>][] = [
  ...(["en_attente", "conteste", "ne_compte_pas"] as EtatResultat[]).map((etat): [string, Partial<MatchBola>] => [etat, { etat }]),
  ["sous le quorum", { joueurs: huit().slice(0, QUORUM - 1) }],
  ["exhibition", { genre: "exhibition" }],
];
for (const [cas, t] of pasValide) {
  const m = compte(match(t));
  assert.equal(m.valide, false, cas);
  assert.ok(m.mvps.includes("ana"), `${cas} : le MVP reste désigné (ligue-vierge.ts)`);
  assert.deepEqual([...titresBola(m, "ana")], [], `${cas} : pas de puce`);
  assert.equal(pucesBola(m).size, 0, `${cas} : aucune puce sur le terrain`);
}

// Personne n'a marqué ni passé : pas de MVP, pas de puce.
{
  const m = compte(match({ joueurs: huit().map((l) => ({ ...l, buts: 0, passes: 0 })) }));
  assert.equal(m.valide, true);
  assert.equal(pucesBola(m).size, 0, "à 0, aucun MVP");
}

// Pas encore lu (la fiche attend la ligue) ou pas vu : rien.
assert.deepEqual([...titresBola(null, "ana")], []);
assert.deepEqual([...titresBola(undefined, "ana")], []);
assert.equal(pucesBola(null).size, 0);

/* ----------------- Une correction remet le match en attente : la puce tombe ----------------- */

{
  const base = match();
  assert.deepEqual([...titresBola(compte(base), "ana")], OR);
  assert.deepEqual([...titresBola(compte({ ...base, etat: "en_attente" }), "ana")], [], "corrigé, en attente : la puce tombe");
}

/* ---------------- Le même critère que la carte MVP Bola (carte-bola.ts) ---------------- */

{
  const j = huit();
  j[4] = ligne("eli", "fonces", 3, 1);
  const matchs = [
    match({ jour: "2026-10-20" }),
    match({ jour: "2026-10-21", etat: "en_attente" }),
    match({ jour: "2026-10-22", joueurs: j }),
    match({ jour: "2026-10-23", etat: "conteste" }),
    match({ jour: "2026-10-24", joueurs: huit().slice(0, 7) }),
    match({ jour: "2026-10-24", heure: "21h", etat: "ne_compte_pas" }),
    // Deux matchs le même jour : le second est amical pour le classement, mais validé : la carte MVP et la puce.
    match({ jour: "2026-10-20", heure: "22h" }),
  ];
  const comptes = compterMatchs(matchs);
  for (const id of ["ana", "eli", "bea"]) {
    const cartes = cartesMvpBola(mesMatchsValides(comptes, id), id, null);
    const avecPuce = comptes.filter((m) => titresBola(m, id).length > 0);
    assert.equal(avecPuce.length, cartes.length, `${id} : une puce par carte MVP Bola`);
    assert.deepEqual(
      avecPuce.map((m) => m.id),
      mesMatchsValides(comptes, id).filter((v) => v.ligne.mvp).map((v) => v.m.id),
      `${id} : les mêmes matchs`,
    );
  }
  assert.equal(comptes.filter((m) => titresBola(m, "ana").length).length, 3, "Ana : trois matchs validés où elle est MVP");
}

/* -------- La fiche du match : sous le score, le même MVP que la puce (mvpsDeLaFiche) -------- */

{
  // La feuille brute de la fiche : Zoé, mise sur la feuille par l'organisateur
  // sans avoir jamais accepté, fait le plus gros match et ne confirme pas. La
  // ligue (match_bola_json) l'écarte : son MVP est Ana, celle de la carte MVP Bola.
  const feuille = [...huit(), ligne("zoe", "fonces", 4, 2)];
  const brut = mvpsDuMatch(feuille);
  assert.deepEqual(brut, ["zoe"], "la feuille brute désigne Zoé");
  const m = compte(match()); // les lignes de la ligue, sans Zoé
  assert.deepEqual(m.mvps, ["ana"]);
  const fiche = mvpsDeLaFiche(m, brut);
  assert.deepEqual([...fiche.ids], ["ana"], "validé : le MVP écrit est celui de la ligue, pas celui de la feuille");
  assert.equal(fiche.officiels, true, "validé : ses cartes portent la puce");
  for (const id of fiche.ids) assert.deepEqual([...titresBola(m, id)], OR, "chaque MVP écrit porte la puce");
  assert.deepEqual([...titresBola(m, "zoe")], [], "Zoé, écartée par la ligue : pas de puce");

  // Pas validé (en attente, contesté, pas encore lu) : la feuille, désignée, sans puce.
  for (const cas of [compte(match({ etat: "en_attente" })), compte(match({ etat: "conteste" })), compte(match({ genre: "exhibition" })), null, undefined]) {
    const f = mvpsDeLaFiche(cas, brut);
    assert.deepEqual([...f.ids], ["zoe"], "pas validé : le MVP de la feuille");
    assert.equal(f.officiels, false, "pas validé : aucune puce sous le score");
  }

  // Ex æquo validé : les deux, chacun sa puce ; validé à 0 : personne.
  const j = huit();
  j[4] = ligne("eli", "fonces", 3, 1);
  const ex = compte(match({ joueurs: j }));
  assert.deepEqual([...mvpsDeLaFiche(ex, brut).ids].sort(), ["ana", "eli"]);
  const zero = compte(match({ joueurs: huit().map((l) => ({ ...l, buts: 0, passes: 0 })) }));
  assert.deepEqual(mvpsDeLaFiche(zero, brut), { ids: [], officiels: true }, "validé sans but ni passe : pas de MVP, même si la feuille en avait un");
}

console.log("puces-bola: ok");
