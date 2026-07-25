// Détection du visage et recadrage normalisé.
//
// Les photos de l'utilisateur arrivent avec des fonds, des distances et des
// cadrages quelconques. Avant de projeter quoi que ce soit sur la tête 3D, on
// ramène chaque photo dans un repère commun : visage centré, yeux à une
// hauteur fixe, échelle constante. Sans cette étape, la projection est décalée
// dès que la photo n'est pas cadrée exactement comme l'image de test.
//
// MediaPipe FaceLandmarker tourne en WASM dans le navigateur (modèle et wasm
// servis depuis /public — aucun appel réseau externe).

import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/face_landmarker.task";

// Indices de repères dans le maillage MediaPipe (478 points).
const IDX = {
  eyeL: 468, // centre iris gauche (de la personne)
  eyeR: 473, // centre iris droit
  noseTip: 1,
  chin: 152,
  foreheadTop: 10,
} as const;

// Contour du visage (FACE_OVAL) : sert à découper le visage et à jeter le
// décor. Sans ce masque, le fond de la photo (mur, ciel, intérieur) se
// retrouve projeté sur les tempes et les côtés du crâne.
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109,
];

export const CROP_SIZE = 512;

// Cadrage cible, en fraction de l'image de sortie. Ces valeurs définissent la
// convention partagée avec le projecteur 3D : les yeux tombent toujours ici.
// Réglés pour que le cadre couvre toute la tête (front → menton), et non le
// seul masque facial : le projecteur 3D cadre la tête entière.
const TARGET_EYE_Y = 0.45;
const TARGET_EYE_DX = 0.155; // demi-écart interoculaire visé (photo de face)

export interface CropResult {
  canvas: HTMLCanvasElement;
  /** Écart interoculaire en pixels source — sert à détecter un profil. */
  eyeDist: number;
  /** Vrai si le visage est vu de profil (un œil très proche du bord). */
  isProfile: boolean;
  /** Teinte moyenne de la zone joue/front, en [0,1] — base d'harmonisation. */
  meanColor: [number, number, number];
}

// Points du maillage tombant sur de la peau franche (joues, front, menton),
// utilisés pour mesurer la carnation. Échantillonner une zone fixe du cadre
// ne marche pas : de profil, le visage est décalé et la zone tombe sur le
// décor, ce qui teintait le fond du recadrage en couleur de mur.
const SKIN_POINTS = [50, 280, 101, 330, 10, 151, 152, 234, 454];

/**
 * Carnation médiane mesurée sur l'image source aux points de peau détectés.
 * Les trois photos étant prises sous des lumières différentes, elle sert à
 * les ramener à une teinte commune — sinon les raccords entre projections
 * sautent aux yeux.
 */
function skinColorFromLandmarks(
  img: HTMLImageElement,
  at: (i: number) => { x: number; y: number }
): [number, number, number] {
  const probe = document.createElement("canvas");
  probe.width = img.naturalWidth;
  probe.height = img.naturalHeight;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  if (!pctx) return [0.78, 0.53, 0.31];
  pctx.drawImage(img, 0, 0);

  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const R = Math.max(2, Math.round(Math.min(probe.width, probe.height) * 0.01));
  for (const idx of SKIN_POINTS) {
    const p = at(idx);
    const x = Math.round(p.x) - R;
    const y = Math.round(p.y) - R;
    if (x < 0 || y < 0 || x + 2 * R >= probe.width || y + 2 * R >= probe.height) continue;
    const { data } = pctx.getImageData(x, y, 2 * R, 2 * R);
    for (let i = 0; i < data.length; i += 4) {
      const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (lum < 40) continue; // cheveux, ombres dures
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    }
  }
  if (rs.length === 0) return [0.78, 0.53, 0.31];
  const med = (a: number[]) => {
    a.sort((x, y) => x - y);
    return a[Math.floor(a.length / 2)] / 255;
  };
  return [med(rs), med(gs), med(bs)];
}

let landmarkerPromise: Promise<FaceLandmarkerType> | null = null;

async function getLandmarker(): Promise<FaceLandmarkerType> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_PATH },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    })();
  }
  return landmarkerPromise;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image illisible: ${src}`));
    img.src = src;
  });
}

/**
 * Détecte le visage dans `src` et renvoie un canvas carré recadré, visage
 * centré et mis à l'échelle. Renvoie `null` si aucun visage n'est trouvé —
 * l'appelant peut alors utiliser la photo brute et prévenir l'utilisateur.
 */
export async function detectAndCrop(src: string): Promise<CropResult | null> {
  const img = await loadImage(src);
  const landmarker = await getLandmarker();
  const res = landmarker.detect(img);
  const lm = res.faceLandmarks?.[0];
  if (!lm) return null;

  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const px = (i: number) => ({ x: lm[i].x * W, y: lm[i].y * H });

  const eyeL = px(IDX.eyeL);
  const eyeR = px(IDX.eyeR);
  const chin = px(IDX.chin);
  const brow = px(IDX.foreheadTop);

  const eyeMid = { x: (eyeL.x + eyeR.x) / 2, y: (eyeL.y + eyeR.y) / 2 };
  const eyeDist = Math.hypot(eyeL.x - eyeR.x, eyeL.y - eyeR.y);
  const faceH = Math.hypot(chin.x - brow.x, chin.y - brow.y);

  // De profil, les deux iris se superposent : l'écart interoculaire s'effondre
  // devant la hauteur du visage. On bascule alors sur la hauteur pour fixer
  // l'échelle, sinon le recadrage exploserait.
  const isProfile = eyeDist < faceH * 0.28;
  const scale = isProfile
    ? (CROP_SIZE * 0.78) / faceH
    : (CROP_SIZE * TARGET_EYE_DX * 2) / eyeDist;

  // Redresse l'inclinaison de la tête (roulis) d'après la ligne des yeux.
  const roll = isProfile ? 0 : Math.atan2(eyeR.y - eyeL.y, eyeR.x - eyeL.x);

  const canvas = document.createElement("canvas");
  canvas.width = CROP_SIZE;
  canvas.height = CROP_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Transformation commune : le point de référence (milieu des yeux, ou nez
  // de profil) tombe au point cible du cadre, puis rotation et échelle.
  const anchor = isProfile ? px(IDX.noseTip) : eyeMid;
  const applyTransform = (c: CanvasRenderingContext2D) => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.translate(CROP_SIZE / 2, CROP_SIZE * TARGET_EYE_Y);
    c.rotate(-roll);
    c.scale(scale, scale);
    c.translate(-anchor.x, -anchor.y);
  };

  // 1. Photo transformée, sur un calque à part.
  const layer = document.createElement("canvas");
  layer.width = CROP_SIZE;
  layer.height = CROP_SIZE;
  const lctx = layer.getContext("2d");
  if (!lctx) return null;
  applyTransform(lctx);
  lctx.drawImage(img, 0, 0);
  lctx.setTransform(1, 0, 0, 1, 0, 0);

  // 2. Masque du contour du visage, un peu dilaté (pour garder les oreilles
  //    et la naissance des cheveux) et flouté pour un bord progressif.
  const mask = document.createElement("canvas");
  mask.width = CROP_SIZE;
  mask.height = CROP_SIZE;
  const mctx = mask.getContext("2d");
  if (!mctx) return null;
  const oval = FACE_OVAL.map((i) => px(i));
  const cx = oval.reduce((s, p) => s + p.x, 0) / oval.length;
  const cy = oval.reduce((s, p) => s + p.y, 0) / oval.length;
  const GROW = 1.18;
  applyTransform(mctx);
  mctx.beginPath();
  oval.forEach((p, i) => {
    const gx = cx + (p.x - cx) * GROW;
    const gy = cy + (p.y - cy) * GROW;
    if (i === 0) mctx.moveTo(gx, gy);
    else mctx.lineTo(gx, gy);
  });
  mctx.closePath();
  mctx.fillStyle = "#fff";
  mctx.fill();
  mctx.setTransform(1, 0, 0, 1, 0, 0);

  // 3. Ne garder de la photo que l'intérieur du masque.
  lctx.globalCompositeOperation = "destination-in";
  lctx.filter = "blur(6px)";
  lctx.drawImage(mask, 0, 0);
  lctx.filter = "none";
  lctx.globalCompositeOperation = "source-over";

  // 4. Composer sur un fond de carnation : hors du visage, plus aucun décor.
  const skin = skinColorFromLandmarks(img, px);
  ctx.fillStyle = `rgb(${skin.map((c) => Math.round(c * 255)).join(",")})`;
  ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);
  ctx.drawImage(layer, 0, 0);

  return { canvas, eyeDist, isProfile, meanColor: skin };
}

export interface PreparedPhoto {
  url: string;
  meanColor: [number, number, number];
  isProfile: boolean;
  /** Faux si aucun visage n'a été trouvé (photo utilisée telle quelle). */
  detected: boolean;
}

/**
 * Recadre `src` et renvoie de quoi le projeter : data URL + teinte moyenne.
 * Si aucun visage n'est détecté, renvoie la photo d'origine avec `detected`
 * à faux pour que l'appelant puisse le signaler.
 */
export async function preparePhoto(src: string): Promise<PreparedPhoto> {
  const out = await detectAndCrop(src);
  if (!out) {
    return { url: src, meanColor: [0.78, 0.53, 0.31], isProfile: false, detected: false };
  }
  return {
    url: out.canvas.toDataURL("image/png"),
    meanColor: out.meanColor,
    isProfile: out.isProfile,
    detected: true,
  };
}
