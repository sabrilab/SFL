/**
 * Les filtres. Une rangée de capsules qui défile : on choisit quand on joue
 * avant de choisir où — c'est l'ordre dans lequel les gens y pensent.
 */
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { C, ESP } from '@/da/theme';

export type Filtre = 'tout' | 'jour' | 'weekend' | 'libre' | 'debutant';

const CHOIX: { cle: Filtre; nom: string }[] = [
  { cle: 'tout', nom: 'Tous' },
  { cle: 'jour', nom: "Aujourd'hui" },
  { cle: 'weekend', nom: 'Ce week-end' },
  { cle: 'libre', nom: 'Places libres' },
  { cle: 'debutant', nom: 'Débutant ok' },
];

export function Filtres({
  valeur, onChange,
}: { valeur: Filtre; onChange: (f: Filtre) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rangee}>
      {CHOIX.map(({ cle, nom }) => {
        const actif = cle === valeur;
        return (
          <Pressable
            key={cle}
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            onPress={() => { Haptics.selectionAsync(); onChange(cle); }}
            style={[styles.puce, actif && styles.active]}>
            <Text style={[styles.texte, actif && styles.texteActif]}>{nom}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rangee: { gap: 6, paddingVertical: ESP.un },
  puce: {
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2, borderColor: C.blanc12,
    backgroundColor: C.blanc06,
  },
  active: { backgroundColor: C.clair, borderColor: C.clair },
  texte: { fontSize: 12.5, fontWeight: '500', color: C.blanc60 },
  texteActif: { color: C.encre },
});
