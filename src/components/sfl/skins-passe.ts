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
// Ce fichier n'importe que des types de finitions-carte.ts : c'est elle qui
// l'importe (pas de cycle).

import type { Matiere } from "@/components/sfl/finitions-carte";

export type FinitionPasse = "givre" | "carbone" | "marbre" | "couleurs" | "neon" | "aurore" | "ki" | "meteorite";

/** Les motifs gravés des skins (motifs-passe.tsx les dessine). */
export type MotifPasse =
  | { type: "givre" }
  | { type: "carbone" }
  | { type: "marbre" }
  | { type: "couleurs"; bandes: string[]; encre: string[]; trame: string }
  | { type: "neon" }
  | { type: "aurore" }
  | { type: "ki" }
  | { type: "meteorite" };

const TYPES_MOTIF_PASSE = new Set<string>(["givre", "carbone", "marbre", "couleurs", "neon", "aurore", "ki", "meteorite"]);

export function estMotifPasse(m: { type: string }): m is MotifPasse {
  return TYPES_MOTIF_PASSE.has(m.type);
}

const BLANC = "rgba(255,255,255,0.95)";

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
