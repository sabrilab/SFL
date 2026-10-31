// Les skins du Passe Bola (lib/sfl/passe.ts) : les matières de carte que la
// passe fait gagner en plus de nuit, chrome et animée (Sabri, 24/10/2026 :
// « des skins qui changent l'allure de la carte. Tu as par exemple la
// finition nuit, c'est excellent comme skin. Inspire-toi de ça »).
//
// Même contrat que les autres matières (finitions-carte.ts, qui les étale
// dans MATIERES) : un papier, un motif gravé dessiné par le code
// (motifs-passe.tsx), une encre, un serti pour la carte photo, une tranche et
// un reflet pour la 3D. Rien n'est une image, rien n'est généré.
//
// L'or, le bleu et le rouge sont aux cartes à titre, MVP, Défensive et
// Impact (Sabri, 24/10 : « Les couleurs or, bleu et rouge sont vraiment
// destinées qu'aux cartes MVP, défensive et impact ») : aucun skin ne s'en
// approche. Des matières, en noir, blanc et métal, et trois couleurs à part :
//   · givre (palier 2) : le métal givré d'un cadran de montre, sa poussière
//     de cristal, le givre qui pousse des bords ;
//   · carbone (4) : la fibre tissée, gris anthracite ;
//   · marbre (7) : le marbre blanc veiné des statues du site ;
//   · tes couleurs (8) : le blanc de la carte de saison, et les bandes du
//     drapeau le long des deux bords, comme les côtés d'un maillot : en gris
//     d'encre sur la face et sur la petite carte, en couleurs au dos (presque
//     tous les drapeaux ont du bleu, du rouge ou du jaune or) ; le joueur
//     choisit le pays (COULEURS_PAYS, les 24 pays du studio) ;
//   · néon (11) : sur le noir, un tube fuchsia qui suit le bord ;
//   · aurore (12) : les rideaux verts et violets d'une aurore boréale ;
//   · ki (14) : l'aura blanche qui monte, gravée comme des flammes, et les
//     éclairs ;
//   · météorite (17) : le fer d'une météorite, ses lamelles croisées
//     (figures de Widmanstätten), comme les cadrans de montre en météorite.
// L'onyx (palier 16) vient du fil de la carte noire, qui le dessine.
//
// La Saison Givre (9 novembre 2026, PASSE_GIVRE) : l'hiver du Nord et les
// Vikings, sans bleu glacier (le bleu est à la Défensive). Ses motifs sont
// dans motifs-givre.tsx :
//   · bois brûlé (palier 2) : le noir du bois brûlé, fendu en écailles ;
//   · fer (4) : le fer martelé gris mat, ses rivets ;
//   · pierre (6) : le granit des pierres runiques, le ruban torsadé du bord ;
//   · nuit polaire (7) : le noir, les étoiles, la lune basse d'argent, la neige ;
//   · frimas (8) : la glace blanche, ses fêlures, les cristaux à six branches ;
//   · damas (9) : l'acier damassé, ses couches qui ondulent ;
//   · aurore polaire (10) : un grand rideau vert et violet au-dessus d'un
//     fjord noir, la lumière qui passe ;
//   · tempête (11) : la neige poussée par le vent sur le gris de l'orage ;
//   · jarl (12) : le fer noir, le double filet d'argent rivé, la neige, le
//     souffle qui fume.
//
// Ce fichier n'importe que des types de finitions-carte.ts : c'est elle qui
// l'importe (pas de cycle).

import type { Matiere } from "@/components/sfl/finitions-carte";

export type FinitionPasse =
  | "givre"
  | "carbone"
  | "marbre"
  | "couleurs"
  | "neon"
  | "aurore"
  | "ki"
  | "meteorite"
  | TypeMotifGivre;

/** Les skins de la Saison Givre : chacun son motif, du même nom. */
export type TypeMotifGivre = "bois-brule" | "fer" | "pierre" | "nuit-polaire" | "frimas" | "damas" | "aurore-polaire" | "tempete" | "jarl";

/** Les motifs gravés des skins (motifs-passe.tsx les dessine). */
export type MotifPasse =
  | { type: "givre" }
  | { type: "carbone" }
  | { type: "marbre" }
  | { type: "couleurs"; bandes: string[]; encre: string[]; trame: string }
  | { type: "neon" }
  | { type: "aurore" }
  | { type: "ki" }
  | { type: "meteorite" }
  | { type: TypeMotifGivre };

const TYPES_MOTIF_GIVRE = new Set<string>(["bois-brule", "fer", "pierre", "nuit-polaire", "frimas", "damas", "aurore-polaire", "tempete", "jarl"]);
const TYPES_MOTIF_PASSE = new Set<string>(["givre", "carbone", "marbre", "couleurs", "neon", "aurore", "ki", "meteorite", ...TYPES_MOTIF_GIVRE]);

export const estMotifGivre = (m: { type: string }): m is { type: TypeMotifGivre } => TYPES_MOTIF_GIVRE.has(m.type);

export function estMotifPasse(m: { type: string }): m is MotifPasse {
  return TYPES_MOTIF_PASSE.has(m.type);
}

const BLANC = "rgba(255,255,255,0.95)";

/* ------------------------------ Saison Givre ------------------------------ */

/** Ce qui change d'un skin de la Saison Givre à l'autre ; le reste suit le clair ou le sombre. */
interface Givre {
  nom: TypeMotifGivre;
  titre: string;
  encre: string;
  sombre: boolean;
  papier: string;
  motif: { clair: string; fonce: string };
  fond: string;
  cadre: string;
  vive: string;
  tranche: Matiere["tranche"];
  reflet: number;
  holo: Matiere["holo"];
  anime?: boolean;
  puce?: string;
  lueur?: string;
  onglet?: Matiere["onglet"];
}

function givre(g: Givre): Matiere {
  const e = (a: number) => `rgba(${g.encre},${a})`;
  return {
    nom: g.nom,
    titre: g.titre,
    encre: g.encre,
    sombre: g.sombre,
    papier: g.papier,
    motif: { type: g.nom, ...g.motif },
    fond: g.fond,
    lueur: g.lueur ?? (g.sombre ? "rgba(220,224,230,0.14)" : BLANC),
    rayures: 0.05,
    micro: g.sombre ? 0.06 : 0.05,
    reflet: g.reflet,
    coins: g.sombre ? 0.8 : 0.6,
    etiquette: { fond: "transparent", bord: e(0.5), texte: e(g.sombre ? 0.88 : 0.78) },
    symbole: g.sombre ? "/bola/symbole-blanc.svg" : "/bola/symbole-noir.svg",
    rebord: g.sombre
      ? { lumiere: "rgba(255,255,255,0.36)", ombre: "rgba(0,0,0,0.7)" }
      : { lumiere: "rgba(255,255,255,1)", ombre: "rgba(30,31,34,0.22)" },
    puce: g.puce ?? (g.sombre ? "linear-gradient(135deg, #d9dce1, #55585e 45%, #b8bcc2 70%, #2a2c30)" : "linear-gradient(135deg, #ffffff, #c2c4c7 45%, #f2f2f1 70%, #96999e)"),
    cadre: g.cadre,
    voile: g.sombre ? "rgba(6,7,8,0.82)" : "rgba(16,17,20,0.55)",
    onglet: g.onglet ?? (g.sombre ? { fond: "#eef0f2", encre: "#0b0c0e" } : { fond: "#121316", encre: "#f2f3f4" }),
    vive: g.vive,
    tranche: g.tranche,
    holo: g.holo,
    ...(g.anime && { anime: true }),
  };
}

const MATIERES_GIVRE: Record<TypeMotifGivre, Matiere> = {
  // Bois brûlé : le noir du charbon, à peine chaud, les écailles qui prennent un reflet de cendre.
  "bois-brule": givre({
    nom: "bois-brule",
    titre: "bois brûlé",
    encre: "236,233,228",
    sombre: true,
    papier: [
      "linear-gradient(115deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.06) 46%, rgba(255,255,255,0) 58%)",
      "radial-gradient(110% 70% at 30% 18%, #2a2725 0%, #161413 55%, #0b0a09 100%)",
    ].join(", "),
    motif: { clair: "rgba(226,220,212,1)", fonce: "rgba(0,0,0,1)" },
    fond: "#1a1817",
    cadre: [
      "repeating-linear-gradient(0deg, rgba(0,0,0,0.6) 0 2px, rgba(0,0,0,0) 2px 9px)",
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0 1px, rgba(255,255,255,0) 1px 14px)",
      "linear-gradient(160deg, #2c2927 0%, #141211 60%, #0a0908 100%)",
    ].join(", "),
    vive: "#a49d94",
    tranche: { couleur: "#141211", metal: 0.05, rugosite: 0.85 },
    reflet: 0.1,
    holo: { force: 0.25, teinte: [0.92, 0.9, 0.88] },
  }),
  // Fer : le gris mat du fer martelé, l'encre d'argent.
  fer: givre({
    nom: "fer",
    titre: "fer",
    encre: "238,239,241",
    sombre: true,
    papier: [
      "linear-gradient(122deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.1) 42%, rgba(255,255,255,0) 54%)",
      "radial-gradient(105% 64% at 30% 18%, #5a5d62 0%, #3a3c40 50%, #222427 100%)",
    ].join(", "),
    motif: { clair: "rgba(240,242,245,1)", fonce: "rgba(8,9,11,1)" },
    fond: "#323438",
    cadre: [
      "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12) 0 4px, rgba(255,255,255,0) 5px)",
      "linear-gradient(150deg, #5a5d62 0%, #34363a 50%, #4a4d52 70%, #1e2023 100%)",
    ].join(", "),
    vive: "#a3a7ad",
    tranche: { couleur: "#3a3c40", metal: 0.85, rugosite: 0.5 },
    reflet: 0.24,
    holo: { force: 0.4, teinte: [0.95, 0.96, 0.98] },
  }),
  // Pierre : le gris des stèles, grenu, l'encre presque noire.
  pierre: givre({
    nom: "pierre",
    titre: "pierre",
    encre: "24,24,26",
    sombre: false,
    papier: [
      "radial-gradient(90% 60% at 26% 14%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(160deg, #d9d7d2 0%, #c8c6c0 46%, #b4b1ab 100%)",
    ].join(", "),
    motif: { clair: "rgba(250,249,246,1)", fonce: "rgba(40,39,42,1)" },
    fond: "#cfcdc8",
    cadre: "linear-gradient(150deg, #dcdad5 0%, #b9b6b0 40%, #a19e98 62%, #cfcdc8 100%)",
    vive: "#8e8b85",
    tranche: { couleur: "#bdbab4", metal: 0, rugosite: 0.9 },
    reflet: 0.25,
    holo: { force: 0.2, teinte: null },
  }),
  // Nuit polaire : le noir de décembre, la lune d'argent.
  "nuit-polaire": givre({
    nom: "nuit-polaire",
    titre: "nuit polaire",
    encre: "240,241,244",
    sombre: true,
    papier: [
      "radial-gradient(60% 34% at 75% 14%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(180deg, #121317 0%, #0a0b0d 52%, #050506 100%)",
    ].join(", "),
    motif: { clair: "rgba(236,238,242,1)", fonce: "rgba(0,0,0,1)" },
    fond: "#101114",
    cadre: [
      "radial-gradient(circle at 76% 14%, rgba(255,255,255,0.9) 0 7%, rgba(255,255,255,0.12) 8%, rgba(255,255,255,0) 20%)",
      "linear-gradient(180deg, #16171b 0%, #060607 100%)",
    ].join(", "),
    vive: "#e8eaee",
    tranche: { couleur: "#0e0f12", metal: 0.4, rugosite: 0.35 },
    reflet: 0.12,
    holo: { force: 0.45, teinte: [0.96, 0.97, 1] },
  }),
  // Frimas : la glace blanche, sans une goutte de bleu, l'encre presque noire.
  frimas: givre({
    nom: "frimas",
    titre: "frimas",
    encre: "16,17,20",
    sombre: false,
    papier: [
      "radial-gradient(80% 50% at 20% 8%, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(120deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.7) 46%, rgba(255,255,255,0) 58%)",
      "linear-gradient(165deg, #fbfbfb 0%, #eeefef 44%, #dfe0e1 100%)",
    ].join(", "),
    motif: { clair: "rgba(255,255,255,1)", fonce: "rgba(60,62,68,0.62)" },
    fond: "#f3f3f3",
    cadre: [
      "linear-gradient(120deg, rgba(255,255,255,0) 34%, rgba(255,255,255,0.8) 46%, rgba(255,255,255,0) 58%)",
      "linear-gradient(160deg, #ffffff 0%, #e4e5e6 40%, #c4c6c9 70%, #f4f4f4 100%)",
    ].join(", "),
    vive: "#c0c2c5",
    tranche: { couleur: "#eeeff0", metal: 0.2, rugosite: 0.2 },
    reflet: 0.7,
    holo: { force: 0.65, teinte: [0.97, 0.98, 0.99] },
  }),
  // Damas : l'acier poli des lames, ses couches, l'encre d'argent.
  damas: givre({
    nom: "damas",
    titre: "damas",
    encre: "242,243,245",
    sombre: true,
    papier: [
      "linear-gradient(118deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.14) 44%, rgba(255,255,255,0) 58%)",
      "radial-gradient(110% 66% at 28% 16%, #6a6d73 0%, #44474c 48%, #26282b 100%)",
    ].join(", "),
    motif: { clair: "rgba(255,255,255,1)", fonce: "rgba(10,11,13,1)" },
    fond: "#3e4146",
    cadre: [
      "repeating-linear-gradient(170deg, rgba(255,255,255,0.12) 0 2px, rgba(0,0,0,0.18) 2px 5px, rgba(255,255,255,0) 5px 8px)",
      "linear-gradient(150deg, #6a6d73 0%, #3a3d42 50%, #575a60 70%, #202225 100%)",
    ].join(", "),
    vive: "#b4b8be",
    tranche: { couleur: "#4a4d52", metal: 0.95, rugosite: 0.22 },
    reflet: 0.32,
    holo: { force: 0.55, teinte: [0.96, 0.97, 0.99] },
  }),
  // Aurore polaire : le noir du grand nord, un rideau vert et violet, la lumière qui passe.
  "aurore-polaire": givre({
    nom: "aurore-polaire",
    titre: "aurore polaire",
    encre: "236,248,242",
    sombre: true,
    papier: [
      "radial-gradient(90% 46% at 30% 58%, rgba(60,224,160,0.2) 0%, rgba(60,224,160,0) 70%)",
      "radial-gradient(70% 40% at 86% 16%, rgba(178,110,255,0.18) 0%, rgba(178,110,255,0) 70%)",
      "linear-gradient(180deg, #0a100f 0%, #070b0a 50%, #030404 100%)",
    ].join(", "),
    motif: { clair: "rgba(110,255,196,1)", fonce: "rgba(182,118,255,1)" },
    fond: "#0a1211",
    lueur: "rgba(90,230,170,0.18)",
    cadre: [
      "linear-gradient(35deg, rgba(80,240,170,0) 22%, rgba(80,240,170,0.6) 44%, rgba(182,118,255,0.5) 64%, rgba(182,118,255,0) 84%)",
      "linear-gradient(180deg, #0c1513 0%, #030505 100%)",
    ].join(", "),
    vive: "#5fe3ad",
    onglet: { fond: "#5fe3ad", encre: "#04120c" },
    tranche: { couleur: "#0b1412", metal: 0.35, rugosite: 0.35 },
    reflet: 0.3,
    holo: { force: 0.8, teinte: [0.64, 1, 0.84] },
    anime: true,
  }),
  // Tempête : le gris de l'orage de neige, les flocons blancs, l'encre presque noire.
  tempete: givre({
    nom: "tempete",
    titre: "tempête",
    encre: "16,17,19",
    sombre: false,
    papier: [
      "radial-gradient(90% 50% at 22% 10%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(170deg, #d4d5d7 0%, #b9bbbe 50%, #9c9fa3 100%)",
    ].join(", "),
    motif: { clair: "rgba(255,255,255,1)", fonce: "rgba(30,31,34,1)" },
    fond: "#c6c8ca",
    cadre: [
      "repeating-linear-gradient(55deg, rgba(255,255,255,0.55) 0 2px, rgba(255,255,255,0) 2px 11px)",
      "linear-gradient(170deg, #d9dadc 0%, #a9acaf 60%, #8e9195 100%)",
    ].join(", "),
    vive: "#f4f5f6",
    tranche: { couleur: "#b3b5b8", metal: 0.2, rugosite: 0.5 },
    reflet: 0.45,
    holo: { force: 0.5, teinte: null },
    anime: true,
  }),
  // Jarl : le fer noir, l'argent, la neige ; la lumière qui passe.
  jarl: givre({
    nom: "jarl",
    titre: "jarl",
    encre: "244,245,247",
    sombre: true,
    papier: [
      "linear-gradient(122deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.08) 42%, rgba(255,255,255,0) 54%)",
      "radial-gradient(110% 66% at 30% 16%, #2e3034 0%, #17181b 50%, #08090a 100%)",
    ].join(", "),
    motif: { clair: "rgba(236,239,243,1)", fonce: "rgba(0,0,0,1)" },
    fond: "#1a1b1e",
    lueur: "rgba(236,239,243,0.2)",
    cadre: [
      "linear-gradient(90deg, rgba(236,239,243,0.9) 0 1.2%, rgba(0,0,0,0) 1.2% 2.4%, rgba(236,239,243,0.6) 2.4% 3%, rgba(0,0,0,0) 3% 97%, rgba(236,239,243,0.6) 97% 97.6%, rgba(0,0,0,0) 97.6% 98.8%, rgba(236,239,243,0.9) 98.8%)",
      "linear-gradient(160deg, #2e3034 0%, #121315 60%, #060607 100%)",
    ].join(", "),
    vive: "#eceff3",
    onglet: { fond: "#eceff3", encre: "#08090a" },
    tranche: { couleur: "#1d1e21", metal: 0.95, rugosite: 0.3 },
    reflet: 0.28,
    holo: { force: 0.65, teinte: [0.96, 0.97, 1] },
    anime: true,
  }),
};

export const MATIERES_PASSE: Record<Exclude<FinitionPasse, "couleurs">, Matiere> = {
  // Givre : le métal givré, gris argent sans une goutte de bleu, l'encre presque noire.
  givre: {
    nom: "givre",
    titre: "givre",
    encre: "20,21,24",
    sombre: false,
    papier: [
      "radial-gradient(85% 50% at 18% 6%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(118deg, rgba(255,255,255,0) 36%, rgba(255,255,255,0.45) 46%, rgba(255,255,255,0) 56%)",
      "linear-gradient(162deg, #f7f7f6 0%, #e8e9e9 38%, #d7d8d9 70%, #c3c5c7 100%)",
    ].join(", "),
    motif: { type: "givre", clair: "rgba(255,255,255,0.95)", fonce: "rgba(52,54,60,0.32)" },
    fond: "#ededec",
    lueur: BLANC,
    rayures: 0.05,
    micro: 0.05,
    reflet: 0.6,
    coins: 0.6,
    etiquette: { fond: "transparent", bord: "rgba(20,21,24,0.5)", texte: "rgba(20,21,24,0.78)" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,1)", ombre: "rgba(40,42,48,0.24)" },
    puce: "linear-gradient(135deg, #ffffff, #c2c4c7 45%, #f2f2f1 70%, #96999e)",
    cadre: [
      "linear-gradient(118deg, rgba(255,255,255,0) 36%, rgba(255,255,255,0.6) 46%, rgba(255,255,255,0) 56%)",
      "linear-gradient(158deg, #fafafa 0%, #dcdddf 38%, #a9acb0 70%, #eaebec 100%)",
    ].join(", "),
    voile: "rgba(16,17,20,0.55)",
    onglet: { fond: "#ececeb", encre: "#141518" },
    vive: "#b6b9bd",
    tranche: { couleur: "#d9dadc", metal: 0.4, rugosite: 0.42 },
    holo: { force: 0.6, teinte: [0.95, 0.96, 0.97] },
  },
  // Carbone : la fibre tissée, l'encre gris clair, un reflet satiné.
  carbone: {
    nom: "carbone",
    titre: "carbone",
    encre: "234,236,240",
    sombre: true,
    papier: [
      "linear-gradient(118deg, rgba(255,255,255,0) 32%, rgba(255,255,255,0.06) 46%, rgba(255,255,255,0) 60%)",
      "radial-gradient(115% 72% at 30% 18%, #2c2f34 0%, #17191c 55%, #0a0b0d 100%)",
    ].join(", "),
    motif: { type: "carbone", clair: "rgba(255,255,255,0.075)", fonce: "rgba(0,0,0,0.5)" },
    fond: "#1a1c20",
    lueur: "rgba(196,202,212,0.16)",
    rayures: 0.05,
    micro: 0.06,
    reflet: 0.14,
    coins: 0.75,
    etiquette: { fond: "transparent", bord: "rgba(234,236,240,0.55)", texte: "rgba(234,236,240,0.85)" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(214,220,228,0.38)", ombre: "rgba(0,0,0,0.66)" },
    puce: "linear-gradient(135deg, #e9ebee, #7b818a 45%, #cdd1d6 70%, #4a4f57)",
    cadre: [
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0 3px, rgba(255,255,255,0) 3px 6px)",
      "repeating-linear-gradient(-45deg, rgba(0,0,0,0.38) 0 3px, rgba(0,0,0,0) 3px 6px)",
      "linear-gradient(160deg, #2a2d32 0%, #15171a 60%, #0b0c0e 100%)",
    ].join(", "),
    voile: "rgba(6,7,8,0.8)",
    onglet: { fond: "#1d1f23", encre: "#eaecf0" },
    vive: "#8a919a",
    tranche: { couleur: "#1d1f23", metal: 0.45, rugosite: 0.34 },
    holo: { force: 0.35, teinte: [0.85, 0.88, 0.93] },
  },
  // Marbre : le blanc des statues du site, des veines grises, l'encre presque noire.
  marbre: {
    nom: "marbre",
    titre: "marbre",
    encre: "22,22,26",
    sombre: false,
    papier: [
      "radial-gradient(90% 60% at 28% 16%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(158deg, #fbfaf7 0%, #f1efea 42%, #e5e2dc 76%, #d8d4cd 100%)",
    ].join(", "),
    motif: { type: "marbre", clair: "rgba(255,255,255,0.8)", fonce: "rgba(64,62,70,0.34)" },
    fond: "#f3f1ed",
    lueur: BLANC,
    rayures: 0.04,
    micro: 0.04,
    reflet: 0.45,
    coins: 0.55,
    etiquette: { fond: "transparent", bord: "rgba(22,22,26,0.5)", texte: "rgba(22,22,26,0.75)" },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,255,255,0.95)", ombre: "rgba(40,38,44,0.2)" },
    puce: "linear-gradient(135deg, #ffffff, #c8c4bd 45%, #f0eee9 70%, #a6a299)",
    cadre: "linear-gradient(150deg, #fbfaf7 0%, #e4e1db 34%, #c9c5bc 54%, #f3f1ec 74%, #b8b3a9 100%)",
    voile: "rgba(20,20,24,0.5)",
    onglet: { fond: "#f3f1ec", encre: "#16161a" },
    vive: "#b8b3a9",
    tranche: { couleur: "#e7e4de", metal: 0.05, rugosite: 0.24 },
    holo: { force: 0.35, teinte: null },
  },
  // Néon : le noir, un tube fuchsia qui suit le bord, sa lueur sur le papier.
  neon: {
    nom: "neon",
    titre: "néon",
    encre: "253,238,251",
    sombre: true,
    papier: [
      "radial-gradient(95% 50% at 50% 104%, rgba(255,70,230,0.2) 0%, rgba(255,70,230,0) 70%)",
      "linear-gradient(172deg, #0f0a11 0%, #08070a 58%, #050406 100%)",
    ].join(", "),
    motif: { type: "neon", clair: "rgba(255,236,252,1)", fonce: "rgba(255,70,230,1)" },
    fond: "#140d16",
    lueur: "rgba(255,90,232,0.16)",
    rayures: 0.05,
    micro: 0.05,
    reflet: 0.1,
    coins: 0.7,
    etiquette: { fond: "transparent", bord: "rgba(255,110,236,0.95)", texte: "rgba(255,210,248,0.95)" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,150,240,0.4)", ombre: "rgba(0,0,0,0.7)" },
    puce: "linear-gradient(135deg, #f6eaf4, #87798a 45%, #e2d6e1 70%, #4b4450)",
    cadre: [
      "radial-gradient(120% 70% at 50% 50%, rgba(255,90,232,0) 52%, rgba(255,90,232,0.55) 74%, rgba(255,90,232,0) 92%)",
      "linear-gradient(172deg, #150d17 0%, #08070a 100%)",
    ].join(", "),
    voile: "rgba(10,4,12,0.8)",
    onglet: { fond: "#ff4fe6", encre: "#0b0610" },
    vive: "#ff4fe6",
    tranche: { couleur: "#170e19", metal: 0.3, rugosite: 0.4 },
    holo: { force: 0.55, teinte: [1, 0.6, 0.95] },
  },
  // Aurore : la nuit du grand nord, noire et verte, les rideaux verts et violets, l'encre de glace.
  aurore: {
    nom: "aurore",
    titre: "aurore",
    encre: "232,246,240",
    sombre: true,
    papier: [
      "radial-gradient(85% 42% at 24% 4%, rgba(60,224,160,0.26) 0%, rgba(60,224,160,0) 70%)",
      "radial-gradient(80% 44% at 90% 22%, rgba(178,110,255,0.22) 0%, rgba(178,110,255,0) 70%)",
      "linear-gradient(180deg, #0c1714 0%, #08100e 46%, #040807 100%)",
    ].join(", "),
    motif: { type: "aurore", clair: "rgba(110,255,196,1)", fonce: "rgba(182,118,255,1)" },
    fond: "#0b1513",
    lueur: "rgba(90,230,170,0.18)",
    rayures: 0.05,
    micro: 0.06,
    reflet: 0.12,
    coins: 0.75,
    etiquette: { fond: "transparent", bord: "rgba(150,255,210,0.7)", texte: "rgba(200,255,230,0.9)" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(150,240,205,0.4)", ombre: "rgba(0,0,0,0.65)" },
    puce: "linear-gradient(135deg, #e8f6f0, #6f8a82 45%, #cfe6dd 70%, #3f5550)",
    cadre: [
      "linear-gradient(125deg, rgba(80,240,170,0) 20%, rgba(80,240,170,0.55) 42%, rgba(182,118,255,0.5) 62%, rgba(182,118,255,0) 82%)",
      "linear-gradient(180deg, #0d1a17 0%, #050a09 100%)",
    ].join(", "),
    voile: "rgba(4,12,10,0.8)",
    onglet: { fond: "#5fe3ad", encre: "#04120c" },
    vive: "#5fe3ad",
    tranche: { couleur: "#0c1815", metal: 0.3, rugosite: 0.4 },
    holo: { force: 0.75, teinte: [0.64, 1, 0.84] },
  },
  // Ki : le noir, l'aura blanche qui monte derrière le portrait, gravée en flammes, et les éclairs.
  ki: {
    nom: "ki",
    titre: "ki",
    encre: "248,248,251",
    sombre: true,
    papier: [
      "radial-gradient(48% 30% at 50% 44.6%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%)",
      "radial-gradient(120% 30% at 50% 104%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)",
      "linear-gradient(180deg, #0b0b0d 0%, #060607 55%, #030303 100%)",
    ].join(", "),
    motif: { type: "ki", clair: "rgba(255,255,255,1)", fonce: "rgba(232,230,244,1)" },
    fond: "#131317",
    lueur: "rgba(244,242,255,0.4)",
    rayures: 0.05,
    micro: 0.06,
    reflet: 0.18,
    coins: 0.85,
    etiquette: { fond: "#f4f4f7", bord: "#f4f4f7", texte: "#08080a" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,255,255,0.6)", ombre: "rgba(0,0,0,0.75)" },
    puce: "linear-gradient(135deg, #ffffff, #8d8e97 45%, #e6e6ed 70%, #53545c)",
    cadre: [
      "radial-gradient(110% 70% at 50% 40%, rgba(255,255,255,0.85) 0%, rgba(214,212,228,0.45) 42%, rgba(26,26,31,0.95) 78%)",
      "linear-gradient(180deg, #19191e 0%, #050506 100%)",
    ].join(", "),
    voile: "rgba(6,6,8,0.84)",
    onglet: { fond: "#f4f4f7", encre: "#08080a" },
    vive: "#e8e8f0",
    tranche: { couleur: "#19191d", metal: 0.6, rugosite: 0.28 },
    holo: { force: 0.7, teinte: [0.97, 0.96, 1] },
  },
  // Météorite : le fer gris acier, ses lamelles croisées, l'encre d'argent, une tranche de métal brut.
  meteorite: {
    nom: "meteorite",
    titre: "météorite",
    encre: "238,239,241",
    sombre: true,
    papier: [
      "linear-gradient(122deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.08) 42%, rgba(255,255,255,0) 54%)",
      "radial-gradient(100% 62% at 30% 20%, #4b4e53 0%, #2c2e32 48%, #17181b 100%)",
    ].join(", "),
    motif: { type: "meteorite", clair: "rgba(236,239,243,1)", fonce: "rgba(6,7,9,1)" },
    fond: "#27292d",
    lueur: "rgba(220,224,230,0.14)",
    rayures: 0.05,
    micro: 0.05,
    reflet: 0.3,
    coins: 0.8,
    etiquette: { fond: "#0e0f11", bord: "rgba(238,239,241,0.5)", texte: "rgba(238,239,241,0.9)" },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,255,255,0.4)", ombre: "rgba(0,0,0,0.7)" },
    puce: "linear-gradient(135deg, #d9dce1, #55585e 45%, #b8bcc2 70%, #2a2c30)",
    cadre: [
      "repeating-linear-gradient(58deg, rgba(255,255,255,0.09) 0 2px, rgba(255,255,255,0) 2px 7px)",
      "repeating-linear-gradient(-62deg, rgba(0,0,0,0.28) 0 3px, rgba(0,0,0,0) 3px 10px)",
      "linear-gradient(150deg, #4b4e53 0%, #232529 50%, #3a3d42 70%, #141518 100%)",
    ].join(", "),
    voile: "rgba(10,11,13,0.82)",
    onglet: { fond: "#2c2e32", encre: "#eeeff1" },
    vive: "#a9adb4",
    tranche: { couleur: "#3a3d42", metal: 0.9, rugosite: 0.32 },
    holo: { force: 0.45, teinte: [0.95, 0.96, 0.98] },
  },
  ...MATIERES_GIVRE,
};

/* ------------------------------ Tes couleurs ------------------------------ */
// Les bandes du drapeau, dans leur ordre, posées le long des deux bords sur
// le blanc de la carte de saison : le drapeau habille la carte sans la
// teindre. Sur la face et sur la petite carte des classements, elles sont en
// gris d'encre, chacune à la clarté de sa couleur (enEncre) : le bleu, le
// rouge et le jaune or des drapeaux sont ceux des cartes à titre, et un cadre
// bleu ou rouge en petite carte se lirait Défensive ou Impact. Leurs
// couleurs sont au dos, quand on retourne la carte. Les 24 pays mis en avant
// par le studio (photo-studio.ts, PAYS).

export interface CouleursPays {
  nom: string;
  /** Les bandes du drapeau, de gauche à droite (ou de haut en bas), en « #rrggbb ». */
  bandes: string[];
}

export const COULEURS_PAYS: Record<string, CouleursPays> = {
  fr: { nom: "France", bandes: ["#0055a4", "#ffffff", "#ef4135"] },
  dz: { nom: "Algérie", bandes: ["#006233", "#ffffff", "#d21034"] },
  ma: { nom: "Maroc", bandes: ["#c1272d", "#006233", "#c1272d"] },
  tn: { nom: "Tunisie", bandes: ["#e70013", "#ffffff", "#e70013"] },
  sn: { nom: "Sénégal", bandes: ["#00853f", "#fdef42", "#e31b23"] },
  ml: { nom: "Mali", bandes: ["#14b53a", "#fcd116", "#ce1126"] },
  ci: { nom: "Côte d'Ivoire", bandes: ["#f77f00", "#ffffff", "#009e60"] },
  cm: { nom: "Cameroun", bandes: ["#007a5e", "#ce1126", "#fcd116"] },
  cd: { nom: "RD Congo", bandes: ["#007fff", "#f7d618", "#ce1021"] },
  gn: { nom: "Guinée", bandes: ["#ce1126", "#fcd116", "#009460"] },
  mr: { nom: "Mauritanie", bandes: ["#d01c1f", "#00a95c", "#ffd700"] },
  km: { nom: "Comores", bandes: ["#fcd116", "#ffffff", "#ce1126", "#3a75c4"] },
  cv: { nom: "Cap-Vert", bandes: ["#003893", "#ffffff", "#cf2027", "#f7d116"] },
  eg: { nom: "Égypte", bandes: ["#ce1126", "#ffffff", "#141414"] },
  tr: { nom: "Turquie", bandes: ["#e30a17", "#ffffff", "#e30a17"] },
  pt: { nom: "Portugal", bandes: ["#006600", "#ff0000", "#ffcc00"] },
  es: { nom: "Espagne", bandes: ["#aa151b", "#f1bf00", "#aa151b"] },
  it: { nom: "Italie", bandes: ["#009246", "#ffffff", "#ce2b37"] },
  be: { nom: "Belgique", bandes: ["#141414", "#fdda24", "#ef3340"] },
  nl: { nom: "Pays-Bas", bandes: ["#ae1c28", "#ffffff", "#21468b"] },
  de: { nom: "Allemagne", bandes: ["#141414", "#dd0000", "#ffce00"] },
  "gb-eng": { nom: "Angleterre", bandes: ["#ffffff", "#ce1124", "#ffffff"] },
  br: { nom: "Brésil", bandes: ["#009c3b", "#ffdf00", "#002776"] },
  ar: { nom: "Argentine", bandes: ["#75aadb", "#ffffff", "#f6b40e"] },
};

/** Le pays de « Tes couleurs » quand rien n'est choisi. */
export const PAYS_PAR_DEFAUT = "fr";

export const estPaysCouleurs = (p: unknown): p is string => typeof p === "string" && p in COULEURS_PAYS;

/** Une couleur en gris d'encre de même clarté (luminance relative), le blanc restant le blanc de la carte. */
export function enEncre(hex: string): string {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  const g = Math.round(255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055));
  return `#${g.toString(16).padStart(2, "0").repeat(3)}`;
}

/** Le serti de la carte photo : les bandes du drapeau sur ses deux côtés (le serti fait 57 / 1024 de large), le blanc entre. */
function sertiDrapeau(bandes: string[]): string {
  const l = 4.6 / bandes.length;
  const pas = (i: number) => `${(i * l).toFixed(2)}%`;
  const gauche = bandes.map((c, i) => `${c} ${pas(i)} ${pas(i + 1)}`);
  const droite = [...bandes].reverse().map((c, i) => `${c} calc(100% - ${pas(bandes.length - i)}) calc(100% - ${pas(bandes.length - i - 1)})`);
  return `linear-gradient(90deg, ${gauche.join(", ")}, #f4f4f1 ${pas(bandes.length)} calc(100% - ${pas(bandes.length)}), ${droite.join(", ")})`;
}

const cache = new Map<string, Matiere>();

/** La matière « Tes couleurs » d'un pays (le pays par défaut si inconnu) : le papier, l'encre et la tranche de la carte de saison. */
export function matiereCouleurs(pays?: string): Matiere {
  const id = estPaysCouleurs(pays) ? pays : PAYS_PAR_DEFAUT;
  const deja = cache.get(id);
  if (deja) return deja;
  const c = COULEURS_PAYS[id];
  const encre = c.bandes.map(enEncre);
  const m: Matiere = {
    nom: "couleurs",
    titre: c.nom.toLowerCase(),
    encre: "8,9,11",
    sombre: false,
    papier: "linear-gradient(160deg, #fcfcfa 0%, #f1f1ed 55%, #e9e9e4 100%)",
    motif: { type: "couleurs", bandes: c.bandes, encre, trame: "rgba(8,9,11,0.05)", clair: "rgba(255,255,255,0.9)", fonce: "rgba(8,9,11,0.32)" },
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
    cadre: sertiDrapeau(encre),
    voile: "rgba(0,0,0,0.5)",
    onglet: { fond: "#08090b", encre: "#f5f5f3" },
    vive: "#f5f5f3",
    tranche: { couleur: "#e4e4df", metal: 0.1, rugosite: 0.6 },
    holo: { force: 0.3, teinte: null },
  };
  cache.set(id, m);
  return m;
}
