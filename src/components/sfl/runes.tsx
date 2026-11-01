"use client";

// Les runes de la Saison Givre (lib/sfl/passe.ts, PASSE_GIVRE) : le vieux
// futhark, vingt-quatre signes taillés en traits droits (on les gravait dans
// le bois et la pierre, où une courbe ne tient pas), dessinés ici trait par
// trait dans une case de 6 × 10, sans police à charger.
//   · « Runes » (palier 3) : une frise autour de la rosace du dos, entre deux
//     filets, « bola · dès que c'est l'hiver · saison givre » qui tourne ;
//   · « Ton nom en runes » (palier 5) : le nom du joueur sous le logotype du
//     dos.
// Le français passe en runes à l'oreille (transcrire) : « th » et « ng » ont
// leur signe, c, q et x se lisent k, v se lit w, y se lit i ; les accents
// tombent ; un mot se sépare d'un point.

type Trait = [number, number, number, number];

/** Le vieux futhark, dans une case de 6 de large et 10 de haut. */
const FUTHARK: Record<string, Trait[]> = {
  f: [[0, 10, 0, 0], [0, 3.2, 5, 0], [0, 6.4, 5, 3.2]],
  u: [[0, 10, 0, 0], [0, 0, 5, 3], [5, 3, 5, 10]],
  þ: [[0, 0, 0, 10], [0, 2.5, 4.4, 5], [4.4, 5, 0, 7.5]],
  a: [[0, 0, 0, 10], [0, 0, 5, 3], [0, 3.2, 5, 6.2]],
  r: [[0, 0, 0, 10], [0, 0, 4.4, 2.4], [4.4, 2.4, 0, 4.8], [0, 4.8, 5, 10]],
  k: [[5, 1, 0, 4.5], [0, 4.5, 5, 8]],
  g: [[0, 0, 6, 10], [6, 0, 0, 10]],
  w: [[0, 0, 0, 10], [0, 0, 4.4, 2.4], [4.4, 2.4, 0, 4.8]],
  h: [[0, 0, 0, 10], [5, 0, 5, 10], [0, 3, 5, 6]],
  n: [[3, 0, 3, 10], [0.5, 3.5, 5.5, 6.5]],
  i: [[3, 0, 3, 10]],
  j: [[3, 1, 0, 3.5], [0, 3.5, 3, 6], [3, 4, 6, 6.5], [6, 6.5, 3, 9]],
  ï: [[3, 0, 3, 10], [3, 0, 5.5, 2.2], [3, 10, 0.5, 7.8]],
  p: [[0, 0, 0, 10], [0, 1, 4, 3.2], [4, 3.2, 5, 1], [0, 9, 4, 6.8], [4, 6.8, 5, 9]],
  z: [[3, 0, 3, 10], [3, 4.5, 0, 0.5], [3, 4.5, 6, 0.5]],
  s: [[5, 0, 1, 3.4], [1, 3.4, 5, 6.6], [5, 6.6, 1, 10]],
  t: [[3, 0, 3, 10], [3, 0, 0, 3], [3, 0, 6, 3]],
  b: [[0, 0, 0, 10], [0, 0, 4.4, 2.5], [4.4, 2.5, 0, 5], [0, 5, 4.4, 7.5], [4.4, 7.5, 0, 10]],
  e: [[0, 0, 0, 10], [6, 0, 6, 10], [0, 0, 3, 3], [3, 3, 6, 0]],
  m: [[0, 0, 0, 10], [6, 0, 6, 10], [0, 0, 6, 4.5], [6, 0, 0, 4.5]],
  l: [[0, 0, 0, 10], [0, 0, 4.4, 3]],
  ŋ: [[3, 2, 6, 5], [6, 5, 3, 8], [3, 8, 0, 5], [0, 5, 3, 2]],
  o: [[3, 0, 6, 3], [3, 0, 0, 3], [0, 3, 6, 10], [6, 3, 0, 10]],
  d: [[0, 0, 0, 10], [6, 0, 6, 10], [0, 0, 6, 10], [6, 0, 0, 10]],
};

/** Le point qui sépare les mots (᛫), au milieu de la hauteur. */
const POINT = "·";

/** Le français en runes, à l'oreille : une suite de signes de FUTHARK, et POINT entre les mots. */
export function transcrire(texte: string): string[] {
  const t = texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s·'-]/g, "")
    .replace(/th/g, "þ")
    .replace(/ng/g, "ŋ")
    .replace(/ch/g, "ʃ")
    .replace(/ou/g, "u");
  const out: string[] = [];
  for (const c of t) {
    if (/[\s·'-]/.test(c)) {
      if (out.length && out[out.length - 1] !== POINT) out.push(POINT);
      continue;
    }
    if (c === "x") out.push("k", "s");
    else if (c === "ʃ") out.push("s");
    else out.push(({ c: "k", q: "k", v: "w", y: "i" } as Record<string, string>)[c] ?? c);
  }
  while (out[out.length - 1] === POINT) out.pop();
  return out.filter((c) => c === POINT || c in FUTHARK);
}

/** L'avance d'un signe, en unités de case (largeur et blanc). */
const avance = (c: string) => (c === POINT ? 4 : c === "i" ? 4 : 8.4);

/** Le tracé d'un signe, sa case posée en (0, 0), à l'échelle `e`. */
function signe(c: string, e: number): string {
  if (c === POINT) return `M${2 * e - 0.9 * e} ${5 * e}a${0.9 * e} ${0.9 * e} 0 1 0 ${1.8 * e} 0a${0.9 * e} ${0.9 * e} 0 1 0 ${-1.8 * e} 0`;
  const dx = c === "i" ? -2 : 0;
  return FUTHARK[c].map(([x1, y1, x2, y2]) => `M${(x1 + dx) * e} ${y1 * e}L${(x2 + dx) * e} ${y2 * e}`).join("");
}

/** Où commence chaque signe d'une ligne, en unités de case. */
function departs(runes: string[], etire = 1): number[] {
  const out: number[] = [];
  runes.reduce((x, c) => (out.push(x), x + avance(c) * etire), 0);
  return out;
}

/** La longueur d'une ligne de runes, en unités de case. */
const longueur = (runes: string[]) => runes.reduce((s, c) => s + avance(c), 0) - 2.4;

/** Une ligne de runes centrée en (cx, cy), haute de `h` (moins si elle dépasse `largeur`). */
export function RunesEnLigne({
  texte,
  cx,
  cy,
  h: hauteur,
  largeur,
  couleur,
  epaisseur,
}: {
  texte: string;
  cx: number;
  cy: number;
  h: number;
  largeur: number;
  couleur: string;
  epaisseur: number;
}) {
  const runes = transcrire(texte);
  const h = Math.min(hauteur, (largeur / Math.max(1, longueur(runes))) * 10);
  const e = h / 10;
  const x = cx - (longueur(runes) * e) / 2;
  const d = departs(runes);
  return (
    <g stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" fill="none">
      {runes.map((c, i) => {
        const x0 = x + d[i] * e;
        return (
          <path
            key={i}
            d={signe(c, e)}
            transform={`translate(${x0} ${cy - h / 2})`}
            fill={c === POINT ? couleur : "none"}
            stroke={c === POINT ? "none" : undefined}
          />
        );
      })}
    </g>
  );
}

/**
 * Une frise de runes autour de (cx, cy) : la phrase répétée sur tout le tour,
 * chaque signe debout sur le cercle de rayon r (pied vers le centre), entre
 * deux filets.
 */
export function RunesEnCercle({
  texte,
  cx,
  cy,
  r,
  h,
  couleur,
  epaisseur,
}: {
  texte: string;
  cx: number;
  cy: number;
  r: number;
  h: number;
  couleur: string;
  epaisseur: number;
}) {
  const phrase = [...transcrire(texte), POINT, POINT];
  const e = h / 10;
  const tour = 2 * Math.PI * (r + h / 2);
  const une = longueur(phrase) * e + 2.4 * e;
  const fois = Math.max(1, Math.floor(tour / une));
  // L'espacement s'étire un peu pour que la frise se referme sans trou.
  const etire = tour / (fois * une);
  const runes = Array.from({ length: fois }, () => phrase).flat();
  const d = departs(runes, etire);
  return (
    <g fill="none" stroke={couleur} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={cx} cy={cy} r={r - h * 0.35} strokeWidth={epaisseur * 0.7} />
      <circle cx={cx} cy={cy} r={r + h * 1.35} strokeWidth={epaisseur * 0.7} />
      {runes.map((c, i) => {
        const l = avance(c) * e * etire;
        // Le milieu du signe, en angle depuis le haut, dans le sens des aiguilles.
        const a = (d[i] * e + (l - 2.4 * e) / 2) / (r + h / 2);
        const deg = (a * 180) / Math.PI;
        const largeur = (c === POINT ? 4 : c === "i" ? 2 : 6) * e;
        return (
          <path
            key={i}
            d={signe(c, e)}
            transform={`translate(${cx} ${cy}) rotate(${deg}) translate(${-largeur / 2} ${-r - h})`}
            strokeWidth={epaisseur}
            fill={c === POINT ? couleur : "none"}
            stroke={c === POINT ? "none" : undefined}
          />
        );
      })}
    </g>
  );
}
