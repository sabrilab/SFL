// Les gestes d'ordinateur sur la Map (Sabri, 22/10 : « on a des bugs de zoom
// etc quand on passe sur desktop »). MapLibre fait de toute molette un zoom,
// et ne voit que ce qui tombe sur le plan lui-même. Sur un ordinateur :
//   · deux doigts sur le pavé tactile DÉPLACENT le plan, dans tous les sens,
//     comme Plans sur Mac ; le pincement et la molette d'une souris zooment ;
//   · un pincement ne zoome jamais la page entière. Le navigateur le faisait
//     dès que le geste tombait hors du plan (sur le carrousel, un bouton, la
//     barre d'onglets) : l'app restait agrandie, coupée par les bords ;
//   · là où les surcouches de la page sont transparentes (la bande du bas, qui
//     prend toute la largeur ; la colonne des boutons ; marquées
//     `data-traverse` dans app/map/page.tsx), la molette, le pincement et le
//     glisser de la souris vont au plan : sous le curseur, c'est le plan qu'on
//     voit. Sur une carte ou un bouton, le geste reste le leur (le carrousel
//     défile), sauf le pincement, qui zoome le plan ;
//   · sans doigts, rien n'incline le plan à la main : il suit le zoom (la
//     pente de carte-map.tsx), à plat de loin, penché sur la ville. La pente
//     tourne autour du centre de l'écran : le point qu'on vise en zoomant
//     (sous le curseur, sous le double-clic) glisserait de 30 px vers le bas ;
//     le plan se décale d'autant, et il reste sous le curseur.
// Le doigt n'est pas concerné : il n'envoie pas de molette, et les clics de
// compatibilité qui suivent un toucher sont écartés.

import { MercatorCoordinate, Point, type LngLat, type Map as PlanMap } from "maplibre-gl";

/** Un cran de molette de souris sur Mac, en pixels (le repère de MapLibre, scroll_zoom.ts). */
const CRAN_MAC = 4.000244140625;
/** Après ce silence (ms), un nouveau geste commence. */
const SILENCE = 240;
const TRAVERSE = "[data-traverse]";

type Genre = "pave" | "molette";

/** Ce que MapLibre passe vraiment à `transformCameraUpdate` : une copie de la caméra demandée. */
interface Camera {
  readonly center: LngLat;
  readonly zoom: number;
  readonly pitch: number;
  clone(): Camera;
  setPitch(pitch: number): void;
  screenPointToLocation(p: Point): LngLat;
}

/**
 * Le pavé tactile ou la molette d'une souris. Une molette avance par crans :
 * des lignes dans Firefox, 4,0002 px sur Mac, ailleurs 50 px et plus, droit
 * devant. Un pavé avance au pixel, de biais souvent, et Chrome comme Safari
 * le comptent aussi trois fois dans `wheelDeltaY`.
 */
function genre(e: WheelEvent): Genre {
  if (e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return "molette";
  const dy = Math.abs(e.deltaY);
  if (dy && dy % CRAN_MAC === 0) return "molette";
  const w = Math.abs((e as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY ?? 0);
  if (dy && Math.abs(w / dy - 3) < 0.4) return "pave";
  return e.deltaX || dy < 50 ? "pave" : "molette";
}

const copie = (e: WheelEvent): WheelEventInit => ({
  bubbles: true,
  cancelable: true,
  clientX: e.clientX,
  clientY: e.clientY,
  screenX: e.screenX,
  screenY: e.screenY,
  deltaMode: e.deltaMode,
  deltaX: e.deltaX,
  deltaY: e.deltaY,
  deltaZ: e.deltaZ,
  ctrlKey: e.ctrlKey,
  shiftKey: e.shiftKey,
  altKey: e.altKey,
  metaKey: e.metaKey,
});

/**
 * Branche les gestes sur le plan ; renvoie de quoi les débrancher. `pente`,
 * l'inclinaison selon le zoom, que le plan suit de lui-même ; null quand des
 * doigts peuvent l'incliner.
 */
export function gestesOrdinateur(map: PlanMap, pente: ((zoom: number) => number) | null): () => void {
  const plan = map.getContainer();
  const toile = map.getCanvasContainer();

  // Le point visé par le zoom en cours, jusqu'à ce que le plan se pose.
  let visee: Point | null = null;
  const viser = (e: MouseEvent) => {
    const r = toile.getBoundingClientRect();
    visee = new Point(e.clientX - r.left, e.clientY - r.top);
  };
  const poser = () => {
    visee = null;
  };
  if (pente) {
    map.transformCameraUpdate = (demande) => {
      const cam = demande as unknown as Camera;
      const pitch = pente(cam.zoom);
      if (!visee || Math.abs(pitch - cam.pitch) < 0.01) return { pitch };
      // Ce qui est sous le curseur, et ce qui y serait une fois penché : le
      // plan glisse de l'un à l'autre (sur le plan à plat, en Mercator).
      const penchee = cam.clone();
      penchee.setPitch(pitch);
      const [vise, glisse, centre] = [cam.screenPointToLocation(visee), penchee.screenPointToLocation(visee), cam.center].map((l) =>
        MercatorCoordinate.fromLngLat(l)
      );
      return { pitch, center: new MercatorCoordinate(centre.x + vise.x - glisse.x, centre.y + vise.y - glisse.y).toLngLat() };
    };
    map.on("moveend", poser);
    toile.addEventListener("dblclick", viser);
  }

  // Le premier événement d'un geste en décide : l'élan d'un pavé finit en
  // grands écarts qui ressembleraient à des crans.
  let enCours: Genre = "molette";
  let dernier = -Infinity;
  const lire = (e: WheelEvent) => {
    if (e.timeStamp - dernier > SILENCE) enCours = genre(e);
    dernier = e.timeStamp;
    return enCours;
  };
  const glisser = (e: WheelEvent) => map.panBy([e.deltaX, e.deltaY], { duration: 0 });

  // Sur le plan : le pavé déplace, la molette et le pincement restent à MapLibre (qui zoome).
  const surPlan = (e: WheelEvent) => {
    if (e.ctrlKey || lire(e) !== "pave") return viser(e);
    e.preventDefault();
    e.stopPropagation();
    glisser(e);
  };

  // Ailleurs sur la page.
  const horsPlan = (e: WheelEvent) => {
    const cible = e.target instanceof Element ? e.target : null;
    if (!cible || plan.contains(cible)) return;
    const traverse = cible.closest(TRAVERSE);
    // Une molette sur une carte, un bouton, une fiche : la leur.
    if (!e.ctrlKey && cible !== traverse) return;
    e.preventDefault();
    if (!traverse) return;
    if (!e.ctrlKey && lire(e) === "pave") glisser(e);
    else toile.dispatchEvent(new WheelEvent("wheel", copie(e)));
  };

  // Safari zoome aussi la page par ses propres événements de geste ; sur le
  // plan, on le laisse faire (le pincement y arrive en molette à MapLibre).
  const geste = (e: Event) => {
    if (!(e.target instanceof Node && plan.contains(e.target))) e.preventDefault();
  };

  // Le glisser de la souris sur une surcouche transparente : le plan le prend.
  let souris = false;
  const pointe = (e: PointerEvent) => {
    souris = e.pointerType === "mouse";
  };
  const appui = (e: MouseEvent) => {
    if (!souris || e.button !== 0 || !(e.target instanceof Element) || !e.target.matches(TRAVERSE)) return;
    // Pas de texte sélectionné en route.
    e.preventDefault();
    const { clientX, clientY, screenX, screenY } = e;
    toile.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX, clientY, screenX, screenY, button: 0, buttons: 1 }));
  };

  const actif = { passive: false, capture: true };
  plan.addEventListener("wheel", surPlan, actif);
  document.addEventListener("wheel", horsPlan, actif);
  document.addEventListener("pointerdown", pointe, true);
  document.addEventListener("mousedown", appui, true);
  const gestes = ["gesturestart", "gesturechange", "gestureend"];
  if (navigator.maxTouchPoints === 0) for (const g of gestes) document.addEventListener(g, geste, actif);
  return () => {
    if (pente) {
      map.transformCameraUpdate = null;
      map.off("moveend", poser);
      toile.removeEventListener("dblclick", viser);
    }
    plan.removeEventListener("wheel", surPlan, actif);
    document.removeEventListener("wheel", horsPlan, actif);
    document.removeEventListener("pointerdown", pointe, true);
    document.removeEventListener("mousedown", appui, true);
    for (const g of gestes) document.removeEventListener(g, geste, actif);
  };
}
