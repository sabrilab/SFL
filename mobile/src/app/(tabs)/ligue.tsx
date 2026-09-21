/**
 * Ligue — trois rubriques côte à côte : Journée, Classement, Matchs.
 *
 * Elles ne sont pas empilées derrière un menu : passer de l'une à l'autre doit
 * coûter un pouce. Le contrôle segmenté reprend la mécanique d'un
 * `UISegmentedControl` et se comporte pareil sur Android.
 */
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Convocation } from '@/composants/Convocation';
import { Ligne } from '@/composants/Ligne';
import { Segment } from '@/composants/Segment';
import { Corps, Libelle, Titre } from '@/composants/Texte';
import { C, ESP, P } from '@/da/theme';
import { CLASSEMENTS, MOI } from '@/donnees/ligue';
import { JOURNAL, RECORD_BUTS, manchette, meilleurs, scoreLisible, totalButs, type JourneeJournal } from '@/donnees/journal';

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
        {rubrique === 'matchs' && <Journal />}
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

/**
 * Le journal — chaque dimanche en rubrique qu'on déplie. Repris de la version
 * web : la manchette se déduit des chiffres, rien n'est inventé.
 */
function Journal() {
  const [ouverte, setOuverte] = useState<number | null>(JOURNAL[0]?.n ?? null);
  const total = JOURNAL.reduce((a, j) => a + totalButs(j), 0);

  return (
    <>
      <View style={styles.bloc}>
        <Libelle>{JOURNAL.length} JOURNÉES JOUÉES</Libelle>
        <Titre lourd style={styles.nombre}>{String(total)}</Titre>
        <Corps style={{ marginTop: 9 }}>
          Buts depuis le début de la saison. Record sur un dimanche : {RECORD_BUTS}, en J{JOURNAL.find((j) => totalButs(j) === RECORD_BUTS)?.n}.
        </Corps>
      </View>

      <View style={{ marginTop: ESP.cinq, gap: 8 }}>
        {JOURNAL.map((j) => (
          <Rubrique key={j.n} journee={j} ouverte={ouverte === j.n}
            onBascule={() => { Haptics.selectionAsync(); setOuverte(ouverte === j.n ? null : j.n); }} />
        ))}
      </View>
      <Corps style={styles.note}>
        On déplie pour lire ce qui s&apos;est passé. Les titres sont déduits des
        chiffres : deux lectures de la même journée donnent le même titre.
      </Corps>
    </>
  );
}

function Rubrique({ journee: j, ouverte, onBascule }: { journee: JourneeJournal; ouverte: boolean; onBascule: () => void }) {
  const une = manchette(j, totalButs(j) === RECORD_BUTS);
  const m = meilleurs(j);
  const [a, b] = j.equipes;
  return (
    <View style={[styles.rubrique, ouverte && styles.rubriqueOuverte]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: ouverte }} onPress={onBascule} style={styles.rubriqueTete}>
        <View style={styles.jChip}><Text style={styles.jChipTexte}>J{j.n}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.rubriqueScore}>{scoreLisible(j)}</Text>
          <Text style={styles.rubriqueMeta}>{j.date} · {totalButs(j)} buts · {j.presents} présents</Text>
        </View>
        <Text style={[styles.chevron, ouverte && { transform: [{ rotate: '180deg' }] }]}>⌄</Text>
      </Pressable>

      {ouverte && (
        <View style={styles.rubriqueCorps}>
          <Text style={styles.manchette}>{une.titre}</Text>
          <Text style={styles.chapeau}>{une.chapeau}</Text>

          <View style={styles.scoreGros}>
            <Text style={[styles.scoreEquipe, a.score > b.score && styles.scoreGagne]}>{a.nom}</Text>
            <Text style={styles.scoreChiffres}>{a.score} — {b.score}</Text>
            <Text style={[styles.scoreEquipe, { textAlign: 'right' }, b.score > a.score && styles.scoreGagne]}>{b.nom}</Text>
          </View>

          <View style={styles.tuiles}>
            {[
              { k: 'MEILLEUR BUTEUR', v: m.buteur?.joueur, d: `${m.buteur?.buts ?? 0} buts` },
              { k: 'MEILLEUR PASSEUR', v: m.passeur?.joueur, d: `${m.passeur?.passes ?? 0} passes` },
              { k: 'HOMME DU MATCH', v: m.mvp?.joueur ?? '—', d: m.mvp ? `${m.mvp.pp} pp` : '' },
            ].map((t) => (
              <View key={t.k} style={styles.tuileChiffre}>
                <Libelle style={{ fontSize: 8.5 }}>{t.k}</Libelle>
                <Text style={styles.tuileValeur} numberOfLines={1}>{t.v}</Text>
                <Text style={styles.tuileDetail}>{t.d}</Text>
              </View>
            ))}
          </View>

          <Libelle style={{ marginTop: 16 }}>AU BARÈME PÉPITE · LES TOPS DE LA JOURNÉE</Libelle>
          <View style={styles.lignes}>
            {m.topPP.map((l, i) => (
              <Ligne key={l.joueur} rang={i + 1} texte={`${l.joueur} · ${l.buts} b · ${l.passes} p`}
                moi={l.joueur === MOI} valeur={`+${l.pp}`} />
            ))}
          </View>

          {j.faits.length > 0 && (
            <View style={{ marginTop: 14, gap: 6 }}>
              {j.faits.map((f) => (
                <View key={f} style={styles.fait}>
                  <View style={styles.faitPoint} />
                  <Text style={styles.faitTexte}>{f}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
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

  rubrique: { borderRadius: 20, backgroundColor: C.blanc06, borderWidth: StyleSheet.hairlineWidth, borderColor: C.blanc12, overflow: 'hidden' },
  rubriqueOuverte: { backgroundColor: 'rgba(244,245,242,0.075)' },
  rubriqueTete: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  jChip: { width: 36, height: 36, borderRadius: 12, backgroundColor: C.braise18, alignItems: 'center', justifyContent: 'center' },
  jChipTexte: { fontFamily: P.mono, fontSize: 10.5, letterSpacing: 1, color: C.braise },
  rubriqueScore: { fontFamily: P.titre, fontSize: 15.5, letterSpacing: -0.3, color: C.blanc },
  rubriqueMeta: { fontFamily: P.mono, fontSize: 9.5, letterSpacing: 0.8, color: C.blanc34, marginTop: 3 },
  chevron: { fontSize: 18, color: C.blanc34, lineHeight: 18 },
  rubriqueCorps: { paddingHorizontal: 14, paddingBottom: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.blanc12, paddingTop: 14 },
  manchette: { fontFamily: P.titreLourd, fontSize: 24, letterSpacing: -1, lineHeight: 26, color: C.blanc },
  chapeau: { fontSize: 13.5, lineHeight: 19, color: C.blanc60, marginTop: 8 },
  scoreGros: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.blanc12 },
  scoreEquipe: { flex: 1, fontFamily: P.mono, fontSize: 10.5, letterSpacing: 1.2, color: C.blanc34 },
  scoreGagne: { color: C.blanc },
  scoreChiffres: { fontFamily: P.titreLourd, fontSize: 38, letterSpacing: -1.8, color: C.blanc, fontVariant: ['tabular-nums'] },
  tuiles: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tuileChiffre: { flex: 1, padding: 10, borderRadius: 14, backgroundColor: C.blanc06 },
  tuileValeur: { fontFamily: P.titre, fontSize: 15, letterSpacing: -0.3, color: C.blanc, marginTop: 5 },
  tuileDetail: { fontFamily: P.mono, fontSize: 9.5, color: C.blanc34, marginTop: 2 },
  fait: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  faitPoint: { width: 5, height: 5, borderRadius: 999, backgroundColor: C.braise, marginTop: 7 },
  faitTexte: { flex: 1, fontSize: 13, lineHeight: 18, color: C.blanc60 },
});
