// Le stock de départ des XP S (lib/sfl/xp-s.ts, 02/11/2026) : ce que chacun
// a au lancement, toute l'histoire comptée (Ilyes : « oui, toute l'histoire
// compte »), au barème et aux plafonds du calcul, par le même chemin que le
// serveur (xp-calcul.ts, journalCompletAvecS, sur la vue figée et votes
// posés). Rien n'est écrit nulle part : il lit, il compte, il dit.
//
//   npx tsx tools/xp-s-stock.ts
//     la saison 0 du dépôt (seedSaison : 8 journées du 21 juin au 9 août).
//     Ni missions ni Flair n'existaient : titres et SFL Time seulement.
//   npx tsx tools/xp-s-stock.ts --saison saison.json [--reponses …] [--pronos …] [--votes …]
//                               [--arbitres …] [--non-joueurs …] [--bola …] [--heure ISO]
//     un export de la base, pour mesurer avant le lancement :
//       · --saison : le document de saison (la colonne data de la table
//         saison, archives comprises) ;
//       · --reponses, --pronos, --votes : missions_reponses, pronos et
//         votes_figures (saison en cours), en tableaux JSON ;
//       · --arbitres, --non-joueurs : les noms des profils arbitres
//         (arbitre = true) et de ceux qui ne jouent pas (joue = false), en
//         tableaux JSON : le serveur les masque (hidden.ts), l'outil aussi
//         (contrôle adverse du 02/11 : sans eux, un export les comptait) ;
//       · --bola : la sortie de ligue_vierge() (tous les matchs Bola saisis,
//         avec saisiLe) : chaque joueur Bola y est compté comme le serveur le
//         compterait pour lui (ses lignes carteBola : un filleul, avant son
//         entrée en SFL), et les feuilles arrivées tard sont listées ;
//       · --heure : l'instant du calcul (maintenant par défaut).
//     L'ancienne forme, sans noms (saison.json [reponses] [pronos] [votes]
//     [heure]), marche toujours.
//
// Rend : chaque joueur (XP S gagnées, dont SFL Time, titres, missions, Flair,
// Flair de saison, Bola), la médiane et le 90e centile de ceux qui ont joué
// au moins une journée, ceux des réguliers (5 journées au moins), le nombre
// de journées en SFL Time, les matchs Bola saisis tard (plus de 48 h après
// leur coup d'envoi ; plus de sept jours après leur jour, ils ne donnent rien
// en XP S), et qui peut ouvrir un tirage du Pack Afrique 2027 dès le lancement.

import { readFileSync } from "node:fs";
import { carteBola } from "../src/lib/sfl/carte-bola";
import { definirArbitres, definirNonJoueurs, isHidden } from "../src/lib/sfl/hidden";
import { compterMatchs, type MatchBola } from "../src/lib/sfl/ligue-vierge";
import { instantParis } from "../src/lib/sfl/missions-perso";
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
import { journalCompletAvecS, type EntreesXp } from "../src/lib/sfl/xp-calcul";
import { semaineXpSBola, totalXpS, XP_S, type LigneXpS } from "../src/lib/sfl/xp-s";

/** Les arguments : nommés (--saison …), ou l'ancienne forme par position. */
function lireArguments(argv: string[]): Record<string, string | undefined> {
  if (!argv.some((a) => a.startsWith("--"))) {
    const [saison, reponses, pronos, votes, heure] = argv;
    return { saison, reponses, pronos, votes, heure };
  }
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) throw new Error(`Argument inattendu : ${argv[i]}`);
    out[argv[i].slice(2)] = argv[++i];
  }
  return out;
}

const args = lireArguments(process.argv.slice(2));
const lireJson = <T>(f: string | undefined, defaut: T): T => (f ? (JSON.parse(readFileSync(f, "utf8")) as T) : defaut);
const maintenant = args.heure ? new Date(args.heure) : new Date();
const document: Saison = args.saison ? lireJson<Saison>(args.saison, seedSaison()) : seedSaison();
const reponses = lireJson<Reponse[]>(args.reponses, []);
const pronos = lireJson<Prono[]>(args.pronos, []);
const votes = lireJson<VoteFigure[]>(args.votes, []);
const matchsBola = lireJson<MatchBola[]>(args.bola, []);
// Masqués comme au serveur (lireSaisonServeur, chargerArbitresServeur) : ni XP ni XP S.
definirArbitres(lireJson<string[]>(args.arbitres, []));
if (args["non-joueurs"]) definirNonJoueurs(lireJson<string[]>(args["non-joueurs"], []));

// La saison telle que le serveur la lit (lireSaisonServeur) : sans brouillons, votes posés, figée.
const jugee = figer(saisonAvecVotes(sansBrouillons(document), votes, maintenant), maintenant);
const entrees: EntreesXp = { jugee, reponses, votes, felicitations: [], pronos, ligueRecrues: [], moi: null, bolaCarte: null, maintenant };
const { journalS } = journalCompletAvecS(entrees);

// Les joueurs Bola de l'export : chacun comme le serveur le calcule pour lui (xpServeur : mes_matchs_bola, ses lignes carteBola).
const comptes = compterMatchs(matchsBola);
const joueursBola = new Map<string, string>();
for (const m of matchsBola) for (const j of m.joueurs) if (j.carteBola && !isHidden(j.name)) joueursBola.set(j.id, j.name);
const bolaDe = new Map<string, LigneXpS[]>();
for (const [id, nom] of joueursBola) {
  const siens = comptes.filter((m) => m.joueurs.some((j) => j.id === id && j.carteBola));
  const carte = carteBola(siens, id, nom, null);
  if (!carte.valides.length) continue;
  bolaDe.set(nom, journalCompletAvecS({ ...entrees, bolaCarte: carte }).journalS.get(nom) ?? []);
}
const lignesDe = (n: string) => bolaDe.get(n) ?? journalS.get(n) ?? [];

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
    for (const n of new Set(lue.entries.filter((e) => e.j === m.j && joue(e) && !isHidden(e.player)).map((e) => e.player))) jouees.set(n, (jouees.get(n) ?? 0) + 1);
  }
}

const par = (l: readonly LigneXpS[], f: (x: LigneXpS) => boolean) => totalXpS(l.filter(f));
const lignes = [...new Set([...jouees.keys(), ...journalS.keys(), ...bolaDe.keys()])]
  .filter((n) => !isHidden(n))
  .map((n) => {
    const l = lignesDe(n);
    return {
      nom: n,
      journees: jouees.get(n) ?? 0,
      bola: bolaDe.has(n),
      xps: totalXpS(l),
      sflTime: par(l, (x) => x.source === "sfl-time"),
      titres: par(l, (x) => x.source === "titre"),
      missions: par(l, (x) => x.source === "mission"),
      flair: par(l, (x) => x.source === "flair"),
      flairSaison: par(l, (x) => x.source === "flair-saison"),
      matchsBola: par(l, (x) => x.source === "bola"),
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

console.log(`Stock de départ des XP S — ${args.saison ? args.saison : "la saison 0 du dépôt (seedSaison)"}, calculé le ${maintenant.toISOString()}`);
console.log(`Barème : SFL Time ${XP_S.sflTime}, mission S ${XP_S.missionS}, MVP ${XP_S.mvp}, Impact et Défensive ${XP_S.impact} (deux voix au moins), Flair ${XP_S.flairDur} par dur (${XP_S.flairJournee} au plus), Flair de saison ${XP_S.flairSaison} ; ${XP_S.journee} par journée, ${XP_S.semaineBola} par semaine pour un joueur Bola.`);
console.log(`Journées jouées : ${journees}, dont ${journeesSfl} en SFL Time ; ${joueurs.length} joueurs ont joué, ${reguliers.length} au moins 5 journées ; ${bolaDe.size} joueur${bolaDe.size > 1 ? "s" : ""} Bola.`);
console.log("");
console.log("joueur                   journées  XP S  (SFL Time · titres · missions · Flair · Flair de saison · Bola)");
for (const x of lignes.filter((y) => y.xps > 0 || y.journees > 0))
  console.log(
    `${(x.nom + (x.bola ? " (Bola)" : "")).padEnd(24)} ${String(x.journees).padStart(8)}  ${String(x.xps).padStart(4)}  (${x.sflTime} · ${x.titres} · ${x.missions} · ${x.flair} · ${x.flairSaison} · ${x.matchsBola})`
  );
console.log("");
console.log(`Ilyes : ${ilyes ? `${ilyes.xps} XP S en ${ilyes.journees} journées` : "absent"}`);
console.log(`Médiane : ${mediane(joueurs.map((x) => x.xps))} XP S (réguliers : ${mediane(reguliers.map((x) => x.xps))})`);
console.log(`90e centile : ${centile(joueurs.map((x) => x.xps), 90)} XP S (réguliers : ${centile(reguliers.map((x) => x.xps), 90)})`);
const ouvrent = lignes.filter((x) => x.xps >= prix);
console.log(`Un tirage à ${prix} XP S dès le lancement : ${ouvrent.length} joueur${ouvrent.length > 1 ? "s" : ""}${ouvrent.length ? ` (${ouvrent.map((x) => `${x.nom} ${x.xps}`).join(", ")})` : ""}.`);

// Les feuilles Bola arrivées tard (contrôle adverse du 02/11 : des matchs antidatés). Plus de sept jours après le jour du match, elles ne donnent rien.
if (matchsBola.length) {
  const tard = matchsBola
    .filter((m) => m.saisiLe && Date.parse(m.saisiLe) - instantParis(m.jour, m.heure).getTime() > 48 * 3600_000)
    .sort((a, b) => a.id - b.id);
  const sans = matchsBola.filter((m) => !m.saisiLe).length;
  console.log("");
  console.log(`Matchs Bola : ${matchsBola.length}, dont ${tard.length} saisis plus de 48 h après leur coup d'envoi${sans ? ` et ${sans} sans heure de saisie (export d'avant la migration : aucune XP S)` : ""}.`);
  for (const m of tard)
    console.log(
      `  match ${m.id} du ${m.jour} ${m.heure}, saisi le ${m.saisiLe} : ${semaineXpSBola(m) ? "compté à la semaine de sa saisie" : "aucune XP S (plus de sept jours)"} · ${m.joueurs.map((j) => j.name).join(", ")}`
    );
}
