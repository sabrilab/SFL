// Les skins offerts à un joueur, hors de la passe (lib/sfl/finitions-offertes.ts
// dit à qui). Les deux premiers, à la carte d'Ilyes, Pépite d'Or de la
// saison 0 (Sabri, 24/10 : « on va lui faire un skin propre à lui, qu'il
// pourra choisir, bien sûr, dans ses différentes possibilités de skin ») :
//   · pépite, « full or » : « même la texture de la carte est tout full or
//     […] garde juste la photo intacte […] pour les chiffres et tout, on veut
//     de l'or : des gravures d'or sur de l'or ». L'or massif poli, gravé en
//     clous de Paris (le quadrillage de petites pyramides des boîtiers de
//     montre), l'encre d'or claire et tout le texte gravé en creux dans le
//     métal (gravure) ; le symbole, la puce, le liseré et la tranche en or.
//     L'or reste aux cartes MVP (Sabri, 24/10) : celle-ci est l'exception
//     qu'il a demandée, pour la Pépite d'Or ;
//   · palestine : « derrière la carte, on a un drapeau de la Palestine. Tu
//     fais trois bandes de couleur qui traversent le dos de la carte ». Au
//     dos, le drapeau tel qu'on le hisse à la verticale (la bande noire à
//     gauche, le triangle rouge en haut, sa pointe sur la lune), cousu bande
//     à bande, la lune et le logotype Bola à l'encre sur la bande blanche.
//     La face reste la carte de saison, les bandes le long des deux bords en
//     gris d'encre, comme « Tes couleurs » : le rouge reste aux cartes
//     Impact, les couleurs sont au dos.
//
// Ce fichier n'importe que des types de finitions-carte.ts : c'est elle qui
// l'importe (pas de cycle). Les motifs sont dans motifs-offerts.tsx.

import type { Matiere } from "@/components/sfl/finitions-carte";
import { enEncre } from "@/components/sfl/skins-passe";

export type FinitionOfferte = "pepite" | "palestine";

/** Les motifs gravés des skins offerts (motifs-offerts.tsx les dessine). */
export type MotifOffert = { type: "clous" } | { type: "palestine"; bandes: string[]; triangle: string; encre: string[] };

const TYPES_MOTIF_OFFERT = new Set<string>(["clous", "palestine"]);

export function estMotifOffert(m: { type: string }): m is MotifOffert {
  return TYPES_MOTIF_OFFERT.has(m.type);
}

/** Le drapeau de la Palestine : ses trois bandes (de haut en bas, à plat), son triangle. */
export const DRAPEAU_PALESTINE = { bandes: ["#0b0b0c", "#ffffff", "#007a3d"], triangle: "#ce1126" } as const;

const BLANC = "rgba(255,255,255,0.95)";

/** Le serti de la carte photo : les bandes le long des deux côtés, en gris d'encre, le blanc entre. */
function sertiBandes(bandes: string[]): string {
  const l = 4.6 / bandes.length;
  const pas = (i: number) => `${(i * l).toFixed(2)}%`;
  const gauche = bandes.map((c, i) => `${c} ${pas(i)} ${pas(i + 1)}`);
  const droite = [...bandes].reverse().map((c, i) => `${c} calc(100% - ${pas(bandes.length - i)}) calc(100% - ${pas(bandes.length - i - 1)})`);
  return `linear-gradient(90deg, ${gauche.join(", ")}, #f4f4f1 ${pas(bandes.length)} calc(100% - ${pas(bandes.length)}), ${droite.join(", ")})`;
}

const encrePalestine = DRAPEAU_PALESTINE.bandes.map(enEncre);

export const MATIERES_OFFERTES: Record<FinitionOfferte, Matiere> = {
  // Pépite : l'or massif, plus profond que la feuille d'or du MVP (la
  // lumière en haut, le métal qui fonce vers le bas, là où sont les
  // chiffres), un poli en biais, les clous de Paris gravés dedans.
  pepite: {
    nom: "pepite",
    titre: "pépite d'or",
    encre: "255,231,156",
    sombre: true,
    papier: [
      "linear-gradient(118deg, rgba(255,250,222,0) 30%, rgba(255,250,222,0.32) 42%, rgba(255,250,222,0.04) 47%, rgba(255,250,222,0.2) 52%, rgba(255,250,222,0) 62%)",
      "radial-gradient(90% 50% at 50% 26%, rgba(255,236,170,0.5) 0%, rgba(255,236,170,0) 72%)",
      "linear-gradient(180deg, rgba(64,36,0,0) 44%, rgba(64,36,0,0.38) 64%, rgba(64,36,0,0.62) 100%)",
      "linear-gradient(156deg, #f4d47e 0%, #d9a840 18%, #b07a1c 36%, #e2b553 52%, #9c6814 70%, #c8922e 86%, #7a4f0c 100%)",
    ].join(", "),
    motif: { type: "clous", clair: "rgba(255,238,184,0.26)", fonce: "rgba(84,50,4,0.3)" },
    fond: "#b8852a",
    lueur: "rgba(255,232,160,0.5)",
    rayures: 0.06,
    micro: 0.09,
    reflet: 0.3,
    coins: 0.85,
    etiquette: { fond: "rgba(72,42,4,0.42)", bord: "rgba(255,231,156,0.8)", texte: "#ffe79c" },
    symbole: "/bola/symbole-or.svg",
    rebord: { lumiere: "rgba(255,240,196,0.9)", ombre: "rgba(70,40,2,0.55)" },
    puce: "linear-gradient(135deg, #fff1c0, #c48d28 45%, #f6d98a 70%, #8a5a10)",
    cadre: "linear-gradient(156deg, #f4d47e 0%, #d9a840 22%, #9c6814 50%, #e8bf62 76%, #7a4f0c 100%)",
    voile: "rgba(58,34,2,0.82)",
    onglet: { fond: "#3a2404", encre: "#f6d47a" },
    vive: "#e2b24a",
    tranche: { couleur: "#c08a2a", metal: 0.8, rugosite: 0.22 },
    holo: { force: 0.5, teinte: [1, 0.84, 0.48] },
    gravure: { ombre: "rgba(62,34,0,0.62)", lumiere: "rgba(255,246,214,0.42)" },
  },
  // Palestine : la carte de saison, ses bandes en gris d'encre le long des
  // bords ; au dos, le drapeau (motifs-offerts.tsx), à l'encre blanche sur
  // le noir et le vert, la lune et le logotype dessinés par le motif.
  palestine: {
    nom: "palestine",
    titre: "palestine",
    encre: "8,9,11",
    sombre: false,
    papier: "linear-gradient(160deg, #fcfcfa 0%, #f1f1ed 55%, #e9e9e4 100%)",
    motif: {
      type: "palestine",
      bandes: [...DRAPEAU_PALESTINE.bandes],
      triangle: DRAPEAU_PALESTINE.triangle,
      encre: encrePalestine,
      clair: "rgba(255,255,255,0.9)",
      fonce: "rgba(8,9,11,0.32)",
    },
    fond: "#ffffff",
    lueur: BLANC,
    rayures: 0.05,
    micro: 0.04,
    reflet: 0.35,
    coins: 0.6,
    etiquette: { fond: "#08090b", bord: "#08090b", texte: "#f5f5f3" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.9)", ombre: "rgba(8,9,11,0.14)" },
    puce: "linear-gradient(135deg, #f3f3f1, #b9bab5 45%, #e6e6e3 70%, #a7a8a3)",
    cadre: sertiBandes(encrePalestine),
    voile: "rgba(0,0,0,0.5)",
    onglet: { fond: "#08090b", encre: "#f5f5f3" },
    vive: "#f5f5f3",
    tranche: { couleur: "#e4e4df", metal: 0.1, rugosite: 0.6 },
    holo: { force: 0.3, teinte: null },
    dos: {
      encre: "246,246,242",
      sombre: true,
      papier: "#0b0b0c",
      micro: 0.07,
      reflet: 0.16,
      rebord: { lumiere: "rgba(255,255,255,0.4)", ombre: "rgba(0,0,0,0.5)" },
      logo: false,
    },
  },
};
