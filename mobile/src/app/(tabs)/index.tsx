/**
 * Jouer — l'écran d'ouverture. Ce qui se joue autour de soi, aujourd'hui,
 * qu'on soit de la SFL ou de nulle part.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Filtres, type Filtre } from '@/composants/Filtres';
import { Jeton } from '@/composants/Jeton';
import { Libelle, Titre } from '@/composants/Texte';
import { Tuile } from '@/composants/Tuile';
import { Verre } from '@/composants/Verre';
import { C, ESP, P, R } from '@/da/theme';
import { manque } from '@/donnees/matchs';
import { useEtat } from '@/etat/store';

export default function Jouer() {
  const { matchs, rejoints } = useEtat();
  const [filtre, setFiltre] = useState<Filtre>('tout');
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();

  const vus = useMemo(() => matchs.filter((m) => {
    if (filtre === 'jour') return m.jour === 'jour';
    if (filtre === 'weekend') return m.jour === 'weekend';
    if (filtre === 'libre') return manque(m) > 0;
    if (filtre === 'debutant') return m.niveau !== 'Confirmé';
    return true;
  }), [matchs, filtre]);

  return (
    <View style={styles.fond}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.defile, { paddingTop: top + ESP.deux, paddingBottom: 120 + bottom }]}>
        <View style={styles.entete}>
          <Titre style={styles.h1}>Près de toi</Titre>
          <Libelle style={{ marginTop: 6 }}>
            {vus.length === 0
              ? 'RIEN À CE FILTRE · SAINT-DENIS'
              : `${vus.length} MATCH${vus.length > 1 ? 'S' : ''} OUVERT${vus.length > 1 ? 'S' : ''} · SAINT-DENIS`}
          </Libelle>
        </View>

        <Filtres valeur={filtre} onChange={setFiltre} />

        {vus.length === 0 && (
          <View style={styles.rien}>
            <Titre style={{ fontSize: 20 }}>Rien à ce filtre</Titre>
            <Text style={styles.rienTexte}>
              Ouvre le tien — c&apos;est comme ça qu&apos;un dimanche commence.
            </Text>
          </View>
        )}

        {vus.map((m) => (
          <Tuile
            key={m.id}
            match={m}
            dedans={rejoints.includes(m.id)}
            onPress={() => router.push(`/match/${m.id}`)}
          />
        ))}

        {/* Ouvrir un match est une tuile comme les autres : proposer une partie
            doit coûter le même geste que d'en rejoindre une. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/ouvrir')}
          style={({ pressed }) => [styles.ouvrir, pressed && { opacity: 0.85 }]}>
          <Verre style={styles.ouvrirVerre} rayon={R.tuile}>
            <View style={styles.ouvrirDedans}>
              <Jeton>Aucun match ne te va ?</Jeton>
              <View>
                <Text style={styles.ouvrirGeant}>OUVRIR</Text>
                <Text style={styles.ouvrirSous}>
                  Tu poses le terrain, les autres remplissent
                </Text>
              </View>
            </View>
          </Verre>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.noir },
  defile: { paddingHorizontal: ESP.quatre, gap: ESP.trois },
  entete: { paddingBottom: ESP.un },
  h1: { fontSize: 29, lineHeight: 31 },
  rien: { paddingVertical: ESP.six, alignItems: 'center', gap: ESP.un },
  rienTexte: { fontSize: 13.5, color: C.blanc60, textAlign: 'center' },
  ouvrir: { borderRadius: R.tuile },
  ouvrirVerre: { height: 148 },
  ouvrirDedans: { flex: 1, padding: 13, justifyContent: 'space-between' },
  ouvrirGeant: {
    fontFamily: P.titreLourd, fontSize: 44, lineHeight: 46, letterSpacing: -1.9,
    color: 'rgba(255,255,255,0.74)', marginLeft: -2,
  },
  ouvrirSous: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
