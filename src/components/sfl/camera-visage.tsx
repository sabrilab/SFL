"use client";

// L'appareil photo de la photo officielle : la caméra de face, ouverte dans
// le navigateur (getUserMedia, y compris dans l'app installée sur iPhone), avec
// un ovale où poser la tête. Tout le monde cadre pareil : même distance, même
// hauteur d'yeux, et le modèle reçoit des visages comparables d'une carte à
// l'autre.
//
// L'image prise est exactement ce que montre le cadre (le rectangle 3:4 visible
// de la vidéo, en object-cover), à SELFIE_COTE pixels de haut au plus, dans le
// vrai sens : l'aperçu est en miroir comme une caméra de selfie, pas la photo.
//
// Sans caméra (refus, appareil sans caméra, navigateur trop ancien), le
// composant le dit à son parent (onIndisponible), qui propose la galerie.

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { SELFIE_COTE } from "@/lib/sfl/photo-studio";

/** Les proportions du cadre de visée (largeur / hauteur). */
const CADRE = 3 / 4;

export function CameraVisage({
  consigne,
  onPhoto,
  onIndisponible,
  desactive,
}: {
  /** Ce qu'on demande pour cette prise (« De face », …). */
  consigne: string;
  onPhoto: (dataUrl: string) => void;
  onIndisponible: () => void;
  desactive?: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [prete, setPrete] = useState(false);
  const [eclair, setEclair] = useState(false);
  // Le parent change d'avis sans que la caméra soit relancée.
  const indisponible = useRef(onIndisponible);
  useEffect(() => {
    indisponible.current = onIndisponible;
  }, [onIndisponible]);

  useEffect(() => {
    let flux: MediaStream | null = null;
    let fini = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => indisponible.current());
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      })
      .then((f) => {
        if (fini) {
          f.getTracks().forEach((t) => t.stop());
          return;
        }
        flux = f;
        const v = video.current;
        if (!v) return;
        v.srcObject = f;
        void v.play().catch(() => {});
      })
      .catch(() => {
        if (!fini) indisponible.current();
      });
    return () => {
      fini = true;
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function prendre() {
    const v = video.current;
    if (!v || !prete || desactive) return;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    // Le rectangle visible dans le cadre (object-cover, centré).
    const [sw, sh] = vw / vh > CADRE ? [vh * CADRE, vh] : [vw, vw / CADRE];
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    const echelle = Math.min(1, SELFIE_COTE / sh);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * echelle);
    canvas.height = Math.round(sh * echelle);
    canvas.getContext("2d")!.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    setEclair(true);
    window.setTimeout(() => setEclair(false), 180);
    onPhoto(canvas.toDataURL("image/jpeg", 0.86));
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative aspect-[3/4] w-full max-w-[340px] overflow-hidden rounded-[26px] bg-black">
        <video
          ref={video}
          playsInline
          muted
          autoPlay
          onLoadedMetadata={() => setPrete(true)}
          className="size-full -scale-x-100 object-cover"
        />
        {/* L'ovale du visage : tout le reste voilé. Yeux vers le haut du tiers
            central, menton au-dessus du bas, place pour les épaules. */}
        <svg viewBox="0 0 300 400" className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          <defs>
            <mask id="cam-visage-trou">
              <rect width="300" height="400" fill="white" />
              <ellipse cx="150" cy="172" rx="88" ry="116" fill="black" />
            </mask>
          </defs>
          <rect width="300" height="400" fill="black" opacity="0.5" mask="url(#cam-visage-trou)" />
          <ellipse
            cx="150"
            cy="172"
            rx="88"
            ry="116"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeDasharray="7 7"
            opacity="0.9"
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 text-center text-lecture font-semibold text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
          {consigne}
        </div>
        {!prete && (
          <div className="absolute inset-0 grid place-items-center text-white/80">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
        {eclair && <div className="absolute inset-0 bg-white/80 motion-reduce:hidden" />}
      </div>

      <button
        type="button"
        aria-label="Prendre la photo"
        disabled={!prete || desactive}
        onClick={prendre}
        className="grid size-[72px] place-items-center rounded-full ring-4 ring-foreground/80 transition-transform active:scale-95 disabled:opacity-40"
      >
        <span className="block size-[58px] rounded-full bg-foreground" />
      </button>
    </div>
  );
}
