// Les missions du dimanche : trois par joueur, tirées de la feuille de match.
//
// Sabri, 22/10 : des missions qui partent de la rivalité (« bloquer » un
// joueur, ne lui laisser que tant de buts et de passes D ; « un contrat sur
// la tête d'un joueur »), que chacun accepte ou non, et qui fonctionnent dès
// que les feuilles de match sont faites. Elles ne donnent jamais de point
// Pépite (règle du fondateur, dossier BOLA 07 §2 : « Les quêtes ne rapportent
// jamais de PP ») : elles donnent de l'XP, qui fait le niveau à vie et le
// passe de la saison. Le terrain fait la note ; l'app fait le niveau.
//
// Le dimanche des missions, c'est la dernière journée qui a des équipes :
//   · ses équipes faites, les missions existent ; chacun accepte ou passe
//     jusqu'au coup d'envoi (table missions_reponses) ;
//   · la feuille remplie, le verdict tombe ; il devient définitif à minuit,
//     quand le vote Impact et Défensive se ferme (les titres comptent dans les
//     points du jour).
//
// Les trois créneaux :
//   · le contrat, contre ton rival. Sur chaque terrain, les duels se forment
//     du haut vers le bas : le mieux classé avant ce dimanche affronte le plus
//     proche de lui dans l'équipe d'en face, tant que l'écart reste de 5
//     points ou moins. Contre un rival qui marque, le contrat est « tiens-le »
//     (ses buts et passes D sous un seuil calé sur ses dimanches) ; sinon
//     « finis devant lui » (plus de points que lui ce dimanche-là). Sans duel :
//     « passe devant » le joueur juste devant toi au classement ; le premier,
//     « reste en tête » ;
//   · le défi du dimanche, le même pour tous, qui tourne d'une journée à
//     l'autre : gagnez, deux passes D, bats ton record ;
//   · la ligue : voter Impact et Défensive le soir du match.
//
// La prime suit la cote : environ 50 XP divisés par la chance de réussite,
// mesurée sur les dimanches des saisons 0 et 1. Jouer le dimanche rapporte
// 100 XP, sans mission ; trois sur trois, 150 de plus.
//
// Les Missions Bola (Sabri, 23/10) : chaque mission a un rang, S, A ou B,
// qui suit la prime ; et accepter engage : une mission acceptée puis ratée
// coûte la moitié de sa prime. Passer ne coûte rien.
//
// Pur : ni React ni réseau. Les réponses et les votes arrivent en paramètres.

import { computeJournees, computeStandings, entryPP } from "./saisie/engine";
import { journeeJouee } from "./saisie/mutations";
import { isHidden } from "./hidden";
import { ovr, type Player } from "./engine";
import type { MatchEntry, Saison, SaisonArchivee } from "./saisie/types";

/* ------------------------------- Le barème ------------------------------- */

export type Creneau = "contrat" | "defi" | "ligue";
export const CRENEAUX: Creneau[] = ["contrat", "defi", "ligue"];

export type Genre =
  | "finis-devant"
  | "tiens-le"
  | "passe-devant"
  | "reste-en-tete"
  | "gagnez"
  | "deux-passes"
  | "record"
  | "vote";

/** La prime de chaque mission réussie, en XP. */
export const PRIME: Record<Genre, number> = {
  "finis-devant": 110,
  "tiens-le": 130,
  "passe-devant": 200,
  "reste-en-tete": 110,
  gagnez: 100,
  "deux-passes": 120,
  record: 150,
  vote: 30,
};

/**
 * Le risque d'une mission acceptée : ratée, elle coûte la moitié de sa prime
 * (Sabri, 23/10 : « quand on perd des missions, on doit perdre aussi des
 * XP », pour qu'accepter engage). Passée ou annulée, elle ne coûte rien.
 */
export const risqueDe = (m: Pick<Mission, "xp">) => Math.round(m.xp / 10) * 5;

/**
 * Le rang d'une mission, comme dans un battle royale (Sabri, 23/10 : « des
 * missions de rang S, des missions de rang A/B, des plus difficiles, moins
 * difficiles »). La prime suit la cote, le rang suit la prime : S, moins de
 * deux chances sur cinq ; A, autour d'une sur deux ; B, ce qui ne dépend que
 * de toi.
 */
export type Rang = "S" | "A" | "B";
export const rangDe = (m: Pick<Mission, "xp">): Rang => (m.xp >= 130 ? "S" : m.xp >= 100 ? "A" : "B");

/** Le nom de code de chaque mission, en tête de sa fiche de contrat. */
export const NOM_DE_CODE: Record<Genre, string> = {
  "tiens-le": "Verrou",
  "finis-devant": "Duel",
  "passe-devant": "Remontada",
  "reste-en-tete": "Couronne",
  gagnez: "Victoire",
  "deux-passes": "Double caviar",
  record: "Record",
  vote: "Jury",
};

/** Jouer un dimanche, dans une équipe de la feuille. */
export const XP_DIMANCHE = 100;
/** Les trois missions réussies le même dimanche. */
export const XP_PARFAIT = 150;
/** Un palier du passe de saison. */
export const XP_PALIER = 250;
export const PALIERS_PASSE = 20;
/** L'écart le plus grand entre deux rivaux d'un duel, en points Pépite. */
export const ECART_DUEL = 5;
/** Les crans du cadre de la carte, en missions réussies. */
export const CRANS = [3, 9, 18, 30] as const;
/**
 * Les félicitations des Actus (table felicitations) : reçues, 10 XP chacune,
 * 5 comptées par exploit et 100 XP au plus par journée, jamais plus que jouer ;
 * données, 2 XP, 10 comptées par journée, pour qu'on ne clique pas partout.
 */
export const XP_FELICITATION_RECUE = 10;
export const FELICITATIONS_PAR_EXPLOIT = 5;
export const XP_FELICITATIONS_JOURNEE = 100;
export const XP_FELICITATION_DONNEE = 2;
export const FELICITATIONS_DONNEES_JOURNEE = 10;

/* ------------------------------- Les types ------------------------------- */

export interface Mission {
  creneau: Creneau;
  genre: Genre;
  /** Ceux qu'elle vise : le rival, ou ceux à dépasser. */
  cibles: string[];
  /** Tiens-le : ses buts et passes D, au plus. Record : tes points, à dépasser. */
  seuil?: number;
  xp: number;
}

export interface Duel {
  /** Le terrain, compté de 0. */
  terrain: number;
  label: string;
  noirs: string;
  blancs: string;
}

export interface Camp {
  terrain: number;
  label: string;
  equipe: "noirs" | "blancs";
}

export interface DimancheMissions {
  saison: number;
  j: number;
  date: string;
  heure: string;
  coupEnvoi: Date;
  /** Minuit à Paris, le soir du match : le verdict devient définitif. */
  finDuJour: Date;
  /** La feuille porte des résultats. */
  joue: boolean;
  /** Le vote Impact et Défensive a lieu ce jour-là (journée au MVP calculé). */
  vote: boolean;
  /** Les points Pépite de chacun avant ce dimanche. */
  avant: Map<string, number>;
  duels: Duel[];
  /** Les missions de chaque joueur de la feuille (masqués exclus). */
  missions: Map<string, Mission[]>;
  camps: Map<string, Camp>;
}

/** Une réponse à une mission, telle que la base la garde (missions_reponses). */
export interface Reponse {
  saison: number;
  j: number;
  mission: Creneau;
  joueur: string;
  reponse: "acceptee" | "passee";
  /** Le rival du contrat au moment d'accepter : si la feuille change, le contrat tombe. */
  cible: string | null;
  /** L'heure de la base, pas celle du téléphone. */
  le: string;
}

/** Ce qu'il faut d'un vote pour juger la mission de la ligue. */
export interface VoteLeger {
  saison: number;
  j: number;
  categorie: string;
  votant: string;
}

/** Une félicitation, telle que l'XP la lit : de qui, à qui (noms de saison), pour quel exploit. */
export interface FelicitationXp {
  de: string;
  a: string;
  exploit: string;
  saison: number;
  j: number;
}

export type Etat = "reussie" | "ratee" | "annulee" | "en-jeu";

export interface Verdict {
  etat: Etat;
  /** Ce que l'app a lu : « 9 points contre 6 ». */
  detail: string;
}

/** Une saison telle que le moteur la lit : celle en cours, ou une archive. */
type SaisonLue = Pick<Saison, "journees" | "entries" | "roster"> & Partial<Pick<Saison, "convocations">>;

/* --------------------------------- L'heure --------------------------------- */

const HEURE_PAR_DEFAUT = "13h00";
const MOIS = ["jan", "fev", "mar", "avr", "mai", "juin", "juil", "aou", "sep", "oct", "nov", "dec"];

/** Jour et mois d'un libellé de journée, « 25 oct. » ou « 25 octobre ». */
function jourMois(libelle: string): { jour: number; mois: number } | null {
  const m = libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .match(/(\d{1,2})\s*([a-z]{3,})/);
  if (!m) return null;
  const mois = MOIS.findIndex((p) => m[2].startsWith(p));
  return mois < 0 ? null : { jour: Number(m[1]), mois: mois + 1 };
}

/** De combien Paris est en avance sur l'heure universelle à cet instant, en ms. */
function avanceParis(utc: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(new Date(utc));
  const v = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute")) - Math.floor(utc / 60000) * 60000;
}

/** L'instant d'une heure de Paris (le jour peut déborder : 32 octobre = 1er novembre). */
export function dateDeParis(annee: number, mois: number, jour: number, heure = 0, minute = 0): Date {
  const naif = Date.UTC(annee, mois - 1, jour, heure, minute);
  let t = naif - avanceParis(naif);
  const corrige = naif - avanceParis(t);
  if (corrige !== t) t = corrige;
  return new Date(t);
}

/** « 13h00 », « 18h30 », « 13:30 » → heures et minutes. */
function lireHeure(h: string): [number, number] {
  const m = h.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
  return m ? [Number(m[1]), Number(m[2] ?? 0)] : [13, 0];
}

/** L'année d'un « 25 oct. » : la plus proche de la date de référence. */
function anneeProche(jour: number, mois: number, reference: Date): number {
  const a = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric" }).format(reference));
  return [a - 1, a, a + 1].reduce((best, y) =>
    Math.abs(dateDeParis(y, mois, jour, 12).getTime() - reference.getTime()) <
    Math.abs(dateDeParis(best, mois, jour, 12).getTime() - reference.getTime())
      ? y
      : best
  );
}

/** L'heure du coup d'envoi d'une journée : la sienne, sinon celle de la convocation du même jour. */
function heureDe(s: SaisonLue, j: number): string {
  const meta = s.journees.find((m) => m.j === j);
  if (meta?.heure) return meta.heure;
  const jm = meta ? jourMois(meta.date) : null;
  const conv = jm
    ? (s.convocations ?? []).find((c) => {
        const x = jourMois(c.date);
        return x && x.jour === jm.jour && x.mois === jm.mois;
      })
    : undefined;
  return conv?.heure ?? HEURE_PAR_DEFAUT;
}

/* ------------------------------- Les chiffres ------------------------------ */

const joue = (e: MatchEntry) => e.statut === "Présent" && !e.extraTime;
/** Il a joué la journée j : les XP_DIMANCHE de son journal. */
export const aJoue = (s: { entries: MatchEntry[] }, j: number, nom: string) =>
  s.entries.some((e) => e.j === j && e.player === nom && joue(e));
/** Une ligne dont le résultat est saisi : on peut la juger. */
const saisie = (e: MatchEntry | undefined) => !!e && (!!e.result || e.buts > 0 || e.passes > 0);

function pointsAvant(s: SaisonLue, j: number): Map<string, number> {
  const avant = computeStandings({ ...(s as Saison), entries: s.entries.filter((e) => e.j < j) });
  return new Map(avant.map((p) => [p.name, p.pp]));
}

/**
 * Le seuil de « tiens-le » : les buts et passes D que le rival ne doit pas
 * dépasser, calé sur ses dimanches pour qu'il les tienne à peu près une fois
 * sur deux (au plus près de 45 %). null s'il marque trop peu pour que le
 * contrat ait un sens, ou s'il a trop peu joué pour le savoir.
 */
export function seuilTiensLe(sesDimanches: number[]): number | null {
  if (sesDimanches.length < 3) return null;
  const moyenne = sesDimanches.reduce((a, b) => a + b, 0) / sesDimanches.length;
  if (moyenne < 1.5) return null;
  let meilleur = 1;
  let ecart = Infinity;
  for (let t = 1; t <= Math.max(...sesDimanches); t++) {
    const part = sesDimanches.filter((x) => x <= t).length / sesDimanches.length;
    if (Math.abs(part - 0.45) < ecart) {
      ecart = Math.abs(part - 0.45);
      meilleur = t;
    }
  }
  return meilleur;
}

/* ------------------------------ Les missions ------------------------------ */

/** Le défi du dimanche, le même pour tous : il tourne d'une journée à l'autre. */
export function defiDuDimanche(j: number): "gagnez" | "deux-passes" | "record" {
  return (["gagnez", "deux-passes", "record"] as const)[j % 3];
}

/**
 * Les missions d'une journée ; null tant que ses équipes ne sont pas faites.
 * `passe` : les lignes des saisons d'avant (archives), pour les seuils et les
 * records. `reference` : l'instant qui fixe l'année des dates (maintenant pour
 * la saison en cours, la clôture pour une archive).
 */
export function missionsDeJournee(
  s: SaisonLue,
  numero: number,
  j: number,
  reference: Date,
  passe: MatchEntry[] = []
): DimancheMissions | null {
  const meta = s.journees.find((m) => m.j === j);
  const journee = computeJournees(s as Saison).find((x) => x.j === j);
  if (!meta || !journee?.matches?.length) return null;

  const jm = jourMois(meta.date);
  const heure = heureDe(s, j);
  const [h, min] = lireHeure(heure);
  const annee = jm ? anneeProche(jm.jour, jm.mois, reference) : 2026;
  const coupEnvoi = jm ? dateDeParis(annee, jm.mois, jm.jour, h, min) : new Date(0);
  const finDuJour = jm ? dateDeParis(annee, jm.mois, jm.jour + 1) : new Date(0);

  const avant = pointsAvant(s, j);
  const notes = new Map<string, number>(
    s.roster.map((r) => {
      const b = r.base && r.base.length === 6 ? r.base : [75, 75, 75, 75, 75, 75];
      return [r.name, ovr({ VIT: b[0], TIR: b[1], PAS: b[2], DRI: b[3], DEF: b[4], PHY: b[5] })];
    })
  );
  const pp = (n: string) => avant.get(n) ?? 0;
  const note = (n: string) => notes.get(n) ?? 75;

  // Les dimanches de chacun jusque-là : buts + passes D, et points du jour.
  const historique = [...passe, ...s.entries.filter((e) => e.j < j)].filter(joue);
  const bpd = new Map<string, number[]>();
  const record = new Map<string, number>();
  for (const e of historique) {
    bpd.set(e.player, [...(bpd.get(e.player) ?? []), e.buts + e.passes]);
    record.set(e.player, Math.max(record.get(e.player) ?? -Infinity, entryPP(e)));
  }

  // Les duels, terrain par terrain, du haut vers le bas.
  const duels: Duel[] = [];
  const camps = new Map<string, Camp>();
  const rival = new Map<string, string>();
  journee.matches.forEach((m, t) => {
    const noirs = m.teamA.players.map((p) => p.name).filter((n) => !isHidden(n));
    const blancs = m.teamB.players.map((p) => p.name).filter((n) => !isHidden(n));
    const label = journee.matches!.length > 1 ? `Terrain ${t + 1}` : "Le match";
    noirs.forEach((n) => camps.set(n, { terrain: t, label, equipe: "noirs" }));
    blancs.forEach((n) => camps.set(n, { terrain: t, label, equipe: "blancs" }));
    const tous = [...noirs, ...blancs].sort((a, b) => pp(b) - pp(a) || note(b) - note(a) || a.localeCompare(b));
    for (const a of tous) {
      if (rival.has(a)) continue;
      const enFace = (noirs.includes(a) ? blancs : noirs).filter((b) => !rival.has(b));
      const b = enFace.sort(
        (x, y) =>
          Math.abs(pp(a) - pp(x)) - Math.abs(pp(a) - pp(y)) ||
          Math.abs(note(a) - note(x)) - Math.abs(note(a) - note(y)) ||
          pp(y) - pp(x) ||
          x.localeCompare(y)
      )[0];
      if (!b || Math.abs(pp(a) - pp(b)) > ECART_DUEL) continue;
      rival.set(a, b);
      rival.set(b, a);
      const [n, bl] = noirs.includes(a) ? [a, b] : [b, a];
      duels.push({ terrain: t, label, noirs: n, blancs: bl });
    }
  });

  // Le classement d'avant, pour « passe devant » (masqués exclus).
  const classes = [...avant.entries()].filter(([n]) => !isHidden(n));
  const defi = defiDuDimanche(j);
  const missions = new Map<string, Mission[]>();
  for (const nom of camps.keys()) {
    const liste: Mission[] = [];
    const r = rival.get(nom);
    if (r) {
      const seuil = seuilTiensLe(bpd.get(r) ?? []);
      liste.push(
        seuil != null
          ? { creneau: "contrat", genre: "tiens-le", cibles: [r], seuil, xp: PRIME["tiens-le"] }
          : { creneau: "contrat", genre: "finis-devant", cibles: [r], xp: PRIME["finis-devant"] }
      );
    } else {
      const devant = classes.filter(([, p]) => p > pp(nom)).map(([, p]) => p);
      if (devant.length) {
        const cran = Math.min(...devant);
        const cibles = classes.filter(([, p]) => p === cran).map(([n]) => n).sort();
        liste.push({ creneau: "contrat", genre: "passe-devant", cibles, xp: PRIME["passe-devant"] });
      } else {
        liste.push({ creneau: "contrat", genre: "reste-en-tete", cibles: [], xp: PRIME["reste-en-tete"] });
      }
    }
    const rec = record.get(nom);
    if (defi === "record" && rec != null && rec > -Infinity) {
      liste.push({ creneau: "defi", genre: "record", cibles: [], seuil: rec, xp: PRIME.record });
    } else if (defi === "deux-passes") {
      liste.push({ creneau: "defi", genre: "deux-passes", cibles: [], seuil: 2, xp: PRIME["deux-passes"] });
    } else {
      liste.push({ creneau: "defi", genre: "gagnez", cibles: [], xp: PRIME.gagnez });
    }
    if (journee.mvpAuto) liste.push({ creneau: "ligue", genre: "vote", cibles: [], xp: PRIME.vote });
    missions.set(nom, liste);
  }

  return {
    saison: numero,
    j,
    date: meta.date,
    heure,
    coupEnvoi,
    finDuJour,
    joue: journeeJouee(s, j),
    vote: !!journee.mvpAuto,
    avant,
    duels,
    missions,
    camps,
  };
}

/** Le dimanche des missions de la saison en cours : la dernière journée qui a des équipes. */
export function dimancheEnCours(s: Saison, maintenant: Date): DimancheMissions | null {
  const passe = (s.archives ?? []).flatMap((a) => a.entries);
  const js = [...s.journees].map((m) => m.j).sort((a, b) => b - a);
  for (const j of js) {
    const d = missionsDeJournee(s, s.numero ?? 0, j, maintenant, passe);
    if (d) return d;
  }
  return null;
}

/* ------------------------------- Le verdict ------------------------------- */

const pl = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 || n === 0 ? plusieurs : un}`;
const prenom = (n: string) => n.split(" ")[0];

/**
 * Le verdict d'une mission, sur la feuille telle qu'elle est. Tant que la
 * journée n'est pas finie (minuit), il peut encore bouger : les titres du
 * vote comptent dans les points du jour.
 */
export function juger(
  m: Mission,
  joueur: string,
  d: DimancheMissions,
  s: SaisonLue,
  votes: VoteLeger[] = []
): Verdict {
  const ligne = (n: string) => s.entries.find((e) => e.j === d.j && e.player === n && joue(e));
  const moi = ligne(joueur);
  if (!moi) return { etat: "annulee", detail: "Pas sur la feuille" };

  switch (m.genre) {
    case "finis-devant": {
      const r = ligne(m.cibles[0]);
      if (!r) return { etat: "annulee", detail: `${prenom(m.cibles[0])} n'a pas joué` };
      if (!saisie(moi) || !saisie(r)) return { etat: "en-jeu", detail: "" };
      const a = entryPP(moi);
      const b = entryPP(r);
      return { etat: a > b ? "reussie" : "ratee", detail: `${pl(a, "point", "points")} contre ${b}` };
    }
    case "tiens-le": {
      const r = ligne(m.cibles[0]);
      if (!r) return { etat: "annulee", detail: `${prenom(m.cibles[0])} n'a pas joué` };
      if (!saisie(r) && !r.result) return { etat: "en-jeu", detail: "" };
      const x = r.buts + r.passes;
      return {
        etat: x <= (m.seuil ?? 0) ? "reussie" : "ratee",
        detail: `${prenom(m.cibles[0])} : ${pl(x, "but ou passe\u00a0D", "buts et passes\u00a0D")}`,
      };
    }
    case "passe-devant":
    case "reste-en-tete": {
      if (!saisie(moi)) return { etat: "en-jeu", detail: "" };
      const apres = computeStandings({ ...(s as Saison), entries: s.entries.filter((e) => e.j <= d.j) });
      const pts = new Map(apres.map((p) => [p.name, p.pp]));
      const mien = pts.get(joueur) ?? 0;
      if (m.genre === "passe-devant") {
        const leur = Math.max(...m.cibles.map((c) => pts.get(c) ?? 0));
        return { etat: mien > leur ? "reussie" : "ratee", detail: `${pl(mien, "point", "points")} contre ${leur}` };
      }
      const devant = apres.filter((p) => !isHidden(p.name) && p.name !== joueur && p.pp > mien);
      return devant.length
        ? { etat: "ratee", detail: `${prenom(devant[0].name)} passe devant` }
        : { etat: "reussie", detail: `Toujours en tête, ${pl(mien, "point", "points")}` };
    }
    case "gagnez": {
      if (!moi.result) return { etat: "en-jeu", detail: "" };
      return { etat: moi.result === "Victoire" ? "reussie" : "ratee", detail: moi.result };
    }
    case "deux-passes": {
      if (!saisie(moi)) return { etat: "en-jeu", detail: "" };
      return { etat: moi.passes >= 2 ? "reussie" : "ratee", detail: pl(moi.passes, "passe\u00a0D", "passes\u00a0D") };
    }
    case "record": {
      if (!saisie(moi)) return { etat: "en-jeu", detail: "" };
      const a = entryPP(moi);
      return { etat: a > (m.seuil ?? 0) ? "reussie" : "ratee", detail: `${pl(a, "point", "points")}, record ${m.seuil}` };
    }
    case "vote": {
      const faits = new Set(
        votes.filter((v) => v.saison === d.saison && v.j === d.j && v.votant === joueur).map((v) => v.categorie)
      );
      if (faits.has("impact") && faits.has("def")) return { etat: "reussie", detail: "Impact et Défensive votés" };
      return { etat: "en-jeu", detail: faits.size ? "Un vote sur deux" : "" };
    }
  }
}

/**
 * Le verdict une fois la journée finie. Le vote se ferme à minuit : pas voté,
 * c'est raté. Le reste se lit sur la feuille : tant qu'il y manque une ligne,
 * la mission attend, sans prime ni perte, et se juge dès que l'admin la remplit.
 */
export function verdictFinal(v: Verdict, m: Pick<Mission, "genre">): Verdict {
  return v.etat === "en-jeu" && m.genre === "vote" ? { etat: "ratee", detail: v.detail || "Pas voté" } : v;
}

/** La réponse qui compte : donnée avant le coup d'envoi, et pour le même rival. */
export function reponseDe(reponses: Reponse[], d: DimancheMissions, joueur: string, m: Mission): Reponse | null {
  const r = reponses.find(
    (x) => x.saison === d.saison && x.j === d.j && x.joueur === joueur && x.mission === m.creneau
  );
  if (!r) return null;
  if (new Date(r.le).getTime() > d.coupEnvoi.getTime()) return null;
  if (m.creneau === "contrat" && r.cible && r.cible !== (m.cibles[0] ?? null)) return null;
  return r;
}

/* --------------------------------- L'XP --------------------------------- */

export interface LigneXp {
  saison: number;
  j: number;
  date: string;
  quoi: string;
  xp: number;
}

export interface BilanXp {
  /** À vie. */
  total: number;
  /** Gagnés dans la saison en cours : le passe. */
  saison: number;
  niveau: number;
  /** Dans le niveau en cours, et ce qu'il faut pour le suivant (100 × niveau). */
  dansLeNiveau: number;
  pourLeSuivant: number;
  /**
   * Le palier du passe atteint (0 à 20) : un palier atteint reste acquis, même
   * si un contrat raté fait redescendre l'XP de la saison. Puis l'XP déjà faite
   * vers le suivant, et celle qui lui manque encore.
   */
  palier: number;
  versPalier: number;
  manquePalier: number;
  /** Les missions réussies, à vie : les crans du cadre. */
  reussies: number;
  cran: number;
  /** Le détail, du plus récent au plus ancien. */
  lignes: LigneXp[];
}

/** Le niveau d'un total d'XP : passer du niveau n au suivant coûte 100 × n. */
export function niveauDe(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * Math.max(0, xp)) / 100)) / 2));
}

/** L'XP où commence un niveau : 50 × n × (n − 1). */
export const debutNiveau = (n: number) => 50 * n * (n - 1);

export function cranDe(reussies: number): number {
  return CRANS.filter((c) => reussies >= c).length;
}

/** Les saisons dans l'ordre : les archives, puis celle en cours. */
function saisonsDans(s: Saison): { numero: number; lue: SaisonLue; reference: (maintenant: Date) => Date; close: boolean }[] {
  const archives = [...(s.archives ?? [])].sort((a, b) => a.numero - b.numero);
  return [
    ...archives.map((a: SaisonArchivee) => ({
      numero: a.numero,
      lue: a as SaisonLue,
      reference: () => new Date(a.cloturee),
      close: true,
    })),
    { numero: s.numero ?? 0, lue: s as SaisonLue, reference: (m: Date) => m, close: false },
  ];
}

/**
 * Le journal d'XP de chacun : les dimanches joués (toutes saisons), les
 * missions acceptées à temps, jugées sur la feuille une fois la journée
 * finie (la prime si elle est réussie, le risque si elle est ratée), et les
 * félicitations. Rien n'est stocké : comme les classements, tout se
 * recalcule ; une félicitation retirée retire son XP.
 */
export function journalXp(
  s: Saison,
  reponses: Reponse[],
  votes: VoteLeger[],
  maintenant: Date,
  felicitations: FelicitationXp[] = []
): Map<string, { lignes: LigneXp[]; reussies: number }> {
  const out = new Map<string, { lignes: LigneXp[]; reussies: number }>();
  const de = (n: string) => {
    let x = out.get(n);
    if (!x) out.set(n, (x = { lignes: [], reussies: 0 }));
    return x;
  };
  const saisons = saisonsDans(s);
  let passe: MatchEntry[] = [];
  for (const sa of saisons) {
    const jouees = sa.lue.journees.filter((m) => journeeJouee(sa.lue, m.j));
    for (const m of jouees) {
      for (const e of sa.lue.entries) {
        if (e.j !== m.j || !joue(e)) continue;
        de(e.player).lignes.push({ saison: sa.numero, j: m.j, date: m.date, quoi: "Dimanche joué", xp: XP_DIMANCHE });
      }
    }
    // Les missions : seulement là où quelqu'un a répondu.
    const avecReponses = new Set(reponses.filter((r) => r.saison === sa.numero).map((r) => r.j));
    for (const j of [...avecReponses].sort((a, b) => a - b)) {
      const d = missionsDeJournee(sa.lue, sa.numero, j, sa.reference(maintenant), passe);
      if (!d || !d.joue || (!sa.close && maintenant.getTime() < d.finDuJour.getTime())) continue;
      for (const [nom, liste] of d.missions) {
        let ok = 0;
        for (const mi of liste) {
          if (reponseDe(reponses, d, nom, mi)?.reponse !== "acceptee") continue;
          const v = verdictFinal(juger(mi, nom, d, sa.lue, votes), mi);
          if (v.etat === "ratee")
            de(nom).lignes.push({ saison: sa.numero, j, date: d.date, quoi: `${libelleCourt(mi)} ratée`, xp: -risqueDe(mi) });
          if (v.etat !== "reussie") continue;
          ok++;
          de(nom).lignes.push({ saison: sa.numero, j, date: d.date, quoi: libelleCourt(mi), xp: mi.xp });
        }
        if (ok > 0) de(nom).reussies += ok;
        if (liste.length === 3 && ok === 3)
          de(nom).lignes.push({ saison: sa.numero, j, date: d.date, quoi: "Trois sur trois", xp: XP_PARFAIT });
      }
    }
    passe = [...passe, ...sa.lue.entries];
  }

  // Les félicitations : une par auteur, destinataire et exploit, jamais à soi.
  const dateDe = (saison: number, j: number) =>
    saisons.find((x) => x.numero === saison)?.lue.journees.find((m) => m.j === j)?.date ?? "";
  const vues = new Set<string>();
  const parExploit = new Map<string, number>();
  const donnees = new Map<string, number>();
  for (const f of felicitations) {
    const cle = `${f.de}|${f.a}|${f.exploit}`;
    if (f.de === f.a || isHidden(f.de) || vues.has(cle)) continue;
    vues.add(cle);
    const e = `${f.a}|${f.saison}|${f.j}|${f.exploit}`;
    parExploit.set(e, (parExploit.get(e) ?? 0) + 1);
    const d = `${f.de}|${f.saison}|${f.j}`;
    donnees.set(d, (donnees.get(d) ?? 0) + 1);
  }
  const recues = new Map<string, number>();
  for (const [e, n] of parExploit) {
    const [a, saison, j] = e.split("|");
    const k = `${a}|${saison}|${j}`;
    recues.set(k, (recues.get(k) ?? 0) + Math.min(n, FELICITATIONS_PAR_EXPLOIT) * XP_FELICITATION_RECUE);
  }
  for (const [k, xp] of recues) {
    const [a, saison, j] = k.split("|");
    de(a).lignes.push({
      saison: Number(saison),
      j: Number(j),
      date: dateDe(Number(saison), Number(j)),
      quoi: "Félicitations reçues",
      xp: Math.min(xp, XP_FELICITATIONS_JOURNEE),
    });
  }
  for (const [k, n] of donnees) {
    const [auteur, saison, j] = k.split("|");
    de(auteur).lignes.push({
      saison: Number(saison),
      j: Number(j),
      date: dateDe(Number(saison), Number(j)),
      quoi: "Félicitations données",
      xp: Math.min(n, FELICITATIONS_DONNEES_JOURNEE) * XP_FELICITATION_DONNEE,
    });
  }
  return out;
}

/** Le bilan d'un joueur, tiré du journal. */
export function bilanDe(
  journal: Map<string, { lignes: LigneXp[]; reussies: number }>,
  joueur: string,
  saisonEnCours: number
): BilanXp {
  const x = journal.get(joueur) ?? { lignes: [], reussies: 0 };
  // Les risques font baisser l'XP ; jamais sous zéro.
  const total = Math.max(0, x.lignes.reduce((a, l) => a + l.xp, 0));
  const saison = Math.max(0, x.lignes.filter((l) => l.saison === saisonEnCours).reduce((a, l) => a + l.xp, 0));
  const niveau = niveauDe(total);
  // Le passe suit la saison dimanche par dimanche : le plus haut palier atteint reste.
  const parJournee = new Map<number, number>();
  for (const l of x.lignes)
    if (l.saison === saisonEnCours) parJournee.set(l.j, (parJournee.get(l.j) ?? 0) + l.xp);
  let cumul = 0;
  let atteint = 0;
  for (const j of [...parJournee.keys()].sort((a, b) => a - b)) {
    cumul += parJournee.get(j) ?? 0;
    atteint = Math.max(atteint, Math.floor(Math.max(0, cumul) / XP_PALIER));
  }
  const palier = Math.min(PALIERS_PASSE, atteint);
  const fini = palier >= PALIERS_PASSE;
  return {
    total,
    saison,
    niveau,
    dansLeNiveau: total - debutNiveau(niveau),
    pourLeSuivant: 100 * niveau,
    palier,
    versPalier: fini ? XP_PALIER : Math.max(0, Math.min(XP_PALIER, saison - palier * XP_PALIER)),
    manquePalier: fini ? 0 : (palier + 1) * XP_PALIER - saison,
    reussies: x.reussies,
    cran: cranDe(x.reussies),
    lignes: [...x.lignes].sort((a, b) => b.saison - a.saison || b.j - a.j),
  };
}

/** Le classement du niveau : l'XP de chacun, à vie (masqués exclus), du plus haut au plus bas. */
export function classementNiveau(
  journal: Map<string, { lignes: LigneXp[]; reussies: number }>,
  joueurs: Player[]
): { name: string; xp: number; niveau: number; rank: number }[] {
  const liste = joueurs
    .filter((p) => !isHidden(p.name))
    .map((p) => {
      const xp = (journal.get(p.name)?.lignes ?? []).reduce((a, l) => a + l.xp, 0);
      return { name: p.name, xp, niveau: niveauDe(xp) };
    })
    .sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
  let rank = 0;
  return liste.map((p, i) => {
    if (i === 0 || p.xp !== liste[i - 1].xp) rank = i + 1;
    return { ...p, rank };
  });
}

/* ------------------------------ Les libellés ------------------------------ */

/** La mission en une phrase, à la deuxième personne : « Finis devant Abdel. » */
export function phrase(m: Mission, nom: (n: string) => string = (n) => n): string {
  const qui = m.cibles.map((c) => prenom(nom(c)));
  const et = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}` : (l[0] ?? ""));
  switch (m.genre) {
    case "finis-devant":
      return `Finis devant ${et(qui)}.`;
    case "tiens-le":
      return `Tiens ${et(qui)} à ${pl(m.seuil ?? 0, "but ou passe\u00a0D", "buts et passes\u00a0D")}.`;
    case "passe-devant":
      return `Passe devant ${et(qui)}.`;
    case "reste-en-tete":
      return "Reste en tête.";
    case "gagnez":
      return "Gagnez.";
    case "deux-passes":
      return "Fais deux passes\u00a0D.";
    case "record":
      return `Bats ton record : plus de ${pl(m.seuil ?? 0, "point", "points")}.`;
    case "vote":
      return "Vote Impact et Défensive.";
  }
}

/** Le nom court d'une mission, pour le journal d'XP : « Mission Verrou ». */
export function libelleCourt(m: Pick<Mission, "genre">): string {
  return `Mission ${NOM_DE_CODE[m.genre]}`;
}

/* ------------------------------ Le passe ------------------------------ */

export type Famille = "contrats" | "photo" | "carte" | "vrai";

export interface Palier {
  n: number;
  recompense: string;
  famille: Famille;
}

/** Les vingt paliers du passe de saison : chaque récompense sert à quelque chose. */
export const PASSE: Palier[] = [
  { n: 1, recompense: "Joker", famille: "contrats" },
  { n: 2, recompense: "Filtre studio argentique", famille: "photo" },
  { n: 3, recompense: "Le dossier du rival", famille: "contrats" },
  { n: 4, recompense: "Finition nuit", famille: "carte" },
  { n: 5, recompense: "Séance studio offerte", famille: "photo" },
  { n: 6, recompense: "Double ou rien", famille: "contrats" },
  { n: 7, recompense: "Joker", famille: "contrats" },
  { n: 8, recompense: "Filtre studio marbre", famille: "photo" },
  { n: 9, recompense: "Assurance", famille: "contrats" },
  { n: 10, recompense: "Finition chrome", famille: "carte" },
  { n: 11, recompense: "Dossier du rival, 3 dimanches", famille: "contrats" },
  { n: 12, recompense: "Séance studio offerte", famille: "photo" },
  { n: 13, recompense: "Choisir ton rival", famille: "contrats" },
  { n: 14, recompense: "Double ou rien", famille: "contrats" },
  { n: 15, recompense: "Filtre studio gravure", famille: "photo" },
  { n: 16, recompense: "Finition animée", famille: "carte" },
  { n: 17, recompense: "Joker", famille: "contrats" },
  { n: 18, recompense: "Séance studio offerte", famille: "photo" },
  { n: 19, recompense: "Chaussettes Bola", famille: "vrai" },
  { n: 20, recompense: "Carte de saison imprimée", famille: "vrai" },
];

export const FAMILLES: Record<Famille, string> = {
  contrats: "tes contrats",
  photo: "ta photo",
  carte: "ta carte",
  vrai: "le vrai",
};
