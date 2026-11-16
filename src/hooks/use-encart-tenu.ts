"use client";

// Le défilement de Ma carte quand le vote du jour change de place
// (components/sfl/vote-du-jour.tsx, `repliable`). Un seul observateur pour
// tous les encarts de la page, deux journées le même jour comprises : il les
// mesure et pose le défilement ; la règle, pure, est lib/encart-tenu.ts
// (contrôles du 16/11/2026 : chaque encart avait le sien, et le second
// défaisait ce que le premier, ou Chrome, avait rattrapé).
//   · useTenueDesEncarts : posé par la liste (VoteDuJour), il suit le
//     défilement de la page dès avant qu'un encart paraisse. La feuille de mon
//     match se remplit pendant que je lis plus bas : l'encart paraît au-dessus,
//     et le défilement d'avant est connu ;
//   · useEncartTenu : chaque encart s'y inscrit, et dit chaque changement
//     d'état avant qu'il ne s'affiche : se ranger, se déplier, paraître (sa
//     hauteur d'avant est 0 ; déjà vu, quand React rejoue ses effets en
//     développement, il garde la sienne et ne paraît pas deux fois) ;
//     rangeSousMaVoix : il se range sous ma voix, donnée ici (la règle ramène
//     alors sa ligne sous la pile des messages).
// Le défilement relevé reste celui d'avant jusqu'à l'image qui suit un
// changement : Chrome rattrape l'encart dès qu'un écran lit la mise en page et
// en prévient par un défilement, qui arrive avant le ResizeObserver ; relevé,
// il ferait croire l'encart à l'écran.
// Un encart qui s'en va (la fin du vote) est mesuré juste avant de partir, et
// rattrapé une fois la page refaite, une microtâche plus tard ; s'il est encore
// là (React rejoue les effets en développement) ou si la page s'en va avec lui,
// rien.
// Tant qu'une page retrouve sa place (components/layout/memoire-navigation.tsx :
// un rechargement, un retour, un onglet), rien ne se compense : la place gardée
// est celle de la page entière, encart compris.

import { useLayoutEffect, type RefObject } from "react";
import { placeEnPose } from "@/components/layout/memoire-navigation";
import { rattrapageDesEncarts, type Ecran, type Geste, type Mesure } from "@/lib/encart-tenu";

interface Tenue {
  inscrire(s: HTMLElement): void;
  desinscrire(s: HTMLElement): void;
  figer(): void;
  rangeIci(s: HTMLElement): void;
  fin(): void;
}

let tenue: Tenue | null = null;
let tenants = 0;
// La hauteur de chaque encart au dernier relevé, gardée hors de l'observateur :
// en développement, React rejoue les effets (l'encart se désinscrit et se
// réinscrit, toujours là, parfois un dixième de seconde plus tard) ; déjà vu,
// il ne « paraît » pas une seconde fois (la page descendait de deux fois sa
// hauteur). Un encart vraiment parti n'est plus là pour la lire.
const hauteurs = new WeakMap<HTMLElement, number>();

/** Ce qui défile sous les encarts : #app-scroll, où défile toute l'app ; sinon la page. */
function defilant(): HTMLElement | null {
  return document.getElementById("app-scroll");
}

function creer(): Tenue {
  const sc = defilant();
  const lire = () => (sc ? sc.scrollTop : window.scrollY);
  const poser = (y: number) => (sc ? void (sc.scrollTop = y) : window.scrollTo(0, y));
  // Chaque encart inscrit, et s'il se range sous ma voix ; sa hauteur au dernier relevé est dans `hauteurs` (aucune : il paraît).
  const inscrits = new Map<HTMLElement, { ici: boolean }>();
  let defil = lire();
  let fige = false;
  let image = 0;
  let fini = false;
  // Les encarts partis dans ce rendu, mesurés juste avant leur départ.
  let partis: { s: HTMLElement; m: Mesure }[] = [];
  const figer = () => {
    fige = true;
    cancelAnimationFrame(image);
    image = requestAnimationFrame(() => void (fige = false));
  };
  const suivre = () => {
    if (!fige) defil = lire();
  };
  // L'écran utile commence sous la pile des messages de confirmation : la scroll-margin de l'encart.
  const ecran = (s: HTMLElement | null): Ecran => {
    const marge = s ? parseFloat(getComputedStyle(s).scrollMarginTop) || 0 : 0;
    const r = sc?.getBoundingClientRect();
    const bord = r ? r.top : 0;
    return { bord, haut: bord + marge, bas: r ? r.bottom : window.innerHeight };
  };
  const marges = (s: HTMLElement) => {
    const cs = getComputedStyle(s);
    return (parseFloat(cs.marginTop) || 0) + (parseFloat(cs.marginBottom) || 0);
  };
  const appliquer = (geste: Geste, liste: HTMLElement[]) => {
    if (geste && "ramener" in geste) liste[geste.ramener]?.scrollIntoView({ block: "nearest" });
    else if (geste) poser(defil + geste.decaler);
    defil = lire();
  };
  const ro = new ResizeObserver(() => {
    if (fini) return;
    const liste = [...inscrits.keys()]
      .filter((s) => s.isConnected)
      .map((s) => ({ s, r: s.getBoundingClientRect() }))
      .sort((a, b) => a.r.top - b.r.top);
    let change = false;
    const mesures: Mesure[] = liste.map(({ s, r }) => {
      const i = inscrits.get(s)!;
      const avant = hauteurs.get(s) ?? 0;
      const ici = i.ici;
      if (Math.abs(r.height - avant) >= 1) {
        change = true;
        i.ici = false;
      }
      hauteurs.set(s, r.height);
      return { haut: r.top, avant, apres: r.height, marges: marges(s), ici };
    });
    if (!change) return;
    if (placeEnPose()) {
      defil = lire();
      return;
    }
    // Ce que le navigateur a déjà rattrapé de lui-même (Chrome : overflow-anchor ; Safari : rien).
    const deja = defil - lire();
    appliquer(
      rattrapageDesEncarts(mesures, deja, ecran(liste[0]?.s ?? null)),
      liste.map((x) => x.s)
    );
  });
  const rattraperLesPartis = () => {
    // Encore là : React rejoue les effets (développement), rien n'est parti.
    const ceux = partis.filter((p) => !p.s.isConnected).map((p) => p.m);
    partis = [];
    if (fini || !ceux.length) return;
    if (placeEnPose()) {
      defil = lire();
      return;
    }
    appliquer(rattrapageDesEncarts(ceux, defil - lire(), ecran(null)), []);
  };
  const cible: HTMLElement | Window = sc ?? window;
  cible.addEventListener("scroll", suivre, { passive: true });
  return {
    inscrire(s) {
      inscrits.set(s, { ici: false });
      figer();
      ro.observe(s);
    },
    desinscrire(s) {
      const vu = inscrits.has(s) && !!hauteurs.get(s);
      inscrits.delete(s);
      ro.unobserve(s);
      if (!vu || !s.isConnected) return;
      // Il s'en va : sa place mesurée tant qu'il est là, son rattrapage une fois la page refaite.
      const r = s.getBoundingClientRect();
      if (!partis.length) queueMicrotask(rattraperLesPartis);
      partis.push({ s, m: { haut: r.top, avant: r.height, apres: 0, marges: marges(s), parti: true } });
      figer();
    },
    figer,
    rangeIci(s) {
      const i = inscrits.get(s);
      if (i) i.ici = true;
    },
    fin() {
      fini = true;
      ro.disconnect();
      cancelAnimationFrame(image);
      cible.removeEventListener("scroll", suivre);
    },
  };
}

/** Tenir l'observateur commun le temps d'un effet ; rend de quoi le lâcher (le dernier qui le lâche l'arrête). */
function tenir(): () => void {
  if (!tenue) tenue = creer();
  tenants++;
  return () => {
    tenants--;
    if (tenants === 0) {
      tenue?.fin();
      tenue = null;
    }
  };
}

/** La liste des encarts (VoteDuJour, `repliable`) : l'observateur suit le défilement de la page tant qu'elle est là. */
export function useTenueDesEncarts(actif: boolean): void {
  useLayoutEffect(() => {
    if (!actif || typeof ResizeObserver === "undefined") return;
    return tenir();
  }, [actif]);
}

/**
 * Un encart, tant que `actif` : inscrit à l'observateur, et chaque changement
 * de son `etat` le dit avant de s'afficher (le défilement relevé reste celui
 * d'avant jusqu'à l'image suivante).
 */
export function useEncartTenu(section: RefObject<HTMLElement | null>, actif: boolean, etat: unknown): void {
  useLayoutEffect(() => {
    const s = section.current;
    if (!actif || !s || typeof ResizeObserver === "undefined") return;
    const lacher = tenir();
    tenue?.inscrire(s);
    return () => {
      tenue?.desinscrire(s);
      lacher();
    };
  }, [actif, section]);
  useLayoutEffect(() => {
    if (actif) tenue?.figer();
  }, [actif, etat]);
}

/** L'encart se range sous ma voix, donnée ici : la règle ramène sa ligne sous la pile des messages. */
export function rangeSousMaVoix(s: HTMLElement | null): void {
  if (s) tenue?.rangeIci(s);
}
