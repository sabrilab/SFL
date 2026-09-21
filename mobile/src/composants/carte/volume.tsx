/**
 * Le volume de la carte : perspective, rotation sous le doigt, inertie,
 * retour lent à l'angle de repos, retournement au double-toucher.
 *
 * Pas de moteur 3D : une perspective et deux rotations sur la vue suffisent à
 * 90 % de l'effet pour 5 % du coût, et ça tient dans une liste. Les valeurs de
 * manipulation sont celles du document de design, converties de radians en
 * degrés pour les transformations natives.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useDerivedValue, useSharedValue,
  withDecay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

import type { CarteJoueur } from '@/donnees/joueurs';
import { FaceCarte } from './face';
import { FOND, RAYON, L } from './grille';

const DEG = 180 / Math.PI;
const REPOS_Y = -0.3 * DEG;          // angle de repos
const LIMITE_X = 0.7 * DEG;          // limite d'inclinaison
const SENSIBILITE_Y = 0.008 * DEG;   // par pixel horizontal
const SENSIBILITE_X = 0.006 * DEG;   // par pixel vertical

export function CarteVolume({ joueur, largeur }: { joueur: CarteJoueur; largeur: number }) {
  const rotY = useSharedValue(REPOS_Y);
  const rotX = useSharedValue(0);
  const retournee = useSharedValue(0);       // 0 face, 1 dos
  const balancement = useSharedValue(0);     // le lent va-et-vient au repos
  const flottement = useSharedValue(0);

  useEffect(() => {
    // La carte ne reste jamais parfaitement immobile : elle respire.
    balancement.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 9800, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 9800, easing: Easing.inOut(Easing.sin) }),
      ), -1, true);
    flottement.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3900, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: 3900, easing: Easing.inOut(Easing.sin) }),
      ), -1, true);
  }, [balancement, flottement]);

  const rappel = () => {
    'worklet';
    const cible = REPOS_Y + retournee.value * 180;
    // Un ressort mou d'abord : la carte « glisse » après le lâcher au lieu de
    // revenir sèchement. C'est ce délai qui donne le poids.
    rotY.value = withSpring(cible, { damping: 18, stiffness: 22, mass: 1.4 });
    rotX.value = withSpring(0, { damping: 16, stiffness: 30 });
  };

  const glisser = Gesture.Pan()
    .onBegin(() => { cancelAnimation(rotY); cancelAnimation(rotX); })
    .onChange((e) => {
      rotY.value += e.changeX * SENSIBILITE_Y;
      rotX.value = Math.max(-LIMITE_X, Math.min(LIMITE_X, rotX.value - e.changeY * SENSIBILITE_X));
    })
    .onEnd((e) => {
      rotY.value = withDecay({ velocity: e.velocityX * SENSIBILITE_Y, deceleration: 0.996 }, () => rappel());
      rotX.value = withDecay({ velocity: -e.velocityY * SENSIBILITE_X, deceleration: 0.994,
        clamp: [-LIMITE_X, LIMITE_X] });
    });

  const retourner = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    retournee.value = retournee.value ? 0 : 1;
    rappel();
  });

  const angleY = useDerivedValue(() => rotY.value + balancement.value * 0.16 * DEG);
  const angleX = useDerivedValue(() => rotX.value + flottement.value * 0.07 * DEG * 0.5);

  const stylePlaque = useAnimatedStyle(() => ({
    transform: [
      { perspective: largeur * 2.6 },
      { translateY: flottement.value * largeur * 0.012 },
      { rotateY: `${angleY.value}deg` },
      { rotateX: `${angleX.value}deg` },
    ],
  }));

  // L'ombre suit la rotation : plus la carte se couche, plus elle s'étale et s'éclaircit.
  const styleOmbre = useAnimatedStyle(() => {
    const c = Math.abs(Math.cos((angleY.value / DEG)));
    return {
      opacity: 0.28 + 0.32 * c,
      transform: [{ scaleX: 0.55 + 0.4 * c }, { translateY: -flottement.value * largeur * 0.01 }],
    };
  });

  // Le dos n'apparaît qu'au-delà de 90° ; sinon il transparaît à travers la face.
  const styleDos = useAnimatedStyle(() => {
    const a = ((angleY.value % 360) + 360) % 360;
    return { opacity: a > 90 && a < 270 ? 1 : 0 };
  });
  const styleFace = useAnimatedStyle(() => {
    const a = ((angleY.value % 360) + 360) % 360;
    return { opacity: a > 90 && a < 270 ? 0 : 1 };
  });

  const hauteur = largeur * 1.5;
  const rayon = (RAYON / L) * largeur;

  return (
    <View style={{ width: largeur, height: hauteur + largeur * 0.22, alignItems: 'center' }}>
      <Animated.View style={[styles.ombre, { width: largeur, top: hauteur + largeur * 0.05 }, styleOmbre]}>
        <View style={styles.ombreLarge} />
        <View style={styles.ombreDense} />
      </Animated.View>
      <GestureDetector gesture={Gesture.Exclusive(retourner, glisser)}>
        <Animated.View style={[{ width: largeur, height: hauteur }, stylePlaque]}>
          {/* La tranche : un léger décalage sombre sous la face donne l'épaisseur. */}
          <View style={[styles.tranche, { borderRadius: rayon, top: largeur * 0.012 }]} />
          <Animated.View style={[StyleSheet.absoluteFill, styleFace]}>
            <FaceCarte joueur={joueur} largeur={largeur} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.dos, { borderRadius: rayon }, styleDos]}>
            <View style={[styles.filet, { borderRadius: rayon * 0.72, margin: largeur * 0.06 }]} />
            <View style={styles.lueur} />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  ombre: { position: 'absolute', height: 22, alignItems: 'center', justifyContent: 'center' },
  ombreLarge: { position: 'absolute', width: '100%', height: 22, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.28)' },
  ombreDense: { position: 'absolute', width: '62%', height: 10, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' },
  tranche: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#0a0c0f' },
  dos: {
    backgroundColor: FOND[1], overflow: 'hidden', transform: [{ scaleX: -1 }],
  },
  filet: { flex: 1, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.14)' },
  lueur: {
    position: 'absolute', left: '15%', right: '15%', top: '22%', height: '36%', borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
});
