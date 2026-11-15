"use client";

// Le trash talk (Sabri, 12/11/2026 : « les joueurs enregistrent une vidéo ou
// un texte pendant les journées, transformé automatiquement en visuel style
// tweet ou article »). Étape 1 : le texte.
//
//   · un joueur écrit une phrase (180 caractères) sur la journée du moment :
//     la dernière jouée du dimanche soir au mercredi, sinon celle qui vient ;
//   · le code la met en page, en « tweet » (noir) ou en « une » de journal
//     (papier), sans aucune génération : components/sfl/actus/visuel-trash-talk.tsx ;
//   · elle se publie dans les Actus, dans le fil de sa journée
//     (components/sfl/actus/trash-talk.tsx), et se partage en image, Story
//     9:16 ou Post 4:5 (lib/sfl/image-a-partager.ts) ;
//   · les garde-fous vivent en base (supabase/schema.sql, « Trash talk ») :
//     trois publications par joueur et par journée (un post retiré compte
//     encore), un joueur en sourdine n'écrit pas, un joueur cité (@pseudo,
//     même suivi d'un point : « @sami. ») masque le post pour tous, trois
//     signalements le masquent en attendant l'admin, l'admin masque, remet
//     ou retire (Admin → Activité → Trash talk) ; un post remis par l'admin
//     ne se masque plus que par lui. Rien ne sort de l'app sans l'accord
//     hors-app de l'auteur et de chaque joueur cité
//     (trash_talk_partageable). Aucune notification, à personne.
//
// Sans les tables (un aperçu, avant la migration) : hors production, mes
// posts restent sur ce téléphone (localStorage) et rien n'est envoyé ; aucun
// post n'est inventé au nom d'un vrai joueur. En production, le bloc n'est
// pas monté.
//
// Le haut du fichier est pur (ni navigateur, ni base) : tools/trash-talk-check.ts.

import { supabase } from "@/lib/supabase";
import { erreurSansTable } from "@/lib/sfl/consentement";
import { pseudosCites } from "@/lib/sfl/pseudos-cites";

export type FormatTrashTalk = "tweet" | "une";
export type MotifMasque = "cite" | "signalements" | "admin";
/** Les trois cadres d'un visuel : dans le fil (4:5), et les deux images à partager. */
export type GabaritTrashTalk = "fil" | "story" | "post";

export const LONGUEUR_PHRASE = 180;
/** Publications par joueur et par journée, retirées comprises ; la base refuse la quatrième. */
export const POSTS_PAR_JOURNEE = 3;
/** À ce nombre de signalements distincts, la base masque le post en attendant l'admin. */
export const SIGNALEMENTS_QUI_MASQUENT = 3;

export interface TrashTalk {
  id: number;
  /** Le compte de l'auteur (« moi » dans un aperçu sans table). */
  joueur: string;
  /** Son nom de saison (la clé de la ligue) ; l'app montre son nom affiché. */
  nom: string;
  /** Son pseudo, sans @. */
  pseudo: string;
  saison: number;
  j: number;
  /** Le numéro de son match ce jour-là, quand la feuille le connaît. */
  match: number | null;
  format: FormatTrashTalk;
  texte: string;
  /** Les comptes cités (@pseudo), résolus par la base. */
  vises: string[];
  /** null : visible de tous. */
  masque: MotifMasque | null;
  /** L'admin l'a remis après un masquage : lui seul peut encore le masquer. */
  remis: boolean;
  at: number;
  /** L'auteur et chaque cité ont signé la charte hors-app : l'image peut sortir. */
  partageable: boolean;
  /** Je l'ai signalé (pour l'admin : le nombre de signalements est à part). */
  signale: boolean;
  /** Combien l'ont signalé ; l'admin seul le sait (0 pour les autres). */
  signalements: number;
}

/* ───────────────────────────── Le texte ───────────────────────────── */

/** La phrase telle qu'elle sera publiée : une seule ligne, sans blancs en trop, 180 caractères au plus. */
export function nettoyerPhrase(brut: string): string {
  return [...brut.replace(/\s+/g, " ").trim()].slice(0, LONGUEUR_PHRASE).join("").trim();
}

/** Pendant la frappe : les retours à la ligne deviennent des espaces, la longueur est tenue ; l'espace de fin reste. */
export function phraseEnCours(brut: string): string {
  return [...brut.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ")].slice(0, LONGUEUR_PHRASE).join("");
}

export function longueurPhrase(texte: string): number {
  return [...texte].length;
}

export interface Morceau {
  texte: string;
  /** Un @pseudo : il ressort dans le visuel. */
  cite: boolean;
}

/** Un pseudo cité sans la ponctuation qui le suit : « @sami. » en fin de phrase cite sami. */
const sansFin = (pseudo: string) => pseudo.replace(/[._-]+$/, "");

/**
 * La phrase découpée autour de ses @pseudo (la règle du Vestiaire et de la
 * base) ; le point, le tiret ou le soulignement qui ferme un pseudo reste
 * dans la phrase, hors de la citation.
 */
export function decouperCitations(texte: string): Morceau[] {
  const out: Morceau[] = [];
  let fin = 0;
  for (const m of texte.matchAll(/@[a-z0-9_.-]{2,30}/gi)) {
    const i = m.index ?? 0;
    const cite = sansFin(m[0]);
    if (cite.length < 3) continue;
    if (i > fin) out.push({ texte: texte.slice(fin, i), cite: false });
    out.push({ texte: cite, cite: true });
    fin = i + cite.length;
  }
  if (fin < texte.length) out.push({ texte: texte.slice(fin), cite: false });
  return out;
}

/** Les pseudos qu'un post cite, sans leur ponctuation de fin, sans doublon (la base les résout en comptes). */
export function pseudosVises(texte: string): string[] {
  return [...new Set(pseudosCites(texte).map(sansFin).filter((p) => p.length >= 2))];
}

/** Ajoute @pseudo à la phrase, séparé d'une espace ; rien si la place manque. */
export function citer(texte: string, pseudo: string): string {
  const p = pseudo.replace(/^@/, "").toLowerCase();
  const base = texte.replace(/\s+$/, "");
  const suite = `${base}${base ? " " : ""}@${p} `;
  return longueurPhrase(suite.trimEnd()) > LONGUEUR_PHRASE ? texte : suite;
}

/* ───────────────────────────── La journée ───────────────────────────── */

function jours(de: string, a: string): number {
  const [x, y] = [de, a].map((d) => {
    const [an, mois, jour] = d.split("-").map(Number);
    return Date.UTC(an, mois - 1, jour);
  });
  return Math.round((x - y) / 86_400_000);
}

/**
 * La journée sur laquelle on écrit : la dernière jouée, du dimanche soir au
 * mercredi (la fenêtre où les Actus la mettent en tête, course.tsx) ; sinon
 * celle qui vient, sauf en suspens. null : personne n'écrit.
 */
export function journeeDuTrashTalk({
  derniere,
  prochaine,
  aujourdhui,
}: {
  /** Le dernier dimanche joué, et son jour (AAAA-MM-JJ). */
  derniere: { j: number; iso: string | null } | null;
  /** Le dimanche de la convocation, s'il n'est pas déjà joué. */
  prochaine: { j: number; suspens: boolean } | null;
  /** Aujourd'hui à Paris (AAAA-MM-JJ). */
  aujourdhui: string;
}): number | null {
  if (derniere?.iso) {
    const ecart = jours(derniere.iso, aujourdhui);
    if (ecart <= 0 && ecart >= -3) return derniere.j;
  }
  if (prochaine && !prochaine.suspens && prochaine.j > 0) return prochaine.j;
  return null;
}

/**
 * Le numéro de mon match ce jour-là (« Match 2 »), quand la feuille le
 * connaît : plusieurs matchs, et moi dans l'un d'eux. null sinon.
 */
export function matchDuJoueur(terrains: { a: { joueurs: string[] }; b: { joueurs: string[] } }[], moi: string): number | null {
  if (terrains.length < 2) return null;
  const i = terrains.findIndex((t) => t.a.joueurs.includes(moi) || t.b.joueurs.includes(moi));
  return i < 0 ? null : i + 1;
}

/* ───────────────────────────── Le visuel ───────────────────────────── */

/** Les quatre paliers de longueur d'une phrase. */
export function palierDeLongueur(n: number): 0 | 1 | 2 | 3 {
  return n <= 40 ? 0 : n <= 80 ? 1 : n <= 130 ? 2 : 3;
}

/** Corps de départ de la phrase, pour un visuel large de 360 : plus elle est courte, plus elle est grande. */
const CORPS: Record<FormatTrashTalk, Record<GabaritTrashTalk, [number, number, number, number]>> = {
  tweet: { fil: [36, 29, 24, 20], post: [36, 29, 24, 20], story: [42, 34, 28, 23] },
  une: { fil: [42, 33, 27, 22], post: [42, 33, 27, 22], story: [48, 38, 31, 25] },
};
/** L'interligne de la phrase ; la une, en capitales accentuées, a besoin d'air entre ses lignes. */
export const INTERLIGNE: Record<FormatTrashTalk, number> = { tweet: 1.16, une: 1.06 };
/** La place de la phrase dans chaque visuel (largeur, hauteur), marges et habillage retirés. */
const PLACE: Record<FormatTrashTalk, Record<GabaritTrashTalk, [number, number]>> = {
  tweet: { fil: [308, 262], post: [308, 262], story: [304, 344] },
  une: { fil: [304, 218], post: [304, 218], story: [300, 304] },
};
/**
 * La largeur d'un signe, en part du corps, un peu au-dessus de la moyenne
 * mesurée (Inter 600 en bas de casse : 0,47 ; Inter 900 en capitales : 0,62).
 */
export const CHASSE: Record<FormatTrashTalk, number> = { tweet: 0.52, une: 0.66 };
/** En dessous, la phrase ne se lit plus : un mot sans fin se coupe plutôt. */
const CORPS_MINIMAL: Record<FormatTrashTalk, number> = { tweet: 14, une: 13 };

/**
 * La phrase telle que les visuels la composent : l'espace qui précède « : »,
 * « ; », « ! », « ? » et « » », et celle qui suit « « », ne se coupent pas
 * (jamais une ligne qui commence par un deux-points).
 */
export function espacesInsecables(texte: string): string {
  return texte.replace(/ ([:;!?»])/g, "\u00a0$1").replace(/« /g, "«\u00a0");
}

/** Le nombre de lignes d'une phrase coupée aux espaces, `parLigne` signes par ligne ; null si un mot ne tient pas sur une ligne. */
export function lignesDeLaPhrase(mots: string[], parLigne: number): number | null {
  let lignes = 1;
  let reste = parLigne;
  for (const mot of mots) {
    const n = longueurPhrase(mot);
    if (n > parLigne) return null;
    if (n <= reste) reste -= n + 1;
    else {
      lignes += 1;
      reste = parLigne - n - 1;
    }
  }
  return lignes;
}

/**
 * Le corps de la phrase : celui de son palier de longueur, réduit point par
 * point tant qu'elle ne tient pas dans sa place (un mot plus long que la
 * ligne, 180 capitales à la une) ; jamais sous le corps minimal.
 */
export function corpsDuTexte(texte: string, format: FormatTrashTalk, gabarit: GabaritTrashTalk): number {
  const [largeur, hauteur] = PLACE[format][gabarit];
  // La une pose la phrase entre guillemets : « et » comptent dans le premier et le dernier mot.
  const mots = espacesInsecables(format === "une" ? `«${texte}»` : texte).split(" ").filter(Boolean);
  let corps = CORPS[format][gabarit][palierDeLongueur(longueurPhrase(texte))];
  for (; corps > CORPS_MINIMAL[format]; corps -= 1) {
    const lignes = lignesDeLaPhrase(mots, Math.floor(largeur / (corps * CHASSE[format])));
    if (lignes !== null && lignes * corps * INTERLIGNE[format] <= hauteur) break;
  }
  return corps;
}

const paris = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...o });

/** « J5 · Match 2 · dim. 8 nov. · 14:32 » : la ligne du tweet (le match seulement s'il est connu). */
export function ligneDuPost(p: Pick<TrashTalk, "j" | "match" | "at">): string {
  const d = new Date(p.at);
  const jour = paris({ weekday: "short", day: "numeric", month: "short" }).format(d);
  const heure = paris({ hour: "2-digit", minute: "2-digit" }).format(d);
  return [`J${p.j}`, p.match ? `Match ${p.match}` : null, jour, heure].filter(Boolean).join(" · ");
}

/** « J5 · dimanche 8 novembre 2026 · N° 12 » : la ligne d'édition de la une. */
export function ligneDEdition(p: Pick<TrashTalk, "j" | "at" | "id">): string {
  const jour = paris({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(p.at));
  return [`J${p.j}`, jour, p.id > 0 ? `N° ${p.id}` : null].filter(Boolean).join(" · ");
}

/** « il y a 2 h » : sous un visuel, à côté du nom. */
export function ilYA(at: number, maintenant: number): string {
  const s = Math.max(0, (maintenant - at) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return paris({ day: "numeric", month: "short" }).format(new Date(at));
}

export function nomDeFichier(j: number, gabarit: Exclude<GabaritTrashTalk, "fil">): string {
  return `trash-talk-j${j}-${gabarit}-bola.png`;
}

/* ───────────────────────────── Les droits ───────────────────────────── */

export type Geste = "signaler" | "masquer" | "remettre" | "retirer";

/**
 * Ce que le menu « ⋯ » d'un post propose, selon qui regarde. La base a le
 * dernier mot (RLS, trash_talk_masquer, trash_talk_remettre) : ceci n'est
 * que ce qu'on montre. Un post remis par l'admin : un joueur cité ne le
 * masque plus, il le signale comme les autres.
 */
export function gestesPossibles(post: Pick<TrashTalk, "joueur" | "vises" | "masque" | "remis" | "signale">, moi: string | null, admin: boolean): Geste[] {
  if (!moi) return [];
  if (post.joueur === moi) return admin && post.masque ? ["remettre", "retirer"] : ["retirer"];
  if (admin) return [post.masque ? "remettre" : "masquer"];
  if (post.masque) return [];
  if (post.vises.includes(moi) && !post.remis) return ["masquer"];
  return post.signale ? [] : ["signaler"];
}

/** L'image d'un post ne sort de l'app qu'avec l'accord hors-app de son auteur et de chaque joueur cité. */
export function peutSortir(auteur: boolean | null | undefined, cites: (boolean | null | undefined)[]): boolean {
  return auteur === true && cites.every((c) => c === true);
}

/**
 * Les posts d'une journée tels que je les vois dans le fil, du plus récent :
 * ni ceux que j'ai signalés, ni les masqués, sauf le mien (grisé) et, pour
 * l'admin, tous.
 */
export function postsDuFil(posts: TrashTalk[], j: number, moi: string | null, admin: boolean): TrashTalk[] {
  return posts
    .filter((p) => p.j === j && !(p.signale && p.joueur !== moi && !admin) && (!p.masque || p.joueur === moi || admin))
    .sort((a, b) => b.id - a.id);
}

/** « Masqué · cité » : l'état d'un post, pour l'admin. */
export const MOTIFS: Record<MotifMasque, string> = { cite: "Masqué · cité", signalements: "Masqué · signalements", admin: "Masqué · admin" };

/** J'ai déjà mes trois posts sur cette journée (les masqués comptent ; la base compte aussi les retirés). */
export function limiteAtteinte(posts: TrashTalk[], j: number, moi: string | null): boolean {
  return !!moi && posts.filter((p) => p.j === j && p.joueur === moi).length >= POSTS_PAR_JOURNEE;
}

/** L'ordre de l'admin : ce qui demande un regard d'abord (masqué, ou signalé et pas encore remis), puis le plus récent. */
export function ordreAdmin(posts: TrashTalk[]): TrashTalk[] {
  const urgent = (p: TrashTalk) => (p.masque || (p.signalements > 0 && !p.remis) ? 1 : 0);
  return [...posts].sort((a, b) => urgent(b) - urgent(a) || b.id - a.id);
}

/** Ce que l'app dit d'un refus de la base. */
export function direRefus(e: unknown): string | null {
  const o = (typeof e === "object" && e ? e : {}) as { code?: string; message?: string };
  const msg = o.message ?? (e instanceof Error ? e.message : "");
  if (/trois par journ/i.test(msg)) return "Trois par journée.";
  if (o.code === "42501" || /row-level security/i.test(msg)) return "Tu ne peux pas publier pour l'instant.";
  return null;
}

/* ───────────────────────────── La lecture ───────────────────────────── */

/** « base » : les tables sont là ; « demo » : un aperçu sans table ; « absent » : rien à montrer. */
export type EtatTrashTalk = "base" | "demo" | "absent";

export interface LectureTrashTalk {
  etat: EtatTrashTalk;
  posts: TrashTalk[];
  /** Mon compte (« moi » dans un aperçu). */
  moi: string | null;
}

/**
 * trash_talks a deux liens vers profiles (son auteur, et qui l'a masqué) :
 * la jointure nomme le sien, sans quoi l'API refuse de choisir (PGRST201).
 */
export const COLONNES =
  "id, joueur, saison, j, match, format, texte, vises, masque_le, masque_motif, remis_le, created_at, profiles!trash_talks_joueur_fkey ( name, username )";

/** Une ligne de trash_talks, telle que l'API la rend. */
export interface LigneTrashTalk {
  id: number;
  joueur: string;
  saison: number;
  j: number;
  match: number | null;
  format: FormatTrashTalk;
  texte: string;
  vises: string[] | null;
  masque_le: string | null;
  masque_motif: MotifMasque | null;
  remis_le?: string | null;
  created_at: string;
  profiles: { name: string; username: string } | { name: string; username: string }[] | null;
}

/**
 * Une ligne de la base devient un post, avec ce que j'en sais : `partageables`,
 * les posts dont l'image peut sortir (la base le dit) ; `signalements`, ceux
 * que je peux lire (les miens ; tous pour l'admin, qui seul en voit le compte).
 */
export function postDeLigne(
  l: LigneTrashTalk,
  { moi, admin, partageables, signalements }: { moi: string | null; admin: boolean; partageables: ReadonlySet<number>; signalements: { post: number; joueur: string }[] }
): TrashTalk {
  const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
  const recus = signalements.filter((s) => Number(s.post) === l.id);
  const masque = l.masque_le ? (l.masque_motif ?? "admin") : null;
  return {
    id: l.id,
    joueur: l.joueur,
    nom: p?.name ?? "?",
    pseudo: (p?.username ?? "").replace(/^@/, ""),
    saison: l.saison,
    j: l.j,
    match: l.match,
    format: l.format,
    texte: l.texte,
    vises: l.vises ?? [],
    masque,
    remis: !!l.remis_le,
    at: Date.parse(l.created_at),
    partageable: !masque && partageables.has(l.id),
    signale: !!moi && recus.some((s) => s.joueur === moi),
    signalements: admin ? recus.length : 0,
  };
}

const MOI_DEMO = "moi";

/**
 * Sans les tables : en production, rien à montrer ; ailleurs (un aperçu),
 * mes posts gardés sur ce téléphone. Un post qui cite un joueur n'y sort
 * jamais de l'app : personne n'a pu demander l'accord du cité.
 */
export function lectureSansTable(production: boolean, gardes: TrashTalk[], saison: number, horsApp: boolean, moi: string | null): LectureTrashTalk {
  if (production) return { etat: "absent", posts: [], moi };
  const posts = gardes
    .filter((p) => p.saison === saison)
    .map((p) => ({ ...p, remis: false, partageable: !p.masque && peutSortir(horsApp, pseudosVises(p.texte).map(() => null)) }));
  return { etat: "demo", posts, moi: MOI_DEMO };
}

/* ───────────────────────────── La base ───────────────────────────── */

/** Hors production, sans les tables : mes posts restent sur ce téléphone. */
export const DEMO_TRASH_TALK = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";
const CLE_DEMO = "bola-trash-talk-demo";

function demoLire(): TrashTalk[] {
  try {
    const brut = localStorage.getItem(CLE_DEMO);
    if (brut) return JSON.parse(brut) as TrashTalk[];
  } catch {}
  return [];
}
function demoEcrire(posts: TrashTalk[]) {
  try {
    localStorage.setItem(CLE_DEMO, JSON.stringify(posts));
  } catch {}
}

async function monCompte(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * Les posts d'une saison (les 300 derniers), avec ce que j'en sais : lesquels
 * peuvent sortir de l'app, lesquels j'ai signalés. `admin` : tous les
 * signalements, comptés. `horsApp` : mon accord, pour mes posts d'un aperçu.
 * Lève toute erreur de lecture autre que « pas de table ».
 */
export async function lireTrashTalks(saison: number, { admin = false, horsApp = false }: { admin?: boolean; horsApp?: boolean } = {}): Promise<LectureTrashTalk> {
  const sb = supabase();
  const moi = await monCompte();
  const { data, error } = await sb.from("trash_talks").select(COLONNES).eq("saison", saison).order("id", { ascending: false }).limit(300);
  if (error) {
    if (!erreurSansTable(error.code)) throw error;
    return lectureSansTable(!DEMO_TRASH_TALK, DEMO_TRASH_TALK ? demoLire() : [], saison, horsApp, moi);
  }
  const lignes = (data ?? []) as unknown as LigneTrashTalk[];
  const ids = lignes.map((l) => l.id);
  // Ce qui suit n'empêche jamais de lire : au pire, rien ne se partage et rien n'est dit signalé.
  const [partageables, signalements] = await Promise.all([
    ids.length
      ? sb.rpc("trash_talks_partageables", { p_ids: ids }).then(
          (r) => new Set<number>(((r.data ?? []) as number[]).map(Number)),
          () => new Set<number>()
        )
      : Promise.resolve(new Set<number>()),
    ids.length
      ? (admin ? sb.from("trash_talk_signalements").select("post, joueur") : sb.from("trash_talk_signalements").select("post, joueur").eq("joueur", moi ?? ""))
          .in("post", ids)
          .then(
            (r) => (r.data ?? []) as { post: number; joueur: string }[],
            () => [] as { post: number; joueur: string }[]
          )
      : Promise.resolve([] as { post: number; joueur: string }[]),
  ]);
  return { etat: "base", posts: lignes.map((l) => postDeLigne(l, { moi, admin, partageables, signalements })), moi };
}

export interface NouveauTrashTalk {
  saison: number;
  j: number;
  match: number | null;
  format: FormatTrashTalk;
  texte: string;
}

/** Publier ; lève l'erreur de la base (direRefus la dit). `auteur` : mon nom et mon pseudo, pour un aperçu. */
export async function publierTrashTalk(n: NouveauTrashTalk, demo: boolean, auteur: { nom: string; pseudo: string }): Promise<void> {
  const texte = nettoyerPhrase(n.texte);
  if (!texte) return;
  if (demo) {
    const posts = demoLire();
    if (posts.filter((p) => p.saison === n.saison && p.j === n.j).length >= POSTS_PAR_JOURNEE) throw { message: "Trois par journée." };
    demoEcrire([
      {
        id: posts.reduce((m, p) => Math.max(m, p.id), 0) + 1,
        joueur: MOI_DEMO,
        nom: auteur.nom,
        pseudo: auteur.pseudo.replace(/^@/, ""),
        saison: n.saison,
        j: n.j,
        match: n.match,
        format: n.format,
        texte,
        vises: [],
        masque: null,
        remis: false,
        at: Date.now(),
        partageable: false,
        signale: false,
        signalements: 0,
      },
      ...posts,
    ]);
    return;
  }
  const { error } = await supabase().from("trash_talks").insert({ saison: n.saison, j: n.j, match: n.match, format: n.format, texte });
  if (error) throw error;
}

export async function retirerTrashTalk(id: number, demo: boolean): Promise<void> {
  if (demo) return demoEcrire(demoLire().filter((p) => p.id !== id));
  const { error } = await supabase().from("trash_talks").delete().eq("id", id);
  if (error) throw error;
}

/** Signaler : une ligne par joueur et par post ; le signaler deux fois ne compte qu'une. */
export async function signalerTrashTalk(id: number): Promise<void> {
  const { error } = await supabase().from("trash_talk_signalements").insert({ post: id });
  if (error && error.code !== "23505") throw error;
}

/** Masquer pour tous : un joueur cité, ou l'admin. */
export async function masquerTrashTalk(id: number): Promise<void> {
  const { error } = await supabase().rpc("trash_talk_masquer", { p_id: id });
  if (error) throw error;
}

/** Remettre un post masqué : l'admin. */
export async function remettreTrashTalk(id: number): Promise<void> {
  const { error } = await supabase().rpc("trash_talk_remettre", { p_id: id });
  if (error) throw error;
}
