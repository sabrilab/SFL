// L'affiche du match (Sabri, 31/10 : « générer une image des deux joueurs
// les plus forts automatiquement, comme ça ça pourrait être l'affiche du
// match »). Les deux meilleures notes parmi ceux qui viennent (ou, avant la
// composition, les habitués), et leur image, faite à partir de leurs photos
// de carte. Elle prend la place du terrain dessiné sur la carte du match, et
// s'affiche en grand dans la page du lieu (app/map/page.tsx).
//
// Essai du 31/10 : les images sont faites à la main, une par paire de
// joueurs ; une paire sans image n'a pas d'affiche, et la carte garde son
// terrain. Pas d'image dans le dépôt (il est public) : l'essai Jouneid +
// Zakary n'a été posé que pour les captures ; la suite les fera faire par
// fal côté serveur et les gardera dans un bucket.

import { ovr, type Player } from "./engine";

export interface Affiche {
  image: string;
  joueurs: { nom: string; note: number }[];
}

/** Une image par paire (noms triés, joints par « + »). */
const IMAGES: Record<string, string> = {};

const cleDePaire = (a: string, b: string) => [a, b].sort((x, y) => x.localeCompare(y, "fr")).join("+");

/** Les deux meilleures notes parmi ces noms, et leur affiche si elle existe. */
export function afficheDe(noms: readonly string[], joueur: (nom: string) => Player | undefined): Affiche | null {
  const notes = [...new Set(noms)]
    .map((nom) => {
      const p = joueur(nom);
      return p ? { nom, note: ovr(p.stats) } : null;
    })
    .filter((x): x is { nom: string; note: number } => !!x)
    .sort((a, b) => b.note - a.note || a.nom.localeCompare(b.nom, "fr"));
  if (notes.length < 2) return null;
  const [a, b] = notes;
  const image = IMAGES[cleDePaire(a.nom, b.nom)];
  return image ? { image, joueurs: [a, b] } : null;
}
