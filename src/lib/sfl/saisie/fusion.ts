// Deux appareils d'admin sur la même saison (22/11/2026, la J7).
//
// La saison part en base en un seul document. Jusqu'ici, un appareil dont la
// publication arrivait après celle d'un autre recevait un « conflit » et
// restait figé sur sa copie : « Reprendre la base » effaçait sa saisie,
// « Écraser » effaçait celle de l'autre (et la base le refusait dès qu'une
// feuille avait été scellée entre-temps). Le 22/11, 80 publications d'un
// ordinateur ont été refusées ainsi, et deux matchs ne sont jamais arrivés.
//
// Ce module, pur, fusionne à la place. Trois documents :
//   · `base`   : la saison telle que cet appareil l'a lue ou publiée la
//                dernière fois (son point de départ) ;
//   · `locale` : la saison de cet appareil, avec ce qu'il a saisi depuis ;
//   · `autre`  : la saison de la base aujourd'hui, avec ce que l'autre
//                appareil a publié entre-temps.
// On repart de `autre` et on y repose ce que CET appareil a changé depuis
// `base`, champ par champ : les buts d'un joueur saisis ici, le résultat posé
// là-bas, tout reste. Quand les deux ont changé le même champ de la même
// ligne, c'est la valeur de cet appareil qui est gardée (celle que l'admin a
// sous les yeux), et le champ est compté dans `croises`.
//
//   · les lignes de match se reconnaissent par journée, joueur et extra time ;
//   · les journées par leur numéro, les fiches par leur nom ;
//   · tout autre morceau de la saison (convocations, terrains, archives…) se
//     prend en bloc : celui de cet appareil s'il l'a changé, sinon celui de la
//     base.
// Banc : tools/fusion-check.ts.

import type { MatchEntry, Saison } from "./types";

const meme = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

type Objet = Record<string, unknown>;

/** Un objet, champ par champ. `croises` compte les champs changés des deux côtés. */
function fusionnerObjet<T extends object>(base: T | undefined, locale: T, autre: T, compter: () => void): T {
  if (!base) return meme(locale, autre) ? autre : { ...autre, ...locale };
  const b = base as Objet;
  const l = locale as Objet;
  const a = autre as Objet;
  let sortie: Objet | null = null;
  for (const k of new Set([...Object.keys(b), ...Object.keys(l)])) {
    if (meme(l[k], b[k])) continue; // pas touché ici : la base fait foi
    if (meme(l[k], a[k])) continue; // le même changement des deux côtés
    if (!meme(a[k], b[k])) compter();
    sortie ??= { ...a };
    if (k in l) sortie[k] = l[k];
    else delete sortie[k];
  }
  return (sortie ?? a) as T;
}

/** Une liste d'objets reconnus par une clé ; l'ordre est celui de `autre`, les ajouts d'ici à la fin. */
function fusionnerListe<T extends object>(
  base: readonly T[] | undefined,
  locale: readonly T[] | undefined,
  autre: readonly T[] | undefined,
  cle: (x: T) => string,
  compter: () => void
): T[] {
  const indexer = (l: readonly T[] | undefined) => {
    const m = new Map<string, T>();
    const vus = new Map<string, number>();
    for (const x of l ?? []) {
      const k = cle(x);
      const n = vus.get(k) ?? 0;
      vus.set(k, n + 1);
      m.set(n ? `${k}#${n}` : k, x);
    }
    return m;
  };
  const B = indexer(base);
  const L = indexer(locale);
  const A = indexer(autre);
  const sortie: T[] = [];
  for (const [k, a] of A) {
    const l = L.get(k);
    const b = B.get(k);
    if (l) sortie.push(fusionnerObjet(b, l, a, compter));
    else if (!b) sortie.push(a); // ajoutée là-bas
    else if (!meme(a, b)) {
      // retirée ici, changée là-bas : on la garde
      compter();
      sortie.push(a);
    }
  }
  for (const [k, l] of L) {
    if (A.has(k)) continue;
    const b = B.get(k);
    if (!b) sortie.push(l); // ajoutée ici
    else if (!meme(l, b)) {
      // retirée là-bas, changée ici : on la garde
      compter();
      sortie.push(l);
    }
  }
  return sortie;
}

const cleLigne = (e: MatchEntry) => `${e.j}|${e.player.trim().toLowerCase()}|${e.extraTime ? 1 : 0}`;

export interface Fusion {
  saison: Saison;
  /** Cet appareil avait-il quelque chose à poser sur la base ? */
  change: boolean;
  /** Les champs changés des deux côtés (la valeur de cet appareil est gardée). */
  croises: number;
}

export function fusionnerSaisons(base: Saison, locale: Saison, autre: Saison): Fusion {
  if (meme(locale, base)) return { saison: autre, change: false, croises: 0 };
  if (meme(autre, base)) return { saison: locale, change: true, croises: 0 };
  let croises = 0;
  const compter = () => {
    croises++;
  };
  const s: Objet = { ...(autre as unknown as Objet) };
  const b = base as unknown as Objet;
  const l = locale as unknown as Objet;
  const a = autre as unknown as Objet;
  for (const k of new Set([...Object.keys(b), ...Object.keys(l)])) {
    if (k === "entries") s.entries = fusionnerListe(base.entries, locale.entries, autre.entries, cleLigne, compter);
    else if (k === "journees") s.journees = fusionnerListe(base.journees, locale.journees, autre.journees, (m) => String(m.j), compter);
    else if (k === "roster") s.roster = fusionnerListe(base.roster, locale.roster, autre.roster, (r) => r.name.trim().toLowerCase(), compter);
    else if (!meme(l[k], b[k]) && !meme(l[k], a[k])) {
      if (!meme(a[k], b[k])) compter();
      if (k in l) s[k] = l[k];
      else delete s[k];
    }
  }
  const saison = s as unknown as Saison;
  return { saison, change: !meme(saison, autre), croises };
}
