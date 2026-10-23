"use client";

// Le Vestiaire — la discussion de toute la ligue (/vestiaire, la bulle de la
// barre d'onglets).
//
// C'est le salon de la table `messages` (canal 'sfl'), rebaptisé : on y
// chambre, comme les joueurs le faisaient sur Snap. Ce que Snap n'a pas, et
// qui fait venir ici :
//   · la PIÈCE : un message peut porter sa carte, une feuille de match ou un
//     classement, partagés en un geste et dessinés par l'app ;
//   · les RÉACTIONS sur le message d'un pote (cinq émojis de vestiaire) ;
//   · @pseudo pour citer quelqu'un, qui reçoit alors une notification.
//
// Les notifications partent du serveur (/api/vestiaire/notifier) : l'app
// l'appelle après chaque message ou réaction, il décide qui prévenir (voir la
// route : cités tout de suite, les autres groupés une fois par heure au plus).
//
// Ce que chacun a lu vit en base (vestiaire_suivi) pour que la pastille suive
// le joueur d'un téléphone à l'autre ; localStorage ne sert que de repli.
//
// Depuis le 22/10, l'écran du Vestiaire sert aussi à la discussion de chaque
// match ouvert par un joueur (lib/sfl/discussion-match.ts) : il ne connaît
// qu'un SALON (plus bas), que le Vestiaire et chaque match remplissent.

import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/sfl/auth/session";

/* -------------------------------- Pièces -------------------------------- */

export interface PieceCarte {
  type: "carte";
  joueur: string;
}
export interface PieceFeuille {
  type: "feuille";
  j: number;
}
export interface PieceClassement {
  type: "classement";
  id: string;
  /** Le podium au moment du partage : on chambre sur ce qui était vrai. */
  top: { n: string; v: number }[];
}
/** Un message vocal (19/10) : le fichier dans le bucket privé « vocaux ». */
export interface PieceVocal {
  type: "vocal";
  /** <uuid de l'auteur>/<horodatage>.<ext> */
  chemin: string;
  /** En secondes. */
  duree: number;
}
/** Une photo (19/10) : le fichier dans le bucket privé « images ». */
export interface PiecePhoto {
  type: "photo";
  /** <uuid de l'auteur>/<horodatage>.jpg */
  chemin: string;
  /** Largeur et hauteur en pixels : la bulle garde sa place avant le chargement. */
  l: number;
  h: number;
}
/** Une vidéo (19/10) : 30 s au plus, dans le même bucket que les photos. */
export interface PieceVideo {
  type: "video";
  /** <uuid de l'auteur>/<horodatage>.<ext> */
  chemin: string;
  l: number;
  h: number;
  /** En secondes. */
  duree: number;
}
/**
 * Un élément de la Ligue (19/10) : l'homme du dimanche, l'équipe type, les
 * badges décrochés, la course… figé tel qu'il était au partage, comme le
 * podium d'un classement. Chaque ligne est un joueur (n) ou un chiffre (l).
 */
export interface PieceLigue {
  type: "ligue";
  titre: string;
  j?: number;
  lignes: { n?: string; l?: string; v: string }[];
}
export const LIGNES_MAX = 6;
/**
 * L'arrivée d'un joueur dans un match (22/10), dans la discussion du match
 * seulement : « Kader a rejoint le match ». L'app la pose quand il prend sa
 * place ou accepte l'invitation ; elle ne dit rien d'autre que son auteur.
 */
export interface PieceRejoint {
  type: "rejoint";
}
export type Piece = PieceCarte | PieceFeuille | PieceClassement | PieceVocal | PiecePhoto | PieceVideo | PieceLigue | PieceRejoint;

export function estPiece(v: unknown): v is Piece {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  if (p.type === "carte") return typeof p.joueur === "string" && p.joueur.length > 0;
  if (p.type === "feuille") return typeof p.j === "number";
  if (p.type === "rejoint") return true;
  if (p.type === "classement")
    return typeof p.id === "string" && Array.isArray(p.top) && p.top.length <= 3;
  if (p.type === "vocal") return typeof p.chemin === "string" && typeof p.duree === "number";
  if (p.type === "photo")
    return typeof p.chemin === "string" && typeof p.l === "number" && typeof p.h === "number" && p.l > 0 && p.h > 0;
  if (p.type === "ligue")
    return (
      typeof p.titre === "string" &&
      p.titre.length > 0 &&
      Array.isArray(p.lignes) &&
      p.lignes.length > 0 &&
      p.lignes.length <= LIGNES_MAX &&
      p.lignes.every((l) => !!l && typeof l === "object" && typeof (l as { v?: unknown }).v === "string")
    );
  if (p.type === "video")
    return (
      typeof p.chemin === "string" &&
      typeof p.l === "number" &&
      typeof p.h === "number" &&
      typeof p.duree === "number" &&
      p.l > 0 &&
      p.h > 0
    );
  return false;
}

/* ------------------------------- Réactions ------------------------------ */

export const EMOJIS = ["😂", "🔥", "🐐", "🤡", "💀"] as const;
export type Emoji = (typeof EMOJIS)[number];

/* -------------------------------- Lecture ------------------------------- */

export interface ProfilV {
  id: string;
  name: string;
  /** Sans l'arobase, en minuscules. */
  pseudo: string;
}

export interface MessageV {
  id: number;
  auteurId: string;
  /** Nom de saison de l'auteur (la clé des cartes), « » s'il est inconnu. */
  auteur: string;
  texte: string;
  piece: Piece | null;
  at: number;
  mien: boolean;
  /** Le message auquel celui-ci répond, s'il existe encore. */
  reponseA: number | null;
  /** Par émoji : qui a réagi (identifiants). */
  reactions: Partial<Record<Emoji, string[]>>;
}

export async function chargerProfilsV(): Promise<ProfilV[]> {
  const { data, error } = await supabase().from("profiles").select("id, name, username");
  if (error) return [];
  return ((data ?? []) as { id: string; name: string; username: string }[]).map((p) => ({
    id: p.id,
    name: p.name,
    pseudo: p.username.replace(/^@/, "").toLowerCase(),
  }));
}

interface Brut {
  id: number;
  auteur: string;
  texte: string;
  piece?: unknown;
  reponse_a?: number | null;
  created_at: string;
}

/** Où vit une discussion : le Vestiaire, ou la discussion d'un match. */
export type Canal = { canal: "sfl" } | { canal: "match"; matchId: number };
const VESTIAIRE: Canal = { canal: "sfl" };

export function expliquer(message: string, ou: Canal = VESTIAIRE): string {
  if (/jwt|token|not authenticated|auth session/i.test(message))
    return "Ta session a expiré. Déconnecte-toi puis reconnecte-toi.";
  if (ou.canal === "match") {
    // Avant la migration (les aperçus), la colonne match_id n'existe pas.
    if (/match_id/.test(message)) return "La discussion des matchs arrive bientôt.";
    if (/row-level security|violates/i.test(message)) return "Tu n'es plus dans ce match.";
    return "La discussion ne répond pas. Réessaie dans un instant.";
  }
  if (/row-level security|violates/i.test(message)) return "L'admin t'a coupé la parole pour l'instant.";
  return "Le Vestiaire ne répond pas. Réessaie dans un instant.";
}

export function chargerVestiaire(moi: string, profils: ProfilV[], limite = 200) {
  return chargerFil(VESTIAIRE, moi, profils, limite);
}

/** Les derniers messages d'une discussion, du plus ancien au plus récent, avec leurs réactions. */
export async function chargerFil(
  ou: Canal,
  moi: string,
  profils: ProfilV[],
  limite = 200
): Promise<{ ok: true; messages: MessageV[] } | { ok: false; raison: string }> {
  const sb = supabase();
  // Avant la migration (les aperçus), la colonne piece n'existe pas encore :
  // on relit sans elle plutôt que de laisser le Vestiaire vide.
  const lire = (colonnes: string) => {
    const q = sb.from("messages").select(colonnes).eq("canal", ou.canal);
    return (ou.canal === "match" ? q.eq("match_id", ou.matchId) : q).order("created_at", { ascending: false }).limit(limite);
  };
  let r = await lire("id, auteur, texte, piece, reponse_a, created_at");
  if (r.error && /reponse_a/.test(r.error.message)) r = await lire("id, auteur, texte, piece, created_at");
  if (r.error && /piece/.test(r.error.message)) r = await lire("id, auteur, texte, created_at");
  if (r.error) return { ok: false, raison: expliquer(r.error.message, ou) };
  const bruts = (r.data ?? []) as unknown as Brut[];

  const reactions = new Map<number, Partial<Record<Emoji, string[]>>>();
  if (bruts.length > 0) {
    const { data } = await sb
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .in(
        "message_id",
        bruts.map((b) => b.id)
      );
    for (const x of (data ?? []) as { message_id: number; user_id: string; emoji: Emoji }[]) {
      const parEmoji = reactions.get(x.message_id) ?? {};
      (parEmoji[x.emoji] ??= []).push(x.user_id);
      reactions.set(x.message_id, parEmoji);
    }
  }

  const nomDe = new Map(profils.map((p) => [p.id, p.name]));
  const messages = bruts
    .map((b) => ({
      id: b.id,
      auteurId: b.auteur,
      auteur: nomDe.get(b.auteur) ?? "",
      texte: b.texte,
      piece: estPiece(b.piece) ? b.piece : null,
      at: new Date(b.created_at).getTime(),
      mien: b.auteur === moi,
      reponseA: b.reponse_a ?? null,
      reactions: reactions.get(b.id) ?? {},
    }))
    .reverse();
  return { ok: true, messages };
}

/* ------------------------------- Écriture ------------------------------- */

export type Resultat = { ok: true } | { ok: false; raison: string };

/** Pourquoi écrire est impossible — null si ça l'est. */
export function blocageVestiaire(ou: Canal = VESTIAIRE): string | null {
  const session = getSession();
  const ici = ou.canal === "match" ? "aux joueurs du match" : "au Vestiaire";
  if (!session) return `Connecte-toi pour parler ${ici}.`;
  if (!session.server) return `Déconnecte-toi puis reconnecte-toi pour écrire ${ici}.`;
  return null;
}

export type CorpsNotif = { type: "message"; id: number } | { type: "reaction"; id: number; emoji: Emoji };

/** La route qui prévient pour une discussion : celle du Vestiaire, ou celle des matchs. */
const routeDe = (ou: Canal) => (ou.canal === "match" ? "/api/matchs/discussion" : "/api/vestiaire/notifier");

/** Demande au serveur de prévenir qui doit l'être. Sans attendre ni échouer. */
export function notifier(corps: CorpsNotif, ou: Canal = VESTIAIRE) {
  void (async () => {
    try {
      const { data } = await supabase().auth.getSession();
      const jeton = data.session?.access_token;
      if (!jeton) return;
      await fetch(routeDe(ou), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
        body: JSON.stringify(corps),
        keepalive: true,
      });
    } catch {
      /* une notification perdue ne doit jamais bloquer le message */
    }
  })();
}

export function posterAuVestiaire(texte: string, piece: Piece | null, reponseA: number | null = null): Promise<Resultat> {
  return poster(VESTIAIRE, texte, piece, reponseA);
}

/** Écrit dans une discussion, puis demande au serveur de prévenir. */
export async function poster(ou: Canal, texte: string, piece: Piece | null, reponseA: number | null = null): Promise<Resultat> {
  const propre = texte.trim();
  if (!propre && !piece) return { ok: false, raison: "Message vide." };
  if (propre.length > 2000) return { ok: false, raison: "Message trop long." };
  const empeche = blocageVestiaire(ou);
  if (empeche) return { ok: false, raison: empeche };
  try {
    const sb = supabase();
    const { data: auth } = await sb.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, raison: expliquer("jwt", ou) };
    const ligne: Record<string, unknown> = { canal: ou.canal, auteur: uid, destinataire: null, texte: propre };
    if (ou.canal === "match") ligne.match_id = ou.matchId;
    if (piece) ligne.piece = piece;
    if (reponseA) ligne.reponse_a = reponseA;
    const { data, error } = await sb.from("messages").insert(ligne).select("id").single();
    if (error) return { ok: false, raison: expliquer(error.message, ou) };
    notifier({ type: "message", id: (data as { id: number }).id }, ou);
    return { ok: true };
  } catch {
    return { ok: false, raison: expliquer("", ou) };
  }
}

/* -------------------------------- Vocaux -------------------------------- */

const BUCKET_VOCAUX = "vocaux";
/** Une minute au plus : au-delà, l'enregistrement s'arrête tout seul. */
export const VOCAL_MAX_S = 60;

/** Le format que ce téléphone sait enregistrer : mp4/aac sur iPhone. */
export function formatVocal(): { mime: string; ext: string } | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  const choix: [string, string][] = [
    ["audio/mp4", "m4a"],
    ["audio/webm;codecs=opus", "webm"],
    ["audio/webm", "webm"],
    ["audio/ogg;codecs=opus", "ogg"],
  ];
  for (const [mime, ext] of choix) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

/** Dépose un vocal et renvoie sa pièce, prête à partir. */
export async function deposerVocal(blob: Blob, duree: number, ext: string): Promise<PieceVocal | null> {
  const sb = supabase();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const chemin = `${uid}/${Date.now()}.${ext}`;
  // Le type sans ses paramètres (« ;codecs=opus ») : c'est lui que le bucket filtre.
  const contentType = (blob.type || "audio/mp4").split(";")[0];
  const { error } = await sb.storage.from(BUCKET_VOCAUX).upload(chemin, blob, { contentType });
  if (error) return null;
  return { type: "vocal", chemin, duree: Math.round(duree * 10) / 10 };
}

const liens = new Map<string, Promise<string | null>>();

/** Un lien de lecture signé une heure, gardé en mémoire 50 minutes. */
function lienSigne(bucket: string, chemin: string): Promise<string | null> {
  const cle = `${bucket}/${chemin}`;
  let lien = liens.get(cle);
  if (!lien) {
    lien = supabase()
      .storage.from(bucket)
      .createSignedUrl(chemin, 3600)
      .then(({ data }) => data?.signedUrl ?? null);
    liens.set(cle, lien);
    setTimeout(() => liens.delete(cle), 50 * 60_000);
  }
  return lien;
}

/** Le lien d'écoute d'un vocal. */
export const lienVocal = (chemin: string) => lienSigne(BUCKET_VOCAUX, chemin);

/* -------------------------------- Photos -------------------------------- */

const BUCKET_IMAGES = "images";
/** Le plus grand côté d'une photo envoyée : net sur iPhone, ≈ 300 Ko. */
const PHOTO_MAX_PX = 1600;

/** La photo choisie, redressée et réduite en JPEG, prête à partir. */
export async function preparerPhoto(fichier: File): Promise<{ blob: Blob; l: number; h: number } | null> {
  const url = URL.createObjectURL(fichier);
  try {
    // Une <img> applique l'orientation de l'appareil photo (EXIF) et lit le
    // HEIC de l'iPhone dans Safari.
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const k = Math.min(1, PHOTO_MAX_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const l = Math.max(1, Math.round(img.naturalWidth * k));
    const h = Math.max(1, Math.round(img.naturalHeight * k));
    const toile = document.createElement("canvas");
    toile.width = l;
    toile.height = h;
    const ctx = toile.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, l, h);
    const blob = await new Promise<Blob | null>((ok) => toile.toBlob(ok, "image/jpeg", 0.82));
    return blob ? { blob, l, h } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Dépose une photo préparée et renvoie sa pièce. */
export async function deposerPhoto(blob: Blob, l: number, h: number): Promise<PiecePhoto | null> {
  const sb = supabase();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const chemin = `${uid}/${Date.now()}.jpg`;
  const { error } = await sb.storage.from(BUCKET_IMAGES).upload(chemin, blob, { contentType: "image/jpeg" });
  if (error) return null;
  return { type: "photo", chemin, l, h };
}

/** Le lien d'une photo ou d'une vidéo. */
export const lienPhoto = (chemin: string) => lienSigne(BUCKET_IMAGES, chemin);

/* -------------------------------- Vidéos -------------------------------- */

/** 30 secondes et 25 Mo au plus : le stockage gratuit tient ainsi des centaines de vidéos. */
export const VIDEO_MAX_S = 30;
const VIDEO_MAX_OCTETS = 25 * 1024 * 1024;

/** Lit la forme et la durée d'une vidéo choisie, ou dit pourquoi elle ne part pas. */
export async function preparerVideo(
  fichier: File
): Promise<{ ok: true; l: number; h: number; duree: number } | { ok: false; raison: string }> {
  if (fichier.size > VIDEO_MAX_OCTETS) return { ok: false, raison: "Vidéo trop lourde : 25 Mo au plus. Coupe-la." };
  const url = URL.createObjectURL(fichier);
  try {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const lue = await new Promise<boolean>((ok) => {
      v.onloadedmetadata = () => ok(true);
      v.onerror = () => ok(false);
      setTimeout(() => ok(v.readyState >= 1), 8000);
      v.src = url;
    });
    if (!lue) return { ok: false, raison: "Cette vidéo ne s'ouvre pas." };
    if (v.duration > VIDEO_MAX_S + 0.5) return { ok: false, raison: `Vidéo trop longue : ${VIDEO_MAX_S} s au plus. Coupe-la.` };
    return { ok: true, l: v.videoWidth || 9, h: v.videoHeight || 16, duree: Math.round((v.duration || 0) * 10) / 10 };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Dépose une vidéo et renvoie sa pièce. */
export async function deposerVideo(fichier: Blob, l: number, h: number, duree: number): Promise<PieceVideo | null> {
  const sb = supabase();
  const { data: auth } = await sb.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;
  const type = (fichier.type || "video/mp4").split(";")[0];
  const ext = type === "video/quicktime" ? "mov" : type === "video/webm" ? "webm" : "mp4";
  const chemin = `${uid}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET_IMAGES).upload(chemin, fichier, { contentType: type });
  if (error) return null;
  return { type: "video", chemin, l, h, duree };
}

/** Pose ou retire ma réaction (au Vestiaire, ou dans la discussion `ou`). */
export async function reagir(id: number, emoji: Emoji, poser: boolean, ou: Canal = VESTIAIRE): Promise<boolean> {
  const sb = supabase();
  if (poser) {
    const { error } = await sb.from("message_reactions").insert({ message_id: id, emoji });
    if (error) return false;
    notifier({ type: "reaction", id, emoji }, ou);
    return true;
  }
  const { data: auth } = await sb.auth.getUser();
  const { error } = await sb
    .from("message_reactions")
    .delete()
    .eq("message_id", id)
    .eq("emoji", emoji)
    .eq("user_id", auth.user?.id ?? "");
  return !error;
}

/** Retire un message : le sien, ou n'importe lequel pour l'admin. */
export async function retirerMessage(id: number): Promise<boolean> {
  const { error } = await supabase().from("messages").delete().eq("id", id);
  return !error;
}

/** Admin : coupe la parole à un joueur au Vestiaire pendant `heures`. */
export async function couperLaParole(userId: string, heures: number): Promise<boolean> {
  const jusqu = new Date(Date.now() + heures * 3600_000).toISOString();
  const { error } = await supabase()
    .from("vestiaire_sourdines")
    .upsert({ user_id: userId, jusqu_au: jusqu }, { onConflict: "user_id" });
  return !error;
}

/* ------------------------------- Mentions ------------------------------- */

export { pseudosCites } from "@/lib/sfl/pseudos-cites";

/* ----------------------------- Lu / non lus ----------------------------- */

const LU_LOCAL = "sfl-vestiaire-lu";
export type ModeNotifs = "tout" | "cite" | "rien";

function luLocal(): number {
  try {
    return Number(localStorage.getItem(LU_LOCAL) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Jusqu'où j'ai lu, et ce que je veux en notification. */
export async function lireSuivi(): Promise<{ lu: number; notifs: ModeNotifs }> {
  const { data } = await supabase().from("vestiaire_suivi").select("lu_jusqua, notifs").maybeSingle();
  const d = data as { lu_jusqua: string; notifs: ModeNotifs } | null;
  return {
    lu: Math.max(luLocal(), d ? new Date(d.lu_jusqua).getTime() : 0),
    notifs: d?.notifs ?? "tout",
  };
}

/** J'ai lu jusqu'ici (le Vestiaire est ouvert devant moi). */
export async function marquerVestiaireLu(at = Date.now()) {
  try {
    localStorage.setItem(LU_LOCAL, String(at));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVT_LU));
  const { data: auth } = await supabase().auth.getUser();
  if (!auth.user) return;
  await supabase()
    .from("vestiaire_suivi")
    .upsert({ user_id: auth.user.id, lu_jusqua: new Date(at).toISOString() }, { onConflict: "user_id" });
}

/**
 * Le Vestiaire est sous mes yeux (vrai, redit toutes les 20 s) ou plus
 * (faux) : le serveur ne notifie pas qui le regarde.
 */
export async function direDevant(devant: boolean) {
  try {
    const { data } = await supabase().auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    await supabase()
      .from("vestiaire_suivi")
      .upsert({ user_id: uid, devant_le: devant ? new Date().toISOString() : null }, { onConflict: "user_id" });
  } catch {
    /* au pire, une notification de trop ou de moins */
  }
}

export async function reglerNotifsVestiaire(mode: ModeNotifs): Promise<boolean> {
  const { data: auth } = await supabase().auth.getUser();
  if (!auth.user) return false;
  const { error } = await supabase()
    .from("vestiaire_suivi")
    .upsert({ user_id: auth.user.id, notifs: mode }, { onConflict: "user_id" });
  return !error;
}

/**
 * Combien de messages des autres depuis ma dernière lecture (0 à 10). Qui
 * n'a jamais ouvert le Vestiaire voit ceux des trois derniers jours.
 */
export async function compterNonLus(): Promise<number> {
  const sb = supabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return 0;
  const { lu } = await lireSuivi();
  const { data, error } = await sb
    .from("messages")
    .select("id")
    .eq("canal", "sfl")
    .neq("auteur", auth.user.id)
    .gt("created_at", new Date(lu || Date.now() - 3 * 86400_000).toISOString())
    .limit(10);
  return error ? 0 : (data ?? []).length;
}

export const EVT_LU = "sfl-vestiaire-lu";

/* -------------------------------- Le salon ------------------------------- */

/**
 * Une discussion, telle que l'écran la voit (components/sfl/vestiaire.tsx) :
 * le Vestiaire de toute la ligue, ou la discussion d'un match
 * (lib/sfl/discussion-match.ts, salonDuMatch). Lire, écrire, réagir, suivre
 * le temps réel, et ce que le joueur a lu et veut en notification.
 */
export interface Salon {
  ou: Canal;
  charger(moi: string, profils: ProfilV[]): Promise<{ ok: true; messages: MessageV[] } | { ok: false; raison: string }>;
  poster(texte: string, piece: Piece | null, reponseA: number | null): Promise<Resultat>;
  reagir(id: number, emoji: Emoji, poser: boolean): Promise<boolean>;
  ecouter(onChange: () => void): () => void;
  lireSuivi(): Promise<{ lu: number; notifs: ModeNotifs }>;
  marquerLu(at?: number): Promise<void>;
  direDevant(devant: boolean): Promise<void>;
  reglerNotifs(mode: ModeNotifs): Promise<boolean>;
}

export const SALON_VESTIAIRE: Salon = {
  ou: VESTIAIRE,
  charger: (moi, profils) => chargerVestiaire(moi, profils),
  poster: (texte, piece, reponseA) => posterAuVestiaire(texte, piece, reponseA),
  reagir: (id, emoji, poser) => reagir(id, emoji, poser),
  ecouter: (onChange) => ecouterVestiaire(onChange),
  lireSuivi: () => lireSuivi(),
  marquerLu: (at) => marquerVestiaireLu(at),
  direDevant: (devant) => direDevant(devant),
  reglerNotifs: (mode) => reglerNotifsVestiaire(mode),
};

/* ------------------------------ Temps réel ------------------------------ */

let seq = 0;

/** Rappelle `onChange` à chaque message ou réaction. Renvoie l'arrêt. */
export function ecouterVestiaire(onChange: () => void): () => void {
  try {
    const sb = supabase();
    const canal = sb
      .channel(`sfl-vestiaire-${++seq}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, onChange)
      .subscribe();
    return () => {
      sb.removeChannel(canal);
    };
  } catch {
    return () => {};
  }
}

/* --------------------- Partager depuis une autre vue -------------------- */

// « Au Vestiaire » sur un classement ou une feuille de match : la pièce attend
// dans le Vestiaire, prête à partir avec une phrase pour chambrer.
const EN_ATTENTE = "sfl-vestiaire-piece";
export const EVT_PIECE = "sfl-vestiaire-piece";

export function preparerPiece(piece: Piece) {
  try {
    sessionStorage.setItem(EN_ATTENTE, JSON.stringify(piece));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVT_PIECE));
}

export function prendrePiece(): Piece | null {
  try {
    const brut = sessionStorage.getItem(EN_ATTENTE);
    sessionStorage.removeItem(EN_ATTENTE);
    const p = brut ? JSON.parse(brut) : null;
    return estPiece(p) ? p : null;
  } catch {
    return null;
  }
}
