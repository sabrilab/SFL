// Bola Studio : les images et les vidéos de foot qu'un joueur crée à partir
// de sa carte et de ses matchs, payées en ballons (demande de Sabri,
// 14/11/2026, bola-app#22 : « on va proposer d'acheter des contenus vidéo ou
// des images […] il faut inclure ça dans un calcul avec leur abonnement,
// parce qu'on va leur donner des ballons »). La page Bola Plus le MONTRE
// seulement (components/sfl/studio-bola.tsx) : aucun achat, aucun porte-
// monnaie touché, aucun appel à un service de génération.
//
// La seule source du studio : les douze templates, leurs prix et leurs
// vignettes, les ballons de l'abonnement, les recharges. Les prix ne sont pas
// encore validés par Sabri : ils se changent ICI, et seulement ici
// (tools/studio-check.ts).
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
// La vignette de chaque template : une vraie image (retour de Sabri du
// 15/11/2026 sur bola-app#22, « les vraies vignettes des 12 modèles »). Le
// 16/11, Sabri a trouvé les vignettes noir et blanc « pas engageantes » : les
// douze ont été refaites hors de l'app, en couleur, avec l'avatar d'Ilyes
// (son accord pour ces images date du 15/11), le tiers bas sombre et vide.
// Elles sont dans public/bola-plus/studio/, numérotées dans l'ordre du
// catalogue (« 01-ma-carte-en-vrai.webp »), en 4:5 : 896 × 1120, le fichier
// fourni tel quel ; à côté de chacune, sa copie plus légère pour le rail
// (« 01-ma-carte-en-vrai-660.webp », 660 × 825 : les proportions de
// l'original, et le suffixe de largeur de public/bola-plus/). Les deux se
// refont depuis les fichiers fournis
// (tools/studio-vignettes.py) ; leurs empreintes sont dans
// tools/studio-check.ts : un fichier échangé, teint ou retouché arrête le
// banc. Chaque template porte la sienne (Template.image).
// L'écran les montre telles quelles : en 4:5, jamais recadrées en carré, ni
// grossies, ni teintes (leurs couleurs sont celles des images), ni animées ;
// il écrit le nom du modèle et son prix en ballons sur leur tiers bas. Elles
// remplacent les vignettes noir et blanc du 15/11, qui remplaçaient les
// vignettes composées du 14/11 (un visuel de Bola Plus recadré et teint en
// violet, la carte « Toi » posée dessus).
// La carte « Ton studio » du carrousel Bola Plus montre trois de ces
// templates en éventail (EVENTAIL_STUDIO) : la carte en vrai au milieu, la
// seule entière, avec son nom et son prix ; de chaque côté, une image dont
// le sujet dépasse.
//
// Pur : ni React ni réseau.

import { BALLONS_PAR_EURO } from "./ballons";
import { montant } from "./bola-plus";

/** Une image fixe, ou une vidéo de tant de secondes. */
export type Rendu = { genre: "image" } | { genre: "video"; secondes: number };

/**
 * Les vignettes (public/bola-plus/studio/) : leur rapport hauteur sur largeur
 * (4:5), la largeur du fichier d'origine (l'image fournie) et celle de sa
 * copie légère.
 */
export const VIGNETTE = { rapport: 5 / 4, largeur: 896, legere: 660 } as const;

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
  /** Sa vignette : son fichier dans public/bola-plus/studio/, sans l'extension (« 01-ma-carte-en-vrai »). */
  image: string;
}

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
    image: "01-ma-carte-en-vrai",
  },
  {
    id: "maillot-a-ton-nom",
    nom: "Maillot à ton nom",
    recoit: "Toi en maillot Bola, nom et numéro, dans le stade Olympe",
    rendu: { genre: "image" },
    prix: 49,
    modele: null,
    credits: null,
    image: "02-maillot-a-ton-nom",
  },
  {
    id: "une-du-dimanche",
    nom: "La Une du dimanche",
    recoit: "Ta couverture façon magazine, avec ton titre du jour",
    rendu: { genre: "image" },
    prix: 79,
    modele: null,
    credits: null,
    image: "03-la-une-du-dimanche",
  },
  {
    id: "affiche-du-match",
    nom: "L'affiche du match",
    recoit: "Les deux équipes, l'heure et le terrain",
    rendu: { genre: "image" },
    prix: 99,
    modele: null,
    credits: null,
    image: "04-l-affiche-du-match",
  },
  {
    id: "celebration",
    nom: "La célébration",
    recoit: "Ta célébration de but",
    rendu: { genre: "video", secondes: 5 },
    prix: 199,
    modele: null,
    credits: null,
    image: "05-la-celebration",
  },
  {
    id: "trash-talk",
    nom: "Trash talk",
    recoit: "Tu provoques l'adversaire avant le match",
    rendu: { genre: "video", secondes: 5 },
    prix: 299,
    modele: null,
    credits: null,
    image: "06-trash-talk",
  },
  {
    id: "sorti-de-la-carte",
    nom: "Sorti de la carte",
    recoit: "Tu sors de ta carte et tu entres sur le terrain",
    rendu: { genre: "video", secondes: 5 },
    prix: 299,
    modele: null,
    credits: null,
    image: "07-sorti-de-la-carte",
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
    image: "08-option-hd",
  },
  {
    id: "ta-saison",
    nom: "Ta saison",
    recoit: "Trois plans et tes stats de la saison",
    rendu: { genre: "video", secondes: 15 },
    prix: 499,
    modele: null,
    credits: null,
    image: "09-ta-saison",
  },
  {
    id: "entree",
    nom: "L'entrée",
    recoit: "Ta sortie du tunnel dans le stade Olympe",
    rendu: { genre: "video", secondes: 10 },
    prix: 599,
    modele: null,
    credits: null,
    image: "10-l-entree",
  },
  {
    id: "but-de-ta-journee",
    nom: "Le but de ta journée",
    recoit: "Ton but rejoué d'après la feuille de match",
    rendu: { genre: "video", secondes: 10 },
    prix: 599,
    modele: null,
    credits: null,
    image: "11-le-but-de-ta-journee",
  },
  {
    id: "convocation",
    nom: "Convocation d'équipe",
    recoit: "La compo de ta Bola Team en vidéo, payée par le capitaine",
    rendu: { genre: "video", secondes: 10 },
    prix: 599,
    modele: null,
    credits: null,
    image: "12-convocation-d-equipe",
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

/**
 * L'adresse de la vignette d'un template : son fichier d'origine, ou sa copie
 * légère (« …-660.webp »).
 */
export const fichierVignette = (t: Template, largeur: number = VIGNETTE.largeur) =>
  `/bola-plus/studio/${t.image}${largeur === VIGNETTE.largeur ? "" : `-${largeur}`}.webp`;

/** Le srcset d'une vignette : sa copie légère, puis l'original. */
export const sourcesVignette = (t: Template) =>
  `${fichierVignette(t, VIGNETTE.legere)} ${VIGNETTE.legere}w, ${fichierVignette(t)} ${VIGNETTE.largeur}w`;

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

/** « 300 ⚽ = un trash talk ou six images » : en tête du panneau Bola Studio. */
export const PHRASE_INCLUS = `${ballons(BALLONS_PAR_MOIS)} ⚽ = ${equivalence(BALLONS_PAR_MOIS)}`;

/** Les ballons de chaque formule, sous son prix. */
export const BALLONS_FORMULE = {
  mensuel: `${ballons(BALLONS_PAR_MOIS)} ⚽ / mois`,
  // « offerts » ne part jamais seul à la ligne (320 px) : espace insécable avant.
  annuel: `${ballons(BALLONS_PAR_MOIS)} ⚽ / mois + ${ballons(OFFERTS_ANNUEL)} ⚽ offerts`,
} as const;

/** La carte « Ton studio » du carrousel, sous son titre : « 300 ⚽ / mois ». */
export const MENTION_STUDIO = BALLONS_FORMULE.mensuel;

/**
 * Les trois templates de l'éventail de « Ton studio » : à gauche, au milieu,
 * à droite. Au milieu, « Ma carte en vrai » : la seule vignette entière, elle
 * porte son nom et son prix. Les deux autres, penchées, sont à demi cachées
 * par elle : on y met une image dont le sujet est du côté qui dépasse. À
 * gauche, Le but de ta journée (le ballon dans le filet, à gauche de
 * l'image) ; à droite, Ta saison (le poing levé, à droite). Maillot à ton
 * nom, dont le maillot est au centre de l'image, n'y montrait qu'une colonne
 * (contrôle visuel du 15/11) : il reste dans le rail.
 */
export const EVENTAIL_STUDIO = ["but-de-ta-journee", "carte-en-vrai", "ta-saison"] as const;

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
