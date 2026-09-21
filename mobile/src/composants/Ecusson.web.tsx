/**
 * Point d'entrée web : même raison que pour la face de la carte — l'objet Skia
 * naît à l'import du module, il faut donc attendre CanvasKit avant d'importer.
 */
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { lazy, Suspense, type ComponentProps } from 'react';
import { View } from 'react-native';

const VERSION_CANVASKIT = '0.41.0';

const EcussonSkia = lazy(async () => {
  await LoadSkiaWeb({
    locateFile: (fichier: string) =>
      `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${VERSION_CANVASKIT}/bin/full/${fichier}`,
  });
  return import('./Ecusson.skia').then((m) => ({ default: m.Ecusson }));
});

export function Ecusson(props: ComponentProps<typeof EcussonSkia>) {
  return (
    <Suspense fallback={<View style={{ width: props.taille, height: props.taille * 1.1 }} />}>
      <EcussonSkia {...props} />
    </Suspense>
  );
}
