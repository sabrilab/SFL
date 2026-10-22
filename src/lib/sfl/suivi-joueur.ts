// La fiche d'un joueur, pour l'admin : tout ce que le journal `activity` dit
// de lui, et de quoi le comparer aux autres.
//
// Sabri, le 22/10, à propos d'Afid, arrivé la veille et resté plus d'une
// heure dès son premier soir : « on aimerait avoir une carte et un
// emplacement spécifique dans nos analytics pour analyser vraiment ce que
// [ce joueur] fait […], parce qu'on ne le connaît ni d'Adam ni d'Ève ».
//
// Deux choses, calculées ici sans rien d'écrit d'avance :
//   · `ficheJoueur` — son parcours : temps passé, sessions (avec les pages
//     dans l'ordre), pages et gestes, heures de venue, et ses premières 24 h
//     rangées parmi celles des autres ;
//   · `aSuivre` — les nouveaux venus dont les premières 24 h dépassent de
//     loin celles des autres : ceux qu'on veut connaître.
//
// Le temps passé se compte comme dans retention.ts : la somme des écarts de
// moins de 5 minutes entre deux événements d'une même session.

import { DAY, debutJour, KIND_FR, PATH_FR, type Evenement } from "./retention";

const TROU = 5 * 60 * 1000;
const neutre = (k: string) => k === "heartbeat" || k === "close";
const cleSession = (e: Evenement) => e.session ?? `legacy:${e.name}:${debutJour(e.at)}`;

/** Le nom d'une page, en français. */
export function nomPage(path: string): string {
  if (PATH_FR[path]) return PATH_FR[path];
  const racine = "/" + (path.split("/")[1] ?? "");
  return PATH_FR[racine] ?? path;
}

export interface FicheSession {
  debut: number;
  ms: number;
  actions: number;
  /** Les pages vues, dans l'ordre, sans répéter deux fois de suite la même. */
  pages: string[];
}

export interface Fiche {
  name: string;
  premier: number;
  last: number;
  temps: number;
  joursActifs: number;
  /** Les plus récentes d'abord. */
  sessions: FicheSession[];
  pages: { label: string; value: number }[];
  gestes: { label: string; value: number }[];
  /** Le temps passé, heure par heure depuis son arrivée (ou jour par jour au-delà de 3 jours). */
  rythme: { t: number; ms: number }[];
  pas: "heure" | "jour";
  /** Ses premières 24 h, parmi celles des autres du même public. */
  debut: { ms: number; rang: number; sur: number; mediane: number };
}

/** Le temps passé par chacun dans ses premières 24 h. */
function premieres24h(evenements: Evenement[]): Map<string, number> {
  const premier = new Map<string, number>();
  for (const e of evenements) {
    const p = premier.get(e.name);
    if (p === undefined || e.at < p) premier.set(e.name, e.at);
  }
  const fin = new Map<string, number>();
  const ms = new Map<string, number>();
  for (const e of [...evenements].sort((a, b) => a.at - b.at)) {
    if (e.at > premier.get(e.name)! + DAY) continue;
    const k = cleSession(e);
    const f = fin.get(k);
    if (f !== undefined && e.at - f <= TROU) ms.set(e.name, (ms.get(e.name) ?? 0) + e.at - f);
    fin.set(k, e.at);
  }
  for (const n of premier.keys()) if (!ms.has(n)) ms.set(n, 0);
  return ms;
}

function mediane(xs: number[]): number {
  if (!xs.length) return 0;
  const t = [...xs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2;
}

export function ficheJoueur(evenements: Evenement[], name: string): Fiche | null {
  const siens = evenements.filter((e) => e.name === name).sort((a, b) => a.at - b.at);
  if (!siens.length) return null;

  const sessions = new Map<string, FicheSession & { fin: number }>();
  const pages = new Map<string, number>();
  const gestes = new Map<string, number>();
  const jours = new Set<number>();
  for (const e of siens) {
    jours.add(debutJour(e.at));
    const k = cleSession(e);
    let s = sessions.get(k);
    if (!s) {
      s = { debut: e.at, fin: e.at, ms: 0, actions: 0, pages: [] };
      sessions.set(k, s);
    } else {
      if (e.at - s.fin <= TROU) s.ms += e.at - s.fin;
      s.fin = e.at;
    }
    if (!neutre(e.kind)) s.actions += 1;
    if (e.kind === "view" && e.path) {
      const p = nomPage(e.path);
      if (s.pages.at(-1) !== p) s.pages.push(p);
      pages.set(p, (pages.get(p) ?? 0) + 1);
    } else if (!neutre(e.kind) && e.kind !== "view") {
      const g = KIND_FR[e.kind] ?? e.kind;
      gestes.set(g, (gestes.get(g) ?? 0) + 1);
    }
  }
  const liste = [...sessions.values()].sort((a, b) => b.debut - a.debut);
  const temps = liste.reduce((s, x) => s + x.ms, 0);

  // Le rythme : heure par heure pour un nouveau venu, jour par jour ensuite.
  const premier = siens[0].at;
  const last = siens.at(-1)!.at;
  const pas = last - premier <= 3 * DAY ? "heure" : "jour";
  const tranche = pas === "heure" ? 3600 * 1000 : DAY;
  const origine = pas === "heure" ? Math.floor(premier / tranche) * tranche : debutJour(premier);
  const rythme: { t: number; ms: number }[] = [];
  for (let t = origine; t <= last; t += tranche) rythme.push({ t, ms: 0 });
  const fin = new Map<string, number>();
  for (const e of siens) {
    const k = cleSession(e);
    const f = fin.get(k);
    if (f !== undefined && e.at - f <= TROU) {
      const i = pas === "heure" ? Math.floor((e.at - origine) / tranche) : rythme.findLastIndex((r) => r.t <= e.at);
      if (rythme[i]) rythme[i].ms += e.at - f;
    }
    fin.set(k, e.at);
  }

  const debuts = premieres24h(evenements);
  const sien = debuts.get(name) ?? 0;
  const autres = [...debuts.values()];

  const trie = (m: Map<string, number>) =>
    [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  return {
    name,
    premier,
    last,
    temps,
    joursActifs: jours.size,
    sessions: liste.map(({ debut, ms, actions, pages }) => ({ debut, ms, actions, pages })),
    pages: trie(pages),
    gestes: trie(gestes),
    rythme,
    pas,
    debut: {
      ms: sien,
      rang: autres.filter((x) => x > sien).length + 1,
      sur: autres.length,
      mediane: mediane(autres),
    },
  };
}

export interface ASuivre {
  name: string;
  premier: number;
  ms: number;
  /** Combien de fois la médiane des premières 24 h. */
  fois: number;
}

/**
 * Les nouveaux venus (arrivés depuis moins de 14 jours) dont les premières
 * 24 h valent au moins 3 fois la médiane, et au moins 20 minutes.
 */
export function aSuivre(evenements: Evenement[], now: number): ASuivre[] {
  const debuts = premieres24h(evenements);
  const med = Math.max(60 * 1000, mediane([...debuts.values()]));
  const premier = new Map<string, number>();
  for (const e of evenements) {
    const p = premier.get(e.name);
    if (p === undefined || e.at < p) premier.set(e.name, e.at);
  }
  return [...debuts.entries()]
    .filter(([n, ms]) => now - premier.get(n)! <= 14 * DAY && ms >= 20 * 60 * 1000 && ms >= 3 * med)
    .map(([name, ms]) => ({ name, premier: premier.get(name)!, ms, fois: ms / med }))
    .sort((a, b) => b.ms - a.ms);
}
