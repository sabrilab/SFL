// Bola Club : le marqueur de la première visite. Posé quand /club s'ouvre
// sur ce téléphone (club/pastille-demo.tsx) : à partir de là, le menu des
// ligues montre le club (hooks/use-club-menu.ts). Tant qu'il n'y est pas,
// l'app de l'aperçu est celle de la production. Hors du drapeau (en
// production), il n'est ni lu ni posé. Ce fichier ne tire rien du club (ni
// la démo, ni le moteur des cartes) : le menu des Actus de tous les joueurs
// le charge, il doit rester léger.

import { BOLA_CLUB, MARQUEUR_CLUB } from "./drapeau";

const ecoutes = new Set<() => void>();

export function ecouterMarqueur(f: () => void) {
  ecoutes.add(f);
  return () => {
    ecoutes.delete(f);
  };
}

export function clubOuvert(): boolean {
  if (!BOLA_CLUB || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MARQUEUR_CLUB) !== null;
  } catch {
    return false;
  }
}

export function marquerClubOuvert() {
  if (!BOLA_CLUB) return;
  try {
    if (localStorage.getItem(MARQUEUR_CLUB) === null) localStorage.setItem(MARQUEUR_CLUB, new Date().toISOString());
  } catch {}
  ecoutes.forEach((f) => f());
}
