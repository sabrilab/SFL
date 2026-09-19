/**
 * La tuile d'un match : la photo du terrain porte l'écran, le jour est posé
 * dessus en très grand, et ce qui manque est la première chose qu'on lit.
 */
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, P, R } from '@/da/theme';
import { manque, type Match } from '@/donnees/matchs';
import { Jeton, type TonJeton } from './Jeton';

export function etatDe(m: Match, dedans: boolean): { texte: string; ton: TonJeton } {
  if (dedans) return { texte: 'Tu y es', ton: 'dedans' };
  const n = manque(m);
  if (n === 0) return { texte: 'Complet', ton: 'complet' };
  return { texte: `Il manque ${n}`, ton: 'manque' };
}

export function Tuile({
  match, dedans, onPress,
}: { match: Match; dedans: boolean; onPress: () => void }) {
  const etat = etatDe(match, dedans);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${match.titre} ${match.heure}, ${match.lieu}, ${etat.texte}`}
      onPress={() => { Haptics.selectionAsync(); onPress(); }}
      style={({ pressed }) => [styles.tuile, pressed && styles.pressee]}>
      <Image source={match.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(4,5,7,0.40)', 'rgba(3,4,6,0.82)']}
        locations={[0, 0.52, 1]}
        style={styles.voile}
      />
      <View style={styles.sur}>
        <View style={styles.rang}>
          <Jeton ton={etat.ton}>{etat.texte}</Jeton>
          <Jeton>{match.loin}</Jeton>
        </View>
        <View>
          <Text style={styles.geant} numberOfLines={1}>{match.titre.toUpperCase()}</Text>
          <View style={styles.pied}>
            <Text style={styles.lieu} numberOfLines={1}>{match.lieu}</Text>
            <Text style={styles.heure}>{match.heure.toUpperCase()} · {match.prix.toUpperCase()}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tuile: {
    height: 208, borderRadius: R.tuile, overflow: 'hidden', justifyContent: 'flex-end',
    backgroundColor: C.noir2,
  },
  pressee: { transform: [{ scale: 0.982 }] },
  // C'est ce voile qui rend le titre lisible quelle que soit la photo posée
  // dessous — sans lui, « DIMANCHE » disparaît sur un ciel clair.
  voile: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '38%' },
  sur: { flex: 1, padding: 13, justifyContent: 'space-between' },
  rang: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  geant: {
    fontFamily: P.titreLourd, fontSize: 52, lineHeight: 54, letterSpacing: -2.2,
    color: 'rgba(255,255,255,0.74)', marginLeft: -2,
  },
  pied: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginTop: 2 },
  lieu: { flex: 1, fontSize: 13.5, fontWeight: '500', color: 'rgba(255,255,255,0.94)' },
  heure: { fontFamily: P.mono, fontSize: 10.5, letterSpacing: 1, color: 'rgba(255,255,255,0.62)' },
});
