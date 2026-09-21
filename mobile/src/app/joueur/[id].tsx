/**
 * La carte d'un autre joueur, en volume, présentée en feuille native.
 * C'est là que la reconnaissance se joue : on regarde la carte de quelqu'un.
 */
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CarteVolume } from '@/composants/carte/volume';
import { C, P } from '@/da/theme';
import { JOUEURS } from '@/donnees/joueurs';

export default function FicheJoueur() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const joueur = id ? JOUEURS[id] : undefined;

  if (!joueur) {
    return <View style={styles.fond}><Text style={styles.absent}>Ce joueur n&apos;est pas dans la ligue.</Text></View>;
  }

  return (
    <View style={styles.fond}>
      <Text style={styles.libelle}>GLISSER POUR TOURNER · DEUX TOUCHERS POUR RETOURNER</Text>
      <CarteVolume joueur={joueur} largeur={Math.min(300, width - 72)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.noir, alignItems: 'center', justifyContent: 'center', gap: 22, padding: 20 },
  libelle: { fontFamily: P.mono, fontSize: 9.5, letterSpacing: 1.4, color: C.blanc34, textAlign: 'center' },
  absent: { color: C.blanc60 },
});
