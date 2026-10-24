// Le Passe Bola : la passe de la saison, sur la fiche des contrats.
//
// Sabri, 24/10/2026 : « ces XP, les passes et les saisons sont en
// corrélation avec les missions […] ça doit être un même design », « comme
// dans Fortnite », « on va se focaliser uniquement sur des missions qui nous
// feront gagner des skins pour la carte », « la finition nuit, c'est
// excellent comme skin », et « les dernières […] soient les plus difficiles
// à avoir, limite dans le physique » : la 20e, la carte de saison imprimée.
// Les jokers, la séance studio offerte et les filtres de la photo sont sortis
// de la passe. Proposition du 24/10 : https://claude.ai/artifact/CGmu6oz6rrPn2yZGVSUGfk
//
// Vingt paliers, chacun une récompense qui change l'allure de la carte :
//   · un skin, qui habille toute la carte (on en porte un à la fois) ;
//   · un signe, un détail qui se pose tout seul, quel que soit le skin ;
//   · aux paliers 18 et 19, une séquence de 6 s du joueur (Seedance 2.5),
//     jouée quand on appuie longtemps sur sa carte : rien n'est généré avant
//     l'accord de Sabri ;
//   · au 20, la carte de saison imprimée, en vrai.
// Chaque récompense a la rareté des contrats : B (argent), A (mauve), S (or).
//
// Le rythme : 3 000 XP pour finir, des paliers de plus en plus chers (100,
// puis 125, 150 et 225 XP, cinq par cinq), et quatre épreuves, à réussir dans
// la saison, aux paliers 5, 10, 15 et 20. Sans l'épreuve, l'XP continue de
// monter mais le palier attend ; dès qu'elle est réussie, les paliers déjà
// payés tombent d'un coup. Un palier atteint reste gagné pour de bon, même si
// un contrat raté fait redescendre l'XP ; une récompense gagnée une saison
// reste à soi les suivantes (palierMaxDe, missions.ts).
//
// Pur : ni React ni réseau. Le journal d'XP vient de missions.ts.

import type { Signe } from "@/components/sfl/finitions-carte";
import type { LigneXp, Rang } from "./missions";

export const PALIERS_PASSE = 20;

/** Ce que coûte chaque palier, cinq par cinq. */
const COUT_PAR_BLOC = [100, 125, 150, 225] as const;

/** Ce que coûte le palier n (1 à 20), en XP de la saison. */
export function coutPalier(n: number): number {
  return COUT_PAR_BLOC[Math.min(3, Math.max(0, Math.floor((n - 1) / 5)))];
}

/** L'XP de la saison qu'il faut pour atteindre le palier n : 0 pour le palier 0, 3 000 pour le 20. */
export function seuilPalier(n: number): number {
  let s = 0;
  for (let i = 1; i <= Math.min(PALIERS_PASSE, n); i++) s += coutPalier(i);
  return s;
}

/* ------------------------------ Les épreuves ------------------------------ */

export interface Epreuve {
  numero: 1 | 2 | 3 | 4;
  romain: "I" | "II" | "III" | "IV";
  /** Le palier qu'elle ouvre. */
  palier: number;
  nom: string;
  phrase: string;
  /** Une ligne du journal de la saison qui la réussit. */
  faite: (l: LigneXp) => boolean;
}

const reussie = (l: LigneXp) => l.mission?.reussie === true;

export const EPREUVES: readonly Epreuve[] = [
  { numero: 1, romain: "I", palier: 5, nom: "Signer", phrase: "Réussis une mission que tu as acceptée.", faite: reussie },
  {
    numero: 2,
    romain: "II",
    palier: 10,
    nom: "Le contrat",
    phrase: "Réussis un contrat.",
    faite: (l) => reussie(l) && l.mission?.creneau === "contrat",
  },
  {
    numero: 3,
    romain: "III",
    palier: 15,
    nom: "Rang S",
    phrase: "Réussis une mission de rang S.",
    faite: (l) => reussie(l) && l.mission?.rang === "S",
  },
  {
    numero: 4,
    romain: "IV",
    palier: 20,
    nom: "Trois sur trois",
    phrase: "Réussis les trois missions d'un même dimanche.",
    faite: (l) => l.parfait === true,
  },
];

/** L'épreuve qui ouvre le palier n, s'il en a une. */
export const epreuveDu = (n: number): Epreuve | undefined => EPREUVES.find((e) => e.palier === n);

/** Le palier que paient `xp` points de la saison, les épreuves faites ouvrant leur porte. */
export function palierPour(xp: number, faites: ReadonlySet<number>): number {
  let p = 0;
  while (p < PALIERS_PASSE && xp >= seuilPalier(p + 1)) p++;
  for (const e of EPREUVES) if (p >= e.palier && !faites.has(e.numero)) return e.palier - 1;
  return p;
}

/* ------------------------------- Les paliers ------------------------------- */

export type GenrePalier = "signe" | "skin" | "sequence" | "vrai";

export interface PalierPasse {
  n: number;
  nom: string;
  /** Ce que c'est, en quelques mots. */
  quoi: string;
  /** La rareté, aux couleurs des rangs des contrats. */
  rang: Rang;
  genre: GenrePalier;
  /**
   * Ce que le palier pose sur la carte : un skin (une finition de
   * finitions-carte.ts, vérifiée à l'usage, estFinition) ou un signe.
   * L'onyx vient du fil de la carte noire : tant qu'il n'est pas là, son
   * palier ne pose rien.
   */
  habille?: { finition?: string; signe?: Signe };
}

export const PASSE_BOLA: readonly PalierPasse[] = [
  { n: 1, nom: "Liseré argent", quoi: "Un filet d'argent autour de ta photo.", rang: "B", genre: "signe", habille: { signe: "lisere-argent" } },
  { n: 2, nom: "Givre", quoi: "Le métal givré, le givre qui pousse des bords.", rang: "B", genre: "skin", habille: { finition: "givre" } },
  { n: 3, nom: "Sceau", quoi: "Un sceau à tes initiales sur ta photo.", rang: "B", genre: "signe", habille: { signe: "sceau" } },
  { n: 4, nom: "Carbone", quoi: "La fibre de carbone tissée, gris anthracite.", rang: "B", genre: "skin", habille: { finition: "carbone" } },
  { n: 5, nom: "Nuit", quoi: "Le ciel de nuit, l'encre d'argent.", rang: "A", genre: "skin", habille: { finition: "nuit" } },
  { n: 6, nom: "Puce noire", quoi: "La puce de ta carte en noir laqué, ses contacts d'argent.", rang: "B", genre: "signe", habille: { signe: "puce-noire" } },
  { n: 7, nom: "Marbre", quoi: "Le marbre blanc veiné des statues.", rang: "A", genre: "skin", habille: { finition: "marbre" } },
  { n: 8, nom: "Tes couleurs", quoi: "Ton drapeau le long des bords : à l'encre sur la face, en couleurs au dos.", rang: "A", genre: "skin", habille: { finition: "couleurs" } },
  { n: 9, nom: "Ton nom gravé", quoi: "Ton nom caché dans la gravure fine.", rang: "B", genre: "signe", habille: { signe: "nom-grave" } },
  { n: 10, nom: "Chrome", quoi: "Le métal poli, des reflets francs.", rang: "A", genre: "skin", habille: { finition: "chrome" } },
  { n: 11, nom: "Néon", quoi: "Un tube de néon fuchsia qui suit le bord, sur le noir.", rang: "A", genre: "skin", habille: { finition: "neon" } },
  { n: 12, nom: "Aurore", quoi: "Les rideaux d'une aurore boréale.", rang: "A", genre: "skin", habille: { finition: "aurore" } },
  { n: 13, nom: "Liseré platine", quoi: "Un double filet de platine autour de ta photo.", rang: "A", genre: "signe", habille: { signe: "lisere-platine" } },
  { n: 14, nom: "Ki", quoi: "L'aura blanche qui monte, les éclairs autour de toi.", rang: "S", genre: "skin", habille: { finition: "ki" } },
  { n: 15, nom: "Animée", quoi: "La nacre, et une lumière qui passe.", rang: "S", genre: "skin", habille: { finition: "animee" } },
  { n: 16, nom: "Onyx", quoi: "La carte noire guillochée.", rang: "S", genre: "skin", habille: { finition: "onyx" } },
  { n: 17, nom: "Météorite", quoi: "Le fer d'une météorite, ses lamelles croisées.", rang: "S", genre: "skin", habille: { finition: "meteorite" } },
  { n: 18, nom: "Ta séquence", quoi: "6 secondes de toi, animées. Appui long sur ta carte.", rang: "S", genre: "sequence" },
  { n: 19, nom: "Seconde séquence", quoi: "Un deuxième thème pour ta séquence.", rang: "S", genre: "sequence" },
  { n: 20, nom: "Ta carte en vrai", quoi: "Ta carte de saison imprimée, avec ton skin.", rang: "S", genre: "vrai" },
];

/* ------------------------------- Le bilan ------------------------------- */

export interface EtatEpreuve {
  e: Epreuve;
  /** La journée où elle a été réussie, ou null. */
  j: number | null;
}

export interface BilanPasse {
  /** Le palier atteint, de 0 à 20 : acquis pour la saison. */
  palier: number;
  /** L'XP de la saison, jamais sous zéro. */
  xp: number;
  /** Dans le palier suivant : l'XP déjà faite, et ce qu'il coûte (0 et 0 une fois la passe finie). */
  versPalier: number;
  coutPalier: number;
  /** L'XP qui manque pour le suivant (0 quand seule l'épreuve manque). */
  manque: number;
  /** L'épreuve à réussir pour le palier suivant, s'il en demande une qui n'est pas faite. */
  bloquee: Epreuve | null;
  epreuves: EtatEpreuve[];
}

/** Le passe d'un joueur, tiré de ses lignes d'XP de la saison (dans n'importe quel ordre). */
export function passeDe(lignes: readonly LigneXp[]): BilanPasse {
  const parJournee = new Map<number, LigneXp[]>();
  for (const l of lignes) {
    const liste = parJournee.get(l.j);
    if (liste) liste.push(l);
    else parJournee.set(l.j, [l]);
  }
  // Dimanche par dimanche : le cumul de la saison, les épreuves faites à ce jour, le plus haut palier.
  const faites = new Map<number, number>();
  let cumul = 0;
  let palier = 0;
  for (const j of [...parJournee.keys()].sort((a, b) => a - b)) {
    const du = parJournee.get(j) ?? [];
    cumul += du.reduce((a, l) => a + l.xp, 0);
    for (const e of EPREUVES) if (!faites.has(e.numero) && du.some(e.faite)) faites.set(e.numero, j);
    palier = Math.max(palier, palierPour(Math.max(0, cumul), new Set(faites.keys())));
  }
  const xp = Math.max(0, lignes.reduce((a, l) => a + l.xp, 0));
  const epreuves = EPREUVES.map((e) => ({ e, j: faites.get(e.numero) ?? null }));
  if (palier >= PALIERS_PASSE)
    return { palier, xp, versPalier: 0, coutPalier: 0, manque: 0, bloquee: null, epreuves };
  const suivant = palier + 1;
  const cout = coutPalier(suivant);
  const porte = epreuveDu(suivant);
  return {
    palier,
    xp,
    versPalier: Math.max(0, Math.min(cout, xp - seuilPalier(palier))),
    coutPalier: cout,
    manque: Math.max(0, seuilPalier(suivant) - xp),
    bloquee: porte && !faites.has(porte.numero) ? porte : null,
    epreuves,
  };
}

/** Ce que les paliers atteints ont débloqué sur la carte, dans l'ordre des paliers. */
export function debloquesDe(palier: number): { finitions: string[]; signes: Signe[] } {
  const ouverts = PASSE_BOLA.filter((p) => p.n <= palier);
  return {
    finitions: ouverts.flatMap((p) => (p.habille?.finition ? [p.habille.finition] : [])),
    signes: ouverts.flatMap((p) => (p.habille?.signe ? [p.habille.signe] : [])),
  };
}
