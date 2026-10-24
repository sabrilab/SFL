"use client";

// Ai-je Bola Team ? (Parrainage, 24/10/2026)
//
// Bola est gratuit ; Bola Team est réservé aux joueurs SFL (leur nom est
// dans l'effectif de la saison) et à ceux qu'un joueur SFL a fait venir : son
// lien de parrainage, le lien de son équipe ou son invitation. La règle vit
// en base (supabase/schema.sql : acces_team, mon_acces_team), qui la fait
// respecter à chaque geste ; ce hook ne fait que la lire, pour que les écrans
// montrent la vitrine de Bola Team plutôt que des gestes refusés.
//
// null tant que la réponse n'est pas revenue. Si la base ne connaît pas
// encore la fonction (une préversion branchée sur la base de production avant
// la mise en ligne) : true, l'app reste telle qu'avant. Sans réseau, on garde
// la dernière réponse. Relu au changement de compte, au retour dans l'app et
// après un geste de la page Team (signer une invitation ouvre l'accès).

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/supabase";

interface Etat {
  /** Le compte pour lequel la réponse vaut. */
  qui: string | null;
  acces: boolean | null;
}

const VIDE: Etat = { qui: null, acces: null };
/** L'événement de signalerEquipe (hooks/use-mon-equipe.ts). */
const EVT_EQUIPE = "sfl-mon-equipe";

let etat = VIDE;
const abonnes = new Set<() => void>();
let enVol: { qui: string; p: Promise<void> } | null = null;

function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

function relire(qui: string): Promise<void> {
  if (enVol?.qui === qui) return enVol.p;
  const p = (async () => {
    let lu: boolean | null = null;
    try {
      const { data, error } = await supabase().rpc("mon_acces_team");
      if (!error) lu = data !== false;
    } catch {}
    const avant = etat.qui === qui ? etat.acces : null;
    etat = { qui, acces: lu ?? avant ?? true };
    for (const f of abonnes) f();
  })().finally(() => {
    if (enVol?.p === p) enVol = null;
  });
  enVol = { qui, p };
  return p;
}

export function useAccesTeam(): boolean | null {
  const session = useSession();
  const qui = session?.server ? session.user : null;
  const lu = useSyncExternalStore(abonner, () => etat, () => VIDE);

  useEffect(() => {
    if (!qui) return;
    void relire(qui);
    const auRetour = () => {
      if (document.visibilityState === "visible") void relire(qui);
    };
    const apresGeste = () => void relire(qui);
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener(EVT_EQUIPE, apresGeste);
    return () => {
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener(EVT_EQUIPE, apresGeste);
    };
  }, [qui]);

  return qui && lu.qui === qui ? lu.acces : null;
}
