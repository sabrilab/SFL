// Les Actus — le fil de l'onglet qui remplace la Ligue (Sabri, 22/10 : « un
// feed d'actualité, comme sur les réseaux sociaux, où parfois on a des
// vidéos ; ce ne sera pas des vidéos, ce sera du motion design »).
//
// Ce fichier ne fait que la liste : quelles publications, dans quel ordre,
// pour une saison donnée. Chaque publication est une petite cinématique
// (components/sfl/actus/cinematiques.tsx) ; ici, rien que des faits, tirés
// des chiffres comme le reste de la Ligue (a-l-honneur.ts) : rien n'est
// inventé, rien n'est stocké, deux lectures donnent le même fil.
//
// L'ordre : le plus récent d'abord. Pour chaque dimanche joué, les scores,
// puis les hommes du dimanche, et entre eux les badges, l'équipe type, le
// duo, ceux qui montent ; le dernier dimanche porte en plus le podium, la
// course et ceux qui sont « dans la surface ». Les publications d'un même
// genre alternent leur cinématique (variante), pour que le fil ne se répète
// pas.

import { honneurDe, type Decroche, type Honneur, type Surface } from "./a-l-honneur";
import type { Journee, JourneeMatch } from "./engine";
import { isHidden } from "./hidden";
import { journeeJouee } from "./saisie/mutations";
import type { Saison } from "./saisie/types";
import type { TropheeId } from "./trophees";

/**
 * Les badges que le fil met en avant : ceux que Sabri garde sur Ma carte
 * (22/10 : but, passe, match, victoire ; MVP, le mur, impact). Série,
 * ancienneté et cage inviolée n'y paraissent pas.
 */
const BADGES_DU_FIL = new Set<TropheeId>(["buts", "passes", "matchs", "victoires", "mvp", "mur", "impact"]);

export type Actu =
  | { type: "score"; id: string; j: number; date: string; match: JourneeMatch; variante: number }
  | { type: "mvp"; id: string; j: number; date: string; mvp: Honneur["mvp"][number]; variante: number }
  | { type: "badge"; id: string; j: number; date: string; d: Decroche; variante: number }
  | { type: "badges"; id: string; j: number; date: string; ds: Decroche[] }
  | { type: "equipe"; id: string; j: number; date: string; equipe: Honneur["equipeType"]; variante: number }
  | { type: "chiffre"; id: string; j: number; date: string; nom: string; n: number; quoi: "buts" | "passes" }
  | { type: "presents"; id: string; j: number; date: string; noms: string[] }
  | { type: "duo"; id: string; j: number; date: string; duo: NonNullable<Honneur["duo"]> }
  | { type: "montent"; id: string; j: number; date: string; montent: Honneur["montent"] }
  | { type: "podium"; id: string; j: number; date: string }
  | { type: "course"; id: string; j: number; date: string }
  | { type: "surface"; id: string; j: number; date: string; surface: Surface[] }
  | { type: "recap"; id: string; j: number; date: string; buts: number; matchs: number };

/** Les dimanches joués, du plus récent au plus ancien. */
export function dimanchesJoues(saison: Saison): number[] {
  return saison.journees
    .map((m) => m.j)
    .filter((j) => journeeJouee(saison, j))
    .sort((a, b) => b - a);
}

/**
 * Le fil d'une saison. `journees` : celles du moteur (deriveSeason), pour les
 * scores et les buteurs. `dernier` : le fil du dimanche le plus récent porte
 * le podium, la course et la surface (ce sont des états de la saison, pas
 * d'un dimanche passé).
 */
export function filDeSaison(saison: Saison, journees: Journee[], moi?: string, enCours = true): Actu[] {
  const jours = dimanchesJoues(saison);
  const fil: Actu[] = [];
  let mvpVu = 0;
  let scoreVu = 0;
  let badgeVu = 0;
  let equipeVu = 0;
  jours.forEach((j, rang) => {
    const meta = journees.find((x) => x.j === j);
    const date = meta?.date ?? saison.journees.find((x) => x.j === j)?.date ?? "";
    const h = honneurDe(saison, j, moi);
    const cle = `${saison.numero ?? 0}-${j}`;
    const dernier = rang === 0 && enCours;

    const scores: Actu[] = (meta?.matches ?? []).map((match) => ({
      type: "score",
      id: `${cle}-score-${match.id}`,
      j,
      date,
      match,
      variante: scoreVu++,
    }));
    const mvps: Actu[] = h.mvp
      .filter((m) => !isHidden(m.nom))
      .map((mvp) => ({ type: "mvp", id: `${cle}-mvp-${mvp.nom}`, j, date, mvp, variante: mvpVu++ }));
    const badges: Actu[] = h.decroches
      .filter((d) => BADGES_DU_FIL.has(d.id))
      .slice(0, 6)
      .map((d) => ({ type: "badge", id: `${cle}-badge-${d.nom}-${d.id}`, j, date, d, variante: badgeVu++ }));

    // Le premier score ouvre le dimanche, son homme du match le suit ; les
    // autres matchs viennent ensuite, chacun suivi du sien.
    const tete: Actu[] = [];
    const n = Math.max(scores.length, mvps.length);
    for (let i = 0; i < n; i++) {
      if (scores[i]) tete.push(scores[i]);
      if (mvps[i]) tete.push(mvps[i]);
    }
    fil.push(...tete);

    // Le chiffre du dimanche : le plus de buts d'un seul joueur (ou de passes,
    // si personne n'a fait mieux en passes qu'en buts), en typo géante.
    const lignes = saison.entries.filter((e) => e.j === j && !e.extraTime && !isHidden(e.player));
    const parJoueur = new Map<string, { buts: number; passes: number }>();
    for (const e of lignes) {
      const x = parJoueur.get(e.player) ?? { buts: 0, passes: 0 };
      x.buts += e.buts;
      x.passes += e.passes;
      parJoueur.set(e.player, x);
    }
    const [butMax] = [...parJoueur].sort((a, b) => b[1].buts - a[1].buts);
    const [passeMax] = [...parJoueur].sort((a, b) => b[1].passes - a[1].passes);
    const chiffre: Actu | null =
      passeMax && butMax && passeMax[1].passes > butMax[1].buts
        ? { type: "chiffre", id: `${cle}-chiffre`, j, date, nom: passeMax[0], n: passeMax[1].passes, quoi: "passes" }
        : butMax && butMax[1].buts >= 2
          ? { type: "chiffre", id: `${cle}-chiffre`, j, date, nom: butMax[0], n: butMax[1].buts, quoi: "buts" }
          : null;
    const presents = [...new Set(lignes.filter((e) => e.statut === "Présent").map((e) => e.player))];

    // Les badges d'un dimanche : un seul, il a sa publication ; plusieurs, un carrousel.
    const unBadge = badges.length === 1 ? badges[0] : null;
    const carrousel: Actu | null =
      badges.length > 1 ? { type: "badges", id: `${cle}-badges`, j, date, ds: badges.map((b) => (b as { d: Decroche }).d) } : null;

    if (chiffre) fil.push(chiffre);
    if (h.equipeType.length >= 3) fil.push({ type: "equipe", id: `${cle}-equipe`, j, date, equipe: h.equipeType, variante: equipeVu++ });
    if (unBadge) fil.push(unBadge);
    if (carrousel) fil.push(carrousel);
    if (h.duo) fil.push({ type: "duo", id: `${cle}-duo`, j, date, duo: h.duo });
    if (h.montent.length > 0) fil.push({ type: "montent", id: `${cle}-montent`, j, date, montent: h.montent });
    if (dernier) fil.push({ type: "podium", id: `${cle}-podium`, j, date });
    if (presents.length >= 6) fil.push({ type: "presents", id: `${cle}-presents`, j, date, noms: presents });
    if (dernier) fil.push({ type: "course", id: `${cle}-course`, j, date });
    const surface = h.surface.filter((x) => BADGES_DU_FIL.has(x.id));
    if (dernier && surface.length > 0) fil.push({ type: "surface", id: `${cle}-surface`, j, date, surface: surface.slice(0, 5) });

    const buts = (meta?.matches ?? []).reduce((s, m) => s + m.teamA.score + m.teamB.score, 0);
    fil.push({ type: "recap", id: `${cle}-recap`, j, date, buts, matchs: meta?.matches?.length ?? 0 });
  });
  return fil;
}

/** Le nombre de buts d'un joueur sur une ligne de feuille, pour les buteurs d'un score. */
export function buteursDe(match: JourneeMatch): { a: { nom: string; buts: number }[]; b: { nom: string; buts: number }[] } {
  const liste = (t: JourneeMatch["teamA"]) =>
    t.players
      .filter((p) => p.buts > 0 && !isHidden(p.name))
      .sort((x, y) => y.buts - x.buts)
      .map((p) => ({ nom: p.name, buts: p.buts }));
  return { a: liste(match.teamA), b: liste(match.teamB) };
}
