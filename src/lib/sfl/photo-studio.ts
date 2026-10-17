// Photo officielle : un selfie devient une photo de studio au maillot Bola,
// la même pour toutes les cartes, puis peut passer par un filtre.
//
// Ce module est partagé entre la route serveur (/api/photo-studio, qui parle
// à fal.ai) et l'écran du joueur (photo-studio.tsx) : la liste des filtres,
// les coloris du maillot et les limites. Les prompts restent côté serveur.
//
// Choix validés le 17/10/2026 (essais Magnific, planche « Avatars Bola ») :
// le studio fait la carte officielle ; Argentique, Marbre et Manga sont des
// filtres au choix, appliqués à la photo de studio et pas au selfie, pour
// que le visage et le maillot restent les mêmes d'un filtre à l'autre.

export const FILTRES = [
  { id: "studio", label: "Studio" },
  { id: "argentique", label: "Argentique" },
  { id: "marbre", label: "Marbre" },
  { id: "manga", label: "Manga" },
] as const;

export type Filtre = (typeof FILTRES)[number]["id"];

export const COLORIS = [
  { id: "blanc", label: "Blanc" },
  { id: "noir", label: "Noir" },
] as const;

export type Coloris = (typeof COLORIS)[number]["id"];

/** Selfies envoyés pour une photo de studio. */
export const SELFIES_MAX = 3;
/** Générations par joueur sur 24 h glissantes (studio et filtres confondus). */
export const LIMITE_JOUR = 12;
/** Côté maximal d'un selfie envoyé, en pixels (le modèle n'a pas besoin de plus). */
export const SELFIE_COTE = 1024;

export function estFiltre(v: unknown): v is Filtre {
  return FILTRES.some((f) => f.id === v);
}

export function estColoris(v: unknown): v is Coloris {
  return COLORIS.some((c) => c.id === v);
}
