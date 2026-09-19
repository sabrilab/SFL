/**
 * Les matchs ouverts autour de l'utilisateur.
 *
 * `hote`, `prix` et `seuls` ne sont pas décoratifs : ce sont les trois questions
 * que se pose quelqu'un qui ne connaît personne et qui hésite à venir.
 */
import type { ImageSourcePropType } from 'react-native';

export type Jour = 'jour' | 'weekend' | 'semaine';

export interface Match {
  id: string;
  titre: string;
  heure: string;
  jour: Jour;
  lieu: string;
  loin: string;
  places: number;
  pris: number;
  niveau: string;
  sfl: boolean;
  photo: ImageSourcePropType;
  /** Position du pin sur le plan, en pourcentage de la zone. */
  x: number;
  y: number;
  hote: string;
  init: string;
  hoteNote: string;
  prix: string;
  prixNote: string;
  seuls: number;
  gens: string[];
}

export const PHOTOS = {
  soir: require('@/assets/terrains/soir.jpg') as ImageSourcePropType,
  dim: require('@/assets/terrains/dim.jpg') as ImageSourcePropType,
  sam: require('@/assets/terrains/sam.jpg') as ImageSourcePropType,
  indoor: require('@/assets/terrains/indoor.jpg') as ImageSourcePropType,
  mien: require('@/assets/terrains/mien.jpg') as ImageSourcePropType,
  ligue: require('@/assets/terrains/ligue.jpg') as ImageSourcePropType,
};

export const MATCHS_INITIAUX: Match[] = [
  {
    id: '1', titre: 'Ce soir', heure: '19h30', jour: 'jour',
    lieu: 'Playground Réaumur', loin: '600 m', places: 10, pris: 9,
    niveau: 'Confirmé', sfl: false, photo: PHOTOS.soir, x: 62, y: 36,
    hote: 'Karim B.', init: 'KB', hoteNote: '4,8 ★ · 31 matchs',
    prix: 'Gratuit', prixNote: 'terrain libre', seuls: 2,
    gens: ['YB', 'AM', 'KD', 'SF', 'IL', 'MR', 'ZA', 'NB', 'OT'],
  },
  {
    id: '2', titre: 'Dimanche', heure: '14h00', jour: 'weekend',
    lieu: 'City stade Jean-Moulin', loin: '1,2 km', places: 10, pris: 7,
    niveau: 'Tous niveaux', sfl: true, photo: PHOTOS.dim, x: 33, y: 28,
    hote: 'Sunday Five', init: 'SF', hoteNote: 'La ligue · 9 journées',
    prix: 'Gratuit', prixNote: 'pris en charge', seuls: 3,
    gens: ['IL', 'AN', 'KD', 'SD', 'SM', 'ZK', 'IB'],
  },
  {
    id: '3', titre: 'Samedi', heure: '11h00', jour: 'weekend',
    lieu: 'Complexe des Tilleuls', loin: '3,4 km', places: 10, pris: 5,
    niveau: 'Débutant bienvenu', sfl: false, photo: PHOTOS.sam, x: 20, y: 70,
    hote: 'Nadia M.', init: 'NM', hoteNote: '4,9 ★ · 12 matchs',
    prix: '4 €', prixNote: 'par joueur', seuls: 4,
    gens: ['MT', 'LP', 'GA', 'HC', 'YZ'],
  },
  {
    id: '4', titre: 'Mercredi', heure: '20h15', jour: 'semaine',
    lieu: 'Five Indoor Nord', loin: '2,1 km', places: 10, pris: 10,
    niveau: 'Confirmé', sfl: false, photo: PHOTOS.indoor, x: 76, y: 64,
    hote: 'Five Indoor', init: 'FI', hoteNote: 'Complexe partenaire',
    prix: '7 €', prixNote: 'par joueur', seuls: 0,
    gens: ['AB', 'CD', 'EF', 'GH', 'IJ', 'KL', 'MN', 'OP', 'QR', 'ST'],
  },
];

export const manque = (m: Match) => m.places - m.pris;
