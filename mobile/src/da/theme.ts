/**
 * La direction artistique, en un seul endroit.
 *
 * Noir profond, neutres purs, une seule couleur chaude — la braise — réservée
 * au manque (« il manque 3 »). Les surfaces claires portent tout ce qui se lit
 * vraiment : une fiche de match, un formulaire. Le verre ne sert que de chrome.
 */
import { Platform } from 'react-native';

export const C = {
  noir: '#08090B',
  noir2: '#0D0F12',
  noir3: '#14171B',

  clair: '#EFEFEC',
  clair2: '#E2E2DE',
  encre: '#0A0B0D',
  encre60: 'rgba(10,11,13,0.58)',
  encre42: 'rgba(10,11,13,0.42)',
  encre10: 'rgba(10,11,13,0.10)',
  encre06: 'rgba(10,11,13,0.06)',

  blanc: '#F4F5F2',
  blanc60: 'rgba(244,245,242,0.60)',
  blanc34: 'rgba(244,245,242,0.34)',
  blanc12: 'rgba(244,245,242,0.12)',
  blanc06: 'rgba(244,245,242,0.06)',

  braise: '#FF8A4C',
  braise18: 'rgba(255,138,76,0.18)',
  braiseEncre: '#A2451A',

  /** Le verre, quand le système ne sait pas le faire lui-même. */
  verre: 'rgba(14,17,21,0.72)',
  verreBord: 'rgba(255,255,255,0.15)',
} as const;

export const P = {
  titre: 'Archivo_700Bold',
  titreLourd: 'Archivo_800ExtraBold',
  mono: 'DMMono_400Regular',
  monoMoyen: 'DMMono_500Medium',
  /** Le texte courant reste celui du système : SF Pro sur iOS, Roboto sur Android. */
  texte: Platform.select({ ios: 'System', default: undefined }),
} as const;

export const R = { tuile: 28, feuille: 34, capsule: 999, carte: 22 } as const;

export const ESP = { un: 4, deux: 8, trois: 12, quatre: 16, cinq: 22, six: 30 } as const;
