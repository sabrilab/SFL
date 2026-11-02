// La carte d'entraîneur de Bola Team (étude du 02/11/2026, branche
// coach-etude, jamais en ligne ; troisième version, après les planches :
// Ilyes, « travaille encore la DA pour les entraîneurs »).
// Sabri : « une nouvelle carte du type entraîneur […] Ça peut être un autre
// design que les cartes de base. Mais tu gardes la même carte. Juste les
// couleurs et tout ça, ça peut être un peu différent. »
//
// La carte reste BolaCard (bola-card.tsx, édition « entraineur ») : même
// gabarit, même mise en page. Sa note et ses trois caractéristiques
// (lib/sfl/entraineur.ts) prennent la place de la note et des stats d'un
// joueur ; l'écusson de son équipe prend la place du numéro de maillot
// (ecusson-entraineur.tsx) : c'est le signe commun aux trois directions,
// celui qui dit « entraîneur » en petit. Chaque direction est un objet du
// métier, avec sa matière, son trait (l'écusson, l'étiquette, le bord) et
// son dos :
//   · tableau (la causerie) : le tableau du vestiaire à la mi-temps, vert
//     d'école et non gris d'ardoise ; la craie en couches (le grain, les
//     schémas mal effacés d'avant, les passes de brosse, la poussière au
//     pied), le rond central autour de la note, le cadre de la zone
//     technique en tirets de craie ; au dos, la lune et BOLA à la craie dans
//     le rond central. Il apprend ;
//   · banc (le bord du terrain) : la doudoune longue des soirs de match,
//     pétrole presque noir ; les boudins matelassés en relief, le satiné du
//     nylon, les coutures piquées, l'écusson brodé ; au dos, les mêmes
//     boudins et la lune brodée. Il est là, par tous les temps ;
//   · carnet (la mémoire) : le carnet relié de cuir noir où il note les
//     compositions, les absents et ses causeries ; le grain du cuir, la
//     piqûre de la couverture, l'élastique ivoire qui le ferme, l'écusson
//     doré à chaud en ivoire, la tranche des pages en 3D ; au dos, la
//     lune gaufrée et l'élastique. Il retient tout.
// Le dos est de la même matière que la face (Sabri, 23/10 : « vraiment une
// carte full color ») : chaque direction y dessine elle-même la lune et le
// logotype, dans son trait (Matiere.dos.logo = false).
//
// Couleurs : ni or, ni bleu, ni rouge (les cartes MVP, Défensive, Impact),
// ni la braise, ni le mauve du rang A, le néon ou l'aurore, ni ce qui est à
// l'arbitre (les fluos, la craie blanche et l'ardoise grise de ses tenues,
// leurs rayures, le damier, le chrono, le sifflet), ni bronze ni cuivre (des
// rangs). L'étiquette dit ENTRAÎNEUR : « coach » est le mot de Bola Agent.
// Rien de Football Manager.
//
// Ce fichier n'importe que des types de finitions-carte.ts : c'est elle qui
// l'importe (pas de cycle). Les motifs sont dans motifs-entraineur.tsx.

import type { Matiere } from "@/components/sfl/finitions-carte";
import type { TraitEcusson } from "@/components/sfl/ecusson-entraineur";

export type FinitionEntraineur = "tableau" | "banc" | "carnet";

/** Les motifs de la carte d'entraîneur (motifs-entraineur.tsx les dessine). */
export type MotifEntraineur =
  | { type: "tableau-craie"; craie: string }
  | { type: "banc-matelasse"; lumiere: string; fil: string }
  | { type: "carnet-cuir"; sangle: string; ombre: string };

const TYPES_MOTIF_ENTRAINEUR = new Set<string>(["tableau-craie", "banc-matelasse", "carnet-cuir"]);

export function estMotifEntraineur(m: { type: string }): m is MotifEntraineur {
  return TYPES_MOTIF_ENTRAINEUR.has(m.type);
}

/** Ce que la carte d'entraîneur dessine dans le trait de sa matière (bola-card.tsx). */
export interface TraitEntraineur {
  /** L'écusson de son équipe : à la craie, brodé, ou doré à chaud. */
  ecusson: TraitEcusson;
  /** L'étiquette ENTRAÎNEUR : en tirets de craie, piquée comme une étiquette cousue, ou gaufrée. Jamais pleine, comme celle de l'arbitre. */
  etiquette: "craie" | "piqure" | "gaufre";
  /** Le bord de la pastille : en tirets de craie, ou piqué ; null, rien. */
  bord: "craie" | "piqure" | null;
  /** L'élastique du carnet, en travers de la pastille (sur la carte, le motif le dessine). */
  sangle?: { couleur: string; ombre: string };
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
 * elles se lisaient comme une trame). Le portrait vide laisse voir le tableau
 * (fond à demi transparent) : le schéma de la mi-temps s'y lit ; le rond
 * central entoure la note, photo ou pas ; le cadre de la zone technique, en
 * tirets de craie, fait le tour de la carte.
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
      "radial-gradient(70% 30% at 28% 76%, rgba(236,240,232,0.075) 0%, rgba(236,240,232,0) 70%)",
      "radial-gradient(55% 26% at 80% 18%, rgba(236,240,232,0.06) 0%, rgba(236,240,232,0) 70%)",
      "radial-gradient(40% 22% at 70% 52%, rgba(236,240,232,0.035) 0%, rgba(236,240,232,0) 70%)",
      // La poussière de craie qui tombe au pied du tableau.
      "linear-gradient(0deg, rgba(236,240,232,0.11) 0%, rgba(236,240,232,0) 10%)",
      `linear-gradient(162deg, ${haut} 0%, ${milieu} 52%, ${bas} 100%)`,
    ].join(", "),
    motif: { type: "tableau-craie", craie: `rgba(${craie},0.92)`, clair: `rgba(${craie},0.42)`, fonce: "rgba(0,0,0,0.3)" },
    fond: `rgba(${rvb(milieu)},0.42)`,
    lueur: `rgba(${craie},0.05)`,
    rayures: 0,
    micro: 0.015,
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
    entraineur: { ecusson: "craie", etiquette: "craie", bord: "craie", filigrane: false },
  };
}

/* --------------------------------- Banc ---------------------------------- */

export interface ReglagesBanc {
  nom: Matiere["nom"];
  /** Le nylon, de la lumière à l'ombre. */
  tissu: [string, string, string];
  /** Le reflet du satiné, sur le haut de chaque boudin. */
  lumiere: string;
  /** Le fil des coutures et de la broderie (hors or, bleu, rouge, mauve). */
  fil: string;
}

/**
 * La doudoune de banc : le nylon satiné, presque noir, des boudins
 * matelassés en relief (la lumière en haut de chacun, l'ombre dans la
 * couture), les coutures piquées au fil ivoire, l'écusson brodé ; sans
 * photo, l'écusson en grand sur la poitrine. Pétrole : loin du mauve du
 * rang A, du néon, de l'aurore, du vert du tableau et du kanga, et du bleu
 * de la Défensive.
 */
export function banc(r: ReglagesBanc): Matiere {
  const [lumiere, milieu, ombre] = r.tissu;
  const fil = rvb(r.fil);
  return {
    nom: r.nom,
    titre: TITRE_ENTRAINEUR,
    encre: fil,
    sombre: true,
    papier: [
      // Le satiné du nylon : une large lumière en biais, et sa réplique plus loin.
      "linear-gradient(118deg, rgba(255,255,255,0) 18%, rgba(190,236,232,0.09) 33%, rgba(255,255,255,0) 48%)",
      "linear-gradient(118deg, rgba(255,255,255,0) 58%, rgba(190,236,232,0.04) 68%, rgba(255,255,255,0) 78%)",
      `linear-gradient(170deg, ${lumiere} 0%, ${milieu} 50%, ${ombre} 100%)`,
    ].join(", "),
    motif: { type: "banc-matelasse", lumiere: r.lumiere, fil: `rgba(${fil},0.6)`, clair: "rgba(255,255,255,0.1)", fonce: "rgba(0,0,0,0.42)" },
    fond: `rgba(${rvb(milieu)},0.3)`,
    lueur: "rgba(255,255,255,0.05)",
    rayures: 0,
    micro: 0,
    reflet: 0.07,
    coins: 0.66,
    etiquette: { fond: "transparent", bord: `rgba(${fil},0.8)`, texte: r.fil },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(214,246,242,0.26)", ombre: "rgba(0,0,0,0.66)" },
    puce: `linear-gradient(135deg, #e6e7e9, ${milieu} 45%, #c9cbce 70%, ${ombre})`,
    cadre: `linear-gradient(165deg, ${lumiere} 0%, ${milieu} 50%, ${ombre} 100%)`,
    voile: `rgba(${rvb(ombre)},0.82)`,
    onglet: { fond: r.fil, encre: ombre },
    vive: r.fil,
    tranche: { couleur: milieu, metal: 0.12, rugosite: 0.55 },
    holo: { force: 0.2, teinte: [0.9, 1, 0.98] },
    dos: { logo: false, micro: 0 },
    entraineur: { ecusson: "fil", etiquette: "piqure", bord: "piqure", filigrane: true },
  };
}

/* -------------------------------- Carnet --------------------------------- */

export interface ReglagesCarnet {
  nom: Matiere["nom"];
  /** Le cuir de la couverture, de la lumière à l'ombre. */
  cuir: [string, string, string];
  /** L'élastique qui ferme le carnet, et l'encre de la dorure à chaud. */
  ivoire: string;
  /** La tranche des pages (la 3D). */
  pages: string;
}

/**
 * Le carnet relié : cuir noir grainé, une piqûre le long de la couverture,
 * l'élastique ivoire en travers (entre le portrait et la bande), l'écusson
 * et l'étiquette dorés à chaud en ivoire ; en 3D, la tranche est celle des
 * pages. Sans photo, l'écusson en grand, au milieu de la couverture.
 */
export function carnet(r: ReglagesCarnet): Matiere {
  const [lumiere, milieu, ombre] = r.cuir;
  const ivoire = rvb(r.ivoire);
  return {
    nom: r.nom,
    titre: TITRE_ENTRAINEUR,
    encre: ivoire,
    sombre: true,
    papier: [
      // L'usure : les coins et les bords frottés, un peu plus clairs, comme un carnet qu'on sort à chaque match.
      "radial-gradient(18% 11% at 0% 0%, rgba(255,246,232,0.09) 0%, rgba(255,246,232,0) 100%)",
      "radial-gradient(18% 11% at 100% 0%, rgba(255,246,232,0.07) 0%, rgba(255,246,232,0) 100%)",
      "radial-gradient(18% 11% at 0% 100%, rgba(255,246,232,0.08) 0%, rgba(255,246,232,0) 100%)",
      "radial-gradient(18% 11% at 100% 100%, rgba(255,246,232,0.1) 0%, rgba(255,246,232,0) 100%)",
      // Le cuir prend la lumière en haut à gauche, doucement.
      "radial-gradient(85% 55% at 26% 18%, rgba(255,250,240,0.075) 0%, rgba(255,250,240,0) 70%)",
      "linear-gradient(124deg, rgba(255,255,255,0) 30%, rgba(255,250,240,0.035) 44%, rgba(255,255,255,0) 58%)",
      `linear-gradient(160deg, ${lumiere} 0%, ${milieu} 52%, ${ombre} 100%)`,
    ].join(", "),
    motif: { type: "carnet-cuir", sangle: r.ivoire, ombre: "rgba(0,0,0,0.6)", clair: "rgba(255,248,236,0.05)", fonce: "rgba(0,0,0,0.38)" },
    fond: `rgba(${rvb(milieu)},0.35)`,
    lueur: "rgba(255,250,240,0.04)",
    rayures: 0,
    micro: 0,
    reflet: 0.05,
    coins: 0.5,
    etiquette: { fond: "transparent", bord: `rgba(${ivoire},0.5)`, texte: `rgba(${ivoire},0.95)` },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,250,240,0.18)", ombre: "rgba(0,0,0,0.7)" },
    puce: `linear-gradient(135deg, #ecebe7, #a9a7a1 45%, #dedcd6 70%, #6f6d68)`,
    cadre: `linear-gradient(160deg, ${lumiere} 0%, ${milieu} 50%, ${ombre} 100%)`,
    voile: `rgba(${rvb(ombre)},0.84)`,
    onglet: { fond: r.ivoire, encre: ombre },
    vive: r.ivoire,
    tranche: { couleur: r.pages, metal: 0, rugosite: 0.95 },
    holo: { force: 0.1, teinte: [1, 0.99, 0.96] },
    dos: { logo: false, micro: 0 },
    entraineur: { ecusson: "dorure", etiquette: "gaufre", bord: null, sangle: { couleur: r.ivoire, ombre: "rgba(0,0,0,0.55)" }, filigrane: true },
  };
}

/* ------------------------------ Les trois -------------------------------- */

export const MATIERES_ENTRAINEUR: Record<FinitionEntraineur, Matiere> = {
  tableau: tableau({ nom: "tableau", ardoise: ["#24342d", "#18251f", "#0e1713"], craie: "#eceee6", cadre: "#9aa0a3" }),
  banc: banc({ nom: "banc", tissu: ["#173a3e", "#0d2628", "#061416"], lumiere: "rgba(170,226,222,0.2)", fil: "#efe9df" }),
  carnet: carnet({ nom: "carnet", cuir: ["#272422", "#181614", "#0c0b0a"], ivoire: "#ece6d8", pages: "#e9e3d3" }),
};

/** La carte d'entraîneur sans réglage : la direction recommandée (à trancher par Sabri et Ilyes). */
export const MATIERE_ENTRAINEUR: Matiere = { ...MATIERES_ENTRAINEUR.tableau, nom: "entraineur" };
