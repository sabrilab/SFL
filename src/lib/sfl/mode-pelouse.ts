// Le jour et la nuit de la famille Pelouse (styles 24 à 26, Sabri, 12/11/2026 :
// « une version claire et une version sombre qui s'active le matin ou la nuit
// quand on regarde l'application »). Le jour va de 7 h à 20 h, heure du
// téléphone ; ?mode=jour ou ?mode=nuit force l'un ou l'autre (captures, essais).

export const PELOUSE = [16, 24, 25, 26] as const;
/** Le 16 en fait partie depuis le 14/11 (Sabri y regardait encore les bandes) : son jour est Craie (24). */
export const estPelouse = (style: number) => style === 16 || (style >= 24 && style <= 26);
/** Le style posé le jour : Craie pour le 16, sinon le style lui-même. */
export const styleDuJour = (style: number) => (style === 16 ? 24 : style);

/** Vrai le jour (7 h – 20 h), sauf si l'adresse force le mode. */
export function estJour(maintenant = new Date()): boolean {
  try {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "jour") return true;
    if (m === "nuit") return false;
  } catch {}
  const h = maintenant.getHours();
  return h >= 7 && h < 20;
}
