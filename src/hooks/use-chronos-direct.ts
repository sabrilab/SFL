"use client";

// Les chronos des matchs d'une journée (lib/sfl/chrono-match.ts, 23/11/2026) :
// lus avec l'heure de la base (public.chronos_du_jour), suivis en temps réel
// (public.chronos_direct), et chaque geste envoyé à public.chrono_direct, qui
// seule décide. Le geste s'affiche tout de suite, la réponse de la base le
// remplace.
//
// L'heure : chaque réponse de la base porte son `maintenant`, et l'appareil
// en tire son écart (`decalage`, la moitié de l'aller-retour en moins). Le
// chrono se lit toujours à l'heure de la base, si bien que la tablette et le
// Mac affichent la même seconde, même quand l'un des deux est à l'heure fausse.
//
// Sans la table (la base pas encore mise à jour) et dans la démonstration du
// poste de dev : le chrono vit sur l'appareil (localStorage), il tient au
// rechargement mais ne se partage pas.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/use-session";
import { useSeason } from "@/components/sfl/season-provider";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { appliquerGeste, avecChrono, cleChrono, equipesDuChrono, sansChrono, type ChronoMatch, type GesteChrono } from "@/lib/sfl/chrono-match";
import type { Equipes } from "@/lib/sfl/feuille-direct";
import { demoFeuilles } from "@/lib/sfl/feuille-direct-demo";
import { numeroSaison } from "@/lib/sfl/saisie/types";

export interface ChronosDirect {
  chronoDe: (e: Equipes) => ChronoMatch | null;
  /** L'heure de la base, en ms (Date.now() recalé). */
  maintenant: () => number;
  geste: (e: Equipes, g: GesteChrono, minutes?: number) => Promise<boolean>;
  /** Le chrono ne vit que sur cet appareil (démonstration, ou la base sans la table). */
  local: boolean;
  actif: boolean;
}

const CLE_LOCALE = "sfl-chronos-local";
const EVENT_LOCAL = "sfl-chronos-local";
let canalSeq = 0;

function lireLocal(): ChronoMatch[] {
  try {
    const l = JSON.parse(window.localStorage.getItem(CLE_LOCALE) ?? "[]") as ChronoMatch[];
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

function ecrireLocal(l: ChronoMatch[]) {
  try {
    window.localStorage.setItem(CLE_LOCALE, JSON.stringify(l));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVENT_LOCAL));
}

/** La fonction ou la table n'existent pas encore en base. */
const absente = (code?: string) => code === "PGRST202" || code === "42883" || code === "42P01" || code === "PGRST205";

interface Reponse {
  ok?: boolean;
  chrono?: ChronoMatch | null;
  maintenant?: string;
  chronos?: ChronoMatch[];
}

export function useChronosDirect(j: number | null): ChronosDirect {
  const session = useSession();
  const { saisonLue } = useSeason();
  const { me } = useMyPlayer();
  const n = numeroSaison(saisonLue);
  const [demo] = useState(() => (typeof window !== "undefined" ? demoFeuilles() : false));
  const [sansTable, setSansTable] = useState(false);
  const local = demo || sansTable;
  const actif = demo || !!session?.server;
  const [lus, setLus] = useState<{ cle: string; chronos: ChronoMatch[] } | null>(null);
  const decalage = useRef(0);
  const cle = j == null ? null : `${n}|${j}`;
  const [monId, setMonId] = useState<string | null>(null);

  const recaler = useCallback((serveur: string | undefined, t0: number, t1: number) => {
    const s = serveur ? Date.parse(serveur) : NaN;
    if (Number.isFinite(s)) decalage.current = s - (t0 + t1) / 2;
  }, []);

  const recharger = useCallback(async () => {
    if (j == null || !actif) return;
    if (local) {
      setLus({ cle: `${n}|${j}`, chronos: lireLocal().filter((c) => c.saison === n && c.j === j) });
      return;
    }
    try {
      const t0 = Date.now();
      const { data, error } = await supabase().rpc("chronos_du_jour", { p_j: j });
      const t1 = Date.now();
      if (error) {
        if (absente(error.code)) setSansTable(true);
        return;
      }
      const r = (data ?? {}) as Reponse;
      recaler(r.maintenant, t0, t1);
      setLus({ cle: `${n}|${j}`, chronos: (r.chronos ?? []).filter((c) => c.saison === n) });
    } catch {
      /* hors ligne : la dernière lecture reste */
    }
  }, [j, n, actif, local, recaler]);

  useEffect(() => {
    if (!actif || local) return;
    let fini = false;
    supabase()
      .auth.getUser()
      .then(({ data }) => {
        if (!fini) setMonId(data.user?.id ?? null);
      })
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, [actif, local]);

  // La lecture, puis le temps réel.
  useEffect(() => {
    if (j == null || !actif) return;
    Promise.resolve().then(recharger);
    const reveil = () => {
      if (document.visibilityState === "visible") void recharger();
    };
    document.addEventListener("visibilitychange", reveil);
    if (local) {
      const suivre = () => void recharger();
      window.addEventListener(EVENT_LOCAL, suivre);
      window.addEventListener("storage", suivre);
      return () => {
        document.removeEventListener("visibilitychange", reveil);
        window.removeEventListener(EVENT_LOCAL, suivre);
        window.removeEventListener("storage", suivre);
      };
    }
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      // Sans filtre : le temps réel ne filtre pas les suppressions (« remettre à zéro »).
      canal = sb
        .channel(`sfl-chronos-direct-${++canalSeq}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "chronos_direct" }, (p) => {
          if (p.eventType === "DELETE") {
            const o = (p.old ?? {}) as Partial<ChronoMatch>;
            if (o.saison == null || o.j == null || o.noirs == null || o.blancs == null) {
              void recharger();
              return;
            }
            if (o.j !== j) return;
            setLus((l) => (l ? { ...l, chronos: sansChrono(l.chronos, o.saison!, o.j!, [o.noirs!, o.blancs!]) } : l));
            return;
          }
          const c = (p.new ?? null) as ChronoMatch | null;
          if (!c || c.saison !== n || c.j !== j) return;
          setLus((l) => {
            const avant = l?.cle === `${n}|${j}` ? l.chronos : [];
            // Un écho plus ancien que ce qui est à l'écran ne le remplace pas.
            const deja = avant.find((x) => cleChrono(x.j, equipesDuChrono(x)) === cleChrono(c.j, equipesDuChrono(c)));
            if (deja && Date.parse(deja.maj_le) > Date.parse(c.maj_le)) return l;
            return { cle: `${n}|${j}`, chronos: avecChrono(avant, c) };
          });
        })
        .subscribe();
    } catch {
      /* sans temps réel : relu au réveil et à chaque geste */
    }
    return () => {
      document.removeEventListener("visibilitychange", reveil);
      if (canal) sb.removeChannel(canal);
    };
  }, [j, n, actif, local, recharger]);

  const chronos = useMemo(() => {
    const m = new Map<string, ChronoMatch>();
    if (lus && lus.cle === cle) for (const c of lus.chronos) m.set(cleChrono(c.j, equipesDuChrono(c)), c);
    return m;
  }, [lus, cle]);

  const chronoDe = useCallback((e: Equipes) => (j != null ? (chronos.get(cleChrono(j, e)) ?? null) : null), [chronos, j]);
  const maintenant = useCallback(() => Date.now() + decalage.current, []);

  const poser = useCallback(
    (e: Equipes, c: ChronoMatch | null) => {
      if (j == null) return;
      setLus((l) => {
        const avant = l?.cle === `${n}|${j}` ? l.chronos : [];
        return { cle: `${n}|${j}`, chronos: c ? avecChrono(avant, c) : sansChrono(avant, n, j, e) };
      });
    },
    [j, n]
  );

  const geste = useCallback(
    async (e: Equipes, g: GesteChrono, minutes = 0): Promise<boolean> => {
      if (j == null || !actif) return false;
      const cible = { saison: n, j, equipes: e, par: monId, parNom: me ?? null };
      const avant = chronoDe(e);
      const prevu = appliquerGeste(avant, cible, g, minutes, Date.now() + decalage.current);
      if (local) {
        if (!prevu.ok) return false;
        const l = sansChrono(lireLocal(), n, j, e);
        ecrireLocal(prevu.chrono ? [...l, prevu.chrono] : l);
        poser(e, prevu.chrono);
        return true;
      }
      // Tout de suite à l'écran ; la base répond avec le chrono tel qu'il est.
      if (prevu.ok) poser(e, prevu.chrono);
      try {
        const t0 = Date.now();
        const { data, error } = await supabase().rpc("chrono_direct", { p_j: j, p_noirs: e[0], p_blancs: e[1], p_geste: g, p_minutes: minutes });
        const t1 = Date.now();
        if (error) {
          if (absente(error.code)) {
            // La base n'a pas encore la table : le chrono reste sur cet appareil.
            setSansTable(true);
            if (prevu.ok) {
              const l = sansChrono(lireLocal(), n, j, e);
              ecrireLocal(prevu.chrono ? [...l, prevu.chrono] : l);
            }
            return prevu.ok;
          }
          poser(e, avant);
          void recharger();
          return false;
        }
        const r = (data ?? {}) as Reponse;
        recaler(r.maintenant, t0, t1);
        poser(e, r.chrono ?? null);
        return !!r.ok;
      } catch {
        poser(e, avant);
        void recharger();
        return false;
      }
    },
    [j, n, actif, local, monId, me, chronoDe, poser, recharger, recaler]
  );

  return useMemo(() => ({ chronoDe, maintenant, geste, local, actif }), [chronoDe, maintenant, geste, local, actif]);
}
