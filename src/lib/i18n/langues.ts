// Les langues de l'app, et celle qu'on propose selon le pays de connexion
// (Sabri, 03/11/2026 : « par défaut français en pays francophone, mais la
// possibilité de la mettre en arabe si on se connecte d'Algérie »).
//
// Pur (ni React ni navigateur) : testé par tools/langues-check.ts.
//
// - Le français reste la langue de qui n'a rien choisi, partout où il se
//   parle, Maghreb compris (Algérie, Maroc, Tunisie, Mauritanie, Liban) :
//   l'arabe y est proposé d'un toucher, pas imposé.
// - Dans un pays arabophone où le français ne se parle pas (Égypte, Golfe,
//   Levant…), l'arabe est la langue d'office, le français proposé.
// - Ailleurs, le français ; l'arabe n'est proposé à l'entrée que si le
//   téléphone lui-même est en arabe. Les réglages offrent toujours toutes
//   les langues.
// Le choix du joueur, une fois fait, l'emporte sur tout (bola-langue, sur
// le téléphone).

export const LANGUES = ["fr", "ar"] as const;
export type Langue = (typeof LANGUES)[number];

export const INFO_LANGUE: Record<Langue, { nom: string; court: string; dir: "ltr" | "rtl" }> = {
  fr: { nom: "Français", court: "FR", dir: "ltr" },
  ar: { nom: "العربية", court: "عربي", dir: "rtl" },
};

/** La clé du choix sur le téléphone (localStorage). */
export const CLE_LANGUE = "bola-langue";

/** Le français s'y parle, l'arabe aussi : français d'office, arabe proposé. */
const FRANCO_ARABES = ["DZ", "MA", "TN", "MR", "LB"];
/** L'arabe d'office, le français proposé. */
export const ARABOPHONES = ["EG", "LY", "SD", "SA", "AE", "QA", "KW", "BH", "OM", "YE", "JO", "IQ", "SY", "PS"];

export function estLangue(x: unknown): x is Langue {
  return typeof x === "string" && (LANGUES as readonly string[]).includes(x);
}

/** La langue d'un joueur qui n'a rien choisi, selon son pays (code ISO, ex. « DZ »). */
export function langueDuPays(pays: string | null | undefined): Langue {
  return pays && ARABOPHONES.includes(pays.toUpperCase()) ? "ar" : "fr";
}

/**
 * Les langues offertes à l'entrée (connexion, inscription), celle d'office en
 * tête. Une seule : pas de choix à montrer.
 */
export function languesProposees(pays: string | null | undefined, appareil: readonly string[] = []): Langue[] {
  const p = (pays ?? "").toUpperCase();
  const arabe = FRANCO_ARABES.includes(p) || ARABOPHONES.includes(p) || appareil.some((l) => /^ar\b/i.test(l));
  if (!arabe) return ["fr"];
  return langueDuPays(p) === "ar" ? ["ar", "fr"] : ["fr", "ar"];
}

/** Remplace les {repères} d'une phrase. */
export function remplir(phrase: string, valeurs?: Record<string, string | number>): string {
  if (!valeurs) return phrase;
  return phrase.replace(/\{(\w+)\}/g, (m, k: string) => (k in valeurs ? String(valeurs[k]) : m));
}
