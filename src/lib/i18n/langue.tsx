"use client";

// La langue de l'app sur ce téléphone : le choix du joueur s'il en a fait un
// (bola-langue), sinon celle de son pays de connexion (/api/pays,
// lib/i18n/langues.ts). Hors de React (un petit magasin) : l'écran de
// connexion, l'inscription et l'app la lisent sans fournisseur.
//
// Traduire : const t = useT(); t("Créer ma carte") ; t("Bienvenue, {nom}.", { nom }).
// La phrase française est la clé : sans traduction, elle s'affiche telle
// quelle (lib/i18n/ar.ts). Ainsi l'app se traduit écran par écran, sans
// jamais montrer une clé vide.
//
// <html lang dir> suit la langue (LangueDocument, et SCRIPT_LANGUE avant
// le premier rendu, pour qu'un écran en arabe ne naisse pas de gauche à droite).

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { AR } from "./ar";
import { ARABOPHONES, CLE_LANGUE, INFO_LANGUE, estLangue, langueDuPays, languesProposees, remplir, type Langue } from "./langues";

const CLE_PAYS = "bola-pays";
const DICTIONNAIRES: Record<Langue, Record<string, string> | null> = { fr: null, ar: AR };

type Etat = { choix: Langue | null; pays: string | null; appareil: readonly string[] };
let etat: Etat = { choix: null, pays: null, appareil: [] };
let lu = false;
const abonnes = new Set<() => void>();

function lireStockage() {
  if (lu || typeof window === "undefined") return;
  lu = true;
  let choix: Langue | null = null;
  let pays: string | null = null;
  try {
    const c = localStorage.getItem(CLE_LANGUE);
    if (estLangue(c)) choix = c;
    pays = sessionStorage.getItem(CLE_PAYS);
  } catch {}
  etat = { choix, pays, appareil: [...(navigator.languages ?? [navigator.language])].filter(Boolean) };
}

function changer(partiel: Partial<Etat>) {
  etat = { ...etat, ...partiel };
  abonnes.forEach((f) => f());
}

function abonner(f: () => void) {
  abonnes.add(f);
  const autre = (e: StorageEvent) => {
    if (e.key !== CLE_LANGUE) return;
    changer({ choix: estLangue(e.newValue) ? e.newValue : null });
  };
  window.addEventListener("storage", autre);
  return () => {
    abonnes.delete(f);
    window.removeEventListener("storage", autre);
  };
}

const lire = () => {
  lireStockage();
  return etat;
};
const ETAT_SERVEUR: Etat = { choix: null, pays: null, appareil: [] };

let paysDemande = false;
/** Le pays de la connexion, demandé une fois par ouverture. */
function demanderPays() {
  if (paysDemande || typeof window === "undefined") return;
  paysDemande = true;
  fetch("/api/pays", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: { pays?: string | null } | null) => {
      const pays = d?.pays ?? null;
      if (!pays) return;
      try {
        sessionStorage.setItem(CLE_PAYS, pays);
      } catch {}
      if (pays !== etat.pays) changer({ pays });
    })
    .catch(() => {});
}

export function langueEffective(e: Etat): Langue {
  return e.choix ?? langueDuPays(e.pays);
}

/** La langue de l'app, et le choix. */
export function useLangue() {
  const e = useSyncExternalStore(abonner, lire, () => ETAT_SERVEUR);
  useEffect(demanderPays, []);
  const langue = langueEffective(e);
  const choisir = useCallback((l: Langue) => {
    try {
      localStorage.setItem(CLE_LANGUE, l);
    } catch {}
    changer({ choix: l });
    navigator.vibrate?.(6);
  }, []);
  return {
    langue,
    dir: INFO_LANGUE[langue].dir,
    choisie: e.choix !== null,
    /** Les langues à offrir à l'entrée (une seule : pas de choix). */
    proposees: languesProposees(e.pays, e.appareil),
    choisir,
  };
}

/** Traduit une phrase française (la clé) dans la langue de l'app. */
export function traduire(langue: Langue, fr: string, valeurs?: Record<string, string | number>) {
  return remplir(DICTIONNAIRES[langue]?.[fr] ?? fr, valeurs);
}

export function useT() {
  const { langue } = useLangue();
  return useCallback((fr: string, valeurs?: Record<string, string | number>) => traduire(langue, fr, valeurs), [langue]);
}

/** <html lang dir> à la langue de l'app. */
export function LangueDocument() {
  const { langue, dir } = useLangue();
  useEffect(() => {
    const h = document.documentElement;
    h.lang = langue;
    h.dir = dir;
  }, [langue, dir]);
  return null;
}

/** Avant le premier rendu : la langue choisie, ou celle du pays déjà connu. */
export const SCRIPT_LANGUE = `try{var l=localStorage.getItem(${JSON.stringify(CLE_LANGUE)});if(l!=="fr"&&l!=="ar"){var p=sessionStorage.getItem(${JSON.stringify(CLE_PAYS)});l=${JSON.stringify(ARABOPHONES)}.indexOf(p)>=0?"ar":"fr"}document.documentElement.lang=l;document.documentElement.dir=l==="ar"?"rtl":"ltr"}catch(e){}`;
