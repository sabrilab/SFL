"use client";

// Le Flair côté écrans (lib/sfl/pronos.ts) : la journée en cours, mes choix,
// ce que pense la ligue, et le verdict ; montré sur les feuilles de match
// (matchs/flair.tsx). Les choix de saison déjà posés comptent toujours
// (ajouterPronos) ; l'app ne propose plus d'en poser.
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
  choixDeSaisonDu,
  classementFlair,
  etatDe,
  flairsDuJoueur,
  journeeDesPronos,
  partsDe,
  plafondDe,
  pronoRetenu,
  SUJETS_JOUR,
  SUJETS_MATCH,
  resultatsDeJournee,
  type ChoixDeSaison,
  type EtatProno,
  type FlairDeJournee,
  type JourneePronos,
  type Prono,
  type RangFlair,
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
  /** Mon plafond d'XP de la journée : la feuille (100) ou la tribune (150). */
  plafond: number;
  poser: (sujet: string, choix: string | null) => Promise<void>;
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
    const tous = [
      ...p.matchs.flatMap((m) => SUJETS_MATCH.filter((g) => g !== "duel" || m.duel).map((g) => `${g}:${m.n}`)),
      ...SUJETS_JOUR,
    ];
    for (const sujet of tous) {
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
    return { p, joueur, phase, sujets, poser, plafond: plafondDe(p, joueur) };
  }, [p, me, maintenant, pronos, jugee, players]);
}

export interface MonFlair {
  /** Le classement du Flair de la saison en cours, et ma place (null si je n'y suis pas). */
  classement: RangFlair[];
  rang: number | null;
  /** Mes journées de Flair, toutes saisons, de la plus récente à la plus ancienne. */
  journees: FlairDeJournee[];
  /** Mes choix de saison, saison en cours d'abord. */
  saison: (ChoixDeSaison & { numero: number; close: boolean })[];
  /** L'XP que le Flair m'a rapporté cette saison (journées finies). */
  xpSaison: number;
  /** La journée en cours, si ses équipes sont faites (pour choisir, même sans rien avoir posé). */
  enCours: MesPronos | null;
}

/**
 * Mon Flair, pour Ma carte et les récaps (Sabri, 30/10) : chaque journée où
 * j'ai choisi, ce que j'ai choisi, le verdict, l'XP. Lit la saison jugée
 * (votes posés), comme le journal d'XP, et ses archives, closes.
 */
export function useMonFlair(): MonFlair | null {
  const isClient = useIsClient();
  const { me } = useMyPlayer();
  const maintenant = useMaintenant();
  const pronos = useListePronos();
  const { jugee } = useSaisonJugee(maintenant);
  const enCours = usePronosJournee();
  return useMemo(() => {
    if (!isClient || !me) return null;
    const numero = jugee.numero ?? 0;
    const saisons = [
      { numero, lue: jugee, close: false, reference: maintenant },
      ...[...(jugee.archives ?? [])].reverse().map((a) => ({ numero: a.numero, lue: a, close: true, reference: new Date(a.cloturee) })),
    ];
    const journees = saisons.flatMap((sa) => flairsDuJoueur(sa.lue, sa.numero, sa.close, pronos, me, maintenant, sa.reference));
    const saison = saisons.flatMap((sa) =>
      choixDeSaisonDu(sa.lue, sa.numero, sa.close, pronos, me, sa.reference).map((c) => ({ ...c, numero: sa.numero, close: sa.close }))
    );
    const xpSaison = journees.filter((f) => f.saison === numero && f.phase === "fini").reduce((a, f) => a + f.xp, 0);
    const classement = classementFlair(jugee, numero, false, pronos, maintenant, maintenant);
    const i = classement.findIndex((r) => r.joueur === me);
    return { journees, saison, xpSaison, classement, rang: i < 0 ? null : i + 1, enCours: enCours && enCours.joueur === me ? enCours : null };
  }, [isClient, me, jugee, pronos, maintenant, enCours]);
}
