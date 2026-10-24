"use client";

// La scène de la carte en grand (carte-en-grand.tsx) : le canvas couvre tout
// l'écran, la carte y est posée au centre, exactement à la taille de la carte
// plate qu'elle remplace, et c'est ici qu'on la tient. Le dessin, lui, est
// celui de toutes les cartes 3D de l'app : le même CardMesh
// (card-3d-canvas.tsx), ses calques, sa tranche, son reflet, sa matière ; il
// suit seulement la pose qu'on lui donne.
//
// Les gestes (Sabri, 24/10 : « vraiment bien la manipuler ») :
//   · un doigt tourne la carte, librement (jusqu'au dos, et au-delà), et la
//     penche bien plus loin que dans les aperçus ; lâchée, elle garde son
//     élan, puis se pose à plat sur sa face la plus proche ;
//   · deux doigts la grossissent (jusqu'à ×1,8) et la déplacent ; lâchée plus
//     petite que sa taille, elle y revient ;
//   · un toucher sur la carte la retourne ; un toucher à côté referme ;
//   · à la souris : glisser, cliquer, la molette (ou le pincement du
//     trackpad) pour zoomer ; au clavier, les flèches la retournent.
// L'appui long (450 ms sans bouger) ne fait rien ici : il est gardé pour la
// passe de saison, qui y plongera dans la carte (plongee-carte.tsx).
// « Réduire les animations » : ni élan ni retournement animé, la carte se
// pose aussitôt.
//
// Les rythmes sont ceux des aperçus, comptés en secondes plutôt qu'en images
// (un écran à 120 Hz ne la rend pas deux fois plus nerveuse).
// frameloop="demand" : on ne dessine que tant que la carte bouge.

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CapturedLayers } from "@/components/sfl/card-3d";
import { CardMesh, type PoseCarte } from "@/components/sfl/card-3d-canvas";

/** Le tour au doigt, celui des aperçus (ROT_PER_PX, card-3d-canvas.tsx). */
const TOUR_PAR_PX = 0.011;
/** La bascule au doigt, plus libre que dans les aperçus (±0,3). */
const BASCULE_PAR_PX = 0.0065;
const BASCULE_MAX = 0.62;
const ZOOM_MAX = 1.8;
/** Sous le doigt, la carte va un peu au-delà de ses bornes, en résistant. */
const RESISTANCE = 0.3;
/** En deçà, un toucher ; au-delà, un geste. */
const SEUIL_TOUCHER = 7;
/** Au-delà, un appui long : laissé à la passe de saison. */
export const APPUI_LONG = 450;
/** L'élan s'amortit comme dans les aperçus (0,93 par image à 60 Hz)… */
const AMORTI = 0.93;
/** …et sous cette vitesse (rad/s), la carte se pose sur une face. */
const SEUIL_POSE = 0.6;
/** Une carte qui tourne encore plus vite que ça, on l'attrape d'un toucher sans la retourner. */
const ATTRAPE = 2;
// Les poursuites, par seconde : le doigt (0,3 par image), la pose (0,09).
const SUIVI = 21;
const POSE = 5.7;
const ZOOM = 12;
const RETOUR = 14;
/** Le retournement d'un toucher, en secondes, et la carte qui se soulève à mi-course. */
const RETOURNEMENT = 0.62;
const SOULEVE = 0.05;

/** Ce qu'on commande à la scène depuis la page : le clavier, la fermeture. */
export interface CommandesScene {
  retourner: (sens?: 1 | -1) => void;
  zoomer: (facteur: number) => void;
  /** Ramène la carte, de face, sur sa place dans la page (le rectangle visible de la carte touchée). */
  revenir: (vers: DOMRect | null) => void;
}

/** Une valeur qui dépasse ses bornes résiste. */
function elastique(v: number, min: number, max: number): number {
  if (v < min) return min - (min - v) * RESISTANCE;
  if (v > max) return max + (v - max) * RESISTANCE;
  return v;
}

const clamp = THREE.MathUtils.clamp;
const doux = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

interface EtatScene {
  /** La pose : bascule, tour, échelle, décalage (unités monde). */
  x: number;
  y: number;
  zoom: number;
  panX: number;
  panY: number;
  /** Ce qu'elle vise. */
  viseX: number;
  viseY: number;
  viseZoom: number;
  visePanX: number;
  visePanY: number;
  /** L'élan du tour, en rad/s. */
  vy: number;
  mode: "repos" | "doigt" | "elan" | "pince" | "retour";
  /** Un retournement en cours (toucher, clavier). */
  tour: { de: number; vers: number; t: number } | null;
}

function Pilote({
  poseRef,
  groupeRef,
  largeur,
  hauteur,
  parPx,
  reduit,
  commandesRef,
  onFermer,
  onZoom,
}: {
  poseRef: RefObject<PoseCarte>;
  groupeRef: RefObject<THREE.Group | null>;
  largeur: number;
  hauteur: number;
  /** Unités monde par pixel, au plan de la carte. */
  parPx: number;
  reduit: boolean;
  commandesRef: RefObject<CommandesScene | null>;
  onFermer: () => void;
  onZoom: (grossie: boolean) => void;
}) {
  const { gl, camera, invalidate } = useThree();
  const etat = useRef<EtatScene>({
    x: 0,
    y: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    viseX: 0,
    viseY: 0,
    viseZoom: 1,
    visePanX: 0,
    visePanY: 0,
    vy: 0,
    mode: "repos",
    tour: null,
  });
  // Les dimensions et le rappel les plus récents, pour les écouteurs posés une fois.
  const dims = useRef({ largeur, hauteur, parPx });
  const fermer = useRef(onFermer);
  const zoom = useRef({ rappel: onZoom, grossie: false });
  useEffect(() => {
    dims.current = { largeur, hauteur, parPx };
    fermer.current = onFermer;
    zoom.current.rappel = onZoom;
  });

  useEffect(() => {
    const el = gl.domElement;
    const st = etat.current;
    const doigts = new Map<number, { x: number; y: number }>();
    let touche: {
      id: number;
      x0: number;
      y0: number;
      t0: number;
      bouge: boolean;
      /** Le doigt a arrêté une carte lancée : ce n'est pas un toucher qui retourne. */
      attrape: boolean;
      baseX: number;
      baseY: number;
      ox: number;
      oy: number;
    } | null = null;
    let pince: { d0: number; mx0: number; my0: number; zoom0: number; panX0: number; panY0: number } | null = null;
    // Les derniers points du doigt, pour l'élan au lâcher.
    const traces: { t: number; y: number }[] = [];

    /** La face la plus proche, et celle d'après dans le sens voulu. */
    const faceProche = (y: number) => Math.round(y / Math.PI) * Math.PI;

    function retourner(sens: 1 | -1 = 1) {
      if (st.mode === "retour") return;
      const de = st.y;
      const vers = faceProche(st.tour ? st.tour.vers : st.viseY) + Math.PI * sens;
      st.mode = "repos";
      st.vy = 0;
      st.viseX = 0;
      st.viseY = vers;
      st.tour = reduit ? null : { de, vers, t: 0 };
      if (reduit) st.y = vers;
      invalidate();
    }

    function bornerPan() {
      const { largeur: w, hauteur: h } = dims.current;
      const mx = (w * (st.viseZoom - 1)) / 2 + w * 0.2;
      const my = (h * (st.viseZoom - 1)) / 2 + h * 0.2;
      st.visePanX = clamp(st.visePanX, -mx, mx);
      st.visePanY = clamp(st.visePanY, -my, my);
    }

    function zoomer(facteur: number) {
      if (st.mode === "retour") return;
      st.viseZoom = clamp(st.viseZoom * facteur, 1, ZOOM_MAX);
      if (st.viseZoom <= 1.001) {
        st.visePanX = 0;
        st.visePanY = 0;
      } else bornerPan();
      invalidate();
    }

    function revenir(vers: DOMRect | null) {
      const r = el.getBoundingClientRect();
      const { largeur: w, parPx: k } = dims.current;
      st.mode = "retour";
      st.tour = null;
      st.vy = 0;
      st.viseX = 0;
      // De face, par le plus court.
      st.viseY = Math.round(st.y / (2 * Math.PI)) * 2 * Math.PI;
      if (vers && vers.width > 0) {
        st.viseZoom = (vers.width * k) / w;
        st.visePanX = (vers.left + vers.width / 2 - (r.left + r.width / 2)) * k;
        st.visePanY = -(vers.top + vers.height / 2 - (r.top + r.height / 2)) * k;
      } else {
        st.viseZoom = 0.92;
        st.visePanX = 0;
        st.visePanY = 0;
      }
      invalidate();
    }

    commandesRef.current = { retourner, zoomer, revenir };

    /** Le point touché tombe-t-il sur la carte, telle qu'elle est posée à l'écran (à 12 px près) ? */
    const matrice = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const point = new THREE.Vector3();
    const position = new THREE.Vector3();
    const echelle = new THREE.Vector3();
    function surLaCarte(cx: number, cy: number): boolean {
      const r = el.getBoundingClientRect();
      const { largeur: w, hauteur: h } = dims.current;
      // Le groupe du décalage porte celui de la carte (tour puis bascule, ordre XYZ de three).
      matrice.compose(
        position.set(st.panX, st.panY, 0),
        quaternion.setFromEuler(euler.set(st.x, st.y, 0)),
        echelle.setScalar(st.zoom)
      );
      const coins = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([a, b]) => {
        point.set((a * w) / 2, (b * h) / 2, 0).applyMatrix4(matrice).project(camera);
        return { x: r.left + ((point.x + 1) / 2) * r.width, y: r.top + ((1 - point.y) / 2) * r.height };
      });
      let signe = 0;
      let dedans = true;
      let pres = Infinity;
      for (let i = 0; i < 4; i++) {
        const a = coins[i];
        const b = coins[(i + 1) % 4];
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const c = ex * (cy - a.y) - ey * (cx - a.x);
        if (c !== 0) {
          if (signe === 0) signe = Math.sign(c);
          else if (Math.sign(c) !== signe) dedans = false;
        }
        const l2 = ex * ex + ey * ey || 1;
        const t = clamp(((cx - a.x) * ex + (cy - a.y) * ey) / l2, 0, 1);
        pres = Math.min(pres, Math.hypot(cx - (a.x + t * ex), cy - (a.y + t * ey)));
      }
      return dedans || pres < 12;
    }

    function debutPince() {
      const [a, b] = [...doigts.values()];
      pince = {
        d0: Math.hypot(b.x - a.x, b.y - a.y) || 1,
        mx0: (a.x + b.x) / 2,
        my0: (a.y + b.y) / 2,
        zoom0: st.viseZoom,
        panX0: st.visePanX,
        panY0: st.visePanY,
      };
      // La rotation s'arrête là : la carte se pose de face pendant qu'on la grossit.
      touche = null;
      st.mode = "pince";
      st.vy = 0;
      st.viseX = 0;
      st.viseY = faceProche(st.tour ? st.tour.vers : st.y);
    }

    function bas(e: PointerEvent) {
      if (st.mode === "retour" || (e.pointerType === "mouse" && e.button !== 0)) return;
      el.setPointerCapture?.(e.pointerId);
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (doigts.size === 1) {
        // Un doigt arrête une carte lancée, là où elle est.
        const attrape = st.mode === "elan" && Math.abs(st.vy) > ATTRAPE;
        if (st.mode === "elan") {
          st.mode = "repos";
          st.vy = 0;
          st.viseX = st.x;
          st.viseY = st.y;
        }
        touche = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, bouge: false, attrape, baseX: 0, baseY: 0, ox: 0, oy: 0 };
      } else if (doigts.size === 2) debutPince();
      invalidate();
    }

    function bouge(e: PointerEvent) {
      if (!doigts.has(e.pointerId)) return;
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const k = dims.current.parPx;
      if (pince && doigts.size >= 2) {
        const [a, b] = [...doigts.values()];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        st.viseZoom = elastique((pince.zoom0 * d) / pince.d0, 1, ZOOM_MAX);
        st.visePanX = pince.panX0 + ((a.x + b.x) / 2 - pince.mx0) * k;
        st.visePanY = pince.panY0 - ((a.y + b.y) / 2 - pince.my0) * k;
        invalidate();
        return;
      }
      if (!touche || e.pointerId !== touche.id) return;
      if (!touche.bouge) {
        if (Math.hypot(e.clientX - touche.x0, e.clientY - touche.y0) < SEUIL_TOUCHER) return;
        // Le geste part d'ici, sans à-coup : la carte part de là où elle est.
        touche.bouge = true;
        touche.ox = e.clientX;
        touche.oy = e.clientY;
        touche.baseX = st.x;
        touche.baseY = st.y;
        st.tour = null;
        st.mode = "doigt";
        traces.length = 0;
      }
      st.viseY = touche.baseY + (e.clientX - touche.ox) * TOUR_PAR_PX;
      st.viseX = elastique(touche.baseX + (e.clientY - touche.oy) * BASCULE_PAR_PX, -BASCULE_MAX, BASCULE_MAX);
      traces.push({ t: e.timeStamp, y: st.viseY });
      while (traces.length > 2 && e.timeStamp - traces[0].t > 90) traces.shift();
      invalidate();
    }

    function haut(e: PointerEvent) {
      if (!doigts.has(e.pointerId)) return;
      doigts.delete(e.pointerId);
      if (pince) {
        if (doigts.size < 2) {
          // Fin du pincement : la carte reprend sa taille si on l'a lâchée plus petite.
          pince = null;
          st.mode = "repos";
          st.viseZoom = clamp(st.viseZoom, 1, ZOOM_MAX);
          if (st.viseZoom <= 1.001) {
            st.visePanX = 0;
            st.visePanY = 0;
          } else bornerPan();
          // Le doigt qui reste ne fait plus rien jusqu'à ce qu'il se lève.
          touche = null;
        }
        invalidate();
        return;
      }
      if (!touche || e.pointerId !== touche.id) return;
      const t = touche;
      touche = null;
      if (!t.bouge) {
        // L'appui long (plus de 450 ms sans bouger) reste libre : rien ici.
        if (e.type === "pointercancel" || e.timeStamp - t.t0 >= APPUI_LONG || t.attrape) return;
        if (surLaCarte(e.clientX, e.clientY)) retourner(1);
        else fermer.current();
        return;
      }
      // Lâchée : son élan, mesuré sur les derniers instants du geste.
      const premier = traces[0];
      const dernier = traces[traces.length - 1];
      const duree = premier && dernier ? (dernier.t - premier.t) / 1000 : 0;
      st.vy = duree > 0.008 && e.timeStamp - dernier.t < 80 ? clamp((dernier.y - premier.y) / duree, -30, 30) : 0;
      if (reduit || Math.abs(st.vy) < SEUIL_POSE) {
        st.mode = "repos";
        st.vy = 0;
        st.viseX = 0;
        st.viseY = faceProche(st.y);
      } else st.mode = "elan";
      invalidate();
    }

    function molette(e: WheelEvent) {
      e.preventDefault();
      zoomer(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    }

    // Pas de menu (appui long, clic droit) sur la carte ; sur Safari, le pincement ne zoome pas la page.
    const sansMenu = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", bas);
    el.addEventListener("pointermove", bouge);
    el.addEventListener("pointerup", haut);
    el.addEventListener("pointercancel", haut);
    el.addEventListener("wheel", molette, { passive: false });
    el.addEventListener("contextmenu", sansMenu);
    el.addEventListener("gesturestart", sansMenu);
    el.addEventListener("gesturechange", sansMenu);
    return () => {
      el.removeEventListener("pointerdown", bas);
      el.removeEventListener("pointermove", bouge);
      el.removeEventListener("pointerup", haut);
      el.removeEventListener("pointercancel", haut);
      el.removeEventListener("wheel", molette);
      el.removeEventListener("contextmenu", sansMenu);
      el.removeEventListener("gesturestart", sansMenu);
      el.removeEventListener("gesturechange", sansMenu);
      commandesRef.current = null;
    };
  }, [gl, camera, invalidate, reduit, commandesRef]);

  useFrame((_, delta) => {
    const st = etat.current;
    const dt = Math.min(delta, 0.05);
    const vers = (taux: number) => 1 - Math.exp(-taux * dt);
    let souleve = 0;

    if (st.mode === "doigt") {
      st.x += (st.viseX - st.x) * vers(SUIVI);
      st.y += (st.viseY - st.y) * vers(SUIVI);
    } else if (st.mode === "elan") {
      st.y += st.vy * dt;
      st.vy *= Math.pow(AMORTI, dt * 60);
      st.x += (0 - st.x) * vers(POSE);
      if (Math.abs(st.vy) < SEUIL_POSE) {
        // Élan épuisé : la face la plus proche, avant ou dos.
        st.mode = "repos";
        st.vy = 0;
        st.viseX = 0;
        st.viseY = Math.round(st.y / Math.PI) * Math.PI;
      }
    } else if (st.tour) {
      // Le retournement d'un toucher : d'un bout à l'autre, la carte se soulève un peu au milieu.
      st.tour.t = Math.min(1, st.tour.t + dt / RETOURNEMENT);
      st.y = st.tour.de + (st.tour.vers - st.tour.de) * doux(st.tour.t);
      souleve = Math.sin(Math.PI * st.tour.t) * SOULEVE;
      st.x += (st.viseX - st.x) * vers(POSE);
      if (st.tour.t >= 1) st.tour = null;
    } else {
      // Au repos, en pinçant, en revenant : la carte se pose.
      const taux = st.mode === "retour" ? RETOUR : POSE;
      st.x += (st.viseX - st.x) * vers(taux);
      st.y += (st.viseY - st.y) * vers(taux);
    }

    if (st.mode === "pince") {
      st.zoom = st.viseZoom;
      st.panX = st.visePanX;
      st.panY = st.visePanY;
    } else {
      const k = vers(st.mode === "retour" ? RETOUR : ZOOM);
      st.zoom += (st.viseZoom - st.zoom) * k;
      st.panX += (st.visePanX - st.panX) * k;
      st.panY += (st.visePanY - st.panY) * k;
    }

    const ecart =
      Math.abs(st.viseX - st.x) +
      Math.abs(st.viseY - st.y) +
      Math.abs(st.viseZoom - st.zoom) +
      Math.abs(st.visePanX - st.panX) +
      Math.abs(st.visePanY - st.panY);
    if (st.mode !== "elan" && !st.tour && ecart < 1e-4) {
      st.x = st.viseX;
      st.y = st.viseY;
      st.zoom = st.viseZoom;
      st.panX = st.visePanX;
      st.panY = st.visePanY;
    }

    poseRef.current.x = st.x;
    poseRef.current.y = st.y;
    poseRef.current.scale = st.zoom * (1 + souleve);
    groupeRef.current?.position.set(st.panX, st.panY, 0);
    // Grossie, la carte passe sous le titre : la page le retire.
    const grossie = st.mode !== "retour" && st.zoom > 1.04;
    if (grossie !== zoom.current.grossie) {
      zoom.current.grossie = grossie;
      zoom.current.rappel(grossie);
    }
    if (st.mode === "elan" || st.tour || ecart >= 1e-4) invalidate();
  });

  return null;
}

function Contenu({
  calques,
  mode,
  largeurPx,
  reduit,
  commandesRef,
  onAffichee,
  onFermer,
  onZoom,
}: {
  calques: CapturedLayers;
  mode: "simple" | "rare";
  largeurPx: number;
  reduit: boolean;
  commandesRef: RefObject<CommandesScene | null>;
  onAffichee: () => void;
  onFermer: () => void;
  onZoom: (grossie: boolean) => void;
}) {
  const { size, camera } = useThree();
  const persp = camera as THREE.PerspectiveCamera;
  // La hauteur visible au plan de la carte, répartie sur la hauteur du canvas.
  const parPx = (2 * Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)) * persp.position.z) / Math.max(1, size.height);
  const largeur = largeurPx * parPx;
  const hauteur = largeur * (calques.height / calques.width);
  const cadre = useMemo(() => ({ largeur, hauteur }), [largeur, hauteur]);
  const poseRef = useRef<PoseCarte>({ x: 0, y: 0, scale: 1 });
  const groupeRef = useRef<THREE.Group>(null);

  return (
    <>
      <Pilote
        poseRef={poseRef}
        groupeRef={groupeRef}
        largeur={largeur}
        hauteur={hauteur}
        parPx={parPx}
        reduit={reduit}
        commandesRef={commandesRef}
        onFermer={onFermer}
        onZoom={onZoom}
      />
      <group ref={groupeRef}>
        <CardMesh
          background={calques.background}
          playerLayer={calques.playerLayer}
          stats={calques.stats}
          dos={calques.dos}
          matiere={calques.matiere}
          mode={mode}
          holo={mode === "rare"}
          interactive={false}
          posee
          pose={poseRef}
          cadre={cadre}
          onAffichee={onAffichee}
        />
      </group>
    </>
  );
}

export function SceneEnGrand({
  visible,
  ...props
}: {
  calques: CapturedLayers;
  mode: "simple" | "rare";
  /** La largeur de la carte posée, en pixels CSS : celle de la carte plate qu'elle remplace. */
  largeurPx: number;
  /** false tant que la carte plate vole encore : la 3D attend, invisible, sans prendre les gestes. */
  visible: boolean;
  reduit: boolean;
  commandesRef: RefObject<CommandesScene | null>;
  /** La première image dessinée, calques compris : la carte plate peut s'effacer. */
  onAffichee: () => void;
  /** Un toucher à côté de la carte. */
  onFermer: () => void;
  /** La carte grossie (deux doigts, molette) ou revenue à sa taille. */
  onZoom: (grossie: boolean) => void;
}) {
  return (
    <Canvas
      dpr={[1, 3]}
      frameloop="demand"
      camera={{ position: [0, 0, 3.4], fov: 28 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{
        position: "absolute",
        inset: 0,
        touchAction: "none",
        cursor: "grab",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      <Contenu {...props} />
    </Canvas>
  );
}
