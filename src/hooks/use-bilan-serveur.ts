"use client";

// Le bilan d'XP du serveur (/api/xp/bilan) et les paliers gardés de toute la
// ligue (passe_acquis), côté app : relus à l'ouverture et au retour sur
// l'app, au plus une fois toutes les 10 minutes par appareil, gardés sur le
// téléphone pour un affichage immédiat (sfl-xp-bilan, sfl-passe-acquis).
// lib/sfl/xp-acquis.ts dit comment ils se mêlent au calcul de l'appareil.

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "@/hooks/use-session";
import { SAISON_PUBLIEE_EVENT } from "@/lib/sfl/saisie/sync";
import type { PaliersAtteints } from "@/lib/sfl/passe";
import { PAGE, toutesLesPages } from "@/lib/sfl/pages";
import { memeNom, type BilanGarde } from "@/lib/sfl/xp-acquis";
import { supabase } from "@/lib/supabase";

const CLE_BILAN = "sfl-xp-bilan";
const CLE_ACQUIS = "sfl-passe-acquis";
const CLE_QUAND = "sfl-xp-bilan-le";
const ESPACE = 10 * 60_000;
const EVENT = "sfl-xp-bilan";

let bilan: BilanGarde | null | undefined;
let acquis: Record<string, PaliersAtteints> | undefined;

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

function abonner(f: () => void) {
  window.addEventListener(EVENT, f);
  return () => window.removeEventListener(EVENT, f);
}

const signaler = () => window.dispatchEvent(new Event(EVENT));

function instantaneBilan(): BilanGarde | null {
  if (bilan === undefined) bilan = lire<BilanGarde>(CLE_BILAN);
  return bilan;
}

const AUCUN: Record<string, PaliersAtteints> = {};
function instantaneAcquis(): Record<string, PaliersAtteints> {
  if (acquis === undefined) acquis = lire<Record<string, PaliersAtteints>>(CLE_ACQUIS) ?? AUCUN;
  return acquis;
}

/** Le dernier bilan du serveur pour ce joueur (null s'il n'y en a pas, ou s'il est d'un autre compte). */
export function useBilanServeur(nom: string | null | undefined): BilanGarde | null {
  const b = useSyncExternalStore(abonner, instantaneBilan, () => null);
  return b && nom && memeNom(b.nom, nom) ? b : null;
}

/** Les paliers gardés par le serveur, joueur par joueur (passe_acquis). */
export function usePaliersGardes(): Record<string, PaliersAtteints> {
  return useSyncExternalStore(abonner, instantaneAcquis, () => AUCUN);
}

/** Relit les paliers gardés de toute la ligue (les membres la lisent), page par page (lib/sfl/pages.ts). */
async function relireAcquis(): Promise<void> {
  const sb = supabase();
  const { lu, error } = await toutesLesPages<{ saison_passe: string; palier: number; profiles: { name: string } | { name: string }[] | null }>((debut) =>
    sb
      .from("passe_acquis")
      .select("saison_passe, palier, profiles(name)")
      .order("joueur")
      .order("saison_passe")
      .range(debut, debut + PAGE - 1)
  );
  if (error) return;
  const out: Record<string, Record<string, number>> = {};
  for (const l of lu) {
    const p = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
    if (!p?.name) continue;
    (out[p.name] ??= {})[l.saison_passe] = l.palier;
  }
  if (JSON.stringify(out) === JSON.stringify(instantaneAcquis())) return;
  acquis = out;
  garder(CLE_ACQUIS, out);
  signaler();
}

let enVol: Promise<void> | null = null;

/** Demande le bilan au serveur (au plus une fois toutes les 10 minutes ; `force` : une fois par minute). */
export function rafraichirBilanServeur(force = false): Promise<void> {
  if (enVol) return enVol;
  const quand = lire<number>(CLE_QUAND) ?? 0;
  if (Date.now() - quand < (force ? 60_000 : ESPACE)) return Promise.resolve();
  enVol = (async () => {
    try {
      garder(CLE_QUAND, Date.now());
      const { data } = await supabase().auth.getSession();
      const jeton = data.session?.access_token;
      if (!jeton) return;
      const r = await fetch("/api/xp/bilan", { method: "POST", headers: { Authorization: `Bearer ${jeton}` } });
      if (r.ok) {
        const b = (await r.json()) as BilanGarde;
        if (b?.nom) {
          bilan = b;
          garder(CLE_BILAN, b);
          signaler();
        }
      }
      await relireAcquis();
    } catch {
      // Hors ligne : on garde le dernier bilan.
    } finally {
      enVol = null;
    }
  })();
  return enVol;
}

/** Monté une fois (XpLigueProvider) : le bilan à l'ouverture et au retour sur l'app. */
export function useSuiviBilanServeur(): void {
  const session = useSession();
  const verifiee = !!session?.server;
  useEffect(() => {
    if (!verifiee) return;
    void rafraichirBilanServeur();
    const revenir = () => {
      if (document.visibilityState === "visible") void rafraichirBilanServeur();
    };
    const publiee = () => void rafraichirBilanServeur(true);
    document.addEventListener("visibilitychange", revenir);
    window.addEventListener(SAISON_PUBLIEE_EVENT, publiee);
    return () => {
      document.removeEventListener("visibilitychange", revenir);
      window.removeEventListener(SAISON_PUBLIEE_EVENT, publiee);
    };
  }, [verifiee]);
}
