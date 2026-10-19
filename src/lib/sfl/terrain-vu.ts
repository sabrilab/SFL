// Le terrain de la feuille de match, vu en perspective, calculé à la main.
//
// La feuille posait un terrain couché en CSS 3D (rotateX, preserve-3d) et des
// cartes relevées dessus. Deux moteurs de rendu le trahissaient : Safari
// aplatissait la scène, et l'image partagée (html-to-image) ne sait pas
// photographier une scène 3D. On fait donc la même projection ici, en
// nombres : le terrain devient un dessin SVG déjà projeté, et chaque carte,
// qui fait face à l'œil, n'est qu'un point projeté et une échelle. Même rendu
// partout, dans l'app comme dans l'image.
//
// Repère : le terrain fait L × H px, son coin haut gauche est à (0, 0) ; `w`
// sort du terrain vers l'œil. Le résultat est en px dans le cadre : x depuis
// le milieu du cadre, y depuis son haut.

export const TERRAIN = { l: 270, h: 540, incline: 56 };
/** Le haut du terrain, avant bascule, par rapport au haut du cadre. */
const HAUT = -34;
/** L'œil, à 1000 px, vise le quart haut d'un cadre de 540 px. */
const RECUL = 1000;

/**
 * Un point de vue : la taille du terrain et sa bascule. La feuille de match
 * garde celui par défaut ; les terrains de la Ligue en prennent un plus court
 * et moins couché, pour que les rangs de cartes debout ne se cachent pas.
 */
export interface Vue {
  l: number;
  h: number;
  incline: number;
  sin: number;
  cos: number;
  visee: number;
}

export function vue(l = TERRAIN.l, h = TERRAIN.h, incline = TERRAIN.incline): Vue {
  const r = (incline * Math.PI) / 180;
  return { l, h, incline, sin: Math.sin(r), cos: Math.cos(r), visee: h * 0.25 - HAUT };
}

const DEFAUT = vue();

export interface Projete {
  x: number;
  y: number;
  /** L'échelle de ce qui, à cet endroit, fait face à l'œil (une carte). */
  k: number;
}

/** Un point du terrain (u, v), à la hauteur w, vu dans le cadre. */
export function projeter(u: number, v: number, w = 0, { l, h, sin, cos, visee }: Vue = DEFAUT): Projete {
  const y0 = v - h / 2;
  const y1 = y0 * cos - w * sin;
  const z1 = y0 * sin + w * cos;
  const k = 1 / (1 - z1 / RECUL);
  return {
    x: (u - l / 2) * k,
    y: HAUT + visee + (y1 + h / 2 - visee) * k,
    k,
  };
}

const f = (n: number) => Math.round(n * 100) / 100;

/** Un tracé SVG à partir de points du terrain. */
export function trace(points: [number, number, number?][], ferme = false, vu: Vue = DEFAUT): string {
  return (
    points
      .map(([u, v, w], i) => {
        const p = projeter(u, v, w ?? 0, vu);
        return `${i ? "L" : "M"}${f(p.x)} ${f(p.y)}`;
      })
      .join(" ") + (ferme ? " Z" : "")
  );
}

/** Un arc de cercle du terrain, en points (angles en degrés, 0 = droite, 90 = bas). */
export function arc(cu: number, cv: number, r: number, de: number, a: number, pas = 16): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= pas; i++) {
    const t = ((de + ((a - de) * i) / pas) * Math.PI) / 180;
    out.push([cu + r * Math.cos(t), cv + r * Math.sin(t)]);
  }
  return out;
}

/** Un rectangle aux coins arrondis du terrain, en points. */
export function rectArrondi(u0: number, v0: number, u1: number, v1: number, r: number): [number, number][] {
  return [
    ...arc(u1 - r, v0 + r, r, -90, 0, 4),
    ...arc(u1 - r, v1 - r, r, 0, 90, 4),
    ...arc(u0 + r, v1 - r, r, 90, 180, 4),
    ...arc(u0 + r, v0 + r, r, 180, 270, 4),
  ];
}
