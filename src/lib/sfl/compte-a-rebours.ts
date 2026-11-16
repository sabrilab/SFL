// Le compte à rebours du prix premiers joueurs de Bola Plus (Sabri,
// 16/11/2026 : « fais en sorte qu'il y ait un compte à rebours jusqu'à
// dimanche »). Lecture retenue et dite à Sabri : le prix premiers joueurs
// finit le dimanche 22/11/2026 à 23:59:59, heure de Paris (UTC+1 en
// novembre). Pour changer la fin, c'est FIN_PREMIERS_JOUEURS, et seulement
// elle : la page, la tuile de Ma carte, le bandeau et l'écran d'ouverture la
// lisent tous (bola-plus-rappels.tsx).
//
// Pur : ni React ni horloge (tools/bola-plus-check.ts).

/** La fin du prix premiers joueurs : dimanche 22/11/2026, 23:59:59 à Paris. */
export const FIN_PREMIERS_JOUEURS = Date.parse("2026-11-22T23:59:59+01:00");

export interface Reste {
  jours: number;
  heures: number;
  minutes: number;
  secondes: number;
  /** Le temps est écoulé : plus de compte à rebours. */
  fini: boolean;
  /** Moins de 24 h : le dernier jour. */
  dernierJour: boolean;
}

/** Ce qui reste jusqu'à `fin`, à la seconde (arrondi vers le bas : jamais une seconde de trop). */
export function resteAvant(fin: number, maintenant: number): Reste {
  const s = Math.max(0, Math.floor((fin - maintenant) / 1000));
  return {
    jours: Math.floor(s / 86400),
    heures: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    secondes: s % 60,
    fini: s === 0,
    dernierJour: s > 0 && s < 86400,
  };
}

const deux = (n: number) => String(n).padStart(2, "0");

/** En une ligne courte : « 6 j 07 h », puis « 07 h 32 min » le dernier jour, puis « 32 min 05 s » la dernière heure. */
export function resteCourt(r: Reste): string {
  if (r.fini) return "Terminé";
  if (r.jours > 0) return `${r.jours} j ${deux(r.heures)} h`;
  if (r.heures > 0) return `${deux(r.heures)} h ${deux(r.minutes)} min`;
  return `${deux(r.minutes)} min ${deux(r.secondes)} s`;
}

/** Les quatre cases du grand compte à rebours : jours, heures, minutes, secondes. */
export function casesDe(r: Reste): { valeur: string; unite: string }[] {
  return [
    { valeur: deux(r.jours), unite: "jours" },
    { valeur: deux(r.heures), unite: "h" },
    { valeur: deux(r.minutes), unite: "min" },
    { valeur: deux(r.secondes), unite: "s" },
  ];
}

/** Le jour d'ouverture à afficher : « dimanche 23:59 ». */
export const FIN_LISIBLE = "dimanche 23:59";
