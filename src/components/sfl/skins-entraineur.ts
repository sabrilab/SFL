// La carte d'entraîneur de Bola Team (étude du 02/11/2026, branche
// coach-etude, jamais en ligne ; troisième version revue après la relecture :
// Ilyes, « travaille encore la DA pour les entraîneurs »).
// Sabri : « une nouvelle carte du type entraîneur […] Ça peut être un autre
// design que les cartes de base. Mais tu gardes la même carte. Juste les
// couleurs et tout ça, ça peut être un peu différent. »
//
// La carte reste BolaCard (bola-card.tsx, édition « entraineur ») : même
// gabarit, même mise en page. Sa note et ses trois caractéristiques
// (lib/sfl/entraineur.ts) prennent la place de la note et des stats d'un
// joueur ; l'écusson de son équipe prend la place du numéro de maillot
// (ecusson-entraineur.tsx). C'est le signe commun aux trois directions, celui
// qui dit « entraîneur » en petit : dans la pastille de 48 px, l'écusson seul,
// en haut à droite, là où une pastille de joueur n'a rien. Pas de bord en
// tirets (dans l'app, des tirets autour d'une pastille disent « invité » ou
// « place vide »), pas de bord plein (« toi »).
//
// Trois directions, chacune un objet du métier, avec sa matière, son
// trait (l'écusson, l'étiquette) et son dos :
//   · tableau (la causerie) : le tableau du vestiaire à la mi-temps, vert
//     d'école et non gris d'ardoise ; la craie en couches (le grain, les
//     passes d'effacement, les schémas d'avant, la poussière au pied), le rond
//     central autour de la note ; au dos, la lune et BOLA à la craie dans le
//     rond central. Il apprend ;
//   · aimants (la zone technique) : le tableau magnétique qu'il tient au bord
//     du terrain, blanc mat, le terrain imprimé en vert, les aimants ronds de
//     ses joueurs, les traces du feutre effacé ; la note imprimée en vert ;
//     l'écusson est un aimant découpé ; au dos, le terrain entier et la lune
//     posée au point central, comme le ballon. Il prépare ;
//   · manteau (le bord de touche) : le manteau de laine des soirs de match,
//     drap pétrole, l'écusson brodé sur le cœur, l'étiquette tissée ; au dos,
//     la doublure de satin et la lune tissée sur l'étiquette du col. Il est
//     là.
// Le banc (la doudoune, l'habit des remplaçants, ses boudins en bandes) et le
// carnet (le cuir cousu, rien de football) sont retirés après la relecture.
// Le dos est de la même famille que la face (Sabri, 23/10 : « vraiment une
// carte full color ») : chaque direction y dessine elle-même la lune et le
// logotype, dans son trait (Matiere.dos.logo = false).
//
// Couleurs : ni or, ni bleu, ni rouge (les cartes MVP, Défensive, Impact),
// ni la braise, ni le mauve du rang A, le néon ou l'aurore, ni ce qui est à
// l'arbitre (les fluos, la craie blanche et l'ardoise grise de ses tenues,
// leurs rayures, le damier, le chrono, le sifflet), ni bronze ni cuivre (des
// rangs). L'étiquette dit ENTRAÎNEUR : « coach » est le mot de Bola Agent.
// Rien de Football Manager. Pas de trame d'écran (Matiere.trame = 0) : sur
// une matière, les lignes de scan du gabarit se lisaient comme un écran.
//
// Ce fichier n'importe que des types de finitions-carte.ts : c'est elle qui
// l'importe (pas de cycle). Les motifs sont dans motifs-entraineur.tsx.

import type { Matiere } from "@/components/sfl/finitions-carte";
import type { TraitEcusson } from "@/components/sfl/ecusson-entraineur";

export type FinitionEntraineur = "tableau" | "aimants" | "manteau";

/** Les motifs de la carte d'entraîneur (motifs-entraineur.tsx les dessine). */
export type MotifEntraineur =
  | { type: "tableau-craie"; craie: string }
  | { type: "aimants-terrain"; impression: string; feutre: string; aimant: string }
  | { type: "manteau-laine"; fil: string; doublure: [string, string, string] };

const TYPES_MOTIF_ENTRAINEUR = new Set<string>(["tableau-craie", "aimants-terrain", "manteau-laine"]);

export function estMotifEntraineur(m: { type: string }): m is MotifEntraineur {
  return TYPES_MOTIF_ENTRAINEUR.has(m.type);
}

/** Ce que la carte d'entraîneur dessine dans le trait de sa matière (bola-card.tsx). */
export interface TraitEntraineur {
  /** L'écusson de son équipe : à la craie, aimant découpé, ou brodé. */
  ecusson: TraitEcusson;
  /** L'étiquette ENTRAÎNEUR : cernée à la craie, imprimée, ou tissée. Jamais pleine, comme celle de l'arbitre. */
  etiquette: "craie" | "imprimee" | "tissee";
  /** Sans photo : l'écusson en grand dans le portrait ; sinon le portrait reste vide et le motif s'y lit. */
  filigrane: boolean;
}

export const TITRE_ENTRAINEUR = "ENTRAÎNEUR";

/** « #rrggbb » → « r,g,b », l'encre d'une matière. */
const rvb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(",");

/* -------------------------------- Tableau -------------------------------- */

export interface ReglagesTableau {
  nom: Matiere["nom"];
  /** Le tableau, du haut à gauche au bas à droite : un vert d'école, pas le gris d'une ardoise. */
  ardoise: [string, string, string];
  /** La craie. */
  craie: string;
  /** Le cadre du tableau : la tranche de la 3D, la puce. */
  cadre: string;
}

/**
 * Le tableau de la causerie : mat, vert d'école sombre, la craie pour encre.
 * Pas de rayures dans le portrait (le gabarit en met à 45° : sur un tableau,
 * elles se lisaient comme une trame), pas de trame d'écran. Le portrait vide
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
      // La craie mal effacée : des voiles plus clairs, là où la brosse est passée.
      "radial-gradient(60% 26% at 22% 78%, rgba(236,240,232,0.06) 0%, rgba(236,240,232,0) 70%)",
      "radial-gradient(55% 26% at 80% 18%, rgba(236,240,232,0.05) 0%, rgba(236,240,232,0) 70%)",
      // La poussière de craie qui tombe au pied du tableau.
      "linear-gradient(0deg, rgba(236,240,232,0.08) 0%, rgba(236,240,232,0) 6%)",
      `linear-gradient(162deg, ${haut} 0%, ${milieu} 52%, ${bas} 100%)`,
    ].join(", "),
    motif: { type: "tableau-craie", craie: `rgba(${craie},0.92)`, clair: `rgba(${craie},0.42)`, fonce: "rgba(0,0,0,0.3)" },
    fond: `rgba(${rvb(milieu)},0.42)`,
    lueur: `rgba(${craie},0.05)`,
    rayures: 0,
    micro: 0.015,
    trame: 0,
    reflet: 0.04,
    coins: 0.6,
    etiquette: { fond: "transparent", bord: `rgba(${craie},0.72)`, texte: `rgba(${craie},0.94)` },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,255,255,0.18)", ombre: "rgba(0,0,0,0.62)" },
    puce: `linear-gradient(135deg, #e7eaeb, ${r.cadre} 45%, #d3d7d8 70%, #6c7275)`,
    cadre: `linear-gradient(152deg, ${haut} 0%, ${milieu} 46%, ${bas} 100%)`,
    voile: `rgba(${rvb(bas)},0.84)`,
    onglet: { fond: r.craie, encre: bas },
    vive: r.craie,
    tranche: { couleur: r.cadre, metal: 0.75, rugosite: 0.38 },
    holo: { force: 0.12, teinte: [0.92, 0.98, 0.94] },
    dos: { logo: false, micro: 0 },
    entraineur: { ecusson: "craie", etiquette: "craie", filigrane: false },
  };
}

/* -------------------------------- Aimants -------------------------------- */

export interface ReglagesAimants {
  nom: Matiere["nom"];
  /** Le tableau blanc mat, de la lumière à l'ombre. */
  blanc: [string, string, string];
  /** Le terrain imprimé, et l'encre de la carte (la note, le nom) : le vert du terrain. */
  impression: string;
  encre: string;
  /** Les aimants de ses joueurs, et le feutre effaçable. */
  aimant: string;
  feutre: string;
}

/**
 * Le tableau magnétique de la zone technique : blanc mat (un stratifié, pas
 * du papier), le terrain imprimé en vert, net comme une impression ; les
 * aimants ronds de ses joueurs, avec leur ombre ; les traces grises du
 * feutre mal effacé. La note et le nom sont imprimés dans le vert du terrain
 * (un joueur de base est à l'encre noire). Le cadre et la tranche en
 * aluminium, comme le tableau.
 */
export function aimants(r: ReglagesAimants): Matiere {
  const [lumiere, milieu, ombre] = r.blanc;
  return {
    nom: r.nom,
    titre: TITRE_ENTRAINEUR,
    encre: rvb(r.encre),
    sombre: false,
    papier: [
      // Le reflet mat du stratifié, large et doux.
      "linear-gradient(122deg, rgba(255,255,255,0) 22%, rgba(255,255,255,0.55) 38%, rgba(255,255,255,0) 54%)",
      `linear-gradient(165deg, ${lumiere} 0%, ${milieu} 55%, ${ombre} 100%)`,
    ].join(", "),
    motif: { type: "aimants-terrain", impression: r.impression, feutre: r.feutre, aimant: r.aimant, clair: "rgba(255,255,255,0.9)", fonce: "rgba(20,30,24,0.22)" },
    fond: `rgba(${rvb(milieu)},0.5)`,
    lueur: "rgba(255,255,255,0.3)",
    rayures: 0,
    micro: 0,
    trame: 0,
    reflet: 0.3,
    coins: 0.5,
    // Imprimée sur une bande du tableau blanc : elle se lit aussi sur une photo sombre.
    etiquette: { fond: `rgba(${rvb(lumiere)},0.9)`, bord: r.impression, texte: r.encre },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.95)", ombre: "rgba(30,40,34,0.16)" },
    puce: "linear-gradient(135deg, #f1f2f0, #b8bcb9 45%, #e4e6e4 70%, #9da29f)",
    cadre: `linear-gradient(165deg, ${lumiere} 0%, ${milieu} 55%, ${ombre} 100%)`,
    voile: "rgba(14,30,22,0.5)",
    onglet: { fond: r.encre, encre: lumiere },
    vive: r.impression,
    tranche: { couleur: "#c9cdca", metal: 0.85, rugosite: 0.3 },
    holo: { force: 0.18, teinte: [0.96, 1, 0.97] },
    dos: { logo: false, micro: 0 },
    entraineur: { ecusson: "aimant", etiquette: "imprimee", filigrane: false },
  };
}

/* -------------------------------- Manteau -------------------------------- */

export interface ReglagesManteau {
  nom: Matiere["nom"];
  /** Le drap de laine, de la lumière à l'ombre. */
  drap: [string, string, string];
  /** Le fil de la broderie et de l'étiquette tissée. */
  fil: string;
  /** La doublure de satin (le dos), de la lumière à l'ombre. */
  doublure: [string, string, string];
}

/**
 * Le manteau des soirs de match : un drap de laine pétrole, dense et mat,
 * foulé (le grain du feutre, un sergé à peine visible), l'écusson brodé au
 * passé plat sur le cœur, l'étiquette ENTRAÎNEUR tissée et cousue aux deux
 * bouts. Au dos, l'intérieur : la doublure de satin et l'étiquette du col,
 * la lune et BOLA tissés. Pétrole : loin du vert du tableau et du kanga, du
 * bleu de la Défensive, du mauve du rang A.
 */
export function manteau(r: ReglagesManteau): Matiere {
  const [lumiere, milieu, ombre] = r.drap;
  const fil = rvb(r.fil);
  return {
    nom: r.nom,
    titre: TITRE_ENTRAINEUR,
    encre: fil,
    sombre: true,
    papier: [
      // La lumière douce sur la laine : pas de reflet, un modelé.
      "radial-gradient(90% 60% at 30% 20%, rgba(200,236,234,0.07) 0%, rgba(200,236,234,0) 70%)",
      `linear-gradient(168deg, ${lumiere} 0%, ${milieu} 50%, ${ombre} 100%)`,
    ].join(", "),
    motif: { type: "manteau-laine", fil: r.fil, doublure: r.doublure, clair: "rgba(214,244,240,0.07)", fonce: "rgba(0,0,0,0.3)" },
    fond: `rgba(${rvb(milieu)},0.35)`,
    lueur: "rgba(255,255,255,0.04)",
    rayures: 0,
    micro: 0,
    trame: 0,
    reflet: 0.02,
    coins: 0.55,
    etiquette: { fond: "transparent", bord: `rgba(${fil},0.5)`, texte: `rgba(${fil},0.96)` },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(214,246,242,0.16)", ombre: "rgba(0,0,0,0.66)" },
    puce: `linear-gradient(135deg, #e6e7e9, ${milieu} 45%, #c9cbce 70%, ${ombre})`,
    cadre: `linear-gradient(165deg, ${lumiere} 0%, ${milieu} 50%, ${ombre} 100%)`,
    voile: `rgba(${rvb(ombre)},0.82)`,
    onglet: { fond: r.fil, encre: ombre },
    vive: r.fil,
    tranche: { couleur: milieu, metal: 0.05, rugosite: 0.9 },
    holo: { force: 0.06, teinte: [0.9, 1, 0.98] },
    dos: {
      logo: false,
      micro: 0,
      papier: `linear-gradient(150deg, ${r.doublure[0]} 0%, ${r.doublure[1]} 50%, ${r.doublure[2]} 100%)`,
      reflet: 0.1,
    },
    entraineur: { ecusson: "fil", etiquette: "tissee", filigrane: true },
  };
}

/* ------------------------------ Les trois -------------------------------- */

export const MATIERES_ENTRAINEUR: Record<FinitionEntraineur, Matiere> = {
  tableau: tableau({ nom: "tableau", ardoise: ["#2d3f36", "#22332c", "#141f1a"], craie: "#eceee6", cadre: "#9aa0a3" }),
  aimants: aimants({ nom: "aimants", blanc: ["#f6f7f4", "#eceee9", "#e1e4df"], impression: "#2f7d52", encre: "#164a32", aimant: "#164a32", feutre: "#1d2421" }),
  manteau: manteau({ nom: "manteau", drap: ["#1a3c40", "#11292c", "#08181a"], fil: "#e9e6dc", doublure: ["#3b5b56", "#24403c", "#132623"] }),
};

/** La carte d'entraîneur sans réglage : la direction recommandée (à trancher par Sabri et Ilyes). */
export const MATIERE_ENTRAINEUR: Matiere = { ...MATIERES_ENTRAINEUR.tableau, nom: "entraineur" };
