/**
 * Les données de la ligue.
 *
 * ATTENTION — chiffres de démonstration. Seuls ceux d'Ilyes viennent de la vraie
 * saison (77 pp, 3e, 30 buts, 13 passes) ; les autres joueurs sont plausibles mais
 * inventés, le temps de brancher la saison publiée.
 */
export const MOI = 'Ilyes';

export interface Palmares {
  titre: string;
  precision: string;
  rangs: { nom: string; valeur: number }[];
}

export const CLASSEMENTS: Palmares[] = [
  {
    titre: 'Points PP', precision: 'classement général',
    rangs: [
      { nom: 'Kader', valeur: 92 }, { nom: 'Naim', valeur: 84 }, { nom: 'Ilyes', valeur: 77 },
      { nom: 'Bensou', valeur: 71 }, { nom: 'Sabri', valeur: 66 }, { nom: 'Anis', valeur: 61 },
    ],
  },
  {
    titre: 'Buteurs', precision: 'buts marqués',
    rangs: [
      { nom: 'Ilyes', valeur: 30 }, { nom: 'Kader', valeur: 24 }, { nom: 'Bensou', valeur: 19 },
      { nom: 'Naim', valeur: 17 }, { nom: 'Anis', valeur: 12 },
    ],
  },
  {
    titre: 'Passeurs', precision: 'passes décisives',
    rangs: [
      { nom: 'Ilies', valeur: 21 }, { nom: 'Ilyes', valeur: 13 }, { nom: 'Kader', valeur: 12 },
      { nom: 'Sabri', valeur: 11 }, { nom: 'Naim', valeur: 9 },
    ],
  },
  {
    titre: 'Homme du match', precision: 'élections',
    rangs: [
      { nom: 'Kader', valeur: 4 }, { nom: 'Naim', valeur: 2 },
      { nom: 'Ilyes', valeur: 2 }, { nom: 'Bensou', valeur: 1 },
    ],
  },
  {
    titre: 'Assiduité', precision: 'présences sur 9',
    rangs: [
      { nom: 'Sabri', valeur: 9 }, { nom: 'Kader', valeur: 9 }, { nom: 'Ilyes', valeur: 8 },
      { nom: 'Naim', valeur: 8 }, { nom: 'Bensou', valeur: 7 },
    ],
  },
];

export interface Journee { n: number; date: string; score: string; pp: number }

export const JOURNEES: Journee[] = [
  { n: 9, date: '6 sept.', score: 'Orange 7 — 5 Bleu', pp: 11 },
  { n: 8, date: '30 août', score: 'Noir 4 — 6 Blanc', pp: 7 },
  { n: 7, date: '23 août', score: 'Orange 9 — 3 Bleu', pp: 13 },
  { n: 6, date: '16 août', score: 'Blanc 5 — 5 Noir', pp: 6 },
  { n: 5, date: '9 août', score: 'Bleu 8 — 4 Orange', pp: 9 },
  { n: 4, date: '2 août', score: 'Orange 6 — 6 Noir', pp: 8 },
  { n: 3, date: '26 juil.', score: 'Blanc 7 — 4 Bleu', pp: 5 },
  { n: 2, date: '19 juil.', score: 'Noir 5 — 8 Orange', pp: 10 },
  { n: 1, date: '12 juil.', score: 'Bleu 6 — 3 Blanc', pp: 8 },
];

export const STATS_JOUEUR = [
  { cle: 'VIT', nom: 'Vitesse, vivacité', valeur: 78 },
  { cle: 'TIR', nom: 'Finition', valeur: 71 },
  { cle: 'PAS', nom: 'Passe', valeur: 74 },
  { cle: 'DRI', nom: 'Conduite de balle', valeur: 76 },
  { cle: 'DÉF', nom: 'Défense', valeur: 68 },
  { cle: 'PHY', nom: 'Endurance', valeur: 77 },
];

/** La convocation de la prochaine journée. */
export const CONVOCATION = {
  journee: 10,
  jour: 'Dimanche',
  heure: '14h00',
  lieu: 'City stade Jean-Moulin',
  total: 12,
  presents: ['KD', 'NA', 'BS', 'SB', 'AN'],
  absents: ['MK'],
};
