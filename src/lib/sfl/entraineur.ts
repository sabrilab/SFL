// La carte d'entraîneur de Bola Team : ses trois caractéristiques et sa note
// (étude du 02/11/2026, branche coach-etude, troisième version ; Ilyes, après
// les planches : « il y a trop de stats, tu peux en mettre 3 max ». Le
// modèle, ses sources et ses limites sont dans le compte rendu de l'étude,
// modele-v3.md). Module pur, sans stockage, comme lib/sfl/saisie/evolution.ts.
//
// Trois questions, celles d'un joueur qui regarde un entraîneur : est-ce
// qu'il gagne ? est-ce qu'on vient ? est-ce qu'on reste ?
//   · rés, résultats : le résultat (1, ½, 0) moins ce que l'Indice de Force
//     promettait (l'attendu E), à chaque rencontre jouée entre deux Indices
//     calés. Le conseil de Football Manager : juger contre l'attente ;
//   · pré, présence : son équipe vient au complet. Par rencontre : tous les
//     inscrits de la feuille présents au décompte, +1 ; 5 présents ou plus
//     mais pas tous, 0 ; 4 (la règle du 5 contre 4), −1 ; 3 ou moins, ou une
//     annulation à moins de 48 h, c'est un forfait, −3. L'adhésion de FM27,
//     lue dans les actes, et le premier problème du foot amateur ;
//   · coh, cohésion : ses joueurs restent. Les départs et les exclusions
//     (une exclusion vaut un départ) contre ceux qu'on attendait à la moyenne
//     de la ligue. Le vestiaire de FM : le temps de jeu refusé, la confiance
//     perdue, finissent en départ.
// Différentes de celles d'un joueur (vit, tir, pas, dri, def, phy), d'un
// gardien (plo, réf, dég, jma, pla) et d'un arbitre (mat, avis, top, der).
// Jamais ce qu'il dit de lui, jamais l'avis de ses propres joueurs.
//
// Une seule règle pour les trois, celle de la seconde version, que les
// relectures ont gardée : on ajoute, essai après essai (une rencontre, ou une
// mise à jour pour coh), ce qui s'est passé moins ce qui se passe en moyenne
// dans la ligue (l'avance) ; on retire la marge du hasard, b × √W (W : le
// nombre d'essais ; pour coh, les départs attendus) ; à chaque mise à jour
// (toutes les 4 rencontres, jamais deux le même mois), l'acquis garde son
// meilleur niveau, max(acquis, avance − marge). Un cran par « pas »
// d'acquis ; les crans remplissent les jauges des cartes de joueur (2, 3, 5,
// 8 puis 12 crans pour +1). Un entraîneur dans la moyenne reste à 75 ; ce que
// la chance donne se perd dans la marge ; rien ne descend.
//
// La note : l'arrondi supérieur de la moyenne des trois, comme un joueur
// (lib/sfl/engine.ts). Elle part de 75.
//
// Ce qui compte pour lui : toutes les rencontres classées de son équipe
// pendant qu'il tient la place, qu'il soit venu ou non, et ses forfaits. Le
// score est celui du championnat à la fermeture de la feuille (3 jours) : une
// saisie restée seule compte, quel que soit le camp ; un litige attend la
// revue. Le serveur prépare les rencontres : l'Indice ne sort jamais, seul
// l'attendu de la rencontre ; ici, le journal ne le dit qu'en mots.

import type { FinitionEntraineur } from "@/components/sfl/skins-entraineur";
import type { Blason } from "@/lib/sfl/blason";
import { etatMatch, fermeture, type MatchTeam } from "@/lib/sfl/championnat-team";
import type { Fond } from "@/lib/sfl/equipes";

export const CLES_ENTRAINEUR = ["RES", "PRES", "COH"] as const;
export type CleEntraineur = (typeof CLES_ENTRAINEUR)[number];
export type StatsEntraineur = Record<CleEntraineur, number>;

/** Ce que dit la carte : trois lettres en minuscules, comme « vit » ou « réf ». */
export const LIBELLES_ENTRAINEUR: Record<CleEntraineur, string> = {
  RES: "rés",
  PRES: "pré",
  COH: "coh",
};

/** Le nom complet de chaque caractéristique (l'écran de détail, jamais sur la carte). */
export const NOMS_ENTRAINEUR: Record<CleEntraineur, string> = {
  RES: "Résultats",
  PRES: "Présence",
  COH: "Cohésion",
};

/** Le départ d'une caractéristique, comme un nouveau joueur ; le plafond, comme la carte. */
export const DEPART_ENTRAINEUR = 75;
export const PLAFOND_ENTRAINEUR = 99;

/** L'équipe qu'il entraîne, telle que la carte la montre : son écusson. */
export interface EquipeEntraineur {
  initiales: string;
  fond: Fond;
  blason: Blason | null;
}

/**
 * La face de la carte (bola-card.tsx, édition « entraineur ») : la note, les
 * trois chiffres l'un sous l'autre, la matière (skins-entraineur.ts), et ce
 * qui remplace le poste et le numéro d'un joueur.
 */
export interface FaceEntraineur {
  note: string;
  stats: [string, string | number][];
  finition?: FinitionEntraineur | null;
  /** Sous le nom, en compacte : « entraîneur ». */
  court?: string;
  /** Sous le nom, sur la carte complète, après le pseudo : le nombre de rencontres dirigées. */
  detail?: string;
  /** L'écusson de son équipe : à la place du numéro de maillot, et dans la pastille. */
  equipe?: EquipeEntraineur;
}

/** La note : l'arrondi supérieur de la moyenne des trois, comme celle d'un joueur. */
export function noteEntraineur(s: StatsEntraineur): number {
  return Math.ceil(CLES_ENTRAINEUR.reduce((t, k) => t + s[k], 0) / CLES_ENTRAINEUR.length);
}

/** « 1 match », « 12 matchs ». */
export const rencontresDirigees = (n: number) => `${n} match${n > 1 ? "s" : ""}`;

/** La face d'une carte : la note, les trois dans l'ordre de la carte, ses rencontres et son équipe. */
export function faceEntraineur(
  s: StatsEntraineur,
  o: { finition?: FinitionEntraineur | null; rencontres?: number; equipe?: EquipeEntraineur } = {}
): FaceEntraineur {
  return {
    note: String(noteEntraineur(s)),
    stats: CLES_ENTRAINEUR.map((k) => [LIBELLES_ENTRAINEUR[k], s[k]]),
    finition: o.finition,
    court: "entraîneur",
    detail: o.rencontres != null ? rencontresDirigees(o.rencontres) : undefined,
    equipe: o.equipe,
  };
}

/* ------------------------------ Les faits -------------------------------- */

/**
 * Une rencontre de son équipe compte-t-elle pour lui, et avec quel score ?
 * Celui du championnat à la fermeture de la feuille (3 jours après le coup
 * d'envoi) : deux saisies qui collent, ou une saisie restée seule, quel que
 * soit le camp (le silence vaut accord : son capitaine n'efface pas une
 * défaite en ne saisissant rien, l'adversaire n'efface pas une victoire).
 * Un litige ne compte qu'une fois tranché par la revue ; le forfait de
 * l'adversaire ne dit rien de lui ; le sien compte.
 */
export function rencontreComptee(m: MatchTeam, equipe: number): { pour: number; contre: number; forfait: boolean } | null {
  const e = etatMatch(m, fermeture(m));
  if (e.etat !== "valide") return null;
  if (e.forfaitDe != null && e.forfaitDe !== equipe) return null;
  const [de, a] = e.buts;
  const nous = m.de === equipe;
  return { pour: nous ? de : a, contre: nous ? a : de, forfait: e.forfaitDe === equipe };
}

/** Une rencontre qui compte pour lui, telle que le serveur la prépare. */
export interface RencontreEntraineur {
  id: string;
  /** Le jour du coup d'envoi, AAAA-MM-JJ. */
  le: string;
  /** Un forfait de son équipe : 3 présents ou moins, ou une annulation à moins de 48 h. */
  forfait: boolean;
  /** Le score final au championnat, à la fermeture de la feuille (règle du 5 contre 4 comprise). */
  pour: number;
  contre: number;
  /**
   * L'attendu de son équipe avant le coup d'envoi (E de l'Indice de Force),
   * ou null quand rés ne s'applique pas : un des deux Indices n'est pas calé
   * (5 matchs classés, contre au moins trois équipes différentes). Le
   * serveur le calcule avec l'Indice de son équipe, jamais plus bas que celui
   * du jour où il est arrivé : perdre exprès pendant le calage n'abaisse pas
   * ce qu'on attend de lui ensuite.
   */
  attendu: number | null;
  /** Les inscrits de la feuille déposée à H-2 (5 à 7 ; l'entraîneur n'y est jamais). */
  feuille: number;
  /**
   * Les présents de son équipe au décompte (H+15), tels que les deux
   * capitaines les saisissent avec le score (ils doivent coller, comme le
   * score) ; plus tard, le check-in.
   */
  presents: number;
}

/** Seuls le départ et l'exclusion comptent contre la cohésion ; la dissolution et un changement de place, non. */
export type MotifDepart = "depart" | "exclusion" | "dissolution" | "changement-de-place";

/** Un joueur de son équipe pendant qu'il l'entraîne : sa signature, et son départ. */
export interface MembreEntraineur {
  id: string;
  nom: string;
  arrivee: string;
  depart?: { le: string; motif: MotifDepart };
}

export interface CarriereEntraineur {
  /** Le jour où il a signé comme entraîneur de cette équipe. */
  arrivee: string;
  rencontres: RencontreEntraineur[];
  membres: MembreEntraineur[];
}

/** Ce qui se passe en moyenne dans la ligue Team (la saison en cours ; au début, ces valeurs). */
export interface NormesLigue {
  /** pré : ce que vaut une rencontre en moyenne (+1, 0, −1, −3). */
  presence: number;
  /** coh : les départs par joueur et par jour. */
  departsParJour: number;
}

/** Les normes de départ, tirées d'une ligue simulée (modele-v3.md), en attendant celles de la vraie ligue. */
export const NORMES_DEPART: NormesLigue = { presence: 0.58, departsParJour: 0.0012 };

/* ------------------------------- Le barème ------------------------------- */

export const BAREME_ENTRAINEUR = {
  /** La marge du hasard (b de b × √W) et ce que vaut un cran, par caractéristique. */
  // Calés sur des ligues simulées (modele-v3.md) : un entraîneur moyen reste
  // à 75 ou 76 après 16 comme après 40 rencontres ; un entraîneur du quart
  // supérieur est à 76 après une saison, à 78 après 40 rencontres. À recaler
  // sur les vraies feuilles, comme l'évolution des cartes de joueur.
  RES: { hasard: 0.5, cran: 0.25 },
  PRES: { hasard: 0.6, cran: 0.75 },
  COH: { hasard: 0.7, cran: 0.15 },
  /** pré, par rencontre. */
  presence: { complet: 1, incomplet: 0, cinqContreQuatre: -1, forfait: -3 },
  /** Une mise à jour toutes les 4 rencontres, et jamais deux le même mois. */
  maj: { rencontres: 4 },
  /** Le titre « Exploit » : une victoire quand l'attendu était de 0,30 ou moins. */
  exploit: 0.3,
} as const;

/** Les crans à verser pour +1 selon le niveau : la même jauge que les cartes de joueur. */
export function tailleJaugeEntraineur(v: number): number {
  if (v < 80) return 2;
  if (v < 85) return 3;
  if (v < 90) return 5;
  if (v < 95) return 8;
  return 12;
}

/** Le niveau atteint avec `crans` crans depuis `depart`, et ce qui reste dans la jauge. */
export function niveauEntraineur(crans: number, depart = DEPART_ENTRAINEUR): { valeur: number; reste: number } {
  let v = depart;
  let reste = crans;
  while (v < PLAFOND_ENTRAINEUR && reste >= tailleJaugeEntraineur(v)) {
    reste -= tailleJaugeEntraineur(v);
    v += 1;
  }
  return { valeur: v, reste: v >= PLAFOND_ENTRAINEUR ? 0 : reste };
}

/* ------------------------------- Le calcul ------------------------------- */

/** Une ligne du journal : en mots, jamais l'attendu ni l'avance en chiffres. */
export interface FaitEntraineur {
  le: string;
  /** La rencontre (son id) ou la mise à jour (« maj »). */
  source: string;
  cle: CleEntraineur;
  /** Au-dessus de la moyenne (1), dans la moyenne (0), en dessous (−1). */
  sens: 1 | 0 | -1;
  texte: string;
}

export interface MiseAJourEntraineur {
  apres: string;
  stats: StatsEntraineur;
  gains: Partial<StatsEntraineur>;
}

/** L'avance, son poids (pour la marge du hasard) et l'acquis d'une caractéristique : ce qui suit l'entraîneur d'une équipe à l'autre. */
export type CompteursEntraineur = Record<CleEntraineur, { avance: number; poids: number; acquis: number }>;

export interface EvolutionEntraineur {
  depart: StatsEntraineur;
  /** La carte officielle : celle de la dernière mise à jour (ou le départ). */
  officielles: StatsEntraineur;
  /** Ce que donnerait une mise à jour aujourd'hui, pas encore officiel. */
  enAttente: Partial<StatsEntraineur>;
  /** Les jauges : les crans dans le niveau en cours, la taille ; la dette en crans (à rattraper avant le prochain). */
  jauges: Record<CleEntraineur, { crans: number; taille: number; dette: number }>;
  /** Combien de rencontres avant la prochaine mise à jour (au moins). */
  avantProchaine: number;
  journal: FaitEntraineur[];
  majs: MiseAJourEntraineur[];
  /** Les rencontres dirigées : ce que dit la carte sous le nom. */
  rencontres: number;
  /** Les victoires « Exploit » (l'attendu de 0,30 ou moins) : leurs rencontres. */
  exploits: string[];
  compteurs: CompteursEntraineur;
}

const partout = (v: number): StatsEntraineur => ({ RES: v, PRES: v, COH: v });
const zeroCompteurs = (): CompteursEntraineur =>
  Object.fromEntries(CLES_ENTRAINEUR.map((k) => [k, { avance: 0, poids: 0, acquis: 0 }])) as CompteursEntraineur;
const JOUR = 86_400_000;
const jours = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / JOUR);

/** L'acquis possible maintenant : l'avance moins la marge du hasard. */
const net = (k: CleEntraineur, c: CompteursEntraineur[CleEntraineur]) => c.avance - BAREME_ENTRAINEUR[k].hasard * Math.sqrt(c.poids);
const crans = (k: CleEntraineur, acquis: number) => Math.floor(acquis / BAREME_ENTRAINEUR[k].cran + 1e-9);

/** pré : ce que vaut une rencontre pour la présence (avant la norme). */
export function valeurPresence(r: Pick<RencontreEntraineur, "forfait" | "feuille" | "presents">): { valeur: number; texte: string } {
  const P = BAREME_ENTRAINEUR.presence;
  if (r.forfait || r.presents <= 3) return { valeur: P.forfait, texte: "forfait" };
  if (r.presents === 4) return { valeur: P.cinqContreQuatre, texte: "5 contre 4" };
  const absents = Math.max(0, r.feuille - r.presents);
  if (!absents) return { valeur: P.complet, texte: "au complet" };
  return { valeur: P.incomplet, texte: `${absents} inscrit${absents > 1 ? "s" : ""} absent${absents > 1 ? "s" : ""}` };
}

/** rés : le résultat en mots, sans l'attendu chiffré. */
function resultatEnMots(s: number, e: number): string {
  const issue = s === 1 ? "victoire" : s ? "nul" : "défaite";
  if (s === 1 && e <= BAREME_ENTRAINEUR.exploit) return "victoire contre bien plus fort";
  if (e <= 0.4) return `${issue} contre plus fort`;
  if (e >= 0.6) return `${issue} contre plus faible`;
  return issue;
}

/**
 * Rejoue sa carrière dans une équipe, rencontre par rencontre. `avant` : les
 * compteurs de ses équipes d'avant (ils le suivent) ; `depart` : ses trois au
 * départ (75 partout pour un nouvel entraîneur).
 */
export function evoluerEntraineur(
  carriere: CarriereEntraineur,
  options: { normes?: NormesLigue; avant?: CompteursEntraineur; depart?: StatsEntraineur } = {}
): EvolutionEntraineur {
  const B = BAREME_ENTRAINEUR;
  const normes = options.normes ?? NORMES_DEPART;
  const depart = options.depart ?? partout(DEPART_ENTRAINEUR);
  const c: CompteursEntraineur = options.avant ? structuredClone(options.avant) : zeroCompteurs();
  const valeurs = (acquis: (k: CleEntraineur) => number): StatsEntraineur =>
    Object.fromEntries(CLES_ENTRAINEUR.map((k) => [k, niveauEntraineur(crans(k, acquis(k)), depart[k]).valeur])) as StatsEntraineur;
  // Les compteurs d'avant donnent déjà un acquis : la carte part de là.
  let officielles = valeurs((k) => c[k].acquis);
  const journal: FaitEntraineur[] = [];
  const majs: MiseAJourEntraineur[] = [];
  const exploits: string[] = [];
  const rencontres = [...carriere.rencontres].sort((a, b) => a.le.localeCompare(b.le) || a.id.localeCompare(b.id));
  const note = (le: string, source: string, cle: CleEntraineur, x: number, texte: string, seuil = 1e-9) =>
    journal.push({ le, source, cle, sens: x > seuil ? 1 : x < -seuil ? -1 : 0, texte });
  const essai = (k: CleEntraineur, x: number, poids = 1) => {
    c[k].avance += x;
    c[k].poids += poids;
  };

  let fenetre = 0;
  let debut = carriere.arrivee;
  let derniereMaj = null as string | null;

  /** À la mise à jour : coh sur la fenêtre, puis chaque acquis garde son meilleur niveau. */
  const fermer = (fin: string) => {
    // coh : les départs et les exclusions, contre ceux qu'on attendait à la moyenne de la ligue.
    const exposition = carriere.membres.reduce((t, m) => {
      const a = m.arrivee > debut ? m.arrivee : debut;
      const z = m.depart && m.depart.le < fin ? m.depart.le : fin;
      return t + Math.max(0, jours(a, z));
    }, 0);
    const attendus = exposition * normes.departsParJour;
    const partis = carriere.membres.filter((m) => m.depart && (m.depart.motif === "depart" || m.depart.motif === "exclusion") && m.depart.le > debut && m.depart.le <= fin);
    if (attendus > 0 || partis.length) {
      essai("COH", attendus - partis.length, attendus);
      note(fin, "maj", "COH", attendus - partis.length, partis.length ? partis.map((m) => `${m.nom} ${m.depart!.motif === "depart" ? "est parti" : "a été exclu"}`).join(", ") : "personne n'est parti");
    }
    // Chaque acquis garde son meilleur niveau ; la carte officielle change.
    for (const k of CLES_ENTRAINEUR) c[k].acquis = Math.max(c[k].acquis, net(k, c[k]));
    const live = valeurs((k) => c[k].acquis);
    const gains: Partial<StatsEntraineur> = {};
    for (const k of CLES_ENTRAINEUR) if (live[k] > officielles[k]) gains[k] = live[k] - officielles[k];
    majs.unshift({ apres: fin, stats: live, gains });
    officielles = live;
    fenetre = 0;
    debut = fin;
    derniereMaj = fin;
  };

  for (const r of rencontres) {
    // rés : seulement les rencontres jouées, quand les deux Indices sont calés.
    if (!r.forfait && r.attendu != null) {
      const s = r.pour > r.contre ? 1 : r.pour === r.contre ? 0.5 : 0;
      essai("RES", s - r.attendu);
      note(r.le, r.id, "RES", s - r.attendu, resultatEnMots(s, r.attendu));
      if (s === 1 && r.attendu <= B.exploit) exploits.push(r.id);
    }
    // pré : toutes, forfaits compris.
    const p = valeurPresence(r);
    essai("PRES", p.valeur - normes.presence);
    note(r.le, r.id, "PRES", p.valeur - normes.presence, p.texte);
    fenetre += 1;
    if (fenetre >= B.maj.rencontres && derniereMaj?.slice(0, 7) !== r.le.slice(0, 7)) fermer(r.le);
  }

  // Ce qu'une mise à jour donnerait aujourd'hui (rés et pré : coh se juge à la mise à jour).
  const enAttente: Partial<StatsEntraineur> = {};
  const apercu = valeurs((k) => (k === "COH" ? c[k].acquis : Math.max(c[k].acquis, net(k, c[k]))));
  for (const k of CLES_ENTRAINEUR) if (apercu[k] > officielles[k]) enAttente[k] = apercu[k] - officielles[k];
  const jauges = {} as EvolutionEntraineur["jauges"];
  for (const k of CLES_ENTRAINEUR) {
    const n = niveauEntraineur(crans(k, c[k].acquis), depart[k]);
    const dette = Math.max(0, Math.ceil((c[k].acquis - net(k, c[k])) / B[k].cran - 1e-9));
    jauges[k] = { crans: n.reste, taille: n.valeur >= PLAFOND_ENTRAINEUR ? 0 : tailleJaugeEntraineur(n.valeur), dette };
  }
  return {
    depart,
    officielles,
    enAttente,
    jauges,
    avantProchaine: Math.max(0, B.maj.rencontres - fenetre),
    journal,
    majs,
    rencontres: rencontres.length,
    exploits,
    compteurs: c,
  };
}

/**
 * L'édition « Champion » de sa carte : son équipe est championne de sa
 * division, et il a dirigé au moins 40 % de ses rencontres classées de la
 * saison (la règle du patch brodé).
 */
export const championDe = (dirigees: number, rencontresDeLEquipe: number) => rencontresDeLEquipe > 0 && dirigees / rencontresDeLEquipe >= 0.4;
