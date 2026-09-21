/**
 * Le verre.
 *
 * Sur iOS 26, `GlassView` est le vrai `UIGlassEffect` du système : il réfracte,
 * il réagit au contenu qui défile dessous, et il suit les réglages
 * d'accessibilité de l'utilisateur. Partout ailleurs — Android, iOS plus ancien —
 * on retombe sur une surface teintée bordée d'un liseré clair. Ce n'est pas le
 * même effet, mais c'est la même hiérarchie : une capsule posée sur le contenu.
 */
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { C } from '@/da/theme';

export const VERRE_NATIF = isLiquidGlassAvailable();

export function Verre({
  children,
  style,
  rayon = 999,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  rayon?: number;
}) {
  if (VERRE_NATIF) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        style={[{ borderRadius: rayon, overflow: 'hidden' }, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View
      style={[
        styles.repli,
        { borderRadius: rayon, borderWidth: StyleSheet.hairlineWidth * 2 },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  repli: {
    backgroundColor: C.verre,
    borderColor: C.verreBord,
    overflow: 'hidden',
    // Le navigateur sait flouter ce qu'il y a derrière : autant s'en servir,
    // c'est ce qui rapproche le plus l'aperçu web du verre du système.
    ...Platform.select({
      web: { backdropFilter: 'blur(24px) saturate(160%)' } as ViewStyle,
      default: {},
    }),
  },
});
