/**
 * La convocation de la journée.
 *
 * C'est la seule chose qu'on vient vraiment faire dans l'app un jeudi soir :
 * dire si on vient. Les compteurs bougent pour de bon, et retoucher sa réponse
 * l'annule — personne ne doit rester coincé sur un « présent » posé par erreur.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { C, P, R } from '@/da/theme';
import { CONVOCATION } from '@/donnees/ligue';
import { PHOTOS } from '@/donnees/matchs';
import { actions, compteConvocation, useEtat } from '@/etat/store';
import { Jeton } from './Jeton';

export function Convocation() {
  const { reponse } = useEtat();
  const { presents, absents, sansReponse } = compteConvocation(reponse);

  return (
    <>
      <View style={styles.tuile}>
        <Image source={PHOTOS.ligue} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(4,5,7,0.40)', 'rgba(3,4,6,0.82)']}
          locations={[0, 0.52, 1]}
          style={styles.voile}
        />
        <View style={styles.sur}>
          <View style={styles.rang}>
            <Jeton>{`Journée ${CONVOCATION.journee}`}</Jeton>
            <Jeton>{`${presents + absents} réponses sur ${CONVOCATION.total}`}</Jeton>
          </View>
          <View>
            <Text style={styles.geant}>{CONVOCATION.jour.toUpperCase()}</Text>
            <View style={styles.pied}>
              <Text style={styles.lieu} numberOfLines={1}>{CONVOCATION.lieu}</Text>
              <Text style={styles.heure}>{CONVOCATION.heure.toUpperCase()}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.carte}>
        <Text style={styles.libelle}>TA CONVOCATION</Text>
        <Text style={styles.question}>
          {reponse === 'present' ? "Tu viens dimanche. C'est noté."
            : reponse === 'absent' ? 'Tu ne viens pas dimanche.'
            : 'Tu viens dimanche ?'}
        </Text>

        <View style={styles.boutons}>
          {(['present', 'absent'] as const).map((r) => (
            <Pressable
              key={r}
              accessibilityRole="button"
              accessibilityState={{ selected: reponse === r }}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                actions.repondre(r);
              }}
              style={[styles.bouton, reponse === r && styles.boutonActif]}>
              <Text style={[styles.boutonTexte, reponse === r && { color: C.clair }]}>
                {r === 'present' ? 'Je viens' : 'Je ne peux pas'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.compteurs}>
          {[
            { n: presents, nom: 'PRÉSENTS' },
            { n: absents, nom: 'ABSENTS' },
            { n: sansReponse, nom: 'SANS RÉPONSE' },
          ].map((c) => (
            <View key={c.nom} style={{ flex: 1 }}>
              <Text style={styles.compteurN}>{c.n}</Text>
              <Text style={styles.compteurNom}>{c.nom}</Text>
            </View>
          ))}
        </View>

        <View style={styles.tetes}>
          {CONVOCATION.presents.map((g) => (
            <View key={g} style={[styles.tete, styles.teteOui]}>
              <Text style={styles.teteTexteOui}>{g}</Text>
            </View>
          ))}
          {reponse === 'present' && (
            <View style={[styles.tete, styles.teteOui]}>
              <Text style={styles.teteTexteOui}>TOI</Text>
            </View>
          )}
          {CONVOCATION.absents.map((g) => (
            <View key={g} style={[styles.tete, styles.teteNon]}>
              <Text style={styles.teteTexteNon}>{g}</Text>
            </View>
          ))}
          {reponse === 'absent' && (
            <View style={[styles.tete, styles.teteNon]}>
              <Text style={styles.teteTexteNon}>TOI</Text>
            </View>
          )}
          {Array.from({ length: sansReponse }).map((_, i) => (
            <View key={`vide${i}`} style={[styles.tete, styles.teteVide]}>
              <Text style={styles.teteTexteVide}>?</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tuile: { height: 200, borderRadius: R.tuile, overflow: 'hidden', marginTop: 4, backgroundColor: C.noir2 },
  voile: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '38%' },
  sur: { flex: 1, padding: 13, justifyContent: 'space-between' },
  rang: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  geant: {
    fontFamily: P.titreLourd, fontSize: 50, lineHeight: 52, letterSpacing: -2.1,
    color: 'rgba(255,255,255,0.74)', marginLeft: -2,
  },
  pied: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10 },
  lieu: { flex: 1, fontSize: 13.5, fontWeight: '500', color: 'rgba(255,255,255,0.94)' },
  heure: { fontFamily: P.mono, fontSize: 10.5, letterSpacing: 1, color: 'rgba(255,255,255,0.62)' },

  carte: { backgroundColor: C.clair, borderRadius: R.tuile, padding: 18, marginTop: 14 },
  libelle: { fontFamily: P.mono, fontSize: 10, letterSpacing: 1.6, color: C.encre42 },
  question: { fontFamily: P.titre, fontSize: 21, letterSpacing: -0.6, color: C.encre, marginTop: 7, marginBottom: 13 },
  boutons: { flexDirection: 'row', gap: 6 },
  bouton: {
    flex: 1, paddingVertical: 12, borderRadius: 999, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(10,11,13,0.12)',
  },
  boutonActif: { backgroundColor: C.encre, borderColor: C.encre },
  boutonTexte: { fontSize: 14, fontWeight: '500', color: C.encre60 },
  compteurs: {
    flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.encre10,
  },
  compteurN: { fontFamily: P.titre, fontSize: 22, letterSpacing: -0.8, color: C.encre },
  compteurNom: { fontFamily: P.mono, fontSize: 9, letterSpacing: 1.1, color: C.encre42 },
  tetes: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 14 },
  tete: { width: 31, height: 31, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  teteOui: { backgroundColor: C.encre },
  teteNon: { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(10,11,13,0.14)' },
  teteVide: { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(10,11,13,0.14)', borderStyle: 'dashed' },
  teteTexteOui: { fontSize: 10.5, fontWeight: '600', color: C.clair },
  teteTexteNon: { fontSize: 10.5, fontWeight: '600', color: 'rgba(10,11,13,0.3)', textDecorationLine: 'line-through' },
  teteTexteVide: { fontSize: 10.5, fontWeight: '600', color: 'rgba(10,11,13,0.3)' },
});
