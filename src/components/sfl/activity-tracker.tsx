"use client";

// Mouchard d'usage — le compagnon silencieux du journal d'activité.
//
// Monté une seule fois (dans la mise en page), il pose trois marques :
//   · « view »      à chaque changement de page (une fois par page et par session) ;
//   · « heartbeat » toutes les 90 s tant que l'onglet est visible ;
//   · « close »     dès que l'onglet passe en arrière-plan ou se ferme.
//
// L'écart entre le premier et le dernier événement d'une session donne le
// temps de connexion. Rien n'est écrit sans session serveur (cf. logActivity),
// et rien n'est bloquant : ce composant ne rend aucun élément.

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { logActivity } from "@/lib/sfl/activity";

/** Un battement toutes les 90 s : assez fin pour la durée, assez rare pour la base. */
const HEARTBEAT_MS = 90_000;

export function ActivityTracker() {
  const pathname = usePathname();
  const seen = useRef<Set<string>>(new Set());

  // Une vue par page et par session : on ne compte pas les allers-retours.
  useEffect(() => {
    if (seen.current.has(pathname)) return;
    seen.current.add(pathname);
    logActivity("view", { path: pathname });
  }, [pathname]);

  // Battements + fin de session.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const beat = () => {
      if (document.visibilityState === "visible") logActivity("heartbeat");
    };
    const start = () => {
      if (timer === null) timer = setInterval(beat, HEARTBEAT_MS);
    };
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
        logActivity("close");
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stop);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", stop);
    };
  }, []);

  return null;
}
