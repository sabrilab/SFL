// Le match que la Map propose d'ouvrir (Sabri, 24/10 : « Le bouton « Ouvrir
// un match » aussi doit être repensé, parce que c'est quand même la
// fonctionnalité principale […] il faudrait que chaque joueur puisse ouvrir
// un match, que ça lui propose et que ça l'incite à ouvrir un match »).
//
// Le moment : celui de la semaine où le plus de joueurs ont dit être libres
// (Mes dispos), et que rien n'occupe déjà (un match ouvert qui a encore de
// la place, un des miens, une journée de la ligue). Au moins deux autres que
// moi ; mes moments à moi passent devant, puis le plus de monde, puis le plus
// tôt. Le lieu : le terrain libre le plus proche (de moi, de ma ville, sinon
// de la ligue), ceux de la ligue un peu avantagés ; le soir, un terrain du
// recensement sans éclairage ne se propose pas (en octobre, il fait nuit à
// 19 h). La Map en fait le bouton « Ouvrir un match » et la dernière carte
// de son carrousel (app/map/page.tsx) : un toucher ouvre la feuille
// d'ouverture remplie, où ceux qui sont libres attendent qu'on les invite.

import { MOMENTS, type Dispo, type Moment } from "@/lib/sfl/matchs";
import { km, type TerrainPropose } from "@/lib/sfl/terrains";

/** Le coup d'envoi d'un moment : celui de Mes dispos. */
export const HEURE_DU_MOMENT: Record<Moment, string> = { matin: "10:00", "apres-midi": "15:00", soir: "19:00" };

/** Un moment ne se propose qu'avec au moins deux autres joueurs libres. */
const LIBRES_MIN = 2;
/** L'avance des terrains de la ligue, en km : à distance presque égale, on joue chez nous. */
const AVANCE_LIGUE = 1;

/** « 2026-10-31|apres-midi » : un moment de la semaine. */
export const cleMoment = (jour: string, moment: Moment) => `${jour}|${moment}`;

export interface MomentPropose {
  /** ISO, « 2026-10-31 ». */
  jour: string;
  moment: Moment;
  /** « 15:00 », l'heure de la feuille d'ouverture. */
  heure: string;
  /** Les autres joueurs libres à ce moment, par ordre alphabétique. */
  noms: string[];
  /** J'ai dit être libre aussi. */
  moi: boolean;
}

/**
 * Le moment à proposer, ou null. `heure` est l'heure qu'il est à Paris
 * (0–23) : aujourd'hui, un moment déjà commencé ne se propose plus.
 */
export function meilleurMoment(
  dispos: Dispo[],
  { moi, aujourdhui, heure, occupes }: { moi: string | null; aujourdhui: string; heure: number; occupes: ReadonlySet<string> }
): MomentPropose | null {
  if (!aujourdhui) return null;
  const parMoment = new Map<string, { jour: string; moment: Moment; noms: Map<string, string>; moi: boolean }>();
  for (const d of dispos) {
    if (d.jour < aujourdhui) continue;
    if (d.jour === aujourdhui && heure >= Number(HEURE_DU_MOMENT[d.moment].slice(0, 2))) continue;
    const cle = cleMoment(d.jour, d.moment);
    if (occupes.has(cle)) continue;
    const g = parMoment.get(cle) ?? { jour: d.jour, moment: d.moment, noms: new Map<string, string>(), moi: false };
    if (moi && d.playerId === moi) g.moi = true;
    else g.noms.set(d.playerId, d.name);
    parMoment.set(cle, g);
  }
  const ordre = (m: Moment) => MOMENTS.findIndex((x) => x.id === m);
  const assez = [...parMoment.values()].filter((g) => g.noms.size >= LIBRES_MIN);
  const miens = assez.filter((g) => g.moi);
  const g = (miens.length ? miens : assez).sort(
    (a, b) => b.noms.size - a.noms.size || a.jour.localeCompare(b.jour) || ordre(a.moment) - ordre(b.moment)
  )[0];
  if (!g) return null;
  return {
    jour: g.jour,
    moment: g.moment,
    heure: HEURE_DU_MOMENT[g.moment],
    noms: [...g.noms.values()].sort((a, b) => a.localeCompare(b, "fr")),
    moi: g.moi,
  };
}

/** Au-delà, un terrain n'est plus « près de toi » : on n'en propose aucun. */
const PROCHE_KM = 40;

/**
 * Le terrain à proposer près d'un point, pour un moment (ou n'importe quand) ;
 * null sans terrain à moins de PROCHE_KM. Le soir, un terrain éclairé ; mais
 * l'éclairage n'est pas toujours renseigné (OpenStreetMap, au Maghreb surtout) :
 * sans terrain éclairé autour, le plus proche.
 */
export function terrainPropose<T extends TerrainPropose>(terrains: T[], pres: { lat: number; lng: number }, moment: Moment | null): T | null {
  let mieux: T | null = null;
  let score = Infinity;
  let proche: T | null = null;
  let scoreProche = Infinity;
  for (const t of terrains) {
    const d = km(pres, t);
    if (d > PROCHE_KM) continue;
    const s = d - (t.ligue != null ? AVANCE_LIGUE : 0);
    if (s < scoreProche) [proche, scoreProche] = [t, s];
    // Le soir, il faut de la lumière : la ligue y joue déjà (son éclairage n'est pas toujours recensé).
    if (moment === "soir" && t.ligue == null && !t.eclaire) continue;
    if (s < score) [mieux, score] = [t, s];
  }
  return mieux ?? proche;
}
