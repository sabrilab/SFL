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
export type Piece = PieceCarte | PieceFeuille | PieceClassement | PieceVocal;

export function estPiece(v: unknown): v is Piece {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  if (p.type === "carte") return typeof p.joueur === "string" && p.joueur.length > 0;
  if (p.type === "feuille") return typeof p.j === "number";
  if (p.type === "classement")
    return typeof p.id === "string" && Array.isArray(p.top) && p.top.length <= 3;
  if (p.type === "vocal") return typeof p.chemin === "string" && typeof p.duree === "number";
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

function expliquer(message: string): string {
  if (/jwt|token|not authenticated|auth session/i.test(message))
    return "Ta session a expiré. Déconnecte-toi puis reconnecte-toi.";
  if (/row-level security|violates/i.test(message)) return "L'admin t'a coupé la parole pour l'instant.";
  return "Le Vestiaire ne répond pas. Réessaie dans un instant.";
}

export async function chargerVestiaire(
  moi: string,
  profils: ProfilV[],
  limite = 200
): Promise<{ ok: true; messages: MessageV[] } | { ok: false; raison: string }> {
  const sb = supabase();
  // Avant la migration (les aperçus), la colonne piece n'existe pas encore :
  // on relit sans elle plutôt que de laisser le Vestiaire vide.
  const lire = (colonnes: string) =>
    sb.from("messages").select(colonnes).eq("canal", "sfl").order("created_at", { ascending: false }).limit(limite);
  let r = await lire("id, auteur, texte, piece, reponse_a, created_at");
  if (r.error && /reponse_a/.test(r.error.message)) r = await lire("id, auteur, texte, piece, created_at");
  if (r.error && /piece/.test(r.error.message)) r = await lire("id, auteur, texte, created_at");
  if (r.error) return { ok: false, raison: expliquer(r.error.message) };
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
export function blocageVestiaire(): string | null {
  const session = getSession();
  if (!session) return "Connecte-toi pour parler au Vestiaire.";
  if (!session.server) return "Déconnecte-toi puis reconnecte-toi pour écrire au Vestiaire.";
  return null;
}

/** Demande au serveur de prévenir qui doit l'être. Sans attendre ni échouer. */
function notifier(corps: { type: "message"; id: number } | { type: "reaction"; id: number; emoji: Emoji }) {
  void (async () => {
    try {
      const { data } = await supabase().auth.getSession();
      const jeton = data.session?.access_token;
      if (!jeton) return;
      await fetch("/api/vestiaire/notifier", {
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

export async function posterAuVestiaire(texte: string, piece: Piece | null, reponseA: number | null = null): Promise<Resultat> {
  const propre = texte.trim();
  if (!propre && !piece) return { ok: false, raison: "Message vide." };
  if (propre.length > 2000) return { ok: false, raison: "Message trop long." };
  const empeche = blocageVestiaire();
  if (empeche) return { ok: false, raison: empeche };
  try {
    const sb = supabase();
    const { data: auth } = await sb.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return { ok: false, raison: expliquer("jwt") };
    const ligne: Record<string, unknown> = { canal: "sfl", auteur: uid, destinataire: null, texte: propre };
    if (piece) ligne.piece = piece;
    if (reponseA) ligne.reponse_a = reponseA;
    const { data, error } = await sb.from("messages").insert(ligne).select("id").single();
    if (error) return { ok: false, raison: expliquer(error.message) };
    notifier({ type: "message", id: (data as { id: number }).id });
    return { ok: true };
  } catch {
    return { ok: false, raison: expliquer("") };
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

const liensVocaux = new Map<string, Promise<string | null>>();

/** Le lien d'écoute d'un vocal (signé une heure, gardé en mémoire). */
export function lienVocal(chemin: string): Promise<string | null> {
  let lien = liensVocaux.get(chemin);
  if (!lien) {
    lien = supabase()
      .storage.from(BUCKET_VOCAUX)
      .createSignedUrl(chemin, 3600)
      .then(({ data }) => data?.signedUrl ?? null);
    liensVocaux.set(chemin, lien);
    setTimeout(() => liensVocaux.delete(chemin), 50 * 60_000);
  }
  return lien;
}

/** Pose ou retire ma réaction. */
export async function reagir(id: number, emoji: Emoji, poser: boolean): Promise<boolean> {
  const sb = supabase();
  if (poser) {
    const { error } = await sb.from("message_reactions").insert({ message_id: id, emoji });
    if (error) return false;
    notifier({ type: "reaction", id, emoji });
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
