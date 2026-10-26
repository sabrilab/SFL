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
// puis les cartes de chaque match (MVP, Impact, Défensive), puis le chiffre,
// les meilleurs buteurs et passeurs, l'équipe type, les badges, le duo, ceux
// qui montent ; le dernier dimanche porte en plus le podium, la course et
// ceux qui sont « dans la surface ».
//
// Les cartes à titre (Sabri, 26/10, après la J3 : « que les cartes et la
// reconnaissance des différentes actions des joueurs, quand ils sont
// meilleurs buteurs, etc., soient mises à jour dans l'interface, pour que ce
// soit aussi gratifiant ») : une rubrique par match, avec ses MVP, ses
// Joueurs Impact et ses Défensives, ex æquo compris. Les élus des votes ne
// sont posés sur les lignes qu'une fois le vote fermé (votes.ts,
// appliquerVotes) : la saison passée ici doit être celle où ils le sont
// (useSeason().saisonTitree). Les publications d'un même
// genre alternent leur cinématique (variante), pour que le fil ne se répète
// pas.

import { honneurDe, type Decroche, type Honneur, type Surface } from "./a-l-honneur";
import type { BoostType, Journee, JourneeMatch } from "./engine";
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

/** Un joueur et ses titres d'un match, du plus rare au moins rare (MVP, Impact, Défensive). */
export interface Titre {
  nom: string;
  types: BoostType[];
}

/** Une place d'un podium du jour : le joueur et son chiffre (ex æquo à la même place). */
export interface Marche {
  nom: string;
  n: number;
  place: number;
}

export type Actu =
  | { type: "score"; id: string; j: number; date: string; match: JourneeMatch; variante: number }
  | { type: "mvp"; id: string; j: number; date: string; mvp: Honneur["mvp"][number]; variante: number }
  | { type: "titres"; id: string; j: number; date: string; match: string; score: string | null; titres: Titre[] }
  | {
      type: "podium-jour";
      id: string;
      j: number;
      date: string;
      quoi: "buts" | "passes";
      marches: Marche[];
      /** Le chiffre du dimanche, quand ce podium le porte : son joueur garde sa clé d'exploit « chiffre ». */
      record?: string;
    }
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

const RARETE: Record<BoostType, number> = { mvp: 0, impact: 1, def: 2 };

/**
 * Les cartes à titre d'un dimanche, match par match : pour chaque match (ses
 * équipes deux à deux, comme le moteur), ses joueurs qui ont un titre, le
 * plus rare d'abord (MVP, Impact, Défensive), puis le plus titré. Un joueur venu compléter une autre
 * équipe (extra time) n'y prend rien. Une journée sans équipes est un seul
 * groupe.
 */
export function titresDuDimanche(
  saison: Saison,
  j: number,
  meta?: Pick<Journee, "matches">,
): { match: string; score: string | null; titres: Titre[] }[] {
  const lignes = saison.entries.filter((e) => e.j === j && e.statut === "Présent" && !e.extraTime && !isHidden(e.player));
  const matchs = meta?.matches ?? [];
  const groupes: { match: string; score: string | null; noms: Set<string> | null }[] = matchs.length
    ? matchs.map((m, i) => ({
        match: matchs.length > 1 ? `Match ${i + 1}` : "Le match",
        score: `${m.teamA.score}–${m.teamB.score}`,
        noms: new Set([...m.teamA.players, ...m.teamB.players].filter((p) => !p.extraTime).map((p) => p.name)),
      }))
    : [{ match: "Le dimanche", score: null, noms: null }];
  return groupes
    .map((g) => {
      const parNom = new Map<string, Set<BoostType>>();
      for (const e of lignes) {
        if (g.noms && !g.noms.has(e.player)) continue;
        const t = parNom.get(e.player) ?? new Set<BoostType>();
        if (e.mvp) t.add("mvp");
        if (e.impact) t.add("impact");
        if (e.def) t.add("def");
        if (t.size) parNom.set(e.player, t);
      }
      const titres = [...parNom]
        .map(([nom, t]) => ({ nom, types: [...t].sort((a, b) => RARETE[a] - RARETE[b]) }))
        .sort((a, b) => RARETE[a.types[0]] - RARETE[b.types[0]] || b.types.length - a.types.length || a.nom.localeCompare(b.nom));
      return { match: g.match, score: g.score, titres };
    })
    .filter((g) => g.titres.length > 0);
}

/**
 * Le podium d'un dimanche en buts ou en passes : les trois premières places,
 * ex æquo compris (au plus cinq joueurs). Vide si personne n'en a marqué deux.
 */
export function podiumDuJour(lignes: { player: string; buts: number; passes: number }[], quoi: "buts" | "passes"): Marche[] {
  const parJoueur = new Map<string, number>();
  for (const e of lignes) parJoueur.set(e.player, (parJoueur.get(e.player) ?? 0) + e[quoi]);
  const tries = [...parJoueur].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (!tries.length || tries[0][1] < 2) return [];
  let marches: Marche[] = [];
  tries.forEach(([nom, n], i) => {
    const place = i > 0 && tries[i - 1][1] === n ? marches[i - 1].place : i + 1;
    marches.push({ nom, n, place });
  });
  marches = marches.filter((m) => m.place <= 3);
  // Cinq au plus : une place qui ne tient pas entière tombe tout entière.
  while (marches.length > 5) {
    const derniere = marches[marches.length - 1].place;
    if (derniere === 1) break;
    marches = marches.filter((m) => m.place !== derniere);
  }
  return marches;
}

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
    // Les cartes de chaque match ; un dimanche d'avant les équipes, ses MVP seuls.
    const parMatch = titresDuDimanche(saison, j, meta);
    const titres: Actu[] = parMatch.map((g, i) => ({
      type: "titres",
      id: `${cle}-titres-${i}`,
      j,
      date,
      match: g.match,
      score: g.score,
      titres: g.titres,
    }));
    const mvps: Actu[] = titres.length
      ? []
      : h.mvp
          .filter((m) => !isHidden(m.nom))
          .map((mvp) => ({ type: "mvp", id: `${cle}-mvp-${mvp.nom}`, j, date, mvp, variante: mvpVu++ }));
    const badges: Actu[] = h.decroches
      .filter((d) => BADGES_DU_FIL.has(d.id))
      .slice(0, 6)
      .map((d) => ({ type: "badge", id: `${cle}-badge-${d.nom}-${d.id}`, j, date, d, variante: badgeVu++ }));

    // Le premier score ouvre le dimanche, ses cartes le suivent ; les autres
    // matchs viennent ensuite, chacun suivi des siennes.
    const tete: Actu[] = [];
    const suivantes = titres.length ? titres : mvps;
    const n = Math.max(scores.length, suivantes.length);
    for (let i = 0; i < n; i++) {
      if (scores[i]) tete.push(scores[i]);
      if (suivantes[i]) tete.push(suivantes[i]);
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

    // Les meilleurs buteurs et passeurs du jour, en podium. Celui du chiffre
    // le porte : le record y est la première marche, sans rubrique à part.
    const podiums: Actu[] = [];
    let chiffrePorte = false;
    for (const quoi of ["buts", "passes"] as const) {
      const marches = podiumDuJour(lignes, quoi);
      if (marches.length < 2) continue;
      const record = chiffre?.type === "chiffre" && chiffre.quoi === quoi && marches.some((m) => m.nom === chiffre.nom) ? chiffre.nom : undefined;
      if (record) chiffrePorte = true;
      podiums.push({ type: "podium-jour", id: `${cle}-podium-${quoi}`, j, date, quoi, marches, record });
    }
    if (chiffre && !chiffrePorte) fil.push(chiffre);
    fil.push(...podiums);
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
