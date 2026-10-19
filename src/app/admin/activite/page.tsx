"use client";

// Activité & rétention — le gestionnaire de l'admin.
//
// Cette page lit le journal `activity` (réservé à l'admin par RLS) et la table
// des profils, puis passe le tout à la vue (`vue.tsx`), qui analyse
// (`lib/sfl/retention.ts`) et affiche : conclusions, courbes de croissance,
// rétention par cohorte, gestes qui font revenir, joueurs à relancer.
// Rien n'est agrégé en base, donc rien à maintenir quand on ajoute un type
// d'événement.
//
// Une SESSION d'usage = un identifiant tiré à l'ouverture d'un onglet
// (cf. lib/sfl/activity.ts). Sa durée est le temps passé au premier plan,
// mesuré par les battements réguliers de l'app (cf. lib/sfl/retention.ts).

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { isAdmin } from "@/lib/sfl/admin";
import { supabase } from "@/lib/supabase";
import { ActiviteVue, type DonneesActivite } from "./vue";

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
      const [actData, prof] = await Promise.all([
        lireTout(),
        sb.from("profiles").select("name, contact_email, created_at, is_admin"),
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
        name: string;
        contact_email: string | null;
        created_at: string | null;
        is_admin: boolean | null;
      };
      const profiles = ((prof.data ?? []) as ProfilBrut[]).map((p) => ({
        name: p.name,
        contact_email: p.contact_email,
        created_at: p.created_at ? new Date(p.created_at).getTime() : null,
        // Le rôle en base, ou la liste en dur de l'app (Sabri, Ilyes).
        admin: !!p.is_admin || isAdmin(p.name),
      }));
      setData({ evenements, profiles, now: Date.now() });
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
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-foreground/45">
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
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-foreground/45">
        Reconnecte-toi (session serveur) pour lire le journal d&apos;activité.
      </div>
    );
  }

  return <ActiviteVue data={data} loading={loading} onRefresh={load} error={error} />;
}
