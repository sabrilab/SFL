/**
 * Ligue — trois rubriques côte à côte : Journée, Classement, Matchs.
 *
 * Elles ne sont pas empilées derrière un menu : passer de l'une à l'autre doit
 * coûter un pouce. Le contrôle segmenté reprend la mécanique d'un
 * `UISegmentedControl` et se comporte pareil sur Android.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Convocation } from '@/composants/Convocation';
import { Ligne } from '@/composants/Ligne';
import { Segment } from '@/composants/Segment';
import { Corps, Libelle, Titre } from '@/composants/Texte';
import { C, ESP, P } from '@/da/theme';
import { CLASSEMENTS, JOURNEES, MOI } from '@/donnees/ligue';

type Rubrique = 'journee' | 'classement' | 'matchs';

export default function Ligue() {
  const [rubrique, setRubrique] = useState<Rubrique>('journee');
  const { top, bottom } = useSafeAreaInsets();

  return (
    <View style={styles.fond}>
      <View style={[styles.entete, { paddingTop: top + ESP.deux }]}>
        <Titre style={styles.h1}>Sunday Five</Titre>
        <Libelle style={{ marginTop: 6 }}>TA LIGUE · 9 JOURNÉES</Libelle>
      </View>

      <Segment
        valeur={rubrique}
        onChange={setRubrique}
        choix={[
          { cle: 'journee', nom: 'Journée' },
          { cle: 'classement', nom: 'Classement' },
          { cle: 'matchs', nom: 'Matchs' },
        ]}
      />

      <ScrollView
        contentContainerStyle={[styles.defile, { paddingBottom: 120 + bottom }]}
        showsVerticalScrollIndicator={false}>
        {rubrique === 'journee' && <Journee />}
        {rubrique === 'classement' && <Classement />}
        {rubrique === 'matchs' && <Matchs />}
      </ScrollView>
    </View>
  );
}

function Journee() {
  return (
    <>
      <Convocation />
      <View style={styles.bloc}>
        <Libelle>TA DERNIÈRE JOURNÉE</Libelle>
        <Titre lourd style={styles.nombre}>+11</Titre>
        <Corps style={{ marginTop: 9 }}>J9 · Orange 7 — 5 Bleu · victoire</Corps>
      </View>
      <View style={styles.lignes}>
        <Ligne cle="BUT" texte="Buts marqués" valeur="4" />
        <Ligne cle="PAS" texte="Passes décisives" valeur="2" />
        <Ligne cle="MVP" texte="Homme du match" valeur="—" />
      </View>
      <Corps style={styles.note}>
        La journée, c&apos;est ce qui se passe dimanche : qui vient, et ce que tu as
        fait la fois d&apos;avant.
      </Corps>
    </>
  );
}

function Classement() {
  return (
    <>
      {CLASSEMENTS.map((p) => (
        <View key={p.titre} style={styles.palmares}>
          <View style={styles.enteteePalmares}>
            <Libelle>{p.titre.toUpperCase()}</Libelle>
            <Libelle style={{ color: 'rgba(244,245,242,0.20)' }}>
              {p.precision.toUpperCase()}
            </Libelle>
          </View>
          <View style={styles.lignes}>
            {p.rangs.map((r, i) => (
              <Ligne
                key={r.nom + i}
                rang={i + 1}
                texte={r.nom}
                moi={r.nom === MOI}
                valeur={String(r.valeur)}
              />
            ))}
          </View>
        </View>
      ))}
      <Corps style={styles.note}>
        Les cinq classements d&apos;affilée, sans sous-menu : on descend, on voit
        tout. Le tien est surligné où que tu sois.
      </Corps>
    </>
  );
}

function Matchs() {
  return (
    <>
      <View style={styles.bloc}>
        <Libelle>9 JOURNÉES JOUÉES</Libelle>
        <Titre lourd style={styles.nombre}>42</Titre>
        <Corps style={{ marginTop: 9 }}>
          Buts en J9, le record de la saison. Moyenne sur l&apos;année : 31 par journée.
        </Corps>
      </View>
      <View style={styles.lignes}>
        {JOURNEES.map((j) => (
          <Ligne key={j.n} cle={`J${j.n}`} texte={`${j.score}`} valeur={`+${j.pp}`} />
        ))}
      </View>
      <Corps style={styles.note}>
        L&apos;onglet Matchs ne change pas : l&apos;historique des journées et les
        scores. On y entre pour vérifier, pas pour découvrir.
      </Corps>
    </>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: C.noir },
  entete: { paddingHorizontal: ESP.quatre, paddingBottom: ESP.trois },
  h1: { fontSize: 29, lineHeight: 31 },
  defile: { paddingHorizontal: ESP.quatre },
  bloc: { paddingTop: ESP.cinq },
  nombre: { fontFamily: P.titreLourd, fontSize: 68, lineHeight: 68, letterSpacing: -3.2, marginTop: 8 },
  lignes: { marginTop: ESP.trois, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.blanc12 },
  palmares: { marginTop: ESP.cinq },
  enteteePalmares: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  note: { fontSize: 12, color: C.blanc34, paddingTop: ESP.quatre, lineHeight: 18 },
});
