"use client";

// Carte "grand format" manipulable en 3D (accueil + Ma carte) : on capture
// le rendu HTML existant de PlayerCard en image, puis on la plaque sur un
// plan Three.js qu'on peut incliner au doigt/à la souris — même visuel
// exact que la carte plate, avec un vrai effet 3D façon carte à collectionner.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toPng } from "html-to-image";
import { PlayerCard, type CardMode } from "./player-card";
import type { Player } from "@/lib/sfl/engine";

const CardCanvas = dynamic(() => import("./card-3d-canvas").then((m) => m.CardCanvas), {
  ssr: false,
});

interface Captured {
  url: string;
  width: number;
  height: number;
}

export function Card3D({
  player,
  mode = "rare",
  size = 1,
}: {
  player: Player;
  mode?: CardMode;
  size?: number;
}) {
  const captureRef = useRef<HTMLDivElement>(null);
  const [captured, setCaptured] = useState<Captured | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function capture() {
      const node = captureRef.current;
      if (!node) return;
      try {
        await document.fonts.ready;
        const rect = node.getBoundingClientRect();
        const url = await toPng(node, {
          pixelRatio: 2,
          cacheBust: true,
          // Une photo joueur manquante (404) ne doit pas faire échouer toute
          // la capture — elle est simplement remplacée par du transparent.
          imagePlaceholder:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        });
        if (!cancelled) setCaptured({ url, width: rect.width, height: rect.height });
      } catch {
        // rasterisation indisponible — la carte plate ci-dessous reste
        // affichée en repli
      }
    }
    capture();
    return () => {
      cancelled = true;
    };
  }, [player.name, mode]);

  const width = captured ? captured.width * size : undefined;
  const height = captured ? captured.height * size : undefined;

  return (
    <div style={{ position: "relative", width, height }}>
      {/* Source de capture — hors-écran (clip par un parent de taille nulle,
          jamais opacity:0 sur le nœud capturé lui-même, sinon l'image
          rasterisée hérite de cette opacité et ressort vide). */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0, overflow: "hidden" }}>
        <div ref={captureRef} style={{ position: "absolute" }} aria-hidden>
          <PlayerCard player={player} mode={mode} size={1} />
        </div>
      </div>

      {captured ? (
        <CardCanvas imageUrl={captured.url} holo={mode === "rare"} />
      ) : (
        <PlayerCard player={player} mode={mode} size={size} />
      )}
    </div>
  );
}
