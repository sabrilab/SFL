/**
 * Monter son équipe — ou la retoucher. Présenté en feuille native.
 *
 * Le nom, l'écusson composé, et cinq à sept joueurs. La règle des bornes est
 * tenue par le store ; ici on l'explique et on grise le bouton tant qu'elle
 * n'est pas respectée.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FaceCarte } from '@/composants/carte/face';
import { Ecusson } from '@/composants/Ecusson';
import { C, P } from '@/da/theme';
import {
  COULEURS, FORMES, MAX_JOUEURS, MIN_JOUEURS, MOTIFS, monogrammeDe, probleme,
  type Ecusson as DonneesEcusson,
} from '@/donnees/equipes';
import { JOUEURS, MOI_ID, ROSTER_DEMO } from '@/donnees/joueurs';
import { actions, useEtat } from '@/etat/store';

const CANDIDATS = ROSTER_DEMO;

export default function EquipeEcran() {
  const router = useRouter();
  const { equipe } = useEtat();
  const [nom, setNom] = useState(equipe?.nom ?? '');
  const [monogrammeLibre, setMonogrammeLibre] = useState(equipe?.ecusson.monogramme ?? '');
  const [ecusson, setEcusson] = useState<Omit<DonneesEcusson, 'monogramme'>>(
    equipe?.ecusson ?? { forme: 'ecu', motif: 'bandes', couleurs: ['#E4572E', '#0B0C0E'] });
  const [joueurs, setJoueurs] = useState<string[]>(equipe?.joueurs.filter((j) => j !== MOI_ID) ?? []);

  const monogramme = (monogrammeLibre || monogrammeDe(nom) || '?').slice(0, 3).toUpperCase();
  const complet: DonneesEcusson = { ...ecusson, monogramme };
  const effectif = [MOI_ID, ...joueurs];
  const souci = probleme(nom, effectif);

  function basculer(id: string) {
    Haptics.selectionAsync();
    if (equipe) {
      const erreur = actions.basculerJoueurEquipe(id);
      if (erreur) { Alert.alert('Effectif', erreur); return; }
      setJoueurs((j) => (j.includes(id) ? j.filter((x) => x !== id) : [...j, id]));
      return;
    }
    setJoueurs((j) => {
      if (j.includes(id)) return j.filter((x) => x !== id);
      if (j.length + 1 >= MAX_JOUEURS) { Alert.alert('Effectif', `Pas plus de ${MAX_JOUEURS} joueurs, toi compris.`); return j; }
      return [...j, id];
    });
  }

  function valider() {
    const erreur = equipe
      ? actions.modifierEquipe({ nom, ecusson: complet })
      : actions.creerEquipe({ nom, ecusson: complet, joueurs });
    if (erreur) { Alert.alert('Équipe', erreur); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  return (
    <ScrollView style={styles.fond} contentContainerStyle={styles.dedans}>
      <Text style={styles.cle}>{equipe ? 'TON ÉQUIPE' : 'MONTER UNE ÉQUIPE'}</Text>
      <Text style={styles.titre}>{equipe ? equipe.nom : 'Cinq à sept joueurs'}</Text>
      <Text style={styles.sousTitre}>
        Un nom, un écusson, et ceux avec qui tu joues. L&apos;équipe apparaît dans le classement des équipes.
      </Text>

      {/* L'écusson en grand, vivant : il change à chaque réglage. */}
      <View style={styles.apercu}>
        <Ecusson ecusson={complet} taille={108} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cle}>NOM</Text>
          <TextInput value={nom} onChangeText={setNom} placeholder="Les Renards" placeholderTextColor={C.encre42}
            style={styles.saisie} autoCorrect={false} maxLength={28} />
          <Text style={[styles.cle, { marginTop: 10 }]}>MONOGRAMME</Text>
          <TextInput value={monogrammeLibre} onChangeText={(t) => setMonogrammeLibre(t.toUpperCase())}
            placeholder={monogrammeDe(nom) || 'LR'} placeholderTextColor={C.encre42}
            style={[styles.saisie, { width: 88 }]} autoCapitalize="characters" maxLength={3} />
        </View>
      </View>

      <Text style={[styles.cle, { marginTop: 18 }]}>FORME</Text>
      <View style={styles.choix}>
        {FORMES.map((f) => (
          <Pressable key={f.cle} accessibilityRole="button" accessibilityState={{ selected: ecusson.forme === f.cle }}
            onPress={() => setEcusson((e) => ({ ...e, forme: f.cle }))}
            style={[styles.option, ecusson.forme === f.cle && styles.optionActive]}>
            <Text style={[styles.optionTexte, ecusson.forme === f.cle && { color: C.clair }]}>{f.nom}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.cle, { marginTop: 14 }]}>MOTIF</Text>
      <View style={styles.choix}>
        {MOTIFS.map((m) => (
          <Pressable key={m.cle} accessibilityRole="button" accessibilityState={{ selected: ecusson.motif === m.cle }}
            onPress={() => setEcusson((e) => ({ ...e, motif: m.cle }))}
            style={[styles.option, ecusson.motif === m.cle && styles.optionActive]}>
            <Text style={[styles.optionTexte, ecusson.motif === m.cle && { color: C.clair }]}>{m.nom}</Text>
          </Pressable>
        ))}
      </View>

      {([0, 1] as const).map((i) => (
        <View key={i}>
          <Text style={[styles.cle, { marginTop: 14 }]}>{i === 0 ? 'COULEUR' : 'SECONDE COULEUR'}</Text>
          <View style={styles.pastilles}>
            {COULEURS.map((c) => {
              const active = ecusson.couleurs[i] === c;
              return (
                <Pressable key={c} accessibilityRole="button" accessibilityLabel={`Couleur ${c}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => setEcusson((e) => {
                    const couleurs: [string, string] = [...e.couleurs] as [string, string];
                    couleurs[i] = c; return { ...e, couleurs };
                  })}
                  style={[styles.pastille, { backgroundColor: c }, active && styles.pastilleActive]} />
              );
            })}
          </View>
        </View>
      ))}

      <Text style={[styles.cle, { marginTop: 20 }]}>
        JOUEURS · {effectif.length} SUR {MAX_JOUEURS} · TOI COMPRIS
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cartes}>
        {CANDIDATS.map((id) => {
          const dedans = joueurs.includes(id);
          return (
            <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: dedans }}
              accessibilityLabel={`${JOUEURS[id].nom}${dedans ? ', dans l’équipe' : ''}`}
              onPress={() => basculer(id)} style={[styles.carteChoix, !dedans && { opacity: 0.45 }]}>
              <FaceCarte joueur={JOUEURS[id]} largeur={92} />
              {dedans && <View style={styles.coche}><Text style={styles.cocheTexte}>✓</Text></View>}
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable accessibilityRole="button" disabled={!!souci} onPress={valider}
        style={({ pressed }) => [styles.action, souci && { opacity: 0.35 }, pressed && { opacity: 0.85 }]}>
        <Text style={styles.actionTexte}>{equipe ? 'Enregistrer' : "Monter l'équipe"}</Text>
      </Pressable>
      <Text style={styles.apres}>
        {souci ?? `Entre ${MIN_JOUEURS} et ${MAX_JOUEURS} joueurs. Tu en es le capitaine.`}
      </Text>

      {equipe && (
        <Pressable accessibilityRole="button" style={{ marginTop: 18, alignSelf: 'center' }}
          onPress={() => Alert.alert('Dissoudre l’équipe', 'Elle disparaît du classement des équipes.', [
            { text: 'Garder', style: 'cancel' },
            { text: 'Dissoudre', style: 'destructive', onPress: () => { actions.dissoudreEquipe(); router.back(); } },
          ])}>
          <Text style={styles.lien}>Dissoudre l&apos;équipe</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.clair },
  dedans: { padding: 18, paddingBottom: 44 },
  cle: { fontFamily: P.mono, fontSize: 10, letterSpacing: 1.4, color: C.encre42 },
  titre: { fontFamily: P.titre, fontSize: 25, letterSpacing: -0.9, color: C.encre, marginTop: 6 },
  sousTitre: { fontSize: 13.5, color: C.encre60, marginTop: 4, lineHeight: 19 },
  apercu: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 18 },
  saisie: {
    fontSize: 15, color: C.encre, paddingHorizontal: 12, paddingVertical: 10, marginTop: 5,
    borderRadius: 13, backgroundColor: 'rgba(10,11,13,0.05)', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: C.encre10,
  },
  choix: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  option: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(10,11,13,0.12)' },
  optionActive: { backgroundColor: C.encre, borderColor: C.encre },
  optionTexte: { fontSize: 12.5, fontWeight: '500', color: 'rgba(10,11,13,0.66)' },
  pastilles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pastille: { width: 30, height: 30, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(10,11,13,0.18)' },
  pastilleActive: { borderWidth: 3, borderColor: C.encre },
  cartes: { gap: 10, paddingVertical: 12 },
  carteChoix: { borderRadius: 10 },
  coche: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 999, backgroundColor: C.clair, alignItems: 'center', justifyContent: 'center' },
  cocheTexte: { fontSize: 12, fontWeight: '700', color: C.encre },
  action: { marginTop: 14, borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: C.encre },
  actionTexte: { fontSize: 15.5, fontWeight: '600', color: C.clair },
  apres: { fontSize: 11.5, color: 'rgba(10,11,13,0.55)', textAlign: 'center', marginTop: 10 },
  lien: { fontSize: 13, color: C.braiseEncre, fontWeight: '600' },
});
