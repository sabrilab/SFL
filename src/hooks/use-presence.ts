"use client";

// Présence à la prochaine journée — la version branchée.
//
// Deux modes, choisis automatiquement :
//   · session vérifiée par le serveur ET convocation publiée dans Supabase →
//     liste PARTAGÉE : lectures/écritures en base, rafraîchie en temps réel
//     (postgres_changes sur presence et convocations) ;
//   · sinon → repli local (localStorage), comme avant le branchement.
//
// Les écrans ne connaissent que ce hook : la bascule est invisible pour eux.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSession } from "@/hooks/use-session";
import { listPresence, setPresence, type Reponse } from "@/lib/sfl/presence";
import { activeConvocation } from "@/lib/sfl/saisie/mutations";
import { NEXT_MATCH } from "@/lib/sfl/data";
import { supabase } from "@/lib/supabase";

interface ServerConvocation {
  id: number;
  journee: number;
  jour: string;
  date_label: string;
  heure: string;
  lieu: string;
  effectif: number;
}

interface ServerState {
  convocation: ServerConvocation;
  reponses: Record<string, Reponse>;
}

export interface PresenceView {
  /** true = tout le monde voit la même liste (Supabase branché). */
  shared: boolean;
  journee: number;
  jour: string;
  heure: string;
  lieu: string;
  effectif: number;
  mine: Reponse | null;
  presents: string[];
  absents: string[];
  sansReponse: string[];
  answer: (r: Reponse | null) => Promise<boolean>;
  /** Publie la convocation locale vers Supabase (admin, session serveur). */
  publish: (() => Promise<boolean>) | null;
}

export function usePresence(): PresenceView {
  const { saison } = useSeason();
  const { player } = useMyPlayer();
  const session = useSession();
  const serverActive = !!session?.server;

  const [server, setServer] = useState<ServerState | null>(null);

  useEffect(() => {
    // Pas de session serveur : rien à charger. L'éventuel `server` d'une
    // session précédente reste en mémoire mais n'est jamais rendu (la vue
    // exige serverActive) — pas besoin d'un setState de nettoyage.
    if (!serverActive) return;
    let cancelled = false;
    const sb = supabase();

    async function load() {
      try {
        const { data: convs } = await sb
          .from("convocations")
          .select("id, journee, jour, date_label, heure, lieu, effectif")
          .eq("statut", "ouverte")
          .order("id", { ascending: false })
          .limit(1);
        const convocation = (convs?.[0] as ServerConvocation | undefined) ?? null;
        if (!convocation) {
          if (!cancelled) setServer(null);
          return;
        }
        const { data: rows } = await sb
          .from("presence")
          .select("reponse, profiles ( name )")
          .eq("convocation_id", convocation.id);
        const reponses: Record<string, Reponse> = {};
        // Selon l'inférence de la relation, PostgREST renvoie `profiles` comme
        // objet ou comme tableau à un élément : on accepte les deux.
        type Row = { reponse: Reponse; profiles: { name: string } | { name: string }[] | null };
        for (const r of (rows ?? []) as unknown as Row[]) {
          const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          if (prof?.name) reponses[prof.name] = r.reponse;
        }
        if (!cancelled) setServer({ convocation, reponses });
      } catch {
        // Base injoignable : on retombe sur le mode local sans casser l'écran.
        if (!cancelled) setServer(null);
      }
    }

    load();
    const channel = sb
      .channel("sfl-presence")
      .on("postgres_changes", { event: "*", schema: "public", table: "presence" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "convocations" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      sb.removeChannel(channel);
    };
  }, [serverActive]);

  /* ------------------------------ Repli local ------------------------------ */

  const local = useMemo(
    () => listPresence(saison, saison.roster.map((r) => ({ name: r.name, profil: r.profil }))),
    [saison]
  );
  const localConv = activeConvocation(saison);

  /* ------------------------------- Réponses ------------------------------- */

  const answer = useCallback(
    async (r: Reponse | null): Promise<boolean> => {
      if (serverActive && server) {
        try {
          const sb = supabase();
          const { data: auth } = await sb.auth.getUser();
          const uid = auth.user?.id;
          if (!uid) return false;
          if (r === null) {
            const { error } = await sb
              .from("presence")
              .delete()
              .eq("convocation_id", server.convocation.id)
              .eq("player_id", uid);
            return !error;
          }
          const { error } = await sb.from("presence").upsert(
            { convocation_id: server.convocation.id, player_id: uid, reponse: r },
            { onConflict: "convocation_id,player_id" }
          );
          return !error;
        } catch {
          return false;
        }
      }
      return setPresence(saison, player.name, r);
    },
    [serverActive, server, saison, player.name]
  );

  const publish = useCallback(async (): Promise<boolean> => {
    try {
      const sb = supabase();
      // Une seule convocation ouverte : on clôture les précédentes.
      await sb.from("convocations").update({ statut: "cloturee" }).eq("statut", "ouverte");
      const src = localConv;
      const { error } = await sb.from("convocations").insert({
        journee: NEXT_MATCH.journee,
        jour: src?.jour ?? NEXT_MATCH.jour,
        date_label: src?.date ?? NEXT_MATCH.date,
        heure: src?.heure ?? NEXT_MATCH.heure,
        lieu: src?.lieu ?? NEXT_MATCH.lieu,
        effectif: 10,
      });
      return !error;
    } catch {
      return false;
    }
  }, [localConv]);

  /* -------------------------------- La vue -------------------------------- */

  if (serverActive && server) {
    const names = saison.roster.map((r) => ({ name: r.name, actif: r.profil === "Actif" }));
    const rep = server.reponses;
    return {
      shared: true,
      journee: server.convocation.journee,
      jour: `${server.convocation.jour} ${server.convocation.date_label}`,
      heure: server.convocation.heure,
      lieu: server.convocation.lieu,
      effectif: server.convocation.effectif,
      mine: rep[player.name] ?? null,
      presents: names.filter((n) => rep[n.name] === "present").map((n) => n.name),
      absents: names.filter((n) => rep[n.name] === "absent").map((n) => n.name),
      sansReponse: names.filter((n) => !rep[n.name] && n.actif).map((n) => n.name),
      answer,
      publish: null,
    };
  }

  return {
    shared: false,
    journee: NEXT_MATCH.journee,
    jour: localConv ? `${localConv.jour} ${localConv.date}` : `${NEXT_MATCH.jour} ${NEXT_MATCH.date}`,
    heure: localConv?.heure ?? NEXT_MATCH.heure,
    lieu: localConv?.lieu ?? NEXT_MATCH.lieu,
    effectif: 10,
    mine: localConv ? ((localConv.reponses[player.name] as Reponse | undefined) ?? null) : null,
    presents: local.presents,
    absents: local.absents,
    sansReponse: local.sansReponse,
    answer,
    // Publier n'a de sens que pour l'admin, connecté côté serveur.
    publish: serverActive && session?.admin ? publish : null,
  };
}
