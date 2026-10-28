"use client";

// Mes matchs Bola, pour ma carte, mon XP et mes missions de joueur Bola
// (lib/sfl/carte-bola.ts, lib/sfl/missions-perso.ts ; Sabri, 28/10/2026 :
// « leur carte s'actualise à chaque match »).
//
// Un seul chargement pour toute l'app (SeasonProvider le lit), par la
// fonction mes_matchs_bola() : vide pour qui n'a jamais été filleul, donc
// un joueur SFL ne change pas d'un octet. Relu à l'ouverture, au retour au
// premier plan et du réseau, après ma propre réponse Confirmer ou Infirmer
// (MES_MATCHS_BOLA_EVENT) et, pour un joueur Bola, toutes les 5 minutes
// quand l'app est visible : un match passe à « compte » par la réponse des
// autres ou à l'échéance des 24 h, que le temps réel ne me montre pas.
// La dernière réponse est gardée sur le téléphone, pour ouvrir sans attendre.

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { lireMesMatchsBola, MES_MATCHS_BOLA_EVENT, monId } from "@/lib/sfl/matchs";
import type { MatchBola } from "@/lib/sfl/ligue-vierge";

export interface MesMatchsBola {
  /** Le compte (session.user) et mon identifiant en base. */
  qui: string;
  uid: string;
  matchs: MatchBola[];
}

const cle = (qui: string) => `bola-matchs-${qui}`;

let etat: MesMatchsBola | null = null;
let lu = false;
const abonnes = new Set<() => void>();
const enVol = new Map<string, Promise<void>>();

function lireIci(qui: string): MesMatchsBola | null {
  try {
    const brut = localStorage.getItem(cle(qui));
    const x = brut ? (JSON.parse(brut) as MesMatchsBola) : null;
    return x && x.qui === qui && Array.isArray(x.matchs) ? x : null;
  } catch {
    return null;
  }
}

function instantane(): MesMatchsBola | null {
  return etat;
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

function poser(x: MesMatchsBola | null) {
  etat = x;
  for (const f of abonnes) f();
}

function relire(qui: string): Promise<void> {
  const deja = enVol.get(qui);
  if (deja) return deja;
  const p = (async () => {
    try {
      const [matchs, uid] = await Promise.all([lireMesMatchsBola(), monId()]);
      if (!uid || matchs === null) return;
      const x = { qui, uid, matchs };
      // Rien de neuf : le même objet, aucun recalcul.
      if (etat && etat.qui === qui && JSON.stringify(etat.matchs) === JSON.stringify(matchs)) return;
      try {
        localStorage.setItem(cle(qui), JSON.stringify(x));
      } catch {}
      poser(x);
    } catch {
      // Hors ligne : on garde ce qu'on a (le cache, ou rien : la carte reste à 75).
    }
  })().finally(() => enVol.delete(qui));
  enVol.set(qui, p);
  return p;
}

/** Mes matchs Bola (null avant la première réponse, sans cache). `bola` : je joue en Bola, relire souvent. */
export function useMesMatchsBola(bola: boolean): MesMatchsBola | null {
  const session = useSession();
  const qui = session?.server && !session.enAttente && !session.admin ? session.user : null;
  const x = useSyncExternalStore(abonner, instantane, () => null);

  useEffect(() => {
    if (!qui) return;
    if (!lu || etat?.qui !== qui) {
      lu = true;
      const ici = lireIci(qui);
      if (ici) poser(ici);
    }
    void relire(qui);
    const reprendre = () => {
      if (document.visibilityState === "visible") void relire(qui);
    };
    const tout = () => void relire(qui);
    document.addEventListener("visibilitychange", reprendre);
    window.addEventListener("online", tout);
    window.addEventListener(MES_MATCHS_BOLA_EVENT, tout);
    const minuterie = bola ? window.setInterval(reprendre, 5 * 60 * 1000) : null;
    return () => {
      document.removeEventListener("visibilitychange", reprendre);
      window.removeEventListener("online", tout);
      window.removeEventListener(MES_MATCHS_BOLA_EVENT, tout);
      if (minuterie) window.clearInterval(minuterie);
    };
  }, [qui, bola]);

  return qui && x?.qui === qui ? x : null;
}
