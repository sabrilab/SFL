"use client";

// Mes conversations privées (lib/sfl/messages-prives.ts) et ce que je n'en
// ai pas lu. La page Messages en fait sa liste ; le bouton Messages du
// Vestiaire et la bulle de la barre d'onglets, leur nombre ; la barre
// d'onglets, la pastille de l'icône.
//
// Un seul chargement et un seul abonnement temps réel pour tout l'écran,
// comme mon équipe (hooks/use-mon-equipe.ts). Recompté à l'ouverture, au
// retour dans l'app, à chaque message privé et dès qu'une conversation est lue.

import { useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { EVT_LU_PRIVE, chargerConversations, ecouterPrives, type Conversation } from "@/lib/sfl/messages-prives";
import { monId } from "@/lib/sfl/matchs";

export interface MessagesPrives {
  /** La plus récente en haut. */
  conversations: Conversation[];
  /** Tout ce que je n'ai pas lu. */
  nonLus: number;
  /** Faux tant que le premier chargement n'est pas revenu. */
  charge: boolean;
}

const VIDE: MessagesPrives = { conversations: [], nonLus: 0, charge: false };

let etat = VIDE;
const abonnes = new Set<() => void>();
let arreter: (() => void) | null = null;

function publier(e: MessagesPrives) {
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
      const conversations = moi ? await chargerConversations(moi) : [];
      if (vivant && conversations)
        publier({ conversations, nonLus: conversations.reduce((n, c) => n + c.nonLus, 0), charge: true });
      else if (vivant && !etat.charge) publier({ ...etat, charge: true });
      if (vivant && moi && !tempsReel) {
        tempsReel = true;
        stopTempsReel = ecouterPrives(() => void charger());
      }
    } catch {
      /* base injoignable : on garde ce qu'on a */
      if (vivant && !etat.charge) publier({ ...etat, charge: true });
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
  window.addEventListener(EVT_LU_PRIVE, recompter);
  document.addEventListener("visibilitychange", recompter);
  return () => {
    vivant = false;
    stopTempsReel();
    window.removeEventListener(EVT_LU_PRIVE, recompter);
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

export function useMessagesPrives(): MessagesPrives {
  const session = useSession();
  const actif = !!session?.server && !session.enAttente;
  const d = useSyncExternalStore(
    actif ? abonner : rienAEcouter,
    () => etat,
    () => VIDE
  );
  return actif ? d : VIDE;
}
