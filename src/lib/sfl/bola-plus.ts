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
