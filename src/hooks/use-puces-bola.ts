"use client";

// Les puces d'un match Bola vu dans sa fiche (fiche-partie.tsx) : la seule
// dorée du MVP, une fois le match validé (Ilyes, 02/11/2026 ; la règle est
// dans lib/sfl/puces-titres.ts, titresBola).
//
// La fiche lit la feuille brute du match (match_joueurs) : on n'y calcule
// pas le MVP. On lit le match tel que la ligue le compte (ligue_vierge(),
// match_bola_json : les mêmes lignes, le même état, le même MVP que le
// classement et la carte MVP Bola), passé par compterMatchs. La lecture
// n'a lieu que si `actif` : la fiche le donne quand la base dit déjà
// « compte » (useBilan), condition nécessaire d'un match validé. Elle se
// refait quand `cle` change (une nouvelle version de la feuille, un état
// qui bouge), et retombe à rien dès que `actif` tombe (une correction remet
// le match en attente). Un compte qui n'est pas encore membre ne lit rien
// de la ligue : pas de puce, jamais une fausse.
//
// Le match compté revient aussi (`compte`, seulement validé) : la fiche y lit
// le MVP qu'elle écrit sous le score, le même que la puce (mvpsDeLaFiche).

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BoostType } from "@/lib/sfl/engine";
import { compterMatchs, type MatchCompte } from "@/lib/sfl/ligue-vierge";
import { lireLigueVierge } from "@/lib/sfl/matchs";
import { titresBola } from "@/lib/sfl/puces-titres";

export interface PucesBola {
  /** Les puces d'un joueur (son id) : la dorée du MVP d'un match validé, sinon rien. */
  titresDe: (id: string) => readonly BoostType[];
  /** Le match tel que la ligue le compte, une fois validé ; null avant (pas lu, pas validé, pas vu). */
  compte: MatchCompte | null;
}

/** Les puces du match `matchId` et, validé, son compte ; rien tant qu'il n'est pas validé. */
export function usePucesBola(matchId: number, actif: boolean, cle?: string | number | null): PucesBola {
  const [lu, setLu] = useState<{ id: number; cle: string | number | null | undefined; m: MatchCompte | null } | null>(null);
  useEffect(() => {
    if (!actif || matchId <= 0) return;
    let fini = false;
    lireLigueVierge()
      .then((tous) => {
        if (fini) return;
        const brut = tous.find((x) => x.id === matchId);
        // Le MVP et la validité d'un match ne dépendent que de lui : compté seul.
        setLu({ id: matchId, cle, m: brut ? (compterMatchs([brut])[0] ?? null) : null });
      })
      .catch(() => !fini && setLu({ id: matchId, cle, m: null }));
    return () => {
      fini = true;
    };
  }, [matchId, actif, cle]);
  // Rien de l'ancienne lecture tant que la nouvelle n'est pas là : jamais un MVP d'une autre version.
  const m = actif && lu?.id === matchId && lu.cle === cle ? lu.m : null;
  const compte = m?.valide ? m : null;
  const titresDe = useCallback((id: string) => titresBola(compte, id), [compte]);
  return useMemo(() => ({ titresDe, compte }), [titresDe, compte]);
}
