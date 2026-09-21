/**
 * Les joueurs et leur carte.
 *
 * La carte est le badge social de l'app : elle rend visible ce qu'un joueur
 * a mis dans la ligue en temps et en effort. Un seul accent coloré par carte,
 * six critères toujours dans le même ordre, et une photo standardisée — ou
 * pas encore de photo : c'est un état normal, celui de tout nouvel inscrit,
 * et la face le montre proprement au lieu de casser.
 */
export interface StatCarte {
  cle: string;
  valeur: number;
}

export interface CarteJoueur {
  id: string;
  nom: string;
  pseudo: string;
  club: string;
  poste: string;
  note: number;
  /** Numéro en filigrane. Reprend la note s'il manque. */
  numero?: number;
  /** Mention optionnelle au-dessus du nom : « Meilleur buteur »… */
  mention?: string;
  /** L'unique couleur de la carte. Claire et désaturée : elle tombe sur une photo. */
  accent: string;
  /** Portrait standardisé (asset Metro), ou null tant que le joueur n'a pas créé sa photo. */
  photo: number | null;
  stats: [StatCarte, StatCarte, StatCarte, StatCarte, StatCarte, StatCarte];
}

const six = (v: number[]): CarteJoueur['stats'] => [
  { cle: 'VIT', valeur: v[0] }, { cle: 'TIR', valeur: v[1] }, { cle: 'PAS', valeur: v[2] },
  { cle: 'DRI', valeur: v[3] }, { cle: 'DEF', valeur: v[4] }, { cle: 'PHY', valeur: v[5] },
];

export const JOUEURS: Record<string, CarteJoueur> = {
  ilyes: {
    id: 'ilyes', nom: 'ILYES', pseudo: '@ilyes', club: 'SUNDAY FIVE', poste: 'ATTAQUANT',
    note: 74, numero: 9, mention: 'MEILLEUR BUTEUR', accent: '#A9CDFF',
    photo: null,
    stats: six([78, 71, 74, 76, 68, 77]),
  },
  yacine: {
    id: 'yacine', nom: 'YACINE', pseudo: '@yacine', club: 'SUNDAY FIVE', poste: 'MILIEU',
    note: 79, numero: 8, accent: '#F2C9A0',
    photo: require('@/assets/portraits/yacine.png') as number,
    stats: six([80, 74, 83, 79, 72, 81]),
  },
  kader: {
    id: 'kader', nom: 'KADER', pseudo: '@kader', club: 'SUNDAY FIVE', poste: 'MILIEU OFF.',
    note: 82, numero: 10, mention: 'HOMME DU MATCH ×4', accent: '#BFE8C9',
    photo: null,
    stats: six([84, 81, 86, 83, 61, 78]),
  },
  naim: {
    id: 'naim', nom: 'NAIM', pseudo: '@naim', club: 'SUNDAY FIVE', poste: 'DÉFENSEUR',
    note: 77, numero: 4, accent: '#D9C7F5',
    photo: null,
    stats: six([72, 66, 75, 70, 86, 84]),
  },
  bensou: {
    id: 'bensou', nom: 'BENSOU', pseudo: '@bensou', club: 'SUNDAY FIVE', poste: 'AILIER',
    note: 75, numero: 11, accent: '#FFD1B8',
    photo: null,
    stats: six([88, 76, 70, 82, 55, 74]),
  },
  sabri: {
    id: 'sabri', nom: 'SABRI', pseudo: '@sabri', club: 'SUNDAY FIVE', poste: 'GARDIEN',
    note: 73, numero: 1, mention: 'ASSIDUITÉ 9/9', accent: '#C9E4F5',
    photo: null,
    stats: six([64, 52, 71, 60, 88, 79]),
  },
};

/** L'identité de l'utilisateur de démonstration. */
export const MOI_ID = 'ilyes';

/** Les joueurs présents sur un match, dans l'ordre d'inscription. */
export const ROSTER_DEMO = ['yacine', 'kader', 'naim', 'bensou', 'sabri'];
