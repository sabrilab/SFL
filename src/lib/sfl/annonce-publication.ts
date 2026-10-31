// « J4 en ligne » : la notification de la publication d'une journée
// (30/10/2026). L'admin choisit qui prévenir dans la feuille Publier, le
// texte exact sous les yeux ; elle ne part qu'une fois par journée (clé
// `publication-s{n}-j{j}` dans annonces_envois), même si on republie.
//
// Pur : partagé par la feuille Publier (l'aperçu) et la route qui envoie.

import { neJouePas } from "./hidden";
import { estBrouillon } from "./saisie/brouillon";
import { numeroSaison, type Saison } from "./saisie/types";

export type QuiPrevenir = "personne" | "viennent" | "ligue";

export const QUI_PREVENIR: { id: QuiPrevenir; libelle: string }[] = [
  { id: "personne", libelle: "Personne" },
  { id: "viennent", libelle: "Ceux qui viennent" },
  { id: "ligue", libelle: "Toute la ligue" },
];

export function clePublication(saison: Pick<Saison, "numero">, j: number): string {
  return `publication-s${numeroSaison(saison)}-j${j}`;
}

/** « J4 en ligne » · « Dim 2 nov. · 12h30 à l'Hippodrome ». */
export function textePublication(saison: Saison, j: number): { titre: string; texte: string } {
  const meta = saison.journees.find((m) => m.j === j);
  const lieu = meta?.terrainId != null ? saison.terrains?.find((t) => t.id === meta.terrainId) : saison.terrains?.find((t) => t.defaut);
  const quand = [meta?.date ? `Dim ${meta.date}` : null, meta?.heure ?? null].filter(Boolean).join(" · ");
  return {
    titre: `J${j} en ligne`,
    texte: [quand, lieu ? `à ${lieu.nom}` : null].filter(Boolean).join(" ") + ". Les équipes sont faites.",
  };
}

/** Les noms à prévenir : ceux de la feuille de la journée, ou tout l'effectif ; jamais un membre qui ne joue pas. */
export function destinatairesPublication(saison: Saison, j: number, qui: QuiPrevenir): string[] {
  if (qui === "personne") return [];
  const noms =
    qui === "viennent"
      ? saison.entries.filter((e) => e.j === j && e.statut === "Présent" && !e.extraTime).map((e) => e.player)
      : saison.roster.map((r) => r.name);
  return [...new Set(noms)].filter((n) => !neJouePas(n));
}

/** La journée peut-elle s'annoncer (publiée, présente) ? */
export function publicationAnnoncable(saison: Saison, j: number): boolean {
  const meta = saison.journees.find((m) => m.j === j);
  return !!meta && !estBrouillon(meta);
}
