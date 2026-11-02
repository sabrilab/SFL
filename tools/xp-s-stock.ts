// Le stock de départ des XP S (lib/sfl/xp-s.ts, 02/11/2026) : ce que chacun
// a au lancement, toute l'histoire comptée (Ilyes : « oui, toute l'histoire
// compte »), au barème et aux plafonds du calcul, par le même chemin que le
// serveur (xp-calcul.ts, journalCompletAvecS, sur la vue figée et votes
// posés). Rien n'est écrit nulle part : il lit, il compte, il dit.
//
//   npx tsx tools/xp-s-stock.ts
//     la saison 0 du dépôt (seedSaison : 8 journées du 21 juin au 9 août).
//     Ni missions ni Flair n'existaient : titres et SFL Time seulement.
//   npx tsx tools/xp-s-stock.ts saison.json [reponses.json] [pronos.json] [votes.json] [heure ISO]
//     un export de la base, pour mesurer avant le lancement : le document de
//     saison (la colonne data de la table saison, archives comprises) et, en
//     tableaux JSON, missions_reponses, pronos et votes_figures (saison en
//     cours). L'heure : celle du calcul (maintenant par défaut).
//
// Rend : chaque joueur (XP S gagnées, dont SFL Time, titres, missions, Flair,
// Flair de saison), la médiane et le 90e centile de ceux qui ont joué au
// moins une journée, ceux des réguliers (5 journées au moins), le nombre de
// journées en SFL Time, et qui peut ouvrir un tirage du Pack Afrique 2027 dès
// le lancement.

import { readFileSync } from "node:fs";
import { PACK_AFRIQUE } from "../src/lib/sfl/pack-afrique";
import type { Prono } from "../src/lib/sfl/pronos";
import type { Reponse } from "../src/lib/sfl/missions";
import { figer } from "../src/lib/sfl/revelation";
import { sansBrouillons } from "../src/lib/sfl/saisie/brouillon";
import { journeeJouee } from "../src/lib/sfl/saisie/engine";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { saisonAvecVotes } from "../src/lib/sfl/saison-serveur.server";
import type { VoteFigure } from "../src/lib/sfl/votes";
import { journalCompletAvecS } from "../src/lib/sfl/xp-calcul";
import { totalXpS, XP_S, type LigneXpS } from "../src/lib/sfl/xp-s";

const [fichier, fReponses, fPronos, fVotes, heure] = process.argv.slice(2);
const lireJson = <T>(f: string | undefined, defaut: T): T => (f ? (JSON.parse(readFileSync(f, "utf8")) as T) : defaut);
const maintenant = heure ? new Date(heure) : new Date();
const document: Saison = fichier ? lireJson<Saison>(fichier, seedSaison()) : seedSaison();
const reponses = lireJson<Reponse[]>(fReponses, []);
const pronos = lireJson<Prono[]>(fPronos, []);
const votes = lireJson<VoteFigure[]>(fVotes, []);

// La saison telle que le serveur la lit (lireSaisonServeur) : sans brouillons, votes posés, figée.
const jugee = figer(saisonAvecVotes(sansBrouillons(document), votes, maintenant), maintenant);
const { journalS } = journalCompletAvecS({ jugee, reponses, votes, felicitations: [], pronos, ligueRecrues: [], moi: null, bolaCarte: null, maintenant });

// Les journées jouées de chacun, toutes saisons.
const joue = (e: MatchEntry) => e.statut === "Présent" && !e.extraTime;
const saisons = [...(jugee.archives ?? []).map((a) => ({ numero: a.numero, lue: a })), { numero: jugee.numero ?? 0, lue: jugee }];
const jouees = new Map<string, number>();
let journeesSfl = 0;
let journees = 0;
for (const { lue } of saisons) {
  for (const m of lue.journees) {
    if (!journeeJouee(lue, m.j)) continue;
    journees++;
    if (lue.entries.some((e) => e.j === m.j && joue(e) && e.sflTime)) journeesSfl++;
    for (const n of new Set(lue.entries.filter((e) => e.j === m.j && joue(e)).map((e) => e.player))) jouees.set(n, (jouees.get(n) ?? 0) + 1);
  }
}

const par = (l: readonly LigneXpS[], f: (x: LigneXpS) => boolean) => totalXpS(l.filter(f));
const lignes = [...new Set([...jouees.keys(), ...journalS.keys()])]
  .map((n) => {
    const l = journalS.get(n) ?? [];
    return {
      nom: n,
      journees: jouees.get(n) ?? 0,
      xps: totalXpS(l),
      sflTime: par(l, (x) => x.source === "sfl-time"),
      titres: par(l, (x) => x.source === "titre"),
      missions: par(l, (x) => x.source === "mission"),
      flair: par(l, (x) => x.source === "flair"),
      flairSaison: par(l, (x) => x.source === "flair-saison"),
    };
  })
  .sort((a, b) => b.xps - a.xps || b.journees - a.journees || a.nom.localeCompare(b.nom));

/** La médiane (moyenne des deux du milieu si leur nombre est pair). */
function mediane(v: number[]): number {
  const a = [...v].sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
/** Le 90e centile, au rang le plus proche : la valeur sous laquelle se tiennent 90 % des joueurs. */
function centile(v: number[], p: number): number {
  const a = [...v].sort((x, y) => x - y);
  return a.length ? a[Math.max(0, Math.ceil((p / 100) * a.length) - 1)] : 0;
}

const joueurs = lignes.filter((x) => x.journees >= 1);
const reguliers = lignes.filter((x) => x.journees >= 5);
const ilyes = lignes.find((x) => x.nom === "Ilyes");
const prix = PACK_AFRIQUE.prix;

console.log(`Stock de départ des XP S — ${fichier ? fichier : "la saison 0 du dépôt (seedSaison)"}, calculé le ${maintenant.toISOString()}`);
console.log(`Barème : SFL Time ${XP_S.sflTime}, mission S ${XP_S.missionS}, MVP ${XP_S.mvp}, Impact et Défensive ${XP_S.impact} (deux voix au moins), Flair ${XP_S.flairDur} par dur (${XP_S.flairJournee} au plus), Flair de saison ${XP_S.flairSaison} ; ${XP_S.journee} par journée.`);
console.log(`Journées jouées : ${journees}, dont ${journeesSfl} en SFL Time ; ${joueurs.length} joueurs ont joué, ${reguliers.length} au moins 5 journées.`);
console.log("");
console.log("joueur                   journées  XP S  (SFL Time · titres · missions · Flair · Flair de saison)");
for (const x of lignes.filter((y) => y.xps > 0 || y.journees > 0))
  console.log(
    `${x.nom.padEnd(24)} ${String(x.journees).padStart(8)}  ${String(x.xps).padStart(4)}  (${x.sflTime} · ${x.titres} · ${x.missions} · ${x.flair} · ${x.flairSaison})`
  );
console.log("");
console.log(`Ilyes : ${ilyes ? `${ilyes.xps} XP S en ${ilyes.journees} journées` : "absent"}`);
console.log(`Médiane : ${mediane(joueurs.map((x) => x.xps))} XP S (réguliers : ${mediane(reguliers.map((x) => x.xps))})`);
console.log(`90e centile : ${centile(joueurs.map((x) => x.xps), 90)} XP S (réguliers : ${centile(reguliers.map((x) => x.xps), 90)})`);
const ouvrent = joueurs.filter((x) => x.xps >= prix);
console.log(`Un tirage à ${prix} XP S dès le lancement : ${ouvrent.length} joueur${ouvrent.length > 1 ? "s" : ""}${ouvrent.length ? ` (${ouvrent.map((x) => `${x.nom} ${x.xps}`).join(", ")})` : ""}.`);
