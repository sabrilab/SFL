"use client";

// La discussion d'un match ouvert par un joueur (Sabri, 22/10 : « quand des
// joueurs rejoignent un match, qu'ils puissent se parler entre eux, demander
// s'ils ne connaissent pas de joueurs à inviter »).
//
// C'est un salon comme le Vestiaire (lib/sfl/vestiaire.ts, Salon) : la table
// des messages, canal 'match', un fil par match, avec les réponses, les
// réactions, les vocaux et les photos. La lisent et y écrivent ceux du
// match — l'organisateur, les inscrits, les invités — et eux seuls : la base
// y veille (supabase/schema.sql, « Discussion de match »). Qui quitte le
// match perd la discussion ; le match annulé l'emporte.
//
// Ici aussi :
//   · ce que chacun a lu et veut en notification (table match_suivi) ;
//   · ce que la Map en montre (chargerApercus) : les derniers messages, en
//     pilules au-dessus de la carte du match, et combien ne sont pas lus ;
//   · l'arrivée d'un joueur (annoncerArrivee) : la ligne « Kader a rejoint
//     le match », posée quand il prend une place ou accepte l'invitation, et
//     dont le serveur prévient les autres (/api/matchs/discussion).
//
// Dans les aperçus Vercel et en développement, la base n'a pas encore la
// discussion des matchs : la Map et l'écran montrent un fil d'essai
// (discussion-match-demo.ts), et rien n'est écrit.

import { supabase } from "@/lib/supabase";
import { aujourdhuiIso, listerParties } from "@/lib/sfl/matchs";
import { DEMO_DISCUSSION, filDemo } from "@/lib/sfl/discussion-match-demo";
import {
  chargerFil,
  estPiece,
  notifier,
  poster,
  reagir,
  type Canal,
  type ModeNotifs,
  type Piece,
  type Salon,
} from "@/lib/sfl/vestiaire";

/** Lu à l'instant (la discussion ouverte) : la Map et la barre recomptent. */
export const EVT_LU_MATCH = "sfl-match-lu";

const canalDe = (matchId: number): Canal => ({ canal: "match", matchId });
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

const cleLocale = (matchId: number) => `sfl-match-lu-${matchId}`;

/** Ce que ce téléphone sait avoir lu, avant que la base ne le confirme. */
function luLocal(matchId: number): number {
  try {
    return Number(localStorage.getItem(cleLocale(matchId)) ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Jusqu'où j'ai lu la discussion de ce match, et ce que j'en veux en notification. */
export async function lireSuiviMatch(matchId: number): Promise<{ lu: number; notifs: ModeNotifs }> {
  const { data } = await supabase().from("match_suivi").select("lu_jusqua, notifs").eq("match_id", matchId).maybeSingle();
  const d = data as { lu_jusqua: string; notifs: ModeNotifs } | null;
  return { lu: Math.max(luLocal(matchId), d ? t(d.lu_jusqua) : 0), notifs: d?.notifs ?? "tout" };
}

/** J'ai lu jusqu'ici (la discussion est ouverte devant moi). */
export async function marquerMatchLu(matchId: number, at = Date.now()) {
  try {
    localStorage.setItem(cleLocale(matchId), String(at));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVT_LU_MATCH));
  const uid = await monUid();
  if (!uid) return;
  await supabase()
    .from("match_suivi")
    .upsert({ user_id: uid, match_id: matchId, lu_jusqua: new Date(at).toISOString() }, { onConflict: "user_id,match_id" });
}

/** La discussion est sous mes yeux (vrai, redit toutes les 20 s) ou plus : le serveur ne prévient pas qui la lit. */
export async function direDevantMatch(matchId: number, devant: boolean) {
  try {
    const uid = await monUid();
    if (!uid) return;
    await supabase()
      .from("match_suivi")
      .upsert({ user_id: uid, match_id: matchId, devant_le: devant ? new Date().toISOString() : null }, { onConflict: "user_id,match_id" });
  } catch {
    /* au pire, une notification de trop ou de moins */
  }
}

export async function reglerNotifsMatch(matchId: number, mode: ModeNotifs): Promise<boolean> {
  const uid = await monUid();
  if (!uid) return false;
  const { error } = await supabase()
    .from("match_suivi")
    .upsert({ user_id: uid, match_id: matchId, notifs: mode }, { onConflict: "user_id,match_id" });
  return !error;
}

/* ------------------------------- Temps réel ------------------------------ */

let seq = 0;

/** Rappelle `onChange` à chaque message de ce match, retrait ou réaction. Renvoie l'arrêt. */
export function ecouterMatch(matchId: number, onChange: () => void): () => void {
  try {
    const sb = supabase();
    const canal = sb
      .channel(`sfl-match-${matchId}-${++seq}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` }, onChange)
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

/** Rappelle `onChange` à chaque message d'un match, et quand j'entre dans un match ou en sors. */
export function ecouterDiscussions(moi: string, onChange: () => void): () => void {
  try {
    const sb = supabase();
    const canal = sb
      .channel(`sfl-discussions-${++seq}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "canal=eq.match" }, onChange)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_joueurs", filter: `player_id=eq.${moi}` }, onChange)
      .subscribe();
    return () => {
      sb.removeChannel(canal);
    };
  } catch {
    return () => {};
  }
}

/* -------------------------------- Le salon ------------------------------- */

/** La discussion d'un match, telle que l'écran de discussion la voit (components/sfl/vestiaire.tsx). */
export function salonDuMatch(matchId: number): Salon {
  const ou = canalDe(matchId);
  return {
    ou,
    charger: (moi, profils) => chargerFil(ou, moi, profils),
    poster: (texte, piece, reponseA) => poster(ou, texte, piece, reponseA),
    reagir: (id, emoji, poser) => reagir(id, emoji, poser, ou),
    ecouter: (onChange) => ecouterMatch(matchId, onChange),
    lireSuivi: () => lireSuiviMatch(matchId),
    marquerLu: (at) => marquerMatchLu(matchId, at),
    direDevant: (devant) => direDevantMatch(matchId, devant),
    reglerNotifs: (mode) => reglerNotifsMatch(matchId, mode),
  };
}

/* ------------------------------- L'arrivée ------------------------------- */

const SIX_HEURES = 6 * 3600_000;

/**
 * Ma ligne « … a rejoint le match », puis le serveur prévient les autres. Une
 * fois par match sur six heures (qui sort et revient ne se réannonce pas).
 * Sans jamais bloquer le geste : une arrivée non annoncée reste une arrivée.
 */
export async function annoncerArrivee(matchId: number): Promise<void> {
  try {
    const uid = await monUid();
    if (!uid) return;
    const sb = supabase();
    const { data: deja, error } = await sb
      .from("messages")
      .select("id")
      .eq("canal", "match")
      .eq("match_id", matchId)
      .eq("auteur", uid)
      .eq("piece->>type", "rejoint")
      .gt("created_at", new Date(Date.now() - SIX_HEURES).toISOString())
      .limit(1);
    // Avant la migration (les aperçus), match_id n'existe pas : rien à poser.
    if (error || (deja ?? []).length > 0) return;
    const { data, error: e2 } = await sb
      .from("messages")
      .insert({ canal: "match", match_id: matchId, auteur: uid, destinataire: null, texte: "", piece: { type: "rejoint" } })
      .select("id")
      .single();
    if (e2 || !data) return;
    notifier({ type: "message", id: (data as { id: number }).id }, canalDe(matchId));
  } catch {
    /* rien de grave */
  }
}

/**
 * Les lignes « … a rejoint le match » qui disent encore vrai : celle de qui
 * est toujours du match, et pour qui est sorti puis revenu, la dernière.
 */
export function arriveesVisibles<M extends { id: number; auteurId: string; piece: Piece | null }>(
  messages: M[],
  dansLeMatch: Set<string>
): M[] {
  const derniere = new Map<string, number>();
  for (const m of messages) if (m.piece?.type === "rejoint") derniere.set(m.auteurId, m.id);
  return messages.filter((m) => m.piece?.type !== "rejoint" || (dansLeMatch.has(m.auteurId) && derniere.get(m.auteurId) === m.id));
}

/* ------------------------------ Les aperçus ------------------------------ */

export interface ApercuMessage {
  id: number;
  auteurId: string;
  texte: string;
  piece: Piece | null;
  at: number;
  mien: boolean;
}

export interface ApercuDiscussion {
  matchId: number;
  /** Les derniers messages, du plus ancien au plus récent (huit au plus). */
  derniers: ApercuMessage[];
  /** Ceux des autres que je n'ai pas lus, dix au plus. Un invité lit sans compter : 0. */
  nonLus: number;
  /** Jusqu'où j'ai lu (ms). */
  lu: number;
}

const DERNIERS = 8;
/** Au-delà, la pastille dit « 9+ » : inutile de compter plus loin. */
const NON_LUS_MAX = 10;

interface Brut {
  id: number;
  auteur: string;
  texte: string;
  piece?: unknown;
  created_at: string;
}

function apercu(matchId: number, statut: "invite" | "inscrit", messages: ApercuMessage[], lu: number): ApercuDiscussion {
  const nonLus = statut === "inscrit" ? messages.filter((m) => !m.mien && m.at > lu).length : 0;
  return { matchId, derniers: messages.slice(-DERNIERS), nonLus: Math.min(NON_LUS_MAX, nonLus), lu };
}

/**
 * Les discussions de mes matchs à venir (j'en suis : organisateur, inscrit ou
 * invité) : par match, ses derniers messages et ce que je n'ai pas lu.
 */
export async function chargerApercus(moi: string): Promise<Map<number, ApercuDiscussion>> {
  const sb = supabase();
  const { data: places, error } = await sb
    .from("match_joueurs")
    .select("match_id, statut, matchs!inner(jour)")
    .eq("player_id", moi)
    .gte("matchs.jour", aujourdhuiIso());
  if (error) return new Map();
  const statuts = new Map(((places ?? []) as { match_id: number; statut: "invite" | "inscrit" }[]).map((p) => [p.match_id, p.statut]));
  if (statuts.size === 0) return new Map();

  const { data: suivis } = await sb.from("match_suivi").select("match_id, lu_jusqua").in("match_id", [...statuts.keys()]);
  const luBase = new Map(((suivis ?? []) as { match_id: number; lu_jusqua: string }[]).map((s) => [s.match_id, t(s.lu_jusqua)]));
  const luDe = (id: number) => Math.max(luLocal(id), luBase.get(id) ?? 0);

  // Un match à la fois : douze messages suffisent pour les pilules et pour
  // compter jusqu'à dix non lus.
  const fils = await Promise.all(
    [...statuts.keys()].map(async (id) => {
      const r = await sb
        .from("messages")
        .select("id, auteur, texte, piece, created_at")
        .eq("canal", "match")
        .eq("match_id", id)
        .order("created_at", { ascending: false })
        .limit(DERNIERS + 4);
      return { id, r };
    })
  );
  if (fils.some(({ r }) => r.error)) return DEMO_DISCUSSION ? apercusDemo(moi, statuts, luDe) : new Map();

  const res = new Map<number, ApercuDiscussion>();
  for (const { id, r } of fils) {
    const messages = ((r.data ?? []) as Brut[])
      .map((b) => ({
        id: b.id,
        auteurId: b.auteur,
        texte: b.texte,
        piece: estPiece(b.piece) ? b.piece : null,
        at: t(b.created_at),
        mien: b.auteur === moi,
      }))
      .reverse();
    if (messages.length > 0) res.set(id, apercu(id, statuts.get(id)!, messages, luDe(id)));
  }
  return res;
}

/** Aperçus et développement : le fil d'essai de chacun de mes matchs. */
async function apercusDemo(
  moi: string,
  statuts: Map<number, "invite" | "inscrit">,
  luDe: (id: number) => number
): Promise<Map<number, ApercuDiscussion>> {
  const parties = await listerParties().catch(() => []);
  const res = new Map<number, ApercuDiscussion>();
  for (const p of parties) {
    const statut = statuts.get(p.id);
    if (!statut) continue;
    const messages = filDemo(p, moi).map(({ id, auteurId, texte, piece, at, mien }) => ({ id, auteurId, texte, piece, at, mien }));
    if (messages.length > 0) res.set(p.id, apercu(p.id, statut, messages, luDe(p.id)));
  }
  return res;
}
