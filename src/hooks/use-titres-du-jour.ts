"use client";

// Les puces des titres d'une journée, lues là où l'écran lit la saison
// (lib/sfl/puces-titres.ts) : le seul point de lecture des puces, partout où
// un terrain montre des cartes (carte-journee, feuille de match, terrain de
// l'admin, pelouse des Actus, synthèse du récap, équipe type).
//
// La saison lue est useSeason().saison : celle que voit la ligue, où les
// votes fermés sont posés (appliquerVotes), sans brouillon ni feuille en
// direct. Sous un SaisonArchiveProvider, c'est l'archive. Quand cette vue
// sera figée jusqu'à la révélation (lib/sfl/revelation.ts, à partir de la
// J5, titres révélés à 19 h), les lignes d'une journée pas encore révélée
// n'y porteront plus de titre, et les puces suivront sans rien changer ici.
// Si un garde-fou explicite devient nécessaire, c'est ICI qu'il se branche :
// `lignes` vide tant que titresTombes(saison, j, maintenant) est faux (ou que
// etatRevelation(...) n'est pas « revelee »).

import { useCallback, useMemo } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import type { BoostType } from "@/lib/sfl/engine";
import { titresDuJoueur } from "@/lib/sfl/puces-titres";

const AUCUN: BoostType[] = [];

/**
 * `(nom, equipes?) => titres` pour la journée `j` ; sans journée (une
 * convocation, un match à venir), aucun titre.
 */
export function useTitresDuJour(j: number | null | undefined): (nom: string, equipes?: readonly [string, string]) => BoostType[] {
  const { saison } = useSeason();
  const lignes = useMemo(() => (j == null ? [] : saison.entries.filter((e) => e.j === j)), [saison.entries, j]);
  return useCallback(
    (nom: string, equipes?: readonly [string, string]) => {
      if (j == null || !lignes.length) return AUCUN;
      const t = titresDuJoueur(lignes, j, nom, equipes);
      return t.length ? t : AUCUN;
    },
    [lignes, j],
  );
}
