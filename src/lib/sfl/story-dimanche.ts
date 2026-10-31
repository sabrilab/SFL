// La story de ton dimanche : une vidéo de 6 secondes au format story
// (1080 × 1920), à poster sur Snap ou Instagram comme on poste une course
// Strava (Sabri, 30/10 : « la vidéo type story Strava, tu peux déjà mettre
// ça en place »).
//
// Ce qu'on partage, c'est une preuve : le match qui a eu lieu, avec ses vrais
// chiffres (le score, tes buts, tes passes, tes points, ta place). Sabri, le
// même jour : la vidéo doit être comprise par quelqu'un qui ne connaît pas
// Bola. Elle dit donc en clair où et quand ça s'est joué, et finit sur
// getbola.app.
//
// Aucune IA : ta carte (ses trois calques photographiés, card-3d.tsx), du
// texte et des chiffres, dessinés image par image dans un canvas que le
// téléphone enregistre (MediaRecorder). Ici, les données et le dessin ; la
// fenêtre qui enregistre et partage est dans components/sfl/story/.
//
// Mouvements : le motion design des vidéos de journée (la page blanche aux
// deux colonnes du plan « solo » de la J4) ; tout arrive puis se pose, sans
// tremblement, et la seconde moitié est fixe, pour qu'on ait le temps de lire.
// Deux tons : la page blanche, ou la page noire (Sabri, 31/10).
//
// Fluidité (Sabri, 31/10 : « un bug dans la fluidité ») : une seule courbe par
// mouvement, sans rebond ni coup, et une image légère à dessiner pour que le
// téléphone tienne ses 30 images par seconde pendant l'enregistrement : la
// face de la carte est assemblée une fois, son ombre floutée une fois.

import { findPlayerMatch, type Journee } from "./engine";
import type { Camp } from "./maillots";

export const STORY = { largeur: 1080, hauteur: 1920, duree: 6.4, ips: 30 } as const;

export interface StoryDimanche {
  j: number;
  /** « 1 nov. » */
  date: string;
  /** Le lieu, la commune, le terrain sur place et l'heure, quand la journée les connaît. */
  lieu: string | null;
  commune: string | null;
  terrain: string | null;
  heure: string | null;
  /** Ton camp, et le score de ton match (le tien d'abord). */
  camp: Camp | null;
  pour: number | null;
  contre: number | null;
  buts: number;
  passes: number;
  points: number;
  /** Les places gagnées (positif) ou perdues au Pépite d'Or ; ta place après. */
  delta: number;
  rang: number | null;
  /** Ta note, en très grand derrière la carte. */
  note: number | null;
}

/** La page blanche, ou la page noire. */
export type TonStory = "blanc" | "noir";

/** La carte posée dans la story : sa largeur et son haut, en pixels. */
export const CARTE_STORY = { largeur: 470, haut: 400 } as const;

/** Le moment où la carte se pose, et la caméra avec elle. */
const POSE = 1.7;

/**
 * Le mouvement de la carte et de la caméra à l'instant `t` : `bas` = 1 quand
 * la grue est en bas (contre-plongée), 0 de face ; `montee` = 1 quand la
 * carte est encore au-dessus, 0 posée ; `angle`, le tour qu'il lui reste.
 */
export interface MouvementCarte {
  bas: number;
  montee: number;
  angle: number;
}

export function mouvementCarte(t: number): MouvementCarte {
  const bas = 1 - grue(t, 0, POSE + 0.2);
  const montee = 1 - arrivee(t, 0.1, POSE - 0.1);
  return { bas, montee, angle: montee * Math.PI * 2 };
}

/**
 * La vraie carte 3D (components/sfl/story/carte-story-3d.tsx) : rend l'image
 * de la carte pour ce mouvement, à la taille de la story, fond transparent.
 * `avant` est le mouvement de l'image d'avant (le flou de mouvement).
 */
export type Carte3DStory = (m: MouvementCarte, avant?: MouvementCarte) => CanvasImageSource;

/** Ton match de la journée : ton camp et le score, ton équipe d'abord. */
export function scoreDuJoueur(
  journee: Journee | undefined,
  nom: string,
): { camp: Camp; pour: number; contre: number } | null {
  if (!journee) return null;
  const m = findPlayerMatch(journee, nom);
  if (!m) return null;
  // La première équipe de chaque match joue en noir (feuille.ts, maillots.ts).
  const camp: Camp = m.team === m.match.teamA ? "Noirs" : "Blancs";
  return { camp, pour: m.team.score, contre: m.opponents.score };
}

/** Le lieu en une ligne : « Hippodrome de Marcq · Terrain 2 · 14h ». */
export function ligneDuLieu(d: Pick<StoryDimanche, "lieu" | "terrain" | "heure">): string {
  return [d.lieu, d.terrain, d.heure].filter(Boolean).join(" · ");
}

/** Ce qu'un inconnu doit comprendre en bas de la vidéo. */
export function ligneDeFin(d: Pick<StoryDimanche, "commune">): string {
  return d.commune ? `Foot à 5, chaque dimanche à ${titre(d.commune)}` : "Foot à 5, chaque dimanche";
}

/** « LILLE » → « Lille », « MARCQ-EN-BARŒUL » → « Marcq-en-Barœul ». */
function titre(s: string): string {
  // Les petits mots restent en minuscules au milieu d'un nom composé.
  const petits = new Set(["en", "de", "du", "des", "la", "le", "les", "sur", "sous", "lès", "lez"]);
  return s
    .toLocaleLowerCase("fr-FR")
    .split(/([\s'-])/)
    .map((mot, i) => (i > 0 && petits.has(mot)) || !mot ? mot : mot[0].toLocaleUpperCase("fr-FR") + mot.slice(1))
    .join("");
}

export function resultat(d: Pick<StoryDimanche, "pour" | "contre">): string | null {
  if (d.pour == null || d.contre == null) return null;
  return d.pour > d.contre ? "Victoire" : d.pour < d.contre ? "Défaite" : "Match nul";
}

/** La ligne du classement : « ▲ 3 places au classement · 12e ». */
export function ligneDuRang(d: Pick<StoryDimanche, "delta" | "rang">): string | null {
  if (d.rang == null) return null;
  const place = `${d.rang}${d.rang === 1 ? "er" : "e"} au classement`;
  if (d.delta > 0) return `▲ ${d.delta} ${d.delta > 1 ? "places" : "place"} · ${place}`;
  if (d.delta < 0) return `▼ ${-d.delta} · ${place}`;
  return place;
}

/* --------------------------------- Le dessin --------------------------------- */

export interface CalquesStory {
  fond: CanvasImageSource;
  joueur: CanvasImageSource;
  stats: CanvasImageSource;
  /** Hauteur / largeur de la carte. */
  ratio: number;
  logo: CanvasImageSource | null;
  /** Le logo blanc, pour la page noire. */
  logoBlanc?: CanvasImageSource | null;
  /** Le vrai dos de la carte (DosCarte, photographié par card-3d.tsx), sinon le symbole BOLA. */
  dos: CanvasImageSource | null;
  symbole: CanvasImageSource | null;
  /** La colonne de marbre du décor. */
  colonne: CanvasImageSource | null;
  /** La vraie carte 3D ; sans elle, la carte est dessinée à plat. */
  carte3d?: Carte3DStory | null;
}

export interface PolicesStory {
  /** Les familles CSS d'Inter et d'Anton, telles que Next les nomme. */
  texte: string;
  chiffres: string;
}

/** 0 → 1 entre `debut` et `debut + duree`, ralenti à l'arrivée. */
function arrivee(t: number, debut: number, duree: number): number {
  const x = Math.min(1, Math.max(0, (t - debut) / duree));
  return 1 - Math.pow(1 - x, 4);
}

const BLANC = (a: number) => `rgba(255,255,255,${a})`;
const NOIR = (a: number) => `rgba(0,0,0,${a})`;

function arrondi(ctx: CanvasRenderingContext2D, x: number, y: number, l: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + l, y, x + l, y + h, r);
  ctx.arcTo(x + l, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + l, y, r);
  ctx.closePath();
}

/** Les capitales espacées des étiquettes (.mono-label), à la main : le canvas n'a pas letter-spacing partout. */
function etiquette(ctx: CanvasRenderingContext2D, texte: string, x: number, y: number, espace: number) {
  const lettres = [...texte.toUpperCase()];
  const largeur = lettres.reduce((s, c) => s + ctx.measureText(c).width, 0) + espace * (lettres.length - 1);
  const align = ctx.textAlign;
  let cx = align === "center" ? x - largeur / 2 : align === "right" ? x - largeur : x;
  ctx.textAlign = "left";
  for (const c of lettres) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + espace;
  }
  ctx.textAlign = align;
}

/** Les couleurs de chaque ton. */
const TONS = {
  blanc: { page: "#fff", note: "#ececec", encre: NOIR, bloc: "#0b0b0b", dansBloc: BLANC, ombre: 0.24, colonnes: 1 },
  noir: { page: "#000", note: "#161616", encre: BLANC, bloc: "#f4f4f2", dansBloc: NOIR, ombre: 0.7, colonnes: 0.9 },
} as const;

/** Ce qui ne change pas d'une image à l'autre : dessiné une fois, gardé. */
const prepares = new WeakMap<CalquesStory, { face: HTMLCanvasElement; ombre: HTMLCanvasElement; marge: number }>();

function toile(l: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(l));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** La face de la carte (ses trois calques en un) et son ombre floutée. */
function preparer(c: CalquesStory, lc: number, hc: number) {
  const deja = prepares.get(c);
  if (deja) return deja;
  const face = toile(lc * 2, hc * 2);
  const fx = face.getContext("2d")!;
  fx.imageSmoothingQuality = "high";
  for (const img of [c.fond, c.joueur, c.stats]) fx.drawImage(img, 0, 0, face.width, face.height);
  const marge = 120;
  const ombre = toile(lc + 2 * marge, hc + 2 * marge);
  const ox = ombre.getContext("2d")!;
  ox.shadowColor = "#000";
  ox.shadowBlur = 70;
  ox.shadowOffsetY = 0;
  ox.translate(-10_000, 0);
  ox.shadowOffsetX = 10_000;
  arrondi(ox, marge, marge, lc, hc, lc * 0.06);
  ox.fill();
  const pret = { face, ombre, marge };
  prepares.set(c, pret);
  return pret;
}

/** 0 → 1, lent au départ et à l'arrivée : le mouvement d'une grue de cinéma. */
function grue(t: number, debut: number, duree: number): number {
  const x = Math.min(1, Math.max(0, (t - debut) / duree));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Une image dessinée en contre-plongée : tranche par tranche, le bas plus
 * large que le haut (`fuite` : ce que le haut perd, 0 = de face). `sx` est
 * l'écrasement horizontal de la carte qui tourne.
 */
function enFuite(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  x: number,
  y: number,
  l: number,
  h: number,
  sx: number,
  fuite: number,
) {
  const iw = (img as HTMLImageElement).naturalWidth || (img as HTMLCanvasElement).width;
  const ih = (img as HTMLImageElement).naturalHeight || (img as HTMLCanvasElement).height;
  if (fuite < 0.002) {
    ctx.drawImage(img, x + (l - l * sx) / 2, y, l * sx, h);
    return;
  }
  const n = 32;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const lt = l * sx * (1 - fuite * (1 - f));
    ctx.drawImage(img, 0, (ih * i) / n, iw, ih / n + 1, x + (l - lt) / 2, y + (h * i) / n, lt, h / n + 0.6);
  }
}

/** Un reflet traverse la carte une fois, posée (`t` compté depuis la pose). */
function refletPose(ctx: CanvasRenderingContext2D, t: number, xc: number, yc: number, lc: number, hc: number) {
  const ar = grue(t, 0.1, 1.1);
  if (ar <= 0 || ar >= 1) return;
  ctx.save();
  arrondi(ctx, xc, yc, lc, hc, lc * 0.06);
  ctx.clip();
  const bx = xc - lc * 0.6 + ar * lc * 2.2;
  const reflet = ctx.createLinearGradient(bx - 120, yc, bx + 120, yc + 160);
  reflet.addColorStop(0, BLANC(0));
  reflet.addColorStop(0.5, BLANC(0.4));
  reflet.addColorStop(1, BLANC(0));
  ctx.fillStyle = reflet;
  ctx.fillRect(xc, yc, lc, hc);
  ctx.restore();
}

/**
 * Dessine l'image de l'instant `t` (en secondes). Au-delà de la durée, la
 * dernière image : celle qu'on partage en photo.
 *
 * La page blanche du site et de la vidéo des compos (J4, plan « solo »).
 * L'ouverture est un plan de grue : la caméra part en bas, en contre-plongée
 * (les deux colonnes de marbre fuient vers le haut, comme à l'écran 1 du
 * site, la carte arrive au-dessus de nous en tournant), puis elle monte et se
 * met de face, au moment où la carte se pose d'un coup (éclair, onde). Les
 * chiffres sont cadrés dans un bloc à l'encre, comme un habillage télé.
 */
export function dessinerStory(
  ctx: CanvasRenderingContext2D,
  t: number,
  d: StoryDimanche,
  c: CalquesStory,
  p: PolicesStory,
  ton: TonStory = "blanc",
) {
  const { largeur: W, hauteur: H } = STORY;
  const T = TONS[ton];
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = T.page;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  // La caméra : basse et proche au départ (bas = 1), de face à la fin (bas = 0).
  const tPose = POSE;
  const mvt = mouvementCarte(t);
  const bas = mvt.bas;
  /** Monte une couche selon sa profondeur (k grand = proche de la caméra). */
  const plan = (k: number, cy: number) => {
    const z = 1 + 0.55 * bas * k;
    ctx.translate(W / 2, cy + bas * 520 * k);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -cy);
  };

  // La carte posée : 470 de large, sous le titre.
  const lc = CARTE_STORY.largeur;
  const hc = lc * c.ratio;
  const xc = (W - lc) / 2;
  const yc = CARTE_STORY.haut;
  const cyc = yc + hc / 2;
  const { face, ombre, marge } = preparer(c, lc, hc);

  // Les colonnes, au premier plan : elles fuient vers le haut et se redressent.
  if (c.colonne) {
    const sl = 200; // le bord droit de l'image garde une trace sombre en bas
    const lcol = 260;
    const hcol = 2028;
    ctx.globalAlpha = arrivee(t, 0, 0.35) * T.colonnes;
    [-1, 1].forEach((cote) => {
      ctx.save();
      // Contre-plongée : vues d'en bas, les colonnes sont plus grandes et leur
      // haut penche vers le milieu ; la caméra monte, elles se redressent.
      const z = 1 + 0.5 * bas;
      const x0 = cote < 0 ? -150 + lcol / 2 + bas * 30 : W - 110 + lcol / 2 - bas * 30;
      ctx.translate(x0, H + 40);
      ctx.transform(1, 0, cote * 0.15 * bas, 1, 0, 0);
      ctx.scale(z, z);
      ctx.drawImage(c.colonne!, 0, 0, sl, 1560, -lcol / 2, -hcol, lcol, hcol);
      ctx.restore();
    });
  }

  // Ta note en très grand derrière la carte, au fond.
  if (d.note != null) {
    ctx.save();
    plan(0.45, cyc);
    ctx.globalAlpha = arrivee(t, 0, 0.5);
    ctx.fillStyle = T.note;
    ctx.font = `400 900px ${p.chiffres}`;
    ctx.fillText(`${d.note}`, W / 2, cyc + 330 - arrivee(t, 0.5, STORY.duree) * 40);
    ctx.restore();
  }

  // La carte : elle passe au-dessus de nous en faisant un tour (son dos,
  // puis sa face), et ralentit jusqu'à se poser de face. Une seule courbe.
  const ac = 1 - mvt.montee;
  if (t >= 0.1 && c.carte3d) {
    // La vraie carte 3D, filmée par la grue ; son ombre sur la page d'abord.
    const sx = Math.max(0.02, Math.abs(Math.cos(mvt.angle)));
    ctx.save();
    ctx.globalAlpha = Math.min(1, (t - 0.1) / 0.3) * T.ombre * ac;
    const so = sx * (1 - 0.15 * bas);
    ctx.drawImage(ombre, W / 2 - (lc / 2 + marge) * so, yc - marge + 36, (lc + 2 * marge) * so, hc + 2 * marge);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = Math.min(1, (t - 0.1) / 0.3);
    ctx.drawImage(c.carte3d(mvt, mouvementCarte(Math.max(0, t - 1 / STORY.ips))), 0, 0, W, H);
    ctx.restore();
    refletPose(ctx, t - tPose, xc, yc, lc, hc);
  } else if (t >= 0.1) {
    const angle = mvt.angle;
    const cos = Math.cos(angle);
    const fuite = 0.32 * bas;
    const hv = hc * (1 - 0.12 * bas);
    ctx.save();
    plan(1, cyc);
    ctx.globalAlpha = Math.min(1, (t - 0.1) / 0.3);
    ctx.translate(W / 2, cyc - (1 - ac) * 260);
    ctx.rotate((1 - ac) * -0.14);
    ctx.translate(-W / 2, -cyc);
    const yv = cyc - hv / 2;
    const sx = Math.max(0.02, Math.abs(cos));
    // L'ombre sur la page, floutée une fois pour toutes ; elle se resserre à la pose.
    ctx.save();
    ctx.globalAlpha *= T.ombre * (0.4 + 0.6 * ac);
    const lo = lc * sx * (1 - fuite / 2);
    const so = lo / lc;
    const desc = 20 + 16 * ac;
    ctx.drawImage(ombre, W / 2 - (lc / 2 + marge) * so, yv - marge + desc, (lc + 2 * marge) * so, hv + 2 * marge);
    ctx.restore();
    if (cos >= 0) enFuite(ctx, face, xc, yv, lc, hv, sx, fuite);
    else if (c.dos) {
      // Le vrai dos de la carte, de la couleur de la face.
      enFuite(ctx, c.dos, xc, yv, lc, hv, sx, fuite);
    } else {
      // Repli : un dos uni avec le symbole BOLA.
      ctx.save();
      ctx.translate(W / 2, cyc);
      ctx.scale(sx, 1);
      arrondi(ctx, -lc / 2, -hv / 2, lc, hv, lc * 0.06);
      ctx.fillStyle = "#f4f4f2";
      ctx.fill();
      ctx.strokeStyle = NOIR(0.1);
      ctx.lineWidth = 3;
      ctx.stroke();
      if (c.symbole) {
        const s = lc * 0.36;
        ctx.scale(-1, 1);
        ctx.drawImage(c.symbole, -s / 2, -s / 2, s, s);
      }
      ctx.restore();
    }
    refletPose(ctx, t - tPose, xc, yc, lc, hc);
    ctx.restore();
  }

  // L'en-tête, une fois la caméra posée : le logo, la journée, le titre.
  const a0 = arrivee(t, tPose - 0.2, 0.6);
  ctx.globalAlpha = a0;
  if (c.logo) {
    const h = 50;
    const l = h * (((c.logo as HTMLImageElement).naturalWidth || 4) / ((c.logo as HTMLImageElement).naturalHeight || 1));
    ctx.drawImage(c.logo, (W - l) / 2, 96 - (1 - a0) * 30, l, h);
  }
  ctx.fillStyle = T.encre(0.55);
  ctx.font = `700 28px ${p.texte}`;
  etiquette(ctx, [`J${d.j}`, d.date, ligneDuLieu(d)].filter(Boolean).join(" · "), W / 2, 214 - (1 - a0) * 30, 4);
  const a1 = arrivee(t, tPose - 0.1, 0.6);
  ctx.globalAlpha = a1;
  ctx.fillStyle = T.encre(1);
  ctx.font = `900 112px ${p.texte}`;
  ctx.fillText("MON DIMANCHE.", W / 2, 334 - (1 - a1) * 40, W - 220);

  // Le bloc à l'encre : le score, tes chiffres, ta place. Il s'ouvre de bas en haut.
  const bx = 120;
  const bl = W - 2 * bx;
  const by = yc + hc + 50;
  const avecScore = d.pour != null && d.contre != null && d.camp != null;
  const r1 = avecScore ? 190 : 0;
  const r2 = 200;
  const r3 = 84;
  const bh = r1 + r2 + r3;
  const ab = grue(t, tPose + 0.15, 0.45);
  if (ab > 0) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.rect(0, by + bh * (1 - ab), W, bh * ab);
    ctx.clip();
    arrondi(ctx, bx, by, bl, bh, 28);
    ctx.fillStyle = T.bloc;
    ctx.fill();
    // Les filets entre les rangées et les colonnes.
    ctx.fillStyle = T.dansBloc(0.16);
    if (avecScore) ctx.fillRect(bx + 36, by + r1, bl - 72, 2);
    ctx.fillRect(bx + 36, by + r1 + r2, bl - 72, 2);
    ctx.fillRect(bx + bl / 3, by + r1 + 30, 2, r2 - 60);
    ctx.fillRect(bx + (2 * bl) / 3, by + r1 + 30, 2, r2 - 60);

    // Rangée 1 : le score, ton camp en blanc plein.
    const as = arrivee(t, tPose + 0.35, 0.6);
    if (d.pour != null && d.contre != null && d.camp) {
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - tPose - 0.35) / 0.2));
      const dy = (1 - as) * 40;
      const autre = d.camp === "Noirs" ? "Blancs" : "Noirs";
      ctx.font = `800 26px ${p.texte}`;
      ctx.textAlign = "left";
      ctx.fillStyle = T.dansBloc(1);
      etiquette(ctx, d.camp, bx + 44, by + 62, 4);
      ctx.textAlign = "right";
      ctx.fillStyle = T.dansBloc(0.4);
      etiquette(ctx, autre, bx + bl - 44, by + 62, 4);
      const r = resultat(d);
      if (r) {
        ctx.textAlign = "center";
        ctx.fillStyle = T.dansBloc(0.55);
        etiquette(ctx, r, W / 2, by + 62, 5);
      }
      ctx.textAlign = "center";
      ctx.font = `400 116px ${p.chiffres}`;
      ctx.fillStyle = T.dansBloc(1);
      ctx.fillText(`${d.pour}`, W / 2 - 100, by + 166 + dy);
      ctx.fillStyle = T.dansBloc(0.35);
      ctx.fillText("–", W / 2, by + 166 + dy);
      ctx.fillText(`${d.contre}`, W / 2 + 100, by + 166 + dy);
    }

    // Rangée 2 : tes chiffres, qui défilent jusqu'au vrai.
    const colonnes = [
      { n: d.buts, l: d.buts > 1 ? "buts" : "but" },
      { n: d.passes, l: d.passes > 1 ? "passes" : "passe" },
      { n: d.points, l: "points", plus: true },
    ];
    colonnes.forEach((col, i) => {
      const debut = tPose + 0.55 + i * 0.15;
      const a = arrivee(t, debut, 0.6);
      const compte = Math.round(col.n * arrivee(t, debut, 0.9));
      const x = bx + (bl / 3) * (i + 0.5);
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - debut) / 0.15));
      ctx.textAlign = "center";
      ctx.fillStyle = T.dansBloc(1);
      ctx.font = `400 112px ${p.chiffres}`;
      ctx.fillText(`${col.plus && col.n > 0 ? "+" : ""}${compte}`, x, by + r1 + 130 + (1 - a) * 40);
      ctx.fillStyle = T.dansBloc(0.5);
      ctx.font = `700 24px ${p.texte}`;
      etiquette(ctx, col.l, x, by + r1 + 172, 4);
    });

    // Rangée 3 : ta place au classement.
    const rang = ligneDuRang(d);
    if (rang) {
      const a = arrivee(t, tPose + 1.1, 0.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = T.dansBloc(0.85);
      ctx.font = `700 30px ${p.texte}`;
      ctx.textAlign = "center";
      ctx.fillText(rang, W / 2, by + r1 + r2 + 54);
    }
    ctx.restore();
  }

  // La fin, pour qui ne connaît pas Bola.
  const af = arrivee(t, tPose + 1.4, 0.7);
  ctx.globalAlpha = af;
  ctx.textAlign = "center";
  ctx.fillStyle = T.encre(0.55);
  ctx.font = `600 30px ${p.texte}`;
  ctx.fillText(ligneDeFin(d), W / 2, H - 120);
  ctx.fillStyle = T.encre(1);
  ctx.font = `900 46px ${p.texte}`;
  ctx.fillText("getbola.app", W / 2, H - 64);

  ctx.restore();
}

/* ------------------------------ L'enregistrement ------------------------------ */

/** Le format vidéo que ce téléphone sait enregistrer : mp4 d'abord (Snap, Instagram), webm sinon. */
export function formatVideo(): { mime: string; ext: string } | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return null;
  if (typeof HTMLCanvasElement === "undefined" || !("captureStream" in HTMLCanvasElement.prototype)) return null;
  const choix: [string, string][] = [
    ["video/mp4;codecs=avc1.42E01E", "mp4"],
    ["video/mp4;codecs=avc1", "mp4"],
    ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"],
    ["video/webm;codecs=vp8", "webm"],
    ["video/webm", "webm"],
  ];
  for (const [mime, ext] of choix) if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  return null;
}

/**
 * Joue l'animation dans le canvas en temps réel et l'enregistre. `dessiner`
 * reçoit le temps en secondes. Rend la vidéo, ou null si le téléphone ne sait
 * pas l'enregistrer, ou si `arret` a été déclenché (on a changé de ton).
 */
export function enregistrerStory(
  canvas: HTMLCanvasElement,
  dessiner: (t: number) => void,
  surAvance?: (x: number) => void,
  arret?: AbortSignal,
): Promise<Blob | null> {
  const format = formatVideo();
  if (!format) return Promise.resolve(null);
  return new Promise((rendre) => {
    let fini = false;
    const fin = (b: Blob | null) => {
      if (fini) return;
      fini = true;
      clearTimeout(garde);
      rendre(b);
    };
    let flux: MediaStream;
    let r: MediaRecorder;
    try {
      dessiner(0);
      flux = canvas.captureStream(STORY.ips);
      r = new MediaRecorder(flux, { mimeType: format.mime, videoBitsPerSecond: 8_000_000 });
    } catch {
      fin(null);
      return;
    }
    const bouts: Blob[] = [];
    const assembler = () => (bouts.length ? new Blob(bouts, { type: format.mime.split(";")[0] }) : null);
    r.ondataavailable = (e) => e.data.size > 0 && bouts.push(e.data);
    r.onstop = () => {
      flux.getTracks().forEach((piste) => piste.stop());
      fin(assembler());
    };
    r.onerror = () => fin(null);
    arret?.addEventListener("abort", () => {
      try {
        if (r.state !== "inactive") r.stop();
      } catch {
        // déjà arrêté
      }
      flux.getTracks().forEach((piste) => piste.stop());
      fin(null);
    });
    // Un téléphone dont l'enregistreur ne rend jamais la main (vu sur iPhone) :
    // au-delà de la durée et d'une marge, on prend ce qui a été enregistré, ou
    // l'image de la fin.
    const garde = setTimeout(() => {
      try {
        if (r.state !== "inactive") r.stop();
      } catch {
        // déjà arrêté
      }
      setTimeout(() => fin(assembler()), 1500);
    }, (STORY.duree + 4) * 1000);
    r.start(500);
    const t0 = performance.now();
    const image = (maintenant: number) => {
      if (arret?.aborted) return;
      const t = (maintenant - t0) / 1000;
      // Une image qui échoue ne doit pas arrêter le film.
      try {
        dessiner(t);
      } catch {
        // l'image suivante réessaie
      }
      surAvance?.(Math.min(1, t / STORY.duree));
      if (t < STORY.duree) requestAnimationFrame(image);
      // Une dernière image, pour que la fin tienne à l'écran.
      else setTimeout(() => r.state !== "inactive" && r.stop(), 120);
    };
    requestAnimationFrame(image);
  });
}
