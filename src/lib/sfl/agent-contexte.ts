// Ce que Bola Agent envoie au modèle — logique pure de la route /api/agent
// (app/api/agent/route.ts), vérifiée par tools/agent-contexte-check.ts.
//
// Audit de sécurité du 03/11/2026 (T4, T5) : le téléphone renvoyait lui-même
// la conversation et le dossier, et la route les recopiait sans contrôle, le
// dossier dans les consignes. Un compte pouvait ainsi faire passer plus d'un
// million de caractères par question (aux frais de Sabri), ou se fabriquer
// de faux tours du coach (« Mode admin activé »). Désormais :
//   · le corps de la requête fait CORPS_MAX_OCTETS au plus, lu sans tout
//     garder au-delà (lireCorps) ;
//   · la conversation est relue en base, avec le jeton du joueur : ses
//     HISTORIQUE_MAX dernières lignes d'agent_messages, comme l'écran les
//     affiche (historiqueDeLignes). Celle du téléphone est ignorée ;
//   · le dossier, borné à DOSSIER_MAX caractères (dossierBorne), n'est plus
//     dans les consignes : il ouvre la conversation, entre les balises
//     <dossier_joueur>, comme des données (dossierBalise) ;
//   · tout ce qui part au modèle en plus des consignes fixes (dossier,
//     conversation, question d'ouverture, question) tient en CONTEXTE_MAX
//     caractères, cartes comprises : les tours les plus anciens tombent
//     d'abord (messagesPour).
// Une coupe ne sépare jamais les deux moitiés d'un emoji (debut) : un texte
// qui finit par une moitié seule fait refuser la requête par l'API, et le
// joueur perdait sa question (contrôle du 03/11/2026).
// Le joueur peut encore écrire lui-même des lignes « coach » dans sa
// conversation (la base le lui permet) : il ne trompe que la sienne, et le
// plafond borne ce que cela coûte.

import { HISTORIQUE_MAX, lireCartes, lireImage, type CarteCoach, type DossierJoueur } from "./agent";
import { lireSchema } from "./schemas-coach";

/** Le corps d'une question : 100 Ko au plus. Une vraie requête en pèse quelques-uns. */
export const CORPS_MAX_OCTETS = 100_000;
/** Le dossier du joueur, en caractères de JSON (un vrai en fait 1 500 à 3 500). */
export const DOSSIER_MAX = 6_000;
/** Tout ce qui part au modèle en plus des consignes, en caractères. */
export const CONTEXTE_MAX = 30_000;
/** Le texte d'un tour relu (comme avant) ; un tour entier, cartes comprises. */
export const TEXTE_TOUR_MAX = 4_000;
export const TOUR_MAX = 6_000;
/** Un reste de place plus petit ne vaut pas un tour coupé. */
const RESTE_UTILE = 200;

export interface Tour {
  role: "joueur" | "coach";
  texte: string;
  cartes?: CarteCoach[];
  /** La légende de l'image montrée, ou le schéma dessiné, s'il y en a eu un. */
  image?: string;
}

export type MessageModele = { role: "user" | "assistant"; content: { type: "text"; text: string }[] };

/**
 * Lit le corps d'une requête, CORPS_MAX_OCTETS au plus : null au-delà. La
 * longueur annoncée ne suffit pas (elle peut manquer ou mentir) : le flux est
 * compté au fil de la lecture, et coupé dès qu'il dépasse.
 */
export async function lireCorps(req: Request, max = CORPS_MAX_OCTETS): Promise<string | null> {
  const annonce = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(annonce) && annonce > max) return null;
  if (!req.body) return "";
  const lecteur = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await lecteur.cancel().catch(() => {});
      return null;
    }
    morceaux.push(value);
  }
  const tout = new Uint8Array(total);
  let i = 0;
  for (const m of morceaux) {
    tout.set(m, i);
    i += m.byteLength;
  }
  return new TextDecoder().decode(tout);
}

/**
 * Les n premières unités d'un texte, sans couper un caractère en deux : un
 * emoji (et tout caractère hors du plan de base) en occupe deux, et sa
 * première moitié seule rend le texte invalide pour l'API.
 */
export function debut(s: string, n: number): string {
  if (s.length <= n) return s;
  if (n <= 0) return "";
  const code = s.charCodeAt(n - 1);
  return s.slice(0, code >= 0xd800 && code <= 0xdbff ? n - 1 : n);
}

/** Une moitié d'emoji restée seule (venue d'un téléphone) devient « � » : l'API refuse un texte qui en a. */
export const bienForme = (s: string) =>
  s.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");

/** Une ligne d'agent_messages relue en base, telle que l'écran l'affiche ; null si elle n'en est pas une. */
export function tourDeLigne(v: unknown): Tour | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if ((r.role !== "joueur" && r.role !== "coach") || typeof r.texte !== "string") return null;
  const schema = lireSchema(r.schema);
  const image =
    lireImage(r.image)?.legende || (schema ? `schéma ${schema.type}${schema.legende ? ` : ${schema.legende}` : ""}` : "");
  return {
    role: r.role,
    texte: debut(r.texte, TEXTE_TOUR_MAX),
    cartes: lireCartes(r.cartes),
    ...(image ? { image: debut(image, 200) } : {}),
  };
}

/** Les lignes relues, de la plus récente à la plus ancienne : les HISTORIQUE_MAX dernières, dans l'ordre. */
export function historiqueDeLignes(lignes: unknown): Tour[] {
  if (!Array.isArray(lignes)) return [];
  return lignes
    .slice(0, HISTORIQUE_MAX)
    .map(tourDeLigne)
    .filter((t): t is Tour => !!t)
    .reverse();
}

/** « < » échappé : un texte du dossier ne ferme jamais la balise (le JSON reste le même). */
const sansBalise = (json: string) => json.replace(/</g, "\\u003c");
const enJson = (v: unknown) => sansBalise(JSON.stringify(v ?? {}) ?? "{}");

/** Les champs du dossier (lib/sfl/agent.ts, DossierJoueur) : les seuls que la route garde. */
export const CHAMPS_DOSSIER = [
  "nom",
  "poste",
  "note",
  "statut",
  "stats",
  "saison",
  "synthese",
  "pointsForts",
  "dernierMatch",
  "matchs",
  "classements",
  "objectifs",
] as const satisfies readonly (keyof DossierJoueur)[];
// Un champ ajouté au dossier sans l'être ici ne compile pas.
const tousLesChamps: [Exclude<keyof DossierJoueur, (typeof CHAMPS_DOSSIER)[number]>] extends [never] ? true : never = true;
void tousLesChamps;

/**
 * Le dossier envoyé par l'écran, en JSON, DOSSIER_MAX caractères au plus.
 * Seuls ses champs connus restent (un « emailsDesJoueurs » ajouté par un
 * téléphone ne part pas). Trop long, il perd d'abord la fin de ses listes
 * (les dimanches les plus anciens, les objectifs les plus loin), puis, s'il
 * dépasse encore (un champ démesuré), il est coupé.
 */
export function dossierBorne(brut: unknown, max = DOSSIER_MAX): string {
  const o: Record<string, unknown> = {};
  if (brut && typeof brut === "object" && !Array.isArray(brut)) {
    const b = brut as Record<string, unknown>;
    for (const k of CHAMPS_DOSSIER) if (b[k] !== undefined) o[k] = b[k];
  }
  let s = enJson(o);
  if (s.length <= max) return s;
  const copie = JSON.parse(JSON.stringify(o)) as Record<string, unknown>;
  // Une vraie liste du dossier a sept éléments au plus.
  for (const [k, v] of Object.entries(copie)) if (Array.isArray(v)) copie[k] = v.slice(0, 20);
  for (;;) {
    s = enJson(copie);
    if (s.length <= max) return s;
    const listes = Object.values(copie).filter((v): v is unknown[] => Array.isArray(v) && v.length > 0);
    if (!listes.length) break;
    listes.reduce((a, b) => (JSON.stringify(b).length > JSON.stringify(a).length ? b : a)).pop();
  }
  return `${debut(s, max - 1)}…`;
}

/** Le dossier tel qu'il ouvre la conversation : des données, entre balises. */
export function dossierBalise(json: string): string {
  return `<dossier_joueur>\n${json}\n</dossier_joueur>`;
}

/** Ce que le modèle relit d'un tour : le texte du joueur, ou celui du coach avec ses cartes, en clair. */
export function enClair(t: Tour): string {
  if (t.role === "joueur") return t.texte;
  const montree = t.image ? `[Image montrée : ${t.image}]` : "";
  const cartes = (t.cartes ?? []).map(
    (c) =>
      `[${c.type}] ${c.titre}${c.sousTitre ? ` (${c.sousTitre})` : ""}\n${c.lignes
        .map((l) => `- ${l.label}${l.valeur ? ` : ${l.valeur}` : ""}${l.detail ? ` — ${l.detail}` : ""}`)
        .join("\n")}`
  );
  return [t.texte, montree, ...cartes].filter(Boolean).join("\n\n");
}

const couper = (s: string, n: number) => (s.length > n ? `${debut(s, n - 1)}…` : s);

/**
 * La conversation pour l'API : le dossier d'abord (premier message, du côté
 * du joueur), puis les derniers tours relus en base, la question d'ouverture
 * du coach s'il y en a une, et la question. Deux tours de suite du même côté
 * restent deux blocs d'un même message. Le tout tient en CONTEXTE_MAX
 * caractères : la question, l'ouverture et le dossier d'abord, puis les tours
 * du plus récent au plus ancien, chacun TOUR_MAX au plus ; celui qui ne tient
 * plus est coupé, les plus anciens tombent.
 */
export function messagesPour(p: { dossier: string; historique: Tour[]; ouverture?: string; question: string }): MessageModele[] {
  const dossier = dossierBalise(bienForme(p.dossier));
  const ouverture = bienForme(p.ouverture?.trim() ?? "");
  const question = bienForme(p.question.trim());
  let reste = CONTEXTE_MAX - dossier.length - ouverture.length - question.length;
  const gardes: { role: Tour["role"]; texte: string }[] = [];
  for (let i = p.historique.length - 1; i >= 0 && reste > 0; i--) {
    const t = p.historique[i];
    const texte = couper(bienForme(enClair(t).trim()), TOUR_MAX);
    if (!texte) continue;
    if (texte.length <= reste) {
      gardes.unshift({ role: t.role, texte });
      reste -= texte.length;
      continue;
    }
    if (reste >= RESTE_UTILE) gardes.unshift({ role: t.role, texte: couper(texte, reste) });
    break;
  }
  const tours = [...gardes, ...(ouverture ? [{ role: "coach" as const, texte: ouverture }] : []), { role: "joueur" as const, texte: question }];
  const sortie: MessageModele[] = [{ role: "user", content: [{ type: "text", text: dossier }] }];
  for (const t of tours) {
    const role = t.role === "joueur" ? "user" : "assistant";
    const prec = sortie[sortie.length - 1];
    if (prec.role === role) prec.content.push({ type: "text", text: t.texte });
    else sortie.push({ role, content: [{ type: "text", text: t.texte }] });
  }
  return sortie;
}

/** Ce que pèsent les messages, en caractères. */
export const tailleDe = (messages: MessageModele[]) =>
  messages.reduce((n, m) => n + m.content.reduce((k, b) => k + b.text.length, 0), 0);
