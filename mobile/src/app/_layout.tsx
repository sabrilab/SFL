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

import { C } from '@/da/theme';

SplashScreen.preventAutoHideAsync();

export default function Racine() {
  const [pretes] = useFonts({
    Archivo_700Bold,
    Archivo_800ExtraBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    if (pretes) SplashScreen.hideAsync();
  }, [pretes]);

  if (!pretes) return <View style={{ flex: 1, backgroundColor: C.noir }} />;

  return (
    <>
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
    </>
  );
}
