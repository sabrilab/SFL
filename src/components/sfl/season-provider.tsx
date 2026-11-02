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
import { sansBrouillons } from "@/lib/sfl/saisie/brouillon";
import { startSaisonSync } from "@/lib/sfl/saisie/sync";
import type { Saison } from "@/lib/sfl/saisie/types";
import type { Journee, Player } from "@/lib/sfl/engine";
import { isHidden, publicOnly } from "@/lib/sfl/hidden";
import { appliquerVotes, titresFaibles, votesCharges } from "@/lib/sfl/votes";
import { figer, journeesComptees, prochaineTransition, voteOuvertA } from "@/lib/sfl/revelation";
import { etatDivisions, type EtatDivisions } from "@/lib/sfl/divisions";
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
   * Ne jamais l'écrire : une écriture part de saisieStore.load().
   *
   * Depuis le 02/11/2026, elle est FIGÉE jusqu'à la révélation
   * (revelation.ts, figer) : une journée du nouveau régime jouée en direct
   * n'y compte qu'à 19 h (la fin du vote + 1 h). Le direct, c'est `saisonLue`
   * et `journeesDirect`.
   */
  saison: Saison;
  /**
   * La saison lue, sans les votes appliqués (compte vitrine compris sur son
   * écran) et, comme tout ce que la ligue voit, SANS les journées en
   * brouillon (30/10/2026, saisie/brouillon.ts). Jamais à écrire telle
   * quelle : une écriture part toujours du document entier,
   * saisieStore.load() (sinon elle effacerait le brouillon — integrite.ts, I8).
   */
  saisonLue: Saison;
  /**
   * Les journées du direct (computeJournees(saisonLue)) : la feuille en
   * cours, le score « En direct », le vote. `journees`, lui, est celui de la
   * vue figée.
   */
  journeesDirect: Journee[];
  /** Les divisions de la vue figée : un seul découpage, tiré des mêmes points que `players`. */
  divisions: EtatDivisions | null;
  /** Les journées qui comptent, et la prochaine heure où la vue peut changer (fin du vote, révélation, minuit). */
  revelation: { comptees: Set<number>; prochaine: Date | null };
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
    // Ce que voit la ligue : jamais une journée en brouillon (brouillon.ts).
    return avecVitrine(sansBrouillons(isClient ? saisieStore.load() : seedSaison()), vitrine);
  }, [isClient, version, vitrine]);
  // Les votes Impact / Défensive : leurs élus sont posés sur les lignes à la
  // révélation (revelation.ts : 19 h dès la J5, minuit jusqu'à la J4).
  useSuiviVotes(saison.numero ?? 0);
  const votes = useVotes();
  // Les votes doivent être là avant la révélation : sans eux, la journée
  // serait coupée sans ses titres, puis recoupée une seconde plus tard.
  const votesPrets = !session?.server || votesCharges();
  // L'horloge : un minuteur réglé sur la prochaine fin de vote, révélation ou
  // minuit (borné entre 1 s et 5 min), et un recalcul au retour au premier
  // plan. 19 h se voit à 19 h, pas à 19 h 04.
  const [horloge, setHorloge] = useState(0);
  useEffect(() => {
    let id = 0;
    const armer = () => {
      window.clearTimeout(id);
      const maintenant = Date.now();
      const prochaine = prochaineTransition(saison, new Date(maintenant));
      const attente = prochaine ? prochaine.getTime() - maintenant + 250 : 5 * 60_000;
      id = window.setTimeout(() => {
        setHorloge((h) => h + 1);
        armer();
      }, Math.min(5 * 60_000, Math.max(1000, attente)));
    };
    const auPremierPlan = () => {
      if (document.visibilityState === "visible") {
        setHorloge((h) => h + 1);
        armer();
      }
    };
    armer();
    document.addEventListener("visibilitychange", auPremierPlan);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("visibilitychange", auPremierPlan);
    };
  }, [saison]);
  // Ce que l'horloge change vraiment : quelles journées comptent, et
  // lesquelles ont leur vote ouvert (appliquerVotes, titresFaibles et figer
  // ne lisent l'heure que par là). Sans cette clé, chaque tic refaisait une
  // saison neuve, et avec elle tout ce que les écrans rangent à partir d'elle
  // (courbes, rangs, divisions).
  const etatDesJournees = useMemo(() => {
    void horloge;
    const maintenant = new Date();
    const comptees = [...journeesComptees(saison, maintenant, { votesPrets })].sort((a, b) => a - b).join(",");
    const ouverts = saison.journees
      .filter((m) => voteOuvertA(saison, m.j, maintenant))
      .map((m) => m.j)
      .join(",");
    return `${comptees}|${ouverts}`;
  }, [saison, horloge, votesPrets]);
  const derived = useMemo(() => {
    void etatDesJournees;
    const brut = deriveSeason(saison);
    const maintenant = new Date();
    const vote = appliquerVotes(saison, brut.journees, votes, maintenant);
    // Un titre élu à une seule voix ne fait pas monter la note (saisie/evolution.ts).
    // Il ne porte que sur les journées comptées (titresTombes, comme les élus).
    const faibles = titresFaibles(saison, brut.journees, votes, maintenant);
    // La vue figée : ce que la ligue voit jusqu'à la révélation (revelation.ts).
    const vue = figer(vote, maintenant, { votesPrets });
    return {
      ...(vue === saison && !faibles.size ? brut : deriveSeason(vue, faibles)),
      saisonTitree: vue,
      faibles,
      journeesDirect: brut.journees,
      revelation: { comptees: journeesComptees(saison, maintenant, { votesPrets }), prochaine: prochaineTransition(saison, maintenant) },
    };
  }, [saison, votes, etatDesJournees, votesPrets]);
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
  // Un seul découpage par vue : points et divisions viennent du même objet.
  const divisions = useMemo(() => etatDivisions(vue), [vue]);
  useEffect(
    () => amorcerDemo(saison.numero ?? 0, derived.journees, new Set(saison.entries.filter((e) => e.result).map((e) => e.j))),
    [saison.numero, saison.entries, derived.journees]
  );
  // `players` est la liste PUBLIQUE : les joueurs masqués n'y sont pas, donc
  // aucun classement, aucune recherche, aucun duel ne peut les faire remonter.
  const value = useMemo<SeasonValue>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { saisonTitree, faibles, journeesDirect, revelation, ...derives } = derived;
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
      saisonLue: saison,
      journeesDirect,
      divisions,
      revelation,
      arbitres,
      vitrine,
    };
  }, [derived, bola, bolaCarte, vue, saison, arbitres, vitrine, divisions]);

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
    // Une saison close compte toutes ses journées : rien n'y est figé.
    const derived = deriveSeason(saison);
    return {
      ...derived,
      players: publicOnly(derived.players),
      boostCards: derived.boostCards.filter((c) => !isHidden(c.player)),
      allPlayers: derived.players,
      bola: null,
      bolaCarte: null,
      saison,
      saisonLue: saison,
      journeesDirect: derived.journees,
      divisions: etatDivisions(saison),
      revelation: { comptees: new Set(saison.journees.map((m) => m.j)), prochaine: null },
    };
  }, [saison]);
  return (
    <SeasonContext.Provider value={value}>
      <SaisonCloseContext.Provider value>{children}</SaisonCloseContext.Provider>
    </SeasonContext.Provider>
  );
}
