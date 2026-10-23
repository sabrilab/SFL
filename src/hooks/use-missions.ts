"use client";

// Les missions du dimanche côté écrans (lib/sfl/missions.ts) : le dimanche en
// cours, mes trois missions avec ma réponse et leur verdict, les missions
// acceptées de toute la ligue (les Contrats en jeu des Actus), les duels
// acceptés des deux côtés, et mon XP. Les réponses se chargent une fois et
// suivent la base en temps réel, quel que soit le nombre d'écrans qui les
// lisent.

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useFelicitations } from "@/hooks/use-felicitations";
import { useIsClient } from "@/hooks/use-is-client";
import { useSession } from "@/hooks/use-session";
import { useVotes } from "@/hooks/use-votes";
import {
  aJoue,
  bilanDe,
  dimancheEnCours,
  engagementsDe,
  journalXp,
  juger,
  reponseDe,
  risqueDe,
  signesContre,
  verdictFinal,
  XP_DIMANCHE,
  XP_PARFAIT,
  type BilanXp,
  type Creneau,
  type DimancheMissions,
  type Duel,
  type Engagement,
  type Mission,
  type Reponse,
  type Verdict,
} from "@/lib/sfl/missions";
import {
  APERCU_MISSIONS,
  chargerReponses,
  MISSIONS_EVENT,
  repondreMission,
  reponsesDemo,
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

/** Avant le coup d'envoi, jusqu'à minuit, puis fini. */
function phaseDe(d: DimancheMissions, maintenant: Date): Phase {
  const t = maintenant.getTime();
  return t < d.coupEnvoi.getTime() ? "ouvert" : t < d.finDuJour.getTime() ? "en-jeu" : "fini";
}

/** Celui dont l'écran montre les missions : moi si je suis sur la feuille ; dans un aperçu, sinon, un joueur de la feuille. */
function vuPar(d: DimancheMissions, me: string): string | null {
  if (d.missions.has(me)) return me;
  return APERCU_MISSIONS ? joueurApercu(d) : null;
}

/**
 * Les réponses telles que les écrans de la ligue les lisent : celles de la
 * base et, dans un aperçu, la ligue simulée autour de celui qu'on regarde.
 * Jamais pour l'XP.
 */
function avecDemo(reponses: Reponse[], d: DimancheMissions, sauf: string | null): Reponse[] {
  const demo = reponsesDemo(d, sauf);
  if (!demo.length) return reponses;
  const meme = (a: Reponse, b: Reponse) =>
    a.saison === b.saison && a.j === b.j && a.mission === b.mission && a.joueur === b.joueur;
  return [...reponses, ...demo.filter((x) => !reponses.some((r) => meme(r, x)))];
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
  /** Ceux qui ont signé un contrat contre toi, ton rival d'abord. */
  contreMoi: string[];
  /** L'XP de ce dimanche, comme dans le journal : le dimanche joué, les primes des missions réussies, les risques des ratées. */
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
    const joueur = vuPar(d, me);
    if (!joueur) return null;
    const phase = phaseDe(d, maintenant);
    const lignes = (d.missions.get(joueur) ?? []).map((m) => {
      const v = juger(m, joueur, d, jugee, votes);
      return { m, reponse: reponseDe(reponses, d, joueur, m), verdict: phase === "fini" ? verdictFinal(v, m) : v };
    });
    const contreMoi = signesContre(d, avecDemo(reponses, d, joueur), joueur);
    const acceptees = lignes.filter((l) => l.reponse?.reponse === "acceptee");
    const gagnees = acceptees.filter((l) => l.verdict.etat === "reussie");
    const xp =
      (d.joue && aJoue(jugee, d.j, joueur) ? XP_DIMANCHE : 0) +
      gagnees.reduce((a, l) => a + l.m.xp, 0) -
      acceptees.filter((l) => l.verdict.etat === "ratee").reduce((a, l) => a + risqueDe(l.m), 0) +
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
    return { d, joueur, apercu, lignes, phase, contreMoi, xp, repondre };
  }, [d, me, maintenant, jugee, votes, reponses]);
}

/** Un duel où les deux rivaux ont signé l'un contre l'autre. */
export interface FaceAFace {
  duel: Duel;
  noirs: Engagement;
  blancs: Engagement;
}

export interface MissionsDeLaLigue {
  d: DimancheMissions;
  phase: Phase;
  /** Celui que l'écran appelle « toi » (null pour qui n'est pas sur la feuille). */
  moi: string | null;
  /** Les duels signés des deux côtés, les plus grosses primes d'abord. */
  faceAFace: FaceAFace[];
  /** Les autres contrats signés, du rang S au rang B. */
  contrats: Engagement[];
  /** Le défi du dimanche et la ligue, signés. */
  defis: Engagement[];
  ligue: Engagement[];
  /** Toutes les missions signées. */
  total: number;
}

/** Les missions acceptées de toute la ligue, pour le dimanche en cours : les Contrats en jeu des Actus. */
export function useMissionsDeLaLigue(): MissionsDeLaLigue | null {
  const isClient = useIsClient();
  const { me } = useMyPlayer();
  const maintenant = useMaintenant();
  const reponses = useReponses();
  const { saison, jugee, votes } = useSaisonJugee(maintenant);

  const d = useMemo(() => (isClient ? dimancheEnCours(saison, maintenant) : null), [isClient, saison, maintenant]);

  return useMemo(() => {
    if (!d) return null;
    const phase = phaseDe(d, maintenant);
    const moi = vuPar(d, me);
    const tout = engagementsDe(d, avecDemo(reponses, d, moi), jugee, votes, phase === "fini");
    const contratDe = new Map(tout.filter((e) => e.m.creneau === "contrat").map((e) => [e.joueur, e]));
    const faceAFace: FaceAFace[] = [];
    for (const duel of d.duels) {
      const noirs = contratDe.get(duel.noirs);
      const blancs = contratDe.get(duel.blancs);
      if (noirs?.m.cibles[0] !== duel.blancs || blancs?.m.cibles[0] !== duel.noirs) continue;
      faceAFace.push({ duel, noirs, blancs });
      contratDe.delete(duel.noirs);
      contratDe.delete(duel.blancs);
    }
    const avant = (n: string) => d.avant.get(n) ?? 0;
    faceAFace.sort((a, b) => b.noirs.m.xp + b.blancs.m.xp - (a.noirs.m.xp + a.blancs.m.xp) || a.duel.terrain - b.duel.terrain);
    const contrats = [...contratDe.values()].sort(
      (a, b) => b.m.xp - a.m.xp || avant(b.joueur) - avant(a.joueur) || a.joueur.localeCompare(b.joueur)
    );
    const parPoints = (a: Engagement, b: Engagement) => avant(b.joueur) - avant(a.joueur) || a.joueur.localeCompare(b.joueur);
    const defis = tout.filter((e) => e.m.creneau === "defi").sort(parPoints);
    const ligue = tout.filter((e) => e.m.creneau === "ligue").sort(parPoints);
    return { d, phase, moi, faceAFace, contrats, defis, ligue, total: tout.length };
  }, [d, me, maintenant, jugee, votes, reponses]);
}

/** Les duels d'une journée acceptés des deux côtés, avant le coup d'envoi. */
export function useDuelsAcceptes(j: number | null | undefined): Duel[] {
  const isClient = useIsClient();
  const { me } = useMyPlayer();
  const maintenant = useMaintenant();
  const reponses = useReponses();
  const { saison } = useSeason();
  return useMemo(() => {
    if (!isClient || j == null) return [];
    const d = dimancheEnCours(saison, maintenant);
    if (!d || d.j !== j) return [];
    const vues = avecDemo(reponses, d, vuPar(d, me));
    const accepte = (joueur: string, cible: string) =>
      vues.some(
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
  }, [isClient, j, me, saison, maintenant, reponses]);
}

/**
 * Mon XP : le niveau à vie et le passe de la saison (masqués compris : chacun
 * voit le sien). Les félicitations reçues et données y comptent (lib/sfl/
 * felicitations.ts), relues au lancement et au retour sur l'app.
 */
export function useXp(nom?: string): BilanXp | null {
  const isClient = useIsClient();
  const { me } = useMyPlayer();
  const maintenant = useMaintenant();
  const reponses = useReponses();
  const { toutes: felicitations } = useFelicitations();
  const { saison, jugee, votes } = useSaisonJugee(maintenant);
  const qui = nom ?? me;
  return useMemo(() => {
    if (!isClient || !qui) return null;
    return bilanDe(journalXp(jugee, reponses, votes, maintenant, felicitations), qui, saison.numero ?? 0);
  }, [isClient, qui, jugee, reponses, votes, maintenant, felicitations, saison.numero]);
}
