// À l'honneur — ce que la Ligue met en avant d'un dimanche, joueur par joueur
// (demande de Sabri, 18/10 : « on doit vraiment mettre en avant les joueurs,
// montrer beaucoup de cartes »). Le haut de la vue Journée en est fait :
//   · l'homme du dimanche  : le ou les MVP de la journée ;
//   · ils ont décroché     : les badges de palier gagnés ce dimanche-là
//                            (la vitrine au soir de J comparée à celle de la veille) ;
//   · l'équipe type        : les cinq qui ont pris le plus de points Pépite ;
//   · le duo               : la passe et le but qui se sont le plus répétés ;
//   · ils montent          : les plus belles remontées au classement Pépite ;
//   · dans la surface      : ceux à un pas de leur prochain badge.
// Tout se lit « au soir de J » : la saison est tronquée aux journées ≤ J,
// comme le récap. Calculé, rien n'est stocké. Les joueurs masqués n'y sont pas.

import { rankPlayers } from "./engine";
import { isHidden } from "./hidden";
import { computeStandings, entryPP } from "./saisie/engine";
import { journeeJouee } from "./saisie/mutations";
import type { Saison } from "./saisie/types";
import { vitrine, type TropheeId } from "./trophees";

export interface Decroche {
  nom: string;
  id: TropheeId;
  /** Le palier atteint ce dimanche (1 = bronze… 4 = rouge et or). */
  palier: number;
  valeur: number;
}

export interface Surface {
  nom: string;
  id: TropheeId;
  /** Ce qui manque pour le prochain palier. */
  reste: number;
  /** Le palier qui tombera. */
  palier: number;
}

export interface Honneur {
  j: number;
  mvp: { nom: string; buts: number; passes: number; pp: number }[];
  decroches: Decroche[];
  equipeType: { nom: string; pp: number }[];
  duo: { passeur: string; buteur: string; n: number } | null;
  montent: { nom: string; gain: number; rang: number }[];
  surface: Surface[];
}

const jusqua = (s: Saison, j: number): Saison => ({
  ...s,
  entries: s.entries.filter((e) => e.j <= j),
  events: s.events?.filter((e) => e.j <= j),
});

// La saison ne se rejoue pas d'un dimanche à l'autre : les badges, le plus
// coûteux (une vitrine par joueur, deux fois), ne se calculent qu'une fois.
const memo = new WeakMap<Saison, Map<string, Honneur>>();

/** Le plus rare d'abord : à palier égal, l'ordre de la vitrine. */
const ORDRE: TropheeId[] = ["mvp", "buts", "passes", "mur", "impact", "cleanSheet", "victoires", "serie", "matchs", "saisons"];

export function honneurDe(saison: Saison, j: number, moi?: string): Honneur {
  let parJ = memo.get(saison);
  if (!parJ) memo.set(saison, (parJ = new Map()));
  const cle = `${j}|${moi ?? ""}`;
  const deja = parJ.get(cle);
  if (deja) return deja;

  const lignes = saison.entries.filter((e) => e.j === j && !isHidden(e.player));
  const presents = [...new Set(lignes.filter((e) => e.statut === "Présent" && !e.extraTime).map((e) => e.player))];

  // L'homme du dimanche — un par match quand la journée en a plusieurs.
  const mvp = lignes
    .filter((e) => e.mvp && !e.extraTime)
    .map((e) => ({
      nom: e.player,
      buts: e.buts,
      passes: e.passes,
      pp: lignes.filter((x) => x.player === e.player).reduce((t, x) => t + entryPP(x), 0),
    }));

  // Les badges : la vitrine au soir de J, et la veille.
  const apres = jusqua(saison, j);
  const avant = { ...saison, entries: saison.entries.filter((e) => e.j < j), events: saison.events?.filter((e) => e.j < j) };
  const decroches: Decroche[] = [];
  const surface: Surface[] = [];
  for (const nom of presents) {
    const v1 = vitrine(apres, nom);
    const v0 = new Map(vitrine(avant, nom).map((t) => [t.def.id, t.palier]));
    for (const t of v1) {
      if (t.palier > (v0.get(t.def.id) ?? 0)) decroches.push({ nom, id: t.def.id, palier: t.palier, valeur: t.valeur });
      // Les saisons ne se gagnent pas un dimanche : pas de chasse là-dessus.
      if (t.def.id !== "saisons" && t.cible != null && t.cible - t.valeur === 1) {
        surface.push({ nom, id: t.def.id, reste: 1, palier: t.palier + 1 });
      }
    }
  }
  const rare = (a: { id: TropheeId; palier: number }, b: { id: TropheeId; palier: number }) =>
    b.palier - a.palier || ORDRE.indexOf(a.id) - ORDRE.indexOf(b.id);
  // Un badge par joueur dans la vitrine du jour : son plus beau.
  decroches.sort(rare);
  const unParJoueur = decroches.filter((d, i) => decroches.findIndex((x) => x.nom === d.nom) === i);
  surface.sort((a, b) => (a.nom === moi ? -1 : b.nom === moi ? 1 : rare(a, b)));
  const surfaceUnique = surface.filter((d, i) => surface.findIndex((x) => x.nom === d.nom) === i);

  // L'équipe type : les points Pépite du jour, puis les buts et les passes.
  const pts = new Map<string, { pp: number; ga: number }>();
  for (const e of lignes) {
    const p = pts.get(e.player) ?? { pp: 0, ga: 0 };
    p.pp += entryPP(e);
    p.ga += e.buts + e.passes;
    pts.set(e.player, p);
  }
  const equipeType = presents
    .map((nom) => ({ nom, ...pts.get(nom)! }))
    .sort((a, b) => b.pp - a.pp || b.ga - a.ga)
    .slice(0, 5)
    .map(({ nom, pp }) => ({ nom, pp }));

  // Le duo : la même passe, le même buteur, au moins deux fois.
  const paires = new Map<string, number>();
  for (const ev of saison.events ?? []) {
    if (ev.j !== j || !ev.passeur || ev.type === "csc" || isHidden(ev.player) || isHidden(ev.passeur)) continue;
    const k = `${ev.passeur}\u0000${ev.player}`;
    paires.set(k, (paires.get(k) ?? 0) + 1);
  }
  const [meilleure] = [...paires].sort((a, b) => b[1] - a[1]);
  const duo = meilleure && meilleure[1] >= 2
    ? { passeur: meilleure[0].split("\u0000")[0], buteur: meilleure[0].split("\u0000")[1], n: meilleure[1] }
    : null;

  // Ils montent : le rang Pépite au soir de J, contre celui du dimanche joué d'avant.
  const precedent = Math.max(0, ...saison.journees.map((m) => m.j).filter((x) => x < j && journeeJouee(saison, x)));
  let montent: Honneur["montent"] = [];
  if (precedent > 0) {
    const rangs = (s: Saison) => new Map(rankPlayers(computeStandings(s).filter((p) => !isHidden(p.name))).map((p) => [p.name, p.rank]));
    const r1 = rangs(apres);
    const r0 = rangs(jusqua(saison, precedent));
    montent = presents
      .filter((nom) => r0.has(nom) && r1.has(nom))
      .map((nom) => ({ nom, gain: r0.get(nom)! - r1.get(nom)!, rang: r1.get(nom)! }))
      .filter((m) => m.gain > 0)
      .sort((a, b) => b.gain - a.gain || a.rang - b.rang)
      .slice(0, 5);
  }

  const h: Honneur = { j, mvp, decroches: unParJoueur, equipeType, duo, montent, surface: surfaceUnique.slice(0, 8) };
  parJ.set(cle, h);
  return h;
}
