// Bola Club : le match en direct de l'entraîneur (demande de Bola, 28/11/2026 :
// « qu'il puisse gérer ses compos en direct, ses changements en direct,
// faire des prises de notes sur l'adversaire »). Tout est dans seance.direct :
//   · la compo : le système (selon le format de l'âge : foot à 5, à 8, à 11),
//     le joueur de chaque poste, le banc ; le onze de départ est gardé pour le
//     temps de jeu ;
//   · le chrono : deux mi-temps de la durée de l'âge ; il tourne depuis
//     `repris` (une heure, en ms) et a déjà compté `ecoule` ms dans la
//     mi-temps en cours ; en pause, `repris` est nul ;
//   · le fil : buts (buteur et passeur), buts adverses, changements, cartons,
//     chacun à sa minute ; les notes sur l'adversaire, à part ;
//   · la fin : le score, les buts et les passes de chacun et l'appel (qui a
//     joué) posés sur la séance, comme la saisie des stats ; les cartes
//     bougent avec.
// Les fonctions prennent l'heure (`maintenant`) en paramètre : pures et
// vérifiables (tools/club-planning-check.ts).

import { ageType } from "./proposition";
import { droits, membreDe } from "./regles";
import { ecarte } from "./suivi";
import type { Club, Moi, Seance } from "./types";

type Resultat = { ok: true; club: Club } | { ok: false; refus: string };
const ok = (club: Club): Resultat => ({ ok: true, club });
const refus = (r: string): Resultat => ({ ok: false, refus: r });

export interface EvenementDirect {
  id: string;
  minute: number;
  type: "but" | "butContre" | "changement" | "carton";
  joueur?: string;
  passeur?: string | null;
  /** Un changement : qui sort, qui entre. */
  sort?: string;
  entre?: string;
  carton?: "jaune" | "rouge";
}

export interface NoteAdversaire {
  id: string;
  minute: number;
  texte: string;
}

export interface Direct {
  systeme: string;
  /** Le joueur de chaque poste du système, dans son ordre (null : poste vide, après un rouge). */
  terrain: (string | null)[];
  banc: string[];
  /** Le onze de départ. */
  depart: string[];
  periode: 1 | 2;
  /** La durée d'une mi-temps, en minutes. */
  duree: number;
  ecoule: number;
  repris: number | null;
  evenements: EvenementDirect[];
  notes: NoteAdversaire[];
  fini: boolean;
}

/* ---------------------------------- Format --------------------------------- */

type Place = readonly [number, number];
const G: Place = [50, 90];

/** Les systèmes par format : chaque poste (x de 0 à 100, y de 0 : le but adverse, à 100 : le nôtre), le gardien d'abord. */
export const SYSTEMES: Record<5 | 8 | 11, { id: string; places: Place[] }[]> = {
  5: [
    { id: "2-2", places: [G, [30, 64], [70, 64], [30, 30], [70, 30]] },
    { id: "1-2-1", places: [G, [50, 68], [22, 46], [78, 46], [50, 24]] },
  ],
  8: [
    { id: "3-3-1", places: [G, [20, 70], [50, 73], [80, 70], [20, 46], [50, 50], [80, 46], [50, 22]] },
    { id: "2-3-2", places: [G, [32, 72], [68, 72], [16, 48], [50, 52], [84, 48], [34, 24], [66, 24]] },
    { id: "3-2-2", places: [G, [20, 70], [50, 73], [80, 70], [34, 48], [66, 48], [34, 24], [66, 24]] },
  ],
  11: [
    { id: "4-3-3", places: [G, [14, 70], [37, 75], [63, 75], [86, 70], [26, 50], [50, 54], [74, 50], [18, 24], [50, 18], [82, 24]] },
    { id: "4-4-2", places: [G, [14, 70], [37, 75], [63, 75], [86, 70], [14, 46], [37, 50], [63, 50], [86, 46], [36, 22], [64, 22]] },
    { id: "3-5-2", places: [G, [24, 73], [50, 76], [76, 73], [10, 48], [32, 52], [50, 44], [68, 52], [90, 48], [36, 22], [64, 22]] },
  ],
};

/** Le format de jeu d'une catégorie : foot à 5 jusqu'à 8 ans, à 8 jusqu'à 12, puis à 11. */
export const formatDe = (age: number): 5 | 8 | 11 => (age <= 8 ? 5 : age <= 12 ? 8 : 11);
/** La durée d'une mi-temps, en minutes, selon l'âge. */
export const dureeDe = (age: number) => (age <= 8 ? 15 : age <= 10 ? 25 : age <= 12 ? 30 : age <= 14 ? 35 : age <= 16 ? 40 : 45);

export const placesDe = (d: Pick<Direct, "systeme" | "terrain">): Place[] =>
  Object.values(SYSTEMES)
    .flat()
    .find((s) => s.id === d.systeme && s.places.length === d.terrain.length)?.places ?? [];

const RANG: Record<string, number> = { G: 0, DG: 1, DC: 1, DD: 1, MDC: 2, MG: 3, MC: 3, MD: 3, MOC: 3, AG: 4, AT: 4, AD: 4, BU: 4 };
const rang = (poste: string) => RANG[poste] ?? 3;

/* ---------------------------------- Chrono --------------------------------- */

/** Le temps de la mi-temps en cours, en ms. */
export const ecouleDe = (d: Pick<Direct, "ecoule" | "repris">, maintenant: number) => d.ecoule + (d.repris !== null ? Math.max(0, maintenant - d.repris) : 0);

/** La minute du match (1re minute = 1), la seconde mi-temps comptée après la première. */
export function minuteDe(d: Pick<Direct, "ecoule" | "repris" | "periode" | "duree">, maintenant: number): number {
  return Math.floor(ecouleDe(d, maintenant) / 60_000) + 1 + (d.periode - 1) * d.duree;
}

/** « 34:12 », le temps de la mi-temps en cours (la seconde reprend à 0). */
export function chronoDit(d: Pick<Direct, "ecoule" | "repris" | "periode" | "duree">, maintenant: number): string {
  const s = Math.floor(ecouleDe(d, maintenant) / 1000) + (d.periode - 1) * d.duree * 60;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function scoreDe(d: Pick<Direct, "evenements">): { nous: number; eux: number } {
  return {
    nous: d.evenements.filter((e) => e.type === "but").length,
    eux: d.evenements.filter((e) => e.type === "butContre").length,
  };
}

/** Les minutes jouées par chacun : du départ ou de l'entrée, à la sortie, au rouge ou à maintenant. */
export function tempsDeJeu(d: Direct, maintenant: number): Record<string, number> {
  const fin = d.fini ? d.duree * 2 : Math.min(minuteDe(d, maintenant) - 1 + (ecouleDe(d, maintenant) % 60_000) / 60_000, d.duree * 2);
  const entre: Record<string, number> = Object.fromEntries(d.depart.map((id) => [id, 0]));
  const temps: Record<string, number> = {};
  const sortir = (id: string, m: number) => {
    if (entre[id] === undefined) return;
    temps[id] = (temps[id] ?? 0) + Math.max(0, m - entre[id]);
    delete entre[id];
  };
  for (const e of [...d.evenements].sort((a, b) => a.minute - b.minute)) {
    const m = e.minute - 1;
    if (e.type === "changement" && e.sort && e.entre) {
      sortir(e.sort, m);
      entre[e.entre] = m;
    }
    if (e.type === "carton" && e.carton === "rouge" && e.joueur) sortir(e.joueur, m);
  }
  for (const id of Object.keys(entre)) sortir(id, fin);
  return Object.fromEntries(Object.entries(temps).map(([k, v]) => [k, Math.round(v)]));
}

/* -------------------------------- Mutations -------------------------------- */

function leMatch(club: Club, moi: Moi, seance: string): { s: Seance } | { refus: string } {
  const s = club.seances.find((x) => x.id === seance);
  if (!s) return { refus: "Match introuvable." };
  if (s.genre !== "match") return { refus: "Le direct est celui d'un match." };
  if (!droits(club, moi).gere(s.categorie)) return { refus: "Ce n'est pas ton équipe." };
  return { s };
}

const avec = (club: Club, s: Seance, direct: Direct): Club => ({ ...club, seances: club.seances.map((x) => (x.id === s.id ? { ...s, direct } : x)) });

function enCours(club: Club, moi: Moi, seance: string): { s: Seance; d: Direct } | { refus: string } {
  const m = leMatch(club, moi, seance);
  if ("refus" in m) return m;
  if (!m.s.direct) return { refus: "Le direct n'est pas lancé." };
  if (m.s.direct.fini) return { refus: "Le match est terminé." };
  return { s: m.s, d: m.s.direct };
}

/** Ouvrir le direct : le système du format, les convoqués qui ne se sont pas dits absents, sans les blessés écartés, placés par poste ; les autres au banc. */
export function lancerDirect(club: Club, moi: Moi, seance: string): Resultat {
  const m = leMatch(club, moi, seance);
  if ("refus" in m) return refus(m.refus);
  const { s } = m;
  if (s.direct) return ok(club);
  if (s.score) return refus("Le score est déjà saisi.");
  const age = ageType(club.categories.find((c) => c.id === s.categorie) ?? null);
  const format = formatDe(age);
  const systeme = SYSTEMES[format][0];
  // Les convoqués qui ne se sont pas dits absents ; un blessé encore écarté du contact (lib/sfl/club/suivi.ts) ne joue pas.
  const groupe = s.convoques
    .filter((id) => s.reponses[id] !== "absent" && !ecarte(club, id))
    .map((id) => membreDe(club, id))
    .filter((x) => !!x);
  if (groupe.length < format) return refus(`Il faut ${format} joueurs convoqués.`);
  // Un gardien au but, puis les joueurs de champ de l'arrière vers l'avant ; le second gardien au banc.
  const gardiens = groupe.filter((x) => x.poste === "G");
  const champ = groupe.filter((x) => x.poste !== "G").sort((a, b) => rang(a.poste) - rang(b.poste));
  const tries = [...gardiens.slice(0, 1), ...champ.slice(0, format - Math.min(1, gardiens.length)), ...gardiens.slice(1), ...champ.slice(format - Math.min(1, gardiens.length))];
  const titulaires = tries.slice(0, format).map((x) => x.id);
  const banc = tries.slice(format).map((x) => x.id);
  const direct: Direct = {
    systeme: systeme.id,
    terrain: titulaires,
    banc,
    depart: titulaires,
    periode: 1,
    duree: dureeDe(age),
    ecoule: 0,
    repris: null,
    evenements: [],
    notes: [],
    fini: false,
  };
  return ok(avec(club, s, direct));
}

/** Le chrono : démarrer ou reprendre, mettre en pause, passer à la mi-temps (la seconde attend son coup d'envoi). */
export function chrono(club: Club, moi: Moi, seance: string, action: "demarrer" | "pause" | "mitemps", maintenant: number): Resultat {
  const e = enCours(club, moi, seance);
  if ("refus" in e) return refus(e.refus);
  const { s, d } = e;
  if (action === "demarrer") return d.repris !== null ? ok(club) : ok(avec(club, s, { ...d, repris: maintenant }));
  if (action === "pause") return d.repris === null ? ok(club) : ok(avec(club, s, { ...d, ecoule: ecouleDe(d, maintenant), repris: null }));
  if (d.periode === 2) return refus("C'est déjà la seconde mi-temps.");
  return ok(avec(club, s, { ...d, periode: 2, ecoule: 0, repris: null }));
}

export function changerSysteme(club: Club, moi: Moi, seance: string, systeme: string): Resultat {
  const e = enCours(club, moi, seance);
  if ("refus" in e) return refus(e.refus);
  const { s, d } = e;
  const voulu = Object.values(SYSTEMES)
    .flat()
    .find((x) => x.id === systeme && x.places.length === d.terrain.length);
  if (!voulu) return refus("Système inconnu pour ce format.");
  return ok(avec(club, s, { ...d, systeme }));
}

/** Échanger deux joueurs du terrain de poste (sans événement). */
export function echangerPostes(club: Club, moi: Moi, seance: string, a: string, b: string): Resultat {
  const e = enCours(club, moi, seance);
  if ("refus" in e) return refus(e.refus);
  const { s, d } = e;
  const i = d.terrain.indexOf(a);
  const j = d.terrain.indexOf(b);
  if (i < 0 || j < 0) return refus("Les deux doivent être sur le terrain.");
  const terrain = [...d.terrain];
  [terrain[i], terrain[j]] = [terrain[j], terrain[i]];
  return ok(avec(club, s, { ...d, terrain }));
}

/** Un id libre, sans hasard (la démo se tire deux fois à l'identique). */
const nouvelId = (d: Direct, p: string) => {
  let k = d.evenements.length + d.notes.length + 1;
  while (d.evenements.some((e) => e.id === `${p}-${k}`) || d.notes.some((n) => n.id === `${p}-${k}`)) k++;
  return `${p}-${k}`;
};

/** Un changement : `sort` quitte le terrain pour le banc, `entre` prend son poste. */
export function remplacer(club: Club, moi: Moi, seance: string, sort: string, entre: string, maintenant: number): Resultat {
  const e = enCours(club, moi, seance);
  if ("refus" in e) return refus(e.refus);
  const { s, d } = e;
  const i = d.terrain.indexOf(sort);
  if (i < 0) return refus("Il n'est pas sur le terrain.");
  if (!d.banc.includes(entre)) return refus("Il n'est pas sur le banc.");
  if (d.evenements.some((x) => x.type === "carton" && x.carton === "rouge" && x.joueur === entre)) return refus("Un joueur exclu ne revient pas.");
  const terrain = [...d.terrain];
  terrain[i] = entre;
  const banc = [...d.banc.filter((id) => id !== entre), sort];
  const ev: EvenementDirect = { id: nouvelId(d, "ev"), minute: minuteDe(d, maintenant), type: "changement", sort, entre };
  return ok(avec(club, s, { ...d, terrain, banc, evenements: [...d.evenements, ev] }));
}

/** Un but pour nous : le buteur et le passeur (facultatifs) sont sur le terrain. */
export function butPour(club: Club, moi: Moi, seance: string, buteur: string | null, passeur: string | null, maintenant: number): Resultat {
  const e = enCours(club, moi, seance);
  if ("refus" in e) return refus(e.refus);
  const { s, d } = e;
  if (buteur && !d.terrain.includes(buteur)) return refus("Le buteur est sur le terrain.");
  if (passeur && (!d.terrain.includes(passeur) || passeur === buteur)) return refus("Le passeur est un autre joueur du terrain.");
  const ev: EvenementDirect = { id: nouvelId(d, "ev"), minute: minuteDe(d, maintenant), type: "but", ...(buteur ? { joueur: buteur } : {}), passeur: passeur ?? null };
  return ok(avec(club, s, { ...d, evenements: [...d.evenements, ev] }));
}

export function butContre(club: Club, moi: Moi, seance: string, maintenant: number): Resultat {
  const e = enCours(club, moi, seance);
  if ("refus" in e) return refus(e.refus);
  const { s, d } = e;
  const ev: EvenementDirect = { id: nouvelId(d, "ev"), minute: minuteDe(d, maintenant), type: "butContre" };
  return ok(avec(club, s, { ...d, evenements: [...d.evenements, ev] }));
}

/** Un carton ; un rouge (ou un second jaune) sort le joueur sans remplaçant. */
export function carton(club: Club, moi: Moi, seance: string, joueur: string, couleur: "jaune" | "rouge", maintenant: number): Resultat {
  const e = enCours(club, moi, seance);
  if ("refus" in e) return refus(e.refus);
  const { s, d } = e;
  if (!d.terrain.includes(joueur)) return refus("Il n'est pas sur le terrain.");
  const minute = minuteDe(d, maintenant);
  const second = couleur === "jaune" && d.evenements.some((x) => x.type === "carton" && x.carton === "jaune" && x.joueur === joueur);
  const evs: EvenementDirect[] = [{ id: nouvelId(d, "ev"), minute, type: "carton", joueur, carton: couleur }];
  if (second) evs.push({ id: nouvelId({ ...d, evenements: [...d.evenements, ...evs] }, "ev"), minute, type: "carton", joueur, carton: "rouge" });
  const exclu = couleur === "rouge" || second;
  const terrain = exclu ? d.terrain.map((id) => (id === joueur ? null : id)) : d.terrain;
  return ok(avec(club, s, { ...d, terrain, evenements: [...d.evenements, ...evs] }));
}

/** Retirer un but, un but adverse ou un jaune saisi par erreur (un changement se défait par un autre). */
export function annulerEvenement(club: Club, moi: Moi, seance: string, id: string): Resultat {
  const e = enCours(club, moi, seance);
  if ("refus" in e) return refus(e.refus);
  const { s, d } = e;
  const ev = d.evenements.find((x) => x.id === id);
  if (!ev) return refus("Introuvable.");
  if (ev.type === "changement" || (ev.type === "carton" && ev.carton === "rouge")) return refus("Un changement ou un rouge ne s'annule pas.");
  return ok(avec(club, s, { ...d, evenements: d.evenements.filter((x) => x.id !== id) }));
}

export function noterAdversaire(club: Club, moi: Moi, seance: string, texte: string, maintenant: number): Resultat {
  const e = enCours(club, moi, seance);
  if ("refus" in e) return refus(e.refus);
  const { s, d } = e;
  const t = texte.trim().slice(0, 200);
  if (!t) return refus("Une note vide.");
  const n: NoteAdversaire = { id: nouvelId(d, "no"), minute: minuteDe(d, maintenant), texte: t };
  return ok(avec(club, s, { ...d, notes: [...d.notes, n] }));
}

/** Fin du match : le score, les buts et les passes de chacun, et l'appel (qui a joué) posés sur la séance. */
export function terminerDirect(club: Club, moi: Moi, seance: string, maintenant: number): Resultat {
  const e = enCours(club, moi, seance);
  if ("refus" in e) return refus(e.refus);
  const { s, d } = e;
  const joue = new Set([...d.depart, ...d.evenements.filter((x) => x.type === "changement").map((x) => x.entre!)]);
  const stats: Seance["stats"] = {};
  for (const ev of d.evenements) {
    if (ev.type !== "but") continue;
    if (ev.joueur) stats[ev.joueur] = { buts: (stats[ev.joueur]?.buts ?? 0) + 1, passes: stats[ev.joueur]?.passes ?? 0 };
    if (ev.passeur) stats[ev.passeur] = { buts: stats[ev.passeur]?.buts ?? 0, passes: (stats[ev.passeur]?.passes ?? 0) + 1 };
  }
  const appel = { ...s.appel };
  for (const id of s.convoques) appel[id] = joue.has(id) ? "present" : (appel[id] ?? "present");
  const fini: Direct = { ...d, ecoule: ecouleDe(d, maintenant), repris: null, fini: true };
  return ok({ ...club, seances: club.seances.map((x) => (x.id === s.id ? { ...s, direct: fini, score: scoreDe(d), stats, appel } : x)) });
}

/* ----------------------------------- Démo ---------------------------------- */

/**
 * Le direct de la démo, sur le prochain match des U17 : lancé, mis en pause à
 * la 35e minute de la première mi-temps, 1-1. Un but avec passe, un but
 * adverse, un jaune, un changement, trois notes sur l'adversaire.
 */
export function avecDirectDemo(club: Club, seance = "u17-m9"): Club {
  const moi: Moi = { role: "entraineur", id: club.categories.find((c) => c.id === club.seances.find((s) => s.id === seance)?.categorie)?.entraineurs[0] ?? "" };
  let c = club;
  const fait = (r: Resultat) => {
    if (r.ok) c = r.club;
  };
  const min = (m: number) => m * 60_000 - 30_000;
  fait(lancerDirect(c, moi, seance));
  const d = () => c.seances.find((s) => s.id === seance)?.direct;
  const depart = d();
  if (!depart) return club;
  const t = depart.terrain as string[];
  const avant = t[t.length - 2] ?? t[t.length - 1];
  fait(chrono(c, moi, seance, "demarrer", 0));
  fait(butPour(c, moi, seance, avant, t[Math.floor(t.length / 2) + 1] ?? null, min(9)));
  fait(noterAdversaire(c, moi, seance, "Leur 9 très rapide, il prend la profondeur dans le dos des centraux", min(14)));
  fait(butContre(c, moi, seance, min(21)));
  fait(noterAdversaire(c, moi, seance, "Le gardien relance long à chaque fois, sur le 9", min(23)));
  fait(carton(c, moi, seance, t[2], "jaune", min(26)));
  const entrant = depart.banc.find((id) => membreDe(club, id)?.poste !== "G");
  if (entrant) fait(remplacer(c, moi, seance, t[t.length - 1], entrant, min(29)));
  fait(noterAdversaire(c, moi, seance, "Leur latéral gauche monte et ne revient pas : attaquer de ce côté", min(31)));
  fait(chrono(c, moi, seance, "pause", 34 * 60_000 + 12_000));
  return c;
}
