// Les blessures déclarées, et les journées qu'elles expliquent.
//
// Sabri, 26/10 : « une fonctionnalité qui permet à chaque utilisateur de se
// déclarer blessé », pour qu'on retrouve « rapidement et simplement combien
// de journées a effectué tel et tel joueur, et qu'on puisse voir que ses
// stats sont restées bloquées juste à ces journées-là ». Et dans les
// classements, « à côté des points », le nombre de journées de chacun, comme
// la colonne J de la Ligue 1 (classements.tsx).
//
// Une blessure se compte en journées, pas en dates : déclarée, elle part de
// la prochaine journée à jouer (`depuis`) ; « Je suis remis » la ferme sur
// la dernière journée jouée (`fin`, comprise). Remis avant qu'une journée ne
// se joue, elle disparaît (rien n'a été manqué). C'est la base qui pose le
// nom (blessures-store.ts) : on ne se déclare que soi-même.
//
// Une journée « manquée sur blessure » : une journée jouée de la saison où le
// joueur n'a pas joué, et qui tombe dans une de ses blessures, ou que l'admin
// a saisie « Blessure » sur sa ligne. Rien ne touche aux points : c'est ce
// qu'on lit à côté.

import type { MatchEntry, Saison } from "./saisie/types";
import { journeeJouee } from "./saisie/mutations";

export interface Blessure {
  saison: number;
  joueur: string;
  /** La première journée manquée. */
  depuis: number;
  /** La dernière journée manquée, comprise ; null tant qu'il n'est pas remis. */
  fin: number | null;
  /** L'heure de la déclaration (la base la pose). */
  le: string;
}

const joue = (e: MatchEntry) => e.statut === "Présent" && !e.extraTime;

/** Les journées jouées de la saison, dans l'ordre. */
export function journeesJouees(s: Pick<Saison, "journees" | "entries">): number[] {
  return s.journees
    .map((m) => m.j)
    .filter((j) => journeeJouee(s, j))
    .sort((a, b) => a - b);
}

/** La prochaine journée à jouer : celle d'où part une blessure déclarée aujourd'hui. */
export function prochaineJournee(s: Pick<Saison, "journees" | "entries">): number {
  const jouees = journeesJouees(s);
  return (jouees.at(-1) ?? 0) + 1;
}

/**
 * Les journées où chacun a joué (un dimanche à plusieurs matchs compte une
 * fois). `jouees` : seulement ces journées (celles que compte la vue,
 * journeesJouees) — une feuille posée, ou figée jusqu'à la révélation, ne
 * compte pas.
 */
export function journeesParJoueur(entries: MatchEntry[], jouees?: ReadonlySet<number>): Map<string, Set<number>> {
  const m = new Map<string, Set<number>>();
  for (const e of entries) {
    if (!joue(e) || (jouees && !jouees.has(e.j))) continue;
    let s = m.get(e.player);
    if (!s) m.set(e.player, (s = new Set()));
    s.add(e.j);
  }
  return m;
}

/** Sa blessure en cours dans cette saison, s'il en a une. */
export function blessureEnCours(liste: Blessure[], saison: number, joueur: string): Blessure | null {
  return liste.find((b) => b.saison === saison && b.joueur === joueur && b.fin == null) ?? null;
}

/** Les joueurs blessés aujourd'hui dans cette saison. */
export function blessesEnCours(liste: Blessure[], saison: number): Set<string> {
  return new Set(liste.filter((b) => b.saison === saison && b.fin == null).map((b) => b.joueur));
}

export interface BilanJournees {
  /** Les journées jouées de la saison. */
  total: number;
  /** Celles qu'il a jouées. */
  jouees: number[];
  /** Celles qu'il a manquées sur blessure. */
  blesse: number[];
  /** Sa blessure en cours, s'il en a une. */
  enCours: Blessure | null;
}

/** Ses journées de la saison : jouées, manquées sur blessure, sur combien. */
export function bilanJournees(s: Saison, liste: Blessure[], joueur: string): BilanJournees {
  const numero = s.numero ?? 0;
  const toutes = journeesJouees(s);
  const siennes = journeesParJoueur(s.entries).get(joueur) ?? new Set<number>();
  const periodes = liste.filter((b) => b.saison === numero && b.joueur === joueur);
  const dansUnePeriode = (j: number) => periodes.some((b) => j >= b.depuis && (b.fin == null || j <= b.fin));
  const saisieBlessure = (j: number) => s.entries.some((e) => e.j === j && e.player === joueur && e.statut === "Blessure");
  return {
    total: toutes.length,
    jouees: toutes.filter((j) => siennes.has(j)),
    blesse: toutes.filter((j) => !siennes.has(j) && (dansUnePeriode(j) || saisieBlessure(j))),
    enCours: blessureEnCours(liste, numero, joueur),
  };
}

/** « J4 », « J4 et J5 », « J4 à J6 » : des journées qui se suivent se disent d'un trait. */
export function direJournees(js: number[]): string {
  if (!js.length) return "";
  const suite = js.every((j, i) => i === 0 || j === js[i - 1] + 1);
  if (js.length === 1) return `J${js[0]}`;
  if (js.length === 2) return `J${js[0]} et J${js[1]}`;
  if (suite) return `J${js[0]} à J${js.at(-1)}`;
  return `${js.slice(0, -1).map((j) => `J${j}`).join(", ")} et J${js.at(-1)}`;
}
