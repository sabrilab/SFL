// Les objets des badges, modelés en three.js (direction de Sabri, 18/10 :
// « utilise du three.js pour les badges, avec l'univers de Bola : des
// ballons, des crampons, des trophées, des buts »). Chaque badge est un objet
// de foot qui dit ce qu'il récompense ; le métal (or, argent, bronze, rouge et
// or) passe par la matière, voir rendu.ts.
//
// Tout est construit en code, sans modèle à télécharger : formes extrudées et
// biseautées, tours (lathe), tubes. Chaque objet tient dans une boîte
// d'environ 2 × 2 × 2 centrée sur l'origine. Les pièces portent un rôle
// (« corps », « verre », « sombre ») : rendu.ts leur donne leur matière.

import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ParametricGeometry } from "three/examples/jsm/geometries/ParametricGeometry.js";

export type Objet =
  | "ballon"
  | "crampon"
  | "cage"
  | "trophee"
  | "pepite"
  | "etoile"
  | "bouclier"
  | "eclair"
  | "terrain"
  | "flamme"
  | "sablier";

export type Role = "corps" | "verre" | "sombre";
export interface Piece {
  geo: THREE.BufferGeometry;
  role: Role;
}


/** Le nombre d'or : les proportions de chaque objet en découlent. */
const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * Lisse une géométrie extrudée : three la livre facette par facette ; on
 * soude les sommets confondus et on recalcule les normales, pour des biseaux
 * ronds et des reflets continus, comme un objet moulé puis poli.
 */
function lisser(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  const m = mergeVertices(g, 1e-5);
  m.computeVertexNormals();
  return m;
}

/** Un contour aux coins arrondis : les points du polygone et le rayon de chaque coin. */
function arrondi(pts: [number, number][], rayons: number | number[]): THREE.Shape {
  const n = pts.length;
  const s = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const p = new THREE.Vector2(...pts[i]);
    const da = new THREE.Vector2(...pts[(i + n - 1) % n]).sub(p);
    const db = new THREE.Vector2(...pts[(i + 1) % n]).sub(p);
    const r = Array.isArray(rayons) ? rayons[i] : rayons;
    const e = p.clone().add(da.clone().normalize().multiplyScalar(Math.min(r, da.length() * 0.45)));
    const f = p.clone().add(db.clone().normalize().multiplyScalar(Math.min(r, db.length() * 0.45)));
    if (i === 0) s.moveTo(e.x, e.y);
    else s.lineTo(e.x, e.y);
    s.quadraticCurveTo(p.x, p.y, f.x, f.y);
  }
  s.closePath();
  return s;
}

/**
 * Une forme gonflée, comme un coussin : une épaisseur fine et un grand
 * biseau rond tout autour. C'est ce qui rend les objets doux et ronds, des
 * bijoux plutôt que des pièces découpées. Centrée.
 */
function coussin(shape: THREE.Shape, epaisseur: number, gonfle: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: epaisseur,
    bevelEnabled: true,
    bevelThickness: gonfle,
    bevelSize: gonfle * 0.85,
    bevelSegments: 12,
    curveSegments: 24,
  });
  g.center();
  return lisser(g);
}

/** Un profil tourné, aux coins arrondis (rayon r) : socles, plateaux, colonnes. */
function tour(pts: [number, number][], r: number, pans = 96): THREE.BufferGeometry {
  const out: THREE.Vector2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = new THREE.Vector2(...pts[i]);
    if (i === 0 || i === pts.length - 1) {
      out.push(p);
      continue;
    }
    const da = new THREE.Vector2(...pts[i - 1]).sub(p);
    const db = new THREE.Vector2(...pts[i + 1]).sub(p);
    const e = p.clone().add(da.clone().normalize().multiplyScalar(Math.min(r, da.length() * 0.45)));
    const f = p.clone().add(db.clone().normalize().multiplyScalar(Math.min(r, db.length() * 0.45)));
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const a = (1 - t) * (1 - t);
      const b = 2 * (1 - t) * t;
      const c = t * t;
      out.push(new THREE.Vector2(a * e.x + b * p.x + c * f.x, a * e.y + b * p.y + c * f.y));
    }
  }
  return new THREE.LatheGeometry(out, pans);
}

/** Ramène un groupe de pièces dans une boîte de côté `taille`, centrée. */
function cadrer(pieces: Piece[], taille = 2): Piece[] {
  const box = new THREE.Box3();
  for (const p of pieces) {
    p.geo.computeBoundingBox();
    box.union(p.geo.boundingBox!);
  }
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const k = taille / Math.max(s.x, s.y, s.z);
  for (const p of pieces) {
    p.geo.translate(-c.x, -c.y, -c.z);
    p.geo.scale(k, k, k);
  }
  return pieces;
}

/* ----------------------------- Le symbole BOLA ----------------------------- */

/**
 * Le symbole BOLA (public/bola/symbole-noir.svg) : un disque que mord un
 * second cercle, la lune du logo. Les points du chemin SVG sont recopiés en
 * absolu, ramenés au cercle de rayon 1 centré sur l'origine (y vers le haut).
 * Il est gravé sur les objets comme la marque d'un équipementier.
 */
function formeSymbole(): THREE.Shape {
  const cx = 255.566;
  const cy = 255.531;
  const r = 195.567;
  const P = (x: number, y: number) => [(x - cx) / r, -(y - cy) / r] as const;
  const s = new THREE.Shape();
  s.moveTo(...P(451.133, 255.531));
  const c = (a: [number, number], b: [number, number], e: [number, number]) => s.bezierCurveTo(...P(...a), ...P(...b), ...P(...e));
  c([451.133, 147.522], [363.574, 59.964], [255.566, 59.964]);
  c([147.558, 59.964], [60, 147.522], [60, 255.531]);
  c([60, 363.54], [147.558, 451.097], [255.566, 451.097]);
  c([264.337, 451.097], [272.973, 450.52], [281.438, 449.401]);
  c([224.347, 439.749], [180.866, 390.067], [180.866, 330.231]);
  c([180.866, 263.478], [234.979, 209.364], [301.732, 209.364]);
  c([368.485, 209.364], [422.599, 263.478], [422.599, 330.231]);
  c([422.599, 342.437], [420.789, 354.221], [417.424, 365.329]);
  c([438.699, 334.028], [451.131, 296.232], [451.133, 255.531]);
  return s;
}

/** Le symbole en relief : rayon, épaisseur ; dos à z = 0, face vers +z. */
function symbole(rayon: number, epaisseur: number): THREE.BufferGeometry {
  const b = epaisseur * 0.35;
  const g = new THREE.ExtrudeGeometry(formeSymbole(), {
    depth: Math.max(0.001, (epaisseur - 2 * b) / rayon),
    bevelEnabled: true,
    bevelThickness: b / rayon,
    bevelSize: (b / rayon) * 0.6,
    bevelSegments: 3,
    curveSegments: 16,
  });
  g.translate(0, 0, b / rayon);
  g.scale(rayon, rayon, rayon);
  return lisser(g);
}

/** La même géométrie, sans index (pour la fusionner avec d'autres). */
function plat(g: THREE.BufferGeometry): THREE.BufferGeometry {
  return g.index ? g.toNonIndexed() : g;
}

/** Sans coordonnées de texture : pour fusionner avec une géométrie qui n'en a pas. */
function sansUv(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const r = plat(g);
  r.deleteAttribute("uv");
  return r;
}

/** Pose une géométrie (face vers +z) sur une surface : centre et direction de la normale. */
function poser(g: THREE.BufferGeometry, centre: THREE.Vector3, normale: THREE.Vector3, tourne = 0) {
  g.rotateZ(tourne);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normale.clone().normalize()));
  g.translate(centre.x, centre.y, centre.z);
  return g;
}

/** L'orientation de chaque objet à l'image : de trois quarts, pour que le relief se lise. */
export const POSE: Record<Objet, [number, number, number]> = {
  ballon: [0.42, 0.55, 0.1],
  crampon: [0.3, 0.22, 0.04],
  cage: [0.2, -0.5, 0],
  trophee: [0.16, 0.3, 0],
  pepite: [0.42, 0.35, 0.08],
  etoile: [0.12, -0.32, 0.06],
  bouclier: [0.2, -0.5, 0],
  eclair: [0.18, -0.6, 0.12],
  terrain: [0.8, -0.5, 0],
  flamme: [0.16, -0.55, 0],
  sablier: [0.22, 0.4, 0.12],
};

/** La direction, dans le repère de l'objet, qui fait face à la caméra une fois posé. */
function face(objet: Objet): THREE.Vector3 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...POSE[objet]));
  return new THREE.Vector3(0, 0, 1).applyQuaternion(q.invert());
}

/* --------------------------------- Ballon --------------------------------- */

/**
 * Le ballon : 32 panneaux bombés (12 pentagones, 20 hexagones) séparés par
 * des coutures creusées dans la sphère, comme un vrai ballon cousu. Chaque
 * point de la sphère appartient au panneau que touche son rayon sur
 * l'icosaèdre tronqué ; près du bord entre deux panneaux, la surface plonge.
 * Les pentagones sont en chrome sombre, les hexagones dans le métal.
 */
function ballon(): Piece[] {
  // Les centres des panneaux : sommets (pentagones) et faces (hexagones) d'un icosaèdre.
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const p = ico.getAttribute("position");
  const pentas: THREE.Vector3[] = [];
  const hexas: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i += 3) {
    const tri = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(p, i + k));
    for (const v of tri) if (!pentas.some((q) => q.distanceTo(v) < 1e-4)) pentas.push(v.clone().normalize());
    hexas.push(tri[0].clone().add(tri[1]).add(tri[2]).normalize());
  }
  // Distance du centre aux plans des faces d'un icosaèdre tronqué (arête 1).
  const faces = [
    ...pentas.map((n) => ({ n, h: 2.32744, penta: true })),
    ...hexas.map((n) => ({ n, h: 2.26728, penta: false })),
  ];
  const panneau = (d: THREE.Vector3) => {
    let s1 = -1;
    let s2 = -1;
    let f1 = 0;
    for (let f = 0; f < faces.length; f++) {
      const s = d.dot(faces[f].n) / faces[f].h;
      if (s > s1) {
        s2 = s1;
        s1 = s;
        f1 = f;
      } else if (s > s2) s2 = s;
    }
    return { f: f1, ecart: (s1 - s2) / s1 };
  };
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 32));
  const pos = g.getAttribute("position");
  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const { ecart } = panneau(d);
    // La couture : un sillon doux, et les panneaux un peu bombés.
    const sillon = Math.exp(-((ecart / 0.012) ** 2));
    const bombe = 1 - Math.exp(-ecart / 0.05);
    d.multiplyScalar(0.975 + 0.025 * bombe - 0.035 * sillon);
    pos.setXYZ(i, d.x, d.y, d.z);
  }
  g.computeVertexNormals();
  // On sépare les triangles : pentagones d'un côté, hexagones de l'autre.
  const plat = g.toNonIndexed();
  const P = plat.getAttribute("position");
  const N = plat.getAttribute("normal");
  const parts = { penta: { p: [] as number[], n: [] as number[] }, hexa: { p: [] as number[], n: [] as number[] } };
  const c = new THREE.Vector3();
  for (let i = 0; i < P.count; i += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(d.fromBufferAttribute(P, i + k));
    const cible = faces[panneau(c.normalize()).f].penta ? parts.penta : parts.hexa;
    for (let k = 0; k < 3; k++) {
      cible.p.push(P.getX(i + k), P.getY(i + k), P.getZ(i + k));
      cible.n.push(N.getX(i + k), N.getY(i + k), N.getZ(i + k));
    }
  }
  const geo = (x: { p: number[]; n: number[] }) => {
    const r = new THREE.BufferGeometry();
    r.setAttribute("position", new THREE.Float32BufferAttribute(x.p, 3));
    r.setAttribute("normal", new THREE.Float32BufferAttribute(x.n, 3));
    return r;
  };
  // La marque : le symbole BOLA sur l'hexagone qui fait face.
  const devant = face("ballon");
  const h0 = hexas.reduce((m, h) => (h.dot(devant) > m.dot(devant) ? h : m), hexas[0]);
  const marque = poser(symbole(0.17, 0.035), h0.clone().multiplyScalar(0.985), h0);
  return [
    { geo: geo(parts.hexa), role: "corps" },
    { geo: mergeGeometries([geo(parts.penta), sansUv(marque)]), role: "sombre" },
  ];
}

/* --------------------------------- Crampon -------------------------------- */

/**
 * Le crampon : une chaussure trapue, presque un jouet de collection — le pied
 * court, le talon haut, la pointe ronde. Sa longueur vaut environ φ fois sa
 * hauteur (semelle et crampons compris).
 */
function crampon(): Piece[] {
  // La chaussure, tirée d'une surface : le long du pied (u, du talon à la
  // pointe), une section en carré arrondi (v), dont la hauteur et la
  // largeur suivent le profil d'un crampon — talon, col, cou-de-pied qui
  // descend, pointe relevée. Les deux bouts se referment en douceur.
  const lerp = (pts: [number, number][], u: number) => {
    for (let i = 1; i < pts.length; i++)
      if (u <= pts[i][0]) {
        const t = (u - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        const k = t * t * (3 - 2 * t);
        return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k;
      }
    return pts[pts.length - 1][1];
  };
  const HAUT: [number, number][] = [[0, 0.56], [0.12, 0.98], [0.26, 0.95], [0.44, 0.66], [0.64, 0.48], [0.84, 0.38], [1, 0.3]];
  const LARGE: [number, number][] = [[0, 0.3], [0.2, 0.36], [0.55, 0.41], [0.8, 0.39], [1, 0.27]];
  const BAS = (u: number) => (u > 0.78 ? ((u - 0.78) / 0.22) ** 2 * 0.1 : 0);
  const X = (u: number) => -1 + 2 * u;
  const bout = (u: number) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.4);
  const sp = (c: number, e: number) => Math.sign(c) * Math.pow(Math.abs(c), e);
  const surface = (u: number, v: number, cible: THREE.Vector3) => {
    const a = v * Math.PI * 2;
    const yb = BAS(u);
    const yh = lerp(HAUT, u);
    const mid = (yb + yh) / 2;
    const k = bout(u);
    cible.set(X(u), mid + ((yh - yb) / 2) * k * sp(Math.sin(a), 0.6), lerp(LARGE, u) * k * sp(Math.cos(a), 0.6));
  };
  const corps = new ParametricGeometry(surface, 180, 72);
  // La semelle : le contour du pied, un peu plus large, en plaque ronde.
  const contour = new THREE.Shape();
  const N = 80;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const pt = [X(u), lerp(LARGE, u) * bout(u) * 1.06 + 0.015];
    if (i === 0) contour.moveTo(pt[0], pt[1]);
    else contour.lineTo(pt[0], pt[1]);
  }
  for (let i = N; i >= 0; i--) {
    const u = i / N;
    contour.lineTo(X(u), -(lerp(LARGE, u) * bout(u) * 1.06 + 0.015));
  }
  const semelle = lisser(
    new THREE.ExtrudeGeometry(contour, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 5, curveSegments: 4 })
  );
  semelle.rotateX(Math.PI / 2);
  semelle.translate(0, -0.005, 0);
  // Les crampons : des plots ronds sous la semelle.
  const plots: THREE.BufferGeometry[] = [];
  for (const [u, z] of [[0.08, -0.15], [0.08, 0.15], [0.22, 0], [0.55, -0.22], [0.55, 0.22], [0.72, -0.22], [0.72, 0.22], [0.88, 0]]) {
    const c = tour([[0, 0], [0.085, 0], [0.06, -0.14], [0, -0.14]], 0.035, 24);
    c.translate(X(u), -0.04, z);
    plots.push(c);
  }
  // La marque sur chaque côté : le symbole BOLA, comme un équipementier.
  const cote = (k: number) => {
    const u = 0.5;
    const p = new THREE.Vector3();
    surface(u, k > 0 ? 0 : 0.5, p);
    return poser(symbole(0.22, 0.05), new THREE.Vector3(X(u), 0.3, p.z - k * 0.014), new THREE.Vector3(0, 0, k), k > 0 ? 0 : Math.PI);
  };
  // L'ouverture du col, en creux sombre, et quatre lacets de verre en travers du cou-de-pied.
  const col = new THREE.SphereGeometry(1, 32, 12);
  col.scale(0.2, 0.035, 0.17);
  col.translate(X(0.17), lerp(HAUT, 0.17) - 0.012, 0);
  const lacets: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const u = 0.34 + i * 0.075;
    const l = new THREE.CapsuleGeometry(0.032, 0.34, 8, 16);
    l.rotateX(Math.PI / 2);
    l.rotateZ(-0.6);
    l.translate(X(u), lerp(HAUT, u) + 0.01, 0);
    lacets.push(l);
  }
  return [
    { geo: corps, role: "corps" },
    { geo: mergeGeometries([semelle, ...plots, col, cote(1), cote(-1)].map(sansUv)), role: "sombre" },
    { geo: mergeGeometries(lacets.map(sansUv)), role: "verre" },
  ];
}

/* ---------------------------------- Cage ---------------------------------- */

/**
 * La cage : un seul tube rond qui fait les poteaux et la barre, aux coins
 * courbés, le filet en verre. La largeur vaut φ² fois la hauteur (une vraie
 * cage de five est à peu près dans ces proportions), la profondeur h/φ.
 */
function cage(): Piece[] {
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const H = 0.9;
  const L = (H * PHI * PHI) / 2;
  const P = H / PHI;
  const r = 0.12;
  const c = 0.24;
  const cadre = new THREE.CurvePath<THREE.Vector3>();
  cadre.add(new THREE.LineCurve3(V(-L, 0, 0), V(-L, H - c, 0)));
  cadre.add(new THREE.QuadraticBezierCurve3(V(-L, H - c, 0), V(-L, H, 0), V(-L + c, H, 0)));
  cadre.add(new THREE.LineCurve3(V(-L + c, H, 0), V(L - c, H, 0)));
  cadre.add(new THREE.QuadraticBezierCurve3(V(L - c, H, 0), V(L, H, 0), V(L, H - c, 0)));
  cadre.add(new THREE.LineCurve3(V(L, H - c, 0), V(L, 0, 0)));
  const avant = new THREE.TubeGeometry(cadre, 240, r, 24, false);
  const tube = (a: THREE.Vector3, b: THREE.Vector3, rayon: number, pans = 16) => {
    const g = new THREE.CylinderGeometry(rayon, rayon, a.distanceTo(b), pans, 1, true);
    g.translate(0, a.distanceTo(b) / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate(a.x, a.y, a.z);
    return g;
  };
  const boule = (p: THREE.Vector3, rayon: number) => {
    const s = new THREE.SphereGeometry(rayon, 24, 16);
    s.translate(p.x, p.y, p.z);
    return s;
  };
  // L'arrière : deux montants qui descendent en biais, la barre du fond, des
  // rotules rondes aux jonctions et aux pieds.
  const rb = r * 0.62;
  const arriere = [
    tube(V(-L, H - c, 0), V(-L, 0, -P), rb),
    tube(V(L, H - c, 0), V(L, 0, -P), rb),
    tube(V(-L, 0, -P), V(L, 0, -P), rb),
    boule(V(-L, 0, -P), rb * 1.3),
    boule(V(L, 0, -P), rb * 1.3),
    boule(V(-L, 0, 0), r),
    boule(V(L, 0, 0), r),
  ];
  // Le filet : le toit incliné et les deux côtés, en verre.
  const filet = new THREE.BufferGeometry();
  const v = [
    -L, H, 0, L, H, 0, L, 0, -P, -L, H, 0, L, 0, -P, -L, 0, -P,
    -L, 0, 0, -L, H, 0, -L, 0, -P, L, 0, 0, L, 0, -P, L, H, 0,
  ];
  filet.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  filet.computeVertexNormals();
  // Les mailles : un quadrillage de fils sombres sur le toit.
  const mailles: THREE.BufferGeometry[] = [];
  for (let i = 1; i < 9; i++) {
    const x = -L + (2 * L * i) / 9;
    mailles.push(tube(V(x, H, 0), V(x, 0, -P), 0.018, 6));
  }
  for (let j = 1; j < 4; j++) {
    const t = j / 4;
    mailles.push(tube(V(-L, H * (1 - t), -P * t), V(L, H * (1 - t), -P * t), 0.018, 6));
  }
  return [
    { geo: mergeGeometries([avant, ...arriere].map(sansUv)), role: "corps" },
    { geo: filet, role: "verre" },
    { geo: mergeGeometries(mailles.map(sansUv)), role: "sombre" },
  ];
}

/* -------------------------------- Trophée --------------------------------- */

/**
 * Le trophée : une coupe ronde et généreuse, deux anses en anneau, un socle à
 * deux marches. La coupe et le pied sont dans le rapport φ (la coupe fait
 * 1/φ de la hauteur, le pied 1/φ²).
 */
function trophee(): Piece[] {
  // y va de -1 (sous le socle) à 1 (la lèvre) ; la coupe commence à 1 - 2/φ.
  const debut = 1 - 2 / PHI;
  const socle = tour([[0, -1], [0.54, -1], [0.54, -0.82], [0.42, -0.82], [0.42, -0.6], [0, -0.6]], 0.05);
  const courbe = new THREE.SplineCurve(
    [
      [0, -0.6], [0.13, -0.6], [0.08, -0.54], [0.06, -0.46], [0.13, -0.4], [0.07, -0.33],
      [0.11, debut], [0.36, debut + 0.07], [0.56, debut + 0.28], [0.68, 0.36], [0.71, 0.66],
      [0.69, 0.9], [0.74, 0.98], [0.69, 1.0], [0.62, 0.92], [0.6, 0.64], [0.48, 0.28],
      [0.22, 0.1], [0, 0.08],
    ].map(([x, y]) => new THREE.Vector2(x, y))
  );
  const coupe = new THREE.LatheGeometry(courbe.getPoints(140), 128);
  // Les anses : deux anneaux pleins, posés sur les flancs de la coupe.
  const anses = [-1, 1].map((k) => {
    const t = new THREE.TorusGeometry(0.27, 0.07, 24, 72, Math.PI * 1.3);
    t.rotateZ(-Math.PI * 0.65);
    if (k < 0) t.rotateZ(Math.PI);
    t.translate(k * 0.7, 0.5, 0);
    return t;
  });
  // Sur la coupe, face à l'objectif : le symbole BOLA en médaillon sombre.
  const d = face("trophee");
  d.y = 0;
  d.normalize();
  const marque = poser(symbole(0.22, 0.06), d.clone().multiplyScalar(0.69).setY(0.5), d.clone().setY(-0.05));
  return [
    { geo: mergeGeometries([coupe, ...anses].map(sansUv)), role: "corps" },
    { geo: mergeGeometries([socle, marque].map(sansUv)), role: "sombre" },
  ];
}

/* --------------------------------- Pépite --------------------------------- */

/**
 * La pépite d'or : une pierre taillée en brillant, seize pans. La table fait
 * 1/φ du diamètre ; le symbole BOLA y est gravé, 1/φ de la table.
 */
function pepite(): Piece[] {
  const t = 1 / PHI;
  const profil = [
    new THREE.Vector2(0, -0.95),
    new THREE.Vector2(t, -0.36),
    new THREE.Vector2(1, 0),
    new THREE.Vector2(1, 0.08),
    new THREE.Vector2(0.82, 0.28),
    new THREE.Vector2(t, 0.42),
    new THREE.Vector2(0, 0.42),
  ];
  const taille = new THREE.LatheGeometry(profil, 16).toNonIndexed();
  taille.computeVertexNormals();
  const marque = poser(symbole(t / PHI, 0.04), new THREE.Vector3(0, 0.415, 0), new THREE.Vector3(0, 1, 0));
  return [
    { geo: taille, role: "corps" },
    { geo: marque, role: "sombre" },
  ];
}

/* ------------------------ Formes plates, gonflées ------------------------- */

/** L'étoile : cinq branches dans le rapport du pentagramme (rayon intérieur 1/φ²), gonflée, le symbole au cœur. */
function etoile(): Piece[] {
  const pts: [number, number][] = [];
  const rayons: number[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 1 / (PHI * PHI) + 0.06 : 1;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    rayons.push(i % 2 ? 0.1 : 0.16);
  }
  const corps = coussin(arrondi(pts, rayons), 0.06, 0.24);
  const avant = (0.06 + 2 * 0.24) / 2;
  const marque = poser(symbole(0.2, 0.05), new THREE.Vector3(0, 0, avant - 0.01), new THREE.Vector3(0, 0, 1));
  return [
    { geo: corps, role: "corps" },
    { geo: marque, role: "sombre" },
  ];
}

/** Le bouclier : un écu gonflé (largeur φ/2 de la hauteur), un champ de verre bombé, et le symbole BOLA dessus. */
function bouclier(): Piece[] {
  const forme = (k: number) => {
    const w = PHI / 2;
    const s = new THREE.Shape();
    s.moveTo(0, 0.92 * k);
    s.bezierCurveTo(0.34 * k, 0.8 * k, 0.56 * k, 0.8 * k, w * k, 0.86 * k);
    s.bezierCurveTo((w + 0.02) * k, 0.4 * k, w * k, 0.1 * k, w * k, 0.06 * k);
    s.bezierCurveTo(w * k, -0.46 * k, 0.42 * k, -0.82 * k, 0, -1 * k);
    s.bezierCurveTo(-0.42 * k, -0.82 * k, -w * k, -0.46 * k, -w * k, 0.06 * k);
    s.bezierCurveTo(-w * k, 0.1 * k, -(w + 0.02) * k, 0.4 * k, -w * k, 0.86 * k);
    s.bezierCurveTo(-0.56 * k, 0.8 * k, -0.34 * k, 0.8 * k, 0, 0.92 * k);
    return s;
  };
  const corps = coussin(forme(1), 0.1, 0.17);
  const avant = (0.1 + 2 * 0.17) / 2;
  const champ = coussin(forme(1 / Math.sqrt(PHI)), 0.01, 0.06);
  champ.translate(0, 0.0, avant + 0.01);
  const marque = poser(symbole(0.36, 0.08), new THREE.Vector3(0, 0.02, avant + 0.06), new THREE.Vector3(0, 0, 1));
  return [
    { geo: mergeGeometries([corps, marque].map(sansUv)), role: "corps" },
    { geo: champ, role: "verre" },
  ];
}

/** L'éclair : deux traits brisés, gonflés, coins adoucis ; hauteur φ fois la largeur. */
function eclair(): Piece[] {
  const w = 1 / PHI;
  const s = arrondi(
    [[0.18, 1], [-w, -0.08], [-0.05, -0.08], [-0.3, -1], [w, 0.18], [0.05, 0.18]],
    [0.09, 0.08, 0.05, 0.09, 0.08, 0.05]
  );
  return [{ geo: coussin(s, 0.08, 0.14), role: "corps" }];
}

/**
 * Le terrain : une plaque gonflée dans le métal du badge, longue de φ fois sa
 * largeur, ses lignes en chrome sombre — le tour, la médiane, les surfaces,
 * le rond central (rayon largeur/φ³) et, au point central, le symbole BOLA.
 */
function terrain(): Piece[] {
  const L = 1.0;
  const l = 1 / PHI;
  const plateau = coussin(arrondi([[-L, -l], [L, -l], [L, l], [-L, l]], 0.2), 0.06, 0.08);
  plateau.rotateX(-Math.PI / 2);
  const haut = (0.06 + 2 * 0.08) / 2;
  // Les lignes : des fils ronds posés sur la plaque.
  const e = 0.028;
  const ligne = (ax: number, az: number, bx: number, bz: number) => {
    const a = new THREE.Vector3(ax, haut, az);
    const b = new THREE.Vector3(bx, haut, bz);
    const g = new THREE.CapsuleGeometry(e, a.distanceTo(b), 4, 10);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate((ax + bx) / 2, haut, (az + bz) / 2);
    return g;
  };
  const m = L - 0.17;
  const n = l - 0.15;
  const s = n / PHI; // demi-largeur des surfaces
  const p = 0.22; // profondeur des surfaces
  const lignes = [
    ligne(-m, -n, m, -n),
    ligne(-m, n, m, n),
    ligne(-m, -n, -m, n),
    ligne(m, -n, m, n),
    ligne(0, -n, 0, n),
    ligne(-m, -s, -m + p, -s),
    ligne(-m, s, -m + p, s),
    ligne(-m + p, -s, -m + p, s),
    ligne(m, -s, m - p, -s),
    ligne(m, s, m - p, s),
    ligne(m - p, -s, m - p, s),
  ];
  const rond = new THREE.TorusGeometry(l / PHI ** 2, e, 10, 72);
  rond.rotateX(Math.PI / 2);
  rond.translate(0, haut, 0);
  const point = poser(symbole(0.12, 0.05), new THREE.Vector3(0, haut - 0.01, 0), new THREE.Vector3(0, 1, 0), 0);
  return [
    { geo: plateau, role: "corps" },
    { geo: mergeGeometries([...lignes, rond, point].map(sansUv)), role: "sombre" },
  ];
}

function flamme(): Piece[] {
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(0.62, -1, 0.86, -0.5, 0.74, -0.06);
  s.bezierCurveTo(0.66, 0.26, 0.42, 0.42, 0.4, 0.74);
  s.bezierCurveTo(0.2, 0.5, 0.16, 0.36, 0.12, 0.2);
  s.bezierCurveTo(0.06, 0.52, -0.08, 0.8, -0.04, 1.0);
  s.bezierCurveTo(-0.5, 0.7, -0.78, 0.26, -0.76, -0.2);
  s.bezierCurveTo(-0.74, -0.64, -0.44, -1, 0, -1);
  const corps = coussin(s, 0.06, 0.22);
  const avant = (0.06 + 2 * 0.22) / 2;
  // Le cœur de la flamme, une goutte de verre bombée.
  const c = new THREE.Shape();
  c.moveTo(0, -0.78);
  c.bezierCurveTo(0.34, -0.78, 0.44, -0.46, 0.34, -0.2);
  c.bezierCurveTo(0.26, 0.0, 0.12, 0.08, 0.06, 0.26);
  c.bezierCurveTo(-0.22, 0.06, -0.38, -0.2, -0.36, -0.44);
  c.bezierCurveTo(-0.32, -0.66, -0.18, -0.78, 0, -0.78);
  const coeur = coussin(c, 0.01, 0.07);
  coeur.translate(0, -0.2, avant + 0.02);
  return [
    { geo: corps, role: "corps" },
    { geo: coeur, role: "verre" },
  ];
}

/** Le sablier : haut de φ fois sa largeur ; deux ampoules de verre, le sable qui coule, un cadre tourné. */
function sablier(): Piece[] {
  const k = 0.82; // les ampoules, rétrécies dans le cadre
  const ampoule = new THREE.SplineCurve(
    [[0.02, -0.84], [0.44, -0.8], [0.58, -0.56], [0.46, -0.24], [0.12, -0.05], [0.08, 0], [0.12, 0.05], [0.46, 0.24], [0.58, 0.56], [0.44, 0.8], [0.02, 0.84]].map(
      ([x, y]) => new THREE.Vector2(x * k, y)
    )
  );
  const verre = new THREE.LatheGeometry(ampoule.getPoints(90), 80);
  // Le sable : un tas en bas, un reste en haut, et le filet qui coule.
  const tas = new THREE.LatheGeometry(
    new THREE.SplineCurve([[0.01, -0.8], [0.4, -0.77], [0.52, -0.6], [0.3, -0.46], [0.01, -0.4]].map(([x, y]) => new THREE.Vector2(x * k, y))).getPoints(30),
    72
  );
  const reste = new THREE.LatheGeometry(
    new THREE.SplineCurve([[0.01, 0.12], [0.24, 0.22], [0.36, 0.34], [0.01, 0.34]].map(([x, y]) => new THREE.Vector2(x * k, y))).getPoints(20),
    72
  );
  const filet = new THREE.CylinderGeometry(0.014, 0.014, 0.5, 8);
  filet.translate(0, -0.18, 0);
  // Le cadre : deux plateaux épais aux bords ronds (diamètre 2/φ), trois colonnes tournées.
  const R = 1 / PHI;
  const plateau = (s: number) => {
    const p = tour([[0, -0.1], [R, -0.1], [R, 0.1], [0, 0.1]], 0.07);
    p.translate(0, s * 0.9, 0);
    return p;
  };
  const colonne = (i: number) => {
    const c = tour([[0, -0.82], [0.075, -0.82], [0.05, -0.62], [0.045, 0], [0.05, 0.62], [0.075, 0.82], [0, 0.82]], 0.03, 24);
    const a = (i * Math.PI * 2) / 3 + 0.4;
    c.translate(Math.cos(a) * (R - 0.1), 0, Math.sin(a) * (R - 0.1));
    return c;
  };
  // La marque, sur la tranche du plateau du haut, face à l'objectif.
  const d = face("sablier");
  d.y = 0;
  d.normalize();
  const marque = poser(symbole(0.075, 0.025), d.clone().multiplyScalar(R - 0.005).setY(0.9), d);
  return [
    { geo: mergeGeometries([plateau(-1), plateau(1), colonne(0), colonne(1), colonne(2)].map(sansUv)), role: "corps" },
    { geo: verre, role: "verre" },
    { geo: mergeGeometries([tas, reste, filet, marque].map(sansUv)), role: "sombre" },
  ];
}

const FABRIQUES: Record<Objet, () => Piece[]> = {
  ballon,
  crampon,
  cage,
  trophee,
  pepite,
  etoile,
  bouclier,
  eclair,
  terrain,
  flamme,
  sablier,
};

const cache = new Map<Objet, Piece[]>();

/** Les pièces d'un objet, cadrées dans une boîte de 2, construites une seule fois. */
export function piecesDe(objet: Objet): Piece[] {
  let p = cache.get(objet);
  if (!p) {
    p = cadrer(FABRIQUES[objet]());
    cache.set(objet, p);
  }
  return p;
}
