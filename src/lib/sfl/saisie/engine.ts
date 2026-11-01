// Moteur de dérivation de la saisie admin.
//
// Entrée : une `Saison` brute (roster + lignes de match, cf. types.ts).
// Sortie : exactement les structures consommées par l'app existante
// (Player[], Journee[], BoostCardData[]) + des alertes de cohérence.
//
// C'est le portage TypeScript de la logique qui servait à importer l'Excel :
// barème des Points Pépite, composition des équipes par couleur, formule des
// cartes boost par type, contrôles de saisie. Aucune dépendance au stockage.

import {
  ovr,
  rareStats,
  STAT_KEYS,
  type BoostCardData,
  type BoostType,
  type Journee,
  type JourneeMatch,
  type MatchTeam,
  type Player,
  type PlayerStatus,
  type Stats,
} from "../engine";
import { equipesDuMatch, lireEquipe } from "./equipes";
import { neJouePas } from "../hidden";
import type { MatchDuJour, MatchEntry, RosterEntry, Saison, SaisieAlert } from "./types";
import { estGardien } from "../gardien";
import { evoluer, officiellesAu, type Evolution, type TitresFaibles } from "./evolution";

/* ------------------------------- Barème ------------------------------- */

const BAREME = {
  presence: 1,
  victoire: 2,
  victoireSflTime: 3,
  nul: 1,
  but: 1,
  passe: 1,
  mvp: 2,
  impact: 1,
  def: 1,
  cleanSheet: 3,
  retard: -1,
  absenceInjustifiee: -2,
  // Feuille de match : chaque PAIRE d'arrêts vaut 1 point Pépite, chaque
  // paire d'interceptions aussi. Les deux compteurs sont indépendants.
  parPaireDefensive: 1,
  paire: 2,
  // Extra time : un joueur qui a déjà joué vient compléter une équipe. S'il
  // marque ou fait une passe décisive, c'est +1, et rien d'autre : ni stats,
  // ni journée de plus (Sabri, 25/10).
  extraTime: 1,
} as const;

const STAT_CAP = 99;
const DEFAULT_BASE = [75, 75, 75, 75, 75, 75];

function toStats(base: number[] | null | undefined): Stats {
  const b = base && base.length === 6 ? base : DEFAULT_BASE;
  return { VIT: b[0], TIR: b[1], PAS: b[2], DRI: b[3], DEF: b[4], PHY: b[5] };
}

function rosterMap(saison: Saison): Map<string, RosterEntry> {
  return new Map(saison.roster.map((r) => [r.name, r]));
}

/**
 * L'évolution des cartes de la saison (evolution.ts) : chacun part de la base
 * de sa fiche, 75 partout sans évaluation. Les saisons d'avant la Saison 1
 * n'évoluent pas : leurs cartes restent leur base.
 */
export function evolutionDe(saison: Saison, titresFaibles?: TitresFaibles): Evolution {
  const roster = rosterMap(saison);
  // Une saison close porte ses titres faibles, figés à la clôture (cloturerSaison).
  const faibles = titresFaibles ?? (saison.titresFaibles?.length ? new Set(saison.titresFaibles) : undefined);
  // Les buts encaissés, pour le barème des gardiens : le score d'en face.
  const encaisses = new Map<string, number>();
  for (const jr of computeJournees(saison))
    for (const m of jr.matches ?? [])
      for (const [moi, eux] of [
        [m.teamA, m.teamB],
        [m.teamB, m.teamA],
      ])
        for (const l of moi.players) encaisses.set(`${jr.j}:${l.name}`, eux.score);
  return evoluer(saison, (nom) => toStats(roster.get(nom)?.base), faibles, {
    gardien: (nom) => estGardien(roster.get(nom)?.poste),
    encaisses: (j, nom) => encaisses.get(`${j}:${nom}`) ?? null,
  });
}

/** Une journée est jouée quand ses actions sont saisies : un résultat, un but ou une passe. */
export function journeeJouee(saison: Pick<Saison, "entries">, j: number): boolean {
  return saison.entries.some((e) => e.j === j && (!!e.result || e.buts > 0 || e.passes > 0));
}

/**
 * Une journée est terminée quand chaque équipe de sa feuille a son résultat
 * (comme feuilleRemplie, équipe par équipe). Le premier but saisi en direct
 * rend la journée « jouée » — les classements suivent le direct —, mais les
 * divisions ne se recoupent, et le dimanche suivant ne s'annonce, qu'une fois
 * la feuille finie : sinon les joueurs changeaient de division en plein match.
 */
export function journeeTerminee(saison: Pick<Saison, "entries">, j: number): boolean {
  if (!journeeJouee(saison, j)) return false;
  const equipes = new Map<string, boolean>();
  for (const e of saison.entries) {
    if (e.j !== j || e.statut !== "Présent" || e.extraTime || !e.team) continue;
    equipes.set(e.team, (equipes.get(e.team) ?? false) || !!e.result);
  }
  return [...equipes.values()].every(Boolean);
}

/**
 * Les lignes qui comptent dans les classements : celles des journées jouées.
 * Une feuille posée avant le dimanche (poserEquipes, « Préparer la journée »)
 * donnerait sinon le point de présence et un match à chacun de ses joueurs
 * avant le coup d'envoi — ce que le découpage des divisions et la courbe de
 * Ma carte ne comptent pas (27/10 : deux places différentes pour le même
 * joueur selon l'écran). Même référence si rien n'est retiré.
 */
export function saisonJouee(saison: Saison): Saison {
  const jouees = new Set<number>();
  for (const e of saison.entries) if (e.result || e.buts > 0 || e.passes > 0) jouees.add(e.j);
  const entries = saison.entries.filter((e) => jouees.has(e.j));
  return entries.length === saison.entries.length ? saison : { ...saison, entries };
}

/* ---------------------------- Classements ---------------------------- */

interface Agg {
  pp: number;
  matchs: number;
  buts: number;
  passes: number;
  mvp: number;
  impact: number;
  def: number;
  absInj: number;
}

const emptyAgg = (): Agg => ({
  pp: 0,
  matchs: 0,
  buts: 0,
  passes: 0,
  mvp: 0,
  impact: 0,
  def: 0,
  absInj: 0,
});

export function entryPP(e: MatchEntry): number {
  if (e.extraTime) return (e.buts + e.passes > 0 ? BAREME.extraTime : 0) + (e.pepiteBonus ?? 0);
  // Une ligne qui n'est pas une présence ne rapporte pas le point de présence :
  // un blessé, un suspendu ou un absent justifié est à zéro, comme dans la
  // colonne « PP du match » du classeur. L'absence injustifiée, elle, coûte.
  // (Les classements passaient déjà par ce chemin ; c'est l'affichage ligne à
  // ligne de la grille qui exigeait de le dire ici.)
  if (e.statut !== "Présent") {
    const penalite = e.statut === "Absence injustifiée" ? BAREME.absenceInjustifiee : 0;
    return penalite + (e.pepiteBonus ?? 0);
  }
  let pp = BAREME.presence;
  if (e.result === "Victoire") pp += e.sflTime ? BAREME.victoireSflTime : BAREME.victoire;
  else if (e.result === "Nul") pp += BAREME.nul;
  pp += e.buts * BAREME.but + e.passes * BAREME.passe;
  if (e.cleanSheet) pp += BAREME.cleanSheet;
  if (e.mvp) pp += BAREME.mvp;
  if (e.impact) pp += BAREME.impact;
  if (e.def) pp += BAREME.def;
  if (e.retard) pp += BAREME.retard;
  pp +=
    (Math.floor((e.arrets ?? 0) / BAREME.paire) +
      Math.floor((e.interceptions ?? 0) / BAREME.paire)) *
    BAREME.parPaireDefensive;
  return pp + (e.pepiteBonus ?? 0);
}

function seasonStatut(profil: string, absInj: number): PlayerStatus {
  if (profil === "Blessure") return "Blessure";
  if (absInj >= 1) return "Suspendu";
  return "Actif";
}

export function computeStandings(saison: Saison, evolution: Evolution = evolutionDe(saison)): Player[] {
  const roster = rosterMap(saison);
  const agg = new Map<string, Agg>();
  const get = (n: string) => {
    let a = agg.get(n);
    if (!a) agg.set(n, (a = emptyAgg()));
    return a;
  };

  for (const e of saison.entries) {
    const a = get(e.player);
    if (e.extraTime) {
      a.pp += entryPP(e); // extra time : ni présence ni match, juste son +1 et le bonus
      continue;
    }
    // UNE SEULE formule de points, celle de `entryPP` — la même que la colonne
    // PP de la grille de saisie. Le classement recalculait auparavant les
    // absences de son côté et ignorait purement le bonus manuel posé sur une
    // ligne de blessure ou d'absence justifiée : la grille affichait un total,
    // le classement en affichait un autre.
    a.pp += entryPP(e);
    if (e.statut === "Présent") {
      a.matchs += 1;
      a.buts += e.buts;
      a.passes += e.passes;
      if (e.mvp) a.mvp += 1;
      if (e.impact) a.impact += 1;
      if (e.def) a.def += 1;
    } else if (e.statut === "Absence injustifiée") {
      a.absInj += 1;
    }
  }

  // Joueurs du roster évalués mais qui n'ont pas encore joué : présents à 0
  // dans les classements « showAll » (OVR, présences, discipline).
  for (const r of saison.roster) {
    if (!agg.has(r.name) && r.base && r.profil !== "En attente") agg.set(r.name, emptyAgg());
  }

  const players: Player[] = [...agg.entries()].map(([name, a]) => {
    const r = roster.get(name);
    return {
      name,
      poste: r?.poste || "—",
      pp: a.pp,
      matchs: a.matchs,
      buts: a.buts,
      passes: a.passes,
      statut: seasonStatut(r?.profil ?? "Actif", a.absInj),
      // La carte officielle : la base de la fiche, puis ses mises à jour.
      stats: evolution.joueurs.get(name)?.officielles ?? toStats(r?.base),
      mvp: a.mvp,
      impact: a.impact,
      def: a.def,
      ...(a.absInj ? { absInj: a.absInj } : {}),
    };
  });

  return players.sort((x, y) => y.pp - x.pp || x.name.localeCompare(y.name));
}

/* ------------------------------ Journées ------------------------------ */

// Le pluriel est porté par l'appelant : coller un « s » à la fin de
// « passe D. » donnait « 4 passe D.s ».
function bestFait(
  entries: MatchEntry[],
  key: "buts" | "passes",
  singulier: string,
  pluriel: string
) {
  const max = Math.max(0, ...entries.map((e) => e[key]));
  if (max <= 0) return undefined;
  const who = entries.filter((e) => e[key] === max).map((e) => e.player);
  return `${who.join(" & ")} — ${max} ${max > 1 ? pluriel : singulier}`;
}

function buildTeam(j: number, mi: number, name: string, members: MatchEntry[]): MatchTeam {
  const score = members.reduce((s, e) => s + e.buts + (e.teamScoreBonus ?? 0), 0);
  const slug = name.toLowerCase().replace(/[^a-z]+/g, "") || "eq";
  return {
    id: `j${j}-m${mi}-${slug}`,
    name,
    score,
    players: members.map((e) => ({
      name: e.player,
      buts: e.buts,
      passes: e.passes,
      ...(e.note ? { note: e.note } : e.extraTime ? { note: "Extra time" } : {}),
      ...(e.extraTime ? { extraTime: true as const } : {}),
    })),
  };
}

export function computeJournees(saison: Saison): Journee[] {
  const byJ = new Map<number, MatchEntry[]>();
  for (const e of saison.entries) {
    const list = byJ.get(e.j) ?? [];
    list.push(e);
    byJ.set(e.j, list);
  }

  return [...saison.journees]
    .sort((a, b) => a.j - b.j)
    .map((meta): Journee => {
      const entries = byJ.get(meta.j) ?? [];
      const played = entries.filter((e) => e.statut === "Présent" && !e.extraTime);
      const faits = {
        buteur: bestFait(played, "buts", "but", "buts"),
        passeur: bestFait(played, "passes", "passe D.", "passes D."),
      };

      // Jamais dans une équipe : une ligne du compte vitrine (elle ne vit
      // que sur son écran) ni celle d'un membre qui ne joue pas (30/10 : le
      // compte de Sabri apparaissait sur le terrain de chaque match).
      const teamEntries = entries.filter(
        (e) => e.team && (e.statut === "Présent" || e.extraTime) && !e.vitrine && !neJouePas(e.player)
      );

      if (teamEntries.length > 0) {
        // Regroupe par équipe, dans l'ordre d'apparition, puis apparie 2 à 2.
        const order: string[] = [];
        const groups = new Map<string, MatchEntry[]>();
        for (const e of teamEntries) {
          const t = e.team as string;
          if (!groups.has(t)) {
            groups.set(t, []);
            order.push(t);
          }
          groups.get(t)!.push(e);
        }
        // Les matchs écrits par l'admin passent d'abord, dans leur ordre, avec
        // leur heure, leur lieu et leur terrain (JourneeMeta.matchsDuJour) ;
        // un match dont une équipe n'a plus personne tombe. Puis les équipes
        // d'avant le 23/10 (Orange, Bleu…), deux à deux dans leur ordre
        // d'apparition ; puis les Noirs et les Blancs d'un même match
        // (« Noirs 2 » contre « Blancs 2 », saisie/equipes.ts), par numéro.
        const paires: { a: string; b: string; reglage?: MatchDuJour }[] = [];
        const prises = new Set<string>();
        const prendre = (a: string, b: string, reglage?: MatchDuJour) => {
          prises.add(a);
          prises.add(b);
          paires.push({ a, b, reglage });
        };
        for (const m of meta.matchsDuJour ?? []) {
          const [a, b] = m.equipes;
          if (a === b || !groups.has(a) || !groups.has(b) || prises.has(a) || prises.has(b)) continue;
          prendre(a, b, m);
        }
        const numerotes: { noirs: string; blancs: string; n: number }[] = [];
        for (const t of order) {
          const lu = lireEquipe(t);
          if (lu?.camp !== "Noirs" || prises.has(t)) continue;
          const [, blancs] = equipesDuMatch(lu.n);
          if (groups.has(blancs) && !prises.has(blancs)) numerotes.push({ noirs: t, blancs, n: lu.n });
        }
        numerotes.sort((x, y) => x.n - y.n);
        const appariees = new Set(numerotes.flatMap((x) => [x.noirs, x.blancs]));
        // L'appariement par ordre d'arrivée ne sert qu'aux journées d'avant
        // les matchs écrits (23/10) : sinon une équipe hors des matchs déclarés
        // devenait un « Match 5 » inventé (la J3, 28/10). Elle reste à part,
        // et l'admin la voit comme un défaut (integrite.ts, I3).
        const reste = meta.matchsDuJour?.length ? [] : order.filter((t) => !prises.has(t) && !appariees.has(t));
        for (let i = 0; i + 1 < reste.length; i += 2) prendre(reste[i], reste[i + 1]);
        for (const x of numerotes) prendre(x.noirs, x.blancs);

        const matches: JourneeMatch[] = [];
        // Plusieurs matchs le même jour : « Match 1 », « Match 2 »… C'est ce
        // qui les distingue, avec leur heure, leur lieu et leur terrain.
        paires.forEach(({ a, b, reglage }, i) => {
          const mi = i + 1;
          matches.push({
            id: `j${meta.j}-m${mi}`,
            label: `Match ${mi}`,
            teamA: buildTeam(meta.j, mi, a, groups.get(a)!),
            teamB: buildTeam(meta.j, mi, b, groups.get(b)!),
            ...(reglage?.heure ? { heure: reglage.heure } : {}),
            ...(reglage?.lieuId != null ? { lieuId: reglage.lieuId } : {}),
            ...(reglage?.terrain?.trim() ? { terrain: reglage.terrain } : {}),
          });
        });
        return { j: meta.j, date: meta.date, sflTime: meta.sflTime, matches, faits, ...(meta.mvpAuto ? { mvpAuto: true } : {}) };
      }

      // Pas d'équipes : repli plat.
      const lignes = played.map(
        (e): [string, "V" | "D" | "-", number, number] => [
          e.player,
          e.result === "Victoire" ? "V" : e.result === "Défaite" ? "D" : "-",
          e.buts,
          e.passes,
        ]
      );
      return { j: meta.j, date: meta.date, sflTime: meta.sflTime, lignes, faits, ...(meta.mvpAuto ? { mvpAuto: true } : {}) };
    });
}

/* ----------------------------- Cartes boost ---------------------------- */

const TYPE_ORDER: Record<BoostType, number> = { mvp: 0, impact: 1, def: 2 };

/**
 * Stats d'une carte Boost.
 *
 * Ordre de dérivation : base du roster → carte **Rare** → bonus du type →
 * performance du jour → plafond 99.
 *
 * Le passage par la Rare est essentiel : appliquer les bonus directement sur
 * la base produisait, pour le type « impact », exactement la formule de
 * `rareStats` — autrement dit une carte Impact rigoureusement identique à la
 * carte Rare du joueur.
 */
function boostStats(base: Stats, type: BoostType, buts: number, passes: number): Stats {
  // On part de la carte Rare, calculée par la même fonction que partout
  // ailleurs dans l'app pour éviter deux formules divergentes.
  const rare = rareStats(base);
  const s = STAT_KEYS.map((k) => rare[k]);

  if (type === "mvp" || type === "impact") {
    // +3 sur les deux meilleures stats de la Rare, le reste uniformément.
    const top2 = new Set(
      s
        .map((v, i) => [v, i] as const)
        .sort((a, b) => b[0] - a[0] || a[1] - b[1])
        .slice(0, 2)
        .map(([, i]) => i)
    );
    const other = type === "mvp" ? 2 : 1;
    for (let i = 0; i < 6; i++) s[i] += top2.has(i) ? 3 : other;
  } else {
    // Défensive : +2 DEF et +2 PHY, la vitesse suivant automatiquement
    // (chaque +1 DEF conjugué à un +1 PHY donne +1 VIT), +1 sur le reste.
    s[4] += 2; // DEF
    s[5] += 2; // PHY
    s[0] += 2; // VIT (auto)
    s[1] += 1; // TIR
    s[2] += 1; // PAS
    s[3] += 1; // DRI
  }

  // Performance du jour.
  s[1] += buts;
  s[2] += passes;

  const c = s.map((v) => Math.min(STAT_CAP, v));
  return { VIT: c[0], TIR: c[1], PAS: c[2], DRI: c[3], DEF: c[4], PHY: c[5] };
}

/**
 * Les stats d'une carte à titre, pour qui n'a pas de ligne de saison : la
 * carte MVP d'un match Bola (lib/sfl/carte-bola.ts). La même formule que les
 * cartes de la SFL (boostStats), rien de plus.
 */
export function statsCarteTitre(base: Stats, type: BoostType, buts: number, passes: number): Stats {
  return boostStats(base, type, buts, passes);
}

export function computeBoostCards(saison: Saison, evolution: Evolution = evolutionDe(saison)): BoostCardData[] {
  const roster = rosterMap(saison);
  const dateOf = new Map(saison.journees.map((m) => [m.j, m.date]));
  const cards: (BoostCardData & { _j: number })[] = [];

  for (const e of saison.entries) {
    if (e.statut !== "Présent" || e.extraTime) continue;
    // La carte officielle de ce dimanche-là : une carte du jour ne descend
    // pas sous la carte du joueur.
    const base = officiellesAu(evolution.joueurs.get(e.player), e.j) ?? toStats(roster.get(e.player)?.base);
    const honors: BoostType[] = [];
    if (e.mvp) honors.push("mvp");
    if (e.impact) honors.push("impact");
    if (e.def) honors.push("def");
    for (const type of honors) {
      const stats = boostStats(base, type, e.buts, e.passes);
      cards.push({
        _j: e.j,
        player: e.player,
        type,
        ovr: ovr(stats),
        poste: roster.get(e.player)?.poste || "—",
        date: `J${e.j} · ${dateOf.get(e.j) ?? ""}`,
        stats,
      });
    }
  }

  cards.sort(
    (a, b) => a._j - b._j || TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.player.localeCompare(b.player)
  );
  return cards.map(({ _j, ...c }) => {
    void _j;
    return c;
  });
}

/* ------------------------------- Alertes ------------------------------- */

export function computeAlerts(saison: Saison): SaisieAlert[] {
  const alerts: SaisieAlert[] = [];
  const names = new Set(saison.roster.map((r) => r.name));
  const seen = new Map<string, number>();

  for (const e of saison.entries) {
    if (e.extraTime) continue;
    const key = `${e.j}::${e.player}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (seen.get(key) === 2)
      alerts.push({ level: "error", j: e.j, player: e.player, message: "Doublon joueur / journée" });

    if (!names.has(e.player))
      alerts.push({ level: "warning", j: e.j, player: e.player, message: "Joueur absent du roster" });

    if (e.statut === "Présent" && !e.result)
      alerts.push({ level: "warning", j: e.j, player: e.player, message: "Saisie incomplète (résultat manquant)" });

    const hasStats = e.buts > 0 || e.passes > 0 || e.mvp || e.impact || e.def || e.cleanSheet;
    if (e.statut !== "Présent" && hasStats)
      alerts.push({ level: "warning", j: e.j, player: e.player, message: "Stats saisies sans présence" });
  }
  return alerts;
}

/* ------------------------------ Aggrégat ------------------------------ */

export interface DerivedSeason {
  /** Les cartes qui évoluent : jauges, points en attente, mises à jour (evolution.ts). */
  evolution: Evolution;
  players: Player[];
  journees: Journee[];
  boostCards: BoostCardData[];
  alerts: SaisieAlert[];
}

export function deriveSeason(saison: Saison, titresFaibles?: TitresFaibles): DerivedSeason {
  const evolution = evolutionDe(saison, titresFaibles);
  return {
    evolution,
    // Les classements ne lisent que les journées jouées (saisonJouee) ; les
    // journées, elles, montrent aussi la feuille posée du prochain dimanche.
    players: computeStandings(saisonJouee(saison), evolution),
    journees: computeJournees(saison),
    boostCards: computeBoostCards(saison, evolution),
    alerts: computeAlerts(saison),
  };
}
