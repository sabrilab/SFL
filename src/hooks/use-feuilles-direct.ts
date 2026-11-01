"use client";

// Les feuilles de match en direct d'une journée (lib/sfl/feuille-direct.ts,
// 01/11/2026) : lues dans public.feuilles_direct, suivies en temps réel —
// toute la ligue voit le score bouger sans recharger —, et les gestes
// (prendre, compter, passer la main, sceller ; l'admin : reprendre, libérer,
// rouvrir) envoyés aux fonctions de la base, qui seules décident.
//
// Un geste de comptage s'affiche tout de suite (le doigt n'attend pas le
// réseau) puis la base répond avec la feuille telle qu'elle est ; les gestes
// d'une même feuille partent l'un après l'autre, dans l'ordre. Un refus
// recharge la feuille. Sans session serveur : rien (hors démonstration du
// poste de dev, feuille-direct-demo.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/use-session";
import { useSeason } from "@/components/sfl/season-provider";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { avecGestes, cleFeuille, type Equipes, type FeuilleDirect, type Geste, type RefusFeuille } from "@/lib/sfl/feuille-direct";
import {
  adminDemo,
  compterDemo,
  DEMO_EVENT,
  demoFeuilles,
  feuillesDemo,
  idDemo,
  passerDemo,
  prendreDemo,
  scellerDemo,
} from "@/lib/sfl/feuille-direct-demo";
import { numeroSaison } from "@/lib/sfl/saisie/types";
import { SAISIE_EVENT } from "@/components/sfl/season-provider";

export type IssueFeuille = { ok: true; feuille: FeuilleDirect | null } | { ok: false; refus: RefusFeuille; feuille: FeuilleDirect | null };
export type GesteAdmin = "reprendre" | "liberer" | "rouvrir";

export interface FeuillesDirect {
  /** Clé : cleFeuille(j, équipes). */
  feuilles: Map<string, FeuilleDirect>;
  feuilleDe: (e: Equipes) => FeuilleDirect | null;
  /** Mon identifiant de compte (comparé à FeuilleDirect.preneur) ; null tant qu'il n'est pas lu. */
  monId: string | null;
  pret: boolean;
  /** La démonstration du poste de dev, sans base. */
  demo: boolean;
  prendre: (e: Equipes) => Promise<IssueFeuille>;
  compter: (e: Equipes, gestes: Geste[]) => Promise<IssueFeuille>;
  passer: (e: Equipes, a: string) => Promise<IssueFeuille>;
  sceller: (e: Equipes) => Promise<IssueFeuille>;
  admin: (e: Equipes, geste: GesteAdmin) => Promise<IssueFeuille>;
}

let canalSeq = 0;

interface Reponse {
  ok?: boolean;
  refus?: RefusFeuille | null;
  feuille?: FeuilleDirect | null;
}

export function useFeuillesDirect(j: number | null): FeuillesDirect {
  const session = useSession();
  const { saisonLue } = useSeason();
  // Le nom du joueur de cet appareil (la démonstration n'a pas de session).
  const { me } = useMyPlayer();
  const n = numeroSaison(saisonLue);
  const [demo] = useState(() => (typeof window !== "undefined" ? demoFeuilles() : false));
  const actif = demo || !!session?.server;
  const [lues, setLues] = useState<{ cle: string; feuilles: FeuilleDirect[] } | null>(null);
  const [monId, setMonId] = useState<string | null>(null);
  const cle = j == null ? null : `${n}|${j}`;
  const file = useRef(new Map<string, Promise<unknown>>());

  const recharger = useCallback(async () => {
    if (j == null || !actif) return;
    if (demo) {
      setLues({ cle: `${n}|${j}`, feuilles: feuillesDemo(n, j) });
      return;
    }
    try {
      const { data, error } = await supabase().from("feuilles_direct").select("*").eq("saison", n).eq("j", j);
      if (!error) setLues({ cle: `${n}|${j}`, feuilles: (data ?? []) as FeuilleDirect[] });
    } catch {
      /* hors ligne : la dernière lecture reste */
    }
  }, [j, n, actif, demo]);

  // Qui suis-je (l'identifiant que porte FeuilleDirect.preneur).
  useEffect(() => {
    if (!actif) return;
    if (demo) {
      Promise.resolve().then(() => setMonId(me ? idDemo(me) : null));
      return;
    }
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
  }, [actif, demo, me]);

  // La lecture, puis le temps réel.
  useEffect(() => {
    if (j == null || !actif) return;
    Promise.resolve().then(recharger);
    if (demo) {
      const suivre = () => void recharger();
      window.addEventListener(DEMO_EVENT, suivre);
      window.addEventListener("storage", suivre);
      return () => {
        window.removeEventListener(DEMO_EVENT, suivre);
        window.removeEventListener("storage", suivre);
      };
    }
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      canal = sb
        .channel(`sfl-feuilles-direct-${++canalSeq}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "feuilles_direct", filter: `j=eq.${j}` }, (p) => {
          const f = (p.new ?? null) as FeuilleDirect | null;
          if (!f || f.saison !== n || f.j !== j) {
            void recharger();
            return;
          }
          setLues((l) => {
            const autres = (l?.cle === `${n}|${j}` ? l.feuilles : []).filter((x) => cleFeuille(x.j, [x.noirs, x.blancs]) !== cleFeuille(f.j, [f.noirs, f.blancs]));
            return { cle: `${n}|${j}`, feuilles: [...autres, f] };
          });
        })
        .subscribe();
    } catch {
      /* sans temps réel : la feuille se relit à chaque geste */
    }
    // Revenir sur l'app (téléphone en veille pendant le match) : relire.
    const reveil = () => {
      if (document.visibilityState === "visible") void recharger();
    };
    document.addEventListener("visibilitychange", reveil);
    return () => {
      document.removeEventListener("visibilitychange", reveil);
      if (canal) sb.removeChannel(canal);
    };
  }, [j, n, actif, demo, recharger]);

  const feuilles = useMemo(() => {
    const m = new Map<string, FeuilleDirect>();
    if (lues && lues.cle === cle) for (const f of lues.feuilles) m.set(cleFeuille(f.j, [f.noirs, f.blancs]), f);
    return m;
  }, [lues, cle]);

  const poser = useCallback(
    (f: FeuilleDirect | null | undefined) => {
      if (!f || f.saison !== n || f.j !== j) return;
      setLues((l) => {
        const autres = (l?.cle === `${n}|${j}` ? l.feuilles : []).filter((x) => cleFeuille(x.j, [x.noirs, x.blancs]) !== cleFeuille(f.j, [f.noirs, f.blancs]));
        return { cle: `${n}|${j}`, feuilles: [...autres, f] };
      });
    },
    [n, j]
  );

  /** Un appel à la base, à la suite des précédents sur la même feuille. */
  const appeler = useCallback(
    (e: Equipes, rpc: string, args: Record<string, unknown>, enDemo: () => ReturnType<typeof prendreDemo>): Promise<IssueFeuille> => {
      if (j == null) return Promise.resolve({ ok: false, refus: "journee", feuille: null });
      const k = cleFeuille(j, e);
      const avant = file.current.get(k) ?? Promise.resolve();
      const tour = avant.then(async (): Promise<IssueFeuille> => {
        if (demo) {
          const r = enDemo();
          poser(r.feuille);
          return r.ok ? { ok: true, feuille: r.feuille } : { ok: false, refus: r.refus, feuille: r.feuille ?? null };
        }
        if (!session?.server) return { ok: false, refus: "hors-ligne", feuille: null };
        try {
          const { data, error } = await supabase().rpc(rpc, { p_j: j, p_noirs: e[0], p_blancs: e[1], ...args });
          if (error) {
            void recharger();
            // 42501 : pas membre de la ligue (ou pas admin) ; le reste : la base n'a pas répondu.
            return { ok: false, refus: error.code === "42501" ? "pas-ton-match" : "hors-ligne", feuille: null };
          }
          const r = (data ?? {}) as Reponse;
          poser(r.feuille);
          if (r.ok) {
            // Le sceau a écrit la saison : la relire tout de suite (le temps réel suivra).
            if (rpc === "sceller_feuille") void import("@/lib/sfl/saisie/sync").then((m) => m.pullSaison()).then(() => window.dispatchEvent(new Event(SAISIE_EVENT)));
            return { ok: true, feuille: r.feuille ?? null };
          }
          if (!r.feuille) void recharger();
          return { ok: false, refus: r.refus ?? "geste", feuille: r.feuille ?? null };
        } catch {
          void recharger();
          return { ok: false, refus: "hors-ligne", feuille: null };
        }
      });
      file.current.set(k, tour.catch(() => {}));
      return tour;
    },
    [j, demo, session?.server, poser, recharger]
  );

  const moi = me ?? "";
  const prendre = useCallback((e: Equipes) => appeler(e, "prendre_feuille", {}, () => prendreDemo(j!, e, moi)), [appeler, j, moi]);
  const compter = useCallback(
    (e: Equipes, gestes: Geste[]) => {
      // Tout de suite à l'écran ; la base répond ensuite avec la feuille vraie.
      const f = j != null ? feuilles.get(cleFeuille(j, e)) : undefined;
      if (f && !f.fin) poser({ ...f, compteurs: avecGestes(f.compteurs, gestes), journal: [...f.journal, { le: new Date().toISOString(), gestes }] });
      return appeler(e, "compter_feuille", { p_gestes: gestes }, () => compterDemo(j!, e, moi, gestes));
    },
    [appeler, j, moi, feuilles, poser]
  );
  const passer = useCallback((e: Equipes, a: string) => appeler(e, "passer_feuille", { p_a: a }, () => passerDemo(j!, e, moi, a)), [appeler, j, moi]);
  const sceller = useCallback(
    (e: Equipes) => appeler(e, "sceller_feuille", {}, () => scellerDemo(j!, e, moi, !!session?.admin)),
    [appeler, j, moi, session?.admin]
  );
  const admin = useCallback(
    (e: Equipes, geste: GesteAdmin) => appeler(e, "feuille_admin", { p_geste: geste }, () => adminDemo(j!, e, moi, geste)),
    [appeler, j, moi]
  );
  const feuilleDe = useCallback((e: Equipes) => (j != null ? (feuilles.get(cleFeuille(j, e)) ?? null) : null), [feuilles, j]);

  return { feuilles, feuilleDe, monId, pret: !!lues && lues.cle === cle, demo, prendre, compter, passer, sceller, admin };
}
