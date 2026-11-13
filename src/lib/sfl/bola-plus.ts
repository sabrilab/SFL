// Bola Plus : la précommande (Sabri, 12/11/2026). Un bouton « Je suis
// intéressé », sans paiement : on compte ceux que l'abonnement intéresse
// avant de l'annoncer (le paiement viendra vers la J6).
//
// L'offre affichée (retour de Sabri, 13/11/2026 01:44) : 19,90 € par mois,
// sans engagement, ou 168,90 € par an, payable en 4 fois sans frais. Les prix
// sont écrits ici seulement, en centimes entiers (des euros flottants
// arrondis par toFixed tombent parfois sous le prix : 0,07 € en 3 fois
// donnerait 3 × 0,02 €). Tout le reste se calcule ici : la
// remise de l'annuel (1 − 16 890 / (12 × 1 990) = 29,27 %, affichée « −29 % »,
// arrondie vers le bas pour ne jamais promettre plus) et l'échéance des
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
// Ce que la page montre de l'abonnement (retour de Sabri, 12/11/2026 23:08 :
// « une meilleure mise en avant des avantages », un grand visuel par
// avantage) : AFFICHE et AVANTAGES, plus bas. La carte « Tes maillots » peut
// montrer les maillots portés (retour du 13/11 01:45) : il suffit de déposer
// public/bola-plus/maillots-portes.webp (1170 px de large, 4:5). Tant qu'il
// manque, la carte garde le portant (bola-plus.tsx, VisuelAvantage). Quatre avantages, ceux que
// Sabri a dits, dans ses mots : « ils auront des maillots », « on va filmer
// les matchs », « ils auront des cadeaux », « cérémonies officielles ». Un
// titre et rien d'autre : ni chiffre, ni date, ni phrase dessous. En ajouter
// un demande son accord.
//
// Pur : ni React ni réseau (tools/bola-plus-check.ts).

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

/**
 * Le visuel qui prend la place de celui d'un avantage dès que son fichier est
 * déposé dans public/ : un seul fichier, 1170 px de large, en 4:5. Absent, la
 * carte garde son visuel.
 */
export interface VisuelDepose {
  fichier: string;
  alt: string;
}

/** Un avantage de Bola Plus : son numéro, son titre, son visuel. Rien d'autre. */
export interface Avantage extends Visuel {
  id: string;
  numero: string;
  titre: string;
  depose?: VisuelDepose;
}

/** L'affiche d'ouverture : le stade de Bola, la nuit. */
export const AFFICHE: Visuel = { image: "affiche", alt: "", teinte: "#5b5b5b" };

export const AVANTAGES: readonly Avantage[] = [
  {
    id: "maillots",
    numero: "01",
    titre: "Tes maillots",
    image: "maillots",
    alt: "Les deux maillots de la SFL, le noir et le blanc",
    teinte: "#525252",
    depose: { fichier: "/bola-plus/maillots-portes.webp", alt: "Trois joueurs de la SFL portent les maillots, le noir et le blanc" },
  },
  { id: "matchs-filmes", numero: "02", titre: "Tes matchs filmés", image: "matchs-filmes", alt: "Une caméra au bord du terrain", teinte: "#4d4d4d" },
  { id: "cadeaux", numero: "03", titre: "Des cadeaux", image: "cadeaux", alt: "Un écrin noir fermé, posé sur du marbre", teinte: "#3e3e3e" },
  { id: "ceremonies", numero: "04", titre: "Les cérémonies officielles", image: "ceremonies", alt: "Un podium de marbre au centre du terrain", teinte: "#343434" },
];

/** L'adresse d'un visuel à une largeur donnée. */
export const fichierVisuel = (image: string, largeur: number) => `/bola-plus/${image}-${largeur}.webp`;

/** Le srcset d'un visuel : ses trois largeurs. */
export const sourcesVisuel = (image: string) => LARGEURS.map((l) => `${fichierVisuel(image, l)} ${l}w`).join(", ");
