// Bola Club : les versions de couleurs (demande de Bola, 28/11/2026 : « c'est
// trop noir et blanc […] propose plusieurs versions »). Trois versions à
// comparer, posées sur <html data-couleurs> tant qu'on est dans /club
// (club/couleurs-club.tsx), lues par app/club/couleurs.css :
//   · pelouse : l'app reste sombre, un seul vert de pelouse pour ce qui agit
//     et compte, l'orange des plots pour l'échauffement ;
//   · club : les couleurs de l'écusson du club font tout (le terrain dans son
//     vert, la craie dans sa crème) : chaque club a sa version à lui ;
//   · vif : une couleur par thème d'exercice, des chasubles franches, un
//     terrain d'herbe vive.
// Le choix est gardé sur le téléphone ; ?couleurs= le pose (captures). Pur.

export const VERSIONS = [
  { id: "pelouse", label: "Pelouse" },
  { id: "club", label: "Couleurs du club" },
  { id: "vif", label: "Vif" },
] as const;
export type VersionCouleurs = (typeof VERSIONS)[number]["id"];
export const VERSION_DEFAUT: VersionCouleurs = "vif";
export const CLE_COULEURS = "bola-club-couleurs";

export const estVersion = (v: unknown): v is VersionCouleurs => VERSIONS.some((x) => x.id === v);

const hex = (c: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  const n = m ? parseInt(m[1], 16) : 0x808080;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const enHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;
/** Mélange vers le blanc (t > 0) ou le noir (t < 0). */
export function nuance(c: string, t: number): string {
  const [r, g, b] = hex(c);
  const cible = t > 0 ? 255 : 0;
  const a = Math.abs(t);
  return enHex(r + (cible - r) * a, g + (cible - g) * a, b + (cible - b) * a);
}
/** La clarté perçue, de 0 à 1. */
export const clarte = (c: string) => {
  const [r, g, b] = hex(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/**
 * La version « club », tirée de l'écusson : le terrain dans la couleur la plus
 * sombre, la craie et l'équipe dans la plus claire, l'adversaire dans la
 * troisième ; l'accent, la couleur sombre éclaircie jusqu'à se lire sur le noir.
 */
export function variablesDuClub(couleurs: readonly string[]): Record<string, string> {
  const triees = [...couleurs].sort((a, b) => clarte(a) - clarte(b));
  const sombre = triees[0] ?? "#0e4d32";
  const claire = triees[triees.length - 1] ?? "#f4f3ef";
  const autre = triees[1] ?? nuance(sombre, 0.5);
  let accent = sombre;
  for (let t = 0.1; clarte(accent) < 0.42 && t <= 0.9; t += 0.1) accent = nuance(sombre, t);
  return {
    "--club-accent": accent,
    "--club-accent-encre": clarte(accent) > 0.6 ? "#111111" : claire,
    "--club-accent-ton": hex(accent).join(" "),
    "--terrain-pelouse": clarte(sombre) < 0.25 ? sombre : nuance(sombre, -0.55),
    "--terrain-bande": nuance(clarte(sombre) < 0.25 ? sombre : nuance(sombre, -0.55), -0.12),
    "--terrain-craie": claire,
    "--terrain-a": claire,
    "--terrain-b": autre === claire ? nuance(sombre, 0.6) : autre,
    "--terrain-plot": "#e9b44c",
  };
}
