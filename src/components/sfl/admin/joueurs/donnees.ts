"use client";

// Ce que l'onglet Joueurs lit hors de la saison (24/11/2026) : l'état de
// chaque compte (POST /api/comptes, admin seul : identifiant, pas de compte,
// mot de passe à choisir) et la dernière venue de chacun dans l'app (le
// journal activity des deux dernières semaines, ouvertures et pages vues
// seulement : quelques milliers de lignes, pas les 200 000 d'Analytics).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { jetonServeur } from "@/lib/sfl/auth/session";
import { dernieresVenues } from "@/lib/sfl/admin-joueurs";
import { useSession } from "@/hooks/use-session";

export interface Compte {
  name: string;
  user: string;
  ajoute?: boolean;
  sansCompte?: boolean;
  aChanger?: "origine" | "provisoire";
}

/** Une route d'admin, avec le jeton de la session (le serveur est seul juge). */
export async function appelAdmin(route: string, corps?: Record<string, unknown>) {
  const jeton = await jetonServeur();
  if (!jeton) return { ok: false, status: 401, json: { error: "Reconnecte-toi : ta session n'est pas vérifiée par le serveur." } as Record<string, unknown> };
  const res = await fetch(route, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton}` },
    body: JSON.stringify(corps ?? {}),
  });
  return { ok: res.ok, status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** Les comptes de la ligue, par nom en minuscules ; null tant que le serveur n'a pas répondu. */
export function useComptes() {
  const session = useSession();
  const partage = !!(session?.server && session.admin);
  const [comptes, setComptes] = useState<Map<string, Compte> | null>(null);
  const relire = useCallback(async () => {
    try {
      const { json } = await appelAdmin("/api/comptes");
      if (Array.isArray(json.accounts)) setComptes(new Map((json.accounts as Compte[]).map((c) => [c.name.toLowerCase(), c])));
    } catch {
      // Hors ligne : la liste reste sans état de compte.
    }
  }, []);
  useEffect(() => {
    if (!partage) return;
    void Promise.resolve().then(relire);
  }, [partage, relire]);
  return { comptes, relire };
}

const JOURS = 14;
const KINDS = ["open", "login", "view"];

/** La dernière venue de chaque joueur dans l'app, par nom en minuscules (ISO). */
export function useDernieresVenues(): Map<string, string> {
  const session = useSession();
  const partage = !!(session?.server && session.admin);
  const [vus, setVus] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!partage) return;
    let vivant = true;
    void (async () => {
      const sb = supabase();
      const depuis = new Date(Date.now() - JOURS * 86_400_000).toISOString();
      const traces: { player_id: string | null; created_at: string }[] = [];
      for (let page = 0; page < 10; page++) {
        const { data, error } = await sb
          .from("activity")
          .select("player_id, created_at")
          .in("kind", KINDS)
          .gte("created_at", depuis)
          .order("created_at", { ascending: false })
          .range(page * 1000, page * 1000 + 999);
        if (error || !data) break;
        traces.push(...(data as typeof traces));
        if (data.length < 1000) break;
      }
      const parId = dernieresVenues(traces);
      if (!parId.size) return;
      const { data: profils } = await sb.from("profiles").select("id, name").in("id", [...parId.keys()]);
      const m = new Map<string, string>();
      for (const p of (profils ?? []) as { id: string; name: string | null }[]) {
        const vu = parId.get(p.id);
        if (p.name && vu) m.set(p.name.toLowerCase(), vu);
      }
      if (vivant) setVus(m);
    })();
    return () => {
      vivant = false;
    };
  }, [partage]);
  return vus;
}
