// Des matchs Bola de démonstration pour la Ligue vierge, en aperçu et en
// développement seulement (comme les villes de démo de la Map, villes.ts) :
// tant que personne n'a saisi de feuille, l'aperçu montre la page remplie.
// Jamais en production.

import type { MatchBola } from "@/lib/sfl/ligue-vierge";
import type { Partie } from "@/lib/sfl/matchs";

export const DEMO_LIGUE_VIERGE = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

// Un tirage fixe : la même page à chaque rechargement.
function tirage(graine: number) {
  let x = graine;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

const HEURES = ["18h30", "19h00", "20h00", "21h00", "12h30"];

export function demoMatchs(noms: string[], aujourdhui: string): MatchBola[] {
  if (noms.length < 8) return [];
  const r = tirage(7);
  const [a, m, d] = aujourdhui.split("-").map(Number);
  return Array.from({ length: 7 }, (_, k) => {
    const jour = new Date(Date.UTC(a, m - 1, d - 1 - k * 2)).toISOString().slice(0, 10);
    const n = 8 + Math.floor(r() * 3) * 2; // 4c4 à 6c6
    const debut = Math.floor(r() * noms.length);
    const joueurs = Array.from({ length: n }, (_, i) => {
      const name = noms[(debut + i * 3) % noms.length];
      return { id: `demo-${name}`, name, equipe: (i % 2 === 0 ? "clairs" : "fonces") as "clairs" | "fonces", buts: 0, passes: 0 };
    }).filter((j, i, t) => t.findIndex((x) => x.id === j.id) === i);
    const score = { clairs: 0, fonces: 0 };
    const buts = 4 + Math.floor(r() * 9);
    for (let b = 0; b < buts; b++) {
      const j = joueurs[Math.floor(r() * joueurs.length)];
      j.buts += 1;
      score[j.equipe] += 1;
      if (r() < 0.6) {
        const coequipiers = joueurs.filter((x) => x.equipe === j.equipe && x !== j);
        if (coequipiers.length) coequipiers[Math.floor(r() * coequipiers.length)].passes += 1;
      }
    }
    return { id: -1 - k, jour, heure: HEURES[k % HEURES.length], genre: "match", scoreClairs: score.clairs, scoreFonces: score.fonces, joueurs };
  });
}

/** Une feuille à tenir, pour voir la saisie en aperçu (rien n'est envoyé). */
export function demoFeuille(noms: string[], aujourdhui: string, moi: string): Partie | null {
  if (noms.length < 10) return null;
  return {
    id: -100,
    organisateurId: moi,
    organisateur: noms[0],
    visibilite: "public",
    jour: aujourdhui,
    heure: "00h00",
    lieu: "Five Lille Sud",
    adresse: null,
    lat: null,
    lng: null,
    places: 10,
    joueurs: noms.slice(0, 10).map((name, i) => ({
      id: `demo-${name}`,
      name,
      statut: i < 9 ? "inscrit" : "invite",
      equipe: null,
      buts: 0,
      passes: 0,
    })),
    scoreClairs: null,
    scoreFonces: null,
    saisiLe: null,
  };
}
