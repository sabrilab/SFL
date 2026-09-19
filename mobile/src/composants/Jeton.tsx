/**
 * La capsule posée sur une photo. Trois tons seulement : neutre, braise quand
 * il manque du monde, clair quand on y est — l'état qui doit sauter aux yeux.
 */
import { StyleSheet, Text, View } from 'react-native';

import { C } from '@/da/theme';
import { Verre } from './Verre';

export type TonJeton = 'neutre' | 'manque' | 'dedans' | 'complet';

export function Jeton({ children, ton = 'neutre' }: { children: string; ton?: TonJeton }) {
  if (ton === 'dedans') {
    return (
      <View style={[styles.base, styles.plein]}>
        <Text style={[styles.texte, { color: C.encre }]}>{children}</Text>
      </View>
    );
  }
  return (
    <Verre style={styles.base}>
      <Text
        style={[
          styles.texte,
          ton === 'manque' && { color: C.braise },
          ton === 'complet' && { color: 'rgba(255,255,255,0.5)' },
        ]}>
        {children}
      </Text>
    </Verre>
  );
}

const styles = StyleSheet.create({
  base: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, alignSelf: 'flex-start' },
  plein: { backgroundColor: C.clair },
  texte: { fontSize: 11.5, fontWeight: '500', color: 'rgba(255,255,255,0.92)' },
});
