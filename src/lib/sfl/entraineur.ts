// La carte d'entraîneur de Bola Team : ses six caractéristiques et sa note
// (étude du 02/11/2026, branche coach-etude ; le modèle complet, ses
// sources et ses limites sont dans le compte rendu de l'étude, modele.md).
// Module pur, sans stockage, comme lib/sfl/saisie/evolution.ts, dont il
// reprend la mécanique :
//   · chaque caractéristique part de 75, comme un nouveau joueur, et a sa
//     jauge ; un fait d'une rencontre dirigée y verse des crans ; une jauge
//     pleine donne +1 (2, 3, 5, 8 puis 12 crans, tailleJauge) ;
//   · un fait contraire (un forfait, un départ, une note fair-play basse)
//     verse des crans négatifs : une dette, à rembourser avant le prochain
//     +1. Rien ne descend jamais ;
//   · la carte officielle change toutes les 4 rencontres dirigées ; entre
//     deux, les points gagnés se voient « en attente ».
//
// Les six, différentes de celles d'un joueur (vit, tir, pas, dri, def, phy),
// d'un gardien (plo, réf, dég, jma, pla) et d'un arbitre (mat, avis, top,
// der). Elles mesurent ce qui arrive autour de l'entraîneur, jamais ce qu'il
// dit de lui-même ni ce que ses propres joueurs pensent de lui :
//   · RES, résultats : ce que l'équipe prend de plus que sa force ne le
//     promettait. Le résultat (1, ½, 0) moins l'attendu de l'Indice de Force
//     avant le coup d'envoi, cumulé ; un cran par demi-point d'avance. Pas
//     avant que l'Indice soit calé (5 matchs classés de l'équipe) ;
//   · PRO, progression : à chaque mise à jour, la moyenne, sur ses joueurs
//     venus, des crans qu'ils ont gagnés dans ses matchs (but, passe,
//     distinction votée par l'adversaire, série de présence), 3 au plus par
//     joueur, comptés double pour ceux dont la carte est sous la médiane de
//     l'équipe ;
//   · EFF, effectif : +1 par match joué à 5 ou plus quand tous les inscrits
//     sont venus et à l'heure ; −1 pour un 5 contre 4 ; −3 pour un forfait ;
//   · COH, cohésion : à chaque mise à jour, 2 crans, moins 1 par départ et
//     2 par exclusion d'un joueur depuis la précédente ;
//   · JEU, temps de jeu : à chaque mise à jour, le partage des cinq du coup
//     d'envoi entre ses joueurs venus au moins deux fois : le moins servi,
//     rapporté à sa juste part, à 0,6 ou plus, 2 crans ; à 0,3 ou plus, 1 ;
//   · TEN, tenue : la note fair-play que le capitaine adverse donne à
//     l'aveugle (recentrée sur ses habitudes) : +1 à 4,5 ou plus, −1 sous
//     3,5, −2 sous 2,5 ; −2 par sanction retenue, −2 pour un litige où la
//     modération donne tort à son équipe.
// La note : l'arrondi supérieur de la moyenne des six, comme un joueur
// (lib/sfl/engine.ts).

import type { FinitionEntraineur } from "@/components/sfl/skins-entraineur";

export const CLES_ENTRAINEUR = ["RES", "PRO", "EFF", "COH", "JEU", "TEN"] as const;
export type CleEntraineur = (typeof CLES_ENTRAINEUR)[number];
export type StatsEntraineur = Record<CleEntraineur, number>;

/** Le nom complet de chaque caractéristique (l'écran de détail, jamais sur la carte). */
export const NOMS_ENTRAINEUR: Record<CleEntraineur, string> = {
  RES: "Résultats",
  PRO: "Progression",
  EFF: "Effectif",
  COH: "Cohésion",
  JEU: "Temps de jeu",
  TEN: "Tenue",
};

/** Le départ d'une caractéristique, comme un nouveau joueur ; le plafond, comme la carte. */
export const DEPART_ENTRAINEUR = 75;
export const PLAFOND_ENTRAINEUR = 99;

/**
 * La face de la carte (bola-card.tsx, édition « entraineur ») : la note en
 * texte (« – » tant qu'aucune mise à jour n'est tombée), les six chiffres
 * deux par rangée, et la matière (skins-entraineur.ts).
 */
export interface FaceEntraineur {
  note: string;
  stats: [string, string | number][];
  finition?: FinitionEntraineur | null;
  /**
   * Ce que dit la carte en petit, sous le nom, à la place du poste d'un
   * joueur : « entraîneur » (le nom de l'équipe, trop long, y passait sur la note).
   */
  court?: string;
}

/** La note : l'arrondi supérieur de la moyenne des six, comme celle d'un joueur. */
export function noteEntraineur(s: StatsEntraineur): number {
  return Math.ceil(CLES_ENTRAINEUR.reduce((t, k) => t + s[k], 0) / CLES_ENTRAINEUR.length);
}

/** La face d'une carte : la note (ou « – » sans mise à jour), et les six dans l'ordre de la carte. */
export function faceEntraineur(s: StatsEntraineur | null, finition?: FinitionEntraineur | null): FaceEntraineur {
  return {
    note: s ? String(noteEntraineur(s)) : "–",
    stats: CLES_ENTRAINEUR.map((k) => [k, s ? s[k] : "–"]),
    finition,
    court: "entraîneur",
  };
}

/* ------------------------------ Les faits -------------------------------- */

/** Un joueur venu (check-in par QR croisé), tel que la feuille et le vote l'ont écrit. */
export interface PresentEntraineur {
  nom: string;
  /** Son check-in avant le coup d'envoi. */
  aLHeure: boolean;
  /** Dans les cinq du coup d'envoi, sur la feuille déposée à H-2. */
  titulaire: boolean;
  buts: number;
  passes: number;
  /** La distinction votée par l'adversaire (quorum de 3) : Meilleur Joueur, Meilleur Défenseur, MVP Team. */
  distinction?: "MJ" | "MD" | "MVP";
}

/**
 * Une rencontre où il était l'entraîneur inscrit de l'équipe. Le serveur la
 * prépare : l'Indice de Force ne sort jamais, seul l'attendu de la rencontre
 * en sort ; la note fair-play arrive déjà recentrée.
 */
export interface RencontreEntraineur {
  id: string;
  /** Le jour du coup d'envoi, AAAA-MM-JJ. */
  le: string;
  /** Classée et validée par les deux feuilles : ni amical, ni litige, ni annulée, ni une saisie restée seule. */
  classee: boolean;
  /** Forfait de son équipe (3 présents ou moins, annulation à moins de 48 h). */
  forfait: boolean;
  /** Le score final, règle du 5 contre 4 comprise. */
  pour: number;
  contre: number;
  /** L'attendu de son équipe avant le coup d'envoi (E de l'Indice de Force, de 0 à 1). */
  attendu: number;
  /** L'Indice de Force de l'équipe a-t-il 5 matchs classés derrière lui ? */
  indiceCale: boolean;
  /**
   * Son propre check-in (il ne fait jamais un présent). Absent, la rencontre
   * ne lui est pas comptée, sauf le 5 contre 4 et le forfait : il était
   * l'entraîneur inscrit, et ne pas venir les jours d'équipe incomplète ne doit
   * rien effacer. Par défaut, présent.
   */
  entraineurPresent?: boolean;
  presents: PresentEntraineur[];
  /** Inscrits sur la feuille, venus après le décompte ou pas venus, sans excuse. */
  absentsInscrits: number;
  /** La note fair-play reçue (1 à 5), recentrée sur les habitudes de celui qui la donne ; null s'il n'a pas noté. */
  fairPlay: number | null;
  /** Les sanctions retenues pour ce match contre ses joueurs. */
  sanctions: number;
  /** Un litige où la modération a donné tort à son équipe. */
  litigeFautif: boolean;
}

/** Un départ ou une exclusion d'un joueur de son équipe pendant qu'il l'entraînait. */
export interface MouvementEffectif {
  le: string;
  nom: string;
  quoi: "depart" | "exclusion";
}

/* ------------------------------- Le barème ------------------------------- */

export const RENCONTRES_PAR_MAJ = 4;

export const BAREME_ENTRAINEUR = {
  /** RES : un cran par demi-point de résultat au-dessus de l'attendu. */
  resParCran: 0.5,
  /** PRO : ce qu'un joueur verse au plus par mise à jour, et le poids de ceux qui partent de plus bas. */
  proPlafond: 3,
  proPoidsBas: 2,
  /** PRO : les crans d'un joueur dans un match (les règles des cartes de joueur, lib/sfl/saisie/evolution.ts). */
  but: 1,
  passe: 1,
  distinction: { MJ: 3, MD: 3, MVP: 4 },
  serie: 3,
  serieMatchs: 3,
  /** EFF. */
  complet: 1,
  cinqContreQuatre: -1,
  forfait: -3,
  /** COH, par mise à jour. */
  stable: 2,
  depart: -1,
  exclusion: -2,
  /** JEU, par mise à jour : le moins servi rapporté à sa juste part. */
  partage: [
    { seuil: 0.6, crans: 2 },
    { seuil: 0.3, crans: 1 },
  ],
  /** TEN, par match. */
  fairPlay: [
    { seuil: 4.5, crans: 1 },
    { seuil: 3.5, crans: 0 },
    { seuil: 2.5, crans: -1 },
  ],
  fairPlayBas: -2,
  sanction: -2,
  litige: -2,
} as const;

/** Les crans à verser pour +1 selon le niveau : la même jauge que les cartes de joueur. */
export function tailleJaugeEntraineur(v: number): number {
  if (v < 80) return 2;
  if (v < 85) return 3;
  if (v < 90) return 5;
  if (v < 95) return 8;
  return 12;
}

/* ------------------------------- Le calcul ------------------------------- */

export interface FaitEntraineur {
  cle: CleEntraineur;
  crans: number;
  /** « victoire, attendu 0,35 », « forfait », « Samir est parti »… */
  raison: string;
  /** La rencontre (son id) ou la mise à jour (« maj ») qui l'a versé. */
  source: string;
}

export interface MiseAJourEntraineur {
  apres: string;
  stats: StatsEntraineur;
  gains: Partial<StatsEntraineur>;
}

export interface EvolutionEntraineur {
  depart: StatsEntraineur;
  /** La carte officielle : celle de la dernière mise à jour (ou le départ). */
  officielles: StatsEntraineur;
  /** Les points gagnés depuis, pas encore officiels. */
  enAttente: Partial<StatsEntraineur>;
  /** Les jauges : crans versés (négatifs : une dette) sur la taille de la jauge. */
  jauges: Record<CleEntraineur, { crans: number; taille: number }>;
  /** RES : l'avance (ou le retard, une dette) sur l'attendu, pas encore versée. */
  reserveRes: number;
  /** Combien de rencontres avant la prochaine mise à jour. */
  avantProchaine: number;
  faits: FaitEntraineur[];
  majs: MiseAJourEntraineur[];
  rencontres: number;
}

const zero = (): StatsEntraineur => ({ RES: 0, PRO: 0, EFF: 0, COH: 0, JEU: 0, TEN: 0 });
const partout = (v: number): StatsEntraineur => ({ RES: v, PRO: v, EFF: v, COH: v, JEU: v, TEN: v });

/** La médiane d'une liste de nombres. */
function mediane(v: number[]): number {
  if (!v.length) return 0;
  const t = [...v].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

/**
 * Rejoue la carrière d'un entraîneur, rencontre par rencontre. Une
 * rencontre compte si elle est classée et validée, ou si c'est un forfait
 * (contre l'effectif seulement). `noteJoueur` donne la note de la carte
 * d'un joueur au début de chaque mise à jour (le poids de PRO).
 */
export function evoluerEntraineur(
  rencontres: RencontreEntraineur[],
  mouvements: MouvementEffectif[] = [],
  options: { noteJoueur?: (nom: string, le: string) => number; depart?: StatsEntraineur; arrivee?: string } = {}
): EvolutionEntraineur {
  const B = BAREME_ENTRAINEUR;
  const depart = options.depart ?? partout(DEPART_ENTRAINEUR);
  const live = { ...depart };
  let officielles = { ...depart };
  const crans = zero();
  const faits: FaitEntraineur[] = [];
  const majs: MiseAJourEntraineur[] = [];
  let reserve = 0;
  const absent = (r: RencontreEntraineur) => r.entraineurPresent === false;
  const comptees = rencontres
    .filter((r) => r.forfait || (r.classee && (!absent(r) || r.presents.length === 4)))
    .sort((a, b) => a.le.localeCompare(b.le) || a.id.localeCompare(b.id));
  const serie = new Map<string, number>();
  // PRO : les crans de chaque joueur dans chaque rencontre de la fenêtre (rencontre → joueur → crans).
  const cransDe = new Map<string, Map<string, number>>();
  let fenetre: RencontreEntraineur[] = [];
  let debutFenetre = options.arrivee ?? "";

  const verser = (cle: CleEntraineur, n: number, raison: string, source: string) => {
    if (!n) return;
    crans[cle] += n;
    faits.push({ cle, crans: n, raison, source });
  };
  const remplir = () => {
    for (const k of CLES_ENTRAINEUR) {
      while (live[k] < PLAFOND_ENTRAINEUR && crans[k] >= tailleJaugeEntraineur(live[k])) {
        crans[k] -= tailleJaugeEntraineur(live[k]);
        live[k] += 1;
      }
      if (live[k] >= PLAFOND_ENTRAINEUR) crans[k] = Math.min(crans[k], 0);
    }
  };

  /** PRO, JEU, COH : à la mise à jour, sur les rencontres de la fenêtre. */
  const fermer = (fin: string) => {
    const jouees = fenetre.filter((r) => !r.forfait);
    // PRO : les crans de chaque joueur venu, plafonnés, pondérés, en moyenne.
    const parJoueur = new Map<string, number>();
    for (const r of jouees) for (const [n, c] of cransDe.get(r.id) ?? []) parJoueur.set(n, (parJoueur.get(n) ?? 0) + c);
    if (parJoueur.size) {
      const notes = new Map([...parJoueur.keys()].map((n) => [n, options.noteJoueur?.(n, fenetre[0].le) ?? DEPART_ENTRAINEUR]));
      const med = mediane([...notes.values()]);
      let total = 0;
      for (const [n, c] of parJoueur) total += Math.min(B.proPlafond, c) * ((notes.get(n) ?? 0) < med ? B.proPoidsBas : 1);
      verser("PRO", Math.floor(total / parJoueur.size), `${parJoueur.size} joueurs, ${total} crans`, "maj");
    }
    // JEU : le moins servi, rapporté à sa juste part des cinq du coup d'envoi.
    const venues = new Map<string, { n: number; titulaire: number; part: number }>();
    for (const r of jouees) {
      const part = 5 / Math.max(5, r.presents.length);
      for (const p of r.presents) {
        const v = venues.get(p.nom) ?? { n: 0, titulaire: 0, part: 0 };
        v.n += 1;
        v.titulaire += p.titulaire ? 1 : 0;
        v.part += part;
        venues.set(p.nom, v);
      }
    }
    const habitues = [...venues.values()].filter((v) => v.n >= 2);
    if (habitues.length) {
      const moins = Math.min(...habitues.map((v) => Math.min(1, v.titulaire / v.part)));
      const palier = B.partage.find((p) => moins >= p.seuil);
      verser("JEU", palier?.crans ?? 0, `le moins servi à ${Math.round(moins * 100)} % de sa part`, "maj");
    }
    // COH : 2 crans, moins les départs et les exclusions depuis la mise à jour d'avant.
    const partis = mouvements.filter((m) => m.le > debutFenetre && m.le <= fin);
    const departs = partis.filter((m) => m.quoi === "depart").length;
    const exclusions = partis.filter((m) => m.quoi === "exclusion").length;
    verser("COH", B.stable + departs * B.depart + exclusions * B.exclusion, partis.length ? partis.map((m) => `${m.nom} ${m.quoi === "depart" ? "est parti" : "a été exclu"}`).join(", ") : "personne n'est parti", "maj");
    remplir();
    const gains: Partial<StatsEntraineur> = {};
    for (const k of CLES_ENTRAINEUR) if (live[k] > officielles[k]) gains[k] = live[k] - officielles[k];
    majs.unshift({ apres: fin, stats: { ...live }, gains });
    officielles = { ...live };
    for (const r of fenetre) cransDe.delete(r.id);
    fenetre = [];
    debutFenetre = fin;
  };

  for (const r of comptees) {
    if (r.forfait) {
      verser("EFF", B.forfait, "forfait", r.id);
      for (const n of serie.keys()) serie.set(n, 0);
    } else if (absent(r)) {
      // Il n'est pas venu : seul le 5 contre 4 lui revient.
      verser("EFF", B.cinqContreQuatre, "5 contre 4", r.id);
    } else {
      // RES : le résultat moins l'attendu, une fois l'Indice calé.
      if (r.indiceCale) {
        const s = r.pour > r.contre ? 1 : r.pour === r.contre ? 0.5 : 0;
        reserve += s - r.attendu;
        let n = 0;
        // Au millième près : 0,30 + 0,20 fait bien un demi-point.
        while (reserve >= B.resParCran - 1e-9) {
          reserve -= B.resParCran;
          n++;
        }
        verser("RES", n, `${s === 1 ? "victoire" : s ? "nul" : "défaite"}, attendu ${r.attendu.toFixed(2)}`, r.id);
      }
      // EFF : à 5 ou plus, tous les inscrits venus et à l'heure ; le 5 contre 4.
      const venus = r.presents.length;
      if (venus >= 5 && r.absentsInscrits === 0 && r.presents.every((p) => p.aLHeure)) verser("EFF", B.complet, "au complet, à l'heure", r.id);
      else if (venus === 4) verser("EFF", B.cinqContreQuatre, "5 contre 4", r.id);
      // TEN : la note fair-play à l'aveugle, les sanctions, le litige.
      if (r.fairPlay != null) {
        const palier = B.fairPlay.find((p) => r.fairPlay! >= p.seuil);
        verser("TEN", palier ? palier.crans : B.fairPlayBas, `fair-play ${r.fairPlay.toFixed(1)}`, r.id);
      }
      verser("TEN", r.sanctions * B.sanction, `${r.sanctions} sanction${r.sanctions > 1 ? "s" : ""} retenue${r.sanctions > 1 ? "s" : ""}`, r.id);
      if (r.litigeFautif) verser("TEN", B.litige, "litige", r.id);
      // PRO : les crans de chaque joueur venu dans ce match, comptés à la mise à jour.
      const venusNoms = new Set(r.presents.map((p) => p.nom));
      for (const n of serie.keys()) if (!venusNoms.has(n)) serie.set(n, 0);
      const ici = new Map<string, number>();
      for (const p of r.presents) {
        let c = p.buts * B.but + p.passes * B.passe + (p.distinction ? B.distinction[p.distinction] : 0);
        const suite = p.aLHeure ? (serie.get(p.nom) ?? 0) + 1 : 0;
        if (suite >= B.serieMatchs) {
          c += B.serie;
          serie.set(p.nom, 0);
        } else serie.set(p.nom, suite);
        ici.set(p.nom, (ici.get(p.nom) ?? 0) + c);
      }
      cransDe.set(r.id, ici);
    }
    remplir();
    fenetre.push(r);
    if (fenetre.length === RENCONTRES_PAR_MAJ) fermer(r.le);
  }

  const enAttente: Partial<StatsEntraineur> = {};
  for (const k of CLES_ENTRAINEUR) if (live[k] > officielles[k]) enAttente[k] = live[k] - officielles[k];
  const jauges = {} as EvolutionEntraineur["jauges"];
  for (const k of CLES_ENTRAINEUR) jauges[k] = { crans: crans[k], taille: live[k] >= PLAFOND_ENTRAINEUR ? 0 : tailleJaugeEntraineur(live[k]) };
  return {
    depart,
    officielles,
    enAttente,
    jauges,
    reserveRes: reserve,
    avantProchaine: RENCONTRES_PAR_MAJ - fenetre.length,
    faits,
    majs,
    rencontres: comptees.length,
  };
}
