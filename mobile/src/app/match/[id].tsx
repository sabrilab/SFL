/**
 * La fiche d'un match, présentée en feuille native par la pile racine.
 *
 * Elle répond dans l'ordre aux questions de quelqu'un qui ne connaît personne :
 * où et quand, qui organise, combien ça coûte, combien de places, et — la ligne
 * qui fait basculer — est-ce que d'autres viennent seuls eux aussi.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FaceCarte } from '@/composants/carte/face';
import { FeuilleHote } from '@/composants/feuille/FeuilleHote';
import { Jeton } from '@/composants/Jeton';
import { C, P, R } from '@/da/theme';
import { JOUEURS, MOI_ID, ROSTER_DEMO } from '@/donnees/joueurs';
import { manque } from '@/donnees/matchs';
import { actions, useEtat } from '@/etat/store';

export default function FicheMatch() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { matchs, rejoints, feuilles } = useEtat();
  const router = useRouter();
  const match = matchs.find((m) => m.id === id);
  const feuille = id ? feuilles[id] : undefined;

  if (!match) {
    return (
      <View style={styles.vide}>
        <Text style={styles.videTexte}>Ce match n&apos;existe plus.</Text>
      </View>
    );
  }

  // L'hôte ne voit pas la fiche : il tient la feuille.
  if (feuille) return <FeuilleHote match={match} feuille={feuille} />;

  const dedans = rejoints.includes(match.id);
  const n = manque(match);

  function agir() {
    if (!match) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (dedans || n > 0) actions.basculerMatch(match.id);
    router.back();
  }

  return (
    <ScrollView style={styles.fond} contentContainerStyle={styles.dedans}>
      <View style={styles.photo}>
        <Image source={match.photo} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(3,4,6,0.72)']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.geant}>{match.titre.toUpperCase()}</Text>
        <View style={styles.loin}><Jeton>{`${match.loin} de toi`}</Jeton></View>
      </View>

      <Text style={styles.titre}>{match.lieu}</Text>
      <Text style={styles.sousTitre}>
        {match.titre} {match.heure} · {match.niveau.toLowerCase()}
      </Text>

      <View style={styles.puces}>
        <Puce fort={n > 0 && !dedans}>
          {dedans ? 'Tu es inscrit' : n === 0 ? 'Complet' : `Il manque ${n} joueur${n > 1 ? 's' : ''}`}
        </Puce>
        <Puce>{match.niveau}</Puce>
        <Puce>{match.sfl ? 'Sunday Five' : 'Ouvert à tous'}</Puce>
      </View>

      <View style={styles.rangs}>
        <View style={styles.rang}>
          <View style={styles.teteHote}><Text style={styles.teteHoteTexte}>{match.init}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cle}>ORGANISÉ PAR</Text>
            <Text style={styles.valeurG}>{match.hote}</Text>
            <Text style={styles.petit}>{match.hoteNote}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.valeurG}>{match.prix}</Text>
            <Text style={styles.petit}>{match.prixNote}</Text>
          </View>
        </View>

        <View style={styles.rang}>
          <Text style={[styles.cle, { flex: 1 }]}>FORMAT</Text>
          <Text style={styles.valeurD}>5 contre 5 · 2 × 25 min</Text>
        </View>

        <View style={styles.rang}>
          <Text style={[styles.cle, { flex: 1 }]}>EFFECTIF</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.valeurD}>{match.pris} sur {match.places}</Text>
            <Text style={styles.petit}>
              {n === 0 ? 'plus de place' : `${n} place${n > 1 ? 's' : ''} libre${n > 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Qui vient : les cartes, pas des initiales. On reconnaît les gens à leur badge. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        snapToInterval={108 + 8} decelerationRate="fast" contentContainerStyle={styles.cartes}>
        {ROSTER_DEMO.slice(0, match.pris).map((id) => (
          <Pressable key={id} onPress={() => router.push({ pathname: '/joueur/[id]', params: { id } })} accessibilityRole="button"
            accessibilityLabel={`Carte de ${JOUEURS[id].nom}`}>
            <FaceCarte joueur={JOUEURS[id]} largeur={108} />
          </Pressable>
        ))}
        {match.pris > ROSTER_DEMO.length && (
          <View style={styles.reste}>
            <Text style={styles.resteN}>+{match.pris - ROSTER_DEMO.length}</Text>
            <Text style={styles.resteTexte}>sans carte</Text>
          </View>
        )}
        {dedans && <FaceCarte joueur={JOUEURS[MOI_ID]} largeur={108} />}
        {Array.from({ length: Math.max(0, n - (dedans ? 1 : 0)) }).map((_, i) => (
          <View key={`v${i}`} style={styles.place}><Text style={styles.placeTexte}>+</Text></View>
        ))}
      </ScrollView>

      {match.seuls > 0 && !dedans && (
        <View style={styles.seul}>
          <View style={styles.point} />
          <Text style={styles.seulTexte}>
            {match.seuls === 1
              ? 'Une personne vient seule elle aussi'
              : `${match.seuls} personnes viennent seules elles aussi`}
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={agir}
        style={({ pressed }) => [
          styles.action,
          dedans && styles.actionDedans,
          pressed && { opacity: 0.85 },
        ]}>
        <Text style={[styles.actionTexte, dedans && { color: C.encre }]}>
          {dedans ? 'Se retirer'
            : n === 0 ? 'Me prévenir si une place se libère'
            : `Rejoindre — ${match.prix === 'Gratuit' ? 'gratuit' : `${match.prix} sur place`}`}
        </Text>
      </Pressable>
      <Text style={styles.apres}>
        {dedans
          ? "On te rappelle 2 h avant le coup d'envoi"
          : "Tu peux te retirer jusqu'à 2 h avant"}
      </Text>
    </ScrollView>
  );
}

function Puce({ children, fort }: { children: string; fort?: boolean }) {
  return (
    <View style={[styles.puce, fort && styles.puceForte]}>
      <Text style={[styles.puceTexte, fort && { color: C.braiseEncre }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.clair },
  dedans: { padding: 18, paddingBottom: 40 },
  vide: { flex: 1, backgroundColor: C.clair, alignItems: 'center', justifyContent: 'center' },
  videTexte: { color: C.encre60 },
  photo: { height: 132, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: C.noir2 },
  geant: {
    fontFamily: P.titreLourd, fontSize: 40, lineHeight: 42, letterSpacing: -1.8,
    color: 'rgba(255,255,255,0.76)', paddingHorizontal: 12, paddingBottom: 6,
  },
  loin: { position: 'absolute', right: 12, top: 12 },
  titre: { fontFamily: P.titre, fontSize: 25, letterSpacing: -0.9, color: C.encre, marginTop: 15 },
  sousTitre: { fontSize: 13.5, color: C.encre60, marginTop: 4 },
  puces: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  puce: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: C.encre06 },
  puceForte: { backgroundColor: 'rgba(255,138,76,0.16)' },
  puceTexte: { fontSize: 12.5, fontWeight: '500', color: 'rgba(10,11,13,0.72)' },
  rangs: { marginTop: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.encre10 },
  rang: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.encre10,
  },
  teteHote: { width: 38, height: 38, borderRadius: 999, backgroundColor: C.encre06, alignItems: 'center', justifyContent: 'center' },
  teteHoteTexte: { fontSize: 12, fontWeight: '600', color: C.encre60 },
  cle: { fontFamily: P.mono, fontSize: 10, letterSpacing: 1.4, color: C.encre42 },
  valeurG: { fontSize: 14, fontWeight: '500', color: C.encre, marginTop: 2 },
  valeurD: { fontSize: 13.5, fontWeight: '500', color: C.encre, textAlign: 'right' },
  petit: { fontSize: 11.5, color: C.encre60, marginTop: 1 },
  cartes: { gap: 8, paddingVertical: 14 },
  reste: { width: 108, height: 162, borderRadius: 12, backgroundColor: C.encre06, alignItems: 'center', justifyContent: 'center' },
  resteN: { fontFamily: P.titre, fontSize: 22, letterSpacing: -0.6, color: C.encre },
  resteTexte: { fontSize: 11, color: C.encre60, marginTop: 2 },
  place: { width: 108, height: 162, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth * 2,
           borderColor: 'rgba(10,11,13,0.18)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  placeTexte: { fontSize: 18, color: 'rgba(10,11,13,0.3)' },
  seul: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  point: { width: 5, height: 5, borderRadius: 999, backgroundColor: C.braise },
  seulTexte: { fontSize: 12.5, color: C.braiseEncre },
  action: { marginTop: 17, borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: C.encre },
  actionDedans: { backgroundColor: C.encre06 },
  actionTexte: { fontSize: 15.5, fontWeight: '600', color: C.clair },
  apres: { fontSize: 11.5, color: 'rgba(10,11,13,0.45)', textAlign: 'center', marginTop: 10 },
});
