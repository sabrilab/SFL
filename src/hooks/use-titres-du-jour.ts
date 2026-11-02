"use client";

// Les puces des titres d'une journée, lues là où l'écran lit la saison
// (lib/sfl/puces-titres.ts) : le seul point de lecture des puces, partout où
// un terrain montre des cartes (carte-journee, feuille de match, terrain de
// l'admin, pelouse des Actus, synthèse du récap, équipe type).
//
// La saison lue est useSeason().saison : celle que voit la ligue, où les
// votes fermés sont posés (appliquerVotes), sans brouillon. Sous un
// SaisonArchiveProvider, c'est l'archive : tout y est attribué.
//
// Le garde du jour même (titresAttribues) : cette vue porte le MVP
// automatique dès le premier but saisi, donc aucune puce le jour du match,
// ni en direct ni pendant le vote ; elles tombent à minuit (Paris). Une seule
// horloge pour toute l'app, qui ne réveille les écrans qu'au changement de
// jour.
//
// LA RÉVÉLATION (autre chantier, lib/sfl/revelation.ts) : quand la vue de la
// saison donne `revelation.comptees` (SeasonProvider figé jusqu'à 19 h), une
// journée comptée a ses puces dès la révélation, sans rien changer ici ; la
// vue figée, elle, n'a aucun titre avant. Pour s'en remettre entièrement à
// revelation.ts, c'est la ligne `attribue` ci-dessous qu'on remplace par
// `titresTombes(saison, j, maintenant)` (ou etatRevelation(...) === "revelee").

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useSaisonClose, useSeason } from "@/components/sfl/season-provider";
import type { BoostType } from "@/lib/sfl/engine";
import { titresAttribues, titresDuJoueur } from "@/lib/sfl/puces-titres";

const AUCUN: BoostType[] = [];

/* ------------------- L'horloge du jour, une pour toute l'app ------------------- */

const cleDuJour = (t: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "numeric", day: "numeric" }).format(t);

let jour = "";
const abonnes = new Set<() => void>();
let minuteur = 0;

function relire() {
  const k = cleDuJour(new Date());
  if (k === jour) return;
  jour = k;
  abonnes.forEach((f) => f());
}

function abonner(f: () => void) {
  abonnes.add(f);
  if (abonnes.size === 1) {
    minuteur = window.setInterval(relire, 60_000);
    document.addEventListener("visibilitychange", relire);
  }
  return () => {
    abonnes.delete(f);
    if (!abonnes.size) {
      window.clearInterval(minuteur);
      document.removeEventListener("visibilitychange", relire);
    }
  };
}

function lireJour() {
  if (!jour) jour = cleDuJour(new Date());
  return jour;
}

/* ------------------------------------------------------------------------------- */

/**
 * `(nom, equipes?) => titres` pour la journée `j` ; sans journée (une
 * convocation, un match à venir), ou pas encore attribuée, aucun titre.
 */
export function useTitresDuJour(j: number | null | undefined): (nom: string, equipes?: readonly [string, string]) => BoostType[] {
  const vue = useSeason();
  const { saison } = vue;
  const close = useSaisonClose();
  const leJour = useSyncExternalStore(abonner, lireJour, lireJour);
  // Les journées que la ligue compte déjà, quand la vue de la saison les donne (la révélation).
  const comptees = (vue as { revelation?: { comptees?: ReadonlySet<number> } }).revelation?.comptees;
  const attribue = useMemo(() => {
    void leJour; // se relit au changement de jour
    return j != null && (close || titresAttribues(saison.journees, j, new Date(), comptees));
  }, [saison.journees, j, comptees, close, leJour]);
  const lignes = useMemo(
    () => (j == null || !attribue ? [] : saison.entries.filter((e) => e.j === j)),
    [saison.entries, j, attribue],
  );
  return useCallback(
    (nom: string, equipes?: readonly [string, string]) => {
      if (j == null || !lignes.length) return AUCUN;
      const t = titresDuJoueur(lignes, j, nom, equipes);
      return t.length ? t : AUCUN;
    },
    [lignes, j],
  );
}
