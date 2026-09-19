/**
 * La ligne de tableau : un libellé mono, un intitulé, une jauge fine, un
 * chiffre aligné. C'est la grammaire de toutes les listes de l'app — stats,
 * classements, journées — pour qu'elles se lisent d'un même œil.
 */
import { StyleSheet, Text, View } from 'react-native';

import { C, P } from '@/da/theme';

export function Ligne({
  cle, texte, valeur, jauge, accentue, rang, moi,
}: {
  cle?: string;
  texte: string;
  sous?: string;
  valeur: string;
  /** Pourcentage 0–100 : affiche une jauge fine à droite de l'intitulé. */
  jauge?: number;
  accentue?: boolean;
  rang?: number;
  moi?: boolean;
}) {
  return (
    <View style={styles.ligne}>
      {rang !== undefined && (
        <Text style={[styles.rang, moi && { color: C.braise }]}>{rang}</Text>
      )}
      {cme(cle)}
      <Text style={[styles.texte, moi && styles.texteMoi]} numberOfLines={1}>
        {texte}
      </Text>
      {moi && <Text style={styles.puceMoi}>TOI</Text>}
      {jauge !== undefined && (
        <View style={styles.piste}>
          <View style={[styles.remplie, { width: `${Math.max(0, Math.min(100, jauge))}%` }]} />
        </View>
      )}
      <Text style={[styles.valeur, accentue && { color: C.braise }]}>{valeur}</Text>
    </View>
  );
}

function cme(cle?: string) {
  if (!cle) return null;
  return <Text style={styles.cle}>{cle}</Text>;
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.blanc12,
  },
  cle: { fontFamily: P.mono, fontSize: 10.5, letterSpacing: 1.3, width: 36, color: C.blanc34 },
  rang: { fontFamily: P.mono, fontSize: 12, width: 18, color: C.blanc34 },
  texte: { flex: 1, fontSize: 14, color: C.blanc60 },
  texteMoi: { color: C.blanc, fontWeight: '600' },
  puceMoi: {
    fontFamily: P.mono, fontSize: 8.5, letterSpacing: 1.1, color: C.braise,
    backgroundColor: C.braise18, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
    overflow: 'hidden',
  },
  piste: { width: 78, height: 2, backgroundColor: C.blanc12, overflow: 'hidden' },
  remplie: { height: 2, backgroundColor: C.clair },
  valeur: {
    fontFamily: P.monoMoyen, fontSize: 13, color: C.blanc,
    minWidth: 30, textAlign: 'right',
  },
});
