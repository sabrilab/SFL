/**
 * Le volume de la carte : une plaque avec une tranche, qui tourne sous le
 * doigt, s'incline avec le téléphone, et se retourne au double-toucher.
 *
 * Pas de moteur 3D. La perspective et deux rotations donnent 90 % de l'effet ;
 * la tranche fait le reste : quatre bandes qui n'apparaissent que du côté qui
 * se présente à l'œil, larges comme l'épaisseur × sin(angle). C'est ce qui
 * transforme une image inclinée en objet.
 *
 * Le geste ne se bat pas avec le défilement : glisser à l'horizontale tourne
 * la carte, glisser à la verticale fait défiler l'écran. L'inclinaison en X,
 * elle, vient du téléphone (gyroscope), comme une carte qu'on tient en main.
 */
import { DeviceMotion } from 'expo-sensors';
import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useDerivedValue, useSharedValue,
  withDecay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import type { CarteJoueur } from '@/donnees/joueurs';
import { FaceCarte } from './face';
import { RAYON, L } from './grille';

const DEG = 180 / Math.PI;
const REPOS_Y = -0.3 * DEG;          // angle de repos
const LIMITE_X = 0.55 * DEG;         // limite d'inclinaison
const SENSIBILITE_Y = 0.008 * DEG;   // par pixel horizontal

/** Épaisseur : 3,2 % de la largeur, bornée — un ou deux millimètres à l'écran. */
const epaisseurDe = (largeur: number) => Math.min(9, Math.max(5, largeur * 0.032));

export function CarteVolume({ joueur, largeur }: { joueur: CarteJoueur; largeur: number }) {
  const rotY = useSharedValue(REPOS_Y);
  const rotX = useSharedValue(0);
  const inclinaison = useSharedValue(0);   // ce que dit le gyroscope
  const retournee = useSharedValue(0);     // 0 face, 1 dos
  const balancement = useSharedValue(0);
  const flottement = useSharedValue(0);

  useEffect(() => {
    balancement.value = withRepeat(withSequence(
      withTiming(1, { duration: 9800, easing: Easing.inOut(Easing.sin) }),
      withTiming(-1, { duration: 9800, easing: Easing.inOut(Easing.sin) })), -1, true);
    flottement.value = withRepeat(withSequence(
      withTiming(1, { duration: 3900, easing: Easing.inOut(Easing.sin) }),
      withTiming(-1, { duration: 3900, easing: Easing.inOut(Easing.sin) })), -1, true);
  }, [balancement, flottement]);

  // Le téléphone incline la carte. Doucement : c'est un reflet de la main,
  // pas un manche à balai. Rien sur le web, où il n'y a pas de capteur.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let abonnement: { remove: () => void } | undefined;
    DeviceMotion.isAvailableAsync().then((ok) => {
      if (!ok) return;
      DeviceMotion.setUpdateInterval(60);
      abonnement = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation) return;
        // beta : tangage avant/arrière. On soustrait la tenue naturelle (~35°)
        // pour que la carte soit à plat quand le téléphone est tenu normalement.
        const beta = rotation.beta * DEG - 35;
        inclinaison.value = withTiming(Math.max(-14, Math.min(14, -beta * 0.35)), { duration: 90 });
      });
    });
    return () => abonnement?.remove();
  }, [inclinaison]);

  const rappel = () => {
    'worklet';
    rotY.value = withSpring(REPOS_Y + retournee.value * 180, { damping: 18, stiffness: 22, mass: 1.4 });
    rotX.value = withSpring(0, { damping: 16, stiffness: 30 });
  };

  const glisser = Gesture.Pan()
    // Horizontal : la carte. Vertical : la liste. Les deux ne se disputent plus.
    .activeOffsetX([-6, 6])
    .failOffsetY([-10, 10])
    .onBegin(() => { cancelAnimation(rotY); cancelAnimation(rotX); })
    .onChange((e) => {
      rotY.value += e.changeX * SENSIBILITE_Y;
      rotX.value = Math.max(-LIMITE_X, Math.min(LIMITE_X, rotX.value - e.changeY * 0.006 * DEG));
    })
    .onEnd((e) => {
      rotY.value = withDecay({ velocity: e.velocityX * SENSIBILITE_Y, deceleration: 0.996 }, () => rappel());
      rotX.value = withSpring(0, { damping: 16, stiffness: 30 });
    });

  const retourner = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    retournee.value = retournee.value ? 0 : 1;
    rappel();
  });

  const angleY = useDerivedValue(() => rotY.value + balancement.value * 0.16 * DEG);
  const angleX = useDerivedValue(() => rotX.value + inclinaison.value + flottement.value * 0.07 * DEG * 0.5);

  const stylePlaque = useAnimatedStyle(() => ({
    transform: [
      { perspective: largeur * 2.6 },
      { translateY: flottement.value * largeur * 0.012 },
      { rotateY: `${angleY.value}deg` },
      { rotateX: `${angleX.value}deg` },
    ],
  }));

  const styleOmbre = useAnimatedStyle(() => {
    const c = Math.abs(Math.cos(angleY.value / DEG));
    return { opacity: 0.28 + 0.32 * c, transform: [{ scaleX: 0.55 + 0.4 * c }] };
  });

  const versDos = (a: number) => { 'worklet'; const m = ((a % 360) + 360) % 360; return m > 90 && m < 270; };
  const styleDos = useAnimatedStyle(() => ({ opacity: versDos(angleY.value) ? 1 : 0 }));
  const styleFace = useAnimatedStyle(() => ({ opacity: versDos(angleY.value) ? 0 : 1 }));

  // La tranche. Quand la carte tourne vers la droite, c'est son flanc gauche
  // qui se présente : sa largeur apparente vaut épaisseur × |sin(angle)|.
  const ep = epaisseurDe(largeur);
  const styleGauche = useAnimatedStyle(() => {
    const s = Math.sin(angleY.value / DEG);
    return { width: Math.max(0, -s) * ep, opacity: s < 0 ? 1 : 0 };
  });
  const styleDroite = useAnimatedStyle(() => {
    const s = Math.sin(angleY.value / DEG);
    return { width: Math.max(0, s) * ep, opacity: s > 0 ? 1 : 0 };
  });
  const styleHaut = useAnimatedStyle(() => {
    const s = Math.sin(angleX.value / DEG);
    return { height: Math.max(0, s) * ep, opacity: s > 0 ? 1 : 0 };
  });
  const styleBas = useAnimatedStyle(() => {
    const s = Math.sin(angleX.value / DEG);
    return { height: Math.max(0, -s) * ep, opacity: s < 0 ? 1 : 0 };
  });

  const hauteur = largeur * 1.5;
  const rayon = (RAYON / L) * largeur;

  return (
    <View style={{ width: largeur, height: hauteur + largeur * 0.16, alignItems: 'center' }}>
      <Animated.View style={[styles.ombre, { width: largeur, top: hauteur + largeur * 0.04 }, styleOmbre]}>
        <View style={styles.ombreLarge} />
        <View style={styles.ombreDense} />
      </Animated.View>

      <GestureDetector gesture={Gesture.Exclusive(retourner, glisser)}>
        <Animated.View style={[{ width: largeur, height: hauteur }, stylePlaque]}>
          {/* Les quatre flancs : matière un peu plus vive que la face, avec un
              filet clair au bord extérieur — le vernis de la tranche. */}
          <Animated.View style={[styles.flanc, { left: -1, top: rayon * 0.6, bottom: rayon * 0.6, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }, styleGauche]}>
            <LinearGradient colors={['#5a616b', '#2b3037', '#3a4048']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <View style={[styles.vernis, { left: 0, top: 0, bottom: 0, width: 1 }]} />
          </Animated.View>
          <Animated.View style={[styles.flanc, { right: -1, top: rayon * 0.6, bottom: rayon * 0.6, borderTopRightRadius: 3, borderBottomRightRadius: 3 }, styleDroite]}>
            <LinearGradient colors={['#3a4048', '#2b3037', '#5a616b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <View style={[styles.vernis, { right: 0, top: 0, bottom: 0, width: 1 }]} />
          </Animated.View>
          <Animated.View style={[styles.flanc, { top: -1, left: rayon * 0.6, right: rayon * 0.6 }, styleHaut]}>
            <LinearGradient colors={['#6a717b', '#2b3037']} style={StyleSheet.absoluteFill} />
          </Animated.View>
          <Animated.View style={[styles.flanc, { bottom: -1, left: rayon * 0.6, right: rayon * 0.6 }, styleBas]}>
            <LinearGradient colors={['#2b3037', '#4a5058']} style={StyleSheet.absoluteFill} />
          </Animated.View>

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
  ombre: { position: 'absolute', height: 20, alignItems: 'center', justifyContent: 'center' },
  ombreLarge: { position: 'absolute', width: '100%', height: 20, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.26)' },
  ombreDense: { position: 'absolute', width: '62%', height: 9, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)' },
  flanc: { position: 'absolute', overflow: 'hidden', backgroundColor: '#2b3037' },
  vernis: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)' },
  dos: { backgroundColor: '#181c21', overflow: 'hidden', transform: [{ scaleX: -1 }] },
  filet: { flex: 1, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.14)' },
  lueur: { position: 'absolute', left: '15%', right: '15%', top: '22%', height: '36%', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
});
