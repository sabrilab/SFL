// Les missions personnelles d'un joueur Bola (Sabri, 28/10/2026 : « on peut
// mettre aussi des missions personnelles marqué 3 buts etc des. Choses comme
// ça » ; « Pareil pour xp etc »).
//
// Cinq missions, toujours là, sans rien à accepter : elles ne coûtent rien et
// ne se refusent pas. Elles ne se réussissent que sur un match validé (l'état
// « compte » de la confirmation des résultats, carte-bola.ts) ; un match en
// attente ou non validé n'existe pas pour elles : il ne compte pas, et il ne
// casse pas une série. Chacune se réussit une fois par semaine, du lundi au
// dimanche, au jour du match (heure de Paris : `jour` l'est déjà) ; un match
// du dimanche validé le lundi compte pour la semaine du dimanche.
//
// Les primes, rangs et règles sont des choix par défaut du 28/10, calés sur
// les primes des missions du dimanche (missions.ts, PRIME : deux passes D
// 120, record 150, gagnez 100) ; le rang suit la prime (rangDe).
//
// L'XP d'un joueur Bola (lignesXpBola) : chaque match validé rapporte l'XP
// d'un dimanche joué de la SFL (XP_DIMANCHE, 100) ; la SFL n'a pas de prime
// d'XP pour le MVP : le MVP en rapporte par sa mission. Ces lignes sont hors
// du rang (horsRang) : elles montent le Niveau et le Passe, jamais le rang
// B, A, S, que les autres téléphones calculent sans elles.
//
// Pur : ni React ni réseau.

import { placeDe } from "./recrues";
import { rangDe, XP_DIMANCHE, type LigneXp, type Rang } from "./missions";
import type { MatchValide } from "./carte-bola";
import type { Saison } from "./saisie/types";
import { heureMin } from "./ligue-vierge";

export type GenrePerso = "triple" | "caviar" | "mvp" | "regulier" | "serie";

export interface MissionPerso {
  genre: GenrePerso;
  /** Son nom de code, en tête de la fiche. */
  code: string;
  /** L'objectif, à la deuxième personne. */
  phrase: string;
  xp: number;
  /** Ce qu'il faut atteindre dans un match, ou dans la semaine. */
  objectif: number;
}

/** L'XP d'un match Bola validé : celle d'un dimanche joué de la SFL (choix par défaut, 28/10). */
export const XP_MATCH_BOLA = XP_DIMANCHE;

export const MISSIONS_PERSO: readonly MissionPerso[] = [
  {
    genre: "triple",
    code: "Triplé",
    phrase: "Mets trois buts dans un match.",
    xp: 150,
    objectif: 3,
  },
  {
    genre: "caviar",
    code: "Triple caviar",
    phrase: "Fais trois passes D dans un match.",
    xp: 150,
    objectif: 3,
  },
  {
    genre: "mvp",
    code: "MVP",
    phrase: "Sois MVP d'un match.",
    xp: 120,
    objectif: 1,
  },
  {
    genre: "regulier",
    code: "Régulier",
    phrase: "Joue trois matchs dans la semaine, trois jours différents.",
    xp: 100,
    objectif: 3,
  },
  {
    genre: "serie",
    code: "Série",
    phrase: "Gagne deux matchs de suite.",
    xp: 110,
    objectif: 2,
  },
];

const PAR_GENRE = new Map(MISSIONS_PERSO.map((m) => [m.genre, m]));

export const rangPerso = (m: Pick<MissionPerso, "xp">): Rang => rangDe(m);

/** Le lundi de la semaine d'un jour ISO (« 2026-10-25 » → « 2026-10-19 »), sur la date seule. */
export function semaineDe(jour: string): string {
  const [y, m, d] = jour.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // lundi 0
  return new Date(t - dow * 86400_000).toISOString().slice(0, 10);
}

/** Le jour d'aujourd'hui à Paris, en ISO. */
export function aujourdhuiParis(maintenant: Date): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(maintenant);
}

export interface MissionFaite {
  genre: GenrePerso;
  matchId: number;
  jour: string;
  heure: string;
  libelle: string;
  semaine: string;
  xp: number;
  /** La troisième mission réussie de la semaine (épreuve IV, EPREUVES_BOLA). */
  troisieme: boolean;
}

export interface ProgresPerso {
  m: MissionPerso;
  /** Où il en est cette semaine (plafonné à l'objectif). */
  progres: number;
  faite: boolean;
}

export interface BilanPerso {
  faites: MissionFaite[];
  /** Les cinq missions, cette semaine. */
  semaine: ProgresPerso[];
}

/** Les missions réussies sur ses matchs validés (dans l'ordre), et la semaine en cours. */
export function missionsPerso(
  valides: readonly MatchValide[],
  maintenant: Date,
): BilanPerso {
  const faites: MissionFaite[] = [];
  const faitesDe = new Map<string, Set<GenrePerso>>();
  const joursDe = new Map<string, Set<string>>();
  let serie = 0;
  const cetteSemaine = semaineDe(aujourdhuiParis(maintenant));
  const maxCetteSemaine = { triple: 0, caviar: 0, mvp: 0 };

  for (const v of valides) {
    const w = semaineDe(v.m.jour);
    const fait = faitesDe.get(w) ?? new Set<GenrePerso>();
    faitesDe.set(w, fait);
    const jours = joursDe.get(w) ?? new Set<string>();
    jours.add(v.m.jour);
    joursDe.set(w, jours);
    const reussir = (genre: GenrePerso) => {
      if (fait.has(genre)) return;
      fait.add(genre);
      faites.push({
        genre,
        matchId: v.m.id,
        jour: v.m.jour,
        heure: v.m.heure,
        libelle: v.libelle,
        semaine: w,
        xp: PAR_GENRE.get(genre)!.xp,
        troisieme: fait.size === 3,
      });
    };
    if (v.ligne.buts >= 3) reussir("triple");
    if (v.ligne.passes >= 3) reussir("caviar");
    if (v.ligne.mvp) reussir("mvp");
    if (jours.size >= 3) reussir("regulier");
    if (v.ligne.resultat === "V") {
      serie++;
      if (serie >= 2) {
        // Créditée dans la semaine de la deuxième victoire ; déjà faite, la série repart sans rien.
        reussir("serie");
        serie = 0;
      }
    } else serie = 0;
    if (w === cetteSemaine) {
      maxCetteSemaine.triple = Math.max(maxCetteSemaine.triple, v.ligne.buts);
      maxCetteSemaine.caviar = Math.max(maxCetteSemaine.caviar, v.ligne.passes);
      maxCetteSemaine.mvp = Math.max(maxCetteSemaine.mvp, v.ligne.mvp ? 1 : 0);
    }
  }

  const faitCetteSemaine = faitesDe.get(cetteSemaine) ?? new Set<GenrePerso>();
  const brut: Record<GenrePerso, number> = {
    ...maxCetteSemaine,
    regulier: joursDe.get(cetteSemaine)?.size ?? 0,
    serie,
  };
  const semaine = MISSIONS_PERSO.map((m) => {
    const faite = faitCetteSemaine.has(m.genre);
    return {
      m,
      faite,
      progres: faite ? m.objectif : Math.min(m.objectif, brut[m.genre]),
    };
  });
  return { faites, semaine };
}

const instant = (jour: string, heure: string) => {
  const [y, m, d] = jour.split("-").map(Number);
  const n = heureMin(heure);
  return new Date(y, m - 1, d, Math.floor(n / 60), n % 60);
};

/**
 * Les lignes d'XP d'un joueur Bola : +100 par match validé, la prime de
 * chaque mission réussie. À la saison et au dimanche de la SFL où elles
 * tombent (placeDe), pour le Passe de la saison ; hors du rang.
 */
export function lignesXpBola(
  valides: readonly MatchValide[],
  faites: readonly MissionFaite[],
  s: Saison,
  maintenant: Date,
): LigneXp[] {
  // Du plus récent au plus ancien (le journal ne range que par journée), la mission au-dessus de son match.
  const rangees: { t: number; ordre: number; l: LigneXp }[] = [];
  for (const v of valides) {
    const t = instant(v.m.jour, v.m.heure);
    if (t.getTime() > maintenant.getTime()) continue;
    const { saison, j } = placeDe(s, t, maintenant);
    rangees.push({
      t: t.getTime(),
      ordre: 0,
      l: {
        saison,
        j,
        date: v.libelle,
        quoi: "Match Bola",
        xp: XP_MATCH_BOLA,
        horsRang: true,
        bola: true,
      },
    });
  }
  for (const f of faites) {
    const t = instant(f.jour, f.heure);
    if (t.getTime() > maintenant.getTime()) continue;
    const m = PAR_GENRE.get(f.genre)!;
    const { saison, j } = placeDe(s, t, maintenant);
    rangees.push({
      t: t.getTime(),
      ordre: 1,
      l: {
        saison,
        j,
        date: f.libelle,
        quoi: `Mission ${m.code}`,
        xp: f.xp,
        mission: {
          creneau: "perso",
          rang: rangPerso(m),
          reussie: true,
          perso: f.genre,
          ...(f.troisieme ? { troisieme: true as const } : {}),
        },
        horsRang: true,
        bola: true,
      },
    });
  }
  return rangees.sort((a, b) => b.t - a.t || b.ordre - a.ordre).map((x) => x.l);
}

/**
 * Ajoute au journal d'XP les lignes Bola d'un joueur (le mien, sur mon seul
 * téléphone) ; ses missions réussies comptent pour les crans de son cadre.
 */
export function ajouterBola(
  journal: Map<string, { lignes: LigneXp[]; reussies: number }>,
  nom: string,
  lignes: readonly LigneXp[],
): void {
  if (!lignes.length) return;
  const x = journal.get(nom) ?? { lignes: [], reussies: 0 };
  journal.set(nom, {
    lignes: [...x.lignes, ...lignes],
    reussies: x.reussies + lignes.filter((l) => l.mission?.reussie).length,
  });
}
