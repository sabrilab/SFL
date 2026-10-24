// La météo d'un match, à son heure et sur son terrain.
//
// Sabri, 24/10 : sur le groupe Snap, la veille d'un dimanche venteux, deux
// joueurs ont envoyé une carte météo pour se rassurer. « Mettre un aperçu de
// la météo pour voir, à telle heure, ce que ça prévoit », branché sur une
// source « en temps réel et actualisée ».
//
// La source : Open-Meteo (open-meteo.com), gratuite, sans clé ni compte,
// données sous licence CC BY 4.0 (on cite la source sous l'aperçu). On lui
// demande deux modèles à la fois : Météo-France (AROME puis ARPEGE, le plus
// fin sur le Nord, jusqu'à 4 jours) et, au-delà, le meilleur modèle
// qu'Open-Meteo choisit (jusqu'à 16 jours). Météo-France ne donne pas de
// probabilité de pluie : celle-là vient toujours du second.
//
// L'appel part du téléphone du joueur, pas du serveur : l'offre gratuite
// compte les appels par adresse IP, et les adresses partagées d'un
// hébergeur s'épuisent (constaté le 24/10 depuis le cloud). Chaque prévision
// est gardée 30 minutes sur le téléphone (mémoire, puis localStorage), et
// relue quand l'app revient au premier plan après ce délai.
//
// Ce fichier est pur à part `lireMeteo` (le réseau et le stockage).

/** Ce qu'on dessine : un pictogramme gravé par famille de temps (meteo-match.tsx). */
export type Ciel = "soleil" | "lune" | "eclaircie" | "nuage" | "brume" | "bruine" | "pluie" | "averse" | "neige" | "orage" | "vent";

export interface HeureMeteo {
  /** L'heure locale du terrain, 0 à 23. */
  h: number;
  temperature: number;
  ressenti: number | null;
  /** Probabilité de pluie, en %, null quand aucun modèle ne la donne. */
  pluie: number | null;
  /** Hauteur de pluie de l'heure, en mm. */
  mm: number;
  vent: number;
  rafales: number;
  code: number;
  jour: boolean;
}

export interface Prevision {
  /** La date du match, AAAA-MM-JJ. */
  date: string;
  heures: HeureMeteo[];
  /** Vrai quand les heures du match viennent de Météo-France. */
  meteoFrance: boolean;
  /** Le moment où le téléphone a lu la prévision (ms). */
  lueA: number;
}

/** Au-delà, Open-Meteo ne prévoit plus rien. */
export const HORIZON_JOURS = 15;
/** Une prévision se relit après ce délai. */
export const FRAICHEUR_MS = 30 * 60_000;
/** Dès ces rafales (km/h), le vent passe devant le ciel. */
export const RAFALES_FORTES = 55;

/** Le libellé et le pictogramme d'un code WMO, celui que rendent tous les modèles. */
export function cielDuCode(code: number, jour: boolean): { ciel: Ciel; libelle: string } {
  if (code === 0) return jour ? { ciel: "soleil", libelle: "Grand soleil" } : { ciel: "lune", libelle: "Nuit claire" };
  if (code === 1) return jour ? { ciel: "soleil", libelle: "Plutôt dégagé" } : { ciel: "lune", libelle: "Plutôt dégagé" };
  if (code === 2) return { ciel: "eclaircie", libelle: "Éclaircies" };
  if (code === 3) return { ciel: "nuage", libelle: "Couvert" };
  if (code === 45 || code === 48) return { ciel: "brume", libelle: "Brouillard" };
  if (code >= 51 && code <= 55) return { ciel: "bruine", libelle: "Bruine" };
  if (code === 56 || code === 57) return { ciel: "bruine", libelle: "Bruine verglaçante" };
  if (code === 61) return { ciel: "pluie", libelle: "Pluie faible" };
  if (code === 63) return { ciel: "pluie", libelle: "Pluie" };
  if (code === 65) return { ciel: "pluie", libelle: "Forte pluie" };
  if (code === 66 || code === 67) return { ciel: "pluie", libelle: "Pluie verglaçante" };
  if (code >= 71 && code <= 77) return { ciel: "neige", libelle: "Neige" };
  if (code === 80 || code === 81) return { ciel: "averse", libelle: "Averses" };
  if (code === 82) return { ciel: "averse", libelle: "Fortes averses" };
  if (code === 85 || code === 86) return { ciel: "neige", libelle: "Averses de neige" };
  if (code === 95) return { ciel: "orage", libelle: "Orage" };
  if (code === 96 || code === 99) return { ciel: "orage", libelle: "Orage et grêle" };
  return { ciel: "nuage", libelle: "Couvert" };
}

/** Ce qu'on dit d'une heure : le vent fort l'emporte sur un ciel sec. */
export function cielDeLHeure(x: HeureMeteo): { ciel: Ciel; libelle: string } {
  const c = cielDuCode(x.code, x.jour);
  const sec = c.ciel === "soleil" || c.ciel === "lune" || c.ciel === "eclaircie" || c.ciel === "nuage";
  if (x.rafales >= RAFALES_FORTES && sec) return { ciel: "vent", libelle: "Grand vent" };
  return c;
}

/** Les heures montrées autour d'un coup d'envoi : l'heure d'avant, puis le match et la suite. */
export function heuresAutour(prevision: Prevision, coupDEnvoi: number): HeureMeteo[] {
  const debut = Math.max(0, Math.min(20, coupDEnvoi - 1));
  return prevision.heures.filter((x) => x.h >= debut && x.h < debut + 4);
}

/** L'heure du coup d'envoi, ou null quand la prévision ne la couvre pas. */
export function heureDuMatch(prevision: Prevision, coupDEnvoi: number): HeureMeteo | null {
  return prevision.heures.find((x) => x.h === coupDEnvoi) ?? null;
}

const MOIS = ["jan", "fev", "mar", "avr", "mai", "juin", "juil", "aou", "sep", "oct", "nov", "dec"];

/** « Dimanche 25 octobre », « 25 oct. » → « 2026-10-25 » (l'année est celle d'aujourd'hui, ou la suivante en décembre). */
export function dateIsoDuLibelle(libelle: string, aujourdhui: string): string | null {
  const m = libelle
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .match(/(\d{1,2})\s*([a-z]+)/);
  if (!m || !/^\d{4}-\d{2}-\d{2}$/.test(aujourdhui)) return null;
  const mois = MOIS.findIndex((p) => m[2].startsWith(p.length === 4 ? p : p.slice(0, 3)));
  if (mois < 0) return null;
  const [an, moisAuj] = aujourdhui.split("-").map(Number);
  const annee = moisAuj === 12 && mois === 0 ? an + 1 : an;
  return `${annee}-${String(mois + 1).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
}

/** Les jours d'aujourd'hui à cette date (négatif : passée). */
export function joursJusquA(date: string, aujourdhui: string): number {
  const [a, b] = [date, aujourdhui].map((d) => {
    const [y, mo, j] = d.split("-").map(Number);
    return Date.UTC(y, mo - 1, j);
  });
  return Math.round((a - b) / 86_400_000);
}

/** Une date que la prévision couvre. */
export function datePrevisible(date: string | null, aujourdhui: string): date is string {
  if (!date || !aujourdhui) return false;
  const e = joursJusquA(date, aujourdhui);
  return e >= 0 && e <= HORIZON_JOURS;
}

/** L'adresse de l'appel : le jour du match seulement, à l'heure du terrain. */
export function adresseOpenMeteo(lat: number, lng: number, date: string): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lng.toFixed(3),
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day",
    models: "meteofrance_seamless,best_match",
    timezone: "Europe/Paris",
    start_date: date,
    end_date: date,
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

type Serie = (number | null)[];

/** La réponse d'Open-Meteo en heures : Météo-France d'abord, l'autre modèle à défaut. */
export function lirePrevision(json: unknown, date: string, lueA: number): Prevision | null {
  const hourly = (json as { hourly?: Record<string, unknown> } | null)?.hourly;
  if (!hourly || !Array.isArray(hourly.time)) return null;
  const serie = (nom: string, modele: string): Serie => {
    const v = hourly[`${nom}_${modele}`] ?? (modele === "best_match" ? hourly[nom] : undefined);
    return Array.isArray(v) ? (v as Serie) : [];
  };
  const champ = (nom: string, i: number): { v: number | null; mf: boolean } => {
    const mf = serie(nom, "meteofrance_seamless")[i];
    if (typeof mf === "number") return { v: mf, mf: true };
    const bm = serie(nom, "best_match")[i];
    return { v: typeof bm === "number" ? bm : null, mf: false };
  };
  const heures: HeureMeteo[] = [];
  let meteoFrance = false;
  (hourly.time as string[]).forEach((t, i) => {
    if (!t.startsWith(date)) return;
    const h = Number(t.slice(11, 13));
    // Le jour du passage à l'heure d'hiver, 2 h revient deux fois : on garde la première.
    if (heures.some((x) => x.h === h)) return;
    const temperature = champ("temperature_2m", i);
    const code = champ("weather_code", i);
    if (temperature.v == null || code.v == null) return;
    const pluie = serie("precipitation_probability", "best_match")[i];
    if (temperature.mf) meteoFrance = true;
    heures.push({
      h,
      temperature: temperature.v,
      ressenti: champ("apparent_temperature", i).v,
      pluie: typeof pluie === "number" ? pluie : null,
      mm: champ("precipitation", i).v ?? 0,
      vent: champ("wind_speed_10m", i).v ?? 0,
      rafales: champ("wind_gusts_10m", i).v ?? 0,
      code: code.v,
      jour: (champ("is_day", i).v ?? 1) === 1,
    });
  });
  return heures.length ? { date, heures, meteoFrance, lueA } : null;
}

/* ─── Le réseau et le stockage ─────────────────────────────────────────── */

const memoire = new Map<string, Prevision>();
const enCours = new Map<string, Promise<Prevision | null>>();
const CLE = "bola-meteo-v1";

function cleDe(lat: number, lng: number, date: string): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)},${date}`;
}

function stockees(): Record<string, Prevision> {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? "{}") as Record<string, Prevision>;
  } catch {
    return {};
  }
}

function stocker(cle: string, p: Prevision) {
  try {
    const toutes = stockees();
    toutes[cle] = p;
    // On ne garde que les prévisions encore utiles : une douzaine au plus.
    const gardees = Object.entries(toutes)
      .sort((a, b) => b[1].lueA - a[1].lueA)
      .slice(0, 12);
    localStorage.setItem(CLE, JSON.stringify(Object.fromEntries(gardees)));
  } catch {
    /* stockage plein ou interdit : la mémoire suffit */
  }
}

/** La dernière prévision gardée pour ce terrain et ce jour, même ancienne (pour l'afficher tout de suite). */
export function meteoGardee(lat: number, lng: number, date: string): Prevision | null {
  const cle = cleDe(lat, lng, date);
  const p = memoire.get(cle) ?? (typeof window !== "undefined" ? stockees()[cle] : undefined);
  if (p) memoire.set(cle, p);
  return p ?? null;
}

/** La prévision du jour du match sur ce terrain : gardée si elle a moins de 30 minutes, sinon relue. */
export async function lireMeteo(lat: number, lng: number, date: string): Promise<Prevision | null> {
  const cle = cleDe(lat, lng, date);
  const gardee = meteoGardee(lat, lng, date);
  if (gardee && Date.now() - gardee.lueA < FRAICHEUR_MS) return gardee;
  const deja = enCours.get(cle);
  if (deja) return deja;
  const appel = fetch(adresseOpenMeteo(lat, lng, date))
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const p = lirePrevision(json, date, Date.now());
      if (p) {
        memoire.set(cle, p);
        stocker(cle, p);
      }
      return p ?? gardee;
    })
    .catch(() => gardee)
    .finally(() => enCours.delete(cle));
  enCours.set(cle, appel);
  return appel;
}
