"use client";

// Les vidéos de Bola dans les Actus (Sabri, 24/10/2026, pour « L'Entrée »,
// la vidéo de la J3) : « pour l'ouvrir, il faudrait être dans l'app
// seulement. Tu mets des analytics pour voir combien de personnes ont vu
// cette vidéo. Aussi, tu peux permettre de réagir à cette vidéo ou de
// commenter. On pourrait partager la vidéo et on obtiendrait un lien […] le
// lien redirige vers l'app. »
//
//   · le fichier vit dans un bucket PRIVÉ (supabase/schema.sql, « Les vidéos
//     de Bola ») : l'app demande, pour un joueur de Bola connecté et une
//     vidéo publiée, une adresse signée qui expire au bout de deux heures.
//     Aucune adresse publique, aucun fichier dans public/ ;
//   · regarder : video_vue() note, une ligne par joueur, combien de fois et
//     jusqu'où ; seulement après son accord à la politique de
//     confidentialité, comme le journal d'usage (lib/sfl/activity.ts) ;
//   · réactions et commentaires : toute l'app les lit, en temps réel ;
//   · partager : le lien <adresse>/v/<id>, avec le code de parrain de celui
//     qui partage (?de=…) : hors de l'app, la page du lien ne montre que le
//     titre (app/v/[id]) et mène à la connexion, ou à l'inscription par ce
//     parrain. Jamais une image de la vidéo.
// Admin → Activité → Vidéos pose les vidéos, les publie, prévient la ligue
// et lit tout cela (app/admin/activite/videos.tsx).
//
// Aperçus et développement : sans les tables en base, une vidéo factice
// (public/demo/video-factice.mp4, un plan codé, personne dedans), avec des
// réactions et des commentaires inventés, gardés sur le téléphone.

import { supabase } from "@/lib/supabase";
import { accordConnu, accordDonne, erreurSansTable } from "@/lib/sfl/consentement";
import { getSession } from "@/lib/sfl/auth/session";
import { monCode, normaliserCode, codeValide } from "@/lib/sfl/parrainage";

export const DEMO_VIDEOS = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

export const BUCKET_VIDEOS = "videos";
/** Durée de vie d'une adresse signée : de quoi regarder, pas de quoi la faire circuler. */
const DUREE_ADRESSE_S = 2 * 3600;

export const EMOJIS_VIDEO = ["🔥", "🐐", "😮", "😂", "👏"] as const;
export type EmojiVideo = (typeof EMOJIS_VIDEO)[number];

export interface Video {
  id: string;
  titre: string;
  legende: string | null;
  /** Chemin dans le bucket (ou, dans un aperçu, une adresse de public/demo). */
  fichier: string;
  affiche: string | null;
  largeur: number | null;
  hauteur: number | null;
  duree: number | null;
  /** null : brouillon, que l'admin seul voit. */
  publiee_le: string | null;
  created_at?: string;
}

export interface Reaction {
  joueur: string;
  emoji: EmojiVideo;
}

export interface Commentaire {
  id: number;
  joueur: string;
  /** Le nom de saison (la clé de la ligue) ; l'app montre son nom affiché. */
  nom: string;
  texte: string;
  at: number;
}

const COLONNES = "id, titre, legende, fichier, affiche, largeur, hauteur, duree, publiee_le, created_at";

export const VIDEO_FACTICE: Video = {
  id: "j3-entree",
  titre: "L'Entrée · J3",
  legende: "Dimanche, à l'Hippodrome de Marcq.",
  fichier: "/demo/video-factice.mp4",
  affiche: "/demo/video-factice.jpg",
  largeur: 720,
  hauteur: 1280,
  duree: 8,
  publiee_le: "2026-10-24T20:00:00.000Z",
};

// ───────────────────────────── Lire ─────────────────────────────

/** Les vidéos publiées, de la plus récente ; [] sans tables (la vidéo factice dans un aperçu). */
export async function lireVideos(): Promise<Video[]> {
  const { data, error } = await supabase()
    .from("videos")
    .select(COLONNES)
    .not("publiee_le", "is", null)
    .lte("publiee_le", new Date().toISOString())
    .order("publiee_le", { ascending: false })
    .limit(5);
  if (error) {
    if (DEMO_VIDEOS && erreurSansTable(error.code)) return [VIDEO_FACTICE];
    throw error;
  }
  return (data ?? []) as Video[];
}

/** Une vidéo, publiée (ou brouillon pour l'admin) ; null : inconnue ou pas pour moi. */
export async function lireVideo(id: string): Promise<Video | null> {
  const { data, error } = await supabase().from("videos").select(COLONNES).eq("id", id).maybeSingle();
  if (error) {
    if (DEMO_VIDEOS && erreurSansTable(error.code)) return id === VIDEO_FACTICE.id ? VIDEO_FACTICE : null;
    throw error;
  }
  return (data as Video | null) ?? null;
}

const signees = new Map<string, { url: string; jusqua: number }>();

/** L'adresse signée d'un fichier du bucket, gardée tant qu'elle a plus d'une demi-heure devant elle. */
export async function adresseSignee(chemin: string): Promise<string> {
  if (chemin.startsWith("/")) return chemin;
  const deja = signees.get(chemin);
  if (deja && deja.jusqua - Date.now() > 30 * 60_000) return deja.url;
  const { data, error } = await supabase().storage.from(BUCKET_VIDEOS).createSignedUrl(chemin, DUREE_ADRESSE_S);
  if (error || !data?.signedUrl) throw error ?? new Error("Adresse refusée.");
  signees.set(chemin, { url: data.signedUrl, jusqua: Date.now() + DUREE_ADRESSE_S * 1000 });
  return data.signedUrl;
}

// ───────────────────────── Réactions, commentaires ─────────────────────────

/** Les réactions et les commentaires d'une vidéo, pour le fil et le lecteur. */
export interface Echos {
  reactions: Reaction[];
  commentaires: Commentaire[];
}

const DEMO_ECHOS: Echos = {
  reactions: [
    ...["a", "b", "c", "d", "e", "f", "g"].map((j) => ({ joueur: j, emoji: "🔥" as const })),
    ...["a", "h", "i"].map((j) => ({ joueur: j, emoji: "🐐" as const })),
    { joueur: "j", emoji: "😮" },
  ],
  commentaires: [
    { id: 1, joueur: "a", nom: "Yanis K.", texte: "La retournée d'Ilyes en ouverture 😭", at: Date.parse("2026-10-24T20:12:00Z") },
    { id: 2, joueur: "b", nom: "Lina M.", texte: "Demain on est là. Orange–Bleu ça va être chaud", at: Date.parse("2026-10-24T20:19:00Z") },
    { id: 3, joueur: "c", nom: "Rayan", texte: "Les cartes qui sortent du sol 🔥🔥", at: Date.parse("2026-10-24T20:31:00Z") },
  ],
};
const CLE_DEMO = "bola-video-demo";

function demoLire(): Echos {
  try {
    const brut = localStorage.getItem(CLE_DEMO);
    if (brut) return JSON.parse(brut) as Echos;
  } catch {}
  return DEMO_ECHOS;
}
function demoEcrire(e: Echos) {
  try {
    localStorage.setItem(CLE_DEMO, JSON.stringify(e));
  } catch {}
}

/** Mon identifiant de compte (celui de la base) ; « moi » dans un aperçu. */
export async function monIdVideo(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user.id ?? (DEMO_VIDEOS ? "moi" : null);
}

export async function lireEchos(video: string): Promise<Echos & { demo?: boolean }> {
  const sb = supabase();
  const [r, c] = await Promise.all([
    sb.from("video_reactions").select("joueur, emoji").eq("video", video),
    sb
      .from("video_commentaires")
      .select("id, joueur, texte, created_at, profiles ( name )")
      .eq("video", video)
      .order("id", { ascending: true })
      .limit(500),
  ]);
  const err = r.error ?? c.error;
  if (err) {
    if (DEMO_VIDEOS && erreurSansTable(err.code)) return { ...demoLire(), demo: true };
    throw err;
  }
  type Brut = { id: number; joueur: string; texte: string; created_at: string; profiles: { name: string } | { name: string }[] | null };
  return {
    reactions: (r.data ?? []) as Reaction[],
    commentaires: ((c.data ?? []) as Brut[]).map((x) => {
      const p = Array.isArray(x.profiles) ? x.profiles[0] : x.profiles;
      return { id: x.id, joueur: x.joueur, nom: p?.name ?? "?", texte: x.texte, at: Date.parse(x.created_at) };
    }),
  };
}

/** Poser ou retirer ma réaction. */
export async function reagir(video: string, emoji: EmojiVideo, poser: boolean, demo: boolean): Promise<void> {
  if (demo) {
    const e = demoLire();
    const reactions = e.reactions.filter((x) => !(x.joueur === "moi" && x.emoji === emoji));
    demoEcrire({ ...e, reactions: poser ? [...reactions, { joueur: "moi", emoji }] : reactions });
    return;
  }
  const sb = supabase();
  const { error } = poser
    ? await sb.from("video_reactions").insert({ video, emoji })
    : await sb.from("video_reactions").delete().eq("video", video).eq("emoji", emoji).eq("joueur", (await monIdVideo()) ?? "");
  if (error && error.code !== "23505") throw error;
}

export const LONGUEUR_COMMENTAIRE = 400;

export async function commenter(video: string, texte: string, demo: boolean): Promise<void> {
  const t = texte.trim().slice(0, LONGUEUR_COMMENTAIRE);
  if (!t) return;
  if (demo) {
    const e = demoLire();
    const nom = getSession()?.name ?? "Moi";
    demoEcrire({ ...e, commentaires: [...e.commentaires, { id: Date.now(), joueur: "moi", nom, texte: t, at: Date.now() }] });
    return;
  }
  const { error } = await supabase().from("video_commentaires").insert({ video, texte: t });
  if (error) throw error;
}

export async function retirerCommentaire(id: number, demo: boolean): Promise<void> {
  if (demo) {
    const e = demoLire();
    demoEcrire({ ...e, commentaires: e.commentaires.filter((c) => c.id !== id) });
    return;
  }
  const { error } = await supabase().from("video_commentaires").delete().eq("id", id);
  if (error) throw error;
}

// ───────────────────────────── Regarder ─────────────────────────────

/**
 * Jusqu'où j'ai regardé. `debut` à chaque lecture lancée ; ensuite, au
 * plus toutes les quelques secondes (le lecteur s'en charge). Rien avant mon
 * accord à la politique, jamais bloquant.
 */
export function noterVue(video: string, debut: boolean, secondes: number, fini: boolean): void {
  try {
    const session = getSession();
    if (!session?.server) return;
    if (accordDonne(session.name) === false) return;
    accordConnu(session.name)
      .then((ok) => {
        if (!ok) return;
        return supabase()
          .rpc("video_vue", { v: video, p_debut: debut, p_secondes: Math.round(secondes * 10) / 10, p_fini: fini })
          .then(
            () => {},
            () => {}
          );
      })
      .catch(() => {});
  } catch {}
}

// ───────────────────────────── Partager ─────────────────────────────

export function adresseVideo(id: string, code?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_ADRESSE || window.location.origin).replace(/\/+$/, "");
  return `${base}/v/${id}${code ? `?de=${encodeURIComponent(code)}` : ""}`;
}

export type Partage = "partagee" | "copiee" | "annulee" | "impossible";

/**
 * Le lien de la vidéo, par la feuille de partage du téléphone (Snapchat,
 * WhatsApp…) ou, à défaut, copié. Il emporte mon code de parrain : qui
 * crée son compte depuis ce lien arrive par moi.
 */
export async function partagerVideo(v: Video): Promise<Partage> {
  const pseudo = getSession()?.user ?? null;
  const code = await monCode(pseudo).catch(() => null);
  const url = adresseVideo(v.id, code && codeValide(normaliserCode(code)) ? normaliserCode(code) : null);
  const donnees = { title: v.titre, text: `${v.titre}, à voir dans Bola.`, url };
  let issue: Partage = "impossible";
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share(donnees);
      issue = "partagee";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "annulee";
    }
  }
  if (issue === "impossible") {
    try {
      await navigator.clipboard.writeText(url);
      issue = "copiee";
    } catch {
      return "impossible";
    }
  }
  void supabase()
    .rpc("video_partage", { v: v.id })
    .then(
      () => {},
      () => {}
    );
  return issue;
}

// ─────────────────────── Le lien, hors de l'app ───────────────────────

const CLE_VISITEUR = "sfl-visiteur";

function visiteur(): string | null {
  try {
    let v = localStorage.getItem(CLE_VISITEUR);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(CLE_VISITEUR, v);
    }
    return v;
  } catch {
    return null;
  }
}

/** Le lien ouvert (« ouvert »), puis le pas vers l'app (« app ») : une fois par téléphone. */
export function noterLien(video: string, etape: "ouvert" | "app", de: string | null): void {
  const v = visiteur();
  if (!v) return;
  void supabase()
    .rpc("video_lien_vu", { v: video, visiteur: v, etape, de: de && codeValide(de) ? de : null })
    .then(
      () => {},
      () => {}
    );
}
