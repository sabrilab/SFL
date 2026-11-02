// Le totem du Cameroun (PACK AFRIQUE 2027 ; Ilyes, 02/11/2026 : « une belle silhouette,
// un beau truc de chaque équipe »).
//
// Le lion qui rugit, en buste, tourné vers la droite (les deux autres
// regardent à gauche) : il ne marche pas (Maroc), il ne veille pas assis
// (Sénégal), il rugit, la tête levée vers la lune. La gueule est ouverte
// dans la silhouette même, à près de 70° : la mâchoire du bas abaissée, plus
// courte et plus mince que celle du haut ; les crocs du haut et du bas, le
// croc lointain un peu en retrait, la langue, le fond de la gorge sombre
// près de la commissure seulement (devant, entre les crocs, le mur paraît) ;
// la lèvre retroussée, trois plis sur l'arête du nez, l'œil plissé sous
// l'arcade froncée, le crâne massif.
// Il est modelé dans l'argile du teleuk (../cameroun.tsx), comme les reliefs
// de la case obus musgum : un bas-relief monochrome, d'une argile un peu
// plus sombre que le mur, une ombre portée franche en bas à droite, une
// arête de lumière en haut à gauche. La crinière est faite de mèches en S,
// d'épaisseurs et de longueurs inégales, qui se chevauchent, chacune creusée
// de deux sillons de poil au doigt ; les plus longues, sur la nuque, portent
// une colonne de V en relief, comme la paroi des cases (sans sillon au
// milieu) ; la fraise qui encadre le visage a un bord net.
//   · au dos : le héros, en bas à gauche, la crinière coupée par le bord ;
//     la lune et la coupole montées en haut à droite (LUNE_CAMEROUN, que le
//     skin lit), vers où il rugit ; la crinière et son ombre s'arrêtent
//     au-dessus de l'enduit lissé du logotype ;
//   · à la face : un sceau d'argile pressé dans le coin bas du portrait :
//     des arêtes et des ombres seulement, le corps à peine teinté.
// Les tracés sont des points posés à la main, liés en béziers tendus, et
// des mèches posées une à une ; la graine ne touche pas la silhouette.
//
// Le mode d'emploi est en tête de ../totem.tsx.

import type { ReactNode } from "react";
import type { PropsTotem, TotemNation } from "../types";
import { f } from "../outils";

/** La lune et la coupole, montées en haut à droite, vers où il rugit (le skin, ../cameroun.tsx, les lit). */
export const LUNE_CAMEROUN = { cx: 740, cy: 330, d: 180 } as const;

/* ------------------------------ Les tracés ------------------------------ */

/** Un point posé à la main ; 1 : un angle, 2 : un angle adouci. */
type P = readonly [number, number] | readonly [number, number, number];

/** Des points liés en béziers tendus : chaque point prend la tangente de ses voisins, les poignées valent un tiers de la corde. */
function lisse(pts: readonly P[], ferme = true): string {
  const n = pts.length;
  const at = (i: number) => (ferme ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const tangente = (i: number): [number, number] => {
    const p = at(i);
    if (p[2] === 1) return [0, 0];
    const [a, b] = !ferme && (i === 0 || i === n - 1) ? (i === 0 ? [at(0), at(1)] : [at(n - 2), at(n - 1)]) : [at(i - 1), at(i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const k = p[2] === 2 ? 0.5 : 1;
    return [((b[0] - a[0]) / l) * k, ((b[1] - a[1]) / l) * k];
  };
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < (ferme ? n : n - 1); i++) {
    const [p, q] = [at(i), at(i + 1)];
    const c = Math.hypot(q[0] - p[0], q[1] - p[1]) / 3;
    const [u, v] = [tangente(i), tangente(i + 1)];
    d += `C${f(p[0] + u[0] * c)} ${f(p[1] + u[1] * c)} ${f(q[0] - v[0] * c)} ${f(q[1] - v[1] * c)} ${f(q[0])} ${f(q[1])}`;
  }
  return ferme ? `${d}Z` : d;
}

/**
 * Une mèche en flamme : de sa racine (x, y), sa corde part dans la direction
 * c (degrés : 0 vers l'arrière, 90 vers le bas), longue de l ; elle quitte la
 * racine tournée de d1 et arrive tournée de d2, puis sa pointe boucle encore
 * du crochet (le poil qui se recourbe) ; large de w à la racine, elle
 * s'effile lentement. Rend la mèche, ses deux sillons de poil, et une
 * colonne de V le long de son cœur (sans sillon au milieu).
 */
type Meche = readonly [x: number, y: number, c: number, d1: number, d2: number, l: number, w: number, crochet: number];
function meche([x, y, c, d1, d2, l, w, crochet]: Meche): { forme: string; sillons: string; v: string } {
  const rad = (a: number) => (a * Math.PI) / 180;
  const [tx, ty] = [x + l * Math.cos(rad(c)), y + l * Math.sin(rad(c))];
  const p1 = [x + (l / 3) * Math.cos(rad(c + d1)), y + (l / 3) * Math.sin(rad(c + d1))];
  const p2 = [tx - (l / 3) * Math.cos(rad(c + d2)), ty - (l / 3) * Math.sin(rad(c + d2))];
  const at = (t: number): [number, number] => {
    const u = 1 - t;
    return [u * u * u * x + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * tx, u * u * u * y + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * ty];
  };
  const tangente = (t: number): [number, number] => {
    const u = 1 - t;
    const dx = 3 * u * u * (p1[0] - x) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (tx - p2[0]);
    const dy = 3 * u * u * (p1[1] - y) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (ty - p2[1]);
    const n = Math.hypot(dx, dy) || 1;
    return [dx / n, dy / n];
  };
  const demi = (t: number) => (w / 2) * (t < 0.15 ? 0.8 + 0.2 * Math.sin(((t / 0.15) * Math.PI) / 2) : ((1 - t) / 0.85) ** 0.7);
  const point = (t: number, s: number): P => {
    const [px, py] = at(t);
    const [ux, uy] = tangente(t);
    return [px + uy * demi(t) * s, py - ux * demi(t) * s];
  };
  const ts = [0, 0.1, 0.22, 0.36, 0.5, 0.64, 0.76, 0.86, 0.93];
  const g = ts.map((t) => point(t, 1));
  const d = ts.map((t) => point(t, -1)).reverse();
  // La pointe : prolongée dans la direction d'arrivée, tournée du crochet.
  const [ex, ey] = tangente(1);
  const a = Math.atan2(ey, ex) + rad(crochet);
  const pointe: P = [tx + w * 0.35 * Math.cos(a), ty + w * 0.35 * Math.sin(a), 1];
  const forme = lisse([[g[0][0], g[0][1], 1], ...g.slice(1), pointe, ...d.slice(0, -1), [d[d.length - 1][0], d[d.length - 1][1], 1]]);
  // Deux sillons de poil, au tiers de la largeur de chaque côté, de la racine vers la pointe.
  const sillon = (k: number) => lisse([0.06, 0.26, 0.46, 0.64, 0.78].map((t) => point(t, k)), false);
  const sillons = sillon(0.42) + sillon(-0.42);
  // La colonne de V, le long du cœur, pointe vers la pointe de la mèche.
  let v = "";
  for (const t of [0.14, 0.3, 0.46]) {
    const [px, py] = at(t);
    const [ux, uy] = tangente(t);
    const e = demi(t) * 0.24;
    const h = e * 0.8;
    v += `M${f(px - ux * h + uy * e)} ${f(py - uy * h - ux * e)}L${f(px)} ${f(py)}L${f(px - ux * h - uy * e)} ${f(py - uy * h + ux * e)}`;
  }
  return { forme, sillons, v };
}

/* -------------------------------- La tête -------------------------------- */

/**
 * La tête qui rugit, dessinée dans son repère (la truffe en 0 0, la gueule
 * vers la gauche), levée de 22° par tete() : le crâne massif, l'arête du nez
 * plissée, le bout du museau haut et carré (la truffe en haut, la lèvre
 * retroussée dessous jusqu'à la commissure) ; la mâchoire du bas abaissée
 * (près de 70° d'ouverture), plus mince, le menton petit.
 */
const A = (-22 * Math.PI) / 180;
const tete = (pts: readonly P[]): P[] =>
  pts.map((p) => {
    const [dx, dy] = [p[0] * 1.36, p[1] * 1.36];
    const q: [number, number] = [140 + dx * Math.cos(A) - dy * Math.sin(A), 352 + dx * Math.sin(A) + dy * Math.cos(A)];
    return p.length === 3 ? [q[0], q[1], p[2]] : q;
  });
const HAUT = tete([
  [0, -30, 1], [14, -36], [30, -38], [44, -42], [54, -41], [64, -46], [74, -45], [86, -50], [100, -52], [124, -64], [150, -72], [180, -80], [214, -84], [246, -72],
  [264, -32], [268, 24], [258, 96], [238, 164], [200, 130], [146, 104, 1], [124, 92], [100, 84], [78, 80], [62, 74], [50, 62], [40, 56], [30, 58], [20, 52], [12, 44], [8, 30], [6, 10], [2, -10],
]);
const BAS = tete([[146, 104, 1], [122, 126], [98, 148], [76, 168], [58, 183, 1], [54, 196], [60, 208], [78, 214], [108, 216], [150, 208], [190, 194], [226, 172], [236, 140]]);
const GORGE = tete([[146, 104, 1], [134, 97], [122, 96], [117, 108], [122, 120], [134, 117]]);
const LANGUE = tete([[140, 113], [122, 129], [104, 146], [88, 161], [80, 172], [90, 173], [106, 158], [124, 140], [143, 121]]);
const CROC_LOIN = tete([[52, 55, 1], [64, 59, 1], [62, 84], [58, 100, 1], [55, 82]]);
const CROC = tete([[28, 47, 1], [44, 51, 1], [43, 80], [38, 104, 1], [32, 78]]);
const INCISIVES = tete([[10, 38, 1], [30, 46, 1], [28, 56], [18, 54], [12, 48]]);
const CROC_BAS = tete([[64, 178, 1], [80, 165, 1], [76, 148], [68, 130, 1], [66, 154]]);
const TRUFFE = tete([[0, -30, 1], [16, -36], [30, -35], [33, -25], [26, -14], [12, -10], [3, -16]]);
const OEIL = tete([[112, -40], [126, -50], [144, -52], [136, -43], [120, -37]]);
/** Les plans modelés du visage, en relief sur la tête : le coussinet des vibrisses, l'arcade au-dessus de l'œil. */
const COUSSINET = tete([[10, -10], [30, -15], [54, -8], [72, 10], [70, 34], [50, 44], [26, 40], [12, 24]]);
const ARCADE = tete([[100, -60], [128, -72], [160, -76], [178, -68], [156, -61], [124, -57]]);
/** Les plis de l'arête du nez, l'arcade froncée, la joue tirée. */
const PLIS = ([
  [[40, -40], [48, -26], [50, -12]],
  [[62, -44], [70, -30], [74, -16]],
  [[84, -48], [92, -36], [96, -22]],
  [[104, -56], [126, -62], [152, -70]],
  [[158, 92], [180, 66], [192, 28]],
] as P[][]).map((l) => lisse(tete(l), false)).join("");
const VIBRISSES = tete([[24, 10], [36, 14], [48, 18], [30, 22], [42, 26], [54, 30]])
  .map(([x, y]) => `M${f(x)} ${f(y)}h.1`)
  .join("");

/* ------------------------------ La crinière ------------------------------ */

// Les mèches, posées une à une : [racine x, y, direction de la corde, tour au départ, tour à l'arrivée, longueur, largeur, crochet].
/** La nuque et le dos du cou : les plus longues, qui filent vers le bord ; elles portent les V. */
const NUQUE: Meche[] = [
  [470, 118, -16, -16, 26, 270, 84, 30], [540, 160, -4, -18, 28, 320, 92, 36], [580, 236, 8, -18, 28, 340, 98, 38], [596, 322, 20, -16, 26, 330, 98, 34],
  [588, 408, 32, -14, 24, 300, 94, 30], [560, 488, 46, -12, 22, 260, 88, 26], [520, 556, 60, -10, 20, 196, 80, 22], [460, 604, 76, -8, 18, 134, 70, 20],
];
/** Derrière la tête : du toupet à la gorge, d'épaisseurs et de longueurs inégales. */
const COU: Meche[] = [
  [396, 122, -34, -18, 30, 170, 62, 34], [452, 140, -20, -18, 30, 196, 68, 36], [494, 190, -6, -18, 30, 210, 72, 38], [516, 252, 6, -18, 30, 214, 74, 36],
  [524, 320, 18, -16, 28, 200, 74, 32], [518, 390, 32, -14, 26, 186, 70, 30], [500, 452, 48, -12, 26, 172, 68, 28], [470, 506, 64, -10, 24, 156, 64, 24],
  [430, 548, 80, -8, 22, 138, 60, 20], [380, 572, 94, -8, 20, 118, 56, 20], [330, 580, 106, -8, 18, 98, 50, 18],
];
/** La fraise : le rang de devant, posé sur l'arrière du crâne (le visage sort de la crinière), puis derrière la mâchoire du bas, qui reste libre ; le toupet au-dessus du front. */
const FRAISE: Meche[] = [
  [318, 152, -52, -16, 34, 96, 48, 30], [362, 146, -36, -16, 32, 116, 54, 34], [400, 168, -20, -16, 32, 122, 56, 36], [424, 214, -6, -16, 32, 124, 58, 36],
  [434, 268, 8, -16, 32, 122, 58, 34], [434, 324, 22, -14, 30, 118, 58, 32], [424, 380, 38, -12, 28, 114, 56, 30], [418, 440, 58, -10, 26, 108, 54, 28],
  [470, 498, 74, -8, 24, 100, 52, 24], [446, 548, 88, -6, 22, 92, 50, 20], [404, 586, 100, -6, 20, 80, 46, 20],
];

const M = { nuque: NUQUE.map(meche), cou: COU.map(meche), fraise: FRAISE.map(meche) };

/* -------------------------------- Le modelé -------------------------------- */

// L'argile du buste, un peu plus sombre que le mur (#cdb28b) ; la tête lissée, plus claire ; la gorge, la langue, les crocs.
const ARGILE = { buste: "#bea07a", meche: "#c2a47e", fraise: "#c9ad88", tete: "#c8ab84", gueule: "#4a2e1b", langue: "#8f5b44", crocs: "#efe2c8", loin: "#d9cbb0" };
const OMBRE = "rgba(58,36,18,0.75)";
const LUMIERE = "rgba(255,247,232,0.85)";
const INCISE = "rgba(70,44,24,0.8)";

/** Une forme en relief : son ombre portée, sa lumière, l'argile, et le modelé du dedans (un biseau d'ombre et de lumière). */
function Relief({ d, corps, id, fort = 1 }: { d: string; corps: string; id: string; fort?: number }) {
  return (
    <>
      <path d={d} fill={OMBRE} transform={`translate(${6 * fort} ${8 * fort})`} />
      <path d={d} fill={LUMIERE} transform={`translate(${-3 * fort} ${-3.5 * fort})`} />
      <path d={d} fill={corps} />
      <clipPath id={id}>
        <path d={d} />
      </clipPath>
      <g clipPath={`url(#${id})`} fill="none" strokeLinejoin="round">
        <path d={d} stroke="#fff6e6" strokeOpacity={0.5} strokeWidth={8} transform="translate(3 3.5)" />
        <path d={d} stroke="#4e341e" strokeOpacity={0.32} strokeWidth={10} transform="translate(-4 -5)" />
      </g>
    </>
  );
}

/** Un trait incisé : le creux prend l'ombre, sa lèvre basse la lumière. */
const Incise = ({ d, l }: { d: string; l: number }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={LUMIERE} strokeWidth={l} transform="translate(1.6 2.2)" />
    <path d={d} stroke={INCISE} strokeWidth={l} />
  </g>
);

/** Des V modelés en relief : l'ombre, la lumière, l'argile. */
const Modele = ({ d, l }: { d: string; l: number }) => (
  <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={OMBRE} strokeWidth={l + 1.5} transform="translate(2.2 3)" />
    <path d={d} stroke={LUMIERE} strokeWidth={l * 0.9} transform="translate(-1.5 -1.8)" />
    <path d={d} stroke={ARGILE.meche} strokeWidth={l} />
  </g>
);

function Buste({ id }: { id: string }) {
  const c = (k: string) => `cm-${k}-${id}`;
  const meches = (liste: ReturnType<typeof meche>[], k: string, corps: string, v = false) =>
    liste.map((m, i) => (
      <g key={`${k}${i}`}>
        <Relief d={m.forme} corps={corps} id={c(`${k}${i}`)} fort={1.4} />
        <g clipPath={`url(#${c(`${k}${i}`)})`}>
          <Incise d={m.sillons} l={3.2} />
          {v && <Modele d={m.v} l={4.2} />}
        </g>
      </g>
    ));
  return (
    <>
      {meches(M.nuque, "n", ARGILE.buste, true)}
      {meches(M.cou, "c", ARGILE.meche)}
      {/* La tête : la mâchoire du bas, puis le haut, la gorge et la langue, les crocs. */}
      <Relief d={lisse(BAS)} corps={ARGILE.tete} id={c("ba")} fort={1.5} />
      <path d={lisse(GORGE)} fill={ARGILE.gueule} />
      <path d={lisse(LANGUE)} fill={ARGILE.langue} />
      <path d={lisse(LANGUE)} fill="none" stroke={INCISE} strokeWidth={3} />
      <Relief d={lisse(HAUT)} corps={ARGILE.tete} id={c("ha")} fort={1.5} />
      <Relief d={lisse(COUSSINET)} corps={ARGILE.fraise} id={c("co")} fort={0.6} />
      <Relief d={lisse(ARCADE)} corps={ARGILE.fraise} id={c("ar")} fort={0.5} />
      <Relief d={lisse(CROC_LOIN)} corps={ARGILE.loin} id={c("cl")} fort={0.5} />
      <Relief d={lisse(CROC)} corps={ARGILE.crocs} id={c("cr")} fort={0.6} />
      <Relief d={lisse(INCISIVES)} corps={ARGILE.crocs} id={c("in")} fort={0.5} />
      <Relief d={lisse(CROC_BAS)} corps={ARGILE.crocs} id={c("cb")} fort={0.6} />
      <Relief d={lisse(TRUFFE)} corps="#a98a66" id={c("tr")} fort={0.45} />
      <path d={lisse(OEIL)} fill={INCISE} />
      <Incise d={PLIS} l={5} />
      <path d={VIBRISSES} stroke={INCISE} strokeWidth={4.6} strokeLinecap="round" />
      {/* La fraise, par-dessus l'arrière de la tête. */}
      {meches(M.fraise, "f", ARGILE.fraise)}
    </>
  );
}

/**
 * La face : un sceau d'argile pressé dans le coin du portrait, le même buste
 * en petit ; rien que des arêtes (la lumière) et des ombres, le corps à
 * peine teinté (0,2), la gueule en ombre. Une arête n'est tirée que là où
 * rien n'est devant elle : chaque mèche, chaque mâchoire de devant est une
 * découpe « hors de » (imbriquées : leur union, sans trou là où elles se
 * recouvrent).
 */
function Sceau({ id, photo }: { id: string; photo: boolean }) {
  const c = (k: string) => `cm-s${k}-${id}`;
  const corps = photo ? "rgba(214,190,152,0.2)" : "rgba(196,165,125,0.2)";
  const lum = photo ? "rgba(255,247,232,0.75)" : "rgba(255,250,240,0.95)";
  const omb = photo ? "rgba(40,24,12,0.6)" : "rgba(78,52,30,0.42)";
  const arete = (d: string, e = 6) => (
    <>
      <path d={d} fill="none" stroke={omb} strokeWidth={e} transform="translate(5 6)" strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke={lum} strokeWidth={e} transform="translate(-3.5 -4)" strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
  const [haut, bas] = [lisse(HAUT), lisse(BAS)];
  // Les formes de devant, une découpe chacune.
  const devant = [...M.fraise.map((m, i) => [`f${i}`, m.forme] as const), ["h", haut] as const, ["b", bas] as const, ...M.cou.map((m, i) => [`c${i}`, m.forme] as const)];
  const cache = (cles: readonly string[], enfant: ReactNode) => cles.reduce<ReactNode>((acc, k) => <g clipPath={`url(#${c(k)})`}>{acc}</g>, enfant);
  const fraise = M.fraise.map((_, i) => `f${i}`);
  const cou = M.cou.map((_, i) => `c${i}`);
  return (
    <>
      <defs>
        {devant.map(([k, d]) => (
          <clipPath key={k} id={c(k)}>
            <path d={`M-200 -200H1200V1000H-200Z${d}`} clipRule="evenodd" />
          </clipPath>
        ))}
      </defs>
      <path d={M.nuque.map((m) => m.forme).join("") + M.cou.map((m) => m.forme).join("") + haut + bas} fill={corps} />
      {cache([...fraise, "h", "b", ...cou], arete(M.nuque.map((m) => m.forme).join(""), 4.5))}
      {cache([...fraise, "h", "b"], arete(M.cou.map((m) => m.forme).join(""), 4.5))}
      {cache(fraise, arete(bas, 6))}
      {cache([...fraise, "b"], arete(haut, 6))}
      <path d={lisse(GORGE)} fill={omb} />
      <path d={lisse(CROC) + lisse(CROC_BAS)} fill={lum} />
      {cache(fraise, arete(lisse(OEIL) + PLIS, 4.5))}
      {M.fraise.map((m, i) => (
        <g key={i}>{cache(fraise.slice(i + 1), arete(m.forme, 4.5))}</g>
      ))}
    </>
  );
}

function Dessin({ couche, id, photo }: PropsTotem) {
  if (couche === "dos") return <Buste id={id} />;
  if (couche === "face-portrait") return <Sceau id={id} photo={photo} />;
  return null;
}

const totem: TotemNation = {
  nation: "cm",
  animal: "lion",
  quoi: "Le lion qui rugit en buste, la gueule ouverte vers la lune, modelé dans l'argile du teleuk, sa crinière en mèches en S creusées de poil, des V en colonnes sur la nuque ; un sceau d'argile dans le coin du portrait.",
  sources: [
    { titre: "Creative Bloq, How to draw a lion : le lion mâle de profil, du squelette à la forme", url: "https://www.creativebloq.com/how-to/how-to-draw-a-lion" },
    { titre: "K. Goldfinger, Animal Anatomy for Artists (Oxford University Press, 2004) : planches du lion, squelette et muscles", url: "https://academic.oup.com/book/41965" },
    { titre: "How2DrawAnimals : le lion qui rugit de profil, la gueule, les crocs, le nez plissé", url: "https://how2drawanimals.com/8-animals/478-draw-lion-roaring-color.html" },
    { titre: "Earth Architecture : les reliefs en V des cases obus musgum", url: "https://eartharchitecture.org/?cat=143" },
  ],
  dessine: true,
  boite: { w: 1000, h: 760 },
  pose: {
    dos: { x: -128, y: 386, echelle: 0.95, miroir: true, devant: true, lune: LUNE_CAMEROUN },
    face: { portrait: { x: 70, y: 788, echelle: 0.22, miroir: true } },
  },
  Dessin,
};

export default totem;
