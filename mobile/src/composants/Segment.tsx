/**
 * Le contrôle segmenté, dans le verre du système.
 *
 * On ne passe pas par `UISegmentedControl` : la barre doit être translucide sur
 * le noir de l'app, et un contrôle système impose sa propre matière. On en garde
 * la mécanique — un seul choix, la pastille claire qui glisse, le retour haptique.
 */
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, ESP } from '@/da/theme';
import { Verre } from './Verre';

export function Segment<T extends string>({
  valeur, onChange, choix,
}: {
  valeur: T;
  onChange: (v: T) => void;
  choix: { cle: T; nom: string }[];
}) {
  return (
    <Verre style={styles.barre}>
      <View style={styles.rangee} accessibilityRole="tablist">
        {choix.map(({ cle, nom }) => {
          const actif = cle === valeur;
          return (
            <Pressable
              key={cle}
              accessibilityRole="tab"
              accessibilityState={{ selected: actif }}
              onPress={() => { Haptics.selectionAsync(); onChange(cle); }}
              style={[styles.onglet, actif && styles.actif]}>
              <Text style={[styles.texte, actif && styles.texteActif]}>{nom}</Text>
            </Pressable>
          );
        })}
      </View>
    </Verre>
  );
}

const styles = StyleSheet.create({
  barre: { marginHorizontal: ESP.quatre, marginBottom: ESP.trois, borderRadius: 999 },
  rangee: { flexDirection: 'row', padding: 4, gap: 2 },
  onglet: { flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center' },
  actif: { backgroundColor: C.clair },
  texte: { fontSize: 13, fontWeight: '500', color: C.blanc34 },
  texteActif: { color: C.encre },
});
