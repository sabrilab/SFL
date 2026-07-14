"use client";

// Carte manipulable en 3D : on capture n'importe quel rendu CardShell
// (PlayerCard ou BoostCard, via la prop `render`) en trois calques
// transparents alignés (fond doré, joueur, statistiques) puis on les
// empile sur des plans Three.js à des profondeurs différentes — en
// tournant la carte, les calques se découvrent avec une vraie parallaxe,
// façon carte à collectionner Pokémon plutôt qu'un simple aplat texturé.
//
// Montage paresseux (IntersectionObserver) : la capture + le canvas
// WebGL ne démarrent que quand la carte entre dans le viewport, et le
// montage reste acquis ensuite — utile dès qu'on affiche ce composant en
// nombre (accueil, classements) sans épuiser les contextes WebGL.

import { useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { toPng } from "html-to-image";

const CardCanvas = dynamic(() => import("./card-3d-canvas").then((m) => m.CardCanvas), {
  ssr: false,
});

const TRANSPARENT_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

interface CapturedLayers {
  background: string;
  playerLayer: string;
  stats: string;
  width: number;
  height: number;
}

// Capture le nœud une fois par calque : soit en excluant certaines parties
// (fond = tout sauf joueur/stats), soit en isolant une seule partie (son
// arborescence d'ancêtres reste incluse pour garder le même cadrage, mais
// leur fond est rendu transparent le temps de la capture).
async function captureLayer(
  node: HTMLElement,
  opts: { isolatePart?: "player" | "stats"; excludeParts?: string[] }
): Promise<string> {
  const transparentEls: HTMLElement[] = [];
  let isolateEl: HTMLElement | null = null;

  if (opts.isolatePart) {
    isolateEl = node.querySelector(`[data-card-part="${opts.isolatePart}"]`);
    const frame = node.querySelector<HTMLElement>('[data-card-part="frame"]');
    const body = node.querySelector<HTMLElement>('[data-card-part="body"]');
    if (frame) transparentEls.push(frame);
    if (body) transparentEls.push(body);
  }

  const restores = transparentEls.map((el) => [el, el.style.background, el.style.boxShadow] as const);
  transparentEls.forEach((el) => {
    el.style.background = "transparent";
    el.style.boxShadow = "none";
  });

  try {
    return await toPng(node, {
      pixelRatio: 2,
      cacheBust: true,
      imagePlaceholder: TRANSPARENT_PX,
      filter: (n) => {
        if (isolateEl) {
          if (n === isolateEl) return true;
          if (n.contains(isolateEl) || isolateEl.contains(n)) return true;
          return false;
        }
        if (opts.excludeParts && n instanceof HTMLElement) {
          const part = n.dataset.cardPart;
          if (part && opts.excludeParts.includes(part)) return false;
        }
        return true;
      },
    });
  } finally {
    restores.forEach(([el, bg, shadow]) => {
      el.style.background = bg;
      el.style.boxShadow = shadow;
    });
  }
}

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, inView]);
  return inView;
}

// `cacheKey` devient la React `key` du composant interne : quand elle
// change (nouveau joueur, nouveau highlight), React démonte et remonte
// entièrement l'instance plutôt que de réutiliser l'état — l'ancien
// rendu 3D ne peut donc jamais s'afficher périmé pendant la recapture,
// sans avoir besoin d'un setState synchrone dans l'effet.
export function Card3D(props: {
  size?: number;
  mode?: "simple" | "rare";
  cacheKey: string;
  render: (size: number) => ReactNode;
}) {
  return <Card3DInner key={props.cacheKey} {...props} />;
}

function Card3DInner({
  size = 1,
  mode = "rare",
  render,
}: {
  size?: number;
  /** Contrôle la couleur du bezel et l'intensité de l'effet holo. */
  mode?: "simple" | "rare";
  /** Rend le contenu CardShell (PlayerCard/BoostCard) à la taille donnée. */
  render: (size: number) => ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [captured, setCaptured] = useState<CapturedLayers | null>(null);
  const inView = useInView(wrapperRef);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    async function run() {
      const node = captureRef.current;
      if (!node) return;
      try {
        await document.fonts.ready;
        const rect = node.getBoundingClientRect();
        // Séquentiel : chaque capture bascule temporairement le fond de
        // certains nœuds partagés, donc deux captures concurrentes sur le
        // même arbre se marcheraient dessus.
        const background = await captureLayer(node, { excludeParts: ["player", "stats"] });
        const playerLayer = await captureLayer(node, { isolatePart: "player" });
        const stats = await captureLayer(node, { isolatePart: "stats" });
        if (!cancelled) {
          setCaptured({ background, playerLayer, stats, width: rect.width, height: rect.height });
        }
      } catch {
        // rasterisation indisponible — la carte plate ci-dessous reste
        // affichée en repli
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [inView]);

  const width = captured ? captured.width * size : undefined;
  const height = captured ? captured.height * size : undefined;

  return (
    <div ref={wrapperRef} style={{ position: "relative", width, height }}>
      {/* Source de capture — hors-écran (clip par un parent de taille nulle,
          jamais opacity:0 sur le nœud capturé lui-même, sinon l'image
          rasterisée hérite de cette opacité et ressort vide). */}
      {inView && (
        <div style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0, overflow: "hidden" }}>
          <div ref={captureRef} style={{ position: "absolute" }} aria-hidden>
            {render(1)}
          </div>
        </div>
      )}

      {captured ? (
        <CardCanvas
          background={captured.background}
          playerLayer={captured.playerLayer}
          stats={captured.stats}
          holo={mode === "rare"}
          mode={mode}
        />
      ) : (
        render(size)
      )}
    </div>
  );
}
