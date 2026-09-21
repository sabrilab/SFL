/**
 * La feuille de match, côté hôte.
 *
 * Celui qui a ouvert le match tient la feuille : qui joue, dans quelle équipe,
 * chaque but à l'instant où il tombe, puis la validation — l'acte capital.
 * Sans elle, rien ne remonte : ni les buts, ni les passes, ni les classements.
 * C'est pourquoi le bouton de validation reste collé en bas de l'écran tant
 * que la feuille attend.
 */
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FaceCarte } from '@/composants/carte/face';
import { C, P } from '@/da/theme';
import { LIBELLE_STATUT, score, type Equipe, type Feuille } from '@/donnees/feuille';
import { JOUEURS, MOI_ID, ROSTER_DEMO } from '@/donnees/joueurs';
import type { Match } from '@/donnees/matchs';
import { actions } from '@/etat/store';

const CANDIDATS = [MOI_ID, ...ROSTER_DEMO];

export function FeuilleHote({ match, feuille }: { match: Match; feuille: Feuille }) {
  const [attribution, setAttribution] = useState<string | null>(null); // but en attente de passeur
  const s = score(feuille);
  const presents = feuille.lignes;
  const par = (e: Equipe) => presents.filter((l) => l.joueurId === e ? false : l.equipe === e);
  const enCours = feuille.statut === 'en_cours';
  const aValider = feuille.statut === 'a_valider';
  const validee = feuille.statut === 'validee';
  const editable = enCours || aValider;

  function but(joueurId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    actions.marquerBut(match.id, joueurId);
    setAttribution(joueurId);
  }

  function valider() {
    Alert.alert(
      'Valider la feuille de match',
      `${feuille.equipes.A.nom} ${s.A} — ${s.B} ${feuille.equipes.B.nom}. Une fois validée, la feuille est envoyée à la ligue et ne peut plus être modifiée.`,
      [
        { text: 'Relire', style: 'cancel' },
        { text: 'Valider', style: 'destructive', onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          actions.validerFeuille(match.id);
        } },
      ],
    );
  }

  return (
    <View style={styles.fond}>
      <ScrollView contentContainerStyle={[styles.dedans, aValider && { paddingBottom: 150 }]}>
        <Text style={styles.cle}>TU TIENS LA FEUILLE</Text>
        <Text style={styles.titre}>{match.lieu}</Text>
        <Text style={styles.sousTitre}>{match.titre} {match.heure}</Text>

        <View style={styles.statut}>
          <View style={[styles.point, validee && { backgroundColor: '#3E9E5D' }, enCours && { backgroundColor: C.braise }]} />
          <Text style={styles.statutTexte}>{LIBELLE_STATUT[feuille.statut]}</Text>
          {validee && feuille.valideeLe && (
            <Text style={styles.statutDate}>· {new Date(feuille.valideeLe).toLocaleDateString('fr-FR')}</Text>
          )}
        </View>

        {/* Le score, dès que le match a commencé. Il se déduit des buts : il ne ment jamais. */}
        {feuille.statut !== 'ouvert' && (
          <View style={styles.score}>
            <Text style={styles.equipe}>{feuille.equipes.A.nom}</Text>
            <Text style={styles.chiffres}>{s.A} — {s.B}</Text>
            <Text style={[styles.equipe, { textAlign: 'right' }]}>{feuille.equipes.B.nom}</Text>
          </View>
        )}

        {/* Qui joue — tant que le match n'a pas commencé, l'hôte compose. */}
        {feuille.statut === 'ouvert' && (
          <>
            <Text style={[styles.cle, { marginTop: 18 }]}>QUI JOUE · TOUCHE UNE CARTE POUR L&apos;AJOUTER</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cartes}>
              {CANDIDATS.map((id) => {
                const ligne = presents.find((l) => l.joueurId === id);
                return (
                  <View key={id} style={{ alignItems: 'center', gap: 6 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: !!ligne }}
                      accessibilityLabel={`${JOUEURS[id].nom}${ligne ? ', présent' : ''}`}
                      onPress={() => { Haptics.selectionAsync(); actions.basculerPresent(match.id, id); }}
                      style={[styles.carteChoix, !ligne && { opacity: 0.45 }]}>
                      <FaceCarte joueur={JOUEURS[id]} largeur={96} />
                      {ligne && <View style={styles.coche}><Text style={styles.cocheTexte}>✓</Text></View>}
                    </Pressable>
                    {ligne ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Équipe ${feuille.equipes[ligne.equipe].nom}, changer`}
                        onPress={() => actions.changerEquipe(match.id, id)}
                        style={[styles.equipeChip, ligne.equipe === 'B' && styles.equipeChipB]}>
                        <Text style={styles.equipeChipTexte}>{feuille.equipes[ligne.equipe].nom}</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.absent}>—</Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <Text style={styles.aide}>
              {presents.length} joueur{presents.length > 1 ? 's' : ''} ·{' '}
              {par('A').length} {feuille.equipes.A.nom} · {par('B').length} {feuille.equipes.B.nom}.
              Touche l&apos;équipe sous une carte pour la changer.
            </Text>
            <Bouton
              texte="Démarrer le match"
              desactive={presents.length < 2}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); actions.demarrerMatch(match.id); }}
            />
            {presents.length < 2 && <Text style={styles.apres}>Il faut au moins deux joueurs.</Text>}
          </>
        )}

        {/* Le match — un bouton par joueur, un but à la fois. */}
        {feuille.statut !== 'ouvert' && (
          <>
            {attribution && editable && (
              <View style={styles.attribution}>
                <Text style={styles.attributionTitre}>But de {JOUEURS[attribution].nom} — passe de :</Text>
                <View style={styles.chips}>
                  {presents
                    .filter((l) => l.joueurId !== attribution
                      && l.equipe === presents.find((x) => x.joueurId === attribution)?.equipe)
                    .map((l) => (
                      <Pressable key={l.joueurId} accessibilityRole="button" style={styles.chip}
                        onPress={() => { actions.passeurDuDernierBut(match.id, l.joueurId); setAttribution(null); }}>
                        <Text style={styles.chipTexte}>{JOUEURS[l.joueurId].nom}</Text>
                      </Pressable>
                    ))}
                  <Pressable accessibilityRole="button" style={[styles.chip, styles.chipVide]}
                    onPress={() => setAttribution(null)}>
                    <Text style={[styles.chipTexte, { color: C.encre60 }]}>Sans passe</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {(['A', 'B'] as Equipe[]).map((e) => (
              <View key={e} style={styles.bloc}>
                <Text style={styles.cle}>{feuille.equipes[e].nom.toUpperCase()} · {s[e]}</Text>
                {presents.filter((l) => l.equipe === e).map((l) => (
                  <View key={l.joueurId} style={styles.rang}>
                    <Text style={styles.nom}>{JOUEURS[l.joueurId].nom}</Text>
                    <Text style={styles.compte}>
                      {l.buts} but{l.buts > 1 ? 's' : ''} · {l.passes} passe{l.passes > 1 ? 's' : ''}
                    </Text>
                    {aValider && (
                      <Pressable accessibilityRole="button" accessibilityState={{ selected: l.mvp }}
                        onPress={() => actions.basculerMvp(match.id, l.joueurId)}
                        style={[styles.mvp, l.mvp && styles.mvpActif]}>
                        <Text style={[styles.mvpTexte, l.mvp && { color: C.clair }]}>MVP</Text>
                      </Pressable>
                    )}
                    {editable && (
                      <Pressable accessibilityRole="button" accessibilityLabel={`But de ${JOUEURS[l.joueurId].nom}`}
                        onPress={() => but(l.joueurId)} style={styles.plusBut}>
                        <Text style={styles.plusButTexte}>+ But</Text>
                      </Pressable>
                    )}
                    {validee && l.mvp && <Text style={styles.mvpFige}>MVP</Text>}
                  </View>
                ))}
              </View>
            ))}

            {feuille.buts.length > 0 && (
              <View style={styles.bloc}>
                <View style={styles.rangCle}>
                  <Text style={styles.cle}>LES BUTS</Text>
                  {editable && (
                    <Pressable accessibilityRole="button" onPress={() => { actions.annulerDernierBut(match.id); setAttribution(null); }}>
                      <Text style={styles.lien}>Annuler le dernier</Text>
                    </Pressable>
                  )}
                </View>
                {[...feuille.buts].reverse().map((b, i, arr) => {
                  const idx = arr.length - 1 - i;
                  const avant = feuille.buts.slice(0, idx + 1);
                  const sc = avant.reduce((acc, x) => { acc[x.equipe] += 1; return acc; }, { A: 0, B: 0 } as Record<Equipe, number>);
                  return (
                    <View key={b.t} style={styles.but}>
                      <Text style={styles.butScore}>{sc.A} — {sc.B}</Text>
                      <Text style={styles.butTexte}>
                        {JOUEURS[b.joueurId].nom}
                        {b.passeurId ? <Text style={{ color: C.encre60 }}> · passe {JOUEURS[b.passeurId].nom}</Text> : null}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {enCours && (
              <Bouton texte="Terminer le match"
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); actions.terminerMatch(match.id); setAttribution(null); }} />
            )}
            {enCours && <Text style={styles.apres}>Tu pourras encore corriger avant de valider.</Text>}
            {validee && <Text style={styles.apres}>Envoyée à la ligue. Les classements la prennent en compte.</Text>}
          </>
        )}
      </ScrollView>

      {/* L'acte capital reste visible, quoi qu'on fasse défiler. */}
      {aValider && (
        <View style={styles.barre}>
          <Text style={styles.barreTexte}>Sans validation, rien ne remonte aux classements.</Text>
          <Bouton texte="Valider la feuille de match" onPress={valider} />
        </View>
      )}
    </View>
  );
}

function Bouton({ texte, onPress, desactive }: { texte: string; onPress: () => void; desactive?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={desactive} onPress={onPress}
      style={({ pressed }) => [styles.action, desactive && { opacity: 0.35 }, pressed && { opacity: 0.85 }]}>
      <Text style={styles.actionTexte}>{texte}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.clair },
  dedans: { padding: 18, paddingBottom: 40 },
  cle: { fontFamily: P.mono, fontSize: 10, letterSpacing: 1.4, color: C.encre42 },
  titre: { fontFamily: P.titre, fontSize: 25, letterSpacing: -0.9, color: C.encre, marginTop: 6 },
  sousTitre: { fontSize: 13.5, color: C.encre60, marginTop: 4 },
  statut: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  point: { width: 7, height: 7, borderRadius: 999, backgroundColor: C.encre42 },
  statutTexte: { fontSize: 13, fontWeight: '600', color: C.encre },
  statutDate: { fontSize: 12, color: C.encre60 },
  score: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16,
    paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: C.encre10,
  },
  equipe: { flex: 1, fontFamily: P.mono, fontSize: 11, letterSpacing: 1.2, color: C.encre60 },
  chiffres: { fontFamily: P.titreLourd, fontSize: 44, letterSpacing: -2, color: C.encre, fontVariant: ['tabular-nums'] },
  cartes: { gap: 10, paddingVertical: 12 },
  carteChoix: { borderRadius: 10 },
  coche: {
    position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 999,
    backgroundColor: C.clair, alignItems: 'center', justifyContent: 'center',
  },
  cocheTexte: { fontSize: 12, fontWeight: '700', color: C.encre },
  equipeChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F2A25C' },
  equipeChipB: { backgroundColor: '#7FB4FF' },
  equipeChipTexte: { fontSize: 11, fontWeight: '600', color: C.encre },
  absent: { fontSize: 11, color: C.encre42, paddingVertical: 4 },
  aide: { fontSize: 12.5, color: C.encre60, marginTop: 4, lineHeight: 18 },
  bloc: { marginTop: 18 },
  rangCle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rang: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.encre10,
  },
  nom: { flex: 1, fontSize: 14.5, fontWeight: '600', color: C.encre },
  compte: { fontSize: 12, color: C.encre60 },
  plusBut: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: C.encre },
  plusButTexte: { fontSize: 12.5, fontWeight: '600', color: C.clair },
  mvp: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(10,11,13,0.18)' },
  mvpActif: { backgroundColor: C.encre, borderColor: C.encre },
  mvpTexte: { fontFamily: P.mono, fontSize: 9.5, letterSpacing: 1, color: C.encre60 },
  mvpFige: { fontFamily: P.mono, fontSize: 9.5, letterSpacing: 1, color: C.braiseEncre },
  attribution: { marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,138,76,0.14)' },
  attributionTitre: { fontSize: 13, fontWeight: '600', color: C.braiseEncre },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: C.encre },
  chipVide: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(10,11,13,0.18)' },
  chipTexte: { fontSize: 12.5, fontWeight: '600', color: C.clair },
  but: { flexDirection: 'row', gap: 12, paddingVertical: 7, alignItems: 'center' },
  butScore: { fontFamily: P.monoMoyen, fontSize: 12, color: C.encre42, width: 44 },
  butTexte: { fontSize: 13.5, color: C.encre },
  lien: { fontSize: 12.5, color: C.braiseEncre, fontWeight: '600' },
  action: { marginTop: 18, borderRadius: 999, paddingVertical: 16, alignItems: 'center', backgroundColor: C.encre },
  actionTexte: { fontSize: 15.5, fontWeight: '600', color: C.clair },
  apres: { fontSize: 11.5, color: 'rgba(10,11,13,0.45)', textAlign: 'center', marginTop: 10 },
  barre: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, paddingTop: 12,
    backgroundColor: C.clair, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.encre10,
  },
  barreTexte: { fontSize: 12, color: C.braiseEncre, textAlign: 'center', fontWeight: '600' },
});
