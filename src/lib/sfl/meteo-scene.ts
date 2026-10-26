// Ce que la petite scène de la météo doit montrer (meteo-scene-3d.tsx), tiré
// de l'heure du coup d'envoi.
//
// Sabri, 26/10 : « un terrain en 3D sur le coin, par exemple sur le corner,
// et derrière, le ciel, ou une espèce de petite scène 3D qui montre vraiment
// la météo : ce qu'il fera sur le terrain, s'il pleut, s'il vente, s'il est
// ensoleillé ». Ici, les réglages seulement (pur, sans three) : la part de
// ciel couverte, la pluie, la neige, la brume, l'orage, le vent et d'où il
// vient, les teintes du ciel et de la lumière. Les mêmes teintes peignent le
// fond de la fenêtre avant que la 3D soit chargée (et sans WebGL).
//
// Teintes retenues, comme une photo de terrain un peu passée : ciel clair
// sans bleu vif, gris de pluie, nuit d'encre. Aucun or ni rouge (réservés aux
// cartes MVP, Défensive, Impact).

import { cielDeLHeure, RAFALES_FORTES, type Ciel, type HeureMeteo } from "@/lib/sfl/meteo";

export interface Ambiance {
  ciel: Ciel;
  nuit: boolean;
  /** Part du ciel couverte, 0 à 1 : le nombre et la teinte des nuages, la force du soleil. */
  couverture: number;
  /** Force de la pluie, 0 à 1 (0 : sèche). */
  pluie: number;
  neige: number;
  /** Brume, 0 à 1 : rapproche l'horizon. */
  brume: number;
  orage: boolean;
  /** Vent moyen et rafales, km/h. */
  vent: number;
  rafales: number;
  /** Vers où souffle le vent, en radians dans le plan du sol (0 = vers le nord, π/2 = vers l'est). */
  versOu: number;
  /** Le ciel au zénith, à l'horizon ; la pelouse ; la lumière du soleil (0 à 1). */
  zenith: string;
  horizon: string;
  pelouse: [string, string];
  lumiere: number;
  /** Un sol mouillé : la pelouse plus sombre et plus brillante. */
  mouille: boolean;
}

/** Le vent dominant du Nord quand la prévision ne dit pas d'où il vient : du sud-ouest. */
const DIRECTION_PAR_DEFAUT = 240;

const TEINTES: Record<"clair" | "voile" | "couvert" | "pluie" | "orage" | "brume" | "neige" | "nuit", [string, string]> = {
  clair: ["#6F95B7", "#D5DFE3"],
  voile: ["#8AA4B9", "#D9DFE0"],
  couvert: ["#9BA2A8", "#C9CCCB"],
  pluie: ["#6B747B", "#A6ACAE"],
  orage: ["#3C4247", "#7A8084"],
  brume: ["#B9BDBD", "#D6D7D4"],
  neige: ["#AEB5BA", "#E3E5E4"],
  nuit: ["#0B0E14", "#2A2F38"],
};

const PELOUSES = {
  sec: ["#5C7A43", "#678750"] as [string, string],
  mouille: ["#3F5A31", "#48663A"] as [string, string],
  nuit: ["#1D2A1A", "#22301F"] as [string, string],
  neige: ["#B9BEBB", "#C6CAC7"] as [string, string],
};

const borne = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n));

/** L'ambiance de la scène à une heure de la prévision. */
export function ambianceDe(x: HeureMeteo): Ambiance {
  const { ciel } = cielDeLHeure(x);
  const nuit = !x.jour;
  const code = x.code;
  const couverture =
    code <= 0 ? 0.05 : code === 1 ? 0.2 : code === 2 ? 0.5 : code === 3 ? 0.9 : code === 45 || code === 48 ? 1 : ciel === "vent" ? 0.45 : 0.95;
  const pluvieux = ciel === "bruine" || ciel === "pluie" || ciel === "averse" || ciel === "orage";
  const pluie = !pluvieux
    ? 0
    : ciel === "bruine"
      ? 0.22
      : borne(Math.max(ciel === "averse" || ciel === "orage" ? 0.6 : 0.4, x.mm / 4), 0.3, 1);
  const neige = ciel === "neige" ? borne(0.4 + x.mm / 3, 0.4, 1) : 0;
  const brume = ciel === "brume" ? 0.85 : pluie > 0 ? 0.25 + pluie * 0.3 : neige > 0 ? 0.4 : 0;
  const orage = ciel === "orage";
  const famille: keyof typeof TEINTES = nuit
    ? "nuit"
    : orage
      ? "orage"
      : ciel === "brume"
        ? "brume"
        : neige > 0
          ? "neige"
          : pluie > 0
            ? "pluie"
            : couverture >= 0.8
              ? "couvert"
              : couverture >= 0.4
                ? "voile"
                : "clair";
  const [zenith, horizon] = TEINTES[famille];
  const mouille = neige === 0 && (pluie > 0 || x.mm > 0.2);
  const direction = typeof x.direction === "number" ? x.direction : DIRECTION_PAR_DEFAUT;
  return {
    ciel,
    nuit,
    couverture,
    pluie,
    neige,
    brume,
    orage,
    vent: x.vent,
    rafales: x.rafales,
    versOu: (((direction + 180) % 360) * Math.PI) / 180,
    zenith,
    horizon,
    pelouse: nuit ? PELOUSES.nuit : neige > 0 ? PELOUSES.neige : mouille ? PELOUSES.mouille : PELOUSES.sec,
    lumiere: nuit ? 0.15 : borne(1 - couverture * 0.75 - pluie * 0.2, 0.2, 1),
    mouille,
  };
}

/** De 0 (calme) à 1 (tempête) : ce qui fait battre le drapeau de corner et passer les traînées de vent. */
export function forceDuVent(a: Pick<Ambiance, "vent" | "rafales">): number {
  return borne(Math.max(a.vent / 50, a.rafales / (RAFALES_FORTES * 1.4)));
}
