// Les messages pas encore lus de chaque joueur, pour la pastille rouge de
// l'icône de l'app (le nombre que porte la notification : public/sw.js) :
// ceux du Vestiaire, ceux des discussions de ses matchs à venir, là où il
// joue (organisateur ou inscrit ; un invité lit sans compter), ceux de la
// discussion de son équipe (mode Team), et ceux de ses messages privés.
//
// Le même compte que l'app (hooks/use-vestiaire-non-lus.ts,
// hooks/use-discussions-match.ts et hooks/use-mon-equipe.ts, additionnés par
// la barre d'onglets), aux bornes près : trois jours au plus pour le
// Vestiaire, dix messages au plus par match et pour l'équipe. Partagé par
// les routes qui préviennent : /api/vestiaire/notifier,
// /api/matchs/discussion et /api/equipes/discussion.
//
// SERVEUR UNIQUEMENT : il lit les messages de tout le monde (clé secrète).

import type { SupabaseClient } from "@supabase/supabase-js";
import { idsSfl } from "./parrainage.server";

const JOUR = 86_400_000;
/** Par match : au-delà, la pastille de l'app dit déjà « 9+ ». */
export const NON_LUS_MAX_PAR_MATCH = 10;

interface Ecrit {
  auteur: string;
  created_at: string;
}

export async function nonLus(sb: SupabaseClient, uids: string[], maintenant = Date.now()): Promise<Map<string, number>> {
  const n = new Map(uids.map((u) => [u, 0]));
  if (uids.length === 0) return n;
  const t = (iso: string) => new Date(iso).getTime();
  await Promise.all([nonLusEquipes(sb, uids, n, t), nonLusPrives(sb, uids, n, t)]);

  // Le Vestiaire : ce que les autres ont écrit depuis ma dernière lecture,
  // trois jours au plus (qui ne l'a jamais ouvert voit ces trois jours-là).
  // Pour la SFL seulement : un joueur Bola (venu par un parrain) ne le lit pas.
  const depuis = new Date(maintenant - 3 * JOUR).toISOString();
  const [{ data: lus }, { data: recents }, sfl] = await Promise.all([
    sb.from("vestiaire_suivi").select("user_id, lu_jusqua").in("user_id", uids),
    sb.from("messages").select("auteur, created_at").eq("canal", "sfl").gt("created_at", depuis),
    idsSfl(sb),
  ]);
  const luV = new Map(((lus ?? []) as { user_id: string; lu_jusqua: string }[]).map((s) => [s.user_id, t(s.lu_jusqua)]));
  for (const uid of uids) {
    if (sfl && !sfl.has(uid)) continue;
    const lu = luV.get(uid) ?? 0;
    n.set(uid, (n.get(uid) ?? 0) + ((recents ?? []) as Ecrit[]).filter((m) => m.auteur !== uid && t(m.created_at) > lu).length);
  }

  // Les matchs à venir où il joue : ce que les autres y ont écrit depuis sa
  // dernière lecture (tout le fil, s'il ne l'a jamais ouvert).
  const aujourdhui = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date(maintenant));
  const { data: places, error } = await sb
    .from("match_joueurs")
    .select("match_id, player_id, matchs!inner(jour)")
    .in("player_id", uids)
    .eq("statut", "inscrit")
    .gte("matchs.jour", aujourdhui);
  const lignes = (places ?? []) as { match_id: number; player_id: string }[];
  const ids = [...new Set(lignes.map((l) => l.match_id))];
  if (error || ids.length === 0) return n;
  const [{ data: suivis }, { data: fils, error: e2 }] = await Promise.all([
    sb.from("match_suivi").select("user_id, match_id, lu_jusqua").in("user_id", uids).in("match_id", ids),
    sb
      .from("messages")
      .select("match_id, auteur, created_at")
      .eq("canal", "match")
      .in("match_id", ids)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  // Avant la migration (match_id absent), seul le Vestiaire compte.
  if (e2) return n;
  const luM = new Map(
    ((suivis ?? []) as { user_id: string; match_id: number; lu_jusqua: string }[]).map((s) => [`${s.user_id}:${s.match_id}`, t(s.lu_jusqua)])
  );
  for (const l of lignes) {
    const lu = luM.get(`${l.player_id}:${l.match_id}`) ?? 0;
    const k = ((fils ?? []) as (Ecrit & { match_id: number })[]).filter(
      (m) => m.match_id === l.match_id && m.auteur !== l.player_id && t(m.created_at) > lu
    ).length;
    n.set(l.player_id, (n.get(l.player_id) ?? 0) + Math.min(NON_LUS_MAX_PAR_MATCH, k));
  }
  return n;
}

/**
 * La discussion de son équipe : ce que les autres membres y ont écrit depuis
 * sa dernière lecture, et depuis qu'il en est (pas l'histoire d'avant lui).
 * Ajouté au compte `n`. Avant la migration (equipe_id absent), rien.
 */
async function nonLusEquipes(sb: SupabaseClient, uids: string[], n: Map<string, number>, t: (iso: string) => number) {
  const { data: places, error } = await sb
    .from("equipe_membres")
    .select("equipe_id, joueur, created_at, equipes!inner(dissoute_le)")
    .in("joueur", uids)
    .eq("statut", "membre")
    .is("equipes.dissoute_le", null);
  const lignes = (places ?? []) as { equipe_id: number; joueur: string; created_at: string }[];
  const ids = [...new Set(lignes.map((l) => l.equipe_id))];
  if (error || ids.length === 0) return;
  const [{ data: suivis }, { data: fils, error: e2 }] = await Promise.all([
    sb.from("equipe_suivi").select("user_id, equipe_id, lu_jusqua").in("user_id", uids).in("equipe_id", ids),
    sb
      .from("messages")
      .select("equipe_id, auteur, created_at")
      .eq("canal", "equipe")
      .in("equipe_id", ids)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  if (e2) return;
  const lu = new Map(
    ((suivis ?? []) as { user_id: string; equipe_id: number; lu_jusqua: string }[]).map((s) => [`${s.user_id}:${s.equipe_id}`, t(s.lu_jusqua)])
  );
  for (const l of lignes) {
    const depuis = Math.max(lu.get(`${l.joueur}:${l.equipe_id}`) ?? 0, t(l.created_at));
    const k = ((fils ?? []) as (Ecrit & { equipe_id: number })[]).filter(
      (m) => m.equipe_id === l.equipe_id && m.auteur !== l.joueur && t(m.created_at) > depuis
    ).length;
    n.set(l.joueur, (n.get(l.joueur) ?? 0) + Math.min(NON_LUS_MAX_PAR_MATCH, k));
  }
}

/**
 * Ses messages privés : ce que chacun lui a écrit depuis sa dernière lecture
 * de leur conversation (toute la conversation, s'il ne l'a jamais ouverte),
 * dix au plus par conversation. Ajouté au compte `n`. Avant la migration
 * (prive_suivi absente), rien.
 */
async function nonLusPrives(sb: SupabaseClient, uids: string[], n: Map<string, number>, t: (iso: string) => number) {
  const [{ data: suivis, error }, { data: recus }] = await Promise.all([
    sb.from("prive_suivi").select("user_id, autre, lu_jusqua").in("user_id", uids),
    sb
      .from("messages")
      .select("auteur, destinataire, created_at")
      .eq("canal", "dm")
      .in("destinataire", uids)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);
  if (error) return;
  const lu = new Map(((suivis ?? []) as { user_id: string; autre: string; lu_jusqua: string }[]).map((s) => [`${s.user_id}:${s.autre}`, t(s.lu_jusqua)]));
  const parConversation = new Map<string, number>();
  for (const m of (recus ?? []) as (Ecrit & { destinataire: string })[]) {
    const k = `${m.destinataire}:${m.auteur}`;
    if (t(m.created_at) <= (lu.get(k) ?? 0)) continue;
    parConversation.set(k, Math.min(NON_LUS_MAX_PAR_MATCH, (parConversation.get(k) ?? 0) + 1));
  }
  for (const [k, c] of parConversation) {
    const uid = k.slice(0, k.indexOf(":"));
    n.set(uid, (n.get(uid) ?? 0) + c);
  }
}
