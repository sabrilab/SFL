// Le parcours d'un nouvel arrivant, pour Nouveaux arrivants (./nouveaux.tsx) :
// les étapes qui mènent un joueur Bola à son premier match (Sabri,
// 31/10/2026 : « pour voir le comportement de l'utilisateur, parce qu'on veut
// l'activer et on va avoir de la rétention » ; lib/sfl/activation.ts).
//
// Ce que la base sait déjà (sa ville, ses notifications, ses matchs, les
// partages de son lien), et ce que le journal d'usage a noté de l'écran « Ton
// premier match » (activity, kind « activation » : vu, position donnée ou
// refusée, terrain touché, invitation). Lu pour les seuls nouveaux comptes ;
// une lecture refusée laisse l'étape vide, jamais la page.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface Parcours {
  ville: string | null;
  /** Au moins un téléphone abonné aux notifications. */
  notifs: boolean;
  /** « Ton premier match » vu (fois). */
  vu: number;
  /** La position donnée, refusée, ou jamais demandée. */
  position: "oui" | "non" | null;
  /** Un terrain touché pour ouvrir un match (fois). */
  terrain: number;
  /** « Inviter mes potes » touché, ou son lien partagé (fois). */
  invite: number;
  /** Les matchs qu'il a ouverts. */
  organise: number;
  /** Les matchs où il est, invité ou inscrit. */
  dedans: number;
  /** Les matchs joués : inscrit, et le jour passé. */
  joue: number;
}

export const PARCOURS_VIDE: Parcours = {
  ville: null,
  notifs: false,
  vu: 0,
  position: null,
  terrain: 0,
  invite: 0,
  organise: 0,
  dedans: 0,
  joue: 0,
};

/** Les étapes, dans l'ordre du parcours, et si elle est franchie. */
export const ETAPES: { id: string; label: string; faite: (p: Parcours) => boolean }[] = [
  { id: "ville", label: "Ville", faite: (p) => !!p.ville },
  { id: "notifs", label: "Notifs", faite: (p) => p.notifs },
  { id: "vu", label: "A vu", faite: (p) => p.vu > 0 },
  { id: "position", label: "Position", faite: (p) => p.position === "oui" },
  { id: "terrain", label: "Terrain touché", faite: (p) => p.terrain > 0 },
  { id: "invite", label: "A invité", faite: (p) => p.invite > 0 },
  { id: "organise", label: "Match ouvert", faite: (p) => p.organise > 0 },
  { id: "joue", label: "A joué", faite: (p) => p.joue > 0 },
];

type Ligne<T> = { data: T[] | null; error: unknown };
const lignes = <T,>(r: Ligne<T>): T[] => (r.error ? [] : (r.data ?? []));

/** Le parcours de chacun de ces comptes (id → nom), par nom. */
export async function lireParcours(sb: SupabaseClient, comptes: ReadonlyMap<string, string>): Promise<Map<string, Parcours>> {
  const ids = [...comptes.keys()];
  const out = new Map<string, Parcours>();
  if (ids.length === 0) return out;
  const [profils, push, gestes, orga, dedans, codes] = await Promise.all([
    sb.from("profiles").select("id, ville").in("id", ids),
    sb.from("push_abonnements").select("user_id").in("user_id", ids),
    sb.from("activity").select("player_id, meta").eq("kind", "activation").in("player_id", ids),
    sb.from("matchs").select("organisateur").in("organisateur", ids),
    sb.from("match_joueurs").select("player_id, statut, matchs ( jour )").in("player_id", ids),
    sb.from("parrainage_codes").select("joueur, partages").in("joueur", ids),
  ]);
  const de = (id: string) => {
    const nom = comptes.get(id);
    if (!nom) return null;
    let p = out.get(nom);
    if (!p) out.set(nom, (p = { ...PARCOURS_VIDE }));
    return p;
  };
  for (const id of ids) de(id);
  for (const r of lignes(profils as Ligne<{ id: string; ville: string | null }>)) {
    const p = de(r.id);
    if (p) p.ville = r.ville;
  }
  for (const r of lignes(push as Ligne<{ user_id: string }>)) {
    const p = de(r.user_id);
    if (p) p.notifs = true;
  }
  for (const r of lignes(gestes as Ligne<{ player_id: string; meta: { geste?: string } | null }>)) {
    const p = de(r.player_id);
    const g = r.meta?.geste;
    if (!p || !g) continue;
    if (g === "vu") p.vu++;
    else if (g === "position-oui") p.position = "oui";
    else if (g === "position-non") p.position = p.position ?? "non";
    else if (g === "terrain") p.terrain++;
    else if (g === "inviter") p.invite++;
  }
  for (const r of lignes(orga as Ligne<{ organisateur: string }>)) {
    const p = de(r.organisateur);
    if (p) p.organise++;
  }
  const aujourdhui = new Date().toISOString().slice(0, 10);
  type Dedans = { player_id: string; statut: string; matchs: { jour: string } | { jour: string }[] | null };
  for (const r of lignes(dedans as Ligne<Dedans>)) {
    const p = de(r.player_id);
    if (!p) continue;
    p.dedans++;
    const m = Array.isArray(r.matchs) ? r.matchs[0] : r.matchs;
    if (r.statut === "inscrit" && m && m.jour < aujourdhui) p.joue++;
  }
  for (const r of lignes(codes as Ligne<{ joueur: string; partages: number | null }>)) {
    const p = de(r.joueur);
    if (p) p.invite += r.partages ?? 0;
  }
  return out;
}
