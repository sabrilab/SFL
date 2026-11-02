"use client";

// Le moment où l'app a le droit d'annoncer quelque chose d'elle-même (la
// cérémonie des nouvelles cartes, les badges gagnés) : à l'ouverture, une
// fois la saison posée, et à chaque retour dans l'app. Jamais pendant qu'on
// tient la feuille en direct (Sabri, 25/10 : « les animations, quand on prend
// les scores, c'est de les enlever ») : chaque « + » change la saison, et les
// cérémonies se relançaient en plein match.
//
// Concrètement, le compteur rendu avance :
// - à l'ouverture, quand la saison n'a plus bougé depuis CALME ms (la base
//   arrive après le stockage local), au plus tard après OUVERTURE_MAX ms ;
// - quand l'app redevient visible (on revient du terrain, d'une autre app) ;
// - en quittant l'espace admin ;
// - à la révélation du dimanche (revelation.ts : 19 h dès la J5), quand une
//   journée de plus se met à compter : l'app restée ouverte à 19 h a sa
//   cérémonie.
// Dans l'espace admin, il n'avance jamais. Entre deux moments, les
// changements de la saison attendent le prochain.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { SAISIE_EVENT, useSeason } from "@/components/sfl/season-provider";

const CALME = 2500;
const OUVERTURE_MAX = 12_000;

export function useMomentAnnonce(): number {
  const chemin = usePathname();
  const admin = !!chemin?.startsWith("/admin");
  const [moment, setMoment] = useState(0);

  // L'ouverture (ou la sortie de l'admin) : attendre que la saison se pose.
  useEffect(() => {
    if (admin) return;
    let calme: number | undefined;
    const debut = Date.now();
    // Une seule fois : après, les changements de la saison attendent le retour dans l'app.
    const poser = () => {
      window.removeEventListener(SAISIE_EVENT, relancer);
      setMoment((m) => m + 1);
    };
    function relancer() {
      window.clearTimeout(calme);
      calme = window.setTimeout(poser, Math.max(0, Math.min(CALME, debut + OUVERTURE_MAX - Date.now())));
    }
    relancer();
    window.addEventListener(SAISIE_EVENT, relancer);
    return () => {
      window.clearTimeout(calme);
      window.removeEventListener(SAISIE_EVENT, relancer);
    };
  }, [admin]);

  // Le retour dans l'app.
  useEffect(() => {
    if (admin) return;
    const visible = () => {
      if (document.visibilityState === "visible") setMoment((m) => m + 1);
    };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [admin]);

  // La révélation : une journée de plus compte (le minuteur du SeasonProvider).
  const comptees = [...useSeason().revelation.comptees].sort((a, b) => a - b).join(",");
  const avant = useRef(comptees);
  useEffect(() => {
    if (admin || comptees === avant.current) return;
    const plus = comptees.split(",").length > avant.current.split(",").length;
    avant.current = comptees;
    if (!plus) return;
    // Dans un callback, pas dans le corps de l'effet.
    const id = window.setTimeout(() => setMoment((m) => m + 1), 0);
    return () => window.clearTimeout(id);
  }, [admin, comptees]);

  return admin ? 0 : moment;
}
