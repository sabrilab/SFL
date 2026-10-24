// Le moodboard des Actus : les images qui couvrent un dimanche ou une
// rubrique, pour que le fil respire (Sabri, 24/10 : « ça a surchargé
// cognitivement parce qu'on n'avait pas d'espace mental et pas d'horizon […]
// des fois en couverture, mettre des images […] un moodboard d'images qui
// seront réutilisées »).
//
// Une banque, pas une image par publication : chaque image porte ses
// étiquettes (ce qu'elle montre), chaque rubrique demande une étiquette, et
// le choix se fait par le numéro du dimanche, le même pour tous et d'une
// visite à l'autre, sans qu'une image revienne deux fois dans un même
// dimanche. Toutes en noir et blanc (l'or, le bleu et le rouge sont aux
// cartes MVP, Défensive et Impact) : générées sur Magnific le 24/10, nos
// maillots BOLA d'après leurs rendus 3D, sans marque ni visage reconnaissable.
// Elles sont dans public/actus/couvertures/, en 720 et 1200 px de large.

import type { Actu } from "./actus";

export type Etiquette = "maillot" | "ombre" | "ballon" | "filet" | "terrain" | "vestiaire" | "course" | "nuit";

export interface Couverture {
  id: string;
  etiquettes: Etiquette[];
  /** Où tient le sujet dans l'image (object-position), quand on la recadre. */
  point?: string;
}

export const COUVERTURES: Couverture[] = [
  { id: "cage-1", etiquettes: ["terrain", "nuit"], point: "50% 60%" },
  { id: "cage-2", etiquettes: ["terrain", "nuit"], point: "50% 55%" },
  { id: "silhouette-1", etiquettes: ["ombre", "nuit"], point: "50% 55%" },
  { id: "silhouette-2", etiquettes: ["ombre", "nuit"], point: "50% 50%" },
  { id: "ombres-1", etiquettes: ["ombre"], point: "50% 40%" },
  { id: "ombres-2", etiquettes: ["ombre"], point: "50% 40%" },
  { id: "banc-1", etiquettes: ["maillot", "vestiaire"], point: "50% 70%" },
  { id: "banc-2", etiquettes: ["maillot", "vestiaire"], point: "50% 70%" },
  { id: "maillot-blanc-1", etiquettes: ["maillot"], point: "40% 45%" },
  { id: "maillot-blanc-2", etiquettes: ["maillot"], point: "40% 45%" },
  { id: "ballon-1", etiquettes: ["ballon", "nuit"], point: "40% 55%" },
  { id: "ballon-2", etiquettes: ["ballon"], point: "50% 45%" },
  { id: "filet-1", etiquettes: ["filet", "ballon", "nuit"], point: "50% 50%" },
  { id: "filet-2", etiquettes: ["filet", "ballon", "nuit"], point: "50% 55%" },
  { id: "crampons-3", etiquettes: ["vestiaire"], point: "50% 60%" },
  { id: "crampons-4", etiquettes: ["vestiaire"], point: "50% 60%" },
  { id: "course-1", etiquettes: ["course", "ballon"], point: "50% 60%" },
  { id: "course-2", etiquettes: ["course", "ballon"], point: "50% 60%" },
];

/** Les deux tailles d'une image, pour srcset. */
export const sources = (c: Couverture) => ({
  src: `/actus/couvertures/${c.id}-720.webp`,
  srcSet: `/actus/couvertures/${c.id}-720.webp 720w, /actus/couvertures/${c.id}-1200.webp 1200w`,
});

/** Ce que demande chaque rubrique d'un dimanche, de la plus juste à la plus large. */
const DEMANDE: Partial<Record<Actu["type"], Etiquette[]>> = {
  mvp: ["maillot", "ombre"],
  chiffre: ["filet", "ballon"],
  duo: ["ombre", "course"],
  montent: ["course", "ombre"],
  badge: ["vestiaire", "maillot"],
  badges: ["vestiaire", "maillot"],
  equipe: ["maillot", "vestiaire"],
};

/** La couverture d'un dimanche : le terrain la nuit, les ombres, les maillots, à tour de rôle. */
const CHAPITRE: Etiquette[][] = [["terrain"], ["maillot"], ["ombre"], ["vestiaire"], ["ballon"]];

const tirer = <T,>(liste: T[], n: number) => liste[((n % liste.length) + liste.length) % liste.length];

/**
 * Les couvertures d'un dimanche : la sienne, en tête, puis celles de ses
 * rubriques, une sur trois en comptant depuis la deuxième (jamais deux
 * rubriques couvertes de suite, ni la première, qui suit déjà la couverture
 * du dimanche). Une image ne sert qu'une fois par dimanche.
 */
export function couverturesDuDimanche(j: number, types: Actu["type"][]): { chapitre: Couverture; rubriques: (Couverture | null)[] } {
  const prises = new Set<string>();
  const choisir = (voulues: Etiquette[], n: number) => {
    for (const e of voulues) {
      const libres = COUVERTURES.filter((c) => c.etiquettes.includes(e) && !prises.has(c.id));
      if (libres.length) {
        const c = tirer(libres, n);
        prises.add(c.id);
        return c;
      }
    }
    const c = tirer(COUVERTURES.filter((c) => !prises.has(c.id)), n);
    prises.add(c.id);
    return c;
  };
  const chapitre = choisir(tirer(CHAPITRE, j), j * 7);
  const rubriques = types.map((t, i) => (i % 3 === 1 && DEMANDE[t] ? choisir(DEMANDE[t]!, j * 3 + i) : null));
  return { chapitre, rubriques };
}
