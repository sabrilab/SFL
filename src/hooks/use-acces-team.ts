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

// ─────────────── Le mois offert (Sabri, 26/10/2026) ───────────────
//
// Venu par un joueur SFL (son lien, le lien de son équipe, son invitation) :
// Bola Team offert un mois, puis payer pour rester dans l'équipe, ou garder
// Bola. La fin vient de la base (essai_team_fin) ; null : pas d'offre (un
// joueur SFL l'a pour de bon), pas encore lue, ou base pas encore migrée.

export interface EssaiTeam {
  fin: Date;
  /** Passé à la lecture : l'offre est finie. */
  fini: boolean;
}

const essais = new Map<string, EssaiTeam | null>();
const abonnesEssai = new Set<() => void>();
let versionEssai = 0;

function abonnerEssai(f: () => void) {
  abonnesEssai.add(f);
  return () => {
    abonnesEssai.delete(f);
  };
}

function relireEssai(qui: string) {
  if (essais.has(qui)) return;
  essais.set(qui, null);
  void (async () => {
    try {
      const { data, error } = await supabase().rpc("essai_team_fin");
      if (error || !data) return;
      const fin = new Date(String(data));
      if (Number.isNaN(fin.getTime())) return;
      essais.set(qui, { fin, fini: fin.getTime() <= Date.now() });
      versionEssai++;
      for (const f of abonnesEssai) f();
    } catch {}
  })();
}

export function useEssaiTeam(): EssaiTeam | null {
  const session = useSession();
  const qui = session?.server ? session.user : null;
  useSyncExternalStore(abonnerEssai, () => versionEssai, () => 0);
  useEffect(() => {
    if (qui) relireEssai(qui);
  }, [qui]);
  return qui ? (essais.get(qui) ?? null) : null;
}
