// Le skin de nation « Teleuk » (Cameroun ; PACK AFRIQUE 2027).
//
// Deux savoir-faire du Cameroun, du nord à l'ouest du pays.
//   · Le teleuk, la case obus des Musgum de l'Extrême-Nord, sur le Logone :
//     une coupole d'argile montée à la main par rangs successifs, comme une
//     poterie au colombin, épaisse au pied et mince au sommet, percée d'un
//     oculus. Sa peau porte des reliefs modelés en V et des nervures droites,
//     rangés en colonnes du pied au sommet : ils font courir la pluie et
//     servent d'échafaudage pour remonter l'enduire. C'est la carte : une
//     argile pâle, modelée en relief.
//   · Le toghu des Grassfields (Nord-Ouest) : un vêtement de velours noir
//     brodé à la main de bandes denses, des semaines de travail. Ici, la
//     broderie n'est que géométrique (losanges, dents, points de chaînette),
//     en fil écru, quelques points d'ocre.
//   · le papier : l'argile pâle, son grain d'enduit ;
//     l'encre : le brun de l'argile cuite au soleil ;
//   · la face : autour du portrait, une bande de velours brodée ; sous le
//     portrait, les colonnes de reliefs en V, à peine ;
//   · le dos : la paroi de la case, ses colonnes de V et de nervures modelées
//     à la main (un modelé par joueur, tiré de la graine) ; au centre, la
//     coupole vue d'en haut, ses rangs montés en anneaux et ses reliefs qui
//     rayonnent, la lune dans l'oculus ; en haut et en bas, une bande de
//     velours brodé.
//   · le totem (totems/cameroun.tsx, 02/11/2026) : le lion qui rugit, en
//     buste de profil, taillé dans l'argile au milieu à gauche du dos, la
//     crinière qui frôle le bord ; la coupole et la lune montent en haut à
//     droite (LUNE_CAMEROUN), vers où il rugit ; la bande de velours
//     du haut laisse la place, celle du bas reste ; l'enduit a séché (de la
//     graine : quelques fentes de retrait larges à la racine et effilées,
//     leur lèvre claire, qui naissent loin du lion et de la coupole et les
//     contournent ; un peu de paille et de sable, les passes de la main) ; à la
//     face, le sable sous le portrait, et le lion pressé en sceau d'argile
//     dans le coin du portrait. (Le lion n'est pas un « animal-emblème » de
//     cour comme ceux du toghu : c'est le totem de la sélection.)
// Ce qu'on évite : le ndop (toile royale des Grassfields) et tout objet de
// cour (sièges, masques, coiffes bamoun ou bamiléké) ; les animaux-emblèmes
// (araignée, grenouille, léopard) et les figures du soleil, de la lune ou des
// étoiles que porte souvent le toghu ; la silhouette de la case ; les
// couleurs du drapeau. Rien que des reliefs et une broderie géométrique.

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, BANDE, f, H, LOGOTYPE_DOS, W } from "./outils";
import { LUNE_CAMEROUN } from "./totems/cameroun";

/** Le centre de la coupole et de la lune au dos : montés en haut à droite, vers où le lion rugit (totems/cameroun.tsx). */
const CENTRE_DOS = { cx: LUNE_CAMEROUN.cx, cy: LUNE_CAMEROUN.cy } as const;
/** L'échelle de la coupole : la lune passe de 300 à LUNE_CAMEROUN.d. */
const K = LUNE_CAMEROUN.d / 300;

type Rnd = () => number;

// La palette : l'argile pâle, son ombre et sa lumière ; le velours, le fil écru, l'ocre.
const ARGILE = "#cdb28b";
const OMBRE = "rgba(78,52,30,0.55)";
const LUMIERE = "rgba(255,247,232,0.8)";
const VELOURS = "#16110e";
const ECRU = "#efe5cf";
const OCRE = "#b88a52";

const deja = new Map<string, unknown>();
function memo<T>(cle: string, calcul: () => T): T {
  const v = deja.get(cle);
  if (v !== undefined) return v as T;
  if (deja.size > 48) deja.clear();
  const r = calcul();
  deja.set(cle, r);
  return r;
}

/* ------------------------------- Le relief ------------------------------- */

/**
 * Les colonnes de la paroi : des V pointe en haut, empilés, montés à la main
 * (chaque V un peu de travers), et une nervure droite entre deux colonnes.
 */
function paroi(x0: number, x1: number, y0: number, y1: number, pas: number, rnd: Rnd, jeu = 1) {
  let v = "";
  let nervures = "";
  const n = Math.round((x1 - x0) / pas);
  const p = (x1 - x0) / n;
  for (let c = 0; c < n; c++) {
    const cx = x0 + p * c + p / 2;
    const demi = p * 0.36;
    const h = p * 0.24;
    const pv = p * 0.5;
    const decal = (c % 2) * (pv / 2);
    for (let y = y0 + decal; y < y1 + pv; y += pv) {
      const j = () => (rnd() - 0.5) * 2.4 * jeu;
      v += `M${f(cx - demi + j())} ${f(y + h + j())}L${f(cx + j() * 0.6)} ${f(y + j())}L${f(cx + demi + j())} ${f(y + h + j())}`;
    }
    if (c > 0) {
      const x = x0 + p * c;
      let d = `M${f(x)} ${f(y0)}`;
      for (let y = y0 + 60; y <= y1 + 60; y += 60) d += `L${f(x + (rnd() - 0.5) * 2.2 * jeu)} ${f(y)}`;
      nervures += d;
    }
  }
  return { v, nervures };
}

/** Un trait modelé : l'ombre en bas à droite, la lumière en haut à gauche, puis l'argile. */
function Modele({ d, l, force = 1, corps = ARGILE }: { d: string; l: number; force?: number; corps?: string }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={OMBRE} strokeWidth={l + 1.6} transform="translate(2.2 3)" opacity={force} />
      <path d={d} stroke={LUMIERE} strokeWidth={l * 0.9} transform="translate(-1.4 -1.8)" opacity={force} />
      <path d={d} stroke={corps} strokeWidth={l} opacity={Math.min(1, force * 1.15)} />
    </g>
  );
}

/* ------------------------------ La broderie ------------------------------ */

interface Fils {
  ecru: string;
  ocre: string;
  /** Les points avant (traits pointillés) : un chemin par écartement. */
  avant: string;
  chainette: string;
}

const fils = (): Fils => ({ ecru: "", ocre: "", avant: "", chainette: "" });

/** Un losange plein au passé plat : des points serrés en travers. */
function losange(cx: number, cy: number, a: number, b: number, pas: number): string {
  let d = "";
  for (let t = -a + pas / 2; t < a; t += pas) {
    const h = b * (1 - Math.abs(t) / a);
    if (h > 0.8) d += `M${f(cx + t)} ${f(cy - h)}V${f(cy + h)}`;
  }
  return d;
}

/** Une rangée de dents (triangles) au passé plat, pointe vers le haut (sens 1) ou le bas (−1). */
function dents(x0: number, x1: number, y: number, h: number, l: number, sens: 1 | -1, pas: number): string {
  let d = "";
  for (let x = x0; x + l <= x1 + 0.1; x += l) {
    for (let t = pas / 2; t < l; t += pas) {
      const k = 1 - Math.abs(t - l / 2) / (l / 2);
      const hh = h * k;
      if (hh > 0.8) d += `M${f(x + t)} ${f(y)}V${f(y - sens * hh)}`;
    }
  }
  return d;
}

/** Une petite croix (point de croix). */
const croix = (x: number, y: number, r: number) => `M${f(x - r)} ${f(y - r)}L${f(x + r)} ${f(y + r)}M${f(x + r)} ${f(y - r)}L${f(x - r)} ${f(y + r)}`;

/** La bande étroite (face) : deux lignes de points avant, une chaîne de losanges, des croix d'ocre entre eux. */
function bandeEtroite(L: number, rnd: Rnd): Fils {
  const fl = fils();
  fl.avant += `M0 -11.5H${f(L)}M0 11.5H${f(L)}`;
  const pas = 30;
  const n = Math.floor(L / pas);
  const x0 = (L - n * pas) / 2;
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * pas + pas / 2;
    fl.ecru += losange(cx, 0, 10.5, 8.2, 2.3);
    const xc = cx + pas / 2;
    if (i < n - 1) {
      if (rnd() < 0.82) fl.ocre += croix(xc, 0, 2.6);
      else fl.ecru += croix(xc, 0, 2.2);
    }
  }
  return fl;
}

/** La bande large (dos), de hauteur 150 : points avant, dents, losanges emboîtés, dents, points avant. */
function bandeLarge(L: number, rnd: Rnd): Fils {
  const fl = fils();
  const yA = 58;
  fl.avant += `M0 ${-yA - 10}H${L}M0 ${yA + 10}H${L}`;
  fl.chainette += `M0 ${-yA + 2}H${L}M0 ${yA - 2}H${L}`;
  fl.ecru += dents(0, L, -yA + 22, 14, 24, 1, 2.3) + dents(0, L, yA - 22, 14, 24, -1, 2.3);
  const pas = 64;
  const n = Math.ceil(L / pas) + 1;
  const x0 = (L - (n - 1) * pas) / 2;
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * pas;
    // Le grand losange au trait (un cerne de points serrés), le cœur plein, en ocre une fois sur trois.
    const a = 26;
    const b = 26;
    for (const k of [1, 0.78]) {
      let d = "";
      const pts: [number, number][] = [[cx, -b * k], [cx + a * k, 0], [cx, b * k], [cx - a * k, 0], [cx, -b * k]];
      d += `M${f(pts[0][0])} ${f(pts[0][1])}` + pts.slice(1).map(([x, y]) => `L${f(x)} ${f(y)}`).join("");
      fl.chainette += d;
    }
    const coeur = losange(cx, 0, 12, 12, 2.3);
    if (i % 3 === 1) fl.ocre += coeur;
    else fl.ecru += coeur;
    // Entre deux losanges : trois croix en colonne.
    const xc = cx + pas / 2;
    for (const y of [-14, 0, 14]) {
      const c = croix(xc, y, 2.6);
      if (y === 0 && rnd() < 0.7) fl.ocre += c;
      else fl.ecru += c;
    }
  }
  return fl;
}

function Broderie({ fl, l = 1 }: { fl: Fils; l?: number }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={fl.avant} stroke={ECRU} strokeWidth={2.2 * l} strokeDasharray="7 4.5" opacity={0.9} />
      <path d={fl.chainette} stroke={ECRU} strokeWidth={3.4 * l} strokeDasharray="0.1 5.2" opacity={0.95} />
      <path d={fl.ecru} stroke={ECRU} strokeWidth={1.5 * l} opacity={0.95} />
      <path d={fl.ocre} stroke={OCRE} strokeWidth={1.6 * l} />
    </g>
  );
}

/** Le velours : le noir, et un lustre qui passe en long. */
function Lustre({ id, vertical = false }: { id: string; vertical?: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={vertical ? "1" : "0"} y2={vertical ? "0" : "1"}>
      <stop offset="0" stopColor="#0f0b09" />
      <stop offset="0.38" stopColor="#2a221d" />
      <stop offset="0.55" stopColor={VELOURS} />
      <stop offset="1" stopColor="#0c0907" />
    </linearGradient>
  );
}

/* --------------------------------- La face -------------------------------- */

// La bande de velours autour du portrait : de 7 à 39, jusqu'au bas du portrait.
const CADRE = { x0: 7, y0: 7, x1: W - 7, y1: BANDE - 5, ep: 32, r: 85 };

function rectArrondi(x0: number, y0: number, x1: number, y1: number, r: number) {
  return `M${x0 + r} ${y0}H${x1 - r}A${r} ${r} 0 0 1 ${x1} ${y0 + r}V${y1 - r}A${r} ${r} 0 0 1 ${x1 - r} ${y1}H${x0 + r}A${r} ${r} 0 0 1 ${x0} ${y1 - r}V${y0 + r}A${r} ${r} 0 0 1 ${x0 + r} ${y0}Z`;
}

function face(graine: number) {
  return memo(`face-${graine}`, () => {
    const rnd = alea(graine ^ 0x7465);
    const { x0, y0, x1, y1, ep, r } = CADRE;
    const m = ep / 2;
    // Les quatre côtés droits, chacun brodé dans son repère.
    const cotes = [
      { L: x1 - x0 - 2 * r, t: `translate(${x0 + r} ${y0 + m})` },
      { L: y1 - y0 - 2 * r, t: `translate(${x1 - m} ${y0 + r}) rotate(90)` },
      { L: x1 - x0 - 2 * r, t: `translate(${x1 - r} ${y1 - m}) rotate(180)` },
      { L: y1 - y0 - 2 * r, t: `translate(${x0 + m} ${y1 - r}) rotate(270)` },
    ].map((c) => ({ ...c, fl: bandeEtroite(c.L, rnd) }));
    // Aux coins, les points avant suivent la courbe ; un losange d'ocre au milieu.
    let arcs = "";
    let coins = "";
    const centres: [number, number, number][] = [
      [x1 - r, y0 + r, -Math.PI / 4],
      [x1 - r, y1 - r, Math.PI / 4],
      [x0 + r, y1 - r, (3 * Math.PI) / 4],
      [x0 + r, y0 + r, (-3 * Math.PI) / 4],
    ];
    for (const [cx, cy, a] of centres) {
      for (const rr of [r - m + 11.5, r - m - 11.5]) {
        const a0 = a - Math.PI / 4;
        const a1 = a + Math.PI / 4;
        arcs += `M${f(cx + rr * Math.cos(a0))} ${f(cy + rr * Math.sin(a0))}A${f(rr)} ${f(rr)} 0 0 1 ${f(cx + rr * Math.cos(a1))} ${f(cy + rr * Math.sin(a1))}`;
      }
      const rr = r - m;
      const px = cx + rr * Math.cos(a);
      const py = cy + rr * Math.sin(a);
      coins += losange(px, py, 9, 9, 2.3);
    }
    // Sous le portrait : les colonnes de reliefs, à peine.
    const bas = paroi(0, W, BANDE + 14, H, 64, rnd, 0.8);
    return { cotes, arcs, coins, bas };
  });
}

/** Le sable de l'enduit sous le portrait (la graine). */
function grainsFace(graine: number): string {
  return memo(`grains-${graine}`, () => {
    const rnd = alea(graine ^ 0x6772);
    let d = "";
    for (let i = 0; i < 110; i++) d += `M${f(rnd() * W)} ${f(BANDE + 20 + rnd() * (H - BANDE - 40))}h.1`;
    return d;
  });
}

/* --------------------------------- Le dos --------------------------------- */

const COUPOLE = { r: 408 * K, oculus: 352 * K };
const LISSE = { y0: LOGOTYPE_DOS.cy - 92, y1: LOGOTYPE_DOS.cy + 96 };
const VEL = { haut: 44, bas: H - 194, h: 150 };

function dos(graine: number) {
  return memo(`dos-${graine}`, () => {
    const rnd = alea(graine ^ 0x6d75);
    const { cx, cy } = CENTRE_DOS;
    // La paroi, derrière tout.
    const mur = paroi(0, W, 0, H, 72, rnd, 1);
    // La coupole vue d'en haut : les rangs en anneaux (le colombin), et des V qui rayonnent, pointe vers l'oculus.
    let anneaux = "";
    for (const rr of [COUPOLE.oculus + 2, COUPOLE.r - 4]) {
      let d = "";
      for (let k = 0; k <= 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        const ri = rr + (rnd() - 0.5) * 2.2;
        d += `${k ? "L" : "M"}${f(cx + ri * Math.cos(a))} ${f(cy + ri * Math.sin(a))}`;
      }
      anneaux += d;
    }
    let rayons = "";
    let nervures = "";
    const N = 32;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const da = (Math.PI * 2) / N;
      // Une nervure droite entre deux rangées.
      const an = a0 + da / 2;
      nervures += `M${f(cx + (COUPOLE.oculus + 10 * K) * Math.cos(an))} ${f(cy + (COUPOLE.oculus + 10 * K) * Math.sin(an))}L${f(cx + (COUPOLE.r - 12 * K) * Math.cos(an))} ${f(cy + (COUPOLE.r - 12 * K) * Math.sin(an))}`;
      // Deux V par rangée, pointe vers le centre.
      for (const rr of [COUPOLE.oculus + 14 * K, COUPOLE.oculus + 32 * K]) {
        const j = () => (rnd() - 0.5) * 1.8;
        const demi = da * 0.36;
        const h = 13 * K;
        const p = (r: number, a: number) => `${f(cx + r * Math.cos(a) + j())} ${f(cy + r * Math.sin(a) + j())}`;
        rayons += `M${p(rr + h, a0 - demi)}L${p(rr, a0)}L${p(rr + h, a0 + demi)}`;
      }
    }
    // Les bandes de velours, en haut et en bas.
    const brode = [bandeLarge(W, rnd), bandeLarge(W, rnd)];
    // L'enduit qui a séché au soleil : quelques fentes de retrait, larges à la racine et effilées, qui contournent le lion
    // et la coupole (elles naissent loin d'eux et tournent quand elles s'en approchent) ; le sable et la paille, à peine.
    const ru = alea(graine ^ 0x7365);
    const libre = (x: number, y: number) =>
      Math.hypot(x - cx, y - cy) > COUPOLE.r + 26 && !(x < 700 && y > 310 && y < 1130) && y < LISSE.y0 - 10 && x > 20 && x < W - 20;
    let fentes = "";
    let levres = "";
    for (let i = 0, essais = 0; i < 6 && essais < 80; essais++) {
      let [x, y] = [ru() * W, ru() * (LISSE.y0 - 40)];
      if (!libre(x, y)) continue;
      i++;
      let a = ru() * Math.PI * 2;
      const n = 5 + Math.floor(ru() * 4);
      const gauche: [number, number][] = [];
      const droite: [number, number][] = [];
      for (let k = 0; k <= n; k++) {
        const e = 2.6 * (1 - k / n) + 0.2;
        gauche.push([x - Math.sin(a) * e, y + Math.cos(a) * e]);
        droite.push([x + Math.sin(a) * e, y - Math.cos(a) * e]);
        const l = 10 + ru() * 12;
        let [nx, ny] = [x + l * Math.cos(a), y + l * Math.sin(a)];
        // Contourner : tourner tant que le pas suivant entre dans le lion ou la coupole.
        for (let t = 0; t < 6 && !libre(nx, ny); t++) {
          a += 0.6;
          [nx, ny] = [x + l * Math.cos(a), y + l * Math.sin(a)];
        }
        if (!libre(nx, ny)) break;
        [x, y] = [nx, ny];
        a += (ru() - 0.5) * 0.9;
      }
      const pts = [...gauche, ...droite.reverse()];
      fentes += `M${pts.map(([px, py]) => `${f(px)} ${f(py)}`).join("L")}Z`;
      levres += `M${gauche.map(([px, py]) => `${f(px)} ${f(py)}`).join("L")}`;
    }
    let grains = "";
    let pailles = "";
    for (let i = 0; i < 120; i++) grains += `M${f(ru() * W)} ${f(ru() * H)}h.1`;
    for (let i = 0; i < 10; i++) {
      const [x, y, a] = [ru() * W, ru() * H, ru() * Math.PI];
      pailles += `M${f(x)} ${f(y)}l${f(7 * Math.cos(a))} ${f(7 * Math.sin(a))}`;
    }
    let passes = "";
    for (let i = 0; i < 30; i++) {
      const [x, y] = [ru() * W, ru() * H];
      const l = 40 + ru() * 60;
      passes += `M${f(x)} ${f(y)}q${f(l / 2)} ${f(-10 - ru() * 8)} ${f(l)} ${f((ru() - 0.5) * 6)}`;
    }
    return { mur, anneaux, rayons, nervures, brode, fentes, levres, grains, pailles, passes };
  });
}

/* --------------------------------- Le motif -------------------------------- */

function Grain({ id }: { id: string }) {
  return (
    <pattern id={id} width={9} height={7} patternUnits="userSpaceOnUse">
      <path d="M1 2h1.2M5.5 5.2h1.1M7.6 1.4h0.8" stroke="rgba(92,64,38,0.16)" strokeWidth={1.1} strokeLinecap="round" />
      <path d="M3.2 4.6h1M8 4h0.6" stroke="rgba(255,248,236,0.35)" strokeWidth={1} strokeLinecap="round" />
    </pattern>
  );
}

function Teleuk({ cote, graine, id }: PropsMotifNation) {
  if (cote === "face") {
    const fc = face(graine);
    const { x0, y0, x1, y1, ep, r } = CADRE;
    return (
      <>
        <defs>
          <Grain id={`tk-g-${id}`} />
          <Lustre id={`tk-v-${id}`} />
        </defs>
        <rect width={W} height={H} fill={`url(#tk-g-${id})`} />
        <Modele d={fc.bas.v} l={3.4} force={0.24} />
        <Modele d={fc.bas.nervures} l={2.6} force={0.18} />
        {/* Sous le portrait, le sable et la paille pris dans l'enduit, à peine. */}
        <path d={grainsFace(graine)} stroke="rgba(70,46,26,0.35)" strokeWidth={2.6} strokeLinecap="round" />
        {/* Le velours : un anneau, du bord à la marge du portrait. */}
        <path
          d={rectArrondi(x0, y0, x1, y1, r) + rectArrondi(x0 + ep, y0 + ep, x1 - ep, y1 - ep, r - ep)}
          fill={`url(#tk-v-${id})`}
          fillRule="evenodd"
        />
        <path d={rectArrondi(x0, y0, x1, y1, r)} fill="none" stroke="rgba(255,240,220,0.18)" strokeWidth={1.2} />
        {fc.cotes.map((c, i) => (
          <g key={i} transform={c.t}>
            <Broderie fl={c.fl} />
          </g>
        ))}
        <path d={fc.arcs} fill="none" stroke={ECRU} strokeWidth={2.2} strokeDasharray="7 4.5" opacity={0.9} strokeLinecap="round" />
        <path d={fc.coins} fill="none" stroke={OCRE} strokeWidth={1.6} />
      </>
    );
  }

  const t = dos(graine);
  const { cx, cy } = CENTRE_DOS;
  return (
    <>
      <defs>
        <Grain id={`tk-g-${id}`} />
        <Lustre id={`tk-v-${id}`} />
        <radialGradient id={`tk-c-${id}`} cx="0.42" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#e6d4b7" />
          <stop offset="0.7" stopColor="#d8c09c" />
          <stop offset="1" stopColor="#c4a57d" />
        </radialGradient>
        <linearGradient id={`tk-l-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dccaab" />
          <stop offset="1" stopColor="#d2bb97" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#tk-g-${id})`} />
      {/* La paroi : ses V et ses nervures, modelés. */}
      <Modele d={t.mur.v} l={4.2} force={0.62} />
      <Modele d={t.mur.nervures} l={3.4} force={0.5} />
      {/* L'enduit séché : les passes de la main, les fentes de retrait, la paille et le sable pris dans l'argile. */}
      <path d={t.passes} fill="none" stroke={LUMIERE} strokeWidth={5} strokeLinecap="round" opacity={0.35} />
      <path d={t.passes} fill="none" stroke={OMBRE} strokeWidth={1.4} strokeLinecap="round" opacity={0.22} transform="translate(0 4)" />
      <path d={t.levres} fill="none" stroke={LUMIERE} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" opacity={0.75} transform="translate(1.2 1.6)" />
      <path d={t.fentes} fill="rgba(62,40,22,0.62)" />
      <path d={t.pailles} stroke="#e8d6b2" strokeWidth={1.8} strokeLinecap="round" opacity={0.45} />
      <path d={t.grains} stroke="rgba(70,46,26,0.32)" strokeWidth={2.6} strokeLinecap="round" />
      {/* L'enduit lissé derrière le logotype. */}
      <rect x={0} y={LISSE.y0} width={W} height={LISSE.y1 - LISSE.y0} fill={`url(#tk-l-${id})`} />
      <rect x={0} y={LISSE.y0} width={W} height={LISSE.y1 - LISSE.y0} fill={`url(#tk-g-${id})`} />
      <Modele d={`M0 ${LISSE.y0}H${W}M0 ${LISSE.y1}H${W}`} l={5} force={0.8} />
      {/* La coupole vue d'en haut : l'argile plus claire, les anneaux, les V qui rayonnent, l'oculus. */}
      <circle cx={cx} cy={cy + 6} r={COUPOLE.r + 4} fill="rgba(70,46,26,0.22)" />
      <circle cx={cx} cy={cy} r={COUPOLE.r} fill={`url(#tk-c-${id})`} />
      <circle cx={cx} cy={cy} r={COUPOLE.r} fill={`url(#tk-g-${id})`} />
      <Modele d={t.nervures} l={3.2} force={0.75} />
      <Modele d={t.rayons} l={4} force={0.9} />
      <Modele d={t.anneaux} l={6} force={0.95} />
      {/* L'oculus : un lit d'argile lissée, un peu creusé. */}
      <circle cx={cx} cy={cy} r={COUPOLE.oculus - 4} fill="#e4d3b6" />
      <circle cx={cx} cy={cy} r={COUPOLE.oculus - 4} fill="none" stroke="rgba(78,52,30,0.28)" strokeWidth={8} transform="translate(-2 -3)" />
      {/* Les deux bandes de velours brodé. */}
      {[VEL.bas].map((y, i) => (
        <g key={i}>
          <rect x={0} y={y} width={W} height={VEL.h} fill={`url(#tk-v-${id})`} />
          <path d={`M0 ${y}H${W}M0 ${y + VEL.h}H${W}`} stroke="rgba(255,240,220,0.16)" strokeWidth={1.4} />
          <g transform={`translate(0 ${y + VEL.h / 2})`}>
            <Broderie fl={t.brode[i]} />
          </g>
        </g>
      ))}
    </>
  );
}

const cameroun: SkinNation = {
  nation: "cm",
  nom: "Teleuk",
  quoi: "L'argile modelée des cases obus musgum, et le velours noir brodé du toghu des Grassfields.",
  sources: [
    { titre: "S. Nelson, From Cameroon to Paris : Mousgoum Architecture in and out of Africa (University of Chicago Press, 2007)" },
    { titre: "Compte rendu du livre de S. Nelson (LMU München) : le teleuk, son histoire, son renouveau depuis les années 1990", url: "https://epub.ub.uni-muenchen.de/15921/1/from_cameroon_to_paris.pdf" },
    { titre: "Earth Architecture : les reliefs en V, échafaudage pour remonter l'enduit", url: "https://eartharchitecture.org/?cat=143" },
    { titre: "The Met : vêtement de prestige brodé, Grassfields (Big Babanki), XXe siècle", url: "https://metmuseum.org/art/collection/search/85593" },
    { titre: "Journal du Cameroun : la protection du toghu (atoghu) comme savoir-faire", url: "https://en.journalducameroun.com/?p=330889" },
  ],
  dessine: true,
  matiere: {
    titre: "teleuk",
    encre: "44,30,20",
    sombre: false,
    // L'argile pâle : un enduit lissé, une lumière douce en haut, un pied plus cuit.
    papier: [
      "radial-gradient(80% 46% at 32% 16%, rgba(250,240,222,0.65) 0%, rgba(250,240,222,0) 70%)",
      "radial-gradient(70% 40% at 76% 92%, rgba(150,112,72,0.22) 0%, rgba(150,112,72,0) 70%)",
      "linear-gradient(165deg, #dfccad 0%, #d4bc98 50%, #c6a983 100%)",
    ].join(", "),
    motif: { clair: "rgba(255,247,232,0.6)", fonce: "rgba(78,52,30,0.3)" },
    fond: "rgba(226,212,186,0.94)",
    lueur: "rgba(250,242,226,0.85)",
    rayures: 0.012,
    micro: 0.03,
    reflet: 0.2,
    coins: 0.6,
    etiquette: { fond: "rgba(22,17,14,0.88)", bord: "rgba(239,229,207,0.5)", texte: ECRU },
    symbole: "/bola/symbole-noir.svg",
    rebord: { lumiere: "rgba(255,247,232,0.85)", ombre: "rgba(78,52,30,0.3)" },
    puce: "linear-gradient(135deg, #f7efe0, #c9b18e 45%, #ecdfc8 70%, #a68b66)",
    // La carte photo : le velours noir, une bande de points avant écrus.
    cadre: [
      "repeating-linear-gradient(90deg, rgba(239,229,207,0.55) 0 2px, rgba(0,0,0,0) 2px 5px)",
      "linear-gradient(160deg, #2a221d 0%, #16110e 55%, #0c0907 100%)",
    ].join(", "),
    voile: "rgba(22,17,14,0.6)",
    onglet: { fond: ECRU, encre: VELOURS },
    vive: "#9a7148",
    dos: { micro: 0.016 },
    // La 3D : une tranche d'argile, mate ; un reflet faible, chaud, comme le velours qui accroche.
    tranche: { couleur: "#c4a77f", metal: 0, rugosite: 0.95 },
    holo: { force: 0.16, teinte: [1, 0.95, 0.88] },
  },
  Motif: Teleuk,
};

export default cameroun;
