// Le PACK AFRIQUE 2027 : la seule liste (Ilyes, 01/11/2026 : « je peux très
// bien faire un pack Afrique 2027 […] design-moi quelque chose de
// magnifique »). Un pack payé en XP S (xp-s.ts : la seconde monnaie, plus
// rare ; Ilyes, 02/11/2026 : 40 XP S le tirage, et plus jamais en XP
// normales), jamais gagné par les missions ni par le Passe ; dépenser ne
// fait jamais baisser le Niveau XP. Les packs rares à venir se paient aussi
// en XP S.
//
// Le nom affiché est « PACK AFRIQUE 2027 ». Le nom du tournoi, son sigle, son
// trophée, sa mascotte et ses logos appartiennent à la CAF : aucun ne
// s'écrit ni ne se dessine, nulle part (MOTS_INTERDITS, pack-afrique-check).
//
// Les nations : les trois pays hôtes (Kenya, Ouganda, Tanzanie), puis une
// première vague de grandes nations du football africain. On ne dit jamais
// « qualifié » : les éliminatoires sont en cours (journées 3 et 4 les 11 et
// 15 novembre 2026). Le pack grandit : une nation s'ajoute ici, son skin
// dans components/sfl/afrique/<nation>.tsx, une ligne dans registre.ts. Une
// nation n'est tirée qu'une fois son skin validé (etat: "valide").
//
// Pur : ni React ni réseau. Lu par l'app et par la route du pack.

export type EtatNation = "a-dessiner" | "dessine" | "valide";

export interface NationPack {
  /** Le code ISO 3166-1 alpha-2, en minuscules : la finition est `afrique-${id}`. */
  id: string;
  nom: string;
  /** Pays hôte de la phase finale 2027. */
  hote?: true;
  /** « valide » : Sabri et Ilyes l'ont vu ; seul ce skin se tire. */
  etat: EtatNation;
}

export const NATIONS = [
  { id: "ke", nom: "Kenya", hote: true, etat: "dessine" },
  { id: "ug", nom: "Ouganda", hote: true, etat: "dessine" },
  { id: "tz", nom: "Tanzanie", hote: true, etat: "dessine" },
  { id: "ma", nom: "Maroc", etat: "dessine" },
  { id: "sn", nom: "Sénégal", etat: "dessine" },
  { id: "ci", nom: "Côte d'Ivoire", etat: "dessine" },
  { id: "ng", nom: "Nigeria", etat: "dessine" },
  { id: "eg", nom: "Égypte", etat: "dessine" },
  { id: "dz", nom: "Algérie", etat: "dessine" },
  { id: "cm", nom: "Cameroun", etat: "dessine" },
  { id: "ml", nom: "Mali", etat: "dessine" },
  { id: "za", nom: "Afrique du Sud", etat: "dessine" },
] as const satisfies readonly NationPack[];

export type CodeNation = (typeof NATIONS)[number]["id"];

/** Les monnaies de la boutique (achats_xp.monnaie) : les XP normales, les XP S. */
export type Monnaie = "xp" | "xp-s";

export const PACK_AFRIQUE = {
  article: "pack-afrique-2027",
  nom: "PACK AFRIQUE 2027",
  /** Ce qui le paie : les XP S (Ilyes, 02/11/2026). La base refuse toute ligne neuve du pack dans une autre monnaie. */
  monnaie: "xp-s" as Monnaie,
  /** Le prix d'un tirage, en XP S (Ilyes, 02/11/2026 : 40 ; 13 au plus par journée, personne en moins de 4 journées). */
  prix: 40,
  /** Ce qui se dépense : toutes les XP S gagnées à vie (toute l'histoire compte, Q1). */
  solde: "a-vie" as "a-vie" | "depuis-lancement",
  /** Le jour du lancement, si solde = « depuis-lancement » (AAAA-MM-JJ, heure de Paris). */
  lancement: null as string | null,
} as const;

const CODES = new Set<string>(NATIONS.map((n) => n.id));

export const finitionAfrique = (id: CodeNation) => `afrique-${id}` as const;

/** « afrique-sn » → « sn », si c'est une nation du pack. */
export function nationDeFinition(f: string): CodeNation | null {
  const m = /^afrique-([a-z]{2})$/.exec(f);
  return m && CODES.has(m[1]) ? (m[1] as CodeNation) : null;
}

/** Les nations que le serveur peut tirer : leur skin est validé. */
export function nationsEnJeu(): CodeNation[] {
  return NATIONS.filter((n) => (n.etat as EtatNation) === "valide").map((n) => n.id);
}

/** Ce qui reste à dépenser : jamais sous zéro ; un achat n'est jamais repris. */
export function soldeXp(gagnee: number, depensee: number): number {
  return Math.max(0, Math.round(gagnee) - Math.round(depensee));
}

/** Le numéro de série d'une carte de nation, au dos : « n° 0042 ». */
export const numeroSerieNation = (n: number) => `n° ${String(Math.max(1, Math.round(n))).padStart(4, "0")}`;

/** Les nations que l'écran montre : toutes celles dont le skin est dessiné (le gabarit ne se montre jamais). */
export function nationsMontrees(): CodeNation[] {
  return NATIONS.filter((n) => (n.etat as EtatNation) !== "a-dessiner").map((n) => n.id);
}

/** Le pack est-il ouvert ? Seulement quand une nation au moins est validée : on ne vend jamais un skin vide. */
export const packOuvert = () => nationsEnJeu().length > 0;

export type EtatOuverture =
  | { t: "ouvrir"; prix: number }
  | { t: "manque"; solde: number; prix: number }
  | { t: "complet"; sur: number }
  | { t: "ferme" };

/** Ce que dit le bouton du pack : ouvrir, les XP S qui manquent (le solde sur le prix), complet, ou fermé. */
export function etatOuverture(solde: number, obtenus: readonly string[], prix = PACK_AFRIQUE.prix): EtatOuverture {
  const enJeu = nationsEnJeu();
  if (!enJeu.length) return { t: "ferme" };
  if (enJeu.every((n) => obtenus.includes(n))) return { t: "complet", sur: nationsMontrees().length };
  if (solde < prix) return { t: "manque", solde, prix };
  return { t: "ouvrir", prix };
}

/** Ce qui ne s'écrit nulle part (noms, phrases, sources affichées) : marques de la CAF et clichés. */
export const MOTS_INTERDITS: readonly RegExp[] = [
  /\bCAN\b/,
  /coupe d['’]afrique/i,
  /\bAFCON\b/i,
  /\bCAF\b/,
  /pamoja/i,
  /total ?energies/i,
  /\b(lions?|aigles?|pharaons?|fennecs?|[ée]l[ée]phants?|panth[èe]res?|super eagles|bafana|harambee|cranes|taifa stars)\b/i,
];
