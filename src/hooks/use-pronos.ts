"use client";

// Les pronos Bola côté écrans (lib/sfl/pronos.ts) : ceux de la journée en
// cours et ceux de la saison, mes choix, ce que pense la ligue, et le verdict.
// Les pronos se chargent une fois et suivent la base en temps réel, quel que
// soit le nombre d'écrans qui les lisent (comme les réponses aux missions).

import { useMemo } from "react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { useMaintenant, useSaisonJugee } from "@/hooks/use-missions";
import { useListePronos } from "@/hooks/use-liste-pronos";
import { rankPlayers } from "@/lib/sfl/engine";
import {
  etatDe,
  J_SAISON,
  journeeDesPronos,
  partsDe,
  primeAu,
  pronoRetenu,
  resultatsDeJournee,
  resultatsDeSaison,
  SUJETS_SAISON,
  type EtatProno,
  type JourneePronos,
  type Prono,
  type SujetSaison,
} from "@/lib/sfl/pronos";
import { APERCU_PRONOS, pronosDemo, pronostiquer } from "@/lib/sfl/pronos-store";

export type PhaseProno = "ouvert" | "en-jeu" | "fini";

export interface SujetVu {
  sujet: string;
  /** Mon choix, tel que je l'ai posé (même après le coup d'envoi). */
  choix: string | null;
  /** Retenu pour l'XP : posé à temps et permis. */
  etat: EtatProno | "hors-delai";
  /** Les bonnes réponses, une fois la feuille remplie. */
  bons: string[] | null;
  /** Ce que pense la ligue : [choix, nombre][]. */
  parts: [string, number][];
}

export interface MesPronos {
  p: JourneePronos;
  /** Celui qui pronostique : moi, ou dans un aperçu un joueur de la feuille. */
  joueur: string;
  phase: PhaseProno;
  sujets: Map<string, SujetVu>;
  poser: (sujet: string, choix: string | null) => Promise<void>;
}

export interface MesPronosSaison {
  saison: number;
  joueur: string;
  /** Les joueurs qu'on peut choisir, dans l'ordre du Pépite d'Or. */
  candidats: string[];
  /** La prime d'un choix posé maintenant. */
  primeMaintenant: number;
  sujets: Map<SujetSaison, SujetVu & { prime: number | null }>;
  poser: (sujet: SujetSaison, choix: string | null) => Promise<void>;
}

/** Celui qui pronostique : moi ; dans un aperçu sans nom, le premier joueur de la feuille. */
function quiPronostique(me: string, joueurs: string[]): string | null {
  if (me) return me;
  return APERCU_PRONOS ? (joueurs[0] ?? null) : null;
}

function avecDemo(pronos: Prono[], demo: Prono[]): Prono[] {
  if (!demo.length) return pronos;
  const cle = (x: Prono) => `${x.saison}|${x.j}|${x.sujet}|${x.joueur}`;
  const vus = new Set(pronos.map(cle));
  return [...pronos, ...demo.filter((x) => !vus.has(cle(x)))];
}

/** Les pronos de la journée en cours ; null tant que ses équipes ne sont pas faites. */
export function usePronosJournee(): MesPronos | null {
  const isClient = useIsClient();
  const { me } = useMyPlayer();
  const { players } = useSeason();
  const maintenant = useMaintenant();
  const pronos = useListePronos();
  const { saison, jugee } = useSaisonJugee(maintenant);
  const p = useMemo(() => (isClient ? journeeDesPronos(saison, maintenant) : null), [isClient, saison, maintenant]);
  return useMemo(() => {
    if (!p) return null;
    const joueur = quiPronostique(me, p.joueurs);
    if (!joueur) return null;
    const t = maintenant.getTime();
    const phase: PhaseProno = t < p.coupEnvoi.getTime() ? "ouvert" : t < p.finDuJour.getTime() ? "en-jeu" : "fini";
    const vus = avecDemo(pronos, pronosDemo(p, p.saison, rankPlayers(players).map((x) => x.name), joueur));
    const res = p.joue ? resultatsDeJournee(p, jugee.entries) : new Map<string, string[]>();
    const sujets = new Map<string, SujetVu>();
    for (const sujet of [...p.matchs.map((m) => `match:${m.n}`), "buteur", "pepite"]) {
      const mien = pronos.find((x) => x.saison === p.saison && x.j === p.j && x.sujet === sujet && x.joueur === joueur);
      const retenu = pronoRetenu(pronos, p, joueur, sujet);
      sujets.set(sujet, {
        sujet,
        choix: mien?.choix ?? null,
        etat: mien && !retenu ? "hors-delai" : etatDe(retenu, res),
        bons: res.get(sujet) ?? null,
        parts: partsDe(vus, p.saison, p.j, sujet),
      });
    }
    const poser = (sujet: string, choix: string | null) => pronostiquer({ saison: p.saison, j: p.j, sujet, joueur, choix });
    return { p, joueur, phase, sujets, poser };
  }, [p, me, maintenant, pronos, jugee, players]);
}

/** Les pronos de la saison en cours : Pépite d'Or, meilleur buteur, meilleur passeur. */
export function usePronosSaison(): MesPronosSaison | null {
  const isClient = useIsClient();
  const { me } = useMyPlayer();
  const { players } = useSeason();
  const maintenant = useMaintenant();
  const pronos = useListePronos();
  const { saison } = useSaisonJugee(maintenant);
  return useMemo(() => {
    if (!isClient) return null;
    const numero = saison.numero ?? 0;
    const candidats = rankPlayers(players).map((x) => x.name);
    const joueur = quiPronostique(me, candidats);
    if (!joueur || !candidats.length) return null;
    const vus = avecDemo(pronos, pronosDemo(null, numero, candidats, joueur));
    const primeMaintenant = primeAu(saison, numero, maintenant, maintenant);
    // Les meneurs du moment, pour dire « en tête aujourd'hui » : la saison n'est jugée qu'à sa clôture.
    const meneurs = resultatsDeSaison(saison);
    const sujets = new Map<SujetSaison, SujetVu & { prime: number | null }>();
    for (const sujet of SUJETS_SAISON) {
      const mien = pronos.find((x) => x.saison === numero && x.j === J_SAISON && x.sujet === sujet && x.joueur === joueur);
      sujets.set(sujet, {
        sujet,
        choix: mien?.choix ?? null,
        etat: "attente",
        bons: meneurs.get(sujet) ?? null,
        parts: partsDe(vus, numero, J_SAISON, sujet),
        prime: mien ? primeAu(saison, numero, new Date(mien.le), maintenant) : null,
      });
    }
    const poser = (sujet: SujetSaison, choix: string | null) =>
      pronostiquer({ saison: numero, j: J_SAISON, sujet, joueur, choix });
    return { saison: numero, joueur, candidats, primeMaintenant, sujets, poser };
  }, [isClient, saison, players, me, pronos, maintenant]);
}
