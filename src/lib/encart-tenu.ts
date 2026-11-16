// Un encart qui change de hauteur au-dessus de ce qu'on lit : le vote du
// jour de Ma carte (components/sfl/vote-du-jour.tsx), qui se range en une
// ligne une fois mes deux voix données, et se déplie quand mes voix relues
// disent qu'il m'en reste à donner. Une seule règle (contrôle du 16/11/2026) :
//   · son haut est à l'écran : rien à faire, sa ligne y reste d'elle-même ;
//   · son haut est passé au-dessus de l'écran, mais il en montre encore au
//     moins A_L_ECRAN px (on regardait ses cartes : un petit téléphone a
//     défilé jusqu'à la seconde rangée) : rangé, sa ligne revient à l'écran
//     (scrollIntoView, sous la pile des messages : sa scroll-margin) ;
//     déplié, on le voit s'ouvrir ;
//   · tout entier au-dessus de l'écran, ou un liseré au bord : ce que je lis
//     ne bouge pas, le défilement rattrape ce dont il a changé. Chrome le
//     fait seul (overflow-anchor) ; Safari, donc l'iPhone, non
//     (hooks/use-fil-au-bas.ts) : l'encart mesure ce que le navigateur a déjà
//     rattrapé, et ne fait que le reste.
// L'écran, c'est sa partie utile : sous la pile des messages de confirmation
// (layout.tsx, en haut au centre), que l'encart garde en scroll-margin. Une
// ligne rangée juste sous le titre de la page, sous les messages de la voix
// qu'on vient de donner, compte comme passée au-dessus : elle redescend.
// Avant, l'encart rangé ramenait sa ligne dès qu'on l'avait touché une fois,
// même descendu lire sa carte quand ses voix arrivaient d'ailleurs (la page
// remontait de 700 à 75 px) ; et sur iPhone, rangé au-dessus de l'écran sans
// qu'on l'ait touché, tout le contenu sautait de 460 px.
//
// PUR : l'encart mesure, avant et après son changement, dans le même repère
// (comme si le navigateur n'avait pas défilé de lui-même) ; ceci décide.

/** Ce qu'il doit montrer de lui pour être ce qu'on regarde (px) : une carte et son nom en montrent bien plus. */
export const A_L_ECRAN = 64;

/** Un intervalle vertical en px, mesuré depuis le haut de la fenêtre : une boîte, ou l'écran. */
export interface Bande {
  haut: number;
  bas: number;
}

/** Le geste à faire : ramener sa ligne à l'écran, ou décaler le défilement de `decaler` px (négatif : remonter). */
export type Rattrapage = { ramener: true } | { decaler: number } | null;

export function rattrapage(avant: Bande, apres: Bande, ecran: Bande): Rattrapage {
  // Son haut à l'écran, ou plus bas : rien de ce que je lis au-dessus ne bouge.
  if (avant.haut >= ecran.haut) return null;
  // Ce dont a bougé ce qui le suit.
  const dy = apres.bas - avant.bas;
  if (avant.bas > ecran.haut) {
    // Il croise l'écran : déplié, je le vois s'ouvrir ; rangé alors que je
    // regardais ses cartes, sa ligne revient.
    if (dy >= 0) return null;
    if (avant.bas - ecran.haut >= A_L_ECRAN) return { ramener: true };
  }
  return Math.abs(dy) >= 1 ? { decaler: dy } : null;
}
