"use client";

// « Ta ville » : les communes qui répondent à une saisie, pendant la frappe
// (/api/geocode?type=commune, la Base Adresse Nationale). Le catalogue des
// joueurs sur la Map et l'invitation de l'ouverture (invitation-ville.tsx)
// cherchent avec la même.

import { useEffect, useState } from "react";

/** Une commune trouvée : son centre, et « Tourcoing · Nord ». */
export interface Commune {
  lat: number;
  lng: number;
  libelle: string;
  commune?: string;
}

/** Les communes d'une saisie, à partir de trois lettres. */
export function useCommunes(q: string): Commune[] {
  const saisie = q.trim();
  const [trouvees, setTrouvees] = useState<Commune[]>([]);

  useEffect(() => {
    if (saisie.length < 3) return;
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?type=commune&q=${encodeURIComponent(saisie)}`, { signal: ctl.signal });
        const d = (await res.json()) as { resultats?: Commune[] };
        setTrouvees(d.resultats ?? []);
      } catch {}
    }, 220);
    return () => {
      ctl.abort();
      window.clearTimeout(t);
    };
  }, [saisie]);

  return saisie.length >= 3 ? trouvees : [];
}
