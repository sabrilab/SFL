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
//
// Une réponse donnée est figée (Sabri, 27/10/2026) : le joueur répond une
// fois, « Je viens » ou « Pas dispo », et ne la change plus ni ne la retire
// (components/sfl/reponse-scellee.tsx ; la base le refuse aussi, voir
// supabase/schema.sql, presence). L'admin la corrige, et la feuille de la
// journée passe devant elle.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSession } from "@/hooks/use-session";
import { listPresence, setPresence, type Reponse } from "@/lib/sfl/presence";
import { activeConvocation, setConvocationTeams } from "@/lib/sfl/saisie/mutations";
import { saisieStore } from "@/lib/sfl/saisie/store";
import { SAISIE_EVENT } from "@/components/sfl/season-provider";
import type { ConvocationTeam } from "@/lib/sfl/saisie/types";
import { assurerConvocationOuverte } from "@/lib/sfl/convocation-auto";
import { ajusterEquipes } from "@/lib/sfl/divisions-equipes";
import { equipesVisibles, reponsesOuvertes } from "@/lib/sfl/convocation-temps";
import { rewardConvocationReply } from "@/lib/sfl/ballons";
import { NEXT_MATCH } from "@/lib/sfl/data";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/sfl/activity";
import { isHidden, publicOnly } from "@/lib/sfl/hidden";
import { avecLaFeuille, joueursDeLaFeuille, jourMois, journeeDuJour, remplacantsDe } from "@/lib/sfl/presence-feuille";
import { ordreDArrivee } from "@/lib/sfl/equipes-division";
import { terrainDeJournee } from "@/lib/sfl/saisie/mutations";
import { matchsDeJournee, rendezVousDe, type RendezVous } from "@/lib/sfl/matchs-du-jour";

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
  /** L'heure de chaque réponse (ISO) : l'ordre d'arrivée des « Je viens ». */
  quand: Record<string, string>;
}

// Compteur de noms de canaux : chaque abonné temps réel reçoit le sien.
let presenceSeq = 0;

export interface PresenceView {
  /** true = tout le monde voit la même liste (Supabase branché). */
  shared: boolean;
  journee: number;
  jour: string;
  heure: string;
  lieu: string;
  effectif: number;
  /**
   * Où et à quelle heure je joue ce dimanche : l'heure, le lieu et le
   * terrain de mon match dès que l'admin a fait les équipes, sinon le
   * premier coup d'envoi et le lieu de la journée ; sans journée ouverte,
   * ceux de la convocation. `heure` et `lieu` restent ceux de la
   * convocation, pour tous.
   */
  rendezVous: RendezVous;
  mine: Reponse | null;
  presents: string[];
  /**
   * Ceux qui ont dit « Je viens » sans être dans une équipe (celles de la
   * feuille, ou celles de la convocation une fois visibles, vendredi 19 h) :
   * les remplaçants. Ils ne sont pas dans `presents` dès que la feuille a ses
   * équipes, mais ne disparaissent plus de la liste.
   */
  remplacants: string[];
  /** `presents` dans l'ordre où les places leur reviennent (equipes-division.ts, ordreDArrivee). */
  ordreDesVenus: string[];
  absents: string[];
  sansReponse: string[];
  /** Vrai du lundi au vendredi minuit — après, la conversation est expirée. */
  reponsesOuvertes: boolean;
  /** Vrai à partir du vendredi 19h : les équipes composées sont révélées. */
  equipesVisibles: boolean;
  /** Les équipes composées par l'admin (null tant qu'il n'a rien validé). */
  teams: ConvocationTeam[] | null;
  /**
   * Répondre, une seule fois : « figee » si une réponse existe déjà (ici ou
   * en base), « erreur » si rien n'a pu partir.
   */
  answer: (r: Reponse) => Promise<"ok" | "figee" | "erreur">;
  /** Publie la convocation locale vers Supabase (admin, session serveur). */
  publish: (() => Promise<boolean>) | null;
  /** Enregistre les équipes composées (admin seulement, sinon null). */
  saveTeams: ((teams: ConvocationTeam[] | null) => Promise<boolean>) | null;
}

export function usePresence(): PresenceView {
  // Le document stocké : setPresence et les équipes l'écrivent.
  const { saisonBrute: saison, journees } = useSeason();
  const { player } = useMyPlayer();
  const session = useSession();
  const serverActive = !!session?.server;

  const [server, setServer] = useState<ServerState | null>(null);
  // Recharger la liste à la demande (une réponse refusée par la base).
  const recharger = useRef<() => void>(() => {});

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
          .select("reponse, updated_at, profiles ( name )")
          .eq("convocation_id", convocation.id);
        const reponses: Record<string, Reponse> = {};
        const quand: Record<string, string> = {};
        // Selon l'inférence de la relation, PostgREST renvoie `profiles` comme
        // objet ou comme tableau à un élément : on accepte les deux.
        type Row = { reponse: Reponse; updated_at?: string; profiles: { name: string } | { name: string }[] | null };
        for (const r of (rows ?? []) as unknown as Row[]) {
          const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
          if (prof?.name) reponses[prof.name] = r.reponse;
          if (prof?.name && r.updated_at) quand[prof.name] = r.updated_at;
        }
        if (!cancelled) setServer({ convocation, reponses, quand });
      } catch {
        // Base injoignable : on retombe sur le mode local sans casser l'écran.
        if (!cancelled) setServer(null);
      }
    }

    recharger.current = () => void load();
    // La ceinture de sécurité du cron : un admin qui ouvre l'app garantit que
    // la semaine est ouverte. Si elle vient d'être créée, on recharge — le
    // temps réel le ferait aussi, mais autant ne pas dépendre de lui ici.
    void assurerConvocationOuverte().then((creee) => {
      if (creee) load();
    });
    load();
    // Nom de canal UNIQUE par abonné. supabase-js renvoie le canal existant
    // quand on redemande un nom déjà pris : le deuxième écran qui montait ce
    // hook (l'accueil affiche l'annonce ET le panneau de présence) récupérait
    // un canal déjà souscrit, et son `.on()` levait — tout l'écran tombait.
    let channel: ReturnType<typeof sb.channel> | null = null;
    try {
      channel = sb
        .channel(`sfl-presence-${++presenceSeq}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "presence" }, load)
        .on("postgres_changes", { event: "*", schema: "public", table: "convocations" }, load)
        .subscribe();
    } catch {
      // Sans temps réel, la liste reste juste : elle se recharge à l'ouverture.
    }
    return () => {
      cancelled = true;
      if (channel) sb.removeChannel(channel);
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
    async (r: Reponse): Promise<"ok" | "figee" | "erreur"> => {
      // Conversation expirée (vendredi minuit) : plus rien ne bouge —
      // sans réponse = non-participation.
      if (!ouvert) return "erreur";
      // +2 Ballons pour avoir répondu — oui ou non — une fois par convocation.
      const convocId = serverActive && server ? server.convocation.id : (activeConvocation(saison)?.id ?? null);
      const recompense = () => {
        if (convocId === null) return;
        // Les Ballons ne s'affichent plus : on garde le compte, sans toast.
        rewardConvocationReply(player.name, `${serverActive ? "s" : "l"}${convocId}`);
      };
      if (serverActive && server) {
        // Déjà répondu (ou posé sur la feuille par l'admin) : figé.
        if (server.reponses[player.name]) return "figee";
        try {
          const sb = supabase();
          const { data: auth } = await sb.auth.getUser();
          const uid = auth.user?.id;
          if (!uid) return "erreur";
          // Une insertion, jamais un upsert : une réponse déjà en base (un
          // autre téléphone, un double toucher) est refusée (23505), pas
          // remplacée.
          const { error } = await sb
            .from("presence")
            .insert({ convocation_id: server.convocation.id, player_id: uid, reponse: r });
          if (error) {
            // Seule la clé en double dit « déjà répondu » : un refus RLS
            // (pas membre) n'est pas une réponse figée.
            if (error.code === "23505" || /duplicate key/i.test(error.message)) {
              recharger.current();
              return "figee";
            }
            return "erreur";
          }
          // Tout de suite à l'écran, sans attendre le temps réel.
          setServer((s) =>
            s && s.convocation.id === server.convocation.id ? { ...s, reponses: { ...s.reponses, [player.name]: r } } : s
          );
          logActivity("presence");
          recompense();
          void ajusterEquipes("reponse", server.convocation.heure);
          return "ok";
        } catch {
          return "erreur";
        }
      }
      const conv = activeConvocation(saison);
      if (conv?.reponses[player.name]) return "figee";
      const ok = setPresence(saison, player.name, r);
      if (ok) recompense();
      return ok ? "ok" : "erreur";
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

  // Les joueurs que l'admin a posés sur la feuille de ce dimanche viennent :
  // ils comptent avec ceux qui ont dit « Je viens » (lib/sfl/presence-feuille).
  const dateConv = serverActive && server ? server.convocation.date_label : (localConv?.date ?? NEXT_MATCH.date);
  const jDuJour = journeeDuJour(saison, dateConv);
  const feuille = joueursDeLaFeuille(saison, jDuJour);
  const surLaFeuille = feuille.noms.includes(player.name);

  // L'heure, le lieu et le terrain de mon match, quand la journée de ce
  // dimanche est ouverte (lib/sfl/matchs-du-jour) ; sinon ceux de la convocation.
  const rendezVousDuDimanche = (heure: string, lieu: string): RendezVous => {
    const meta = saison.journees.find((m) => m.j === jDuJour);
    if (!meta) return { heure, lieu, match: null, terrain: null };
    const repli = { heure: meta.heure || heure, lieu: terrainDeJournee(saison, meta, lieu) };
    const matchs = matchsDeJournee(journees.find((x) => x.j === jDuJour), saison.terrains ?? [], repli);
    return rendezVousDe(matchs, player.name, repli, lieu);
  };

  if (serverActive && server) {
    const names = publicOnly(saison.roster).map((r) => ({ name: r.name, actif: r.profil === "Actif" }));
    const rep = server.reponses;
    const jeViens = names.filter((n) => rep[n.name] === "present").map((n) => n.name);
    const reponses = avecLaFeuille(
      {
        presents: jeViens,
        absents: names.filter((n) => rep[n.name] === "absent").map((n) => n.name),
        sansReponse: names.filter((n) => !rep[n.name] && n.actif).map((n) => n.name),
      },
      feuille,
      isHidden
    );
    return {
      shared: true,
      journee: numeroDuDimanche(saison, server.convocation.date_label),
      jour: `${server.convocation.jour} ${server.convocation.date_label}`,
      heure: server.convocation.heure,
      lieu: server.convocation.lieu,
      effectif: server.convocation.effectif,
      rendezVous: rendezVousDuDimanche(server.convocation.heure, server.convocation.lieu),
      mine: surLaFeuille ? "present" : (rep[player.name] ?? null),
      ...reponses,
      remplacants: remplacantsDe(jeViens, saison, jDuJour, revele ? server.convocation.teams : null, isHidden),
      ordreDesVenus: ordreDArrivee(reponses.presents, feuille.noms, (n) => server.quand[n]).filter((n) => reponses.presents.includes(n)),
      reponsesOuvertes: ouvert,
      equipesVisibles: revele,
      teams: server.convocation.teams ?? null,
      answer,
      publish: null,
      saveTeams: session?.admin ? saveTeams : null,
    };
  }

  const reponsesLocales = avecLaFeuille(
    { presents: local.presents, absents: local.absents, sansReponse: local.sansReponse },
    feuille,
    isHidden
  );
  return {
    shared: false,
    journee: NEXT_MATCH.journee,
    jour: localConv ? `${localConv.jour} ${localConv.date}` : `${NEXT_MATCH.jour} ${NEXT_MATCH.date}`,
    heure: localConv?.heure ?? NEXT_MATCH.heure,
    lieu: localConv?.lieu ?? NEXT_MATCH.lieu,
    effectif: 10,
    rendezVous: rendezVousDuDimanche(localConv?.heure ?? NEXT_MATCH.heure, localConv?.lieu ?? NEXT_MATCH.lieu),
    mine: surLaFeuille ? "present" : localConv ? ((localConv.reponses[player.name] as Reponse | undefined) ?? null) : null,
    ...reponsesLocales,
    remplacants: remplacantsDe(local.presents, saison, jDuJour, revele ? (localConv?.teams ?? null) : null, isHidden),
    ordreDesVenus: ordreDArrivee(reponsesLocales.presents, feuille.noms, () => null).filter((n) => reponsesLocales.presents.includes(n)),
    reponsesOuvertes: ouvert,
    equipesVisibles: revele,
    teams: localConv?.teams ?? null,
    answer,
    // Publier n'a de sens que pour l'admin, connecté côté serveur.
    publish: serverActive && session?.admin ? publish : null,
    saveTeams: session?.admin ? saveTeams : null,
  };
}

/**
 * Le numéro de journée d'une convocation, lu dans la saison : la journée du
 * même dimanche si l'admin l'a déjà ouverte, sinon la suivante. Le numéro
 * stocké en base suit les convocations d'une saison à l'autre (J18 pour la
 * deuxième journée de la saison 1) — il ne sert plus à l'affichage.
 */
function numeroDuDimanche(saison: { journees: { j: number; date: string }[] }, dateLabel: string): number {
  const cle = jourMois(dateLabel);
  const meme = cle ? saison.journees.find((m) => jourMois(m.date) === cle) : undefined;
  return meme?.j ?? Math.max(0, ...saison.journees.map((m) => m.j)) + 1;
}
