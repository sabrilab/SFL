"use client";

// Mon équipe du mode Team, et ce que je n'ai pas lu dans sa discussion
// (lib/sfl/discussion-equipe.ts). L'écran de discussion en fait son onglet
// Équipe et le nombre posé à côté ; la page Team, le nombre sur son bouton
// de discussion ; la barre d'onglets, la pastille de l'icône.
//
// Un seul chargement et un seul abonnement temps réel pour tout l'écran,
// comme les discussions des matchs (hooks/use-discussions-match.ts).
// Recompté à l'ouverture, au retour dans l'app, à chaque message d'une
// équipe, quand j'entre dans une équipe ou en sors, et dès que la discussion
// est lue.

import { useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { EVT_LU_EQUIPE, ecouterMonEquipe, nonLusEquipe } from "@/lib/sfl/discussion-equipe";
import { monEquipe, type Equipe } from "@/lib/sfl/equipes";
import { monId } from "@/lib/sfl/matchs";

export interface MonEquipe {
  equipe: Equipe | null;
  /** Les messages de sa discussion que je n'ai pas lus, dix au plus. */
  nonLus: number;
  /** Faux tant que le premier chargement n'est pas revenu. */
  charge: boolean;
}

const VIDE: MonEquipe = { equipe: null, nonLus: 0, charge: false };
let etat = VIDE;
const abonnes = new Set<() => void>();
let arreter: (() => void) | null = null;

function publier(e: MonEquipe) {
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
      const equipe = moi ? await monEquipe(moi) : null;
      const nonLus = moi && equipe ? await nonLusEquipe(equipe, moi) : 0;
      if (vivant) publier({ equipe, nonLus, charge: true });
      if (vivant && moi && !tempsReel) {
        tempsReel = true;
        stopTempsReel = ecouterMonEquipe(moi, () => void charger());
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
  window.addEventListener(EVT_LU_EQUIPE, recompter);
  document.addEventListener("visibilitychange", recompter);
  return () => {
    vivant = false;
    stopTempsReel();
    window.removeEventListener(EVT_LU_EQUIPE, recompter);
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

export function useMonEquipe(): MonEquipe {
  const session = useSession();
  const actif = !!session?.server && !session.enAttente;
  const d = useSyncExternalStore(
    actif ? abonner : rienAEcouter,
    () => etat,
    () => VIDE
  );
  return actif ? d : VIDE;
}
