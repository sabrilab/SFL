"use client";

// La discussion d'une équipe du mode Team (Sabri, 22/10 : « dans la
// discussion, […] discuter soit avec son match, soit son équipe »).
//
// L'écran de discussion a deux onglets, Match et Équipe
// (components/sfl/matchs/discussion-match.tsx). L'équipe, c'est celle dont
// je suis membre (une seule à la fois, lib/sfl/equipes.ts). C'est un salon
// comme le Vestiaire et la discussion d'un match (lib/sfl/vestiaire.ts,
// Salon) : la table des messages, canal 'equipe', un fil par équipe, avec
// les réponses, les réactions, les vocaux et les photos. La lisent et y
// écrivent ses membres, ceux qui ont signé le Règlement, et eux seuls
// (supabase/schema.sql, « Discussion d'équipe ») ; qui quitte l'équipe la
// perd.
//
// Ici aussi : ce que chacun a lu et veut en notification (table
// equipe_suivi), et ce que je n'ai pas lu (le nombre sur l'onglet Équipe).
// Les notifications partent de /api/equipes/discussion.
//
// Dans les aperçus Vercel et en développement, la base n'a pas encore la
// discussion des équipes : un fil d'essai tiré des membres de l'équipe la
// remplace, et rien n'est écrit.

import { supabase } from "@/lib/supabase";
import type { Equipe } from "@/lib/sfl/equipes";
import {
  chargerFil,
  poster,
  reagir,
  type Canal,
  type Emoji,
  type MessageV,
  type ModeNotifs,
  type Salon,
} from "@/lib/sfl/vestiaire";

export const DEMO_DISCUSSION_EQUIPE = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

/** Lu à l'instant (la discussion ouverte) : l'onglet recompte. */
export const EVT_LU_EQUIPE = "sfl-equipe-lu";

/** Au-delà, la pastille dit « 9+ » : inutile de compter plus loin. */
const NON_LUS_MAX = 10;

const canalDe = (equipeId: number): Canal => ({ canal: "equipe", equipeId });
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

const cleLocale = (equipeId: number) => `sfl-equipe-lu-${equipeId}`;

/** Ce que ce téléphone sait avoir lu, avant que la base ne le confirme. */
function luLocal(equipeId: number): number {
  try {
    return Number(localStorage.getItem(cleLocale(equipeId)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Jusqu'où j'ai lu la discussion de mon équipe, et ce que j'en veux en notification. */
export async function lireSuiviEquipe(equipeId: number): Promise<{ lu: number; notifs: ModeNotifs }> {
  const { data } = await supabase().from("equipe_suivi").select("lu_jusqua, notifs").eq("equipe_id", equipeId).maybeSingle();
  const d = data as { lu_jusqua: string; notifs: ModeNotifs } | null;
  return { lu: Math.max(luLocal(equipeId), d ? t(d.lu_jusqua) : 0), notifs: d?.notifs ?? "tout" };
}

/** J'ai lu jusqu'ici (la discussion est ouverte devant moi). */
export async function marquerEquipeLue(equipeId: number, at = Date.now()) {
  try {
    localStorage.setItem(cleLocale(equipeId), String(at));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVT_LU_EQUIPE));
  const uid = await monUid();
  if (!uid) return;
  await supabase()
    .from("equipe_suivi")
    .upsert({ user_id: uid, equipe_id: equipeId, lu_jusqua: new Date(at).toISOString() }, { onConflict: "user_id,equipe_id" });
}

/** La discussion est sous mes yeux (vrai, redit toutes les 20 s) ou plus : le serveur ne prévient pas qui la lit. */
export async function direDevantEquipe(equipeId: number, devant: boolean) {
  try {
    const uid = await monUid();
    if (!uid) return;
    await supabase()
      .from("equipe_suivi")
      .upsert(
        { user_id: uid, equipe_id: equipeId, devant_le: devant ? new Date().toISOString() : null },
        { onConflict: "user_id,equipe_id" }
      );
  } catch {
    /* au pire, une notification de trop ou de moins */
  }
}

export async function reglerNotifsEquipe(equipeId: number, mode: ModeNotifs): Promise<boolean> {
  const uid = await monUid();
  if (!uid) return false;
  const { error } = await supabase()
    .from("equipe_suivi")
    .upsert({ user_id: uid, equipe_id: equipeId, notifs: mode }, { onConflict: "user_id,equipe_id" });
  return !error;
}

/* ------------------------------- Temps réel ------------------------------ */

let seq = 0;

/** Rappelle `onChange` à chaque message de l'équipe, retrait ou réaction. Renvoie l'arrêt. */
export function ecouterEquipe(equipeId: number, onChange: () => void): () => void {
  try {
    const sb = supabase();
    const canal = sb
      .channel(`sfl-equipe-${equipeId}-${++seq}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `equipe_id=eq.${equipeId}` }, onChange)
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

/** La discussion d'une équipe, telle que l'écran de discussion la voit (components/sfl/vestiaire.tsx). */
export function salonDeLEquipe(equipeId: number): Salon {
  const ou = canalDe(equipeId);
  return {
    ou,
    charger: (moi, profils) => chargerFil(ou, moi, profils),
    poster: (texte, piece, reponseA) => poster(ou, texte, piece, reponseA),
    reagir: (id, emoji, poser) => reagir(id, emoji, poser, ou),
    ecouter: (onChange) => ecouterEquipe(equipeId, onChange),
    lireSuivi: () => lireSuiviEquipe(equipeId),
    marquerLu: (at) => marquerEquipeLue(equipeId, at),
    direDevant: (devant) => direDevantEquipe(equipeId, devant),
    reglerNotifs: (mode) => reglerNotifsEquipe(equipeId, mode),
  };
}

/* ------------------------------- Non lus -------------------------------- */

/** Ce que les autres ont écrit depuis ma dernière lecture, et depuis que je suis de l'équipe. */
function compter(equipe: Equipe, messages: { auteur: string; at: number }[], moi: string, lu: number): number {
  const arrive = equipe.membres.find((m) => m.id === moi)?.depuis;
  const depuis = Math.max(lu, arrive ? t(arrive) : 0);
  return Math.min(NON_LUS_MAX, messages.filter((m) => m.auteur !== moi && m.at > depuis).length);
}

/** Les messages de mon équipe que je n'ai pas lus, dix au plus (« 9+ »). */
export async function nonLusEquipe(equipe: Equipe, moi: string): Promise<number> {
  const sb = supabase();
  const [suivi, r] = await Promise.all([
    sb.from("equipe_suivi").select("lu_jusqua").eq("equipe_id", equipe.id).maybeSingle(),
    sb
      .from("messages")
      .select("auteur, created_at")
      .eq("canal", "equipe")
      .eq("equipe_id", equipe.id)
      .order("created_at", { ascending: false })
      .limit(NON_LUS_MAX + 2),
  ]);
  const base = (suivi.data as { lu_jusqua: string } | null)?.lu_jusqua;
  const lu = Math.max(luLocal(equipe.id), base ? t(base) : 0);
  if (r.error) {
    if (!DEMO_DISCUSSION_EQUIPE) return 0;
    return compter(equipe, filDemoEquipe(equipe, moi).map((m) => ({ auteur: m.auteurId, at: m.at })), moi, lu);
  }
  const messages = ((r.data ?? []) as { auteur: string; created_at: string }[]).map((b) => ({ auteur: b.auteur, at: t(b.created_at) }));
  return compter(equipe, messages, moi, lu);
}

/** Rappelle `onChange` à chaque message d'une équipe, et quand j'entre dans une équipe ou en sors. */
export function ecouterMonEquipe(moi: string, onChange: () => void): () => void {
  try {
    const sb = supabase();
    const canal = sb
      .channel(`sfl-mon-equipe-${++seq}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "canal=eq.equipe" }, onChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "equipe_membres", filter: `joueur=eq.${moi}` }, onChange)
      .subscribe();
    return () => {
      sb.removeChannel(canal);
    };
  } catch {
    return () => {};
  }
}

/* ------------------------------ Fil d'essai ----------------------------- */

/**
 * Aperçus et développement : quatre ou cinq messages tirés des membres de
 * l'équipe — qui est dispo, le terrain réservé. Rien n'est écrit.
 */
export function filDemoEquipe(equipe: Equipe, moi: string | null): MessageV[] {
  const membres = equipe.membres.filter((m) => m.statut === "membre");
  const nom = new Map(membres.map((m) => [m.id, m.name]));
  const autres = membres.filter((m) => m.id !== moi);
  if (autres.length === 0) return [];
  const capitaine = autres.find((m) => m.role === "capitaine") ?? autres[0];
  const [b, c] = autres.filter((m) => m !== capitaine).map((m) => m.id);
  const a = capitaine.id;

  const lignes: [string, string, Partial<Record<Emoji, string[]>>][] = [[a, "Qui est dispo jeudi soir ? On cale un five", {}]];
  if (b) lignes.push([b, "Moi je suis là", {}]);
  if (c) lignes.push([c, "Je peux à partir de 20h", {}]);
  lignes.push([a, "Ok 20h, je réserve le terrain", b ? { "🔥": [b] } : {}]);
  if (b) lignes.push([b, "Je ramène les chasubles", c ? { "😂": [c] } : {}]);

  // Le dernier message il y a six minutes, les autres toutes les onze.
  const t0 = Date.now() - ((lignes.length - 1) * 11 + 6) * 60_000;
  return lignes.map(([auteur, texte, reactions], i) => ({
    // Des identifiants négatifs : jamais ceux d'un vrai message.
    id: -(i + 1),
    auteurId: auteur,
    auteur: nom.get(auteur) ?? "",
    texte,
    piece: null,
    at: t0 + i * 11 * 60_000,
    mien: auteur === moi,
    reponseA: null,
    reactions,
  }));
}
