// Photo officielle : un selfie devient une photo de studio au maillot Bola,
// la même pour toutes les cartes, puis peut passer par un filtre.
//
// Ce module est partagé entre la route serveur (/api/photo-studio, qui parle
// à fal.ai) et l'écran du joueur (photo-studio.tsx) : la liste des filtres,
// les coloris du maillot et les limites. Les prompts restent côté serveur.
//
// Choix de Sabri (17-18/10/2026, planche « Avatars Bola ») : le studio fait
// la carte officielle ; Drapeau (le drapeau de son pays derrière lui) et
// Manga sont des filtres au choix, appliqués à la photo de studio et pas au
// selfie, pour que le visage et le maillot restent les mêmes d'un filtre à
// l'autre. Marbre et Argentique, essayés, ont été écartés.

export const FILTRES = [
  { id: "studio", label: "Neutre" },
  { id: "drapeau", label: "Drapeau" },
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

/**
 * Les pays du filtre Drapeau : code ISO (ou gb-eng), nom affiché, et nom
 * anglais donné au modèle. Les pays des joueurs de la ligue d'abord.
 */
export const PAYS = [
  { id: "fr", nom: "France", en: "France" },
  { id: "dz", nom: "Algérie", en: "Algeria" },
  { id: "ma", nom: "Maroc", en: "Morocco" },
  { id: "tn", nom: "Tunisie", en: "Tunisia" },
  { id: "sn", nom: "Sénégal", en: "Senegal" },
  { id: "ml", nom: "Mali", en: "Mali" },
  { id: "ci", nom: "Côte d'Ivoire", en: "Ivory Coast" },
  { id: "cm", nom: "Cameroun", en: "Cameroon" },
  { id: "cd", nom: "RD Congo", en: "DR Congo" },
  { id: "gn", nom: "Guinée", en: "Guinea" },
  { id: "mr", nom: "Mauritanie", en: "Mauritania" },
  { id: "km", nom: "Comores", en: "Comoros" },
  { id: "cv", nom: "Cap-Vert", en: "Cape Verde" },
  { id: "eg", nom: "Égypte", en: "Egypt" },
  { id: "tr", nom: "Turquie", en: "Turkey" },
  { id: "pt", nom: "Portugal", en: "Portugal" },
  { id: "es", nom: "Espagne", en: "Spain" },
  { id: "it", nom: "Italie", en: "Italy" },
  { id: "be", nom: "Belgique", en: "Belgium" },
  { id: "nl", nom: "Pays-Bas", en: "the Netherlands" },
  { id: "de", nom: "Allemagne", en: "Germany" },
  { id: "gb-eng", nom: "Angleterre", en: "England" },
  { id: "br", nom: "Brésil", en: "Brazil" },
  { id: "ar", nom: "Argentine", en: "Argentina" },
] as const;

export type Pays = (typeof PAYS)[number]["id"];

/** Le drapeau en emoji (lettres régionales ; séquence de sous-division pour l'Angleterre). */
export function emojiDrapeau(id: Pays): string {
  if (id === "gb-eng") return "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  return String.fromCodePoint(...[...id.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function estPays(v: unknown): v is Pays {
  return PAYS.some((p) => p.id === v);
}

export function estFiltre(v: unknown): v is Filtre {
  return FILTRES.some((f) => f.id === v);
}

export function estColoris(v: unknown): v is Coloris {
  return COLORIS.some((c) => c.id === v);
}
