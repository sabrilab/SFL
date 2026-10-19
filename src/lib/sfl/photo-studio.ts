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
 * Les pays mis en avant dans le filtre Drapeau (ceux des joueurs de la ligue
 * d'abord) : code ISO (ou gb-eng), nom affiché, et nom anglais donné au
 * modèle. Tous les autres pays du monde se trouvent par la recherche
 * (TOUS_LES_PAYS ; demande de Sabri du 19/10/2026 : un ami de Macédoine du
 * Nord n'avait pas son drapeau).
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
  { id: "cd", nom: "RD Congo", en: "the Democratic Republic of the Congo" },
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

/** Un pays : son code ISO 3166 en minuscules, ou gb-eng, gb-sct, gb-wls. */
export type Pays = string;

export interface UnPays {
  id: Pays;
  nom: string;
  en: string;
}

/**
 * Tous les codes ISO 3166-1 qui ont un drapeau à eux (les terres inhabitées et
 * les codes réservés sont écartés), plus le Kosovo et les nations du football
 * britannique. Les noms viennent d'Intl.DisplayNames, sauf ceux de PAYS et
 * quelques-uns réécrits plus bas.
 */
const CODES =
  "ad ae af ag ai al am ao ar as at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bw by bz " +
  "ca cc cd cf cg ch ci ck cl cm cn co cr cu cv cw cx cy cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr " +
  "ga gb gd ge gf gg gh gi gl gm gn gp gq gr gt gu gw gy hk hn hr ht hu id ie il im in iq ir is it je jm jo jp " +
  "ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz " +
  "na nc ne nf ng ni nl no np nr nu nz om pa pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw " +
  "sa sb sc sd se sg sh si sk sl sm sn so sr ss st sv sx sy sz tc td tg th tj tk tl tm tn to tr tt tv tw tz " +
  "ua ug us uy uz va vc ve vg vi vn vu wf ws xk ye yt za zm zw";

/** Les noms qu'Intl donne mal pour un drapeau, ou pas du tout. */
const NOMS: Record<string, { nom: string; en: string }> = {
  "gb-eng": { nom: "Angleterre", en: "England" },
  "gb-sct": { nom: "Écosse", en: "Scotland" },
  "gb-wls": { nom: "Pays de Galles", en: "Wales" },
  cg: { nom: "Congo", en: "the Republic of the Congo" },
  hk: { nom: "Hong Kong", en: "Hong Kong" },
  mo: { nom: "Macao", en: "Macau" },
  ps: { nom: "Palestine", en: "Palestine" },
  va: { nom: "Vatican", en: "Vatican City" },
  xk: { nom: "Kosovo", en: "Kosovo" },
};

const IDS = new Set<string>([...CODES.split(" "), "gb-eng", "gb-sct", "gb-wls"]);

let tous: UnPays[] | null = null;

/** Tous les pays, par ordre alphabétique français (calculé une fois). */
export function tousLesPays(): UnPays[] {
  if (tous) return tous;
  const fr = new Intl.DisplayNames("fr", { type: "region" });
  const en = new Intl.DisplayNames("en", { type: "region" });
  tous = [...IDS]
    .map((id): UnPays => {
      const connu = PAYS.find((p) => p.id === id) ?? NOMS[id];
      if (connu) return { id, nom: connu.nom, en: connu.en };
      const code = id.toUpperCase();
      return { id, nom: fr.of(code) ?? code, en: en.of(code) ?? code };
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return tous;
}

export function unPays(id: Pays): UnPays | undefined {
  return tousLesPays().find((p) => p.id === id);
}

/** Pour chercher sans accents ni majuscules. */
export function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Les pays dont le nom (français ou anglais) contient la recherche, ceux qui commencent par elle d'abord. */
export function chercherPays(recherche: string): UnPays[] {
  const q = sansAccents(recherche.trim());
  if (!q) return [];
  const trouves = tousLesPays().filter(
    (p) => sansAccents(p.nom).includes(q) || sansAccents(p.en).includes(q)
  );
  const debut = (p: UnPays) =>
    sansAccents(p.nom).split(/[\s'’-]+/).some((m) => m.startsWith(q)) ? 0 : 1;
  return trouves.sort((a, b) => debut(a) - debut(b));
}

/** Le drapeau en emoji (lettres régionales ; séquence de sous-division pour l'Angleterre, l'Écosse et le pays de Galles). */
export function emojiDrapeau(id: Pays): string {
  if (id.startsWith("gb-")) {
    const tag = [..."gb" + id.slice(3)].map((c) => 0xe0000 + c.charCodeAt(0));
    return String.fromCodePoint(0x1f3f4, ...tag, 0xe007f);
  }
  return String.fromCodePoint(...[...id.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function estPays(v: unknown): v is Pays {
  return typeof v === "string" && IDS.has(v);
}

export function estFiltre(v: unknown): v is Filtre {
  return FILTRES.some((f) => f.id === v);
}

export function estColoris(v: unknown): v is Coloris {
  return COLORIS.some((c) => c.id === v);
}
