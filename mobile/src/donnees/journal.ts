/**
 * Le journal de la ligue — chaque dimanche raconté à partir de ses chiffres.
 *
 * Repris de la version web : la manchette se déduit du fait le plus marquant,
 * sans jamais l'inventer. Deux lectures de la même journée donnent le même titre.
 */
export interface LigneJournee {
  joueur: string;
  equipe: string;
  buts: number;
  passes: number;
  pp: number;
  mvp?: boolean;
  cleanSheet?: boolean;
}

export interface JourneeJournal {
  n: number;
  date: string;
  equipes: [{ nom: string; score: number }, { nom: string; score: number }];
  presents: number;
  lignes: LigneJournee[];
  /** Ce qui s'est passé d'autre, en une phrase chacun. */
  faits: string[];
}

export function totalButs(j: JourneeJournal) {
  return j.equipes[0].score + j.equipes[1].score;
}

export function scoreLisible(j: JourneeJournal) {
  const [a, b] = j.equipes;
  return `${a.nom} ${a.score} — ${b.score} ${b.nom}`;
}

const pl = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** La manchette : le fait le plus marquant, formulé sans jamais l'inventer. */
export function manchette(j: JourneeJournal, record: boolean) {
  const best = [...j.lignes].sort((a, b) => b.buts * 2 + b.passes - (a.buts * 2 + a.passes))[0];
  if (!best) return { titre: 'DIMANCHE BLANC', chapeau: 'Aucune feuille de match ce jour-là.' };
  const nom = best.joueur.toUpperCase();
  const total = totalButs(j);

  if (record) {
    return {
      titre: `${total} BUTS, ET UN RECORD`,
      chapeau: `Jamais un dimanche n'avait tant marqué. ${best.joueur} termine la journée avec ${pl(best.buts, 'but')} et ${pl(best.passes, 'passe')}.`,
    };
  }
  if (best.buts >= 5) {
    const meilleur = Math.max(...j.lignes.map((l) => l.buts));
    const seul = j.lignes.filter((l) => l.buts === meilleur).length === 1;
    return {
      titre: `${nom} EN FEU`,
      chapeau: best.buts === meilleur && seul
        ? `${best.buts} buts dans la journée, et personne n'a fait mieux.`
        : `${best.buts} buts dans la journée, ${pl(best.passes, 'passe')} en prime.`,
    };
  }
  if (best.passes > best.buts) {
    return {
      titre: `${nom} DISTRIBUE`,
      chapeau: `${pl(best.passes, 'passe décisive')} : la journée est passée par lui avant d'aller au fond.`,
    };
  }
  return {
    titre: `${nom} FAIT LA LOI`,
    chapeau: `${pl(best.buts, 'but')}, ${pl(best.passes, 'passe')}, ${best.pp} points Pépite. La journée porte sa signature.`,
  };
}

export function meilleurs(j: JourneeJournal) {
  const par = (k: keyof LigneJournee) => [...j.lignes].sort((a, b) => Number(b[k]) - Number(a[k]))[0];
  return {
    buteur: par('buts'),
    passeur: par('passes'),
    mvp: j.lignes.find((l) => l.mvp),
    topPP: [...j.lignes].sort((a, b) => b.pp - a.pp).slice(0, 3),
    cleanSheet: j.lignes.filter((l) => l.cleanSheet).map((l) => l.joueur),
  };
}

/**
 * Chiffres de démonstration, cohérents avec les classements affichés : les
 * totaux d'Ilyes (30 buts, 13 passes, 77 pp) sont ceux de la vraie saison, les
 * autres joueurs sont plausibles mais inventés.
 */
const L = (joueur: string, equipe: string, buts: number, passes: number, pp: number,
  extra: Partial<LigneJournee> = {}): LigneJournee => ({ joueur, equipe, buts, passes, pp, ...extra });

export const JOURNAL: JourneeJournal[] = [
  {
    n: 9, date: '6 septembre', equipes: [{ nom: 'Orange', score: 7 }, { nom: 'Bleu', score: 5 }], presents: 12,
    lignes: [
      L('Ilyes', 'Orange', 4, 2, 11), L('Kader', 'Orange', 2, 3, 10, { mvp: true }), L('Ilies', 'Bleu', 1, 3, 6),
      L('Naim', 'Bleu', 2, 0, 4), L('Bensou', 'Orange', 1, 1, 6), L('Sabri', 'Orange', 0, 0, 4),
      L('Anis', 'Bleu', 2, 1, 5), L('Yacine', 'Bleu', 0, 1, 3),
    ],
    faits: ['Record de la saison : 12 buts dans la journée.', 'Sabri encaisse cinq buts et garde le sourire.'],
  },
  {
    n: 8, date: '30 août', equipes: [{ nom: 'Noir', score: 4 }, { nom: 'Blanc', score: 6 }], presents: 11,
    lignes: [
      L('Bensou', 'Blanc', 3, 1, 9, { mvp: true }), L('Ilyes', 'Noir', 3, 0, 7), L('Kader', 'Blanc', 1, 2, 7),
      L('Naim', 'Blanc', 1, 1, 6), L('Ilies', 'Noir', 0, 3, 5), L('Sabri', 'Blanc', 0, 0, 4),
    ],
    faits: ['Bensou reste le premier de la ligue.', 'Retour de Naim après deux dimanches d\'absence.'],
  },
  {
    n: 7, date: '23 août', equipes: [{ nom: 'Orange', score: 9 }, { nom: 'Bleu', score: 3 }], presents: 10,
    lignes: [
      L('Ilyes', 'Orange', 5, 1, 13, { mvp: true }), L('Kader', 'Orange', 2, 3, 9), L('Anis', 'Orange', 1, 2, 6),
      L('Ilies', 'Bleu', 2, 0, 3), L('Naim', 'Bleu', 1, 0, 2), L('Sabri', 'Orange', 0, 0, 4),
    ],
    faits: ['Cinq buts pour Ilyes : le meilleur total individuel de la saison.'],
  },
  {
    n: 6, date: '16 août', equipes: [{ nom: 'Blanc', score: 5 }, { nom: 'Noir', score: 5 }], presents: 12,
    lignes: [
      L('Naim', 'Noir', 2, 1, 6, { mvp: true }), L('Ilyes', 'Blanc', 2, 1, 6), L('Kader', 'Blanc', 1, 2, 5),
      L('Bensou', 'Noir', 2, 0, 4), L('Ilies', 'Blanc', 0, 2, 3), L('Sabri', 'Noir', 0, 0, 2),
    ],
    faits: ['Un nul, le seul de la saison.'],
  },
  {
    n: 5, date: '9 août', equipes: [{ nom: 'Bleu', score: 8 }, { nom: 'Orange', score: 4 }], presents: 11,
    lignes: [
      L('Kader', 'Bleu', 3, 2, 10, { mvp: true }), L('Bensou', 'Bleu', 3, 1, 9), L('Ilyes', 'Orange', 3, 0, 5),
      L('Ilies', 'Bleu', 1, 3, 7), L('Naim', 'Orange', 1, 1, 3), L('Sabri', 'Bleu', 0, 0, 6, { cleanSheet: false }),
    ],
    faits: ['Kader et Bensou, six buts à eux deux.'],
  },
  {
    n: 4, date: '2 août', equipes: [{ nom: 'Orange', score: 6 }, { nom: 'Noir', score: 6 }], presents: 10,
    lignes: [
      L('Ilyes', 'Orange', 3, 2, 8), L('Naim', 'Noir', 2, 1, 5), L('Kader', 'Noir', 2, 2, 6, { mvp: true }),
      L('Ilies', 'Orange', 1, 3, 6), L('Sabri', 'Noir', 0, 0, 2),
    ],
    faits: ['Deuxième nul de rang pour Orange.'],
  },
  {
    n: 3, date: '26 juillet', equipes: [{ nom: 'Blanc', score: 7 }, { nom: 'Bleu', score: 4 }], presents: 12,
    lignes: [
      L('Kader', 'Blanc', 3, 1, 8, { mvp: true }), L('Ilyes', 'Bleu', 3, 1, 5), L('Bensou', 'Blanc', 2, 2, 7),
      L('Ilies', 'Blanc', 1, 4, 8), L('Naim', 'Bleu', 1, 0, 2), L('Sabri', 'Blanc', 0, 0, 4),
    ],
    faits: ['Quatre passes pour Ilies, le record de passes sur une journée.'],
  },
  {
    n: 2, date: '19 juillet', equipes: [{ nom: 'Noir', score: 4 }, { nom: 'Orange', score: 7 }], presents: 11,
    lignes: [
      L('Ilyes', 'Orange', 4, 1, 10, { mvp: true }), L('Bensou', 'Orange', 2, 2, 7), L('Kader', 'Noir', 3, 1, 5),
      L('Ilies', 'Noir', 1, 2, 4), L('Naim', 'Orange', 1, 1, 5), L('Sabri', 'Noir', 0, 0, 1),
    ],
    faits: [],
  },
  {
    n: 1, date: '12 juillet', equipes: [{ nom: 'Bleu', score: 6 }, { nom: 'Blanc', score: 3 }], presents: 10,
    lignes: [
      L('Ilyes', 'Bleu', 3, 2, 8, { mvp: true }), L('Kader', 'Bleu', 2, 1, 6), L('Naim', 'Blanc', 2, 0, 3),
      L('Ilies', 'Blanc', 1, 1, 3), L('Bensou', 'Bleu', 1, 2, 6), L('Sabri', 'Bleu', 0, 0, 4, { cleanSheet: false }),
    ],
    faits: ['Premier dimanche de la saison.'],
  },
];

/** Le record de buts sur une journée, pour savoir quand titrer dessus. */
export const RECORD_BUTS = Math.max(...JOURNAL.map(totalButs));
