"use client";

// Ce que la page Activité lit en plus du journal, pour les repères sous les
// courbes (lib/sfl/reperes.ts) et « Qui ramène du monde »
// (lib/sfl/rassembleurs.ts), demandés par Sabri le 24/10 :
//   · push_envois : chaque notification, son motif, son heure, si elle a été
//     touchée, et le joueur dont elle vient (colonne de, depuis le 24/10) ;
//   · mises_en_ligne : les versions posées par le build de production, avec
//     l'historique d'avant la table (lib/sfl/mises-en-ligne.ts) ;
//   · matchs et match_joueurs : les matchs ouverts par les joueurs, et qui y
//     a pris part ; equipe_membres : qui a signé sur l'invitation de qui ;
//     parrainages : qui est venu par qui ;
//   · pour retrouver la source des notifications d'avant le 24/10 : les
//     messages et les réactions du Vestiaire, les félicitations.
// Tout est réservé à l'admin ou lisible par lui (RLS). Une table absente ou
// illisible (un aperçu avant la migration) donne une liste vide : la page
// ne tombe jamais pour ça.

import type { SupabaseClient } from "@supabase/supabase-js";
import { misesEnLigne, type MiseEnLigne } from "@/lib/sfl/mises-en-ligne";
import { sourceDevinee, type EnvoiLien, type Indices, type Lien } from "@/lib/sfl/rassembleurs";
import { estDeLApp, type MatchRepere } from "@/lib/sfl/reperes";

const PAGE = 1000;
/** Garde-fou : on ne lit pas plus que ça de lignes par table. */
const MAX = 200000;

export interface DonneesReperes {
  /** Les notifications, avec leur source : lue, déduite, ou null (l'app, ou on ne sait pas). */
  envois: EnvoiLien[];
  misesEnLigne: MiseEnLigne[];
  /** Les matchs ouverts par les joueurs. */
  matchs: MatchRepere[];
  /** Les liens hors notifications : filleuls, signatures, inscriptions. */
  liens: Lien[];
  /** Les notifications de joueurs dont la source a été déduite (d'avant le 24/10). */
  deduites: number;
}

type Reponse = PromiseLike<{ data: unknown[] | null; error: { code?: string; message: string } | null }>;

/** Toute une table, page par page ; null si elle ne se lit pas. */
async function toutLire<T>(page: (debut: number) => Reponse): Promise<T[] | null> {
  const lu: T[] = [];
  for (let debut = 0; debut < MAX; debut += PAGE) {
    const { data, error } = await page(debut);
    if (error) return null;
    lu.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return lu;
}

const ms = (t: string | null) => (t ? new Date(t).getTime() : null);
const fin = (debut: number) => debut + PAGE - 1;

type EnvoiBrut = {
  user_id: string;
  motif: string;
  ref: string | null;
  envoyee_le: string;
  ouverte_le: string | null;
  de?: string | null;
};

/** Les lectures, en parallèle du journal ; les noms viennent après (assemblerReperes). */
export async function lireReperes(sb: SupabaseClient) {
  const envois = (avecSource: boolean) =>
    toutLire<EnvoiBrut>((debut) =>
      sb
        .from("push_envois")
        .select(`user_id, motif, ref, envoyee_le, ouverte_le${avecSource ? ", de" : ""}`)
        .order("envoyee_le")
        .order("id")
        .range(debut, fin(debut))
    );
  const [lusAvecSource, enBase, matchs, inscrits, equipes, parrainages, vestiaire, reactions, felicitations] =
    await Promise.all([
      envois(true),
      toutLire<{ sha: string; titre: string; pr: number | null; le: string }>((debut) =>
        sb.from("mises_en_ligne").select("sha, titre, pr, le").order("le").range(debut, fin(debut))
      ),
      toutLire<{ id: number; organisateur: string; jour: string; heure: string; lieu: string }>((debut) =>
        sb.from("matchs").select("id, organisateur, jour, heure, lieu").order("id").range(debut, fin(debut))
      ),
      toutLire<{ match_id: number; player_id: string; statut: string; created_at: string }>((debut) =>
        sb
          .from("match_joueurs")
          .select("match_id, player_id, statut, created_at")
          .order("match_id")
          .order("player_id")
          .range(debut, fin(debut))
      ),
      toutLire<{
        equipe_id: number;
        joueur: string;
        statut: string;
        invite_par: string | null;
        signe_le: string | null;
        created_at: string;
      }>((debut) =>
        sb
          .from("equipe_membres")
          .select("equipe_id, joueur, statut, invite_par, signe_le, created_at")
          .order("equipe_id")
          .order("joueur")
          .range(debut, fin(debut))
      ),
      toutLire<{ filleul: string; parrain: string | null; created_at: string }>((debut) =>
        sb.from("parrainages").select("filleul, parrain, created_at").order("filleul").range(debut, fin(debut))
      ),
      toutLire<{ auteur: string; created_at: string }>((debut) =>
        sb.from("messages").select("auteur, created_at").eq("canal", "sfl").order("id").range(debut, fin(debut))
      ),
      toutLire<{
        user_id: string;
        created_at: string;
        messages: { auteur: string; canal: string } | { auteur: string; canal: string }[] | null;
      }>((debut) =>
        sb
          .from("message_reactions")
          .select("user_id, created_at, messages!inner ( auteur, canal )")
          .eq("messages.canal", "sfl")
          .order("created_at")
          .range(debut, fin(debut))
      ),
      toutLire<{ de: string; a: string; exploit: string }>((debut) =>
        sb.from("felicitations").select("de, a, exploit").order("id").range(debut, fin(debut))
      ),
    ]);
  // Avant la migration (un aperçu lit la base de production), la colonne de
  // n'existe pas : on relit sans elle, et toutes les sources se déduisent.
  const lus = lusAvecSource ?? (await envois(false));
  return { lus, enBase, matchs, inscrits, equipes, parrainages, vestiaire, reactions, felicitations };
}

/** Les lectures, nommées (identifiant → nom), reliées et prêtes pour la vue. */
export function assemblerReperes(
  brut: Awaited<ReturnType<typeof lireReperes>>,
  noms: ReadonlyMap<string, string>
): DonneesReperes {
  const nom = (id: string | null | undefined) => (id ? (noms.get(id) ?? null) : null);
  const un = <T>(x: T | T[] | null): T | null => (Array.isArray(x) ? (x[0] ?? null) : x);

  const organisateurs = new Map(
    (brut.matchs ?? []).flatMap((m): [number, string][] => (nom(m.organisateur) ? [[m.id, nom(m.organisateur)!]] : []))
  );
  const indices: Indices = {
    noms,
    vestiaire: (brut.vestiaire ?? []).flatMap((m) => (nom(m.auteur) ? [{ auteur: nom(m.auteur)!, at: ms(m.created_at)! }] : [])),
    reactions: (brut.reactions ?? []).flatMap((r) => {
      const de = nom(r.user_id);
      const auteur = nom(un(r.messages)?.auteur);
      return de && auteur ? [{ de, auteur, at: ms(r.created_at)! }] : [];
    }),
    felicitations: (brut.felicitations ?? []).flatMap((f) =>
      nom(f.de) && nom(f.a) ? [{ de: nom(f.de)!, a: nom(f.a)!, exploit: f.exploit }] : []
    ),
    organisateurs,
    equipes: (brut.equipes ?? []).flatMap((l) =>
      nom(l.joueur)
        ? [{ equipe: l.equipe_id, joueur: nom(l.joueur)!, invitePar: nom(l.invite_par), signe: ms(l.signe_le) }]
        : []
    ),
  };

  let deduites = 0;
  const envois: EnvoiLien[] = (brut.lus ?? []).flatMap((e) => {
    const a = nom(e.user_id);
    if (!a) return [];
    const lu = { a, motif: e.motif, ref: e.ref, envoyee: ms(e.envoyee_le)!, ouverte: ms(e.ouverte_le) };
    let de = nom(e.de);
    if (!de && !e.de && !estDeLApp(e.motif)) {
      de = sourceDevinee(lu, indices);
      if (de) deduites++;
    }
    return [{ ...lu, de }];
  });

  const inscrits = (brut.inscrits ?? []).filter((j) => j.statut === "inscrit");
  const matchs: MatchRepere[] = (brut.matchs ?? []).map((m) => ({
    organisateur: nom(m.organisateur) ?? "?",
    jour: m.jour,
    heure: m.heure,
    lieu: m.lieu,
    joueurs: inscrits.filter((j) => j.match_id === m.id).length,
  }));

  const liens: Lien[] = [
    ...(brut.parrainages ?? []).flatMap((p): Lien[] => {
      const de = nom(p.parrain);
      const a = nom(p.filleul);
      return de && a ? [{ de, a, canal: "parrainage", genre: "venu", at: ms(p.created_at)! }] : [];
    }),
    ...(brut.equipes ?? []).flatMap((l): Lien[] => {
      const de = nom(l.invite_par);
      const a = nom(l.joueur);
      return l.statut === "membre" && de && a
        ? [{ de, a, canal: "equipe", genre: "signe", at: ms(l.signe_le) ?? ms(l.created_at)! }]
        : [];
    }),
    ...inscrits.flatMap((j): Lien[] => {
      const de = organisateurs.get(j.match_id);
      const a = nom(j.player_id);
      return de && a ? [{ de, a, canal: "match", genre: "inscrit", at: ms(j.created_at)! }] : [];
    }),
  ];

  return {
    envois,
    misesEnLigne: misesEnLigne(
      (brut.enBase ?? []).map((m) => ({ sha: m.sha, titre: m.titre, pr: m.pr, le: ms(m.le)! }))
    ),
    matchs,
    liens,
    deduites,
  };
}
