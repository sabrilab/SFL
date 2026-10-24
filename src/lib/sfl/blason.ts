// L'écusson et les couleurs d'une équipe de Bola Team (Sabri, 24/10 :
// « designer un vrai écusson d'équipe et choisir de vraies couleurs
// d'équipe » ; des maillots à envoyer aux abonnés Bola Team).
//
// Un écusson, c'est :
//   · une forme : l'écu (la pointe en haut, celui d'avant), le blason à
//     tête plate des clubs français, le rond, la pointe moderne, l'ovale ;
//   · un motif, peint dans la deuxième couleur sur la première : uni,
//     parti (moitié gauche, moitié droite), coupé (haut, bas), tranché (en
//     diagonale), rayures, bande au milieu, écharpe, chevron, cerclé ;
//   · trois couleurs, prises dans une palette de couleurs de club : la
//     principale (le fond), la secondaire (le motif), la troisième (le
//     liseré et l'emblème) ;
//   · un emblème au cœur : les initiales, une étoile, un ballon, une
//     couronne ou un éclair (avec les initiales dessous quand il y a la
//     place).
// Le maillot (equipe/maillot.tsx) reprend tout : le corps dans la
// principale, le même motif dans la secondaire, col et manches dans la
// troisième, l'écusson sur le cœur. Jamais d'image importée (règles
// officielles, Q17) : tout se dessine.
//
// En base, une colonne jsonb (equipes.blason, posée par equipe_blason) ;
// une équipe qui n'en a pas garde l'écusson noir et blanc de ses débuts,
// d'après sa colonne fond. Module pur, partagé par l'app et la démo.

import type { Fond } from "@/lib/sfl/equipes";

export type Forme = "ecu" | "blason" | "rond" | "pointe" | "ovale";
export type Motif = "uni" | "parti" | "coupe" | "tranche" | "rayures" | "bande" | "echarpe" | "chevron" | "cercle";
export type Embleme = "initiales" | "etoile" | "ballon" | "couronne" | "eclair";

export interface Blason {
  forme: Forme;
  motif: Motif;
  /** Principale (le fond), secondaire (le motif), troisième (liseré, emblème) : « #RRGGBB ». */
  couleurs: [string, string, string];
  embleme: Embleme;
}

export const FORMES: { id: Forme; label: string }[] = [
  { id: "ecu", label: "Écu" },
  { id: "blason", label: "Blason" },
  { id: "rond", label: "Rond" },
  { id: "pointe", label: "Pointe" },
  { id: "ovale", label: "Ovale" },
];

export const MOTIFS: { id: Motif; label: string }[] = [
  { id: "uni", label: "Uni" },
  { id: "parti", label: "Parti" },
  { id: "coupe", label: "Coupé" },
  { id: "tranche", label: "Tranché" },
  { id: "rayures", label: "Rayures" },
  { id: "bande", label: "Bande" },
  { id: "echarpe", label: "Écharpe" },
  { id: "chevron", label: "Chevron" },
  { id: "cercle", label: "Cerclé" },
];

export const EMBLEMES: { id: Embleme; label: string }[] = [
  { id: "initiales", label: "Initiales" },
  { id: "etoile", label: "Étoile" },
  { id: "ballon", label: "Ballon" },
  { id: "couronne", label: "Couronne" },
  { id: "eclair", label: "Éclair" },
];

/** Les couleurs de club : celles qu'on trouve sur les maillots, rien de fluo. */
export const PALETTE: { id: string; label: string; hex: string }[] = [
  { id: "blanc", label: "Blanc", hex: "#F4F3EF" },
  { id: "noir", label: "Noir", hex: "#0A0B0D" },
  { id: "argent", label: "Argent", hex: "#A7ADB4" },
  { id: "rouge", label: "Rouge", hex: "#D3212C" },
  { id: "bordeaux", label: "Bordeaux", hex: "#7A1C2C" },
  { id: "orange", label: "Orange", hex: "#EE7623" },
  { id: "jaune", label: "Jaune", hex: "#F6C324" },
  { id: "or", label: "Or", hex: "#B8913A" },
  { id: "vert", label: "Vert", hex: "#16924A" },
  { id: "foret", label: "Vert forêt", hex: "#0E4D32" },
  { id: "ciel", label: "Ciel", hex: "#6BB3E6" },
  { id: "roi", label: "Bleu roi", hex: "#1F4FC9" },
  { id: "marine", label: "Marine", hex: "#0E1E3F" },
  { id: "violet", label: "Violet", hex: "#5E2CA5" },
  { id: "rose", label: "Rose", hex: "#E5569A" },
];

const HEX = /^#[0-9A-F]{6}$/;
const BLANC = PALETTE[0].hex;
const NOIR = PALETTE[1].hex;

export const libelleCouleur = (hex: string) => PALETTE.find((c) => c.hex === hex)?.label ?? hex;

/** L'écusson noir et blanc d'une équipe qui n'a pas encore dessiné le sien. */
export function blasonParDefaut(fond: Fond): Blason {
  return fond === "blanc"
    ? { forme: "ecu", motif: "uni", couleurs: [BLANC, NOIR, NOIR], embleme: "initiales" }
    : { forme: "ecu", motif: "uni", couleurs: [NOIR, BLANC, BLANC], embleme: "initiales" };
}

/** Ce que la base (ou un brouillon) en dit, vérifié ; null si ça ne ressemble pas à un écusson. */
export function lireBlason(x: unknown): Blason | null {
  if (!x || typeof x !== "object") return null;
  const b = x as Partial<Record<keyof Blason, unknown>>;
  const couleurs = Array.isArray(b.couleurs) ? b.couleurs.map((c) => (typeof c === "string" ? c.toUpperCase() : "")) : [];
  if (!FORMES.some((f) => f.id === b.forme)) return null;
  if (!MOTIFS.some((m) => m.id === b.motif)) return null;
  if (!EMBLEMES.some((e) => e.id === b.embleme)) return null;
  if (couleurs.length !== 3 || !couleurs.every((c) => HEX.test(c))) return null;
  return { forme: b.forme as Forme, motif: b.motif as Motif, embleme: b.embleme as Embleme, couleurs: couleurs as Blason["couleurs"] };
}

/** La luminance relative (WCAG) d'une couleur « #RRGGBB ». */
export function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = v.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** L'encre qui se lit sur une couleur : le blanc cassé ou le noir de l'app. */
export const encreSur = (hex: string) => (luminance(hex) > 0.36 ? NOIR : BLANC);

/** Le fond « noir » ou « blanc » d'un écusson dessiné (l'ancienne colonne, pour ce qui ne lit qu'elle). */
export const fondDe = (b: Blason): Fond => (luminance(b.couleurs[0]) > 0.36 ? "blanc" : "noir");

/**
 * La couleur de l'emblème : la troisième, sauf quand elle disparaît sur un
 * fond uni de presque la même couleur (on prend alors l'encre qui s'y lit).
 */
export function couleurEmbleme(b: Blason): string {
  const [fond, motif, detail] = b.couleurs;
  if (contraste(detail, fond) >= 1.6) return detail;
  if (b.motif !== "uni" && contraste(motif, fond) >= 1.6 && contraste(detail, motif) >= 1.6) return detail;
  return encreSur(fond);
}

/** Les mêmes couleurs dans le même ordre ? (pour ne pas réenregistrer pour rien) */
export const memeBlason = (a: Blason | null, b: Blason | null) =>
  !!a && !!b && a.forme === b.forme && a.motif === b.motif && a.embleme === b.embleme && a.couleurs.every((c, i) => c === b.couleurs[i]);
