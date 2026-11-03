// Une rangée de cartes qui défile en largeur (Mes cartes, carriere-joueur.tsx)
// doit montrer qu'elle continue : la carte coupée au bord en laisse voir un
// peu, et en cache un peu. Avec les formats fixes des cartes (le nombre d'or,
// FORMAT_CARTE) et leur écart (13 px), il arrive qu'une carte finisse juste au
// bord et que la suivante commence juste après : à 375 px, la quatrième carte
// du jour d'Anas (sa Défensive, J4) était entièrement hors cadre, sans un
// liseré, et rien ne disait qu'il y en avait encore (contrôle du 03/11).
//
// Le remède ne touche ni aux cartes ni à leurs écarts entre elles : seul
// l'écart entre la première carte (celle de la saison) et les suivantes
// change, pris parmi ceux du nombre d'or (8, 21 ou 34 px au lieu de 13), et
// seulement quand le bord tombe mal.
//
// PUR : la rangée mesure ses cartes, ceci choisit l'écart.

/** Ce qu'une carte coupée au bord doit montrer, et cacher, au moins (px). */
export const DEPASSE = 16;

/**
 * Le décalage (px, à ajouter après la première carte) pour que la carte
 * coupée au bord en montre et en cache assez. `cartes` : les bords [début,
 * fin] de chaque carte, mesurés depuis le début de la rangée, sans décalage ;
 * `largeur` : ce qu'on voit de la rangée ; `ecart` : l'écart d'origine. 0 si
 * tout tient, si le bord coupe déjà bien une carte, ou si aucun écart essayé
 * ne fait mieux.
 */
export function decalageQuiDepasse(
  cartes: readonly (readonly [number, number])[],
  largeur: number,
  ecart = 13,
  essais: readonly number[] = [8, 21, 34],
): number {
  if (cartes.length < 2 || cartes[cartes.length - 1][1] <= largeur) return 0;
  /** Ce que la carte coupée montre et cache, au moins des deux (0 si le bord tombe entre deux cartes). */
  const coupe = (d: number) => {
    for (let i = 1; i < cartes.length; i++) {
      const debut = cartes[i][0] + d;
      const fin = cartes[i][1] + d;
      if (fin <= largeur) continue;
      return debut < largeur ? Math.min(largeur - debut, fin - largeur) : 0;
    }
    return 0;
  };
  const sans = coupe(0);
  if (sans >= DEPASSE) return 0;
  let meilleur = 0;
  let score = sans;
  for (const e of essais) {
    const d = e - ecart;
    const s = coupe(d);
    if (s > score || (s === score && Math.abs(d) < Math.abs(meilleur))) {
      meilleur = d;
      score = s;
    }
  }
  return meilleur;
}
