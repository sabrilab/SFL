"use client";

// La lentille de la barre d'onglets, au doigt, comme celle d'iOS 26 (02/11/2026,
// demande de Sabri : « la réelle animation de la tab bar en liquid glass »).
//
// Au repos, rien ne change : la pilule pleine sous l'onglet choisi.
// Sous le doigt, la pilule devient une goutte de verre clair : elle grossit
// et déborde de la barre (×1,12 en largeur, ×1,32 en hauteur), suit le doigt
// avec un ressort qui traîne un peu, s'étire avec la vitesse et s'écrase en
// se posant ; les icônes qu'elle survole grossissent sous elle, comme sous
// une loupe ; la barre s'éclaire. Au lâcher, elle file vers l'onglet le plus
// proche, se pose avec un petit écrasement, puis redevient pilule.
//
// Les temps viennent des mesures image par image de la barre d'iOS 26.4
// publiées par le paquet Flutter adaptive_liquid_glass (github.com/
// AymanOmara/adaptive_liquid_glass, journal 0.1.0-dev.3 à 0.2.0) : la
// goutte grandit sur un ressort de 0,38 s, suit le doigt à 0,25 s, se pose
// à 0,36 s ; la nouvelle pilule apparaît en retard. La réfraction du verre
// (le bord qui tord ce qu'il y a dessous) n'existe pas dans Safari : le bord
// est peint (liserés, franges froide à gauche et chaude à droite).
//
// Tout se joue hors de React à chaque image (style posé à la main) ; React
// ne sait que deux choses : la goutte est-elle de verre (pour l'encre des
// onglets), et l'onglet choisi.
//
// Un simple toucher garde le lien (le clic part comme avant : remonter en
// haut, retrouver l'onglet) ; un glissé navigue lui-même au lâcher et mange
// le clic qui suit.

import { useCallback, useEffect, useRef, useState } from "react";

type Ressort = { x: number; v: number; cible: number };

const PAD = 4;
const GRAND_X = 1.12;
const GRAND_Y = 1.32;

function pas(r: Ressort, dt: number, reponse: number, amorti: number) {
  const k = (2 * Math.PI / reponse) ** 2;
  const c = (4 * Math.PI * amorti) / reponse;
  const a = -k * (r.x - r.cible) - c * r.v;
  r.v += a * dt;
  r.x += r.v * dt;
}

export function useLentilleLiquide(n: number, actif: number, naviguer: (i: number) => void) {
  const nav = useRef<HTMLElement | null>(null);
  const lentille = useRef<HTMLSpanElement | null>(null);
  const [verre, setVerre] = useState(false);

  const etat = useRef({
    cx: { x: 0, v: 0, cible: 0 } as Ressort,
    s: { x: 1, v: 0, cible: 1 } as Ressort, // 0 = repos, 1 = goutte pleine (sert aux deux échelles)
    tenu: false,
    glisse: false,
    departX: 0,
    mangerClic: false,
    verre: false,
    raf: 0,
    dernier: 0,
    pret: false,
    actif,
  });

  const largeur = () => (nav.current ? nav.current.clientWidth : 0);
  const pastille = () => (largeur() - 2 * PAD) / n;
  const centre = (i: number) => PAD + pastille() * (i + 0.5);
  const borne = (x: number) => {
    const w = pastille();
    return Math.min(largeur() - PAD - w / 2, Math.max(PAD + w / 2, x));
  };

  const reduit = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const peindre = useCallback(() => {
    const e = etat.current;
    const l = lentille.current;
    const el = nav.current;
    if (!l || !el) return;
    const w = pastille();
    const g = Math.max(0, e.s.x - 1) / 1; // 0 → 1 : à quel point la goutte est sortie
    const vit = Math.min(1, Math.abs(e.cx.v) / 2600);
    const sx = 1 + (GRAND_X - 1) * Math.min(1.2, g * 1) + 0.22 * vit;
    const sy = 1 + (GRAND_Y - 1) * Math.min(1.2, g * 1) - 0.1 * vit;
    l.style.transform = `translate3d(${e.cx.x - w / 2 - PAD}px,0,0) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
    // La loupe : les onglets sous la goutte grossissent.
    const onglets = el.querySelectorAll<HTMLElement>(".liquid-tabbar__onglet");
    onglets.forEach((o, i) => {
      if (!e.verre) {
        o.style.removeProperty("transform");
        return;
      }
      const d = Math.abs(centre(i) - e.cx.x) / (w * 0.75);
      const z = 1 + 0.2 * Math.max(0, Math.min(1, g)) * Math.max(0, 1 - d * d);
      o.style.transform = `scale(${z.toFixed(4)})`;
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const boucleRef = useRef<(t: number) => void>(() => {});
  const image = useCallback((t: number) => boucleRef.current(t), []);
  const boucle = useCallback(
    (t: number) => {
      const e = etat.current;
      const dt = Math.min(1 / 30, e.dernier ? (t - e.dernier) / 1000 : 1 / 60);
      e.dernier = t;
      if (e.tenu) {
        pas(e.cx, dt, 0.25, 0.86);
        pas(e.s, dt, 0.38, 0.7);
      } else {
        pas(e.cx, dt, 0.36, 0.72);
        pas(e.s, dt, 0.36, 0.62);
      }
      peindre();
      const pose =
        !e.tenu &&
        Math.abs(e.cx.x - e.cx.cible) < 0.4 &&
        Math.abs(e.cx.v) < 8 &&
        Math.abs(e.s.x - e.s.cible) < 0.004 &&
        Math.abs(e.s.v) < 0.05;
      if (pose) {
        e.cx.x = e.cx.cible;
        e.s.x = e.s.cible;
        e.cx.v = e.s.v = 0;
        e.raf = 0;
        e.dernier = 0;
        if (e.verre) {
          e.verre = false;
          setVerre(false);
        }
        peindre();
        return;
      }
      e.raf = requestAnimationFrame(image);
    },
    [peindre, image],
  );
  useEffect(() => {
    boucleRef.current = boucle;
  }, [boucle]);

  const relancer = useCallback(() => {
    const e = etat.current;
    if (reduit()) {
      e.cx.x = e.cx.cible;
      e.s.x = e.s.cible;
      e.cx.v = e.s.v = 0;
      if (!e.tenu && e.verre) {
        e.verre = false;
        setVerre(false);
      }
      peindre();
      return;
    }
    if (!e.raf) e.raf = requestAnimationFrame(image);
  }, [image, peindre]);

  // L'onglet choisi change (navigation, retour) : la goutte y va.
  useEffect(() => {
    const e = etat.current;
    e.actif = actif;
    if (actif < 0 || !nav.current) return;
    e.cx.cible = centre(actif);
    if (!e.pret) {
      e.pret = true;
      e.cx.x = e.cx.cible;
      peindre();
      return;
    }
    if (!e.tenu) relancer();
  }, [actif]); // eslint-disable-line react-hooks/exhaustive-deps

  // La largeur de la barre change (rotation, ordinateur) : reposer net.
  useEffect(() => {
    const el = nav.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const e = etat.current;
      if (e.tenu || e.actif < 0) return;
      e.cx.x = e.cx.cible = centre(e.actif);
      peindre();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(etat.current.raf), []);

  const xDans = (ev: React.PointerEvent) => ev.clientX - (nav.current?.getBoundingClientRect().left ?? 0);

  const onPointerDown = (ev: React.PointerEvent) => {
    if (ev.button !== 0 || actif < 0) return;
    const e = etat.current;
    e.tenu = true;
    e.glisse = false;
    e.mangerClic = false;
    e.departX = ev.clientX;
    e.cx.cible = borne(xDans(ev));
    e.s.cible = 2;
    if (!e.verre) {
      e.verre = true;
      setVerre(true);
    }
    navigator.vibrate?.(6);
    relancer();
  };

  const onPointerMove = (ev: React.PointerEvent) => {
    const e = etat.current;
    if (!e.tenu) return;
    if (!e.glisse && Math.abs(ev.clientX - e.departX) > 8) {
      e.glisse = true;
      try {
        nav.current?.setPointerCapture(ev.pointerId);
      } catch {}
    }
    e.cx.cible = borne(xDans(ev));
    relancer();
  };

  const finir = (ev: React.PointerEvent, annule: boolean) => {
    const e = etat.current;
    if (!e.tenu) return;
    e.tenu = false;
    e.s.cible = 1;
    const i = Math.max(0, Math.min(n - 1, Math.floor((borne(xDans(ev)) - PAD) / pastille())));
    if (e.glisse && !annule) {
      e.mangerClic = true;
      e.cx.cible = centre(i);
      if (i !== e.actif) {
        navigator.vibrate?.(8);
        naviguer(i);
      }
    } else if (annule || e.glisse) {
      e.cx.cible = centre(Math.max(0, e.actif));
    } else {
      // Un toucher : le lien fait son travail, la goutte part vers lui.
      e.cx.cible = centre(i);
    }
    relancer();
  };

  const onClickCapture = (ev: React.MouseEvent) => {
    const e = etat.current;
    if (e.mangerClic) {
      e.mangerClic = false;
      ev.preventDefault();
      ev.stopPropagation();
    }
  };

  return {
    nav,
    lentille,
    verre,
    gestes: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (ev: React.PointerEvent) => finir(ev, false),
      onPointerCancel: (ev: React.PointerEvent) => finir(ev, true),
      onClickCapture,
    },
  };
}
