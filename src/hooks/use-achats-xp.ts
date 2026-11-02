"use client";

// Les achats en XP (PACK AFRIQUE 2027, lib/sfl/pack-afrique.ts) côté app :
//   · ceux de toute la ligue (achats_xp : la nation obtenue et son numéro de
//     série, jamais ce qu'elle a coûté) : la carte de chacun porte ses skins
//     de nation, chez tout le monde (use-habillage.ts, finitionsDe) ;
//   · les miens, avec leur prix (mes_achats_xp) : le solde à dépenser.
// Relus à l'ouverture, au retour sur l'app et après un achat ; gardés sur le
// téléphone pour un affichage immédiat. Le solde = l'XP gagnée à vie selon le
// serveur (use-bilan-serveur.ts ; à défaut, le calcul de l'appareil) moins
// l'XP dépensée. Le Niveau XP et le Passe ne lisent jamais ces achats.

import { useEffect, useSyncExternalStore } from "react";
import { useBilanServeur } from "@/hooks/use-bilan-serveur";
import { useXp } from "@/hooks/use-missions";
import { useSession } from "@/hooks/use-session";
import { soldeXp } from "@/lib/sfl/pack-afrique";
import { supabase } from "@/lib/supabase";

export interface AchatXp {
  article: string;
  obtenu: string;
  xp: number;
  serie: number;
  le: string;
}

/** Par joueur : [nation, numéro de série][]. */
export type AchatsLigue = Record<string, readonly (readonly [string, number])[]>;

const CLE_LIGUE = "sfl-achats-xp-ligue";
const CLE_MIENS = "sfl-mes-achats-xp";
const EVENT = "sfl-achats-xp";

let ligue: AchatsLigue | undefined;
let miens: { nom: string; achats: AchatXp[] } | null | undefined;

function lire<T>(cle: string): T | null {
  try {
    const brut = localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : null;
  } catch {
    return null;
  }
}
function garder(cle: string, v: unknown) {
  try {
    localStorage.setItem(cle, JSON.stringify(v));
  } catch {}
}
const signaler = () => window.dispatchEvent(new Event(EVENT));
function abonner(f: () => void) {
  window.addEventListener(EVENT, f);
  return () => window.removeEventListener(EVENT, f);
}

const AUCUN: AchatsLigue = {};
const instantaneLigue = () => (ligue ??= lire<AchatsLigue>(CLE_LIGUE) ?? AUCUN);
const instantaneMiens = () => (miens === undefined ? (miens = lire<{ nom: string; achats: AchatXp[] }>(CLE_MIENS)) : miens);

/** Les skins de nation obtenus, joueur par joueur. */
export function useAchatsLigue(): AchatsLigue {
  return useSyncExternalStore(abonner, instantaneLigue, () => AUCUN);
}

/** Mes achats, avec leur prix (null tant qu'ils ne sont pas lus, ou s'ils sont d'un autre compte). */
export function useMesAchatsXp(nom: string | null | undefined): AchatXp[] | null {
  const m = useSyncExternalStore(abonner, instantaneMiens, () => null);
  return m && nom && m.nom === nom ? m.achats : null;
}

/** L'XP qui reste à dépenser ; null tant que mes achats ne sont pas lus. */
export function useSoldeXp(nom: string | null | undefined): number | null {
  const achats = useMesAchatsXp(nom);
  const serveur = useBilanServeur(nom);
  const b = useXp(nom ?? undefined);
  if (!achats || !b) return null;
  const gagnee = serveur?.total ?? b.total;
  return soldeXp(gagnee, achats.reduce((a, x) => a + x.xp, 0));
}

let enVol: Promise<void> | null = null;

/** Relit les achats de la ligue et les miens. */
export function rafraichirAchatsXp(nom: string): Promise<void> {
  if (enVol) return enVol;
  enVol = (async () => {
    try {
      const sb = supabase();
      const [toute, mes] = await Promise.all([
        sb.from("achats_xp").select("article, obtenu, serie, profiles(name)"),
        sb.rpc("mes_achats_xp"),
      ]);
      if (!toute.error && toute.data) {
        const out: Record<string, [string, number][]> = {};
        for (const l of toute.data as unknown as { obtenu: string; serie: number; profiles: { name: string } | { name: string }[] | null }[]) {
          const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
          if (p?.name) (out[p.name] ??= []).push([l.obtenu, l.serie]);
        }
        if (JSON.stringify(out) !== JSON.stringify(instantaneLigue())) {
          ligue = out;
          garder(CLE_LIGUE, out);
          signaler();
        }
      }
      if (!mes.error) {
        const m = { nom, achats: (mes.data ?? []) as AchatXp[] };
        if (JSON.stringify(m) !== JSON.stringify(instantaneMiens())) {
          miens = m;
          garder(CLE_MIENS, m);
          signaler();
        }
      }
    } catch {
      // Hors ligne : le cache suffit.
    } finally {
      enVol = null;
    }
  })();
  return enVol;
}

/** Un achat que le serveur vient de confirmer : affiché tout de suite, avant la relecture. */
export function poserAchat(nom: string, a: AchatXp): void {
  const avant = instantaneMiens();
  const achats = avant?.nom === nom ? avant.achats : [];
  if (!achats.some((x) => x.obtenu === a.obtenu && x.article === a.article)) {
    miens = { nom, achats: [...achats, a] };
    garder(CLE_MIENS, miens);
  }
  const l = instantaneLigue();
  if (!(l[nom] ?? []).some(([n]) => n === a.obtenu)) {
    ligue = { ...l, [nom]: [...(l[nom] ?? []), [a.obtenu, a.serie] as const] };
    garder(CLE_LIGUE, ligue);
  }
  signaler();
}

/** Monté une fois (XpLigueProvider) : les achats à l'ouverture et au retour sur l'app. */
export function useSuiviAchatsXp(): void {
  const session = useSession();
  const nom = session?.server ? session.name : null;
  useEffect(() => {
    if (!nom) return;
    void rafraichirAchatsXp(nom);
    const revenir = () => {
      if (document.visibilityState === "visible") void rafraichirAchatsXp(nom);
    };
    document.addEventListener("visibilitychange", revenir);
    return () => document.removeEventListener("visibilitychange", revenir);
  }, [nom]);
}
