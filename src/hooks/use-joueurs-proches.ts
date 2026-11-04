"use client";

// Les joueurs les plus proches d'un joueur (relifting du premier jour,
// Sabri, 02/11/2026) : ceux de la Map (la saison et les comptes de Bola,
// useJoueursDeLaMap), chacun à sa ville (donnée, sinon tirée de son nom,
// villeOuLigue), du plus près au plus loin, ceux qui ont une photo d'abord à
// distance égale. Lus par « Ton premier match » (Actus) et par le tiroir de
// la Map, qui comptent les mêmes joueurs.

import { useMemo } from "react";
import { useJoueursDeLaMap } from "@/hooks/use-joueurs-de-la-map";
import { useVillesRevision } from "@/hooks/use-villes";
import { usePhotoRevision } from "@/hooks/use-player-photo";
import { maVille, villeOuLigue } from "@/lib/sfl/villes";
import { photoPerso } from "@/lib/sfl/photos";
import type { Player } from "@/lib/sfl/engine";

/** Distance en km entre deux points (haversine). */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(d));
}

export interface Proche {
  p: Player;
  /** En km, depuis le centre donné, sinon la ville du joueur. */
  d: number;
}

/** Les `n` joueurs les plus proches de `moi` (ou du `centre`), sans lui. */
export function useJoueursProches(moi: string | null | undefined, centre?: { lat: number; lng: number } | null, n = 12): Proche[] {
  const joueurs = useJoueursDeLaMap();
  const revVilles = useVillesRevision();
  const revPhotos = usePhotoRevision();
  const lat = centre?.lat;
  const lng = centre?.lng;
  return useMemo(() => {
    void revVilles;
    void revPhotos;
    const ici = lat != null && lng != null ? { lat, lng } : moi ? (maVille(moi) ?? villeOuLigue(moi)) : null;
    if (!ici) return [];
    return joueurs
      .filter((p) => p.name !== moi)
      .map((p) => {
        const v = villeOuLigue(p.name);
        return v ? { p, d: km(ici, v) } : null;
      })
      .filter((x) => x !== null)
      .sort((a, b) => a.d - b.d || (photoPerso(b.p.name) ? 1 : 0) - (photoPerso(a.p.name) ? 1 : 0))
      .slice(0, n);
  }, [joueurs, moi, lat, lng, n, revVilles, revPhotos]);
}
