// L'heure de la ligue, celle du serveur (02/11/2026).
//
// La fin du vote (18 h) et la révélation (19 h) se calculent sur chaque
// téléphone (revelation.ts) : un téléphone en avance de deux heures
// révélait à 17 h, avec les votes de 17 h, et sa cérémonie « Tu montes en
// D2 » restait fausse ; un téléphone en retard proposait encore le vote à
// 18 h 10 (la base, elle, refusait). Désormais, l'app lit l'heure du serveur
// (/api/version, qu'elle appelle déjà pour ses mises à jour) et corrige la
// sienne d'autant : `maintenant()` est l'heure de Paris pour tout le monde.
//
// Le décalage se mesure au lancement et au retour dans l'app (SeasonProvider),
// et se garde sur l'appareil : au lancement suivant, il vaut dès la première
// image. Un écart de moins de 2 s est ignoré (le réseau en fait autant) ;
// une mesure trop lente (plus de 4 s aller-retour) aussi.
//
// Pur hors navigateur : sans fenêtre, aucun décalage (le serveur est à l'heure).

const CLE = "sfl-horloge-decalage";
const IGNORE_MS = 2_000;
const ALLER_RETOUR_MAX_MS = 4_000;
export const HORLOGE_EVENT = "sfl-horloge";

function lire(): number {
  try {
    const n = Number(globalThis.localStorage?.getItem(CLE) ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

let decalage = lire();

/** L'écart de ce téléphone : l'heure du serveur moins la sienne, en ms. */
export function decalageHorloge(): number {
  return decalage;
}

/** L'instant, à l'heure du serveur. */
export function maintenantMs(): number {
  return Date.now() + decalage;
}

export function maintenant(): Date {
  return new Date(maintenantMs());
}

/**
 * Retient une mesure : `serveur`, l'heure que le serveur a donnée ; `depart`
 * et `retour`, celles du téléphone autour de l'appel. Renvoie le décalage
 * retenu. Prévient les écrans (HORLOGE_EVENT) quand il change d'une seconde
 * ou plus.
 */
export function noterHeureServeur(serveur: number, depart: number, retour: number): number {
  if (!Number.isFinite(serveur) || retour < depart || retour - depart > ALLER_RETOUR_MAX_MS) return decalage;
  const ecart = serveur - (depart + retour) / 2;
  const neuf = Math.abs(ecart) < IGNORE_MS ? 0 : Math.round(ecart);
  if (Math.abs(neuf - decalage) < 1_000) return decalage;
  decalage = neuf;
  try {
    globalThis.localStorage?.setItem(CLE, String(neuf));
  } catch {
    /* stockage interdit : la mesure vaut pour cette visite */
  }
  try {
    globalThis.dispatchEvent?.(new Event(HORLOGE_EVENT));
  } catch {
    /* hors navigateur */
  }
  return decalage;
}

let derniere = 0;

/** Mesure l'heure du serveur (au plus une fois par minute) ; silencieuse hors ligne. */
export async function mesurerHorloge(): Promise<void> {
  if (typeof fetch !== "function" || Date.now() - derniere < 60_000) return;
  derniere = Date.now();
  try {
    const depart = Date.now();
    const r = await fetch(`/api/version?t=${depart}`, { cache: "no-store" });
    const retour = Date.now();
    if (!r.ok) return;
    const { maintenant: serveur } = (await r.json()) as { maintenant?: number };
    if (typeof serveur === "number") noterHeureServeur(serveur, depart, retour);
  } catch {
    /* hors ligne : l'heure du téléphone, corrigée de la dernière mesure */
  }
}
