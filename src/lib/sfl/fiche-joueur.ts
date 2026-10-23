// La fiche d'un joueur, en bref : ce qu'on voit en touchant sa carte sur la
// feuille de match. Une phrase qui le résume, ses trois points forts (chacun
// avec son chiffre et son rang dans la ligue) et ses faits marquants, datés
// par journée. Tout se calcule sur la saison en cours, rien n'est stocké.
//
// Les badges de la fiche viennent d'ailleurs (trophees.ts, fin-de-saison.ts) :
// ce sont ceux de Ma carte.
//
// Ma carte y lit aussi ses dimanches (dimanchesDe) : chaque dimanche de la
// saison où il a joué ou pris des points sans jouer (un bonus d'extra time,
// une absence injustifiée), ce qu'il y a fait et ce qu'il lui a rapporté.
// Mis bout à bout, ses dimanches font son total au Pépite d'Or.

import type { Player } from "./engine";
import { ordinal } from "./fin-de-saison";
import { entryPP } from "./saisie/engine";
import { journeeJouee } from "./saisie/mutations";
import type { MatchEntry, PlayerStatutSaisie, Saison } from "./saisie/types";

export interface PointFort {
  /** « 14 », « 9/9 ». */
  chiffre: string;
  /** « buts ». */
  quoi: string;
  /** « 1er buteur ». */
  rang: string;
}

export interface FaitMarquant {
  /** « J6 ». */
  quand: string;
  /** « Triplé et 1 passe ». */
  quoi: string;
}

export interface FicheJoueur {
  synthese: string;
  forts: PointFort[];
  faits: FaitMarquant[];
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** Le rang d'un joueur dans la ligue (ex aequo partagés), null s'il est à zéro. */
function rangDe(players: Player[], moi: Player, valeur: (p: Player) => number): number | null {
  const v = valeur(moi);
  if (v <= 0) return null;
  return 1 + players.filter((p) => valeur(p) > v).length;
}

interface Mesure {
  id: "buts" | "passes" | "mvp" | "def" | "pp";
  valeur: (p: Player) => number;
  quoi: (n: number) => string;
  rang: (r: number) => string;
  /** « Le buteur de la ligue. » au 1er rang ; « Sur le podium des buteurs. » ensuite. */
  premier: string;
  podium: string;
}

const MESURES: Mesure[] = [
  { id: "buts", valeur: (p) => p.buts, quoi: (n) => (n > 1 ? "buts" : "but"), rang: (r) => `${ordinal(r)} buteur`, premier: "Le buteur de la ligue.", podium: "Sur le podium des buteurs." },
  { id: "passes", valeur: (p) => p.passes, quoi: (n) => (n > 1 ? "passes" : "passe"), rang: (r) => `${ordinal(r)} passeur`, premier: "Le passeur de la ligue.", podium: "Sur le podium des passeurs." },
  { id: "mvp", valeur: (p) => p.mvp, quoi: () => "MVP", rang: (r) => `${ordinal(r)} en MVP`, premier: "Le MVP de la ligue.", podium: "Sur le podium des MVP." },
  { id: "def", valeur: (p) => p.def, quoi: () => "fois le Mur", rang: (r) => `${ordinal(r)} défenseur`, premier: "Le mur de la ligue.", podium: "Sur le podium des défenseurs." },
  { id: "pp", valeur: (p) => p.pp, quoi: () => "pts Pépite", rang: (r) => `${ordinal(r)} au Pépite d'Or`, premier: "En tête du Pépite d'Or.", podium: "Sur le podium du Pépite d'Or." },
];

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ses buts et ses passes d'un dimanche, en mots : « doublé et 1 passe », null s'il n'y en a pas. */
export function actionsDuJour(buts: number, passes: number): string | null {
  const b = buts >= 4 ? `${buts} buts` : buts === 3 ? "triplé" : buts === 2 ? "doublé" : buts === 1 ? "1 but" : null;
  const actions = [b, passes ? pluriel(passes, "passe", "passes") : null].filter(Boolean) as string[];
  return actions.length ? actions.join(" et ") : null;
}

/** Ce que le joueur a fait un dimanche, en une ligne, et ce que ça pèse. */
function faitDuJour(e: MatchEntry): { quoi: string; poids: number } | null {
  const parts: string[] = [];
  let poids = 0;
  if (e.mvp) {
    parts.push("MVP du match");
    poids += 4;
  } else if (e.def) {
    parts.push("Le Mur du match");
    poids += 3;
  } else if (e.impact) {
    parts.push("Impact du match");
    poids += 3;
  }
  if (e.buts >= 2) poids += e.buts >= 3 ? 5 : 3;
  if (e.passes >= 2) poids += 2;
  const texte = actionsDuJour(e.buts, e.passes);
  if (texte) parts.push(parts.length ? texte : majuscule(texte));
  if (!poids && e.result === "Victoire" && e.cleanSheet) {
    parts.push("Victoire sans encaisser");
    poids += 2;
  }
  if (!poids) return null;
  return { quoi: parts.join(", "), poids };
}

/** La fiche d'un joueur dans la saison en cours. */
export function ficheJoueur(saison: Saison, moi: Player, players: Player[]): FicheJoueur {
  const jouees = [...new Set(saison.entries.map((e) => e.j))].filter((j) => journeeJouee(saison, j)).sort((a, b) => a - b);
  const lignes = saison.entries.filter((e) => e.player === moi.name && !e.extraTime && e.statut === "Présent" && jouees.includes(e.j));
  const presentes = new Set(lignes.map((e) => e.j));
  const n = jouees.length;
  const p = presentes.size;

  if (!p) return { synthese: "Pas encore de match cette saison.", forts: [], faits: [] };

  // Les points forts : ses meilleurs rangs ; la présence compte quand elle est entière.
  const candidats: { score: number; fort: PointFort; mesure?: Mesure; rang?: number }[] = [];
  for (const m of MESURES) {
    const r = rangDe(players, moi, m.valeur);
    if (r == null) continue;
    const v = m.valeur(moi);
    candidats.push({ score: r, mesure: m, rang: r, fort: { chiffre: String(v), quoi: m.quoi(v), rang: m.rang(r) } });
  }
  const toujours = p === n && n >= 3;
  candidats.push({
    score: toujours ? 2.5 : 10 + (1 - p / n) * 10,
    fort: { chiffre: `${p}/${n}`, quoi: n > 1 ? "dimanches" : "dimanche", rang: toujours ? "toujours là" : `${Math.round((p / n) * 100)} % présent` },
  });
  candidats.sort((a, b) => a.score - b.score);
  const forts = candidats.slice(0, 3).map((c) => c.fort);

  // La synthèse : son meilleur rang, puis ce qu'il fait d'un dimanche à l'autre.
  const meilleur = candidats.find((c) => c.mesure && c.rang! <= 3);
  const debut = meilleur ? (meilleur.rang === 1 ? meilleur.mesure!.premier : meilleur.mesure!.podium) : null;
  const rythme: string[] = [];
  const parMatch = (x: number) => x / p;
  if (parMatch(moi.buts) > 1) rythme.push("plus d'un but par match");
  else if (parMatch(moi.buts) === 1) rythme.push("un but par match");
  else if (parMatch(moi.buts) >= 0.5) rythme.push("un but tous les deux matchs");
  if (parMatch(moi.passes) >= 1) rythme.push("une passe décisive par match");
  else if (!rythme.length && parMatch(moi.passes) >= 0.5) rythme.push("une passe décisive tous les deux matchs");
  if (toujours) rythme.push("jamais absent un dimanche");
  const [r1, r2] = rythme;
  // « un but par match » et « une passe décisive par match » : une seule fois « par match ».
  const deux = r2 && r1.endsWith(" par match") && r2.endsWith(" par match") ? `${r1.slice(0, -10)} et ${r2}` : r2 ? `${r1}, et ${r2}` : r1;
  let suite = deux ?? `${pluriel(p, "dimanche joué", "dimanches joués")} cette saison`;
  suite = suite.charAt(0).toUpperCase() + suite.slice(1) + ".";
  const synthese = debut ? `${debut} ${suite}` : suite;

  // Les faits marquants : ses plus grands dimanches, puis sa série en cours.
  const faits: { j: number; quoi: string; poids: number }[] = [];
  for (const e of lignes) {
    const f = faitDuJour(e);
    if (f) faits.push({ j: e.j, ...f });
  }
  let serie = 0;
  for (let i = jouees.length - 1; i >= 0 && presentes.has(jouees[i]); i--) serie++;
  if (serie >= 3) faits.push({ j: jouees[jouees.length - 1], quoi: `${serie}e dimanche d'affilée`, poids: 2.5 });
  const retenus = faits
    .sort((a, b) => b.poids - a.poids || b.j - a.j)
    .slice(0, 3)
    .sort((a, b) => a.j - b.j)
    .map((f) => ({ quand: `J${f.j}`, quoi: f.quoi }));

  return { synthese, forts, faits: retenus };
}

/* ------------------------------ Ses dimanches ------------------------------ */
//
// Un dimanche peut compter plusieurs matchs (une ligne par match sur la
// feuille) : ses buts, ses passes et ses titres s'additionnent, ses résultats
// se suivent. Les points du jour comptent aussi le bonus d'extra time. Un
// dimanche sans match n'est là que s'il a changé ses points.

export type Resultat = "V" | "N" | "D";
export type TitreDuJour = "mvp" | "def" | "impact";

export interface Dimanche {
  j: number;
  /** « 19 oct. ». */
  date: string;
  /** null s'il a joué ; sinon ce qui lui a valu ses points sans jouer : « Bonus extra time », « Absence injustifiée »… */
  horsMatch: string | null;
  /** Ses matchs du jour, dans l'ordre de la feuille (ceux dont le résultat est saisi). */
  resultats: Resultat[];
  buts: number;
  passes: number;
  /** Ses titres du jour : MVP, Le Mur, Impact. */
  titres: TitreDuJour[];
  /** Ses points Pépite du jour, bonus compris (en moins pour une absence injustifiée). */
  points: number;
}

const LETTRE: Record<NonNullable<MatchEntry["result"]>, Resultat> = { Victoire: "V", Nul: "N", Défaite: "D" };

const HORS_MATCH: Record<Exclude<PlayerStatutSaisie, "Présent">, string> = {
  "Absent justifié": "Absence justifiée",
  "Absence injustifiée": "Absence injustifiée",
  Blessure: "Blessé",
  Suspendu: "Suspendu",
};

/** Ses dimanches de la saison en cours, le plus récent d'abord. */
export function dimanchesDe(saison: Saison, nom: string): Dimanche[] {
  const dates = new Map(saison.journees.map((m) => [m.j, m.date]));
  const parJour = new Map<number, MatchEntry[]>();
  for (const e of saison.entries) {
    if (e.player === nom) parJour.set(e.j, [...(parJour.get(e.j) ?? []), e]);
  }
  const out: Dimanche[] = [];
  for (const [j, lignes] of parJour) {
    const matchs = lignes.filter((e) => !e.extraTime && e.statut === "Présent");
    const points = lignes.reduce((n, e) => n + (e.extraTime ? (e.pepiteBonus ?? 0) : entryPP(e)), 0);
    if ((!matchs.length && !points) || !journeeJouee(saison, j)) continue;
    const absence = lignes.find((e) => !e.extraTime && e.statut !== "Présent");
    out.push({
      j,
      date: dates.get(j) ?? "",
      horsMatch: matchs.length ? null : absence ? HORS_MATCH[absence.statut as keyof typeof HORS_MATCH] : "Bonus extra time",
      resultats: matchs.flatMap((e) => (e.result ? [LETTRE[e.result]] : [])),
      buts: matchs.reduce((n, e) => n + e.buts, 0),
      passes: matchs.reduce((n, e) => n + e.passes, 0),
      titres: (["mvp", "def", "impact"] as const).filter((t) => matchs.some((e) => e[t])),
      points,
    });
  }
  return out.sort((a, b) => b.j - a.j);
}

const NOM_RESULTAT: Record<Resultat, [string, string]> = {
  V: ["victoire", "victoires"],
  N: ["nul", "nuls"],
  D: ["défaite", "défaites"],
};

/** Ses titres du jour, comme on les dit : MVP, Le Mur, Impact. */
export const NOM_TITRE: Record<TitreDuJour, string> = { mvp: "MVP", def: "Le Mur", impact: "Impact" };

const listeEt = (mots: string[]) => (mots.length > 1 ? `${mots.slice(0, -1).join(", ")} et ${mots[mots.length - 1]}` : mots[0] ?? "");

/** Le résultat du jour : « victoire », ou « 2 victoires et 1 défaite » sur plusieurs matchs ; null sans résultat saisi. */
export function resultatDuJour(d: Dimanche): string | null {
  if (!d.resultats.length) return null;
  if (d.resultats.length === 1) return NOM_RESULTAT[d.resultats[0]][0];
  return listeEt(
    (["V", "N", "D"] as const).flatMap((r) => {
      const n = d.resultats.filter((x) => x === r).length;
      return n ? [pluriel(n, ...NOM_RESULTAT[r])] : [];
    })
  );
}

/** Le dimanche en une phrase : « Victoire, doublé et 1 passe. MVP du match. » */
export function phraseDuJour(d: Dimanche): string {
  if (d.horsMatch) return `${d.horsMatch}.`;
  const faits = [resultatDuJour(d), actionsDuJour(d.buts, d.passes)].filter(Boolean).join(", ");
  const titres = d.titres.length ? `${listeEt(d.titres.map((t) => NOM_TITRE[t]))} du match.` : "";
  return [faits ? `${majuscule(faits)}.` : "", titres].filter(Boolean).join(" ") || "Présent.";
}
