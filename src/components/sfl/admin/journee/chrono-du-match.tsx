"use client";

// Le chrono d'un match, dans le Direct (feuille-direct.tsx, 23/11/2026 ;
// la règle : lib/sfl/chrono-match.ts). Une rangée sous le tableau
// d'affichage : la mi-temps, le temps, puis le geste du moment.
//   · avant : « Coup d'envoi » ;
//   · en jeu : « −1′ » et « +1′ » (les minutes ajoutées s'affichent à côté
//     du temps, « +2 ») ;
//   · à la mi-temps : « 2e mi-temps » ;
//   · à la fin : le temps final.
// « ↺ » remet le chrono à zéro, en deux touchers (le second confirme).
//
// Les coups de sifflet ne sont pas ici : SiffletsDuDirect, posé sur la page
// Journée, siffle même Direct fermé, tant que la page est ouverte.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { etatDuChrono, formatChrono, libelleAjout, siffletAttendu, doitSiffler, type GesteChrono, type Phase } from "@/lib/sfl/chrono-match";
import type { Equipes } from "@/lib/sfl/feuille-direct";
import type { ChronosDirect } from "@/hooks/use-chronos-direct";
import { haptique } from "@/lib/sfl/haptique";
import { deverrouiller, siffler } from "@/lib/sfl/sifflet";

const PHASE: Record<Phase, string> = {
  avant: "Chrono",
  mt1: "1re MT",
  pause: "Mi-temps",
  mt2: "2e MT",
  fin: "Fin",
};

/** L'heure de la base, relue quatre fois par seconde. */
function useHorloge(maintenant: () => number, actif: boolean): number {
  const [t, setT] = useState(maintenant);
  useEffect(() => {
    if (!actif) return;
    const id = window.setInterval(() => setT(maintenant()), 250);
    return () => window.clearInterval(id);
  }, [maintenant, actif]);
  return actif ? t : maintenant();
}

function Petit({ children, onClick, label, principal = false }: { children: ReactNode; onClick: () => void; label?: string; principal?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        principal ? "bouton-secondaire px-4" : "bouton-secondaire min-w-11 px-3",
        "h-11 shrink-0 text-corps font-semibold tabular-nums"
      )}
    >
      {children}
    </button>
  );
}

export function ChronoDuMatch({ chronos, equipes }: { chronos: ChronosDirect; equipes: Equipes }) {
  const c = chronos.chronoDe(equipes);
  const enJeu = !!c?.lance_le;
  const t = useHorloge(chronos.maintenant, enJeu);
  const e = etatDuChrono(c, t);
  const [confirmer, setConfirmer] = useState(false);
  useEffect(() => {
    if (!confirmer) return;
    const id = window.setTimeout(() => setConfirmer(false), 3000);
    return () => window.clearTimeout(id);
  }, [confirmer]);

  function jouer(g: GesteChrono, minutes = 0) {
    deverrouiller();
    if (g === "ajout") (minutes > 0 ? haptique.ajout : haptique.retrait)();
    else haptique.sceau();
    void chronos.geste(equipes, g, minutes).then((ok) => {
      if (!ok && g !== "ajout") {
        haptique.refus();
        toast.error("Chrono pas à jour");
      }
    });
  }

  const ajout = libelleAjout(e.ajout);
  return (
    <div className="flex items-center gap-2">
      <span className={cn("mono-label w-[4.5rem] shrink-0", e.phase === "avant" ? "text-encre-4" : "text-encre-3")}>{PHASE[e.phase]}</span>
      <span
        className={cn(
          "font-display min-w-0 flex-1 text-titre-m leading-none tabular-nums",
          e.phase === "avant" && "text-encre-4",
          (e.phase === "pause" || e.phase === "fin") && "text-encre-3"
        )}
        aria-live="off"
      >
        {formatChrono(e.affiche)}
        {ajout && <span className="mono-label ml-1.5 align-middle text-encre-3">{ajout}′</span>}
      </span>
      {e.phase === "avant" && (
        <Petit principal onClick={() => jouer("lancer")}>
          Coup d&apos;envoi
        </Petit>
      )}
      {(e.phase === "mt1" || e.phase === "mt2") && (
        <>
          <Petit label="Retirer une minute" onClick={() => jouer("ajout", -1)}>
            −1′
          </Petit>
          <Petit label="Ajouter une minute" onClick={() => jouer("ajout", 1)}>
            +1′
          </Petit>
        </>
      )}
      {e.phase === "pause" && (
        <Petit principal onClick={() => jouer("seconde")}>
          2e mi-temps
        </Petit>
      )}
      {e.phase !== "avant" && (
        <button
          type="button"
          aria-label={confirmer ? "Confirmer la remise à zéro" : "Remettre le chrono à zéro"}
          onClick={() => {
            if (!confirmer) {
              haptique.choix();
              setConfirmer(true);
              return;
            }
            setConfirmer(false);
            jouer("remettre");
          }}
          className={cn(
            "flex h-11 shrink-0 items-center justify-center gap-1.5",
            confirmer ? "bouton-principal px-3 text-corps font-semibold" : "bouton-discret w-9 text-encre-3"
          )}
        >
          <RotateCcw className="size-4" />
          {confirmer && "0:00"}
        </button>
      )}
    </div>
  );
}

const JOUES_KEY = "sfl-sifflets-joues";

function joues(): string[] {
  try {
    const l = JSON.parse(window.localStorage.getItem(JOUES_KEY) ?? "[]") as string[];
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

function marquer(cle: string) {
  try {
    window.localStorage.setItem(JOUES_KEY, JSON.stringify([...joues().filter((k) => k !== cle), cle].slice(-40)));
  } catch {
    /* stockage indisponible : il pourrait siffler une seconde fois au rechargement */
  }
}

type Verrou = { release: () => Promise<void> };

/**
 * Les coups de sifflet des matchs de la journée, sur cet appareil : à la
 * mi-temps (deux coups) et à la fin (trois), une seule fois chacun, même
 * après un rechargement (`sfl-sifflets-joues`). Un coup de sifflet manqué
 * (l'app fermée à ce moment-là) ne se rattrape pas au-delà de 15 s. Tant
 * qu'un chrono tourne, l'écran ne se met pas en veille (Wake Lock), pour
 * que la tablette siffle. Ne rend rien.
 */
export function SiffletsDuDirect({ chronos, matchs }: { chronos: ChronosDirect; matchs: { n: number; equipes: Equipes; fini: boolean }[] }) {
  const armes = useRef(new Set<string>());
  const verrou = useRef<Verrou | null>(null);
  const tourne = matchs.some((m) => !m.fini && !!chronos.chronoDe(m.equipes)?.lance_le);

  // Le son s'ouvre au premier toucher sur la page (Safari).
  useEffect(() => {
    if (!tourne) return;
    const ouvrir = () => deverrouiller();
    document.addEventListener("pointerdown", ouvrir, { capture: true });
    return () => document.removeEventListener("pointerdown", ouvrir, { capture: true });
  }, [tourne]);

  useEffect(() => {
    if (!tourne) return;
    const tic = () => {
      const t = chronos.maintenant();
      const deja = joues();
      for (const m of matchs) {
        if (m.fini) continue;
        const s = siffletAttendu(chronos.chronoDe(m.equipes));
        if (!s || deja.includes(s.cle)) continue;
        if (t < s.a) {
          armes.current.add(s.cle);
          continue;
        }
        const arme = armes.current.has(s.cle);
        armes.current.delete(s.cle);
        marquer(s.cle);
        if (!doitSiffler(s.a, t, arme)) continue;
        siffler(s.quoi);
        haptique.carton();
        toast(s.quoi === "mi-temps" ? `Mi-temps · M${m.n}` : `Fin · M${m.n}`);
      }
    };
    tic();
    const id = window.setInterval(tic, 250);
    return () => window.clearInterval(id);
  }, [tourne, chronos, matchs]);

  // L'écran allumé tant qu'un chrono tourne (et rallumé au retour sur l'app).
  useEffect(() => {
    if (!tourne) return;
    const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<Verrou> } }).wakeLock;
    if (!wl) return;
    let fini = false;
    const prendre = () => {
      if (document.visibilityState !== "visible" || verrou.current) return;
      wl.request("screen")
        .then((v) => {
          if (fini) void v.release().catch(() => {});
          else {
            verrou.current = v;
            (v as unknown as EventTarget).addEventListener?.("release", () => {
              if (verrou.current === v) verrou.current = null;
            });
          }
        })
        .catch(() => {});
    };
    prendre();
    document.addEventListener("visibilitychange", prendre);
    return () => {
      fini = true;
      document.removeEventListener("visibilitychange", prendre);
      const v = verrou.current;
      verrou.current = null;
      if (v) void v.release().catch(() => {});
    };
  }, [tourne]);

  return null;
}
