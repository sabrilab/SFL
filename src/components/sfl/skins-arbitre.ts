// Les skins de la carte d'arbitre, que gagne son passe (lib/sfl/passe-arbitre.ts).
// Sabri, 24/10 : « des skins de cartes, mais d'arbitres, et des choses pour
// l'arbitre ».
//
// Le même contrat que les autres matières (finitions-carte.ts, qui les étale
// dans MATIERES) : un papier, un motif gravé dessiné par le code
// (motif-carte.tsx), une encre, un serti, une tranche et un reflet pour la
// 3D. Rien n'est une image. L'or, le bleu et le rouge restent aux cartes
// MVP, Défensive et Impact.
//
// Sa carte de base est jaune fluo, comme une chasuble (Sabri, 24/10 : « même
// sa carte principale à lui soit soit jaune, soit orange fluo »), et le passe
// fait gagner des fluos (« on veut quand même des skins de cartes qui soient
// fluorescentes ») : orange, vert et rose fluo, tous à l'encre noire, et le
// fluo nuit, le noir rayé de jaune fluo. Puis le noir, le blanc et le métal :
//   · craie : la tenue blanche, les rayures de la tenue à l'encre ;
//   · ardoise : la tenue gris ardoise ;
//   · rayé : les larges bandes des tenues d'autrefois, noir sur graphite ;
//   · damier : le damier du drapeau de touche, gravé ton sur ton ;
//   · nuit de match : le noir du stade, deux faisceaux de projecteurs ;
//   · chrono : le cadran du chronomètre, ses cercles fins ;
//   · platine : le platine soleillé d'un cadran de montre ;
//   · filets : le filet du but, ses mailles d'argent sur le noir.
// L'étiquette dit toujours ARBITRE, et son grade à côté (bola-card.tsx).
//
// Ce fichier n'importe que des types de finitions-carte.ts : c'est elle qui
// l'importe (pas de cycle).

import type { Matiere } from "@/components/sfl/finitions-carte";

export type FinitionArbitre =
  | "orange-fluo"
  | "vert-fluo"
  | "rose-fluo"
  | "fluo-nuit"
  | "craie"
  | "ardoise"
  | "raye"
  | "damier"
  | "nuit-de-match"
  | "chrono"
  | "platine"
  | "filets";
export type GradeArbitre = "ligue" | "national" | "elite" | "international";

export const GRADES: Record<GradeArbitre, string> = {
  ligue: "LIGUE",
  national: "NATIONAL",
  elite: "ÉLITE",
  international: "INTERNATIONAL",
};

/** Les motifs gravés des skins d'arbitre (motif-carte.tsx les dessine). */
export type MotifArbitre = { type: "bandes" } | { type: "damier" } | { type: "projecteurs" };

const SOMBRE = {
  encre: "240,240,236",
  sombre: true,
  lueur: "rgba(255,255,255,0.08)",
  rayures: 0.04,
  micro: 0.05,
  reflet: 0.12,
  coins: 0.7,
  etiquette: { fond: "#f0f0ec", bord: "#f0f0ec", texte: "#08090b" },
  symbole: "/bola/symbole-blanc.svg",
  rebord: { lumiere: "rgba(255,255,255,0.26)", ombre: "rgba(0,0,0,0.72)" },
  puce: "linear-gradient(135deg, #f3f3f1, #b9bab5 45%, #e6e6e3 70%, #a7a8a3)",
  voile: "rgba(6,6,8,0.84)",
  onglet: { fond: "#f0f0ec", encre: "#08090b" },
  vive: "#e8e8e4",
} as const;

const CLAIR = {
  encre: "14,15,17",
  sombre: false,
  lueur: "rgba(255,255,255,0.9)",
  rayures: 0.05,
  micro: 0.05,
  reflet: 0.5,
  coins: 0.6,
  etiquette: { fond: "#0c0d0f", bord: "#0c0d0f", texte: "#f2f2ee" },
  symbole: "/bola/symbole-noir.svg",
  rebord: { lumiere: "rgba(255,255,255,1)", ombre: "rgba(40,42,48,0.24)" },
  puce: "linear-gradient(135deg, #ffffff, #c2c4c7 45%, #f2f2f1 70%, #96999e)",
  voile: "rgba(16,17,20,0.55)",
  onglet: { fond: "#0c0d0f", encre: "#f2f2ee" },
  vive: "#55585e",
} as const;

/**
 * Une carte fluo : le papier qui éclaire de lui-même (le cœur plus vif que
 * les bords), les rayures de la tenue en creux, l'encre noire. `vif` est la
 * couleur pleine, `clair` et `fonce` les deux bouts du dégradé.
 */
function fluo(nom: Matiere["nom"], vif: string, clair: string, fonce: string): Matiere {
  return {
    ...CLAIR,
    nom,
    titre: "ARBITRE",
    encre: "10,11,8",
    papier: [
      "radial-gradient(85% 55% at 50% 30%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 70%)",
      `linear-gradient(162deg, ${clair} 0%, ${vif} 48%, ${fonce} 100%)`,
    ].join(", "),
    motif: { type: "tenue", clair: "rgba(255,255,255,0.3)", fonce: "rgba(10,11,8,0.1)" },
    fond: vif,
    lueur: "rgba(255,255,255,0.55)",
    reflet: 0.28,
    etiquette: { fond: "#0a0b08", bord: "#0a0b08", texte: vif },
    voile: "rgba(10,11,8,0.5)",
    onglet: { fond: "#0a0b08", encre: vif },
    vive: "#0a0b08",
    cadre: `linear-gradient(152deg, ${clair} 0%, ${vif} 45%, ${fonce} 80%, ${vif} 100%)`,
    rebord: { lumiere: "rgba(255,255,255,0.85)", ombre: "rgba(10,11,8,0.28)" },
    tranche: { couleur: vif, metal: 0.05, rugosite: 0.7 },
    holo: { force: 0.3, teinte: [1, 1, 0.9] },
  };
}

/** La carte d'arbitre de base : le jaune fluo de la chasuble. */
export const MATIERE_ARBITRE: Matiere = fluo("arbitre", "#e4ff1a", "#f4ff7a", "#c4dd00");

export const MATIERES_ARBITRE: Record<FinitionArbitre, Matiere> = {
  "orange-fluo": fluo("orange-fluo", "#ff7a1a", "#ffb067", "#f05a00"),
  "vert-fluo": fluo("vert-fluo", "#7dff3a", "#b8ff8a", "#4fd61a"),
  "rose-fluo": fluo("rose-fluo", "#ff4fc0", "#ff94da", "#f0249f"),
  // Le fluo nuit : le noir de la tenue, ses rayures et son encre en jaune fluo.
  "fluo-nuit": {
    ...SOMBRE,
    nom: "fluo-nuit",
    titre: "ARBITRE",
    encre: "228,255,26",
    papier: [
      "radial-gradient(90% 55% at 50% 30%, rgba(228,255,26,0.07) 0%, rgba(228,255,26,0) 70%)",
      "linear-gradient(160deg, #1d1e1a 0%, #111210 55%, #080907 100%)",
    ].join(", "),
    motif: { type: "tenue", clair: "rgba(228,255,26,0.16)", fonce: "rgba(0,0,0,0.5)" },
    fond: "#121310",
    lueur: "rgba(228,255,26,0.12)",
    etiquette: { fond: "#e4ff1a", bord: "#e4ff1a", texte: "#0a0b08" },
    rebord: { lumiere: "rgba(228,255,26,0.4)", ombre: "rgba(0,0,0,0.72)" },
    onglet: { fond: "#e4ff1a", encre: "#0a0b08" },
    vive: "#e4ff1a",
    cadre: [
      "repeating-linear-gradient(90deg, rgba(228,255,26,0.22) 0 2px, rgba(228,255,26,0) 2px 9px)",
      "linear-gradient(152deg, #262722 0%, #10110e 55%, #080907 100%)",
    ].join(", "),
    tranche: { couleur: "#e4ff1a", metal: 0.1, rugosite: 0.6 },
    holo: { force: 0.3, teinte: [0.95, 1, 0.7] },
  },
  craie: {
    ...CLAIR,
    nom: "craie",
    titre: "ARBITRE",
    papier: [
      "radial-gradient(90% 55% at 50% 28%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(162deg, #f6f6f3 0%, #ebebe7 50%, #dcdcd7 100%)",
    ].join(", "),
    motif: { type: "tenue", clair: "rgba(255,255,255,0.7)", fonce: "rgba(14,15,17,0.11)" },
    fond: "#ecece8",
    reflet: 0.3,
    cadre: "linear-gradient(152deg, #fbfbf9 0%, #e2e2de 45%, #c9c9c4 75%, #f0f0ed 100%)",
    tranche: { couleur: "#e8e8e4", metal: 0.1, rugosite: 0.8 },
    holo: { force: 0.25, teinte: [0.97, 0.97, 0.96] },
  },
  ardoise: {
    ...SOMBRE,
    nom: "ardoise",
    titre: "ARBITRE",
    papier: [
      "radial-gradient(90% 55% at 50% 28%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(160deg, #5a5d63 0%, #43464b 50%, #2f3135 100%)",
    ].join(", "),
    motif: { type: "tenue", clair: "rgba(255,255,255,0.08)", fonce: "rgba(0,0,0,0.3)" },
    fond: "#46494e",
    cadre: "linear-gradient(152deg, #62656b 0%, #3c3e43 45%, #4b4e53 70%, #26282b 100%)",
    tranche: { couleur: "#3d4045", metal: 0.15, rugosite: 0.78 },
    holo: { force: 0.22, teinte: [0.92, 0.93, 0.95] },
  },
  raye: {
    ...SOMBRE,
    nom: "raye",
    titre: "ARBITRE",
    papier: "linear-gradient(160deg, #2a2b2f 0%, #1d1e21 55%, #131416 100%)",
    motif: { type: "bandes", clair: "rgba(255,255,255,0.075)", fonce: "rgba(0,0,0,0.55)" },
    fond: "#1c1d20",
    cadre: [
      "repeating-linear-gradient(90deg, rgba(0,0,0,0.5) 0 7px, rgba(0,0,0,0) 7px 14px)",
      "linear-gradient(152deg, #3a3b40 0%, #1a1b1e 50%, #0c0d0f 100%)",
    ].join(", "),
    tranche: { couleur: "#1c1d20", metal: 0.15, rugosite: 0.72 },
    holo: { force: 0.2, teinte: [0.92, 0.93, 0.96] },
  },
  damier: {
    ...SOMBRE,
    nom: "damier",
    titre: "ARBITRE",
    papier: [
      "radial-gradient(90% 55% at 50% 30%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(160deg, #26272b 0%, #18191c 55%, #0e0f11 100%)",
    ].join(", "),
    motif: { type: "damier", clair: "rgba(255,255,255,0.075)", fonce: "rgba(0,0,0,0.45)" },
    fond: "#18191c",
    cadre: [
      "repeating-conic-gradient(rgba(255,255,255,0.09) 0 25%, rgba(255,255,255,0) 0 50%) 0 0 / 12px 12px",
      "linear-gradient(152deg, #2e2f33 0%, #141518 55%, #0a0b0d 100%)",
    ].join(", "),
    tranche: { couleur: "#18191c", metal: 0.2, rugosite: 0.6 },
    holo: { force: 0.25, teinte: [0.92, 0.93, 0.96] },
  },
  "nuit-de-match": {
    ...SOMBRE,
    nom: "nuit-de-match",
    titre: "ARBITRE",
    papier: [
      "radial-gradient(70% 40% at 50% 0%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(180deg, #121316 0%, #0a0a0c 60%, #050506 100%)",
    ].join(", "),
    motif: { type: "projecteurs", clair: "rgba(255,255,255,0.17)", fonce: "rgba(0,0,0,0.5)" },
    fond: "#0c0c0e",
    lueur: "rgba(255,255,255,0.14)",
    reflet: 0.16,
    cadre: [
      "radial-gradient(80% 60% at 20% 0%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 60%)",
      "radial-gradient(80% 60% at 80% 0%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 60%)",
      "linear-gradient(180deg, #1a1b1e 0%, #08090a 100%)",
    ].join(", "),
    tranche: { couleur: "#0d0d0f", metal: 0.3, rugosite: 0.5 },
    holo: { force: 0.3, teinte: [0.94, 0.95, 0.98] },
  },
  chrono: {
    ...SOMBRE,
    nom: "chrono",
    titre: "ARBITRE",
    papier: [
      "radial-gradient(60% 38% at 50% 34%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(160deg, #202125 0%, #121316 55%, #08090a 100%)",
    ].join(", "),
    motif: { type: "ondes", cx: 512, cy: 560, clair: "rgba(255,255,255,0.1)", fonce: "rgba(0,0,0,0.5)" },
    fond: "#121316",
    reflet: 0.2,
    cadre: [
      "repeating-radial-gradient(circle at 50% 40%, rgba(255,255,255,0.07) 0 2px, rgba(255,255,255,0) 2px 9px)",
      "linear-gradient(152deg, #2c2d31 0%, #111214 55%, #08090a 100%)",
    ].join(", "),
    tranche: { couleur: "#141518", metal: 0.6, rugosite: 0.3 },
    holo: { force: 0.35, teinte: [0.92, 0.93, 0.97] },
  },
  platine: {
    ...CLAIR,
    nom: "platine",
    titre: "ARBITRE",
    papier: [
      "linear-gradient(118deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.7) 46%, rgba(255,255,255,0) 62%)",
      "radial-gradient(90% 60% at 50% 34%, #ffffff 0%, #eceef1 45%, #d2d5da 100%)",
    ].join(", "),
    motif: { type: "rayons", cx: 512, cy: 560, n: 120, clair: "rgba(255,255,255,0.75)", fonce: "rgba(60,64,72,0.09)" },
    fond: "#eceef1",
    reflet: 0.75,
    cadre: [
      "repeating-conic-gradient(from 0deg at 50% 40%, rgba(255,255,255,0.5) 0 2deg, rgba(160,165,175,0.18) 2deg 4deg)",
      "linear-gradient(158deg, #ffffff 0%, #dfe2e6 40%, #b8bcc4 72%, #f2f3f5 100%)",
    ].join(", "),
    tranche: { couleur: "#dfe2e6", metal: 0.95, rugosite: 0.15 },
    holo: { force: 0.75, teinte: [0.97, 0.98, 1] },
  },
  filets: {
    ...SOMBRE,
    nom: "filets",
    titre: "ARBITRE",
    papier: [
      "radial-gradient(90% 55% at 50% 30%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(160deg, #1d1e22 0%, #101113 55%, #070708 100%)",
    ].join(", "),
    motif: { type: "alveoles", cote: 40, clair: "rgba(220,224,232,0.16)", fonce: "rgba(0,0,0,0.6)" },
    fond: "#111214",
    reflet: 0.18,
    cadre: "linear-gradient(152deg, #34363b 0%, #121315 45%, #222327 70%, #08090a 100%)",
    tranche: { couleur: "#121315", metal: 0.55, rugosite: 0.35 },
    holo: { force: 0.4, teinte: [0.93, 0.95, 0.99] },
  },
};
