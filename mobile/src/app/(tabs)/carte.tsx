/**
 * Ma carte — l'identité de joueur, et le seul test qui ne demande pas de
 * terrain. C'est par lui qu'on saura si les gens ouvrent l'app un mardi.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ligne } from '@/composants/Ligne';
import { TestReaction } from '@/composants/TestReaction';
import { Corps, Libelle, Titre } from '@/composants/Texte';
import { C, ESP, P } from '@/da/theme';
import { useEtat } from '@/etat/store';

export default function MaCarte() {
  const { stats, vitesseGagnee } = useEtat();
  const { top, bottom } = useSafeAreaInsets();
  const note = Math.round(stats.reduce((s, x) => s + x.valeur, 0) / stats.length);

  return (
    <ScrollView
      style={{ backgroundColor: C.noir }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.defile, { paddingTop: top + ESP.deux, paddingBottom: 120 + bottom }]}>
      <View style={styles.entete}>
        <Titre style={styles.h1}>Ma carte</Titre>
        <Libelle style={{ marginTop: 6 }}>ILYES · SAINT-DENIS</Libelle>
      </View>

      <View style={styles.bloc}>
        <Libelle>NOTE GÉNÉRALE</Libelle>
        <View style={styles.rangNote}>
          <Titre lourd style={styles.nombre}>{String(note)}</Titre>
          {vitesseGagnee && <Titre style={styles.delta}>+1</Titre>}
        </View>
        <Corps style={{ marginTop: 9 }}>
          Elle monte quand tu joues, et quand tu te testes.
        </Corps>
      </View>

      <View style={styles.lignes}>
        {stats.map((s) => (
          <Ligne
            key={s.cle}
            cle={s.cle}
            texte={s.nom}
            valeur={String(s.valeur)}
            jauge={s.valeur}
            accentue={s.cle === 'VIT' && vitesseGagnee}
          />
        ))}
      </View>

      <TestReaction />

      <Corps style={styles.note}>
        Le seul test de la batterie qui ne demande aucun effort physique.
        C&apos;est par lui qu&apos;on saura si les gens se testent vraiment —
        un mardi soir, sans terrain.
      </Corps>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  defile: { paddingHorizontal: ESP.quatre },
  entete: { paddingBottom: ESP.trois },
  h1: { fontSize: 29, lineHeight: 31 },
  bloc: { paddingTop: ESP.cinq },
  rangNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  nombre: { fontFamily: P.titreLourd, fontSize: 74, lineHeight: 74, letterSpacing: -3.6 },
  delta: { fontSize: 20, lineHeight: 26, color: C.braise },
  lignes: { marginTop: ESP.cinq, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.blanc12 },
  note: { fontSize: 12, color: C.blanc34, paddingTop: ESP.quatre, lineHeight: 18 },
});
