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
import { toast } from "sonner";
import { listPresence, setPresence, type Reponse } from "@/lib/sfl/presence";
import { activeConvocation, setConvocationTeams } from "@/lib/sfl/saisie/mutations";
import { saisieStore } from "@/lib/sfl/saisie/store";
import { SAISIE_EVENT } from "@/components/sfl/season-provider";
import type { ConvocationTeam } from "@/lib/sfl/saisie/types";
import { equipesVisibles, reponsesOuvertes } from "@/lib/sfl/convocation-temps";
import { rewardConvocationReply } from "@/lib/sfl/ballons";
import { NEXT_MATCH } from "@/lib/sfl/data";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/sfl/activity";
import { publicOnly } from "@/lib/sfl/hidden";

interface ServerConvocation {
  id: number;
  journee: number;
  jour: string;
  date_label: string;
  heure: string;
  lieu: string;
  effectif: number;
  teams: ConvocationTeam[] | null;
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
  /** Vrai du lundi au vendredi minuit — après, la conversation est expirée. */
  reponsesOuvertes: boolean;
  /** Vrai à partir du vendredi 19h : les équipes composées sont révélées. */
  equipesVisibles: boolean;
  /** Les équipes composées par l'admin (null tant qu'il n'a rien validé). */
  teams: ConvocationTeam[] | null;
  answer: (r: Reponse | null) => Promise<boolean>;
  /** Publie la convocation locale vers Supabase (admin, session serveur). */
  publish: (() => Promise<boolean>) | null;
  /** Enregistre les équipes composées (admin seulement, sinon null). */
  saveTeams: ((teams: ConvocationTeam[] | null) => Promise<boolean>) | null;
}

export function usePresence(): PresenceView {
  const { saison } = useSeason();
  const { player } = useMyPlayer();
  const session = useSession();
  const serverActive = !!session?.server;

  const [server, setServer] = useState<ServerState | null>(null);

  // L'horloge du rythme hebdomadaire. Nulle au premier rendu (le serveur ne
  // doit pas figer une heure), posée en micro-tâche puis retenue à la minute.
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setMaintenant(new Date());
    Promise.resolve().then(tick);
    const timer = setInterval(tick, 60_000);
    return () => clearInterval(timer);
  }, []);
  // Avant la première mesure : réponses ouvertes, équipes cachées — l'état le
  // plus fréquent de la semaine, corrigé à la microseconde où l'horloge tombe.
  const ouvert = maintenant ? reponsesOuvertes(maintenant) : true;
  const revele = maintenant ? equipesVisibles(maintenant) : false;

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
          .select("id, journee, jour, date_label, heure, lieu, effectif, teams")
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
    () => listPresence(saison, publicOnly(saison.roster).map((r) => ({ name: r.name, profil: r.profil }))),
    [saison]
  );
  const localConv = activeConvocation(saison);

  /* ------------------------------- Réponses ------------------------------- */

  const answer = useCallback(
    async (r: Reponse | null): Promise<boolean> => {
      // Conversation expirée (vendredi minuit) : plus rien ne bouge, dans un
      // sens comme dans l'autre — sans réponse = non-participation.
      if (!ouvert) return false;
      // +2 Ballons pour avoir répondu — oui ou non — une fois par convocation.
      const convocId = serverActive && server ? server.convocation.id : (activeConvocation(saison)?.id ?? null);
      const recompense = () => {
        if (r === null || convocId === null) return;
        const credited = rewardConvocationReply(player.name, `${serverActive ? "s" : "l"}${convocId}`);
        if (credited > 0) {
          toast.success(`+${credited} Ballons ⚽`, {
            description: "Merci d'avoir répondu à la convocation",
          });
        }
      };
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
          if (!error) {
            logActivity("presence");
            recompense();
          }
          return !error;
        } catch {
          return false;
        }
      }
      const ok = setPresence(saison, player.name, r);
      if (ok) recompense();
      return ok;
    },
    [serverActive, server, saison, player.name, ouvert]
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

  const saveTeams = useCallback(
    async (teams: ConvocationTeam[] | null): Promise<boolean> => {
      // En mode partagé, la vérité vit en base ; en local, dans la saison.
      if (serverActive && server) {
        try {
          const { error } = await supabase()
            .from("convocations")
            .update({ teams })
            .eq("id", server.convocation.id);
          if (error) return false;
        } catch {
          return false;
        }
      }
      const localId = activeConvocation(saison)?.id;
      if (localId !== undefined) {
        saisieStore.save(setConvocationTeams(saison, localId, teams));
        window.dispatchEvent(new Event(SAISIE_EVENT));
      }
      return true;
    },
    [serverActive, server, saison]
  );

  /* -------------------------------- La vue -------------------------------- */

  if (serverActive && server) {
    const names = publicOnly(saison.roster).map((r) => ({ name: r.name, actif: r.profil === "Actif" }));
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
      reponsesOuvertes: ouvert,
      equipesVisibles: revele,
      teams: server.convocation.teams ?? null,
      answer,
      publish: null,
      saveTeams: session?.admin ? saveTeams : null,
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
    reponsesOuvertes: ouvert,
    equipesVisibles: revele,
    teams: localConv?.teams ?? null,
    answer,
    // Publier n'a de sens que pour l'admin, connecté côté serveur.
    publish: serverActive && session?.admin ? publish : null,
    saveTeams: session?.admin ? saveTeams : null,
  };
}
