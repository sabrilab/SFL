// Les XP S : la seconde monnaie, plus rare (Ilyes, 02/11/2026). Les XP
// normales ne changent pas (le Niveau, le Passe) ; les XP S paient les packs
// rares, dont le PACK AFRIQUE 2027 (pack-afrique.ts). Elles se gagnent :
//   · une journée jouée en SFL Time : 10 (la ligne du joueur porte la SFL
//     Time, il a joué : présent, hors Xtratime) ;
//   · une mission de rang S réussie : 10 (le contrat, le défi ; jamais une
//     mission ratée, jamais une mission d'arbitre) ;
//   · le titre MVP : 10 ; Impact et Défensive : 5 chacun, seulement élus à
//     deux voix au moins (Saison.titresFaibles, la règle de la note) ;
//   · le Flair : 2 par choix dur juste (pronos.ts, SUJETS_DURS : MVP du
//     match, duel, écart en bande, buteur, passeur et meilleur du jour), 4 au
//     plus par journée, jamais un choix sur soi ; la tribune au même régime ;
//   · le Flair de saison : 10 par choix juste à la clôture, seulement s'il
//     n'a plus bougé après la J2, jamais sur soi, hors plafond de la journée ;
//   · Bola (un joueur hors de la SFL) : le MVP d'un match validé et ses
//     missions perso de rang S, seulement sur les matchs à confirmation
//     (requise), 13 au plus par semaine (du lundi au dimanche, semaineDe).
//     La semaine est celle où la feuille a été saisie (saisiLe, l'heure du
//     serveur), pas le jour que l'organisateur a déclaré : des matchs
//     antidatés retombaient chacun dans une semaine passée, 13 par semaine
//     d'un coup (contrôle adverse du 02/11 : 39 XP S, 78 avec six matchs).
//     Une feuille saisie plus de sept jours après son match, ou sans heure de
//     saisie, ne donne rien (l'app ne la propose que sept jours).
// Une journée rapporte au plus 13 XP S, toutes sources confondues : ce qui
// dépasse se retire dans cet ordre, le Flair, la Défensive, l'Impact, les
// missions, le MVP, la SFL Time en dernier (le joueur venu ce jour-là voit
// toujours sa ligne). Pour un joueur qui a des matchs Bola, la semaine tient
// lieu de journée, toutes ses sources ensemble : ses matchs Bola et ses
// journées de la SFL de la même semaine (son Flair, sa journée le jour de son
// entrée) n'ont qu'un plafond de 13 (contrôle du 02/11 : 17, puis 26 dans un
// seul dimanche). Le Flair de saison n'entre dans aucun plafond.
//
// Toute l'histoire compte (calcul rétroactif) : les archives puis la saison
// en cours. Une journée ne donne rien tant qu'elle n'est pas révélée : la vue
// figée de la révélation (revelation.ts, journeeComptee : 19 h dès la J5 de
// la saison 1, plus tard si la dernière feuille finit tard) et minuit jusqu'à
// la J4. Rien ne vient du téléphone : le serveur calcule sur la même saison,
// les mêmes réponses et les mêmes pronos (xp-calcul.ts, journalCompletAvecS),
// et fait foi. Les XP S sont à vie : aucune remise à zéro à la clôture.
//
// Pas de double comptage : chaque ligne porte la clé de son événement (une
// clé vue ne compte qu'une fois) ; une mission réussie qui exige un titre
// (Mission.couvre) remplace la ligne de ce titre ; un pronostic sur soi ne
// compte jamais.
//
// Pur : ni React ni réseau.

import { estLeJour, heureDuJour, minuitDuSoir } from "./convocation-temps";
import type { MatchValide } from "./carte-bola";
import { isHidden } from "./hidden";
import type { MatchBola } from "./ligue-vierge";
import type { LigneXp, TitreCouvert } from "./missions";
import { aujourdhuiParis, instantParis, MISSIONS_PERSO, missionsPerso, rangPerso, semaineDe, type MissionFaite } from "./missions-perso";
import { soldeXp } from "./pack-afrique";
import { placeDe } from "./recrues";
import { journeeComptee, nouveauRegime, revelation } from "./revelation";
import { cleTitre } from "./saisie/evolution";
import { journeeJouee } from "./saisie/engine";
import type { MatchEntry, Saison } from "./saisie/types";

/** Le barème des XP S (décisions d'Ilyes, 02/11/2026). */
export const XP_S = {
  sflTime: 10,
  missionS: 10,
  mvp: 10,
  impact: 5,
  def: 5,
  flairDur: 2,
  /** Le Flair d'une journée, au plus. */
  flairJournee: 4,
  flairSaison: 10,
  /** Une journée, toutes sources confondues (le Flair de saison à part). */
  journee: 13,
  /** Une semaine de matchs Bola. */
  semaineBola: 13,
} as const;

export type SourceXpS = "sfl-time" | "mission" | "titre" | "flair" | "flair-saison" | "bola";

/** Une ligne du journal des XP S. */
export interface LigneXpS {
  saison: number;
  j: number;
  /** Le libellé de la journée (« 21 juin »), ou du match Bola (« 22 oct. · 19h30 »). */
  date: string;
  /** Le jour ISO d'un match Bola. */
  jour?: string;
  quoi: string;
  xps: number;
  source: SourceXpS;
  /** La clé de l'événement : une clé ne compte qu'une fois. */
  cle: string;
  /** Le titre d'une ligne de titre (ou du MVP Bola), que couvre une mission. */
  titre?: TitreCouvert;
  /** Le titre qu'exige une mission réussie (Mission.couvre) : sa ligne remplace celle du titre. */
  couvre?: TitreCouvert;
  /** Le match Bola de la ligne. */
  match?: number;
  /** La semaine (son lundi, ISO) dont le plafond compte une ligne Bola : celle où sa feuille a été saisie. */
  semaine?: string;
  /**
   * Quand elle est tombée (ISO) : la révélation de sa journée (minuit
   * jusqu'à la J4), la clôture de sa saison pour un Flair de saison, la
   * saisie de la feuille d'un match Bola (au plus tôt son coup d'envoi).
   * L'annonce ne dit que ce qui vient de tomber.
   */
  le?: string;
  /**
   * La ligne du journal d'XP qu'elle accompagne (rattachementXp) : le journal
   * « Gagner de l'XP » porte ses XP S à droite de son XP, sans liste à part.
   * Les titres et la SFL Time vont avec « Dimanche joué ».
   */
  rattache: string;
}

/** Les XP S de chacun, toutes saisons, par nom de joueur de la saison. */
export type JournalXpS = Map<string, LigneXpS[]>;

/** Ce que journalXpS lit : la saison jugée (vue figée, votes posés), l'instant, mes matchs Bola. */
export interface EntreesXpS {
  jugee: Saison;
  bolaCarte: { nom: string; valides: readonly MatchValide[] } | null;
  maintenant: Date;
}

export const totalXpS = (l: readonly LigneXpS[]) => l.reduce((a, x) => a + x.xps, 0);

/**
 * La clé d'une ligne du journal d'XP à laquelle des XP S se rattachent ;
 * null si aucune ne le peut (félicitations, recrues, défis, risques…).
 */
export function rattachementXp(l: Pick<LigneXp, "saison" | "j" | "date" | "quoi" | "mission" | "bola" | "flairDurs" | "flairSaison">): string | null {
  if (l.bola) return l.mission ? `bola-mission:${l.date}:${l.quoi}` : l.quoi === "Match Bola" ? `bola-match:${l.date}` : null;
  if (l.flairSaison) return `flair-saison:${l.saison}:${l.flairSaison.sujet}`;
  if (l.flairDurs != null) return `flair:${l.saison}:${l.j}`;
  if (l.mission) return l.mission.reussie ? `mission:${l.saison}:${l.j}:${l.quoi}` : null;
  return l.quoi === "Dimanche joué" ? `dimanche:${l.saison}:${l.j}` : null;
}

/** Les XP S de chaque ligne du journal d'XP (rattachementXp → XP S). */
export function xpSParLigne(lignes: readonly LigneXpS[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of lignes) out.set(l.rattache, (out.get(l.rattache) ?? 0) + l.xps);
  return out;
}

/**
 * D'où viennent les XP S d'une ligne du journal d'XP, quand son libellé ne
 * le dit pas : « Dimanche joué » porte la SFL Time et les titres de sa
 * journée, « Match Bola » le MVP du match (contrôle visuel du 02/11 : on
 * lisait qu'un dimanche joué rapporte 10 XP S). Une mission, un Flair se
 * nomment déjà : rien à ajouter. rattachementXp → « SFL Time · MVP ».
 */
export function sourcesParLigne(lignes: readonly LigneXpS[]): Map<string, string> {
  const par = new Map<string, Set<string>>();
  for (const l of lignes) {
    if (!l.rattache.startsWith("dimanche:") && !l.rattache.startsWith("bola-match:")) continue;
    (par.get(l.rattache) ?? par.set(l.rattache, new Set()).get(l.rattache)!).add(sourceCourte(l));
  }
  return new Map([...par].map(([k, v]) => [k, [...v].sort((a, b) => ORDRE_SOURCES.indexOf(a) - ORDRE_SOURCES.indexOf(b)).join(" · ")]));
}

/** Une saison du journal d'XP au-delà des lignes montrées : ses journées, son XP, ses XP S. */
export interface CumulJournal {
  saison: number;
  /** La première et la dernière journée cumulées. */
  de: number;
  a: number;
  xp: number;
  xps: number;
}

/**
 * Le journal « Gagner de l'XP » montre les `montrees` lignes les plus
 * récentes ; le reste se cumule saison par saison, pour que rien ne s'y perde
 * (contrôle visuel du 02/11 : coupé à 20 lignes, le stock rétroactif de la
 * saison 0 disparaissait). `lignes` : du plus récent au plus ancien
 * (bilanDe) ; `xpS` : xpSParLigne. Les cumuls, de la saison la plus récente
 * à la plus ancienne.
 */
export function cumulsDuJournal(
  lignes: readonly Pick<LigneXp, "saison" | "j" | "date" | "quoi" | "xp" | "mission" | "bola" | "flairDurs" | "flairSaison">[],
  montrees: number,
  xpS: ReadonlyMap<string, number>
): CumulJournal[] {
  const par = new Map<number, CumulJournal>();
  for (const l of lignes.slice(montrees)) {
    const c = par.get(l.saison) ?? { saison: l.saison, de: l.j, a: l.j, xp: 0, xps: 0 };
    c.de = Math.min(c.de, l.j);
    c.a = Math.max(c.a, l.j);
    c.xp += l.xp;
    c.xps += xpS.get(rattachementXp(l) ?? "") ?? 0;
    par.set(l.saison, c);
  }
  return [...par.values()].sort((a, b) => b.saison - a.saison);
}

const joue = (e: MatchEntry) => e.statut === "Présent" && !e.extraTime;

/** L'ordre de retrait au plafond : le premier retiré d'abord (la SFL Time en dernier). */
function rangDeRetrait(l: LigneXpS): number {
  if (l.source === "flair") return 0;
  if (l.titre === "def" && l.source === "titre") return 1;
  if (l.titre === "impact" && l.source === "titre") return 2;
  if (l.source === "mission" || (l.source === "bola" && !l.titre)) return 3;
  if (l.titre === "mvp") return 4;
  return 5;
}

/**
 * Les lignes d'une journée (ou d'une semaine Bola), ramenées au plafond : ce
 * qui dépasse se retire dans l'ordre de rangDeRetrait, et, à rang égal, la
 * ligne venue la dernière d'abord. Une ligne réduite garde ce qui reste ; à
 * zéro, elle disparaît.
 */
export function plafonner(lignes: readonly LigneXpS[], plafond: number): LigneXpS[] {
  let trop = totalXpS(lignes) - plafond;
  if (trop <= 0) return [...lignes];
  const ordre = lignes.map((l, i) => ({ l, i })).sort((a, b) => rangDeRetrait(a.l) - rangDeRetrait(b.l) || b.i - a.i);
  const reste = new Map<number, number>();
  for (const { l, i } of ordre) {
    if (trop <= 0) break;
    const retire = Math.min(l.xps, trop);
    reste.set(i, l.xps - retire);
    trop -= retire;
  }
  return lignes.flatMap((l, i) => {
    const xps = reste.get(i) ?? l.xps;
    return xps > 0 ? [xps === l.xps ? l : { ...l, xps }] : [];
  });
}

/** Une mission réussie qui exige un titre remplace sa ligne : la mission reste. */
function sansTitresCouverts(lignes: readonly LigneXpS[], memeEvenement: (titre: LigneXpS, mission: LigneXpS) => boolean): LigneXpS[] {
  const missions = lignes.filter((l) => l.couvre);
  if (!missions.length) return [...lignes];
  return lignes.filter((l) => !(l.titre && missions.some((m) => m.couvre === l.titre && memeEvenement(l, m))));
}

/** Les saisons dans l'ordre : les archives, puis celle en cours (comme le journal d'XP), et l'instant qui fixe l'année des dates. */
function saisonsDe(
  s: Saison,
  maintenant: Date
): { numero: number; lue: Pick<Saison, "journees" | "entries" | "numero" | "titresFaibles">; close: boolean; reference: Date }[] {
  const archives = [...(s.archives ?? [])].sort((a, b) => a.numero - b.numero);
  return [
    ...archives.map((a) => ({ numero: a.numero, lue: { ...a, numero: a.numero }, close: true, reference: new Date(a.cloturee) })),
    { numero: s.numero ?? 0, lue: s, close: false, reference: maintenant },
  ];
}

/**
 * Une journée donne-t-elle ses XP S à l'instant t ? Une saison close : dès
 * qu'elle est jouée. La saison en cours : quand elle compte (journeeComptee,
 * la vue figée de la révélation dès la J5 de la saison 1) ; jusqu'à la J4,
 * une fois son jour passé (minuit, comme ses missions et son Flair). La seule
 * porte : rien d'autre ne se cale sur l'heure.
 */
export function journeeDonneXpS(lue: Pick<Saison, "journees" | "entries" | "numero">, numero: number, j: number, t: Date, close: boolean): boolean {
  if (!journeeJouee(lue, j)) return false;
  if (close) return true;
  const s = { ...lue, numero };
  if (!journeeComptee(s, j, t)) return false;
  if (nouveauRegime(numero, j)) return true;
  const meta = lue.journees.find((m) => m.j === j);
  return !meta || !estLeJour(meta.date, t);
}

/** Une ligne de mission du journal d'XP qui donne des XP S : de rang S, réussie, un créneau du dimanche. */
const missionS = (l: LigneXp) =>
  !!l.mission && l.mission.rang === "S" && l.mission.reussie && (l.mission.creneau === "contrat" || l.mission.creneau === "defi" || l.mission.creneau === "ligue");

/**
 * Une feuille Bola saisie plus de FEUILLE_BOLA_JOURS jours (de calendrier, à
 * Paris) après le jour de son match ne donne pas d'XP S : l'app ne propose
 * la feuille que les sept derniers jours (matchs.ts, listerMesDerniers).
 */
export const FEUILLE_BOLA_JOURS = 7;

/** Le jour de Paris (ISO) d'un instant ISO ; null s'il ne se lit pas. */
function jourParis(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : aujourdhuiParis(new Date(t));
}

/** Les jours de calendrier de a à b (ISO), b après a : positif. */
const joursDe = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * La semaine (son lundi, ISO) dont le plafond compte les XP S d'un match
 * Bola : celle où sa feuille a été saisie la première fois (saisiLe, l'heure
 * du serveur), jamais plus tôt que le jour du match. null : il n'en donne
 * pas (pas d'heure de saisie, une base pas migrée ; ou une feuille saisie
 * plus de FEUILLE_BOLA_JOURS jours après le match).
 */
export function semaineXpSBola(m: Pick<MatchBola, "jour" | "saisiLe">): string | null {
  const saisi = jourParis(m.saisiLe);
  if (!saisi || joursDe(m.jour, saisi) > FEUILLE_BOLA_JOURS) return null;
  return semaineDe(saisi > m.jour ? saisi : m.jour);
}

/**
 * Les XP S d'un joueur Bola, semaine par semaine : le MVP de chaque match à
 * confirmation validé (ex æquo compris), et ses missions perso de rang S
 * réussies sur un tel match ; 13 au plus par semaine, la semaine de la
 * saisie de la feuille (semaineXpSBola). Un match à venir ne compte pas
 * (comme lignesXpBola). `faites` : missionsPerso(valides).faites.
 */
export function lignesXpSBola(
  nom: string,
  valides: readonly MatchValide[],
  faites: readonly MissionFaite[],
  maintenant: Date,
  /** La saison et la journée de la SFL où tombe un jour (placeDe), comme les lignes d'XP Bola. */
  placer: (jour: string) => { saison: number; j: number } = () => ({ saison: 0, j: 0 })
): LigneXpS[] {
  const parId = new Map(valides.map((v) => [v.m.id, v]));
  const passe = (jour: string, heure: string) => instantParis(jour, heure).getTime() <= maintenant.getTime();
  /** Ce qu'un match donne : sa semaine et l'instant où ses XP S tombent (la saisie, au plus tôt le coup d'envoi) ; null s'il ne donne rien. */
  const compte = (v: MatchValide | undefined) => {
    if (!v || !v.m.requise || !passe(v.m.jour, v.m.heure)) return null;
    const semaine = semaineXpSBola(v.m);
    if (!semaine) return null;
    const t = Math.max(instantParis(v.m.jour, v.m.heure).getTime(), Date.parse(v.m.saisiLe!));
    return { semaine, t, le: new Date(t).toISOString() };
  };
  const brut: (LigneXpS & { t: number })[] = [];
  for (const v of valides) {
    const c = v.ligne.mvp ? compte(v) : null;
    if (!c) continue;
    brut.push({
      ...placer(v.m.jour),
      date: v.libelle,
      jour: v.m.jour,
      quoi: "MVP",
      xps: XP_S.mvp,
      source: "bola",
      cle: `bola:mvp:${v.m.id}:${nom}`,
      titre: "mvp",
      match: v.m.id,
      semaine: c.semaine,
      rattache: `bola-match:${v.libelle}`,
      le: c.le,
      t: c.t,
    });
  }
  for (const f of faites) {
    const c = rangPerso({ xp: f.xp }) === "S" ? compte(parId.get(f.matchId)) : null;
    if (!c) continue;
    const m = MISSIONS_PERSO.find((x) => x.genre === f.genre);
    const quoi = `Mission ${m?.code ?? f.genre}`;
    brut.push({
      ...placer(f.jour),
      date: f.libelle,
      jour: f.jour,
      quoi,
      xps: XP_S.missionS,
      source: "bola",
      // Une fois par semaine, comme sa règle (missions-perso.ts).
      cle: `bola:mission:${f.genre}:${f.semaine}:${nom}`,
      ...(m?.couvre ? { couvre: m.couvre } : {}),
      match: f.matchId,
      semaine: c.semaine,
      rattache: `bola-mission:${f.libelle}:${quoi}`,
      le: c.le,
      t: c.t,
    });
  }
  // Dans l'ordre du temps (le plafond retire d'abord la dernière venue), la mission après le MVP de son match.
  brut.sort((a, b) => a.t - b.t || (a.titre ? 0 : 1) - (b.titre ? 0 : 1));
  const vues = new Set<string>();
  const uniques = brut.filter((l) => !vues.has(l.cle) && !!vues.add(l.cle));
  const parSemaine = new Map<string, LigneXpS[]>();
  for (const { t, ...l } of uniques) {
    void t;
    const w = l.semaine!;
    (parSemaine.get(w) ?? parSemaine.set(w, []).get(w)!).push(l);
  }
  const out: LigneXpS[] = [];
  for (const lignes of parSemaine.values()) {
    const sans = sansTitresCouverts(lignes, (titre, mission) => titre.match === mission.match);
    out.push(...plafonner(sans, XP_S.semaineBola));
  }
  return out;
}

/**
 * Le journal des XP S de toute la ligue, toutes saisons : tiré de la saison
 * jugée (titres, SFL Time) et du journal d'XP que journalComplet vient de
 * calculer (missions, Flair), plus mes matchs Bola. Le même résultat au
 * serveur et au téléphone, sur les mêmes entrées.
 */
export function journalXpS(e: EntreesXpS, journal: ReadonlyMap<string, { lignes: readonly LigneXp[] }>): JournalXpS {
  const t = e.maintenant;
  // (saison, j, joueur) → les lignes de la journée ; à part, le Flair de saison.
  const parJournee = new Map<string, LigneXpS[]>();
  const horsPlafond = new Map<string, LigneXpS[]>();
  const vues = new Set<string>();
  const poser = (joueur: string, l: LigneXpS, dans = parJournee) => {
    if (vues.has(l.cle) || l.xps <= 0) return;
    vues.add(l.cle);
    const k = dans === parJournee ? `${l.saison}|${l.j}|${joueur}` : joueur;
    (dans.get(k) ?? dans.set(k, []).get(k)!).push(l);
  };

  // Les journées qui donnent leurs XP S, saison par saison, quand elles sont tombées et leur jour (ISO, Paris).
  const ouvertes = new Map<string, { date: string; le?: string; jour?: string }>();
  const clotures = new Map<number, string>();
  for (const sa of saisonsDe(e.jugee, t)) {
    if (sa.close) clotures.set(sa.numero, sa.reference.toISOString());
    const faibles = new Set(sa.lue.titresFaibles ?? []);
    for (const m of sa.lue.journees) {
      if (!journeeDonneXpS(sa.lue, sa.numero, m.j, t, sa.close)) continue;
      const fin = revelation(m, sa.numero, sa.reference) ?? minuitDuSoir(m.date, sa.reference);
      const le = fin ? fin.toISOString() : undefined;
      const midi = heureDuJour(m.date, sa.reference, 12);
      ouvertes.set(`${sa.numero}|${m.j}`, { date: m.date, ...(le ? { le } : {}), ...(midi ? { jour: aujourdhuiParis(midi) } : {}) });
      for (const x of sa.lue.entries) {
        if (x.j !== m.j || !joue(x) || isHidden(x.player)) continue;
        const base = { saison: sa.numero, j: m.j, date: m.date, rattache: `dimanche:${sa.numero}:${m.j}`, ...(le ? { le } : {}) };
        if (x.sflTime) poser(x.player, { ...base, quoi: "SFL Time", xps: XP_S.sflTime, source: "sfl-time", cle: `sfl-time:${sa.numero}:${m.j}:${x.player}` });
        if (x.mvp) poser(x.player, { ...base, quoi: "MVP", xps: XP_S.mvp, source: "titre", titre: "mvp", cle: `titre:mvp:${sa.numero}:${m.j}:${x.player}` });
        if (x.impact && !faibles.has(cleTitre(m.j, "impact", x.player)))
          poser(x.player, { ...base, quoi: "Impact", xps: XP_S.impact, source: "titre", titre: "impact", cle: `titre:impact:${sa.numero}:${m.j}:${x.player}` });
        if (x.def && !faibles.has(cleTitre(m.j, "def", x.player)))
          poser(x.player, { ...base, quoi: "Défensive", xps: XP_S.def, source: "titre", titre: "def", cle: `titre:def:${sa.numero}:${m.j}:${x.player}` });
      }
    }
  }

  // Les missions de rang S réussies et le Flair, lus sur le journal d'XP (jugés, jamais refaits).
  for (const [joueur, x] of journal) {
    if (isHidden(joueur)) continue;
    for (const l of x.lignes) {
      const rattache = rattachementXp(l);
      if (!rattache) continue;
      if (l.flairSaison) {
        if (l.flairSaison.tot)
          poser(
            joueur,
            {
              saison: l.saison,
              j: l.j,
              date: l.date,
              quoi: l.quoi,
              xps: XP_S.flairSaison,
              source: "flair-saison",
              cle: `flair-saison:${l.saison}:${joueur}:${l.flairSaison.sujet}`,
              rattache,
              ...(clotures.has(l.saison) ? { le: clotures.get(l.saison) } : {}),
            },
            horsPlafond
          );
        continue;
      }
      const ouverte = ouvertes.get(`${l.saison}|${l.j}`);
      if (l.bola || !ouverte) continue;
      const base = { saison: l.saison, j: l.j, date: ouverte.date, rattache, ...(ouverte.le ? { le: ouverte.le } : {}) };
      if (missionS(l))
        poser(joueur, { ...base, quoi: l.quoi, xps: XP_S.missionS, source: "mission", cle: `mission:${l.saison}:${l.j}:${l.mission!.creneau}:${joueur}`, ...(l.mission!.couvre ? { couvre: l.mission!.couvre } : {}) });
      else if (l.flairDurs)
        poser(joueur, { ...base, quoi: "Flair", xps: Math.min(XP_S.flairJournee, l.flairDurs * XP_S.flairDur), source: "flair", cle: `flair:${l.saison}:${l.j}:${joueur}` });
    }
  }

  const out: JournalXpS = new Map();
  const ajouter = (joueur: string, lignes: readonly LigneXpS[]) => {
    if (!lignes.length) return;
    out.set(joueur, [...(out.get(joueur) ?? []), ...lignes]);
  };
  for (const [k, lignes] of parJournee) {
    const joueur = k.slice(k.indexOf("|", k.indexOf("|") + 1) + 1);
    ajouter(joueur, plafonner(sansTitresCouverts(lignes, () => true), XP_S.journee));
  }
  if (e.bolaCarte?.valides.length && !isHidden(e.bolaCarte.nom)) {
    const nom = e.bolaCarte.nom;
    const { faites } = missionsPerso(e.bolaCarte.valides, t);
    const placer = (jour: string) => placeDe(e.jugee, midiDuJour(jour), t);
    const bola = lignesXpSBola(nom, e.bolaCarte.valides, faites, t, placer).filter((l) => !vues.has(l.cle));
    if (bola.length) {
      const semaineSfl = (l: LigneXpS) => {
        const jour = ouvertes.get(`${l.saison}|${l.j}`)?.jour;
        return jour ? semaineDe(jour) : null;
      };
      out.set(nom, plafondCommun(out.get(nom) ?? [], bola, semaineSfl));
    }
  }
  for (const [joueur, lignes] of horsPlafond) ajouter(joueur, lignes);
  return out;
}

/**
 * Un joueur qui a des matchs Bola : un seul plafond par semaine (du lundi au
 * dimanche), toutes ses sources ensemble. Ses journées de la SFL d'une
 * semaine où il a des lignes Bola (le Flair d'un joueur hors de la SFL, la
 * journée d'un filleul le jour de son entrée) et ces lignes Bola ne font que
 * 13 à elles toutes, retirées dans l'ordre du plafond (rangDeRetrait, la
 * dernière venue d'abord). Les autres semaines gardent le plafond de leur
 * journée. `sfl` : ses lignes de journées, déjà ramenées à 13 chacune ;
 * `bola` : ses lignes Bola, déjà à 13 par semaine.
 */
export function plafondCommun(sfl: readonly LigneXpS[], bola: readonly LigneXpS[], semaineSfl: (l: LigneXpS) => string | null): LigneXpS[] {
  const semaines = [...new Set(bola.map((l) => l.semaine!))];
  const dans = (l: LigneXpS, w: string) => semaineSfl(l) === w;
  const out = sfl.filter((l) => !semaines.some((w) => dans(l, w)));
  const quand = (l: LigneXpS) => (l.le ? Date.parse(l.le) : 0) || 0;
  for (const w of semaines) {
    const ensemble = [...sfl.filter((l) => dans(l, w)), ...bola.filter((l) => l.semaine === w)].sort((a, b) => quand(a) - quand(b));
    out.push(...plafonner(ensemble, XP_S.semaineBola));
  }
  return out;
}

/** Midi du jour d'un match, à l'heure de l'appareil : pour le ranger à son dimanche, comme lignesXpBola. */
function midiDuJour(jour: string): Date {
  const [y, m, d] = jour.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Ce qu'un joueur a gagné et peut dépenser en XP S. */
export interface BilanXpS {
  /** Gagnées, à vie. */
  gagne: number;
  /** Gagnées moins dépensées : jamais sous zéro, un achat n'est jamais repris. */
  solde: number;
  /** Le détail, de la plus récente à la plus ancienne. */
  lignes: LigneXpS[];
}

/** Le bilan des XP S d'un joueur, avec ce qu'il a déjà dépensé (achats_xp, monnaie « xp-s »). */
export function bilanXpS(journalS: JournalXpS, nom: string, depense = 0): BilanXpS {
  const lignes = [...(journalS.get(nom) ?? [])].sort((a, b) => b.saison - a.saison || b.j - a.j || (b.jour ?? "").localeCompare(a.jour ?? ""));
  const gagne = totalXpS(lignes);
  return { gagne, solde: soldeXp(gagne, depense), lignes };
}

/* ------------------------------ L'annonce ------------------------------ */

/** Ce que ce téléphone a déjà montré des XP S d'un joueur (sfl-xps-vu) : les clés vues. */
export interface VuXpS {
  nom: string;
  cles: string[];
}

/** Ce qui s'annonce encore : des XP S tombées il y a moins de deux jours. Plus vieilles, elles se lisent sur la tuile. */
export const FENETRE_ANNONCE_MS = 48 * 3600_000;
/** Les clés gardées sur le téléphone, au plus (les plus récentes). */
const CLES_GARDEES = 600;

/** Le nom court d'une source, pour l'annonce : « MVP », « Flair »… */
export function sourceCourte(l: Pick<LigneXpS, "source" | "quoi" | "titre">): string {
  switch (l.source) {
    case "sfl-time":
      return "SFL Time";
    case "titre":
      return l.quoi;
    case "mission":
      return "Mission";
    case "flair":
      return "Flair";
    case "flair-saison":
      return "Flair de saison";
    case "bola":
      return l.titre === "mvp" ? "MVP" : "Mission";
  }
}

const ORDRE_SOURCES = ["SFL Time", "MVP", "Impact", "Défensive", "Mission", "Flair", "Flair de saison"];

/**
 * Les XP S à annoncer, une fois par téléphone (Ma carte, à la révélation) :
 * les lignes que ce téléphone n'a jamais vues et qui viennent de tomber
 * (FENETRE_ANNONCE_MS), leur somme et d'où elles viennent (« MVP ·
 * Flair »). Rien la première fois (le stock d'avant se lit sur la tuile), ni
 * pour un autre joueur, ni pour une vieille ligne qui arrive en retard (des
 * réponses aux missions chargées après coup), ni pour une ligne déjà vue
 * qu'une feuille corrigée retire puis rend. Rend aussi ce qu'il faut garder.
 */
export function annonceXpS(
  nom: string,
  lignes: readonly LigneXpS[],
  vu: VuXpS | null,
  maintenant: Date
): { annonce: { plus: number; sources: string[] } | null; vu: VuXpS } {
  const cles = lignes.map((l) => l.cle);
  if (!vu || vu.nom !== nom) return { annonce: null, vu: { nom, cles: cles.slice(-CLES_GARDEES) } };
  const vues = new Set(vu.cles);
  const t = maintenant.getTime();
  const neuves = lignes.filter((l) => !vues.has(l.cle) && (!l.le || t - Date.parse(l.le) <= FENETRE_ANNONCE_MS));
  const garde = { nom, cles: [...new Set([...vu.cles, ...cles])].slice(-CLES_GARDEES) };
  const plus = totalXpS(neuves);
  if (plus <= 0) return { annonce: null, vu: garde };
  const sources = [...new Set(neuves.map(sourceCourte))].sort((a, b) => ORDRE_SOURCES.indexOf(a) - ORDRE_SOURCES.indexOf(b));
  return { annonce: { plus, sources }, vu: garde };
}
