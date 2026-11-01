// Vérifie les pronos Bola (src/lib/sfl/pronos.ts) sur la saison de départ :
// une journée jouée se juge, un prono posé après le coup d'envoi ou contre
// son propre camp ne compte pas, une journée plafonne, et la saison close
// paie les bons pronos de saison à la prime de leur heure.
//
//   npx tsx tools/pronos-check.ts

import assert from "node:assert/strict";
import { journalXp } from "../src/lib/sfl/missions";
import {
  ajouterPronos,
  choixDeSaisonDu,
  choixPermis,
  classementFlair,
  duelPermis,
  ecartDe,
  PLAFOND_TRIBUNE,
  plafondDe,
  xpSujet,
  flairsDuJoueur,
  J_SAISON,
  lignesPronos,
  PLAFOND_JOURNEE,
  primeSaison,
  pronosDeJournee,
  resultatsDeJournee,
  resultatsDeSaison,
  type Prono,
} from "../src/lib/sfl/pronos";
import { journeeJouee } from "../src/lib/sfl/saisie/mutations";
import { seedSaison } from "../src/lib/sfl/saisie/store";

const s = seedSaison();
const numero = s.numero ?? 0;
const loin = new Date(Date.UTC(2030, 0, 1));
const jouees = s.journees.filter((m) => journeeJouee(s, m.j)).map((m) => m.j);
assert.ok(jouees.length > 0, "la saison de départ a une journée jouée");
const j = jouees[jouees.length - 1];
const p = pronosDeJournee(s, numero, j, new Date());
assert.ok(p, `J${j} a ses équipes`);
assert.ok(p.matchs.length > 0 && p.joueurs.length > 0);
const res = resultatsDeJournee(p, s.entries);
console.log(`J${j} :`, p.matchs.length, "match(s),", p.joueurs.length, "joueurs ;", Object.fromEntries(res));

const m0 = p.matchs[0];
const bon = res.get(`match:${m0.n}`)?.[0];
assert.ok(bon, "le match 1 a un résultat");
const avant = new Date(p.coupEnvoi.getTime() - 3600_000).toISOString();
const apres = new Date(p.coupEnvoi.getTime() + 60_000).toISOString();
const neutre = p.joueurs.find((n) => p.camps.get(n)?.terrain !== m0.n) ?? null;
const sien = m0.noirs[0];
assert.deepEqual(choixPermis(p, m0.n, sien), ["noirs"], "sur son match, seulement son camp");

const pronos: Prono[] = [];
const base = { saison: numero, j };
if (neutre) {
  pronos.push({ ...base, sujet: `match:${m0.n}`, joueur: neutre, choix: bon, le: avant });
  pronos.push({ ...base, sujet: "buteur", joueur: neutre, choix: res.get("buteur")?.[0] ?? "x", le: avant });
  pronos.push({ ...base, sujet: "pepite", joueur: neutre, choix: res.get("pepite")?.[0] ?? "x", le: avant });
}
// Trop tard : ne compte pas.
const tard = p.joueurs.find((n) => n !== neutre && n !== sien)!;
pronos.push({ ...base, sujet: "buteur", joueur: tard, choix: res.get("buteur")?.[0] ?? "x", le: apres });
// Contre son camp : ne compte pas.
pronos.push({ ...base, sujet: `match:${m0.n}`, joueur: sien, choix: "blancs", le: avant });

const now = new Date();
const lignes = lignesPronos(s, numero, false, pronos, now, now);

assert.ok(!lignes.some((l) => l.joueur === tard), "un prono tardif ne paie pas");
assert.ok(!lignes.some((l) => l.joueur === sien && bon !== "blancs"), "un prono contre son camp ne paie pas");
if (neutre) {
  const l = lignes.find((x) => x.joueur === neutre);
  assert.ok(l && l.ligne.xp <= PLAFOND_JOURNEE && l.ligne.xp >= 20, "trois justes, plafonnés");
}

// La saison close : la Pépite d'Or devinée paie la prime de son heure.
const tete = resultatsDeSaison(s).get("pepite")!;
assert.ok(tete.length > 0);
const saisonLignes = lignesPronos(s, numero, true, [{ saison: numero, j: J_SAISON, sujet: "pepite", joueur: "Testeur", choix: tete[0], le: new Date(0).toISOString() }], loin, loin);
assert.equal(saisonLignes.find((l) => l.joueur === "Testeur")?.ligne.xp, primeSaison(0));
assert.equal(primeSaison(2), 220);
assert.equal(primeSaison(99), 60);

// Le journal : les lignes s'ajoutent à celles des missions.
const journal = journalXp(s, [], [], now);
const avantTotal = [...journal.values()].reduce((a, x) => a + x.lignes.length, 0);
ajouterPronos(journal, s, pronos, now);
const apresTotal = [...journal.values()].reduce((a, x) => a + x.lignes.length, 0);
assert.equal(apresTotal - avantTotal, lignes.length);
// Mon Flair (Ma carte, récaps) : les mêmes verdicts et la même XP que le journal.
if (neutre) {
  const [f] = flairsDuJoueur(s, numero, false, pronos, neutre, now, now);
  assert.ok(f && f.j === j && f.choix.length === 3, "trois choix relus");
  assert.equal(f.plafond, PLAFOND_JOURNEE, "sur la feuille, le plafond d'un dimanche");
  assert.equal(f.choix[0].sujet, `match:${m0.n}`, "le match d'abord");
  assert.equal(f.xp, lignes.find((x) => x.joueur === neutre)?.ligne.xp ?? 0, "la même XP que le journal");
}
const [ft] = flairsDuJoueur(s, numero, false, pronos, tard, now, now);
assert.equal(ft.choix[0].etat, "hors-delai", "un choix tardif se dit tardif");
assert.equal(ft.xp, 0);
const cs = choixDeSaisonDu(s, numero, true, [{ saison: numero, j: J_SAISON, sujet: "pepite", joueur: "Testeur", choix: tete[0], le: new Date(0).toISOString() }], "Testeur", loin);
assert.equal(cs[0].etat, "juste");
assert.equal(cs[0].prime, primeSaison(0));

// Sabri, 31/10 : chaque match a son écart, son duel, son MVP, son buteur et
// son passeur ; la journée a son passeur ; la tribune a son plafond.
assert.equal(ecartDe(0), "serre");
assert.equal(ecartDe(-1), "serre");
assert.equal(ecartDe(3), "net");
assert.equal(ecartDe(-6), "large");
assert.ok(res.has(`ecart:${m0.n}`), "l'écart du match se juge");
assert.ok(res.has(`buteur:${m0.n}`) && res.has(`passeur:${m0.n}`), "buteur et passeur du match");
assert.ok(res.has("passeur"), "le passeur du jour");
console.log("J" + j, "par match :", Object.fromEntries([...res].filter(([k]) => k.includes(":"))));
const ici = new Set([...m0.noirs, ...m0.blancs]);
const buteurs = res.get(`buteur:${m0.n}`)!;
assert.ok(buteurs.every((n) => ici.has(n)), "le buteur du match est de ce match");
assert.equal(xpSujet("mvp:0"), 20);
assert.equal(xpSujet("passeur"), 40);
if (m0.duel) {
  const [a, b] = m0.duel;
  assert.deepEqual(duelPermis(p, m0.n, a), [a], "dans le duel, seulement soi");
  assert.deepEqual(duelPermis(p, m0.n, "Quelqu'un d'autre"), [a, b]);
  assert.ok(res.get(`duel:${m0.n}`)?.length, "le duel se juge");
}
// Un spectateur (pas sur la feuille) : tout lui est permis, et son plafond est celui de la tribune.
const tribune = "Spectateur";
assert.equal(plafondDe(p, tribune), PLAFOND_TRIBUNE);
const tous: Prono[] = [...res].map(([sujet, bons]) => ({ ...base, sujet, joueur: tribune, choix: bons[0] ?? "x", le: avant }));
const lt = lignesPronos(s, numero, false, tous, now, now).find((l) => l.joueur === tribune);
assert.ok(lt && lt.ligne.xp === Math.min(PLAFOND_TRIBUNE, tous.filter((x) => res.get(x.sujet)?.includes(x.choix)).reduce((a, x) => a + xpSujet(x.sujet), 0)), "la tribune plafonne à 150");
const [ftr] = flairsDuJoueur(s, numero, false, tous, tribune, now, now);
assert.equal(ftr.xp, lt!.ligne.xp, "Mon Flair dit la même XP");
assert.equal(ftr.choix[0].sujet, `match:${m0.n}`, "le match d'abord, sujet par sujet");
// Un écart inconnu ne compte pas.
assert.equal(lignesPronos(s, numero, false, [{ ...base, sujet: `ecart:${m0.n}`, joueur: "X", choix: "enorme", le: avant }], now, now).length, 0);
// Le classement : le spectateur, qui a tout vu juste, est devant.
const cl = classementFlair(s, numero, false, [...pronos, ...tous], now, now);
assert.equal(cl[0].joueur, tribune, "le meilleur flair d'abord");
assert.equal(cl[0].xp, lt!.ligne.xp);
console.log("pronos : tout est bon");
