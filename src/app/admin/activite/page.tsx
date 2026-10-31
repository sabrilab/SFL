"use client";

// Activité & rétention — le gestionnaire de l'admin.
//
// Cette page lit le journal `activity` (réservé à l'admin par RLS) et la table
// des profils, puis passe le tout à la vue (`vue.tsx`), qui analyse
// (`lib/sfl/retention.ts`) et affiche : conclusions, courbes de croissance,
// rétention par cohorte, gestes qui font revenir, notifications (qui les a
// activées, ce que chaque motif fait faire : ./notifications.tsx, qui lit ses
// propres tables), pays choisis pour la carte (table photo_studio), joueurs à
// relancer. Sous les courbes, les repères de ce que l'app a fait chaque jour
// (journées, matchs, notifications, mises en ligne), et « Qui ramène du
// monde » : ./lectures.ts lit leurs tables (24/10). En
// dessous, les vidéos de Bola (./videos.tsx : les poser, les publier, qui
// les regarde), le parrainage vers 500 joueurs (./parrainage.tsx), les sujets de
// Bola Agent (./agent.tsx), sans le contenu, puis les accords à la politique
// de confidentialité (./confidentialite.tsx).
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
import { ActiviteVue, type DonneesActivite } from "./vue";
import { lireParcours } from "./parcours";
import { FENETRE_NOUVEAUX } from "./nouveaux";

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
        sb.from("parrainages").select("filleul, parrain"),
      ]);
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
      const parrains = parrainagesBrut.error
        ? null
        : new Map(
            ((parrainagesBrut.data ?? []) as { filleul: string; parrain: string }[]).flatMap((x) => {
              const f = noms.get(x.filleul);
              const pa = noms.get(x.parrain);
              return f && pa ? [[f, pa] as const] : [];
            })
          );
      // Le parcours des comptes de moins de 30 jours (./parcours.ts), pour Nouveaux arrivants.
      const recents = new Map(
        ((prof.data ?? []) as ProfilBrut[])
          .filter((p) => p.created_at && Date.now() - new Date(p.created_at).getTime() <= FENETRE_NOUVEAUX)
          .map((p) => [p.id, p.name] as const)
      );
      const parcours = await lireParcours(sb, recents).catch(() => null);
      setData({ evenements, profiles, studio, reperes, parrains, parcours, now: Date.now() });
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
      pied={(public_, admins) => (
        <>
          <VideosStats public={public_} admins={admins} />
          <ParrainageStats />
          <AgentStats public={public_} admins={admins} />
          <AccordsStats public={public_} admins={admins} />
        </>
      )}
    />
  );
}
