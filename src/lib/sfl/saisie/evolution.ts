// Évolution des cartes — la note bouge avec ce qui est écrit sur les feuilles.
//
// Sabri, 26/10/2026 : « tous les nouveaux à 75. D'après leurs buts, leurs
// passes, leur présence, leur nomination aux meilleurs défenseurs, joueurs
// impact, MVP, leurs statistiques évoluent » ; « qu'on voie des évolutions au
// fur et à mesure, mais que l'actualisation officielle de la carte se fasse »
// à intervalle régulier. Le but : que chacun comprenne sa note et lui fasse
// confiance, parce que chaque point se rattache à un dimanche précis.
// Proposition et simulation sur les vraies feuilles : le doc « Évolution des
// notes des cartes » (26/10) ; il a choisi que les joueurs déjà évalués
// partent de leur carte actuelle.
//
// Les règles :
//   · chaque stat a une jauge ; une action y verse des crans, et quand la
//     jauge est pleine la stat prend +1 et la jauge repart ;
//       but → 1 cran de TIR · passe décisive → 1 cran de PAS ·
//       titre Défensive → 3 crans de DEF · 2 interceptions ou 2 arrêts →
//       1 cran de DEF · titre Impact → 3 crans de DRI · MVP → 2 crans sur
//       ses deux meilleures stats · trois dimanches de suite présent, sans
//       retard → 3 crans de PHY (la série repart à zéro) ;
//   · plus la stat est haute, plus la jauge est grande (TAILLE_JAUGE) : un
//     buteur ne touche pas 99 en une saison ;
//   · ses deux règles combinées : +1 VIT chaque fois que TIR et PAS prennent
//     un point dans la même mise à jour, +1 DRI chaque fois que DEF et PHY le
//     font (le minimum des deux, compté à la mise à jour) ;
//   · la carte officielle ne change qu'à la mise à jour, toutes les
//     JOURNEES_PAR_MAJ journées jouées ; entre deux, les points gagnés se
//     voient « en attente » ;
//   · une note ne descend jamais. Un dimanche manqué, une absence ou un
//     retard cassent la série de physique, rien de plus. Une ligne d'extra
//     time ne compte pas (ni crans, ni présence) ;
//   · un titre voté (Impact, Défensive) ne compte pour la note qu'avec
//     VOIX_MIN voix : à la J3, treize Défensive étaient élues à une voix.
//
// Un gardien (poste G, Sabri 31/10) garde les six cases, sous des stats de
// gardien, avec son barème : arrêts → réflexes (TIR), passes D. et buts →
// dégagement (PAS), match sans encaisser et titre Défensive → placement
// (DEF), Impact → jeu à la main (DRI), +1 plongeon (VIT) quand réflexes et
// placement montent ensemble (lib/sfl/gardien.ts).
//
// On compte depuis la Saison 1 (SAISON_DEPART). Les saisons d'avant gardent
// leurs cartes telles qu'elles étaient. Pur, sans stockage : le moteur
// (computeStandings, computeBoostCards) le rappelle à chaque dérivation.

import { STAT_KEYS, type StatKey, type Stats } from "../engine";
import type { MatchEntry, Saison } from "./types";

export const SAISON_DEPART = 1;
export const JOURNEES_PAR_MAJ = 4;
export const VOIX_MIN = 2;
export const PLAFOND = 99;

/** Les crans à verser pour +1, selon le niveau de la stat. */
export function tailleJauge(v: number): number {
  if (v < 80) return 2;
  if (v < 85) return 3;
  if (v < 90) return 5;
  if (v < 95) return 8;
  return 12;
}

export const CRANS = {
  but: 1,
  passe: 1,
  defensive: 3,
  impact: 3,
  mvp: 2,
  serie: 3,
  /** Pour chaque paire d'interceptions, et pour chaque paire d'arrêts. */
  paireDefensive: 1,
  /** Un gardien : par arrêt (réflexes), par match sans encaisser (placement). */
  arret: 1,
  cleanSheet: 3,
} as const;

export const SERIE = 3;

/** Ce qui a bougé un dimanche, dans l'ordre où on le lit. */
export interface FaitEvolution {
  stat: StatKey;
  crans: number;
  /** « 2 buts », « titre Défensive », « 3 dimanches de suite »… */
  raison: string;
}

export interface JourEvolution {
  j: number;
  date: string;
  faits: FaitEvolution[];
  /** Les points pris ce jour-là (avant le jour de la mise à jour). */
  points: Partial<Record<StatKey, number>>;
  /** La série de présence après ce dimanche (0 à SERIE − 1), ou null s'il n'a pas joué. */
  serie: number | null;
}

export interface MiseAJour {
  /** La mise à jour tombe après cette journée. */
  apresJ: number;
  stats: Stats;
  /** Ce qu'elle a changé, stat par stat (combinées comprises). */
  gains: Partial<Record<StatKey, number>>;
}

export interface EvolutionJoueur {
  depart: Stats;
  /** La carte officielle : celle de la dernière mise à jour (ou le départ). */
  officielles: Stats;
  /** Les points gagnés depuis, pas encore officiels (vitesse et dribble combinées comprises). */
  enAttente: Partial<Record<StatKey, number>>;
  /** Les jauges en direct : crans versés sur la taille de la jauge. */
  jauges: Record<StatKey, { crans: number; taille: number }>;
  /** La série de présence en cours (0 à SERIE − 1). */
  serie: number;
  /** Ses dimanches, le plus récent d'abord. */
  journal: JourEvolution[];
  /** Les mises à jour passées, la plus récente d'abord. */
  majs: MiseAJour[];
}

export interface CalendrierEvolution {
  /** Les journées jouées de la saison, dans l'ordre. */
  jouees: number[];
  /** Combien de journées jouées avant la prochaine mise à jour (1 à JOURNEES_PAR_MAJ). */
  avantProchaine: number;
  /** La journée après laquelle tombe la prochaine mise à jour, si elle est déjà au calendrier. */
  prochaineApresJ: number | null;
  /** La journée de la dernière mise à jour, ou null. */
  derniereApresJ: number | null;
}

export interface Evolution {
  actif: boolean;
  calendrier: CalendrierEvolution;
  joueurs: Map<string, EvolutionJoueur>;
}

/** Un titre voté écarté de la note faute de voix : `${j}:${cat}:${joueur}`. */
export type TitresFaibles = ReadonlySet<string>;
export const cleTitre = (j: number, cat: "impact" | "def", joueur: string) => `${j}:${cat}:${joueur}`;

const vide = (): Record<StatKey, number> => ({ VIT: 0, TIR: 0, PAS: 0, DRI: 0, DEF: 0, PHY: 0 });
const pluriel = (n: number, s: string, p: string) => `${n} ${n > 1 ? p : s}`;

/**
 * La première combinée : +1 VIT quand TIR et PAS prennent un point ensemble ;
 * pour un gardien, +1 plongeon (VIT) quand réflexes (TIR) et placement (DEF)
 * le font.
 */
function combineeVit(periode: Record<StatKey, number>, gardien: boolean): number {
  return Math.min(periode.TIR, gardien ? periode.DEF : periode.PAS);
}

/** Une journée est jouée quand l'admin y a saisi au moins un résultat. */
export function journeesJouees(saison: Pick<Saison, "entries" | "journees">): number[] {
  const avecResultat = new Set(saison.entries.filter((e) => e.result && !e.extraTime).map((e) => e.j));
  return [...saison.journees].map((m) => m.j).filter((j) => avecResultat.has(j)).sort((a, b) => a - b);
}

export function evolutionActive(saison: Pick<Saison, "numero">): boolean {
  return (saison.numero ?? 0) >= SAISON_DEPART;
}

/**
 * Rejoue la saison dimanche par dimanche. `depart` donne la carte de départ
 * de chacun (la base de sa fiche, 75 partout sans évaluation).
 */
export function evoluer(
  saison: Saison,
  depart: (nom: string) => Stats,
  titresFaibles: TitresFaibles = new Set(),
  /**
   * La raison écrite sous la série de physique : « 3 dimanches de suite »
   * pour la SFL, « 3 matchs de suite » pour un joueur Bola (lib/sfl/
   * carte-bola.ts, choix par défaut, 28/10), dont chaque match validé est
   * une « journée ». Rien d'autre ne change.
   */
  options: {
    raisonSerie?: string;
    /** Les gardiens (poste G) suivent leur barème à eux (lib/sfl/gardien.ts). */
    gardien?: (nom: string) => boolean;
    /** Les buts encaissés par l'équipe du joueur ce jour-là, quand on les connaît. */
    encaisses?: (j: number, nom: string) => number | null;
  } = {}
): Evolution {
  const estGardien = options.gardien ?? (() => false);
  const jouees = journeesJouees(saison);
  const derniere = jouees.length >= JOURNEES_PAR_MAJ ? jouees[Math.floor(jouees.length / JOURNEES_PAR_MAJ) * JOURNEES_PAR_MAJ - 1] : null;
  const reste = JOURNEES_PAR_MAJ - (jouees.length % JOURNEES_PAR_MAJ);
  const auCalendrier = [...saison.journees].map((m) => m.j).filter((j) => !jouees.includes(j)).sort((a, b) => a - b);
  const calendrier: CalendrierEvolution = {
    jouees,
    avantProchaine: reste,
    prochaineApresJ: auCalendrier[reste - 1] ?? null,
    derniereApresJ: derniere,
  };
  const joueurs = new Map<string, EvolutionJoueur>();
  if (!evolutionActive(saison)) return { actif: false, calendrier, joueurs };

  const dateDe = new Map(saison.journees.map((m) => [m.j, m.date]));
  const parJ = new Map<number, MatchEntry[]>();
  for (const e of saison.entries) {
    if (e.extraTime) continue;
    const l = parJ.get(e.j) ?? [];
    l.push(e);
    parJ.set(e.j, l);
  }

  interface Etat {
    depart: Stats;
    officielles: Stats;
    live: Record<StatKey, number>;
    crans: Record<StatKey, number>;
    periode: Record<StatKey, number>;
    serie: number;
    journal: JourEvolution[];
    majs: MiseAJour[];
  }
  const etats = new Map<string, Etat>();
  const etat = (nom: string): Etat => {
    let s = etats.get(nom);
    if (!s) {
      const d = depart(nom);
      s = {
        depart: { ...d },
        officielles: { ...d },
        live: { ...d },
        crans: vide(),
        periode: vide(),
        serie: 0,
        journal: [],
        majs: [],
      };
      etats.set(nom, s);
    }
    return s;
  };

  jouees.forEach((j, idx) => {
    const lignes = parJ.get(j) ?? [];
    const vus = new Set<string>();
    for (const e of lignes) {
      if (vus.has(e.player)) continue; // un doublon de saisie ne compte qu'une fois
      vus.add(e.player);
      const s = etat(e.player);
      const jour: JourEvolution = { j, date: dateDe.get(j) ?? "", faits: [], points: {}, serie: null };
      const verser = (stat: StatKey, crans: number, raison: string) => {
        if (crans <= 0) return;
        s.crans[stat] += crans;
        jour.faits.push({ stat, crans, raison });
      };
      if (e.statut === "Présent" && estGardien(e.player)) {
        // Le gardien (lib/sfl/gardien.ts) : TIR = réflexes, PAS = dégagement,
        // DEF = placement, DRI = jeu à la main ; PLO (VIT) vient des combinées.
        verser("TIR", (e.arrets ?? 0) * CRANS.arret, pluriel(e.arrets ?? 0, "arrêt", "arrêts"));
        verser("PAS", e.passes * CRANS.passe, pluriel(e.passes, "passe D.", "passes D."));
        verser("PAS", e.buts * CRANS.but, pluriel(e.buts, "but", "buts"));
        const encaisses = e.result ? (options.encaisses?.(j, e.player) ?? null) : null;
        if (e.cleanSheet || encaisses === 0) verser("DEF", CRANS.cleanSheet, "aucun but encaissé");
        if (e.def && !titresFaibles.has(cleTitre(j, "def", e.player))) verser("DEF", CRANS.defensive, "titre Défensive");
        const paires = Math.floor((e.interceptions ?? 0) / 2);
        if (paires > 0) verser("DEF", paires * CRANS.paireDefensive, pluriel(e.interceptions ?? 0, "interception", "interceptions"));
        if (e.impact && !titresFaibles.has(cleTitre(j, "impact", e.player))) verser("DRI", CRANS.impact, "titre Impact");
      } else if (e.statut === "Présent") {
        verser("TIR", e.buts * CRANS.but, pluriel(e.buts, "but", "buts"));
        verser("PAS", e.passes * CRANS.passe, pluriel(e.passes, "passe D.", "passes D."));
        if (e.def && !titresFaibles.has(cleTitre(j, "def", e.player))) verser("DEF", CRANS.defensive, "titre Défensive");
        const paires = Math.floor((e.interceptions ?? 0) / 2) + Math.floor((e.arrets ?? 0) / 2);
        if (paires > 0) {
          const quoi = [
            e.interceptions ? pluriel(e.interceptions, "interception", "interceptions") : "",
            e.arrets ? pluriel(e.arrets, "arrêt", "arrêts") : "",
          ].filter(Boolean);
          verser("DEF", paires * CRANS.paireDefensive, quoi.join(", "));
        }
        if (e.impact && !titresFaibles.has(cleTitre(j, "impact", e.player))) verser("DRI", CRANS.impact, "titre Impact");
      }
      if (e.statut === "Présent") {
        if (e.mvp) {
          // Ses deux meilleures stats du moment, la première dans l'ordre de la carte à égalité.
          const top = [...STAT_KEYS].sort((a, b) => s.live[b] - s.live[a] || STAT_KEYS.indexOf(a) - STAT_KEYS.indexOf(b)).slice(0, 2);
          for (const k of top) verser(k, CRANS.mvp, "MVP");
        }
        if (e.retard) s.serie = 0;
        else if (++s.serie >= SERIE) {
          s.serie = 0;
          verser("PHY", CRANS.serie, options.raisonSerie ?? `${SERIE} dimanches de suite`);
        }
        jour.serie = s.serie;
      } else {
        // Absent, blessé, suspendu : la série repart, rien ne descend.
        s.serie = 0;
        jour.serie = 0;
      }
      // Les jauges pleines donnent leurs points, à la taille du moment.
      for (const k of STAT_KEYS) {
        while (s.live[k] < PLAFOND && s.crans[k] >= tailleJauge(s.live[k])) {
          s.crans[k] -= tailleJauge(s.live[k]);
          s.live[k] += 1;
          s.periode[k] += 1;
          jour.points[k] = (jour.points[k] ?? 0) + 1;
        }
        if (s.live[k] >= PLAFOND) s.crans[k] = 0;
      }
      s.journal.unshift(jour);
    }
    // Un joueur qui n'est pas venu ce dimanche perd sa série.
    for (const [nom, s] of etats) if (!vus.has(nom)) s.serie = 0;

    // Le jour de la mise à jour : les combinées, puis la carte devient officielle.
    if ((idx + 1) % JOURNEES_PAR_MAJ === 0) {
      for (const [nom, s] of etats) {
        const vit = combineeVit(s.periode, estGardien(nom));
        const dri = Math.min(s.periode.DEF, s.periode.PHY);
        s.live.VIT = Math.min(PLAFOND, s.live.VIT + vit);
        s.live.DRI = Math.min(PLAFOND, s.live.DRI + dri);
        const gains: Partial<Record<StatKey, number>> = {};
        for (const k of STAT_KEYS) {
          const g = s.live[k] - s.officielles[k];
          if (g > 0) gains[k] = g;
        }
        if (Object.keys(gains).length) s.majs.unshift({ apresJ: j, stats: { ...s.live }, gains });
        s.officielles = { ...s.live };
        s.periode = vide();
      }
    }
  });

  for (const [nom, s] of etats) {
    const enAttente: Partial<Record<StatKey, number>> = {};
    for (const k of STAT_KEYS) {
      const g = s.live[k] - s.officielles[k];
      if (g > 0) enAttente[k] = g;
    }
    const vit = combineeVit(s.periode, estGardien(nom));
    const dri = Math.min(s.periode.DEF, s.periode.PHY);
    if (vit) enAttente.VIT = Math.min(PLAFOND - s.officielles.VIT, (enAttente.VIT ?? 0) + vit) || undefined;
    if (dri) enAttente.DRI = Math.min(PLAFOND - s.officielles.DRI, (enAttente.DRI ?? 0) + dri) || undefined;
    for (const k of STAT_KEYS) if (!enAttente[k]) delete enAttente[k];
    const jauges = {} as EvolutionJoueur["jauges"];
    for (const k of STAT_KEYS) jauges[k] = { crans: s.crans[k], taille: s.live[k] >= PLAFOND ? 0 : tailleJauge(s.live[k]) };
    joueurs.set(nom, {
      depart: s.depart,
      officielles: s.officielles,
      enAttente,
      jauges,
      serie: s.serie,
      journal: s.journal,
      majs: s.majs,
    });
  }
  return { actif: true, calendrier, joueurs };
}

/** La carte officielle d'un joueur le jour d'une journée : celle de la dernière mise à jour d'avant. */
export function officiellesAu(ev: EvolutionJoueur | undefined, j: number): Stats | null {
  if (!ev) return null;
  return ev.majs.find((m) => m.apresJ < j)?.stats ?? ev.depart;
}
