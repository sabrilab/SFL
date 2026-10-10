// Retrouver un joueur en deux lettres.
//
// Un effectif de quatre-vingts noms, et un admin qui cherche « Adil » entre
// deux saisies : la recherche doit répondre dès la première lettre, sans se
// soucier des accents ni des majuscules, et accepter qu'on tape un début de
// prénom, un début de nom, ou les deux (« ad ma » → Adil Maimouni), ou les
// initiales (« am »).

export function normaliser(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/['-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const mots = (s: string) => normaliser(s).split(" ").filter(Boolean);

/** Vrai si le nom répond à la requête ; une requête vide répond toujours. */
export function correspond(nom: string, requete: string): boolean {
  const q = mots(requete);
  if (!q.length) return true;
  const m = mots(nom);
  // Chaque mot tapé commence un mot du nom, dans l'ordre d'apparition.
  let depuis = 0;
  const enOrdre = q.every((t) => {
    const i = m.findIndex((w, k) => k >= depuis && w.startsWith(t));
    if (i < 0) return false;
    depuis = i + 1;
    return true;
  });
  if (enOrdre) return true;
  // Un seul mot tapé : les initiales (« am »), ou un morceau au milieu (« mouni »).
  if (q.length === 1) {
    const t = q[0];
    if (t.length >= 2 && m.map((w) => w[0]).join("").startsWith(t)) return true;
    if (t.length >= 3 && m.some((w) => w.includes(t))) return true;
  }
  return false;
}

/** Le rang d'un nom pour une requête : plus c'est petit, plus ça colle. */
export function rang(nom: string, requete: string): number {
  const q = normaliser(requete);
  const n = normaliser(nom);
  if (!q) return 0;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (mots(nom).some((w) => w.startsWith(q.split(" ")[0]))) return 2;
  return 3;
}

/** Les noms qui répondent, du plus proche au plus lointain, puis par ordre alphabétique. */
export function chercherJoueurs<T>(items: T[], nomDe: (t: T) => string, requete: string): T[] {
  if (!normaliser(requete)) return items;
  return items
    .filter((t) => correspond(nomDe(t), requete))
    .sort((a, b) => rang(nomDe(a), requete) - rang(nomDe(b), requete) || nomDe(a).localeCompare(nomDe(b)));
}
