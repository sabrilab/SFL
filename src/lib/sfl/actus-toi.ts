// Ce qui te regarde, toi — les modules du fil de la course (Sabri, 22/10 :
// « quels peuvent être les modules qui vont susciter le plus d'intérêt, qui se
// rapprochent de là où ils mettent leur attention »).
//
// Le journal d'activité des 14 derniers jours (admins exclus) le dit sans
// détour : Ma carte est la page où les joueurs passent le plus de temps. Ils
// viennent voir où ils en sont. D'où ces modules, tirés des chiffres :
//   · ton rival : celui juste devant toi, celui juste derrière, l'écart ;
//   · les enjeux : les places qui se jouent à un ou deux points.
// Pur : ni React ni réseau. Les joueurs masqués n'y paraissent pas.

import { rankPlayers, type RankedPlayer } from "./engine";
import { classables, standingsJusqua } from "./rangs";
import type { Saison } from "./saisie/types";

// La règle du classement (rangs.ts) : la saison des votes appliqués
// (useSeason().saison), journées jouées seulement, masqués retirés sauf soi.
const classes = (s: Saison, moi?: string) => rankPlayers(classables(standingsJusqua(s), moi));

export interface Voisins {
  moi: RankedPlayer;
  devant: RankedPlayer | null;
  derriere: RankedPlayer | null;
  total: number;
}

/** Ceux qui t'encadrent au Pépite d'Or. */
export function voisins(saison: Saison, moi: string): Voisins | null {
  const c = classes(saison, moi);
  const i = c.findIndex((p) => p.name === moi);
  if (i < 0) return null;
  const me = c[i];
  const devant = [...c.slice(0, i)].reverse().find((p) => p.pp > me.pp) ?? null;
  const derriere = c.slice(i + 1).find((p) => p.pp < me.pp) ?? null;
  return { moi: me, devant, derriere, total: c.length };
}

export interface Enjeu {
  haut: RankedPlayer;
  bas: RankedPlayer;
  ecart: number;
}

/** Les places qui se jouent au prochain dimanche : deux voisins à `max` points ou moins, dans le haut du classement. */
export function enjeux(saison: Saison, max = 2, haut = 10): Enjeu[] {
  const c = classes(saison).slice(0, haut);
  const out: Enjeu[] = [];
  for (let i = 0; i + 1 < c.length; i++) {
    const ecart = c[i].pp - c[i + 1].pp;
    if (ecart > 0 && ecart <= max) out.push({ haut: c[i], bas: c[i + 1], ecart });
  }
  return out;
}
