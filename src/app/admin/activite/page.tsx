"use client";

// Analytics (Activité & rétention) — le gestionnaire de l'admin.
//
// Cette page lit le journal `activity` (réservé à l'admin par RLS), la table
// des profils, les photos du studio, les repères et « Qui ramène du monde »
// (./lectures.ts), les parrainages (qui a fait venir qui, et par où chaque
// compte est entré), l'entonnoir de getbola.app (table site_visites, 03/11)
// et le parcours des comptes de moins de 90 jours (./parcours.ts), puis
// passe le tout à la vue (`vue.tsx`), rangée selon le funnel AARRR :
// acquisition, activation, rétention, revenu, recommandation. Les blocs qui
// lisent leurs propres tables (vidéos, trash talk, Bola Agent, parrainage, packs en XP,
// accords) lui sont donnés à part, et elle les range dans leur étape.
// Rien n'est agrégé en base, donc rien à maintenir quand on ajoute un type
// d'événement.
//
// Une SESSION d'usage = un identifiant tiré à l'ouverture d'un onglet
// (cf. lib/sfl/activity.ts). Sa durée est le temps passé au premier plan,
// mesuré par les battements réguliers de l'app (cf. lib/sfl/retention.ts).

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { isAdmin } from "@/lib/sfl/admin";
import { emailsDeContact } from "@/lib/sfl/contacts";
import { supabase } from "@/lib/supabase";
import { AgentStats } from "./agent";
import { AccordsStats } from "./confidentialite";
import { assemblerReperes, lireReperes } from "./lectures";
import { ParrainageStats } from "./parrainage";
import { VideosStats } from "./videos";
import { TrashTalkAdmin } from "./trash-talk";
import { ActiviteVue, type DonneesActivite } from "./vue";
import { lireParcours } from "./parcours";
import { FENETRE_ACTIVATION } from "./activation";
import type { Canal } from "./acquisition";
import { Revenu } from "./revenu";

/** Lignes rendues au plus par une requête au serveur (réglage Supabase). */
const PAGE = 1000;
/** Garde-fou : on ne lit pas plus que ça d'événements. */
const MAX_EVENEMENTS = 200000;

export default function ActivitePage() {
  const session = useSession();
  const [data, setData] = useState<DonneesActivite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = supabase();
      // On lit tout l'historique disponible et on découpe côté navigateur :
      // le filtre de période devient instantané, sans nouvelle requête.
      // Le serveur ne rend jamais plus de PAGE lignes par requête, quel que
      // soit le `limit` demandé : on lit donc le journal page par page, sans
      // quoi seuls les derniers jours remontaient.
      const lirePage = (debut: number) =>
        sb
          .from("activity")
          .select("kind, created_at, path, session_id, profiles ( name )")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(debut, debut + PAGE - 1);
      const lireTout = async () => {
        const lignes: unknown[] = [];
        for (let debut = 0; debut < MAX_EVENEMENTS; debut += PAGE) {
          const { data, error } = await lirePage(debut);
          if (error) throw new Error(error.message);
          lignes.push(...(data ?? []));
          if (!data || data.length < PAGE) break;
        }
        return lignes;
      };
      // Les photos du studio (studio, drapeau, manga) : les pays choisis, et
      // ce que chaque joueur y a fait (sa fiche). Une lecture refusée ne fait
      // pas échouer la page : ces parties le disent.
      const lireStudio = async () => {
        const lignes: { user_id: string; filtre: string; pays: string | null; created_at: string }[] = [];
        for (let debut = 0; ; debut += PAGE) {
          const { data, error } = await sb
            .from("photo_studio")
            .select("user_id, filtre, pays, created_at")
            .order("id")
            .range(debut, debut + PAGE - 1);
          if (error) return null;
          lignes.push(...(data ?? []));
          if (!data || data.length < PAGE) return lignes;
        }
      };
      const [actData, prof, studioBrut, emails, reperesBrut, parrainagesBrut] = await Promise.all([
        lireTout(),
        sb.from("profiles").select("id, name, created_at, is_admin"),
        lireStudio(),
        // Rangés à part (table contacts) : l'admin les lit tous.
        emailsDeContact(sb).catch(() => new Map<string, string>()),
        // Les repères et « Qui ramène » : une lecture ratée les laisse vides.
        lireReperes(sb).catch(() => null),
        // Qui a fait venir qui, pour les nouveaux arrivants (./nouveaux.tsx).
        sb.from("parrainages").select("filleul, parrain, canal, created_at"),
      ]);
      // L'entonnoir de getbola.app (./acquisition.tsx) : une lecture ratée le dit, sans plus.
      const lireSite = async () => {
        const lignes: { visiteur: string; etape: string; source: string | null; jour: string }[] = [];
        for (let debut = 0; debut < MAX_EVENEMENTS; debut += PAGE) {
          const { data, error } = await sb
            .from("site_visites")
            .select("visiteur, etape, source, jour")
            .order("id")
            .range(debut, debut + PAGE - 1);
          if (error) return null;
          lignes.push(...(data ?? []));
          if (!data || data.length < PAGE) break;
        }
        // « 2026-11-03 » → minuit local de ce jour, comme les jours des courbes.
        return lignes.map((l) => {
          const [y, m, d] = l.jour.split("-").map(Number);
          return { visiteur: l.visiteur, etape: l.etape, source: l.source, t: new Date(y, m - 1, d).getTime() };
        });
      };
      const site = await lireSite().catch(() => null);
      if (prof.error) throw new Error(prof.error.message);

      type Brut = {
        kind: string;
        created_at: string;
        path: string | null;
        session_id: string | null;
        profiles: { name: string } | { name: string }[] | null;
      };
      const evenements = (actData as Brut[]).map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return {
          name: p?.name ?? "?",
          kind: r.kind,
          path: r.path,
          session: r.session_id,
          at: new Date(r.created_at).getTime(),
        };
      });
      type ProfilBrut = {
        id: string;
        name: string;
        created_at: string | null;
        is_admin: boolean | null;
      };
      const profiles = ((prof.data ?? []) as ProfilBrut[]).map((p) => ({
        name: p.name,
        contact_email: emails.get(p.id) ?? null,
        created_at: p.created_at ? new Date(p.created_at).getTime() : null,
        // Le rôle en base, ou la liste en dur de l'app (Sabri, Ilyes).
        admin: !!p.is_admin || isAdmin(p.name),
      }));
      const noms = new Map(((prof.data ?? []) as ProfilBrut[]).map((p) => [p.id, p.name]));
      const studio =
        studioBrut?.map((d) => ({
          name: noms.get(d.user_id) ?? "?",
          filtre: d.filtre,
          pays: d.pays,
          at: new Date(d.created_at).getTime(),
        })) ?? null;
      const reperes = reperesBrut ? assemblerReperes(reperesBrut, noms) : null;
      type LienBrut = { filleul: string; parrain: string | null; canal: Canal; created_at: string };
      const liensBruts = parrainagesBrut.error ? null : ((parrainagesBrut.data ?? []) as LienBrut[]);
      const parrains = liensBruts
        ? new Map(
            liensBruts.flatMap((x) => {
              const f = noms.get(x.filleul);
              const pa = x.parrain ? noms.get(x.parrain) : undefined;
              return f && pa ? [[f, pa] as const] : [];
            })
          )
        : null;
      // Par où chaque compte est entré (seul par le site, un parrain, une équipe).
      const canaux = liensBruts
        ? new Map(liensBruts.flatMap((x) => (noms.get(x.filleul) ? [[noms.get(x.filleul)!, x.canal] as const] : [])))
        : null;
      // Les filleuls (venus par quelqu'un), datés : la recommandation.
      const filleuls = liensBruts
        ? liensBruts.flatMap((x) =>
            x.canal !== "site" && noms.get(x.filleul) ? [{ name: noms.get(x.filleul)!, at: new Date(x.created_at).getTime() }] : []
          )
        : null;
      const idsAdmins = new Set(
        ((prof.data ?? []) as ProfilBrut[]).filter((p) => !!p.is_admin || isAdmin(p.name)).map((p) => p.id)
      );
      // Le parcours des comptes de moins de 90 jours (./parcours.ts), pour
      // l'activation et Nouveaux arrivants (qui ne garde que ses 30 jours).
      const recents = new Map(
        ((prof.data ?? []) as ProfilBrut[])
          .filter((p) => p.created_at && Date.now() - new Date(p.created_at).getTime() <= FENETRE_ACTIVATION)
          .map((p) => [p.id, p.name] as const)
      );
      const parcours = await lireParcours(sb, recents).catch(() => null);
      setData({ evenements, profiles, studio, reperes, parrains, canaux, filleuls, site, idsAdmins, parcours, now: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lecture impossible.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session?.server || !session.admin) return;
    // Micro-tâche : aucun setState synchrone dans le corps de l'effet.
    Promise.resolve().then(load);
  }, [session?.server, session?.admin, load]);

  if (!session?.admin) {
    // Le rôle qui compte ici est celui de la BASE : c'est lui que les règles
    // de lecture appliquent. Un compte admin dans l'app mais pas encore
    // reconnu en base lit un écran vide sans comprendre pourquoi — on le lui
    // dit, avec le geste qui répare.
    const adminConnu = isAdmin(session?.name);
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-encre-3">
        {adminConnu ? (
          <>
            Ton compte est administrateur dans l&apos;app, mais la base ne le sait pas encore.
            Déconnecte-toi puis reconnecte-toi — si ça ne suffit pas, passe une fois par
            Réglages → Installation Supabase.
          </>
        ) : (
          <>Cette page est réservée à l&apos;admin de la ligue.</>
        )}
      </div>
    );
  }
  if (!session.server) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-encre-3">
        Reconnecte-toi (session serveur) pour lire le journal d&apos;activité.
      </div>
    );
  }

  return (
    <ActiviteVue
      data={data}
      loading={loading}
      onRefresh={load}
      error={error}
      blocs={{
        videos: (public_, admins) => <VideosStats public={public_} admins={admins} />,
        trashTalk: () => <TrashTalkAdmin />,
        agent: (public_, admins) => <AgentStats public={public_} admins={admins} />,
        parrainage: () => <ParrainageStats />,
        revenu: (depuis, actifs, garde) => <Revenu depuis={depuis} actifs={actifs} garde={garde} />,
        accords: (public_, admins) => <AccordsStats public={public_} admins={admins} />,
      }}
    />
  );
}
