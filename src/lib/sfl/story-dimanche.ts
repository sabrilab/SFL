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
  /** Le symbole BOLA du dos, et la colonne de marbre du décor. */
  symbole: CanvasImageSource | null;
  colonne: CanvasImageSource | null;
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

/** Un instant de la courbe, ralenti puis posé, avec un léger dépassement. */
function pose(t: number, debut: number, duree: number): number {
  const x = Math.min(1, Math.max(0, (t - debut) / duree));
  const c = 1.4;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
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
  const n = 48;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    const lt = l * sx * (1 - fuite * (1 - f));
    ctx.drawImage(img, 0, (ih * i) / n, iw, ih / n + 1, x + (l - lt) / 2, y + (h * i) / n, lt, h / n + 0.6);
  }
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
export function dessinerStory(ctx: CanvasRenderingContext2D, t: number, d: StoryDimanche, c: CalquesStory, p: PolicesStory) {
  const { largeur: W, hauteur: H } = STORY;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  // La caméra : basse et proche au départ (bas = 1), de face à la fin (bas = 0).
  const tPose = 1.5;
  const bas = 1 - grue(t, 0, tPose + 0.1);
  /** Monte une couche selon sa profondeur (k grand = proche de la caméra). */
  const plan = (k: number, cy: number) => {
    const z = 1 + 0.55 * bas * k;
    ctx.translate(W / 2, cy + bas * 520 * k);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -cy);
  };

  // La carte posée : 470 de large, sous le titre.
  const lc = 470;
  const hc = lc * c.ratio;
  const xc = (W - lc) / 2;
  const yc = 400;
  const cyc = yc + hc / 2;

  // Les colonnes, au premier plan : elles fuient vers le haut et se redressent.
  if (c.colonne) {
    const sl = 200; // le bord droit de l'image garde une trace sombre en bas
    const lcol = 260;
    const hcol = 2028;
    ctx.globalAlpha = arrivee(t, 0, 0.35);
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
    ctx.fillStyle = "#ececec";
    ctx.font = `400 900px ${p.chiffres}`;
    ctx.fillText(`${d.note}`, W / 2, cyc + 330 - arrivee(t, 0.5, STORY.duree) * 40);
    ctx.restore();
  }

  // La carte : elle passe au-dessus de nous en tournant, puis se pose de face.
  const ac = arrivee(t, 0.15, tPose - 0.15);
  if (t >= 0.15) {
    const angle = (1 - ac) * Math.PI * 3;
    const cos = Math.cos(angle);
    const coup = t > tPose ? 1 + 0.05 * Math.max(0, 1 - (t - tPose) / 0.3) : 1;
    const fuite = 0.32 * bas;
    const hv = hc * (1 - 0.12 * bas);
    ctx.save();
    plan(1, cyc);
    ctx.globalAlpha = Math.min(1, ac * 4);
    ctx.translate(W / 2, cyc - (1 - ac) * 260);
    ctx.rotate((1 - ac) * -0.2);
    ctx.scale(coup, coup);
    ctx.translate(-W / 2, -cyc);
    const yv = cyc - hv / 2;
    const sx = Math.max(0.02, Math.abs(cos));
    // L'ombre sur la page.
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.24 * ac})`;
    ctx.shadowBlur = 70;
    ctx.shadowOffsetY = 36;
    arrondi(ctx, xc + (lc - lc * sx) / 2 + (lc * sx * fuite) / 4, yv, lc * sx * (1 - fuite / 2), hv, lc * 0.06);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    if (cos >= 0) {
      enFuite(ctx, c.fond, xc, yv, lc, hv, sx, fuite);
      enFuite(ctx, c.joueur, xc, yv + (1 - ac) * 40, lc, hv, sx, fuite);
      enFuite(ctx, c.stats, xc, yv + (1 - ac) * 80, lc, hv, sx, fuite);
    } else {
      // Le dos BOLA, de la couleur de la face.
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
    // Un reflet traverse la carte une fois, posée.
    const ar = Math.min(1, Math.max(0, (t - 3.7) / 0.9));
    if (ar > 0 && ar < 1) {
      ctx.save();
      arrondi(ctx, xc, yc, lc, hc, lc * 0.06);
      ctx.clip();
      const bx = xc - lc * 0.6 + ar * lc * 2.2;
      const reflet = ctx.createLinearGradient(bx - 120, yc, bx + 120, yc + 160);
      reflet.addColorStop(0, BLANC(0));
      reflet.addColorStop(0.5, BLANC(0.45));
      reflet.addColorStop(1, BLANC(0));
      ctx.fillStyle = reflet;
      ctx.fillRect(xc, yc, lc, hc);
      ctx.restore();
    }
    ctx.restore();
  }

  // Le coup de la pose : une onde à l'encre et un éclair blanc.
  const ao = (t - tPose) / 0.7;
  if (ao > 0 && ao < 1) {
    const e = 1 - Math.pow(1 - ao, 3);
    ctx.globalAlpha = (1 - ao) * 0.5;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 6 * (1 - ao) + 1;
    ctx.beginPath();
    ctx.ellipse(W / 2, cyc, lc * (0.6 + e * 0.9), hc * (0.6 + e * 0.6), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const ae = (t - tPose) / 0.25;
  if (ae > 0 && ae < 1) {
    ctx.globalAlpha = (1 - ae) * 0.7;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
  }

  // L'en-tête, une fois la caméra posée : le logo, la journée, le titre.
  const a0 = arrivee(t, tPose - 0.2, 0.6);
  ctx.globalAlpha = a0;
  if (c.logo) {
    const h = 50;
    const l = h * (((c.logo as HTMLImageElement).naturalWidth || 4) / ((c.logo as HTMLImageElement).naturalHeight || 1));
    ctx.drawImage(c.logo, (W - l) / 2, 96 - (1 - a0) * 30, l, h);
  }
  ctx.fillStyle = NOIR(0.55);
  ctx.font = `700 28px ${p.texte}`;
  etiquette(ctx, [`J${d.j}`, d.date, ligneDuLieu(d)].filter(Boolean).join(" · "), W / 2, 214 - (1 - a0) * 30, 4);
  const a1 = arrivee(t, tPose - 0.1, 0.6);
  ctx.globalAlpha = a1;
  ctx.fillStyle = NOIR(1);
  ctx.font = `900 112px ${p.texte}`;
  ctx.fillText("MON DIMANCHE.", W / 2, 334 - (1 - a1) * 40, W - 220);

  // Le bloc à l'encre : le score, tes chiffres, ta place. Il s'ouvre de bas en haut.
  const bx = 120;
  const bl = W - 2 * bx;
  const by = yc + hc + 50;
  const r1 = 190;
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
    ctx.fillStyle = "#0b0b0b";
    ctx.fill();
    // Les filets entre les rangées et les colonnes.
    ctx.fillStyle = BLANC(0.16);
    ctx.fillRect(bx + 36, by + r1, bl - 72, 2);
    ctx.fillRect(bx + 36, by + r1 + r2, bl - 72, 2);
    ctx.fillRect(bx + bl / 3, by + r1 + 30, 2, r2 - 60);
    ctx.fillRect(bx + (2 * bl) / 3, by + r1 + 30, 2, r2 - 60);

    // Rangée 1 : le score, ton camp en blanc plein.
    const as = pose(t, tPose + 0.35, 0.5);
    if (d.pour != null && d.contre != null && d.camp) {
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - tPose - 0.35) / 0.2));
      const dy = (1 - as) * 40;
      const autre = d.camp === "Noirs" ? "Blancs" : "Noirs";
      ctx.font = `800 26px ${p.texte}`;
      ctx.textAlign = "left";
      ctx.fillStyle = BLANC(1);
      etiquette(ctx, d.camp, bx + 44, by + 62, 4);
      ctx.textAlign = "right";
      ctx.fillStyle = BLANC(0.4);
      etiquette(ctx, autre, bx + bl - 44, by + 62, 4);
      const r = resultat(d);
      if (r) {
        ctx.textAlign = "center";
        ctx.fillStyle = BLANC(0.55);
        etiquette(ctx, r, W / 2, by + 62, 5);
      }
      ctx.textAlign = "center";
      ctx.font = `400 116px ${p.chiffres}`;
      ctx.fillStyle = BLANC(1);
      ctx.fillText(`${d.pour}`, W / 2 - 100, by + 166 + dy);
      ctx.fillStyle = BLANC(0.35);
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
      const a = pose(t, debut, 0.5);
      const compte = Math.round(col.n * arrivee(t, debut, 0.9));
      const x = bx + (bl / 3) * (i + 0.5);
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - debut) / 0.15));
      ctx.textAlign = "center";
      ctx.fillStyle = BLANC(1);
      ctx.font = `400 112px ${p.chiffres}`;
      ctx.fillText(`${col.plus && col.n > 0 ? "+" : ""}${compte}`, x, by + r1 + 130 + (1 - a) * 40);
      ctx.fillStyle = BLANC(0.5);
      ctx.font = `700 24px ${p.texte}`;
      etiquette(ctx, col.l, x, by + r1 + 172, 4);
    });

    // Rangée 3 : ta place au classement.
    const rang = ligneDuRang(d);
    if (rang) {
      const a = arrivee(t, tPose + 1.1, 0.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = BLANC(0.85);
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
  ctx.fillStyle = NOIR(0.55);
  ctx.font = `600 30px ${p.texte}`;
  ctx.fillText(ligneDeFin(d), W / 2, H - 120);
  ctx.fillStyle = NOIR(1);
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
 * pas l'enregistrer.
 */
export function enregistrerStory(
  canvas: HTMLCanvasElement,
  dessiner: (t: number) => void,
  surAvance?: (x: number) => void,
): Promise<Blob | null> {
  const format = formatVideo();
  if (!format) return Promise.resolve(null);
  return new Promise((fin) => {
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
    r.ondataavailable = (e) => e.data.size > 0 && bouts.push(e.data);
    r.onstop = () => {
      flux.getTracks().forEach((piste) => piste.stop());
      fin(bouts.length ? new Blob(bouts, { type: format.mime.split(";")[0] }) : null);
    };
    r.onerror = () => fin(null);
    r.start(500);
    const t0 = performance.now();
    const image = (maintenant: number) => {
      const t = (maintenant - t0) / 1000;
      dessiner(t);
      surAvance?.(Math.min(1, t / STORY.duree));
      if (t < STORY.duree) requestAnimationFrame(image);
      // Une dernière image, pour que la fin tienne à l'écran.
      else setTimeout(() => r.state !== "inactive" && r.stop(), 120);
    };
    requestAnimationFrame(image);
  });
}
