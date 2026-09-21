/**
 * La pile racine. Les trois onglets vivent dans `(tabs)` ; le détail d'un match
 * et l'ouverture d'un match sont présentés par-dessus, en feuille native
 * (`formSheet`) — la vraie feuille UIKit sur iOS, le bottom sheet Material sur
 * Android : poignée, glisser pour fermer et voile, sans une ligne à écrire.
 */
import {
  Archivo_700Bold,
  Archivo_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/archivo';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { C } from '@/da/theme';

SplashScreen.preventAutoHideAsync();

export default function Racine() {
  const [pretes, erreur] = useFonts({
    Archivo_700Bold,
    Archivo_800ExtraBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  // Une police qui ne se charge pas ne doit jamais retenir l'app : on afficherait
  // un écran noir sans fin, impossible à distinguer d'un plantage. Mieux vaut
  // démarrer avec la police du système que ne pas démarrer du tout.
  const pret = pretes || !!erreur;

  useEffect(() => {
    if (pret) SplashScreen.hideAsync().catch(() => {});
  }, [pret]);

  if (!pret) return <View style={{ flex: 1, backgroundColor: C.noir }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* L'app assume un seul monde, sombre : la barre système suit. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.noir },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="match/[id]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            sheetCornerRadius: 34,
            contentStyle: { backgroundColor: C.clair },
          }}
        />
        <Stack.Screen
          name="joueur/[id]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.78],
            sheetGrabberVisible: true,
            sheetCornerRadius: 34,
            contentStyle: { backgroundColor: C.noir },
          }}
        />
        <Stack.Screen
          name="equipe"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.94],
            sheetGrabberVisible: true,
            sheetCornerRadius: 34,
            contentStyle: { backgroundColor: C.clair },
          }}
        />
        <Stack.Screen
          name="ouvrir"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.86],
            sheetGrabberVisible: true,
            sheetCornerRadius: 34,
            contentStyle: { backgroundColor: C.clair },
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
