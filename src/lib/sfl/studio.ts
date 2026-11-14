// Bola Studio : les images et les vidéos de foot qu'un joueur crée à partir
// de sa carte et de ses matchs, payées en ballons (demande de Sabri,
// 14/11/2026, bola-app#22 : « on va proposer d'acheter des contenus vidéo ou
// des images […] il faut inclure ça dans un calcul avec leur abonnement,
// parce qu'on va leur donner des ballons »). La page Bola Plus le MONTRE
// seulement (components/sfl/studio-bola.tsx) : aucun achat, aucun porte-
// monnaie touché, aucun appel à un service de génération.
//
// La seule source du studio : les douze templates et leurs prix, les ballons
// de l'abonnement, les recharges. Les prix ne sont pas encore validés par
// Sabri : ils se changent ICI, et seulement ici (tools/studio-check.ts).
//
//   · un ballon vaut un centime (lib/sfl/ballons.ts, BALLONS_PAR_EURO = 100) ;
//   · Bola Plus donne BALLONS_PAR_MOIS (300) chaque mois, aux deux formules ;
//     l'annuel ajoute OFFERTS_ANNUEL (1 000) à l'inscription ;
//   · la phrase « 300 ⚽ = un trash talk ou six images » se calcule : combien
//     de trash talks et combien d'images les moins chères tiennent dans les
//     ballons du mois (division entière ; « un » ou « une » selon le mot ; une
//     quantité nulle ne s'écrit pas ; en lettres jusqu'à douze, sinon toute la
//     phrase en chiffres) ;
//   · les recharges (« Bientôt ») : un prix en centimes entiers et des
//     ballons ; le bonus est ce qu'elles donnent au-delà du taux de base
//     (prix × BALLONS_PAR_EURO / 100) ; aucune ne donne moins que ce taux.
//
// Chaque template porte aussi le modèle de génération et son coût en crédits
// (le chiffrage du 14/11, pour la marge) : null tant que ces deux chiffres
// n'ont pas été recopiés ici depuis le chiffrage ; l'écran ne les montre
// jamais.
//
// La scène de chaque template : la vignette qui dit ce que le joueur reçoit,
// composée par l'écran avec ce qui existe déjà (aucune image générée pour le
// studio) : un visuel de public/bola-plus/ (le stade de piliers la nuit, le
// portant des maillots, la caméra, le socle, le podium), recadré, et la vraie
// carte anonyme « Toi » (BolaCard, DosCarte), ou le symbole Bola pour le
// ballon. Une vidéo est un cadrage qui bouge lentement, arrêté avec
// « Réduire les animations ».
// L'avantage « Ton studio » de Bola Plus a sa scène à lui (sceneStudio) :
// le stade, le ballon au centre des coins de repère, sans carte (la carte
// « Toi » est déjà dans les vignettes du rail, juste dessous).
//
// Pur : ni React ni réseau.

import { BALLONS_PAR_EURO } from "./ballons";
import { montant } from "./bola-plus";

/** Une image fixe, ou une vidéo de tant de secondes. */
export type Rendu = { genre: "image" } | { genre: "video"; secondes: number };

/** Les visuels de public/bola-plus/ sur lesquels une scène se compose. */
export const FONDS = ["affiche", "maillots", "matchs-filmes", "cadeaux", "ceremonies"] as const;
export type Fond = (typeof FONDS)[number];
/** Un visuel de Bola Plus (Visuel.image, une chaîne) est-il un fond du studio ? */
export const estFond = (image: string): image is Fond => (FONDS as readonly string[]).includes(image);

/**
 * La mise en scène d'une vignette :
 *   · tenue : la carte, de près, penchée, comme tenue en main ;
 *   · podium : la carte debout sur le socle ou le podium du fond ;
 *   · une : la carte en couverture, le logo Bola en tête ;
 *   · affiche : la face et le dos, droits, en miroir, le ballon entre les deux
 *     (le « contre » de l'affiche) ;
 *   · provoc : la carte seule, de très près, penchée vers l'objectif ; le dos
 *     de l'adversaire coupé au bord du cadre, flou ;
 *   · sortie : la carte en grand, qui avance vers l'écran ;
 *   · trois : trois plans côte à côte, la carte au milieu ;
 *   · loin : la carte petite, au bout de l'allée de piliers ;
 *   · ballon : le symbole Bola (le ballon) au bout de sa course, la carte en bas ;
 *   · rang : cinq cartes en rang, la face au milieu ;
 *   · vise : le ballon (le symbole Bola) au centre, sans carte : le visuel de
 *     « Ton studio », dans ses coins de repère ;
 *   · fond : le visuel seul.
 */
export type Pose = "tenue" | "podium" | "une" | "affiche" | "provoc" | "sortie" | "trois" | "loin" | "ballon" | "rang" | "vise" | "fond";

export interface Scene {
  fond: Fond;
  /** Le point du visuel gardé au centre, en % de sa largeur et de sa hauteur. */
  x: number;
  y: number;
  /** Le grossissement du visuel (1 : plein cadre). */
  zoom: number;
  pose: Pose;
}

export interface Template {
  id: string;
  nom: string;
  /** Ce que le joueur reçoit, en une ligne. */
  recoit: string;
  rendu: Rendu;
  /** Un supplément qui s'ajoute à un autre rendu (l'option HD) : « +399 ⚽ », « +5 s ». */
  supplement?: boolean;
  /** Le prix, en ballons. */
  prix: number;
  /** Le modèle de génération et son coût en crédits, pour la marge : jamais à l'écran. */
  modele: string | null;
  credits: number | null;
  scene: Scene;
}

/** La scène de l'avantage « Ton studio » : le stade, le ballon au centre, sans carte (son fond vient de l'avantage). */
export const sceneStudio = (image: string): Scene => {
  if (!estFond(image)) throw new Error(`sceneStudio : ${image} n'est pas un visuel de public/bola-plus/`);
  return { fond: image, x: 50, y: 60, zoom: 1.2, pose: "vise" };
};

/** Les ballons de Bola Plus, chaque mois, aux deux formules. */
export const BALLONS_PAR_MOIS = 300;
/** Les ballons offerts en plus à l'annuel. */
export const OFFERTS_ANNUEL = 1000;

/** Le catalogue (prix proposés le 14/11, à valider par Sabri). */
export const TEMPLATES: readonly Template[] = [
  {
    id: "carte-en-vrai",
    nom: "Ma carte en vrai",
    recoit: "Toi en photo studio, ta carte en main",
    rendu: { genre: "image" },
    prix: 49,
    modele: null,
    credits: null,
    scene: { fond: "cadeaux", x: 50, y: 62, zoom: 1.35, pose: "tenue" },
  },
  {
    id: "maillot-a-ton-nom",
    nom: "Maillot à ton nom",
    recoit: "Toi en maillot Bola, nom et numéro, dans le stade Olympe",
    rendu: { genre: "image" },
    prix: 49,
    modele: null,
    credits: null,
    // Le maillot noir seul, de près (ni nom ni numéro : à générer, voir le compte rendu).
    scene: { fond: "maillots", x: 32, y: 44, zoom: 2.2, pose: "fond" },
  },
  {
    id: "une-du-dimanche",
    nom: "La Une du dimanche",
    recoit: "Ta couverture façon magazine, avec ton titre du jour",
    rendu: { genre: "image" },
    prix: 79,
    modele: null,
    credits: null,
    scene: { fond: "affiche", x: 50, y: 40, zoom: 1.15, pose: "une" },
  },
  {
    id: "affiche-du-match",
    nom: "L'affiche du match",
    recoit: "Les deux équipes, l'heure et le terrain",
    rendu: { genre: "image" },
    prix: 99,
    modele: null,
    credits: null,
    scene: { fond: "affiche", x: 50, y: 58, zoom: 1.25, pose: "affiche" },
  },
  {
    id: "celebration",
    nom: "La célébration",
    recoit: "Ta célébration de but",
    rendu: { genre: "video", secondes: 5 },
    prix: 199,
    modele: null,
    credits: null,
    scene: { fond: "ceremonies", x: 50, y: 66, zoom: 1.5, pose: "podium" },
  },
  {
    id: "trash-talk",
    nom: "Trash talk",
    recoit: "Tu provoques l'adversaire avant le match",
    rendu: { genre: "video", secondes: 5 },
    prix: 299,
    modele: null,
    credits: null,
    scene: { fond: "affiche", x: 50, y: 62, zoom: 1.6, pose: "provoc" },
  },
  {
    id: "sorti-de-la-carte",
    nom: "Sorti de la carte",
    recoit: "Tu sors de ta carte et tu entres sur le terrain",
    rendu: { genre: "video", secondes: 5 },
    prix: 299,
    modele: null,
    credits: null,
    scene: { fond: "affiche", x: 50, y: 70, zoom: 1.3, pose: "sortie" },
  },
  {
    id: "option-hd",
    nom: "Option HD",
    recoit: "Le même rendu en 720p",
    rendu: { genre: "video", secondes: 5 },
    supplement: true,
    prix: 399,
    modele: null,
    credits: null,
    scene: { fond: "matchs-filmes", x: 54, y: 46, zoom: 1.4, pose: "fond" },
  },
  {
    id: "ta-saison",
    nom: "Ta saison",
    recoit: "Trois plans et tes stats de la saison",
    rendu: { genre: "video", secondes: 15 },
    prix: 499,
    modele: null,
    credits: null,
    scene: { fond: "affiche", x: 50, y: 50, zoom: 1, pose: "trois" },
  },
  {
    id: "entree",
    nom: "L'entrée",
    recoit: "Ta sortie du tunnel dans le stade Olympe",
    rendu: { genre: "video", secondes: 10 },
    prix: 599,
    modele: null,
    credits: null,
    scene: { fond: "affiche", x: 50, y: 52, zoom: 1.05, pose: "loin" },
  },
  {
    id: "but-de-ta-journee",
    nom: "Le but de ta journée",
    recoit: "Ton but rejoué d'après la feuille de match",
    rendu: { genre: "video", secondes: 10 },
    prix: 599,
    modele: null,
    credits: null,
    scene: { fond: "affiche", x: 50, y: 78, zoom: 1.5, pose: "ballon" },
  },
  {
    id: "convocation",
    nom: "Convocation d'équipe",
    recoit: "La compo de ta Bola Team en vidéo, payée par le capitaine",
    rendu: { genre: "video", secondes: 10 },
    prix: 599,
    modele: null,
    credits: null,
    scene: { fond: "ceremonies", x: 50, y: 40, zoom: 1.2, pose: "rang" },
  },
];

/** L'espace fine insécable des milliers (« 1 000 ») ; l'espace insécable, plus large, pour les chiffres en Anton. */
export const ESPACE_FINE = "\u202f";
export const ESPACE_LARGE = "\u00a0";

/**
 * Un nombre de ballons écrit comme dans l'app : 1000 → « 1 000 » (espace fine
 * insécable). En Anton, l'espace fine disparaît après un « 1 » (« 1 100 » se
 * lit « 1100 ») : les tuiles en Anton passent ESPACE_LARGE.
 */
export function ballons(n: number, espace: string = ESPACE_FINE): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`ballons : ${n} n'est pas un nombre de ballons`);
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, espace);
}

/** Le prix d'un template : « 49 ⚽ », ou « +399 ⚽ » pour un supplément. */
export const prixDe = (t: Template) => `${t.supplement ? "+" : ""}${ballons(t.prix)} ⚽`;

/** Le rendu d'un template : « Image », « 5 s », ou « +5 s » pour un supplément. */
export const dureeDe = (t: Template) => (t.rendu.genre === "image" ? "Image" : `${t.supplement ? "+" : ""}${t.rendu.secondes} s`);

/** Un template par son id (le banc et la phrase des ballons inclus). */
export function template(id: string): Template {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`template inconnu : ${id}`);
  return t;
}

const LETTRES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"];

/** Une quantité : « un trash talk », « une image », « six images », ou « 20 images » en chiffres. */
function quantite(n: number, mot: string, feminin: boolean, chiffres: boolean): string {
  const nombre = chiffres ? String(n) : n === 1 && feminin ? "une" : LETTRES[n];
  return `${nombre} ${mot}${n > 1 ? "s" : ""}`;
}

/**
 * Ce que les ballons du mois paient : « un trash talk ou six images ». Le
 * nombre de trash talks, et le nombre d'images les moins chères, qui tiennent
 * dans `budget` ballons (division entière : jamais plus que ce qu'on peut
 * vraiment payer). Une quantité nulle ne s'écrit pas (« une image » seule
 * quand le trash talk ne tient pas) ; si rien ne tient, c'est une erreur, et
 * le banc la voit. Les nombres s'écrivent en lettres jusqu'à douze, sinon
 * tous en chiffres : jamais « trois trash talks ou 20 images ».
 */
export function equivalence(budget: number, catalogue: readonly Template[] = TEMPLATES): string {
  const trash = catalogue.find((t) => t.id === "trash-talk");
  const images = catalogue.filter((t) => t.rendu.genre === "image" && !t.supplement);
  if (!trash || !images.length) throw new Error("equivalence : il faut le trash talk et au moins une image");
  const parts = [
    { n: Math.floor(budget / trash.prix), mot: "trash talk", feminin: false },
    { n: Math.floor(budget / Math.min(...images.map((t) => t.prix))), mot: "image", feminin: true },
  ].filter((p) => p.n > 0);
  if (!parts.length) throw new Error(`equivalence : ${budget} ballons ne paient rien`);
  const chiffres = parts.some((p) => p.n >= LETTRES.length);
  return parts.map((p) => quantite(p.n, p.mot, p.feminin, chiffres)).join(" ou ");
}

/** « 300 ⚽ = un trash talk ou six images » : en tête du rail. */
export const PHRASE_INCLUS = `${ballons(BALLONS_PAR_MOIS)} ⚽ = ${equivalence(BALLONS_PAR_MOIS)}`;

/** Les ballons de chaque formule, sous son prix. */
export const BALLONS_FORMULE = {
  mensuel: `${ballons(BALLONS_PAR_MOIS)} ⚽ / mois`,
  // « offerts » ne part jamais seul à la ligne (320 px) : espace insécable avant.
  annuel: `${ballons(BALLONS_PAR_MOIS)} ⚽ / mois + ${ballons(OFFERTS_ANNUEL)} ⚽ offerts`,
} as const;

/** L'avantage « Ton studio » de Bola Plus : « 300 ⚽ / mois ». */
export const MENTION_STUDIO = BALLONS_FORMULE.mensuel;

/** Une recharge de ballons : son prix en centimes entiers et ce qu'elle donne. */
export interface RechargeStudio {
  centimes: number;
  ballons: number;
}

/** Les recharges proposées (« Bientôt » : rien ne s'achète encore). */
export const RECHARGES_STUDIO: readonly RechargeStudio[] = [
  { centimes: 499, ballons: 500 },
  { centimes: 999, ballons: 1100 },
  { centimes: 1999, ballons: 2400 },
];

/** Les ballons qu'une recharge donnerait au taux de base (1 ballon = 1 centime). */
export const ballonsAuTaux = (centimes: number) => (centimes * BALLONS_PAR_EURO) / 100;

/** Ce qu'une recharge donne au-delà du taux de base. */
export const bonusDe = (r: RechargeStudio) => r.ballons - ballonsAuTaux(r.centimes);

/** Le prix d'une recharge : « 4,99 », affiché suivi de « € ». */
export const prixRecharge = (r: RechargeStudio) => montant(r.centimes);
