// La carte d'un joueur Bola : elle bouge à chaque match validé.
//
// Sabri, 28/10/2026, des joueurs venus par un lien de parrainage, hors de la
// SFL : « qu'ils puissent faire leurs matchs, leurs cartes, etc., comme les
// autres utilisateurs » ; « il y a une évolution de stats » ; « Pareil pour
// xp etc » ; « leur carte s'actualise à chaque match » ; « il n'y a pas de
// vote […] pas de carte d'impact de joueur, pas de carte défensive. Il y a
// juste une carte MVP attribuée automatiquement aux meilleurs joueurs ».
//
// Ce qu'on en a retenu (choix par défaut, 28/10 ; chaque choix tient dans
// une constante ou une ligne, réversible) :
//   · « pareil » = la même échelle que la SFL : les mêmes crans, les mêmes
//     jauges, les mêmes combinées et le même plafond (saisie/evolution.ts),
//     en partant de 75 partout. Le moteur n'est pas réécrit : on lui donne
//     une saison synthétique où chaque match validé est une « journée », et
//     on lit la carte EN DIRECT (officielle + en attente, comme MaNote) : elle
//     bouge à chaque match au lieu de toutes les 4 journées. Ce qui s'y
//     applique : but → 1 cran de TIR, passe → 1 cran de PAS, MVP → 2 crans
//     sur ses deux meilleures stats, 3 matchs validés de suite → 3 crans de
//     PHY. Ni Impact, ni Défensive, ni interceptions : Bola n'en a pas ;
//   · un match ne compte qu'à l'état « compte » de la confirmation des
//     résultats (MatchCompte.valide : quorum de 8, pas d'exhibition, validé
//     par les joueurs) ; en attente, contesté ou non validé, il n'existe pas
//     pour la carte. Tout est dérivé : une correction de l'organisateur qui
//     remet le match en attente le retire, et la carte peut redescendre ;
//   · deux matchs le même jour comptent tous les deux pour la carte, l'XP et
//     les missions (UN_PAR_JOUR), même si le classement n'en classe qu'un ;
//   · la carte MVP : en or, au format des cartes MVP de la SFL
//     (statsCarteTitre), une par match validé où il est MVP (ex æquo
//     compris), sur la carte qu'il avait juste avant ce match ;
//   · ses stats Bola n'entrent jamais dans la saison SFL : s'il rejoint la
//     SFL, sa carte SFL repart de la base de sa fiche ; la base cesse de lui
//     rendre ses matchs Bola d'après (mes_matchs_bola, entrees_sfl).
//
// Pur : ni React ni réseau. Les matchs viennent de mes_matchs_bola()
// (supabase/schema.sql), le même JSON que ligue_vierge(), passé par
// compterMatchs (ligue-vierge.ts) : le même quorum, le même état, le même
// MVP que le classement.

import { ovr, STAT_KEYS, type BoostCardData, type Player, type StatKey, type Stats } from "./engine";
import { heureMin, type LigneComptee, type MatchCompte } from "./ligue-vierge";
import { statsCarteTitre } from "./saisie/engine";
import { evoluer, SAISON_DEPART, SERIE, type EvolutionJoueur } from "./saisie/evolution";
import type { MatchEntry, Saison } from "./saisie/types";

/** Un seul match par jour pour la carte, comme le classement ? Non (choix par défaut, 28/10). */
export const UN_PAR_JOUR = false;

/** La carte de départ d'un joueur Bola : 75 partout, comme un nouveau de la saison. */
export const BASE_BOLA: Stats = { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 };

/** La raison de la série de physique, un match validé valant une journée (choix par défaut, 28/10). */
// « De suite » ne disait rien : chaque match validé compte, même à des
// semaines d'écart (revue, 28/10).
export const RAISON_SERIE_BOLA = `${SERIE} matchs validés`;

/** Un match validé, et ma ligne. */
export interface MatchValide {
  m: MatchCompte;
  ligne: LigneComptee;
  /** « 22 oct. · 19h30 » : sa date dans le journal, unique par match avec l'heure. */
  libelle: string;
}

export interface CarteMvpBola {
  carte: BoostCardData;
  /** Le joueur tel que la carte l'a figé : à passer à MiniCarte. */
  player: Player;
  /** Le rang du match parmi ses matchs validés (1 pour le premier). */
  k: number;
  libelle: string;
}

export interface CarteBola {
  nom: string;
  poste: string;
  valides: MatchValide[];
  /** L'évolution lue en direct (evolutionEnDirect) : rien « en attente », pas de mise à jour. */
  ev: EvolutionJoueur | null;
  /** La carte en direct. */
  stats: Stats;
  player: Player;
  /** La note après chaque match validé, du premier au dernier (75 avant). */
  notes: { libelle: string; note: number }[];
  /** Ses cartes MVP, du premier match au dernier. */
  cartesMvp: CarteMvpBola[];
}

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 2026-10-22 » → « 22 oct. » (la date seule, sans fuseau). */
export function jourCourt(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${d} ${MOIS[m - 1]}` : iso;
}

/** « 19:30 » ou « 19h30 » → « 19h30 ». */
function heureCourte(h: string): string {
  const n = heureMin(h);
  return `${Math.floor(n / 60)}h${String(n % 60).padStart(2, "0")}`;
}

export const libelleMatch = (m: Pick<MatchCompte, "jour" | "heure">) => `${jourCourt(m.jour)} · ${heureCourte(m.heure)}`;

/** Mes matchs validés, dans l'ordre de compterMatchs (jour, heure, id). */
export function mesMatchsValides(comptes: readonly MatchCompte[], moi: string): MatchValide[] {
  const out: MatchValide[] = [];
  for (const m of comptes) {
    if (!m.valide) continue;
    const ligne = m.joueurs.find((j) => j.id === moi);
    if (!ligne || (UN_PAR_JOUR && !ligne.classe)) continue;
    out.push({ m, ligne, libelle: libelleMatch(m) });
  }
  return out;
}

const RESULTAT = { V: "Victoire", N: "Nul", D: "Défaite" } as const;

/** La saison synthétique que lit le moteur des cartes : un match validé par « journée ». */
export function saisonBola(valides: readonly MatchValide[], nom: string): Saison {
  return {
    numero: SAISON_DEPART,
    journees: valides.map((v, i) => ({ j: i + 1, date: v.libelle, sflTime: false })),
    roster: [],
    convocations: [],
    entries: valides.map(
      (v, i): MatchEntry => ({
        j: i + 1,
        player: nom,
        team: v.ligne.equipe,
        statut: "Présent",
        result: RESULTAT[v.ligne.resultat],
        sflTime: false,
        buts: v.ligne.buts,
        passes: v.ligne.passes,
        cleanSheet: false,
        mvp: v.ligne.mvp,
        impact: false,
        def: false,
        retard: false,
      })
    ),
  };
}

const plus = (s: Stats, g: Partial<Record<StatKey, number>>): Stats => {
  const out = { ...s };
  for (const k of STAT_KEYS) out[k] += g[k] ?? 0;
  return out;
};

/** La carte en direct : l'officielle et ce qui attend la mise à jour (la même somme que MaNote). */
export const enDirect = (ev: EvolutionJoueur): Stats => plus(ev.officielles, ev.enAttente);

/** L'évolution brute d'un joueur Bola sur ses matchs validés (null sans match). */
export function evolutionBrute(valides: readonly MatchValide[], nom: string): EvolutionJoueur | null {
  if (!valides.length) return null;
  const e = evoluer(saisonBola(valides, nom), () => BASE_BOLA, new Set(), { raisonSerie: RAISON_SERIE_BOLA });
  return e.joueurs.get(nom) ?? null;
}

/**
 * L'évolution telle que MaNote la montre à un joueur Bola : la carte en
 * direct est l'officielle, rien n'est « en attente », aucune mise à jour.
 */
export function evolutionEnDirect(ev: EvolutionJoueur): EvolutionJoueur {
  return { ...ev, officielles: enDirect(ev), enAttente: {}, majs: [] };
}

/**
 * Sa carte en direct après chacun de ses k premiers matchs validés : [0] la
 * base, [k] après le k-ième. Un seul passage pour la courbe et les cartes
 * MVP (la carte en direct dépend de la période des combinées : on rejoue le
 * moteur sur chaque début de liste, une fois chacun).
 */
export function cartesSuccessives(valides: readonly MatchValide[], nom: string): Stats[] {
  const out: Stats[] = [{ ...BASE_BOLA }];
  for (let k = 1; k <= valides.length; k++) {
    const ev = evolutionBrute(valides.slice(0, k), nom);
    out.push(ev ? enDirect(ev) : { ...BASE_BOLA });
  }
  return out;
}

/** Le joueur Bola tel que l'app le montre : sa carte en direct, ses cumuls des matchs validés. */
export function cartePlayer(nom: string, poste: string | null | undefined, stats: Stats, valides: readonly MatchValide[]): Player {
  return {
    name: nom,
    poste: poste || "—",
    pp: 0,
    matchs: valides.length,
    buts: valides.reduce((a, v) => a + v.ligne.buts, 0),
    passes: valides.reduce((a, v) => a + v.ligne.passes, 0),
    statut: "Actif",
    stats,
    mvp: valides.filter((v) => v.ligne.mvp).length,
    impact: 0,
    def: 0,
  };
}

/** Ses cartes MVP : une par match validé où il est MVP, sur sa carte d'avant ce match. */
export function cartesMvpBola(
  valides: readonly MatchValide[],
  nom: string,
  poste: string | null | undefined,
  successives: readonly Stats[] = cartesSuccessives(valides, nom)
): CarteMvpBola[] {
  const out: CarteMvpBola[] = [];
  valides.forEach((v, i) => {
    if (!v.ligne.mvp) return;
    const stats = statsCarteTitre(successives[i], "mvp", v.ligne.buts, v.ligne.passes);
    const carte: BoostCardData = {
      player: nom,
      type: "mvp",
      ovr: ovr(stats),
      poste: poste || "—",
      // Unique par match : la cérémonie (nouvelle-carte.tsx) reconnaît une carte à son titre et à sa date.
      date: `Bola · ${v.libelle}`,
      stats,
    };
    out.push({ carte, player: { ...cartePlayer(nom, poste, stats, valides) }, k: i + 1, libelle: v.libelle });
  });
  return out;
}

/** Tout ce que l'app montre de la carte d'un joueur Bola, à partir des matchs comptés. */
export function carteBola(comptes: readonly MatchCompte[], moi: string, nom: string, poste: string | null | undefined): CarteBola {
  const valides = mesMatchsValides(comptes, moi);
  const brute = evolutionBrute(valides, nom);
  const stats = brute ? enDirect(brute) : { ...BASE_BOLA };
  const successives = cartesSuccessives(valides, nom);
  const notes = valides.map((v, i) => ({ libelle: v.libelle, note: ovr(successives[i + 1]) }));
  return {
    nom,
    poste: poste || "—",
    valides,
    ev: brute ? evolutionEnDirect(brute) : null,
    stats,
    player: cartePlayer(nom, poste, stats, valides),
    notes,
    cartesMvp: cartesMvpBola(valides, nom, poste, successives),
  };
}

/**
 * La carte des autres joueurs Bola, pour la Ligue : un seul passage sur les
 * matchs, chacun sur ses lignes `carteBola` (la règle du serveur : filleul,
 * avant son entrée en SFL), sans courbe ni cartes MVP. Clé : son id ; chacun y est, 75 sans match.
 */
export function cartesDesJoueursBola(comptes: readonly MatchCompte[]): Map<string, Player> {
  const parJoueur = new Map<string, { nom: string; poste: string | null; valides: MatchValide[] }>();
  for (const m of comptes) {
    for (const ligne of m.joueurs) {
      let x = parJoueur.get(ligne.id);
      if (!x) parJoueur.set(ligne.id, (x = { nom: ligne.name, poste: null, valides: [] }));
      x.poste = ligne.poste ?? x.poste;
      if (!m.valide || !ligne.carteBola || (UN_PAR_JOUR && !ligne.classe)) continue;
      x.valides.push({ m, ligne, libelle: libelleMatch(m) });
    }
  }
  const out = new Map<string, Player>();
  for (const [id, x] of parJoueur) {
    // Sans match qui compte pour sa carte : 75, au poste de sa fiche.
    const ev = evolutionBrute(x.valides, x.nom);
    out.set(id, cartePlayer(x.nom, x.poste, ev ? enDirect(ev) : { ...BASE_BOLA }, x.valides));
  }
  return out;
}

/** Mes matchs Bola validés en saison synthétique, pour les badges (trophees.ts, vitrine) ; [] si ce n'est pas moi. */
export function saisonsBolaDe(carte: CarteBola | null | undefined, nom: string): Saison[] {
  return carte && carte.nom === nom && carte.valides.length ? [saisonBola(carte.valides, nom)] : [];
}
