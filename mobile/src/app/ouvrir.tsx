/**
 * Ouvrir un match.
 *
 * Quatre champs, pas douze : le lieu, le jour, l'heure, le niveau. Tout le reste
 * a un défaut raisonnable. Proposer une partie doit prendre vingt secondes,
 * sinon personne n'en propose et la carte reste vide.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { C, P } from '@/da/theme';
import { Ecusson } from '@/composants/Ecusson';
import { actions, useEtat } from '@/etat/store';

const JOURS = ['Ce soir', 'Demain', 'Samedi', 'Dimanche'];
const NIVEAUX = ['Débutant bienvenu', 'Tous niveaux', 'Confirmé'];

export default function Ouvrir() {
  const router = useRouter();
  const { equipe } = useEtat();
  const [avecEquipe, setAvecEquipe] = useState(true);
  const [lieu, setLieu] = useState('Playground Stalingrad');
  const [titre, setTitre] = useState('Demain');
  const [heure, setHeure] = useState('19h00');
  const [niveau, setNiveau] = useState('Débutant bienvenu');

  function valider() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const id = actions.ouvrirMatch({ lieu, titre, heure, niveau });
    if (equipe && avecEquipe) actions.inscrireEquipeSurMatch(id);
    router.back();
  }

  return (
    <ScrollView style={styles.fond} contentContainerStyle={styles.dedans}>
      <Text style={styles.titre}>Ouvrir un match</Text>
      <Text style={styles.sousTitre}>Tu poses le terrain et l&apos;heure. Les autres remplissent.</Text>

      <View style={styles.champ}>
        <Text style={styles.cle}>OÙ</Text>
        <TextInput
          value={lieu}
          onChangeText={setLieu}
          style={styles.saisie}
          placeholder="Nom du terrain"
          placeholderTextColor={C.encre42}
          autoCorrect={false}
        />
      </View>

      <View style={styles.champ}>
        <Text style={styles.cle}>QUAND</Text>
        <Choix options={JOURS} valeur={titre} onChange={setTitre} />
      </View>

      <View style={styles.champ}>
        <Text style={styles.cle}>À QUELLE HEURE</Text>
        <TextInput
          value={heure}
          onChangeText={setHeure}
          style={styles.saisie}
          placeholder="19h00"
          placeholderTextColor={C.encre42}
        />
      </View>

      <View style={styles.champ}>
        <Text style={styles.cle}>NIVEAU</Text>
        <Choix options={NIVEAUX} valeur={niveau} onChange={setNiveau} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={valider}
        style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}>
        <Text style={styles.actionTexte}>Ouvrir le match</Text>
      </Pressable>
      <Text style={styles.apres}>
        Tu en es l&apos;hôte. On prévient les joueurs à moins de 3 km.
      </Text>

      {/* L'équipe, en second plan : proposée ici, gérée dans la Ligue. */}
      {equipe ? (
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: avecEquipe }}
          onPress={() => { Haptics.selectionAsync(); setAvecEquipe((v) => !v); }}
          style={[styles.equipe, avecEquipe && styles.equipeActive]}>
          <Ecusson ecusson={equipe.ecusson} taille={30} />
          <View style={{ flex: 1 }}>
            <Text style={styles.equipeNom}>Inscrire {equipe.nom}</Text>
            <Text style={styles.equipeTexte}>{equipe.joueurs.length} joueurs déjà sur la feuille</Text>
          </View>
          <View style={[styles.coche, avecEquipe && styles.cocheActive]}>
            {avecEquipe && <Text style={styles.cocheTexte}>✓</Text>}
          </View>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => router.replace('/equipe')} style={styles.equipe}>
          <View style={{ flex: 1 }}>
            <Text style={styles.equipeNom}>Tu joues avec une équipe ?</Text>
            <Text style={styles.equipeTexte}>Monte-la dans Ligue → Équipes. Elle entrera au classement.</Text>
          </View>
          <Text style={styles.equipeFleche}>→</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function Choix({
  options, valeur, onChange,
}: { options: string[]; valeur: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.choix}>
      {options.map((o) => {
        const actif = o === valeur;
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityState={{ selected: actif }}
            onPress={() => { Haptics.selectionAsync(); onChange(o); }}
            style={[styles.option, actif && styles.optionActive]}>
            <Text style={[styles.optionTexte, actif && { color: C.clair }]}>{o}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.clair },
  dedans: { padding: 18, paddingBottom: 40 },
  titre: { fontFamily: P.titre, fontSize: 25, letterSpacing: -0.9, color: C.encre },
  sousTitre: { fontSize: 13.5, color: C.encre60, marginTop: 4 },
  champ: { marginTop: 14 },
  cle: { fontFamily: P.mono, fontSize: 10, letterSpacing: 1.4, color: C.encre42, marginBottom: 6 },
  saisie: {
    fontSize: 15, color: C.encre, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 15, backgroundColor: 'rgba(10,11,13,0.05)',
    borderWidth: StyleSheet.hairlineWidth * 2, borderColor: C.encre10,
  },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  option: {
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(10,11,13,0.12)',
  },
  optionActive: { backgroundColor: C.encre, borderColor: C.encre },
  optionTexte: { fontSize: 12.5, fontWeight: '500', color: 'rgba(10,11,13,0.66)' },
  action: { marginTop: 20, borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: C.encre },
  actionTexte: { fontSize: 15.5, fontWeight: '600', color: C.clair },
  apres: { fontSize: 11.5, color: 'rgba(10,11,13,0.45)', textAlign: 'center', marginTop: 10 },
  equipe: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 22, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: C.encre10 },
  equipeActive: { backgroundColor: 'rgba(10,11,13,0.04)' },
  equipeNom: { fontSize: 14, fontWeight: '600', color: C.encre },
  equipeTexte: { fontSize: 12, color: C.encre60, marginTop: 2 },
  equipeFleche: { fontSize: 18, color: C.encre60 },
  coche: { width: 24, height: 24, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(10,11,13,0.2)', alignItems: 'center', justifyContent: 'center' },
  cocheActive: { backgroundColor: C.encre, borderColor: C.encre },
  cocheTexte: { fontSize: 12, fontWeight: '700', color: C.clair },
});
