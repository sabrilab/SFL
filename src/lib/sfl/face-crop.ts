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

  // Fond neutre : ce qui déborde du visage ne doit pas ramener le décor.
  ctx.fillStyle = "#c98850";
  ctx.fillRect(0, 0, CROP_SIZE, CROP_SIZE);

  // On place le point de référence (milieu des yeux, ou nez de profil) au
  // point cible du cadre, puis on applique rotation et échelle autour de lui.
  const anchor = isProfile ? px(IDX.noseTip) : eyeMid;
  ctx.translate(CROP_SIZE / 2, CROP_SIZE * TARGET_EYE_Y);
  ctx.rotate(-roll);
  ctx.scale(scale, scale);
  ctx.translate(-anchor.x, -anchor.y);
  ctx.drawImage(img, 0, 0);

  return { canvas, eyeDist, isProfile };
}

/** Recadre `src` et renvoie une data URL prête à charger comme texture. */
export async function cropToDataUrl(src: string): Promise<string | null> {
  const out = await detectAndCrop(src);
  return out ? out.canvas.toDataURL("image/png") : null;
}
