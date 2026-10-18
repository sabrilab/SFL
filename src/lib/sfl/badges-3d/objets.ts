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
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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

/** Le ballon : une sphère et les coutures d'un icosaèdre tronqué (pentagones et hexagones). */
function ballon(): Piece[] {
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pos = ico.getAttribute("position");
  const sommets: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    if (!sommets.some((s) => s.distanceTo(v) < 1e-4)) sommets.push(v);
  }
  const arete = Math.min(...sommets.slice(1).map((s) => s.distanceTo(sommets[0])));
  const voisins = (a: THREE.Vector3) => sommets.filter((b) => Math.abs(a.distanceTo(b) - arete) < 1e-3);
  const segments: [THREE.Vector3, THREE.Vector3][] = [];
  const tiers = (a: THREE.Vector3, b: THREE.Vector3) => a.clone().lerp(b, 1 / 3);
  for (const a of sommets) {
    const vs = voisins(a);
    // Les pentagones : autour de chaque sommet, entre voisins adjacents.
    for (let i = 0; i < vs.length; i++)
      for (let j = i + 1; j < vs.length; j++)
        if (Math.abs(vs[i].distanceTo(vs[j]) - arete) < 1e-3) segments.push([tiers(a, vs[i]), tiers(a, vs[j])]);
    // Le tiers du milieu de chaque arête (une seule fois).
    for (const b of vs) if (sommets.indexOf(b) > sommets.indexOf(a)) segments.push([tiers(a, b), tiers(b, a)]);
  }
  const coutures = segments.map(([a, b]) => {
    const pts: THREE.Vector3[] = [];
    for (let t = 0; t <= 8; t++) pts.push(a.clone().lerp(b, t / 8).normalize().multiplyScalar(1.004));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 8, 0.018, 5, false);
  });
  return [
    { geo: new THREE.SphereGeometry(1, 96, 64), role: "corps" },
    { geo: mergeGeometries(coutures), role: "sombre" },
  ];
}

/* --------------------------------- Crampon -------------------------------- */

/** Le crampon : la chaussure de profil, extrudée, sa semelle et ses crampons. */
function crampon(): Piece[] {
  const s = new THREE.Shape();
  s.moveTo(-1.0, -0.35);
  s.lineTo(1.05, -0.35);
  s.bezierCurveTo(1.3, -0.33, 1.32, -0.05, 1.12, 0.02);
  s.bezierCurveTo(0.75, 0.14, 0.35, 0.22, 0.05, 0.42);
  s.lineTo(-0.35, 0.72);
  s.bezierCurveTo(-0.55, 0.82, -0.8, 0.82, -0.95, 0.66);
  s.bezierCurveTo(-1.1, 0.4, -1.12, 0.0, -1.0, -0.35);
  const corps = extrude(s, 0.62, 0.14);
  const semelle = new THREE.Shape();
  semelle.moveTo(-1.02, -0.52);
  semelle.lineTo(1.12, -0.52);
  semelle.bezierCurveTo(1.32, -0.5, 1.32, -0.36, 1.12, -0.36);
  semelle.lineTo(-1.02, -0.36);
  semelle.lineTo(-1.02, -0.52);
  const sem = extrude(semelle, 0.66, 0.05);
  sem.translate(0, -0.4, 0);
  const plots: THREE.BufferGeometry[] = [];
  for (const x of [-0.82, -0.5, 0.2, 0.55, 0.9])
    for (const z of [-0.18, 0.18]) {
      const c = new THREE.CylinderGeometry(0.07, 0.09, 0.2, 16);
      c.translate(x, -0.92, z);
      plots.push(c);
    }
  // Les lacets : trois barrettes sur le cou-de-pied.
  const lacets: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.CapsuleGeometry(0.035, 0.42, 6, 12);
    b.rotateX(Math.PI / 2);
    b.translate(-0.05 + i * 0.2, 0.34 - i * 0.11, 0);
    lacets.push(b);
  }
  return [
    { geo: corps, role: "corps" },
    { geo: sem, role: "sombre" },
    { geo: mergeGeometries(plots), role: "corps" },
    { geo: mergeGeometries(lacets), role: "verre" },
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
  const profil = [
    [0, -1.0], [0.62, -1.0], [0.62, -0.78], [0.42, -0.74], [0.4, -0.62],
    [0.14, -0.55], [0.1, -0.2], [0.16, -0.08], [0.55, 0.08], [0.78, 0.42],
    [0.84, 0.86], [0.78, 0.88], [0.7, 0.5], [0.5, 0.18], [0, 0.1],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const coupe = new THREE.LatheGeometry(profil, 96);
  const anses = [-1, 1].map((cote) => {
    const t = new THREE.TorusGeometry(0.3, 0.06, 16, 48, Math.PI * 1.15);
    t.rotateZ(cote > 0 ? -Math.PI * 0.55 : Math.PI * 0.4 + Math.PI * 0.15);
    t.translate(cote * 0.8, 0.5, 0);
    return t;
  });
  const socle = new THREE.CylinderGeometry(0.7, 0.75, 0.22, 64);
  socle.translate(0, -1.1, 0);
  return [
    { geo: mergeGeometries([coupe, ...anses]), role: "corps" },
    { geo: socle, role: "sombre" },
  ];
}

/* --------------------------------- Pépite --------------------------------- */

/** La pépite d'or : une pierre taillée en brillant. */
function pepite(): Piece[] {
  // Taillée comme un brillant : la table, la couronne, le rondiste, la
  // culasse en pointe. Huit pans, à facettes franches.
  const profil = [
    new THREE.Vector2(0, -1),
    new THREE.Vector2(1, 0.12),
    new THREE.Vector2(1, 0.24),
    new THREE.Vector2(0.62, 0.62),
    new THREE.Vector2(0, 0.62),
  ];
  const g = new THREE.LatheGeometry(profil, 8);
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
