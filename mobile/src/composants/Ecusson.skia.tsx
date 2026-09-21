/**
 * L'écusson, dessiné en Skia sur une grille 100 × 110.
 * Une forme, un motif à deux couleurs, un liseré, un monogramme. Le même
 * dessin à 24 px dans un classement et à 120 px en tête de l'équipe.
 */
import { Canvas, Group, Path, Rect, Skia, Text, useTypeface } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { Ecusson as Donnees, Forme } from '@/donnees/equipes';

const ANTON = require('@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf');

const CHEMINS: Record<Forme, string> = {
  ecu: 'M10 8 H90 V58 C90 84 70 98 50 104 C30 98 10 84 10 58 Z',
  rond: 'M50 9 A46 46 0 1 1 49.99 9 Z',
  pointe: 'M50 4 L92 22 V60 L50 106 L8 60 V22 Z',
};

/** Le texte doit tenir sur la couleur de fond : clair sur foncé, foncé sur clair. */
function lisible(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? '#0B0C0E' : '#F4F5F2';
}

export function Ecusson({ ecusson, taille }: { ecusson: Donnees; taille: number }) {
  const tf = useTypeface(ANTON);
  const forme = useMemo(() => Skia.Path.MakeFromSVGString(CHEMINS[ecusson.forme])!, [ecusson.forme]);
  const [c1, c2] = ecusson.couleurs;
  const lettres = ecusson.monogramme.slice(0, 3).toUpperCase();
  const corps = lettres.length >= 3 ? 30 : 38;
  const font = useMemo(() => (tf ? Skia.Font(tf, corps) : null), [tf, corps]);
  const largeurTexte = useMemo(() => {
    if (!font) return 0;
    return font.getGlyphWidths(font.getGlyphIDs(lettres)).reduce((s, w) => s + w, 0);
  }, [font, lettres]);
  const e = taille / 100;

  return (
    <Canvas style={{ width: taille, height: taille * 1.1 }}>
      <Group transform={[{ scale: e }]}>
        <Group clip={forme}>
          <Rect x={0} y={0} width={100} height={110} color={c1} />
          {ecusson.motif === 'bandes' && [22, 50, 78].map((x) => (
            <Rect key={x} x={x - 7} y={0} width={14} height={110} color={c2} />
          ))}
          {ecusson.motif === 'diagonale' && (
            <Group transform={[{ rotate: -0.62 }]} origin={{ x: 50, y: 55 }}>
              <Rect x={-30} y={40} width={160} height={30} color={c2} />
            </Group>
          )}
          {ecusson.motif === 'moitie' && <Rect x={50} y={0} width={50} height={110} color={c2} />}
          {/* Un léger voile bas : l'écusson a un dessus et un dessous. */}
          <Rect x={0} y={70} width={100} height={40} color="rgba(0,0,0,0.16)" />
        </Group>
        <Path path={forme} style="stroke" strokeWidth={3.5} color="rgba(0,0,0,0.38)" />
        <Path path={forme} style="stroke" strokeWidth={1.2} color="rgba(255,255,255,0.22)" />
        {font && (
          <Text font={font} text={lettres} x={50 - largeurTexte / 2} y={ecusson.forme === 'pointe' ? 66 : 68}
            color={lisible(ecusson.motif === 'moitie' ? c1 : c1)} />
        )}
      </Group>
    </Canvas>
  );
}
