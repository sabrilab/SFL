// La carte d'entraîneur de Bola Team : ses six caractéristiques et sa note
// (étude du 02/11/2026, branche coach-etude, seconde version après deux
// relectures adverses ; le modèle, ses sources et ses limites sont dans le
// compte rendu de l'étude, modele.md). Module pur, sans stockage, comme
// lib/sfl/saisie/evolution.ts.
//
// Une seule règle pour les six : on compare ce qui arrive autour de
// l'entraîneur à ce qui arrive en moyenne autour des autres, et on ne garde
// que ce qui dépasse le hasard ordinaire (la leçon de Football Manager : le
// conseil juge contre une attente, jamais en brut). Pour chacune :
//   · une avance A, la somme, essai après essai (une rencontre, une mise à
//     jour, une recrue), de ce qui s'est passé moins la norme de la ligue ;
//   · une marge du hasard, b × √W (W : le nombre d'essais, ou, pour les
//     départs, le nombre de départs attendus) ;
//   · à chaque mise à jour (toutes les 4 rencontres, jamais deux le même
//     mois), l'acquis garde son meilleur niveau : max(acquis,
//     A − marge). Un cran par « pas » d'acquis ; les crans remplissent les
//     jauges des cartes de joueur (2, 3, 5, 8 puis 12 crans pour +1).
// Un entraîneur dans la moyenne reste donc à 75, quel que soit le nombre de
// rencontres ; ce que la chance donne se perd dans la marge ; rien ne
// descend jamais, et une mauvaise passe se rattrape avant le prochain cran
// (l'écart entre l'acquis et A − marge : la dette).
//
// Les six, différentes de celles d'un joueur (vit, tir, pas, dri, def, phy),
// d'un gardien (plo, réf, dég, jma, pla) et d'un arbitre (mat, avis, top,
// der). Jamais ce qu'il dit de lui, jamais l'avis de ses propres joueurs :
//   · res, résultats : le résultat (1, ½, 0) moins l'attendu de l'Indice de
//     Force, par rencontre jouée, quand les deux Indices sont calés ;
//   · prés, présence : son équipe vient, au complet et à l'heure (check-in
//     avant H+5) : +1 ; un inscrit absent ou en retard : 0 ; 5 contre 4 :
//     −1 ; forfait (3 présents ou moins, annoncé ou pas) : −3 ; contre la
//     moyenne de la ligue ;
//   · tour, temps de jeu : à chaque mise à jour, la part des rencontres
//     jouées (inscrit et venu) du membre le moins servi de tout l'effectif ;
//     ses absences annoncées avant H-2 ne comptent pas, une sur deux au plus ;
//   · coh, cohésion : les départs et les exclusions (une exclusion vaut un
//     départ) contre les départs attendus à la moyenne de la ligue ;
//   · fair, fair-play : la note que le capitaine adverse donne à l'aveugle,
//     moins celle qu'il donne d'habitude ; −2 par sanction d'un de ses
//     joueurs, −4 par sanction de l'entraîneur ;
//   · rec, recrues : ses recrues s'installent (60 jours après leur
//     signature, toujours là, et 3 rencontres jouées), contre la moyenne.
// La note : l'arrondi supérieur de la moyenne des six, comme un joueur
// (lib/sfl/engine.ts).
//
// Ce qui compte pour lui : toutes les rencontres classées de son équipe
// pendant qu'il tient la place, qu'il soit venu ou non, et ses forfaits.
// Le score est celui du championnat à la fermeture de la feuille (3 jours) :
// une saisie restée seule compte, quel que soit le camp ; un litige attend la
// revue. Le serveur prépare les rencontres : l'Indice ne sort jamais, seul
// l'attendu de la rencontre ; ici, le journal ne le dit qu'en mots.

import type { FinitionEntraineur } from "@/components/sfl/skins-entraineur";
import type { Blason } from "@/lib/sfl/blason";
import { etatMatch, fermeture, type MatchTeam } from "@/lib/sfl/championnat-team";
import type { Fond } from "@/lib/sfl/equipes";

export const CLES_ENTRAINEUR = ["RES", "PRES", "TOUR", "COH", "FAIR", "REC"] as const;
export type CleEntraineur = (typeof CLES_ENTRAINEUR)[number];
export type StatsEntraineur = Record<CleEntraineur, number>;

/** Ce que dit la carte, en minuscules, comme « vit » ou « avis ». */
export const LIBELLES_ENTRAINEUR: Record<CleEntraineur, string> = {
  RES: "res",
  PRES: "prés",
  TOUR: "tour",
  COH: "coh",
  FAIR: "fair",
  REC: "rec",
};

/** Le nom complet de chaque caractéristique (l'écran de détail, jamais sur la carte). */
export const NOMS_ENTRAINEUR: Record<CleEntraineur, string> = {
  RES: "Résultats",
  PRES: "Présence",
  TOUR: "Temps de jeu",
  COH: "Cohésion",
  FAIR: "Fair-play",
  REC: "Recrues",
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
 * six chiffres deux par rangée, la matière (skins-entraineur.ts), et ce qui
 * remplace le poste et le numéro d'un joueur.
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

/** La note : l'arrondi supérieur de la moyenne des six, comme celle d'un joueur. */
export function noteEntraineur(s: StatsEntraineur): number {
  return Math.ceil(CLES_ENTRAINEUR.reduce((t, k) => t + s[k], 0) / CLES_ENTRAINEUR.length);
}

/** « 1 match », « 12 matchs ». */
export const rencontresDirigees = (n: number) => `${n} match${n > 1 ? "s" : ""}`;

/** La face d'une carte : la note, les six dans l'ordre de la carte, ses rencontres et son équipe. */
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

/** Un joueur de l'effectif le jour d'une rencontre (qualifié ; jamais l'entraîneur). */
export interface LigneEffectif {
  /** Son identifiant : deux « Kevin » ne se mélangent pas. */
  id: string;
  /** Sur la feuille déposée à H-2. */
  inscrit: boolean;
  /** Il avait annoncé son absence avant H-2 (au call-out). */
  indisponible: boolean;
  /**
   * Son check-in (GPS ou QR croisé, 02 §4) : avant H+5, « heure » ; de H+5 à
   * H+15, ou marqué « présent, arrivé en retard » sans check-in, « retard » ;
   * sinon null. Une excuse donnée après H-2 n'y change rien.
   */
  venu: "heure" | "retard" | null;
}

/** Une rencontre qui compte pour lui, telle que le serveur la prépare. */
export interface RencontreEntraineur {
  id: string;
  /** Le jour du coup d'envoi, AAAA-MM-JJ. */
  le: string;
  /** Un forfait de son équipe (3 présents ou moins, ou une annulation à moins de 48 h). */
  forfait: boolean;
  /** Le score final au championnat, à la fermeture de la feuille (règle du 5 contre 4 comprise). */
  pour: number;
  contre: number;
  /**
   * L'attendu de son équipe avant le coup d'envoi (E de l'Indice de Force),
   * ou null quand res ne s'applique pas : un des deux Indices n'est pas calé
   * (6 matchs classés) ou une des deux équipes n'a pas joué trois adversaires.
   */
  attendu: number | null;
  /** Tout l'effectif ce jour-là, une ligne par joueur qualifié. */
  effectif: LigneEffectif[];
  /** La note fair-play reçue (1 à 5, à l'aveugle) et la moyenne que ce capitaine donne d'habitude. */
  fairPlay: { note: number; habitude: number } | null;
  /** Les sanctions retenues pour cette rencontre : contre ses joueurs, contre lui. */
  sanctions: { joueurs: number; entraineur: number };
}

export type MotifDepart = "depart" | "exclusion" | "dissolution" | "inactivite" | "changement-de-place";

/** Un joueur de son équipe pendant qu'il l'entraîne : sa signature, et son départ. */
export interface MembreEntraineur {
  id: string;
  nom: string;
  arrivee: string;
  /** Seuls le départ et l'exclusion comptent contre la cohésion ; la dissolution, l'abonnement fini, un changement de place, non. */
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
  /** prés : ce que vaut une rencontre en moyenne (+1, 0, −1, −3). */
  presence: number;
  /** tour : la part du moins servi, en moyenne, à une mise à jour. */
  tour: number;
  /** coh : les départs par joueur et par jour. */
  departsParJour: number;
  /** rec : la part des recrues qui s'installent. */
  recrues: number;
}

/** Les normes de départ, tirées d'une ligue simulée (modele.md, §2), en attendant celles de la vraie ligue. */
export const NORMES_DEPART: NormesLigue = { presence: 0.15, tour: 0.7, departsParJour: 0.0012, recrues: 0.5 };

/* ------------------------------- Le barème ------------------------------- */

export const BAREME_ENTRAINEUR = {
  /** La marge du hasard (b de b × √W) et ce que vaut un cran, par caractéristique. */
  // Calés sur des ligues simulées (modele.md, §2) : un entraîneur moyen gagne
  // moins d'un point par caractéristique en 40 rencontres, un entraîneur du
  // quart supérieur 2 à 6. À recaler sur les vraies feuilles.
  RES: { hasard: 0.45, cran: 0.25 },
  PRES: { hasard: 0.5, cran: 1 },
  TOUR: { hasard: 0.15, cran: 0.25 },
  COH: { hasard: 0.7, cran: 0.15 },
  FAIR: { hasard: 0.35, cran: 1 },
  REC: { hasard: 0.5, cran: 0.2 },
  /** prés, par rencontre. */
  presence: { complet: 1, incomplet: 0, cinqContreQuatre: -1, forfait: -3 },
  /** fair, par sanction retenue. */
  sanction: { joueur: -2, entraineur: -4 },
  /** tour : la part des absences annoncées qui ne comptent pas, au plus ; et le minimum de rencontres pour juger. */
  tourIndisponibles: 0.5,
  tourMinimum: 2,
  /** rec : jugée 60 jours après la signature, sur 3 rencontres jouées. */
  recrue: { jours: 60, rencontres: 3 },
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

const partout = (v: number): StatsEntraineur => ({ RES: v, PRES: v, TOUR: v, COH: v, FAIR: v, REC: v });
const zeroCompteurs = (): CompteursEntraineur =>
  Object.fromEntries(CLES_ENTRAINEUR.map((k) => [k, { avance: 0, poids: 0, acquis: 0 }])) as CompteursEntraineur;
const JOUR = 86_400_000;
const jours = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / JOUR);
const plus = (le: string, n: number) => new Date(Date.parse(le) + n * JOUR).toISOString().slice(0, 10);

/** L'acquis possible maintenant : l'avance moins la marge du hasard. */
const net = (k: CleEntraineur, c: CompteursEntraineur[CleEntraineur]) => c.avance - BAREME_ENTRAINEUR[k].hasard * Math.sqrt(c.poids);
const crans = (k: CleEntraineur, acquis: number) => Math.floor(acquis / BAREME_ENTRAINEUR[k].cran + 1e-9);

/** prés : ce que vaut une rencontre pour la présence (avant la norme). */
export function valeurPresence(r: RencontreEntraineur): { valeur: number; texte: string } {
  const P = BAREME_ENTRAINEUR.presence;
  const venus = r.effectif.filter((l) => l.venu).length;
  if (r.forfait || venus <= 3) return { valeur: P.forfait, texte: "forfait" };
  if (venus === 4) return { valeur: P.cinqContreQuatre, texte: "5 contre 4" };
  const inscrits = r.effectif.filter((l) => l.inscrit);
  const absents = inscrits.filter((l) => !l.venu).length;
  const retards = inscrits.filter((l) => l.venu === "retard").length;
  if (!absents && !retards) return { valeur: P.complet, texte: "au complet, à l'heure" };
  return { valeur: P.incomplet, texte: absents ? `${absents} inscrit${absents > 1 ? "s" : ""} absent${absents > 1 ? "s" : ""}` : `${retards} retard${retards > 1 ? "s" : ""}` };
}

/** res : le résultat en mots, sans l'attendu chiffré. */
function resultatEnMots(s: number, e: number): string {
  const issue = s === 1 ? "victoire" : s ? "nul" : "défaite";
  if (s === 1 && e <= BAREME_ENTRAINEUR.exploit) return "victoire contre bien plus fort";
  if (e <= 0.4) return `${issue} contre plus fort`;
  if (e >= 0.6) return `${issue} contre plus faible`;
  return issue;
}

/**
 * Rejoue sa carrière dans une équipe, rencontre par rencontre. `avant` : les
 * compteurs de ses équipes d'avant (ils le suivent) ; `depart` : ses six au
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

  let fenetre: RencontreEntraineur[] = [];
  let debut = carriere.arrivee;
  let derniereMaj = null as string | null;
  const recruesJugees = new Set<string>();

  /** À la mise à jour : tour, coh et rec sur la fenêtre, puis chaque acquis garde son meilleur niveau. */
  const fermer = (fin: string) => {
    const jouees = fenetre.filter((r) => !r.forfait);
    // tour : le moins servi de tout l'effectif, ses absences annoncées comptées pour une sur deux au plus.
    const parJoueur = new Map<string, { n: number; indispo: number; joue: number }>();
    for (const r of jouees)
      for (const l of r.effectif) {
        const v = parJoueur.get(l.id) ?? { n: 0, indispo: 0, joue: 0 };
        v.n += 1;
        v.indispo += l.indisponible && !l.inscrit ? 1 : 0;
        v.joue += l.inscrit && l.venu ? 1 : 0;
        parJoueur.set(l.id, v);
      }
    const parts = [...parJoueur.entries()]
      .map(([id, v]) => ({ id, base: v.n - Math.min(v.indispo, Math.floor(v.n * B.tourIndisponibles)), joue: v.joue }))
      .filter((v) => v.base >= B.tourMinimum)
      .map((v) => ({ ...v, part: Math.min(1, v.joue / v.base) }));
    if (parts.length) {
      const moins = parts.reduce((a, b) => (b.part < a.part ? b : a));
      essai("TOUR", moins.part - normes.tour);
      note(fin, "maj", "TOUR", moins.part - normes.tour, moins.part >= 1 ? "tout le monde a joué sa part" : `le moins servi a joué ${moins.joue} rencontre${moins.joue > 1 ? "s" : ""} sur ${moins.base}`, 0.05);
    }
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
    // rec : les recrues dont les 60 jours sont passés.
    for (const m of carriere.membres) {
      const jugee = plus(m.arrivee, B.recrue.jours);
      if (m.arrivee <= carriere.arrivee || recruesJugees.has(m.id) || jugee > fin) continue;
      recruesJugees.add(m.id);
      const reste = !m.depart || m.depart.le > jugee;
      const jouees = rencontres.filter((r) => !r.forfait && r.le >= m.arrivee && r.le <= jugee && r.effectif.some((l) => l.id === m.id && l.inscrit && l.venu)).length;
      const installee = reste && jouees >= B.recrue.rencontres;
      essai("REC", (installee ? 1 : 0) - normes.recrues);
      note(fin, "maj", "REC", (installee ? 1 : 0) - normes.recrues, installee ? `${m.nom} s'est installé` : `${m.nom} n'a pas pris sa place`);
    }
    // Chaque acquis garde son meilleur niveau ; la carte officielle change.
    for (const k of CLES_ENTRAINEUR) c[k].acquis = Math.max(c[k].acquis, net(k, c[k]));
    const live = valeurs((k) => c[k].acquis);
    const gains: Partial<StatsEntraineur> = {};
    for (const k of CLES_ENTRAINEUR) if (live[k] > officielles[k]) gains[k] = live[k] - officielles[k];
    majs.unshift({ apres: fin, stats: live, gains });
    officielles = live;
    fenetre = [];
    debut = fin;
    derniereMaj = fin;
  };

  for (const r of rencontres) {
    // res : seulement les rencontres jouées, quand les deux Indices sont calés.
    if (!r.forfait && r.attendu != null) {
      const s = r.pour > r.contre ? 1 : r.pour === r.contre ? 0.5 : 0;
      essai("RES", s - r.attendu);
      note(r.le, r.id, "RES", s - r.attendu, resultatEnMots(s, r.attendu));
      if (s === 1 && r.attendu <= B.exploit) exploits.push(r.id);
    }
    // prés : toutes, forfaits compris.
    const p = valeurPresence(r);
    essai("PRES", p.valeur - normes.presence);
    note(r.le, r.id, "PRES", p.valeur - normes.presence, p.texte);
    // fair : la note reçue contre l'habitude de celui qui la donne, et les sanctions.
    const sanctions = r.sanctions.joueurs * B.sanction.joueur + r.sanctions.entraineur * B.sanction.entraineur;
    if (r.fairPlay || sanctions) {
      const x = (r.fairPlay ? r.fairPlay.note - r.fairPlay.habitude : 0) + sanctions;
      essai("FAIR", x);
      const mots = r.fairPlay ? (r.fairPlay.note - r.fairPlay.habitude >= 0.25 ? "fair-play salué" : r.fairPlay.note - r.fairPlay.habitude <= -0.25 ? "fair-play en dessous" : "fair-play ordinaire") : "";
      const n = r.sanctions.joueurs + r.sanctions.entraineur;
      note(r.le, r.id, "FAIR", x, [mots, n ? `${n} sanction${n > 1 ? "s" : ""}` : ""].filter(Boolean).join(", "), 0.1);
    }
    fenetre.push(r);
    if (fenetre.length >= B.maj.rencontres && derniereMaj?.slice(0, 7) !== r.le.slice(0, 7)) fermer(r.le);
  }

  // Ce qu'une mise à jour donnerait aujourd'hui (res, prés et fair seulement : les autres se jugent à la mise à jour).
  const enAttente: Partial<StatsEntraineur> = {};
  const apercu = valeurs((k) => (k === "RES" || k === "PRES" || k === "FAIR" ? Math.max(c[k].acquis, net(k, c[k])) : c[k].acquis));
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
    avantProchaine: Math.max(0, B.maj.rencontres - fenetre.length),
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
