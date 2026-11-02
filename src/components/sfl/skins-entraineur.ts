// La carte d'entraîneur de Bola Team (étude du 02/11/2026, branche
// coach-etude, jamais en ligne ; seconde version après la relecture DA).
// Sabri : « une nouvelle carte du type entraîneur […] Ça peut être un autre
// design que les cartes de base. Mais tu gardes la même carte. Juste les
// couleurs et tout ça, ça peut être un peu différent. »
//
// La carte reste BolaCard (bola-card.tsx, édition « entraineur ») : même
// gabarit, même mise en page. Sa note et ses six caractéristiques
// (lib/sfl/entraineur.ts) prennent la place de la note et des stats d'un
// joueur ; l'écusson de son équipe prend la place du numéro de maillot
// (ecusson-entraineur.tsx) : c'est lui, plus que la couleur, qui dit
// « entraîneur » en petit. Trois directions, chacune un objet du métier,
// construite par une fonction à réglages :
//   · tableau (recommandée) : le tableau de la causerie, vert-noir mat (pas
//     de rayures), l'encre de craie ; sans photo, le schéma de la mi-temps
//     dans le portrait ; avec ou sans, le rond central autour de la note et
//     les passes de brosse ; l'étiquette et l'écusson à la craie, en tirets ;
//     au dos, la lune posée au rond central. Il apprend ;
//   · carnet : la page à petits carreaux, l'encre noire, l'étiquette au
//     stylo ; sans spirale peinte, sans rayures ni microtexte. La plus
//     proche de la carte de saison et de l'arbitre « craie » : à écarter ;
//   · survetement : la maille satinée pétrole, un seul liseré crème qui
//     suit les coins, l'écusson brodé (en grand sur la poitrine quand il n'y
//     a pas de photo) ; plus de glissière au dos.
// Le dos est de la même matière que la face (Sabri, 23/10 : « vraiment une
// carte full color »).
//
// Couleurs : ni or, ni bleu, ni rouge (les cartes MVP, Défensive, Impact),
// ni la braise, ni le mauve du rang A, le néon ou l'aurore, ni ce qui est à
// l'arbitre (les fluos, l'ardoise grise et ses rayures de tenue, la craie
// « blanche » comme nom, le damier, le chrono, le sifflet), ni bronze ni
// cuivre (des rangs). L'étiquette dit ENTRAÎNEUR : « coach » est le mot de
// Bola Agent. Rien de Football Manager.
//
// Ce fichier n'importe que des types de finitions-carte.ts : c'est elle qui
// l'importe (pas de cycle). Les motifs sont dans motifs-entraineur.tsx.

import type { Matiere } from "@/components/sfl/finitions-carte";
import type { TraitEcusson } from "@/components/sfl/ecusson-entraineur";

export type FinitionEntraineur = "tableau" | "carnet" | "survetement";

/** Les motifs gravés de la carte d'entraîneur (motifs-entraineur.tsx les dessine). */
export type MotifEntraineur =
  | { type: "tableau-craie" }
  | { type: "carnet-carreaux"; grille: string }
  | { type: "survetement-maille"; lisere: string };

const TYPES_MOTIF_ENTRAINEUR = new Set<string>(["tableau-craie", "carnet-carreaux", "survetement-maille"]);

export function estMotifEntraineur(m: { type: string }): m is MotifEntraineur {
  return TYPES_MOTIF_ENTRAINEUR.has(m.type);
}

/** Ce que la carte d'entraîneur dessine dans le trait de sa matière (bola-card.tsx). */
export interface TraitEntraineur {
  /** L'écusson de son équipe : à la craie, à l'encre, ou brodé. */
  ecusson: TraitEcusson;
  /** L'étiquette et le bord de la pastille en tirets (la craie), sinon d'un trait plein. */
  tirets: boolean;
  /** Sans photo : l'écusson en grand dans le portrait, à la place de l'initiale ; sinon le portrait reste vide et le motif s'y lit. */
  filigrane: boolean;
}

export const TITRE_ENTRAINEUR = "ENTRAÎNEUR";

/** « #rrggbb » → « r,g,b », l'encre d'une matière. */
const rvb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");

/* -------------------------------- Tableau -------------------------------- */

export interface ReglagesTableau {
  nom: Matiere["nom"];
  /** Le tableau, du haut à gauche au bas à droite. */
  ardoise: [string, string, string];
  /** La craie. */
  craie: string;
  /** Le cadre du tableau : la tranche de la 3D, la puce. */
  cadre: string;
}

/**
 * Le tableau de la causerie : mat, presque noir, à peine vert, la craie
 * pour encre. Pas de rayures dans le portrait (le gabarit en met à 45° :
 * sur un tableau, elles se lisaient comme une trame). Le portrait vide
 * laisse voir le tableau (fond à demi transparent) : le schéma de la
 * mi-temps s'y lit ; le rond central entoure la note, photo ou pas.
 */
export function tableau(r: ReglagesTableau): Matiere {
  const [haut, milieu, bas] = r.ardoise;
  const craie = rvb(r.craie);
  return {
    nom: r.nom,
    titre: TITRE_ENTRAINEUR,
    encre: craie,
    sombre: true,
    papier: [
      // La craie mal effacée : un voile plus clair, là où la brosse est passée.
      "radial-gradient(70% 34% at 30% 74%, rgba(236,240,232,0.07) 0%, rgba(236,240,232,0) 70%)",
      "radial-gradient(60% 30% at 78% 22%, rgba(236,240,232,0.05) 0%, rgba(236,240,232,0) 70%)",
      `linear-gradient(162deg, ${haut} 0%, ${milieu} 52%, ${bas} 100%)`,
    ].join(", "),
    motif: { type: "tableau-craie", clair: `rgba(${craie},0.42)`, fonce: "rgba(0,0,0,0.28)" },
    fond: `rgba(${rvb(milieu)},0.42)`,
    lueur: `rgba(${craie},0.05)`,
    rayures: 0,
    micro: 0.03,
    reflet: 0.05,
    coins: 0.62,
    etiquette: { fond: "transparent", bord: `rgba(${craie},0.7)`, texte: `rgba(${craie},0.92)` },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,255,255,0.2)", ombre: "rgba(0,0,0,0.62)" },
    puce: `linear-gradient(135deg, #e7eaeb, ${r.cadre} 45%, #d3d7d8 70%, #6c7275)`,
    cadre: `linear-gradient(152deg, ${haut} 0%, ${milieu} 46%, ${bas} 100%)`,
    voile: `rgba(${rvb(bas)},0.84)`,
    onglet: { fond: r.craie, encre: bas },
    vive: r.craie,
    tranche: { couleur: r.cadre, metal: 0.75, rugosite: 0.38 },
    holo: { force: 0.14, teinte: [0.92, 0.98, 0.94] },
    entraineur: { ecusson: "craie", tirets: true, filigrane: false },
  };
}

/* -------------------------------- Carnet --------------------------------- */

export interface ReglagesCarnet {
  nom: Matiere["nom"];
  /** La page, du haut vers le bas. */
  page: [string, string, string];
  /** L'encre du stylo. */
  encre: string;
  /** Les petits carreaux (rgba). */
  grille: string;
}

/**
 * La page du carnet : petits carreaux de 5 mm (81 sur 1024, la carte fait
 * 63 mm), l'encre noire, la prédécoupe en haut. Une seule texture : ni
 * rayures, ni microtexte, ni spirale peinte (un trompe-l'œil que la 3D ne
 * suivait pas). L'étiquette au stylo, en contour : la pleine est à l'arbitre.
 */
export function carnet(r: ReglagesCarnet): Matiere {
  const [haut, milieu, bas] = r.page;
  const encre = rvb(r.encre);
  return {
    nom: r.nom,
    titre: TITRE_ENTRAINEUR,
    encre,
    sombre: false,
    papier: [
      "radial-gradient(90% 50% at 40% 26%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
      `linear-gradient(172deg, ${haut} 0%, ${milieu} 56%, ${bas} 100%)`,
    ].join(", "),
    motif: { type: "carnet-carreaux", grille: r.grille, clair: "rgba(255,255,255,0.75)", fonce: `rgba(${encre},0.5)` },
    fond: `rgba(${rvb(haut)},0.5)`,
    lueur: "rgba(255,255,255,0.4)",
    rayures: 0,
    micro: 0,
    reflet: 0.3,
    coins: 0.55,
    etiquette: { fond: "transparent", bord: `rgba(${encre},0.85)`, texte: `rgba(${encre},0.92)` },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.95)", ombre: "rgba(60,52,36,0.2)" },
    puce: "linear-gradient(135deg, #ffffff, #c5c7c9 45%, #f3f3f2 70%, #9a9da1)",
    cadre: `linear-gradient(172deg, ${haut} 0%, ${bas} 100%)`,
    voile: `rgba(${encre},0.6)`,
    onglet: { fond: r.encre, encre: haut },
    vive: r.encre,
    tranche: { couleur: bas, metal: 0, rugosite: 0.92 },
    holo: { force: 0.16, teinte: null },
    dos: { micro: 0 },
    entraineur: { ecusson: "encre", tirets: false, filigrane: true },
  };
}

/* ------------------------------ Survêtement ------------------------------ */

export interface ReglagesSurvetement {
  nom: Matiere["nom"];
  /** La maille, de la lumière à l'ombre. */
  tissu: [string, string, string];
  /** Le liseré (hors or, bleu, rouge, mauve). */
  lisere: string;
  /** L'encre : celle du liseré, ou plus claire. */
  encre: string;
}

/**
 * Le survêtement : la maille satinée (le reflet en biais du polyester), un
 * seul liseré qui fait le tour de la carte en suivant ses coins, l'écusson
 * brodé ; sans photo, l'écusson en grand sur la poitrine. Pétrole : loin du
 * mauve du rang A, du néon, de l'aurore, du vert du tableau et du kanga.
 */
export function survetement(r: ReglagesSurvetement): Matiere {
  const [lumiere, milieu, ombre] = r.tissu;
  const encre = rvb(r.encre);
  return {
    nom: r.nom,
    titre: TITRE_ENTRAINEUR,
    encre,
    sombre: true,
    papier: [
      // Le satiné : deux reflets en biais, comme la lumière sur une veste d'entraînement.
      "linear-gradient(112deg, rgba(255,255,255,0) 22%, rgba(255,255,255,0.07) 34%, rgba(255,255,255,0) 46%)",
      "linear-gradient(112deg, rgba(255,255,255,0) 56%, rgba(255,255,255,0.035) 66%, rgba(255,255,255,0) 76%)",
      `linear-gradient(165deg, ${lumiere} 0%, ${milieu} 48%, ${ombre} 100%)`,
    ].join(", "),
    motif: { type: "survetement-maille", lisere: r.lisere, clair: "rgba(255,255,255,0.07)", fonce: "rgba(0,0,0,0.3)" },
    fond: milieu,
    lueur: "rgba(255,255,255,0.08)",
    rayures: 0,
    micro: 0.03,
    // Le reflet de la carte, léger : le satiné du tissu est déjà dans le papier.
    reflet: 0.06,
    coins: 0.72,
    etiquette: { fond: "transparent", bord: r.lisere, texte: r.encre },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,255,255,0.28)", ombre: "rgba(0,0,0,0.6)" },
    puce: `linear-gradient(135deg, #e6e7e9, ${milieu} 45%, #c9cbce 70%, ${ombre})`,
    cadre: `linear-gradient(165deg, ${lumiere} 0%, ${milieu} 50%, ${ombre} 100%)`,
    voile: `rgba(${rvb(ombre)},0.82)`,
    onglet: { fond: r.lisere, encre: ombre },
    vive: r.lisere,
    tranche: { couleur: milieu, metal: 0.05, rugosite: 0.82 },
    holo: { force: 0.22, teinte: [0.95, 0.97, 0.97] },
    entraineur: { ecusson: "fil", tirets: false, filigrane: true },
  };
}

/* ------------------------------ Les trois -------------------------------- */

export const MATIERES_ENTRAINEUR: Record<FinitionEntraineur, Matiere> = {
  tableau: tableau({ nom: "tableau", ardoise: ["#2c3832", "#212b26", "#151b18"], craie: "#eceee6", cadre: "#9aa0a3" }),
  carnet: carnet({ nom: "carnet", page: ["#f8f9f6", "#f1f3ef", "#e6e9e3"], encre: "#17171b", grille: "rgba(70,84,80,0.3)" }),
  survetement: survetement({ nom: "survetement", tissu: ["#1f4247", "#163236", "#0d2124"], lisere: "#efe9df", encre: "#f4efe6" }),
};

/** La carte d'entraîneur sans réglage : la direction recommandée, le tableau (à trancher par Sabri). */
export const MATIERE_ENTRAINEUR: Matiere = { ...MATIERES_ENTRAINEUR.tableau, nom: "entraineur" };
