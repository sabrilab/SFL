/**
 * Les trois voix typographiques de la DA : le titre (Archivo, serré, énorme),
 * le libellé mono en capitales espacées, et le texte courant, laissé au système
 * pour rester chez lui sur chaque plateforme.
 */
import { Text, type TextProps, type TextStyle } from 'react-native';

import { C, P } from '@/da/theme';

type Voix = { style?: TextStyle | TextStyle[] } & TextProps;

export function Titre({ style, ...p }: Voix & { lourd?: boolean }) {
  return (
    <Text
      {...p}
      style={[
        { fontFamily: p.lourd ? P.titreLourd : P.titre, color: C.blanc, letterSpacing: -0.8 },
        style,
      ]}
    />
  );
}

export function Libelle({ style, ...p }: Voix) {
  return (
    <Text
      {...p}
      style={[
        { fontFamily: P.mono, fontSize: 10, letterSpacing: 1.6, color: C.blanc34 },
        style,
      ]}
    />
  );
}

export function Corps({ style, ...p }: Voix) {
  return <Text {...p} style={[{ fontSize: 14, color: C.blanc60 }, style]} />;
}
