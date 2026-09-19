/**
 * Le test de réflexes.
 *
 * Trois essais, délai d'armement aléatoire, médiane des trois. Toucher avant le
 * signal annule l'essai — sinon le test ne mesure plus rien. Passé le 70e
 * percentile, la vivacité de la carte monte d'un point, une seule fois : une
 * récompense qu'on peut farmer n'est plus une mesure.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, P, R } from '@/da/theme';
import { actions } from '@/etat/store';

type Phase = 'repos' | 'attend' | 'go';

/** Repères tirés de la littérature sur le temps de réaction simple. */
function percentile(ms: number) {
  if (ms < 200) return 92;
  if (ms < 240) return 74;
  if (ms < 290) return 51;
  if (ms < 350) return 28;
  return 12;
}

export function TestReaction() {
  const [phase, setPhase] = useState<Phase>('repos');
  const [scores, setScores] = useState<number[]>([]);
  const [mot, setMot] = useState('Commencer');
  const [sous, setSous] = useState("Touche, puis attends l'orange");
  const [verdict, setVerdict] = useState<{ titre: string; texte: string } | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depart = useRef(0);

  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current); }, []);

  function armer() {
    setPhase('attend');
    setMot('Attends…');
    setSous("Ne touche pas avant l'orange");
    minuteur.current = setTimeout(() => {
      setPhase('go');
      setMot('Maintenant');
      setSous('');
      depart.current = Date.now();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    }, 1400 + Math.random() * 2600);
  }

  function toucher() {
    if (phase === 'repos') {
      if (scores.length >= 3) { setScores([]); setVerdict(null); }
      armer();
      return;
    }
    if (phase === 'attend') {
      if (minuteur.current) clearTimeout(minuteur.current);
      setPhase('repos');
      setMot('Trop tôt');
      setSous('Touche pour reprendre cet essai');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    const ms = Date.now() - depart.current;
    const suite = [...scores, ms];
    setScores(suite);
    setPhase('repos');
    if (suite.length < 3) {
      setMot(`${ms} ms`);
      setSous("Touche pour l'essai suivant");
      return;
    }
    const med = [...suite].sort((a, b) => a - b)[1];
    const pct = percentile(med);
    setMot(`${med} ms`);
    setSous('Touche pour recommencer');
    const monte = pct >= 70 && actions.gagnerVitesse();
    setVerdict({
      titre: `${med} ms · ${pct}e percentile`,
      texte:
        'Médiane de tes trois essais. Adulte non entraîné : 250 ms. ' +
        'Gardien de haut niveau : sous 200 ms. ' +
        (monte
          ? 'Ta vivacité monte de +1 sur ta carte.'
          : pct >= 70
            ? 'Tu as déjà pris ton point de vivacité cette saison.'
            : "Reviens demain : c'est en répétant qu'on progresse."),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  return (
    <View style={styles.carte}>
      <Text style={styles.libelle}>LABO · TEST 1 SUR 6</Text>
      <Text style={styles.titre}>Temps de réaction</Text>
      <Text style={styles.sousTitre}>
        Trois essais, quarante secondes. Assis, sans rien d&apos;autre qu&apos;un doigt.
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${mot}. ${sous}`}
        onPress={toucher}
        style={[
          styles.piste,
          phase === 'attend' && styles.attend,
          phase === 'go' && styles.go,
        ]}>
        <Text style={[styles.mot, phase === 'go' && { color: '#1A0B03' }]}>{mot}</Text>
        {!!sous && (
          <Text style={[styles.pisteSous, phase === 'go' && { color: '#1A0B03' }]}>{sous}</Text>
        )}
      </Pressable>

      <View style={styles.essais}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.essai}>
            <Text style={styles.essaiValeur}>{scores[i] ? String(scores[i]) : '—'}</Text>
            <Text style={styles.essaiNom}>ESSAI {i + 1}</Text>
          </View>
        ))}
      </View>

      {verdict && (
        <View style={styles.verdict}>
          <Text style={styles.verdictTitre}>{verdict.titre}</Text>
          <Text style={styles.verdictTexte}>{verdict.texte}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: C.clair, borderRadius: R.tuile, padding: 18, marginTop: 18 },
  libelle: { fontFamily: P.mono, fontSize: 10, letterSpacing: 1.6, color: C.encre42 },
  titre: { fontFamily: P.titre, fontSize: 21, letterSpacing: -0.6, color: C.encre, marginTop: 7 },
  sousTitre: { fontSize: 12.5, color: C.encre60, marginTop: 3 },
  piste: {
    height: 138, borderRadius: 20, marginTop: 14, alignItems: 'center',
    justifyContent: 'center', backgroundColor: C.encre,
  },
  attend: { backgroundColor: '#2A2118' },
  go: { backgroundColor: C.braise },
  mot: { fontFamily: P.titre, fontSize: 27, letterSpacing: -0.9, color: C.clair },
  pisteSous: { fontSize: 12, color: 'rgba(239,239,236,0.66)', marginTop: 4 },
  essais: { flexDirection: 'row', gap: 6, marginTop: 11 },
  essai: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 14, backgroundColor: C.encre06 },
  essaiValeur: { fontFamily: P.monoMoyen, fontSize: 16, color: C.encre },
  essaiNom: { fontFamily: P.mono, fontSize: 8.5, letterSpacing: 1, color: C.encre42 },
  verdict: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,138,76,0.14)' },
  verdictTitre: { fontFamily: P.titre, fontSize: 16, letterSpacing: -0.4, color: C.braiseEncre },
  verdictTexte: { fontSize: 12, color: C.encre60, marginTop: 3 },
});
