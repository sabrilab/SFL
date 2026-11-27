// Bola Plus : la précommande (Sabri, 12/11/2026). Un bouton « Je suis
// intéressé », sans paiement : on compte ceux que l'abonnement intéresse
// avant de l'annoncer (le paiement viendra vers la J6).
//
// L'offre affichée (retour de Sabri, 13/11/2026 01:44) : 19,90 € par mois,
// sans engagement, ou 168,90 € par an, payable en 4 fois sans frais. Les prix
// sont écrits ici seulement, en centimes entiers (des euros flottants
// arrondis par toFixed tombent parfois sous le prix : 0,07 € en 3 fois
// donnerait 3 × 0,02 €). Tout le reste se calcule ici : la
// remise de l'annuel (1 − 16 890 / (12 × 1 990) = 29,27 %, « −29 % » arrondi
// vers le bas pour ne jamais promettre plus ; calculée, plus affichée depuis
// le 14/11 : le barré de la grille SFL suffit) et l'échéance des
// 4 fois (16 890 / 4 = 4 222,5 centimes, arrondie au centime supérieur :
// « 4 × 42,23 € sans frais » ; quatre échéances affichées font 168,92 €,
// deux centimes au-dessus du prix, jamais en dessous). Aucun prestataire
// n'est nommé ni appelé : le paiement n'existe pas encore.
//
// Un intérêt par joueur, annulable ; la formule est facultative (l'admin
// compte alors « sans formule »). En base : la table bola_plus_interets et sa
// fonction bola_plus_interesse (supabase/schema.sql) ; le magasin est dans
// bola-plus-store.ts.
//
// L'offre est un bundle (retours de Sabri du 14/11, 20:41 → 20:47) : Bola
// Plus (l'app : équipe, trash talk, skins, quêtes ; 9,90 € seul) est OFFERT
// avec la SFL (la ligue indépendante : maillots, stats, cérémonies). La grille
// officielle de la SFL (35 € par mois, 119,90 € la saison au lieu de 140 €,
// 249,90 € l'année au lieu de 280 €) est montrée barrée ; les joueurs de ce
// premier batch ont le prix « premiers joueurs », 19,90 € par mois ou
// 168,90 € par an, Bola Plus compris. Toute la grille est écrite ici, en
// centimes : les barrés (BARRE), les remises contre la grille (REMISE_GRILLE,
// pour le banc et l'admin, jamais affichées : le barré suffit, son mot de
// 20:47) et les 4 fois se calculent. Pas de formule saison pour les premiers
// joueurs : aucun prix n'en a été donné.
//
// Ce que la page montre (le carrousel, bola-plus.tsx) : l'ouverture, les
// avantages (AVANTAGES, une liste de données : un avantage de plus s'ajoute
// ici sans toucher au carrousel), puis « Ton prix ». Depuis le 27/11, six
// cartes : l'ouverture, la SFL (ses lignes : LIGNES_SFL, dont « Ramène 5
// abonnés », seulement expliqué dans sa fiche), Bola Plus, le studio et les
// matchs filmés, Bola 27, le prix. Chaque avantage appartient à une part : « plus » (violet,
// Bola Plus) ou « sfl » (vert terrain, la ligue) ; la palette (PALETTE) est
// écrite ici et posée en variables CSS par la page, la couleur ne sort pas de
// cette page. Les visuels générés le disent dans leur texte de remplacement. Les
// variables de la part Bola Plus (VARIABLES_PLUS) sont écrites ici une fois,
// pour la page et pour Bola Studio ; la carte « Toi » (CARTE_TOI) aussi, pour
// la page (les vignettes de Bola Studio sont des images depuis le 15/11).
//
// Pur : ni React ni réseau (tools/bola-plus-check.ts).

import type { Stats } from "./engine";
import { isAdmin } from "./admin";

/**
 * Qui voit Bola Plus en ligne (la tuile de Ma carte et /profil/bola-plus).
 * Sabri, 16/11/2026 : « mettre le paywall sur les comptes de Ilyes et Sabri les
 * admins pour qu'on voie ce que ça donne » : les deux admins seulement
 * (admin.ts), aucun autre joueur. Pour l'ouvrir à tous le jour de l'annonce,
 * c'est ici, et nulle part ailleurs.
 */
export function voitBolaPlus(nom: string | null | undefined): boolean {
  return isAdmin(nom);
}

/** Le prix du mois, en centimes : 19,90 €. */
export const MENSUEL_CENTIMES = 1990;
/** Le prix de l'année, en centimes : 168,90 €. */
export const ANNUEL_CENTIMES = 16890;
/** L'annuel se paie en autant de fois, sans frais. */
export const ECHEANCES = 4;

/** Un montant en centimes, écrit à la française sans le symbole : 1990 → « 19,90 ». Entiers seulement. */
export function montant(centimes: number): string {
  if (!Number.isInteger(centimes) || centimes < 0) throw new Error(`montant : ${centimes} n'est pas un nombre de centimes`);
  const euros = String(Math.floor(centimes / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
  return `${euros},${String(centimes % 100).padStart(2, "0")}`;
}

/** Une échéance sur n, arrondie au centime supérieur (n × l'échéance ne passe jamais sous le prix). */
export const echeance = (centimes: number, n: number) => Math.ceil(centimes / n);

/** « 19,90 », affiché suivi de « € ». */
export const MENSUEL = montant(MENSUEL_CENTIMES);
/** « 168,90 », affiché suivi de « € ». */
export const ANNUEL = montant(ANNUEL_CENTIMES);

export type Formule = "mensuel" | "annuel";
export const FORMULES: readonly Formule[] = ["mensuel", "annuel"];

export const NOM_FORMULE: Record<Formule, string> = { mensuel: "Mensuel", annuel: "Annuel" };

/** Ce que l'année fait gagner sur douze mois payés un par un : 0,2927… */
export const REMISE = 1 - ANNUEL_CENTIMES / (12 * MENSUEL_CENTIMES);
/** La remise en pour cent entiers, arrondie vers le bas, calculée en entiers : 29. */
export const REMISE_POUR_CENT = Math.floor(((12 * MENSUEL_CENTIMES - ANNUEL_CENTIMES) * 100) / (12 * MENSUEL_CENTIMES));
/** « −29 % ». */
export const LIBELLE_REMISE = `−${REMISE_POUR_CENT}\u00a0%`;
/** « 4 × 42,23 € sans frais » : sous la formule annuelle. */
export const LIBELLE_ECHEANCES = `${ECHEANCES}\u00a0×\u00a0${montant(echeance(ANNUEL_CENTIMES, ECHEANCES))}\u00a0€ sans frais`;

/**
 * L'annuel affiché au mois sur le bouton Mensuel / Annuel : 13,90 €. Choix
 * de Sabri (23/11/2026, sur la question posée) : afficher 13,90 € par mois et
 * facturer 168,90 € par an, alors que 168,90 / 12 = 14,08 €. Ce n'est donc
 * pas un calcul : c'est un prix d'affichage, écrit ici seulement, et la
 * carte écrit toujours dessous ce qui est facturé (« Facturé 168,90 € par
 * an »). Pour revenir au calcul exact : montant(echeance(ANNUEL_CENTIMES, 12)).
 */
export const ANNUEL_AFFICHE_PAR_MOIS_CENTIMES = 1390;
export const ANNUEL_PAR_MOIS = montant(ANNUEL_AFFICHE_PAR_MOIS_CENTIMES);
/** Ce que l'année fait économiser sur douze mois au mensuel, en centimes : 12 × 1 990 − 16 890 = 6 990 (sur le prix facturé). */
export const ECONOMIE_ANNUEL_CENTIMES = 12 * MENSUEL_CENTIMES - ANNUEL_CENTIMES;

/** L'intérêt d'un joueur : la formule qu'il a choisie (ou aucune), et quand. */
export interface Interet {
  formule: Formule | null;
  /** L'heure du premier toucher (ISO) : elle ne change pas avec la formule. */
  le: string;
}

/** Une ligne de l'admin : qui, quelle formule, quand. */
export interface LigneInteret extends Interet {
  nom: string;
}

export const estFormule = (v: unknown): v is Formule => v === "mensuel" || v === "annuel";

/** Ce que la base (ou le téléphone) a rendu, remis au propre ; null si ce n'est pas un intérêt. */
export function interetDe(brut: unknown): Interet | null {
  if (!brut || typeof brut !== "object") return null;
  const { formule, le } = brut as { formule?: unknown; le?: unknown };
  if (typeof le !== "string" || Number.isNaN(Date.parse(le))) return null;
  return { formule: estFormule(formule) ? formule : null, le };
}

/**
 * Les essais gardés sur le téléphone (un aperçu n'écrit jamais en base),
 * rangés par joueur. Un contenu abîmé se lit comme vide, sans erreur.
 */
export function lireEssais(brut: string | null): Record<string, Interet> {
  if (!brut) return {};
  let lu: unknown;
  try {
    lu = JSON.parse(brut);
  } catch {
    return {};
  }
  if (!lu || typeof lu !== "object" || Array.isArray(lu)) return {};
  const essais: Record<string, Interet> = {};
  for (const [nom, v] of Object.entries(lu)) {
    const interet = interetDe(v);
    if (interet) essais[nom] = interet;
  }
  return essais;
}

export interface CompteInterets {
  total: number;
  mensuel: number;
  annuel: number;
  sansFormule: number;
  /** Du plus récent au plus ancien. */
  lignes: LigneInteret[];
}

/** Le compteur de l'admin : combien, par formule, et la liste du plus récent au plus ancien. */
export function compter(lignes: readonly LigneInteret[]): CompteInterets {
  const tri = [...lignes].sort((a, b) => Date.parse(b.le) - Date.parse(a.le) || a.nom.localeCompare(b.nom, "fr"));
  const mensuel = tri.filter((l) => l.formule === "mensuel").length;
  const annuel = tri.filter((l) => l.formule === "annuel").length;
  return { total: tri.length, mensuel, annuel, sansFormule: tri.length - mensuel - annuel, lignes: tri };
}

/**
 * Dans un aperçu, l'essai du téléphone s'ajoute à ce que la base rend, à la
 * place de la ligne du même joueur s'il y en a une.
 */
export function avecEssai(lignes: readonly LigneInteret[], essai: LigneInteret | null): LigneInteret[] {
  if (!essai) return [...lignes];
  return [...lignes.filter((l) => l.nom !== essai.nom), essai];
}

/* ----------------------- La grille de la SFL ----------------------- */

/** Bola Plus seul, l'app (son message de 20:41) : 9,90 € par mois. */
export const BOLA_PLUS_SEUL_CENTIMES = 990;

/** La grille officielle de la SFL (20:45), par joueur : au mois sans engagement, à la saison de 4 mois, à l'année. */
export const SFL_OFFICIEL = {
  mois: 3500,
  saison: { prix: 11990, reference: 14000 },
  annee: { prix: 24990, reference: 28000 },
} as const;

/** La référence de chaque formule « premiers joueurs » : le mois et l'année de la grille officielle (jamais barrée à l'écran depuis le 23/11). */
export const BARRE: Record<Formule, number> = { mensuel: SFL_OFFICIEL.mois, annuel: SFL_OFFICIEL.annee.prix };

/** Un montant sans ses centimes s'ils sont nuls : 3500 → « 35 », 24990 → « 249,90 ». */
export const prix = (centimes: number) => (centimes % 100 === 0 ? montant(centimes).slice(0, -3) : montant(centimes));

/** Ce que le prix « premiers joueurs » fait gagner sur la grille, en pour cent entiers arrondis vers le bas (jamais affiché) : 43 et 32. */
export const REMISE_GRILLE: Record<Formule, number> = {
  mensuel: Math.floor(((BARRE.mensuel - MENSUEL_CENTIMES) * 100) / BARRE.mensuel),
  annuel: Math.floor(((BARRE.annuel - ANNUEL_CENTIMES) * 100) / BARRE.annuel),
};

/** La grille officielle, le prix et sa période (plus affichée depuis le 23/11 : rien de barré). */
export const GRILLE_SFL: readonly { prix: string; par: string }[] = [
  { prix: prix(SFL_OFFICIEL.mois), par: "mois" },
  { prix: prix(SFL_OFFICIEL.saison.prix), par: "saison" },
  { prix: prix(SFL_OFFICIEL.annee.prix), par: "an" },
];

/**
 * Ce que le prix « premiers joueurs » fait économiser sur la grille de la SFL,
 * en centimes (Sabri, 23/11 : rien de barré, « je gagne des choses ») : le
 * mois contre le mois de la grille (35 − 19,90 = 15,10), l'année contre
 * l'année de la grille (249,90 − 168,90 = 81).
 */
export const ECONOMIE_GRILLE: Record<Formule, number> = {
  mensuel: BARRE.mensuel - MENSUEL_CENTIMES,
  annuel: BARRE.annuel - ANNUEL_CENTIMES,
};

/**
 * Chaque formule : son prix et sa période (l'ouverture), son prix au mois
 * (le bouton Mensuel / Annuel de « Ton prix », 23/11), ce qu'elle fait
 * économiser sur la grille, ce qui est facturé, et la ligne dessous. Aucun
 * prix barré (23/11) : l'économie se dit en positif.
 */
export const PRIX_FORMULE: Record<Formule, { euros: string; par: string; mois: string; economie: string; facture: string; sous: string }> = {
  mensuel: {
    euros: MENSUEL,
    par: "mois",
    mois: MENSUEL,
    economie: `${prix(ECONOMIE_GRILLE.mensuel)}\u00a0€ économisés chaque mois`,
    facture: `Facturé ${MENSUEL}\u00a0€ chaque mois`,
    sous: "Sans engagement",
  },
  annuel: {
    euros: ANNUEL,
    par: "an",
    mois: ANNUEL_PAR_MOIS,
    economie: `${prix(ECONOMIE_GRILLE.annuel)}\u00a0€ économisés sur l'année`,
    facture: `Facturé ${ANNUEL}\u00a0€ par an`,
    sous: LIBELLE_ECHEANCES,
  },
};

/** Le prix de Bola Plus seul : « 9,90 » (plus affiché depuis le 23/11 : la carte dit « Offert »). */
export const BOLA_PLUS_SEUL = prix(BOLA_PLUS_SEUL_CENTIMES);

/** Ce que contient le bundle, dans l'ordre : Bola Plus, les maillots, la prise de stats, la gamification (ta carte), la SFL. */
export const BUNDLE = ["bola-plus", "maillots", "stats", "carte", "sfl"] as const;
export type PieceBundle = (typeof BUNDLE)[number];
/** Leurs mots. « Tes stats » est la prise de stats ; « Ta carte », la gamification (le mot n'existe pas dans l'app). */
export const NOM_BUNDLE: Record<PieceBundle, string> = { "bola-plus": "Bola Plus", maillots: "Tes maillots", stats: "Tes stats", carte: "Ta carte", sfl: "SFL" };

/** Ce que Bola Plus ajoute à l'app (20:45), sur sa carte. Bola gratuit (OFFRES.gratuit) n'est pas montré. */
export const FONCTIONS_BOLA_PLUS = [
  { id: "equipe", nom: "Ton équipe" },
  { id: "trash-talk", nom: "Trash talk" },
  { id: "skins", nom: "Skins et aspects" },
  { id: "quetes", nom: "Quêtes et missions" },
] as const;

/** Les trois offres, pour mémoire (la page ne montre que Bola Plus et la SFL). */
export const OFFRES = {
  gratuit: { prixCentimes: 0, contenu: ["Créer un match par jour", "Rejoindre des matchs"] },
  plus: { prixCentimes: BOLA_PLUS_SEUL_CENTIMES },
  sfl: { grille: SFL_OFFICIEL, plusOffert: true },
} as const;

/* ----------------------- Ce que la page montre ----------------------- */

/**
 * La palette de cette page seulement (Sabri, 14/11 20:34 : « de belles
 * couleurs ») : le violet de Bola Plus, le vert terrain de la SFL, le lime du
 * prix. Loin de l'or (MVP), du rouge (Impact) et du cobalt (Défensive) des
 * cartes (finitions-carte.ts) : le banc mesure les teintes. La page les pose
 * en variables CSS ; la feuille n'en écrit aucune.
 */
export const PALETTE = {
  plus: { fond: "#24104F", vif: "#7C3AED", clair: "#C4B5FD", encre: "#5B21B6", fondClair: "#F1EBFF", haut: "#3B1A80" },
  sfl: { fond: "#062E22", vif: "#10B981", clair: "#6EE7B7", encre: "#047857" },
  prix: "#D9FF3F",
  nuit: "#0A0A12",
} as const;

/**
 * Les couleurs de la part Bola Plus en variables CSS : posées par la page
 * (avec la SFL, le prix et la nuit) et par le panneau Bola Studio, porté hors
 * de la page (studio-bola.tsx). Une seule table pour les deux.
 */
export const VARIABLES_PLUS = {
  "--bp-plus-fond": PALETTE.plus.fond,
  "--bp-plus-haut": PALETTE.plus.haut,
  "--bp-plus-vif": PALETTE.plus.vif,
  "--bp-plus-clair": PALETTE.plus.clair,
  "--bp-plus-encre": PALETTE.plus.encre,
  "--bp-plus-papier": PALETTE.plus.fondClair,
} as const;

/**
 * La carte « Toi » de la page : une carte anonyme qui a déjà joué (sans nom
 * ni photo), celle de « Ta carte continue. ». La note se calcule (ovr,
 * engine.ts), elle ne s'écrit pas.
 */
export const CARTE_TOI = {
  name: "Toi",
  position: "ATT",
  stats: { VIT: 76, TIR: 76, PAS: 77, DRI: 79, DEF: 75, PHY: 77 },
} as const satisfies { name: string; position: string; stats: Stats };

/** Les teintes réservées aux cartes de joueur (finitions-carte.ts) : la page s'en tient loin. */
export const TEINTES_RESERVEES = { mvp: "#C99733", impact: "#E0262E", defensive: "#2A6AE6" } as const;

/** Les largeurs de chaque visuel (public/bola-plus/<image>-<largeur>.webp). */
export const LARGEURS = [480, 780, 1170] as const;
/** Hauteur sur largeur des visuels d'avant le carrousel (l'affiche, les maillots) : 5/4. */
export const RAPPORT_VISUEL = 5 / 4;
/** Hauteur sur largeur des visuels du carrousel (14/11) : 3/2. */
export const RAPPORT_CARROUSEL = 3 / 2;

/** Un visuel : son fichier, ce qu'il montre (lecteur d'écran), sa teinte moyenne (le fond avant l'image), son rapport. */
export interface Visuel {
  image: string;
  alt: string;
  teinte: string;
  rapport: number;
  /** Un visuel en noir et blanc : la feuille le teint dans la couleur de sa part. */
  teindre?: boolean;
  /** Un voile bas plus court : le bas de l'image (le podium des cérémonies) reste lisible sous le titre. */
  voileCourt?: boolean;
}

/** La part d'un avantage : Bola Plus (l'app) ou la SFL (la ligue). */
export type Part = "plus" | "sfl";
export const NOM_PART: Record<Part, string> = { plus: "Bola Plus", sfl: "SFL" };

/**
 * Les visuels dessinés par le code (bola-plus.tsx, COMPOSANTS) : la vraie
 * carte « Toi », la liste de la SFL (27/11), la liste de Bola Plus, et
 * « studio » : l'éventail de Bola Studio (components/sfl/studio-bola.tsx, ses
 * templates et ses ballons dans lib/sfl/studio.ts) et, dessous, les matchs
 * filmés (27/11). Le carrousel, ses segments et sa palette suivent seuls.
 */
export type ComposantAvantage = "carte" | "sfl" | "bola-plus" | "studio" | "bola-27";

/** Le visuel d'un avantage : une image de public/bola-plus/, ou un composant de l'app. */
export type VisuelAvantage = ({ genre: "image" } & Visuel) | { genre: "composant"; composant: ComposantAvantage };

/** Un avantage : sa part, son titre (et une ligne dessous au plus), son visuel. */
export interface Avantage {
  id: string;
  part: Part;
  titre: string;
  sous?: string;
  visuel: VisuelAvantage;
}

/** L'ouverture : le stade de Bola, teint par la feuille de style. */
export const AFFICHE: Visuel = { image: "affiche", alt: "", teinte: "#2a2440", rapport: RAPPORT_VISUEL };

// Le carrousel en six cartes (Sabri, 27/11 : « ça va tenir en 4 pages […] normalement, on a 5 ou 6
// cartes ») : l'ouverture, puis la SFL (une carte noire et chromée qui liste ce que la ligue donne, comme
// « Bola Plus » liste ses fonctions), Bola Plus, le studio et les matchs filmés sur une même carte, Bola 27
// tel quel, et « Ton prix ». Les anciennes cartes de la SFL (maillots, ta carte, matchs filmés, cadeaux,
// cérémonies, « Ramène 5 ») deviennent les lignes de la carte SFL (LIGNES_SFL) ; leurs fiches restent.
export const AVANTAGES: readonly Avantage[] = [
  { id: "sfl", part: "sfl", titre: "La SFL", visuel: { genre: "composant", composant: "sfl" } },
  { id: "bola-plus", part: "plus", titre: "Bola Plus", visuel: { genre: "composant", composant: "bola-plus" } },
  // « Ton studio, tes matchs filmés, tu le mets dans une même carte qui vient en quatrième » (27/11).
  { id: "studio", part: "plus", titre: "Ton studio", visuel: { genre: "composant", composant: "studio" } },
  {
    // Le jeu (Sabri, 17/11 11:36) : l'accès anticipé. Depuis le 23/11, discret : son logo seul (BOLA et un 27),
    // les images dans sa fiche, au toucher.
    id: "bola-27",
    part: "plus",
    titre: "Bola 27",
    sous: "Accès anticipé au jeu.",
    visuel: { genre: "composant", composant: "bola-27" },
  },
];

/** Les lignes de la carte SFL (27/11), dans l'ordre de Sabri ; chacune ouvre sa fiche quand elle en a une. */
export const LIGNES_SFL = [
  { id: "maillots", nom: "Tes maillots" },
  { id: "carte", nom: "Ta carte" },
  { id: "matchs-filmes", nom: "Tes matchs filmés" },
  { id: "cadeaux", nom: "Des cadeaux" },
  { id: "ceremonies", nom: "Les cérémonies officielles" },
  { id: "parrainage", nom: "Ramène 5 abonnés" },
] as const;
export type LigneSfl = (typeof LIGNES_SFL)[number]["id"];

/**
 * Les photos de la SFL (14/11) : « Tes matchs filmés » sur la carte du studio ; les autres attendent les
 * fiches à refaire (Sabri, 27/11 : « il faudra retravailler ça par la suite »).
 */
export const VISUELS_SFL = {
  maillots: { image: "maillots", alt: "Les deux maillots de la SFL, le noir et le blanc", teinte: "#1d2a25", rapport: RAPPORT_VISUEL, teindre: true },
  "matchs-filmes": { image: "matchs-filmes", alt: "Image générée : une caméra filme deux joueurs au duel, la nuit, dans le stade de piliers", teinte: "#1f3a2c", rapport: RAPPORT_CARROUSEL },
  cadeaux: { image: "cadeaux", alt: "Image générée : des crampons verts, des gants et une veste noirs près d'un écrin, sur du marbre", teinte: "#1b2a2a", rapport: RAPPORT_CARROUSEL },
  ceremonies: { image: "ceremonies", alt: "Image générée : un joueur lève le trophée noir sur le podium de marbre, ses coéquipiers applaudissent", teinte: "#22243a", rapport: RAPPORT_CARROUSEL, voileCourt: true },
} as const satisfies Record<string, Visuel>;

/** Les diapositives du carrousel, dans l'ordre : l'ouverture, les avantages, le prix. */
export type Diapo = { id: "ouverture"; nom: string } | ({ id: string; nom: string } & { avantage: Avantage }) | { id: "prix"; nom: string };
export const diapos = (avantages: readonly Avantage[] = AVANTAGES): Diapo[] => [
  { id: "ouverture", nom: "Bola Plus et la SFL" },
  ...avantages.map((a) => ({ id: a.id, nom: a.titre.replace(/\.$/, ""), avantage: a })),
  { id: "prix", nom: "Ton prix" },
];

/** La part d'une fiche : celle de sa carte, ou la SFL pour une ligne de la carte SFL. */
export const partDeFiche = (id: string): Part => (AVANTAGES.find((a) => a.id === id)?.part ?? (LIGNES_SFL.some((l) => l.id === id) ? "sfl" : "plus"));

/** L'adresse d'un visuel à une largeur donnée. */
export const fichierVisuel = (image: string, largeur: number) => `/bola-plus/${image}-${largeur}.webp`;

/** Le srcset d'un visuel : ses trois largeurs. */
export const sourcesVisuel = (image: string) => LARGEURS.map((l) => `${fichierVisuel(image, l)} ${l}w`).join(", ");
