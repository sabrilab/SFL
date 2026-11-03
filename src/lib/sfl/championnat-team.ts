// Le championnat de Bola Team (Sabri, 24/10 : « il faut que tu t'inspires
// d'un championnat comme la Ligue 1, avec des équipes, avec certaines
// divisions. Plus on a d'équipes, plus la division et le classement se font
// comme en Ligue 1 »). Règles officielles : BOLA docs/gameplay/11, art. 8
// (la feuille), 9 (les points), 12 (même adversaire) et 16 (le championnat),
// avec ce que Sabri a changé le 24/10 :
//   · 2 points la victoire, 1 le nul, 0 la défaite (au lieu de 3 / 1 / 0) ;
//   · une saison dure 4 mois (« un championnat régi sur 4 mois ») : la
//     première du 1er novembre 2026 au 28 février 2027, puis mars–juin,
//     juillet–octobre. Il y aura des récompenses à la fin de chacune ;
//   · à la fin de chaque saison, les 3 premiers de chaque division montent
//     et les 3 derniers descendent ; entre deux divisions dont l'une compte
//     30 équipes ou plus, 5 (« tu peux augmenter le nombre de relégables et
//     le nombre de gens qui montent »).
// Le reste vient des règles officielles :
//   · moins de 30 équipes : une division unique ; dès 30, des divisions de
//     18 comme la Ligue 1 (D1, D2…), la dernière reçoit toutes les autres.
//     Le nombre de divisions se fixe au début de la saison ; une équipe née
//     en cours de saison entre dans la dernière ;
//   · un match compte si les deux équipes sont dans la même division ou
//     dans deux divisions voisines (chacune marque dans la sienne), et au
//     plus 2 fois contre la même équipe dans la saison (un aller, un
//     retour) : au-delà, c'est un amical ;
//   · la feuille : chaque capitaine (ou vice) saisit le score final et les
//     buteurs et passeurs de son équipe, du coup d'envoi à 3 jours après.
//     Deux saisies qui collent valident le match ; une seule vaut au bout
//     de 24 h ; deux qui ne collent pas laissent le match en litige (chacun
//     peut corriger la sienne tant que la feuille est ouverte, sinon le
//     match n'est pas classé) ;
//   · un forfait (un match annulé à moins de 48 h) se compte 3 – 0 ;
//   · le 5 contre 4 (art. 7.2 et 7.3 ; 03/11/2026, Q4 à Ilyes) : avec le
//     score du terrain, chaque capitaine déclare les présents des deux
//     équipes (5 et plus, 4, 3 et moins), qui doivent coller eux aussi.
//     L'équipe à 4 face à 5 ou plus perd 1 but au score final, ou
//     l'adversaire en gagne 1 si elle n'a pas marqué (scoreFinal) ; deux
//     équipes à 4 : un amical, qui ne prend pas l'une des 2 rencontres de
//     la saison ; 3 ou moins : le forfait de cette équipe, 0 – 3 ; les deux :
//     non classé. Les buts et passes du terrain gardent leur valeur ;
//   · à égalité de points : la différence de buts, les buts marqués, les
//     victoires.
// Les buts et les passes n'entrent pas dans les points de l'équipe : ils
// font le classement des buteurs et celui des passeurs du championnat.
//
// Tout se recalcule de la base à chaque lecture (equipe_defis,
// equipe_resultats, equipe_resultat_joueurs : supabase/schema.sql) : les
// divisions d'une saison se déduisent du classement final de la
// précédente. Module pur, sans React ni base.

export const CHAMPIONNAT = {
  points: { V: 2, N: 1, D: 0 },
  /** La première saison commence le 1er novembre 2026. */
  depart: { annee: 2026, mois: 11 },
  moisParSaison: 4,
  /** Sous ce nombre d'équipes, une division unique (règle officielle). */
  divisionUnique: 30,
  /** Puis des divisions de 18, comme la Ligue 1. */
  tailleDivision: 18,
  /** Montées et descentes entre deux divisions… */
  echange: 3,
  /** … et 5 quand l'une des deux compte 30 équipes ou plus. */
  echangeGrande: 5,
  grandeDivision: 30,
  /** Matchs comptés au plus contre la même équipe dans une saison. */
  rencontres: 2,
  /** Le score d'un forfait. */
  forfait: 3,
  /** Une saisie seule vaut au bout de 24 h. */
  validationH: 24,
  /** La feuille se remplit jusqu'à 3 jours après le coup d'envoi. */
  saisieJours: 3,
} as const;

export type Res = "V" | "N" | "D";

export interface EquipeChampionnat {
  id: number;
  nom: string;
  /** ISO : sa naissance (une équipe née en cours de saison entre dans la dernière division). */
  creeLe: string;
  /** Peut jouer (5 signataires ou plus) et n'est pas dissoute. */
  active: boolean;
}

/** Les présents déclarés d'une équipe : 5 (cinq ou plus), 4, ou 3 (trois ou moins). */
export type Presents = 3 | 4 | 5;

export interface SaisieTeam {
  equipe: number;
  pour: number;
  contre: number;
  /** ISO. */
  le: string;
  /** Les présents de son équipe, puis ceux de l'autre ; absents (une feuille d'avant le 03/11/2026) : 5. */
  presents?: Presents;
  presentsAdverses?: Presents;
}

export interface ButeurTeam {
  equipe: number;
  joueur: string;
  name: string;
  buts: number;
  passes: number;
}

/**
 * La feuille d'avant-match d'une équipe (03/11/2026, equipe_feuille dans la
 * base) : 5 à 7 de ses joueurs, figée au coup d'envoi. Avant, seule
 * l'équipe la lit ; ensuite, toute la ligue.
 */
export interface FeuilleTeam {
  equipe: number;
  /** Les identifiants des joueurs inscrits. */
  joueurs: string[];
  /** Qui l'a déposée (son identifiant), et quand (ISO) : le dernier dépôt fait foi. */
  par: string | null;
  le: string;
}

export interface MatchTeam {
  /** L'id du défi. */
  id: number;
  de: number;
  a: number;
  /** « 2026-11-14 », heure de Paris. */
  jour: string;
  heure: string;
  lieu: string;
  statut: "accepte" | "forfait";
  forfaitDe: number | null;
  saisies: SaisieTeam[];
  buteurs: ButeurTeam[];
  /** Les feuilles d'avant-match qu'on peut lire (aucune avant leur dépôt). */
  feuilles?: FeuilleTeam[];
}

export type EtatMatch =
  | { etat: "a-venir" }
  /** Coup d'envoi passé, personne n'a saisi : la feuille est ouverte. */
  | { etat: "a-saisir"; ferme: Date }
  /** Une équipe a saisi ; l'autre confirme, sinon ça vaut à `vaut`. */
  | { etat: "a-confirmer"; par: number; buts: [number, number]; vaut: Date; ferme: Date }
  /** Les deux saisies ne collent pas, la feuille est encore ouverte. */
  | { etat: "litige"; ferme: Date }
  /**
   * `buts` : le score du terrain, de `de` puis de `a` (un forfait : 3 – 0) ;
   * `final` : celui qui décide du résultat (le 5 contre 4 l'a changé) ;
   * `aQuatre` : l'équipe arrêtée à 4 face à 5 ou plus ; `amical` : deux
   * équipes à 4 ; `presents` : ceux de `de`, puis de `a`.
   */
  | {
      etat: "valide";
      buts: [number, number];
      final: [number, number];
      forfaitDe: number | null;
      aQuatre: number | null;
      presents: [Presents, Presents];
      amical?: "deux-a-quatre";
    }
  /** Feuille fermée sans score qui tienne. */
  | { etat: "non-classe" };

const H = 3600_000;

/** Le coup d'envoi d'un match (heure de Paris, l'hiver comme l'été). */
export function coupDEnvoiTeam(m: Pick<MatchTeam, "jour" | "heure">): Date {
  const [a, mo, j] = m.jour.split("-").map(Number);
  const [h, mi] = m.heure.split(":").map(Number);
  const utc = Date.UTC(a, mo - 1, j, h, mi);
  const paris = new Date(new Date(utc).toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime();
  const local = new Date(new Date(utc).toLocaleString("en-US", { timeZone: "UTC" })).getTime();
  return new Date(utc - (paris - local));
}

/** La feuille ferme 3 jours après le coup d'envoi. */
export const fermeture = (m: Pick<MatchTeam, "jour" | "heure">) => new Date(coupDEnvoiTeam(m).getTime() + CHAMPIONNAT.saisieJours * 24 * H);

/** Le score final d'après le score du terrain et les présents (art. 7.3), tout de `de` puis de `a`. */
export interface ScoreFinal {
  final: [number, number];
  /** Le côté arrêté à 4 face à 5 ou plus (0 : `de`, 1 : `a`). */
  aQuatre: 0 | 1 | null;
  /** Le côté forfait, à 3 ou moins (0 – 3). */
  forfait: 0 | 1 | null;
  /** Deux équipes à 4 : un amical, rien de retiré. */
  amical: boolean;
  /** Les deux à 3 ou moins : personne ne gagne, le match n'est pas classé. */
  nonClasse: boolean;
}

/**
 * Le 5 contre 4 (Règlement Team art. 7.3, règle du fondateur) : l'équipe à
 * 4 face à 5 ou plus perd 1 but au score final ; si elle n'a pas marqué,
 * l'adversaire en gagne 1 (le score final ne descend pas sous 0). 3 ou moins
 * d'un côté : son forfait, 0 – 3 ; des deux côtés : non classé.
 */
export function scoreFinal(terrain: [number, number], presents: [Presents, Presents]): ScoreFinal {
  const [pDe, pA] = presents;
  const rien = { aQuatre: null, forfait: null, amical: false, nonClasse: false } as const;
  const f = CHAMPIONNAT.forfait;
  if (pDe <= 3 && pA <= 3) return { ...rien, final: [0, 0], nonClasse: true };
  if (pDe <= 3) return { ...rien, final: [0, f], forfait: 0 };
  if (pA <= 3) return { ...rien, final: [f, 0], forfait: 1 };
  if (pDe === 4 && pA === 4) return { ...rien, final: [terrain[0], terrain[1]], amical: true };
  if (pDe === 4) return { ...rien, final: terrain[0] > 0 ? [terrain[0] - 1, terrain[1]] : [terrain[0], terrain[1] + 1], aQuatre: 0 };
  if (pA === 4) return { ...rien, final: terrain[1] > 0 ? [terrain[0], terrain[1] - 1] : [terrain[0] + 1, terrain[1]], aQuatre: 1 };
  return { ...rien, final: [terrain[0], terrain[1]] };
}

const presentsDe = (p: number | undefined): Presents => (p === 3 || p === 4 ? p : 5);

/** Les présents qu'une saisie déclare, de `de` puis de `a`. */
export function presentsSaisis(m: Pick<MatchTeam, "de">, s: SaisieTeam): [Presents, Presents] {
  const miens = presentsDe(s.presents);
  const siens = presentsDe(s.presentsAdverses);
  return s.equipe === m.de ? [miens, siens] : [siens, miens];
}

/** Deux saisies collent : le même score du terrain et les mêmes présents, vus de chaque côté. */
export const collent = (a: SaisieTeam, b: SaisieTeam) =>
  a.pour === b.contre &&
  a.contre === b.pour &&
  presentsDe(a.presents) === presentsDe(b.presentsAdverses) &&
  presentsDe(a.presentsAdverses) === presentsDe(b.presents);

/** Le match validé : son score final, son forfait, son 5 contre 4 ; ou non classé (les deux à 3 ou moins). */
function valide(m: MatchTeam, terrain: [number, number], presents: [Presents, Presents]): EtatMatch {
  const s = scoreFinal(terrain, presents);
  if (s.nonClasse) return { etat: "non-classe" };
  const cote = (c: 0 | 1 | null) => (c == null ? null : c === 0 ? m.de : m.a);
  if (s.forfait != null) return { etat: "valide", buts: s.final, final: s.final, forfaitDe: cote(s.forfait), aQuatre: null, presents };
  return {
    etat: "valide",
    buts: terrain,
    final: s.final,
    forfaitDe: null,
    aQuatre: cote(s.aQuatre),
    presents,
    ...(s.amical ? { amical: "deux-a-quatre" as const } : {}),
  };
}

/** Où en est un match : à venir, à saisir, à confirmer, en litige, validé ou non classé. */
export function etatMatch(m: MatchTeam, maintenant = new Date()): EtatMatch {
  if (m.statut === "forfait") {
    const f = CHAMPIONNAT.forfait;
    const buts: [number, number] = m.forfaitDe === m.de ? [0, f] : [f, 0];
    return { etat: "valide", buts, final: buts, forfaitDe: m.forfaitDe, aQuatre: null, presents: [5, 5] };
  }
  const t = maintenant.getTime();
  if (coupDEnvoiTeam(m).getTime() > t) return { etat: "a-venir" };
  const ferme = fermeture(m);
  const sDe = m.saisies.find((s) => s.equipe === m.de);
  const sA = m.saisies.find((s) => s.equipe === m.a);
  if (sDe && sA) {
    if (collent(sDe, sA)) return valide(m, [sDe.pour, sDe.contre], presentsSaisis(m, sDe));
    return ferme.getTime() > t ? { etat: "litige", ferme } : { etat: "non-classe" };
  }
  const s = sDe ?? sA;
  if (s) {
    const buts: [number, number] = s.equipe === m.de ? [s.pour, s.contre] : [s.contre, s.pour];
    const vaut = new Date(new Date(s.le).getTime() + CHAMPIONNAT.validationH * H);
    if (vaut.getTime() <= t) return valide(m, buts, presentsSaisis(m, s));
    return { etat: "a-confirmer", par: s.equipe, buts, vaut, ferme };
  }
  return ferme.getTime() > t ? { etat: "a-saisir", ferme } : { etat: "non-classe" };
}

// ─────────────────────────────── Saisons ───────────────────────────────

const indexMois = (annee: number, mois: number) => annee * 12 + (mois - 1);
const DEPART = indexMois(CHAMPIONNAT.depart.annee, CHAMPIONNAT.depart.mois);

/** La saison d'un jour « 2026-11-14 » : 1, 2…, ou 0 avant la première. */
export function saisonDuJour(jour: string): number {
  const [a, m] = jour.split("-").map(Number);
  const ecart = indexMois(a, m) - DEPART;
  return ecart < 0 ? 0 : Math.floor(ecart / CHAMPIONNAT.moisParSaison) + 1;
}

/** Le jour de Paris d'un instant, « 2026-11-14 ». */
export function jourParis(d: Date): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** La saison en cours (la première tant qu'elle n'a pas commencé). */
export const saisonEnCours = (maintenant = new Date()) => Math.max(1, saisonDuJour(jourParis(maintenant)));

/** Premier jour de la saison, et premier jour de la suivante (« 2026-11-01 », « 2027-03-01 »). */
export function bornesSaison(n: number): { debut: string; finExclue: string } {
  const iso = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`;
  const i = DEPART + (Math.max(1, n) - 1) * CHAMPIONNAT.moisParSaison;
  return { debut: iso(i), finExclue: iso(i + CHAMPIONNAT.moisParSaison) };
}

/** Le dernier jour de la saison, « 2027-02-28 ». */
export function dernierJour(n: number): string {
  const [a, m] = bornesSaison(n).finExclue.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, 0)).toISOString().slice(0, 10);
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 1er nov. 2026 – 28 févr. 2027 ». */
export function periodeSaison(n: number): string {
  const { debut } = bornesSaison(n);
  const [a1, m1] = debut.split("-").map(Number);
  const [a2, m2, j2] = dernierJour(n).split("-").map(Number);
  return `1er ${MOIS_COURTS[m1 - 1]}${a1 !== a2 ? ` ${a1}` : ""} – ${j2} ${MOIS_COURTS[m2 - 1]} ${a2}`;
}

/** La saison est-elle finie (son dernier jour passé, heure de Paris) ? */
export const saisonFinie = (n: number, maintenant = new Date()) => jourParis(maintenant) >= bornesSaison(n).finExclue;

/** La saison a-t-elle commencé ? */
export const saisonCommencee = (n: number, maintenant = new Date()) => jourParis(maintenant) >= bornesSaison(n).debut;

// ────────────────────────────── Divisions ──────────────────────────────

/** Les tailles des divisions pour n équipes : une seule sous 30, puis des 18 et une dernière ouverte. */
export function taillesDivisions(n: number): number[] {
  if (n < CHAMPIONNAT.divisionUnique) return [n];
  const k = Math.max(2, Math.floor(n / CHAMPIONNAT.tailleDivision));
  return [...Array.from({ length: k - 1 }, () => CHAMPIONNAT.tailleDivision), n - CHAMPIONNAT.tailleDivision * (k - 1)];
}

/** Combien montent de la division du dessous (et descendent de celle du dessus) entre deux divisions voisines. */
export function echangeEntre(haut: number, bas: number): number {
  const e = haut >= CHAMPIONNAT.grandeDivision || bas >= CHAMPIONNAT.grandeDivision ? CHAMPIONNAT.echangeGrande : CHAMPIONNAT.echange;
  return Math.max(0, Math.min(e, Math.floor(Math.min(haut, bas) / 2)));
}

/** « Division unique », « D1 », « D2 »… */
export const nomDivision = (n: number, total: number) => (total <= 1 ? "Division unique" : `D${n}`);

export interface LigneClassement {
  equipe: number;
  rang: number;
  j: number;
  g: number;
  n: number;
  p: number;
  bp: number;
  bc: number;
  diff: number;
  pts: number;
  /** Les 5 derniers résultats comptés, du plus ancien au plus récent. */
  forme: Res[];
}

export interface Division {
  /** 1 pour la D1. */
  n: number;
  nom: string;
  lignes: LigneClassement[];
  /** Les premiers qui monteront, les derniers qui descendront (0 en D1 et dans la dernière). */
  montent: number;
  descendent: number;
}

/** Un match vu du championnat : son état, et s'il compte (ou pourquoi pas). */
export interface MatchCompteTeam {
  m: MatchTeam;
  etat: EtatMatch;
  saison: number;
  compte: boolean;
  /** Pourquoi il ne compte pas, quand il est validé (deux équipes à 4 : un amical, art. 7.2). */
  amical?: "rencontres" | "divisions" | "hors-saison" | "deux-a-quatre";
}

export interface Classe {
  joueur: string;
  name: string;
  equipe: number;
  rang: number;
  buts: number;
  passes: number;
}

export interface Championnat {
  saison: number;
  divisions: Division[];
  /** Tous les matchs de la saison, du plus récent au plus ancien. */
  matchs: MatchCompteTeam[];
  buteurs: Classe[];
  passeurs: Classe[];
  /** La division de chaque équipe engagée. */
  divisionDe: Map<number, number>;
  commencee: boolean;
  finie: boolean;
}

/** Points, différence, buts marqués, victoires ; ex æquo parfaits au même rang. */
function trier(lignes: LigneClassement[], nomDe: (id: number) => string): LigneClassement[] {
  const t = [...lignes].sort(
    (x, y) => y.pts - x.pts || y.diff - x.diff || y.bp - x.bp || y.g - x.g || nomDe(x.equipe).localeCompare(nomDe(y.equipe), "fr")
  );
  t.forEach((l, i) => {
    const p = t[i - 1];
    l.rang = p && p.pts === l.pts && p.diff === l.diff && p.bp === l.bp && p.g === l.g ? p.rang : i + 1;
  });
  return t;
}

const vide = (equipe: number): LigneClassement => ({ equipe, rang: 0, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0, diff: 0, pts: 0, forme: [] });

function classer(joueurs: Map<string, Classe>, cle: "buts" | "passes"): Classe[] {
  const autre = cle === "buts" ? "passes" : "buts";
  const t = [...joueurs.values()]
    .filter((c) => c[cle] > 0)
    .sort((x, y) => y[cle] - x[cle] || y[autre] - x[autre] || x.name.localeCompare(y.name, "fr"));
  t.forEach((c, i) => {
    const p = t[i - 1];
    c.rang = p && p[cle] === c[cle] ? p.rang : i + 1;
  });
  return t.map((c) => ({ ...c }));
}

/**
 * Le championnat d'une saison : ses divisions et leurs classements, ses
 * matchs (comptés ou amicaux), ses buteurs et ses passeurs.
 */
export function championnat(
  saison: number,
  equipes: EquipeChampionnat[],
  matchs: MatchTeam[],
  maintenant = new Date()
): Championnat {
  const memo = new Map<number, Championnat>();
  const parId = new Map(equipes.map((e) => [e.id, e]));
  const nomDe = (id: number) => parId.get(id)?.nom ?? "";
  const etats = matchs
    .map((m) => ({ m, etat: etatMatch(m, maintenant), saison: saisonDuJour(m.jour), coup: coupDEnvoiTeam(m).getTime() }))
    .sort((x, y) => x.coup - y.coup || x.m.id - y.m.id);

  function calculer(s: number): Championnat {
    const deja = memo.get(s);
    if (deja) return deja;
    const { debut } = bornesSaison(s);
    const ici = etats.filter((x) => x.saison === s);
    // Engagées : les équipes qui peuvent jouer, et celles qui ont déjà un match validé dans la saison.
    const ontJoue = new Set(ici.filter((x) => x.etat.etat === "valide").flatMap((x) => [x.m.de, x.m.a]));
    const engagees = equipes.filter((e) => e.active || ontJoue.has(e.id));
    const parNaissance = (a: EquipeChampionnat, b: EquipeChampionnat) => a.creeLe.localeCompare(b.creeLe) || a.id - b.id;

    // L'ordre de départ : le classement final de la saison d'avant, montées et descentes faites.
    let ordre: number[] = [];
    if (s > 1) {
      const avant = calculer(s - 1).divisions.map((d) => d.lignes.map((l) => l.equipe));
      for (let i = 0; i < avant.length - 1; i++) {
        const e = echangeEntre(avant[i].length, avant[i + 1].length);
        if (e === 0) continue;
        const descendent = avant[i].splice(avant[i].length - e, e);
        const montent = avant[i + 1].splice(0, e);
        avant[i].push(...montent);
        avant[i + 1].unshift(...descendent);
      }
      ordre = avant.flat();
    }
    const engageesIds = new Set(engagees.map((e) => e.id));
    ordre = ordre.filter((id) => engageesIds.has(id));
    const nouvelles = engagees.filter((e) => !ordre.includes(e.id)).sort(parNaissance);
    // Le nombre de divisions se fixe sur les équipes nées avant le premier jour ; les autres vont dans la dernière.
    const avantDebut = [...ordre, ...nouvelles.filter((e) => e.creeLe.slice(0, 10) < debut).map((e) => e.id)];
    const tard = nouvelles.filter((e) => e.creeLe.slice(0, 10) >= debut).map((e) => e.id);
    const tailles = taillesDivisions(avantDebut.length);
    const groupes: number[][] = [];
    let k = 0;
    for (const t of tailles) {
      groupes.push(avantDebut.slice(k, k + t));
      k += t;
    }
    groupes[groupes.length - 1].push(...tard);

    const divisionDe = new Map<number, number>();
    groupes.forEach((g, i) => g.forEach((id) => divisionDe.set(id, i + 1)));

    // Les matchs : validés, entre divisions voisines, deux fois au plus contre la même équipe.
    const lignes = new Map<number, LigneClassement>([...divisionDe.keys()].map((id) => [id, vide(id)]));
    const rencontres = new Map<string, number>();
    const joueurs = new Map<string, Classe>();
    const comptes: MatchCompteTeam[] = ici.map(({ m, etat }) => {
      if (etat.etat !== "valide") return { m, etat, saison: s, compte: false };
      // Deux équipes à 4 : un amical, qui ne prend pas l'une des deux rencontres de la saison.
      if (etat.amical === "deux-a-quatre") return { m, etat, saison: s, compte: false, amical: "deux-a-quatre" as const };
      const dDe = divisionDe.get(m.de);
      const dA = divisionDe.get(m.a);
      if (dDe == null || dA == null || Math.abs(dDe - dA) > 1) return { m, etat, saison: s, compte: false, amical: "divisions" as const };
      const paire = m.de < m.a ? `${m.de}-${m.a}` : `${m.a}-${m.de}`;
      const n = rencontres.get(paire) ?? 0;
      if (n >= CHAMPIONNAT.rencontres) return { m, etat, saison: s, compte: false, amical: "rencontres" as const };
      rencontres.set(paire, n + 1);
      // Le score final : le 5 contre 4 a pu le changer.
      const [bDe, bA] = etat.final;
      for (const [id, pour, contre] of [
        [m.de, bDe, bA],
        [m.a, bA, bDe],
      ] as const) {
        const l = lignes.get(id)!;
        const r: Res = pour > contre ? "V" : pour === contre ? "N" : "D";
        l.j += 1;
        l.g += r === "V" ? 1 : 0;
        l.n += r === "N" ? 1 : 0;
        l.p += r === "D" ? 1 : 0;
        l.bp += pour;
        l.bc += contre;
        l.diff = l.bp - l.bc;
        l.pts += CHAMPIONNAT.points[r];
        l.forme = [...l.forme, r].slice(-5);
      }
      // Les buteurs et les passeurs d'un forfait n'existent pas.
      if (etat.forfaitDe == null)
        for (const b of m.buteurs) {
          const c = joueurs.get(b.joueur) ?? { joueur: b.joueur, name: b.name, equipe: b.equipe, rang: 0, buts: 0, passes: 0 };
          c.buts += b.buts;
          c.passes += b.passes;
          c.equipe = b.equipe;
          c.name = b.name;
          joueurs.set(b.joueur, c);
        }
      return { m, etat, saison: s, compte: true };
    });

    const divisions: Division[] = groupes.map((g, i) => {
      const haut = i > 0 ? echangeEntre(groupes[i - 1].length, g.length) : 0;
      const bas = i < groupes.length - 1 ? echangeEntre(g.length, groupes[i + 1].length) : 0;
      return {
        n: i + 1,
        nom: nomDivision(i + 1, groupes.length),
        lignes: trier(
          g.map((id) => lignes.get(id)!),
          nomDe
        ),
        montent: haut,
        descendent: bas,
      };
    });
    const resultat: Championnat = {
      saison: s,
      divisions,
      matchs: [...comptes].reverse(),
      buteurs: classer(joueurs, "buts"),
      passeurs: classer(joueurs, "passes"),
      divisionDe,
      commencee: saisonCommencee(s, maintenant),
      finie: saisonFinie(s, maintenant),
    };
    memo.set(s, resultat);
    return resultat;
  }

  return calculer(Math.max(1, saison));
}

/** Les matchs joués avant la première saison : des amicaux de préparation. */
export function avantSaison(matchs: MatchTeam[], maintenant = new Date()): MatchCompteTeam[] {
  return matchs
    .filter((m) => saisonDuJour(m.jour) === 0)
    .map((m) => ({ m, etat: etatMatch(m, maintenant), saison: 0, compte: false, amical: "hors-saison" as const }))
    .sort((x, y) => coupDEnvoiTeam(y.m).getTime() - coupDEnvoiTeam(x.m).getTime());
}

/** Combien de matchs comptés contre cette équipe cette saison (« 1/2 ») : ce que l'app montre avant un défi. */
export function rencontresCette(c: Championnat, a: number, b: number): number {
  return c.matchs.filter((x) => x.compte && ((x.m.de === a && x.m.a === b) || (x.m.de === b && x.m.a === a))).length;
}

/** La zone d'une ligne : monte, descend, ou le podium de la division du dessus. */
export function zone(d: Division, l: LigneClassement): "monte" | "descend" | "podium" | null {
  const i = d.lignes.indexOf(l);
  if (d.montent > 0 && i < d.montent) return "monte";
  if (d.descendent > 0 && i >= d.lignes.length - d.descendent) return "descend";
  if (d.n === 1 && l.rang <= 3 && l.j > 0) return "podium";
  return null;
}
