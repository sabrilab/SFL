// Les photos de la journée, sur la page de chaque joueur (Bola, 26/11/2026) :
// « pour chaque journée, je t'envoie les photos qui ont été prises […] tu
// repères qui est qui […] et tu viens les mettre dans l'onglet Ma carte de
// chaque joueur. Comme si c'était un compte Instagram. »
//
// Une photo appartient à une journée et porte la liste des joueurs qu'on y
// voit (leur nom de saison, la clé de la ligue). Elle apparaît dans la grille
// de chacun d'eux, sur Ma carte et sur son profil (photos-du-joueur.tsx), la
// plus récente journée d'abord.
//
// Étape de maquette : la liste est écrite ici, à la main, une fois les tags
// validés avec Bola sur la planche de la journée. J7 : tags dictés par Bola
// le 26/11 (Adel, Selim L et Yacine confirmés par Bola ; 451,
// des jambes seulement, sans tag). Une fois l'interface validée, la liste
// passera en base (table et bucket privé, comme les vidéos des Actus).

export interface PhotoJournee {
  /** Le numéro de la photo sur la planche (P1440xxx). */
  id: string;
  journee: number;
  /** Le dimanche, AAAA-MM-JJ. */
  date: string;
  src: string;
  largeur: number;
  hauteur: number;
  /** Les joueurs qu'on voit sur la photo (nom de saison). */
  joueurs: string[];
}

const L = { largeur: 1350, hauteur: 763 };
const H = { largeur: 763, hauteur: 1350 };
const j7 = (id: string, f: typeof L, joueurs: string[] = []): PhotoJournee => ({
  id,
  journee: 7,
  date: "2026-11-22",
  src: `/photos-journees/j7/${id}.jpg`,
  ...f,
  joueurs,
});

export const PHOTOS_JOURNEES: PhotoJournee[] = [
  j7("365", L, ["Jouneid", "Zakary"]),
  j7("366", L, ["Jouneid", "Zakary"]),
  j7("372", L, ["Sidali"]),
  j7("379", L, ["Anas", "Youss", "Yamin", "Adel", "Sidali"]),
  j7("384", L, ["Zakary"]),
  j7("385", L, ["Adel", "Youss"]),
  j7("401", L, ["Selim laouadi", "Jouneid"]),
  j7("414", L, ["Zakary"]),
  j7("426", L, ["Anas", "Sidali", "Abdel"]),
  j7("439", H, ["Sosso Abdel"]),
  j7("447", H, ["Nessime"]),
  j7("451", L),
  j7("459", H, ["Ibrahim"]),
  j7("477", H, ["Massi Sidali"]),
  j7("479", H, ["Kais", "Kamil"]),
  j7("480", H, ["Kylian"]),
  j7("483", H, ["Gaïl"]),
  j7("484", H, ["Kais"]),
  j7("485", H, ["Yacine"]),
];

/** Les photos d'un joueur, groupées par journée, la plus récente d'abord. */
export function photosDuJoueur(nom: string, liste: PhotoJournee[] = PHOTOS_JOURNEES): { journee: number; date: string; photos: PhotoJournee[] }[] {
  const miennes = liste.filter((p) => p.joueurs.includes(nom));
  const parJour = new Map<number, PhotoJournee[]>();
  for (const p of miennes) parJour.set(p.journee, [...(parJour.get(p.journee) ?? []), p]);
  return [...parJour.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([journee, photos]) => ({ journee, date: photos[0].date, photos }));
}

/** « dim. 22 nov. » */
export function dateCourte(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/** Les photos d'une journée, dans l'ordre de la prise de vue. */
export function photosDeLaJournee(j: number, liste: PhotoJournee[] = PHOTOS_JOURNEES): PhotoJournee[] {
  return liste.filter((p) => p.journee === j).sort((a, b) => a.id.localeCompare(b.id, "fr", { numeric: true }));
}

/**
 * Les photos d'une journée en blocs pour le fil d'Actus : une photo en
 * largeur seule, deux photos en hauteur côte à côte (une seule, si elle
 * reste sans voisine).
 */
export function blocsDePhotos(photos: PhotoJournee[]): PhotoJournee[][] {
  const blocs: PhotoJournee[][] = [];
  let enAttente: PhotoJournee | null = null;
  for (const p of photos) {
    if (p.largeur >= p.hauteur) blocs.push([p]);
    else if (enAttente) {
      blocs.push([enAttente, p]);
      enAttente = null;
    } else enAttente = p;
  }
  if (enAttente) blocs.push([enAttente]);
  return blocs;
}

/**
 * Où glisser les blocs entre les rubriques d'un dimanche, répartis
 * régulièrement : pour chaque rubrique (dans l'ordre), les blocs qui la
 * suivent. Sans rubrique, tout se range à la place 0.
 */
export function repartirBlocs<T>(blocs: T[], rubriques: number): T[][] {
  const places: T[][] = Array.from({ length: Math.max(1, rubriques) }, () => []);
  blocs.forEach((b, i) => places[Math.floor((i * places.length) / blocs.length)].push(b));
  return places;
}
