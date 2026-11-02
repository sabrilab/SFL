// Le skin de nation « Écorce » (Ouganda, pays hôte ; PACK AFRIQUE 2027).
//
// Le tissu d'écorce (lubugo) des Baganda, dont la fabrication est inscrite au
// patrimoine culturel immatériel de l'UNESCO (proclamée en 2005, inscrite en
// 2008) : l'écorce intérieure du mutuba (Ficus natalensis), battue des heures
// au maillet de bois rainuré jusqu'à devenir une étoffe souple, d'un brun
// terre cuite égal. Les pièces se joignent par des points de fibre claire
// (fibre de bananier plantain), et l'on rapièce une étoffe abîmée.
//   · le papier : la terre cuite de l'écorce battue, mate, et ses stries,
//     parallèles et irrégulières, que laisse le maillet rainuré ; tirées de la
//     graine du joueur : chaque étoffe est battue autrement ;
//   · la face : sous le portrait, une couture joint une seconde pièce
//     d'écorce, un peu plus sombre, où se posent la note et le nom ; les
//     points de fibre claire passent par-dessus le bord ;
//   · le dos : la même étoffe ; autour de la lune, une vannerie spiralée de
//     l'Ouganda, ses rangs de spires enroulées de fibre, où les fibres teintes
//     en noir de fumée tournent d'un rang à l'autre ; plus bas, une seconde
//     couture ;
//   · le totem (totems/ouganda.tsx, 02/11/2026) : la grue royale couronnée,
//     cousue en pièces rapportées, debout à gauche ; la lune et sa vannerie
//     (six rangs, serrés sur la lune) montent en haut à droite, devant son bec
//     (LUNE_OUGANDA) ; une couture passe sous ses pieds et devient le sol : le
//     logotype est sur la pièce du milieu, entre elle et la couture du bas ;
//   · l'écorce va plus loin : des paquets de rainures fines là où le maillet
//     a battu à plat, et des jours, où l'écorce plus mince s'ouvre en un
//     réseau lâche de fibres ; tirés de la graine.
// Ce qu'on évite : les tombeaux royaux de Kasubi et les regalia, et tout ce
// qui touche aux usages funéraires de l'étoffe.

import type { PropsMotifNation, SkinNation } from "./types";
import { alea, BANDE, f, H, PORTRAIT, W } from "./outils";
import { LUNE_OUGANDA } from "./totems/ouganda";

/** La lune et la vannerie au dos : montées en haut à droite, devant le bec de la grue (totems/ouganda.tsx). */
const CENTRE_DOS = { cx: LUNE_OUGANDA.cx, cy: LUNE_OUGANDA.cy } as const;
/** Au dos, la couture du sol : sous les pieds de la grue (totems/ouganda.tsx, pose.dos : y −4 + 958 × 1,2). */
const SOL_OUGANDA = 1146;
/** L'échelle de la vannerie : la lune passe de 300 à LUNE_OUGANDA.d. */
const K = LUNE_OUGANDA.d / 300;

type Pt = [number, number];

const deja = new Map<string, unknown>();
function memo<T>(cle: string, calcul: () => T): T {
  const v = deja.get(cle);
  if (v !== undefined) return v as T;
  if (deja.size > 64) deja.clear();
  const r = calcul();
  deja.set(cle, r);
  return r;
}

// La palette : la terre cuite, l'ocre, l'ivoire de la fibre, le noir de fumée.
const TERRE = { haut: "#9b5532", milieu: "#83432a", bas: "#62311c" };
const IVOIRE = "244,232,208";
const OCRE = "196,128,70";
const FUMEE = "34,20,14";


function rectArrondi(x: number, y: number, l: number, h: number, r: number): string {
  return `M${f(x + r)} ${f(y)}H${f(x + l - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + l)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + l - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`;
}

/** Des points réguliers sur un rectangle arrondi, avec leur tangente, à partir du milieu du haut. */
function surLePourtour(x: number, y: number, l: number, h: number, r: number, pas: number): { p: Pt; t: Pt }[] {
  const lh = l - 2 * r;
  const lv = h - 2 * r;
  const q = (Math.PI / 2) * r;
  const total = 2 * lh + 2 * lv + 4 * q;
  const n = Math.max(4, Math.round(total / pas));
  const out: { p: Pt; t: Pt }[] = [];
  const coin = (cx: number, cy: number, a0: number, s: number) => {
    const a = a0 + s / r;
    return { p: [cx + r * Math.cos(a), cy + r * Math.sin(a)] as Pt, t: [-Math.sin(a), Math.cos(a)] as Pt };
  };
  for (let i = 0; i < n; i++) {
    let s = ((i * total) / n + lh / 2) % total;
    if (s < lh) { out.push({ p: [x + r + s, y], t: [1, 0] }); continue; }
    s -= lh;
    if (s < q) { out.push(coin(x + l - r, y + r, -Math.PI / 2, s)); continue; }
    s -= q;
    if (s < lv) { out.push({ p: [x + l, y + r + s], t: [0, 1] }); continue; }
    s -= lv;
    if (s < q) { out.push(coin(x + l - r, y + h - r, 0, s)); continue; }
    s -= q;
    if (s < lh) { out.push({ p: [x + l - r - s, y + h], t: [-1, 0] }); continue; }
    s -= lh;
    if (s < q) { out.push(coin(x + r, y + h - r, Math.PI / 2, s)); continue; }
    s -= q;
    if (s < lv) { out.push({ p: [x, y + h - r - s], t: [0, -1] }); continue; }
    s -= lv;
    out.push(coin(x + r, y + r, Math.PI, s));
  }
  return out;
}

/* -------------------------------- Les stries -------------------------------- */

/**
 * Les stries du maillet : des fibres presque horizontales, serrées et
 * irrégulières, courtes, qui se chevauchent et se rompent ; et des nuées plus
 * claires ou plus sombres, là où l'écorce est plus mince ou plus épaisse.
 */
function stries(seed: number): {
  claires: string;
  sombres: string;
  fines: string;
  nuees: { x: number; y: number; rx: number; ry: number; a: number; clair: boolean }[];
  frappes: string;
  trame: string;
  jours: { x: number; y: number; rx: number; ry: number }[];
} {
  const rnd = alea(seed ^ 0x0b0a5c1e);
  let claires = "";
  let sombres = "";
  let fines = "";
  let y = 2 + rnd() * 4;
  while (y < H) {
    const amp = 0.6 + rnd() * 2.2;
    const per = 120 + rnd() * 300;
    const ph = rnd() * Math.PI * 2;
    let x = -10 + rnd() * 30;
    while (x < W + 10) {
      // Un brin de fibre : un morceau de strie, qui s'effile, puis une rupture.
      const long = 24 + rnd() * 150;
      const x1 = Math.min(W + 10, x + long);
      const dy = (rnd() - 0.5) * 3;
      let d = "";
      for (let xx = x; xx <= x1 + 0.1; xx += Math.max(8, (x1 - x) / 6)) {
        const yy = y + dy * ((xx - x) / long) + amp * Math.sin((xx / per) * Math.PI * 2 + ph);
        d += `${xx === x ? "M" : "L"}${f(xx)} ${f(yy)}`;
      }
      const t = rnd();
      if (t < 0.3) claires += d;
      else if (t < 0.62) sombres += d;
      else fines += d;
      x = x1 + 3 + rnd() * 26;
    }
    y += 2.6 + rnd() * 5.5;
  }
  const nuees: { x: number; y: number; rx: number; ry: number; a: number; clair: boolean }[] = [];
  for (let i = 0; i < 46; i++) {
    nuees.push({
      x: rnd() * W,
      y: rnd() * H,
      rx: 60 + rnd() * 220,
      ry: 18 + rnd() * 70,
      a: 0.05 + rnd() * 0.1,
      clair: rnd() < 0.45,
    });
  }
  // Les frappes du maillet rainuré : des paquets de quatre ou cinq rainures
  // fines et parallèles, un peu de biais, là où l'écorce a été battue à plat.
  let frappes = "";
  for (let i = 0; i < 70; i++) {
    const x0 = rnd() * W;
    const y0 = rnd() * H;
    const a = (rnd() - 0.5) * 0.24;
    const l = 30 + rnd() * 70;
    const n = 4 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++) {
      const yy = y0 + k * 2.3;
      frappes += `M${f(x0)} ${f(yy)}L${f(x0 + Math.cos(a) * l)} ${f(yy + Math.sin(a) * l)}`;
    }
  }
  // Les jours : là où l'écorce est la plus mince, ses fibres s'écartent en
  // un réseau lâche où passe la lumière.
  const jours: { x: number; y: number; rx: number; ry: number }[] = [];
  let trame = "";
  for (let i = 0; i < 7; i++) {
    const j = { x: 60 + rnd() * (W - 120), y: 60 + rnd() * (H - 120), rx: 26 + rnd() * 40, ry: 8 + rnd() * 12 };
    jours.push(j);
    for (let k = 0; k < 26; k++) {
      const u = (rnd() - 0.5) * 2;
      const v = (rnd() - 0.5) * 2;
      if (u * u + v * v > 1) continue;
      const x = j.x + u * j.rx;
      const y = j.y + v * j.ry;
      const a = (rnd() < 0.5 ? -1 : 1) * (0.15 + rnd() * 0.35);
      const l = 8 + rnd() * 16;
      trame += `M${f(x - (Math.cos(a) * l) / 2)} ${f(y - (Math.sin(a) * l) / 2)}L${f(x + (Math.cos(a) * l) / 2)} ${f(y + (Math.sin(a) * l) / 2)}`;
    }
  }
  return { claires, sombres, fines, nuees, frappes, trame, jours };
}

/* -------------------------------- La couture -------------------------------- */

/**
 * La couture de deux pièces : le bord un peu effiloché de la pièce du dessus,
 * et les points de fibre claire, en surjet, qui le chevauchent.
 */
function couture(seed: number, y0: number): { bord: string; piece: string; points: string; ombres: string; fibres: string } {
  const rnd = alea(seed ^ 0x5eaa11);
  // Une pièce n'est jamais coupée droite : deux ondulations lentes.
  const p1 = rnd() * 6.28;
  const p2 = rnd() * 6.28;
  const bordY = (x: number) => y0 + 4 * Math.sin(x / 131 + p1) + 2.2 * Math.sin(x / 47 + p2);
  let bord = "";
  let piece = "";
  const pts: Pt[] = [];
  for (let x = -10; x <= W + 10; x += 12) {
    pts.push([x, bordY(x) + (rnd() - 0.5) * 3.2]);
  }
  bord = pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join("");
  piece = `${bord}L${W + 10} ${H + 10}L-10 ${H + 10}Z`;
  let points = "";
  let ombres = "";
  for (let x = 12 + rnd() * 8; x < W - 8; x += 19 + rnd() * 15) {
    const y = bordY(x);
    const haut = 8 + rnd() * 7;
    const bas = 8 + rnd() * 7;
    const pe = 4 + rnd() * 11;
    // Un point de surjet : il sort sous la pièce, passe par-dessus le bord en biais, rentre au-dessus.
    const a: Pt = [x - pe / 2, y + bas];
    const b: Pt = [x + pe / 2, y - haut];
    const c: Pt = [x + (rnd() - 0.5) * 2, y + (rnd() - 0.5) * 2 - 1];
    points += `M${f(a[0])} ${f(a[1])}Q${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`;
    ombres += `M${f(a[0] + 1.2)} ${f(a[1] + 2.2)}Q${f(c[0] + 1.2)} ${f(c[1] + 2.2)} ${f(b[0] + 1.2)} ${f(b[1] + 2.2)}`;
  }
  // Les fibres qui dépassent du bord de la pièce, effilochées.
  let fibres = "";
  for (let x = 4 + rnd() * 6; x < W - 4; x += 3 + rnd() * 9) {
    const y = bordY(x);
    const l = 2 + rnd() * 7;
    const a = -Math.PI / 2 + (rnd() - 0.5) * 1.4;
    fibres += `M${f(x)} ${f(y + 1)}L${f(x + Math.cos(a) * l)} ${f(y + 1 + Math.sin(a) * l)}`;
  }
  return { bord, piece, points, ombres, fibres };
}


/* -------------------------------- L'ourlet -------------------------------- */

/**
 * L'ourlet : une bande d'écorce plus sombre, rabattue sur le bord et cousue
 * en surjet de fibre claire, comme on borde une étoffe. À la face, il entoure
 * le portrait ; au dos, il fait le tour de la carte.
 */
const OURLET = {
  face: { ext: 9, int: PORTRAIT.x - 1, bas: BANDE - 9, rIn: 52 },
  dos: { ext: 9, int: 42, bas: H - 9, rIn: 52 },
};
function ourlet(seed: number, dos: boolean): { bande: string; bords: string; points: string; ombres: string } {
  const rnd = alea(seed ^ 0x0a1e7);
  const o = dos ? OURLET.dos : OURLET.face;
  const rOut = 92 - o.ext;
  const exter = rectArrondi(o.ext, o.ext, W - 2 * o.ext, o.bas - o.ext, rOut);
  const inter = dos
    ? rectArrondi(o.int, o.int, W - 2 * o.int, H - 2 * o.int, o.rIn)
    : rectArrondi(PORTRAIT.x - 1, PORTRAIT.y - 1, PORTRAIT.c + 2, PORTRAIT.c + 2, o.rIn);
  const m = (o.ext + o.int) / 2;
  const basInt = dos ? H - o.int : PORTRAIT.y + PORTRAIT.c + 1;
  const basM = (o.bas + basInt) / 2;
  const rM = (rOut + o.rIn) / 2;
  const demi = (o.int - o.ext) / 2;
  let points = "";
  let ombres = "";
  for (const { p, t } of surLePourtour(m, m, W - 2 * m, basM - m, rM, dos ? 26 : 23)) {
    // À la face, le bas de l'ourlet est la couture des deux pièces : on n'y coud pas deux fois.
    if (!dos && p[1] > basM - rM * 0.6) continue;
    // La normale, vers l'intérieur de la carte.
    const nx = -t[1];
    const ny = t[0];
    const pe = 5 + rnd() * 5;
    const l = demi * (0.86 + rnd() * 0.3);
    const j = (rnd() - 0.5) * 3;
    const a: Pt = [p[0] - nx * l - t[0] * pe + t[0] * j, p[1] - ny * l - t[1] * pe + t[1] * j];
    const b: Pt = [p[0] + nx * l + t[0] * pe + t[0] * j, p[1] + ny * l + t[1] * pe + t[1] * j];
    points += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
    ombres += `M${f(a[0] + 1.2)} ${f(a[1] + 2)}L${f(b[0] + 1.2)} ${f(b[1] + 2)}`;
  }
  return { bande: exter + inter, bords: exter + inter, points, ombres };
}

/* -------------------------------- La vannerie -------------------------------- */

/**
 * La vannerie spiralée autour de la lune : des spires de fibre enroulée,
 * chacune faite de tours serrés (de petits traits radiaux). Les tours teints
 * en noir de fumée avancent d'un cran à chaque rang : leurs bandes tournent
 * en spirale. Un rang d'ocre au bord.
 */
function vannerie(): { nature: string; fumee: string; ocre: string; sillons: string } {
  const { cx, cy } = CENTRE_DOS;
  // Au dos de la grue, la vannerie serre la lune de plus près, en six rangs.
  const r0 = 326 * K;
  const rangs = 6;
  const h = 11.5 * K;
  const bandes = 12;
  let nature = "";
  let fumee = "";
  let ocre = "";
  let sillons = "";
  for (let i = 0; i < rangs; i++) {
    const rm = r0 + i * h + h / 2;
    const n = Math.round((2 * Math.PI * rm) / (4.6 * K));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      // Un tour de fibre : légèrement penché, comme la fibre qui s'enroule.
      const d = (0.7 * K) / rm;
      const t = `M${f(cx + Math.cos(a - d) * (rm - h * 0.4))} ${f(cy + Math.sin(a - d) * (rm - h * 0.4))}L${f(cx + Math.cos(a + d) * (rm + h * 0.4))} ${f(cy + Math.sin(a + d) * (rm + h * 0.4))}`;
      const u = (((a / (Math.PI * 2)) * bandes + i * 0.11) % 1 + 1) % 1;
      if (i === rangs - 1 || i === 0) ocre += t;
      else if (i <= 3) {
        // Les rangs du dedans : les bandes teintes tournent en spirale.
        if (u < 0.36) fumee += t;
        else nature += t;
      } else {
        // Les rangs du dehors : des dents, qui s'affinent vers le bord.
        const v = (((a / (Math.PI * 2)) * 24) % 1 + 1) % 1;
        const larg = (7 - i) / 3 * 0.62;
        if (Math.abs(v - 0.5) < larg / 2) fumee += t;
        else nature += t;
      }
    }
    const rr = r0 + i * h;
    sillons += `M${f(cx - rr)} ${f(cy)}a${f(rr)} ${f(rr)} 0 1 0 ${f(2 * rr)} 0a${f(rr)} ${f(rr)} 0 1 0 ${f(-2 * rr)} 0`;
  }
  const rr = r0 + rangs * h;
  sillons += `M${f(cx - rr)} ${f(cy)}a${f(rr)} ${f(rr)} 0 1 0 ${f(2 * rr)} 0a${f(rr)} ${f(rr)} 0 1 0 ${f(-2 * rr)} 0`;
  return { nature, fumee, ocre, sillons };
}

/* --------------------------------- Le motif --------------------------------- */

function Ecorce({ cote, m, graine, id }: PropsMotifNation) {
  const dos = cote === "dos";
  const st = memo(`st:${graine}:${dos ? 1 : 0}`, () => stries(graine ^ (dos ? 0x9e3779b9 : 0)));
  const yCouture = dos ? 1352 : BANDE - 16;
  const co = memo(`co:${graine}:${yCouture}`, () => couture(graine, yCouture));
  const v = memo("vannerie", vannerie);
  const ou = memo(`ou:${graine}:${dos ? 1 : 0}`, () => ourlet(graine, dos));
  // Au dos, une seconde couture sous les pieds de la grue (totems/ouganda.tsx) : elle devient le sol.
  const sol = dos ? memo(`ch:${graine}`, () => couture(graine ^ 0x7091, SOL_OUGANDA)) : null;
  return (
    <>
      <defs>
        <linearGradient id={`ep-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`rgb(${FUMEE})`} stopOpacity={0.16} />
          <stop offset="1" stopColor={`rgb(${FUMEE})`} stopOpacity={0.26} />
        </linearGradient>
        <radialGradient id={`en-${id}`}>
          <stop offset="0" stopColor={`rgb(${OCRE})`} stopOpacity={1} />
          <stop offset="1" stopColor={`rgb(${OCRE})`} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`es-${id}`}>
          <stop offset="0" stopColor={`rgb(${FUMEE})`} stopOpacity={1} />
          <stop offset="1" stopColor={`rgb(${FUMEE})`} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Les nuées : l'écorce plus mince ou plus épaisse */}
      {st.nuees.map((n, i) => (
        <ellipse key={i} cx={f(n.x)} cy={f(n.y)} rx={f(n.rx)} ry={f(n.ry)} fill={`url(#${n.clair ? "en" : "es"}-${id})`} opacity={f(n.a * 100) / 100} />
      ))}
      {/* Les jours : l'écorce plus mince, son réseau lâche de fibres */}
      {st.jours.map((j, i) => (
        <ellipse key={`j${i}`} cx={f(j.x)} cy={f(j.y)} rx={f(j.rx)} ry={f(j.ry)} fill={`url(#en-${id})`} opacity={0.22} />
      ))}
      <path d={st.trame} fill="none" stroke={`rgba(${IVOIRE},0.13)`} strokeWidth={0.8} />
      {/* Les frappes du maillet rainuré, puis ses stries */}
      <path d={st.frappes} fill="none" stroke={m.fonce} strokeWidth={0.8} opacity={0.75} />
      <path d={st.fines} fill="none" stroke={m.fonce} strokeWidth={0.9} opacity={0.7} />
      <path d={st.sombres} fill="none" stroke={m.fonce} strokeWidth={1.6} />
      <path d={st.claires} fill="none" stroke={m.clair} strokeWidth={1.1} />

      {/* La seconde pièce, un peu plus sombre, sous la couture */}
      <path d={co.piece} fill={`url(#ep-${id})`} />
      <path d={co.bord} fill="none" stroke="rgba(30,10,4,0.4)" strokeWidth={5} transform="translate(0 3)" />
      <path d={co.bord} fill="none" stroke={`rgba(${OCRE},0.5)`} strokeWidth={1.6} />
      <path d={co.fibres} fill="none" stroke={`rgba(${OCRE},0.45)`} strokeWidth={0.9} />
      {/* Les points de fibre claire, en surjet */}
      <path d={co.ombres} fill="none" stroke="rgba(30,10,4,0.5)" strokeWidth={4} strokeLinecap="round" />
      <path d={co.points} fill="none" stroke={`rgba(${IVOIRE},0.72)`} strokeWidth={2.5} strokeLinecap="round" />
      <path d={co.points} fill="none" stroke="rgba(255,250,236,0.5)" strokeWidth={1} strokeLinecap="round" transform="translate(-0.6 -0.8)" />

      {sol && (
        <g>
          {/* Au dos, la couture du sol, sous les pieds de la grue : la pièce du dessous, un peu plus sombre */}
          <path d={sol.piece} fill={`url(#ep-${id})`} />
          <path d={sol.bord} fill="none" stroke="rgba(30,10,4,0.4)" strokeWidth={5} transform="translate(0 3)" />
          <path d={sol.bord} fill="none" stroke={`rgba(${OCRE},0.5)`} strokeWidth={1.6} />
          <path d={sol.fibres} fill="none" stroke={`rgba(${OCRE},0.45)`} strokeWidth={0.9} />
          <path d={sol.ombres} fill="none" stroke="rgba(30,10,4,0.5)" strokeWidth={4} strokeLinecap="round" />
          <path d={sol.points} fill="none" stroke={`rgba(${IVOIRE},0.72)`} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      )}

      {/* L'ourlet rabattu, cousu en surjet de fibre claire */}
      <path d={ou.bande} fill="rgba(36,14,6,0.34)" fillRule="evenodd" />
      <path d={ou.bords} fill="none" stroke={`rgba(${OCRE},0.42)`} strokeWidth={1.4} />
      <path d={ou.ombres} fill="none" stroke="rgba(20,8,2,0.55)" strokeWidth={3.6} strokeLinecap="round" />
      <path d={ou.points} fill="none" stroke={`rgba(${IVOIRE},0.78)`} strokeWidth={2.4} strokeLinecap="round" />

      {dos && (
        <>
          {/* La vannerie spiralée, autour de la lune */}
          <circle cx={CENTRE_DOS.cx} cy={CENTRE_DOS.cy} r={(326 + 6 * 11.5 + 4) * K} fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={8 * K} />
          <path d={v.nature} stroke={`rgba(${IVOIRE},0.62)`} strokeWidth={2.4 * K + 0.3} strokeLinecap="round" />
          <path d={v.fumee} stroke={`rgba(${FUMEE},0.92)`} strokeWidth={2.4 * K + 0.3} strokeLinecap="round" />
          <path d={v.ocre} stroke={`rgba(${OCRE},0.85)`} strokeWidth={2.4 * K + 0.3} strokeLinecap="round" />
          <path d={v.sillons} fill="none" stroke="rgba(0,0,0,0.42)" strokeWidth={1.2} />
        </>
      )}
    </>
  );
}

const ecorce: SkinNation = {
  nation: "ug",
  nom: "Écorce",
  quoi: "Le tissu d'écorce des Baganda, battu au maillet et cousu de fibre claire, et la vannerie spiralée de l'Ouganda.",
  sources: [
    { titre: "UNESCO, La fabrication du tissu d'écorce en Ouganda (patrimoine immatériel, 2008)", url: "https://ich.unesco.org/en/RL/barkcloth-making-in-uganda-00139" },
    { titre: "Museum of Archaeology and Anthropology, Cambridge : étoffes d'écorce cousues et rapiécées de fibre de plantain", url: "https://collections.maa.cam.ac.uk/objects/568015" },
    { titre: "Smarthistory, le tissu d'écorce du Buganda", url: "https://smarthistory.org/?p=76461" },
    { titre: "Penn Museum, vannerie spiralée d'Ouganda (spires enroulées de raphia)", url: "https://penn.museum/collections/object/237415" },
  ],
  dessine: true,
  matiere: {
    titre: "écorce",
    encre: IVOIRE,
    sombre: true,
    papier: [
      "radial-gradient(90% 55% at 50% 30%, rgba(214,140,84,0.28) 0%, rgba(214,140,84,0) 70%)",
      "linear-gradient(118deg, rgba(255,226,190,0) 34%, rgba(255,226,190,0.06) 46%, rgba(255,226,190,0) 58%)",
      `linear-gradient(172deg, ${TERRE.haut} 0%, ${TERRE.milieu} 50%, ${TERRE.bas} 100%)`,
    ].join(", "),
    motif: { clair: `rgba(${OCRE},0.16)`, fonce: "rgba(52,22,10,0.2)" },
    fond: "#7c3f25",
    lueur: "rgba(255,224,186,0.12)",
    rayures: 0.04,
    micro: 0.032,
    reflet: 0.1,
    coins: 0.6,
    etiquette: { fond: "#4a2413", bord: `rgba(${IVOIRE},0.5)`, texte: `rgba(${IVOIRE},0.92)` },
    symbole: "/bola/symbole-blanc.svg",
    rebord: { lumiere: "rgba(255,222,186,0.32)", ombre: "rgba(30,10,4,0.6)" },
    puce: "linear-gradient(135deg, #f1e3c8, #a8825f 45%, #e2cfaf 70%, #6e4a30)",
    cadre: `linear-gradient(152deg, #a15c36 0%, ${TERRE.bas} 42%, #8a4a2c 66%, #4a2414 100%)`,
    voile: "rgba(40,16,8,0.8)",
    onglet: { fond: "#f3e8d4", encre: "#3a1a0c" },
    vive: "#efe2c8",
    tranche: { couleur: "#6e3a20", metal: 0.02, rugosite: 0.86 },
    holo: { force: 0.14, teinte: [1, 0.86, 0.7] },
  },
  Motif: Ecorce,
};

export default ecorce;
