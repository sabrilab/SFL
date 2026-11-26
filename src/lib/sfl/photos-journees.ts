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
// validés avec Bola sur la planche de la journée. Les noms des joueurs de la
// J7 ne sont pas encore confirmés : `joueurs` reste vide sauf pour la 372
// (Sid Ali, dit par Bola le 26/11). Une fois l'interface validée, la liste
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
  j7("365", L),
  j7("366", L),
  j7("372", L, ["Sid Ali"]),
  j7("379", L),
  j7("384", L),
  j7("385", L),
  j7("401", L),
  j7("414", L),
  j7("426", L),
  j7("439", H),
  j7("447", H),
  j7("451", L),
  j7("459", H),
  j7("477", H),
  j7("479", H),
  j7("480", H),
  j7("483", H),
  j7("484", H),
  j7("485", H),
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

/**
 * Aperçu seulement (jamais en production) : ?photos=id,id,… montre ces photos
 * sur ma grille, pour juger l'interface avant que les tags soient posés.
 */
export function photosApercu(): PhotoJournee[] | null {
  if (process.env.NEXT_PUBLIC_BOLA_ENV === "production" || typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("photos");
  if (!q) return null;
  const ids = q.split(",");
  return ids.map((id) => PHOTOS_JOURNEES.find((p) => p.id === id)).filter((p): p is PhotoJournee => !!p);
}
