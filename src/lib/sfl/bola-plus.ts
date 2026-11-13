// Bola Plus : la précommande (Sabri, 12/11/2026). Un bouton « Je suis
// intéressé », sans paiement : on compte ceux que l'abonnement intéresse
// avant de l'annoncer (le paiement viendra vers la J6).
//
// L'offre affichée : 20 € par mois, sans engagement, ou 168 € par an. La
// remise de l'annuel se calcule ici (168 = 12 × 20 × 0,7 : −30 %), elle n'est
// écrite nulle part ailleurs.
//
// Un intérêt par joueur, annulable ; la formule est facultative (l'admin
// compte alors « sans formule »). En base : la table bola_plus_interets et sa
// fonction bola_plus_interesse (supabase/schema.sql) ; le magasin est dans
// bola-plus-store.ts.
//
// Ce que la page montre de l'abonnement (retour de Sabri, 12/11/2026 23:08 :
// « une meilleure mise en avant des avantages », un grand visuel par
// avantage) : AFFICHE et AVANTAGES, plus bas. Quatre avantages, ceux que
// Sabri a dits, dans ses mots : « ils auront des maillots », « on va filmer
// les matchs », « ils auront des cadeaux », « cérémonies officielles ». Un
// titre et rien d'autre : ni chiffre, ni date, ni phrase dessous. En ajouter
// un demande son accord.
//
// Pur : ni React ni réseau (tools/bola-plus-check.ts).

/** Le prix du mois, en euros. */
export const MENSUEL = 20;
/** Le prix de l'année, en euros. */
export const ANNUEL = 168;

export type Formule = "mensuel" | "annuel";
export const FORMULES: readonly Formule[] = ["mensuel", "annuel"];

export const NOM_FORMULE: Record<Formule, string> = { mensuel: "Mensuel", annuel: "Annuel" };

/** Ce que l'année fait gagner sur douze mois payés un par un : 0,3. */
export const REMISE = 1 - ANNUEL / (12 * MENSUEL);
/** « −30 % ». */
export const LIBELLE_REMISE = `−${Math.round(REMISE * 100)} %`;

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

/* ----------------------- Ce que la page montre ----------------------- */

/** Les largeurs de chaque visuel (public/bola-plus/<image>-<largeur>.webp), en 4:5. */
export const LARGEURS = [480, 780, 1170] as const;
/** Hauteur sur largeur des visuels : 5/4. */
export const RAPPORT_VISUEL = 5 / 4;

/** Un visuel : son fichier, ce qu'il montre (lecteur d'écran), sa teinte moyenne (le fond avant l'image). */
export interface Visuel {
  image: string;
  alt: string;
  teinte: string;
}

/** Un avantage de Bola Plus : son numéro, son titre, son visuel. Rien d'autre. */
export interface Avantage extends Visuel {
  id: string;
  numero: string;
  titre: string;
}

/** L'affiche d'ouverture : le stade de Bola, la nuit. */
export const AFFICHE: Visuel = { image: "affiche", alt: "", teinte: "#5b5b5b" };

export const AVANTAGES: readonly Avantage[] = [
  { id: "maillots", numero: "01", titre: "Tes maillots", image: "maillots", alt: "Les deux maillots de la SFL, le noir et le blanc", teinte: "#525252" },
  { id: "matchs-filmes", numero: "02", titre: "Tes matchs filmés", image: "matchs-filmes", alt: "Une caméra au bord du terrain", teinte: "#4d4d4d" },
  { id: "cadeaux", numero: "03", titre: "Des cadeaux", image: "cadeaux", alt: "Un écrin noir fermé, posé sur du marbre", teinte: "#3e3e3e" },
  { id: "ceremonies", numero: "04", titre: "Les cérémonies officielles", image: "ceremonies", alt: "Un podium de marbre au centre du terrain", teinte: "#343434" },
];

/** L'adresse d'un visuel à une largeur donnée. */
export const fichierVisuel = (image: string, largeur: number) => `/bola-plus/${image}-${largeur}.webp`;

/** Le srcset d'un visuel : ses trois largeurs. */
export const sourcesVisuel = (image: string) => LARGEURS.map((l) => `${fichierVisuel(image, l)} ${l}w`).join(", ");
