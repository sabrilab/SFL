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
