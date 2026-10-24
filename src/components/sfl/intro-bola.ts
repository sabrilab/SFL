// L'intro Bola : le logo qui s'anime à l'ouverture de l'app, pendant que tout
// se charge derrière (app-splash.tsx). Sabri, 24/10 : « enlève Sunday Five
// League… une vraie belle animation du logotype, très bien faite et rapide ».
//
// Le geste est celui de l'écran de chargement du site (bola-site, Loader.tsx,
// que Sabri a réglé le 28/09 : « le logo de la lune […] qui se fait : il faut
// que ça soit bien rond », « [le Bola] qui arrive à côté en mode stylé, et
// après, boum »), resserré (le logo est posé en 0,68 s) :
//  1. la lune naît : une ombre couvre d'abord tout le disque, puis glisse et
//     rétrécit jusqu'à devenir la balle du symbole ;
//  2. le logo recule et se recentre pendant que les lettres BOLA sortent du
//     symbole : elles glissent depuis son bord, découvertes par un rideau qui
//     suit la pente de leur italique ;
//  3. le logo posé, le voile se lève (sortir) : le logo s'avance en
//     s'effaçant, l'app arrive.
//
// Rien ne bouge autrement que par transform et opacity, sur des calques HTML :
// le navigateur joue ces animations hors du fil principal, qui est justement
// pris à ce moment-là par three.js et la compilation des shaders. Un tracé SVG
// redessiné à chaque image, comme sur le site, y saccaderait. D'où les deux
// papiers de la couleur du fond (l'ombre de la lune, le rideau des lettres),
// qui cachent au lieu de découper ; la lune née, le symbole officiel prend la
// place du disque et de son ombre (même dessin, un seul bord net).
//
// Mouvement réduit : le logo est posé d'emblée, et le voile se lève en fondu.

import { LOGO_BOLA } from "@/components/sfl/finitions-carte";

/** Le symbole et le logotype (public/bola/logo-*.svg, repère 1000 × 237). */
export const TRACES = {
  symbole: LOGO_BOLA.symbole,
  logotype: LOGO_BOLA.logotype,
  marque:
    "M982.275,44.059c0-14.903-12.081-26.984-26.984-26.984s-26.984,12.081-26.984,26.984,12.081,26.984,26.984,26.984,26.984-12.081,26.984-26.984ZM974.918,44.059c0,10.84-8.787,19.627-19.627,19.627s-19.627-8.787-19.627-19.627,8.787-19.627,19.627-19.627,19.627,8.787,19.627,19.627ZM943.798,57.971h7.816v-11.098h.117l7.073,11.098h8.871l-8.128-11.606c3.908-1.094,6.331-3.986,6.331-7.855,0-5.002-4.025-8.363-9.77-8.363h-12.31v27.824ZM954.857,35.774c2.149,0,3.282,1.133,3.282,2.853s-1.133,2.853-3.282,2.853h-3.244v-5.705h3.244Z",
} as const;

// Relevés sur ces tracés, dans le repère du logo.
const W = 1000;
const H = 237;
/** Le disque du symbole. */
const DISQUE = { cx: 73.186, cy: 159.672, r: 56.187 };
/** La balle qui le creuse (diamètre D/φ) ; elle déborde du disque en bas à droite. */
const BALLE = { cx: 86.45, cy: 181.134, r: 34.726 };
/** L'étendue du dessin, du bord du symbole au ® compris : ce qu'on centre. */
const ENCRE = { x0: 17, x1: 982.3, y0: 17, y1: 215.86 };
/** La pente de l'italique (le fût du B : 72,887 pour 181,823). */
const PENTE = 72.887 / 181.823;
/** Le bord d'où sortent les lettres : la pente, par le point le plus à droite du disque. */
const BORD = { x: DISQUE.cx + DISQUE.r, y: DISQUE.cy };

export const LOOK = {
  /** Largeur du logo posé : part de l'écran, px au plus. */
  largeur: [0.6, 320] as const,
  /** Le logo seul au départ, deux fois plus grand qu'une fois posé. */
  depart: 2,
  /** L'ombre de la nouvelle lune déborde un peu le disque (aucun liseré). */
  couvre: 1.06,
  /** Les lettres arrivent de la gauche, de tant (repère du logo). */
  glisse: 46,
  /** Le logo s'avance de tant en s'effaçant. */
  avance: 1.1,
};

/** Les temps, en ms depuis l'ouverture. */
export const TEMPS = {
  lune: 440,
  recul: { debut: 200, duree: 440 },
  lettres: { debut: 280, duree: 500 },
  /** Le logo est posé : le voile peut se lever. */
  pose: 680,
  sortie: 300,
};

const COURBES = {
  lune: "cubic-bezier(0.33, 1, 0.68, 1)",
  recul: "cubic-bezier(0.65, 0, 0.35, 1)",
  lettres: "cubic-bezier(0.16, 1, 0.3, 1)",
  apparait: "cubic-bezier(0.33, 1, 0.68, 1)",
  avance: "cubic-bezier(0.4, 0, 1, 1)",
  efface: "cubic-bezier(0.33, 1, 0.68, 1)",
  voile: "cubic-bezier(0.4, 0, 0.2, 1)",
};

const pc = (v: number) => `${+(v * 100).toFixed(4)}%`;
const deg = (Math.atan(PENTE) * 180) / Math.PI;
const ORIGINE_PENTE = pc(BORD.y / H);
const INCLINE = `skewX(${-deg.toFixed(3)}deg)`;

/**
 * La place de chaque calque, en pourcentages du logo (la scène mesure
 * 1000 × 237 unités) : le dessin tient quelle que soit la taille choisie.
 */
export const PLACES = {
  /** Le disque, et le symbole officiel qui le remplace. */
  symbole: {
    left: pc((DISQUE.cx - DISQUE.r) / W),
    top: pc((DISQUE.cy - DISQUE.r) / H),
    width: pc((2 * DISQUE.r) / W),
    height: pc((2 * DISQUE.r) / H),
  },
  /** L'ombre de la nouvelle lune, dans la boîte du disque : centrée sur lui,
   *  un peu plus grande. Elle ne fait ensuite que rétrécir (jamais agrandie,
   *  son bord reste net). */
  ombre: {
    left: pc((1 - LOOK.couvre) / 2),
    top: pc((1 - LOOK.couvre) / 2),
    width: pc(LOOK.couvre),
    height: pc(LOOK.couvre),
  },
  /** Le papier à gauche du bord, sous le symbole : les lettres en sortent. */
  cache: {
    left: "-100%",
    top: "0",
    width: pc(1 + BORD.x / W),
    height: "100%",
    transformOrigin: `100% ${ORIGINE_PENTE}`,
    transform: INCLINE,
  },
  /** Le papier qui couvre les lettres et s'en va vers la droite (il chevauche
   *  un peu le précédent : pas de jointure entre les deux bords). */
  rideau: {
    left: pc((BORD.x - 4) / W),
    top: "0",
    width: "100%",
    height: "100%",
    transformOrigin: `0 ${ORIGINE_PENTE}`,
    transform: INCLINE,
  },
  /** La boîte du disque, en viewBox. */
  vueSymbole: `${DISQUE.cx - DISQUE.r} ${DISQUE.cy - DISQUE.r} ${2 * DISQUE.r} ${2 * DISQUE.r}`,
  disque: DISQUE,
  vueLogo: `0 0 ${W} ${H}`,
} as const;

// La scène (le logo, repère W × H) est accrochée au centre de l'écran, son
// origine en haut à gauche : translate (en % de sa propre taille) puis scale.
const placer = (x: number, y: number, s: number) => `translate(${pc((-x * s) / W)}, ${pc((-y * s) / H)}) scale(${s})`;
const centreEncre = { x: (ENCRE.x0 + ENCRE.x1) / 2, y: (ENCRE.y0 + ENCRE.y1) / 2 };
/** Le symbole seul, au centre de l'écran. */
const DEPART = placer(DISQUE.cx, DISQUE.cy, 1);
/** Le logo entier, centré, à sa taille. */
const POSE = placer(centreEncre.x, centreEncre.y, 1 / LOOK.depart);
/** Le logo qui s'avance au lever du voile. */
const SORTIE = placer(centreEncre.x, centreEncre.y, LOOK.avance / LOOK.depart);
/** L'ombre devenue la balle du symbole. */
const BALLE_T = `translate(${pc((BALLE.cx - DISQUE.cx) / (2 * LOOK.couvre * DISQUE.r))}, ${pc(
  (BALLE.cy - DISQUE.cy) / (2 * LOOK.couvre * DISQUE.r)
)}) scale(${+(BALLE.r / (LOOK.couvre * DISQUE.r)).toFixed(5)})`;

export interface PiecesIntro {
  /** Le fond plein écran (bg-background), qui se lève à la fin. */
  voile: HTMLElement;
  /** Le logo entier, repère W × H. */
  scene: HTMLElement;
  lettres: HTMLElement;
  rideau: HTMLElement;
  cache: HTMLElement;
  /** Le disque et son ombre, le temps que la lune naisse. */
  lune: HTMLElement;
  ombre: HTMLElement;
  /** Le symbole officiel, posé quand la lune est née. */
  symbole: HTMLElement;
  /** Le filet de progression, sous le logo (s'il faut attendre). */
  barre?: HTMLElement | null;
}

export interface Intro {
  /** Résolue quand le logo est posé. */
  pose: Promise<void>;
  /** Lève le voile ; résolue quand il est levé. */
  sortir: () => Promise<void>;
  /** Arrête tout (démontage). */
  arreter: () => void;
}

/**
 * Taille la scène pour cet écran et lance l'intro. À appeler avant la
 * première image (useLayoutEffect), pour qu'elle parte de son premier état.
 */
export function jouerIntro(p: PiecesIntro, reduit: boolean): Intro {
  const largeur = Math.min(LOOK.largeur[0] * window.innerWidth, LOOK.largeur[1]);
  const k1 = largeur / (ENCRE.x1 - ENCRE.x0);
  const k0 = k1 * LOOK.depart;
  p.scene.style.width = `${W * k0}px`;
  p.scene.style.height = `${H * k0}px`;
  if (p.barre) {
    // Sous le logo posé, d'un tiers de sa hauteur ; φ fois plus étroit que lui.
    const bas = (ENCRE.y1 - centreEncre.y) * k1;
    p.barre.style.width = `${largeur * 0.382}px`;
    p.barre.style.marginLeft = `${-largeur * 0.191}px`;
    p.barre.style.marginTop = `${bas + (ENCRE.y1 - ENCRE.y0) * k1 * 0.6}px`;
  }

  const anims: Animation[] = [];
  const minuteurs: number[] = [];
  const jouer = (el: HTMLElement, images: Keyframe[], temps: KeyframeAnimationOptions) => {
    const a = el.animate(images, { fill: "both", ...temps });
    anims.push(a);
    return a;
  };
  // Le symbole officiel prend la place du disque et de son ombre.
  const symboleOfficiel = () => {
    p.symbole.style.opacity = "1";
    p.lune.style.visibility = "hidden";
  };
  const rideauxTires = () => {
    p.rideau.style.visibility = "hidden";
    p.cache.style.visibility = "hidden";
  };

  let pose: Promise<void>;
  if (reduit) {
    p.scene.style.transform = POSE;
    symboleOfficiel();
    rideauxTires();
    pose = Promise.resolve();
  } else {
    // 1. La lune naît.
    const lune = jouer(p.ombre, [{ transform: "none" }, { transform: BALLE_T }], {
      duration: TEMPS.lune,
      easing: COURBES.lune,
    });
    jouer(p.lune, [{ transform: "scale(0.9)" }, { transform: "none" }], {
      duration: TEMPS.lune,
      easing: COURBES.lune,
    });
    lune.finished.then(symboleOfficiel, () => {});
    // 2. Le logo recule et se recentre ; les lettres sortent du symbole.
    jouer(p.scene, [{ transform: DEPART }, { transform: POSE }], {
      delay: TEMPS.recul.debut,
      duration: TEMPS.recul.duree,
      easing: COURBES.recul,
    });
    const lettres = { delay: TEMPS.lettres.debut, duration: TEMPS.lettres.duree, easing: COURBES.lettres };
    jouer(p.lettres, [{ transform: `translateX(${pc(-LOOK.glisse / W)})` }, { transform: "none" }], lettres);
    jouer(p.lettres, [{ opacity: 0 }, { opacity: 1 }], {
      delay: TEMPS.lettres.debut,
      duration: TEMPS.lettres.duree * 0.45,
      easing: COURBES.apparait,
    });
    // Le rideau part assez loin pour découvrir le ® (en haut à droite).
    const tire = jouer(
      p.rideau,
      [{ transform: `translateX(0) ${INCLINE}` }, { transform: `translateX(${pc((ENCRE.x1 - BORD.x + 80) / W)}) ${INCLINE}` }],
      lettres
    );
    tire.finished.then(rideauxTires, () => {});
    pose = new Promise((r) => minuteurs.push(window.setTimeout(r, TEMPS.pose)));
  }

  let sortie: Promise<void> | null = null;
  return {
    pose,
    sortir: () => {
      if (sortie) return sortie;
      p.voile.style.pointerEvents = "none";
      if (!reduit) {
        // Le logo s'avance et s'efface avant le voile : il ne traîne pas sur l'app.
        jouer(p.scene, [{ transform: POSE }, { transform: SORTIE }], {
          duration: TEMPS.sortie,
          easing: COURBES.avance,
        });
        jouer(p.scene, [{ opacity: 1 }, { opacity: 0 }], {
          duration: TEMPS.sortie * 0.6,
          easing: COURBES.efface,
        });
      }
      const voile = jouer(p.voile, [{ opacity: 1 }, { opacity: 0 }], {
        delay: reduit ? 0 : 60,
        duration: TEMPS.sortie,
        easing: COURBES.voile,
      });
      sortie = voile.finished.then(
        () => {},
        () => {}
      );
      return sortie;
    },
    arreter: () => {
      minuteurs.forEach((m) => clearTimeout(m));
      anims.forEach((a) => a.cancel());
    },
  };
}
