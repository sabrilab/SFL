"use client";

// Source unique des données de saison côté joueurs. Charge la saison saisie par
// l'admin (localStorage, seed en repli), en dérive classements / journées /
// cartes boost via le moteur, et re-calcule quand l'admin modifie la saisie
// (événement "sfl-saisie" ou storage cross-onglet). Demain Supabase : seul le
// store change, ce provider et ses consommateurs restent identiques.

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import { deriveSeason, type DerivedSeason } from "@/lib/sfl/saisie/engine";
import { saisieStore, seedSaison } from "@/lib/sfl/saisie/store";
import { startSaisonSync } from "@/lib/sfl/saisie/sync";
import type { Saison } from "@/lib/sfl/saisie/types";
import type { Player } from "@/lib/sfl/engine";
import { isHidden, publicOnly } from "@/lib/sfl/hidden";
import { appliquerVotes, titresFaibles } from "@/lib/sfl/votes";
import { voteOuvert } from "@/lib/sfl/convocation-temps";
import { amorcerDemo, ARBITRES_EVENT, arbitresRevision } from "@/lib/sfl/arbitres";
import { useSuiviVotes, useVotes } from "@/hooks/use-votes";
import { useSession } from "@/hooks/use-session";
import type { Session } from "@/lib/sfl/auth/session";
import { supabase } from "@/lib/supabase";
import { avecVitrine, vitrineDe, type Vitrine } from "@/lib/sfl/compte-vitrine";
import { useMesMatchsBola } from "@/hooks/use-bola-carte";
import { carteBola, type CarteBola } from "@/lib/sfl/carte-bola";
import { compterMatchs } from "@/lib/sfl/ligue-vierge";

export const SAISIE_EVENT = "sfl-saisie";

function suivreArbitres(onChange: () => void) {
  window.addEventListener(ARBITRES_EVENT, onChange);
  return () => window.removeEventListener(ARBITRES_EVENT, onChange);
}

interface SeasonValue extends DerivedSeason {
  /**
   * La saison À LIRE : celle où les élus des votes fermés (Impact, Défensive)
   * sont posés sur leurs lignes (appliquerVotes), avec ses titres faibles
   * (Saison.titresFaibles). C'est elle que dérivent `players` et tous les
   * classements : un écran qui recompte des points, des rangs, des badges ou
   * des divisions depuis `saison` voit donc les mêmes chiffres que la Ligue.
   * Avant le 27/10, `saison` était le document brut, sans les titres votés :
   * Ma carte, les flèches ▲/▼, les divisions, les badges et les missions
   * comptaient d'autres points que le classement (Ilyes, 7e au lieu de 6e).
   * Ne jamais l'écrire : pour une écriture, `saisonBrute`.
   */
  saison: Saison;
  /**
   * Le document tel qu'il est stocké (compte vitrine compris sur son écran) :
   * le seul à passer à une écriture (saisieStore.save, setPresence…), pour
   * ne jamais figer les élus d'un vote dans le document.
   */
  saisonBrute: Saison;
  /** Même objet que `saison` (ancien nom, gardé pour les appelants). */
  saisonTitree?: Saison;
  /**
   * TOUS les joueurs, masqués compris. Réservé aux écrans où quelqu'un se
   * regarde lui-même (sa fiche, sa carte) : partout ailleurs, `players` est la
   * liste publique et c'est elle qu'il faut utiliser.
   */
  allPlayers: Player[];
  /** Le nom du joueur connecté s'il joue en Bola, hors de la SFL (voir joueurBola). */
  bola: string | null;
  /**
   * Ma carte de joueur Bola (lib/sfl/carte-bola.ts) : celle qui bouge à
   * chaque match validé, mes matchs validés, mes cartes MVP. Aussi pour un
   * ancien joueur Bola entré en SFL (ses matchs d'avant), qui garde ses
   * cartes MVP et son XP ; null pour tous les autres.
   */
  bolaCarte: CarteBola | null;
  /** Change avec la liste des arbitres (masqués des listes) ; absent hors de la saison en cours. */
  arbitres?: number;
  /** Le compte vitrine connecté, et son modèle (compte-vitrine.ts) ; null sinon. */
  vitrine?: Vitrine | null;
}

const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Un joueur Bola (parrainage, 24/10/2026) : connecté et accepté, mais hors de
 * l'effectif de la saison SFL, venu par le lien d'un joueur ou d'une équipe.
 * Il a sa carte à lui, base 75 partout comme un nouveau de la saison, au
 * poste de sa fiche d'inscription, dans `allPlayers` seulement et sur son
 * seul téléphone : aucun classement ni aucune liste de la SFL ne le montre.
 * Depuis le 28/10, elle bouge à chaque match Bola validé (bolaCarte,
 * lib/sfl/carte-bola.ts).
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

  const session = useSession();
  const chemin = usePathname();
  // Le compte vitrine (compte-vitrine.ts) lit en plus les dimanches de son
  // modèle, à son nom, sur son seul écran ; jamais dans l'espace admin.
  const nomSession = session?.server ? session.name : null;
  const horsAdmin = !chemin?.startsWith("/admin");
  // Recalculée quand on entre ou sort de l'admin, pas à chaque page.
  const vitrine = useMemo(
    () => (isClient ? vitrineDe(nomSession, horsAdmin ? null : "/admin") : null),
    [isClient, nomSession, horsAdmin]
  );
  const saison = useMemo(() => {
    void version; // relit le store à chaque incrément de version (édition admin)
    return avecVitrine(isClient ? saisieStore.load() : seedSaison(), vitrine);
  }, [isClient, version, vitrine]);
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
  // Ce que l'horloge change vraiment : quelles journées ont leur vote ouvert
  // (appliquerVotes et titresFaibles ne lisent l'heure que par voteOuvert).
  // Sans cette clé, chaque tic de cinq minutes refaisait une saison neuve, et
  // avec elle tout ce que les écrans rangent à partir d'elle (courbes, rangs,
  // divisions) — depuis que `saison` est la saison des votes (27/10).
  const votesOuverts = useMemo(() => {
    void horloge;
    const maintenant = new Date();
    return saison.journees
      .filter((m) => voteOuvert(m.date, maintenant))
      .map((m) => m.j)
      .join(",");
  }, [saison, horloge]);
  const derived = useMemo(() => {
    void votesOuverts;
    const brut = deriveSeason(saison);
    const maintenant = new Date();
    const vote = appliquerVotes(saison, brut.journees, votes, maintenant);
    // Un titre élu à une seule voix ne fait pas monter la note (saisie/evolution.ts).
    const faibles = titresFaibles(saison, brut.journees, votes, maintenant);
    return { ...(vote === saison && !faibles.size ? brut : deriveSeason(vote, faibles)), saisonTitree: vote, faibles };
  }, [saison, votes, votesOuverts]);
  const nom = useMemo(() => nomBola(session, derived.players), [session, derived.players]);
  const poste = usePosteBola(nom);
  // Mes matchs Bola validés font ma carte (carte-bola.ts) : elle part de 75
  // et bouge à chaque match, au lieu de rester à 75 (avant le 28/10).
  const mesBola = useMesMatchsBola(nom !== null);
  const bolaCarte = useMemo(() => {
    // Entré en SFL : son nom tel que l'effectif l'écrit (memeNom), pour que
    // journal d'XP, cartes MVP et Mes cartes le retrouvent (revue, 28/10).
    const qui = nom ?? (nomSession ? (derived.players.find((p) => memeNom(p.name, nomSession))?.name ?? nomSession) : null);
    if (!mesBola || !qui || (!nom && !mesBola.matchs.length)) return null;
    const comptes = compterMatchs(mesBola.matchs);
    const posteLu = poste ?? comptes.flatMap((m) => m.joueurs).find((j) => j.id === mesBola.uid && j.poste)?.poste ?? null;
    return carteBola(comptes, mesBola.uid, qui, posteLu);
  }, [mesBola, nom, nomSession, poste, derived.players]);
  const bola = useMemo(() => {
    const p = joueurBola(nom, poste);
    return p && bolaCarte && bolaCarte.nom === p.name ? { ...bolaCarte.player, poste: p.poste !== "—" ? p.poste : bolaCarte.player.poste } : p;
  }, [nom, poste, bolaCarte]);
  // Les arbitres (lib/sfl/arbitres) sont masqués comme des joueurs : la
  // liste publique se refait quand la base les donne.
  const arbitres = useSyncExternalStore(suivreArbitres, arbitresRevision, () => -1);
  // La saison à lire : un objet neuf quand la liste des arbitres change, pour
  // que tout ce qui range à partir d'elle (isHidden) se recalcule — la liste
  // vient de la base après le premier rendu, et les mémos d'avant gardaient
  // un arbitre dans les rangs de Ma carte.
  const titree = derived.saisonTitree;
  const cleFaibles = [...derived.faibles].sort().join("|");
  const vue = useMemo<Saison>(() => {
    void arbitres;
    const faibles = cleFaibles ? cleFaibles.split("|") : [];
    return { ...titree, ...(faibles.length ? { titresFaibles: faibles } : {}) };
  }, [titree, cleFaibles, arbitres]);
  useEffect(
    () => amorcerDemo(saison.numero ?? 0, derived.journees, new Set(saison.entries.filter((e) => e.result).map((e) => e.j))),
    [saison.numero, saison.entries, derived.journees]
  );
  // `players` est la liste PUBLIQUE : les joueurs masqués n'y sont pas, donc
  // aucun classement, aucune recherche, aucun duel ne peut les faire remonter.
  const value = useMemo<SeasonValue>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { saisonTitree, faibles, ...derives } = derived;
    return {
      ...derives,
      players: publicOnly(derives.players),
      // Mes cartes MVP de Bola (sur mon seul téléphone) : la cérémonie et Mes cartes les lisent.
      boostCards: [...derives.boostCards.filter((c) => !isHidden(c.player)), ...(bolaCarte?.cartesMvp.map((c) => c.carte) ?? [])],
      // Une liste neuve à chaque recalcul (arbitres compris), pour la même raison que `vue`.
      allPlayers: bola ? [...derives.players, bola] : [...derives.players],
      bola: bola?.name ?? null,
      bolaCarte,
      saison: vue,
      saisonTitree: vue,
      saisonBrute: saison,
      arbitres,
      vitrine,
    };
  }, [derived, bola, bolaCarte, vue, saison, arbitres, vitrine]);

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
      bolaCarte: null,
      saison,
      saisonBrute: saison,
    };
  }, [saison]);
  return (
    <SeasonContext.Provider value={value}>
      <SaisonCloseContext.Provider value>{children}</SaisonCloseContext.Provider>
    </SeasonContext.Provider>
  );
}
