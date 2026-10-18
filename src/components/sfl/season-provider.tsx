"use client";

// Source unique des données de saison côté joueurs. Charge la saison saisie par
// l'admin (localStorage, seed en repli), en dérive classements / journées /
// cartes boost via le moteur, et re-calcule quand l'admin modifie la saisie
// (événement "sfl-saisie" ou storage cross-onglet). Demain Supabase : seul le
// store change, ce provider et ses consommateurs restent identiques.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { deriveSeason, type DerivedSeason } from "@/lib/sfl/saisie/engine";
import { saisieStore, seedSaison } from "@/lib/sfl/saisie/store";
import { startSaisonSync } from "@/lib/sfl/saisie/sync";
import type { Saison } from "@/lib/sfl/saisie/types";
import type { Player } from "@/lib/sfl/engine";
import { isHidden, publicOnly } from "@/lib/sfl/hidden";
import { appliquerVotes } from "@/lib/sfl/votes";
import { useSuiviVotes, useVotes } from "@/hooks/use-votes";
import { appliquerDirect } from "@/lib/sfl/direct";
import { useFeuillesDirect, useSuiviDirect } from "@/hooks/use-direct";

export const SAISIE_EVENT = "sfl-saisie";

interface SeasonValue extends DerivedSeason {
  saison: Saison;
  /**
   * TOUS les joueurs, masqués compris. Réservé aux écrans où quelqu'un se
   * regarde lui-même (sa fiche, sa carte) : partout ailleurs, `players` est la
   * liste publique et c'est elle qu'il faut utiliser.
   */
  allPlayers: Player[];
}

const SeasonContext = createContext<SeasonValue | null>(null);

export function SeasonProvider({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // setState dans un callback d'événement (pas dans le corps de l'effet).
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener(SAISIE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SAISIE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Synchronisation avec la base : tirage immédiat + temps réel. Relancée à
  // chaque changement de session (une connexion serveur peut arriver après).
  useEffect(() => {
    let stop = startSaisonSync();
    const restart = () => {
      stop();
      stop = startSaisonSync();
    };
    window.addEventListener("sfl-session", restart);
    return () => {
      stop();
      window.removeEventListener("sfl-session", restart);
    };
  }, []);

  const saison = useMemo(() => {
    void version; // relit le store à chaque incrément de version (édition admin)
    return isClient ? saisieStore.load() : seedSaison();
  }, [isClient, version]);
  // Les votes Impact / Défensive : leurs élus sont posés sur les lignes une
  // fois le vote fermé (minuit, heure de Paris). L'horloge avance toutes les
  // cinq minutes pour que la fermeture se voie sans recharger.
  useSuiviVotes(saison.numero ?? 0);
  const votes = useVotes();
  const [horloge, setHorloge] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setHorloge((h) => h + 1), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  // Les feuilles de match tenues en direct par un joueur (lib/sfl/direct.ts) :
  // leurs chiffres passent avant ceux du document pour leur match.
  useSuiviDirect(saison.numero ?? 0);
  const feuilles = useFeuillesDirect();
  const derived = useMemo(() => {
    void horloge;
    const vivante = appliquerDirect(saison, feuilles);
    const brut = deriveSeason(vivante);
    const vote = appliquerVotes(vivante, brut.journees, votes, new Date());
    return vote === vivante ? brut : deriveSeason(vote);
  }, [saison, feuilles, votes, horloge]);
  // `players` est la liste PUBLIQUE : les joueurs masqués n'y sont pas, donc
  // aucun classement, aucune recherche, aucun duel ne peut les faire remonter.
  const value = useMemo<SeasonValue>(
    () => ({
      ...derived,
      players: publicOnly(derived.players),
      boostCards: derived.boostCards.filter((c) => !isHidden(c.player)),
      allPlayers: derived.players,
      saison,
    }),
    [derived, saison]
  );

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason(): SeasonValue {
  const value = useContext(SeasonContext);
  if (!value) throw new Error("useSeason doit être utilisé dans un SeasonProvider");
  return value;
}

/**
 * Une saison close, servie comme la saison en cours : tout ce qui lit
 * `useSeason()` dessous (le récap éditorial d'une journée, par exemple) voit
 * l'archive. Lecture seule — l'archive ne se modifie pas.
 */
export function SaisonArchiveProvider({ saison, children }: { saison: Saison; children: React.ReactNode }) {
  const value = useMemo<SeasonValue>(() => {
    const derived = deriveSeason(saison);
    return {
      ...derived,
      players: publicOnly(derived.players),
      boostCards: derived.boostCards.filter((c) => !isHidden(c.player)),
      allPlayers: derived.players,
      saison,
    };
  }, [saison]);
  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}
