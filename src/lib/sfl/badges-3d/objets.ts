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
  | "sablier"
  | "coupe-pepite"
  | "coupe-buteur"
  | "coupe-passeur"
  | "coupe-defenseur"
  | "coupe-mvp"
  | "coupe-engage"
  | "coupe-but";

export type Role = "corps" | "verre" | "sombre" | "noir";
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
  const m = lisser(g);
  // Les faces avant et arrière sont planes : leurs normales restent droites.
  // Sans ça, les sommets du bord, soudés au biseau, inclinent les grands
  // triangles de la face et y dessinent des rayures (l'étoile, 18/10).
  const pos = m.getAttribute("position");
  const nor = m.getAttribute("normal");
  const z = epaisseur / 2 + gonfle;
  for (let i = 0; i < pos.count; i++) {
    const pz = pos.getZ(i);
    if (Math.abs(Math.abs(pz) - z) < 1e-4) nor.setXYZ(i, 0, 0, Math.sign(pz));
  }
  nor.needsUpdate = true;
  return m;
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
  crampon: [0.5, 0.42, 0.06],
  cage: [0.2, -0.5, 0],
  trophee: [0.16, 0.3, 0],
  pepite: [0.42, 0.35, 0.08],
  etoile: [0.12, -0.32, 0.06],
  bouclier: [0.2, -0.5, 0],
  eclair: [0.18, -0.6, 0.12],
  terrain: [0.8, -0.5, 0],
  flamme: [0.16, -0.55, 0],
  sablier: [0.22, 0.4, 0.12],
  "coupe-pepite": [0.08, -0.38, 0],
  "coupe-buteur": [0.08, -0.38, 0],
  "coupe-passeur": [0.08, -0.38, 0],
  "coupe-defenseur": [0.08, -0.38, 0],
  "coupe-mvp": [0.08, -0.38, 0],
  "coupe-engage": [0.08, -0.38, 0],
  "coupe-but": [0.08, -0.38, 0],
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
 * Le crampon : une chaussure de foot basse et trapue, comme un objet de
 * collection. Tout part d'une seule surface (la tige), décrite le long du pied
 * (u, du talon à la pointe) par sa ligne du haut, sa largeur et sa section ;
 * la semelle, le col, les lacets, la marque et les crampons sont posés
 * exactement sur elle, sans rien qui flotte. Longueur : φ² fois la hauteur
 * de la tige.
 */
function crampon(): Piece[] {
  const lisse = (pts: [number, number][], u: number) => {
    for (let i = 1; i < pts.length; i++)
      if (u <= pts[i][0]) {
        const t = (u - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        const k = t * t * (3 - 2 * t);
        return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k;
      }
    return pts[pts.length - 1][1];
  };
  const H = 2 / (PHI * PHI); // hauteur de la tige au talon
  // La ligne du haut : le talon, le col, le cou-de-pied qui descend, la pointe ronde.
  const HAUT: [number, number][] = [[0, 0.82 * H], [0.08, H], [0.24, 0.98 * H], [0.4, 0.84 * H], [0.6, 0.62 * H], [0.8, 0.46 * H], [1, 0.36 * H]];
  const LARGE: [number, number][] = [[0, 0.26], [0.18, 0.29], [0.55, 0.36], [0.8, 0.35], [1, 0.25]];
  // Le dessous : plat, la pointe qui se relève (le « toe spring »), le talon un peu aussi.
  const BAS = (u: number) => (u > 0.72 ? ((u - 0.72) / 0.28) ** 2 * 0.1 : u < 0.08 ? ((0.08 - u) / 0.08) ** 2 * 0.02 : 0);
  const X = (u: number) => -1 + 2 * u;
  const bout = (u: number) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.42);
  const sp = (c: number, e: number) => Math.sign(c) * Math.pow(Math.abs(c), e);
  /** Un point de la tige : u le long du pied, v autour de la section (0,25 = le dessus, 0 = le côté +z). */
  const tige = (u: number, v: number, cible: THREE.Vector3) => {
    const a = v * Math.PI * 2;
    const yb = BAS(u);
    const yh = lisse(HAUT, u);
    const mid = (yb + yh) / 2;
    const k = bout(u);
    const sn = Math.sin(a);
    // Le dessus est rond, le dessous presque plat : une forme de pied, pas un galet.
    const ys = sn >= 0 ? sp(sn, 0.75) : sp(sn, 0.28);
    cible.set(X(u), mid + ((yh - yb) / 2) * k * ys, lisse(LARGE, u) * k * sp(Math.cos(a), 0.6));
  };
  const corps = new ParametricGeometry(tige, 200, 96);
  const normale = (u: number, v: number) => {
    const p = new THREE.Vector3();
    const du = new THREE.Vector3();
    const dv = new THREE.Vector3();
    tige(u, v, p);
    tige(u + 1e-3, v, du);
    tige(u, v + 1e-3, dv);
    const n = du.sub(p).cross(dv.sub(p)).normalize();
    // Vers l'extérieur : à l'opposé de l'axe du pied.
    const axe = new THREE.Vector3(X(u), (BAS(u) + lisse(HAUT, u)) / 2, 0);
    return n.dot(p.clone().sub(axe)) < 0 ? n.negate() : n;
  };
  // La semelle : une galette qui suit le dessous, un peu plus large que la tige.
  const semelle = new ParametricGeometry(
    (u, v, cible) => {
      const a = v * Math.PI * 2;
      const yb = BAS(u);
      const k = bout(u);
      cible.set(X(u) * 1.02, yb - 0.02 + 0.045 * k * sp(Math.sin(a), 0.3), (lisse(LARGE, u) * 1.05 + 0.012) * k * sp(Math.cos(a), 0.45));
    },
    160,
    48
  );
  // Les crampons : des plots coniques arrondis, sous la semelle, qui suivent sa courbe.
  const plots: THREE.BufferGeometry[] = [];
  for (const [u, z] of [[0.08, -0.13], [0.08, 0.13], [0.2, 0], [0.5, -0.21], [0.5, 0.21], [0.66, -0.22], [0.66, 0.22], [0.82, -0.12], [0.82, 0.12]]) {
    const c = tour([[0, 0.02], [0.08, 0.02], [0.065, -0.085], [0, -0.085]], 0.03, 28);
    c.translate(X(u), BAS(u) - 0.045, z);
    plots.push(c);
  }
  // Le col : l'ouverture, un creux sombre, bordée d'un bourrelet de métal, posés sur la tige.
  const bordure: THREE.Vector3[] = [];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const p = new THREE.Vector3();
    tige(0.16 + 0.11 * Math.cos(t), 0.25 + 0.12 * Math.sin(t), p);
    bordure.push(p);
  }
  const bourrelet = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bordure, true), 128, 0.035, 12, true);
  const centre = new THREE.Vector3();
  tige(0.16, 0.25, centre);
  centre.y -= 0.06;
  const creux: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = bordure[i];
    const b = bordure[(i + 1) % N];
    creux.push(...centre.toArray(), ...b.toArray(), ...a.toArray());
  }
  const ouverture = new THREE.BufferGeometry();
  ouverture.setAttribute("position", new THREE.Float32BufferAttribute(creux, 3));
  ouverture.computeVertexNormals();
  // Les lacets : cinq barrettes de verre en travers du cou-de-pied, d'un bord à l'autre.
  const lacets: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const u = 0.32 + i * 0.065;
    const g = new THREE.Vector3();
    const d = new THREE.Vector3();
    tige(u + 0.02, 0.25 + 0.085, g);
    tige(u - 0.02, 0.25 - 0.085, d);
    const n = normale(u, 0.25);
    g.addScaledVector(n, 0.02);
    d.addScaledVector(n, 0.02);
    const l = new THREE.CapsuleGeometry(0.03, g.distanceTo(d), 8, 16);
    l.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().sub(g).normalize()));
    l.translate((g.x + d.x) / 2, (g.y + d.y) / 2, (g.z + d.z) / 2);
    lacets.push(l);
  }
  // La marque, de chaque côté : le symbole BOLA posé à plat sur la tige, comme un équipementier.
  const cote = (k: number) => {
    const u = 0.5;
    const v = k > 0 ? 0.02 : 0.48;
    const p = new THREE.Vector3();
    tige(u, v, p);
    const n = normale(u, v);
    return poser(symbole(0.2, 0.035), p.addScaledVector(n, -0.012), n, k > 0 ? 0 : Math.PI);
  };
  return [
    { geo: mergeGeometries([corps, bourrelet].map(sansUv)), role: "corps" },
    { geo: mergeGeometries([semelle, ...plots, ouverture, cote(1), cote(-1)].map(sansUv)), role: "sombre" },
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


/* ------------------------ Les trophées de fin de saison ------------------------ */

// Les trophées d'une fin de saison ne sont pas des badges (Sabri, 22/10 : « il
// ne faut pas que ce soit des icônes comme les trophées de palier, il faut
// que ce soit de vrais trophées designés »). Ils suivent la planche « Tous les
// trophées & médailles » qu'il a envoyée le même soir : un socle noir en
// tronc de pyramide, une plaque de métal devant, et dessus une lame haute et
// asymétrique, gravée du rond central d'un terrain, qui porte une pierre
// taillée à facettes :
//   · Pépite d'Or → la lame de métal, une aile noire derrière, la pierre au sommet ;
//   · Buteur      → une aile de métal qui s'élance en courbe, une lame noire ;
//   · Passeur     → deux rubans de métal enroulés autour d'une tige ;
//   · MVP         → une lame noire entre deux ailes de métal en V ;
//   · Défensive   → un écu allongé, noir cerclé de métal, la pierre sombre ;
//   · Joueur engagé → une simple stèle noire, un filet de métal sur le côté.
// Le métal (or, argent, bronze) passe par la matière, comme pour les badges ;
// le noir reste noir. Hauteur de y = -1 (sous le socle) à environ 1.

/** Une lame plate et gonflée sur ses bords, dans le plan xy, centrée en z (sans recentrer x et y). */
function lame(shape: THREE.Shape, epaisseur: number, gonfle: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: epaisseur,
    bevelEnabled: true,
    bevelThickness: gonfle,
    bevelSize: gonfle * 0.85,
    bevelSegments: 8,
    curveSegments: 32,
  });
  g.translate(0, 0, -epaisseur / 2);
  const m = lisser(g);
  const pos = m.getAttribute("position");
  const nor = m.getAttribute("normal");
  const z = epaisseur / 2 + gonfle;
  for (let i = 0; i < pos.count; i++) {
    const pz = pos.getZ(i);
    if (Math.abs(Math.abs(pz) - z) < 1e-4) nor.setXYZ(i, 0, 0, Math.sign(pz));
  }
  nor.needsUpdate = true;
  return m;
}

/** Un contour fait de courbes : moveTo puis une suite de [x, y] ou de beziers [c1x, c1y, c2x, c2y, x, y]. */
function contour(depart: [number, number], pas: number[][]): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(...depart);
  for (const p of pas) {
    if (p.length === 2) s.lineTo(p[0], p[1]);
    else s.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
  }
  s.closePath();
  return s;
}

/** Remet des pièces à l'échelle et les pose : le bas de leur boîte à y = bas, centrées en x et z. */
function monter(pieces: Piece[], echelle: number, bas: number): Piece[] {
  const box = new THREE.Box3();
  for (const p of pieces) {
    p.geo.computeBoundingBox();
    box.union(p.geo.boundingBox!);
  }
  const c = box.getCenter(new THREE.Vector3());
  for (const p of pieces) {
    p.geo.translate(-c.x, -box.min.y, -c.z);
    p.geo.scale(echelle, echelle, echelle);
    p.geo.translate(0, bas, 0);
  }
  return pieces;
}

/** La pierre taillée : une boule à facettes, comme sur la planche. */
function pierre(cx: number, cy: number, r: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, 1).toNonIndexed();
  g.rotateY(0.3);
  g.rotateX(0.2);
  g.translate(cx, cy, 0);
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
}

/** Le rond central et la ligne médiane, gravés en fils sur la face d'une lame (z = devant). */
function gravure(cx: number, cy: number, z: number, rayon: number, haut: number, bas: number): THREE.BufferGeometry {
  const e = rayon * 0.07;
  const rond = new THREE.TorusGeometry(rayon, e, 8, 48);
  rond.translate(cx, cy, z);
  const ligne = (y0: number, y1: number) => {
    const c = new THREE.CapsuleGeometry(e, Math.max(0.001, y1 - y0), 3, 8);
    c.translate(cx, (y0 + y1) / 2, z);
    return c;
  };
  const point = new THREE.SphereGeometry(e * 1.6, 10, 8);
  point.translate(cx, cy, z);
  return mergeGeometries([rond, ligne(cy + rayon, haut), ligne(bas, cy - rayon), point].map(sansUv));
}

/**
 * Le socle : un tronc de pyramide noir à quatre pans, une marche fine dessus,
 * et la plaque de métal sur le pan de face (le symbole BOLA y est gravé).
 * Le dessus du socle est à y = HAUT.
 */
const HAUT = -0.48;
function socle(objet: Objet, large = 0.84): Piece[] {
  // Le pan de face regarde l'objectif : le tour est tourné pour qu'un pan, et
  // non une arête, lui fasse face.
  const d = face(objet);
  d.y = 0;
  d.normalize();
  const angle = Math.atan2(d.x, d.z) - Math.PI / 4;
  const R = 0.62 * large; // rayon au coin, en bas
  const r = 0.5 * large; // en haut
  const pied = -1;
  const pyramide = new THREE.LatheGeometry(
    [[0, pied], [R, pied], [r, HAUT - 0.05], [r * 0.92, HAUT - 0.05], [r * 0.92, HAUT], [0, HAUT]].map(([x, y]) => new THREE.Vector2(x, y)),
    4
  ).toNonIndexed();
  pyramide.rotateY(angle);
  pyramide.deleteAttribute("uv");
  pyramide.computeVertexNormals();
  // La plaque, sur le pan de face, penchée comme lui.
  const c = Math.cos(Math.PI / 4);
  const yp = pied + (HAUT - 0.05 - pied) * 0.48;
  const t = (yp - pied) / (HAUT - 0.05 - pied);
  const ap = (R + (r - R) * t) * c; // l'apothème : la distance du pan au centre
  const demi = ap * 0.62;
  const plaque = coussin(arrondi([[-demi, -0.11], [demi, -0.11], [demi, 0.11], [-demi, 0.11]], 0.02), 0.006, 0.012);
  const normale = d.clone().setY(((R - r) * c) / (HAUT - 0.05 - pied)).normalize();
  poser(plaque, d.clone().multiplyScalar(ap + 0.008).setY(yp), normale);
  const marque = poser(symbole(0.045, 0.014), d.clone().multiplyScalar(ap + 0.024).setY(yp + 0.03), normale);
  return [
    { geo: pyramide, role: "noir" },
    { geo: sansUv(plaque), role: "corps" },
    { geo: sansUv(marque), role: "noir" },
  ];
}

const EP = 0.05; // l'épaisseur des lames
const GO = 0.025; // leur bord gonflé
const DEVANT = EP / 2 + GO;

function coupePepite(): Piece[] {
  const corps = lame(
    contour([-0.2, HAUT], [[0.13, HAUT], [0.1, -0.1, 0.09, 0.25, 0.2, 0.5], [0.06, 0.38, -0.07, 0.38, -0.2, 0.47], [-0.1, 0.2, -0.24, -0.15, -0.2, HAUT]]),
    EP,
    GO
  );
  const aile = lame(contour([0.03, HAUT], [[0.27, HAUT], [0.3, 0.1, 0.27, 0.6, 0.34, 1.0], [0.25, 0.86], [0.2, 0.4, 0.12, -0.1, 0.03, HAUT]]), EP * 0.8, GO);
  aile.translate(0, 0, -0.06);
  return [
    ...socle("coupe-pepite"),
    { geo: mergeGeometries([corps, pierre(0, 0.62, 0.17)].map(sansUv)), role: "corps" },
    { geo: mergeGeometries([aile, gravure(-0.03, -0.02, DEVANT, 0.055, 0.32, HAUT + 0.06)].map(sansUv)), role: "noir" },
  ];
}

function coupeButeur(): Piece[] {
  const noire = lame(contour([-0.24, HAUT], [[0.02, HAUT], [-0.02, 0.43], [-0.2, 0.43], [-0.22, 0.0]]), EP, GO);
  const aile = lame(
    contour([-0.1, HAUT], [[0.16, HAUT], [0.3, -0.05, 0.26, 0.55, 0.44, 0.98], [0.3, 0.86], [0.18, 0.5, 0.1, 0.05, -0.1, HAUT]]),
    EP * 0.8,
    GO
  );
  aile.translate(0, 0, 0.05);
  return [
    ...socle("coupe-buteur"),
    { geo: mergeGeometries([aile, pierre(-0.11, 0.6, 0.17)].map(sansUv)), role: "corps" },
    { geo: noire, role: "noir" },
    { geo: gravure(-0.11, -0.05, DEVANT, 0.05, 0.4, HAUT + 0.06), role: "corps" },
  ];
}

function coupePasseur(): Piece[] {
  // Deux rubans enroulés l'un dans l'autre, de la base jusque sous la pierre.
  const ruban = (phase: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const y = HAUT + 0.02 + t * (0.92 - HAUT);
      const r = 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.08)) + 0.03;
      const a = phase + t * Math.PI * 2.2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.03, 10);
    g.scale(1, 1, 0.75);
    return g;
  };
  const tige = tour([[0, HAUT], [0.06, HAUT], [0.03, HAUT + 0.1], [0.025, 0.5], [0.05, 0.56], [0, 0.56]], 0.01, 48);
  return [
    ...socle("coupe-passeur"),
    { geo: mergeGeometries([ruban(0), ruban(Math.PI), pierre(0, 0.66, 0.16)].map(sansUv)), role: "corps" },
    { geo: tige, role: "noir" },
  ];
}

function coupeMvp(): Piece[] {
  const noire = lame(contour([-0.2, HAUT], [[0.2, HAUT], [0.14, 0.44], [0, 0.4], [-0.14, 0.44]]), EP, GO);
  const droite = lame(contour([0.06, HAUT], [[0.24, HAUT], [0.3, 0.3, 0.3, 0.7, 0.4, 0.98], [0.3, 0.9], [0.22, 0.5, 0.18, 0.1, 0.06, HAUT]]), EP * 0.7, GO);
  const gauche = lame(contour([-0.18, -0.1], [[-0.1, -0.1], [-0.14, 0.4, -0.2, 0.62, -0.3, 0.9], [-0.33, 0.86], [-0.24, 0.5, -0.2, 0.2, -0.18, -0.1]]), EP * 0.7, GO);
  droite.translate(0, 0, 0.05);
  gauche.translate(0, 0, 0.05);
  const berceau = new THREE.TorusGeometry(0.15, 0.022, 10, 48, Math.PI);
  berceau.rotateZ(Math.PI);
  berceau.translate(0, 0.6, 0);
  return [
    ...socle("coupe-mvp"),
    { geo: mergeGeometries([droite, gauche, berceau, pierre(0, 0.6, 0.15)].map(sansUv)), role: "corps" },
    { geo: noire, role: "noir" },
    { geo: gravure(0, 0.0, DEVANT, 0.055, 0.38, HAUT + 0.06), role: "corps" },
  ];
}

function coupeDefenseur(): Piece[] {
  const ecu = (k: number) =>
    contour([-0.23 * k, 0.5], [
      [-0.06 * k, 0.56], [0, 0.6], [0.06 * k, 0.56], [0.23 * k, 0.5],
      [0.24 * k, 0.1, 0.16 * k, -0.2, 0.09 * k, HAUT],
      [-0.09 * k, HAUT],
      [-0.16 * k, -0.2, -0.24 * k, 0.1, -0.23 * k, 0.5],
    ]);
  const noir = lame(ecu(1), EP, GO);
  const cadre = lame(ecu(1.14), EP * 0.6, GO);
  cadre.translate(0, 0, -0.04);
  return [
    ...socle("coupe-defenseur"),
    { geo: cadre, role: "corps" },
    { geo: mergeGeometries([noir, pierre(0, 0.76, 0.15)].map(sansUv)), role: "noir" },
    { geo: gravure(0, 0.05, DEVANT, 0.055, 0.5, HAUT + 0.06), role: "corps" },
  ];
}

function coupeEngage(): Piece[] {
  const stele = lame(contour([-0.26, HAUT], [[0.2, HAUT], [0.2, 0.92], [-0.26, 0.74]]), EP * 1.4, GO);
  const filet = lame(contour([0.14, HAUT], [[0.26, HAUT], [0.32, 1.0], [0.2, 0.86]]), EP, GO);
  filet.translate(0, 0, 0.04);
  return [
    ...socle("coupe-engage"),
    { geo: filet, role: "corps" },
    { geo: stele, role: "noir" },
    { geo: gravure(-0.03, 0.12, DEVANT + 0.01, 0.06, 0.6, HAUT + 0.06), role: "corps" },
  ];
}
/** But d'exception : une lame noire, un filet de cage gravé dessus, une aile de métal et le ballon au sommet. */
function coupeBut(): Piece[] {
  const noire = lame(contour([-0.2, HAUT], [[0.24, HAUT], [0.26, 0.92], [0.12, 0.98], [-0.04, 0.5], [-0.2, 0.36]]), EP, GO);
  const aile = lame(contour([-0.26, HAUT], [[-0.16, HAUT], [-0.1, 0.05, 0.05, 0.4, 0.26, 0.62], [0.24, 0.68], [0.0, 0.5, -0.2, 0.2, -0.26, HAUT]]), EP * 0.7, GO);
  aile.translate(0, 0, 0.05);
  // Le filet : des fils croisés sur la face, sous l'aile.
  const fils: THREE.BufferGeometry[] = [];
  const fil = (ax: number, ay: number, bx: number, by: number) => {
    const a = new THREE.Vector3(ax, ay, DEVANT);
    const b = new THREE.Vector3(bx, by, DEVANT);
    const g = new THREE.CapsuleGeometry(0.006, a.distanceTo(b), 2, 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate((ax + bx) / 2, (ay + by) / 2, DEVANT);
    fils.push(g);
  };
  for (let i = 0; i < 6; i++) fil(-0.12 + i * 0.06, HAUT + 0.08, -0.12 + i * 0.06 + 0.06, 0.3);
  for (let i = 0; i < 6; i++) fil(-0.14, HAUT + 0.12 + i * 0.12, 0.2, HAUT + 0.2 + i * 0.12);
  const ballon = monter(FABRIQUES.ballon(), 0.13, 0.62);
  for (const p of ballon) p.geo.translate(0.14, 0, 0.02);
  return [
    ...socle("coupe-but"),
    { geo: noire, role: "noir" },
    { geo: mergeGeometries([aile, ...fils].map(sansUv)), role: "corps" },
    ...ballon,
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
  "coupe-pepite": coupePepite,
  "coupe-buteur": coupeButeur,
  "coupe-passeur": coupePasseur,
  "coupe-defenseur": coupeDefenseur,
  "coupe-mvp": coupeMvp,
  "coupe-engage": coupeEngage,
  "coupe-but": coupeBut,
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
