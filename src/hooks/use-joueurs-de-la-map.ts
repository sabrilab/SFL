"use client";

// Les joueurs que la Map montre, ville par ville (Sabri, 02/11/2026 : « aucun
// joueur n'est visible alors que je voudrais qu'on puisse les voir sur la map
// comme si on était dans la SFL, alors qu'ils sont trouvables dans
// Recherche »).
//
// Tout le monde voit tout le monde : les joueurs de la saison SFL (la liste
// publique, sans les masqués), puis les comptes de Bola qui n'y sont pas
// (les mêmes que la Recherche, listerProfils), chacun avec la carte que
// montrent la Recherche et le classement de Bola : base 75 (carteNeutre).
// Le joueur Bola connecté garde la sienne (allPlayers, carte-bola.ts).
//
// Les comptes sont lus une fois par ouverture de l'app et gardés en mémoire :
// la Map, la pile, le catalogue et le profil lisent la même liste.

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useSeason } from "@/components/sfl/season-provider";
import { carteNeutre } from "@/lib/sfl/carte-neutre";
import { isHidden } from "@/lib/sfl/hidden";
import { listerProfils, type Profil } from "@/lib/sfl/matchs";
import type { Player } from "@/lib/sfl/engine";

const AUCUN: Profil[] = [];
let profils: Profil[] = AUCUN;
let lu = false;
let enVol: Promise<void> | null = null;
const abonnes = new Set<() => void>();

function lire() {
  if (lu || enVol) return;
  enVol = listerProfils()
    .then((p) => {
      profils = p.filter((x) => !isHidden(x.name));
      lu = true;
      for (const f of abonnes) f();
    })
    .catch(() => {})
    .finally(() => {
      enVol = null;
    });
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

/** Les joueurs de la Map : la saison, puis les comptes de Bola hors saison. */
export function useJoueursDeLaMap(): Player[] {
  const { players, allPlayers } = useSeason();
  const comptes = useSyncExternalStore(
    abonner,
    () => profils,
    () => AUCUN
  );
  useEffect(lire, []);
  return useMemo(() => {
    const vus = new Set(players.map((p) => p.name.toLowerCase()));
    const out = [...players];
    for (const c of comptes) {
      const cle = c.name.toLowerCase();
      if (vus.has(cle)) continue;
      // Dans la saison mais masqué : la liste publique ne le montre pas, la Map non plus.
      const saison = allPlayers.find((p) => p.name.toLowerCase() === cle);
      if (saison && isHidden(saison.name)) continue;
      vus.add(cle);
      out.push(saison ?? carteNeutre(c.name));
    }
    return out;
  }, [players, allPlayers, comptes]);
}
