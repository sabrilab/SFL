/**
 * La face de la carte, peinte en Skia.
 *
 * Une seule image : la photo occupe tout le fond, la typographie est posée
 * dessus, et tout le travail consiste à rendre le texte lisible sans masquer
 * le joueur. Les calques suivent l'ordre du document de design — fond, photo,
 * numéro fondu en « screen », voiles, textes, vignettage, grain — parce que
 * chaque calque suppose les précédents.
 *
 * Skia plutôt que des vues empilées pour deux effets que React Native ne sait
 * pas faire autrement, et qui font tenir l'ensemble : le numéro en fusion
 * « screen » (il se dépose DANS la photo au lieu de flotter dessus) et le grain
 * en « overlay » (sans lui, le texte a l'air collé sur l'image).
 */
import {
  Canvas, ColorMatrix, FractalNoise, Group, Image, LinearGradient, Path, Rect,
  RoundedRect, Shadow, Skia, Text, TwoPointConicalGradient, rect, rrect,
  useImage, useTypeface, vec, type SkFont, type SkTypeface,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';

import type { CarteJoueur } from '@/donnees/joueurs';
import { ENCRE, ESPACEMENT, FOND, H, L, PAD, RAYON, SUR_ACCENT, TAILLE, VOILE, Y } from './grille';

const ANTON = require('@expo-google-fonts/anton/400Regular/Anton_400Regular.ttf');
const MONO_700 = require('@expo-google-fonts/jetbrains-mono/700Bold/JetBrainsMono_700Bold.ttf');
const MONO_600 = require('@expo-google-fonts/jetbrains-mono/600SemiBold/JetBrainsMono_600SemiBold.ttf');

/** Désature un bruit coloré : le grain doit être monochrome. */
const GRIS = [
  0.33, 0.33, 0.33, 0, 0,
  0.33, 0.33, 0.33, 0, 0,
  0.33, 0.33, 0.33, 0, 0,
  0, 0, 0, 1, 0,
];

/**
 * La largeur d'un texte, par la somme des avances de glyphes. C'est la seule
 * mesure disponible partout : la mesure directe de Skia n'existe pas sur le
 * web, et l'aperçu passe par là.
 */
function largeurTexte(font: SkFont, texte: string, espacement = 0) {
  const largeurs = font.getGlyphWidths(font.getGlyphIDs(texte));
  return largeurs.reduce((s, w) => s + w, 0) + espacement * Math.max(0, texte.length - 1);
}

/**
 * Skia ne connaît pas l'interlettrage : on pose les glyphes un par un.
 * C'est ce qui donne aux libellés mono leur respiration.
 */
function TexteEspace({
  font, texte, x, y, espacement, couleur, alignement = 'gauche',
}: {
  font: SkFont; texte: string; x: number; y: number; espacement: number;
  couleur: string; alignement?: 'gauche' | 'droite' | 'centre';
}) {
  const positions = useMemo(() => {
    const glyphes = font.getGlyphIDs(texte);
    const largeurs = font.getGlyphWidths(glyphes);
    const total = largeurs.reduce((s, w) => s + w, 0) + espacement * Math.max(0, texte.length - 1);
    let curseur = alignement === 'droite' ? x - total : alignement === 'centre' ? x - total / 2 : x;
    return [...texte].map((c, i) => {
      const p = { c, x: curseur };
      curseur += largeurs[i] + espacement;
      return p;
    });
  }, [font, texte, x, espacement, alignement]);

  return (
    <>
      {positions.map((p, i) => (
        <Text key={i} font={font} text={p.c} x={p.x} y={y} color={couleur} />
      ))}
    </>
  );
}

/** Le nom se réduit par pas de 4 jusqu'à tenir : il ne heurte jamais la note. */
function policeAjustee(tf: SkTypeface, texte: string, maxL: number, depart: number) {
  let taille = depart;
  while (taille > 20) {
    const f = Skia.Font(tf, taille);
    if (largeurTexte(f, texte) <= maxL) return f;
    taille -= 4;
  }
  return Skia.Font(tf, 20);
}

export function FaceCarte({ joueur, largeur }: { joueur: CarteJoueur; largeur: number }) {
  const tfAnton = useTypeface(ANTON);
  const tfMono700 = useTypeface(MONO_700);
  const tfMono600 = useTypeface(MONO_600);
  const photo = useImage(joueur.photo);

  const polices = useMemo(() => {
    if (!tfAnton || !tfMono700 || !tfMono600) return null;
    const anton = (t: number) => Skia.Font(tfAnton, t);
    const mono700 = (t: number) => Skia.Font(tfMono700, t);
    return {
      numero: anton(TAILLE.numero), note: anton(TAILLE.note), statValeur: anton(TAILLE.statValeur),
      club: mono700(TAILLE.club), poste: mono700(TAILLE.poste), general: mono700(TAILLE.general),
      statLibelle: mono700(TAILLE.statLibelle), mention: mono700(TAILLE.mention),
      placeholder: mono700(34), pseudo: Skia.Font(tfMono600, TAILLE.pseudo),
    };
  }, [tfAnton, tfMono700, tfMono600]);

  // La photo en « cover », ancrée à 10 % du haut : le visage reste dans le cadre.
  // Le facteur 1,04 évite un liseré de fond sur les bords après arrondi.
  const cadrePhoto = useMemo(() => {
    if (!photo) return null;
    const sc = Math.max(L / photo.width(), H / photo.height()) * 1.04;
    const w = photo.width() * sc, h = photo.height() * sc;
    return rect((L - w) / 2, (H - h) * 0.1, w, h);
  }, [photo]);

  const noteTexte = String(joueur.note);
  const numeroTexte = String(joueur.numero ?? joueur.note);

  const mesures = useMemo(() => {
    if (!polices || !tfAnton) return null;
    const largeurNote = largeurTexte(polices.note, noteTexte);
    const nom = policeAjustee(tfAnton, joueur.nom, L - PAD * 2 - largeurNote - 48, TAILLE.nom);
    const largeurNumero = largeurTexte(polices.numero, numeroTexte);
    const largeurMention = joueur.mention
      ? largeurTexte(polices.mention, joueur.mention, ESPACEMENT.mention) + 56
      : 0;
    // Anton : les capitales montent à ~72 % du corps. La mention se pose 28 px
    // au-dessus de ce sommet, jamais sur les lettres.
    const hauteurNom = nom.getSize() * 0.72;
    const yMention = Y.nom - hauteurNom - 28 - 64;
    return { largeurNote, nom, largeurNumero, largeurMention, yMention };
  }, [polices, tfAnton, joueur.nom, joueur.mention, noteTexte, numeroTexte]);

  // Hachures du placeholder : une seule géométrie, construite une fois.
  const hachures = useMemo(() => {
    const p = Skia.Path.Make();
    for (let i = -H; i < L + H; i += 64) { p.moveTo(i, H); p.lineTo(i + H, 0); }
    return p;
  }, []);

  const echelle = largeur / L;
  const colonne = (L - PAD * 2) / 6;
  const contour = rrect(rect(0, 0, L, H), RAYON, RAYON);

  return (
    <Canvas style={{ width: largeur, height: largeur * 1.5 }}>
      <Group transform={[{ scale: echelle }]} clip={contour}>
        {/* 1. Fond — visible seulement là où la photo ne couvre pas */}
        <Rect x={0} y={0} width={L} height={H}>
          <LinearGradient start={vec(0, 0)} end={vec(L * 0.6, H)} colors={FOND} positions={[0, 0.5, 1]} />
        </Rect>

        {/* 2. Photo, ou l'état « pas encore de photo » */}
        {photo && cadrePhoto ? (
          <Image image={photo} rect={cadrePhoto} fit="fill" />
        ) : (
          <>
            <Rect x={0} y={0} width={L} height={H}>
              <TwoPointConicalGradient
                start={vec(L / 2, H * 0.34)} startR={0} end={vec(L / 2, H * 0.34)} endR={L * 0.9}
                colors={[joueur.accent + '3a', 'rgba(0,0,0,0)']}
              />
            </Rect>
            <Path path={hachures} style="stroke" strokeWidth={30} color="rgba(255,255,255,0.07)" />
            {polices && (
              <TexteEspace font={polices.placeholder} texte="PHOTO JOUEUR" x={L / 2} y={H * 0.42}
                espacement={4} couleur={ENCRE(0.42)} alignement="centre" />
            )}
          </>
        )}

        {/* 3. Numéro géant, fondu dans la photo par « screen » */}
        {polices && mesures && (
          <Group blendMode="screen" opacity={0.3}>
            <Text font={polices.numero} text={numeroTexte} x={L - 40 - mesures.largeurNumero}
              y={Y.numero} color={joueur.accent} />
          </Group>
        )}

        {/* 4. Voile haut — discret, il ne descend qu'à 24,7 % */}
        <Rect x={0} y={0} width={L} height={380}>
          <LinearGradient start={vec(0, 0)} end={vec(0, 380)} colors={[VOILE(0.82), VOILE(0)]} />
        </Rect>
        {/* 5. Voile bas — le point à 55 % évite une marche au milieu de la poitrine */}
        <Rect x={0} y={H * 0.42} width={L} height={H * 0.58}>
          <LinearGradient start={vec(0, H * 0.42)} end={vec(0, H)}
            colors={[VOILE(0), VOILE(0.72), VOILE(0.96)]} positions={[0, 0.55, 1]} />
        </Rect>

        {/* 6. Textes */}
        {polices && mesures && (
          <>
            <TexteEspace font={polices.club} texte={joueur.club} x={PAD} y={Y.club}
              espacement={ESPACEMENT.club} couleur={ENCRE(0.86)} />
            <TexteEspace font={polices.poste} texte={joueur.poste} x={PAD} y={Y.poste}
              espacement={ESPACEMENT.poste} couleur={joueur.accent} />

            {joueur.mention && (
              <>
                <RoundedRect x={PAD} y={mesures.yMention} width={mesures.largeurMention} height={64} r={32}
                  color={joueur.accent} />
                <TexteEspace font={polices.mention} texte={joueur.mention} x={PAD + 28} y={mesures.yMention + 43}
                  espacement={ESPACEMENT.mention} couleur={SUR_ACCENT} />
              </>
            )}

            {/* La note : un chiffre nu avec une ombre douce, jamais une pastille */}
            <Text font={polices.note} text={noteTexte} x={L - PAD - mesures.largeurNote} y={Y.nom}
              color={joueur.accent}>
              <Shadow dx={0} dy={6} blur={19} color="rgba(0,0,0,0.55)" />
            </Text>
            <TexteEspace font={polices.general} texte="GÉNÉRAL" x={L - PAD + 6} y={Y.nom + 52}
              espacement={ESPACEMENT.general} couleur={ENCRE(0.62)} alignement="droite" />

            <Text font={mesures.nom} text={joueur.nom} x={PAD - 4} y={Y.nom} color={ENCRE(1)} />
            <Text font={polices.pseudo} text={joueur.pseudo} x={PAD} y={Y.pseudo} color={ENCRE(0.6)} />

            <Rect x={PAD} y={Y.filet} width={L - PAD * 2} height={2} color={ENCRE(0.22)} />

            {joueur.stats.map((s, i) => {
              const cx = PAD + colonne * i + colonne / 2;
              const valeur = String(s.valeur);
              const lv = largeurTexte(polices.statValeur, valeur);
              return (
                <Group key={s.cle}>
                  <Text font={polices.statValeur} text={valeur} x={cx - lv / 2} y={Y.stats} color={ENCRE(1)} />
                  <TexteEspace font={polices.statLibelle} texte={s.cle} x={cx} y={Y.stats + 34}
                    espacement={ESPACEMENT.statLibelle} couleur={ENCRE(0.55)} alignement="centre" />
                  {i > 0 && (
                    <Rect x={PAD + colonne * i} y={Y.stats - 46} width={2} height={74} color={ENCRE(0.14)} />
                  )}
                </Group>
              );
            })}
          </>
        )}

        {/* 7. Vignettage */}
        <Rect x={0} y={0} width={L} height={H}>
          <TwoPointConicalGradient
            start={vec(L / 2, H * 0.44)} startR={L * 0.24} end={vec(L / 2, H * 0.52)} endR={L * 0.95}
            colors={[VOILE(0), VOILE(0.4)]}
          />
        </Rect>

        {/* 8. Grain — c'est lui qui fait que la typo et la photo sont le même objet */}
        <Group blendMode="overlay" opacity={0.16}>
          <Rect x={0} y={0} width={L} height={H}>
            <FractalNoise freqX={0.9} freqY={0.9} octaves={2} seed={7} tileWidth={180} tileHeight={180} />
            <ColorMatrix matrix={GRIS} />
          </Rect>
        </Group>
      </Group>
    </Canvas>
  );
}
