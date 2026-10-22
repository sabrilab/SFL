// Les messages pas encore lus de chaque joueur, pour la pastille rouge de
// l'icône de l'app (le nombre que porte la notification : public/sw.js) :
// ceux du Vestiaire, et ceux des discussions de ses matchs à venir, là où il
// joue (organisateur ou inscrit ; un invité lit sans compter).
//
// Le même compte que l'app (hooks/use-vestiaire-non-lus.ts et
// hooks/use-discussions-match.ts, additionnés par la barre d'onglets), aux
// bornes près : trois jours au plus pour le Vestiaire, dix messages au plus
// par match. Partagé par les deux routes qui préviennent,
// /api/vestiaire/notifier et /api/matchs/discussion.
//
// SERVEUR UNIQUEMENT : il lit les messages de tout le monde (clé secrète).

import type { SupabaseClient } from "@supabase/supabase-js";

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

  // Le Vestiaire : ce que les autres ont écrit depuis ma dernière lecture,
  // trois jours au plus (qui ne l'a jamais ouvert voit ces trois jours-là).
  const depuis = new Date(maintenant - 3 * JOUR).toISOString();
  const [{ data: lus }, { data: recents }] = await Promise.all([
    sb.from("vestiaire_suivi").select("user_id, lu_jusqua").in("user_id", uids),
    sb.from("messages").select("auteur, created_at").eq("canal", "sfl").gt("created_at", depuis),
  ]);
  const luV = new Map(((lus ?? []) as { user_id: string; lu_jusqua: string }[]).map((s) => [s.user_id, t(s.lu_jusqua)]));
  for (const uid of uids) {
    const lu = luV.get(uid) ?? 0;
    n.set(uid, ((recents ?? []) as Ecrit[]).filter((m) => m.auteur !== uid && t(m.created_at) > lu).length);
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
