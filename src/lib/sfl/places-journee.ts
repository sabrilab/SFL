// Les places des joueurs sur le terrain d'une journée (carte-journee.tsx),
// calculées sans React : où poser chaque carte debout pour qu'aucune ne cache
// la carte ou le nom d'une autre.
//
// Sabri, 23/10 : « veillez à ne pas faire de superpositions qui seraient
// incohérentes ». Les terrains des journées rangeaient chaque équipe en trois
// lignes (défense, milieu, attaque) trop proches l'une de l'autre : la carte
// de devant cachait le nom, souvent la note, de celle de derrière. Ici,
// chaque équipe tient en deux rangs au plus, la défense puis l'attaque, plus
// son gardien. Chaque rang reste tout entier sous le précédent, étiquette
// comprise ; au fond, l'attaque garde les pieds au-dessus du rond central, et
// l'équipe de devant commence sous les pieds de celle du fond. Devant un
// gardien, deux défenseurs écartés lui laissent le milieu ; le meilleur de
// l'équipe se tient au milieu de son rang. Les étiquettes d'un rang se
// partagent sa largeur : chacune a droit à l'écart entre deux cartes, et un
// prénom long prend en plus ce que ses voisines, plus courtes, laissent de
// leur part, sans sortir du terrain d'un téléphone ; au-delà, il s'abrège.
// Quand la place manque (une équipe très nombreuse), toutes les cartes
// rapetissent un peu plutôt que de se toucher.
// Vérifié de 1 à 10 joueurs par équipe, avec ou sans gardien, prénoms courts
// et longs, par tools/places-journee-check.ts.

import { projeter, vue, type Vue } from "@/lib/sfl/terrain-vu";

/**
 * Le point de vue des terrains de la Ligue : plus court que celui de la
 * feuille de match (500 px au lieu de 540) et moins couché (38° au lieu de
 * 56°), pour que les rangs de cartes debout s'étagent au lieu de s'empiler
 * (Sabri, 19/10 : « le terrain est un peu trop grand »).
 */
export const VUE_JOURNEE: Vue = vue(270, 500, 38);

const PHI = (1 + Math.sqrt(5)) / 2;
/**
 * Les deux tailles du terrain, toutes deux en carte debout (la photo, la
 * note dans l'onglet de l'équipe) : le meilleur de l'équipe n'est qu'un cran
 * au-dessus des autres (×1,15), pas un autre format (Sabri, 19/10 : « mettre
 * en avant, mais ne pas abuser » ; « on préfère le format vertical »).
 */
export const PASTILLE = 50 / 254; // 50 × 81 px à l'échelle 1
export const VEDETTE = 58 / 254; // 58 × 94 px
/** Sous la carte : l'écart, puis l'étiquette du prénom, en px à l'échelle 1. */
const ECART = 4;
const ETIQUETTE = 17;
/** La hauteur d'une carte debout et de son étiquette, à l'échelle 1. */
export const hauteurCarte = (taille: number) => 254 * taille * PHI + ECART + ETIQUETTE;

/** L'air entre deux rangs d'une équipe, et entre les deux équipes, en px. */
const AIR = 4;
const AIR_EQUIPES = 10;
/** Le rond central (sol-terrain.tsx) : les pieds du fond restent au-dessus. */
const RAYON = 43.5;
const { l: L, h: H } = VUE_JOURNEE;
const MILIEU = L / 2;
const MI = H / 2;
/** Le gardien, à 16 unités de sa ligne de fond. */
const GARDIEN = 16;
/** Les pieds les plus proches de l'œil : la ligne de but de devant. */
const BORD = H - 13;
/** L'écart entre deux cartes d'un rang de n cartes, en unités du terrain. */
const ECARTS: Record<number, number> = { 1: 0, 2: 110, 3: 92, 4: 74, 5: 56, 6: 46, 7: 40 };
/** Devant le gardien : deux défenseurs de part et d'autre, assez loin pour son étiquette. */
const ECART_DEVANT_GARDIEN = 176;
/** La part d'une étiquette dans un rang, et celle d'une carte seule dans son rang, à l'échelle 1. */
const ETIQUETTE_MAX = 84;
const ETIQUETTE_SEULE = 120;
/** L'air entre deux étiquettes voisines, en unités du terrain. */
const AIR_ETIQUETTES = 6;
/** Entre le gardien et la carte d'un de ses défenseurs, en unités du terrain. */
const AIR_GARDIEN = 4;
/**
 * La moitié du terrain dessiné sur un téléphone de 375 px (301 px de large),
 * en px : les étiquettes d'un rang, même près de l'œil où tout s'élargit,
 * tiennent dedans.
 */
const CADRE = 150;

export interface EquipeAPlacer {
  /** Combien de joueurs, rangés du plus défensif au plus offensif (le gardien d'abord). */
  nombre: number;
  gardien: boolean;
  /** Le rang du meilleur de l'équipe dans cet ordre, posé en VEDETTE (−1 : aucun). */
  vedette: number;
  /** La largeur que prendrait l'étiquette de chacun, entière, à l'échelle 1 (sans : sa part). */
  etiquettes?: number[];
}

export interface PlaceJournee {
  /** 0 : l'équipe du fond ; 1 : celle de devant. */
  equipe: 0 | 1;
  /** Le joueur, dans l'ordre de son équipe. */
  i: number;
  /** Sur le terrain couché. */
  u: number;
  v: number;
  /** À l'écran, depuis le milieu du cadre et le haut du terrain projeté. */
  x: number;
  y: number;
  /** L'échelle de la carte : la perspective, et la réduction quand c'est serré. */
  k: number;
  taille: number;
  /** La largeur que peut prendre son étiquette sans toucher sa voisine, à l'échelle 1. */
  etiquette: number;
}

export interface DispositionJournee {
  places: PlaceJournee[];
  /** Le haut et le bas de ce qu'on montre (cartes debout, terrain et son épaisseur), dans le repère du terrain projeté. */
  haut: number;
  bas: number;
  /** La réduction appliquée à toutes les cartes (1 : aucune). */
  reduction: number;
}

interface Rang {
  n: number;
  ecart: number;
  /** La défense qui encadre le gardien. */
  devantGardien?: boolean;
}

/** Les rangs de champ d'une équipe, de son but vers la médiane : la défense, puis l'attaque. */
function rangs(champ: number, gardien: boolean): Rang[] {
  const defense = gardien ? (champ >= 3 ? 2 : 0) : Math.ceil(champ / 2);
  const attaque = champ - defense;
  const out: Rang[] = [];
  if (defense > 0) out.push(gardien ? { n: defense, ecart: ECART_DEVANT_GARDIEN, devantGardien: true } : { n: defense, ecart: ECARTS[defense] ?? 36 });
  if (attaque > 0) out.push({ n: attaque, ecart: ECARTS[attaque] ?? 36 });
  return out;
}

interface AEtiqueter {
  u: number;
  x: number;
  k: number;
  /** La largeur que prendrait son étiquette entière. */
  voulue?: number;
  /** Ce qu'elle ne dépasse jamais. */
  plafond: number;
}

/**
 * Les largeurs des étiquettes d'une rangée, de gauche à droite. Chacune a
 * droit à sa part : l'écart avec ses voisines moins un peu d'air, au plus
 * ETIQUETTE_MAX. Une étiquette plus longue que sa part prend en plus ce
 * qu'une voisine plus courte laisse de la sienne (deux voisines longues se
 * partagent l'écart), sans dépasser CADRE ni son plafond. Deux étiquettes
 * voisines ne prennent jamais, à elles deux, plus que deux fois leur écart.
 */
function partager(r: AEtiqueter[]): number[] {
  const ecart = (a: number, b: number) => Math.abs(r[b].u - r[a].u) - AIR_ETIQUETTES;
  const voisines = (j: number) => [j - 1, j + 1].filter((m) => m >= 0 && m < r.length);
  const part = r.map((c, j) => Math.min(c.plafond, r.length > 1 ? ETIQUETTE_MAX : ETIQUETTE_SEULE, ...voisines(j).map((m) => ecart(j, m))));
  const voulue = r.map((c, j) => c.voulue ?? part[j]);
  const longue = (j: number) => voulue[j] > part[j];
  const largeur = r.map((c, j) => {
    if (!longue(j)) return part[j];
    const cadre = (2 * (CADRE - Math.abs(c.x))) / c.k;
    const cote = voisines(j).map((m) => (longue(m) ? ecart(j, m) : 2 * ecart(j, m) - voulue[m]));
    return Math.max(part[j], Math.min(voulue[j], c.plafond, cadre, ...cote));
  });
  // Une courte garde sa part, moins ce qu'une voisine longue lui a pris.
  return largeur.map((l, j) => (longue(j) ? l : Math.min(l, ...voisines(j).map((m) => 2 * ecart(j, m) - largeur[m]))));
}


const yDe = (v: number) => projeter(MILIEU, v, 0, VUE_JOURNEE).y;
const kDe = (v: number) => projeter(MILIEU, v, 0, VUE_JOURNEE).k;

/**
 * Le plus grand écart entre les n cartes d'un rang dont les étiquettes, à
 * leur part, tiennent dans CADRE : près de l'œil (perspective kp, cartes
 * réduites de r), un rang de trois se resserre un peu.
 */
function ecartQuiTient(n: number, kp: number, r: number): number {
  if (n < 2) return Infinity;
  const e = (CADRE / kp + (AIR_ETIQUETTES / 2) * r) / ((n - 1 + r) / 2);
  return e - AIR_ETIQUETTES <= ETIQUETTE_MAX ? e : (CADRE / kp - (ETIQUETTE_MAX / 2) * r) / ((n - 1) / 2);
}

/** Le plus grand v de [de, a] dont les pieds restent au-dessus de y0, ou null. */
function piedsAuDessus(y0: number, de: number, a: number): number | null {
  if (yDe(de) > y0) return null;
  if (yDe(a) <= y0) return a;
  let lo = de;
  let hi = a;
  for (let n = 0; n < 40; n++) {
    const m = (lo + hi) / 2;
    if (yDe(m) <= y0) lo = m;
    else hi = m;
  }
  return lo;
}

/** Le plus petit v de [de, a] dont le haut d'une carte (h px à l'échelle 1) reste sous y0, ou null. */
function hautEnDessous(y0: number, h: number, de: number, a: number): number | null {
  const haut = (v: number) => yDe(v) - h * kDe(v);
  if (haut(a) < y0) return null;
  if (haut(de) >= y0) return de;
  let lo = de;
  let hi = a;
  for (let n = 0; n < 40; n++) {
    const m = (lo + hi) / 2;
    if (haut(m) >= y0) hi = m;
    else lo = m;
  }
  return hi;
}

/** Les places des deux équipes à la réduction r, ou null si elles ne tiennent pas. */
function disposer(fond: EquipeAPlacer, devant: EquipeAPlacer, r: number): PlaceJournee[] | null {
  // Chaque rang compte la carte la plus haute, la vedette.
  const h = hauteurCarte(VEDETTE) * r;
  const rf = rangs(fond.nombre - (fond.gardien ? 1 : 0), fond.gardien);
  const rd = rangs(devant.nombre - (devant.gardien ? 1 : 0), devant.gardien);

  // Le fond, de la médiane vers son but : l'attaque, les pieds au-dessus du
  // rond central ; la défense, les pieds juste au-dessus de l'attaque.
  const vFond: number[] = [];
  for (let c = rf.length - 1; c >= 0; c--) {
    const v =
      c === rf.length - 1 ? MI - RAYON - AIR : piedsAuDessus(yDe(vFond[c + 1]) - h * kDe(vFond[c + 1]) - AIR, 0, vFond[c + 1]);
    if (v == null || v < GARDIEN + 6) return null;
    vFond[c] = v;
  }

  // Devant, de la médiane vers son but : l'attaque sous les pieds du fond,
  // la défense sous l'attaque, sans passer la ligne de but.
  const vDevant: number[] = [];
  let dessous = Math.max(fond.gardien ? yDe(GARDIEN) : -Infinity, ...vFond.map(yDe)) + AIR_EQUIPES;
  let de = MI + AIR;
  for (let c = rd.length - 1; c >= 0; c--) {
    const v = hautEnDessous(dessous, h, de, BORD);
    if (v == null) return null;
    vDevant[c] = v;
    dessous = yDe(v) + AIR;
    de = v;
  }

  const places: PlaceJournee[] = [];
  // Les cartes dont les étiquettes se partagent une même largeur : chaque
  // rang, et le gardien avec la défense qui l'encadre.
  const rangees: number[][] = [];
  const poser = (equipe: 0 | 1, e: EquipeAPlacer, i: number, u: number, v: number) => {
    const p = projeter(u, v, 0, VUE_JOURNEE);
    places.push({ equipe, i, u, v, x: p.x, y: p.y, k: p.k * r, taille: i === e.vedette ? VEDETTE : PASTILLE, etiquette: 0 });
    return places.length - 1;
  };
  const equipe = (n: 0 | 1, e: EquipeAPlacer, lignes: Rang[], vs: number[]) => {
    let i = 0;
    const gardien = e.gardien ? poser(n, e, i++, MILIEU, n === 0 ? GARDIEN : H - GARDIEN) : -1;
    if (gardien >= 0 && !lignes[0]?.devantGardien) rangees.push([gardien]);
    lignes.forEach((ligne, c) => {
      const joueurs = Array.from({ length: ligne.n }, () => i++);
      // Le meilleur de l'équipe au milieu de son rang, quand le rang a un milieu.
      const m = joueurs.indexOf(e.vedette);
      const milieu = (ligne.n - 1) / 2;
      if (m >= 0 && ligne.n % 2 === 1) [joueurs[m], joueurs[milieu]] = [joueurs[milieu], joueurs[m]];
      // La défense qui encadre le gardien partage ses étiquettes avec lui, comme un rang de trois.
      const ecart = ligne.devantGardien
        ? Math.min(ligne.ecart, 2 * ecartQuiTient(3, kDe(vs[c]), r))
        : Math.min(ligne.ecart, ecartQuiTient(ligne.n, kDe(vs[c]), r));
      const rangee = joueurs.map((joueur, j) => poser(n, e, joueur, MILIEU + (j - milieu) * ecart, vs[c]));
      if (ligne.devantGardien) rangee.splice(1, 0, gardien);
      rangees.push(rangee);
    });
  };
  equipe(0, fond, rf, vFond);
  equipe(1, devant, rd, vDevant);
  for (const rangee of rangees) {
    const largeurs = partager(
      rangee.map((q, j) => {
        const p = places[q];
        const e = p.equipe === 0 ? fond : devant;
        // Le gardien entre ses défenseurs : son étiquette ne touche pas leurs cartes.
        const gardien = e.gardien && p.i === 0 && rangee.length > 1;
        const plafond = gardien ? 2 * (Math.abs(places[rangee[j + 1]].u - p.u) - (254 * VEDETTE) / 2 - AIR_GARDIEN) : ETIQUETTE_SEULE;
        return { u: p.u, x: p.x, k: p.k, voulue: e.etiquettes?.[p.i], plafond };
      }),
    );
    rangee.forEach((q, j) => (places[q].etiquette = largeurs[j]));
  }
  return places;
}

interface Boite {
  gauche: number;
  droite: number;
  haut: number;
  bas: number;
}

/** Ce qu'une carte posée couvre à l'écran : la carte, puis son étiquette dessous. */
export function boitesDe(p: PlaceJournee): [Boite, Boite] {
  const l = 254 * p.taille * p.k;
  const bas = p.y - (ECART + ETIQUETTE) * p.k;
  return [
    { gauche: p.x - l / 2, droite: p.x + l / 2, haut: bas - l * PHI, bas },
    { gauche: p.x - (p.etiquette * p.k) / 2, droite: p.x + (p.etiquette * p.k) / 2, haut: p.y - ETIQUETTE * p.k, bas: p.y },
  ];
}

const touche = (a: Boite, b: Boite) => a.gauche < b.droite && b.gauche < a.droite && a.haut < b.bas && b.haut < a.bas;

/** Deux cartes posées qui se touchent (carte ou étiquette), s'il y en a. */
export function chevauchement(places: PlaceJournee[]): [PlaceJournee, PlaceJournee] | null {
  const boites = places.map(boitesDe);
  for (let a = 0; a < places.length; a++)
    for (let b = a + 1; b < places.length; b++)
      if (boites[a].some((x) => boites[b].some((y) => touche(x, y)))) return [places[a], places[b]];
  return null;
}

/** Les places d'une journée : l'équipe A au fond, l'équipe B devant. */
export function placerJournee(fond: EquipeAPlacer, devant: EquipeAPlacer): DispositionJournee {
  let places: PlaceJournee[] = [];
  let reduction = 1;
  for (let r = 1; r >= 0.6; r = Math.round((r - 0.02) * 100) / 100) {
    const essai = disposer(fond, devant, r);
    if (!essai) continue;
    places = essai;
    reduction = r;
    if (!chevauchement(essai)) break;
  }
  const haut = Math.min(projeter(0, 0, 0, VUE_JOURNEE).y, ...places.map((p) => p.y - hauteurCarte(p.taille) * p.k));
  const bas = Math.max(projeter(MILIEU, H, -14, VUE_JOURNEE).y, ...places.map((p) => p.y));
  return { places, haut, bas, reduction };
}
