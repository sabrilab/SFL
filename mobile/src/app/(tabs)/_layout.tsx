/**
 * Trois onglets, pas neuf.
 *
 * `NativeTabs` rend la vraie barre du système : sur iOS 26 une `UITabBar` en
 * Liquid Glass, qui se réduit quand on fait défiler ; sur Android la barre
 * Material. Les icônes sont des SF Symbols côté iOS et des drawables côté
 * Android — chaque plateforme garde son vocabulaire.
 */
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { C } from '@/da/theme';

export default function Onglets() {
  return (
    <NativeTabs
      backgroundColor={C.noir}
      tintColor={C.clair}
      minimizeBehavior="onScrollDown"
      labelStyle={{ selected: { color: C.clair } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Jouer</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="soccerball" drawable="ic_menu_compass" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="carte">
        <NativeTabs.Trigger.Label>Ma carte</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.text.rectangle" drawable="ic_menu_myplaces" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ligue">
        <NativeTabs.Trigger.Label>Ligue</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="trophy" drawable="ic_menu_sort_by_size" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
