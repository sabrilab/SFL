// Les outils partagés des skins de nation : rien qui lise finitions-carte.ts.

/** Le repère de la carte. */
export const W = 1024;
export const H = 1656;
/** Le portrait (carré, coins concentriques) et le début de la bande du bas. */
export const PORTRAIT = { x: 41, y: 41, c: 942 } as const;
export const BANDE = 1024;
/** Le centre de la rosace et de la lune, au dos. */
export const CENTRE_DOS = { cx: 512, cy: 738 } as const;
/** Le logotype BOLA, au dos (dos-carte.tsx, LOGOTYPE). */
export const LOGOTYPE_DOS = { cy: 1222, h: 104 } as const;

/** Arrondi au dixième : des chemins SVG courts. */
export const f = (n: number) => Math.round(n * 10) / 10;

/** Un générateur pseudo-aléatoire stable (xorshift), comme motif-carte.tsx. */
export function alea(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

/** Un gris d'encre de même luminance qu'une couleur (comme « Tes couleurs » : la couleur reste au dos). */
export function enEncre(hex: string): string {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  const g = Math.round(255 * (y <= 0.0031308 ? 12.92 * y : 1.055 * y ** (1 / 2.4) - 0.055));
  return `#${g.toString(16).padStart(2, "0").repeat(3)}`;
}
