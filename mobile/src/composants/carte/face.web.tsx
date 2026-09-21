/**
 * Point d'entrée web de la face.
 *
 * Sur le web, Skia tourne sur CanvasKit (WebAssembly), et l'objet `Skia` est
 * construit AU MOMENT OÙ le module est importé. Si CanvasKit n'est pas encore
 * là à cet instant, `Skia` naît vide et toute la page tombe au premier dessin.
 * Retarder le rendu ne suffit donc pas : il faut retarder l'import lui-même.
 * D'où ce chargement paresseux, qui attend CanvasKit avant d'évaluer le module.
 */
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { lazy, Suspense, type ComponentProps } from 'react';
import { View } from 'react-native';

/** Version du paquet canvaskit-wasm installé par react-native-skia. */
const VERSION_CANVASKIT = '0.41.0';

const FaceSkia = lazy(async () => {
  await LoadSkiaWeb({
    locateFile: (fichier: string) =>
      `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${VERSION_CANVASKIT}/bin/full/${fichier}`,
  });
  return import('./face.skia').then((m) => ({ default: m.FaceCarte }));
});

type Props = ComponentProps<typeof FaceSkia>;

export function FaceCarte(props: Props) {
  // En attendant : un emplacement de la bonne taille, pour que la mise en
  // page ne saute pas quand la carte apparaît.
  return (
    <Suspense
      fallback={<View style={{ width: props.largeur, height: props.largeur * 1.5, borderRadius: 0.093 * props.largeur, backgroundColor: '#181c21' }} />}>
      <FaceSkia {...props} />
    </Suspense>
  );
}
