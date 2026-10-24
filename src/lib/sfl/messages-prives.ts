"use client";

// Les messages privés entre joueurs (Sabri, 24/10 : « Permets aussi que les
// joueurs puissent envoyer des messages privés »).
//
// Une conversation à deux, c'est un salon comme le Vestiaire, la discussion
// d'un match ou celle d'une équipe (lib/sfl/vestiaire.ts, Salon) : la table
// des messages, canal 'dm', avec son destinataire. Mêmes bulles, réponses,
// réactions, vocaux et photos. La base ne la rend qu'à ses deux joueurs, pas
// même à l'admin, et refuse d'écrire à qui m'a bloqué ou que j'ai bloqué
// (supabase/schema.sql, « Messages privés »).
//
// Ici : la liste de mes conversations (/messages), chacune avec son dernier
// message et ce que je n'en ai pas lu ; ce que j'ai lu et veux en
// notification dans chacune (table prive_suivi) ; le blocage. La
// notification part de /api/prives/notifier, au seul destinataire.
//
// Hors production (développement et aperçus Vercel), ?demo=prives montre
// des conversations d'essai tirées de l'effectif, sans rien lire ni écrire.

import { supabase } from "@/lib/supabase";
import {
  chargerFil,
  poster,
  reagir,
  type Canal,
  type Emoji,
  type MessageV,
  type ModeNotifs,
  type Piece,
  type ProfilV,
  type Salon,
} from "@/lib/sfl/vestiaire";

export const DEMO_PRIVES = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

/** Une conversation lue à l'instant : la pastille recompte. */
export const EVT_LU_PRIVE = "sfl-prive-lu";

/** Au-delà, la pastille d'une conversation dit « 9+ ». */
const NON_LUS_MAX = 10;
/** Assez pour trouver chaque conversation récente et son dernier message. */
const LECTURE_MAX = 600;

const canalAvec = (avec: string): Canal => ({ canal: "dm", avec });
const t = (iso: string) => new Date(iso).getTime();

async function monUid(): Promise<string | null> {
  try {
    const { data } = await supabase().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/* ----------------------------- Lu / réglages ---------------------------- */

const cleLocale = (avec: string) => `sfl-prive-lu-${avec}`;

/** Ce que ce téléphone sait avoir lu, avant que la base ne le confirme. */
function luLocal(avec: string): number {
  try {
    return Number(localStorage.getItem(cleLocale(avec)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export async function lireSuiviPrive(avec: string): Promise<{ lu: number; notifs: ModeNotifs }> {
  const { data } = await supabase().from("prive_suivi").select("lu_jusqua, notifs").eq("autre", avec).maybeSingle();
  const d = data as { lu_jusqua: string; notifs: ModeNotifs } | null;
  return { lu: Math.max(luLocal(avec), d ? t(d.lu_jusqua) : 0), notifs: d?.notifs ?? "tout" };
}

export async function marquerPriveLu(avec: string, at = Date.now()) {
  try {
    localStorage.setItem(cleLocale(avec), String(at));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVT_LU_PRIVE));
  const uid = await monUid();
  if (!uid) return;
  await supabase()
    .from("prive_suivi")
    .upsert({ user_id: uid, autre: avec, lu_jusqua: new Date(at).toISOString() }, { onConflict: "user_id,autre" });
}

/** La conversation est sous mes yeux (vrai, redit toutes les 20 s) ou plus : le serveur ne prévient pas qui la lit. */
export async function direDevantPrive(avec: string, devant: boolean) {
  try {
    const uid = await monUid();
    if (!uid) return;
    await supabase()
      .from("prive_suivi")
      .upsert({ user_id: uid, autre: avec, devant_le: devant ? new Date().toISOString() : null }, { onConflict: "user_id,autre" });
  } catch {
    /* au pire, une notification de trop ou de moins */
  }
}

export async function reglerNotifsPrive(avec: string, mode: ModeNotifs): Promise<boolean> {
  const uid = await monUid();
  if (!uid) return false;
  const { error } = await supabase()
    .from("prive_suivi")
    .upsert({ user_id: uid, autre: avec, notifs: mode }, { onConflict: "user_id,autre" });
  return !error;
}

/* ------------------------------- Temps réel ------------------------------ */

let seq = 0;

/**
 * Rappelle `onChange` à chaque message privé (la base ne m'envoie que les
 * miens), retrait ou réaction. Renvoie l'arrêt.
 */
export function ecouterPrives(onChange: () => void): () => void {
  try {
    const sb = supabase();
    const canal = sb
      .channel(`sfl-prives-${++seq}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "canal=eq.dm" }, onChange)
      // Un retrait ne se filtre pas (la ligne n'est plus là) : on relit.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, onChange)
      .subscribe();
    return () => {
      sb.removeChannel(canal);
    };
  } catch {
    return () => {};
  }
}

/* -------------------------------- Le salon ------------------------------- */

/** Une conversation, telle que l'écran de discussion la voit (components/sfl/vestiaire.tsx). */
export function salonPrive(avec: string): Salon {
  const ou = canalAvec(avec);
  return {
    ou,
    charger: (moi, profils) => chargerFil(ou, moi, profils),
    poster: (texte, piece, reponseA) => poster(ou, texte, piece, reponseA),
    reagir: (id, emoji, poser) => reagir(id, emoji, poser, ou),
    ecouter: (onChange) => ecouterPrives(onChange),
    lireSuivi: () => lireSuiviPrive(avec),
    marquerLu: (at) => marquerPriveLu(avec, at),
    direDevant: (devant) => direDevantPrive(avec, devant),
    reglerNotifs: (mode) => reglerNotifsPrive(avec, mode),
  };
}

/* ---------------------------- Mes conversations -------------------------- */

export interface Conversation {
  /** L'autre joueur (profiles.id). */
  avec: string;
  dernier: { texte: string; piece: Piece | null; at: number; mien: boolean };
  /** Ce qu'il m'a écrit depuis ma dernière lecture, dix au plus. */
  nonLus: number;
}

interface Brut {
  auteur: string;
  destinataire: string;
  texte: string;
  piece?: unknown;
  created_at: string;
}

/** Mes conversations, la plus récente en haut ; null si la base ne répond pas. */
export async function chargerConversations(moi: string): Promise<Conversation[] | null> {
  const sb = supabase();
  const [r, suivis] = await Promise.all([
    sb
      .from("messages")
      .select("auteur, destinataire, texte, piece, created_at")
      .eq("canal", "dm")
      .order("created_at", { ascending: false })
      .limit(LECTURE_MAX),
    sb.from("prive_suivi").select("autre, lu_jusqua"),
  ]);
  if (r.error) return null;
  const lu = new Map(((suivis.data ?? []) as { autre: string; lu_jusqua: string }[]).map((s) => [s.autre, t(s.lu_jusqua)]));
  const parAutre = new Map<string, Conversation>();
  for (const b of (r.data ?? []) as Brut[]) {
    const mien = b.auteur === moi;
    const avec = mien ? b.destinataire : b.auteur;
    if (!avec) continue;
    let c = parAutre.get(avec);
    if (!c) {
      c = { avec, dernier: { texte: b.texte, piece: (b.piece as Piece | null) ?? null, at: t(b.created_at), mien }, nonLus: 0 };
      parAutre.set(avec, c);
    }
    const depuis = Math.max(lu.get(avec) ?? 0, luLocal(avec));
    if (!mien && t(b.created_at) > depuis && c.nonLus < NON_LUS_MAX) c.nonLus++;
  }
  return [...parAutre.values()];
}

/** Ce que je n'ai pas lu, toutes conversations comprises (la bulle du Vestiaire, l'icône de l'app). */
export async function nonLusPrives(moi: string): Promise<number> {
  const cs = await chargerConversations(moi);
  return (cs ?? []).reduce((n, c) => n + c.nonLus, 0);
}

/* -------------------------------- Blocage -------------------------------- */

/** L'ai-je bloqué ? (Jamais : m'a-t-il bloqué — la base ne le dit à personne.) */
export async function estBloque(avec: string): Promise<boolean> {
  const { data } = await supabase().from("prive_blocages").select("bloque").eq("bloque", avec).maybeSingle();
  return !!data;
}

export async function bloquer(avec: string): Promise<boolean> {
  const { error } = await supabase().from("prive_blocages").insert({ bloque: avec });
  return !error || /duplicate/i.test(error.message);
}

export async function debloquer(avec: string): Promise<boolean> {
  const { error } = await supabase().from("prive_blocages").delete().eq("bloque", avec);
  return !error;
}

/* ------------------------------ Fil d'essai ----------------------------- */

/** Aperçus : trois conversations tirées de l'effectif (identifiants = noms). Rien n'est lu ni écrit. */
export function conversationsDemo(noms: string[]): Conversation[] {
  const [a, b, c] = noms;
  const maintenant = Date.now();
  const lignes: [string | undefined, string, number, boolean, number][] = [
    [a, "Tu viens dimanche ? Il nous manque un défenseur", 4, false, 2],
    [b, "Ok je te passe les chasubles", 95, true, 0],
    [c, "Bien joué pour le but 🔥", 26 * 60, false, 0],
  ];
  return lignes
    .filter((l): l is [string, string, number, boolean, number] => !!l[0])
    .map(([avec, texte, il_y_a, mien, nonLus]) => ({
      avec,
      dernier: { texte, piece: null, at: maintenant - il_y_a * 60_000, mien },
      nonLus,
    }));
}

/** Aperçus : le fil d'une conversation avec `nom`, moi = « moi ». */
export function filDemoPrive(nom: string): MessageV[] {
  const lignes: [boolean, string, Partial<Record<Emoji, string[]>>][] = [
    [false, "Wesh, t'as vu le classement ?", {}],
    [true, "Grave, je remonte 4e 😤", { "🔥": [nom] }],
    [false, "Tu viens dimanche ? Il nous manque un défenseur", {}],
  ];
  const t0 = Date.now() - ((lignes.length - 1) * 7 + 4) * 60_000;
  return lignes.map(([mien, texte, reactions], i) => ({
    id: -(i + 1),
    auteurId: mien ? "moi" : nom,
    auteur: mien ? "" : nom,
    texte,
    piece: null,
    at: t0 + i * 7 * 60_000,
    mien,
    reponseA: null,
    reactions,
  }));
}

/** Le nom d'un profil pour la liste (le nom de saison, la clé des cartes). */
export function nomDuProfil(profils: ProfilV[], id: string): string {
  return profils.find((p) => p.id === id)?.name ?? "";
}
