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
// Mouvements : tout arrive en glissant puis se pose, sans rebond ni
// tremblement ; la seconde moitié est fixe, pour qu'on ait le temps de lire.

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

/**
 * Dessine l'image de l'instant `t` (en secondes). Au-delà de la durée, la
 * dernière image : celle qu'on partage en photo.
 */
export function dessinerStory(ctx: CanvasRenderingContext2D, t: number, d: StoryDimanche, c: CalquesStory, p: PolicesStory) {
  const { largeur: W, hauteur: H } = STORY;
  const marge = 72;
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // L'en-tête : le logo, et la journée.
  const a0 = arrivee(t, 0, 0.6);
  ctx.globalAlpha = a0;
  if (c.logo) {
    const h = 54;
    const l = h * (((c.logo as HTMLImageElement).naturalWidth || 4) / ((c.logo as HTMLImageElement).naturalHeight || 1));
    ctx.drawImage(c.logo, marge, 92, l, h);
  }
  ctx.fillStyle = BLANC(0.6);
  ctx.font = `600 30px ${p.texte}`;
  ctx.textAlign = "right";
  etiquette(ctx, `J${d.j} · ${d.date}`, W - marge, 132, 3);

  // Le titre et le lieu.
  const a1 = arrivee(t, 0.15, 0.8);
  ctx.globalAlpha = a1;
  ctx.textAlign = "left";
  ctx.fillStyle = BLANC(1);
  ctx.font = `900 104px ${p.texte}`;
  ctx.fillText("Mon dimanche.", marge, 292 + (1 - a1) * 30);
  const lieu = ligneDuLieu(d);
  if (lieu) {
    ctx.fillStyle = BLANC(0.6);
    ctx.font = `500 34px ${p.texte}`;
    ctx.fillText(lieu, marge, 352 + (1 - a1) * 30, W - 2 * marge);
  }

  // La carte : elle monte et se pose ; ses calques arrivent chacun à son pas.
  const ac = arrivee(t, 0.35, 1.5);
  const lc = 470;
  const hc = lc * c.ratio;
  const xc = (W - lc) / 2;
  const yc = 420;
  const monte = (1 - ac) * 420;
  ctx.globalAlpha = Math.min(1, ac * 1.6);
  // Une lueur derrière la carte, très douce.
  const lueur = ctx.createRadialGradient(W / 2, yc + hc / 2, 40, W / 2, yc + hc / 2, lc);
  lueur.addColorStop(0, BLANC(0.14 * ac));
  lueur.addColorStop(1, BLANC(0));
  ctx.fillStyle = lueur;
  ctx.fillRect(0, yc - 120, W, hc + 240);
  const echelle = 0.9 + 0.1 * ac;
  ctx.save();
  ctx.translate(W / 2, yc + hc / 2 + monte);
  ctx.scale(echelle, echelle);
  ctx.translate(-W / 2, -(yc + hc / 2));
  ctx.drawImage(c.fond, xc, yc, lc, hc);
  ctx.drawImage(c.joueur, xc, yc + (1 - ac) * 70, lc, hc);
  ctx.drawImage(c.stats, xc, yc + (1 - ac) * 130, lc, hc);
  // Un reflet traverse la carte une fois, posée.
  const ar = Math.min(1, Math.max(0, (t - 3.9) / 0.9));
  if (ar > 0 && ar < 1) {
    ctx.save();
    arrondi(ctx, xc, yc, lc, hc, lc * 0.06);
    ctx.clip();
    const bx = xc - lc * 0.6 + ar * lc * 2.2;
    const reflet = ctx.createLinearGradient(bx - 120, yc, bx + 120, yc + 160);
    reflet.addColorStop(0, BLANC(0));
    reflet.addColorStop(0.5, BLANC(0.28));
    reflet.addColorStop(1, BLANC(0));
    ctx.fillStyle = reflet;
    ctx.fillRect(xc, yc, lc, hc);
    ctx.restore();
  }
  ctx.restore();

  // Le score, ton camp en blanc plein.
  let y = yc + hc + 150;
  const as = arrivee(t, 1.6, 0.7);
  if (d.pour != null && d.contre != null && d.camp) {
    ctx.globalAlpha = as;
    const dy = (1 - as) * 40;
    const autre = d.camp === "Noirs" ? "Blancs" : "Noirs";
    ctx.textAlign = "center";
    ctx.font = `400 150px ${p.chiffres}`;
    ctx.fillStyle = BLANC(1);
    ctx.fillText(`${d.pour}`, W / 2 - 110, y + dy);
    ctx.fillStyle = BLANC(0.4);
    ctx.fillText("–", W / 2, y + dy);
    ctx.fillText(`${d.contre}`, W / 2 + 110, y + dy);
    ctx.font = `700 30px ${p.texte}`;
    ctx.fillStyle = BLANC(1);
    ctx.textAlign = "right";
    etiquette(ctx, d.camp, W / 2 - 210, y - 50 + dy, 3);
    ctx.fillStyle = BLANC(0.4);
    ctx.textAlign = "left";
    etiquette(ctx, autre, W / 2 + 210, y - 50 + dy, 3);
    const r = resultat(d);
    if (r) {
      ctx.fillStyle = BLANC(0.6);
      ctx.font = `600 34px ${p.texte}`;
      ctx.textAlign = "center";
      ctx.fillText(r, W / 2, y + 62 + dy);
    }
    y += 210;
  } else {
    y += 40;
  }

  // Tes chiffres, qui défilent jusqu'au vrai.
  const colonnes = [
    { n: d.buts, l: d.buts > 1 ? "buts" : "but" },
    { n: d.passes, l: d.passes > 1 ? "passes" : "passe" },
    { n: d.points, l: "points", plus: true },
  ];
  colonnes.forEach((col, i) => {
    const debut = 2.2 + i * 0.22;
    const a = arrivee(t, debut, 0.5);
    const compte = Math.round(col.n * arrivee(t, debut, 1));
    const x = W / 2 + (i - 1) * 320;
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.fillStyle = BLANC(1);
    ctx.font = `400 128px ${p.chiffres}`;
    ctx.fillText(`${col.plus && col.n > 0 ? "+" : ""}${compte}`, x, y + (1 - a) * 30);
    ctx.fillStyle = BLANC(0.55);
    ctx.font = `600 28px ${p.texte}`;
    etiquette(ctx, col.l, x, y + 52 + (1 - a) * 30, 3);
  });

  const rang = ligneDuRang(d);
  if (rang) {
    const a = arrivee(t, 3.1, 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = BLANC(0.8);
    ctx.font = `600 34px ${p.texte}`;
    ctx.textAlign = "center";
    ctx.fillText(rang, W / 2, y + 140);
  }

  // La fin, pour qui ne connaît pas Bola.
  const af = arrivee(t, 3.5, 0.7);
  ctx.globalAlpha = af;
  ctx.textAlign = "center";
  ctx.fillStyle = BLANC(0.55);
  ctx.font = `500 30px ${p.texte}`;
  ctx.fillText(ligneDeFin(d), W / 2, H - 132);
  ctx.fillStyle = BLANC(1);
  ctx.font = `800 44px ${p.texte}`;
  ctx.fillText("getbola.app", W / 2, H - 76);

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
