// Le rangement de la boutique, sans React : les rayons (ce qu'un lien de
// l'accueil ouvre), les filtres de la grille (catégorie, couleur, taille,
// prix), le tri, et leur écriture dans l'adresse. Tout part de produits.ts ;
// rien ici ne lit le navigateur, la base ni l'heure : le banc
// tools/boutique-check.ts le rejoue tel quel.
//
// La règle des filtres est celle de toute boutique : dans une section, cocher
// deux cases élargit (Noir OU Blanc) ; entre sections, on resserre (Maillots
// ET Blanc ET taille L). Une section sans case ne filtre pas.
//
// L'adresse : /boutique/articles?rayon=maillots&couleur=Blanc&taille=L&tri=prix-croissant.
// Une valeur inconnue est ignorée ; ce qui vaut le défaut (rayon « tout »,
// tri « nouveautés ») ne s'écrit pas, pour qu'un aller-retour rende la même
// adresse.

import { CATEGORIES, PRODUITS, type Categorie, type Coloris, type Produit } from "./produits";

/* -------------------------------- les rayons ------------------------------- */

export type Rayon = "maillots" | "vestiaire" | "survets" | "fondateurs" | "tout" | "favoris";

export const RAYONS: { id: Rayon; titre: string }[] = [
  { id: "maillots", titre: "Maillots" },
  { id: "vestiaire", titre: "Vestiaire" },
  { id: "survets", titre: "Survêts" },
  { id: "fondateurs", titre: "Fondateurs" },
  { id: "tout", titre: "Tout" },
  { id: "favoris", titre: "Favoris" },
];

export const titreDuRayon = (rayon: Rayon) => RAYONS.find((r) => r.id === rayon)!.titre;

/**
 * Les catégories qu'on peut cocher dans un rayon : celles de ses pièces.
 * « Tout » et « Favoris » les offrent toutes ; un rayon d'une seule catégorie
 * (Maillots, Survêts, Fondateurs) n'en offre aucune, la section disparaît :
 * cocher « T-shirts » chez les maillots ne pouvait rendre qu'une grille vide.
 */
export function categoriesDuRayon(rayon: Rayon, produits: readonly Produit[] = PRODUITS): Categorie[] {
  if (rayon === "tout" || rayon === "favoris") return CATEGORIES;
  const presentes = CATEGORIES.filter((c) => produits.some((p) => p.categorie === c && dansLeRayon(p, rayon, [])));
  return presentes.length > 1 ? presentes : [];
}

function dansLeRayon(p: Produit, rayon: Rayon, favoris: readonly string[]): boolean {
  switch (rayon) {
    case "maillots":
      return p.categorie === "Maillots";
    case "vestiaire":
      return p.ligne === "Vestiaire";
    case "survets":
      return p.categorie === "Survêts";
    case "fondateurs":
      return p.ligne === "Fondateurs";
    case "favoris":
      return favoris.includes(p.id);
    case "tout":
      return true;
  }
}

/* ------------------------------- les filtres ------------------------------- */

export type Couleur = Coloris["nom"];
export const COULEURS: Couleur[] = ["Noir", "Blanc"];

/** L'échelle complète : une pièce n'en a qu'une partie (le maillot Noirs / Blancs n'a ni S ni 3XL). */
export const TAILLES = ["S", "M", "L", "XL", "2XL", "3XL"] as const;
export type Taille = (typeof TAILLES)[number];

export type Tranche = "moins-de-40" | "40-a-60" | "plus-de-60";
export const TRANCHES: { id: Tranche; titre: string; dedans: (euros: number) => boolean }[] = [
  { id: "moins-de-40", titre: "Moins de 40 €", dedans: (e) => e < 40 },
  { id: "40-a-60", titre: "40 à 60 €", dedans: (e) => e >= 40 && e <= 60 },
  { id: "plus-de-60", titre: "Plus de 60 €", dedans: (e) => e > 60 },
];

export interface Filtres {
  categories: Categorie[];
  couleurs: Couleur[];
  tailles: Taille[];
  prix: Tranche[];
}

export const SANS_FILTRE: Filtres = { categories: [], couleurs: [], tailles: [], prix: [] };

export const nombreDeFiltres = (f: Filtres) =>
  f.categories.length + f.couleurs.length + f.tailles.length + f.prix.length;

/** Coche ou décoche une case (ajoutée en fin : l'adresse, relue par lireRecherche, remet l'ordre de la section). */
export function basculer<C extends keyof Filtres>(f: Filtres, section: C, valeur: Filtres[C][number]): Filtres {
  const liste = f[section] as string[];
  const suite = liste.includes(valeur) ? liste.filter((v) => v !== valeur) : [...liste, valeur];
  return { ...f, [section]: suite };
}

export function filtrer(
  produits: readonly Produit[],
  rayon: Rayon,
  f: Filtres,
  favoris: readonly string[] = [],
): Produit[] {
  return produits.filter(
    (p) =>
      dansLeRayon(p, rayon, favoris) &&
      (f.categories.length === 0 || f.categories.includes(p.categorie)) &&
      (f.couleurs.length === 0 || p.coloris.some((c) => f.couleurs.includes(c.nom))) &&
      (f.tailles.length === 0 || p.tailles.some((t) => (f.tailles as string[]).includes(t))) &&
      (f.prix.length === 0 || TRANCHES.some((t) => f.prix.includes(t.id) && t.dedans(p.euros))),
  );
}

/* ---------------------------------- le tri --------------------------------- */

export type Tri = "nouveautes" | "prix-croissant" | "prix-decroissant";
export const TRIS: { id: Tri; titre: string }[] = [
  { id: "nouveautes", titre: "Nouveautés" },
  { id: "prix-croissant", titre: "Prix croissant" },
  { id: "prix-decroissant", titre: "Prix décroissant" },
];

/** « Nouveautés » garde l'ordre du catalogue ; à prix égal, cet ordre reste (tri stable). */
export function trier(liste: readonly Produit[], tri: Tri): Produit[] {
  const copie = [...liste];
  if (tri === "prix-croissant") copie.sort((a, b) => a.euros - b.euros);
  if (tri === "prix-decroissant") copie.sort((a, b) => b.euros - a.euros);
  return copie;
}

/* -------------------------------- l'adresse -------------------------------- */

export interface Recherche {
  rayon: Rayon;
  filtres: Filtres;
  tri: Tri;
}

export const RECHERCHE_VIDE: Recherche = { rayon: "tout", filtres: SANS_FILTRE, tri: "nouveautes" };

/** Les valeurs connues d'un paramètre, sans doublon, dans l'ordre de la section. */
function connues<T extends string>(params: URLSearchParams, cle: string, permises: readonly T[]): T[] {
  const lues = params.getAll(cle).flatMap((v) => v.split(","));
  return permises.filter((v) => lues.includes(v));
}

export function lireRecherche(params: URLSearchParams): Recherche {
  const rayon = RAYONS.find((r) => r.id === params.get("rayon"))?.id ?? "tout";
  const tri = TRIS.find((t) => t.id === params.get("tri"))?.id ?? "nouveautes";
  return {
    rayon,
    tri,
    filtres: {
      categories: connues(params, "categorie", CATEGORIES),
      couleurs: connues(params, "couleur", COULEURS),
      tailles: connues(params, "taille", TAILLES),
      prix: connues(
        params,
        "prix",
        TRANCHES.map((t) => t.id),
      ),
    },
  };
}

/** La chaîne de recherche, sans le « ? » ; vide quand tout vaut le défaut. */
export function ecrireRecherche({ rayon, filtres, tri }: Recherche): string {
  const params = new URLSearchParams();
  if (rayon !== "tout") params.set("rayon", rayon);
  if (filtres.categories.length) params.set("categorie", filtres.categories.join(","));
  if (filtres.couleurs.length) params.set("couleur", filtres.couleurs.join(","));
  if (filtres.tailles.length) params.set("taille", filtres.tailles.join(","));
  if (filtres.prix.length) params.set("prix", filtres.prix.join(","));
  if (tri !== "nouveautes") params.set("tri", tri);
  return params.toString();
}

/** L'adresse de la grille pour une recherche (partielle : le reste vaut le défaut). */
export function adresseGrille(r: Partial<Omit<Recherche, "filtres">> & { filtres?: Partial<Filtres> } = {}): string {
  const q = ecrireRecherche({
    rayon: r.rayon ?? "tout",
    tri: r.tri ?? "nouveautes",
    filtres: { ...SANS_FILTRE, ...r.filtres },
  });
  return q ? `/boutique/articles?${q}` : "/boutique/articles";
}

export const adresseFiche = (id: string) => `/boutique/articles/${id}`;

/**
 * Où mène un lien de l'accueil vers un rayon : sa grille, ou droit la fiche
 * quand le rayon n'a qu'une pièce (Survêts, Fondateurs) : une grille d'une
 * tuile avec « Filtrer » et « Trier » ne sert à rien.
 */
export function adresseRayon(rayon: Rayon, produits: readonly Produit[] = PRODUITS): string {
  const pieces = filtrer(produits, rayon, SANS_FILTRE);
  return pieces.length === 1 ? adresseFiche(pieces[0].id) : adresseGrille({ rayon });
}

/**
 * L'adresse après un geste sur la grille, calculée depuis l'adresse du moment
 * (pas depuis le dernier rendu) : deux cases touchées coup sur coup gardent
 * toutes les deux leur effet.
 */
export function rechercheApres(recherche: string, geste: (r: Recherche) => Recherche): string {
  return ecrireRecherche(geste(lireRecherche(new URLSearchParams(recherche))));
}

/* -------------------------------- les libellés ----------------------------- */

export const nombreArticles = (n: number) => (n === 1 ? "1 article" : `${n} articles`);
export const nombreCouleurs = (n: number) => (n === 1 ? "1 couleur" : `${n} couleurs`);

/** Le bouton du bas de la feuille de filtres. */
export const voirLesArticles = (n: number) =>
  n === 0 ? "Aucun article" : n === 1 ? "Voir l'article" : `Voir les ${n} articles`;

export const prix = (euros: number) => `${euros} €`;

/* --------------------------------- les vues -------------------------------- */

/** Le coloris que la grille montre : le premier, sauf si un seul coloris est filtré et que la pièce l'a. */
export function colorisMontre(p: Produit, f: Filtres): number {
  if (f.couleurs.length !== 1) return 0;
  const i = p.coloris.findIndex((c) => c.nom === f.couleurs[0]);
  return i < 0 ? 0 : i;
}

export interface Vue {
  src: string;
  /** Une vue à plat se pose sur la tuile grise ; une photo portée remplit le cadre. */
  aPlat: boolean;
}

/** La couleur que montre une photo portée : dite par son nom de fichier, sinon le premier coloris de la pièce. */
export function couleurPortee(p: Produit, src: string): Couleur {
  if (/-noir\b/.test(src)) return "Noir";
  if (/-blanc\b/.test(src)) return "Blanc";
  return p.coloris[0].nom;
}

/**
 * Les images de la fiche, pour le coloris choisi : ses photos portées, ses
 * vues à plat, puis les photos portées de l'autre coloris (elles montrent la
 * coupe, jamais en premier).
 */
export function vuesFiche(p: Produit, iColoris: number): Vue[] {
  const coloris = p.coloris[iColoris] ?? p.coloris[0];
  const portee = (src: string) => ({ src, aPlat: false });
  const siennes = p.porte.filter((src) => couleurPortee(p, src) === coloris.nom);
  const autres = p.porte.filter((src) => couleurPortee(p, src) !== coloris.nom);
  return [...siennes.map(portee), ...coloris.aPlat.map((src) => ({ src, aPlat: true })), ...autres.map(portee)];
}

/** « Tu aimeras aussi » : quatre pièces, la même ligne d'abord, jamais la pièce elle-même. */
export function aussi(p: Produit, produits: readonly Produit[] = PRODUITS): Produit[] {
  const autres = produits.filter((a) => a.id !== p.id);
  return [...autres.filter((a) => a.ligne === p.ligne), ...autres.filter((a) => a.ligne !== p.ligne)].slice(0, 4);
}
