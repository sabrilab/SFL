"use client";

// Les missions du dimanche côté écrans (lib/sfl/missions.ts) : le dimanche en
// cours, mes trois missions avec ma réponse et leur verdict, les duels
// acceptés des deux côtés, et mon XP. Les réponses se chargent une fois et
// suivent la base en temps réel, quel que soit le nombre d'écrans qui les
// lisent.

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { useSession } from "@/hooks/use-session";
import { useVotes } from "@/hooks/use-votes";
import {
  aJoue,
  bilanDe,
  dimancheEnCours,
  journalXp,
  juger,
  reponseDe,
  verdictFinal,
  XP_DIMANCHE,
  XP_PARFAIT,
  type BilanXp,
  type Creneau,
  type DimancheMissions,
  type Duel,
  type Mission,
  type Reponse,
  type Verdict,
} from "@/lib/sfl/missions";
import {
  APERCU_MISSIONS,
  chargerReponses,
  MISSIONS_EVENT,
  repondreMission,
  reponsesEnMemoire,
} from "@/lib/sfl/missions-reponses";
import { appliquerVotes } from "@/lib/sfl/votes";
import { supabase } from "@/lib/supabase";

const AUCUNE: Reponse[] = [];
let abonnes = 0;
let arreter: (() => void) | null = null;
let seq = 0;

function abonner(onChange: () => void) {
  window.addEventListener(MISSIONS_EVENT, onChange);
  return () => window.removeEventListener(MISSIONS_EVENT, onChange);
}

/** Charge les réponses et suit la base : un seul abonnement pour tous les écrans. */
function suivre(depuisLaBase: boolean): () => void {
  abonnes++;
  if (abonnes === 1) {
    const charger = () =>
      chargerReponses(depuisLaBase).catch(() => {
        /* base injoignable : on garde ce qu'on a */
      });
    void charger();
    if (depuisLaBase) {
      const sb = supabase();
      try {
        const canal = sb
          .channel(`sfl-missions-${++seq}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "missions_reponses" }, charger)
          .subscribe();
        arreter = () => void sb.removeChannel(canal);
      } catch {
        // Sans temps réel, les réponses se rechargent à la prochaine ouverture.
      }
    }
  }
  return () => {
    abonnes--;
    if (abonnes === 0) {
      arreter?.();
      arreter = null;
    }
  };
}

function useReponses(): Reponse[] {
  const session = useSession();
  const depuisLaBase = !!session?.server;
  useEffect(() => suivre(depuisLaBase), [depuisLaBase]);
  return useSyncExternalStore(abonner, reponsesEnMemoire, () => AUCUNE);
}

/** L'heure, à la minute : le coup d'envoi et minuit se voient sans recharger. */
function useMaintenant(): Date {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(() => new Date(t), [t]);
}

/** La saison telle qu'on la juge : les élus des votes fermés posés sur les lignes. */
function useSaisonJugee(maintenant: Date) {
  const { saison, journees } = useSeason();
  const votes = useVotes();
  const jugee = useMemo(() => appliquerVotes(saison, journees, votes, maintenant), [saison, journees, votes, maintenant]);
  return { saison, jugee, votes };
}

export interface LigneMission {
  m: Mission;
  /** La réponse retenue : donnée avant le coup d'envoi, pour le même rival. */
  reponse: Reponse | null;
  /** Sur la feuille telle qu'elle est ; définitif une fois la journée finie. */
  verdict: Verdict;
}

export type Phase = "ouvert" | "en-jeu" | "fini";

export interface MesMissions {
  d: DimancheMissions;
  joueur: string;
  /** Les missions d'un autre joueur, montrées dans un aperçu quand on n'est pas sur la feuille. */
  apercu: boolean;
  lignes: LigneMission[];
  /** Avant le coup d'envoi, jusqu'à minuit, puis fini. */
  phase: Phase;
  /** Le rival a accepté son contrat contre toi : un duel des deux côtés. */
  enFace: boolean;
  /** L'XP de ce dimanche, comme dans le journal : le dimanche joué, puis les missions acceptées et réussies. */
  xp: number;
  repondre: (creneau: Creneau, reponse: Reponse["reponse"]) => Promise<void>;
}

/** Le joueur dont l'aperçu montre les missions : ?missions=Nom, sinon Bilal, sinon le premier de la feuille. */
function joueurApercu(d: DimancheMissions): string | null {
  let voulu: string | null = null;
  try {
    voulu = new URLSearchParams(window.location.search).get("missions");
  } catch {
    /* hors navigateur */
  }
  for (const n of [voulu, "Bilal"]) if (n && d.missions.has(n)) return n;
  return d.missions.keys().next().value ?? null;
}

/** Mes missions du dimanche en cours ; null sans feuille, ou si je n'y suis pas (hors aperçu). */
export function useMissions(): MesMissions | null {
  const isClient = useIsClient();
  const { me } = useMyPlayer();
  const maintenant = useMaintenant();
  const reponses = useReponses();
  const { saison, jugee, votes } = useSaisonJugee(maintenant);

  const d = useMemo(() => (isClient ? dimancheEnCours(saison, maintenant) : null), [isClient, saison, maintenant]);

  return useMemo(() => {
    if (!d) return null;
    const apercu = !d.missions.has(me) && APERCU_MISSIONS;
    const joueur = apercu ? joueurApercu(d) : d.missions.has(me) ? me : null;
    if (!joueur) return null;
    const t = maintenant.getTime();
    const phase: Phase = t < d.coupEnvoi.getTime() ? "ouvert" : t < d.finDuJour.getTime() ? "en-jeu" : "fini";
    const lignes = (d.missions.get(joueur) ?? []).map((m) => {
      const v = juger(m, joueur, d, jugee, votes);
      return { m, reponse: reponseDe(reponses, d, joueur, m), verdict: phase === "fini" ? verdictFinal(v) : v };
    });
    const contrat = lignes.find((l) => l.m.creneau === "contrat");
    const rival = contrat?.m.genre === "tiens-le" || contrat?.m.genre === "finis-devant" ? contrat.m.cibles[0] : null;
    const enFace =
      !!rival &&
      contrat?.reponse?.reponse === "acceptee" &&
      reponses.some(
        (r) =>
          r.saison === d.saison &&
          r.j === d.j &&
          r.mission === "contrat" &&
          r.joueur === rival &&
          r.cible === joueur &&
          r.reponse === "acceptee" &&
          new Date(r.le).getTime() <= d.coupEnvoi.getTime()
      );
    const gagnees = lignes.filter((l) => l.reponse?.reponse === "acceptee" && l.verdict.etat === "reussie");
    const xp =
      (d.joue && aJoue(jugee, d.j, joueur) ? XP_DIMANCHE : 0) +
      gagnees.reduce((a, l) => a + l.m.xp, 0) +
      (lignes.length === 3 && gagnees.length === 3 ? XP_PARFAIT : 0);
    const repondre = (creneau: Creneau, reponse: Reponse["reponse"]) => {
      const m = lignes.find((l) => l.m.creneau === creneau)?.m;
      return repondreMission({
        saison: d.saison,
        j: d.j,
        mission: creneau,
        joueur,
        reponse,
        cible: creneau === "contrat" ? (m?.cibles[0] ?? null) : null,
      });
    };
    return { d, joueur, apercu, lignes, phase, enFace, xp, repondre };
  }, [d, me, maintenant, jugee, votes, reponses]);
}

/** Les duels d'une journée acceptés des deux côtés, avant le coup d'envoi. */
export function useDuelsAcceptes(j: number | null | undefined): Duel[] {
  const isClient = useIsClient();
  const maintenant = useMaintenant();
  const reponses = useReponses();
  const { saison } = useSeason();
  return useMemo(() => {
    if (!isClient || j == null) return [];
    const d = dimancheEnCours(saison, maintenant);
    if (!d || d.j !== j) return [];
    const accepte = (joueur: string, cible: string) =>
      reponses.some(
        (r) =>
          r.saison === d.saison &&
          r.j === d.j &&
          r.mission === "contrat" &&
          r.joueur === joueur &&
          r.cible === cible &&
          r.reponse === "acceptee" &&
          new Date(r.le).getTime() <= d.coupEnvoi.getTime()
      );
    return d.duels.filter((x) => accepte(x.noirs, x.blancs) && accepte(x.blancs, x.noirs));
  }, [isClient, j, saison, maintenant, reponses]);
}

/** Mon XP : le niveau à vie et le passe de la saison (masqués compris : chacun voit le sien). */
export function useXp(nom?: string): BilanXp | null {
  const isClient = useIsClient();
  const { me } = useMyPlayer();
  const maintenant = useMaintenant();
  const reponses = useReponses();
  const { saison, jugee, votes } = useSaisonJugee(maintenant);
  const qui = nom ?? me;
  return useMemo(() => {
    if (!isClient || !qui) return null;
    return bilanDe(journalXp(jugee, reponses, votes, maintenant), qui, saison.numero ?? 0);
  }, [isClient, qui, jugee, reponses, votes, maintenant, saison.numero]);
}
