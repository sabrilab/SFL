// Le PACK AFRIQUE 2027 : la seule liste (Ilyes, 01/11/2026 : « je peux très
// bien faire un pack Afrique 2027 […] design-moi quelque chose de
// magnifique »). Un pack qui ne s'achète qu'en XP, jamais gagné par les
// missions ni par le Passe ; dépenser ne fait jamais baisser le Niveau XP.
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

export const PACK_AFRIQUE = {
  article: "pack-afrique-2027",
  nom: "PACK AFRIQUE 2027",
  /** Le prix d'une ouverture, en XP. À VALIDER (Q1) : 1 200, ou 1 000 si le stock mesuré est faible. */
  prix: 1200,
  /** Ce qui se dépense. À VALIDER (Q1) : toute l'XP gagnée à vie (« a-vie »), ou celle gagnée depuis le lancement. */
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
