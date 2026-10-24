"use client";

// La carte en grand. Sabri, le 24/10 : « T'as vu, les cartes, elles sont très
// belles, donc quand on clique dessus, on pourrait ouvrir dedans, vraiment
// bien la manipuler, en dehors de ces aperçus. »
//
// Toucher une carte en 3D (Ma carte, le profil d'un joueur, la carte d'une
// fiche ouverte depuis un classement, une liste ou la Map, les cartes d'un
// dimanche) l'ouvre en plein écran : la carte quitte sa place et vient au
// centre, en grand, sur une scène de nuit éclairée derrière elle, et se tient
// au doigt (carte-en-grand-3d.tsx : tourner, pencher, retourner, zoomer). La
// croix, Échap ou un toucher à côté la renvoient à sa place, de face.
//
// Le 23/10, Sabri ne voulait plus d'une carte qui « flotte » au milieu de la
// page floutée (card-viewer.tsx) : ici, c'est une scène à part entière, pas
// une carte posée sur la page. La fiche d'un joueur (ses abonnés, Suivre, son
// profil) reste la pop-up du bas ; c'est sa carte qui s'y ouvre en grand, d'un
// toucher de plus.
//
// D'abord la carte plate (photo comprise, nette à toutes les tailles) vole de
// sa place jusqu'au centre, pendant que les calques de la 3D se photographient
// en haute définition (Card3D, `definition`) ; la 3D la remplace, posée
// exactement dessus, dès sa première image. La scène est un Dialog de Base
// UI : ouverte depuis une pop-up (la fiche d'une carte, un profil), elle s'y
// emboîte (Échap ne ferme qu'elle, la pop-up attend dessous).
//
// L'appui long sur la carte n'ouvre rien, et le menu d'iOS ne vient pas : il
// est gardé pour la passe de saison (plongee-carte.tsx).

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from "react";
import dynamic from "next/dynamic";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Card3D, prechaufferCarte } from "./card-3d";
import type { CommandesScene } from "./carte-en-grand-3d";

const chargerScene = () => import("./carte-en-grand-3d");
const SceneEnGrand = dynamic(() => chargerScene().then((m) => m.SceneEnGrand), { ssr: false });

/** Au-delà, un appui long (celui de la scène et de la passe, recopié pour ne pas charger three ici). */
const APPUI_LONG = 450;
/** La part du canvas d'un aperçu qu'occupe sa carte (FILL_RATIO de card-3d-canvas.tsx, recopié). */
const REMPLISSAGE_3D = 0.72;
/** La carte fait 1 × φ (bola-card.tsx, 1024 × 1656). */
const HAUTEUR_CARTE = 1656 / 1024;
/** Le vol de la carte plate, à l'aller ; le retour, plus court. */
const VOL = 440;
const RETOUR = 280;
const EASE = "cubic-bezier(0.2, 0.9, 0.3, 1)";

/** Une carte à ouvrir en grand : le rendu de CardShell, comme Card3D. */
export interface CarteAOuvrir {
  cacheKey: string;
  mode?: "simple" | "rare";
  render: (size: number) => ReactNode;
  titre?: string;
  sousTitre?: string;
}

/** Dès qu'on pose le doigt sur une carte qui va s'ouvrir : le code 3D et les polices se préparent. */
export function prechaufferEnGrand(node?: HTMLElement | null) {
  prechaufferCarte(node);
  void chargerScene();
}

/** La largeur de la carte posée au centre : grande, mais avec de quoi la tourner, sous le titre. */
function largeurEnGrand(): number {
  if (typeof window === "undefined") return 320;
  return Math.round(Math.min(window.innerWidth * 0.84, (window.innerHeight * 0.64) / HAUTEUR_CARTE, 430));
}

/** Le rectangle de la carte visible dans un aperçu 3D (au centre de son canvas). */
function carteDans(el: HTMLElement | null): DOMRect | null {
  const canvas = el?.querySelector("canvas") ?? null;
  const r = (canvas ?? el)?.getBoundingClientRect();
  if (!r || !r.width) return null;
  const k = canvas ? REMPLISSAGE_3D : 1;
  const w = r.width * k;
  const h = r.height * k;
  return new DOMRect(r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h);
}

/**
 * Une carte 3D d'aperçu (Card3D, mêmes props) qu'un toucher ouvre en grand.
 * Elle se tourne toujours sur place : seul un toucher bref, sans glisser,
 * l'ouvre ; un appui long, rien.
 */
export function Card3DEnGrand({
  titre,
  sousTitre,
  ...props
}: ComponentProps<typeof Card3D> & { titre: string; sousTitre?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const appui = useRef<{ id: number; x: number; y: number; t: number } | null>(null);
  const [ouverte, setOuverte] = useState(false);
  const [origine, setOrigine] = useState<DOMRect | null>(null);
  const ouvrir = () => {
    setOrigine(carteDans(ref.current));
    setOuverte(true);
  };

  return (
    <>
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={`Ouvrir la carte de ${titre} en grand`}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          appui.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp };
          prechaufferEnGrand(ref.current);
        }}
        onPointerUp={(e) => {
          const a = appui.current;
          appui.current = null;
          if (a && a.id === e.pointerId && Math.hypot(e.clientX - a.x, e.clientY - a.y) < 8 && e.timeStamp - a.t < APPUI_LONG) ouvrir();
        }}
        onPointerCancel={() => {
          appui.current = null;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            ouvrir();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        className="w-fit cursor-pointer rounded-[24px] outline-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-foreground/40"
      >
        <Card3D {...props} />
      </div>
      <CarteEnGrand
        carte={{ cacheKey: props.cacheKey, mode: props.mode, render: props.render, titre, sousTitre }}
        ouverte={ouverte}
        onOuverteChange={setOuverte}
        origine={origine}
      />
    </>
  );
}

/**
 * La scène plein écran d'une carte. `origine` : le rectangle de la carte
 * touchée, d'où elle part et où elle revient ; sans lui, elle apparaît au
 * centre. Rendue là où la carte a été touchée (dans une pop-up, elle s'y
 * emboîte).
 */
export function CarteEnGrand({
  carte,
  ouverte,
  onOuverteChange,
  origine = null,
}: {
  carte: CarteAOuvrir;
  ouverte: boolean;
  onOuverteChange: (ouverte: boolean) => void;
  origine?: DOMRect | null;
}) {
  // Échap et la croix passent par le retour de la carte à sa place.
  const demandeRef = useRef<(() => void) | null>(null);
  return (
    <Dialog.Root
      open={ouverte}
      onOpenChange={(o) => {
        if (o) onOuverteChange(true);
        else if (demandeRef.current) demandeRef.current();
        else onOuverteChange(false);
      }}
      disablePointerDismissal
    >
      <Dialog.Portal>
        <Scene carte={carte} origine={origine} demandeRef={demandeRef} onFermee={() => onOuverteChange(false)} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Scene({
  carte,
  origine,
  demandeRef,
  onFermee,
}: {
  carte: CarteAOuvrir;
  origine: DOMRect | null;
  demandeRef: RefObject<(() => void) | null>;
  onFermee: () => void;
}) {
  const reduit = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [largeur, setLargeur] = useState(largeurEnGrand);
  // La définition des calques, fixée à l'ouverture (tourner l'écran ne refait pas la photo) :
  // assez pour la carte posée et un peu de zoom, sans charger le téléphone pour rien.
  const [definition] = useState(() =>
    Math.min(5, Math.max(3, Math.ceil((largeur * (typeof window === "undefined" ? 2 : window.devicePixelRatio || 1) * 1.25) / 254)))
  );
  /** La carte plate est arrivée au centre (sans vol, elle y est déjà). */
  const [arrivee, setArrivee] = useState(!origine || reduit);
  /** La 3D a dessiné sa première image. */
  const [affichee, setAffichee] = useState(false);
  /** La carte grossie passe sous le titre : il s'efface (la croix reste). */
  const [grossie, setGrossie] = useState(false);
  const [fermeture, setFermeture] = useState(false);
  const platRef = useRef<HTMLDivElement>(null);
  const commandesRef = useRef<CommandesScene | null>(null);
  const fermee = useRef(onFermee);
  const montree = arrivee && affichee;

  useEffect(() => {
    fermee.current = onFermee;
  });

  useEffect(() => {
    const suivre = () => setLargeur(largeurEnGrand());
    window.addEventListener("resize", suivre);
    return () => window.removeEventListener("resize", suivre);
  }, []);

  // Le vol de la carte plate, de sa place jusqu'au centre.
  useLayoutEffect(() => {
    const el = platRef.current;
    if (!el || !origine || reduit) return;
    const cible = el.getBoundingClientRect();
    const k = origine.width / Math.max(1, cible.width);
    const dx = origine.left + origine.width / 2 - (cible.left + cible.width / 2);
    const dy = origine.top + origine.height / 2 - (cible.top + cible.height / 2);
    const vol = el.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${k})` }, { transform: "none" }], {
      duration: VOL,
      easing: EASE,
    });
    vol.onfinish = () => setArrivee(true);
    return () => vol.cancel();
  }, [origine, reduit]);

  const fermer = useCallback(() => {
    if (fermeture) return;
    setFermeture(true);
    if (montree) commandesRef.current?.revenir(origine);
    else if (platRef.current && origine && !reduit) {
      // La 3D n'est pas encore là : la carte plate repart d'où elle vient.
      const cible = platRef.current.getBoundingClientRect();
      const k = origine.width / Math.max(1, cible.width);
      const dx = origine.left + origine.width / 2 - (cible.left + cible.width / 2);
      const dy = origine.top + origine.height / 2 - (cible.top + cible.height / 2);
      platRef.current.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], {
        duration: RETOUR,
        easing: EASE,
        fill: "forwards",
      });
    }
    window.setTimeout(() => fermee.current(), reduit ? 0 : RETOUR);
  }, [fermeture, montree, origine, reduit]);

  useEffect(() => {
    demandeRef.current = fermer;
    return () => {
      demandeRef.current = null;
    };
  }, [demandeRef, fermer]);

  const hauteur = largeur * HAUTEUR_CARTE;
  const titre = carte.titre ?? "Carte";

  return (
    <Dialog.Popup
      data-fermeture={fermeture ? "" : undefined}
      onKeyDown={(e) => {
        const c = commandesRef.current;
        if (!c || fermeture) return;
        if (e.key === "ArrowLeft") c.retourner(-1);
        else if (e.key === "ArrowRight") c.retourner(1);
        else if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) c.retourner(1);
        else if (e.key === "+" || e.key === "=") c.zoomer(1.25);
        else if (e.key === "-") c.zoomer(0.8);
        else return;
        e.preventDefault();
      }}
      className="carte-en-grand dark fixed inset-0 z-[1400] overflow-hidden text-foreground outline-none select-none [-webkit-touch-callout:none] data-ending-style:opacity-0"
    >
      <div aria-hidden className="carte-en-grand-fond absolute inset-0" />

      {/* La 3D, plein écran. Avant elle, un toucher à côté de la carte plate referme. */}
      <div
        className="absolute inset-0 touch-none"
        onClick={(e) => {
          if (montree) return;
          const r = platRef.current?.getBoundingClientRect();
          if (!r || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) fermer();
        }}
      >
        <Card3D
          cacheKey={`grand-${carte.cacheKey}`}
          mode={carte.mode}
          render={carte.render}
          definition={definition}
          scene={(calques) => (
            <SceneEnGrand
              calques={calques}
              mode={carte.mode ?? "simple"}
              largeurPx={largeur}
              visible={montree}
              reduit={reduit}
              commandesRef={commandesRef}
              onAffichee={() => setAffichee(true)}
              onFermer={fermer}
              onZoom={setGrossie}
            />
          )}
        />
      </div>

      {/* La carte plate : elle vole jusqu'ici, puis la 3D la remplace, posée exactement dessus. */}
      <div
        ref={platRef}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2"
        style={{
          width: largeur,
          height: hauteur,
          marginLeft: -largeur / 2,
          marginTop: -hauteur / 2,
          opacity: montree ? 0 : 1,
          transition: "opacity 220ms ease-out",
          visibility: montree && fermeture ? "hidden" : undefined,
        }}
      >
        {carte.render(largeur / 254)}
      </div>

      <header className="carte-en-grand-titre pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-5 pt-[calc(env(safe-area-inset-top,0px)+22px)]">
        <div className="min-w-0 transition-opacity duration-200" style={{ opacity: grossie ? 0 : 1 }}>
          {carte.sousTitre && <p className="mono-label truncate text-white/55">{carte.sousTitre}</p>}
          <Dialog.Title className="truncate text-[26px] leading-[1.1] font-bold tracking-tight text-white">{titre}</Dialog.Title>
        </div>
        <Dialog.Close aria-label="Fermer" className="bouton-secondaire pointer-events-auto grid size-10 shrink-0 place-items-center">
          <X className="size-4" strokeWidth={2.4} />
        </Dialog.Close>
      </header>
    </Dialog.Popup>
  );
}
