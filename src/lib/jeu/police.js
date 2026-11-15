// La police du score et de « BUT » (bola-app#26, lot 4 ; décision 1 de bola-app#25, PAS ENCORE VALIDÉE par Sabri).
//
// On garde Anton pour l'instant. Pour passer à Inter 800, changer UN mot ci-dessous : 'anton' → 'inter'. Les trois
// endroits de la page (src/app/jouer/page.tsx : le tableau du haut, « BUT », le score de la fin) lisent CLASSE_SCORE ;
// le tableau du cube suspendu (match.js, peint sur une toile) lit POLICES[POLICE_SCORE]. Rien d'autre à toucher : Inter
// est déjà chargée par l'app (src/app/layout.tsx, --font-inter).
export const POLICE_SCORE = 'anton';

export const POLICES = {
  // fichier : la police chargée pour la toile du cube ; variable : la variable CSS de l'app (Inter)
  anton: { classe: 'font-[family-name:var(--font-anton)]', fichier: '/jeu/plateau/anton-latin.woff2', famille: 'BolaAnton', graisse: '' },
  inter: { classe: 'font-[family-name:var(--font-inter)] font-extrabold tracking-[-0.02em]', fichier: null, variable: '--font-inter', graisse: '800' },
};

/** La classe Tailwind du score et de « BUT » dans la page. */
export const CLASSE_SCORE = POLICES[POLICE_SCORE].classe;
