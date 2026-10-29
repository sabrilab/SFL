// Les règles d'une feuille saine : plus jamais de matchs fantômes ni de doublons.
//
// Le 28/10/2026, un toucher sur « Ajouter une équipe » a fait naître sur la
// J3, déjà jouée, des matchs 5 et 6 et des joueurs en double. Désormais, à
// trois niveaux, du plus doux au plus sûr :
//   1. l'écran ne propose jamais le geste (effectif.ts, choixDEquipe) ;
//   2. l'enregistrement le refuse (saisieStore.save : nouveauxEcarts) ;
//   3. la base le refuse (public.feuille_saine, dans publier_saison, même
//      avec « Écraser »).
// Seuls les écarts NOUVEAUX bloquent : une saison ancienne déjà imparfaite
// ne bloque jamais une écriture (la J3 se répare ligne à ligne).
//
//   I0  une ligne du compte vitrine écrite
//   I1  un joueur deux fois sur la journée (sa ligne Xtratime à part)
//   I2  une ligne d'un membre qui ne joue pas, ou d'un arbitre
//   I3  un camp hors des matchs déclarés (journée qui a ses matchs écrits)
//   I4  un match aux deux camps identiques
//   I5  un match vide ou à un seul camp ; plus de matchs à la même heure que de terrains
//   I6  deux journées pour une même date
//   I7  un camp aux résultats différents, ou incohérent avec son adversaire
//   I8  une écriture qui fait disparaître un brouillon sans « Jeter »
//
// Pur.

import { TERRAINS_MAX } from "../equipes-division";
import { isArbitre, neJouePas } from "../hidden";
import { estBrouillon } from "./brouillon";
import type { MatchDuJour, MatchEntry, Saison } from "./types";
import { libelleCourt } from "./mutations";

export type Ecart =
  | { r: "I0"; j: number; joueur: string }
  | { r: "I1"; j: number; joueur: string }
  | { r: "I2"; j: number; joueur: string }
  | { r: "I3"; j: number; equipe: string }
  | { r: "I4"; j: number; match: number }
  | { r: "I5"; j: number; match: number }
  | { r: "I6"; date: string; js: number[] }
  | { r: "I7"; j: number; equipe: string }
  | { r: "I8"; j: number };

export type Regle = Ecart["r"];

export const BLOQUE_L_ECRITURE: ReadonlySet<Regle> = new Set(["I0", "I1", "I2", "I6", "I8"]);
export const BLOQUE_LA_PUBLICATION: ReadonlySet<Regle> = new Set(["I0", "I1", "I2", "I3", "I4", "I5", "I6", "I7"]);

const cle = (n: string) => n.trim().toLowerCase();
const dateCle = (d: string) => libelleCourt(d).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** La clé d'un écart, pour comparer deux saisons. */
export function cleEcart(e: Ecart): string {
  switch (e.r) {
    case "I0":
    case "I1":
    case "I2":
      return `${e.r}|${e.j}|${cle(e.joueur)}`;
    case "I3":
    case "I7":
      return `${e.r}|${e.j}|${e.equipe}`;
    case "I4":
    case "I5":
      return `${e.r}|${e.j}|${e.match}`;
    case "I6":
      return `I6|${dateCle(e.date)}`;
    case "I8":
      return `I8|${e.j}`;
  }
}

/** Le défaut, en quelques mots, sur l'objet en cause (« Ilyes ×2 », « Match 3 · vide »). */
export function libelleEcart(e: Ecart): string {
  switch (e.r) {
    case "I0":
      return `${e.joueur} · vitrine`;
    case "I1":
      return `${e.joueur} ×2`;
    case "I2":
      return `${e.joueur} · ne joue pas`;
    case "I3":
      return `${e.equipe} · sans match`;
    case "I4":
      return `Match ${e.match} · un seul camp`;
    case "I5":
      return `Match ${e.match} · incomplet`;
    case "I6":
      return `${e.date} · ${e.js.map((j) => `J${j}`).join(" + ")}`;
    case "I7":
      return `${e.equipe} · résultats`;
    case "I8":
      return `J${e.j} · brouillon perdu`;
  }
}

/** Les matchs qu'une journée a écrits (sans doublon de paire). */
function declares(s: Saison, j: number): MatchDuJour[] {
  return s.journees.find((m) => m.j === j)?.matchsDuJour ?? [];
}

const joue = (e: MatchEntry) => e.statut === "Présent" && !e.extraTime;

const oppose = { Victoire: "Défaite", Défaite: "Victoire", Nul: "Nul" } as const;

/** Les défauts d'une journée (et ceux de sa date). */
export function verifierFeuille(s: Saison, j: number, terrainsMax = TERRAINS_MAX): Ecart[] {
  const out: Ecart[] = [];
  const lignes = s.entries.filter((e) => e.j === j);
  const meta = s.journees.find((m) => m.j === j);

  // I0, I1, I2
  const vus = new Map<string, number>();
  const rapportes = new Set<string>();
  for (const e of lignes) {
    if (e.vitrine) out.push({ r: "I0", j, joueur: e.player });
    if (neJouePas(e.player) || isArbitre(e.player)) {
      if (!rapportes.has(`2${cle(e.player)}`)) out.push({ r: "I2", j, joueur: e.player });
      rapportes.add(`2${cle(e.player)}`);
    }
    if (e.extraTime) continue;
    const n = (vus.get(cle(e.player)) ?? 0) + 1;
    vus.set(cle(e.player), n);
    if (n === 2) out.push({ r: "I1", j, joueur: e.player });
  }

  // I3, I4, I5
  const ms = declares(s, j);
  const occupees = new Map<string, number>();
  for (const e of lignes) if (e.team && joue(e)) occupees.set(e.team, (occupees.get(e.team) ?? 0) + 1);
  if (ms.length) {
    const camps = new Set(ms.flatMap((m) => m.equipes));
    for (const t of occupees.keys()) if (!camps.has(t)) out.push({ r: "I3", j, equipe: t });
  }
  const parHeure = new Map<string, number>();
  ms.forEach((m, i) => {
    if (m.equipes[0] === m.equipes[1]) out.push({ r: "I4", j, match: i + 1 });
    else if (!occupees.get(m.equipes[0]) || !occupees.get(m.equipes[1])) out.push({ r: "I5", j, match: i + 1 });
    const h = m.heure ?? meta?.heure ?? "";
    const n = (parHeure.get(h) ?? 0) + 1;
    parHeure.set(h, n);
    if (h && n > terrainsMax && !out.some((x) => x.r === "I5" && x.j === j && x.match === i + 1)) out.push({ r: "I5", j, match: i + 1 });
  });

  // I6
  if (meta) {
    const memes = s.journees.filter((m) => dateCle(m.date) === dateCle(meta.date)).map((m) => m.j).sort((a, b) => a - b);
    if (memes.length > 1) out.push({ r: "I6", date: meta.date, js: memes });
  }

  // I7
  const resultats = new Map<string, Set<string>>();
  for (const e of lignes) if (e.team && joue(e) && e.result) (resultats.get(e.team) ?? resultats.set(e.team, new Set()).get(e.team)!).add(e.result);
  for (const [t, rs] of resultats) if (rs.size > 1) out.push({ r: "I7", j, equipe: t });
  for (const m of ms) {
    const a = resultats.get(m.equipes[0]);
    const b = resultats.get(m.equipes[1]);
    if (a?.size === 1 && b?.size === 1) {
      const ra = [...a][0] as keyof typeof oppose;
      if (oppose[ra] !== [...b][0] && !out.some((x) => x.r === "I7" && x.j === j && x.equipe === m.equipes[1])) out.push({ r: "I7", j, equipe: m.equipes[1] });
    }
  }
  return out;
}

/** Tous les défauts de la saison, journée par journée (I6 une fois par date). */
export function ecartsDeLaSaison(s: Saison): Ecart[] {
  const out = new Map<string, Ecart>();
  const js = new Set([...s.journees.map((m) => m.j), ...s.entries.map((e) => e.j)]);
  for (const j of js) for (const e of verifierFeuille(s, j)) out.set(cleEcart(e), e);
  return [...out.values()];
}

/**
 * Les seuls écarts que `apres` ajoute à `avant` : un défaut ancien ne bloque
 * jamais. Plus I8 : un brouillon d'`avant` qui disparaît d'`apres` sans être
 * publié ni jeté (`jeter`) — une écriture faite depuis une saison filtrée.
 */
export function nouveauxEcarts(avant: Saison, apres: Saison, opts: { jeter?: number } = {}): Ecart[] {
  const vieux = new Set(ecartsDeLaSaison(avant).map(cleEcart));
  const out = ecartsDeLaSaison(apres).filter((e) => !vieux.has(cleEcart(e)));
  // Une nouvelle saison (clôture) vide les journées par nature.
  if ((apres.numero ?? 0) === (avant.numero ?? 0)) {
    for (const m of avant.journees) {
      if (!estBrouillon(m) || m.j === opts.jeter) continue;
      if (!apres.journees.some((x) => x.j === m.j)) out.push({ r: "I8", j: m.j });
    }
  }
  return out;
}

/** Ceux qui empêchent d'écrire. */
export function bloquantsEcriture(ecarts: Ecart[]): Ecart[] {
  return ecarts.filter((e) => BLOQUE_L_ECRITURE.has(e.r));
}

/** Les défauts qui empêchent de publier la journée `j`. */
export function bloquantsPublication(s: Saison, j: number): Ecart[] {
  return verifierFeuille(s, j).filter((e) => BLOQUE_LA_PUBLICATION.has(e.r));
}
