// La journée en brouillon, et « Publier pour tout le monde ».
//
// Sabri, 29/10/2026 : « Quand je crée une nouvelle journée, j'aimerais avoir
// la possibilité de la cacher aux utilisateurs, le temps de l'actualiser, de
// faire des changements de dernière minute. J'aimerais pouvoir appuyer sur
// un bouton, genre "Publier pour tout le monde". »
//
// Un seul état est stocké : `JourneeMeta.brouillon`. Une journée sans ce
// champ est publiée — toutes celles d'avant le sont, sans migration. Les
// états « en direct » et « terminée » se déduisent (etat-journee.ts).
//
// La règle de lecture : tout ce qui n'est pas l'espace admin lit la saison
// passée par `sansBrouillons` (SeasonProvider, le serveur), et la base donne
// aux joueurs la même chose (public.saison_publique, public.sans_brouillons).
// On ÉCRIT toujours depuis le document entier (saisieStore.load()), jamais
// depuis une saison filtrée : la règle I8 (integrite.ts) refuse une écriture
// qui ferait disparaître un brouillon sans « Jeter ».
//
// Pur : ni base, ni écran.

import { computeJournees, journeeJouee } from "./engine";
import type { Journee } from "../engine";
import type { JourneeMeta, Saison } from "./types";

/** Absent, null ou false : publiée. Tout le reste : brouillon (comme public.est_brouillon). */
export const estBrouillon = (m: Pick<JourneeMeta, "brouillon"> | undefined): boolean =>
  !!m && m.brouillon != null && (m.brouillon as unknown) !== false;

/** Les numéros des journées en brouillon. */
export function brouillons(s: Pick<Saison, "journees">): Set<number> {
  return new Set(s.journees.filter(estBrouillon).map((m) => m.j));
}

/**
 * La saison telle que la ligue la voit : sans les journées en brouillon, ni
 * leurs lignes, ni leurs buts minutés. Archives, effectif, terrains et
 * convocations : intacts. Même référence s'il n'y a aucun brouillon.
 */
export function sansBrouillons(s: Saison): Saison {
  const caches = brouillons(s);
  if (!caches.size) return s;
  return {
    ...s,
    journees: s.journees.filter((m) => !caches.has(m.j)),
    entries: s.entries.filter((e) => !caches.has(e.j)),
    ...(s.events ? { events: s.events.filter((e) => !caches.has(e.j)) } : {}),
  };
}

/** Reste-t-il une journée en brouillon ? (la clôture de la saison attend qu'il n'y en ait plus) */
export function resteUnBrouillon(s: Pick<Saison, "journees">): boolean {
  return s.journees.some(estBrouillon);
}

/** La journée telle que la ligue la verra une fois publiée (pour l'aperçu). */
export function apercuPublication(s: Saison, j: number): Journee | undefined {
  const meta = s.journees.find((m) => m.j === j);
  if (!meta) return undefined;
  const publiee: Saison = {
    ...s,
    journees: s.journees.map((m) => (m.j === j ? sansDrapeau(m) : m)),
  };
  return computeJournees(sansBrouillons(publiee)).find((x) => x.j === j);
}

function sansDrapeau(m: JourneeMeta): JourneeMeta {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { brouillon, ...reste } = m;
  return reste;
}

/**
 * Publie la journée : retire `brouillon`, pose `publiee`. Les arbitres
 * désignés pendant le brouillon restent sur leurs matchs (`MatchDuJour.arbitre`) :
 * l'écran les écrit dans `arbitrages` une fois la base d'accord. Les défauts
 * qui empêchent de publier sont vérifiés par l'appelant (integrite.ts,
 * BLOQUE_LA_PUBLICATION) — ici, une journée absente ou déjà publiée ne change rien.
 */
export function publierJournee(s: Saison, j: number, par: string, le: Date): Saison {
  const meta = s.journees.find((m) => m.j === j);
  if (!meta || !estBrouillon(meta)) return s;
  return {
    ...s,
    journees: s.journees.map((m) => (m.j === j ? { ...sansDrapeau(m), publiee: { le: le.toISOString(), par } } : m)),
  };
}

/** L'heure du coup d'envoi d'une journée (« 12h30 » → 12:30 heure de Paris le jour de sa date), si on la connaît. */
export function coupDEnvoi(meta: Pick<JourneeMeta, "date" | "heure">, maintenant: Date): Date | null {
  const jour = dateDeJournee(meta.date, maintenant);
  if (!jour) return null;
  const h = /^(\d{1,2})\s*h\s*(\d{0,2})/i.exec(meta.heure ?? "");
  const heures = h ? Number(h[1]) : 23;
  const minutes = h && h[2] ? Number(h[2]) : h ? 0 : 59;
  // Paris : UTC+1 en hiver, +2 en été ; l'écart exact se lit dans Intl.
  const midi = new Date(Date.UTC(jour.y, jour.m, jour.d, 12));
  const paris = new Date(midi.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  const utc = new Date(midi.toLocaleString("en-US", { timeZone: "UTC" }));
  const decalage = paris.getTime() - utc.getTime();
  return new Date(Date.UTC(jour.y, jour.m, jour.d, heures, minutes) - decalage);
}

const MOIS: Record<string, number> = {
  janv: 0, janvier: 0, fevr: 1, fevrier: 1, mars: 2, avr: 3, avril: 3, mai: 4, juin: 5,
  juil: 6, juillet: 6, aout: 7, sept: 8, septembre: 8, oct: 9, octobre: 9, nov: 10, novembre: 10, dec: 11, decembre: 11,
};

/** « 2 nov. » → le jour, l'année la plus proche de `maintenant`. */
export function dateDeJournee(date: string, maintenant: Date): { y: number; m: number; d: number } | null {
  const lu = /(\d{1,2})\s+([\p{L}.]+)/u.exec(date.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
  if (!lu) return null;
  const m = MOIS[lu[2].replace(/\./g, "")];
  if (m === undefined) return null;
  const d = Number(lu[1]);
  const y0 = maintenant.getUTCFullYear();
  const proche = [y0 - 1, y0, y0 + 1]
    .map((y) => ({ y, ecart: Math.abs(Date.UTC(y, m, d) - maintenant.getTime()) }))
    .sort((a, b) => a.ecart - b.ecart)[0];
  return { y: proche.y, m, d };
}

/**
 * « Remettre en brouillon » n'existe que pour une journée en ligne dont le
 * coup d'envoi n'est pas passé, et qui n'a ni but, ni passe, ni résultat.
 * Après, une journée jouée se corrige en direct.
 */
export function peutRemettreEnBrouillon(s: Saison, j: number, maintenant: Date): boolean {
  return raisonDeGarder(s, j, maintenant) === null;
}

function raisonDeGarder(s: Saison, j: number, maintenant: Date): "absente" | "jouee" | "coup-d-envoi" | null {
  const meta = s.journees.find((m) => m.j === j);
  if (!meta || estBrouillon(meta)) return "absente";
  if (journeeJouee(s, j)) return "jouee";
  const envoi = coupDEnvoi(meta, maintenant);
  if (envoi && envoi.getTime() <= maintenant.getTime()) return "coup-d-envoi";
  return null;
}

export function remettreEnBrouillon(
  s: Saison,
  j: number,
  par: string,
  le: Date
): { saison: Saison } | { refus: "absente" | "jouee" | "coup-d-envoi" } {
  const refus = raisonDeGarder(s, j, le);
  if (refus) return { refus };
  return {
    saison: {
      ...s,
      journees: s.journees.map((m) => (m.j === j ? { ...m, brouillon: { depuis: le.toISOString(), par } } : m)),
    },
  };
}

/** Une journée en brouillon n'a jamais existé pour la ligue : « Jeter le brouillon » la retire, lignes et buts compris. */
export function jeterBrouillon(s: Saison, j: number): Saison {
  const meta = s.journees.find((m) => m.j === j);
  if (!meta || !estBrouillon(meta)) return s;
  return {
    ...s,
    journees: s.journees.filter((m) => m.j !== j),
    entries: s.entries.filter((e) => e.j !== j),
    ...(s.events ? { events: s.events.filter((e) => e.j !== j) } : {}),
  };
}

/** A-t-elle déjà été publiée une fois (des joueurs l'ont vue) ? */
export function dejaPubliee(m: Pick<JourneeMeta, "publiee" | "brouillon">): boolean {
  return !estBrouillon(m) || !!m.publiee;
}
