// La carte d'entraîneur de Bola Team (Ilyes, 02/11/2026 : « une équipe = 7
// joueurs + 1 entraîneur », une nouvelle carte Entraîneur, direction
// « Tableau »). Sabri : « une nouvelle carte du type entraîneur […] Ça peut
// être un autre design que les cartes de base. Mais tu gardes la même carte.
// Juste les couleurs et tout ça, ça peut être un peu différent. »
//
// La carte reste BolaCard (bola-card.tsx, édition « entraineur ») : même
// gabarit, même mise en page. Sa note et ses trois caractéristiques
// (lib/sfl/entraineur.ts) prennent la place de la note et des stats d'un
// joueur ; l'écusson de son équipe prend la place du numéro de maillot
// (ecusson-entraineur.tsx). C'est le signe qui dit « entraîneur » en petit :
// dans la pastille de 48 px, l'écusson seul, en haut à droite, là où une
// pastille de joueur n'a rien. Pas de bord en tirets (dans l'app, des tirets
// autour d'une pastille disent « invité » ou « place vide »), pas de bord
// plein (« toi »).
//
// Le Tableau, la causerie : le tableau du vestiaire à la mi-temps, vert
// d'école et non gris d'ardoise ; la craie en couches (le grain, les passes
// d'effacement, les schémas d'avant, la poussière au pied), le rond central
// autour de la note ; l'écusson et l'étiquette ENTRAÎNEUR cernés à la craie ;
// au dos, la lune et BOLA à la craie dans le rond central. Il apprend. Les
// deux autres directions de l'étude (les Aimants, le Manteau) ne partent pas
// en ligne : elles restent dans l'historique (efb7fbd, 1476fcd).
// Le dos est de la même famille que la face (Sabri, 23/10 : « vraiment une
// carte full color ») : le Tableau y dessine lui-même la lune et le
// logotype, à la craie (Matiere.dos.logo = false).
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
// l'importe (pas de cycle). Le motif est dans motifs-entraineur.tsx.

import type { Matiere } from "@/components/sfl/finitions-carte";
import type { TraitEcusson } from "@/components/sfl/ecusson-entraineur";

/**
 * Les éditions de la carte d'entraîneur : le Tableau seul pour l'instant ;
 * le type reste pour les suivantes (la carte « Champion », par exemple).
 */
export type FinitionEntraineur = "tableau";

/** Le motif de la carte d'entraîneur (motifs-entraineur.tsx le dessine). */
export type MotifEntraineur = { type: "tableau-craie"; craie: string };

const TYPES_MOTIF_ENTRAINEUR = new Set<string>(["tableau-craie"]);

export function estMotifEntraineur(m: { type: string }): m is MotifEntraineur {
  return TYPES_MOTIF_ENTRAINEUR.has(m.type);
}

/** Ce que la carte d'entraîneur dessine dans le trait de sa matière (bola-card.tsx). */
export interface TraitEntraineur {
  /** L'écusson de son équipe, à la craie. */
  ecusson: TraitEcusson;
  /** L'étiquette ENTRAÎNEUR, cernée à la craie : jamais pleine, comme celle de l'arbitre. */
  etiquette: "craie";
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
    entraineur: { ecusson: "craie", etiquette: "craie" },
  };
}

/* ------------------------------- La matière ------------------------------- */

/** La carte d'entraîneur : le Tableau (« entraineur » est son nom de matière, que lisent le dos et la 3D). */
export const MATIERE_ENTRAINEUR: Matiere = tableau({ nom: "entraineur", ardoise: ["#2d3f36", "#22332c", "#141f1a"], craie: "#eceee6", cadre: "#9aa0a3" });

/** La matière de chaque édition. */
export const MATIERES_ENTRAINEUR: Record<FinitionEntraineur, Matiere> = { tableau: MATIERE_ENTRAINEUR };
