"use client";

// Les discussions de mes matchs à venir : pour chaque match dont je suis et
// où l'on a écrit, ce que je n'ai pas lu (lib/sfl/discussion-match.ts,
// chargerApercus). La Map en fait la bulle de messages au coin du sticker du
// match et le nombre sur sa carte ; la barre d'onglets, sa pastille et celle
// de l'icône.
//
// Un seul chargement et un seul abonnement temps réel pour tout l'écran,
// quel que soit le nombre de composants qui lisent : l'état vit ici, ils s'y
// abonnent. Recompté à l'ouverture, au retour dans l'app, à chaque message
// d'un match, quand j'entre dans un match ou en sors, et dès qu'une
// discussion est lue.

import { useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { EVT_LU_MATCH, chargerApercus, ecouterDiscussions, type ApercuDiscussion } from "@/lib/sfl/discussion-match";
import { monId } from "@/lib/sfl/matchs";

export interface Discussions {
  apercus: Map<number, ApercuDiscussion>;
  /** Tous mes non lus, d'un match à l'autre. */
  nonLus: number;
}

const VIDE: Discussions = { apercus: new Map(), nonLus: 0 };
let etat = VIDE;
const abonnes = new Set<() => void>();
let arreter: (() => void) | null = null;

function publier(e: Discussions) {
  etat = e;
  for (const f of abonnes) f();
}

function lancer(): () => void {
  let vivant = true;
  let enCours = false;
  let encore = false;
  let tempsReel = false;
  let stopTempsReel = () => {};

  const charger = async () => {
    if (!vivant || document.visibilityState !== "visible") return;
    // Une rafale d'événements : une lecture en cours, une seule après elle.
    if (enCours) {
      encore = true;
      return;
    }
    enCours = true;
    try {
      const moi = await monId();
      const apercus = moi ? await chargerApercus(moi) : new Map<number, ApercuDiscussion>();
      if (vivant) publier({ apercus, nonLus: [...apercus.values()].reduce((s, a) => s + a.nonLus, 0) });
      if (vivant && moi && !tempsReel) {
        tempsReel = true;
        stopTempsReel = ecouterDiscussions(moi, () => void charger());
      }
    } catch {
      /* base injoignable : on garde ce qu'on a */
    } finally {
      enCours = false;
      if (encore && vivant) {
        encore = false;
        void charger();
      }
    }
  };
  const recompter = () => void charger();

  recompter();
  window.addEventListener(EVT_LU_MATCH, recompter);
  document.addEventListener("visibilitychange", recompter);
  return () => {
    vivant = false;
    stopTempsReel();
    window.removeEventListener(EVT_LU_MATCH, recompter);
    document.removeEventListener("visibilitychange", recompter);
    etat = VIDE;
  };
}

function abonner(f: () => void): () => void {
  abonnes.add(f);
  arreter ??= lancer();
  return () => {
    abonnes.delete(f);
    if (abonnes.size === 0 && arreter) {
      arreter();
      arreter = null;
    }
  };
}

const rienAEcouter = () => () => {};

export function useDiscussionsMatch(): Discussions {
  const session = useSession();
  const actif = !!session?.server && !session.enAttente;
  const d = useSyncExternalStore(
    actif ? abonner : rienAEcouter,
    () => etat,
    () => VIDE
  );
  return actif ? d : VIDE;
}
