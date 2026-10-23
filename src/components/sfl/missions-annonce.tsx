"use client";

// Sonne l'annonce des missions (/api/missions/annoncer) depuis l'app de
// chaque joueur, tant qu'une journée a des missions ouvertes : ouverture de
// l'app, puis toutes les 20 minutes. Le serveur décide (feuille finie, avant
// le coup d'envoi, un seul envoi par joueur) ; ici, rien ne s'affiche.

import { useEffect } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { useSession } from "@/hooks/use-session";
import { dimancheEnCours } from "@/lib/sfl/missions";
import { annoncerMissions } from "@/lib/sfl/missions-reponses";

export function MissionsAnnonce() {
  const isClient = useIsClient();
  const session = useSession();
  const { saison } = useSeason();
  const actif = isClient && !!session?.server;
  useEffect(() => {
    if (!actif) return;
    const sonner = () => {
      const maintenant = new Date();
      const d = dimancheEnCours(saison, maintenant);
      if (!d || d.joue || maintenant.getTime() >= d.coupEnvoi.getTime()) return;
      void annoncerMissions(d.saison, d.j);
    };
    sonner();
    const id = window.setInterval(sonner, 20 * 60_000);
    return () => window.clearInterval(id);
  }, [actif, saison]);
  return null;
}
