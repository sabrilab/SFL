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
// Une journée rapporte au plus 13 XP S, toutes sources confondues : ce qui
// dépasse se retire dans cet ordre, le Flair, la Défensive, l'Impact, les
// missions, le MVP, la SFL Time en dernier (le joueur venu ce jour-là voit
// toujours sa ligne). Le Flair de saison n'entre dans aucun plafond.
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

import { estLeJour, minuitDuSoir } from "./convocation-temps";
import type { MatchValide } from "./carte-bola";
import { isHidden } from "./hidden";
import type { LigneXp, TitreCouvert } from "./missions";
import { instantParis, MISSIONS_PERSO, missionsPerso, rangPerso, semaineDe, type MissionFaite } from "./missions-perso";
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
  /**
   * Quand elle est tombée (ISO) : la révélation de sa journée (minuit
   * jusqu'à la J4), la clôture de sa saison pour un Flair de saison, le coup
   * d'envoi d'un match Bola. L'annonce ne dit que ce qui vient de tomber.
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
 * Les XP S d'un joueur Bola, semaine par semaine : le MVP de chaque match à
 * confirmation validé (ex æquo compris), et ses missions perso de rang S
 * réussies sur un tel match ; 13 au plus par semaine. Un match à venir ne
 * compte pas (comme lignesXpBola). `faites` : missionsPerso(valides).faites.
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
  const aConfirmation = (id: number) => !!parId.get(id)?.m.requise;
  const passe = (jour: string, heure: string) => instantParis(jour, heure).getTime() <= maintenant.getTime();
  const brut: (LigneXpS & { t: number })[] = [];
  for (const v of valides) {
    if (!v.ligne.mvp || !v.m.requise || !passe(v.m.jour, v.m.heure)) continue;
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
      rattache: `bola-match:${v.libelle}`,
      le: instantParis(v.m.jour, v.m.heure).toISOString(),
      t: instantParis(v.m.jour, v.m.heure).getTime(),
    });
  }
  for (const f of faites) {
    if (rangPerso({ xp: f.xp }) !== "S" || !aConfirmation(f.matchId) || !passe(f.jour, f.heure)) continue;
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
      rattache: `bola-mission:${f.libelle}:${quoi}`,
      le: instantParis(f.jour, f.heure).toISOString(),
      t: instantParis(f.jour, f.heure).getTime(),
    });
  }
  // Dans l'ordre du temps (le plafond retire d'abord la dernière venue), la mission après le MVP de son match.
  brut.sort((a, b) => a.t - b.t || (a.titre ? 0 : 1) - (b.titre ? 0 : 1));
  const vues = new Set<string>();
  const uniques = brut.filter((l) => !vues.has(l.cle) && !!vues.add(l.cle));
  const parSemaine = new Map<string, LigneXpS[]>();
  for (const { t, ...l } of uniques) {
    void t;
    const w = semaineDe(l.jour!);
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

  // Les journées qui donnent leurs XP S, saison par saison, et quand elles sont tombées.
  const ouvertes = new Map<string, { date: string; le?: string }>();
  const clotures = new Map<number, string>();
  for (const sa of saisonsDe(e.jugee, t)) {
    if (sa.close) clotures.set(sa.numero, sa.reference.toISOString());
    const faibles = new Set(sa.lue.titresFaibles ?? []);
    for (const m of sa.lue.journees) {
      if (!journeeDonneXpS(sa.lue, sa.numero, m.j, t, sa.close)) continue;
      const fin = revelation(m, sa.numero, sa.reference) ?? minuitDuSoir(m.date, sa.reference);
      const le = fin ? fin.toISOString() : undefined;
      ouvertes.set(`${sa.numero}|${m.j}`, { date: m.date, ...(le ? { le } : {}) });
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
  for (const [joueur, lignes] of horsPlafond) ajouter(joueur, lignes);
  if (e.bolaCarte?.valides.length && !isHidden(e.bolaCarte.nom)) {
    const { faites } = missionsPerso(e.bolaCarte.valides, t);
    const placer = (jour: string) => placeDe(e.jugee, midiDuJour(jour), t);
    ajouter(e.bolaCarte.nom, lignesXpSBola(e.bolaCarte.nom, e.bolaCarte.valides, faites, t, placer).filter((l) => !vues.has(l.cle)));
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
