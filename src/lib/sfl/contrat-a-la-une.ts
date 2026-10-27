// Le contrat à la une des Actus. Sabri, 27/10 : « Tu mets pas les missions.
// Tu mets juste des missions de rang S. Une fois de temps en temps, qu'elles
// soient acceptées par de bons joueurs, faut vraiment que ce soit marketé
// correctement. On veut pas voir les missions de tout le monde. » Toutes les
// missions, les miennes et celles des autres, vivent dans Ma carte → Niveau
// XP (mode-passe.tsx, onglets Missions et Les autres).
//
// La règle, sans rien stocker :
//   · un contrat (le créneau « contrat », face-à-face compris) de rang S,
//     accepté pour le dimanche qui vient ;
//   · signé par un bon joueur : dans les TETE_PEPITE premiers de la Pépite
//     d'Or avant ce dimanche (au moins un point), ou rang S à l'XP à vie
//     (les 10 % de tête, rangsDesJoueurs) ;
//   · un seul : le mieux placé à la Pépite d'Or, puis la plus grosse prime,
//     puis le nom (le même pour tout le monde) ;
//   · seulement le vendredi et le samedi, à Paris (course.tsx,
//     veilleDuMatch) : la veille du match, et pas tous les dimanches, puisque
//     les bons joueurs ne signent pas un rang S chaque semaine.
// Pur : testable sans React (le composant : actus/contrat-a-la-une.tsx).

import { rangDe, type Engagement, type Rang } from "./missions";

/** Les places de tête de la Pépite d'Or qui font un bon joueur. */
export const TETE_PEPITE = 5;

export interface ContratDeLaUne {
  e: Engagement;
  /** Sa place à la Pépite d'Or avant ce dimanche (ex aequo à la même place) ; null sans point. */
  place: number | null;
  /** Ceux qui ont des points avant ce dimanche. */
  sur: number;
  /** Rang S à l'XP à vie. */
  rangS: boolean;
}

/** La place de chacun à la Pépite d'Or, d'après ses points avant le dimanche ; sans point, pas de place. */
export function placesPepite(avant: Map<string, number>): Map<string, number> {
  const liste = [...avant].filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const out = new Map<string, number>();
  let place = 0;
  liste.forEach(([nom, p], i) => {
    if (i === 0 || p !== liste[i - 1][1]) place = i + 1;
    out.set(nom, place);
  });
  return out;
}

/** Le contrat de rang S à mettre à la une, ou null : aucun bon joueur n'en a signé. */
export function contratALaUne(
  engagements: Engagement[],
  avant: Map<string, number>,
  rangXp: (nom: string) => Rang | null
): ContratDeLaUne | null {
  const places = placesPepite(avant);
  const candidats: ContratDeLaUne[] = [];
  for (const e of engagements) {
    if (e.m.creneau !== "contrat" || rangDe(e.m) !== "S") continue;
    const place = places.get(e.joueur) ?? null;
    const rangS = rangXp(e.joueur) === "S";
    if (!rangS && (place == null || place > TETE_PEPITE)) continue;
    candidats.push({ e, place, sur: places.size, rangS });
  }
  candidats.sort(
    (a, b) =>
      (a.place ?? Infinity) - (b.place ?? Infinity) || b.e.m.xp - a.e.m.xp || a.e.joueur.localeCompare(b.e.joueur)
  );
  return candidats[0] ?? null;
}
