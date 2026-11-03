// Les droits dans une équipe de Bola Team, geste par geste (Ilyes, 02/11/2026 :
// « une équipe = 7 joueurs + 1 entraîneur »). La même table que la base
// (supabase/schema.sql, equipe_droit), qui seule décide : ici, l'app et les
// routes serveur savent quoi montrer. tools/equipe-droits-check.ts vérifie
// que les deux tables disent la même chose.
//
// Jamais « rôle différent de membre » : un rôle de plus (l'entraîneur)
// n'hérite d'aucun droit. L'entraîneur recrute, défie et dépose la feuille
// d'avant-match ; il n'annule jamais un match programmé, ne saisit jamais un
// score (sa carte le lit) et ne dirige pas l'équipe : le vice, l'entraîneur,
// l'exclusion et la dissolution restent au capitaine. Pendant un préavis
// d'exclusion, la base retire tout droit (droitDe le dit avec le départ).
// La feuille d'avant-match a sa règle de temps en plus (peutDeposer, la même
// qu'equipe_feuille) : le capitaine et le vice ne passent devant
// l'entraîneur qu'à partir de 2 h avant le coup d'envoi.
//
// Module pur, sans base ni React : importable par les routes serveur.

export type Role = "capitaine" | "vice" | "membre" | "entraineur";

export type Geste = "inviter" | "defier" | "feuille" | "annuler" | "score" | "ecusson" | "couverture" | "direction";

/** Qui a quel geste (equipe_droit, dans la base). */
export const DROITS: Record<Geste, readonly Role[]> = {
  inviter: ["capitaine", "vice", "entraineur"],
  defier: ["capitaine", "vice", "entraineur"],
  feuille: ["capitaine", "vice", "entraineur"],
  annuler: ["capitaine", "vice"],
  score: ["capitaine", "vice"],
  ecusson: ["capitaine", "vice"],
  couverture: ["capitaine", "vice"],
  direction: ["capitaine"],
};

/** Ce rôle a-t-il ce geste ? Sans rôle (pas membre), aucun. */
export const peut = (role: Role | null | undefined, geste: Geste): boolean => !!role && DROITS[geste].includes(role);

/** Un membre de l'équipe : son rôle, et son exclusion en cours (aucun droit pendant le préavis). */
export const droitDe = (m: { role: Role; departLe?: string | null } | null | undefined, geste: Geste): boolean =>
  !!m && !m.departLe && peut(m.role, geste);

/** Un joueur de l'équipe, pas l'entraîneur : il compte (5, 7, « Il manque N »), il joue, il marque. */
export const joue = (role: Role | null | undefined): boolean => !!role && role !== "entraineur";

/** Le brassard, à dire sous une carte (« Capitaine », « Vice-capitaine ») : un nom, jamais un droit. */
export const brassard = (role: Role | null | undefined): role is "capitaine" | "vice" => role === "capitaine" || role === "vice";

/**
 * La feuille d'avant-match (03/11/2026) : de 5 à 7 joueurs de l'équipe,
 * figée au coup d'envoi. Le capitaine et le vice ne la déposent qu'à partir
 * de 2 h avant le match quand l'équipe a un entraîneur (Q1 à Ilyes).
 */
export const FEUILLE_AVANT_MATCH = { min: 5, max: 7, capitainesAvantH: 2 } as const;

type MembreDroits = { id: string; role: Role; statut: "invite" | "membre"; departLe?: string | null };

/**
 * Puis-je déposer (ou redéposer) la feuille de mon équipe maintenant ? La
 * même règle qu'equipe_feuille, dans la base : l'entraîneur, toujours avant
 * le coup d'envoi ; le capitaine ou le vice sans entraîneur en place, ou dès
 * H-2 si la feuille n'est pas celle de l'entraîneur (`auteur` : qui a déposé
 * la feuille actuelle).
 */
export function peutDeposer(
  moi: MembreDroits | null | undefined,
  membres: readonly MembreDroits[],
  auteur: string | null | undefined,
  coup: Date,
  maintenant = new Date()
): boolean {
  if (!moi || moi.statut !== "membre" || !droitDe(moi, "feuille")) return false;
  if (maintenant.getTime() >= coup.getTime()) return false;
  if (moi.role === "entraineur") return true;
  const entraineur = membres.find((m) => m.role === "entraineur" && m.statut === "membre" && !m.departLe);
  if (!entraineur) return true;
  return maintenant.getTime() >= coup.getTime() - FEUILLE_AVANT_MATCH.capitainesAvantH * 3600_000 && auteur !== entraineur.id;
}
