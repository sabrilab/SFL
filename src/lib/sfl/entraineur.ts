// La carte d'entraîneur de Bola Team : ses trois caractéristiques et sa note
// (étude du 02/11/2026, branche coach-etude, troisième version revue après la
// relecture ; Ilyes, après les planches : « il y a trop de stats, tu peux en
// mettre 3 max ». Le modèle, ses sources et ses limites sont dans le compte
// rendu de l'étude, modele-v3.md). Module pur, sans stockage, comme
// lib/sfl/saisie/evolution.ts.
//
// Trois questions, celles d'un joueur qui regarde un entraîneur : est-ce
// qu'il gagne ? est-ce qu'on vient ? est-ce qu'on reste ?
//   · rés, résultats : son équipe prend plus de points que ses joueurs n'en
//     promettaient. À chaque rencontre jouée, le résultat du terrain (1, ½,
//     0) moins l'attendu E, tiré de la force des deux feuilles : la moyenne
//     des notes de carte des cinq meilleurs inscrits de chaque côté. Les
//     cartes ne bougent pas avec les matchs Team : l'attendu ne dépend jamais
//     de ses propres résultats (un Indice qui apprend les absorbait). Le
//     conseil de Football Manager : juger contre la force de l'effectif ;
//   · pré, présence : son équipe vient. Par rencontre : un forfait (une
//     annulation à moins de 48 h, ou 3 présents ou moins) −3 ; le 5 contre 4
//     (4 présents) −1 ; sinon 0. Rien que des faits que l'adversaire a
//     intérêt à vérifier : le forfait lui donne la victoire, le 5 contre 4 un
//     but. « Au complet » attendra le check-in par QR croisé des règles
//     (04 §7) : un chiffre que seul son camp déclare ne compte pas ;
//   · coh, cohésion : ses joueurs restent. Les départs et les exclusions (une
//     exclusion vaut un départ) contre ceux qu'on attendait. Seuls comptent
//     les joueurs actifs : pendant leurs 60 premiers jours dans l'équipe,
//     puis dans les 60 jours qui suivent chaque feuille où ils sont
//     inscrits. Un membre fantôme ne gonfle rien, une équipe qui ne joue pas
//     n'avance plus au bout de 60 jours, et le départ de quelqu'un qui ne
//     venait plus ne coûte rien. Le vestiaire de FM : le temps de jeu refusé, la confiance
//     perdue, finissent en départ.
// Différentes de celles d'un joueur (vit, tir, pas, dri, def, phy), d'un
// gardien (plo, réf, dég, jma, pla) et d'un arbitre (mat, avis, top, der).
// Jamais ce qu'il dit de lui, jamais l'avis de ses propres joueurs.
//
// À quoi on compare (pré et coh) : à son équipe avant lui, rapprochée de la
// moyenne de la ligue (16 rencontres, 840 jours-joueurs de poids pour la
// ligue). Rejoindre une équipe fiable ne rapporte rien ; la rendre fiable,
// si. Une équipe neuve prend la moyenne de la ligue. Les normes de la ligue
// sont celles de la saison de chaque rencontre, figées à la fin de la saison
// (en attendant, celles de la saison d'avant) : un rejeu ne fait jamais
// redescendre la carte, et la carte officielle gardée en base sert de
// plancher (seule la modération la baisse).
//
// Une seule règle pour les trois : on ajoute, essai après essai (une
// rencontre, ou une mise à jour pour coh), ce qui s'est passé moins ce
// qu'on attendait (l'avance) ; on retire la marge du hasard, b × √W (W : le
// nombre d'essais ; pour coh, les départs attendus), réglée à environ 1,4
// écart type pour que l'ancienneté ne paie pas ; à chaque mise à jour
// (toutes les 4 rencontres, jamais deux le même mois), l'acquis garde son
// meilleur niveau, max(acquis, avance − marge). Un cran par « pas »
// d'acquis ; les crans remplissent les jauges des cartes de joueur (2, 3,
// 5, 8 puis 12 crans pour +1). Rien ne descend.
//
// La note : l'arrondi supérieur de la moyenne des trois, comme un joueur
// (lib/sfl/engine.ts). Elle part de 75.
//
// Ce qui compte pour lui : les rencontres classées de son équipe
// (MatchCompteTeam.compte du championnat) pendant qu'il tient la place,
// qu'il soit venu ou non, et ses forfaits. Le score est lu 24 h après la
// fermeture de la feuille, quand plus rien ne peut changer ; un litige
// attend la revue. En rés, une seule rencontre par adversaire et par saison
// (contre les matchs arrangés), et une saisie restée seule de son propre
// camp ne compte que contre lui. Le 5 contre 4 n'est compté qu'une fois : en
// pré ; rés lit le score du terrain, avant le but retiré.

import type { FinitionEntraineur } from "@/components/sfl/skins-entraineur";
import type { Blason } from "@/lib/sfl/blason";
import { etatMatch, fermeture, type MatchCompteTeam } from "@/lib/sfl/championnat-team";
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

/** L'équipe qu'il entraîne, telle que la carte la montre : son nom (sous le sien) et son écusson. */
export interface EquipeEntraineur {
  nom: string;
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
  /** Sous le nom, sur la carte complète, après le pseudo : son équipe, en minuscules (comme « yanis · mc »). */
  detail?: string;
  /** L'écusson de son équipe : à la place du numéro de maillot, et dans la pastille. */
  equipe?: EquipeEntraineur;
}

/** La note : l'arrondi supérieur de la moyenne des trois, comme celle d'un joueur. */
export function noteEntraineur(s: StatsEntraineur): number {
  return Math.ceil(CLES_ENTRAINEUR.reduce((t, k) => t + s[k], 0) / CLES_ENTRAINEUR.length);
}

/** « 1 match », « 12 matchs » : la fiche, jamais la face (trois chiffres au plus, sous la note). */
export const rencontresDirigees = (n: number) => `${n} match${n > 1 ? "s" : ""}`;

/** La face d'une carte : la note, les trois dans l'ordre de la carte, son équipe. */
export function faceEntraineur(s: StatsEntraineur, o: { finition?: FinitionEntraineur | null; equipe?: EquipeEntraineur } = {}): FaceEntraineur {
  return {
    note: String(noteEntraineur(s)),
    stats: CLES_ENTRAINEUR.map((k) => [LIBELLES_ENTRAINEUR[k], s[k]]),
    finition: o.finition,
    court: "entraîneur",
    detail: o.equipe ? o.equipe.nom.toLowerCase() : undefined,
    equipe: o.equipe,
  };
}

/* ------------------------------ Les faits -------------------------------- */

const H = 3_600_000;
const JOUR = 86_400_000;

/**
 * Une rencontre de son équipe compte-t-elle pour lui, et avec quel score ?
 * Seulement si le championnat la classe (MatchCompteTeam.compte : validée,
 * entre divisions voisines, deux fois au plus contre la même équipe), lue
 * 24 h après la fermeture de la feuille : une saisie faite seule juste avant
 * la fermeture a eu ses 24 h, plus rien ne bouge. Avant, null (en attente).
 * Le silence vaut accord, comme au championnat ; mais `saisieSeule` dit
 * quand le score ne tient que par la saisie de son propre camp (la carte ne
 * la compte alors que contre lui). Le forfait de l'adversaire ne dit rien de
 * lui ; le sien compte.
 */
export function rencontreComptee(
  mc: MatchCompteTeam,
  equipe: number,
  maintenant = new Date()
): { pour: number; contre: number; forfait: boolean; saisieSeule: boolean } | null {
  const { m } = mc;
  const lecture = new Date(fermeture(m).getTime() + 24 * H);
  if (maintenant.getTime() < lecture.getTime() && m.statut !== "forfait") return null;
  if (!mc.compte) return null;
  const e = etatMatch(m, lecture);
  if (e.etat !== "valide") return null;
  if (e.forfaitDe != null && e.forfaitDe !== equipe) return null;
  const [de, a] = e.buts;
  const nous = m.de === equipe;
  const saisieSeule = e.forfaitDe == null && m.saisies.length === 1 && m.saisies[0].equipe === equipe;
  return { pour: nous ? de : a, contre: nous ? a : de, forfait: e.forfaitDe === equipe, saisieSeule };
}

/** Un inscrit de la feuille d'avant-match (H-2) : le joueur, et sa note de carte au dépôt. */
export interface Inscrit {
  id: string;
  note: number;
}

/** Une rencontre qui compte pour lui, telle que le serveur la prépare. */
export interface RencontreEntraineur {
  id: string;
  /** Le jour du coup d'envoi, AAAA-MM-JJ. */
  le: string;
  /** La saison du championnat : ses normes. */
  saison: number;
  /** L'équipe adverse (rés : une rencontre par adversaire et par saison). */
  adversaire: number;
  /** Un forfait de son équipe : une annulation à moins de 48 h, ou 3 présents ou moins. */
  forfait: boolean;
  /** Le score du terrain, avant le but retiré du 5 contre 4. */
  pour: number;
  contre: number;
  /** La règle du 5 contre 4 : son équipe à 4 (« nous »), ou l'adversaire (« eux »). */
  cinqContreQuatre: "nous" | "eux" | null;
  /** Sa feuille, déposée à H-2 (5 à 7 joueurs ; l'entraîneur n'y est jamais). */
  feuille: Inscrit[];
  /** Les notes de carte des inscrits de la feuille adverse. */
  adverses: number[];
  /** Le score ne tient que par la saisie de son propre capitaine (rencontreComptee). */
  saisieSeule?: boolean;
}

/** Seuls le départ et l'exclusion comptent contre la cohésion ; la dissolution et un changement de place, non. */
export type MotifDepart = "depart" | "exclusion" | "dissolution" | "changement-de-place";

/** Un joueur de son équipe pendant qu'il l'entraîne : sa signature, et son départ. */
export interface MembreEntraineur {
  id: string;
  nom: string;
  arrivee: string;
  depart?: { le: string; motif: MotifDepart };
  /** Sa dernière feuille avant l'arrivée de l'entraîneur (coh : il est actif 60 jours après). */
  derniereFeuille?: string;
}

/** Son équipe avant lui : de quoi la comparer à elle-même (pré et coh). Absente : une équipe neuve. */
export interface EquipeAvant {
  /** Ses rencontres classées d'avant (les 16 dernières au plus), et ce qu'elles valaient en moyenne en pré. */
  rencontres: number;
  presence: number;
  /** Ses jours-joueurs actifs d'avant (les 120 derniers jours), et les départs comptés sur la même période. */
  joursActifs: number;
  departs: number;
}

export interface CarriereEntraineur {
  /** Le jour où il a signé comme entraîneur de cette équipe. */
  arrivee: string;
  /** La fin de sa place (il part, change de place, l'équipe est dissoute) : la fenêtre de coh se ferme là. */
  fin?: string;
  rencontres: RencontreEntraineur[];
  membres: MembreEntraineur[];
  equipeAvant?: EquipeAvant;
}

/** Ce qui se passe en moyenne dans la ligue Team, par saison (figé à la fin de la saison). */
export interface NormesLigue {
  /** pré : ce que vaut une rencontre en moyenne (0, −1, −3). */
  presence: number;
  /** coh : les départs par jour-joueur actif. */
  departsParJour: number;
}

/** Les normes de départ, tirées d'une ligue simulée (modele-v3.md), en attendant celles de la vraie ligue. */
export const NORMES_DEPART: NormesLigue = { presence: -0.08, departsParJour: 0.0012 };

/** Les normes d'une saison : la sienne si elle est figée, sinon la dernière figée avant, sinon celles de départ. */
export function normesDe(normes: Partial<Record<number, NormesLigue>> | undefined, saison: number): NormesLigue {
  for (let s = saison; s >= 1; s--) {
    const n = normes?.[s];
    if (n) return n;
  }
  return NORMES_DEPART;
}

/* ------------------------------- Le barème ------------------------------- */

export const BAREME_ENTRAINEUR = {
  /** La marge du hasard (b de b × √W) et ce que vaut un cran, par caractéristique. */
  // Calés sur des ligues simulées (modele-v3.md, v3/sim4/) : la marge vaut
  // de 1,4 à 1,7 écart type d'un essai, pour qu'un entraîneur moyen ne monte
  // presque pas avec l'ancienneté (75,5 après 40 rencontres, 76 après 100) ;
  // un entraîneur du quart supérieur passe devant un moyen une fois sur deux
  // après 40 rencontres, deux fois sur trois après 100. À recaler sur les
  // vraies feuilles, comme l'évolution des cartes de joueur.
  RES: { hasard: 0.62, cran: 0.2 },
  PRES: { hasard: 0.7, cran: 1 },
  COH: { hasard: 1.4, cran: 0.12 },
  /** L'attendu : 16 points de note de carte d'écart, et l'équipe la plus forte est attendue à 0,91 (10 points : 0,81). */
  echelle: 16,
  /** pré, par rencontre. */
  presence: { venue: 0, cinqContreQuatre: -1, forfait: -3 },
  /** Ce que pèse son équipe d'avant face à la moyenne de la ligue : 16 rencontres (pré), 840 jours-joueurs (coh). */
  poidsLigue: { rencontres: 16, joursActifs: 840 },
  /** coh : un joueur est actif ses 60 premiers jours, puis les 60 jours qui suivent chaque feuille où il est inscrit. */
  actifJours: 60,
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

/** La force d'une feuille : la moyenne des notes de carte de ses cinq meilleurs inscrits ; null sans feuille. */
export function forceFeuille(notes: number[]): number | null {
  if (!notes.length) return null;
  const cinq = [...notes].sort((a, b) => b - a).slice(0, 5);
  return cinq.reduce((t, n) => t + n, 0) / cinq.length;
}

/** L'attendu de son équipe, d'après la force des deux feuilles. */
export function attenduDe(force: number, forceAdverse: number): number {
  return 1 / (1 + 10 ** ((forceAdverse - force) / BAREME_ENTRAINEUR.echelle));
}

/* ------------------------------- Le calcul ------------------------------- */

/** Une ligne du journal : en mots, jamais l'attendu ni l'avance en chiffres. */
export interface FaitEntraineur {
  le: string;
  /** La rencontre (son id) ou la mise à jour (« maj »). */
  source: string;
  cle: CleEntraineur;
  /** Au-dessus de ce qu'on attendait (1), dedans (0), en dessous (−1). */
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
  /** La carte officielle : celle de la dernière mise à jour (ou le départ), jamais sous le plancher. */
  officielles: StatsEntraineur;
  /** Ce que donnerait une mise à jour aujourd'hui, pas encore officiel. */
  enAttente: Partial<StatsEntraineur>;
  /** Les jauges : les crans dans le niveau en cours, la taille ; la dette en crans (à rattraper avant le prochain). */
  jauges: Record<CleEntraineur, { crans: number; taille: number; dette: number }>;
  /** Combien de rencontres avant la prochaine mise à jour (au moins). */
  avantProchaine: number;
  journal: FaitEntraineur[];
  majs: MiseAJourEntraineur[];
  /** Les rencontres dirigées : la fiche, pas la face. */
  rencontres: number;
  /** Les victoires « Exploit » (l'attendu de 0,30 ou moins) : leurs rencontres. */
  exploits: string[];
  compteurs: CompteursEntraineur;
}

const partout = (v: number): StatsEntraineur => ({ RES: v, PRES: v, COH: v });
const zeroCompteurs = (): CompteursEntraineur =>
  Object.fromEntries(CLES_ENTRAINEUR.map((k) => [k, { avance: 0, poids: 0, acquis: 0 }])) as CompteursEntraineur;
const jourDe = (iso: string) => Math.floor(Date.parse(iso.slice(0, 10)) / JOUR);
const isoDe = (j: number) => new Date(j * JOUR).toISOString().slice(0, 10);

/** L'acquis possible maintenant : l'avance moins la marge du hasard. */
const net = (k: CleEntraineur, c: CompteursEntraineur[CleEntraineur]) => c.avance - BAREME_ENTRAINEUR[k].hasard * Math.sqrt(c.poids);
const crans = (k: CleEntraineur, acquis: number) => Math.floor(acquis / BAREME_ENTRAINEUR[k].cran + 1e-9);

/** pré : ce que vaut une rencontre (avant la comparaison). */
export function valeurPresence(r: Pick<RencontreEntraineur, "forfait" | "cinqContreQuatre">): { valeur: number; texte: string } {
  const P = BAREME_ENTRAINEUR.presence;
  if (r.forfait) return { valeur: P.forfait, texte: "forfait" };
  if (r.cinqContreQuatre === "nous") return { valeur: P.cinqContreQuatre, texte: "5 contre 4" };
  return { valeur: P.venue, texte: "venue" };
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
 * Rejoue sa carrière dans une équipe, rencontre par rencontre. Options :
 * `normes`, celles de la ligue par saison (figées) ; `avant`, les compteurs
 * de ses équipes d'avant (ils le suivent) ; `depart`, ses trois au départ
 * (75 partout pour un nouvel entraîneur) ; `plancher`, sa carte officielle
 * gardée en base (la carte ne passe jamais dessous).
 */
export function evoluerEntraineur(
  carriere: CarriereEntraineur,
  options: { normes?: Partial<Record<number, NormesLigue>>; avant?: CompteursEntraineur; depart?: StatsEntraineur; plancher?: StatsEntraineur } = {}
): EvolutionEntraineur {
  const B = BAREME_ENTRAINEUR;
  const depart = options.depart ?? partout(DEPART_ENTRAINEUR);
  const plancher = options.plancher;
  const c: CompteursEntraineur = options.avant ? structuredClone(options.avant) : zeroCompteurs();
  const valeurs = (acquis: (k: CleEntraineur) => number): StatsEntraineur =>
    Object.fromEntries(
      CLES_ENTRAINEUR.map((k) => [k, Math.max(plancher?.[k] ?? 0, niveauEntraineur(crans(k, acquis(k)), depart[k]).valeur)])
    ) as StatsEntraineur;
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

  // Son équipe avant lui, rapprochée de la moyenne de la ligue de la saison.
  const av = carriere.equipeAvant;
  const P = B.poidsLigue;
  const refPresence = (saison: number) => {
    const L = normesDe(options.normes, saison).presence;
    return av ? (av.rencontres * av.presence + P.rencontres * L) / (av.rencontres + P.rencontres) : L;
  };
  const refDeparts = (saison: number) => {
    const L = normesDe(options.normes, saison).departsParJour;
    return av ? (av.departs + P.joursActifs * L) / (av.joursActifs + P.joursActifs) : L;
  };

  // coh : quand un joueur est-il actif ? Ses 60 premiers jours dans l'équipe, puis les 60 jours qui suivent
  // chaque feuille où il est inscrit (sa dernière feuille d'avant l'arrivée de l'entraîneur comprise).
  const feuilles = new Map<string, number[]>();
  for (const m of carriere.membres) if (m.derniereFeuille) feuilles.set(m.id, [jourDe(m.derniereFeuille)]);
  for (const r of rencontres)
    for (const i of r.feuille) {
      const t = feuilles.get(i.id);
      if (t) t.push(jourDe(r.le));
      else feuilles.set(i.id, [jourDe(r.le)]);
    }
  const arrivees = new Map(carriere.membres.map((m) => [m.id, jourDe(m.arrivee)]));
  const actif = (m: MembreEntraineur, j: number) => {
    if (j - arrivees.get(m.id)! < B.actifJours) return true;
    const t = feuilles.get(m.id);
    if (!t) return false;
    // La dernière feuille à j ou avant (les jours des feuilles sont dans l'ordre).
    let lo = 0;
    let hi = t.length;
    while (lo < hi) {
      const mi = (lo + hi) >> 1;
      if (t[mi] <= j) lo = mi + 1;
      else hi = mi;
    }
    return lo > 0 && j - t[lo - 1] < B.actifJours;
  };

  let fenetre = 0;
  let debut = jourDe(carriere.arrivee);
  let derniereMaj = null as string | null;
  let saisonCourante = rencontres[0]?.saison ?? 1;
  const deja = new Set<string>();

  /** coh sur la fenêtre [debut, fin) : les départs de joueurs actifs, contre ceux qu'on attendait. */
  const fermerCohesion = (fin: number) => {
    const taux = refDeparts(saisonCourante);
    let expose = 0;
    for (const m of carriere.membres) {
      const a = Math.max(debut, jourDe(m.arrivee));
      const z = Math.min(fin, m.depart ? jourDe(m.depart.le) : fin);
      for (let j = a; j < z; j++) if (actif(m, j)) expose += 1;
    }
    const attendus = expose * taux;
    const partis = carriere.membres.filter((m) => {
      if (!m.depart || (m.depart.motif !== "depart" && m.depart.motif !== "exclusion")) return false;
      const j = jourDe(m.depart.le);
      return j >= debut && j < fin && actif(m, j);
    });
    if (attendus > 0 || partis.length) {
      essai("COH", attendus - partis.length, attendus);
      note(
        isoDe(fin),
        "maj",
        "COH",
        attendus - partis.length,
        partis.length ? partis.map((m) => `${m.nom} ${m.depart!.motif === "depart" ? "est parti" : "a été exclu"}`).join(", ") : "personne n'est parti"
      );
    }
    debut = fin;
  };

  /** À la mise à jour : coh sur la fenêtre, puis chaque acquis garde son meilleur niveau. */
  const mettreAJour = (le: string) => {
    fermerCohesion(jourDe(le) + 1);
    for (const k of CLES_ENTRAINEUR) c[k].acquis = Math.max(c[k].acquis, net(k, c[k]));
    const live = valeurs((k) => c[k].acquis);
    const gains: Partial<StatsEntraineur> = {};
    for (const k of CLES_ENTRAINEUR) if (live[k] > officielles[k]) gains[k] = live[k] - officielles[k];
    majs.unshift({ apres: le, stats: live, gains });
    officielles = live;
    fenetre = 0;
    derniereMaj = le;
  };

  for (const r of rencontres) {
    saisonCourante = r.saison;
    // rés : les rencontres jouées, les deux feuilles connues, la première contre cet adversaire dans la saison.
    const force = forceFeuille(r.feuille.map((i) => i.note));
    const forceAdverse = forceFeuille(r.adverses);
    const paire = `${r.saison}:${r.adversaire}`;
    if (!r.forfait && force != null && forceAdverse != null && !deja.has(paire)) {
      deja.add(paire);
      const s = r.pour > r.contre ? 1 : r.pour === r.contre ? 0.5 : 0;
      const e = attenduDe(force, forceAdverse);
      // Sa saisie restée seule ne compte que contre lui.
      if (!r.saisieSeule || s <= e) {
        essai("RES", s - e);
        note(r.le, r.id, "RES", s - e, resultatEnMots(s, e));
        if (s === 1 && e <= B.exploit) exploits.push(r.id);
      }
    }
    // pré : toutes, forfaits compris, contre son équipe d'avant.
    const p = valeurPresence(r);
    const x = p.valeur - refPresence(r.saison);
    essai("PRES", x);
    note(r.le, r.id, "PRES", x, p.texte);
    fenetre += 1;
    if (fenetre >= B.maj.rencontres && derniereMaj?.slice(0, 7) !== r.le.slice(0, 7)) mettreAJour(r.le);
  }
  // Sa place prend fin : les départs de la dernière fenêtre comptent (sans mise à jour ; ses compteurs le suivent).
  if (carriere.fin) fermerCohesion(jourDe(carriere.fin));

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
