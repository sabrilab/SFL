"use client";

// Toutes les équipes de Bola Team, lues une fois pour tout l'écran (Sabri,
// 24/10 : « quand on clique sur le profil d'un joueur, on peut voir […]
// qu'il fait partie de telle équipe. Cette équipe a une page sur Bola ») :
// le profil d'un joueur et Ma carte y cherchent son équipe
// (equipe/equipe-du-joueur.tsx), la page d'une équipe (/bola-team/[id]) la
// sienne. Relues au retour dans l'app (au plus une fois par minute) et après
// un geste de la page Team (signalerEquipe).
//
// Une équipe en formation (moins de 5 signataires) reste invisible aux
// autres (doc 04 §6) : seuls ses joueurs la voient, sur leur profil comme
// sur sa page.
//
// En aperçu (jamais en production), le monde de démonstration quand il est
// demandé sur l'appareil (?apercu=1 sur la page Team) : les mêmes équipes
// que la page Team et son championnat (lib/sfl/equipes-demo.ts).

import { useMemo, useSyncExternalStore } from "react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useSession } from "@/hooks/use-session";
import { EVT_EQUIPE } from "@/hooks/use-mon-equipe";
import { active, listerEquipes, type Equipe, type Membre } from "@/lib/sfl/equipes";
import { apercuDemande, demoToutesEquipes, ecouterApercu } from "@/lib/sfl/equipes-demo";

interface Lues {
  equipes: Equipe[];
  /** Faux tant que la première lecture n'est pas revenue. */
  charge: boolean;
}

const RIEN: Lues = { equipes: [], charge: false };
const UNE_MINUTE = 60_000;

let lues = RIEN;
let lueLe = 0;
let enCours = false;
const abonnes = new Set<() => void>();
let arreter: (() => void) | null = null;

function publier(l: Lues) {
  lues = l;
  for (const f of abonnes) f();
}

async function lire(force = false) {
  if (enCours || document.visibilityState !== "visible") return;
  if (!force && lues.charge && Date.now() - lueLe < UNE_MINUTE) return;
  enCours = true;
  try {
    const equipes = await listerEquipes();
    lueLe = Date.now();
    publier({ equipes, charge: true });
  } catch {
    // Base injoignable : on garde ce qu'on a.
    if (!lues.charge) publier({ ...lues, charge: true });
  } finally {
    enCours = false;
  }
}

function abonner(f: () => void): () => void {
  abonnes.add(f);
  if (!arreter) {
    const relire = () => void lire();
    const apresGeste = () => void lire(true);
    void lire();
    document.addEventListener("visibilitychange", relire);
    window.addEventListener(EVT_EQUIPE, apresGeste);
    arreter = () => {
      document.removeEventListener("visibilitychange", relire);
      window.removeEventListener(EVT_EQUIPE, apresGeste);
    };
  }
  return () => {
    abonnes.delete(f);
    if (abonnes.size === 0 && arreter) {
      arreter();
      arreter = null;
    }
  };
}

const rienAEcouter = () => () => {};

/** Le monde de démonstration est-il demandé sur cet appareil (aperçu seulement) ? */
export function useApercuTeam(): boolean {
  return useSyncExternalStore(ecouterApercu, apercuDemande, () => false);
}

export function useEquipes(): Lues & { demo: boolean } {
  const session = useSession();
  const connecte = !!session?.server && !session.enAttente;
  const reel = useSyncExternalStore(connecte ? abonner : rienAEcouter, () => lues, () => RIEN);
  const apercu = useApercuTeam();
  const { allPlayers } = useSeason();
  const { me } = useMyPlayer();
  const noms = useMemo(() => allPlayers.filter((p) => p.matchs > 0).map((p) => p.name), [allPlayers]);
  const demo = apercu && noms.length >= 12;
  const monde = useMemo(() => (demo ? demoToutesEquipes(noms, me) : null), [demo, noms, me]);
  if (monde) return { equipes: monde, charge: true, demo: true };
  return { ...(connecte ? reel : RIEN), demo: false };
}

const meme = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Ce que je peux voir d'une équipe : active, ou la mienne (en démonstration, toutes). */
export function visible(e: Equipe, moi: string | null, demo: boolean): boolean {
  return demo || active(e) || (!!moi && e.membres.some((m) => m.statut === "membre" && meme(m.name, moi)));
}

/** L'équipe d'un joueur (par son nom de saison) et sa place dedans ; null s'il n'en a pas, ou si elle m'est cachée. */
export function useEquipeDe(nom: string): { equipe: Equipe; membre: Membre; demo: boolean } | null {
  const { equipes, demo } = useEquipes();
  const { me } = useMyPlayer();
  return useMemo(() => {
    for (const e of equipes) {
      const membre = e.membres.find((m) => m.statut === "membre" && meme(m.name, nom));
      if (membre) return visible(e, me, demo) ? { equipe: e, membre, demo } : null;
    }
    return null;
  }, [equipes, nom, me, demo]);
}
