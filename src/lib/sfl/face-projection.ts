// Matériau de projection photo -> visage.
//
// Trois photos (face, profil gauche, profil droit) sont projetées sur la tête
// depuis trois caméras orthographiques. Chaque point de la surface prend une
// moyenne pondérée des photos qui le « voient », la face l'emportant nettement
// de trois quarts avant. Les photos sont supposées déjà normalisées par
// face-crop (visage centré, décor découpé, échelle constante).

import * as THREE from "three";
import type { PreparedPhoto } from "./face-crop";

export interface FacePhotos {
  front: PreparedPhoto;
  left: PreparedPhoto;
  right: PreparedPhoto;
}

/**
 * Repères du visage en coordonnées objet (pose de repos). Le cadrage de la
 * projection est calé sur les yeux : c'est le seul point commun fiable entre
 * le modèle 3D et une photo, et face-crop place justement les yeux à une
 * position connue du recadrage.
 */
export interface HeadFrame {
  topY: number;
  faceZ: number;
  chinY: number;
  /** Hauteur des yeux du modèle. */
  eyesY: number;
  /** Écart entre les centres des deux yeux, en mètres. */
  interocular: number;
}

/** Convention de face-crop : où tombent les yeux dans l'image recadrée. */
const CROP_EYE_FROM_TOP = 0.45;
const CROP_INTEROCULAR = 0.31; // fraction de la largeur de l'image

/**
 * Repères de la tête pris sur la géométrie du corps en pose de repos.
 *
 * Surtout pas la bbox de la scène : elle inclut la crête de cheveux et les
 * coques de contour, et elle bouge avec l'animation et l'échelle choisie —
 * le visage projeté se retrouverait décalé et rétréci.
 */
export function headFrame(root: THREE.Object3D): HeadFrame {
  let body: THREE.Mesh | null = null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!(m as unknown as { isMesh?: boolean }).isMesh) return;
    const base = m.name.replace(/__outline$/, "");
    if (base.startsWith("Cheveux") || base === "Traits") return;
    if (m.name.endsWith("__outline")) return;
    if (!body || m.geometry.attributes.position.count > body.geometry.attributes.position.count) {
      body = m;
    }
  });
  const fallback: HeadFrame = {
    topY: 1.98,
    faceZ: 0.15,
    chinY: 1.75,
    eyesY: 1.854,
    interocular: 0.076,
  };
  if (!body) return fallback;

  const geom = (body as THREE.Mesh).geometry;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const box = geom.boundingBox as THREE.Box3;
  const topY = box.max.y;

  // Yeux : le GLB porte une primitive dédiée (matériau « Eyes »). On moyenne
  // séparément les deux globes pour obtenir l'écart entre leurs centres.
  let eyesY = fallback.eyesY;
  let interocular = fallback.interocular;
  let eyeMesh: THREE.Mesh | null = null;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!(m as unknown as { isMesh?: boolean }).isMesh) return;
    if (m.name.endsWith("__outline")) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.some((mm) => mm && mm.name === "Eyes")) eyeMesh = m;
  });
  if (eyeMesh) {
    const pos = (eyeMesh as THREE.Mesh).geometry.attributes.position;
    let lx = 0;
    let ln = 0;
    let rx = 0;
    let rn = 0;
    let sy = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      sy += pos.getY(i);
      if (x > 0) {
        lx += x;
        ln++;
      } else {
        rx += x;
        rn++;
      }
    }
    if (ln > 0 && rn > 0) {
      interocular = Math.abs(lx / ln - rx / rn);
      eyesY = sy / pos.count;
    }
  }

  return { topY, faceZ: box.max.z, chinY: topY - 0.24, eyesY, interocular };
}

function projMatrix(pos: THREE.Vector3, target: THREE.Vector3, hw: number, hh: number) {
  const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.01, 4);
  cam.position.copy(pos);
  cam.up.set(0, 1, 0);
  cam.lookAt(target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  return new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
}

/** Ramène une photo à la carnation de référence (celle de la photo de face). */
function tintCorrection(ref: [number, number, number], other: [number, number, number]) {
  return new THREE.Vector3(
    THREE.MathUtils.clamp(ref[0] / Math.max(other[0], 0.03), 0.6, 1.6),
    THREE.MathUtils.clamp(ref[1] / Math.max(other[1], 0.03), 0.6, 1.6),
    THREE.MathUtils.clamp(ref[2] / Math.max(other[2], 0.03), 0.6, 1.6)
  );
}

// La projection est calculée sur la position de REPOS du vertex (espace
// objet), pas sur sa position animée : la texture est ainsi peinte une fois
// pour toutes sur le maillage et suit ensuite le squelette, comme le ferait
// une UV map. Projeter en espace monde ferait glisser le visage à chaque
// mouvement de tête et dépendrait de l'échelle choisie.
// Le déplacement du vertex (skinning + morphs) reste géré normalement pour
// gl_Position, via les blocs standard de Three.js.
const VERTEX = /* glsl */ `
  varying vec4 vF; varying vec4 vL; varying vec4 vR;
  varying vec3 vN; varying vec3 vRestPos;
  uniform mat4 uMFront; uniform mat4 uMLeft; uniform mat4 uMRight;
  #include <common>
  #include <skinning_pars_vertex>
  #include <morphtarget_pars_vertex>
  void main() {
    vec4 restPos = vec4(position, 1.0);
    vF = uMFront * restPos; vL = uMLeft * restPos; vR = uMRight * restPos;
    vN = normalize(normal);
    vRestPos = position;

    #include <beginnormal_vertex>
    #include <morphnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <defaultnormal_vertex>
    #include <begin_vertex>
    #include <morphtarget_vertex>
    #include <skinning_vertex>
    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uFront; uniform sampler2D uLeft; uniform sampler2D uRight;
  uniform vec3 uCorrL; uniform vec3 uCorrR;
  uniform vec3 uSkin; uniform float uChinY; uniform float uTopY;
  varying vec4 vF; varying vec4 vL; varying vec4 vR;
  varying vec3 vN; varying vec3 vRestPos;

  vec4 sp(sampler2D tex, vec4 p, vec3 d) {
    vec2 uv = (p.xy / p.w) * 0.5 + 0.5;
    vec2 edge = min(uv, 1.0 - uv);
    float inR = smoothstep(0.0, 0.06, min(edge.x, edge.y));
    float f = max(0.0, dot(normalize(vN), normalize(d)));
    return vec4(texture2D(tex, uv).rgb, inR * f);
  }

  void main() {
    vec4 sf = sp(uFront, vF, vec3(0.0, 0.0, 1.0));
    vec4 sl = sp(uLeft,  vL, vec3(1.0, 0.0, 0.0));
    vec4 sr = sp(uRight, vR, vec3(-1.0, 0.0, 0.0));
    sl.rgb *= uCorrL;
    sr.rgb *= uCorrR;

    float wf = pow(sf.a, 2.0) * 2.2;
    float wl = pow(sl.a, 4.0);
    float wr = pow(sr.a, 4.0);
    float sum = wf + wl + wr;
    vec3 photo = uSkin;
    if (sum > 0.0001) photo = (sf.rgb * wf + sl.rgb * wl + sr.rgb * wr) / sum;

    float cover = smoothstep(0.02, 0.25, sum);
    float headMask = smoothstep(uChinY - 0.035, uChinY + 0.045, vRestPos.y)
                   * (1.0 - smoothstep(uTopY - 0.06, uTopY - 0.005, vRestPos.y));
    float backFade = smoothstep(-0.10, 0.0, vRestPos.z);
    vec3 col = mix(uSkin, photo, cover * headMask * backFade);

    // Bandes de lumière façon cel-shading, pour rester dans le style du jeu.
    float ndl = max(0.0, dot(normalize(vN), normalize(vec3(0.35, 0.5, 0.75))));
    float band = ndl < 0.35 ? 0.72 : (ndl < 0.72 ? 0.88 : 1.0);
    gl_FragColor = vec4(col * band, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * Matériau projetant `photos` sur la tête. `skin` sert de repli partout où
 * aucune photo ne porte (arrière du crâne, corps).
 */
export function makeFaceProjectionMaterial(
  photos: FacePhotos,
  textures: { front: THREE.Texture; left: THREE.Texture; right: THREE.Texture },
  frame: HeadFrame,
  skin: THREE.Color
): THREE.ShaderMaterial {
  for (const t of [textures.front, textures.left, textures.right]) {
    t.colorSpace = THREE.SRGBColorSpace;
  }
  // Cadrage déduit des mesures : on impose que l'écart interoculaire du
  // modèle occupe la même fraction du cadre que dans la photo recadrée, et
  // que les yeux tombent à la même hauteur relative. Sans ce calage, le
  // visage projeté est décalé et à la mauvaise échelle.
  const hw = frame.interocular / (2 * CROP_INTEROCULAR);
  const hh = hw; // les recadrages sont carrés
  const eyeV = 1 - CROP_EYE_FROM_TOP; // flipY : v=0 est en bas de l'image
  const cY = frame.eyesY - (eyeV - 0.5) * 2 * hh;
  const D = 0.6;

  return new THREE.ShaderMaterial({
    uniforms: {
      uFront: { value: textures.front },
      uLeft: { value: textures.left },
      uRight: { value: textures.right },
      uMFront: {
        value: projMatrix(
          new THREE.Vector3(0, cY, frame.faceZ + D),
          new THREE.Vector3(0, cY, frame.faceZ),
          hw,
          hh
        ),
      },
      uMLeft: {
        value: projMatrix(
          new THREE.Vector3(D, cY, frame.faceZ * 0.4),
          new THREE.Vector3(0, cY, frame.faceZ * 0.4),
          hw,
          hh
        ),
      },
      uMRight: {
        value: projMatrix(
          new THREE.Vector3(-D, cY, frame.faceZ * 0.4),
          new THREE.Vector3(0, cY, frame.faceZ * 0.4),
          hw,
          hh
        ),
      },
      uCorrL: { value: tintCorrection(photos.front.meanColor, photos.left.meanColor) },
      uCorrR: { value: tintCorrection(photos.front.meanColor, photos.right.meanColor) },
      uSkin: { value: skin },
      uChinY: { value: frame.chinY },
      uTopY: { value: frame.topY },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
}
