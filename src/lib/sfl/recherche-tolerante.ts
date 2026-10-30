// Retrouver un joueur même mal écrit (Sabri, 29/10/2026) : « Il faudrait
// pouvoir affiner la recherche par tout moyen, même si on écrit son nom mal
// orthographié. »
//
// Chaque joueur porte plusieurs clés (son nom de saison, son nom affiché,
// son @pseudo, son poste, sa division, son équipe du jour). Une requête
// répond, de la plus sûre à la plus lâche :
//   0 le nom exact · 1 le début d'un mot · 2 un morceau, les initiales ·
//   3 le même son (« Ilies » pour Ilyes, « Kader » pour Qader) ·
//   4+ une faute de frappe (une lettre de trop, de moins, changée ou inversée).
// Plusieurs mots tapés (« ilyes d1 ») doivent tous répondre. Les meilleurs
// d'abord, puis par ordre alphabétique.
//
// Pur.

import { normaliser } from "./recherche-joueur";

/** Le son d'un mot, à la française : assez pour rapprocher deux orthographes d'un prénom. */
export function phonetique(mot: string): string {
  let s = normaliser(mot).replace(/\s+/g, "");
  s = s
    .replace(/ph/g, "f")
    .replace(/qu/g, "k")
    .replace(/q/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/ck/g, "k")
    .replace(/c/g, "k")
    .replace(/sch|sh/g, "ch")
    .replace(/th/g, "t")
    .replace(/gu(?=[ei])/g, "g")
    .replace(/y/g, "i")
    .replace(/h/g, "")
    .replace(/eau|au/g, "o")
    .replace(/ou/g, "u")
    .replace(/ai|ei/g, "e")
    .replace(/[ée]/g, "e")
    .replace(/z/g, "s")
    .replace(/w/g, "v")
    .replace(/(.)\1+/g, "$1");
  return s.replace(/[estdx]$/, "") || s;
}

/** La distance d'édition (Damerau, lettres inversées comprises), arrêtée au-delà de `max`. */
export function distance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let min = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      min = Math.min(min, d[i][j]);
    }
    if (min > max) return max + 1;
  }
  return d[a.length][b.length];
}

const mots = (s: string) => normaliser(s).split(" ").filter(Boolean);

/** Le rang d'un mot tapé contre une clé ; null : aucun rapport. */
function rangMot(t: string, cle: string): number | null {
  const ms = mots(cle);
  if (!ms.length) return null;
  const entier = ms.join(" ");
  if (entier === t) return 0;
  if (ms.some((w) => w.startsWith(t))) return 1;
  if (t.length >= 2 && ms.length > 1 && ms.map((w) => w[0]).join("").startsWith(t)) return 2;
  if (t.length >= 3 && entier.replace(/ /g, "").includes(t)) return 2;
  if (t.length >= 3) {
    const pt = phonetique(t);
    if (pt.length >= 2 && ms.some((w) => phonetique(w) === pt || (pt.length >= 3 && phonetique(w).startsWith(pt)))) return 3;
    // Aucune faute sous quatre lettres, une jusqu'à six, deux au-delà.
    const tolere = t.length < 4 ? 0 : t.length <= 6 ? 1 : 2;
    if (!tolere) return null;
    let best: number | null = null;
    for (const w of ms) {
      const d = Math.min(distance(t, w, tolere), distance(t, w.slice(0, t.length), tolere));
      if (d <= tolere) best = Math.min(best ?? 99, 4 + d);
    }
    return best;
  }
  return null;
}

/** Le rang d'une requête contre les clés d'un joueur (la meilleure clé par mot, la pire des mots) ; null : il ne répond pas. */
export function rangTolerant(cles: readonly (string | null | undefined)[], requete: string): number | null {
  const ts = mots(requete);
  if (!ts.length) return 0;
  let pire = 0;
  for (const t of ts) {
    let mieux: number | null = null;
    for (const c of cles) {
      if (!c) continue;
      const r = rangMot(t, c);
      if (r != null) mieux = Math.min(mieux ?? 99, r);
      if (mieux === 0) break;
    }
    if (mieux == null) return null;
    pire = Math.max(pire, mieux);
  }
  return pire;
}

/** Les éléments qui répondent, les meilleurs d'abord, puis dans leur ordre. */
export function chercherTolerant<T>(items: readonly T[], cles: (t: T) => readonly (string | null | undefined)[], requete: string): T[] {
  if (!normaliser(requete)) return [...items];
  return items
    .map((t, i) => ({ t, i, r: rangTolerant(cles(t), requete) }))
    .filter((x): x is { t: T; i: number; r: number } => x.r != null)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.t);
}
