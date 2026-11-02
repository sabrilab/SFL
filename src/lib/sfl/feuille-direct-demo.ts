"use client";

// La feuille de match tenue par un joueur, sans base : la démonstration du
// poste de dev (captures, essais au téléphone sur un serveur local). Elle ne
// s'allume que hors production ET quand l'appareil la demande
// (localStorage « sfl-direct-demo » = « 1 ») : l'app branchée parle toujours
// à la base (public.prendre_feuille…, supabase/schema.sql).
//
// Les mêmes règles que les fonctions de la base, sur les mêmes refus : le
// droit de prendre (droitDePrendre), le verrou (la première prise gagne), les
// compteurs entre 0 et 99, le sceau qui pose les chiffres sur les seules
// lignes du match (appliquerFeuille) et qui passe par l'enregistrement de la
// saison, comme une publication.

import { appliquerFeuille, avecGestes, droitDePrendre, joueursDuMatch, type Equipes, type FeuilleDirect, type Geste, type RefusFeuille } from "./feuille-direct";
import { localStorageStore, saisieStore } from "./saisie/store";
import { numeroSaison } from "./saisie/types";

const CLE = "sfl-feuilles-direct-demo";
export const DEMO_EVENT = "sfl-feuilles-direct";

export function demoFeuilles(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    return window.localStorage.getItem("sfl-direct-demo") === "1";
  } catch {
    return false;
  }
}

export type IssueDemo = { ok: true; feuille: FeuilleDirect } | { ok: false; refus: RefusFeuille; feuille?: FeuilleDirect };

function lire(): FeuilleDirect[] {
  try {
    const l = JSON.parse(window.localStorage.getItem(CLE) ?? "[]") as FeuilleDirect[];
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

function ecrire(l: FeuilleDirect[]) {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(l));
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(DEMO_EVENT));
}

const meme = (f: FeuilleDirect, n: number, j: number, e: Equipes) => f.saison === n && f.j === j && f.noirs === e[0] && f.blancs === e[1];
export const idDemo = (nom: string) => `demo:${nom}`;

export function feuillesDemo(n: number, j: number): FeuilleDirect[] {
  return lire().filter((f) => f.saison === n && f.j === j);
}

function maj(n: number, j: number, e: Equipes, change: (f: FeuilleDirect) => FeuilleDirect): FeuilleDirect | null {
  const l = lire();
  const i = l.findIndex((f) => meme(f, n, j, e));
  if (i < 0) return null;
  l[i] = { ...change(l[i]), maj_le: new Date().toISOString() };
  ecrire(l);
  return l[i];
}

export function prendreDemo(j: number, e: Equipes, moi: string, maintenant = new Date()): IssueDemo {
  const s = saisieStore.load();
  const n = numeroSaison(s);
  const deja = lire().find((f) => meme(f, n, j, e));
  if (deja && deja.preneur === idDemo(moi) && !deja.fin) return { ok: true, feuille: deja };
  const refus = droitDePrendre(s, j, e, moi, maintenant);
  if (refus && !(deja && !deja.fin && refus === "terminee")) return { ok: false, refus, feuille: deja };
  if (deja) {
    if (deja.fin) return { ok: false, refus: "scellee", feuille: deja };
    if (deja.preneur) return { ok: false, refus: "tenue", feuille: deja };
    const f = maj(n, j, e, (x) => ({ ...x, preneur: idDemo(moi), preneur_nom: moi, pris_le: maintenant.toISOString() }))!;
    return { ok: true, feuille: f };
  }
  const { noirs, blancs } = joueursDuMatch(s, j, e);
  const compteurs: FeuilleDirect["compteurs"] = {};
  for (const p of [...noirs, ...blancs]) {
    const l = s.entries.find((x) => x.j === j && x.player === p && (x.team === e[0] || x.team === e[1]));
    if (!l) continue;
    const c = Object.fromEntries(
      (["buts", "passes", "arrets", "interceptions"] as const).map((k) => [k, (l[k] as number | undefined) ?? 0]).filter(([, v]) => (v as number) > 0)
    );
    if (Object.keys(c).length) compteurs[p] = c;
  }
  const f: FeuilleDirect = {
    saison: n,
    j,
    noirs: e[0],
    blancs: e[1],
    preneur: idDemo(moi),
    preneur_nom: moi,
    pris_le: maintenant.toISOString(),
    debut: maintenant.toISOString(),
    fin: null,
    scelle_par: null,
    version: null,
    compteurs,
    journal: [],
    maj_le: maintenant.toISOString(),
  };
  ecrire([...lire(), f]);
  return { ok: true, feuille: f };
}

export function compterDemo(j: number, e: Equipes, moi: string, gestes: Geste[]): IssueDemo {
  const s = saisieStore.load();
  const n = numeroSaison(s);
  const f = lire().find((x) => meme(x, n, j, e));
  if (!f) return { ok: false, refus: "sans-feuille" };
  if (f.fin) return { ok: false, refus: "scellee", feuille: f };
  if (f.preneur !== idDemo(moi)) return { ok: false, refus: "pas-preneur", feuille: f };
  const { noirs, blancs } = joueursDuMatch(s, j, e);
  if (!gestes.length || gestes.length > 4 || gestes.some((g) => ![...noirs, ...blancs].includes(g.joueur))) return { ok: false, refus: "geste", feuille: f };
  const compteurs = avecGestes(f.compteurs, gestes);
  const faits = gestes.filter((g, i) => {
    const avant = avecGestes(f.compteurs, gestes.slice(0, i));
    return JSON.stringify(avecGestes(avant, [g])) !== JSON.stringify(avant);
  });
  if (!faits.length) return { ok: true, feuille: f };
  return { ok: true, feuille: maj(n, j, e, (x) => ({ ...x, compteurs, journal: [...x.journal, { le: new Date().toISOString(), gestes: faits }] }))! };
}

export function passerDemo(j: number, e: Equipes, moi: string, a: string): IssueDemo {
  const s = saisieStore.load();
  const n = numeroSaison(s);
  const f = lire().find((x) => meme(x, n, j, e));
  if (!f) return { ok: false, refus: "sans-feuille" };
  if (f.fin) return { ok: false, refus: "scellee", feuille: f };
  if (f.preneur !== idDemo(moi)) return { ok: false, refus: "pas-preneur", feuille: f };
  const { noirs, blancs } = joueursDuMatch(s, j, e);
  if (![...noirs, ...blancs].includes(a)) return { ok: false, refus: "pas-ton-match", feuille: f };
  return { ok: true, feuille: maj(n, j, e, (x) => ({ ...x, preneur: idDemo(a), preneur_nom: a, pris_le: new Date().toISOString() }))! };
}

export function adminDemo(j: number, e: Equipes, moi: string, geste: "reprendre" | "liberer" | "rouvrir"): IssueDemo {
  const s = saisieStore.load();
  const n = numeroSaison(s);
  const f = lire().find((x) => meme(x, n, j, e));
  if (geste === "reprendre") {
    if (!f) {
      const neuve = prendreDemo(j, e, moi);
      if (neuve.ok) return neuve;
      const cree: FeuilleDirect = {
        saison: n, j, noirs: e[0], blancs: e[1], preneur: idDemo(moi), preneur_nom: moi, pris_le: new Date().toISOString(),
        debut: new Date().toISOString(), fin: null, scelle_par: null, version: null, compteurs: {}, journal: [], maj_le: new Date().toISOString(),
      };
      ecrire([...lire(), cree]);
      return { ok: true, feuille: cree };
    }
    if (f.fin) return { ok: false, refus: "scellee", feuille: f };
    return { ok: true, feuille: maj(n, j, e, (x) => ({ ...x, preneur: idDemo(moi), preneur_nom: moi, pris_le: new Date().toISOString() }))! };
  }
  if (!f) return { ok: false, refus: "sans-feuille" };
  if (geste === "liberer") {
    if (f.fin) return { ok: false, refus: "scellee", feuille: f };
    return { ok: true, feuille: maj(n, j, e, (x) => ({ ...x, preneur: null, preneur_nom: null }))! };
  }
  if (!f.fin) return { ok: false, refus: "sans-feuille", feuille: f };
  return { ok: true, feuille: maj(n, j, e, (x) => ({ ...x, fin: null, scelle_par: null, version: null }))! };
}

export function scellerDemo(j: number, e: Equipes, moi: string, admin: boolean): IssueDemo {
  const s = saisieStore.load();
  const n = numeroSaison(s);
  const f = lire().find((x) => meme(x, n, j, e));
  if (!f) return { ok: false, refus: "sans-feuille" };
  if (f.fin) return { ok: false, refus: "scellee", feuille: f };
  if (f.preneur !== idDemo(moi) && !admin) return { ok: false, refus: "pas-preneur", feuille: f };
  // La saison avec les chiffres du match, comme une publication (sans base ici).
  localStorageStore.save(appliquerFeuille(s, j, e, f.compteurs));
  window.dispatchEvent(new Event("sfl-saisie"));
  const version = Date.now();
  return { ok: true, feuille: maj(n, j, e, (x) => ({ ...x, fin: new Date().toISOString(), scelle_par: idDemo(moi), version }))! };
}
