"use client";

// Le rendu des badges en 3D : chrome irisé et verre, sur les reflets bleu,
// violet et orange des images de référence de Sabri (18/10).
//
// Deux usages, une seule recette :
//   · les images — un seul moteur WebGL, hors écran, pour toute l'app : il
//     photographie chaque objet dans chaque métal une fois (une image PNG
//     transparente, gardée en mémoire), puis l'image sert partout (la carte,
//     la vitrine, la feuille de choix). Des dizaines de cartes à l'écran ne
//     coûtent donc rien de plus qu'une image, et la carte 3D (card-3d.tsx),
//     photographiée par html-to-image, les reprend telles quelles ;
//   · le badge vivant (badge-3d.tsx) — la même scène, qui tourne, dans la
//     feuille d'un badge, montée seulement tant qu'elle est ouverte.
//
// La lumière vient d'un studio inventé, sans fichier à télécharger : quelques
// panneaux lumineux (bleu, violet, orange, blanc) autour d'un fond noir,
// figés une fois en carte d'environnement (PMREM). Les métaux s'y reflètent ;
// l'irisation (iridescence) donne les reflets de film d'huile du chrome.
//
// Le métal dit le niveau, comme avant : or, argent, bronze, et au dernier
// palier le rouge et or (corps rouge, pièces sombres en or). « fantome » est
// le badge pas encore gagné : tout en verre dépoli, sans couleur.

import * as THREE from "three";
import { piecesDe, POSE, type Objet, type Role } from "./objets";
import type { Metal } from "@/lib/sfl/trophees";

export type Matiere = Metal | "fantome";


const CORPS: Record<Metal, string> = {
  or: "#ffbf3a",
  argent: "#f2f5fa",
  bronze: "#d9773a",
  legende: "#e2281f",
};

/* -------------------------------- Le studio ------------------------------- */

/** La carte d'environnement : un fond noir et des panneaux de lumière colorée. */
export function environnement(renderer: THREE.WebGLRenderer): THREE.Texture {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#040406");
  // Des boîtes à lumière de studio : le centre franc, les bords qui tombent
  // doucement (un dégradé radial en texture), pour des reflets lisses.
  const toile = document.createElement("canvas");
  toile.width = toile.height = 128;
  const ctx = toile.getContext("2d")!;
  const deg = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  deg.addColorStop(0, "#fff");
  deg.addColorStop(0.55, "#bbb");
  deg.addColorStop(1, "#000");
  ctx.fillStyle = deg;
  ctx.fillRect(0, 0, 128, 128);
  const doux = new THREE.CanvasTexture(toile);
  doux.colorSpace = THREE.SRGBColorSpace;
  const panneau = (couleur: string, force: number, w: number, h: number, x: number, y: number, z: number) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(couleur).multiplyScalar(force), map: doux, side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z);
    p.lookAt(0, 0, 0);
    scene.add(p);
  };
  panneau("#ffffff", 14, 8, 4, 0, 7, 4); // la boîte à lumière, au-dessus, devant
  panneau("#ffffff", 10, 1.2, 10, 5, 0, 5.5); // un filet blanc, de côté
  panneau("#fff6ee", 4.2, 18, 12, 0, 0, 9); // un grand voile doux, face à l'objet
  // Un grand voile blanc à gauche : les faces planes, tournées de trois quarts,
  // s'y reflètent et prennent la couleur franche du métal.
  panneau("#f4f1ff", 3.6, 10, 8, -8, 0.5, 4);
  panneau("#ffffff", 3, 12, 12, 0, 9, -1); // le plafond : le dessus des objets à plat
  panneau("#f2f0ff", 3.4, 8, 8, -6, 6, 1); // en haut à gauche : les facettes tournées vers le haut
  panneau("#fff1e6", 2.2, 14, 8, 0, -8, 3); // le sol, doux : le dessous des pierres taillées
  // Les couleurs des références, derrière et sur les côtés : elles filent sur
  // les arêtes et les bords tournés, comme un contre-jour.
  panneau("#3b6cff", 9, 3, 10, -6, 1, -5); // le bleu, à gauche, derrière
  panneau("#9b4dff", 7, 6, 3, 3, 6, -5); // le violet, en haut, derrière
  panneau("#ff7a3d", 9, 3, 8, 6, -2, -4); // l'orange, à droite, derrière
  panneau("#ff4fa3", 4, 6, 3, -2, -7, -2); // un rose, sous l'objet
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.035).texture;
  pmrem.dispose();
  doux.dispose();
  scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return tex;
}

/** Les réglages communs du moteur : tons, couleurs. */
export function regler(renderer: THREE.WebGLRenderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
}

/* ------------------------------- Les matières ------------------------------ */

function chrome(couleur: string, irisation: number, rugosite = 0.16) {
  return new THREE.MeshPhysicalMaterial({
    color: couleur,
    metalness: 1,
    roughness: rugosite,
    iridescence: irisation,
    iridescenceIOR: 1.7,
    iridescenceThicknessRange: [180, 820],
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.25,
  });
}

function verre(couleur: string, opacite: number, rugosite = 0.05) {
  return new THREE.MeshPhysicalMaterial({
    color: couleur,
    metalness: 0,
    roughness: rugosite,
    transparent: true,
    opacity: opacite,
    iridescence: 1,
    iridescenceIOR: 1.5,
    iridescenceThicknessRange: [120, 640],
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

// Une carte d'environnement appartient à son moteur : les matières sont donc
// rangées par environnement.
const matieres = new WeakMap<THREE.Texture, Map<Matiere, Record<Role, THREE.MeshPhysicalMaterial>>>();

function matieresDe(m: Matiere, env: THREE.Texture): Record<Role, THREE.MeshPhysicalMaterial> {
  let parEnv = matieres.get(env);
  if (!parEnv) {
    parEnv = new Map();
    matieres.set(env, parEnv);
  }
  let r = parEnv.get(m);
  if (!r) {
    if (m === "fantome") {
      r = { corps: verre("#dfe3ea", 0.42, 0.32), verre: verre("#dfe3ea", 0.22, 0.32), sombre: verre("#9aa0a8", 0.4, 0.32) };
    } else {
      const corps = chrome(CORPS[m], m === "argent" ? 0.6 : 0.3);
      r = {
        corps,
        verre: verre(m === "legende" ? "#ffb4a8" : "#ffffff", 0.34),
        // Au rouge et or, les pièces sombres passent à l'or.
        sombre: m === "legende" ? chrome(CORPS.or, 0.3) : chrome("#1b1d24", 1, 0.2),
      };
    }
    for (const mat of Object.values(r)) mat.envMap = env;
    parEnv.set(m, r);
  }
  return r;
}

/** Libère un environnement et ses matières (le badge vivant, à sa fermeture). */
export function liberer(env: THREE.Texture) {
  for (const r of matieres.get(env)?.values() ?? []) for (const mat of Object.values(r)) mat.dispose();
  matieres.delete(env);
  env.dispose();
}

/** L'objet monté dans sa matière, dans sa pose. Les géométries et les matières sont partagées. */
export function construire(objet: Objet, m: Matiere, env: THREE.Texture): THREE.Group {
  const mats = matieresDe(m, env);
  const g = new THREE.Group();
  for (const p of piecesDe(objet)) {
    const mesh = new THREE.Mesh(p.geo, mats[p.role]);
    // Le verre après le reste, pour qu'on voie le chrome à travers.
    mesh.renderOrder = p.role === "verre" ? 1 : 0;
    g.add(mesh);
  }
  g.rotation.set(...POSE[objet]);
  return g;
}

/** La caméra : l'objet (boîte de 2) occupe presque tout le cadre. */
export function camera(): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  c.position.set(0, 0, 6.6);
  return c;
}

/** Une lumière blanche franche, pour l'éclat sur les arêtes. */
export function eclat(): THREE.DirectionalLight {
  const l = new THREE.DirectionalLight("#ffffff", 1.6);
  l.position.set(2, 4, 5);
  return l;
}

/* -------------------------------- Les images ------------------------------- */

/** Le côté des images, en pixels : net jusqu'à ~100 px à l'écran sur un iPhone. */
const COTE = 384;

const IMAGE_EVENT = "sfl-badge-3d";
export { IMAGE_EVENT };

const images = new Map<string, string>();
const aFaire = new Set<string>();
let revision = 0;
let moteur: { renderer: THREE.WebGLRenderer; env: THREE.Texture; scene: THREE.Scene; cam: THREE.PerspectiveCamera } | null = null;
let impossible = false;
let planifie = false;

function lancerMoteur() {
  if (moteur || impossible) return moteur;
  try {
    const canvas = document.createElement("canvas");
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: false });
    renderer.setPixelRatio(1);
    renderer.setSize(COTE, COTE, false);
    regler(renderer);
    const env = environnement(renderer);
    const scene = new THREE.Scene();
    scene.add(eclat());
    moteur = { renderer, env, scene, cam: camera() };
  } catch {
    impossible = true;
  }
  return moteur;
}

function photographier(cle: string) {
  const m = lancerMoteur();
  if (!m) return;
  const [objet, matiere] = cle.split(":") as [Objet, Matiere];
  const g = construire(objet, matiere, m.env);
  m.scene.add(g);
  m.renderer.render(m.scene, m.cam);
  images.set(cle, m.renderer.domElement.toDataURL("image/png"));
  m.scene.remove(g);
}

/** Photographie les objets demandés, quelques-uns à la fois, sans bloquer l'écran. */
function travailler() {
  planifie = false;
  const debut = performance.now();
  for (const cle of aFaire) {
    aFaire.delete(cle);
    photographier(cle);
    if (performance.now() - debut > 24) break;
  }
  revision++;
  window.dispatchEvent(new Event(IMAGE_EVENT));
  if (aFaire.size) planifier();
}

function planifier() {
  if (planifie) return;
  planifie = true;
  const ric = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  // Une image peinte d'abord : l'écran qui vient de demander le badge (la
  // pop-up d'une carte, avec sa photo) s'affiche avant que le moteur ne
  // prenne la main.
  requestAnimationFrame(() =>
    setTimeout(() => {
      if (ric) ric(travailler, { timeout: 120 });
      else travailler();
    }, 0)
  );
}

/**
 * L'image d'un objet dans une matière : une URL data: (PNG transparent), ou
 * null tant qu'elle n'est pas faite (elle est alors demandée, et IMAGE_EVENT
 * annoncera qu'elle est prête) ou si l'appareil n'a pas WebGL.
 */
export function imageBadge(objet: Objet, m: Matiere): string | null {
  const cle = `${objet}:${m}`;
  const deja = images.get(cle);
  if (deja) return deja;
  if (typeof window === "undefined" || impossible) return null;
  aFaire.add(cle);
  planifier();
  return null;
}

/** Change à chaque lot d'images prêtes : la carte 3D s'en sert pour recapturer. */
export function imageRevision(): number {
  return revision;
}

/** Vrai si l'appareil ne sait pas faire de 3D : les badges reprennent leurs emblèmes. */
export function sansTroisD(): boolean {
  return impossible;
}
