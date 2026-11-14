// Les fonctions mathématiques de la simulation, écrites en opérations de base (+ − × ÷ et √, exactes au bit près dans
// tous les moteurs JavaScript) : sin, cos, atan2, exp, log, hypot, acos.
//
// Pourquoi : Math.sin, Math.log… ne sont pas tenus au même dernier bit d'un moteur à l'autre (mesuré le 14/11/2026 :
// Math.log(0,37) diffère d'un bit entre le V8 de node 22 et celui de Chromium), et une simulation à graine diverge dès
// le premier bit. Avec ces versions, le banc node, Chromium, Safari et un iPhone jouent exactement le même match.
// Ce sont les algorithmes de fdlibm (Sun, domaine public) : réduction d'argument, puis polynômes ; précision de l'ordre
// de 1 ulp, très au-delà de ce qu'il faut au jeu.

const f64 = new Float64Array(1), u32 = new Uint32Array(f64.buffer);
const HI = 1, LO = 0; // petit-boutiste (tous les moteurs ciblés)

/** 2^k exact (k entier, |k| < 1000). */
function pow2(k) {
  u32[LO] = 0; u32[HI] = ((k + 1023) & 0x7ff) << 20;
  return f64[0];
}

// ── sin, cos ──
const S1 = -1.66666666666666324348e-01, S2 = 8.33333333332248946124e-03, S3 = -1.98412698298579493134e-04,
  S4 = 2.75573137070700676789e-06, S5 = -2.50507602534068634195e-08, S6 = 1.58969099521155010221e-10;
const C1 = 4.16666666666666019037e-02, C2 = -1.38888888888741095749e-03, C3 = 2.48015872894767294178e-05,
  C4 = -2.75573143513906633035e-07, C5 = 2.08757232129817482790e-09, C6 = -1.13596475577881948265e-11;
const PIO2_1 = 1.57079632673412561417e+00, PIO2_1T = 6.07710050650619224932e-11, INV_PIO2 = 6.36619772367581382433e-01;

function ksin(x) { const z = x * x, v = z * x, r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6))); return x + v * (S1 + z * r); }
function kcos(x) { const z = x * x, r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6))))); return 1 - (0.5 * z - z * r); }
function reduire(x) {
  const n = Math.round(x * INV_PIO2);
  return { n: ((n % 4) + 4) % 4, y: (x - n * PIO2_1) - n * PIO2_1T };
}
export function sin(x) {
  if (!Number.isFinite(x)) return NaN;
  if (x > -0.7853981633974483 && x < 0.7853981633974483) return ksin(x);
  const { n, y } = reduire(x);
  return n === 0 ? ksin(y) : n === 1 ? kcos(y) : n === 2 ? -ksin(y) : -kcos(y);
}
export function cos(x) {
  if (!Number.isFinite(x)) return NaN;
  if (x > -0.7853981633974483 && x < 0.7853981633974483) return kcos(x);
  const { n, y } = reduire(x);
  return n === 0 ? kcos(y) : n === 1 ? -ksin(y) : n === 2 ? -kcos(y) : ksin(y);
}

// ── atan, atan2 ──
const ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
  9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
  4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
export function atan(x0) {
  if (x0 !== x0) return NaN;
  const neg = x0 < 0;
  let x = neg ? -x0 : x0, id = -1;
  if (x >= 7.37869762948382064640e+19) return neg ? -ATANHI[3] - ATANLO[3] : ATANHI[3] + ATANLO[3];
  if (x < 0.4375) { if (x < 1e-29) return x0; }
  else if (x < 1.1875) {
    if (x < 0.6875) { id = 0; x = (2 * x - 1) / (2 + x); } else { id = 1; x = (x - 1) / (x + 1); }
  } else if (x < 2.4375) { id = 2; x = (x - 1.5) / (1 + 1.5 * x); } else { id = 3; x = -1 / x; }
  const z = x * x, w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) { const r = x - x * (s1 + s2); return neg ? -r : r; }
  const r = ATANHI[id] - ((x * (s1 + s2) - ATANLO[id]) - x);
  return neg ? -r : r;
}
const PI = 3.1415926535897931160e+00, PI_LO = 1.2246467991473531772e-16;
export function atan2(y, x) {
  if (x !== x || y !== y) return NaN;
  if (x === 0) return y > 0 ? PI / 2 : y < 0 ? -PI / 2 : 0;
  if (y === 0) return x > 0 ? 0 : PI;
  const z = atan(Math.abs(y / x));
  if (x > 0) return y < 0 ? -z : z;
  const r = PI - (z - PI_LO);
  return y < 0 ? -r : r;
}
/** acos(x) = atan2(√(1 − x²), x) */
export function acos(x) { return atan2(Math.sqrt(Math.max(0, 1 - x * x)), x); }

// ── exp, log ──
const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10, INV_LN2 = 1.44269504088896338700e+00;
const P1 = 1.66666666666666019037e-01, P2 = -2.77777777770155933842e-03, P3 = 6.61375632143793436117e-05,
  P4 = -1.65339022054652515390e-06, P5 = 4.13813679705723846039e-08;
export function exp(x) {
  if (x !== x) return NaN;
  if (x > 709) return Infinity;
  if (x < -745) return 0;
  const k = Math.round(x * INV_LN2);
  const hi = x - k * LN2_HI, lo = k * LN2_LO, r = hi - lo, t = r * r;
  const c = r - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  const y = 1 - ((lo - (r * c) / (2 - c)) - hi);
  // 2^k en deux fois (k peut dépasser l'exposant d'un seul facteur aux extrêmes)
  const k1 = k >> 1;
  return y * pow2(k1) * pow2(k - k1);
}
const LG1 = 6.666666666666735130e-01, LG2 = 3.999999999940941908e-01, LG3 = 2.857142874366239149e-01, LG4 = 2.222219843214978396e-01,
  LG5 = 1.818357216161805012e-01, LG6 = 1.531383769920937332e-01, LG7 = 1.479819860511658591e-01;
export function log(x) {
  if (x !== x || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return Infinity;
  let k = 0;
  if (x < 2.2250738585072014e-308) { x *= 18014398509481984; k = -54; } // sous-normaux : ×2^54
  f64[0] = x;
  k += ((u32[HI] >>> 20) & 0x7ff) - 1023;
  // la mantisse dans [√2/2 ; √2)
  u32[HI] = (u32[HI] & 0x000fffff) | 0x3ff00000;
  let m = f64[0];
  if (m > 1.4142135623730951) { m *= 0.5; k++; }
  const f = m - 1, s = f / (2 + f), z = s * s, w = z * z;
  const t1 = w * (LG2 + w * (LG4 + w * LG6)), t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  const R = t2 + t1, hfsq = 0.5 * f * f;
  return k * LN2_HI - ((hfsq - (s * (hfsq + R) + k * LN2_LO)) - f);
}

/** √(x² + y² [+ z²]) : la racine carrée est exacte au bit près partout */
export function hypot(x, y, z = 0) { return Math.sqrt(x * x + y * y + z * z); }
