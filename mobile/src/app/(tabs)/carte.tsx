/**
 * Ma carte — le badge du joueur, en priorité et en volume, puis les cartes
 * de la ligue, puis le seul test qui ne demande pas de terrain.
 */
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FaceCarte } from '@/composants/carte/face';
import { CarteVolume } from '@/composants/carte/volume';
import { Ligne } from '@/composants/Ligne';
import { TestReaction } from '@/composants/TestReaction';
import { Corps, Libelle, Titre } from '@/composants/Texte';
import { C, ESP, P, R } from '@/da/theme';
import { JOUEURS, MOI_ID, ROSTER_DEMO, type CarteJoueur } from '@/donnees/joueurs';
import { useEtat } from '@/etat/store';

export default function MaCarte() {
  const { stats, vitesseGagnee } = useEtat();
  const { top, bottom } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();

  // La carte reflète l'état vivant : le test de réflexes la fait monter.
  const moi: CarteJoueur = useMemo(() => {
    const base = JOUEURS[MOI_ID];
    const note = Math.round(stats.reduce((s, x) => s + x.valeur, 0) / stats.length);
    return {
      ...base, note,
      stats: base.stats.map((s, i) => ({ ...s, valeur: stats[i]?.valeur ?? s.valeur })) as CarteJoueur['stats'],
    };
  }, [stats]);

  const largeurHero = Math.min(236, width * 0.6);

  return (
    <ScrollView
      style={{ backgroundColor: C.noir }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.defile, { paddingTop: top + ESP.deux, paddingBottom: 120 + bottom }]}>
      <View style={styles.entete}>
        <Titre style={styles.h1}>Ma carte</Titre>
        <Libelle style={{ marginTop: 6 }}>ILYES · SAINT-DENIS</Libelle>
      </View>

      {/* Le badge, en priorité. Glisser pour la tourner, deux touchers pour la retourner. */}
      <View style={styles.scene}>
        <CarteVolume joueur={moi} largeur={largeurHero} />
      </View>

      {!moi.photo && (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert(
              'Créer ma photo',
              "Tu enverras deux ou trois photos de toi ; on en fera un portrait au même cadrage et à la même lumière que ceux des autres joueurs. La génération arrive avec le modèle et sa clé.",
            )}
          style={({ pressed }) => [styles.appel, pressed && { opacity: 0.85 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.appelLibelle}>TA CARTE N&apos;A PAS ENCORE DE VISAGE</Text>
            <Text style={styles.appelTitre}>Créer ma photo</Text>
            <Text style={styles.appelTexte}>
              Deux ou trois photos suffisent. On en fait un portrait au même cadrage que ceux des autres.
            </Text>
          </View>
        </Pressable>
      )}

      <View style={styles.section}>
        <Libelle>LES CARTES DE LA LIGUE</Libelle>
        <Corps style={{ marginTop: 4 }}>Ceux avec qui tu joues le dimanche.</Corps>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={132 + 10}
        decelerationRate="fast"
        contentContainerStyle={styles.rangee}>
        {ROSTER_DEMO.map((id) => (
          <Pressable key={id} onPress={() => router.push({ pathname: '/joueur/[id]', params: { id } })} accessibilityRole="button"
            accessibilityLabel={`Carte de ${JOUEURS[id].nom}`}>
            <FaceCarte joueur={JOUEURS[id]} largeur={132} />
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.lignes}>
        {stats.map((s) => (
          <Ligne key={s.cle} cle={s.cle} texte={s.nom} valeur={String(s.valeur)} jauge={s.valeur}
            accentue={s.cle === 'VIT' && vitesseGagnee} />
        ))}
      </View>

      <TestReaction />

      <Corps style={styles.note}>
        Le seul test de la batterie qui ne demande aucun effort physique. Quand il fait
        monter ta vivacité, ta carte monte avec.
      </Corps>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  defile: { paddingHorizontal: ESP.quatre },
  entete: { paddingBottom: ESP.trois },
  h1: { fontSize: 29, lineHeight: 31 },
  scene: { alignItems: 'center', paddingTop: ESP.deux },
  appel: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, marginTop: ESP.deux,
    borderRadius: R.tuile, backgroundColor: C.clair,
  },
  appelLibelle: { fontFamily: P.mono, fontSize: 10, letterSpacing: 1.6, color: C.encre42 },
  appelTitre: { fontFamily: P.titre, fontSize: 21, letterSpacing: -0.6, color: C.encre, marginTop: 6 },
  appelTexte: { fontSize: 12.5, color: C.encre60, marginTop: 3 },
  section: { marginTop: ESP.six },
  rangee: { gap: 10, paddingVertical: ESP.trois },
  lignes: { marginTop: ESP.cinq, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.blanc12 },
  note: { fontSize: 12, color: C.blanc34, paddingTop: ESP.quatre, lineHeight: 18 },
});
