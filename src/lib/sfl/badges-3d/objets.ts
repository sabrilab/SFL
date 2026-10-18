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

const BISEAU = { bevelEnabled: true, bevelSegments: 5, curveSegments: 24 };

/** Une forme 2D extrudée, biseautée, centrée. */
function extrude(shape: THREE.Shape, profondeur: number, biseau: number): THREE.BufferGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    ...BISEAU,
    depth: profondeur,
    bevelThickness: biseau,
    bevelSize: biseau * 0.8,
  });
  g.center();
  g.computeVertexNormals();
  return g;
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
  return [
    { geo: geo(parts.hexa), role: "corps" },
    { geo: geo(parts.penta), role: "sombre" },
  ];
}

/* --------------------------------- Crampon -------------------------------- */

/** Le crampon : la chaussure de profil, extrudée, sa semelle et ses crampons. */
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
  const HAUT: [number, number][] = [[0, 0.5], [0.12, 0.86], [0.24, 0.84], [0.42, 0.56], [0.62, 0.38], [0.82, 0.28], [1, 0.22]];
  const LARGE: [number, number][] = [[0, 0.26], [0.2, 0.3], [0.55, 0.34], [0.8, 0.33], [1, 0.22]];
  const BAS = (u: number) => (u > 0.8 ? ((u - 0.8) / 0.2) ** 2 * 0.12 : 0);
  const X = (u: number) => -1 + 2.2 * u;
  const bout = (u: number) => Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.32);
  const sp = (c: number, e: number) => Math.sign(c) * Math.pow(Math.abs(c), e);
  const surface = (u: number, v: number, cible: THREE.Vector3) => {
    const a = v * Math.PI * 2;
    const yb = BAS(u);
    const yh = lerp(HAUT, u);
    const mid = (yb + yh) / 2;
    const k = bout(u);
    cible.set(X(u), mid + ((yh - yb) / 2) * k * sp(Math.sin(a), 0.55), lerp(LARGE, u) * k * sp(Math.cos(a), 0.55));
  };
  const corps = new ParametricGeometry(surface, 160, 64);
  // La semelle : le contour du pied, un peu plus large, en plaque fine.
  const contour = new THREE.Shape();
  const N = 80;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const pt = [X(u), lerp(LARGE, u) * bout(u) * 1.06 + 0.01];
    if (i === 0) contour.moveTo(pt[0], pt[1]);
    else contour.lineTo(pt[0], pt[1]);
  }
  for (let i = N; i >= 0; i--) {
    const u = i / N;
    contour.lineTo(X(u), -(lerp(LARGE, u) * bout(u) * 1.06 + 0.01));
  }
  const semelle = new THREE.ExtrudeGeometry(contour, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 4 });
  semelle.rotateX(Math.PI / 2);
  semelle.translate(0, -0.005, 0);
  // Les crampons : des cônes sous la semelle.
  const plots: THREE.BufferGeometry[] = [];
  for (const [u, z] of [[0.06, -0.13], [0.06, 0.13], [0.2, 0], [0.55, -0.2], [0.55, 0.2], [0.72, -0.2], [0.72, 0.2], [0.88, 0]]) {
    const c = new THREE.CylinderGeometry(0.07, 0.045, 0.11, 24);
    c.translate(X(u), -0.11, z);
    plots.push(c.toNonIndexed());
  }
  // La bande sur le côté, en verre : une virgule du talon vers les lacets.
  const bande = (cote: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const u = 0.1 + t * 0.56;
      const h = 0.08 + Math.sin(t * Math.PI * 0.9) * 0.26 + t * 0.06;
      const p = new THREE.Vector3();
      surface(u, 0, p);
      pts.push(new THREE.Vector3(X(u), h, cote * (p.z + 0.012)));
    }
    const t = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.04, 10, false);
    t.scale(1, 1, 0.35);
    return t.toNonIndexed();
  };
  // Le col, en verre, et quatre lacets en travers du cou-de-pied.
  const col = new THREE.TorusGeometry(0.2, 0.045, 16, 64);
  col.scale(1.2, 1, 1.05);
  col.rotateX(Math.PI / 2);
  col.rotateZ(0.12);
  col.translate(X(0.17), 0.75, 0);
  const lacets: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const u = 0.32 + i * 0.075;
    const l = new THREE.CapsuleGeometry(0.026, 0.3, 6, 12);
    l.rotateX(Math.PI / 2);
    l.rotateZ(-0.6);
    l.translate(X(u), lerp(HAUT, u) + 0.01, 0);
    lacets.push(l.toNonIndexed());
  }
  return [
    { geo: corps, role: "corps" },
    { geo: mergeGeometries([semelle, ...plots]), role: "sombre" },
    { geo: mergeGeometries([bande(1), bande(-1), col.toNonIndexed(), ...lacets]), role: "verre" },
  ];
}

/* ---------------------------------- Cage ---------------------------------- */

/** La cage : poteaux et barre en tube, le filet en verre. */
function cage(): Piece[] {
  const r = 0.1;
  const tube = (a: THREE.Vector3, b: THREE.Vector3, rayon = r) => {
    const g = new THREE.CylinderGeometry(rayon, rayon, a.distanceTo(b), rayon < r ? 8 : 20);
    g.translate(0, a.distanceTo(b) / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate(a.x, a.y, a.z);
    return g;
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const L = 1.5;
  const H = 1.0;
  const P = 0.9;
  const cadre = [
    tube(V(-L, 0, 0), V(-L, H, 0)),
    tube(V(L, 0, 0), V(L, H, 0)),
    tube(V(-L, H, 0), V(L, H, 0)),
    tube(V(-L, H, 0), V(-L, 0, -P)),
    tube(V(L, H, 0), V(L, 0, -P)),
    tube(V(-L, 0, -P), V(L, 0, -P)),
  ];
  const coins: THREE.BufferGeometry[] = [V(-L, H, 0), V(L, H, 0)].map((p) => {
    const s = new THREE.SphereGeometry(r, 20, 12);
    s.translate(p.x, p.y, p.z);
    return s;
  });
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
  for (let i = 1; i < 8; i++) {
    const x = -L + (2 * L * i) / 8;
    mailles.push(tube(V(x, H, 0), V(x, 0, -P), r * 0.35));
  }
  for (let j = 1; j < 4; j++) {
    const t = j / 4;
    mailles.push(tube(V(-L, H * (1 - t), -P * t), V(L, H * (1 - t), -P * t), r * 0.35));
  }
  const m = mergeGeometries(mailles);
  return [
    { geo: mergeGeometries([...cadre, ...coins]), role: "corps" },
    { geo: filet, role: "verre" },
    { geo: m, role: "sombre" },
  ];
}

/* -------------------------------- Trophée --------------------------------- */

/** Le trophée : une coupe tournée, deux anses, un socle. */
function trophee(): Piece[] {
  // Le profil, lissé par une courbe : la coupe évasée, la lèvre, le nœud
  // de la tige. Le socle à deux marches est à part, en chrome sombre.
  const courbe = new THREE.SplineCurve(
    [
      [0, -0.42], [0.2, -0.42], [0.2, -0.36], [0.07, -0.3], [0.06, -0.12],
      [0.13, -0.06], [0.07, 0.0], [0.09, 0.12], [0.36, 0.26], [0.58, 0.52],
      [0.68, 0.86], [0.72, 1.02], [0.66, 1.03], [0.6, 0.88], [0.48, 0.56],
      [0.2, 0.34], [0, 0.32],
    ].map(([x, y]) => new THREE.Vector2(x, y))
  );
  const coupe = new THREE.LatheGeometry(courbe.getPoints(100), 96);
  // Les anses : deux longues oreilles, d'un tube qui suit la coupe.
  const anses = [-1, 1].map((k) => {
    const pts = [
      [0.5, 0.42], [0.86, 0.46], [1.04, 0.66], [0.98, 0.88], [0.7, 0.92],
    ].map(([x, y]) => new THREE.Vector3(k * x, y, 0));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.045, 16, false);
  });
  const marche = (r1: number, r2: number, h: number, y: number) => {
    const c = new THREE.CylinderGeometry(r1, r2, h, 96);
    c.translate(0, y, 0);
    return c;
  };
  return [
    { geo: mergeGeometries([coupe.index ? coupe.toNonIndexed() : coupe, ...anses.map((t) => t.toNonIndexed())]), role: "corps" },
    { geo: mergeGeometries([marche(0.34, 0.4, 0.16, -0.5), marche(0.44, 0.48, 0.14, -0.64)]), role: "sombre" },
  ];
}

/* --------------------------------- Pépite --------------------------------- */

/** La pépite d'or : une pierre taillée en brillant. */
function pepite(): Piece[] {
  // Taillée comme un brillant : la table, la couronne, le rondiste, la
  // culasse en pointe. Douze pans, deux rangs de facettes, franches.
  const profil = [
    new THREE.Vector2(0, -1),
    new THREE.Vector2(0.62, -0.42),
    new THREE.Vector2(1, 0.1),
    new THREE.Vector2(1, 0.2),
    new THREE.Vector2(0.84, 0.42),
    new THREE.Vector2(0.55, 0.58),
    new THREE.Vector2(0, 0.58),
  ];
  const g = new THREE.LatheGeometry(profil, 12);
  const plate = g.toNonIndexed();
  plate.computeVertexNormals();
  return [{ geo: plate, role: "corps" }];
}

/* ----------------------- Formes plates, extrudées ------------------------ */

function etoile(): Piece[] {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.46 : 1;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const p = [Math.cos(a) * r, Math.sin(a) * r] as const;
    if (i) s.lineTo(...p);
    else s.moveTo(...p);
  }
  s.closePath();
  return [{ geo: extrude(s, 0.32, 0.12), role: "corps" }];
}

function bouclier(): Piece[] {
  const s = new THREE.Shape();
  s.moveTo(0, 1);
  s.bezierCurveTo(0.35, 0.86, 0.6, 0.84, 0.82, 0.86);
  s.lineTo(0.82, 0.1);
  s.bezierCurveTo(0.82, -0.45, 0.4, -0.8, 0, -1);
  s.bezierCurveTo(-0.4, -0.8, -0.82, -0.45, -0.82, 0.1);
  s.lineTo(-0.82, 0.86);
  s.bezierCurveTo(-0.6, 0.84, -0.35, 0.86, 0, 1);
  const corps = extrude(s, 0.3, 0.12);
  // La bande du milieu, en verre, en relief.
  const b = new THREE.Shape();
  b.moveTo(-0.16, 0.86);
  b.lineTo(0.16, 0.86);
  b.lineTo(0.16, -0.78);
  b.bezierCurveTo(0.08, -0.84, -0.08, -0.84, -0.16, -0.78);
  b.closePath();
  const bande = extrude(b, 0.1, 0.04);
  bande.translate(0, 0.02, 0.24);
  return [
    { geo: corps, role: "corps" },
    { geo: bande, role: "verre" },
  ];
}

function eclair(): Piece[] {
  const s = new THREE.Shape();
  s.moveTo(0.18, 1);
  s.lineTo(-0.62, -0.08);
  s.lineTo(-0.06, -0.08);
  s.lineTo(-0.3, -1);
  s.lineTo(0.62, 0.18);
  s.lineTo(0.06, 0.18);
  s.closePath();
  return [{ geo: extrude(s, 0.3, 0.1), role: "corps" }];
}

/** Le terrain : une plaque dans le métal du badge, ses lignes en chrome sombre (le tour, la médiane, le rond central). */
function terrain(): Piece[] {
  const L = 1.0;
  const l = 0.64;
  const plaque = new THREE.Shape();
  const r = 0.14;
  plaque.moveTo(-L + r, -l);
  plaque.lineTo(L - r, -l);
  plaque.quadraticCurveTo(L, -l, L, -l + r);
  plaque.lineTo(L, l - r);
  plaque.quadraticCurveTo(L, l, L - r, l);
  plaque.lineTo(-L + r, l);
  plaque.quadraticCurveTo(-L, l, -L, l - r);
  plaque.lineTo(-L, -l + r);
  plaque.quadraticCurveTo(-L, -l, -L + r, -l);
  const plateau = extrude(plaque, 0.1, 0.05);
  plateau.rotateX(-Math.PI / 2);
  // Les lignes : de fines barres posées sur la plaque.
  const e = 0.05;
  const h = 0.06;
  const y = 0.1;
  const barre = (x: number, z: number, lx: number, lz: number) => {
    const b = new THREE.BoxGeometry(lx, h, lz);
    b.translate(x, y, z);
    return b;
  };
  const m = 0.84;
  const n = 0.5;
  const lignes = [
    barre(0, -n, 2 * m, e),
    barre(0, n, 2 * m, e),
    barre(-m, 0, e, 2 * n + e),
    barre(m, 0, e, 2 * n + e),
    barre(0, 0, e, 2 * n),
    // Les surfaces de réparation.
    barre(-m + 0.18, 0, e, 0.5),
    barre(m - 0.18, 0, e, 0.5),
    barre(-m + 0.09, -0.25, 0.18, e),
    barre(-m + 0.09, 0.25, 0.18, e),
    barre(m - 0.09, -0.25, 0.18, e),
    barre(m - 0.09, 0.25, 0.18, e),
  ].map((g) => g.toNonIndexed());
  const rond = new THREE.TorusGeometry(0.2, e / 2, 10, 64);
  rond.rotateX(Math.PI / 2);
  rond.translate(0, y + h / 2 - e / 2, 0);
  const point = new THREE.CylinderGeometry(0.04, 0.04, h, 20);
  point.translate(0, y, 0);
  return [
    { geo: plateau, role: "corps" },
    { geo: mergeGeometries([...lignes, rond.toNonIndexed(), point.toNonIndexed()]), role: "sombre" },
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
  const corps = extrude(s, 0.34, 0.12);
  // Le cœur de la flamme, en verre.
  const c = new THREE.Shape();
  c.moveTo(0, -0.78);
  c.bezierCurveTo(0.34, -0.78, 0.44, -0.46, 0.34, -0.2);
  c.bezierCurveTo(0.26, 0.0, 0.12, 0.08, 0.06, 0.26);
  c.bezierCurveTo(-0.22, 0.06, -0.38, -0.2, -0.36, -0.44);
  c.bezierCurveTo(-0.32, -0.66, -0.18, -0.78, 0, -0.78);
  const coeur = extrude(c, 0.1, 0.04);
  coeur.translate(0, -0.22, 0.26);
  return [
    { geo: corps, role: "corps" },
    { geo: coeur, role: "verre" },
  ];
}

function sablier(): Piece[] {
  const verre = new THREE.LatheGeometry(
    [
      [0.02, -0.86], [0.5, -0.82], [0.62, -0.6], [0.5, -0.24], [0.1, -0.02],
      [0.1, 0.02], [0.5, 0.24], [0.62, 0.6], [0.5, 0.82], [0.02, 0.86],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    64,
  );
  const sable = new THREE.LatheGeometry(
    [[0.01, -0.82], [0.47, -0.78], [0.55, -0.6], [0.4, -0.42], [0.01, -0.42]].map(([x, y]) => new THREE.Vector2(x, y)),
    64,
  );
  const plateaux = [-1, 1].map((k) => {
    const c = new THREE.CylinderGeometry(0.78, 0.78, 0.14, 64);
    c.translate(0, k * 0.93, 0);
    return c;
  });
  const montants = [0, 1, 2].map((i) => {
    const c = new THREE.CylinderGeometry(0.05, 0.05, 1.8, 16);
    const a = (i * Math.PI * 2) / 3 + 0.4;
    c.translate(Math.cos(a) * 0.68, 0, Math.sin(a) * 0.68);
    return c;
  });
  return [
    { geo: mergeGeometries([...plateaux, ...montants]), role: "corps" },
    { geo: verre, role: "verre" },
    { geo: sable, role: "sombre" },
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
