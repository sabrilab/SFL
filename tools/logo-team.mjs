// Les propositions de logo pour Bola Team (Sabri, 24/10 : « Bola, c'est
// exceptionnel, mais le Team, propose d'autres noms ou d'autres designs »).
//
//   node tools/logo-team.mjs   → public/bola/bola-team.svg, bola-club.svg,
//                                bola-fc.svg et bola-team-plaque.svg
//
// Les lettres sont dessinées dans celles du logotype BOLA (logo-blanc.svg,
// 1000 × 237 ; ligne de base 214,268, capitales de 181,823) : le B, le L et le
// A sont repris du logo et refermés là où leurs voisines les cachent ; le C et
// le U viennent du O (symétrique par rapport à son centre, donc complété par
// symétrie), ouvert par une fente comme les contreformes du B, ou prolongé de
// deux fûts à la pente de l'italique ; T, E, F et M prennent les épaisseurs et
// les pentes du logo (flanc du B 0,4009, fût du L 0,2889/0,3349, fentes du B
// à la hauteur des siennes). Les lettres se soudent comme B-O-L-A : contours
// extérieurs dans un sens, contreformes dans l'autre, remplissage nonzero.
// Le ® du logo est reporté au bout du mot. Largeur pour 18 px de haut, comme
// BOLA (0,074 × la largeur du dessin) : la constante l de choix-ligue.tsx.
import fs from "node:fs";

const YB = 214.268, YT = 32.445, H = YB - YT;

// ---- Bézier ----
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const pt = (s, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * s.p0[k] + 3 * u * u * t * s.c1[k] + 3 * u * t * t * s.c2[k] + t * t * t * s.p3[k]);
};
const der = (s, t) => {
  const u = 1 - t;
  return [0, 1].map((k) => 3 * u * u * (s.c1[k] - s.p0[k]) + 6 * u * t * (s.c2[k] - s.c1[k]) + 3 * t * t * (s.p3[k] - s.c2[k]));
};
function split(s, t) {
  const a = lerp(s.p0, s.c1, t), b = lerp(s.c1, s.c2, t), c = lerp(s.c2, s.p3, t);
  const d = lerp(a, b, t), e = lerp(b, c, t), f = lerp(d, e, t);
  return [{ p0: s.p0, c1: a, c2: d, p3: f }, { p0: f, c1: e, c2: c, p3: s.p3 }];
}
const C = (p0, c1, c2, p3) => ({ p0, c1, c2, p3 });
const L = (p0, p3) => ({ p0, c1: lerp(p0, p3, 1 / 3), c2: lerp(p0, p3, 2 / 3), p3 });

// Racines de f(t) = 0 sur [0, 1] (échantillonnage puis dichotomie).
function racines(f) {
  const r = [];
  let ta = 0, fa = f(0);
  for (let k = 1; k <= 400; k++) {
    const tb = k / 400, fb = f(tb);
    if (fa === 0) r.push(ta);
    else if (fa * fb < 0) {
      let a = ta, b = tb, va = fa;
      for (let n = 0; n < 60; n++) {
        const m = (a + b) / 2, vm = f(m);
        if (va * vm <= 0) b = m;
        else { a = m; va = vm; }
      }
      r.push((a + b) / 2);
    }
    ta = tb; fa = fb;
  }
  return r;
}

// Le O du logo, complété là où le B et le L le recouvrent (il est symétrique
// par rapport à son centre, 489.7 ; 123.48).
const M2 = [979.4, 246.96];
const miroir = (p) => [M2[0] - p[0], M2[1] - p[1]];
const cacheG = C([376.375, 136.901], [375.455, 143.84], [375.448, 151.28], [376.525, 158.198]);
const S1 = C([376.525, 158.198], [377.614, 165.187], [379.772, 171.965], [383.076, 178.381]);
const S7 = C([449.407, 45.211], [407.936, 66.56], [380.943, 102.443], [376.375, 136.901]);
const O_EXT = [
  S1,
  C([383.076, 178.381], [405.332, 221.614], [471.112, 232.085], [530.001, 201.769]),
  C([530.001, 201.769], miroir(S7.c1), miroir(S7.c2), [603.033, 110.079]),
  C([603.033, 110.079], miroir(cacheG.c1), miroir(cacheG.c2), miroir(cacheG.p3)),
  C(miroir(S1.p0), miroir(S1.c1), miroir(S1.c2), [596.332, 68.6]),
  C([596.332, 68.6], [574.076, 25.367], [508.296, 14.896], [449.407, 45.211]),
  S7,
  cacheG,
];
const O_INT = [
  C([460.577, 102.781], [476.045, 82.2], [501.088, 74.915], [516.513, 86.507]),
  C([516.513, 86.507], [531.938, 98.1], [531.904, 124.182], [516.436, 144.762]),
  C([516.436, 144.762], [500.969, 165.342], [475.925, 172.628], [460.5, 161.035]),
  C([460.5, 161.035], [445.075, 149.442], [445.109, 123.36], [460.577, 102.781]),
];

// Positions {i, t} sur un contour fermé de segments.
function croiseY(segs, y) {
  const r = [];
  segs.forEach((s, i) => racines((t) => pt(s, t)[1] - y).forEach((t) => r.push({ i, t, x: pt(s, t)[0] })));
  return r;
}
// Points où la tangente vaut dx/dy = q.
function tangente(segs, q) {
  const r = [];
  const g = (s, t) => { const d = der(s, t); return d[0] - q * d[1]; };
  segs.forEach((s, i) => {
    racines((t) => g(s, t)).forEach((t) => r.push({ i, t, p: pt(s, t), d: der(s, t) }));
    // Un léger angle entre deux segments : la tangente y bascule.
    const n = segs[(i + 1) % segs.length];
    if (g(s, 1) * g(n, 0) < 0) r.push({ i, t: 1, p: pt(s, 1), d: der(s, 1) });
  });
  return r;
}
// Le morceau de contour qui va de a à b en avançant.
function morceau(segs, a, b) {
  const out = [];
  let i = a.i, t = a.t;
  for (let n = 0; n < segs.length * 2 + 2; n++) {
    const s = segs[i];
    if (i === b.i && b.t >= t - 1e-9 && !(n === 0 && b.t < t)) {
      const fin = split(s, b.t)[0];
      const part = t > 0 ? split(fin, t / b.t)[1] : fin;
      out.push(part);
      return out;
    }
    out.push(t > 0 ? split(s, t)[1] : s);
    i = (i + 1) % segs.length;
    t = 0;
  }
  throw new Error("morceau");
}
const inverse = (segs) => segs.slice().reverse().map((s) => C(s.p3, s.c2, s.c1, s.p0));
const f = (v) => Math.round(v * 100) / 100;
function chemin(segs) {
  let d = `M${f(segs[0].p0[0])},${f(segs[0].p0[1])}`;
  for (const s of segs) {
    const droit = Math.abs((s.c1[0] - s.p0[0]) * (s.p3[1] - s.p0[1]) - (s.c1[1] - s.p0[1]) * (s.p3[0] - s.p0[0])) < 1e-6 && Math.abs((s.c2[0] - s.p0[0]) * (s.p3[1] - s.p0[1]) - (s.c2[1] - s.p0[1]) * (s.p3[0] - s.p0[0])) < 1e-6;
    d += droit ? `L${f(s.p3[0])},${f(s.p3[1])}` : `C${f(s.c1[0])},${f(s.c1[1])} ${f(s.c2[0])},${f(s.c2[1])} ${f(s.p3[0])},${f(s.p3[1])}`;
  }
  return d + "Z";
}
const poly = (pts) => pts.map((p, k) => L(p, pts[(k + 1) % pts.length]));
const decale = (segs, dx, dy = 0) => segs.map((s) => ({ p0: [s.p0[0] + dx, s.p0[1] + dy], c1: [s.c1[0] + dx, s.c1[1] + dy], c2: [s.c2[0] + dx, s.c2[1] + dy], p3: [s.p3[0] + dx, s.p3[1] + dy] }));
const aire = (segs) => {
  let a = 0;
  for (const s of segs) for (let k = 0; k < 16; k++) { const p = pt(s, k / 16), q = pt(s, (k + 1) / 16); a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
};
const xmin = (contours) => Math.min(...contours.flat().flatMap((s) => [0, 0.25, 0.5, 0.75, 1].map((t) => pt(s, t)[0])));
const xmax = (contours) => Math.max(...contours.flat().flatMap((s) => [0, 0.25, 0.5, 0.75, 1].map((t) => pt(s, t)[0])));

// ---- Lettres tirées du logo ----
// B : son bas de panse, caché par le O, refermé en douceur.
function lettreB() {
  const ext = [
    L([150.41, 214.268], [286.166, 214.268]),
    C([286.166, 214.268], [323.851, 214.268], [363.69, 197.348], [376.525, 158.198]),
    C([376.525, 158.198], [379.017, 150.596], [379.1, 144.423], [376.375, 136.901]),
    C([376.375, 136.901], [373.347, 128.542], [367.028, 122.217], [358.637, 118.99]),
    L([358.637, 118.99], [351.198, 116.129]),
    C([351.198, 116.129], [374.02, 108.643], [400.614, 89.558], [400.614, 63.005]),
    C([400.614, 63.005], [400.614, 38.799], [374.964, 32.446], [355.513, 32.446]),
    L([355.513, 32.446], [223.301, 32.446]),
    L([223.301, 32.446], [150.41, 214.268]),
  ];
  const bas = [
    L([261.801, 139.198], [287.015, 139.198]),
    C([287.015, 139.198], [291.892, 139.198], [295.919, 144.298], [295.919, 149.33]),
    C([295.919, 149.33], [295.919, 160.204], [283.993, 168.749], [277.457, 168.749]),
    L([277.457, 168.749], [250.436, 168.749]),
    L([250.436, 168.749], [261.801, 139.198]),
  ];
  const haut = [
    L([286.573, 75.622], [308.776, 75.622]),
    C([308.776, 75.622], [313.714, 75.622], [317.083, 79.938], [317.083, 84.809]),
    C([317.083, 84.809], [317.083, 93.077], [308.004, 101.829], [300.42, 101.829]),
    L([300.42, 101.829], [276.503, 101.829]),
    L([276.503, 101.829], [286.573, 75.622]),
  ];
  return [ext, bas, haut];
}
// L : le pied, fondu dans le A sur le logo, fini par une coupe à la pente du fût.
function lettreL(pied = 98) {
  const xe = 656.574 + pied;
  return [poly([[566.537, YB], [xe - 0.2889 * (YB - 160.428), YB], [xe, 160.428], [656.574, 160.428], [699.435, YT], [619.061, YT]])];
}
// A : tel quel, sa jambe gauche prolongée jusqu'à la ligne de base.
function lettreA() {
  const xg = 789.645 - (80.903 / 127.983) * H;
  return [
    poly([[xg, YB], [754.071, YB], [772.865, 182.586], [839.135, 182.586], [842.041, YB], [933.695, YB], [906.131, YT], [789.645, YT]]),
    poly([[799.323, 141.12], [834.381, 85.376], [837.979, 141.12]]),
  ];
}

// ---- Lettres nouvelles, dans le même dessin ----
const SB = 0.4009; // pente du flanc gauche du B
const SL = 0.2889, SR = 0.3349; // pentes du fût du L (gauche, droite)
const SC = 0.3843; // pente des contreformes du B
// C : le O ouvert à droite par une fente, comme les contreformes du B.
function lettreC(yh = 101, yb = 139) {
  const ext = croiseY(O_EXT, yh).sort((a, b) => b.x - a.x)[0];
  const extB = croiseY(O_EXT, yb).sort((a, b) => b.x - a.x)[0];
  const intH = croiseY(O_INT, yh).sort((a, b) => b.x - a.x)[0];
  const intB = croiseY(O_INT, yb).sort((a, b) => b.x - a.x)[0];
  const tour = morceau(O_EXT, ext, extB); // de la fente haute, par le haut, la gauche, le bas, jusqu'à la fente basse
  const dedans = morceau(O_INT, intB, intH); // la contreforme, de la fente basse à la fente haute, par le bas et la gauche
  const segs = [...tour, L(tour.at(-1).p3, dedans[0].p0), ...dedans, L(dedans.at(-1).p3, tour[0].p0)];
  return [segs];
}
// U : le bas du O, prolongé par deux fûts à la pente de l'italique.
function lettreU(q = 0.3) {
  const te = tangente(O_EXT, -q);
  const ti = tangente(O_INT, -q);
  // Extérieur : à gauche en descendant (dy > 0), à droite en montant (dy < 0).
  const eg = te.filter((r) => r.d[1] > 0 && r.p[0] < 489).sort((a, b) => a.p[1] - b.p[1])[0];
  const ed = te.filter((r) => r.d[1] < 0 && r.p[0] > 489).sort((a, b) => b.p[1] - a.p[1])[0];
  const ig = ti.filter((r) => r.d[1] < 0 && r.p[0] < 489)[0];
  const id = ti.filter((r) => r.d[1] > 0 && r.p[0] > 489)[0];
  const haut = (p) => [p[0] + q * (p[1] - YT), YT];
  const bas = morceau(O_EXT, eg, ed);
  const creux = morceau(O_INT, id, ig);
  const A0 = haut(eg.p), B0 = haut(ed.p), B1 = haut(id.p), A1 = haut(ig.p);
  return [[L(A0, eg.p), ...bas, L(ed.p, B0), L(B0, B1), L(B1, id.p), ...creux, L(ig.p, A1), L(A1, A0)]];
}
// T : une barre de l'épaisseur du pied du L, le fût du L.
function lettreT(w = 236, fut = 80, e = 53.84) {
  const yb = YT + e;
  const xg = (w - fut) / 2 - 12; // le fût, un peu à gauche du milieu : l'italique le ramène sous la barre
  return [poly([[xg - SL * (YB - yb), YB], [xg + fut - SR * (YB - yb), YB], [xg + fut, yb], [w - SL * e, yb], [w, YT], [0, YT], [-SL * e, yb], [xg, yb]])];
}
// E : le flanc et les fentes du B, trois bras coupés à la pente du L.
function lettreE(bras = [150, 128, 140], f = false) {
  const x = (y) => SB * (YB - y); // flanc gauche
  const fut = 81;
  const p = [];
  p.push([0, YB]);
  if (!f) {
    const xb = x(168.749) + fut + bras[2];
    p.push([xb - SL * (YB - 168.749), YB], [xb, 168.749]);
    p.push([x(168.749) + fut, 168.749]);
  } else p.push([x(139.198) + fut - SC * (YB - 139.198), YB]);
  p.push([x(139.198) + fut, 139.198]);
  const xm = x(101.829) + fut + bras[1];
  p.push([xm - SL * (139.198 - 101.829), 139.198], [xm, 101.829]);
  p.push([x(101.829) + fut, 101.829], [x(75.622) + fut, 75.622]);
  const xh = x(YT) + bras[0] + fut * 0.55;
  p.push([xh - SL * (75.622 - YT), 75.622], [xh, YT], [x(YT), YT]);
  // Sens : bas de gauche à droite, puis on remonte par la droite.
  return [poly(p)];
}
// M : dessiné droit puis penché à 0,3 (le fût du L) : deux jambes, une encoche
// en V en haut, deux fentes en bas qui détachent les diagonales des jambes.
function lettreM({ w = 284, jambe = 76, v = 44, prof = 116, fente = 28, hf = 66, s = 0.3 } = {}) {
  const cx = w / 2;
  const droit = [
    [0, H], [jambe, H], [jambe, hf], [jambe + fente, H],
    [w - jambe - fente, H], [w - jambe, hf], [w - jambe, H], [w, H],
    [w, 0], [cx + v / 2, 0], [cx, prof], [cx - v / 2, 0], [0, 0],
  ];
  return [poly(droit.map(([x, y]) => [x + s * (H - y), YT + y]))];
}

// ---- Les mots ----
// Extérieurs d'aire négative (comme le logo), contreformes positives.
const oriente = (contours) => contours.map((c, k) => (Math.sign(aire(c)) === (k === 0 ? -1 : 1) ? c : inverse(c)));
const place = (contours, x) => {
  const x0 = xmin(contours);
  return oriente(contours).map((c) => decale(c, x - x0));
};
// [lettre, approche] : l'écart avec la lettre précédente (négatif : elles se soudent).
function mot(lettres, x) {
  const out = [];
  let cur = x;
  for (const [l, approche] of lettres) {
    const p = place(l, cur + approche);
    out.push(...p);
    cur = xmax(p);
  }
  return { contours: out, fin: cur };
}
function suffixe(nom, x0) {
  if (nom === "team") return mot([[lettreT(), 0], [lettreE(), -58], [lettreA(), -30], [lettreM(), -42]], x0);
  if (nom === "club") return mot([[lettreC(), 0], [lettreL(84), -36], [lettreU(), -6], [lettreB(), -38]], x0);
  if (nom === "fc") return mot([[lettreE([150, 128, 0], true), 0], [lettreC(), -36]], x0);
}

// ---- Les fichiers ----
const LOGO = fs.readFileSync(new URL("../public/bola/logo-blanc.svg", import.meta.url), "utf8");
const sym = LOGO.match(/id="symbole" d="([^"]+)"/)[1];
const logotype = LOGO.match(/id="logotype" d="([^"]+)"/)[1];
const reg = LOGO.match(/id="marque-deposee" d="([^"]+)"/)[1];
const R0 = 928.307, FILL = "#F4F5F2", GAP = 70;
const D = (c) => c.map(chemin).join("");
const entete = (id, titre, w) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg id="${id}" xmlns="http://www.w3.org/2000/svg" version="1.1" role="img" aria-labelledby="titre" viewBox="0 0 ${w.toFixed(1)} 237">\n  <title id="titre">${titre}</title>\n`;
const marque = (fin) => `    <path id="marque-deposee" transform="translate(${(fin + 8 - R0).toFixed(2)} 0)" d="${reg}" fill="${FILL}" fill-rule="evenodd"/>\n`;
const out = {};
for (const [nom, titre] of [["team", "BOLA TEAM"], ["club", "BOLA CLUB"], ["fc", "BOLA FC"]]) {
  const s = suffixe(nom, 933.695 + GAP);
  const w = s.fin + 70;
  out[nom] = w;
  fs.writeFileSync(new URL(`../public/bola/bola-${nom}.svg`, import.meta.url), entete(`bola-${nom}`, titre, w) + `  <g>\n    <path id="symbole" d="${sym}" fill="${FILL}" fill-rule="evenodd"/>\n    <path id="logotype" d="${logotype}" fill="${FILL}" fill-rule="evenodd"/>\n    <path id="${nom}" d="${D(s.contours)}" fill="${FILL}"/>\n` + marque(s.fin) + `  </g>\n</svg>\n`);
}
// Plaque : TEAM en réserve dans une plaque penchée comme le flanc du B.
{
  const k = 0.56, sl = 0.4009, pad = 50, x0 = 933.695 + GAP - 16;
  const s = suffixe("team", 0);
  const x1 = xmin(s.contours), lw = s.fin - x1;
  const largeur = lw * k + pad * 2 + sl * (YB - YT);
  const fin = x0 + largeur;
  // centre de la plaque à mi-hauteur, centre du mot à mi-hauteur
  const cxPlaque = x0 + sl * (YB - YT) / 2 + largeur / 2 - sl * (YB - YT) / 2;
  const cxMot = (x1 + s.fin) / 2 - 0.3 * 0; // le mot est déjà penché : son milieu de boîte suffit
  const tx = cxPlaque - cxMot * k, ty = (YT + YB) / 2 - ((YT + YB) / 2) * k;
  const plaque = `M${x0.toFixed(2)},${YB}L${(x0 + sl * (YB - YT)).toFixed(2)},${YT}L${fin.toFixed(2)},${YT}L${(fin - sl * (YB - YT)).toFixed(2)},${YB}Z`;
  const w = fin + 70;
  out.plaque = w;
  fs.writeFileSync(new URL("../public/bola/bola-team-plaque.svg", import.meta.url), entete("bola-team-plaque", "BOLA TEAM", w) + `  <defs>\n    <mask id="reserve" maskUnits="userSpaceOnUse" x="0" y="0" width="${w.toFixed(1)}" height="237">\n      <rect width="${w.toFixed(1)}" height="237" fill="#fff"/>\n      <path transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${k})" d="${D(s.contours)}" fill="#000"/>\n    </mask>\n  </defs>\n  <g>\n    <path id="symbole" d="${sym}" fill="${FILL}" fill-rule="evenodd"/>\n    <path id="logotype" d="${logotype}" fill="${FILL}" fill-rule="evenodd"/>\n    <path id="plaque" d="${plaque}" fill="${FILL}" mask="url(#reserve)"/>\n` + marque(fin) + `  </g>\n</svg>\n`);
}
console.log(Object.entries(out).map(([n, w]) => `${n}: w=${w.toFixed(1)} l18=${(w * 0.074).toFixed(1)}`).join("\n"));
