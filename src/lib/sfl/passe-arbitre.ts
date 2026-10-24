// Le passe d'arbitre : la passe de la saison d'un arbitre (Sabri, 24/10 :
// « que ça leur ramène, dans les trophées à avoir dans les passes […] des
// skins de cartes, mais d'arbitres, et des choses pour l'arbitre »).
//
// Le même rythme que le Passe Bola des joueurs (passe.ts) : vingt paliers,
// 3 000 XP pour finir, des paliers de plus en plus chers, et quatre épreuves
// aux paliers 5, 10, 15 et 20 ; l'XP vient de ses missions d'arbitre
// (missions-arbitre.ts). Les récompenses sont à lui seul, sur sa carte
// d'arbitre :
//   · des skins de tenue, en noir, blanc et métal, jamais d'or, de bleu ni
//     de rouge (réservés aux cartes MVP, Défensive et Impact) : craie,
//     ardoise, rayé, damier (le drapeau de l'assistant), nuit de match (les
//     projecteurs), chrono, argent, platine, filets (le filet du but) ;
//   · des signes : les liserés, la puce noire et le nom gravé des joueurs,
//     et deux à lui : le sifflet gravé et les cartons ;
//   · ses grades, dans l'étiquette de la carte : Ligue, National, Élite,
//     International ;
//   · au 20, sa carte de saison imprimée, en vrai.
// Rien n'est imposé : il porte ce qu'il choisit parmi ce qu'il a gagné
// (profiles.habillage_arbitre, arbitres.ts).
//
// Pur : ni React ni réseau.

import type { Signe } from "@/components/sfl/finitions-carte";
import type { FinitionArbitre, GradeArbitre } from "@/components/sfl/skins-arbitre";
import type { LigneXp, Rang } from "./missions";
import type { Epreuve } from "./passe";

const reussie = (l: LigneXp) => l.mission?.reussie === true;

export const EPREUVES_ARBITRE: readonly Epreuve[] = [
  { numero: 1, romain: "I", palier: 5, nom: "Premier sifflet", phrase: "Réussis une mission que tu as acceptée.", faite: reussie },
  {
    numero: 2,
    romain: "II",
    palier: 10,
    nom: "Unanime",
    phrase: "Réussis la mission Unanime.",
    faite: (l) => reussie(l) && l.mission?.creneau === "unanime",
  },
  {
    numero: 3,
    romain: "III",
    palier: 15,
    nom: "Sang-froid",
    phrase: "Réussis la mission de rang S.",
    faite: (l) => reussie(l) && l.mission?.rang === "S",
  },
  {
    numero: 4,
    romain: "IV",
    palier: 20,
    nom: "Trois sur trois",
    phrase: "Réussis les trois missions d'une même journée.",
    faite: (l) => l.parfait === true,
  },
];

export type GenrePalierArbitre = "skin" | "signe" | "grade" | "vrai";

export interface PalierArbitre {
  n: number;
  nom: string;
  quoi: string;
  rang: Rang;
  genre: GenrePalierArbitre;
  habille?: { finition?: FinitionArbitre; signe?: Signe; grade?: GradeArbitre };
}

export const PASSE_ARBITRE: readonly PalierArbitre[] = [
  { n: 1, nom: "Liseré argent", quoi: "Un filet d'argent autour de ta photo.", rang: "B", genre: "signe", habille: { signe: "lisere-argent" } },
  { n: 2, nom: "Craie", quoi: "La tenue blanche, ses rayures à l'encre.", rang: "B", genre: "skin", habille: { finition: "craie" } },
  { n: 3, nom: "Sifflet", quoi: "Ton sifflet gravé dans le coin de ta photo.", rang: "B", genre: "signe", habille: { signe: "sifflet" } },
  { n: 4, nom: "Ardoise", quoi: "Le gris ardoise, la tenue des soirs de pluie.", rang: "B", genre: "skin", habille: { finition: "ardoise" } },
  { n: 5, nom: "Arbitre de ligue", quoi: "Ton grade dans l'étiquette : Ligue.", rang: "A", genre: "grade", habille: { grade: "ligue" } },
  { n: 6, nom: "Puce noire", quoi: "La puce de ta carte en noir laqué.", rang: "B", genre: "signe", habille: { signe: "puce-noire" } },
  { n: 7, nom: "Rayé", quoi: "Les larges rayures noires des tenues d'autrefois.", rang: "A", genre: "skin", habille: { finition: "raye" } },
  { n: 8, nom: "Cartons", quoi: "Tes deux cartons, gravés au bas de ta photo.", rang: "A", genre: "signe", habille: { signe: "cartons" } },
  { n: 9, nom: "Ton nom gravé", quoi: "Ton nom caché dans la gravure fine.", rang: "B", genre: "signe", habille: { signe: "nom-grave" } },
  { n: 10, nom: "Arbitre national", quoi: "Ton grade dans l'étiquette : National.", rang: "A", genre: "grade", habille: { grade: "national" } },
  { n: 11, nom: "Damier", quoi: "Le damier du drapeau de touche.", rang: "A", genre: "skin", habille: { finition: "damier" } },
  { n: 12, nom: "Liseré platine", quoi: "Un double filet de platine autour de ta photo.", rang: "A", genre: "signe", habille: { signe: "lisere-platine" } },
  { n: 13, nom: "Nuit de match", quoi: "Le noir du stade, les faisceaux des projecteurs.", rang: "A", genre: "skin", habille: { finition: "nuit-de-match" } },
  { n: 14, nom: "Chrono", quoi: "Le cadran du chronomètre, ses cercles fins.", rang: "S", genre: "skin", habille: { finition: "chrono" } },
  { n: 15, nom: "Arbitre élite", quoi: "Ton grade dans l'étiquette : Élite.", rang: "S", genre: "grade", habille: { grade: "elite" } },
  { n: 16, nom: "Argent", quoi: "L'argent guilloché, comme un insigne.", rang: "S", genre: "skin", habille: { finition: "argent" } },
  { n: 17, nom: "Platine", quoi: "Le platine soleillé d'un cadran de montre.", rang: "S", genre: "skin", habille: { finition: "platine" } },
  { n: 18, nom: "International", quoi: "Le plus haut grade : International.", rang: "S", genre: "grade", habille: { grade: "international" } },
  { n: 19, nom: "Filets", quoi: "Le filet du but, tendu sur le noir.", rang: "S", genre: "skin", habille: { finition: "filets" } },
  { n: 20, nom: "Ta carte en vrai", quoi: "Ta carte d'arbitre de la saison, imprimée.", rang: "S", genre: "vrai" },
];

/** Ce que les paliers atteints ont débloqué. */
export function debloquesArbitre(palier: number): { finitions: FinitionArbitre[]; signes: Signe[]; grades: GradeArbitre[] } {
  const ouverts = PASSE_ARBITRE.filter((p) => p.n <= palier);
  return {
    finitions: ouverts.flatMap((p) => (p.habille?.finition ? [p.habille.finition] : [])),
    signes: ouverts.flatMap((p) => (p.habille?.signe ? [p.habille.signe] : [])),
    grades: ouverts.flatMap((p) => (p.habille?.grade ? [p.habille.grade] : [])),
  };
}

/* ─────────────────────────────── Le choix ─────────────────────────────── */
// profiles.habillage_arbitre : « finition/signes/grade », « - » pour rien,
// les signes joints par « + » : « craie/sifflet+lisere-argent/ligue ».

export interface ChoixArbitre {
  finition: FinitionArbitre | null;
  signes: Signe[];
  grade: GradeArbitre | null;
}

export const CHOIX_VIDE: ChoixArbitre = { finition: null, signes: [], grade: null };

const FINITIONS = new Set<string>(PASSE_ARBITRE.flatMap((p) => (p.habille?.finition ? [p.habille.finition] : [])));
const SIGNES = new Set<string>(PASSE_ARBITRE.flatMap((p) => (p.habille?.signe ? [p.habille.signe] : [])));
const GRADES = new Set<string>(PASSE_ARBITRE.flatMap((p) => (p.habille?.grade ? [p.habille.grade] : [])));

export function lireChoixArbitre(brut: string | null | undefined): ChoixArbitre {
  const [f, s, g] = (brut ?? "").split("/");
  return {
    finition: f && FINITIONS.has(f) ? (f as FinitionArbitre) : null,
    signes: (s ?? "").split("+").filter((x): x is Signe => SIGNES.has(x)),
    grade: g && GRADES.has(g) ? (g as GradeArbitre) : null,
  };
}

export function ecrireChoixArbitre(c: ChoixArbitre): string {
  return [c.finition ?? "-", c.signes.length ? c.signes.join("+") : "-", c.grade ?? "-"].join("/");
}

/** Ce qu'il porte vraiment : son choix, sans ce qu'il n'a pas (ou plus) gagné. */
export function porteArbitre(c: ChoixArbitre, palier: number | null): ChoixArbitre {
  // Vu par la ligue (palier inconnu), le choix enregistré suffit : on n'a pu choisir que ce qu'on a.
  if (palier == null) return c;
  const d = debloquesArbitre(palier);
  return {
    finition: c.finition && d.finitions.includes(c.finition) ? c.finition : null,
    signes: c.signes.filter((s) => d.signes.includes(s)),
    grade: c.grade && d.grades.includes(c.grade) ? c.grade : null,
  };
}
