"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import { ARBITRES_EVENT, arbitresRevision, etatArbitres, statsArbitre, type Arbitrage, type EtatArbitres, type StatsArbitre } from "@/lib/sfl/arbitres";
import {
  journalArbitre,
  journeeEnCours,
  journeesArbitre,
  jugerArbitre,
  phaseArbitre,
  reponseArbitreDe,
  type JourneeArbitre,
  type MissionArbitre,
  type PhaseArbitre,
  type ReponseArbitre,
  type VerdictArbitre,
} from "@/lib/sfl/missions-arbitre";
import type { LigneXp } from "@/lib/sfl/missions";
import { passeDe, type BilanPasse } from "@/lib/sfl/passe";
import { EPREUVES_ARBITRE, lireChoixArbitre, type ChoixArbitre } from "@/lib/sfl/passe-arbitre";

function subscribe(onChange: () => void) {
  window.addEventListener(ARBITRES_EVENT, onChange);
  return () => window.removeEventListener(ARBITRES_EVENT, onChange);
}

export interface Arbitres extends EtatArbitres {
  estArbitre: (nom: string) => boolean;
  /** L'arbitre d'un match de la saison en cours. */
  duMatch: (j: number, n: number) => Arbitrage | null;
  /** Les chiffres de sa carte. */
  stats: (nom: string) => StatsArbitre;
  /** Ce qu'il a choisi de porter sur sa carte (passe-arbitre.ts). */
  choix: (nom: string) => ChoixArbitre;
}

const VIDE: EtatArbitres = { arbitres: [], arbitrages: [], avis: {}, mesNotes: {}, habillages: {}, reponses: [], demo: false };

/** Les arbitres de la ligue (lib/sfl/arbitres), leurs matchs et leurs notes ; rien au rendu serveur. */
export function useArbitres(): Arbitres {
  const rev = useSyncExternalStore(subscribe, arbitresRevision, () => -1);
  const { saison } = useSeason();
  return useMemo(() => {
    const e = rev < 0 ? VIDE : etatArbitres();
    const numero = saison.numero ?? 0;
    // Une journée est jouée quand ses résultats sont saisis ; une saison close l'a été.
    const jouees = new Set(saison.entries.filter((x) => x.result).map((x) => x.j));
    const jouee = (s: number, j: number) => (s === numero ? jouees.has(j) : s < numero);
    const arbitres = new Set(e.arbitres);
    return {
      ...e,
      estArbitre: (nom) => arbitres.has(nom),
      duMatch: (j, n) => e.arbitrages.find((a) => a.saison === numero && a.j === j && a.n === n) ?? null,
      stats: (nom) => statsArbitre(nom, e, jouee),
      choix: (nom) => lireChoixArbitre(e.habillages[nom]),
    };
  }, [rev, saison]);
}

export interface LigneMissionArbitre {
  m: MissionArbitre;
  reponse: ReponseArbitre | null;
  verdict: VerdictArbitre;
}

export interface MissionsArbitre {
  /** La journée des missions : la prochaine, ou celle dont le verdict attend. */
  d: JourneeArbitre | null;
  phase: PhaseArbitre | null;
  lignes: LigneMissionArbitre[];
  /** Son journal d'XP, du plus récent au plus ancien, et le passe de la saison. */
  journal: LigneXp[];
  passe: BilanPasse;
  /** L'XP de la saison. */
  xp: number;
}

/** L'heure, relue toutes les 30 s : la fiche passe d'elle-même au coup d'envoi. */
function useMaintenant(): Date {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setT(new Date()), 30000);
    return () => window.clearInterval(id);
  }, []);
  return t;
}

/** Les missions et le passe d'un arbitre (missions-arbitre.ts, passe-arbitre.ts). */
export function useMissionsArbitre(nom: string): MissionsArbitre {
  const a = useArbitres();
  const { saison } = useSeason();
  const maintenant = useMaintenant();
  return useMemo(() => {
    const numero = saison.numero ?? 0;
    const journees = journeesArbitre(saison, nom, a.arbitrages, maintenant);
    const d = journeeEnCours(journees, numero, maintenant);
    const lignes = d
      ? d.missions.map((m) => ({
          m,
          reponse: reponseArbitreDe(a.reponses, d, m.creneau),
          verdict: jugerArbitre(m, d, a.avis, maintenant),
        }))
      : [];
    const journal = journalArbitre(journees, a.reponses, a.avis, maintenant);
    const duneSaison = journal.filter((l) => l.saison === numero);
    return {
      d,
      phase: d ? phaseArbitre(d, maintenant) : null,
      lignes,
      journal,
      passe: passeDe(duneSaison, EPREUVES_ARBITRE),
      xp: Math.max(0, duneSaison.reduce((s, l) => s + l.xp, 0)),
    };
  }, [a, saison, nom, maintenant]);
}
