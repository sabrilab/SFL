// La boutique Bola : huit pièces Tapstitch, marquées aux fichiers officiels
// (logo sans ®, symbole, sigle SFL, lunes, dos de carte), noir et blanc,
// une encre par pièce (Sabri, 30/10 : « design-les avec Bola […] dans les
// zones qui sont autorisées »).
//
// Les vêtements nus, leurs coloris, tailles, zones et tarifs ont été lus sur
// les fiches tapstitch.com le 30/10/2026 (code produit dans `tapstitch`).
// Les visuels « à plat » sont les photos Tapstitch avec le marquage posé par
// code, dans les zones devant (30 × 40 cm) et dos (32 × 45 cm), rien sur le
// col, les coutures, le zip ni les manches. Les photos « portées » sont
// générées (deux mannequins fixes, Magnific) à partir de ces visuels à plat.
// Prix proposés, en euros : rien n'est encore payable.

export type Ligne = "Match" | "Vestiaire" | "Fondateurs";

export interface Coloris {
  nom: "Noir" | "Blanc";
  /** La pastille. */
  teinte: string;
  /** Les visuels à plat, devant puis dos (public/boutique). */
  aPlat: string[];
}

export interface Produit {
  id: string;
  nom: string;
  ligne: Ligne;
  euros: number;
  /** Les photos portées, la première fait la vignette. */
  porte: string[];
  coloris: Coloris[];
  tailles: string[];
  matiere: string;
  marquage: string[];
  tapstitch: string;
}

const NOIR = "#16171a";
const BLANC = "#f4f4f2";
const plat = (code: string, c: "black" | "white", vues = ["front", "back"]) =>
  vues.map((v) => `/boutique/a-plat-${code}-${c}-${v}.webp`);

export const PRODUITS: Produit[] = [
  {
    id: "maillot-noirs-blancs",
    nom: "Maillot Noirs / Blancs",
    ligne: "Match",
    euros: 35,
    porte: ["/boutique/porte-maillot-noir.webp", "/boutique/porte-maillot-blanc-dos.webp"],
    coloris: [
      { nom: "Noir", teinte: NOIR, aPlat: plat("rt0082", "black") },
      { nom: "Blanc", teinte: BLANC, aPlat: plat("rt0082", "white") },
    ],
    tailles: ["M", "L", "XL", "2XL"],
    matiere: "Polyester 190 g, rayé ton sur ton",
    marquage: ["Logo Bola au cœur, sigle SFL en face", "Nom et numéro au dos"],
    tapstitch: "RT0082",
  },
  {
    id: "maillot-dimanche",
    nom: "Maillot « Dimanche »",
    ligne: "Match",
    euros: 35,
    porte: ["/boutique/porte-dimanche-noir.webp"],
    coloris: [
      { nom: "Noir", teinte: NOIR, aPlat: plat("ut0104", "black") },
      { nom: "Blanc", teinte: BLANC, aPlat: plat("ut0104", "white") },
    ],
    tailles: ["S", "M", "L", "XL", "2XL"],
    matiere: "Polyester 140 g, coupe ample",
    marquage: ["Logo Bola en grand", "« reviens au ballon. » sous la nuque"],
    tapstitch: "UT0104",
  },
  {
    id: "maillot-phases",
    nom: "Maillot « Phases »",
    ligne: "Match",
    euros: 35,
    porte: ["/boutique/porte-phases-dos.webp"],
    coloris: [{ nom: "Noir", teinte: NOIR, aPlat: plat("rt0057", "black") }],
    tailles: ["S", "M", "L", "XL"],
    matiere: "Coton 260 g, empiècement filet",
    marquage: ["Symbole au cœur", "Les six phases du ballon au dos"],
    tapstitch: "RT0057",
  },
  {
    id: "t-shirt-dos-de-carte",
    nom: "T-shirt « Dos de carte »",
    ligne: "Vestiaire",
    euros: 39,
    porte: ["/boutique/porte-dos-de-carte.webp"],
    coloris: [
      { nom: "Blanc", teinte: BLANC, aPlat: plat("rt0047", "white") },
      { nom: "Noir", teinte: NOIR, aPlat: plat("rt0047", "black") },
    ],
    tailles: ["S", "M", "L", "XL", "2XL", "3XL"],
    matiere: "Coton 240 g",
    marquage: ["Symbole au cœur", "Le dos de ta carte Bola, en grand"],
    tapstitch: "RT0047",
  },
  {
    id: "raglan-le-ballon-parle",
    nom: "Raglan « Le ballon parle »",
    ligne: "Vestiaire",
    euros: 35,
    porte: ["/boutique/porte-raglan-blanc.webp"],
    coloris: [
      { nom: "Blanc", teinte: BLANC, aPlat: plat("rt0091", "white") },
      { nom: "Noir", teinte: NOIR, aPlat: plat("rt0091", "black") },
    ],
    tailles: ["S", "M", "L", "XL", "2XL", "3XL"],
    matiere: "Coton 240 g, passepoil contrasté",
    marquage: ["« Reviens au ballon. » devant", "« Viens seul. Repars à dix. » au dos"],
    tapstitch: "RT0091",
  },
  {
    id: "polo-club",
    nom: "Polo « Club »",
    ligne: "Vestiaire",
    euros: 45,
    porte: ["/boutique/porte-polo-blanc.webp"],
    coloris: [
      { nom: "Blanc", teinte: BLANC, aPlat: plat("pl0004", "white") },
      { nom: "Noir", teinte: NOIR, aPlat: plat("pl0004", "black") },
    ],
    tailles: ["S", "M", "L", "XL", "2XL", "3XL"],
    matiere: "Coton et polyester 240 g, col contrasté",
    marquage: ["Logo Bola au cœur"],
    tapstitch: "PL0004",
  },
  {
    id: "survet-olympe",
    nom: "Survêt « Olympe »",
    ligne: "Vestiaire",
    euros: 99,
    porte: ["/boutique/porte-survet.webp", "/boutique/porte-survet-dos.webp"],
    coloris: [
      {
        nom: "Noir",
        teinte: NOIR,
        aPlat: [...plat("rq0019", "black"), "/boutique/a-plat-ub0003-black-front.webp"],
      },
    ],
    tailles: ["S", "M", "L", "XL"],
    matiere: "Veste et pantalon, coton et polyester 380 et 280 g",
    marquage: ["Logo Bola au cœur", "Le symbole en grand au dos", "Symbole sur la cuisse"],
    tapstitch: "RQ0019 + UB0003",
  },
  {
    id: "sweat-fondateurs",
    nom: "Sweat Fondateurs",
    ligne: "Fondateurs",
    euros: 65,
    porte: ["/boutique/porte-sweat-noir.webp"],
    coloris: [
      { nom: "Noir", teinte: NOIR, aPlat: plat("rw0007", "black") },
      { nom: "Blanc", teinte: BLANC, aPlat: plat("rw0007", "white") },
    ],
    tailles: ["S", "M", "L", "XL", "2XL", "3XL"],
    matiere: "Coton et polyester 380 g, oversize",
    marquage: ["Logo Bola devant", "Ta souche de fondateur au dos, n° x / 500"],
    tapstitch: "RW0007",
  },
];

export const LIGNES: Ligne[] = ["Match", "Vestiaire", "Fondateurs"];
