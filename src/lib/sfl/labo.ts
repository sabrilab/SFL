// Le Labo — les mesures que le téléphone sait faire seul.
//
// Deux tests pour commencer, ceux que la note « Le Labo » (public/note-labo.html)
// conseillait : zéro matériel, moins d'une minute, effet immédiat.
//
//   · Réflexes : un signal, un toucher. Cinq essais, la médiane est retenue ;
//     toucher avant le signal annule l'essai. Nourrit VIT.
//   · Détente (CMJ, saut avec contre-mouvement) : téléphone tenu contre la
//     poitrine, trois sauts. Pendant le vol, l'accéléromètre ne sent plus la
//     pesanteur (chute libre) : la durée de ce creux est le temps de vol t, et
//     la hauteur vaut g·t²/8. Le meilleur des trois est retenu. Nourrit PHY.
//
// Chaque résultat se lit en percentile, pas en valeur brute : « 38 cm » ne dit
// rien, « 74e percentile » dit tout. Les repères sont ceux, publiés, du temps
// de réaction simple et du CMJ chez l'adulte amateur ; à remplacer par nos
// propres normes quand il y aura assez de passages.
//
// Les résultats restent sur l'appareil (localStorage) : ils ne touchent pas
// encore la carte de ligue, qui se calcule sur les matchs.

export type LaboTest = "reaction" | "detente";

export type LaboResultat = {
  /** Médiane en ms (réflexes) ou meilleure hauteur en cm (détente). */
  valeur: number;
  percentile: number;
  /** Date ISO du passage. */
  date: string;
};

export type LaboFiche = Partial<Record<LaboTest, { dernier: LaboResultat; record: LaboResultat }>>;

export const LABO_STAT: Record<LaboTest, "VIT" | "PHY"> = { reaction: "VIT", detente: "PHY" };

/** Repères du temps de réaction simple au toucher (adulte : ~250 ms). */
export function percentileReaction(ms: number): number {
  if (ms < 200) return 92;
  if (ms < 240) return 74;
  if (ms < 290) return 51;
  if (ms < 350) return 28;
  return 12;
}

/** Repères du CMJ, adulte amateur. */
export function percentileDetente(cm: number): number {
  if (cm >= 50) return 95;
  if (cm >= 44) return 88;
  if (cm >= 38) return 74;
  if (cm >= 32) return 51;
  if (cm >= 26) return 28;
  return 12;
}

export function mediane(valeurs: number[]): number {
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

const G = 9.81;

/** Hauteur du saut (cm) à partir du temps de vol (s). */
export function hauteurDepuisVol(t: number): number {
  return Math.round(((G * t * t) / 8) * 100);
}

/** Un vol plausible : de 5 cm à un peu plus d'un mètre. */
export const VOL_MIN = 0.2;
export const VOL_MAX = 0.95;

/** Sous ce seuil (m/s²), le téléphone est en chute libre : le joueur vole. */
const SEUIL_VOL = 3.5;
/** Au-dessus, c'est la réception (ou l'impulsion). */
const SEUIL_IMPACT = 14;

/**
 * Détecteur de sauts, nourri échantillon par échantillon (devicemotion).
 * Un saut n'est compté que s'il commence après une impulsion, dure un temps
 * de vol plausible et se termine par une réception : secouer le téléphone ne
 * produit pas cette signature.
 */
export class DetecteurSaut {
  private envolA: number | null = null;
  private impulsionA = -Infinity;
  private dernierImpact = -Infinity;

  /** `a` : norme de l'accélération pesanteur comprise (m/s²) ; `t` : secondes. Renvoie un temps de vol quand un saut se termine. */
  echantillon(a: number, t: number): number | null {
    if (this.envolA === null) {
      if (a > SEUIL_IMPACT) this.impulsionA = t;
      // L'envol suit l'impulsion de près, et pas une réception récente.
      if (a < SEUIL_VOL && t - this.impulsionA < 0.6 && t - this.dernierImpact > 0.4) this.envolA = t;
      return null;
    }
    const duree = t - this.envolA;
    if (a < SEUIL_VOL) {
      if (duree > VOL_MAX) this.envolA = null; // téléphone lâché ou lancé
      return null;
    }
    if (a > SEUIL_IMPACT) {
      this.envolA = null;
      this.dernierImpact = t;
      this.impulsionA = -Infinity;
      return duree >= VOL_MIN ? duree : null;
    }
    // Entre les deux seuils : on attend la réception, sans rallonger le vol
    // au-delà du plausible.
    if (duree > VOL_MAX) this.envolA = null;
    return null;
  }
}

const CLE = (nom: string) => `sfl-labo-${nom}`;

export function lireFiche(nom: string): LaboFiche {
  try {
    const brut = window.localStorage.getItem(CLE(nom));
    return brut ? (JSON.parse(brut) as LaboFiche) : {};
  } catch {
    return {};
  }
}

/** Enregistre un passage ; le record suit le meilleur percentile. */
export function enregistrer(nom: string, test: LaboTest, r: LaboResultat): LaboFiche {
  const fiche = lireFiche(nom);
  const avant = fiche[test]?.record;
  const meilleur =
    !avant ||
    (test === "reaction" ? r.valeur < avant.valeur : r.valeur > avant.valeur);
  fiche[test] = { dernier: r, record: meilleur ? r : avant };
  try {
    window.localStorage.setItem(CLE(nom), JSON.stringify(fiche));
  } catch {
    // Stockage plein ou bloqué : le résultat reste affiché, il ne sera pas gardé.
  }
  return fiche;
}
