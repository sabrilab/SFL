"use client";

// Les achats en XP (PACK AFRIQUE 2027, lib/sfl/pack-afrique.ts) côté app :
//   · ceux de toute la ligue (achats_xp : la nation obtenue et son numéro de
//     série, jamais ce qu'elle a coûté) : la carte de chacun porte ses skins
//     de nation, chez tout le monde (use-habillage.ts, finitionsDe) ;
//   · les miens, avec leur prix (mes_achats_xp) : le solde à dépenser.
// Relus à l'ouverture, au retour sur l'app et après un achat, page par page
// (lib/sfl/pages.ts) ; gardés sur le téléphone pour un affichage immédiat.
// Pour moi, mes_achats_xp fait foi. Le solde se compte monnaie par monnaie
// (achats_xp.monnaie, 02/11/2026) : en XP, le total que l'écran montre
// (useXp) moins l'XP dépensée ; en XP S (le PACK AFRIQUE 2027), les XP S que
// l'écran montre (useXpS) moins les XP S dépensées. Le serveur, lui,
// recalcule tout à l'achat. Le Niveau XP et le Passe ne lisent jamais ces
// achats.

import { useEffect, useSyncExternalStore } from "react";
import { useXp, useXpS } from "@/hooks/use-missions";
import { useSession } from "@/hooks/use-session";
import { soldeXp, type Monnaie } from "@/lib/sfl/pack-afrique";
import { PAGE, toutesLesPages } from "@/lib/sfl/pages";
import { memeNom } from "@/lib/sfl/xp-acquis";
import { supabase } from "@/lib/supabase";

export interface AchatXp {
  article: string;
  obtenu: string;
  /** La monnaie du prix ; absente d'un achat gardé avant les XP S : de l'XP. */
  monnaie?: Monnaie;
  /** Le prix payé, dans sa monnaie. */
  xp: number;
  serie: number;
  le: string;
}

/** Ce qui a été dépensé dans une monnaie. */
export const depenseEn = (achats: readonly AchatXp[], monnaie: Monnaie) =>
  achats.reduce((a, x) => a + ((x.monnaie ?? "xp") === monnaie ? x.xp : 0), 0);

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
  return m && nom && memeNom(m.nom, nom) ? m.achats : null;
}

/**
 * L'XP qui reste à dépenser ; null tant que mes achats ne sont pas lus. Elle
 * part du total que l'écran montre (useXp : le calcul de l'appareil, pris au
 * plus haut avec le dernier bilan du serveur quand il est incomplet) : sans
 * achat, « à dépenser » ne s'écrit pas ; avec, c'est ce total moins l'XP
 * dépensée. Avant (relecture du 02/11/2026), il partait du dernier bilan du
 * serveur (jusqu'à 10 minutes d'âge) : « 1 630 XP · 1 580 à dépenser » sans
 * rien avoir acheté, et un chiffre différent d'un appareil à l'autre. Le
 * serveur décide toujours seul (ouvrir_pack_xp) et rend le vrai solde s'il
 * refuse.
 */
export function useSoldeXp(nom: string | null | undefined): number | null {
  const achats = useMesAchatsXp(nom);
  const b = useXp(nom ?? undefined);
  if (!achats || !b) return null;
  return soldeXp(b.total, depenseEn(achats, "xp"));
}

/**
 * Les XP S qui restent à dépenser ; null tant que mes achats ne sont pas lus.
 * Elles partent des XP S que l'écran montre (useXpS : le calcul de
 * l'appareil, au plus haut avec le dernier bilan du serveur s'il est
 * incomplet), moins les XP S dépensées : le même chiffre sur Ma carte, en
 * haut du Passe et dans les Packs. Le serveur décide seul (ouvrir_pack_xp)
 * et rend le vrai solde s'il refuse.
 */
export function useSoldeXpS(nom: string | null | undefined): number | null {
  const achats = useMesAchatsXp(nom);
  const s = useXpS(nom ?? undefined);
  if (!achats || !s) return null;
  return soldeXp(s.gagne, depenseEn(achats, "xp-s"));
}

let enVol: Promise<void> | null = null;

/** Relit les achats de la ligue et les miens. */
export function rafraichirAchatsXp(nom: string): Promise<void> {
  if (enVol) return enVol;
  enVol = (async () => {
    try {
      const sb = supabase();
      // Toute la ligue, page par page (lib/sfl/pages.ts : la base en rend 1 000 au plus).
      const [toute, mes] = await Promise.all([
        toutesLesPages<{ obtenu: string; serie: number; profiles: { name: string } | { name: string }[] | null }>((debut) =>
          sb
            .from("achats_xp")
            .select("id, obtenu, serie, profiles(name)")
            .order("id")
            .range(debut, debut + PAGE - 1)
        ),
        sb.rpc("mes_achats_xp"),
      ]);
      if (!toute.error) {
        const out: Record<string, [string, number][]> = {};
        for (const l of toute.lu) {
          const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
          if (p?.name) (out[p.name] ??= []).push([l.obtenu, l.serie]);
        }
        // Les miens font foi pour moi (mes_achats_xp) : ce que j'ai payé se porte, quoi que dise la liste de la ligue.
        if (!mes.error) {
          const a = (mes.data ?? []) as AchatXp[];
          if (a.length) out[nom] = a.map((x) => [x.obtenu, x.serie]);
          else delete out[nom];
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
  if (!achats.some((x) => x.obtenu === a.obtenu && x.article === a.article && (x.monnaie ?? "xp") === (a.monnaie ?? "xp"))) {
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
