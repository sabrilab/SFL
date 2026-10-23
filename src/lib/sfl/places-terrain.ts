// Les places d'un match sur son terrain (terrain-places.tsx), calculées sans
// React : où poser chaque carte debout pour qu'aucune n'en touche une autre.
//
// Sabri, 23/10 : en ouvrant un match, les + se chevauchaient : sur le rond
// central et le logo, entre deux rangs trop proches, et jusqu'à s'empiler à
// 22 places. Ici, chaque moitié se range en trois rangs au plus (le gardien,
// puis deux rangs de cinq places au plus), étagés du but vers la médiane.
// Chaque rang reste tout entier sous le précédent (étiquette comprise), le
// rang le plus avancé laisse libres le logo et la ligne du rond central (deux
// cartes de part et d'autre du rond jusqu'à 16 joueurs), et quand une moitié
// manque de place, toutes les cartes rapetissent un peu plutôt que de se
// toucher.
// Quand la place ne manque pas, les rangs s'écartent vers leur poste
// (IDEAL) : le gardien au but, la défense, l'attaque.
//
// La vue est moins couchée que celle de la feuille de match (42° au lieu de
// 56°), comme les terrains de la Ligue : les rangs de cartes debout s'étagent
// au lieu de s'empiler. Le cadre épouse ce qu'il montre (haut, bas).
// Vérifié de 2 à 22 joueurs par tools/places-terrain-check.ts.

import { projeter, vue, type Vue } from "@/lib/sfl/terrain-vu";

export const VUE_PLACES: Vue = vue(270, 540, 42);

/** Une carte debout, à l'échelle 1 : la pastille, l'écart, l'étiquette du prénom. */
export const PASTILLE = 42;
const ECART = 4;
const ETIQUETTE = 19;
/** Ma carte est cerclée : 3 px de blanc et 2 px de sombre de chaque côté. */
export const CERCLE = 10;
/** Des pieds au haut de la pastille. */
const hauteurCarte = (moi: boolean) => PASTILLE + (moi ? CERCLE : 0) + ECART + ETIQUETTE;

/** L'air entre deux rangs, et autour du logo du rond central, en px. */
const AIR = 5;
/** Le logo du rond central : 46 unités de côté. */
const LOGO = 23;
/** Le rond central (sol-terrain.tsx) : aucune carte ne mord sur sa ligne. */
const RAYON = 43.5;
/** L'air entre une carte et la ligne du rond, en px. */
const AIR_ROND = 3;
/** Les pieds d'un gardien : jamais au-delà de sa ligne de but. */
const FOND_MIN = 10;
/** La ligne de but, à 11 unités du bout du terrain (sol-terrain.tsx). */
const LIGNE = 11;

/**
 * Les rangs d'une moitié, du but vers la médiane : le gardien seul, puis deux
 * rangs au plus. Le rang le plus avancé garde deux cartes tant que l'autre en
 * prend cinq au plus : deux cartes s'écartent de part et d'autre du rond
 * central, une carte au milieu devrait reculer sous sa ligne.
 */
export function rangs(n: number): number[] {
  if (n <= 0) return [];
  const reste = n - 1;
  if (reste === 0) return [1];
  if (reste <= 2) return [1, reste];
  if (reste <= 7) return [1, reste - 2, 2];
  const derriere = Math.ceil(reste / 2);
  return [1, derriere, reste - derriere];
}

/** Le poste de chaque rang, du but vers la médiane, en part de la moitié depuis la médiane (1, la ligne de but). */
const IDEAL: Record<number, number[]> = { 1: [0.93], 2: [0.93, 0.5], 3: [0.93, 0.62, 0.3] };

/** La demi-largeur d'un rang, en part de la largeur : cinq cartes tiennent sans se toucher. */
const ETALEMENT = [0, 0, 0.22, 0.28, 0.33, 0.38];

/** Un rang de `c` cartes : la place de chacune, en part de la largeur, et la largeur de leur étiquette. */
function rang(c: number): { parts: number[]; etiquette: number } {
  const parts = Array.from({ length: c }, (_, q) => (c === 1 ? 0.5 : 0.5 + (q / (c - 1) - 0.5) * 2 * ETALEMENT[c]));
  const voisine = c === 1 ? VUE_PLACES.l : ((2 * ETALEMENT[c]) / (c - 1)) * VUE_PLACES.l;
  return { parts, etiquette: Math.min(88, voisine - 6) };
}

interface Boite {
  gauche: number;
  droite: number;
  haut: number;
  bas: number;
}

/** Ce qu'une carte couvre à l'écran : sa pastille, puis son étiquette sous elle. */
function boites(x: number, pieds: number, k: number, moi: boolean, etiquette: number): Boite[] {
  const cote = PASTILLE + (moi ? CERCLE : 0);
  const haut = pieds - hauteurCarte(moi) * k;
  return [
    { gauche: x - (cote / 2) * k, droite: x + (cote / 2) * k, haut, bas: haut + cote * k },
    { gauche: x - (etiquette / 2) * k, droite: x + (etiquette / 2) * k, haut: pieds - ETIQUETTE * k, bas: pieds },
  ];
}

export interface PlaceTerrain {
  /** L'ordre de remplissage : 0, l'organisateur (devant, dans les buts), puis une place sur deux de chaque côté. */
  i: number;
  /** Devant (ma moitié) ou au fond. */
  chezMoi: boolean;
  /** Sur le terrain couché. */
  u: number;
  v: number;
  /** À l'écran, depuis le centre du cadre et le haut du terrain projeté. */
  x: number;
  y: number;
  /** L'échelle de la carte : la perspective, et la réduction quand c'est serré. */
  k: number;
  /** La largeur que peut prendre son étiquette sans toucher sa voisine, à l'échelle 1. */
  etiquette: number;
}

export interface DispositionTerrain {
  places: PlaceTerrain[];
  /** Le haut et le bas de ce qu'on montre (cartes debout, terrain et son épaisseur), dans le repère du terrain projeté. */
  haut: number;
  bas: number;
  /** La réduction appliquée à toutes les cartes (1 : aucune). */
  reduction: number;
}

const MI = VUE_PLACES.h / 2;
const D_MAX = MI - FOND_MIN;
const yDe = (v: number) => projeter(VUE_PLACES.l / 2, v, 0, VUE_PLACES).y;
const kDe = (v: number) => projeter(VUE_PLACES.l / 2, v, 0, VUE_PLACES).k;

/** La ligne du rond central, projetée, en 72 points. */
const ROND = Array.from({ length: 72 }, (_, i) => {
  const t = (i / 72) * 2 * Math.PI;
  return projeter(VUE_PLACES.l / 2 + RAYON * Math.cos(t), MI + RAYON * Math.sin(t), 0, VUE_PLACES);
});

/** Une boîte que la ligne du rond traverse (à AIR_ROND près). */
const surLeRond = (b: Boite) =>
  ROND.some(
    (q) => q.x > b.gauche - AIR_ROND && q.x < b.droite + AIR_ROND && q.y > b.haut - AIR_ROND && q.y < b.bas + AIR_ROND
  );

/** Le plus petit d de [0, D_MAX] qui tient la condition (fausse puis vraie), ou null. */
function auPlusPres(tient: (d: number) => boolean): number | null {
  if (!tient(D_MAX)) return null;
  let lo = 0;
  let hi = D_MAX;
  if (tient(lo)) return lo;
  for (let n = 0; n < 32; n++) {
    const m = (lo + hi) / 2;
    if (tient(m)) hi = m;
    else lo = m;
  }
  return hi;
}

/** Le plus grand d de [0, D_MAX] qui tient la condition (vraie puis fausse), ou null. */
function auPlusLoin(tient: (d: number) => boolean): number | null {
  if (!tient(0)) return null;
  let lo = 0;
  let hi = D_MAX;
  if (tient(hi)) return hi;
  for (let n = 0; n < 32; n++) {
    const m = (lo + hi) / 2;
    if (tient(m)) lo = m;
    else hi = m;
  }
  return lo;
}

/**
 * Les rangs d'une moitié (`compte`, du but vers la médiane, comme `rangs`), à
 * la réduction r : leur distance à la médiane, du rang le plus avancé (c = 0)
 * au gardien, ou null s'ils ne tiennent pas. D'abord au plus serré, depuis la
 * médiane : le premier rang juste hors du logo et de la ligne du rond
 * central, chacun juste derrière le précédent. Puis, s'il reste de la place,
 * chaque rang recule vers son poste, du gardien vers la médiane, sans jamais
 * toucher son voisin. Au fond, le gardien garde sa pastille sur le terrain,
 * au lieu de flotter au-dessus de sa ligne de but.
 */
function moitie(compte: number[], chezMoi: boolean, r: number): number[] | null {
  const nbRangs = compte.length;
  const v = (d: number) => (chezMoi ? MI + d : MI - d);
  const pieds = (d: number) => yDe(v(d));
  // Le gardien de ma moitié, c'est ma carte, cerclée.
  const tete = (c: number, d: number) => pieds(d) - hauteurCarte(chezMoi && c === nbRangs - 1) * r * kDe(v(d));
  const logo = chezMoi ? yDe(MI + LOGO) + AIR : yDe(MI - LOGO) - AIR;
  // Le premier rang laisse libres le logo et la ligne du rond, carte par carte
  // (sa pastille : voir boitesDeCarte) ; le rang c laisse libre le rang c − 1.
  const premier = rang(compte[nbRangs - 1]);
  const moi = chezMoi && nbRangs === 1;
  const horsDuRond = (d: number) => {
    const { y, k } = projeter(VUE_PLACES.l / 2, v(d), 0, VUE_PLACES);
    return premier.parts.every(
      (part) => !surLeRond(boites((part - 0.5) * VUE_PLACES.l * k, y, k * r, moi, premier.etiquette)[0])
    );
  };
  const libre = (d: number) => (chezMoi ? tete(0, d) >= logo : pieds(d) <= logo) && horsDuRond(d);
  const derriere = (c: number, devant: number, d: number) =>
    chezMoi ? tete(c, d) >= pieds(devant) + AIR : pieds(d) <= tete(c - 1, devant) - AIR;

  // Le plus loin où va le gardien : sa ligne de but devant ; au fond, le bas de sa pastille juste dessous.
  const loin = chezMoi
    ? D_MAX
    : auPlusLoin((d) => pieds(d) - (ECART + ETIQUETTE) * r * kDe(v(d)) >= yDe(LIGNE) + 2);
  if (loin == null) return null;

  const serre: number[] = [];
  for (let c = 0; c < nbRangs; c++) {
    const d = c === 0 ? auPlusPres(libre) : auPlusPres((x) => derriere(c, serre[c - 1], x));
    if (d == null) return null;
    serre.push(d);
  }
  if (serre[nbRangs - 1] > loin) return null;
  const poste = [...IDEAL[nbRangs]].reverse().map((p) => p * MI);
  const final: number[] = new Array(nbRangs);
  final[nbRangs - 1] = Math.min(loin, Math.max(serre[nbRangs - 1], poste[nbRangs - 1]));
  for (let c = nbRangs - 2; c >= 0; c--) {
    const auPlus = auPlusLoin((x) => derriere(c + 1, x, final[c + 1])) ?? serre[c];
    final[c] = Math.min(Math.max(poste[c], serre[c]), Math.max(auPlus, serre[c]));
  }
  return final;
}

/**
 * Les places d'un match de `n` joueurs : la moitié devant pour les places
 * impaires (l'organisateur dans les buts), le fond pour les paires, remplies
 * l'une après l'autre.
 */
export function placerTerrain(n: number): DispositionTerrain {
  const { l, h } = VUE_PLACES;
  const devant = Math.ceil(n / 2);
  const fond = n - devant;
  const rD = rangs(devant);
  const rF = rangs(fond);

  let reduction = 1;
  let dD: number[] | null = null;
  let dF: number[] | null = null;
  for (let r = 1; r >= 0.5; r = Math.round((r - 0.02) * 100) / 100) {
    reduction = r;
    dD = rD.length ? moitie(rD, true, r) : [];
    dF = rF.length ? moitie(rF, false, r) : [];
    if (dD && dF) break;
  }
  // Toujours une réponse : au pire, les postes à la plus petite réduction.
  const postes = (compte: number[]) => [...IDEAL[compte.length]].reverse().map((p) => p * MI);
  dD ??= postes(rD);
  dF ??= postes(rF);

  // Du but vers la médiane, comme `rangs` : le gardien d'abord.
  const poser = (compte: number[], ds: number[], chezMoi: boolean) =>
    compte.flatMap((c, j) => {
      const { parts, etiquette } = rang(c);
      const d = ds[compte.length - 1 - j];
      const v = chezMoi ? MI + d : MI - d;
      return parts.map((part) => {
        const u = part * l;
        const p = projeter(u, v, 0, VUE_PLACES);
        return { chezMoi, u, v, x: p.x, y: p.y, k: p.k * reduction, etiquette };
      });
    });
  const poseesD = poser(rD, dD, true);
  const poseesF = poser(rF, dF, false);

  // L'ordre de remplissage alterne devant et fond, en commençant devant par le gardien.
  const places: PlaceTerrain[] = [];
  for (let q = 0; q < Math.max(poseesD.length, poseesF.length); q++) {
    if (poseesD[q]) places.push({ i: places.length, ...poseesD[q] });
    if (poseesF[q]) places.push({ i: places.length, ...poseesF[q] });
  }

  const haut = Math.min(projeter(0, 0, 0, VUE_PLACES).y, ...places.map(hautDeCarte));
  const bas = Math.max(projeter(l / 2, h, -14, VUE_PLACES).y, ...places.map((p) => p.y));
  return { places, haut, bas, reduction };
}

/** Le haut d'une carte posée : ma carte, cerclée, est la place 0. */
export function hautDeCarte(p: PlaceTerrain): number {
  return p.y - hauteurCarte(p.i === 0) * p.k;
}

/**
 * Ce que couvre une carte posée (pastille, étiquette), et si la ligne du rond
 * central traverse sa pastille. L'étiquette, opaque, peut passer sur la
 * ligne ; un + vide est translucide, la ligne s'y verrait.
 */
export function boitesDeCarte(p: PlaceTerrain): { boites: Boite[]; surLeRond: boolean } {
  const b = boites(p.x, p.y, p.k, p.i === 0, p.etiquette);
  return { boites: b, surLeRond: surLeRond(b[0]) };
}

/** Le logo du rond central, projeté : son haut et son bas. */
export function logoProjete(): { haut: number; bas: number } {
  return { haut: yDe(MI - LOGO), bas: yDe(MI + LOGO) };
}
