// Un encart qui change de place au-dessus de ce qu'on lit : le vote du jour
// de Ma carte (components/sfl/vote-du-jour.tsx). Il se range en une ligne une
// fois mes deux voix données, se déplie quand on le rouvre, paraît quand la
// feuille de mon match se remplit, s'en va à la fin du vote ; deux journées le
// même jour font deux encarts, qui peuvent changer dans la même image. Une
// seule règle, encart par encart (contrôles du 16/11/2026) :
//   · son haut est à l'écran : rien à faire, ce qui est au-dessus ne bouge pas,
//     et je le vois changer (se ranger, s'ouvrir, paraître, s'en aller) ;
//   · il croise le haut de l'écran et en montre encore au moins A_L_ECRAN px
//     (on regardait ses cartes : un petit téléphone a défilé jusqu'à la
//     seconde rangée) : rangé, sa ligne revient à l'écran ; déplié, on le
//     voit s'ouvrir ;
//   · rangé par ma voix, donnée ici sur une de ses cartes, même tout au bord :
//     sa ligne revient sous la pile des messages de cette voix (layout.tsx, en
//     haut au centre), c'est-à-dire dans l'écran utile, qui commence sous la
//     marge de défilement de l'encart (scrollIntoView s'y arrête) ;
//   · tout entier au-dessus de l'écran, ou un liseré au bord : ce que je lis ne
//     bouge pas, le défilement rattrape ce dont il a changé.
// Plusieurs encarts changés dans la même image (les voix des deux journées
// arrivent dans une seule relecture) : chacun est remis dans le repère d'avant,
// sans ce que le navigateur a déjà rattrapé de lui-même (Chrome :
// overflow-anchor ; Safari, donc l'iPhone, rien : hooks/use-fil-au-bas.ts) ni
// le changement des encarts au-dessus de lui ; la règle dit son geste, et les
// décalages s'additionnent en un seul défilement. Avant, chaque encart posait
// le sien depuis son propre défilement d'avant, et le second défaisait le
// premier : ma carte sautait de 434 px, sous Chrome aussi.
// Avant le contrôle du 16/11, l'encart rangé ramenait sa ligne dès qu'on
// l'avait touché une fois (la page remontait de 700 à 75 px), et sur iPhone,
// rangé au-dessus de l'écran, tout le contenu sautait de 460 px.
//
// PUR : hooks/use-encart-tenu.ts mesure les encarts et pose le défilement ;
// ceci décide. tools/vote-du-jour-check.ts le joue en valeurs littérales.

/** Ce qu'il doit montrer de lui sous le haut de l'écran pour être ce qu'on regarde (px) : une carte et son nom en montrent bien plus. */
export const A_L_ECRAN = 64;

/** Un intervalle vertical en px, mesuré depuis le haut de la fenêtre : la boîte d'un encart. */
export interface Bande {
  haut: number;
  bas: number;
}

/**
 * L'écran où défile la page, en px depuis le haut de la fenêtre : `bord`, son
 * haut ; `haut`, le haut de sa partie utile, sous la pile des messages de
 * confirmation (la marge de défilement de l'encart) ; `bas`, son bas.
 */
export interface Ecran {
  bord: number;
  haut: number;
  bas: number;
}

/** Le geste à faire pour un encart : ramener sa ligne à l'écran, ou décaler le défilement de `decaler` px (négatif : remonter). */
export type Rattrapage = { ramener: true } | { decaler: number } | null;

/**
 * La règle, pour un encart. `avant` et `apres` : sa boîte avant et après le
 * changement, dans le même repère (le défilement d'avant). Paru, sa boîte
 * d'avant est vide (bas = haut) ; parti, celle d'après (bas ≤ haut). `ici` :
 * il se range sous ma voix, donnée ici.
 */
export function rattrapage(avant: Bande, apres: Bande, ecran: Ecran, ici = false): Rattrapage {
  // Ce dont a bougé ce qui le suit.
  const dy = apres.bas - avant.bas;
  if (Math.abs(dy) < 1) return null;
  // Il reste une ligne à ramener (parti, il n'y a plus rien).
  const ligne = apres.bas > apres.haut;
  if (ici && dy < 0) {
    // Ma voix, donnée sur une de ses cartes : sa ligne finit sous la pile des messages qu'elle fait monter.
    if (avant.haut >= ecran.haut) return null;
    if (ligne && avant.bas > ecran.bord) return { ramener: true };
    return { decaler: dy };
  }
  // Son haut à l'écran, ou plus bas : rien de ce que je lis au-dessus ne bouge.
  if (avant.haut >= ecran.bord) return null;
  if (avant.bas > ecran.bord) {
    // Il croise le haut de l'écran : déplié, je le vois s'ouvrir ; rangé alors
    // que je regardais ses cartes, sa ligne revient.
    if (dy > 0) return null;
    if (ligne && avant.bas - ecran.bord >= A_L_ECRAN) return { ramener: true };
  }
  return { decaler: dy };
}

/**
 * Un encart mesuré par hooks/use-encart-tenu.ts. `haut` : son haut lu
 * maintenant, après le changement et ce que le navigateur a déjà rattrapé ;
 * parti (`parti`), il n'en a plus : c'est celui d'avant son départ, déjà dans
 * le repère d'avant. `avant` et `apres` : sa hauteur (0 : il n'était pas là, ou
 * n'y est plus). `marges` : ce qu'il prend en plus dans la page quand il paraît
 * ou s'en va. `ici` : il se range sous ma voix, donnée ici.
 */
export interface Mesure {
  haut: number;
  avant: number;
  apres: number;
  marges?: number;
  ici?: boolean;
  parti?: boolean;
}

/** Le geste de l'image, pour tous les encarts : ramener la ligne de l'encart n° `ramener`, ou décaler le défilement d'avant de `decaler` px. */
export type Geste = { ramener: number } | { decaler: number } | null;

/**
 * Tous les encarts de la page, dans l'ordre de la page, quand l'un au moins a
 * changé : un seul geste. `deja` : ce que le navigateur a rattrapé de lui-même
 * depuis le changement (le défilement d'avant moins celui de maintenant ;
 * Safari : 0). Une ligne à ramener l'emporte ; sinon, les décalages
 * s'additionnent, à partir du défilement d'avant.
 */
export function rattrapageDesEncarts(mesures: readonly Mesure[], deja: number, ecran: Ecran): Geste {
  // Ce dont ont changé les encarts déjà vus, au-dessus de celui-ci.
  let dessus = 0;
  let decaler = 0;
  for (let i = 0; i < mesures.length; i++) {
    const m = mesures[i];
    const place = (h: number) => (h > 0 ? h + (m.marges ?? 0) : 0);
    const dy = place(m.apres) - place(m.avant);
    // Son haut dans le repère d'avant.
    const haut = m.parti ? m.haut : m.haut - deja - dessus;
    const geste = rattrapage({ haut, bas: haut + m.avant }, { haut, bas: haut + m.avant + dy }, ecran, m.ici);
    if (geste && "ramener" in geste) return { ramener: i };
    if (geste) decaler += geste.decaler;
    dessus += dy;
  }
  return Math.abs(decaler) >= 1 ? { decaler } : null;
}
