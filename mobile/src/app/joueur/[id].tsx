/**
 * La carte d'un autre joueur, en volume, présentée en feuille native.
 * C'est là que la reconnaissance se joue : on regarde la carte de quelqu'un.
 */
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CarteVolume } from '@/composants/carte/volume';
import { C, P } from '@/da/theme';
import { JOUEURS, MOI_ID } from '@/donnees/joueurs';
import { actions, useEtat } from '@/etat/store';

export default function FicheJoueur() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { amis, equipe } = useEtat();
  const joueur = id ? JOUEURS[id] : undefined;
  const ami = !!id && amis.includes(id);
  const coequipier = !!id && !!equipe?.joueurs.includes(id);

  if (!joueur) {
    return <View style={styles.fond}><Text style={styles.absent}>Ce joueur n&apos;est pas dans la ligue.</Text></View>;
  }

  return (
    <View style={styles.fond}>
      <Text style={styles.libelle}>GLISSER POUR TOURNER · DEUX TOUCHERS POUR RETOURNER</Text>
      <CarteVolume joueur={joueur} largeur={Math.min(300, width - 72)} />
      {joueur.id !== MOI_ID && (
        <View style={styles.actions}>
          {coequipier && <Text style={styles.coequipier}>DANS TON ÉQUIPE{equipe ? ` · ${equipe.nom.toUpperCase()}` : ''}</Text>}
          <Pressable accessibilityRole="button" accessibilityState={{ selected: ami }}
            onPress={() => { Haptics.selectionAsync(); actions.basculerAmi(joueur.id); }}
            style={({ pressed }) => [styles.ami, ami && styles.amiActif, pressed && { opacity: 0.85 }]}>
            <Text style={[styles.amiTexte, ami && { color: C.encre }]}>{ami ? '✓ Ami' : 'Ajouter en ami'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.noir, alignItems: 'center', justifyContent: 'center', gap: 22, padding: 20 },
  libelle: { fontFamily: P.mono, fontSize: 9.5, letterSpacing: 1.4, color: C.blanc34, textAlign: 'center' },
  absent: { color: C.blanc60 },
  actions: { alignItems: 'center', gap: 10 },
  coequipier: { fontFamily: P.mono, fontSize: 9.5, letterSpacing: 1.4, color: C.braise },
  ami: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: C.blanc12, backgroundColor: C.blanc06 },
  amiActif: { backgroundColor: C.clair, borderColor: C.clair },
  amiTexte: { fontSize: 14, fontWeight: '600', color: C.blanc },
});
