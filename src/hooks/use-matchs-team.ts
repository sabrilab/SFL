"use client";

// Les matchs du mode Team pour la Map : les défis acceptés qui n'ont pas
// encore été joués, avec les deux équipes. Rien sans session serveur, et
// rien si la base ne répond pas : la Map continue sans eux.

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/use-session";
import { coupDEnvoi, listerDefis, listerEquipes, type Defi, type Equipe } from "@/lib/sfl/equipes";

export interface MatchTeam {
  defi: Defi;
  de: Equipe;
  a: Equipe;
}

export function useMatchsTeam(): MatchTeam[] {
  const session = useSession();
  const actif = !!session?.server;
  const [matchs, setMatchs] = useState<MatchTeam[]>([]);

  useEffect(() => {
    if (!actif) return;
    let fini = false;
    Promise.all([listerDefis(), listerEquipes()])
      .then(([defis, equipes]) => {
        if (fini) return;
        const par = new Map(equipes.map((e) => [e.id, e]));
        // Le match reste sur la Map jusqu'à deux heures après le coup d'envoi.
        const limite = Date.now() - 2 * 3600_000;
        setMatchs(
          defis.flatMap((d) => {
            const de = par.get(d.de);
            const a = par.get(d.a);
            return d.statut === "accepte" && de && a && coupDEnvoi(d).getTime() > limite ? [{ defi: d, de, a }] : [];
          })
        );
      })
      .catch(() => {
        /* base injoignable : pas de match d'équipe sur la Map */
      });
    return () => {
      fini = true;
    };
  }, [actif]);

  return matchs;
}
