"use client";

// Source unique des données de saison côté joueurs. Charge la saison saisie par
// l'admin (localStorage, seed en repli), en dérive classements / journées /
// cartes boost via le moteur, et re-calcule quand l'admin modifie la saisie
// (événement "sfl-saisie" ou storage cross-onglet). Demain Supabase : seul le
// store change, ce provider et ses consommateurs restent identiques.

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { deriveSeason, type DerivedSeason } from "@/lib/sfl/saisie/engine";
import { saisieStore, seedSaison } from "@/lib/sfl/saisie/store";
import { startSaisonSync } from "@/lib/sfl/saisie/sync";
import type { Saison } from "@/lib/sfl/saisie/types";
import type { Player } from "@/lib/sfl/engine";
import { isHidden, publicOnly } from "@/lib/sfl/hidden";
import { appliquerVotes } from "@/lib/sfl/votes";
import { amorcerDemo, ARBITRES_EVENT, arbitresRevision } from "@/lib/sfl/arbitres";
import { useSuiviVotes, useVotes } from "@/hooks/use-votes";
import { useSession } from "@/hooks/use-session";
import type { Session } from "@/lib/sfl/auth/session";
import { supabase } from "@/lib/supabase";

export const SAISIE_EVENT = "sfl-saisie";

function suivreArbitres(onChange: () => void) {
  window.addEventListener(ARBITRES_EVENT, onChange);
  return () => window.removeEventListener(ARBITRES_EVENT, onChange);
}

interface SeasonValue extends DerivedSeason {
  saison: Saison;
  /**
   * TOUS les joueurs, masqués compris. Réservé aux écrans où quelqu'un se
   * regarde lui-même (sa fiche, sa carte) : partout ailleurs, `players` est la
   * liste publique et c'est elle qu'il faut utiliser.
   */
  allPlayers: Player[];
  /** Le nom du joueur connecté s'il joue en Bola, hors de la SFL (voir joueurBola). */
  bola: string | null;
  /** Change avec la liste des arbitres (masqués des listes) ; absent hors de la saison en cours. */
  arbitres?: number;
}

const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Un joueur Bola (parrainage, 24/10/2026) : connecté et accepté, mais hors de
 * l'effectif de la saison SFL, venu par le lien d'un joueur ou d'une équipe.
 * Il a sa carte à lui, base 75 partout comme un nouveau de la saison, au
 * poste de sa fiche d'inscription, dans `allPlayers` seulement et sur son
 * seul téléphone : aucun classement ni aucune liste de la SFL ne le montre.
 * Avant, il restait sur « Ta carte arrive » (AuthGate) tant que l'admin ne
 * l'ajoutait pas à la saison.
 */
function nomBola(session: Session | null, joueurs: Player[]): string | null {
  const nom = session?.server && !session.enAttente ? session.name : null;
  return nom && !joueurs.some((p) => memeNom(p.name, nom)) ? nom : null;
}

function joueurBola(nom: string | null, poste: string | null): Player | null {
  if (!nom) return null;
  return {
    name: nom,
    poste: poste ?? "—",
    pp: 0,
    matchs: 0,
    buts: 0,
    passes: 0,
    statut: "Actif",
    stats: { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 },
    mvp: 0,
    impact: 0,
    def: 0,
  };
}

/** Le poste qu'un joueur Bola a choisi à l'inscription (sa fiche) : sa carte le porte. */
function usePosteBola(nom: string | null): string | null {
  const [lu, setLu] = useState<{ nom: string; poste: string | null } | null>(null);
  useEffect(() => {
    if (!nom) return;
    let fini = false;
    const sb = supabase();
    sb.auth
      .getUser()
      .then(({ data }) =>
        data.user ? sb.from("fiches").select("poste").eq("player_id", data.user.id).maybeSingle() : null
      )
      .then((r) => {
        if (!fini) setLu({ nom, poste: (r?.data as { poste?: string | null } | null)?.poste ?? null });
      })
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, [nom]);
  return lu && lu.nom === nom ? lu.poste : null;
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
  const derived = useMemo(() => {
    void horloge;
    const brut = deriveSeason(saison);
    const vote = appliquerVotes(saison, brut.journees, votes, new Date());
    return vote === saison ? brut : deriveSeason(vote);
  }, [saison, votes, horloge]);
  const session = useSession();
  const nom = useMemo(() => nomBola(session, derived.players), [session, derived.players]);
  const poste = usePosteBola(nom);
  const bola = useMemo(() => joueurBola(nom, poste), [nom, poste]);
  // Les arbitres (lib/sfl/arbitres) sont masqués comme des joueurs : la
  // liste publique se refait quand la base les donne.
  const arbitres = useSyncExternalStore(suivreArbitres, arbitresRevision, () => -1);
  useEffect(() => amorcerDemo(saison.numero ?? 0, derived.journees), [saison.numero, derived.journees]);
  // `players` est la liste PUBLIQUE : les joueurs masqués n'y sont pas, donc
  // aucun classement, aucune recherche, aucun duel ne peut les faire remonter.
  const value = useMemo<SeasonValue>(
    () => ({
      ...derived,
      players: publicOnly(derived.players),
      boostCards: derived.boostCards.filter((c) => !isHidden(c.player)),
      allPlayers: bola ? [...derived.players, bola] : derived.players,
      bola: bola?.name ?? null,
      saison,
      arbitres,
    }),
    [derived, bola, saison, arbitres]
  );

  return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>;
}

export function useSeason(): SeasonValue {
  const value = useContext(SeasonContext);
  if (!value) throw new Error("useSeason doit être utilisé dans un SeasonProvider");
  return value;
}

const SaisonCloseContext = createContext(false);

/**
 * Lit-on une saison close (SaisonArchiveProvider) ? Rien ne s'y partage au
 * Vestiaire ni ne s'y félicite : le Vestiaire et les félicitations ne
 * connaissent que la saison en cours (une feuille partagée y montrerait la
 * journée du même numéro, mais de cette saison-ci).
 */
export function useSaisonClose(): boolean {
  return useContext(SaisonCloseContext);
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
      bola: null,
      saison,
    };
  }, [saison]);
  return (
    <SeasonContext.Provider value={value}>
      <SaisonCloseContext.Provider value>{children}</SaisonCloseContext.Provider>
    </SeasonContext.Provider>
  );
}
