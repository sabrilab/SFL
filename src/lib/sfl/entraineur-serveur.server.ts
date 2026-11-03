// La carte d'entraîneur de Bola Team, calculée par le SERVEUR (lot B1,
// 03/11/2026 ; Ilyes, 02/11 : trois stats, rés, pré, coh, et la note lente).
// Aucun téléphone ne la calcule : une fois par jour (/api/entraineurs/calcul,
// le cron de vercel.json, ou l'admin), le serveur
//   · lit avec la clé secrète les faits de Bola Team : les places
//     d'entraîneur (equipe_entraineurs), les équipes, leurs membres, leurs
//     signatures et leurs départs, les matchs (equipe_defis), les saisies et
//     les présents (equipe_resultats), les feuilles d'avant-match ;
//   · s'il y a des feuilles, de quoi dire la note de carte de chaque inscrit
//     au coup d'envoi : la saison SFL telle que la ligue la lit (la seule
//     lecture de la saison, saison-serveur.server.ts), les matchs Bola
//     (matchs_bola_serveur) et les entrées en SFL ;
//   · les normes déjà figées (entraineur_normes) et les cartes gardées
//     (entraineur_cartes), qui servent de plancher ;
//   · rejoue toute la carrière de chaque entraîneur (entraineur-faits.ts,
//     entraineur.ts), fige les normes d'une saison finie et lue en entier
//     (figer_normes_entraineur), puis pose les cartes
//     (poser_cartes_entraineur, qui garde la plus haute de chaque
//     caractéristique : rien ne descend).
// Le même calcul deux fois donne la même carte : il repart chaque jour des
// faits, sans rien retenir de la veille que le plancher.
//
// Serveur seulement : la clé secrète (serveur-ligue.server.ts).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormesLigue, StatsEntraineur } from "./entraineur";
import { cartesDeLaLigue, cartesEntraineurs, JOURNAL_GARDE, type LignesEntraineur } from "./entraineur-faits";
import type { MatchBola } from "./ligue-vierge";
import { lireSaisonServeur, toutesLesLignes } from "./saison-serveur.server";

export interface BilanCartesEntraineur {
  statut: "ok" | "erreur";
  /** Les entraîneurs dont la carte a été calculée, et les lignes écrites. */
  entraineurs: number;
  ecrites: number;
  /** Les saisons dont les normes viennent d'être figées. */
  normes: number[];
  ms: number;
  erreur?: string;
}

/** Ce que pose poser_cartes_entraineur, par paquets. */
const PAQUET = 100;

type Ligne<T> = T extends readonly (infer U)[] ? U : never;

export async function calculerCartesEntraineur(sb: SupabaseClient, maintenant = new Date()): Promise<BilanCartesEntraineur> {
  const debut = Date.now();
  const lire = <T>(table: string, colonnes: string, ordre: string[]) => toutesLesLignes<T>(sb, table, colonnes, ordre);
  try {
    const [entraineurs, equipes, membres, signatures, departs, defis, resultats, feuilles, feuilleJoueurs, profils, gardees, figees] = await Promise.all([
      lire<Ligne<LignesEntraineur["entraineurs"]>>("equipe_entraineurs", "equipe_id, joueur, debut, fin, motif", ["id"]),
      lire<Ligne<LignesEntraineur["equipes"]>>("equipes", "id, nom, created_at, dissoute_le", ["id"]),
      lire<Ligne<LignesEntraineur["membres"]>>("equipe_membres", "equipe_id, joueur, statut, role, signe_le, created_at", ["equipe_id", "joueur"]),
      lire<Ligne<LignesEntraineur["signatures"]>>("equipe_signatures", "equipe_id, joueur, le", ["equipe_id", "joueur", "version"]),
      lire<Ligne<LignesEntraineur["departs"]>>("equipe_departs", "equipe_id, joueur, parti_le, motif, role", ["equipe_id", "joueur"]),
      lire<Ligne<LignesEntraineur["defis"]> & { statut: string }>("equipe_defis", "id, de, a, jour, heure, lieu, statut, forfait_de", ["id"]),
      lire<Ligne<LignesEntraineur["resultats"]>>("equipe_resultats", "defi_id, equipe_id, pour, contre, saisi_le, presents, presents_adverses", ["defi_id", "equipe_id"]),
      lire<Ligne<LignesEntraineur["feuilles"]>>("equipe_feuilles", "defi_id, equipe_id, deposee_le", ["defi_id", "equipe_id"]),
      lire<Ligne<LignesEntraineur["feuilleJoueurs"]>>("equipe_feuille_joueurs", "defi_id, equipe_id, joueur", ["defi_id", "joueur"]),
      lire<Ligne<LignesEntraineur["profils"]>>("profiles", "id, name", ["id"]),
      lire<{ joueur: string; res: number; pres: number; coh: number }>("entraineur_cartes", "joueur, res, pres, coh", ["joueur"]),
      lire<{ saison: number; presence: number; departs_par_jour: number }>("entraineur_normes", "saison, presence, departs_par_jour", ["saison"]),
    ]);
    const lignes: LignesEntraineur = {
      entraineurs,
      equipes,
      membres,
      signatures,
      departs,
      // Les matchs programmés ou perdus par forfait : ceux du championnat.
      defis: defis.filter((d): d is Ligne<LignesEntraineur["defis"]> => d.statut === "accepte" || d.statut === "forfait"),
      resultats,
      feuilles,
      feuilleJoueurs,
      profils,
    };

    // La note de carte au coup d'envoi ne sert qu'avec des feuilles : la saison et les matchs Bola seulement alors.
    let cartes = cartesDeLaLigue({ saison: null, maintenant, matchsBola: [] });
    if (feuilles.length > 0) {
      const [lue, bola, entrees] = await Promise.all([
        lireSaisonServeur(sb, maintenant),
        sb.rpc("matchs_bola_serveur"),
        lire<{ joueur: string; le: string }>("entrees_sfl", "joueur, le", ["joueur"]),
      ]);
      if (bola.error) throw bola.error;
      cartes = cartesDeLaLigue({
        saison: lue?.saison ?? null,
        maintenant,
        matchsBola: (bola.data ?? []) as MatchBola[],
        entreesSfl: new Map(entrees.map((e) => [e.joueur, e.le])),
      });
    }

    const normes: Partial<Record<number, NormesLigue>> = {};
    for (const n of figees) normes[n.saison] = { presence: n.presence, departsParJour: n.departs_par_jour };
    const planchers = new Map<string, StatsEntraineur>(gardees.map((c) => [c.joueur, { RES: c.res, PRES: c.pres, COH: c.coh }]));
    const calcul = cartesEntraineurs(lignes, { cartes, normes, planchers, maintenant });

    // Les normes d'abord : une saison figée l'est pour tous les calculs suivants.
    for (const n of calcul.normes) {
      const { error } = await sb.rpc("figer_normes_entraineur", {
        p_saison: n.saison,
        p_presence: n.normes.presence,
        p_departs: n.normes.departsParJour,
      });
      if (error) throw error;
    }
    const aPoser = calcul.cartes.map((c) => ({
      joueur: c.joueur,
      equipe_id: c.equipe,
      res: c.stats.RES,
      pres: c.stats.PRES,
      coh: c.stats.COH,
      rencontres: c.ev.rencontres,
      en_attente: c.ev.enAttente,
      jauges: c.ev.jauges,
      journal: c.ev.journal.slice(-JOURNAL_GARDE),
      majs: c.ev.majs.slice(0, 40),
      compteurs: { ...c.ev.compteurs, reprise: c.ev.reprise, avantProchaine: c.ev.avantProchaine },
    }));
    let ecrites = 0;
    for (let i = 0; i < aPoser.length; i += PAQUET) {
      const { data, error } = await sb.rpc("poser_cartes_entraineur", { p_lignes: aPoser.slice(i, i + PAQUET) });
      if (error) throw error;
      ecrites += Number(data ?? 0);
    }
    return { statut: "ok", entraineurs: calcul.cartes.length, ecrites, normes: calcul.normes.map((n) => n.saison), ms: Date.now() - debut };
  } catch (e) {
    const erreur = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
    return { statut: "erreur", entraineurs: 0, ecrites: 0, normes: [], ms: Date.now() - debut, erreur };
  }
}
