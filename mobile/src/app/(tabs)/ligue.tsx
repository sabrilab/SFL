/**
 * Ligue — trois rubriques côte à côte : Journée, Classement, Matchs.
 *
 * Elles ne sont pas empilées derrière un menu : passer de l'une à l'autre doit
 * coûter un pouce. Le contrôle segmenté reprend la mécanique d'un
 * `UISegmentedControl` et se comporte pareil sur Android.
 */
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Convocation } from '@/composants/Convocation';
import { Ecusson } from '@/composants/Ecusson';
import { Ligne } from '@/composants/Ligne';
import { Segment } from '@/composants/Segment';
import { Corps, Libelle, Titre } from '@/composants/Texte';
import { C, ESP, P, R } from '@/da/theme';
import { EQUIPES_DEMO, RENCONTRES_DEMO, classementEquipes } from '@/donnees/equipes';
import { JOUEURS } from '@/donnees/joueurs';
import { CLASSEMENTS, MOI } from '@/donnees/ligue';
import { useEtat } from '@/etat/store';
import { JOURNAL, RECORD_BUTS, manchette, meilleurs, scoreLisible, totalButs, type JourneeJournal } from '@/donnees/journal';

type Rubrique = 'journee' | 'classement' | 'matchs' | 'equipes';

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
          { cle: 'equipes', nom: 'Équipes' },
        ]}
      />

      <ScrollView
        contentContainerStyle={[styles.defile, { paddingBottom: 120 + bottom }]}
        showsVerticalScrollIndicator={false}>
        {rubrique === 'journee' && <Journee />}
        {rubrique === 'classement' && <Classement />}
        {rubrique === 'matchs' && <Journal />}
        {rubrique === 'equipes' && <Equipes />}
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
 * Les équipes — la sienne d'abord (ou l'invitation à la monter), puis le
 * classement. Monter une équipe est secondaire dans l'app : c'est ici, dans la
 * ligue, que ça prend son sens, pas devant « Jouer ».
 */
function Equipes() {
  const { equipe } = useEtat();
  const router = useRouter();
  const toutes = equipe ? [equipe, ...EQUIPES_DEMO] : EQUIPES_DEMO;
  const tableau = classementEquipes(toutes, RENCONTRES_DEMO);

  return (
    <>
      {equipe ? (
        <Pressable accessibilityRole="button" onPress={() => router.push('/equipe')}
          style={({ pressed }) => [styles.monEquipe, pressed && { opacity: 0.9 }]}>
          <Ecusson ecusson={equipe.ecusson} taille={64} />
          <View style={{ flex: 1 }}>
            <Libelle>TON ÉQUIPE · CAPITAINE</Libelle>
            <Text style={styles.monEquipeNom}>{equipe.nom}</Text>
            <Text style={styles.monEquipeJoueurs} numberOfLines={2}>
              {equipe.joueurs.map((j) => JOUEURS[j]?.nom ?? j.toUpperCase()).join(' · ')}
            </Text>
          </View>
          <Text style={styles.fleche}>→</Text>
        </Pressable>
      ) : (
        <Pressable accessibilityRole="button" onPress={() => router.push('/equipe')}
          style={({ pressed }) => [styles.invitation, pressed && { opacity: 0.9 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.invitationCle}>TU N&apos;AS PAS ENCORE D&apos;ÉQUIPE</Text>
            <Text style={styles.invitationTitre}>Monter une équipe</Text>
            <Text style={styles.invitationTexte}>
              Cinq à sept joueurs, un nom, un écusson. Elle entre au classement des équipes.
            </Text>
          </View>
          <Text style={[styles.fleche, { color: C.encre }]}>→</Text>
        </Pressable>
      )}

      <View style={styles.palmares}>
        <View style={styles.enteteePalmares}>
          <Libelle>CLASSEMENT DES ÉQUIPES</Libelle>
          <Libelle style={{ color: 'rgba(244,245,242,0.20)' }}>3 PTS LA VICTOIRE · 1 LE NUL</Libelle>
        </View>
        <View style={styles.lignes}>
          <View style={styles.tableauTete}>
            <Text style={[styles.tableauCle, { flex: 1 }]} />
            {['J', 'G', 'N', 'P', 'DIFF', 'PTS'].map((k) => (
              <Text key={k} style={[styles.tableauCle, { width: k === 'DIFF' ? 40 : 26, textAlign: 'right' }]}>{k}</Text>
            ))}
          </View>
          {tableau.map((l, i) => {
            const moi = l.equipe.id === 'moi';
            const diff = l.pour - l.contre;
            return (
              <View key={l.equipe.id} style={[styles.tableauLigne, moi && styles.tableauLigneMoi]}>
                <Text style={[styles.pos, moi && { color: C.braise }]}>{i + 1}</Text>
                <Ecusson ecusson={l.equipe.ecusson} taille={22} />
                <Text style={[styles.tableauNom, moi && { color: C.blanc, fontWeight: '600' }]} numberOfLines={1}>
                  {l.equipe.nom}
                </Text>
                {[l.joues, l.gagnes, l.nuls, l.perdus].map((v, k) => (
                  <Text key={k} style={styles.tableauValeur}>{v}</Text>
                ))}
                <Text style={[styles.tableauValeur, { width: 40 }]}>{diff > 0 ? `+${diff}` : diff}</Text>
                <Text style={[styles.tableauValeur, styles.tableauPoints]}>{l.points}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <Corps style={styles.note}>
        Le classement se nourrit des matchs entre équipes. Quand ton équipe joue un match
        que tu héberges, valide la feuille : c&apos;est elle qui compte.
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

  monEquipe: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, marginTop: 6, borderRadius: 22, backgroundColor: C.blanc06, borderWidth: StyleSheet.hairlineWidth, borderColor: C.blanc12 },
  monEquipeNom: { fontFamily: P.titre, fontSize: 20, letterSpacing: -0.6, color: C.blanc, marginTop: 4 },
  monEquipeJoueurs: { fontSize: 12, color: C.blanc60, marginTop: 3, lineHeight: 17 },
  fleche: { fontSize: 18, color: C.blanc60 },
  invitation: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, marginTop: 6, borderRadius: R.tuile, backgroundColor: C.clair },
  invitationCle: { fontFamily: P.mono, fontSize: 10, letterSpacing: 1.6, color: C.encre42 },
  invitationTitre: { fontFamily: P.titre, fontSize: 21, letterSpacing: -0.6, color: C.encre, marginTop: 6 },
  invitationTexte: { fontSize: 12.5, color: C.encre60, marginTop: 3, lineHeight: 18 },
  tableauTete: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: 26 + 22 + 8 },
  tableauCle: { fontFamily: P.mono, fontSize: 9, letterSpacing: 1, color: C.blanc34 },
  tableauLigne: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.blanc12 },
  tableauLigneMoi: { backgroundColor: 'rgba(255,138,76,0.06)' },
  pos: { fontFamily: P.mono, fontSize: 12, width: 18, color: C.blanc34 },
  tableauNom: { flex: 1, fontSize: 13.5, color: C.blanc60 },
  tableauValeur: { fontFamily: P.mono, fontSize: 12, width: 26, textAlign: 'right', color: C.blanc60 },
  tableauPoints: { fontFamily: P.monoMoyen, color: C.blanc },
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
